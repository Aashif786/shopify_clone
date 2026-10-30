# Inventory Implementation Specification

## 1. Purpose

This document defines the implementation requirements for the **Inventory** domain of the Cal Cart commerce platform.

The Inventory module is responsible for authoritative stock quantities, inventory adjustments, reservations, releases, and inventory-related concurrency control.

Inventory is a critical commerce domain. Incorrect inventory behavior can result in overselling, negative stock, inconsistent checkout state, and incorrect order fulfillment data.

---

## 2. Scope

The Inventory module owns:

- Inventory records.
- Available quantity.
- Reserved quantity where applicable.
- Inventory adjustments.
- Inventory reservations.
- Reservation release.
- Reservation finalization.
- Inventory movement/history.
- Stock availability checks.
- Concurrency control for inventory mutations.

The module does not own:

- Product catalog information.
- Carts.
- Checkout.
- Orders.
- Payments.
- Customers.
- Shipping.
- Storefront presentation.

Those domains interact with Inventory through explicit interfaces.

---

## 3. Domain Position

The core relationship is:

```text id="8h3m4v"
Store
  ↓
Product
  ↓
Variant
  ↓
Inventory
```

Inventory is associated with a specific Store and purchasable Variant.

---

## 4. Module Location

The implementation belongs under:

```text id="a7k3p9"
modules/inventory/
```

Recommended structure:

```text id="q8m2c4"
modules/inventory/
├── application/
├── domain/
├── infrastructure/
└── index.ts
```

The module's public interface should be exposed through its module entry point.

---

## 5. Core Principle

PostgreSQL is the authoritative source of inventory state.

The application must never rely on:

- Browser state.
- Cached quantities.
- Client-provided stock.
- Stale storefront data.

for authoritative inventory decisions.

---

## 6. Inventory Entity

Conceptually:

```text id="m4r7x1"
Inventory
├── id
├── storeId
├── variantId
├── availableQuantity
├── reservedQuantity
├── createdAt
└── updatedAt
```

The exact schema may evolve according to the database implementation.

---

## 7. Quantity Model

The Demo should maintain a clear distinction between:

```text id="x2c8v5"
Available Quantity
Reserved Quantity
```

Conceptually:

```text id="j5n9q2"
Total Stock
   =
Available
+
Reserved
```

If the implementation uses a different quantity model, the invariant must remain explicit.

---

## 8. Non-Negative Quantities

Inventory quantities must not become negative unless a deliberate overselling policy is explicitly implemented.

For the Demo:

```text id="r3k7m1"
availableQuantity >= 0
reservedQuantity >= 0
```

must be enforced through application logic and appropriate database constraints.

---

## 9. Inventory Creation

Inventory should be initialized when a purchasable Variant requires stock tracking.

Example:

```text id="v6p2x9"
Variant created
     ↓
Inventory record initialized
     ↓
Quantity configured
```

Inventory creation must occur within the correct Store context.

---

## 10. Inventory Ownership

Inventory belongs to the Store.

A Variant reference alone must not be sufficient to bypass Store authorization.

The system must verify:

```text id="c4m8t2"
Variant
   ↓
Product
   ↓
Store
   ↓
Authorized context
```

---

## 11. Inventory Adjustment

Merchants may adjust inventory through an explicit operation.

Examples:

```text id="q7x2n5"
Receive stock
Increase stock
Decrease stock
Correction
```

The operation should record the reason where the domain requires auditability.

---

## 12. Adjustment Semantics

An adjustment must define whether the operation means:

### Set

```text id="g5m1r8"
Set quantity = 20
```

or:

### Delta

```text id="z8q4p6"
Increase by 5
Decrease by 3
```

The implementation must not ambiguously mix the two semantics.

---

## 13. Inventory Movement

Important adjustments should produce an inventory movement/history record.

Conceptually:

```text id="f3n7k2"
Inventory
   ↓
Adjustment
   ↓
Inventory Movement
```

The movement should preserve enough information to understand how the quantity changed.

Possible fields include:

- Movement ID.
- Inventory ID.
- Quantity delta.
- Reason.
- Reference.
- Actor.
- Timestamp.

---

## 14. Historical Inventory Data

Inventory movement history should not be rewritten merely because the current quantity changes.

For example:

```text id="s6p9d3"
+50 received
-10 sold
+5 correction
```

should remain auditable even though the current available quantity is different.

---

## 15. Inventory Reservation

Reservations temporarily hold stock for a business operation such as checkout.

Conceptually:

```text id="k2m8v4"
Available
   ↓
Reserve
   ↓
Reserved
```

