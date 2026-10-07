# Checkout and Payment Vertical Slice Build Implementation

## 1. Purpose

This document defines the implementation of the Checkout and Payment vertical slice for the Demo.

This is the most critical transactional slice in the commerce platform. It connects:

```text
Cart
  ↓
Checkout
  ↓
Pricing
  ↓
Discount
  ↓
Inventory Reservation
  ↓
Payment
  ↓
Order
```

The implementation must prioritize correctness over convenience.

A customer must never be charged twice, reserve inventory incorrectly, or receive a false successful Order because of retries, concurrent requests, provider timeouts, or webhook duplication.

---

# 2. Slice Objective

The completed slice must support:

- Creating Checkout from a valid Cart.
- Revalidating Product information.
- Recalculating authoritative pricing.
- Applying valid discounts.
- Collecting required customer/order information.
- Reserving Inventory.
- Creating a Payment.
- Processing a Demo/sandbox payment.
- Handling payment success/failure/pending states.
- Completing Checkout.
- Creating exactly one Order.
- Finalizing Inventory.
- Handling payment webhooks.
- Safely retrying operations.

---

# 3. Dependencies

This slice depends on:

```text id="q5m8r4"
Authentication
Tenant context
Database
API
Validation/errors
Observability
Stores
Products
Inventory
Customers
Carts
Discounts
Checkout
Payments
Orders
Webhooks
Jobs
Notifications
```

All participating domains must expose their approved application interfaces.

---

# 4. Criticality

Checkout and Payment must be treated as a critical correctness boundary.

The implementation must protect against:

```text id="v7r4m6"
Duplicate payment
Duplicate Order
Overselling
Incorrect total
Invalid discount
Cross-tenant purchase
Webhook replay
Payment timeout ambiguity
Concurrent completion
```

Any one of these can produce financial or data-integrity failures.

---

# 5. Authoritative Sources

During Checkout:

```text id="m8q4r5"
Product
    → current product/variant state

Discount
    → current discount validity/calculation

Inventory
    → authoritative stock

Payments
    → normalized payment state

Orders
    → durable completed purchase
```

The Cart is only the customer's initial purchase intent.

---

# 6. Checkout Creation

The flow begins with:

```text id="x6r5m8"
Cart
  ↓
Create Checkout
```

The Checkout application service must validate:

```text id="q8m4r5"
Cart ownership
Cart Store
Cart lifecycle
Cart items
Product state
Variant state
Current pricing
Customer information
```

---

# 7. Checkout Snapshot

Checkout should capture the purchase information required to provide a stable purchase-processing context.

However, final purchase authority remains with the approved completion workflow.

The implementation must distinguish:

```text id="v5m7r4"
Checkout snapshot
```

from:

```text id="m4q8r6"
Final Order historical snapshot
```

The Order remains the permanent historical record.

---

# 8. Pricing Recalculation

Checkout must calculate the authoritative subtotal from current Product/Variant pricing.

Never trust:

```text id="x7r4m5"
Cart subtotal
Browser subtotal
Client-provided unit price
```

as authoritative payment values.

---

# 9. Money Representation

All monetary calculations must use the approved exact money representation.

Never use floating-point arithmetic for:

```text id="q6m8r4"
Unit prices
Subtotal
Discounts
Tax where supported
Payment amount
Order total
Refund amount
```

---

# 10. Discount Application

If the customer provides a discount code:

```text id="v8r5m4"
Checkout
 ↓
Discount application service
 ↓
Validate code
 ↓
Calculate discount
 ↓
Return authoritative result
```

The browser must not calculate the discount.

---

# 11. Discount Revalidation

A discount must be revalidated during Checkout.

The Cart may contain a previously displayed discount state, but Checkout must verify:

```text id="m5q4r7"
Code validity
Expiration
Usage limit
Eligibility
Store
Minimum purchase where applicable
```

---

# 12. Checkout Total

The final amount must be derived server-side.

Conceptually:

```text id="x8r4m6"
Subtotal
- Discount
= Payable Total
```

