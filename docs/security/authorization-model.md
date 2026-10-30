# Authorization Model

## 1. Purpose

This document defines the authorization model for the Cal Cart commerce platform.

Authorization determines **what an authenticated identity is permitted to do** within a specific organization, store, resource, or operation.

Authentication establishes identity. Authorization establishes permission.

---

## 2. Core Principles

Authorization must:

- Be enforced server-side.
- Fail closed.
- Be evaluated for every protected operation.
- Respect tenant boundaries.
- Respect membership status.
- Respect role permissions.
- Validate resource ownership.
- Never trust client-provided roles or permissions.
- Be applied consistently across web requests, APIs, jobs, and webhooks.
- Remain independent from UI visibility.

---

## 3. Authorization Model

The Demo uses a **role-based, tenant-scoped authorization model**.

The core relationship is:

```text
Organization
    ↓
Store
    ↓
Membership
    ↓
User
    ↓
Role
    ↓
Permission
    ↓
Resource / Operation
```

A user's ability to perform an action depends on the relevant store membership and assigned role.

---

## 4. Identity and Authorization

The system must distinguish:

```text
User
Membership
Role
Permission
Resource
```

These concepts must not be collapsed into a single `role` field on the user.

Example:

```text
User A
  ├── Store A → OWNER
  └── Store B → STAFF
```

The same user can therefore have different permissions depending on the active store.

---

## 5. Store-Scoped Authorization

Most merchant operations are store-scoped.

Authorization should resolve:

```text
Authenticated User
        ↓
Requested Store
        ↓
Store Membership
        ↓
Membership Status
        ↓
Role
        ↓
Permission
        ↓
Requested Operation
```

No operation should assume that authentication alone grants store access.

---

## 6. Roles

The Demo defines the following merchant roles:

### Owner

Highest store-management role.

Typical permissions include:

- Store configuration.
- Product management.
- Inventory management.
- Customer management.
- Order management.
- Discount management.
- Payment configuration.
- Membership management.
- Ownership-sensitive operations.

### Admin

Broad operational management without ownership-sensitive capabilities.

Typical permissions include:

- Product management.
- Inventory management.
- Customer management.
- Order management.
- Discount management.
- Store operational settings.

### Staff

Limited operational access.

Typical permissions include:

- Product operations where permitted.
- Inventory operations where permitted.
- Order operations where permitted.
- Customer operations where permitted.

Staff should not automatically receive administrative or security-sensitive permissions.

---

## 7. Customer Authorization

Customers are not merchant members.

Customer authorization is based primarily on:

```text
Authenticated Customer
        ↓
Customer identity
        ↓
Owned customer resources
```

A customer should normally access only their own:

- Profile.
- Addresses.
- Cart.
- Checkout.
- Orders.

---

## 8. Guest Authorization

Guests have limited authorization based on the active storefront session and checkout context.

Guests must not gain access to arbitrary customer, merchant, or store-management resources.

Guest identifiers must not be sufficient by themselves to bypass authorization.

---

## 9. Permission Categories

Permissions should correspond to business capabilities rather than UI screens.

Examples:

```text
stores.read
stores.update

products.read
products.create
products.update
products.publish
products.archive

inventory.read
inventory.adjust

customers.read
customers.update

discounts.read
discounts.create
discounts.update

orders.read
orders.update
orders.cancel

payments.read
payments.refund

memberships.read
memberships.manage
```

The exact permission set may evolve with implementation.

---

## 10. Permission Naming

Permissions should use a consistent structure:

```text
resource.action
```

Examples:

```text
products.create
products.update
inventory.adjust
orders.read
orders.update
```

Avoid ambiguous permissions such as:

```text
canManageEverything
adminAccess
superUser
```

Permissions should describe a concrete capability.

---

## 11. Role-to-Permission Mapping

Role permissions should be defined centrally.

Example:

| Capability | Owner | Admin | Staff |
|---|---:|---:|---:|
| View products | Yes | Yes | Yes |
| Create products | Yes | Yes | Yes |
| Publish products | Yes | Yes | Configurable |
| Adjust inventory | Yes | Yes | Yes |
| View customers | Yes | Yes | Yes |
| Manage discounts | Yes | Yes | Limited |
| Manage orders | Yes | Yes | Yes |
| Manage members | Yes | Limited | No |
| Change ownership | Yes | No | No |
| Sensitive payment configuration | Yes | Limited | No |

