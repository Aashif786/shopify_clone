# Cart Specification

## 1. Purpose

This specification defines the functional and technical requirements for the Carts domain of the Demo commerce platform.

The Carts domain is responsible for:

- Cart creation
- Cart ownership
- Cart items
- Product variant references
- Quantity management
- Cart lifecycle
- Cart totals
- Customer association
- Guest carts
- Cart validation
- Cart-to-checkout transition

The Carts domain does not own:

- Products
- Product pricing configuration
- Inventory
- Discounts
- Checkout
- Payments
- Orders
- Customer identity

Those domains interact with Carts through defined interfaces.

---

# 2. Scope

The Demo Carts module must support:

- Creating a cart
- Retrieving a cart
- Adding products
- Updating quantities
- Removing products
- Clearing a cart
- Customer-owned carts
- Guest carts
- Store-scoped carts
- Cart totals
- Basic validation
- Cart expiration
- Checkout creation from a cart

The primary lifecycle is:

```text
Customer / Guest
       ↓
Create Cart
       ↓
Add Items
       ↓
Update Quantities
       ↓
Review Cart
       ↓
Create Checkout
       ↓
Cart Converted
```

---

# 3. Out of Scope

The Demo Carts module does not include:

- Saved carts
- Abandoned-cart marketing automation
- Persistent wishlists
- Product recommendations
- Advanced cart personalization
- Cart analytics
- Multi-currency carts
- Subscription carts
- B2B purchasing rules
- Advanced bundles
- Complex product configuration
- Distributed cart storage

These may be introduced later.

---

# 4. Domain Ownership

The Carts module owns:

```text
Cart
CartItem
```

The module is authoritative for:

- cart lifecycle
- cart ownership
- cart contents
- cart quantities
- cart-level state
- cart totals as calculated from current domain inputs

---

# 5. Cart Entity

Conceptually:

```text
Cart
├── id
├── store_id
├── customer_id (optional)
├── status
├── currency
├── subtotal
├── discount_total
├── tax_total
├── shipping_total
├── grand_total
├── expires_at
├── created_at
└── updated_at
```

The exact monetary fields may evolve with checkout requirements.

---

# 6. Cart Item Entity

Conceptually:

```text
CartItem
├── id
├── cart_id
├── product_variant_id
├── quantity
├── unit_price
├── line_subtotal
├── created_at
└── updated_at
```

The CartItem references a ProductVariant.

The Products domain remains authoritative for product identity and availability.

---

# 7. Cart Invariants

The following invariants are mandatory:

1. Every cart belongs to exactly one Store.
2. A cart may optionally belong to one Customer.
3. A cart may contain multiple items.
4. A cart item belongs to exactly one cart.
5. Quantity must be a positive integer.
6. A cart cannot contain duplicate entries for the same variant.
7. A cart item must reference a valid product variant.
8. The referenced variant must belong to the same Store.
9. Converted carts cannot be modified.
10. Expired carts cannot be used for checkout.
11. Cart ownership must be validated server-side.
12. Cart totals must never be trusted from the client.

---

# 8. Cart Lifecycle

Demo uses:

```text
ACTIVE
CONVERTED
ABANDONED
EXPIRED
```

Lifecycle:

```text
ACTIVE
  │
  ├── checkout completed ──→ CONVERTED
  │
  ├── inactivity/expiration → EXPIRED
  │
  └── abandonment           → ABANDONED
```

Converted carts are terminal.

Expired and abandoned carts are not eligible for normal checkout.

---

# 9. Cart Creation

A cart may be created when:

- a customer adds the first product
- a guest begins shopping
- the storefront explicitly requests a cart

Conceptually:

```text
Storefront
   ↓
Add Product
   ↓
Resolve/Create Cart
   ↓
Add Cart Item
```

Cart creation and first-item insertion should be handled atomically where appropriate.

---

# 10. Guest Cart

A guest may have a cart without a registered customer.

Conceptually:

```text
Guest Session
    ↓
Cart
    ↓
Cart Items
```

The guest cart must still be associated with exactly one Store.

The client must not be able to change the cart's store association.

---

# 11. Registered Customer Cart

A registered customer may own a cart.

Conceptually:

```text
Customer
    ↓
Cart
    ↓
Cart Items
```

The server resolves the customer from authenticated context where possible.

A client-provided customer ID must not be trusted as proof of ownership.

---

# 12. Cart Ownership

Cart access is determined by:

```text
Store
+
Customer / Guest session
+
Cart identity
```

The server must verify ownership before returning or mutating a cart.

---

# 13. Cart Isolation

A cart from Store A must never be usable within Store B.

For example:

```text
Cart.store_id = Store A

Request:
Store B + Cart ID

Result:
Rejected
```

This validation must happen server-side.

---

# 14. Adding an Item

Conceptual operation:

```text
addItem(
  cartId,
  productVariantId,
  quantity
)
```

The service must validate:

1. Cart exists.
2. Cart is active.
3. Cart belongs to the current Store.
4. Caller has access to the cart.
5. Variant exists.
6. Variant belongs to the same Store.
7. Variant is purchasable.
8. Quantity is valid.

---

# 15. Duplicate Variant Handling

A cart should contain at most one CartItem per variant.

If the same variant is added again:

```text
Existing quantity = 2
Requested quantity = 3
```

the resulting quantity should normally be:

```text
5
```

rather than creating another CartItem.

The database should reinforce this with:

```text
UNIQUE(cart_id, product_variant_id)
```

---

# 16. Quantity Updates

Quantity must be:

```text
integer > 0
```

Setting quantity to zero should be interpreted as removing the item if supported by the API.

Negative quantities must always be rejected.

Extremely large quantities must be rejected according to configured business limits.

---

# 17. Removing Items

Conceptual operation:

```text
removeItem(cartId, itemId)
```

The server must verify:

```text
item.cart_id == requested cart
```

before deletion.

The item cannot be removed from another customer's cart.

---

# 18. Clearing a Cart

Conceptual operation:

```text
clearCart(cartId)
```

The operation removes all active CartItems.

The cart itself remains available as an empty active cart unless the application chooses another lifecycle behavior.

---

# 19. Product Availability

A cart may contain a product that later becomes:

- inactive
- archived
- unavailable
- out of stock

Therefore, adding an item and completing checkout are separate validation points.

Cart contents are not a guarantee of purchase availability.

---

# 20. Inventory Boundary

Carts do not own inventory.

The relationship is:

```text
Cart
   ↓
ProductVariant
   ↓
Inventory
```

The cart may request availability information.

The Inventory module decides whether sufficient stock exists.

---

# 21. Inventory Reservation

Adding an item to a cart does not automatically reserve inventory in Demo unless explicitly required by the checkout design.

The preferred Demo behavior is:

```text
Add to Cart
    ↓
No permanent reservation

Checkout
    ↓
Reserve inventory
```

This prevents abandoned carts from unnecessarily locking stock.

---

# 22. Cart Pricing

Cart totals must be calculated server-side.

The client may send:

```text
variant_id
quantity
```

but must not be trusted for:

```text
unit_price
subtotal
discount
tax
grand_total
```

---

# 23. Product Price Changes

A product's price may change while a cart exists.

Therefore, cart pricing must be recalculated according to the current pricing rules at checkout.

A cart should not be treated as a permanent price guarantee unless the platform explicitly introduces price locking.

---

# 24. Cart Price Snapshot

Cart items may retain calculated price information for display and consistency.

However:

```text
Cart price
≠
Final order price
```

Checkout must perform the authoritative final pricing calculation.

---

# 25. Cart Totals

Conceptually:

```text
Subtotal
- Discounts
+ Tax
+ Shipping
= Grand Total
```

The exact calculation order is controlled by Checkout and pricing rules.

The Carts module should not duplicate complex discount or tax engines.

