# Implementation Strategy

## 1. Purpose

This document defines the overall strategy for implementing the Demo version of the Shopify-like commerce platform.

The objective is to convert the existing product requirements, architecture, domain specifications, security rules, and engineering standards into a working system without introducing unnecessary architectural complexity.

The implementation must produce a **real, functional commerce platform** while preserving the boundaries required for future V1 evolution.

---

## 2. Implementation Philosophy

The Demo follows five principles:

1. **Build a real system, not a UI simulation.**
2. **Implement business-critical correctness before convenience features.**
3. **Keep the architecture modular without prematurely distributing it.**
4. **Use PostgreSQL as the transactional source of truth.**
5. **Prefer simple infrastructure with strong application correctness.**

The Demo should be deliberately small, but it must not be deliberately fragile.

---

## 3. Target Architecture

The implementation follows:

```text
Client
  ↓
Next.js Web Application
  ↓
Presentation / API
  ↓
Application Services
  ↓
Domain Modules
  ↓
Infrastructure
  ↓
PostgreSQL / Object Storage / External Providers
```

Background processing:

```text
PostgreSQL Jobs
      ↓
apps/worker
      ↓
Domain Job Handlers
      ↓
External Services / Secondary Effects
```

---

## 4. Architectural Style

The Demo is implemented as a **modular monolith**.

The repository remains a monorepo:

```text
apps/
modules/
packages/
specs/
docs/
tests/
```

Domain modules remain logically isolated even though they execute within the same deployable application.

---

## 5. Implementation Layers

Each business module should follow the established layering:

```text
Presentation
    ↓
Application
    ↓
Domain
    ↓
Infrastructure
```

### Presentation

Responsible for:

- HTTP handlers.
- Request parsing.
- Authentication context.
- Input validation.
- Response mapping.

### Application

Responsible for:

- Use cases.
- Transaction boundaries.
- Authorization orchestration.
- Domain coordination.
- Idempotency.

### Domain

Responsible for:

- Business rules.
- State transitions.
- Value objects.
- Domain invariants.
- Domain events.

### Infrastructure

Responsible for:

- PostgreSQL repositories.
- External provider adapters.
- Object storage.
- Authentication persistence.
- Technical integrations.

---

## 6. Implementation Priority

Implementation order should be driven by dependency and correctness rather than visual importance.

The preferred sequence is:

```text
Foundation
   ↓
Database
   ↓
Authentication
   ↓
Tenant / Authorization
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
Background Jobs
   ↓
Integration Verification
```

Some infrastructure capabilities may be implemented earlier where required by the foundation.

---

## 7. Foundation First

Before implementing business domains, establish:

- Repository conventions.
- Package boundaries.
- TypeScript configuration.
- Next.js application.
- Worker application.
- Shared configuration.
- Database connectivity.
- Migration system.
- Logging.
- Error handling.
- Validation infrastructure.
- Authentication foundation.
- Tenant context foundation.

Business modules should not independently recreate these capabilities.

---

## 8. Database First-Class Treatment

PostgreSQL is the authoritative transactional source of truth.

Database implementation must therefore be established before complex domain logic.

The implementation should define:

- Connection management.
- Migration execution.
- Schema ownership.
- Transaction helpers.
- Repository conventions.
- Test database strategy.
- Seed strategy.

---

## 9. Domain Implementation Strategy

Each domain should be implemented according to its existing implementation specification.

For every domain:

```text
Specification
    ↓
Domain Model
    ↓
Database Schema
    ↓
Repositories
    ↓
Application Services
    ↓
APIs
    ↓
Events / Jobs
    ↓
Tests
```

Do not implement the API first and attempt to invent the domain afterward.

---

## 10. Dependency-Driven Development

A module may only depend on capabilities that have already been established or explicitly abstracted.

For example:

```text
Orders
  depends on:
    Checkout
    Payments
    Inventory
    Customers
    Products
```

