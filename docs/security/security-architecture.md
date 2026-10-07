# Security Architecture

## 1. Purpose

This document defines the security architecture for the commerce platform.

It establishes security requirements for:

- Authentication.
- Authorization.
- Multi-tenancy.
- Data access.
- API security.
- Input validation.
- Sessions and credentials.
- Payment processing.
- Webhooks.
- Secrets.
- Infrastructure.
- Logging.
- Background processing.
- File and media access.
- AI-assisted development.
- Incident response.
- Security testing.

Security is treated as a core architectural requirement rather than a separate feature.

---

# 2. Security Principles

The platform follows these principles:

1. Never trust the client.
2. Authenticate before protected operations.
3. Authorize every protected operation.
4. Enforce tenant isolation server-side.
5. Apply least privilege.
6. Validate all untrusted input.
7. Protect secrets.
8. Use secure transport.
9. Minimize sensitive data exposure.
10. Make critical operations auditable.
11. Design for safe retries.
12. Fail securely.
13. Keep external integrations isolated.
14. Protect production access.
15. Test security boundaries continuously.

---

# 3. Security Architecture

The security model can be represented as:

```text id="w2f7d4"
Client
  ↓
HTTPS
  ↓
Authentication
  ↓
Identity
  ↓
Tenant Resolution
  ↓
Authorization
  ↓
Input Validation
  ↓
Application Service
  ↓
Domain Rules
  ↓
Database / External Integration
```

Each layer contributes security controls.

No single layer is assumed to be sufficient on its own.

---

# 4. Threat Model

The platform must assume that:

- Clients can be malicious.
- Requests can be modified.
- Resource IDs can be guessed.
- Users can attempt cross-tenant access.
- API requests can be replayed.
- Webhooks can be duplicated.
- External services can fail.
- Credentials can be leaked.
- Dependencies can contain vulnerabilities.
- Application bugs can expose unintended data.
- Internal users may accidentally exceed intended permissions.

The system must therefore enforce security server-side.

---

# 5. Authentication

Authentication establishes the identity of the caller.

The authentication system may use:

- Sessions.
- Secure tokens.
- An external identity provider.
- Another approved authentication mechanism.

The implementation must ensure that authentication credentials are protected against:

- Theft.
- Replay.
- Accidental exposure.
- Improper storage.

---

# 6. Authentication vs Authorization

These are separate concerns.

### Authentication

Answers:

> Who are you?

### Authorization

Answers:

> What are you allowed to do?

For example:

```text id="0k5n6r"
Authenticated User
        ↓
Store Membership
        ↓
Role
        ↓
Permission
        ↓
Requested Resource
```

Successful authentication does not grant unrestricted access.

---

# 7. Merchant Authorization

Merchant operations must validate:

1. Authenticated identity.
2. Organization membership.
3. Store membership.
4. Role.
5. Permission.
6. Resource ownership where applicable.
7. Requested operation.

Example:

```text id="y7k3f5"
User
 ↓
Member of Organization A
 ↓
Member of Store A
 ↓
Has Product Management Permission
 ↓
Can modify Product belonging to Store A
```

A valid account alone is insufficient.

---

# 8. Customer Authorization

Customer operations must verify customer ownership.

For example:

```text id="1m8q4c"
Customer A
    ↓
GET Order 123
    ↓
Order 123 belongs to Customer A
    ↓
Allow
```

If the order belongs to another customer:

```text id="5h2p8k"
Customer A
    ↓
GET Order 456
    ↓
Order 456 belongs to Customer B
    ↓
Reject
```

Knowing an order ID does not grant access.

---

# 9. Multi-Tenant Isolation

Tenant isolation is a mandatory security requirement.

The fundamental hierarchy is:

```text id="6p3r8x"
Organization
    ↓
Store
    ↓
Store-Owned Resources
```

Resources must remain scoped to the correct store.

Examples include:

- Products.
- Inventory.
- Customers.
- Carts.
- Discounts.
- Orders.

---

# 10. Server-Side Tenant Enforcement

Tenant isolation must be enforced on the server.

The client must not be trusted to select an arbitrary tenant.

For example:

```text id="4g7x0q"
POST /api/products

{
  "storeId": "store_B"
}
```