The exact calculation follows the approved pricing/discount specification.

---

# 13. Customer Information

Checkout should collect only the customer/order information required by the Demo.

Depending on the flow:

```text id="q7m5r4"
Customer identity
Email
Billing address
Shipping address where required
```

The exact required fields follow the Checkout specification.

---

# 14. Address Snapshot

When an address is submitted for the purchase, Checkout must capture the information required for the eventual Order.

The final Order owns the permanent historical snapshot.

Changing a customer's address after purchase must not modify the completed Order.

---

# 15. Inventory Reservation

Before payment completion, Checkout should reserve required Inventory according to the approved workflow.

Conceptually:

```text id="v6r4m8"
Checkout
 ↓
Inventory.reserve()
 ↓
Reservation created
```

Reservation must be concurrency-safe.

---

# 16. Reservation Failure

If Inventory cannot satisfy the requested quantity:

```text id="m8q4r5"
Checkout cannot complete
```

The customer must receive a controlled inventory error.

The system must not proceed to a successful payment workflow if the required purchase cannot be fulfilled according to the approved transaction design.

---

# 17. Reservation Idempotency

Retrying Checkout completion must not reserve inventory repeatedly.

The reservation identity must be associated with the Checkout/purchase context.

---

# 18. Payment Creation

After the Checkout state is valid, Payments should create or initialize the required payment attempt.

Conceptually:

```text id="x5r7m6"
Checkout
 ↓
Payments.createPayment()
 ↓
Payment Intent / Attempt
```

The Checkout domain coordinates the workflow.

Payments owns provider-specific behavior.

---

# 19. Payment Amount

The amount sent to the payment provider must come from the authoritative Checkout calculation.

Never send:

```text id="q6m4r8"
clientAmount
cartAmount
UIAmount
```

as payment authority.

---

# 20. Provider Abstraction

Checkout must not know the provider SDK.

The flow should be:

```text id="v7m5r4"
Checkout
 ↓
Payments application service
 ↓
Provider adapter
 ↓
Payment provider
```

This keeps provider-specific behavior isolated.

---

# 21. Sandbox/Test Provider

The Demo may use a sandbox/test payment provider.

However, the integration should behave like a real provider integration:

```text id="m4q8r6"
Payment creation
Provider reference
Success/failure states
Provider callbacks
Idempotency
Timeout handling
Refund behavior where required
```

Do not replace payment processing with a frontend boolean such as:

```text id="x8r5m4"
paymentSuccessful = true
```

---

# 22. Payment States

Payment state must use the approved Payments state machine.

Typical states may include:

```text id="q5m7r4"
CREATED
PENDING
SUCCEEDED
FAILED
CANCELLED
REFUNDED
```

The exact states follow the Payments specification.

---

# 23. Payment Uncertainty

A provider timeout does not necessarily mean payment failed.

For example:

```text id="v6r4m8"
Request sent
    ↓
Provider processes payment
    ↓
Network timeout
```

The system must preserve an uncertain/pending state rather than blindly retrying payment creation and risking duplicate charges.

---

# 24. Provider Idempotency

Where the payment provider supports idempotency keys, use them.

The logical identity should remain stable across safe retries of the same payment operation.

This provides protection at both levels:

```text id="m7q4r5"
Application idempotency
+
Provider idempotency
```

---

# 25. Checkout Completion

Checkout completion must be a controlled application operation.

Conceptually:

```text id="x5r8m6"
completeCheckout(checkoutId, idempotencyKey)
```

The operation verifies all required conditions before completing the purchase.

---

# 26. Completion Preconditions

Before final completion, verify:

```text id="q8m4r5"
Checkout is still completable
Payment is in acceptable state
Inventory reservation is valid
Final amount is consistent
Required customer/order information exists
Order has not already been created
```

---

# 27. Order Creation

Once purchase conditions are satisfied:

```text id="v7m4r6"
Checkout
   ↓
Orders.createFromCheckout()
   ↓
Order
```

The Order must be created exactly once.

