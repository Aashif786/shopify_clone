# Products Implementation

## 1. Purpose

This document defines the concrete implementation of the Product domain for the Demo.

The Product domain owns the merchant's catalog and provides the product information required by:

- Merchant catalog management.
- Storefront product browsing.
- Cart item selection.
- Checkout pricing inputs.
- Inventory association.
- Product media association.

The Product domain does **not** own inventory quantities, customer data, cart state, payment state, or order lifecycle.

---

# 2. Domain Ownership

Product implementation belongs to:

```text id="p8c4m7"
modules/products
```

The module owns:

- Products.
- Variants.
- Product metadata.
- Product lifecycle.
- Publication state.
- Product identifiers.
- Variant pricing.
- SKU association.
- Catalog queries.
- Product-media relationships.

---

# 3. Product Dependencies

The Product module may depend on shared infrastructure:

```text id="v7m3c8"
packages/db
packages/types
packages/validation
packages/tenant
```

It may communicate with other domains through their public interfaces or domain events.

It must not directly access:

```text id="x5m8c4"
Inventory internal tables
Cart internal tables
Order internal tables
Payment internal tables
Customer internal tables
```

---

# 4. Product Model

A Product should contain information such as:

```text id="m8c4x7"
id
store_id
title
description
slug
status
created_at
updated_at
```

Variant-level information should be stored separately where appropriate.

---

# 5. Product Ownership

Every Product belongs to exactly one Store.

Conceptually:

```text id="q7m4c8"
Organization
    ↓
Store
    ↓
Product
```

The Product module must never create an orphan Product.

---

# 6. Product Status

The Product lifecycle should use explicit states.

Example:

```text id="v4m8c7"
Draft
Active
Archived
```

The exact state set must follow the Product specification.

Do not use arbitrary strings for lifecycle state.

---

# 7. Product Lifecycle

Valid transitions should be enforced explicitly.

For example:

```text id="x8c4m7"
Draft → Active
Active → Archived
Archived → Active
```

Invalid transitions must fail through a domain/application error.

---

# 8. Product Creation

The creation flow should be:

```text id="m5c8x7"
Authenticated Merchant
      ↓
Store Context
      ↓
Validate Input
      ↓
Create Product
      ↓
Create Variants if supplied
      ↓
Commit
      ↓
Return Product DTO
```

The operation must be scoped to the current Store.

---

# 9. Product Title

Product titles must be validated for:

- Required value.
- Maximum length.
- Whitespace handling.
- Appropriate input encoding.

The exact limits should follow the Product specification.

---

# 10. Product Description

Descriptions may contain formatted or plain content according to the Demo product requirements.

If rich HTML is supported, content must be sanitized before rendering.

Never render untrusted HTML directly.

---

# 11. Product Slug

Product slugs should be:

- URL-safe.
- Normalized.
- Unique within the Store.
- Validated for length.
- Stable enough for Storefront URLs.

Database constraints must enforce final uniqueness.

Example:

```text id="q8m3c7"
UNIQUE (store_id, slug)
```

---

# 12. Variant Model

Products may have one or more variants.

A Variant may contain:

```text id="v7c4m8"
id
product_id
sku
title
price
currency
status
created_at
updated_at
```

Exact fields follow the product schema.

---

# 13. Product and Variant Responsibility

Product owns:

```text id="x4m8c7"
Product identity
Product metadata
Variant identity
Variant pricing
Variant status
Catalog relationships
```

Inventory owns:

```text id="m8c4x7"
Stock quantity
Available quantity
Reserved quantity
Inventory adjustments
Reservations
```

Do not duplicate inventory quantities inside Product records.

---

# 14. SKU

SKU values should be validated.

If SKU uniqueness is Store-scoped, enforce it at the database level:

```text id="q5m8c4"
UNIQUE (store_id, sku)
```

Application checks may provide better error messages but do not replace the database constraint.

---

# 15. Pricing

Product variants may own their current catalog price.

Money must use the project's exact monetary representation.

Never use JavaScript floating-point numbers for authoritative monetary calculations.

For example, avoid:

```text id="v8m3c7"
price = 19.99
```

as the authoritative monetary representation.

---

# 16. Currency

The Product implementation must use the Store's configured currency unless the product specification explicitly supports another model.

