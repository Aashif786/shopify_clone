# Storefront Purchase Vertical Slice Build Implementation

## 1. Purpose

This document defines the implementation of the Storefront Purchase vertical slice for the Demo.

This slice connects the public customer-facing storefront to the complete purchasing lifecycle:

```text id="4d7kq2"
Storefront
   ↓
Product Discovery
   ↓
Product Detail
   ↓
Cart
   ↓
Checkout
   ↓
Payment
   ↓
Order Confirmation
```

The Storefront provides the customer experience, while business domains remain responsible for their own rules and authoritative state.

---

# 2. Slice Objective

The completed slice must allow a customer to:

- Resolve a public Store.
- View the Storefront.
- Browse published Products.
- Open Product details.
- Select a purchasable Variant.
- Add the Variant to Cart.
- View and update the Cart.
- Enter Checkout.
- Review authoritative pricing.
- Apply a valid Discount.
- Complete a sandbox/test Payment.
- Receive an Order confirmation.
- View the resulting Order where supported.

---

# 3. Dependencies

This slice depends on:

```text id="w7r4m8"
Stores
Products
Inventory
Customers
Carts
Discounts
Checkout
Payments
Orders
Authentication
Tenant context
API
Validation/errors
Media
Notifications
Observability
Jobs
```

The Storefront must consume approved public interfaces rather than bypassing module boundaries.

---

# 4. Storefront Responsibility

The Storefront owns the customer-facing presentation and public access flow.

It is responsible for:

```text id="m5q8r4"
Public Store resolution
Public Store configuration
Published Product presentation
Catalog browsing
Product detail presentation
Cart entry points
Checkout entry points
Order confirmation presentation
```

It does not own:

```text id="x6r4m7"
Product persistence
Inventory authority
Cart business rules
Discount calculation
Payment state
Order creation
```

---

# 5. Public Store Resolution

A customer must first resolve the Store being visited.

The Store may be identified through an approved public identifier such as:

```text id="q8m4r5"
Store slug
```

The server must resolve:

```text id="v7r5m4"
Public identifier
   ↓
Store
   ↓
Store public eligibility
```

---

# 6. Store Eligibility

A Store should be publicly accessible only when its lifecycle and publication configuration allow it.

For example:

```text id="m4q7r8"
ACTIVE + PUBLIC
```

may be eligible.

A disabled, suspended, or otherwise unavailable Store must not expose its customer-facing commerce experience.

The exact lifecycle follows the Stores specification.

---

# 7. Public Store Configuration

The Storefront may expose approved configuration such as:

```text id="x5r8m6"
Store name
Logo
Description
Currency
Contact information
Basic storefront configuration
```

Only explicitly public fields should be returned.

---

# 8. Public DTOs

Storefront responses must use public DTOs.

Do not reuse merchant/admin DTOs simply because they already exist.

Example:

```text id="q7m4r5"
PublicStoreDTO
PublicProductDTO
PublicVariantDTO
PublicMediaDTO
```

This prevents accidental exposure of internal fields.

---

# 9. Product Listing

The Storefront should display Products that satisfy the public publication rules.

The query must enforce:

```text id="v6r8m4"
Correct Store
+
Published Product
+
Purchasable/visible state
```

Draft Products must never appear in the public catalog.

---

# 10. Product Detail

A Product detail page may display:

```text id="m8q4r5"
Product name
Description
Variants
Prices
SKU where appropriate
Media
Availability information
```

Only customer-safe information should be exposed.

---

# 11. Product Availability

Storefront availability information is informational.

For example:

```text id="x4r7m6"
In stock
Limited
Out of stock
```

may be shown where supported.

The Storefront must never treat displayed availability as an authoritative reservation.

Checkout performs the final Inventory validation.

---

# 12. Product Variant Selection

The customer must select a valid Variant where the Product has multiple Variants.

The server must validate:

```text id="q5m8r4"
Variant belongs to Product
Variant belongs to Store
Variant is purchasable
```

The client cannot submit an arbitrary Variant belonging to another Store.

---

# 13. Catalog Pagination

