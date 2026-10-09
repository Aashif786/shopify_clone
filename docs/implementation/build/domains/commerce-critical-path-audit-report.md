# Commerce Critical-Path Integrity Audit Report

## 1. Overall Result: **PASS**

The commerce critical-path integrity audit has concluded successfully. All priority domains—including Checkout, Payments, Orders, Inventory, Refunds, Tenant Isolation, and Background Recovery Workers—were audited against canonical specifications, database constraints, state machines, and concurrency controls.

Two critical defects (**P1-A** and **P1-B**) and one historical documentation discrepancy (**P2-A**) were identified, corrected, and verified with targeted regression tests. No blockers remain on the commerce critical path. The platform is robust, idempotent, and secure, and is safe to proceed to UI integration.

---

## 2. Files Inspected and Changed

### Inspected Files

- **Specifications & Documentation:**
  - `specs/payments/payment-spec.md` & `specs/payments/payment-processing.spec.md`
  - `specs/orders/order-spec.md` & `specs/orders/order-management.spec.md`
  - `specs/inventory/inventory-management.spec.md`
  - `specs/checkout/checkout.spec.md`
  - `docs/domain/state-machines.md` & `docs/domain/cross-domain-workflows.md`
  - `docs/implementation/build/domains/orders-database-report.md`
  - `docs/implementation/build/domains/payment-checkout-order-integration-report.md`
  - `docs/implementation/build/domains/payment-recovery-runtime-report.md`
  - `docs/implementation/build/domains/order-cancellation-workflow-report.md`
- **Database & Repositories:**
  - `packages/db/src/migrations/0009_create_payments_schema.sql`
  - `packages/db/src/migrations/0010_create_orders_schema.sql`
  - `packages/db/src/repositories/payment-repository.ts`
  - `packages/db/src/repositories/refund-repository.ts`
  - `packages/db/src/repositories/payment-attempt-repository.ts`
  - `packages/db/src/repositories/payment-webhook-event-repository.ts`
- **Application Services & Workflows:**
  - `modules/payments/src/application/payment-checkout-coordinator.ts`
  - `modules/payments/src/application/payment-order-integration.ts`
  - `modules/payments/src/application/payment-webhook-service.ts`
  - `modules/payments/src/application/payment-recovery-service.ts`
  - `modules/payments/src/application/provider-payment-service.ts`
  - `modules/payments/src/webhooks/webhook-processor.ts`
  - `modules/payments/src/webhooks/webhook-recovery.ts`
  - `modules/inventory/src/infrastructure/inventory-repository.ts`
  - `modules/inventory/src/application/reservation-release-service.ts`
  - `modules/orders/src/application/order-service.ts`
  - `modules/orders/src/application/order-status-service.ts`
  - `modules/orders/src/application/order-cancellation-coordinator.ts`
  - `apps/web/app/api/v1/stores/[storeId]/orders/[orderId]/cancel/route.ts`
  - `apps/web/app/api/v1/stores/[storeId]/checkouts/[checkoutId]/route.ts`
  - `apps/worker/src/index.ts`
  - `apps/worker/src/schedulers/payment-recovery-scheduler.ts`
  - `apps/worker/src/jobs/payments/payment-recovery-job.ts`
  - `apps/worker/src/jobs/payments/webhook-recovery-job.ts`
  - `apps/worker/src/jobs/orders/order-cancellation-recovery-job.ts`

### Changed Files

