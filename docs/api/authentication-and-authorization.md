
# Authentication and Authorization

## 1. Purpose

This document defines authentication and authorization requirements for the Cal Cart commerce platform.

The system is multi-tenant and contains merchant, customer, inventory, payment, and order data. Identity and access control must therefore be enforced server-side and consistently across web requests, APIs, background jobs, and integrations.

---

## 2. Core Principles

The platform must distinguish between:

```text
Authentication
→ Who is this user?

Authorization
→ What is this user allowed to do?

Tenant isolation
→ Which organization's/store's data may this user access?
```

Authentication alone must never grant access to store resources.

Authorization must be enforced on the server.

---

## 3. Authentication Architecture

The Demo should use a centralized authentication mechanism shared by the web application and API routes.

Authentication should establish a trusted identity context containing information such as:

```text
User ID
Session ID
Account status
Authentication state
```

Tenant membership and permissions must be resolved separately.

---

## 4. Identity Model

The platform distinguishes between:

### User

A platform identity representing a person who can authenticate.

### Organization

A top-level tenant boundary.

### Store

A commerce store belonging to an organization.

### Membership

The relationship between a user and an organization/store, including their role.

### Customer

A commerce-domain customer record.

A Customer is not automatically equivalent to a User.

---

## 5. Merchant Identity

Merchant users operate stores through memberships.

The basic hierarchy is:

```text
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

The exact membership model must follow the store specification and database model.

---

## 6. Customer Identity

Customers may be:

- Registered users.
- Guest customers.

A registered customer may be associated with a platform User.

A guest customer may exist without a User account.

Customer identity must not be inferred solely from an email address.

---

## 7. Roles

The Demo supports the following primary roles:

```text
OWNER
ADMIN
STAFF
CUSTOMER
```

Roles are scoped to the appropriate organization/store context.

The platform should not assume that a user's role is globally valid across all stores.

---

## 8. Role Responsibilities

### Owner

Can perform high-privilege store administration, including ownership-level operations.

### Admin

Can manage most store operations according to the authorization matrix.

### Staff

Can perform permitted operational tasks without owner-level privileges.

### Customer

Can access their own customer and shopping resources according to the applicable storefront rules.

Exact permissions must be defined by the relevant feature specifications.

---

## 9. Least Privilege

Users should receive only the permissions necessary for their role.

Do not use:

```text id="x3m7p8"
"isAuthenticated === true"
```

as a substitute for authorization.

A request should establish:

```text
identity
+
tenant
+
resource
+
action
+
permission
```

before allowing protected operations.

---

## 10. Authorization Flow

A protected request should follow:

```text
Request
  ↓
Authenticate
  ↓
Resolve User
  ↓
Resolve Tenant Context
  ↓
Resolve Membership
  ↓
Check Role/Permission
  ↓
Validate Request
  ↓
Execute Application Service
```

Authorization must occur before protected business operations are executed.

---

## 11. Tenant Resolution

Tenant context must be derived from trusted server-side information.

Possible inputs include:

- Authenticated membership.
- Explicit store routing.
- Verified store domain/slug.
- Server-side session context.

A client-provided `storeId` must never bypass membership verification.

---

## 12. Cross-Tenant Access

A user authenticated for Store A must not access Store B unless they have an explicit valid membership permitting it.

The following must be rejected when unauthorized:

```text id="r6n2k5"
GET Store B product
GET Store B customer
UPDATE Store B product
UPDATE Store B inventory
GET Store B order
DELETE Store B discount
```

Tenant isolation applies to reads as well as writes.

---

## 13. Resource Authorization

Tenant membership alone may not be sufficient.

The system must also verify whether the user's role can perform the requested action.

For example:

```text id="m8q4v1"
Authenticated user
    ↓
Member of Store A
    ↓
Staff
    ↓
Can perform permitted inventory operation
    ↓
Cannot automatically perform owner-only settings operation
```

---

## 14. Authorization Location

Authorization should be enforced close to the application operation being protected.

API handlers may establish request context, but business-critical authorization should not depend solely on UI routing.

A protected application service should not assume that every caller is authorized merely because it was invoked from a protected page.

---

## 15. Client-Side Authorization

Client-side authorization exists only for user experience.

Examples:

- Hiding unavailable navigation items.
- Disabling unavailable buttons.
- Displaying role-specific pages.

These controls must never be considered security boundaries.

A malicious client can bypass all frontend checks.

---

## 16. API Authorization

Every protected API endpoint must verify authorization.

A typical flow is:

```text
HTTP request
    ↓
