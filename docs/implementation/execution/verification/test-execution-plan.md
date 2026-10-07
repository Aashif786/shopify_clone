# Test Execution Plan

## 1. Purpose

This document defines how the Demo implementation will be verified throughout development.

Testing must provide confidence that the platform is:

- Functionally correct.
- Tenant-safe.
- Authorization-safe.
- Transactionally correct.
- Concurrency-safe.
- Idempotent.
- Recoverable from expected failures.
- Ready for the complete Demo purchase journey.

Testing is risk-based. The highest effort must be concentrated on business-critical workflows rather than distributed equally across every line of code.

---

# 2. Testing Philosophy

The Demo is a real functional commerce system.

Therefore testing must validate actual behavior rather than merely verifying that functions execute.

Primary priorities:

```text id="r5c8m2"
1. Tenant isolation
2. Authorization
3. Inventory correctness
4. Checkout correctness
5. Payment correctness
6. Order correctness
7. Idempotency
8. Webhook handling
9. Background jobs
10. Core customer and merchant flows
```

---

# 3. Testing Pyramid

Use multiple test levels:

```text id="n8x4v7"
             E2E
           /     \
        API / Integration
       /             \
    Domain / Application
   /                   \
Unit Tests  →  DB Tests
```

Unit tests should be numerous and fast.

Integration tests should validate real module and database behavior.

E2E tests should validate critical user journeys.

---

# 4. Test Technology

The Demo should use:

```text id="c7m4x8"
Vitest
Playwright
PostgreSQL test database
```

Additional tools should only be introduced when required.

---

# 5. Test Environments

Testing should be separated from production.

Use:

```text id="q8v5m3"
Local Development
CI Test Environment
Demo/Staging Environment
Production
```

Tests must never run against production data.

---

# 6. Test Database

Integration tests should use a dedicated PostgreSQL database.

Requirements:

- Isolated from development data.
- Isolated from production.
- Resettable.
- Deterministic.
- Migrated automatically.
- Seeded only with controlled test data.

---

# 7. Database Test Lifecycle

A typical integration-test lifecycle is:

```text id="m4x8c7"
Create Test Database
      ↓
Run Migrations
      ↓
Create Test Fixtures
      ↓
Run Tests
      ↓
Clean/Reset
```

The exact reset strategy may use transactions, truncation, or isolated schemas according to test requirements.

---

# 8. Unit Tests

Unit tests validate isolated business behavior.

Examples:

```text id="v7n4m8"
Price calculation
Discount calculation
State transitions
Validation
Idempotency decisions
Retry classification
DTO mapping
```

Unit tests should not require a real external provider.

---

# 9. Domain Unit Tests

Each domain must test its business rules independently.

Priority domains:

```text id="x5c8m4"
Inventory
Checkout
Payments
Orders
Discounts
Carts
Products
Stores
```

---

# 10. Application-Service Tests

Application services should be tested for orchestration behavior.

Verify:

```text id="m8c4v7"
Input validation
Authorization context
Transaction boundaries
Repository interaction
Domain rule invocation
Event/job creation
Error mapping
Idempotency
```

Avoid testing private implementation details.

---

# 11. Repository Tests

Repositories should be tested against real PostgreSQL where behavior depends on database semantics.

Important areas:

```text id="q4x8m7"
Unique constraints
Foreign keys
Transactions
Row locking
Pagination
Tenant filtering
Indexes where behavior matters
```

Mocking PostgreSQL for these behaviors provides little confidence.

---

# 12. Database Constraint Tests

Critical constraints should have explicit tests.

Examples:

```text id="v8n5c4"
Cross-store foreign-key violations
Duplicate Store identifiers
Duplicate Product slugs within Store
Duplicate SKUs where required
Invalid quantities
Duplicate idempotency keys
Duplicate webhook event IDs
Duplicate order creation anchors
```

---

# 13. API Tests

API tests validate the HTTP contract.

Verify:

```text id="x7m4c8"
HTTP status
Response schema
Request validation
Authentication
Authorization
Tenant context
Error format
Pagination
Idempotency behavior
```

API tests should not depend on UI rendering.

---

# 14. API Contract Tests

Verify that API responses remain consistent with the documented contract.

Important areas:

```text id="m5c8x7"
DTO structure
Required fields
Optional fields
Error codes
Pagination format
Idempotency responses
Webhook endpoints
```

OpenAPI should remain aligned with implemented endpoints.

---

# 15. Authentication Tests

Test:

```text id="q8m4v5"
[ ] Login success
[ ] Invalid credentials
[ ] Session creation
[ ] Session expiration
[ ] Logout
[ ] Password reset
[ ] Email verification
[ ] Unauthenticated access
[ ] Session invalidation
```

Security-sensitive authentication tests should run in CI.

---

# 16. Authorization Tests

Verify every protected capability.

Examples:

```text id="v4x8m7"
Owner → allowed
Admin → allowed where defined
Staff → allowed where defined
Customer → denied merchant operations
Unauthenticated user → denied protected operations
```

Do not rely solely on UI hiding buttons.

---

# 17. Tenant Isolation Tests

These are mandatory.

Create:

```text id="x5m8c4"
Store A
Store B
```

Then verify that Store A users cannot access Store B resources.

Test:

```text id="q7c4m8"
Products
Inventory
Customers
Carts
Checkouts
Payments
Orders
Media
Notifications
```

---

# 18. Object-Level Isolation

Attempt attacks such as:

```text id="m8x4c7"
GET /orders/{store-B-order-id}
GET /products/{store-B-product-id}
POST /cart/{store-B-cart-id}/items
```

Every operation must reject unauthorized cross-store access.

---

# 19. Product Tests

Verify:

```text id="v5n8m4"
Product creation
Product update
Product publication
Product unpublication
Variant creation
Price changes
SKU handling
Slug handling
Media association
Store isolation
```

---

# 20. Inventory Tests

Inventory receives elevated testing priority.

Verify:

```text id="x8c4m7"
Stock adjustment
Reservation
Reservation release
Reservation finalization
Available quantity
Reserved quantity
Insufficient stock
Concurrent reservations
Duplicate operations
```

---

# 21. Inventory Concurrency Tests

Example:

```text id="m7c5x8"
Available stock = 1

Request A → reserve 1
Request B → reserve 1
```

Exactly one reservation should succeed.

No negative stock or duplicate reservation should occur.

---

# 22. Cart Tests

Verify:

```text id="q4n8m5"
Create Cart
Add item
Update quantity
Remove item
Guest ownership
Customer ownership
Cart expiration
Cart conversion
Concurrent updates
```

---

# 23. Discount Tests

Verify:

```text id="v8m4c7"
Percentage discount
Fixed discount
Validity dates
Minimum purchase
Product eligibility
Usage limits
Invalid code
Expired code
Concurrent usage
```

---

# 24. Checkout Tests

Checkout requires high-priority testing.

Verify:

```text id="x5c8m4"
Cart validation
Price recalculation
Discount application
Inventory reservation
Payment initiation
Checkout state transitions
Expiration
Cancellation
Completion
Idempotency
```

---

# 25. Checkout Concurrency

Test:

```text id="m8x4n7"
Two completion requests
Completion + cancellation
Completion + expiration
Duplicate idempotency key
Different requests against same Checkout
```

The system must produce one valid final purchase outcome.

---

# 26. Payment Tests

Verify:

```text id="q7m5c8"
Payment creation
Payment confirmation
Payment success
Payment failure
Provider timeout
Unknown outcome
Provider idempotency
Application idempotency
Refund
Partial refund
Refund limit
```

---

# 27. Payment Webhook Tests

Verify:

```text id="v4c8m7"
Valid signature
Invalid signature
Duplicate event
Replay attempt
Out-of-order event
Delayed event
Unknown payment
Successful payment webhook
Refund webhook
```

---

# 28. Order Tests

Verify:

```text id="x8m4c5"
Order creation
Order numbering
Historical snapshots
Order status
Payment status
Fulfillment status
Cancellation
Status history
Customer access
Merchant access
```

---

# 29. Historical Immutability Tests

Create an Order.

Then modify:

```text id="m5n8c4"
Product title
Product price
SKU
Customer name
Customer address
```

Verify that historical Order information remains unchanged.

---

# 30. Media Tests

Verify:

```text id="q8x4m7"
Upload
Validation
Size limits
MIME validation
Object key generation
Store ownership
Public access
Private access
Deletion
Cleanup
```

---

# 31. Notification Tests

Verify:

```text id="v7m4c8"
Notification creation
Template rendering
Recipient resolution
Delivery job
Provider success
Provider failure
Retry
Idempotency
Preference handling
```

---

# 32. Webhook Tests

Verify:

```text id="x4n8m7"
Raw payload handling
Signature verification
Event persistence
Deduplication
Normalization
Worker processing
Retry
Out-of-order processing
```

---

# 33. Job Tests

Verify:

```text id="m8c5x4"
Job creation
Job claiming
Concurrent workers
Retry
Backoff
Maximum attempts
Stale recovery
Graceful shutdown
Unknown job types
Handler idempotency
```

---

# 34. Integration Test Priority

The following cross-domain workflows are mandatory:

```text id="q5x8m4"
Store → Product
Product → Inventory
Customer → Cart
Cart → Checkout
Checkout → Inventory
Checkout → Payment
Payment → Checkout
Payment → Order
Order → Notification
Payment Webhook → Payment
Webhook → Checkout/Order
Media → Product
```

---

# 35. End-to-End Customer Journey

At least one complete E2E journey must work:

```text id="v8m4c7"
Open Storefront
      ↓
Browse Product
      ↓
Open Product
      ↓
Select Variant
      ↓
Add to Cart
      ↓
View Cart
      ↓
Start Checkout
      ↓
Complete Test Payment
      ↓
Order Created
      ↓
Order Visible to Customer
```

This is the primary Demo acceptance journey.

---

# 36. Merchant E2E Journey

A merchant workflow should verify:

```text id="x7c4m8"
Login
 ↓
Create Store
 ↓
Configure Store
 ↓
Create Product
 ↓
Create Variant
 ↓
Set Inventory
 ↓
Publish Product
 ↓
View Storefront
 ↓
Receive Order
 ↓
Manage Order
```

---

# 37. Negative E2E Scenarios

Test important failures:

```text id="m4n8x7"
Invalid login
Unauthorized merchant action
Unpublished Product
Out-of-stock Product
Invalid discount
Payment failure
Expired Checkout
Unauthorized Order access
Cross-store resource access
```

---

# 38. Idempotency Test Matrix

Critical operations should be tested for repeated requests.

| Operation | Duplicate Request | Expected Result |
|---|---|---|
| Checkout creation | Same key | Same logical result |
| Checkout completion | Same key | One purchase |
| Payment creation | Same key | One payment operation |
| Refund | Same key | One refund |
| Inventory adjustment | Same key where applicable | One adjustment |
| Webhook | Same provider event | One business effect |
| Job | Duplicate execution | Safe repeated execution |

---

# 39. Concurrency Test Matrix

Test:

| Operation | Concurrent Scenario |
|---|---|
| Inventory | Two buyers reserve final stock |
| Checkout | Two completion requests |
| Payment | Two confirmations |
| Refund | Two refunds exceeding remaining amount |
| Discount | Concurrent usage against limit |
| Webhook | Two workers process same event |
| Jobs | Multiple workers claim jobs |
| Orders | Duplicate creation attempts |

---

# 40. Transaction Rollback Tests

For every critical transaction, force a failure after an intermediate database operation.

Verify:

```text id="q8m4c5"
No partial state remains.
```

Examples:

```text id="v5m8x4"
Order creation failure
Inventory reservation failure
Checkout creation failure
Discount usage failure
Payment record failure
Webhook processing failure
```

---

# 41. External Failure Tests

Simulate:

```text id="x4c8m7"
Provider timeout
Provider 5xx
Network interruption
Database connection failure
Object storage failure
Email provider failure
```

The application should distinguish retryable from permanent failures.

---

# 42. Security Testing

Minimum security verification:

```text id="m7n4c8"
Authentication bypass
Authorization bypass
Cross-tenant access
IDOR/object access
Input validation
SQL injection protection
XSS handling
CSRF protection where applicable
Webhook forgery
Replay attacks
Secret leakage
Sensitive logging
```

Do not treat frontend restrictions as security controls.

---

# 43. Input Validation Testing

Every external boundary should test:

```text id="q5x8m4"
Missing fields
Wrong types
Empty values
Oversized values
Invalid identifiers
Invalid enum values
Negative quantities
Invalid monetary values
Unexpected fields where rejected
```

---

# 44. API Abuse Tests

Test basic abuse scenarios:

```text id="v8c4m7"
Repeated login failures
Repeated checkout completion
Repeated payment requests
Large pagination values
Oversized request payloads
Repeated webhook delivery
```

Rate limiting may remain simple for Demo, but critical endpoints must not be left completely uncontrolled.

---

# 45. Performance Testing

The Demo does not require a full load-testing framework.

However, identify basic performance risks:

```text id="x7m5c8"
Slow catalog queries
N+1 queries
Unbounded Order queries
Slow checkout transactions
Long inventory locks
Worker queue buildup
Large media requests
```

Measure before optimizing.

---

# 46. Migration Testing

Every database migration should be tested for:

```text id="m4c8x7"
Fresh database
Existing database
Forward migration
Rollback strategy where supported
Constraint compatibility
Seed compatibility
Application compatibility
```

