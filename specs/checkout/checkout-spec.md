# Checkout Specification

## 1. Purpose

This specification defines the functional and technical requirements for the Checkout domain of the Demo commerce platform.

The Checkout domain is responsible for coordinating the transition from a cart to a completed purchase.

It coordinates:

- Cart validation
- Customer and guest checkout identity
- Pricing validation
- Discount validation
- Inventory reservation
- Payment initiation
- Payment confirmation
- Order creation
- Checkout state
- Idempotency
- Failure recovery

Checkout coordinates these operations but does not own the underlying data of other domains.

---

# 2. Scope

The Demo Checkout module supports:

- Creating a checkout from a valid cart
- Guest checkout
- Registered customer checkout
- Checkout information collection
- Address collection
- Final pricing calculation
- Discount validation
- Inventory reservation
- Payment coordination
- Order creation
- Checkout completion
- Checkout expiration
- Safe retries
- Failure recovery

---

# 3. Out of Scope

Demo does not require:

- Subscription checkout
- Buy-now-pay-later integrations
- Multi-cart checkout
- Multi-store checkout
- Split payments
- Complex tax engines
- Advanced shipping-rate engines
- Multi-currency checkout
- Marketplace checkout
- Complex fraud orchestration
- Advanced checkout customization
- One-click upsells
- Advanced checkout experiments

These may be added later.

---

# 4. Domain Ownership

Checkout owns:

```text id="q5n5yl"
Checkout
CheckoutItem
CheckoutAddress
```

Checkout is authoritative for:

- checkout lifecycle
- checkout state
- checkout-specific snapshot information
- purchase orchestration
- checkout idempotency
- coordination between cart, inventory, payments, and orders

Checkout does not own:

- product catalog
- inventory quantities
- customer identity
- discount definitions
- payment provider state
- order lifecycle

---

# 5. Checkout Entity

Conceptually:

```text id="4x8sdy"
Checkout
├── id
├── store_id
├── cart_id
├── customer_id
├── status
├── currency
├── subtotal
├── discount_total
├── shipping_total
├── tax_total
├── grand_total
├── expires_at
├── completed_at
├── created_at
└── updated_at
```

The exact schema may evolve.

---

# 6. Checkout Item

Conceptually:

```text id="6n8m2r"
CheckoutItem
├── id
├── checkout_id
├── product_variant_id
├── product_name_snapshot
├── variant_name_snapshot
├── sku_snapshot
├── quantity
├── unit_price
├── discount_amount
├── line_total
└── created_at
```

Checkout items provide a purchase-time representation of the cart.

Orders later create their own historical snapshot.

---

# 7. Checkout Address

Checkout may collect:

- billing address
- shipping address

Conceptually:

```text id="l9q6p3"
CheckoutAddress
├── id
├── checkout_id
├── type
├── name
├── address_line_1
├── address_line_2
├── city
├── state
├── postal_code
├── country
└── phone
```

The exact required fields depend on the Demo shipping/payment requirements.

---

# 8. Checkout Lifecycle

Demo uses:

```text id="j2m2x4"
OPEN
PAYMENT_PENDING
PAYMENT_PROCESSING
COMPLETED
FAILED
EXPIRED
CANCELLED
```

Typical lifecycle:

```text id="y8p8x4"
OPEN
 ↓
PAYMENT_PENDING
 ↓
PAYMENT_PROCESSING
 ↓
COMPLETED
```

Failure paths:

```text id="b3h3fu"
OPEN → EXPIRED
OPEN → CANCELLED

PAYMENT_PROCESSING → FAILED
PAYMENT_PROCESSING → PAYMENT_PENDING
```

A completed checkout is terminal.

---

# 9. Checkout Creation

Checkout is created from a valid Cart.

Conceptually:

```text id="a5x7g1"
Cart
 ↓
Validate
 ↓
Create Checkout
 ↓
Snapshot checkout data
```

The cart must:

- belong to the same Store
- be active
- contain at least one item
- contain valid variants
- contain valid quantities
- be eligible for checkout

---

