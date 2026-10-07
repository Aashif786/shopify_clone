# Inventory Domain Build Implementation

## 1. Purpose

This document defines the concrete implementation approach for the Inventory domain in the Demo.

Inventory is one of the highest-risk commerce domains because incorrect concurrency handling can result in overselling, negative stock, duplicate reservations, or inconsistent order state.

The Inventory domain must therefore prioritize transactional correctness, explicit state transitions, concurrency safety, and idempotent mutations.

---

# 2. Domain Ownership

The Inventory module owns:

- Inventory records.
- On-hand quantity.
- Reserved quantity.
- Available quantity.
- Inventory adjustments.
- Inventory movements/history.
- Reservations.
- Reservation release.
- Reservation finalization.
- Inventory-related concurrency control.

It does not own:

- Product identity.
- Product descriptions.
- Variant catalog information.
- Carts.
- Checkout orchestration.
- Payments.
- Orders.
- Customers.

---

# 3. Module Location

Implementation belongs under:

```text id="w1b3z8"
modules/inventory/
```

Recommended structure:

```text id="k8p6v2"
modules/inventory/
├── domain/
├── application/
├── infrastructure/
└── index.ts
```

The exact internal structure should follow repository conventions.

---

# 4. Inventory Model

Inventory is associated with a purchasable Product Variant.

Conceptually:

```text id="r4n7c2"
Store
  ↓
Product
  ↓
Variant
  ↓
Inventory
```

Inventory must remain Store-scoped even when the Variant relationship is used for lookup.

---

# 5. Core Entities

The primary inventory entities are:

```text id="v8m3q5"
Inventory
InventoryAdjustment
InventoryReservation
InventoryMovement
```

The exact persistence model must follow the approved database specification.

---

# 6. Quantity Model

The implementation must clearly distinguish:

```text id="x6r4m9"
onHand
reserved
available
```

Conceptually:

```text
available = onHand - reserved
```

The authoritative values must be derived and persisted according to the approved schema design.

Do not allow different parts of the system to maintain conflicting definitions.

---

# 7. Quantity Rules

Inventory quantities must:

- Use exact integer quantities where the Demo supports discrete units.
- Never become negative unless explicitly allowed by a future requirement.
- Reject invalid quantities.
- Preserve transactional consistency.

---

# 8. Inventory Creation

Inventory should be created when a Variant becomes inventory-managed according to the approved workflow.

A typical flow is:

```text id="m5q8r4"
Create Variant
    ↓
Initialize Inventory
    ↓
Set initial quantity if supplied
    ↓
Persist transactionally
```

The Products domain should not directly manipulate inventory persistence.

---

# 9. Inventory Lookup

Inventory application services should expose purpose-specific operations.

Examples:

```text id="v7r3m6"
getInventory()
getAvailableQuantity()
getReservation()
```

Do not expose arbitrary database queries to consuming domains.

---

# 10. Inventory Adjustment

Merchant inventory changes should be represented as explicit adjustments.

Examples:

```text id="q4m8r5"
Stock received
Stock correction
Damaged stock
Manual adjustment
Initial stock
```

Every adjustment should have an auditable reason where required.

---

# 11. Adjustment Flow

A typical adjustment operation is:

```text id="x8r5m3"
Authenticate merchant
    ↓
Resolve Store
    ↓
Authorize inventory management
    ↓
Validate request
    ↓
Begin transaction
    ↓
Lock inventory row
    ↓
Validate resulting quantity
    ↓
Apply adjustment
    ↓
Record movement/history
    ↓
Commit
```

---

# 12. Concurrency Control

Inventory mutations must be concurrency-safe.

For operations affecting the same inventory record, use database-supported transactional locking or another approved concurrency mechanism.

The Demo should use PostgreSQL as the concurrency authority.

---

# 13. Row Locking

For critical inventory mutations, the implementation may use row-level locking such as:

```text id="m6q4v8"
SELECT ...
FOR UPDATE
```

The exact query structure belongs in the persistence implementation.

---

# 14. Lock Scope

Locks should cover only the records required for the mutation.

Do not hold inventory locks while performing:

```text id="v5r8m4"
HTTP requests
Payment-provider calls
Email delivery
File uploads
Long computations
```

---

