# Order Specification

## 1. Purpose

This specification defines the functional and technical requirements for the Orders domain of the Demo commerce platform.

The Orders domain is responsible for the authoritative historical representation of completed purchases.

It owns:

- Orders
- Order items
- Order addresses
- Order totals
- Order lifecycle
- Order status history
- Order references
- Order-level cancellation
- Refund coordination
- Historical purchase data

The Orders domain does not own:

- Carts
- Checkout
- Products
- Inventory
- Payments
- Discounts
- Customer profiles

Those domains interact with Orders through defined interfaces.

---

# 2. Scope

The Demo Orders module supports:

- Order creation
- Order retrieval
- Historical order data
- Order items
- Order totals
- Customer order history
- Merchant order management
- Order status transitions
- Basic cancellation
- Refund coordination
- Order status history
- Order numbering
- Store isolation
- Idempotent order creation

---

# 3. Out of Scope

Demo does not require:

- Advanced fulfillment management
- Warehouse management
- Multi-warehouse routing
- Partial fulfillment workflows
- Dropshipping orchestration
- Advanced shipping carrier integrations
- Subscription orders
- Marketplace orders
- Complex returns management
- Advanced exchanges
- International customs workflows
- Automated fraud resolution
- Advanced order analytics

These may be introduced later.

---

# 4. Domain Ownership

The Orders module owns:

```text id="r6m8x2"
Order
OrderItem
OrderAddress
OrderStatusHistory
```

Orders is authoritative for:

- historical purchase information
- order lifecycle
- order totals
- order numbering
- historical item information
- historical addresses
- order-level state

---

# 5. Order Entity

Conceptually:

```text id="n4k7p3"
Order
├── id
├── store_id
├── customer_id
├── checkout_id
├── payment_id
├── order_number
├── status
├── currency
├── subtotal
├── discount_total
├── shipping_total
├── tax_total
├── grand_total
├── created_at
├── updated_at
└── completed_at
```

The exact fields may evolve.

---

# 6. Order Item

Conceptually:

```text id="v8q3m6"
OrderItem
├── id
├── order_id
├── product_id
├── product_variant_id
├── product_name_snapshot
├── variant_name_snapshot
├── sku_snapshot
├── quantity
├── unit_price
├── discount_amount
├── tax_amount
├── line_total
└── created_at
```

Order items contain historical snapshots.

They must not depend on current Product records to reconstruct the original purchase.

---

# 7. Order Address

Orders must store historical address snapshots.

Conceptually:

```text id="k5p9r2"
OrderAddress
├── id
├── order_id
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

Supported types may include:

```text id="x7m4c8"
BILLING
SHIPPING
```

---

# 8. Order Lifecycle

Demo uses:

```text id="p3n8q5"
PENDING
CONFIRMED
PROCESSING
SHIPPED
DELIVERED
CANCELLED
COMPLETED
```

A typical flow is:

```text id="w6r2k9"
PENDING
   ↓
CONFIRMED
   ↓
PROCESSING
   ↓
SHIPPED
   ↓
DELIVERED
   ↓
COMPLETED
```

Cancellation is possible only from permitted states.

---

# 9. Order State Semantics

Order status represents the business lifecycle of the purchase.

Payment status is not the same as Order status.

For example:

```text id="q4v7m2"
Payment = CAPTURED
Order = PROCESSING
```

is valid.

Payments owns payment state.

Orders owns order state.

---

# 10. Order Creation

Orders should normally be created through Checkout.

Conceptually:

```text id="j8m3x6"
Checkout
 ↓
Payment success
 ↓
Order creation service
 ↓
