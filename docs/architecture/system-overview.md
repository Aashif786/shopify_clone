# System Architecture Overview

## 1. Purpose

This document defines the high-level technical architecture of the Shopify-like commerce platform.

The architecture is designed for the current **Demo** implementation while preserving a practical path toward a larger **V1** platform.

The Demo is a real functional commerce system. It is intentionally simpler than the eventual V1 infrastructure, but its core business behavior must be designed correctly from the beginning.

This document establishes:

- Overall system structure
- Major architectural layers
- Runtime components
- Domain organization
- Data ownership principles
- Communication patterns
- Tenant isolation principles
- External integration boundaries
- Demo-to-V1 architectural direction

Implementation-level details belong in the relevant architecture, domain, database, API, security, and infrastructure documents.

---

# 2. Architectural Goals

The architecture MUST prioritize:

1. **Business correctness**
2. **Tenant isolation**
3. **Transactional integrity**
4. **Security**
5. **Maintainability**
6. **Clear module boundaries**
7. **Safe retries and idempotency**
8. **Simple deployment**
9. **Testability**
10. **Evolution toward V1 without fundamental business-logic rewrites**

The architecture SHOULD avoid complexity that does not provide meaningful value to the Demo.

---

# 3. Architectural Style

The Demo uses a:

> **Modular Monolith**

The application is deployed as a small number of runtime applications while maintaining strong internal domain boundaries.

The primary application contains multiple business modules rather than splitting each domain into independent services.

Conceptually:

```text
                         ┌──────────────────────┐
                         │      Customers       │
                         │      Storefront      │
                         │      Merchants       │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │      apps/web        │
                         │    Next.js App       │
                         └──────────┬───────────┘
                                    │
                     ┌──────────────┼──────────────┐
                     │              │              │
                     ▼              ▼              ▼
                ┌─────────┐    ┌─────────┐    ┌─────────┐
                │ Domain  │    │ Domain  │    │ Domain  │
                │ Modules │    │ Modules │    │ Modules │
                └────┬────┘    └────┬────┘    └────┬────┘
                     │              │              │
                     └──────────────┼──────────────┘
                                    ▼
                         ┌──────────────────────┐
                         │     packages/db      │
                         │     PostgreSQL       │
                         └──────────────────────┘

                         ┌──────────────────────┐
                         │     apps/worker      │
                         │ Background Processing│
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ Domain / Application │
                         │ Services & Events    │
                         └──────────────────────┘
```

---

# 4. Runtime Components

The Demo contains two primary runtime applications.

## 4.1 Web Application

Location:

```text
apps/web
```

Responsibilities include:

- Merchant interface
- Customer storefront
- Authentication entry points
- Request handling
- API endpoints
- Server-side application logic
- Calling domain/application services
- Rendering user interfaces

The web application MUST NOT contain large amounts of duplicated business logic inside route handlers or UI components.

---

## 4.2 Worker Application

Location:

```text
apps/worker
```

Responsibilities include:

- Background jobs
- Asynchronous processing
- Retryable operations
- Event-driven secondary actions
- Notifications
- Integration callbacks where appropriate

The worker MUST reuse the same domain rules and application services as the web application where applicable.

Business rules MUST NOT be independently reimplemented inside the worker.

---

# 5. Domain Modules

The Demo uses the following core modules:

```text
modules/
├── carts/
├── checkout/
├── customers/
├── discounts/
├── inventory/
├── orders/
├── payments/
├── products/
└── stores/
```

Each module represents a business capability.

The modules are not independent deployable services.

They are independently organized within the modular monolith.

---

# 6. Module Responsibilities

## 6.1 Stores

Responsible for:

- Organizations
- Stores
- Store configuration
- Store lifecycle
- Store ownership relationships

---

## 6.2 Products

Responsible for:

- Products
- Product information
- Product pricing information
- Product publication state
- Product availability rules

---

## 6.3 Inventory

Responsible for:

- Inventory quantities
- Inventory adjustments
- Availability
- Inventory-related business rules
- Safe inventory changes

Inventory is a transaction-sensitive domain.

