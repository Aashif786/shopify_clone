# Database Schema Implementation

## 1. Purpose

This document defines how the approved PostgreSQL schema is implemented for the Demo.

The database is the **authoritative transactional source of truth** for commerce data.

The implementation must prioritize:

- Referential integrity.
- Tenant isolation.
- Correct monetary representation.
- Concurrency safety.
- Explicit ownership.
- Historical correctness.
- Idempotency.
- Efficient transactional access.
- Safe schema evolution.

The schema must support the approved architecture without introducing infrastructure that the Demo does not require.

---

# 2. Database Technology

The Demo uses:

```text
PostgreSQL
```

PostgreSQL is responsible for authoritative persistence of:

- Organizations.
- Memberships.
- Stores.
- Products.
- Variants.
- Inventory.
- Customers.
- Carts.
- Discounts.
- Checkout.
- Payments.
- Orders.
- Jobs.
- Webhooks.
- Media metadata.
- Notifications.
- Required audit/history records.

---

# 3. Database Ownership

Database infrastructure is provided by:

```text
packages/db
```

Business-specific persistence is owned by the corresponding domain modules.

Conceptually:

```text
modules/products
    ↓
product repository
    ↓
packages/db
    ↓
PostgreSQL
```

The database package must not become the owner of product, inventory, payment, or order business rules.

---

# 4. Tenant Hierarchy

The foundational ownership hierarchy is:

```text
Organization
    ↓
Memberships
    ↓
Stores
    ↓
Store-owned resources
```

Most commerce resources must ultimately be associated with a Store.

Examples:

```text
Store
 ├── Products
 ├── Inventory
 ├── Customers
 ├── Carts
 ├── Discounts
 ├── Checkout
 ├── Payments
 └── Orders
```

---

# 5. Organization

The Organization represents the top-level merchant/business tenant.

Typical fields include:

```text
id
name
status
created_at
updated_at
```

The implementation may add additional metadata required by the approved Store specification.

Organization identifiers must be stable and non-reused.

---

# 6. Membership

Membership associates a User with an Organization and/or Store according to the approved authorization model.

Typical concepts include:

```text
id
organization_id
user_id
store_id where applicable
role
status
created_at
updated_at
```

Membership records must support server-side authorization.

A client-supplied role must never be treated as authoritative.

---

# 7. Store

The Store is the primary commerce tenant boundary.

Typical fields include:

```text
id
organization_id
name
slug
status
configuration
created_at
updated_at
```

Store identifiers must be unique within the appropriate ownership scope.

---

# 8. Store Slugs

Storefront identifiers such as slugs must use database uniqueness constraints.

The uniqueness scope must match the approved public Store resolution design.

Do not rely on application-level duplicate checking alone.

---

# 9. Resource Ownership

Every store-scoped entity should have a clear ownership relationship.

For example:

```text
Product
    → Store

Customer
    → Store

Cart
    → Store

Order
    → Store
```

Ownership must be explicit wherever practical.

---

# 10. Cross-Tenant Foreign Keys

Foreign keys must prevent invalid relationships.

Where a resource references multiple tenant-scoped records, the schema must prevent accidental cross-store relationships.

For example, an Order Item referencing a Product must not permit:

```text
Order.store_id != Product.store_id
```

to be silently accepted.

This may require composite foreign keys or application-level transaction checks combined with appropriate schema constraints.

---

# 11. Product Tables

The product model should support:

```text
Product
Variant
Media relationship
Publication/status information
```

Typical Product fields:

```text
id
store_id
title
description
slug
status
created_at
updated_at
```

---

# 12. Product Variants

Variants represent purchasable product configurations.

Typical fields include:

```text
id
product_id
sku
title
price
currency
status
created_at
updated_at
```

The exact fields must follow the approved Product specification.

---

# 13. Product SKU

SKU uniqueness must be enforced at the appropriate Store scope.

If the business rule is:

```text
SKU unique within Store
```

the database must enforce that rule.

Application-level checks alone are insufficient under concurrent requests.

---

# 14. Money Representation

Money must never be stored as floating-point values.

Use an exact representation such as:

```text
integer minor units
```

or an appropriately constrained PostgreSQL numeric representation.

The chosen representation must be consistent throughout the application.

For example:

```text
₹999.50
→ 99950 minor units
```

The database must not introduce floating-point rounding behavior into financial calculations.

---

# 15. Currency

Currency must be stored explicitly wherever monetary values require historical or transactional interpretation.

Do not assume:

```text
all stores use the same currency
```

unless that is an explicit product constraint.

Historical order/payment records must retain the currency applicable at the time of the transaction.

---

# 16. Inventory

Inventory persistence must support authoritative stock state.

Conceptually:

```text
Inventory
├── variant_id
├── available_quantity
├── reserved_quantity
└── version/timestamps where required
```

