# Database Schema Overview

## 1. Purpose

This document defines the high-level database schema strategy for the Demo commerce platform.

The database must support:

- Multi-tenant store isolation
- Strong relational integrity
- Transactionally correct commerce operations
- Clear ownership between business modules
- Safe concurrent operations
- Historical correctness for orders and payments
- Future evolution toward V1 without requiring a fundamental data-model rewrite

PostgreSQL is the authoritative transactional source of truth for core business data.

This document defines the schema at the architectural level. Detailed table definitions, column types, constraints, and migrations belong to implementation-specific database work.

---

## 2. Database Principles

The database design follows these principles:

1. **PostgreSQL is the source of truth**
2. **Every business entity has one authoritative owner**
3. **Tenant boundaries are represented explicitly**
4. **Foreign keys enforce relational integrity**
5. **Database constraints protect critical invariants**
6. **Transactions protect multi-step business operations**
7. **Concurrency-sensitive operations use appropriate locking or atomic updates**
8. **Historical business records are immutable where appropriate**
9. **Order records preserve historical snapshots**
10. **External providers are not authoritative for internal business state**
11. **Indexes support actual access patterns rather than speculative optimization**
12. **Schema changes must be migration-driven**
13. **Database access must respect module ownership**
14. **Sensitive data must be minimized and protected**

---

# 3. Tenant Hierarchy

The core ownership hierarchy is:

```text
Organization
    │
    ├── Memberships
    │
    └── Stores
          │
          ├── Store Configuration
          ├── Products
          ├── Inventory
          ├── Customers
          ├── Carts
          ├── Discounts
          ├── Checkouts
          ├── Payments
          └── Orders
```

A user may belong to multiple organizations and stores.

Business resources are normally scoped to a store.

The database model must make accidental cross-store access difficult and detectable.

---

# 4. Core Entity Groups

The database is divided conceptually into the following groups.

## 4.1 Identity and Tenant Entities

Primary entities:

- `users`
- `organizations`
- `organization_memberships`
- `stores`
- `store_memberships`

These establish:

- identity
- organizational ownership
- store ownership
- merchant membership
- role assignment
- tenant boundaries

Authentication credentials may be managed by an external identity provider or by the application's authentication subsystem.

Business data must reference the application's normalized user identity rather than provider-specific identity objects.

---

# 5. Store Entities

The Stores module owns store-level configuration and lifecycle information.

Conceptual entities:

```text
organizations
    ↓
stores
    ↓
store_settings
```

A store should contain information such as:

- store identity
- organization ownership
- name
- slug
- status
- currency
- locale
- timezone
- publication state
- creation/update timestamps

Store settings should remain separate when configuration grows sufficiently large to justify separation.

The store is the primary tenant boundary for commerce resources.

---

# 6. Product Entities

The Products module owns catalog information.

Conceptual model:

```text
stores
   │
   └── products
          │
          └── product_variants
                 │
                 └── SKU / pricing information
```

Depending on implementation needs, pricing may be represented directly on variants during Demo.

Typical product information includes:

- product identity
- store ownership
- title
- description
- status
- publication state
- slug
- timestamps

Variants may contain:

- SKU
- price
- compare-at price where supported
- product relationship
- variant status

Product media references should not store binary files inside PostgreSQL.

Instead, PostgreSQL stores metadata and object-storage references.

---

# 7. Inventory Entities

Inventory is owned exclusively by the Inventory module.

Conceptually:

```text
product_variant
      │
      ↓
inventory_item
      │
      ├── available quantity
      ├── reserved quantity
      └── inventory adjustments
```

The exact inventory model may evolve, but the database must support:

- current quantity
- reservations where required
- adjustments
- concurrency-safe updates
- inventory history/auditability

Inventory quantity must not be modified by unrelated modules through direct SQL.

Checkout and Orders may request inventory operations through the Inventory module's public application interface.

---

# 8. Customer Entities

The Customers module owns customer records.

Conceptually:

```text
stores
   │
   └── customers
          │
          ├── customer profile
          └── customer addresses
```

Customer records are store-scoped.

A customer may interact with multiple stores, but each store maintains its own business relationship and customer data.

Customer data may include:

- name
- email
- phone
- addresses
- account metadata
- timestamps

Sensitive customer information must be minimized and protected.

---

# 9. Cart Entities

The Carts module owns shopping cart state.

Conceptually:

