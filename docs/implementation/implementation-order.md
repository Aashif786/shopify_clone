# Implementation Order

## 1. Purpose

This document defines the required implementation sequence for the Shopify-like Demo.

The order is dependency-driven. Each phase should establish the capabilities required by subsequent phases while keeping the system runnable and verifiable throughout development.

The implementation should progress from **platform foundations → core domains → commerce lifecycle → secondary integrations → full-system verification**.

---

## 2. Implementation Principles

The implementation order follows these rules:

1. Build dependencies before dependents.
2. Establish security before business functionality.
3. Establish database infrastructure before complex persistence.
4. Implement business domains in vertical slices.
5. Verify each major capability before building heavily on top of it.
6. Implement critical correctness before convenience features.
7. Avoid introducing infrastructure before a demonstrated requirement.
8. Keep the application runnable after every major phase.

---

# 3. Phase Overview

```text
Phase 0  Repository & Tooling
    ↓
Phase 1  Application Foundation
    ↓
Phase 2  Database Foundation
    ↓
Phase 3  Authentication & Tenant Foundation
    ↓
Phase 4  Store Management
    ↓
Phase 5  Products
    ↓
Phase 6  Inventory
    ↓
Phase 7  Customers
    ↓
Phase 8  Carts
    ↓
Phase 9  Discounts
    ↓
Phase 10 Checkout
    ↓
Phase 11 Payments
    ↓
Phase 12 Orders
    ↓
Phase 13 Storefront
    ↓
Phase 14 Media
    ↓
Phase 15 Notifications
    ↓
Phase 16 Webhooks
    ↓
Phase 17 Background Jobs
    ↓
Phase 18 Full Integration
    ↓
Phase 19 Demo Verification
```

---

# 4. Phase 0: Repository & Tooling

## Objective

Establish the development environment before application implementation begins.

## Tasks

- Verify pnpm workspace.
- Verify TypeScript configuration.
- Verify package boundaries.
- Verify Next.js application structure.
- Verify Worker application structure.
- Configure linting.
- Configure formatting.
- Configure testing framework.
- Configure Git hooks if required.
- Verify environment variable handling.
- Verify CI baseline.

## Exit Criteria

```text
[ ] pnpm install works
[ ] Web application starts
[ ] Worker application starts
[ ] TypeScript builds
[ ] Linting works
[ ] Unit test runner works
[ ] CI baseline passes
```

---

# 5. Phase 1: Application Foundation

## Objective

Create the shared application infrastructure used by every domain.

## Tasks

- Application bootstrap.
- Shared configuration.
- Logging.
- Error handling.
- Validation.
- Request context.
- API response conventions.
- API versioning.
- Health checks.
- Common types.
- Shared utilities where justified.

## Dependencies

Requires Phase 0.

## Exit Criteria

```text
[ ] Application boots
[ ] Configuration loads
[ ] Health endpoint works
[ ] Error contract works
[ ] Validation infrastructure works
[ ] Request context works
[ ] Logging works
```

---

# 6. Phase 2: Database Foundation

## Objective

Establish PostgreSQL as the authoritative transactional datastore.

## Tasks

- PostgreSQL local environment.
- Database connection.
- Connection pooling.
- Migration framework.
- Transaction helpers.
- Repository conventions.
- Database test environment.
- Initial migration infrastructure.
- Seed infrastructure.

## Dependencies

Requires Phase 1.

## Exit Criteria

```text
[ ] PostgreSQL starts
[ ] Application connects
[ ] Worker connects
[ ] Migrations execute
[ ] Roll-forward workflow works
[ ] Transactions work
[ ] Database integration tests work
```

---

# 7. Phase 3: Authentication & Tenant Foundation

## Objective

Establish secure identity and multi-tenant access before implementing business domains.

## Tasks

### Authentication

- User identity.
- Password authentication where required.
- Session management.
- Login.
- Logout.
- Session resolution.
- Password reset where required.
- Email verification where required.

### Tenant

- Organization.
- Membership.
- Store context foundation.
- Tenant resolution.
- Authorization foundation.
- Role/permission enforcement.

## Dependencies

Requires:

- Phase 1.
- Phase 2.

## Exit Criteria

```text
[ ] User can authenticate
[ ] Session is secure
[ ] Session expiration works
[ ] Tenant context resolves
[ ] Membership is enforced
[ ] Unauthorized Store access is denied
[ ] Cross-tenant access tests pass
```

