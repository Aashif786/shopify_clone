# Test Strategy

## 1. Purpose

This document defines the overall testing strategy for the Shopify-like commerce platform.

The testing strategy is designed to protect:

- Business correctness.
- Tenant isolation.
- Authorization.
- Database integrity.
- Commerce workflows.
- Payment correctness.
- Inventory correctness.
- API contracts.
- Background processing.
- User-facing flows.

The Demo should maintain strong correctness without introducing unnecessary testing infrastructure.

---

## 2. Testing Principles

Testing should:

- Verify behavior rather than implementation details.
- Prioritize business-critical paths.
- Detect security regressions.
- Detect tenant-isolation failures.
- Verify concurrency-sensitive operations.
- Keep tests deterministic.
- Prefer realistic integration tests where boundaries matter.
- Avoid excessive mocking.
- Provide fast feedback during development.

---

## 3. Test Pyramid

The platform uses a layered testing strategy:

```text id="c8m4x7"
                 E2E
                /   \
             API / Workflow
              /       \
        Integration / Database
             /         \
              Unit Tests
```

Lower-level tests should be fast and numerous.

Higher-level tests should focus on important system behavior rather than attempting to cover every internal implementation detail.

---

## 4. Testing Layers

The platform should use:

### Unit tests

Test isolated domain and application logic.

### Integration tests

Test interactions with PostgreSQL, repositories, modules, and infrastructure boundaries.

### API tests

Test HTTP contracts, authorization, validation, tenant isolation, and business behavior.

### E2E tests

Test critical user workflows through the real application.

### Security tests

Test authentication, authorization, tenant isolation, input handling, and security-sensitive behavior.

### Worker tests

Test background job execution, retries, idempotency, and failure handling.

---

## 5. Risk-Based Testing

Testing effort should reflect business risk.

### Highest priority

```text id="n7q3m5"
Payments
Inventory
Checkout
Orders
Tenant isolation
Authorization
Authentication
Webhooks
Idempotency
```

### Medium priority

```text id="x4m8k2"
Products
Customers
Discounts
Carts
Store configuration
Background jobs
```

### Lower priority

```text id="p6r2v9"
Non-critical UI presentation
Pure formatting
Simple static content
```

Lower-risk functionality still requires appropriate testing, but should not receive the same complexity as payment processing.

---

## 6. Functional Correctness

Tests must verify that features satisfy their documented specifications.

Examples:

```text id="q3v8m1"
Product creation
→ creates valid product

Inventory reservation
→ prevents overselling

Checkout
→ calculates authoritative totals

Payment
→ verifies expected amount

Order creation
→ preserves historical information
```

---

## 7. Security as a Test Requirement

Security behavior must be tested rather than assumed.

Important negative cases include:

- Unauthenticated access.
- Unauthorized role.
- Wrong store.
- Wrong customer.
- Modified resource identifier.
- Invalid webhook signature.
- Replay attempt.
- Invalid input.
- Sensitive information leakage.

---

## 8. Tenant Isolation Testing

Every store-scoped domain should include cross-tenant tests.

Example:

```text id="m8q4x7"
Store A
  ├── Product A
  └── Order A

Store B
  ├── Product B
  └── Order B
```

A Store A user attempting to access Product B must fail.

This applies to both reads and writes.

---

## 9. Authorization Testing

Authorization tests should verify:

```text id="v5n2x8"
Owner
Admin
Staff
Customer
Unauthenticated
```

against relevant operations.

The goal is to prove that permission boundaries are enforced server-side.

---

## 10. Authentication Testing

Authentication tests should cover:

- Valid credentials.
- Invalid credentials.
- Expired session.
- Invalid session.
- Disabled account.
- Logged-out access.
- Protected endpoint access without authentication.

The exact cases depend on the authentication implementation.

---

## 11. Domain Testing

Domain logic should be tested independently where practical.

Examples:

- State transitions.
- Business invariants.
- Money calculations.
- Discount calculations.
- Quantity validation.
- Reservation rules.
- Order transition rules.

Domain tests should not require the full HTTP stack.

---

## 12. Application Service Testing

Application service tests should verify:

- Use-case behavior.
- Transaction coordination.
- Authorization assumptions.
- Cross-module orchestration.
- Error handling.
- Event/job triggering.

Mock only boundaries that are genuinely external or expensive.

---

## 13. Database Integration Testing

Database tests should use a real PostgreSQL-compatible environment where practical.

They should verify:

- Constraints.
- Foreign keys.
- Unique indexes.
- Transactions.
- Query behavior.
- Tenant filtering.
- Migrations.
- Concurrency-sensitive behavior.

Mocking PostgreSQL does not prove PostgreSQL behavior.

---

## 14. Migration Testing

Every schema migration should be tested.

At minimum:

```text id="r2m8q5"
migration applies successfully
migration is compatible with expected application state
constraints behave correctly
existing data remains valid
```

For significant migrations, test upgrade behavior from a representative previous schema.

---

## 15. API Testing

API tests should verify:

- HTTP method.
- Path.
- Authentication.
- Authorization.
- Tenant scope.
- Request validation.
- Response status.
- Response shape.
- Error contract.
- Idempotency where required.
- Pagination where applicable.

API tests should not rely solely on frontend tests.

---

## 16. API Contract Testing

Public API responses should remain consistent with their documented contract.

Test:

```text id="h7q3n2"
required response fields
field types
error shape
status codes
pagination structure
idempotency behavior
```

OpenAPI documentation should remain synchronized with actual behavior.

---

## 17. Product Testing

Product tests should cover:

- Creation.
- Validation.
- Update.
- Publication.
- Unpublication.
- Archival.
- Variant management.
- SKU uniqueness.
- Store isolation.
- Pricing.
- Media metadata where applicable.

---

## 18. Inventory Testing

Inventory requires stronger testing because incorrect behavior can cause overselling.

Test:

- Stock creation.
- Adjustment.
- Reservation.
- Release.
- Commit.
- Insufficient stock.
- Duplicate operations.
- Concurrent reservations.
- Multi-item reservations.
- Reservation expiration where implemented.

Concurrency tests are mandatory for critical reservation behavior.

---

## 19. Cart Testing

Cart tests should cover:

- Creation.
- Adding items.
- Updating quantities.
- Removing items.
- Duplicate variant addition.
- Empty cart.
- Invalid quantity.
- Store isolation.
- Guest cart.
- Registered customer cart.
- Cart expiration.
- Conversion into checkout.

Cart tests must verify that client-provided prices are not trusted.

---

## 20. Discount Testing

Discount tests should cover:

- Valid code.
- Invalid code.
- Expired code.
- Not-yet-active code.
- Usage limits.
- Per-customer limits.
- Minimum order requirements.
- Maximum discount.
- Eligibility.
- Duplicate usage.
- Concurrent usage.

Usage accounting must be tested transactionally.

---

## 21. Checkout Testing

Checkout is a high-risk workflow.

Test:

```text id="q5m8x3"
cart validation
price recalculation
discount validation
inventory reservation
payment creation
payment success
payment failure
order creation
checkout completion
checkout expiration
retry
duplicate completion
```

Also test recovery when an external payment succeeds but the original request fails.

---

## 22. Payment Testing

Payment tests should cover:

- Payment creation.
- Amount validation.
- Currency validation.
- Successful payment.
- Failed payment.
- Duplicate request.
- Capture.
- Refund.
- Partial refund.
- Duplicate webhook.
- Invalid webhook.
- Provider timeout.
- Provider failure.

Sandbox/test providers should be used for integration tests.

Real payment credentials must never be used in automated tests.

---

## 23. Order Testing

Order tests should cover:

- Creation.
- Historical snapshots.
- Status transitions.
- Cancellation.
- Payment relationship.
- Inventory relationship.
- Customer access.
- Merchant access.
- Tenant isolation.
- Duplicate creation attempts.

Historical order data must remain stable after catalog changes.

---

## 24. Customer Testing

Customer tests should cover:

- Creation.
- Profile update.
- Address management.
- Default address behavior.
- Guest customer behavior.
- Registered customer association.
- Self-access.
- Merchant access.
- Cross-customer access.
- Cross-store access.

---

## 25. Store Testing

Store tests should cover:

- Store creation.
- Settings.
- Lifecycle transitions.
- Memberships.
- Roles.
- Invitations where implemented.
- Suspension.
- Owner protection.
- Store isolation.

---

## 26. Webhook Testing

Webhook tests should cover:

- Signature verification.
- Invalid signatures.
- Replay attempts.
- Duplicate events.
- Out-of-order events.
- Malformed payloads.
- Unsupported events.
- Retryable failures.
- Non-retryable failures.
- Correct tenant resolution.
- Idempotent side effects.

---

## 27. Background Job Testing

Worker tests should cover:

- Successful execution.
- Invalid payload.
- Retryable failure.
- Non-retryable failure.
- Maximum attempts.
- Duplicate execution.
- Idempotency.
- Tenant context.
- Observability.

Jobs must not produce duplicate side effects when safely retried.

---

## 28. E2E Testing

E2E tests should focus on complete critical user journeys.

Recommended Demo workflows:

```text id="k4m8x7"
Merchant signup/login
        ↓
Create store
        ↓
Create product
        ↓
Add inventory
        ↓
Publish product
        ↓
Customer storefront
        ↓
Add to cart
        ↓
Checkout
        ↓
Sandbox payment
        ↓
Order created
        ↓
Merchant views order
```

This should form one of the primary regression workflows.

---

## 29. E2E Test Scope

Do not attempt to cover every internal branch with E2E tests.

E2E tests should prove that critical components work together.

Detailed business-rule coverage should remain in unit and integration tests.

---

## 30. Test Data Isolation

Each test should use isolated data.

Avoid shared mutable global test state.

A test should not depend on another test running first.

Use factories or fixtures appropriate to the repository's test infrastructure.

---

## 31. Deterministic Tests

Tests should avoid:

- Random external dependencies.
- Real third-party services.
- Uncontrolled network requests.
- Current-time assumptions without control.
- Shared mutable state.
- Arbitrary sleep delays.

When time matters, use controlled clocks or deterministic time helpers.

---

## 32. External Services

External providers should generally be replaced with:

- Test implementations.
- Mocks at appropriate boundaries.
- Local test servers.
- Sandbox environments.

Do not make normal CI depend on external provider availability.

---

## 33. Mocking Strategy

Mocks should be used selectively.

Good candidates:

- Payment provider.
- Email provider.
- Object storage.
- External API.
- Time when deterministic control is required.

Avoid mocking:

- Core domain logic.
- Simple internal functions.
- PostgreSQL behavior when integration testing is required.

Over-mocking can create tests that pass while the real system fails.

---

## 34. Regression Testing

Every significant bug should result in a regression test when practical.

Workflow:

```text id="w7q2m4"
Bug discovered
    ↓
Reproduce
    ↓
Write failing test
    ↓
Fix
    ↓
Verify test passes
```

This prevents the same defect from silently returning.

---

## 35. Concurrency Testing

Concurrency tests are required for critical shared-state operations.

Examples:

```text id="n8m3q6"
two inventory reservations
two checkout completions
duplicate payment capture
duplicate refund
concurrent discount usage
duplicate webhook processing
```

The tests should verify the resulting database state, not only returned responses.

---

## 36. Idempotency Testing

For every idempotent operation, test:

### First request

Operation succeeds.

### Same request again

No duplicate side effect occurs.

### Same key, different request

Conflict occurs.

### Failure followed by retry

Retry produces the correct final state.

---

## 37. Error Testing

Failure behavior must be tested.

Important categories:

```text id="q6v9k3"
validation
authentication
authorization
not found
conflict
business rule
dependency failure
database failure
timeout
retry exhaustion
```

The API must return the documented error contract.

---

## 38. Performance Testing

The Demo does not require a full load-testing platform initially.

However, performance-sensitive areas should still be checked for:

- Slow database queries.
- N+1 queries.
- Unbounded queries.
- Excessive API payloads.
- Slow checkout.
- Slow product listing.
- Worker backlog.

V1 can introduce dedicated load-testing infrastructure when justified.

---

## 39. Security Testing

Security testing should include:

- Authentication bypass attempts.
- Authorization bypass attempts.
- Tenant isolation.
- Input validation.
- Injection protection.
- XSS protection where relevant.
- File upload validation.
- Secret exposure.
- Webhook signature verification.
- Session security.
- Sensitive error leakage.

Security testing is not optional for critical commerce workflows.

---

## 40. CI Testing

CI should run appropriate automated checks before merging.

Baseline checks should include:

```powershell id="p3k7m9"
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Additional integration or E2E tests should run according to the project's CI strategy.

---

## 41. Local Testing

Developers should be able to run relevant tests locally without requiring production infrastructure.

The Demo should provide a practical local environment using the documented development stack.

---

## 42. Test Failure Handling

A failing test must be investigated.

Do not:

- Delete the test.
- Weaken the assertion without understanding the requirement.
- Skip the test permanently.
- Hide the failure.

If a test is obsolete because requirements changed, update it deliberately and document the behavior change where necessary.

---

## 43. Coverage

Code coverage is a supporting metric, not the definition of quality.

High coverage does not guarantee:

- Correct tenant isolation.
- Correct payment behavior.
- Correct concurrency.
- Correct state transitions.

The quality of assertions and business scenarios matters more than a single percentage.

---

## 44. Test Naming

Test names should describe behavior.

Prefer:

```text id="s4n8m2"
reserves inventory atomically when sufficient stock exists
```

over:

```text id="r9x3q7"
testInventoryFunction
```

A good test name should explain the expected behavior when it fails.

---

## 45. Test Review

AI-generated tests require review just like production code.

Reviewers should verify:

- The test actually exercises the intended behavior.
- Assertions are meaningful.
- The test can fail for the right reason.
- The test does not merely mirror the implementation.
- Security and tenant cases are included where relevant.
- Test data is isolated.

---

## 46. Demo-to-V1 Evolution

The Demo should establish reliable testing foundations without prematurely creating a massive test infrastructure.

V1 may later add:

- Dedicated performance testing.
- Distributed load testing.
- Advanced contract testing.
- Chaos testing.
- Production-like staging environments.
- Expanded security scanning.
- More sophisticated test data management.

These should be introduced according to actual system needs.

---

## 47. Definition of Done

A feature is considered adequately tested when:

```text id="x7m4q2"
[ ] Functional behavior is covered
[ ] Relevant failure paths are covered
[ ] Authorization is tested
[ ] Tenant isolation is tested
[ ] Critical concurrency is tested
[ ] Idempotency is tested where required
[ ] Database behavior is tested where relevant
[ ] API contract is tested where relevant
[ ] Critical E2E flow is covered where relevant
[ ] Security-sensitive behavior is tested
[ ] Tests are deterministic
[ ] Tests do not rely on production services
[ ] Relevant CI checks pass
```