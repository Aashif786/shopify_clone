# Database Entity Model

## 1. Purpose

This document defines the logical entity model for the Demo commerce platform.

It identifies:

- Core entities
- Entity ownership
- Important attributes
- Relationships
- Lifecycle responsibilities
- Tenant scope
- Historical data requirements
- Cross-module references

This document defines the logical model, not the final SQL schema. Exact PostgreSQL column types, indexes, constraints, generated values, and migration syntax belong to database implementation.

---

# 2. Entity Model Principles

The entity model follows these rules:

1. Every business entity has one authoritative owner.
2. Store-owned entities are explicitly tenant-scoped.
3. Primary keys are stable internal identifiers.
4. Foreign keys represent real relationships.
5. Historical records must not depend on mutable current business data.
6. Mutable operational state and historical records are modeled separately where necessary.
7. Business rules belong to the owning domain.
8. Cross-module relationships use stable identifiers and public interfaces.
9. External provider identifiers remain separate from internal identifiers.
10. Entities should contain only information required by their domain responsibility.

---

# 3. High-Level Entity Graph

```text
Organization
│
├── OrganizationMembership
│
└── Store
    │
    ├── StoreMembership
    │
    ├── StoreSettings
    │
    ├── Product
    │   └── ProductVariant
    │       └── InventoryItem
    │
    ├── Customer
    │   └── CustomerAddress
    │
    ├── Cart
    │   └── CartItem
    │
    ├── Discount
    │   └── DiscountCode
    │
    ├── Checkout
    │   └── CheckoutItem
    │
    ├── Payment
    │   └── PaymentAttempt
    │
    └── Order
        ├── OrderItem
        ├── OrderAddress
        └── OrderStatusHistory
```

Some relationships are intentionally represented through references rather than direct ownership.

---

# 4. Identity Entities

## 4.1 User

**Owner:** Authentication/identity infrastructure

**Purpose:** Represents an authenticated platform user.

Conceptual attributes:

| Attribute | Purpose |
|---|---|
| `id` | Internal user identifier |
| `email` | Login/contact identity |
| `name` | Display name |
| `status` | Account lifecycle state |
| `created_at` | Creation timestamp |
| `updated_at` | Last modification timestamp |

The User entity does not determine what the user is allowed to do within a store.

Authorization is determined through memberships and permissions.

---

# 5. Organization Entities

## 5.1 Organization

**Owner:** Stores module

**Purpose:** Represents the top-level merchant organization.

Conceptual attributes:

| Attribute | Purpose |
|---|---|
| `id` | Organization identifier |
| `name` | Organization name |
| `status` | Organization lifecycle |
| `created_at` | Creation timestamp |
| `updated_at` | Last modification timestamp |

An organization may own multiple stores.

---

## 5.2 OrganizationMembership

**Owner:** Stores module

**Purpose:** Associates a user with an organization.

Conceptual attributes:

| Attribute | Purpose |
|---|---|
| `id` | Membership identifier |
| `organization_id` | Organization reference |
| `user_id` | User reference |
| `role` | Organization-level role where applicable |
| `status` | Membership state |
| `created_at` | Creation timestamp |
| `updated_at` | Last modification timestamp |

The Demo authorization model should avoid unnecessary organization-level complexity.

Store-level permissions remain the primary operational authorization mechanism.

---

# 6. Store Entities

## 6.1 Store

**Owner:** Stores module

**Tenant scope:** Organization

**Purpose:** Represents an individual merchant storefront.

Conceptual attributes:

| Attribute | Purpose |
|---|---|
| `id` | Store identifier |
| `organization_id` | Owning organization |
| `name` | Store name |
| `slug` | Store URL identifier |
| `status` | Store lifecycle state |
| `currency` | Default store currency |
| `locale` | Default locale |
| `timezone` | Store timezone |
| `created_at` | Creation timestamp |
| `updated_at` | Last modification timestamp |

