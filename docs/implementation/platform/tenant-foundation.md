# Tenant Foundation Implementation

## 1. Purpose

This document defines the implementation foundation for multi-tenant isolation in the Demo.

The tenant model must ensure that users can access only the organizations and Stores for which they have valid membership and authorization.

Tenant isolation is a **security boundary**, not merely an application convenience.

---

# 2. Tenant Hierarchy

The foundational relationship is:

```text
Organization
    ↓
Membership
    ↓
User

Organization
    ↓
Store
    ↓
Store-owned resources
```

The exact organizational relationship may evolve, but Store ownership and access must remain explicit.

---

# 3. Tenant Package

Tenant infrastructure belongs in:

```text
packages/tenant
```

It should provide:

- Tenant context.
- Store context.
- Organization context.
- Membership resolution.
- Tenant-scoping helpers.
- Trusted tenant identifiers.

It must not implement authentication.

---

# 4. Authentication Dependency

Tenant resolution depends on trusted identity information.

Conceptually:

```text
Request
    ↓
Authentication
    ↓
User Identity
    ↓
Tenant Resolution
```

The tenant layer must never trust a client-provided user identity.

---

# 5. Tenant Context

A protected request should produce a trusted tenant context.

Conceptually:

```text
TenantContext
├── organizationId
├── storeId
├── userId
└── membership / role context
```

Only values resolved and validated by the server are authoritative.

---

# 6. Store Context

Most commerce operations are Store-scoped.

Examples:

- Products.
- Inventory.
- Customers.
- Carts.
- Discounts.
- Orders.
- Storefront configuration.

A Store context must therefore be resolved before executing Store-owned application operations.

---

# 7. Organization Context

Organization context represents the higher-level tenant boundary.

It may own:

- Store relationships.
- Organization memberships.
- Organization-level settings.

The Demo should not introduce unnecessary organization-level business logic unless required.

---

# 8. Membership Resolution

Membership resolution determines whether an authenticated user belongs to the requested organization or Store.

Conceptually:

```text
Authenticated User
        ↓
Membership Lookup
        ↓
Organization / Store
        ↓
Authorized Tenant Context
```

---

# 9. Membership Status

Only valid active memberships should normally grant access.

Possible states include:

```text id="v6n4c8"
active
invited
suspended
removed
```

The exact state model follows the domain documentation.

Suspended or removed memberships must not grant normal access.

---

# 10. Store Access

A user must not gain Store access merely by knowing a Store identifier.

For protected operations:

```text
Store ID
    ↓
Membership Resolution
    ↓
Authorization
    ↓
Access Granted / Denied
```

---

# 11. Client-Supplied Tenant IDs

Client-supplied identifiers may be used as a request selector.

They must never be treated as proof of authorization.

For example:

```text id="m7x3c9"
GET /api/v1/stores/{storeId}/products
```

must still verify that the authenticated user is allowed to access `{storeId}`.

---

# 12. Public Storefront Tenant Resolution

Public Storefront requests are different from merchant requests.

A public Store may be resolved using a public identifier such as:

- Store slug.
- Store domain.
- Public Store identifier.

The Store must then be checked for:

- Existence.
- Active/public status.
- Product publication rules.

---

# 13. Public vs Protected Context

The application should distinguish:

```text id="k8m4x2"
Public Storefront Context
        ↓
Public Store

Protected Merchant Context
        ↓
Authenticated User
        ↓
Membership
        ↓
Store
```

Public access must never bypass Store ownership checks for protected resources.

---

# 14. Tenant Resolution Pipeline

Protected request flow:

```text id="q5n8c3"
Request
  ↓
Authentication
  ↓
Identify User
  ↓
Resolve Organization / Store
  ↓
Load Membership
  ↓
Validate Membership
  ↓
Authorization
  ↓
Application Service
```

---

# 15. Authorization Separation

Tenant resolution answers:

> Which Store does this request belong to?

Authorization answers:

> Is this user allowed to perform this operation?

Both checks are required.

---

# 16. Tenant-Scoped Queries

Store-owned queries should always include the relevant ownership scope.

Conceptually:

```text id="x7m3v8"
WHERE store_id = :storeId
```

The application must not retrieve a resource globally and then hope to remember checking ownership afterward.

---

# 17. Resource Ownership

For every Store-owned resource, the implementation must know how ownership is established.

Examples:

```text id="n4c8m7"
Product → Store
Inventory → Store / Variant
Customer → Store
Cart → Store
Discount → Store
Order → Store
```

The exact ownership model is defined by each domain specification.

---

# 18. Tenant Isolation at Repository Level

