# Customer Specification

## 1. Purpose

This specification defines the functional and technical requirements for the Customers domain of the Demo commerce platform.

The Customers domain is responsible for:

- Customer identity
- Customer profiles
- Customer-store relationships
- Customer addresses
- Registered customers
- Guest customers
- Customer access to carts, checkout, and orders
- Customer data ownership

The Customers domain does not own:

- Authentication infrastructure
- Merchant memberships
- Products
- Inventory
- Carts
- Checkout
- Payments
- Orders

Those domains interact with Customers through defined interfaces.

---

# 2. Scope

The Demo Customers module must support:

- Customer creation
- Customer profile management
- Registered customers
- Guest customers
- Customer-store association
- Customer email
- Customer name
- Customer phone where required
- Customer addresses
- Address management
- Customer order ownership
- Customer cart ownership
- Customer data isolation
- Merchant customer access

The primary customer lifecycle is:

```text
Customer
   ↓
Create / Identify
   ↓
Maintain Profile
   ↓
Manage Addresses
   ↓
Shop
   ↓
Checkout
   ↓
Order
```

---

# 3. Out of Scope

The Demo Customers module does not include:

- CRM automation
- Customer segmentation
- Loyalty programs
- Customer lifetime value analytics
- Marketing automation
- Advanced customer profiles
- Customer reviews
- Referral systems
- Customer subscriptions
- B2B customer accounts
- Customer organizations
- Advanced GDPR automation
- Customer support ticketing
- Dedicated CRM integration

These may be introduced later when justified.

---

# 4. Domain Ownership

The Customers module owns:

```text id="c7m4x8"
Customer
CustomerAddress
```

It is authoritative for:

- customer identity within a store
- customer profile
- customer addresses
- customer status
- customer-store relationship

Authentication remains owned by the Auth package.

---

# 5. Customer Entity

A Customer represents a shopper's relationship with a Store.

Conceptually:

```text id="x8q3m5"
Customer
├── id
├── store_id
├── user_id (optional)
├── email
├── first_name
├── last_name
├── phone
├── status
├── created_at
└── updated_at
```

A customer always belongs to one Store.

---

# 6. Customer Invariants

The following invariants are mandatory:

1. Every customer belongs to exactly one Store.
2. Customer records cannot cross store boundaries.
3. A registered customer may be associated with a platform user.
4. A guest customer does not require a platform user.
5. Customer email must be normalized consistently.
6. Customer addresses belong to exactly one customer.
7. Customers cannot access another customer's private data.
8. Historical orders must remain valid if the customer profile changes.
9. Customer deletion must not destroy required historical commerce data.
10. Merchant access must be limited to the merchant's Store.

---

# 7. Customer Lifecycle

Demo may use:

```text id="m6x2q8"
ACTIVE
DISABLED
```

Lifecycle:

```text id="v4n8p3"
ACTIVE
   │
   │ disable
   ▼
DISABLED
   │
   │ enable
   ▼
ACTIVE
```

The state machine is defined in:

```text id="q7m3x9"
docs/domain/state-machines.md
```

---

# 8. Registered Customers

A registered customer is associated with a platform user identity.

Conceptually:

```text id="x5m8q2"
User
  ↓
Customer
  ↓
Store
```

The same platform user may be a customer of multiple stores.

Therefore:

```text id="p7n3v8"
User ≠ Customer
```

The User represents authentication identity.

The Customer represents the user's commercial relationship with a particular Store.

---

# 9. Guest Customers

A guest may purchase without creating a platform account.

Conceptually:

```text id="m8x3q6"
Guest Shopper
    ↓
Customer record
    ↓
Checkout
    ↓
Order
```

The exact guest identity model may be simplified for Demo.

Guest customer records must still be store-scoped.

---

# 10. Customer Identification

A customer may be identified through:

- authenticated user
- email
- checkout/session context
- explicit customer reference

The system must not blindly merge customers based only on an unverified identifier.

---

# 11. Customer Email

