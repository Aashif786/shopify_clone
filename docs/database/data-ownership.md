# Data Ownership

## 1. Purpose

This document defines ownership of business data within the commerce platform.

Its primary goals are to establish:

- Which module owns each business entity.
- Which module is responsible for creating and modifying that data.
- How other modules may reference owned data.
- How cross-module access is controlled.
- How historical business data remains correct.
- How database structure supports module boundaries.

Data ownership is a core architectural boundary.

The fact that multiple modules use PostgreSQL does **not** mean that every module may directly modify every table.

---

# 2. Ownership Principle

Every core business entity must have a clearly defined owning module.

The owning module is responsible for:

- Business rules.
- Creation.
- Mutation.
- Lifecycle transitions.
- Validation.
- Persistence.
- Invariants.
- Public access interfaces.

Other modules may consume information from the owner through defined interfaces.

The fundamental rule is:

> **One business entity has one authoritative owner.**

---

# 3. Ownership Model

The initial ownership model is:

| Business Data | Owning Module |
|---|---|
| Organization | Stores |
| Store | Stores |
| Store Configuration | Stores |
| Membership | Stores |
| Product | Products |
| Product Variant | Products |
| Product Pricing | Products |
| Product Publication | Products |
| Inventory | Inventory |
| Inventory Adjustment | Inventory |
| Customer | Customers |
| Cart | Carts |
| Cart Item | Carts |
| Discount | Discounts |
| Discount Code | Discounts |
| Checkout | Checkout |
| Payment | Payments |
| Payment Attempt | Payments |
| Order | Orders |
| Order Item | Orders |
| Order History | Orders |

The exact physical schema may evolve, but ownership must remain explicit.

---

# 4. Stores Module

The Stores module owns the platform's merchant/store structure.

It owns:

```text
Organization
Store
Store Configuration
Membership
Store Lifecycle
Ownership
```

## Responsibilities

The Stores module is responsible for:

- Creating stores.
- Managing store configuration.
- Managing organization/store relationships.
- Managing merchant memberships.
- Managing store lifecycle state.
- Establishing store ownership relationships.

Other modules may reference a store but must not independently modify store ownership or configuration.

---

# 5. Products Module

The Products module owns catalog information.

It owns:

```text
Product
Product Variant
SKU
Product Attributes
Product Price
Publication State
Catalog Metadata
```

The Products module determines whether a product is:

- Draft.
- Published.
- Archived.
- Otherwise unavailable according to the defined product lifecycle.

Other modules may read product information through appropriate interfaces.

They must not directly modify product records.

---

# 6. Inventory Module

The Inventory module owns stock state.

It owns:

```text
Inventory Record
Available Quantity
Reserved Quantity where applicable
Inventory Adjustment
Inventory State
```

Inventory is a critical business domain.

Other modules must not directly modify inventory quantities.

For example:

```text
Incorrect:

Orders
  ↓
UPDATE inventory

Correct:

Orders / Checkout
  ↓
Inventory Public Interface
  ↓
Inventory Module
  ↓
PostgreSQL
```

This ensures that inventory rules remain centralized.

---

# 7. Customers Module

The Customers module owns customer records belonging to stores.

It owns:

```text
Customer
Customer Profile
Customer Store Relationship
Customer Status
```

Customer information must remain tenant-scoped.

A customer belonging to Store A must not become accessible to Store B merely because the records share the same database.

---

# 8. Carts Module

The Carts module owns shopping carts.

It owns:

```text
Cart
Cart Item
Cart Lifecycle
Cart State
```

Cart state may reference:

- Store.
- Customer or guest identity.
- Product.
- Variant.
- Quantity.

However, the cart does not become the owner of product or inventory data.

For example:

```text
Cart
 ├── productId
 └── quantity
```

does not mean the Cart module owns the product or inventory represented by those references.

---

# 9. Discounts Module

The Discounts module owns discount definitions and eligibility rules.

It owns:

```text
Discount
Discount Code
Discount Conditions
Discount Validity
Discount Limits
Discount Calculation Rules
```

Other modules may request discount evaluation.

They must not duplicate discount logic independently.

For example:

```text
Checkout
   ↓
Discount Interface
   ↓
Discount Evaluation
   ↓
Discount Result
```

---

# 10. Checkout Module

Checkout owns the checkout process as an application/domain workflow.

It coordinates information from multiple modules.

Checkout may depend on:

```text
Products
Inventory
Customers
Discounts
Payments
Orders
```

However, Checkout does not become the owner of these entities.

Its responsibility is orchestration.

Conceptually:

```text
Checkout
   │
   ├── Products
   ├── Inventory
   ├── Discounts
   ├── Payments
   └── Orders
```

Checkout-specific state belongs to the Checkout module.

---

# 11. Payments Module

The Payments module owns the platform's payment lifecycle.

It owns:

```text
Payment
Payment Attempt
Payment State
Provider Reference
Payment Events
Idempotency Information
```

The module integrates with external payment providers.

External provider records are not substitutes for the internal payment state.

