# Order Implementation Specification

## 1. Purpose

This document defines the implementation requirements for the **Orders** domain of the Shopify-like commerce platform.

The Orders module owns the durable representation of completed purchases and the merchant-facing order lifecycle.

An Order is a historical business record. Once created, its financial, product, customer, and address information must remain stable even when the underlying Product, Customer, Discount, or Store configuration changes.

---

## 2. Scope

The Orders module owns:

- Order creation.
- Order identity and numbering.
- Order items.
- Historical product snapshots.
- Historical pricing.
- Customer association.
- Billing/shipping snapshots.
- Order totals.
- Order status.
- Fulfillment-related status where supported.
- Order status history.
- Refund-related order state coordination.
- Merchant order management.
- Order retrieval and listing.

The module does not own:

- Checkout.
- Payments.
- Inventory.
- Products.
- Customers.
- Discounts.
- Cart state.

Those domains interact with Orders through explicit public interfaces.

---

## 3. Domain Position

The primary purchase lifecycle is:

```text id="k8m3q7"
Cart
  ↓
Checkout
  ↓
Payment
  ↓
Order
  ├── Order Items
  ├── Customer Snapshot
  ├── Address Snapshots
  ├── Pricing Snapshot
  └── Status History
```

Orders represent the durable result of a successful purchase workflow.

---

## 4. Module Location

Implementation belongs under:

```text id="v6x2n9"
modules/orders/
```

Recommended structure:

```text id="m4q8c1"
modules/orders/
├── application/
├── domain/
├── infrastructure/
└── index.ts
```

---

## 5. Layer Responsibilities

### Presentation

Responsible for:

- Authentication.
- Store resolution.
- Authorization.
- Request validation.
- DTO mapping.
- HTTP responses.

### Application

Responsible for:

- Order use cases.
- Order creation orchestration.
- State transitions.
- Transaction boundaries.
- Merchant order operations.

### Domain

Responsible for:

- Order entity.
- Order Item entity.
- Status transitions.
- Money invariants.
- Historical snapshot rules.

### Infrastructure

Responsible for:

- PostgreSQL persistence.
- Repositories.
- Queries.
- Persistence mapping.

---

## 6. Order Entity

Conceptually:

```text id="r7c3m8"
Order
├── id
├── storeId
├── orderNumber
├── customerId?
├── checkoutId?
├── currency
├── subtotal
├── discountTotal
├── total
├── status
├── paymentStatus
├── fulfillmentStatus
├── createdAt
└── updatedAt
```

The exact schema may contain additional fields.

---

## 7. Order Identity

Every Order must have:

- Stable internal ID.
- Store association.
- Human-readable order number.

The internal ID should be used for internal relationships.

The order number is intended for merchant/customer-facing identification.

---

## 8. Order Number

Order numbers should be unique within the appropriate Store scope.

Example:

```text id="x5m9p2"
Store A → #1001
Store A → #1002

Store B → #1001
```

may be valid if numbering is Store-scoped.

The exact numbering strategy should be defined before implementation.

---

## 9. Order Creation

Order creation should occur only after the Checkout workflow reaches the appropriate successful state.

Typical flow:

```text id="c7n4q8"
Checkout
  ↓
Payment confirmed
  ↓
Inventory reserved
  ↓
Create Order
  ↓
Finalize inventory
  ↓
Complete Checkout
```

The exact orchestration must prevent partial purchase state.

---

## 10. Order Creation Idempotency

Order creation is a critical idempotent operation.

A retry of the same Checkout must not create multiple Orders.

A stable business reference should associate the Order with the logical Checkout/purchase operation.

Potential uniqueness:

```text id="m8x2v5"
unique(checkout_id)
```

when one Checkout can produce only one Order.

---

## 11. Order Historical Snapshot

An Order must not depend on mutable Product data.

For example:

```text id="p4q7n9"
Product name today
      ↓
"Classic Shirt"

Product name later
      ↓
"Premium Shirt"
```

The historical Order must continue showing:

```text id="z6m3c8"
"Classic Shirt"
```

if that was the purchased value.