Authentication
    ↓
Tenant context
    ↓
Authorization
    ↓
Input validation
    ↓
Application service
```

The API must not rely on the caller having reached the endpoint through the expected UI.

---

## 17. Authentication Failure

If authentication is missing or invalid, protected requests should return the project's standard authentication error.

Typically:

```text
401 Unauthorized
```

Do not expose whether a protected resource exists when doing so would create an information disclosure risk.

---

## 18. Authorization Failure

If the user is authenticated but lacks permission:

```text
403 Forbidden
```

should generally be used when the resource is known to exist and revealing that fact is acceptable.

For tenant-isolated resources, a not-found response may be preferable when revealing resource existence would expose cross-tenant information.

---

## 19. Session Security

Sessions must be:

- Server-validated.
- Expirable.
- Protected from tampering.
- Invalidated when appropriate.
- Restricted to secure transport in deployed environments.

Session cookies should use appropriate security attributes, including where applicable:

```text
HttpOnly
Secure
SameSite
```

Exact settings depend on deployment architecture and authentication implementation.

---

## 20. Password Security

If passwords are implemented, they must never be stored in plaintext.

Use an established password hashing mechanism with appropriate parameters.

Do not implement custom cryptographic algorithms.

Password reset and recovery flows must not reveal sensitive account information.

---

## 21. Token Security

Authentication tokens must be treated as secrets.

Do not:

- Log them.
- Store them in source code.
- Return them unnecessarily.
- Put server-only tokens in client-exposed configuration.
- Include them in URLs where avoidable.

Token validation must be performed server-side.

---

## 22. Account Status

Authentication must consider account status.

A disabled or suspended account must not continue receiving normal access merely because it possesses an otherwise valid credential.

Account state should be checked according to the authentication/session model.

---

## 23. Store Membership Lifecycle

Store memberships may have states such as:

```text
INVITED
ACTIVE
SUSPENDED
REMOVED
```

Only appropriate membership states should permit normal store access.

A removed membership must not retain access.

---

## 24. Ownership Protection

The system must protect owner-level access.

Examples include:

- Preventing unauthorized ownership changes.
- Preventing removal of the final valid owner without an explicit supported transfer flow.
- Restricting owner-only configuration operations.

Ownership logic belongs to the Stores domain rather than being duplicated across API handlers.

---

## 25. Authorization Matrix

Authorization should be documented by business capability.

Example baseline:

| Capability | Owner | Admin | Staff | Customer |
|---|---:|---:|---:|---:|
| Store settings | Yes | Yes | Limited | No |
| Product management | Yes | Yes | As permitted | No |
| Inventory management | Yes | Yes | As permitted | No |
| Customer management | Yes | Yes | As permitted | Own data only |
| Order management | Yes | Yes | As permitted | Own orders |
| Checkout | Yes | Yes | No merchant checkout requirement | Yes |
| Payment administration | Yes | Yes | Limited | Own payment flow |
| Membership management | Yes | Yes | No | No |

This is a baseline. Feature-specific specifications remain authoritative for detailed permissions.

---

## 26. Resource Ownership

Authorization should verify both:

```text
User permission
+
Resource ownership/tenant membership
```

For example, being an authorized staff member of Store A does not authorize access to an order belonging to Store B.

---

## 27. Customer Self-Service

Customers should be restricted to their own resources.

Examples:

```text
Customer A
    ↓
