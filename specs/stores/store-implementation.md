# Store Implementation Specification

## 1. Purpose

This document defines the implementation requirements for the **Stores** domain of the Cal Cart commerce platform.

The Stores module is responsible for creating and managing merchant storefronts, store configuration, store lifecycle, and the relationship between organizations, memberships, and stores.

The implementation must preserve the platform's multi-tenant architecture and provide a stable foundation for products, inventory, customers, carts, checkout, payments, orders, and storefront functionality.

---

## 2. Scope

The Stores module owns:

- Store creation.
- Store identification.
- Store lifecycle.
- Store configuration.
- Store ownership relationship.
- Store membership relationship.
- Store-level settings.
- Store status.
- Store access validation.
- Store-level public storefront configuration.

The module does not own:

- Products.
- Inventory.
- Customers.
- Orders.
- Payments.
- Checkout.
- Discount rules.
- Authentication credentials.

Those domains remain owned by their respective modules.

---

## 3. Domain Position

The core tenancy hierarchy is:

```text
Organization
    │
    ├── Memberships
    │
    └── Stores
          │
          ├── Products
          ├── Inventory
          ├── Customers
          ├── Carts
          ├── Discounts
          ├── Checkout
          ├── Payments
          └── Orders
```

A Store is the primary operational tenant boundary for commerce data.

---

## 4. Module Location

The implementation belongs under:

```text
modules/stores/
```

The module should follow the standard internal structure:

```text
modules/stores/
├── application/
├── domain/
├── infrastructure/
└── index.ts
```

The exact file structure may evolve with implementation needs, but module ownership must remain clear.

---

## 5. Layer Responsibilities

### Presentation

The web/API layer:

- Receives requests.
- Authenticates users.
- Resolves tenant context.
- Validates input.
- Authorizes operations.
- Calls Stores application services.
- Maps results to API DTOs.

### Application

The application layer:

- Coordinates Store use cases.
- Defines transaction boundaries.
- Calls repositories.
- Enforces authorization requirements through application policies.
- Publishes relevant events.

### Domain

The domain layer:

- Defines Store entities/value objects.
- Defines lifecycle rules.
- Defines Store invariants.
- Defines valid state transitions.

### Infrastructure

The infrastructure layer:

- Persists Store data.
- Implements repository interfaces.
- Handles database-specific queries.
- Integrates with external infrastructure where required.

---

## 6. Store Entity

The Store entity represents a merchant storefront within an Organization.

Conceptually:

```text
Store
├── id
├── organizationId
├── name
├── slug
├── status
├── configuration
├── createdAt
└── updatedAt
```

The exact persistence representation is defined by the database implementation.

---

## 7. Store Identity

Every Store must have a stable unique identifier.

The identifier:

- Must be generated server-side.
- Must not be controlled by the client.
- Must remain stable for the Store lifetime.
- Must be used for internal relationships.

Public URLs may use a slug, but the slug must not replace the internal Store identifier.

---

## 8. Organization Relationship

Every Store belongs to exactly one Organization.

The relationship is:

```text
Organization 1 ──── N Store
```

A Store cannot exist without a valid owning Organization.

The database must enforce the relationship through appropriate constraints.

---

## 9. Membership Relationship

Users access Stores through authorized memberships.

Conceptually:

```text
User
  ↓
Membership
  ↓
Organization / Store access
  ↓
Store
```

Membership status and permissions must be checked server-side.

A client-provided Store ID does not establish access.

---

## 10. Store Ownership

The platform should identify the Store's owning organization and authorized members.

The Store module must not assume that the first user who accesses a Store is its owner.

Ownership must be established through an explicit creation and membership workflow.

---

## 11. Store Creation

Store creation should follow:

```text
Authenticated User
      ↓
Validate organization access
      ↓
Validate store data
      ↓
Create Store
      ↓
Create/assign appropriate membership
      ↓
Commit transaction
      ↓
Return Store
```

The exact membership behavior depends on the organization's membership model.

---

## 12. Store Creation Authorization

Only an authorized user may create a Store.

The application must verify:

- User identity.
- Organization membership.
- Membership status.
- Required organization/store-management permission.

Authorization must occur before the mutation.

---

## 13. Store Creation Transaction

Store creation and required ownership/membership changes should occur in a single transaction when they form one atomic business operation.

Example:

```text
BEGIN
  ↓
Create Store
  ↓
Create/assign owner membership
  ↓
Create default configuration
  ↓
COMMIT
```

