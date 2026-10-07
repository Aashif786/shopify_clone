# Storefront Implementation Specification

## 1. Purpose

This document defines the implementation requirements for the **Storefront** domain of the Shopify-like commerce platform.

The Storefront provides the customer-facing shopping experience for a Store. It exposes published products, product details, collections where supported, store configuration, and the entry points required for Cart and Checkout.

The Storefront is presentation-oriented, but it must still enforce server-side tenant isolation, product visibility, pricing correctness, and authorization boundaries.

---

## 2. Scope

The Storefront owns:

- Public Storefront resolution.
- Storefront availability.
- Published product discovery.
- Product detail presentation.
- Product listing.
- Product filtering supported by the Demo.
- Product sorting supported by the Demo.
- Storefront product visibility rules.
- Public Store configuration required for rendering.
- Customer-facing Cart integration.
- Customer-facing Checkout entry points.

The Storefront does not own:

- Product catalog state.
- Inventory.
- Cart state.
- Checkout.
- Payments.
- Orders.
- Customers.
- Discounts.

Those domains remain authoritative for their respective business rules.

---

## 3. Domain Position

The Storefront sits at the customer-facing boundary:

```text id="g8m2q4"
Customer
   ↓
Storefront
   ↓
Store
   ├── Published Products
   ├── Product Variants
   └── Store Configuration
         ↓
Cart
         ↓
Checkout
```

---

## 4. Module Location

Implementation belongs under:

```text id="v3x7n1"
modules/storefront/
```

Recommended structure:

```text id="m8q4c2"
modules/storefront/
├── application/
├── domain/
├── infrastructure/
└── index.ts
```

The Storefront module should expose public application/query interfaces for customer-facing operations.

---

## 5. Layer Responsibilities

### Presentation

Responsible for:

- Next.js pages/routes.
- Request handling.
- Storefront rendering.
- Public URL resolution.
- Input validation.
- DTO mapping.

### Application

Responsible for:

- Storefront queries.
- Product visibility decisions.
- Storefront configuration retrieval.
- Coordination with Products and Stores.

### Domain

Responsible for:

- Storefront availability rules.
- Public visibility rules.
- Storefront-specific presentation constraints.

### Infrastructure

Responsible for:

- PostgreSQL queries.
- Read-optimized query implementations.
- Caching where later justified.
- Persistence mapping.

---

## 6. Storefront Identity

A Storefront must resolve to exactly one Store.

The Storefront may be accessed through:

- Store slug.
- Store-specific public hostname.
- Future custom domain.

The Demo should use the simplest reliable Store resolution mechanism.

---

## 7. Store Resolution

Typical request flow:

```text id="q6n9x3"
Incoming request
      ↓
Resolve Store identifier
      ↓
Load Store
      ↓
Verify Store is publicly available
      ↓
Load Storefront data
```

The resolved Store must become part of the server-side request context.

---

## 8. Public Store Availability

A Storefront should be publicly accessible only when the Store is in an appropriate state.

For example:

```text id="k4m8p2"
ACTIVE
   ↓
Public Storefront available
```

A suspended or archived Store must not continue exposing normal customer shopping operations.

---

## 9. Storefront Configuration

The Storefront may expose public configuration such as:

- Store name.
- Logo/media references.
- Currency.
- Basic contact information.
- Store description.
- Public storefront settings.

Only explicitly public fields may be exposed.

Private merchant configuration must never be returned.

---

## 10. Product Visibility

The Storefront should display only Products that satisfy all relevant visibility conditions.

Example:

```text id="r7c3m8"
Product belongs to Store
        +
Product is ACTIVE
        +
Variant is purchasable
        ↓
Visible
```

Draft and archived Products must not appear in normal public listings.

---

## 11. Product Visibility Enforcement

Visibility must be enforced server-side.

The frontend must not receive hidden products and merely hide them using JavaScript.

The Storefront query should return only products that are publicly visible.

---

## 12. Product Ownership

Every Storefront Product query must be Store-scoped.

Example:

```text id="x5n8q2"
Store A Storefront
      ↓
Store B Product
      ↓
DENIED
```

Product IDs alone must not bypass Store resolution.

---

## 13. Product Listing

The Storefront should support a basic product listing.

Potential parameters:

```text id="p3m7c9"
page
limit
sort
status
```

Only supported public filters should be accepted.

