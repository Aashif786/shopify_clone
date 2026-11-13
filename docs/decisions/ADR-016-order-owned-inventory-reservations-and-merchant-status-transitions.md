# ADR-016: Order-Owned Inventory Reservations and Merchant Status Transitions

- **Status**: Accepted
- **Date**: 2026-11-05
- **Context**: COD / dispatch / shipping, Phase 0 (order lifecycle and inventory foundations)
- **Related**: [ADR-006](./ADR-006-idempotency-strategy.md),
  [ADR-009](./ADR-009-payment-refund-and-capture-integrity.md),
  [ADR-014](./ADR-014-returns-refund-ordering-and-ownership.md)

---

## Context

An audit of the order, payment and inventory flow found two defects that sit
underneath every later shipping and COD feature.

**1. Stock reserved for a paid order could be returned to sale.**
Stock is reserved when payment starts, with a 15-minute `expires_at`. When a
payment is captured, `completePurchaseWorkflow` re-points those reservations from
the checkout to the new order (`reference_type = 'order'`) but leaves them
`ACTIVE` with the original `expires_at`. The worker's expiry sweep selected every
`ACTIVE` reservation past `expires_at` regardless of `reference_type`, so a paid
order's stock was released back to availability about 15 minutes after capture.
Nothing in the payment or order flow ever committed a reservation either:
`finalizeReservation` was reachable only from two merchant inventory routes. A
cash-on-delivery order, which lives for days before dispatch, could not work on
top of this.

**2. Orders could not be moved through their lifecycle.**
`OrderStatusService.transitionStatus` had no caller outside tests. The only
order mutations reachable from the product were `fulfill` and `cancel`. Orders
were created `PENDING` and nothing confirmed, processed, delivered or completed
them. Fulfilling a `PENDING` order recorded `fulfillment_status = FULFILLED`
while `status` stayed `PENDING`, and because `updateFulfillmentStatus` returns
early when the fulfillment status is unchanged, such an order could never be
moved to `SHIPPED` through `fulfill` afterwards.

---

## Decision 1: A reservation owned by an order never expires

The expiry TTL exists to free stock when a *checkout* is abandoned. Once a
reservation belongs to an order, that reason no longer applies.

- Both expiry queries (`findExpiredActiveReservationIds`,
  `findExpiredActiveReservations`) exclude `reference_type = 'order'`.
- The locked re-check inside `expireReservations` and
  `expireAllExpiredReservations` skips a reservation that is now order-owned. This
  closes the race where the sweep selected a checkout reservation just before a
  capture re-pointed it.
- An order reservation ends in exactly one of two ways: **released** by the
  cancellation workflow (stock returns to available), or **committed** when the
  order's goods leave (stock is consumed).

**Alternative rejected: extend `expires_at` when re-pointing.** It would still
expire eventually, so every long-lived order would need a renewal job, and a
missed renewal would silently oversell. A rule keyed on ownership has no clock to
get wrong.

**Alternative rejected: commit at capture.** Cancelling a paid order before
dispatch would then have to *restock* committed stock, which needs a new
adjustment path and a reason code. Committing at dispatch keeps cancellation a
plain release, and matches `state-machines.md` §13: commit when the workflow
reaches the point where reserved stock should become consumed.

## Decision 2: Stock is committed when an order becomes FULFILLED

`ReservationReleaseService.commitOrderReservations` consumes the reserved counter
for an order's `ACTIVE` reservations (available stock was already reduced at
reserve time). It is idempotent, tenant-scoped, and never re-deducts a
reservation that was already `RELEASED`.

`OrderLifecycleCoordinator` (in `modules/orders`) runs the status or fulfillment
change and the commit in **one transaction**. Whenever the resulting order is
`FULFILLED`, the commit runs. A refused status change therefore leaves stock
untouched, and a failed commit rolls the status change back.

`modules/orders` does not import `modules/inventory`. The coordinator depends on a
port (`InventoryCommitCoordinator`) and the web layer supplies
`ReservationReleaseService`, the same pattern as
`InventoryReleaseCoordinator` on cancellation. No new module dependency edge.

A partial fulfillment does not commit stock: `PARTIALLY_FULFILLED` leaves the
reservation `ACTIVE`.

## Decision 3: A merchant status endpoint with an allow-list

`POST /api/v1/stores/:storeId/orders/:orderId/status` accepts
`CONFIRMED | PROCESSING | SHIPPED | DELIVERED | COMPLETED`.

- **Role:** staff or above, matching `fulfill` and the authorization table in
  `specs/orders/order-spec.md` §31. Store scope comes from the session.
- **`CANCELLED` is rejected.** Cancelling releases stock, refunds a paid order and
  notifies the customer, so it only goes through the cancellation workflow.
- **`PENDING` is never a target.**
- **`SHIPPED` is allowed here** so an order fulfilled before this endpoint existed
  (fulfilled while `PENDING`/`PROCESSING`) can be advanced; `fulfill` cannot, for
  the early-return reason above.
- The state machine, not the endpoint, decides whether a move is legal from the
  current status. Skipped and backwards steps are 400.
- The allow-list is enforced twice: by the request validator and again inside
  `OrderLifecycleCoordinator.transition`.

`updateFulfillmentStatus` and `transitionStatus` are unchanged, so existing
callers and tests keep their behavior.

## Decision 4: `state-machines.md` follows the code

`docs/domain/state-machines.md` §26-27 described order states (`FULFILLED`,
`REFUNDED`, `PARTIALLY_REFUNDED`) that the code does not use. The implemented
model, which `specs/orders/order-spec.md` already describes, is: order `status`
(`PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED → COMPLETED`, plus
`CANCELLED`), with payment and fulfillment tracked in `payment_status` and
`fulfillment_status`. The state-machines document was corrected to match.

---

## Consequences

- Stock for a paid order now stays reserved until dispatch or cancellation.
- **Orders already affected are not repaired.** A paid order whose reservation was
  released by the old sweep has already had its stock returned to availability.
  `commitOrderReservations` skips a `RELEASED` reservation rather than deducting
  again, so shipping such an order does not consume stock. The count for those
  items needs a manual correction through the existing inventory adjustment flow.
- An order that is never shipped or cancelled keeps its stock reserved
  indefinitely. That is intended (the goods are promised to a customer), but it
  makes the cancel path and, for COD, a stale-order policy the way to free it.
- A manually created reservation with `reference_type = 'order'` is also exempt
  from expiry.
- Phase 2 (COD placement) reuses this: a COD order reserves stock, hands the
  reservation to the order at placement, and relies on the same release and
  commit rules.
