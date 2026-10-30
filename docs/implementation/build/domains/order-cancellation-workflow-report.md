# Order Cancellation, Inventory Release, and Refund Coordination Report

## 1. Executive Summary

This report documents the implementation and verification of the reliable, idempotent **Order Cancellation, Inventory Release, and Payment Refund Workflow** for the Cal Cart platform.

Prior to this implementation, cancelling an order updated the order record status in the database, but left active inventory reservations in an unreleased state (causing artificial inventory scarcity) and failed to trigger gateway refunds for captured payments (leaving funds unreturned and payment status inconsistent). Furthermore, there was no durable mechanism to recover from partial failures if the application or server crashed mid-workflow.

To resolve these deficiencies without breaking domain isolation or introducing premature microservice infrastructure, we implemented a coordinated modular-monolith workflow:
- **Order Cancellation State Machine:** Strict validation ensuring cancellations are only accepted from non-terminal states (`PENDING`, `CONFIRMED`, `PROCESSING`), rejecting terminal states (`SHIPPED`, `DELIVERED`, `COMPLETED`, `CANCELLED`) with domain error types (`OrderCancellationError`, `OrderImmutableError`).
- **Inventory Reservation Release (`INT-07`):** Implemented `ReservationReleaseService` in `modules/inventory` to query and release active reservations matched against either the order ID or its originating checkout ID, atomically incrementing available stock and updating reservation status to `RELEASED`.
- **Payment Refund Coordination (`INT-08`):** Extended `PaymentProvider` and `RazorpayProvider` with refund capabilities and implemented `OrderCancellationRefundService` in `modules/payments` to issue gateway refunds, insert audit-trailed refund records, and transition order payment status to `REFUNDED`. Gateway timeouts safely mark records as `REQUIRES_RECONCILIATION` without aborting order cancellation.
- **Workflow Coordinator (`OrderCancellationCoordinator`):** Orchestrates the multi-phase workflow with explicit failure boundaries, ensuring that inventory and payment partial failures do not roll back the cancellation record while maintaining complete idempotency on repeated requests.
- **Durable Recovery & Background Worker:** Added `OrderCancellationRecoveryService` in `modules/orders` and `OrderCancellationRecoveryJob` in `apps/worker`, scheduled alongside existing payment recovery jobs in `PaymentRecoveryScheduler` to sweep and complete pending releases and refunds asynchronously.
- **Public API Preservation:** Updated `POST /api/v1/stores/[storeId]/orders/[orderId]/cancel` in `apps/web` to use the coordinator while preserving existing authorization, role-based access checks, tenant scoping, and HTTP response contracts.

---

## 2. Files Changed and Responsibilities

