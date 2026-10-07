# Implementation Dependency Map

## 1. Purpose

This document defines the dependency relationships between the platform foundation, shared packages, domain modules, applications, infrastructure, and external integrations.

The purpose is to make implementation dependencies explicit before code is built.

The dependency map prevents accidental circular dependencies, direct access to another module's internals, and premature infrastructure decisions.

---

# 2. Dependency Principles

The implementation follows these rules:

1. Dependencies must point toward stable abstractions.
2. Domain modules must not depend on another module's internal implementation.
3. Shared packages must not contain business-domain rules.
4. Infrastructure implementations must sit behind interfaces where provider replacement is expected.
5. Presentation must depend on application services, not directly on repositories.
6. Worker execution must invoke application-level handlers.
7. Database ownership must remain with the owning module.
8. Circular dependencies must be resolved through interfaces, events, or orchestration.
9. Authentication and tenant context are foundational capabilities.
10. PostgreSQL remains the authoritative source of transactional state.

---

# 3. High-Level Dependency Graph

```text id="f7qkz8"
                    ┌───────────────────┐
                    │   External Client │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │    apps/web       │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ Presentation/API  │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ Application Layer │
                    └─────────┬─────────┘
                              │
             ┌────────────────┼────────────────┐
             ▼                ▼                ▼
        Domain Modules   Shared Packages   Integrations
             │                │                │
             └────────────────┼────────────────┘
                              ▼
                         PostgreSQL
```

---

# 4. Shared Package Dependency Layer

The shared packages provide technical capabilities used by multiple modules.

```text id="t4a8cz"
packages/
├── config
├── types
├── validation
├── auth
├── tenant
├── db
├── event-bus
└── ui
```

Their responsibilities must remain separated.

---

# 5. Configuration Package

```text id="j5r6v9"
packages/config
```

### Depends On

- Environment variables.
- Configuration schema/validation libraries where selected.

### Used By

- `apps/web`
- `apps/worker`
- Database infrastructure.
- Authentication.
- External adapters.
- Object storage.
- Notification providers.

### Must Not Depend On

- Products.
- Orders.
- Payments.
- Checkout.
- Other business domains.

Configuration is foundational and must remain domain-neutral.

---

# 6. Types Package

```text id="n3m7x2"
packages/types
```

Provides:

- Shared primitive types.
- API-independent common types.
- Identifiers where appropriate.
- Common technical result types.

It must not become a dumping ground for business-domain models.

Domain-specific types should remain within their owning module.

---

# 7. Validation Package

```text id="q8v4m6"
packages/validation
```

Provides reusable validation infrastructure.

Used by:

- API boundaries.
- Shared application boundaries.
- Configuration validation.

Business-specific validation remains inside the owning domain.

For example:

```text
Price > 0
```

may belong to Product domain rules rather than a generic validation package.

---

# 8. Database Package

```text id="c6p9w3"
packages/db
```

Provides:

- PostgreSQL connection.
- Connection pooling.
- Transaction infrastructure.
- Migration integration.
- Database utilities.

It must not own business entities.

Domain modules use database infrastructure through their own repositories.

---

# 9. Authentication Package

```text id="z7m2q5"
packages/auth
```

Provides:

- User identity.
- Authentication.
- Sessions.
- Authentication context.

It may depend on:

```text
config
db
types
validation
```

It must not depend on:

```text
products
orders
payments
checkout
inventory
```

Authentication is foundational.

---

# 10. Tenant Package

```text id="r4n8c6"
packages/tenant
```

Provides:

- Organization context.
- Store context.
- Membership resolution.
- Tenant identification utilities.

It may depend on:

```text
auth
db
types
```

It must not depend on business-domain implementations.

---

# 11. Event Bus Package

```text id="m8c3x7"
packages/event-bus
```

Provides:

- Domain event interfaces.
- Event publication abstractions.
- Event handler registration where appropriate.

It must remain generic.

It must not contain:

```text
Order logic
Payment logic
Inventory logic
```

The owning module defines event semantics.

---

# 12. UI Package

```text id="v5q9m2"
packages/ui
```

Provides shared presentation components.

It should depend only on presentation-safe shared types and UI dependencies.

It must not import:

```text
database
repositories
domain services
server secrets
```

The UI layer must not become a hidden backend dependency.

---

# 13. Domain Dependency Layers

The major business domains can be grouped as:

```text id="2h4g7d"
Foundation Domains
    Stores
    Customers

Catalog Domains
    Products
    Inventory

Commerce Domains
    Carts
    Discounts
    Checkout
    Payments
    Orders

Presentation Domain
    Storefront

Supporting Domains
    Media
    Notifications
    Webhooks
    Jobs
```

