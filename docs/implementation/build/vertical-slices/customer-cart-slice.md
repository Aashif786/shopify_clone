# Customer Cart Vertical Slice Build Implementation

## 1. Purpose

This document defines the implementation of the Customer Cart vertical slice for the Demo.

The slice connects the public Storefront, Customer identity, Cart domain, Products, Inventory visibility, authentication, tenant isolation, and the transition from browsing to Checkout.

The core flow is:

```text
Customer
  ↓
Storefront
  ↓
Product
  ↓
Add to Cart
  ↓
View Cart
  ↓
Update Quantity
  ↓
Remove Item
  ↓
Proceed to Checkout
```

The Cart remains a representation of customer intent. It is not the final authority for price, inventory, discounts, payment, or Order creation.

---

# 2. Slice Objective

The completed slice must support:

- Guest shopping.
- Authenticated customer shopping.
- Cart creation.
- Add-to-cart.
- Quantity updates.
- Item removal.
- Cart retrieval.
- Store-scoped Cart ownership.
- Cart persistence.
- Cart expiration.
- Transition into Checkout.
- Safe handling of stale product and quantity information.

---

# 3. Dependencies

This slice depends on:

```text id="x5m8r4"
Repository foundation
Package foundation
Database
Authentication
Tenant context
Authorization
API
Validation/errors
Observability
Stores
Products
Customers
Carts
Inventory
Checkout
Jobs
Storefront
```

---

# 4. Domain Ownership

The Carts domain owns:

```text id="q7r4m6"
Cart
Cart Item
Cart lifecycle
Cart ownership
Item quantities
Cart expiration
Cart-level display totals
```

Products owns:

```text id="v6m5r8"
Product
Variant
Price
Publication
```

Inventory owns stock authority.

Checkout owns purchase-time validation and final pricing.

Customers owns customer records.

---

# 5. Cart Model

A Cart belongs to one Store and represents purchase intent.

Conceptually:

```text id="m4q8r7"
Store
  ↓
Cart
  ↓
Cart Items
  ↓
Product Variants
```

The Cart must never contain items belonging to another Store.

---

# 6. Guest Cart

A guest customer may create a Cart without a registered customer account.

The Cart should be associated with a secure guest/session identity according to the approved authentication/session architecture.

Do not expose a raw Cart ID as the only authorization mechanism.

---

# 7. Authenticated Customer Cart

An authenticated customer should have a Store-scoped Cart.

The relationship should be:

```text id="x8r5m4"
Authenticated User
      ↓
Customer
      ↓
Store
      ↓
Cart
```

The exact customer/account relationship follows the Customers and Auth specifications.

---

# 8. Cart Context

Every Cart request must establish:

```text id="q5m7r4"
Store context
+
Customer/guest context
+
Cart ownership
```

A client cannot switch Store or customer simply by changing identifiers in the request.

---

# 9. Create Cart

A Cart should be created lazily when required.

For example:

```text id="v7r4m6"
Customer opens Store
      ↓
Add first item
      ↓
Create/retrieve active Cart
```

The implementation should avoid creating unnecessary empty carts.

---

# 10. Add Item

The Add Item operation accepts customer intent:

```text id="m6q4r8"
variantId
quantity
```

The server resolves:

```text id="x5r8m6"
Product
Variant
Store
Current catalog eligibility
```

The client does not supply the authoritative price.

---

# 11. Variant Validation

Before adding a Variant:

```text id="q8m4r5"
Variant exists
Variant belongs to Store
Product is eligible
Variant is purchasable
Quantity is valid
```

The Cart must reject invalid cross-Store references.

---

# 12. Quantity Validation

Quantity must be:

- Positive.
- Within configured limits.
- Representable by the database type.
- Valid according to Product/Cart rules.

Do not accept arbitrary large quantities from the browser.

---

# 13. Existing Cart Item

If the Variant already exists in the Cart, the implementation should follow the approved quantity semantics.

For Demo:

```text id="v6r4m8"
Add quantity
    ↓
Increase existing quantity
```

The behavior must be consistent across API and UI.

---

# 14. Cart Item Uniqueness

A Cart should not contain duplicate rows for the same Variant where the business model treats the Variant as the unique purchasable item.

The database should enforce the appropriate uniqueness constraint.

Conceptually:

```text id="m7q5r4"
UNIQUE(cartId, variantId)
```

---

# 15. Cart Price

The Cart may display current price information for customer convenience.

However:

> Cart price is not purchase authority.