A reservation should have:

- Reservation identity.
- Store.
- Variant.
- Quantity.
- Status.
- Reference to the owning checkout/cart/order operation where required.
- Created time.
- Expiration/release information where applicable.

---

## 16. Reservation States

A practical state model is:

```text id="n5x7c1"
ACTIVE
RELEASED
FINALIZED
EXPIRED
```

The exact states must match the checkout lifecycle.

---

## 17. Reservation Creation

Reservation creation must be concurrency-safe.

The system must guarantee that two concurrent checkouts cannot both successfully reserve stock that only one of them can consume.

---

## 18. Inventory Reservation Algorithm

The implementation may use row locking or an atomic conditional update.

Conceptually:

```text id="p8r4y6"
BEGIN
   ↓
Lock inventory row
   ↓
Check available quantity
   ↓
Decrease available
   ↓
Increase reserved
   ↓
Create reservation
   ↓
COMMIT
```

The transaction must remain short.

---

## 19. Insufficient Inventory

If insufficient stock exists:

```text id="w3q7m9"
available < requested
```

the reservation must fail without partially changing inventory.

The API/application should return a stable business error such as:

```text id="v9c2x5"
INSUFFICIENT_INVENTORY
```

---

## 20. Multi-Item Reservations

A checkout may require multiple variants.

Example:

```text id="h6n4p8"
Variant A → quantity 2
Variant B → quantity 1
Variant C → quantity 4
```

The reservation operation should be atomic when the business workflow requires all-or-nothing reservation.

---

## 21. Multi-Item Lock Ordering

When multiple inventory records must be locked:

1. Determine all inventory records.
2. Sort them deterministically.
3. Acquire locks in that order.
4. Validate quantities.
5. Apply changes.
6. Commit.

This reduces deadlock risk.

---

## 22. Reservation Release

A reservation may be released when:

- Checkout is abandoned.
- Checkout expires.
- Payment fails.
- Order creation fails where applicable.
- An authorized cancellation occurs.

Release should be idempotent.

---

## 23. Reservation Release Semantics

Releasing an active reservation should:

```text id="b8m2q5"
Reserved -= quantity
Available += quantity
Reservation → RELEASED
```

The operation must not release the same reservation twice.

---

## 24. Reservation Finalization

When an order successfully consumes reserved inventory:

```text id="r7x3k9"
Reserved
   ↓
Finalized
```

The reserved quantity should no longer remain available for release.

The exact accounting depends on the chosen inventory model.

---

## 25. Reservation Expiration

If reservations have an expiration period, the system must persist the expiration time.

A worker may process expired reservations.

Example:

```text id="c5p8n1"
Reservation expires
      ↓
Worker
      ↓
Release reservation
```

Expiration processing must be idempotent.

---

## 26. Inventory Adjustment vs Reservation

These operations must remain conceptually separate.

### Adjustment

Changes stock based on a merchant/system inventory event.

### Reservation

Temporarily allocates existing stock to a transaction.

Do not implement reservations as unexplained inventory adjustments.

---

## 27. Order Interaction

Inventory interacts with Orders through explicit application interfaces.

Typical lifecycle:

```text id="y6m4r8"
Checkout
   ↓
Reserve inventory
   ↓
Payment
   ↓
Order created
   ↓
Finalize reservation
```

If the business workflow fails before finalization, the reservation must be released where appropriate.

---

## 28. Cart Interaction

The Cart module may request availability information.

Cart availability is not a permanent reservation unless the domain explicitly defines it.

The system must not reserve inventory simply because an item was added to a cart unless that behavior is deliberately implemented.

---

## 29. Checkout Interaction

Checkout is responsible for coordinating inventory reservation as part of the checkout workflow.

Inventory remains responsible for:

- Quantity correctness.
- Reservation.
- Release.
- Finalization.

Checkout must not directly manipulate inventory tables.

---

## 30. Product Interaction

Products own Variant identity.

Inventory owns stock state.

The Inventory module should retrieve or validate Variant ownership through a public Products interface rather than directly manipulating Product internals.

---

## 31. Inventory Availability Query

The module should expose a read operation for authoritative availability.

Conceptually:

```text id="m7q3v5"
getAvailability(
  storeId,
  variantId
)
```

The result must reflect current authoritative inventory state.

---

## 32. Inventory APIs

Merchant-facing APIs may include:

```text id="f8x2n6"
GET  /api/v1/inventory
GET  /api/v1/inventory/{variantId}
POST /api/v1/inventory/{variantId}/adjust
GET  /api/v1/inventory/{variantId}/movements
```

