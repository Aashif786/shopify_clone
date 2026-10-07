# Implementation Rules

## 1. Purpose

This document defines the mandatory rules engineers and AI-assisted development tools must follow while implementing the Demo.

These rules convert the approved architecture and implementation strategy into concrete coding constraints.

They exist to prevent implementation drift, accidental coupling, security regressions, and unnecessary complexity.

---

# 2. Rule Hierarchy

Implementation decisions must follow:

```text
AGENTS.md
    ↓
Architecture Documentation
    ↓
Product Requirements
    ↓
Domain Specifications
    ↓
Implementation Specifications
    ↓
Build Documentation
    ↓
Existing Established Code Patterns
```

A lower-level implementation choice must not contradict a higher-level requirement.

---

# 3. Read Before Modify

Before modifying any code:

```text
1. Read the actual root AGENTS.md file.
2. Read relevant architecture documentation.
3. Read the applicable domain specification.
4. Read the applicable implementation specification.
5. Inspect the existing implementation.
6. Identify dependencies and affected boundaries.
7. Implement the smallest safe change.
```

Do not rely on remembered instructions or assumptions when the repository contains the authoritative version.

---

# 4. Scope Control

Every implementation task must have an explicit scope.

Only modify files required to satisfy the task.

Do not combine unrelated:

```text
features
refactors
dependency upgrades
formatting changes
architecture changes
```

into the same implementation task without justification.

---

# 5. Smallest Safe Change

Prefer the smallest implementation that fully satisfies the requirement.

Do not add:

```text
unused abstractions
future configuration
unused interfaces
speculative services
generic frameworks
unnecessary utilities
```

unless they are required by an existing architectural contract.

---

# 6. TypeScript Rules

Use strict TypeScript.

Required principles:

```text
[ ] Avoid any
[ ] Avoid unsafe casts
[ ] Prefer explicit domain types
[ ] Define public function contracts
[ ] Define API DTOs
[ ] Use discriminated unions where useful
[ ] Handle nullable values explicitly
[ ] Avoid implicit any
[ ] Keep types close to their ownership boundary
```

Do not weaken TypeScript configuration to make implementation easier.

---

# 7. Naming Rules

Use clear, domain-oriented names.

Examples:

```text
createProduct
reserveInventory
completeCheckout
createPayment
createOrder
cancelOrder
```

Avoid ambiguous names such as:

```text
processData
handleThing
doAction
updateStuff
```

Names should describe business behavior.

---

# 8. Function Rules

Functions should have one clear responsibility.

Prefer:

```text
validateCheckout()
calculateCheckoutTotals()
reserveInventory()
createOrder()
```

over large functions that simultaneously:

```text
parse HTTP
authorize user
calculate prices
write database
call provider
send email
```

Application services may coordinate multiple operations but should remain understandable.

---

# 9. Module Ownership

Every domain concept belongs to exactly one owning module.

Example:

```text
Product → Products
Inventory → Inventory
Customer → Customers
Cart → Carts
Payment → Payments
Order → Orders
```

Do not duplicate business ownership across modules.

---

# 10. Module Boundary Rule

A module may use another module only through its approved public interface.

Forbidden:

```text
Products
   ↓
Inventory internal repository
```

Allowed:

```text
Products
   ↓
Inventory public service/interface
```

or an approved event-based integration.

---

# 11. Internal Implementation Privacy

The following are private to their owning module unless explicitly exposed:

```text
repositories
database queries
internal domain services
internal DTOs
persistence models
internal helper functions
internal state transitions
```

Do not import internal implementation details from another module.

---

# 12. Database Access

Database access must be controlled through the module responsible for the relevant data.

Do not allow arbitrary application code to perform direct SQL against another module's tables.

Database queries must respect:

```text
tenant/store ownership
authorization context
transaction boundaries
domain ownership
```

---

# 13. Repository Rules

Repositories should provide persistence-oriented operations.

They should not become generic application service replacements.

Prefer:

```text
productRepository.findById()
productRepository.create()
inventoryRepository.reserve()
```

rather than a universal:

```text
databaseRepository.executeAnything()
```

---

# 14. Application Service Rules

Application services coordinate use cases.

They are responsible for:

```text
authorization context
transaction boundary
idempotency
module coordination
repository orchestration
domain invocation
event publication
```

They should not contain large amounts of unrelated domain logic.

---

# 15. Domain Rules

Business invariants belong in the owning domain.

Examples:

```text
Inventory
→ cannot reserve more than available

Discount
→ cannot apply an expired discount

Order
→ cannot transition through invalid states

Payment
→ cannot move through invalid payment states
```

Do not move important business rules into:

```text
React components
HTTP routes
generic database utilities
```

---

# 16. Presentation Rules

API handlers must remain thin.

Expected flow:

```text
HTTP Request
    ↓
Parse
    ↓
Validate
    ↓
Authenticate
    ↓
Authorize
    ↓
Application Service
    ↓
Response
```

Do not implement business workflows directly inside route handlers.

---

# 17. API Contract Rules

APIs must use explicit DTOs.

Do not return raw database entities automatically.

Responses should contain only fields intended for the consumer.

Avoid leaking:

```text
internal IDs
database metadata
internal state
security-sensitive fields
implementation details
```

unless explicitly required by the API contract.

---

# 18. API Versioning

Business APIs use:

```text
/api/v1/*
```

Do not introduce unversioned production business APIs unless explicitly documented.

Breaking changes require an API contract decision.

---

# 19. Input Validation

All external input must be validated before entering business logic.

Validate:

```text
request body
query parameters
route parameters
headers where applicable
webhook payloads
job payloads
file metadata
environment configuration
```

Validation must reject malformed input rather than attempting to guess the user's intention.

---

# 20. Authorization

Authentication proves identity.

Authorization determines permission.

Never treat:

```text
authenticated === authorized
```

Authorization must evaluate:

```text
user
organization
store
membership
role
resource
operation
```

where required.

---

# 21. Tenant Isolation

Every Store-owned operation must use the correct Store context.

Never trust a client-provided Store ID without validating membership and authorization.

Queries must not accidentally become global queries.

---

# 22. Not-Found Security

Where appropriate, unauthorized access to another tenant's resource should not reveal whether the resource exists.

Use tenant-scoped resource resolution such as:

```text
findOrder(storeId, orderId)
```

rather than exposing global existence checks.

---

# 23. Money Rules

Never represent business money using floating-point arithmetic.

Use an exact representation consistent with the database and domain model.

Examples:

```text
integer minor units
or
exact decimal representation
```

Use one consistent representation throughout a business operation.

---

# 24. Currency Rules

Every monetary value must have an explicit currency context where required.

Do not assume currency based on:

```text
browser locale
user location
display formatting
```

Currency must come from authoritative application/store configuration.

---

# 25. Time Rules

Use explicit timezone-aware timestamps where appropriate.

Do not use local server time as an implicit business rule.

Persist timestamps consistently and convert for display at the presentation boundary.

---

# 26. State Machine Rules

State transitions must be explicit.

Do not update status fields arbitrarily.

Prefer:

```text
transitionPayment(...)
transitionOrder(...)
transitionCheckout(...)
```

over:

```text
entity.status = "whatever"
```

when a domain state machine exists.

---

# 27. Transaction Rules

Transactions must be:

```text
short
explicit
purposeful
```

Do not perform slow external network operations inside database transactions.

Use transactions for operations that require atomic state changes.

---

# 28. Concurrency Rules

Assume critical business operations may execute concurrently.

Pay particular attention to:

```text
inventory
checkout
payments
orders
discount usage
idempotency
webhooks
jobs
```

Do not rely on:

```text
read
check
write
```

without considering concurrent requests.

---

# 29. Locking Rules

When row locking is required:

```text
1. Lock only necessary rows.
2. Keep lock duration short.
3. Use deterministic lock ordering.
4. Avoid external network calls while locks are held.
5. Handle transaction failures appropriately.
```

Avoid broad locks that unnecessarily reduce concurrency.

---

# 30. Idempotency Rules

Critical operations must explicitly define duplicate behavior.

An idempotency implementation must consider:

```text
same request
same key + different request
concurrent requests
successful retry
failed retry
stored response
```

Never implement idempotency using an in-memory flag.

---

# 31. External Provider Rules

External services must be isolated behind adapters or gateways.

Examples:

```text
PaymentProvider
EmailProvider
ObjectStorage
```

Business modules should not depend directly on provider-specific implementation details.

---

# 32. External Failure Rules

Assume external services can:

```text
timeout
return 4xx
return 5xx
return malformed data
rate limit
return unknown outcome
be temporarily unavailable
```

The application must handle these states explicitly.

---

# 33. Payment Rules

Payment implementation must:

```text
never trust client payment success
validate provider responses
use idempotency
support webhook confirmation
handle unknown outcomes
avoid duplicate charges
```