Production rollback should follow the migration strategy rather than assuming every migration can simply be reversed.

---

# 47. Seed Verification

Seed data should allow the Demo to be exercised quickly.

Verify:

```text id="q8n4m5"
Store exists
Merchant user exists
Products exist
Variants exist
Inventory exists
Customer exists where required
Demo payment configuration exists
```

Seeds must never contain real credentials or production secrets.

---

# 48. CI Test Pipeline

CI should run progressively:

```text id="v5x8c4"
Install
  ↓
Lint
  ↓
Typecheck
  ↓
Unit Tests
  ↓
Integration Tests
  ↓
API Tests
  ↓
Build
```

E2E tests may run in the same pipeline or a dedicated CI job depending on runtime.

---

# 49. Pull Request Verification

Every PR should verify:

```text id="x4m8c7"
Relevant unit tests
Relevant integration tests
Relevant API tests
Typecheck
Lint
Build
```

Business-critical changes should include tests covering failure and concurrency behavior where applicable.

---

# 50. Regression Testing

When a bug is fixed:

```text id="m8c4x7"
1. Reproduce bug
2. Add regression test
3. Implement fix
4. Run focused tests
5. Run broader suite
```

A bug fix without a regression test should require explicit justification.

---

# 51. Test Data

Use factories/builders rather than copying large static datasets.

Factories should support:

```text id="q7n5m8"
Store
User
Membership
Product
Variant
Inventory
Customer
Cart
Checkout
Payment
Order
```

Factories should create valid default data and allow targeted overrides.

---

# 52. Test Isolation

Tests must not depend on execution order.

Each test should:

- Create its own required state.
- Clean up or isolate its data.
- Avoid relying on another test's records.
- Avoid shared mutable global state.

---

# 53. Determinism

Avoid:

```text id="v8c5m4"
Real external services
Random uncontrolled data
Current time without control
Network-dependent assertions
Order-dependent tests
```

Use controlled clocks and deterministic factories where necessary.

---

# 54. Time-Based Testing

Important time-sensitive features include:

```text id="x4m8c7"
Checkout expiration
Discount validity
Payment timestamps
Session expiration
Job availability
Webhook replay windows
```

Tests should use controllable time rather than waiting in real time.

---

# 55. Test Naming

Test names should describe behavior.

Prefer:

```text id="m7n4x8"
rejects checkout when inventory cannot be reserved
```

over:

```text id="q5c8m4"
testCheckout2
```

Tests should make failures understandable without reading the implementation.

---

# 56. Coverage

Coverage is a signal, not the objective.

Prioritize coverage of:

```text id="v8m5c4"
Critical business rules
Security boundaries
Transactions
State machines
Idempotency
Concurrency
Failure recovery
```

Do not artificially increase coverage by testing trivial getters or framework behavior.

---

# 57. Verification Order

The recommended verification order during implementation is:

```text id="x7c4m8"
1. Typecheck
2. Lint
3. Unit tests
4. Repository/database tests
5. Integration tests
6. API tests
7. Security tests
8. Worker/job tests
9. E2E tests
10. Production-like build verification
```

Fix failures at the earliest appropriate layer.

---

# 58. Full Demo Verification

Before declaring the Demo complete, execute:

```text id="m4n8c7"
Foundation verification
      ↓
Database verification
      ↓
Authentication verification
      ↓
Tenant verification
      ↓
Merchant flow
      ↓
Storefront flow
      ↓
Cart flow
      ↓
Checkout flow
      ↓
Payment flow
      ↓
Order flow
      ↓
Worker verification
      ↓
Security verification
      ↓
E2E verification
```

---

# 59. Definition of Done

The testing plan is considered implemented when:

```text id="q8c5m4"
[ ] Unit test conventions are established
[ ] Integration test infrastructure works
[ ] PostgreSQL test database works
[ ] API test infrastructure works
[ ] E2E infrastructure works
[ ] Test factories exist
[ ] Authentication tests exist
[ ] Authorization tests exist
[ ] Tenant isolation tests exist
[ ] Inventory concurrency tests exist
[ ] Checkout tests exist
[ ] Payment tests exist
[ ] Webhook tests exist
[ ] Order tests exist
[ ] Job tests exist
[ ] Media tests exist
[ ] Notification tests exist
[ ] Idempotency tests exist
[ ] Failure-recovery tests exist
[ ] Security tests exist
[ ] CI executes required verification
[ ] Merchant E2E journey passes
[ ] Customer purchase E2E journey passes
```