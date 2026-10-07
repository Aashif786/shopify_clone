# Stores Implementation

## 1. Purpose

This document defines the concrete implementation of the Store domain for the Demo.

The Store domain establishes the merchant's commerce environment and owns:

- Store creation.
- Store identity.
- Store lifecycle.
- Store configuration.
- Store ownership.
- Store memberships.
- Store access boundaries.
- Public Storefront configuration.

The Store domain provides the foundation on which Products, Inventory, Customers, Carts, Discounts, Checkout, Orders, and Storefront functionality depend.

---

# 2. Domain Ownership

The Store domain is implemented under:

```text
modules/stores
```

It owns Store-specific business rules and application services.

It may depend on shared platform packages such as:

```text
packages/auth
packages/db
packages/tenant
packages/types
packages/validation
```

It must not directly access another domain's internal implementation.

---

# 3. Store Model

The core Store record should contain information such as:

```text id="m8c4x7"
id
organization_id
name
slug
status
currency
timezone
created_at
updated_at
```

Additional configuration fields should be added only when required by the product specification.

---

# 4. Organization Relationship

The ownership hierarchy is:

```text id="q7m4c8"
Organization
      ↓
Store
```

Every merchant Store must belong to an Organization.

The Store implementation must never create an orphan Store.

---

# 5. Store Ownership

The Store domain owns:

```text id="v5m8c4"
Store identity
Store lifecycle
Store configuration
Store slug
Store status
Store membership relationship
Public Store configuration
```

It does not own:

```text id="x8c4m7"
Product business rules
Inventory quantities
Customer profiles
Cart calculations
Discount calculations
Payment state
Order lifecycle
```

Those belong to their respective domains.

---

# 6. Store Creation

Store creation should be implemented as an application use case.

Flow:

```text id="m4c8x7"
Authenticated User
      ↓
Organization Context
      ↓
Validate Store Input
      ↓
Create Store
      ↓
Create Owner Membership
      ↓
Commit Transaction
      ↓
Return Store DTO
```

Store creation should be atomic.

---

# 7. Store Creation Transaction

Creating a Store and its initial owner membership should occur within one transaction.

Conceptually:

```text id="q8m3c7"
BEGIN
  Create Store
  Create Owner Membership
COMMIT
```

If either operation fails, neither should remain partially created.

---

# 8. Store Name

Store names should be validated for:

- Required value.
- Maximum length.
- Appropriate characters.
- Whitespace handling.

The exact constraints should follow the Store specification.

---

# 9. Store Slug

The Store slug provides a stable human-readable identifier.

Requirements:

- Normalized format.
- Appropriate length.
- Unique within the required scope.
- Safe for URLs.
- Resistant to ambiguous whitespace/casing behavior.

A slug should not be assumed to remain immutable unless the product contract defines it that way.

---

# 10. Slug Uniqueness

The database should enforce the final uniqueness guarantee.

For example:

```text id="v7m4c8"
UNIQUE (organization_id, slug)
```

or another scope defined by the product specification.

Application-level checks improve user experience but do not replace the database constraint.

---

# 11. Store Status

The Store lifecycle should use explicit status values.

Example:

```text id="x5m8c4"
Draft
Active
Suspended
Archived
```

Only statuses defined by the domain specification should be implemented.

---

# 12. Status Transitions

Store lifecycle changes must use explicit application/domain rules.

Example:

```text id="m8c4x7"
Draft → Active
Active → Suspended
Suspended → Active
Active → Archived
```

Invalid transitions must be rejected.

Do not allow arbitrary status updates such as:

```text id="q4m8c7"
PATCH /stores/:id
{
  "status": "anything"
}
```

without domain validation.

---

# 13. Store Activation

Before activation, validate the required Store configuration.

Depending on the Demo requirements, this may include:

- Valid name.
- Valid currency.
- Valid timezone.
- Required storefront configuration.

Activation should not bypass required setup.

---

