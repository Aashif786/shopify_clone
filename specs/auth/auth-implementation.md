# Authentication Implementation Specification

## 1. Purpose

This document defines the implementation requirements for the **Authentication** capability of the Shopify-like commerce platform.

Authentication establishes who is making a request. Authorization determines what that authenticated identity is allowed to do.

These concerns must remain separate.

Authentication is security-critical and must be implemented server-side. Client-controlled identity claims must never be treated as authoritative.

---

## 2. Scope

The Authentication capability owns:

- User identity.
- Authentication credentials or delegated authentication integration.
- Login.
- Logout.
- Session management.
- Session expiration.
- Password-based authentication where supported.
- Password reset flows where supported.
- Email verification where required.
- Authentication context resolution.
- Account status checks.

It does not own:

- Store permissions.
- Role definitions.
- Store membership.
- Customer business profiles.
- Product authorization.
- Tenant authorization.

Those concerns belong to the appropriate identity, tenant, and authorization components.

---

## 3. Identity Model

The platform should distinguish between:

```text id="q8m3x6"
User Identity
     ↓
Membership
     ↓
Organization / Store
     ↓
Role / Permissions
```

A User identifies a person or account.

A Membership determines where that identity has access.

A Customer may additionally have a Store-scoped customer profile.

---

## 4. Module Location

Implementation belongs under:

```text id="x5m9c2"
packages/auth/
```

Recommended structure:

```text id="r7q3n8"
packages/auth/
├── application/
├── domain/
├── infrastructure/
└── index.ts
```

Authentication is shared infrastructure rather than a business domain module because multiple modules depend on authenticated identity.

---

## 5. Authentication vs Authorization

The implementation must maintain this distinction:

### Authentication

Answers:

> Who is this requester?

### Authorization

Answers:

> What is this requester allowed to do in this Store?

For example:

```text id="m4x8p2"
Authenticated User
       ↓
Store Membership
       ↓
Role
       ↓
Permission
       ↓
Allowed Operation
```

Successful authentication alone must never grant unrestricted Store access.

---

## 6. User Entity

Conceptually:

```text id="c7n3v9"
User
├── id
├── email
├── status
├── emailVerifiedAt?
├── createdAt
└── updatedAt
```

The exact credential fields depend on the selected authentication mechanism.

---

## 7. User Identity

The User ID must be:

- Stable.
- Server-generated.
- Immutable.
- Non-guessable where exposed externally.
- Independent of email.

Email changes must not change User identity.

---

## 8. User Status

A practical state model is:

```text id="p5m8x2"
ACTIVE
SUSPENDED
DISABLED
```

The exact states must match the account lifecycle.

Authentication must fail for identities that are not permitted to authenticate.

---

## 9. Email Normalization

Email addresses must be normalized consistently before account lookup.

The implementation should:

- Trim surrounding whitespace.
- Apply the platform's chosen case-normalization policy.
- Validate length.
- Validate syntax.

Email normalization must be deterministic.

---

## 10. Password Storage

If password authentication is implemented, plaintext passwords must never be stored.

Passwords must be processed using a modern password hashing algorithm such as:

- Argon2id.
- Another explicitly approved password hashing mechanism.

The raw password must never appear in:

- Database records.
- Logs.
- Events.
- API responses.
- Error messages.

---

## 11. Password Requirements

Password policy should define:

- Minimum length.
- Maximum accepted length.
- Password reset behavior.
- Rate limiting.
- Failed-attempt handling where required.

The system should avoid unnecessarily restrictive composition rules that encourage predictable passwords.

---

## 12. Login

A typical login flow is:

```text id="v9q4m2"
Credentials
    ↓
Validate input
    ↓
Find User
    ↓
Verify credential
    ↓
Check User status
    ↓
Create session
    ↓
Return authenticated response
```

Authentication failure should not reveal whether an email address exists.

---

## 13. Authentication Failure

Use a generic public error such as:

```text id="x6m3c8"
INVALID_CREDENTIALS
```

Do not return:

```text id="j4p8n2"
USER_NOT_FOUND
```

for normal login failures because that can enable account enumeration.

---

## 14. Session Model

The application should use secure server-managed sessions.

Conceptually:

```text id="k7c2m5"
Browser
   ↓
Session Cookie
   ↓
Server Session
   ↓
User Identity
```

The exact implementation may use a secure session library or database-backed session mechanism.

---

## 15. Session Cookie

Authentication cookies must use appropriate security attributes:

```text id="n8m4x1"
HttpOnly
Secure
SameSite
Appropriate Path
```

