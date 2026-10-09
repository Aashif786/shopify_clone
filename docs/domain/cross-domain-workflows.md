# Cross-Domain Workflows

## 1. Purpose

This document defines the major business workflows that cross domain boundaries in the Demo commerce platform.

It establishes:

- Which domains participate in each workflow
- Which domain owns each operation
- Synchronous vs asynchronous work
- Transaction boundaries
- State transitions
- Failure handling
- Idempotency requirements
- Event publication
- Retry behavior
- Tenant isolation requirements

The goal is to allow multiple domains to cooperate without violating domain ownership.

---

# 2. Workflow Principles

Cross-domain workflows follow these principles:

1. No domain directly modifies another domain's internal state.
2. Application services coordinate multi-domain operations.
3. The owning domain validates its own business rules.
4. PostgreSQL remains the transactional source of truth.
5. Transaction boundaries are explicit.
6. External API calls are not hidden inside long database transactions.
7. Critical operations are synchronous when correctness depends on their immediate result.
8. Secondary effects may be asynchronous.
9. All retryable operations must be designed for idempotency.
10. Tenant/store context must remain explicit throughout the workflow.
11. Events represent completed facts.
12. Jobs represent work that must be performed.
13. Failed workflows must leave the system in a recoverable state.

---

# 3. Cross-Domain Interaction Model

The general model is:

```text id="a6f3q9"
Client
  ↓
Application Service
  ↓
Domain A
  ↓
Public Interface
  ↓
Domain B
  ↓
Database / Integration
```

For asynchronous work:

```text id="k8m2v5"
Domain
  ↓
Transaction
  ↓
Event / Outbox
  ↓
Worker
  ↓
Application Service
  ↓
Domain
```

A workflow does not give one domain ownership over another domain.

---

# 4. Core Workflow Map

The major Demo workflows are:

```text id="p3x7n1"
1. Organization / Store Creation
2. Product Creation and Publication
3. Inventory Adjustment
4. Customer Registration
5. Cart Management
6. Checkout Creation
7. Checkout Completion
8. Payment Processing
9. Payment Webhook Processing
10. Order Creation
11. Order Management
12. Order Cancellation
13. Refund Processing
14. Discount Redemption
15. Background Job Processing
16. Notification Processing
17. Media Upload Processing
```

---

# 5. Store Creation Workflow

## 5.1 Participants

```text id="q5m8x2"
Stores
Authentication
Tenant
Database
```

---

## 5.2 Flow

```text id="z7n4p6"
Merchant
  ↓
Create Organization
  ↓
Create Membership
  ↓
Create Store
  ↓
Create Store Settings
  ↓
Activate/Complete Setup
```

---

## 5.3 Transaction

The initial organization/store setup should use a database transaction when the entities must be created atomically.

Conceptually:

```text id="r8c3m5"
BEGIN

create organization
create owner membership
create store
create store settings

COMMIT
```

If the transaction fails, partial setup must not remain.

---

# 6. Store Creation Invariants

The workflow must guarantee:

- organization exists
- owner membership exists
- store belongs to organization
- settings belong to store
- initial tenant context is valid

The client must not be able to create a store under an organization it does not control.

---

# 7. Product Creation Workflow

## 7.1 Participants

```text id="v2m6q8"
Products
Stores
Media
```

---

## 7.2 Flow

```text id="k4x8n2"
Merchant
  ↓
Authorize Store
  ↓
Validate Product
  ↓
Create Product
  ↓
Create Variants
  ↓
Attach Media
  ↓
Publish when explicitly requested
```

Product creation does not automatically create inventory unless the product workflow explicitly requires it.

---

# 8. Product Publication Workflow

```text id="x7q3m9"
Merchant
  ↓
Authorize
  ↓
Load Product
  ↓
Validate publication requirements
  ↓
Publish Product
  ↓
Persist state
  ↓
Publish ProductPublished event
```

Consumers of the event may perform secondary actions.

Publication itself remains owned by Products.

---

# 9. Inventory Adjustment Workflow

## 9.1 Participants

```text id="j5m8x4"
Inventory
Products
Stores
```

---

## 9.2 Flow

