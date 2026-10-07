# Database Testing

## 1. Purpose

This document defines the strategy for testing PostgreSQL behavior, schema integrity, transactions, constraints, concurrency, migrations, and tenant isolation.

Database tests are required wherever correctness depends on database behavior that cannot be reliably verified through unit tests alone.

---

## 2. Testing Principles

Database testing follows these principles:

- Test against PostgreSQL when PostgreSQL behavior matters.
- Test business invariants at the database boundary.
- Keep test databases isolated.
- Make tests deterministic.
- Test transactions explicitly.
- Test concurrency for critical operations.
- Test tenant isolation.
- Test migrations independently.
- Test constraints rather than assuming application validation is sufficient.
- Prefer realistic database behavior over excessive mocking.

---

## 3. Database Testing Layers

The platform uses several database-related testing layers:

```text
Unit Tests
    ↓
Repository / Persistence Tests
    ↓
Integration Tests
    ↓
API Tests
    ↓
E2E Tests
```

Each layer serves a different purpose.

---

## 4. Unit Tests

Unit tests should verify business rules without requiring PostgreSQL when database behavior is irrelevant.

Examples:

- Price calculations.
- Discount calculations.
- Inventory quantity rules.
- State transitions.
- Validation.
- Domain invariants.

Unit tests should not attempt to simulate PostgreSQL locking or transaction semantics.

---

## 5. Persistence Tests

Persistence tests verify that repositories and database adapters correctly interact with PostgreSQL.

Examples:

- Creating a product.
- Retrieving a product.
- Updating inventory.
- Creating an order.
- Persisting payment state.
- Querying tenant-scoped records.

These tests should use a real test database.

---

## 6. Integration Tests

Integration tests verify multiple application components together.

Examples:

```text id="8m4z0a"
Application Service
      ↓
Repository
      ↓
PostgreSQL
```

They should validate:

- Transactions.
- Constraints.
- Relationships.
- Query behavior.
- Tenant scoping.
- Concurrency.
- Idempotency.

---

## 7. Test Database

Database tests must run against an isolated PostgreSQL database.

The test database must never be:

- Demo.
- Production.
- A developer's personal database.
- A shared database containing uncontrolled state.

---

## 8. Test Database Lifecycle

A typical CI lifecycle is:

```text id="x3f5qk"
Create PostgreSQL
       ↓
Create test database
       ↓
Apply migrations
       ↓
Load fixtures/factories
       ↓
Run tests
       ↓
Collect results
       ↓
Discard database
```

---

## 9. PostgreSQL Version

The test environment should use the same major PostgreSQL version as the target Demo environment whenever practical.

This reduces environment-specific behavior.

If multiple PostgreSQL versions must be supported later, compatibility testing can be expanded.

---

## 10. Migrations Before Tests

Integration tests should run against the actual migrated schema.

Do not manually create a simplified test schema that differs from the application schema.

The preferred approach is:

```text id="m9f2qj"
Empty Database
      ↓
Application Migrations
      ↓
Test Schema
      ↓
Tests
```

---

## 11. Schema Verification

Tests should verify important database constraints.

Examples:

- Required fields reject invalid records.
- Foreign keys reject invalid relationships.
- Unique constraints reject duplicates.
- Check constraints reject invalid values.
- Tenant-scoped uniqueness works correctly.

---

## 12. Primary Keys

Tests should verify that primary-key behavior works as intended.

Where generated identifiers are used:

- IDs are generated correctly.
- Duplicate identifiers are rejected.
- References use the correct identifier type.
- IDs cannot accidentally cross tenant boundaries.

---

## 13. Foreign Key Testing

Foreign keys should be tested for:

- Valid references.
- Invalid references.
- Deletion behavior.
- Update behavior where relevant.

Example:

```text id="9b4k8x"
Delete Store
   ↓
Related resources
   ↓
Expected constraint/domain behavior
```

The expected behavior must be explicitly defined rather than left to accident.

---

## 14. Unique Constraint Testing

Test every business-critical unique constraint.

Examples:

```text id="7a1p3v"
(store_id, slug)
(store_id, sku)
(store_id, discount_code)
(provider, provider_event_id)
(store_id, idempotency_key)
```

