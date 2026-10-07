
# Cart Implementation Specification

## 1. Purpose

This document defines the implementation requirements for the **Carts** domain of the Shopify-like commerce platform.

The Cart module manages a customer's or guest's active shopping cart, including cart items, quantities, lifecycle, and the relationship between cart contents and purchasable product variants.

The Cart module prepares purchase intent. It does **not** own inventory reservation, checkout completion, payment processing, or order creation.

---

## 2. Scope

The Cart module owns:

- Cart creation.
- Cart identity.
- Cart lifecycle.
- Cart items.
- Item quantities.
- Product variant references.
- Cart ownership.
- Cart retrieval.
- Add/remove/update item operations.
- Cart clearing.
- Cart expiration where required.

The module does not own:

- Product catalog data.
- Inventory quantities.
- Inventory reservations.
- Checkout.
- Payments.
- Orders.
- Customer profile data.
- Discount rules.

---

## 3. Domain Position

The core relationship is:

```text
Store
  ↓
Cart
  ├── Cart Items
  │      ↓
  │   Product Variant
  │
  └── Customer / Guest Context
```

A Cart belongs to exactly one Store.

---

## 4. Module Location

Implementation belongs under:

```text
modules/carts/
```

Recommended structure:

```text
modules/carts/
├── application/
├── domain/
├── infrastructure/
└── index.ts
```

The module's public interfaces should be exposed through its entry point.

---

## 5. Layer Responsibilities

### Presentation

Responsible for:

- Request parsing.
- Authentication/session context.
- Store resolution.
- Authorization.
- Input validation.
- DTO mapping.
- HTTP responses.

### Application

Responsible for:

- Cart use cases.
- Transaction boundaries.
- Cart item operations.
- Coordination with Products and Inventory interfaces.

### Domain

Responsible for:

- Cart entity.
- Cart item entity/value objects.
- Cart lifecycle.
- Quantity rules.
- Cart invariants.

### Infrastructure

Responsible for:

- PostgreSQL persistence.
- Repository implementations.
- Queries.
- Persistence mapping.

---

## 6. Cart Entity

Conceptually:

```text
Cart
├── id
├── storeId
├── customerId? 
├── sessionId?
├── status
├── currency
├── createdAt
├── updatedAt
└── expiresAt?
```

The exact schema may evolve with implementation.

---

## 7. Cart Ownership

A Cart may belong to:

- An authenticated Customer.
- A guest session.

The ownership model must be explicit.

A guest cart must not be accessible merely by guessing a Cart ID.

---

## 8. Customer Cart

For authenticated customers:

```text
Customer
   ↓
Cart
```

The application must verify that the authenticated customer owns the Cart before modifying it.

---

## 9. Guest Cart

Guest carts may use a server-generated session/cart token.

The client may hold an opaque identifier, but authorization must remain server-side.

The Cart ID itself must not act as an authorization credential unless deliberately designed as a secure capability token.

---

## 10. Store Ownership

Every Cart belongs to one Store.

The effective access context is:

```text
Store
  ↓
Cart
  ↓
Owner / Guest Session
```

Cross-tenant cart access must be rejected.

---

## 11. Cart Status

A practical Demo state model is:

```text
ACTIVE
CONVERTED
ABANDONED
EXPIRED
```

The exact states must align with Checkout behavior.

---

## 12. Cart Lifecycle

Typical lifecycle:

```text
ACTIVE
  ↓
Checkout
  ↓
CONVERTED
```

Alternative:

```text
ACTIVE
  ↓
EXPIRED / ABANDONED
```

A converted cart must not continue accepting ordinary shopping operations unless explicitly supported.

---

## 13. Cart Item

Conceptually:

```text
CartItem
├── id
├── cartId
├── variantId
├── quantity
├── createdAt
└── updatedAt
```

The Cart Item references the Variant but does not duplicate the entire Product entity.

---

## 14. Variant Validation

When adding an item, the application must verify through the Products module that:

- The Variant exists.
- The Variant belongs to the current Store.
- The Variant is purchasable.
- The Variant is not archived/unavailable.

The Cart module must not directly inspect Product module internals.

---

## 15. Inventory Validation

Adding an item to a Cart does not automatically reserve inventory.

The Cart may perform an availability check where useful, but checkout must perform the authoritative inventory validation/reservation.

Therefore:

```text
Cart quantity
≠
Reserved inventory
```

---

## 16. Add Item

The add-item operation should:

