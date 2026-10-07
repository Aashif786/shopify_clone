# Checkout Implementation

## 1. Purpose

This document defines the concrete implementation of the Checkout domain for the Demo.

Checkout is the orchestration boundary between temporary shopping state and a completed purchase.

It coordinates:

- Cart validation.
- Product and price revalidation.
- Customer information.
- Discount calculation.
- Inventory reservation.
- Payment initiation.
- Checkout state.
- Order creation.
- Cart conversion.
- Failure and cancellation handling.
- Idempotency.

Checkout is one of the most critical transaction workflows in the platform.

---

# 2. Domain Ownership

Checkout implementation belongs to:

```text id="c8m4x7"
modules/checkout
```

The module owns:

- Checkout state.
- Checkout items/snapshots.
- Checkout lifecycle.
- Checkout application services.
- Purchase orchestration.
- Checkout-level idempotency coordination.

It does not own:

```text id="q7m3c8"
Cart internals
Inventory internals
Payment provider internals
Order internals
Discount internals
Product catalog internals
```

---

# 3. Checkout Dependencies

Checkout interacts with other domains through public interfaces:

```text id="v5c8m4"
Cart
Products
Inventory
Customers
Discounts
Payments
Orders
```

Conceptually:

```text id="x8m4c7"
Checkout
 ├── Cart
 ├── Products
 ├── Customers
 ├── Discounts
 ├── Inventory
 ├── Payments
 └── Orders
```

Checkout coordinates these dependencies but does not take ownership of their internal state.

---

# 4. Checkout Model

A Checkout record may contain:

```text id="m7c4x8"
id
store_id
cart_id
customer_id
status
currency
subtotal
discount_total
total
expires_at
created_at
updated_at
```

The exact schema follows the database specification.

---

# 5. Checkout Items

Checkout should preserve the purchase inputs required to maintain a stable transaction.

An item may contain:

```text id="q8m3c7"
id
checkout_id
variant_id
product_title
variant_title
sku
unit_price
quantity
line_total
```

The exact snapshot fields follow the Checkout specification.

---

# 6. Why Checkout Snapshots Matter

The Cart can change after Checkout begins.

Products can also change.

Therefore Checkout should establish authoritative purchase information rather than continuously trusting mutable catalog state.

This prevents checkout calculations from silently changing midway through the purchase.

---

# 7. Checkout Status

Use explicit states.

Example:

```text id="v4m8c7"
Created
PendingPayment
Paid
Completed
Failed
Cancelled
Expired
```

The exact state machine must follow the Checkout specification.

---

# 8. Checkout State Machine

A simplified flow is:

```text id="x7c4m8"
Created
   ↓
PendingPayment
   ├──→ Paid
   ├──→ Failed
   ├──→ Cancelled
   └──→ Expired

Paid
   ↓
Completed
```

Invalid transitions must be rejected.

---

# 9. Checkout Creation

Creating Checkout should:

1. Resolve Store context.
2. Resolve Cart.
3. Verify Cart ownership.
4. Verify Cart is active.
5. Load current Product/Variant data.
6. Validate quantities.
7. Recalculate prices.
8. Validate Customer.
9. Validate Discount.
10. Calculate authoritative totals.
11. Create Checkout.
12. Persist Checkout items.

The operation should be transactional where the persistence requirements require it.

---

# 10. Cart Validation

Before creating Checkout:

```text id="m8c4x7"
Cart exists
Cart belongs to Store
Cart belongs to current customer/guest
Cart is active
Cart contains at least one item
```

An expired, converted, or invalid Cart cannot be checked out.

---

# 11. Product Revalidation

Checkout must revalidate every Cart item.

Verify:

```text id="q5m8c4"
Variant exists
Variant belongs to Store
Product is eligible for sale
Variant is active
Current price is valid
```

The client cannot submit authoritative Product or Variant information.

---

# 12. Price Recalculation

Checkout must calculate the authoritative purchase price.

Flow:

```text id="v8m3c7"
Cart Items
   ↓
Current Product/Variant Prices
   ↓
Line Totals
   ↓
Subtotal
   ↓
Discount
   ↓
Final Total
```