---

## 12. Order Item

Conceptually:

```text id="k5v8x2"
OrderItem
├── id
├── orderId
├── productId?
├── variantId?
├── productName
├── variantName
├── sku
├── unitPrice
├── quantity
├── discountAmount
└── lineTotal
```

Historical snapshot fields must be stored directly on the Order Item where appropriate.

---

## 13. Product References

Order Items may retain references to Product/Variant IDs for traceability.

However, historical display and financial calculations must rely on the stored Order snapshot rather than current Product state.

---

## 14. Order Pricing

The Order stores finalized financial values.

Typical structure:

```text id="q9m4x7"
Subtotal
- Discount
+ Additional supported charges
= Total
```

The exact pricing model must remain consistent with Checkout.

---

## 15. Money Representation

All monetary values must use exact representations.

Recommended:

```text id="v3c8m2"
integer minor units
```

Never use floating-point numbers as the authoritative financial representation.

---

## 16. Currency

Every Order has one currency.

The currency must be captured at Order creation.

Changing Store currency later must not change historical Orders.

---

## 17. Discount Snapshot

If a Discount was applied, the Order should retain the relevant historical information.

Possible fields:

- Discount code.
- Discount type.
- Discount value.
- Applied discount amount.

The Order must not calculate historical discounts using the current Discount definition.

---

## 18. Customer Association

An Order may reference a Customer.

The Customer reference is useful for:

- Merchant order lookup.
- Customer order history.
- Reporting.
- Support workflows.

However, historical customer information required by the Order must be snapshotted where appropriate.

---

## 19. Customer Snapshot

The Order may preserve information such as:

- Customer name.
- Email.
- Phone.

This protects historical order records when the Customer profile changes later.

---

## 20. Address Snapshot

Shipping and billing addresses must be snapshotted.

Conceptually:

```text id="n7x4m1"
Customer Address
      ↓
Checkout
      ↓
Order Address Snapshot
```

Updating the Customer address afterward must not modify the completed Order.

---

## 21. Address Structure

Conceptually:

```text id="r2q8c5"
OrderAddress
├── name
├── line1
├── line2
├── city
├── state
├── postalCode
├── country
└── phone
```

The exact fields depend on the supported checkout geography.

---

## 22. Order Status

A practical Demo lifecycle may include:

```text id="m5c9x3"
PENDING
CONFIRMED
PROCESSING
FULFILLED
CANCELLED
COMPLETED
```

The exact statuses should be finalized according to the product workflow.

---

## 23. Payment Status

Payment state should remain conceptually separate from Order status.

Possible payment states:

```text id="q8v3n6"
PENDING
PAID
FAILED
PARTIALLY_REFUNDED
REFUNDED
```

Payments owns the authoritative payment state.

Orders may store a synchronized representation for order management and display.

---

## 24. Fulfillment Status

If the Demo supports basic fulfillment status:

```text id="x4m7p2"
UNFULFILLED
PARTIALLY_FULFILLED
FULFILLED
```

The implementation should remain deliberately simple.

Advanced warehouse/fulfillment routing is outside Demo scope.

---

## 25. Order State Transitions

Valid transitions should be explicit.

Example:

```text id="z9c4m8"
PENDING
  ↓
CONFIRMED
  ↓
PROCESSING
  ↓
FULFILLED
  ↓
COMPLETED
```

Cancellation should only be allowed from states where business rules permit it.

---

## 26. Invalid State Transitions

The implementation must reject invalid transitions.

For example:

```text id="p7m3x5"
FULFILLED → PENDING
COMPLETED → PROCESSING
CANCELLED → FULFILLED
```

unless a deliberate recovery workflow exists.

---

## 27. Order Status History

Every meaningful status transition should be recorded.

Conceptually:

```text id="k3n8q6"
OrderStatusHistory
├── orderId
├── fromStatus
├── toStatus
├── actor
├── reason?
└── createdAt
```

This provides an audit trail for merchant operations.

---

## 28. Order Cancellation

Cancellation must be an explicit application operation.

Before cancellation, the application should verify:

- Current Order state.
- Authorization.
- Payment state.
- Inventory state.
- Whether cancellation is still allowed.

Any required downstream actions should be coordinated through their owning modules.

---

## 29. Payment Interaction

Orders do not directly control payment provider operations.

Payment state is obtained through the Payments interface.

Example:

```text id="v6q2m9"
Order
  ↓
Payment Interface
  ↓
Payment
```

Refunds remain owned by Payments.

---

## 30. Refund Interaction

When an Order is refunded:

```text id="c8m4x7"
Order
   ↓
Payments refund operation
   ↓
Payment state updated
   ↓
Order refund state updated
```

Orders must not directly call a payment provider.

---

## 31. Inventory Interaction

Orders must not directly update inventory tables.

Inventory finalization should occur through the Inventory module.

Typical completion:

```text id="x7p3m5"
Payment confirmed
  ↓
Order created
  ↓
Inventory finalized
```

The exact sequence depends on Checkout orchestration.

---

## 32. Customer Interaction

Orders may retrieve Customer information through a public interface.

Orders must not directly modify Customer records.

Historical Customer snapshots remain owned by the Order representation.

---

## 33. Product Interaction

Order creation may validate Product/Variant information before storing the historical snapshot.

After creation, the Order must not depend on live Product pricing or names.

---

## 34. Discount Interaction

The Order receives finalized discount information from Checkout/Discounts.

It stores the historical result.

The Order must not recalculate Discount eligibility after creation.

---

## 35. Order Listing

Merchant order listing should support bounded pagination.

Potential filters:

- Status.
- Payment status.
- Fulfillment status.
- Customer.
- Order number.
- Created date.

Only supported filters should be exposed.

---

## 36. Order Search

The Demo may use PostgreSQL for basic order search.

A dedicated search engine is not required.

Queries should use indexed fields and bounded pagination.

---

## 37. Customer Order History

Customers should be able to retrieve their own Orders.

Access must follow:

```text id="m9q5x2"
Authenticated Customer
      ↓
Store context
      ↓
Own Orders
```

A Customer must not access another Customer's Orders.

---

## 38. Merchant Order Access

Merchant access must require:

- Correct Store.
- Appropriate Store role.
- Required order permissions.

Potential permission:

```text id="c4v8n7"
orders.read
orders.manage
orders.cancel
orders.refund
```

Actual permission names must follow the authorization model.

---

## 39. Tenant Isolation

Every Order query must include Store scope.

Example:

```text id="r6m2x9"
Store A merchant
      ↓
Store B Order
      ↓
DENIED
```

Order IDs must never be sufficient for authorization.

---

## 40. API Endpoints

Potential merchant endpoints:

```text id="q8x3m5"
GET   /api/v1/orders
GET   /api/v1/orders/{orderId}
PATCH /api/v1/orders/{orderId}
POST  /api/v1/orders/{orderId}/cancel
```

Customer endpoints may expose:

```text id="n4m7c2"
GET /api/v1/customer/orders
GET /api/v1/customer/orders/{orderId}
```

The final API structure must follow the API contract.

---

## 41. Order Response

A typical Order response may contain:

```text id="v9p3x6"
Order
├── id
├── orderNumber
├── status
├── paymentStatus
├── fulfillmentStatus
├── customer
├── items
├── pricing
├── shippingAddress
├── billingAddress
├── createdAt
└── updatedAt
```

Only authorized information should be returned.

---

## 42. Client-Supplied Order Data

The client must never be authoritative for:

- Order total.
- Payment status.
- Inventory status.
- Discount amount.
- Order status.
- Customer ownership.
- Store ownership.

All authoritative values are server-controlled.

---

## 43. Order Creation Transaction

Order creation should persist the required Order records atomically.

Potentially:

```text id="j5c8m2"
BEGIN
  ↓
Create Order
  ↓
Create Order Items
  ↓
Create address snapshots
  ↓
Create status history
  ↓
COMMIT
```

External provider calls must not occur inside this transaction.

---

## 44. Order Creation Failure