---

# 8. Phase 4: Stores

## Objective

Implement the Store domain.

## Tasks

- Store creation.
- Store configuration.
- Store lifecycle.
- Store identification.
- Store access.
- Store membership integration.
- Store public configuration.

## Dependencies

Requires:

- Authentication.
- Tenant foundation.
- Database foundation.

## Exit Criteria

```text
[ ] Store can be created
[ ] Store can be configured
[ ] Store lifecycle works
[ ] Store authorization works
[ ] Cross-tenant Store access is prevented
[ ] Store APIs work
```

---

# 9. Phase 5: Products

## Objective

Implement the product catalog.

## Tasks

- Product creation.
- Product updates.
- Product lifecycle.
- Variants.
- SKU.
- Pricing.
- Product media relationships.
- Product publication.
- Product retrieval.
- Product listing.

## Dependencies

Requires:

- Stores.
- Database.
- Authentication/authorization.

## Exit Criteria

```text
[ ] Product can be created
[ ] Variant can be created
[ ] Pricing works
[ ] Product lifecycle works
[ ] Product publication works
[ ] Store scoping works
[ ] Product APIs work
```

---

# 10. Phase 6: Inventory

## Objective

Implement authoritative inventory management.

## Tasks

- Inventory records.
- Stock adjustments.
- Inventory movements.
- Reservations.
- Reservation release.
- Reservation finalization.
- Expiration.
- Concurrency control.

## Dependencies

Requires:

- Stores.
- Products.

## Exit Criteria

```text
[ ] Inventory can be created
[ ] Stock adjustment works
[ ] Available quantity is correct
[ ] Reservation works
[ ] Release works
[ ] Finalization works
[ ] Overselling is prevented
[ ] Concurrency tests pass
```

---

# 11. Phase 7: Customers

## Objective

Implement Store-scoped customer management.

## Tasks

- Customer creation.
- Customer lookup.
- Customer profile.
- Customer addresses.
- Customer status.
- Customer authentication association.
- Customer access rules.

## Dependencies

Requires:

- Stores.
- Authentication.

## Exit Criteria

```text
[ ] Customer can be created
[ ] Customer belongs to correct Store
[ ] Customer profile works
[ ] Address management works
[ ] Customer authorization works
[ ] Cross-tenant access is denied
```

---

# 12. Phase 8: Carts

## Objective

Implement the shopping cart lifecycle.

## Tasks

- Cart creation.
- Guest cart.
- Customer cart.
- Cart retrieval.
- Add item.
- Update quantity.
- Remove item.
- Clear cart.
- Cart expiration.
- Cart ownership.

## Dependencies

Requires:

- Stores.
- Products.
- Customers where authenticated carts are supported.

## Exit Criteria

```text
[ ] Guest cart works
[ ] Customer cart works
[ ] Items can be added
[ ] Quantities can be updated
[ ] Items can be removed
[ ] Cart ownership is secure
[ ] Cart totals are correct
```

---

# 13. Phase 9: Discounts

## Objective

Implement discount definitions and validation.

## Tasks

- Discount creation.
- Discount codes.
- Percentage discounts.
- Fixed discounts.
- Validity windows.
- Minimum order requirements.
- Product/variant eligibility.
- Customer eligibility.
- Usage limits.
- Usage tracking.

## Dependencies

Requires:

- Stores.
- Products.
- Customers.
- Carts.

## Exit Criteria

```text
[ ] Discount can be created
[ ] Code validation works
[ ] Discount calculation works
[ ] Eligibility works
[ ] Usage limits work
[ ] Concurrent usage is safe
[ ] Invalid discounts are rejected
```

---

# 14. Phase 10: Checkout

## Objective

Implement the authoritative purchase preparation and coordination flow.

## Tasks

- Checkout creation.
- Cart validation.
- Product validation.
- Price snapshotting.
- Discount validation.
- Address/contact information.
- Inventory reservation.
- Checkout lifecycle.
- Checkout expiration.
- Checkout completion orchestration.

## Dependencies

Requires:

- Stores.
- Products.
- Inventory.
- Customers.
- Carts.
- Discounts.

## Exit Criteria