A store is the primary business tenant boundary.

---

## 6.2 StoreSettings

**Owner:** Stores module

**Tenant scope:** Store

**Purpose:** Stores configurable storefront and operational settings.

Potential settings include:

- storefront configuration
- contact information
- checkout settings
- notification preferences
- branding metadata
- operational preferences

Settings should be separated from the core Store entity when doing so keeps the Store entity focused and stable.

---

## 6.3 StoreMembership

**Owner:** Stores module

**Tenant scope:** Store

**Purpose:** Associates a user with a store and establishes merchant permissions.

Conceptual attributes:

| Attribute | Purpose |
|---|---|
| `id` | Membership identifier |
| `store_id` | Store reference |
| `user_id` | User reference |
| `role` | Owner/Admin/Staff |
| `status` | Membership state |
| `created_at` | Creation timestamp |
| `updated_at` | Last modification timestamp |

A user may have memberships in multiple stores.

The same user may have different roles in different stores.

---

# 7. Product Entities

## 7.1 Product

**Owner:** Products module

**Tenant scope:** Store

**Purpose:** Represents a catalog product.

Conceptual attributes:

| Attribute | Purpose |
|---|---|
| `id` | Product identifier |
| `store_id` | Store reference |
| `title` | Product name |
| `description` | Product description |
| `slug` | Storefront identifier |
| `status` | Product lifecycle |
| `published_at` | Publication timestamp |
| `created_at` | Creation timestamp |
| `updated_at` | Last modification timestamp |

Product represents the catalog-level concept.

---

## 7.2 ProductVariant

**Owner:** Products module

**Tenant scope:** Store through Product

**Purpose:** Represents a purchasable variant of a product.

Conceptual attributes:

| Attribute | Purpose |
|---|---|
| `id` | Variant identifier |
| `product_id` | Product reference |
| `sku` | Stock keeping unit |
| `title` | Variant name |
| `price` | Current selling price |
| `currency` | Price currency |
| `status` | Variant state |
| `created_at` | Creation timestamp |
| `updated_at` | Last modification timestamp |

A product may have one or more variants.

A simple product may use a default variant rather than requiring separate product-level purchasing logic.

---

# 8. Product Media

## 8.1 ProductMedia

**Owner:** Products module

**Tenant scope:** Store through Product

**Purpose:** Represents media associated with a product or variant.

Conceptual attributes:

| Attribute | Purpose |
|---|---|
| `id` | Media identifier |
| `product_id` | Product reference |
| `variant_id` | Optional variant reference |
| `storage_key` | Object-storage reference |
| `media_type` | Image/video/etc. |
| `url` | Derived/public access URL where appropriate |
| `position` | Display ordering |
| `created_at` | Creation timestamp |

Binary media is stored outside PostgreSQL.

PostgreSQL stores metadata and references.

---

# 9. Inventory Entities

## 9.1 InventoryItem

**Owner:** Inventory module

**Tenant scope:** Store through ProductVariant

**Purpose:** Represents inventory state for a purchasable variant.

Conceptual attributes:

| Attribute | Purpose |
|---|---|
| `id` | Inventory identifier |
| `store_id` | Store reference |
| `variant_id` | Product variant reference |
| `available_quantity` | Currently available quantity |
| `reserved_quantity` | Reserved quantity where reservations are used |
| `created_at` | Creation timestamp |
| `updated_at` | Last modification timestamp |

Inventory must support concurrency-safe modification.

---

## 9.2 InventoryAdjustment

**Owner:** Inventory module

**Tenant scope:** Store

**Purpose:** Records inventory changes.

Conceptual attributes:

| Attribute | Purpose |
|---|---|
| `id` | Adjustment identifier |
| `store_id` | Store reference |
| `inventory_item_id` | Inventory reference |
| `quantity_delta` | Change amount |
| `reason` | Adjustment reason |
| `reference_type` | Related operation |
| `reference_id` | Related entity |
| `created_by` | Actor/system identifier |
| `created_at` | Timestamp |

