# Database Bootstrap Implementation

## 1. Purpose

This document defines the implementation plan for establishing PostgreSQL as the transactional database for the Demo.

The database foundation must provide:

- Reliable connectivity.
- Connection pooling.
- Transaction support.
- Environment isolation.
- Safe local development.
- Health verification.
- Clean application integration.

Business-domain schema creation is handled separately by the migration and domain implementation stages.

---

# 2. Database Technology

The Demo uses:

```text
PostgreSQL
```

PostgreSQL is the authoritative transactional source of truth for:

- Stores.
- Products.
- Inventory.
- Customers.
- Carts.
- Discounts.
- Checkout.
- Payments.
- Orders.
- Jobs.
- Idempotency records.
- Webhook processing state.

---

# 3. Database Package

Database infrastructure belongs in:

```text
packages/db
```

The package provides the technical database boundary.

It should own:

- Database client initialization.
- Connection pooling.
- Transaction helpers.
- Database lifecycle management.
- Database health checks.
- Database-specific infrastructure utilities.

---

# 4. Database Ownership

`packages/db` owns database infrastructure.

Individual domain modules own their repositories and persistence behavior.

Example:

```text
packages/db
    ↓
PostgreSQL connection

modules/products
    ↓
Product repository
```

The DB package must not become the owner of every domain's data-access logic.

---

# 5. Database Configuration

The primary connection configuration should be supplied through the configuration package.

Conceptually:

```text
DATABASE_URL
```

The actual configuration interface should be consumed through:

```text
packages/config
```

rather than reading `process.env` directly inside the DB package.

---

# 6. Connection Pool

The application should use a PostgreSQL connection pool.

The pool must:

- Reuse connections.
- Limit concurrent connections.
- Release connections correctly.
- Support transactions.
- Close cleanly during shutdown.

Connection limits should be conservative for the Demo VPS environment.

---

# 7. Web Database Access

The Web application should use the shared database infrastructure.

Typical flow:

```text
HTTP Request
    ↓
Application Service
    ↓
Repository
    ↓
DB Package
    ↓
PostgreSQL
```

The request handler should not construct raw database connections.

---

# 8. Worker Database Access

The Worker uses the same database infrastructure.

Typical flow:

```text
Worker
    ↓
Job Handler
    ↓
Application Service
    ↓
Repository
    ↓
DB Package
    ↓
PostgreSQL
```

Worker concurrency must respect the available database connection capacity.

---

# 9. Database Client Lifecycle

The DB client should be initialized once per application process where the underlying database library requires a shared client/pool.

Avoid creating a new pool for every request or job.

---

# 10. Development Database

Local development should use a dedicated PostgreSQL instance.

Docker is the preferred initial approach:

```text
Developer Machine
    ↓
Docker
    ↓
PostgreSQL
```

This reduces local-machine dependency differences.

---

# 11. Production Database

The Demo may initially use PostgreSQL on the VPS or an appropriate managed PostgreSQL deployment.

The application must not depend on the physical location of PostgreSQL.

The database connection is configured through environment-specific configuration.

---

# 12. Environment Isolation

Development, test, and production databases must remain separate.

At minimum:

```text
development → development DB
test        → test DB
production  → production DB
```

Production data must never be used as the normal test database.

---

# 13. Test Database

Integration tests require an isolated database.

The test database should support:

- Schema initialization.
- Migration execution.
- Test data creation.
- Transactional or fixture cleanup.
- Parallel test isolation where required.

---

# 14. Database Schema Management

Schema changes must be managed through version-controlled migrations.

Do not manually modify production schema as the normal workflow.

Migration files should be committed with the application code.

---

# 15. Migration Ownership

Migration tooling may live alongside the database package or repository infrastructure.

The important rule is:

```text
Application Schema
        ↓
Version-Controlled Migration
        ↓
PostgreSQL
```

The exact migration library should be selected according to the existing project dependency strategy.

---

# 16. Initial Database Bootstrap

The initial bootstrap should establish:

```text
PostgreSQL
    ↓
Connection
    ↓
Migration System
    ↓
Initial Schema
    ↓
Seed Strategy
```

Do not create the entire final domain schema as an unstructured initial SQL file if the migration strategy requires incremental evolution.

---

# 17. Schema Naming

Database naming conventions must remain consistent.

Recommended approach:

- Lowercase identifiers.
- `snake_case` for database objects.
- Explicit primary keys.
- Explicit foreign keys.
- Explicit indexes.
- Explicit constraints.

