# Orders Domain and Application Services Implementation Report

## 1. Overview and Objectives

This report documents the implementation of the **Orders domain model and application services** for Cal Cart (Orders Task 2). The implementation builds directly on the database schema and repository established in Orders Task 1, implementing strict business logic, canonical state machines, robust tenant isolation, concurrency safety, and idempotent checkout-to-order creation.

---

## 2. Files Changed and Responsibilities

| File Path | Layer | Responsibilities |
| :--- | :--- | :--- |
| `modules/orders/src/domain/order-errors.ts` | Domain (Errors) | Canonical domain error taxonomy (`OrderDomainError`, `OrderNotFoundError`, `CrossStoreOrderAccessError`, `InvalidOrderStatusTransitionError`, `InvalidOrderStateError`, `InvalidMonetaryAmountError`, `InvalidCurrencyError`, `InvalidQuantityError`, `InvalidOrderItemError`, `InvalidOrderAddressError`, `OrderCancellationError`, `OrderImmutableError`, `DuplicateOrderError`, `OrderTotalsMismatchError`, `UnauthorizedPaymentStatusChangeError`). |
| `modules/orders/src/domain/order-state.ts` | Domain (State Machine) | Defines statuses and transitions for `OrderStatus`, `OrderPaymentStatus`, and `OrderFulfillmentStatus`. Implements transition validation (`assertValidOrderStatusTransition`), terminal state detection (`isTerminalOrderStatus`), and cancellation eligibility rules (`canCancelOrderStatus`). |
| `modules/orders/src/domain/order-item.ts` | Domain (Entity) | Models purchased line items with immutable purchase-time snapshots (`productNameSnapshot`, `variantNameSnapshot`, `skuSnapshot`). Validates minor unit integers, positive quantities, discount limits, and line total invariants. |
| `modules/orders/src/domain/order.ts` | Domain (Aggregate Root) | Encapsulates order identity, tenancy, financial calculations (`subtotal`, `discountTotal`, `shippingTotal`, `taxTotal`, `total`, `grandTotal`), lifecycle transitions (`confirm`, `startProcessing`, `markShipped`, `markDelivered`, `complete`, `cancel`), snapshots, and addresses. |
| `modules/orders/src/dto/order-dto.ts` | Presentation / DTO | Defines data transfer objects (`OrderDTO`, `OrderItemDTO`, `OrderAddressDTO`, `OrderStatusHistoryDTO`) and deterministic serialization mappers. |
| `modules/orders/src/application/dtos.ts` | Application (DTOs) | Defines command inputs and trusted checkout contract (`TrustedCheckoutData`, `CreateOrderFromCheckoutInput`, `TransitionOrderStatusInput`, `CancelOrderInput`, `UpdateOrderPaymentStatusInput`, `UpdateOrderFulfillmentStatusInput`). |
| `modules/orders/src/application/order-service.ts` | Application (Service) | Orchestrates idempotent order creation from trusted checkout data. Recalculates all line totals and aggregate totals server-side, generates store-scoped order numbers, manages transactional insertion across 4 tables, and safely handles concurrent checkout order creation via `orders_store_checkout_idx` conflict recovery. |
| `modules/orders/src/application/order-status-service.ts` | Application (Service) | Coordinates order lifecycle status transitions, cancellation, payment status updates, and fulfillment status updates using pessimistic row locking (`findByIdForUpdate`), state machine enforcement, and atomic status history auditing. |
| `modules/orders/src/index.ts` | Module Public API | Re-exports domain entities, state machine helpers, error classes, DTOs, and application services. |
| `tests/orders/order.domain.test.ts` | Test (Domain) | Unit test suite (23 tests) verifying invariants, monetary minor units, snapshot immutability, valid/invalid transitions, cancellation limits, and terminal state immutability. |
| `tests/orders/order.service.test.ts` | Test (Integration) | PostgreSQL integration suite (8 tests) covering transactional creation, authoritative calculations (distrusting client totals), idempotent retries, concurrent creation resolution, rollback atomicity, and store isolation. |
| `tests/orders/order-status.service.test.ts` | Test (Integration) | PostgreSQL integration suite (8 tests) covering row-locked transitions, audit logging, invalid transition rejection, cancellation limits, cross-store protection, and payment status authorization guards. |

---

## 3. Domain Invariants and State-Transition Rules

### 3.1 Separation of Concerns across Lifecycle, Payment, and Fulfillment