# 10. Cart Ownership

Before checkout creation, the server must verify:

```text id="m6u7o2"
current store
+
current customer / guest session
+
cart
```

The client must not be able to create a checkout from another user's cart.

---

# 11. Empty Cart

An empty cart cannot create a checkout.

Expected error:

```text id="3k8n4v"
CART_EMPTY
```

---

# 12. Checkout Snapshot

When Checkout is created, it may snapshot information needed for consistent purchase processing.

Examples:

- product name
- variant name
- SKU
- quantity
- selected address
- currency

However, authoritative final pricing and availability must still be validated before order creation.

---

# 13. Product Changes

A product may change after checkout creation.

Therefore:

```text id="p8v3l6"
Checkout snapshot
≠
guaranteed final order state
```

Before completing the purchase, Checkout must revalidate:

- variant availability
- current purchasable state
- pricing
- discounts
- inventory

---

# 14. Checkout Pricing

Checkout is responsible for the final pricing calculation before payment authorization.

Conceptually:

```text id="g7s4w2"
Cart Items
   ↓
Current Product Prices
   ↓
Discount Validation
   ↓
Shipping
   ↓
Tax
   ↓
Final Total
```

The client must never supply the authoritative total.

---

# 15. Price Changes

If a product price changes between:

```text id="4u2k0h"
Add to Cart
```

and:

```text id="8c5p7x"
Checkout
```

the checkout must use the current authoritative pricing rules unless the product explicitly supports price locking.

---

# 16. Discount Validation

Checkout must revalidate discounts.

Validation must consider:

- discount status
- start time
- expiration
- minimum order
- eligible products
- customer eligibility
- usage limits
- discount code validity

The Carts module must not be the final authority for discount validity.

---

# 17. Inventory Reservation

Checkout coordinates inventory reservation.

Recommended flow:

```text id="1n4v7m"
Checkout
   ↓
Validate items
   ↓
Reserve inventory
   ↓
Initiate payment
```

Inventory remains authoritative for stock quantities.

---

# 18. Reservation Requirement

Inventory must be reserved before the system treats the purchase as safely payable.

The reservation must contain enough information to:

- identify checkout
- identify inventory item
- identify quantity
- release on failure
- commit on successful order

---

# 19. Reservation Failure

If inventory reservation fails:

```text id="7c1v9z"
Checkout
   ↓
Reservation failed
   ↓
Payment must not proceed
```

The customer should receive an appropriate availability error.

No payment authorization should be initiated after a known inventory failure.

---

# 20. Multi-Item Reservation

If a checkout contains multiple items, inventory reservation should be atomic from the customer's perspective.

Conceptually:

```text id="f2n6c8"
Item A reserve ─┐
Item B reserve ─┼── all succeed
Item C reserve ─┘

OR

all reservations are released
```

Partial inventory reservation must not leave the checkout in an unusable state.

---

# 21. Reservation Concurrency

Checkout must rely on the Inventory module's concurrency-safe reservation mechanism.

It must not directly update inventory quantities.

The Inventory module should use appropriate database locking and conditional updates.

---

# 22. Payment Boundary

Checkout coordinates Payments.

Checkout must not implement payment-provider-specific logic.

Conceptually:

```text id="n8c3p6"
Checkout
   ↓
Payment interface
   ↓
Payment provider
```

Payments owns:

- payment attempts
- provider identifiers
- payment state
- webhook processing
- provider-specific behavior

---

# 23. Payment Initiation

After successful validation and inventory reservation:

```text id="j5k9r2"
Checkout
 ↓
Create Payment Attempt
 ↓
Payment Provider
 ↓
Payment Result
```

The provider may return:

- success
- failure
- pending
- requires action

Checkout must handle these states explicitly.

---

# 24. Payment Pending

A payment may remain pending.

In that case:

```text id="d3v6h8"
Checkout
status = PAYMENT_PENDING / PAYMENT_PROCESSING
```

The system must not create a completed order merely because a payment attempt was initiated.

---

# 25. Payment Success

A successful payment must be associated with the correct checkout.

