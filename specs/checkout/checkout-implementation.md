# Checkout Implementation Specification

## 1. Purpose

This document defines the implementation requirements for the **Checkout** domain of the Shopify-like commerce platform.

The Checkout module coordinates the transition from a Cart to a completed purchase. It validates the purchase context, calculates the final amount, applies discounts, coordinates inventory reservation, initiates payment, and coordinates Order creation.

Checkout is a critical transactional boundary. The implementation must prioritize correctness, retry safety, idempotency, concurrency control, and protection against inconsistent financial or inventory state.

---

## 2. Scope

The Checkout module owns:

- Checkout creation.
- Checkout lifecycle.
- Checkout item snapshots.
- Checkout pricing context.
- Customer and contact information required for checkout.
- Shipping/billing information required by the Demo.
- Discount application orchestration.
- Inventory reservation orchestration.
- Payment orchestration.
- Checkout completion.
- Checkout expiration/cancellation.
- Checkout idempotency.

The module does not own:

- Cart contents.
- Product catalog.
- Inventory records.
- Discount definitions.
- Payment provider internals.
- Orders.
- Customer profiles.

Those domains are accessed through explicit public interfaces.

---

## 3. Domain Position

The primary flow is:

```text id="c9m2v7"
Cart
  ↓
Checkout
  ├── Checkout Items
  ├── Pricing
  ├── Customer Context
  ├── Address Context
  └── Payment Context
       ↓
Inventory
       ↓
Payment
       ↓
Order
```

Checkout is an orchestration domain rather than the owner of the underlying Product, Inventory, Payment, or Order data.

---

## 4. Module Location

Implementation belongs under:

```text id="m4x8q1"
modules/checkout/
```

Recommended structure:

```text id="v7p3n5"
modules/checkout/
├── application/
├── domain/
├── infrastructure/
└── index.ts
```

---

## 5. Layer Responsibilities

### Presentation

Responsible for:

- Authentication/session context.
- Store resolution.
- Request validation.
- Authorization.
- DTO mapping.
- HTTP responses.

### Application

Responsible for:

- Checkout use cases.
- Workflow orchestration.
- Transaction boundaries.
- Idempotency.
- Coordination with other domains.

### Domain

Responsible for:

- Checkout entity.
- Checkout lifecycle.
- Checkout item rules.
- Checkout invariants.
- Completion rules.

### Infrastructure

Responsible for:

- PostgreSQL persistence.
- Repositories.
- Payment adapters.
- Persistence mapping.
- External integration adapters.

---

## 6. Checkout Entity

Conceptually:

```text id="q6n3x8"
Checkout
├── id
├── storeId
├── cartId
├── customerId?
├── status
├── currency
├── subtotal
├── discountTotal
├── total
├── email
├── shippingAddress
├── billingAddress
├── paymentStatus
├── createdAt
├── updatedAt
└── expiresAt?
```

The exact schema may evolve.

---

## 7. Checkout Item

Checkout items should preserve the purchase context at the time Checkout is created.

Conceptually:

```text id="f4m8c2"
CheckoutItem
├── id
├── checkoutId
├── variantId
├── productNameSnapshot
├── variantNameSnapshot
├── skuSnapshot
├── unitPrice
├── quantity
└── lineTotal
```

The exact snapshot fields depend on the Order model.

---

## 8. Historical Pricing

Checkout must not depend on mutable Cart display prices.

At checkout creation:

```text id="x8q2m6"
Cart
  ↓
Re-read product pricing
  ↓
Calculate checkout pricing
  ↓
Persist checkout pricing context
```

Final pricing must be revalidated before order completion where necessary.

---

## 9. Checkout Status

A practical state model is:

```text id="n5v9p3"
OPEN
PAYMENT_PENDING
COMPLETED
FAILED
CANCELLED
EXPIRED
```

The exact states must align with Payment and Order state machines.

---

## 10. State Transition Rules

Typical transitions:

```text id="r3m7x1"
OPEN
  ↓
PAYMENT_PENDING
  ↓
COMPLETED
```

Failure:

```text id="k8c4q6"
OPEN
  ↓
FAILED
```

Cancellation:

```text id="t2p9v5"
OPEN
  ↓
CANCELLED
```

Expiration:

```text id="z6m3x8"
OPEN
  ↓
EXPIRED
```

Invalid transitions must be rejected.

---

