# Inventory Implementation

## 1. Purpose

This document defines the concrete implementation of the Inventory domain for the Demo.

Inventory is one of the platform's most correctness-sensitive domains. It owns the authoritative stock state and must remain safe under concurrent operations.

The Inventory domain owns:

- Stock quantities.
- Available inventory.
- Reserved inventory.
- Inventory adjustments.
- Reservations.
- Reservation release.
- Reservation finalization.
- Inventory movement/history.
- Concurrency control.

It does not own Product catalog data, Cart state, Checkout state, Payment state, or Order lifecycle.

---

# 2. Domain Ownership

Inventory implementation belongs to:

```text id="n7c4m8"
modules/inventory
```

The module owns all authoritative inventory state and business rules.

It may use:

```text id="q8m3c7"
packages/db
packages/tenant
packages/types
packages/validation
```

It may consume Product information through public interfaces.

It must not directly access Product internals.

---

# 3. Inventory Ownership Model

Inventory is associated with a Store and a Product Variant.

Conceptually:

```text id="v5m8c4"
Store
  ↓
Product
  ↓
Variant
  ↓
Inventory
```

The Variant identifies what is being stocked.

Inventory owns how much of that Variant is available.

---

# 4. Inventory Record

A basic inventory record may contain:

```text id="x7m3c8"
id
store_id
variant_id
quantity
reserved_quantity
created_at
updated_at
```

The exact schema should follow the database specification.

---

# 5. Available Quantity

Available inventory should be derived consistently.

Conceptually:

```text id="m8c4x7"
available_quantity
    =
quantity
    -
reserved_quantity
```

If `available_quantity` is stored separately for performance, the implementation must guarantee that it cannot drift from authoritative quantities.

Avoid maintaining multiple independent sources of truth unnecessarily.

---

# 6. Inventory Invariants

The Inventory domain must enforce invariants such as:

```text id="q7m4c8"
quantity >= 0
reserved_quantity >= 0
reserved_quantity <= quantity
available_quantity >= 0
```

The exact invariants must follow the domain specification.

These rules must be enforced transactionally.

---

# 7. Inventory Adjustments

Authorized merchant operations may adjust stock.

Examples:

```text id="v8c4m7"
Receive Stock
Correct Stock
Remove Damaged Stock
Manual Adjustment
```

Every adjustment should produce an auditable inventory movement.

---

# 8. Adjustment Model

An adjustment record should capture enough information to explain the change.

Conceptually:

```text id="x5m8c4"
id
store_id
inventory_id
quantity_delta
reason
reference
created_at
```

The exact fields should follow the schema specification.

---

# 9. Adjustment Transaction

An inventory adjustment should execute transactionally:

```text id="m4c8x7"
BEGIN
  Lock Inventory
  Validate Adjustment
  Update Quantity
  Record Movement
COMMIT
```

No external provider calls should occur while holding the inventory lock.

---

# 10. Inventory Reservation

Checkout should reserve inventory before completing the purchase.

Conceptually:

```text id="q8m3c7"
Checkout
   ↓
Inventory Reservation
   ↓
Available Quantity Decreases
   ↓
Reservation Created
```

The reservation must be atomic with the relevant inventory update.

---

# 11. Reservation Model

A reservation should contain information such as:

```text id="v7m4c8"
id
store_id
inventory_id
checkout_id
quantity
status
expires_at
created_at
updated_at
```

Possible statuses:

```text id="x8c4m7"
Active
Released
Finalized
Expired
```

The exact state machine follows the inventory specification.

---

# 12. Reservation Creation

Reservation creation should:

1. Resolve the Store.
2. Resolve the Inventory record.
3. Lock the inventory row.
4. Verify available quantity.
5. Increase reserved quantity.
6. Create the reservation.
7. Commit.

Example:

```text id="m5c8x7"
BEGIN
  SELECT inventory FOR UPDATE
  Validate available quantity
  UPDATE inventory
  INSERT reservation
COMMIT
```

---

# 13. Preventing Overselling

The critical invariant is:

```text id="q7m4c8"
available_quantity >= requested_quantity
```

must be checked while holding the appropriate database lock or using an equivalent atomic database operation.

Do not:

```text id="v8m3c7"
SELECT quantity
↓
Release lock
↓
Check quantity in application
↓
Update later
```

That pattern is vulnerable to concurrent overselling.

---

# 14. Atomic Reservation

Where appropriate, an atomic conditional update may be used.

Conceptually:

```sql id="x4m8c7"
UPDATE inventory
SET reserved_quantity = reserved_quantity + $quantity
WHERE id = $inventoryId
  AND quantity - reserved_quantity >= $quantity;
```

The application must verify that exactly the expected row was updated.

The selected implementation should remain consistent with repository and transaction conventions.

---

# 15. Reservation Release

When a reservation is cancelled or expires:

```text id="m8c4x7"
Reservation
   ↓
Validate Active State
   ↓
Lock Inventory
   ↓
Decrease Reserved Quantity
   ↓
Mark Reservation Released
COMMIT
```

The operation must be idempotent.

Releasing an already released reservation must not decrease inventory again.

---

# 16. Reservation Finalization

When payment/order completion succeeds:

```text id="q5m8c4"
Active Reservation
      ↓
Lock Inventory
      ↓
Reduce Physical Quantity
      ↓
Reduce Reserved Quantity
      ↓
Mark Reservation Finalized
      ↓
Commit
```

This converts the reservation into a completed stock movement.

---

# 17. Reservation Expiration

Reservations may expire after their configured lifetime.

Expiration should be handled by a background job.

The job should:

1. Find expired active reservations.
2. Lock each relevant record safely.
3. Verify it is still active.
4. Release it.
5. Mark it expired.
6. Commit.

Repeated execution must remain safe.

---

# 18. Reservation State Transitions

State transitions should be explicit.

Example:

```text id="v8m3c7"
Active
 ├──→ Released
 ├──→ Finalized
 └──→ Expired
```

Terminal states must not transition back to Active.

---

# 19. Concurrency Control

Inventory requires strong concurrency protection.

Primary mechanisms:

- PostgreSQL transactions.
- Row-level locks.
- Atomic conditional updates.
- Unique constraints.
- Deterministic lock ordering.
- Idempotency.

Use the simplest mechanism that guarantees the invariant.

---

# 20. Locking Strategy

When modifying an Inventory record:

```text id="x7c4m8"
BEGIN
  SELECT ... FOR UPDATE
  Perform validation
  Apply state change
  COMMIT
```

Keep the transaction short.

Do not perform:

```text id="m4c8x7"
HTTP calls
Payment provider requests
Email sending
File uploads
```

inside the inventory transaction.

---

# 21. Deterministic Lock Ordering

Operations involving multiple Inventory records must acquire locks in deterministic order.

For example:

```text id="q8m3c7"
Sort inventory IDs
      ↓
Lock in sorted order
      ↓
Apply changes
```

This reduces deadlock risk.

---

# 22. Deadlock Handling

If PostgreSQL reports a deadlock:

```text id="v5m8c4"
Rollback
 ↓
Classify as retryable
 ↓
Retry within bounded limits
```

The operation must be safe to retry.

---

# 23. Inventory Adjustments vs Reservations

These concepts must remain distinct.

### Adjustment

Merchant or system changes physical stock.

### Reservation

Checkout temporarily claims stock for a pending purchase.

### Finalization

A successful purchase consumes the reserved stock.

### Release

A failed/cancelled/expired purchase returns the reserved quantity to availability.

---

# 24. Inventory Movement History

Inventory changes should be traceable.

Movement records may identify:

```text id="x8c4m7"
Adjustment
Reservation
Reservation Release
Reservation Finalization
Correction
```

This supports operational investigation without relying on application logs as the source of truth.

---

# 25. Inventory Repository

The repository should provide focused operations such as:

```text id="m7c4x8"
findByVariant
getForUpdate
adjustQuantity
reserve
releaseReservation
finalizeReservation
createMovement
```

Operations that mutate stock must require a transaction.

---

# 26. Inventory Application Services

Typical application services include:

```text id="q8m3c7"
adjustInventory
getInventory
reserveInventory
releaseReservation
finalizeReservation
expireReservations
```

The exact names may follow repository conventions.

---

# 27. Product Integration

Inventory should validate that the referenced Variant exists and belongs to the same Store.

Correct relationship:

```text id="v4m8c7"
Inventory
   ↓
Variant ID
   ↓
Product public interface
```

Never accept a Variant ID from another Store.

---

# 28. Cart Integration

Cart operations may display availability.

However, Cart availability is not a reservation.

The authoritative reservation occurs during Checkout.

A product being available when added to the Cart does not guarantee availability later.

---

# 29. Checkout Integration

Checkout should call Inventory's public application interface for reservation.

The Checkout module must not directly update Inventory tables.

Example:

```text id="x7m3c8"
Checkout Service
      ↓
Inventory.reserve()
```

---

# 30. Payment Integration

Payment processing should not directly mutate Inventory.

Instead:

```text id="m8c4x7"
Payment / Checkout
      ↓
Successful Purchase
      ↓
Inventory Finalization
```

The Checkout/Order orchestration layer coordinates the transaction lifecycle.

---

# 31. Order Integration

Once the purchase is successfully completed, the corresponding reservation should be finalized.

The Order domain owns the Order record.

Inventory owns the stock movement.

---

# 32. Inventory Idempotency

Critical Inventory mutations must be safe against repeated execution.

Examples:

```text id="q5m8c4"
Reserve
Release
Finalize
Adjust
```

Repeated processing must not accidentally double-apply stock changes.

Unique operation identifiers or reservation state checks should enforce this.

---

# 33. Failure Handling

