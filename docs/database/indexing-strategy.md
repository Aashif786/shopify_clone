# Database Indexing Strategy

## 1. Purpose

This document defines the indexing strategy for the Demo commerce platform's PostgreSQL database.

The goal is to provide:

- Efficient tenant-scoped queries
- Fast primary-key and foreign-key lookups
- Efficient merchant operational queries
- Efficient storefront queries
- Reliable uniqueness enforcement
- Support for transactional commerce operations
- A clear path for future optimization

Indexes must support real application access patterns.

The platform should not create indexes merely because a column exists.

---

# 2. Indexing Principles

The database follows these principles:

1. Primary keys are indexed.
2. Unique business identifiers use unique indexes or constraints.
3. Foreign keys should have supporting indexes when query patterns require them.
4. Tenant-scoped queries are a primary indexing concern.
5. Composite indexes should reflect actual filtering and sorting patterns.
6. Index order matters.
7. Indexes should not duplicate existing indexes unnecessarily.
8. High-write tables should avoid excessive indexing.
9. Historical tables should be indexed according to actual retrieval requirements.
10. Indexes must support constraints where appropriate.
11. Index decisions should be validated using query plans and real usage.
12. Indexes are an optimization layer, not a replacement for correct schema design.

---

# 3. Primary Keys

Every entity should have an indexed primary key.

Examples:

```text id="8m4q7h"
organizations.id
stores.id
products.id
product_variants.id
customers.id
carts.id
checkouts.id
payments.id
orders.id
```

PostgreSQL automatically creates an index for primary-key constraints.

No duplicate manual index should be created on the same primary key.

---

# 4. Tenant-Scoped Indexing

Store-scoped resources are frequently queried by:

```text
store_id
```

Therefore, indexes should be designed around common tenant access patterns.

Typical candidates include:

```text id="d2d0v9"
products(store_id, ...)
customers(store_id, ...)
orders(store_id, ...)
carts(store_id, ...)
discounts(store_id, ...)
checkouts(store_id, ...)
payments(store_id, ...)
```

The exact indexes depend on how each table is queried.

A simple index on `store_id` is appropriate when queries frequently filter only by store.

A composite index is preferable when queries consistently filter by store and another field.

---

# 5. Why Tenant-First Indexing Matters

A merchant dashboard may frequently execute queries such as:

```sql
SELECT ...
FROM orders
WHERE store_id = $1
ORDER BY created_at DESC;
```

An index such as:

```text
(store_id, created_at)
```

is generally more useful than independent indexes on:

```text
store_id
created_at
```

for this specific access pattern.

The index should reflect the actual query.

---

# 6. Organization Indexes

## OrganizationMembership

Important access patterns:

```text
Find memberships for an organization
Find organizations for a user
Check whether a user belongs to an organization
```

Candidate indexes:

```text
(organization_id, user_id)
(user_id, organization_id)
```

A uniqueness constraint should prevent duplicate membership records where appropriate.

---

# 7. Store Indexes

Common access patterns:

```text
Find stores belonging to an organization
Find store by slug
Find store by ID
```

Candidate indexes:

```text
(organization_id)
(organization_id, slug)
```

If store slugs are globally unique, a global unique index may be used.

If slugs are only unique within an organization, the uniqueness constraint should be scoped accordingly.

The final scope must match the product requirement.

---

# 8. Store Membership Indexes

Common queries:

```text
Find members of a store
Check a user's membership in a store
Find all stores accessible to a user
```

Recommended constraint/index pattern:

```text
UNIQUE(user_id, store_id)
```

Supporting access patterns may require:

```text
(store_id, user_id)
(user_id, store_id)
```

The unique constraint can provide one of these access paths depending on column order.

Additional indexes should only be added if actual queries require them.

---

# 9. Product Indexes

Common product queries include:

```text
List products for a store
Find product by store + slug
Filter products by status
List recently created products
```

Candidate indexes:

```text
(store_id, slug)
(store_id, status)
(store_id, created_at)
```