## 11. Checkout Creation

Checkout creation should:

1. Resolve Store.
2. Resolve Cart.
3. Verify Cart ownership.
4. Verify Cart is active.
5. Load current product/variant data.
6. Validate item quantities.
7. Calculate pricing.
8. Validate applicable discounts.
9. Capture required customer/contact information.
10. Create Checkout.
11. Commit.

Inventory should not be assumed to remain available simply because Checkout was created.

---

## 12. Checkout Ownership

Checkout access must follow the same Store and ownership boundaries as the Cart.

For authenticated customers:

```text id="b7x2m5"
Store
  ↓
Customer
  ↓
Checkout
```

For guest checkout, the Checkout must use an appropriate secure guest context.

---

## 13. Tenant Isolation

Every Checkout operation must resolve the Store server-side.

The client must not be able to select an arbitrary Store by changing a request field.

Cross-tenant Checkout access must fail.

---

## 14. Checkout Item Validation

At Checkout creation and before completion, validate:

- Variant exists.
- Variant belongs to Store.
- Variant is purchasable.
- Quantity is valid.
- Current price is available.
- Required product information exists.

Checkout must not trust stale Cart data.

---

## 15. Product Snapshot

Checkout should preserve the product information required for the transaction.

At minimum, the final Order should be able to retain historical information such as:

- Product name.
- Variant name.
- SKU.
- Unit price.
- Quantity.
- Discount amount.

Orders own the final historical snapshot.

---

## 16. Pricing Calculation

Checkout is responsible for determining the final transaction amount by coordinating:

```text id="u4m8q7"
Line Items
   ↓
Subtotal
   ↓
Discounts
   ↓
Additional supported charges
   ↓
Final Total
```

The Demo should keep pricing deliberately simple.

---

## 17. Money Handling

All monetary values must use exact representations.

Never use JavaScript floating-point arithmetic as the financial source of truth.

Recommended representation:

```text id="a8c3m6"
integer minor units
```

For example:

```text id="j2p7x4"
₹1,250.50
→
125050 paise
```

---

## 18. Currency

Checkout must operate in a single defined currency context.

The Store's configured currency may be the source for the Demo.

The system must reject unsupported currency mismatches rather than silently converting amounts.

---

## 19. Discount Application

Checkout should call the Discounts module to:

1. Resolve discount code.
2. Validate eligibility.
3. Calculate discount.
4. Apply the resulting amount.
5. Revalidate before completion.

Checkout must not duplicate Discount business rules.

---

## 20. Discount Revalidation

A discount can become invalid between Checkout creation and payment.

Therefore final completion must revalidate:

- Status.
- Validity period.
- Eligibility.
- Usage limits.
- Pricing context.

---

## 21. Inventory Reservation

Checkout coordinates inventory reservation.

Typical flow:

```text id="g5n9q2"
Checkout
  ↓
Validate items
  ↓
Reserve inventory
  ↓
Payment
  ↓
Order creation
```

The Inventory module owns reservation correctness.

Checkout must not directly manipulate inventory tables.

---

## 22. Reservation Failure

If required inventory cannot be reserved:

```text id="v7m2c8"
Checkout completion
        ↓
Inventory reservation
        ↓
FAILED
```

No payment should be captured for a purchase that cannot obtain required inventory unless the payment workflow explicitly supports a later recovery path.

---

## 23. Reservation Atomicity

For multi-item Checkout:

```text id="x3q8m5"
Variant A → 2
Variant B → 1
Variant C → 4
```

inventory reservation should follow the Inventory module's atomic reservation contract.

Partial reservation must not leave Checkout in an inconsistent state.

---

## 24. Payment Coordination

Checkout coordinates with Payments through a payment interface.

It must not directly implement provider-specific logic.

Conceptually:

```text id="p9m4x6"
Checkout
  ↓
Payment Gateway Interface
  ↓
Provider Adapter
```

---

## 25. External Payment Calls

Payment provider calls must not occur while holding long-running database locks.

Avoid:

```text id="q6c2v8"
BEGIN
  ↓
Lock DB records
  ↓
Call payment provider
  ↓
COMMIT
```

Instead, use a state-based workflow that safely handles external responses.

---

## 26. Payment States

Checkout should interpret Payment state rather than inventing provider-specific states.

Possible payment outcomes:

```text id="w5n8r3"
PENDING
AUTHORIZED
SUCCEEDED
FAILED
CANCELLED
```

