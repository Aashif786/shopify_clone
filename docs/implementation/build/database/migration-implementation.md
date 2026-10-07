# Database Migration Implementation

## 1. Purpose

This document defines how PostgreSQL schema changes are created, reviewed, executed, tested, and deployed.

Migrations are the authoritative mechanism for evolving the Demo database schema.

The migration system must provide:

- Reproducibility.
- Version control.
- Safe deployment.
- Local/test parity.
- Transactional migration execution where supported.
- Clear ownership.
- Controlled destructive changes.
- Reliable rollback or forward-repair procedures.

---

# 2. Migration Ownership

Database migration infrastructure is owned by:

```text
packages/db
```

Domain modules own the schema meaning of their data, while the shared database layer owns migration execution.

Conceptually:

```text
Domain requirement
        ↓
Schema change
        ↓
Migration
        ↓
PostgreSQL
```

---

# 3. Migration Source of Truth

Migration files committed to the repository are the source of truth for database structure.

Do not rely on:

```text
Manual production SQL
Local-only schema changes
Developer-specific database state
Undocumented SQL scripts
```

A clean environment must be able to reconstruct the schema from migrations.

---

# 4. Migration Directory

The repository should maintain a dedicated migration directory under the database package.

Conceptually:

```text
packages/db/
├── src/
├── migrations/
│   ├── <version>_<description>/
│   └── ...
└── package.json
```

The exact migration-tool structure depends on the selected PostgreSQL migration tooling.

---

# 5. Migration Naming

Migration names must be:

- Unique.
- Ordered.
- Descriptive.
- Stable after commit.

Example:

```text
001_create_organizations
002_create_stores
003_create_products
004_create_inventory
```

The exact numbering mechanism may be timestamp-based if supported by the migration tool.

---

# 6. Migration Immutability

Once a migration has been applied to a shared environment, its contents must not be rewritten.

If a correction is required:

```text
Existing migration
        ↓
Leave unchanged
        ↓
Create new migration
```

This preserves migration history.

---

# 7. Migration History

The migration system must record which migrations have been applied.

A migration history mechanism should capture at least:

```text
migration identifier
application time
execution status where supported
```

The exact metadata is managed by the selected migration tool.

---

# 8. Migration Order

Migrations should follow dependency order.

For example:

```text
Organization
    ↓
Membership
    ↓
Store
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
```

Cross-domain tables must not be created before the entities they depend on unless the migration intentionally creates the relationship later.

---

# 9. Foundation Schema First

The initial migration sequence should establish:

```text
id="7m4nq8"
1. Extensions required by the implementation
2. Organizations
3. Users/membership relationships where applicable
4. Stores
5. Core domain tables
6. Supporting tables
7. Constraints
8. Indexes
```

Only extensions explicitly required by the Demo should be enabled.

---

# 10. Foreign Key Ordering

Foreign keys must reference tables that exist at migration execution time.

When circular relationships are unavoidable:

```text
Create base tables
        ↓
Create nullable/deferred relationship
        ↓
Backfill/validate
        ↓
Apply final constraint
```

Do not create migration-order hacks without documenting the reason.

---

# 11. Migration Transactions

Migrations should run transactionally where PostgreSQL and the migration tool support it safely.

A migration should preferably either:

```text
fully succeed
```

or:

```text
fully fail without leaving a partial schema change
```

Operations that cannot safely run inside a transaction must be explicitly handled.

---

# 12. Large Schema Operations

Operations that may lock large tables or take significant time require additional care.

Examples:

```text
Large index creation
Large table rewrites
Column type conversion
Large data backfill
```

For Demo-sized data this may be manageable, but the migration should still be designed safely.

---

# 13. Expand-and-Contract

For changes that cannot be safely performed in one destructive migration, use:

```text
Expand
  ↓
Deploy compatible application
  ↓
Backfill
  ↓
Switch application usage
  ↓
Contract
```

Example:

```text
Add new column
→ populate it
→ update application
→ verify
→ remove obsolete column later
```

---

# 14. Adding Columns

Adding a nullable column is generally safer than immediately introducing a required column on an existing table.

For a required new field:

```text
1. Add nullable column
2. Deploy compatible code
3. Backfill
4. Verify completeness
5. Add NOT NULL
```

Do not assume existing rows satisfy a new constraint.

---

# 15. Removing Columns

Column removal is a multi-step operation.

Before removal:

```text
Search repository
Search migrations
Search queries
Search application code
Search tests
```

Then:

