# Module Boundaries

## 1. Purpose

This document defines the ownership and interaction boundaries of the Demo's business modules.

The platform uses a modular monolith, meaning all modules run within the same application runtime but remain logically separated.

The purpose of these boundaries is to:

- Prevent uncontrolled coupling.
- Establish clear ownership of business concepts.
- Prevent modules from directly manipulating another module's internals.
- Make business logic easier to test and maintain.
- Allow future extraction of individual capabilities if required.
- Keep the Demo simple without sacrificing architectural discipline.

---

# 2. Core Rule

Each business concept MUST have a clear owning module.

A module owns:

- Its business rules.
- Its domain entities.
- Its state transitions.
- Its application operations.
- Its persistence logic.
- Its public interface.

Other modules may request operations from the owning module, but MUST NOT directly manipulate its internal implementation.

Conceptually:

```text
Module A
   │
   │ Public Interface
   ▼
Module B
   │
   ├── Domain
   ├── Application
   └── Infrastructure
```

Not:

```text
Module A
   │
   └──→ Module B/internal/repository
```

---

# 3. Module Inventory

The Demo contains these business modules:

```text
modules/
├── stores/
├── products/
├── inventory/
├── customers/
├── carts/
├── discounts/
├── checkout/
├── payments/
└── orders/
```

Their primary ownership is:

| Module | Primary Responsibility |
|---|---|
| Stores | Organizations, stores, store configuration |
| Products | Product catalog and publication |
| Inventory | Stock and availability |
| Customers | Customer identity and store relationships |
| Carts | Shopping carts and cart items |
| Discounts | Promotional rules and discount evaluation |
| Checkout | Purchase orchestration |
| Payments | Payment lifecycle and provider integration |
| Orders | Completed purchases and order lifecycle |

---

# 4. Stores Module

## 4.1 Owns

The Stores module owns:

- Organizations
- Stores
- Store configuration
- Store lifecycle
- Store ownership
- Store-level identity information

## 4.2 Does Not Own

The Stores module does not own:

- Products
- Inventory
- Orders
- Payments
- Carts
- Customer purchase history

## 4.3 Public Capabilities

Conceptually:

```text
createOrganization()
createStore()
getStore()
updateStore()
getStoreContext()
```

Exact APIs are defined later.

## 4.4 Boundary Rule

Other modules may use store identity/context, but must not modify store configuration through internal Stores data structures.

---

# 5. Products Module

## 5.1 Owns

The Products module owns:

- Products
- Product information
- Product pricing information
- Product publication state
- Product-level availability metadata

## 5.2 Does Not Own

The Products module does not own:

- Inventory quantities
- Cart items
- Orders
- Payment state
- Customer accounts

## 5.3 Public Capabilities

Examples:

```text
createProduct()
getProduct()
updateProduct()
publishProduct()
unpublishProduct()
getPublishedProduct()
```

## 5.4 Boundary Rule

Inventory is not part of the Product module merely because a product has stock.

Product defines the sellable catalog item.

Inventory defines how much of that item is available.

---

# 6. Inventory Module

## 6.1 Owns

The Inventory module owns:

- Inventory records
- Stock quantities
- Inventory adjustments
- Inventory availability
- Inventory-related state transitions

## 6.2 Does Not Own

The Inventory module does not own:

- Product descriptions
- Product pricing
- Orders
- Payments
- Carts

## 6.3 Public Capabilities

Examples:

```text
getInventory()
adjustInventory()
checkAvailability()
reserveInventory()
releaseInventory()
consumeInventory()
```

The exact operations depend on the final checkout and inventory model.

## 6.4 Boundary Rule

Other modules must not directly modify inventory quantities.

All inventory changes must go through Inventory-owned operations.

This is especially important for concurrent checkout operations.

---

# 7. Customers Module

## 7.1 Owns

The Customers module owns:

- Customer identity
- Customer profile
- Store/customer relationships
- Customer-specific information

## 7.2 Does Not Own