The system must verify:

- payment belongs to checkout
- payment amount matches expected amount
- payment currency matches
- payment is valid
- payment has not already been consumed

Only then may checkout proceed toward order creation.

---

# 26. Payment Failure

If payment fails:

```text id="v4b8q7"
Payment failed
     ↓
Checkout remains recoverable where possible
     ↓
Inventory reservation released
```

The exact release timing depends on the Payment and Inventory state.

A failed payment must not create a completed order.

---

# 27. Payment Webhooks

Some payment providers confirm final status asynchronously.

The flow may therefore be:

```text id="r2w6k4"
Checkout
 ↓
Payment initiated
 ↓
Provider
 ↓
Webhook
 ↓
Payment updated
 ↓
Checkout resumed
 ↓
Order created
```

Webhook processing must be idempotent.

---

# 28. Order Creation

Checkout coordinates Order creation.

The Order module becomes authoritative once the order exists.

Conceptually:

```text id="h6j2n5"
Validated Checkout
       ↓
Successful Payment
       ↓
Create Order
       ↓
Commit Inventory
       ↓
Complete Checkout
```

The exact commit ordering must be transactionally safe.

---

# 29. Order Creation Idempotency

A checkout must never create multiple orders because of:

- duplicate client requests
- payment webhook retries
- worker retries
- network retries
- provider duplicate notifications

A unique checkout completion key or equivalent database constraint must prevent duplicate orders.

---

# 30. Checkout Completion

Successful completion should result in:

```text id="y3f8m2"
Checkout → COMPLETED
Cart → CONVERTED
Payment → SUCCEEDED
Inventory Reservation → COMMITTED
Order → CREATED
```

These transitions must be coordinated so that the system cannot accidentally represent an impossible state.

---

# 31. Transaction Boundary

Checkout may involve multiple domains.

The system must distinguish between operations that can share one database transaction and operations that involve external systems.

Database transactions should cover atomic local state changes.

External provider calls must not be held inside long database transactions.

---

# 32. External Payment Calls

Do not perform:

```text id="k7n5p3"
BEGIN DB TRANSACTION
   ↓
Call payment provider
   ↓
Wait
   ↓
COMMIT
```

Instead:

```text id="u6r3q1"
Prepare local state
   ↓
External payment operation
   ↓
Process result
   ↓
Short DB transaction
```

This avoids long-running locks.

---

# 33. Failure Recovery

Checkout must tolerate failures between steps.

Example:

```text id="e8c5r7"
Payment succeeds
      ↓
Application crashes
      ↓
Order not yet created
```

Recovery must use persisted payment state and idempotent order creation to complete the process safely.

---

# 34. Checkout Resume

A pending checkout may be resumed.

Resume must revalidate:

- checkout state
- payment state
- inventory reservation
- discount
- product availability
- final amount

The system must not blindly continue from stale state.

---

# 35. Checkout Expiration

Checkouts should have an expiration time.

Expiration prevents indefinitely held purchase state and stale inventory reservations.

Conceptually:

```text id="p4j8s2"
OPEN
 ↓
expires_at reached
 ↓
EXPIRED
 ↓
release reservation
```

---

# 36. Expired Checkout

An expired checkout cannot be completed.

The customer must create a new checkout or restart the purchase flow.

---

# 37. Cancellation

A checkout may be cancelled before completion where supported.

Cancellation must:

- prevent payment completion where possible
- release inventory reservation
- prevent order creation
- preserve auditability

A completed checkout cannot be cancelled through the Checkout module.

Order cancellation is owned by Orders.

---

# 38. Checkout Addresses

Checkout may collect shipping and billing addresses.

The address supplied for checkout must be validated before payment/order completion.

Once the order is created, Orders should store historical address snapshots.

Later customer address changes must not alter historical order addresses.

---

# 39. Guest Checkout

Guest checkout is supported.

Guest checkout may use:

```text id="d2k5m7"
Guest identity
+
Contact information
+
Checkout
```

Guest identity must not be treated as a full Customer account unless a Customer record is explicitly created.

