# Application Architecture

## 1. Purpose

This document defines the internal application architecture of the Demo platform.

It explains how the runtime applications, business modules, shared packages, and infrastructure components interact.

The goal is to maintain a modular monolith that is simple to operate while enforcing strong boundaries between business capabilities.

This document defines **application structure and interaction patterns**, not individual domain rules or database schemas.

---

# 2. Application Structure

The Demo consists of two runtime applications:

```text
apps/
├── web/
└── worker/
```

These applications use the shared business modules and packages:

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

The relationship is:

```text
                    ┌───────────────────┐
                    │    apps/web       │
                    │                   │
                    │ UI + API + Web    │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ Business Modules  │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ Shared Packages   │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ Infrastructure    │
                    │ PostgreSQL / etc. │
                    └───────────────────┘

                    ┌───────────────────┐
                    │   apps/worker     │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ Business Modules  │
                    └───────────────────┘
```

---

# 3. Application Responsibilities

## 3.1 `apps/web`

The web application is the primary synchronous runtime.

It is responsible for:

- Merchant-facing interfaces
- Customer-facing storefront
- HTTP/API request handling
- Authentication entry points
- Request validation
- Tenant resolution
- Authorization coordination
- Invoking application services
- Rendering responses
- Returning appropriate errors

It should not become the location where all business logic is implemented.

---

## 3.2 `apps/worker`

The worker handles asynchronous processing.

Responsibilities include:

- Background jobs
- Event consumers
- Retryable secondary operations
- Notifications
- Asynchronous integrations
- Scheduled processing where required

The worker MUST use the same business rules as the web application.

It MUST NOT create a second implementation of commerce logic.

---

# 4. Internal Module Architecture

Each business module should have a clear internal structure.

A conceptual module may look like:

```text
modules/products/
├── application/
├── domain/
├── infrastructure/
├── index.ts
└── ...
```

The exact directory structure may evolve as implementation progresses.

The important architectural distinction is between:

```text
Public Interface
      ↓
Application Logic
      ↓
Domain Logic
      ↓
Infrastructure
```

Internal organization may vary when the module is small.

The architecture does not require every module to contain identical folders purely for aesthetic symmetry.

---

# 5. Public Module Interface

Each module MUST expose a controlled public interface.

Conceptually:

```text
                 ┌─────────────────────┐
                 │   Other Modules     │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │  Public Interface   │
                 │      Module         │
                 └──────────┬──────────┘
                            │
                 ┌──────────┴──────────┐
                 │                     │
                 ▼                     ▼
           Application             Domain
           Services                Logic
                 │
                 ▼
           Infrastructure
```

Consumers SHOULD depend on the module's public application interfaces rather than its internal files.

---

# 6. Application Layer

The application layer coordinates use cases.

Examples include:

```text
CreateProduct
UpdateProduct
AdjustInventory
CreateCart
AddCartItem
StartCheckout
CreateOrder
ProcessPayment
CreateDiscount
```

An application service may:

1. Resolve the required context.
2. Validate authorization.
3. Load required domain state.
4. Execute domain operations.
5. Persist changes.
6. Publish appropriate events.
7. Return a result.

Application services should coordinate business operations rather than become giant procedural functions containing every business rule.

---

# 7. Domain Layer

The domain layer contains business rules and invariants.

Examples:

### Product

- Product publication rules
- Product validity rules

### Inventory

- Quantity constraints
- Availability rules
- Inventory adjustment rules

### Cart

- Quantity rules
- Cart item rules

### Checkout

- Checkout eligibility
- Purchase validation

### Payment

- Payment state transitions

### Order

- Order state transitions
- Historical transaction rules

Domain logic should remain independent of presentation concerns.

---

# 8. Infrastructure Layer

Infrastructure contains technical implementations required by the business modules.

Examples:

- PostgreSQL repositories
- Payment provider clients
- Object storage clients
- Email providers
- External APIs
- Queue/job infrastructure

The domain should not need to know which specific infrastructure provider is being used when the provider is an implementation detail.

---

# 9. Dependency Direction

Dependencies should generally point inward toward business logic.

```text
Presentation
     │
     ▼
Application
     │
     ▼
Domain
     ▲
     │
Infrastructure
```

Infrastructure implements capabilities required by the application/domain rather than defining the business rules.

For example:

```text
Payment Domain
      ▲
      │
Payment Provider Adapter
```

rather than:

```text
Payment Domain
      │
      ▼
Specific Provider SDK
```

The latter unnecessarily couples the business domain to an external vendor.

---

# 10. Web Request Architecture

A typical web request follows:

```text
HTTP Request
     ↓
Route / Controller
     ↓
Authentication
     ↓
Tenant Resolution
     ↓
Authorization
     ↓
Input Validation
     ↓
Application Service
     ↓
Domain Operation
     ↓
Persistence / Integration
     ↓
Result
     ↓
HTTP Response
```

