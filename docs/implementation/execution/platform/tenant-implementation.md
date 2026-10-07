# Tenant Implementation

## 1. Purpose

This document defines the concrete implementation of multi-tenant isolation for the Demo.

The tenant system establishes the security and ownership context connecting:

```text
User
  ↓
Organization
  ↓
Membership
  ↓
Store
  ↓
Store-owned Resources
```

Its primary responsibility is ensuring that authenticated users can access only the organizations and Stores they are authorized to access.

Tenant isolation is a core security boundary and must not depend on frontend behavior.

---

# 2. Tenant Ownership Model

The Demo uses:

```text
Organization
    │
    ├── Memberships
    │       └── Users
    │
    └── Stores
            └── Store-owned resources
```

Typical Store-owned resources include:

```text
Products
Inventory
Customers
Carts
Discounts
Checkouts
Payments
Orders
Media
```

Not every resource necessarily stores every hierarchy level directly, but ownership must always be deterministically resolvable.

---

# 3. Tenant Package

Tenant infrastructure belongs to:

```text id="m8c4x7"
packages/tenant
```

The package provides:

- Tenant context.
- Store context.
- Membership resolution interfaces.
- Access checks.
- Tenant-scoped helpers.
- Context propagation.

It must not own Product, Order, Inventory, or other domain business rules.

---

# 4. Tenant Context

A protected request should establish a context similar to:

```text id="q7m3c8"
User
 ↓
Organization
 ↓
Membership
 ↓
Store
 ↓
Role
```

The context should be immutable after resolution.

A request must not silently switch Store context halfway through execution.

---

# 5. Request Context

The broader request context may contain:

```text id="v8m4c7"
requestId
userId
sessionId
organizationId
membershipId
storeId
role
```

Only values required by the operation need to be populated.

---

# 6. Tenant Resolution

Tenant resolution should follow:

```text id="x5m8c4"
Request
 ↓
Authenticated User
 ↓
Requested Organization / Store
 ↓
Membership Lookup
 ↓
Authorization
 ↓
Tenant Context
```

A Store identifier supplied by the client is only a lookup value.

It is never proof of authorization.

---

# 7. Store Resolution

Merchant requests may identify a Store through:

- Route parameters.
- Selected Store context.
- Session/application context.
- Explicit API parameters.

The implementation must normalize these mechanisms into a single internal Store context.

---

# 8. Membership Resolution

For protected Store operations:

```text id="m7c4x8"
userId
+
storeId
      ↓
membership
      ↓
role
      ↓
permission
```

If no valid membership exists, the request must not access the Store.

---

# 9. Organization Membership

Where the organization layer is used:

```text id="q8m3c7"
User
 ↓
Organization Membership
 ↓
Store Membership / Access
```

The implementation must ensure that organization membership cannot accidentally grant access to unrelated Stores.

---

# 10. Role Resolution

The tenant system should expose the user's effective role for the relevant Store.

Demo roles:

```text id="v4m8c7"
Owner
Admin
Staff
```

Customer access should be handled through the customer/authentication model rather than granting merchant Store roles.

---

# 11. Authorization Integration

Tenant resolution establishes scope.

Authorization determines permission.

The flow is:

```text id="x7m4c8"
Authentication
      ↓
Tenant Resolution
      ↓
Membership
      ↓
Role
      ↓
Permission Check
      ↓
Application Service
```

Do not treat successful tenant resolution as sufficient authorization for every action.

---

# 12. Store Context for Public Storefront

Storefront requests may not have an authenticated User.

Public Store resolution can therefore use:

```text id="m8c4x7"
Domain / Slug
      ↓
Store Lookup
      ↓
Store Public Status
      ↓
Public Store Context
```

The Store must be:

- Publicly resolvable.
- Active.
- Eligible to expose the requested resource.

---

# 13. Tenant Context Types

The implementation should distinguish contexts.

For example:

```text id="q5m8c4"
AuthenticatedTenantContext
PublicStoreContext
SystemJobContext
```

This avoids pretending that every operation has a User session.

---

# 14. Background Job Context

Jobs do not have interactive authentication sessions.

Tenant-owned jobs should carry trusted context such as:

```text id="v7m4c8"
organizationId
storeId
```

