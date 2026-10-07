# Domain Model

## 1. Purpose

This document defines the logical business domain model for the Demo commerce platform.

It establishes:

- Core business domains
- Entities
- Aggregates
- Value objects
- Domain responsibilities
- Business invariants
- Domain ownership
- State ownership
- Cross-domain relationships
- Domain events
- Application-service responsibilities

The domain model is independent of the HTTP layer, UI, ORM, and external provider implementations.

---

# 2. Domain Model Principles

The platform follows these principles:

1. Every business concept has a clear owner.
2. Business rules belong to the domain that owns them.
3. Aggregates protect business invariants.
4. Application services coordinate workflows.
5. Domain logic must not depend on HTTP or UI behavior.
6. External provider objects must not leak into the domain model.
7. Database entities and domain entities are related but not necessarily identical.
8. Cross-domain interaction uses public interfaces or domain events.
9. Historical business facts must remain stable.
10. Domain state transitions must be explicit.
11. Multi-tenant boundaries are part of the domain model.
12. Domain rules must not rely on client-side enforcement.

---

# 3. Core Domain Map

The Demo platform contains the following core domains:

```text id="q4m8z1"
Stores
   │
   ├── Products
   │
   ├── Inventory
   │
   ├── Customers
   │
   ├── Carts
   │
   ├── Discounts
   │
   ├── Checkout
   │
   ├── Payments
   │
   └── Orders
```

Supporting technical capabilities include:

```text id="y6r3p8"
Authentication
Validation
Tenant Context
Events
Background Processing
Media
Notifications
```

These supporting capabilities do not replace the business ownership of the core domains.

---

# 4. Domain Ownership

| Domain | Primary Responsibility |
|---|---|
| Stores | Organizations, stores, merchant membership, store configuration |
| Products | Catalog, products, variants, pricing, publication |
| Inventory | Stock state, adjustments, reservations |
| Customers | Customer identity and store relationship |
| Carts | Mutable shopping state |
| Discounts | Discount rules, eligibility, redemption |
| Checkout | Purchase orchestration |
| Payments | Payment lifecycle and provider integration |
| Orders | Historical transaction and order lifecycle |

The owner of a domain is responsible for the rules governing its entities.

---

# 5. Entity vs Aggregate

An **entity** is a business object with identity.

An **aggregate** is a consistency boundary containing one or more entities whose invariants must be protected together.

For Demo, aggregates should remain relatively small.

The goal is not to create giant object graphs.

Example:

```text id="v7x2m9"
Order Aggregate
    Order
    ├── OrderItem
    ├── OrderAddress
    └── OrderStatusHistory
```

The Order aggregate protects order-specific invariants.

---

# 6. Stores Domain

## 6.1 Organization

The Organization represents the top-level merchant entity.

Responsibilities:

- organization identity
- organization lifecycle
- organization ownership
- organization membership

It does not own products, orders, or inventory directly.

Those resources belong to stores.

---

## 6.2 Store

The Store is the primary commerce tenant.

Responsibilities:

- store identity
- organization relationship
- store lifecycle
- store configuration
- default currency
- locale
- timezone
- storefront identity

Core invariant:

```text id="r5c8n2"
Every store belongs to exactly one organization.
```

---

## 6.3 StoreMembership

Responsibilities:

- user/store relationship
- merchant role
- membership lifecycle
- authorization context

Roles include:

```text id="p3n7k1"
OWNER
ADMIN
STAFF
```

Authorization rules are evaluated server-side.

---

# 7. Products Domain

## 7.1 Product

Product represents a catalog-level item.

Responsibilities:

- title
- description
- slug
- catalog state
- publication state
- product organization

A Product does not own inventory.

---

## 7.2 ProductVariant

A ProductVariant represents a purchasable catalog unit.

Responsibilities:

- SKU
- variant identity
- current price
- variant status
- relationship to Product

A variant is the normal bridge between catalog information and inventory.

---

## 7.3 Product Aggregate

Conceptually:

```text id="0h5m7x"
Product
 └── ProductVariant*
```