The Payments module owns the authoritative payment state.

---

## 27. Successful Payment

Successful payment does not automatically mean the Checkout is complete until required downstream operations succeed.

The completion workflow must ensure:

```text id="m8x4p2"
Payment success
+
Inventory correctness
+
Order creation
+
Checkout completion
```

are reconciled safely.

---

## 28. Order Creation

Checkout coordinates Order creation through the Orders module.

Typical flow:

```text id="d7q3n9"
Checkout
  ↓
Payment confirmed
  ↓
Order creation
  ↓
Order persisted
  ↓
Checkout → COMPLETED
```

Order creation must be idempotent.

---

## 29. Order Creation Failure

If payment succeeds but Order creation encounters a transient failure, the system must not blindly create another payment or another Order on retry.

The workflow must support safe recovery using:

- Idempotency keys.
- Persistent Checkout state.
- Payment state.
- Order creation reference.

---

## 30. Checkout Idempotency

Checkout completion is a critical idempotent operation.

Repeated requests must not result in:

```text id="n4v8c2"
Multiple payments
Multiple Orders
Multiple inventory consumptions
Multiple discount usages
```

for the same logical purchase.

---

## 31. Idempotency Key

The application should accept or generate an idempotency identity for critical checkout operations.

The stored record should associate the request with:

- Store.
- Operation.
- Idempotency key.
- Request fingerprint.
- Result.
- Processing state.

---

## 32. Concurrent Completion

Two concurrent requests attempting to complete the same Checkout must not both complete it.

The implementation should use an appropriate concurrency mechanism such as:

- Row locking.
- State transition guard.
- Unique business reference.
- Idempotency record.

---

## 33. Checkout Locking

A Checkout completion operation should establish a deterministic ownership of the workflow before making state changes.

Example:

```text id="f6m2x9"
Load Checkout
   ↓
Lock / atomically claim completion
   ↓
Verify current state
   ↓
Continue workflow
```

Locks must be held only for necessary database operations.

---

## 34. Checkout Expiration

If Checkout has an expiration time:

```text id="k8p3v5"
expiresAt < now
```

the Checkout must not accept normal completion after expiration.

Any active inventory reservation must be released through the Inventory module.

---

## 35. Checkout Cancellation

Cancellation should be explicit and idempotent.

Typical behavior:

```text id="r2m7c4"
OPEN
  ↓
CANCELLED
```

If inventory has already been reserved, Checkout coordinates its release.

---

## 36. Failed Checkout

A failed Checkout must preserve enough state to understand what happened.

Possible behavior:

```text id="z9x5n2"
PAYMENT_FAILED
      ↓
Release reservation
      ↓
Checkout → FAILED
```

The exact recovery path depends on Payment state.

---

## 37. Payment Failure

Payment failure should not leave inventory permanently reserved.

Where appropriate:

```text id="c7m4q8"
Payment failed
   ↓
Release reservation
   ↓
Checkout failed
```

Release must be idempotent.

---

## 38. Payment Timeout

A payment may remain pending.

Checkout should not assume failure simply because an HTTP request timed out.

The system should rely on:

- Payment state.
- Provider webhook where applicable.
- Reconciliation/retry logic.

---

## 39. Webhook Interaction

Payment provider webhooks may update payment state after the original Checkout request has completed.

Webhook processing must be:

- Signature-verified.
- Replay-safe.
- Idempotent.
- Tenant-aware.
- Safe for out-of-order delivery.

The Webhooks and Payments modules own provider-specific processing.

---

## 40. Customer Information

Checkout may capture:

- Email.
- Name.
- Shipping address.
- Billing address.
- Customer reference.

The exact fields depend on the supported Demo checkout experience.

---

## 41. Address Snapshot

Checkout should capture the address information required for the transaction.

After Order creation, Orders must retain historical address snapshots.

Changing a Customer address afterward must not alter completed transaction records.

---

## 42. Guest Checkout

Guest checkout may be supported.

Guest Checkout should not require creation of a permanent Customer account unless explicitly configured.

The Checkout must still have a secure ownership mechanism.

---

## 43. Customer Checkout

For authenticated customers:

```text id="n3x8m5"
Authenticated identity
       ↓
Store context
       ↓
Customer
       ↓
Checkout
```

The client must not be able to substitute another Customer ID.

---