---

# 26. Discounts Boundary

The Discounts domain owns:

- discount rules
- discount codes
- eligibility
- usage limits

Carts may display an applied discount state where supported.

Checkout performs authoritative discount validation before order creation.

---

# 27. Tax Boundary

Demo does not require an advanced tax engine.

If tax calculation exists, Carts should consume the result rather than own tax rules.

The architecture must avoid embedding tax logic directly into CartItem CRUD operations.

---

# 28. Shipping Boundary

Shipping is outside the primary Demo scope.

If a basic shipping charge is introduced, it should be calculated by Checkout or a dedicated pricing component rather than becoming deeply coupled to Cart persistence.

---

# 29. Cart Recalculation

Cart totals should be recalculated when:

- an item is added
- quantity changes
- an item is removed
- discount changes
- product pricing changes
- cart is reopened
- checkout begins

The exact recalculation strategy may evolve.

---

# 30. Cart Validation

A cart validation operation should verify:

- cart is active
- cart belongs to current store
- caller owns the cart
- items still exist
- variants are still purchasable
- quantities are valid
- prices can be calculated
- required product data is available

Checkout performs deeper validation.

---

# 31. Checkout Transition

Creating a checkout from a cart should verify the cart is valid.

Conceptually:

```text
Cart
 ↓
Validate
 ↓
Create Checkout
 ↓
Checkout owns purchase state
```

The cart remains historically associated with the checkout.

---

# 32. Cart Conversion

After successful checkout/order creation:

```text
ACTIVE → CONVERTED
```

A converted cart must not be reused for another purchase.

This prevents accidental double checkout.

---

# 33. Cart and Checkout Boundary

The Carts module owns:

```text
Cart contents
```

The Checkout module owns:

```text
Purchase preparation
Payment coordination
Inventory reservation
Final pricing
Order creation
```

Carts must not directly create payments or orders.

---

# 34. Cart and Orders Boundary

Orders may reference the source Cart or Checkout for traceability.

However, Orders owns:

- order state
- order items
- historical prices
- historical addresses
- order totals

Changing a Cart after an order is created must not modify the Order.

---

# 35. Cart and Customers Boundary

Customers owns customer identity.

Carts stores the customer association.

Carts must not directly modify Customer records.

---

# 36. Cart API

Conceptual customer-facing operations:

```text
GET    /cart
POST   /cart/items
PATCH  /cart/items/{itemId}
DELETE /cart/items/{itemId}
DELETE /cart/items
POST   /cart/checkout
```

The exact routing may differ depending on the final storefront API design.

---

# 37. Cart Retrieval

A customer should normally retrieve their active cart through:

```text
GET /cart
```

rather than providing arbitrary cart IDs.

The server resolves the cart from:

- store context
- authenticated customer
- guest session

This reduces insecure direct-object-reference risks.

---

# 38. Cart Item API

Adding an item:

```text
POST /cart/items
```

Example request concept:

```json
{
  "productVariantId": "variant-id",
  "quantity": 2
}
```

The server calculates all monetary values.

---

# 39. Cart Update API

Example:

```text
PATCH /cart/items/{itemId}
```

Request:

```json
{
  "quantity": 4
}
```

The server verifies ownership and recalculates the cart.

---

# 40. Cart Error Conditions

The module should expose meaningful errors such as:

```text
CART_NOT_FOUND
CART_ACCESS_DENIED
CART_NOT_ACTIVE
CART_EXPIRED
CART_ALREADY_CONVERTED
CART_ITEM_NOT_FOUND
INVALID_QUANTITY
PRODUCT_VARIANT_NOT_FOUND
PRODUCT_VARIANT_UNAVAILABLE
CROSS_STORE_VARIANT
CART_CHECKOUT_INVALID
```

---

# 41. Cart Concurrency

Carts may be modified concurrently by:

- multiple browser tabs
- mobile and desktop sessions
- rapid repeated requests
- retries
- network duplication