Checkout must recalculate authoritative pricing.

---

# 16. Product Changes

If a Product price changes after it is added to a Cart, the Cart may display the updated price according to the approved behavior.

Regardless of display behavior, Checkout must use the current authoritative price.

---

# 17. Product Availability Changes

If a Product becomes unpublished after being added to a Cart, the Cart must not bypass publication rules.

Checkout must revalidate the item.

The customer should receive a clear correction/error state rather than creating an invalid Order.

---

# 18. Inventory

Adding an item to a Cart must not reserve Inventory.

The Cart may display:

```text id="x4r8m6"
In stock
Out of stock
Limited availability
```

only as informational data.

Actual inventory validation occurs during Checkout.

---

# 19. Cart Retrieval

A customer may retrieve their active Cart through an approved endpoint.

The server must resolve the Cart using trusted ownership context.

It must not simply:

```text id="q6m5r8"
/carts/:cartId
```

and return the Cart without authorization.

---

# 20. Cart Response

The Cart response may contain:

```text id="v8r4m6"
Cart ID
Items
Product information
Variant information
Quantity
Current display price
Display subtotal
Currency
Cart status
```

Only approved public/customer-safe fields should be returned.

---

# 21. Cart Totals

Cart totals are informational.

The Cart may calculate:

```text id="m5q7r4"
Subtotal
```

using current product information.

Checkout must independently calculate:

```text id="x7r4m6"
Product prices
Discounts
Final total
```

before payment.

---

# 22. Quantity Update

Customers may update the quantity of an existing Cart item.

The server must validate:

```text id="q8m4r5"
Cart ownership
Variant ownership
Quantity
Cart lifecycle
```

The client cannot directly set authoritative inventory.

---

# 23. Remove Item

Removing an item should be idempotent where practical.

If the item is already absent, the operation should produce a safe result rather than corrupting the Cart.

---

# 24. Cart Lifecycle

The Cart lifecycle should use explicit states.

Typical states:

```text id="v5r7m8"
ACTIVE
CONVERTED
EXPIRED
ABANDONED
```

The exact states follow the Cart specification.

---

# 25. Converted Cart

When Checkout begins or completes, the Cart must follow the approved conversion semantics.

The Cart should not remain indefinitely mutable after it has become part of a completed purchase.

---

# 26. Checkout Transition

The transition is:

```text id="m6q4r8"
Cart
 ↓
Checkout
 ↓
Authoritative validation
```

The Cart provides intent and selected items.

Checkout takes responsibility for final purchase correctness.

---

# 27. Checkout Creation

Creating Checkout from a Cart should:

```text id="x5m8r4"
Validate Cart ownership
↓
Validate Cart state
↓
Load current Product information
↓
Validate item quantities
↓
Create Checkout
```

The exact workflow follows the Checkout implementation.

---

# 28. Stale Cart Handling

A Cart can become stale.

Examples:

```text id="q7r4m6"
Product unpublished
Price changed
Variant removed
Inventory unavailable
Discount no longer valid
```

Checkout must detect these conditions and return actionable errors.

---

# 29. Cart Expiration

Inactive Carts may expire after the configured period.

Expiration should be handled through the durable Jobs system.

The expiration job must invoke the Cart application service.

It must not directly delete arbitrary Cart rows.

---

# 30. Expiration Safety

Before expiring a Cart, verify that:

```text id="v8m4r5"
Cart is still eligible
Cart is still inactive
Cart has not entered Checkout
Cart has not been converted
```

A stale background job must not expire an active customer purchase.

---

# 31. Cart Concurrency

Multiple browser tabs or requests may update the same Cart.

Examples:

```text id="m5q8r4"
Tab A → quantity 2
Tab B → quantity 3
```

The implementation must define whether operations are:

```text id="x4r7m6"
Last-write-wins
Optimistic conflict
Atomic quantity operation
```

according to the Cart specification.

Do not accidentally create inconsistent duplicate Cart Items.

---

# 32. Add-to-Cart Concurrency

Two simultaneous Add Item requests for the same Variant must not create duplicate Cart Item records.

Use:

```text id="q6m5r8"
Database uniqueness
+
Application transaction
```

as defense in depth.

---

# 33. Idempotency

Mutation semantics must be explicitly defined.

For operations where the API supports idempotency:

```text id="v7r4m6"
Idempotency-Key
```

should be processed through the shared idempotency mechanism.

Do not blindly treat every repeated Add Item request as a duplicate, because the customer may intentionally click Add twice.

