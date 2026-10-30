# Cross-Domain Payment, Checkout, and Orders Integration Report

## 1. Executive Summary

This report documents the architectural design, implementation, and test verification for integrating the **Payments**, **Checkout**, and **Orders** modules into an end-to-end purchase lifecycle for the multi-tenant Cal Cart platform.

All outstanding integration issues have been resolved:
- **INT-01 (Checkout/payment atomicity):** Resolved via single PostgreSQL transactional boundary (`SELECT ... FOR UPDATE` row locks) in `PaymentCheckoutCoordinator`.
- **INT-04 (Razorpay order-creation timeout & duplicate prevention):** Resolved via deterministic receipt correlation (`receipt: attemptId`), `REQUIRES_RECONCILIATION` state handling, and `findOrderByReceipt` lookup before order recreation.
- **INT-05 (Authoritative capture verification):** Resolved via strict cryptographic signature checks (timing-safe HMAC-SHA256), authoritative provider payment retrieval outside transactions, strict amount/currency validation, and state monotonic transition rules.
- **INT-06 (Recovery of abandoned webhook events in PROCESSING):** Resolved via durable lease mechanism (`processed_at = NOW()`), atomic `createIfNotExists` (`ON CONFLICT DO NOTHING`), stale lease reclamation, and `WebhookRecoveryService`.

All 26 new integration tests and 43 existing regression tests passed with zero failures.

---

## 2. Files Changed and Responsibilities

| File | Subsystem | Responsibility |
| --- | --- | --- |
| `modules/payments/package.json` | Package Config | Declares `@calcart/payments` package and dependencies on `@calcart/db`, `@calcart/checkout`, `@calcart/orders`. |
| `modules/payments/tsconfig.json` | TypeScript Config | TypeScript project reference configuration for payments module. |
| `modules/payments/src/index.ts` | Public API | Exports public domain models, DTOs, application services, provider clients, and recovery coordinators. |
| `modules/payments/src/application/payment-checkout-coordinator.ts` | INT-01 Coordination | Atomically coordinates checkout transition (`OPEN -> PAYMENT_PENDING`) and local payment creation (`Payment` + `PaymentAttempt`) in a single database transaction. |
| `modules/payments/src/application/payment-order-integration.ts` | Order Creation | Idempotently creates orders from trusted checkout snapshots upon verified capture, links payment `order_id`, and completes checkout (`PAYMENT_PENDING -> COMPLETED`). |
| `modules/payments/src/application/provider-payment-service.ts` | INT-04 / INT-05 Service | Coordinates Razorpay order creation with timeout recovery; verifies callback signatures and authoritative provider state; triggers downstream order workflow. |
| `modules/payments/src/application/payment-webhook-service.ts` | INT-06 Webhooks | Ingests Razorpay webhooks; enforces signature verification; implements lease-based deduplication and reclamation; triggers order creation for captured payments. |
| `modules/payments/src/application/payment-recovery-service.ts` | Recovery Coordinator | Background recovery service for orphaned captured payments, ambiguous reconciliation payments, and abandoned webhook leases. |
| `modules/payments/src/webhooks/webhook-recovery.ts` | INT-06 Recovery | Sweeps abandoned webhook records in `PROCESSING` past lease expiry timeout (60s) using `SELECT ... FOR UPDATE SKIP LOCKED`. |
| `modules/payments/src/infrastructure/razorpay-client.ts` | Razorpay Client | HTTP client for Razorpay API; added `getOrder(orderId)` lookup. |
| `modules/payments/src/providers/razorpay-provider.ts` | Provider Adapter | Implements `getOrder` and `findOrderByReceipt` for deterministic recovery of ambiguous orders. |
| `modules/payments/src/webhooks/razorpay-webhook-signature.ts` | Signature Helper | Added and exported `computeRazorpayWebhookSignature` for secure webhook verification and testing. |
| `packages/db/src/repositories/payment-repository.ts` | Data Access | Added `findCapturedWithoutOrder`, `findRequiresReconciliation`, and `findByOrderId` query methods. |
| `packages/db/src/repositories/payment-webhook-event-repository.ts` | Data Access | Added `createIfNotExists` (`ON CONFLICT DO NOTHING`), `markProcessing`, and `findAbandonedProcessing`. |
| `tests/payments/payment-checkout-integration.test.ts` | Test Suite | 8 integration tests covering INT-01 atomicity, rollbacks, concurrency, and store isolation. |
| `tests/payments/payment-order-integration.test.ts` | Test Suite | 6 integration tests covering order creation from capture, idempotency, retries, and concurrency. |
| `tests/payments/payment-recovery.test.ts` | Test Suite | 3 integration tests covering orphaned captured payments, ambiguous reconciliation, and webhook reclamation. |
| `tests/payments/webhook-recovery.test.ts` | Test Suite | 4 integration tests covering INT-06 lease timeouts, worker crash reclamation, and completed duplicate acknowledgment. |
| `tests/integration/payment-checkout-order.workflow.test.ts` | E2E Integration | 5 end-to-end workflow tests covering full purchase lifecycle, crash recoveries, races, and store isolation. |