The Storefront must use bounded pagination.

---

## 14. Pagination

Public product listings should use a predictable pagination strategy.

Cursor-based pagination is preferred when the query model supports it.

Offset pagination may be acceptable for the Demo if implemented with bounded limits and indexed queries.

---

## 15. Pagination Limits

The server must enforce a maximum page size.

Example:

```text id="n8q4x1"
requested limit = 5000
        ↓
server maximum = 100
        ↓
limit = 100
```

Clients must not be able to request unbounded datasets.

---

## 16. Product Sorting

The Demo may support simple sorting such as:

```text id="m6v2p8"
newest
oldest
price_low_to_high
price_high_to_low
name
```

Only explicitly supported sort fields should be accepted.

User-supplied database expressions must never be passed directly into queries.

---

## 17. Product Filtering

Basic filters may include:

- Product category where supported.
- Price range.
- Availability.
- Product status.

The filtering model should remain deliberately small in the Demo.

---

## 18. Search

The Demo does not require a dedicated search engine.

Basic PostgreSQL search may be used if product search is part of the Demo requirements.

A dedicated search service should be introduced only when scale or product requirements justify it.

---

## 19. Product Detail

A public Product detail query may include:

- Product name.
- Description.
- Images.
- Variants.
- Prices.
- SKU where public.
- Availability information.
- Storefront metadata.

Only public fields should be returned.

---

## 20. Variant Visibility

A Variant should be publicly selectable only when it is:

- Owned by the Product.
- Owned by the Store.
- Active/purchasable.
- Valid according to Product rules.

Inventory availability may be displayed separately from Variant identity.

---

## 21. Inventory Availability

Storefront availability must not become a second inventory authority.

The Storefront may request authoritative availability from Inventory.

For example:

```text id="c7x4m9"
Storefront
   ↓
Inventory public interface
   ↓
Current availability
```

The Storefront must never modify Inventory directly.

---

## 22. Availability Race

A product shown as available can become unavailable before checkout.

Therefore:

```text id="q8m3x6"
Storefront availability
       ≠
Guaranteed purchase availability
```

Checkout performs authoritative inventory validation and reservation.

---

## 23. Pricing

Storefront prices should come from the authoritative Product pricing model.

The Storefront must not maintain an independent price database.

---

## 24. Price Display

Prices returned to the client should include:

- Exact amount.
- Currency.
- Appropriate display representation.

The display value must be derived from the authoritative monetary amount.

---

## 25. Discounts on Storefront

The Storefront may display promotional information.

However, it must not assume that a discount applies to a particular customer or checkout unless the Discounts module validates it.

Personalized or final discount calculations belong to Cart/Checkout/Discounts.

---

## 26. Cart Integration

The Storefront provides entry points for Cart operations.

Typical flow:

```text id="w4n8m2"
Product
  ↓
Select Variant
  ↓
Add to Cart
  ↓
Cart
```

The Storefront must call the Cart public interface rather than manipulating Cart tables.

---

## 27. Cart Ownership

When a customer adds an item:

- Authenticated customers use their Customer context.
- Guests use their secure guest Cart context.

The Storefront must not trust client-supplied Customer IDs.

---

## 28. Checkout Integration

The Storefront may provide:

```text id="z5m2x8"
Cart
  ↓
Checkout
```

Checkout owns final pricing, inventory reservation, discounts, and payment orchestration.

---

## 29. Public API Surface

Potential Storefront endpoints:

```text id="r9c3m7"
GET /api/v1/storefront
GET /api/v1/storefront/products
GET /api/v1/storefront/products/{productId}
GET /api/v1/storefront/config
```

Cart and Checkout APIs remain owned by their respective modules.

---

## 30. Storefront API Resolution

The Storefront API must resolve Store context before executing a query.

Example:

```text id="x7q4p2"
Request
  ↓
Store resolver
  ↓
Store context
  ↓
Storefront query
```

The Store ID should not be accepted as an unrestricted client-controlled authorization mechanism.

---

## 31. Public Endpoint Security

Public Storefront endpoints still require:

- Input validation.
- Tenant isolation.
- Query limits.
- Abuse protection where necessary.
- Safe error responses.

Public does not mean unrestricted access to internal data.

---

## 32. Sensitive Data

Storefront responses must never expose:

- Merchant credentials.
- Internal authorization data.
- Payment credentials.
- Private customer information.
- Internal database identifiers unless intentionally public.
- Internal infrastructure details.

---

## 33. Caching

The Demo should initially rely on PostgreSQL and application-level queries without introducing complex distributed caching.

Caching may later be introduced for:

- Store configuration.
- Product listing.
- Product detail.

Cached data must never bypass Store isolation.

---

## 34. Cache Invalidation

If caching is introduced, Product and Store updates must eventually invalidate affected public data.

The system must not serve stale sensitive or unpublished data.

For the Demo, avoiding aggressive caching is preferable to introducing unreliable cache invalidation.

---

## 35. Storefront Rendering

The Next.js application may render Storefront pages using:

- Server Components.
- Server-side data fetching.
- Client Components only where interactivity requires them.

The Storefront should avoid unnecessary client-side fetching of data that can be securely resolved on the server.

---

## 36. Server vs Client Responsibilities

### Server

Owns:

- Store resolution.
- Product visibility.
- Pricing source.
- Customer context.
- Cart mutation.
- Authorization.
- Checkout initiation.

### Client

Owns:

- Presentation.
- Interaction.
- Local UI state.
- User input.

Client state must never become the authoritative commerce state.

---

## 37. SEO

The Demo may support basic SEO requirements:

- Product titles.
- Descriptions.
- Canonical URLs.
- Metadata.
- Storefront page metadata.

Advanced SEO systems are not required.

---

## 38. Product URL

Product URLs should use a stable public identifier such as a slug.

Example:

```text id="m3x8q5"
 /products/classic-shirt
```

The Storefront must still verify that the resolved Product belongs to the current Store.

---

## 39. Slug Uniqueness

Product slugs should be unique within the Store.

For example:

```text id="q7m4n9"
Store A → /products/shirt
Store B → /products/shirt
```

may be valid.

Within the same Store, the same active slug should not identify multiple Products.

---

## 40. Storefront Not Found Behavior

If a Store does not exist or is not publicly available, the Storefront should return an appropriate not-found/unavailable response.

It should not expose whether an inaccessible Store exists.

---

## 41. Product Not Found Behavior

If a Product:

- Does not exist.
- Belongs to another Store.
- Is unpublished.
- Is archived.

the Storefront should return the appropriate public not-found behavior.

This avoids leaking private catalog state.

---

## 42. Error Handling

Potential stable errors include:

```text id="x5c8m3"
STOREFRONT_NOT_FOUND
STOREFRONT_UNAVAILABLE
PRODUCT_NOT_FOUND
PRODUCT_UNAVAILABLE
INVALID_STOREFRONT_QUERY
INVALID_PAGINATION
INVALID_SORT
STORE_ACCESS_DENIED
```

Public responses should avoid exposing internal implementation details.

---

## 43. Database Queries

Storefront queries should be designed around public read patterns.

Avoid:

```text id="v8n3q5"
Load entire Product entity
   ↓
Load all Variants
   ↓
Load all Media
   ↓
Filter in JavaScript
```

Prefer targeted queries that retrieve only required public data.

---

## 44. Query Performance

Important Storefront queries should have appropriate indexes for:

- Store.
- Product status.
- Slug.
- Created date.
- Variant relationship.
- Public visibility.

Query performance should be measured rather than optimized blindly.

---

## 45. Events

The Storefront module generally consumes events rather than owning many business events.

Potential relevant events:

```text id="k4m7x2"
ProductPublished
ProductUnpublished
ProductUpdated
StoreActivated
StoreSuspended
```

These may be used later for cache invalidation or search indexing.

---

## 46. Background Jobs

The Demo should not require significant Storefront background processing.

Potential future jobs include:

- Search indexing.
- Cache warming.
- Static page generation.
- SEO metadata generation.

These are optional and should be introduced only when justified.

---

## 47. Tenant Isolation

Tenant isolation must be enforced at every Storefront query boundary.

A public URL or slug must never allow access to another Store's Product.

---

## 48. Authorization

Most Storefront reads are public.

Merchant Storefront management operations require Store authorization.

For example:

```text id="p8x3m6"
storefront.read
storefront.manage
```

where such permissions are required.

---

## 49. Rate Limiting

Basic public endpoint protection may be introduced if abuse becomes relevant.

