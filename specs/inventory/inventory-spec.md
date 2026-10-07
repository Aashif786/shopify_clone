# Inventory Specification

## 1. Purpose

This specification defines the functional and technical requirements for the Inventory domain of the Demo commerce platform.

The Inventory domain is responsible for:

- Inventory records
- Available quantity
- Reserved quantity
- Inventory adjustments
- Reservations
- Releases
- Inventory commitment
- Stock availability
- Concurrency-safe inventory mutations

Inventory is a critical correctness domain.

The system must prevent overselling and duplicate inventory effects even when multiple requests execute concurrently or are retried.

---

# 2. Scope

The Demo Inventory module must support:

- Inventory creation
- Inventory lookup
- Stock adjustment
- Stock availability
- Inventory reservation
- Inventory release
- Inventory commitment
- Inventory adjustment history
- Store-scoped inventory access
- Variant-level inventory
- Concurrency-safe mutations
- Idempotent inventory operations

The core model is:

```text id="m7x3q8"
ProductVariant
      ↓
InventoryItem
      ↓
Available / Reserved Quantity
      ↓
Adjustments / Reservations
```

---

# 3. Out of Scope

Demo does not include:

- Multiple warehouses
- Warehouse routing
- Advanced fulfillment allocation
- Purchase orders
- Supplier management
- Stock forecasting
- Demand planning
- Automated replenishment
- Safety stock calculations
- Batch/lot tracking
- Serial number tracking
- Expiry tracking
- Multi-location inventory
- Advanced inventory analytics
- Dedicated inventory service

These may be added later if business requirements justify them.

---

# 4. Domain Ownership

The Inventory module owns:

```text id="x4q8m2"
InventoryItem
InventoryAdjustment
InventoryReservation
```

The exact persistence entities may evolve, but the Inventory domain remains authoritative for stock state.

Products own:

```text id="n6m3v9"
Product
ProductVariant
SKU
Catalog Price
```

Inventory references ProductVariant identity but does not own it.

---

# 5. Inventory Item

An InventoryItem represents stock associated with a purchasable ProductVariant.

Conceptually:

```text id="p8x2m5"
InventoryItem
├── id
├── store_id
├── variant_id
├── available_quantity
├── reserved_quantity
├── created_at
└── updated_at
```

Each variant should normally have at most one active InventoryItem in Demo.

---

# 6. Inventory Invariants

The following invariants are mandatory:

1. Every inventory item belongs to exactly one store.
2. Every inventory item references a valid ProductVariant.
3. The variant belongs to the same store.
4. Available quantity cannot become negative unless negative inventory is explicitly supported.
5. Reserved quantity cannot become negative.
6. Inventory mutations must be atomic.
7. Concurrent reservations must not oversell stock.
8. Inventory operations must be idempotent where retries are possible.
9. Every material stock change should have an auditable adjustment or reservation record.
10. Inventory must remain consistent with the operations that consume or release it.

---

# 7. Quantity Model

Demo uses:

```text id="q5m8x3"
available_quantity
reserved_quantity
```

Conceptually:

```text id="v7n2m6"
Total managed stock
        =
available_quantity
+
reserved_quantity
```

The exact meaning of total stock depends on the operation model.

The system must document and consistently apply the chosen semantics.

---

# 8. Available Quantity

Available quantity represents stock that can currently be reserved for purchase.

Example:

```text id="x3m7q9"
Available = 20
Reserved  = 5
```

A new reservation may consume from the available quantity.

---

# 9. Reserved Quantity

Reserved quantity represents stock temporarily allocated to an active business operation.

Example:

```text id="r8q2m5"
Available = 15
Reserved  = 5
```

The reserved units are not available for another checkout.

---

# 10. Inventory Reservation

A reservation associates inventory with a business operation such as:

```text id="n6x3m8"
Checkout
Order
Reservation reference
```

The reservation must have enough information to prevent duplicate reservation effects.

Conceptually:

```text id="p4m8q2"
InventoryReservation
├── inventory_item_id
├── reference_type
├── reference_id
├── quantity
├── status
├── created_at
└── updated_at
```

---

# 11. Reservation States

Reservations may use:

```text id="j7x3m9"
ACTIVE
RELEASED
COMMITTED
```

Lifecycle:

```text id="v5m8q2"
ACTIVE
  ├── release ──► RELEASED
  └── commit ───► COMMITTED
```

A released or committed reservation must not be released or committed again.

---