---

# 40. Registered Customer Checkout

For registered customers:

```text id="s5h7k9"
Authenticated User
 ↓
Customer
 ↓
Checkout
```

The server must verify that the customer belongs to the current Store.

---

# 41. Customer Data

Checkout may read customer information but does not own the Customer profile.

For example:

```text id="v9r2x6"
Customer
   ↓
Checkout
   ↓
Snapshot required information
```

Checkout must not directly modify Customer internals.

---

# 42. Shipping

Demo may support a minimal shipping model.

If shipping is implemented, Checkout owns the selection of the applicable shipping option for the purchase.

Complex shipping-rate calculation is outside Demo scope.

---

# 43. Tax

Demo may implement a basic tax calculation if required.

Tax calculation must be server-side and deterministic.

An advanced tax engine is outside the Demo scope.

---

# 44. Currency

A checkout has exactly one currency.

All monetary values within the checkout must use that currency.

Mixed-currency checkouts are not supported in Demo.

---

# 45. Idempotency

Checkout mutation endpoints that can cause financial or inventory side effects must support idempotency.

Examples:

```text id="u4f6w8"
Create payment
Complete checkout
Create order
Process webhook
```

Repeated requests with the same idempotency key must not create duplicate side effects.

---

# 46. Idempotency Storage

Idempotency records should retain enough information to safely replay the original result.

Conceptually:

```text id="r8t3k1"
IdempotencyRecord
├── key
├── scope
├── request_hash
├── response_status
├── response_body
├── created_at
└── expires_at
```

The exact implementation may be shared through a common infrastructure package.

---

# 47. Request Validation

Checkout APIs must validate:

- checkout identity
- cart identity
- addresses
- quantities
- payment method
- discount code
- customer identity
- currency
- required fields

Validation must happen before business operations.

---

# 48. API Surface

Conceptual endpoints:

```text id="q7f4k9"
POST /checkout
GET  /checkout/{checkoutId}
PATCH /checkout/{checkoutId}
POST /checkout/{checkoutId}/validate
POST /checkout/{checkoutId}/payment
POST /checkout/{checkoutId}/complete
POST /checkout/{checkoutId}/cancel
```

The final API surface should follow the API architecture specification.

---

# 49. Checkout Retrieval

Checkout retrieval must verify:

```text id="h3m7p2"
store_id
+
customer / guest ownership
+
checkout_id
```

A checkout ID alone must never grant access.

---

# 50. Checkout Error Conditions

Structured errors should include:

```text id="f9k2s6"
CHECKOUT_NOT_FOUND
CHECKOUT_ACCESS_DENIED
CHECKOUT_NOT_ACTIVE
CHECKOUT_EXPIRED
CHECKOUT_EMPTY
CHECKOUT_INVALID
CHECKOUT_PRICE_CHANGED
CHECKOUT_INVENTORY_UNAVAILABLE
CHECKOUT_DISCOUNT_INVALID
CHECKOUT_PAYMENT_REQUIRED
CHECKOUT_PAYMENT_FAILED
CHECKOUT_PAYMENT_PENDING
CHECKOUT_ALREADY_COMPLETED
CHECKOUT_ALREADY_CANCELLED
CHECKOUT_IDEMPOTENCY_CONFLICT
```

---

# 51. Price Change Handling

If final checkout pricing differs from the amount previously displayed, the system must not silently charge a different amount.

Depending on the final UX, the system should:

- reject completion and require recalculation, or
- update the checkout total and require explicit customer confirmation

The Demo implementation should favor explicit confirmation over silent repricing.

---

# 52. Payment Amount Verification

Before accepting payment success, the system must verify:

```text id="j8m4c2"
payment.amount == checkout.grand_total
```

and:

```text id="v6n9r3"
payment.currency == checkout.currency
```

The exact provider representation must be normalized through the Payments module.

---

# 53. Inventory Commitment

After successful payment and order creation, the inventory reservation must be committed.

Conceptually:

```text id="s2k6f8"
Reservation
ACTIVE
  ↓
Order confirmed
  ↓
COMMITTED
```