The exact SameSite policy must match the deployment and authentication flow.

---

## 16. Session Expiration

Sessions must have defined expiration behavior.

The system should distinguish between:

- Absolute session lifetime.
- Idle/session inactivity lifetime.

The chosen values should be configurable rather than hardcoded throughout the application.

---

## 17. Session Revocation

The system must support invalidating sessions when required.

Examples:

- Logout.
- User disabled.
- Security incident.
- Password reset.
- Administrative session revocation.

A revoked session must not remain usable indefinitely.

---

## 18. Logout

Logout should invalidate the authenticated session.

A logout request should be safe to repeat.

Example:

```text id="r5x9m3"
Active Session
   ↓
Logout
   ↓
Invalidated Session
```

---

## 19. Authentication Context

After authentication, the server should construct a request context containing the authenticated identity.

Conceptually:

```text id="q3m8v6"
RequestContext
├── userId
├── sessionId
└── authenticationState
```

Tenant and authorization context are resolved separately.

---

## 20. Tenant Context

Authentication must not automatically determine the Store.

The request pipeline should resolve:

```text id="c6x2p9"
Authenticated User
       ↓
Organization / Store Context
       ↓
Membership
       ↓
Authorization
```

This is essential for multi-tenant isolation.

---

## 21. Store Selection

If a User belongs to multiple Stores, the current Store must be explicitly resolved through a trusted mechanism.

The client may request a Store context, but the server must verify membership before accepting it.

---

## 22. Organization Membership

A User may belong to an Organization through a Membership.

The Membership determines whether the User may access Stores within that Organization.

The Authentication capability should provide identity information but should not independently grant Store access.

---

## 23. Customer Authentication

Customer authentication may use the same User identity infrastructure.

The Customer business profile remains owned by the Customers module.

Conceptually:

```text id="m7n4x8"
User
 ↓
Customer association
 ↓
Store-scoped Customer
```

The association must remain tenant-safe.

---

## 24. Merchant Authentication

Merchant users authenticate as Users.

Their Store permissions are determined by:

```text id="p8q3m5"
User
 ↓
Membership
 ↓
Role
 ↓
Permissions
```

The authentication system must not embed merchant authorization logic into credential verification.

---

## 25. Authorization Integration

Every protected request should follow:

```text id="v4c9m2"
Authenticate
    ↓
Resolve tenant
    ↓
Resolve membership
    ↓
Authorize operation
    ↓
Execute use case
```

Skipping authorization because the User is authenticated is prohibited.

---

## 26. Password Reset

If password authentication is implemented, password reset should use a short-lived, single-use token.

Typical flow:

```text id="x7m3q8"
Reset Request
   ↓
Generate Token
   ↓
Send Reset Message
   ↓
User Submits Token
   ↓
Validate Token
   ↓
Set New Password
   ↓
Invalidate Relevant Sessions
```

The raw reset token should not be stored directly where avoidable. A secure hash of the token may be stored instead.

---

## 27. Password Reset Enumeration

A password-reset request should not reveal whether an email belongs to an account.

Example response:

```text id="n5p8c2"
If an account exists, reset instructions will be sent.
```

This protects account existence information.

---

## 28. Reset Token Security

Reset tokens must:

- Be cryptographically random.
- Be short-lived.
- Be single-use.
- Be invalidated after successful use.
- Never appear in logs.
- Never be returned through APIs after creation.

---

## 29. Email Verification

If required, email verification should use a secure, short-lived, single-use token.

Verification should update the User's verification state transactionally.

---

## 30. Authentication Rate Limiting

Authentication endpoints should be protected against brute-force attempts.

Potentially protected operations include:

- Login.
- Password reset request.
- Password reset completion.
- Email verification.

The Demo may use application-level controls or an appropriate edge-level mechanism.

---

## 31. Brute-Force Protection

The system should consider:

- Per-account attempt limits.
- Per-IP limits.
- Progressive delays.
- Temporary lockout where justified.

Controls must not create an easy denial-of-service mechanism against legitimate users.

---

## 32. CSRF Protection

For cookie-based authentication, state-changing requests must have appropriate CSRF protection.

The chosen strategy should match the session and SameSite configuration.

CSRF protection must be applied to relevant browser-based mutation endpoints.

---

## 33. Authentication Headers

Authentication credentials should not be accepted from arbitrary client-controlled fields.

If bearer tokens are used for an API, they must be validated server-side and must not be confused with Store IDs, User IDs, or Customer IDs.