# 15. Lock Ordering

When multiple inventory records must be locked, acquire locks in a deterministic order.

For example:

```text id="q7m4r8"
sort by inventory ID
then lock sequentially
```

This reduces deadlock risk.

---

# 16. Inventory Reservation

Reservations temporarily hold available inventory during checkout.

Conceptually:

```text id="x4m7n6"
available inventory
      ↓
reservation
      ↓
reserved inventory
```

Reservation creation must be atomic.

---

# 17. Reservation Creation

A reservation should:

1. Validate the Variant.
2. Resolve Store context.
3. Begin a transaction.
4. Lock required inventory records.
5. Calculate available quantity.
6. Verify sufficient quantity.
7. Increase reserved quantity.
8. Create reservation record.
9. Commit.

---

# 18. Insufficient Inventory

If available quantity is insufficient:

```text id="v8r4m6"
Do not modify inventory.
Do not create a successful reservation.
Return INVENTORY_UNAVAILABLE.
```

The operation must not partially reserve stock.

---

# 19. Reservation Identity

Every reservation should have a stable identifier.

It should also reference enough information to determine:

```text id="m5q8r3"
Store
Variant
Quantity
Reservation owner/context
Status
Expiration
```

The exact schema follows the database design.

---

# 20. Reservation States

The reservation state machine should use the approved states.

Typical states may include:

```text id="x7m4r8"
ACTIVE
RELEASED
FINALIZED
EXPIRED
```

Only valid transitions are permitted.

---

# 21. Reservation Expiration

Reservations may expire after the configured checkout/reservation lifetime.

Expiration should release reserved quantity exactly once.

A background job may process expired reservations.

---

# 22. Reservation Release

Release should:

```text id="q6r8m4"
Lock inventory
    ↓
Verify reservation state
    ↓
Decrease reserved quantity
    ↓
Update reservation state
    ↓
Record movement
    ↓
Commit
```

If the reservation is already released or finalized, the operation must not release it again.

---

# 23. Reservation Finalization

When checkout successfully completes the purchase, the reservation is finalized.

Finalization should:

```text id="v4m7n8"
Lock inventory
    ↓
Verify reservation is active
    ↓
Decrease reserved quantity
    ↓
Decrease on-hand quantity
    ↓
Mark reservation finalized
    ↓
Record movement
    ↓
Commit
```

The exact quantity transition must follow the approved inventory model.

---

# 24. Atomicity

Reservation finalization must be atomic.

The following must not happen:

```text id="m8q5r4"
onHand updated
reservation remains active
```

or:

```text id="x5r7m3"
reservation finalized
onHand unchanged
```

The transaction must preserve both sides.

---

# 25. Idempotency

Inventory mutations must be safe against retries.

Particularly:

```text id="q7m4r8"
reserve
release
finalize
adjust
```

must not accidentally apply the same mutation twice.

Idempotency should use the approved application-level mechanism where applicable.

---

# 26. Duplicate Reservation Requests

If the same logical reservation request is retried with the same idempotency identity, the implementation should return the existing result according to the operation contract.

A reused idempotency key with a different request payload must produce an idempotency conflict.

---

# 27. Inventory Movements

Inventory changes should produce movement/history records where required.

Examples:

```text id="v6r4m8"
ADJUSTMENT
RESERVATION
RELEASE
FINALIZATION
```

Movement records provide an audit trail for stock changes.

---

# 28. Movement Immutability

Historical inventory movement records should not be silently rewritten.

Corrections should be represented by new adjustments rather than editing historical movements.

---

# 29. Inventory Queries

Merchant inventory views may provide:

```text id="m5q8r4"
On-hand
Reserved
Available
Recent adjustments
Recent movements
Active reservations
```

Queries must remain Store-scoped.

---

# 30. Available Quantity

Available quantity must be calculated consistently.

The implementation must avoid independent copies of the same business value becoming inconsistent.

If available quantity is persisted for performance, every mutation path must update it transactionally.

---

# 31. Product Integration

Products provides:

```text id="x7r4m6"
Variant identity
Store ownership
Catalog status
```

Inventory provides:

```text id="q8m5r3"
Stock state
Reservation state
Availability
```

Neither domain should assume ownership of the other's internal data.

---