---

# 14. Stores Dependencies

Stores are foundational to almost every Store-scoped business capability.

```text id="q4x7n9"
Stores
 ├── auth
 ├── tenant
 ├── db
 ├── config
 └── validation
```

Stores must not depend on:

- Orders.
- Checkout.
- Payments.
- Inventory.

Store creation must remain independent of commerce execution.

---

# 15. Products Dependencies

Products depend on:

```text id="n7p4c2"
Products
 ├── Stores
 ├── db
 ├── validation
 └── types
```

Products may expose interfaces consumed by:

- Inventory.
- Carts.
- Checkout.
- Storefront.
- Orders.

Products must not directly depend on those consumers.

---

# 16. Inventory Dependencies

Inventory depends on:

```text id="x5m8q3"
Inventory
 ├── Stores
 ├── Products
 ├── db
 └── validation
```

Inventory owns stock correctness.

Products provide variant identity and product-state information.

Inventory must not depend on Checkout or Orders merely to maintain stock integrity.

---

# 17. Customers Dependencies

Customers depend on:

```text id="c7v2m5"
Customers
 ├── Stores
 ├── auth
 ├── tenant
 ├── db
 └── validation
```

Customers may be consumed by:

- Carts.
- Checkout.
- Orders.
- Notifications.

Customers must not depend on those domains.

---

# 18. Carts Dependencies

Carts depend on:

```text id="p8n4x7"
Carts
 ├── Stores
 ├── Products
 ├── Customers
 ├── db
 └── validation
```

Carts may ask Products whether a Variant is valid/purchasable.

Carts must not directly modify:

```text
Products
Inventory
Checkout
Orders
```

---

# 19. Discounts Dependencies

Discounts depend on:

```text id="m4c9x6"
Discounts
 ├── Stores
 ├── Products
 ├── Customers
 ├── db
 └── validation
```

Discounts may evaluate:

- Product eligibility.
- Customer eligibility.
- Order amount.

Discount calculation remains owned by Discounts.

Checkout invokes Discount services rather than reimplementing discount rules.

---

# 20. Checkout Dependencies

Checkout is an orchestration-heavy domain.

It depends on:

```text id="z6p3m8"
Checkout
 ├── Stores
 ├── Products
 ├── Inventory
 ├── Customers
 ├── Carts
 ├── Discounts
 ├── Payments
 └── db
```

Checkout coordinates these capabilities but must not take ownership of their internal data.

---

# 21. Payment Dependency Direction

Payments depend on:

```text id="j9c4v7"
Payments
 ├── Stores
 ├── Checkout
 ├── db
 └── external provider interfaces
```

However, dependency cycles must be avoided.

Where Checkout and Payments need to communicate in both directions, use:

- Public application interfaces.
- Domain events.
- Explicit orchestration.

Do not import internal Checkout implementation into Payments.

---

# 22. Orders Dependencies

Orders depend conceptually on:

```text id="t6m8x2"
Orders
 ├── Stores
 ├── Products
 ├── Customers
 ├── Inventory
 ├── Discounts
 ├── Checkout
 ├── Payments
 └── db
```

Order creation consumes validated outcomes from these capabilities.

Orders own the durable historical purchase record.

---

# 23. Storefront Dependencies

Storefront is primarily a presentation/query capability.

```text id="h3q7n5"
Storefront
 ├── Stores
 ├── Products
 ├── Inventory
 ├── Carts
 ├── Checkout
 └── UI
```

Storefront must not directly access:

```text
Product tables
Inventory tables
Cart tables
```

It uses public interfaces/application queries.

---

# 24. Media Dependencies

Media depends on:

```text id="w5c8m3"
Media
 ├── Stores
 ├── db
 ├── config
 └── object storage adapter
```

Products may reference Media.

Media must not depend on Product business logic merely to store files.

---

# 25. Notifications Dependencies

Notifications depend on:

```text id="v8m3q6"
Notifications
 ├── Stores
 ├── Customers
 ├── Orders
 ├── Payments
 ├── event-bus
 ├── Jobs
 └── external email provider
```

The dependency should preferably be event/interface based.

Notifications must not modify Orders or Payments.

---

# 26. Webhooks Dependencies

Webhooks depend on:

```text id="q6n4x8"
Webhooks
 ├── db
 ├── config
 ├── event-bus
 ├── Jobs
 └── provider adapters
```

Provider-specific business consequences are delegated to owning domains.

For example:

```text
Webhook
   ↓
Payments Application Service
```

rather than:

```text
Webhook
   ↓
Direct Payment table mutation
```

---

# 27. Jobs Dependencies

The shared job infrastructure depends on:

```text id="m7c2v9"
Jobs
 ├── db
 ├── config
 └── logging/observability
```

Specific job handlers depend on their owning domain.

For example:

```text
SEND_NOTIFICATION
        ↓
Notifications Handler
```

and:

```text
EXPIRE_RESERVATION
        ↓
Inventory Handler
```

---

# 28. Web Application Dependencies

`apps/web` may depend on:

```text id="p5x8m3"
apps/web
 ├── auth
 ├── tenant
 ├── validation
 ├── types
 ├── ui
 └── domain application interfaces
```

The web application should not contain domain business rules.

---

# 29. Worker Dependencies

`apps/worker` depends on:

```text id="c8n4v6"
apps/worker
 ├── config
 ├── db
 ├── jobs
 └── domain job handlers
```

The Worker should not independently implement payment, inventory, order, or notification business rules.

---

# 30. Infrastructure Dependency Direction

Infrastructure implementations sit below application/domain abstractions.

Example:

```text id="v9m5x3"
Application Interface
        ↑
Infrastructure Adapter
        ↑
Provider SDK
```

The domain should not import the provider SDK directly.

---

# 31. Payment Provider Dependency

Correct:

```text id="b4x7m2"
Payments
    ↓
PaymentProvider Interface
    ↓
PaymentProviderAdapter
    ↓
Provider SDK
```

Incorrect:

```text id="n6c3p8"
Checkout
    ↓
Provider SDK
```

---

# 32. Object Storage Dependency

Correct:

```text id="q8m4v7"
Media
   ↓
ObjectStorage Interface
   ↓
Storage Adapter
   ↓
Provider SDK
```

The Media domain should remain provider-neutral.

---

# 33. Email Dependency

Correct:

```text id="x3p7c9"
Notifications
   ↓
EmailSender
   ↓
Email Provider Adapter
   ↓
Provider SDK/API
```

Business domains must not directly send email.

---

# 34. Forbidden Dependencies

The following dependency patterns are prohibited:

```text id="r6m2v8"
Domain → Another Domain's Database Table
```

```text id="k4c9x7"
Domain → Provider SDK
```

```text id="z5n8m3"
UI → Database
```

```text id="p7v3c6"
API Handler → Direct SQL for Business Logic
```

```text id="m9x4q2"
Authentication → Product / Order / Payment
```

```text id="c8v5n7"
Shared Package → Specific Business Module
```

---

# 35. Circular Dependencies

Potential circular relationships include:

```text id="q7m3x9"
Checkout ↔ Payments
Checkout ↔ Orders
Products ↔ Inventory
Orders ↔ Inventory
Orders ↔ Customers
```

These must not become direct implementation-level cycles.

Resolve them using:

- Public interfaces.
- Application orchestration.
- Domain events.
- Read-only query contracts.
- Explicit snapshots.

---

# 36. Product and Inventory Boundary

Products own:

- Variant identity.
- Product lifecycle.
- Pricing.
- Catalog state.

Inventory owns:

- Stock.
- Reservations.
- Availability.

Therefore:

```text id="g6c9v2"
Product
   ↓
Variant Identity
   ↓
Inventory
   ↓
Stock State
```

Products must not contain stock quantities.

Inventory must not become the source of product pricing.

---

# 37. Checkout and Inventory Boundary

Checkout requests inventory operations:

```text id="x2m7c4"
Checkout
   ↓
Inventory.reserve()
```

Checkout does not modify inventory records directly.

Inventory determines whether reservation is possible.

---

# 38. Checkout and Payment Boundary

Checkout coordinates payment:

```text id="p9c4v6"
Checkout
   ↓
Payments Interface
   ↓
Payment Application Service
```

Checkout does not manipulate Payment rows directly.

---

# 39. Payment and Order Boundary

Payment success does not mean Payment owns the Order.

Instead:

```text id="w7m3x8"
Payment Succeeded
      ↓
Application Orchestration
      ↓
Order Creation
```

Orders remain owned by the Orders module.

---

# 40. Order and Product Boundary

Orders must store historical snapshots.

Therefore:

```text id="h8c5m2"
Product
   ↓
Current Catalog State

Order
   ↓
Historical Purchase Snapshot
```

An Order must not depend on a Product remaining unchanged for historical correctness.

---

# 41. Order and Customer Boundary

Orders store required historical customer/address information.

Therefore:

```text id="x4n7m9"
Customer
   ↓
Current Profile

Order
   ↓
Historical Customer Snapshot
```

