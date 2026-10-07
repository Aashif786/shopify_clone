# Demo Scope

## 1. Purpose

The Demo is a functional implementation of a Shopify-like commerce platform.

It is intended to demonstrate the complete core commerce lifecycle from store setup through product management, storefront browsing, cart, checkout, payment, and order management.

The Demo must use real application logic and a real transactional database.

It is not a UI prototype or a collection of mocked screens.

---

## 2. Primary Goal

The Demo must prove that the platform can reliably support the following lifecycle:

```text
Create Store
    ↓
Configure Store
    ↓
Create Products
    ↓
Manage Inventory
    ↓
Publish Products
    ↓
Customer Visits Storefront
    ↓
Browse Products
    ↓
Add to Cart
    ↓
Checkout
    ↓
Payment
    ↓
Order Created
    ↓
Merchant Manages Order
```

The complete supported flow must work end-to-end.

---

## 3. Demo Users

The Demo supports two primary user categories:

### Merchant

A merchant can:

- access their store
- manage products
- manage inventory
- view customers
- view and manage orders
- configure basic store settings
- manage applicable discounts

### Customer

A customer can:

- browse a storefront
- view products
- select product variants
- add products to a cart
- update cart quantities
- proceed through checkout
- complete payment through the supported payment flow
- receive an order confirmation
- view relevant order information

The exact permissions and roles are defined separately in `docs/product/user-roles.md`.

---

## 4. Core Demo Capabilities

### 4.1 Store Management

The platform must support:

- store creation
- basic store configuration
- store status
- store ownership
- merchant access
- basic storefront configuration

---

### 4.2 Product Management

Merchants must be able to:

- create products
- edit products
- publish/unpublish products
- manage product descriptions
- manage product images
- define pricing
- define product variants
- manage product status

Products must belong to the appropriate store.

---

### 4.3 Inventory

The Demo must support basic inventory management.

Required capabilities:

- inventory quantity
- inventory availability
- stock adjustments
- inventory validation during checkout
- inventory deduction after successful order creation
- prevention of invalid inventory states

Inventory behavior must remain safe under concurrent checkout attempts.

---

### 4.4 Customer Management

The Demo must support:

- customer creation
- customer identification
- customer contact information
- customer addresses required for checkout
- customer order history

Customer data must remain isolated between stores.

---

### 4.5 Storefront

Customers must be able to access a store's storefront and:

- browse published products
- view product details
- select variants
- view pricing
- view availability
- add products to cart

Unpublished products must not appear as purchasable storefront products.

---

### 4.6 Cart

The Demo must support:

- creating a cart
- adding products
- adding variants
- changing quantities
- removing items
- calculating cart totals
- validating product availability

The server must be authoritative for prices, availability, and totals.

Client-provided prices must never be trusted.

---

### 4.7 Checkout

Checkout must:

- validate the cart
- validate product availability
- validate inventory
- calculate authoritative pricing
- apply valid discounts where supported
- collect required customer information
- create the appropriate order
- initiate payment

Checkout must prevent invalid or duplicate order creation.

---

### 4.8 Payments

The Demo must integrate with a supported payment provider using an appropriate test/sandbox environment.

Required capabilities:

- initiate payment
- process payment result
- handle payment success
- handle payment failure
- process payment webhooks
- prevent duplicate webhook effects
- associate payments with the correct order/store

Payment processing must support safe retries.

No real production payment credentials are required for the Demo.

---

### 4.9 Orders

The Demo must support:

- order creation
- order details
- order items
- order totals
- payment status
- order status
- customer association
- store association
- merchant order viewing
- basic order status updates

Order state transitions must be explicit and validated.

---

### 4.10 Discounts

The Demo may support a limited discount system.

Supported functionality should include the ability to:

- create a discount
- activate/deactivate a discount
- define basic discount rules
- validate eligibility
- apply the discount during checkout

Complex promotion engines are outside the Demo scope.

---

## 5. Multi-Tenancy

The Demo must support multiple stores within the same platform.