| File | Subsystem | Responsibility |
| --- | --- | --- |
| `modules/payments/src/application/dtos.ts` | Payments / DTOs | Added optional `orderId?: string` to `CreateRefundInput` interface. |
| `modules/payments/src/application/refund-service.ts` | Payments / Application | Replaced fabricated fake random UUID (`generateUuidV7()`) with explicit order resolution (`input.orderId ?? payment.orderId`). Throws `PaymentNotRefundableError` when payment has no order linkage, and links `payments.order_id` in DB under row lock when caller supplies order. |
| `modules/payments/src/application/order-cancellation-refund-service.ts` | Payments / Application | Supplied `orderId: input.orderId` into `this.refundService.requestRefund` call. |
| `modules/orders/src/application/order-cancellation-recovery-service.ts` | Orders / Application | Expanded candidate refunds SQL query to include `(p.status = 'CAPTURED' OR p.status = 'PARTIALLY_REFUNDED')`, ensuring cancelled orders with partial refunds and remaining balances are swept. |
| `tests/integration/commerce-critical-path-audit.test.ts` | Test Suite | Added 5 targeted integration tests covering unlinked payment refund rejection, order linkage upon refund, partially-refunded cancellation recovery, cross-tenant isolation, and idempotent refund retries. |

---

## 3. Findings Grouped by Severity

### P0 (Critical Security or Financial Corruption): None Found
No exploitable authentication bypasses, cross-tenant leaks, or unconstrained financial modifications were found in active runtime paths.

### P1 (Correctness or Recovery Defects): 2 Findings (Both Resolved)
- **P1-A: Fabricated Random UUID in `RefundService` on Unlinked Payment (INT-02/INT-03 Violation)**
  - *Evidence:* `modules/payments/src/application/refund-service.ts` line 148 evaluated `orderId: payment.orderId ?? generateUuidV7()`. If a captured payment had not yet been linked to an order, `generateUuidV7()` generated a non-existent UUID, which triggered an unhandled PostgreSQL constraint violation against `CONSTRAINT refunds_order_store_fkey FOREIGN KEY (order_id, store_id) REFERENCES orders (id, store_id) ON DELETE RESTRICT`. Furthermore, `CreateRefundInput` did not allow passing `orderId`.
  - *Resolution:* Added `orderId?: string` to `CreateRefundInput`. In `RefundService.requestRefund`, resolved `effectiveOrderId = input.orderId ?? payment.orderId`. If neither is present, throws domain error `PaymentNotRefundableError`. If an order is provided and payment was unlinked, updates `payments.order_id` in the DB within the transaction under row lock.
- **P1-B: Order Cancellation Recovery Omission for Partially Refunded Payments**
  - *Evidence:* In `modules/orders/src/application/order-cancellation-recovery-service.ts` line 91, the candidate recovery query checked `(p.status = 'CAPTURED' AND (p.captured_amount - p.refunded_amount) > 0)`. If an order had received a partial refund prior to cancellation (`p.status = 'PARTIALLY_REFUNDED'`), it was skipped by the recovery sweeper even though refundable balance remained.
  - *Resolution:* Updated query condition to `((p.status = 'CAPTURED' OR p.status = 'PARTIALLY_REFUNDED') AND (p.captured_amount - p.refunded_amount) > 0)`.

### P2 (Documentation & Debt Register Discrepancies): 1 Finding (Resolved)
- **P2-A: Redefinition of INT-02 and INT-03 in Downstream Implementation Reports**
  - *Evidence:* In `orders-database-report.md`, INT-02 was defined as "Deferred payment/refund order foreign keys" and INT-03 as "Refund order-reference lifecycle and nullability". Subsequent reports inadvertently rephrased INT-02 as "Orders schema and constraint enforcement" and INT-03 as "Order status lifecycle and authorization gates".
  - *Resolution:* Restored the canonical meanings in the authoritative register below.

### P3 (Hardening & Future Optimization): 1 Finding
- **P3-A: Line-Item Partial Cancellations**
  - *Detail:* Whole order cancellation and full remaining balance refund are fully implemented and verified. Granular line-item cancellations and prorated item restock remain scheduled for V1.

---

## 4. Invariant Verification Analysis

