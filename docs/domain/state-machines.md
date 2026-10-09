# State Machines

## 1. Purpose

This document defines the lifecycle state machines for the core commerce domains.

State machines establish:

- Valid states
- Valid transitions
- Transition triggers
- Transition ownership
- Preconditions
- Side effects
- Invalid transitions
- Concurrency requirements
- Idempotency expectations

State transitions are business operations and must not be implemented as arbitrary field updates.

---

# 2. State Machine Principles

The platform follows these principles:

1. Every state transition has a defined owner.
2. Only valid transitions may be performed.
3. State transitions are server-side operations.
4. Client-provided status values are never trusted.
5. State transitions must be concurrency-safe.
6. Critical transitions occur inside appropriate database transactions.
7. External provider callbacks must be idempotent.
8. Invalid transitions must produce explicit domain errors.
9. Historical state changes should be recorded where required.
10. Side effects must not occur more than once because of retries.
11. Terminal states must not silently transition backward.
12. State names should represent business meaning rather than implementation details.

---

# 3. State Machine Notation

The diagrams use:

```text
STATE_A
   ↓ event/command
STATE_B
```

A transition represents:

```text
Trigger
→ validation
→ state change
→ persistence
→ event/side effect
```

For example:

```text
PENDING
   ↓ confirm
CONFIRMED
```

does not mean that any caller may simply execute:

```text
status = "CONFIRMED"
```

The transition must go through the owning application/domain operation.

---

# 4. Store Lifecycle

## 4.1 States

```text
DRAFT
ACTIVE
SUSPENDED
ARCHIVED
```

---

## 4.2 Transition Diagram

```text
DRAFT
  │
  │ activate
  ▼
ACTIVE
  │
  ├── suspend ──► SUSPENDED
  │                  │
  │                  │ reactivate
  │                  ▼
  │                ACTIVE
  │
  │ archive
  ▼
ARCHIVED

SUSPENDED
   │
   │ archive
   ▼
ARCHIVED
```

---

## 4.3 Rules

### DRAFT → ACTIVE

Requires:

- valid store configuration
- required merchant ownership
- required setup completed

### ACTIVE → SUSPENDED

May occur because of:

- merchant action
- platform-level operational action

### SUSPENDED → ACTIVE

Requires authorization and valid store state.

### ACTIVE/SUSPENDED → ARCHIVED

Represents intentional retirement.

Archived stores should not accept normal commerce activity.

---

# 5. Product Lifecycle

## 5.1 States

```text
DRAFT
ACTIVE
ARCHIVED
```

---

## 5.2 Transition Diagram

```text
DRAFT
  │
  │ publish
  ▼
ACTIVE
  │
  │ archive
  ▼
ARCHIVED

ACTIVE
  │
  │ unpublish
  ▼
DRAFT
```

The exact implementation may represent publishing through separate publication fields, but the business semantics must remain equivalent.

---

# 6. Product Rules

### DRAFT

A product may be edited freely within normal validation rules.

It should not appear as an active storefront product.

### ACTIVE

The product is eligible for storefront visibility if publication conditions are satisfied.

### ARCHIVED

The product is retired.

Historical orders must continue referencing its historical information.

---

# 7. Product Publication

Publication is distinct from editing.

A product may be:

```text
Valid but unpublished
```

or:

```text
Published
```

This prevents editing a product from automatically making it commercially available.

Publication must validate required product information.

---

# 8. Product Variant Lifecycle

Variants generally follow the Product lifecycle but may have independent purchasability rules.

Conceptual states:

```text
ACTIVE
INACTIVE
ARCHIVED
```

Transitions:

```text
ACTIVE
  │
  │ deactivate
  ▼
INACTIVE
  │
  │ activate
  ▼
ACTIVE

ACTIVE/INACTIVE
      │
      │ archive
      ▼
ARCHIVED
```

A variant must not be purchasable when inactive or archived.

---

# 9. Inventory Lifecycle

Inventory does not use a simple business lifecycle in the same way as products or orders.

Instead, inventory is governed by quantities and reservations.

Conceptual state:

