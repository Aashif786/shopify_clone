# Domain Integration Plan

## 1. Purpose

This document defines how domain modules communicate with one another in the Demo.

The objective is to preserve modular-monolith boundaries while allowing complete commerce workflows such as:

```text id="m4c8x7"
Store
  ↓
Product
  ↓
Inventory
  ↓
Cart
  ↓
Checkout
  ↓
Payment
  ↓
Order
  ↓
Notification
```

Modules must collaborate without directly depending on another module's private implementation or database tables.

---

# 2. Integration Principles

Domain integration must follow these rules:

- Each module owns its business logic.
- Each module owns its persistence.
- Other modules use public interfaces.
- Application services coordinate multi-domain workflows.
- Domain events communicate completed facts.
- Background jobs handle secondary asynchronous work.
- PostgreSQL remains the transactional source of truth.
- External providers are accessed through adapters.
- Cross-domain transactions are explicit.

---

# 3. Integration Mechanisms

The Demo supports three primary mechanisms:

```text id="q7m3c8"
Direct application-service call
        ↓
Synchronous domain operation

Domain event
        ↓
Asynchronous reaction

Background job
        ↓
Deferred work
```

The mechanism should match the business requirement.

---

# 4. Synchronous vs Asynchronous

Use synchronous integration when the current operation cannot safely complete without the result.

Examples:

```text id="x5n8m4"
Checkout
    ↓
Inventory reservation

Checkout
    ↓
Payment initiation

Checkout
    ↓
Order creation
```

Use asynchronous integration for secondary effects:

```text id="m8c4x7"
Order Created
    ↓
Send notification
```

---

# 5. Public Module Interfaces

Each module should expose a deliberately small public interface.

Examples:

```text id="v6m3x9"
Products
    ├── getProductForStore()
    └── validatePurchasableVariant()

Inventory
    ├── reserve()
    ├── release()
    └── finalize()

Customers
    └── getCustomerForStore()

Discounts
    └── calculateDiscount()

Payments
    ├── createPayment()
    └── refundPayment()
```

Exact interfaces are defined during implementation.

---

# 6. Forbidden Integration

Modules must not do this:

```text id="c8m4n7"
Orders
   ↓
Products private repository
   ↓
Products table
```

or:

```text id="x7m3c9"
Checkout
   ↓
payments/src/internal/*
```

Internal module files remain private.

---

# 7. Application Service Orchestration

Complex workflows should be coordinated by an application service belonging to the domain responsible for the use case.

For example:

```text id="p4m8x3"
Checkout Application Service
       ↓
Products
       ↓
Inventory
       ↓
Discounts
       ↓
Payments
       ↓
Orders
```

This avoids placing the entire workflow inside one low-level repository.

---

# 8. Store Integration

Stores provide the tenant context required by most domains.

Other modules should resolve Store ownership through Store's public interface rather than manipulating Store internals.

Example:

```text id="n5c8m4"
Product Creation
    ↓
Validate Store
    ↓
Create Product
```

---

# 9. Product Integration

Products provide catalog information required by:

- Inventory.
- Cart.
- Checkout.
- Storefront.
- Orders.

However, these domains should not rely on mutable Product records for historical information.

---

# 10. Product and Inventory

Relationship:

```text id="m7x3c8"
Product Variant
      ↓
Inventory
```

Inventory owns stock state.

Products own:

- Variant identity.
- SKU.
- Product metadata.
- Product pricing where applicable.
- Publication state.

Inventory must not become the owner of product information.

---

# 11. Product and Cart

Cart items reference purchasable variants.

The Cart may obtain product information through the Products public interface.

Cart should store only the data required for its lifecycle.

---

# 12. Product and Checkout

Checkout must validate that referenced variants remain valid and purchasable.

Conceptually:

```text id="q8m4c7"
Checkout
    ↓
Product validation
    ↓
Current purchasable state
```

