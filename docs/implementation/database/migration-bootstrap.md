# Migration Bootstrap Implementation

## 1. Purpose

This document defines the implementation strategy for database migrations in the Demo.

Migrations provide the controlled mechanism for evolving the PostgreSQL schema alongside application code while preserving data integrity and deployment safety.

---

# 2. Migration Principles

Migrations must be:

- Version-controlled.
- Ordered.
- Reproducible.
- Reviewable.
- Environment-aware.
- Tested before production.
- Forward-compatible where practical.
- Safe to execute more than once at the deployment-process level.

A migration represents a schema change, not application business logic.

---

# 3. Migration Ownership

Migration infrastructure belongs to the database implementation layer.

Recommended location:

```text id="7d3m8q"
packages/db
```

Migration files may be stored within the package or another explicitly designated repository location.

The location must remain consistent once established.

---

# 4. Migration Directory

A typical structure is:

```text id="p8x4m2"
packages/db/
├── src/
├── migrations/
│   ├── 0001_initial_schema.*
│   ├── 0002_*.*
│   └── ...
├── package.json
└── tsconfig.json
```

The exact migration file extension depends on the selected migration tooling.

---

# 5. Migration Ordering

Migrations must execute in deterministic order.

Each migration must have a unique ordering identifier.

Example:

```text id="v6c9n3"
0001_initial_schema
0002_add_store_slug
0003_add_inventory_reservations
```

Do not rename an already-applied migration.

---

# 6. Immutable Applied Migrations

Once a migration has been applied to a shared environment, its contents must be treated as immutable.

If a correction is required:

```text id="q5m8x2"
Existing migration
       ↓
New corrective migration
```

Do not silently modify the old migration.

---

# 7. Migration Metadata

The migration system should maintain a record of applied migrations.

At minimum, it should be possible to determine:

- Migration identifier.
- Applied status.
- Application order.
- Applied timestamp where supported.

This allows deployments to determine which migrations remain pending.

---

# 8. Initial Migration

The first migration establishes the minimum foundational database structure required by the application.

It should not necessarily contain every future table.

As domains are implemented, additional migrations should be introduced.

---

# 9. Domain Migration Order

Schema migrations should follow the domain implementation dependency order.

A conceptual sequence is:

```text id="h4n8m6"
Identity
   ↓
Organization / Store
   ↓
Products
   ↓
Inventory
   ↓
Customers
   ↓
Carts
   ↓
Discounts
   ↓
Checkout
   ↓
Payments
   ↓
Orders
   ↓
Jobs / Webhooks / Supporting Infrastructure
```

Exact ordering may vary where dependencies require it.

---

# 10. Migration Scope

A migration should have one clear purpose.

Good:

```text id="k3v7x9"
Add product slug uniqueness constraint
```

Less desirable:

```text id="a6m2c8"
Create products
Modify payments
Rewrite orders
Change worker jobs
Add unrelated indexes
```

Unrelated schema changes should normally be separate migrations.

---

# 11. Schema and Application Coordination

Schema changes must be coordinated with application changes.

For example, adding a new required column should normally follow:

```text id="j8m4v2"
1. Add nullable column
2. Deploy compatible application
3. Backfill data
4. Enforce constraint
5. Update application assumptions
```

This is the expand-and-contract approach.

---

# 12. Expand Phase

The expand phase introduces backward-compatible schema changes.

Examples:

- Add a nullable column.
- Add a new table.
- Add a new index.
- Add a new compatible enum/state representation.

The existing application should continue operating where practical.

---

# 13. Migrate Phase

The application begins using the new schema.

If existing data requires transformation, the migration or a dedicated controlled process may perform the transformation.

Large data transformations should not automatically be placed into a long-running deployment migration.

---

# 14. Contract Phase

Once the application no longer depends on the old structure:

- Remove obsolete columns.
- Remove obsolete constraints.
- Remove deprecated structures.

Destructive cleanup should occur separately from the initial expansion.

---

# 15. Backfills

Large backfills should be treated carefully.

A backfill must consider:

- Runtime duration.
- Lock duration.
- Database load.
- Failure recovery.
- Progress tracking.
- Deployment impact.

For sufficiently large data, use a controlled background job rather than a single long transaction.

---

# 16. Transactional Migrations

Where supported by the migration system, schema operations should use transactions when safe.