The Product aggregate protects product-level invariants.

However, inventory operations should not be embedded inside the Product aggregate.

Inventory is owned by the Inventory domain.

---

# 8. Product Value Objects

Potential value objects include:

### Money

Represents:

```text id="m8q4z2"
amount
currency
```

Money must support exact arithmetic.

---

### ProductSlug

Represents the normalized storefront identifier.

Rules may include:

- non-empty
- normalized format
- store-scoped uniqueness

---

### SKU

Represents a stock keeping identifier.

Rules may include:

- valid format
- store-scoped uniqueness
- stable historical representation

---

# 9. Inventory Domain

Inventory represents the availability of purchasable goods.

Responsibilities:

- available quantity
- reserved quantity
- stock adjustments
- reservation
- release
- concurrency control

Inventory does not own Product or ProductVariant.

---

# 10. Inventory Aggregate

A conceptual aggregate is:

```text id="c7n2v5"
InventoryItem
 └── InventoryAdjustment*
```

The InventoryItem protects:

```text id="j4x8q1"
available_quantity
reserved_quantity
```

and their associated invariants.

Inventory changes must be atomic.

---

# 11. Inventory Invariants

Examples:

```text id="q2m7k9"
available_quantity >= 0
reserved_quantity >= 0
```

If reservations are used:

```text id="z8p3x6"
available_quantity + reserved_quantity
```

must remain consistent with the business interpretation of total stock.

An inventory operation must not create a negative available quantity unless negative inventory is explicitly supported.

Demo should normally reject such operations.

---

# 12. Inventory Operations

The Inventory domain should expose operations such as:

```text id="r7v4m2"
getAvailability()
adjustInventory()
reserveInventory()
releaseReservation()
commitReservation()
```

These are conceptual public operations.

The exact application interface is defined during implementation.

---

# 13. Customers Domain

The Customer represents the store's relationship with a shopper.

Responsibilities:

- customer identity
- profile
- contact information
- addresses
- store relationship

The Customer domain does not own merchant authorization.

---

# 14. Customer Aggregate

A conceptual aggregate:

```text id="x3m8q5"
Customer
 └── CustomerAddress*
```

The Customer aggregate protects customer-specific invariants.

For example:

- customer belongs to one store
- address belongs to customer
- customer status transitions are valid

---

# 15. Customer Identity

A customer may be:

```text id="m6p2v9"
Registered
```

or:

```text id="t8x4q1"
Guest
```

A registered customer may have an associated platform user identity.

Guest checkout does not require a merchant account.

---

# 16. Carts Domain

The Cart represents mutable shopping state.

Responsibilities:

- adding items
- removing items
- changing quantities
- clearing cart
- cart lifecycle
- association with customer/session

Cart does not own:

- products
- inventory
- discounts
- payments
- orders

It references these domains as necessary.

---

# 17. Cart Aggregate

Conceptually:

```text id="w5r2n7"
Cart
 └── CartItem*
```

Cart invariants include:

```text id="e9k3m6"
CartItem.quantity > 0
```

and:

```text id="a7p4x2"
Every CartItem.variant belongs to the same Store as the Cart.
```

---

# 18. Cart Pricing

The Cart should not be treated as a permanent financial record.

Current product prices may change.

At checkout, the system recalculates and validates the purchase values.

The Cart may display calculated values, but the Checkout/Order workflow establishes authoritative transaction totals.

---

# 19. Discounts Domain

The Discounts domain owns:

- discount definitions
- discount codes
- eligibility rules
- usage limits
- discount calculation

Discount logic must not be duplicated across:

- cart
- checkout
- order
- storefront

---

# 20. Discount Aggregate

A conceptual aggregate:

```text id="n4v7c8"
Discount
 ├── DiscountCode*
 └── Usage*
```

The aggregate protects discount-specific rules.

However, complex eligibility checks may require information from other domains.

Those domains should be queried through public interfaces rather than directly accessing internal data.

---

# 21. Discount Value Objects

Potential value objects include:

### DiscountValue

Represents:

```text id="k8x2m4"
type
value
```

Examples:

```text
PERCENTAGE
FIXED_AMOUNT
```

### DiscountCode

Represents the normalized redemption code.

### ValidityPeriod

Represents:

```text id="q5n7r3"
starts_at
ends_at
```

---

# 22. Discount Invariants

Examples:

```text id="s3m8p2"
Discount value must be valid for its type.

Start/end dates must form a valid period.

Inactive discounts cannot be redeemed.

Expired discounts cannot be redeemed.

Usage limits cannot be exceeded.

Store boundaries cannot be crossed.
```

Per-customer limits must be concurrency-safe.

---

# 23. Checkout Domain

Checkout is the orchestration domain connecting:

```text id="v8q3m1"
Cart
 ↓
Products
 ↓
Inventory
 ↓
Discounts
 ↓
Payments
 ↓
Orders
```

Checkout does not become the owner of these domains.

Its responsibility is to coordinate the purchase process.

---

# 24. Checkout Aggregate

The Checkout aggregate represents the current purchase attempt.

Conceptually:

```text id="m2x7r5"
Checkout
 └── CheckoutItem*
```

It may contain:

- selected items
- customer information
- calculated totals
- discount application
- checkout state
- payment reference

---

# 25. Checkout Invariants

Examples:

```text id="h6p3x8"
Checkout belongs to exactly one store.

Checkout items belong to the checkout's store.

Checkout cannot complete twice.

Final totals must be internally consistent.

Required inventory must be available.

Required payment conditions must be satisfied.

A completed checkout produces at most one successful order.
```

---

# 26. Checkout as Orchestrator

Checkout may invoke:

```text id="q4n8v2"
Products → validate purchasable items
Inventory → reserve/decrement stock
Discounts → validate/apply discount
Payments → process payment
Orders → create order
```

These calls are coordinated by the Checkout application service.

The Checkout domain must not copy the business rules of these modules.

---

# 27. Payments Domain

Payments represents the internal payment lifecycle.

Responsibilities:

- payment creation
- payment attempts
- provider integration
- payment state
- provider callbacks
- idempotency
- reconciliation

The Payments domain owns the relationship with external payment providers.

---

# 28. Payment Aggregate

A conceptual structure:

```text id="z7m3k9"
Payment
 └── PaymentAttempt*
```

The Payment aggregate protects payment-specific state.

A payment may have multiple attempts.

Each attempt represents a distinct processing attempt.

---

# 29. Payment Invariants

Examples:

```text id="p5x8r2"
A payment cannot be marked successful twice through separate operations.

A successful payment cannot silently transition backward.

Provider references must remain consistent.

Duplicate payment operations must be idempotent.

Payment amount and currency must remain internally consistent.

Raw card credentials must never enter the domain model.
```

---

# 30. External Payment Provider Boundary

The domain should depend on an abstraction such as:

```text id="x9q4m7"
PaymentProvider
```

rather than directly on a provider SDK.

Conceptually:

```text id="n3v8k1"
Payments Domain
      ↓
PaymentProvider interface
      ↓
Provider Adapter
      ↓
External Provider
```

Provider-specific objects must remain outside the domain.

---

# 31. Orders Domain

Orders represent completed business transactions.

Responsibilities:

- order creation
- order items
- historical snapshots
- order state
- order status history
- customer order access
- merchant order management

Orders are not simply a copy of the current Cart.

They are the historical business record.

---

# 32. Order Aggregate

Conceptually:

```text id="b7m2x5"
Order
 ├── OrderItem*
 ├── OrderAddress*
 └── OrderStatusHistory*
```

The Order aggregate protects:

- order status
- item consistency
- totals
- historical snapshots
- valid state transitions

---

# 33. Order Invariants

Examples:

```text id="r4p9k2"
Order belongs to exactly one store.

Order contains valid historical line items.

Order totals match its line-item calculations.

Order currency is consistent.

Order state transitions are valid.

Order status history corresponds to state transitions.

Historical values do not change when catalog values change.
```