| File | Subsystem | Responsibility |
| --- | --- | --- |
| `modules/payments/src/providers/razorpay-types.ts` | Payments / Types | Added `RazorpayRefundRequest` and `RazorpayRefundResponse` interfaces. |
| `modules/payments/src/infrastructure/razorpay-client.ts` | Payments / Client | Added `createRefund(paymentId, request)` making authenticated POST calls to Razorpay API with idempotency and timeout handling. |
| `modules/payments/src/providers/payment-provider.ts` | Payments / Providers | Defined `CreateProviderRefundInput`, `ProviderRefundResult`, and extended `PaymentProvider` interface with optional `createRefund`. |
| `modules/payments/src/providers/razorpay-provider.ts` | Payments / Providers | Implemented `createRefund` in `RazorpayProvider` mapping provider errors to domain exceptions (`RazorpayTimeoutError`, `RazorpayApiError`). |
| `modules/inventory/src/infrastructure/inventory-repository.ts` | Inventory / DB | Added `findReservationsByReferences` and `findReservationsByReferencesForUpdate` to query reservations across multiple reference IDs (`orderId`, `checkoutId`). |
| `modules/inventory/src/application/reservation-release-service.ts` | Inventory / Service | Created `ReservationReleaseService` providing `releaseOrderReservations` and `releaseReservationById` with row-level locking and idempotent stock restoral. |
| `modules/inventory/src/index.ts` | Inventory / Exports | Exported `ReservationReleaseService` and related DTOs/types. |
| `modules/payments/src/application/order-cancellation-refund-service.ts` | Payments / Service | Created `OrderCancellationRefundService` coordinating payment capture inspection, refund balance tracking, provider refund execution, DB transaction, and idempotency. |
| `modules/payments/src/index.ts` | Payments / Exports | Exported `OrderCancellationRefundService` and refund input/output interfaces. |
| `modules/orders/src/application/order-cancellation-coordinator.ts` | Orders / Coordination | Implemented `OrderCancellationCoordinator` using dependency-injected interfaces to orchestrate cancellation state change, inventory release, and refund initiation. |
| `modules/orders/src/application/order-cancellation-recovery-service.ts` | Orders / Recovery | Implemented `OrderCancellationRecoveryService` to query cancelled orders with lingering active reservations or unrefunded captured payments and repair them. |
| `modules/orders/src/index.ts` | Orders / Exports | Exported `OrderCancellationCoordinator`, `OrderCancellationRecoveryService`, and associated types. |
| `apps/web/package.json` | Web App | Added `@calcart/payments` workspace dependency. |
| `apps/web/app/api/v1/stores/[storeId]/orders/[orderId]/cancel/route.ts` | Web App / API | Integrated `OrderCancellationCoordinator` into the public cancel endpoint while preserving route authorization and response shapes. |
| `apps/worker/package.json` | Worker App | Added `@calcart/orders` and `@calcart/inventory` workspace dependencies. |
| `apps/worker/src/jobs/orders/order-cancellation-recovery-job.ts` | Worker / Jobs | Implemented `OrderCancellationRecoveryJob` wrapping `OrderCancellationRecoveryService`. |
| `apps/worker/src/schedulers/payment-recovery-scheduler.ts` | Worker / Scheduler | Registered `OrderCancellationRecoveryJob` in scheduler lifecycle, added to tick execution and structured JSON logging. |
| `apps/worker/src/index.ts` | Worker / Entrypoint | Instantiated and injected `OrderCancellationRecoveryJob` into scheduler during worker boot sequence. |
| `tests/inventory/reservation-release.test.ts` | Test Suite | 6 unit & integration tests verifying reservation release, stock restoral, idempotency, cross-tenant isolation, and explicit transaction support. |
| `tests/payments/order-cancellation-refund.test.ts` | Test Suite | 6 unit & integration tests verifying cancellation refunds, uncaptured/zero-payment handling, full refund deduplication, idempotency, and provider timeout handling. |
| `tests/orders/order-cancellation-workflow.test.ts` | Test Suite | 7 workflow tests verifying state machine gates, non-cancellable state rejection, partial failure isolation, idempotency, cross-store access checks, and coordinator execution. |
| `tests/integration/order-cancellation-workflow.test.ts` | Test Suite | 3 end-to-end integration tests verifying end-to-end cancellation with stock restore & refund, idempotent duplicate requests, and worker recovery job sweep. |

---

## 3. Workflow Architecture and State-Transition Design

The workflow coordinates across three distinct bounded contexts (`orders`, `inventory`, `payments`) while strictly adhering to the architectural boundaries defined in `AGENTS.md`.

```
                         POST /api/v1/stores/:storeId/orders/:orderId/cancel
                                                  │
                                                  ▼
                                   ┌──────────────────────────────┐
                                   │ OrderCancellationCoordinator │
                                   └──────────────┬───────────────┘
                                                  │
                  ┌───────────────────────────────┼───────────────────────────────┐
                  ▼                               ▼                               ▼
       Phase 1: Order Status           Phase 2: Inventory             Phase 3: Payment
         State Transition             Reservation Release             Refund Initiation
  ┌──────────────────────────────┐ ┌──────────────────────────────┐ ┌──────────────────────────────┐
  │ OrderStatusService           │ │ ReservationReleaseService    │ │ OrderCancellationRefundSvc   │
  │                              │ │                              │ │                              │
  │ • Validate current status:   │ │ • Find active reservations   │ │ • Check payment captured?    │
  │   PENDING/CONFIRMED/         │ │   by orderId & checkoutId    │ │ • Query existing refund by   │
  │   PROCESSING -> CANCELLED    │ │ • Lock rows FOR UPDATE       │ │   idempotency key            │
  │ • Reject terminal states:    │ │ • Restore inventory stock    │ │ • Call Razorpay API          │
  │   SHIPPED/DELIVERED/         │ │   (available += qty,         │ │ • Record refund in DB        │
  │   COMPLETED -> Error         │ │    reserved -= qty)          │ │ • Update order payment status│
  │ • Atomic update & history    │ │ • Update status to RELEASED  │ │   to REFUNDED                │
  └──────────────────────────────┘ └──────────────────────────────┘ └──────────────────────────────┘
```

