# Recovery and Failure Scenarios Verification Checklist

**Milestone:** End-to-End Demo Validation  
**Scope:** Resilience, Concurrency, Idempotency & Failure Recovery  

---

## 1. Concurrency & Integrity Scenarios

| Scenario | Risk | System Defense & Invariant | Verification Test | Status |
|---|---|---|---|:---:|
| **Concurrent Discount Redemptions** | Quota overrun (e.g. 5 customers claim 3 promo slots simultaneously) | Atomic conditional SQL increment: `WHERE id = $1 AND (usage_limit IS NULL OR usage_count < usage_limit)` | `tests/discounts/discount-redemption.test.ts` | **PASS** |
| **Concurrent Payment Callback & Webhook** | Duplicate order creation or double captured status | Database row locking (`SELECT FOR UPDATE`) and unique `(store_id, checkout_id)` constraint on orders | `tests/integration/payment-checkout-order.workflow.test.ts` | **PASS** |
| **Concurrent Checkout Initializations** | Multiple duplicate payment records for same checkout | In-flight promise caching + `idempotency_records` table | `tests/payments/payment-checkout-integration.test.ts` | **PASS** |
| **Inventory Overselling** | Negative available inventory under flash sale traffic | `CHECK (available_quantity >= 0)` constraint + atomic row updates | `tests/inventory.concurrency.test.ts` | **PASS** |

---

## 2. Idempotency & Duplicate Handling

### 2.1 Duplicate Payment Notifications
- **Behavior:** When Razorpay sends duplicate callbacks or webhook deliveries for the same payment:
  1. The webhook handler logs and marks duplicate delivery with `{ received: true, duplicate: true }`.
  2. `PaymentOrderIntegration` detects existing order for `(store_id, checkout_id)` and returns existing order without creating a second record.
- **Verification:** Verified in `tests/integration/payment-checkout-order.workflow.test.ts`.

### 2.2 Duplicate Discount Redemptions
- **Behavior:** `discount_redemptions` enforces unique `(discount_id, order_id)`. Re-submitting the same order returns the existing redemption DTO without incrementing `usage_count`.
- **Verification:** Verified in `tests/discounts/discount-redemption.test.ts`.

### 2.3 Duplicate Refunds
- **Behavior:** Repeated refund calls for the same cancellation idempotency key return the existing refund entity without issuing duplicate gateway refunds.
- **Verification:** Verified in `tests/integration/commerce-critical-path-audit.test.ts`.

---

## 3. Failure & Recovery Mechanisms

### 3.1 Interrupted Purchase Flow (Payment Captured, Order Failed)
- **Scenario:** Payment is successfully captured on the gateway, but worker crashed or database connection dropped before order was recorded.
- **Recovery:** `PaymentRecoveryService` scans for captured payments missing `order_id` (orphaned payments), reconstitutes checkout data, idempotently creates the order, and finalizes checkout.
- **Verification:** Verified in `tests/payments/payment-recovery.test.ts` and `tests/integration/payment-recovery-runtime.test.ts`.

### 3.2 Gateway Timeout During Payment Authorization
- **Scenario:** Gateway call times out while querying payment status.
- **Recovery:** Payment is marked `REQUIRES_RECONCILIATION`. The background scheduler (`PaymentRecoveryScheduler`) queries the gateway on the next poll cycle to reconcile the true state.
- **Verification:** Verified in `tests/integration/payment-recovery-runtime.test.ts`.

### 3.3 Abandoned Webhook Processing (Worker Crash)
- **Scenario:** Worker crashes midway through processing a webhook event.
- **Recovery:** Webhooks are leased with a timeout (`PAYMENT_WEBHOOK_LEASE_TIMEOUT=60000`). `WebhookRecoveryService` identifies expired leases in `PROCESSING` status and safely reclaims them.
- **Verification:** Verified in `tests/payments/webhook-recovery.test.ts`.

### 3.4 Order Cancellation & Inventory Restitution
- **Scenario:** Customer or merchant cancels an order after placement.
- **Recovery:**
  1. Order status transitions to `CANCELLED`.
  2. Inventory reservation is released or stock incremented back via `inventory_adjustments` (`RESTOCK`).
  3. Associated captured payment is refunded via `RefundService`.
  4. If interrupted, `OrderCancellationRecoveryJob` automatically retries unfinished inventory restorations and refunds.
- **Verification:** Verified in `tests/integration/order-cancellation-workflow.test.ts`.

### 3.5 Discount Reversal on Cancellation
- **Scenario:** Order with applied discount is cancelled or refunded.
- **Recovery:** `DiscountRedemptionService.revertRedemption` deletes the redemption row and atomically decrements `usage_count`, restoring the usage slot.
- **Verification:** Verified in `tests/discounts/discount-redemption.test.ts`.
