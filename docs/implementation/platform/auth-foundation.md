# Authentication Foundation Implementation

## 1. Purpose

This document defines the implementation foundation for authentication across the Demo.

Authentication establishes **who the user is**. Authorization and tenant access determine **what that user may do**.

The implementation must keep these responsibilities separate.

---

# 2. Authentication Responsibilities

The authentication foundation owns:

- User identity.
- Credential verification.
- Session creation.
- Session validation.
- Session termination.
- Password handling.
- Password reset flows.
- Email verification where required.
- Authentication context creation.

It does not own store-specific permissions or business authorization.

---

# 3. Authentication Package

Authentication infrastructure belongs in:

```text id="8v4m2k"
packages/auth
```

The package should provide reusable authentication capabilities without becoming responsible for individual business domains.

---

# 4. User Identity

The system should maintain a persistent user identity independent of any individual Store.

Conceptually:

```text id="5x8c3n"
User
  ↓
Membership
  ↓
Organization / Store
```

A user may therefore participate in multiple stores or organizations according to the membership model.

---

# 5. Authentication vs Authorization

These must remain separate:

```text id="p7m3x9"
Authentication
    ↓
Who is this user?

Authorization
    ↓
What may this user do?
```

Example:

A valid authenticated user does not automatically have permission to modify a particular Store.

---

# 6. Authentication Context

A successful authentication operation should produce a trusted authentication context.

Conceptually:

```text id="n4c8v2"
AuthContext
├── userId
├── sessionId
└── authentication state
```

Tenant and authorization information should be resolved separately.

---

# 7. Session-Based Authentication

The Demo should use secure server-managed sessions.

The browser should hold only the session mechanism required to identify the session.

The server remains responsible for validating the session and resolving the authenticated user.

---

# 8. Session Storage

Session state should be stored in persistent server-side storage appropriate to the Demo architecture.

PostgreSQL may serve as the session store for the Demo.

This avoids introducing Redis solely for authentication infrastructure.

---

# 9. Session Cookie

Authentication sessions should use secure cookie settings appropriate to the environment.

Production cookies should use:

```text id="q8m4x6"
HttpOnly
Secure
SameSite
```

with the appropriate SameSite policy for the application's routing and deployment model.

---

# 10. Cookie Scope

Cookies should be scoped as narrowly as practical.

Do not expose authentication cookies to unrelated domains or subdomains unless the architecture explicitly requires it.

---

# 11. Session Expiration

Sessions must have explicit expiration behavior.

The implementation should define:

- Session lifetime.
- Idle behavior where applicable.
- Expiration timestamp.
- Revocation behavior.

These values should be configurable where operationally useful.

---

# 12. Session Revocation

The system must support invalidating sessions.

Examples:

- User logs out.
- Password reset occurs.
- Security event requires session invalidation.
- Administrator revokes access.

Revoked sessions must no longer authenticate requests.

---

# 13. Login Flow

Conceptually:

```text id="m6c9x3"
Login Request
    ↓
Validate Input
    ↓
Find User
    ↓
Verify Credential
    ↓
Create Session
    ↓
Set Secure Cookie
    ↓
Return Authenticated Response
```

Authentication failures should not reveal unnecessary information about the account.

---

# 14. Password Storage

Passwords must never be stored in plaintext.

Passwords should use a strong password hashing mechanism appropriate to the project's security requirements.

The implementation should rely on a well-maintained cryptographic library rather than custom hashing logic.

---

# 15. Password Verification

Password verification must use the same approved password hashing mechanism used during account creation.

Do not compare passwords directly in application code.

---

# 16. Password Requirements

The application should define reasonable password requirements.

Requirements should focus on:

- Minimum strength.
- Common-password rejection where practical.
- Secure storage.

Avoid arbitrary complexity rules that encourage users to create predictable passwords.

---

# 17. Login Failure Handling

Repeated failed authentication attempts should be handled defensively.

The implementation may use:

- Rate limiting.
- Temporary throttling.
- Security logging.

The mechanism should not create an easy denial-of-service vector against legitimate users.

---

# 18. Account Enumeration Protection

Login, password reset, and account-related flows should avoid unnecessarily revealing whether an account exists.