```text
AVAILABLE
RESERVED
COMMITTED
```

These represent inventory allocation states rather than permanent InventoryItem statuses.

---

# 10. Inventory Reservation Flow

```text
AVAILABLE
    │
    │ reserve(quantity)
    ▼
RESERVED
    │
    ├── release ─────► AVAILABLE
    │
    └── commit ──────► COMMITTED
```

`COMMITTED` means the reserved stock has been consumed as part of a successful business transaction.

---

# 11. Inventory Rules

Reservation must verify:

```text
available_quantity >= requested_quantity
```

The check and mutation must happen atomically.

Two concurrent requests must not both successfully reserve the same stock.

---

# 12. Inventory Release

A reservation may be released when:

- checkout expires
- checkout is cancelled
- payment flow fails
- order creation fails before commitment
- another explicitly supported cancellation path occurs

Release must be idempotent.

Calling release twice must not restore inventory twice.

---

# 13. Inventory Commitment

Commitment occurs when the business workflow has reached the point where reserved inventory should become consumed inventory.

The operation must ensure:

- reservation exists
- reservation belongs to the correct checkout/order
- reservation has not already been committed
- reservation has not already been released

---

# 14. Customer Lifecycle

Customer lifecycle may remain intentionally simple for Demo.

States:

```text
ACTIVE
DISABLED
```

Transition:

```text
ACTIVE
   │
   │ disable
   ▼
DISABLED
   │
   │ enable
   ▼
ACTIVE
```

Disabled customers should not be permitted to perform operations requiring an active customer account.

Historical orders remain intact.

---

# 15. Cart Lifecycle

## 15.1 States

```text
ACTIVE
CONVERTED
ABANDONED
EXPIRED
```

---

## 15.2 Transition Diagram

```text
ACTIVE
  │
  ├── checkout completed ──► CONVERTED
  │
  ├── inactivity/expiry ───► EXPIRED
  │
  └── abandonment ─────────► ABANDONED
```

Terminal states should not return to `ACTIVE`.

A new shopping session should normally create or obtain another active cart.

---

# 16. Cart Rules

Only `ACTIVE` carts may normally:

- add items
- remove items
- change quantities
- begin checkout

`CONVERTED`, `ABANDONED`, and `EXPIRED` carts are historical states.

---

# 17. Discount Lifecycle

## 17.1 States

```text
DRAFT
ACTIVE
PAUSED
EXPIRED
ARCHIVED
```

---

## 17.2 Transition Diagram

```text
DRAFT
  │
  │ activate
  ▼
ACTIVE
  │
  ├── pause ───► PAUSED
  │                │
  │                │ resume
  │                ▼
  │              ACTIVE
  │
  ├── expiry ───► EXPIRED
  │
  └── archive ──► ARCHIVED

PAUSED
  │
  ├── resume ───► ACTIVE
  └── archive ──► ARCHIVED
```

---

# 18. Discount Rules

A discount can only be redeemed when all relevant conditions are satisfied:

- discount is active
- current date is valid
- code is valid
- store matches
- minimum purchase conditions are satisfied
- product/category conditions are satisfied
- usage limits are not exceeded
- customer-specific restrictions are satisfied

These checks must occur server-side.

---

# 19. Checkout Lifecycle

## 19.1 States

```text
OPEN
PAYMENT_PENDING
COMPLETED
CANCELLED
EXPIRED
```

---

## 19.2 Transition Diagram

```text
OPEN
  │
  │ begin payment
  ▼
PAYMENT_PENDING
  │
  ├── payment success ──► COMPLETED
  │
  ├── payment failure ──► OPEN
  │
  ├── cancel ───────────► CANCELLED
  │
  └── expiry ───────────► EXPIRED

OPEN
  │
  │ cancel
  ▼
CANCELLED
```

---

# 20. Checkout Rules

Only `OPEN` checkouts may normally be modified.

Once `COMPLETED`:

- cart cannot be reused as an active checkout
- checkout totals are immutable
- successful order creation must be preserved
- repeated completion requests must be idempotent

---

# 21. Checkout Completion