Product listing endpoints must use the approved pagination strategy.

Do not retrieve the entire catalog into memory.

Use stable ordering.

Example:

```text id="v7m4r6"
Published products
+
createdAt / approved catalog ordering
+
stable identifier
```

---

# 14. Catalog Filtering

The Demo may support simple filtering such as:

```text id="m6q4r8"
Product status
Basic category/filter if implemented
Price range if required
```

Do not introduce a dedicated search engine.

Complex faceted search remains outside the Demo scope.

---

# 15. Catalog Sorting

Supported sorting should be explicit and validated.

Examples may include:

```text id="x8r5m4"
Newest
Price ascending
Price descending
Name
```

Only supported fields should be accepted.

Do not expose arbitrary database column sorting.

---

# 16. Media

Product media may be displayed through the Media integration.

The Storefront must use approved public media URLs or signed URLs where appropriate.

Never expose:

```text id="q6m4r8"
Private storage credentials
Raw object-store credentials
Internal storage paths
```

---

# 17. Add to Cart

The Product detail experience should call the Cart application interface.

Flow:

```text id="v5r8m4"
Product Page
   ↓
Select Variant
   ↓
Select Quantity
   ↓
Cart.addItem()
```

The Storefront must not directly insert Cart records.

---

# 18. Cart Feedback

After adding an item, the customer should receive authoritative backend confirmation.

The UI may show:

```text id="m7q4r5"
Added to cart
Cart count
Updated subtotal
```

Optimistic UI may be used only as a presentation enhancement.

---

# 19. Cart Page

The Cart page should display:

```text id="x5r7m6"
Items
Product information
Variant information
Quantity
Current display price
Subtotal
Remove controls
Quantity controls
Proceed to Checkout
```

The Cart remains customer intent, not final purchase authority.

---

# 20. Cart Revalidation

Before entering Checkout, the system should ensure the Cart is still valid enough to create a Checkout.

Checkout then performs its own authoritative validation.

Do not assume that a Cart viewed one second earlier is guaranteed to remain valid.

Commerce has unfortunately chosen to involve time as a variable.

---

# 21. Checkout Entry

The Storefront should transition the customer into Checkout through the approved Checkout API.

Conceptually:

```text id="q8m5r4"
Cart
 ↓
Create Checkout
 ↓
Checkout Page
```

The frontend must not construct a payment amount itself.

---

# 22. Checkout Review

The Checkout page should display authoritative server-calculated values:

```text id="v6r4m8"
Items
Quantities
Unit prices
Subtotal
Discount
Total
Currency
```

Any price changes must be reflected before payment.

---

# 23. Price Changes

If a Product price changes after the Cart was created:

```text id="m4q8r5"
Cart
 ↓
Checkout
 ↓
Recalculate
```

The customer must see the authoritative Checkout total.

The frontend must not preserve an obsolete Cart price as the payment amount.

---

# 24. Discount Code

The Checkout page may provide a Discount code input.

The flow is:

```text id="x7r5m4"
Customer enters code
      ↓
Checkout API
      ↓
Discount validation
      ↓
Updated Checkout totals
```

The browser must never determine whether a Discount is valid.

---

# 25. Discount Errors

Possible customer-facing errors include:

```text id="q6m8r4"
Invalid code
Expired code
Usage limit reached
Not eligible
Minimum purchase not met
```

Errors should be clear without exposing internal implementation details.

---

# 26. Customer Information

Checkout should collect required customer information through the approved Customer/Checkout workflow.

The Storefront must not create duplicate Customer records simply because a page reload occurs.

Customer creation and association must be idempotent where applicable.

---

# 27. Address Handling

If shipping or billing addresses are required by the Demo:

```text id="v8r4m6"
Checkout
 ↓
Customer/address information
 ↓
Order snapshot
```

The Storefront should not directly modify historical Order addresses.

---

# 28. Payment UI

The payment interface should initialize payment through the Payments API.

Conceptually:

```text id="m5q7r4"
Checkout
 ↓
Payment initialization
 ↓
Provider/test payment interface
 ↓
Payment confirmation
```

Provider-specific secrets must remain server-side.