---

# 28. Duplicate Order Prevention

The database must protect against:

```text id="m5q8r4"
Checkout
  ↓
Order A

same Checkout
  ↓
Order B
```

A unique relationship between the logical completed Checkout/purchase and Order should provide database-level protection.

---

# 29. Order Transaction

Order creation and the related local state changes must occur inside the appropriate database transaction.

The transaction must be short.

Do not call:

```text id="x6r4m8"
Payment provider
Email provider
External API
```

while holding the transaction open.

---

# 30. Inventory Finalization

After successful purchase completion, the Inventory reservation must transition according to the approved workflow.

Conceptually:

```text id="q7m4r5"
ACTIVE reservation
      ↓
FINALIZED
```

The quantity must not become available again.

---

# 31. Payment Webhook

Payment completion may be confirmed asynchronously through a provider webhook.

The webhook flow is:

```text id="v8r4m6"
Provider
 ↓
Webhook endpoint
 ↓
Signature verification
 ↓
Persist event
 ↓
Worker
 ↓
Payments application service
 ↓
Checkout/Order workflow
```

Webhook processing must be idempotent.

---

# 32. Duplicate Webhook

Receiving the same payment webhook twice must not cause:

```text id="m4q8r5"
Duplicate Payment
Duplicate Order
Duplicate Inventory finalization
Duplicate notification
```

Event deduplication and domain-level idempotency must both be applied.

---

# 33. Out-of-Order Webhook

If webhook events arrive out of order, the Payments domain must determine whether the transition is valid.

Do not blindly set:

```text id="x5r7m6"
payment.status = webhook.status
```

without state validation.

---

# 34. Payment Failure

If Payment fails before purchase completion:

```text id="q6m4r8"
Payment → FAILED
Checkout → appropriate failure state
Inventory reservation → RELEASED
```

The exact transition depends on the approved state machine.

---

# 35. Payment Pending

If Payment remains pending:

```text id="v7m5r4"
Checkout remains unresolved
Inventory reservation remains protected
Order is not falsely marked completed
```

The customer should receive an accurate pending state.

---

# 36. Payment Success

Once payment success is authoritatively confirmed:

```text id="m8q4r5"
Payment → SUCCEEDED
      ↓
Checkout completion
      ↓
Order creation
      ↓
Inventory finalization
```

The exact ordering follows the approved transactional workflow.

---

# 37. Customer Confirmation

After the purchase is confirmed, the Storefront should display:

```text id="x4r8m6"
Order number
Purchase status
Items
Total
```

The frontend must use the backend's authoritative response.

---

# 38. Notification Trigger

After Order creation, the system may emit:

```text id="q5m7r4"
OrderCreated
```

Notifications can then deliver the customer confirmation asynchronously.

Notification delivery must not determine whether the Order succeeded.

---

# 39. Checkout Expiration

A Checkout that remains incomplete may expire according to configured rules.

Expiration should use the durable Jobs system.

The expiration process must safely release active Inventory reservations.

---

# 40. Checkout Cancellation

Cancellation must be state-aware.

It must not release inventory or alter payment state incorrectly when the Checkout has already progressed beyond the cancellable state.

---

# 41. Retry Semantics

Critical operations must define retry behavior independently.

Examples:

```text id="v6m5r8"
Create Checkout
Reserve Inventory
Create Payment
Complete Checkout
Process Payment Webhook
Create Order
```

A retry must determine the existing state before performing another side effect.

---

# 42. Idempotency-Key

Critical mutation endpoints should support:

```text id="m4q8r7"
Idempotency-Key
```

where defined by the API contract.

The server must store sufficient information to distinguish:

```text id="x8r5m4"
Same operation retry
```

from:

```text
Different operation
```

using the same client-generated key incorrectly.

---

# 43. Request Fingerprint

Where the shared idempotency mechanism requires request fingerprints, compare the incoming request against the original request.

A reused key with a different operation/payload must be rejected.

---

# 44. Concurrency

Checkout completion may be triggered by:

```text id="q7m4r6"
Customer request
Payment webhook
Browser retry
Worker retry
```

The application must ensure these concurrent paths converge on one valid final state.

---

# 45. Checkout Locking

Where required, lock the Checkout row during critical state transitions.

The transaction should:

```text id="v5r8m4"
Lock Checkout
↓
Verify current state
↓
Apply valid transition
↓
Persist
↓
Commit
```

The exact locking strategy follows the Checkout implementation.

---

# 46. Payment and Checkout Deadlocks

When Checkout and Payments operations access multiple shared records, lock resources in a deterministic order.

Avoid inconsistent lock ordering such as:

```text id="m6q4r8"
Flow A:
Checkout → Payment

Flow B:
Payment → Checkout
```

unless the architecture explicitly requires and safely handles it.

---

# 47. API Endpoints

The slice may expose:

```text id="x4r7m6"
POST /api/v1/storefront/checkouts
GET  /api/v1/storefront/checkouts/:checkoutId
POST /api/v1/storefront/checkouts/:checkoutId/discount
POST /api/v1/storefront/checkouts/:checkoutId/payment
POST /api/v1/storefront/checkouts/:checkoutId/complete
```

Exact routes follow the approved API contract.

---

# 48. DTOs

Use explicit DTOs such as:

```text id="q8m5r4"
CreateCheckoutRequest
CheckoutDetailsDTO
CheckoutTotalsDTO
PaymentInitializationDTO
CheckoutCompletionDTO
```

Do not expose internal payment-provider responses.

---

# 49. Error Handling

Critical errors may include:

```text id="v7r4m6"
CHECKOUT_NOT_FOUND
CHECKOUT_EXPIRED
CHECKOUT_NOT_COMPLETABLE
PRICE_CHANGED
DISCOUNT_INVALID
INVENTORY_UNAVAILABLE
PAYMENT_FAILED
PAYMENT_PENDING
PAYMENT_STATE_CONFLICT
DUPLICATE_OPERATION
ORDER_ALREADY_CREATED
```

Use the shared error taxonomy.

---

# 50. Security

Verify:

```text id="m5q8r4"
[ ] Checkout belongs to current Store
[ ] Customer owns Checkout
[ ] Client cannot modify authoritative price
[ ] Client cannot mark payment successful
[ ] Payment provider secrets are server-only
[ ] Payment data is minimized
[ ] Cross-tenant Checkout access is blocked
[ ] Order creation cannot be invoked arbitrarily
[ ] Webhook signatures are verified
```

---

# 51. Testing Strategy

### Unit Tests

Test:

```text id="x6r4m8"
Checkout state machine
Pricing calculation
Discount application
Completion rules
Idempotency behavior
```

### Integration Tests

Test:

```text id="q5m7r4"
Cart → Checkout
Checkout → Inventory
Checkout → Payment
Payment → Checkout
Checkout → Order
Webhook → Payment
```

---

# 52. Critical Payment Tests

Mandatory scenarios:

```text id="v8r4m5"
Successful payment
Failed payment
Pending payment
Provider timeout
Provider retry
Duplicate provider webhook
Out-of-order webhook
Duplicate payment initialization
```

---

# 53. Critical Order Tests

Verify:

```text id="m7q4r6"
One successful Checkout
→ exactly one Payment
→ exactly one Order
```

Then retry:

```text id="x5r8m4"
same completion request
same webhook
same worker job
```

The result must remain one completed purchase.

---

# 54. Inventory Integration Tests

Verify:

```text id="q6m4r8"
Stock = 1
↓
Checkout A reserves 1
↓
Checkout B cannot reserve 1
↓
Checkout A payment succeeds
↓
Order created
↓
Inventory finalized
↓
Stock available = 0
```

Also verify payment failure:

```text id="v7m5r4"
Reservation
↓
Payment fails
↓
Reservation released
```

---

# 55. End-to-End Purchase Test

The browser-level test should execute:

```text id="m8q4r5"
Customer visits Store
 ↓
Selects Product
 ↓
Adds to Cart
 ↓
Opens Checkout
 ↓
Reviews authoritative total
 ↓
Applies valid Discount
 ↓
Completes payment
 ↓
Payment confirmation
 ↓
Order confirmation
```

The test should verify database state after completion.

---

# 56. Failure Tests

Test:

```text id="x4r8m6"
Price changes before Checkout
Discount expires
Inventory sells out
Payment fails
Payment times out
Webhook is duplicated
Webhook arrives late
Customer retries completion
Worker retries webhook
Order creation encounters retry
```

No scenario should produce duplicate financial or Order state.

---

# 57. Implementation Order

Implement the slice in this order:

```text id="q7m5r4"
1. Verify Cart/Product foundation
2. Verify Checkout schema/state machine
3. Implement Checkout creation
4. Implement authoritative pricing
5. Integrate Discounts
6. Integrate Customers/address data
7. Integrate Inventory reservation
8. Implement Payment creation
9. Implement provider adapter
10. Implement payment success/failure handling
11. Implement Checkout completion
12. Integrate Order creation
13. Implement Inventory finalization/release
14. Implement webhook endpoint
15. Implement webhook processing
16. Implement Checkout expiration
17. Implement Storefront Checkout UI
18. Add observability
19. Add unit/integration tests
20. Add concurrency/idempotency/security tests
21. Run complete purchase E2E test
```

---

# 58. AI Implementation Rules

AI agents implementing this slice must:

1. Read the actual root `AGENTS.md`.
2. Read Checkout, Payments, Orders, Inventory, Carts, Discounts, Customers, Webhooks, Jobs, API, Database, and Security specifications.
3. Treat payment correctness as critical.
4. Never trust client-side totals.
5. Never treat a timeout as automatic payment failure.
6. Never create Orders directly from frontend requests.
7. Preserve Checkout and payment idempotency.
8. Verify webhook signatures and deduplicate events.
9. Never call external providers inside long database transactions.
10. Test concurrent completion and retry scenarios.
11. Preserve Store and customer isolation.
12. Avoid adding payment infrastructure outside the approved Demo provider strategy.

---

# 59. Definition of Done

The Checkout and Payment slice is complete when:

```text id="v6r4m8"
[ ] Checkout can be created from Cart
[ ] Product state is revalidated
[ ] Prices are recalculated server-side
[ ] Discounts are validated server-side
[ ] Customer/order information is validated
[ ] Inventory reservation works
[ ] Reservation is concurrency-safe
[ ] Payment creation works
[ ] Payment provider adapter works
[ ] Provider idempotency works where supported
[ ] Payment success works
[ ] Payment failure works
[ ] Payment pending/uncertain state works
[ ] Webhook signature verification works
[ ] Duplicate webhooks are safe
[ ] Out-of-order webhooks are handled
[ ] Checkout completion is idempotent
[ ] Exactly one Order is created
[ ] Inventory finalization works
[ ] Payment failure releases reservation
[ ] Checkout expiration works
[ ] Customer receives authoritative result
[ ] Tenant isolation works
[ ] Security tests pass
[ ] Concurrency tests pass
[ ] Idempotency tests pass
[ ] E2E purchase test passes
[ ] TypeScript passes
[ ] Lint passes
```

---

# 60. Slice Completion Gate

The slice must pass the complete purchase lifecycle:

```text id="m5q8r4"
Product
   ↓
Cart
   ↓
Checkout
   ↓
Authoritative Pricing
   ↓
Discount
   ↓
Inventory Reservation
   ↓
Payment
   ↓
Payment Confirmation
   ↓
Order Creation
   ↓
Inventory Finalization
   ↓
Customer Confirmation
```

Then repeat the critical operations under:

```text id="x7r4m6"
Network retry
Duplicate webhook
Worker retry
Concurrent completion
Payment timeout
Inventory contention
```

The final database state must still represent exactly one valid purchase.

This slice is the primary transactional proof that the Demo is a real commerce system rather than a collection of connected screens.