# Dependency Order

## 1. Purpose

This document defines the implementation dependency order for the Demo.

The objective is to ensure that each implementation unit is built only after the foundations it depends on are stable.

The order is based on:

- Architectural dependencies.
- Data ownership.
- Runtime dependencies.
- Business workflow dependencies.
- Security dependencies.
- Integration dependencies.
- Verification requirements.

This order is not merely a preferred sequence. Where a dependency is structurally required, downstream implementation must not bypass it.

---

# 2. Dependency Model

The implementation follows:

```text
Repository
    ↓
Shared Foundation
    ↓
Runtime Foundation
    ↓
Database
    ↓
Platform Security
    ↓
Core Domains
    ↓
Commerce Domains
    ↓
Integrations
    ↓
Vertical Slices
    ↓
Verification
    ↓
Release
```

---

# 3. Dependency Categories

Dependencies are classified as:

| Type | Meaning |
|---|---|
| Structural | Required for code to compile or run |
| Data | Required database/entity relationship |
| Business | Required domain behavior |
| Security | Required authentication/authorization/tenant enforcement |
| Runtime | Required application infrastructure |
| Integration | Required external or asynchronous behavior |
| Verification | Required before dependent work can be considered complete |

---

# 4. Foundation Dependency Graph

```text
Repository
   │
   ├── Package Manager
   │
   ├── TypeScript
   │
   └── Workspace Configuration
           │
           ├── Shared Packages
           │
           ├── Web
           │
           └── Worker
```

The workspace must resolve before application packages are implemented.

---

# 5. Shared Package Dependency Graph

Recommended dependency direction:

```text
config
types
validation
tenant
auth
db
event-bus
ui
```

Packages should depend only on lower-level packages where required.

Avoid circular dependencies.

---

# 6. Database Dependency

Database infrastructure depends on:

```text
Repository
Workspace
Configuration
```

Then provides:

```text
Database Connection
Transactions
Migrations
Repositories
```

to domain implementations.

---

# 7. Platform Dependency

Platform services depend on:

```text
Configuration
Database
Shared Types
Validation
```

Authentication additionally depends on:

```text
Database
Configuration
```

Tenant context depends on:

```text
Authentication
Database
Stores/Membership data
```

Authorization depends on:

```text
Authentication
Tenant Context
Store Membership
```

---

# 8. Core Platform Sequence

The platform foundation should be implemented in this order:

```text id="n6j3k4"
Configuration
    ↓
Database
    ↓
Migrations
    ↓
Authentication
    ↓
Tenant Context
    ↓
Authorization
    ↓
API
    ↓
Validation / Errors
    ↓
Observability
```

These components form the execution environment for business domains.

---

# 9. Stores Dependency Position

Stores are the first business domain.

Reason:

```text id="q8m4c7"
Organization
    ↓
Membership
    ↓
Store
```

Most merchant-owned resources require Store ownership.

Therefore Stores must exist before:

```text
Products
Inventory
Customers
Carts
Discounts
Orders
Media
```

can be implemented fully.

---

# 10. Products Dependency Position

Products depend on:

```text
Stores
Database
Validation
Tenant Context
Authorization
```

Products provide:

```text
Product
Variant
SKU
Price
Publication
Catalog information
```

to downstream domains.

---

# 11. Inventory Dependency Position

Inventory depends on:

```text
Stores
Products
Database
Transactions
Concurrency controls
```

Inventory must be implemented before Checkout because Checkout requires authoritative stock validation and reservation.

---

# 12. Customers Dependency Position

Customers depend on:

```text
Stores
Authentication where applicable
Database
Tenant Context
```

Customers can be implemented after Stores and before Carts.

---

# 13. Carts Dependency Position

Carts depend on:

```text
Stores
Products
Customers
Database
```

A Cart needs to know:

```text
which Store
which Product Variant
which Customer where applicable
```

Therefore Carts should follow Products and Customers.

---

# 14. Discounts Dependency Position

Discounts depend on:

```text
Stores
Products
Carts
Money/value handling
Database
```

Discount calculation can be implemented independently, but Checkout cannot fully integrate Discounts until the relevant Cart and pricing models exist.

---

# 15. Checkout Dependency Position

Checkout is a major orchestration boundary.

It depends on:

```text
Carts
Products
Inventory
Discounts
Customers
Stores
Database
Transactions
Idempotency
```

Therefore Checkout must not be implemented before these foundational capabilities exist.

---

# 16. Payments Dependency Position

Payments depend on:

```text
Checkout
Configuration
External provider abstraction
Database
Idempotency
Webhooks
```

The Payment domain may be developed in isolation against a provider interface, but its full workflow integration occurs after Checkout exists.

---

# 17. Orders Dependency Position

Orders depend on:

```text
Stores
Customers
Products
Checkout
Payments
Database
Transactions
```

Orders represent completed purchases and therefore belong after the purchase flow has established the required authoritative data.

---

# 18. Storefront Dependency Position

Storefront depends on:

```text
Stores
Products
Carts
Checkout
Authentication where applicable
```

