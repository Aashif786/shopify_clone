# Unit Testing

## 1. Purpose

This document defines the unit-testing standards for the Cal Cart commerce platform.

Unit tests provide fast feedback on isolated business logic and are particularly useful for domain rules, value objects, state transitions, validation logic, and deterministic application behavior.

They should complement, not replace, integration, API, security, and E2E testing.

---

## 2. Core Principles

Unit tests should be:

- Fast.
- Deterministic.
- Isolated.
- Behavior-focused.
- Easy to understand.
- Independent of external services.
- Independent of unrelated database state.

A unit test should fail for a meaningful reason.

---

## 3. What Belongs in Unit Tests

Good unit-test candidates include:

- Domain rules.
- Value objects.
- Business calculations.
- State transitions.
- Validation rules.
- Discount calculations.
- Money calculations.
- Quantity rules.
- Pure transformations.
- Small application-level policies.

---

## 4. What Does Not Belong Primarily in Unit Tests

Unit tests should not be the only test layer for:

- PostgreSQL behavior.
- Database constraints.
- Transactions.
- Real HTTP behavior.
- Authentication infrastructure.
- Provider integrations.
- Webhook signature verification.
- End-to-end checkout flows.

These require appropriate integration or higher-level tests.

---

## 5. Test Structure

Tests should generally follow:

```text id="f6k3m8"
Arrange
   ↓
Act
   ↓
Assert
```

Example concept:

```text id="x8q2n5"
Arrange:
  create cart with two items

Act:
  calculate subtotal

Assert:
  subtotal equals expected amount
```

Tests should remain focused on one meaningful behavior.

---

## 6. Behavior Over Implementation

Tests should verify what the code does rather than how it is internally structured.

Prefer:

```text id="q7m4v2"
reserves inventory when sufficient quantity exists
```

over testing:

```text id="m3n8x5"
repository.reserve() was called exactly once
```

unless the interaction itself is the behavior being tested.

---

## 7. Test Naming

Test names should describe the expected behavior.

Prefer:

```text id="k9r2m6"
returns an error when requested quantity exceeds available inventory
```

rather than:

```text id="w5x8p3"
testInventoryError
```

A failed test name should make the problem understandable.

---

## 8. Domain Unit Tests

Domain logic should be tested without unnecessary infrastructure.

Examples:

### Money

- Addition.
- Subtraction.
- Currency mismatch.
- Precision rules.
- Invalid values.

### Quantity

- Positive quantity.
- Zero rejection where prohibited.
- Negative rejection.
- Maximum constraints.

### State Machines

- Valid transitions.
- Invalid transitions.
- Terminal states.

---

## 9. Money Testing

Money is critical to commerce correctness.

Tests should verify:

- Exact arithmetic.
- Currency preservation.
- No floating-point rounding errors.
- Invalid currency operations.
- Negative values where prohibited.
- Discount calculations.

Example:

```text id="j4m8q2"
1000 cents + 250 cents
= 1250 cents
```

Do not use floating-point assertions for financial calculations when exact representation is expected.

---

## 10. Discount Testing

Discount calculation tests should cover:

```text id="v8n3x6"
percentage discount
fixed amount discount
minimum order
maximum discount
zero discount
discount greater than subtotal
currency mismatch
rounding
```

Tests should verify the final amount using the platform's defined money representation.

---

## 11. State Machine Testing

Every important state machine should test both valid and invalid transitions.

Example:

```text id="p5q8m1"
OPEN
  → PAYMENT_PENDING
```

should succeed when valid.

An invalid transition such as:

```text id="s2x7n4"
COMPLETED
  → OPEN
```

should fail.

---

## 12. Product Unit Tests

Product domain tests may cover:

- Valid product creation.
- Invalid product names.
- Slug rules.
- Product state transitions.
- Variant validation.
- SKU validation.
- Publication rules.

Database uniqueness should additionally be tested at the integration layer.

---

## 13. Inventory Unit Tests

Inventory domain logic should test:

- Positive quantity.
- Reservation rules.
- Release rules.
- Commit rules.
- Invalid reservation transitions.
- Insufficient quantity decisions.

