# Tenant Implementation

## 1. Purpose

This document defines how multi-tenancy is implemented across the Demo.

The tenant model is based on:

```text id="x7p4m8"
Organization
    ↓
Membership
    ↓
Store
    ↓
Store-owned resources
```

Tenant isolation is a **security and correctness requirement**, not merely a filtering convention.

A user must never gain access to another Store's data by manipulating identifiers, URLs, request bodies, or client-side state.

---

# 2. Tenant Ownership

Tenant infrastructure is provided by:

```text id="q5m8r3"
packages/tenant
```

The tenant package provides context and resolution capabilities.

Domain modules remain responsible for their own Store-scoped data.

---

# 3. Tenant Model

The Demo uses:

```text id="v8n4p6"
Organization
Membership
Store
```

An Organization represents the merchant/business boundary.

A Store represents the primary commerce boundary.

Store-owned resources include:

```text id="m7r3q8"
Products
Inventory
Customers
Carts
Discounts
Checkout
Payments
Orders
Storefront configuration
```

---

# 4. Organization

An Organization groups one or more Stores and their associated memberships.

It may represent:

- A company.
- A merchant business.
- A business account.

The Organization itself is not necessarily the public storefront identity.

---

# 5. Store

The Store is the primary operational tenant.

Most commerce operations should resolve to exactly one Store.

Examples:

```text id="x4n7p5"
Create Product
Adjust Inventory
Create Discount
View Customer
Process Checkout
Create Order
```

must all have an explicit Store context.

---

# 6. Membership

Membership determines whether a User has access to an Organization or Store.

Membership contains trusted authorization information such as:

```text id="m6q8r4"
user_id
organization_id
store_id where applicable
role
status
```

The exact model follows the approved authorization architecture.

---

# 7. Tenant Context

The tenant package should provide an explicit context such as:

```text id="v7p4m9"
TenantContext
├── organizationId
├── storeId
├── membership
└── permissions/role
```

The exact shape may evolve.

The important requirement is that Store context is explicit and trusted.

---

# 8. Context Resolution

A merchant request should follow:

```text id="q8m5r3"
Request
  ↓
Authentication
  ↓
User identity
  ↓
Requested Store context
  ↓
Membership lookup
  ↓
Authorization
  ↓
Trusted TenantContext
```

Only after this process should a Store-scoped application operation execute.

---

# 9. Store Selection

A merchant may operate multiple Stores.

The current Store may be selected through a route, session context, or another approved mechanism.

Regardless of how it is selected:

```text id="x5r8m4"
client-selected Store ID
```

must be treated as an untrusted request value until membership authorization succeeds.

---

# 10. Public Storefront Resolution

Public storefront requests may resolve Store identity differently.

For example:

```text id="m4q7n8"
store slug/domain
    ↓
Store resolution
    ↓
Store status/publication checks
    ↓
public Store context
```

Public resolution must expose only intentionally public data.

---

# 11. Tenant Context Types

Keep context types explicit.

Examples:

```text id="v6p3r9"
AuthenticatedContext
MerchantTenantContext
PublicStoreContext
```

Do not use one ambiguous object for every request type if the security guarantees differ.

---

# 12. Merchant Context

A merchant context should contain enough information to authorize Store operations.

Conceptually:

```text id="q7m4p8"
userId
organizationId
storeId
membershipId
role
permissions
```

The context must be created server-side.

---

# 13. Public Context

A public storefront context may contain:

```text id="x8r5m3"
storeId
public Store configuration
publication state
```

It must not automatically contain merchant privileges.

---

# 14. Tenant Isolation Rule

Every Store-scoped operation must satisfy:

```text id="m5q8v4"
resource.store_id === authorizedContext.store_id
```

This should be enforced through:

- Application service authorization.
- Repository query scoping.
- Database constraints where appropriate.

---

# 15. Never Trust Client Store IDs

The following must never establish authorization:

```text id="v4n7p6"
URL /stores/123
body.storeId = 123
query.storeId = 123
localStorage.storeId = 123
```

They identify a requested resource only.

The server must verify access independently.

---

# 16. Repository Scoping

Repositories handling Store-owned entities should require Store context where appropriate.

Prefer:

```text id="q6m4r8"
productRepository.findById(storeId, productId)
```

over:

```text id="x7p5n3"
productRepository.findById(productId)
```

when the latter could accidentally permit an unscoped query.

---

# 17. Query Safety

Queries for Store-owned data should explicitly include Store scope where appropriate.

Example:

```text id="m8q4v7"
WHERE id = :productId
AND store_id = :storeId
```

This provides defense in depth.

---

# 18. Cross-Tenant Resource Lookup

A lookup for a resource belonging to another Store should not reveal sensitive existence information.

Depending on the API contract, the result may be:

```text id="v5r8m3"
Not Found
```

rather than exposing that the resource exists but belongs elsewhere.

---

# 19. Composite Relationships

When two resources belong to different Store contexts, the relationship must be rejected.

For example:

```text id="q4n7p8"
Cart.store_id = Store A
CartItem.variant → Variant belonging to Store B
```