---

# 34. Order Historical Snapshot

Order items preserve:

```text id="m8x3q6"
Product name
Variant name
SKU
Unit price
Quantity
Discount
Line total
```

This allows:

```text id="s5v7n1"
Current Product
      ↓
changes later
      ↓
Historical Order
      ↓
remains unchanged
```

This is a deliberate domain rule, not merely a database convenience.

---

# 35. Order State Machine

A simplified Demo lifecycle may be:

```text id="w2q6m8"
PENDING
   ↓
CONFIRMED
   ↓
FULFILLED

PENDING → CANCELLED
CONFIRMED → CANCELLED
CONFIRMED → REFUNDED
FULFILLED → REFUNDED
```

The final allowed transitions are defined in:

```text id="q9x4m7"
docs/domain/state-machines.md
```

No module may arbitrarily mutate the order status.

---

# 36. Domain Events

Domain events represent facts that have already occurred.

Examples:

```text id="c6m2x8"
StoreCreated
ProductPublished
InventoryAdjusted
InventoryReserved
CheckoutCompleted
PaymentSucceeded
PaymentFailed
OrderCreated
OrderConfirmed
OrderFulfilled
OrderCancelled
OrderRefunded
```

An event should describe a fact.

It should not be phrased as an instruction such as:

```text id="p4x8m1"
PleaseCreateOrder
```

That is a command/job concept, not a domain fact.

---

# 37. Domain Event Ownership

The domain that owns the business change publishes the corresponding event.

Examples:

```text id="j7n3q5"
Products
    → ProductPublished

Inventory
    → InventoryAdjusted

Payments
    → PaymentSucceeded

Orders
    → OrderCreated
```

Other modules may react to these events.

They do not become owners of the originating state.

---

# 38. Event Reliability

For business-critical events that must trigger secondary work, the event should be persisted reliably with the originating state change.

Conceptually:

```text id="v3q7m9"
BEGIN
    update business state
    create event/outbox record
COMMIT
```

The worker later processes the event.

This avoids losing secondary work after a successful database transaction.

---

# 39. Domain Services

A domain service is appropriate when business logic:

- does not naturally belong to one entity
- spans multiple entities inside a domain
- represents a meaningful domain operation

Examples:

```text id="k8m4x2"
DiscountCalculator
InventoryAllocator
OrderTotalCalculator
```

Domain services should remain focused.

They must not become generic utility classes containing unrelated business logic.

---

# 40. Application Services

Application services coordinate use cases.

Examples:

```text id="s4x7n2"
CreateStore
CreateProduct
AdjustInventory
AddToCart
StartCheckout
CompleteCheckout
ProcessPaymentWebhook
UpdateOrderStatus
```

Application services may:

- establish transaction boundaries
- load required entities
- invoke domain logic
- coordinate modules
- publish events
- map results

They should not become the place where every business rule lives.

---

# 41. Domain Entities vs Database Records

A database record may contain:

```text id="q7m2x5"
created_at
updated_at
foreign keys
provider IDs
```

while the domain object may expose:

```text id="v8n4k1"
business behavior
invariants
state transitions
value objects
```

The two models may map closely, but they do not have to be identical.

Persistence concerns should not dictate domain behavior.

---

# 42. Domain Value Objects

Common value objects may include:

```text id="p3x8m6"
Money
Currency
SKU
Slug
EmailAddress
Quantity
Address
DateRange
Percentage
OrderNumber
```

Value objects should:

- have clear validation rules
- avoid unnecessary identity
- be immutable where practical
- encapsulate domain-specific formatting/validation

Not every primitive requires a value object.

Introduce one when it meaningfully protects a business rule.

---

# 43. Money

Money should be modeled explicitly.

Conceptually:

```text id="n6q3x8"
Money
├── amount
└── currency
```

Operations such as:

```text id="j2m7p4"
add
subtract
multiply
compare
```

must use exact arithmetic.

Money should never rely on JavaScript floating-point arithmetic for financial calculations.

---

# 44. Quantity