```text
[ ] Checkout can be created
[ ] Cart is revalidated
[ ] Pricing is authoritative
[ ] Discounts are revalidated
[ ] Inventory reservation works
[ ] Checkout state machine works
[ ] Concurrent completion is safe
[ ] Checkout expiration works
```

---

# 15. Phase 11: Payments

## Objective

Implement payment state and provider integration.

## Tasks

- Payment entity.
- Payment attempts.
- Provider abstraction.
- Sandbox/test provider.
- Payment initiation.
- Payment state transitions.
- Provider idempotency.
- Refund foundation.
- Payment recovery.

## Dependencies

Requires:

- Checkout.
- Stores.

## Exit Criteria

```text
[ ] Payment can be initiated
[ ] Payment amount is server-controlled
[ ] Payment state transitions work
[ ] Provider adapter works
[ ] Duplicate payment attempts are controlled
[ ] Provider timeout handling works
[ ] Refund foundation works
```

---

# 16. Phase 12: Orders

## Objective

Create durable completed purchases.

## Tasks

- Order creation.
- Order numbering.
- Order items.
- Product snapshots.
- Price snapshots.
- Customer snapshots.
- Address snapshots.
- Order state.
- Payment status.
- Fulfillment status.
- Order history.
- Merchant order management.

## Dependencies

Requires:

- Checkout.
- Payments.
- Inventory.
- Products.
- Customers.
- Discounts.

## Exit Criteria

```text
[ ] Successful checkout can create an Order
[ ] Order creation is idempotent
[ ] Historical snapshots exist
[ ] Order status works
[ ] Payment status works
[ ] Fulfillment status works
[ ] Merchant can view/manage Orders
[ ] Customer can access permitted Orders
```

---

# 17. Phase 13: Storefront

## Objective

Expose the customer-facing shopping experience.

## Tasks

- Store resolution.
- Public Store configuration.
- Product listing.
- Product detail.
- Product visibility.
- Availability display.
- Cart entry.
- Checkout entry.
- Basic SEO behavior.

## Dependencies

Requires:

- Stores.
- Products.
- Inventory.
- Carts.
- Checkout.

## Exit Criteria

```text
[ ] Public Store can be resolved
[ ] Published Products appear
[ ] Unpublished Products are hidden
[ ] Product detail works
[ ] Cart can be created
[ ] Checkout can be started
[ ] Tenant isolation is preserved
```

---

# 18. Phase 14: Media

## Objective

Implement media upload and product media handling.

## Tasks

- Object storage abstraction.
- Media metadata.
- Upload lifecycle.
- File validation.
- Product media association.
- Public/private access.
- Cleanup.

## Dependencies

Requires:

- Stores.
- Products.

## Exit Criteria

```text
[ ] Media can be uploaded
[ ] File validation works
[ ] Media metadata persists
[ ] Product media association works
[ ] Storefront can display public media
[ ] Unauthorized media access is blocked
```

---

# 19. Phase 15: Notifications

## Objective

Implement required transactional notifications.

## Tasks

- Notification records.
- Templates.
- Email provider abstraction.
- Email delivery.
- Notification jobs.
- Retry behavior.
- Notification history.

## Dependencies

Requires:

- Orders.
- Payments.
- Customers.
- Background job foundation where required.

## Exit Criteria

```text
[ ] Required notifications are generated
[ ] Recipient resolution works
[ ] Email provider works
[ ] Delivery failures retry
[ ] Duplicate processing is controlled
[ ] Sensitive data is protected
```

---

# 20. Phase 16: Webhooks

## Objective

Implement reliable external-provider event processing.

## Tasks

- Webhook endpoint.
- Raw-body handling.
- Signature verification.
- Replay protection.
- Event persistence.
- Duplicate detection.
- Provider normalization.
- Payment integration.
- Retry handling.
- Reconciliation where required.

## Dependencies

Requires:

- Payments.
- Database.
- Worker infrastructure.

## Exit Criteria

```text
[ ] Webhook authentication works
[ ] Duplicate events are safe
[ ] Replay protection works
[ ] Payment state updates correctly
[ ] Out-of-order events are safe
[ ] Failed processing retries
```

---

# 21. Phase 17: Background Jobs

## Objective

Complete durable asynchronous processing.

## Tasks

- Job repository.
- Job claiming.
- Worker loop.
- Handler registry.
- Retries.
- Backoff.
- Stale recovery.
- Scheduling.
- Graceful shutdown.
- Job observability.

## Dependencies