Order
```

The client must not directly create an arbitrary completed order.

---

# 11. Order Creation Preconditions

Before creating an Order, the application must verify:

- checkout is valid
- checkout belongs to the Store
- payment is valid
- payment amount matches expected total
- inventory reservation exists
- required purchase data is available
- order has not already been created
- idempotency conditions are satisfied

---

# 12. Idempotent Order Creation

Order creation must be idempotent.

If the same checkout is processed multiple times:

```text id="m5k9r3"
Attempt 1 → Order 1001
Attempt 2 → existing Order 1001
Attempt 3 → existing Order 1001
```

The system must never create:

```text id="x8q2v6"
Order 1001
Order 1002
Order 1003
```

for one purchase.

---

# 13. Database Protection

Application-level idempotency must be reinforced by database constraints.

A suitable uniqueness rule should prevent multiple Orders from being created for the same checkout where the business model requires one-to-one checkout completion.

---

# 14. Order Number

Orders should have a human-readable order number.

Example:

```text id="r7c4n2"
ORD-100001
```

The internal order ID remains the stable technical identifier.

Order numbers are for merchant/customer-facing workflows.

---

# 15. Order Number Generation

Order numbers must:

- be unique within the required scope
- be generated server-side
- not depend on client input
- remain immutable
- not expose database sequence assumptions unnecessarily

The exact format may evolve.

---

# 16. Historical Pricing

Order items must store the final purchase price.

Example:

```text id="g3m8p5"
Product price at purchase = ₹1,499
```

If the product later changes to:

```text id="v6q2k9"
₹1,999
```

the existing Order must remain:

```text id="s4n7x3"
₹1,499
```

---

# 17. Historical Product Data

Orders should retain enough product information to display the historical purchase even if the product is later:

- renamed
- unpublished
- archived
- removed from the catalog

At minimum, appropriate snapshots should include:

- product name
- variant name
- SKU
- purchased price

---

# 18. Historical Discounts

Orders must store the final discount information used for the purchase.

Examples:

```text id="q8m4r7"
discount code
discount type
discount value
discount amount
```

The Order must not depend on the current Discount record to reconstruct the historical transaction.

---

# 19. Historical Addresses

Customer addresses may change after an order.

Therefore:

```text id="c5n9k2"
Customer Address
      ↓
Order Address Snapshot
```

The Order snapshot is immutable.

---

# 20. Historical Customer Relationship

An Order may reference a Customer.

However, the order must remain historically valid even if the Customer is later:

- deactivated
- anonymized
- modified

The relationship and privacy strategy must preserve the legal/business record without unnecessarily retaining personal data.

---

# 21. Guest Orders

Guest checkout may create an Order without a registered Customer.

In that case:

```text id="m8r3x6"
customer_id = null
```

where permitted by the data model.

The Order still contains the required purchase and contact information.

---

# 22. Customer Order History

Registered customers may retrieve their own orders.

Conceptually:

```text id="v4q7p2"
GET /customer/orders
```

The server must automatically scope results to the authenticated Customer.

Clients must not provide another customer's ID as an authorization mechanism.

---

# 23. Merchant Order Access

Merchant users may retrieve orders belonging to their Store.

The server must verify:

```text id="x6n3k8"
order.store_id == currentStore.id
```

before returning the order.

---

# 24. Cross-Store Isolation

An order belonging to Store A must never be accessible through Store B.

This applies to:

- retrieval
- update
- cancellation
- refund initiation
- status changes
- reporting

---

# 25. Order Totals

The Order stores immutable final totals.

Conceptually:

```text id="p9m5r3"
Subtotal
- Discount
+ Shipping
+ Tax
= Grand Total
```

The exact calculation rules belong to Checkout.

Orders records the finalized result.

---

# 26. Order Total Authority

Once the Order is created:

```text id="h7q2c5"
Order.grand_total
```

is the historical financial total.

It must not be recalculated from current product prices.

---

# 27. Currency

Each Order has exactly one currency.

All monetary values in the Order must use that currency.

Mixed-currency orders are not supported in Demo.

---

# 28. Order Status Transitions

Valid transitions should be explicitly defined.

Example:

```text id="n6r8v3"
PENDING → CONFIRMED
CONFIRMED → PROCESSING
PROCESSING → SHIPPED
SHIPPED → DELIVERED
DELIVERED → COMPLETED
```

Cancellation may be allowed from selected states:

```text id="y4m7p2"
PENDING → CANCELLED
CONFIRMED → CANCELLED
PROCESSING → CANCELLED
```

The exact permitted transitions must be enforced by application logic.

---

# 29. Invalid Transitions

Examples:

```text id="c8q5n1"
DELIVERED → PENDING
COMPLETED → PROCESSING
CANCELLED → SHIPPED
```

must be rejected.

Completed and cancelled orders are terminal unless a future domain explicitly introduces reopening semantics.

---

# 30. Order Status History

Every meaningful status change should create a history record.

Conceptually:

```text id="r3v8m5"
OrderStatusHistory
├── id
├── order_id
├── from_status
├── to_status
├── reason
├── actor_type
├── actor_id
└── created_at
```

This provides an audit trail.

---

# 31. Status Change Authorization

Merchant status changes require appropriate permissions.

Suggested model:

| Operation | Owner | Admin | Staff |
|---|---:|---:|---:|
| View orders | Yes | Yes | Yes |
| Confirm order | Yes | Yes | Yes |
| Mark processing | Yes | Yes | Yes |
| Mark shipped | Yes | Yes | Yes |
| Mark delivered | Yes | Yes | Yes |
| Cancel order | Yes | Yes | Optional |
| Refund | Yes | Yes | Optional |

The exact permissions follow the Store role model.

---

# 32. Customer Order Access

Customers may:

- view their own orders
- view order details
- view order status
- view historical totals
- view purchased items

Customers may not:

- modify order totals
- change payment state
- mark orders shipped
- change inventory
- modify another customer's orders

---

# 33. Order Cancellation

Cancellation is an Order-level operation.

Conceptually:

```text id="m9q4x6"
Order
 ↓