Reservation operations may remain application-internal rather than public merchant APIs.

---

## 33. Authorization

Inventory operations require explicit permissions.

Examples:

```text id="k4m7p2"
inventory.read
inventory.adjust
inventory.manage
```

The exact permission names follow the authorization model.

Public customers must never be able to adjust inventory.

---

## 34. Tenant Isolation

Every Inventory operation must enforce Store isolation.

Example:

```text id="z5n8c3"
Store A user
   ↓
Store B inventory
   ↓
Denied
```

This applies to:

- Reads.
- Adjustments.
- Reservations.
- Releases.
- Movement history.

---

## 35. Concurrency

Concurrency correctness is a primary Inventory requirement.

The implementation must protect against:

```text id="u8q3m5"
Overselling
Negative stock
Double reservation
Double release
Double finalization
Lost updates
```

---

## 36. Database Constraints

The database should enforce appropriate invariants.

Potential constraints include:

```text id="g4p9x2"
available_quantity >= 0
reserved_quantity >= 0
unique(store_id, variant_id)
```

The exact constraints depend on the final inventory model.

---

## 37. Transactions

Inventory mutations must occur inside transactions.

Examples:

- Adjustment.
- Reservation.
- Release.
- Finalization.

A transaction should include all database writes necessary for that atomic inventory operation.

---

## 38. External Calls

Inventory transactions must not hold database locks while waiting for external services.

For example:

```text id="v2m6r9"
BEGIN
  ↓
Lock inventory
  ↓
External payment API
  ↓
COMMIT
```

is prohibited.

Checkout/payment orchestration must separate external calls from inventory database transactions.

---

## 39. Idempotency

Inventory operations that can be retried must have explicit idempotency behavior.

Examples:

- Inventory adjustment.
- Reservation creation.
- Reservation release.
- Reservation finalization.

An operation that increments stock must not increment it twice because of a client or worker retry.

---

## 40. Inventory Adjustment Idempotency

For a delta adjustment:

```text id="c7x4m8"
+10 units
```

a retry must not produce:

```text id="a3p9v1"
+20 units
```

The operation should use an explicit idempotency identity or unique reference.

---

## 41. Reservation Idempotency

Repeated reservation requests for the same logical checkout operation must not create duplicate reservations.

The implementation should associate reservations with an appropriate business reference.

---

## 42. Release Idempotency

Repeated release requests must not restore the same inventory twice.

For example:

```text id="f2m7q4"
Reservation quantity = 5

Release
  ↓
Available +5

Release again
  ↓
No additional change
```

---

## 43. Finalization Idempotency

Repeated finalization must not consume the same reservation twice.

The reservation state transition should enforce:

```text id="s8n4c2"
ACTIVE → FINALIZED
```

while rejecting or safely ignoring:

```text id="e5p1x7"
FINALIZED → FINALIZED
```

according to the operation contract.

---

## 44. Events

The Inventory module may emit events such as:

```text id="r3m8k6"
InventoryAdjusted
InventoryReserved
InventoryReleased
InventoryFinalized
InventoryReservationExpired
```

Events should represent completed facts.

---

## 45. Event Consumers

Potential consumers include:

- Notifications.
- Orders.
- Checkout.
- Monitoring.
- Future analytics.

Consumers must not directly manipulate Inventory tables.

---

## 46. Background Jobs

Inventory-related background jobs may include:

- Reservation expiration.
- Stale reservation recovery.
- Inventory reconciliation where required.

Jobs must be:

- Idempotent.
- Tenant-aware.
- Retry-safe.

---

## 47. Reservation Expiration Worker

A worker may periodically find expired reservations:

```text id="w4c8n2"
Find expired ACTIVE reservations
        ↓
Claim reservation
        ↓
Release inventory
        ↓
Mark EXPIRED
```

Concurrent workers must not release the same reservation twice.

---

## 48. Inventory Reconciliation

A reconciliation mechanism may compare:

```text id="n7p3x5"
Inventory state
+
Reservation state
+
Order state
```

to identify inconsistencies.

This should be introduced only where operational requirements justify it.

---

## 49. Auditability

Inventory adjustments should be auditable.

Important information may include:

- Actor.
- Store.
- Variant.
- Quantity delta.
- Reason.
- Reference.
- Timestamp.

The audit record must not be editable through ordinary inventory operations.

---

## 50. API Error Codes

Potential error codes include:

```text id="x4q8m1"
INVENTORY_NOT_FOUND
INSUFFICIENT_INVENTORY
INVALID_INVENTORY_ADJUSTMENT
RESERVATION_NOT_FOUND
RESERVATION_ALREADY_RELEASED
RESERVATION_ALREADY_FINALIZED
INVENTORY_CONFLICT
INVENTORY_ACCESS_DENIED
```

---

## 51. Testing Strategy

### Unit Tests

Test:

- Quantity invariants.
- Reservation state transitions.
- Adjustment validation.
- Release rules.
- Finalization rules.

### Integration Tests

Test:

- PostgreSQL persistence.
- Constraints.
- Transactions.
- Row locking.
- Concurrent reservations.
- Multi-item reservation.
- Idempotency.
- Tenant isolation.

### API Tests

Test:

- Authentication.
- Authorization.
- Inventory reads.
- Adjustments.
- Pagination.
- Error contract.

### E2E Tests

Test:

- Merchant adjusts stock.
- Customer checkout reserves stock.
- Successful purchase consumes stock.
- Failed checkout releases reservation.
- Concurrent customers cannot oversell.

---

## 52. Critical Concurrency Tests

At minimum:

```text id="m9k4x2"
[ ] Two requests reserve one available unit
[ ] Only one succeeds
[ ] Inventory never becomes negative
[ ] Two requests release the same reservation
[ ] Inventory is restored only once
[ ] Two workers process the same expiration candidate
[ ] Reservation expires only once
[ ] Two concurrent adjustments preserve correctness
[ ] Multi-item reservation is atomic
[ ] Deadlock-prone operations use deterministic lock ordering
```

---

## 53. Critical Business Tests

```text id="b6p2v9"
[ ] Inventory record belongs to correct Store
[ ] Variant belongs to correct Store
[ ] Unauthorized adjustment is rejected
[ ] Cross-tenant inventory access is rejected
[ ] Negative quantity is rejected
[ ] Duplicate inventory record is prevented
[ ] Inventory movement is recorded
[ ] Reservation creates correct quantity changes
[ ] Release restores correct quantity
[ ] Finalization consumes reservation correctly
[ ] Expired reservation is recoverable
```

---

## 54. Database Indexing

Likely access patterns include:

```text id="t8x5n3"
store_id
variant_id
store_id + variant_id
reservation status + expires_at
inventory movement inventory_id + created_at
```

Indexes should be based on actual query patterns.

---

## 55. Implementation Sequence

Recommended implementation order:

```text id="q3m7v8"
1. Define Inventory domain model
2. Define quantity invariants
3. Define reservation state machine
4. Define database schema
5. Create migrations
6. Implement inventory repository
7. Implement adjustment service
8. Implement reservation service
9. Implement release service
10. Implement finalization service
11. Implement authorization
12. Implement APIs
13. Implement worker expiration processing
14. Add idempotency
15. Add unit tests
16. Add integration/concurrency tests
17. Add API tests
18. Add E2E checkout coverage
```

---

## 56. Demo Simplifications

The Demo intentionally does not require:

- Multi-warehouse inventory.
- Advanced warehouse routing.
- Distributed inventory ledgers.
- Complex fulfillment networks.
- Demand forecasting.
- Purchase-order management.
- Supplier synchronization.
- Advanced stock replenishment.
- Multi-region inventory replication.

The Demo must still provide correct single-store inventory behavior.

---

## 57. V1 Evolution

The Inventory module should support future expansion into:

- Multiple locations.
- Warehouses.
- Inventory transfers.
- Safety stock.
- Backorders.
- Fulfillment allocation.
- Stock forecasting.
- Supplier integrations.
- Advanced inventory reconciliation.

The current module boundary should remain stable while implementation capabilities expand.

---

## 58. Definition of Done

The Inventory implementation is complete when:

```text id="k5r8x3"
[ ] Inventory entity exists
[ ] Variant relationship exists
[ ] Store ownership is enforced
[ ] Available quantity is authoritative
[ ] Reserved quantity is modeled
[ ] Quantity invariants are enforced
[ ] Inventory adjustments exist
[ ] Inventory movement history exists
[ ] Reservations exist
[ ] Reservation release exists
[ ] Reservation finalization exists
[ ] Reservation expiration exists where required
[ ] Concurrency control is implemented
[ ] Multi-item reservation is atomic
[ ] Idempotency is implemented
[ ] Tenant isolation is enforced
[ ] Authorization is enforced
[ ] Database constraints exist
[ ] Appropriate indexes exist
[ ] Worker processing is safe
[ ] Unit tests exist
[ ] Integration tests exist
[ ] Concurrency tests exist
[ ] API tests exist
[ ] E2E checkout coverage exists
[ ] Documentation matches implementation
```