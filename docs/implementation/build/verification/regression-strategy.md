
# Regression Strategy

## 1. Purpose

This document defines the regression strategy for the Demo implementation.

Regression verification ensures that a new change does not break functionality that previously worked.

The strategy prioritizes the areas where failures have the greatest impact:

```text id="7r4m8q"
Tenant Isolation
Authentication
Authorization
Inventory
Checkout
Payments
Orders
Webhooks
Idempotency
Concurrency
```

---

# 2. Regression Principle

Every change must be evaluated beyond the immediate file or feature being modified.

The required question is:

> What existing behavior could this change affect?

A Product change may affect Storefront and Cart.

An Inventory change may affect Checkout and Orders.

A Payment change may affect Checkout, Webhooks, Orders, Notifications, and Jobs.

---

# 3. Regression Levels

Regression testing is divided into:

```text id="m5q8r4"
Level 1 → Targeted regression
Level 2 → Module regression
Level 3 → Cross-domain regression
Level 4 → Critical-path regression
Level 5 → Full Demo regression
```

The appropriate level depends on the risk of the change.

---

# 4. Level 1: Targeted Regression

Run when a change is isolated and low risk.

Examples:

```text id="x7r4m6"
UI presentation change
DTO formatting
Non-business validation message
Minor component change
```

Run:

```text id="q4m8r5"
Affected unit tests
Affected API tests
Typecheck
Lint
```

---

# 5. Level 2: Module Regression

Run when changing one domain module.

Examples:

```text id="v6r5m4"
Products
Customers
Carts
Discounts
Orders
```

Run:

```text id="m8q4r5"
All module unit tests
Module integration tests
Affected API tests
Tenant tests
Typecheck
Lint
Build
```

---

# 6. Level 3: Cross-Domain Regression

Run when a change crosses module boundaries.

Examples:

```text id="x5r7m4"
Products → Carts
Inventory → Checkout
Checkout → Payments
Payments → Orders
Orders → Notifications
```

Run:

```text id="q8m4r6"
Affected module tests
Integration tests
API tests
Relevant security tests
Concurrency tests
Idempotency tests
```

---

# 7. Level 4: Critical-Path Regression

Mandatory when modifying:

```text id="v7r4m8"
Authentication
Tenant context
Authorization
Inventory
Checkout
Payments
Orders
Webhooks
Jobs
Database transaction infrastructure
```

Run the complete purchase flow:

```text id="m5q8r4"
Store
 ↓
Product
 ↓
Inventory
 ↓
Cart
 ↓
Checkout
 ↓
Payment
 ↓
Order
```

---

# 8. Level 5: Full Demo Regression

Run before Demo release or after major architecture/runtime changes.

Includes:

```text id="x4r8m5"
All automated tests
Security tests
Concurrency tests
Idempotency tests
Worker tests
Full E2E suite
Merchant lifecycle
Customer lifecycle
Guest lifecycle
Deployment verification
```

---

# 9. Change Impact Analysis

Before implementing a change, identify:

```text id="q6m4r8"
Changed component
      ↓
Direct consumers
      ↓
Indirect consumers
      ↓
Shared infrastructure
      ↓
Critical workflows
```

Review:

- Imports.
- Public interfaces.
- Events.
- Jobs.
- Database tables.
- API contracts.
- Shared packages.
- Tests.

---

# 10. Regression Matrix

| Change Area | Minimum Regression |
|---|---|
| UI-only | Targeted |
| Shared UI | Module |
| Validation | Module/API |
| API DTO | Module/API |
| Database schema | Cross-domain |
| Auth | Critical-path |
| Tenant | Critical-path |
| Products | Cross-domain |
| Inventory | Critical-path |
| Carts | Cross-domain |
| Discounts | Cross-domain |
| Checkout | Critical-path |
| Payments | Critical-path |
| Orders | Critical-path |
| Webhooks | Critical-path |
| Jobs | Cross-domain |
| Deployment config | Full Demo |

---

# 11. Authentication Regression

Changes to authentication require testing:

```text id="v8r5m4"
Login
Logout
Session creation
Session expiration
Session revocation
Protected routes
Public routes
Role resolution
Customer authentication
Merchant authentication
```

Verify authentication changes do not accidentally bypass authorization.

---

# 12. Authorization Regression

For every authorization change test:

```text id="m4q7r5"
Owner
Admin
Staff
Customer
Guest
```

