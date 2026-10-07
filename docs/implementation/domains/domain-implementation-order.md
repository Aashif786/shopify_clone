# Domain Implementation Order

## 1. Purpose

This document defines the recommended implementation order for the commerce domain modules.

The order is based on dependency relationships, business criticality, risk, and the need to establish reusable foundations before implementing higher-level workflows.

The objective is to minimize rework while preserving the modular-monolith architecture.

---

# 2. Domain Modules

The Demo contains:

```text id="8m4c7x"
stores
products
inventory
customers
carts
discounts
checkout
payments
orders
storefront
```

Supporting capabilities include:

```text id="n6m3x8"
auth
media
notifications
webhooks
jobs
```

---

# 3. Recommended Order

The primary implementation sequence is:

```text id="v7c4m9"
1. Stores
2. Products
3. Inventory
4. Customers
5. Carts
6. Discounts
7. Checkout
8. Payments
9. Orders
10. Storefront
11. Media
12. Notifications
13. Webhooks
14. Background Jobs
```

The supporting infrastructure may be implemented earlier where required by a domain.

---

# 4. Why Stores First

Stores establish the primary tenant boundary.

They provide:

- Store identity.
- Store lifecycle.
- Store configuration.
- Organization relationship.
- Membership relationship.

Most commerce resources depend on Store ownership.

Therefore:

```text id="q5m8x3"
Stores
    ↓
Most other domains
```

---

# 5. Why Products Follow Stores

Products are Store-owned catalog resources.

Products establish:

- Product identity.
- Variant identity.
- SKU.
- Pricing.
- Publication state.
- Product metadata.

Inventory and Storefront functionality depend heavily on the product model.

---

# 6. Why Inventory Follows Products

Inventory references purchasable product variants.

Therefore:

```text id="x7m3c8"
Products
    ↓
Variants
    ↓
Inventory
```

Inventory can then establish stock, reservations, adjustments, and availability behavior.

---

# 7. Why Customers Follow Inventory

Customers are comparatively independent of inventory.

They require the Store foundation but do not need checkout to exist.

Implementing customers before carts allows customer identity and address behavior to be established before customer-aware purchasing flows are built.

---

# 8. Why Carts Follow Customers

Carts depend on:

- Store.
- Product/variant references.
- Optional customer identity.

Therefore:

```text id="m8c4n7"
Stores
Products
Customers
    ↓
Carts
```

Guest carts remain supported without requiring a Customer record.

---

# 9. Why Discounts Follow Carts

Discounts affect cart and checkout pricing.

They depend on:

- Store.
- Product eligibility.
- Cart contents.
- Customer eligibility where applicable.
- Time/usage rules.

The discount engine should therefore exist before final checkout implementation.

---

# 10. Why Checkout Follows Discounts

Checkout coordinates the complete purchase operation.

It depends on:

```text id="k6m3x9"
Cart
Products
Inventory
Discounts
Customer
```

Checkout should not be implemented before these dependencies have stable contracts.

---

# 11. Why Payments Follow Checkout Foundation

Checkout determines what must be paid.

Payments determine how the payment attempt is processed.

The boundary should therefore be:

```text id="p4m8c7"
Checkout
    ↓
Payment Interface
    ↓
Payment Provider
```

The payment module can be developed alongside checkout once the contract is stable.

---

# 12. Why Orders Follow Payments

Orders represent durable completed purchases.

The typical completion relationship is:

```text id="x8m4c3"
Checkout
    ↓
Payment
    ↓
Order
```

The exact state machine may allow orders to exist before final payment depending on the payment flow, but the order domain must understand payment state sufficiently to represent the correct lifecycle.

---

# 13. Why Storefront Follows Core Commerce

The Storefront consumes:

- Store configuration.
- Published products.
- Product variants.
- Inventory availability.
- Cart behavior.
- Checkout entry points.

Therefore it is safer to implement the underlying domain contracts first.

---

# 14. Supporting Domains

The following supporting domains may be implemented in parallel when their dependencies are available:

```text id="c7m4x8"
Media
Notifications
Webhooks
Jobs
```

However, their infrastructure foundations should be established before they become required by production workflows.

---

# 15. Media Dependency

Media is primarily used by:

- Products.
- Store configuration.
- Storefront.

It may therefore begin once Store and Product contracts are sufficiently stable.

It does not need to block the initial product domain implementation if product records can initially exist without media.

---

# 16. Notification Dependency

Notifications consume domain events.

Therefore:

```text id="n5c8m3"
Domain Event
    ↓
Notification Handler
    ↓
Notification
```

