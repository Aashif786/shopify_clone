# Customer Implementation Specification

## 1. Purpose

This document defines the implementation requirements for the **Customers** domain of the Shopify-like commerce platform.

The Customers module manages customer profiles, store-scoped customer identity, contact information, addresses, and customer-related lifecycle behavior.

Customer data is strictly tenant-scoped. A customer belonging to one Store must never become accessible to another Store unless an explicitly defined future organization-level capability permits it.

---

## 2. Scope

The Customers module owns:

- Customer records.
- Store-scoped customer identity.
- Customer profile information.
- Customer contact information.
- Customer addresses.
- Customer account association where applicable.
- Customer lifecycle state.
- Customer lookup.
- Customer address management.

The module does not own:

- Authentication infrastructure.
- Merchant users.
- Orders.
- Payments.
- Checkout.
- Carts.
- Marketing campaigns.
- Product data.

Those domains interact with Customers through explicit interfaces.

---

## 3. Domain Position

The primary relationship is:

```text id="n7c4x2"
Organization
    ↓
Store
    ↓
Customer
    ├── Addresses
    ├── Carts
    └── Orders
```

Customer identity is Store-scoped in the Demo.

The same person may therefore exist as separate customer records across different Stores.

---

## 4. Module Location

The implementation belongs under:

```text id="x4m8q1"
modules/customers/
```

Recommended structure:

```text id="p6v2k9"
modules/customers/
├── application/
├── domain/
├── infrastructure/
└── index.ts
```

The module's public interface should be exposed through its module entry point.

---

## 5. Layer Responsibilities

### Presentation

Responsible for:

- Authentication/session handling.
- Tenant resolution.
- Authorization.
- Request validation.
- DTO mapping.
- HTTP responses.

### Application

Responsible for:

- Customer use cases.
- Customer lookup.
- Address operations.
- Transaction boundaries.
- Coordination with authentication where required.

### Domain

Responsible for:

- Customer entity.
- Address value/entity model.
- Customer lifecycle rules.
- Customer invariants.

### Infrastructure

Responsible for:

- PostgreSQL persistence.
- Repository implementations.
- Customer queries.
- Address persistence.

---

## 6. Customer Entity

Conceptually:

```text id="r3k8m5"
Customer
├── id
├── storeId
├── email
├── firstName
├── lastName
├── phone
├── status
├── createdAt
└── updatedAt
```

The exact persistence structure may contain additional fields.

---

## 7. Customer Identity

Every Customer must have a stable internal identifier.

The identifier:

- Is generated server-side.
- Is immutable.
- Is not derived from email.
- Is not controlled by the client.
- Is used for internal relationships.

Email may be used for lookup but must not be treated as the primary identity.

---

## 8. Store Ownership

Every Customer belongs to exactly one Store.

The database must enforce this relationship.

All customer queries must include the correct Store context.

A customer ID alone must never be treated as proof of access.

---

## 9. Customer Status

The Demo may use explicit customer lifecycle states such as:

```text id="f8q2v6"
ACTIVE
DISABLED
```

The exact state model must remain aligned with the product requirements.

---

## 10. Customer Creation

Customer creation may occur through:

- Customer registration.
- Guest checkout conversion.
- Merchant-created customer.
- Internal customer import where later supported.

The creation flow must identify the correct Store before creating the Customer.

---

## 11. Customer Registration

For an authenticated customer account:

```text id="m5x7c2"
Authentication
    ↓
Resolve Store
    ↓
Validate customer data
    ↓
Create/associate Customer
    ↓
Commit
```

Authentication identity and Store customer identity should remain conceptually separate.

---

## 12. Guest Customers

The Demo may support guest checkout.

A guest checkout does not necessarily require a permanent Customer account.

If the checkout creates a customer record, the implementation must clearly distinguish:

```text id="q4n8p1"
Guest customer record
```

from:

```text id="v7m2x5"
Authenticated customer account
```

The exact behavior must follow the checkout specification.

---

## 13. Authentication Relationship

The Customers module should not own passwords, sessions, authentication tokens, or credential storage.

Authentication belongs to the authentication system.

The relationship may be:

```text id="c8m3r6"
Auth Identity
      ↓
Customer association
      ↓
Store-scoped Customer
```

