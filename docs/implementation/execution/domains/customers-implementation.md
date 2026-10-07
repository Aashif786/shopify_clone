# Customers Implementation

## 1. Purpose

This document defines the concrete implementation of the Customer domain for the Demo.

The Customer domain manages customer records belonging to individual Stores.

It owns:

- Customer profiles.
- Store-scoped customer identity.
- Customer contact information.
- Customer addresses.
- Customer lifecycle.
- Customer lookup.
- Customer associations required by commerce workflows.

It does not own:

- Authentication credentials.
- Merchant memberships.
- Cart state.
- Checkout state.
- Payment state.
- Order lifecycle.

---

# 2. Domain Ownership

Customer implementation belongs to:

```text
modules/customers
```

The module may use:

```text
packages/db
packages/tenant
packages/types
packages/validation
```

Authentication remains owned by `packages/auth`.

Customer data must not become a second authentication system.

---

# 3. Customer Ownership Model

Customers are Store-scoped.

```text
Organization
    ↓
Store
    ↓
Customer
```

A customer belonging to Store A must not automatically exist as a customer of Store B.

---

# 4. Customer Model

A Customer record may contain:

```text
id
store_id
email
first_name
last_name
phone
status
created_at
updated_at
```

The exact fields must follow the customer specification.

---

# 5. Customer Identity

Customer identity within a Store should be deterministic.

Where email is used as a customer identifier, the implementation should apply the project's email normalization policy consistently.

Do not assume email addresses are globally unique across all Stores.

---

# 6. Authentication Relationship

A Customer may be associated with an authenticated User where the product requirements support customer accounts.

The relationship should remain explicit:

```text
User
  ↓
Customer association
  ↓
Store
```

Authentication answers:

> Who is this person?

Customer data answers:

> What customer record does this person have in this Store?

---

# 7. Guest Customers

Checkout may support guest purchasing according to the Demo requirements.

A guest checkout must not require creation of a permanent customer account unless explicitly required.

If a customer record is created during guest checkout, its lifecycle must be clearly defined.

---

# 8. Customer Creation

Customer creation should follow:

```text
Authenticated or Checkout Context
        ↓
Store Resolution
        ↓
Validate Customer Data
        ↓
Normalize Identity
        ↓
Create Customer
        ↓
Commit
```

The operation must be Store-scoped.

---

# 9. Customer Lookup

Customer lookup should support appropriate Store-scoped identifiers.

Possible lookup fields:

```text
Customer ID
Email
Phone
```

Only supported lookup mechanisms should be exposed.

Queries must always include Store scope where required.

---

# 10. Customer Listing

Merchant customer listing may support:

- Pagination.
- Basic filtering.
- Search.
- Sorting.

All queries must be restricted to the current Store.

Do not load all customers and filter them in application memory.

---

# 11. Customer Profile

The Customer profile may contain:

```text
First name
Last name
Email
Phone
Status
```

Only appropriate fields should be exposed through each API context.

---

# 12. Customer Addresses

Customers may have one or more addresses.

An address should contain the information required by the Store's commerce workflow, such as:

```text
id
customer_id
label
full_name
address_line_1
address_line_2
city
state
postal_code
country
phone
created_at
updated_at
```

Exact fields should follow the specification.

---

# 13. Address Ownership

Every Customer Address must belong to exactly one Customer.

The application must also verify that the Customer belongs to the current Store.

The following relationship must never be possible:

```text
Store A
  ↓
Customer A
  ↓
Address belonging to Customer B
```

---

# 14. Default Address

If the Demo supports default addresses, the implementation must ensure that a Customer cannot have multiple conflicting default addresses.

This can be enforced through:

- Transactional application logic.
- Database constraints/indexes where appropriate.

---

# 15. Address Validation

Address validation should establish structural correctness.

Validate:

- Required fields.
- Maximum lengths.
- Postal code format appropriate to supported countries.
- Country codes.
- Phone format where required.

Complex shipping-address validation is outside Demo scope unless explicitly required.

---

# 16. Customer Status

Customer lifecycle should use explicit states where needed.

Example:

```text
Active
Archived
```

The exact status model follows the customer specification.

---

# 17. Customer Archival

If a Customer is archived:

- Historical Orders remain intact.
- Historical Order customer snapshots remain unchanged.
- Existing financial records remain unaffected.
- New commerce operations follow the defined customer policy.

Do not physically delete customer data merely to represent an inactive customer.

---

# 18. Customer Privacy

Customer information is sensitive application data.

Do not expose unnecessary:

- Addresses.
- Phone numbers.
- Personal metadata.
- Internal identifiers.

API DTOs must expose only fields required by the requesting context.

---

# 19. Customer Repository

The repository should provide focused operations such as:

```text
create
findById
findByEmail
list
update
archive
createAddress
updateAddress
deleteAddress
```

Methods operating on Store-owned records should require Store scope.

---

# 20. Customer Application Services

Typical application services include:

```text
createCustomer
getCustomer
listCustomers
updateCustomer
archiveCustomer
createAddress
updateAddress
deleteAddress
```

Exact service names should follow project conventions.

---

# 21. Customer Domain Rules

The domain should enforce:

- Store ownership.
- Valid customer lifecycle transitions.
- Customer identity rules.
- Address ownership.
- Default address rules.
- Required customer fields.

HTTP handlers should not contain these rules.

---

# 22. Customer API

Typical merchant endpoints:

```text
GET   /api/v1/customers
POST  /api/v1/customers
GET   /api/v1/customers/:id
PATCH /api/v1/customers/:id
```

Address operations may use:

```text
POST   /api/v1/customers/:id/addresses
PATCH  /api/v1/customers/:id/addresses/:addressId
DELETE /api/v1/customers/:id/addresses/:addressId
```