The basic Worker application may exist earlier, but domain-specific job processing should be completed after the required domain workflows exist.

## Exit Criteria

```text
[ ] Worker runs
[ ] Jobs persist
[ ] Jobs survive restart
[ ] Concurrent claiming is safe
[ ] Retries work
[ ] Backoff works
[ ] Stale jobs recover
[ ] Graceful shutdown works
```

---

# 22. Phase 18: Full Integration

## Objective

Verify that the complete commerce lifecycle works across module boundaries.

## Primary Flow

```text
Merchant
  ↓
Login
  ↓
Create Store
  ↓
Create Product
  ↓
Create Variant
  ↓
Add Inventory
  ↓
Publish Product
  ↓
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
Discount
  ↓
Inventory Reservation
  ↓
Payment
  ↓
Order
  ↓
Notification
```

## Exit Criteria

The complete lifecycle must execute successfully using real application code and real PostgreSQL transactions.

---

# 23. Phase 19: Demo Verification

## Objective

Verify that the Demo is genuinely usable rather than merely technically complete.

Verification includes:

### Functional

- Merchant workflows.
- Customer workflows.
- Product lifecycle.
- Inventory.
- Checkout.
- Payment.
- Orders.

### Security

- Authentication.
- Authorization.
- Tenant isolation.
- Input validation.
- Session security.
- Webhook security.

### Reliability

- Retry behavior.
- Idempotency.
- Concurrency.
- Worker recovery.
- Database transactions.

### Deployment

- Docker build.
- Production configuration.
- Database migration.
- Web deployment.
- Worker deployment.
- Health checks.
- Rollback.

---

# 24. Parallel Work

Some work can be performed in parallel after its dependencies are established.

For example:

```text
Products
Inventory
Customers
```

may be developed by separate developers once:

```text
Stores
Database
Authentication
Tenant Context
```

are stable.

Similarly:

```text
Media
Notifications
```

can progress independently after their required domain dependencies exist.

Parallel development must not bypass module ownership or shared database conventions.

---

# 25. Work That Must Remain Sequential

The following dependencies should remain explicit:

```text
Authentication
    ↓
Tenant / Authorization
    ↓
Stores
    ↓
Products
    ↓
Inventory
    ↓
Carts
    ↓
Checkout
    ↓
Payments
    ↓
Orders
```

This does not mean every line of code must be completed before the next domain begins. It means the required public contract and foundation must exist before dependent work relies on it.

---

# 26. Verification Gates

Each major phase has a gate.

A phase should not be considered complete merely because implementation exists.

The gate should verify:

```text
Implementation
+
Tests
+
Security
+
Database correctness
+
API behavior
```

Only then should dependent work be treated as stable.

---

# 27. Critical Path

The Demo's primary technical critical path is:

```text
Repository
→ Foundation
→ Database
→ Auth
→ Tenant
→ Stores
→ Products
→ Inventory
→ Carts
→ Checkout
→ Payments
→ Orders
→ Storefront
→ Full E2E
```

This path should receive the highest development priority.

---

# 28. Secondary Path

Secondary functionality can progress alongside the critical path:

```text
Customers
Media
Notifications
Webhooks
Jobs
```

However, their integration must eventually be validated against the primary commerce lifecycle.

---

# 29. Definition of Implementation Complete

The implementation phase is complete only when:

```text
[ ] All required Demo domains are implemented
[ ] All required APIs are implemented
[ ] PostgreSQL migrations are reproducible
[ ] Authentication is secure
[ ] Authorization is enforced
[ ] Tenant isolation is verified
[ ] Inventory is concurrency-safe
[ ] Checkout is idempotent
[ ] Payments are idempotent
[ ] Orders are durable
[ ] Webhooks are safe
[ ] Jobs are durable
[ ] Required notifications work
[ ] Storefront works
[ ] Media works
[ ] Critical E2E flows pass
[ ] Security tests pass
[ ] Deployment works
[ ] Rollback works
[ ] Documentation matches implementation
```

---

# 30. Final Sequence Rule

The implementation order should be treated as the **default dependency order**, not an excuse to create artificial bureaucracy.

When implementation reveals a genuine dependency that requires reordering:

1. Document the dependency.
2. Update the implementation order.
3. Preserve the architectural boundaries.
4. Continue with the smallest safe change.