Conceptually:

```text
OPEN
  ↓
validate cart
  ↓
validate products
  ↓
validate discounts
  ↓
reserve/commit inventory
  ↓
process payment
  ↓
create order
  ↓
COMPLETED
```

The exact sequencing depends on the payment flow.

The key rule is that the system must never create inconsistent combinations such as:

```text
payment succeeded
+
no order
+
inventory consumed twice
```

---

# 22. Canonical Payment Lifecycle

Payment states represent the platform's authoritative, normalized internal understanding of payment status.

The Payments domain and all referencing specifications use a single canonical payment state machine:

```text
CREATED
PENDING
PROCESSING
AUTHORIZED
CAPTURED
FAILED
CANCELLED
REQUIRES_RECONCILIATION
PARTIALLY_REFUNDED
REFUNDED
```

### State Rationale & Provider Mapping

- **`CAPTURED` vs `SUCCEEDED`:** Settled funds are required before order fulfillment. `SUCCEEDED` is ambiguous because authorizations or initial captures may be conflated. `CAPTURED` matches exact commerce accounting invariants and maps to Razorpay's `payment.captured` event.
- **Handling Customer Action (`REQUIRES_ACTION`):** For Razorpay Standard Checkout (and 3DS/UPI flows), authentication occurs inside the frontend client modal. From the server's aggregate perspective, the payment remains in `PENDING` until cryptographic proof is verified. `REQUIRES_ACTION` is therefore subsumed under `PENDING`.
- **`REQUIRES_RECONCILIATION`:** Captures ambiguous outcomes (e.g. gateway network timeout, webhook payload amount/currency mismatch, or conflicting provider state). It prevents false failures (which risk double charging on retry) and false captures (which risk delivering unpaid goods).
- **`PaymentAttempt` Lifecycle:** `INITIATED` → `PENDING` → `AUTHORIZED` → `CAPTURED` / `FAILED` / `CANCELLED` / `REQUIRES_RECONCILIATION`.
- **`Refund` Lifecycle:** `PENDING` → `PROCESSING` → `SUCCEEDED` / `FAILED` / `REQUIRES_RECONCILIATION`.

---

# 23. Payment Transition Diagram

```text
CREATED
   ├── pending (order created) ──► PENDING
   ├── cancel ───────────────────► CANCELLED
   └── fail ─────────────────────► FAILED

PENDING
   ├── processing ───────────────► PROCESSING
   ├── authorize ────────────────► AUTHORIZED
   ├── capture (auto/direct) ────► CAPTURED
   ├── failure / decline ────────► FAILED
   ├── cancel ───────────────────► CANCELLED
   └── network timeout / uncert ─► REQUIRES_RECONCILIATION

PROCESSING
   ├── authorize ────────────────► AUTHORIZED
   ├── capture ──────────────────► CAPTURED
   ├── failure ──────────────────► FAILED
   └── ambiguous response ───────► REQUIRES_RECONCILIATION

AUTHORIZED
   ├── capture ──────────────────► CAPTURED
   ├── void / cancel ────────────► CANCELLED
   ├── failure ──────────────────► FAILED
   └── capture timeout ──────────► REQUIRES_RECONCILIATION

CAPTURED
   ├── full refund ──────────────► REFUNDED
   └── partial refund ───────────► PARTIALLY_REFUNDED

PARTIALLY_REFUNDED
   ├── subsequent partial ───────► PARTIALLY_REFUNDED
   └── remaining refund (sum==cap)► REFUNDED

REQUIRES_RECONCILIATION
   ├── provider confirmed capture ► CAPTURED
   ├── provider confirmed failure ► FAILED
   └── provider confirmed cancel  ► CANCELLED
```

---

# 24. Payment Transition Rules

### Permitted Transitions Matrix

