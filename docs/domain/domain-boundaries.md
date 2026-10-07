# Domain Boundaries

## 1. Purpose

This document defines the business-domain boundaries of the commerce platform.

It establishes:

- The responsibility of each domain.
- The entities owned by each domain.
- The business rules controlled by each domain.
- Allowed interactions between domains.
- Data ownership boundaries.
- Cross-domain coordination rules.
- Domain invariants.
- Rules for introducing new dependencies.

The purpose is to ensure that the system remains a **modular commerce platform** rather than becoming a collection of tightly coupled business logic.

---

# 2. Domain Architecture

The initial business domains are:

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
```

The high-level relationship is:

```text
                    Stores
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
    Products       Customers      Discounts
        │              │              │
        ▼              │              │
    Inventory           │              │
        │               │              │
        └──────────┬────┴──────────────┘
                   ▼
                 Carts
                   │
                   ▼
                Checkout
                /       \
               ▼         ▼
          Payments      Orders
```

This diagram represents business relationships, not necessarily direct code dependencies.

---

# 3. Domain Ownership Principle

Each domain owns a coherent set of business concepts.

The owning domain is responsible for:

- Business rules.
- State transitions.
- Validation.
- Persistence.
- Invariants.
- Public operations.
- Domain events where appropriate.

Other domains consume the owner's capabilities through defined interfaces.

A domain must not become dependent on another domain's internal implementation.

---

# 4. Stores Domain

## Responsibility

The Stores domain defines the merchant-side organizational and store structure.

It answers:

- Who owns a store?
- Which organization does a store belong to?
- Which users can operate the store?
- What is the store's lifecycle state?
- What configuration belongs to the store?

## Owned Concepts

```text id="4w4e0e"
Organization
Store
Membership
Store Configuration
Store Lifecycle
```

## Responsibilities

The Stores domain manages:

- Organization creation.
- Store creation.
- Store configuration.
- Store lifecycle.
- Merchant membership.
- Merchant roles.
- Store ownership relationships.

## Does Not Own

The Stores domain does not own:

- Products.
- Inventory.
- Orders.
- Payments.
- Customers.
- Discounts.

It establishes the tenant context in which those domains operate.

---

# 5. Products Domain

## Responsibility

The Products domain manages the merchant's catalog.

It answers:

- What products exist?
- What variants exist?
- What does a product cost?
- Is the product published?
- What catalog information is associated with it?

## Owned Concepts

```text id="3l0mx7"
Product
Product Variant
SKU
Product Pricing
Product Metadata
Publication State
```

## Responsibilities

- Product creation.
- Product editing.
- Product publication.
- Product archival.
- Variant management.
- SKU management.
- Catalog pricing.

## Does Not Own

Products does not own:

- Stock quantities.
- Carts.
- Orders.
- Payments.
- Discount eligibility.

A product may be referenced by those domains without transferring ownership.

---

# 6. Inventory Domain

## Responsibility

The Inventory domain manages stock availability.

It answers:

- How much inventory exists?
- How much is available?
- What adjustments occurred?
- Can inventory be reserved or decremented?
- Is an inventory operation valid?

## Owned Concepts

```text id="l8l5tc"
Inventory Record
Stock Quantity
Inventory Adjustment
Reservation State where applicable
```

## Responsibilities

- Inventory creation.
- Inventory adjustments.
- Availability checks.
- Stock changes.
- Concurrency-safe inventory operations.

## Critical Boundary

No other domain may directly modify inventory state.

For example:

```text id="4x3d8j"
Checkout
    ↓
Inventory.reserve(...)
```

is valid.

```text id="9v3l3f"
Checkout
    ↓
