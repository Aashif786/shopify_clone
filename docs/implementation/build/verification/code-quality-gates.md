# Code Quality Gates

## 1. Purpose

This document defines the mandatory code-quality gates for the Demo implementation.

The purpose is to ensure that code entering the repository is:

- Correct.
- Type-safe.
- Maintainable.
- Testable.
- Secure.
- Consistent with the approved architecture.
- Free from unnecessary complexity.
- Safe to evolve toward V1.

A passing quality gate does not prove that the business feature is correct. It proves that the implementation satisfies the project's baseline engineering standards.

---

# 2. Quality Gate Model

Every implementation should pass:

```text id="x7m4r8"
Architecture
   ↓
Type Safety
   ↓
Static Analysis
   ↓
Formatting
   ↓
Tests
   ↓
Security
   ↓
Dependency Review
   ↓
Diff Review
```

Critical business functionality additionally requires:

```text id="q5r8m4"
Concurrency
Idempotency
Tenant Isolation
Database Integrity
Payment Correctness
```

---

# 3. Gate Severity

Quality findings are classified as:

| Severity | Meaning | Release Impact |
|---|---|---|
| Blocker | Unsafe or fundamentally broken | Must fix |
| Critical | Security/data/financial correctness issue | Must fix |
| High | Significant correctness or maintainability issue | Must fix |
| Medium | Important quality issue | Usually fix before release |
| Low | Minor improvement | May defer with justification |

Security, tenant-isolation, payment, data-integrity, and duplicate-transaction issues are automatically release-blocking.

---

# 4. Architecture Compliance

Every change must preserve the approved modular-monolith architecture.

Verify:

```text id="v8m5r4"
Presentation
   ↓
Application
   ↓
Domain
   ↓
Infrastructure
```

A change must not introduce:

- Unapproved services.
- Direct database access across module boundaries.
- Circular module dependencies.
- Provider-specific logic inside domain code.
- Business rules inside UI components.

---

# 5. Module Boundary Gate

Each domain must access another domain through approved public interfaces.

Incorrect:

```text id="m6q4r8"
Orders
  ↓
Products internal repository
```

Correct:

```text id="x5r8m4"
Orders
  ↓
Products public application interface
```

Direct access to another module's internal implementation is a quality-gate failure.

---

# 6. Layering Gate

Verify responsibilities:

### Presentation

Responsible for:

```text id="q7m4r6"
HTTP
Request parsing
DTOs
Response mapping
Authentication context
```

### Application

Responsible for:

```text id="v5m8r4"
Use cases
Transactions
Authorization coordination
Idempotency
Domain orchestration
```

### Domain

Responsible for:

```text id="m4q7r5"
Business rules
State transitions
Invariants
Value objects
Domain behavior
```

### Infrastructure

Responsible for:

```text id="x8r5m4"
Database
External providers
Object storage
Runtime integrations
```

---

# 7. TypeScript Gate

TypeScript must run in strict mode.

Required:

```text id="q6m4r8"
No unexpected type errors
No unsafe implicit any
No unnecessary any
No invalid casts
No ignored compiler errors
```

Avoid:

```text id="v7r5m4"
as any
@ts-ignore
```

unless explicitly justified.

---

# 8. Type Precision

Public functions should have explicit types where inference does not sufficiently communicate the contract.

Avoid vague structures such as:

```text id="m5q8r4"
Record<string, any>
```

when a meaningful domain type can be defined.

Prefer:

```text id="x4r7m6"
CreateOrderInput
OrderDetails
PaymentResult
```

over unstructured objects.

---

# 9. Nullability

Nullable values must be handled explicitly.

Do not use:

```text id="q8m4r5"
!
```

to silence uncertainty without establishing why the value must exist.

Important business fields should be validated before use.

---

# 10. Error Handling Gate

Errors must follow the shared application error model.

Expected business errors should be represented explicitly.

Examples:

```text id="v6r4m8"
InventoryUnavailable
PaymentFailed
OrderNotFound
Unauthorized
InvalidDiscount
```

Do not expose:

```text id="m7q5r4"
Database errors
Stack traces
Provider secrets
Internal paths
SQL statements
```

to customers.

---

# 11. Error Taxonomy

Every important failure should fall into a meaningful category:

```text id="x8r4m5"
Validation
Authentication
Authorization
Not Found
Conflict
Business Rule
External Dependency
Infrastructure
Unexpected
```

Avoid generic:

```text id="q5m7r4"
Something went wrong
```

as the internal classification.

---

# 12. Validation Gate

Validate external input at the boundary.

Required for:

```text id="v4r8m6"
Request bodies
Path parameters
Query parameters
Headers
Webhook payloads
File metadata
Configuration
Job payloads
```

Validation must not replace domain business rules.

---

# 13. Authorization Gate

Authentication proves identity.

Authorization proves permission.

Every protected mutation must verify:

```text id="m6q4r8"
Identity
+
Tenant/Store context
+
Role/permission
+
Resource ownership
```

Frontend visibility is never considered sufficient authorization.

---

# 14. Tenant Isolation Gate

Every Store-owned resource must be properly scoped.

Review:

```text id="x5r8m4"
Queries
Mutations
Repositories
Services
Jobs
Events
Caches
Media
Notifications
Webhooks
```

A missing Store filter in a sensitive query is a critical defect.

---

# 15. Database Access Gate

Database queries must follow ownership rules.

Verify:

- Correct module owns the query.
- Tenant scoping is applied.
- Transactions are explicit.
- Queries are parameterized.
- Expected constraints exist.
- N+1 behavior is avoided in important paths.

---

# 16. Transaction Gate

Transactions must exist at the application use-case boundary where multiple related mutations require atomicity.

Verify:

```text id="q7m5r4"
Correct transaction scope
Short transaction duration
Consistent lock ordering
No unnecessary external network call
```

Do not wrap an entire request in a transaction by default.

---

# 17. External Call Gate

Do not hold critical database locks while waiting for:

```text id="v8r4m6"
Payment provider
Email provider
Object storage
External API
```

Use a safe workflow involving persisted state and retries where required.

---

# 18. Money Gate

Monetary values must never use floating-point arithmetic.

Review:

```text id="m5q4r8"
Product prices
Cart totals
Discounts
Checkout totals
Payments
Orders
Refunds
```

Rounding rules must be explicit.

---

# 19. Time Gate

Time handling must be explicit and consistent.

Avoid mixing:

```text id="x6r8m4"
Local time
Server time
UTC
Provider timestamps
```

without conversion rules.

Persist timestamps using the project's approved database representation.

---

# 20. State Machine Gate

Important lifecycle states must have explicit transition rules.

Examples:

```text id="q4m8r5"
Store
Product
Cart
Checkout
Payment
Order
Inventory Reservation
Job
Webhook
```

Do not permit arbitrary status mutation.

---

# 21. Idempotency Gate

Critical operations must define retry behavior.

Review:

```text id="v7r4m6"
Checkout
Payment
Refund
Order creation
Inventory adjustment/reservation
Webhook processing
Background jobs
```

A retry must not create duplicate financial or business state.

---

# 22. Concurrency Gate

Concurrency-sensitive operations require explicit analysis.

Review:

```text id="m8q4r5"
Inventory
Checkout completion
Payment completion
Order transitions
Cart mutations
Discount usage
Job claiming
```

Verify:

```text id="x5r7m4"
Locks
Constraints
Atomic updates
Idempotency
Conflict handling
```

are used appropriately.

---

# 23. Database Constraint Gate

Important business invariants should have database defense where practical.

Examples:

```text id="q6m4r8"
Unique Store slug
Unique Variant SKU within scope
Unique Cart Item per Variant
Unique Order number
Unique Checkout-to-Order relationship
Unique webhook event
Unique idempotency key
```