The Customers module does not own:

- Orders
- Cart contents
- Payments
- Merchant memberships

Customer order history is represented by Orders, even though it can be queried in the context of a customer.

## 7.3 Public Capabilities

Examples:

```text
createCustomer()
getCustomer()
updateCustomer()
findCustomer()
```

## 7.4 Boundary Rule

Customer information must not be duplicated as independent authoritative records throughout other modules.

Other modules may store references or transaction-specific snapshots where required.

---

# 8. Carts Module

## 8.1 Owns

The Carts module owns:

- Carts
- Cart items
- Cart quantities
- Cart lifecycle
- Cart-level calculated state

## 8.2 Does Not Own

The Carts module does not own:

- Product definitions
- Inventory
- Payment attempts
- Orders
- Final transaction totals

## 8.3 Public Capabilities

Examples:

```text
createCart()
getCart()
addItem()
updateItemQuantity()
removeItem()
clearCart()
```

## 8.4 Boundary Rule

A cart references products but does not become the owner of product information.

Product information remains owned by Products.

---

# 9. Discounts Module

## 9.1 Owns

The Discounts module owns:

- Discount definitions
- Discount codes
- Discount activation
- Eligibility rules
- Discount calculations

## 9.2 Does Not Own

The Discounts module does not own:

- Products
- Orders
- Payments
- Carts

## 9.3 Public Capabilities

Examples:

```text
createDiscount()
updateDiscount()
validateDiscount()
calculateDiscount()
```

## 9.4 Boundary Rule

Checkout may ask Discounts whether a discount is valid and what effect it has.

Checkout must not reimplement discount rules.

---

# 10. Checkout Module

## 10.1 Owns

Checkout owns the purchase orchestration process.

It coordinates:

- Cart validation
- Product validation
- Inventory validation
- Discount validation
- Customer information
- Payment initiation
- Order creation

## 10.2 Does Not Own

Checkout does not become the owner of:

- Product data
- Inventory records
- Discount definitions
- Payment state
- Orders

## 10.3 Public Capabilities

Examples:

```text
startCheckout()
validateCheckout()
calculateCheckout()
completeCheckout()
```

## 10.4 Boundary Rule

Checkout coordinates other domains but does not directly modify their internal persistence.

---

# 11. Payments Module

## 11.1 Owns

Payments owns:

- Payment attempts
- Payment state
- Provider references
- Payment callbacks
- Payment-related idempotency
- Provider-specific integration logic

## 11.2 Does Not Own

Payments does not own:

- Orders
- Carts
- Inventory
- Products

## 11.3 Public Capabilities

Examples:

```text
createPaymentAttempt()
initiatePayment()
getPaymentStatus()
handlePaymentWebhook()
```

## 11.4 Boundary Rule

Other modules must not directly invoke provider SDKs.

Provider interaction must remain behind the Payments module.

---

# 12. Orders Module

## 12.1 Owns

Orders owns:

- Orders
- Order items
- Order totals
- Order state
- Order history
- Transaction-specific snapshots

## 12.2 Does Not Own

Orders does not own:

- Current product catalog data
- Current inventory
- Customer account profile
- Payment provider implementation

## 12.3 Public Capabilities

Examples:

```text
createOrder()
getOrder()
listOrders()
updateOrderStatus()
```

## 12.4 Boundary Rule

Historical order information must not depend on mutable current product information.

For example, changing a product price after an order is completed must not change the historical order price.

---

# 13. Module Dependency Relationships

The main dependency relationships are:

```text
Stores
  ↑
  │
Products ──────→ Inventory
  │                 ↑
  │                 │
  └──────────────→ Checkout
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
     Carts      Discounts    Customers
                    │
                    ▼
                 Payments
                    │
                    ▼
                  Orders
```

This diagram represents conceptual collaboration, not unrestricted dependency.

Actual dependencies must use public interfaces.

---

# 14. Dependency Rules

## Rule 1 — No Internal Imports

A module MUST NOT import another module's internal implementation.