| From State | Allowed To States | Trigger / Condition |
|---|---|---|
| `CREATED` | `PENDING`, `CANCELLED`, `FAILED` | Razorpay order created, user cancel, or client validation error |
| `PENDING` | `PROCESSING`, `AUTHORIZED`, `CAPTURED`, `FAILED`, `CANCELLED`, `REQUIRES_RECONCILIATION` | Webhook, client callback with verified signature, decline, or gateway timeout |
| `PROCESSING` | `AUTHORIZED`, `CAPTURED`, `FAILED`, `REQUIRES_RECONCILIATION` | Capture confirmation, gateway response, or timeout |
| `AUTHORIZED` | `CAPTURED`, `CANCELLED`, `FAILED`, `REQUIRES_RECONCILIATION` | Capture call, void request, expiration, or capture timeout |
| `CAPTURED` | `PARTIALLY_REFUNDED`, `REFUNDED` | Verified successful refund from merchant action |
| `PARTIALLY_REFUNDED`| `PARTIALLY_REFUNDED`, `REFUNDED` | Verified partial refund or final refund totaling captured amount |
| `REQUIRES_RECONCILIATION` | `AUTHORIZED`, `CAPTURED`, `FAILED`, `CANCELLED` | Automated status reconciliation check or verified webhook |

### Forbidden Transitions & Invariants

1. **Terminal State Immutability:** `REFUNDED`, `CANCELLED`, and `FAILED` are terminal states for their respective records. They cannot transition to any active payment state.
2. **Captured State Protection:** A `CAPTURED` payment cannot transition backward to `CREATED`, `PENDING`, `PROCESSING`, `AUTHORIZED`, `FAILED`, or `CANCELLED`.
3. **Refund Limits:** A payment cannot transition to `PARTIALLY_REFUNDED` or `REFUNDED` unless current state is `CAPTURED` or `PARTIALLY_REFUNDED`, and total refunded amount does not exceed captured amount.
4. **Stale / Delayed Webhook Rule:** A delayed event must never move a payment backward from a more advanced state. Stale events are acknowledged and stored in `payment_webhook_events` with `status = 'IGNORED'` without modifying payment aggregate state.

---

# 25. Payment Webhook State Handling

Webhook processing follows strict transactional and deduplication rules:

```text
Provider Webhook (Raw Request Bytes)
      ↓
Verify Signature (HMAC-SHA256 via X-Razorpay-Signature)
      ↓
Durable Event Check (UNIQUE provider_event_id in payment_webhook_events)
      ↓ [Duplicate -> HTTP 200 OK without re-processing]
Begin PostgreSQL Transaction
      ↓
Row-Lock Payment (SELECT ... FOR UPDATE)
      ↓
Validate State Transition (Ensure not stale / backward)
      ↓
Apply State Transition (Update payments and payment_attempts)
      ↓
Mark Webhook Event PROCESSED
      ↓
Commit Transaction
      ↓
Trigger Downstream Order / Checkout Completion
```


---

# 26. Order Lifecycle

## 26.1 States

```text
PENDING
CONFIRMED
PROCESSING
FULFILLED
CANCELLED
REFUNDED
PARTIALLY_REFUNDED
```

---

# 27. Order Transition Diagram

```text
PENDING
   │
   ├── confirm ───────► CONFIRMED
   │
   └── cancel ────────► CANCELLED

CONFIRMED
   │
   ├── process ───────► PROCESSING
   │
   └── cancel ────────► CANCELLED

PROCESSING
   │
   └── fulfill ───────► FULFILLED

CONFIRMED
   │
   └── refund ────────► REFUNDED

PROCESSING
   │
   └── refund ────────► REFUNDED

FULFILLED
   │
   ├── partial refund ─► PARTIALLY_REFUNDED
   │
   └── full refund ───► REFUNDED

PARTIALLY_REFUNDED
   │
   └── remaining refund ► REFUNDED
```

---

# 28. Order Rules

Order state changes must go through the Orders domain.

A caller cannot directly set:

```text
order.status = "FULFILLED"
```

without the corresponding domain operation.

The transition must validate:

- current state
- actor authorization
- required payment state
- required inventory/fulfillment conditions
- refund conditions where applicable

---

# 29. Order Cancellation

Cancellation is allowed only from states where cancellation is still business-valid.

For example:

```text
PENDING → CANCELLED
CONFIRMED → CANCELLED
```