# 12. Inventory Creation

Inventory should be initialized when a purchasable variant requires stock tracking.

Example:

```text id="q8m3x6"
Create Variant
      ↓
Create InventoryItem
```

Alternatively, inventory may be created lazily when inventory management begins.

The chosen implementation must remain consistent.

---

# 13. Inventory Initialization

Initial quantity may be:

```text id="x6q2m8"
0
```

or a merchant-provided starting quantity.

If a starting quantity is supplied, the operation should create an appropriate inventory adjustment record.

---

# 14. Inventory Adjustment

Merchants may adjust stock.

Examples:

```text id="m4x8q3"
+50 units
-5 units
```

Reasons may include:

```text id="n7p3v9"
INITIAL_STOCK
RESTOCK
MANUAL_CORRECTION
DAMAGED
LOST
RETURNED
OTHER
```

The Demo reason set should remain small.

---

# 15. Adjustment Flow

```text id="r5x2m8"
Merchant
  ↓
Authenticate
  ↓
Resolve Store
  ↓
Authorize Inventory Operation
  ↓
Validate Variant
  ↓
Load Inventory
  ↓
Lock Inventory Row
  ↓
Validate Adjustment
  ↓
Update Quantity
  ↓
Create Adjustment Record
  ↓
Commit
```

The quantity change and history record must occur in the same transaction.

---

# 16. Negative Adjustments

A negative adjustment must not normally reduce available stock below zero.

Example:

```text id="q8m3x7"
Available = 5

Adjustment = -10
```

should fail unless the platform explicitly supports negative inventory.

Demo should reject the operation.

---

# 17. Reservation Flow

A reservation must atomically:

```text id="m5x8q2"
check available quantity
      ↓
reduce available quantity
      ↓
increase reserved quantity
      ↓
create reservation
```

Conceptually:

```text id="v7n3q9"
Available: 10
Reserved: 0

Reserve 4

Available: 6
Reserved: 4
```

---

# 18. Reservation Concurrency

The reservation operation is concurrency-critical.

Example:

```text id="x4m8q6"
Available = 5

Checkout A requests 4
Checkout B requests 4
```

Only one request may successfully reserve four units.

The system must not perform:

```text id="p6q3n8"
SELECT available_quantity
```

followed later by an unlocked update.

The check and mutation must be atomic.

---

# 19. Row-Level Locking

The normal Demo implementation should use PostgreSQL row-level locking where appropriate.

Conceptually:

```text id="n8m3x5"
BEGIN

SELECT inventory
FOR UPDATE

validate quantity
update inventory
create reservation

COMMIT
```

The exact query and repository implementation belong in the Inventory module.

---

# 20. Atomic Update Alternative

For simple stock operations, an atomic conditional update may be used.

Conceptually:

```text id="q3x7m9"
UPDATE inventory
SET available_quantity = available_quantity - requested
WHERE id = ?
  AND available_quantity >= requested
```

The affected row count determines whether the reservation succeeded.

The implementation must guarantee equivalent correctness.

---

# 21. Reservation Idempotency

A retry must not create a second reservation.

Example:

```text id="m8q2x4"
Checkout A
Reserve 3
Request times out
Client retries
```

The second request must recognize the existing reservation.

The reservation reference should be uniquely identifiable.

---

# 22. Reservation Release

Release occurs when reserved stock is returned to availability.

Conceptually:

```text id="v6m3x8"
Reserved: 4
Available: 6

Release 4

Reserved: 0
Available: 10
```

The release must be atomic.

---

# 23. Release Idempotency

If the same release operation is executed twice:

```text id="q7x2m5"
First release → success
Second release → no duplicate quantity restoration
```

The reservation state must protect against double release.

---

# 24. Reservation Commitment

Commitment finalizes reserved inventory.

Conceptually:

```text id="n4m8x3"
Reserved: 4
Available: 6

Commit 4

Reserved: 0
Available: 6
```

The reserved quantity is consumed.

The operation must only apply to an active reservation.

---

# 25. Commit Idempotency

A committed reservation cannot be committed again.

A retry of the original successful request should return the existing successful result rather than consuming additional inventory.

---

# 26. Inventory Adjustment vs Reservation

These are different business operations.

### Adjustment

Merchant changes inventory quantity.

```text id="x8m3q6"
+20 stock
-5 damaged
```

### Reservation

Commerce workflow temporarily allocates available stock.

```text id="p5q7n2"
Reserve 2 for checkout
```