If storefront queries frequently request only published products, an appropriate composite or partial index may be considered.

Example conceptual pattern:

```text
(store_id, status, created_at)
```

However, this should be validated against actual query patterns.

---

# 10. Product Variant Indexes

Common queries:

```text
Find variants for a product
Find SKU within a store
Find variant by ID
```

Candidate indexes:

```text
(product_id)
(store_id, sku)
```

SKU uniqueness should normally be enforced within the appropriate store scope.

For example:

```text
UNIQUE(store_id, sku)
```

if the product requirements define SKU uniqueness per store.

---

# 11. Product Media Indexes

Common queries:

```text
Get media for a product
Get media for a variant
Order media by display position
```

Candidate indexes:

```text
(product_id, position)
(variant_id, position)
```

If `variant_id` is optional, the second index should be introduced only if variant-specific media queries are frequent enough to justify it.

---

# 12. Inventory Indexes

Inventory is operationally sensitive and must support fast lookups.

Common queries:

```text
Find inventory for a variant
Find inventory for a store
Update inventory for a variant
```

Candidate indexes:

```text
UNIQUE(variant_id)
(store_id, variant_id)
```

If `variant_id` is globally unique and sufficient for all inventory operations, the additional store index may be unnecessary.

The important requirement is that inventory lookup must be deterministic and fast enough to support checkout operations.

---

# 13. Inventory Adjustment Indexes

Common queries:

```text
Get adjustments for an inventory item
Get recent inventory changes for a store
Find adjustments associated with an operation
```

Candidate indexes:

```text
(inventory_item_id, created_at)
(store_id, created_at)
(reference_type, reference_id)
```

The last index is particularly useful when operational workflows need to determine whether an inventory operation has already been recorded.

---

# 14. Customer Indexes

Common queries:

```text
Find customers for a store
Find customer by email within a store
Find customer by user
List recently created customers
```

Candidate indexes:

```text
(store_id, email)
(store_id, created_at)
(user_id, store_id)
```

If customer email uniqueness is required, enforce it with a unique constraint such as:

```text
UNIQUE(store_id, normalized_email)
```

The exact normalization strategy belongs to the customer domain.

---

# 15. Customer Address Indexes

Common query:

```text
Get addresses belonging to a customer
```

Candidate index:

```text
(customer_id)
```

If address ordering or default-address retrieval is required:

```text
(customer_id, ...)
```

may be more appropriate.

---

# 16. Cart Indexes

Common queries:

```text
Find active cart for a customer
Find cart by session
Find cart items
```

Candidate indexes:

```text
(store_id, customer_id, status)
(store_id, session_id, status)
```

Depending on the cart lifecycle, uniqueness may be enforced for an active cart.

For example, a store/customer may have at most one active cart.

That rule should be represented through an appropriate constraint where possible.

---

# 17. Cart Item Indexes

Common queries:

```text
Get items for cart
Find whether a variant is already in cart
```

Candidate indexes:

```text
(cart_id)
UNIQUE(cart_id, variant_id)
```

The unique constraint prevents duplicate rows for the same variant within one cart.

Quantity should normally be updated rather than creating duplicate cart-item records.

---

# 18. Discount Indexes

Common queries:

```text
List discounts for a store
Find active discounts
Find discount by code
```

Candidate indexes:

```text
(store_id, status)
(store_id, starts_at, ends_at)
```

Time-based indexing must reflect actual discount evaluation queries.

The application should not scan every discount in a store during checkout.

---

# 19. Discount Code Indexes

Discount-code lookup is usually highly selective.

Recommended uniqueness pattern:

```text
UNIQUE(store_id, code)
```

This supports:

```text
Find discount code by store + code
```

Codes should be normalized consistently before lookup.

For example, if codes are case-insensitive, the database representation and uniqueness strategy must reflect that requirement.

---

# 20. Discount Usage Indexes

Common queries:

```text
Count usage for a discount
Count usage by customer
Find whether customer has already used a discount
Find usage associated with an order
```

Candidate indexes:

```text
(discount_id)
(discount_id, customer_id)
(order_id)
```

For customer-specific usage limits:

```text
(discount_id, customer_id)
```

may also support the relevant uniqueness rule.

Concurrency must still be handled correctly.

An index does not automatically make a usage-limit operation race-free.

---

# 21. Checkout Indexes

Common queries:

```text
Find checkout by ID
Find checkouts for a customer
Find active checkout for a cart
List recent checkouts for a store
```

Candidate indexes:

```text
(store_id, status, created_at)
(cart_id)
(customer_id, created_at)
```

If only one active checkout is permitted for a particular cart, that invariant should be enforced through a suitable constraint.

---

# 22. Checkout Item Indexes

Common query:

```text
Get items belonging to a checkout
```

Candidate index:

```text
(checkout_id)
```

If duplicate variants are not allowed within a checkout:

```text
UNIQUE(checkout_id, variant_id)
```

may be appropriate.

The business model must determine whether duplicate line items are permitted.

---

# 23. Payment Indexes

Payments require fast lookup during checkout and order workflows.

Common queries:

```text
Find payment for checkout
Find payment for order
Find provider payment
Find payments for a store
```

Candidate indexes:

```text
(checkout_id)
(order_id)
(store_id, created_at)
(provider, provider_reference)
```

Provider references should generally have a uniqueness constraint within the relevant provider scope.

Example:

```text
UNIQUE(provider, provider_reference)
```

if provider identifiers are globally unique per provider.

---

# 24. Payment Attempt Indexes

Common queries:

```text
Get attempts for payment
Find provider attempt
Find failed attempts
```

Candidate indexes:

```text
(payment_id, created_at)
(provider, provider_reference)
```

An attempt number may also be unique within a payment:

```text
UNIQUE(payment_id, attempt_number)
```

This prevents duplicate attempt numbers.

---

# 25. Payment Idempotency Indexes

Idempotency lookup must be highly selective.

Candidate uniqueness:

```text
UNIQUE(store_id, operation_type, idempotency_key)
```

The exact uniqueness scope depends on the operation.

The system must prevent:

```text
Request A
    ↓
idempotency_key = X
    ↓
financial effect

Request B
    ↓
same idempotency_key = X
    ↓
second financial effect
```

The database should provide a final integrity barrier.

---

# 26. Order Indexes

Orders are among the most frequently queried merchant entities.

Common queries:

```text
List orders for a store
List recent orders
Filter by status
Find order by customer
Find order by order number
```

Candidate indexes:

```text
(store_id, created_at)
(store_id, status, created_at)
(store_id, customer_id, created_at)
(store_id, order_number)
```

The first index is likely one of the most important indexes in the system.

---

# 27. Order Number

Customer-facing order numbers should be efficiently searchable.

If order numbers are unique within a store:

```text
UNIQUE(store_id, order_number)
```

This provides both:

- uniqueness
- lookup support

A globally unique order number may instead use a global unique constraint.

The choice is a product requirement, not an indexing preference.

---

# 28. Order Item Indexes

Common queries:

```text
Get items for an order
Find orders containing a particular product/variant
```

Candidate indexes:

```text
(order_id)
(variant_id)
```

The second index should only be added if product-level order-history queries are actually required.

Order item tables can become large, so unnecessary indexes should be avoided.

---

# 29. Order Address Indexes

Primary access pattern:

```text
Get addresses for an order
```

Candidate:

```text
(order_id, type)
```

If only one billing and one shipping address are allowed, the relationship may also support a uniqueness constraint:

```text
UNIQUE(order_id, type)
```

---

# 30. Order Status History Indexes

Common queries:

```text
Get status history for an order
Get recent status changes
```

Recommended:

```text
(order_id, created_at)
```

History is normally retrieved chronologically.

The current status remains on the Order table so normal queries do not need to scan the history.

---

# 31. Webhook Event Indexes