The notification system does not need to exist before core domains can operate.

---

# 17. Webhook Dependency

Webhooks primarily support external integrations.

They become particularly important for:

- Payments.
- External provider callbacks.
- Asynchronous integration state.

Webhook infrastructure may be implemented once payment provider integration begins.

---

# 18. Job Dependency

The PostgreSQL-backed job system supports secondary asynchronous work.

It may be implemented before the domains that consume it, but the actual job handlers should be added only when the corresponding domain workflow exists.

---

# 19. Domain Implementation Layers

Each domain should be implemented using:

```text id="m4x8c7"
Presentation
    ↓
Application
    ↓
Domain
    ↓
Infrastructure
```

Not every domain needs every layer to have the same complexity.

---

# 20. Domain Implementation Sequence

Each domain should generally follow:

```text id="q8m3c6"
1. Confirm specification
2. Confirm data ownership
3. Define domain model
4. Define application use cases
5. Define repository interfaces
6. Implement persistence
7. Implement domain rules
8. Implement application services
9. Implement API boundary
10. Add tests
11. Integrate with dependent domains
12. Verify security and tenant isolation
```

---

# 21. Stores Implementation

Implement:

```text id="x5c9m4"
Store creation
Store configuration
Store status
Store lookup
Membership relationship
Store access
```

Verification should include tenant isolation.

---

# 22. Products Implementation

Implement:

```text id="v7m3n8"
Product creation
Product updates
Variants
SKU
Pricing
Publication
Product lookup
Catalog queries
```

Verify:

- Store ownership.
- Validation.
- Slug uniqueness.
- Publication behavior.

---

# 23. Inventory Implementation

Implement:

```text id="k8c4m7"
Stock levels
Adjustments
Reservations
Reservation release
Reservation finalization
Availability
Inventory history
```

This domain requires particularly strong concurrency testing.

---

# 24. Customers Implementation

Implement:

```text id="n6m4x8"
Customer creation
Customer profile
Customer lookup
Addresses
Customer lifecycle
```

Verify Store isolation.

---

# 25. Carts Implementation

Implement:

```text id="p3m8c7"
Guest carts
Customer carts
Cart items
Quantity updates
Cart expiration
Cart totals
Cart concurrency
```

Cart totals must not become the authoritative final checkout price.

---

# 26. Discounts Implementation

Implement:

```text id="x4c7m9"
Discount definitions
Codes
Eligibility
Validity
Calculation
Usage limits
Usage recording
```

Discount usage must be concurrency-safe.

---

# 27. Checkout Implementation

Implement:

```text id="m8n3c6"
Checkout creation
Cart validation
Pricing recalculation
Discount application
Inventory reservation
Payment orchestration
Completion
Expiration
Cancellation
```

Checkout is one of the highest-risk domains.

---

# 28. Payments Implementation

Implement:

```text id="q7m4x8"
Payment intent
Payment attempts
Provider abstraction
Provider adapter
Payment state
Webhook integration
Refunds
Reconciliation
Idempotency
```

Never allow provider-specific state to become the application's only payment truth.

---

# 29. Orders Implementation

Implement:

```text id="v5c8m3"
Order creation
Order items
Historical snapshots
Order status
Order history
Merchant management
Refund integration
```

Historical order data must remain stable even when current product data changes.

---

# 30. Storefront Implementation

Implement:

```text id="n4m7x9"
Public Store resolution
Published catalog
Product detail
Availability
Cart entry
Checkout entry
Public Store configuration
```

Storefront access must respect publication and Store status rules.

---

# 31. Media Implementation

Implement:

```text id="x8c3m6"
Media metadata
Object storage integration
Upload flow
Access control
Product association
Cleanup
```

Binary data should remain in object storage rather than PostgreSQL.

---

# 32. Notifications Implementation

Implement:

```text id="k6m4c8"
Notification creation
Template handling
Delivery
Retries
Preferences
Notification status
```

Notifications should not contain core business rules.

---

# 33. Webhooks Implementation

Implement:

```text id="p8m3x7"
Raw event capture
Signature verification
Replay protection
Deduplication
Event normalization
Processing
Failure handling
```

Webhook processing should be idempotent.

---

# 34. Jobs Implementation

Implement:

```text id="v4n8c6"
Job persistence
Claiming
Execution
Retry
Backoff
Failure
Stale-job recovery
Graceful shutdown
```

Job handlers should remain domain-specific.

---

# 35. Parallel Development

Once foundational dependencies are stable, some work may proceed in parallel.

Example:

```text id="m7c3x9"
Products ───────────────┐
                        ├── Storefront
Inventory ──────────────┘

Customers ──────────────── Carts

Payments ── Webhooks
Orders ──── Notifications
```

Parallel work must not bypass ownership boundaries.

---

# 36. Critical Path

The highest-risk critical path is:

```text id="q5m8c4"
Stores
  ↓
Products
  ↓
Inventory
  ↓
Customers
  ↓
Carts
  ↓
Discounts
  ↓
Checkout
  ↓
Payments
  ↓
Orders
  ↓
Storefront
  ↓
End-to-End Verification
```

This path should receive the strongest integration testing.

---

# 37. Risk-Based Prioritization

Not all domains require equal implementation depth.

Highest risk:

```text id="x8m3c7"
Inventory
Checkout
Payments
Orders
Tenant isolation
Authentication / Authorization
```

Medium risk:

```text id="n4c7m8"
Products
Carts
Discounts
Customers
```

Lower infrastructure complexity:

```text id="p6m8x3"
Media
Notifications
```

Risk classification does not mean lower-quality implementation. It determines testing and review intensity.

---

# 38. Domain Completion Criteria

A domain is not complete when its code compiles.

It is complete when:

```text id="m8c4x7"
Implementation
+
Persistence
+
Validation
+
Authorization
+
Tenant isolation
+
Error handling
+
Tests
+
Integration
```

are all sufficiently covered.

---

# 39. Domain Integration Gates

Before implementing a dependent domain, verify that the dependency provides:

- Stable public interfaces.
- Required persistence.
- Required state transitions.
- Required error behavior.
- Required authorization semantics.
- Required test coverage.

Do not build against unstable internal implementation details.

---

# 40. Avoiding Premature Abstractions

Do not create generalized infrastructure merely because two domains appear superficially similar.

First establish actual usage.

Extract shared abstractions only when:

- The behavior is genuinely shared.
- The ownership is clear.
- The abstraction reduces coupling rather than hiding it.

---

# 41. Domain Testing Strategy

Every domain should contain:

### Unit tests

For pure domain behavior.

### Integration tests

For database and application-service behavior.

### API tests

For externally exposed operations.

### Security tests

For authorization and tenant isolation.

Critical domains additionally require concurrency and idempotency tests.

---

# 42. Domain Integration Verification

After implementing a domain, verify:

```text id="c7m4x8"
Create
Read
Update
Delete / Deactivate
Authorization
Tenant isolation
Validation
Error handling
Concurrency
Idempotency where applicable
```

Not every operation applies to every domain, but every relevant behavior must be covered.

---

# 43. Domain Implementation Documentation

The corresponding implementation specification should remain the authoritative guide.

Examples:

```text id="x5m9c3"
specs/products/product-implementation.md
specs/inventory/inventory-implementation.md
specs/checkout/checkout-implementation.md
```

The implementation should not invent behavior that contradicts those documents without updating the specification.

---

# 44. AI-Assisted Domain Implementation

When AI tools are used:

1. Read `AGENTS.md`.
2. Inspect the relevant module.
3. Read the domain specification.
4. Read related architecture documents.
5. Inspect existing patterns.
6. Implement the smallest complete change.
7. Run targeted tests.
8. Review the diff.
9. Do not modify unrelated domains.

---

# 45. Domain Implementation Definition of Done

The complete domain sequence is finished when:

```text id="n7c4m8"
[ ] Stores implemented
[ ] Products implemented
[ ] Inventory implemented
[ ] Customers implemented
[ ] Carts implemented
[ ] Discounts implemented
[ ] Checkout implemented
[ ] Payments implemented
[ ] Orders implemented
[ ] Storefront implemented
[ ] Media implemented
[ ] Notifications implemented
[ ] Webhooks implemented
[ ] Jobs implemented
[ ] Cross-domain integrations verified
[ ] Security verified
[ ] Tenant isolation verified
[ ] Critical concurrency verified
[ ] Critical idempotency verified
[ ] End-to-end purchase flow works
```

---

# 46. Final Domain Principle

Domain implementation should progress from foundational ownership to increasingly complex orchestration:

```text id="q8m3x6"
Identity / Tenant
      ↓
Store
      ↓
Catalog
      ↓
Inventory
      ↓
Customer / Cart
      ↓
Pricing / Discount
      ↓
Checkout
      ↓
Payment
      ↓
Order
      ↓
Storefront
      ↓
Secondary Integrations
```

The sequence is designed to reduce rework while keeping each domain independently understandable. The goal is not to make development artificially linear. It is to make dependencies explicit enough that parallel work does not turn into architectural archaeology later.