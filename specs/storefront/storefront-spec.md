# Storefront Specification

## 1. Purpose

This specification defines the functional and technical requirements for the Storefront domain of the Demo commerce platform.

The Storefront is the customer-facing shopping experience through which users can:

- Discover a Store
- Browse products
- View product details
- Select variants
- Add products to a Cart
- Manage a Cart
- Begin Checkout
- Complete a purchase
- View appropriate order information

The Storefront is primarily a presentation and orchestration layer.

It does not own:

- Product catalog data
- Inventory
- Customers
- Carts
- Discounts
- Checkout
- Payments
- Orders

Those domains remain authoritative for their respective business data.

---

# 2. Scope

The Demo Storefront supports:

- Store resolution
- Store availability
- Store configuration
- Product listing
- Product detail pages
- Variant selection
- Basic product filtering
- Product availability display
- Cart interaction
- Checkout initiation
- Customer authentication
- Guest shopping
- Customer order access
- Basic responsive UI
- Store-specific branding/configuration

---

# 3. Out of Scope

Demo does not require:

- Advanced theme marketplace
- Drag-and-drop page builder
- Headless storefront management
- Advanced search engine
- Product recommendation engine
- Personalization engine
- A/B testing
- Advanced SEO platform
- Multi-language storefront management
- Multi-currency storefront
- Real-time personalization
- Advanced merchandising
- Marketplace storefronts
- POS storefront
- Mobile native application

These may be introduced later.

---

# 4. Storefront Architecture

The Storefront should use the public interfaces of the commerce domains.

Conceptually:

```text id="y6p3m8"
Customer Browser
      ↓
Storefront UI
      ↓
Application/API Layer
      ↓
Domain Interfaces
      ├── Stores
      ├── Products
      ├── Inventory
      ├── Customers
      ├── Carts
      ├── Discounts
      ├── Checkout
      ├── Payments
      └── Orders
```

The UI must not directly access another module's internal database tables.

---

# 5. Store Resolution

A Storefront request must resolve the correct Store.

Demo may use:

- subdomain
- configured hostname
- development store identifier
- route-based store resolution where necessary

Example:

```text id="k4m8p2"
shop.example.com
      ↓
Store resolution
      ↓
Store ID
```

---

# 6. Store Isolation

Every Storefront request must operate within exactly one Store context.

The server must establish:

```text id="n7q3r5"
store_id
```

before executing store-specific business operations.

Client-provided store identifiers must not override trusted host or server-side context where a canonical Storefront URL exists.

---

# 7. Store Availability

Before serving a Storefront, the platform should verify:

```text id="v5m9c2"
Store exists
+
Store is ACTIVE
```

Suspended or archived stores must not operate as normal customer storefronts.

---

# 8. Store Configuration

The Storefront may consume store configuration such as:

- store name
- logo
- primary branding
- locale
- currency
- timezone
- storefront status
- basic contact information

Configuration is owned by the Stores domain.

---

# 9. Storefront Home Page

The storefront home page may display:

- Store branding
- Featured products
- Product categories where supported
- Basic promotional content
- Navigation
- Cart access
- Customer account access

Demo does not require a full page-builder system.

---

# 10. Product Listing

Customers should be able to browse products available in the Store.

Conceptually:

```text id="x8p4m6"
GET /storefront/products
```

The response should contain only products appropriate for public storefront visibility.

---

# 11. Product Visibility

A product should normally appear publicly only when:

```text id="q5n7r2"
Product = ACTIVE
```

and the Store is active.

Draft and archived products must not be publicly exposed unless an explicit preview mechanism exists.

---

# 12. Product Listing Data

The Storefront product DTO may contain:

- product ID
- product name
- slug
- short description
- primary image
- starting price where applicable
- available variants
- availability status

Internal product management fields should not automatically be exposed.

---

# 13. Product Detail

A product detail page may display:

- product name
- description
- images
- variants
- SKU where appropriate
- price
- availability
- basic product metadata

The Storefront should retrieve this information through the Products module's public interface.

---

# 14. Product Slugs

Public product URLs should use stable store-scoped slugs.

Example:

```text id="j6q3v8"
shop.example.com/products/blue-shirt
```

The server must resolve:

```text id="r4m8p2"
Store
+
slug
```

rather than treating the slug as globally unique across all Stores.

---

# 15. Variant Selection

If a Product contains multiple variants, the customer must be able to select the desired variant.

Example:

```text id="m7k5n3"
Product
 ├── Small / Black
 ├── Medium / Black
 └── Large / Black
```

The selected Variant becomes the item added to the Cart.

---

# 16. Variant Availability

The Storefront may display availability based on Inventory information.

However:

```text id="v9q4m6"
Displayed availability
≠
guaranteed inventory reservation
```