Exact routes must follow the API contract.

---

# 23. Customer Authorization

Merchant customer operations require:

```text
Authenticated User
+
Store Context
+
Required Permission
```

Customer IDs supplied by the client do not establish access.

---

# 24. Customer Self-Service

If the Demo provides customer account functionality, the customer must be restricted to their own Customer record.

The server must derive ownership from authenticated identity and Store context.

Never trust a client-provided:

```text
customerId
```

as proof that the customer owns that record.

---

# 25. Tenant Isolation

Every customer query must be Store-scoped.

For example:

```sql
SELECT *
FROM customers
WHERE store_id = $1
  AND id = $2;
```

This should be the normal repository pattern.

---

# 26. Cross-Tenant Customer Access

The following must fail safely:

```text
Store A → Store B Customer
Store A → Store B Address
Customer A → Customer B Address
```

Prefer tenant-safe not-found behavior where appropriate.

---

# 27. Customer and Cart Integration

A Cart may reference a Customer.

The Cart domain remains responsible for Cart state.

When associating a Customer with a Cart:

```text
Cart Store
+
Customer Store
```

must match.

---

# 28. Customer and Checkout Integration

Checkout may associate a Customer with the purchase.

The Customer reference must be validated against the current Store.

Checkout should snapshot the information required for the Order rather than depending on future Customer mutations.

---

# 29. Customer and Order Integration

Orders should preserve historical customer information independently.

For example:

```text
Customer name
Customer email
Billing address
Shipping address
```

may be copied into Order snapshots where required.

Changing a Customer later must not rewrite historical Order information.

---

# 30. Customer Events

Potential events include:

```text
CustomerCreated
CustomerUpdated
CustomerArchived
CustomerAddressCreated
CustomerAddressUpdated
```

Events should contain identifiers and relevant context rather than unnecessary personal information.

---

# 31. Customer Data in Events

Avoid publishing complete customer profiles unnecessarily.

Prefer:

```text
customerId
storeId
event metadata
```

Consumers can retrieve required data through authorized interfaces where appropriate.

---

# 32. Customer Transactions

Operations involving multiple related records should use an application-service transaction.

For example:

```text
Create Customer
+
Create Initial Address
```

should be atomic when implemented as one use case.

---

# 33. Concurrency

Customer updates should handle concurrent modifications safely.

For example:

```text
Request A → Update Customer
Request B → Archive Customer
```

The implementation must follow the domain's state-transition rules.

Use transactional or optimistic concurrency controls where required.

---

# 34. Database Constraints

The database should enforce:

```text
store_id NOT NULL
customer identifiers where required
customer_id NOT NULL for addresses
valid foreign keys
valid status values
appropriate uniqueness
```

If email uniqueness is Store-scoped, enforce it at the database level:

```text
UNIQUE (store_id, normalized_email)
```

where applicable.

---

# 35. Customer Tests

Unit tests should cover:

```text
[ ] Customer creation
[ ] Customer validation
[ ] Email normalization
[ ] Customer lifecycle
[ ] Address creation
[ ] Address ownership
[ ] Default address rules
[ ] Customer update
[ ] Customer archival
```

---

# 36. Integration Tests

Integration tests should verify:

```text
[ ] Customer persistence
[ ] Address persistence
[ ] Store scoping
[ ] Foreign keys
[ ] Uniqueness constraints
[ ] Transaction rollback
[ ] Concurrent updates where relevant
```

---

# 37. API Tests

Test:

```text
[ ] Create customer
[ ] List customers
[ ] Get customer
[ ] Update customer
[ ] Archive customer
[ ] Create address
[ ] Update address
[ ] Delete address
[ ] Invalid customer
[ ] Unauthorized customer
[ ] Cross-tenant customer
[ ] Cross-customer address
```

---

# 38. Privacy Tests

Verify that APIs do not accidentally expose:

```text
[ ] Other customers' addresses
[ ] Other Stores' customers
[ ] Authentication credentials
[ ] Internal security metadata
[ ] Unnecessary personal information
```

---

# 39. Customer Implementation Sequence

Implement in this order:

```text
1. Define Customer schema
2. Define Address schema
3. Create migrations
4. Implement Customer repository
5. Implement Address repository
6. Implement Customer domain model
7. Implement Customer lifecycle
8. Implement identity normalization
9. Implement Customer application services
10. Implement Customer DTOs
11. Implement merchant Customer APIs
12. Implement customer self-service where required
13. Integrate Cart
14. Integrate Checkout
15. Integrate Order snapshots
16. Implement Customer events
17. Add unit tests
18. Add integration tests
19. Add API tests
20. Add tenant isolation tests
21. Add privacy/security tests
```

---

# 40. Definition of Done

Customer implementation is complete when:

```text
[ ] Customer schema exists
[ ] Address schema exists
[ ] Migrations are version-controlled
[ ] Customer repository exists
[ ] Address repository exists
[ ] Store scoping is enforced
[ ] Customer lifecycle is implemented
[ ] Email normalization is consistent
[ ] Address ownership is enforced
[ ] Default address rules work
[ ] Customer APIs work
[ ] Customer self-service is secure where implemented
[ ] Cart integration works
[ ] Checkout integration works
[ ] Order snapshots preserve historical information
[ ] Customer events work where required
[ ] Unit tests pass
[ ] Integration tests pass
[ ] API tests pass
[ ] Tenant isolation tests pass
[ ] Privacy/security tests pass
```

The Customer domain should remain deliberately focused: it owns the customer's Store-scoped commerce profile, not their authentication identity, cart, payment history, or Order lifecycle. Those boundaries are what keep the system understandable once humans inevitably add another seventeen “small” features.