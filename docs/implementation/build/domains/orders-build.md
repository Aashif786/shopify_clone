# Orders Domain Build Implementation

## 1. Purpose

This document defines the concrete implementation approach for the Orders domain in the Demo.

An Order is the durable record of a completed purchase. Unlike Cart and Checkout data, which represent temporary customer intent and purchase processing, the Order represents what the platform has accepted as a completed commerce transaction.

Orders must preserve historical accuracy even when Products, Customers, Discounts, or Store configuration later changes.

---

# 2. Domain Ownership

The Orders module owns:

- Order identity.
- Order numbering.
- Order lifecycle.
- Order items.
- Historical product/item snapshots.
- Historical pricing.
- Historical customer/order information required by the purchase.
- Order addresses.
- Order status.
- Order status history.
- Merchant order management.
- Order queries.
- Order creation from a completed checkout.

It does not own:

- Product catalog.
- Inventory quantities.
- Customer profiles.
- Cart state.
- Checkout orchestration.
- Payment-provider integration.
- Discount calculation.

---

# 3. Module Location

Implementation belongs under:

```text id="v7r4m8"
modules/orders/
```

Recommended structure:

```text id="m5q8r4"
modules/orders/
├── domain/
├── application/
├── infrastructure/
└── index.ts
```

The exact internal structure should follow established repository conventions.

---

# 4. Order as Historical Record

The fundamental rule is:

> An Order must remain understandable without depending on mutable current catalog or customer data.

For example, changing:

```text id="x6m4r7"
Product title
Product price
Customer name
Customer address
Discount configuration
```

must not rewrite historical Order information.

---

# 5. Order Identity

An Order should have:

```text id="q8r5m4"
internal order ID
store ID
order number
createdAt
updatedAt
```

The internal ID provides stable technical identity.

The order number provides a merchant/customer-facing identifier.

---

# 6. Order Number

Order numbers should be generated server-side.

Clients must never choose arbitrary order numbers.

The numbering strategy must ensure the required uniqueness and readability properties.

---

# 7. Order Creation Source

Orders should be created through the approved Checkout completion workflow.

Conceptually:

```text id="v5m8r6"
Checkout
    ↓
Validated purchase
    ↓
Payment state confirmed
    ↓
Inventory finalized/reserved according to workflow
    ↓
Orders.createFromCheckout()
    ↓
Order
```

Direct public Order creation must not bypass purchase validation.

---

# 8. Order Creation Idempotency

Order creation must be idempotent.

A retry of the same completed checkout must not create:

```text id="m7q4r8"
two Orders
```

for the same logical purchase.

A unique relationship to the source Checkout/purchase identity should protect against duplication.

---

# 9. Order Status

The Order lifecycle must follow the approved state machine.

Typical statuses may include:

```text id="x4r7m5"
PENDING
CONFIRMED
PROCESSING
FULFILLED
CANCELLED
```

The exact state set remains authoritative.

---

# 10. Payment vs Order Status

Payment state and Order state must remain separate.

For example:

```text id="q6m8r4"
Payment
→ SUCCEEDED

Order
→ PROCESSING
```

A successful payment does not automatically imply that fulfillment is complete.

---

# 11. Status Transitions

Order status changes must use explicit domain/application operations.

Examples:

```text id="v8m4r6"
confirmOrder()
startProcessing()
fulfillOrder()
cancelOrder()
```

Invalid transitions must be rejected.

---

# 12. Status History

Important Order status transitions should be recorded in a history table or equivalent immutable record.

History should capture:

```text id="m5r7q8"
order
previous status
new status
timestamp
actor/context where appropriate
reason where appropriate
```

---

# 13. Historical Immutability

Once an Order is completed, historical purchase facts must not be silently rewritten.

This includes:

```text id="x7r4m6"
Purchased item
Quantity
Unit price
Currency
Discount amount
Order address
Customer snapshot
```

Administrative corrections should follow explicit correction mechanisms rather than arbitrary mutation.

---

# 14. Order Items

An Order Item represents a purchased product variant.

Typical information includes:

```text id="q5m8r4"
id
orderId
variantId where retained
product information snapshot
SKU snapshot
quantity
unit price
line total
```

The exact fields follow the database specification.

---

# 15. Product Snapshot