```text id="n3v7q2"
Merchant
  ↓
Authorize Store
  ↓
Validate Variant
  ↓
Load Inventory Item
  ↓
Lock Inventory Row
  ↓
Validate Adjustment
  ↓
Update Quantity
  ↓
Create Adjustment Record
  ↓
Commit
  ↓
Publish InventoryAdjusted
```

The inventory mutation and adjustment history must be atomic.

---

# 10. Inventory Concurrency

Two simultaneous adjustments must not silently overwrite each other.

For example:

```text id="c8m2x7"
Initial stock = 10

Request A: +5
Request B: -3
```

The final result must correctly represent both operations.

For stock reservations:

```text id="v4p8n1"
Initial available = 5

Request A reserves 4
Request B reserves 4
```

Only one operation may succeed if there are only five available units.

---

# 11. Customer Registration Workflow

## 11.1 Flow

```text id="s6x3m8"
Customer
  ↓
Validate email
  ↓
Determine store context
  ↓
Create customer
  ↓
Associate user if registered
  ↓
Return customer
```

The customer must be associated with exactly the intended store.

---

# 12. Customer Address Workflow

```text id="w8q4m2"
Customer
  ↓
Authorize customer
  ↓
Validate address
  ↓
Create/update address
  ↓
Persist
```

A customer must never be able to modify another customer's address.

Merchant access is subject to store authorization.

---

# 13. Cart Creation Workflow

A cart may be created implicitly when a customer begins shopping.

```text id="p7m3x9"
Storefront
  ↓
Resolve Store
  ↓
Resolve Customer/Session
  ↓
Find Active Cart
  ↓
Create if absent
  ↓
Return Cart
```

The cart is always scoped to a store.

---

# 14. Add-to-Cart Workflow

## 14.1 Participants

```text id="q2v8m5"
Carts
Products
Inventory
```

---

## 14.2 Flow

```text id="k6x3n9"
Client
  ↓
Resolve Store
  ↓
Load Active Cart
  ↓
Validate Variant
  ↓
Validate Variant belongs to Store
  ↓
Validate Variant purchasability
  ↓
Validate quantity
  ↓
Add/update CartItem
  ↓
Commit
```

Current inventory may be checked for user feedback, but final inventory correctness is enforced during checkout.

---

# 15. Cart Quantity Update

The workflow:

```text id="m8q4x1"
Load Cart
  ↓
Authorize Cart
  ↓
Validate Variant
  ↓
Validate Quantity
  ↓
Update CartItem
  ↓
Commit
```

The operation must preserve:

```text id="r3v7n2"
UNIQUE(cart_id, variant_id)
```

so duplicate CartItems for the same variant cannot be created accidentally.

---

# 16. Discount Application Workflow

## 16.1 Participants

```text id="z5m8q3"
Checkout
Discounts
Products
Customers
```

---

## 16.2 Flow

```text id="j7x2p9"
Customer
  ↓
Submit Discount Code
  ↓
Checkout
  ↓
Discounts.validate()
  ↓
Check:
    store
    status
    dates
    eligibility
    minimum amount
    usage limits
    customer restrictions
  ↓
Calculate Discount
  ↓
Return Result
```

Discount validation should not permanently consume usage merely because a code was entered.

Actual redemption must occur at the appropriate transaction point.

---

# 17. Discount Redemption

Actual usage should be recorded atomically with the business operation that consumes it.

Conceptually:

```text id="v4n8m2"
BEGIN

lock/check usage
validate remaining limit
create usage record
complete relevant purchase state

COMMIT
```

A retry must not create a second usage record for the same business operation.

---

# 18. Checkout Creation Workflow

## 18.1 Participants

```text id="x6m3q8"
Carts
Products
Customers
Discounts
Checkout
```

---

## 18.2 Flow

```text id="n7p4v2"
Cart
  ↓
Validate Cart
  ↓
Load Current Product Data
  ↓
Validate Items
  ↓
Resolve Customer
  ↓
Create Checkout
  ↓
Calculate Initial Totals
  ↓
Return Checkout
```

Checkout creation does not imply payment success.

---

# 19. Checkout Recalculation

Before payment, the system must recalculate authoritative values.

```text id="q8m2x5"
Checkout
  ↓
Load items
  ↓
Validate products
  ↓
Calculate merchandise totals
  ↓
Apply discounts
  ↓
Calculate final total
  ↓
Persist checkout totals
```