```text
Stop writing
Stop reading
Deploy
Verify
Remove column
```

Never remove a column merely because the current code appears not to use it.

---

# 16. Renaming Columns

Prefer an expand-and-contract approach when application versions may overlap.

For example:

```text
old_column
new_column
```

Then:

```text
Backfill new_column
→ update readers
→ update writers
→ verify
→ remove old_column
```

---

# 17. Changing Data Types

Data-type changes require analysis of:

```text
Existing values
Application serialization
Indexes
Foreign keys
Constraints
Historical records
```

The migration must guarantee that existing valid data remains valid.

---

# 18. Constraints

Constraints should be introduced deliberately.

Examples:

```text
NOT NULL
UNIQUE
FOREIGN KEY
CHECK
```

Before adding a constraint to existing data:

```text
Verify current rows satisfy it
```

Otherwise deployment may fail unexpectedly.

---

# 19. Unique Constraints

Before adding a unique constraint:

```text
Find duplicates
Resolve duplicates
Add constraint
```

Do not assume application code already prevented duplicates.

Concurrent requests may have created invalid duplicates before the constraint existed.

---

# 20. Index Creation

Indexes must support actual query patterns.

Before creating an index:

```text
Identify query
Review existing indexes
Estimate cardinality
Review query plan where practical
```

Avoid duplicate or speculative indexes.

---

# 21. Index Removal

Before removing an index:

```text
Confirm no query depends on it
Review query plans
Check migration history
Deploy removal separately when risk is meaningful
```

Index removal can change query performance without causing obvious functional errors.

---

# 22. Data Backfills

Backfills are application/data migrations, not ordinary schema changes.

A backfill should be:

- Deterministic.
- Restartable.
- Bounded.
- Observable.
- Safe to rerun where possible.

---

# 23. Backfill Transactions

Large backfills should avoid one enormous transaction.

Prefer bounded batches when the dataset requires it.

Example:

```text
Batch 1
→ commit

Batch 2
→ commit

Batch 3
→ commit
```

The exact strategy depends on table size and operational requirements.

---

# 24. Backfill Failure

If a backfill fails:

```text
Identify completed work
Verify data state
Resume safely
```

Do not blindly rerun destructive transformations.

---

# 25. Migration Locking

Only one migration process should modify the schema at a time.

The migration system should use its supported locking mechanism or deployment-level serialization.

Do not allow multiple application instances to independently race migrations.

---

# 26. Production Migration Execution

Production migrations should be executed as a controlled deployment step.

Preferred flow:

```text
Build artifact
   ↓
Deploy compatible application
   ↓
Run migrations
   ↓
Verify migration success
   ↓
Start/roll forward application
```

The exact order may vary for expand-and-contract changes.

---

# 27. Migration and Application Compatibility

When multiple application instances may temporarily run different versions, migrations must preserve compatibility.

Avoid:

```text
Migration removes column
while old application still reads it
```

Use additive changes first when compatibility matters.

---

# 28. Failed Production Migration

A failed migration must stop the deployment process.

Do not automatically continue with the application rollout while the schema is in an unknown state.

First determine:

```text
Was the migration rolled back?
Was it partially applied?
Is the schema consistent?
Can the migration be safely retried?
```

---

# 29. Rollback Strategy

Not every migration should rely on automatic down migrations.

For destructive or complex schema changes, the preferred recovery strategy may be:

```text
Forward corrective migration
```

rather than:

```text
Automatic rollback
```

The migration strategy must prioritize data safety over theoretical reversibility.

---

# 30. Destructive Changes

Destructive migrations require explicit review.

Examples:

```text
DROP TABLE
DROP COLUMN
DELETE data
Irreversible type transformation
Constraint removal affecting integrity
```

Before execution, verify:

```text
Backup availability
Application compatibility
Data retention requirements
Migration correctness
Rollback/repair procedure
```

---

# 31. Data Deletion

Migrations must not perform broad destructive deletes without explicit justification.

For historical commerce data such as:

```text
Orders
Payments
Refunds
Inventory history
Webhook records
```

retention behavior must follow the approved product/security requirements.

---

# 32. Seed vs Migration

Do not put development/demo seed data into migrations.

Migrations define schema.

Seeds define initial non-production/test data.

Correct separation:

```text
Migration
→ structure

Seed
→ sample data
```

---

# 33. Migration Testing

Every migration must be tested against a clean database.

The minimum verification is:

```text
Empty PostgreSQL database
        ↓
Run all migrations
        ↓
Schema created successfully
```