does not prove that the caller may operate on Store B.

The server must resolve and verify the caller's store access independently.

---

# 11. Tenant-Scoped Queries

Queries involving tenant-owned data must include the correct scope.

Conceptually:

```text id="7f4m9z"
SELECT ...
FROM products
WHERE id = requestedId
AND store_id = authorizedStoreId
```

The implementation may use repositories, query builders, policies, or other mechanisms.

The security requirement remains the same.

---

# 12. Resource Ownership

Tenant membership alone may not be sufficient.

A request may require:

```text id="2z6h4r"
Tenant Access
    +
Resource Ownership
    +
Permission
```

This is especially important for:

- Orders.
- Customers.
- Payments.
- Private media.
- Store configuration.
- Administrative resources.

---

# 13. Role-Based Access Control

The initial merchant authorization model includes:

```text id="p3k7v1"
Owner
Admin
Staff
```

Roles determine baseline permissions.

The platform should avoid granting broad privileges simply because an operation is technically convenient.

Least privilege is preferred.

---

# 14. Owner Permissions

The Owner has the highest normal store-level privileges.

Typical responsibilities include:

- Store management.
- Merchant membership management.
- Product management.
- Inventory management.
- Order management.
- Store configuration.

Certain high-impact operations may still require explicit workflows.

---

# 15. Admin Permissions

Admins can perform operational store management within their assigned scope.

They should not automatically receive:

- Platform administrator privileges.
- Ownership transfer privileges.
- Organization deletion privileges.

Permissions should be explicit.

---

# 16. Staff Permissions

Staff should receive only the permissions required for their operational responsibilities.

Examples may include:

- Viewing orders.
- Managing orders.
- Managing inventory.
- Viewing products.

The exact permission set belongs to the product authorization specification.

---

# 17. Platform Administrator

Platform administrators are distinct from normal merchant users.

Platform-level access must not be inferred from:

```text id="1b4z5q"
Owner
Admin
Staff
```

A merchant administrator should not automatically gain platform-wide access.

Platform administration must use a separate security boundary.

---

# 18. Session Security

Authentication sessions should use secure mechanisms appropriate to the deployment environment.

Requirements include:

- Secure transport.
- Appropriate expiration.
- Secure cookie configuration where cookies are used.
- Protection against session theft.
- Protection against session fixation.
- Logout/invalidation behavior.

Authentication implementation details belong to the authentication package and security implementation.

---

# 19. Password Security

If passwords are managed directly by the platform:

- Passwords must never be stored in plaintext.
- Strong password hashing must be used.
- Password reset tokens must be protected.
- Authentication attempts should be controlled.
- Sensitive authentication events should be logged appropriately.

If an external identity provider is used, the platform must avoid duplicating unnecessary credential storage.

---

# 20. Input Validation

All untrusted input must be validated.

This includes:

- Request bodies.
- Query parameters.
- Path parameters.
- Headers.
- Cookies.
- Webhook payloads.
- Uploaded file metadata.

Validation should reject:

- Invalid types.
- Invalid formats.
- Unexpected values.
- Excessive sizes.
- Invalid ranges.

---

# 21. Injection Protection

Database queries must use safe parameterization or an equivalent safe database abstraction.

Application code must not construct SQL from untrusted input through unsafe string concatenation.

The same principle applies to:

- Shell commands.
- File paths.
- HTML.
- Template rendering.
- External API requests.

---

# 22. Cross-Site Scripting

User-controlled content must not be rendered as executable HTML or script without appropriate sanitization and encoding.

This is especially relevant for:

- Product descriptions.
- Store content.
- Customer-generated content.
- Merchant-generated content.

The frontend must follow appropriate escaping and content rendering practices.

---

# 23. Cross-Site Request Forgery

If authentication relies on browser cookies, state-changing operations must have appropriate CSRF protections.

Possible mechanisms include:

- SameSite cookie policies.
- CSRF tokens.
- Origin validation.
- Framework-provided protections.

The exact mechanism depends on the authentication architecture.

---

# 24. API Security

Protected API requests must enforce:

```text id="3n6j8v"
Authentication
     ↓
Tenant Resolution
     ↓
Authorization
     ↓
Validation
     ↓
Business Rules
```

