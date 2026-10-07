# Orders Implementation

## 1. Purpose

This document defines the concrete execution-level implementation of the Orders domain for the Demo.

The Orders domain represents completed purchases and provides the durable historical record of what a customer purchased, at what price, under which Store, and through which payment workflow.

Orders must remain stable even when Products, Variants, Customers, Prices, Discounts, or Store configuration change later.

---

# 2. Domain Ownership

Order implementation belongs to:

```text
modules/orders
```

The module owns:

- Orders.
- Order items.
- Historical purchase snapshots.
- Order totals.
- Order status.
- Payment references.
- Fulfillment state where supported.
- Order status history.
- Merchant order-management operations.

It does not own:

```text
Products
Inventory
Payments
Checkout
Customers
Discount definitions
Cart internals
```

The Orders module consumes public interfaces and committed events from those domains.

---

# 3. Order Lifecycle

The basic purchase lifecycle is:

```text
Cart
  ↓
Checkout
  ↓
Payment
  ↓
Order
  ↓
Merchant Management
```

Order creation represents a successful purchase transition, not merely the creation of another temporary commerce record.

---

# 4. Order Model

An Order should contain information such as:

```text
id
store_id
customer_id
order_number
status
payment_status
fulfillment_status
currency
subtotal
discount_total
shipping_total
tax_total
total
created_at
updated_at
```

The exact schema must follow the database specification.

---

# 5. Order Number

Each Order should have a human-readable order number separate from the internal database identifier.

Example:

```text
ORD-2026-000001
```

The order number must be unique within the Store or globally according to the selected database design.

The internal ID remains the primary technical identifier.

---

# 6. Order Items

Order items should preserve the information required to reconstruct the purchase.

Example:

```text
id
order_id
variant_id
product_title
variant_title
sku
unit_price
quantity
line_total
```

Additional historical fields may be stored when required by the product and database specifications.

---

# 7. Historical Data

Order data is historical.

After creation, mutable catalog information must not silently change the Order.

For example:

```text
Product title at purchase → stored in Order Item
Product price at purchase  → stored in Order Item
SKU at purchase            → stored in Order Item
```

Changing the current Product must not rewrite historical Order information.

---

# 8. Order Totals

Order totals must be authoritative and internally consistent.

Conceptually:

```text
Subtotal
   +
Shipping
   +
Tax
   -
Discount
   =
Total
```

Only fields actually supported by the Demo should be included.

All monetary calculations must use exact arithmetic.

---

# 9. Order Currency

All Order monetary values must use one explicit currency.

For a completed purchase:

```text
Checkout.currency
=
Payment.currency
=
Order.currency
```

A mismatch must cause the operation to fail safely.

---

# 10. Order Creation

Order creation should normally occur after successful Checkout and payment processing.

Flow:

```text
Checkout
   ↓
Payment Confirmed
   ↓
Create Order
   ↓
Finalize Inventory
   ↓
Convert Cart
   ↓
Complete Checkout
```

The exact orchestration sequence must follow the Checkout implementation and payment strategy.

---

# 11. Order Creation Contract

Checkout should call the Order application service with authoritative information such as:

```text
storeId
customerId
currency
items
subtotal
discountTotal
shippingTotal
taxTotal
total
paymentReference
billingAddress
shippingAddress
```

The Order module validates the input required for Order creation.

---

# 12. Order Idempotency

Order creation is a critical idempotent operation.

Retries must not produce duplicate Orders.

Possible idempotency anchors include:

```text
checkoutId
paymentId
application idempotency key
```

A suitable unique database constraint should protect the final invariant.

For example, the system should ensure that one successful Checkout cannot create multiple completed Orders.

---

# 13. Duplicate Order Prevention

Potential duplicate scenario:

```text
Request A
   ↓
Create Order

Request B
   ↓
Retry same Checkout
   ↓
Create Order again
```

The second operation must return or resolve to the existing successful result rather than creating another Order.

Application idempotency and database constraints should both participate in protection.

---

# 14. Order Status

Use explicit Order states.

Example:

```text
Pending
Confirmed
Processing
Completed
Cancelled
```

The exact state machine must follow the Order specification.

Do not overload one status field with unrelated payment or fulfillment concepts.

---

# 15. Payment Status

Payment status should remain separate.

Example:

```text
Pending
Authorized
Paid
PartiallyRefunded
Refunded
Failed
```

Payments owns authoritative payment state.

Orders may store the Order-facing payment status needed for operational workflows.

---

# 16. Fulfillment Status

Where supported:

```text
Unfulfilled
PartiallyFulfilled
Fulfilled
Cancelled
```

The Demo may keep fulfillment intentionally simple.

Do not introduce warehouse-management complexity unless required.

---

# 17. Status History

Order status changes should be auditable.

An Order Status History record may contain:

```text
id
order_id
from_status
to_status
changed_by
reason
created_at
```

This allows merchant actions and system transitions to be traced.

---

# 18. Valid Status Transitions