Currency must be explicit rather than inferred from formatting.

---

# 17. Price Changes

Changing a product price should affect future commerce operations according to the pricing rules.

Historical Orders must never be rewritten because the current Product price changed.

Orders should retain their own historical price snapshots.

---

# 18. Product Publication

A Product should be publicly visible only when:

```text id="x7m4c8"
Product is publishable
+
Store is active
+
Required Product data is valid
```

The exact publication rules belong to the Product and Storefront specifications.

---

# 19. Storefront Visibility

Storefront queries should return only products that are eligible for public display.

Do not expose:

- Draft products.
- Archived products.
- Private metadata.
- Internal operational fields.

---

# 20. Product Repository

The Product repository should provide focused operations such as:

```text id="m4c8x7"
create
findById
findBySlug
list
update
changeStatus
```

Methods operating on Store-owned resources should require appropriate Store scope.

---

# 21. Catalog Queries

Catalog queries should support the requirements of Demo Storefront functionality.

Typical operations:

```text id="q8m3c7"
List published products
Get published product by slug
Get product by ID for merchant
List merchant products
```

The implementation should use PostgreSQL queries and indexes rather than introducing a dedicated search engine.

---

# 22. Product Listing

Merchant listing may support:

- Pagination.
- Status filtering.
- Sorting.
- Basic text filtering if required.

The API layer validates query parameters.

The repository maps validated query parameters into safe database queries.

---

# 23. Product Search

Demo does not require a dedicated search engine.

Basic catalog search may use PostgreSQL capabilities if needed.

The search implementation must remain:

```text id="v5m8c4"
Store-scoped
Bounded
Indexed where appropriate
Simple
```

A search engine can be introduced later without changing the Product domain contract.

---

# 24. Product Media

Products may reference Media records.

The Product module owns the relationship between a Product/Variant and its associated media where required.

Binary objects remain owned by the Media infrastructure.

---

# 25. Media Ordering

If multiple media assets are supported, the Product module may maintain an explicit display order.

The ordering must be deterministic.

---

# 26. Product Creation with Variants

If a Product and its initial Variants are created together, the operation should be transactional.

Example:

```text id="x8c4m7"
BEGIN
  Create Product
  Create Variant 1
  Create Variant 2
COMMIT
```

If a required Variant operation fails, the Product creation should fail atomically.

---

# 27. Product Updates

Updates should explicitly define which fields are mutable.

Typical mutable fields:

```text id="m7c4x8"
Title
Description
Slug
Status
Variant metadata
Variant price
```

Historical commerce records must not be modified.

---

# 28. Product Deletion

Physical deletion should be used carefully.

If a Product has commerce history, prefer archival or inactive status.

Orders must retain their historical Product information independently of current catalog state.

---

# 29. Inventory Integration

Product should expose the Variant identity required by Inventory.

Inventory should own the stock state.

The Product module must not directly mutate inventory quantities.

Correct interaction:

```text id="q5m8c4"
Product
   ↓
Variant ID
   ↓
Inventory Application Interface
```

---

# 30. Cart Integration

Carts may reference Product Variant IDs.

When a cart item is added:

```text id="v8m3c7"
Cart
  ↓
Variant ID
  ↓
Product availability/validation
```

The Cart module owns cart state.

Product remains the catalog authority.

---

# 31. Checkout Integration

Checkout should resolve product information through Product's public interfaces.

However, Checkout must recalculate authoritative prices according to its own transaction rules rather than trusting stale client values.

---

# 32. Order Integration

When an Order is created, it should snapshot required product information.

For example:

```text id="x4m8c7"
Product title
Variant title
SKU
Unit price
Quantity
```

This protects historical Order data from future catalog changes.

---

# 33. Product Events

Useful Product events may include:

```text id="m8c4x7"
ProductCreated
ProductUpdated
ProductPublished
ProductArchived
VariantCreated
VariantUpdated
```

Events represent completed facts.

They should not be used as an alternative to synchronous operations when immediate consistency is required.

---

# 34. Product API

Typical merchant endpoints:

```text id="q7m3c8"
POST   /api/v1/products
GET    /api/v1/products
GET    /api/v1/products/:id
PATCH  /api/v1/products/:id
DELETE /api/v1/products/:id
```