API endpoints must not assume that frontend restrictions provide security.

Hiding a button is not authorization.

---

# 25. Rate Limiting

Rate limiting should be applied to sensitive or abuse-prone operations.

Potential targets include:

- Login.
- Password reset.
- Public APIs.
- Checkout.
- Payment initiation.
- Webhooks where appropriate.
- Resource-intensive endpoints.

The Demo may use basic mechanisms.

More advanced distributed rate limiting can be introduced when required.

---

# 26. Idempotency

Critical retry-sensitive operations must support safe retries where appropriate.

Examples:

- Payment operations.
- Checkout completion.
- Order creation.
- Webhook processing.
- Certain inventory operations.

Idempotency protects against:

```text id="x4c8n1"
Network Retry
    ↓
Duplicate Request
    ↓
Duplicate Business Effect
```

The system should ensure that safe retries do not create unintended duplicate effects.

---

# 27. Payment Security

Payment information must be handled according to the selected payment provider's security model.

The platform should avoid storing sensitive payment credentials unless explicitly required and appropriately protected.

Where possible:

```text id="q5w1m8"
Customer
   ↓
Payment Provider
   ↓
Provider Reference
   ↓
Platform
```

rather than:

```text id="r7j2c6"
Customer
   ↓
Platform
   ↓
Raw Payment Credentials
```

The exact integration must follow the provider's security requirements.

---

# 28. Payment State Protection

Payment state transitions must be controlled by the Payments domain.

Other modules must not directly change payment status.

For example:

```text id="p8h3k1"
pending
  ↓
authorized
  ↓
captured
```

must occur through defined payment operations.

This prevents inconsistent financial state.

---

# 29. Webhook Security

Webhook endpoints are external trust boundaries.

The platform must:

1. Verify authenticity.
2. Validate payload structure.
3. Validate expected event type.
4. Apply idempotency.
5. Process the event through the owning domain.
6. Record relevant processing state.
7. Return an appropriate response.

A webhook must not directly mutate arbitrary database tables.

---

# 30. Replay Protection

External events may be replayed.

Where the provider supplies:

- Event IDs.
- Timestamps.
- Signatures.
- Nonces.

the application should use them to prevent unintended replay effects.

Idempotency records should be persisted where required.

---

# 31. Secrets Management

Secrets must never be committed to Git.

Examples:

```text id="z8f3c2"
Database Password
Authentication Secret
Payment Provider Secret
Object Storage Credentials
Email Credentials
Deployment Credentials
```

Secrets should be provided through secure environment or secret-management mechanisms.

---

# 32. Secret Exposure Prevention

Secrets must not appear in:

- Source code.
- Public configuration.
- Client-side bundles.
- Logs.
- Error responses.
- Git history.
- Documentation examples.

Example configuration files should contain placeholders.

---

# 33. Client vs Server Secrets

Secrets required for server-side integrations must remain server-side.

For example:

```text id="a7j9k3"
PAYMENT_SECRET
DATABASE_URL
AUTH_SECRET
```

must never be exposed to browser code.

Public identifiers may be exposed only when the external provider explicitly defines them as safe.

---

# 34. Object Storage Security

Media access must respect ownership and visibility.

Private objects should require controlled access.

Public product assets may use public delivery where appropriate.

Object keys must not be treated as proof of authorization.

---

# 35. File Upload Security

Uploaded files should be validated.

Controls may include:

- File size limits.
- Allowed MIME types.
- File extension validation.
- Safe object naming.
- Storage isolation.
- Malware scanning where required.
- Content-type handling.
- Metadata validation.

Uploaded files must not automatically become executable application content.

---

# 36. Logging Security

Logs should support debugging without exposing sensitive information.

Logs must not contain:

- Passwords.
- Authentication tokens.
- API secrets.
- Payment credentials.
- Full payment card information.
- Webhook signing secrets.
- Unnecessary personal information.

Sensitive values should be redacted or excluded.

---

# 37. Auditability

Security-sensitive actions should be auditable where appropriate.

Examples include:

- Login events.
- Role changes.
- Store membership changes.
- Product changes.
- Inventory adjustments.
- Payment state changes.
- Order state changes.
- Administrative actions.

Audit records should preserve enough context to understand what happened.