1. Resolve Store.
2. Resolve Cart.
3. Verify ownership.
4. Validate Variant.
5. Validate requested quantity.
6. Find an existing Cart Item.
7. Create or update the item.
8. Commit.

If the item already exists, the operation should have explicitly defined quantity semantics.

---

## 17. Quantity Semantics

The API must distinguish between:

### Set quantity

```text
quantity = 5
```

and:

### Add quantity

```text
current quantity + 5
```

These operations must not be ambiguously combined.

---

## 18. Cart Quantity Rules

The system should enforce:

```text
quantity > 0
```

and a configured maximum quantity where appropriate.

Example:

```text
1 <= quantity <= MAX_CART_ITEM_QUANTITY
```

The maximum should be server-controlled.

---

## 19. Duplicate Cart Items

A Cart should normally contain only one item for a given Variant.

The database should enforce:

```text
unique(cart_id, variant_id)
```

This prevents duplicate rows caused by concurrent requests.

---

## 20. Updating an Item

Updating an item must:

1. Verify Cart ownership.
2. Verify item belongs to Cart.
3. Validate quantity.
4. Update the item.
5. Commit.

The operation must not allow modification of another Store's Cart Item.

---

## 21. Removing an Item

Removing an item should be idempotent where practical.

Repeated deletion should not corrupt Cart state.

Example:

```text
DELETE item
DELETE same item again
```

must not produce an inconsistent Cart.

---

## 22. Clearing a Cart

The Cart module may support:

```text
DELETE /api/v1/carts/{cartId}/items
```

or an equivalent operation.

Clearing a Cart must not modify Inventory reservations because the Cart itself does not own reservations.

---

## 23. Cart Totals

The Cart may expose calculated information such as:

- Subtotal.
- Item count.
- Currency.

However, Cart totals must not be treated as final checkout totals.

Prices may change between Cart creation and checkout.

---

## 24. Price Handling

The Cart should retrieve current product pricing through the appropriate Product interface.

Money must use exact representations.

Floating-point arithmetic must not be used for monetary calculations.

---

## 25. Price Snapshot

The Cart may store display-oriented pricing information if useful, but such values must not become the authoritative final price.

At checkout:

```text
Cart
  ↓
Recalculate
  ↓
Current Product Prices
  ↓
Discounts
  ↓
Final Checkout Total
```

---

## 26. Currency

A Cart should have a defined currency context.

The system must not silently mix currencies inside a single Cart.

For the Demo, the Store's configured currency can be the default currency source.

---

## 27. Cart and Discounts

The Cart may display discount effects where supported.

The Discounts module owns:

- Discount rules.
- Eligibility.
- Discount codes.
- Usage limits.

The Cart module must not implement discount business rules internally.

---

## 28. Cart and Checkout

Checkout consumes the Cart.

Typical flow:

```text
Cart
  ↓
Validate Cart
  ↓
Create Checkout
  ↓
Recalculate pricing
  ↓
Validate discounts
  ↓
Reserve inventory
  ↓
Process payment
  ↓
Create order
  ↓
Convert Cart
```

Checkout owns the orchestration.

---

## 29. Cart Conversion

After successful order creation:

```text
ACTIVE
  ↓
CONVERTED
```

The converted Cart should remain available for historical reference if required.

It must not silently return to `ACTIVE`.

---

## 30. Cart Abandonment

A Cart may become abandoned when:

- The customer explicitly abandons it.
- It remains inactive beyond a configured period.
- Checkout fails permanently.

The exact behavior should be defined by product requirements.

Abandonment is not the same as conversion.

---

## 31. Cart Expiration

If expiration is implemented, the Cart should contain an expiration timestamp.

A worker may process expired carts.

Cart expiration must not accidentally release inventory because ordinary Cart contents are not reservations.

---

## 32. Background Processing

Potential Cart jobs include:

- Expired Cart cleanup.
- Abandoned Cart classification.
- Cart lifecycle maintenance.

These jobs must be idempotent and safe to retry.

---

## 33. Cart Concurrency

Cart operations may occur concurrently.

Examples:

```text
Request A → add Variant X
Request B → add Variant X
```

The database must prevent duplicate Cart Items.

Quantity updates must avoid lost updates where concurrent mutation semantics require protection.

---

## 34. Concurrency Strategy

For concurrent updates, the implementation may use:

- Row-level locking.
- Atomic updates.
- Unique constraints.
- Transactional retry.

The chosen mechanism must match the operation's semantics.

---

## 35. Multi-Item Cart Updates

If an operation modifies multiple Cart Items atomically, all related writes should occur inside one transaction.