# 14. Store Suspension

Suspension should prevent operations that the Store lifecycle rules disallow.

Examples may include:

- New checkout.
- New orders.
- Public Storefront access.

Existing historical records should remain available according to policy.

---

# 15. Store Configuration

Store configuration should remain clearly separated from domain data.

Possible configuration includes:

```text id="v8m3c7"
Store name
Currency
Timezone
Storefront settings
Contact information
Branding references
```

Only configuration required by Demo should be implemented.

---

# 16. Currency

Store currency must be explicit.

Money operations should use the exact representation defined by the database and domain specifications.

Never use floating-point arithmetic for monetary calculations.

---

# 17. Timezone

Store timezone should be validated against supported timezone identifiers.

Business timestamps should remain consistently represented in the database.

Presentation may convert timestamps to Store-local time where appropriate.

---

# 18. Store Membership

The Store domain integrates with the tenant system for membership management.

The initial Store creator should receive the Owner role.

Example:

```text id="x7m4c8"
User
 ↓
Organization
 ↓
Store
 ↓
Owner Membership
```

---

# 19. Membership Authorization

Store membership must not be inferred from:

- User ID alone.
- Organization membership alone.
- Store ID supplied by the client.

The tenant platform must resolve the actual membership.

---

# 20. Store Access

Protected Store operations should require:

```text id="m5c8x7"
Authenticated User
+
Valid Store Context
+
Valid Membership
+
Required Permission
```

Authorization remains server-side.

---

# 21. Store Repository

The Store repository should provide focused operations such as:

```text id="q8m4c7"
findById
findBySlug
create
update
changeStatus
```

Repository methods should enforce appropriate ownership and transaction context.

---

# 22. Store Application Services

Typical application services may include:

```text id="v4m8c7"
createStore
getStore
updateStore
activateStore
suspendStore
archiveStore
listStores
```

Exact service names may follow project naming conventions.

---

# 23. Store Domain Rules

Domain logic should enforce:

- Valid lifecycle transitions.
- Valid Store configuration.
- Slug rules.
- Required activation conditions.
- Ownership invariants.

Route handlers should not duplicate these rules.

---

# 24. Store DTOs

The Store API should expose explicit DTOs.

Example:

```text id="x7m3c8"
StoreSummary
StoreDetail
CreateStoreInput
UpdateStoreInput
```

Do not expose raw database records.

---

# 25. Store API

Typical endpoints include:

```text id="m8c4x7"
POST   /api/v1/stores
GET    /api/v1/stores
GET    /api/v1/stores/:id
PATCH  /api/v1/stores/:id
```

Lifecycle actions may use explicit endpoints where appropriate.

---

# 26. Store Listing

Store listing must return only Stores accessible to the authenticated User.

The application must not query all Stores and filter them in application memory.

Membership-aware database queries should establish the allowed scope.

---

# 27. Store Selection

When a User selects a Store:

```text id="q5m8c4"
Store ID
      ↓
Membership Verification
      ↓
Store Context
      ↓
Authorized Request
```

The selected Store must never become trusted solely because it came from the frontend.

---

# 28. Public Storefront Resolution

Public storefront access should resolve a Store through an approved public identifier such as:

```text id="v8c4m7"
Store slug
Custom domain where implemented
```

The Store must be:

- Active.
- Publicly available.
- Correctly associated with the request.

---

# 29. Storefront Configuration

Public Storefront configuration may include:

```text id="x4m8c7"
Store name
Currency
Branding
Public contact information
```

Only fields explicitly marked public should be exposed.

---

# 30. Store Media Integration

The Store domain may reference media assets such as:

- Logo.
- Store branding.
- Storefront images.

Binary media remains owned by the Media integration.

The Store domain should store only the appropriate reference.

---

# 31. Store Events

Relevant Store events may include:

```text id="m7c4x8"
StoreCreated
StoreActivated
StoreSuspended
StoreArchived
StoreUpdated
```