---

## 3. Actual Purchase Workflow and State Transitions

### Canonical Lifecycle

```
[Cart (ACTIVE)] 
       │
       ▼
[Checkout (OPEN)]
       │
       │  (1) PaymentCheckoutCoordinator.initializePaymentForCheckout
       ▼
[Checkout (PAYMENT_PENDING)] ───► [Payment (CREATED) + PaymentAttempt (INITIATED)]
                                              │
                                              │  (2) ProviderPaymentService.createProviderOrder
                                              ▼
                                 [Payment (PENDING) + PaymentAttempt (PENDING, order_xxx)]
                                              │
                                              │  (3) Customer Pays on Razorpay
                                              ▼
                                 [Callback / Webhook (Signature Verified)]
                                              │
                                              │  (4) Authoritative Lookup & Verification
                                              ▼
                                 [Payment (CAPTURED) + PaymentAttempt (CAPTURED)]
                                              │
                                              │  (5) PaymentOrderIntegration.completePurchaseWorkflow
                                              ▼
                                 [Order (PENDING, payment_status: PAID)]
                                              │
                                              │  (6) Finalize Linkage & Checkout
                                              ▼
                                 [Checkout (COMPLETED)] & [Payment (order_id: ord_xxx)]
```

### State Machine Transitions

1. **Checkout Transitions:**
   - `OPEN -> PAYMENT_PENDING`: Occurs when payment is initialized.
   - `PAYMENT_PENDING -> COMPLETED`: Occurs only after order creation succeeds and payment is captured.
   - If payment initialization fails mid-transaction: Rolled back to `OPEN`.

2. **Payment Transitions:**
   - `CREATED -> PENDING`: Provider order created.
   - `PENDING -> CAPTURED`: Customer payment verified authoritatively.
   - `PENDING -> REQUIRES_RECONCILIATION`: Amount/currency mismatch or ambiguous provider state.
   - `PENDING -> FAILED`: Explicit provider failure.

3. **Order Transitions:**
   - Order created directly with status `PENDING` and `payment_status: PAID` based on trusted checkout snapshot.
   - Constraint `orders_store_checkout_idx` (`store_id`, `checkout_id`) prevents duplicate orders for the same checkout.

---

## 4. INT-01: Checkout and Payment Initialization Coordination

### Problem
An `OPEN` checkout could transition to `PAYMENT_PENDING` while payment creation fails, leaving checkout stuck in `PAYMENT_PENDING` without a payment record. Conversely, concurrent initializations could create duplicate competing payments.