The exact schema must follow the Inventory implementation specification.

---

# 17. Inventory Adjustments

Inventory adjustments should preserve an auditable record of stock changes.

Typical information:

```text
id
inventory_id
quantity_delta
reason
reference
created_at
```

The implementation must distinguish current inventory state from historical movements.

---

# 18. Inventory Reservations

Inventory reservations must have explicit lifecycle state.

Typical information may include:

```text
id
variant_id
checkout_id
quantity
status
expires_at
created_at
updated_at
```

Reservation ownership must prevent one checkout from accidentally releasing another checkout's reservation.

---

# 19. Inventory Constraints

The database should enforce obvious integrity constraints such as:

```text
quantity >= 0
```

where appropriate.

Business operations must still use transactions and row locking to prevent race conditions.

Database constraints are the final protection, not a replacement for concurrency-safe application logic.

---

# 20. Customer

Customers are Store-scoped commerce identities.

Typical fields include:

```text
id
store_id
user_id where applicable
email
first_name
last_name
status
created_at
updated_at
```

Authentication identity and customer commerce records remain conceptually distinct.

---

# 21. Customer Email

Email uniqueness must follow the approved customer semantics.

If the business rule is:

```text
one customer email per Store
```

the database should enforce it using an appropriate unique constraint/index.

Email normalization must occur consistently before uniqueness checks.

---

# 22. Addresses

Customer addresses should be stored separately from the customer record.

Typical fields:

```text
id
customer_id
name
line1
line2
city
state
postal_code
country
created_at
updated_at
```

The exact fields follow the customer specification.

---

# 23. Historical Address Snapshots

Orders must not depend on mutable customer address records.

When an order is created, the applicable billing/shipping address must be copied into an immutable order snapshot.

This preserves historical correctness if the customer later changes their address.

---

# 24. Cart

A Cart belongs to a Store and may optionally be associated with a Customer.

Typical fields:

```text
id
store_id
customer_id where applicable
status
currency
expires_at
created_at
updated_at
```

Guest carts must remain securely associated with their appropriate client/session mechanism.

---

# 25. Cart Items

Cart items should reference the appropriate Variant.

Typical fields:

```text
id
cart_id
variant_id
quantity
created_at
updated_at
```

Quantity must satisfy database constraints.

Cart state must not be treated as authoritative for final checkout pricing or inventory.

---

# 26. Cart Uniqueness

The schema should prevent unintended duplicate active cart lines where the business model expects one line per Variant.

For example:

```text
(cart_id, variant_id)
```

may require a unique constraint for active cart items.

The exact implementation must account for soft deletion/status semantics if used.

---

# 27. Discounts

Discount persistence must support:

```text
Discount definition
Discount codes
Eligibility
Validity period
Usage limits
Usage tracking
```

Typical ownership:

```text
Discount
    → Store

DiscountCode
    → Discount
```

---

# 28. Discount Usage

Usage limits must be enforced transactionally.

The schema should support safe recording of:

```text
discount_id
code_id where applicable
order/checkout reference
customer reference where applicable
usage timestamp
```

A simple application-level count check is insufficient under concurrent checkout requests.

---

# 29. Checkout

Checkout represents the purchase process before order completion.

Typical fields include:

```text
id
store_id
cart_id
customer_id where applicable
status
currency
totals
expires_at
created_at
updated_at
```

The schema must support idempotent checkout operations.

---

# 30. Checkout Items

Checkout items should preserve the purchase-time state needed to calculate and finalize the transaction.

Depending on the approved model, this may include snapshots of:

```text
product identity
variant identity
title
SKU
unit price
quantity
```

The final order must contain its own durable historical snapshot.

---

# 31. Payment Records

Payments should have explicit persistence separate from Orders.

Typical concepts include:

```text
Payment
PaymentAttempt
Refund
```

Payment records must support provider references and state transitions without making the provider the source of truth.

---

# 32. Payment Attempt

A payment attempt should track a specific attempt to process payment.

Potential fields:

```text
id
payment_id
provider
provider_reference
status
amount
currency
idempotency_key
created_at
updated_at
```

Provider-specific metadata should be isolated where practical.

---

# 33. Payment Idempotency

The schema must support unique/idempotent processing for payment operations.

Appropriate unique constraints may include:

```text
provider reference
application idempotency key
payment operation identifier
```

The exact uniqueness scope must match the payment specification.

---

# 34. Webhook Events

Persist incoming payment/provider webhook events when required for reliable processing.

Typical fields:

```text
id
provider
external_event_id
event_type
payload
signature metadata where appropriate
status
received_at
processed_at
```

External event IDs should be uniquely constrained within the appropriate provider scope.

---

# 35. Webhook Deduplication

Webhook processing must be safe against duplicate delivery.

The database should enforce uniqueness on the provider's stable event identifier where possible.