---

## 34. API Authentication

Protected API requests should resolve authentication before reaching business application services.

Conceptually:

```text id="q8m2v4"
HTTP Request
   ↓
Authentication Middleware
   ↓
Authenticated Context
   ↓
Tenant Middleware
   ↓
Authorization
   ↓
Application Service
```

---

## 35. Public APIs

Some APIs may be public, such as:

- Storefront product listing.
- Public Store configuration.

Public endpoints must still enforce:

- Input validation.
- Tenant resolution.
- Data exposure restrictions.
- Abuse protection where required.

---

## 36. Internal Worker Authentication

Background jobs do not originate from a browser session.

Worker execution should use trusted internal execution context.

Jobs must still carry and validate:

- Store context where applicable.
- Job identity.
- Authorization assumptions.
- Relevant ownership information.

A worker must not bypass tenant isolation merely because it is internal.

---

## 37. Webhook Authentication

External webhooks should not use normal User authentication.

Webhook authenticity must be established through provider-specific mechanisms such as:

- Signature verification.
- Shared secret.
- Provider authentication protocol.

The Webhooks/Payments implementation owns provider-specific verification.

---

## 38. Session and Worker Separation

A browser session must never be reused as worker authorization.

Likewise, worker credentials must never be exposed to browser clients.

---

## 39. Secret Management

Authentication secrets must be loaded from secure server-side configuration.

Examples:

- Session signing secrets.
- OAuth client secrets.
- Password-reset signing secrets.
- Authentication provider secrets.

Secrets must never be committed to source control.

---

## 40. Logging Restrictions

Authentication logs must not contain:

- Passwords.
- Session cookies.
- Access tokens.
- Reset tokens.
- Authentication secrets.
- Full authorization headers.

Safe logs may include:

- Event type.
- User ID where appropriate.
- Request ID.
- Timestamp.
- Result category.

---

## 41. Audit Events

Security-relevant authentication events may be recorded.

Examples:

```text id="m5x8c3"
UserLoggedIn
UserLogout
LoginFailed
PasswordChanged
PasswordResetRequested
PasswordResetCompleted
EmailVerified
SessionRevoked
UserDisabled
```

Sensitive credentials must never be included in the event payload.

---

## 42. Authentication Event Handling

Security events should not determine authentication correctness.

For example:

```text id="r7q2m9"
Login succeeds
   ↓
Commit session
   ↓
Emit audit event
```

Failure to deliver a secondary audit event should not accidentally undo an already successful authentication transaction unless the product explicitly requires that behavior.

---

## 43. Database Constraints

Potential constraints include:

```text id="x4m9p7"
unique(normalized_email)
```

for global User identity where the identity model requires it.

Session IDs and reset-token references should have appropriate uniqueness constraints.

Foreign keys must protect User relationships.

---

## 44. Session Persistence

If sessions are stored in PostgreSQL for the Demo, the session table may conceptually contain:

```text id="c8n3m6"
Session
├── id
├── userId
├── expiresAt
├── createdAt
└── lastSeenAt
```

Session records should be indexed by User and expiration.

---

## 45. Session Cleanup

Expired sessions may be cleaned up asynchronously.

Cleanup is an operational concern and must not be required for correctness.

An expired session must be rejected even if its database row has not yet been physically deleted.

---

## 46. Authentication API Endpoints

Potential endpoints:

```text id="q7m4x2"
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/session
POST /api/v1/auth/password/reset-request
POST /api/v1/auth/password/reset
POST /api/v1/auth/email/verify
```

The exact API surface depends on the selected authentication implementation.

---

## 47. Login Response

A login response should return only the information required by the client.

Do not return:

- Password hashes.
- Session internals.
- Authentication secrets.
- Internal security metadata.

---

## 48. Current Session Endpoint

A current-session endpoint may return:

```text id="m2c8x5"
{
  user,
  authenticationState
}
```

Store membership and permissions should be returned only according to the authorization/session contract.

---

## 49. Error Contract

Potential stable authentication errors:

```text id="v9m3q7"
INVALID_CREDENTIALS
AUTHENTICATION_REQUIRED
SESSION_EXPIRED
SESSION_REVOKED
ACCOUNT_DISABLED
ACCOUNT_SUSPENDED
INVALID_RESET_TOKEN
RESET_TOKEN_EXPIRED
EMAIL_NOT_VERIFIED
CSRF_VALIDATION_FAILED
TOO_MANY_ATTEMPTS
```

Errors must not expose sensitive internal details.

---