As resolved between `specs/orders/order-spec.md`, `specs/orders/order-implementation.md`, `docs/domain/state-machines.md`, and the database schema (`packages/db/src/schema/orders.ts`):
1. **Order Lifecycle (`status`)**:
   - States: `PENDING` → `CONFIRMED` → `PROCESSING` → `SHIPPED` → `DELIVERED` → `COMPLETED`, with `CANCELLED` permitted from `PENDING`, `CONFIRMED`, or `PROCESSING`.
   - `CANCELLED` and `COMPLETED` are terminal states; no further transitions are permitted.
2. **Financial Status (`payment_status`)**:
   - States: `PENDING`, `AUTHORIZED`, `PAID`, `PARTIALLY_REFUNDED`, `REFUNDED`, `FAILED`.
   - Owned authoritatively by the Payments domain. Direct updates to `payment_status` without an authorized internal integration pathway (`authorizedInternalCall: true`) are explicitly rejected with `UnauthorizedPaymentStatusChangeError`.
3. **Fulfillment Status (`fulfillment_status`)**:
   - States: `UNFULFILLED`, `PARTIALLY_FULFILLED`, `FULFILLED`, `CANCELLED`.
   - Updated as physical fulfillment milestones occur (e.g. automatically set to `FULFILLED` upon shipping, or `CANCELLED` upon order cancellation).

### 3.2 Canonical State Transitions

```text
PENDING
   ├── confirm ───────► CONFIRMED
   └── cancel ────────► CANCELLED

CONFIRMED
   ├── process ───────► PROCESSING
   └── cancel ────────► CANCELLED

PROCESSING
   ├── ship ──────────► SHIPPED (fulfillmentStatus -> FULFILLED)
   └── cancel ────────► CANCELLED (exceptional pre-dispatch)

SHIPPED
   └── deliver ───────► DELIVERED

DELIVERED
   └── complete ──────► COMPLETED (terminal, completedAt recorded)
```

- **Cancellation Rules**: Cancellation is only valid from `PENDING`, `CONFIRMED`, and `PROCESSING`. Attempting to cancel an order once `SHIPPED`, `DELIVERED`, or `COMPLETED` is rejected with `OrderCancellationError`.
- **Terminal Immutability**: Any status transition attempted from `CANCELLED` or `COMPLETED` throws `OrderImmutableError`.
- **Idempotent Transitions**: Requesting a transition to the order's existing status is treated as an idempotent no-op, returning the current order state without generating spurious audit history.

### 3.3 Monetary and Snapshot Invariants

- **Exact Integer Minor Units**: All monetary values are strictly validated as non-negative safe integers in minor units (e.g., cents, paise). Fractional or floating-point amounts, `NaN`, negative values, or values exceeding `1_000_000_000_000` (1 trillion minor units) are rejected.
- **Snapshot Immutability**: Order items permanently store `productNameSnapshot`, `variantNameSnapshot`, and `skuSnapshot`. Historical purchases remain completely detached from future catalog modifications.
- **Authoritative Server Recalculation**: Client-supplied subtotals, item totals, or grand totals are never trusted. Line totals are recalculated as `(quantity * unitPrice) - discountAmount + taxAmount`. The order subtotal is computed as the sum of line items, and the order grand total is computed as `subtotal - discountTotal + shippingTotal + taxTotal`. Mismatches throw explicit domain errors.

---

## 4. Order Creation Transaction Boundaries

Order creation occurs entirely inside a PostgreSQL transaction (`withTransaction` / `withExclusiveConnection`):
1. **Pessimistic / Idempotent Pre-Check**: Checks if an order already exists for `(store_id, checkout_id)`. If present, returns the hydrated order immediately.
2. **Order Aggregate Insert**: Inserts the `orders` row with authoritatively computed financials, currency, store tenancy, and initial status `PENDING`.
3. **Order Items Insert**: Sequentially inserts each `order_items` record with immutable snapshots and validated minor unit line totals.
4. **Order Addresses Insert**: Inserts billing and shipping address snapshots into `order_addresses`.
5. **Order Status History Insert**: Inserts the initial `order_status_history` record (`from_status = NULL`, `to_status = PENDING`, `actor_type = 'SYSTEM'`).
6. **Commit**: All four tables commit atomically. If any step fails (e.g. database error, constraint violation), the entire transaction rolls back cleanly, leaving zero orphaned items or partial status records.

---

## 5. Trusted Checkout Boundary & Idempotency

### 5.1 The Trusted Checkout Interface

To prevent circular module dependencies between `@calcart/orders` and `@calcart/checkout`, the Orders domain specifies a narrow application contract `TrustedCheckoutData` in `modules/orders/src/application/dtos.ts`.
- Validates that `checkout.storeId === storeId`.
- Discards any client-forged pricing or total assertions.
- Requires at least one line item and valid currency code.