Order Items should preserve the product information required to understand the purchase.

For example:

```text id="v6r4m8"
product title
variant title/identity where applicable
SKU
```

The exact snapshot should be intentionally limited to required historical information.

---

# 16. Price Snapshot

The Order must preserve the exact price charged.

It must not calculate historical totals from the current Product price.

Conceptually:

```text id="m8q4r6"
Checkout price
    ↓
Order Item price snapshot
```

---

# 17. Quantity

Order Item quantity must be a valid positive integer within the supported limits.

Once the Order is completed, the purchased quantity must not be silently modified.

---

# 18. Line Totals

Line totals must use exact monetary arithmetic.

For example:

```text id="x5r7m4"
unit price × quantity
```

must use the approved money representation.

The implementation must not use floating-point arithmetic.

---

# 19. Order Totals

The Order should preserve the financial totals required to explain the completed purchase.

Depending on Demo scope:

```text id="q7m4r8"
subtotal
discount
total
currency
```

may be persisted.

The exact calculation model follows Checkout and the database specification.

---

# 20. Discount Snapshot

If a Discount was applied, the Order should preserve the information required to explain the applied discount.

For example:

```text id="v8m4r6"
discount code
discount amount
```

The Order must not depend on the current Discount configuration to display historical pricing.

---

# 21. Customer Relationship

An Order may reference the current Customer identity.

However, historical customer information required for the Order should also be captured as a snapshot where appropriate.

This prevents later Customer changes from rewriting the historical purchase record.

---

# 22. Address Snapshot

The Order must store the relevant purchase address as an immutable snapshot.

Conceptually:

```text id="m6r5q8"
Customer Address
      ↓
Checkout
      ↓
Order Address Snapshot
```

Changing the customer's current address must not change the Order.

---

# 23. Order Creation Transaction

Order creation should use a transaction when multiple records must be created together.

For example:

```text id="x4r8m7"
Order
+
Order Items
+
Order Address Snapshot
+
Status History
```

must not partially commit.

---

# 24. Checkout Relationship

Orders should retain the relationship to the originating Checkout where required.

This helps with:

```text id="q5m7r4"
Idempotency
Traceability
Payment reconciliation
Support/debugging
```

The relationship must be unique where required to prevent duplicate Orders.

---

# 25. Payment Relationship

Orders should reference the relevant Payment according to the approved schema.

The Order must not implement payment-provider behavior.

Payments remains responsible for payment state.

---

# 26. Inventory Relationship

Orders may retain references necessary to understand purchased inventory items.

However, Orders must not directly mutate inventory.

Inventory finalization is handled through the approved Checkout/Inventory workflow.

---

# 27. Order Creation Preconditions

Before creating an Order, the application must verify the conditions defined by the Checkout workflow.

At minimum:

```text id="v7m4r6"
Checkout is eligible for completion
Payment is in an acceptable state
Required inventory transition succeeded
Pricing is authoritative
Required customer/order data is available
```

---

# 28. Failed Order Creation

If Order creation fails after payment has reached a potentially successful state, the system must not simply discard the problem.

The failure must be:

```text id="m8q4r5"
Durably observable
Retryable where safe
Recoverable through reconciliation where required
```

The payment must not be charged again during recovery.

---

# 29. Order Completion

An Order should become confirmed/completed according to the approved workflow only after required purchase conditions are satisfied.

Do not expose an Order as successfully completed while its required critical state is still unknown.

---

# 30. Merchant Order Queries

Merchant order management may support:

```text id="x6r4m8"
List orders
Get order
Filter by status
Filter by date
Search by order number
View order details
```

Queries must remain Store-scoped.

---

# 31. Customer Order Queries

Customers should be able to view only their own permitted Orders.

The server must resolve customer ownership from trusted authentication context.

A customer must not gain access to another customer's Order by modifying an order ID.

---

# 32. Pagination

Order listing must use bounded pagination.

The implementation should define:

```text id="q7m5r4"
default page size
maximum page size
ordering
cursor/offset behavior
```

Unbounded Order queries must not be exposed.

---

# 33. Filtering

Supported filters may include:

```text id="v5r8m6"
status
createdAt range
order number
customer where permitted
```

Only approved filters should be exposed.