If Order creation fails, the Checkout workflow must be able to safely recover.

The implementation must not leave:

- Duplicate Orders.
- Duplicate payments.
- Permanently consumed inventory.

The recovery strategy belongs to the Checkout/Payments/Inventory orchestration.

---

## 45. Idempotency

Critical Order operations must be idempotent where retries are possible.

Important operations include:

- Order creation.
- Status transitions.
- Cancellation.
- Refund coordination.

Order creation should use a unique business reference.

---

## 46. Status Transition Concurrency

Two users may attempt to change an Order simultaneously.

The application must prevent invalid state transitions.

Example:

```text id="x8m3q7"
PROCESSING
   ├── User A → FULFILLED
   └── User B → CANCELLED
```

Only a valid transition should succeed based on the actual current state.

---

## 47. Optimistic/Transactional Protection

The implementation may use:

- Row locking.
- Conditional state updates.
- Version numbers.
- Transactional checks.

The selected strategy must ensure that stale requests cannot overwrite newer Order state.

---

## 48. Auditability

Important merchant actions should be traceable.

Examples:

- Order status changes.
- Cancellation.
- Refund initiation.
- Manual adjustments where supported.

Audit information should include:

- Actor.
- Store.
- Action.
- Timestamp.
- Relevant reference.

---

## 49. Events

Potential events:

```text id="m6q2v8"
OrderCreated
OrderConfirmed
OrderProcessing
OrderFulfilled
OrderCancelled
OrderCompleted
OrderRefunded
```

Events represent completed facts.

Critical Order state must be committed before dependent asynchronous processing.

---

## 50. Background Jobs

Potential Order jobs include:

- Notification delivery.
- Order recovery.
- Reconciliation.
- Status synchronization where required.

Jobs must be idempotent and retry-safe.

---

## 51. Notifications

Order events may trigger notifications such as:

- Order confirmation.
- Payment confirmation.
- Cancellation.
- Fulfillment.
- Refund.

Notifications belong to the Notifications domain.

Orders should emit facts rather than directly sending emails.

---

## 52. Database Constraints

Potential constraints include:

```text id="r8m4x2"
total >= 0
subtotal >= 0
discount_total >= 0
quantity > 0
unique(store_id, order_number)
unique(checkout_id)
```

where the business model supports those constraints.

Foreign keys must protect required relationships.

---

## 53. Database Indexing

Likely indexes include:

```text id="c5x9m3"
store_id
store_id + created_at
store_id + status
store_id + order_number
customer_id + created_at
checkout_id
payment reference
```

Indexes should reflect actual query patterns.

---

## 54. Historical Immutability

Once an Order is completed, the following should generally be immutable:

- Purchased product name.
- Variant name.
- SKU snapshot.
- Unit price.
- Quantity.
- Applied discount amount.
- Currency.
- Historical addresses.

Mutable operational state such as fulfillment status may continue changing.

---

## 55. Data Retention

Orders are business and potentially financial records.

Deletion should not be the default behavior.

Retention and anonymization rules should be defined separately from normal Order CRUD.

---

## 56. Error Handling

Potential stable errors include:

```text id="v7m2q8"
ORDER_NOT_FOUND
ORDER_ACCESS_DENIED
ORDER_ALREADY_CANCELLED
ORDER_CANNOT_BE_CANCELLED
INVALID_ORDER_STATUS_TRANSITION
ORDER_ALREADY_COMPLETED
ORDER_CREATION_CONFLICT
ORDER_CREATION_FAILED
ORDER_STATE_CONFLICT
REFUND_REQUIRED
```

Internal database or provider errors must not be exposed directly.

---

## 57. Testing Strategy

### Unit Tests

Test:

- Order state transitions.
- Pricing invariants.
- Cancellation rules.
- Snapshot behavior.

### Integration Tests

Test:

- PostgreSQL persistence.
- Order creation transaction.
- Unique order number.
- Checkout idempotency.
- State transition concurrency.
- Tenant isolation.

### API Tests

Test:

- Merchant authorization.
- Customer authorization.
- Order listing.
- Order retrieval.
- Status changes.
- Cancellation.
- Error contracts.