However, some PostgreSQL operations have transaction restrictions or operational considerations.

The migration implementation must follow PostgreSQL behavior rather than assuming every migration can be wrapped in one transaction.

---

# 17. Lock Awareness

Migrations must account for database locks.

Before production execution, evaluate whether a migration can:

- Lock a large table.
- Block writes.
- Block reads.
- Rebuild an expensive index.
- Cause prolonged downtime.

Avoid migrations that create unnecessary production disruption.

---

# 18. Index Creation

Indexes should be created according to the indexing strategy.

For large production tables, index creation methods that minimize blocking should be considered where appropriate.

The Demo may use simpler operations while datasets remain small, but migration design should not create unnecessary future obstacles.

---

# 19. Constraints

Constraints should be introduced carefully.

Examples include:

- Foreign keys.
- Unique constraints.
- Check constraints.
- Not-null constraints.

When existing data may violate a new constraint, clean or backfill the data before enforcing the constraint.

---

# 20. Foreign Key Changes

Adding a foreign key to an existing large table should consider:

- Existing invalid references.
- Validation cost.
- Locking.
- Deployment compatibility.

Do not assume adding a constraint is operationally free.

---

# 21. Unique Constraints

Unique constraints are especially important for concurrency-sensitive business rules.

Examples:

```text id="f5m8c3"
Store slug
Product slug within Store
SKU within required scope
Discount code
Idempotency key
Webhook event ID
```

The application should still validate inputs, but PostgreSQL remains the final integrity boundary.

---

# 22. Enum and Status Changes

Status values must evolve carefully.

Avoid migrations that make existing records invalid.

When introducing a new state:

```text id="n4x7m9"
Schema supports new state
        ↓
Application understands new state
        ↓
New state becomes reachable
```

The application must not begin writing states that an older deployment cannot understand during a rolling transition.

---

# 23. Data Preservation

Migrations must preserve existing business data unless a deliberate data-retention decision says otherwise.

Before destructive changes:

- Identify affected records.
- Verify backups.
- Test the migration.
- Confirm rollback/recovery strategy.

---

# 24. Rollback Philosophy

Not every production migration should be automatically reversible.

For many schema changes, the safer strategy is:

```text id="w6p3c8"
Forward migration
        ↓
Verify
        ↓
Corrective migration if necessary
```

rather than relying on automatic rollback of potentially destructive operations.

Application rollback and database rollback must be considered separately.

---

# 25. Migration Testing

Every migration should be tested against a representative database state.

At minimum:

```text id="x8m4q2"
Fresh database
    ↓
Run all migrations
    ↓
Verify schema
```

For important migrations:

```text id="k5c9v7"
Existing schema/data
    ↓
Apply migration
    ↓
Verify compatibility
```

---

# 26. Fresh Database Verification

The complete migration history must be capable of constructing a fresh Demo database.

This is essential for:

- New developer setup.
- CI.
- Test environments.
- Disaster recovery.
- New deployments.

---

# 27. Existing Database Verification

Migrations should also be tested against representative existing data when the change affects existing tables.

This catches problems that a fresh database cannot reveal.

---

# 28. Migration Commands

The repository should provide explicit commands for:

```text id="m9c4x7"
Create migration
Run migrations
Check migration status
Reset development database
Seed development database
```

Exact command names should follow the selected migration tooling.

---

# 29. Production Migration Command

Production migration execution must be explicit.

A deployment process should invoke the migration command deliberately rather than relying on application startup.

Conceptually:

```text id="c8n3v5"
pnpm db:migrate
```

The exact script name should match the root workspace conventions.

---

# 30. Migration Safety Checks

Before production execution, verify:

```text id="z7m2q9"
[ ] Migration was reviewed
[ ] Migration tested locally
[ ] Migration tested against representative data
[ ] Application compatibility verified
[ ] Lock impact considered
[ ] Backup status verified
[ ] Rollback/recovery strategy understood
```

---

# 31. Migration and CI

CI should verify that:

1. A fresh database can be created.
2. All migrations apply successfully.
3. Tests can execute against the migrated schema.
4. The application compiles against the resulting schema.

---

# 32. Migration and Seeds

Migrations and seeds must remain separate.

```text id="h8c5m3"
Migrations
    = schema evolution

Seeds
    = environment/test data
```

A migration must not depend on demo seed records existing.