Email should be normalized before comparison.

Normalization should be consistent across the platform.

At minimum:

- trim surrounding whitespace
- normalize case according to the application's chosen policy

The original display form may be retained if needed, but matching behavior must be deterministic.

---

# 12. Customer Uniqueness

Demo should define a clear policy for duplicate customer records.

A typical rule is:

```text id="q4m7x2"
Store + normalized email
```

identifies the same customer where the customer is registered/known.

However, guest checkout may require a more flexible identity strategy.

The implementation must not accidentally merge unrelated people solely because they entered the same email address without appropriate business rules.

---

# 13. Customer Name

Customer names may include:

```text id="v8m3q5"
first_name
last_name
```

The system should not impose unnecessarily restrictive assumptions about human names.

Validation should focus on:

- maximum length
- valid text
- safe storage/display

---

# 14. Customer Phone

Phone number is optional unless required by a particular checkout configuration.

If stored:

- validate basic structure
- normalize according to the chosen phone format
- avoid assuming a single country format

Phone numbers should not be used as the sole customer identity key.

---

# 15. Customer Address

A CustomerAddress represents an address associated with a customer.

Conceptually:

```text id="n6x2m8"
CustomerAddress
├── id
├── customer_id
├── first_name
├── last_name
├── address_line_1
├── address_line_2
├── city
├── state
├── postal_code
├── country
├── phone
├── label
├── is_default
├── created_at
└── updated_at
```

The exact fields may evolve according to checkout requirements.

---

# 16. Address Ownership

Every address belongs to exactly one Customer.

The system must prevent:

```text id="p3x8m6"
Customer A
    ↓
Address belonging to Customer B
```

A customer may have multiple addresses.

---

# 17. Default Address

A customer may designate a default address.

Demo should enforce:

```text id="x7m4q2"
At most one default address
```

within a customer.

Changing the default should occur transactionally where necessary.

---

# 18. Address Labels

Customers may use labels such as:

```text id="q8m2n5"
Home
Work
Other
```

Labels are presentation-oriented and should not become complex business entities.

---

# 19. Address Validation

Address validation should verify:

- required fields
- valid country code
- reasonable field lengths
- valid postal-code structure where applicable
- safe text input

Demo does not require external address verification.

---

# 20. Historical Addresses

Orders must not depend on mutable CustomerAddress records.

At order creation, the relevant address information should be copied into the OrderAddress snapshot.

Conceptually:

```text id="m5x8q3"
CustomerAddress
      ↓
Checkout
      ↓
OrderAddress snapshot
```

If the customer later changes their address, historical orders remain unchanged.

---

# 21. Customer Profile Updates

A customer may update permitted profile fields.

Typical fields:

```text id="v7q3m8"
first_name
last_name
phone
```

Email changes may require additional verification depending on the authentication model.

---

# 22. Customer Email Change

Changing a registered customer's authentication email must not be treated as a simple profile update.

If the email is also used for authentication, the Auth system must control the identity change.

The Customers domain may update its representation after successful identity verification.

---

# 23. Customer Deactivation

A customer may be disabled.

Disabling should prevent operations that require an active customer account.

It must not delete:

- orders
- payment records
- historical addresses
- required audit information

---

# 24. Customer Reactivation

An authorized operation may transition:

```text id="x8m2q5"
DISABLED → ACTIVE
```

The customer regains normal customer capabilities according to the authentication and authorization model.

---

# 25. Customer Deletion

Hard deletion should not be the default.

A customer may be referenced by:

- carts
- checkouts
- orders
- payments
- discount usage
- notifications

Historical relationships must remain valid.

Demo should prefer deactivation or anonymization strategies where deletion requirements arise.

---

# 26. Customer and Authentication Boundary

The Auth system owns:

- credentials
- sessions
- authentication
- password handling
- authentication tokens

Customers owns:

- commercial profile
- customer-store relationship
- addresses

The two concepts must not be merged into one database/domain abstraction.

