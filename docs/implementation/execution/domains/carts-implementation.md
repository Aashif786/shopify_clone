# Carts Implementation

## 1. Purpose

This document defines the concrete implementation of the Cart domain for the Demo.

The Cart domain manages temporary shopping state between product selection and checkout.

It owns:

- Cart lifecycle.
- Cart ownership.
- Cart items.
- Item quantities.
- Cart association with guests or customers.
- Cart expiration.
- Cart-level state.
- Cart persistence.
- Cart totals used for display.

It does not own:

- Authoritative inventory.
- Final checkout pricing.
- Payment processing.
- Order creation.
- Final discount usage.
- Product catalog data.

---

# 2. Domain Ownership

Cart implementation belongs to:

```text id="c7m4x8"
modules/carts
```

The module may use:

```text id="q8m3c7"
packages/db
packages/tenant
packages/types
packages/validation
```

It interacts with Products, Inventory, Customers, Discounts, and Checkout through public interfaces.

It must not directly access their internal tables.

---

# 3. Cart Ownership Model

A Cart belongs to exactly one Store.

It may additionally be associated with:

- An authenticated Customer.
- A guest/session identifier.

Conceptually:

```text id="v5c8m4"
Store
  ↓
Cart
  ├── Guest
  └── Customer
```

---

# 4. Cart Model

A Cart may contain:

```text id="x7m3c8"
id
store_id
customer_id nullable
guest_identifier nullable
status
currency
expires_at
created_at
updated_at
```

The exact schema follows the database specification.

---

# 5. Cart Item Model

A Cart Item should contain:

```text id="m8c4x7"
id
cart_id
variant_id
quantity
created_at
updated_at
```

The Product Variant remains authoritative for current catalog information.

---

# 6. Cart Status

The Cart lifecycle should use explicit states.

Example:

```text id="q7m4c8"
Active
Converted
Expired
Abandoned
```

The exact state model follows the Cart specification.

---

# 7. Cart Lifecycle

Typical transitions:

```text id="v8m3c7"
Active
  ├──→ Converted
  ├──→ Expired
  └──→ Abandoned
```

A converted Cart must not be reused as an active shopping cart.

---

# 8. Cart Creation

Cart creation should follow:

```text id="x5m8c4"
Resolve Store
      ↓
Resolve Customer or Guest Context
      ↓
Create Cart
      ↓
Return Cart
```

Cart creation should be Store-scoped.

---

# 9. Guest Carts

Guest users may receive a temporary Cart.

The guest identifier should be:

- Random.
- Unpredictable.
- Scoped appropriately.
- Stored securely in the client mechanism selected by the application.

A guest identifier must not be treated as a general authorization credential.

---

# 10. Customer Carts

Authenticated customers may have a Cart associated with their Customer identity.

The system should define whether each Customer may have:

- One active Cart per Store.
- Multiple active Carts.

For Demo, a single active Cart per Customer per Store is preferable unless product requirements require otherwise.

---

# 11. Cart Ownership Verification

Every Cart access must verify:

```text id="m4c8x7"
Store
+
Customer or Guest Ownership
```

A Cart ID alone must never provide access.

---

# 12. Adding an Item

The flow should be:

```text id="q8m3c7"
Validate Cart
      ↓
Validate Variant
      ↓
Validate Store Ownership
      ↓
Validate Quantity
      ↓
Add or Increment Item
      ↓
Recalculate Display Totals
      ↓
Return Cart
```

Adding an item does not reserve inventory.

---

# 13. Variant Validation

Before adding a Variant:

- The Variant must exist.
- The Variant must belong to the current Store.
- The Variant must be eligible for sale according to Product state.
- The requested quantity must be valid.

Inventory availability may be checked for user feedback but is not guaranteed until checkout.

---

# 14. Quantity Semantics

Quantity must be a positive integer.

Example:

```text id="v7m3c8"
1
2
3
...
```

Reject:

```text id="x4m8c7"
0
Negative values
Fractional values
Non-numeric values
Unreasonably large values
```

The maximum quantity should be configurable or defined by product requirements.

---

# 15. Duplicate Cart Items

Adding an already-present Variant should normally increment its quantity rather than create a duplicate line.

Example:

```text id="m8c4x7"
Existing:
Variant A × 2

Add:
Variant A × 3

Result:
Variant A × 5
```

This behavior should be deterministic.

---

# 16. Cart Item Uniqueness

The database should enforce one Cart Item per Variant per Cart.

Example:

```text id="q5m8c4"
UNIQUE (cart_id, variant_id)
```

This protects against duplicate lines caused by concurrent requests.

---

# 17. Updating Quantity

Quantity updates should:

1. Verify Cart ownership.
2. Verify Cart is active.
3. Validate quantity.
4. Verify Variant still exists.
5. Update the Cart Item.
6. Recalculate display totals.

