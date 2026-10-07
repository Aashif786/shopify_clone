# Carts Domain Build Implementation

## 1. Purpose

This document defines the concrete implementation approach for the Carts domain in the Demo.

The Cart represents a customer's intended purchase before checkout. It must support both guest and authenticated customer flows while remaining Store-scoped and safe under concurrent requests.

The Cart is **not** the final authority for pricing, inventory availability, discounts, payment state, or order creation. Checkout performs the authoritative finalization.

---

# 2. Domain Ownership

The Carts module owns:

- Cart identity.
- Guest carts.
- Customer carts.
- Cart lifecycle.
- Cart items.
- Item quantities.
- Cart-to-Store association.
- Cart-to-Customer association where applicable.
- Cart expiration.
- Basic cart totals for display where required.

It does not own:

- Product definitions.
- Inventory quantities.
- Inventory reservations.
- Discount rules.
- Payment processing.
- Checkout finalization.
- Orders.
- Customer profile data.

---

# 3. Module Location

Implementation belongs under:

```text id="a4k9r7"
modules/carts/
```

Recommended structure:

```text id="m8q5v3"
modules/carts/
├── domain/
├── application/
├── infrastructure/
└── index.ts
```

The exact internal structure should follow established repository conventions.

---

# 4. Cart Ownership Model

Every Cart belongs to exactly one Store.

Conceptually:

```text id="x7r4m8"
Store
  ↓
Cart
  ├── Cart Items
  └── Customer where applicable
```

Store ownership must never be inferred from a client-provided cart ID alone.

---

# 5. Guest and Customer Carts

The Demo supports:

```text id="q5m8r4"
Guest Cart
Customer Cart
```

A guest cart may exist without an authenticated User.

An authenticated Customer cart is associated with the appropriate customer identity.

---

# 6. Cart Identity

A Cart should contain information such as:

```text id="v6r4m7"
id
storeId
customerId where applicable
status
expiresAt where applicable
createdAt
updatedAt
```

The exact schema remains defined by the database specification.

---

# 7. Cart Item

A Cart Item references a purchasable Product Variant.

Typical information includes:

```text id="m4q8r5"
id
cartId
variantId
quantity
unit price snapshot where required
createdAt
updatedAt
```

The exact persisted pricing fields must follow the approved schema.

---

# 8. Variant References

The Cart stores Variant identity.

It must not copy the entire Product entity into the Cart.

When reading or modifying a Cart Item, the system must verify that the Variant belongs to the same Store.

---

# 9. Adding an Item

The basic flow is:

```text id="x8r5m4"
Resolve Cart
    ↓
Verify Store context
    ↓
Validate Variant
    ↓
Validate quantity
    ↓
Verify Variant belongs to Store
    ↓
Add/update Cart Item
    ↓
Persist transactionally
    ↓
Return Cart DTO
```

---

# 10. Adding the Same Variant

If the same Variant is added to an existing Cart, the application must follow one explicit quantity rule.

For the Demo:

```text id="q7m4r8"
existing quantity
+
requested quantity
=
new quantity
```

The resulting quantity must still satisfy the allowed quantity limits.

---

# 11. Quantity Validation

Cart quantity must:

- Be an integer.
- Be greater than zero.
- Remain within the configured maximum.
- Never be negative.
- Never overflow application/database limits.

The Cart must not accept arbitrary quantities simply because PostgreSQL can store them.

---

# 12. Cart Quantity vs Inventory

Adding an item to a Cart does **not** automatically mean inventory has been reserved.

The Cart records customer intent.

Inventory reservation happens during the approved Checkout workflow.

---

# 13. Updating Quantity

Updating a Cart Item should:

1. Resolve the Cart.
2. Verify Store ownership.
3. Verify customer/guest ownership.
4. Validate quantity.
5. Verify Variant relationship.
6. Update the Cart Item.
7. Recalculate display totals if required.
8. Return the updated Cart.

---

# 14. Removing an Item

Removing an item should be an explicit operation.

Conceptually:

```text id="v5r8m4"
removeCartItem(cartId, itemId)
```