The public Storefront can be developed incrementally, but the complete purchase journey depends on the entire commerce path.

---

# 19. Media Dependency Position

Media depends on:

```text
Stores
Object Storage
Database
Configuration
```

Product media integration depends additionally on:

```text
Products
```

Media infrastructure may therefore be developed independently before full Product integration.

---

# 20. Notifications Dependency Position

Notifications depend on:

```text
Event Bus
Jobs
Email Adapter
Configuration
```

Business domains publish events that trigger notification work.

Notifications should not own business state transitions.

---

# 21. Webhook Dependency Position

Webhooks depend on:

```text
HTTP/API Foundation
Configuration
Database
Security Verification
Payment Provider Contract
Jobs
```

The complete Payment webhook flow depends on the Payment domain.

---

# 22. Jobs Dependency Position

Jobs depend on:

```text
Database
Worker
Configuration
Observability
```

The generic job infrastructure should exist before domains start relying on asynchronous work.

Individual job handlers are implemented alongside the integrations that own them.

---

# 23. Complete Domain Dependency Graph

```text
Stores
 ├── Products
 │    └── Inventory
 │
 ├── Customers
 │    └── Carts
 │
 └── Discounts

Products
 └── Carts

Inventory
 └── Checkout

Customers
 └── Checkout

Carts
 └── Checkout

Discounts
 └── Checkout

Checkout
 └── Payments
       └── Orders

Checkout
 └── Orders

Products
 └── Storefront

Carts
 └── Storefront

Checkout
 └── Storefront
```

This represents logical dependencies, not necessarily direct code imports.

---

# 24. Full Commerce Dependency Graph

```text id="q5x8m4"
Stores
   ↓
Products ──────┐
   ↓           │
Inventory      │
   │           │
Customers ──→ Carts
   │           │
   └───────────┤
               ↓
          Discounts
               │
               ↓
            Checkout
           /        \
          ↓          ↓
    Inventory      Payments
                     │
                     ↓
                   Orders
                     │
                     ↓
               Notifications
```

Storefront consumes the resulting public commerce capabilities.

---

# 25. Dependency vs Import

A domain dependency does not mean the implementation must directly import another domain's internal code.

For example:

```text
Checkout → Inventory
```

does not mean:

```text
checkout imports inventory/repository.ts
```

It means Checkout requires Inventory's approved public capability.

---

# 26. Synchronous Dependencies

Use direct application interfaces when the current operation requires the result.

Examples:

```text id="v7m4c8"
Checkout
 → Inventory reservation

Checkout
 → Discount validation

Checkout
 → Payment initiation
```

The exact transaction and failure semantics must follow the domain implementation specifications.

---

# 27. Asynchronous Dependencies

Use events/jobs when the dependent work does not need to complete before the current transaction can succeed.

Examples:

```text id="x8c4m7"
OrderCreated
    ↓
Notification Job

MediaDeleted
    ↓
Object Cleanup Job
```

Do not make the core purchase outcome depend on a non-critical email job.

---

# 28. Dependency Readiness Rule

Before implementing a dependent module, verify its prerequisites.

Example:

Before Checkout implementation:

```text id="m5n8c4"
[ ] Stores ready
[ ] Products ready
[ ] Inventory ready
[ ] Customers ready
[ ] Carts ready
[ ] Discounts ready
[ ] Database transactions ready
[ ] Idempotency ready
```

---

# 29. Partial Dependency Rule

A downstream domain may be scaffolded before every dependency is complete, but production behavior must not bypass missing dependencies.

For example:

```text id="q7c4m8"
Checkout UI
```

may be prototyped early, but it must not create fake Orders to appear complete.

---

# 30. Implementation Dependency Levels

Use the following levels:

### Level 0: Repository

```text
Git
pnpm
TypeScript
workspace
tooling
```

### Level 1: Runtime Foundation

```text
Web
Worker
Config
Database
Logging
Errors
Testing
```

### Level 2: Platform

```text
Authentication
Tenant Context
Authorization
API
Validation
```

### Level 3: Core Domains

```text
Stores
Products
Inventory
Customers
```

### Level 4: Commerce

```text
Carts
Discounts
Checkout
Payments
Orders
```

### Level 5: Experience

```text
Storefront
Media
Notifications
```

### Level 6: Integration

```text
Webhooks
Jobs
External adapters
```

### Level 7: Verification

```text
Vertical slices
Integration tests
Security tests
E2E
```

### Level 8: Release

```text
Build
Deployment
Acceptance
Rollback
```

---

# 31. Parallel Implementation

Some work can proceed in parallel when ownership is independent.

Potential examples:

```text id="v8m4x7"
Products ────── Customers
    │
    └── Inventory
```

and:

```text id="x5c8m4"
Media ────── Notifications
```

However, parallel implementation must not bypass dependencies.

---

# 32. Safe Parallelism Rule

Two teams/agents may work in parallel only when:

```text id="m4n8c7"
Their ownership boundaries are separate
Their database changes do not conflict
Their public interfaces are defined
Their work does not require unfinished internal implementation
```