---

# 34. Migration Reproducibility

A clean database created today should produce the same expected schema as one created from the beginning of migration history.

The implementation must not depend on a developer manually running an undocumented SQL command.

---

# 35. Migration Testing with Existing Data

Important migrations should also be tested against representative existing data.

Especially:

```text
Column changes
Constraint additions
Data transformations
Index changes
Historical records
```

---

# 36. Schema Drift Detection

The team should periodically verify that the actual database schema matches migration expectations.

Unexpected manual changes should be treated as schema drift.

Production schema drift must be investigated before additional migrations are applied if it can affect correctness.

---

# 37. Local Development Workflow

Developers should be able to:

```text
Create local database
        ↓
Run migrations
        ↓
Run seeds
        ↓
Start web/worker
```

This workflow must be documented and reproducible.

---

# 38. Migration Commands

The repository should provide clear scripts for common operations.

Conceptually:

```text
db:migrate
db:migrate:status
db:migrate:create
db:seed
db:reset
```

Exact command names should match the selected migration tooling.

---

# 39. Reset Behavior

A development database reset may:

```text
Drop/recreate schema
Run migrations
Run seeds
```

This operation must be clearly restricted to development/test environments.

A reset command must never be usable accidentally against production.

---

# 40. Migration Environment Safety

Migration commands should identify their environment.

Dangerous operations should refuse to execute against production unless the operation is explicitly intended.

Examples:

```text
db:reset
db:seed:demo
db:drop
```

must not silently operate on production.

---

# 41. Migration Logging

Migration execution should produce structured operational information.

Useful fields include:

```text
migration
environment
start time
duration
success/failure
```

Do not log database credentials.

---

# 42. Migration Performance

Migration performance should be considered for:

```text
Table size
Lock duration
Index creation
Backfill size
Deployment downtime
```

The Demo can tolerate simpler migration strategies than a large production platform, but unsafe locking should still be avoided.

---

# 43. Migration Ownership by Domain

Schema changes should be attributable to the owning domain.

Examples:

```text
Product schema
→ Products domain

Inventory schema
→ Inventory domain

Order schema
→ Orders domain

Payment schema
→ Payments domain
```

Cross-domain schema changes must identify all affected domains.

---

# 44. Migration Review

Every migration should be reviewed for:

```text
Correctness
Foreign keys
Constraints
Indexes
Tenant isolation
Data preservation
Locking
Backward compatibility
Performance
Security
```

The migration should be reviewed together with the application code that depends on it.

---

# 45. AI-Assisted Migration Rules

AI-generated migrations require additional scrutiny.

The AI implementation must:

1. Inspect the current schema.
2. Inspect existing migrations.
3. Inspect relevant domain specifications.
4. Determine whether the migration already exists.
5. Avoid modifying applied migrations.
6. Check existing constraints/indexes.
7. Verify data compatibility.
8. Explain destructive operations.
9. Test the migration.
10. Review the final diff.

AI must not invent schema changes simply because they appear convenient.

---

# 46. Migration Verification Checklist

Before merging a migration:

```text
[ ] Migration has unique identifier
[ ] Name describes purpose
[ ] Existing migrations were inspected
[ ] Existing schema was inspected
[ ] Foreign keys are correct
[ ] Tenant ownership is correct
[ ] Constraints are intentional
[ ] Indexes support real queries
[ ] Existing data remains valid
[ ] Migration is reproducible
[ ] Clean-database migration succeeds
[ ] Representative existing-data test succeeds where required
[ ] No secrets are present
[ ] Destructive changes are reviewed
[ ] Application compatibility is verified
```

---

# 47. Definition of Done

Migration implementation is complete when:

```text
[ ] Migration tooling is configured
[ ] Migration history is tracked
[ ] Migrations are version controlled
[ ] Applied migrations are immutable
[ ] Clean database setup works
[ ] Development reset works safely
[ ] Production execution is controlled
[ ] Schema changes preserve compatibility
[ ] Backfills are safe and restartable
[ ] Destructive changes receive explicit review
[ ] Migration failures are visible
[ ] Schema drift can be detected
[ ] CI verifies migration correctness
[ ] Application and migration changes are coordinated
```

---

# 48. Final Principle

A migration is not merely a SQL file.

It is a **versioned change to the platform's data contract**.

Every migration must therefore be reproducible, reviewable, compatible with the application lifecycle, and designed around the possibility that real users, concurrent requests, retries, and historical data already exist.