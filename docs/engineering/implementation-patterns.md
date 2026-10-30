# Implementation Patterns

## 1. Purpose

This document defines the preferred implementation patterns for the Cal Cart commerce platform.

These patterns provide consistency without forcing every feature into an unnecessary abstraction.

The primary goal is to make business behavior explicit, preserve module boundaries, and keep the Demo capable of evolving into V1.

---

## 2. General Pattern

The preferred flow for application functionality is:

```text
Request
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
Domain Logic
  ↓
Repository / Integration
  ↓
Database / External Provider
  ↓
Result
```

Not every operation requires every layer, but responsibilities should remain clear.

---

## 3. Thin Presentation Layer

API handlers, route handlers, and server actions should coordinate rather than contain business workflows.

Preferred:

```text
API Handler
    ↓
Validate input
    ↓
Authorize
    ↓
Application Service
```

Avoid:

```text
API Handler
    ↓
Validate
    ↓
Calculate pricing
    ↓
Reserve inventory
    ↓
Create payment
    ↓
Create order
    ↓
Send email
```

The second approach makes business logic difficult to reuse and test.

---

## 4. Application Service Pattern

Application services represent meaningful use cases.

Examples:

```text
CreateProduct
PublishProduct
ReserveInventory
CreateCheckout
CompleteCheckout
CapturePayment
CreateOrder
CancelOrder
```

An application service should coordinate the operation.

Example:

```text
CompleteCheckout
    ↓
Load checkout
    ↓
Validate state
    ↓
Recalculate totals
    ↓
Reserve inventory
    ↓
Coordinate payment
    ↓
Create order
    ↓
Publish events
```

The application service should not become a replacement for domain ownership.

---

## 5. Domain Rule Pattern

Business rules should live close to the domain that owns them.

Example:

```text
Inventory
    └── canReserve(quantity)

Discounts
    └── calculateDiscount(context)

Orders
    └── canTransition(from, to)
```

Avoid implementing the same rule independently in:

```text
API
Frontend
Worker
Checkout
```

The server-side domain remains authoritative.

---

## 6. Aggregate Pattern

Use aggregates where a group of entities must maintain consistency.

Examples:

```text
Order
Checkout
Cart
Product
Store
```

An aggregate should protect its invariants.

For example:

```text
Order
    ├── status
    ├── items
    └── addresses
```

Operations that must maintain order invariants should go through the appropriate aggregate/application boundary.

Do not treat every database table as automatically being an aggregate.

---

## 7. Value Object Pattern

Use value objects for concepts with important validation or semantics.

Examples:

```text
Money
Currency
SKU
EmailAddress
Quantity
Address
Percentage
DateRange
```

A value object should represent a valid concept rather than repeatedly passing ambiguous primitives.

Example:

```ts
type Money = {
  amount: bigint;
  currency: Currency;
};
```

The exact representation must follow the database and application conventions.

---

## 8. Repository Pattern

Repositories should encapsulate persistence operations for their owning module.

Examples:

```text
ProductRepository
InventoryRepository
OrderRepository
CustomerRepository
```

Repositories should not contain business workflows.

Preferred:

```text
Application Service
    ↓
Repository
    ↓
Database
```

Avoid:

```text
Repository
    ↓
Reserve inventory
    ↓
Charge payment
    ↓
Create order
```

Repositories persist and retrieve data. Application/domain layers determine business behavior.

---

## 9. Query vs Command Separation

Where useful, distinguish between:

### Commands

Change state.

Examples:

```text
createProduct
reserveInventory
completeCheckout
capturePayment
cancelOrder
```

### Queries

Read state without changing it.

Examples:

```text
getProduct
listProducts
getOrder
getCustomer
getInventory
```

This separation improves clarity and reduces accidental mutations.

---

## 10. Transaction Boundary Pattern

The application service should normally define the transaction boundary.

Example:

```text
CompleteCheckout
    ↓
BEGIN TRANSACTION
    ↓
validate state
    ↓
reserve inventory
    ↓
create order
    ↓
record transactional state
    ↓
COMMIT
```

Do not scatter transaction management across multiple repositories unless the architecture explicitly requires it.