The client-provided total is never authoritative.

---

# 20. Checkout Completion

Checkout completion is the most important cross-domain workflow in Demo.

Participants:

```text id="b6x9m3"
Checkout
Products
Inventory
Discounts
Payments
Orders
Events
```

---

# 21. Checkout Completion: High-Level Flow

```text id="w3q8n2"
Customer
  ↓
Complete Checkout
  ↓
Validate Checkout
  ↓
Recalculate Totals
  ↓
Validate Discounts
  ↓
Reserve / Consume Inventory
  ↓
Initiate / Confirm Payment
  ↓
Create Order
  ↓
Finalize Checkout
  ↓
Publish OrderCreated
  ↓
Trigger Secondary Effects
```

The exact payment ordering depends on the payment integration model.

---

# 22. Checkout Completion: Critical Invariants

The workflow must prevent:

```text id="s5m8x1"
Duplicate orders
Duplicate payments
Duplicate inventory consumption
Duplicate discount usage
```

It must also prevent:

```text id="k7q3n9"
Order created without the required payment condition
```

and:

```text id="v2m6x8"
Inventory consumed twice for one checkout
```

---

# 23. Checkout Idempotency

Checkout completion must support an idempotency key.

Conceptually:

```text id="n4x8q2"
store_id
operation
idempotency_key
request_hash
result_reference
status
```

Repeated requests using the same key must not create a second order.

The exact database design follows the migration and concurrency strategy.

---

# 24. Payment Processing Workflow

## 24.1 Flow & Transactional Coordination

The payment workflow spans local transactional phases and external gateway interactions:

```text id="j6m3v9"
Checkout in PAYMENT_PENDING
  ↓
Payments.createPayment(storeId, checkoutId, idempotencyKey)
  ↓ [DB Transaction 1]
Validate Checkout Totals & Currency (authoritative snapshot)
Insert/Reserve Payment (CREATED / PENDING) & PaymentAttempt (INITIATED)
Record Idempotency Record (idempotency_records)
Commit DB Transaction 1 (Locks released)
  ↓ [Outside DB Transaction]
Dispatch External HTTP Request: Razorpay Orders API (POST /v1/orders)
  ↓ [DB Transaction 2]
Persist provider order ID ('order_xxx') into PaymentAttempt; set Payment to PENDING
Commit DB Transaction 2
  ↓
Return provider order details & Key ID to Client Checkout Modal
  ↓
Customer Authenticates & Pays via Razorpay Modal
```

The provider adapter remains strictly encapsulated inside the Payments domain boundary.

---

# 25. Payment Provider Failure & Ambiguity

External payment APIs can fail in ambiguous ways:

```text id="p8x2m6"
Request sent to Gateway
    ↓
Provider processes charge / network timeout
    ↓
Application receives socket timeout or gateway error
```

The application **must not** assume:

```text id="z4q7n1"
timeout = payment failed
```

Instead:
1. The payment and attempt transition to `REQUIRES_RECONCILIATION`.
2. The checkout remains in `PAYMENT_PENDING` (customer is not prompted to retry immediately to prevent double charging).
3. An automated background worker queries the Razorpay Status API (`GET /v1/payments/{payment_id}`) or awaits incoming webhooks to resolve the state definitively to `CAPTURED` or `FAILED`.

---

# 26. Payment Webhook Workflow

## 26.1 Participants

```text id="v8q3m5"
Razorpay Gateway
Webhooks HTTP Route (/api/v1/webhooks/payments/razorpay)
Payments Module
Checkout Module
Orders Module
Event Bus
```

## 26.2 Flow

```text id="n6x2p9"
Razorpay Webhook Request Delivered
  ↓
Capture & Preserve Raw Request Body Bytes (Buffer)
  ↓
Verify Cryptographic Signature (HMAC-SHA256 via X-Razorpay-Signature)
  ↓ [Invalid: HTTP 400 Reject immediately]
Begin PostgreSQL Transaction
  ↓
Deduplicate Event (INSERT INTO payment_webhook_events ON CONFLICT DO NOTHING)
  ↓ [Duplicate: Commit & return HTTP 200 immediately]
Lock Payment Aggregate (SELECT * FROM payments WHERE id = $1 FOR UPDATE)
  ↓
Validate State Transition (Reject stale / out-of-order regressive events)
  ↓
Update Payment to CAPTURED (record captured_amount)
Update PaymentAttempt to CAPTURED
Mark Webhook Event PROCESSED
Commit PostgreSQL Transaction
  ↓
Trigger Downstream Checkout / Order Completion
  ↓
Return HTTP 200 OK to Razorpay
```