Verify:

```text id="x5r8m4"
Allowed operation remains allowed
Forbidden operation remains forbidden
Cross-store operation remains forbidden
```

---

# 13. Tenant Regression

Tenant changes require explicit cross-tenant tests.

Test:

```text id="q7m4r6"
Read Store A from Store B
Write Store A from Store B
Delete Store A from Store B
View Store A Order from Store B
View Store A Cart from Store B
View Store A Product from Store B
```

Every unauthorized operation must fail safely.

---

# 14. Product Regression

When Product behavior changes, test:

```text id="v6m8r4"
Product creation
Variant creation
Price changes
SKU uniqueness
Slug uniqueness
Publication
Unpublication
Storefront visibility
Cart compatibility
Checkout compatibility
```

---

# 15. Inventory Regression

Inventory changes require stronger regression coverage.

Test:

```text id="m5q4r8"
Stock adjustment
Available quantity
Reservation
Release
Finalization
Expiration
Concurrent reservation
Oversell prevention
Checkout integration
```

Critical invariant:

```text id="x8r4m5"
available = onHand - reserved
```

must remain valid according to the approved inventory model.

---

# 16. Cart Regression

When Cart behavior changes, test:

```text id="q6m8r4"
Guest Cart
Authenticated Cart
Add item
Duplicate Variant
Quantity update
Remove item
Persistence
Expiration
Checkout creation
Ownership
```

Also verify:

```text id="v7r5m4"
Add-to-cart does not reserve inventory.
```

---

# 17. Discount Regression

Test:

```text id="m4q8r5"
Percentage discount
Fixed discount
Validity
Eligibility
Usage limits
Concurrent usage
Checkout totals
Order historical discount data
```

A discount change must not silently alter unrelated Product pricing.

---

# 18. Checkout Regression

Checkout changes require:

```text id="x5r7m4"
Cart validation
Product revalidation
Price calculation
Discount calculation
Inventory reservation
Payment initialization
Completion
Expiration
Cancellation
Idempotency
```

Run the full purchase flow.

---

# 19. Payment Regression

Any Payment change requires the strongest regression level.

Test:

```text id="q8m4r6"
Payment creation
Success
Failure
Pending
Timeout
Retry
Provider idempotency
Webhook
Duplicate webhook
Out-of-order webhook
Refund
```

Also verify:

```text id="v6r4m8"
One purchase
→ one successful payment
→ one Order
```

---

# 20. Webhook Regression

Webhook changes require:

```text id="m8q4r5"
Signature verification
Replay protection
Deduplication
Payload validation
Provider event mapping
Out-of-order events
Retry
Terminal failure
```

Verify duplicate webhook delivery does not duplicate business effects.

---

# 21. Order Regression

Order changes require:

```text id="x4r8m5"
Order creation
Order number
Items
Historical snapshots
Status transitions
Status history
Merchant access
Customer access
Cancellation
Payment integration
```

Historical data must remain immutable.

---

# 22. Jobs Regression

Changes to the job system require:

```text id="q7m5r4"
Job creation
Claiming
Concurrent workers
Retry
Backoff
Stale recovery
Failure
Idempotent execution
Graceful shutdown
```

Critical jobs include:

```text id="v5r8m4"
Payment webhook processing
Notification delivery
Cart expiration
Checkout expiration
Inventory reservation expiration
```

---

# 23. Database Regression

Schema or query changes require:

```text id="m6q4r8"
Migration test
Constraint test
Index verification
Foreign-key verification
Transaction test
Repository test
Seed test
```

Also verify existing data remains compatible.

---

# 24. API Regression

For API changes verify:

```text id="x8r5m4"
HTTP method
Path
Request schema
Response schema
Error schema
Authentication
Authorization
Tenant scope
Pagination
Idempotency
```

Do not accidentally break existing consumers.

---

# 25. Contract Regression

OpenAPI definitions must remain aligned with implementation.

A contract change should identify whether it is:

```text id="q5m7r4"
Backward compatible
Potentially breaking
Breaking
```

Breaking changes require explicit approval.

---

# 26. Event Regression

When changing an event:

```text id="v7r4m6"
Identify producers
Identify consumers
Review payload
Review version compatibility
Run consumer tests
```

Do not silently rename or remove fields consumed by existing handlers.

---

# 27. Job Payload Regression

Job payloads should be treated as persisted data.