If those conditions are not met, sequence the work instead.

---

# 33. Critical Path

The critical Demo path is:

```text id="q8c5m4"
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
Customers
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
Full Purchase E2E
```

This path should receive priority over secondary capabilities.

---

# 34. Secondary Path

The following can be integrated around the critical path:

```text id="v7m4c8"
Media
Notifications
Webhooks
Jobs
Observability enhancements
```

However, Payments and Checkout webhooks must be ready before declaring the purchase flow production-quality for the Demo.

---

# 35. Database Dependency Order

Database implementation should generally follow:

```text id="x8c4m7"
Identity
 ↓
Organization
 ↓
Membership
 ↓
Store
 ↓
Product
 ↓
Variant
 ↓
Inventory
 ↓
Customer
 ↓
Address
 ↓
Cart
 ↓
Cart Item
 ↓
Discount
 ↓
Checkout
 ↓
Payment
 ↓
Order
 ↓
Order Item
 ↓
Supporting history/idempotency/webhook/job tables
```

Exact migration grouping should follow the approved database implementation plan.

---

# 36. API Dependency Order

API implementation should generally follow:

```text id="m5n8c4"
Authentication
 ↓
Store APIs
 ↓
Product APIs
 ↓
Inventory APIs
 ↓
Customer APIs
 ↓
Cart APIs
 ↓
Discount APIs
 ↓
Checkout APIs
 ↓
Payment APIs
 ↓
Order APIs
 ↓
Storefront APIs
```

Do not expose APIs before the underlying application capability is correctly implemented.

---

# 37. Verification Dependency Order

Verification should progress as:

```text id="q7c4m8"
Unit
 ↓
Database Integration
 ↓
Module Integration
 ↓
API Integration
 ↓
Security
 ↓
Cross-domain
 ↓
E2E
 ↓
Deployment
 ↓
Demo Acceptance
```

Failures should be resolved at the lowest useful verification level.

---

# 38. Blocking Dependencies

The following are hard blockers:

```text id="v8m4x7"
No database transaction support
No tenant context
No authorization foundation
No reliable migration system
No payment idempotency strategy
No inventory concurrency strategy
No isolated test environment
```

Do not implement downstream critical workflows while these remain unresolved.

---

# 39. Dependency Completion Criteria

A dependency is considered complete when:

```text id="x5c8m4"
Implementation exists
Public interface is stable
Tests exist
Security requirements are satisfied
Required database changes exist
Integration behavior is verified
Definition of Done is satisfied
```

Code existing in the repository does not automatically mean its dependency is complete.

---

# 40. Dependency Change Rule

If a new implementation discovers an unexpected dependency:

```text id="m4n8c7"
1. Identify the dependency.
2. Determine whether it is architectural or implementation-specific.
3. Check existing documentation.
4. Add or modify the appropriate specification if required.
5. Update implementation order.
6. Implement the prerequisite.
```

Do not create hidden dependencies through shortcuts.

---

# 41. No Circular Domain Dependencies

The domain graph must remain acyclic at the architectural level.

If two domains appear to require each other:

```text id="q8c5m4"
A → B
B → A
```

evaluate whether the relationship should instead use:

```text id="v7m4c8"
Event
Application orchestration
Shared contract
Historical snapshot
```

Do not solve architectural cycles with arbitrary direct imports.

---

# 42. Dependency Verification Checklist

Before starting each implementation group:

```text id="x8c4m7"
[ ] Prerequisites identified
[ ] Prerequisites implemented
[ ] Public interfaces available
[ ] Database prerequisites available
[ ] Security context available
[ ] Test infrastructure available
[ ] No circular dependency introduced
[ ] No internal module access required
```

---

# 43. Final Implementation Sequence

The recommended complete sequence is:

```text id="m5n8c4"
PHASE 1
Repository + tooling

PHASE 2
Shared packages + runtime foundation

PHASE 3
Database + migrations + seeds

PHASE 4
Authentication + tenant + authorization + API foundation

PHASE 5
Stores

PHASE 6
Products

PHASE 7
Inventory

PHASE 8
Customers

PHASE 9
Carts

PHASE 10
Discounts

PHASE 11
Checkout

PHASE 12
Payments

PHASE 13
Orders

PHASE 14
Storefront

PHASE 15
Media + Notifications + Webhooks + Jobs

PHASE 16
Vertical slices

PHASE 17
Full verification

PHASE 18
Demo deployment

PHASE 19
Demo acceptance
```

---

# 44. Definition of Done

Dependency-order planning is complete when:

```text id="q7c4m8"
[ ] Every major module has identified prerequisites
[ ] Critical path is defined
[ ] Database dependency order is defined
[ ] API dependency order is defined
[ ] Verification dependency order is defined
[ ] Parallelizable work is identified
[ ] Blocking dependencies are identified
[ ] Circular dependency rules are established
[ ] Domain implementation sequence is documented
[ ] Release dependencies are understood
```

The implementation team should now be able to determine **what must exist before any given component can safely be built**, without inventing architecture during implementation.