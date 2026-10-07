# Storefront Domain Build Implementation

## 1. Purpose

This document defines the concrete implementation approach for the Storefront domain in the Demo.

The Storefront is the public customer-facing commerce experience. It exposes only information and operations that are intentionally public while delegating catalog, cart, customer, checkout, and payment business rules to their owning domains.

The Storefront must provide a complete customer purchase path without becoming a second implementation of the commerce system.

---

# 2. Domain Ownership

The Storefront module owns:

- Public Store resolution.
- Public Store configuration exposure.
- Public product discovery.
- Published product presentation.
- Public catalog queries.
- Storefront-facing composition.
- Customer purchase entry points.

It does not own:

- Product persistence.
- Inventory persistence.
- Cart persistence.
- Checkout rules.
- Payment processing.
- Orders.
- Customer profiles.
- Discounts.

---

# 3. Module Location

Implementation belongs under:

```text id="x5r7m4"
modules/storefront/
```

Recommended structure:

```text id="m8q4v6"
modules/storefront/
├── domain/
├── application/
├── infrastructure/
└── index.ts
```

The exact internal structure should follow repository conventions.

---

# 4. Storefront Boundary

The public Storefront must establish a clear boundary:

```text id="q7m4r8"
Internet
   ↓
Public Storefront
   ↓
Approved application interfaces
   ↓
Domain modules
```

It must not access domain database tables directly.

---

# 5. Public Store Resolution

A customer must be able to identify a Store through an approved public identifier.

The Demo may use:

```text id="v6m5r4"
Store slug
```

or another approved public identifier.

The identifier must resolve only to a Store that is eligible for public storefront access.

---

# 6. Storefront Eligibility

Before serving a Storefront, the application should verify the Store is in an appropriate public state.

For example:

```text id="m4q8r7"
Store exists
Store is active
Storefront is enabled
```

Exact conditions follow the Stores specification.

---

# 7. Public Store Data

The Storefront should expose only explicitly public Store information.

Examples:

```text id="x8r4m6"
Store name
Store description
Public contact information
Public locale/currency
Public storefront configuration
```

Private merchant configuration must never be exposed.

---

# 8. Product Listing

The Storefront should provide published product listing functionality.

Conceptually:

```text id="q5m7r4"
Store
  ↓
Published Products
  ↓
Product Summary DTOs
```

Only products eligible for public publication should appear.

---

# 9. Product Detail

Customers should be able to retrieve a public product by its approved identifier.

The response may include:

```text id="v8m4r6"
Product name
Description
Variants
SKU where appropriate
Price
Media
Publication information
```

Do not expose internal merchant-only fields.

---

# 10. Product Eligibility

The Storefront must rely on the Products domain to determine catalog eligibility.

It must not recreate Product lifecycle logic independently.

For example:

```text id="m6q4r8"
Storefront
   ↓
Products.listPublishedProducts()
```

rather than querying the Product database directly.

---

# 11. Variant Exposure

Only purchasable/eligible Variants should be exposed for customer purchase.

The Storefront must not expose internal inventory management details.

---

# 12. Inventory Availability

If availability is displayed publicly, it should be derived through an approved Inventory interface.

The Storefront should expose only the information required by the customer experience.

Do not expose:

```text id="x7r4m5"
Internal reservation IDs
Inventory movement history
Merchant adjustment history
Other stores' stock
```

---

# 13. Availability vs Purchase Guarantee

Displayed availability is informational.

The customer must understand that actual inventory is revalidated during Checkout.

The Storefront must never promise inventory solely because a product page displayed it.

---

# 14. Pricing Display

Product prices displayed on the Storefront must originate from authoritative Product pricing.

The Storefront must not allow client-side price values to become purchase authority.

---

# 15. Money Formatting

The frontend may format prices for presentation.

The underlying API should continue using the approved exact monetary representation.

Formatting must respect the Store's configured currency/locale where supported.

