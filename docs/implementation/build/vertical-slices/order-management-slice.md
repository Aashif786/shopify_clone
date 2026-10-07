# Order Management Vertical Slice Build Implementation

## 1. Purpose

This document defines the implementation of the Order Management vertical slice for the Demo.

The slice connects completed Checkout purchases to the merchant-facing order management workflow.

The core flow is:

```text
Completed Checkout
      ↓
Order Created
      ↓
Order Persisted
      ↓
Merchant Views Orders
      ↓
Merchant Opens Order
      ↓
Merchant Updates Order Status
      ↓
Customer Sees Updated Status
```

Orders are durable business records. Once created, historical purchase information must remain stable even when related Product, Customer, or Store data changes.

---

# 2. Slice Objective

The completed slice must support:

- Creating an Order from a successful Checkout.
- Preventing duplicate Orders.
- Persisting immutable purchase information.
- Storing Order items and historical snapshots.
- Storing billing/shipping address snapshots where applicable.
- Generating unique Order numbers.
- Maintaining Order status history.
- Merchant Order listing.
- Merchant Order detail.
- Authorized Order status transitions.
- Customer Order visibility.
- Order totals and payment information.
- Safe retry behavior.
- Tenant isolation.
- Auditability.

---

# 3. Dependencies

This slice depends on:

```text
Database
Authentication
Tenant context
Authorization
Stores
Customers
Products
Inventory
Checkout
Payments
API
Validation/errors
Observability
Jobs
Notifications
```

The Order domain remains the authoritative owner of the completed purchase record.

---

# 4. Order Ownership

Orders owns:

```text
Order
Order Item
Order number
Historical product/item snapshots
Historical customer/address snapshots
Order totals
Order status
Order status history
Order queries
Order creation from approved Checkout completion
```

Orders does not own:

```text
Product catalog
Inventory quantity
Payment provider behavior
Customer profile
Cart lifecycle
Checkout pricing rules
```

Those responsibilities remain in their respective domains.

---

# 5. Order Creation Boundary

An Order must only be created through the approved Checkout completion workflow.

The frontend must never be able to arbitrarily request:

```text
Create Order
```

with a client-supplied total.

The valid flow is:

```text
Checkout
   ↓
Payment confirmation
   ↓
Checkout completion
   ↓
Orders.createFromCheckout()
```

---

# 6. Order Creation Preconditions

Before creating the Order, verify:

```text
Checkout exists
Checkout belongs to Store
Checkout is completable
Payment is in an acceptable state
Inventory reservation is valid
Required customer/order information exists
Order does not already exist for the Checkout
```

If any critical precondition fails, Order creation must not proceed.

---

# 7. Exactly-Once Order Creation

Order creation must be safe under:

```text
Customer retry
Payment webhook
Worker retry
Request timeout
Concurrent completion
```

The database must enforce the logical uniqueness of the Checkout-to-Order relationship.

Application-level idempotency must complement the database constraint.

---

# 8. Order Number

Every Order should receive a human-readable Order number.

The Order number must:

- Be unique within the required scope.
- Be generated server-side.
- Never depend on client input.
- Remain immutable after creation.

The internal primary key and public Order number should be treated as separate identifiers.

---

# 9. Order Items

Each Order stores the purchased items.

An Order Item should preserve information required to understand what was purchased, including where applicable:

```text
Product identity
Variant identity
Product name
Variant name
SKU
Quantity
Unit price
Line total
Discount allocation
```

The exact fields follow the approved Order schema.

---

# 10. Historical Snapshot Principle

Order data must remain meaningful even if:

```text
Product is renamed
Variant is deleted
SKU changes
Price changes
Customer changes their name
Customer changes their address
Product is unpublished
```

Therefore, required historical values must be copied into Order-owned snapshots at purchase time.

---

# 11. Product Relationship

Order Items may retain references to the original Product/Variant where useful.

However, historical display must not depend exclusively on the current Product record.

For example:

```text
Current Product Name
```

must not replace:

```text
Purchased Product Name
```

in historical Order data.

---

# 12. Customer Relationship

Orders may reference the Customer associated with the purchase.

However, the Order must preserve the historical information required for the completed transaction.

Changing the Customer profile later must not rewrite the completed Order.

---

# 13. Address Snapshot

Where an Order contains billing or shipping information, store an immutable snapshot.

Example:

```text
Customer Address at purchase
        ↓
Order Address Snapshot
```

Later changes to the Customer's address must not modify the Order.

---

# 14. Money

All Order monetary values must use the approved exact representation.

Never use floating point for:

```text
Unit price
Subtotal
Discount
Shipping amount where supported
Tax where supported
Total
Refund amount
```

---

# 15. Order Totals

Order totals must be persisted as historical purchase facts.

Typical values include:

```text
Subtotal
Discount total
Shipping total where applicable
Tax total where applicable
Grand total
Currency
```

The exact Demo-supported fields follow the Order specification.

---

# 16. Order Status

The Order must use an explicit state machine.

Typical Demo states may include:

```text
PENDING
CONFIRMED
PROCESSING
COMPLETED
CANCELLED
```

The exact approved states must be used rather than inventing additional lifecycle states during implementation.

---

# 17. Payment Status

Payment status must remain conceptually separate from Order status.

For example:

```text
Order Status       → PROCESSING
Payment Status     → SUCCEEDED
```

Do not overload one status field with unrelated concepts.

Payments remains the owner of payment state.

---

# 18. Fulfillment Status

If the Demo tracks fulfillment, keep it separate from Order and Payment status.

Example:

```text
Order      → CONFIRMED
Payment    → SUCCEEDED
Fulfillment → UNFULFILLED
```

Do not create a complex fulfillment platform unless required by the Demo scope.

---

# 19. Status History

Every meaningful Order status transition should create a history record.

The history should capture:

```text
Previous status
New status
Timestamp
Actor where applicable
Reason where applicable
```

This provides an audit trail for merchant actions and system transitions.

---

# 20. Status Transition Rules

A status transition must be validated server-side.

Do not allow:

```text
PATCH /orders/:id
{
  "status": "whatever"
}
```

without checking whether the transition is valid.

The Order domain owns transition rules.

---

# 21. Merchant Order Listing

Authorized merchant users should be able to view Orders belonging to their Store.

The listing should support:

```text
Pagination
Stable ordering
Status filtering
Search by approved identifiers
Date filtering where required
```

Do not implement a dedicated search engine for the Demo.

---

# 22. Pagination

Order listing endpoints must use the approved pagination strategy.

Pagination must provide stable results under normal concurrent creation of Orders.

Avoid loading the entire Order table into memory.

---

# 23. Merchant Order Detail

An authorized merchant may open an individual Order.

The response should provide:

```text
Order number
Order status
Payment status
Customer information appropriate for merchant access
Order items
Historical prices
Historical quantities
Historical addresses where applicable
Totals
Status history
Created timestamp
Updated timestamp
```

Sensitive internal information must not be exposed unnecessarily.

---

# 24. Customer Order Access

Customers may view Orders that belong to their Store/customer context.

A customer must not be able to retrieve another customer's Order by changing:

```text
orderId
```

in the request.

---

# 25. Tenant Isolation

Every Order query must enforce Store ownership.

Conceptually:

```text
Current Store
    ↓
Order belongs to Current Store
    ↓
Access allowed
```

Cross-tenant Order access must fail safely.

---

# 26. Authorization

Merchant access must respect Store membership and role permissions.

Typical access:

| Operation | Owner | Admin | Staff | Customer |
|---|---:|---:|---:|---:|
| List Orders | Yes | Yes | According to permission | Own only |
| View Order | Yes | Yes | According to permission | Own only |
| Update Order status | Yes | Yes | According to permission | No |
| Cancel Order | Yes | Yes | According to permission | No |
| Refund | Through approved Payments flow | Through approved Payments flow | According to permission | No |

Authorization must always be enforced server-side.

---

# 27. Order Cancellation

Cancellation must be state-aware.

Before cancellation:

```text
Current Order status
Payment status
Fulfillment state
```

must be evaluated.

Cancellation must not silently alter payment or inventory state.

Those changes must occur through the owning domain workflows.

---

# 28. Refund Integration

Refunds belong to Payments.

The Order Management layer may initiate an approved refund workflow, but must not implement provider-specific refund logic.

The flow is:

```text
Merchant
   ↓
Order Management
   ↓
Payments refund operation
   ↓
Payment state
```

The Order should reflect the appropriate resulting state without becoming the owner of payment logic.

---

# 29. Inventory Integration

Order cancellation or fulfillment changes may require Inventory operations.

Orders should call the Inventory public interface rather than directly modifying inventory tables.

---

# 30. Customer Data Integration

Order Management may display customer information through the approved Customers interface.

Historical purchase information must still come from Order snapshots.

Do not dynamically rewrite historical Order details from current Customer data.

---

# 31. API Endpoints

The slice may expose merchant endpoints such as:

```text
GET   /api/v1/stores/:storeId/orders
GET   /api/v1/stores/:storeId/orders/:orderId
PATCH /api/v1/stores/:storeId/orders/:orderId/status
POST  /api/v1/stores/:storeId/orders/:orderId/cancel
```

Customer-facing endpoints may include:

```text
GET /api/v1/storefront/orders
GET /api/v1/storefront/orders/:orderId
```

Exact routes must follow the approved API architecture and specifications.

---

# 32. DTOs

Use explicit DTOs.

Examples:

```text
OrderSummaryDTO
OrderDetailsDTO
OrderItemDTO
OrderStatusHistoryDTO
UpdateOrderStatusRequest
```

Do not serialize database models directly.

---

# 33. Filtering

Supported Demo filters may include:

```text
Status
Date range
Order number
Customer identifier where appropriate
```

Filters must be validated and scoped to the current Store.

---

# 34. Sorting

Use deterministic ordering.

A typical default ordering is:

```text
createdAt DESC
```

with a stable tie-breaker such as the internal identifier.

---

# 35. API Error Handling

Potential errors include:

```text
ORDER_NOT_FOUND
ORDER_ACCESS_DENIED
INVALID_ORDER_STATUS_TRANSITION
ORDER_NOT_CANCELLABLE
ORDER_ALREADY_CANCELLED
ORDER_ALREADY_COMPLETED
PAYMENT_OPERATION_REQUIRED
REFUND_NOT_ALLOWED
```

Use the shared application error taxonomy.

---

# 36. Idempotency

Critical Order mutations must be safe under retries.

Examples:

```text
Create Order
Cancel Order
Refund initiation
Status transition
```

Where the operation supports idempotency, use the shared `Idempotency-Key` mechanism.

---

# 37. Status Transition Concurrency

Two merchant requests may attempt to update the same Order simultaneously.

For example:

```text
Admin A → PROCESSING
Admin B → CANCELLED
```

The implementation must prevent invalid final state caused by stale reads.

Use appropriate row locking or optimistic conflict detection according to the approved architecture.

---

# 38. Historical Immutability

The following should not be silently modified after Order creation:

```text
Purchased product name
Purchased SKU
Unit price
Quantity
Discount allocation
Order total
Historical address
Historical customer purchase information
```

Corrections, if ever required, should use explicit controlled operations rather than ordinary update endpoints.

---

# 39. Order Events

The Orders domain may emit events such as:

```text
OrderCreated
OrderStatusChanged
OrderCancelled
OrderCompleted
```

Events represent facts that already occurred.

They should not become an alternate database of record.

---

# 40. Notifications

Order events may trigger:

```text
Order confirmation
Status update
Cancellation notification
```

through the Notifications integration.

Notification delivery must remain asynchronous.

An email failure must not roll back the Order.

---

# 41. Jobs

Background jobs may handle:

```text
Order notification
Cleanup
Reconciliation
Deferred workflows
```

Job handlers must be idempotent.

Do not move core Order state transitions into an asynchronous job when the business operation requires immediate transactional correctness.

---

# 42. Observability

Order operations should include structured context:

```text
requestId
storeId
orderId
orderNumber
customerId where appropriate
actorId where appropriate
operation
result
duration
```

Do not log:

```text
Passwords
Session secrets
Payment credentials
Sensitive provider secrets
```

---

# 43. Database Integrity

The database should enforce important Order invariants.

Examples:

```text
Unique Order number
Valid foreign keys
Valid status values where appropriate
Unique Checkout-to-Order relationship
Non-negative quantities
Valid monetary representation
```

Application validation is required, but database constraints provide defense in depth.

---

# 44. Order Creation Transaction

The Order creation workflow must use an appropriate application transaction.

The transaction should:

```text
Verify completion state
↓
Create Order
↓
Create Order Items
↓
Create snapshots
↓
Create status history
↓
Persist required local state
↓
Commit
```

External network calls must not be performed inside the long-running database transaction.

---

# 45. Order Number Generation

Order number generation must remain safe under concurrency.

Two simultaneous purchases must never receive the same public Order number.

Use a database-backed or transaction-safe generation strategy.

Do not generate numbers solely in application memory.

---

# 46. Customer Order Query

Customer-facing Order queries must be constrained by trusted identity.

The server should derive:

```text
Customer ID
Store ID
```

from authenticated/session context rather than accepting arbitrary ownership values from the browser.

---

# 47. Merchant Order Query

Merchant queries must derive Store access from:

```text
Authenticated User
+
Membership
+
Authorization
+
Store context
```

Never trust a client-provided Store ID without verifying membership.

---

# 48. Security Tests

Mandatory tests include:

```text
[ ] Customer cannot access another customer's Order
[ ] Merchant cannot access another Store's Order
[ ] Staff cannot perform unauthorized mutation
[ ] Client cannot create arbitrary Order
[ ] Client cannot modify historical totals
[ ] Client cannot modify payment state
[ ] Order number cannot be spoofed
[ ] Cancel endpoint validates authorization
[ ] Refund path cannot bypass Payments
```

---

# 49. Integration Tests

Test:

```text
Checkout
   ↓
Order creation
```

and:

```text
Order
   ↓
Payment information
```

and:

```text
Order cancellation
   ↓
Payments/Inventory workflows
```