UPDATE inventory SET quantity = ...
```

is not.

---

# 7. Customers Domain

## Responsibility

The Customers domain manages customer identities and store relationships.

It answers:

- Who is the customer?
- Which store does the customer belong to?
- What customer profile exists?
- What customer state applies?

## Owned Concepts

```text id="0qqv99"
Customer
Customer Profile
Customer Store Relationship
Customer Status
```

## Responsibilities

- Customer creation.
- Customer profile management.
- Customer lookup.
- Customer lifecycle.

## Does Not Own

Customers does not own:

- Merchant membership.
- Orders.
- Carts.
- Payments.
- Product data.

A customer may own an order relationship without owning the Order domain itself.

---

# 8. Carts Domain

## Responsibility

The Carts domain manages temporary shopping state.

It answers:

- What is in the cart?
- Which quantities were selected?
- Which customer or guest owns the cart?
- Which store does the cart belong to?
- Is the cart active?

## Owned Concepts

```text id="6xg4l1"
Cart
Cart Item
Cart State
Cart Lifecycle
```

## Responsibilities

- Create cart.
- Add item.
- Remove item.
- Change quantity.
- Clear cart.
- Retrieve active cart.
- Validate basic cart state.

## Important Boundary

The cart references product information but does not become the product owner.

Likewise, the cart may request inventory availability but does not own inventory.

---

# 9. Discounts Domain

## Responsibility

The Discounts domain manages discount definitions and eligibility.

It answers:

- What discounts exist?
- Which codes are valid?
- What conditions apply?
- How should a discount be calculated?
- What limits apply?

## Owned Concepts

```text id="g2cy6u"
Discount
Discount Code
Eligibility Rules
Discount Conditions
Usage Limits
Discount Calculation
```

## Responsibilities

- Discount creation.
- Discount activation/deactivation.
- Code validation.
- Eligibility evaluation.
- Discount calculation.

## Critical Boundary

Discount logic must not be duplicated across Cart, Checkout, and Orders.

The Discounts domain is the authoritative owner of discount rules.

---

# 10. Checkout Domain

## Responsibility

Checkout coordinates the process of converting a cart into a purchase.

It answers:

- Is the cart valid for purchase?
- Are required items still available?
- Are discounts valid?
- What is the final purchase amount?
- What payment operation is required?
- When should an order be created?

Checkout is primarily an **orchestration domain**.

---

# 11. Checkout Dependencies

Checkout may interact with:

```text id="4c3q9j"
Carts
Products
Inventory
Customers
Discounts
Payments
Orders
```

Conceptually:

```text id="3r2k0z"
              Checkout
             /   |   \
            /    |    \
       Inventory Discount Payments
            \     |     /
             \    |    /
               Orders
```

The exact sequence depends on the checkout use case.

---

# 12. Checkout Does Not Own Everything It Uses

Checkout must not absorb responsibilities from other domains.

For example:

### Incorrect

```text
Checkout
 ├── inventory rules
 ├── discount rules
 ├── payment rules
 └── order lifecycle
```

### Correct

```text
Checkout
 ├── coordinates Inventory
 ├── requests Discount evaluation
 ├── coordinates Payment
 └── requests Order creation
```

Each domain retains its own rules.

---

# 13. Payments Domain

## Responsibility

The Payments domain manages payment processing state.

It answers:

- What payment attempts exist?
- What is the payment state?
- What provider transaction is associated?
- Has the payment succeeded?
- Has it failed?
- Has a webhook already been processed?

## Owned Concepts

```text id="j7t4lc"
Payment
Payment Attempt
Payment State
Provider Reference
Payment Events
Idempotency Records
```

## Responsibilities

- Create payment attempts.
- Communicate with payment providers through adapters.
- Process payment results.
- Process payment webhooks.
- Enforce valid payment state transitions.
- Prevent duplicate processing.

---

# 14. Payment State

Payment state must follow explicit transitions.

Conceptually:

```text id="sm9t9n"
pending
   │
   ├──> authorized
   │
   ├──> failed
   │
   └──> cancelled

authorized
   │
   └──> captured
```

The actual supported states and transitions belong to the Payments specification.

Other domains must not arbitrarily modify payment status.

---

# 15. Orders Domain

## Responsibility

The Orders domain owns completed purchase records.

It answers:

- What was purchased?
- By whom?
- From which store?
- At what price?
- In what quantity?
- What is the current order state?
- What happened during the order lifecycle?

## Owned Concepts

```text id="4wgjw2"
Order
Order Item
Order Totals
Order Status
Order History
Transaction Snapshot
```

## Responsibilities

- Create orders.
- Preserve transaction snapshots.
- Manage order lifecycle.
- Expose order information.
- Record relevant order history.

---

# 16. Orders Are Historical Records

Orders must not dynamically depend on mutable catalog data for historical correctness.

For example:

```text id="k2p3k4"
Product
Name = "Blue Shirt"
Price = ₹1,200
```

may later become:

```text id="6zqg7d"
Product
Name = "Premium Blue Shirt"
Price = ₹1,500
```

The existing order must continue to represent the original transaction.

Therefore, Orders preserve relevant historical values.

---

# 17. Cross-Domain Relationships

The domains form relationships without sharing ownership.

Example:

```text id="m7v3od"
Order
 ├── storeId
 ├── customerId
 └── items
       └── productId