The Demo should avoid unnecessary distributed rate-limiting infrastructure.

If rate limiting is required, it should be implemented at an appropriate edge or application boundary.

---

## 50. API Versioning

Storefront APIs follow the platform API versioning strategy:

```text id="c6m9q2"
/api/v1/storefront/...
```

Breaking changes require a versioning decision.

---

## 51. Testing Strategy

### Unit Tests

Test:

- Storefront availability.
- Product visibility.
- Query validation.
- Sorting/filter validation.
- Public data mapping.

### Integration Tests

Test:

- Store-scoped product queries.
- Published/unpublished Products.
- Product slugs.
- Variant visibility.
- Tenant isolation.
- Pagination.
- Query performance where critical.

### API Tests

Test:

- Public Storefront endpoints.
- Invalid parameters.
- Not-found behavior.
- Store isolation.
- Response schemas.

### E2E Tests

Test:

```text id="n7m3x5"
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
Start Checkout
```

---

## 52. Critical Test Cases

```text id="r5q8c3"
[ ] Active Store is publicly accessible
[ ] Suspended Store is unavailable
[ ] Archived Store is unavailable
[ ] Only published Products are visible
[ ] Draft Products are hidden
[ ] Archived Products are hidden
[ ] Product from another Store cannot be resolved
[ ] Product slug is Store-scoped
[ ] Variant belongs to current Product
[ ] Unavailable Variant is not purchasable
[ ] Storefront never exposes private merchant data
[ ] Customer data is not exposed
[ ] Client cannot override Store context
[ ] Pagination limits are enforced
[ ] Invalid sorting is rejected
[ ] Cart integration preserves Store ownership
[ ] Checkout revalidates availability
```

---

## 53. Implementation Sequence

Recommended implementation order:

```text id="m2x7q9"
1. Define Storefront domain/query model
2. Define Store resolution
3. Define public Store configuration
4. Define Product visibility rules
5. Define public Product DTOs
6. Implement Storefront repository/query layer
7. Implement Storefront application services
8. Implement Storefront APIs
9. Implement product listing
10. Implement product detail
11. Implement pagination/filtering
12. Implement Cart integration
13. Implement Checkout entry point
14. Implement Next.js Storefront pages
15. Add validation
16. Add authorization for merchant operations
17. Add unit tests
18. Add integration tests
19. Add API tests
20. Add E2E storefront-to-checkout tests
```

---

## 54. Demo Simplifications

The Demo intentionally does not require:

- Advanced theme engine.
- Theme marketplace.
- Drag-and-drop page builder.
- Multiple storefronts per Store.
- Dedicated search engine.
- CDN-based product search.
- Personalized recommendations.
- Advanced merchandising.
- Headless storefront SDK.
- Multi-region storefront infrastructure.
- Internationalization framework.
- Complex SEO automation.

The Demo should provide a real customer-facing storefront with correct commerce integration.

---

## 55. V1 Evolution

The Storefront module can later support:

- Advanced themes.
- Theme customization.
- Custom domains.
- Dedicated search.
- Product collections.
- Advanced filtering.
- Personalization.
- Recommendations.
- CDN caching.
- Multi-region storefronts.
- Internationalization.
- Advanced SEO.
- Headless commerce APIs.

These capabilities should extend the existing Storefront boundary without moving core Product, Cart, Checkout, Inventory, or Order ownership into the Storefront.

---

## 56. Definition of Done

The Storefront implementation is complete when:

```text id="x8m4q3"
[ ] Storefront module exists
[ ] Store resolution exists
[ ] Public Store availability is enforced
[ ] Public Store configuration exists
[ ] Product visibility rules exist
[ ] Only published Products are exposed
[ ] Product queries are Store-scoped
[ ] Product detail works
[ ] Variant selection works
[ ] Product listing works
[ ] Pagination exists
[ ] Filtering exists where required
[ ] Sorting exists where required
[ ] Product pricing is authoritative
[ ] Inventory availability is queried through Inventory
[ ] Cart integration exists
[ ] Checkout integration exists
[ ] Public API exists
[ ] API versioning is followed
[ ] Client cannot override tenant context
[ ] Private data is protected
[ ] Appropriate database indexes exist
[ ] Unit tests exist
[ ] Integration tests exist
[ ] API tests exist
[ ] E2E storefront flow exists
[ ] Documentation matches implementation
```