A partial Cart mutation must not occur when the operation contract requires all-or-nothing behavior.

---

## 36. Idempotency

Idempotency requirements depend on the operation.

Particularly important operations include:

- Cart creation where retried requests could create duplicates.
- Checkout initiation.
- Cart conversion.

Simple item updates may rely on deterministic set semantics and database constraints where appropriate.

---

## 37. Cart Creation

Cart creation should avoid accidentally creating multiple active carts for the same ownership context if the product model expects one active Cart.

If the Demo allows one active customer Cart per Store:

```text
unique(store_id, customer_id, active-state)
```

or equivalent application/database enforcement should be considered.

Guest carts may use session-based uniqueness.

---

## 38. Cart Retrieval

Cart retrieval must verify:

1. Store context.
2. Cart ownership.
3. Cart status.
4. Session/customer authorization.

A missing Cart should not reveal whether a Cart belonging to another tenant exists.

---

## 39. Tenant Isolation

Tenant isolation is mandatory.

Example:

```text
Store A
  ↓
Cart A

Store B request
  ↓
Cart A
  ↓
DENIED
```

All Cart queries must be Store-scoped.

---

## 40. Authorization

Potential permissions include:

```text
carts.read
carts.manage
```

Merchant access should be restricted according to the Store role.

Customers should normally access only their own Cart.

Guest users should access only their own guest Cart.

---

## 41. API Endpoints

Potential customer/storefront endpoints:

```text
GET    /api/v1/carts/{cartId}
POST   /api/v1/carts
POST   /api/v1/carts/{cartId}/items
PATCH  /api/v1/carts/{cartId}/items/{itemId}
DELETE /api/v1/carts/{cartId}/items/{itemId}
DELETE /api/v1/carts/{cartId}/items
```

The final API contract must follow the API architecture and versioning rules.

---

## 42. Cart Response

A Cart response may contain:

```text
Cart
├── id
├── status
├── currency
├── items
│   ├── variant
│   ├── quantity
│   └── pricing/display data
├── itemCount
└── subtotal
```

Only data required by the client should be returned.

---

## 43. API Validation

Validate at the boundary:

- Cart ID.
- Variant ID.
- Item ID.
- Quantity.
- Currency where supplied.
- Optional customer/session information.

Client-supplied ownership fields must not override server-resolved context.

---

## 44. Error Handling

Potential stable error codes:

```text
CART_NOT_FOUND
CART_ACCESS_DENIED
CART_NOT_ACTIVE
CART_ITEM_NOT_FOUND
INVALID_CART_ITEM
INVALID_CART_QUANTITY
PRODUCT_VARIANT_NOT_FOUND
PRODUCT_VARIANT_UNAVAILABLE
CART_ITEM_LIMIT_EXCEEDED
CART_CONFLICT
```

Internal database errors must not be exposed directly.

---

## 45. Database Constraints

Potential constraints include:

```text
quantity > 0
unique(cart_id, variant_id)
```

and appropriate foreign keys for:

```text
Cart → Store
Cart → Customer
CartItem → Cart
CartItem → Variant
```

The database remains the final integrity layer.

---

## 46. Database Indexing

Likely indexes include:

```text
store_id
customer_id
session_id
status
cart_id
cart_id + variant_id
created_at
updated_at
```

Indexes should reflect actual query patterns rather than being created indiscriminately.

---

## 47. Cart Events

Potential events:

```text
CartCreated
CartItemAdded
CartItemUpdated
CartItemRemoved
CartCleared
CartConverted
CartAbandoned
CartExpired
```

Events represent completed facts.

They must not be treated as synchronous commands.

---

## 48. Event Consumers

Potential consumers include:

- Checkout.
- Notifications.
- Analytics in future.
- Abandoned-cart workflows in future.

Consumers must use public module interfaces.

---

## 49. Product Deactivation

A Product Variant may become unavailable after it has been added to a Cart.

Therefore the Cart cannot assume that its contents remain purchasable forever.

At checkout:

```text
Cart
  ↓
Revalidate products
  ↓
Revalidate prices
  ↓
Revalidate inventory
```

---

## 50. Inventory Changes

Similarly, inventory can change after an item is added to the Cart.

The Cart should not reserve inventory merely because the item exists in the Cart.

Checkout performs the authoritative availability and reservation operation.

---

## 51. Transaction Boundaries

Application services own transaction boundaries.

Example:

```text
AddCartItemService
    ↓
BEGIN
    ↓
Validate ownership
    ↓
Validate variant
    ↓
Create/update CartItem
    ↓
COMMIT
```