---

# 34. Cart Merge

If the Demo supports guest-to-customer cart merging after login, the merge must be explicit.

The workflow should define:

```text id="m8q4r5"
Guest Cart
+
Customer Cart
↓
Merged Cart
```

Quantity conflicts must have deterministic behavior.

If cart merging is not required for the Demo, do not build a complex merge engine.

---

# 35. Store Isolation

Every Cart operation must enforce:

```text id="x5r7m4"
Cart Store
=
Current Store Context
```

A Cart ID from another Store must never be sufficient to access it.

---

# 36. Customer Isolation

Authenticated customers must not access another customer's Cart.

Verify:

```text id="q7m4r6"
Customer A → Cart A → allowed
Customer A → Cart B → denied
```

Guest session identity must receive equivalent protection.

---

# 37. API Endpoints

The slice may expose:

```text id="v6r8m4"
POST   /api/v1/storefront/carts
GET    /api/v1/storefront/carts/:cartId
POST   /api/v1/storefront/carts/:cartId/items
PATCH  /api/v1/storefront/carts/:cartId/items/:itemId
DELETE /api/v1/storefront/carts/:cartId/items/:itemId
POST   /api/v1/storefront/carts/:cartId/checkout
```

Exact routes must follow the approved API contract.

---

# 38. DTOs

Use explicit DTOs such as:

```text id="m4q7r5"
CartDTO
CartItemDTO
AddCartItemRequest
UpdateCartItemRequest
CartSummaryDTO
```

Do not serialize domain entities directly.

---

# 39. Error Codes

Potential errors include:

```text id="x8r4m6"
CART_NOT_FOUND
CART_ACCESS_DENIED
CART_EXPIRED
CART_CONVERTED
INVALID_CART_ITEM
INVALID_QUANTITY
VARIANT_NOT_FOUND
VARIANT_NOT_PURCHASABLE
CART_STORE_MISMATCH
```

Use the shared error taxonomy.

---

# 40. Frontend Behavior

The customer UI should provide:

```text id="q5m8r4"
Add item
Quantity control
Remove item
Cart subtotal
Empty Cart state
Loading state
Error state
Proceed to Checkout
```

The UI must not assume a mutation succeeded until the backend confirms it.

---

# 41. Optimistic UI

Optimistic updates may be used for presentation, but authoritative state must come from the server.

If an optimistic update fails:

```text id="v7m4r6"
Rollback UI state
Show clear error
Refresh authoritative Cart where appropriate
```

Do not allow stale optimistic state to continue into Checkout.

---

# 42. Cart Persistence

Cart data must survive page refreshes and appropriate session continuation.

Guest persistence must follow the approved session strategy.

Authenticated carts must be associated with the authenticated customer/store context.

---

# 43. Cart Security

Protect against:

```text id="m6q4r8"
Cross-store access
Cross-customer access
Cart ID enumeration
Invalid quantity
Huge quantity
Unauthorized checkout
Tampered price
Tampered Store ID
```

---

# 44. Observability

Cart operations should log:

```text id="x5r8m4"
cartId
storeId
customerId where appropriate
operation
item/variant ID where safe
result
requestId
duration
```

Do not log sensitive authentication information.

---

# 45. Events

The Cart domain may emit:

```text id="q8m4r5"
CartCreated
CartItemAdded
CartItemUpdated
CartItemRemoved
CartExpired
CartConverted
```

Only required events should be implemented.

---

# 46. Notification Integration

Cart changes do not require customer notifications in the Demo.

Do not introduce abandoned-cart marketing notifications unless explicitly required.

---

# 47. Testing Strategy

### Unit Tests

Test:

```text id="v6r5m8"
Quantity rules
Cart state transitions
Item uniqueness
Expiration eligibility
Ownership rules
```

### Integration Tests

Test:

```text id="m7q4r6"
Cart creation
Add item
Update quantity
Remove item
Persistence
Store isolation
Customer isolation
Checkout transition
```

### API Tests

Test:

```text id="x4r8m5"
DTOs
Validation
Authorization
Error mapping
Pagination where applicable
```

---

# 48. Critical Cart Tests

Verify:

```text id="q5m8r4"
[ ] Same Variant does not create duplicate Cart Items
[ ] Cross-store Variant cannot be added
[ ] Customer cannot access another customer's Cart
[ ] Guest cannot access another guest's Cart
[ ] Quantity limits are enforced
[ ] Cart does not reserve Inventory
[ ] Checkout revalidates Cart contents
[ ] Expired Cart cannot enter Checkout
[ ] Converted Cart cannot be arbitrarily modified
```

