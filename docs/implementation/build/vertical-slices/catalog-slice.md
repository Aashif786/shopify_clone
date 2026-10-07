# Catalog Vertical Slice Build Implementation

## 1. Purpose

This document defines the implementation of the Catalog vertical slice for the Demo.

The Catalog slice connects Store management, Products, Variants, pricing, media, publication state, inventory visibility, merchant authorization, and the first customer-facing product catalog.

The objective is to establish a real catalog lifecycle:

```text id="m8q4r5"
Merchant
  ↓
Store
  ↓
Create Product
  ↓
Create Variant
  ↓
Set Price
  ↓
Attach Media
  ↓
Publish Product
  ↓
Customer sees Product
```

This slice must use the existing domain boundaries rather than creating a separate catalog subsystem.

---

# 2. Slice Objective

The completed slice must allow a merchant to:

- Create a Product.
- Configure its basic information.
- Create Variants.
- Configure prices.
- Configure SKU where required.
- Attach approved media.
- Save changes.
- Publish the Product.
- View the Product through the public Storefront.

The public side must expose only Products that satisfy publication requirements.

---

# 3. Dependencies

This slice depends on:

```text id="q7m4r6"
Repository foundation
Package foundation
Web foundation
Database
Authentication
Tenant context
Authorization
API
Validation/errors
Observability
Stores
Products
Media
Storefront
```

Inventory integration may be used for availability display but must not be implemented as part of Product ownership.

---

# 4. Domain Ownership

The Products domain owns:

```text id="v5r8m4"
Product
Variant
Product identity
Product description
SKU
Pricing
Publication state
Catalog queries
Product/Media relationships where defined
```

Inventory owns:

```text id="m4q8r6"
On-hand quantity
Reserved quantity
Available quantity
Adjustments
Reservations
```

Storefront owns:

```text id="x6r5m8"
Public presentation
Public product access
Customer-facing catalog composition
```

---

# 5. Merchant Flow

The merchant workflow is:

```text id="q8m4r5"
Open Store
   ↓
Products
   ↓
Create Product
   ↓
Enter Product Details
   ↓
Create Variant
   ↓
Set Price/SKU
   ↓
Attach Media
   ↓
Save
   ↓
Publish
```

---

# 6. Product Creation

The Product creation operation must be performed through the Products application service.

The client should submit only permitted fields.

Example:

```text id="v7r4m6"
title
description
slug
```

The server determines:

```text id="m5q8r4"
storeId
productId
timestamps
initial lifecycle state
```

---

# 7. Store Context

Every Product belongs to exactly one Store.

The Store must be resolved from trusted tenant context.

Do not trust a browser-provided `storeId` as authorization.

If a Store ID is present in the request, it must be checked against the authenticated user's authorized Store context.

---

# 8. Product Validation

Validate:

```text id="x4m8r6"
Required fields
Maximum lengths
Slug format
Allowed status transitions
```

Business rules remain in the Products domain.

---

# 9. Product Slug

The Product slug must be unique within the approved Store scope.

For example:

```text id="q6r5m8"
Store A
  └── blue-shirt

Store B
  └── blue-shirt
```

may both be valid if the uniqueness scope is Store-specific.

The database must enforce the final uniqueness constraint.

---

# 10. Variant Creation

A Product may contain one or more Variants according to the approved Product specification.

A Variant should contain the information required for purchase and catalog presentation.

Typical fields include:

```text id="v8m4r5"
variant ID
product ID
SKU
price
status
```

Additional variant attributes should only be introduced where required.

---

# 11. Variant Ownership

Variants are owned by Products.

The Storefront must not be able to create a Variant independently of a Product.

The Product domain must validate that a Variant belongs to the correct Product and Store.

---

# 12. SKU

SKU rules should be enforced by the Products domain and database.

If SKU uniqueness is Store-scoped:

```text id="m7q4r6"
UNIQUE(storeId, sku)
```

or the equivalent approved constraint should protect against concurrent duplicate creation.

---

# 13. Pricing