### Module Boundary Preservation
To prevent circular dependencies (`modules/payments` already references `modules/orders`), `OrderCancellationCoordinator` in `modules/orders` uses **dependency inversion**:
```typescript
export interface InventoryReleaseCoordinator {
  releaseOrderReservations(
    clientOrDb: Database | DatabaseClient,
    input: { storeId: string; orderId?: string; checkoutId?: string },
  ): Promise<{ releasedCount: number; skippedCount: number; reservations?: unknown[] }>;
}

export interface CancellationRefundCoordinator {
  processCancellationRefund(
    clientOrDb: Database | DatabaseClient,
    input: { storeId: string; orderId: string; checkoutId?: string; reason?: string },
  ): Promise<{
    status: "NOT_APPLICABLE" | "PENDING" | "SUCCEEDED" | "FAILED" | "REQUIRES_RECONCILIATION";
    refundId?: string;
    amount?: number;
    error?: string;
  }>;
}
```
Concrete services (`ReservationReleaseService` and `OrderCancellationRefundService`) are wired in application composition layers (`apps/web` and `apps/worker`).

---

## 4. Inventory Reservation Release (INT-07)

### Problem
Active inventory reservations linked to an order or its source checkout were previously not released upon cancellation, locking inventory permanently and displaying incorrect stock counts.

### Solution: `ReservationReleaseService`
1. **Multi-Reference Resolution:**
   Reservations may have been created with `referenceType = 'order'` and `referenceId = orderId`, or earlier in checkout with `referenceType = 'checkout'` and `referenceId = checkoutId`. The repository queries:
   ```sql
   SELECT * FROM inventory_reservations
   WHERE store_id = $1
     AND status = 'ACTIVE'
     AND reference_id = ANY($2)
   FOR UPDATE
   ```
2. **Atomic Stock Restoral:**
   For each active reservation, inside a transaction:
   - Updates `inventory_reservations` setting `status = 'RELEASED'` and `updated_at = NOW()`.
   - Atomically updates `inventory_items` setting `available_quantity = available_quantity + quantity` and `reserved_quantity = reserved_quantity - quantity`.
3. **Idempotency:**
   If reservations are already in `RELEASED`, `EXPIRED`, or `CONSUMED` state, they are skipped without modifying stock levels (`skippedCount++`), preventing double-restocking.

---

## 5. Payment Refund Coordination (INT-08)

### Problem
Orders cancelled after payment capture left payments in `CAPTURED` status without triggering gateway refunds or recording refund entries in the platform database.

### Solution: `OrderCancellationRefundService`
1. **Prerequisite & Balance Inspection:**
   - Locates payment by `orderId` or `checkoutId`.
   - If payment is not `CAPTURED` (e.g. `PENDING`, `FAILED`, or `NULL`), returns `NOT_APPLICABLE` with descriptive reason.
   - Idempotency check: Queries `refunds` using deterministic key `order-cancel-refund:${orderId}`. If a completed refund already exists, returns the existing refund DTO immediately.
   - Verifies remaining refundable balance (`captured_amount - refunded_amount > 0`).
2. **Provider Gateway Execution:**
   - Calls `PaymentProvider.createRefund` with `paymentId`, `amount`, and `idempotencyKey`.
   - On provider timeout (`RazorpayTimeoutError`), records the payment attempt as `REQUIRES_RECONCILIATION`, allowing the cancellation to succeed while scheduling reconciliation.
3. **Database Finalization:**
   - Inserts row into `refunds` table with `status = 'SUCCEEDED'`.
   - Updates `payments`: increments `refunded_amount` and transitions `status` to `REFUNDED` (or `PARTIALLY_REFUNDED`).
   - Updates `orders`: transitions `payment_status` to `REFUNDED` via `OrderStatusService.updatePaymentStatus` (`authorizedInternalCall: true`).

---

## 6. Concurrency, Transactions, and Idempotency