Actual concurrent database behavior belongs in integration tests.

---

## 14. Cart Unit Tests

Cart logic should test:

- Adding a valid quantity.
- Updating quantity.
- Removing an item.
- Combining quantities for the same variant.
- Invalid quantity.
- Empty-cart behavior.
- Cart lifecycle transitions.

Cart tests must not treat client-provided price as authoritative.

---

## 15. Customer Unit Tests

Customer logic may test:

- Valid profile data.
- Email normalization.
- Customer status transitions.
- Address validation.
- Default address rules.

Database uniqueness and foreign-key behavior should be tested separately.

---

## 16. Checkout Unit Tests

Checkout domain logic should test:

- Valid checkout states.
- Invalid transitions.
- Total calculations.
- Discount application.
- Expiration behavior.
- Completion rules.
- Failure states.

External payment and inventory behavior should be tested through integration-level tests.

---

## 17. Payment Unit Tests

Payment domain tests should cover:

- Valid payment transitions.
- Invalid transitions.
- Amount validation.
- Currency validation.
- Refund rules.
- Partial refund calculations.
- Captured amount limits.

Provider API behavior belongs in integration tests.

---

## 18. Order Unit Tests

Order logic should test:

- Valid status transitions.
- Invalid transitions.
- Cancellation rules.
- Historical snapshot creation.
- Quantity validation.
- Total calculations where owned by the domain.

Actual persistence and database constraints require integration tests.

---

## 19. Store Unit Tests

Store logic should test:

- Valid creation.
- Store lifecycle.
- Settings validation.
- Membership states.
- Role rules.
- Owner protection.
- Valid and invalid membership transitions.

---

## 20. Application Service Unit Tests

Application services may be unit tested when their behavior can be isolated safely.

Examples:

```text id="r7m3x9"
authorization decisions
workflow branching
error mapping
domain coordination
event generation
```

Mocks should be used only for meaningful boundaries.

---

## 21. Mocking Rules

Mock external boundaries when necessary.

Good candidates:

- Payment provider.
- Email provider.
- Object storage.
- External HTTP service.
- Clock/time source.

Avoid excessive mocking of internal classes.

If a unit test requires a large mock graph to function, the design may be too tightly coupled.

---

## 22. Test Doubles

Use the simplest appropriate test double:

```text id="n8q4v2"
Stub
Mock
Fake
Spy
```

### Stub

Provides predetermined data.

### Mock

Verifies an expected interaction.

### Fake

Provides a lightweight functional implementation.

### Spy

Records interactions for assertions.

Do not use mocks automatically.

---

## 23. Repository Testing

Repositories generally require integration tests because their behavior depends on PostgreSQL.

A small amount of unit testing may be appropriate for:

- Query construction helpers.
- Mapping functions.
- Pure transformations.

Do not mock PostgreSQL and claim that database behavior has been tested.

---

## 24. Error Testing

Unit tests should verify meaningful failures.

Examples:

```text id="k3m7q8"
invalid state
invalid quantity
invalid money
invalid discount
unauthorized operation
business rule violation
```

Expected errors should be asserted by stable type/code rather than fragile message text where possible.

---

## 25. Boundary Testing

Important boundary values should be tested.

Examples:

```text id="v5n2x9"
quantity = 1
quantity = 0
quantity = maximum
amount = 0
discount = 0%
discount = 100%
minimum order threshold
expiration timestamp
```

Do not test arbitrary values merely to increase coverage.

---

## 26. Time-Dependent Logic

Time-dependent domain logic should use a controllable clock where practical.

Avoid tests that depend on real elapsed time.

Prefer deterministic concepts such as:

```text id="m7q4x2"
currentTime = fixed timestamp
expirationTime = known timestamp
```

This prevents flaky tests.

---

## 27. Randomness

Tests should avoid uncontrolled randomness.

If randomness is part of the behavior:

- Seed it deterministically.
- Inject the generator.
- Assert invariant behavior.

A test that sometimes passes and sometimes fails is not useful merely because humans enjoy uncertainty in other parts of life.

---

## 28. Test Isolation

Each unit test must be independent.

Do not rely on:

- Test execution order.
- Shared mutable variables.
- Previous test side effects.
- Global application state.

Tests should be safely runnable individually.

---

## 29. Test Data

Use focused test data.

Prefer:

```text id="x4m8p7"
product with required fields
```

over enormous fixtures containing unrelated entities.

Test factories should provide sensible defaults while allowing specific fields to be overridden.

---

## 30. Assertions

Assertions should prove the behavior under test.

Weak:

```text id="q8n3m5"
expect(result).toBeDefined()
```

when a specific value is expected.

Better:

```text id="r5k7v2"
expect(result.total).toEqual(expectedTotal)
```

Avoid assertions that pass even when the feature is broken.

---

## 31. Testing Exceptions

When a function should fail, assert:

- Error type/code.
- Relevant business condition.
- Important state preservation.

Do not assert entire error strings unless the exact message is part of the contract.

---

## 32. Testing Side Effects

If a domain operation produces a meaningful side effect, verify it.

Examples:

```text id="m2x8q4"
reservation created
state changed
event produced
usage incremented
```

Do not verify irrelevant implementation details.

---

## 33. Unit Tests and Transactions

Unit tests should generally not attempt to reproduce full database transaction semantics.

Use integration tests for:

- Rollbacks.
- Locks.
- Isolation levels.
- Constraints.
- Concurrent updates.

Unit tests should focus on the deterministic logic that surrounds these mechanisms.

---

## 34. Unit Tests and Idempotency

Pure idempotency policies can be unit tested.

Examples:

- Same operation produces the same result.
- Duplicate event is recognized.
- Same idempotency key with different input is rejected.

Actual database-backed idempotency guarantees should also be tested through integration tests.

---

## 35. Unit Tests and Security

Unit tests can verify isolated security policies, but they are not sufficient to prove real authorization or tenant isolation.

For example:

```text id="y7q3m1"
permission policy
→ unit test

actual API cross-store access
→ integration/API test
```

Use the appropriate test layer for the security property.

---

## 36. Performance of Unit Tests

Unit tests should remain fast enough for frequent local execution.

Avoid:

- Network calls.
- Real external services.
- Large database setup.
- Long sleeps.
- Browser startup.

Slow tests belong in higher-level test suites when possible.

---

## 37. Flaky Unit Tests

A flaky unit test should be treated as a defect.

Investigate:

- Time dependency.
- Randomness.
- Shared state.
- Ordering.
- Async race.
- Environment dependence.

Do not repeatedly rerun a flaky test until it happens to pass.

---

## 38. Regression Tests

When a unit-testable bug is discovered:

1. Reproduce the bug.
2. Add a failing test.
3. Fix the implementation.
4. Confirm the test passes.
5. Run related tests.

The regression test should represent the business behavior that must remain protected.

---

## 39. AI-Generated Unit Tests

AI-generated tests require the same review as AI-generated production code.

Verify that:

- The test reaches the intended code path.
- Assertions are meaningful.
- Failure would indicate a real defect.
- Mocks are not hiding the bug.
- Test data is valid.
- The test is deterministic.

Do not accept tests simply because coverage increased.

---

## 40. Unit Test Organization

Unit tests should remain close to the code they validate where that matches repository conventions.

Use clear naming such as:

```text id="q5m8x2"
*.test.ts
*.spec.ts
```

The repository's established test organization takes precedence.

---

## 41. Unit Test Verification

Before completing a unit-test-related change:

```powershell id="c7m3n8"
pnpm test
```

Run targeted tests first when supported.

Then run the broader suite when appropriate.

Never claim success without executing the test command.

---

## 42. Definition of Done

A unit-test implementation is complete when:

```text id="v8q2m5"
[ ] Test describes meaningful behavior
[ ] Test is isolated
[ ] Test is deterministic
[ ] Test uses appropriate test doubles
[ ] Assertions are meaningful
[ ] Error behavior is covered where relevant
[ ] Boundary cases are covered where relevant
[ ] Security-sensitive logic is tested where appropriate
[ ] No unnecessary implementation details are asserted
[ ] Regression cases are included where applicable
[ ] Relevant test commands were executed
```