If a required step fails, the operation must not leave a partially initialized Store.

---

## 14. Store Slug

The Store slug is a human-readable identifier suitable for URLs.

Example:

```text
my-fashion-store
```

Slug requirements:

- Normalized.
- Predictable.
- URL-safe.
- Bounded in length.
- Unique within the required scope.
- Validated server-side.

The slug must not be treated as a security credential.

---

## 15. Slug Uniqueness

If Store URLs are globally addressable, the slug must be globally unique.

If the product model later supports organization-scoped or custom-domain routing, the uniqueness strategy may evolve.

The database must enforce the chosen uniqueness rule.

---

## 16. Store Name

The Store name is merchant-facing display information.

Requirements:

- Required.
- Length-limited.
- Validated.
- Stored using Unicode-safe text.
- Not used as a unique identifier.

Changing the Store name must not change the Store ID.

---

## 17. Store Status

The Store should use an explicit lifecycle state.

Initial states may include:

```text
ACTIVE
SUSPENDED
ARCHIVED
```

The exact states must match the domain state machine.

---

## 18. Store State Transitions

Valid transitions must be explicit.

Example:

```text
ACTIVE
  │
  ├──→ SUSPENDED
  │
  └──→ ARCHIVED

SUSPENDED
  │
  ├──→ ACTIVE
  │
  └──→ ARCHIVED
```

Invalid transitions must be rejected by the application layer.

---

## 19. Archived Stores

Archiving a Store must not silently delete its business data.

Archived Stores should preserve:

- Orders.
- Customers.
- Products.
- Inventory history.
- Payment records.
- Audit information.

The Store may become unavailable for normal merchant operations while historical information remains preserved.

---

## 20. Suspended Stores

A suspended Store should prevent operations that the domain considers unavailable.

For example:

- New storefront purchases.
- New checkout completion.
- Product publication.

The exact restrictions must be explicitly defined by the relevant workflows.

Administrative access may remain available to authorized users.

---

## 21. Store Configuration

Store configuration may include:

- Store name.
- Store description.
- Currency.
- Locale.
- Contact information.
- Storefront settings.
- Checkout settings.
- Branding references.
- Operational settings.

Configuration must not become an unstructured dumping ground for unrelated domain state.

---

## 22. Configuration Ownership

Configuration fields should have clear ownership.

For example:

```text
Store module
    → General store settings

Products module
    → Product settings

Payments module
    → Payment configuration

Checkout module
    → Checkout behavior
```

The Stores module should not own another domain's business configuration merely because it is convenient.

---

## 23. Currency

The Store should define the default operating currency required by the Demo.

Currency must use a standardized currency representation.

Money values must never rely on floating-point arithmetic.

Changing the Store's currency after transactions exist requires explicit business rules and should not silently reinterpret historical monetary values.

---

## 24. Storefront Availability

A Store may be publicly accessible only when its lifecycle/configuration permits it.

Storefront resolution should verify:

```text
Store exists
   +
Store is publicly available
   +
Storefront configuration permits access
```

The storefront must not expose inactive tenant data accidentally.

---

## 25. Store Resolution

Store resolution may use:

- Store ID.
- Store slug.
- Domain/custom domain when introduced.

The resolved Store must always be converted into an authorized server-side tenant context before accessing Store-owned resources.

---

## 26. Store Context

Once a request resolves a Store, downstream application operations should receive an explicit Store context.

Conceptually:

```text
Request
  ↓
Identity
  ↓
Store Resolution
  ↓
Store Context
  ↓
Application Service
```

Store context should not depend on arbitrary client-controlled state.

---

## 27. Repository Interface

The Stores module should expose a repository abstraction appropriate to its use cases.

Possible operations include:

```text
findById
findBySlug
create
update
changeStatus
```

The exact interface should be driven by actual application requirements.

Do not create repository methods merely because CRUD operations exist conceptually.

---

## 28. Query Ownership

Store queries belong to the Stores module.

Other modules should not directly query internal Store tables.

For example:

```text
Products module
    ↓
Store interface
```

is preferred over:

```text
Products module
    ↓
Direct SQL against stores table
```

---

## 29. Store Update

Store updates should:

1. Authenticate the caller.
2. Resolve the Store.
3. Authorize the requested operation.
4. Validate input.
5. Apply domain rules.
6. Persist changes.
7. Commit.
8. Return an explicit DTO.

Only allowed fields may be modified.

---

## 30. Partial Updates

Partial updates should use explicit update DTOs.

