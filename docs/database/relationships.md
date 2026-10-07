# Database Relationships

## 1. Purpose

This document defines the relational structure between the core entities of the Demo commerce platform.

It establishes:

- Entity cardinality
- Foreign-key relationships
- Ownership relationships
- Tenant boundaries
- Required versus optional relationships
- Delete behavior
- Cross-module references
- Historical snapshot relationships
- Relationship invariants

This document complements:

- `docs/database/schema-overview.md`
- `docs/database/entity-model.md`
- `docs/database/data-ownership.md`
- `docs/domain/domain-boundaries.md`

It does not define ORM-specific syntax or migration files.

---

# 2. Relationship Principles

Database relationships must follow these principles:

1. Every relationship must have a clear business meaning.
2. Every entity has one authoritative owner.
3. Foreign keys enforce structural integrity.
4. Tenant boundaries must remain explicit.
5. Optional relationships must be genuinely optional.
6. Deletion behavior must be intentional.
7. Historical records must not depend on mutable records for correctness.
8. Cross-module references do not transfer ownership.
9. Critical relationships must be protected by database constraints where practical.
10. Relationship design must support transactional operations.
11. Database relationships must not bypass module boundaries.
12. Cascading deletion must never be used casually for financial or historical data.

---

# 3. Organization Relationships

## 3.1 Organization → OrganizationMembership

**Cardinality:**

```text
Organization 1 ──── N OrganizationMembership
```

An organization can have many memberships.

Each membership belongs to exactly one organization.

```text
organization_memberships.organization_id
    → organizations.id
```

### Rules

- Membership cannot exist without an organization.
- Deleting an organization must not silently destroy important historical business data.
- Membership status should be used to deactivate access where possible.
- Organization membership does not automatically grant access to every store unless authorization rules explicitly permit it.

---

# 4. Organization → Store

**Cardinality:**

```text
Organization 1 ──── N Store
```

An organization may own multiple stores.

Each store belongs to exactly one organization.

```text
stores.organization_id
    → organizations.id
```

### Rules

- A store cannot exist without an organization.
- A store cannot belong to multiple organizations simultaneously.
- Organization ownership must be enforced by the Stores module.
- Store-scoped business data inherits the store's organization relationship.

---

# 5. User → OrganizationMembership

**Cardinality:**

```text
User 1 ──── N OrganizationMembership
```

A user may belong to multiple organizations.

A membership belongs to exactly one user.

```text
organization_memberships.user_id
    → users.id
```

The relationship should prevent duplicate active memberships for the same user and organization.

---

# 6. User → StoreMembership

**Cardinality:**

```text
User 1 ──── N StoreMembership
```

A user may have memberships in multiple stores.

A store membership belongs to exactly one user and one store.

```text
store_memberships.user_id
    → users.id

store_memberships.store_id
    → stores.id
```

### Rules

A store membership should be unique for a given:

```text
(user_id, store_id)
```

A user's role may differ between stores.

Example:

```text
User A
 ├── Store X → Owner
 ├── Store Y → Admin
 └── Store Z → Staff
```

---

# 7. Store → StoreSettings

**Cardinality:**

```text
Store 1 ──── 1 StoreSettings
```

A store has at most one active settings record.

```text
store_settings.store_id
    → stores.id
```

### Rules

- Settings cannot exist without a store.
- A store should not accidentally have multiple active settings records.
- A unique constraint should enforce the one-to-one relationship where a separate settings table is used.

---

# 8. Store → Product

**Cardinality:**

```text
Store 1 ──── N Product
```

A store may have many products.

Each product belongs to exactly one store.

```text
products.store_id
    → stores.id
```

### Rules

- Products cannot cross stores.
- A product must not be reassigned between stores implicitly.
- Product deletion/archive behavior must preserve references required by historical orders.

---

# 9. Product → ProductVariant

**Cardinality:**

```text
Product 1 ──── N ProductVariant
```

A product may contain multiple variants.

Each variant belongs to exactly one product.