---

## 6.4 Customers

Responsible for:

- Customer identities
- Customer profiles
- Store/customer relationships
- Customer-specific business information

---

## 6.5 Carts

Responsible for:

- Cart creation
- Cart items
- Quantity changes
- Cart lifecycle
- Cart totals before checkout

A cart is not an order.

---

## 6.6 Discounts

Responsible for:

- Discount definitions
- Discount activation
- Eligibility
- Discount validation
- Discount calculations

---

## 6.7 Checkout

Responsible for coordinating:

- Cart validation
- Product validation
- Pricing validation
- Discount validation
- Inventory validation
- Customer information
- Payment initiation
- Order creation coordination

Checkout acts as an orchestration boundary rather than owning every underlying business concept.

---

## 6.8 Payments

Responsible for:

- Payment attempts
- Payment state
- Payment provider interaction
- Payment callbacks
- Payment idempotency
- Payment-related business rules

The payment module MUST isolate provider-specific implementation from the rest of the platform.

---

## 6.9 Orders

Responsible for:

- Order creation
- Order items
- Order totals
- Order state
- Order management
- Historical transaction representation

Orders preserve the result of a completed commerce transaction.

---

# 7. Shared Packages

Shared packages provide reusable technical capabilities.

```text
packages/
├── auth/
├── config/
├── db/
├── event-bus/
├── tenant/
├── types/
├── ui/
└── validation/
```

Shared packages MUST NOT become a dumping ground for arbitrary business logic.

---

## 7.1 Auth

Provides shared authentication and identity-related capabilities.

It should not decide domain-specific business permissions independently of the application's authorization model.

---

## 7.2 Config

Provides centralized configuration handling.

Environment-specific configuration MUST NOT be hardcoded into application modules.

---

## 7.3 DB

Provides:

- Database connectivity
- Database client
- Migration support
- Shared database infrastructure

The database package does not grant unrestricted access to another module's internal business data.

---

## 7.4 Event Bus

Provides application-level event communication.

Events are used where asynchronous or decoupled processing provides a meaningful benefit.

Events MUST NOT replace transactions where atomicity is required.

---

## 7.5 Tenant

Provides shared tenant-context functionality.

Tenant context MUST be available wherever store-owned resources are accessed.

---

## 7.6 Types

Contains genuinely shared types.

Domain-specific types SHOULD remain inside their owning modules unless there is a strong reason to expose them.

---

## 7.7 UI

Contains reusable presentation components.

UI components MUST NOT contain business-critical domain logic.

---

## 7.8 Validation

Contains reusable validation mechanisms and schemas.

Validation packages SHOULD remain focused on validation rather than becoming general-purpose utility packages.

---

# 8. Architectural Layers

Within the application, responsibilities should generally follow these layers:

```text
Presentation
     ↓
Application
     ↓
Domain
     ↓
Infrastructure
```

## Presentation

Responsible for:

- HTTP requests
- UI
- Request parsing
- Authentication context
- Response formatting

Presentation code should remain thin.

---

## Application

Responsible for:

- Use cases
- Workflow orchestration
- Authorization coordination
- Transaction coordination
- Calling domain operations
- Publishing appropriate events

---

## Domain

Responsible for:

- Business rules
- Invariants
- State transitions
- Domain behavior
- Domain-specific validation

---

## Infrastructure

Responsible for:

- PostgreSQL
- External APIs
- Payment providers
- Object storage
- Email providers
- Other technical integrations

Infrastructure details should not leak unnecessarily into domain logic.

---

# 9. Data Architecture

PostgreSQL is the primary transactional source of truth for the Demo.

```text
                ┌──────────────────┐
                │   Application    │
                └────────┬─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │    PostgreSQL    │
                │ Transactional DB │
                └──────────────────┘
```

The database is responsible for durable transactional state.

Critical business operations MUST use appropriate database transactions and constraints.

Examples include:

- Checkout
- Order creation
- Inventory changes
- Payment state changes
- Discount application where required

Exact database ownership and schema rules are defined separately.

---

# 10. External Integrations