---

# 27. Duplicate and Stale Webhook Handling

### Duplicate Deliveries
If the same provider event arrives twice (`provider_event_id` already exists with `status = 'PROCESSED'`):
- The second delivery returns HTTP 200 OK immediately.
- It must not:
  - create another payment
  - create another order
  - consume inventory again
  - create duplicate refunds
  - send duplicate customer notifications

### Stale / Out-of-Order Deliveries
- If payment is already in `CAPTURED` and an earlier event arrives (e.g. `payment.authorized` or `payment.pending`):
  - The event is marked `status = 'IGNORED'` in `payment_webhook_events`.
  - The payment state is NOT altered.
  - Return HTTP 200 OK.
- If payment is already `CAPTURED`, a delayed `payment.failed` event is ignored and logged for audit.

---

# 28. Payment Success to Order Workflow & Recovery Contract

When payment reaches `CAPTURED`:

```text id="r8n3m6"
Payment Aggregate
  ↓
Status = CAPTURED (Verified & Committed in PostgreSQL)
  ↓
CheckoutService.completeCheckout(storeId, checkoutId, { paymentId })
  ↓
Validate Checkout State (Must be PAYMENT_PENDING)
Verify Payment is CAPTURED, storeId matches, amount & currency match checkout
  ↓
Create Order (Snapshot items, customer, billing/shipping addresses)
Commit Inventory
Checkout transitions PAYMENT_PENDING -> COMPLETED
  ↓
Publish OrderCreated Domain Event
```

### Order Creation Recovery Path
If the application crashes or database connection drops between committing `payment.status = 'CAPTURED'` and completing the checkout:
1. The payment and checkout remain safely durable in PostgreSQL (`payment.status = 'CAPTURED'`, `checkout.status = 'PAYMENT_PENDING'`).
2. Order creation is strictly idempotent, keyed on `(store_id, checkout_id)`.
3. A background recovery worker scans for checkouts in `PAYMENT_PENDING` with captured payments older than a safety threshold (e.g. 1 minute) and re-invokes checkout completion safely without charging the customer again or duplicating orders.


---

# 29. Order Creation Workflow

## 29.1 Participants

```text id="q6m2x8"
Checkout
Orders
Inventory
Discounts
Payments
```

---

## 29.2 Flow

```text id="v7p3n9"
Validated Checkout
  ↓
Create Order
  ↓
Copy Historical Product Data
  ↓
Copy Prices
  ↓
Copy Discounts
  ↓
Create Order Items
  ↓
Create Addresses
  ↓
Create Initial Status History
  ↓
Commit
```

The resulting Order becomes the historical transaction record.

---

# 30. Order Creation Invariants

At creation time:

- order belongs to checkout store
- order customer matches checkout customer where applicable
- order items match validated checkout items
- order totals match authoritative calculations
- currency is consistent
- payment condition is satisfied
- inventory operation has the correct relationship to the order
- discount usage is recorded correctly
- order number is unique within the intended scope

---

# 31. Order Confirmation Workflow

```text id="m5x8q3"
Merchant/System
  ↓
Authorize
  ↓
Load Order
  ↓
Lock/validate state
  ↓
Confirm Order
  ↓
Create Status History
  ↓
Publish OrderConfirmed
  ↓
Trigger Notifications
```

Only the Orders domain owns the state transition.

---

# 32. Order Fulfillment Workflow

```text id="p3q7x9"
Merchant
  ↓
Authorize
  ↓
Load Order
  ↓
Validate CONFIRMED/PROCESSING state
  ↓
Transition to FULFILLED
  ↓
Create Status History
  ↓
Publish OrderFulfilled
  ↓
Notify Customer
```

Advanced shipment management is outside Demo scope.

---

# 33. Order Cancellation Workflow

## 33.1 Participants

```text id="j8m4v2"
Orders
Inventory
Payments
Notifications
```

---

## 33.2 Flow