The API must not accept arbitrary database fields.

For example:

```text
{
  "name": "New Store Name"
}
```

should only modify fields explicitly supported by the operation.

---

## 31. Concurrent Updates

Concurrent Store updates must not silently overwrite important changes.

Where lost updates are possible, the implementation may use:

- Transactions.
- Optimistic concurrency.
- Updated timestamps/version fields.
- Explicit conflict handling.

The appropriate strategy depends on the specific update operation.

---

## 32. Store Deletion

Physical deletion of Stores should not be the default behavior.

Because Stores own significant historical business data, deletion should normally be represented by an archival/deactivation workflow.

If permanent deletion is ever introduced, it requires explicit retention and dependency rules.

---

## 33. Store Events

The Stores module may emit domain events such as:

```text
StoreCreated
StoreUpdated
StoreSuspended
StoreReactivated
StoreArchived
```

Events must represent facts that have occurred.

They must not be used as a replacement for synchronous transactional business logic.

---

## 34. Event Timing

Events representing successful Store mutations should only become observable after the underlying transaction has safely committed, unless an explicit transactional event/outbox mechanism is used.

The implementation must avoid publishing an event for a Store mutation that ultimately rolls back.

---

## 35. Background Jobs

Store-related asynchronous work may be handled by the worker when required.

Examples:

- Store notification.
- Media processing.
- Cleanup.
- External integration synchronization.

Jobs must remain idempotent and tenant-aware.

---

## 36. API Endpoints

The Store API may expose business operations such as:

```text
POST   /api/v1/stores
GET    /api/v1/stores
GET    /api/v1/stores/{storeId}
PATCH  /api/v1/stores/{storeId}
POST   /api/v1/stores/{storeId}/suspend
POST   /api/v1/stores/{storeId}/reactivate
POST   /api/v1/stores/{storeId}/archive
```

The final endpoint set must follow the API contract and actual product requirements.

---

## 37. Store Listing

Store listing must return only Stores accessible to the authenticated caller.

The query must be tenant-aware and permission-aware.

It must not expose unrelated organizations' Stores.

---

## 38. Store Retrieval

A Store retrieval request must verify:

```text
Authenticated caller
       ↓
Authorized relationship
       ↓
Requested Store
       ↓
Return Store
```

A valid Store ID alone must never be sufficient.

---

## 39. Public Storefront Retrieval

Public storefront requests may not have a merchant session.

The system must therefore distinguish:

```text
Merchant management context
```

from:

```text
Public storefront context
```

Public access must expose only intentionally public Store information.

Private configuration, internal identifiers, credentials, and operational data must never be returned.

---

## 40. Validation

Store input validation must include:

- Required fields.
- String lengths.
- Slug format.
- Supported currency.
- Supported locale where applicable.
- Configuration structure.
- URL formats where applicable.

Validation must occur before application processing.

---

## 41. Error Handling

Expected Store errors should use stable application error codes.

Examples:

```text
STORE_NOT_FOUND
STORE_ACCESS_DENIED
STORE_ALREADY_EXISTS
INVALID_STORE_SLUG
INVALID_STORE_STATUS_TRANSITION
STORE_SUSPENDED
STORE_ARCHIVED
```

Errors must not expose database internals.

---

## 42. Tenant Isolation

Every Store-owned operation must preserve tenant isolation.

Tests must verify:

```text
Store A user
    ↓
Store B resource
    ↓
Denied
```

This includes:

- Store retrieval.
- Store updates.
- Store configuration.
- Store listing.
- Related domain operations.

---

## 43. Security Requirements

The Stores module must protect against:

- Unauthorized Store creation.
- Cross-tenant Store access.
- IDOR.
- Slug enumeration where sensitive.
- Unauthorized status changes.
- Unauthorized configuration changes.
- Privilege escalation.
- Sensitive configuration exposure.

---

## 44. Auditability

Important Store lifecycle operations should be auditable.

At minimum, consider recording:

- Store creation.
- Status changes.
- Ownership/membership changes.
- Important configuration changes.
- Archival.

Audit records should identify the actor and timestamp where the platform's audit model supports this.

---

## 45. Testing Strategy

The Stores module should include:

### Unit tests

- Slug validation.
- State transitions.
- Store configuration rules.
- Domain invariants.

### Integration tests

- Store creation transaction.
- Persistence.
- Organization relationship.
- Membership relationship.
- Unique constraints.
- Tenant isolation.

### API tests