Inventory failures should distinguish:

```text id="v8m3c7"
Inventory Not Found
Insufficient Inventory
Reservation Conflict
Invalid Reservation State
Concurrency Conflict
Database Failure
```

Business failures should not be treated as infrastructure failures.

---

# 34. Inventory API

Typical merchant endpoint:

```text id="x4m8c7"
GET  /api/v1/inventory
POST /api/v1/inventory/:variantId/adjust
```

Reservation operations should normally remain internal application capabilities used by Checkout rather than arbitrary public inventory APIs.

---

# 35. Tenant Isolation

Every Inventory query and mutation must be Store-scoped.

For example:

```text id="m8c4x7"
store_id
+
variant_id
```

must be validated together.

A globally unique Variant ID does not remove the need for Store authorization.

---

# 36. Database Constraints

The database should enforce appropriate constraints:

```text id="q7m4c8"
store_id NOT NULL
variant_id NOT NULL
quantity >= 0
reserved_quantity >= 0
reserved_quantity <= quantity
valid foreign keys
unique Store/Variant inventory relationship
```

Exact constraints should follow the database schema specification.

---

# 37. Inventory Tests

Unit tests should cover:

```text id="v5m8c4"
[ ] Stock increase
[ ] Stock decrease
[ ] Invalid negative stock
[ ] Reservation
[ ] Insufficient stock
[ ] Release
[ ] Finalization
[ ] Expiration
[ ] Invalid state transitions
[ ] Idempotent operations
```

---

# 38. Concurrency Tests

Concurrency tests are mandatory.

At minimum verify:

```text id="x8m4c7"
Two concurrent reservations cannot oversell
Concurrent releases do not double-release
Concurrent finalization is safe
Concurrent adjustments preserve invariants
Deadlock retry behaves correctly
```

These tests should operate against PostgreSQL rather than relying exclusively on mocks.

---

# 39. Integration Tests

Verify:

```text id="m7c4x8"
[ ] Inventory persistence
[ ] Row locking
[ ] Conditional updates
[ ] Reservation persistence
[ ] Movement history
[ ] Store isolation
[ ] Transaction rollback
[ ] Constraint enforcement
```

---

# 40. Checkout Integration Tests

Test the complete interaction:

```text id="q8m3c7"
Cart
 ↓
Checkout
 ↓
Inventory Reservation
 ↓
Payment
 ↓
Order
 ↓
Inventory Finalization
```

Also test failure paths:

```text id="v4m8c7"
Checkout failure
Payment failure
Reservation failure
Reservation expiration
Cancellation
```

---

# 41. Background Job Integration

Reservation expiration should be executed through the Worker.

Verify:

```text id="x7m3c8"
Expired reservation
      ↓
Worker claims job
      ↓
Inventory release
      ↓
Reservation marked expired
```

Repeated Worker execution must remain safe.

---

# 42. Observability

Inventory operations should emit useful operational information.

Examples:

```text id="m8c4x7"
Inventory adjustment
Reservation failure
Reservation expiration
Finalization failure
Concurrency conflict
```

Do not log unnecessary customer or order data.

---

# 43. Inventory Events

Potential events:

```text id="q5m8c4"
InventoryAdjusted
InventoryReserved
InventoryReleased
InventoryFinalized
```

Events should represent completed facts.

Consumers must not assume an event is a substitute for the authoritative Inventory state.

---

# 44. Inventory Implementation Sequence

Implement in this order:

```text id="v8m3c7"
1. Define Inventory schema
2. Define Reservation schema
3. Define Movement schema
4. Create migrations
5. Implement Inventory repository
6. Implement locking primitives
7. Implement inventory domain model
8. Implement adjustment operation
9. Implement reservation operation
10. Implement release operation
11. Implement finalization operation
12. Implement expiration handling
13. Implement Inventory application services
14. Implement merchant inventory API
15. Integrate Checkout interface
16. Implement Inventory events
17. Add unit tests
18. Add integration tests
19. Add concurrency tests
20. Add idempotency tests
21. Add Worker expiration tests
22. Verify tenant isolation
```

---

# 45. Definition of Done

Inventory implementation is complete when:

```text id="x4m8c7"
[ ] Inventory schema exists
[ ] Reservation schema exists
[ ] Movement history exists
[ ] Inventory invariants are enforced
[ ] Adjustments are transactional
[ ] Reservations are concurrency-safe
[ ] Overselling is prevented
[ ] Releases are idempotent
[ ] Finalization is idempotent
[ ] Expiration works
[ ] Inventory is Store-scoped
[ ] Checkout integration works
[ ] Worker integration works
[ ] Inventory events work where required
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Concurrency tests pass
[ ] Idempotency tests pass
[ ] Tenant isolation tests pass
```

Inventory is complete only when the system can remain correct under **simultaneous reservations, retries, failures, and worker reprocessing**. Stock counts that are correct only when humans behave politely are not inventory management.