---

## 11. External Integration Pattern

External providers should be hidden behind internal interfaces.

Example:

```text
Payment domain
      ↓
PaymentProvider
      ↓
SandboxPaymentProvider
      ↓
Provider SDK/API
```

The domain should not depend directly on provider-specific SDK types.

This makes provider replacement and testing easier.

---

## 12. Adapter Pattern

Adapters translate external representations into internal representations.

Example:

```text
External Payment Response
        ↓
Payment Adapter
        ↓
Internal Payment Result
```

Provider-specific statuses should be translated into internal payment states.

For example:

```text
provider: "succeeded"
        ↓
internal: CAPTURED
```

Do not spread provider-specific status strings throughout the application.

---

## 13. Gateway Pattern

Use a gateway when an application needs a stable interface to an external capability.

Examples:

```text
PaymentGateway
StorageGateway
EmailGateway
```

The gateway should expose the capabilities the application actually needs rather than reproducing the entire provider SDK.

Prefer:

```ts
paymentGateway.capturePayment(...)
```

over exposing the complete provider client throughout the codebase.

---

## 14. Event Pattern

Domain events represent facts that have already happened.

Examples:

```text
ProductPublished
InventoryReserved
CheckoutCompleted
PaymentCaptured
OrderCreated
```

Events should be emitted after the relevant state change has successfully occurred.

Do not emit a success event before the underlying transaction is safely committed unless the architecture explicitly provides reliable transactional event publication.

---

## 15. Event Payload Pattern

Events should contain stable identifiers and relevant information.

Example:

```json
{
  "eventId": "evt_123",
  "eventType": "OrderCreated",
  "storeId": "store_123",
  "orderId": "order_123",
  "occurredAt": "2026-10-07T10:00:00Z"
}
```

Avoid putting entire database records into event payloads.

Consumers should retrieve additional data through supported interfaces when necessary.

---

## 16. Job Pattern

Jobs represent work that can be executed asynchronously.

Examples:

```text
SendOrderConfirmationEmail
ProcessPaymentWebhook
ReleaseExpiredInventoryReservation
ReconcilePayment
```

A job should contain enough information to execute independently.

Example:

```json
{
  "jobType": "SendOrderConfirmationEmail",
  "orderId": "order_123",
  "storeId": "store_123"
}
```

---

## 17. Idempotent Job Pattern

Jobs that may be retried must be safe against duplicate execution.

Example:

```text
Job
 ↓
Check idempotency / current state
 ↓
Perform operation
 ↓
Record completion
```

For example, sending an email may require a delivery record or another mechanism that prevents unintended duplicate side effects.

---

## 18. State Machine Pattern

Entities with meaningful lifecycle states should use explicit state transitions.

Example:

```text
Order

PENDING
  ↓
CONFIRMED
  ↓
PROCESSING
  ↓
SHIPPED
  ↓
DELIVERED
  ↓
COMPLETED
```

Invalid transitions should be rejected.

Avoid scattered conditionals such as:

```ts
if (status === "PENDING" || status === "CONFIRMED" || ...)
```

throughout unrelated parts of the application.

Centralize transition rules.

---

## 19. Factory Pattern

Factories may be used when creating a valid domain object requires multiple rules.

Example:

```text
Product.create(...)
Order.create(...)
Checkout.create(...)
```

Factories should enforce construction invariants.

Do not create factories merely because every class needs a factory.

Simple objects can be constructed directly.

---

## 20. Strategy Pattern

Use strategies when multiple legitimate implementations of the same capability exist.

Examples:

```text
PaymentProvider
DiscountCalculationStrategy
ShippingCalculationStrategy
```

For the Demo, do not introduce a strategy hierarchy for hypothetical future providers.

Use it when the project actually has multiple implementations or requires a stable extension boundary.

---

## 21. Policy Pattern

Policies can encapsulate authorization or eligibility rules.

Examples:

```text
CanManageStore
CanViewOrder
CanApplyDiscount
CanCancelOrder
```

Policies should remain explicit and testable.

Authorization policies must execute server-side.

---

## 22. Specification Pattern

