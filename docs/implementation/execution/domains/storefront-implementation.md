# Storefront Implementation

## 1. Purpose

This document defines the concrete execution-level implementation of the Storefront domain for the Demo.

The Storefront is the public-facing commerce experience through which customers discover a Store, browse published products, manage a Cart, and enter Checkout.

The Storefront must remain intentionally simple for the Demo while using the same domain boundaries and server-side business rules that will support the future V1 architecture.

---

# 2. Domain Ownership

Storefront implementation belongs to:

```text
modules/storefront
```

The Storefront module owns:

- Public Store resolution.
- Public Store configuration retrieval.
- Published catalog presentation.
- Public product listing.
- Public product detail.
- Storefront-specific application services.
- Public commerce entry points.

It does not own:

```text
Products
Inventory
Carts
Checkout
Orders
Customers
Payments
Discounts
```

Those domains remain authoritative for their respective business rules.

---

# 3. Storefront Architecture

The public request flow is:

```text
Customer Browser
      ↓
Next.js Web App
      ↓
Storefront Application Service
      ↓
Store Resolution
      ↓
Products / Cart / Checkout Interfaces
      ↓
Response
```

The Storefront must not directly query another module's internal tables.

---

# 4. Store Resolution

Every public Storefront request must resolve the Store.

Possible Demo resolution mechanisms include:

```text
store slug
custom domain
configured storefront identifier
```

The Demo should begin with the simplest reliable Store resolution mechanism and preserve an abstraction so custom domains can be added later.

---

# 5. Store Context

After resolution, establish:

```text
StoreContext
```

Conceptually:

```text
{
  storeId,
  storeSlug,
  status,
  currency,
  storefrontConfiguration
}
```

All subsequent Storefront operations must use this context.

---

# 6. Store Validation

A Storefront should only be publicly accessible when the Store is in an appropriate public state.

For example:

```text
Active
```

Inactive, suspended, or deleted Stores must not expose normal commerce operations.

The exact Store state rules follow the Stores specification.

---

# 7. Public Store Configuration

The Storefront may expose safe public configuration such as:

```text
Store name
Store description
Logo
Branding configuration
Currency
Contact information
Storefront settings
```

Never expose:

```text
Database credentials
Provider secrets
Internal IDs not intended for public use
Merchant credentials
Internal configuration
Operational secrets
```

---

# 8. Product Listing

The Storefront should retrieve published products through the Products public interface.

Example:

```text
Storefront
   ↓
Product Catalog Query
   ↓
Published Products
   ↓
Storefront DTO
```

Only products eligible for public sale should appear.

---

# 9. Published Product Rules

A Product should generally be visible only when:

```text
Product belongs to Store
Product is published/active
Product has a valid storefront representation
```

The Storefront must not independently redefine Product publication rules.

---

# 10. Product Detail

Product detail should provide:

```text
Product
Variants
Prices
SKU where public
Images
Descriptions
Availability information where supported
```

The response should contain only fields appropriate for public customers.

---

# 11. Product Visibility

A public Product query must not expose unpublished or private Products.

Example:

```text
Draft Product
      ↓
Merchant can see it
      ↓
Public Storefront cannot
```

This filtering must happen server-side.

---

# 12. Variant Selection

The Storefront should allow customers to select a valid Variant where Products contain multiple Variants.

The selected Variant must be:

```text
Active
Owned by the requested Product
Owned by the same Store
Eligible for sale
```

The client cannot manufacture a Variant belonging to another Store.

---

# 13. Pricing

Storefront prices are presentation data.

The customer may see:

```text
Current Product price
Variant price
Display currency
```

However, the Storefront must never treat client-visible prices as authoritative during Checkout.

Checkout recalculates the final purchase price.

---

# 14. Inventory Display

If inventory availability is displayed publicly, it should use the Inventory domain's public read interface.

Possible states:

```text
In stock
Low stock
Out of stock
```

Exact quantity should not necessarily be exposed publicly.

The Storefront should not directly modify inventory.

---

# 15. Inventory Race

Displaying a product as available does not reserve inventory.

Example:

```text
Storefront
   ↓
"In stock"
   ↓
Customer adds to Cart
   ↓
Another customer buys remaining stock
   ↓
Checkout
   ↓
Inventory reservation fails
```

This is expected behavior.

Inventory availability becomes authoritative during the purchase workflow.

---

# 16. Storefront Cart Entry

Customers should be able to add products to a Cart from the Storefront.

Flow:

```text
Product Page
      ↓
Select Variant
      ↓
Quantity
      ↓
Add to Cart
      ↓
Cart Domain
```

The Storefront should call the Cart application service rather than manipulating Cart records.

---

# 17. Guest Cart