The operation must verify that the item belongs to the requested Cart.

---

# 15. Clearing a Cart

If supported, clearing a Cart should remove or deactivate all Cart Items according to the approved persistence model.

It must not modify:

```text id="m6q4r8"
Inventory
Orders
Payments
Customer records
```

---

# 16. Cart Lifecycle

The Cart lifecycle should follow the approved state machine.

Typical states may include:

```text id="x7m5r8"
ACTIVE
CHECKOUT
COMPLETED
EXPIRED
ABANDONED
```

The exact state set remains authoritative from the domain specification.

---

# 17. State Transitions

Cart state changes must occur through explicit operations.

Examples:

```text id="q8r4m6"
startCheckout()
complete()
expire()
abandon()
```

Arbitrary status updates must not be exposed through generic APIs.

---

# 18. Checkout Transition

When Checkout begins, the Cart should enter the appropriate state according to the approved workflow.

Checkout must verify that the Cart is still eligible for checkout.

---

# 19. Cart Completion

A Cart becomes completed only as part of a successful purchase workflow.

The Cart domain must not independently assume that payment succeeded.

The Checkout/Order workflow establishes the completed purchase.

---

# 20. Cart Expiration

Guest and inactive carts may expire according to the configured Demo policy.

Expiration should be deterministic and safe to retry.

An expired Cart must not silently become active again without an explicit supported operation.

---

# 21. Cart Ownership

For customer carts, access must verify the authenticated customer's relationship to the Cart.

For guest carts, access must use the approved guest-cart mechanism.

A Cart ID alone must not be sufficient to access another user's Cart.

---

# 22. Guest Cart Security

Guest cart identifiers should be treated as sensitive access tokens where they grant access.

Do not expose predictable sequential identifiers as the sole security mechanism if the approved identifier strategy requires stronger protection.

---

# 23. Customer Cart Security

A customer must not be able to access another customer's Cart by changing:

```text id="m5r8v4"
cartId
customerId
```

in the request.

Customer ownership is resolved server-side.

---

# 24. Merchant Access

Merchant users do not automatically gain unrestricted access to every Cart simply because they belong to a Store.

Merchant cart-management capabilities must be explicitly defined and authorized.

---

# 25. Tenant Isolation

Every Cart operation must establish Store ownership.

The following must never succeed:

```text id="x6q4m8"
Store A context
    ↓
Cart belonging to Store B
    ↓
Read/update/delete
```

---

# 26. Product Integration

Cart depends on Products for Variant identity.

The Cart may request:

```text id="v7r5m4"
Variant exists
Variant belongs to Store
Variant is eligible for cart use
```

The Cart must not access Product persistence directly if doing so violates module boundaries.

---

# 27. Product State Changes

A Variant may become inactive after being added to a Cart.

The Cart does not need to continuously rewrite itself.

Checkout must revalidate product eligibility before purchase.

---

# 28. Inventory Integration

Cart should not reserve inventory during normal add-to-cart operations.

Before checkout completion, Checkout coordinates with Inventory to obtain an authoritative reservation.

---

# 29. Pricing

Cart totals may be displayed for user experience.

They are not authoritative for final payment.

The Checkout workflow must recalculate:

```text id="m8q5r4"
product prices
quantities
discounts
totals
```

using current authoritative data.

---

# 30. Stale Cart Prices

A Cart may contain pricing information that becomes stale.

This is acceptable for display.

At checkout:

```text id="x4r7m6"
Cart price
    ↓
recalculated
    ↓
authoritative checkout price
```

The customer should receive a clear response if the final amount changed according to the approved UX.

---

# 31. Discounts

The Cart may store a selected discount code for display or checkout preparation if required.

Discount eligibility and final calculation belong to the Discounts/Checkout domains.

The Cart must not independently determine authoritative discount validity.

---

# 32. Cart Totals

If totals are persisted, they must be recalculated whenever relevant Cart data changes.

If totals are calculated dynamically, the implementation must use a consistent query/service.

Avoid having multiple independent total-calculation implementations.

---

# 33. Money

All monetary calculations must use the approved exact money representation.