Never trust:

```text id="x4c8m7"
clientTotal
clientDiscount
clientUnitPrice
```

---

# 13. Money Handling

All monetary calculations must use exact arithmetic.

Do not use floating-point arithmetic for:

- Unit prices.
- Line totals.
- Discounts.
- Checkout totals.
- Payment amounts.

The representation must remain consistent with the database and payment specifications.

---

# 14. Discount Integration

Checkout passes authoritative purchase information to the Discount domain.

Conceptually:

```text id="m7c4x8"
Checkout
   ↓
Discount Validation
   ↓
Discount Calculation
   ↓
Discount Result
   ↓
Final Total
```

Checkout owns orchestration.

Discount owns discount rules.

---

# 15. Customer Integration

Checkout may be associated with a Customer.

The Customer must:

- Belong to the current Store.
- Be valid for the operation.
- Be accessible under the current authentication/guest rules.

The Checkout should preserve the customer reference required for the eventual Order.

---

# 16. Guest Checkout

If guest checkout is supported:

```text id="q8m3c7"
Guest
 ↓
Cart
 ↓
Checkout
 ↓
Payment
 ↓
Order
```

The workflow must not require a merchant membership.

Guest checkout must still be Store-scoped and secure.

---

# 17. Inventory Validation

Checkout must verify current inventory availability before purchase completion.

However, validation alone is insufficient.

The authoritative protection is:

```text id="v5c8m4"
Inventory Reservation
```

The system must reserve stock atomically before treating the purchase as ready for payment/completion according to the payment strategy.

---

# 18. Inventory Reservation

Reservation flow:

```text id="x7m4c8"
Checkout
 ↓
Inventory.reserve()
 ↓
Reservation IDs
 ↓
Continue purchase workflow
```

Checkout must retain enough information to release reservations if the workflow fails.

---

# 19. Reservation Failure

If inventory cannot be reserved:

```text id="m8c4x7"
Checkout remains incomplete
Payment should not be treated as successful
No Order should be created
```

Return an appropriate business error such as:

```text id="q4m8c7"
INSUFFICIENT_INVENTORY
```

---

# 20. Payment Integration

Checkout coordinates payment through the Payments public interface.

Conceptually:

```text id="v8m3c7"
Checkout
   ↓
Payment Intent / Attempt
   ↓
Provider
   ↓
Payment Result / Webhook
   ↓
Checkout State
```

Checkout must not directly call provider SDKs.

---

# 21. Payment Ordering

The exact sequence depends on the payment provider, but the implementation must guarantee that:

- Inventory is not permanently consumed without a valid purchase.
- Successful payment can be reconciled.
- Failed payment releases temporary reservations where appropriate.
- Retries cannot create duplicate charges or Orders.

---

# 22. Checkout Idempotency

Checkout completion is a critical idempotent operation.

A client retry must not create:

```text id="x5c8m4"
Two Orders
Two payments
Two inventory deductions
```

The operation must use the established PostgreSQL-backed idempotency strategy.

---

# 23. Idempotency Flow

Conceptually:

```text id="m7c4x8"
Request
 ↓
Idempotency Key
 ↓
Check Existing Operation
 ↓
If Completed → Return Existing Result
 ↓
If New → Execute Safely
 ↓
Persist Result
```

Concurrent requests using the same key must be serialized safely.

---

# 24. Checkout Completion

Successful completion should result in:

```text id="q8m3c7"
Valid Checkout
      ↓
Payment Confirmed
      ↓
Inventory Finalized
      ↓
Order Created
      ↓
Cart Converted
      ↓
Checkout Completed
```

The exact transaction boundaries depend on the external payment workflow.

---

# 25. Order Creation

Order creation must happen through the Order domain's public application interface.

Checkout should provide:

- Store context.
- Customer context.
- Purchase items.
- Authoritative prices.
- Discount result.
- Billing information.
- Shipping information where supported.
- Payment reference.

Order owns the resulting Order record.

---

# 26. Historical Snapshots

The Order must retain historical information required to reproduce the completed purchase.

Checkout should therefore provide stable purchase data rather than references that depend on mutable Product records.

---

# 27. Cart Conversion