```text
customer / session
       │
       ↓
     cart
       │
       └── cart_items
              │
              └── product_variant reference
```

A cart contains:

- store reference
- customer or anonymous session reference
- status
- currency
- timestamps

Cart items contain:

- variant reference
- quantity
- pricing information required for cart calculation

Cart data is mutable.

It must not be treated as an immutable financial record.

---

# 10. Discount Entities

The Discounts module owns discount configuration and eligibility rules.

Conceptually:

```text
stores
   │
   └── discounts
          │
          ├── discount codes
          ├── eligibility rules
          └── usage limits
```

Discount data may include:

- discount identity
- code
- type
- value
- validity period
- activation state
- usage limits
- applicable products
- applicable collections/categories where supported
- customer eligibility

Discount calculations must remain in the Discounts domain rather than being duplicated inside checkout or orders.

---

# 11. Checkout Entities

Checkout represents the transition from shopping state toward an order.

Conceptually:

```text
cart
 ↓
checkout
 ↓
payment
 ↓
order
```

Checkout records may contain:

- checkout identity
- store reference
- cart reference
- customer reference
- selected items
- calculated totals
- applied discounts
- checkout state
- payment state
- timestamps

Checkout data should support safe retries.

A checkout request must not accidentally create multiple orders because a client retries the same operation.

---

# 12. Payment Entities

The Payments module owns internal payment state.

Conceptually:

```text
checkout
   │
   ↓
payment
   │
   └── payment_attempts
           │
           └── provider reference
```

The database should distinguish:

- internal payment ID
- payment attempt ID
- provider/payment intent reference
- internal payment state
- provider state
- amount
- currency
- timestamps
- idempotency information

Raw card credentials must not be stored.

The provider's system is authoritative for provider-side payment processing, while the application's payment records remain authoritative for the application's business workflow.

---

# 13. Order Entities

Orders are owned by the Orders module.

Conceptually:

```text
orders
   │
   ├── order_items
   │
   ├── order_totals
   │
   ├── order_addresses
   │
   └── order_status_history
```

Orders represent completed business transactions and therefore require stronger historical guarantees than carts.

An order should preserve the information required to understand what was purchased at the time of purchase.

This includes historical snapshots such as:

- product name
- SKU
- unit price
- quantity
- discount
- tax where supported
- customer information required for the order
- shipping/billing information where supported
- final totals

Changing the current product record must not rewrite historical order information.

---

# 14. Order Item Snapshot Strategy

Order items should not depend exclusively on the current product catalog.

For example:

```text
Current Product
    ↓
Product name: "Premium Shirt"
Price: ₹1,999

Order Item Snapshot
    ↓
Product name: "Premium Shirt"
Price at purchase: ₹1,799
SKU: SHIRT-BLU-M
```

If the merchant later changes:

```text
Product name → "Premium Cotton Shirt"
Price → ₹2,199
```

the historical order must remain unchanged.

This is essential for:

- customer order history
- merchant reporting
- refunds
- dispute handling
- invoices
- auditing

---

# 15. Relationships

The major relational relationships are:

```text
Organization
    ├──< OrganizationMembership
    └──< Store

Store
    ├──< StoreMembership
    ├──< Product
    ├──< Customer
    ├──< Cart
    ├──< Discount
    ├──< Checkout
    ├──< Payment
    └──< Order

Product
    └──< ProductVariant

ProductVariant
    ├──< InventoryItem
    └──< CartItem

Cart
    └──< CartItem

Checkout
    └──< Payment

Order
    ├──< OrderItem
    └──< OrderStatusHistory
```

Actual relationships may include additional supporting entities.

---

# 16. Primary Keys

Business entities use **application-generated UUIDv7** identifiers.

The identifier strategy is:

- **UUIDv7** at the application boundary
- generated **before INSERT**, never by `gen_random_uuid()` for entity primary keys
- stored as PostgreSQL native `UUID`
- consistent across entities
- independent of database-side UUID generation

Identifiers should:

- be unique
- remain stable
- not encode business meaning
- not expose sequential database information unnecessarily
- be safe for distributed/background processing

Foreign keys should reference the authoritative primary key of the owned entity.

UUIDv7 generation lives in `packages/db` and is shared by web and worker processes.

---

# 17. Tenant Scoping

Store-owned resources should normally contain an explicit store relationship.

For example:

```text
products.store_id
customers.store_id
carts.store_id
discounts.store_id
orders.store_id
```