Cancellation may trigger:

- inventory release
- payment cancellation/refund
- customer notification
- status history
- domain events

Each side effect must be idempotent.

---

# 30. Refund Lifecycle

Refunds are represented through the Payment/Order lifecycle.

Conceptually:

```text
PAID
 │
 ├── partial refund ──► PARTIALLY_REFUNDED
 │
 └── full refund ─────► REFUNDED
```

Refund amount must never exceed the refundable amount.

Concurrent refund requests must be protected from double refunding.

---

# 31. Membership Lifecycle

Store memberships may use:

```text
INVITED
ACTIVE
SUSPENDED
REMOVED
```

---

## 31.1 Transition Diagram

```text
INVITED
   │
   │ accept
   ▼
ACTIVE
   │
   ├── suspend ───► SUSPENDED
   │                  │
   │                  │ reactivate
   │                  ▼
   │                ACTIVE
   │
   └── remove ─────► REMOVED

SUSPENDED
   └── remove ─────► REMOVED
```

Removed memberships must not grant store access.

---

# 32. Background Job Lifecycle

Jobs are operational state machines.

States:

```text
PENDING
RUNNING
SUCCEEDED
FAILED
CANCELLED
```

---

## 32.1 Transition Diagram

```text
PENDING
   │
   │ claim
   ▼
RUNNING
   │
   ├── success ───► SUCCEEDED
   │
   ├── retry ─────► PENDING
   │
   └── permanent failure ──► FAILED

PENDING
   └── cancel ────► CANCELLED
```

---

# 33. Job Rules

Workers must safely claim jobs.

A job must not be processed concurrently by multiple workers unless the operation is explicitly designed to be idempotent.

Retries must use:

- retry count
- backoff
- maximum attempts
- failure classification

---

# 34. Webhook Event Lifecycle

Webhook records represent external events received by the system.

States:

```text
RECEIVED
PROCESSING
PROCESSED
FAILED
IGNORED
```

---

## 34.1 Transition Diagram

```text
RECEIVED
   │
   │ process
   ▼
PROCESSING
   │
   ├── success ──► PROCESSED
   │
   ├── retryable failure ──► RECEIVED
   │
   └── permanent failure ──► FAILED

RECEIVED
   └── unsupported/duplicate ──► IGNORED
```

---

# 35. State Transition Authorization

Every state-changing operation must identify the actor or source.

Possible sources:

```text
MERCHANT
CUSTOMER
SYSTEM
WORKER
PAYMENT_PROVIDER
PLATFORM_ADMIN
```

Authorization depends on the domain.

For example:

```text
Customer
    → cancel own eligible order

Merchant
    → fulfill order

Payment Provider
    → report payment result

Worker
    → execute authorized background transition
```

A caller's source does not automatically grant permission.

---

# 36. State Transition Idempotency

A repeated transition request should produce a safe result.

Example:

```text
Order = CONFIRMED

confirmOrder(order)
```

A second identical request should not create another confirmation event or duplicate side effect.

Possible behavior:

```text
already in requested state
→ return current state
```

or:

```text
invalid transition
→ explicit domain error
```

depending on the operation.

---

# 37. Terminal States

Terminal states include states such as:

```text
ARCHIVED
EXPIRED
CONVERTED
CANCELLED
REFUNDED
FULFILLED
REMOVED
SUCCEEDED
```

A terminal state must not be treated as immutable in every possible business scenario without verifying the domain.

For example, `FULFILLED` may later support returns/refunds.

Therefore terminal means:

```text
No normal forward lifecycle transition
```

not:

```text
No future business operation is possible
```

---

# 38. State Transition Persistence

Important state changes should record:

```text
entity_id
previous_state
new_state
actor/source
reason
created_at
metadata
```

Orders must maintain explicit status history.

Other domains may record history when auditability or reconciliation requires it.

---

# 39. State Transition and Transactions

A state transition and its required internal side effects should normally occur in one database transaction.

Example:

```text
BEGIN

load order
lock order
validate current state
validate transition
update order
insert status history
create required event

COMMIT
```