---

# 27. Customer and Store Boundary

A Customer belongs to a Store.

Example:

```text id="q6m3x8"
Customer A
   ↓
Store A
```

A different record may represent the same platform user as a customer of Store B:

```text id="p8x2m5"
Customer B
   ↓
Store B
```

This is intentional.

---

# 28. Customer and Cart Boundary

The Carts domain owns the Cart.

Customers provides customer identity.

Conceptually:

```text id="v3m7q9"
Customer
   ↓
customer_id
   ↓
Cart
```

The Customers module must not directly mutate Cart state.

---

# 29. Customer and Checkout Boundary

Checkout may associate a customer.

For registered users:

```text id="x5q8m2"
Authenticated User
    ↓
Customer
    ↓
Checkout
```

Guest checkout may use:

```text id="m7n3x8"
Guest Customer
    ↓
Checkout
```

Checkout owns the purchase process.

---

# 30. Customer and Order Boundary

Orders may reference a Customer.

However, Orders owns the historical transaction.

The Customers module must not modify historical Order state.

---

# 31. Customer and Discount Boundary

Discount eligibility may depend on customer identity.

Examples:

```text id="q8m4x3"
First-order discount
Customer-specific usage limit
```

The Discounts domain owns the rule.

It may query customer information through a public interface.

---

# 32. Customer Access to Orders

A customer may view only their own orders.

The authorization path should be:

```text id="n6x2m8"
Authenticated User
      ↓
Resolve Customer
      ↓
Resolve Store
      ↓
Query Orders
      ↓
Verify customer ownership
```

The client-provided order ID is never sufficient authorization.

---

# 33. Merchant Customer Access

Merchant users may view customers belonging to their Store according to role permissions.

Example:

```text id="p4m8q2"
Store Admin
   ↓
Store A
   ↓
Customers of Store A
```

They must not access:

```text id="v7x3m9"
Store B Customers
```

---

# 34. Customer Listing

Merchant customer listing may support:

```text id="x8m2q5"
search
email
status
created_at
```

Results must remain store-scoped.

Pagination is required for large customer sets.

---

# 35. Customer Detail

Merchant endpoint:

```text id="m3q7x8"
GET /stores/{storeId}/customers/{customerId}
```

The API must verify:

```text id="p6n2m4"
customer.store_id == storeId
```

before returning the customer.

---

# 36. Customer Profile API

Conceptual customer operations:

```text id="q8m3x7"
GET /customers/me
PATCH /customers/me
```

The server derives the customer identity from the authenticated session.

The client should not need to provide another user's customer ID for self-service operations.

---

# 37. Address API

Conceptual endpoints:

```text id="v5m8q2"
GET /customers/me/addresses
POST /customers/me/addresses
PATCH /customers/me/addresses/{addressId}
DELETE /customers/me/addresses/{addressId}
POST /customers/me/addresses/{addressId}/default
```

Each operation must verify ownership.

---

# 38. Merchant Customer API

Conceptual endpoints:

```text id="n7x3m8"
GET /stores/{storeId}/customers
GET /stores/{storeId}/customers/{customerId}
PATCH /stores/{storeId}/customers/{customerId}
POST /stores/{storeId}/customers/{customerId}/disable
POST /stores/{storeId}/customers/{customerId}/enable
```

Exact routing is finalized during implementation.

---

# 39. Customer Creation API

Conceptual endpoint:

```text id="q4m8x2"
POST /stores/{storeId}/customers
```

This may be used by merchant workflows.

Customer self-registration may use a separate storefront/auth flow.

---

# 40. Customer Search

Demo should support basic PostgreSQL-backed search.

Possible fields:

```text id="m6x3q8"
email
first_name
last_name
```

Search must remain:

- store-scoped
- bounded
- indexed where appropriate

A dedicated search engine is not required.

---

# 41. Customer Data Exposure

Customer APIs should expose only necessary information.

For example, a merchant customer view may include:

```text id="v8q2m5"
name
email
phone
addresses
order summary
status
created_at
```

Sensitive authentication information must never be exposed.

---

# 42. Guest Customer Handling

Guest customers should not automatically receive full account capabilities.

If the same email later registers, the platform must use an explicit identity-linking strategy rather than blindly merging records.

Demo may keep guest and registered identity handling deliberately simple.

---

# 43. Customer Merge

Customer merging is outside the initial Demo scope.

Do not implement an automatic merge process merely because duplicate emails appear.

A future merge operation would need to account for:

- orders
- carts
- discount usage
- addresses
- audit history
- identity verification

---

# 44. Customer Privacy

The system should minimize unnecessary exposure of customer information.

Requirements include:

- server-side authorization
- store isolation
- least-privilege access
- limited API responses
- controlled logging
- no unnecessary PII in logs

---

# 45. Customer Logging

Do not log full customer records by default.

Avoid logging:

- full addresses
- authentication credentials
- sensitive customer metadata
- unnecessary contact details

Logs should use IDs and operational metadata where possible.

---

# 46. Customer Events

The Customers domain may publish:

```text id="x7m3q8"
CustomerCreated
CustomerUpdated
CustomerDisabled
CustomerEnabled
CustomerAddressCreated
CustomerAddressUpdated
CustomerAddressDeleted
```

Events represent completed business facts.

---

# 47. Event Consumers

Potential consumers include:

```text id="q5m8x2"
CustomerCreated
    ↓
Notification / onboarding

CustomerUpdated
    ↓
Secondary read models

CustomerDisabled
    ↓
Block relevant customer workflows
```

Consumers must be idempotent.

---

# 48. Customer Transaction Requirements

The following operations may require transactions:

- customer creation with related records
- default address changes
- customer disablement with dependent state changes
- identity linking
- critical address updates

The transaction boundary belongs to the application service.

---

# 49. Address Default Concurrency

Two concurrent requests may attempt:

```text id="m8x3q7"
Address A → default
Address B → default
```

The final state must contain at most one default address.

This should be enforced through transactional logic and, where practical, database constraints.

---

# 50. Customer Access Concurrency

Customer profile updates must not cause lost updates where simultaneous edits are possible.

Optimistic concurrency may be used if required by the merchant/customer UI.

Demo may rely on standard transactional updates where conflicts are unlikely.

---

# 51. Customer Error Conditions

The domain should expose meaningful errors such as:

```text id="v4m8q2"
CUSTOMER_NOT_FOUND
CUSTOMER_DISABLED
CUSTOMER_ALREADY_EXISTS
CUSTOMER_ACCESS_DENIED
ADDRESS_NOT_FOUND
ADDRESS_ACCESS_DENIED
INVALID_ADDRESS
DEFAULT_ADDRESS_CONFLICT
INVALID_CUSTOMER_STATE
CROSS_STORE_CUSTOMER_ACCESS
```

---

# 52. Authorization Matrix

| Operation | Owner | Admin | Staff | Customer |
|---|---:|---:|---:|---:|
| View store customers | Yes | Yes | Yes | No |
| View customer details | Yes | Yes | Yes | Own only |
| Create customer | Yes | Yes | Yes | Self |
| Update customer | Yes | Yes | Yes | Own only |
| Disable customer | Yes | Yes | Policy | No |
| Manage own addresses | No | No | No | Own only |
| View own orders | No | No | No | Own only |

Exact permissions remain subject to centralized authorization rules.

---

# 53. Tenant Isolation

Every Customer operation must validate:

```text id="q7m3x8"
customer.store_id
=
current store context
```

A user associated with Store A must not access Store B customer records through:

- URL manipulation
- request body manipulation
- query manipulation
- guessed IDs
- API replay

---

# 54. Database Constraints

The database should reinforce:

- customer → store foreign key
- address → customer foreign key
- valid user association where applicable
- unique/default-address rules
- appropriate store-scoped uniqueness

Application validation remains required.

---