Variant endpoints may follow:

```text id="v5c8m4"
POST  /api/v1/products/:id/variants
PATCH /api/v1/products/:id/variants/:variantId
```

Exact endpoint structure must remain consistent with the API contract.

---

# 35. Product DTOs

Use explicit DTOs such as:

```text id="x8m4c7"
ProductSummary
ProductDetail
ProductVariant
CreateProductInput
UpdateProductInput
```

Do not return database records directly.

---

# 36. Authorization

Every merchant Product operation requires:

```text id="m7c4x8"
Authenticated User
+
Store Context
+
Required Permission
```

A Product ID does not establish access.

---

# 37. Tenant Isolation

All Product queries and mutations must be Store-scoped.

Examples:

```text id="q8m3c7"
Get Product
Update Product
Delete Product
Create Variant
Update Variant
List Products
```

must operate within the resolved Store context.

---

# 38. Concurrency

Concurrent Product updates must not silently overwrite important changes.

Where necessary, use:

- Transactional updates.
- Optimistic concurrency.
- Row locking.

The simplest safe strategy should be selected based on actual Product requirements.

---

# 39. Database Constraints

The database should enforce appropriate constraints:

```text id="v4m8c7"
product.store_id NOT NULL
variant.product_id NOT NULL
required foreign keys
valid status values
unique store-scoped slug
unique store-scoped SKU where required
valid monetary representation
```

---

# 40. Product Tests

Unit tests should cover:

```text id="x7c4m8"
[ ] Product creation
[ ] Invalid product data
[ ] Product lifecycle
[ ] Variant creation
[ ] Variant validation
[ ] Slug rules
[ ] SKU rules
[ ] Price validation
[ ] Publication rules
```

---

# 41. Integration Tests

Integration tests should verify:

```text id="m8c4x7"
[ ] Product persistence
[ ] Variant persistence
[ ] Store scoping
[ ] Unique constraints
[ ] Product/variant relationships
[ ] Product-media relationship
[ ] Transactional creation
```

---

# 42. API Tests

Test:

```text id="q5m8c4"
[ ] Create Product
[ ] List Products
[ ] Get Product
[ ] Update Product
[ ] Archive Product
[ ] Create Variant
[ ] Update Variant
[ ] Invalid input
[ ] Unauthorized access
[ ] Cross-tenant access
[ ] Duplicate slug
[ ] Duplicate SKU
```

---

# 43. Storefront Tests

Verify that:

```text id="v8m3c7"
Draft Product → Not publicly visible
Archived Product → Not publicly visible
Active Product → Publicly visible when Store is active
Inactive Store → Product not publicly exposed
```

---

# 44. Product Implementation Sequence

Implement in this order:

```text id="x4m8c7"
1. Define Product and Variant schema
2. Create migrations
3. Implement Product repository
4. Implement Variant repository
5. Implement Product domain model
6. Implement lifecycle rules
7. Implement pricing/value objects
8. Implement Product application services
9. Implement Product DTOs
10. Implement merchant API
11. Implement publication rules
12. Integrate Product media
13. Expose Storefront catalog interface
14. Publish Product events
15. Add unit tests
16. Add integration tests
17. Add API tests
18. Add Storefront visibility tests
19. Verify tenant isolation
```

---

# 45. Definition of Done

Product implementation is complete when:

```text id="m7c4x8"
[ ] Product schema exists
[ ] Variant schema exists
[ ] Migrations are version-controlled
[ ] Product repository exists
[ ] Variant repository exists
[ ] Product lifecycle is enforced
[ ] Pricing uses exact monetary representation
[ ] Slugs are Store-scoped
[ ] SKUs are validated and uniquely constrained where required
[ ] Product publication works
[ ] Product APIs work
[ ] Tenant isolation works
[ ] Product media relationships work
[ ] Storefront catalog works
[ ] Historical Order data can remain independent of catalog changes
[ ] Unit tests pass
[ ] Integration tests pass
[ ] API tests pass
[ ] Storefront visibility tests pass
```

The Product domain should remain the **catalog authority**, not the place where every other commerce concern quietly goes to die. Inventory, carts, checkout, and orders consume Product capabilities while retaining ownership of their own state and business rules.