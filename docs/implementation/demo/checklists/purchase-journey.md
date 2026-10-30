# Demo Purchase Journey Verification Checklist

**Milestone:** End-to-End Demo Validation  
**Scope:** Core Customer & Merchant Commerce Lifecycle  
**Target:** Live PostgreSQL + Next.js App Router + Razorpay Test Mode  

---

## 1. Journey Overview

This checklist validates the end-to-end customer purchase journey and merchant management workflow in the Cal Cart platform. Every step is verified to be server-authoritative, concurrency-safe, and tenant-isolated.

---

## 2. Step-by-Step Verification Checklist

| Step # | Stage | Action / Requirement | Verification Method | Status | Notes |
|:---:|---|---|---|:---:|---|
| **1** | **Merchant Auth & Store Context** | Merchant signs in with credentials, authenticates session, and selects an active store. | Automated tests & session cookie validation | **PASS** | Session cookie `auth_token` verified with HMAC signature; store membership checked via `StoreRepository`. |
| **2** | **Catalog: Product & Variant** | Merchant creates a new product with purchasable variants, SKU, price, and currency. | `POST /api/v1/stores/[storeId]/products` & variant routes | **PASS** | `ProductService` creates product entity and variant entities with unique slugs and prices in integer cents. |
| **3** | **Inventory Management** | Merchant initializes tracked inventory item with available stock and audit adjustment record. | `inventory_items` and `inventory_adjustments` tables | **PASS** | Invariant enforced: `new_quantity = previous_quantity + quantity_delta`. |
| **4** | **Product Publishing** | Merchant transitions product from `DRAFT` to `ACTIVE` (published). | `POST /api/v1/stores/[storeId]/products/[productId]/publish` | **PASS** | Published products are discoverable on storefront endpoints. |
| **5** | **Merchant Discount Administration** | Merchant creates discount code (percentage or fixed amount), configures min spend and usage limit, and activates it. | `POST /api/v1/stores/[storeId]/discounts` & `/activate` | **PASS** | Tested in `tests/integration/merchant-discount-workflow.test.ts`. Persisted in PostgreSQL `discounts` table. |
| **6** | **Storefront Catalog Browsing** | Customer opens store-scoped storefront (`/stores/[storeSlug]/products`) and selects variant. | `GET /stores/[storeSlug]/products/[productSlug]` | **PASS** | Strict tenant scoping prevents leakage of products from other stores. |
| **7** | **Cart Management** | Customer adds variant to cart. Server calculates line subtotals and grand totals. | `POST /api/v1/stores/[storeId]/carts/[cartId]/items` | **PASS** | Server-authoritative calculations; client cannot tamper with price. |
| **8** | **Discount Code Application** | Customer enters discount code. Server validates eligibility against subtotal and active status. | `DiscountService.evaluateCode` & storefront cart route | **PASS** | Applies valid percentage/fixed amount, enforces minimum spend and usage limits. |
| **9** | **Checkout Creation** | Customer initiates checkout; server captures cart snapshot, customer email, and address info. | `POST /api/v1/stores/[storeId]/checkouts` | **PASS** | Checkout created in `OPEN` state with required address validations (`OrderAddressProps`). |
| **10** | **Payment Initialization** | Storefront initializes payment. Server reserves idempotency key, creates payment attempt, and requests provider order. | `PaymentCheckoutCoordinator.initializePaymentForCheckout` | **PASS** | Transitions checkout to `PAYMENT_PENDING`; creates `CREATED` payment record. |
| **11** | **Razorpay Test Payment Flow** | Customer completes simulated card payment using Razorpay test credentials or mock transport. | Razorpay Orders & Payments API | **PASS** | Verified with test provider; mock transport passes end-to-end integration tests. |
| **12** | **Payment Verification & Capture** | Gateway callback / webhook arrives with HMAC SHA256 signature. Server validates signature and marks payment `CAPTURED`. | `ProviderPaymentService.verifyAndProcessCallback` | **PASS** | Invalid or tampered signatures rejected with 400 Bad Request. |
| **13** | **Order Creation & Finalization** | Server idempotently creates `Order` from immutable checkout snapshot, marks financial status `PAID`, and completes checkout. | `PaymentOrderIntegration.completePurchaseWorkflow` | **PASS** | Exactly one order created per checkout (`UNIQUE (store_id, checkout_id)`). |
| **14** | **Discount Redemption Ledger** | Server records immutable redemption record linking discount, order, store, and customer, and atomically increments usage count. | `DiscountRedemptionService.recordRedemption` | **PASS** | Enforces `UNIQUE (discount_id, order_id)`; prevents double increments on retries. |
| **15** | **Order Confirmation Display** | Storefront renders order confirmation page with order number, line items, payment status, and totals matching DB. | `/stores/[storeSlug]/orders/[orderId]/confirmation` | **PASS** | Verified via `tests/ui/storefront-order-confirmation.test.tsx`. |

---

## 3. Automated Test Coverage Reference

- **End-to-End Workflow:** [`tests/integration/demo/complete-purchase-workflow.test.ts`](file:///c:/Users/user/Aashif/calcart/tests/integration/demo/complete-purchase-workflow.test.ts)
- **Payment & Order Lifecycle:** [`tests/integration/payment-checkout-order.workflow.test.ts`](file:///c:/Users/user/Aashif/calcart/tests/integration/payment-checkout-order.workflow.test.ts)
- **Merchant Discounts:** [`tests/integration/merchant-discount-workflow.test.ts`](file:///c:/Users/user/Aashif/calcart/tests/integration/merchant-discount-workflow.test.ts)
- **Storefront Discounts:** [`tests/integration/storefront-discount-workflow.test.ts`](file:///c:/Users/user/Aashif/calcart/tests/integration/storefront-discount-workflow.test.ts)
- **Storefront Checkout:** [`tests/integration/storefront-checkout-workflow.test.ts`](file:///c:/Users/user/Aashif/calcart/tests/integration/storefront-checkout-workflow.test.ts)