Do not construct arbitrary SQL from client-supplied filter strings.

---

# 34. Sorting

Sorting must use an explicit allowlist.

Examples:

```text id="m4q8r7"
createdAt
updatedAt
order number
```

The implementation must prevent arbitrary column selection.

---

# 35. Order Detail DTO

Order responses should expose explicit DTOs.

For example:

```text id="x8r4m5"
OrderSummaryDTO
OrderDetailsDTO
OrderItemDTO
OrderStatusHistoryDTO
```

Do not serialize database entities directly.

---

# 36. Merchant Order Management

Merchant operations may include:

```text id="q6m5r8"
View order
Change permitted status
Cancel where permitted
```

Each operation requires explicit Store authorization and permission checks.

---

# 37. Cancellation

Order cancellation must follow the approved state machine.

Cancellation may require coordination with:

```text id="v7r4m6"
Payments
Inventory
```

The Orders domain owns the Order state transition but does not directly manipulate those modules' internal persistence.

---

# 38. Refund Relationship

A refund belongs to Payments.

Orders may display refund state or references where appropriate.

Orders must not implement refund-provider operations.

---

# 39. Inventory Restoration

Order cancellation or refund does not automatically imply inventory restoration.

If restocking is supported, the appropriate workflow must explicitly invoke Inventory.

---

# 40. Events

The Orders module may emit facts such as:

```text id="m5q8r4"
OrderCreated
OrderConfirmed
OrderProcessingStarted
OrderFulfilled
OrderCancelled
```

Events must only be emitted after successful local state transitions.

---

# 41. Event Consumers

Consumers may include:

```text id="x4r7m8"
Notifications
Analytics later
Inventory workflow
Customer communication
```

The Demo should keep consumers limited to actual requirements.

---

# 42. Notifications

Orders may trigger notification events.

The Notifications system owns delivery.

Orders must not contain:

```text id="q8m5r4"
SMTP code
Email provider SDK calls
Template rendering infrastructure
```

inside the domain.

---

# 43. Authorization

Merchant order access requires:

```text id="v6r4m8"
Authenticated user
+
Store membership
+
Required permission
```

Customer access requires ownership of the Order through trusted customer context.

---

# 44. Tenant Isolation

Every Order belongs to one Store.

The implementation must prevent:

```text id="m7q4r8"
Store A merchant
    ↓
Store B order
```

from succeeding.

This applies to:

- Reads.
- Updates.
- Status transitions.
- Cancellation.
- Exports if later added.

---

# 45. Database Constraints

The database should enforce:

```text id="x5r8m4"
Order → Store foreign key
Order → Checkout relationship
Order → Payment relationship where required
Order Item → Order
Order Item relationships
Unique order number where required
Unique completed Checkout → Order relationship
```

Historical fields should be stored in the appropriate snapshot structures.

---

# 46. Concurrency

Order operations may race with:

```text id="q7m4r6"
Checkout completion
Payment webhook
Order status update
Cancellation
Refund
```

The implementation must define valid transition behavior.

Invalid concurrent transitions must not produce contradictory final state.

---

# 47. Status Transition Concurrency

For example:

```text id="v8m4r5"
Admin A → CONFIRMED → PROCESSING
Admin B → CONFIRMED → CANCELLED
```

The system must use transaction/state validation so that only permitted transitions succeed.

---

# 48. Idempotency

Order creation is idempotent through its relationship with Checkout/purchase identity.

Other retry-sensitive Order operations should define their own idempotency requirements.

Do not blindly apply one generic behavior to every status update.

---

# 49. Error Handling

Use centralized stable error codes.

Examples:

```text id="m6r5q8"
ORDER_NOT_FOUND
ORDER_ACCESS_DENIED
ORDER_STATUS_CONFLICT
INVALID_ORDER_TRANSITION
ORDER_ALREADY_CANCELLED
ORDER_ALREADY_COMPLETED
DUPLICATE_ORDER
```

Exact codes follow the shared error contract.

---

# 50. Historical Data Protection

The API must prevent clients from changing historical fields such as:

```text id="x4r7m6"
original price
quantity
currency
order address
historical product name
discount amount
payment amount
```

Administrative APIs must expose only explicitly supported mutable fields.

---

# 51. Testing Strategy

### Unit Tests

