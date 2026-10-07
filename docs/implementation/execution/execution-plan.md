# Execution Plan

## 1. Purpose

This document defines the execution strategy for implementing the Demo from the completed architecture, specifications, and implementation-readiness documentation.

Stage 7 is the transition from **what the system should be** to **how the repository will actually be built**.

The implementation must follow the documented architecture rather than creating a second architecture during coding.

---

# 2. Implementation Objective

The objective is to deliver a working Demo that supports the complete commerce lifecycle:

```text
Merchant
   ↓
Authentication
   ↓
Store
   ↓
Products
   ↓
Inventory
   ↓
Storefront
   ↓
Customer
   ↓
Cart
   ↓
Checkout
   ↓
Payment
   ↓
Order
   ↓
Notification / Background Processing
```

The implementation must preserve:

- Tenant isolation.
- Authorization.
- Database integrity.
- Inventory correctness.
- Payment correctness.
- Order correctness.
- Idempotency.
- Concurrency safety.
- Recoverability.

---

# 3. Implementation Strategy

Implementation follows a **foundation-first, vertical-slice approach**.

The sequence is:

```text
Repository
    ↓
Packages
    ↓
Application Bootstrap
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
Integrations
    ↓
Verification
```

Each completed stage should leave the repository in a usable state.

---

# 4. Source of Truth

Implementation decisions must follow the existing documentation hierarchy.

Use:

```text
AGENTS.md
    ↓
Architecture Documentation
    ↓
Product Documentation
    ↓
Domain Specifications
    ↓
Implementation Documentation
    ↓
Existing Code
```

If existing code conflicts with the documented architecture, do not silently invent a third behavior.

Resolve the discrepancy deliberately.

---

# 5. Repository Rules

Before implementing any task:

1. Read the actual root `AGENTS.md`.
2. Inspect the relevant repository files.
3. Read the applicable specification.
4. Read relevant architecture documentation.
5. Inspect existing implementation patterns.
6. Identify dependencies.
7. Make the smallest complete change.
8. Run appropriate verification.
9. Review the resulting diff.

AI tools must not rely on cached or assumed repository instructions.

---

# 6. Implementation Units

Implementation should be organized around small, reviewable units.

A unit should normally contain:

```text
Specification
    ↓
Domain / Application Logic
    ↓
Persistence
    ↓
API / Integration
    ↓
Tests
```

Avoid creating large batches of untested implementation across unrelated modules.

---

# 7. Foundation Phase

The first implementation phase establishes the repository runtime.

Implement:

```text
[ ] Workspace configuration
[ ] Shared TypeScript configuration
[ ] Package structure
[ ] Web application bootstrap
[ ] Worker bootstrap
[ ] Configuration system
[ ] Database package
[ ] Environment handling
[ ] Logging
[ ] Health checks
[ ] Error handling
```

No business domain should compensate for missing foundational infrastructure.

---

# 8. Database Phase

Establish PostgreSQL before implementing dependent business domains.

Implement:

```text
[ ] Database connection
[ ] Connection lifecycle
[ ] Migration system
[ ] Migration execution
[ ] Schema conventions
[ ] Seed infrastructure
[ ] Database test utilities
```

The database implementation must follow the existing database documentation.

---

# 9. Platform Phase

Implement the security and request foundations:

```text
[ ] Authentication
[ ] Sessions
[ ] Tenant resolution
[ ] Membership resolution
[ ] Authorization
[ ] Request context
[ ] Validation
[ ] Error mapping
[ ] API routing
[ ] Observability
```

Business modules should consume these foundations rather than implement their own versions.

---

# 10. Domain Phase

Domain implementation follows the dependency order established in:

```text
docs/implementation/domains/domain-implementation-order.md
```

Primary sequence:

```text
Stores
Products
Inventory
Customers
Carts
Discounts
Checkout
Payments
Orders
Storefront
```

---

# 11. Supporting Integration Phase

After core commerce functionality is established:

```text
Media
Notifications
Webhooks
Jobs
```

Supporting integrations may be developed partially in parallel when their interfaces are already stable.

---

# 12. Vertical Slice Principle

Where practical, implement complete behavior rather than isolated technical layers.

For example, instead of building every Product repository first:

```text
Product repository
Product service
Product API
Product tests
```

complete a useful Product capability:

```text
Create Product
    ↓
Persist Product
    ↓
Return Product DTO
    ↓
Test behavior
```

Then expand the domain.

---

# 13. Dependency Rule

A task may begin only when its required dependencies are sufficiently stable.

For example:

```text
Products
    requires
Store
Database
Tenant Context
Authorization
Validation
```