Therefore, Orders should not be fully implemented before those dependencies exist.

Where circular dependencies appear, introduce a public application interface or domain event rather than directly coupling module internals.

---

## 11. Public Module Interfaces

Modules must expose only the operations required by other modules.

Example:

```text
Products
  ├── getVariant()
  ├── validatePurchasability()
  └── getCurrentPrice()
```

Another module must not access:

```text
modules/products/src/internal/*
```

or directly manipulate Product-owned database tables.

---

## 12. Database Ownership

Each module owns its domain data.

Ownership determines:

- Who creates records.
- Who updates records.
- Who validates business invariants.
- Who exposes mutation operations.

Other modules may read required information through approved interfaces.

Direct cross-module table mutation is prohibited.

---

## 13. Transaction Strategy

Transactions belong at application-service/use-case boundaries.

Example:

```text
CheckoutService.complete()
    ↓
BEGIN
    ↓
Validate state
    ↓
Reserve inventory
    ↓
Create payment state
    ↓
Create order when appropriate
    ↓
Record events/jobs
    ↓
COMMIT
```

The exact transaction sequence depends on the domain specification.

External provider calls should not be held inside long database transactions.

---

## 14. Business-Critical Correctness

The following areas receive the highest implementation priority:

### Tenant Isolation

A Store must never access another Store's data.

### Authorization

Authenticated users must only perform permitted operations.

### Inventory

Overselling must be prevented.

### Payments

Duplicate charges must be prevented.

### Orders

Order creation must be durable and idempotent.

### Checkout

Retries and concurrent completion must be safe.

### Webhooks

Duplicate and out-of-order provider events must be handled safely.

### Idempotency

Repeated requests must not accidentally repeat critical side effects.

---

## 15. Security-First Implementation

Security must be implemented at the foundation rather than added after the feature work.

Every protected use case must consider:

```text
Authentication
    ↓
Tenant Resolution
    ↓
Authorization
    ↓
Input Validation
    ↓
Business Operation
```

Security-sensitive behavior must be enforced server-side.

---

## 16. API Implementation Strategy

APIs should be implemented around business capabilities.

Example:

```text
/api/v1/stores
/api/v1/products
/api/v1/inventory
/api/v1/customers
/api/v1/carts
/api/v1/checkout
/api/v1/payments
/api/v1/orders
```

Handlers remain thin.

They should:

1. Parse the request.
2. Validate input.
3. Resolve authentication and tenant context.
4. Invoke an application service.
5. Map the result to the API contract.

Business logic must not accumulate inside route handlers.

---

## 17. Validation Strategy

Validation occurs at boundaries.

Use:

```text
External Input
    ↓
Schema Validation
    ↓
Application Service
    ↓
Domain Invariants
    ↓
Database Constraints
```

Each layer protects a different boundary.

Validation must not replace authorization or domain rules.

---

## 18. Error Strategy

The implementation must use stable application errors.

Errors should contain:

- Stable error code.
- Safe public message.
- HTTP mapping where applicable.
- Retryability where relevant.

Internal stack traces and sensitive infrastructure details must not reach clients.

---

## 19. Idempotency Strategy

Critical mutation operations must define their retry behavior before implementation.

Particularly:

- Checkout completion.
- Payment operations.
- Refunds.
- Order creation.
- Inventory adjustments.
- Inventory reservations.
- Webhook processing.
- Background jobs.

Idempotency must be implemented intentionally rather than added after duplicate side effects appear.

---

## 20. Event Strategy

Events represent facts.

Examples:

```text
ProductPublished
InventoryAdjusted
OrderCreated
PaymentSucceeded
RefundCompleted
```

Events may trigger secondary work such as notifications.

Events must not become a hidden replacement for synchronous transactional logic.

---

## 21. Background Job Strategy

The Demo uses:

```text
PostgreSQL
    ↓
apps/worker
```

for durable asynchronous work.

Jobs should be:

- Persisted.
- Retryable.
- Idempotent.
- Tenant-aware.
- Observable.

Redis or a dedicated message broker should only be introduced when actual requirements justify the operational complexity.

---

## 22. External Integration Strategy

External providers must be hidden behind interfaces.

Examples:

```text
PaymentProvider
ObjectStorage
EmailSender
```

Business modules should depend on stable application interfaces rather than provider SDKs.

Provider-specific code belongs in infrastructure adapters.

---

## 23. Demo Infrastructure

The initial deployment target is:

```text
Cloudflare
    ↓
VPS
    ├── Web
    └── Worker
         ↓
    PostgreSQL

Object Storage
```

Docker should provide consistent runtime environments.

GitHub Actions should automate build, test, and deployment workflows.

---

## 24. Local Development

Local development should provide the minimum services required to run the platform.

Expected local components:

```text
Next.js Web
Worker
PostgreSQL
```

Optional external services may be replaced with safe development adapters where appropriate.

Developers should not require production credentials to run the system locally.

---

## 25. Development Order Within a Module

A domain implementation should generally follow:

```text
1. Domain types
2. Value objects / invariants
3. State transitions
4. Database schema
5. Migration
6. Repository
7. Application service
8. Authorization
9. API
10. Events
11. Jobs
12. Tests
```

The exact order may vary when dependencies require it.

---

## 26. Test-Driven Risk Management

Tests should be implemented alongside the relevant functionality.

Priority should be given to:

```text
Highest
  ↓
Security
Tenant isolation
Payments
Inventory
Checkout
Orders
Webhooks
Idempotency
Concurrency
  ↓
Core CRUD
  ↓
Secondary behavior
```

Tests should validate behavior rather than internal implementation details.

---

## 27. Integration Testing

Integration tests should verify real interactions between:

- Application services.
- PostgreSQL.
- Repositories.
- Transactions.
- Domain modules.
- External adapters where practical.

Mocks should not replace database correctness tests.

---

## 28. End-to-End Testing

Critical user journeys must be verified through the actual application.

Minimum critical flow:

```text
Merchant Login
    ↓
Create Store
    ↓
Create Product
    ↓
Add Inventory
    ↓
Publish Product
    ↓
Customer Opens Storefront
    ↓
Add to Cart
    ↓
Checkout
    ↓
Payment
    ↓
Order Created
    ↓
Merchant Views Order
```

---

## 29. Incremental Implementation

The platform should be implemented in small vertical slices.

A vertical slice should ideally include:

```text
Database
+
Domain Logic
+
Application Service
+
API
+
Tests
```

This is preferable to implementing every database table first and discovering months later that the application does not actually work.

---

## 30. Definition of an Implemented Feature

A feature is not considered complete when its database table exists.

A feature is complete when the relevant:

- Domain behavior.
- Application service.
- Authorization.
- API.
- Persistence.
- Error handling.
- Tests.
- Required events/jobs.
- Documentation

are implemented and verified.

---

## 31. AI-Assisted Implementation

AI tools may assist with implementation, but they must follow the repository rules.

Before modifying code, an AI agent must:

1. Read the actual root `AGENTS.md`.
2. Inspect the current repository state.
3. Read relevant architecture documentation.
4. Read the relevant feature specification.
5. Inspect existing implementation patterns.
6. Identify dependencies.
7. Make the smallest safe change.
8. Run appropriate verification.
9. Review the resulting diff.

AI agents must not invent architecture simply because a different pattern appears in training data.

---

## 32. Implementation Boundaries for AI

AI agents must not:

- Create unnecessary services.
- Split the modular monolith prematurely.
- Introduce Redis without justification.
- Introduce Kafka without justification.
- Create duplicate abstractions.
- Bypass authorization.
- Access another module's internal tables.
- Hardcode secrets.
- Modify unrelated modules without necessity.
- Rewrite working code merely for stylistic preference.

---