For example, password reset requests should use a generic response where appropriate.

---

# 19. Password Reset

The password reset flow should use a short-lived, single-use reset token.

Conceptually:

```text id="r5n8c2"
Request Reset
    ↓
Create Token
    ↓
Store Hashed Token + Expiry
    ↓
Send Reset Link
    ↓
Verify Token
    ↓
Set New Password
    ↓
Invalidate Token
```

Raw reset tokens should not be stored in plaintext where avoidable.

---

# 20. Password Reset Expiration

Reset tokens must expire.

Expired tokens must be rejected.

A successful reset must invalidate the token so that it cannot be reused.

---

# 21. Password Reset and Sessions

A password reset should invalidate existing sessions when the security model requires it.

This prevents an attacker with an existing session from retaining access after the password has been changed.

---

# 22. Email Verification

If the Demo requires verified email addresses, verification should use:

- Short-lived tokens.
- Single-use semantics.
- Server-side validation.
- Persistent verification state.

Email verification should not be trusted merely because a client reports completion.

---

# 23. Authentication API Boundary

Authentication routes should live under the versioned API or application routing structure.

Conceptually:

```text id="f7m3x9"
/api/v1/auth/login
/api/v1/auth/logout
/api/v1/auth/session
/api/v1/auth/password-reset
```

Exact routes should follow the API contract.

---

# 24. Login Response

The login endpoint should return only safe user/session information.

It must never return:

- Password hashes.
- Session secrets.
- Password-reset tokens.
- Provider secrets.

---

# 25. Session Resolution

Protected requests should resolve the session before executing business operations.

Conceptually:

```text id="c4n7m2"
Request
    ↓
Session Cookie
    ↓
Session Lookup
    ↓
User
    ↓
Auth Context
```

Invalid or expired sessions must be rejected.

---

# 26. Public Requests

Public Storefront requests may not require an authenticated user.

However, they must still resolve the appropriate Store context before accessing Store-owned resources.

Authentication is optional for a customer browsing publicly available products.

---

# 27. Customer Authentication

Customers may authenticate as normal users.

A customer account's Store relationship must be enforced through the tenant and customer domain rules.

Authentication must not automatically grant access to every Store.

---

# 28. Merchant Authentication

Merchant users authenticate through the same core identity system.

Their access to Stores is determined by memberships and authorization rules.

---

# 29. Membership Relationship

The membership layer connects identity to organizational/store access.

Conceptually:

```text id="x8c4m7"
User
  ↓
Membership
  ↓
Organization
  ↓
Store
```

The exact relationship depends on the final organization/store model.

---

# 30. Authentication and Tenant Resolution

Authentication establishes the user.

Tenant resolution determines the Store or organization context.

The sequence for protected operations should generally be:

```text id="k6m3x8"
Authenticate
    ↓
Resolve Tenant
    ↓
Resolve Membership
    ↓
Authorize Action
    ↓
Execute Use Case
```

---

# 31. Authorization Boundary

Authorization must be enforced server-side.

Never rely on:

- Hidden UI controls.
- Client-side route protection.
- Browser state.
- Request-provided role values.

The server must independently determine whether the user may perform the operation.

---

# 32. Role Information

A user's role should be loaded from trusted server-side membership data.

Do not accept:

```text id="q3m8v7"
role=owner
```

from the client as authoritative.

---

# 33. Authentication Errors

Authentication failures should use stable error behavior.

Examples:

```text id="m7c4x9"
Invalid credentials
Session expired
Authentication required
Reset token invalid
Reset token expired
```

Responses should not reveal unnecessary account information.

---

# 34. Authorization Errors

Authorization failures are separate from authentication failures.

For example:

```text id="a8n5c3"
Authenticated user
      ↓
No permission for Store
      ↓
Authorization failure
```

The authentication layer should not attempt to implement every authorization rule.

---

# 35. CSRF Protection

If authentication relies on cookies, state-changing browser requests must be protected against CSRF according to the application's request architecture.

Protection may include:

- SameSite cookies.
- CSRF tokens where required.
- Origin checks.
- Appropriate API design.

The exact mechanism should be implemented consistently rather than partially across routes.

---