Checkout must not blindly trust stale cart data.

---

# 13. Product and Orders

Orders must preserve historical information.

When an order is created:

```text id="v4n8m3"
Current Product
      ↓
Order Item Snapshot
```

The order must not depend on future Product edits to display historical purchase information.

---

# 14. Product and Storefront

Storefront uses Products to display published catalog information.

Conceptually:

```text id="x6m3c8"
Storefront
    ↓
Product Catalog Interface
    ↓
Published Products
```

Storefront must not query Product tables directly.

---

# 15. Inventory Integration

Inventory provides authoritative stock state.

Consumers should use public operations such as:

```text id="p7c4m8"
getAvailability()
reserve()
release()
finalize()
```

They should not modify inventory quantities directly.

---

# 16. Inventory and Cart

Cart may display availability information.

However, adding an item to a Cart does not necessarily reserve inventory.

Final inventory validation occurs during checkout according to the inventory specification.

---

# 17. Inventory and Checkout

Checkout performs the critical inventory reservation.

Typical flow:

```text id="m8c4x7"
Checkout
    ↓
Validate variants
    ↓
Reserve inventory
    ↓
Continue payment workflow
```

Reservation must be transactional and concurrency-safe.

---

# 18. Inventory and Orders

Order completion must establish the appropriate final inventory state.

Conceptually:

```text id="q5n7m3"
Inventory Reservation
        ↓
Payment / Checkout Success
        ↓
Finalize Inventory
```

Cancellation or expiration may release reservations according to the state machine.

---

# 19. Customer Integration

Customers are Store-scoped.

Consumers may request customer information through the Customer module's public interface.

Other modules must not directly modify Customer records.

---

# 20. Customer and Cart

A cart may optionally belong to a customer.

Guest carts remain valid without Customer records.

Conceptually:

```text id="x8m4c6"
Guest
  ↓
Cart

Customer
  ↓
Cart
```

---

# 21. Customer and Checkout

Checkout may use customer information for:

- Customer association.
- Contact details.
- Address selection.
- Order creation.

The checkout workflow must not modify customer data without explicitly invoking the Customer module.

---

# 22. Customer and Orders

Orders may reference the customer identity while storing historical customer information required for the completed transaction.

For example:

```text id="m4c8x7"
Customer
    ↓
Order
    ↓
Historical Address Snapshot
```

Changing the customer's current address must not rewrite historical order data.

---

# 23. Cart Integration

Cart is responsible for the temporary shopping state.

Checkout consumes the Cart.

```text id="v7m3c9"
Cart
   ↓
Checkout
```

Checkout must revalidate critical data rather than assuming the Cart remained correct since its last update.

---

# 24. Cart and Discounts

The Cart may accept a discount code for display or preliminary calculation.

The authoritative discount calculation occurs during checkout.

This prevents stale cart totals from becoming the final transaction amount.

---

# 25. Discount Integration

Discounts may depend on:

- Store.
- Products.
- Variants.
- Cart contents.
- Customer eligibility.
- Usage state.

The Discount module owns these rules.

Checkout requests a discount calculation rather than implementing discount logic itself.

---

# 26. Discount and Inventory

Discount calculation should not directly mutate inventory.

These domains remain independent.

Checkout coordinates them.

---

# 27. Discount and Orders

When an order is completed, the applied discount information needed for historical accuracy should be persisted in the order.

The order must not depend on the current Discount configuration to explain a historical purchase.

---

# 28. Checkout Integration

Checkout is the central orchestration domain for the purchase flow.

It coordinates:

```text id="n6c4m8"
Cart
Products
Customers
Discounts
Inventory
Payments
Orders
```

It should not absorb the internal business logic of those domains.

---

# 29. Checkout Transaction Boundaries

Critical checkout state transitions should use explicit transactions.

However, external payment-provider calls should not be held inside long-running database transactions.

The workflow must use explicit intermediate states where necessary.