Repositories should receive the tenant scope required by their operation.

Conceptually:

```text id="p8m4x6"
productRepository.getById(
    storeId,
    productId
)
```

rather than:

```text id="w6c3n9"
productRepository.getById(productId)
```

for Store-owned resources where the latter could permit accidental cross-tenant access.

---

# 19. Tenant Isolation at Application Level

Application services must require the correct tenant context.

For example:

```text id="r3n7m5"
updateProduct(
    tenantContext,
    productInput
)
```

The service must not silently infer authorization from a resource identifier.

---

# 20. Tenant Isolation at Database Level

PostgreSQL constraints and relationships should support tenant isolation.

The database should enforce:

- Valid Store references.
- Valid Organization references.
- Foreign-key integrity.
- Unique constraints within the correct scope.

Application isolation remains mandatory even if stronger database policies are introduced later.

---

# 21. Composite Uniqueness

Many business identifiers are unique only within a Store.

Examples:

```text id="z4m8c7"
(store_id, slug)
(store_id, sku)
(store_id, discount_code)
```

The exact uniqueness requirements belong to the corresponding domain.

---

# 22. Cross-Tenant Resource Access

A request such as:

```text id="m9c4x7"
Store A + Product belonging to Store B
```

must never succeed.

The preferred behavior should avoid leaking whether the foreign resource exists.

Where appropriate, return a tenant-safe not-found response.

---

# 23. Tenant-Safe Not Found

For protected resources, the API should generally avoid distinguishing:

```text id="h7m3x8"
Resource does not exist
```

from:

```text id="q8c4n6"
Resource exists but belongs to another tenant
```

when doing so could reveal cross-tenant information.

---

# 24. Tenant Context Propagation

Tenant context must be available to application services that require it.

It may be passed explicitly through:

```text id="c6m9x4"
Application Context
```

rather than relying on uncontrolled global mutable state.

---

# 25. Background Jobs

Background jobs must preserve tenant context where the operation is tenant-specific.

A job should contain enough information to determine its ownership safely.

For example:

```text id="x5n8m3"
Job
├── jobId
├── type
├── storeId
└── payload
```

The worker must validate that context before processing.

---

# 26. Events

Tenant-aware domain events should carry the necessary tenant identifiers.

Conceptually:

```text id="v3m7c8"
Event
├── eventId
├── type
├── organizationId
├── storeId
└── payload
```

Only include identifiers that are actually required.

---

# 27. Webhooks

External provider webhooks may not contain the application's Store identifier.

Webhook processing must therefore resolve the correct Store using trusted provider correlation data.

The resolved Store context must be validated before applying business changes.

---

# 28. Tenant Context in Logs

Operational logs should include tenant identifiers where useful.

For example:

```text id="n6x4m8"
requestId
storeId
organizationId
```

Do not log sensitive customer or authentication data merely because tenant context is available.

---

# 29. Tenant Context in Errors

Tenant identifiers should not be unnecessarily exposed to clients.

Internal logs may contain more diagnostic information than public API responses.

---

# 30. Tenant Isolation and Caching

Any future cache must include tenant scope in its key when the cached data is tenant-specific.

Example:

```text id="q7m3c8"
store:{storeId}:product:{productId}
```

A global key such as:

```text id="v8n4x2"
product:{productId}
```

must not be used where it could cause cross-tenant data leakage.

---

# 31. Tenant Isolation and Media

Media objects must also be Store-scoped where appropriate.

Object keys should include a safe ownership boundary.

Conceptually:

```text id="m5c8x3"
stores/{storeId}/media/{mediaId}
```

The exact object-storage layout is defined by the media implementation.

---

# 32. Tenant Isolation and Search

The Demo does not use a dedicated search engine.

Database queries for Store-scoped resources must still apply tenant constraints.

If search infrastructure is introduced later, tenant scope must become part of the indexed/searchable data model.

---

# 33. Tenant Isolation and Reports

Any future reporting or analytics query must apply the same tenant boundaries.

The absence of a dedicated analytics system does not remove the requirement.

---

# 34. Tenant Isolation Tests

Tenant isolation requires explicit automated testing.

At minimum:

```text id="x9m4c7"
User A → Store A → allowed
User A → Store B → denied

User B → Store B → allowed
User B → Store A → denied
```

Tests should cover:

- Read access.
- Write access.
- Delete operations.
- Nested resources.
- API routes.
- Background jobs.
- Webhooks.
- Media.
- Storefront behavior where applicable.

---

# 35. Cross-Tenant Integration Tests

Integration tests should attempt realistic cross-tenant attacks.