Payment provider credentials must remain server-side.

---

# 34. Webhook Rules

Webhook processing must:

```text
verify authenticity
prevent replay
persist the event
deduplicate
handle retries
tolerate duplicate delivery
avoid unsafe state transitions
```

Webhook handlers should not perform unrelated business work synchronously.

---

# 35. Event Rules

Events represent completed facts.

Good:

```text
OrderCreated
PaymentSucceeded
ProductPublished
```

Avoid events that secretly represent commands:

```text
PleaseCreateOrder
PleaseSendEmail
DoSomething
```

Commands should be explicit application operations or jobs.

---

# 36. Job Rules

Jobs must be:

```text
durable
idempotent
retryable
observable
bounded
```

A job handler must tolerate at-least-once execution.

---

# 37. Job Retry Rules

Retry only when the failure is potentially recoverable.

Examples:

```text
temporary provider failure → retry
network timeout → retry
invalid payload → do not blindly retry
authorization failure → do not retry indefinitely
permanent business rule failure → do not retry
```

Use bounded retry attempts and backoff.

---

# 38. Logging Rules

Logs must be structured.

Include useful context:

```text
requestId
operation
storeId
jobId
eventId
result
duration
```

Never log:

```text
passwords
tokens
session secrets
payment credentials
CVV
provider secrets
webhook secrets
```

---

# 39. Error Rules

Use meaningful application errors.

Examples:

```text
INSUFFICIENT_INVENTORY
INVALID_DISCOUNT
PAYMENT_FAILED
ORDER_NOT_FOUND
FORBIDDEN
VALIDATION_ERROR
```

Do not expose:

```text
SQL errors
stack traces
provider secrets
filesystem paths
internal credentials
```

to clients.

---

# 40. Error Classification

Errors should be classified as:

```text
Validation
Authentication
Authorization
Not Found
Conflict
Business Rule
External Dependency
Unexpected Internal Error
```

The classification determines:

```text
HTTP response
logging level
retry behavior
user-facing message
```

---

# 41. Frontend Rules

Frontend code must not become the source of truth for business rules.

The frontend may:

```text
display state
validate UX-level input
provide optimistic UI where safe
guide users
```

The server must enforce:

```text
authorization
pricing
discounts
inventory
payment
order creation
tenant isolation
```

---

# 42. Client State Rules

Do not trust client state for:

```text
price
discount amount
inventory
payment success
order status
permissions
Store ownership
```

The server must recalculate or verify authoritative values.

---

# 43. Database Migration Rules

Migrations must be:

```text
version-controlled
ordered
repeatable in new environments
reviewable
safe
```

Do not manually modify production schema outside the migration process.

---

# 44. Migration Compatibility

When required, use expand-and-contract changes:

```text
Expand
 ↓
Deploy compatible application
 ↓
Migrate data
 ↓
Switch usage
 ↓
Contract
```

Avoid migrations that require unsafe simultaneous application/database changes.

---

# 45. Seed Data Rules

Seed data must be deterministic where practical.

Never place:

```text
production credentials
real customer information
real payment information
```

in seed files.

Seeds should make local/demo verification easier without becoming hidden application dependencies.

---

# 46. Test Rules

Tests must verify behavior.

Prefer:

```text
reserveInventory_rejectsWhenInsufficientStock()
```

over tests that only verify an internal function was called.

Do not over-mock business-critical workflows.

---

# 47. Test Isolation

Tests must not depend on execution order.

Each test should create or obtain the state it requires.

Shared global mutable state should be avoided.

---

# 48. E2E Rules

E2E tests should cover critical user journeys.

Primary Demo journey:

```text
Merchant setup
 ↓
Product publication
 ↓
Customer purchase
 ↓
Payment
 ↓
Order
 ↓
Merchant management
```

Do not attempt to encode every unit-level business rule as an E2E test.

---

# 49. Dependency Rules

Before adding a package:

```text
[ ] Requirement is real
[ ] Existing package cannot reasonably solve it
[ ] Package is maintained
[ ] License is acceptable
[ ] Security risk is acceptable
[ ] Dependency belongs in the correct workspace package
```

Avoid duplicate libraries solving the same problem.

---

# 50. Configuration Rules

Configuration must be:

```text
typed
centralized
validated
environment-aware
```

Application code should not repeatedly access raw environment variables throughout the codebase.

Prefer:

```text
config.database.url
config.auth.sessionSecret
```

over scattered:

```text
process.env.SOMETHING
```

---

