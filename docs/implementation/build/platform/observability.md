# Stores Domain Build Implementation

## 1. Purpose

This document defines the concrete implementation approach for the Stores domain in the Demo.

The Stores domain establishes the tenant-owned commerce boundary:

```text
Organization
    ↓
Membership
    ↓
Store
    ↓
Store-owned resources
```

It is responsible for store identity, lifecycle, configuration, ownership, memberships, and access to the store.

The implementation must provide a reliable foundation for all downstream commerce domains.

---

# 2. Domain Ownership

The Stores module owns:

- Organizations.
- Stores.
- Store identity.
- Store lifecycle.
- Store configuration.
- Store ownership.
- Store memberships.
- Store-level role assignment.
- Store access checks.
- Store public identity/configuration.

It does not own:

- Products.
- Inventory.
- Customers.
- Carts.
- Checkout.
- Payments.
- Orders.
- Product pricing rules.
- Discount calculation.

Other domains consume Store information through approved interfaces.

---

# 3. Module Location

Implementation belongs under:

```text
modules/stores/
```

The module should follow the established modular-monolith structure.

A suitable structure is:

```text
modules/stores/
├── domain/
├── application/
├── infrastructure/
└── index.ts
```

Exact subdirectories may be adjusted to match repository conventions.

---

# 4. Layer Responsibilities

The module follows:

```text
Presentation
    ↓
Application
    ↓
Domain
    ↓
Infrastructure
```

The Stores module must not expose infrastructure implementation details to other modules.

---

# 5. Domain Entities

Core entities include:

```text
Organization
Store
Membership
```

A User belongs to the authentication system.

A Membership associates a User with an Organization and/or Store according to the approved tenancy model.

---

# 6. Organization

An Organization represents the top-level ownership boundary.

It may contain one or more Stores.

The organization provides the broader tenant boundary while the Store represents an individual commerce operation.

---

# 7. Store

A Store represents a merchant's commerce environment.

A Store should contain information such as:

```text
id
organizationId
name
slug
status
configuration
createdAt
updatedAt
```

Only fields approved by the database and domain specifications should be added.

---

# 8. Store Identity

Store identity must be stable.

The implementation should distinguish:

```text
Store ID
Store name
Store slug
```

The ID is the primary internal identifier.

The slug is a human-readable/public identifier where required.

The name is mutable display information.

---

# 9. Store Slug

Store slugs should have appropriate validation and uniqueness constraints.

Uniqueness must be enforced at the database level.

Application validation should provide a clearer error before the database constraint is reached when possible.

---

# 10. Store Lifecycle

Store lifecycle should be represented explicitly.

The implementation should support the states defined by the approved domain state machine.

Typical states may include:

```text
ACTIVE
SUSPENDED
ARCHIVED
```

The actual approved state set must remain authoritative.

---

# 11. State Transitions

State changes must occur through application/domain operations rather than arbitrary database updates.

For example:

```text
suspendStore()
archiveStore()
activateStore()
```

The implementation should validate whether the requested transition is legal.

---

# 12. Store Creation

Store creation should be implemented as an application use case.

Conceptually:

```text
Create Store
    ↓
Authenticate user
    ↓
Resolve organization
    ↓
Authorize creation
    ↓
Validate input
    ↓
Create store
    ↓
Create required membership/ownership relationship
    ↓
Commit transaction
    ↓
Return Store DTO
```

---

# 13. Store Creation Transaction

Store creation should use a transaction when multiple records must be created together.

The transaction should protect relationships such as:

```text
Organization
Store
Owner membership
```

A partially created store must not become visible as a valid store.

---

# 14. Ownership

Store ownership must be explicit.

The implementation must not infer ownership from arbitrary user input.

The authenticated user and authorized organization/store context determine ownership.

---

# 15. Membership

Membership determines whether a user can operate within a Store.

Membership should contain information necessary to determine:

```text
user
store/organization relationship
role
status
```

The exact schema follows the approved database design.

---

# 16. Membership Roles

The Demo supports the approved merchant roles:

```text
Owner
Admin
Staff
```

Customers are not treated as merchant staff members merely because they have customer records.

---

# 17. Role Enforcement

Role checks must occur server-side.

For example:

```text
Owner
→ ownership-sensitive operations

Admin
→ administrative store operations

Staff
→ permitted operational tasks
```

Exact permissions must follow the user-role and authorization specifications.

---

# 18. Membership Status

Inactive or revoked memberships must not grant access.

Authorization should evaluate membership status as part of access resolution.

---

# 19. Store Access Context

Application operations should receive a trusted store context derived from:

```text
Authenticated session
+
Membership
+
Requested store
```

Never trust a client-provided `storeId` as proof of authorization.

---

# 20. Tenant Isolation

Every store-owned operation must be scoped to the authorized Store.

Examples:

```text
Get product
Get customer
Create inventory adjustment
Get order
Update discount
```

must not operate against arbitrary records belonging to another Store.

---

# 21. Cross-Tenant Protection

The implementation must prevent:

```text
Store A user
    ↓
Store B resource
    ↓
successful access
```

Cross-tenant access should fail safely.

Where appropriate, resource lookup should behave as not-found rather than revealing that another tenant owns the resource.

---

# 22. Store Configuration

Store configuration should contain only configuration owned by the Stores domain.

Possible categories include:

```text
Store display name
Store description
Store contact information
Currency
Locale
Timezone
Storefront configuration
```

Only approved Demo configuration should be implemented.

---

# 23. Configuration Validation

Configuration values must be validated before persistence.

Examples:

```text
currency
timezone
locale
public store settings
```

Invalid configuration must produce stable validation errors.

---

# 24. Configuration Updates

Configuration changes should use dedicated application operations.

Avoid allowing arbitrary JSON updates to the entire configuration object.

Prefer explicit input DTOs.

---

# 25. Public Store Configuration

The Storefront domain may consume the public subset of store configuration.

The Stores module must distinguish between:

```text
private merchant configuration
public storefront configuration
```

Private settings must never be returned through public storefront APIs.

---

# 26. Store Retrieval

Store retrieval operations should include explicit access context.

Merchant operations should require appropriate membership.

Public storefront retrieval should use an explicitly public store-resolution path.

---

# 27. Public Store Resolution

Public Storefront requests may resolve a Store through:

```text
store slug
```

or another approved public identifier.

Public resolution must not grant merchant privileges.

---

# 28. Store Update

Store updates should:

1. Authenticate the user.
2. Resolve the Store.
3. Verify membership.
4. Verify permission.
5. Validate input.
6. Apply the update.
7. Persist transactionally.
8. Return an explicit DTO.

---

# 29. Store Deactivation

Deactivation must follow the approved lifecycle rules.

The operation must define how dependent commerce functionality behaves.

The Store domain should not silently modify unrelated domain records.

Instead, downstream domains react according to their own rules.

---

# 30. Store Deletion

Hard deletion should not be used casually.

If deletion is required by the Demo requirements, dependency and historical-data implications must be explicitly handled.

For commerce data, archival/deactivation is generally safer than destructive deletion.

---

# 31. Repository Interfaces

The module should expose repository abstractions only where they are needed by the Stores application/domain layer.

Other modules must not import the Stores module's database repositories directly.

---

# 32. Query Operations

Read operations should provide purpose-specific queries.

Examples:

```text
getStoreById()
getStoreBySlug()
listUserStores()
getMembership()
```

Avoid exposing a generic unrestricted repository to every caller.

---

# 33. Commands

Write operations should be explicit.

Examples:

```text
createStore()
updateStore()
activateStore()
suspendStore()
archiveStore()
addMembership()
updateMembershipRole()
removeMembership()
```

Each operation must enforce authorization and business rules.

---

# 34. DTOs

The module should define explicit output DTOs.

Do not expose raw database entities through API responses.

For example:

```text
StoreSummaryDTO
StoreDetailsDTO
MembershipDTO
```

DTOs should contain only fields appropriate to their consumer.

---

# 35. Application Services

Application services coordinate:

```text
authorization
validation
transaction
domain operation
persistence
events
response mapping
```

They should remain focused on one use case.

---

# 36. Domain Logic

The domain layer owns rules such as:

```text
valid store transitions
valid membership state changes
store lifecycle rules
ownership rules
```

Business rules must not be duplicated across API handlers.

---

# 37. Database Constraints

The database should enforce critical integrity.

Examples:

```text
Store ID primary key
Organization foreign key
Membership foreign keys
Unique store slug where required
Valid relational references
```

Application logic remains responsible for user-friendly errors.

---

# 38. Transactions

Use transactions for operations that modify multiple related records.

Examples:

```text
Create store + owner membership
Membership changes with dependent records
Critical lifecycle changes
```

Transactions should remain short.

---

# 39. Concurrency

Store operations must account for concurrent requests.

Examples:

```text
Two users create the same slug
Two administrators modify configuration
Membership is revoked while an operation begins
```

Database constraints and transaction semantics must protect correctness.

---

# 40. Idempotency

Idempotency should be applied where the Stores API exposes retry-sensitive operations.

For example, if store creation is explicitly retryable through a client request, the operation should have an appropriate idempotency strategy.

Do not add idempotency mechanically to every read operation.

---

# 41. Events

The Stores module may publish domain/application events such as:

```text
StoreCreated
StoreUpdated
StoreActivated
StoreSuspended
StoreArchived
MembershipAdded
MembershipRoleChanged
MembershipRemoved
```

Events represent facts that have already occurred.

---

# 42. Event Consumers

