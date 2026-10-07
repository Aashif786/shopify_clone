# Testing Architecture

## 1. Purpose

This document defines the testing architecture for the commerce platform.

It establishes:

- Testing layers.
- Test ownership.
- Unit testing.
- Integration testing.
- API testing.
- Database testing.
- End-to-end testing.
- Security testing.
- Background-job testing.
- Payment and webhook testing.
- Tenant-isolation testing.
- Test data management.
- CI expectations.
- Demo testing scope.
- V1 testing evolution.

The goal is to provide confidence in both business correctness and system behavior without creating an unnecessarily expensive testing system.

---

# 2. Testing Principles

The platform follows these principles:

1. Test business-critical behavior first.
2. Test domain rules close to the domain.
3. Test module interactions through public interfaces.
4. Test database behavior against a real PostgreSQL environment where required.
5. Test security boundaries explicitly.
6. Test tenant isolation explicitly.
7. Test critical retries and idempotency.
8. Use end-to-end tests for complete user journeys.
9. Avoid testing implementation details unnecessarily.
10. Keep tests deterministic.
11. Do not claim tests passed unless they actually ran.
12. Prefer meaningful coverage over arbitrary coverage percentages.

---

# 3. Testing Pyramid

The initial testing structure is:

```text
                 E2E
                /   \
          Integration
             /       \
          Module / API
             /       \
             Unit Tests
```

Most tests should exist at the unit and module levels.

Integration tests validate important boundaries.

End-to-end tests validate the most important complete workflows.

---

# 4. Test Categories

The platform uses:

```text id="r7x4n1"
Unit Tests
Integration Tests
API Tests
Database Tests
Security Tests
Worker Tests
Webhook Tests
End-to-End Tests
```

These categories overlap in some cases.

The important distinction is the behavior being validated.

---

# 5. Unit Tests

Unit tests validate isolated logic with minimal external dependencies.

Good candidates include:

- Pricing calculations.
- Discount calculations.
- Validation rules.
- State transition rules.
- Domain invariants.
- Utility functions.
- Permission evaluation.
- Business calculations.

Example:

```text id="p3d7c2"
Discount
   ↓
Calculate Discount
   ↓
Expected Result
```

Unit tests should be fast and deterministic.

---

# 6. What Unit Tests Should Not Replace

Unit tests should not be used as the only validation for:

- Database constraints.
- Transactions.
- Tenant isolation.
- API authentication.
- Webhook signature verification.
- External integration behavior.
- Full checkout flows.

These require higher-level tests.

---

# 7. Module Tests

Module tests validate business behavior within a domain module.

Examples:

### Products

- Create product.
- Update product.
- Publish product.
- Archive product.
- Validate pricing.

### Inventory

- Add inventory.
- Adjust inventory.
- Prevent invalid quantities.
- Handle concurrent changes.

### Discounts

- Validate discount.
- Calculate discount.
- Reject expired discount.
- Reject ineligible discount.

### Orders

- Create order.
- Preserve snapshots.
- Transition order state.
- Reject invalid transitions.

---

# 8. Application-Service Tests

Application services coordinate use cases.

Tests should verify:

- Correct module interaction.
- Transaction boundaries.
- Authorization assumptions where applicable.
- Domain invocation.
- Persistence behavior.
- Event generation.
- Error handling.

Example:

```text id="q5x8m3"
Create Order
    ↓
Order Application Service
    ↓
Order Domain
    ↓
Repository
```

The test should verify the use case rather than internal implementation details.

---

# 9. Integration Tests

Integration tests validate interactions between real components.

Examples include:

- Module + PostgreSQL.
- Application service + PostgreSQL.
- Checkout + Inventory.
- Checkout + Discounts.
- Checkout + Orders.
- Payments + database.
- Worker + database.
- Webhook processing + database.

Integration tests should be used where behavior depends on real persistence or multiple components.

---

# 10. PostgreSQL Integration Testing

Critical database behavior should be tested against PostgreSQL itself.

This is important for:

- Transactions.
- Constraints.
- Foreign keys.
- Unique constraints.
- Locking.
- Isolation.
- Concurrent updates.