Changing a payload requires consideration of:

```text id="m5q8r4"
Queued jobs
Retrying jobs
Stale jobs
Worker versions
```

Handlers should tolerate expected compatible payload evolution.

---

# 28. Database Data Regression

After major changes, verify existing records such as:

```text id="x6r4m8"
Products
Inventory
Customers
Carts
Discounts
Checkouts
Payments
Orders
Jobs
Webhooks
```

remain valid.

---

# 29. Migration Regression

For migration changes test:

```text id="q8m4r5"
Fresh database
Existing database
Seeded database
Representative production-like data
```

The migration must not depend on developer-specific local state.

---

# 30. Concurrency Regression

Concurrency behavior must be rechecked whenever changing:

```text id="v5r7m4"
Transaction boundaries
Locks
Indexes
Constraints
Inventory
Payments
Orders
Jobs
Idempotency
```

Run the corresponding concurrent tests rather than relying only on sequential tests.

---

# 31. Idempotency Regression

Whenever a critical mutation changes, repeat the operation.

For example:

```text id="m4q8r5"
Request
Request again
Retry after timeout
Retry with same Idempotency-Key
```

Verify the final state is correct.

Also test:

```text id="x7r4m6"
Same key
Different request
```

which should be rejected according to the shared idempotency rules.

---

# 32. Retry Regression

Simulate failures between:

```text id="q6m8r4"
Database commit
and
Response delivery
```

The client may retry after receiving no response.

Verify no duplicate business operation occurs.

---

# 33. Failure Injection

For critical workflows, introduce controlled failures such as:

```text id="v8r4m5"
Database timeout
Provider timeout
Network interruption
Webhook failure
Worker crash
Process restart
```

Verify recovery behavior.

---

# 34. Browser Regression

Critical customer flows should be tested in the browser after significant frontend changes.

At minimum:

```text id="m5q7r4"
Storefront
Product
Cart
Checkout
Payment
Order confirmation
```

Merchant flows:

```text id="x4r8m6"
Login
Store
Products
Inventory
Orders
```

---

# 35. Responsive Regression

When changing shared UI, verify supported viewport sizes.

Critical pages:

```text id="q7m4r5"
Storefront
Product detail
Cart
Checkout
Order confirmation
Merchant dashboard
Order management
```

---

# 36. Accessibility Regression

When changing interactive components, verify:

```text id="v6r8m4"
Keyboard navigation
Focus behavior
Labels
Validation errors
Button state
Loading state
```

---

# 37. Performance Regression

The Demo does not require enterprise-scale performance testing.

However, detect regressions such as:

```text id="m8q4r5"
New N+1 query
Unbounded query
Large response
Slow checkout
Repeated provider calls
Unbounded worker execution
```

Critical purchase-path latency should be monitored after major changes.

---

# 38. Observability Regression

After changing logging or error handling, verify:

```text id="x5r7m4"
Request correlation
Job correlation
Error reporting
Payment diagnostics
Webhook diagnostics
Structured fields
Sensitive-data filtering
```

A feature that works but cannot be diagnosed in production is not fully operational.

---

# 39. Security Regression

Run security regression after changes involving:

```text id="q8m4r6"
Authentication
Authorization
Tenant context
API routes
File uploads
Webhooks
Payments
Sessions
Cookies
CORS/CSRF
```

Never assume a security-sensitive refactor is behavior-neutral.

---

# 40. Dependency Upgrade Regression

Dependency upgrades require:

```text id="v7m5r4"
Install
Typecheck
Lint
Unit tests
Integration tests
Build
E2E
Security checks
```

For framework/runtime upgrades, use Full Demo regression.

---

# 41. Refactoring Regression

A refactor that claims to preserve behavior should still verify:

```text id="m4q8r5"
Public API behavior
Database behavior
Business behavior
Security behavior
Error behavior
```

"Refactor only" is not a magical exemption from testing.

---

# 42. Bug-Fix Regression

Every confirmed bug fix must add a regression test when practical.

Required sequence:

```text id="x6r8m4"
Reproduce bug
 ↓
Add failing test
 ↓
Fix implementation
 ↓
Test passes
 ↓
Run affected regression suite
```

Do not fix only the observed symptom when the underlying invariant is broader.

---

# 43. Regression Test Retention

Regression tests must remain in the suite after the original bug is fixed.

Do not remove a regression test merely because:

```text id="q5m7r4"
"The bug is fixed now."
```