Never use JavaScript floating-point arithmetic for authoritative monetary calculations.

---

# 34. Cart Item Uniqueness

The database should enforce the appropriate uniqueness relationship between:

```text id="q6m8r4"
cartId
variantId
```

if the Demo model allows only one Cart Item per Variant.

This prevents duplicate rows representing the same Variant unintentionally.

---

# 35. Concurrent Cart Updates

Concurrent requests may modify the same Cart.

Examples:

```text id="v5r7m8"
Two browser tabs add the same Variant
Two requests update quantity
Add and remove occur simultaneously
```

The implementation must define transaction behavior for these cases.

---

# 36. Quantity Update Concurrency

A quantity mutation must not accidentally overwrite a newer customer update because of stale client state.

Where required, use:

- Transactional updates.
- Row locking.
- Atomic SQL operations.
- Optimistic concurrency checks.

Choose the simplest mechanism that satisfies the actual operation.

---

# 37. Add-to-Cart Idempotency

Ordinary add-to-cart requests may be retried by clients.

The implementation must clearly define whether retries:

```text id="m7q4r8"
repeat the quantity addition
```

or:

```text id="x8r5m4"
return the previous result without applying it again
```

The behavior must match the API contract.

Do not accidentally introduce duplicate quantity through ambiguous retry semantics.

---

# 38. Checkout Idempotency

Checkout completion is more critical than normal Cart operations.

The Checkout domain owns the authoritative idempotency mechanism for purchase completion.

The Cart domain must cooperate with that mechanism rather than creating a competing checkout identity system.

---

# 39. Cart Expiration Job

Expired carts may be processed asynchronously.

A job should:

1. Find eligible expired carts.
2. Claim work safely.
3. Verify Cart state.
4. Transition the Cart exactly once.
5. Complete the job.

The operation must be safe under multiple workers.

---

# 40. Events

The Cart domain may emit events such as:

```text id="q4m8r7"
CartCreated
CartItemAdded
CartItemUpdated
CartItemRemoved
CartExpired
CartCheckoutStarted
CartCompleted
```

Events represent facts that have already occurred.

---

# 41. Event Payloads

Events should contain only the information required by consumers.

Avoid embedding:

```text id="v6r5m8"
full customer profile
payment credentials
full request body
```

in Cart events.

---

# 42. Application Services

Cart application services coordinate:

```text id="m8q4r6"
Authentication/guest context
Store resolution
Cart ownership
Validation
Product/Variant verification
Transaction
Cart mutation
DTO mapping
Events
```

---

# 43. Repository Design

Repositories should be Store-aware and Cart-aware.

Examples:

```text id="x5r7m4"
findCartById(storeId, cartId)
findActiveCartForCustomer(storeId, customerId)
findCartItem(cartId, itemId)
createCart(...)
addCartItem(...)
updateCartItem(...)
```

Avoid unrestricted global queries.

---

# 44. DTOs

Use explicit DTOs.

Examples:

```text id="q7m5r8"
CartDTO
CartItemDTO
CartSummaryDTO
CartTotalsDTO
```

The DTO should expose only information appropriate to the caller.

---

# 45. API Integration

Cart API handlers should remain thin.

Conceptually:

```text id="v4m8r6"
HTTP Request
    ↓
Authenticate / Resolve Guest
    ↓
Resolve Store
    ↓
Validate
    ↓
Authorize Cart ownership
    ↓
Cart Application Service
    ↓
DTO
```

---

# 46. Error Handling

Use the centralized error system.

Examples:

```text id="m6r4q8"
CART_NOT_FOUND
CART_ACCESS_DENIED
CART_EXPIRED
CART_NOT_ACTIVE
CART_ITEM_NOT_FOUND
INVALID_CART_QUANTITY
VARIANT_NOT_AVAILABLE
CART_CONCURRENCY_CONFLICT
```

Exact codes should follow the shared error contract.

---

# 47. API Validation

Validate:

```text id="x8m5r4"
Cart ID
Item ID
Variant ID
Quantity
Pagination
Allowed filters
```

Do not trust client-supplied Store or Customer ownership fields.