Own cart
Own checkout
Own orders
Own addresses
```

A customer must not access another customer's resources by changing an identifier.

---

## 28. Merchant Customer Access

Merchant users may access customer records belonging to stores they are authorized to manage.

They must not automatically gain access to customers belonging to other stores.

---

## 29. Background Jobs

Background jobs do not have a human browser session.

Tenant context must therefore be explicit.

A tenant-owned job should carry enough trusted context to determine:

```text
organization
store
resource
operation
```

Jobs must not use arbitrary client-provided tenant identifiers.

---

## 30. Webhooks

Webhook requests use provider authentication rather than merchant/customer sessions.

The system must:

1. Verify the provider signature.
2. Resolve the appropriate integration/store.
3. Validate the event.
4. Process it within the correct tenant context.
5. Apply authorization rules appropriate to system-originated events.

Webhook verification is not equivalent to normal user authorization.

---

## 31. Internal Operations

Internal application services should not expose privileged operations to untrusted callers.

If an operation is intentionally system-only, its entry point should make that distinction explicit.

Do not create a generic "admin" bypass that skips normal security controls.

---

## 32. Service-to-Service Authentication

The Demo is a modular monolith with a worker rather than a distributed microservice architecture.

Internal modules therefore do not require network service authentication.

When separate processes communicate, such as the web application and worker, the system should use trusted internal configuration and controlled job/event mechanisms.

V1 may introduce stronger service identity if the architecture later becomes distributed.

---

## 33. Authorization and Database Queries

Authorization should not be implemented solely by checking a resource after fetching unrestricted data.

Prefer tenant-aware queries and repository methods that constrain the accessible scope.

Example concept:

```text
findOrderForStore(orderId, storeId)
```

rather than:

```text
findOrder(orderId)
```

followed by assumptions that the returned order belongs to the caller's store.

The database layer should support the application's tenant-safety requirements.

---

## 34. Authorization and Caching

Tenant-sensitive data must not be cached in a way that allows one tenant to receive another tenant's response.

Cache keys must include all relevant scope where caching is used.

Do not introduce caching before its authorization implications are understood.

---

## 35. Authorization and Errors

Error responses must not leak cross-tenant information.

For example, a user attempting to access another store's order should not necessarily receive:

```text
"Order 12345 exists but belongs to another store."
```

A tenant-safe not-found response may be appropriate.

---

## 36. Auditability

Sensitive authorization-related operations should be auditable where appropriate.

Examples:

- Ownership changes.
- Membership changes.
- Role changes.
- Store suspension.
- Payment administration.
- Refund operations.
- Sensitive account changes.

Audit records must not contain unnecessary secrets or sensitive credentials.

---

## 37. Rate Limiting

Authentication-sensitive endpoints may require rate limiting.

Potential targets include:

- Login.
- Password reset.
- Verification.
- Public checkout endpoints.
- Webhook endpoints where appropriate.

The Demo should use simple controls appropriate to its scale rather than prematurely introducing distributed rate-limiting infrastructure.

---

## 38. Security Testing

Authentication and authorization must be tested for:

- Unauthenticated access.
- Unauthorized roles.
- Cross-store access.
- Cross-user access.
- Suspended memberships.
- Removed memberships.
- Customer self-access.
- Privileged operations.
- Identifier manipulation.
- Session invalidation where applicable.

Security tests should include negative cases.

---

## 39. Common Authorization Failures

Avoid patterns such as:

### Client-only role checks

```text
if (user.role === "admin") ...
```

in frontend code without server enforcement.

### Trusting request tenant IDs

```text
storeId = request.body.storeId
```

without membership verification.

### Global resource lookup

```text
findOrder(orderId)
```

without tenant scoping.

### Hidden admin bypasses

```text
if (isAdmin) skipAuthorization()
```

without defining the administrator's actual scope and permissions.

---

## 40. Demo-to-V1 Evolution

The Demo should establish correct security boundaries without introducing unnecessary identity infrastructure.

V1 may later add:

- More sophisticated role/permission systems.
- Enterprise SSO.
- OAuth integrations.
- MFA.
- Service identities.
- Advanced session management.
- Centralized authorization policy engines.

These should be introduced only when requirements justify them.

---

## 41. Authentication and Authorization Checklist

Before releasing authentication or authorization changes:

```text id="c7m2x9"
[ ] Authentication behavior is defined
[ ] Authorization behavior is defined
[ ] Tenant scope is defined
[ ] Role permissions are defined
[ ] Server-side enforcement exists
[ ] Client checks are not treated as security controls
[ ] Cross-tenant access is rejected
[ ] Cross-user access is rejected
[ ] Suspended/removed memberships are handled
[ ] Sensitive errors do not leak information
[ ] Sessions/tokens are protected
[ ] Secrets are not logged
[ ] Relevant security tests exist
[ ] Relevant verification was executed
[ ] Documentation reflects actual behavior
```