# 32. Cart Integration

Cart may display availability information.

However, Cart must not reserve inventory merely because an item was added to a cart unless the approved checkout workflow explicitly requires reservation at that stage.

Inventory reservation belongs to the checkout process.

---

# 33. Checkout Integration

Checkout is the primary consumer of reservation operations.

Conceptually:

```text id="v4m8r6"
Checkout
   ↓
Inventory.reserve()
   ↓
Payment process
   ↓
Inventory.finalize()
```

Failure paths must release reservations when appropriate.

---

# 34. Payment Failure

A payment failure should not leave inventory permanently reserved.

The checkout workflow must determine whether and when the reservation should be released.

Release must remain idempotent.

---

# 35. Checkout Expiration

When checkout expires, active reservations should be released through the approved synchronous or asynchronous workflow.

A background cleanup job may recover reservations that were not released by the normal path.

---

# 36. Order Integration

Orders record what was purchased.

Inventory determines the stock mutation.

Order creation must not independently decrement inventory.

The Checkout/Order workflow must coordinate the domains through their public application interfaces.

---

# 37. Refund Integration

A refund does not automatically mean inventory should be restored.

Inventory restoration rules must be explicit.

If the Demo supports restocking after refunds, it must use a dedicated inventory adjustment operation.

---

# 38. Authorization

Inventory mutations require appropriate Store membership and permissions.

Examples:

```text id="m7r4v8"
View inventory
Adjust inventory
Manage reservations where applicable
```

The exact permission matrix follows the approved authorization model.

---

# 39. Tenant Isolation

Every inventory operation must verify Store ownership.

Never accept:

```text id="x5m8r4"
inventoryId
```

as sufficient authorization.

The application must establish the trusted Store context first.

---

# 40. Cross-Tenant Protection

Tests must verify:

```text id="q6r7m3"
Store A
  ↓
Inventory belonging to Store B
  ↓
Rejected
```

This includes reads, adjustments, reservations, releases, and finalization.

---

# 41. Database Constraints

The database should enforce critical inventory integrity.

Examples:

```text id="v8m4r5"
Inventory → Variant foreign key
Inventory → Store relationship where required
Non-negative quantity constraints
Reservation → Inventory relationship
Reservation quantity > 0
Valid required fields
```

---

# 42. Transaction Isolation

Default PostgreSQL Read Committed should be sufficient for most operations when combined with correct row locking and constraints.

Higher isolation levels should be introduced only when a specific correctness requirement demonstrates the need.

---

# 43. Deadlock Handling

Deadlocks may occur in legitimate concurrent workloads.

The implementation should:

- Maintain deterministic lock ordering.
- Keep transactions short.
- Avoid unnecessary locks.
- Retry safe operations where appropriate.

Do not blindly retry every transaction.

---

# 44. External Calls

Inventory transactions must never remain open while calling external providers.

Never do:

```text id="m6q4r8"
BEGIN
  lock inventory
  call payment provider
  call storage provider
  call email provider
COMMIT
```

Instead, external workflows should be coordinated outside long-held database locks.

---

# 45. Error Handling

Use stable shared error codes.

Examples:

```text id="x7r5m4"
INVENTORY_NOT_FOUND
INVENTORY_UNAVAILABLE
INVALID_INVENTORY_ADJUSTMENT
RESERVATION_NOT_FOUND
RESERVATION_EXPIRED
RESERVATION_ALREADY_FINALIZED
RESERVATION_ALREADY_RELEASED
INVENTORY_CONCURRENCY_CONFLICT
```

Exact codes belong to the centralized error contract.

---

# 46. Events

Inventory may emit facts such as:

```text id="q8m4r6"
InventoryAdjusted
InventoryReserved
InventoryReleased
InventoryFinalized
```

Events must only be emitted when the underlying state transition succeeds.

---

# 47. Jobs

Inventory-related background jobs may include:

```text id="v5r7m8"
ExpireReservations
RecoverStaleReservations
```

Jobs must be durable and idempotent.

The Jobs infrastructure owns execution mechanics.

---

# 48. Reservation Expiration Job

A reservation expiration job should:

1. Find eligible expired reservations.
2. Claim work safely.
3. Process each reservation transactionally.
4. Release inventory exactly once.
5. Mark the reservation expired/released according to the state machine.
6. Record the movement.
7. Complete the job.