Setting quantity to zero should either:

- Remove the item explicitly.
- Follow a documented zero-quantity rule.

The behavior must remain consistent across the API.

---

# 18. Removing an Item

Removing an item should be safe to repeat where practical.

Example:

```text id="v8m3c7"
DELETE /cart/items/:itemId
```

If the item is already absent, the API should follow the established not-found/idempotency convention.

---

# 19. Cart Totals

Cart totals may be calculated for display.

Possible values:

```text id="x7c4m8"
Subtotal
Discount estimate
Tax estimate if supported
Total
Currency
```

However, Cart totals are not authoritative checkout totals.

---

# 20. Checkout Recalculation

At Checkout:

```text id="m8c4x7"
Cart
 ↓
Re-read Product prices
 ↓
Recalculate discounts
 ↓
Validate inventory
 ↓
Calculate authoritative total
```

The Checkout domain must not blindly trust totals stored in the Cart.

---

# 21. Price Changes

If a Product price changes after the Cart was created, the Cart may contain stale display information.

Checkout must recalculate the authoritative price.

The user should be informed according to the Checkout UX contract if the price changed.

---

# 22. Product Availability Changes

A Product may become unavailable while it remains in a Cart.

The Cart may retain the item temporarily.

Checkout must detect:

```text id="q7m4c8"
Product unavailable
Variant unavailable
Store inactive
```

and reject or require correction according to checkout rules.

---

# 23. Inventory Integration

Cart does not reserve inventory.

The separation is:

```text id="v5c8m4"
Cart
  ↓
Intent to purchase

Checkout
  ↓
Actual inventory reservation
```

This prevents inactive carts from holding inventory indefinitely.

---

# 24. Customer Integration

When associating a Customer:

```text id="x8m3c7"
Cart Store
+
Customer Store
```

must match.

A Customer belonging to another Store must be rejected.

---

# 25. Cart Merge

If a guest user authenticates and an existing Customer Cart already exists, a merge may be required.

For Demo, the merge behavior should be explicit.

A reasonable approach is:

```text id="m4c8x7"
Guest Cart
+
Customer Cart
      ↓
Merge compatible items
      ↓
Resolve quantities
      ↓
Persist one active Cart
```

The operation must enforce quantity limits and Store ownership.

If Cart merge is not required for Demo, it should remain out of scope rather than being partially implemented.

---

# 26. Cart Concurrency

Concurrent Cart updates must not produce corrupted quantities.

Example:

```text id="q8m3c7"
Request A: quantity + 1
Request B: quantity + 1
```

The implementation must define whether operations are:

- Serialized.
- Optimistically versioned.
- Performed through atomic updates.

Lost updates must be prevented where correctness requires it.

---

# 27. Cart Transactions

Operations involving multiple Cart records should use application-service transactions.

For example:

```text id="v7m4c8"
Cart Merge
+
Cart Item Updates
```

should be atomic.

Keep transactions short.

---

# 28. Cart Expiration

Carts may expire according to the configured lifetime.

Expiration should:

- Mark the Cart inactive.
- Prevent further modifications.
- Preserve required history.
- Avoid affecting inventory because Cart never owns reservations.

---

# 29. Cart Abandonment

Abandonment is primarily a business state.

The Demo does not need an advanced abandoned-cart automation system.

If abandonment is tracked, it should not complicate the core Cart state machine.

---

# 30. Cart Conversion

After successful Checkout, the Cart should become non-active.

Conceptually:

```text id="x5m8c4"
Active Cart
    ↓
Successful Checkout
    ↓
Converted
```

A converted Cart must not be reused for another purchase.

---

# 31. Cart Repository

The repository should provide focused operations such as:

```text id="m8c4x7"
findActiveCart
findById
create
update
addItem
updateItemQuantity
removeItem
markConverted
markExpired
```

All Store-owned operations require appropriate Store scope.

---

# 32. Cart Application Services

Typical services include:

```text id="q7m4c8"
getOrCreateCart
getCart
addItem
updateItemQuantity
removeItem
clearCart
mergeCarts
convertCart
expireCart
```

Exact names may follow project conventions.

---

# 33. Cart DTOs

Use explicit DTOs:

```text id="v8c4m7"
CartSummary
CartDetail
CartItem
AddCartItemInput
UpdateCartItemInput
```

Do not expose raw database records.

---

# 34. Cart API

Typical endpoints:

```text id="x4m8c7"
GET    /api/v1/cart
POST   /api/v1/cart/items
PATCH  /api/v1/cart/items/:itemId
DELETE /api/v1/cart/items/:itemId
```

The exact path may be adapted to the established API contract.

---

# 35. Cart Authentication

Guest Cart access should use the approved guest mechanism.

Authenticated Cart access should derive the Customer identity from authentication context.

Never accept an arbitrary Customer ID as proof of Cart ownership.