Tests must also verify tenant isolation of uniqueness.

For example:

```text id="1c4y6q"
Store A → SKU-001
Store B → SKU-001
```

may be valid when SKU uniqueness is store-scoped.

---

## 15. Nullability Testing

Required fields must be protected at the database layer where appropriate.

Tests should verify that invalid `NULL` values are rejected.

Application validation should not be the only protection for critical invariants.

---

## 16. Check Constraints

Where database check constraints are used, tests should verify invalid states are rejected.

Examples:

- Quantity cannot become invalid.
- Monetary values cannot violate defined rules.
- Status values remain valid.
- Numeric ranges remain within allowed bounds.

---

## 17. Tenant Isolation Testing

Tenant isolation is a critical database test category.

Tests must verify that:

```text id="c0s7ra"
Store A
   ↓
Cannot read Store B records
Cannot modify Store B records
Cannot delete Store B records
Cannot infer protected Store B data
```

This must be tested across all relevant domains.

---

## 18. Cross-Tenant Query Tests

Every repository/query pattern that handles store-owned data should have representative tenant-isolation coverage.

Examples:

- Products.
- Inventory.
- Customers.
- Carts.
- Discounts.
- Checkout.
- Payments.
- Orders.
- Media.
- Store configuration.

---

## 19. Authorization vs Tenant Tests

Tenant isolation and authorization are related but distinct.

Tests should verify:

```text id="6j3h0x"
Correct tenant + insufficient permission
        ↓
Denied

Wrong tenant + sufficient role
        ↓
Denied
```

A valid role in one store must not authorize access to another store.

---

## 20. Transaction Tests

Transactions should be tested for atomicity.

Example:

```text id="d4r1ap"
Operation
  ├── Update A
  ├── Update B
  └── Update C
       ↓
Failure
       ↓
A, B, C rolled back
```

Tests should confirm that partial business state is not persisted.

---

## 21. Commit Tests

Tests should verify successful transactions commit all expected changes.

Example:

```text id="s0v3pu"
Checkout completion
    ↓
Payment state
    +
Order
    +
Inventory reservation/finalization
    ↓
COMMIT
```

All required changes must become visible together according to the defined workflow.

---

## 22. Rollback Tests

A transaction should be forced to fail after intermediate changes.

The test should verify that:

- Earlier writes are rolled back.
- No partial order remains.
- Inventory changes are rolled back when appropriate.
- Idempotency records behave according to the operation's design.

---

## 23. Nested Transaction Behavior

Where application services can call other services, test that transaction ownership remains predictable.

The architecture should avoid accidental independent commits inside a larger business operation.

---

## 24. Concurrency Testing

Concurrency testing is mandatory for critical database operations.

Important cases include:

- Inventory reservation.
- Inventory release.
- Checkout completion.
- Payment creation.
- Order creation.
- Discount usage.
- Idempotency handling.

---

## 25. Inventory Concurrency

Example:

```text id="9h6t5b"
Stock = 1

Request A ──┐
             ├── Reserve
Request B ──┘
```

The test must prove that the system cannot successfully reserve the same single unit twice.

Expected result:

```text id="6k4d1s"
One request → success
Other request → conflict/failure
```

---

## 26. Atomic Inventory Updates

Tests should verify that inventory updates remain atomic.

An operation such as:

```text id="t9j8q2"
UPDATE inventory
SET available = available - 1
```

must not permit the quantity to become invalid through concurrent execution.

The exact implementation may use row locks or atomic conditional updates.

---

## 27. Multi-Item Inventory

Checkout involving multiple inventory items must be tested for atomicity.

Example:

```text id="w7y3n2"
Product A → available
Product B → unavailable

Checkout
    ↓
Expected:
No partial reservation
```

The system must not reserve only Product A while silently failing Product B unless the domain explicitly defines such behavior.

---

## 28. Deadlock Testing

Where multiple resources are locked, tests should cover potential deadlock scenarios.

The implementation should use deterministic lock ordering where practical.

If a transaction can safely retry after a deadlock or serialization failure, the retry behavior should also be tested.

---

## 29. Isolation-Level Testing

The application should normally use PostgreSQL's default `READ COMMITTED`.

If stronger isolation is introduced, tests must demonstrate why it is necessary.