This provides an explicit tenant boundary and makes scoped queries straightforward.

A request such as:

```text
GET /stores/store-A/orders/order-123
```

must never rely solely on:

```text
WHERE id = 'order-123'
```

The effective lookup must establish store ownership as well.

Conceptually:

```text
WHERE id = order_id
  AND store_id = current_store_id
```

Authorization remains an application-layer responsibility, while database relationships provide structural integrity.

---

# 18. Foreign Keys

Foreign keys should be used wherever a relationship represents an actual database-level dependency.

Examples:

```text
stores.organization_id → organizations.id

products.store_id → stores.id

product_variants.product_id → products.id

inventory_items.variant_id → product_variants.id

orders.store_id → stores.id

order_items.order_id → orders.id
```

Foreign keys prevent orphaned records and protect data integrity.

Cascading behavior must be chosen deliberately.

Automatic cascading deletion should **not** be used casually for important commerce records.

Orders and financial records should generally be retained rather than deleted as a side effect of deleting another entity.

---

# 19. Deletion Strategy

Not every business entity should support physical deletion.

The platform should distinguish between:

- hard deletion
- soft deletion
- archival
- deactivation

Examples:

### Products

May support archival/deactivation.

### Stores

May require lifecycle states rather than immediate deletion.

### Customers

Deletion must account for legal, operational, and historical requirements.

### Orders

Orders should generally not be physically deleted through ordinary merchant operations.

### Payments

Payment records should be retained according to business and compliance requirements.

The exact retention policy is defined separately.

---

# 20. Timestamps

Business entities should generally contain:

- `created_at`
- `updated_at`

Time-sensitive entities may also contain domain-specific timestamps.

Examples:

```text
published_at
cancelled_at
paid_at
fulfilled_at
refunded_at
expires_at
```

Application timestamps should use a consistent timezone strategy, normally UTC at the database/application boundary.

Presentation-layer timezone conversion belongs outside the database's authoritative business representation.

---

# 21. Monetary Values

Money must not be represented using floating-point database types.

Amounts should use an exact representation such as:

- integer minor units, or
- PostgreSQL `numeric` with a clearly defined precision/scale

The chosen representation must be consistent across:

- products
- discounts
- carts
- checkout
- payments
- orders
- refunds

Currency must be stored explicitly where monetary values are persisted.

Example:

```text
amount = 179900
currency = "INR"
```

if integer minor units are selected.

The implementation must define one canonical representation and never mix strategies casually.

---

# 22. Status Fields

Stateful entities should use explicit state values.

Examples:

```text
Store:
ACTIVE
SUSPENDED
ARCHIVED

Product:
DRAFT
ACTIVE
ARCHIVED

Order:
PENDING
CONFIRMED
FULFILLED
CANCELLED
REFUNDED
```

The exact state machine is defined in the domain documentation.

Database constraints should prevent invalid state values.

Application/domain logic should control valid transitions.

---

# 23. Idempotency Data

Operations that can be retried must have a mechanism to prevent duplicate effects.

Potential entities requiring idempotency support include:

- checkout completion
- payment creation
- payment webhooks
- order creation
- inventory operations
- external integration callbacks

The database may enforce uniqueness through identifiers such as:

```text
idempotency_key
provider_event_id
provider_payment_id
operation_id
```

Idempotency must be tied to the correct tenant/store context.

---

# 24. Audit and History

Critical state changes should be traceable where operationally necessary.

Examples:

- inventory adjustments
- order status changes
- payment state changes
- discount changes
- membership/role changes

History records should preserve relevant information rather than relying on mutable current state.

For example:

```text
order_status_history
```

can preserve:

```text
previous_state
new_state
changed_at
changed_by
reason
```

Audit requirements should be implemented according to actual business/security needs rather than creating a generic audit table for every possible event.

---

# 25. Indexing Strategy

Indexes must support real query patterns.

Important access patterns include:

```text
store → products
store → orders
store → customers
store → inventory
store → discounts
customer → orders
cart → cart_items
order → order_items
product → variants
variant → inventory
```

Composite indexes should be considered when queries consistently filter by tenant plus another attribute.

Examples:

```text
(store_id, status)
(store_id, created_at)
(store_id, slug)
```

Indexes must not be added indiscriminately.

Every significant index should have a reason based on:

- query patterns
- uniqueness requirements
- foreign-key access
- sorting/filtering
- measured performance

Detailed index definitions belong in the database implementation documentation.

