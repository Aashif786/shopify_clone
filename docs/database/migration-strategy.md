# Database Migration Strategy

## 1. Purpose

This document defines how PostgreSQL schema changes are designed, created, reviewed, tested, deployed, and evolved for the Demo commerce platform.

The migration strategy must support:

- Reliable local development
- Reproducible environments
- Version-controlled schema history
- Safe production deployment
- Backward-compatible application releases
- Data migrations
- Constraint changes
- Index changes
- Demo-to-V1 evolution
- Recovery from failed deployments

The database schema is treated as application code.

Schema changes must therefore be reviewed, tested, version-controlled, and deployed through a controlled process.

---

# 2. Core Principles

Database migrations follow these principles:

1. Every schema change is represented by a migration.
2. Migrations are committed to version control.
3. Migrations run in deterministic order.
4. Production schema changes are never performed manually as the normal deployment process.
5. Application code and schema changes must remain compatible during deployment.
6. Destructive changes require explicit review.
7. Data migrations are separated conceptually from ordinary schema changes.
8. Large migrations must consider production data volume.
9. Index and constraint changes must consider locking behavior.
10. Migration failure must stop the deployment rather than silently continue.
11. Migrations must be tested before production execution.
12. The migration history must remain consistent across environments.

---

# 3. Migration Ownership

The database layer is responsible for:

- migration tooling
- migration files
- schema definitions
- migration execution
- migration verification

Business modules remain responsible for the business meaning of their entities.

For example:

```text id="kw4d2a"
Products module
    owns Product business rules

Database layer
    owns Product persistence schema
```

A migration must not introduce business logic merely because it is convenient to place logic in SQL.

---

# 4. Migration Directory

The exact ORM/database tooling may determine the physical migration directory.

The repository should maintain a dedicated location for migrations, for example:

```text id="0r6qj7"
packages/db/
    migrations/
        <timestamp>_<description>/
            migration.sql
```

The final directory structure should follow the selected database tooling.

The important requirement is that migrations are:

- ordered
- immutable after application
- version-controlled
- reproducible

---

# 5. Migration Naming

Migration names should clearly describe the change.

Example:

```text id="9x5k1c"
20261007120000_create_stores
20261007123000_add_product_slug
20261007130000_add_order_status_history
```

A migration name should communicate intent without requiring someone to open the file.

Timestamp or sequential ordering must be deterministic.

---

# 6. Migration Immutability

Once a migration has been applied to a shared environment, it should not be modified.

Incorrect:

```text id="5v8s2r"
Migration A applied
        ↓
Edit Migration A
        ↓
Commit different Migration A
```

Correct:

```text id="3k9m7q"
Migration A applied
        ↓
Need another change
        ↓
Create Migration B
```

This preserves migration history across environments.

---

# 7. Local Development

Developers should be able to initialize a clean database by applying all migrations in order.

Conceptually:

```text id="0a6p3r"
Empty PostgreSQL database
        ↓
Migration 001
        ↓
Migration 002
        ↓
Migration 003
        ↓
Current schema
```

The process must be deterministic.

A new developer should not need a manually configured database schema.

---

# 8. Development Database Reset

During local development, resetting the database may be acceptable.

A development reset can:

```text id="5s7x1n"
drop development database
        ↓
recreate database
        ↓
run all migrations
        ↓
load seed data
```

This must never be treated as an acceptable production migration strategy.

---

# 9. Seed Data

Seed data is separate from schema migrations.

Migrations define:

```text id="y6q2r8"
Database structure
```

Seeds define:

```text id="v9m4x1"
Development/demo data
```

Examples:

- demo organization
- demo store
- demo products
- test customer
- test merchant
- sample discounts

Seed operations should be repeatable or explicitly resettable.

---

# 10. Migration and Application Compatibility

Deployments should avoid a situation where:

```text id="x7p2m9"
Old application
    ↓
cannot work with
    ↓
new database schema
```

and:

```text id="j4c6v8"
New application
    ↓
cannot work with
    ↓
old database schema
```