The implementation must prevent inconsistent cart state.

---

# 42. Duplicate Add Requests

A client may accidentally send the same request multiple times.

The API should support idempotency where repeated requests could otherwise produce unintended quantity changes.

For critical mutation endpoints, idempotency keys may be supported.

---

# 43. Cart Item Concurrency

Two requests may update the same CartItem simultaneously.

The system should prevent lost updates where correctness requires it.

Possible mechanisms:

- transaction locking
- atomic updates
- optimistic concurrency
- idempotency

The chosen mechanism should remain consistent with the database concurrency strategy.

---

# 44. Cart Quantity Limits

Demo should define reasonable limits such as:

```text
quantity >= 1
quantity <= configured maximum
```

The exact maximum should be configurable rather than hard-coded throughout the application.

---

# 45. Cart Expiration

Guest and inactive carts may eventually expire.

Expiration should not require immediate deletion.

Conceptually:

```text
ACTIVE
   ↓
inactive period
   ↓
EXPIRED
```

A background worker may perform expiration processing.

---

# 46. Abandoned Carts

A cart may be marked abandoned for operational purposes.

Demo does not require abandoned-cart marketing.

Abandonment must not be confused with order cancellation.

---

# 47. Background Jobs

Potential cart jobs include:

- cart expiration
- abandoned-cart cleanup
- stale cart maintenance

Workers must use application services and respect tenant context.

---

# 48. Cart Events

The Carts domain may publish events such as:

```text
CartCreated
CartItemAdded
CartItemUpdated
CartItemRemoved
CartCleared
CartConverted
CartExpired
```

Events represent completed facts.

Consumers must not assume that event delivery is exactly once.

---

# 49. Event Idempotency

Event consumers must tolerate duplicate delivery.

For example:

```text
CartConverted
CartConverted
```

must not result in two orders.

The Orders/Checkout domains must enforce their own idempotency.

---

# 50. Cart Transactions

Transactions should be used for operations that require atomicity.

Examples:

- create cart + first item
- add/update item
- remove item
- clear cart
- cart conversion
- checkout transition

Application services own transaction boundaries.

---

# 51. Database Constraints

The database should enforce:

- Cart → Store foreign key
- Cart → Customer foreign key where applicable
- CartItem → Cart foreign key
- CartItem → ProductVariant foreign key
- unique `(cart_id, product_variant_id)`
- valid quantity constraints where supported
- appropriate indexes

---

# 52. Store Isolation

All cart queries must be scoped by store context.

For example:

```text
SELECT cart
WHERE id = ?
AND store_id = ?
```

A cart ID alone must not be considered sufficient authorization.

---

# 53. Customer Isolation

For customer-owned carts:

```text
cart.customer_id == currentCustomer.id
```

must be validated.

A malicious client must not be able to substitute another customer's ID.

---

# 54. Guest Session Security

Guest cart identifiers should be sufficiently unpredictable.

If a cart token is exposed, access must still be constrained by the intended guest-session model.

Sequential or easily guessable public cart identifiers should be avoided.

---

# 55. Cart Serialization

API responses should expose a stable DTO rather than raw database entities.

Example:

```json
{
  "id": "cart-id",
  "currency": "INR",
  "items": [],
  "subtotal": 1000,
  "discountTotal": 100,
  "grandTotal": 900
}
```

Internal database fields should not automatically become public API fields.

---

# 56. Cart Performance

Common storefront operations should remain efficient:

- retrieve active cart
- add item
- update quantity
- remove item
- calculate totals

The initial Demo implementation should rely on PostgreSQL and normal indexed queries.

No dedicated cart cache is required.

---

# 57. Caching

Cart data is highly mutable.

Caching must not introduce stale or conflicting purchase state.

Therefore:

```text
Database = authoritative cart state
Cache = optional optimization
```

Demo should avoid introducing distributed cart caching unless an actual performance requirement appears.

---

# 58. Observability

Cart operations should provide structured operational information such as:

```text
cart_id
store_id
customer_id
operation
request_id
duration
result
error_code
```

Sensitive customer information should not be logged unnecessarily.

---

# 59. Testing Requirements

Unit tests must cover:

- cart creation
- item addition
- duplicate variant handling
- quantity validation
- item removal
- clearing
- lifecycle transitions
- total calculation
- validation errors

---

# 60. Integration Tests

Integration tests should verify:

- store ownership
- customer ownership
- variant ownership
- database constraints
- concurrent cart updates
- duplicate item prevention
- cart conversion
- expiration
- transaction rollback

---

# 61. Checkout Integration Tests

At minimum:

```text
Create Cart
   ↓
Add Item
   ↓
Validate Cart
   ↓
Create Checkout
   ↓
Reserve Inventory
   ↓
Payment
   ↓
Order
   ↓
Convert Cart
```

Failure scenarios must also be tested.

For example:

```text
Payment fails
   ↓
Order not incorrectly finalized
   ↓
Cart remains recoverable where appropriate
```

---

# 62. E2E Storefront Flow

A complete storefront test should verify:

```text
Open Storefront
      ↓
Open Product
      ↓
Select Variant
      ↓
Add to Cart
      ↓
View Cart
      ↓
Change Quantity
      ↓
Remove Item
      ↓
Add Again
      ↓
Checkout
```

---

# 63. Failure Handling

If adding an item fails:

- cart must remain valid
- no partial CartItem should remain
- client receives a structured error

If quantity update fails:

- previous valid quantity remains

If checkout creation fails:

- cart should remain usable unless it was intentionally transitioned

If cart conversion fails:

- the cart must not incorrectly become permanently converted

---

# 64. Security Requirements

The Carts module must enforce:

- authentication where required
- guest-session security
- store isolation
- cart ownership
- input validation
- authorization
- safe identifiers
- rate limiting where appropriate
- no client-controlled pricing

---

# 65. Anti-Patterns

Do not:

- trust client-provided prices
- trust client-provided customer ownership
- allow cross-store variants
- create duplicate items for the same variant
- reserve inventory indefinitely at add-to-cart
- create orders directly from Cart CRUD
- call payment providers from Cart logic
- treat cart state as order state
- expose database entities directly
- introduce Redis solely because carts exist
- build a distributed cart service for Demo

---

# 66. Demo Implementation Boundary

The Demo implementation should use:

```text
modules/carts
packages/db
packages/tenant
packages/auth
packages/validation
```

Interactions:

```text
Carts
 ├── Products → read product/variant information
 ├── Customers → resolve customer ownership
 ├── Inventory → validate availability when required
 └── Checkout → create purchase flow
```

Carts must not depend on internal implementation details of those modules.

---

# 67. Demo-to-V1 Evolution

The cart model should support future additions such as:

- persistent carts
- abandoned-cart recovery
- cart promotions
- saved carts
- multi-device synchronization
- advanced product configurations
- bundles
- subscriptions
- distributed caching

These should be introduced without replacing the fundamental Cart and CartItem model.

---

# 68. Acceptance Criteria

The Carts module is complete for Demo when:

- A cart can be created for a store.
- Guest carts are supported.
- Registered customers can own carts.
- Cart ownership is enforced server-side.
- Cart items reference valid variants.
- Cross-store variants are rejected.
- The same variant cannot create duplicate CartItems.
- Quantities are validated.
- Items can be added, updated, removed, and cleared.
- Cart totals are calculated server-side.
- Client-provided prices are ignored.
- Product availability is validated appropriately.
- Inventory is not permanently reserved merely by adding to cart.
- Checkout can be created from a valid cart.
- Converted carts cannot be reused.
- Expired carts cannot proceed through checkout.
- Cart mutations are transactionally safe.
- Critical duplicate requests can be handled safely.
- Customer and store isolation tests pass.
- Checkout integration is covered by automated tests.
- Historical order data is independent of later cart changes.