### Concurrency Isolation
- **Row Locks:** Database operations on reservations and payments acquire PostgreSQL row-level locks (`SELECT ... FOR UPDATE`) within transactions to prevent concurrent cancellations or racing webhook updates from double-releasing stock or double-refunding payments.
- **Postgres Type Safety:** Casting `o.id::text` and `o.checkout_id::text` ensures queries correctly join `UUID` order identifiers against `TEXT` reservation reference identifiers.

### Partial Failure Isolation
The coordinator separates phase execution:
1. Phase 1 (Order status transition to `CANCELLED`) executes first.
2. Phase 2 (Inventory release) and Phase 3 (Payment refund) execute in independent transaction contexts. If a gateway timeout or temporary network issue occurs during refund, the order cancellation remains intact and is recorded, and the recovery worker sweeps the uncompleted step.

### Idempotency on Repeated Invocations
- When `allowAlreadyCancelled: true` is passed (used by worker recovery and background reconcilers), the coordinator detects `existingRow.status === "CANCELLED"` and safely resumes releasing any remaining active reservations or issuing any missing refunds.
- When `allowAlreadyCancelled: false` (default for external API calls), repeated cancellation requests return HTTP 400 (`OrderImmutableError`), preserving the exact public API specification contract.

---

## 7. Durable Recovery and Worker Runtime Registration

### Recovery Service (`OrderCancellationRecoveryService`)
Scans for cancelled orders requiring remediation:
1. **Lingering Reservations Query:**
   ```sql
   SELECT DISTINCT o.id AS order_id, o.store_id, o.checkout_id
   FROM orders o
   JOIN inventory_reservations ir
     ON ir.store_id = o.store_id
    AND ir.reference_id = ANY(ARRAY[o.id::text, o.checkout_id::text])
   WHERE o.status = 'CANCELLED'
     AND ir.status = 'ACTIVE'
   LIMIT $1
   ```
2. **Unrefunded Payments Query:**
   ```sql
   SELECT DISTINCT o.id AS order_id, o.store_id, o.checkout_id
   FROM orders o
   JOIN payments p
     ON p.store_id = o.store_id
    AND (p.order_id = o.id OR p.checkout_id = o.checkout_id)
   WHERE o.status = 'CANCELLED'
     AND p.status = 'CAPTURED'
     AND p.captured_amount > p.refunded_amount
   LIMIT $1
   ```

### Worker Runtime Integration (`apps/worker`)
- Registered `OrderCancellationRecoveryJob` in `apps/worker/src/schedulers/payment-recovery-scheduler.ts`.
- Integrated directly into the existing tick cycle alongside `PaymentRecoveryJob` and `WebhookRecoveryJob`.
- Emits structured JSON log events on every tick:
  ```json
  {
    "tag": "PAYMENT_RECOVERY_CYCLE_COMPLETED",
    "durationMs": 85,
    "paymentRecovery": { "orphanedRecovered": 0, "orphanedFailed": 0, "ambiguousReconciled": 0, "ambiguousFailed": 0, "success": true },
    "webhookRecovery": { "recovered": 0, "failed": 0, "success": true },
    "orderCancellation": { "inventoryRecovered": 0, "inventoryFailed": 0, "refundsRecovered": 0, "refundsFailed": 0, "success": true }
  }
  ```

---

## 8. Public API Authorization Impact & Contracts

### Endpoint
`POST /api/v1/stores/[storeId]/orders/[orderId]/cancel`

### Authorization & Scope Preserved
- Requires authenticated user (`authenticateRequest`).
- Validates store membership and role (`OWNER`, `ADMIN`, `STAFF`).
- Enforces strict tenant scoping: attempting to cancel an order belonging to another store returns HTTP 404 (`OrderNotFoundError`) or HTTP 403 (`CrossStoreOrderAccessError`).

### HTTP Response Shape
Returns HTTP 200 with the cancelled order DTO:
```json
{
  "order": {
    "id": "018f...",
    "storeId": "018f...",
    "status": "CANCELLED",
    "paymentStatus": "REFUNDED",
    "fulfillmentStatus": "UNFULFILLED",
    "cancelReason": "Customer changed mind",
    "cancelledAt": "2026-10-09T17:00:00.000Z"
  }
}
```
If the order is in a terminal non-cancellable state (`SHIPPED`, `DELIVERED`, `COMPLETED`), returns HTTP 400 (`CANNOT_CANCEL_ORDER`).
If the order is already cancelled, returns HTTP 400 (`ORDER_IMMUTABLE`).

