# Products Domain Build Implementation

## 1. Purpose

This document defines the concrete implementation approach for the Products domain in the Demo.

The Products domain provides the merchant catalog used by inventory, cart, checkout, orders, and storefront functionality.

It owns product identity, variants, catalog information, publication state, SKU identity, pricing data, and product-media relationships.

The implementation must provide a clean catalog foundation without introducing a dedicated search service or unnecessary catalog infrastructure.

---

# 2. Domain Ownership

The Products module owns:

- Products.
- Product variants.
- Product identity.
- Product descriptions.
- Product status.
- Product slugs.
- SKU identity.
- Variant pricing.
- Product publication state.
- Product media relationships.
- Catalog queries.

It does not own:

- Inventory quantities.
- Inventory reservations.
- Carts.
- Checkout.
- Payments.
- Orders.
- Customers.
- Discounts.
- Store membership or authorization.

---

# 3. Module Location

Implementation belongs under:

```text
modules/products/
```

The module should follow the established structure:

```text
modules/products/
├── domain/
├── application/
├── infrastructure/
└── index.ts
```

The exact internal structure may follow existing repository conventions.

---

# 4. Layer Responsibilities

The Products module follows:

```text
Presentation
    ↓
Application
    ↓
Domain
    ↓
Infrastructure
```

The module must expose only approved public interfaces.

Other modules must not import internal repositories or persistence implementation directly.

---

# 5. Core Entities

The primary catalog entities are:

```text
Product
ProductVariant
```

A Product represents the catalog-level item.

A Variant represents a purchasable version of that product.

---

# 6. Product

A Product should contain information such as:

```text
id
storeId
title
description
slug
status
createdAt
updatedAt
```

Only approved fields should be added.

---

# 7. Product Variant

A Variant represents a specific purchasable configuration.

Typical fields include:

```text
id
productId
sku
price
status
createdAt
updatedAt
```

Additional attributes should only be introduced when required by the Demo scope.

---

# 8. Product Ownership

Every Product must belong to exactly one Store.

Conceptually:

```text
Store
  ↓
Product
  ↓
Variant
```

A Product must never exist without a valid Store relationship.

---

# 9. Variant Ownership

A Variant belongs to one Product.

The implementation must prevent:

```text
Variant
  ↓
Product A
  ↓
Store B
```

through foreign-key and application-level tenant validation.

---

# 10. Product Lifecycle

Product lifecycle must use the approved state machine.

Typical states may include:

```text
DRAFT
ACTIVE
ARCHIVED
```

The actual approved state set is authoritative.

---

# 11. State Transitions

Product status changes should occur through explicit application operations.

Examples:

```text
createProduct()
publishProduct()
unpublishProduct()
archiveProduct()
```

The domain should reject invalid transitions.

---

# 12. Publication

Publication determines whether a product is eligible for the public storefront.

A product being stored in the database does not automatically make it publicly purchasable.

Publication should respect:

```text
Product status
Variant availability
Store status
```

The exact storefront eligibility rules must follow the approved specifications.

---

# 13. Product Creation

The application flow should be:

```text
Authenticate
    ↓
Resolve Store context
    ↓
Authorize merchant
    ↓
Validate request
    ↓
Create Product
    ↓
Create initial Variant(s) if requested
    ↓
Commit transaction
    ↓
Return DTO
```

---

# 14. Product Creation Transaction

If Product and Variant records are created together, they should be persisted transactionally.

A failed Variant creation must not leave an invalid partially created catalog item unless partial creation is explicitly part of the use case.

---

# 15. Product Title

Product titles should be validated for:

- Required/optional semantics.
- Length limits.
- Whitespace normalization.
- Reasonable maximum size.

Do not silently truncate merchant input.

---

# 16. Product Description

Descriptions should have explicit size limits.

The implementation must define whether the Demo supports:

```text
Plain text
Limited rich text
```

Do not introduce an arbitrary HTML rendering system without a security requirement.

If rich text is supported, sanitization is mandatory before rendering.

---

# 17. Product Slugs

Slugs should:

- Be normalized consistently.
- Follow the approved character rules.
- Be unique within the required Store scope.
- Have database-level uniqueness protection.

A slug conflict should produce a stable conflict error.

---

# 18. SKU

SKU identifies a purchasable Variant for merchant operations.

SKU rules should include:

```text
Normalization
Length limits
Uniqueness scope
Optional/required semantics
```

The final uniqueness requirement should follow the approved database specification.

---

# 19. SKU Integrity

The database must enforce SKU uniqueness where required.

Application validation should provide a meaningful error such as:

```text
SKU_ALREADY_EXISTS
```

rather than exposing a raw database constraint violation.

---

# 20. Pricing

Variant prices must use the approved exact money representation.

Never use floating-point numbers for persisted monetary values.

Conceptually:

```text
amount
currency
```

or the exact representation established by the database contract.

---

# 21. Price Validation

Price validation should ensure:

```text
Valid numeric representation
Non-negative where required
Valid currency
Maximum sensible precision
```

The Products domain owns the stored base price.

Discounted checkout pricing remains a Checkout/Discount concern.

---

# 22. Product Updates

Product updates should use explicit application operations.

Examples:

```text
updateProduct()
updateProductDescription()
updateProductSlug()
updateProductStatus()
```

Avoid a generic unrestricted update method.

---

# 23. Variant Updates

Variant updates should be explicit as well.

Examples:

```text
createVariant()
updateVariant()
archiveVariant()
updateVariantPrice()
```

Inventory quantities must not be modified through product variant update operations.

---

# 24. Inventory Separation

The Products domain may identify a Variant.

The Inventory domain owns:

```text
on-hand quantity
reserved quantity
available quantity
adjustments
reservations
releases
```

Products must never directly modify inventory quantities.

---

# 25. Cart Separation

The Cart domain may reference a Variant ID.

Products does not own cart items or cart quantities.

The Cart domain must verify that referenced variants are valid and eligible.

---

# 26. Checkout Separation

Checkout recalculates authoritative purchase information.

The Products domain provides catalog facts such as:

```text
variant identity
product identity
base price
publication/status information
```

Checkout must not blindly trust stale client-provided product data.

---

# 27. Order Separation

Orders must store historical product information required for the completed purchase.

The Orders domain owns those historical snapshots.

Later Product edits must not silently rewrite historical order information.

---

# 28. Storefront Queries

The Products module should provide application-level catalog queries for the Storefront domain.

Examples:

```text
listPublishedProducts()
getPublishedProductBySlug()
getPublishedProductById()
```

These queries must apply the appropriate publication and Store scope.

---

# 29. Merchant Queries

Merchant-facing queries may include:

```text
listProducts()
getProduct()
listVariants()
getVariant()
```

Merchant queries must enforce Store authorization before returning data.

---

# 30. Query Filtering

The Demo may support basic filtering such as:

```text
status
publication state
SKU
slug
```

Do not introduce a dedicated search engine.

Use PostgreSQL queries and indexes appropriate to the actual requirements.

---

# 31. Pagination

Catalog listing endpoints should use the approved pagination strategy.

The implementation must define:

```text
page size
maximum page size
ordering
cursor/offset semantics
```

Do not allow unbounded product queries.

---

# 32. Sorting

Sorting should use explicit approved fields.

Examples:

```text
createdAt
updatedAt
title
price
```

Client input must not become arbitrary SQL ordering.

---

# 33. Product Media

Products may associate with media records managed by the Media integration.

Products should store relationships/references, not binary file contents.

Media storage remains outside the Products domain.

---

# 34. Media Association

Product media operations should validate:

```text
Product belongs to Store
Media belongs to the same Store where required
Media is valid/available
Association is authorized
```

The Products domain must not bypass Media ownership rules.

---

# 35. Product Publication Rules

Before publishing a product, validate the minimum conditions required by the Demo.

For example:

```text
Valid Product
Valid Store
Required Variant exists
Variant has valid price
```

Inventory availability should follow the approved storefront/purchase rules rather than being incorrectly duplicated inside Products.

---

# 36. Product Archival

Archiving a Product should prevent new storefront purchases according to the approved publication rules.

Existing historical Orders must remain unchanged.

Existing carts or checkout sessions must be handled by their own domains.

---

# 37. Concurrency

Concurrent Product operations must be safe.

Examples:

```text
Two users attempt the same slug
Two users modify the same Product
Two users publish/archive simultaneously
```

Database constraints and transaction semantics should protect integrity.

---

# 38. Optimistic Concurrency

If the API exposes versioning or update timestamps for concurrency detection, use them consistently.

Do not introduce an elaborate concurrency mechanism unless actual requirements justify it.

---

# 39. Transactions

Use transactions when a Product operation changes multiple related records.

Examples:

```text
Create Product + Variants
Update Product + required relationships
Publication changes requiring multiple writes
```

Transactions should remain short.

---

# 40. Idempotency

Idempotency should be applied to retry-sensitive write operations where appropriate.

It should not be added mechanically to every Product mutation.

Where idempotency is used, the operation must define:

```text
Key scope
Request fingerprint
Replay behavior
Conflict behavior
```

---

# 41. Events

Products may emit events such as:

```text
ProductCreated
ProductUpdated
ProductPublished
ProductUnpublished
ProductArchived
VariantCreated
VariantUpdated
VariantArchived
```

Events must represent completed facts.

---

# 42. Event Consumers

Other domains may consume Product events for secondary work.

For example:

```text
ProductPublished
    ↓
Storefront-related processing
```

The Products module must not directly modify another module's internal state.

---

# 43. Application Services

Application services should coordinate:

```text
Authentication context
Store resolution
Authorization
Input validation
Transaction
Domain operations
Persistence
Events
DTO mapping
```

Each use case should have a clear responsibility.

---

# 44. Repository Design