- Authentication.
- Authorization.
- Validation.
- Error responses.
- Store lifecycle endpoints.

### E2E tests

- Merchant creates Store.
- Merchant configures Store.
- Store becomes available.
- Unauthorized user cannot access Store.

---

## 46. Critical Test Cases

At minimum:

```text
[ ] Authorized user can create a Store
[ ] Unauthorized user cannot create a Store
[ ] Store belongs to correct Organization
[ ] Required owner/membership relationship is created correctly
[ ] Duplicate Store slug is rejected
[ ] Invalid slug is rejected
[ ] Store update respects authorization
[ ] Cross-tenant Store access is denied
[ ] Invalid state transition is rejected
[ ] Archived Store cannot perform prohibited operations
[ ] Public storefront exposes only public data
[ ] Store creation is atomic
[ ] Concurrent conflicting updates behave safely
```

---

## 47. Database Requirements

The Store persistence model should enforce:

- Primary key.
- Organization foreign key.
- Required fields.
- Appropriate status representation.
- Required uniqueness constraints.
- Timestamps.
- Appropriate indexes.

Store-owned queries should be indexed according to actual access patterns.

---

## 48. Indexing

Likely access patterns include:

```text
organization_id
store_id
slug
status
```

Indexes should be added based on actual query patterns and database analysis.

Do not blindly index every field.

---

## 49. Transactions

Transactions are required when multiple Store-related records must change atomically.

Examples:

```text
Create Store
+
Create owner relationship
+
Create default configuration
```

A transaction should not remain open during external network calls.

---

## 50. Idempotency

Store creation may require idempotency if the client can safely retry the operation and duplicate Store creation would be harmful.

If supported by the API, repeated creation requests with the same idempotency key must not create multiple Stores.

---

## 51. Configuration Evolution

Store configuration must be designed so future settings can be added without breaking existing Stores.

New configuration fields should have:

- Explicit defaults.
- Validation.
- Backward-compatible behavior where possible.

Avoid untyped arbitrary JSON configuration for critical business rules.

---

## 52. Integration Boundaries

The Stores module may integrate with:

- Authentication/membership.
- Media.
- Storefront.
- Notifications.
- Domain event infrastructure.

External integrations should be accessed through explicit interfaces/adapters.

---

## 53. Module Dependencies

The Stores module may depend on shared packages such as:

```text
packages/auth
packages/db
packages/tenant
packages/types
packages/validation
packages/event-bus
```

It should not depend on another domain module's internal implementation.

---

## 54. Implementation Sequence

The recommended implementation order is:

```text
1. Define Store domain model
2. Define Store states and invariants
3. Define persistence schema
4. Create migration
5. Implement repository
6. Implement application services
7. Implement authorization checks
8. Implement API routes
9. Implement DTOs/validation
10. Add events where required
11. Add tests
12. Add E2E coverage
13. Verify tenant isolation
```

---

## 55. Demo Simplifications

The Demo intentionally does not require:

- Multiple independently deployable Store services.
- Advanced organization hierarchies.
- Enterprise store provisioning workflows.
- Multi-region Store deployment.
- Advanced custom-domain infrastructure.
- Complex localization systems.
- Enterprise configuration management.

The simplified infrastructure must not weaken Store ownership or tenant isolation.

---

## 56. V1 Evolution

The Stores module should remain a stable domain boundary as the platform grows.

Future capabilities may include:

- Custom domains.
- Advanced storefront settings.
- Multiple currencies.
- Regional configuration.
- Store-level analytics.
- Advanced organization structures.
- Store-level integrations.

These should extend the existing Store model rather than bypassing it.

---

## 57. Definition of Done

The Stores implementation is complete when:

```text
[ ] Store entity exists
[ ] Organization relationship exists
[ ] Store lifecycle is implemented
[ ] Store creation is transactional
[ ] Store ownership/membership relationship is correct
[ ] Store configuration is implemented
[ ] Store slug validation exists
[ ] Store uniqueness is enforced
[ ] Store APIs exist
[ ] Authentication is enforced
[ ] Authorization is enforced
[ ] Tenant isolation is enforced
[ ] Public/private Store data is separated
[ ] Store lifecycle transitions are validated
[ ] Important lifecycle actions are auditable
[ ] Database constraints exist
[ ] Relevant indexes exist
[ ] Idempotency is handled where required
[ ] Unit tests exist
[ ] Integration tests exist
[ ] API tests exist
[ ] E2E coverage exists for critical flows
[ ] Documentation matches the implementation
```