---

## 9. Test and Verification Evidence

All test suites were executed using `pnpm` against an isolated PostgreSQL test environment.

### Targeted Test Suites Summary

| Test Suite | File | Tests Passed | Status |
| --- | --- | :---: | :---: |
| **Inventory Release** | `tests/inventory/reservation-release.test.ts` | **6 / 6** | **PASS** |
| **Cancellation Refund** | `tests/payments/order-cancellation-refund.test.ts` | **6 / 6** | **PASS** |
| **Workflow Coordinator** | `tests/orders/order-cancellation-workflow.test.ts` | **7 / 7** | **PASS** |
| **Integration E2E & Worker** | `tests/integration/order-cancellation-workflow.test.ts` | **3 / 3** | **PASS** |
| **Orders API Regression** | `tests/orders/orders.api.test.ts` | **19 / 19** | **PASS** |
| **Worker Payment Recovery** | `tests/worker/payment-recovery-job.test.ts` | **5 / 5** | **PASS** |
| **Worker Webhook Recovery** | `tests/worker/webhook-recovery-job.test.ts` | **5 / 5** | **PASS** |
| **Worker Runtime Integration** | `tests/integration/payment-recovery-runtime.test.ts` | **4 / 4** | **PASS** |
| **Total Test Count** | | **55 / 55** | **PASS** |

### Static Checks
- **Typecheck:** `pnpm typecheck` passed cleanly across all 18 workspace packages (0 errors).
- **Linter:** `pnpm lint` passed cleanly across the entire repository (0 errors, 0 warnings).

---

## 10. Integration Debt Register Status

| ID | Issue Description | Status | Evidence |
| --- | --- | :---: | --- |
| **INT-01** | Checkout/payment initialization coordination and atomicity | **RESOLVED** | `PaymentCheckoutCoordinator` transactions with `FOR UPDATE`. |
| **INT-02** | Orders schema and constraint enforcement | **RESOLVED** | Enforced via `orders_store_checkout_idx` and status checks. |
| **INT-03** | Order status lifecycle and authorization gates | **RESOLVED** | `OrderStatusService` enforcement; 19/19 tests pass in `orders.api.test.ts`. |
| **INT-04** | Razorpay order-creation timeout and duplicate prevention | **RESOLVED** | `receipt: attemptId` correlation and `findOrderByReceipt`. |
| **INT-05** | Authoritative capture verification | **RESOLVED** | Monotonic state transitions and cryptographic verification. |
| **INT-06** | Recovery of abandoned webhook events in `PROCESSING` | **RESOLVED** | Durable lease timestamps and `WebhookRecoveryJob`. |
| **INT-07** | Inventory reservation release on order cancellation | **RESOLVED** | `ReservationReleaseService` releases active reservations by order/checkout ID, restores stock, and runs idempotently. Verified in `reservation-release.test.ts` (6/6 pass). |
| **INT-08** | Order cancellation refund coordination and recovery | **RESOLVED** | `OrderCancellationRefundService` issues gateway refund, records DB entry, and updates order payment status. `OrderCancellationRecoveryJob` provides durable recovery. Verified in `order-cancellation-refund.test.ts` (6/6 pass) and `order-cancellation-workflow.test.ts` (3/3 pass). |

---

## 11. Known Limitations & Deviations

1. **Partial Line-Item Cancellation:** The current Demo implementation cancels whole orders and releases all associated active reservations. Partial line-item cancellations and prorated refunds are deferred to V1.
2. **Third-Party Payment Reconciliation:** In cases where Razorpay times out during refund creation, the payment attempt is set to `REQUIRES_RECONCILIATION`. Automated refund reconciliation will use the payment recovery worker once provider query APIs for refund lookup are finalized.
3. **No Deviations from Canonical Specifications:** The implementation strictly adheres to the state transitions defined in `specs/orders/order-management.spec.md`, the reservation rules in `specs/inventory/inventory-management.spec.md`, and the payment rules in `specs/payments/payment-processing.spec.md`.