Concurrent workers must not process the same reservation incorrectly.

---

# 49. Testing Strategy

### Unit Tests

Test:

```text id="m4q8r7"
Quantity rules
Reservation state transitions
Adjustment rules
Availability calculations
Invalid transitions
```

### Integration Tests

Test:

```text id="x6r5m8"
Transactions
Row locking
Concurrent reservations
Concurrent adjustments
Reservation release
Reservation finalization
Database constraints
```

### API Tests

Test:

```text id="q7m4r6"
Authorization
Validation
Tenant isolation
Error mapping
DTOs
```

---

# 50. Concurrency Tests

Concurrency testing is mandatory.

At minimum test scenarios such as:

```text id="v8m5r3"
Two simultaneous reservations
Two reservations competing for final units
Reservation vs adjustment
Reservation release vs expiration
Reservation finalization vs expiration
Duplicate finalization
```

The expected result must preserve inventory correctness.

---

# 51. Example Oversell Test

Given:

```text id="m5r7q4"
onHand = 10
reserved = 0
```

Two concurrent checkout requests each request:

```text
quantity = 7
```

Only one reservation may succeed.

The final state must never imply:

```text id="x4m8r6"
reserved = 14
```

when only 10 units exist.

---

# 52. Idempotency Test

Given a reservation request:

```text id="q7r5m8"
idempotencyKey = K
quantity = 2
```

Repeated identical requests using `K` must not create two reservations.

Reusing `K` with a different quantity must fail according to the idempotency contract.

---

# 53. Security Tests

At minimum verify:

```text id="v6m4r8"
[ ] Unauthorized users cannot modify inventory
[ ] Store A cannot read Store B inventory
[ ] Store A cannot reserve Store B inventory
[ ] Client cannot override Store context
[ ] Inventory IDs cannot bypass authorization
[ ] Sensitive operational information is not leaked
```

---

# 54. Implementation Order

Implement Inventory in this order:

```text id="m8r5q4"
1. Database schema and constraints
2. Inventory domain model
3. Quantity/value rules
4. Repository interfaces
5. Persistence implementation
6. Inventory adjustment operation
7. Reservation creation
8. Reservation release
9. Reservation finalization
10. Movement/history
11. Concurrency controls
12. Idempotency
13. Events
14. Expiration/recovery jobs
15. API integration
16. Unit tests
17. Integration/concurrency tests
18. Security tests
19. Checkout integration verification
```

---

# 55. AI Implementation Rules

AI agents implementing Inventory must:

1. Read the actual root `AGENTS.md`.
2. Read the Inventory domain specification.
3. Read checkout, payment, order, and database concurrency documentation before modifying critical flows.
4. Never implement inventory mutation without transaction analysis.
5. Never remove row locking merely to simplify code.
6. Never call external providers while holding critical inventory locks.
7. Preserve idempotency.
8. Add concurrency tests for critical mutations.
9. Never bypass Store authorization.
10. Never modify unrelated domains.
11. Review transaction boundaries and final diff carefully.

---

# 56. Definition of Done

Inventory implementation is complete when:

```text id="x7m4r8"
[ ] Inventory records work
[ ] Quantity rules are enforced
[ ] Adjustments are transactional
[ ] Reservations are transactional
[ ] Releases are idempotent
[ ] Finalization is idempotent
[ ] Inventory cannot become incorrectly negative
[ ] Concurrent reservations are safe
[ ] Lock ordering is deterministic
[ ] Reservation expiration works
[ ] Movement history is recorded
[ ] Tenant isolation is enforced
[ ] Authorization is enforced
[ ] Stable errors are returned
[ ] Events are emitted only after successful state changes
[ ] Jobs are durable and idempotent
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Concurrency tests pass
[ ] Security tests pass
[ ] TypeScript passes
[ ] Lint passes
```

---

# 57. Final Principle

Inventory correctness is more important than implementation convenience.

The system must always prefer:

```text
Correct stock
    >
Fast but unsafe mutation
```

A temporary checkout failure is recoverable.

Selling the same physical unit twice because two requests happened to arrive at the same time is a much more expensive kind of software achievement.