Repository interfaces should expose only operations required by the Products application/domain layer.

Avoid generic methods such as:

```text
updateAnything()
findAnything()
```

that bypass domain rules.

---

# 45. DTOs

Use explicit DTOs for API boundaries.

Examples:

```text
ProductSummaryDTO
ProductDetailsDTO
ProductVariantDTO
ProductListDTO
```

Do not serialize database models directly.

---

# 46. Error Handling

Products should use the shared error model.

Examples:

```text
PRODUCT_NOT_FOUND
PRODUCT_SLUG_CONFLICT
VARIANT_NOT_FOUND
SKU_CONFLICT
INVALID_PRODUCT_STATE
INVALID_VARIANT_STATE
PRODUCT_NOT_PUBLISHABLE
```

Exact codes should remain centralized.

---

# 47. Authorization

Merchant operations require Store membership and appropriate permissions.

Public storefront operations must not inherit merchant authorization context.

Authorization belongs at the server boundary and application layer.

---

# 48. Tenant Isolation

Every query must be scoped appropriately.

A dangerous pattern is:

```text
findProductById(productId)
```

when the calling context has not established Store ownership.

Prefer operations that incorporate trusted Store context where required.

---

# 49. Database Constraints

The database should enforce:

```text
Product → Store foreign key
Variant → Product foreign key
SKU uniqueness where required
Slug uniqueness where required
Required fields
Valid relational references
```

Application validation remains responsible for friendly errors.

---

# 50. Testing Strategy

### Unit Tests

Test:

```text
Product lifecycle
Variant lifecycle
Slug rules
SKU rules
Price validation
Publication rules
```

### Integration Tests

Test:

```text
Persistence
Foreign keys
Unique constraints
Store isolation
Transactions
Concurrent conflicts
```

### API Tests

Test:

```text
Authentication
Authorization
Validation
Pagination
Filtering
DTO serialization
Error mapping
```

---

# 51. Security Tests

At minimum verify:

```text
[ ] Merchant cannot access another Store's products
[ ] Client cannot override Store ownership
[ ] Public API exposes only published/public product data
[ ] Private product data is not leaked
[ ] Unauthorized product mutation fails
[ ] Rich content cannot introduce unsafe executable content
```

---

# 52. Implementation Order

Implement the Products domain in this order:

```text
1. Database schema and constraints
2. Product/Variant domain model
3. Money and SKU/slug value handling
4. Repository interfaces
5. Persistence implementation
6. Product application services
7. Variant application services
8. Publication/state transitions
9. Catalog query services
10. Media relationship integration
11. API DTOs and handlers
12. Events
13. Unit tests
14. Integration tests
15. API/security tests
16. Storefront verification
```

---

# 53. Verification Scenario

The minimum successful Product flow is:

```text
Merchant authenticates
      ↓
Selects Store
      ↓
Creates Product
      ↓
Creates Variant
      ↓
Sets SKU and price
      ↓
Publishes Product
      ↓
Product appears in Storefront
      ↓
Customer can reference Variant
      ↓
Inventory/Cart/Checkout use the same Variant identity
```

The flow must remain valid after application restart and database reload.

---

# 54. AI Implementation Rules

AI agents implementing Products must:

1. Read the actual root `AGENTS.md`.
2. Read Product architecture/specification documents.
3. Inspect Stores and shared tenant infrastructure.
4. Preserve the Product/Inventory boundary.
5. Never modify inventory directly.
6. Never modify order history.
7. Never trust client-supplied Store ownership.
8. Reuse established validation/error patterns.
9. Avoid introducing search infrastructure.
10. Add tests for tenant isolation and state transitions.
11. Avoid unrelated changes.
12. Review the final diff.

---

# 55. Definition of Done

The Products domain is complete when:

```text
[ ] Products can be created
[ ] Variants can be created
[ ] Products belong to the correct Store
[ ] Variant relationships are correct
[ ] SKU rules are enforced
[ ] Slug rules are enforced
[ ] Exact pricing is implemented
[ ] Product lifecycle works
[ ] Publication works
[ ] Product media relationships work
[ ] Inventory ownership remains separate
[ ] Cart/checkout integration uses Variant identity
[ ] Storefront queries return only eligible products
[ ] Pagination is bounded
[ ] Tenant isolation is enforced
[ ] Authorization is enforced
[ ] Errors use stable codes
[ ] Events follow approved contracts
[ ] Unit tests pass
[ ] Integration tests pass
[ ] API/security tests pass
[ ] TypeScript passes
[ ] Lint passes
```

---

# 56. Final Principle

The Products domain is the authoritative catalog definition, not the owner of every concern connected to a product.

Its job is to answer:

```text
What is this product?
Which variants can be purchased?
What is their catalog price?
Is the product published?
Which Store owns it?
```

Inventory answers how much is available.

Checkout determines what the customer actually pays.

Orders preserve what was purchased.

Keeping those boundaries intact prevents the catalog from becoming a giant dumping ground for every commerce rule in existence.