```text
product_variants.product_id
    → products.id
```

### Rules

- A variant cannot exist without a product.
- A variant inherits store ownership through its product.
- Variant SKU uniqueness must be scoped appropriately, normally to the store.
- A variant referenced by historical orders must not cause those orders to become invalid if the current variant is archived.

---

# 10. Product → ProductMedia

**Cardinality:**

```text
Product 1 ──── N ProductMedia
```

A product may have multiple media records.

Each media record belongs to one product.

```text
product_media.product_id
    → products.id
```

A media record may optionally reference a variant:

```text
product_media.variant_id
    → product_variants.id
```

### Rules

If `variant_id` is present, the variant must belong to the same product.

This cross-reference must not allow:

```text
Product A
    ↓
Media
    ↓
Variant belonging to Product B
```

The application and database design should prevent this inconsistency.

---

# 11. ProductVariant → InventoryItem

**Cardinality:**

```text
ProductVariant 1 ──── 0..1 InventoryItem
```

For the Demo inventory model, a purchasable variant may have one inventory record.

```text
inventory_items.variant_id
    → product_variants.id
```

A unique constraint should enforce one inventory record per applicable variant.

### Rules

- Inventory belongs to the Inventory module.
- Product data remains owned by Products.
- Inventory cannot reference a variant belonging to another store.
- The relationship must support concurrency-safe quantity updates.

---

# 12. InventoryItem → InventoryAdjustment

**Cardinality:**

```text
InventoryItem 1 ──── N InventoryAdjustment
```

An inventory item may have many adjustments.

Each adjustment belongs to one inventory item.

```text
inventory_adjustments.inventory_item_id
    → inventory_items.id
```

Adjustments should generally be append-oriented historical records.

They should not be rewritten merely because current inventory changes.

---

# 13. Store → Customer

**Cardinality:**

```text
Store 1 ──── N Customer
```

Each customer record belongs to exactly one store.

```text
customers.store_id
    → stores.id
```

A store can have many customers.

The same person may have separate customer records across stores if the product model treats customer relationships as store-specific.

---

# 14. User → Customer

**Cardinality:**

```text
User 1 ──── N Customer
```

This relationship is optional.

A customer may have an associated platform user account.

```text
customers.user_id
    → users.id
```

A guest customer may have:

```text
user_id = NULL
```

### Rules

A customer account must never automatically inherit merchant permissions.

Customer identity and merchant identity are separate authorization concepts.

---

# 15. Customer → CustomerAddress

**Cardinality:**

```text
Customer 1 ──── N CustomerAddress
```

A customer may store multiple addresses.

Each address belongs to one customer.

```text
customer_addresses.customer_id
    → customers.id
```

Addresses are mutable customer data.

They are not authoritative for historical orders.

---

# 16. Store → Cart

**Cardinality:**

```text
Store 1 ──── N Cart
```

Every cart belongs to exactly one store.

```text
carts.store_id
    → stores.id
```

This relationship is critical for tenant isolation.

A cart must never contain items belonging to another store.

---

# 17. Customer → Cart

**Cardinality:**

```text
Customer 1 ──── N Cart
```

This relationship is optional.

A registered customer may have carts associated with their account.

Anonymous carts may have no customer relationship.

```text
carts.customer_id
    → customers.id
```

### Rules

The application must ensure that:

```text
cart.customer.store_id
    =
cart.store_id
```

where a customer is associated with a cart.

---

# 18. Cart → CartItem

**Cardinality:**

```text
Cart 1 ──── N CartItem
```

Each cart item belongs to one cart.

```text
cart_items.cart_id
    → carts.id
```

A cart item references a product variant:

```text
cart_items.variant_id
    → product_variants.id
```

### Critical tenant invariant

The referenced variant must belong to the same store as the cart.

Conceptually:

```text
Cart.store_id
    =
ProductVariant.store_id
```

This must be enforced through application logic and, where practical, structural database constraints.

---

# 19. ProductVariant → CartItem