The Inventory module owns the actual inventory state transition.

---

# 54. Inventory Release

Reservations should be released when:

- payment fails
- checkout expires
- checkout is cancelled
- order creation cannot proceed
- payment becomes permanently invalid

Release operations must be idempotent.

---

# 55. Discount Usage

Discount usage must be committed only when the purchase reaches the appropriate successful state.

A failed or abandoned checkout must not permanently consume a discount usage limit.

---

# 56. Order Snapshot

When creating an Order, Checkout must provide enough information for Orders to create immutable historical data.

This includes, where applicable:

- product information
- variant information
- quantities
- prices
- discounts
- totals
- currency
- billing address
- shipping address
- customer identity

Orders then owns the resulting historical snapshot.

---

# 57. Checkout Events

Checkout may publish events such as:

```text id="m7p3x9"
CheckoutCreated
CheckoutValidated
CheckoutPaymentPending
CheckoutPaymentSucceeded
CheckoutPaymentFailed
CheckoutExpired
CheckoutCancelled
CheckoutCompleted
```

Events represent facts that have occurred.

---

# 58. Event Delivery

Consumers must tolerate duplicate event delivery.

Checkout completion must not depend on exactly-once event delivery.

Database constraints and idempotency are the final protection against duplicate financial effects.

---

# 59. Background Jobs

Potential checkout jobs include:

- checkout expiration
- stale reservation cleanup
- recovery of interrupted payment/order flows
- retrying recoverable post-payment processing

Worker jobs must be tenant-aware and idempotent.

---

# 60. Recovery Worker

A recovery worker may identify states such as:

```text id="c6v8q2"
Payment succeeded
+
Order missing
```

and safely resume order creation.

Recovery must use idempotent operations.

It must never create duplicate orders.

---

# 61. Observability

Checkout operations should include structured metadata:

```text id="x5r7n3"
checkout_id
cart_id
store_id
customer_id
payment_id
order_id
request_id
operation
status
duration
error_code
```

Sensitive payment information must never be logged.

---

# 62. Security

Checkout must enforce:

- store isolation
- cart ownership
- customer authorization
- server-side pricing
- server-side discount validation
- payment amount verification
- idempotency
- input validation
- safe error responses
- secure payment handling

Raw card data must not be stored by the Demo platform unless a compliant payment architecture explicitly requires it.

---

# 63. Payment Data

The Checkout domain should never store:

- raw card numbers
- CVV
- payment secrets
- provider authentication credentials

Payments should use provider-hosted or tokenized payment mechanisms.

---

# 64. Database Constraints

The database should enforce appropriate relationships:

```text id="w3n7c5"
Checkout.store_id → Store.id
Checkout.cart_id → Cart.id
Checkout.customer_id → Customer.id
CheckoutItem.checkout_id → Checkout.id
```

Unique constraints should prevent duplicate checkout completion and duplicate order creation.

---

# 65. Transaction Strategy

Short database transactions should be used for:

- checkout creation
- checkout state transitions
- reservation state changes where coordinated locally
- payment result persistence
- order creation coordination
- checkout completion
- cancellation

External API calls must remain outside long-running database transactions.

---

# 66. Concurrency Control

Checkout must protect against:

- duplicate completion
- simultaneous payment confirmation
- concurrent checkout requests
- reservation races
- duplicate webhooks
- retry storms

State transitions should use appropriate row locking, optimistic checks, unique constraints, or idempotency keys.

---

# 67. State Transition Protection

For example:

```text id="p5w8r2"
Checkout = COMPLETED

Request A → complete
Request B → complete
```

Only one request may perform the successful completion side effects.

The second request must receive the already-completed result or an appropriate conflict response.

---

# 68. Testing Requirements

Unit tests must cover:

- checkout creation
- lifecycle transitions
- pricing
- discount validation
- address validation
- expiration
- cancellation
- state transition rules
- idempotency behavior

---

# 69. Integration Tests

Integration tests must cover:

- cart-to-checkout conversion
- inventory reservation
- payment integration
- discount validation
- order creation
- reservation release
- reservation commit
- checkout expiration
- database transaction behavior
- cross-store isolation

---

# 70. Payment Failure Tests

At minimum:

```text id="u8n4y6"
Checkout
 ↓
Reserve inventory
 ↓
Payment fails
 ↓
Release reservation
 ↓
No completed order
```

---

# 71. Payment Success Recovery Test

Test:

```text id="j4r8t2"
Payment succeeds
 ↓
Application interruption
 ↓
Recovery worker
 ↓
Idempotent order creation
 ↓
Checkout completed
```

Expected result:

```text id="f6k2m9"
Exactly one order
Exactly one successful payment association
Inventory committed once
Checkout completed once
```

---

# 72. Duplicate Request Test

Send the same checkout completion request multiple times.

Expected:

```text id="q9w3e7"
Exactly one order
Exactly one inventory commitment
Exactly one successful checkout completion
```

---

# 73. End-to-End Flow

A complete Demo checkout flow:

```text id="m2c8x5"
Customer
  ↓
Storefront
  ↓
Product
  ↓
Cart
  ↓
Checkout
  ↓
Validate items
  ↓
Validate pricing
  ↓
Validate discount
  ↓
Reserve inventory
  ↓
Create payment
  ↓
Payment succeeds
  ↓
Create order
  ↓
Commit inventory
  ↓
Commit discount usage
  ↓
Convert cart
  ↓
Complete checkout
```

---

# 74. Failure Recovery Flow

A recoverable failure should follow:

```text id="v7n5k3"
Checkout
  ↓
Payment succeeds
  ↓
Order creation interrupted
  ↓
Persisted payment state
  ↓
Recovery
  ↓
Idempotent order creation
  ↓
Complete checkout
```

The architecture must assume interruptions can happen at any point.

---

# 75. Anti-Patterns

Do not:

- trust client-provided totals
- trust client-provided discount amounts
- trust client-provided payment success
- directly modify inventory tables
- directly modify order tables
- call payment providers inside long DB transactions
- create orders directly from frontend requests without validation
- assume payment success means order creation already happened
- rely on exactly-once webhooks
- permanently reserve inventory during cart creation
- store raw payment card data
- create a distributed checkout service for Demo

---

# 76. Demo Implementation Boundary

The Demo implementation should use:

```text id="e4m9x7"
modules/checkout
packages/db
packages/auth
packages/tenant
packages/validation
packages/event-bus
```

Checkout interacts with:

```text id="y5k8p2"
Carts
Products
Inventory
Customers
Discounts
Payments
Orders
```

All interactions must use public module interfaces or application services.

---

# 77. Demo-to-V1 Evolution

The Checkout domain should support future additions such as:

- multiple payment methods
- advanced shipping
- tax engines
- multi-currency
- subscriptions
- saved payment methods
- fraud checks
- checkout customization
- regional checkout rules
- complex promotions

These capabilities should extend the existing domain boundaries rather than turning Checkout into an uncontrolled collection of provider-specific logic.

---

# 78. Acceptance Criteria

The Checkout module is complete for Demo when:

- A valid cart can create a checkout.
- Guest checkout is supported.
- Registered customer checkout is supported.
- Checkout ownership is enforced.
- Empty carts cannot enter checkout.
- Product availability is revalidated.
- Prices are calculated server-side.
- Discounts are revalidated.
- Inventory can be reserved safely.
- Inventory reservation is concurrency-safe.
- Payment initiation is handled through the Payments domain.
- Payment results are verified server-side.
- Payment webhooks can safely resume checkout.
- Failed payments do not create completed orders.
- Inventory reservations are released on appropriate failures.
- Successful payments can create exactly one order.
- Checkout completion is idempotent.
- Converted carts cannot be reused.
- Expired checkouts cannot be completed.
- Historical order data is independent of later cart/product changes.
- Cross-store access is rejected.
- Sensitive payment data is not stored.
- Recovery from interrupted payment/order processing is supported.
- Integration and E2E tests cover successful and failed checkout flows.