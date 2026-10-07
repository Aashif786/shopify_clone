# Inventory Vertical Slice Build Implementation

## 1. Purpose

This document defines the implementation of the Inventory vertical slice for the Demo.

The Inventory slice establishes the complete merchant inventory workflow and proves that inventory remains authoritative, Store-scoped, concurrency-safe, and correctly integrated with Products and Checkout.

The central flow is:

```text
Merchant
  ↓
Published Product / Variant
  ↓
Inventory Record
  ↓
Stock Adjustment
  ↓
Available Quantity
  ↓
Customer Cart / Checkout
  ↓
Reservation
  ↓
Finalization or Release
```

The implementation must prevent overselling and must never rely on frontend quantities as inventory authority.

---

# 2. Slice Objective

The completed slice must allow a merchant to:

- View inventory for Product Variants.
- Set or adjust stock.
- View available quantity.
- View reserved quantity where appropriate.
- Track inventory movements.
- See inventory reflected in the customer purchase flow.
- Reserve stock during Checkout.
- Release or finalize reservations correctly.

---

# 3. Dependencies

This slice depends on:

```text id="x7r4m5"
Repository foundation
Package foundation
Database
Authentication
Tenant context
Authorization
API
Validation/errors
Observability
Stores
Products
Inventory
Carts
Checkout
Jobs
Storefront
```

The Inventory domain must already satisfy its implementation rules before the vertical slice is assembled.

---

# 4. Domain Ownership

Inventory owns:

```text id="m8q4r6"
On-hand quantity
Reserved quantity
Available quantity
Inventory adjustments
Inventory movements
Reservations
Reservation release
Reservation finalization
Concurrency rules
```

Products owns:

```text id="q5m7r4"
Product
Variant
SKU
Catalog price
Publication
```

Checkout coordinates the purchase workflow.

Orders records the completed purchase.

---

# 5. Inventory Model

The basic quantity relationship is:

```text id="v6r4m8"
available = onHand - reserved
```

The exact implementation must preserve this invariant through transactional updates.

The system must never allow available inventory to become negative.

---

# 6. Inventory Record

Inventory should be associated with a specific:

```text id="m4q8r7"
Store
Variant
```

The implementation must ensure that a Variant cannot accidentally use inventory belonging to another Store.

---

# 7. Initial Inventory

When a merchant creates a Product Variant, Inventory may be initialized according to the approved Product/Inventory workflow.

If initial quantity is zero:

```text id="x8r5m4"
onHand = 0
reserved = 0
available = 0
```

The system must not fabricate stock.

---

# 8. Stock Adjustment

Merchant stock changes must use an explicit application service.

For example:

```text id="q7m4r6"
adjustInventory(variantId, quantityDelta, reason)
```

The operation must occur within a transaction.

---

# 9. Adjustment Types

The Demo may support basic adjustment reasons such as:

```text id="v5m8r4"
INITIAL_STOCK
RESTOCK
MANUAL_ADJUSTMENT
DAMAGE
CORRECTION
```

The exact supported reasons should follow the Inventory specification.

---

# 10. Adjustment Validation

Validate:

```text id="m6q4r8"
Variant exists
Variant belongs to Store
Quantity is valid
Adjustment is authorized
Resulting stock remains valid
```

Business rules belong to Inventory.

---

# 11. Inventory Movement History

Every meaningful stock adjustment should create an immutable movement record.

For example:

```text id="x5r7m6"
Inventory ID
Quantity delta
Reason
Reference where applicable
Actor/context
CreatedAt
```

This provides an audit trail for inventory changes.

---

# 12. Merchant Inventory View

The merchant UI should show useful inventory information such as:

```text id="q8m4r5"
Product
Variant
SKU
On-hand
Reserved
Available
```

Do not display fabricated values when inventory has not been initialized.

---

# 13. Inventory Pagination

Inventory lists must use bounded pagination.

The API should define:

```text id="v7r4m6"
Default page size
Maximum page size
Stable ordering
Approved filters
```

Do not return an unbounded inventory table.

---

# 14. Inventory Filtering

Supported filters may include:

```text id="m5q8r4"
Product
Variant
SKU
Low-stock condition where required
```