## 50. Tenant-Safe Errors

Protected resource lookup should avoid revealing whether a resource belongs to another tenant.

For example, a request for a Cart belonging to another Store may return the same public not-found response used for a nonexistent Cart where appropriate.

Authentication errors should remain distinct from resource authorization decisions.

---

## 51. Testing Strategy

### Unit Tests

Test:

- Credential validation.
- Password hashing.
- Password verification.
- Token generation.
- Token expiration.
- Authentication state transitions.

### Integration Tests

Test:

- User persistence.
- Session persistence.
- Login.
- Logout.
- Session expiration.
- Password reset.
- Email verification.
- Tenant membership resolution.

### Security Tests

Test:

- Brute-force controls.
- CSRF protection.
- Session fixation.
- Session revocation.
- Account enumeration.
- Token replay.
- Cookie security.
- Unauthorized tenant access.

### API Tests

Test:

- Login.
- Logout.
- Current session.
- Password reset.
- Verification.
- Authentication failures.

### E2E Tests

Test:

```text id="p6x8m3"
Register / Login
   ↓
Authenticated session
   ↓
Store access
   ↓
Protected operation
   ↓
Logout
   ↓
Protected operation rejected
```

---

## 52. Critical Security Tests

```text id="n4q7c8"
[ ] Passwords are never stored in plaintext
[ ] Passwords are never logged
[ ] Invalid credentials return generic errors
[ ] User enumeration is prevented
[ ] Session cookie is HttpOnly
[ ] Session cookie is Secure in production
[ ] Appropriate SameSite policy is configured
[ ] Expired sessions are rejected
[ ] Revoked sessions are rejected
[ ] Password reset tokens are single-use
[ ] Password reset tokens expire
[ ] Reset tokens are not logged
[ ] CSRF protection works
[ ] Login brute-force protection works
[ ] Cross-tenant membership access is denied
[ ] Worker credentials are never exposed to clients
[ ] Webhook authentication is separate from user authentication
```

---

## 53. Implementation Sequence

Recommended implementation order:

```text id="z8m3q6"
1. Define User identity model
2. Define authentication states
3. Select authentication/session mechanism
4. Define credential model
5. Define database schema
6. Create migrations
7. Implement password hashing if required
8. Implement session repository
9. Implement authentication service
10. Implement login
11. Implement logout
12. Implement session resolution
13. Implement password reset
14. Implement email verification
15. Implement tenant/membership integration
16. Implement authentication middleware
17. Implement CSRF protection
18. Implement rate limiting
19. Implement audit/security events
20. Implement APIs
21. Add unit tests
22. Add integration tests
23. Add security tests
24. Add API tests
25. Add E2E authentication tests
```

---

## 54. Demo Simplifications

The Demo intentionally does not require:

- Enterprise SSO.
- SAML.
- SCIM.
- Hardware security keys.
- Advanced identity federation.
- Complex MFA orchestration.
- Enterprise identity synchronization.
- Multiple independent identity providers.

A secure session-based authentication system is sufficient for the Demo.

---

## 55. V1 Evolution

The Authentication capability can later support:

- OAuth/OIDC providers.
- MFA.
- Passkeys.
- Enterprise SSO.
- SAML.
- SCIM.
- Advanced session management.
- Device/session management.
- Risk-based authentication.
- Enterprise identity policies.

These capabilities should extend the authentication boundary without moving Store authorization logic into the authentication implementation.

---

## 56. Definition of Done

The Authentication implementation is complete when:

```text id="c5m9x4"
[ ] User identity exists
[ ] Authentication mechanism is defined
[ ] Passwords are securely hashed where used
[ ] Login works
[ ] Logout works
[ ] Secure session management exists
[ ] Session expiration exists
[ ] Session revocation exists
[ ] Authentication context exists
[ ] Tenant context integrates correctly
[ ] Authentication and authorization remain separate
[ ] Password reset exists where required
[ ] Email verification exists where required
[ ] Brute-force protection exists
[ ] CSRF protection exists where required
[ ] Secure cookies are configured
[ ] Secrets are protected
[ ] Sensitive authentication data is excluded from logs
[ ] Security events are auditable
[ ] Worker authentication is separated
[ ] Webhook authentication is separated
[ ] Database constraints exist
[ ] Appropriate indexes exist
[ ] API endpoints exist
[ ] Unit tests exist
[ ] Integration tests exist
[ ] Security tests exist
[ ] API tests exist
[ ] E2E authentication tests exist
[ ] Documentation matches implementation
```