Other domains may react to Store events where necessary.

The Stores module must not directly manipulate unrelated domain internals in response to downstream behavior.

---

# 43. Jobs

The Stores module should not introduce background jobs unless a real asynchronous requirement exists.

If a Store operation requires secondary asynchronous work, publish an event or enqueue approved durable work through the shared job infrastructure.

---

# 44. API Integration

Store API handlers should remain thin.

Conceptually:

```text
HTTP Request
    ↓
Authenticate
    ↓
Resolve Store Context
    ↓
Validate DTO
    ↓
Authorize
    ↓
Store Application Service
    ↓
DTO Response
```

---

# 45. API Endpoints

The exact endpoint set follows the approved API contract.

Typical capabilities include:

```text
Create Store
List Accessible Stores
Get Store
Update Store
Change Store Status
Manage Memberships
```

No endpoint should expose internal implementation details.

---

# 46. Error Handling

Store operations should use the shared error system.

Examples:

```text
STORE_NOT_FOUND
STORE_ACCESS_DENIED
STORE_SLUG_CONFLICT
INVALID_STORE_STATUS_TRANSITION
MEMBERSHIP_NOT_FOUND
MEMBERSHIP_ACCESS_DENIED
```

Exact codes should follow the centralized error catalogue.

---

# 47. Auditability

Important administrative operations should produce sufficient audit information.

Examples:

```text
Store created
Store configuration changed
Membership role changed
Membership revoked
Store suspended
```

Audit data must avoid storing unnecessary sensitive information.

---

# 48. Testing Strategy

The Stores module should include:

### Unit Tests

Test:

```text
Store lifecycle
Membership rules
Role rules
Configuration validation
State transitions
```

### Integration Tests

Test:

```text
Database persistence
Foreign keys
Unique constraints
Membership relationships
Transactions
Tenant isolation
```

### API Tests

Test:

```text
Authentication
Authorization
Validation
DTO responses
Error mapping
```

---

# 49. Security Tests

At minimum verify:

```text
[ ] Unauthenticated user cannot access merchant Store APIs
[ ] Staff cannot perform owner-only operations
[ ] Revoked membership loses access
[ ] Store A cannot access Store B
[ ] Public storefront cannot expose private configuration
[ ] Client cannot override tenant context
```

---

# 50. Implementation Order

Implement the Stores domain in this order:

```text
1. Database tables and constraints
2. Domain entities/value objects
3. Repository interfaces
4. Persistence implementation
5. Membership/access queries
6. Store application services
7. Lifecycle rules
8. Configuration operations
9. Events
10. API handlers
11. API DTOs/error mapping
12. Unit tests
13. Integration tests
14. Security/tenant isolation tests
15. End-to-end store setup verification
```

---

# 51. Verification Scenario

The minimum successful Store flow is:

```text
Authenticate merchant
      ↓
Create organization/store
      ↓
Owner membership created
      ↓
Retrieve Store
      ↓
Update Store configuration
      ↓
Invite/add another merchant member
      ↓
Assign permitted role
      ↓
Verify access
      ↓
Verify unauthorized access fails
```

The result must persist correctly after application restart.

---

# 52. AI Implementation Rules

When implementing the Stores domain, AI agents must:

1. Read the actual root `AGENTS.md`.
2. Read the relevant architecture and domain documents.
3. Read the Stores feature and implementation specifications.
4. Inspect existing authentication and tenant infrastructure.
5. Reuse established patterns.
6. Avoid creating duplicate tenant/auth systems.
7. Keep Store business logic inside the Stores module.
8. Never bypass authorization for convenience.
9. Never trust client-supplied tenant context.
10. Avoid unrelated changes.
11. Add tests for security-sensitive behavior.
12. Review the final diff.

---

# 53. Definition of Done

The Stores domain is complete when:

```text
[ ] Organization/Store relationships work
[ ] Store creation works
[ ] Owner membership is established correctly
[ ] Membership management works
[ ] Roles are enforced server-side
[ ] Store lifecycle is implemented
[ ] Configuration is validated
[ ] Store access is tenant-safe
[ ] Cross-tenant access is rejected
[ ] Public Store resolution is isolated from merchant access
[ ] Database constraints protect integrity
[ ] Transactions are correct
[ ] Retry-sensitive writes have appropriate idempotency
[ ] Events follow approved contracts
[ ] API DTOs are explicit
[ ] Errors use stable codes
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Security tests pass
[ ] TypeScript passes
[ ] Lint passes
```

---

# 54. Final Principle

The Stores domain establishes the ownership boundary on which the rest of the commerce platform depends.

A product, customer, inventory record, cart, checkout, payment, or order must never become detached from a valid Store context.

If Store identity and tenant access are correct, downstream domains have a reliable foundation. If they are wrong, every other domain can be perfectly implemented and the platform will still be fundamentally broken.