Do not rely entirely on application checks for invariants vulnerable to concurrent writes.

---

# 24. API Quality Gate

API implementation must provide:

```text id="v8r5m4"
Stable paths
Explicit DTOs
Validation
Authorization
Consistent errors
Correct HTTP semantics
Pagination
Idempotency where required
OpenAPI alignment
```

Avoid exposing database models directly.

---

# 25. API Compatibility

Existing API behavior must not be changed accidentally.

Before changing an API:

```text id="m4q8r6"
Identify consumers
Review contract
Assess compatibility
Update tests
Update OpenAPI
```

Breaking changes require explicit approval.

---

# 26. Frontend Quality Gate

Frontend code must:

- Handle loading states.
- Handle expected errors.
- Prevent uncontrolled repeated submissions.
- Respect server authority.
- Avoid duplicating business rules.
- Avoid exposing secrets.
- Keep components focused.
- Maintain accessibility where practical.

---

# 27. Server Authority Gate

The browser must never be trusted for:

```text id="x7r4m5"
Price
Discount amount
Inventory quantity
Payment success
Order total
Authorization
Tenant ownership
```

The server remains authoritative.

---

# 28. Logging Gate

Logs should contain useful operational context.

For important operations include appropriate:

```text id="q5m8r4"
requestId
storeId
userId where appropriate
operation
result
duration
```

Never log:

```text id="v6r7m5"
Passwords
Tokens
Session secrets
Payment credentials
Webhook secrets
Private keys
```

---

# 29. Observability Gate

Critical workflows should produce enough telemetry to diagnose failure.

Verify observability for:

```text id="m8q4r5"
HTTP requests
Database failures
Payments
Webhooks
Jobs
Checkout
Orders
External providers
```

---

# 30. Testing Gate

Every meaningful business change must include appropriate tests.

At minimum:

```text id="x4r8m5"
Unit tests
Integration tests where persistence matters
API tests where contracts change
E2E tests for critical user flows
```

Not every function needs a test. Every important behavior does.

---

# 31. Test Quality

Tests should:

- Verify observable behavior.
- Be deterministic.
- Avoid unnecessary mocks.
- Use isolated test data.
- Clean up state.
- Clearly identify failures.

Avoid tests that merely reproduce implementation details.

---

# 32. Critical Path Testing

The following areas require stronger testing:

```text id="q7m5r4"
Authentication
Authorization
Tenant isolation
Inventory
Checkout
Payments
Orders
Webhooks
Idempotency
Concurrency
```

These areas should not rely solely on unit tests.

---

# 33. Test Naming

Tests should communicate:

```text id="v5r8m4"
Given/when/then behavior
```

Example:

```text id="m6q4r8"
should reject checkout when inventory is unavailable
```

rather than:

```text id="x8r5m4"
test1
```

---

# 34. Dependency Gate

New dependencies require justification.

Before adding a package, evaluate:

```text id="q4m7r5"
Necessity
Security
Maintenance
License
Bundle/runtime impact
Existing alternatives
Architecture impact
```

Do not add dependencies for trivial functionality already supported by the platform or existing packages.

---

# 35. Provider SDK Gate

Provider SDKs must remain isolated behind adapters.

For example:

```text id="v7m4r6"
Payments
 ↓
Provider Adapter
 ↓
Provider SDK
```

Domain code should not depend directly on the SDK.

---

# 36. Database Migration Gate

Every schema change must include an appropriate migration.

Verify:

```text id="m5q8r4"
Migration is versioned
Migration is reproducible
Migration matches schema intent
Indexes/constraints are included
Rollback/forward-repair strategy is understood
```

Never modify an already-applied migration casually.

---

# 37. Seed Gate

Seed changes must remain separate from schema migrations.

Verify:

```text id="x6r4m8"
Safe environment
Deterministic data
Idempotent behavior where required
No production data destruction
```

---

# 38. Configuration Gate

Configuration must be centralized.

Avoid:

```text id="q8m5r4"
process.env.X
```