Example:

```text
Pending
   ↓
Confirmed
   ├──→ Cancelled
   └──→ Processing
             ↓
          Completed
```

Invalid transitions must be rejected.

For example, a completed Order should not silently return to Pending.

---

# 19. Order Cancellation

Cancellation must validate:

```text
Order exists
Order belongs to Store
Order is cancellable
Current user has permission
```

Cancellation may also require coordination with:

- Payments for refunds.
- Inventory for release/restoration.
- Notifications.

The Orders module should request those operations through their public interfaces.

---

# 20. Payment and Cancellation

Do not directly manipulate Payment records during Order cancellation.

Instead:

```text
Order
 ↓
Payment refund request
 ↓
Payment domain
 ↓
Provider
```

The resulting payment state is then reflected back into the Order workflow.

---

# 21. Inventory and Cancellation

Inventory restoration belongs to Inventory.

Order cancellation may request inventory restoration when business rules require it.

The Orders module must not directly modify inventory quantities.

---

# 22. Order Creation and Inventory Finalization

Inventory reservation should already exist before Order creation.

After successful purchase:

```text
Inventory Reservation
       ↓
Finalize
       ↓
Stock becomes consumed
```

Inventory remains the authoritative owner of stock state.

---

# 23. Customer Integration

An Order may reference a Customer.

The Customer reference must belong to the same Store.

However, the Order should retain historical customer information where required rather than depending entirely on the current Customer record.

For example:

```text
Customer name at purchase
Customer email at purchase
Billing address at purchase
Shipping address at purchase
```

---

# 24. Address Snapshots

Addresses used for an Order should be immutable historical snapshots.

Do not simply reference a mutable Customer Address and assume it will remain unchanged forever.

Example:

```text
Customer Address
      ↓
Order creation
      ↓
Order Address Snapshot
```

The Customer may later change their address without modifying the historical Order.

---

# 25. Order Repository

Repository operations may include:

```text
createOrder
findById
findByOrderNumber
findByCheckoutId
findByCustomer
listByStore
updateStatus
recordStatusHistory
```

Queries must always respect Store ownership.

---

# 26. Order Queries

Merchant order listing should support basic filters such as:

```text
status
paymentStatus
fulfillmentStatus
customer
date range
order number
```

Only filters required by the Demo should be implemented.

Do not introduce a dedicated search engine for basic Order queries.

---

# 27. Pagination

Order lists must use deterministic pagination.

The implementation should define:

- Page size limits.
- Stable ordering.
- Cursor or offset strategy according to API conventions.
- Maximum page size.

Avoid unbounded Order queries.

---

# 28. Order Application Services

Typical services:

```text
createOrder
getOrder
listOrders
updateOrderStatus
cancelOrder
```

Refund operations belong to Payments.

Inventory changes belong to Inventory.

---

# 29. Order DTOs

Use explicit DTOs:

```text
OrderSummary
OrderDetail
OrderItem
OrderAddress
CreateOrderInput
UpdateOrderStatusInput
```

Do not expose database entities directly.

---

# 30. Merchant API

Typical endpoints:

```text
GET   /api/v1/orders
GET   /api/v1/orders/:id
POST  /api/v1/orders/:id/cancel
PATCH /api/v1/orders/:id/status
```

Exact routes and permissions must follow the API specification.

---

# 31. Customer API

Customers may access their own Orders through a customer-scoped API.

Example:

```text
GET /api/v1/customer/orders
GET /api/v1/customer/orders/:id
```

The API must ensure the authenticated Customer owns the requested Order.

---

# 32. Authorization

Merchant operations require appropriate Store membership permissions.

For example:

```text
Owner
Admin
Staff
```

must receive only the capabilities defined by the authorization model.

Customers must only access their own Orders.

Authorization must be enforced server-side.

---

# 33. Tenant Isolation

Every Order operation must enforce:

```text
order.store_id
=
currentStore.id
```

Never resolve an Order globally and then perform authorization afterward if the repository can enforce Store scoping directly.

Prefer:

```text
findOrder(storeId, orderId)
```

over:

```text
findOrder(orderId)
```

for tenant-scoped operations.

---

# 34. Order Events

Potential events include:

```text
OrderCreated
OrderConfirmed
OrderStatusChanged
OrderCancelled
OrderCompleted
```

Events represent committed facts.

Consumers may include:

```text
Notifications
Inventory
Payments
Analytics in future
```

No future consumer should require direct access to Order internals.

---

# 35. Notifications

Order events may trigger notifications such as:

```text
Order confirmation
Order cancellation
Order status update
Refund notification
```

Notifications are handled by the Notifications domain.

Orders should not contain email-provider logic.

---

# 36. Order Creation Transaction

Order persistence should occur inside an appropriate database transaction.

A simplified local transaction may include:

```text
BEGIN
  ↓
Validate Order creation invariant
  ↓
Create Order
  ↓
Create Order Items
  ↓
Create Address Snapshots
  ↓
Create Status History
  ↓
Persist required idempotency result
  ↓
COMMIT
```