---

# 26. Transactions

Transactions are required when multiple database changes must succeed or fail together.

Examples include:

### Checkout completion

```text
Validate checkout
    ↓
Validate inventory
    ↓
Reserve/decrement inventory
    ↓
Create order
    ↓
Record payment state
    ↓
Commit
```

The exact transaction boundary depends on payment-provider behavior and must not assume that an external API participates in the PostgreSQL transaction.

### Inventory adjustment

```text
Read/lock current inventory
    ↓
Validate operation
    ↓
Update quantity
    ↓
Create adjustment record
    ↓
Commit
```

### Order state transition

```text
Validate current state
    ↓
Validate requested transition
    ↓
Update order
    ↓
Create history record
    ↓
Commit
```

Transactions protect internal consistency.

They do not magically make external APIs transactional. Humanity has yet to invent that particular convenience.

---

# 27. Concurrency

Concurrency-sensitive entities require explicit protection.

Important examples:

- inventory
- cart updates
- checkout completion
- payment processing
- order transitions
- discount usage limits

Possible mechanisms include:

- row-level locking
- atomic SQL updates
- unique constraints
- optimistic concurrency
- transaction isolation
- idempotency keys

The correct mechanism depends on the specific operation.

Concurrency behavior must be documented and tested rather than assumed.

---

# 28. External References

External systems may introduce identifiers such as:

```text
payment_provider_customer_id
payment_provider_payment_id
object_storage_key
email_provider_message_id
```

These references should be stored as integration data owned by the relevant module.

External identifiers must not replace internal primary keys.

For example:

```text
payments.id
payments.provider_payment_id
```

are separate concepts.

---

# 29. Database and Module Ownership

Although all Demo modules may use the same PostgreSQL database, logical ownership remains separate.

For example:

```text
Products
    owns product tables

Inventory
    owns inventory tables

Orders
    owns order tables

Payments
    owns payment tables
```

Another module must not bypass the owning module and directly mutate those tables.

Shared database infrastructure does not imply shared business ownership.

---

# 30. Schema Evolution

All schema changes must be migration-driven.

Changes should consider:

- existing data
- backward compatibility
- application deployment order
- indexes
- constraints
- long-running operations
- rollback strategy
- production data volume

For potentially breaking changes, prefer an expand-and-contract approach:

```text
Expand
  ↓
Deploy compatible application
  ↓
Backfill / migrate data
  ↓
Switch application behavior
  ↓
Contract
```

The Demo implementation may use a simpler migration process where appropriate, but should avoid patterns that would make future evolution unnecessarily difficult.

---

# 31. Demo-to-V1 Compatibility

The Demo schema should be designed so that V1 can add:

- read replicas
- connection pooling
- Redis/cache
- search indexes
- analytics pipelines
- managed PostgreSQL
- partitioning where justified
- larger background-processing infrastructure
- additional integrations

without changing the fundamental ownership model.

The schema should therefore optimize for **correct domain representation first**, not hypothetical massive scale.

---

# 32. Database Invariants

The following invariants are mandatory:

1. Every store belongs to an organization.
2. Every store-owned business resource belongs to exactly one store.
3. Cross-store access must be prevented at the application authorization boundary.
4. Foreign-key relationships must remain valid.
5. Critical commerce state changes must be transactional.
6. Inventory updates must be concurrency-safe.
7. Payment operations must be idempotent where retries are possible.
8. Orders must preserve historical purchase information.
9. Monetary values must use exact arithmetic.
10. Invalid state values must be rejected.
11. Critical historical records must not be casually deleted.
12. External provider identifiers must not replace internal identifiers.
13. Database migrations must be version-controlled.
14. Module ownership must remain explicit even within the shared PostgreSQL database.
15. PostgreSQL remains the authoritative source of truth for core transactional business state.

---

# 33. Definition of Done

The database architecture is considered sufficiently defined when:

- Tenant hierarchy is explicit.
- Core entities and ownership are identified.
- Relationships are documented.
- Historical order behavior is defined.
- Monetary representation is defined.
- Transaction requirements are identified.
- Concurrency-sensitive areas are identified.
- Idempotency requirements are identified.
- Deletion behavior is considered.
- Indexing principles are defined.
- Migration strategy is defined.
- Module ownership is preserved.
- Demo-to-V1 evolution does not require a fundamental schema rewrite.

Detailed implementation should proceed only after these architectural constraints are respected.