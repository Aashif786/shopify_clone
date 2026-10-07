# Database Development Workflow

## 1. Purpose

This document defines the development workflow for PostgreSQL schema changes, migrations, database access, testing, and deployment.

The database is the transactional source of truth for the platform. Database changes must therefore be treated as application changes, not as incidental implementation details.

---

## 2. Core Principles

The database workflow follows these principles:

- PostgreSQL is authoritative for transactional state.
- Schema changes are version-controlled.
- Migrations are immutable once applied.
- Application code must respect database ownership boundaries.
- Database constraints provide final integrity protection.
- Transactions are owned by application use cases.
- Critical operations must account for concurrency.
- Destructive changes require deliberate migration planning.
- Production-like data must never be used casually for development.
- Database changes must be tested before deployment.

---

## 3. Database Ownership

Each domain module owns its persistence model.

Examples:

```text
Products      → product-related tables
Inventory     → inventory-related tables
Customers     → customer-related tables
Carts         → cart-related tables
Discounts     → discount-related tables
Checkout      → checkout-related tables
Payments      → payment-related tables
Orders        → order-related tables
Stores        → store-related tables
```

Other modules must not directly manipulate another module's internal tables.

Cross-module operations should use:

- Public application interfaces.
- Application services.
- Domain events.
- Explicit query interfaces where appropriate.

---

## 4. PostgreSQL as Source of Truth

Business-critical state must ultimately be persisted in PostgreSQL.

Examples include:

- Store ownership.
- Memberships.
- Products.
- Inventory.
- Customers.
- Carts.
- Discounts.
- Checkout state.
- Payments.
- Orders.
- Idempotency records.
- Webhook processing state.
- Background jobs.

Caches must never become the authoritative source for these states.

---

## 5. Schema Definition

Database schema definitions must be maintained through the project's database tooling and migrations.

The repository should not depend on manually modified Demo or production schemas.

A fresh database should be reproducible from:

```text id="q8g5tx"
Database tooling
       +
Migration history
       ↓
Current schema
```

---

## 6. Migration Workflow

A normal schema change follows:

```text id="t1m0gq"
Requirement
    ↓
Domain/spec review
    ↓
Schema design
    ↓
Migration creation
    ↓
Migration review
    ↓
Application changes
    ↓
Database tests
    ↓
Integration tests
    ↓
CI
    ↓
Deployment
```

---

## 7. Before Creating a Migration

Before modifying the schema:

1. Identify the owning module.
2. Read the relevant domain and database documentation.
3. Inspect the current schema.
4. Determine whether the change affects existing data.
5. Identify constraints and indexes involved.
6. Identify application compatibility requirements.
7. Determine whether the change requires a staged migration.

---

## 8. Migration Naming

Migration names should clearly describe their purpose.

Examples:

```text
add_product_slug
create_inventory_reservations
add_order_status_history
add_payment_idempotency_key
```

Migration naming should remain consistent with the database tooling used by the project.

---

## 9. Migration Immutability

Once a migration has been applied to a shared environment, it must be treated as immutable.

Do not edit an already-applied migration to fix a later problem.

Instead:

```text id="3pn4n1"
Existing migration
       ↓
Create new corrective migration
       ↓
Apply corrective migration
```

This preserves migration history and deployment reproducibility.

---

## 10. Local Database

Developers should be able to run PostgreSQL locally or through the project's supported development environment.

Local databases should be isolated from:

- Demo.
- Production.
- Shared team databases.

Local credentials must not be reused in committed configuration.

---

## 11. Database Initialization

A new development environment should support:

```text id="b3x2hf"
Start PostgreSQL
      ↓
Configure environment
      ↓
Run migrations
      ↓
Seed development data
      ↓
Start application
```

The process should be documented and repeatable.

---

## 12. Seed Data

Development seed data may provide:

- Example organization.
- Example store.
- Example users.
- Example products.
- Example inventory.
- Example customers.
- Example discounts.
- Example orders.

Seed data must clearly be development/test data.

It must never contain real customer information or production credentials.

---

## 13. Development Reset

A database reset may be used in local development when appropriate.

A reset operation must be clearly distinguished from migration execution.

For example:

```text id="r5d2vk"
Development reset
≠
Demo deployment
≠
Production database operation
```

Reset commands must never be part of the normal Demo or production deployment pipeline.

---

## 14. Schema Changes and Domain Specifications

A schema change should correspond to an actual domain requirement.

Before adding a table or column, determine:

- What business concept it represents.
- Which module owns it.
- What lifecycle it has.
- What invariants it requires.
- Which queries require it.
- Whether historical data must be preserved.

Do not create tables simply because an implementation seems to need one.