The job handler must still verify resource ownership.

A job payload must never become an authorization bypass.

---

# 15. System Operations

Some operations may be system-level.

Examples:

```text id="x8m3c7"
Cleanup
Reconciliation
Migration
Operational maintenance
```

System operations must use explicit internal context.

They must not impersonate arbitrary Users without a controlled mechanism.

---

# 16. Repository Scoping

Repositories for Store-owned resources should require Store scope.

Preferred:

```text id="m4c8x7"
productRepository.findById(
  storeId,
  productId
)
```

rather than:

```text id="q8m3c7"
productRepository.findById(productId)
```

This makes missing tenant scope harder to overlook.

---

# 17. Application Service Scoping

Application services must receive the tenant context required for the operation.

Example:

```text id="v5m8c4"
UpdateProduct({
  tenantContext,
  productId,
  changes
})
```

The service must not trust a client-supplied Store ID without verifying it against the resolved context.

---

# 18. Database Scoping

Database queries should apply Store ownership directly.

Example:

```sql id="x7m4c8"
SELECT *
FROM products
WHERE store_id = $1
  AND id = $2;
```

This is preferable to:

```text id="m8c4x7"
SELECT by product ID
        ↓
Check Store afterward
```

The latter increases the chance of accidental data exposure.

---

# 19. Composite Uniqueness

Store-scoped resources should use composite uniqueness where required.

Examples:

```text id="q4m8c7"
(store_id, sku)
(store_id, slug)
(store_id, discount_code)
```

The exact constraints depend on the domain specifications.

---

# 20. Tenant-Safe Not Found

When a resource belongs to another tenant:

```text id="v8m3c7"
Tenant A requests Tenant B resource
        ↓
No visible resource
        ↓
Safe 404-style behavior
```

The API must not reveal:

- That the resource exists.
- Which Store owns it.
- Resource metadata.

---

# 21. Cross-Tenant Mutation Protection

Every mutation must verify ownership before changing data.

Examples:

```text id="x5m8c4"
Update Product
Delete Product
Adjust Inventory
Update Customer
Apply Discount
Modify Order
```

No mutation should operate solely on a globally unique resource ID without resolving its Store ownership where required.

---

# 22. Cross-Tenant Relationships

Relationships between resources must be tenant-safe.

Example:

```text id="m7c4x8"
Store A Cart
      ↓
Store B Product
```

must be rejected.

Similarly:

```text id="q8m3c7"
Store A Order
      ↓
Store B Customer
```

must never be possible.

---

# 23. Cross-Tenant IDs

Globally unique IDs do not eliminate tenant checks.

Even if:

```text id="v4m8c7"
product_id = UUID
```

is globally unique, the application must still verify Store ownership.

UUIDs are identifiers, not authorization.

---

# 24. Tenant Isolation in Events

Domain events involving Store-owned resources should carry tenant context where needed.

Example:

```text id="x7m4c8"
OrderCreated
├── eventId
├── organizationId
├── storeId
└── orderId
```

Consumers must preserve the context.

---

# 25. Tenant Isolation in Jobs

Jobs should preserve:

```text id="m8c4x7"
organizationId
storeId
```

where required.

A worker handler should use those values to scope repository operations.

---

# 26. Tenant Isolation in Webhooks

External webhook events may not originate from an authenticated tenant context.

The webhook integration must map the provider event to the correct internal Store using trusted provider configuration and persisted integration data.

Never accept arbitrary tenant identifiers from unverified webhook payload fields as authorization.

---

# 27. Tenant Isolation in Media

Media metadata should be associated with the correct Store.

Object storage keys should prevent accidental cross-tenant collisions.

Conceptually:

```text id="q5m8c4"
stores/
  <store-id>/
    products/
      <media-id>
```

The exact object-key structure may differ, but ownership must be explicit.

---

# 28. Tenant Isolation in Caching

If caching is introduced, cache keys must include the required tenant scope.

Bad:

```text id="v8m3c7"
product:<id>
```

Safer:

```text id="x4m8c7"
store:<store-id>:product:<id>
```

Demo may have minimal caching, but tenant-aware key design must remain mandatory if caching is introduced.

---

# 29. Tenant Isolation in Search

A dedicated search engine is not part of Demo.

