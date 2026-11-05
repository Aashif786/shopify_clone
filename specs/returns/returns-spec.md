# Returns / RMA Specification

## 1. Purpose

This specification defines the functional and technical requirements for the
Returns domain of the Cal Cart commerce platform (gap **GAP-13**, milestone
**M4**).

The Returns domain owns the customer-initiated return authorization process:
the request a customer raises against a delivered order, the merchant's review
of that request, confirmation that the goods came back, and the hand-off to the
existing refund path.

It owns:

- Return requests and their lifecycle state machine
- Return request line items (which order lines, and how many units)
- The append-only return event audit trail
- Per-store return policy (return window, returns on/off)
- Return eligibility evaluation

The Returns domain does **not** own:

- Orders, order items, or order status
- Payments, refunds, or gateway dispatch
- Inventory restocking
- Shipping labels or reverse logistics
- Email rendering or delivery

Those domains interact with Returns through their public service interfaces.

---

## 2. Scope

### In scope

- A customer requesting a return on an eligible order, choosing specific lines
  and quantities, with a reason.
- A customer withdrawing their own request before the merchant decides.
- A merchant approving or declining a request.
- A merchant confirming physical receipt of the returned goods.
- A merchant issuing the refund, reusing `RefundService.executeMerchantRefund`.
- A merchant configuring the return window, or switching returns off.
- Return lifecycle notifications via the shared notification outbox.

### Explicitly out of scope (deferred)

- **Automated return shipping labels and reverse logistics.** Deferred to the
  M6 shipping/logistics work; the customer ships items back out of band.
- **Inventory restocking on receipt.** Marking a return received does not
  increment stock. Returned goods are frequently damaged or unsellable, so
  automatic restocking would corrupt availability. A merchant adjusts stock
  through the existing inventory adjustment flow.
- **Refund-to-store-credit.** Requires the stored-value ledger from GAP-14
  (M7); refunds go back to the original payment method only.
- **Partial-quantity receipt.** A return is received in full or not at all.
- **Exchanges.** A return ends in a refund, never a replacement order.

---

## 3. Domain Model

### 3.1 Return request

| Field | Notes |
| :--- | :--- |
| `id` | UUIDv7 |
| `storeId` | Tenant owner; every query is scoped by it |
| `orderId` | Composite FK `(order_id, store_id)` → `orders` |
| `customerId` | Nullable: guest orders have no customer record |
| `returnNumber` | Human reference, `RET-<base36 time>-<4 digits>`, unique per store |
| `status` | See the state machine below |
| `reason` | Customer's reason, 1–500 characters |
| `customerNote` | Optional free text, ≤2000 characters |
| `merchantNote` | Optional merchant note, ≤2000 characters |
| `currency` | Copied from the order |
| `requestedAmount` | Server-computed refundable value of the returned lines, minor units |
| `refundedAmount` | Actual refunded amount, set when closed out |
| `refundId` | Composite FK `(refund_id, store_id)` → `refunds` |

Timestamps: `requestedAt`, `decidedAt`, `receivedAt`, `refundedAt`,
`cancelledAt`, plus `decidedByUserId`.

### 3.2 State machine

```text
REQUESTED ──approve──> APPROVED ──receive──> RECEIVED ──refund──> REFUNDED
    │                      │                                      (terminal)
    ├──reject──> REJECTED   └──reject──> REJECTED  (terminal)
    └──cancel──> CANCELLED  (terminal, customer only)
```

Rules:

1. Re-applying the current status is an idempotent no-op.
2. `REJECTED`, `REFUNDED`, and `CANCELLED` are terminal; any transition out of
   them raises `ReturnRequestImmutableError`.
3. A refund is only legal from `RECEIVED`. `REQUESTED → REFUNDED` and
   `APPROVED → REFUNDED` both raise `InvalidReturnStatusTransitionError`, so
   money cannot move before the goods are back.
4. Only the customer may cancel, and only from `REQUESTED`.
5. At most one return request per order may be in an open status
   (`REQUESTED`, `APPROVED`, `RECEIVED`). Enforced by the partial unique index
   `return_requests_one_open_per_order_idx`, not only in application code.

### 3.3 Eligibility

An order is returnable when **all** hold:

- The store has returns enabled.
- The order is not `CANCELLED`.
- Fulfillment status is `FULFILLED` or `PARTIALLY_FULFILLED`.
- Payment status is `PAID` or `PARTIALLY_REFUNDED` (there must be captured
  money to refund; `REFUNDED` is rejected as already fully refunded).
- `now` is within `returnWindowDays` of the fulfilment moment.

**Window anchor.** `orders` has no `fulfilled_at` column. The anchor is the
timestamp of the newest `order_status_history` row whose `to_status` is
`fulfillment:FULFILLED` or `fulfillment:PARTIALLY_FULFILLED` — the entry
`OrderStatusService.updateFulfillmentStatus` writes. Orders fulfilled before
that history existed fall back to `completedAt`. If neither resolves, the order
counts as not fulfilled.

### 3.4 Refund arithmetic

A return refunds what the customer was actually charged for the returned units.
The charge for a whole order line is:

```text
lineCharged = unitPrice × quantity − discountAmount + taxAmount
```