---

# 33. Production Seed Safety

Production deployment must never automatically run development seed data.

A seed command should require an explicit environment-safe workflow.

---

# 34. Migration Dependencies

Migrations must respect schema dependencies.

For example:

```text id="p6m9x4"
stores
   ↓
products
   ↓
product_variants
   ↓
inventory
```

A migration creating a dependent foreign key must execute after the referenced structure exists.

---

# 35. Cross-Domain Schema Changes

A migration may affect multiple domains when a database-level relationship requires it.

However, ownership should remain explicit.

For example:

```text id="v4c8m7"
Orders migration
    ↓
Order tables and order-specific indexes

Inventory migration
    ↓
Inventory tables and inventory-specific indexes
```

Cross-domain foreign keys should be introduced deliberately and documented when they materially affect module coupling.

---

# 36. Database Schema vs Domain Ownership

Database proximity does not change module ownership.

If Products owns product data, another module must not start modifying the Product tables simply because it has database access.

Schema ownership and runtime access boundaries must remain aligned.

---

# 37. Migration Naming

Migration names should communicate intent.

Preferred:

```text id="j3m7x8"
add_product_slug_index
add_order_status_history
create_inventory_reservations
```

Avoid meaningless names such as:

```text id="w9c4n2"
update_db
fix
changes
migration2
```

---

# 38. Migration Review

Code review should inspect:

- Correctness.
- Data preservation.
- Constraints.
- Indexes.
- Foreign keys.
- Locking.
- Deployment compatibility.
- Performance implications.
- Application compatibility.

Database migrations require the same review discipline as application code.

---

# 39. Migration Observability

Migration execution should provide enough output to determine:

- Which migration is running.
- Which migration succeeded.
- Which migration failed.
- Where execution stopped.

Sensitive database credentials must never appear in migration output.

---

# 40. Migration Failure

If a migration fails:

1. Stop further migration execution.
2. Capture the failure.
3. Determine whether the migration partially applied.
4. Inspect database state.
5. Correct the migration or create a recovery migration.
6. Re-run through the supported migration mechanism.

Do not blindly rerun destructive SQL.

---

# 41. Migration and Deployment Failure

A failed migration must not leave the deployment process falsely reporting success.

The deployment system should treat migration failure as a failed deployment step.

Application rollout should follow the deployment strategy defined in:

```text id="r6n3m8"
docs/deployment/rollback-strategy.md
```

---

# 42. Development Reset

Developers should have a controlled way to rebuild the local database from migrations.

Conceptually:

```text id="x4m8c7"
Drop development database
        ↓
Create database
        ↓
Run all migrations
        ↓
Run seeds
```

This must never be allowed against production through an ambiguous command.

---

# 43. Schema Drift

The project should avoid unmanaged schema drift.

If a developer manually modifies a local database:

```text id="v8n4q2"
Local schema ≠ migration history
```

the difference should be corrected through a migration rather than becoming an undocumented permanent change.

---

# 44. Migration and Version Control

Migration files must be committed alongside the application changes that require them.

A pull request introducing a new persistent field should normally include:

```text id="c7m5x9"
Application change
+
Migration
+
Tests
```

where applicable.

---

# 45. Migration Definition of Done

Migration bootstrap is complete when:

```text id="q3n8m6"
[ ] Migration tooling is selected
[ ] Migration directory exists
[ ] Migration metadata is configured
[ ] Initial migration can run
[ ] Fresh database creation works
[ ] Migration status can be inspected
[ ] Migration creation command exists
[ ] Migration execution command exists
[ ] Development reset workflow exists
[ ] Seed workflow remains separate
[ ] Migration tests exist
[ ] CI applies migrations successfully
[ ] Production migration execution is explicit
[ ] Expand-and-contract strategy is documented
[ ] Destructive changes require deliberate review
[ ] Migration failures are observable
[ ] Database/application compatibility is considered
[ ] Migration files are version-controlled
```

---

# 46. Final Migration Principle

The migration history is the reproducible evolution of the database:

```text id="s6m4x8"
Migration 001
      ↓
Migration 002
      ↓
Migration 003
      ↓
Current Schema
```

The migration chain must remain trustworthy enough that a completely new database can be constructed from it without undocumented manual intervention.

The database should evolve deliberately, not through heroic SQL archaeology performed five minutes before deployment.