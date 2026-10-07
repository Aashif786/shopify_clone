# Testing Conventions

## 1. Purpose

This document defines the conventions for writing, organizing, naming, executing, and maintaining tests in the Shopify-like commerce platform.

Testing must provide confidence in:

- Business correctness.
- Tenant isolation.
- Authorization.
- Database integrity.
- Concurrency.
- Idempotency.
- API contracts.
- Background processing.
- Critical customer and merchant workflows.

Tests should verify behavior rather than merely maximize coverage numbers.

---

## 2. Testing Principles

The project follows these principles:

1. Test behavior, not implementation details.
2. Test business-critical paths more deeply than trivial code.
3. Prefer deterministic tests.
4. Keep tests isolated from one another.
5. Use the lowest-cost test level that provides sufficient confidence.
6. Use integration tests when behavior depends on real database or module interaction.
7. Use E2E tests for important user journeys.
8. Explicitly test security boundaries.
9. Explicitly test concurrency-sensitive operations.
10. Tests must fail for meaningful reasons.
11. Do not weaken production code merely to make tests easier.
12. AI-generated tests must be reviewed for actual behavioral coverage.

---

## 3. Test Pyramid

The project should generally follow this structure:

```text
              E2E
             /   \
        Integration
          /       \
       Unit       API
```

The majority of tests should be fast unit tests.

Integration tests should cover interactions that cannot be meaningfully validated through isolated unit tests.

E2E tests should focus on high-value complete workflows.

---

## 4. Test Types

### Unit tests

Test isolated business logic.

Examples:

```text id="6y7x4n"
discount calculation
order state transition
money calculation
product validation
inventory rules
```

### Integration tests

Test real interaction between components.

Examples:

```text id="8p3m5v"
application service + PostgreSQL
checkout + inventory
order + payment state
repository behavior
```

### API tests

Test HTTP/API contracts.

Examples:

```text id="h4c9r2"
authentication
authorization
validation
pagination
error responses
tenant isolation
```

### E2E tests

Test complete user-facing workflows.

Examples:

```text id="q7n1x5"
merchant creates product
customer adds product to cart
customer completes checkout
merchant views order
```

### Security tests

Test security boundaries and attack scenarios.

Examples:

```text id="s5w2k8"
cross-tenant access
privilege escalation
invalid session
webhook signature failure
unauthorized mutation
```

---

## 5. Test Location

Tests should be located according to scope.

### Module-local tests

Use the module structure for tests tightly coupled to one module.

Example:

```text id="m5v8x2"
modules/inventory/
├── domain/
├── application/
└── ...
```

### Integration tests

Cross-module and database-backed tests belong under:

```text id="z8c4r1"
tests/integration/
```

### E2E tests

Complete browser workflows belong under:

```text id="t3k7q9"
tests/e2e/
```

---

## 6. Test Naming

Test names must describe observable behavior.

Prefer:

```text id="y2h6p4"
reserves inventory when sufficient stock exists
rejects reservation when stock is insufficient
prevents access to another store's order
returns the same result for a repeated idempotency key
```

Avoid:

```text id="b8q1s7"
works
test inventory
should pass
handles error
```

A developer should understand what failed by reading the test name.

---

## 7. Test File Naming

Use names that identify the tested behavior.

Examples:

```text id="r4m8z2"
product-service.test.ts
inventory-reservation.test.ts
checkout-service.test.ts
order-state-machine.test.ts
checkout.integration.test.ts
orders.api.test.ts
checkout.e2e.spec.ts
```

Follow the repository's existing test framework conventions where they differ.

---

## 8. Arrange, Act, Assert

Tests should generally follow:

```text id="4j7n2p"
Arrange
  ↓
Act
  ↓
Assert
```

Example:

```ts id="x9w3m6"
const inventory = await createInventory({ quantity: 10 });

const result = await reserveInventory({
  variantId,
  quantity: 3,
});

expect(result.reservedQuantity).toBe(3);
```

Avoid mixing unrelated setup and assertions throughout a test.

---

## 9. Test Isolation