The Demo may support guest carts.

A guest Cart should be associated with a secure client-side/session identifier according to the authentication and Cart implementation.

The Storefront must not trust arbitrary customer IDs submitted by the browser.

---

# 18. Customer Cart

Authenticated customers may have a persistent Store-scoped Cart.

Example:

```text
Customer
   ↓
Store
   ↓
Active Cart
```

The Cart domain remains responsible for Cart ownership and mutation rules.

---

# 19. Add-to-Cart Validation

The Storefront request should validate:

```text
Store exists
Store is active
Product exists
Product is published
Variant exists
Variant belongs to Product
Variant belongs to Store
Quantity is valid
```

The Cart domain performs its own authoritative validation.

---

# 20. Checkout Entry

The Storefront provides the entry point into Checkout.

Flow:

```text
Cart
  ↓
Checkout creation
  ↓
Checkout page
  ↓
Payment
  ↓
Order
```

Checkout owns all final purchase validation.

---

# 21. Checkout Security

The Storefront must never trust:

```text
Client total
Client discount
Client price
Client inventory state
Client payment status
```

These are authoritative only when calculated or verified by their owning domains.

---

# 22. Public APIs

Typical Storefront APIs may include:

```text
GET  /api/v1/storefront
GET  /api/v1/storefront/products
GET  /api/v1/storefront/products/:slug
POST /api/v1/storefront/cart/items
GET  /api/v1/storefront/cart
POST /api/v1/storefront/checkout
```

Exact routes must follow the API architecture and API specifications.

---

# 23. Storefront DTOs

Use public-facing DTOs rather than internal database records.

Examples:

```text
StorefrontSummary
PublicProduct
PublicProductVariant
PublicProductImage
PublicStoreConfiguration
StorefrontCart
```

DTOs should contain only information required by the client.

---

# 24. Product Slugs

Public Product URLs should preferably use stable human-readable slugs.

Example:

```text
/products/blue-running-shoes
```

Slug resolution must remain Store-scoped.

A Product slug in Store A must never resolve to Store B's Product.

---

# 25. Store Slugs

Storefront URLs may use Store slugs.

Example:

```text
/store/my-store/products/blue-running-shoes
```

The Demo may later support:

```text
shop.example.com
custom-domain.com
```

without requiring Storefront business logic to be rewritten.

---

# 26. Storefront Rendering

The Demo can use Next.js server rendering/server components where appropriate.

Public catalog pages should favor server-side data retrieval where this improves:

- Initial load.
- SEO.
- Public page rendering.
- Reduced client-side data fetching.

Interactive commerce actions may use client-side components where needed.

---

# 27. Server/Client Boundary

Keep business-critical logic on the server.

Client components may handle:

```text
Variant selection
Quantity controls
Cart interactions
UI state
Loading states
```

Server-side application services must handle:

```text
Authorization
Store resolution
Product validation
Cart mutation
Checkout creation
Price validation
Inventory validation
```

---

# 28. Storefront Caching

Caching must not compromise commerce correctness.

Safe candidates include:

```text
Public Store configuration
Published product catalog reads
Public product images
Non-critical presentation data
```

Do not cache authoritative mutable operations such as:

```text
Cart mutation
Checkout completion
Payment state
Inventory reservation
Order creation
```

without explicit consistency guarantees.

---

# 29. Cache Invalidation

If public Product data is cached, changes such as:

```text
Product publication
Product unpublication
Price changes
Product updates
```

must eventually invalidate or bypass stale data according to the caching strategy.

For the Demo, conservative caching is preferable to introducing unnecessary infrastructure.

---

# 30. Media Integration

Product images should be retrieved through the Media domain.

Storefront should not know how binary objects are stored.

Flow:

```text
Product
   ↓
Media Reference
   ↓
Media Access Layer
   ↓
Public Media URL
```

Private media must not become publicly accessible through accidental URL exposure.

---

# 31. Storefront Search

The Demo does not require a dedicated search engine.

Basic filtering/query capabilities may use PostgreSQL.

For example:

```text
category
status
price range
basic text matching
```

Only required functionality should be implemented.

A dedicated search system can be introduced later without changing the Storefront's public business interface.

---

# 32. Pagination

Public Product listings must use bounded pagination.

Requirements:

```text
Maximum page size
Stable ordering
Deterministic results
Store-scoped filtering
```

Never expose an unbounded catalog query.

---

# 33. Error Handling

Use the platform's standard API error format.

Examples:

```text
STORE_NOT_FOUND
STORE_UNAVAILABLE
PRODUCT_NOT_FOUND
VARIANT_NOT_FOUND
PRODUCT_NOT_PUBLISHED
INVALID_QUANTITY
CART_NOT_FOUND
CHECKOUT_NOT_AVAILABLE
```