Inventory adjustments provide operational traceability.

---

# 10. Customer Entities

## 10.1 Customer

**Owner:** Customers module

**Tenant scope:** Store

**Purpose:** Represents a customer relationship with a store.

Conceptual attributes:

| Attribute | Purpose |
|---|---|
| `id` | Customer identifier |
| `store_id` | Store reference |
| `user_id` | Optional platform user reference |
| `email` | Customer email |
| `name` | Customer name |
| `phone` | Optional phone |
| `status` | Customer state |
| `created_at` | Creation timestamp |
| `updated_at` | Last modification timestamp |

Customer identity is separate from merchant membership.

A customer must never gain merchant permissions simply because they have a customer record.

---

## 10.2 CustomerAddress

**Owner:** Customers module

**Tenant scope:** Store through Customer

**Purpose:** Stores reusable customer addresses.

Potential attributes:

- `id`
- `customer_id`
- `label`
- `recipient_name`
- `address_line_1`
- `address_line_2`
- `city`
- `state`
- `postal_code`
- `country`
- `phone`
- `created_at`
- `updated_at`

Addresses used by completed orders should be copied into order-specific snapshots.

---

# 11. Cart Entities

## 11.1 Cart

**Owner:** Carts module

**Tenant scope:** Store

**Purpose:** Represents an active or historical shopping cart.

Conceptual attributes:

| Attribute | Purpose |
|---|---|
| `id` | Cart identifier |
| `store_id` | Store reference |
| `customer_id` | Optional customer |
| `session_id` | Anonymous shopping session |
| `status` | Cart lifecycle |
| `currency` | Cart currency |
| `created_at` | Creation timestamp |
| `updated_at` | Last modification timestamp |

A cart may belong to a registered customer or anonymous session.

---

## 11.2 CartItem

**Owner:** Carts module

**Tenant scope:** Store through Cart

**Purpose:** Represents a variant selected in a cart.

Conceptual attributes:

| Attribute | Purpose |
|---|---|
| `id` | Cart-item identifier |
| `cart_id` | Cart reference |
| `variant_id` | Product variant reference |
| `quantity` | Requested quantity |
| `created_at` | Creation timestamp |
| `updated_at` | Last modification timestamp |

Cart items should reference current catalog entities.

They should not be treated as the final historical purchase record.

---

# 12. Discount Entities

## 12.1 Discount

**Owner:** Discounts module

**Tenant scope:** Store

**Purpose:** Represents a discount rule.

Conceptual attributes:

| Attribute | Purpose |
|---|---|
| `id` | Discount identifier |
| `store_id` | Store reference |
| `name` | Internal name |
| `type` | Percentage/fixed/etc. |
| `value` | Discount value |
| `status` | Active/inactive |
| `starts_at` | Optional start |
| `ends_at` | Optional expiration |
| `usage_limit` | Optional maximum usage |
| `created_at` | Creation timestamp |
| `updated_at` | Last modification timestamp |

---

## 12.2 DiscountCode

**Owner:** Discounts module

**Tenant scope:** Store through Discount

**Purpose:** Represents a customer-facing redemption code.

Conceptual attributes:

| Attribute | Purpose |
|---|---|
| `id` | Code identifier |
| `discount_id` | Discount reference |
| `code` | Redemption code |
| `status` | Code state |
| `created_at` | Creation timestamp |

The code should be uniquely constrained within the appropriate store scope.

---

## 12.3 DiscountUsage

**Owner:** Discounts module

**Tenant scope:** Store

**Purpose:** Tracks usage when limits must be enforced.

Potential attributes:

- `id`
- `discount_id`
- `customer_id`
- `order_id`
- `quantity`
- `created_at`

Usage enforcement must be concurrency-safe.

---

# 13. Checkout Entities

## 13.1 Checkout