Use specification-like rules when a business condition is complex enough to benefit from explicit composition.

Examples:

```text
CustomerIsEligible
OrderMeetsMinimumAmount
ProductIsEligibleForDiscount
```

Do not introduce a formal specification framework for simple boolean checks.

---

## 23. Mapper Pattern

Use mappers at boundaries where representations differ.

Examples:

```text
Database record
    ↓
Domain model

Domain/application result
    ↓
API DTO

Provider response
    ↓
Internal payment result
```

Mappers should not silently alter business meaning.

---

## 24. DTO Pattern

DTOs should represent communication contracts.

Examples:

```text
CreateProductRequest
ProductResponse
CreateCheckoutRequest
CheckoutResponse
OrderResponse
```

Do not expose internal database entities directly through public APIs.

DTOs may intentionally contain a subset or transformed representation of internal data.

---

## 25. Pagination Pattern

List endpoints should use a consistent pagination contract.

The implementation should define:

- Page size limits.
- Ordering.
- Cursor or offset semantics.
- Filtering behavior.
- Stable ordering.

Avoid unbounded queries.

For large or frequently changing datasets, cursor-based pagination may be preferable.

The specific API contract is defined in the API documentation.

---

## 26. Repository Query Pattern

Repositories should expose queries that represent useful module capabilities.

Prefer:

```text
findProductById
findActiveProducts
findOrderForCustomer
findInventoryItem
```

over generic methods that expose arbitrary database access everywhere.

Avoid creating a repository abstraction that simply mirrors every SQL statement without meaningful ownership.

---

## 27. Transactional Workflow Pattern

For workflows crossing multiple modules:

```text
Application Service
      ↓
Module A public interface
      ↓
Module B public interface
      ↓
Database transaction
      ↓
Commit
      ↓
Events/jobs
```

The application service coordinates.

Individual modules retain ownership of their business rules.

---

## 28. Checkout Pattern

Checkout is a critical workflow.

Preferred conceptual flow:

```text
Load Checkout
    ↓
Validate checkout state
    ↓
Recalculate authoritative pricing
    ↓
Validate discount
    ↓
Reserve inventory
    ↓
Initiate/verify payment
    ↓
Create order
    ↓
Finalize checkout
    ↓
Publish events
    ↓
Schedule secondary work
```

The exact transaction and provider interaction boundaries must follow the Checkout, Inventory, Payments, and Orders specifications.

---

## 29. Payment Webhook Pattern

Webhook processing should follow:

```text
Receive webhook
    ↓
Verify signature
    ↓
Identify provider event
    ↓
Check replay/idempotency
    ↓
Translate provider state
    ↓
Apply internal state transition
    ↓
Persist result
    ↓
Trigger required secondary work
```

Never trust an unsigned or unverified webhook.

---

## 30. Inventory Reservation Pattern

Inventory reservation should use the Inventory module's concurrency-safe interface.

Conceptually:

```text
Load inventory
    ↓
Lock / atomic conditional update
    ↓
Verify available quantity
    ↓
Create reservation
    ↓
Update inventory state
    ↓
Commit
```

Do not perform:

```text
read available quantity
→ wait
→ write new quantity
```

without concurrency protection.

---

## 31. Idempotency Pattern

For idempotent operations:

```text
Receive request
    ↓
Validate idempotency key
    ↓
Check existing operation
    ↓
Existing result?
   ├── yes → return stored result
   └── no
        ↓
Execute operation
        ↓
Persist result atomically
        ↓
Return result
```

Conflicting reuse of the same key must be rejected.

---

## 32. Outbox-Style Reliability

When a critical database state change must reliably result in asynchronous work, the project may use a transactional outbox-style pattern.

Conceptually:

```text
BEGIN TRANSACTION
    ↓
Update business state
    ↓
Record event/job intent
    ↓
COMMIT
    ↓
Worker publishes/processes intent
```

This should be introduced when the requirement exists.

Do not implement a complete distributed messaging platform for the Demo merely because the pattern exists.

---

## 33. Retry Pattern

Retries should be:

- Bounded.
- Intentional.
- Backoff-aware.
- Idempotency-aware.

