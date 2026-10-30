# Build Strategy

## 1. Purpose

This document defines the implementation strategy for building the Cal Cart Demo from the approved architecture, product requirements, domain specifications, and Stage 7 execution plan.

The goal is to convert the documented design into a working codebase while preserving:

- Domain ownership.
- Module boundaries.
- Tenant isolation.
- Authorization.
- Database integrity.
- Transaction correctness.
- Idempotency.
- Payment correctness.
- Inventory correctness.
- Testability.
- Future V1 evolution.

The Demo is a **real functional commerce platform**, not a UI-only prototype.

---

# 2. Build Philosophy

Implementation follows five principles:

```text
Build the smallest correct system
        ↓
Preserve architectural boundaries
        ↓
Implement complete vertical behavior
        ↓
Verify continuously
        ↓
Improve only when evidence requires it
```

The implementation must not attempt to build the entire future V1 infrastructure during Demo development.

---

# 3. Source of Truth Hierarchy

When implementation decisions conflict, use this order:

```text
1. AGENTS.md
2. Approved architecture documentation
3. Product requirements
4. Domain specifications
5. Implementation specifications
6. Stage 7 execution documentation
7. Existing code and established implementation patterns
8. Individual task instructions
```

Lower-level implementation decisions must not silently override higher-level architectural requirements.

If an existing implementation conflicts with an approved architectural rule, the conflict must be identified and resolved explicitly rather than copied forward.

---

# 4. Demo Definition

The Demo must support a complete commerce lifecycle:

```text
Merchant
    ↓
Authentication
    ↓
Organization / Store
    ↓
Store Configuration
    ↓
Product Creation
    ↓
Inventory
    ↓
Product Publication
    ↓
Customer Storefront
    ↓
Cart
    ↓
Checkout
    ↓
Payment
    ↓
Order
    ↓
Merchant Order Management
```

The system must persist real state throughout this lifecycle.

---

# 5. Implementation Architecture

The Demo uses a modular monolith.

```text
apps/
├── web
└── worker

modules/
├── stores
├── products
├── inventory
├── customers
├── carts
├── discounts
├── checkout
├── payments
└── orders

packages/
├── auth
├── config
├── db
├── event-bus
├── tenant
├── types
├── ui
└── validation
```

The implementation must preserve this ownership structure.

---

# 6. Application Layering

Each business module should follow the established layering model:

```text
Presentation
     ↓
Application
     ↓
Domain
     ↓
Infrastructure
```

Responsibilities:

### Presentation

Handles:

- HTTP requests.
- Route parameters.
- Request parsing.
- Response formatting.
- Authentication context.
- Input validation.

Presentation code must remain thin.

### Application

Handles:

- Use cases.
- Authorization decisions requiring application context.
- Transaction boundaries.
- Coordination between modules.
- Repository orchestration.
- Idempotency.

### Domain

Handles:

- Business rules.
- State transitions.
- Domain invariants.
- Value objects.
- Domain events.

### Infrastructure

Handles:

- PostgreSQL.
- Object storage.
- Payment provider adapters.
- Email adapters.
- External APIs.
- Persistence implementations.

---

# 7. Build Order

Implementation follows dependency order.

```text
Repository
    ↓
Shared Packages
    ↓
Web / Worker Bootstrap
    ↓
Configuration
    ↓
Database
    ↓
Authentication
    ↓
Tenant Context
    ↓
API Foundation
    ↓
Stores
    ↓
Products
    ↓
Inventory
    ↓
Customers
    ↓
Carts
    ↓
Discounts
    ↓
Checkout
    ↓
Payments
    ↓
Orders
    ↓
Storefront
    ↓
Media
    ↓
Notifications
    ↓
Webhooks
    ↓
Jobs
    ↓
Vertical Slices
    ↓
Full Verification
    ↓
Demo Release
```

Dependencies must be implemented before consumers rely on them.

---

# 8. Foundation-First Rule

The following must be stable before substantial domain implementation begins:

```text
Repository structure
Package boundaries
TypeScript configuration
Workspace configuration
Environment configuration
Database connection
Migration system
Testing infrastructure
Logging
Error handling
Authentication foundation
Tenant context
API foundation
```

Domain modules should not create their own incompatible versions of these concerns.

---

# 9. Vertical Slice Rule

Although implementation follows dependency order, functionality must ultimately be validated through complete vertical slices.

A vertical slice should cross:

```text
API
 ↓
Application Service
 ↓
Domain
 ↓
Database
 ↓
Related Integration
 ↓
Verification
```

For example:

```text
Create Product
    ↓
HTTP API
    ↓
Product Application Service
    ↓
Product Domain
    ↓
PostgreSQL
    ↓
Integration Test
```