A safer deployment sequence is:

```text id="r8n3q5"
Expand schema
      ↓
Deploy compatible application
      ↓
Backfill/migrate data
      ↓
Switch application behavior
      ↓
Remove obsolete schema later
```

This is the preferred **expand-and-contract** pattern.

---

# 11. Expand-and-Contract

For potentially breaking schema changes:

## Phase 1: Expand

Add the new schema without removing the old one.

Example:

```text id="1u5d8k"
old_column
new_column
```

Both exist temporarily.

## Phase 2: Application Compatibility

Deploy application code that can operate with both representations.

## Phase 3: Backfill

Populate the new representation.

## Phase 4: Switch

Change application reads/writes to the new representation.

## Phase 5: Contract

Remove the obsolete representation after it is no longer used.

This approach reduces deployment coupling.

---

# 12. Adding a Nullable Column

Adding a nullable column is generally one of the simplest schema changes.

Example:

```text id="p9v3m2"
ALTER TABLE products
ADD COLUMN subtitle ...
```

The application can initially ignore the column.

A later deployment can begin populating it.

If the field eventually becomes mandatory:

```text id="h4q7x1"
populate existing records
        ↓
verify no NULL values remain
        ↓
add NOT NULL constraint
```

---

# 13. Adding a Required Column

Avoid immediately adding:

```text id="m6k2r9"
NOT NULL
```

to a large existing table without considering existing rows and deployment impact.

Safer approach:

```text id="f8x4n1"
1. Add nullable column
2. Deploy compatible code
3. Backfill existing rows
4. Validate data
5. Add NOT NULL constraint
```

The exact method depends on PostgreSQL behavior and table size.

---

# 14. Adding a Unique Constraint

Before adding uniqueness:

```text id="z3c8m5"
UNIQUE(store_id, sku)
```

existing duplicate data must be identified and resolved.

Migration sequence:

```text id="q5n7v2"
Find duplicates
      ↓
Resolve duplicates
      ↓
Create unique constraint/index
```

The migration must not assume existing production data is already clean unless verified.

---

# 15. Adding Indexes

Indexes must be created with production impact in mind.

For large tables, index creation may require special handling.

PostgreSQL supports concurrent index creation where appropriate.

Conceptually:

```text id="k9m4s1"
CREATE INDEX CONCURRENTLY ...
```

may reduce blocking of normal operations.

However, concurrent index creation has operational constraints and should be used deliberately.

The migration tooling must support the selected approach correctly.

---

# 16. Index Migration Rules

Index migrations should:

- use deterministic names
- avoid duplicates
- consider table size
- consider locking
- be tested against realistic data
- be reversible where practical
- be monitored after deployment

The indexing strategy is defined in:

```text id="2f6x8v"
docs/database/indexing-strategy.md
```

---

# 17. Foreign-Key Changes

Adding a foreign key to an existing table requires validation of existing data.

Sequence:

```text id="j7p3n9"
Identify orphaned records
        ↓
Resolve invalid records
        ↓
Add relationship
        ↓
Validate constraint
```

For large production tables, PostgreSQL features such as `NOT VALID` and later validation may be considered when appropriate.

The migration must not silently delete invalid data merely to satisfy a new constraint.

---

# 18. Check Constraints

Business invariants that can be represented structurally should use database constraints.

Examples:

```text id="v1s8m4"
quantity >= 0
price >= 0
status IN (...)
```

Adding a constraint requires checking existing records.

Existing invalid data must be handled before the constraint becomes authoritative.

---

# 19. Data Migrations

A data migration changes existing records rather than only changing schema structure.

Examples:

- normalize email addresses
- populate a new column
- convert price representation
- create missing inventory records
- migrate product status values

Data migrations must consider:

- dataset size
- locking
- transaction duration
- failure recovery
- resumability
- idempotency

---

# 20. Large Data Backfills

Large backfills should not necessarily execute as one giant transaction.

Instead, use controlled batches where appropriate:

```text id="7m2q5x"
Select batch
    ↓
Process batch
    ↓
Commit
    ↓
Next batch
```

The operation must be safe to resume after failure.

Example:

```text id="a4c9v7"
100,000 records
    ↓
1,000-record batches
    ↓
continue until complete
```

The exact batch size depends on the production workload.

---

# 21. Backfill Safety

Backfills should:

- be idempotent where possible
- avoid modifying unrelated data
- track progress when necessary
- avoid excessive lock duration
- be observable
- have a clear completion condition

A backfill should not require a developer to manually remember which rows have already been processed.

---

# 22. Destructive Changes

Destructive schema changes include:

- dropping columns
- dropping tables
- removing constraints
- deleting data
- changing data meaning
- reducing precision
- changing identifiers

These require explicit review.

The preferred approach is:

```text id="v6k2p8"
Stop using old structure
        ↓
Verify no application dependency remains
        ↓
Back up / validate recovery capability
        ↓
Remove old structure
```

Destructive changes should normally occur in a separate deployment from the application change that stops using the structure.

---

# 23. Column Renaming

Avoid direct rename when deployment compatibility matters.

Instead:

```text id="c7m4x9"
old_name
new_name
```

Then:

```text id="r2v8n5"
write both if required
        ↓
backfill new column
        ↓
switch reads
        ↓
stop writing old column
        ↓
drop old column
```

This allows old and new application versions to coexist temporarily.

---

# 24. Data Type Changes

Changing data types may require:

- compatibility analysis
- temporary columns
- data conversion
- validation
- phased rollout

Example:

```text id="j3n7q1"
integer price
        ↓
minor-unit representation
```

should not be treated as a trivial column alteration.

Monetary changes are particularly sensitive because incorrect conversion can change financial values.

---

# 25. Enum and Status Changes

Adding a new state should normally be backward compatible.

For example:

```text id="m5q8x2"
PENDING
CONFIRMED
FULFILLED
CANCELLED
```

adding:

```text id="v9k3r6"
REFUNDED
```

requires application code that understands the new state before existing records can transition into it.

Removing a state requires more careful migration because existing records may still use it.

---

# 26. Transactional Migrations

Some schema changes should execute transactionally.

Others may not be compatible with a single transaction.

The migration tool must understand PostgreSQL operations that have transactional restrictions.

For example, certain concurrent index operations cannot run inside a normal transaction block.

Migration files must therefore follow the selected tooling's execution rules.

The Demo custom SQL runner in `packages/db` acquires a PostgreSQL advisory lock (`pg_advisory_lock`) before modifying schema so only one migration process can execute at a time. Each migration file still runs in its own transaction. The lock is released with `pg_advisory_unlock` after the run succeeds or fails.

---

# 27. Migration Failure

If a migration fails:

```text id="k6p1v8"
deployment must stop
```

The system must not continue as though the migration succeeded.

The failure must be:

- visible
- logged
- investigated
- safely recoverable

The correct recovery may be:

- fix data and rerun
- create a corrective migration
- roll back application deployment
- restore from backup in severe cases

Editing an already-applied migration to hide the failure is not acceptable.

---

# 28. Migration Rollback

Every migration should be evaluated for reversibility.

Some changes are naturally reversible:

```text id="b8n4x2"
add column
add index
add table
```

Others may not be safely reversible:

```text id="z5q7m1"
delete data
destructive transformation
irreversible external migration
```

For irreversible migrations, the deployment plan must emphasize:

- backup
- validation
- staged rollout
- recovery strategy

Rollback should not be assumed to mean simply "run the opposite SQL."

---

# 29. Application Rollback vs Database Rollback

Application rollback is not always equivalent to database rollback.

Example:

```text id="q4w8m6"
Application version B
    ↓
Migration adds column
    ↓
Application version B deployed
    ↓
Rollback application to version A
```

If version A does not understand the new schema, it may still work if the migration was additive.

This is why backward-compatible schema changes are preferred.

The goal is to allow:

```text id="p7m3x9"
Application N
Application N+1
```