Example:

```text
store_id
created_at
updated_at
```

---

# 18. Primary Keys

Primary keys must use the project's chosen identifier strategy consistently.

The strategy must be established before domain tables are created.

Do not mix unrelated identifier formats across domains without a documented reason.

---

# 19. Foreign Keys

Foreign keys should be used for database-level referential integrity.

For example:

```text
product
    ↓
product_variant
```

must not rely solely on application code to preserve relationships.

---

# 20. Tenant Scoping

Store-owned records should contain the required ownership relationship needed to enforce tenant isolation.

The database schema should support the hierarchy:

```text
Organization
    ↓
Store
    ↓
Store-owned resource
```

Tenant isolation must remain enforceable through application logic and database constraints.

---

# 21. Timestamps

Persistent records should use consistent timestamp conventions.

At minimum, records requiring lifecycle tracking should normally have:

```text
created_at
updated_at
```

Time values must be stored consistently and interpreted according to the project's time-handling rules.

---

# 22. Money Representation

Monetary values must never use floating-point database types.

Use an exact representation appropriate to the established database strategy.

For example:

```text
amount_minor_units
currency
```

or an equivalent exact monetary model.

---

# 23. Status Fields

Status values should use explicit, controlled representations.

Examples:

```text
active
inactive
draft
published
pending
completed
failed
```

The valid transitions are defined by domain state-machine documentation.

Database constraints should prevent invalid values where practical.

---

# 24. Uniqueness

Database uniqueness constraints must protect business invariants that must remain unique.

Examples may include:

- Store identifiers.
- Product slugs within a Store.
- SKUs where uniqueness is required.
- Discount codes within their defined scope.
- Idempotency keys within their operation scope.
- Provider webhook event identifiers.

Application checks alone are insufficient for concurrency-sensitive uniqueness.

---

# 25. Indexes

Indexes should be created according to actual access patterns.

Important early access patterns include:

- Store lookup.
- Product listing.
- Product slug lookup.
- Inventory lookup.
- Customer lookup.
- Cart lookup.
- Order lookup.
- Job claiming.
- Idempotency lookup.
- Webhook deduplication.

Do not create indexes for every column by default.

---

# 26. Transactions

Transactions must be controlled at the application-service/use-case level.

Example:

```text
Application Service
    ↓
BEGIN
    ↓
Domain operations
    ↓
Repository operations
    ↓
COMMIT
```

Repositories should not independently create competing transaction boundaries for one business operation.

---

# 27. Transaction Duration

Transactions should remain short.

Do not hold database transactions open while waiting for:

- Payment providers.
- Email providers.
- Object storage.
- External HTTP requests.
- Long-running computation.

---

# 28. External Calls

External service calls should normally occur outside critical database transactions.

Preferred pattern:

```text
Database transaction
    ↓
Persist required state
    ↓
Commit
    ↓
External operation
    ↓
Persist result / process callback
```

The exact payment and checkout workflow follows the domain-specific specifications.

---

# 29. Concurrency

Database operations that modify shared business state must account for concurrent requests.

Important examples:

- Inventory.
- Reservations.
- Cart updates.
- Discount usage.
- Checkout completion.
- Payment state.
- Order transitions.
- Idempotency records.
- Job claiming.

The implementation should use appropriate PostgreSQL mechanisms such as:

- Row locks.
- Atomic updates.
- Unique constraints.
- Transaction isolation.
- Conditional updates.

---

# 30. Deadlock Prevention

Where multiple rows must be locked, the application should use a deterministic lock order.

For example:

```text
Sort IDs ascending
        ↓
Lock rows
        ↓
Modify state
```

The exact ordering belongs to the relevant domain implementation.

---

# 31. Database Error Handling

Database errors should be translated appropriately at application boundaries.

Examples:

```text
Unique constraint violation
    ↓
Conflict / domain-specific error

Foreign key violation
    ↓
Application integrity error

Connection failure
    ↓
Infrastructure failure
```

Raw database errors must not be returned directly to API consumers.

---

# 32. Connection Failure

If PostgreSQL is unavailable:

- Web requests requiring the database should fail safely.
- Worker processing should retry according to worker policy.
- Health/readiness should reflect dependency availability.
- Errors should be logged with correlation information.

The application must not silently operate with an assumed database state.

---

# 33. Database Health Check

The DB package should provide a lightweight health operation.

Its purpose is to determine whether the application can establish or use a database connection.

Health checks must not execute expensive application queries.