The association must not allow cross-tenant access.

---

## 14. Email

Email may be used as a customer contact and lookup field.

Requirements:

- Normalize according to the platform's email rules.
- Validate format.
- Enforce reasonable length.
- Define uniqueness behavior explicitly.

If customer email uniqueness is required, it should be scoped appropriately to the Store.

---

## 15. Email Uniqueness

The Demo should normally prevent duplicate active customer identities for the same Store where customer accounts are email-based.

Example:

```text id="w5q9k3"
Store A
john@example.com → Customer 1

Store A
john@example.com → Customer 2
```

should normally be prevented when the business model treats email as the account identity.

Across Stores:

```text id="y8n2m6"
Store A → john@example.com
Store B → john@example.com
```

may be valid.

---

## 16. Customer Name

Customer names are profile data.

The implementation should:

- Validate reasonable length.
- Support Unicode.
- Avoid treating names as identifiers.
- Preserve user-entered values appropriately.

---

## 17. Phone Number

If supported, phone numbers should be:

- Validated.
- Normalized where appropriate.
- Stored as contact data.
- Protected from unnecessary exposure.

Phone numbers must not be used as an authorization credential.

---

## 18. Customer Addresses

A Customer may have multiple addresses.

Conceptually:

```text id="m9p4x7"
Customer
  ├── Address
  ├── Address
  └── Address
```

Addresses should support their intended role, such as:

- Shipping.
- Billing.

---

## 19. Address Entity

Conceptually:

```text id="k3v8n1"
Address
├── id
├── customerId
├── name
├── line1
├── line2
├── city
├── state
├── postalCode
├── country
├── phone
└── timestamps
```

The exact fields depend on the supported geography and checkout requirements.

---

## 20. Address Ownership

An address belongs to exactly one Customer.

Access must therefore follow:

```text id="z6q2m8"
Store
  ↓
Customer
  ↓
Address
```

A caller must not access an address by guessing its ID.

---

## 21. Address Validation

Address validation should include:

- Required fields.
- Length limits.
- Country format.
- Postal code format where applicable.
- Reasonable field sizes.
- Supported country/region values.

The Demo does not require a global address-validation provider unless a real requirement emerges.

---

## 22. Default Address

If the Demo supports default addresses, there must be a clear invariant:

```text id="p8c4x1"
At most one default shipping address
At most one default billing address
```

This should be enforced through application logic and appropriate database constraints where practical.

---

## 23. Address Updates

Updating an address must:

1. Authenticate the caller where required.
2. Resolve Store.
3. Resolve Customer.
4. Verify ownership.
5. Validate input.
6. Apply the update.
7. Commit.

---

## 24. Address Deletion

An address may be removed if it is not required by an active business operation.

Historical orders must not depend on mutable Customer addresses.

Orders must retain appropriate address snapshots.

---

## 25. Order Address Snapshot

Customer addresses may change after an order is created.

Therefore:

```text id="x5n7c3"
Customer Address
       ↓
Order Created
       ↓
Order Address Snapshot
```

Changing the Customer's address must not change the historical order address.

---

## 26. Customer Lookup

Merchant customer lookup may support:

- Customer ID.
- Email.
- Name where appropriate.
- Phone where supported.

Search must always be Store-scoped.

---

## 27. Customer Listing

Customer listing must use bounded pagination.

Possible filters include:

- Status.
- Email.
- Created date.
- Name.

Only explicitly supported filters may be accepted.

---

## 28. Customer Search

The Demo does not require a dedicated search engine.

Basic PostgreSQL queries may support customer lookup.

Search implementation should remain bounded and indexed appropriately.

A dedicated search system can be introduced later if actual scale requires it.

---

## 29. Customer Data Exposure

Customer information is sensitive business data.

The API should return only fields required by the requesting operation.

Examples of data requiring careful handling:

- Email.
- Phone.
- Address.
- Order history.

---

## 30. Authorization

Customer permissions should distinguish merchant and customer access.

Examples:

```text id="f7m2k8"
customers.read
customers.create
customers.update
customers.manage
```

A customer should normally be able to access only their own customer profile.

A merchant may access Customers belonging to the authorized Store according to their permissions.

---

## 31. Customer Self-Service