Final availability is validated by Checkout and Inventory.

---

# 17. Add to Cart

The Storefront sends:

```text id="p8r3k7"
productVariantId
quantity
```

to the Cart application interface.

The Storefront must not send authoritative:

- price
- discount
- subtotal
- tax
- inventory quantity

---

# 18. Cart Creation

If the customer has no active cart:

```text id="x5m2q8"
Add Product
    ↓
Create Cart
    ↓
Add Item
```

If an active cart already exists:

```text id="c7n4p3"
Add Product
    ↓
Existing Cart
    ↓
Add/Update Item
```

---

# 19. Cart Display

The Storefront cart page may display:

- products
- variants
- quantities
- unit prices
- line totals
- subtotal
- discount
- estimated total

The server remains authoritative for all monetary values.

---

# 20. Cart Quantity Updates

Customers may update quantities.

The Storefront sends the requested quantity to the Cart application service.

The server validates:

- cart ownership
- product variant
- quantity
- cart state

---

# 21. Cart Removal

Customers may remove individual items.

The Storefront must use the Cart public interface.

It must not directly delete CartItem database records.

---

# 22. Discount Codes

The Storefront may provide a discount-code input.

Conceptually:

```text id="m3v7q9"
Customer enters code
      ↓
Cart / Checkout application service
      ↓
Discount validation
      ↓
Updated displayed total
```

The client must never calculate the final discount independently.

---

# 23. Discount Revalidation

A discount displayed as valid on the Storefront may become invalid before payment.

Checkout must revalidate it.

Therefore, the Storefront should be prepared to display:

- discount removed
- discount changed
- minimum order requirement
- expired code
- usage limit reached

---

# 24. Customer Authentication

The Storefront supports:

- guest browsing
- guest cart
- guest checkout
- registered customer accounts

Authentication is handled by the Auth package.

The Storefront must not implement its own authentication system.

---

# 25. Customer Account

Authenticated customers may access:

- profile
- addresses where supported
- active cart
- order history
- order details

Customer data remains owned by the Customers domain.

---

# 26. Guest Shopping

Guests may:

- browse products
- add products to cart
- modify their cart
- begin checkout
- complete a purchase where payment requirements allow

Guest access must remain isolated from other users.

---

# 27. Guest Cart Security

Guest cart identifiers or tokens must be sufficiently unpredictable.

A user must not be able to enumerate another guest's cart.

---

# 28. Checkout Initiation

The Storefront initiates Checkout from the active Cart.

Conceptually:

```text id="q9k4m7"
Cart
 ↓
Create Checkout
 ↓
Checkout Page
```

The Storefront must not construct a payment amount independently.

---

# 29. Checkout UI

The Checkout experience may collect:

- contact information
- shipping address
- billing address
- payment method
- discount code
- order review

The exact UI can evolve without changing domain ownership.

---

# 30. Checkout Summary

Before payment, the Storefront should display the server-calculated:

- items
- quantities
- subtotal
- discount
- shipping
- tax
- total
- currency

The customer should be able to verify the final purchase amount before payment.

---

# 31. Price Changes During Checkout

If the final server calculation differs from what the customer previously saw, the Storefront must not silently submit a different amount for payment.

Instead, it should display the updated total and require appropriate confirmation.

---

# 32. Payment UI

The Storefront should use the payment provider's secure integration mechanism.

The application must avoid handling raw sensitive payment credentials whenever the provider supports hosted or tokenized payment collection.

---

# 33. Payment Result

The Storefront should handle:

```text id="x3m7p8"
SUCCESS
FAILED
PENDING
REQUIRES_ACTION
```

without assuming that a frontend callback alone proves payment success.

The server remains authoritative.

---

# 34. Payment Completion

After payment succeeds:

```text id="n6r2q5"
Payment
 ↓
Checkout
 ↓
Order
 ↓
Confirmation Page
```

The Storefront should retrieve the authoritative Order state from the server.

---

# 35. Order Confirmation

The confirmation page may display:

- order number
- order date
- purchased items
- quantities
- totals
- payment status
- shipping address where appropriate
- order status

Sensitive internal payment/provider data must not be exposed.

---

# 36. Order Lookup

Customers should retrieve orders through authenticated ownership or a secure guest-order mechanism.

The Storefront must not rely solely on a sequential order number for authorization.

---

# 37. Order History

Registered customers may see:

```text id="f8m4r7"
Order number
Date
Status
Total
```

Selecting an order opens the appropriate order details.

---

# 38. Product Availability

Storefront availability should be informative rather than authoritative.

Possible states:

```text id="v7q3n8"
AVAILABLE
LOW_STOCK
OUT_OF_STOCK
UNAVAILABLE
```

The exact display rules may evolve.

---

# 39. Inventory Race Conditions