The final implementation must use the actual permission definitions rather than relying on this table as runtime configuration.

---

## 12. Deny by Default

Authorization must follow:

```text
No explicit permission
        ↓
Deny
```

The system must not assume that an authenticated user is allowed to perform an operation unless a valid authorization rule grants access.

---

## 13. Server-Side Enforcement

UI restrictions are not authorization.

For example:

```text
Button hidden
≠
Operation protected
```

A user must still be denied if they directly call the underlying API.

Every protected operation must enforce authorization server-side.

---

## 14. Resource-Level Authorization

Having a permission does not automatically grant access to every resource.

Example:

```text
products.read
```

does not mean:

```text
read every product in every store
```

The permission must be evaluated together with tenant/resource scope.

---

## 15. Tenant Isolation Before Resource Access

Resource access should follow:

```text
Authenticate
  ↓
Resolve tenant/store
  ↓
Authorize membership
  ↓
Load resource within authorized scope
  ↓
Apply resource-specific authorization
```

Queries should be scoped to the authorized store whenever practical.

---

## 16. Tenant-Safe Not Found

When a resource does not belong to the user's authorized tenant, the API should generally avoid revealing its existence.

For example:

```text
Store A user requests Store B order
```

The system may return:

```text
404 Not Found
```

rather than exposing:

```text
403 Store B exists but you cannot access it
```

The appropriate response depends on the operation, but information disclosure must be considered explicitly.

---

## 17. Membership Status

Role alone is insufficient.

A membership must also be in an allowed state.

Example:

```text
Role = ADMIN
Membership = SUSPENDED
```

Expected:

```text
Access denied
```

Typical membership states include:

```text
INVITED
ACTIVE
SUSPENDED
REMOVED
```

Only appropriate states may authorize access.

---

## 18. Invitation Authorization

Invited users should not receive normal store permissions until the invitation is properly accepted and the membership becomes active.

Invitation tokens must be validated independently from ordinary session authentication.

---

## 19. Ownership Protection

The Owner role requires additional protection.

The system must prevent accidental removal of the final active owner.

Ownership-sensitive operations should include explicit authorization checks.

If ownership transfer is implemented, it must be an intentional operation with appropriate validation.

---

## 20. Administrative Operations

Administrative operations should require explicit permissions.

Examples:

- Membership management.
- Store configuration.
- Payment configuration.
- Ownership operations.
- Sensitive security settings.

These operations must not be granted merely because a user can access the merchant dashboard.

---

## 21. Customer Resource Ownership

Customers must be authorized against their own resources.

Example:

```text
Customer A
→ Order A = allowed

Customer A
→ Order B = denied
```

This check must happen server-side.

Changing an order ID in a request must never bypass ownership checks.

---

## 22. Merchant Access to Customers

Merchant users may access customer records only within stores for which they have appropriate permissions.

Example:

```text
Store A Admin → Store A Customer = allowed
Store A Admin → Store B Customer = denied
```

---

## 23. Cart Authorization

Cart access depends on cart ownership and context.

For authenticated customers:

```text
Customer
→ Own cart = allowed
```

For guests:

```text
Guest session
→ Associated guest cart = allowed
```

A cart belonging to another customer or tenant must not be accessible.

---

## 24. Checkout Authorization

Checkout operations must verify:

- Store context.
- Checkout ownership.
- Customer identity where applicable.
- Guest session where applicable.
- Checkout state.

A valid checkout identifier must not be treated as sufficient authorization.

---

## 25. Payment Authorization

Payment information is particularly sensitive.

Merchant access should be limited to the information required for business operations.

Customers should only access payment information associated with their own authorized checkout/order.

Raw payment credentials must never be exposed.

---

## 26. Order Authorization

Order authorization should consider:

```text
Merchant:
  store membership + permission

Customer:
  customer ownership

Guest:
  valid checkout/order access mechanism
```

Orders must never be globally readable.

---

## 27. Inventory Authorization

Inventory mutation requires explicit permission.

Typical rule:

```text
inventory.adjust
+
authorized store membership
+
active membership
```

Read access and mutation access should remain separate.

---

## 28. Product Authorization

Product operations should distinguish:

- Read.
- Create.
- Update.
- Publish.
- Archive.

A role with product read permission must not automatically receive product mutation permissions.

---

## 29. Discount Authorization

Discount operations should distinguish:

- Read.
- Create.
- Update.
- Activate.
- Pause.
- Archive.