The objective is a working, trustworthy Demo, not obedience to a sequence that has become obviously wrong.# Implementation Order

## 1. Purpose

This document defines the required implementation sequence for the Shopify-like Demo.

The order is dependency-driven. Each phase should establish the capabilities required by subsequent phases while keeping the system runnable and verifiable throughout development.

The implementation should progress from **platform foundations → core domains → commerce lifecycle → secondary integrations → full-system verification**.

---

## 2. Implementation Principles

The implementation order follows these rules:

1. Build dependencies before dependents.
2. Establish security before business functionality.
3. Establish database infrastructure before complex persistence.
4. Implement business domains in vertical slices.
5. Verify each major capability before building heavily on top of it.
6. Implement critical correctness before convenience features.
7. Avoid introducing infrastructure before a demonstrated requirement.
8. Keep the application runnable after every major phase.

---

# 3. Phase Overview

```text
Phase 0  Repository & Tooling
    ↓
Phase 1  Application Foundation
    ↓
Phase 2  Database Foundation
    ↓
Phase 3  Authentication & Tenant Foundation
    ↓
Phase 4  Store Management
    ↓
Phase 5  Products
    ↓
Phase 6  Inventory
    ↓
Phase 7  Customers
    ↓
Phase 8  Carts
    ↓
Phase 9  Discounts
    ↓
Phase 10 Checkout
    ↓
Phase 11 Payments
    ↓
Phase 12 Orders
    ↓
Phase 13 Storefront
    ↓
Phase 14 Media
    ↓
Phase 15 Notifications
    ↓
Phase 16 Webhooks
    ↓
Phase 17 Background Jobs
    ↓
Phase 18 Full Integration
    ↓
Phase 19 Demo Verification
```

---

# 4. Phase 0: Repository & Tooling

## Objective

Establish the development environment before application implementation begins.

## Tasks

- Verify pnpm workspace.
- Verify TypeScript configuration.
- Verify package boundaries.
- Verify Next.js application structure.
- Verify Worker application structure.
- Configure linting.
- Configure formatting.
- Configure testing framework.
- Configure Git hooks if required.
- Verify environment variable handling.
- Verify CI baseline.

## Exit Criteria

```text
[ ] pnpm install works
[ ] Web application starts
[ ] Worker application starts
[ ] TypeScript builds
[ ] Linting works
[ ] Unit test runner works
[ ] CI baseline passes
```

---

# 5. Phase 1: Application Foundation

## Objective

Create the shared application infrastructure used by every domain.

## Tasks

- Application bootstrap.
- Shared configuration.
- Logging.
- Error handling.
- Validation.
- Request context.
- API response conventions.
- API versioning.
- Health checks.
- Common types.
- Shared utilities where justified.

## Dependencies

Requires Phase 0.

## Exit Criteria

```text
[ ] Application boots
[ ] Configuration loads
[ ] Health endpoint works
[ ] Error contract works
[ ] Validation infrastructure works
[ ] Request context works
[ ] Logging works
```

---

# 6. Phase 2: Database Foundation

## Objective

Establish PostgreSQL as the authoritative transactional datastore.

## Tasks

- PostgreSQL local environment.
- Database connection.
- Connection pooling.
- Migration framework.
- Transaction helpers.
- Repository conventions.
- Database test environment.
- Initial migration infrastructure.
- Seed infrastructure.

## Dependencies

Requires Phase 1.

## Exit Criteria

```text
[ ] PostgreSQL starts
[ ] Application connects
[ ] Worker connects
[ ] Migrations execute
[ ] Roll-forward workflow works
[ ] Transactions work
[ ] Database integration tests work
```

---

# 7. Phase 3: Authentication & Tenant Foundation

## Objective

Establish secure identity and multi-tenant access before implementing business domains.

## Tasks

### Authentication

- User identity.
- Password authentication where required.
- Session management.
- Login.
- Logout.
- Session resolution.
- Password reset where required.
- Email verification where required.

### Tenant

- Organization.
- Membership.
- Store context foundation.
- Tenant resolution.
- Authorization foundation.
- Role/permission enforcement.

## Dependencies

Requires:

- Phase 1.
- Phase 2.

## Exit Criteria

```text
[ ] User can authenticate
[ ] Session is secure
[ ] Session expiration works
[ ] Tenant context resolves
[ ] Membership is enforced
[ ] Unauthorized Store access is denied
[ ] Cross-tenant access tests pass
```