They must not be represented as interchangeable operations.

---

# 27. Inventory Availability Query

The module should expose a read operation such as:

```text id="m7x2q8"
getAvailability(variantId)
```

Possible response:

```json id="g5k3f2"
{
  "available": 12,
  "reserved": 3,
  "isAvailable": true
}
```

The exact response shape belongs to the application/API layer.

---

# 28. Storefront Availability

The storefront may display:

```text id="q8m4x3"
In stock
Out of stock
Limited availability
```

The exact merchandising representation is a presentation concern.

It must not replace the authoritative inventory check at checkout.

---

# 29. Inventory and Cart

Cart operations may perform an informational availability check.

However:

```text id="x5m8q2"
Cart availability ≠ guaranteed stock
```

Stock may change before checkout.

Final inventory correctness belongs to checkout/inventory coordination.

---

# 30. Inventory and Checkout

Checkout must request an authoritative reservation or consumption operation.

The checkout workflow must not directly update inventory tables.

Correct:

```text id="v3q7m9"
Checkout
  ↓
Inventory.reserve()
```

Incorrect:

```text id="n8x2m5"
Checkout
  ↓
UPDATE inventory_items
```

---

# 31. Inventory and Order

Orders reference inventory-consuming business results.

The Orders module must not own stock quantities.

Order cancellation may request:

```text id="q4m8x2"
Inventory.release()
```

where the business workflow requires it.

---

# 32. Inventory and Product

Products own variant identity.

Inventory owns quantity.

The Inventory module should validate that a referenced variant belongs to the expected store.

The Inventory module must not modify Product data.

---

# 33. Inventory and Store Lifecycle

Inventory operations must respect store lifecycle.

For example:

```text id="m6x3q8"
ARCHIVED Store
    ↓
No new inventory reservations
```

Existing historical inventory records remain available as required.

---

# 34. Inventory History

Every merchant stock adjustment should create a historical record.

Example:

```text id="p7x2m9"
InventoryAdjustment
├── quantity_delta
├── reason
├── actor_id
├── reference
└── created_at
```

This provides an audit trail for stock changes.

---

# 35. Adjustment References

An adjustment may reference:

- manual operation
- order
- return
- system operation

The reference must not be used to bypass ownership or authorization.

---

# 36. Inventory Auditability

A merchant should be able to understand:

```text id="x3m8q5"
Current Stock
      ↓
Why did it change?
      ↓
Adjustment History
```

History should identify the relevant actor/system source and reason.

---

# 37. Inventory Correction

If inventory becomes inconsistent due to an operational issue, a controlled adjustment should be used.

The system should not encourage administrators to directly edit database quantities.

Direct production database modification bypasses:

- history
- authorization
- concurrency
- auditability

---

# 38. Inventory Idempotency Records

Critical inventory operations should be identifiable by a stable business reference.

Examples:

```text id="q6m3x8"
checkout_id
reservation_id
order_id
operation_id
```

The exact mechanism may use dedicated idempotency records or unique reservation references.

---

# 39. Multi-Variant Reservation

A checkout may contain multiple variants.

Example:

```text id="m8x2q5"
Variant A → 2
Variant B → 1
Variant C → 4
```

The system must reserve all required inventory consistently.

---

# 40. Multi-Variant Lock Ordering

When multiple inventory rows must be locked, they should be locked in deterministic order.

For example:

```text id="v4q8n2"
sort inventory IDs
        ↓
lock in sorted order
        ↓
validate all quantities
        ↓
apply changes
```

This reduces deadlock risk.

---

# 41. Partial Reservation Failure

If a checkout requires:

```text id="x7m3q9"
A = 2
B = 5
C = 1
```

and C is unavailable, the system must not leave:

```text id="p8q2m6"
A reserved
B reserved
C failed
```

unless a deliberate partial reservation model exists.

Demo should use atomic reservation for a checkout-level inventory operation.

---

# 42. Transaction Boundary

A multi-item inventory reservation should use a transaction where the business operation requires atomicity.

Conceptually:

```text id="n5m8x3"
BEGIN

lock A
lock B
lock C

validate all
reserve all

COMMIT
```

If any required reservation fails:

```text id="q4x7m2"
ROLLBACK
```

---

# 43. Inventory Failure Scenarios

The system must handle:

### Insufficient stock

Return a business error.

### Duplicate reservation

Return/reuse the existing reservation result.

### Release after commit

Reject or safely treat as already finalized.

### Commit after release