# 51. Secret Rules

Secrets must never be:

```text
committed
hardcoded
logged
sent to clients
included in public configuration
embedded in test fixtures
```

`.env.example` may contain variable names and safe placeholders only.

---

# 52. Production Access Rules

Development tools and AI agents must not receive unrestricted production access.

Production operations should require explicit, controlled access.

Do not place production credentials in local development environments unless there is a documented operational reason.

---

# 53. Documentation Rules

When implementation changes behavior covered by documentation:

```text
1. Identify affected documentation.
2. Update the relevant specification or ADR.
3. Keep documentation and code consistent.
```

Do not intentionally allow documentation to describe a system that no longer exists.

---

# 54. ADR Rules

Create or update an ADR when implementation introduces a meaningful architectural decision involving:

```text
architecture
data ownership
external infrastructure
major dependency
API strategy
persistence strategy
security model
scaling model
module boundary
```

Routine implementation details do not require ADRs.

---

# 55. Refactoring Rules

Refactoring must preserve behavior unless the task explicitly changes behavior.

Before refactoring:

```text
Understand current behavior
Identify tests
Identify module boundaries
Identify dependencies
```

After refactoring:

```text
Run relevant tests
Run type checking
Run linting
Review diff
```

---

# 56. Formatting Rules

Formatting should be automated.

Do not manually reformat unrelated files during feature implementation.

A feature PR should not contain massive formatting-only diffs unless formatting is itself the task.

---

# 57. Review Rules

Before considering an implementation complete, review:

```text
Correctness
Security
Tenant isolation
Authorization
Concurrency
Idempotency
Database integrity
API behavior
Error handling
Tests
Observability
Diff scope
```

---

# 58. AI Code Review Rules

AI-generated code must be treated like code written by any other contributor.

It must be reviewed for:

```text
incorrect assumptions
invented APIs
wrong imports
tenant leaks
missing authorization
race conditions
unsafe retries
incorrect transactions
dependency additions
security issues
```

Do not accept code merely because it compiles.

---

# 59. No Fake Completion

The implementation must never claim functionality that does not actually work.

Forbidden:

```text
fake payment success
hardcoded order creation
mocked inventory presented as real inventory
placeholder authentication presented as production behavior
hardcoded API responses
fake worker execution
```

Mocks are permitted only where they represent an explicitly defined external dependency boundary.

---

# 60. Verification Before Completion

A task is not complete because code was written.

Completion requires appropriate verification:

```text
Type check
Lint
Unit tests
Integration tests
API tests
Security tests
E2E tests
Build
```

Only run the levels relevant to the changed area, but critical workflows must receive appropriate broader verification.

---

# 61. Git Rules

Never:

```text
commit secrets
force-push shared branches without explicit reason
rewrite unrelated history
delete another contributor's work
commit generated junk
```

Review the diff before committing.

---

# 62. Unrelated Change Rule

If an unrelated problem is discovered during implementation:

```text
Document it
Avoid modifying it unless necessary
Create a separate task if appropriate
```

Do not expand the current task indefinitely.

---

# 63. Architecture Drift Detection

During implementation, stop when you discover:

```text
A required module does not exist
A module boundary cannot be respected
A database invariant is impossible
A critical workflow conflicts with the architecture
An external provider requires a different contract
A security requirement cannot be satisfied
```

Do not silently work around the architecture.

Escalate the architectural conflict through the documented ADR process.

---

# 64. Performance Rules

Do not optimize without evidence.

However, avoid obviously unsafe patterns:

```text
N+1 queries in critical paths
unbounded database queries
unbounded API payloads
unbounded file uploads
unbounded job concurrency
```

Use pagination and bounded operations where appropriate.

---

# 65. Security-First Implementation Rule

If convenience conflicts with a critical security boundary, security wins.

Examples:

```text
Authorization > UI convenience
Tenant isolation > query simplicity
Secret protection > debugging convenience
Payment correctness > checkout speed
Database integrity > shortcut implementation
```

---

# 66. Business-Critical Priority

When tradeoffs arise, prioritize:

```text
1. Correctness
2. Security
3. Data integrity
4. Tenant isolation
5. Payment/inventory safety
6. Maintainability
7. Observability
8. Performance
9. Convenience
```

The order matters.

---

# 67. Final Rule

Every implementation should leave the codebase:

```text
More functional
More verified
No less secure
No less modular
No more complex than necessary
```

The implementation is successful when the code follows the architecture rather than forcing the architecture to explain away the code.