After successful Order creation:

```text id="v4m8c7"
Cart
 ↓
Converted
```

A converted Cart must not be reused.

If Cart conversion fails, the overall completion workflow must handle the failure safely rather than returning false success.

---

# 28. Checkout Failure

Failures must be classified.

Examples:

```text id="x8c4m7"
Cart expired
Product unavailable
Price changed
Invalid discount
Inventory unavailable
Payment declined
Payment provider unavailable
Order creation conflict
```

Each failure should produce the appropriate Checkout state and recovery behavior.

---

# 29. Payment Failure

A declined payment is a business outcome.

Typical flow:

```text id="m5c8x4"
Payment Declined
      ↓
Checkout remains incomplete
      ↓
Release Inventory Reservation
      ↓
Allow Retry if valid
```

The exact retry behavior depends on Payment state.

---

# 30. Provider Failure

A temporary payment-provider failure should not automatically mark the Checkout as permanently failed.

It may instead remain pending or enter an explicitly retryable state.

Do not confuse:

```text id="q7m4c8"
Payment Declined
```

with:

```text
Payment Provider Unavailable
```

---

# 31. Checkout Expiration

Checkouts should expire after the configured lifetime where applicable.

Expiration should:

1. Verify Checkout is still active.
2. Release active inventory reservations.
3. Update Checkout state.
4. Prevent new completion attempts.
5. Preserve historical diagnostic information.

Expiration should be safe to run repeatedly.

---

# 32. Checkout Cancellation

Cancellation should use an explicit state transition.

For example:

```text id="v8m3c7"
PendingPayment → Cancelled
```

Cancellation should release active inventory reservations.

Already finalized inventory must not be released again.

---

# 33. Checkout State Concurrency

Concurrent completion/cancellation/expiration must be safe.

Example:

```text id="x5m8c4"
Request A → Complete
Request B → Cancel
Worker    → Expire
```

Only a valid state transition may succeed.

Use transactions, row locks, state checks, and idempotency as appropriate.

---

# 34. Transaction Boundaries

The Checkout application service owns transactions for database state transitions.

Do not hold a database transaction open across slow external provider operations unless the exact integration explicitly requires it.

For external payment flows, use a state-machine-based orchestration approach.

---

# 35. Checkout Repository

The repository should provide focused operations such as:

```text id="m8c4x7"
create
findById
findActiveByCart
updateState
saveItems
lockForUpdate
```

Mutating operations must respect Store scope.

---

# 36. Checkout Application Services

Typical services:

```text id="q5m8c4"
createCheckout
getCheckout
recalculateCheckout
applyDiscount
completeCheckout
cancelCheckout
expireCheckout
```

The exact service boundaries should follow the implementation conventions.

---

# 37. Checkout DTOs

Use explicit DTOs:

```text id="v7m3c8"
CheckoutSummary
CheckoutDetail
CheckoutItem
CreateCheckoutInput
CompleteCheckoutInput
```

Do not expose database records directly.

---

# 38. Checkout API

Typical endpoints:

```text id="x4c8m7"
POST /api/v1/checkout
GET  /api/v1/checkout/:id
POST /api/v1/checkout/:id/complete
POST /api/v1/checkout/:id/cancel
```

Exact routes must follow the API contract.

---

# 39. Checkout Authorization

For authenticated checkout:

```text id="m7c4x8"
User
 ↓
Customer
 ↓
Store
 ↓
Checkout
```

For guest checkout:

```text id="q8m3c7"
Guest Context
 ↓
Store
 ↓
Checkout
```

Every access path must be validated server-side.

---

# 40. Tenant Isolation

Every Checkout operation must verify:

```text id="v5c8m4"
Checkout.store_id
=
Current Store Context
```

Associated resources must also belong to the same Store:

```text id="x7m4c8"
Cart
Customer
Product Variants
Discount
Inventory
Order
```

---

# 41. Checkout Events

Potential events include:

```text id="m8c4x7"
CheckoutCreated
CheckoutPaymentPending
CheckoutPaid
CheckoutCompleted
CheckoutCancelled
CheckoutExpired
CheckoutFailed
```

Events should represent state transitions that have actually been committed.