---

# 49. Checkout Integration Test

The complete flow should verify:

```text id="v8m4r6"
Customer visits Store
   ↓
Views Product
   ↓
Adds Variant to Cart
   ↓
Cart persists
   ↓
Refresh page
   ↓
Cart remains
   ↓
Updates quantity
   ↓
Proceeds to Checkout
   ↓
Checkout receives Cart intent
```

Then verify Checkout independently revalidates Product and Inventory state.

---

# 50. Stale Data Test

Create Cart item.

Then:

```text id="m5q7r4"
Change Product price
```

Verify:

```text id="x7r4m6"
Cart remains accessible
Checkout uses new authoritative price
```

Similarly test:

```text id="q6m4r8"
Product becomes unpublished
Inventory becomes unavailable
```

Checkout must reject or correct the stale Cart rather than creating an invalid Order.

---

# 51. Concurrency Test

Execute simultaneous requests:

```text id="v7r5m4"
Add Variant X
Add Variant X
```

Verify the Cart contains one logical Cart Item with the correct quantity semantics rather than duplicate rows.

---

# 52. Failure Tests

Test:

```text id="m4q8r5"
Invalid Variant
Invalid quantity
Cross-store Cart
Expired Cart
Database failure
Request timeout
Repeated mutation
Checkout creation failure
Worker expiration retry
```

The Cart must remain recoverable.

---

# 53. Implementation Order

Implement the Customer Cart slice in this order:

```text id="x8r4m6"
1. Verify Storefront/Product foundation
2. Implement Cart schema
3. Implement Cart ownership model
4. Implement Cart creation/retrieval
5. Implement Add Item
6. Implement quantity updates
7. Implement Remove Item
8. Implement Cart persistence
9. Implement Cart API
10. Implement guest/customer access
11. Implement expiration job
12. Implement Checkout transition
13. Implement Storefront Cart UI
14. Add stale-state handling
15. Add observability
16. Add unit tests
17. Add integration/API tests
18. Add tenant/security tests
19. Add E2E Cart flow
```

---

# 54. AI Implementation Rules

AI agents implementing this slice must:

1. Read the actual root `AGENTS.md`.
2. Read Carts, Products, Customers, Checkout, Inventory, Storefront, Auth, Tenant, API, and Security specifications.
3. Treat Cart as purchase intent, not purchase authority.
4. Never reserve Inventory during Add-to-Cart.
5. Never trust client-side prices.
6. Enforce Store and customer ownership server-side.
7. Use database constraints for Cart Item uniqueness.
8. Preserve explicit Cart lifecycle semantics.
9. Make expiration safe and idempotent.
10. Avoid implementing marketing/abandoned-cart systems outside Demo scope.

---

# 55. Definition of Done

The Customer Cart slice is complete when:

```text id="q7m4r5"
[ ] Guest Cart works
[ ] Authenticated customer Cart works
[ ] Cart is Store-scoped
[ ] Cart ownership is enforced
[ ] Add-to-Cart works
[ ] Quantity updates work
[ ] Item removal works
[ ] Duplicate Cart Items are prevented
[ ] Quantity limits are enforced
[ ] Cart persists correctly
[ ] Cart survives appropriate page refresh/session continuation
[ ] Cart does not reserve inventory
[ ] Cart display totals work
[ ] Checkout transition works
[ ] Checkout receives Cart intent correctly
[ ] Stale Cart conditions are detected
[ ] Cart expiration works
[ ] Cross-store access is blocked
[ ] Cross-customer access is blocked
[ ] Unit tests pass
[ ] Integration/API tests pass
[ ] Security tests pass
[ ] E2E Cart flow passes
[ ] TypeScript passes
[ ] Lint passes
```

---

# 56. Slice Completion Gate

The slice must pass this end-to-end scenario:

```text id="v6m4r8"
Customer enters Storefront
   ↓
Opens Product
   ↓
Adds Variant
   ↓
Cart is created
   ↓
Cart survives refresh
   ↓
Quantity changes
   ↓
Item is removed
   ↓
Item is added again
   ↓
Checkout is initiated
   ↓
Checkout revalidates the Cart
```

The implementation is complete only when the Cart behaves reliably as persistent customer intent while leaving final pricing, inventory, payment, and Order authority to the appropriate downstream domains.