```text id="n5x7q3"
Cancel Request
  ↓
Authorize
  ↓
Load Order
  ↓
Validate Cancellation
  ↓
Cancel Order
  ↓
Release Inventory if applicable
  ↓
Cancel/Refund Payment if applicable
  ↓
Record Status History
  ↓
Publish OrderCancelled
  ↓
Notify Customer
```

Payment and inventory operations must be idempotent.

---

# 34. Refund Workflow

## 34.1 Flow & Transactional Coordination

```text id="w6q2m8"
Merchant Initiates Refund (POST /api/v1/stores/:storeId/payments/:paymentId/refunds)
  ↓
Authorize Merchant Role (Store Admin or Owner required)
  ↓ [DB Transaction 1]
Check Idempotency (idempotency_records)
Lock Payment Aggregate: SELECT * FROM payments WHERE id = $1 AND store_id = $2 FOR UPDATE
Validate Source State: payment.status IN ('CAPTURED', 'PARTIALLY_REFUNDED')
Validate Remaining Refundable: requested_amount <= (captured_amount - refunded_amount)
Insert Refund Record: status = 'PENDING'
Commit DB Transaction 1 (Lock released)
  ↓ [Outside DB Transaction]
Dispatch External Call: Razorpay Refund API (POST /v1/payments/{payment_id}/refund)
  ↓ [DB Transaction 2]
Lock Payment Aggregate FOR UPDATE
If Razorpay processed:
  Update refund: status = 'SUCCEEDED', provider_refund_id = res.id
  Increment payment: refunded_amount = refunded_amount + refund.amount
  Update payment status: 'REFUNDED' (if sum == captured) or 'PARTIALLY_REFUNDED'
If Razorpay pending:
  Update refund: status = 'PENDING' (await webhook refund.processed)
If Razorpay failed:
  Update refund: status = 'FAILED'
If gateway timeout:
  Update refund: status = 'REQUIRES_RECONCILIATION'
Commit DB Transaction 2
  ↓
Publish PaymentRefunded Event on Event Bus
  ↓
Orders Domain Updates Order Financial Status
```

---

# 35. Partial Refund & Concurrency Serialization

### Concurrency Protection
- Multiple refund requests (e.g. from two merchants or duplicate API submissions) are serialized via PostgreSQL row-level locking (`SELECT ... FOR UPDATE` on `payments`).
- The cumulative invariant `payments_refunded_amount_check CHECK (refunded_amount >= 0 AND refunded_amount <= captured_amount)` guarantees that total refunds never exceed captured funds under any concurrency condition.

### Partial Refund Accounting Example

```text id="q7m4x2"
Original Captured Amount = ₹1,000 (100000 paise)
Refund #1 = ₹300 (30000 paise) → Succeeded
  Payment State: PARTIALLY_REFUNDED (refunded_amount = 30000, remaining = 70000)

Refund #2 = ₹700 (70000 paise) → Succeeded
  Payment State: REFUNDED (refunded_amount = 100000, remaining = 0)
```

A subsequent refund request is rejected with `PAYMENT_REFUND_LIMIT_EXCEEDED`.


---

# 36. Storefront Product Workflow

The storefront is read-oriented.

```text id="v8n3m6"
Customer
  ↓
Resolve Store
  ↓
Query Published Products
  ↓
Query Variants
  ↓
Query Media
  ↓
Query Availability
  ↓
Return Public Product Representation
```

The storefront must not expose internal merchant-only data.

---

# 37. Storefront Cart Workflow

```text id="m6x2q8"
Customer
  ↓
Resolve Store
  ↓
Resolve Cart
  ↓
Validate Ownership/Session
  ↓
Read Cart
  ↓
Read Current Product Information
  ↓
Return Public Cart Representation
```

Sensitive internal information must not be exposed.

---

# 38. Customer Order History Workflow

```text id="p4q7n2"
Customer
  ↓
Authenticate
  ↓
Resolve Customer
  ↓
Resolve Store
  ↓
Query Orders
  ↓
Verify Customer Ownership
  ↓
Return Orders
```

A customer must never access another customer's orders.

---

# 39. Merchant Order Management Workflow

```text id="x5m8q3"
Merchant
  ↓
Authenticate
  ↓
Resolve Organization/Store
  ↓
Authorize Role
  ↓
Query Store Orders
  ↓
Apply filters/pagination
  ↓
Return Merchant Order View
```

