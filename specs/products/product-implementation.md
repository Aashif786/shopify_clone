# Product Implementation Specification

## 1. Purpose

This document defines the implementation requirements for the **Products** domain of the Cal Cart commerce platform.

The Products module is responsible for merchant-managed product catalog data, variants, pricing information, publication state, product media relationships, and product lifecycle behavior.

The module provides the catalog foundation consumed by storefront, cart, checkout, inventory, discounts, and order workflows.

---

## 2. Scope

The Products module owns:

- Products.
- Product variants.
- Product titles and descriptions.
- Product status.
- Product slugs.
- SKU references.
- Product pricing data.
- Product publication state.
- Product-to-media relationships.
- Product attributes required by the Demo.
- Product catalog queries.

The module does not own:

- Inventory quantities.
- Inventory reservations.
- Orders.
- Carts.
- Checkout.
- Payments.
- Customers.
- Discount eligibility calculations.

Those responsibilities belong to their respective modules.

---

## 3. Domain Position

The primary relationship is:

```text id="8d7x1p"
Organization
    ↓
Store
    ↓
Product
    ↓
Variant
    ↓
Inventory
```

A Product belongs to exactly one Store.

A Variant belongs to exactly one Product.

Inventory belongs to the appropriate inventory domain and references the relevant product/variant identity.

---

## 4. Module Location

The implementation belongs under:

```text id="c6v1n8"
modules/products/
```

Recommended structure:

```text id="q4m8s2"
modules/products/
├── application/
├── domain/
├── infrastructure/
└── index.ts
```

The exact internal structure may evolve, but public module boundaries must remain stable.

---

## 5. Layer Responsibilities

### Presentation

Responsible for:

- Authentication.
- Tenant resolution.
- Authorization.
- Request validation.
- DTO mapping.
- HTTP response handling.

### Application

Responsible for:

- Product use cases.
- Variant operations.
- Transaction boundaries.
- Repository coordination.
- Domain event publication.

### Domain

Responsible for:

- Product entity.
- Variant entity.
- Product lifecycle.
- Variant invariants.
- Pricing rules owned by Products.
- Publication rules.

### Infrastructure

Responsible for:

- PostgreSQL persistence.
- Repository implementation.
- Query implementation.
- Media relationship persistence.

---

## 6. Product Entity

A Product represents a merchant-facing catalog item.

Conceptually:

```text id="n6c2p8"
Product
├── id
├── storeId
├── title
├── description
├── slug
├── status
├── publishedAt
├── createdAt
└── updatedAt
```

The exact persistence model may contain additional fields.

---

## 7. Variant Entity

A Product may contain one or more variants.

Conceptually:

```text id="m4r8x2"
Product
  ├── Variant
  ├── Variant
  └── Variant
```

A variant represents a purchasable configuration of a Product.

Examples:

```text id="p9v2d7"
T-Shirt
├── Small / Black
├── Medium / Black
└── Large / Black
```

---

## 8. Product vs Variant Responsibility

Product-level information generally includes:

- Product title.
- Description.
- Product-level media.
- General catalog information.

Variant-level information may include:

- SKU.
- Price.
- Variant attributes.
- Inventory identity.
- Variant-specific media where supported.

The exact ownership must remain consistent across the domain model.

---

## 9. Product Identity

Every Product must have a stable internal identifier.

The ID:

- Is generated server-side.
- Is not client-controlled.
- Is immutable.
- Is used for internal references.

Public URLs may use the Product slug.

---

## 10. Product Slug

The Product slug is a URL-friendly identifier.

Example:

```text id="h6n3k9"
classic-black-tshirt
```

Requirements:

- Normalized.
- URL-safe.
- Length-limited.
- Validated.
- Unique within the Store where required.

The database should enforce the required uniqueness constraint.

---

## 11. Product Title

Product title is required for normal catalog usage.

It should:

- Have a defined maximum length.
- Reject invalid empty values.
- Support Unicode.
- Be stored as normal text.

The title is display data and must not be treated as a unique identifier.

---

## 12. Product Description

Description is merchant-controlled catalog content.

The system must define whether the Demo supports:

- Plain text.
- Sanitized rich text.

If HTML/rich text is supported, sanitization must occur before rendering.

Untrusted HTML must never be rendered directly.

---

## 13. Product Status

The Product lifecycle should use explicit states.

A practical Demo model is:

```text id="c9v5x1"
DRAFT
ACTIVE
ARCHIVED
```

---

## 14. Product State Transitions

Example:

```text id="r4t8m6"
DRAFT
  │
  ├──→ ACTIVE
  │
  └──→ ARCHIVED

ACTIVE
  │
  ├──→ DRAFT
  │
  └──→ ARCHIVED

ARCHIVED
  │
  └──→ DRAFT
```