Validate state
 ↓
Cancel
 ↓
Release/correct inventory if required
 ↓
Initiate refund if required
```

The exact financial operation is delegated to Payments.

---

# 34. Cancellation Preconditions

Before cancellation, the system must verify:

- order exists
- store access is valid
- current status permits cancellation
- order is not already cancelled
- fulfillment state permits cancellation

---

# 35. Cancellation and Inventory

If an order is cancelled before fulfillment, inventory may need to be restored.

The Orders module must use the Inventory public interface.

It must not directly manipulate inventory tables.

---

# 36. Cancellation and Payment

If money has already been captured, cancellation may require a refund.

Conceptually:

```text id="k7n3p8"
Order cancellation
      ↓
Payments refund request
      ↓
Refund
```

Orders does not directly call the payment provider.

---

# 37. Refund State

Order cancellation and refund are related but distinct.

Example:

```text id="p4r8m2"
Order = CANCELLED
Refund = PENDING
```

This may be temporarily valid.

The system must not assume that cancellation instantly means money has already returned.

---

# 38. Refund Completion

Once the Payments domain confirms a successful refund, the Order may update its financial/refund state as appropriate.

The Payments domain remains authoritative for the actual financial transaction.

---

# 39. Order Fulfillment

Demo supports a simplified fulfillment lifecycle.

Example:

```text id="x5q7m3"
CONFIRMED
 ↓
PROCESSING
 ↓
SHIPPED
 ↓