Application processing must still verify current state and tolerate retries.

---

# 36. Orders

Orders are durable historical purchase records.

Typical fields include:

```text
id
store_id
customer_id where applicable
order_number
status
currency
subtotal
discount_total
tax_total where applicable
shipping_total where applicable
grand_total
created_at
updated_at
```

The exact financial fields follow the approved Order specification.

---

# 37. Order Number

The customer-facing order number must have a deliberate uniqueness strategy.

It should not depend solely on random UI generation.

The database must enforce the required uniqueness scope.

---

# 38. Order Items

Order items must preserve historical purchase information.

Typical fields:

```text
id
order_id
product_id where useful
variant_id where useful
title_snapshot
sku_snapshot
unit_price
quantity
line_total
```

The order must remain historically correct even if the Product or Variant later changes.

---

# 39. Order Snapshots

Historical order information should be immutable after creation except for explicitly allowed operational fields.

Examples of immutable historical information:

```text
Purchased title
SKU
Unit price
Currency
Quantity
Billing address
Shipping address
Discount applied
```

Do not rebuild historical order data from current product records.

---

# 40. Order Status History

Order status transitions should be auditable.

A status-history table may contain:

```text
id
order_id
from_status
to_status
reason
actor
created_at
```

The exact model follows the approved order state-machine specification.

---

# 41. Separate Payment and Order State

Do not collapse:

```text
Order status
Payment status
Fulfillment status
```

into one generic status field when their lifecycles differ.

The schema must support the approved separation.

---

# 42. Media Metadata

Media metadata belongs in PostgreSQL even though binary content belongs in object storage.

Typical fields:

```text
id
store_id
object_key
filename
mime_type
size
status
created_at
updated_at
```

The database record must not assume the binary object always exists without appropriate lifecycle handling.

---

# 43. Notifications

Notification persistence should support:

```text
id
store_id where applicable
recipient
channel
type
status
attempt count
provider reference where applicable
created_at
updated_at
```

The exact model follows the notification implementation specification.

---

# 44. Jobs

The durable job table must support:

```text
id
type
payload
status
attempt_count
available_at
claimed_at
lease_until
last_error
created_at
updated_at
```

The exact schema must match the Jobs implementation specification.

---

# 45. Job Indexing

Job indexes should support the primary worker query pattern.

For example, the implementation should efficiently find:

```text
pending jobs
available jobs
stale processing jobs
```

Index design must reflect actual worker queries.

---

# 46. Idempotency Records

Where application-level idempotency is required, PostgreSQL should store sufficient information to safely recognize repeated requests.

Potential fields include:

```text
id
scope
idempotency_key
request_fingerprint
status
response metadata
created_at
expires_at where applicable
```

The exact design follows the approved idempotency architecture.

---

# 47. Audit Data

Audit/history tables should be used where the system requires durable evidence of important transitions.

Examples:

```text
Order status history
Inventory movements
Payment attempts
Webhook processing
Membership changes
```

Do not create audit tables for every trivial field automatically.

---

# 48. Primary Keys

Primary keys must be:

- Stable.
- Non-reused.
- Suitable for application references.
- Indexed automatically through PostgreSQL primary-key constraints.

The exact identifier strategy must remain consistent throughout the database.

---

# 49. Foreign Keys

Foreign keys should be used wherever referential integrity matters.

Avoid relying entirely on application code for relationships such as:

```text
Order → Order Items
Product → Variants
Cart → Cart Items
Store → Products
Customer → Addresses
```

---

# 50. Delete Behavior

Foreign-key deletion behavior must be deliberate.

Possible behaviors include:

```text
RESTRICT
CASCADE
SET NULL
```

Use `CASCADE` only when deleting the parent should genuinely remove all dependent records.

Historical commerce records should generally be protected from accidental deletion.

---

# 51. Soft Deletion

Soft deletion should be used only when business requirements justify it.

Do not add:

```text
deleted_at
```

to every table by default.

If soft deletion is used, every relevant query must consistently respect it.

---

# 52. Status Columns

Status values should be explicit and constrained.

Avoid arbitrary free-form strings where the state machine is known.

Possible implementation approaches include:

```text
CHECK constraints
application-level enums
database enums
```

The selected approach must remain consistent with migration and evolution requirements.

---

# 53. Timestamps

Persistent entities should generally include:

```text
created_at
updated_at
```

where lifecycle tracking is useful.

Timestamp behavior must be consistent and timezone-aware.

Use UTC for persisted timestamps unless an explicit requirement dictates otherwise.

---

# 54. Database Constraints

The schema should enforce invariants that are cheap and reliable to enforce at the database layer.

Examples:

```text
Non-negative quantities
Required relationships
Unique identifiers
Valid basic ranges
Required fields
```

Business workflows still belong in application/domain code.