Checkout should not be implemented against placeholder assumptions about Inventory or Payments.

---

# 14. Critical Path

The implementation critical path is:

```text
Repository
   ↓
Foundation
   ↓
Database
   ↓
Auth
   ↓
Tenant
   ↓
Stores
   ↓
Products
   ↓
Inventory
   ↓
Carts
   ↓
Checkout
   ↓
Payments
   ↓
Orders
   ↓
Storefront
   ↓
E2E Verification
```

This path receives priority when resource constraints require sequencing decisions.

---

# 15. Parallel Work

After foundational contracts are stable, selected work can proceed in parallel.

Examples:

```text
Products ─────────────── Storefront preparation

Customers ────────────── Carts

Payments ─────────────── Webhooks

Orders ───────────────── Notifications

Media ────────────────── Product integration
```

Parallel work must never bypass module boundaries.

---

# 16. Transaction Ownership

Application services own transaction boundaries.

Preferred:

```text
API Handler
    ↓
Application Service
    ↓
Transaction
    ↓
Domain / Repository Operations
```

Avoid transaction management scattered across controllers, repositories, and utility functions.

---

# 17. External Integration Rule

External provider calls must remain behind adapters.

For example:

```text
Checkout
   ↓
Payment Interface
   ↓
Payment Adapter
   ↓
Provider
```

Business logic must not import provider SDKs directly.

---

# 18. Database Access Rule

Business modules own their persistence.

Preferred:

```text
Products Application Service
    ↓
Products Repository
    ↓
Products Tables
```

Forbidden:

```text
Orders
    ↓
Direct SQL
    ↓
Products Tables
```

Cross-domain data must be obtained through public interfaces or appropriate events.

---

# 19. Security-First Implementation

Security must be implemented with the first functional version of each feature.

Do not build:

```text
Feature
    ↓
Temporary unrestricted access
    ↓
"Add security later"
```

Instead:

```text
Authentication
+
Tenant Resolution
+
Authorization
+
Validation
+
Business Operation
```

from the beginning.

---

# 20. Testing During Implementation

Tests must be written alongside implementation.

Minimum expectations:

### Domain logic

Unit tests.

### Database behavior

Integration tests.

### API behavior

API/integration tests.

### Security

Authorization and tenant-isolation tests.

### Critical operations

Concurrency and idempotency tests.

---

# 21. Critical Correctness Areas

The following require additional scrutiny:

```text
Inventory
Checkout
Payments
Orders
Webhooks
Idempotency
Tenant isolation
Authorization
Database transactions
```

A feature that works in the happy path but fails under retry or concurrency is not complete.

---

# 22. Implementation Sequence Per Domain

For each domain:

```text
1. Read specification
2. Confirm ownership
3. Confirm dependencies
4. Define domain types
5. Define repository contracts
6. Create migration
7. Implement persistence
8. Implement domain rules
9. Implement application services
10. Implement API
11. Implement tests
12. Integrate with dependent domains
13. Run verification
14. Review diff
```

Not every domain requires every step to have equal complexity.

---

# 23. Migration Discipline

Every schema change must be represented by a migration.

Do not manually alter shared environments as a substitute for migrations.

The implementation must be reproducible from:

```text
Empty Database
    ↓
Migration Set
    ↓
Current Schema
```

---

# 24. Seed Discipline

Seeds must remain separate from migrations.

Seeds provide development/demo data.

Migrations define schema evolution.

Never encode demo-only data as production schema changes.

---

# 25. API Implementation

API handlers should remain thin.

Expected flow:

```text
Request
   ↓
Parse
   ↓
Validate
   ↓
Authenticate
   ↓
Resolve Tenant
   ↓
Authorize
   ↓
Application Service
   ↓
DTO
   ↓
Response
```

Handlers must not become the location for domain business rules.

---

# 26. Error Implementation

Errors must be translated consistently.

Internal errors may contain implementation details.

Public API errors must expose only appropriate information.

The implementation must preserve:

- Stable error codes.
- Safe messages.
- HTTP status mapping.
- Request correlation.
- Retry semantics where applicable.

---

# 27. Observability During Implementation

Every major capability should include sufficient observability when introduced.

At minimum:

```text
Request / operation
Resource identifier
Store context
Result
Duration
Failure category
```

Sensitive information must not be logged.

---

# 28. Background Work

Secondary work should be moved to jobs where appropriate.

Examples:

```text
Order
   ↓
Notification Job

Media
   ↓
Cleanup Job

Webhook
   ↓
Processing Job
```

Critical business state must not depend on an unexecuted background job unless explicitly designed that way.

---

# 29. Idempotency Implementation

Whenever an operation can be retried, determine:

```text
What identifies the logical operation?
What happens if it is repeated?
What happens if two requests execute concurrently?
What result should the caller receive?
```

This must be answered before implementing critical mutations.

---

# 30. Concurrency Implementation

For each shared mutable resource, determine:

```text
What can execute concurrently?
What state can conflict?
What database constraint or lock protects it?
What happens after a conflict?
Can the operation be safely retried?
```

This is especially important for:

- Inventory.
- Payments.
- Discounts.
- Checkout.
- Orders.
- Jobs.

---

# 31. Definition of Complete Implementation

A feature is not complete merely because:

```text
[ ] Code exists
```

It is complete when:

```text
Code
+
Database
+
Validation
+
Authorization
+
Tenant Isolation
+
Error Handling
+
Tests
+
Observability
+
Documentation
```

are appropriately implemented.

---

# 32. Local Verification Before Commit

Before committing a meaningful change:

```text
[ ] Typecheck
[ ] Lint
[ ] Relevant unit tests
[ ] Relevant integration tests
[ ] Relevant API tests
[ ] Relevant security tests
[ ] Build where appropriate
```

Critical changes should receive broader verification.

---

# 33. Pull Request Verification

A pull request should explain:

- What changed.
- Why it changed.
- Which specification it implements.
- Which tests were run.
- Any known limitations.
- Any migration requirements.
- Any deployment considerations.

Do not claim tests passed unless they were actually executed.

---

# 34. Change Scope

Keep implementation changes focused.

Avoid combining:

```text
Feature
+
Unrelated refactor
+
Dependency upgrade
+
Architecture change
```

in one change unless they are genuinely required together.

Focused changes are easier to review, test, and roll back.

---

# 35. AI Implementation Rules

AI-assisted implementation must:

- Read actual `AGENTS.md`.
- Inspect current code.
- Follow documented architecture.
- Follow relevant specifications.
- Preserve existing behavior unless change is intentional.
- Avoid speculative abstractions.
- Avoid unnecessary dependencies.
- Avoid modifying unrelated files.
- Never fabricate test results.
- Never fabricate provider responses.
- Never expose secrets.
- Review generated diffs.

---

# 36. Demo-to-V1 Compatibility

Implementation should avoid decisions that create unnecessary migration work later.

Stable:

```text
Domain boundaries
Public interfaces
Tenant ownership
Core data model
Business state machines
Idempotency concepts
Provider abstraction
```

May evolve:

```text
Deployment topology
Queue infrastructure
Search infrastructure
Caching
Observability depth
Scaling strategy
Service boundaries
```

---

# 37. Implementation Checkpoints

Use checkpoints after major phases.

### Checkpoint 1

```text
Repository + Foundation
```

### Checkpoint 2

```text
Database + Auth + Tenant
```

### Checkpoint 3

```text
Stores + Products + Inventory
```

### Checkpoint 4

```text
Customers + Carts + Discounts
```

### Checkpoint 5

```text
Checkout + Payments + Orders
```

### Checkpoint 6

```text
Storefront + Integrations
```

### Checkpoint 7

```text
Full Demo Verification
```

At each checkpoint, the implementation should remain buildable and testable.

---

# 38. Stop Conditions

Implementation should pause for architectural review when:

- A module needs another module's private database tables.
- A dependency cycle appears.
- A new infrastructure service seems necessary.
- A provider-specific assumption enters domain logic.
- Tenant isolation becomes difficult to enforce.
- A critical transaction spans incompatible boundaries.
- A state machine needs undocumented states.
- Existing documentation no longer matches reality.

Do not solve architectural problems by quietly adding complexity.

---

# 39. Escalation Rule

If implementation reveals a genuine architectural gap:

```text
Discover Gap
    ↓
Document Problem
    ↓
Evaluate Alternatives
    ↓
Update Architecture / ADR
    ↓
Update Relevant Specification
    ↓
Continue Implementation
```

Do not allow implementation code to become the accidental architecture document.

---

# 40. Final Execution Sequence

The complete execution path is:

```text
Stage 7
   ↓
Repository Implementation
   ↓
Foundation
   ↓
Database
   ↓
Platform Security
   ↓
Domain Implementation
   ↓
External Integrations
   ↓
Background Processing
   ↓
Testing
   ↓
Security Verification
   ↓
Deployment
   ↓
Demo Acceptance
```

---

# 41. Final Principle

Implementation should be **incremental, testable, reversible, and specification-driven**.

The goal is not to produce the maximum amount of code.

The goal is to produce the minimum amount of well-structured code required to establish a reliable commerce platform that can evolve into V1 without requiring a fundamental rewrite.