# Tenant Isolation

## 1. Purpose

This document defines the tenant-isolation model and security requirements for the Shopify-like commerce platform.

Tenant isolation ensures that data and operations belonging to one organization or store cannot be accessed or modified by another unauthorized tenant.

For this platform, tenant isolation is a **mandatory security and correctness boundary**.

---

## 2. Core Principle

The system must treat tenant context as trusted server-side context, never as an arbitrary client-controlled value.

The fundamental rule is:

```text id="7wq4n1"
No tenant context
        ↓
No tenant-scoped operation
```

A request must establish the authorized tenant before accessing tenant-owned resources.

---

## 3. Tenant Hierarchy

The Demo uses:

```text id="9m2x7k"
Organization
    ↓
Store
    ↓
Store-owned resources
```

Users are connected through memberships:

```text id="p5v8r3"
User
  ↓
Organization Membership
  ↓
Organization
  ↓
Store Membership
  ↓
Store
```

The exact relationship must follow the database and domain specifications.

---

## 4. Primary Isolation Boundary

The primary operational isolation boundary is the **Store**.

Most commerce resources are store-owned:

- Products.
- Variants.
- Inventory.
- Customers.
- Carts.
- Discounts.
- Checkouts.
- Payments.
- Orders.
- Store settings.
- Store media.

Every access path to these resources must respect store ownership.

---

## 5. Organization Scope

Organization-level resources may exist above stores.

Organization-scoped access must still verify that the authenticated user is an authorized member of that organization.

A user belonging to one organization must not gain access to another organization's data.

---

## 6. Store Context Resolution

A protected request should follow:

```text id="n7x3m5"
Request
  ↓
Authentication
  ↓
Requested store context
  ↓
Verify user membership
  ↓
Verify membership status
  ↓
Resolve authorization
  ↓
Perform store-scoped operation
```

The client may identify the requested store, but the server must independently verify that the user is authorized to access it.

---

## 7. Client Input Is Untrusted

The following must never be trusted directly:

```json id="0k0m4g"
{
  "storeId": "another-store",
  "organizationId": "another-org",
  "userId": "another-user"
}
```

These values may be used as lookup parameters, but authorization must independently establish whether they are valid for the authenticated identity.

---

## 8. Database Scoping

Tenant-aware database queries should explicitly scope resources to the authorized tenant.

Conceptually:

```text id="2j9v6m"
Find product
WHERE product.id = requestedId
AND product.store_id = authorizedStoreId
```

Prefer queries that combine identity and tenant scope rather than:

```text id="f5n2x8"
Find product by ID
→ Load product
→ Check tenant later
```

The latter pattern creates greater risk of accidental data leakage.

---

## 9. Repository Responsibility

Repositories accessing tenant-owned resources should require sufficient tenant context.

A repository should not silently perform an unscoped query when the resource is tenant-owned.

For example:

```text id="8q3m5v"
findProduct(storeId, productId)
```

is preferable to an unrestricted:

```text id="4n7x2p"
findProduct(productId)
```

when the domain requires store isolation.

---

## 10. Module Boundaries

Each domain module must preserve tenant isolation.

Examples:

```text id="z1m8q4"
Products
→ store-scoped

Inventory
→ store-scoped

Orders
→ store-scoped

Customers
→ store-scoped
```

A module must not assume that another module has already performed all security checks unless the interface explicitly guarantees the required trusted context.

---

## 11. Cross-Module Access

Modules must interact through public application interfaces or domain events.

They must not bypass tenant boundaries by directly querying another module's internal tables.

For example:

```text id="p7k3m9"
Checkout
→ Inventory public interface
```

rather than:

```text id="w4n8q2"
Checkout
→ Inventory internal table
```

This keeps ownership and security boundaries explicit.

---

## 12. API Isolation

Every tenant-scoped API must enforce tenant context.

Examples include:

```text id="x9m4q6"
GET    /api/v1/products
POST   /api/v1/products
GET    /api/v1/orders/{id}
PATCH  /api/v1/inventory/{id}
GET    /api/v1/customers
```

The authenticated user must be authorized for the relevant store before data is returned or modified.

---

## 13. URL-Based Tenant Resolution

If the store is represented in the URL, the URL value is only a lookup hint.

For example:

```text id="j6v3p8"
/stores/store-a/products
```

must not mean:

```text id="q2m7x5"
User automatically has access to Store A
```

Membership and authorization must still be verified.

---

## 14. Storefront Tenant Resolution

Public storefront requests may resolve a store from:

- Domain.
- Subdomain.
- Store slug.
- Other configured storefront identifier.

The resolved store must become trusted server-side context before accessing storefront data.

Example:

```text id="r8n3v6"
shop.example.com
      ↓
Resolve Store A
      ↓
Load Store A catalog
```

A malformed or manipulated hostname must not cause access to another tenant.

---