Bad:

```text
checkout
  → inventory/src/internal/repository
```

Good:

```text
checkout
  → inventory public interface
```

---

## Rule 2 — No Shared Database Manipulation

A module MUST NOT directly update another module's owned data simply because both use PostgreSQL.

Bad:

```text
Checkout
  → UPDATE inventory_table
```

Good:

```text
Checkout
  → Inventory operation
  → Inventory owns inventory change
```

---

## Rule 3 — No Business Logic Duplication

If a rule belongs to a module, other modules must not independently recreate it.

For example:

```text
Discounts
  → owns discount eligibility
```

Checkout should ask Discounts to evaluate eligibility instead of implementing another version.

---

## Rule 4 — Public Interfaces Only

Cross-module communication should use:

- Public application services
- Public domain operations where appropriate
- Explicit events
- Shared primitive types when genuinely necessary

---

# 15. Data Ownership

Every major business entity has one authoritative owner.

| Entity | Owner |
|---|---|
| Organization | Stores |
| Store | Stores |
| Product | Products |
| Inventory | Inventory |
| Customer | Customers |
| Cart | Carts |
| Discount | Discounts |
| Checkout State | Checkout |
| Payment | Payments |
| Order | Orders |

Other modules may hold references or snapshots but must not become competing sources of truth.

---

# 16. Reference vs Ownership

A module may reference another module's entity without owning it.

Example:

```text
Order
 ├── storeId
 ├── customerId
 └── product references
```

This does not mean Orders owns:

- Store
- Customer
- Product

It only means an Order has relationships to those entities.

---

# 17. Snapshot Data

Some information must be copied into transaction records to preserve historical correctness.

For example, an Order may preserve:

```text
Product Name at Purchase
Product Price at Purchase
Quantity
Discount Applied
Final Line Total
```

This is an intentional historical snapshot.

It does not transfer ownership of the Product entity to Orders.

---

# 18. Cross-Module Queries

Cross-module read requirements should be handled carefully.

Preferred approaches include:

1. Public module query interfaces.
2. Explicit application-level composition.
3. Purpose-built read models when justified.
4. Transactional queries where the operation genuinely requires atomic access.

A module should not casually query another module's internal tables simply because doing so is convenient.

---

# 19. Checkout Dependency Model

Checkout is the most cross-domain workflow in the Demo.

Conceptually:

```text
                 ┌───────────┐
                 │  Checkout │
                 └─────┬─────┘
                       │
       ┌───────────────┼────────────────┐
       │               │                │
       ▼               ▼                ▼
     Carts         Products         Discounts
       │               │                │
       └───────────────┼────────────────┘
                       ▼
                  Inventory
                       │
                       ▼
                   Payments
                       │
                       ▼
                    Orders
```

Checkout should orchestrate this process while each domain retains ownership of its own rules.

---

# 20. Event-Based Communication

Events should be used primarily for decoupled secondary effects.

Example:

```text
Orders
  │
  └──→ OrderCreated
             │
             ├──→ Notifications
             └──→ Secondary Processing
```

Events should not be used to avoid direct domain coordination where an immediate result is required.

For example, if checkout requires an inventory availability decision before completing a purchase, it should not publish an event and blindly continue.

---

# 21. Circular Dependencies

Circular module dependencies SHOULD be avoided.

Bad:

```text
Checkout → Orders
Orders → Checkout
```

If such a relationship appears necessary, the interaction should be redesigned around:

- A clearer ownership boundary.
- Application orchestration.
- An event.
- A shared abstraction that does not contain business ownership.

Circular dependencies make modules difficult to understand and eventually become everyone else's problem, which is how architecture tends to reproduce itself.

---

# 22. Stores as a Foundational Context

Stores provide the tenant context used throughout the platform.

Most store-owned entities follow:

```text
Store
  │
  ├── Products
  ├── Inventory
  ├── Customers
  ├── Carts
  ├── Discounts
  └── Orders
```