The Demo may integrate with external services for capabilities such as:

- Payment processing
- Object storage
- Email
- Error monitoring
- DNS/CDN
- Authentication providers where applicable

External systems MUST be treated as integration boundaries.

Provider-specific behavior should not spread throughout the core business modules.

Conceptually:

```text
                    ┌──────────────────┐
                    │  Commerce Core   │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ Payments │   │  Storage │   │  Email   │
        │ Provider │   │ Provider │   │ Provider │
        └──────────┘   └──────────┘   └──────────┘
```

---

# 11. Request Processing

A typical request follows:

```text
Client
  ↓
Web Application
  ↓
Authentication
  ↓
Tenant Resolution
  ↓
Authorization
  ↓
Application Service
  ↓
Domain Logic
  ↓
Database / External Integration
  ↓
Result
  ↓
Response
```

The exact implementation may vary by operation.

Critical business rules MUST NOT rely solely on frontend validation.

---

# 12. Tenant Context

The platform follows:

```text
Organization
      ↓
    Store
      ↓
Membership / User
      ↓
Store-Owned Resources
```

Tenant context is a fundamental architectural concern.

A protected operation should be evaluated against:

```text
Identity
+
Organization
+
Store
+
Membership / Role
+
Resource Ownership
+
Requested Operation
```

Tenant isolation MUST be enforced at the application and data-access boundaries.

---

# 13. Synchronous vs Asynchronous Processing

The architecture distinguishes between operations that require immediate results and operations that can execute asynchronously.

### Synchronous

Examples:

- Authentication
- Product retrieval
- Cart modification
- Checkout validation
- Payment initiation
- Order retrieval

### Asynchronous

Examples:

- Notifications
- Non-critical integration processing
- Some webhook follow-up actions
- Background maintenance
- Retryable secondary effects

Critical transactional state MUST NOT depend on an asynchronous worker completing successfully when the state change itself requires atomicity.

---

# 14. Event-Driven Behavior

The Demo supports application events where they simplify secondary processing.

Example:

```text
Order Created
      │
      ├──→ Send Confirmation
      │
      ├──→ Update Notification State
      │
      └──→ Trigger Other Secondary Processing
```

Events should generally represent facts that have already occurred.

For example:

```text
OrderCreated
PaymentSucceeded
InventoryAdjusted
```

Events MUST NOT be used to hide required transactional business logic.

---

# 15. Error Boundaries

The architecture separates:

- User validation errors
- Authorization failures
- Business rule violations
- External service failures
- Infrastructure failures
- Unexpected application failures

Internal implementation details MUST NOT be unnecessarily exposed to customers.

Errors should be observable through appropriate logging and monitoring mechanisms.

---

# 16. Security Architecture Principles

Security is part of the architecture rather than a later feature.

The system MUST provide:

- Server-side authorization
- Tenant isolation
- Secure authentication
- Input validation
- Secret management
- Protected sensitive configuration
- Safe payment integration
- Controlled production access
- Appropriate logging
- Protection against cross-tenant access

Security-sensitive functionality MUST fail closed where practical.

---

# 17. Testing Architecture

The architecture must support testing at multiple levels:

```text
Unit Tests
    ↓
Integration Tests
    ↓
End-to-End Tests
```

### Unit Tests

Validate isolated business logic.

### Integration Tests

Validate interactions with:

- Database
- Modules
- External boundaries
- Application services

### End-to-End Tests

Validate critical user journeys.

The primary end-to-end test should cover the core commerce lifecycle.

---

# 18. Deployment Architecture

The Demo is designed for simple deployment.

Conceptually:

```text
                    Internet
                       │
                       ▼
                 Cloudflare/CDN
                       │
                       ▼
                  VPS / Host
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
        Web Application       Worker
             │                   │
             └─────────┬─────────┘
                       ▼
                  PostgreSQL
```

Containerization SHOULD be used to provide reproducible deployment.

The exact VPS, Docker, networking, backup, and monitoring configuration belongs in infrastructure documentation.

---

# 19. Monorepo Architecture

The repository is organized as a monorepo.