This prevents a situation where every layer exists but the system does not actually work.

---

# 10. Smallest Correct Implementation

Each implementation task should solve the smallest complete requirement.

Prefer:

```text
Implement Product creation correctly
```

over:

```text
Build a generalized product architecture for every future product model
```

Prefer:

```text
Implement required inventory reservation
```

over:

```text
Build a distributed inventory service
```

The Demo should optimize for correctness and clarity, not speculative scale.

---

# 11. No Premature Infrastructure

Do not introduce infrastructure merely because a future V1 architecture might use it.

Examples that should not be added without an actual requirement:

```text
Redis
Kafka
RabbitMQ
Dedicated search service
Microservices
Kubernetes
Service mesh
Distributed tracing infrastructure
Separate analytics warehouse
Terraform
Multi-region deployment
Database sharding
```

PostgreSQL-backed jobs are sufficient for the Demo.

---

# 12. Business-Critical Correctness

Infrastructure may be simplified.

Business correctness may not.

The following require production-quality behavior even in Demo:

```text
Tenant isolation
Authorization
Inventory concurrency
Payment state
Payment idempotency
Checkout correctness
Order creation
Refund correctness
Webhook verification
Database integrity
Historical order data
```

A Demo shortcut must never turn one of these into a fake or unsafe implementation.

---

# 13. Database-First Integrity

PostgreSQL is the authoritative transactional source of truth.

Use:

```text
Foreign keys
Unique constraints
Check constraints
Indexes
Transactions
Row locking
Idempotency constraints
Store-scoped uniqueness
```

Application validation should provide useful errors, while database constraints provide the final integrity boundary.

---

# 14. Transaction Strategy

Application services own transaction boundaries.

Typical pattern:

```text
Request
  ↓
Application Service
  ↓
BEGIN
  ↓
Domain operations
  ↓
Repository operations
  ↓
State changes
  ↓
COMMIT
```

Do not hold database transactions open while waiting for external network calls.

For operations requiring external providers:

```text
Database state
    ↓
External provider interaction
    ↓
Webhook/reconciliation
    ↓
Final database state
```

The exact workflow must follow the relevant payment or integration specification.

---

# 15. Module Ownership

Every persistent business concept has one owning module.

Examples:

| Concept | Owner |
|---|---|
| Store | Stores |
| Membership | Stores |
| Product | Products |
| Variant | Products |
| Inventory | Inventory |
| Customer | Customers |
| Cart | Carts |
| Discount | Discounts |
| Checkout | Checkout |
| Payment | Payments |
| Order | Orders |

Other modules interact through approved public interfaces.

---

# 16. Cross-Module Access

Do not allow:

```text
Module A
    ↓
Module B internal repository
```

Prefer:

```text
Module A
    ↓
Module B public application interface
```

or:

```text
Module A
    ↓
Domain Event
    ↓
Module B
```

depending on whether the interaction is synchronous or asynchronous.

---

# 17. Synchronous vs Asynchronous Behavior

Use synchronous execution when the result is required for the current transaction.

Examples:

```text
Validate Product
Check Inventory
Reserve Inventory
Calculate Discount
Create Order
Record Payment State
```

Use asynchronous processing for secondary effects.

Examples:

```text
Send Email
Process Notification
Cleanup Media
Retry External Delivery
Non-critical Background Work
```

Never make a critical business invariant depend on an eventually processed secondary job when it can be enforced transactionally.

---

# 18. Event Strategy

Events represent facts:

```text
ProductPublished
InventoryReserved
PaymentSucceeded
OrderCreated
OrderCancelled
```

Events must not be used as arbitrary command messages.

A consumer must be able to determine what happened from the event contract.

Events should contain only the data required by consumers.

---

# 19. Job Strategy

Jobs represent work:

```text
SendOrderEmail
ProcessWebhook
RetryNotification
CleanupExpiredMedia
RecoverStaleJob
```

Jobs must be:

```text
Durable
Retryable
Idempotent
Observable
Bounded
```

The Worker processes them using PostgreSQL-backed job storage.

---

# 20. Idempotency Strategy

Critical operations must define explicit idempotency behavior.

At minimum:

```text
Checkout completion
Payment creation
Refunds
Order creation
Webhook processing
Critical inventory operations
Critical jobs
```

The implementation must define:

```text
Idempotency key
Operation identity
Request fingerprint where required
Stored result
Duplicate behavior
Concurrent request behavior
```

Do not implement idempotency merely by checking whether a request happened previously.

Concurrent requests must be safe.

---

# 21. Inventory Strategy

Inventory must be implemented with concurrency in mind from the beginning.

Required principles:

```text
Never trust client stock values
Use transactional updates
Prevent negative inventory
Lock consistently
Maintain reservation state
Support release
Support finalization
Record inventory movements where required
```

Test the final-unit race explicitly.

---

# 22. Payment Strategy

Payment implementation must separate:

```text
Application payment state
Provider payment state
Payment attempts
Webhook events
Refunds
Idempotency
```

Never treat a browser response as authoritative proof of successful payment.

Provider-confirmed state must drive the final payment outcome.

---

# 23. Checkout Strategy

Checkout is the orchestration boundary for purchase completion.

It must coordinate:

```text
Cart
Product pricing
Discounts
Inventory
Payment
Order
```

Checkout must recalculate authoritative values.

Client-provided:

```text
price
discount
total
inventory
payment status
```

must never be trusted as authoritative business state.

---

# 24. Order Strategy

Orders represent durable completed purchase history.

Once created, historical information must be preserved.

Order records should contain the required snapshots of:

```text
Product information
Variant information
Price
Quantity
Customer information
Shipping/billing information where applicable
Discount information
```

Current Product or Customer changes must not rewrite historical Order data.

---

# 25. API Implementation Strategy

Use versioned business-capability APIs:

```text
/api/v1/*
```

Routes should map to application use cases.

Avoid:

```text
database CRUD → automatic API
```

The API should express business operations rather than exposing database structure.

---

# 26. Validation Strategy

Validate at boundaries.

Examples:

```text
HTTP input
Webhook payload
Environment configuration
External provider responses
File uploads
Job payloads
```

Use shared validation utilities where appropriate.

Business rules remain inside the owning domain rather than inside generic validation schemas.

---

# 27. Authorization Strategy

Authorization must occur server-side.

Typical request flow:

```text
Authenticate
    ↓
Resolve Organization/Store
    ↓
Resolve Membership
    ↓
Check Permission
    ↓
Execute Application Service
```

Never depend on:

```text
hidden UI controls
client-side role checks
client-provided store IDs
```

---

# 28. Tenant Context Strategy

Store context must be explicit.

Application services should receive the tenant/store context required for the operation.

Database queries involving Store-owned resources must use appropriate Store scoping.

Avoid implicit global tenant state.

---

# 29. Error Strategy

Errors must be meaningful and stable.

Separate:

```text
Validation Errors
Authorization Errors
Not Found
Business Rule Violations
Conflict
External Provider Failure
Unexpected Internal Error
```

Do not expose infrastructure exceptions directly through the API.

---

# 30. Observability Strategy

Every significant request or job should provide enough context to diagnose failures.

Use structured logging with safe fields such as:

```text
requestId
correlationId
storeId
userId where appropriate
jobId
eventId
operation
status
duration
```

Never log secrets or sensitive payment credentials.

---

# 31. Testing Strategy

Implementation proceeds with tests continuously.

Minimum layers:

```text
Unit
Integration
API
Database
Security
Worker
Webhook
E2E
```

Business-critical behavior receives higher testing priority.

Particular attention must be given to:

```text
Inventory concurrency
Checkout idempotency
Payment idempotency
Webhook replay
Tenant isolation
Authorization
Order creation
Transaction rollback
```

---

# 32. Test-Driven Boundaries

Tests should validate behavior at the boundary being implemented.

For example:

```text
Domain test
→ Business rule

Integration test
→ Database/module interaction

API test
→ HTTP contract + authorization

E2E test
→ Complete user workflow
```

Do not use E2E tests to compensate for missing lower-level coverage.

---

# 33. Implementation Task Structure

Every implementation task should contain:

```text
Objective
Relevant specification
Affected modules
Required interfaces
Database changes
API changes
Business rules
Security considerations
Concurrency considerations
Idempotency considerations
Tests
Definition of Done
```

The task should identify the smallest set of files and modules expected to change.

---

# 34. AI-Assisted Implementation

AI tools are implementation assistants.

Before modifying code, the agent must:

```text
1. Read AGENTS.md from the actual filesystem.
2. Read relevant architecture documents.
3. Read the relevant domain specification.
4. Read the relevant implementation specification.
5. Inspect existing code.
6. Identify established project patterns.
7. Implement the smallest safe change.
8. Run relevant verification.
9. Inspect the resulting diff.
```

The agent must not rely on remembered project context when repository instructions can be read directly.

---

# 35. AI Implementation Restrictions

AI-assisted implementation must not:

```text
Invent new architecture without justification
Create unnecessary services
Introduce unnecessary dependencies
Bypass module boundaries
Bypass tenant checks
Disable authorization
Ignore database constraints
Replace real business logic with placeholders
Fake successful integrations
Silently weaken tests
Modify unrelated files
Commit secrets
Change architecture documentation merely to justify code
```

