# ADR-014: Returns — Refund Ordering, Module Ownership, and Return Window Anchor

- **Status**: Accepted
- **Date**: 2026-11-04
- **Context**: GAP-13 / Milestone M4 — customer-initiated returns (RMA)
- **Related**: [ADR-006](./ADR-006-idempotency-strategy.md),
  [ADR-009](./ADR-009-payment-refund-and-capture-integrity.md)

---

## Context

Customer-initiated returns introduce a new domain that must end in a refund.
Three decisions had non-obvious trade-offs and are recorded here.

---

## Decision 1: The refund is dispatched outside any Returns transaction, and ordered refund-then-record

`ReturnService.refundReturnRequest` calls
`RefundService.executeMerchantRefund` **before** it writes the `REFUNDED`
transition, and does not wrap that call in a transaction of its own.

### Alternatives considered

**(a) Wrap the refund and the status update in one transaction.** Rejected.
`executeMerchantRefund` contacts an external payment provider. A transaction
spanning that call holds row locks for the duration of a network round trip,
and — worse — if the transaction rolled back after the provider had already
moved the money, the refund record would disappear while the customer had been
refunded. The database would then disagree with reality in the most dangerous
direction.

**(b) Record `REFUNDED` first, then dispatch.** Rejected. A dispatch failure
would leave a return claiming a refund that never happened, which is a
financial misstatement visible to the customer.

### Consequences

The failure window is "a real refund that the return request has not yet
recorded". That is recoverable and safe:

- The operation is re-runnable. The deterministic idempotency key
  `return-refund:<returnRequestId>` makes `executeMerchantRefund` replay the
  original refund rather than issue a second one.
- A re-run then completes the status transition.
- The return stays `RECEIVED` meanwhile, which is visibly unfinished to the
  merchant rather than silently wrong.

Accordingly the return refund route accepts **no** client idempotency key: the
key is derived from the return request id, so retries and concurrent clicks
cannot double-refund. This differs from the order refund route, where the
merchant chooses the amount and therefore supplies their own key.

A refund is legal only from `RECEIVED`. This is enforced in the state machine,
so money cannot move before the goods are physically back.

---

## Decision 2: `modules/returns` owns its own `return_policies` table

The per-store return window lives in a `return_policies` table owned by
`modules/returns`, not as columns on `store_settings`.

### Rationale

`store_settings` is owned by `modules/stores`. Adding `return_window_days`
there would have required editing six explicit column lists in
`store-repository.ts`, plus the `StoreSettings` entity, `StoreSettingsDTO`,
`StoreService`, the settings validator, and the settings UI — a wide change to
an unrelated module for one integer, and a reason for `modules/returns` to read
another module's table, which `AGENTS.md` forbids.

Owning the policy keeps the blast radius inside the new module and leaves room
for future policy fields (restocking fees, non-returnable categories) without
touching `stores` again.

### Consequences

- A store with no policy row uses the module default (14 days, returns
  enabled) and reports `isDefault: true`. No row needs to exist for returns to
  work, so there is no backfill and no lazy-creation race.
- The platform default lives in one place,
  `DEFAULT_RETURN_WINDOW_DAYS`.

---

## Decision 3: The return window is anchored on fulfilment status history

`orders` has no `fulfilled_at` column. Rather than add one, eligibility derives
the fulfilment moment from the newest `order_status_history` row whose
`to_status` is `fulfillment:FULFILLED` or `fulfillment:PARTIALLY_FULFILLED`.

### Rationale

`OrderStatusService.updateFulfillmentStatus` already writes that entry inside
the fulfilment transaction, so the data is authoritative, append-only, and
present for every order fulfilled through the service. Adding a column would
have required a backfill for existing orders with no reliable source to
backfill *from*, and would have put a Returns concern into the Orders schema.

### Consequences

- Eligibility depends on status history being retained. History is append-only
  and never pruned today; a future retention policy must exclude
  `fulfillment:*` rows or this anchor breaks.
- Orders fulfilled before fulfilment history existed fall back to
  `completedAt`; if neither resolves, the order is treated as not fulfilled,
  which fails closed.
- Re-fulfilment moves the anchor forward, which is the intended behaviour: the
  window should run from the most recent shipment.

---

## Decision 4: Receiving a return does not restock inventory

Marking a return `RECEIVED` does not increment available stock.

### Rationale

Returned goods are frequently damaged, incomplete, or otherwise unsellable.
Automatically restocking would overstate availability and cause oversells —
precisely the failure the concurrency-safe inventory work exists to prevent.
Deciding sellability is a human judgement.

### Consequences

Merchants adjust stock through the existing inventory adjustment flow, which
already records an audit reason. If a "restock on receipt" affordance is added
later it should be an explicit merchant action with its own adjustment reason,
never an implicit side effect of the state transition.