`discountAmount` is the line's share of the checkout discount and `taxAmount` is
the GST charged on it. Both are written to the order line when the order is
created (the discount allocated in proportion to line value, the tax taken from
the checkout's frozen tax snapshot; see `specs/tax/tax-spec.md`), so the figure
is exactly what was charged and does not move if a rate changes later.

- **Whole line**: refunds exactly `lineCharged`, so no minor unit is lost.
- **Partial quantity**: `floor(lineCharged × returned ÷ quantity)`. Rounding is
  always **down**, so successive partial returns of one line can never add up to
  more than the customer paid. The cost is that the last unit may come back a
  paisa short, which is the safe direction for the merchant's money.
- A store that charges no tax has `taxAmount = 0` and behaves as before.

> **History.** The first version of this module excluded tax (it was not yet
> computed anywhere) and also relied on `discountAmount`, which the order
> handoff never populated, so a return on a discounted order was refunded at the
> undiscounted price: 20,000 requested against 16,000 paid in the regression
> test. Both were corrected together in M5 by itemising discount and tax onto
> order lines.

Amounts are always recomputed server-side from the persisted order. The client
supplies only order item ids and quantities.

### 3.5 Return policy

Per-store, owned by this module in `return_policies`:

| Field | Default | Range |
| :--- | :--- | :--- |
| `isReturnsEnabled` | `true` | boolean |
| `returnWindowDays` | `14` | 0–365 |

A store with no row uses the module default and reports `isDefault: true`; no
row needs to exist for returns to work.

---

## 4. API Surface

### Storefront (customer)

| Method | Path | Notes |
| :--- | :--- | :--- |
| `GET` | `/api/v1/storefront/[storeSlug]/orders/[orderId]/returns` | Eligibility, per-line returnable quantity, and existing returns |
| `POST` | `/api/v1/storefront/[storeSlug]/orders/[orderId]/returns` | Open a return request |
| `POST` | `.../returns/[returnId]/cancel` | Withdraw a request |

Authorization is the existing order-ownership guard: the session customer or a
matching guest ownership token (`assertOrderOwnership`). A client-supplied
customer id is never trusted. Cancel additionally asserts the return belongs to
*that* order, so owning one order cannot cancel a return on another.

### Merchant

| Method | Path | Min role |
| :--- | :--- | :--- |
| `GET` | `/api/v1/stores/[storeId]/returns` | staff |
| `GET` | `/api/v1/stores/[storeId]/returns/[returnId]` | staff |
| `POST` | `.../returns/[returnId]/approve` | staff |
| `POST` | `.../returns/[returnId]/reject` | staff |
| `POST` | `.../returns/[returnId]/receive` | staff |
| `POST` | `.../returns/[returnId]/refund` | **admin** |
| `GET` | `/api/v1/stores/[storeId]/returns/policy` | staff |
| `PATCH` | `/api/v1/stores/[storeId]/returns/policy` | **admin** |

Refund and policy changes require admin, matching the existing order refund
route. `CrossStoreReturnAccessError` is reported as `404` so a caller cannot
distinguish "exists in another store" from "does not exist".

---

## 5. Refund Integrity

The refund is dispatched through `RefundService.executeMerchantRefund`, which
already owns idempotency, provider dispatch, order payment-status updates, and
the `REFUND_CONFIRMATION` email. Returns does not reimplement any of it.

Two deliberate decisions:

1. **The refund call is not wrapped in a Returns transaction.** It contacts an
   external payment provider; rolling back around a completed provider refund
   would erase the record of money that actually moved, and holding a
   transaction open across a network call would hold locks for its duration.

2. **Ordering is refund-then-record.** If recording the `REFUNDED` transition
   fails, the return stays `RECEIVED` and the operation is safe to re-run: the
   deterministic idempotency key `return-refund:<returnRequestId>` replays the
   original refund instead of issuing a second one. The failure direction is
   therefore "a real refund not yet reflected in the return", never "a return
   claiming a refund that never happened".

No client idempotency key is accepted on the return refund route; the key is
derived from the return request id, so retries and double-clicks are safe.

---

## 6. Notifications

Queued on the shared `notification_outbox` and delivered by the existing
`NotificationDispatchJob`:

| Type | Recipient |
| :--- | :--- |
| `RETURN_REQUESTED` | Store contact email (merchant alert) |
| `RETURN_APPROVED` | Customer |
| `RETURN_REJECTED` | Customer |

The refund email remains `REFUND_CONFIRMATION`, emitted by the refund path, so
there is no `RETURN_REFUNDED` type.

Enqueueing is **fail-open**: a notification failure is logged and never rolls
back the return transition it accompanies.

---

## 7. Tenant Isolation

- Every table carries `store_id`; every repository method is store-scoped.
- Every cross-table reference uses a composite `(id, store_id)` foreign key, so
  a return request cannot be attached to an order, order item, customer, or
  refund belonging to another store — enforced by the database, not just code.
- Merchant reads and mutations resolve store membership server-side from the
  session.

---

## 8. Acceptance Criteria

1. A customer can request a return on an eligible order, selecting specific
   lines and quantities, and see its status on the order page.
2. A merchant can approve or decline it, mark the goods received, and issue the
   refund, producing a real refund row linked to the return.
3. A refund can never be issued twice for one return, and never before receipt.
4. Return quantities can never exceed what was purchased, counting prior
   non-rejected returns.
5. Returns are invisible and immutable across store boundaries.