Quantity should represent valid purchasable amounts.

Typical invariants:

```text id="x5v8q2"
quantity > 0
```

Inventory may additionally represent zero availability.

Negative quantities should only exist as explicit adjustment deltas where the business operation permits them.

---

# 45. Store Boundary as a Domain Rule

Tenant isolation is part of the domain model.

For store-owned resources:

```text id="r9m4x7"
resource.store_id
```

must correspond to the active store context.

A business operation must never silently combine:

```text id="f2q6n8"
Store A product
+
Store B inventory
```

even if both records exist and are technically valid PostgreSQL rows.

---

# 46. Cross-Domain Rules

Cross-domain operations should follow:

```text id="y8m3q5"
Owning Domain
      ↑
Public Interface
      ↑
Application Service
```

For example:

```text id="g4x7n2"
Checkout
   ↓
Inventory.reserve()
```

rather than:

```text id="c8m2v6"
Checkout
   ↓
UPDATE inventory_items ...
```

The second approach violates ownership.

---

# 47. Read Dependencies

A module may require read-only information from another domain.

For example:

```text id="k5q8m3"
Checkout
    needs current product price
```

It should obtain the information through:

- public query interface
- application service
- approved read model

rather than reaching into another module's private repository.

---

# 48. Cross-Domain Transactions

Some business operations span multiple domains.

The classic example is checkout:

```text id="m8x4q2"
Checkout
 ├── Inventory
 ├── Discounts
 ├── Payments
 └── Orders
```

The application layer coordinates the transaction.

Domain ownership remains separate.

---

# 49. Domain Rules vs Integration Rules

Business rule:

```text id="q7m3x9"
An order cannot be fulfilled before it is confirmed.
```

Integration rule:

```text id="p4x8n2"
Stripe webhook signatures must be verified.
```

The first belongs to the Orders domain.

The second belongs to the Payments integration boundary.

Keeping these separate prevents provider-specific concerns from leaking into business logic.

---

# 50. Domain Error Model

Domain operations should return meaningful business failures.

Examples:

```text id="s6m2x8"
ProductNotPurchasable
InsufficientInventory
InvalidDiscount
CheckoutAlreadyCompleted
InvalidOrderTransition
PaymentAlreadySucceeded
CustomerNotFound
StoreAccessDenied
```

The API layer maps these into HTTP responses.

The domain should not throw HTTP-specific errors such as:

```text id="v8q3m7"
HttpException(403)
```

---

# 51. Authorization and Domain Logic

Authorization has multiple layers.

### Identity

Who is the caller?

### Resource authorization

Does the caller have access to this store/resource?

### Domain authorization

Is the requested business operation permitted?

For example:

```text id="k4m7x2"
Staff member
    ↓
can access store
    ↓
may update order status
    ↓
depending on Staff permissions
```

These checks should be server-side.

---

# 52. Domain Invariants and Database Constraints

Some rules belong primarily in domain logic.

Others can also be enforced structurally.

Example:

```text id="q5x8m1"
Domain:
SKU must be unique within store.
```

Database:

```text id="p7m3n6"
UNIQUE(store_id, sku)
```

The strongest design uses both where practical.

---

# 53. Aggregate Boundary Guidelines

An aggregate should be large enough to protect its invariants but small enough to avoid excessive locking.

Avoid:

```text id="r8x4m2"
Store
 └── all Products
      └── all Inventory
           └── all Orders
```

as one aggregate.

Instead:

```text id="j6q2v9"
Store Aggregate

Product Aggregate

Inventory Aggregate

Cart Aggregate

Checkout Aggregate

Payment Aggregate

Order Aggregate
```

This allows independent operations and better concurrency.

---

# 54. Aggregate Reference Rules

Aggregates should normally reference other aggregates by identity rather than embedding entire objects.

For example:

```text id="w3m8x5"
Order
    customer_id
```

rather than:

```text id="f6q2n9"
Order
    Customer object
        Addresses
        Carts
        ...
```

This keeps aggregate boundaries clear.

---

