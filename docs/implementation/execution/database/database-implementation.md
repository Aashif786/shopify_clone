
# Database Implementation

## 1. Purpose

This document defines the concrete implementation required to establish PostgreSQL as the transactional source of truth for the Demo.

The database implementation must provide:

- Reliable PostgreSQL connectivity.
- Clear schema ownership.
- Transaction support.
- Migration support.
- Repository boundaries.
- Referential integrity.
- Concurrency safety.
- Test database support.
- Health checks.
- Safe shutdown.
- Production-ready fundamentals without premature database infrastructure.

---

# 2. Database Technology

The Demo uses:

```text
PostgreSQL
```

PostgreSQL is authoritative for:

- Products.
- Inventory.
- Customers.
- Carts.
- Discounts.
- Checkout.
- Payments.
- Orders.
- Stores.
- Memberships.
- Durable jobs.
- Webhooks.
- Other transactional application state.

External systems must not become the authoritative source for core business state.

---

# 3. Database Ownership

Shared database infrastructure belongs to:

```text
packages/db
```

Domain persistence belongs to the owning domain module.

Example:

```text
modules/products/
└── infrastructure/
    └── product-repository.ts
```

not:

```text
packages/db/
└── product-repository.ts
```

This ensures that database access does not erase module boundaries.

---

# 4. Database Architecture

The runtime relationship is:

```text
Web / Worker
      ↓
Application Service
      ↓
Domain Module
      ↓
Repository
      ↓
PostgreSQL
```

The database must not be accessed directly by:

- React components.
- Route handlers.
- UI components.
- Unrelated domain modules.
- Background-job infrastructure bypassing domain ownership.

---

# 5. Local PostgreSQL

Local development should use Docker.

Conceptually:

```text
Developer Machine
       │
       ├── apps/web
       ├── apps/worker
       │
       └── Docker
             └── PostgreSQL
```

The local database must be disposable.

Developers should be able to recreate it from migrations and seeds.

---

# 6. Database Package

`packages/db` should provide:

```text
Client
Connection Pool
Transaction Helper
Health Check
Lifecycle Management
```

It must not contain domain business rules.

---

# 7. Database Client

The implementation should provide a centralized PostgreSQL client.

Requirements:

- Connection pooling.
- Configurable pool limits.
- Connection timeout.
- Query timeout where appropriate.
- Clean shutdown.
- Test-friendly lifecycle.

The application should not create a new pool for every request.

---

# 8. Connection Pooling

Pool configuration should be environment-specific.

Development may use a small pool.

Production should use a pool appropriate for:

- VPS resources.
- PostgreSQL capacity.
- Web concurrency.
- Worker concurrency.

Connection limits must be considered across all application processes.

---

# 9. Web and Worker Connections

Both applications may use PostgreSQL.

Conceptually:

```text
Web
 └── DB Pool

Worker
 └── DB Pool

       ↓

PostgreSQL
```

Pool sizes must be chosen so combined connections remain within PostgreSQL limits.

---

# 10. Configuration

Database configuration comes from:

```text
packages/config
```

At minimum:

```text
DATABASE_URL
```

Additional tuning variables should only be introduced when necessary.

The database package must not read environment variables directly.

---

# 11. Health Check

The database package should expose a lightweight connectivity check.

Conceptually:

```sql
SELECT 1;
```

The health check must:

- Be inexpensive.
- Have a timeout.
- Avoid modifying application state.
- Return a useful failure result.

---

# 12. Schema Ownership

Each domain owns its tables.

Example:

```text
Stores       → Stores module
Products     → Products module
Inventory    → Inventory module
Customers    → Customers module
Carts        → Carts module
Discounts    → Discounts module
Checkout     → Checkout module
Payments     → Payments module
Orders       → Orders module
Jobs         → Jobs integration
Webhooks     → Webhooks integration
```

Cross-domain foreign keys may exist when required for integrity, but ownership remains explicit.

---

# 13. Database Naming

Use consistent PostgreSQL naming conventions.

Recommended:

```text
snake_case
```

Examples:

```text
store_id
created_at
updated_at
payment_status
order_number
```

Avoid inconsistent mixtures of:

```text
camelCase
PascalCase
snake_case
```

inside database identifiers.

---

# 14. Primary Keys

All major entities require stable primary keys.

The exact ID strategy should be selected consistently across the project.

Possible approaches include:

- UUID.
- UUIDv7.
- Another sortable globally unique identifier.

The selected strategy must be documented and used consistently.

---

# 15. Foreign Keys

Use foreign keys to enforce database-level relationships.

Examples:

```text
product.store_id → stores.id
variant.product_id → products.id
order.store_id → stores.id
order_item.order_id → orders.id
```

