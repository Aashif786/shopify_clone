# Customers Domain Build Implementation

## 1. Purpose

This document defines the concrete implementation approach for the Customers domain in the Demo.

The Customers domain manages store-scoped customer records and customer-owned profile information required for commerce workflows.

It provides the customer identity used by carts, checkout, orders, and merchant customer management while remaining separate from authentication and merchant membership.

---

# 2. Domain Ownership

The Customers module owns:

- Store-scoped customer records.
- Customer profile information.
- Customer lifecycle.
- Customer addresses.
- Customer lookup.
- Customer-to-authentication association where required by the approved model.

It does not own:

- User authentication.
- Sessions.
- Merchant memberships.
- Products.
- Inventory.
- Carts.
- Checkout.
- Payments.
- Orders.
- Discounts.

---

# 3. Module Location

Implementation belongs under:

```text id="j8f4r2"
modules/customers/
```

Recommended structure:

```text id="v6m9q3"
modules/customers/
├── domain/
├── application/
├── infrastructure/
└── index.ts
```

The exact internal layout should follow established repository conventions.

---

# 4. Customer Identity Model

A Customer represents a buyer within a Store.

Conceptually:

```text id="m5r7x4"
Store
  ↓
Customer
  ├── Profile
  └── Addresses
```

A customer must always have an explicit Store relationship.

---

# 5. Customer vs User

Authentication identity and commerce customer identity are different concepts.

```text id="q8v4n6"
User
→ Authentication identity

Customer
→ Store-specific commerce identity
```

A registered customer may be associated with a User.

A guest customer may exist without a persistent User account where supported by the Demo flow.

---

# 6. Customer Record

A Customer should contain only approved fields.

Typical fields include:

```text id="x7m3r8"
id
storeId
userId where applicable
email
firstName
lastName
phone where supported
status
createdAt
updatedAt
```

Do not add profile data merely because the database can store it.

---

# 7. Customer Lifecycle

Customer lifecycle should use the approved state model.

Typical states may include:

```text id="m4q8v5"
ACTIVE
INACTIVE
```

The final state set remains defined by the domain specification.

---

# 8. Customer Creation

Customer creation should be implemented through an application service.

Typical flow:

```text id="v6r5m8"
Resolve Store
    ↓
Authenticate where required
    ↓
Validate input
    ↓
Check existing customer rules
    ↓
Create Customer
    ↓
Commit
    ↓
Return Customer DTO
```

---

# 9. Guest Customer Creation

If the checkout supports guest purchases, guest customer creation must not require merchant authentication.

However, the Customer must still be associated with the correct Store.

Guest checkout must never be able to select an arbitrary Store ID as its tenant context.

---

# 10. Customer Deduplication

Customer creation should follow explicit identity rules.

Potential matching attributes include:

```text id="q5m8r4"
email
authenticated User association
```

The exact deduplication policy must follow the approved customer specification.

Do not silently merge customers using heuristic matching.

---

# 11. Email Normalization

Email input should be normalized consistently according to the approved validation policy.

The system should define:

```text id="x4r7m6"
format validation
normalization
case handling
uniqueness semantics
```

Do not implement provider-specific email assumptions without a requirement.

---

# 12. Customer Profile Updates

Profile updates should use explicit application operations.

Examples:

```text id="m7q5r8"
updateCustomerProfile()
updateCustomerEmail()
updateCustomerPhone()
```

Each operation must enforce the correct authorization context.

---

# 13. Customer Authorization

There are two primary access contexts.

### Customer Context

A customer may access only their own permitted information.

### Merchant Context

Merchant users may access customers belonging to Stores where they have appropriate permissions.

The two authorization paths must remain separate.

---

# 14. Customer Self-Access

A customer must never be able to modify another customer's profile by supplying another customer ID.

The authenticated User-to-Customer relationship must be resolved server-side.

---

# 15. Merchant Customer Access

Merchant access requires:

```text id="v8m4r6"
Authenticated merchant
+
Store membership
+
Required permission
```

Store context must come from trusted authorization infrastructure.

---

# 16. Tenant Isolation

Every customer query must be Store-scoped.

Never implement:

```text id="q6r8m3"
findCustomerById(customerId)
```

as an unrestricted public operation.

Prefer:

```text id="x5m7r4"
findCustomerById(storeId, customerId)
```

or an equivalent trusted Store-scoped repository operation.

---

# 17. Cross-Tenant Protection

A request such as:

```text id="m8q4v6"
Store A merchant
    ↓
Customer belonging to Store B
```

must fail safely.

The implementation must prevent cross-tenant reads, updates, and deletions.

---

# 18. Customer Addresses

Addresses belong to the Customers domain.

An address may contain:

```text id="v7r5m8"
firstName
lastName
company where supported
address lines
city
state/province
postal code
country
phone where supported
```

Only fields required by the Demo should be implemented.

---

# 19. Address Validation

Addresses should receive structural validation.

Examples:

```text id="q4m8r6"
Required fields
Country format
Postal code format where applicable
Maximum lengths
Safe string handling
```