Each layer should have a clear responsibility.

---

# 11. Route and Controller Responsibilities

Routes/controllers should be thin.

They should primarily:

- Receive the request.
- Establish request context.
- Authenticate the user.
- Resolve tenant context.
- Validate input.
- Invoke the appropriate application service.
- Translate the result into an HTTP response.

They should NOT contain large amounts of business logic.

For example, a checkout endpoint should not independently implement:

- Inventory deduction rules
- Discount calculation rules
- Payment state transitions
- Order creation rules

Those belong to their respective domains/application services.

---

# 12. Authentication and Authorization

Authentication answers:

> Who is making this request?

Authorization answers:

> What is this actor allowed to do in this context?

The application must keep those concepts separate.

A request should conceptually pass through:

```text
Request
  ↓
Identify Actor
  ↓
Resolve Organization
  ↓
Resolve Store
  ↓
Resolve Membership / Customer Context
  ↓
Check Permission
  ↓
Execute Operation
```

Authorization MUST be enforced server-side.

---

# 13. Tenant Context

Tenant context should be established early in the request lifecycle.

Conceptually:

```text
Request
  ↓
Actor
  ↓
Tenant Context
  ↓
Store
  ↓
Resource
```

Business operations involving store-owned resources must operate with an explicit store context.

The application must never assume that a resource ID alone is sufficient authorization.

---

# 14. Application Context

A request or background operation may carry a contextual object conceptually containing:

```text
Actor
Organization
Store
Membership / Role
Request Metadata
Correlation Information
```

The exact implementation is determined during implementation.

The architectural requirement is that application services have enough trusted context to enforce authorization and tenancy correctly.

---

# 15. Module-to-Module Communication

Modules may need to collaborate.

For example:

```text
Checkout
   │
   ├── Products
   ├── Inventory
   ├── Discounts
   ├── Payments
   └── Orders
```

The preferred interaction is through public module interfaces.

Example:

```text
Checkout
   │
   ▼
Inventory.reserve/validate(...)
```

rather than:

```text
Checkout
   │
   ▼
Inventory internal repository
   │
   ▼
Inventory internal database structure
```

The second pattern creates tight coupling and makes future evolution harder.

---

# 16. Checkout as an Orchestrator

Checkout is a coordination-heavy capability.

Conceptually:

```text
                 Checkout
                    │
       ┌────────────┼────────────┐
       ▼            ▼            ▼
   Products      Discounts    Inventory
       │            │            │
       └────────────┼────────────┘
                    ▼
                 Payment
                    │
                    ▼
                  Order
```

Checkout should coordinate the purchase workflow without absorbing the internal business rules of every participating module.

---

# 17. Transaction Boundaries

Transactions must be established around operations that require atomic consistency.

Examples include:

- Inventory changes
- Order creation
- Critical checkout state transitions
- Payment state updates where applicable

A transaction should represent a meaningful business boundary rather than being applied indiscriminately to every operation.

The exact transaction boundaries are defined in domain and database documentation.

---

# 18. Events

Events represent facts that have occurred.

Examples:

```text
ProductPublished
InventoryAdjusted
PaymentSucceeded
PaymentFailed
OrderCreated
OrderStatusChanged
```

A module may publish an event after its transactional state has been successfully persisted.

Events can then trigger secondary processing.

Example:

```text
OrderCreated
     │
     ├──→ Notification
     ├──→ Email
     └──→ Other Secondary Processing
```

Events should not be used to replace synchronous operations that must be atomic.

---

# 19. Background Job Architecture

Background jobs follow a similar structure to web requests:

```text
Job
 ↓
Load Job Context
 ↓
Resolve Tenant
 ↓
Validate Required State
 ↓
Invoke Application Service
 ↓
Domain Operation
 ↓
Persist Result
 ↓
Publish Secondary Events
```

The worker must preserve:

- Tenant context
- Authorization assumptions
- Idempotency
- Retry safety
- Business invariants

---

# 20. Shared Package Usage

Shared packages should provide technical or genuinely cross-cutting capabilities.

### Appropriate examples

```text
auth
config
db
event-bus
tenant
types
ui
validation
```

### Inappropriate use

A generic package such as:

```text
packages/utils/
```

should not become a dumping ground for unrelated business logic.

Business logic belongs to its owning domain.

---

# 21. Database Access

Application modules may use the shared database infrastructure.

However, database access should respect module ownership.

Conceptually:

```text
Products Module
      │
      ▼
Product Data

Inventory Module
      │
      ▼
Inventory Data

Orders Module
      │
      ▼
Order Data
```

Another module should not directly manipulate another module's internal persistence structures simply because the database makes it technically possible.

Database ownership rules are defined separately in:

```text
docs/database/data-ownership.md
```

---

# 22. External Service Access

External services should be accessed through integration boundaries.