Product pricing must use the approved exact money representation.

Never use JavaScript floating-point numbers as the authoritative price representation.

For example, do not use:

```text id="x5r8m4"
19.99
```

as an untyped floating-point business value.

Use the project's approved money representation.

---

# 14. Currency

Currency must be explicit.

The implementation should follow the approved Store/Product currency model.

The Storefront must never infer currency merely from the user's browser.

---

# 15. Price Updates

Price updates must go through the Products application service.

The frontend must not become authoritative for price.

When a price changes:

```text id="q7m4r6"
Product
 ↓
Updated authoritative price
 ↓
Storefront
```

Checkout will independently revalidate the price before purchase.

---

# 16. Product Status

The Product lifecycle must use the approved state machine.

Typical states may include:

```text id="v6m5r8"
DRAFT
ACTIVE/PUBLISHED
ARCHIVED
```

The exact state names must match the Products specification.

---

# 17. Publication

Publishing is a domain operation.

For example:

```text id="m4q8r5"
publishProduct(productId)
```

The application should verify required publication conditions before allowing the transition.

---

# 18. Publication Requirements

Depending on the approved Product rules, publication may require:

```text id="x8r4m6"
Valid title
Valid Variant
Valid price
Required catalog data
```

Do not create separate frontend-only publication rules.

---

# 19. Draft Visibility

Draft Products must not appear in the public Storefront.

The public catalog query must enforce publication state server-side.

A customer cannot access a draft simply by guessing its ID.

---

# 20. Product Detail Security

Public Product lookup should resolve only:

```text id="q5m7r4"
Store
+
Published Product
```

A merchant endpoint may access drafts according to Store authorization.

These are separate access policies.

---

# 21. Media Attachment

Product media should use the Media integration.

The workflow is:

```text id="v7r4m6"
Upload Media
   ↓
Validate ownership
   ↓
Associate Media with Product
   ↓
Persist relationship
```

The Products domain owns the meaning of the association.

---

# 22. Media Ordering

If multiple Product images are supported, the Product/Media relationship may preserve an explicit display order.

The implementation should avoid relying on arbitrary database row order.

---

# 23. Primary Media

If the Demo supports a primary Product image, it must be represented explicitly.

Do not infer the primary image from:

```text id="m8q4r5"
first database row
upload timestamp
array position
```

unless that is the approved design.

---

# 24. Catalog Listing

Merchant catalog listing should support the minimum required information:

```text id="x4r7m6"
Product title
Status
Variant count
Price information
Updated timestamp
```

The query must be Store-scoped.

---

# 25. Catalog Pagination

Product listings must use bounded pagination.

The implementation should define:

```text id="q6m5r8"
Default page size
Maximum page size
Stable ordering
Pagination mechanism
```

Do not return the entire Product table.

---

# 26. Catalog Filtering

Supported filters may include:

```text id="v8r4m6"
Status
Published state
```

Additional filtering should only be added when required.

---

# 27. Catalog Sorting

Sorting must use an allowlist.

Examples:

```text id="m5q7r4"
createdAt
updatedAt
title
```

Do not allow arbitrary SQL columns from client input.

---

# 28. Public Catalog

The Storefront catalog should use an application interface such as:

```text id="x7r4m8"
Products.listPublishedProducts(storeContext)
```

rather than directly querying Product tables.

---

# 29. Public Product DTO

The Storefront should receive a dedicated public DTO.

For example:

```text id="q5m8r6"
PublicProductDTO
├── id
├── slug
├── title
├── description
├── variants
├── price information
└── media
```

The exact shape follows the API contract.

---

# 30. Merchant Product DTO

Merchant responses may contain additional information:

```text id="v6m4r5"
status
SKU
internal identifiers
inventory summary where authorized
timestamps
```

Do not reuse merchant DTOs as public DTOs.

---

# 31. Inventory Integration

If the catalog displays availability, the Product module should consume approved Inventory information.

It must not query Inventory tables directly.

Example:

```text id="m8q4r7"
Products
   ↓
Inventory public/application interface
   ↓
Availability
```

The exact integration should follow the Inventory implementation.

---

# 32. Inventory Is Not Product State

A Product being published does not automatically mean it is in stock.

These are independent concerns:

```text id="x5r7m4"
Publication
≠
Inventory availability
```

Checkout performs final inventory validation.

---

# 33. Product Update

Merchant Product updates should follow:

```text id="q7m4r6"
Request
 ↓
Auth
 ↓
Tenant
 ↓
Validation
 ↓
Product application service
 ↓
Domain rules
 ↓
Transaction
 ↓
Response
```

The frontend must not update the database directly.

---

# 34. Product Deletion

If Product deletion is supported, it must follow the approved lifecycle.

For Demo, archival may be preferable to destructive deletion when historical relationships exist.

Orders must never lose historical purchase information because a Product was removed from the active catalog.

---

# 35. Order Independence

Once an Order exists, Product changes must not rewrite historical Order snapshots.

The Catalog slice must therefore verify:

```text id="v4m8r5"
Product price changes
Product title changes
Product archival
```

without modifying completed Orders.

---

# 36. API Endpoints

The slice may require APIs such as:

```text id="m6q4r8"
POST   /api/v1/stores/:storeId/products
GET    /api/v1/stores/:storeId/products
GET    /api/v1/stores/:storeId/products/:productId
PATCH  /api/v1/stores/:storeId/products/:productId
POST   /api/v1/stores/:storeId/products/:productId/publish
```

Exact routes must follow the approved API contract.

---

# 37. Variant APIs

If Variants have dedicated endpoints, they should remain Product-scoped.

For example:

```text id="x8r5m4"
POST   /products/:productId/variants
PATCH  /products/:productId/variants/:variantId
```

The application must verify that the Variant belongs to the requested Product and Store.

---

# 38. Authorization

Merchant Product operations require appropriate Store membership and permission.

At minimum:

```text id="q5m7r6"
Owner/Admin → product management
Staff → according to assigned permission
Unaffiliated user → denied
```

The exact matrix follows the User Roles specification.

---

# 39. Tenant Isolation

Every Product query must be Store-scoped.

Never retrieve:

```text id="v6r4m8"
Product by productId alone
```

and assume that the caller is authorized.

The Store relationship must participate in the authorization/query path.

---

# 40. Concurrency

Product creation and updates may race.

Examples:

```text id="m7q4r5"
Two requests create the same SKU
Two requests create the same slug
Two requests publish/update the same Product
```

Database constraints and application-level concurrency handling must prevent inconsistent results.

---

# 41. Idempotency

Mutation operations that may be retried because of network failure should use the approved API idempotency mechanism where required.

Examples:

```text id="x4r8m6"
Create Product
Create Variant
Attach Media
Publish Product
```

Each operation should define its own semantics.

Do not assume every PATCH request should be globally idempotent in the same way.

---

# 42. Events

The Products domain may emit events such as:

```text id="q8m4r5"
ProductCreated
ProductUpdated
ProductPublished
ProductArchived
VariantCreated
VariantUpdated
```

Events represent facts that already occurred.

They must not be used as a substitute for synchronous transaction-critical validation.

---

# 43. Notifications

Catalog changes do not require customer notifications in the Demo unless explicitly required.

Do not build a product-marketing notification system into this slice.

---

# 44. Observability

Product operations should emit structured telemetry containing:

```text id="v7m5r4"
operation
productId
storeId
userId where safe
requestId
result
duration
```

Errors should use the shared error and logging infrastructure.

---

# 45. Testing Strategy

### Unit Tests

Test:

```text id="m5q8r4"
Product validation
Variant rules
SKU rules
Slug rules
Price validation
Publication state machine
```

### Integration Tests

Test:

```text id="x6r4m8"
Product persistence
Variant persistence
Store isolation
SKU uniqueness
Slug uniqueness
Media association
Publication
```

### API Tests

Test:

```text id="q7m4r5"
Validation
Authorization
Pagination
DTOs
Error mapping
```

---

# 46. Storefront Integration Test

The complete catalog path should verify:

```text id="v8r4m6"
Merchant creates Product
      ↓
Creates Variant
      ↓
Sets price
      ↓
Attaches media
      ↓
Publishes Product
      ↓
Public Storefront lists Product
      ↓
Customer opens Product detail
```

---

# 47. Draft Isolation Test

Create a Product in Draft state.

Verify:

```text id="m4q8r7"
Merchant → can view
Public Storefront → cannot view
Customer → cannot view
```

Then publish it and verify public visibility.

---

# 48. Cross-Tenant Test

Create Products in two Stores.

Verify:

```text id="x5r8m6"
Store A merchant
    ↓
cannot read/update Store B Product

Store A storefront
    ↓
cannot expose Store B Product
```

---

# 49. Historical Integrity Test

Create an Order using Product A.

Then change:

```text id="q6m4r8"
Product title
Product price
SKU
Product status
```

Verify the existing Order remains historically correct.

---

# 50. Failure Tests

Test:

```text id="v7r5m4"
Duplicate slug
Duplicate SKU
Invalid price
Invalid publication state
Unauthorized update
Cross-store Product ID
Missing Variant
Invalid Media association
Database failure
Mutation retry
```

Every failure should produce a controlled result.

---

# 51. Implementation Order

Implement the Catalog slice in this order:

```text id="m8q4r5"
1. Verify Store/tenant foundation
2. Verify Product schema
3. Implement Product application services
4. Implement Product creation
5. Implement Variant creation
6. Implement pricing
7. Implement SKU/slug constraints
8. Implement Product updates
9. Implement Media association
10. Implement publication workflow
11. Implement merchant catalog APIs
12. Implement public catalog queries
13. Implement Storefront Product pages
14. Add inventory availability integration where required
15. Add observability
16. Add unit tests
17. Add integration/API tests
18. Add cross-tenant/security tests
19. Add E2E catalog flow
```

---

# 52. AI Implementation Rules

AI agents implementing this slice must:

1. Read the actual root `AGENTS.md`.
2. Read Products, Stores, Inventory, Media, Storefront, API, Database, and Security specifications.
3. Keep Product ownership inside Products.
4. Keep Inventory ownership inside Inventory.
5. Keep public presentation inside Storefront.
6. Never trust client-side price or publication state.
7. Preserve Store isolation.
8. Use database constraints for SKU/slug integrity.
9. Preserve historical Order data.
10. Avoid introducing search infrastructure.
11. Avoid unrelated catalog features.

---

# 53. Definition of Done

The Catalog slice is complete when:

```text id="x4r8m6"
[ ] Merchant can create Products
[ ] Merchant can create Variants
[ ] Prices are stored exactly
[ ] SKU rules work
[ ] Slug rules work
[ ] Product updates work
[ ] Product media association works
[ ] Product publication works
[ ] Draft Products remain private
[ ] Public catalog works
[ ] Product detail works
[ ] Public DTOs are safe
[ ] Inventory availability integration is correct where used
[ ] Store authorization works
[ ] Cross-tenant isolation works
[ ] Product concurrency rules work
[ ] Mutation retry behavior is safe
[ ] Events work where required
[ ] Unit tests pass
[ ] Integration/API tests pass
[ ] Security tests pass
[ ] E2E catalog flow passes
[ ] TypeScript passes
[ ] Lint passes
```

---

# 54. Slice Completion Gate

The Catalog slice must pass the following complete scenario before moving forward:

```text id="q7m5r4"
Fresh Store
   ↓
Create Product
   ↓
Create Variant
   ↓
Set valid price/SKU
   ↓
Attach Product media
   ↓
Publish
   ↓
Open public Storefront
   ↓
Product is visible
   ↓
Open Product detail
   ↓
Correct price/media/variant information displayed
```

The implementation is complete only when the merchant-side lifecycle and public customer-side lifecycle work together using the approved domain boundaries.