Complex international address validation is outside the Demo unless explicitly required.

---

# 20. Address Ownership

Every customer address must belong to exactly one Customer.

The Store relationship should be enforceable through the customer relationship and application authorization.

---

# 21. Default Address

If the Demo supports default addresses, the implementation must ensure that a customer has at most one address designated as the default for each supported address type.

Database constraints or transactional logic should enforce this.

---

# 22. Address Updates

Address updates must verify:

```text id="x6r4m8"
Customer ownership
Store ownership
Authorization
Input validity
```

A client must not be able to move an address between customers by changing an identifier.

---

# 23. Historical Order Addresses

Order addresses must not depend on mutable Customer addresses.

When an order is created, the Orders domain should store the required address snapshot.

Conceptually:

```text id="m5q8r4"
Customer Address
       ↓
Checkout
       ↓
Order Address Snapshot
```

Later Customer changes must not alter the historical Order.

---

# 24. Customer Data and Orders

The Customers module provides current customer information.

The Orders module owns historical purchase records.

Do not implement order-history persistence inside Customers.

---

# 25. Customer Lookup

Merchant customer management may require lookup by approved fields such as:

```text id="v8r5m6"
customer ID
email
name
```

Queries must remain Store-scoped.

---

# 26. Search

The Demo does not require a dedicated customer search engine.

Use PostgreSQL queries and appropriate indexes for the supported lookup requirements.

Do not introduce external search infrastructure for simple customer lookup.

---

# 27. Pagination

Customer list endpoints must use bounded pagination.

The implementation should define:

```text id="q7m4r8"
default page size
maximum page size
ordering
cursor/offset behavior
```

Unbounded customer queries must not be exposed.

---

# 28. Sorting

Only approved sortable fields should be accepted.

Do not pass arbitrary client strings directly into database ordering expressions.

---

# 29. Customer Deactivation

If customer lifecycle supports deactivation, use an explicit state transition.

Deactivation should not delete:

```text id="x4m7r5"
Orders
Order snapshots
Payment history
Historical commerce records
```

---

# 30. Customer Deletion

Hard deletion should not be performed where it would violate historical commerce integrity.

If deletion is required for a specific workflow, dependencies and retention rules must be explicitly handled.

---

# 31. Privacy Considerations

Customer data should be treated as sensitive business data.

Do not expose unnecessary fields through:

```text id="m8r4v6"
Storefront APIs
Logs
Error messages
Analytics
Events
```

---

# 32. Logging Restrictions

Never log full customer records or sensitive addresses by default.

Prefer operational identifiers:

```text id="v6q5r8"
customerId
storeId
requestId
operation
```

---

# 33. Customer Events

The module may emit facts such as:

```text id="q5m8r4"
CustomerCreated
CustomerUpdated
CustomerDeactivated
CustomerAddressAdded
CustomerAddressUpdated
CustomerAddressRemoved
```

Events should contain only information required by consumers.

---

# 34. Event Privacy

Events must not become a mechanism for broadcasting complete customer profiles throughout the application.

Prefer identifiers and necessary business facts.

---

# 35. Application Services

Application services should coordinate:

```text id="x7r4m6"
Authentication context
Store resolution
Authorization
Validation
Transaction
Customer domain rules
Persistence
Events
DTO mapping
```

---

# 36. Repository Design

Repositories should expose Store-scoped operations.

Examples:

```text id="m5q8r7"
findCustomerById(storeId, customerId)
findCustomerByEmail(storeId, email)
listCustomers(storeId, filters)
createCustomer(...)
updateCustomer(...)
```

Exact signatures should follow established project conventions.

---

# 37. DTOs

Use explicit DTOs.

Examples:

```text id="v8m4r5"
CustomerSummaryDTO
CustomerDetailsDTO
CustomerAddressDTO
CustomerListDTO
```

Do not expose database entities directly.

---

# 38. Validation

Validate:

```text id="q6r7m4"
Email
Names
Phone where supported
Address fields
IDs
Status transitions
Pagination
Filter values
```

Boundary validation must be separated from business rules.

---

# 39. Error Handling

Use centralized error codes.

Examples:

```text id="x4m8r6"
CUSTOMER_NOT_FOUND
CUSTOMER_ACCESS_DENIED
CUSTOMER_ALREADY_EXISTS
CUSTOMER_INACTIVE
ADDRESS_NOT_FOUND
ADDRESS_ACCESS_DENIED
INVALID_ADDRESS
```

Exact codes should be maintained by the shared error contract.

---

# 40. Concurrency

Customer updates may occur concurrently.

Examples:

```text id="m7r5q8"
Two profile updates
Two default-address changes
Customer deactivation during checkout
```

Transactions and constraints must preserve consistency.

---

# 41. Default Address Concurrency

If multiple requests attempt to assign different addresses as default simultaneously, the final state must still satisfy the single-default rule.

Use the database and transaction semantics rather than relying solely on application checks.

---

# 42. Idempotency

Retry-sensitive customer mutations may use the shared idempotency mechanism where appropriate.