---

# 42. Checkout Jobs

Background processing may handle:

```text id="q4m8c7"
Checkout expiration
Payment reconciliation
Reservation cleanup
```

Jobs must carry the required Store context and remain idempotent.

---

# 43. Checkout Observability

Useful operational identifiers include:

```text id="v8m3c7"
checkoutId
cartId
storeId
customerId where appropriate
paymentId
orderId
```

Critical failures should be visible through structured logs and monitoring.

---

# 44. Checkout Security

Protect against:

```text id="x5c8m4"
Tampered prices
Tampered discounts
Cross-tenant checkout access
Duplicate completion
Replay attacks
Cart ownership bypass
Inventory race conditions
Payment replay
```

Never accept client-provided totals as authoritative.

---

# 45. Checkout Tests

Unit tests should cover:

```text id="m7c4x8"
[ ] Valid Checkout creation
[ ] Empty Cart rejection
[ ] Invalid Product rejection
[ ] Price recalculation
[ ] Discount calculation
[ ] Invalid discount
[ ] Checkout state transitions
[ ] Expiration
[ ] Cancellation
```

---

# 46. Integration Tests

Verify:

```text id="q8m3c7"
[ ] Cart integration
[ ] Product validation
[ ] Customer integration
[ ] Discount integration
[ ] Inventory reservation
[ ] Payment integration
[ ] Order creation
[ ] Cart conversion
[ ] Transaction rollback
```

---

# 47. Concurrency Tests

Mandatory scenarios include:

```text id="v4m8c7"
[ ] Two completion requests
[ ] Completion + cancellation
[ ] Completion + expiration
[ ] Duplicate idempotency key
[ ] Different requests with same idempotency key
[ ] Concurrent inventory reservation
[ ] Payment webhook + client completion
```

Only one valid purchase outcome may be produced.

---

# 48. Failure Recovery Tests

Verify:

```text id="x7c4m8"
[ ] Inventory reservation fails
[ ] Payment declines
[ ] Payment provider times out
[ ] Payment webhook arrives late
[ ] Order creation fails
[ ] Worker retries completion-related work
[ ] Checkout expires during pending payment
```

No scenario should produce an untracked successful payment or silently lost inventory.

---

# 49. Checkout Implementation Sequence

Implement in this order:

```text id="m8c4x7"
1. Define Checkout schema
2. Define Checkout Item schema
3. Create migrations
4. Implement Checkout repository
5. Implement Checkout state machine
6. Implement Checkout application service
7. Implement Cart validation
8. Implement Product revalidation
9. Implement price calculation
10. Integrate Discount calculation
11. Integrate Customer
12. Integrate Inventory reservation
13. Integrate Payment interface
14. Integrate Order creation
15. Implement Cart conversion
16. Implement expiration/cancellation
17. Implement idempotency
18. Implement Checkout APIs
19. Implement Checkout events
20. Implement expiration/reconciliation jobs
21. Add unit tests
22. Add integration tests
23. Add concurrency tests
24. Add failure-recovery tests
25. Verify tenant isolation
```

---

# 50. Definition of Done

Checkout implementation is complete when:

```text id="q5m8c4"
[ ] Checkout schema exists
[ ] Checkout items exist
[ ] Checkout state machine is enforced
[ ] Cart validation works
[ ] Product prices are revalidated
[ ] Totals are calculated authoritatively
[ ] Discounts are validated and calculated
[ ] Customer association works
[ ] Inventory reservation works
[ ] Payment integration works
[ ] Order creation works
[ ] Cart conversion works
[ ] Cancellation works
[ ] Expiration works
[ ] Idempotency prevents duplicate completion
[ ] Concurrent completion is safe
[ ] Payment failures are recoverable
[ ] Tenant isolation works
[ ] Checkout APIs work
[ ] Events/jobs work where required
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Concurrency tests pass
[ ] Failure-recovery tests pass
```

Checkout is the point where the platform stops merely remembering what a customer wanted and starts attempting to turn that intent into a real purchase. Every transition therefore needs to be deliberate, idempotent, and recoverable. Human beings already have enough ways to accidentally buy the same thing twice.