Test:

```text id="q5m8r4"
Order state machine
Order creation rules
Status transitions
Historical snapshot rules
Total validation
```

### Integration Tests

Test:

```text id="v7r4m6"
Order creation
Checkout uniqueness
Payment relationship
Order items
Snapshots
Database constraints
Tenant isolation
```

### API Tests

Test:

```text id="m8q4r5"
Merchant access
Customer access
Authorization
Pagination
Filtering
DTOs
Error mapping
```

---

# 52. Critical Order Tests

Mandatory scenarios include:

```text id="x6r5m8"
Checkout completion retry
Duplicate order creation
Payment success followed by retry
Payment webhook followed by retry
Concurrent status transitions
Concurrent cancellation
Order creation transaction failure
Historical data immutability
```

---

# 53. Security Tests

At minimum verify:

```text id="q8m4r6"
[ ] Store A cannot access Store B orders
[ ] Customer A cannot access Customer B orders
[ ] Client cannot alter historical purchase data
[ ] Client cannot force an invalid status transition
[ ] Unauthorized users cannot cancel orders
[ ] Payment data is not unnecessarily exposed
[ ] Sensitive customer data is not logged
```

---

# 54. Verification Scenario

The minimum successful Order flow is:

```text id="v5r8m4"
Customer completes Checkout
      ↓
Payment reaches valid completed state
      ↓
Inventory transition succeeds
      ↓
Order created exactly once
      ↓
Order items/snapshots persisted
      ↓
Order status becomes valid
      ↓
Customer can view Order
      ↓
Merchant can manage Order
```

Then verify:

```text id="m7q4r8"
Product price changes
Customer address changes
Discount configuration changes
```

without changing historical Order information.

---

# 55. Implementation Order

Implement Orders in this order:

```text id="x4r8m6"
1. Database schema and constraints
2. Order domain model
3. Order item model
4. Snapshot model
5. Status state machine
6. Repository interfaces
7. Persistence implementation
8. Order creation from Checkout
9. Idempotency/uniqueness protection
10. Status transitions
11. Merchant queries
12. Customer queries
13. Cancellation workflow
14. Events
15. Notification integration
16. API DTOs and handlers
17. Unit tests
18. Integration tests
19. Concurrency/security tests
20. End-to-end purchase verification
```

---

# 56. AI Implementation Rules

AI agents implementing Orders must:

1. Read the actual root `AGENTS.md`.
2. Read Orders, Checkout, Payments, Inventory, Customers, Database, and API specifications.
3. Treat Orders as historical records.
4. Never calculate historical values from current Product data.
5. Never modify Inventory or Payments directly.
6. Preserve Checkout-to-Order idempotency.
7. Preserve immutable snapshots.
8. Protect Store and Customer access.
9. Add concurrent state-transition tests.
10. Avoid unrelated changes.
11. Review the complete purchase lifecycle before finalizing.

---

# 57. Definition of Done

Orders implementation is complete when:

```text id="v6m4r8"
[ ] Orders are created from valid Checkout completion
[ ] Duplicate Orders are prevented
[ ] Order numbers are generated safely
[ ] Order items are persisted
[ ] Historical product information is preserved
[ ] Historical prices are preserved
[ ] Discount information is preserved
[ ] Address snapshots are preserved
[ ] Payment relationship is correct
[ ] Order lifecycle works
[ ] Status history is recorded
[ ] Merchant order management works
[ ] Customer order access works
[ ] Tenant isolation is enforced
[ ] Authorization is enforced
[ ] Historical fields cannot be arbitrarily modified
[ ] Cancellation rules work
[ ] Stable error codes are used
[ ] Events are emitted correctly
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Concurrency tests pass
[ ] Security tests pass
[ ] End-to-end purchase tests pass
[ ] TypeScript passes
[ ] Lint passes
```

---

# 58. Final Principle

An Order is not a live view of the current catalog.

It is a **historical record of an accepted purchase**.

The implementation must preserve the answer to:

```text id="m5q7r4"
What did the customer buy?
How many?
At what price?
Using which discount?
For which Store?
Under which purchase conditions?
```

even months later, after the merchant has edited the catalog repeatedly.

That historical stability is one of the core properties that separates a commerce platform from a shopping cart with a database attached.