**Owner:** Checkout module

**Tenant scope:** Store

**Purpose:** Represents a purchase session progressing toward order creation.

Conceptual attributes:

| Attribute | Purpose |
|---|---|
| `id` | Checkout identifier |
| `store_id` | Store reference |
| `cart_id` | Cart reference |
| `customer_id` | Customer reference |
| `status` | Checkout state |
| `currency` | Currency |
| `subtotal` | Calculated subtotal |
| `discount_total` | Discount amount |
| `total` | Final calculated total |
| `created_at` | Creation timestamp |
| `updated_at` | Last modification timestamp |

Checkout totals are calculated from domain rules.

---

## 13.2 CheckoutItem

**Owner:** Checkout module

**Tenant scope:** Store through Checkout

**Purpose:** Represents the items being finalized.

Potential attributes:

- `id`
- `checkout_id`
- `variant_id`
- `quantity`
- `unit_price`
- `discount_amount`
- `line_total`

Checkout items may contain calculated values needed to guarantee consistency during the checkout operation.

---

# 14. Payment Entities

## 14.1 Payment

**Owner:** Payments module

**Tenant scope:** Store

**Purpose:** Represents the application's payment state for a checkout/order.

Conceptual attributes:

| Attribute | Purpose |
|---|---|
| `id` | Payment identifier |
| `store_id` | Store reference |
| `checkout_id` | Checkout reference |
| `order_id` | Optional order reference |
| `amount` | Payment amount |
| `currency` | Payment currency |
| `status` | Internal payment state |
| `provider` | Payment provider |
| `provider_reference` | External payment identifier |
| `created_at` | Creation timestamp |
| `updated_at` | Last modification timestamp |

Payment records must not contain raw card credentials.

---

## 14.2 PaymentAttempt

**Owner:** Payments module

**Tenant scope:** Store

**Purpose:** Represents an individual attempt to process a payment.

Potential attributes:

- `id`
- `payment_id`
- `attempt_number`
- `provider_reference`
- `status`
- `amount`
- `failure_code`
- `failure_reason`
- `created_at`
- `updated_at`

A payment may have multiple attempts.

This allows retry behavior without overwriting historical attempts.

---

# 15. Payment Idempotency

## 15.1 PaymentOperation / Idempotency Record

**Owner:** Payments module

**Purpose:** Prevents duplicate processing of retryable operations.

Potential attributes:

- `id`
- `store_id`
- `idempotency_key`
- `operation_type`
- `request_hash`
- `result_reference`
- `created_at`
- `expires_at` where applicable

The exact implementation may use a dedicated table or an equivalent uniqueness mechanism.

The key requirement is that duplicate requests cannot accidentally create duplicate financial effects.

---

# 16. Order Entities

## 16.1 Order

**Owner:** Orders module

**Tenant scope:** Store

**Purpose:** Represents the completed business transaction.

Conceptual attributes:

| Attribute | Purpose |
|---|---|
| `id` | Internal order identifier |
| `store_id` | Store reference |
| `order_number` | Customer/merchant-facing identifier |
| `customer_id` | Customer reference |
| `status` | Order lifecycle state |
| `currency` | Order currency |
| `subtotal` | Historical subtotal |
| `discount_total` | Historical discount |
| `total` | Historical final total |
| `placed_at` | Purchase timestamp |
| `created_at` | Creation timestamp |
| `updated_at` | Last modification timestamp |

The order is the authoritative historical representation of the transaction.

---

## 16.2 OrderItem

**Owner:** Orders module

**Tenant scope:** Store through Order

**Purpose:** Preserves the purchased product information.

Conceptual attributes:

| Attribute | Purpose |
|---|---|
| `id` | Order-item identifier |
| `order_id` | Order reference |
| `product_id` | Original product reference where useful |
| `variant_id` | Original variant reference where useful |
| `product_name` | Historical product name |
| `variant_name` | Historical variant name |
| `sku` | Historical SKU |
| `unit_price` | Historical purchase price |
| `quantity` | Purchased quantity |
| `discount_amount` | Historical discount |
| `line_total` | Historical line total |