must never be accepted.

Application validation and database constraints should provide defense in depth.

---

# 20. Organization Isolation

Organization boundaries must also be respected.

A user belonging to Organization A must not automatically access Organization B.

Store membership should be validated against the correct Organization relationship.

---

# 21. Membership Status

Membership records should have explicit status.

For example:

```text id="x6m3r9"
active
suspended
revoked
pending
```

Only valid membership states should grant access.

---

# 22. Role Resolution

Roles must be resolved from trusted membership data.

Do not accept:

```text id="m7q5v4"
role from request body
role from URL
role from client state
```

as authoritative.

---

# 23. Permission Resolution

The authorization layer may derive permissions from the membership role.

Conceptually:

```text id="v8r4m6"
Membership Role
      ↓
Permission Set
      ↓
Authorization Decision
```

Permission definitions should remain centralized rather than duplicated across pages.

---

# 24. Owner Access

The Owner should have the highest Store management permissions defined by the product requirements.

Owner access must still pass through the normal server-side authorization mechanism.

Do not implement Owner as:

```text id="q5m7n8"
if role === "owner" then bypass everything
```

without checking the operation's actual authorization requirements.

---

# 25. Admin Access

Admin permissions should follow the approved role matrix.

Admins must not automatically receive permissions that belong exclusively to Owners unless explicitly defined.

---

# 26. Staff Access

Staff should have limited operational permissions.

Examples may include:

```text id="x4r8m5"
Product operations
Inventory operations
Order operations
Customer operations
```

The exact permission set follows the User Roles and authorization specifications.

---

# 27. Customer Context

Customers interact with a Store but are not automatically merchant members.

A customer identity should not grant access to:

```text id="m6q4v9"
Merchant dashboard
Inventory management
Store settings
Other customers
Merchant reports
```

---

# 28. Customer Store Scope

A Customer record must remain Store-scoped.

A customer with the same email in two Stores may represent separate Store-specific customer records according to the approved model.

---

# 29. Guest Context

Guest storefront requests have no authenticated merchant membership.

Guest operations must be restricted to explicitly allowed public capabilities.

For example:

```text id="v7n5r3"
Browse published products
Create/use a guest cart
Begin checkout
```

They must not gain merchant access.

---

# 30. Tenant-Aware Caching

Cached data must include tenant identity in its cache key when the data is Store-specific.

Bad:

```text id="q8m4v6"
product:123
```

when Product 123 is only meaningful inside a Store.

Prefer:

```text id="x5r7n8"
store:456:product:123
```

where caching is used.

---

# 31. Tenant-Aware Jobs

Background jobs involving Store data should carry sufficient context.

For example:

```text id="m4q8r5"
{
  storeId,
  orderId
}
```

The worker must not assume that an identifier alone is globally sufficient when the domain uses Store scoping.

---

# 32. Tenant-Aware Events

Domain events should include relevant Store/Organization context where consumers need it.

Example:

```text id="v6n3p8"
OrderCompleted
{
  orderId,
  storeId,
  ...
}
```

Events should not contain unnecessary sensitive tenant information.

---

# 33. Tenant-Aware Notifications

Notifications must resolve recipients and resources within the correct Store context.

A notification generated for Store A must never accidentally reference Store B data.

---

# 34. Tenant-Aware Media

Media records must include appropriate Store ownership.

Object keys should also be designed so that Store boundaries are explicit.

Example:

```text id="q7m5r4"
stores/{storeId}/products/{productId}/...
```

The exact object-key convention follows the Media implementation.

---

# 35. Tenant-Aware Webhooks

Incoming provider webhooks must be associated with the correct Store using trusted provider metadata or persisted integration configuration.

Never trust an arbitrary client-provided Store ID to associate a webhook with a tenant.

---

# 36. Tenant-Aware Payment Operations

Payment records must remain Store-scoped.

A payment reference from one Store must not be usable to mutate another Store's payment.

Provider identifiers should be validated against the Store's integration context.

---

# 37. Tenant-Aware Orders

Orders must belong to exactly one Store.

All merchant order operations must verify:

```text id="x4r7m8"
authenticated user
→ membership
→ Store
→ order.store_id
```

---

# 38. Tenant-Aware Inventory

Inventory is strictly Store-scoped through the Product/Variant relationship.

Inventory operations must not accept a Variant solely by global identifier without verifying Store ownership.

---

# 39. Tenant-Aware Discounts

Discounts and codes must belong to the correct Store.

A discount code from Store A must never apply to a checkout belonging to Store B.

---

# 40. Tenant-Aware Checkout

Checkout must resolve a Store and ensure:

```text id="m8q5v4"
Cart.store_id
Checkout.store_id
Product/Variant.store_id
Discount.store_id
```

are compatible.

---

# 41. Database Defense in Depth

Tenant isolation must not depend solely on UI or application code.

The database should provide:

```text id="v7r3n6"
Foreign keys
Composite relationships where necessary
Store ownership columns
Unique constraints
```

The application remains responsible for authorization.

---

# 42. Row-Level Security