If search-like database queries are implemented, Store filtering remains mandatory.

Future V1 search infrastructure must preserve Store scope in every query.

---

# 30. Tenant Switching

When a merchant belongs to multiple Stores:

```text id="m7c4x8"
Current Store
      ↓
Select New Store
      ↓
Verify Membership
      ↓
Update Context
      ↓
Load New Store Data
```

Client-side Store switching must not bypass server-side membership verification.

---

# 31. Store Suspension

If a Store is suspended:

- Merchant operations should follow the Store lifecycle rules.
- Public Storefront access should be restricted.
- Existing historical Orders must remain accessible according to policy.
- Background jobs must handle suspended Stores safely.
- New commerce operations should be rejected where required.

---

# 32. Store Deletion

Deletion must account for dependent resources.

Do not casually cascade-delete:

```text id="q8m4c7"
Orders
Payments
Financial records
Audit information
```

Historical data requirements take precedence.

Where appropriate, Stores should be archived or deactivated instead of physically deleted.

---

# 33. Tenant Context Propagation

Tenant context should be propagated through:

```text id="v5m8c4"
HTTP Request
   ↓
Application Service
   ↓
Repository
```

and, for asynchronous work:

```text id="x7m3c8"
Domain Event
   ↓
Job
   ↓
Worker
   ↓
Handler
   ↓
Repository
```

The context must remain explicit.

---

# 34. Tenant Context and Transactions

Transactions should operate within the resolved tenant context.

Example:

```text id="m4c8x7"
Tenant Context
      ↓
Application Service
      ↓
Transaction
      ↓
Store-scoped Repository Operations
```

A transaction must not mix unrelated tenant contexts accidentally.

---

# 35. Tenant Security Tests

Required tests include:

```text id="q8m4c7"
[ ] User can access authorized Store
[ ] User cannot access unauthorized Store
[ ] Store A cannot read Store B product
[ ] Store A cannot modify Store B inventory
[ ] Store A cannot read Store B customer
[ ] Store A cannot access Store B cart
[ ] Store A cannot access Store B order
[ ] Store A cannot use Store B discount
[ ] Store A cannot reference Store B resources
[ ] Public Storefront exposes only its own data
[ ] Job cannot cross tenant boundaries
[ ] Webhook mapping cannot cross tenant boundaries
```

---

# 36. Tenant Isolation Test Pattern

A reusable test pattern should establish:

```text id="v8m4c7"
Create Store A
Create Store B
Create equivalent resources
      ↓
Authenticate User A
      ↓
Attempt Store B access
      ↓
Expect safe rejection
```

This pattern should be reused across domain modules.

---

# 37. Tenant Implementation Sequence

Implement in this order:

```text id="x5m8c4"
1. Define tenant context types
2. Implement organization lookup
3. Implement membership lookup
4. Implement Store resolution
5. Implement role resolution
6. Implement protected request context
7. Implement public Store context
8. Implement repository scoping helpers
9. Integrate authorization
10. Integrate background-job context
11. Integrate event context
12. Integrate webhook context
13. Add tenant isolation tests
14. Run cross-domain security verification
```

---

# 38. Tenant Verification

The tenant foundation is ready when:

```text id="m7c4x8"
[ ] Organization context resolves
[ ] Membership context resolves
[ ] Store context resolves
[ ] Roles resolve correctly
[ ] Unauthorized Stores are rejected
[ ] Public Storefront resolution works
[ ] Repositories require appropriate scope
[ ] Cross-tenant reads fail safely
[ ] Cross-tenant writes fail safely
[ ] Cross-tenant relationships are rejected
[ ] Jobs preserve tenant context
[ ] Events preserve tenant context
[ ] Webhooks resolve tenant safely
[ ] Tenant isolation tests pass
```

---

# 39. Definition of Done

Tenant implementation is complete when Store ownership is an enforceable application invariant rather than merely a convention.

The system must consistently enforce:

```text id="q4m8c7"
Identity
   +
Membership
   +
Store Context
   +
Authorization
   +
Scoped Persistence
   +
Tenant-Aware Async Work
```

The most important rule is simple:

**A resource being identifiable does not mean it is accessible. Access always requires valid tenant ownership or an explicitly authorized system context.**