The exact allowed transitions must be implemented explicitly.

---

## 15. Draft Products

Draft products are visible to authorized merchants but should not normally appear in the public storefront.

Draft products may be edited freely within the supported product rules.

They should not be purchasable.

---

## 16. Active Products

An active Product is eligible for public storefront visibility if:

- Its Store is publicly available.
- The Product satisfies publication requirements.
- It has at least one valid purchasable variant where required.
- Required catalog data is present.

---

## 17. Archived Products

Archived products should normally disappear from public storefront listings.

Historical orders referencing an archived Product must remain valid.

Archiving must not delete:

- Order references.
- Historical prices.
- Inventory history.
- Product identifiers required for auditing.

---

## 18. Product Publication

Publishing a Product is a business operation.

Before publication, validate:

```text id="5x8c1v"
Required catalog information
+
Valid Product state
+
Valid variant configuration
+
Required pricing
+
Store availability
```

The exact publication requirements should remain explicit.

---

## 19. Variant Creation

A Product may create one or more variants.

Variant creation must validate:

- Product ownership.
- Variant attributes.
- SKU where required.
- Price.
- Currency relationship.
- Required inventory configuration.

---

## 20. Default Variant

If the Demo supports products without explicit variant options, a default variant may be created automatically.

For example:

```text id="x2c7m4"
Product
   ↓
Default Variant
```

This allows a simple Product to remain purchasable without requiring merchants to manually construct variant structures.

The implementation must avoid creating duplicate default variants.

---

## 21. SKU

SKU is a merchant-facing inventory/catalog identifier.

SKU requirements should include:

- Length limit.
- Normalization rules.
- Store-scoped uniqueness where required.

A SKU should not be assumed to be globally unique across the entire platform.

---

## 22. Variant Price

Variant pricing must use exact monetary representation.

Valid implementations include:

- Integer minor units.
- Exact decimal/numeric representation.

Floating-point values must not be used for authoritative monetary calculations.

---

## 23. Currency

Variant prices must have an unambiguous currency relationship.

For the Demo, Store-level default currency may be used where the product model does not yet support multiple currencies.

Historical order prices must be snapshotted when orders are created.

---

## 24. Price Validation

Price validation must reject:

- Invalid numeric values.
- Negative values where unsupported.
- Excessive precision.
- Unsupported currencies.

The exact minimum/maximum constraints should follow the platform's monetary model.

---

## 25. Product Media

Products may reference media assets.

The Products module should store the relationship between the Product/Variant and media records.

The Media module owns the actual media lifecycle and storage.

Conceptually:

```text id="m7q2p9"
Product
   ↓
Media Reference
   ↓
Object Storage
```

Products should not directly manage object-storage credentials or storage internals.

---

## 26. Product Media Ordering

If multiple media assets are supported, the relationship should provide an explicit ordering mechanism.

For example:

```text id="c8r5w1"
Media A → position 0
Media B → position 1
Media C → position 2
```

Ordering must be deterministic.

---

## 27. Product Queries

The Products module should provide query operations for:

- Merchant product management.
- Product detail.
- Storefront product listing.
- Storefront product detail.
- Variant retrieval.

Queries must respect Store boundaries.

---

## 28. Storefront Queries

Public product queries must return only products eligible for public display.

Conceptually:

```text id="h5k1v7"
Store available
    +
Product ACTIVE
    +
Publication requirements satisfied
    ↓
Public product
```

Draft and archived products must not accidentally appear.

---

## 29. Tenant Isolation

Every product query must be scoped to the correct Store.

Example:

```text id="s7n4x2"
Store A
  ↓
Product query
  ↓
Store A products only
```

A Product ID or slug must never be treated as sufficient authorization.

---

## 30. Product Creation

Product creation should follow:

```text id="w6q3p8"
Authorized merchant
      ↓
Resolve Store
      ↓
Validate product data
      ↓
Create Product
      ↓
Create required/default Variant
      ↓
Commit
```

The operation must not create a Product under an unauthorized Store.

---

## 31. Product Update

Product updates should:

1. Resolve Store.
2. Resolve Product.
3. Verify ownership.
4. Verify authorization.
5. Validate fields.
6. Apply domain rules.
7. Persist changes.
8. Return an explicit DTO.

---

## 32. Variant Update

Variant updates must verify:

- Variant belongs to the Product.
- Product belongs to the authorized Store.
- Caller has appropriate permissions.

A client must not be able to update a variant by guessing its identifier.

---

## 33. Variant Deletion

Deleting a variant requires domain validation.

The system must consider:

- Existing orders.
- Inventory.
- Cart items.
- Checkout items.
- Active storefront state.

A variant referenced by historical business records should generally be archived/deactivated rather than physically deleted.

---

## 34. Product Deletion

Physical Product deletion should not be the default operation.

Historical order data must remain valid.

Prefer:

```text id="d8r3m1"
Product
   ↓
ARCHIVED
```

over destructive deletion.

---

## 35. Cart Interaction

The Products module provides product/variant information to the Carts module.

Cart logic should not directly manipulate internal Product tables.

The interaction should use a public product interface.

---

## 36. Checkout Interaction

Checkout requires authoritative product/variant information such as:

- Current purchasability.
- Variant identity.
- Price.
- Currency.
- Product availability state.

Checkout must not trust stale client-provided product pricing.

---

## 37. Order Interaction

When an order is created, the Orders module must preserve historical product information required for the order.

The Products module remains the source of current catalog data.

Historical order data must not depend on future Product mutations.

---

## 38. Inventory Interaction

Products define the catalog/variant identity.

Inventory owns stock state.

The boundary is:

```text id="x9f4v2"
Products
   ↓
Variant identity
   ↓
Inventory
   ↓
Quantity / reservation
```

Products must not maintain authoritative stock quantities.

---

## 39. Discount Interaction

Discounts may target:

- Products.
- Variants.
- Collections/categories if later introduced.

The Discounts module owns eligibility logic.

Products should expose the product information required by the discount system through stable interfaces.

---

## 40. Product Events

The Products module may publish events such as:

```text id="e2k7p4"
ProductCreated
ProductUpdated
ProductPublished
ProductArchived
VariantCreated
VariantUpdated
VariantArchived
```

Events represent completed facts.

---

## 41. Event Consumers

Potential consumers include:

- Storefront indexing/cache invalidation.
- Search infrastructure in future V1.
- Notifications.
- Analytics in future V1.
- Media processing.

The Demo should not introduce consumers that have no actual requirement.

---

## 42. API Endpoints

The Products API may include:

```text id="k7m2s5"
POST   /api/v1/products
GET    /api/v1/products
GET    /api/v1/products/{productId}
PATCH  /api/v1/products/{productId}
POST   /api/v1/products/{productId}/publish
POST   /api/v1/products/{productId}/archive

POST   /api/v1/products/{productId}/variants
PATCH  /api/v1/products/{productId}/variants/{variantId}
POST   /api/v1/products/{productId}/variants/{variantId}/archive
```

The final routes must follow the API contract and actual application implementation.

---

## 43. Product Listing

Merchant product listings should support bounded:

- Pagination.
- Status filtering.
- Search/filtering where implemented.
- Deterministic ordering.

Public storefront listings must apply publication visibility rules.

---

## 44. Pagination

Product collections must never return unbounded records.

The API should use:

- Cursor pagination where appropriate.
- Bounded limits.
- Stable ordering.
- Store-scoped queries.

---

## 45. Validation

Product input must be validated at the API boundary.

Examples:

```text id="q1w8e4"
title
description
slug
status
SKU
price
currency
variant attributes
media references
```

Validation must be followed by domain/business validation.

---

## 46. Error Handling

Stable error codes should be used.

Examples:

```text id="z7c3p6"
PRODUCT_NOT_FOUND
PRODUCT_ACCESS_DENIED
INVALID_PRODUCT_STATE
PRODUCT_NOT_PUBLISHABLE
PRODUCT_SLUG_CONFLICT
VARIANT_NOT_FOUND
VARIANT_ACCESS_DENIED
SKU_CONFLICT
INVALID_PRICE
```

Internal database errors must not be exposed directly.

---

## 47. Authorization

Product operations should distinguish permissions such as:

```text id="r2m8k4"
products.read
products.create
products.update
products.publish
products.archive
products.manage_variants
```

The exact permission model follows the authorization specification.

Authorization must be enforced server-side.

---

## 48. Concurrency

Product operations that can conflict should account for concurrent updates.

Examples:

- Two users editing the same Product.
- Two users changing publication state.
- Concurrent variant creation with the same SKU.

Database uniqueness constraints must provide final protection for conflicts such as duplicate SKU.

---

## 49. Idempotency

Idempotency may be required for Product mutations when clients can safely retry requests.

Operations with naturally repeatable semantics may not require an explicit idempotency key.

Operations producing significant side effects should follow the global idempotency strategy.

---

## 50. Transactions

Transactions should be used when multiple Product-owned records must change atomically.

Examples:

```text id="h7q2n5"
Create Product
+
Create default Variant
+
Create media relationships
```

The transaction must remain short.

---

## 51. Database Requirements