The snapshot fields are authoritative for historical order presentation.

Current catalog data is not.

---

# 17. OrderAddress

**Owner:** Orders module

**Tenant scope:** Store through Order

**Purpose:** Preserves the address used for the order.

Potential attributes:

- `id`
- `order_id`
- `type`
- `recipient_name`
- `address_line_1`
- `address_line_2`
- `city`
- `state`
- `postal_code`
- `country`
- `phone`

Order addresses should be snapshots.

Changing the customer's saved address must not modify a historical order.

---

# 18. OrderStatusHistory

**Owner:** Orders module

**Tenant scope:** Store through Order

**Purpose:** Preserves order lifecycle transitions.

Potential attributes:

- `id`
- `order_id`
- `previous_status`
- `new_status`
- `changed_by`
- `reason`
- `created_at`

This supports:

- merchant visibility
- debugging
- auditability
- operational history

---

# 19. Notification Entities

Notifications are secondary operational data.

A minimal Demo implementation may use an event/job record rather than maintaining a complex notification domain.

If persistent notification state is required, a conceptual entity may contain:

- `id`
- `store_id`
- `customer_id`
- `type`
- `channel`
- `status`
- `reference_type`
- `reference_id`
- `attempt_count`
- `created_at`
- `sent_at`

Notifications must not become the source of truth for the underlying business operation.

For example, failure to send an order email must not invalidate the order.

---

# 20. Background Job Entities

The worker may require persistent job metadata.

Potential fields:

- `id`
- `job_type`
- `store_id`
- `payload`
- `status`
- `attempt_count`
- `available_at`
- `started_at`
- `completed_at`
- `failed_at`
- `last_error`
- `created_at`
- `updated_at`

The exact implementation may use PostgreSQL-backed jobs during Demo.

A future queue can replace the infrastructure without changing the underlying business domain.

---

# 21. Webhook Processing Entities

Webhook processing may require a persistent record for idempotency.

Conceptual entity:

```text id="0fmxh7"
WebhookEvent
```

Potential attributes:

- `id`
- `provider`
- `provider_event_id`
- `event_type`
- `payload_reference`
- `status`
- `processed_at`
- `failure_reason`
- `created_at`

The provider event identifier should be uniquely constrained within the appropriate provider scope.

Repeated delivery of the same webhook must not create duplicate business effects.

---

# 22. Entity Ownership Matrix

| Entity | Owner | Tenant Scope |
|---|---|---|
| User | Identity | Platform |
| Organization | Stores | Platform |
| OrganizationMembership | Stores | Organization |
| Store | Stores | Organization |
| StoreSettings | Stores | Store |
| StoreMembership | Stores | Store |
| Product | Products | Store |
| ProductVariant | Products | Store |
| ProductMedia | Products | Store |
| InventoryItem | Inventory | Store |
| InventoryAdjustment | Inventory | Store |
| Customer | Customers | Store |
| CustomerAddress | Customers | Store |
| Cart | Carts | Store |
| CartItem | Carts | Store |
| Discount | Discounts | Store |
| DiscountCode | Discounts | Store |
| DiscountUsage | Discounts | Store |
| Checkout | Checkout | Store |
| CheckoutItem | Checkout | Store |
| Payment | Payments | Store |
| PaymentAttempt | Payments | Store |
| Payment Idempotency Record | Payments | Store |
| Order | Orders | Store |
| OrderItem | Orders | Store |
| OrderAddress | Orders | Store |
| OrderStatusHistory | Orders | Store |
| Notification | Worker/Notifications | Store |
| Job | Worker | Store where applicable |
| WebhookEvent | Integration/Payments | Provider + Store where applicable |

---

# 23. Entity Reference Rules