## 15. Storefront Public Data

Public storefront data is still tenant-scoped.

A product being publicly visible does not mean:

```text id="0y2g3x"
product ID
→ globally interchangeable
```

The system must resolve the correct store before loading the product.

---

## 16. Customer Isolation

Customer records are store-scoped.

A customer in Store A must not be visible to Store B.

Merchant customer queries must include the authorized store context.

Customer self-service must additionally verify customer ownership.

---

## 17. Cart Isolation

Carts must be isolated by both store and ownership/context.

Examples:

```text id="x7q4m2"
Customer A
→ Store A Cart A = allowed

Customer A
→ Store B Cart B = denied
```

Guest cart access must similarly remain tied to its valid session/context.

---

## 18. Checkout Isolation

Checkout records must be scoped to the appropriate store.

A checkout identifier must not be sufficient to retrieve or modify checkout data.

The system must validate:

- Store.
- Customer or guest context.
- Checkout state.
- Operation authorization.

---

## 19. Payment Isolation

Payment records are sensitive and tenant-scoped.

Payment operations must verify:

```text id="h3m8q5"
Authorized store
+
Authorized payment
+
Valid operation
```

Payment identifiers must never provide unrestricted access.

---

## 20. Order Isolation

Orders must always remain within their owning store.

Merchant access:

```text id="m6x2q8"
Store membership
→ Store orders only
```

Customer access:

```text id="v4n7p3"
Customer ownership
→ Customer orders only
```

Both boundaries must be enforced independently.

---

## 21. Inventory Isolation

Inventory must be store-scoped.

A request to adjust inventory must verify:

```text id="b8q3m7"
Authenticated user
→ Authorized store
→ Authorized inventory permission
→ Inventory belongs to store
```

A valid inventory ID from another store must not bypass the store check.

---

## 22. Discount Isolation

Discounts and discount codes must be scoped to the owning store.

The system must prevent:

- Cross-store discount lookup.
- Cross-store discount modification.
- Cross-store redemption.
- Cross-store usage counting.

A discount code should not accidentally apply to another store.

---

## 23. Media Isolation

Tenant-owned media must have isolated object-storage namespaces.

Conceptually:

```text id="n4m8x2"
stores/{storeId}/products/{productId}/...
```

Object keys must be generated server-side where possible.

Access to private media must be authorized before issuing access.

---

## 24. Background Job Isolation

Every tenant-aware background job must carry sufficient trusted context.

Example:

```text id="f7q3m9"
{
  jobType,
  storeId,
  resourceId
}
```

The worker must validate that the referenced resource belongs to the specified store before performing the operation.

Jobs must never infer tenant context from untrusted or ambiguous data.

---

## 25. Event Isolation

Domain events involving tenant-owned resources should contain sufficient tenant context.

Consumers must still validate resource ownership rather than blindly trusting event payload identifiers.

Events are facts, not authorization grants.

---

## 26. Webhook Tenant Resolution

External webhooks must be mapped to the correct tenant using trusted configuration.

Tenant resolution must not rely solely on a client-provided `storeId` inside the webhook payload.

The application should establish:

```text id="w8m2q5"
Provider
→ Verified webhook
→ Provider account/configuration
→ Store
→ Event processing
```

---

## 27. Database Constraints

Database constraints should reinforce tenant isolation where appropriate.

Examples include:

- Store foreign keys.
- Store-scoped unique constraints.
- Relationship constraints.
- Composite uniqueness where required.

Database constraints are a final integrity layer, not a replacement for authorization.

---

## 28. Unique Constraints

Many identifiers should be unique within a store rather than globally.

Examples:

```text id="x3n7q8"
product.slug
variant.sku
discount.code
```

Conceptually:

```text id="m8v2p4"
UNIQUE(store_id, slug)
UNIQUE(store_id, sku)
UNIQUE(store_id, code)
```

The exact constraints must follow the database schema.

---

## 29. Cross-Tenant Mutation Protection

Tenant isolation applies to writes as strongly as reads.

Test attempts to:

- Update another store's product.
- Delete another store's discount.
- Adjust another store's inventory.
- Modify another store's customer.
- Update another store's order.
- Change another store's settings.

All must be rejected.

---

## 30. Cross-Tenant Enumeration

Attackers may attempt to enumerate identifiers.

Examples:

```text id="k7m3q9"
product-1
product-2
product-3
...
```

The system must not expose information about resources merely because their identifiers can be guessed.

Opaque identifiers may reduce enumeration risk, but authorization remains mandatory.

---

## 31. Tenant-Safe Errors

Cross-tenant requests should avoid unnecessary information disclosure.

For many resource lookups:

```text id="n2x8m4"
Unauthorized tenant resource
→ 404 Not Found
```

This prevents revealing that the resource exists.

Where a different response is required by the API contract, it must still avoid leaking sensitive tenant information.

---