```text
shopify_clone/
│
├── apps/
├── modules/
├── packages/
├── specs/
├── tests/
├── infrastructure/
└── docs/
```

The monorepo provides:

- Shared types
- Shared tooling
- Consistent dependency management
- Atomic changes across modules
- Easier local development
- Easier future extraction of components if required

A module does not need to become a separate service merely because it has a separate directory.

---

# 20. Architectural Boundaries

The following boundaries are mandatory:

### Module Boundary

A module exposes public capabilities rather than allowing consumers to depend on internal implementation details.

### Database Boundary

Modules must not arbitrarily manipulate another module's internal data structures.

### Tenant Boundary

Store-owned resources must remain isolated.

### Integration Boundary

External provider-specific logic remains behind integration interfaces.

### Presentation Boundary

UI and API handlers must not become repositories for business logic.

---

# 21. Demo-to-V1 Strategy

The architecture deliberately avoids premature infrastructure complexity.

The Demo SHOULD NOT require:

- Microservices
- Kubernetes
- Multiple databases
- Distributed caching everywhere
- Dedicated search infrastructure
- Event streaming infrastructure
- Multi-region deployment
- Database sharding
- Complex service mesh infrastructure

These may become appropriate as the platform grows.

The important requirement is that the **business domain boundaries remain clear enough to support future evolution**.

---

# 22. Future V1 Evolution

A future V1 may introduce:

```text
                    ┌───────────────┐
                    │    Web/UI     │
                    └───────┬───────┘
                            │
                            ▼
                     API / Application
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
           Commerce       Search       Analytics
             Core
              │
       ┌──────┴───────┐
       ▼              ▼
   PostgreSQL       Redis
       │
       ├── Object Storage/CDN
       ├── Payment Providers
       ├── Email
       └── Other Integrations
```

Specific services should only be extracted when justified by:

- Scale
- Independent deployment requirements
- Reliability requirements
- Team ownership
- Performance characteristics
- Operational requirements
- Clear domain boundaries

The Demo architecture should therefore optimize for **modularity first, distribution later**.

---

# 23. Architectural Decision Principles

When making future architectural decisions:

1. Prefer the simplest solution that satisfies the requirement.
2. Preserve domain boundaries.
3. Keep PostgreSQL as the source of truth for transactional commerce state.
4. Avoid introducing infrastructure without a demonstrated need.
5. Keep external providers behind integration boundaries.
6. Protect tenant isolation at every relevant layer.
7. Prefer explicit business rules over implicit behavior.
8. Make critical operations transactional and retry-safe.
9. Avoid duplicating business logic between applications.
10. Prefer reversible architectural decisions when requirements are uncertain.

---

# 24. Architectural Quality Bar

A change is architecturally acceptable when it:

- Preserves tenant isolation.
- Preserves module boundaries.
- Does not introduce unnecessary coupling.
- Does not duplicate critical business logic.
- Does not weaken transactional integrity.
- Does not bypass authorization.
- Does not introduce unnecessary infrastructure.
- Can be tested appropriately.
- Can be understood and maintained by the team.
- Has documentation updated when the architectural behavior changes.

---

# 25. Summary

The Demo architecture is a **multi-tenant modular monolith** built around a transactional PostgreSQL database.

Its major structure is:

```text
                  Shopify-like Platform
                           │
                    ┌──────┴──────┐
                    │   apps/web  │
                    │ apps/worker │
                    └──────┬──────┘
                           │
                  Modular Business Core
                           │
        ┌──────┬──────┬───┴───┬──────┬──────┐
        │      │      │       │      │      │
      Stores Products Inventory Carts Checkout Orders
        │      │      │       │      │      │
        └──────┴──────┴───────┴──────┴──────┘
                           │
                ┌──────────┴──────────┐
                │     PostgreSQL      │
                │ Transaction Source  │
                │      of Truth       │
                └─────────────────────┘
```

The central architectural principle is:

> **Build a small but real commerce platform with strong domain boundaries and transactional correctness, rather than a large collection of premature infrastructure.**

This provides a practical foundation for the Demo while keeping the path toward V1 open.