A module may reference another module's entity identifier when required.

For example:

```text
CartItem
    → ProductVariant ID

InventoryItem
    → ProductVariant ID

Order
    → Customer ID

Payment
    → Checkout ID
```

However, the referencing module does not gain ownership of the referenced entity.

For example:

```text
Inventory
    may reference ProductVariant

Inventory
    does not own ProductVariant
```

The Products module remains authoritative.

---

# 24. Historical Data Rules

Historical records must preserve values that can change over time.

Examples include:

- Product name
- Variant name
- SKU
- Purchase price
- Discount amount
- Customer address
- Order totals
- Currency
- Payment amount

The platform must not reconstruct historical transactions from today's mutable catalog data.

---

# 25. Mutable vs Historical Entities

### Highly Mutable

- Product
- ProductVariant
- InventoryItem
- Cart
- Discount
- Customer profile
- Store settings

### Operationally Stateful

- Checkout
- Payment
- PaymentAttempt
- Order

### Historical

- OrderItem
- OrderAddress
- OrderStatusHistory
- InventoryAdjustment
- PaymentAttempt records
- Webhook processing records

This distinction influences update, deletion, audit, and transaction behavior.

---

# 26. Identifier Strategy

The final implementation should use one consistent internal identifier strategy.

Requirements:

- globally unique within the system
- stable
- non-semantic
- safe for API exposure where appropriate
- compatible with PostgreSQL
- suitable for background jobs and event references

Entity identifiers should not encode:

- store names
- customer names
- product names
- timestamps as business meaning
- authorization information

Human-readable identifiers such as `order_number` should be separate from internal primary keys.

---

# 27. Human-Readable Identifiers

Some entities may require public identifiers separate from database IDs.

Examples:

```text
Store
    slug

Product
    slug

Order
    order_number

Discount
    code
```

These values may be used by storefronts or merchants.

They must still be subject to tenant-scoped uniqueness.

For example, product slugs may be unique within a store rather than globally.

---

# 28. Entity Lifecycle Ownership

The module that owns an entity is responsible for:

- creation
- validation
- state transitions
- business updates
- deletion/archive rules
- persistence rules
- domain events
- historical behavior
- concurrency requirements

Other modules request changes through the owner's public interface.

They must not directly modify the owner's database records.

---

# 29. Cross-Domain Entity Relationships

Cross-domain workflows may reference several entities.

Example:

```text
Checkout
    ↓
ProductVariant
    ↓
InventoryItem
    ↓
Payment
    ↓
Order
```

This does not mean Checkout owns these entities.

Checkout coordinates the purchase process.

Products own product information.

Inventory owns inventory state.

Payments own payment state.

Orders own the final transaction record.

---

# 30. Database Invariants

The entity model must preserve these invariants:

1. Every store belongs to exactly one organization.
2. Store-owned resources belong to exactly one store.
3. Store membership determines merchant access.
4. Products belong to one store.
5. Product variants belong to one product.
6. Inventory belongs to a purchasable variant.
7. Carts cannot contain arbitrary cross-store items.
8. Discounts belong to one store.
9. Checkouts belong to one store.
10. Payments belong to one store.
11. Orders belong to one store.
12. Order items preserve historical purchase information.
13. Order addresses are historical snapshots.
14. Payment attempts preserve individual processing attempts.
15. External identifiers remain separate from internal identifiers.
16. Entity ownership cannot be transferred implicitly by another module.
17. Critical state changes remain transactionally consistent.
18. Tenant boundaries are preserved across synchronous and asynchronous operations.

---

# 31. Implementation Boundary

This logical entity model should be converted into PostgreSQL tables only after:

- module ownership is confirmed
- relationship requirements are reviewed
- state machines are defined
- transaction boundaries are defined
- indexing requirements are identified
- migration strategy is established

The implementation should not introduce tables merely because a framework or ORM makes them convenient.

The database should represent the business model, not dictate it.