The Payments module is responsible for translating provider events into valid internal state transitions.

---

# 12. Orders Module

The Orders module owns completed transaction records.

It owns:

```text
Order
Order Item
Order Totals
Order Status
Order History
Transaction Snapshot
```

Orders are historical business records.

Once an order is created, the information necessary to represent the transaction must remain stable.

For example:

```text
Product
Current Price
      ≠
Order Item
Historical Unit Price
```

The order must preserve the historical transaction values it needs.

---

# 13. Ownership vs Reference

A module may reference another module's entity without owning it.

Example:

```text
Order
 ├── storeId
 ├── customerId
 └── productId
```

These IDs establish relationships.

They do not transfer ownership.

The owning modules remain:

```text
storeId     → Stores
customerId  → Customers
productId   → Products
```

This distinction must remain clear throughout the system.

---

# 14. Cross-Module Data Access

Cross-module access should use a public interface.

Example:

```text
Checkout
   ↓
Products.getProductForCheckout(...)
```

rather than:

```text
Checkout
   ↓
ProductsRepository
   ↓
products table
```

The second approach bypasses the Products module's business rules.

---

# 15. Direct Database Access Rules

Direct database access across module ownership boundaries is prohibited.

A module must not:

```text
- Modify another module's tables.
- Insert another module's business entities.
- Delete another module's business entities.
- Bypass another module's lifecycle rules.
```

Reading another module's raw tables should also be avoided when the information is available through a public interface.

Exceptions require an explicit architectural reason.

---

# 16. Database Transactions Across Modules

A single PostgreSQL transaction may involve multiple modules when a business operation requires atomicity.

For example:

```text
Checkout
   ↓
Transaction
   ├── Inventory operation
   ├── Order creation
   └── Payment-related state
```

The fact that multiple modules participate in a transaction does not change their ownership.

Each module remains responsible for its own state and invariants.

---

# 17. Cross-Module Queries

Cross-module reporting or read models may require information from multiple domains.

For example:

```text
Order
+
Customer
+
Product
```

Such queries should not result in uncontrolled table access throughout the application.

Appropriate approaches include:

- Public module query interfaces.
- Application-level composition.
- Dedicated read models where justified.
- Carefully scoped reporting queries.

The approach should be selected according to the use case.

---

# 18. Historical Snapshots

Business records that represent completed transactions should preserve information that must not change when referenced entities change.

For example, an Order Item may store:

```text
Product ID
Product Name Snapshot
SKU Snapshot
Unit Price Snapshot
Quantity
Discount Snapshot
```

This prevents historical records from changing simply because the current product changed.

The exact snapshot fields belong to the Order domain and database schema.

---

# 19. Tenant Ownership

All store-owned business data must be associated with the appropriate tenant/store context.

Conceptually:

```text
Organization
    ↓
Store
    ↓
Store-Owned Resource
```

Examples:

```text
Store
 ├── Products
 ├── Inventory
 ├── Customers
 ├── Carts
 ├── Discounts
 └── Orders
```

The application must enforce tenant isolation server-side.

Client-provided IDs must never be treated as sufficient proof of access.

---

# 20. Tenant-Scoped Queries

Queries involving store-owned resources must include the appropriate tenant/store scope.

Conceptually:

```text
WHERE
    resource_id = requestedId
    AND store_id = currentStoreId
```

The exact implementation may vary by repository or application service.

The security invariant does not.

A resource from another store must not become accessible simply because its identifier is known.

---

# 21. Organization vs Store Ownership

Organization-level data and store-level data must remain distinct.

The hierarchy is:

```text
Organization
    ↓
Store
    ↓
Store Resources
```

A user may belong to an organization while having access to only specific stores.

Authorization must therefore consider both:

- Organization membership.
- Store membership and permissions.

The database model must support this distinction.

---

# 22. Membership Ownership

Membership records are owned by the Stores module because they define access to merchant stores.

Membership data may include:

- User.
- Organization.
- Store.
- Role.
- Status.

Authorization logic may consume this information through the appropriate access layer.

The customer domain must not be treated as the source of merchant membership authorization.

---

# 23. Soft Deletion and Lifecycle State

Deletion behavior must be defined by domain requirements.

Not every entity should be physically deleted.

Examples:

- Orders generally require historical preservation.
- Payment records may require retention.
- Products may be archived instead of deleted.
- Stores may have lifecycle states.

The owning module determines the appropriate lifecycle behavior.

Database deletion must not bypass business retention requirements.

---

# 24. Referential Integrity

Foreign keys should be used where they support the domain model and do not conflict with required lifecycle behavior.

Relationships such as:

```text
Order → Store
Order → Customer
Order Item → Order
```

should maintain referential integrity.

However, foreign keys do not replace authorization.

A valid foreign key relationship does not mean a user is allowed to access the referenced record.

---

# 25. Constraints as Ownership Protection

Database constraints should reinforce module ownership and business invariants where practical.

Examples include:

- Unique store identifiers.
- Unique product identifiers within the required scope.
- Unique discount codes within a store.
- Valid order-item relationships.
- Valid payment references.
- Valid membership relationships.