# 55. Performance

Demo customer queries should use:

- store-scoped indexes
- email lookup indexes
- bounded pagination
- customer ID lookup
- address customer ID indexes

Customer data does not justify a separate search service.

---

# 56. Caching

Customer information may be cached in future versions.

However:

```text id="x5m8q3"
Cache ≠ authorization source
```

Cached data must never bypass:

- tenant checks
- ownership checks
- current customer status

Demo does not require customer caching.

---

# 57. Background Processing

Customer background jobs may include:

- notification delivery
- cleanup
- future data processing

Workers must use Customers application services rather than directly modifying customer records.

---

# 58. Testing Requirements

## Customer Tests

- create customer
- update customer
- disable customer
- enable customer
- duplicate handling
- registered customer association
- guest customer behavior

## Address Tests

- create address
- update address
- delete address
- default address
- multiple addresses
- ownership validation
- concurrent default changes

---

# 59. Integration Tests

Integration tests should verify:

- customer/store relationship
- customer/user relationship
- address persistence
- customer isolation
- merchant authorization
- customer self-access
- disabled customer behavior
- historical order independence

---

# 60. Tenant Isolation Tests

At minimum:

```text id="v8m2q6"
Customer from Store A
    ↓
Store A API
    ↓
Allowed
```

and:

```text id="m3x7q9"
Customer from Store A
    ↓
Store B API
    ↓
Rejected
```

Also test merchant access:

```text id="q5n8x2"
Store A Staff
    ↓
Store B Customer
    ↓
Rejected
```

---

# 61. E2E Customer Flow

At minimum:

```text id="x7m4q8"
Customer visits Storefront
    ↓
Registers / continues as guest
    ↓
Creates or resolves Customer
    ↓
Adds Address
    ↓
Adds Product to Cart
    ↓
Begins Checkout
    ↓
Completes Purchase
    ↓
Views Order
```

This validates integration with Storefront, Cart, Checkout, and Orders.

---

# 62. Historical Data

Customer profile changes must not alter historical commerce records.

Example:

```text id="p8m3q5"
Customer name:
"Aashif"

Order created

Customer later changes name

Historical Order:
"Aashif"
```

The Order domain owns the historical snapshot.

---

# 63. Customer and Data Retention

Customer deletion or anonymization must be designed around historical transaction requirements.

A customer record cannot simply be deleted if it would break:

- foreign keys
- order history
- payment references
- financial records
- audit requirements

Demo should prefer controlled deactivation unless a specific deletion requirement exists.

---

# 64. Demo Implementation Boundary

The Demo implementation should use:

```text id="n6x2m8"
modules/customers
packages/auth
packages/tenant
packages/db
packages/validation
```

The Customers module owns customer business rules.

The Auth package owns authentication.

The web layer owns HTTP handling.

The database package owns persistence infrastructure.

---

# 65. Demo-to-V1 Evolution

The Customers domain should allow future additions such as:

- customer groups
- segmentation
- loyalty
- marketing preferences
- CRM integration
- B2B customers
- customer organizations
- advanced privacy workflows
- customer merge tooling

These capabilities should be added without changing the fundamental store-scoped customer model.

---

# 66. Acceptance Criteria

The Customers module is complete for Demo when:

- Customers can be created.
- Customers belong to exactly one store.
- Registered customers may be associated with authenticated users.
- Guest customers can participate in supported commerce flows.
- Customer profiles can be updated.
- Customer addresses can be created and managed.
- At most one default address exists per customer.
- Customer self-access is limited to the authenticated customer's data.
- Merchant access is limited to the merchant's store.
- Customer status transitions are enforced.
- Disabled customers cannot perform prohibited operations.
- Historical orders remain valid after customer changes.
- Customer records are not blindly deleted when historical dependencies exist.
- Customer data is not exposed across stores.
- Customer APIs use explicit authorization and validation.
- Critical address operations are concurrency-safe.
- Integration and E2E tests cover the primary customer lifecycle.