The query must always remain tenant-scoped.

---

# 40. Notification Workflow

Notifications are secondary effects.

Example:

```text id="n7v3m9"
OrderCreated
  ↓
Create Notification Job
  ↓
Worker
  ↓
Load Notification Data
  ↓
Send Notification
  ↓
Record Result
```

Notification delivery must not determine whether the original order transaction succeeds.

For example:

```text id="k2x8q4"
Email provider unavailable
```

must not cause:

```text id="r6m3p9"
Order creation rollback
```

---

# 41. Media Workflow

Media may use object storage.

Conceptually:

```text id="v4x7m2"
Merchant
  ↓
Request Upload
  ↓
Generate Authorized Upload Target
  ↓
Object Storage
  ↓
Confirm Upload
  ↓
Attach Media to Product
```

The database stores metadata and references.

Binary files should not be stored directly in PostgreSQL for normal product media.

---

# 42. Background Job Workflow

A secondary action may become a job:

```text id="q8m2x6"
Business Transaction
  ↓
Create Job/Event
  ↓
Commit
  ↓
Worker Claims Job
  ↓
Execute Application Service
  ↓
Success / Retry / Failure
```

The worker must not bypass domain rules.

---

# 43. Retryable vs Non-Retryable Failures

### Retryable

Examples:

- temporary network failure
- provider timeout
- temporary database connectivity issue
- transient object-storage failure

### Non-retryable

Examples:

- invalid request
- invalid business state
- invalid discount
- unauthorized operation
- malformed external event

The job system must distinguish these categories.

---

# 44. Workflow Transaction Boundaries

A transaction should normally contain:

```text id="m7x3q9"
Database reads required for consistency
Business validation
Business state changes
Required internal records
Outbox/event creation
```

A transaction should generally not contain:

```text id="s4n8p2"
Long external HTTP calls
Email delivery
Large file processing
Slow third-party operations
```

This keeps locks short and predictable.

---

# 45. Event-Driven Secondary Effects

Example:

```text id="c8q2m7"
OrderCreated
   │
   ├──► Notification Job
   ├──► Analytics Event later
   └──► Other secondary processing
```

The Order domain does not need to know the implementation details of each consumer.

---

# 46. Event Ordering

Consumers must not assume perfect ordering unless ordering is explicitly guaranteed.

Example:

```text id="x3m7v8"
PaymentSucceeded
PaymentRefunded
```

may arrive through different asynchronous paths.

Consumers must validate the current authoritative state before applying effects.

---

# 47. Cross-Domain Error Handling

Errors should identify the business failure.

Examples:

```text id="p6q3m8"
InsufficientInventory
InvalidDiscount
CheckoutAlreadyCompleted
PaymentProcessing
InvalidOrderTransition
RefundExceedsAmount
StoreAccessDenied
```

Application/API layers map these into transport-specific responses.

---

# 48. Tenant Context Propagation

Every cross-domain workflow must preserve:

```text id="v9m2x4"
organization_id
store_id
actor/user context
```

where applicable.

For background work, the required tenant context must be stored with the job/event rather than reconstructed from untrusted input.

---

# 49. Cross-Tenant Protection

A workflow must reject invalid combinations such as:

```text id="r3x8m5"
Store A
+
Product from Store B
```

or:

```text id="q7m4n2"
Customer from Store A
+
Cart from Store B
```

or:

```text id="w5p9x3"
Payment belonging to Store A
+
Order belonging to Store B
```

Tenant isolation must be enforced at the application and database levels where practical.

---

# 50. Idempotency Matrix

| Workflow | Idempotency Required |
|---|---|
| Store creation | Yes where retry can duplicate setup |
| Product creation | Recommended |
| Inventory adjustment | Yes |
| Inventory reservation | Critical |
| Inventory release | Critical |
| Cart mutation | Recommended |
| Discount redemption | Critical |
| Checkout completion | Critical |
| Payment creation | Critical |
| Payment webhook | Critical |
| Order creation | Critical |
| Order cancellation | Critical |
| Refund | Critical |
| Notification | Recommended |
| Background jobs | Critical |

---

# 51. Concurrency-Critical Workflows

The highest-risk workflows are:

```text id="m8q3x7"
Inventory reservation
Checkout completion
Payment processing
Webhook processing
Order creation
Refunds
Discount usage
Job claiming
```

These workflows require explicit concurrency tests.

---

# 52. Failure Recovery

Every critical workflow should answer:

1. What if the database transaction fails?
2. What if the external API times out?
3. What if the request is retried?
4. What if a webhook is duplicated?
5. What if the worker crashes?
6. What if the operation succeeds but the response is lost?
7. What if events arrive out of order?
8. What if the external provider is unavailable?

If these questions do not have deterministic answers, the workflow is incomplete.

---

# 53. Successful Transaction, Failed Response

A critical pattern:

```text id="q4m8x2"
Server:
    commits order

Network:
    response lost

Client:
    retries request
```

The retry must return the existing result rather than create another order.

This is one of the primary reasons idempotency is required for checkout and payment operations.

---

# 54. Worker Crash Recovery

Example:

```text id="x7n3m5"
Worker claims job
  ↓
Worker crashes
```

The system must eventually make the job recoverable.

Possible mechanisms:

- lease/visibility timeout
- retry scheduling
- stale-running-job detection
- idempotent processing

The exact implementation belongs to the background-processing infrastructure.

---

# 55. Cross-Domain Workflow Ownership

| Workflow | Primary Owner |
|---|---|
| Store creation | Stores |
| Product creation | Products |
| Inventory adjustment | Inventory |
| Customer creation | Customers |
| Cart mutation | Carts |
| Discount redemption | Discounts |
| Checkout completion | Checkout |
| Payment processing | Payments |
| Payment webhook | Payments |
| Order creation | Orders |
| Order state transition | Orders |
| Refund processing | Payments + Orders |
| Notification delivery | Notification capability |
| Background execution | Worker infrastructure |

Ownership means the domain controls the business rules, not that it necessarily performs every technical step.

---

# 56. Demo Implementation Strategy

Demo should implement these workflows with:

- PostgreSQL transactions
- application services
- domain services where useful
- public module interfaces
- idempotency records
- row locking where required
- unique constraints
- persisted events/jobs
- worker processing
- provider adapters
- server-side authorization

Demo does not require:

- distributed transactions
- Kafka
- Temporal
- microservices
- service mesh
- distributed locks by default
- multiple databases
- complex workflow engines

The goal is correctness without infrastructure theater.

---

# 57. Demo-to-V1 Evolution

The workflows should remain stable while infrastructure evolves.

V1 may introduce:

```text id="n5x8q2"
Redis
Message broker
Dedicated payment service
Search service
Notification service
Analytics pipeline
Dedicated worker pools
```

These changes should replace infrastructure mechanisms without changing the fundamental business workflow contracts.

---

# 58. Cross-Domain Workflow Anti-Patterns

Avoid:

### Direct database manipulation across modules

```text id="r7m2x8"
Checkout → UPDATE orders
```

### Giant orchestration service

A single service containing every domain rule becomes impossible to maintain.

### External API inside long transaction

This causes long locks and unpredictable failures.

### Event for critical synchronous validation

Do not make inventory availability asynchronous when checkout requires an immediate authoritative answer.

### Missing idempotency

Retries are inevitable.

### Hidden side effects

A method named `getOrder()` should not secretly mutate inventory.

### Client-controlled workflow state

The browser must not decide that payment is successful or an order is fulfilled.

---

# 59. Workflow Observability

Critical workflows should produce enough structured information to trace:

```text id="x6q3m9"
request_id
correlation_id
organization_id
store_id
actor_id
workflow
entity_id
transition
idempotency_key
provider_reference
job_id
result
error
duration
```

Sensitive data must not be logged.

---

# 60. Definition of Done

Cross-domain workflows are sufficiently defined when:

- Core workflows are documented.
- Domain ownership is explicit.
- Transaction boundaries are understood.
- Synchronous and asynchronous work are separated.
- Critical workflows have idempotency requirements.
- Concurrency risks are identified.
- External provider failures are handled.
- Webhook retries are handled.
- Worker retries are handled.
- Tenant context is preserved.
- Historical data requirements are respected.
- Side effects are separated from core transactions where appropriate.
- The workflows can evolve without requiring domain boundaries to be rewritten.