---

# 8. Phase 4: Stores

## Objective

Implement the Store domain.

## Tasks

- Store creation.
- Store configuration.
- Store lifecycle.
- Store identification.
- Store access.
- Store membership integration.
- Store public configuration.

## Dependencies

Requires:

- Authentication.
- Tenant foundation.
- Database foundation.

## Exit Criteria

```text
[ ] Store can be created
[ ] Store can be configured
[ ] Store lifecycle works
[ ] Store authorization works
[ ] Cross-tenant Store access is prevented
[ ] Store APIs work
```

---

# 9. Phase 5: Products

## Objective

Implement the product catalog.

## Tasks

- Product creation.
- Product updates.
- Product lifecycle.
- Variants.
- SKU.
- Pricing.
- Product media relationships.
- Product publication.
- Product retrieval.
- Product listing.

## Dependencies

Requires:

- Stores.
- Database.
- Authentication/authorization.

## Exit Criteria

```text
[ ] Product can be created
[ ] Variant can be created
[ ] Pricing works
[ ] Product lifecycle works
[ ] Product publication works
[ ] Store scoping works
[ ] Product APIs work
```

---

# 10. Phase 6: Inventory

## Objective

Implement authoritative inventory management.

## Tasks

- Inventory records.
- Stock adjustments.
- Inventory movements.
- Reservations.
- Reservation release.
- Reservation finalization.
- Expiration.
- Concurrency control.

## Dependencies

Requires:

- Stores.
- Products.

## Exit Criteria

```text
[ ] Inventory can be created
[ ] Stock adjustment works
[ ] Available quantity is correct
[ ] Reservation works
[ ] Release works
[ ] Finalization works
[ ] Overselling is prevented
[ ] Concurrency tests pass
```

---

# 11. Phase 7: Customers

## Objective

Implement Store-scoped customer management.

## Tasks

- Customer creation.
- Customer lookup.
- Customer profile.
- Customer addresses.
- Customer status.
- Customer authentication association.
- Customer access rules.

## Dependencies

Requires:

- Stores.
- Authentication.

## Exit Criteria

```text
[ ] Customer can be created
[ ] Customer belongs to correct Store
[ ] Customer profile works
[ ] Address management works
[ ] Customer authorization works
[ ] Cross-tenant access is denied
```

---

# 12. Phase 8: Carts

## Objective

Implement the shopping cart lifecycle.

## Tasks

- Cart creation.
- Guest cart.
- Customer cart.
- Cart retrieval.
- Add item.
- Update quantity.
- Remove item.
- Clear cart.
- Cart expiration.
- Cart ownership.

## Dependencies

Requires:

- Stores.
- Products.
- Customers where authenticated carts are supported.

## Exit Criteria

```text
[ ] Guest cart works
[ ] Customer cart works
[ ] Items can be added
[ ] Quantities can be updated
[ ] Items can be removed
[ ] Cart ownership is secure
[ ] Cart totals are correct
```

---

# 13. Phase 9: Discounts

## Objective

Implement discount definitions and validation.

## Tasks

- Discount creation.
- Discount codes.
- Percentage discounts.
- Fixed discounts.
- Validity windows.
- Minimum order requirements.
- Product/variant eligibility.
- Customer eligibility.
- Usage limits.
- Usage tracking.

## Dependencies

Requires:

- Stores.
- Products.
- Customers.
- Carts.

## Exit Criteria

```text
[ ] Discount can be created
[ ] Code validation works
[ ] Discount calculation works
[ ] Eligibility works
[ ] Usage limits work
[ ] Concurrent usage is safe
[ ] Invalid discounts are rejected
```

---

# 14. Phase 10: Checkout

## Objective

Implement the authoritative purchase preparation and coordination flow.

## Tasks

- Checkout creation.
- Cart validation.
- Product validation.
- Price snapshotting.
- Discount validation.
- Address/contact information.
- Inventory reservation.
- Checkout lifecycle.
- Checkout expiration.
- Checkout completion orchestration.

## Dependencies

Requires:

- Stores.
- Products.
- Inventory.
- Customers.
- Carts.
- Discounts.

## Exit Criteria

```text
[ ] Checkout can be created
[ ] Cart is revalidated
[ ] Pricing is authoritative
[ ] Discounts are revalidated
[ ] Inventory reservation works
[ ] Checkout state machine works
[ ] Concurrent completion is safe
[ ] Checkout expiration works
```