Tests should verify expected behavior under:

- Concurrent writes.
- Serialization failures.
- Retry conditions.

---

## 30. Idempotency Testing

Critical operations must be tested for safe retries.

Example:

```text id="g6n1r4"
Request
   ↓
Operation succeeds
   ↓
Same request repeated
   ↓
No duplicate business effect
```

Test cases should include:

- Same key + same request.
- Same key + different request.
- Concurrent same-key requests.
- Failed first attempt.
- Retried successful attempt.

---

## 31. Payment Idempotency

Payment tests should verify that repeated payment requests do not create duplicate charges or duplicate internal payment attempts where prohibited.

The database should enforce the required uniqueness guarantees.

External payment-provider behavior must be tested through appropriate integration boundaries or sandbox environments.

---

## 32. Webhook Idempotency

Webhook tests should verify:

```text id="k7b4qp"
Webhook event
      ↓
Persist event identity
      ↓
Process
      ↓
Duplicate event
      ↓
No duplicate business effect
```

Provider event identifiers should be treated as untrusted external identifiers and validated according to the provider integration.

---

## 33. Job Concurrency

Background-job database behavior should be tested.

Tests should verify that two workers cannot incorrectly claim the same job.

Where applicable, use PostgreSQL mechanisms such as:

```text id="p0v4y1"
FOR UPDATE SKIP LOCKED
```

The exact implementation belongs to the job persistence layer.

---

## 34. State Transition Testing

Database-backed state machines should test:

- Valid transitions.
- Invalid transitions.
- Concurrent transitions.
- Repeated transitions.
- Historical state recording.

Examples:

- Order status.
- Payment status.
- Checkout status.
- Cart status.
- Product status.
- Reservation status.

---

## 35. Historical Data Testing

Tests must verify that historical records remain stable.

Example:

```text id="j8z3d2"
Product price = 100
       ↓
Order created
       ↓
Product price = 150
       ↓
Existing order
       ↓
Still reflects 100
```

The exact snapshot fields depend on the order model.

---

## 36. Pagination Testing

Database-backed pagination should test:

- Default limits.
- Maximum limits.
- Stable ordering.
- Cursor behavior.
- Tenant scoping.
- Duplicate/missing records between pages.

Tests should avoid unbounded database queries.

---

## 37. Filtering and Sorting

Tests should verify that:

- Only allowed filters are accepted.
- Only allowed sort fields are accepted.
- Tenant scoping remains enforced.
- Appropriate indexes exist for important access patterns.
- Invalid filters fail safely.

Arbitrary SQL expressions must never be accepted as user-controlled filter or sort input.

---

## 38. Repository Tests

Repository tests should verify behavior rather than internal SQL formatting.

Good test:

```text
Create product
   ↓
Retrieve product
   ↓
Expected product returned
```

Less useful:

```text
Assert exact SQL string
```

Unless SQL generation itself is the behavior being tested.

---

## 39. Query Performance Tests

Performance testing should focus on important queries.

Potential checks include:

- Product listing.
- Inventory lookup.
- Cart retrieval.
- Order listing.
- Customer lookup.
- Storefront product retrieval.

Use query plans when necessary.

Performance tests should identify regressions rather than enforce arbitrary micro-optimizations.

---

## 40. N+1 Testing

Important application paths should be reviewed for N+1 database queries.

Examples:

```text id="y2n5r8"
Order list
   ↓
100 orders
   ↓
100 individual item queries
```

should be avoided when the data can be retrieved efficiently.

Tests or instrumentation may be used to detect excessive query counts.

---

## 41. Migration Testing

Every migration should be tested in at least two scenarios where relevant:

### Fresh database

```text id="e7t0n1"
Empty DB
   ↓
All migrations
   ↓
Latest schema
```

### Existing database

```text id="n5v8p3"
Representative old schema/data
   ↓
Migration
   ↓
Expected new schema/data
```

---

## 42. Data Migration Testing

Data migrations require explicit assertions.

Verify:

- Records transformed correctly.
- No records unexpectedly lost.
- Required fields populated.
- Unique constraints remain valid.
- Relationships remain intact.
- Old values map correctly to new values.

---

## 43. Migration Failure Testing