---

# 30. Checkout and Payments

Checkout requests payment processing through the Payments public interface.

Conceptually:

```text id="x4m8c7"
Checkout
    ↓
Payment Application Interface
    ↓
Payment Provider Adapter
```

Checkout should not import provider SDKs directly.

---

# 31. Checkout and Orders

Successful checkout eventually results in an Order.

The order creation operation should preserve:

- Purchased items.
- Prices.
- Discounts.
- Customer information required historically.
- Payment relationship.
- Store context.

---

# 32. Payments Integration

Payments interact with:

- Checkout.
- Orders.
- Webhooks.
- External payment providers.
- Refund workflows.

Payments own payment state.

Orders should not directly determine whether a provider-side payment succeeded.

---

# 33. Payment Webhooks

Provider webhooks enter through the Webhook boundary.

Conceptually:

```text id="p8m3x6"
Provider
   ↓
Webhook Endpoint
   ↓
Signature Verification
   ↓
Webhook Persistence
   ↓
Payment Processing
   ↓
Payment State
```

---

# 34. Payment and Orders

Payment state may influence order state.

However, the Order module should receive a meaningful application-level result or event rather than directly interpreting provider-specific statuses.

---

# 35. Payment and Refunds

Refunds are payment operations.

The Payments module coordinates:

```text id="m5c8x7"
Refund Request
    ↓
Provider
    ↓
Payment State
    ↓
Order / Customer-visible Result
```

Order state should reflect the appropriate business result.

---

# 36. Orders Integration

Orders represent durable purchase history.

They integrate with:

- Checkout.
- Payments.
- Inventory.
- Customers.
- Notifications.

Orders should not become the owner of those domains.

---

# 37. Order and Inventory

Order cancellation may cause inventory release or adjustment depending on the order lifecycle.

The interaction should use the Inventory public interface.

---

# 38. Order and Notifications

Order events may trigger notifications.

Example:

```text id="v6m4c8"
OrderCreated
    ↓
Notification Job
    ↓
Customer Notification
```

Notification failure must not normally roll back the Order transaction.

---

# 39. Order and Customers

Orders may reference Customer identity.

Historical customer information must be snapshotted when required.

---

# 40. Storefront Integration

Storefront is primarily a read-oriented consumer of core commerce domains.

It uses:

```text id="q7m3c9"
Store
Products
Inventory
Cart
Checkout
```

Storefront should not own catalog or inventory state.

---

# 41. Storefront and Inventory

Storefront availability may use Inventory's public availability interface.

It should not directly calculate stock from database columns.

---

# 42. Storefront and Cart

Storefront provides the customer-facing entry point to cart operations.

Conceptually:

```text id="x8m4c7"
Product Page
    ↓
Add to Cart
    ↓
Cart Application Service
```

The Storefront layer remains presentation/API infrastructure.

---

# 43. Storefront and Checkout

Storefront initiates checkout but should not implement checkout business rules.

```text id="m4c7n8"
Storefront
    ↓
Checkout API
    ↓
Checkout Application Service
```

---

# 44. Media Integration

Media is consumed primarily by:

```text id="p6m8x3"
Products
Stores
Storefront
```

Media owns storage metadata and object lifecycle.

Products own the relationship between a product and its media.

---

# 45. Notification Integration

Notifications should consume domain facts.

Examples:

```text id="v8c3m7"
OrderCreated
PaymentSucceeded
OrderCancelled
PasswordResetRequested
```

The notification system should not query every domain's internal tables to discover what happened.

---

# 46. Event Integration

Domain events represent facts:

```text id="n5m4x8"
ProductPublished
OrderCreated
PaymentSucceeded
```

They should not contain commands such as:

```text id="x7c3m9"
SendEmail
ChargeCard
CreateOrder
```

Commands belong to application operations/jobs.

---

# 47. Event Payload Design

Events should include enough information for consumers to react without exposing unnecessary data.

