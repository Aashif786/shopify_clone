# Migrations Implementation

## 1. Purpose

This document defines the concrete implementation and operational process for PostgreSQL schema migrations.

The migration system must provide:

- Version-controlled schema evolution.
- Deterministic execution order.
- Safe incremental changes.
- Reproducible development environments.
- CI verification.
- Production-safe deployment.
- Data preservation.
- Compatibility between application versions during deployment.
- Clear handling of migration failures.

Migrations are part of the application's source code and must be reviewed with the same discipline as application logic.

---

# 2. Migration Ownership

Migration infrastructure belongs to:

```text id="m8c4x7"
packages/db
```

Domain-specific schema changes remain owned by their corresponding modules.

Example:

```text id="q7m3c8"
modules/products/
    domain/
    application/
    infrastructure/

database/migrations/
    product schema migration
```

The exact physical migration directory may be centralized, but logical ownership must remain clear.

---

# 3. Migration Principles

Every migration must be:

- Versioned.
- Ordered.
- Immutable after application.
- Reviewable.
- Reproducible.
- Tested.
- Safe for the intended deployment sequence.

Never modify an already-applied migration to correct an error.

Create a new migration instead.

---

# 4. Migration Tooling

Use one PostgreSQL-compatible migration system consistently.

The selected tool must support:

- Ordered migrations.
- Migration metadata.
- Transactional migrations where supported.
- CLI execution.
- CI integration.
- Development workflows.
- Production execution.

Do not introduce multiple competing migration systems.

---

# 5. Migration Directory

The repository should maintain a dedicated migration location.

Example:

```text id="v8m4c7"
packages/db/
└── migrations/
    ├── 0001_initial_identity.sql
    ├── 0002_organizations_and_stores.sql
    ├── 0003_products.sql
    └── ...
```

Naming should clearly communicate migration purpose.

The exact numbering mechanism depends on the selected migration tool.

---

# 6. Migration Metadata

The database should maintain migration metadata containing enough information to determine:

- Migration identifier.
- Applied timestamp.
- Execution state where supported.
- Migration ordering.

This allows the application/deployment tooling to determine which migrations remain unapplied.

---

# 7. Migration Ordering

Migrations must follow dependency order.

A simplified sequence is:

```text id="q4m8c7"
Identity
   ↓
Organizations / Stores
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
Jobs / Webhooks / Notifications
```

Actual ordering may differ when tables have independent dependencies.

---

# 8. Initial Migration

The initial schema migration should establish only foundational infrastructure.

Depending on implementation order, this may include:

```text id="x7m3c8"
Users
Organizations
Memberships
Stores
Sessions
```

Do not create the entire final schema in one enormous migration.

Smaller logical migrations are easier to review and recover.

---

# 9. One Logical Change Per Migration

Prefer:

```text id="m8c4x7"
Add products
```

followed by:

```text id="q5m7c8"
Add product indexes
```

where separation improves safety or reviewability.

Avoid migrations containing unrelated changes such as:

```text id="v4m8c7"
Add products
+
Modify payments
+
Rename customer fields
+
Change job schema
```

unless the changes are intrinsically coupled.

---

# 10. Schema Changes

Schema changes may include:

- Tables.
- Columns.
- Constraints.
- Foreign keys.
- Indexes.
- Enums.
- Check constraints.
- Unique constraints.

Every schema change must consider:

- Existing data.
- Existing application code.
- Query behavior.
- Migration locking.
- Deployment ordering.

---

# 11. Expand-and-Contract

For changes that cannot be performed safely in one step, use:

```text id="x8m4c7"
Expand
  ↓
Deploy Compatible Code
  ↓
Migrate / Backfill
  ↓
Deploy New Code
  ↓
Contract
```

Example:

```text id="q7m3c8"
Add new column
      ↓
Application writes both
      ↓
Backfill existing data
      ↓
Application reads new column
      ↓
Remove old column
```

This avoids requiring every application instance to change simultaneously.

---

# 12. Backward Compatibility

During deployment, there may temporarily be:

```text id="m4c8x7"
Old Application
+
New Database
```

or:

```text id="v7m3c8"
New Application
+
Database During Migration
```

Migrations must therefore avoid breaking the currently deployed application unless deployment explicitly guarantees atomic replacement.

---

# 13. Adding Columns

Adding a nullable column is generally straightforward.

For required data:

```text id="q8m4c7"
Add nullable column
      ↓
Deploy application
      ↓
Populate data
      ↓
Add constraint
```

Avoid adding a required column without determining how existing rows receive valid values.

---

# 14. Removing Columns

Column removal should normally be a multi-step operation.

Preferred:

```text id="x5m8c4"
Stop reading column
      ↓
Stop writing column
      ↓
Verify no consumers
      ↓
Remove column
```

Do not immediately drop a column merely because new code no longer uses it.

---

# 15. Renaming Columns

Treat renames as compatibility-sensitive changes.

Prefer:

```text id="m7c4x8"
Add new column
      ↓
Backfill
      ↓
Dual read/write if required
      ↓
Switch consumers
      ↓
Remove old column
```

A direct rename may be acceptable for isolated development-only changes.

---

# 16. Index Creation

Large production tables require care when creating indexes.

Where supported and appropriate, consider non-blocking index creation.

For example:

```text id="q4m8c7"
CREATE INDEX CONCURRENTLY
```

However, the selected migration tooling must support the required execution behavior.

Do not blindly use concurrent index creation for every index.

---

# 17. Unique Constraints

Unique constraints are correctness mechanisms.

Before adding one:

1. Identify existing duplicates.
2. Clean or reconcile invalid data.
3. Add the constraint.
4. Verify application behavior.

Never assume existing data already satisfies a newly introduced invariant.

---

# 18. Foreign Keys

Foreign keys should be introduced carefully when existing data is present.

Verify:

```text id="v8m3c7"
All referenced rows exist
```

before enabling restrictive constraints.

Where large datasets make immediate validation expensive, use PostgreSQL mechanisms appropriate to the migration strategy.

---

# 19. Check Constraints

Use database check constraints for invariants that should never be violated.

Examples:

```text id="x6m4c8"
quantity >= 0
amount >= 0
```

Business rules that require application context should remain in domain logic.

---

# 20. Enum Changes

PostgreSQL enum modifications require special care.

Before modifying an enum:

- Verify application compatibility.
- Understand deployment ordering.
- Verify migration tooling support.

For rapidly changing state models, a constrained text/status approach may be preferable depending on the established schema strategy.

Do not switch representations casually after implementation begins.

---

# 21. Data Migrations

Data migrations transform existing records.

Examples:

```text id="q8m4c7"
Populate new field
Normalize existing values
Backfill relationships
Recalculate derived data
```

Data migrations must be:

- Deterministic.
- Restart-safe where practical.
- Bounded in resource usage.
- Observable.
- Tested on representative data.

---

# 22. Large Backfills

Large backfills should avoid holding a single transaction for the entire dataset.

Prefer bounded batches where appropriate:

```text id="m7c4x8"
Select batch
    ↓
Update batch
    ↓
Commit
    ↓
Next batch
```

The exact strategy depends on table size and correctness requirements.

---

# 23. Migration Transactions

Transactional migrations are preferred when the database operation supports safe transactional execution.

A migration should either:

```text id="v4m8c7"
Complete
```

or:

```text id="x8m3c7"
Rollback
```

when possible.

Some PostgreSQL operations have restrictions around transactions and must be handled accordingly.

---

# 24. External Calls

Migrations must not depend on external services.

Do not make a migration require:

- Payment API.
- Email API.
- Object storage.
- HTTP endpoint.
- Third-party service.

The database migration must be independently reproducible.

---

# 25. Application Code During Migration

Migrations must not rely on application runtime code that may change later.

Bad pattern:

```text id="q5m8c4"
Migration
  ↓
Import current TypeScript model
  ↓
Transform database
```

Prefer deterministic migration logic that remains valid after future application changes.

---

# 26. Migration Testing

Every meaningful migration must be tested.

At minimum:

```text id="m8c4x7"
Clean Database
      ↓
Run All Migrations
      ↓
Verify Schema
```

For data migrations:

```text id="v7m3c8"
Representative Data
      ↓
Run Migration
      ↓
Verify Data
```

---

# 27. Fresh Database Verification

CI should regularly verify:

```text id="q8m4c7"
Empty PostgreSQL
      ↓
Migration 0001
      ↓
Migration 0002
      ↓
...
      ↓
Current Schema
```

This prevents migration chains from silently becoming unreproducible.

---

# 28. Existing Database Verification

Migration testing should also cover databases containing realistic data.

This is particularly important for:

- Column changes.
- Constraint changes.
- Backfills.
- Index creation.
- Data normalization.
- Status changes.