---

# 38. Background Job Security

Background workers operate outside the normal HTTP request lifecycle.

Jobs must preserve:

- Tenant context.
- Authorization assumptions.
- Ownership boundaries.
- Idempotency.
- Input validation.

A worker must not treat a queued payload as inherently trusted.

---

# 39. Job Payload Security

Job payloads should contain only the information required for execution.

Where possible, use identifiers and reload authoritative state rather than trusting mutable business values embedded in a job.

For example:

```text id="h5c2z9"
Job
{
  orderId: "..."
}
```

may be safer than trusting a job payload containing the entire mutable order state.

---

# 40. Database Security

Database access should follow least privilege.

Applications should not automatically receive unrestricted administrative database privileges.

Where practical:

- Use dedicated credentials.
- Restrict network access.
- Protect database credentials.
- Encrypt connections where required.
- Monitor access.
- Maintain backups.

---

# 41. Production Database Access

Production database access must be tightly controlled.

Normal application credentials should not be equivalent to administrative credentials.

Human access should be:

- Authorized.
- Limited.
- Auditable.
- Justified.

AI agents should not receive unrestricted production database access.

---

# 42. Infrastructure Security

Production infrastructure should use:

- HTTPS.
- Restricted firewall rules.
- Secure SSH access.
- Key-based authentication.
- Regular security updates.
- Least-privilege accounts.
- Protected backups.
- Monitoring.

Unused public ports and services should not be exposed.

---

# 43. Dependency Security

Dependencies should be kept reasonably current.

The team should monitor:

- Known vulnerabilities.
- Dependency age.
- Unmaintained packages.
- Suspicious packages.
- License requirements where relevant.

Dependencies should not be introduced solely for trivial functionality that can be safely implemented without them.

---

# 44. Supply Chain Security

The project should protect the software supply chain through:

- Lockfiles.
- Dependency review.
- Trusted package sources.
- CI validation.
- Controlled build environments.

Production builds should correspond to known source revisions.

---

# 45. Security Headers

The web application should use appropriate security headers where applicable.

Depending on the deployment architecture, these may include:

- Content Security Policy.
- Strict-Transport-Security.
- X-Content-Type-Options.
- Referrer-Policy.
- Frame protection.

The exact policy must be tested against application requirements before enforcement.

---

# 46. Transport Security

Production application traffic must use HTTPS.

Sensitive data must not be transmitted through unsecured channels.

External provider integrations should use secure transport.

---

# 47. Error Handling

Security-sensitive failures should fail closed.

For example:

```text id="q6k1v4"
Authorization Check Failed
        ↓
Reject Request
```

not:

```text id="a9v5c8"
Authorization Check Failed
        ↓
Continue Anyway
```

Unexpected security failures should not grant access.

---

# 48. Data Minimization

The application should collect and retain only information required for the product.

Avoid storing sensitive information merely because it might become useful later.

Data retention requirements should be considered for:

- Customers.
- Orders.
- Payments.
- Logs.
- Audit records.
- Uploaded files.

---

# 49. Tenant Data Leakage Prevention

Potential leakage paths include:

- API responses.
- Search results.
- Logs.
- Error messages.
- Background jobs.
- Caches.
- Object storage.
- Analytics.
- Admin interfaces.

Every new feature must consider whether it can expose one tenant's information to another.

---

# 50. Cache Security

If caching is introduced, cache keys must include appropriate tenant/resource scope.

Unsafe:

```text id="q8r4n3"
product:123
```

Potentially safer:

```text id="v3m7x2"
store:A:product:123
```

The exact strategy depends on the cache architecture.

Sensitive data must not be cached in ways that allow cross-tenant access.

---

# 51. Search Security

Search indexes must preserve tenant boundaries.

A search request for Store A must not return Store B resources.

Search indexes are derived systems, but they still require access controls.

---

# 52. Security Testing

Security testing should cover:

### Authentication

- Invalid credentials.
- Session handling.
- Session invalidation.

### Authorization

- Role restrictions.
- Resource ownership.
- Cross-store access.

### API

- Input validation.
- Rate limiting.
- Error handling.

### Webhooks

- Signature validation.
- Replay handling.
- Duplicate delivery.

### Database