### Solution
1. **Shared Transaction Boundary:**
   Both `checkouts` and `payments` tables reside in the same PostgreSQL database. `PaymentCheckoutCoordinator` executes the checkout transition and payment record insertion within a single `withTransaction` block:
   ```ts
   await withTransaction(clientOrDb, async (tx) => {
     // 1. Lock and validate checkout
     const checkout = await checkoutRepo.findByIdForUpdate(tx, storeId, checkoutId);
     // 2. Transition checkout: OPEN -> PAYMENT_PENDING
     await checkoutService.markPaymentPending(tx, storeId, checkoutId);
     // 3. Insert Payment and PaymentAttempt
     const payment = await paymentRepo.create(tx, { ... });
     const attempt = await attemptRepo.create(tx, { ... });
   });
   ```
2. **ACID Atomicity:** If any step fails (e.g., payment creation error, database constraint, total calculation error), the transaction rolls back completely. The checkout remains in `OPEN` status.
3. **Network Isolation:** Network calls to Razorpay (`POST /v1/orders`) are **never** executed inside this transaction. They are deferred to `ProviderPaymentService.createProviderOrder` in a subsequent phase.
4. **Concurrency Serialization:** 
   - `SELECT ... FOR UPDATE` on the checkout row serializes concurrent initialization attempts.
   - Memory-level in-flight deduplication (`Map<string, Promise<...>>`) prevents duplicate simultaneous executions within the same Node process.
   - Store isolation is enforced by verifying `checkout.store_id === storeId`.

---

## 5. INT-04: Razorpay Order Creation Timeout and Duplicate Prevention

### Problem
Network timeouts during Razorpay order creation (`POST /orders`) leave the local payment attempt in an ambiguous state. A naive retry might create a second Razorpay order, leading to orphaned orders and potential double billing.

### Provider Idempotency Findings
Official Razorpay documentation confirms that `POST /v1/orders` does not support an standard `Idempotency-Key` header. However, it requires a client-generated `receipt` string (maximum 40 characters) that is stored on the order and returned in API responses.

### Solution
1. **Deterministic Receipt Correlation:**
   Each `PaymentAttempt` generates a unique ID (UUIDv7). When creating a Razorpay order, `receipt` is set to `attemptId`:
   ```ts
   const orderResult = await this.provider.createOrder({
     amount: attemptRow.amount,
     currency: attemptRow.currency,
     receipt: attemptId,
     notes: { store_id: storeId, payment_id: paymentId, attempt_id: attemptId },
   });
   ```
2. **Timeout Handling:**
   If a network timeout occurs (`RazorpayTimeoutError`), the attempt is updated to `REQUIRES_RECONCILIATION`:
   ```ts
   await attemptRepo.updateStatus(tx, storeId, attemptId, "REQUIRES_RECONCILIATION", {
     failureCode: "ORDER_CREATION_TIMEOUT",
     failureMessage: error.message,
   });
   ```
3. **Safe Recovery on Retry:**
   Before creating a new order on retry, `ProviderPaymentService` checks `findOrderByReceipt(attemptId)`:
   - If an order with `receipt === attemptId` exists on Razorpay, the provider order was successfully created before the timeout. The existing provider order ID is attached to the attempt, moving status back to `PENDING`.
   - No duplicate order is created.
   - If not found and safe, a new attempt can be initiated cleanly.

---

## 6. INT-05: Authoritative Capture Verification

### Callback and Webhook Audit
1. **Signature Verification:**
   - **Callback:** Frontend HMAC-SHA256 signature is verified over `${razorpayOrderId}|${razorpayPaymentId}` against `keySecret` using `timingSafeEqual`.
   - **Webhook:** Webhook HMAC-SHA256 signature is verified over the exact raw body string against `webhookSecret` using `timingSafeEqual`.
2. **Authoritative Provider Verification:**
   - In the callback flow, client-supplied parameters are never trusted alone.
   - The application fetches the authoritative payment entity from Razorpay: `GET /v1/payments/:id`.
   - Verification checks:
     - `gatewayPayment.status === "captured"`
     - `gatewayPayment.providerOrderId === attemptRow.provider_order_id`
     - `gatewayPayment.amount === attemptRow.amount`
     - `gatewayPayment.currency.toUpperCase() === attemptRow.currency.toUpperCase()`
   - If any verification check fails, payment and attempt are marked `REQUIRES_RECONCILIATION` and flagged for manual audit.