The database should prevent invalid states where possible.

---

# 26. Events and Ownership

Events communicate facts without transferring ownership.

Example:

```text
OrderCreated
```

may be consumed by:

- Notifications.
- Analytics.
- Customer communication.
- Other secondary processes.

The event does not make those consumers owners of the Order.

Similarly:

```text
ProductPublished
```

does not make another module the owner of the Product.

---

# 27. Eventual Consistency

Derived systems may temporarily contain stale information.

For example:

```text
Product
   ↓
Search Index
```

The search index may lag behind PostgreSQL.

This is acceptable for derived functionality.

It is not acceptable for critical business decisions where stale state could produce:

- Incorrect inventory.
- Invalid payment state.
- Unauthorized access.
- Incorrect order totals.

Critical decisions must use authoritative state.

---

# 28. Ownership Change

If architectural analysis determines that another module should own a business entity, the ownership change must be deliberate.

It should include:

1. Identify the current owner.
2. Define the new owner.
3. Identify all dependencies.
4. Define the migration strategy.
5. Update module interfaces.
6. Update database ownership.
7. Update tests.
8. Remove obsolete access paths.
9. Update documentation.

Ownership must not drift gradually through convenience imports.

---

# 29. Data Access Anti-Patterns

The following patterns are prohibited unless explicitly justified.

### Cross-Module Table Manipulation

```text
Orders → UPDATE products
```

### Shared Repository Abuse

```text
Any Module
    ↓
GlobalRepository
    ↓
Any Table
```

### Duplicated Business Rules

```text
Checkout calculates discount
Orders calculates discount
Cart calculates discount
```

### Client-Controlled Tenant Selection

```text
POST /orders
{
    "storeId": "some-store"
}
```

without server-side verification of the caller's access.

### Provider as Database

```text
Payment Provider API
      ↓
Application assumes provider is authoritative for all internal state
```

---

# 30. Ownership Matrix

The high-level ownership model is:

| Domain | Owner | Can Other Modules Mutate Directly? |
|---|---|---:|
| Organization | Stores | No |
| Store | Stores | No |
| Membership | Stores | No |
| Product | Products | No |
| Product Pricing | Products | No |
| Inventory | Inventory | No |
| Customer | Customers | No |
| Cart | Carts | No |
| Discount | Discounts | No |
| Checkout | Checkout | No |
| Payment | Payments | No |
| Order | Orders | No |

Other modules interact through defined application/domain interfaces.

---

# 31. Data Ownership and API Design

API boundaries should reflect data ownership.

For example:

```text
Products API
    → Product operations

Inventory API
    → Inventory operations

Orders API
    → Order operations
```

An API endpoint should not bypass the owning module merely because the endpoint is technically capable of doing so.

Presentation-layer organization must follow domain ownership.

---

# 32. Data Ownership and Background Jobs

Background workers must preserve ownership rules.

A worker processing:

```text
InventoryAdjustmentJob
```

must invoke the Inventory module rather than directly modifying inventory tables from worker infrastructure.

Similarly:

```text
PaymentWebhookJob
```

must invoke the Payments module.

Workers are execution infrastructure, not alternative domain owners.

---

# 33. Data Ownership and Integrations

External integrations must also respect module ownership.

Examples:

```text
Payment Provider
      ↓
Payments Module

Object Storage
      ↓
Media/Application Boundary

Email Provider
      ↓
Notification/Application Boundary
```

External provider adapters must not directly mutate unrelated business state.

---

# 34. Testing Requirements

Data ownership must be tested.

Tests should verify:

- Cross-store access is rejected.
- Unauthorized mutation is rejected.
- Module interfaces enforce expected behavior.
- Inventory cannot be modified through unrelated modules.
- Payment state transitions remain controlled.
- Orders preserve historical values.
- Foreign-key relationships remain valid.
- Tenant-scoped queries cannot leak records.

Integration tests should specifically cover ownership boundaries.

---

# 35. Evolution Toward V1

The ownership model should remain stable as the system scales.

Infrastructure may change:

```text
Demo
 ↓
Managed PostgreSQL
 ↓
Read Replicas
 ↓
Specialized Storage
```

Runtime deployment may change:

```text
Modular Monolith
 ↓
Selective Service Extraction
```

But business ownership should remain conceptually stable.

This allows infrastructure to evolve without rewriting domain ownership.

---

# 36. Decision Rules

When adding a new entity, determine:

1. Which module owns it?
2. What business rules govern it?
3. Which module creates it?
4. Which module mutates it?
5. Which modules may read it?
6. What tenant owns it?
7. What historical information must be preserved?
8. Which database constraints protect it?
9. Which public interfaces expose it?
10. Which events represent important changes to it?

No core business entity should be introduced without an explicit owner.

---

# 37. Final Principle

The database may be shared.

**Ownership must not be.**

The platform will maintain one authoritative PostgreSQL system while preserving clear ownership of business data across modules.

The governing rule is:

> **Shared database infrastructure does not create shared business ownership.**