Tests must not depend on execution order.

Each test should establish the state it needs.

Avoid:

```text id="n4k8q1"
test A creates data
test B assumes test A ran
test C assumes test B modified the database
```

Tests should be independently executable.

---

## 10. Database Tests

Database-backed tests should use an isolated test database or equivalent isolated mechanism.

Tests must not run against production data.

Database state should be reset or isolated between tests according to the test strategy.

Important database behavior should use the actual database engine where database semantics matter.

This is particularly important for:

- Constraints.
- Transactions.
- Row locking.
- Unique indexes.
- Concurrency.
- Serialization behavior.

---

## 11. Test Data

Test data should be explicit and understandable.

Prefer factories/builders for repeated structures.

Example:

```ts id="s4x8n2"
const store = await createTestStore();
const product = await createTestProduct({ storeId: store.id });
```

Avoid enormous global fixtures containing unrelated data.

Test data should represent realistic domain states.

---

## 12. Test Factories

Factories may be used to simplify setup.

A factory should:

- Create valid default data.
- Allow meaningful overrides.
- Avoid hiding important test assumptions.
- Remain deterministic where possible.

Example:

```ts id="z7q3m9"
createTestOrder({
  storeId,
  status: "CONFIRMED",
});
```

Do not create factories that hide the actual behavior being tested.

---

## 13. Mocking

Mock external systems when testing application behavior that should not depend on the external system.

Examples:

```text id="h7m3p8"
payment provider
email provider
object storage
external APIs
```

Do not mock the database automatically when the behavior depends on:

- Transactions.
- Constraints.
- Locking.
- SQL semantics.

Use real database integration tests for those behaviors.

---

## 14. Mock Boundaries

Mocks should occur at architectural boundaries.

Preferred:

```text id="c4r8x1"
Payment provider interface
        ↓
test double
```

Avoid mocking internal implementation details merely to make unit tests easier.

The test should remain valid if internal implementation changes while behavior stays the same.

---

## 15. Unit Test Scope

Unit tests should focus on deterministic business logic.

Good candidates:

- Money calculations.
- Discount calculations.
- State transitions.
- Validation rules.
- Quantity rules.
- Domain invariants.
- Pure transformations.

Avoid turning every simple function into a test simply to increase test count.

---

## 16. Integration Test Scope

Integration tests should verify important boundaries.

Examples:

```text id="b7w2k4"
application service → repository → PostgreSQL
checkout → inventory
checkout → payment abstraction
order → order persistence
webhook → payment state
```

Integration tests should be used when correctness depends on real component interaction.

---

## 17. API Test Scope

API tests should verify:

- Authentication.
- Authorization.
- Tenant resolution.
- Input validation.
- Application behavior.
- Response DTOs.
- Error contracts.
- Pagination.
- Idempotency where applicable.

Do not only test HTTP status codes.

Where appropriate, validate the response body and resulting state.

---

## 18. E2E Test Scope

E2E tests should represent important real user journeys.

For the Demo, high-value journeys include:

### Merchant

```text id="x2m8q6"
Sign in
→ Create store
→ Configure store
→ Create product
→ Add inventory
→ Publish product
```

### Customer

```text id="k5r1p9"
Visit storefront
→ Browse product
→ Add to cart
→ Checkout
→ Complete sandbox payment
→ Receive order confirmation
```

### Merchant order management

```text id="j8v3c5"
Sign in
→ View orders
→ Open order
→ Update order state
```

E2E coverage should focus on critical workflows rather than every UI interaction.

---

## 19. Security Testing

Security tests must explicitly attempt unauthorized behavior.

Examples:

```text id="s7n4q2"
Store A user → Store B resource
Customer → another customer's data
Staff → owner-only operation
Unauthenticated user → protected endpoint
Invalid webhook signature → webhook handler
Tampered payment amount → payment operation
```

A system is not considered secure merely because legitimate requests work.

---

## 20. Multi-Tenant Testing

Every store-scoped domain should have tests demonstrating tenant isolation.

Example:

```text id="h2q7m5"
Create Store A
Create Store B
Create resource in Store A
Authenticate Store B user
Attempt access
Assert access is denied
```

This pattern should be applied to:

- Products.
- Inventory.
- Customers.
- Carts.
- Discounts.
- Checkouts.
- Orders.
- Store configuration.

---

## 21. Authorization Testing

Authorization tests should cover each meaningful role.

Example:

```text id="v8c3m1"
Owner
Admin
Staff
Customer
```

Test both:

- Allowed operations.
- Forbidden operations.

Do not only test the happy path.

---

## 22. State Machine Testing

Stateful domains should test valid and invalid transitions.

Example:

```text id="n5x7q2"
Checkout:
OPEN
→ PAYMENT_PENDING
→ PAYMENT_PROCESSING
→ COMPLETED
```

Also test invalid transitions:

```text id="j3m8v4"
COMPLETED
→ OPEN
```

should be rejected.

State machine tests should verify that invalid transitions do not partially mutate related data.

---

## 23. Inventory Concurrency Tests

Inventory requires explicit concurrency tests.

Examples:

```text id="q6w2k9"
Available quantity = 10

Request A → reserve 7
Request B → reserve 7

Expected:
one request reserves 7
the other fails or receives only an explicitly supported result
inventory never becomes invalid
```

Tests should use realistic concurrent execution where possible rather than merely calling functions sequentially.

---

## 24. Checkout Tests

Checkout tests should cover:

- Valid cart.
- Empty cart.
- Product unavailable.
- Insufficient inventory.
- Invalid discount.
- Expired discount.
- Payment failure.
- Payment timeout.
- Duplicate completion request.
- Checkout expiration.
- Successful order creation.
- Recovery when external payment state and local state diverge.

---

## 25. Payment Tests

Payment tests should cover:

- Payment creation.
- Correct amount.
- Correct currency.
- Provider success.
- Provider failure.
- Timeout.
- Duplicate request.
- Idempotency.
- Webhook signature verification.
- Duplicate webhook.
- Out-of-order webhook where relevant.
- Capture.
- Partial refund.
- Full refund.
- Refund exceeding captured amount.

No test should use real production payment credentials.

---

## 26. Order Tests

Order tests should cover:

- Creation.
- Historical snapshots.
- State transitions.
- Cancellation.
- Customer access.
- Merchant access.
- Cross-tenant denial.
- Duplicate creation prevention.
- Status history.
- Payment state interaction.
- Inventory interaction.

---

## 27. Background Job Testing

Jobs should be tested for:

- Successful execution.
- Retryable failure.
- Permanent failure.
- Duplicate execution.
- Invalid payload.
- Missing referenced resource.
- Correct tenant context.
- Correct logging/observability behavior.

Job handlers should be safe to execute more than once when their design requires retryability.

---

## 28. Webhook Testing

Webhook tests should verify:

```text id="x5r8q2"
valid signature → accepted
invalid signature → rejected
duplicate event → safely ignored
temporary processing failure → retryable
permanent failure → terminal handling
```

Webhook processing must not rely on request order unless the provider guarantees ordering.

---

## 29. Idempotency Tests

For every idempotent operation, test:

### First request

Operation succeeds.

### Duplicate request

Same idempotency key produces the same logical result.

### Conflicting request

Same key with materially different request data is rejected.

### Failed first request

Retry behavior follows the documented semantics.

Critical examples:

```text id="r7m2k5"
order creation
payment creation
payment capture
refund
inventory reservation
webhook processing
```

---

## 30. Error Testing

Tests should verify stable error codes rather than exact internal error messages where possible.

Prefer:

```ts id="m8q4v2"
expect(response.body.error.code).toBe("INSUFFICIENT_INVENTORY");
```

over:

```ts id="z6k1p3"
expect(response.body.error.message)
  .toBe("InventoryReservationService failed...");
```

User-facing messages may change while error codes remain stable.

---

## 31. Test Timeouts

Tests should have reasonable timeouts.

Avoid unnecessarily large global timeouts because they can hide hanging operations.