# 36. Authentication and CORS

Cross-origin authentication should not be enabled casually.

Allowed origins must be explicit where cross-origin requests are required.

Wildcard credentialed access is prohibited.

---

# 37. Session Fixation

Authentication must prevent session fixation.

After successful authentication, the session identifier should be newly established or rotated according to the session implementation.

---

# 38. Logout

Logout should:

1. Invalidate the server-side session.
2. Clear the authentication cookie.
3. Prevent further use of the invalidated session.

Logout should be safe to call repeatedly.

---

# 39. Concurrent Sessions

The Demo may allow multiple active sessions for one user.

If session limits are introduced later, the implementation should support explicit session management rather than relying on undocumented behavior.

---

# 40. Authentication Audit Events

Security-relevant authentication events should be logged or recorded as appropriate.

Examples:

- Successful login.
- Failed login.
- Logout.
- Password reset.
- Email verification.
- Session revocation.

Logs must avoid passwords and sensitive tokens.

---

# 41. Authentication Rate Limiting

Rate limiting should be considered for:

- Login.
- Password reset requests.
- Verification requests.
- Other abuse-prone authentication endpoints.

The initial Demo may use a simple implementation appropriate to its scale.

---

# 42. Development Authentication

Development authentication must use the same security model as production where practical.

Development shortcuts must not bypass the actual authorization path.

Seeded development accounts should authenticate normally.

---

# 43. Test Authentication

Tests should provide controlled authentication helpers.

For example:

```text id="y4m8c2"
createTestUser()
createTestSession()
authenticateTestRequest()
```

These helpers must still exercise the authorization model correctly.

---

# 44. Authentication Dependencies

Authentication may depend on:

```text id="w7c3m9"
config
db
types
validation
```

It should not depend on business domains such as:

```text id="f2n8x5"
products
orders
inventory
payments
```

This prevents the authentication foundation from becoming entangled with commerce functionality.

---

# 45. Authentication Initialization

Application startup must verify that required authentication configuration exists.

For example:

```text id="p8m4x6"
AUTH_SECRET
```

must be validated before protected authentication functionality is made available.

---

# 46. Secret Rotation

Authentication secrets should be replaceable through configuration.

Rotation procedures must consider:

- Existing sessions.
- Reset tokens.
- Verification tokens.
- Deployment overlap.

A secret change must not accidentally leave authentication in an undefined state.

---

# 47. Authentication Data Protection

Authentication data should be treated as sensitive.

Do not expose:

- Password hashes.
- Session tokens.
- Reset tokens.
- Verification tokens.
- Authentication secrets.

These values must also be excluded from normal structured logs.

---

# 48. Authentication Testing

The foundation must include tests for:

### Positive cases

- User creation.
- Successful login.
- Session resolution.
- Logout.
- Password reset.
- Email verification where applicable.

### Negative cases

- Invalid password.
- Invalid session.
- Expired session.
- Expired reset token.
- Reused reset token.
- Invalid verification token.
- Missing authentication.
- Account enumeration behavior.

---

# 49. Authentication Definition of Done

```text id="j5m9c4"
[ ] User identity model exists
[ ] Session model exists
[ ] Secure session cookie behavior exists
[ ] Password hashing exists
[ ] Login works
[ ] Logout works
[ ] Session validation works
[ ] Session expiration works
[ ] Session revocation works
[ ] Password reset foundation exists
[ ] Reset tokens expire
[ ] Reset tokens are single-use
[ ] Email verification exists if required
[ ] Authentication routes exist
[ ] Authentication errors are safe
[ ] Account enumeration is mitigated
[ ] CSRF strategy is implemented
[ ] Authentication rate limiting is addressed
[ ] Authentication events are logged safely
[ ] Production secrets are protected
[ ] Test authentication helpers exist
[ ] Authentication tests pass
```

---

# 50. Final Authentication Principle

Authentication establishes identity and nothing more:

```text id="x7m3q8"
Credentials
    ↓
Authenticated User
    ↓
Tenant Context
    ↓
Membership
    ↓
Authorization
    ↓
Business Operation
```

Keeping these boundaries separate prevents a valid login from becoming an accidental master key to every Store in the system.