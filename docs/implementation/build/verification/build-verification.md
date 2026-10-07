# Build Verification Implementation

## 1. Purpose

This document defines the verification process for determining whether the Demo implementation is technically complete, internally consistent, and safe enough to proceed toward release.

Verification is not limited to checking whether the application starts.

The build must demonstrate:

- Correct compilation.
- Correct package boundaries.
- Correct database behavior.
- Correct domain behavior.
- Correct API behavior.
- Correct tenant isolation.
- Correct authentication and authorization.
- Correct concurrency behavior.
- Correct idempotency behavior.
- Correct payment and Order behavior.
- Correct background processing.
- Correct end-to-end customer workflows.

---

# 2. Verification Principle

A successful build is not equivalent to:

```text
npm run build
```

The verification process must establish:

```text
Code
 ↓
Type correctness
 ↓
Static quality
 ↓
Database correctness
 ↓
Application correctness
 ↓
Security correctness
 ↓
Integration correctness
 ↓
End-to-end correctness
 ↓
Release readiness
```

---

# 3. Verification Gates

Verification is divided into gates:

```text
Gate 1  Repository
Gate 2  Dependencies
Gate 3  TypeScript
Gate 4  Lint/Formatting
Gate 5  Build
Gate 6  Database
Gate 7  Unit Tests
Gate 8  Integration Tests
Gate 9  API Tests
Gate 10 Security Tests
Gate 11 Concurrency/Idempotency
Gate 12 Worker Tests
Gate 13 E2E Tests
Gate 14 Demo Acceptance
```

A failed critical gate blocks release.

---

# 4. Clean Repository Verification

Verify the repository from a clean checkout.

Required:

```text
No untracked required source files
No missing generated configuration
No local-only dependency
No machine-specific path
No committed secret
No undocumented required manual setup
```

The application must be reproducible from the repository.

---

# 5. Dependency Verification

Run the approved package-manager installation from the repository root.

Verify:

```text
Lockfile is present
Dependencies resolve
Workspace packages resolve
No unexpected package drift
Build dependencies are available
```

The lockfile must remain consistent with package manifests.

---

# 6. Dependency Boundary Verification

Check that:

```text
Presentation
   ↓
Application
   ↓
Domain
   ↓
Infrastructure
```

dependency direction is preserved.

Verify that domain modules do not directly depend on unrelated internal implementations.

---

# 7. TypeScript Verification

Run the repository's approved TypeScript type-check command.

The build must produce:

```text
0 TypeScript errors
```

Do not suppress errors merely to obtain a successful build.

Avoid:

```text
any
@ts-ignore
@ts-expect-error
```

unless explicitly justified and documented.

---

# 8. Lint Verification

Run the approved lint command.

The result must contain no unresolved lint violations.

Warnings should be reviewed rather than blindly ignored.

---

# 9. Formatting Verification

Run the repository formatter/checker.

Formatting failures must be corrected before release.

Do not introduce unrelated formatting changes into focused implementation work.

---

# 10. Application Build

Build all required applications and packages.

At minimum:

```text
apps/web
apps/worker
```

and all required workspace packages.

Verify:

```text
Build succeeds
Expected artifacts are generated
No missing environment configuration during build
No server-only dependency leaks into client bundles
No client-only dependency is required by server runtime
```

---

# 11. Production Build Test

The application must be tested using the same build mode intended for Demo deployment.

Do not rely exclusively on development mode.

Verify:

```text
Production web build
Production worker build
Runtime startup
Health endpoints
Database connectivity
Configuration loading
```

---

# 12. Environment Verification

Validate environment configuration using the centralized configuration package.

Check:

```text
Required variables exist
URLs are valid
Booleans parse correctly
Numbers parse correctly
Secrets are not empty
Production configuration rejects unsafe defaults
```

Do not print secrets during verification.

---

# 13. Database Connectivity

Start the approved PostgreSQL environment.

Verify:

```text
Connection succeeds
Application can execute queries
Transactions work
Required extensions exist if any are approved
```

No application module should silently fall back to an in-memory database.

---

# 14. Migration Verification

Run migrations against a clean database.

Verify:

```text
All migrations apply successfully
No migration requires manual intervention
Schema matches expected implementation
Constraints exist
Indexes exist
Foreign keys exist
```

Then verify migrations against an already-initialized database.

---

# 15. Migration Reproducibility

The same migration set must produce the expected schema from an empty database.

Test:

```text
Empty DB
 ↓
All migrations
 ↓
Expected schema
```

and:

```text
Existing Demo DB
 ↓
Pending migrations
 ↓
Expected upgraded schema
```

---

# 16. Seed Verification

Run the approved seed command in the intended development/demo environment.

Verify:

```text
Seed completes
Required demo accounts exist
Required Store exists
Required catalog data exists
Required inventory exists
Seed data is internally consistent
```

Running the seed according to its documented semantics must not create uncontrolled duplicate data.

---

# 17. Tenant Seed Verification

If multiple demo tenants are seeded, verify isolation explicitly.

For example:

```text
Organization A
  Store A
  Products A
  Customers A

Organization B
  Store B
  Products B
  Customers B
```

Verify no query exposes Store A data through Store B context.

---

# 18. Unit Test Verification

Run all unit tests.

Unit tests should cover high-value domain behavior such as:

```text
State transitions
Pricing
Discounts
Inventory rules
Cart rules
Checkout rules
Payment state
Order state
Authorization decisions
Validation
```

Tests should verify behavior rather than internal implementation details.

---

# 19. Integration Test Verification

Run integration tests against PostgreSQL.

Verify:

```text
Repositories
Transactions
Constraints
Application services
Domain integrations
Database concurrency
Job persistence
Webhook persistence
```

Avoid replacing the database with mocks for tests whose purpose is verifying database behavior.

---

# 20. API Verification

Test all implemented API capabilities.

Verify:

```text
Authentication
Authorization
Tenant resolution
Request validation
DTO serialization
Error responses
Pagination
Idempotency
HTTP status codes
```

---

# 21. API Contract Verification

Verify that implementation matches the approved API contract.

Check:

```text
Endpoint path
HTTP method
Request shape
Response shape
Error shape
Authentication requirement
Authorization requirement
Pagination behavior
Idempotency behavior
```

OpenAPI definitions must remain consistent with implementation.

---

# 22. Authentication Verification

Test:

```text
Login
Logout
Session creation
Session expiration
Session invalidation
Password handling
Password reset where implemented
Unauthorized access
```

Verify secure cookie behavior in the intended environment.

---

# 23. Authorization Verification

Test each important role:

```text
Owner
Admin
Staff
Customer
Guest
```

Verify permissions at the server boundary.

A hidden frontend button is not authorization.

---

# 24. Tenant Isolation Verification

This is a release-blocking test category.

Verify:

```text
Store A user cannot access Store B data
Store A API cannot mutate Store B data
Store A customer cannot access Store B Cart
Store A customer cannot access Store B Order
Store A merchant cannot access Store B inventory
```

Test both:

```text
Read
Write
```

operations.

---

# 25. Product Verification

Verify:

```text
Create Product
Create Variant
Update Product
Update Variant
Publish Product
Unpublish Product
Unique SKU/slug rules
Price validation
Public visibility
```

Draft products must remain invisible to public Storefront queries.

---

# 26. Inventory Verification

Verify:

```text
Stock adjustment
Available quantity
Reservation
Reservation release
Reservation finalization
Reservation expiration
Concurrency
Oversell prevention
Movement history
```

Critical concurrency test:

```text
Stock = 1

Concurrent Checkout A → reserve 1
Concurrent Checkout B → reserve 1

Expected:
Exactly one succeeds.
```

---

# 27. Customer Verification

Verify:

```text
Customer creation
Profile update
Address creation
Default address rules
Customer lookup
Customer isolation
```

Customer data must remain Store-scoped.

---

# 28. Cart Verification

Verify:

```text
Guest Cart
Authenticated Cart
Add item
Update quantity
Remove item
Cart persistence
Cart expiration
Cart ownership
Duplicate item prevention
```

Adding to Cart must not reserve Inventory.

---

# 29. Discount Verification

Verify:

```text
Valid code
Invalid code
Expired code
Usage limit
Eligibility
Percentage discount
Fixed discount
Rounding
Concurrent usage
```

Discount usage must remain transactional.

---

# 30. Checkout Verification

Verify:

```text
Cart → Checkout
Current Product pricing
Discount recalculation
Inventory validation
Inventory reservation
Checkout expiration
Checkout cancellation
Completion
Idempotency
```

Checkout must never trust client-submitted totals.

---

# 31. Payment Verification

Payment is a release-blocking verification area.

Test:

```text
Payment creation
Payment success
Payment failure
Payment pending
Provider timeout
Provider retry
Provider idempotency
Webhook success
Webhook duplicate
Webhook replay
Webhook out-of-order
Refund where implemented
```

---

# 32. Payment Timeout Verification

Simulate:

```text
Payment request sent
Provider processes request
Client receives timeout
```

Verify the system does not automatically create a second payment that could result in duplicate charging.

---

# 33. Webhook Verification

Verify:

```text
Valid signature
Invalid signature
Missing signature
Expired/replayed event
Duplicate event
Malformed payload
Unknown event
Out-of-order event
Processing failure
Retry
Terminal failure
```

Webhook requests must not directly bypass the Payments application service.

---

# 34. Order Verification

Verify:

```text
Order creation
Unique Order number
Order Items
Historical snapshots
Order status
Status history
Merchant access
Customer access
Cancellation
```

---

# 35. Duplicate Order Verification

Run:

```text
Complete Checkout
Complete Checkout again
Repeat webhook
Retry worker
Refresh customer page
```

Expected:

```text
Exactly one Order
Exactly one successful purchase
```

---

# 36. Historical Data Verification

After completing a purchase:

1. Change Product name.
2. Change Product price.
3. Change SKU.
4. Change Customer name.
5. Change Customer address.

Verify the completed Order still contains the original purchase information.

---

# 37. Job Verification

Verify PostgreSQL-backed jobs:

```text
Job creation
Job claiming
Concurrent workers
Retry
Backoff
Failure
Terminal failure
Stale job recovery
Graceful shutdown
Idempotent handler
```

Critical test:

```text
Worker A claims Job X
Worker B attempts Job X

Expected:
Only one active claim.
```

---

# 38. Notification Verification

Verify:

```text
Notification creation
Recipient resolution
Template rendering
Job creation
Provider adapter
Successful delivery
Transient failure
Retry
Permanent failure
Idempotency
```

Notification failure must not corrupt the underlying business transaction.

---

# 39. Media Verification

Verify:

```text
Metadata creation
Upload lifecycle
Object storage integration
Public/private access
File validation
Invalid type rejection
Size limit
Deletion/cleanup
```

Private media must not become publicly accessible through predictable URLs.

---

# 40. Storefront Verification

Verify the public lifecycle:

```text
Store
 ↓
Published Product
 ↓
Product detail
 ↓
Variant
 ↓
Cart
 ↓
Checkout
 ↓
Payment
 ↓
Order confirmation
```

Verify unpublished Products never appear.

---

# 41. End-to-End Verification

The primary E2E scenario must complete:

```text
Merchant
 ↓
Create/configure Store
 ↓
Create Product
 ↓
Create Variant
 ↓
Set Inventory
 ↓
Publish Product
 ↓
Customer
 ↓
Open Storefront
 ↓
View Product
 ↓
Add to Cart
 ↓
Checkout
 ↓
Payment
 ↓
Order
 ↓
Merchant views Order
```