Conceptually:

```text
Attempt 1
   ↓
temporary failure
   ↓
wait
   ↓
Attempt 2
   ↓
temporary failure
   ↓
wait
   ↓
Attempt 3
   ↓
terminal failure
```

Never retry permanently invalid business operations.

---

## 34. Cache Pattern

Caching should be introduced only where the performance requirement justifies it.

A cache must never become the authoritative source of critical commerce state.

Do not use cache state as the final authority for:

```text
inventory
payment state
order state
checkout state
authorization
```

PostgreSQL remains the transactional source of truth.

---

## 35. Search Pattern

The Demo should use PostgreSQL-backed search/filtering where sufficient.

Do not introduce a dedicated search engine until actual requirements justify it.

The search interface should still remain sufficiently isolated that a future search implementation can replace the underlying query strategy.

---

## 36. File and Media Pattern

Binary media should be stored outside PostgreSQL when object storage is used.

Typical flow:

```text
Client
  ↓
Authorized upload flow
  ↓
Object storage
  ↓
Metadata stored in database
```

The database stores metadata and ownership information.

Application authorization must control who can create, access, or delete media.

---

## 37. Configuration Pattern

Application components should consume validated configuration rather than accessing environment variables directly.

Preferred:

```text
config
  ↓
application/service/integration
```

Avoid:

```text
business logic
  ↓
process.env
```

Configuration rules are defined in:

```text
docs/engineering/configuration-management.md
```

---

## 38. Error Mapping Pattern

Errors should be translated at architectural boundaries.

Example:

```text
Database constraint error
        ↓
Infrastructure error
        ↓
Application/domain error
        ↓
API error code
        ↓
HTTP response
```

Do not expose infrastructure implementation details to customers.

---

## 39. Observability Pattern

Important operations should emit useful operational signals.

Example:

```text
Application service
    ↓
structured log
    ↓
requestId
storeId
resourceId
operation
duration
result
```

Business events and operational logs remain separate concerns.

---

## 40. Anti-Patterns

Avoid:

### God services

One service containing every business operation.

### God repositories

One repository accessing every module's data.

### Generic service layers

Abstractions such as:

```text
BaseService
BaseManager
BaseProcessor
```

without meaningful behavior.

### Generic utility dumping grounds

Putting unrelated business logic into:

```text
utils/
helpers/
common/
```

### Direct cross-module database access

A module modifying another module's tables directly.

### Infrastructure-first design

Adding queues, caches, search engines, or microservices before a requirement exists.

### Silent fallback

Returning fake/default values when a critical operation fails.

---

## 41. Pattern Selection Rules

When implementing a feature:

1. Start with the simplest architecture that satisfies the requirement.
2. Reuse existing project patterns.
3. Introduce an abstraction only when it creates a meaningful boundary.
4. Keep ownership explicit.
5. Prefer composition over deep inheritance.
6. Avoid speculative extensibility.
7. Preserve testability.
8. Preserve tenant and security boundaries.
9. Preserve transactional correctness.
10. Document architectural decisions when they materially change the system.

---

## 42. AI-Assisted Implementation

AI agents should use these patterns as guidance, not as a checklist requiring every pattern in every feature.

An agent should first determine:

```text
What is the requirement?
        ↓
Which module owns it?
        ↓
What existing pattern solves it?
        ↓
What is the smallest correct implementation?
```

The agent must not introduce a factory, strategy, gateway, event bus, repository, abstraction, or service merely because this document contains the pattern name.

Patterns exist to solve recurring problems, not to decorate code.

---

## 43. Definition of Done

An implementation is aligned with project patterns when:

- Responsibilities are clearly separated.
- Business logic remains in the owning domain.
- Application services coordinate meaningful use cases.
- Persistence remains behind appropriate boundaries.
- External integrations are isolated.
- Transactions are explicit.
- Critical operations are concurrency-safe.
- Retry and idempotency behavior is deliberate.
- API contracts are separated from persistence models.
- Observability is sufficient.
- No unnecessary abstraction or infrastructure has been introduced.
- The implementation remains suitable for evolution from Demo to V1.