---

# 29. Payment Amount

The frontend must never determine the final payment amount.

The payment amount must originate from:

```text id="x4r8m5"
Authoritative Checkout total
```

not:

```text id="q7m4r6"
Cart total
Browser state
Hidden input
URL parameter
```

---

# 30. Payment Result

The UI must distinguish:

```text id="v6m8r4"
Success
Failure
Pending/uncertain
```

A network error after submitting payment must not automatically be rendered as payment failure.

The frontend should query authoritative payment/Checkout state when necessary.

---

# 31. Payment Retry

If a payment attempt fails, the customer may retry according to the approved Payments state machine.

The frontend must not create an unrelated new purchase simply because the customer refreshed the page.

---

# 32. Payment Timeout

If the client loses connectivity after initiating payment:

```text id="m8r4q5"
Do not immediately retry blindly.
```

Instead:

```text id="x5r7m6"
Retrieve Checkout/payment state
      ↓
Determine current authoritative status
      ↓
Continue or retry safely
```

---

# 33. Order Confirmation

After successful purchase completion, show:

```text id="q4m8r5"
Order number
Order status
Purchased items
Total
Payment status where appropriate
```

The information must come from the backend.

---

# 34. Confirmation URL

If the Storefront provides a confirmation page, the URL must not expose sensitive information unnecessarily.

Do not make authorization depend solely on possession of a predictable Order ID.

Customer identity/session authorization must still be enforced.

---

# 35. Customer Order Access

After purchase, an authenticated customer may access their Orders.

The Storefront must enforce:

```text id="v7r4m6"
Authenticated customer
+
Correct Store
+
Order ownership
```

Guest order access, if supported, must use an explicitly designed secure mechanism rather than exposing Orders through guessable IDs.

---

# 36. Error States

The Storefront must provide clear states for:

```text id="m6q8r4"
Store unavailable
Product unavailable
Variant unavailable
Cart error
Checkout expired
Price changed
Discount invalid
Inventory unavailable
Payment failed
Payment pending
Order creation delayed
Unexpected error
```

Do not display raw server stack traces.

---

# 37. Loading States

Each major customer action should have an explicit loading state:

```text id="x8r5m4"
Catalog loading
Product loading
Cart mutation
Checkout loading
Payment processing
Order confirmation
```

Buttons that trigger non-idempotent operations should not allow uncontrolled repeated submission.

---

# 38. Error Recovery

When a request fails:

```text id="q5m7r4"
Preserve customer input where safe
+
Refresh authoritative state where required
+
Show actionable error
```

Do not silently discard the customer's Cart.

---

# 39. Authentication

The Storefront should support guest browsing.

Authentication is required only where the approved flow requires it.

Authenticated customer context should be preserved through:

```text id="v4r8m6"
Storefront
→ Cart
→ Checkout
→ Order
```

---

# 40. Guest Shopping

Guest users should be able to:

```text id="m7q4r5"
Browse Products
Add to Cart
View Cart
Begin Checkout
```

subject to the Demo's Checkout/customer requirements.

---

# 41. Guest Cart Security

Guest Cart ownership must not rely solely on a public Cart ID.

Use the approved secure session/token mechanism.

A copied URL must not grant arbitrary access to another customer's Cart.

---

# 42. Tenant Isolation

Every public request must still resolve the intended Store.

The Storefront must prevent:

```text id="x5r8m4"
Store A Product
```

from being exposed through:

```text id="q7m4r6"
Store B context
```

Cross-tenant data leakage is a release-blocking defect.

---

# 43. Caching

Caching may be used for safe public data such as:

```text id="v6r4m8"
Public Store configuration
Published catalog data
Public media
```

Do not cache user-specific or transaction-sensitive responses without explicit correctness guarantees.

Never cache:

```text id="m8q5r4"
Payment state
Checkout state
Customer Cart
Customer Order
```

in a way that can leak state between users.

---

# 44. Cache Invalidation

If catalog caching is introduced, Product publication and relevant Store configuration changes must invalidate or bypass stale public data according to the approved strategy.