### E2E Tests

Test:

```text id="q3n8m6"
Product
  ↓
Cart
  ↓
Checkout
  ↓
Payment
  ↓
Order
  ↓
Merchant Order Management
```

---

## 58. Critical Test Cases

```text id="p6x2m9"
[ ] Order belongs to correct Store
[ ] Cross-tenant access is denied
[ ] Customer can access only own Orders
[ ] Merchant permissions are enforced
[ ] Order creation is idempotent
[ ] Duplicate Checkout cannot create duplicate Order
[ ] Order Items preserve historical product data
[ ] Product changes do not alter historical Order data
[ ] Customer address changes do not alter historical Order address
[ ] Discount changes do not alter historical Order discount
[ ] Order totals are immutable after completion
[ ] Invalid state transitions are rejected
[ ] Concurrent state updates are safe
[ ] Cancellation rules are enforced
[ ] Payment state is not client-controlled
[ ] Inventory state is not directly manipulated
[ ] Refund coordination is safe
[ ] Status history is recorded
```

---

## 59. Implementation Sequence

Recommended implementation order:

```text id="z4m8q3"
1. Define Order domain model
2. Define Order Item model
3. Define historical snapshots
4. Define Order state machine
5. Define payment/fulfillment status model
6. Define database schema
7. Create migrations
8. Implement repositories
9. Implement Order creation service
10. Implement snapshot generation
11. Implement status transition service
12. Implement authorization
13. Implement Order APIs
14. Integrate with Checkout
15. Integrate with Payments
16. Integrate with Inventory
17. Integrate with Customers
18. Implement events
19. Implement recovery jobs where required
20. Add idempotency
21. Add unit tests
22. Add integration tests
23. Add concurrency tests
24. Add API tests
25. Add E2E purchase/order tests
```

---

## 60. Demo Simplifications

The Demo intentionally does not require:

- Advanced fulfillment networks.
- Multi-warehouse routing.
- Shipping carrier integrations.
- Complex tax engines.
- Partial fulfillment workflows.
- Split shipments.
- Subscription orders.
- B2B purchase orders.
- Advanced returns management.
- Advanced order analytics.
- Distributed order processing.

The Demo must still produce durable, historically correct Orders from real Checkout and Payment flows.

---

## 61. V1 Evolution

The Orders module can later support:

- Advanced fulfillment.
- Returns.
- Exchanges.
- Partial fulfillment.
- Shipment tracking.
- Multiple warehouses.
- Tax breakdowns.
- Shipping charges.
- B2B orders.
- Subscription orders.
- Advanced order search.
- Order analytics.
- External ERP/fulfillment integrations.

These capabilities should extend the existing Order domain rather than bypass it.

---

## 62. Definition of Done

The Orders implementation is complete when:

```text id="m7c4x9"
[ ] Order entity exists
[ ] Order Item entity exists
[ ] Store ownership is enforced
[ ] Order numbering exists
[ ] Order creation is idempotent
[ ] Historical product snapshots exist
[ ] Historical pricing exists
[ ] Historical discount data exists
[ ] Customer association exists
[ ] Customer snapshots exist where required
[ ] Shipping address snapshot exists
[ ] Billing address snapshot exists
[ ] Exact money representation is used
[ ] Currency is preserved
[ ] Order lifecycle exists
[ ] Payment status is represented appropriately
[ ] Fulfillment status exists where required
[ ] Status history exists
[ ] Concurrent state transitions are safe
[ ] Cancellation is implemented
[ ] Payment integration exists
[ ] Inventory integration exists
[ ] Checkout integration exists
[ ] Tenant isolation is enforced
[ ] Authorization is enforced
[ ] Database constraints exist
[ ] Appropriate indexes exist
[ ] APIs are implemented
[ ] Events are implemented where required
[ ] Recovery behavior is defined
[ ] Unit tests exist
[ ] Integration tests exist
[ ] Concurrency tests exist
[ ] API tests exist
[ ] E2E order flow exists
[ ] Documentation matches implementation
```