---

# 15. Phase 11: Payments

## Objective

Implement payment state and provider integration.

## Tasks

- Payment entity.
- Payment attempts.
- Provider abstraction.
- Sandbox/test provider.
- Payment initiation.
- Payment state transitions.
- Provider idempotency.
- Refund foundation.
- Payment recovery.

## Dependencies

Requires:

- Checkout.
- Stores.

## Exit Criteria

```text
[ ] Payment can be initiated
[ ] Payment amount is server-controlled
[ ] Payment state transitions work
[ ] Provider adapter works
[ ] Duplicate payment attempts are controlled
[ ] Provider timeout handling works
[ ] Refund foundation works
```

---

# 16. Phase 12: Orders

## Objective

Create durable completed purchases.

## Tasks

- Order creation.
- Order numbering.
- Order items.
- Product snapshots.
- Price snapshots.
- Customer snapshots.
- Address snapshots.
- Order state.
- Payment status.
- Fulfillment status.
- Order history.
- Merchant order management.

## Dependencies

Requires:

- Checkout.
- Payments.
- Inventory.
- Products.
- Customers.
- Discounts.

## Exit Criteria

```text
[ ] Successful checkout can create an Order
[ ] Order creation is idempotent
[ ] Historical snapshots exist
[ ] Order status works
[ ] Payment status works
[ ] Fulfillment status works
[ ] Merchant can view/manage Orders
[ ] Customer can access permitted Orders
```

---

# 17. Phase 13: Storefront

## Objective

Expose the customer-facing shopping experience.

## Tasks

- Store resolution.
- Public Store configuration.
- Product listing.
- Product detail.
- Product visibility.
- Availability display.
- Cart entry.
- Checkout entry.
- Basic SEO behavior.

## Dependencies

Requires:

- Stores.
- Products.
- Inventory.
- Carts.
- Checkout.

## Exit Criteria

```text
[ ] Public Store can be resolved
[ ] Published Products appear
[ ] Unpublished Products are hidden
[ ] Product detail works
[ ] Cart can be created
[ ] Checkout can be started
[ ] Tenant isolation is preserved
```

---

# 18. Phase 14: Media

## Objective

Implement media upload and product media handling.

## Tasks

- Object storage abstraction.
- Media metadata.
- Upload lifecycle.
- File validation.
- Product media association.
- Public/private access.
- Cleanup.

## Dependencies

Requires:

- Stores.
- Products.

## Exit Criteria

```text
[ ] Media can be uploaded
[ ] File validation works
[ ] Media metadata persists
[ ] Product media association works
[ ] Storefront can display public media
[ ] Unauthorized media access is blocked
```

---

# 19. Phase 15: Notifications

## Objective

Implement required transactional notifications.

## Tasks

- Notification records.
- Templates.
- Email provider abstraction.
- Email delivery.
- Notification jobs.
- Retry behavior.
- Notification history.

## Dependencies

Requires:

- Orders.
- Payments.
- Customers.
- Background job foundation where required.

## Exit Criteria

```text
[ ] Required notifications are generated
[ ] Recipient resolution works
[ ] Email provider works
[ ] Delivery failures retry
[ ] Duplicate processing is controlled
[ ] Sensitive data is protected
```

---

# 20. Phase 16: Webhooks

## Objective

Implement reliable external-provider event processing.

## Tasks

- Webhook endpoint.
- Raw-body handling.
- Signature verification.
- Replay protection.
- Event persistence.
- Duplicate detection.
- Provider normalization.
- Payment integration.
- Retry handling.
- Reconciliation where required.

## Dependencies

Requires:

- Payments.
- Database.
- Worker infrastructure.

## Exit Criteria

```text
[ ] Webhook authentication works
[ ] Duplicate events are safe
[ ] Replay protection works
[ ] Payment state updates correctly
[ ] Out-of-order events are safe
[ ] Failed processing retries
```

---

# 21. Phase 17: Background Jobs

## Objective

Complete durable asynchronous processing.

## Tasks

- Job repository.
- Job claiming.
- Worker loop.
- Handler registry.
- Retries.
- Backoff.
- Stale recovery.
- Scheduling.
- Graceful shutdown.
- Job observability.

## Dependencies