scattered throughout the codebase.

Prefer the shared typed configuration layer.

---

# 39. Secret Gate

Never commit:

```text id="v4r8m6"
.env
API keys
Cloud credentials
Database passwords
Payment secrets
Private keys
```

Only safe placeholders belong in `.env.example`.

---

# 40. Dependency Direction Gate

The approved direction must remain:

```text id="m7q4r5"
apps
  ↓
packages/modules

modules
  ↓
shared packages + approved public interfaces

packages
  ↓
lower-level dependencies
```

Lower-level packages must not depend upward on application modules.

---

# 41. Circular Dependency Gate

No new circular dependencies may be introduced.

Check both:

```text id="x5r8m4"
Package dependencies
Module dependencies
```

A circular dependency usually indicates a boundary problem rather than something to silence with tooling.

---

# 42. Code Duplication Gate

Avoid duplicated business logic.

Especially review:

```text id="q6m4r8"
Pricing
Discounts
Authorization
Tenant resolution
Money calculation
State transitions
Validation
```

Shared logic should be extracted only when it represents a real stable concept.

Do not create generic abstractions merely because two files look similar.

---

# 43. Function Complexity Gate

Functions should have one clear responsibility.

Review functions that:

- Perform many unrelated operations.
- Contain deeply nested conditions.
- Mix HTTP, database, business logic, and provider calls.
- Handle multiple unrelated states.

Split responsibilities along meaningful application/domain boundaries.

---

# 44. File Complexity Gate

Large files should be reviewed for responsibility boundaries.

Do not split files mechanically.

A file should be divided when it contains multiple distinct responsibilities that can evolve independently.

---

# 45. Naming Gate

Names must clearly describe intent.

Prefer:

```text id="v8r4m5"
createCheckout
reserveInventory
completeCheckout
processPaymentWebhook
```

over:

```text id="m4q7r8"
handleData
process
doThing
execute
```

Avoid ambiguous abbreviations.

---

# 46. Comments Gate

Comments should explain:

- Why unusual logic exists.
- Important business constraints.
- Concurrency decisions.
- Provider limitations.
- Security-sensitive reasoning.

Do not use comments to explain obvious code.

---

# 47. TODO Gate

New TODOs must not hide incomplete critical functionality.

Bad:

```text id="x5r8m4"
// TODO: implement payment validation
```

when payment validation is required for the current feature.

Allowed TODOs should be:

- Explicitly non-blocking.
- Scoped.
- Understandable.
- Tracked where appropriate.

---

# 48. Fake Implementation Gate

Production paths must not contain fake success behavior.

Reject implementations such as:

```text id="q7m4r5"
return { success: true }
```

when the real operation has not happened.

Do not use:

- Hardcoded payment success.
- Fake Order IDs.
- Fake inventory confirmation.
- Static customer data.
- Placeholder API responses.

Mock behavior belongs in tests, not production paths.

---

# 49. AI-Generated Code Gate

AI-generated code receives the same review standard as human-written code.

Verify:

```text id="v6m8r4"
Architecture
Types
Security
Tenant isolation
Concurrency
Idempotency
Tests
Dependencies
Diff scope
```

Never accept code simply because an AI agent generated it without errors.

---

# 50. AI Scope Gate

AI implementation must not:

- Invent new services.
- Add Redis without requirement.
- Add Kafka without requirement.
- Introduce microservices.
- Add a search engine prematurely.
- Rewrite unrelated modules.
- Change approved architecture without an ADR.
- Modify production configuration unnecessarily.

---

# 51. Diff Review Gate

Every implementation must be reviewed through the final Git diff.

Check:

```text id="m5q8r4"
Expected files changed
No unrelated files
No accidental formatting explosion
No generated junk
No secrets
No debug statements
No commented-out implementation
No unexpected dependency changes
```

---

# 52. Debug Code Gate

Before merge, remove:

```text id="x4r8m6"
console.log
Temporary debug endpoints
Hardcoded test credentials
Development-only bypasses
Disabled authorization
Temporary feature flags
```

unless intentionally required by the final implementation.

---

# 53. Performance Quality Gate

Do not optimize prematurely.

Do detect obvious structural problems:

```text id="q8m4r5"
Unbounded queries
Unbounded result sets
Repeated database calls in loops
Blocking external calls
Excessive serialization
Unbounded worker concurrency
```

Correct architecture is more important than speculative micro-optimization for Demo.

---

# 54. Accessibility Gate

Customer and merchant UI should verify:

```text id="v7r5m4"
Keyboard navigation
Form labels
Button semantics
Error visibility
Focus handling
Readable text
Accessible loading states
```

Critical purchase actions must remain usable without relying solely on visual indicators.

---

# 55. Responsive UI Gate

Verify critical workflows at supported viewport sizes:

```text id="m6q4r8"
Storefront
Product
Cart
Checkout
Payment
Order confirmation
Merchant Orders
```

Responsive problems must not hide or disable important purchase controls.

---

# 56. Documentation Gate

When implementation changes an approved contract or architecture, update the relevant documentation.

Examples:

```text id="x5r8m4"
API change
→ API documentation

Schema change
→ Database documentation

Architecture change
→ ADR

Feature behavior
→ Feature specification
```

Do not leave implementation and documentation contradicting each other.

---

# 57. Commit Gate

Commits should be:

- Focused.
- Understandable.
- Related to the implementation.
- Free of secrets.
- Free of unrelated refactoring.

Avoid combining:

```text id="q7m5r4"
Feature
+
mass formatting
+
dependency upgrades
+
unrelated refactor
```

in one change.

---

# 58. Pull Request Gate

A PR should make it possible to understand:

```text id="v8r4m6"
What changed
Why it changed
How it was implemented
What was tested
Known limitations
```

The PR should identify any intentional architecture or behavior changes.

---

# 59. Release Gate

Before release, all critical quality gates must pass:

```text id="m4q8r5"
Typecheck
Lint
Format
Build
Tests
Security
Tenant isolation
Concurrency
Idempotency
Database integrity
E2E
```

Any unresolved critical issue blocks release.

---

# 60. Quality Gate Execution Order

Use:

```text id="x6r4m8"
1. Architecture review
2. Typecheck
3. Lint
4. Formatting
5. Unit tests
6. Integration tests
7. API tests
8. Security tests
9. Concurrency/idempotency tests
10. Build
11. E2E
12. Dependency/security review
13. Git diff review
14. Documentation review
```

---

# 61. Quality Gate Definition of Done

A change passes the code-quality gate when:

```text id="q5m8r4"
[ ] Architecture boundaries preserved
[ ] Module ownership preserved
[ ] TypeScript passes
[ ] No unjustified any/ignores
[ ] Validation is present
[ ] Authorization is server-side
[ ] Tenant isolation is preserved
[ ] Transactions are appropriate
[ ] Money handling is exact
[ ] State transitions are explicit
[ ] Idempotency is implemented where required
[ ] Concurrency behavior is understood
[ ] Database constraints are appropriate
[ ] API contracts remain correct
[ ] Tests cover meaningful behavior
[ ] Security tests pass
[ ] Dependencies are justified
[ ] No secrets exist
[ ] No fake production behavior exists
[ ] AI-generated code has been reviewed
[ ] Final Git diff is clean
[ ] Relevant documentation is current
```

---

# 62. Final Quality Principle

The quality gate exists to prevent a deceptively common failure:

```text id="v7m4r6"
"It works on my machine."
```

The required standard is:

```text id="m5q8r4"
It works
+
It is type-safe
+
It respects architecture
+
It preserves tenant isolation
+
It handles failure
+
It handles retries
+
It handles concurrency
+
It is tested
+
It is observable
+
It is maintainable
```

That is the minimum acceptable engineering standard for the Demo and the foundation from which V1 can evolve without a rewrite.