External services must not be called while holding this transaction open.

---

# 37. Order and Payment Atomicity

Payment provider operations and Order database transactions cannot be made one distributed atomic transaction.

Therefore the system must rely on:

```text
Idempotency
State machines
Committed events
Webhook reconciliation
Retry-safe workflows
```

to recover from failures between Payment and Order creation.

---

# 38. Payment Success but Order Creation Failure

Critical scenario:

```text
Payment succeeds
      ↓
Application fails before Order creation
```

The system must not lose the successful payment.

Recovery may occur through:

```text
Payment webhook
Reconciliation job
Checkout completion retry
Payment-to-Order recovery workflow
```

The exact recovery path must remain idempotent.

---

# 39. Order Creation Failure Recovery

If Order creation fails due to a transient infrastructure problem:

```text
Payment remains known
Checkout remains recoverable
Order creation can retry
```

If the failure is a permanent business invariant violation, the workflow must stop and surface an operationally visible error.

---

# 40. Order Historical Immutability

After Order creation, do not rewrite:

```text
Purchased item price
Purchased item quantity
Product title snapshot
SKU snapshot
Billing address snapshot
Shipping address snapshot
Original order total
```

Corrections should use explicit adjustment/refund mechanisms rather than silently modifying history.

---

# 41. Order Security

Protect against:

```text
Cross-tenant access
Customer accessing another customer's Order
Unauthorized cancellation
Unauthorized status changes
Order ID enumeration
Price tampering
Payment reference tampering
```

Sensitive information should only be exposed to authorized users.

---

# 42. Order Number Security

Order numbers may be visible to customers.

They should not be treated as authorization credentials.

Authorization must still require:

```text
Store context
+
Authenticated identity
+
Resource ownership/permission
```

---

# 43. Logging

Useful structured fields include:

```text
storeId
orderId
orderNumber
customerId
checkoutId
paymentId
status
correlationId
```

Do not log unnecessary sensitive customer information.

---

# 44. Order Tests

Unit tests should cover:

```text
[ ] Order creation
[ ] Order state transitions
[ ] Invalid transitions
[ ] Total validation
[ ] Currency validation
[ ] Historical snapshots
[ ] Cancellation rules
[ ] Status history
```

---

# 45. Integration Tests

Verify:

```text
[ ] Checkout → Order
[ ] Payment → Order
[ ] Customer → Order
[ ] Inventory finalization
[ ] Order cancellation
[ ] Payment refund integration
[ ] Notification events
[ ] Order listing
[ ] Store isolation
```

---

# 46. Concurrency Tests

Verify:

```text
[ ] Duplicate Order creation
[ ] Two completion requests
[ ] Concurrent cancellation
[ ] Cancellation + status update
[ ] Duplicate event processing
[ ] Concurrent order status updates
```

The final Order state must always satisfy the state machine and database constraints.

---

# 47. Failure-Recovery Tests

Test:

```text
[ ] Payment succeeds but Order creation fails
[ ] Order creation retry
[ ] Duplicate completion
[ ] Webhook arrives after client timeout
[ ] Worker retry
[ ] Notification delivery failure
[ ] Inventory finalization retry
```

No successful purchase should disappear because a secondary operation failed.

---

# 48. Implementation Sequence

Implement Orders in this order:

```text
1. Define Order schema
2. Define Order Item schema
3. Define Order address snapshot schema
4. Define Order status history schema
5. Create migrations
6. Implement Order state machine
7. Implement Order repository
8. Implement Order creation service
9. Implement historical snapshots
10. Implement Order idempotency
11. Integrate Checkout
12. Integrate Payments
13. Integrate Inventory
14. Implement customer Order queries
15. Implement merchant Order queries
16. Implement status management
17. Implement cancellation
18. Implement Order events
19. Implement notification integration
20. Implement APIs
21. Add unit tests
22. Add integration tests
23. Add concurrency tests
24. Add failure-recovery tests
25. Verify tenant isolation and authorization
```

---

# 49. Definition of Done

Orders implementation is complete when:

```text
[ ] Order schema exists
[ ] Order items exist
[ ] Historical snapshots exist
[ ] Address snapshots exist
[ ] Order numbers are unique
[ ] Order state machine is enforced
[ ] Payment status is represented correctly
[ ] Fulfillment status is separated
[ ] Order creation is idempotent
[ ] Duplicate Orders are prevented
[ ] Checkout integration works
[ ] Payment integration works
[ ] Inventory integration works
[ ] Customer Order access works
[ ] Merchant Order management works
[ ] Cancellation works
[ ] Status history works
[ ] Order events work
[ ] Notifications integrate correctly
[ ] Tenant isolation works
[ ] Authorization works
[ ] Pagination works
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Concurrency tests pass
[ ] Failure-recovery tests pass
```

The Order is the durable record of the transaction. Once created, it should behave like history, not like another editable shopping cart. 