## 44. API Endpoints

Potential endpoints:

```text id="q5m9v3"
POST  /api/v1/checkouts
GET   /api/v1/checkouts/{checkoutId}
PATCH /api/v1/checkouts/{checkoutId}
POST  /api/v1/checkouts/{checkoutId}/discount
POST  /api/v1/checkouts/{checkoutId}/complete
POST  /api/v1/checkouts/{checkoutId}/cancel
```

The exact API surface must follow the final API contract.

---

## 45. Checkout API Authorization

Merchant and customer Checkout access should be clearly separated.

A customer should only access their own Checkout.

Administrative access should require explicit Store permissions.

---

## 46. Validation

All external Checkout input must be validated at the boundary.

Validate:

- Cart ID.
- Checkout ID.
- Quantities.
- Customer/contact information.
- Addresses.
- Discount codes.
- Payment references.
- Idempotency keys.

Do not trust client-calculated totals.

---

## 47. Client-Supplied Totals

The client must never be authoritative for:

- Subtotal.
- Discount amount.
- Tax amount.
- Final total.
- Inventory availability.
- Payment amount.

These values must be calculated and validated server-side.

---

## 48. Error Handling

Potential stable error codes:

```text id="b8q2m7"
CHECKOUT_NOT_FOUND
CHECKOUT_ACCESS_DENIED
CHECKOUT_NOT_ACTIVE
CHECKOUT_EXPIRED
CHECKOUT_ALREADY_COMPLETED
CHECKOUT_CONFLICT
INVALID_CHECKOUT
INVALID_CHECKOUT_ADDRESS
INVALID_CHECKOUT_CUSTOMER
PRODUCT_UNAVAILABLE
INSUFFICIENT_INVENTORY
DISCOUNT_NOT_ELIGIBLE
PAYMENT_FAILED
PAYMENT_PENDING
ORDER_CREATION_FAILED
IDEMPOTENCY_CONFLICT
```

Errors must not expose sensitive provider or internal database details.

---

## 49. Transaction Boundaries

Checkout may require multiple short transactions rather than one large transaction.

The implementation must avoid attempting to hold a single database transaction across:

- Payment provider calls.
- External APIs.
- Long-running operations.

The workflow should use persistent state transitions to coordinate these operations safely.

---

## 50. Checkout State as Workflow State

Checkout state should make the workflow recoverable.

For example:

```text id="v5n3x7"
OPEN
 ↓
PAYMENT_PENDING
 ↓
PAYMENT_CONFIRMED
 ↓
ORDER_CREATION_PENDING
 ↓
COMPLETED
```

The exact states may be represented partly through Checkout and Payment state rather than duplicating every state.

---

## 51. Events

Potential Checkout events:

```text id="m7q4c2"
CheckoutCreated
CheckoutStarted
CheckoutPaymentPending
CheckoutPaymentSucceeded
CheckoutFailed
CheckoutCancelled
CheckoutExpired
CheckoutCompleted
```

Events represent completed facts.

Critical state changes must not depend solely on asynchronous event delivery.

---

## 52. Background Jobs

Potential Checkout jobs include:

- Expire stale Checkouts.
- Recover incomplete payment workflows.
- Release stale reservations.
- Retry recoverable downstream operations.

Jobs must be idempotent and retry-safe.

---

## 53. Checkout Recovery

A worker may find states such as:

```text id="x8m2p5"
PAYMENT_PENDING
ORDER_CREATION_PENDING
```

and determine whether action is required.

Recovery must inspect authoritative Payment, Inventory, and Order state before retrying.

Blindly repeating the entire Checkout workflow is prohibited.

---

## 54. Database Constraints

Potential constraints include:

```text id="n6r3v9"
total >= 0
subtotal >= 0
discount_total >= 0
quantity > 0
```

Foreign keys should enforce relationships to:

- Store.
- Cart.
- Customer where applicable.

---

## 55. Database Indexing

Likely indexes include:

```text id="p4m8x2"
store_id
cart_id
customer_id
status
expires_at
created_at
```

Idempotency records should have a unique key scoped appropriately to the Store and operation.

---

## 56. Testing Strategy

### Unit Tests

Test:

- Checkout lifecycle.
- Pricing.
- Validation.
- State transitions.
- Completion rules.

### Integration Tests

Test:

- PostgreSQL persistence.
- Transactions.
- Inventory reservation.
- Discount validation.
- Idempotency.
- Concurrent completion.
- Tenant isolation.

### API Tests

Test:

- Authentication.
- Authorization.
- Checkout creation.
- Checkout retrieval.
- Completion.
- Cancellation.
- Error contracts.

### E2E Tests

Test the complete flow:

```text id="w3x7n5"
Browse
  ↓
Cart
  ↓
Checkout
  ↓
Discount
  ↓
Inventory
  ↓
Payment
  ↓
Order
```

---

## 57. Critical Concurrency Tests

```text id="k9m4c2"
[ ] Two requests complete the same Checkout
[ ] Only one Order is created
[ ] Only one payment operation is initiated
[ ] Inventory is consumed once
[ ] Discount usage is recorded once
[ ] Retry returns the original successful result
[ ] Concurrent checkout of final inventory unit allows only one reservation
[ ] Multi-item reservation remains atomic
[ ] Payment webhook and checkout completion race safely
```

---

## 58. Critical Failure Tests

```text id="q7p2x8"
[ ] Inventory reservation fails before payment
[ ] Payment fails after reservation
[ ] Payment request times out
[ ] Payment succeeds but response is lost
[ ] Order creation temporarily fails
[ ] Payment webhook arrives before client response
[ ] Payment webhook arrives multiple times
[ ] Checkout expires during payment workflow
[ ] Worker retries incomplete Checkout
[ ] Retry never creates duplicate Order
```

---

## 59. Implementation Sequence

Recommended implementation order:

```text id="c5m8v3"
1. Define Checkout domain model
2. Define Checkout Item model
3. Define lifecycle/state machine
4. Define pricing model
5. Define Checkout database schema
6. Create migrations
7. Implement repository
8. Implement Checkout creation
9. Implement pricing calculation
10. Integrate Product validation
11. Integrate Discount validation
12. Integrate Inventory reservation
13. Integrate Payment interface
14. Integrate Order creation
15. Implement completion workflow
16. Implement cancellation/expiration
17. Implement idempotency
18. Implement recovery jobs
19. Implement APIs
20. Add unit tests
21. Add integration tests
22. Add concurrency tests
23. Add API tests
24. Add complete E2E checkout tests
```

---

## 60. Demo Simplifications

The Demo intentionally does not require:

- Complex tax engines.
- Multi-region checkout.
- Multiple currencies.
- Advanced shipping-rate calculation.
- Multiple payment providers simultaneously.
- Subscription checkout.
- B2B checkout.
- Complex fraud detection.
- Split payments.
- Partial fulfillment.
- Distributed checkout services.

The Demo must still implement a real end-to-end purchase workflow.

---

## 61. V1 Evolution

The Checkout module can later support:

- Advanced tax calculation.
- Shipping providers.
- Multiple payment methods.
- Multi-currency checkout.
- Address validation providers.
- Fraud checks.
- Advanced promotions.
- Subscription checkout.
- B2B checkout.
- Partial payments.
- Complex fulfillment orchestration.

These capabilities should extend the existing Checkout boundary rather than bypass it.

---

## 62. Definition of Done

The Checkout implementation is complete when:

```text id="r4x8m2"
[ ] Checkout entity exists
[ ] Checkout Item entity exists
[ ] Checkout lifecycle exists
[ ] Store ownership is enforced
[ ] Customer/guest ownership is enforced
[ ] Cart validation exists
[ ] Product validation exists
[ ] Pricing is recalculated server-side
[ ] Exact money representation is used
[ ] Currency rules are enforced
[ ] Discount integration exists
[ ] Discount revalidation exists
[ ] Inventory reservation integration exists
[ ] Payment integration exists
[ ] Order creation integration exists
[ ] Checkout completion is idempotent
[ ] Concurrent completion is safe
[ ] Payment failures are recoverable
[ ] Reservation release is handled
[ ] Checkout expiration is handled
[ ] Webhook-driven payment state is supported
[ ] Recovery workflow exists
[ ] Tenant isolation is enforced
[ ] Authorization is enforced
[ ] Database constraints exist
[ ] Appropriate indexes exist
[ ] APIs are implemented
[ ] Unit tests exist
[ ] Integration tests exist
[ ] Concurrency tests exist
[ ] Failure/recovery tests exist
[ ] API tests exist
[ ] E2E purchase flow exists
[ ] Documentation matches implementation
```