# 55. Domain Model and Background Jobs

Workers must invoke domain/application operations rather than implement alternate business rules.

Example:

```text id="c4x7m2"
Payment webhook job
    ↓
Payments application service
    ↓
Payment domain
```

not:

```text id="p9m3q8"
Worker
    ↓
direct database update
```

This ensures synchronous requests and asynchronous processing use the same business rules.

---

# 56. Domain Model and External Providers

External provider state must be translated into internal domain concepts.

Example:

```text id="y6x2m8"
Provider:
    requires_capture
    succeeded
    requires_action

Internal:
    PENDING
    SUCCEEDED
    ACTION_REQUIRED
```

The domain should not expose provider-specific states unless they are genuinely part of the business model.

---

# 57. Domain Model and Storefront

The storefront should consume public domain representations.

It should not receive internal database entities.

For example:

```text id="n4q7x2"
Product
    ↓
PublicProduct DTO
```

The storefront should not know:

- internal table names
- payment provider IDs
- private inventory implementation
- merchant authorization internals

---

# 58. Domain Model and Merchant Administration

Merchant interfaces operate through application services.

Example:

```text id="m7x3q8"
Merchant
    ↓
API
    ↓
Authorization
    ↓
Products Application Service
    ↓
Product Domain
```

The UI does not directly manipulate domain entities.

---

# 59. Domain Evolution

New domain concepts should be introduced when they represent a real business responsibility.

Examples that may eventually become separate domains:

- Shipping
- Tax
- Returns
- Subscriptions
- B2B
- Marketing
- Analytics
- Search
- Fulfillment

Demo should not introduce these domains merely because a large commerce platform has them.

---

# 60. Demo Domain Scope

The Demo domain model intentionally focuses on:

```text id="x8m2q5"
Stores
Products
Inventory
Customers
Carts
Discounts
Checkout
Payments
Orders
```

These domains cover the primary commerce lifecycle.

Additional domains may be added when a real requirement demands them.

---

# 61. Domain Anti-Patterns

Avoid:

### Anemic domain with all logic in controllers

Controllers should not calculate inventory, discounts, or order state.

### Giant service classes

A service containing every business rule becomes another monolith inside the monolith.

### Cross-module database mutation

One domain must not directly modify another domain's tables.

### Provider leakage

Stripe/PayPal/provider-specific objects should not become core domain entities.

### UI-driven business rules

The browser cannot be the authoritative source of business decisions.

### Generic "utils" for business rules

Business calculations should live in the appropriate domain.

### Over-modeled domain

Do not create dozens of abstractions without actual business complexity.

---

# 62. Domain Invariants

The core domain must preserve:

1. Every store belongs to one organization.
2. Every merchant operation occurs within a valid store context.
3. Products belong to one store.
4. Variants belong to products.
5. Inventory belongs to variants.
6. Inventory cannot become invalid through concurrent operations.
7. Customers belong to stores.
8. Carts contain only items valid for their store.
9. Discounts cannot violate their eligibility or usage rules.
10. Checkout cannot complete more than once.
11. Payments cannot create duplicate financial effects.
12. Orders preserve historical transaction information.
13. Order state transitions are explicit and valid.
14. External provider details remain behind integration boundaries.
15. Cross-domain operations use public interfaces.
16. Background jobs reuse the same business rules as synchronous operations.
17. Domain rules do not depend on HTTP or UI behavior.
18. Database integrity and domain invariants reinforce each other.

---

# 63. Definition of Done

The domain model is sufficiently defined when:

- Core domains are identified.
- Entity ownership is clear.
- Aggregate boundaries are defined.
- Important value objects are identified.
- Domain invariants are documented.
- Cross-domain relationships are understood.
- Checkout orchestration is defined.
- Payment/provider boundaries are defined.
- Historical order behavior is defined.
- Domain events are understood.
- Application-service responsibilities are separated from domain logic.
- Authorization boundaries are understood.
- Background processing uses the same domain rules.
- The model remains intentionally small enough for Demo while supporting V1 evolution.