Where practical, test migration behavior under failure conditions.

Verify that:

- Partial state is not silently accepted.
- Transactional migrations roll back appropriately.
- Non-transactional operations are understood.
- Recovery procedures are documented.

---

## 44. Backup and Restore Testing

Backup restoration should be tested independently of application tests.

A restore test should verify:

```text id="r8p2v4"
Backup
  ↓
Restore PostgreSQL
  ↓
Run validation
  ↓
Connect application
  ↓
Verify critical records
```

This should use an isolated recovery environment.

---

## 45. Test Factories

Database factories should create realistic valid records.

Factories should support:

- Different stores.
- Different memberships.
- Different users.
- Different product states.
- Different inventory levels.
- Different customer states.
- Different order states.

Factories should not hide important relationships from the test reader.

---

## 46. Fixtures

Fixtures should be used selectively.

Use fixtures when:

- Data is stable.
- The scenario is complex.
- Recreating the same state repeatedly is useful.

Prefer factories when tests require flexible data.

---

## 47. Test Cleanup

Tests must clean up their database state.

Possible strategies include:

- Transaction rollback.
- Truncation.
- Database recreation.
- Isolated schemas.

The chosen approach must work correctly with the application's transaction behavior and parallel test execution.

---

## 48. Parallel Testing

Tests may run in parallel only when database isolation is guaranteed.

Parallel tests must not accidentally:

- Modify the same records.
- Consume the same inventory.
- Share idempotency keys.
- Depend on global state.

Concurrency tests are an intentional exception because shared state is part of what they test.

---

## 49. CI Database Testing

CI should run database tests using disposable infrastructure.

The pipeline should:

```text id="c5n7r2"
Start PostgreSQL
    ↓
Apply migrations
    ↓
Run database/integration tests
    ↓
Run relevant E2E tests
    ↓
Destroy test environment
```

Failures must fail the CI run.

---

## 50. Security Database Tests

Database tests should include security-related cases:

- Cross-tenant access.
- Unauthorized updates.
- Unauthorized deletes.
- IDOR scenarios.
- Malicious input.
- Constraint bypass attempts.
- Sensitive-field exposure.

---

## 51. Test Data Security

Test credentials and test payment data must not be real production credentials.

Do not include:

- Real customer information.
- Real payment credentials.
- Production API keys.
- Production session secrets.

---

## 52. AI-Assisted Database Testing

AI-generated database tests must be reviewed for correctness.

AI agents must not:

- Replace real PostgreSQL tests with mocks when DB behavior matters.
- Remove failing concurrency tests.
- Weaken tenant-isolation tests.
- Disable constraints to make tests pass.
- Create tests that merely reproduce implementation details.
- Claim concurrency behavior is verified without actually exercising concurrency.

---

## 53. Required High-Risk Test Matrix

The following areas require strong database coverage:

| Area | Required Coverage |
|---|---|
| Tenant isolation | Cross-tenant read/write denial |
| Inventory | Concurrency and atomicity |
| Checkout | Transaction integrity |
| Payments | Idempotency and state consistency |
| Orders | Atomic creation and historical data |
| Discounts | Usage constraints and concurrency |
| Webhooks | Duplicate event handling |
| Jobs | Safe concurrent claiming |
| Migrations | Fresh and existing database |
| Authorization | Resource-level access |
| Constraints | FK, unique, nullability, checks |

---

## 54. Definition of Done

Database testing is complete when:

```text id="n4y7k1"
[ ] PostgreSQL test environment exists
[ ] Migrations run automatically in tests
[ ] Repository behavior is tested
[ ] Constraints are tested
[ ] Transactions are tested
[ ] Rollbacks are tested
[ ] Tenant isolation is tested
[ ] Authorization-sensitive queries are tested
[ ] Inventory concurrency is tested
[ ] Idempotency is tested
[ ] Webhook duplication is tested
[ ] Job concurrency is tested
[ ] State transitions are tested
[ ] Historical data behavior is tested
[ ] Pagination is tested
[ ] Important query performance is reviewed
[ ] Migration behavior is tested
[ ] Backup restoration is tested separately
[ ] CI executes database tests
[ ] Test data is isolated from real environments
[ ] AI-generated database tests are reviewed
```