Examples:

```text id="k6n3v8"
Change URL Store ID
Change Product ID
Change Order ID
Change Customer ID
Replay another tenant's identifier
```

Every path must remain protected.

---

# 36. Tenant Context Validation

Tenant context should be considered invalid when:

- Store does not exist.
- Organization does not exist.
- Membership is missing.
- Membership is inactive.
- Store does not belong to the organization.
- User is not authorized for the Store.

Invalid context must stop execution before business logic runs.

---

# 37. Tenant Context and Transactions

Tenant resolution should normally occur before the business transaction.

Once the application service begins its transaction, the tenant context should already be trusted.

Critical database operations must still include tenant ownership conditions where required.

---

# 38. Tenant Context and Transactions

For sensitive updates, tenant ownership should be enforced within the same transaction as the modification.

For example:

```text id="z7m4c9"
BEGIN
    ↓
Verify Store-scoped resource
    ↓
Modify resource
    ↓
COMMIT
```

This avoids race conditions between a separate authorization lookup and the mutation.

---

# 39. Tenant Deletion

Tenant deletion is a domain operation, not a generic database cleanup operation.

Before deleting or deactivating an Organization or Store, the system must define behavior for:

- Products.
- Inventory.
- Customers.
- Carts.
- Orders.
- Payments.
- Media.
- Jobs.
- Webhooks.

Orders and payment records may require retention rather than deletion.

---

# 40. Tenant Suspension

Store or organization suspension should prevent the appropriate operations without necessarily deleting data.

For example:

```text id="r4n8m3"
Suspended Store
    ↓
Merchant operations restricted
    ↓
Storefront disabled
    ↓
Historical data retained
```

The exact behavior belongs to the Store domain.

---

# 41. Tenant Context API

The tenant package should expose a small public interface.

Conceptually:

```text id="m8c4x7"
resolveTenantContext()
requireStoreAccess()
requireOrganizationAccess()
```

The exact API should follow implementation conventions.

Avoid exposing low-level membership queries to every application layer.

---

# 42. Tenant Package Dependencies

The tenant package may depend on:

```text id="p6n3v9"
auth
db
types
```

It should not depend on:

```text id="x4m8c7"
products
orders
inventory
payments
```

This keeps tenant infrastructure foundational.

---

# 43. Tenant Context and UI

The UI may display the currently selected Store.

However, the selected Store in client state is only a request input.

The server must independently resolve and authorize the Store.

---

# 44. Tenant Switching

If a user has access to multiple Stores, switching Stores should:

1. Select the requested Store.
2. Send the Store context to the server.
3. Resolve membership.
4. Authorize access.
5. Establish the new request context.

Changing a client-side Store selector must never itself grant access.

---

# 45. Tenant Context and URLs

Store identifiers in URLs may be:

- Store IDs.
- Slugs.
- Domains.

Regardless of representation, the server must resolve them to a trusted Store record.

Public identifiers do not constitute authorization.

---

# 46. Tenant Isolation Definition of Done

```text id="q8m3v6"
[ ] Tenant hierarchy is implemented
[ ] User-to-membership relationship exists
[ ] Organization-to-Store relationship exists
[ ] Tenant context exists
[ ] Store context exists
[ ] Membership resolution works
[ ] Protected routes require tenant resolution
[ ] Store-owned queries are tenant-scoped
[ ] Repository methods enforce required scope
[ ] Application services receive trusted tenant context
[ ] Cross-tenant access is denied
[ ] Tenant-safe not-found behavior exists
[ ] Background jobs preserve tenant context
[ ] Tenant-aware events exist where required
[ ] Webhook tenant resolution is safe
[ ] Tenant context appears safely in logs
[ ] Media ownership is tenant-aware
[ ] Caching rules preserve tenant isolation
[ ] Cross-tenant integration tests exist
[ ] Tenant switching is server-authorized
```

---

# 47. Final Tenant Principle

Every Store-owned operation must answer two questions before changing or exposing data:

```text id="f4m8x2"
1. Which tenant does this resource belong to?

2. Is this user or process authorized to operate within that tenant?
```

The intended security boundary is:

```text
Authenticated Identity
        ↓
Tenant Resolution
        ↓
Membership
        ↓
Authorization
        ↓
Store-Scoped Operation
        ↓
Store-Scoped Data
```

Tenant isolation must remain enforced across HTTP requests, database queries, background jobs, events, webhooks, media, and future infrastructure. A single forgotten boundary is enough to turn "multi-tenant" into "multiple tenants sharing everyone's data," which is a rather spectacular way to ruin a commerce platform.