Mocking PostgreSQL does not prove PostgreSQL behavior.

---

# 11. Database Test Isolation

Database tests should avoid leaking state between tests.

Possible approaches include:

- Transaction rollback.
- Isolated test schemas.
- Database reset.
- Test database recreation.

The chosen mechanism should prioritize:

- Determinism.
- Reasonable execution speed.
- Reliable cleanup.

---

# 12. Database Constraints

Tests should verify important constraints.

Examples:

```text id="f2n6v9"
Duplicate Store Identifier
        ↓
Rejected

Invalid Foreign Key
        ↓
Rejected

Invalid Inventory State
        ↓
Rejected
```

Constraints should not exist only because the schema says so. Critical constraints should have tests demonstrating their intended behavior.

---

# 13. Tenant Isolation Testing

Tenant isolation is a mandatory test category.

Example:

```text id="z5x7k2"
Store A User
     ↓
Request Store B Resource
     ↓
Expected: Reject
```

This should be tested across all important store-owned resources.

At minimum:

- Products.
- Inventory.
- Customers.
- Carts.
- Discounts.
- Orders.
- Store configuration.

---

# 14. Authorization Testing

Authorization tests should cover:

- Owner.
- Admin.
- Staff.
- Customer.
- Unauthenticated user.
- Platform administrator where applicable.

Tests should verify both:

```text id="7v2k9r"
Allowed Operations
```

and:

```text id="6j4m1p"
Forbidden Operations
```

Negative authorization tests are especially important.

---

# 15. Authentication Testing

Authentication tests should cover:

- Valid authentication.
- Invalid credentials.
- Expired sessions.
- Invalid sessions.
- Logout.
- Session invalidation.
- Protected endpoint access.

Authentication failures must not accidentally produce authenticated state.

---

# 16. API Testing

API tests should verify:

- Request validation.
- Authentication.
- Authorization.
- Tenant resolution.
- Response status.
- Response structure.
- Error handling.
- Idempotency.
- Pagination.
- Filtering.
- Security-sensitive behavior.

Example:

```text id="q8m4z1"
POST /api/products
    ↓
Authenticate
    ↓
Authorize
    ↓
Validate
    ↓
Create Product
    ↓
Response
```

---

# 17. API Negative Tests

Every critical API should include failure scenarios.

Examples:

- Missing authentication.
- Invalid authentication.
- Missing required fields.
- Invalid values.
- Unauthorized store.
- Cross-tenant resource.
- Invalid state.
- Duplicate request.
- Malformed request.
- Unexpected resource ID.

A successful request alone does not prove that the API is secure.

---

# 18. Checkout Testing

Checkout is a high-priority testing area.

Tests should cover:

```text id="u7p5r9"
Valid Cart
   ↓
Valid Inventory
   ↓
Valid Discount
   ↓
Payment
   ↓
Order
```

Failure cases should include:

- Empty cart.
- Product unavailable.
- Insufficient inventory.
- Invalid discount.
- Payment failure.
- Duplicate checkout request.
- Concurrent checkout.
- Database failure.
- External provider failure.

---

# 19. Inventory Testing

Inventory requires explicit concurrency testing.

Important scenarios include:

```text id="g3f8c1"
Stock = 1

Request A ──┐
            ├── Purchase
Request B ──┘
```

The system must not create two successful purchases from one available unit.

Tests should validate the actual database transaction and locking behavior rather than merely mocking inventory.

---

# 20. Payment Testing

Payment testing should distinguish:

### Internal State

The platform's payment lifecycle.

### External Provider

The provider's actual payment system.

Tests should cover:

- Payment creation.
- Success.
- Failure.
- Cancellation.
- Unknown outcome.
- Provider timeout.
- Duplicate callback.
- Invalid callback.
- Invalid state transition.
- Retry.

Real provider sandbox environments may be used for selected integration tests.

---

# 21. Webhook Testing

Webhook tests should cover:

```text id="b4j8m6"
Valid Signature
        ↓
Accepted

Invalid Signature
        ↓
Rejected

Duplicate Event
        ↓
No Duplicate Effect
```

Additional scenarios:

- Unknown event type.
- Malformed payload.
- Missing fields.
- Out-of-order events where relevant.
- Provider retry.
- Processing failure.

---

# 22. Idempotency Testing

Idempotency must be tested explicitly.

Example:

```text id="v2c6n8"
Request A
   ↓
Operation succeeds

Request A again
   ↓
No duplicate business effect
```

Important targets include:

- Checkout.
- Payment creation.
- Order creation.
- Webhook processing.
- Inventory operations where applicable.

---

# 23. Order Testing

Order tests should verify:

- Correct items.
- Correct quantities.
- Correct totals.
- Correct discount application.
- Correct payment relationship.
- Correct customer relationship.
- Correct store relationship.
- Historical snapshots.
- Valid state transitions.

Orders should remain historically correct after product data changes.

---

# 24. Discount Testing

Discount tests should cover:

- Valid code.
- Invalid code.
- Expired discount.
- Inactive discount.
- Minimum purchase conditions.
- Product eligibility.
- Store scope.
- Usage limits.
- Calculation correctness.
- Boundary values.

Discount calculations should be deterministic.

---

# 25. Cart Testing

Cart tests should cover:

- Create cart.
- Add item.
- Remove item.
- Change quantity.
- Clear cart.
- Invalid product.
- Invalid quantity.
- Cross-store cart access.
- Customer ownership.
- Guest cart behavior where supported.

Cart behavior must remain store-scoped.

---

# 26. Product Testing

Product tests should cover:

- Creation.
- Update.
- Publication.
- Archival.
- Variant management.
- Pricing.
- Store ownership.
- Validation.

Public storefront tests should verify that unpublished products are not exposed.

---

# 27. Storefront Testing

Storefront tests should verify:

- Correct store resolution.
- Published products only.
- Correct product information.
- Correct pricing.
- Cart behavior.
- Checkout behavior.
- Tenant isolation.

The storefront must not expose merchant-only information.

---

# 28. Worker Testing

Background jobs should be tested independently from HTTP handlers.

Tests should verify:

- Job creation.
- Job execution.
- Retry behavior.
- Failure handling.
- Idempotency.
- Tenant context.
- Duplicate delivery.
- Job state transitions.

Example:

```text id="u5n9q3"
Job
 ↓
Worker
 ↓
Application Service
 ↓
Domain
 ↓
Result
```

---

# 29. Job Retry Testing

Retryable failures should be tested.

Example:

```text id="p6r2w8"
Attempt 1
   ↓
Temporary Failure
   ↓
Retry

Attempt 2
   ↓
Success
```

Non-retryable failures should not produce infinite retries.

---

# 30. End-to-End Tests

End-to-end tests validate complete user journeys.

The Demo's highest-priority E2E flow is:

```text id="c3n8v1"
Merchant Creates Store
        ↓
Creates Product
        ↓
Adds Inventory
        ↓
Publishes Product
        ↓
Customer Visits Storefront
        ↓
Adds Product to Cart
        ↓
Checkout
        ↓
Payment
        ↓
Order Created
        ↓
Merchant Views Order
```

This is the core business path.

---

# 31. E2E Test Priorities

Priority should be:

### P0

- Merchant onboarding.
- Product publication.
- Inventory.
- Storefront.
- Cart.
- Checkout.
- Payment.
- Order creation.
- Merchant order management.
- Tenant isolation.

### P1

- Discounts.
- Customer management.
- Notifications.
- Media.

### P2

- Secondary UI behavior.
- Non-critical edge workflows.

---

# 32. Browser Testing

Playwright may be used for browser-based E2E testing.

Tests should focus on meaningful user journeys rather than every UI component.

Examples:

```text id="s6m4v2"
Merchant Login
Product Creation
Storefront Purchase
Order Management
```

Component-level visual details should generally be tested closer to the UI layer.

---

# 33. Test Data

Test data should be deterministic.

Test fixtures should make ownership explicit.

Example:

```text id="r2m7x4"
Organization A
 ├── Store A
 │    ├── Product A
 │    └── Customer A

Organization B
 ├── Store B
 │    ├── Product B
 │    └── Customer B
```

This makes tenant isolation tests straightforward.

---

# 34. Test Factories

Factories may be used to create test entities.

They should:

- Provide sensible defaults.
- Allow explicit overrides.
- Avoid hidden global state.
- Preserve valid relationships.
- Make tenant ownership obvious.

Factories should not hide important business assumptions.

---

# 35. Test Database

Tests requiring persistence should use an isolated database environment.

The test database must never be production.

Test credentials must be separate from production credentials.

---

# 36. External Integration Testing

External providers should be tested at multiple levels.

### Unit

Mock the provider adapter.

### Integration

Test the adapter against a sandbox where practical.

### Application

Test business behavior using a controlled provider interface.

This avoids making the entire test suite dependent on external network availability.

---

# 37. Mocking Rules

Mocks should be used selectively.

Good uses:

- External payment providers.
- Email services.
- Object storage.
- Unreliable external APIs.

Poor uses:

- PostgreSQL behavior when testing transactions.
- Core domain logic.
- Authorization rules.
- Critical business calculations.

The goal is to test real behavior where correctness depends on real infrastructure.

---

# 38. Determinism

Tests should not depend unnecessarily on:

- Real-world time.
- Random values.
- External network availability.
- Test execution order.
- Shared mutable state.

Where time matters, tests should use controllable clocks or explicit timestamps.

---

# 39. Test Naming

Tests should describe behavior.

Preferred:

```text id="j7q2m4"
rejects_order_access_from_another_store
```

rather than:

```text id="y3v8n1"
test_order_2
```

Good names make failures understandable without opening the implementation.

---

# 40. Test Coverage

Coverage metrics may be useful, but coverage percentage is not the primary quality measure.

A module with high line coverage can still have poor business coverage.

Priority should be given to:

- Critical business paths.
- Security boundaries.
- State transitions.
- Concurrency.
- Failure handling.
- Idempotency.
- Tenant isolation.

---

# 41. CI Testing

CI should execute appropriate automated checks.

The expected project verification set includes:

```text id="4v6j8p"
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Database-dependent tests may additionally require:

```text id="7m3n2q"
pnpm db:migrate
```

The exact availability of these scripts depends on the current root `package.json`.

No check should be claimed as passed unless it actually ran.

---

# 42. Pull Request Testing

Changes should include tests appropriate to their risk.

For example:

### Product Change

- Product unit/module tests.
- API tests where applicable.
- E2E if a critical user flow changes.

### Inventory Change

- Domain tests.
- PostgreSQL integration tests.
- Concurrency tests.

### Payment Change

- Payment tests.
- Webhook tests.
- Idempotency tests.
- Relevant E2E tests.

### Authorization Change

- Positive authorization tests.
- Negative authorization tests.
- Cross-tenant tests.

---

# 43. Regression Testing

Bug fixes should generally include a regression test.

The preferred pattern is:

```text id="q4c9x2"
Bug
 ↓
Reproduce
 ↓
Regression Test
 ↓
Fix
 ↓
Verify
```

This prevents the same failure from silently returning later.

---

# 44. Security Regression Tests

Security bugs require explicit regression coverage where practical.

Examples:

- Cross-tenant access.
- Missing authorization.
- Unverified webhook.
- Secret leakage.
- Invalid session behavior.
- Insecure resource access.

A security fix without a regression test should be treated cautiously.

---

# 45. Performance Testing

The Demo does not require a large performance-testing system.

Basic performance validation may be used for:

- Checkout.
- Product listing.
- Storefront pages.
- Database-heavy operations.

V1 may introduce:

- Load testing.
- Stress testing.
- Capacity testing.
- Database performance testing.
- Distributed workload testing.

These should be driven by actual requirements.

---

# 46. Failure Testing

Important failure scenarios should be tested deliberately.

Examples:

```text id="d7q3v9"
Database Unavailable
External Provider Timeout
Payment Failure
Worker Failure
Duplicate Request
Duplicate Webhook
Invalid Authorization
Insufficient Inventory
```

The system should fail safely rather than merely fail loudly.

---

# 47. Testing Background Effects

Secondary effects should be tested independently.

For example:

```text id="p3v8m5"
Order Created
    ↓