**Cardinality:**

```text
ProductVariant 1 ──── N CartItem
```

A product variant may appear in many carts.

Each cart item references one variant.

The same variant may appear in multiple customers' carts simultaneously.

This is expected behavior.

---

# 20. Store → Discount

**Cardinality:**

```text
Store 1 ──── N Discount
```

Each discount belongs to one store.

```text
discounts.store_id
    → stores.id
```

Discount rules must never cross store boundaries.

---

# 21. Discount → DiscountCode

**Cardinality:**

```text
Discount 1 ──── N DiscountCode
```

A discount may have one or more redemption codes.

Each code belongs to one discount.

```text
discount_codes.discount_id
    → discounts.id
```

Codes should be unique within their store scope.

---

# 22. Discount → DiscountUsage

**Cardinality:**

```text
Discount 1 ──── N DiscountUsage
```

A discount may have multiple usage records.

Each usage record references one discount.

```text
discount_usages.discount_id
    → discounts.id
```

A usage may optionally reference:

- customer
- order
- checkout

depending on the final business model.

Usage-limit enforcement must be concurrency-safe.

---

# 23. Customer → DiscountUsage

**Cardinality:**

```text
Customer 1 ──── N DiscountUsage
```

Optional.

Used when a discount has per-customer restrictions.

The usage record must belong to the same store as the customer.

---

# 24. Store → Checkout

**Cardinality:**

```text
Store 1 ──── N Checkout
```

Each checkout belongs to one store.

```text
checkouts.store_id
    → stores.id
```

Checkout is store-scoped even when it originated from a cart.

---

# 25. Cart → Checkout

**Cardinality:**

```text
Cart 1 ──── N Checkout
```

A cart may participate in multiple checkout attempts or checkout records depending on lifecycle design.

However, the business workflow must prevent multiple successful orders from being created from the same logical purchase operation.

The implementation should distinguish:

- checkout attempts
- completed checkout
- abandoned checkout

rather than assuming every checkout record becomes an order.

---

# 26. Customer → Checkout

**Cardinality:**

```text
Customer 1 ──── N Checkout
```

Optional.

Guest checkout may have no customer relationship.

Where present:

```text
checkout.customer_id
    → customers.id
```

The customer must belong to the same store.

---

# 27. Checkout → CheckoutItem

**Cardinality:**

```text
Checkout 1 ──── N CheckoutItem
```

Each checkout item belongs to one checkout.

```text
checkout_items.checkout_id
    → checkouts.id
```

Each checkout item references a product variant.

Checkout item pricing represents the values used for the checkout calculation and must not blindly depend on later catalog changes.

---

# 28. Store → Payment

**Cardinality:**

```text
Store 1 ──── N Payment
```

Each payment belongs to one store.

```text
payments.store_id
    → stores.id
```

This provides explicit tenant scope even if payment is also linked to checkout and order.

---

# 29. Checkout → Payment

**Cardinality:**

```text
Checkout 1 ──── N Payment
```

A checkout may have multiple payment records or attempts depending on the payment lifecycle model.

The business rules must determine which payment is considered the active/authoritative payment for the checkout.

---

# 30. Payment → PaymentAttempt

**Cardinality:**

```text
Payment 1 ──── N PaymentAttempt
```

Each payment attempt belongs to exactly one payment.

```text
payment_attempts.payment_id
    → payments.id
```

Attempts are historical operational records.

A failed attempt should not be overwritten by a later successful attempt.

---

# 31. Store → Order

**Cardinality:**

```text
Store 1 ──── N Order
```

Every order belongs to exactly one store.

```text
orders.store_id
    → stores.id
```

This is one of the most important tenant relationships in the platform.

---

# 32. Customer → Order

**Cardinality:**

```text
Customer 1 ──── N Order
```

An order may optionally reference a customer depending on guest checkout support.

```text
orders.customer_id
    → customers.id
```

Where present:

```text
order.customer.store_id
    =
order.store_id
```