The store itself remains owned by the Stores module.

Other modules consume store context but do not manage the store entity.

---

# 23. Authentication vs Business Modules

Authentication is implemented through:

```text
packages/auth
```

but authentication does not own business roles or domain authorization decisions.

For example:

```text
Auth
  → establishes identity

Stores / application layer
  → establishes store context

Authorization
  → determines whether the identity may perform the operation
```

This prevents authentication infrastructure from becoming the owner of all business permissions.

---

# 24. Tenant Package vs Stores Module

These concepts must remain separate.

### `packages/tenant`

Provides technical mechanisms for:

- Resolving tenant context
- Carrying tenant context
- Enforcing tenant-aware access patterns

### `modules/stores`

Owns:

- Organizations
- Stores
- Store configuration
- Store lifecycle
- Store ownership

The tenant package provides infrastructure.

The Stores module owns the business concept.

---

# 25. Shared Types

Shared types should be used carefully.

Good candidates:

```text
IDs
Common result types
Shared primitive structures
Cross-cutting context types
```

Poor candidates:

```text
Entire domain entities
Internal database models
Module-specific business rules
```

A large shared domain model can recreate the coupling the module architecture is intended to prevent.

---

# 26. API Boundary

External clients should interact with the application through the API/presentation layer.

They should not interact directly with modules.

```text
Client
  ↓
API
  ↓
Application Service
  ↓
Module
```

This allows the internal architecture to evolve without exposing internal implementation details.

---

# 27. Worker Boundary

The worker is another application entry point.

It follows:

```text
Job/Event
   ↓
Worker
   ↓
Application Service
   ↓
Domain Module
```

The worker must not bypass application/domain boundaries simply because it runs inside the same repository.

---

# 28. Security Boundary

Module boundaries also contribute to security.

For example:

```text
Customer Request
       ↓
Authorization
       ↓
Orders Public Interface
       ↓
Customer's Orders
```

The request must not gain access to arbitrary order records by directly querying persistence.

---

# 29. Future Service Extraction

A module may eventually become an independent service if required.

For example:

```text
Current Demo:

Checkout → Payments Module
```

could eventually become:

```text
Checkout Service
      │
      ▼
Payments Service
      │
      ▼
Payment Provider
```

The module boundary should make such evolution possible without requiring the business model to be redesigned.

Service extraction is not a Demo requirement.

---

# 30. Boundary Review Rules

When adding a feature, developers should determine:

1. Which module owns the business concept?
2. Which module owns the state?
3. Which module owns the business rules?
4. Which public interface should be used?
5. Does the change introduce a new dependency?
6. Does the dependency create a cycle?
7. Does another module need to access internal data?
8. Should an event be emitted?
9. Does tenant context remain enforced?
10. Does the change require an architectural decision?

---

# 31. Module Boundary Checklist

Before merging a significant change, verify:

- [ ] Business logic is located in the correct module.
- [ ] Entity ownership is unambiguous.
- [ ] No internal module imports were introduced.
- [ ] No module directly modifies another module's data.
- [ ] Cross-module interaction uses public interfaces.
- [ ] Business rules are not duplicated.
- [ ] Circular dependencies were avoided.
- [ ] Tenant context is preserved.
- [ ] Authorization remains enforced.
- [ ] Critical transactions remain correct.
- [ ] Events are used only where appropriate.
- [ ] Documentation is updated when boundaries change.

---

# 32. Summary

The Demo's modular architecture is based on explicit ownership:

```text
Stores      → Organizations & Stores
Products    → Catalog
Inventory   → Stock
Customers   → Customer Identity
Carts       → Shopping Carts
Discounts   → Promotions
Checkout    → Purchase Orchestration
Payments    → Payment Lifecycle
Orders      → Completed Transactions
```

The central rule is:

> **A module owns its business state and rules. Other modules interact with it through explicit public capabilities rather than manipulating its internals.**

This keeps the modular monolith genuinely modular and provides a clean foundation for future V1 evolution.