Long-running tests should have a documented reason.

Concurrency and E2E tests may require different timeout values from simple unit tests.

---

## 32. Determinism

Tests should avoid dependence on:

- Current real-world time.
- Random values.
- Network availability.
- External service state.
- Test execution order.
- Developer machine state.

When time matters, use controlled clocks or explicit timestamps where the test framework supports them.

When randomness matters, use deterministic seeds where practical.

---

## 33. External Service Testing

External services should generally be tested at multiple levels.

### Unit

Mock the provider interface.

### Integration

Use sandbox/test providers where appropriate.

### E2E

Use a controlled sandbox workflow.

Production provider credentials must never be required for ordinary CI tests.

---

## 34. Test Coverage

Coverage is a useful signal, not the definition of quality.

High coverage does not guarantee:

- Tenant isolation.
- Correct concurrency.
- Correct authorization.
- Correct payment behavior.
- Correct state transitions.

Priority should be given to high-risk business behavior.

---

## 35. Regression Tests

Every significant production or development defect should result in a regression test when practical.

Example:

```text id="p3w7n2"
Bug:
duplicate checkout request created two orders.

Fix:
idempotent order creation.

Regression test:
same checkout completion request repeated twice
→ exactly one order.
```

The test should reproduce the failure mode before the fix where practical.

---

## 36. Test Cleanup

Tests should clean up their state appropriately.

Do not leave:

- Database records.
- Temporary files.
- Test objects in shared storage.
- External provider resources.

Persistent test environments should use isolation mechanisms rather than relying on manual cleanup.

---

## 37. Test Performance

Tests should remain fast enough for normal development.

When a test suite becomes slow:

1. Identify the slow tests.
2. Determine whether the slowness is justified.
3. Optimize setup and isolation.
4. Avoid replacing meaningful integration tests with weak mocks solely for speed.

Critical correctness must not be sacrificed to make CI faster.

---

## 38. CI Testing

CI should run the appropriate test layers.

Baseline:

```powershell id="q8w4m2"
pnpm test
```

Additional test commands may run for:

```text id="f7n3k1"
integration tests
E2E tests
security tests
database tests
```

The exact commands depend on repository configuration.

Tests that are required for merging should be enforced through CI where practical.

---

## 39. Local Testing

Developers should be able to run the most important tests locally.

Typical workflow:

```powershell id="h5r2v8"
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Targeted tests should be run during development before the full suite.

Example:

```powershell id="n6q1z4"
pnpm test -- inventory
```

The exact syntax depends on the configured test runner.

---

## 40. AI-Assisted Testing

AI agents must not generate tests solely to satisfy coverage metrics.

When implementing a feature, the agent should:

1. Read the relevant specification.
2. Identify expected behavior.
3. Identify failure cases.
4. Identify security boundaries.
5. Identify concurrency/idempotency requirements.
6. Add appropriate tests.
7. Run the tests.
8. Report actual results.

AI-generated tests must be reviewed for whether they would actually catch the intended defect.

---

## 41. Test Anti-Patterns

Avoid:

### Testing implementation details

```text id="c5m7p2"
expect(privateMethod).toHaveBeenCalled()
```

when the behavior can be tested through the public interface.

### Over-mocking

Mocking every dependency can produce tests that pass while the real system is broken.

### Shared mutable fixtures

Tests become order-dependent.

### Weak assertions

```text id="j2n8x5"
expect(result).toBeDefined()
```

when meaningful state can be asserted.

### Ignoring failures

Tests must not be skipped or weakened simply because they expose a real defect.

---

## 42. Definition of Done

Testing is complete when:

- Appropriate unit tests exist.
- Important integrations are covered.
- Critical API behavior is tested.
- High-value E2E workflows are covered.
- Authorization and tenant isolation are tested.
- Concurrency-sensitive operations are tested.
- Idempotent operations are tested.
- Payment and webhook behavior is tested.
- Background jobs have meaningful failure coverage.
- Tests are deterministic and isolated.
- Relevant verification commands have actually been run.
- Test results are reported accurately.