Customer-facing operations should resolve the Customer from authenticated identity and Store context.

The client should not be able to change the effective Customer ID simply by submitting another ID.

---

## 32. Merchant Customer Access

Merchant operations should follow:

```text id="b4q9m1"
Authenticated merchant
       ↓
Authorized Store
       ↓
Customer belongs to Store
       ↓
Permission check
       ↓
Operation
```

---

## 33. Tenant Isolation

Tenant isolation is mandatory.

The following must be denied:

```text id="j7x3n5"
Store A merchant
      ↓
Store B customer
```

This applies to:

- Customer listing.
- Customer retrieval.
- Customer updates.
- Address access.
- Customer creation.
- Customer order-related access.

---

## 34. Customer Deactivation

If customers need to be disabled, the system should use a lifecycle state rather than deleting historical data.

A disabled Customer should not necessarily be able to:

- Authenticate as a customer.
- Start new customer-specific operations.

Existing historical orders should remain intact.

---

## 35. Customer Deletion

Physical deletion should not be the default behavior.

Customer data may be referenced by:

- Orders.
- Payments.
- Checkout records.
- Audit records.
- Legal/financial records.

Deletion requirements must therefore follow explicit retention and privacy rules.

---

## 36. Privacy

Customer data must be handled according to applicable privacy requirements.

The platform should support future privacy operations without destroying financial/order integrity.

Potential future capabilities include:

- Data export.
- Data anonymization.
- Account deletion.
- Consent management.

These are not necessarily required for the Demo.

---

## 37. API Endpoints

Potential merchant endpoints:

```text id="q2m7x4"
GET    /api/v1/customers
POST   /api/v1/customers
GET    /api/v1/customers/{customerId}
PATCH  /api/v1/customers/{customerId}

GET    /api/v1/customers/{customerId}/addresses
POST   /api/v1/customers/{customerId}/addresses
PATCH  /api/v1/customers/{customerId}/addresses/{addressId}
DELETE /api/v1/customers/{customerId}/addresses/{addressId}
```

Customer self-service routes may use a separate resource context where appropriate.

The final API surface must follow the API contract.

---

## 38. Customer Creation Idempotency

Customer creation may require idempotency when the operation can be safely retried.

For account registration, email uniqueness and account association may provide part of the protection.

Where creation has additional side effects, explicit idempotency should be used.

---

## 39. Transactions

Transactions should be used when multiple Customer-owned records must change atomically.

Examples:

```text id="r8m3q6"
Create Customer
+
Create default address
+
Create required account association
```

The transaction must remain short.

---

## 40. Concurrency

Concurrency considerations include:

- Two requests creating the same email.
- Two requests setting different default addresses.
- Concurrent Customer updates.
- Concurrent address modifications.

Database uniqueness and transactional logic must protect relevant invariants.

---

## 41. Unique Constraints

Potential constraints include:

```text id="x9k4v2"
(store_id, normalized_email)
```

where customer account uniqueness is required.

Address default invariants may require additional mechanisms depending on the schema.

---

## 42. Database Indexing

Likely query patterns include:

```text id="c7m2p8"
store_id
store_id + email
store_id + created_at
customer_id
customer_id + address
```

Indexes should be based on actual access patterns.

---

## 43. Customer Events

The module may emit events such as:

```text id="n5q8r3"
CustomerCreated
CustomerUpdated
CustomerDisabled
CustomerAddressAdded
CustomerAddressUpdated
CustomerAddressRemoved
```

Events must represent completed facts.

---

## 44. Event Consumers

Potential consumers include:

- Notifications.
- Orders.
- Checkout.
- Customer communication.
- Future analytics.

Consumers must use public interfaces rather than accessing Customer tables directly.

---

## 45. Checkout Interaction

Checkout may use Customer information for:

- Contact information.
- Shipping address.
- Billing address.

Checkout must snapshot information required for the transaction where appropriate.

It must not assume that a mutable Customer address remains unchanged after checkout.

---

## 46. Cart Interaction

A Cart may optionally belong to a Customer.

The Cart module owns cart state.

Customers provides the identity relationship.

The Customers module must not directly manage cart contents.

---

## 47. Order Interaction

Orders reference the relevant Customer identity when applicable.