A customer profile update must not rewrite historical Orders.

---

# 42. Storefront Dependency Rule

Storefront may aggregate read information from multiple domains.

It must not become a second business-rule engine.

For example:

```text id="b5m8x3"
Storefront
    ↓
Product visibility
    ↓
Product capability

Storefront
    ↓
Inventory availability
    ↓
Inventory capability
```

---

# 43. Event Dependency Direction

Events should point from the module that owns the fact toward consumers.

Example:

```text id="f7c3m8"
Orders
  ↓
OrderCreated
  ↓
Notifications
```

Not:

```text
Orders
  ↓
Notifications implementation
```

---

# 44. Job Dependency Direction

Jobs should point toward the operation being performed.

Example:

```text id="v8q4m2"
Job
  ↓
Notification Handler
  ↓
Notification Service
```

The generic Job system must not contain notification-specific logic.

---

# 45. Test Dependency Rules

Tests may depend on more layers than production code when verifying integration behavior.

For example:

```text id="n6m9c3"
Integration Test
   ↓
Application Service
   ↓
Repository
   ↓
PostgreSQL
```

However, unit tests should remain focused and should not require unnecessary infrastructure.

---

# 46. Dependency Matrix

| Component | Primary Dependencies |
|---|---|
| `apps/web` | auth, tenant, validation, UI, application interfaces |
| `apps/worker` | db, config, job infrastructure, job handlers |
| `packages/auth` | db, config, validation, types |
| `packages/tenant` | auth, db, types |
| `packages/db` | PostgreSQL infrastructure |
| `packages/config` | environment/config validation |
| `packages/event-bus` | shared event infrastructure |
| `packages/validation` | validation infrastructure |
| `packages/types` | shared technical types |
| `packages/ui` | UI framework |
| Stores | auth, tenant, db, validation |
| Products | Stores, db, validation |
| Inventory | Stores, Products, db |
| Customers | Stores, auth, db |
| Carts | Stores, Products, Customers, db |
| Discounts | Stores, Products, Customers, db |
| Checkout | Carts, Products, Inventory, Customers, Discounts, Payments |
| Payments | Stores, provider abstraction, db |
| Orders | Checkout, Payments, Inventory, Products, Customers, Discounts |
| Storefront | Stores, Products, Inventory, Carts, Checkout |
| Media | Stores, db, object storage |
| Notifications | events, Orders, Payments, Customers, jobs |
| Webhooks | db, provider adapters, jobs, domain application interfaces |
| Jobs | db, config, worker infrastructure |

---

# 47. Dependency Stability

Stable dependencies should sit below volatile dependencies.

Conceptually:

```text id="c7m2x9"
Stable
  ↓
Configuration
Database
Authentication
Tenant
  ↓
Domain Modules
  ↓
External Integrations
  ↓
Provider Implementations
```

Provider-specific code is expected to change more frequently than core domain contracts.

---

# 48. Dependency Review Rules

Before adding a dependency between modules, ask:

1. Does the consuming module actually require it?
2. Is a public interface sufficient?
3. Can an event remove the coupling?
4. Is the dependency directional?
5. Does it create a circular dependency?
6. Does it violate data ownership?
7. Could the dependency be moved into application orchestration?

Only then should the dependency be introduced.

---

# 49. Dependency Injection

Dependency injection should be used where it improves:

- Testing.
- Provider replacement.
- Boundary enforcement.

Do not introduce a large dependency-injection framework solely for architectural appearance.

Simple constructor/function injection is sufficient for the Demo.

---

# 50. Shared Utilities

A utility should move into a shared package only when:

- Multiple modules genuinely need it.
- Its behavior is domain-neutral.
- Its API is stable.
- Duplication would otherwise create meaningful inconsistency.

Do not create a generic utility package containing unrelated business functions.

---

# 51. Dependency Verification

Dependency correctness should be checked through:

- TypeScript import boundaries.
- Code review.
- Repository structure.
- Automated linting where practical.
- Architecture tests where justified.

The goal is to catch architectural violations before they become deeply embedded.

---

# 52. Final Dependency Rule

The dependency graph should preserve this fundamental direction:

```text id="n8v3m5"
Presentation
     ↓
Application
     ↓
Domain
     ↓
Infrastructure
```

Across modules:

```text id="q5c7x2"
Public Interface
     ↓
Consumer
```

Never:

```text id="j3m9v6"
Consumer
     ↓
Another Module's Internal Implementation
```

The dependency map exists to keep the modular monolith modular.

A monolith without boundaries is merely a large pile of code wearing a serious expression.