Filtering must remain Store-scoped.

---

# 15. Low-Stock Display

If Demo includes low-stock warnings, the threshold should be explicit configuration or Store-level configuration.

Do not hardcode arbitrary thresholds into UI components.

Low-stock warnings are informational and must not alter inventory state.

---

# 16. Customer Availability

The Storefront may display availability based on Inventory.

For example:

```text id="x6r4m8"
Available
Out of stock
```

The customer-facing value is informational.

Checkout remains authoritative.

---

# 17. Add-to-Cart Does Not Reserve Inventory

Adding an item to a Cart must not immediately reserve stock.

The flow remains:

```text id="q5m7r4"
Product
 ↓
Cart
 ↓
Checkout
 ↓
Inventory Reservation
```

This prevents abandoned carts from permanently consuming inventory.

---

# 18. Checkout Reservation

During Checkout, Inventory should reserve required quantities using a transaction-safe operation.

Conceptually:

```text id="v8m4r6"
reserveInventory(
    variantId,
    quantity,
    checkoutId
)
```

The reservation must be associated with a durable purchase context.

---

# 19. Reservation Validation

Before reservation:

```text id="m7q4r5"
Variant exists
Variant belongs to Store
Quantity is positive
Inventory exists
Available quantity >= requested quantity
Reservation is not already completed
```

---

# 20. Concurrency

Two customers may attempt to purchase the last unit simultaneously.

For example:

```text id="x4r8m6"
Available = 1

Customer A → quantity 1
Customer B → quantity 1
```

Only one reservation may succeed.

The database transaction must lock or atomically update the authoritative inventory row.

---

# 21. Row Locking

The approved implementation should use row-level locking such as:

```text id="q6m5r8"
SELECT ...
FOR UPDATE
```

where required.

The transaction must:

```text id="v7r4m6"
Lock inventory row
↓
Verify availability
↓
Update reservation/quantity
↓
Persist movement/reservation
↓
Commit
```

---

# 22. Lock Ordering

If multiple inventory records are modified within one transaction, lock them in deterministic order.

For example:

```text id="m8q4r5"
Sort by inventory ID
↓
Acquire locks
↓
Perform updates
```

This reduces deadlock risk.

---

# 23. No External Calls in Inventory Transaction

Do not call:

```text id="x5r7m4"
Payment provider
Email provider
Object storage
External API
```

while holding Inventory row locks.

Inventory transactions must remain short.

---

# 24. Reservation State

Reservations should have explicit states.

Typical states:

```text id="q8m4r6"
ACTIVE
RELEASED
FINALIZED
EXPIRED
```

The exact state machine follows the Inventory specification.

---

# 25. Reservation Idempotency

Retrying the same reservation request must not reserve the quantity twice.

The reservation should have a stable logical identity derived from the Checkout/purchase context.

---

# 26. Reservation Release

If Checkout is cancelled or expires:

```text id="v6r5m8"
Checkout
 ↓
Release reservation
 ↓
Inventory available increases
```

Release must be idempotent.

A reservation already released must not release the quantity again.

---

# 27. Reservation Expiration

If reservations have an expiration time, a durable job should process expired reservations.

The job must call the Inventory application service rather than directly modifying inventory rows.

---

# 28. Reservation Finalization

After successful purchase completion:

```text id="m4q7r6"
ACTIVE reservation
       ↓
FINALIZED
```

The finalization operation must ensure the stock is not counted as available again.

---

# 29. Payment Failure

If payment fails before the purchase is completed, the reservation should be released according to the approved Checkout workflow.

The Inventory module should not decide payment outcome itself.

---

# 30. Payment Uncertainty

If payment enters an uncertain state:

```text id="x7r4m5"
Payment pending/unknown
```

the Inventory reservation must not be released merely because the frontend experienced a timeout.

Checkout/Payments determine the appropriate workflow.

---

# 31. Order Relationship

When an Order is successfully created, Inventory should preserve the appropriate relationship to the completed purchase/reservation.

The exact historical reference belongs to the approved Inventory/Orders schema.

Orders does not directly manipulate Inventory rows.

---

# 32. Inventory History

Completed inventory movements should remain auditable.