---

## 15. Table Design

Tables should:

- Have clear ownership.
- Use appropriate primary keys.
- Define foreign keys where appropriate.
- Define required `NOT NULL` constraints.
- Define uniqueness where required.
- Use appropriate data types.
- Represent monetary values exactly.
- Store timestamps consistently.
- Include tenant/store ownership where required.

---

## 16. Tenant Scoping

Store-owned records must have explicit tenant/store ownership where required by the domain.

Queries must scope data by the correct tenant boundary.

Example conceptual rule:

```text id="0qzqfa"
Request
  ↓
Authorized Store
  ↓
Query scoped to Store
  ↓
Resource
```

A record identifier alone must not be treated as proof of authorization.

---

## 17. Foreign Keys

Foreign keys should be used to enforce valid relationships where appropriate.

Examples include:

```text
store → organization
product → store
variant → product
inventory → variant/store
order → store
order_item → order
```

Application validation should complement database constraints rather than replace them.

---

## 18. Unique Constraints

Use database uniqueness constraints for invariants that must be globally enforced within their intended scope.

Examples:

```text
(store_id, slug)
(store_id, sku)
(store_id, discount_code)
(provider, provider_event_id)
(store_id, idempotency_key)
```

The exact constraint depends on the domain.

---

## 19. Index Development

Indexes should be introduced based on actual access patterns.

Before adding an index, consider:

- Query frequency.
- Filter conditions.
- Sort order.
- Join patterns.
- Tenant scoping.
- Expected cardinality.
- Write overhead.

Do not create indexes merely because a column exists.

---

## 20. Query Review

Database queries should be reviewed for:

- Tenant filtering.
- Authorization implications.
- Correct joins.
- N+1 behavior.
- Pagination.
- Index usage.
- Transaction requirements.
- Locking behavior.
- Returned data volume.

Critical queries should be inspected with appropriate PostgreSQL tooling when necessary.

---

## 21. Transactions

Transactions should be controlled by application-level use cases.

A typical flow is:

```text id="j6c4y1"
Application Service
       ↓
BEGIN
       ↓
Validate / lock / mutate
       ↓
Persist related changes
       ↓
Commit
```

The transaction should remain as short as practical.

---

## 22. External Calls and Transactions

Do not hold long database transactions while waiting on external systems.

Avoid:

```text id="e1j6d8"
BEGIN
  ↓
Database operation
  ↓
External payment API
  ↓
Wait
  ↓
Database operation
  ↓
COMMIT
```

Prefer designs that separate external communication from transactional database work while preserving idempotency and consistency.

---

## 23. Concurrency

Database development must account for concurrent requests.

Critical operations include:

- Inventory reservation.
- Inventory release.
- Checkout completion.
- Payment processing.
- Order creation.
- Discount usage.
- Idempotency handling.

Use appropriate mechanisms such as:

- Row locks.
- Atomic updates.
- Unique constraints.
- Transactions.
- Idempotency keys.

---

## 24. Lock Ordering

When multiple rows must be locked, use deterministic ordering where practical.

This reduces deadlock risk.

Example:

```text id="1f0k7n"
Sort resource IDs
      ↓
Acquire locks in deterministic order
      ↓
Perform operation
      ↓
Commit
```

---

## 25. Isolation Levels

PostgreSQL's default `READ COMMITTED` isolation level should be used unless a stronger isolation level is justified.

`REPEATABLE READ` or `SERIALIZABLE` should be introduced only when required by a demonstrated consistency problem.

Higher isolation levels may require retry handling.

---

## 26. Idempotency Records

Operations requiring safe retries may store idempotency information in PostgreSQL.

Examples include:

- Payment creation.
- Checkout completion.
- Order creation.
- Webhook processing.
- External API operations.

The idempotency design must define:

- Scope.
- Key.
- Request identity.
- Stored result.
- Expiration/retention.
- Conflict behavior.

---

## 27. Historical Data

Certain business records must preserve historical truth.

Orders should retain appropriate snapshots of information such as:

- Product name.
- SKU.
- Price.
- Currency.
- Customer-facing address.
- Applied discount information.

Changing the current product record must not silently rewrite historical orders.

---

## 28. Soft Deletion

Soft deletion should be used only when the domain requires preservation or recovery.

Do not add soft-delete fields to every table automatically.

When soft deletion is used, queries must consistently define whether deleted records are visible.

---

## 29. Timestamps

Timestamps should use a consistent representation.

The system should distinguish concepts such as:

- Created time.
- Updated time.
- Completed time.
- Cancelled time.
- Expired time.

Do not use one generic timestamp where different business events require distinct timestamps.

---

## 30. Monetary Data