Its purpose is to prevent the bug from returning.

---

# 44. Test Data Strategy

Regression tests should use controlled test data.

Avoid dependencies on:

```text id="v8r4m5"
Developer-specific records
Current production data
External mutable services
Random uncontrolled values
```

Factories and fixtures should provide deterministic scenarios.

---

# 45. Regression Environment

The preferred regression environment should approximate Demo runtime:

```text id="m6q4r8"
PostgreSQL
Web
Worker
Configured external sandbox providers
Object storage test environment where required
```

Do not rely solely on mocked infrastructure for critical-path regression.

---

# 46. Regression Execution Matrix

| Change | Unit | Integration | API | Security | Concurrency | E2E |
|---|---:|---:|---:|---:|---:|---:|
| UI-only | Yes | - | - | - | - | Targeted |
| Product | Yes | Yes | Yes | Yes | As needed | Catalog |
| Inventory | Yes | Yes | Yes | Yes | Required | Purchase |
| Cart | Yes | Yes | Yes | Yes | Required | Purchase |
| Discount | Yes | Yes | Yes | Yes | Required | Checkout |
| Checkout | Yes | Yes | Yes | Yes | Required | Full |
| Payment | Yes | Yes | Yes | Required | Required | Full |
| Orders | Yes | Yes | Yes | Required | Required | Full |
| Webhooks | Yes | Yes | Yes | Required | Required | Payment |
| Auth/Tenant | Yes | Yes | Yes | Required | As needed | Full |
| Jobs | Yes | Yes | As needed | Yes | Required | Relevant |
| Deployment | - | Environment | - | Required | - | Full |

---

# 47. Regression Trigger Rules

At minimum:

### Targeted Regression

For isolated low-risk changes.

### Module Regression

For changes inside a domain.

### Cross-Domain Regression

For changes crossing module boundaries.

### Critical-Path Regression

For changes affecting financial, security, or transactional correctness.

### Full Demo Regression

Before release or after major infrastructure/runtime changes.

---

# 48. Regression Failure Handling

When regression fails:

1. Stop release progression if the failure is critical.
2. Identify whether the failure is real, environmental, or test-related.
3. Reproduce locally.
4. Determine the affected invariant.
5. Fix the underlying issue.
6. Add or update regression coverage.
7. Re-run the affected suite.
8. Re-run the broader suite required by the change risk.

Never simply mark a failing test as flaky without evidence.

---

# 49. Flaky Test Policy

A test may be classified as flaky only after evidence demonstrates nondeterministic behavior.

A flaky test must:

```text id="x4r8m6"
Be identified
Have an owner
Be investigated
Have a tracking issue
```

Critical tests must not be permanently ignored because they are inconvenient.

---

# 50. Regression Evidence

Record:

```text id="q7m5r4"
Tests executed
Build result
Environment
Relevant failures
Fixes
Final result
```

For release verification, preserve enough evidence to establish that the required gates actually ran.

---

# 51. AI Regression Rules

AI agents must:

1. Identify affected modules before changing code.
2. Determine the appropriate regression level.
3. Run targeted tests after each meaningful implementation.
4. Run broader regression before declaring completion.
5. Add regression tests for confirmed bugs.
6. Never delete failing tests to obtain a green build.
7. Never weaken assertions solely to accommodate an implementation.
8. Report unverified behavior honestly.
9. Review cross-domain effects before modifying shared code.

---

# 52. Definition of Done

A change passes regression verification when:

```text id="v6r4m8"
[ ] Impacted modules identified
[ ] Appropriate regression level selected
[ ] Targeted tests pass
[ ] Required integration tests pass
[ ] Required API tests pass
[ ] Required security tests pass
[ ] Concurrency tests pass where applicable
[ ] Idempotency tests pass where applicable
[ ] Relevant E2E flow passes
[ ] No unexplained failures remain
[ ] Regression tests added for confirmed defects
[ ] Documentation updated where required
```

---

# 53. Final Regression Principle

The purpose of regression testing is not to rerun every test after every keystroke.

It is to match verification depth to change risk.

The governing rule is:

```text id="m8q4r5"
Small change
→ Small verification

Cross-domain change
→ Cross-domain verification

Critical transaction change
→ Critical-path verification

Architecture/runtime change
→ Full Demo verification
```

This keeps development efficient without sacrificing the correctness of the commerce lifecycle.