## 33. Production Safety

AI-assisted development must not provide unrestricted production access.

Production operations must remain explicitly controlled.

AI-generated changes affecting:

- Payments.
- Inventory.
- Orders.
- Authentication.
- Tenant isolation.
- Database migrations

require especially careful human review and verification.

---

## 34. Migration Strategy

Database changes must use version-controlled migrations.

Migrations should:

- Be reviewed.
- Be reproducible.
- Be ordered.
- Preserve existing data.
- Follow expand-and-contract practices when required.

Destructive schema changes must not be casually introduced during normal feature implementation.

---

## 35. Seed Strategy

Development and Demo environments should have deterministic seed data sufficient to exercise:

- Users.
- Organizations.
- Stores.
- Products.
- Variants.
- Inventory.
- Customers.
- Discounts.
- Orders.

Seed data must never contain production secrets or real customer data.

---

## 36. Observability

Every important operation should be diagnosable through:

- Structured logs.
- Request IDs.
- Job IDs.
- Event IDs.
- Relevant Store context.
- Error codes.
- Basic metrics.

Sensitive information must remain excluded.

---

## 37. Documentation Synchronization

Documentation is part of the implementation.

When implementation changes architectural assumptions, the corresponding documentation must be updated.

The source of truth hierarchy is:

```text
Product Requirements
    ↓
Architecture
    ↓
Feature Specifications
    ↓
Implementation
    ↓
Tests
```

If implementation reveals an incorrect specification, update the specification rather than silently diverging from it.

---

## 38. Definition of a Safe Change

A safe change:

- Has a clearly defined purpose.
- Fits the existing architecture.
- Preserves module ownership.
- Preserves tenant isolation.
- Preserves authorization.
- Preserves database integrity.
- Defines retry/idempotency behavior where relevant.
- Includes appropriate tests.
- Does not introduce unnecessary dependencies.

---

## 39. Demo-to-V1 Compatibility

The Demo should avoid decisions that make V1 migration unnecessarily difficult.

The most important compatibility requirements are:

- Stable domain boundaries.
- Stable module interfaces.
- Explicit database ownership.
- Clear API contracts.
- Provider abstractions.
- Durable jobs.
- Explicit authentication and authorization.
- Strong tenant isolation.

Infrastructure may change later without requiring domain logic to be rewritten.

---

## 40. What the Demo Deliberately Does Not Optimize

The Demo does not optimize prematurely for:

- Massive traffic.
- Multi-region deployment.
- Horizontal database sharding.
- Complex service meshes.
- Dedicated search clusters.
- Enterprise analytics.
- Multi-provider infrastructure everywhere.
- Kubernetes orchestration.
- Global event streaming.

Correctness and maintainability take priority over theoretical scale.

---

## 41. Completion Criteria

Implementation work should be considered ready for Demo verification only when:

```text
[ ] Foundation is operational
[ ] Database is operational
[ ] Authentication works
[ ] Tenant isolation works
[ ] Authorization works
[ ] Store lifecycle works
[ ] Product lifecycle works
[ ] Inventory correctness works
[ ] Customer management works
[ ] Cart lifecycle works
[ ] Discounts work
[ ] Checkout works
[ ] Payment workflow works
[ ] Order workflow works
[ ] Storefront works
[ ] Media works
[ ] Notifications work where required
[ ] Webhooks work where required
[ ] Background jobs work
[ ] Critical E2E flows pass
[ ] Security tests pass
[ ] Database migrations are reproducible
[ ] Deployment is reproducible
[ ] Documentation matches implementation
```

---

## 42. Final Implementation Principle

The implementation should continuously answer one question:

> **Does this change make the Demo more functionally complete while preserving the architecture required for a trustworthy V1?**

If the answer is no, the change should be reconsidered before implementation.

The goal is not to build the largest possible platform.

The goal is to build the **smallest real commerce platform that has correct foundations and can grow without a fundamental rewrite**.