---

# 29. Migration Commands

The repository should expose predictable commands.

Examples:

```text id="x4m8c7"
pnpm db:migrate
pnpm db:migrate:status
pnpm db:migrate:create
pnpm db:migrate:test
```

Exact command names may follow the selected migration tool.

---

# 30. Development Workflow

Normal development should follow:

```text id="m7c4x8"
Change Schema
      ↓
Create Migration
      ↓
Run Migration Locally
      ↓
Run Tests
      ↓
Inspect Schema
      ↓
Commit Migration + Code
```

A developer must not manually modify the local database and assume the change exists in source control.

---

# 31. Pull Request Review

Migration PRs should explicitly document:

- What changes.
- Why it changes.
- Whether existing data is affected.
- Whether deployment ordering matters.
- Whether a backfill is required.
- Whether rollback is possible.
- Whether indexes or constraints may cause locking.
- Whether application compatibility is preserved.

---

# 32. Migration Rollback

Rollback should be approached carefully.

For many production migrations, the safest rollback is:

```text id="q8m4c7"
Rollback Application
      ↓
Keep Compatible Schema
      ↓
Correct Forward
```

rather than immediately deleting or reverting database structures.

Destructive down migrations should not be assumed safe.

---

# 33. Destructive Changes

Destructive operations include:

```text id="v4m8c7"
DROP COLUMN
DROP TABLE
DELETE DATA
Remove constraint
Change meaning of existing values
```

These require explicit review.

Data should be backed up before destructive production changes where appropriate.

---

# 34. Production Migration Execution

Production migrations should run as a controlled deployment step.

Recommended sequence:

```text id="x7m3c8"
Build / Validate
      ↓
Backup Check
      ↓
Run Compatible Migration
      ↓
Verify Migration
      ↓
Deploy Application
      ↓
Run Smoke Tests
```

The exact order may vary for expand-and-contract migrations.

---

# 35. Migration Locking

Before applying a migration, consider:

- Table size.
- Existing traffic.
- Lock duration.
- Index creation cost.
- Backfill duration.

A migration that is technically correct but blocks the entire application for an unreasonable period is not operationally correct.

---

# 36. Migration Failure

If a migration fails:

1. Stop deployment.
2. Capture the failure.
3. Determine whether the migration transaction rolled back.
4. Inspect database state.
5. Determine whether manual recovery is required.
6. Correct the migration strategy.
7. Resume only after verification.

Never blindly rerun a partially understood destructive migration.

---

# 37. Migration Drift

The repository must prevent schema drift.

Developers should not rely on undocumented manual SQL changes.

The source of truth should be:

```text id="m4c8x7"
Migration History
```

Any intentional production schema change must be represented by migration code.

---

# 38. Migration and Seeds

Migrations and seeds have different responsibilities.

### Migration

Changes:

```text id="q7m3c8"
Schema
Constraints
Indexes
Data structure
```

### Seed

Creates:

```text id="v8m4c7"
Development Data
Test Data
Demo Data
```

Never use seeds as a substitute for migrations.

---

# 39. Migration Security

Migration files must not contain:

- Passwords.
- API keys.
- Provider credentials.
- Production secrets.

Migration logs must also avoid exposing sensitive data.

---

# 40. Implementation Sequence

Implement migration infrastructure in this order:

```text id="x5m8c4"
1. Select migration tool
2. Configure migration directory
3. Configure migration metadata
4. Implement migration commands
5. Create initial identity/store migration
6. Add domain migrations incrementally
7. Add migration test database
8. Add clean-database CI verification
9. Add existing-data verification where needed
10. Document production migration workflow
11. Test failure handling
12. Verify deployment integration
```

---

# 41. Migration Definition of Done

The migration system is complete when:

```text id="m7c4x8"
[ ] Migrations are version controlled
[ ] Ordering is deterministic
[ ] Applied migrations are immutable
[ ] Clean databases can be built
[ ] Existing data can be migrated safely
[ ] Migration status is observable
[ ] CI validates migrations
[ ] Production execution is controlled
[ ] Destructive changes receive explicit review
[ ] Data migrations are tested
[ ] No migration depends on external services
[ ] Schema drift is controlled
```

The migration system should make database evolution predictable. Schema changes should be deliberate, reviewable, and reversible where realistically possible, rather than relying on the ancient engineering tradition of manually fixing production at 2 a.m.