If the required implementation conflicts with the documented architecture, stop and identify the conflict rather than silently redesigning the system.

---

# 36. Dependency Discipline

Before adding a dependency:

```text
1. Confirm the requirement.
2. Check whether existing packages solve it.
3. Check compatibility with the workspace.
4. Check maintenance/security considerations.
5. Keep the dependency within the appropriate package/module.
```

Do not add a dependency merely because an AI-generated implementation uses it.

---

# 37. Git Strategy

Implementation should use focused branches.

Recommended pattern:

```text
main
  │
  ├── feature/foundation
  ├── feature/auth
  ├── feature/products
  ├── feature/inventory
  └── ...
```

Each branch should represent a coherent implementation unit.

Avoid large unrelated commits.

---

# 38. Commit Strategy

Commits should be small enough to review and meaningful enough to revert.

Examples:

```text
feat(stores): implement store creation
feat(products): add product creation
feat(inventory): implement stock adjustment
feat(checkout): add checkout creation
fix(payments): handle duplicate webhook
test(inventory): add concurrent reservation coverage
```

Do not mix:

```text
feature implementation
+
unrelated refactor
+
formatting entire repository
```

in one commit.

---

# 39. Definition of Done for an Implementation Task

A task is complete only when:

```text id="3k7h1d"
[ ] Required code exists
[ ] Module ownership is preserved
[ ] Tenant isolation is preserved
[ ] Authorization is implemented
[ ] Validation is implemented
[ ] Database changes are migrated
[ ] Relevant tests exist
[ ] Critical concurrency behavior is covered
[ ] Idempotency is implemented where required
[ ] Errors are handled correctly
[ ] Logging is safe
[ ] Type checking passes
[ ] Linting passes
[ ] Relevant tests pass
[ ] Build passes where applicable
[ ] Git diff contains only intended changes
```

---

# 40. Build Verification Loop

Every meaningful implementation unit follows:

```text
Read
 ↓
Implement
 ↓
Format
 ↓
Type Check
 ↓
Lint
 ↓
Unit/Integration Tests
 ↓
Review Diff
 ↓
Fix
 ↓
Repeat
```

Do not defer all verification until the end of the project.

---

# 41. Vertical-Slice Completion

A vertical slice is complete only when:

```text
API
 ↓
Application
 ↓
Domain
 ↓
Persistence
 ↓
Integration
 ↓
Tests
```

works together.

A partially implemented endpoint should not be counted as a completed business capability merely because the route exists.

---

# 42. Demo Scope Protection

During implementation, continuously distinguish between:

```text
Required for Demo
```

and:

```text
Future V1
```

Future requirements may be documented, but should not be implemented prematurely unless they are required to keep the Demo architecture correct.

Examples:

```text
Demo:
PostgreSQL-backed jobs

Future V1:
Redis/queue infrastructure if justified

Demo:
Basic product listing

Future V1:
Dedicated search infrastructure

Demo:
Single VPS deployment

Future V1:
Horizontal scaling / HA
```

---

# 43. Refactoring Rule

Refactor when:

```text
Correctness requires it
A repeated pattern creates measurable maintenance risk
A module boundary is being violated
Tests reveal architectural coupling
Performance evidence justifies it
Security requires it
```

Do not refactor simply because a different architecture appears theoretically cleaner.

---

# 44. Architecture Change Rule

If implementation reveals that an approved architectural decision is incorrect:

```text
Identify problem
    ↓
Document evidence
    ↓
Evaluate alternatives
    ↓
Create/update ADR
    ↓
Update affected specifications
    ↓
Implement approved change
```

Do not silently modify architecture through code.

---

# 45. Build Completion Criteria

The implementation phase is successful when:

```text
[ ] Foundation is operational
[ ] Database is operational
[ ] Authentication works
[ ] Tenant isolation works
[ ] Stores work
[ ] Products work
[ ] Inventory works
[ ] Customers work
[ ] Carts work
[ ] Discounts work
[ ] Checkout works
[ ] Payments work
[ ] Orders work
[ ] Storefront works
[ ] Media works
[ ] Notifications work
[ ] Webhooks work
[ ] Jobs work
[ ] Vertical slices pass
[ ] Security verification passes
[ ] Integration verification passes
[ ] E2E purchase flow passes
[ ] CI passes
[ ] Demo deployment passes
```

---

# 46. Final Build Principle

The implementation should leave the project in this state:

```text
Simple enough to understand
        +
Correct enough to trust
        +
Modular enough to extend
        +
Tested enough to demonstrate
        +
Structured enough to evolve
```

The Demo is not expected to have V1 infrastructure.

It is expected to have **V1-quality discipline around the business-critical parts of the system**.