---

# 16. Storefront Cart Entry

Customers should be able to:

```text id="q8m5r4"
View product
   ↓
Select Variant
   ↓
Specify quantity
   ↓
Add to Cart
```

The Storefront delegates Cart mutation to the Carts domain.

---

# 17. Add-to-Cart Request

The Storefront should send only the necessary intent:

```text id="v4r7m8"
variantId
quantity
```

It must not send authoritative:

```text id="m5q8r4"
price
subtotal
discount amount
Store ownership
inventory quantity
```

---

# 18. Cart Context

The Storefront must preserve the correct Store context when interacting with the Cart.

A Cart belonging to another Store must never be accepted merely because its ID was supplied by the browser.

---

# 19. Guest Checkout

The Demo should support the approved guest purchase flow.

The Storefront may allow:

```text id="x6r4m8"
Browse
→ Cart
→ Checkout
→ Payment
→ Order
```

without requiring a merchant account.

Customer account requirements must follow the approved product specification.

---

# 20. Customer Authentication

If customer accounts are supported, the Storefront may provide:

```text id="q7m5r4"
Sign in
Sign out
Account
Orders
Profile
```

Authentication remains owned by the Auth package.

The Storefront must not implement its own authentication mechanism.

---

# 21. Customer Context

When an authenticated customer accesses the Storefront:

```text id="v8m4r6"
Session
 ↓
User
 ↓
Customer
 ↓
Storefront/Customer operations
```

The Storefront must never infer customer identity from arbitrary request parameters.

---

# 22. Cart Retrieval

The Storefront may retrieve the active Cart for the current Store and customer/guest context.

It must not retrieve arbitrary carts by ID without ownership validation.

---

# 23. Checkout Entry

The Storefront should initiate Checkout through the Checkout application interface.

Conceptually:

```text id="m5q8r4"
Cart
 ↓
Create Checkout
 ↓
Validate contents
 ↓
Display Checkout
```

---

# 24. Checkout UI Data

The Storefront may display:

```text id="x4r7m6"
Items
Quantities
Current prices
Discount information
Subtotal
Final payable amount
Customer information
Address
Payment state
```

All authoritative values come from the Checkout application.

---

# 25. Checkout Price Changes

If Checkout detects a price change from the Cart, the Storefront must display the updated authoritative amount.

It must not continue submitting the stale amount.

---

# 26. Discount Code Entry

Customers may enter an approved discount code during Checkout.

The Storefront submits the code to the Checkout/Discounts workflow.

It does not calculate the discount locally.

---

# 27. Inventory Failure

If Checkout reports:

```text id="q8m4r5"
INVENTORY_UNAVAILABLE
```

the Storefront should clearly identify the affected purchase item where the API provides enough information.

It must not claim the order was placed.

---

# 28. Payment Flow

The Storefront initiates payment through the approved Checkout/Payments flow.

It must not communicate directly with the database to mark a payment successful.

---

# 29. Payment Status

The Storefront must represent payment state accurately.

For example:

```text id="v6r5m8"
Pending
Successful
Failed
Cancelled
```

A network timeout must not automatically be displayed as a failed payment if the backend reports an uncertain/pending state.

---

# 30. Order Confirmation

After successful purchase completion, the Storefront should show the resulting Order information.

Typical information includes:

```text id="m8q4r6"
Order number
Order status
Purchased items
Total
Customer/order information
```

The Order remains owned by the Orders domain.

---

# 31. Order Lookup Security

Customers must only be able to access their own Orders.

Do not make:

```text id="x5r7m4"
/orders/:orderId
```

publicly readable solely because the customer knows an order ID.

---

# 32. Public API Boundary

Storefront APIs should expose only public/customer-safe DTOs.

Do not reuse merchant management DTOs merely because they already exist.

Examples of separate contracts:

```text id="q7m4r8"
PublicProductDTO
PublicProductDetailsDTO
StorefrontCartDTO
CustomerCheckoutDTO
CustomerOrderDTO
```

---

# 33. API Routing

Storefront APIs should follow the approved versioned API architecture.

For example:

```text id="v4m8r6"
/api/v1/storefront/...
```

Exact route naming should follow the API contract.

---

# 34. Request Validation

All public input must be validated.

Examples:

```text id="m6q4r8"
Store identifier
Product identifier
Variant identifier
Cart identifier
Quantity
Discount code
Checkout input
Address
```

Client-provided identifiers must never be trusted as authorization.

---

# 35. Tenant Isolation

Public Storefront requests must remain Store-scoped.

A customer request must never be able to combine:

```text id="x8r5m4"
Store A
+
Store B product
+
Store C cart
```

into one valid workflow.

---

# 36. Caching

Caching may be used for safe public catalog reads where useful.

However, cache keys must include the appropriate Store/public identity.

Do not cache private customer/cart/checkout/payment data as public content.

---

# 37. Cache Invalidation

If public product or Store data is cached, changes must not leave unacceptable stale data.

The simplest Demo approach is preferred.

Do not introduce distributed cache infrastructure solely to optimize a small Demo catalog.

---

# 38. Rate Limiting

Public endpoints should have reasonable rate limiting where required.

Higher-risk endpoints include:

```text id="q5r8m4"
Login
Checkout
Payment initialization
Cart mutation
Public resource enumeration
```

The exact mechanism follows the shared API/security infrastructure.

---

# 39. Abuse Protection

The Storefront should protect against obvious abuse such as:

```text id="v7m4r6"
Unbounded pagination
Huge quantities
Oversized requests
Repeated expensive requests
Identifier enumeration
```

Validation and rate limits should work together.

---

# 40. Media

Product media should be served through the approved Media infrastructure.

The Storefront should use:

```text id="m4q8r8"
public media URLs
or
approved signed URLs
```

depending on the asset visibility.

Binary storage remains outside the Storefront module.

---

# 41. SEO

Basic SEO support may be implemented for public product/store pages where required.

The Demo does not require a complete enterprise SEO platform.

Avoid building:

```text id="x6r4m5"
complex SEO management system
dynamic content indexing service
search engine
```

without an explicit requirement.

---

# 42. Search

The Demo does not require a dedicated search engine.

Basic catalog discovery may use:

```text id="q8m5r4"
category/filtering where supported
PostgreSQL queries
pagination
```

Search infrastructure can be introduced later when scale or product requirements justify it.

---

# 43. Error Handling

Use the shared error model.

Storefront-specific examples include:

```text id="v5r7m8"
STORE_NOT_FOUND
STOREFRONT_UNAVAILABLE
PRODUCT_NOT_FOUND
PRODUCT_NOT_PUBLISHED
VARIANT_NOT_AVAILABLE
CART_NOT_FOUND
CHECKOUT_EXPIRED
PAYMENT_PENDING
```

Do not expose internal database/provider errors.

---

# 44. Error UI

The frontend should map errors into clear customer states.

Examples:

```text id="m7q4r6"
404
→ Store/product/order not found

400/422
→ Correct invalid input

409
→ Explain changed/conflicting state

Payment pending
→ Tell customer payment is still being confirmed

500/503
→ Safe retry/error state
```

---

# 45. Storefront Performance

The Storefront should avoid unnecessary server/database requests.

Prefer:

```text id="x4r8m6"
purpose-specific queries
appropriate pagination
server-side data fetching where useful
```

Do not optimize prematurely with complex infrastructure.

---

# 46. Client State

Client-side state may manage:

```text id="q6m5r8"
UI state
temporary form values
loading state
presentation state
```

It must not become the authoritative source for:

```text id="v7r4m6"
Price
Inventory
Payment status
Order status
Discount validity
```

---

# 47. Security Headers

The Storefront should inherit the approved web security configuration.