Webhook processing requires efficient duplicate detection.

Candidate uniqueness:

```text
UNIQUE(provider, provider_event_id)
```

Additional operational index:

```text
(status, created_at)
```

may support retry/failure processing.

Webhook records should allow the worker to determine whether an event has already been processed.

---

# 32. Background Job Indexes

For PostgreSQL-backed jobs, common queries include:

```text
Find available jobs
Find failed jobs
Find jobs for retry
Find jobs belonging to a tenant
```

Potential indexes:

```text
(status, available_at)
(status, created_at)
(store_id, status)
```

The exact job queue implementation may change later.

The schema should not over-optimize for a queue implementation that may eventually be replaced by Redis or another managed system.

---

# 33. Composite Index Ordering

Column order must reflect query behavior.

Consider:

```text
(store_id, status, created_at)
```

This is useful for queries such as:

```sql
WHERE store_id = $1
  AND status = $2
ORDER BY created_at DESC
```

It is not equivalent to:

```text
(status, store_id, created_at)
```

for every workload.

The index order should therefore be selected from real query patterns.

---

# 34. Equality Before Range/Ordering

As a general indexing heuristic:

```text
Equality filters
    ↓
Selective filters
    ↓
Range conditions
    ↓
Ordering
```

For example:

```text
(store_id, status, created_at)
```

can support:

```sql
WHERE store_id = ?
  AND status = ?
ORDER BY created_at DESC
```

This is a heuristic, not an absolute rule.

Actual PostgreSQL query plans should determine final choices.

---

# 35. Unique Constraints as Indexes

Where business rules require uniqueness, prefer a database constraint rather than a manually maintained lookup mechanism.

Examples:

```text
UNIQUE(user_id, store_id)

UNIQUE(store_id, slug)

UNIQUE(store_id, sku)

UNIQUE(store_id, code)

UNIQUE(store_id, order_number)

UNIQUE(provider, provider_reference)
```

These constraints also provide indexes that can support lookup.

Do not create a second identical non-unique index.

---

# 36. Partial Indexes

Partial indexes may be useful for highly common filtered states.

Example:

```text
Active products only
Active carts only
Pending jobs only
```

Conceptually:

```sql
CREATE INDEX ...
ON products(store_id, created_at)
WHERE status = 'ACTIVE';
```

Partial indexes should be introduced only when:

- the query pattern is stable
- the filtered subset is meaningfully smaller
- the index provides measurable value

They should not be used merely because PostgreSQL supports them.

---

# 37. Indexing Stateful Tables

Stateful tables commonly use:

```text
store_id
status
created_at
```

Examples:

- orders
- checkouts
- payments
- jobs
- discounts

Common composite pattern:

```text
(store_id, status, created_at)
```

However, each table should be evaluated independently.

A single generic index strategy must not be blindly copied across every table.

---

# 38. Foreign-Key Indexing

Foreign keys should be evaluated for supporting indexes.

Important examples:

```text
product_variants.product_id
inventory_adjustments.inventory_item_id
cart_items.cart_id
checkout_items.checkout_id
payment_attempts.payment_id
order_items.order_id
order_status_history.order_id
customer_addresses.customer_id
```

Indexes on these relationships improve parent-to-child retrieval and may also help certain update/delete operations.

---

# 39. Store-Scoped Foreign Keys

Where tenant integrity is particularly important, the schema may use composite relationships to ensure that both:

```text
store_id
```

and:

```text
referenced_entity_id
```

belong to the same tenant.

This should be used selectively.

The model should not become unnecessarily complicated merely to duplicate store information across every foreign key.

The application authorization boundary remains mandatory regardless of database indexing.

---

# 40. Search and Text Indexing

The Demo platform does not require a dedicated search engine.

Basic product discovery may initially use:

- B-tree indexes for exact/filter queries
- PostgreSQL text capabilities where required
- controlled query patterns

A dedicated search engine should only be introduced when PostgreSQL no longer satisfies measurable product or performance requirements.