through approved application interfaces.

---

# 50. Critical Duplicate Test

Execute:

```text
Complete Checkout
Complete Checkout again
Process same webhook
Retry worker
```

Verify:

```text
One Checkout
One successful payment
One Order
One set of Order Items
```

No duplicate historical purchase should be created.

---

# 51. Historical Integrity Test

Create an Order.

Then modify:

```text
Product name
Product price
SKU
Customer name
Customer address
```

Verify the completed Order still displays the original purchase information.

---

# 52. Status Transition Test

Test valid transitions and invalid transitions.

For example:

```text
CONFIRMED → PROCESSING
```

may be valid.

An arbitrary transition such as:

```text
COMPLETED → PENDING
```

must be rejected unless explicitly defined by the state machine.

---

# 53. Concurrent Transition Test

Execute two simultaneous status changes against the same Order.

Verify that:

```text
No invalid state
No lost update
No duplicate history
```

is produced.

---

# 54. End-to-End Merchant Flow

The browser-level merchant test should execute:

```text
Merchant logs in
   ↓
Opens Store
   ↓
Opens Orders
   ↓
Views Order list
   ↓
Opens Order
   ↓
Reviews items/totals/customer information
   ↓
Updates Order status
   ↓
Refreshes page
   ↓
Updated state persists
```

---

# 55. End-to-End Customer Flow

The customer flow should verify:

```text
Customer purchases Product
   ↓
Order confirmation
   ↓
Customer opens Orders
   ↓
Customer sees own Order
   ↓
Customer opens Order detail
   ↓
Historical purchase information is correct
```

---

# 56. Implementation Order

Implement the slice in this order:

```text
1. Verify Checkout completion contract
2. Verify Payments completion contract
3. Implement Order schema/repository
4. Implement Order creation service
5. Implement historical snapshots
6. Implement Order number generation
7. Implement status state machine
8. Implement status history
9. Implement merchant Order queries
10. Implement customer Order queries
11. Implement authorization
12. Implement status mutation APIs
13. Implement cancellation workflow
14. Integrate Payments refund workflow where required
15. Integrate Inventory where required
16. Implement Order events
17. Integrate Notifications
18. Add observability
19. Add unit tests
20. Add integration tests
21. Add security/concurrency/idempotency tests
22. Add merchant E2E flow
23. Add customer E2E flow
```

---

# 57. AI Implementation Rules

AI agents implementing this slice must:

1. Read the actual root `AGENTS.md`.
2. Read Orders, Checkout, Payments, Inventory, Customers, Stores, API, Database, Security, and Notifications specifications.
3. Never create Orders directly from client-submitted totals.
4. Preserve historical Order snapshots.
5. Never directly manipulate another module's internal tables.
6. Keep Payment logic inside Payments.
7. Keep Inventory logic inside Inventory.
8. Enforce Store and customer authorization server-side.
9. Protect Order creation with idempotency and database constraints.
10. Never silently rewrite historical purchase information.
11. Keep status transitions explicit.
12. Do not introduce advanced fulfillment or enterprise Order-management infrastructure outside Demo scope.

---

# 58. Definition of Done

The Order Management slice is complete when:

```text
[ ] Successful Checkout creates exactly one Order
[ ] Duplicate completion cannot create another Order
[ ] Order number is unique
[ ] Order Items are persisted
[ ] Historical Product information is preserved
[ ] Historical Customer/address information is preserved
[ ] Exact monetary values are persisted
[ ] Order status state machine works
[ ] Status history is persisted
[ ] Merchant Order listing works
[ ] Merchant Order detail works
[ ] Customer Order listing works
[ ] Customer Order detail works
[ ] Authorization works
[ ] Tenant isolation works
[ ] Cancellation follows valid transitions
[ ] Payment/refund integration uses Payments
[ ] Inventory integration uses Inventory
[ ] Notifications are asynchronous
[ ] Duplicate webhook/retry scenarios are safe
[ ] Concurrent status changes are safe
[ ] Historical data remains immutable
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Security tests pass
[ ] Concurrency tests pass
[ ] Merchant E2E flow passes
[ ] Customer E2E flow passes
[ ] TypeScript passes
[ ] Lint passes
```

---

# 59. Slice Completion Gate

The slice must demonstrate:

```text
Successful Payment
       ↓
Checkout Completion
       ↓
Exactly One Order
       ↓
Immutable Historical Purchase
       ↓
Merchant Can Manage Order
       ↓
Customer Can View Own Order
```

The Order must remain correct when:

```text
Product data changes
Customer data changes
Payment webhooks repeat
Requests retry
Workers retry
Multiple merchants act concurrently
```

The completed slice establishes the Order as the durable historical record of the customer's purchase while preserving strict ownership of payment, inventory, customer, and catalog behavior within their respective domains.