## 32. Caching Isolation

Caches must include sufficient tenant context in cache keys.

Bad:

```text id="r4m7x2"
product:{productId}
```

Potentially safer:

```text id="p8n3q6"
store:{storeId}:product:{productId}
```

Public storefront caches must also include the resolved store identity.

Tenant-specific data must never be served from another tenant's cache entry.

---

## 33. Search and Filtering

Any search or filtering mechanism must preserve tenant scope.

For the Demo's PostgreSQL-backed search:

```text id="q6m2v8"
WHERE store_id = authorizedStoreId
```

must remain part of the query.

A future dedicated search engine must preserve the same tenant partitioning and authorization model.

---

## 34. Reporting and Aggregation

Aggregated queries must also remain tenant-scoped.

Examples:

- Order totals.
- Product counts.
- Inventory totals.
- Customer counts.
- Discount usage.

A query returning aggregate data can still create a cross-tenant information leak.

---

## 35. Multi-Tenant Transactions

Transactions must preserve tenant context throughout the entire operation.

Example:

```text id="t7q4m8"
Checkout Store A
→ Cart Store A
→ Inventory Store A
→ Payment Store A
→ Order Store A
```

The operation must never accidentally combine records belonging to different stores.

---

## 36. Tenant Isolation Testing

The security test suite must explicitly cover:

```text id="s8n3q5"
[ ] Cross-store reads
[ ] Cross-store writes
[ ] Cross-store deletes
[ ] Cross-store updates
[ ] Cross-store list queries
[ ] Cross-store search/filter queries
[ ] Cross-store customer access
[ ] Cross-store cart access
[ ] Cross-store checkout access
[ ] Cross-store payment access
[ ] Cross-store order access
[ ] Cross-store inventory access
[ ] Cross-store discount access
[ ] Cross-store media access
[ ] Cross-store background jobs
[ ] Cross-store cache isolation
```

---

## 37. Automated Regression Tests

Every discovered tenant-isolation vulnerability should produce a regression test.

The regression test should demonstrate:

```text id="v2m7q9"
Unauthorized tenant
→ attempted operation
→ access denied
→ no state mutation
```

Where appropriate, verify that no data was returned before the denial.

---

## 38. AI Development Requirements

AI-assisted development must treat tenant isolation as a protected invariant.

AI must not:

- Remove tenant filters.
- Assume IDs are globally safe.
- Query tenant-owned tables without scope.
- Trust client-provided tenant IDs.
- Bypass authorization for convenience.
- Add global caches for tenant-specific data without isolation.
- Move tenant checks into the client.
- Modify security tests to avoid failures.

Before changing tenant-aware code, AI should inspect:

- `AGENTS.md`.
- Relevant architecture documentation.
- Domain specification.
- Existing module implementation.
- Existing authorization patterns.
- Relevant tests.

---

## 39. Code Review Requirements

Changes affecting tenant boundaries require explicit review of:

- Read queries.
- Write queries.
- Delete/archive operations.
- Joins.
- Transactions.
- Background jobs.
- Events.
- Caches.
- Object storage.
- API handlers.
- Authorization.

A change that looks local may still create a cross-tenant path.

---

## 40. Production Monitoring

Production monitoring should provide signals for suspicious tenant-access behavior.

Potential signals include:

- Repeated cross-tenant authorization failures.
- Unexpected resource access patterns.
- Abnormal API enumeration.
- Repeated access to nonexistent resources.
- Suspicious membership changes.

Monitoring must avoid logging unnecessary sensitive information.

---

## 41. Incident Response

If tenant isolation is suspected to be compromised:

1. Identify affected tenants.
2. Determine affected resources.
3. Restrict the vulnerable operation if necessary.
4. Preserve relevant security telemetry.
5. Fix the authorization/isolation defect.
6. Add regression tests.
7. Verify the fix.
8. Assess whether data exposure occurred.
9. Follow applicable incident-response and notification procedures.

Production mitigation must prioritize containment before convenience.

---

## 42. Definition of Done

Tenant isolation is complete when:

```text id="m5q8x3"
[ ] Store is the primary operational isolation boundary
[ ] Organization boundaries are enforced
[ ] Tenant context is established server-side
[ ] Client tenant identifiers are not trusted
[ ] Tenant-aware queries are explicitly scoped
[ ] Cross-tenant reads are rejected
[ ] Cross-tenant writes are rejected
[ ] Cross-tenant mutations cannot occur
[ ] Tenant-safe errors are used where appropriate
[ ] Background jobs preserve tenant context
[ ] Events preserve necessary tenant context
[ ] Webhooks resolve tenants through trusted configuration
[ ] Caches preserve tenant isolation
[ ] Media storage preserves tenant isolation
[ ] Tenant isolation tests exist
[ ] Regression tests cover discovered vulnerabilities
[ ] Relevant verification was actually executed
```