This prevents partially applied transitions.

---

# 40. Concurrency

State transitions must protect against:

```text
Request A:
CONFIRMED → FULFILLED

Request B:
CONFIRMED → CANCELLED
```

Both requests must not succeed when the business rules allow only one transition.

Use:

- row locking
- conditional updates
- transactions
- state validation
- unique constraints where appropriate

as defined by the database concurrency strategy.

---

# 41. External Events and State

External systems may report events that do not match the current internal state.

Example:

```text
Internal:
PAYMENT = CAPTURED

Provider webhook:
PAYMENT = FAILED
```

The system must not blindly overwrite the internal state.

Instead:

1. Validate event authenticity.
2. Check event uniqueness.
3. Compare event ordering/state.
4. Determine whether transition is valid.
5. Apply or ignore according to reconciliation rules.
6. Preserve the event for audit/reconciliation.

---

# 42. State Machine Testing

Every state machine should have tests for:

### Valid transitions

```text
A → B
```

### Invalid transitions

```text
A → C
```

### Repeated transitions

```text
A → B
A → B
```

### Concurrent transitions

```text
A → B
A → C
```

### Failure during transition

Verify that the database does not remain partially updated.

### External retries

Verify duplicate webhooks do not duplicate business effects.

---

# 43. State Machine Testing Matrix

At minimum:

| Domain | Valid Transition Tests | Invalid Transition Tests | Concurrency Tests |
|---|---:|---:|---:|
| Stores | Required | Required | Recommended |
| Products | Required | Required | Recommended |
| Inventory | Required | Required | Critical |
| Customers | Required | Required | Recommended |
| Carts | Required | Required | Required |
| Discounts | Required | Required | Critical for usage |
| Checkout | Required | Required | Critical |
| Payments | Required | Required | Critical |
| Orders | Required | Required | Critical |
| Jobs | Required | Required | Critical |
| Webhooks | Required | Required | Critical |

---

# 44. State Naming Rules

State names should:

- describe business state
- remain stable
- use consistent naming
- avoid provider-specific terminology
- avoid UI terminology
- avoid implementation details

Prefer:

```text
PAYMENT_CAPTURED
```

over:

```text
STRIPE_DONE
```

Prefer:

```text
ORDER_FULFILLED
```

over:

```text
BUTTON_CLICKED
```

---

# 45. State Machine Anti-Patterns

Avoid:

### Arbitrary status updates

```text
updateStatus(newStatus)
```

with no transition validation.

### Client-controlled state

```text
POST /orders
{
  "status": "FULFILLED"
}
```

### Provider-driven internal state

Mapping every provider status directly to internal state without business validation.

### Hidden transitions

Changing state as an accidental side effect of unrelated code.

### Duplicate side effects

Sending notifications or consuming inventory every time a retry reaches an already-completed state.

### Giant state enums

Do not create states for every UI condition.

---

# 46. Demo State Machine Scope

Demo should implement only states needed by actual business flows.

The initial state machines cover:

```text
Stores
Products
Variants
Inventory
Customers
Carts
Discounts
Checkout
Payments
Orders
Memberships
Jobs
Webhook Events
```

More advanced lifecycle states should be added only when the corresponding feature is implemented.

---

# 47. Demo-to-V1 Evolution

The state-machine model should remain stable as infrastructure evolves.

V1 may add:

- richer fulfillment states
- return states
- shipment states
- tax states
- subscription states
- fraud review states
- payment reconciliation states
- advanced refund states

These should extend the existing business model rather than replace it unnecessarily.

---

# 48. Definition of Done

The state-machine architecture is complete when:

- Core lifecycle states are documented.
- Valid transitions are explicit.
- Invalid transitions are understood.
- Transition ownership is clear.
- Authorization requirements are defined.
- Idempotency behavior is defined.
- Concurrency expectations are documented.
- Historical state changes are handled appropriately.
- External webhook transitions are validated.
- Background job states are defined.
- Terminal-state behavior is understood.
- State transitions can be independently tested.
- Domain state cannot be changed through arbitrary client-controlled fields.