Do not introduce a complex distributed cache for the Demo.

---

# 45. API Structure

Public Storefront APIs should use the approved namespace, for example:

```text id="x4m8r5"
/api/v1/storefront/stores/:storeSlug
/api/v1/storefront/stores/:storeSlug/products
/api/v1/storefront/stores/:storeSlug/products/:productSlug
/api/v1/storefront/carts
/api/v1/storefront/checkouts
/api/v1/storefront/orders
```

Exact routes must follow the API contract.

---

# 46. Public API Security

Public endpoints should include appropriate protections against:

```text id="q6r5m8"
Abuse
Excessive request rates
Enumeration
Oversized payloads
Malformed input
Cross-store access
Unauthorized Cart access
Unauthorized Order access
```

Rate limiting should be proportionate to the Demo infrastructure.

---

# 47. SEO and Metadata

Where the Next.js storefront requires metadata, generate it from public Store/Product data.

Do not expose internal IDs, database information, or sensitive fields through metadata.

---

# 48. Storefront Components

The implementation should maintain clear presentation boundaries.

Typical components include:

```text id="v7m4r6"
StoreHeader
ProductGrid
ProductCard
ProductDetail
VariantSelector
QuantitySelector
AddToCartButton
CartSummary
CartItem
CheckoutForm
PaymentSection
OrderConfirmation
```

Components should call approved application/API boundaries rather than implementing domain rules.

---

# 49. Server vs Client Components

Use server-side rendering/server components where appropriate for public catalog data.

Use client-side components where interaction requires browser state, such as:

```text id="m8q4r5"
Quantity controls
Cart mutations
Checkout interaction
Payment UI
```

Do not move business authorization or pricing rules into client components.

---

# 50. Storefront State

Client state should represent presentation state.

Authoritative business state comes from the backend.

Avoid maintaining independent client-side implementations of:

```text id="x5r7m4"
Price calculation
Discount calculation
Inventory reservation
Payment state
Order state
```

---

# 51. Observability

Track useful Storefront metrics such as:

```text id="q8m4r6"
Product page requests
Add-to-cart success/failure
Cart mutation failures
Checkout creation success/failure
Payment initiation success/failure
Order confirmation success/failure
```

Logs should contain appropriate:

```text id="v5m7r4"
requestId
storeId
customerId where appropriate
operation
result
duration
```

Avoid logging sensitive customer or payment data.

---

# 52. Testing Strategy

### Unit Tests

Test:

```text id="m4q8r5"
Public DTO mapping
Variant selection rules
Client state transitions
Presentation-level error handling
```

Business rules remain primarily covered by domain/application tests.

---

# 53. API Tests

Test:

```text id="x7r4m6"
Public Store resolution
Published Product visibility
Cross-store isolation
Cart integration
Checkout integration
Order visibility
Validation
Rate-limit behavior where configured
```

---

# 54. Security Tests

Mandatory tests:

```text id="q6m5r8"
[ ] Draft Product is not publicly visible
[ ] Unpublished Product is not publicly visible
[ ] Store A data is not visible from Store B
[ ] Guest cannot access another guest's Cart
[ ] Customer cannot access another customer's Cart
[ ] Customer cannot access another customer's Order
[ ] Client cannot modify authoritative price
[ ] Client cannot mark payment successful
[ ] Private media is not publicly exposed
```

---

# 55. End-to-End Purchase Test

The primary E2E test must execute:

```text id="v8r4m5"
Open public Store
   ↓
Browse catalog
   ↓
Open Product
   ↓
Select Variant
   ↓
Add to Cart
   ↓
Open Cart
   ↓
Proceed to Checkout
   ↓
Review total
   ↓
Apply valid Discount
   ↓
Initialize payment
   ↓
Complete sandbox payment
   ↓
Receive Order confirmation
```

---

# 56. Failure E2E Tests

Test at least:

```text id="m7q5r4"
Product becomes unavailable
Inventory sells out
Price changes
Discount expires
Checkout expires
Payment fails
Payment becomes pending
Payment request times out
Customer refreshes during payment
Duplicate payment confirmation arrives
```