The basic Worker application may exist earlier, but domain-specific job processing should be completed after the required domain workflows exist.

## Exit Criteria

```text
[ ] Worker runs
[ ] Jobs persist
[ ] Jobs survive restart
[ ] Concurrent claiming is safe
[ ] Retries work
[ ] Backoff works
[ ] Stale jobs recover
[ ] Graceful shutdown works
```

---

# 22. Phase 18: Full Integration

## Objective

Verify that the complete commerce lifecycle works across module boundaries.

## Primary Flow

```text
Merchant
  ↓
Login
  ↓
Create Store
  ↓
Create Product
  ↓
Create Variant
  ↓
Add Inventory
  ↓
Publish Product
  ↓
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
Discount
  ↓
Inventory Reservation
  ↓
Payment
  ↓
Order
  ↓
Notification
```

## Exit Criteria

The complete lifecycle must execute successfully using real application code and real PostgreSQL transactions.

---

# 23. Phase 19: Demo Verification

## Objective

Verify that the Demo is genuinely usable rather than merely technically complete.

Verification includes:

### Functional

- Merchant workflows.
- Customer workflows.
- Product lifecycle.
- Inventory.
- Checkout.
- Payment.
- Orders.

### Security

- Authentication.
- Authorization.
- Tenant isolation.
- Input validation.
- Session security.
- Webhook security.

### Reliability

- Retry behavior.
- Idempotency.
- Concurrency.
- Worker recovery.
- Database transactions.

### Deployment

- Docker build.
- Production configuration.
- Database migration.
- Web deployment.
- Worker deployment.
- Health checks.
- Rollback.

---

# 24. Parallel Work

Some work can be performed in parallel after its dependencies are established.

For example:

```text
Products
Inventory
Customers
```

may be developed by separate developers once:

```text
Stores
Database
Authentication
Tenant Context
```

are stable.

Similarly:

```text
Media
Notifications
```

can progress independently after their required domain dependencies exist.

Parallel development must not bypass module ownership or shared database conventions.

---

# 25. Work That Must Remain Sequential

The following dependencies should remain explicit:

```text
Authentication
    ↓
Tenant / Authorization
    ↓
Stores
    ↓
Products
    ↓
Inventory
    ↓
Carts
    ↓
Checkout
    ↓
Payments
    ↓
Orders
```

This does not mean every line of code must be completed before the next domain begins. It means the required public contract and foundation must exist before dependent work relies on it.

---

# 26. Verification Gates

Each major phase has a gate.

A phase should not be considered complete merely because implementation exists.

The gate should verify:

```text
Implementation
+
Tests
+
Security
+
Database correctness
+
API behavior
```

Only then should dependent work be treated as stable.

---

# 27. Critical Path

The Demo's primary technical critical path is:

```text
Repository
→ Foundation
→ Database
→ Auth
→ Tenant
→ Stores
→ Products
→ Inventory
→ Carts
→ Checkout
→ Payments
→ Orders
→ Storefront
→ Full E2E
```

This path should receive the highest development priority.

---

# 28. Secondary Path

Secondary functionality can progress alongside the critical path:

```text
Customers
Media
Notifications
Webhooks
Jobs
```

However, their integration must eventually be validated against the primary commerce lifecycle.

---

# 29. Definition of Implementation Complete

The implementation phase is complete only when:

```text
[ ] All required Demo domains are implemented
[ ] All required APIs are implemented
[ ] PostgreSQL migrations are reproducible
[ ] Authentication is secure
[ ] Authorization is enforced
[ ] Tenant isolation is verified
[ ] Inventory is concurrency-safe
[ ] Checkout is idempotent
[ ] Payments are idempotent
[ ] Orders are durable
[ ] Webhooks are safe
[ ] Jobs are durable
[ ] Required notifications work
[ ] Storefront works
[ ] Media works
[ ] Critical E2E flows pass
[ ] Security tests pass
[ ] Deployment works
[ ] Rollback works
[ ] Documentation matches implementation
```

---

# 30. Final Sequence Rule

The implementation order should be treated as the **default dependency order**, not an excuse to create artificial bureaucracy.

When implementation reveals a genuine dependency that requires reordering:

1. Document the dependency.
2. Update the implementation order.
3. Preserve the architectural boundaries.
4. Continue with the smallest safe change.

The objective is a working, trustworthy Demo, not obedience to a sequence that has become obviously wrong.