---

# 34. Graceful Shutdown

During application shutdown:

```text
Stop accepting new work
        ↓
Finish bounded active work
        ↓
Close DB pool
        ↓
Exit
```

Worker shutdown must additionally stop claiming new jobs before closing the database connection.

---

# 35. Local Docker Database

The local Docker database should provide:

- Persistent development volume.
- Configurable port.
- Database name.
- Username.
- Password.
- Health check.

The credentials are development-only.

---

# 36. Database Seed Data

Seed data is separate from migrations.

Migrations define schema.

Seeds provide development/test data.

Example:

```text
Migration
    ↓
Tables / Constraints / Indexes

Seed
    ↓
Demo Store / Products / Users / Data
```

Seed strategy is defined in:

```text
docs/implementation/database/seed-strategy.md
```

---

# 37. Production Seeding

Development/demo seed data must never be automatically inserted into production.

Production initialization should use controlled administrative or deployment procedures.

---

# 38. Database Backups

Production PostgreSQL must have a backup strategy before the Demo is considered deployment-ready.

At minimum, define:

- Backup frequency.
- Retention.
- Storage location.
- Restore procedure.
- Restore verification.

A backup that has never been restored is optimism wearing a technical hat.

---

# 39. Database Monitoring

The Demo should monitor at least:

- Database availability.
- Connection failures.
- Query failures.
- Connection pool exhaustion.
- Slow queries where observable.
- Storage utilization.

More advanced database observability can be introduced when justified.

---

# 40. Migration Safety

Database migrations must:

- Be version-controlled.
- Be reviewed.
- Be reproducible.
- Be tested before production.
- Avoid unnecessary destructive operations.
- Follow expand-and-contract principles for breaking changes.

---

# 41. Migration Deployment

Recommended deployment sequence:

```text
Build
  ↓
Deploy compatible application
  ↓
Run migrations
  ↓
Verify database
  ↓
Restart / promote application
  ↓
Health check
```

The exact sequence may vary depending on whether a migration is backward-compatible.

---

# 42. Schema Compatibility

Application and database versions should remain compatible during deployment transitions.

Avoid migrations that require the old application and new application to switch atomically unless the deployment system explicitly guarantees that behavior.

---

# 43. Database Access Rules

The following are prohibited:

```text
UI → PostgreSQL
API handler → arbitrary SQL business logic
One module → another module's private tables
Domain entity → direct database connection
Client component → database package
```

Database access belongs behind the appropriate infrastructure and module boundaries.

---

# 44. Repository Pattern

Repositories should translate between:

```text
Database Representation
        ↕
Domain Representation
```

They should not become the location for broad business workflows.

Application services coordinate use cases.

Domain logic remains in the owning domain.

---

# 45. Database Package API

The DB package should expose only the infrastructure required by consumers.

Conceptually:

```text
db
transaction
healthCheck
shutdown
```

The exact names depend on implementation.

Avoid exposing low-level connection-management details throughout the application.

---

# 46. Database Bootstrap Tests

The database foundation should verify:

- Connection succeeds.
- Connection failure is handled.
- Transaction commit works.
- Transaction rollback works.
- Pool lifecycle works.
- Health check works.
- Shutdown closes resources.
- Test database isolation works.

---

# 47. Definition of Done

Database bootstrap is complete when:

```text
[ ] PostgreSQL is available locally
[ ] Docker database works
[ ] packages/db exists
[ ] Database configuration is centralized
[ ] Connection pooling works
[ ] Transaction helper works
[ ] Database health check works
[ ] Graceful DB shutdown works
[ ] Migration mechanism is established
[ ] Test database is isolated
[ ] Database naming conventions are documented
[ ] Primary-key strategy is defined
[ ] Foreign-key strategy is defined
[ ] Timestamp conventions are defined
[ ] Money representation is defined
[ ] Indexing principles are defined
[ ] Tenant-scoping requirements are supported
[ ] Concurrency mechanisms are supported
[ ] Database errors are translated safely
[ ] Backup requirements are documented
[ ] Database bootstrap tests pass
```

---

# 48. Final Database Principle

PostgreSQL is not merely where the Demo happens to store data.

It is the authoritative transactional system responsible for preserving business correctness.

The intended architecture is:

```text
Application Service
        ↓
Domain Rules
        ↓
Repository
        ↓
DB Infrastructure
        ↓
PostgreSQL
```

The database provides the final integrity boundary, while application and domain layers provide the business semantics around it.