Orders remain responsible for historical order data.

Deleting or updating a Customer must not invalidate existing orders.

---

## 48. Error Handling

Potential stable error codes include:

```text id="v4k7m2"
CUSTOMER_NOT_FOUND
CUSTOMER_ACCESS_DENIED
CUSTOMER_ALREADY_EXISTS
INVALID_CUSTOMER_EMAIL
INVALID_CUSTOMER_STATUS
ADDRESS_NOT_FOUND
ADDRESS_ACCESS_DENIED
INVALID_ADDRESS
DEFAULT_ADDRESS_CONFLICT
```

Internal database errors must not be exposed directly.

---

## 49. Testing Strategy

### Unit Tests

Test:

- Customer validation.
- Customer lifecycle.
- Address validation.
- Default-address rules.

### Integration Tests

Test:

- Customer persistence.
- Email uniqueness.
- Address relationships.
- Tenant isolation.
- Transactions.
- Concurrent creation.

### API Tests

Test:

- Authentication.
- Authorization.
- Customer listing.
- Customer retrieval.
- Address operations.
- Pagination.
- Error responses.

### E2E Tests

Test:

- Customer registration.
- Customer profile.
- Address management.
- Guest checkout behavior where supported.
- Merchant customer management.

---

## 50. Critical Test Cases

```text id="j3n8q5"
[ ] Customer belongs to correct Store
[ ] Cross-tenant customer access is denied
[ ] Customer email uniqueness works correctly
[ ] Authorized merchant can create Customer
[ ] Unauthorized merchant cannot create Customer
[ ] Customer can access only own profile
[ ] Address belongs to correct Customer
[ ] Cross-tenant address access is denied
[ ] Default address invariant is preserved
[ ] Concurrent customer creation is safe
[ ] Historical order address is unaffected by customer address changes
[ ] Customer deletion/deactivation does not corrupt historical orders
[ ] Pagination is bounded
[ ] Sensitive customer data is not exposed unnecessarily
```

---

## 51. Implementation Sequence

Recommended implementation order:

```text id="m8x4q7"
1. Define Customer domain model
2. Define Customer lifecycle
3. Define Address model
4. Define authentication association
5. Define persistence schema
6. Create migrations
7. Implement repository
8. Implement Customer application services
9. Implement Address services
10. Implement authorization
11. Implement validation
12. Implement APIs
13. Integrate with Checkout/Orders
14. Add events where required
15. Add unit tests
16. Add integration tests
17. Add API tests
18. Add E2E tests
19. Verify tenant isolation
```

---

## 52. Demo Simplifications

The Demo intentionally does not require:

- Advanced CRM.
- Customer segmentation.
- Marketing automation.
- Loyalty programs.
- Customer lifetime-value analytics.
- Enterprise customer hierarchies.
- Advanced consent management.
- External CRM synchronization.
- Global customer identity across Stores.

The core Store-scoped Customer model must remain correct.

---

## 53. V1 Evolution

The Customers module can later support:

- Advanced customer profiles.
- Customer groups.
- Segmentation.
- Marketing preferences.
- Loyalty.
- Customer import/export.
- Privacy workflows.
- Organization-level customer identity.
- External CRM integrations.

These should extend the module without bypassing its tenant boundary.

---

## 54. Definition of Done

The Customers implementation is complete when:

```text id="t6p9m3"
[ ] Customer entity exists
[ ] Store ownership is enforced
[ ] Customer lifecycle exists
[ ] Authentication association is defined
[ ] Customer profile is implemented
[ ] Email validation exists
[ ] Email uniqueness is enforced where required
[ ] Address management exists
[ ] Default address rules exist where supported
[ ] Customer APIs exist
[ ] Authentication is enforced
[ ] Authorization is enforced
[ ] Customer self-service is tenant-safe
[ ] Tenant isolation is enforced
[ ] Historical order data remains stable
[ ] Database constraints exist
[ ] Appropriate indexes exist
[ ] Concurrency cases are handled
[ ] Idempotency is applied where required
[ ] Privacy-sensitive data is protected
[ ] Unit tests exist
[ ] Integration tests exist
[ ] API tests exist
[ ] E2E coverage exists
[ ] Documentation matches implementation
```