### 5.2 Concurrency Safety and Unique Constraint Recovery

- Database level: The unique index `orders_store_checkout_idx` on `(store_id, checkout_id) WHERE checkout_id IS NOT NULL` serves as the authoritative concurrency barrier.
- Application level: If two concurrent requests attempt to create an order for the same checkout:
  - Both may pass the initial application-level check.
  - The first transaction commits and creates the order.
  - The second transaction triggers a PostgreSQL unique violation (`error.code === '23505'`) on constraint `orders_store_checkout_idx`.
  - `OrderService` catches the conflict, rolls back the failed transaction, issues a fresh query to `findByCheckoutId`, hydrates the committed order with its items, addresses, and history, and safely returns it.
  - Duplicate orders are mathematically prevented, and both concurrent callers receive the identical order result.

---

## 6. Order Status-History Consistency

`OrderStatusService` ensures that status modifications cannot be separated from their audit trail:
- **Pessimistic Concurrency**: Queries the order with `SELECT ... FOR UPDATE` via `findByIdForUpdate` to lock the order row. This serializes concurrent transition requests and eliminates lost updates or conflicting state divergence.
- **Cross-Store Protection**: Scopes all queries strictly by `store_id`. If an order ID belongs to a different store, the service detects the foreign ownership and raises `CrossStoreOrderAccessError`, preventing information leakage or cross-tenant modification.
- **Atomic History Recording**: The order table update and `order_status_history` insertion happen in the same transaction. The history records `from_status`, `to_status`, `actor_type` (`CUSTOMER`, `MERCHANT`, `SYSTEM`), `actor_id` (UUID), `reason`, and timestamp.
- **Connection Pipeline Safety**: Sequential asynchronous execution for relationship hydration (`order_items`, `order_addresses`, `order_status_history`) avoids connection pipeline saturation or deprecated nested query warnings on dedicated connection pools.

---

## 7. Verification & Test Execution Results

All focused test suites were executed with exact results:

### 7.1 Orders Test Suites

```text
pnpm test tests/orders/order.domain.test.ts tests/orders/order.service.test.ts tests/orders/order-status.service.test.ts

 ✓ tests/orders/order.domain.test.ts (23 tests) 21ms
 ✓ tests/orders/order.service.test.ts (8 tests) 14651ms
 ✓ tests/orders/order-status.service.test.ts (8 tests) 14647ms

Test Files  3 passed (3)
Tests       39 passed (39)
Duration    15.81s
```

### 7.2 Schema & Payments Regression Suites

```text
pnpm test tests/orders/order.schema.test.ts tests/payments/payment.schema.test.ts tests/payments/refund.service.test.ts

 ✓ tests/orders/order.schema.test.ts (20 tests) 17400ms
 ✓ tests/payments/payment.schema.test.ts (28 tests) 46498ms
 ✓ tests/payments/refund.service.test.ts (9 tests) 15200ms

Test Files  3 passed (3)
Tests       57 passed (57)
Duration    47.40s
```

### 7.3 Typecheck, Lint, and Diff Results

- **Workspace Typecheck (`pnpm -r run typecheck`)**: PASSED (16 of 16 workspace projects passed `tsc --noEmit`).
- **Targeted ESLint (`npx eslint modules/orders tests/orders`)**: PASSED (0 errors, 0 warnings).
- **Git Diff Check (`git diff --check`)**: PASSED (0 whitespace or syntax errors).

---

## 8. Integration Debt Register Status

Per task instructions, the cross-domain integration debt items remain tracked and preserved for future end-to-end integration tasks:

- **INT-01: Checkout/payment atomicity**: Pending coordination between checkout transition to `PAYMENT_PENDING` and payment creation.
- **INT-04: Razorpay order-creation timeout**: Pending upstream payment provider retries and recovery.
- **INT-05: Authoritative capture verification**: Pending verification of payment amount, currency, and provider-order reference before accepting capture.
- **INT-06: Stale webhook recovery**: Pending recovery of abandoned `PROCESSING` webhook events.

None of these items have been marked resolved prematurely in this task.

---

## 9. Known Limitations and Future Work

1. **Carrier & Fulfillment Orchestration**: This task covers aggregate fulfillment status updates (`UNFULFILLED` → `PARTIALLY_FULFILLED` → `FULFILLED`) and shipment lifecycle transitions. Advanced tracking number carrier callbacks, partial item fulfillment routing, and warehouse management are deferred to post-demo.
2. **Cross-Domain Orchestration**: The actual invocation of `OrderService.createOrderFromCheckout` upon Razorpay capture webhook receipt or checkout completion workflow belongs to the upcoming Checkout-Payment-Order integration task.