Example:

```text
Payment Application Service
          │
          ▼
Payment Provider Interface
          │
          ▼
Provider Adapter
          │
          ▼
External Payment API
```

This keeps provider-specific concerns isolated.

Changing payment providers should not require rewriting the checkout domain.

---

# 23. Error Propagation

Errors should be classified appropriately.

Conceptually:

```text
Domain Error
    ↓
Application Layer
    ↓
Presentation Layer
    ↓
User-Friendly Response
```

Infrastructure failures should not be exposed directly to users.

For example, a database connection error should not become a raw database error message in the storefront.

---

# 24. Observability Context

Important application operations should carry enough context to support troubleshooting.

Useful contextual information includes:

- Request identifier
- Actor identifier where appropriate
- Organization/store identifier
- Operation name
- Entity identifier
- Job identifier
- External provider reference where applicable

Sensitive information must not be unnecessarily written to logs.

---

# 25. Testing Boundaries

The application structure should allow tests at multiple boundaries.

### Module Unit Tests

Test business rules independently.

### Application Tests

Test use cases and orchestration.

### Integration Tests

Test database and external integration behavior.

### End-to-End Tests

Test complete user journeys.

For example:

```text
Merchant
  ↓
Create Product
  ↓
Publish Product
  ↓
Customer
  ↓
Add to Cart
  ↓
Checkout
  ↓
Payment
  ↓
Order
```

---

# 26. Avoiding Architectural Leakage

The following patterns are prohibited unless explicitly justified:

### UI accessing database directly

```text
UI → PostgreSQL
```

### Route implementing domain logic

```text
Route → Hundreds of business rules
```

### Cross-module internal imports

```text
Checkout → Inventory/internal/repository
```

### Provider logic inside domain

```text
Order Domain → Stripe SDK
```

### Worker-specific business rules

```text
Worker → Duplicate Order Logic
```

Instead:

```text
Web ──────┐
          ├──→ Application Services
Worker ───┘
                │
                ▼
             Domain
                │
                ▼
          Infrastructure
```

---

# 27. Module Growth

A module may begin small.

It should only gain additional internal layers when complexity justifies them.

For example:

```text
Small Module
modules/products/
└── index.ts
```

may eventually evolve into:

```text
modules/products/
├── application/
├── domain/
├── infrastructure/
└── index.ts
```

The architecture does not require artificial complexity on day one.

The objective is **clear boundaries, not maximum folder count**.

---

# 28. Future Extraction

If a module eventually needs to become an independent service, the existing boundaries should make extraction possible.

Potential future candidates might include:

- Search
- Payments
- Notifications
- Analytics
- Large-scale catalog processing

However, extraction should happen only when operational or scaling requirements justify it.

The Demo should remain a modular monolith unless there is a concrete reason to distribute it.

---

# 29. Application-Level Invariants

The application architecture must preserve these invariants:

1. Every protected operation has a trusted actor context.
2. Every store-owned operation has a valid tenant context.
3. Authorization is enforced server-side.
4. Business rules are not implemented in presentation code.
5. Critical operations use appropriate transaction boundaries.
6. Modules do not bypass each other's public interfaces.
7. External integrations are isolated.
8. Background jobs preserve business invariants.
9. Retryable operations are designed for safe retries.
10. Shared packages remain focused.

---

# 30. Definition of Done

The application architecture is correctly implemented when:

- `apps/web` handles synchronous application interaction.
- `apps/worker` handles asynchronous processing.
- Business logic is organized into domain modules.
- Shared technical capabilities live in packages.
- Routes/controllers remain thin.
- Application services coordinate use cases.
- Domain logic owns business rules.
- Infrastructure concerns remain isolated.
- Tenant context is enforced.
- Authorization is server-side.
- Critical operations have appropriate transaction boundaries.
- Cross-module access uses public interfaces.
- External integrations are isolated behind boundaries.
- The structure supports unit, integration, and end-to-end testing.
- The architecture remains suitable for future V1 evolution without requiring unnecessary premature distribution.

---

# 31. Summary

The application architecture follows:

```text
                    Clients
                       │
                       ▼
                  apps/web
                       │
          ┌────────────┴────────────┐
          │                         │
          ▼                         ▼
   Authentication             Tenant Context
          │                         │
          └────────────┬────────────┘
                       ▼
                 Authorization
                       │
                       ▼
              Application Services
                       │
                       ▼
                Domain Modules
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
       Database     Events      Integrations
          │            │            │
          └────────────┼────────────┘
                       ▼
                  Infrastructure

                 apps/worker
                       │
                       └──→ Application Services
```

The central rule is:

> **Presentation handles interaction, application services coordinate use cases, domains enforce business rules, and infrastructure handles technical dependencies.**

This structure keeps the Demo simple enough to build while preventing the usual modular-monolith tragedy where everything eventually imports everything else.