A merchant must only be able to access resources belonging to stores they are authorized to access.

Store-owned resources include, where applicable:

- products
- variants
- inventory
- customers
- carts
- orders
- payments
- discounts
- store configuration

Cross-store data access is not supported.

Tenant isolation is a core Demo requirement, not a V1-only feature.

---

## 6. Authentication and Authorization

The Demo must provide authenticated merchant access.

Protected merchant operations must require appropriate authorization.

Authorization must be enforced server-side.

The Demo must establish the same fundamental identity and access model required for future V1 expansion.

Advanced enterprise identity features are outside Demo scope.

---

## 7. Background Processing

The Demo may use background processing for operations that do not need to block the main request.

Examples include:

- email delivery
- asynchronous notifications
- retryable webhook processing
- cleanup jobs
- non-critical integrations

Background processing must not compromise data correctness.

---

## 8. Notifications

The Demo may provide basic transactional notifications such as:

- order confirmation
- payment confirmation
- merchant order notification

Advanced notification preferences, campaigns, marketing automation, and multi-channel messaging are outside the Demo scope.

---

## 9. Media

The Demo must support basic product/store media where required.

Media should be stored outside the transactional database using an appropriate object-storage approach.

Advanced media processing is outside scope.

---

## 10. Search

The Demo does not require a dedicated search engine.

Basic product discovery may use the primary database.

Dedicated search infrastructure is a future scalability concern unless actual Demo requirements prove otherwise.

---

## 11. Analytics

The Demo does not require a dedicated analytics warehouse or advanced analytics platform.

Basic operational or business metrics may be collected where useful.

Advanced analytics, recommendation systems, customer intelligence, and data warehousing are outside scope.

---

## 12. Infrastructure

The Demo must be deployable as a real application.

The infrastructure should remain intentionally simple.

Required characteristics:

- containerized application
- PostgreSQL
- environment-based configuration
- secure secrets handling
- basic CI/CD
- staging/demo environment separation
- basic application monitoring
- error reporting
- database backup strategy

The Demo does not require:

- Kubernetes
- multi-region deployment
- active-active infrastructure
- database sharding
- complex service meshes
- enterprise-scale orchestration

---

## 13. Testing Requirements

The Demo must provide automated coverage for critical functionality.

Required coverage includes:

- domain/business rules
- database behavior where important
- authentication and authorization
- tenant isolation
- inventory correctness
- checkout
- payment handling
- order creation
- critical storefront flows

Critical end-to-end commerce flows must be tested.

---

## 14. Demo Quality Bar

The Demo must be:

- functionally complete within its defined scope
- internally consistent
- tenant-safe
- testable
- deployable
- maintainable
- suitable for stakeholder demonstration

The Demo may simplify infrastructure and operational capabilities.

It must **not** simplify core correctness.

In particular, the following must be treated as production-quality foundations even in the Demo:

- tenant isolation
- authorization
- database integrity
- inventory correctness
- payment correctness
- order correctness
- idempotency
- input validation
- critical security controls

---

## 15. Explicitly Outside Demo Scope

The following are not required for the Demo:

- public app marketplace
- developer marketplace
- advanced theme language
- POS
- B2B commerce
- subscriptions
- advanced tax engines
- advanced shipping engines
- multi-region commerce
- database sharding
- advanced fraud detection
- recommendation/ML systems
- enterprise analytics warehouse
- complex workflow automation platform
- advanced internationalization
- advanced localization
- enterprise SSO
- complex organization hierarchies
- multi-provider infrastructure orchestration

These may be considered during V1 planning.

---

## 16. Demo-to-V1 Principle

The Demo is not intended to contain the full V1 infrastructure.

However, the following must be designed correctly from the beginning:

```text
Domain model
Business rules
Database integrity
Tenant isolation
Authorization
API boundaries
Order lifecycle
Payment lifecycle
Inventory correctness
Idempotency
Testing strategy
```

Infrastructure may evolve.

Core business correctness should not require a rewrite.