Money must never use floating-point database representations for financial values.

Use an exact representation appropriate to the database design, such as:

- Integer minor units.
- Exact decimal/numeric types.

Currency must be stored or otherwise unambiguously associated with monetary values where required.

---

## 31. Enum and Status Changes

Status fields represent domain state machines.

When changing statuses:

1. Review the corresponding domain state machine.
2. Identify valid transitions.
3. Update application validation.
4. Update database representation if necessary.
5. Add transition tests.
6. Consider historical status records.

A status value must not be added casually without defining its meaning.

---

## 32. Migration Testing

Every migration should be tested for:

- Successful application.
- Expected schema result.
- Constraint behavior.
- Compatibility with application code.
- Existing-data behavior where applicable.

For data migrations, verify both:

```text id="4d8n0r"
Before data
     ↓
Migration
     ↓
Expected data
```

---

## 33. Fresh Database Test

CI should verify that the entire migration history can build a fresh database.

Conceptually:

```text id="w3a4r5"
Empty PostgreSQL
      ↓
Migration 001
      ↓
Migration 002
      ↓
...
      ↓
Latest migration
      ↓
Current schema
```

This detects broken migration histories.

---

## 34. Existing Database Test

Where migrations modify existing data, test against representative pre-migration data.

This is particularly important for:

- Data transformations.
- New non-null columns.
- Uniqueness constraints.
- Foreign keys.
- Index changes.
- Status changes.

---

## 35. Database Test Data

Test data should be created through factories or controlled fixtures.

Factories should:

- Produce valid records.
- Allow relevant overrides.
- Avoid hidden dependencies.
- Support tenant-specific scenarios.

Tests should not rely on arbitrary shared database state.

---

## 36. Production-Like Data

Production data must not be copied into local development or CI without an approved privacy and security process.

When realistic data is needed, use:

- Synthetic data.
- Anonymized data.
- Sanitized datasets.

---

## 37. Schema Review Checklist

Before merging a database change:

```text id="7n4s8m"
[ ] Owning module identified
[ ] Domain requirement identified
[ ] Tenant scope reviewed
[ ] Primary key reviewed
[ ] Foreign keys reviewed
[ ] Unique constraints reviewed
[ ] Nullability reviewed
[ ] Indexes reviewed
[ ] Data migration reviewed
[ ] Historical-data impact reviewed
[ ] Concurrency impact reviewed
[ ] Rollback compatibility reviewed
[ ] Tests added
```

---

## 38. Deployment Compatibility

A database migration must be compatible with the deployment strategy.

Consider:

- Previous application version.
- New application version.
- Worker version.
- Running jobs.
- Webhooks arriving during deployment.
- Concurrent requests.

A migration that works on an empty local database may still be unsafe for a live deployment.

---

## 39. Documentation

Database changes that materially affect architecture or domain behavior should update the relevant documentation.

Potential documents include:

```text
docs/database/
docs/domain/
specs/<module>/
docs/decisions/
```

Documentation should explain business meaning rather than merely restating SQL.

---

## 40. AI-Assisted Database Changes

AI agents modifying the database must:

- Read `AGENTS.md`.
- Inspect the current schema.
- Identify the owning module.
- Read relevant database/domain/spec documents.
- Understand existing migrations.
- Check tenant implications.
- Check constraints and indexes.
- Check transaction/concurrency implications.
- Add appropriate tests.
- Review the migration before completion.

AI agents must not:

- Delete data to make tests pass.
- Rewrite migration history casually.
- Add unnecessary tables.
- Bypass constraints.
- Disable tenant isolation.
- Reset shared databases.
- Claim migrations succeeded without running them.

---

## 41. Database Change Workflow

The standard workflow is:

```text id="r3q9mz"
Requirement
    ↓
Relevant specification
    ↓
Domain model
    ↓
Current schema inspection
    ↓
Migration design
    ↓
Application implementation
    ↓
Migration tests
    ↓
Integration tests
    ↓
CI
    ↓
Code review
    ↓
Merge
    ↓
Controlled deployment
```

---

## 42. Definition of Done

A database change is complete when:

```text id="m8x4kq"
[ ] Business requirement is understood
[ ] Owning module is identified
[ ] Schema change is designed
[ ] Migration is version-controlled
[ ] Tenant scope is correct
[ ] Constraints are defined
[ ] Indexes are appropriate
[ ] Existing-data impact is understood
[ ] Concurrency implications are reviewed
[ ] Migration works on a fresh database
[ ] Relevant existing-data migration is tested
[ ] Application integration tests pass
[ ] Documentation is updated where required
[ ] Deployment compatibility is verified
[ ] Migration has passed code review
```