Because discounts directly affect checkout pricing, mutation permissions must be protected carefully.

---

## 30. API Authorization Middleware

Authorization may be implemented through shared middleware/helpers, but the authorization decision must remain explicit.

A typical request path is:

```text
Request
  ↓
Authentication
  ↓
Tenant resolution
  ↓
Authorization
  ↓
Validation
  ↓
Application service
```

The application service may also perform domain-specific authorization checks.

---

## 31. Application-Level Authorization

Authorization should not exist exclusively in HTTP middleware.

Application services must protect business-critical operations so that the same rules apply when operations are invoked through:

- API requests.
- Background jobs.
- Internal workflows.
- Administrative tooling.

---

## 32. Domain Rules vs Authorization

Authorization and business rules are related but different.

Example:

```text
Authorization:
Can this staff member modify inventory?

Business rule:
Can inventory become negative?
```

Both must be enforced.

Passing authorization does not bypass domain invariants.

---

## 33. Background Job Authorization

Background jobs must not blindly inherit arbitrary user permissions.

A job should contain the trusted context required to perform its operation.

Where a job performs a user-requested operation, the originating authorization decision and relevant tenant context should be represented appropriately.

---

## 34. Webhook Authorization

External webhooks do not authenticate as ordinary application users.

Webhook authorization should instead use:

- Provider verification.
- Signature validation.
- Trusted provider configuration.
- Event identity.
- Tenant mapping.

A webhook must not be treated as an ordinary authenticated browser request.

---

## 35. Authorization Caching

Authorization results may be cached only when correctness is preserved.

Caching must account for:

- Membership changes.
- Role changes.
- Suspensions.
- Removal.
- Store changes.

Stale authorization must not continue granting access after a security-sensitive permission change.

For the Demo, simple database-backed authorization is preferred over premature distributed authorization caching.

---

## 36. Authorization Testing

Every authorization-sensitive capability should have tests covering:

```text
Unauthenticated
Authenticated wrong tenant
Authenticated wrong role
Suspended membership
Removed membership
Correct role
Correct resource owner
Non-owner
```

Tests should verify both API behavior and persisted state.

---

## 37. IDOR Testing

For every resource exposed through an identifier, test whether changing the identifier allows unauthorized access.

Examples:

```text
/product/{id}
/orders/{id}
/customers/{id}
/checkouts/{id}
/carts/{id}
```

Identifiers must never replace authorization.

---

## 38. Privilege Escalation Testing

Test attempts to escalate privileges by manipulating:

- Role fields.
- Membership IDs.
- Store IDs.
- User IDs.
- Request payloads.
- Cookies.
- Tokens.
- Hidden UI fields.

Client-controlled values must never determine authorization.

---

## 39. Authorization Logging

Security-relevant authorization failures should produce useful structured telemetry where appropriate.

Logs may include:

- User ID.
- Store ID.
- Requested capability.
- Resource type.
- Result.
- Request/correlation ID.

Sensitive data must not be logged.

---

## 40. AI Development Requirements

AI-assisted implementation must:

- Read the actual `AGENTS.md` before beginning work.
- Inspect existing authorization patterns.
- Reuse established authorization mechanisms.
- Never bypass authorization to simplify development.
- Never add hidden admin privileges.
- Never trust client-provided roles.
- Preserve tenant isolation.
- Add tests for new authorization-sensitive behavior.

AI must not modify security checks merely to make tests pass.

---

## 41. Security Review Requirements

Authorization changes should receive additional review when they affect:

- Tenant boundaries.
- Owner permissions.
- Membership management.
- Payment operations.
- Customer data.
- Order data.
- Inventory.
- Administrative functionality.

Small authorization changes can have disproportionately large consequences.

---

## 42. Definition of Done

Authorization implementation is complete when:

```text
[ ] Authentication is required where appropriate
[ ] Tenant scope is established
[ ] Membership status is checked
[ ] Role/permission is checked
[ ] Resource ownership is checked
[ ] Server-side enforcement exists
[ ] Client values cannot grant privileges
[ ] Cross-tenant access is rejected
[ ] Privilege escalation is rejected
[ ] Sensitive operations have explicit permissions
[ ] Background jobs preserve security boundaries
[ ] Webhooks use provider-specific verification
[ ] Authorization tests exist
[ ] IDOR tests exist for exposed resources
[ ] Security-relevant failures are observable
[ ] Relevant verification was actually executed
```