```

Ownership remains:

```text id="5j6q6n"
storeId     → Stores
customerId  → Customers
productId   → Products
items       → Orders
```

The Order domain owns the Order and Order Item records.

---

# 18. Domain Interaction Rules

Domains may interact through:

1. Public application services.
2. Domain-facing interfaces.
3. Queries designed for cross-domain consumption.
4. Events for secondary reactions.

They must not interact through:

- Internal repositories.
- Internal domain objects.
- Private implementation classes.
- Direct mutation of another domain's tables.

---

# 19. Synchronous vs Asynchronous Interaction

Synchronous interaction is preferred when the result is required for the current business operation.

Examples:

```text id="5h0xmg"
Checkout → Inventory
Checkout → Discounts
Checkout → Payments
Checkout → Orders
```

Asynchronous processing is preferred for secondary effects.

Examples:

```text id="3s7x1k"
OrderCreated
    ↓
Send Email

OrderCreated
    ↓
Analytics Update
```

The choice depends on business correctness, not technical preference.

---

# 20. Domain Events

Domain events represent facts that have occurred.

Examples:

```text id="xw8v7d"
ProductPublished
InventoryAdjusted
OrderCreated
PaymentCaptured
OrderCancelled
```

Events may be consumed by other components.

Events do not transfer ownership.

The originating domain remains the authority for the fact.

---

# 21. Circular Dependencies

Circular business dependencies should be avoided.

For example:

```text id="z2kq1b"
Products
   ↓
Orders
   ↓
Products
```

is a warning sign.

If two domains require each other's internal behavior, the design should be reconsidered.

Possible solutions include:

- Public interfaces.
- Shared stable concepts.
- Application-level orchestration.
- Events.
- Read models.
- Moving a rule to the domain that truly owns it.

---

# 22. Domain vs Shared Package

A capability belongs in a domain module when it contains business rules.

For example:

```text id="x4v5c2"
Discount Eligibility
```

belongs in:

```text
modules/discounts
```

not:

```text
packages/utils
```

Technical functionality belongs in shared packages when it is genuinely cross-cutting.

For example:

```text id="y8m9d1"
Database Connection
Authentication Infrastructure
Configuration
Validation Infrastructure
```

may belong in packages.

---

# 23. Authentication vs Domain Authorization

Authentication determines who the user is.

Authorization determines what the user may do.

The `auth` package may provide identity information.

The business domains determine whether an authenticated user can perform a specific operation.

For example:

```text id="f2t1mq"
Authenticated User
       ↓
Store Membership
       ↓
Role / Permission
       ↓
Product Mutation
```

The Products domain remains responsible for product business rules.

---

# 24. Tenant Context

Tenant context is foundational to domain execution.

A typical request establishes:

```text id="v0jv2z"
Identity
   ↓
Organization
   ↓
Store
   ↓
Domain Operation
```

Store-owned domain operations must operate within the resolved tenant context.

No domain may assume that a resource ID alone establishes authorization.

---

# 25. Domain Invariants

Important domain invariants include:

### Stores

- A store belongs to the correct organization.
- Membership access is valid.
- Store lifecycle transitions are valid.

### Products

- Product ownership is store-scoped.
- Product state transitions are valid.
- Pricing is valid.

### Inventory

- Inventory cannot enter invalid quantities.
- Concurrent updates cannot corrupt stock.
- Inventory operations are auditable where required.

### Customers

- Customer data is tenant-scoped.
- Customer access is authorized.

### Carts

- Cart items belong to the correct cart.
- Cart belongs to the correct store.
- Quantities are valid.

### Discounts

- Invalid discounts cannot be applied.
- Eligibility rules are enforced consistently.

### Payments

- Invalid payment transitions are rejected.
- Duplicate webhook processing does not create duplicate effects.

### Orders

- Order items belong to the correct order.
- Historical transaction data is preserved.
- Invalid order transitions are rejected.

---

# 26. Domain Boundary Enforcement

Boundaries should be enforced through multiple mechanisms:

```text id="9y0jvi"
Documentation
     +