---

# 48. Testing Strategy

### Unit Tests

Test:

```text id="q5r8m4"
Quantity rules
Cart lifecycle
Item addition/removal
State transitions
Expiration rules
```

### Integration Tests

Test:

```text id="v7m4r6"
Database persistence
Store isolation
Cart ownership
Item uniqueness
Concurrent updates
Transactions
```

### API Tests

Test:

```text id="m8q4r5"
Guest cart access
Customer cart access
Authorization
Validation
DTOs
Error mapping
```

---

# 49. Security Tests

At minimum verify:

```text id="x6r5m8"
[ ] Store A cannot access Store B carts
[ ] Customer A cannot access Customer B cart
[ ] Guest cart cannot be accessed without the required guest credential
[ ] Client cannot override Store ownership
[ ] Client cannot override Customer ownership
[ ] Merchant access follows explicit permissions
[ ] Cart data does not leak sensitive customer information
```

---

# 50. Concurrency Tests

Test at least:

```text id="q8m4r6"
Concurrent add of same Variant
Concurrent quantity updates
Concurrent remove/update
Cart expiration vs active mutation
Cart checkout start vs cart modification
```

The final state must follow the defined Cart state machine.

---

# 51. Checkout Integration Test

A complete Cart-to-Checkout test should verify:

```text id="v5r7m4"
Create Cart
    ↓
Add Variant
    ↓
Update quantity
    ↓
Start Checkout
    ↓
Cart becomes checkout-eligible/in required state
    ↓
Checkout revalidates contents
    ↓
Inventory reservation occurs
    ↓
Payment/order workflow proceeds
```

A failed payment must not leave the Cart in an ambiguous state.

---

# 52. Implementation Order

Implement Carts in this order:

```text id="m7q4r8"
1. Database schema and constraints
2. Cart domain model
3. Cart Item model
4. Repository interfaces
5. Persistence implementation
6. Guest/customer ownership resolution
7. Cart creation/resolution
8. Add/update/remove item operations
9. Cart lifecycle
10. Totals/display calculations
11. Expiration
12. Events
13. API DTOs and handlers
14. Unit tests
15. Integration tests
16. Concurrency/security tests
17. Checkout integration
```

---

# 53. AI Implementation Rules

AI agents implementing Carts must:

1. Read the actual root `AGENTS.md`.
2. Read Cart, Product, Inventory, Checkout, and API specifications.
3. Preserve Store isolation.
4. Preserve guest/customer ownership rules.
5. Never treat Cart totals as final payment authority.
6. Never reserve inventory merely because an item was added unless explicitly required.
7. Never bypass Checkout for purchase completion.
8. Preserve retry and idempotency semantics.
9. Add concurrency tests.
10. Avoid unrelated domain changes.
11. Review the final diff.

---

# 54. Definition of Done

Cart implementation is complete when:

```text id="x4r8m6"
[ ] Guest carts work
[ ] Customer carts work
[ ] Store ownership is enforced
[ ] Cart item operations work
[ ] Quantity rules are enforced
[ ] Variant references are validated
[ ] Duplicate Variant handling is deterministic
[ ] Cart lifecycle works
[ ] Expiration works
[ ] Display totals are correct
[ ] Checkout recalculates authoritative totals
[ ] Cart concurrency is handled
[ ] Retry semantics are defined
[ ] Tenant isolation is enforced
[ ] Authorization is enforced
[ ] Stable error codes are used
[ ] Events follow approved contracts
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Concurrency tests pass
[ ] Security tests pass
[ ] TypeScript passes
[ ] Lint passes
```

---

# 55. Final Principle

A Cart represents **intent**, not a completed transaction.

Its responsibility is:

```text id="m5q7r4"
What does the customer currently intend to buy?
```

Checkout determines:

```text
What can actually be purchased?
What does it cost now?
Is inventory available?
Was payment successful?
```

Orders determine:

```text
What was actually purchased?
```

Keeping that distinction intact prevents stale carts from becoming accidental sources of truth, which is exactly the sort of tiny architectural shortcut that eventually grows teeth.