Where applicable:

```text id="m8q4r5"
Content Security Policy
Secure cookies
CSRF protection
CORS policy
Clickjacking protection
Content type protection
```

The exact configuration belongs to the shared web/security layer.

---

# 48. Testing Strategy

### Unit Tests

Test:

```text id="x5r8m4"
Storefront eligibility
Public DTO mapping
Public product filtering
Presentation logic
```

### Integration Tests

Test:

```text id="q7m4r6"
Store resolution
Published products
Cart integration
Checkout integration
Customer access
Order access
```

### End-to-End Tests

The Storefront must support the complete:

```text id="v6m4r8"
Browse
→ Product
→ Cart
→ Checkout
→ Payment
→ Order confirmation
```

flow.

---

# 49. Security Tests

At minimum verify:

```text id="m5q8r4"
[ ] Private Store configuration is not public
[ ] Draft products are not public
[ ] Unpublished products are not public
[ ] Store A cannot access Store B resources
[ ] Customer A cannot access Customer B orders
[ ] Client cannot submit authoritative prices
[ ] Client cannot mark payment successful
[ ] Client cannot bypass Checkout
[ ] Unbounded resource enumeration is prevented
```

---

# 50. Implementation Order

Implement Storefront in this order:

```text id="x8r5m4"
1. Public Store resolution
2. Public Store DTO
3. Published Product queries
4. Product detail
5. Variant/public pricing presentation
6. Media integration
7. Guest cart integration
8. Customer cart integration
9. Checkout integration
10. Discount code integration
11. Payment integration
12. Order confirmation
13. Customer order access
14. API routes
15. Error/UI states
16. Caching where justified
17. Unit tests
18. Integration tests
19. End-to-end purchase tests
20. Security verification
```

---

# 51. AI Implementation Rules

AI agents implementing Storefront must:

1. Read the actual root `AGENTS.md`.
2. Read Storefront, Products, Carts, Checkout, Payments, Orders, Auth, and Security specifications.
3. Keep the Storefront as a consumer/composition layer.
4. Never duplicate Product, Cart, Checkout, Payment, or Order business logic.
5. Never trust client-side totals or status.
6. Never expose merchant/private DTOs publicly.
7. Preserve Store and customer isolation.
8. Avoid introducing a search engine or unnecessary caching infrastructure.
9. Test the complete customer purchase flow.
10. Review public data exposure before completion.

---

# 52. Definition of Done

Storefront implementation is complete when:

```text id="q5m8r4"
[ ] Public Store resolution works
[ ] Store eligibility is enforced
[ ] Public Store configuration is safe
[ ] Published Products are displayed
[ ] Unpublished Products remain private
[ ] Product details work
[ ] Variant selection works
[ ] Public pricing is correct
[ ] Product media works
[ ] Guest carts work
[ ] Customer carts work
[ ] Checkout integration works
[ ] Discount code flow works
[ ] Payment flow works
[ ] Payment pending state is handled correctly
[ ] Order confirmation works
[ ] Customer Order access is protected
[ ] Public APIs use explicit DTOs
[ ] Tenant isolation is enforced
[ ] Rate/abuse protections are active
[ ] Security headers are applied
[ ] Unit tests pass
[ ] Integration tests pass
[ ] End-to-end purchase tests pass
[ ] Security tests pass
[ ] TypeScript passes
[ ] Lint passes
```

---

# 53. Final Principle

The Storefront is the **public face of the commerce platform, not the owner of commerce logic**.

Its responsibility is to compose trusted capabilities:

```text id="m7q4r8"
Products
   ↓
Cart
   ↓
Checkout
   ↓
Payment
   ↓
Order
```

while ensuring that customers see only what they are allowed to see and that every authoritative decision comes from the appropriate backend domain.

A beautiful storefront with client-side prices, fake payment states, and unrestricted order IDs is not a commerce platform. It is a very attractive security incident waiting for production.