# Security and Tenant Isolation Verification Checklist

**Milestone:** End-to-End Demo Validation  
**Scope:** Multi-Tenant Isolation, Authentication, Authorization & Secrets Management  

---

## 1. Multi-Tenancy & Data Isolation Matrix

Every database table and API operation enforces strict tenant ownership scoping:

| Domain | Scope Key | Isolation Mechanism | Verification Test | Status |
|---|---|---|---|:---:|
| **Stores & Memberships** | `organization_id`, `store_id` | Store membership checks (`StoreRepository.findMembership`) | `tests/stores.tenant-isolation.test.ts` | **PASS** |
| **Products & Variants** | `store_id` | Foreign keys with `(id, store_id)` composite constraints | `tests/products.tenant-isolation.test.ts` | **PASS** |
| **Inventory** | `store_id` | `inventory_items` and `inventory_adjustments` store foreign keys | `tests/inventory.adversarial.test.ts` | **PASS** |
| **Carts & Items** | `store_id` | Composite unique index and FKs `(cart_id, store_id)` | `tests/carts/cart.api.test.ts` | **PASS** |
| **Checkouts & Items** | `store_id` | Unique composite `(id, store_id)`, FKs referencing carts | `tests/checkout/checkout.api.test.ts` | **PASS** |
| **Discounts & Redemptions** | `store_id` | Unique composite `(store_id, code)` and explicit cross-store guards | `tests/discounts/discount-redemption.test.ts` | **PASS** |
| **Payments & Attempts** | `store_id` | Composite constraints `(id, store_id)` and cross-store check | `tests/payments/payment-checkout-integration.test.ts` | **PASS** |
| **Orders & Items** | `store_id` | Unique `(order_number, store_id)` and customer store verification | `tests/orders/orders.api.test.ts` | **PASS** |

---

## 2. Security Boundaries & Protection Invariants

### 2.1 Cross-Store Tampering Prevention
- **Invariant:** Store A cannot read, modify, or checkout resources belonging to Store B.
- **Verification:**
  - `PaymentCheckoutCoordinator.initializePaymentForCheckout`: Rejects initializing payments when `storeId` does not match checkout `store_id`. Tested in `tests/integration/demo/complete-purchase-workflow.test.ts`.
  - `DiscountRedemptionService.recordRedemption`: Rejects redemptions when discount belongs to another store with `CrossStoreDiscountAccessError`. Tested in `tests/discounts/discount-redemption.test.ts`.
  - `OrderCancellationCoordinator`: Rejects cancelling orders belonging to another store with `404 NOT_FOUND` or `OrderNotFoundError`. Tested in `tests/orders/orders.api.test.ts`.

### 2.2 Server-Authoritative Integrity
- **No Client Price Overrides:** Product variant prices, cart totals, and checkout line items are fetched strictly from the database. Client payloads containing prices or subtotals are rejected or ignored.
- **Authoritative Total Calculations:** Discount values, taxes, and shipping are computed on the server. Grand total is enforced as `subtotal - discount_total + tax_total + shipping_total`.
- **Payment Gateway Amount Matching:** `ProviderPaymentService` asserts `gatewayPayment.amount === attemptRow.amount` and currencies match before marking payments `CAPTURED`. Mismatches trigger `PaymentAmountMismatchError` and transition state to `REQUIRES_RECONCILIATION`.

### 2.3 Authentication & Authorization
- **Session Tokens:** Server session tokens (`auth_token`) signed using `AUTH_SECRET` (minimum 32 characters) via HMAC SHA256. Invalid tokens return `401 Unauthorized`.
- **Role Enforcement:** Merchant actions (creating products, updating discounts, adjusting inventory, cancelling orders) require `admin` or `owner` store role. Staff members are blocked (`403 Forbidden`).
- **Store Enumeration Mitigation:** Accessing resources across non-member stores returns `404 NOT_FOUND` rather than revealing tenant presence.

### 2.4 Cryptographic Signatures & Webhook Security
- **Callback Signature:** Razorpay payment callback verifies HMAC SHA256 signature against `RAZORPAY_KEY_SECRET`: `HMAC_SHA256(order_id + "|" + payment_id, secret)`.
- **Webhook Signature:** Webhook handler validates `x-razorpay-signature` against `RAZORPAY_WEBHOOK_SECRET`. Invalid or missing signatures return `400 Bad Request` without executing downstream effects.
- **Secret Isolation:** `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are never exposed in browser bundles, API responses, or logs. Only `NEXT_PUBLIC_RAZORPAY_KEY_ID` is exposed to storefront clients.
