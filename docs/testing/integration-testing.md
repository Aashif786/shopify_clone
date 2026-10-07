# Integration Testing

## 1. Purpose

This document defines the integration-testing strategy for the Shopify-like commerce platform.

Integration tests verify that independently implemented components work correctly together, particularly where behavior depends on PostgreSQL, transactions, repositories, module boundaries, external integration adapters, and background processing.

Integration tests are essential because unit tests alone cannot prove that the actual system boundaries behave correctly.

---

## 2. Core Principles

Integration tests should:

- Exercise real component boundaries.
- Use a real PostgreSQL-compatible database where database behavior matters.
- Verify transactions and constraints.
- Verify tenant isolation.
- Verify module integration.
- Verify realistic failure behavior.
- Remain deterministic.
- Avoid unnecessary external dependencies.
- Complement, not replace, unit and E2E tests.

---

## 3. What Integration Tests Verify

Integration tests are appropriate for:

- PostgreSQL queries.
- Repositories.
- Database constraints.
- Transactions.
- Migrations.
- Application services with persistence.
- Module interactions.
- API-to-application behavior.
- Payment provider adapters.
- Webhook processing.
- Background jobs.
- Idempotency.
- Concurrency-sensitive operations.

---

## 4. Real Database Requirement

When testing PostgreSQL-specific behavior, use PostgreSQL rather than a simplified in-memory substitute.

This is particularly important for:

- Foreign keys.
- Unique constraints.
- Transactions.
- Row locks.
- `FOR UPDATE`.
- `SKIP LOCKED`.
- Isolation behavior.
- Indexes.
- PostgreSQL-specific query semantics.

A mocked database cannot prove these behaviors.

---

## 5. Test Database

Integration tests should run against an isolated test database.

The test environment should:

- Use test-only credentials.
- Never connect to production.
- Be disposable where practical.
- Start from a known schema.
- Support migrations.
- Isolate test data.

The database lifecycle should be documented by the repository's local-development and testing infrastructure.

---

## 6. Database Initialization

A typical integration test environment should follow:

```text id="f7m2q8"
Start PostgreSQL
      ↓
Apply migrations
      ↓
Prepare test database
      ↓
Run tests
      ↓
Clean up
```

The exact implementation may use Docker or another controlled environment.

---

## 7. Migration Testing

Integration tests should verify that migrations:

- Apply successfully.
- Produce the expected schema.
- Preserve required constraints.
- Work against representative existing data where appropriate.
- Do not break application queries.

Migration testing should be performed before merging significant schema changes.

---

## 8. Test Isolation

Tests must not depend on execution order.

Isolation strategies may include:

- Transaction rollback.
- Truncation.
- Per-test schemas.
- Fresh test databases.
- Carefully scoped fixtures.

The selected strategy should balance correctness and execution speed.

---

## 9. Transactions

Integration tests must verify actual transaction behavior where correctness depends on it.

Examples:

```text id="r4n8x2"
checkout completion
inventory reservation
order creation
payment state update
discount usage
```

Test both:

- Successful commit.
- Failure and rollback.

---

## 10. Rollback Testing

For operations that modify multiple records atomically, test failure midway through the workflow.

Example:

```text id="m8q3v5"
Create order
  ↓
Update inventory
  ↓
Failure
  ↓
Transaction rollback
```

The test should verify that partial state does not remain.

---

## 11. Repository Integration Tests

Repositories should be tested against the actual database.

Tests should verify:

- Create.
- Read.
- Update.
- Delete/archive behavior.
- Filters.
- Pagination.
- Tenant scoping.
- Constraints.
- Relationships.
- Query results.

Repository tests should verify real persistence behavior rather than only mocked return values.

---

## 12. Tenant Isolation Testing

Every tenant-aware repository or application service should have cross-tenant tests.

Example:

```text id="v5q9k2"
Store A
  Product A

Store B
  Product B
```

A query scoped to Store A must never return Product B.

Test:

- Reads.
- Updates.
- Deletes.
- Lists.
- Searches/filters.
- Relationship queries.

---

## 13. Authorization Integration Tests

Integration tests should verify that authorization is enforced across actual request/application boundaries.

Examples:

```text id="x7m3p8"
Staff attempts owner-only operation
Customer attempts merchant operation
Store A user requests Store B resource
Suspended member accesses store
Removed member accesses store
```

The expected denial must occur before unauthorized state mutation.

---

## 14. Database Constraint Testing

Important constraints should be tested.

Examples:

```text id="k2n8r4"
unique SKU
unique store slug
unique discount code per store
foreign key relationships
positive quantity
valid reservation references
```

Application validation should provide user-friendly errors, but database constraints remain the final integrity boundary.

---

## 15. Inventory Integration Testing

Inventory requires strong integration coverage.

Test:

### Reservation

```text id="q6m4x9"
available stock
→ reservation
→ available decreases
→ reserved increases
```

### Release

```text id="r8v2n5"
active reservation
→ release
→ stock becomes available again
```

### Commit

```text id="p3k7m8"
active reservation
→ commit
→ reservation finalized
```

### Failure

Verify that failed workflows do not leave incorrect stock state.

---

## 16. Inventory Concurrency Testing

Concurrency tests should use multiple database operations executing concurrently.

Example:

```text id="s5n8q3"
Stock = 1

Request A → reserve 1
Request B → reserve 1

Expected:
Exactly one succeeds.
Exactly one fails.
Stock never becomes negative.
```

The test must verify final database state.

---

## 17. Multi-Item Inventory Testing

For checkout containing multiple variants, test:

```text id="h7m2x8"
Variant A → available
Variant B → insufficient
```

The expected behavior is atomic from the customer's perspective:

```text id="y4q9n3"
No partial reservation
```

The test should confirm that successful reservations are rolled back when the complete operation cannot succeed.

---

## 18. Cart Integration Testing

Cart tests should verify:

- Cart persistence.
- Cart item uniqueness.
- Quantity updates.
- Store ownership.
- Customer association.
- Guest behavior.
- Cart conversion.
- Expiration behavior.

The database must enforce relevant uniqueness and relationship constraints.

---

## 19. Discount Integration Testing

Discount integration tests should verify:

- Code lookup.
- Store scope.
- Active date range.
- Usage limits.
- Per-customer limits.
- Transaction-safe usage.
- Concurrent redemption.
- Duplicate redemption.

Concurrency is particularly important for limited-use discount codes.

---

## 20. Checkout Integration Testing

Checkout integration tests should verify the complete application workflow.

Example:

```text id="b6q3m9"
Cart
  ↓
Checkout creation
  ↓
Server-side pricing
  ↓
Discount validation
  ↓
Inventory reservation
  ↓
Payment creation
  ↓
Payment result
  ↓
Order creation
  ↓
Checkout completion
```

Each critical transition should be tested.

---

## 21. Checkout Failure Testing

Test failures such as:

- Invalid cart.
- Product no longer available.
- Insufficient inventory.
- Invalid discount.
- Payment failure.
- Payment timeout.
- Duplicate completion.
- Checkout expiration.

Verify that state remains internally consistent after each failure.

---

## 22. Payment Integration Testing

Payment provider integrations should use:

- Test implementations.
- Provider sandbox environments where appropriate.
- Controlled test responses.

Test:

```text id="n9x4m7"
payment creation
success
failure
timeout
capture
refund
partial refund
duplicate request
```

Never use production payment credentials in integration tests.

---

## 23. Payment Idempotency Testing

Example:

```text id="v3m8q2"
Request:
idempotencyKey = abc123

First attempt:
payment created

Second attempt:
same logical payment result returned
```

Then test:

```text id="w7k4n5"
same key
different amount
```

Expected result:

```text id="x2q9m6"
IDEMPOTENCY_KEY_REUSED
```

---

## 24. Webhook Integration Testing

Webhook integration tests should verify the complete processing boundary:

```text id="f8m3r7"
HTTP request
  ↓
signature verification
  ↓
event persistence
  ↓
duplicate detection
  ↓
payment state update
  ↓
internal event/workflow
```

Test both valid and invalid signatures.

---

## 25. Duplicate Webhook Testing

Send the same provider event more than once.

Expected behavior:

```text id="j6q2p8"
First delivery
→ process

Second delivery
→ no duplicate side effect
```

Verify final database state rather than only HTTP responses.

---

## 26. Order Integration Testing

Order tests should verify:

- Creation from checkout.
- Order item persistence.
- Historical snapshots.
- Customer relationship.
- Store relationship.
- Payment relationship.
- Inventory relationship.
- Status history.
- Duplicate creation prevention.

---

## 27. Historical Data Testing

Integration tests should prove that historical order information remains stable.

Example:

```text id="m5v8x3"
Create product at ₹100
Create order
Change product price to ₹150

Expected:
Existing order still contains ₹100.
```

The exact currency representation should follow the database specification.

---

## 28. Customer Integration Testing

Test:

- Customer creation.
- Store scoping.
- User association.
- Address persistence.
- Default address behavior.
- Guest customer handling.
- Order relationships.
- Deactivation/anonymization behavior where implemented.

---

## 29. Store Integration Testing

Test:

- Organization creation.
- Store creation.
- Store settings.
- Membership creation.
- Role assignment.
- Membership state changes.
- Owner protection.
- Store isolation.

Store creation should verify the expected transaction behavior across organization, membership, store, and settings records.

---

## 30. API Integration Testing

API integration tests should verify:

```text id="q8n4m2"
HTTP request
  ↓
authentication
  ↓
tenant resolution
  ↓
authorization
  ↓
validation
  ↓
application service
  ↓
database
  ↓
API response
```

This provides stronger confidence than testing individual functions alone.

---

## 31. API Error Testing

Integration tests should verify the actual API error contract.

Examples:

```text id="r3x7m8"
401 authentication
403 authorization
404 tenant-safe not found
409 conflict
422 validation/business input
500 unexpected error
```

The response should not expose internal implementation details.

---

## 32. Background Job Integration Testing

Worker integration tests should verify:

- Job persistence.
- Claiming.
- Execution.
- Retry.
- Failure state.
- Idempotency.
- Tenant context.
- Concurrent worker behavior.

Where worker claiming uses database locking, test the actual PostgreSQL behavior.

---

## 33. Worker Concurrency

If multiple workers can claim jobs, test:

```text id="n7m2q5"
Worker A → claims job
Worker B → attempts same job

Expected:
Only one worker processes the job.
```

This should be verified using the real database locking strategy.

---

## 34. External Integration Boundaries

External providers should generally be replaced by controlled test implementations.

The integration test should still verify:

- Request mapping.
- Response mapping.
- Error mapping.
- Timeout handling.
- Retry classification.
- Provider-specific behavior.

Do not make CI dependent on an external provider being available.

---

## 35. Object Storage Integration

If object storage is part of the Demo:

- Test metadata persistence.
- Test object key generation.
- Test access policy.
- Test upload lifecycle where practical.
- Test failure handling.

Actual production storage should not be used for automated tests.

---

## 36. Test Fixtures

Fixtures should create realistic but minimal data.

For example:

```text id="c4m8x2"
Organization
  ↓
Store
  ↓
User + Membership
  ↓
Product
  ↓
Variant
  ↓
Inventory
```

Fixtures should avoid creating unrelated data that makes tests difficult to understand.

---

## 37. Test Factories

Factories may provide reusable creation helpers.

Examples:

```text id="v8q3m6"
createTestOrganization()
createTestStore()
createTestUser()
createTestProduct()
createTestVariant()
createTestCustomer()
createTestCart()
```

Factories must preserve required domain invariants.

---

## 38. Time and Integration Tests

Time-dependent workflows should use controlled timestamps where possible.

Examples:

- Checkout expiration.
- Discount activation.
- Discount expiration.
- Reservation expiration.
- Session expiration.
- Job retry timing.

Avoid long real-time waits in integration tests.

---

## 39. Cleanup

Integration tests must clean up their database state.

Cleanup should occur even if a test fails.

The chosen strategy must not leave data that can influence subsequent tests.

---

## 40. Test Determinism

Integration tests should not depend on:

- Test execution order.
- Random production-like data.
- External network availability.
- Developer machine state.
- Uncontrolled system time.
- Existing database contents.

A test that passes locally but fails unpredictably in CI is not acceptable.

---

## 41. Integration Test Performance

Integration tests are slower than unit tests.

To keep execution practical:

- Reuse database infrastructure where safe.
- Keep fixtures small.
- Avoid unnecessary setup.
- Avoid external network calls.
- Run focused suites during development.

CI should still execute the appropriate integration coverage before merging.

---

## 42. Failure Diagnosis

Integration failures should provide enough context to identify:

- Test case.
- Tenant/store.
- Relevant entity.
- Database operation.
- Expected state.
- Actual state.

Do not expose secrets in test output.

---

## 43. AI-Generated Integration Tests

AI-generated integration tests must be reviewed carefully.

Verify that the test:

- Uses the real boundary it claims to test.
- Actually writes/reads from the test database.
- Exercises the intended transaction.
- Tests the intended tenant scope.
- Has meaningful assertions.
- Does not accidentally use mocks that bypass the behavior.

---

## 44. Migration and Schema Verification

When a schema change is introduced, integration testing should verify:

```text id="q7m3n8"
migration
  ↓
schema
  ↓
application query
  ↓
expected behavior
```

A migration that applies successfully but breaks application behavior is still a failed change.

---

## 45. Integration Test Checklist

Before completing an integration-test implementation:

```text id="x8m4q2"
[ ] Real database is used where database behavior matters
[ ] Test database is isolated
[ ] Migrations are applied
[ ] Transactions are tested where relevant
[ ] Constraints are tested
[ ] Tenant isolation is tested
[ ] Authorization is tested
[ ] Critical workflows are tested
[ ] Concurrency is tested where required
[ ] Idempotency is tested where required
[ ] External integrations use controlled test environments
[ ] Webhooks are tested
[ ] Background jobs are tested where relevant
[ ] Test data is isolated
[ ] Tests are deterministic
[ ] Cleanup is reliable
[ ] Relevant verification was executed
```