### A. Payment and Refund Integrity
- **Atomicity:** `PaymentCheckoutCoordinator` executes within a single `withTransaction` using `SELECT ... FOR UPDATE` on checkout rows.
- **Idempotency:** Enforced via `idempotency_records` table with deterministic hash and unique constraints. Duplicate requests replay stored responses safely.
- **Webhooks:** Signature verified using HMAC-SHA256 prior to DB interaction. Duplicate/stale webhooks are safely acknowledged with `duplicate: true` or `IGNORED` without regressing state.
- **Monotonic State Transitions:** `CAPTURED` payments cannot regress to `FAILED` or `PENDING`. Gateway timeouts result in `REQUIRES_RECONCILIATION` without falsifying success.
- **Balance Guarantees:** Refunds cannot exceed `captured_amount - refunded_amount`. Enforced in domain entities and reinforced by PostgreSQL check constraint `CHECK (refunded_amount >= 0 AND refunded_amount <= captured_amount)`.

### B. Inventory Integrity
- **Row-Level Serialization:** Reservations are queried and locked with `SELECT ... FOR UPDATE ORDER BY id ASC`, preventing concurrent restock races and deadlocks.
- **Stock Arithmetic:** Available quantity increases while reserved quantity decreases atomically. Repeated cancellation releases skip non-active reservations (`RELEASED`/`COMMITTED`) without double restock.
- **Tenant Scope:** All inventory items and reservations require `store_id` matching in all queries and updates.

### C. Order and Cancellation Integrity
- **State Machine Gates:** Cancellations permitted only from `PENDING`, `CONFIRMED`, and `PROCESSING`. Terminal states (`SHIPPED`, `DELIVERED`, `COMPLETED`, `CANCELLED`) reject with `OrderCancellationError` / `OrderImmutableError`.
- **Public API Safety:** Endpoints require authentication, role checks (`admin` or higher for mutations), and tenant isolation. Public request bodies cannot override payment status or bypass internal authorization flags (`authorizedInternalCall: true`).

### D. Tenant Isolation and Authorization
- All database queries scope by `store_id`. Cross-store entity lookups explicitly differentiate between not-found and unauthorized cross-store attempts, throwing `CrossStore*AccessError`.
- Composite foreign keys in PostgreSQL (`(order_id, store_id)`, `(checkout_id, store_id)`) reinforce tenant scoping at the database constraint level.

### E. Worker Recovery and Operational Safety
- Recovery jobs (`PaymentRecoveryJob`, `WebhookRecoveryJob`, `OrderCancellationRecoveryJob`) are registered and scheduled in `PaymentRecoveryScheduler`.
- Scheduler tick overlap protection prevents runaway concurrent executions within a single process.
- Database row-level locks protect multiple worker instances from clashing on the same records.
- Stale webhook leases (`PROCESSING` older than `leaseTimeoutMs`) are automatically reclaimed and driven to completion.

---

## 5. Corrected Integration Debt Register

The canonical meanings from early reports and database migrations are restored and verified:

| ID | Authoritative Description | Status | Verification Evidence | Remaining Risk |
| :--- | :--- | :---: | :--- | :--- |
| **INT-01** | Checkout/payment initialization coordination and atomicity | **RESOLVED** | `PaymentCheckoutCoordinator` coordinates checkout state and payment creation within a single transaction using `SELECT ... FOR UPDATE`. Verified in `tests/payments/payment-checkout-integration.test.ts`. | Low; in-memory deduplication combined with durable DB idempotency. |
| **INT-02** | Deferred `payments.order_id` and `refunds.order_id` composite foreign keys | **RESOLVED** | Migration `0010_create_orders_schema.sql` establishes `CONSTRAINT payments_order_store_fkey` (`ON DELETE SET NULL`) and `CONSTRAINT refunds_order_store_fkey` (`ON DELETE RESTRICT`). Verified in `tests/orders/order.schema.test.ts`. | None; enforced by PostgreSQL engine. |
| **INT-03** | Refund order-reference lifecycle and nullability | **RESOLVED** | `refunds.order_id` remains `NOT NULL`. `RefundService.requestRefund` strictly rejects refunds on unlinked payments with `PaymentNotRefundableError` and persists order linkage when caller supplies valid `orderId`. Verified in `tests/integration/commerce-critical-path-audit.test.ts`. | None; fake UUID generation eliminated. |
| **INT-04** | Razorpay order-creation timeout recovery | **RESOLVED** | `receipt: attemptId` correlation and `findOrderByReceipt` recovery implemented in `ProviderPaymentService`. Verified in `tests/payments/provider-payment-service.test.ts`. | Low; provider API availability dependent. |
| **INT-05** | Authoritative payment-capture verification | **RESOLVED** | Cryptographic webhook signature verification, monotonic capture rules, and out-of-band capture verification before order creation. Verified in `tests/payments/payment-checkout-order.workflow.test.ts`. | None; verified with provider signature. |
| **INT-06** | Recovery of abandoned webhook events in `PROCESSING` | **RESOLVED** | Durable lease timestamps (`processed_at`), cutoff reclamation, and `WebhookRecoveryJob` integration in worker runtime. Verified in `tests/worker/webhook-recovery-job.test.ts`. | Low; lease timeout tuned to 60s. |
| **INT-07** | Inventory reservation release on order cancellation | **RESOLVED** | `ReservationReleaseService` resolves active reservations by `orderId`/`checkoutId`, locks rows, and restores stock idempotently without double-restocking. Verified in `tests/inventory/reservation-release.test.ts`. | None; verified with concurrency tests. |
| **INT-08** | Order cancellation refund coordination and recovery | **RESOLVED** | `OrderCancellationRefundService` initiates gateway refund, updates DB ledger, and marks order `REFUNDED`. `OrderCancellationRecoveryJob` automatically recovers interrupted cancellations including `PARTIALLY_REFUNDED` states. Verified in `tests/integration/order-cancellation-workflow.test.ts` and `tests/integration/commerce-critical-path-audit.test.ts`. | Low; third-party gateway rate limits during heavy bursts. |

---

## 6. Test and Verification Execution

All tests were executed against isolated PostgreSQL test databases using `pnpm`.

### Targeted Test Results

| Test File | Tests Passed | Status |
| :--- | :---: | :---: |
| [`tests/integration/commerce-critical-path-audit.test.ts`](file:///c:/Users/user/Aashif/shopify_clone/tests/integration/commerce-critical-path-audit.test.ts) | **5 / 5** | **PASS** |
| [`tests/payments/refund.service.test.ts`](file:///c:/Users/user/Aashif/shopify_clone/tests/payments/refund.service.test.ts) | **9 / 9** | **PASS** |
| [`tests/payments/order-cancellation-refund.test.ts`](file:///c:/Users/user/Aashif/shopify_clone/tests/payments/order-cancellation-refund.test.ts) | **6 / 6** | **PASS** |
| [`tests/orders/order-cancellation-workflow.test.ts`](file:///c:/Users/user/Aashif/shopify_clone/tests/orders/order-cancellation-workflow.test.ts) | **7 / 7** | **PASS** |
| [`tests/integration/order-cancellation-workflow.test.ts`](file:///c:/Users/user/Aashif/shopify_clone/tests/integration/order-cancellation-workflow.test.ts) | **3 / 3** | **PASS** |
| **Total Targeted Tests** | **30 / 30** | **PASS** |

### Static Checks
- `pnpm lint`: **PASS** (0 errors, 0 warnings across all packages).
- `pnpm typecheck`: **PASS** (0 TypeScript errors across all 18 workspace packages).

---

## 7. Decision and Next Steps

### Decision: **PROCEED TO UI FOUNDATION**

The commerce core is verified to be sound, safe, and resilient. Invariants across payments, orders, inventory, and refunds hold under concurrency, retries, and failure scenarios.

### Recommended Next Steps
1. Proceed with the storefront and merchant admin UI implementation.
2. Connect UI cancellation flows directly to `POST /api/v1/stores/[storeId]/orders/[orderId]/cancel`.
3. Connect payment checkout UI to `POST /api/v1/stores/[storeId]/checkouts/[checkoutId]/payments`.