Search infrastructure must remain derived from PostgreSQL.

---

# 41. Slug Indexing

Storefront resources commonly require slug lookup.

Examples:

```text
/products/premium-shirt
/stores/example-store
```

Candidate indexes:

```text
(store_id, slug)
```

Uniqueness should match the URL model.

For store-scoped product URLs:

```text
UNIQUE(store_id, slug)
```

may be appropriate.

---

# 42. Email Indexing

Customer and user email addresses may be queried frequently.

The platform must define whether email matching is:

- case-sensitive
- case-insensitive
- normalized before persistence

Once defined, the indexing strategy must match that behavior.

For example, if normalized lowercase email is canonical:

```text
UNIQUE(store_id, normalized_email)
```

can provide deterministic lookup.

---

# 43. Indexes for Public Storefront Queries

Public storefront queries should remain tenant-scoped.

Typical queries:

```text
Find store by slug
List published products
Find product by slug
List product variants
Get product media
```

Indexes should support:

```text
store lookup
    ↓
published catalog
    ↓
product slug
    ↓
variants
```

Public access does not justify removing tenant conditions from queries.

---

# 44. Indexes for Merchant Dashboards

Merchant dashboards commonly require:

```text
Recent orders
Orders by status
Recent customers
Product catalog
Inventory warnings
Discounts
```

Indexes should prioritize these operational workflows.

Example:

```text
Orders:
(store_id, created_at)

Orders by status:
(store_id, status, created_at)

Customers:
(store_id, created_at)

Products:
(store_id, status, created_at)

Inventory:
(store_id, available_quantity)
```

The final inventory index should only be added if low-stock queries are frequent enough to justify it.

---

# 45. Indexes and Write Performance

Every index increases write cost.

An insert or update may need to update multiple index structures.

This is particularly important for:

- carts
- inventory
- payments
- order history
- webhook events
- job tables

Therefore:

```text
More indexes ≠ automatically better performance
```

The correct objective is:

```text
Minimum indexes required for correctness and important access patterns
```

---

# 46. Indexes on Historical Tables

Historical tables may grow significantly over time.

Examples:

- order items
- order status history
- inventory adjustments
- payment attempts
- webhook events
- job records

Indexes should focus on actual operational queries.

For example:

```text
order_status_history:
(order_id, created_at)

inventory_adjustments:
(inventory_item_id, created_at)

payment_attempts:
(payment_id, created_at)
```

Additional reporting indexes should only be added when reporting requirements justify them.

---

# 47. Index Maintenance

Production operations should monitor:

- slow queries
- index usage
- index size
- table growth
- unused indexes
- duplicate indexes
- query-plan regressions

Indexes should periodically be reviewed.

An index that was useful at Demo scale may become unnecessary or inefficient later.

Likewise, a missing index may only become obvious once real production workloads exist.

---

# 48. Query Plan Validation

Significant indexing decisions should be validated using PostgreSQL tools such as:

```sql
EXPLAIN
EXPLAIN ANALYZE
```

Validation should consider:

- actual row counts
- selectivity
- execution time
- index scans
- sequential scans
- sorting cost
- join strategy
- buffer usage where appropriate

Performance decisions should be based on evidence rather than intuition.

---

# 49. Index Naming

Index names should be:

- deterministic
- descriptive
- consistent
- easy to identify during debugging

A consistent pattern should be selected during implementation.

For example:

```text
idx_orders_store_created_at
idx_orders_store_status_created_at
uq_orders_store_order_number
```

The exact naming convention should be applied consistently throughout migrations.

---

# 50. Indexing Anti-Patterns

Avoid:

### Indexing every column

This increases storage and write overhead without guaranteeing useful performance.

### Duplicate indexes

Example:

```text
INDEX(store_id)
INDEX(store_id)
```

Only one is necessary.

### Wrong composite order

An index with the wrong leading columns may provide little benefit.

### Indexing speculative future queries