This is the core Demo proof.

---

# 42. Guest Purchase Verification

Where supported, run:

```text
Guest
 ↓
Storefront
 ↓
Product
 ↓
Cart
 ↓
Checkout
 ↓
Payment
 ↓
Order
```

Verify guest ownership is maintained throughout the flow.

---

# 43. Authenticated Customer Verification

Run:

```text
Customer login
 ↓
Storefront
 ↓
Cart
 ↓
Checkout
 ↓
Payment
 ↓
Order
 ↓
Customer Order history
```

Verify the customer sees only their own permitted data.

---

# 44. Browser Refresh Verification

Refresh the browser during:

```text
Catalog
Cart
Checkout
Payment
Order confirmation
```

Verify no duplicate mutation occurs.

---

# 45. Retry Verification

Repeat requests after simulated network failures.

Test:

```text
Add-to-cart
Checkout creation
Payment initialization
Checkout completion
Order retrieval
Webhook processing
Job execution
```

Verify the final state remains correct.

---

# 46. Concurrency Verification

Critical concurrent operations include:

```text
Inventory reservation
Cart mutation
Checkout completion
Payment completion
Order creation
Order status update
Discount usage
Job claiming
```

Each must have an explicit expected result.

---

# 47. Security Verification

Run security checks for:

```text
Authentication bypass
Authorization bypass
Cross-tenant access
ID enumeration
Input validation
SQL injection
XSS
CSRF where applicable
Unsafe file upload
Webhook spoofing
Replay attacks
Secret exposure
Sensitive logging
```

---

# 48. Dependency Security

Check dependencies for known vulnerabilities according to the approved project tooling.

Review:

```text
Critical vulnerabilities
High vulnerabilities
Abandoned critical dependencies
Unexpected packages
License concerns where applicable
```

Do not blindly upgrade dependencies immediately before release if the upgrade can destabilize the system.

---

# 49. Secret Verification

Search the repository and build artifacts for:

```text
API keys
Passwords
Private keys
Database credentials
Payment secrets
Webhook secrets
Session secrets
Cloud credentials
```

`.env.example` must contain placeholders only.

---

# 50. Logging Verification

Inspect application logs during:

```text
Successful request
Expected error
Unexpected error
Payment failure
Webhook failure
Worker failure
Database failure
```

Verify:

```text
Useful context exists
Sensitive data is absent
Correlation IDs work
Errors are observable
```

---

# 51. Error Handling Verification

Verify that expected failures return stable application errors.

Examples:

```text
Invalid input → validation error
Unauthorized → authorization error
Not found → safe not-found
Conflict → conflict error
Inventory shortage → inventory error
Payment failure → payment error
Unexpected failure → generic internal error
```

Unexpected internal details must not leak to clients.

---

# 52. Health Verification

Verify:

```text
Application health
Readiness
Database connectivity
Worker health
```

Readiness should fail when a critical required dependency is unavailable.

---

# 53. Worker Verification

Start the Worker independently.

Verify:

```text
Startup
Database connection
Job polling
Job execution
Graceful shutdown
Restart
Recovery
```

A Worker crash must not permanently lose durable jobs.

---

# 54. Build Artifact Verification

Inspect production build artifacts for:

```text
Expected files
No secrets
No development-only configuration
No unnecessary source maps in restricted environments if not intended
No broken imports
```

Client bundles must not contain server-only secrets.

---

# 55. Performance Sanity Checks

Demo verification does not require enterprise load testing.

However, verify obvious failures such as:

```text
Unbounded database query
Unbounded API response
N+1 query in critical path
Huge object returned unnecessarily
Blocking external request inside transaction
Unbounded worker concurrency
```

---

# 56. Database Integrity Verification

After running the complete purchase flow, verify database relationships:

```text
Store
 ↓
Product
 ↓
Variant
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

Verify foreign keys and state relationships remain valid.

---

# 57. Regression Verification

After fixing a defect, rerun:

```text
Targeted test
+
Affected integration tests
+
Relevant E2E flow
```

Do not rely only on the new regression test.

---

# 58. Clean Environment Verification

Before Demo release, test from a clean environment:

```text
Fresh checkout
 ↓
Install dependencies
 ↓
Configure environment
 ↓
Start PostgreSQL
 ↓
Run migrations
 ↓
Seed data
 ↓
Build
 ↓
Start Web
 ↓
Start Worker
 ↓
Run verification suite
```

A developer machine that has accumulated six months of mysterious local configuration is not a valid deployment target.

---

# 59. Verification Commands

The exact commands must come from repository scripts.

The repository should provide clear commands for:

```text
Install
Typecheck
Lint
Format check
Unit tests
Integration tests
API tests
E2E tests
Database migrations
Database seed
Build
Start
Worker start
```

Do not invent command names if the repository already defines them differently.

---

# 60. Verification Order

Use this sequence:

```text
1. Clean checkout
2. Install dependencies
3. Validate configuration
4. Start PostgreSQL
5. Run migrations
6. Seed
7. Typecheck
8. Lint
9. Format check
10. Build
11. Unit tests
12. Integration tests
13. API tests
14. Security tests
15. Concurrency/idempotency tests
16. Worker tests
17. E2E tests
18. Full merchant/customer lifecycle
19. Inspect logs
20. Inspect database state
21. Final release gates
```

---

# 61. Failure Classification

Every failed verification should be classified as:

```text
BLOCKER
CRITICAL
HIGH
MEDIUM
LOW
```

The following are automatically release-blocking:

```text
Cross-tenant data exposure
Authentication bypass
Authorization bypass
Duplicate payment
Incorrect payment state
Duplicate Order
Oversold Inventory
Checkout corruption
Webhook spoofing
Secret exposure
Data loss
Irrecoverable durable jobs
```

---

# 62. Evidence

Verification should produce evidence such as:

```text
Test results
Build logs
Migration results
E2E results
Security results
Relevant screenshots where useful
Database verification results
Deployment health results
```

Do not claim a gate passed without actually executing it.

---

# 63. AI Verification Rules

AI agents must:

1. Run the relevant verification commands after implementation.
2. Report failures honestly.
3. Never replace failing tests with weaker tests merely to obtain green output.
4. Never delete tests to make a build pass.
5. Never disable lint/type checks without explicit approval.
6. Never claim an external integration was tested when only mocked.
7. Distinguish implemented behavior from verified behavior.
8. Review the final diff for unrelated changes.

---

# 64. Build Verification Definition of Done

Build verification is complete when:

```text
[ ] Clean checkout works
[ ] Dependencies install
[ ] Configuration validates
[ ] Database starts
[ ] Migrations succeed
[ ] Seeds succeed
[ ] TypeScript passes
[ ] Lint passes
[ ] Formatting passes
[ ] Production build succeeds
[ ] Unit tests pass
[ ] Integration tests pass
[ ] API tests pass
[ ] Security tests pass
[ ] Concurrency tests pass
[ ] Idempotency tests pass
[ ] Worker tests pass
[ ] E2E tests pass
[ ] Merchant lifecycle passes
[ ] Customer purchase lifecycle passes
[ ] Tenant isolation passes
[ ] Payment correctness passes
[ ] Order correctness passes
[ ] Logs contain no sensitive data
[ ] No secrets are present
[ ] Health/readiness checks pass
[ ] Final diff is reviewed
```

---

# 65. Final Verification Gate

The Demo is considered technically verified only when:

```text
Repository
   ↓
Build
   ↓
Database
   ↓
Tests
   ↓
Security
   ↓
Concurrency
   ↓
Payment
   ↓
Order
   ↓
End-to-End Purchase
   ↓
Deployment Runtime
```

all pass without unresolved release-blocking defects.

A green compilation alone is never sufficient evidence that the commerce platform works.