Customer deletion must not invalidate historical order records.

Historical customer information needed for the order should be preserved within the order where appropriate.

---

# 33. Order → OrderItem

**Cardinality:**

```text
Order 1 ──── N OrderItem
```

Every order must contain one or more order items for a normal completed purchase.

```text
order_items.order_id
    → orders.id
```

Order items contain historical snapshots.

They must not depend exclusively on the current Product or ProductVariant records.

---

# 34. ProductVariant → OrderItem

**Cardinality:**

```text
ProductVariant 1 ──── N OrderItem
```

An order item may retain a reference to the original product variant.

However, this relationship is informational.

Historical order fields remain authoritative.

If a product variant is archived or its current price changes, historical order information must remain unchanged.

---

# 35. Order → OrderAddress

**Cardinality:**

```text
Order 1 ──── N OrderAddress
```

Normally an order has:

- one billing address
- zero or one shipping address depending on the Demo shipping model

A type field may distinguish:

```text
BILLING
SHIPPING
```

The address is a snapshot.

---

# 36. Order → OrderStatusHistory

**Cardinality:**

```text
Order 1 ──── N OrderStatusHistory
```

Every meaningful order transition may create a history record.

```text
order_status_history.order_id
    → orders.id
```

History records should be append-oriented.

The current order status remains on the Order entity for efficient current-state queries.

---

# 37. Payment → Order

**Cardinality:**

```text
Payment 0..N ──── 0..1 Order
```

The exact relationship depends on payment workflow.

A payment may be associated with an order after order creation.

A checkout payment may exist before the final order exists.

The model must therefore avoid requiring an Order before payment processing can begin.

Once an order is created, the payment relationship should be established consistently.

---

# 38. Order → Payment

The inverse relationship is:

```text
Order 1 ──── N Payment
```

Multiple payment records may be required for:

- retries
- partial payment
- refunds represented separately
- payment reconciliation

However, Demo should avoid introducing complex split-payment behavior unless explicitly required.

The common case remains:

```text
Order
  ↓
Payment
```

with additional attempts beneath Payment.

---

# 39. Inventory → Order

Inventory does not own an order relationship.

An inventory operation may reference an order through an operational reference:

```text
InventoryAdjustment.reference_type
InventoryAdjustment.reference_id
```

This allows the Inventory module to record why stock changed without making Orders part of Inventory's ownership model.

---

# 40. Discount → Order

A completed order may preserve the discount information applied to it.

The order should not depend on the current Discount record to calculate historical totals.

The relationship can be represented through:

- discount reference
- historical discount snapshot
- order-level discount fields

The historical order values remain authoritative.

---

# 41. Cross-Store Relationship Rule

The following relationships must never cross stores:

```text
Cart → ProductVariant
Checkout → ProductVariant
Order → Customer
Order → ProductVariant reference
Payment → Checkout
DiscountUsage → Customer
InventoryItem → ProductVariant
```

For any such relationship:

```text
ReferencedResource.store_id
    =
OwningResource.store_id
```

unless the relationship is explicitly platform-level.

---

# 42. Organization-to-Store Inheritance

A store belongs to an organization.

Most commerce entities do not need a separate `organization_id` if their store relationship already establishes organization ownership.

For example:

```text
Order
    → Store
        → Organization
```

This avoids redundant ownership fields.

However, denormalized organization identifiers may only be introduced if a measured access pattern justifies them and consistency can be guaranteed.

---

# 43. Delete Behavior

Delete behavior should generally follow these principles:

### Safe cascading

May be appropriate for tightly owned temporary records such as:

```text
Cart
    → CartItem
```

or:

```text
Product
    → ProductMedia
```

when no historical dependency exists.

### Restricted deletion

Should be used for important business records such as:

```text
Order
Payment
InventoryAdjustment
OrderStatusHistory
```

These should not disappear because a parent record was deleted.

### Archive/deactivate

Preferred for entities whose historical references must remain valid:

```text
Product
ProductVariant
Store
Discount
Customer
```