3. **State Monotonicity & Stale Event Protection:**
   - Once a payment is `CAPTURED`, subsequent `payment.failed`, delayed callbacks, or duplicate webhooks are ignored (`status: IGNORED`) and cannot regress the payment to `FAILED` or `PENDING`.

---

## 7. INT-06: Recovery of Abandoned Webhook Events in PROCESSING

### Problem
When multiple webhook deliveries arrive or a worker crashes after claiming an event into `PROCESSING`, naive deduplication acknowledges duplicates as completed, losing business effects permanently.

### Solution: Durable Lease and Recovery Service
1. **Durable Lease Timestamp:**
   When an event is claimed into `PROCESSING`, `processed_at` is set to `NOW()`:
   ```sql
   INSERT INTO payment_webhook_events (
     id, store_id, provider, provider_event_id, event_type,
     signature_verified, payload, status, processed_at
   ) VALUES ($1, $2, 'razorpay', $3, $4, TRUE, $5, 'PROCESSING', NOW())
   ON CONFLICT (provider, provider_event_id) DO NOTHING
   RETURNING *;
   ```
2. **Lease Cutoff & Reclamation:**
   - If a duplicate delivery arrives within the lease window (default 60 seconds), it returns `DUPLICATE` with `"Concurrent processing in progress"`, letting the initial worker finish.
   - If the event remains in `PROCESSING` past the lease window (`Date.now() - processed_at > 60000ms`), the previous worker is deemed crashed. The event is reclaimed with `FOR UPDATE` and reprocessed safely.
3. **`WebhookRecoveryService`:**
   A dedicated recovery worker queries `findAbandonedProcessing(clientOrDb, leaseTimeoutMs, limit)` and safely drives abandoned events to completion or terminal state.
4. **Terminal Deduplication:**
   Events in terminal `PROCESSED` or `IGNORED` are acknowledged immediately as completed duplicates without re-executing business logic.

---

## 8. Captured Payment to Order Creation and Checkout Completion

### Coordination Architecture
Implemented in `PaymentOrderIntegration.completePurchaseWorkflow`:

1. **Prerequisite Check:**
   Payment must be in `CAPTURED` status. Any other status rejects with `InvalidPaymentStateTransitionError`.
2. **Fast-Path Check:**
   If `payment.order_id` is already populated, loads the order and ensures checkout is marked `COMPLETED`. Returns idempotently.
3. **Database Constraint & Concurrent Creation:**
   Checks if an order already exists for `(store_id, checkout_id)`:
   - Uses `orderRepo.findByCheckoutId(client, storeId, checkoutId)`.
   - If already created (e.g. by a racing webhook or callback), links `payment.order_id` and finalizes checkout without calling `createOrderFromCheckout`.
   - If not yet created, calls `OrderService.createOrderFromCheckout(client, storeId, checkoutId)`. PostgreSQL unique constraint `orders_store_checkout_idx` guarantees that even under extreme concurrency, exactly one order row is inserted.
4. **Order Status Update:**
   Updates order payment status to `PAID` via `OrderStatusService.updatePaymentStatus` (`authorizedInternalCall: true`).
5. **Checkout Completion:**
   Invokes `CheckoutService.completeCheckout(client, storeId, checkoutId)`. Checkout transitions from `PAYMENT_PENDING` to `COMPLETED`.
6. **Payment Linkage:**
   Updates `payments.order_id = order.id`.

### Partial Failure Recovery
- **Crash after payment capture, before order creation:**
  `PaymentRecoveryService.recoverOrphanedCapturedPayments` scans for payments where `status = 'CAPTURED' AND order_id IS NULL`. It automatically invokes `completePurchaseWorkflow`, creating the order and finalizing checkout.
- **Crash after order creation, before checkout completion:**
  On retry, `PaymentOrderIntegration` detects the existing order row, skips order creation, finalizes checkout to `COMPLETED`, and links `order_id`.