- Tenant-scoped queries.
- Constraint enforcement.

### File Handling

- Upload validation.
- Private media access.

---

# 53. Tenant Isolation Tests

Tenant isolation requires explicit automated tests.

Example:

```text id="8c1p7q"
Store A User
    ↓
Request Store B Product
    ↓
Expected: Reject
```

Equivalent tests should exist for:

- Orders.
- Customers.
- Inventory.
- Discounts.
- Carts.
- Store configuration.

---

# 54. Authorization Test Matrix

Authorization should be tested across roles.

Example:

| Operation | Owner | Admin | Staff |
|---|---:|---:|---:|
| Manage Store | Yes | Limited | No |
| Manage Products | Yes | Yes | According to permission |
| Manage Inventory | Yes | Yes | According to permission |
| Manage Orders | Yes | Yes | According to permission |
| Manage Members | Yes | Limited | No |
| Platform Administration | No | No | No |

The exact permissions are defined by the product authorization model.

---

# 55. Security in AI-Assisted Development

AI coding agents are implementation assistants.

They must not be treated as autonomous security authorities.

Agents must:

1. Read the root `AGENTS.md`.
2. Read relevant architecture/security documentation.
3. Read relevant feature specifications.
4. Inspect existing implementation.
5. Preserve existing security controls.
6. Avoid weakening authorization.
7. Avoid exposing secrets.
8. Avoid adding unnecessary dependencies.
9. Avoid changing unrelated security-sensitive code.
10. Report uncertainty rather than inventing security behavior.

---

# 56. AI Production Access

AI agents must not receive unrestricted production access.

In particular, agents should not automatically receive:

- Production database credentials.
- Production SSH credentials.
- Production payment credentials.
- Production object-storage credentials.
- Production authentication secrets.

Production operations require controlled human or explicitly authorized operational workflows.

---

# 57. Security Review Triggers

A security review is required when changes involve:

- Authentication.
- Authorization.
- Tenant isolation.
- Payments.
- Webhooks.
- Secrets.
- File uploads.
- Public APIs.
- Database permissions.
- Production infrastructure.
- Customer data.
- Role changes.

The depth of review should match the risk.

---

# 58. Incident Response

The project should have a basic process for security incidents.

Initial priorities are:

```text id="f7x3m8"
Detect
  ↓
Contain
  ↓
Protect Data
  ↓
Investigate
  ↓
Remediate
  ↓
Verify
  ↓
Document
```

Potential incidents include:

- Credential compromise.
- Tenant data leakage.
- Unauthorized access.
- Payment integration compromise.
- Malicious file upload.
- Production server compromise.

---

# 59. Credential Compromise

If a credential is suspected to be compromised:

1. Revoke or rotate it.
2. Determine affected systems.
3. Review relevant logs.
4. Restrict access.
5. Assess data exposure.
6. Restore secure credentials.
7. Document the incident.

The response should prioritize containment over preserving convenience.

---

# 60. Security Evolution Toward V1

The Demo establishes the core security architecture.

V1 may add:

- Advanced identity management.
- Stronger MFA support.
- Centralized secrets management.
- Web application firewall capabilities.
- Advanced rate limiting.
- Security information and event monitoring.
- Automated vulnerability scanning.
- More extensive audit systems.
- Stronger production isolation.
- Formal compliance controls where required.

These should build on the Demo security model rather than replace it.

---

# 61. Security Invariants

The following must remain true:

```text id="u7f4m2"
Unauthenticated users
    cannot access protected resources.

Authenticated users
    cannot access resources without authorization.

Users in Store A
    cannot access Store B resources.

Clients
    cannot define their own permissions.

External webhooks
    cannot modify state without verification.

Caches
    cannot override authoritative business state.

Secrets
    cannot be exposed to clients.

AI agents
    cannot receive unrestricted production access.
```

---

# 62. Final Principle

Security is part of the architecture, not a layer added after implementation.

The platform's governing security model is:

```text id="j8s5x1"
Authenticate
      ↓
Resolve Tenant
      ↓
Authorize
      ↓
Validate
      ↓
Execute Business Rules
      ↓
Persist Safely
      ↓
Audit / Observe
```

The governing rule is:

> **Every boundary is a security boundary until proven otherwise.**