Foreign keys are an important final integrity boundary.

Application logic must not be the only protection against invalid relationships.

---

# 16. Tenant Scoping

Store-owned records should carry explicit ownership context where required.

Example:

```text
products.store_id
orders.store_id
customers.store_id
carts.store_id
discounts.store_id
```

Repositories should query using the correct Store scope.

Tenant isolation must exist at:

```text
Application
+
Repository
+
Database Constraints
```

where applicable.

---

# 17. Unique Constraints

Use database uniqueness constraints for invariants that must never be duplicated.

Examples:

```text
store slug
store domain
product SKU within Store
discount code within Store
membership identity relationships
provider event IDs
idempotency keys
```

Exact uniqueness rules belong to their domain specifications.

---

# 18. Indexes

Indexes should be created for:

- Foreign keys used in queries.
- Store-scoped lookups.
- Unique identifiers.
- Status-based worker queries.
- Frequently queried public identifiers.
- Time-based job processing.
- Common order/product/customer queries.

Do not create indexes solely because a column exists.

Each important index should support a known query pattern.

---

# 19. Query Design

Queries should:

- Select only required columns where practical.
- Use appropriate indexes.
- Apply Store/tenant scope.
- Avoid unnecessary joins.
- Avoid N+1 access patterns.
- Use pagination for large collections.

Database queries must not silently bypass tenant filters.

---

# 20. Repository Pattern

Repositories should encapsulate persistence behavior.

Example:

```text id="m4c8x7"
ProductRepository
├── create
├── findById
├── list
├── update
└── delete / archive
```

The repository should not contain unrelated business orchestration.

---

# 21. Repository Scope

A repository method should make ownership explicit where required.

Preferred:

```text id="x7m3c8"
findById(storeId, productId)
```

rather than:

```text id="q8m4c7"
findById(productId)
```

for Store-owned resources.

This reduces accidental cross-tenant access.

---

# 22. Transactions

Business transaction boundaries belong to application services.

Example:

```text id="v6m4c8"
Checkout Application Service
        ↓
BEGIN
        ↓
Validate / Lock / Update
        ↓
Create Payment State
        ↓
Create Order State
        ↓
COMMIT
```

The exact transaction contents depend on the workflow.

---

# 23. Transaction Rules

Transactions should:

- Be short.
- Perform only necessary database work.
- Avoid network calls.
- Avoid file uploads.
- Avoid email delivery.
- Avoid long computation.

External calls should occur outside database transactions unless a carefully designed coordination pattern requires otherwise.

---

# 24. Isolation Level

Default to:

```text
READ COMMITTED
```

Use stronger isolation only when required by a specific correctness property.

Do not use `SERIALIZABLE` globally as a substitute for understanding concurrency.

---

# 25. Row Locking

Use row-level locks for critical mutable resources.

Examples:

```text
Inventory
Payment state
Checkout state
Order state
Discount usage
Job claiming
```

Locks should be acquired deliberately.

---

# 26. Deterministic Lock Ordering

When multiple rows must be locked:

```text id="q5m8c4"
Sort resources deterministically
        ↓
Acquire locks in the same order
```

This reduces deadlock risk.

---

# 27. Atomic Updates

Where appropriate, prefer atomic SQL updates.

Example concept:

```sql
UPDATE inventory
SET available_quantity = available_quantity - $quantity
WHERE id = $id
  AND available_quantity >= $quantity;
```

The application should verify affected rows.

This prevents race conditions caused by:

```text
Read
 ↓
Calculate
 ↓
Write
```

being performed without concurrency protection.

---

# 28. Money Representation

Monetary values must never use floating-point arithmetic.

Use:

- Integer minor units, or
- PostgreSQL numeric/decimal with explicit precision.

The selected representation must be consistent across the application.

Example:

```text
₹999.50
```

may be represented as:

```text
99950 paise
```

if integer minor units are selected.

---

# 29. Timestamps

Use a consistent timestamp strategy.

Prefer timezone-aware database timestamps.

Store canonical timestamps in UTC.

Application display timezone should be handled at presentation boundaries.

---

# 30. Historical Data

Completed orders must preserve historical information.

Order items should capture appropriate snapshots such as:

- Product name.
- SKU.
- Price.
- Quantity.
- Relevant discount information.
- Billing/shipping address information.

Later changes to the current Product or Customer must not rewrite completed order history.

---

# 31. Soft Deletion

Soft deletion should only be used where it provides a meaningful business benefit.

Do not automatically add:

```text
deleted_at
```

to every table.

For historical or referentially important records, archival/status transitions may be preferable.

---

# 32. Database Errors

Infrastructure should translate raw database errors into application-understandable categories where appropriate.

Examples:

```text
Unique violation → Conflict
Foreign key violation → Invalid relationship / Conflict
Connection failure → Infrastructure failure
Serialization/deadlock → Retryable concurrency failure
```

Raw SQL errors must not be returned directly to clients.

---

# 33. Deadlock Handling

Deadlocks may occur even with careful design.

The application should:

1. Detect retryable database concurrency failures.
2. Retry a bounded number of times where safe.
3. Avoid infinite retry loops.
4. Log enough information for diagnosis.

Retries must occur at the appropriate transaction/application-service boundary.

---

# 34. Migration Integration

The database package must integrate cleanly with the migration system.

Application startup should not automatically perform arbitrary production schema changes unless explicitly designed and approved.

Prefer:

```text
Deploy
 ↓
Run Migration
 ↓
Start Application
```

or an equivalent controlled deployment workflow.

---

# 35. Database Seeds

Seeds must remain separate from migrations.

Migrations change schema.

Seeds create controlled development/test/demo data.

Never place large Demo datasets inside schema migrations.

---

# 36. Test Database

Integration tests should use an isolated PostgreSQL database.

The test database must not be:

- Developer production data.
- Demo production database.
- Shared uncontrolled development state.

Tests should establish predictable starting state.

---

# 37. Database Fixtures

Fixtures should create valid domain state.

For example, a checkout fixture should not bypass required:

- Store.
- Product.
- Variant.
- Inventory.
- Customer.

relationships.

Fixtures should use application or repository mechanisms appropriate to the test layer.

---

# 38. Database Reset

Local development should support controlled database reset.

Conceptually:

```text id="m7c4x8"
Drop / Recreate
      ↓
Run Migrations
      ↓
Seed
```

Production databases must never be reset using local development commands.

---

# 39. Backup Strategy

Production PostgreSQL must have backups appropriate to the Demo's operational requirements.

At minimum:

- Automated backup mechanism.
- Retention policy.
- Restore procedure.
- Periodic restore verification.

A backup that has never been restored is merely a hopeful collection of bytes.

---

# 40. Database Monitoring

Monitor:

- Connection usage.
- Query latency.
- Error rate.
- CPU.
- Memory.
- Storage.
- Locks.
- Deadlocks.
- Slow queries.
- Backup status.

Monitoring should be proportional to Demo infrastructure.

---

# 41. Database Security

Database access must use:

- Strong credentials.
- Restricted network access.
- TLS where appropriate.
- Least-privileged application credentials.
- Separate credentials/environments.

The database should not be publicly exposed to the internet.

---

# 42. Schema Verification

CI should verify that migrations can be applied to a clean database.

At minimum:

```text id="x8m4c7"
Empty Database
    ↓
All Migrations
    ↓
Schema Created
    ↓
Application Tests
```

This catches migration ordering and dependency problems.

---

# 43. Existing Database Verification

When migrations are introduced against an existing development database:

- Backups should exist where appropriate.
- Data preservation must be verified.
- Destructive changes require explicit review.
- Migration behavior must be tested before deployment.

---

# 44. Database Implementation Sequence

Implement in this order:

```text id="q4m8c7"
1. Configure PostgreSQL
2. Implement DB client
3. Implement connection pool
4. Implement transaction helper
5. Implement health check
6. Establish migration tooling
7. Establish test database tooling
8. Establish base schema
9. Implement repository conventions
10. Add domain migrations incrementally
11. Add indexes and constraints
12. Add concurrency safeguards
13. Add database tests
14. Verify clean database migration
15. Verify application integration
```

---

# 45. Database Verification

The database foundation is ready when:

```text id="v7m4c8"
[ ] PostgreSQL starts locally
[ ] Application connects successfully
[ ] Worker connects successfully
[ ] Connection pooling works
[ ] Transactions work
[ ] Health checks work
[ ] Migrations execute
[ ] Clean database can be built
[ ] Test database is isolated
[ ] Foreign keys are enforced
[ ] Required constraints exist
[ ] Tenant scoping is enforced
[ ] Critical indexes exist
[ ] Concurrency controls are testable
[ ] Database errors are translated
[ ] Shutdown closes connections
```

---

# 46. Definition of Done

The database implementation is complete when PostgreSQL provides a reliable, testable, transaction-safe foundation for the entire Demo.

The implementation must preserve:

```text
PostgreSQL Source of Truth
+
Explicit Ownership
+
Tenant Isolation
+
Referential Integrity
+
Transactional Correctness
+
Concurrency Safety
+
Migration Discipline
+
Operational Recoverability
```

The database should remain boring infrastructure with strong guarantees. The interesting complexity belongs in the commerce system, where apparently humanity decided selling a T-shirt needed distributed-systems-level correctness.