The customer must always receive an accurate final state.

---

# 57. Browser Refresh Tests

Refresh the browser at:

```text id="x4r8m6"
Product page
Cart page
Checkout page
Payment processing
Order confirmation
```

Verify that the system does not create duplicate state or lose the purchase unnecessarily.

---

# 58. Multi-Tab Test

Open the same Store in multiple tabs.

Test:

```text id="q5m8r4"
Tab A → Cart quantity update
Tab B → Cart quantity update
```

The resulting Cart must follow the defined concurrency semantics.

---

# 59. Mobile/Responsive Verification

The Storefront should remain usable across the supported responsive breakpoints.

Verify:

```text id="v6r4m8"
Catalog
Product detail
Cart
Checkout
Payment
Order confirmation
```

Do not allow responsive presentation issues to hide critical payment or checkout actions.

---

# 60. Implementation Order

Implement the Storefront Purchase slice in this order:

```text id="m8q4r5"
1. Verify Store public resolution
2. Verify Product public query
3. Implement public Store page
4. Implement Product listing
5. Implement Product detail
6. Implement Variant selection
7. Integrate Cart
8. Implement Cart page
9. Integrate Checkout
10. Implement Checkout review
11. Integrate Discount
12. Integrate Customer/address flow
13. Integrate Payment UI
14. Implement payment result handling
15. Implement Order confirmation
16. Implement customer Order access
17. Add loading/error states
18. Add responsive behavior
19. Add security protections
20. Add observability
21. Add API tests
22. Add security tests
23. Add complete E2E purchase flow
24. Add failure/retry E2E coverage
```

---

# 61. AI Implementation Rules

AI agents implementing this slice must:

1. Read the actual root `AGENTS.md`.
2. Read Storefront, Stores, Products, Carts, Customers, Checkout, Payments, Orders, Media, API, Security, and Testing specifications.
3. Keep business rules inside owning domains.
4. Never calculate authoritative prices in the browser.
5. Never expose unpublished Products.
6. Never trust public IDs without Store/ownership validation.
7. Never directly modify Cart, Checkout, Payment, or Order database records from presentation code.
8. Preserve guest and customer isolation.
9. Treat payment timeout as potentially uncertain.
10. Avoid introducing a dedicated search engine or distributed cache for Demo.
11. Use public DTOs rather than merchant/internal DTOs.
12. Keep frontend state subordinate to server authority.

---

# 62. Definition of Done

The Storefront Purchase slice is complete when:

```text id="x5m7r4"
[ ] Public Store resolves correctly
[ ] Store availability is enforced
[ ] Public Store configuration works
[ ] Published Products are visible
[ ] Draft Products remain private
[ ] Product details work
[ ] Variant selection works
[ ] Product media works
[ ] Guest browsing works
[ ] Guest Cart works
[ ] Authenticated customer Cart works
[ ] Cart updates work
[ ] Checkout creation works
[ ] Authoritative pricing is displayed
[ ] Discount application works
[ ] Customer information works
[ ] Payment UI works
[ ] Payment success works
[ ] Payment failure works
[ ] Payment pending/uncertain state works
[ ] Order confirmation works
[ ] Customer Order access works
[ ] Cross-store isolation works
[ ] Cross-customer isolation works
[ ] Public/private media boundaries work
[ ] Loading states work
[ ] Error states work
[ ] Retry behavior is safe
[ ] Responsive behavior is verified
[ ] Security tests pass
[ ] API tests pass
[ ] Complete E2E purchase flow passes
[ ] Failure/retry E2E tests pass
[ ] TypeScript passes
[ ] Lint passes
```

---

# 63. Slice Completion Gate

The Storefront must prove the complete customer journey:

```text id="v7r5m4"
Public Store
   ↓
Published Product
   ↓
Variant
   ↓
Cart
   ↓
Checkout
   ↓
Authoritative Total
   ↓
Payment
   ↓
Order
   ↓
Confirmation
```

The final implementation must demonstrate that the customer-facing application is a thin, secure presentation layer over the real commerce domains.

The browser may display the purchase.

It must never become the authority for the purchase.