---

# 44. Historical Relationship Strategy

Historical records should preserve business meaning even if their source entity changes.

Example:

```text
Product
   ↓
OrderItem
```

The OrderItem stores:

```text
product_name
variant_name
sku
unit_price
```

Therefore:

```text
Product deleted/archived
        ↓
Order remains valid
```

This is intentional denormalization for historical correctness.

---

# 45. Relationship Constraints

Important relationships should have structural constraints where possible.

Examples:

```text
store_memberships
UNIQUE(user_id, store_id)

discount_codes
UNIQUE(store_id, code)

product_variants
UNIQUE(store_id, sku)

inventory_items
UNIQUE(variant_id)
```

The exact constraints depend on final business requirements.

Application checks alone should not be used where a database constraint can reliably enforce an invariant.

---

# 46. Cross-Module Relationship Ownership

A relationship does not change ownership.

Example:

```text
Orders
    references Customer
```

does not mean Orders owns Customers.

Likewise:

```text
Inventory
    references ProductVariant
```

does not mean Inventory owns ProductVariants.

Ownership remains:

```text
Customers → Customer
Products → ProductVariant
Inventory → InventoryItem
Orders → Order
```

---

# 47. Relationship Access Rules

When a module needs information from another module, it should use an appropriate public interface.

Examples:

```text
Checkout
    → Products public query
    → Inventory public service
    → Discounts public service
    → Payments public service
    → Orders public service
```

The Checkout module must not query another module's private repository implementation simply because PostgreSQL happens to be shared.

---

# 48. Relationship and Authorization

A valid foreign-key relationship does not imply authorization.

For example:

```text
orders.customer_id = customer.id
```

does not mean every authenticated user may read that order.

Authorization must separately establish:

- authenticated identity
- store membership where applicable
- customer ownership
- merchant role
- resource ownership

Database relationships provide integrity.

Application authorization provides access control.

---

# 49. Relationship Invariants

The database and application must preserve these invariants:

1. A store belongs to exactly one organization.
2. A store membership belongs to exactly one user and store.
3. A product belongs to exactly one store.
4. A product variant belongs to exactly one product.
5. Inventory belongs to a valid product variant.
6. A customer belongs to exactly one store.
7. A cart belongs to exactly one store.
8. Cart items reference variants from the same store.
9. Discounts belong to exactly one store.
10. Checkout belongs to exactly one store.
11. Checkout items reference variants from the same store.
12. Payments belong to exactly one store.
13. Orders belong to exactly one store.
14. Customer/order relationships cannot cross stores.
15. Order items preserve historical purchase information.
16. Order addresses are independent historical snapshots.
17. Payment attempts belong to exactly one payment.
18. Historical records cannot be invalidated by ordinary catalog changes.
19. Foreign keys cannot be bypassed through application-level assumptions.
20. Cross-module relationships never transfer entity ownership.

---

# 50. Final Relationship Model

The essential relational structure is:

```text
Organization
│
├── OrganizationMembership ── User
│
└── Store
    │
    ├── StoreMembership ───── User
    ├── StoreSettings
    │
    ├── Product
    │   ├── ProductVariant
    │   │   └── InventoryItem
    │   │       └── InventoryAdjustment
    │   └── ProductMedia
    │
    ├── Customer
    │   └── CustomerAddress
    │
    ├── Cart
    │   └── CartItem ───── ProductVariant
    │
    ├── Discount
    │   ├── DiscountCode
    │   └── DiscountUsage
    │
    ├── Checkout
    │   └── CheckoutItem ── ProductVariant
    │
    ├── Payment
    │   └── PaymentAttempt
    │
    └── Order
        ├── OrderItem ───── ProductVariant
        ├── OrderAddress
        └── OrderStatusHistory
```

This relationship model provides the foundation for the next database concerns:

- Indexing
- Transaction boundaries
- Concurrency control
- Migration strategy

The next document is **`docs/database/indexing-strategy.md`**.