Do not expose internal database errors.

---

# 34. Tenant Isolation

Every Storefront query must be Store-scoped.

For example:

```text
findPublishedProduct(storeId, slug)
```

rather than:

```text
findPublishedProduct(slug)
```

Store resolution establishes the tenant boundary before querying Store-owned resources.

---

# 35. Public Access Security

Public Storefront endpoints still require security controls.

Protect against:

```text
Cross-store data access
Object ID manipulation
Cart ownership manipulation
Excessive request rates
Invalid quantities
Unpublished product access
Internal data exposure
```

Rate limiting can remain simple for the Demo and become more sophisticated later.

---

# 36. Customer Authentication

Storefront browsing should not require authentication.

Customer authentication becomes relevant for:

```text
Customer account
Persistent cart
Order history
Account information
```

Guest shopping should remain possible where supported.

---

# 37. Storefront to Customer Integration

When an authenticated customer is present:

```text
Request
 ↓
Auth Context
 ↓
Customer Context
 ↓
Store Context
 ↓
Cart/Checkout
```

Authentication and Customer identity must remain separate concerns.

---

# 38. Storefront Events

The Storefront itself should not become an event-processing layer.

Business events originate from the owning domain.

For example:

```text
ProductPublished
CartCreated
CheckoutCreated
OrderCreated
```

are emitted by their respective domains.

---

# 39. Storefront Observability

Useful request fields include:

```text
storeId
productId
variantId
cartId
checkoutId
customerId where appropriate
requestId
```

Public requests should be observable without logging sensitive customer or payment data.

---

# 40. Storefront Tests

Unit tests should cover:

```text
[ ] Store resolution
[ ] Store availability
[ ] Product visibility
[ ] Product slug resolution
[ ] Variant validation
[ ] Public DTO mapping
[ ] Pagination
[ ] Public error mapping
```

---

# 41. Integration Tests

Verify:

```text
[ ] Storefront → Store
[ ] Storefront → Products
[ ] Storefront → Media
[ ] Storefront → Cart
[ ] Storefront → Checkout
[ ] Storefront → Customer
[ ] Cross-store isolation
[ ] Published/unpublished visibility
```

---

# 42. E2E Tests

The Demo should verify the complete customer journey:

```text
Open Storefront
      ↓
Browse Products
      ↓
Open Product
      ↓
Select Variant
      ↓
Add to Cart
      ↓
Open Cart
      ↓
Start Checkout
      ↓
Complete Test Payment
      ↓
Receive Order
```

This is one of the primary Demo acceptance paths.

---

# 43. Storefront Failure Tests

Verify:

```text
[ ] Store unavailable
[ ] Product unpublished during browsing
[ ] Variant unavailable
[ ] Invalid quantity
[ ] Cart expired
[ ] Checkout creation failure
[ ] Inventory unavailable during Checkout
[ ] Payment failure
```

The UI should show safe user-facing errors without exposing internal implementation details.

---

# 44. Implementation Sequence

Implement Storefront in this order:

```text
1. Define Storefront application interfaces
2. Implement Store resolution
3. Implement public Store configuration
4. Implement Product catalog queries
5. Implement Product detail queries
6. Implement Variant resolution
7. Implement public DTOs
8. Implement pagination
9. Implement Media integration
10. Implement Cart entry points
11. Implement guest Cart support
12. Implement authenticated Cart support
13. Implement Checkout entry point
14. Implement Storefront APIs
15. Implement public pages
16. Implement caching only where justified
17. Implement error handling
18. Add unit tests
19. Add integration tests
20. Add E2E customer journey
21. Verify cross-tenant isolation
22. Verify public data exposure
```

---

# 45. Definition of Done

Storefront implementation is complete when:

```text
[ ] Store resolution works
[ ] Store availability is enforced
[ ] Public Store configuration works
[ ] Published Products are visible
[ ] Unpublished Products are hidden
[ ] Product detail works
[ ] Variant selection works
[ ] Product pricing is displayed correctly
[ ] Media integration works
[ ] Pagination works
[ ] Guest Cart works where supported
[ ] Customer Cart works
[ ] Add-to-Cart works
[ ] Checkout entry works
[ ] Public APIs work
[ ] Public DTOs do not leak internal data
[ ] Tenant isolation works
[ ] Public access security works
[ ] Error handling is consistent
[ ] Unit tests pass
[ ] Integration tests pass
[ ] E2E purchase journey passes
[ ] Cross-store access tests pass
```

The Storefront is the public face of the platform, but it is not the authority for commerce rules. It presents the catalog and starts the journey; Products, Inventory, Checkout, Payments, and Orders remain responsible for deciding what is actually allowed.