Do not rewrite historical movement records to make current stock appear correct.

Corrections should be represented as new movements.

---

# 33. Negative Inventory

The implementation must prevent unintended negative inventory.

Database constraints and transaction logic should provide defense in depth.

If negative inventory is ever intentionally supported later, it must be an explicit architectural/product decision.

It is not a hidden side effect of race conditions.

---

# 34. API Endpoints

Merchant inventory APIs may include:

```text id="q5m8r4"
GET   /api/v1/stores/:storeId/inventory
GET   /api/v1/stores/:storeId/inventory/:variantId
POST  /api/v1/stores/:storeId/inventory/:variantId/adjust
```

Reservation APIs are normally internal application operations rather than merchant-facing endpoints.

Exact routes follow the API contract.

---

# 35. DTOs

Use explicit DTOs such as:

```text id="v8r4m6"
InventorySummaryDTO
InventoryDetailsDTO
InventoryAdjustmentRequest
InventoryAdjustmentResponse
```

Do not expose database entities directly.

---

# 36. Authorization

Inventory management requires appropriate Store permissions.

For example:

```text id="m7q4r5"
Owner → allowed
Admin → allowed
Staff → according to assigned permissions
Unaffiliated user → denied
```

The exact role matrix follows the approved authorization model.

---

# 37. Customer Access

Customers should not receive merchant inventory details.

The Storefront may expose only the minimal availability information required by the customer experience.

---

# 38. Tenant Isolation

Every inventory operation must remain Store-scoped.

Verify:

```text id="x6r5m8"
Store A merchant
   ↓
Store A inventory → allowed

Store A merchant
   ↓
Store B inventory → denied
```

The Variant-to-Store relationship must also be validated.

---

# 39. Idempotency

Inventory mutations that may be retried must have explicit idempotency semantics.

Critical operations include:

```text id="q7m4r6"
Adjustment
Reservation
Release
Finalization
```

Do not use one generic idempotency implementation without defining operation-specific behavior.

---

# 40. Events

Inventory may emit events such as:

```text id="v5m8r4"
InventoryAdjusted
InventoryReserved
InventoryReleased
InventoryFinalized
InventoryLow
```

Events represent completed state changes.

---

# 41. Event Consumers

Possible consumers include:

```text id="m4q8r6"
Notifications
Checkout
Orders
Merchant UI
```

The Demo should implement only required consumers.

---

# 42. Jobs

Inventory jobs may include:

```text id="x8r5m4"
Expire reservations
Recover stale reservation work
Process approved cleanup
```

All jobs must be idempotent.

---

# 43. Observability

Inventory operations should log:

```text id="q5r7m4"
inventoryId
variantId
storeId
operation
quantity where safe
reservationId where applicable
result
duration
correlationId
```

Sensitive customer/payment information should not be logged.

---

# 44. Metrics

Useful metrics include:

```text id="v7m4r6"
inventory_adjustment_total
inventory_reservation_total
inventory_reservation_failure_total
inventory_release_total
inventory_finalize_total
inventory_concurrency_conflict_total
```

Exact names follow shared observability conventions.

---

# 45. Testing Strategy

### Unit Tests

Test:

```text id="m6q4r8"
Quantity rules
Availability calculation
Reservation state machine
Adjustment validation
Release/finalization rules
```

### Integration Tests

Test:

```text id="x5r8m4"
Inventory persistence
Adjustments
Reservations
Release
Finalization
Constraints
Store isolation
```

### Concurrency Tests

Test:

```text id="q8m4r5"
Two buyers competing for one unit
Two buyers competing for multiple units
Concurrent release/finalization
Concurrent adjustments
Duplicate reservation requests
```

---

# 46. Critical Oversell Test

Start with:

```text id="v6r5m8"
Available = 1
```

Then execute two concurrent reservations for quantity `1`.

Expected result:

```text id="m7q4r6"
Reservation A → SUCCESS
Reservation B → INSUFFICIENT_INVENTORY
```

Final inventory must remain consistent.

---

# 47. Reservation Lifecycle Test

Verify:

```text id="x4r8m5"
Create reservation
 ↓
Available decreases
 ↓
Release reservation
 ↓
Available increases
```

Then verify:

```text id="q5m8r4"
Create reservation
 ↓
Finalize reservation
 ↓
Available does not return
```

---

# 48. Duplicate Operation Test

Execute the same:

```text id="v8m4r6"
Reservation
Release
Finalization
```

operation twice using the same idempotency identity.

The second execution must not corrupt quantities.

---

# 49. Cross-Tenant Test

Create inventory in two Stores and verify that:

```text id="m6q4r8"
Merchant A
```

cannot:

```text id="x7r5m4"
View Store B inventory
Adjust Store B inventory
Reserve Store B inventory
Release Store B reservation
```

---

# 50. Checkout Integration Test

The complete purchase path should verify:

```text id="q8m4r5"
Inventory available
   ↓
Add to Cart
   ↓
Checkout
   ↓
Reserve inventory
   ↓
Payment succeeds
   ↓
Order completes
   ↓
Reservation finalizes
```

Then verify that another customer cannot purchase the finalized quantity.

---

# 51. Failure Tests

Test:

```text id="v5r7m6"
Insufficient inventory
Invalid variant
Cross-store variant
Duplicate reservation
Reservation expiry
Payment failure
Payment uncertainty
Database failure
Worker retry
Concurrent adjustment
Concurrent checkout
```

Every failure must leave inventory internally consistent.

---

# 52. Implementation Order

Implement the Inventory slice in this order:

```text id="m4q8r7"
1. Verify Product/Variant foundation
2. Implement inventory schema
3. Implement inventory records
4. Implement stock adjustments
5. Implement movement history
6. Implement merchant inventory API
7. Implement inventory display
8. Implement reservation model
9. Implement concurrency-safe reservation
10. Integrate Checkout reservation
11. Implement release
12. Implement finalization
13. Implement expiration job
14. Integrate Storefront availability
15. Add observability
16. Add unit tests
17. Add integration tests
18. Add concurrency/oversell tests
19. Add security tests
20. Run full purchase verification
```

---

# 53. AI Implementation Rules

AI agents implementing this slice must:

1. Read the actual root `AGENTS.md`.
2. Read Inventory, Products, Checkout, Orders, Jobs, Database, Tenant, API, and Security specifications.
3. Treat PostgreSQL inventory state as authoritative.
4. Use approved row-locking/concurrency mechanisms.
5. Never trust client-side stock quantities.
6. Never modify Inventory from Orders or Payments directly.
7. Never call external providers while holding inventory locks.
8. Make reservation/release/finalization retry-safe.
9. Test overselling explicitly.
10. Preserve Store isolation.
11. Avoid introducing Redis or external inventory infrastructure.

---

# 54. Definition of Done

The Inventory slice is complete when:

```text id="x6r4m8"
[ ] Inventory records exist for required Variants
[ ] Merchant can view inventory
[ ] Merchant can adjust stock
[ ] Movement history is recorded
[ ] Available/reserved quantities remain consistent
[ ] Negative inventory is prevented
[ ] Store isolation is enforced
[ ] Inventory permissions work
[ ] Add-to-cart does not reserve stock
[ ] Checkout reservation works
[ ] Reservation is concurrency-safe
[ ] Reservation release works
[ ] Reservation finalization works
[ ] Reservation expiration works
[ ] Duplicate operations are safe
[ ] Storefront availability works
[ ] Payment failure workflow releases inventory correctly
[ ] Payment uncertainty does not cause unsafe release
[ ] Oversell tests pass
[ ] Integration tests pass
[ ] Security tests pass
[ ] TypeScript passes
[ ] Lint passes
```

---

# 55. Slice Completion Gate

The Inventory slice must pass the following scenario:

```text id="q7m5r4"
Create Product Variant
   ↓
Set stock = 1
   ↓
Customer A adds item to Cart
   ↓
Customer B adds item to Cart
   ↓
Customer A enters Checkout
   ↓
Reserve quantity = 1
   ↓
Customer B enters Checkout
   ↓
Reservation fails
   ↓
Customer A completes payment
   ↓
Order created
   ↓
Inventory finalized
   ↓
Available quantity = 0
```

The implementation is complete only when this workflow remains correct under concurrency, retries, failures, and tenant isolation.