PostgreSQL Row-Level Security is **not required for the Demo** unless a concrete requirement emerges.

Application-level tenant isolation combined with database integrity constraints is the approved Demo approach.

Do not introduce RLS merely because it sounds enterprise-grade.

---

# 43. Tenant Context and Transactions

Tenant authorization must occur before executing the business operation.

For critical workflows, the transaction should still validate resource ownership where necessary.

Example:

```text id="q4m8r7"
Resolve Store
  ↓
Authorize
  ↓
Begin transaction
  ↓
Load Store-scoped records
  ↓
Apply operation
  ↓
Commit
```

---

# 44. Tenant Context Propagation

Tenant context may need to propagate through:

```text id="x6n5p8"
Application services
Repositories
Events
Jobs
Logging
External integration metadata
```

Only propagate the minimum information required.

---

# 45. Tenant Context in Logs

Structured logs may include:

```text id="m7q4r3"
organizationId
storeId
userId
```

where operationally useful and privacy-safe.

Never log sensitive customer or payment information merely because tenant context is available.

---

# 46. Tenant Context in Errors

API errors should not expose another tenant's identifiers or internal ownership information.

Error responses must remain tenant-safe.

---

# 47. Tenant Isolation Testing

Tenant isolation requires dedicated automated tests.

At minimum:

```text id="v8r5m4"
User in Store A cannot read Store B product
User in Store A cannot modify Store B product
User in Store A cannot read Store B order
User in Store A cannot modify Store B inventory
Store A discount cannot apply to Store B checkout
Store A cart cannot contain Store B variant
```

---

# 48. Role + Tenant Testing

Tests should combine:

```text id="q5m7n8"
User
+
Store
+
Role
+
Operation
```

Examples:

```text id="x4r8m6"
Store A Owner → allowed
Store A Staff → operation-dependent
Store B Owner → denied against Store A
Unauthenticated user → denied
```

---

# 49. Tenant Enumeration Protection

Public and authenticated APIs should avoid allowing attackers to enumerate tenant resources through predictable IDs or error differences.

Use:

- Authorization checks.
- Non-sensitive identifiers.
- Tenant-scoped lookups.
- Safe not-found behavior.

---

# 50. Tenant Deletion

Store/Organization deletion is not a trivial operation.

The Demo should not implement destructive tenant deletion unless explicitly required.

If implemented later, it must address:

```text id="m6q3v8"
Orders
Payments
Customers
Media
Jobs
Webhooks
Audit history
External provider state
```

---

# 51. Tenant Creation

Store creation must establish valid ownership:

```text id="v7m4r5"
Authenticated Owner
  ↓
Organization access
  ↓
Create Store
  ↓
Create appropriate membership
  ↓
Initialize Store configuration
```

The entire operation should use the appropriate transaction boundary.

---

# 52. Tenant Context Failure

If tenant resolution fails:

```text id="q8r5m4"
Do not continue with a partially resolved context.
```

The request must fail closed.

---

# 53. AI-Assisted Tenant Rules

AI-generated tenant-aware code must:

1. Read the actual `AGENTS.md`.
2. Inspect the relevant domain and security specifications.
3. Identify Store ownership.
4. Verify authorization before data access.
5. Avoid unscoped repository queries.
6. Check cross-tenant relationships.
7. Add tenant-isolation tests.
8. Review generated SQL.
9. Avoid relying on client-side Store IDs.
10. Verify the final diff for data exposure.

---

# 54. Tenant Implementation Order

Implement tenant infrastructure in this order:

```text id="x6m8p3"
1. Organization persistence
2. Store persistence
3. Membership persistence
4. Tenant context types
5. Tenant resolution
6. Membership lookup
7. Role/permission resolution
8. Store-scoped repository patterns
9. Public Store resolution
10. Tenant-aware jobs/events
11. Tenant security tests
```

---

# 55. Definition of Done

Tenant implementation is complete when:

```text id="v5q7m4"
[ ] Organization model works
[ ] Store model works
[ ] Membership model works
[ ] Tenant context is explicit
[ ] Authenticated Store resolution works
[ ] Public Store resolution works
[ ] Roles come from trusted membership data
[ ] Store-scoped queries are enforced
[ ] Cross-tenant relationships are prevented
[ ] Jobs carry required tenant context
[ ] Events carry required tenant context
[ ] Payments remain Store-scoped
[ ] Orders remain Store-scoped
[ ] Inventory remains Store-scoped
[ ] Discounts remain Store-scoped
[ ] Checkout enforces Store consistency
[ ] Tenant isolation tests pass
[ ] Authorization tests pass
[ ] No client-supplied Store ID is trusted directly
[ ] TypeScript passes
[ ] Lint passes
```

---

# 56. Final Principle

Tenant isolation must be treated as a **system-wide invariant**.

It is not enough for the dashboard to hide another Store's data. Every server-side access path must independently preserve the boundary:

```text
User
  ↓
Membership
  ↓
Store
  ↓
Resource
```

If that chain breaks anywhere, the platform is not merely buggy. It has a security defect.