A product may appear available to multiple customers simultaneously.

The Storefront must not attempt to solve this by maintaining its own stock counter.

Checkout and Inventory provide the authoritative concurrency-safe behavior.

---

# 40. Storefront Caching

Public catalog data may be cached where safe.

Examples:

- product details
- product listing
- store configuration

Highly mutable data should not be cached aggressively.

Examples:

- cart state
- checkout state
- payment state
- inventory reservation state
- order state

---

# 41. Cache Invalidation

If caching is introduced, the application must define invalidation or short-lived freshness rules.

Demo should prefer simple caching strategies over complex distributed cache infrastructure.

---

# 42. SEO Basics

Demo may support basic SEO requirements:

- product metadata
- page titles
- descriptions
- canonical URLs
- sitemap generation where practical

A dedicated SEO platform is outside scope.

---

# 43. Public URLs

Storefront URLs should be:

- stable
- human-readable
- store-scoped
- safe to expose publicly

Internal database IDs should not be unnecessarily exposed in user-facing URLs.

---

# 44. Storefront Routing

Conceptually:

```text id="k8p4r2"
/
├── products
│   └── [slug]
├── cart
├── checkout
├── account
│   └── orders
└── order
    └── [orderNumber]
```

The exact Next.js routing structure may evolve.

---

# 45. Server and Client Responsibilities

Server-side responsibilities include:

- authentication
- authorization
- Store resolution
- product visibility
- pricing
- discount validation
- inventory validation
- checkout creation
- payment verification
- order retrieval

Client-side responsibilities include:

- rendering
- interaction
- form handling
- loading states
- user feedback
- navigation

The browser is not a trusted business-logic boundary.

---

# 46. Storefront API Boundary

The Storefront should consume explicit application/API contracts.

It must not:

- import another module's internal repository
- query another module's tables directly
- calculate authoritative financial values
- mutate inventory directly
- mutate order state directly
- call payment providers directly

---

# 47. API Errors

Storefront APIs should expose stable error codes such as:

```text id="p5m8q3"
STORE_NOT_FOUND
STORE_UNAVAILABLE
PRODUCT_NOT_FOUND
PRODUCT_UNAVAILABLE
VARIANT_NOT_FOUND
VARIANT_UNAVAILABLE
CART_NOT_FOUND
CART_ACCESS_DENIED
INVALID_QUANTITY
CHECKOUT_NOT_AVAILABLE
CHECKOUT_EXPIRED
PAYMENT_FAILED
ORDER_NOT_FOUND
ORDER_ACCESS_DENIED
```

The UI should translate these into customer-friendly messages.

---

# 48. Loading States

The Storefront must handle:

- product loading
- cart loading
- checkout loading
- payment processing
- order loading

The UI must prevent accidental duplicate submission during critical operations.

---

# 49. Duplicate Submission Prevention

For actions such as:

- Add to cart
- Create checkout
- Submit payment
- Complete purchase

the UI should prevent obvious duplicate clicks.

Server-side idempotency remains mandatory because client-side prevention is not sufficient.

---

# 50. Responsive Design

The Storefront should work across:

- desktop
- tablet
- mobile

Demo does not require a separate native mobile application.

---

# 51. Accessibility

The Storefront should provide basic accessibility support:

- semantic HTML
- keyboard navigation
- visible focus states
- form labels
- accessible errors
- meaningful buttons
- appropriate image alternatives

---

# 52. Store Branding

The Storefront may consume basic Store branding:

- logo
- store name
- theme colors
- typography settings where supported

Demo should avoid building a general-purpose visual page builder.

---

# 53. Product Media

Product images are served through the Product Media abstraction and object storage/CDN where configured.

The Storefront should not expose internal storage credentials.

---

# 54. Media Loading

The UI should:

- use optimized image sizes
- provide appropriate loading states
- avoid unnecessarily loading all product media
- handle missing media gracefully

---

# 55. Storefront Performance

Common public requests should be optimized:

- store resolution
- product listing
- product detail
- cart retrieval

Demo should rely on:

- PostgreSQL indexes
- Next.js rendering strategies
- appropriate caching
- object storage/CDN for media

A dedicated search cluster is not required.

---

# 56. Product Filtering

Demo may support basic filtering such as:

- category where implemented
- price range
- availability

Filtering should be database-backed.

Advanced faceted search is outside Demo scope.

---

# 57. Product Sorting

Basic sorting may include:

- newest
- price ascending
- price descending
- name

Sorting must be deterministic.

---

# 58. Search

Demo does not require a dedicated search engine.

If basic product search is required, PostgreSQL-backed search may be used initially.

A dedicated search service should only be introduced when real scale or functionality requires it.

---

# 59. Storefront Security

The Storefront must protect against:

- cross-store data access
- IDOR
- client-controlled pricing
- unauthorized order access
- cart theft
- checkout tampering
- XSS
- CSRF where applicable
- injection attacks
- unsafe file/media handling
- abusive requests

---

# 60. Authentication Security

Authentication state must be managed through the platform's approved authentication mechanism.

The Storefront must not:

- store passwords in browser storage
- expose authentication secrets
- trust arbitrary user IDs
- implement custom password verification outside Auth

---

# 61. Authorization

Storefront authorization should be enforced server-side.

Examples:

```text id="w6q2m9"
Customer A → Order A → Allowed
Customer A → Order B → Rejected
Store A → Product A → Allowed
Store B → Product A → Rejected
```

---

# 62. Tenant Context

Every Storefront operation involving store-owned data must execute with a validated tenant context.

Conceptually:

```text id="r3m7p5"
Request
 ↓
Resolve Store
 ↓
Tenant Context
 ↓
Application Service
```

The UI must not be responsible for enforcing tenant isolation.

---

# 63. Observability

Storefront requests should include structured metadata such as:

```text id="n8k4q6"
request_id
store_id
route
operation
status
duration
error_code
```

Customer-sensitive information should be minimized in logs.

---

# 64. Metrics

Useful Storefront metrics include:

- page response time
- product page latency
- cart operation latency
- checkout initiation rate
- checkout failure rate
- payment initiation failures
- storefront error rate

Demo monitoring should remain lightweight.

---

# 65. Testing Requirements

Unit tests should cover:

- Store resolution
- product visibility
- variant selection
- cart interaction
- API error mapping
- checkout initiation
- order access rules

---

# 66. Integration Tests

Integration tests should cover:

- Store isolation
- Product retrieval
- Cart operations
- Customer ownership
- Checkout creation
- Payment flow
- Order retrieval
- API validation

---

# 67. E2E Storefront Test

A complete E2E scenario should verify:

```text id="v5q8m3"
Open Store
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
Update Quantity
 ↓
Checkout
 ↓
Enter Information
 ↓
Apply Discount
 ↓
Payment
 ↓
Order Confirmation
 ↓
View Order
```

---

# 68. Guest E2E Flow

The Demo should also test:

```text id="j7m4p2"
Guest
 ↓
Browse
 ↓
Cart
 ↓
Checkout
 ↓
Payment
 ↓
Order
```

No registered Customer account should be required unless the chosen payment flow requires it.

---

# 69. Failure E2E Flow

The Storefront should correctly display:

```text id="c6n9r4"
Out of stock
Payment failed
Discount invalid
Checkout expired
Order unavailable
```

without exposing internal stack traces or sensitive implementation details.

---

# 70. Demo Implementation Boundary

The Storefront implementation should primarily use:

```text id="x4p7m2"
apps/web
modules/stores
modules/products
modules/carts
modules/customers
modules/discounts
modules/checkout
modules/payments
modules/orders
packages/auth
packages/tenant
packages/types
packages/ui
packages/validation
```

The Storefront is an application-facing layer, not a replacement for the underlying domain modules.

---

# 71. Demo-to-V1 Evolution

The Storefront architecture should allow future capabilities such as:

- advanced themes
- custom storefront domains
- headless storefront APIs
- dedicated search
- recommendation systems
- personalization
- advanced SEO
- multi-language storefronts
- multi-currency support
- storefront analytics
- CDN-heavy global delivery

These should extend the current Storefront boundary without forcing changes to core commerce invariants.

---

# 72. Anti-Patterns

Do not:

- calculate final prices in the browser
- trust browser inventory counts
- access module tables directly
- allow the browser to determine Store ownership
- expose internal payment provider details
- expose arbitrary customer orders
- let frontend state determine payment success
- create orders directly from the UI
- implement authentication separately inside Storefront
- build a dedicated search service for Demo without need
- build a separate storefront application before the architecture requires it

---

# 73. Acceptance Criteria

The Storefront module is complete for Demo when:

- A Store can be resolved and displayed publicly.
- Only active Stores are publicly accessible.
- Public products are correctly filtered by Store and product status.
- Product detail pages work.
- Variant selection works.
- Customers can add products to carts.
- Cart operations use the Carts domain.
- Prices are server-authoritative.
- Discount validation uses the Discounts domain.
- Checkout is created through the Checkout domain.
- Payment is handled through the Payments domain.
- Orders are retrieved through the Orders domain.
- Guest shopping works.
- Registered customer shopping works.
- Customer order access is isolated.
- Cross-store access is rejected.
- Duplicate critical submissions are safely handled.
- Responsive behavior works on desktop and mobile.
- Basic accessibility requirements are satisfied.
- Product media loads through the approved media architecture.
- Storefront errors are customer-safe.
- Integration and E2E tests cover the complete shopping lifecycle.