Typical metadata:

```text id="m8c4x7"
eventId
eventType
occurredAt
organizationId
storeId
aggregateId
```

Additional payload depends on the event.

---

# 48. Event Versioning

Events should be treated as contracts.

If event structure changes incompatibly, use a versioning strategy rather than silently changing the meaning of existing events.

Example:

```text id="q4m8c3"
OrderCreated.v1
OrderCreated.v2
```

Only introduce versions when an actual compatibility requirement exists.

---

# 49. Event Delivery

For critical events where loss would create business inconsistency, event persistence and delivery must be designed carefully.

The Demo may use PostgreSQL-backed mechanisms rather than introducing a separate event broker.

---

# 50. Background Job Integration

Jobs represent work to be performed.

Example:

```text id="x6m3c8"
OrderCreated
    ↓
Create Notification Job
    ↓
Worker
    ↓
Send Notification
```

Jobs must be idempotent.

---

# 51. Integration Failure Handling

If a dependent module fails:

- The caller must receive a meaningful application error.
- The transaction must roll back where appropriate.
- Retryable operations should follow retry policy.
- Secondary asynchronous operations should not unnecessarily block the core transaction.

---

# 52. Integration and Idempotency

Cross-domain operations must define retry behavior.

Examples:

```text id="m7c4x8"
Checkout completion
Payment creation
Refund
Inventory reservation
Webhook processing
Notification delivery
```

Repeated execution must not create unintended duplicate state.

---

# 53. Integration and Concurrency

Cross-domain operations must account for concurrent execution.

Examples:

```text id="p8m3c7"
Two checkouts
    ↓
Same inventory

Two payment callbacks
    ↓
Same payment

Two discount redemptions
    ↓
Same usage limit
```

The owning domain must provide the concurrency-safe operation.

---

# 54. Integration Testing

Cross-domain integration tests should verify complete workflows.

Minimum critical flow:

```text id="v4c8m6"
Store
 ↓
Product
 ↓
Inventory
 ↓
Customer / Guest
 ↓
Cart
 ↓
Checkout
 ↓
Payment
 ↓
Order
```

---

# 55. Integration Test Scenarios

Important scenarios include:

- Successful purchase.
- Insufficient inventory.
- Invalid discount.
- Expired checkout.
- Failed payment.
- Payment webhook retry.
- Duplicate checkout request.
- Order cancellation.
- Inventory release.
- Refund.
- Notification failure.
- Cross-tenant access attempt.

---

# 56. Integration Contract Tests

Where one module depends on another public interface, tests should verify the contract rather than the internal implementation.

This protects modules from unnecessary coupling.

---

# 57. Integration Definition of Done

```text id="n6m4x8"
[ ] Public module interfaces are defined
[ ] Direct private-module access is prohibited
[ ] Synchronous integration rules are defined
[ ] Asynchronous integration rules are defined
[ ] Domain events are defined where needed
[ ] Job integration is defined
[ ] Tenant context propagates safely
[ ] Checkout integration works
[ ] Payment integration works
[ ] Inventory integration works
[ ] Order integration works
[ ] Notification integration works
[ ] Webhook integration works
[ ] Critical idempotency is verified
[ ] Critical concurrency is verified
[ ] Cross-domain tests pass
```

---

# 58. Final Integration Principle

The modular monolith should behave as one application while preserving independent domain ownership:

```text id="c8m4x7"
        ┌──────────── Products
        │
Stores ─┼──────────── Inventory
        │
        ├──────────── Customers
        │
        └──────────── Carts
                         ↓
                      Checkout
                    ↙         ↘
              Inventory      Payments
                                  ↓
                                Orders
                                  ↓
                           Notifications
```

Modules collaborate through explicit contracts, application services, events, and jobs.

They share a PostgreSQL database because this is a modular monolith. They do **not** share ownership of each other's business logic simply because the tables happen to live in the same database.