Events represent facts that already happened.

They should not contain unnecessary sensitive data.

---

# 32. Event Consumers

Other domains may react to Store events where required.

Examples:

```text id="q8m3c7"
StoreCreated
    ↓
Initialize Store defaults

StoreSuspended
    ↓
Restrict public commerce operations
```

The Store domain should not directly implement unrelated notification or analytics behavior.

---

# 33. Store Transactions

Store operations requiring multiple writes should use an application-service transaction.

Example:

```text id="v5m8c4"
Create Store
+
Create Owner Membership
```

must be atomic.

---

# 34. Concurrency

Store lifecycle changes should be safe under concurrent requests.

For example:

```text id="x7c4m8"
Request A: Activate Store
Request B: Suspend Store
```

The final state must obey the defined transition rules.

Where necessary, use transactional locking or optimistic/concurrency controls.

---

# 35. Store Deletion

Physical deletion should not be the default for Stores with dependent commerce data.

Historical:

```text id="m8c4x7"
Orders
Payments
Refunds
```

must remain consistent.

Prefer lifecycle states such as Archived where appropriate.

---

# 36. Database Constraints

The Store schema should enforce appropriate constraints:

```text id="q4m8c7"
organization_id NOT NULL
name NOT NULL
slug NOT NULL
status NOT NULL
currency NOT NULL
timezone NOT NULL
valid foreign keys
required uniqueness
```

Exact constraints follow the database specification.

---

# 37. Store Isolation Tests

Test:

```text id="v8m3c7"
[ ] User can access authorized Store
[ ] User cannot access unauthorized Store
[ ] Store belongs to correct Organization
[ ] Store slug uniqueness works
[ ] Invalid lifecycle transitions fail
[ ] Store creation is atomic
[ ] Owner membership is created correctly
[ ] Suspended Store restrictions work
[ ] Archived Store restrictions work
```

---

# 38. API Tests

Test:

```text id="x5m8c4"
[ ] Create Store
[ ] List accessible Stores
[ ] Read Store
[ ] Update Store
[ ] Activate Store
[ ] Suspend Store
[ ] Invalid Store ID
[ ] Unauthorized Store
[ ] Invalid Store input
[ ] Duplicate Store slug
```

---

# 39. Integration Tests

Integration tests should verify:

```text id="m7c4x8"
User
 ↓
Authentication
 ↓
Tenant Resolution
 ↓
Store Application Service
 ↓
PostgreSQL
```

The tests should confirm that Store operations respect the tenant platform.

---

# 40. Store Implementation Sequence

Implement in this order:

```text id="q8m4c7"
1. Define Store database schema
2. Create migration
3. Implement Store repository
4. Implement Store domain model
5. Implement lifecycle rules
6. Implement Store application services
7. Implement owner membership creation
8. Implement Store DTOs
9. Implement Store API routes
10. Implement Store authorization
11. Implement public Store resolution
12. Implement Store events
13. Add unit tests
14. Add integration tests
15. Add API tests
16. Run tenant isolation tests
17. Verify lifecycle behavior
```

---

# 41. Definition of Done

Store implementation is complete when:

```text id="v4m8c7"
[ ] Store schema exists
[ ] Migration is version-controlled
[ ] Store repository exists
[ ] Store domain rules exist
[ ] Store creation is transactional
[ ] Owner membership is created atomically
[ ] Store lifecycle is enforced
[ ] Store configuration is validated
[ ] Store authorization works
[ ] Store isolation works
[ ] Store APIs work
[ ] Public Store resolution works
[ ] Store events are implemented where required
[ ] Unit tests pass
[ ] Integration tests pass
[ ] API tests pass
[ ] Tenant isolation tests pass
```

The Store domain is complete when it provides a reliable ownership boundary for everything that follows. Products, inventory, customers, carts, orders, and the rest of the commerce machinery should be able to depend on a Store without each inventing its own version of tenant ownership.