Do not add idempotency to ordinary reads.

Idempotent creation semantics must define what happens when the same request is repeated.

---

# 43. Checkout Integration

Checkout may create or resolve a Customer.

Conceptually:

```text id="v5r8m4"
Checkout
    ↓
Resolve/Create Customer
    ↓
Use Customer identity
    ↓
Capture address snapshot
    ↓
Create Order
```

Checkout must not bypass Customer domain ownership.

---

# 44. Cart Integration

A Cart may reference a Customer.

The Cart domain owns:

```text id="q8m4r6"
Cart
Cart items
Cart state
```

Customers owns:

```text id="x6r5m8"
Customer identity
Customer profile
```

---

# 45. Authentication Integration

The Auth package owns:

```text id="m4q8r7"
User identity
Session
Password
Authentication state
```

Customers may reference the authenticated User where required.

Customers must not implement its own authentication system.

---

# 46. Storefront Integration

Public storefront APIs should expose only the minimum customer information required by the current workflow.

Do not expose merchant-facing customer management data publicly.

---

# 47. Database Constraints

The database should enforce:

```text id="v7m4r8"
Customer → Store foreign key
Customer → User relationship where applicable
Address → Customer foreign key
Required fields
Unique constraints where required
Valid relational references
```

Tenant integrity must be protected at both application and database levels where practical.

---

# 48. Testing Strategy

### Unit Tests

Test:

```text id="q5r8m6"
Customer lifecycle
Profile rules
Address rules
Default address behavior
Validation
```

### Integration Tests

Test:

```text id="x7m4r5"
Store isolation
Customer persistence
Address relationships
Constraints
Transactions
Concurrent default-address updates
```

### API Tests

Test:

```text id="m8q4r6"
Authentication
Authorization
Validation
Pagination
DTOs
Error mapping
```

---

# 49. Security and Privacy Tests

At minimum verify:

```text id="v6r5m8"
[ ] Customer cannot access another customer's data
[ ] Store A cannot access Store B customers
[ ] Merchant cannot bypass Store authorization
[ ] Client cannot change customer ownership
[ ] Private customer fields are not exposed publicly
[ ] Sensitive customer information is not logged
[ ] Order history remains intact after customer changes
```

---

# 50. Implementation Order

Implement Customers in this order:

```text id="q7m4r8"
1. Database schema and constraints
2. Customer domain model
3. Address model
4. Repository interfaces
5. Persistence implementation
6. Customer creation/resolution
7. Profile operations
8. Address operations
9. Lifecycle operations
10. Merchant customer queries
11. Customer/auth integration
12. Cart/checkout integration
13. Events
14. API DTOs and handlers
15. Unit tests
16. Integration tests
17. Security/privacy tests
18. End-to-end customer flow verification
```

---

# 51. Verification Scenario

The minimum successful Customer flow is:

```text id="x5m7r4"
Customer enters storefront
      ↓
Customer identity is created/resolved
      ↓
Customer adds/updates address
      ↓
Customer adds product to cart
      ↓
Checkout uses Customer identity
      ↓
Order stores address snapshot
      ↓
Customer address changes later
      ↓
Historical Order remains unchanged
```

Merchant verification should additionally confirm that only authorized Store members can manage the customer.

---

# 52. AI Implementation Rules

AI agents implementing Customers must:

1. Read the actual root `AGENTS.md`.
2. Read Customer domain and database specifications.
3. Inspect the existing Auth and Tenant implementations.
4. Keep authentication separate from customer identity.
5. Preserve Store isolation.
6. Never expose customer data through public endpoints accidentally.
7. Never rewrite historical order snapshots.
8. Avoid heuristic customer merging.
9. Reuse validation and error infrastructure.
10. Add privacy and tenant-isolation tests.
11. Avoid unrelated changes.
12. Review the final diff.

---

# 53. Definition of Done

Customers implementation is complete when:

```text id="v8r5m6"
[ ] Store-scoped customers work
[ ] Guest/customer identity rules work
[ ] Auth association works where required
[ ] Customer profiles can be managed
[ ] Addresses can be managed
[ ] Default-address rules are enforced
[ ] Customer lookup works
[ ] Pagination is bounded
[ ] Tenant isolation is enforced
[ ] Authorization is enforced
[ ] Customer data is not unnecessarily exposed
[ ] Historical order snapshots remain immutable
[ ] Events follow approved contracts
[ ] Idempotency is applied where required
[ ] Concurrency rules are tested
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Security/privacy tests pass
[ ] TypeScript passes
[ ] Lint passes
```

---

# 54. Final Principle

The Customers domain represents the **current customer relationship with a Store**.

It must not become a second authentication system, an order-history system, or a general-purpose personal-data warehouse.

The critical boundary is:

```text id="m6q4r8"
Auth
→ Who is the user?

Customers
→ Who is the buyer in this Store?

Orders
→ What did they purchase?
```

Keeping those responsibilities separate makes customer identity reliable without allowing one mutable customer record to rewrite the history of commerce.