---

# 36. Tenant Isolation

All Cart queries must be Store-scoped.

Example:

```sql id="m7c4x8"
SELECT *
FROM carts
WHERE store_id = $1
  AND id = $2;
```

Additional Customer/guest ownership checks should then be applied.

---

# 37. Cart Security

Protect against:

```text id="q8m3c7"
Cart ID enumeration
Cross-tenant Cart access
Cross-customer Cart access
Guest token guessing
Unauthorized quantity modification
Tampered prices
```

Never trust client-supplied totals.

---

# 38. Cart Events

Potential events include:

```text id="v5m8c4"
CartCreated
CartItemAdded
CartItemUpdated
CartItemRemoved
CartConverted
CartExpired
```

Events should be used only where downstream behavior is actually required.

---

# 39. Cart and Checkout Boundary

Checkout owns the transition from shopping state to purchase attempt.

The boundary is:

```text id="x7c4m8"
Cart
 ↓
Checkout Service
 ↓
Recalculate Everything
 ↓
Reserve Inventory
 ↓
Process Payment
 ↓
Create Order
```

Cart should not orchestrate this workflow.

---

# 40. Cart Tests

Unit tests should cover:

```text id="m8c4x7"
[ ] Cart creation
[ ] Item addition
[ ] Duplicate item increment
[ ] Quantity updates
[ ] Item removal
[ ] Invalid quantity
[ ] Cart lifecycle
[ ] Cart expiration
[ ] Cart conversion
```

---

# 41. Integration Tests

Verify:

```text id="q5m8c4"
[ ] Cart persistence
[ ] Item persistence
[ ] Store scoping
[ ] Unique cart item constraint
[ ] Transaction rollback
[ ] Concurrent quantity updates
[ ] Customer association
```

---

# 42. API Tests

Test:

```text id="v8m3c7"
[ ] Get/create Cart
[ ] Add item
[ ] Update item
[ ] Remove item
[ ] Invalid Variant
[ ] Invalid quantity
[ ] Unauthorized Cart
[ ] Cross-tenant Cart
[ ] Cross-customer Cart
[ ] Expired Cart
```

---

# 43. Checkout Integration Tests

Verify:

```text id="x4c8m7"
Cart
 ↓
Checkout
 ↓
Price recalculation
 ↓
Discount calculation
 ↓
Inventory reservation
 ↓
Payment
 ↓
Order
 ↓
Cart conversion
```

Failure scenarios must also be tested.

---

# 44. Idempotency

Where Cart mutations can be retried, the implementation should define safe retry behavior.

Especially consider:

```text id="m7c4x8"
Add item
Update quantity
Cart merge
Cart conversion
```

The implementation should avoid duplicate effects from repeated requests.

---

# 45. Observability

Useful Cart operational events include:

```text id="q8m3c7"
Cart creation failures
Cart mutation failures
Cart expiration
Checkout conversion failures
Concurrent update conflicts
```

Do not log full customer carts unnecessarily.

---

# 46. Cart Implementation Sequence

Implement in this order:

```text id="v5m8c4"
1. Define Cart schema
2. Define Cart Item schema
3. Create migrations
4. Implement Cart repository
5. Implement Cart Item repository
6. Implement Cart domain model
7. Implement Cart lifecycle
8. Implement Cart ownership checks
9. Implement add-item operation
10. Implement quantity update
11. Implement item removal
12. Implement Cart totals
13. Implement expiration
14. Implement conversion
15. Implement merge if required
16. Implement Cart application services
17. Implement Cart DTOs
18. Implement Cart APIs
19. Integrate Product validation
20. Integrate Customer association
21. Integrate Checkout
22. Add unit tests
23. Add integration tests
24. Add API tests
25. Add concurrency tests
26. Verify tenant isolation
```

---

# 47. Definition of Done

Cart implementation is complete when:

```text id="x8m4c7"
[ ] Cart schema exists
[ ] Cart Item schema exists
[ ] Store ownership is enforced
[ ] Guest ownership is secure
[ ] Customer ownership is secure
[ ] Items can be added
[ ] Duplicate items are handled correctly
[ ] Quantities are validated
[ ] Items can be updated and removed
[ ] Display totals work
[ ] Checkout recalculates authoritative totals
[ ] Inventory is not reserved by Cart
[ ] Cart expiration works
[ ] Cart conversion works
[ ] Cart concurrency is safe
[ ] Cart APIs work
[ ] Product integration works
[ ] Customer integration works
[ ] Checkout integration works
[ ] Unit tests pass
[ ] Integration tests pass
[ ] API tests pass
[ ] Concurrency tests pass
[ ] Tenant isolation tests pass
```

The Cart should remain temporary shopping state. It is not an Order, not an Inventory reservation, and certainly not a second Checkout engine. Keeping that distinction intact now prevents a remarkable amount of cleanup later.