to coexist safely during deployment transitions.

---

# 30. Production Migration Process

A production deployment should conceptually follow:

```text id="8k2v6m"
1. Build application
2. Run automated tests
3. Validate migration
4. Deploy compatible schema changes
5. Run migration
6. Verify migration success
7. Deploy application
8. Verify health
9. Monitor
10. Complete cleanup migration later if required
```

The exact order may vary for specific migration types.

---

# 31. CI Migration Checks

CI should verify that:

- migration files are syntactically valid
- migrations can run on a clean database
- application code can start against the migrated schema
- tests pass against the migrated schema
- migration ordering is valid
- schema drift is detected where tooling supports it

The project should not claim these checks passed unless they were actually executed.

---

# 32. Clean Database Verification

A clean environment should be able to execute:

```text id="v5n9x3"
all migrations
        ↓
current schema
        ↓
seed/test data
        ↓
application tests
```

This validates that the schema does not depend on undocumented manual database changes.

---

# 33. Migration Testing

Important migrations should be tested against:

- empty database
- representative existing data
- production-like data volume where relevant
- duplicate data scenarios
- NULL values
- invalid historical records
- concurrent application access where relevant

Destructive migrations require additional recovery testing.

---

# 34. Schema Drift

Schema drift occurs when the actual database differs from the version-controlled schema.

Examples:

```text id="j8q3p5"
Manual production table change
Manual column creation
Untracked index
Missing migration
```

Schema drift must be treated as a defect.

Production changes should originate from version-controlled migrations.

---

# 35. Environment Consistency

The following environments should use the same migration history:

```text id="f7x2m9"
Development
Testing
Staging
Production
```

They may contain different data.

They should not intentionally contain different schema histories.

---

# 36. Demo Development Workflow

Typical workflow:

```text id="q2v8k5"
Developer changes schema
        ↓
Generate/write migration
        ↓
Apply locally
        ↓
Run tests
        ↓
Commit migration + application change
        ↓
CI applies to test database
        ↓
Deploy
```

The migration and compatible application change should normally be reviewed together.

---

# 37. Migration Review Checklist

Before merging a migration, verify:

- What business requirement requires this change?
- Which module owns the affected entity?
- Does tenant isolation remain intact?
- Are existing records compatible?
- Are constraints correct?
- Are indexes required?
- Could the migration lock a large table?
- Could it fail because of existing data?
- Is it backward compatible?
- Is a backfill required?
- Is the backfill safe to retry?
- Is rollback possible?
- Does application code remain compatible during deployment?
- Are tests included?

---

# 38. Migration Security

Migration files must not contain:

- production passwords
- API keys
- secrets
- personal credentials
- hardcoded production connection strings

Production credentials belong in secure deployment configuration.

Migration scripts should operate through the application's controlled database connection.

---

# 39. Database Permissions

The production migration mechanism should use a database role with only the permissions required to perform schema changes.

Application runtime credentials should not automatically have unrestricted schema-management permissions if the deployment architecture allows separation.

Conceptually:

```text id="y9r3x7"
Application role
    → application data operations

Migration role
    → schema/data migration operations
```

The exact PostgreSQL role strategy depends on deployment architecture.

---

# 40. Backup Requirements

Before significant destructive or high-risk migrations, recovery capability must be verified.

Important checks include:

- recent backup exists
- backup is accessible
- restore procedure is known
- database integrity can be verified

A backup that has never been tested is mostly a very optimistic file.

---

# 41. Migration Observability

Migration execution should provide:

- migration identifier
- start time
- completion time
- success/failure status
- error information
- environment
- deployment revision

Long-running migrations should expose enough information to determine whether they are progressing or blocked.

---

# 42. Migration and Tenant Data

Schema migrations generally operate across all tenants.

Business data migrations must preserve tenant boundaries.

For example:

```text id="5r2q8m"
UPDATE products
...
```

must be carefully designed so that the transformation is correct for every store.

Tenant-specific migrations should explicitly identify the affected store scope when the business operation requires it.

---