Event
    ↓
Notification Job
    ↓
Email
```

The core order transaction should not become dependent on successful email delivery unless explicitly required.

Tests should verify this separation.

---

# 48. Testing Event Behavior

Events should be tested for:

- Correct event type.
- Correct payload.
- Correct tenant context.
- Correct publication timing.
- Duplicate handling where applicable.

Event consumers should be tested independently.

---

# 49. Contract Testing

Where external interfaces become important, contract tests may be introduced.

Potential targets include:

- Public APIs.
- Payment adapters.
- Webhooks.
- External service integrations.

The Demo does not require a complex contract-testing platform unless needed.

---

# 50. Testing Architecture Boundaries

The project should eventually automate important architectural rules.

Potential checks include:

- Module import restrictions.
- Forbidden dependencies.
- Shared package restrictions.
- Application/domain dependency direction.

For example:

```text id="t9v2k6"
Products
    X
Products → Orders Internal Implementation
```

Architecture tests should prevent accidental coupling where practical.

---

# 51. Test Environment Separation

Tests must never use production credentials or production data.

Environments should be explicitly identified.

```text id="x8n5w2"
Development
   ≠
Test
   ≠
Production
```

---

# 52. Flaky Tests

Flaky tests must not be ignored.

When a test becomes flaky:

1. Identify the cause.
2. Determine whether the test or implementation is incorrect.
3. Fix the root cause.
4. Avoid simply adding arbitrary delays or retries.
5. Track recurring instability.

Retries may hide real failures and should not become the default solution.

---

# 53. Test Execution Speed

Tests should remain fast enough for normal development.

Priorities:

```text id="z5m7x3"
Fast Unit Tests
      ↓
Focused Integration Tests
      ↓
Critical E2E Tests
```

Full E2E suites may run at appropriate CI stages rather than on every local change.

---

# 54. Testing AI-Generated Changes

AI-assisted changes require the same testing standards as human-written code.

Agents must:

- Inspect existing tests.
- Add tests for new behavior.
- Update affected tests.
- Run relevant verification.
- Report actual results.
- Avoid claiming success without execution.

Generated code is not exempt from testing because a machine typed it.

---

# 55. Definition of Done

A feature is not considered complete merely because implementation exists.

For a meaningful feature, completion should generally include:

```text id="f4n8q2"
Implementation
    +
Validation
    +
Authorization
    +
Tests
    +
Documentation where required
    +
Verification
```

For critical commerce features, additional requirements may include:

- Concurrency testing.
- Idempotency testing.
- Failure testing.
- Tenant-isolation testing.

---

# 56. Demo Testing Scope

The Demo must provide strong confidence in:

- Authentication.
- Authorization.
- Tenant isolation.
- Store creation.
- Product management.
- Inventory.
- Storefront.
- Cart.
- Checkout.
- Discounts.
- Payments.
- Orders.
- Background processing.

The Demo does not require enterprise-scale testing infrastructure.

It does require meaningful correctness testing.

---

# 57. V1 Testing Evolution

V1 may add:

- Large-scale load testing.
- Stress testing.
- Chaos testing.
- Advanced security testing.
- Distributed system testing.
- Contract testing.
- Performance regression monitoring.
- Database capacity testing.
- Multi-region failure testing.

These additions should be driven by system complexity and operational requirements.

---

# 58. Final Testing Model

The platform's testing strategy is:

```text id="u2w6p9"
Business Rules
      ↓
Unit / Module Tests

Persistence / Boundaries
      ↓
Integration Tests

Security / APIs
      ↓
API + Security Tests

Complete User Journeys
      ↓
E2E Tests

Production Confidence
      ↓
CI + Monitoring + Operational Verification
```

The governing principle is:

> **Test the business risks, not merely the lines of code.**