The Product persistence model should include appropriate:

- Primary keys.
- Store foreign keys.
- Product/variant relationships.
- Unique constraints.
- Status representation.
- Monetary fields.
- Timestamps.
- Indexes.

Likely uniqueness requirements include:

```text id="u5m9x1"
(store_id, slug)
(store_id, sku)
```

where applicable.

---

## 52. Indexing

Likely product access patterns include:

```text id="a7k4p2"
store_id
store_id + status
store_id + slug
product_id
variant_id
store_id + sku
```

Indexes should be confirmed against actual queries and expected workload.

---

## 53. Historical Data

Product changes must not corrupt historical commerce data.

When an order is created, relevant product/variant data must be snapshotted by the Orders module.

Changing:

```text id="b5q8m3"
Product name
Price
SKU
Description
```

must not rewrite historical order information.

---

## 54. Security Requirements

The Products module must prevent:

- Cross-store product access.
- Unauthorized product creation.
- Unauthorized publication.
- Unauthorized variant modification.
- SKU manipulation across tenants.
- Sensitive internal data exposure.
- Unsafe rich-text rendering.

---

## 55. Testing Strategy

### Unit tests

- Product state transitions.
- Variant rules.
- Slug validation.
- Price validation.
- Publication rules.

### Integration tests

- Product persistence.
- Variant persistence.
- Foreign keys.
- Unique SKU/slug constraints.
- Tenant isolation.
- Concurrent variant creation.

### API tests

- Authentication.
- Authorization.
- Validation.
- Pagination.
- Error contract.
- Store isolation.

### E2E tests

- Merchant creates Product.
- Merchant creates/updates Variant.
- Merchant publishes Product.
- Public storefront displays published Product.
- Draft/archived products remain hidden.

---

## 56. Critical Test Cases

```text id="q6v2n9"
[ ] Product can be created by authorized merchant
[ ] Unauthorized merchant cannot create Product
[ ] Product belongs to correct Store
[ ] Duplicate slug is rejected
[ ] Duplicate SKU is rejected within required scope
[ ] Product cannot be published with invalid required data
[ ] Draft product is hidden from storefront
[ ] Archived product is hidden from storefront
[ ] Variant belongs to correct Product
[ ] Cross-tenant variant access is denied
[ ] Product price uses exact representation
[ ] Product updates do not alter historical orders
[ ] Concurrent SKU creation is handled safely
[ ] Product API pagination is bounded
```

---

## 57. Implementation Sequence

Recommended implementation order:

```text id="m3w7x8"
1. Define Product and Variant domain models
2. Define lifecycle/state rules
3. Define persistence schema
4. Create migrations
5. Implement repositories
6. Implement Product application services
7. Implement Variant application services
8. Implement authorization
9. Implement validation
10. Implement APIs
11. Implement storefront queries
12. Add events where required
13. Add unit tests
14. Add integration tests
15. Add API tests
16. Add E2E tests
17. Verify tenant isolation
```

---

## 58. Demo Simplifications

The Demo intentionally does not require:

- Dedicated search infrastructure.
- Product recommendation systems.
- Advanced product collections.
- Complex catalog rules.
- Multi-region pricing.
- Advanced product personalization.
- Enterprise catalog imports.
- Marketplace catalog synchronization.
- Advanced merchandising engines.

These can be added later without breaking the core Product boundary.

---

## 59. V1 Evolution

The Products module should support future capabilities such as:

- Collections.
- Advanced attributes.
- Product options.
- Product bundles.
- Search indexing.
- Bulk imports.
- Advanced merchandising.
- Multi-currency pricing.
- Catalog integrations.

These should be added as domain capabilities rather than by bypassing the Product module.

---

## 60. Definition of Done

The Products implementation is complete when:

```text id="v4k9p2"
[ ] Product entity exists
[ ] Variant entity exists
[ ] Product belongs to Store
[ ] Variant belongs to Product
[ ] Product lifecycle is implemented
[ ] Variant lifecycle is implemented
[ ] Slug validation exists
[ ] SKU uniqueness is enforced
[ ] Exact monetary representation is used
[ ] Product publication rules exist
[ ] Product APIs exist
[ ] Storefront queries exist
[ ] Authentication is enforced
[ ] Authorization is enforced
[ ] Tenant isolation is enforced
[ ] Product media relationships are supported
[ ] Historical order data remains independent
[ ] Database constraints exist
[ ] Appropriate indexes exist
[ ] Concurrency cases are handled
[ ] Idempotency is applied where required
[ ] Unit tests exist
[ ] Integration tests exist
[ ] API tests exist
[ ] E2E coverage exists
[ ] Documentation matches implementation
```