# 43. Migration and Historical Data

Historical data must be treated carefully.

For:

```text id="s3x7v9"
orders
order_items
payments
inventory_adjustments
```

a schema migration must not unintentionally alter historical meaning.

For example, changing the current product price representation must not rewrite historical order prices.

Historical data should be migrated only when the transformation preserves its original business meaning.

---

# 44. Migration and External Integrations

Database migrations must account for provider references.

Example:

```text id="k5m8p2"
payment.provider_reference
```

Changing provider-reference storage must not invalidate reconciliation with the provider.

Likewise:

```text id="v3q7n1"
object_storage_key
webhook_event_id
```

must remain stable where external systems depend on them.

---

# 45. Migration and Background Jobs

Schema changes must account for queued jobs that may have been created by older application versions.

For example:

```text id="f2n6x8"
Old job payload
    ↓
New worker version
```

The worker may need backward compatibility during deployment.

Job payloads should therefore avoid unnecessarily embedding unstable internal representations.

---

# 46. Expand-and-Contract Example

Suppose:

```text id="u5r8c2"
orders.customer_email
```

needs to be normalized into a new structure.

A safe evolution might be:

```text id="e7p3n9"
1. Add new column/table
2. Deploy code capable of reading old + new
3. Backfill existing orders
4. Begin writing new representation
5. Verify migration completeness
6. Switch reads fully
7. Remove obsolete representation later
```

This avoids requiring a single deployment to understand every version of the schema simultaneously.

---

# 47. Demo-to-V1 Migration Strategy

Demo should avoid schema decisions that make future evolution impossible.

However, Demo should not build elaborate migration infrastructure for hypothetical V1 scale.

Demo should provide:

```text id="j8m4x6"
versioned migrations
+
repeatable local setup
+
safe deployment process
+
backward-compatible changes
+
basic data migrations
```

V1 may add:

- online schema migration tooling
- advanced migration orchestration
- large-scale backfills
- partition migrations
- zero-downtime index changes
- automated drift detection
- more sophisticated rollback procedures

Only when actual scale requires them.

---

# 48. Migration Anti-Patterns

Avoid:

### Manual production SQL as the normal process

This creates undocumented schema drift.

### Editing applied migrations

This destroys migration history.

### Destructive migration and application deployment in one step

This increases rollback risk.

### Giant data migration transactions

These can hold locks and consume resources.

### Assuming clean production data

Existing records may violate newly introduced constraints.

### No compatibility period

Old and new application versions may overlap during deployment.

### Unversioned database changes

They cannot be reliably reproduced.

### Mixing schema migration with unrelated business operations

Migrations should have a clear purpose.

---

# 49. Migration Invariants

The following must remain true:

1. Every production schema change is represented by version-controlled migration history.
2. Applied migrations are immutable.
3. Migration order is deterministic.
4. Clean databases can be rebuilt from migrations.
5. Existing data is considered before adding constraints.
6. Destructive changes receive explicit review.
7. Large data migrations are designed for safe execution.
8. Application/schema compatibility is preserved during deployment.
9. Failed migrations stop deployment.
10. Production schema drift is treated as a defect.
11. Migration credentials are appropriately restricted.
12. Sensitive information never appears in migration files.
13. Historical commerce data retains its business meaning.
14. External identifiers remain valid through schema evolution.
15. Demo migrations remain simple enough to operate while supporting future V1 evolution.

---

# 50. Definition of Done

The migration strategy is complete when:

- Migration ownership is defined.
- Migration naming and ordering are defined.
- Local migration workflow is defined.
- Seed data is separated from schema migrations.
- Expand-and-contract is established as the preferred strategy for breaking changes.
- Index and constraint migrations are addressed.
- Data backfills are addressed.
- Destructive changes require explicit review.
- Production migration workflow is defined.
- Rollback and recovery expectations are defined.
- CI migration validation is defined.
- Schema drift is addressed.
- Background-job compatibility is addressed.
- External integration references are protected.
- Demo-to-V1 migration evolution is documented.