Do not optimize for features that do not exist.

### Using indexes instead of constraints

If uniqueness is a business invariant, enforce it with a database constraint.

### Removing tenant predicates because an index exists

Indexes improve query performance.

They do not provide authorization.

### Building a search engine prematurely

PostgreSQL should handle Demo catalog queries unless measurable requirements prove otherwise.

---

# 51. Initial Demo Index Set

The initial implementation should prioritize the following categories.

## Identity

```text
organizations
organization_memberships
store_memberships
```

## Stores

```text
stores(organization_id, slug)
```

## Products

```text
products(store_id, slug)
products(store_id, status, created_at)
product_variants(product_id)
product_variants(store_id, sku)
```

## Inventory

```text
inventory_items(variant_id)
inventory_adjustments(inventory_item_id, created_at)
```

## Customers

```text
customers(store_id, email)
customers(store_id, created_at)
customer_addresses(customer_id)
```

## Carts

```text
carts(store_id, customer_id, status)
carts(store_id, session_id, status)
cart_items(cart_id)
```

## Discounts

```text
discounts(store_id, status)
discount_codes(store_id, code)
discount_usages(discount_id, customer_id)
```

## Checkout

```text
checkouts(store_id, status, created_at)
checkout_items(checkout_id)
```

## Payments

```text
payments(checkout_id)
payments(order_id)
payments(provider, provider_reference)
payment_attempts(payment_id, created_at)
```

## Orders

```text
orders(store_id, created_at)
orders(store_id, status, created_at)
orders(store_id, customer_id, created_at)
orders(store_id, order_number)
order_items(order_id)
order_status_history(order_id, created_at)
```

## Background Processing

```text
jobs(status, available_at)
webhook_events(provider, provider_event_id)
```

This is an initial candidate set, not a command to blindly create every index listed.

---

# 52. Index Review Process

Before adding an index:

1. Identify the actual query.
2. Determine the filtering conditions.
3. Determine ordering requirements.
4. Determine expected selectivity.
5. Check existing indexes.
6. Check whether a constraint already provides the required index.
7. Evaluate write overhead.
8. Test with realistic data.
9. Inspect the query plan.
10. Add the smallest useful index.
11. Monitor usage after deployment.

---

# 53. Demo-to-V1 Evolution

As the platform grows, indexing may evolve to support:

- larger catalogs
- high-volume order tables
- analytics queries
- advanced storefront filtering
- search
- reporting
- read replicas
- partitioned tables

These changes should be driven by measured workloads.

Potential V1 additions include:

- specialized indexes
- partial indexes
- covering indexes
- PostgreSQL full-text search
- materialized views
- read replicas
- dedicated search infrastructure

These are not required merely because they might eventually be useful.

---

# 54. Indexing Invariants

The following must remain true:

1. Primary keys are indexed.
2. Required uniqueness is enforced by database constraints.
3. Important tenant-scoped queries have appropriate indexes.
4. Foreign-key access patterns are considered.
5. Indexes reflect actual query patterns.
6. Critical merchant queries remain efficient as data grows.
7. Checkout and payment lookups are fast enough for transactional workflows.
8. Indexes do not replace authorization.
9. Indexes do not replace database constraints.
10. Duplicate or unnecessary indexes are avoided.
11. Historical tables receive only useful indexes.
12. Search infrastructure is not introduced without a concrete requirement.
13. Index changes are migration-driven.
14. Significant performance decisions are validated with query plans.

---

# 55. Definition of Done

The indexing strategy is complete when:

- Core access patterns are identified.
- Tenant-scoped queries are covered.
- Important uniqueness constraints are identified.
- Foreign-key indexing needs are understood.
- Merchant dashboard queries are supported.
- Storefront queries are supported.
- Checkout/payment/order lookups are supported.
- Historical tables have appropriate access paths.
- Write-heavy tables are not over-indexed.
- Index decisions can be validated with real query plans.
- The initial Demo schema can evolve without requiring speculative infrastructure.