DELIVERED
```

Advanced fulfillment is outside Demo scope.

---

# 40. Shipping Information

If shipping is supported, an Order may store:

- shipping address
- shipping method
- shipping charge
- tracking number

The exact carrier integration is outside the core Demo requirement.

---

# 41. Order Notifications

Orders may emit events that trigger notifications.

Examples:

```text id="n8v4c6"
OrderCreated
OrderConfirmed
OrderShipped
OrderDelivered
OrderCancelled
RefundCompleted
```

Notifications are secondary effects.

They must not determine whether the order state transition succeeds.

---

# 42. Event Delivery

Order event consumers must tolerate duplicate delivery.

For example:

```text id="q6m3r8"
OrderShipped
OrderShipped
```

must not send uncontrolled duplicate side effects.

Consumer-level idempotency should be used where necessary.

---

# 43. Order Events

The Orders domain may publish:

```text id="v2p7k4"
OrderCreated
OrderConfirmed
OrderProcessingStarted
OrderShipped
OrderDelivered
OrderCancelled
OrderCompleted
```

Events represent completed facts.

---

# 44. Order Creation Event

`OrderCreated` should be emitted only after the Order has been successfully persisted.

Consumers may use the event for:

- notifications
- analytics
- downstream processing
- integrations

The event must not be used as the only source of order existence.

---

# 45. Order API

Conceptual merchant endpoints:

```text id="f7m2x9"
GET   /stores/{storeId}/orders
GET   /stores/{storeId}/orders/{orderId}
PATCH /stores/{storeId}/orders/{orderId}/status
POST  /stores/{storeId}/orders/{orderId}/cancel
POST  /stores/{storeId}/orders/{orderId}/refund
```

Customer endpoints may include:

```text id="c4n8q5"
GET /customer/orders
GET /customer/orders/{orderId}
```

The exact API surface follows the API architecture specification.

---

# 46. Order Pagination

Merchant order lists must support pagination.

Expected filtering may include:

- status
- date range
- customer
- order number

Demo should use database-backed pagination rather than loading the entire order history.

---

# 47. Sorting

Default merchant order listing should normally use:

```text id="p8r3m6"
created_at DESC
```

Pagination ordering must be deterministic.

---

# 48. Order Search

Demo does not require a dedicated search engine.

Basic database filtering may support:

- order number
- customer email where permitted
- status
- date range

A dedicated search system may be introduced later if actual requirements justify it.

---

# 49. Order Number Lookup

Order numbers are customer/merchant-facing identifiers.

Lookup by order number must still enforce Store isolation.

A valid order number from another Store must not disclose order information.

---

# 50. Order Data Exposure

API responses should use explicit DTOs.

Do not expose:

- internal database fields unnecessarily
- payment provider secrets
- internal authentication metadata
- sensitive customer information unrelated to the requested operation

---

# 51. Payment Relationship

An Order may reference the Payment that funded it.

However:

```text id="m5v8q2"
Order status
≠
Payment status
```

The two domains communicate through explicit interfaces/events.

---

# 52. Inventory Relationship

Order creation consumes the Inventory reservation established during Checkout.

The Inventory module owns:

- stock quantity
- reservation
- commitment
- release

Orders must not directly update stock.

---

# 53. Product Relationship

Order items reference the original product and variant identifiers where available.

However, the Order's historical snapshots remain authoritative for what the customer purchased.

Current Product data is not used to rewrite historical orders.

---

# 54. Customer Relationship

An Order may reference the Customer.

Customer profile changes must not alter historical order totals or item snapshots.

---

# 55. Discount Relationship

Orders store the final applied discount information.

Discount definitions may later be archived or modified without changing existing Orders.

---

# 56. Order Integrity

The following invariants are mandatory:

1. Every Order belongs to exactly one Store.
2. Order number is unique within its defined scope.
3. Order totals are non-negative.
4. Order currency is explicit.
5. Order items belong to exactly one Order.
6. Quantities are positive integers.
7. Historical prices are immutable.
8. Historical addresses are immutable.
9. Completed Orders cannot be silently rewritten.
10. Cross-store access is rejected.
11. Order creation is idempotent.

---

# 57. Database Constraints

The database should enforce:

```text id="x3m7p9"
Order.store_id → Store.id
Order.customer_id → Customer.id
Order.checkout_id → Checkout.id
Order.payment_id → Payment.id
OrderItem.order_id → Order.id
OrderStatusHistory.order_id → Order.id
```

Additional constraints should enforce:

- valid monetary representation
- positive quantities
- unique order numbers
- unique checkout-to-order relationship where required

---

# 58. Transaction Strategy

Transactions should cover operations such as:

- order creation
- status transition
- order cancellation
- status history creation
- order-level financial state updates

Application services own the transaction boundary.

---

# 59. Order Creation Transaction

Order creation should atomically persist:

```text id="k8p4r6"
Order
+
OrderItems
+
OrderAddresses
+
InitialStatusHistory
```

If any required component fails, the local database transaction should roll back.

---

# 60. External Integrations

External systems must not be called from deep Order domain logic.

Examples:

```text id="n6v2x8"
Payment provider
Notification provider
Shipping provider
```

should be accessed through application services or background jobs.

---

# 61. Order Status and External Systems

External integrations may fail after an order transition.

For example:

```text id="m4q8r1"
Order → SHIPPED
Notification → fails
```

The order must remain `SHIPPED`.

Notification retry is a separate concern.

---

# 62. Background Jobs

Potential Order jobs include:

- notification delivery
- fulfillment synchronization
- refund status reconciliation
- stale processing recovery
- external integration retries

Jobs must be idempotent and tenant-aware.

---

# 63. Order Recovery

Recovery logic may identify inconsistent states such as:

```text id="p7n3c5"
Payment = CAPTURED
Order = missing
```

or:

```text id="v8m2q6"
Order = CANCELLED
Refund = PENDING
```

Recovery must use the responsible domain's public interface.

---

# 64. Observability

Order operations should include structured metadata:

```text id="r5k8m3"
order_id
order_number
store_id
customer_id
checkout_id
payment_id
operation
from_status
to_status
actor
request_id
duration
error_code
```

Sensitive information must be minimized in logs.

---

# 65. Metrics

Useful metrics include:

- orders created
- orders by status
- cancellation rate
- order creation failures
- payment/order reconciliation failures
- refund failures
- fulfillment delays
- order processing duration

---

# 66. Security

Orders must enforce:

- store isolation
- customer ownership
- merchant authorization
- server-side state transitions
- immutable historical financial data
- safe API serialization
- protection against IDOR
- auditability of privileged actions

---

# 67. Customer Privacy

Customer order data should only be exposed to:

- the customer who owns the order
- authorized merchant users
- authorized internal processes

Sensitive customer information must not appear in logs or public endpoints unnecessarily.

---

# 68. Testing Requirements

Unit tests must cover:

- order creation
- order numbering
- state transitions
- cancellation rules
- total invariants
- historical snapshots
- authorization rules
- invalid transitions

---

# 69. Integration Tests

Integration tests must cover:

- checkout-to-order creation
- payment relationship
- inventory commitment
- customer order history
- merchant order access
- cross-store isolation
- cancellation
- refunds
- database constraints
- status history
- idempotent order creation

---

# 70. Concurrency Tests

At minimum:

```text id="j5q8m3"
Request A → create order
Request B → create order
```

for the same checkout.

Expected:

```text id="w7n2p6"
Exactly one Order
```

Also test concurrent status transitions.

---

# 71. Cancellation Tests

Test:

```text id="c9m4r7"
Confirmed Order
      ↓