Code Structure
     +
Type System
     +
Dependency Rules
     +
Code Review
     +
Tests
```

No single mechanism should be expected to prevent every architectural violation.

---

# 27. Adding a New Domain

A new domain should only be introduced when there is a meaningful business boundary.

Before creating one, determine:

1. What business capability does it own?
2. Which entities belong to it?
3. Which invariants does it enforce?
4. Which existing domain currently owns those concepts?
5. Which domains depend on it?
6. Why is an existing domain insufficient?
7. What public interface will it expose?
8. What data does it own?
9. What events does it publish?
10. What tests establish its boundary?

A new folder is not automatically a new domain.

---

# 28. Splitting an Existing Domain

A domain should only be split when its current boundary has become materially problematic.

Possible reasons include:

- Distinct business ownership.
- Excessive complexity.
- Independent scaling requirements.
- Independent lifecycle.
- Strongly different operational requirements.

The split should preserve clear ownership and avoid simply moving the same coupling into more folders.

---

# 29. Future Service Extraction

Domain boundaries are designed so that selected domains could later become independent services.

For example:

```text id="4h2y7r"
modules/payments
        ↓
Payments Service
```

The extraction should happen only when justified by actual requirements.

The domain boundary comes first.

The deployment boundary comes later.

---

# 30. Anti-Patterns

The following patterns should be avoided.

## God Module

One module owns unrelated business concepts.

## Shared Business Logic

Multiple domains independently implement the same rule.

## Direct Table Access

A domain bypasses another domain's public interface.

## UI-Owned Business Rules

Critical business logic exists only in React components or route handlers.

## Cross-Domain Mutation

A module directly modifies another domain's state.

## Circular Domain Dependencies

Two domains require each other's internals.

## Event Everything

Events are used for operations that actually require immediate transactional results.

## Service Everything

Every domain is immediately converted into a network service without a concrete requirement.

---

# 31. Domain Dependency Summary

| Domain | Primary Dependencies |
|---|---|
| Stores | Auth / Tenant infrastructure |
| Products | Stores |
| Inventory | Stores, Products |
| Customers | Stores |
| Carts | Stores, Products, Customers |
| Discounts | Stores, Products |
| Checkout | Carts, Products, Inventory, Customers, Discounts, Payments, Orders |
| Payments | Stores, Orders where required |
| Orders | Stores, Customers, Products, Payments where required |

These dependencies represent conceptual relationships.

Actual code dependencies must follow public interfaces and the application architecture.

---

# 32. Core Commerce Flow

The primary commerce flow crosses the domains in a controlled sequence:

```text id="g5u3aa"
Store
  ↓
Products
  ↓
Inventory
  ↓
Cart
  ↓
Checkout
  ├── Discounts
  ├── Inventory
  ├── Payments
  └── Orders
```

The important principle is that Checkout coordinates these domains without absorbing their ownership.

---

# 33. Evolution Principle

The domains should remain stable even when infrastructure changes.

For example:

```text id="m7j8ne"
Demo:
Modular Monolith
     ↓
V1:
Selective Service Extraction
```

should preserve:

```text id="5m8r7z"
Products → Product Ownership
Inventory → Inventory Ownership
Payments → Payment Ownership
Orders → Order Ownership
```

The deployment model may change.

The business boundaries should not change without a deliberate domain decision.

---

# 34. Final Principle

The platform is organized around **business ownership**, not technical convenience.

Each domain should have:

```text
Clear Responsibility
        +
Clear Data Ownership
        +
Clear Invariants
        +
Clear Interfaces
        +
Controlled Dependencies
```

The governing rule is:

> **A domain owns the business rules for its concepts. Other domains may use those concepts, but they must not quietly become their second owner.**