Reject.

### Unknown reservation

Return not found/business error.

### Concurrent reservation

Only valid requests may succeed.

---

# 44. Inventory State Errors

Examples:

```text id="m8q3x7"
INSUFFICIENT_INVENTORY
INVENTORY_NOT_FOUND
INVALID_RESERVATION
RESERVATION_ALREADY_RELEASED
RESERVATION_ALREADY_COMMITTED
RESERVATION_NOT_ACTIVE
INVALID_INVENTORY_ADJUSTMENT
CROSS_STORE_INVENTORY_ACCESS
```

Errors should remain domain-level concepts.

---

# 45. Inventory API

Conceptual merchant endpoints:

```text id="x7m4q2"
GET /stores/{storeId}/inventory
GET /stores/{storeId}/inventory/{variantId}
POST /stores/{storeId}/inventory/{variantId}/adjust
GET /stores/{storeId}/inventory/{variantId}/history
```

Checkout-facing application interfaces may include:

```text id="p5n8m3"
reserve()
release()
commit()
getAvailability()
```

These internal interfaces do not automatically become public APIs.

---

# 46. Inventory Adjustment Request

Example:

```json id="9cbf20"
{
  "quantity": 25,
  "reason": "RESTOCK",
  "note": "Initial warehouse stock"
}
```

The API must distinguish positive and negative adjustments according to the defined contract.

---

# 47. Inventory Reservation Interface

Conceptually:

```text id="r3m7x8"
reserveInventory({
  storeId,
  variantId,
  quantity,
  referenceType,
  referenceId
})
```

The service must:

1. Validate tenant context.
2. Validate variant.
3. Load inventory.
4. Lock/atomically update inventory.
5. Validate available quantity.
6. Create reservation.
7. Commit.

---

# 48. Inventory Release Interface

Conceptually:

```text id="v8q2m4"
releaseInventory({
  reservationId,
  referenceId
})
```

The service must:

- validate ownership
- verify active reservation
- restore available quantity
- reduce reserved quantity
- mark reservation released
- remain idempotent

---

# 49. Inventory Commit Interface

Conceptually:

```text id="m6x3q9"
commitInventory({
  reservationId,
  referenceId
})
```

The service must:

- validate reservation
- verify active state
- reduce reserved quantity
- mark reservation committed
- remain idempotent

---

# 50. Authorization

Merchant inventory operations require appropriate StoreMembership permissions.

Typical permissions:

| Operation | Owner | Admin | Staff | Customer |
|---|---:|---:|---:|---:|
| View inventory | Yes | Yes | Yes | No |
| Adjust inventory | Yes | Yes | Yes | No |
| View inventory history | Yes | Yes | Yes | No |
| Reserve inventory | System | System | System | No |
| Release inventory | System | System | System | No |
| Commit inventory | System | System | System | No |

System operations must still validate tenant and business context.

---

# 51. Tenant Isolation

Every inventory operation must verify:

```text id="q8m3x5"
Inventory.store_id
=
Expected Store ID
```

The associated ProductVariant must also belong to the same Store.

Cross-store inventory operations must fail.

---

# 52. Security

The Inventory module must:

- enforce authorization
- validate quantities
- validate identifiers
- prevent cross-store access
- prevent client-controlled inventory state
- protect inventory history
- avoid exposing internal operational metadata unnecessarily

---

# 53. Performance

Demo inventory operations should rely on:

- primary-key lookup
- store-scoped indexes
- variant lookup indexes
- transactional row locking
- bounded history queries

Inventory operations should remain short-lived.

---

# 54. Caching

Inventory availability may be cached for display purposes in the future.

However:

```text id="x4m8q2"
Cache availability
      ≠
authoritative stock
```

Reservations and commits must always use the authoritative PostgreSQL state.

Demo does not require an inventory cache.

---

# 55. Background Processing

Inventory may participate in background jobs for:

- reservation expiry
- reconciliation
- cleanup

A background job must call the Inventory application service rather than modifying inventory records directly.

Example:

```text id="n7q3m8"
ReservationExpiryJob
  ↓
Inventory.release()
```

---

# 56. Reservation Expiration

If Demo implements reservation expiration, the reservation should contain an expiration timestamp.

Example:

```text id="m5x8q2"
expires_at
```

A worker may identify expired active reservations and release them.

The release operation must be idempotent.

---

# 57. Concurrency Testing

Critical tests must simulate:

```text id="q8m3x6"
10 units available

Request A → reserve 7
Request B → reserve 7
```

Expected:

```text id="v4m7x2"
One succeeds
One fails
```

Not:

```text id="p6x3n8"
Both succeed
```

---

# 58. Race Condition Tests

Tests should cover:

- concurrent reservations
- concurrent releases
- concurrent commits
- adjustment vs reservation
- duplicate requests
- retry after timeout
- multiple variants in one checkout
- reservation expiration vs checkout completion

---

# 59. Database Constraints

The database should enforce where practical:

- unique inventory per variant
- valid foreign keys
- non-negative quantities
- valid store relationships
- unique reservation references

Application validation remains necessary, but the database is the final integrity boundary.

---

# 60. Integration Tests

Integration tests should verify:

- inventory creation
- stock adjustment
- adjustment history
- reservation
- release
- commitment
- idempotency
- transaction rollback
- cross-store protection
- concurrent reservation
- multi-variant atomicity

---

# 61. E2E Inventory Flow

At minimum:

```text id="x3m8q7"
Merchant Login
    ↓
Create Product
    ↓
Create Variant
    ↓
Set Inventory = 10
    ↓
Open Storefront
    ↓
Add Variant to Cart
    ↓
Checkout
    ↓
Reserve/Consume Inventory
    ↓
Order Created
    ↓
Verify Inventory
```

The test must verify that inventory changes exactly once.

---

# 62. Inventory and Failed Checkout

If checkout fails before inventory commitment:

```text id="m7q2x8"
Reservation
    ↓
Checkout Failure
    ↓
Release Reservation
```

The release must restore the inventory correctly.

---

# 63. Inventory and Successful Checkout

Successful checkout should result in:

```text id="v8m3q5"
Reserved
    ↓
Committed
```

The final quantity must reflect the completed purchase exactly once.

---

# 64. Inventory and Payment Failure

If payment fails after inventory has been reserved:

```text id="q5x7n2"
Reservation
    ↓
Payment Failure
    ↓
Release Reservation
```

The system must not leave stock permanently reserved because a payment attempt failed.

---

# 65. Inventory and Payment Ambiguity

If payment status is uncertain:

```text id="m4x8q3"
Payment = PROCESSING
```

the system must not blindly release inventory if doing so could permit an inconsistent completed purchase.

The checkout/payment orchestration must define the correct recovery path.

---

# 66. Inventory and Order Cancellation

When an eligible order is cancelled:

```text id="x7m2q8"
Order Cancellation
    ↓
Inventory Release/Restock
```

The exact operation depends on whether the original inventory was still reserved or had already been committed.

The same stock must never be restored twice.

---

# 67. Historical Inventory Data

Inventory history should remain available even when:

- a Product is archived
- a Variant is archived
- a Store is archived

Historical records must preserve enough references to explain the stock movement.

---

# 68. Demo Implementation Boundary

The Demo implementation should use:

```text id="p3m8x2"
modules/inventory
packages/db
packages/tenant
packages/validation
```

Inventory business rules belong in:

```text id="q7x4n9"
modules/inventory
```

The web layer must not directly modify inventory records.

---

# 69. Demo-to-V1 Evolution

The Inventory domain should support future additions such as:

- multiple warehouses
- inventory locations
- stock transfers
- fulfillment allocation
- purchase orders
- replenishment
- reservation policies
- safety stock
- inventory forecasting

These should extend the domain model without weakening the existing correctness guarantees.

---

# 70. Acceptance Criteria

The Inventory module is complete for Demo when:

- Every inventory item belongs to one store.
- Inventory is associated with a valid ProductVariant.
- Variant and inventory store ownership cannot conflict.
- Merchants can adjust stock.
- Inventory adjustments are recorded.
- Available quantity cannot become negative.
- Reservations reduce available quantity atomically.
- Reservations increase reserved quantity atomically.
- Reservations are idempotent.
- Reservations can be released safely.
- Reservations can be committed safely.
- Release and commit cannot both consume the same reservation.
- Concurrent reservations cannot oversell stock.
- Multi-item reservations are atomic where required.
- Inventory operations are tenant-aware.
- Checkout uses Inventory interfaces rather than direct table mutation.
- Failed checkout can safely release reservations.
- Successful checkout commits inventory exactly once.
- Historical inventory changes remain auditable.
- Database constraints reinforce inventory invariants.
- Integration and concurrency tests cover critical paths.
- Inventory remains the authoritative source of stock availability.