---

# 55. Composite Constraints

Use composite constraints where correctness depends on multiple columns.

Examples:

```text
(store_id, slug)
(store_id, sku)
(cart_id, variant_id)
(provider, external_event_id)
```

The exact constraints must reflect approved domain rules.

---

# 56. Indexing Principles

Every index must support an actual access pattern.

Important access patterns include:

```text
Store-scoped lookup
Public product lookup
SKU lookup
Customer lookup
Cart lookup
Order lookup
Payment lookup
Webhook deduplication
Job claiming
Idempotency lookup
```

Do not create indexes solely because a column "might be searched later."

---

# 57. Tenant-Aware Indexes

Frequently queried store-scoped tables should consider composite indexes beginning with the tenant/store key where appropriate.

Example:

```text
(store_id, status)
(store_id, created_at)
(store_id, slug)
```

The exact index order must follow query patterns and PostgreSQL query plans.

---

# 58. Unique Indexes

Unique indexes should enforce business uniqueness where concurrency could otherwise produce duplicates.

Examples:

```text
Store slug
Product SKU
Order number
Webhook external ID
Idempotency key
```

---

# 59. Large Text and JSON

Use PostgreSQL JSON/JSONB only where flexible structured data is genuinely required.

Do not use JSONB as an excuse to avoid modeling important relational business data.

Core commerce relationships should remain explicit relational columns.

---

# 60. Database Transactions

Schema implementation must support application-level transaction boundaries.

Critical workflows include:

```text
Inventory reservation
Checkout completion
Order creation
Payment state transitions
Discount usage
Inventory adjustment
Idempotency handling
Webhook processing
Job claiming
```

Transactions should remain short.

---

# 61. Concurrency

Database design must support safe concurrent operations.

Important mechanisms include:

```text
Row locks
Unique constraints
Atomic updates
Foreign keys
Transaction isolation
Deterministic lock ordering
```

The schema alone cannot solve all concurrency problems, but it must provide the primitives required by application services.

---

# 62. Isolation Level

The default transaction isolation level should remain PostgreSQL's normal:

```text
READ COMMITTED
```

Use stronger isolation only when a specific workflow requires it and the tradeoff has been reviewed.

---

# 63. Row Locking

Critical mutable records may require:

```text
SELECT ... FOR UPDATE
```

before performing dependent state changes.

Examples:

```text
Inventory row
Payment record
Checkout record
Order state
Idempotency record
```

Locking must occur in a deterministic order when multiple rows are involved.

---

# 64. Database-Level Race Protection

Application code should assume concurrent requests can happen.

Example:

```text
Request A checks stock
Request B checks stock
Request A reserves
Request B reserves
```

A correct schema and transaction design must prevent this from producing negative inventory.

---

# 65. Migration Compatibility

Schema implementation must support version-controlled migrations.

Avoid manual production schema edits that cannot be reproduced locally.

All structural changes must be represented by migration files.

---

# 66. Migration Safety

Migrations should prefer:

```text
Backward-compatible changes
Small changes
Explicit constraints
Controlled index creation
Expand-and-contract when required
```

Destructive operations require additional review.

---

# 67. Seed Data

Seed data must remain separate from production business data.

Development/test seeds may create:

```text
Demo Organization
Demo Store
Demo Users
Sample Products
Sample Inventory
```

Seed scripts must be deterministic and safe to rerun.

---

# 68. Schema Verification

Schema verification must confirm:

```text
Tables exist
Primary keys exist
Foreign keys exist
Constraints exist
Indexes exist
Required relationships are valid
Migrations apply cleanly
Seeds execute correctly
```

---

# 69. Definition of Done

Database schema implementation is complete when:

```text
[ ] Approved entities are implemented
[ ] Tenant ownership is explicit
[ ] Foreign keys enforce relationships
[ ] Cross-tenant relationships are prevented
[ ] Money uses exact representation
[ ] Quantities have appropriate constraints
[ ] Unique business identifiers are enforced
[ ] Historical order data is preserved
[ ] Payment/webhook idempotency is supported
[ ] Job claiming is supported
[ ] Indexes support real access patterns
[ ] Critical workflows can use safe transactions
[ ] Timestamps are consistent
[ ] Delete behavior is deliberate
[ ] Schema is migration-managed
[ ] Seeds are deterministic
[ ] Database tests pass
[ ] TypeScript integration passes
[ ] No business logic is hidden inside generic DB infrastructure
```

---

# 70. Final Principle

The PostgreSQL schema is the **integrity boundary of the Demo**.

Application services and domain modules define business behavior, but the database must enforce the relationships, uniqueness, references, and basic invariants that protect the system when concurrent requests, retries, bugs, or unexpected failures occur.

The schema should be explicit enough to protect commerce correctness without becoming an unnecessarily complicated enterprise data platform.