---

## 9. Integration Debt Register Status

| ID | Issue Description | Status | Evidence |
| --- | --- | --- | --- |
| **INT-01** | Checkout/payment initialization coordination and atomicity | **RESOLVED** | `PaymentCheckoutCoordinator` executes within single `withTransaction` using `SELECT ... FOR UPDATE`. Rollback on error verified in `payment-checkout-integration.test.ts` (8/8 pass). |
| **INT-02** | Orders schema and constraint enforcement | **RESOLVED** | Previously resolved via migration 0008; enforced via `orders_store_checkout_idx`. |
| **INT-03** | Order status lifecycle and authorization gates | **RESOLVED** | Previously resolved via `OrderStatusService`; regression tests in `orders.api.test.ts` (19/19 pass). |
| **INT-04** | Razorpay order-creation timeout and duplicate prevention | **RESOLVED** | `receipt: attemptId` correlation and `findOrderByReceipt` recovery implemented in `ProviderPaymentService`. Verified in `payment-recovery.test.ts` and `provider-payment-service.test.ts`. |
| **INT-05** | Authoritative capture verification | **RESOLVED** | Cryptographic verification, authoritative `GET /payments/:id` lookup outside DB transactions, and monotonic capture rules verified in `provider-payment-service.test.ts` and `payment-checkout-order.workflow.test.ts`. |
| **INT-06** | Recovery of abandoned webhook events in `PROCESSING` | **RESOLVED** | Durable `processed_at` lease, `createIfNotExists`, stale lease reclamation, and `WebhookRecoveryService` verified in `webhook-recovery.test.ts` (4/4 pass). |

---

## 10. Test and Validation Results

### Focused Test Suites Executed

1. **New Integration Tests:**
   ```bash
   pnpm test tests/payments/payment-checkout-integration.test.ts \
             tests/payments/payment-order-integration.test.ts \
             tests/payments/payment-recovery.test.ts \
             tests/payments/webhook-recovery.test.ts \
             tests/integration/payment-checkout-order.workflow.test.ts
   ```
   **Result:** **26/26 PASSED** in 22.04s.

2. **Payments & Webhooks Regression Tests:**
   ```bash
   pnpm test tests/payments/provider-payment-service.test.ts \
             tests/payments/payment-webhook-processor.test.ts
   ```
   **Result:** **26/26 PASSED** in 25.23s.

3. **Orders API Regression Tests:**
   ```bash
   pnpm test tests/orders/orders.api.test.ts
   ```
   **Result:** **19/19 PASSED** in 27.04s.

### Typecheck Results
- `pnpm --filter @calcart/payments typecheck`: **PASSED** (`tsc --noEmit` exited 0).
- `pnpm --filter @calcart/db typecheck`: **PASSED** (`tsc --noEmit` exited 0).

### Lint Results
- `npx eslint "modules/payments/**/*.ts" "packages/db/src/repositories/payment*.ts" "tests/payments/**/*.ts" "tests/integration/payment-checkout-order.workflow.test.ts"`: **PASSED** (0 errors, 0 warnings).

### Diff Check
- `git diff --check`: **PASSED** (0 whitespace/formatting conflicts).

---

## 11. Remaining Limitations and Deferred Workflows

1. **Inventory Restoration on Payment Failure / Cancellation (Deferred):**
   - As specified in the task instructions, automatic stock release upon payment cancellation/failure remains a separate deferred cross-domain workflow.
2. **Automated Refund Trigger on Order Cancellation (Deferred):**
   - Order cancellation does not automatically invoke gateway refund processing. The refund module maintains its own dedicated application services and will be bound via customer service / admin workflows.
3. **Distributed Worker Scheduling:**
   - `PaymentRecoveryService` and `WebhookRecoveryService` are implemented as durable, idempotent services ready to be invoked by cron jobs or background runners in `apps/worker`. Standing background cron daemon configuration is scheduled for the worker deployment phase.