Cancel
      ↓
Order = CANCELLED
      ↓
Inventory released/corrected
      ↓
Refund initiated where required
```

Each external side effect must remain idempotent.

---

# 72. Historical Integrity Test

Test:

```text id="x6p3n8"
Create Order
 ↓
Change Product price
 ↓
Change Product name
 ↓
Archive Product
```

Expected:

```text id="m8r5q2"
Existing Order remains unchanged
```

---

# 73. End-to-End Purchase Flow

Complete Demo flow:

```text id="q4v7m9"
Storefront
  ↓
Product
  ↓
Cart
  ↓
Checkout
  ↓
Payment
  ↓
Order Created
  ↓
Inventory Committed
  ↓
Order Confirmed
  ↓
Merchant Processes Order
  ↓
Shipped
  ↓
Delivered
  ↓
Completed
```

---

# 74. Failure Recovery Flow

Example:

```text id="n3k8p5"
Payment succeeds
      ↓
Application interruption
      ↓
Recovery process
      ↓
Idempotent order creation
      ↓
Inventory commitment
      ↓
Order available
```

The result must contain exactly one Order.

---

# 75. Anti-Patterns

Do not:

- recalculate historical order prices from Products
- modify historical order items when products change
- trust client-provided order totals
- allow clients to set order status directly
- modify inventory tables directly
- call payment providers from domain entities
- delete completed orders as normal CRUD
- create duplicate orders on webhook/retry
- assume payment state equals order state
- expose another customer's orders
- introduce a dedicated order microservice for Demo

---

# 76. Demo Implementation Boundary

The Demo implementation should use:

```text id="p6m9r4"
modules/orders
packages/db
packages/auth
packages/tenant
packages/validation
packages/event-bus
```

Interactions:

```text id="v3k8q2"
Orders
 ├── Checkout → order creation
 ├── Payments → financial state
 ├── Inventory → stock commitment/release
 ├── Customers → customer relationship
 ├── Products → historical references
 └── Discounts → historical discount information
```

Orders must interact with these domains through public interfaces or application services.

---

# 77. Demo-to-V1 Evolution

The Orders domain should support future capabilities such as:

- partial fulfillment
- returns
- exchanges
- advanced fulfillment
- multiple shipments
- warehouse routing
- carrier integrations
- subscription orders
- order editing
- advanced returns management
- marketplace orders

These capabilities should extend the existing Order model and domain boundaries rather than replacing the fundamental purchase record.

---

# 78. Acceptance Criteria

The Orders module is complete for Demo when:

- Orders can be created from successful Checkout flows.
- Order creation is idempotent.
- Every Order is store-scoped.
- Customer access is restricted to the customer's own orders.
- Merchant access is restricted to the merchant's Store.
- Order numbers are unique and immutable.
- Order items contain historical product information.
- Historical prices are immutable.
- Historical addresses are stored.
- Historical discounts are preserved.
- Order totals are immutable after creation except through explicitly defined financial operations.
- Order status transitions are validated.
- Status history is recorded.
- Invalid state transitions are rejected.
- Cancellation is supported where permitted.
- Inventory changes occur through the Inventory domain.
- Refunds occur through the Payments domain.
- Payment state is not confused with Order state.
- Notifications and external integrations do not determine order transaction success.
- Duplicate checkout/payment processing cannot create duplicate orders.
- Cross-store access is rejected.
- Integration and E2E tests cover successful and failed purchase flows.
- Historical orders remain correct after product, customer, discount, or catalog changes.   