External APIs should not be called while holding unnecessary database locks.

---

## 52. Repository Boundary

The Cart module may define repositories such as:

```text
CartRepository
CartItemRepository
```

Repositories belong to the Cart module.

Other modules must not directly query Cart tables.

---

## 53. Public Module Interface

Other modules should consume operations through explicit interfaces such as:

```text
getCart()
getActiveCart()
validateCart()
convertCart()
```

The exact interface should remain focused on business capabilities rather than exposing persistence details.

---

## 54. Testing Strategy

### Unit Tests

Test:

- Cart lifecycle.
- Quantity validation.
- Item rules.
- Ownership rules.
- State transitions.

### Integration Tests

Test:

- PostgreSQL persistence.
- Foreign keys.
- Unique Cart Item constraint.
- Concurrent item updates.
- Customer/guest ownership.
- Tenant isolation.

### API Tests

Test:

- Authentication.
- Authorization.
- Cart retrieval.
- Item creation.
- Item updates.
- Item deletion.
- Error contracts.

### E2E Tests

Test:

- Browse product.
- Add to Cart.
- Update quantity.
- Remove item.
- Start checkout.
- Successful conversion.
- Failed checkout behavior.

---

## 55. Critical Test Cases

```text
[ ] Cart belongs to correct Store
[ ] Cross-tenant Cart access is denied
[ ] Customer cannot access another customer's Cart
[ ] Guest cannot access another guest Cart
[ ] Variant must belong to Cart Store
[ ] Unavailable Variant cannot be added
[ ] Quantity cannot be zero or negative
[ ] Maximum quantity is enforced
[ ] Duplicate Variant creates one Cart Item
[ ] Concurrent add operations do not create duplicate items
[ ] Concurrent quantity updates preserve intended semantics
[ ] Cart totals use exact monetary representation
[ ] Cart does not incorrectly reserve inventory
[ ] Checkout revalidates Cart contents
[ ] Converted Cart cannot be modified normally
[ ] Cart expiration is safe to retry
[ ] Historical Cart data remains consistent
```

---

## 56. Implementation Sequence

Recommended implementation order:

```text
1. Define Cart domain model
2. Define Cart Item model
3. Define ownership model
4. Define Cart lifecycle
5. Define database schema
6. Create migrations
7. Implement Cart repository
8. Implement Cart Item repository
9. Implement Cart application services
10. Integrate Product validation
11. Implement authorization
12. Implement APIs
13. Implement Cart conversion
14. Implement lifecycle jobs where required
15. Add idempotency where required
16. Add unit tests
17. Add integration tests
18. Add concurrency tests
19. Add API tests
20. Add E2E checkout tests
```

---

## 57. Demo Simplifications

The Demo intentionally does not require:

- Persistent cross-device cart synchronization.
- Advanced cart recovery.
- Saved carts.
- Multiple carts per customer.
- Complex cart merging.
- Cart recommendations.
- Advanced abandoned-cart marketing.
- Distributed cart storage.
- Redis-based cart sessions.

PostgreSQL remains the authoritative Cart store.

---

## 58. V1 Evolution

The Cart module can later support:

- Multi-device synchronization.
- Cart merging.
- Saved carts.
- Advanced cart recovery.
- Redis caching where justified.
- High-volume cart workloads.
- Cart personalization.
- Advanced promotions.
- External commerce integrations.

These additions should preserve the existing Cart domain boundary.

---

## 59. Definition of Done

The Cart implementation is complete when:

```text
[ ] Cart entity exists
[ ] Cart Item entity exists
[ ] Store ownership is enforced
[ ] Customer ownership is enforced
[ ] Guest ownership is secure
[ ] Cart lifecycle exists
[ ] Add item works
[ ] Update quantity works
[ ] Remove item works
[ ] Clear Cart works
[ ] Variant validation exists
[ ] Quantity validation exists
[ ] Duplicate Cart Items are prevented
[ ] Cart totals are correctly represented
[ ] Currency handling is defined
[ ] Inventory is not incorrectly reserved
[ ] Checkout integration exists
[ ] Cart conversion exists
[ ] Tenant isolation is enforced
[ ] Authorization is enforced
[ ] Database constraints exist
[ ] Appropriate indexes exist
[ ] Idempotency is applied where required
[ ] Concurrency behavior is tested
[ ] Unit tests exist
[ ] Integration tests exist
[ ] API tests exist
[ ] E2E coverage exists
[ ] Documentation matches implementation
```