# Authentication Implementation

## 1. Purpose

This document defines how authentication is implemented for the Demo.

Authentication establishes **who the user is**. It does not determine what that user is allowed to do within a Store.

The implementation must provide:

- Secure user identity.
- Session management.
- Login/logout.
- Password handling.
- Password reset where required.
- Email verification where required.
- Authentication context.
- Session invalidation.
- Brute-force protection.
- Tenant-aware integration.
- Secure browser behavior.

Authorization remains a separate concern.

---

# 2. Authentication Ownership

Authentication infrastructure is owned by:

```text id="w6n3r8"
packages/auth
```

The authentication package integrates with:

```text id="p8m4q2"
packages/db
packages/config
packages/tenant
apps/web
```

Business authorization remains outside the authentication package.

---

# 3. Authentication vs Authorization

The distinction is mandatory.

```text id="q7v5m3"
Authentication
→ Who is this user?

Authorization
→ What may this user do?
```

Example:

```text id="x4n8p6"
Authenticated user = user_123

Authorization:
user_123 may manage Store A
user_123 may not manage Store B
```

Successful authentication must never imply access to every Store.

---

# 4. User Identity

The User represents an authenticated platform identity.

Typical fields include:

```text id="m5r7q2"
id
email
password_hash where applicable
status
email_verified_at
created_at
updated_at
```

The exact schema follows the approved database and product specifications.

---

# 5. Email Identity

Email addresses used for authentication must have a consistent normalization strategy.

At minimum:

```text id="v8p4n6"
Trim surrounding whitespace
Apply consistent case handling
Validate format
```

The normalization rule must be applied consistently during registration, login, and account recovery.

---

# 6. Password Storage

Passwords must never be stored in plaintext.

Use a modern password hashing algorithm appropriate for server-side password storage.

The implementation should use the approved authentication library or cryptographic primitive rather than inventing a custom hashing scheme.

---

# 7. Password Verification

Login verification should:

```text id="q3m7r5"
Load user
  ↓
Check account status
  ↓
Verify password hash
  ↓
Create authenticated session
```

Do not return detailed information that allows attackers to distinguish:

```text id="x8n4p2"
unknown email
known email + wrong password
disabled account
```

where that distinction would enable account enumeration.

---

# 8. Login Flow

The normal login flow is:

```text id="v5q8m3"
Client
  ↓
Submit credentials
  ↓
Validate request
  ↓
Normalize identity
  ↓
Find user
  ↓
Verify password
  ↓
Apply account/security checks
  ↓
Create session
  ↓
Set secure cookie
  ↓
Return authenticated response
```

---

# 9. Session Model

The Demo should use secure server-managed sessions.

The browser should hold a secure session identifier rather than the full authorization state.

Conceptually:

```text id="m4r7p8"
Browser
  ↓
Session Cookie
  ↓
Server
  ↓
Session
  ↓
User
```

---

# 10. Session Storage

Session persistence may be stored in PostgreSQL for the Demo.

The session record should support:

```text id="q6n3v8"
session identifier
user identifier
created_at
expires_at
last activity where required
revoked_at where required
```

The exact schema follows the authentication implementation.

---

# 11. Session Identifier

Session identifiers must be:

- Cryptographically unpredictable.
- Sufficiently long.
- Randomly generated.
- Non-sequential.
- Never derived from the User ID.

---

# 12. Session Cookie

Authentication cookies should use appropriate security attributes.

Production should use:

```text id="x7m4q5"
HttpOnly
Secure
SameSite
appropriate Path
appropriate expiration
```

The exact SameSite policy depends on the application's request architecture.

---

# 13. HTTPS

Authenticated production traffic must use HTTPS.

Secure cookies must not be disabled merely because development is easier without them.

Local development may use appropriate framework-supported exceptions.

---

# 14. Session Expiration

Sessions must have an explicit lifetime.

The implementation should distinguish between:

```text id="v3q8m6"
absolute expiration
idle expiration where appropriate
```

Do not create sessions that remain valid indefinitely without a security justification.

---

# 15. Session Rotation

Session identifiers should be rotated after security-sensitive authentication transitions where appropriate.

Examples:

```text id="m5r7n4"
Successful login
Password change
Privilege/security transition
```

This helps prevent session fixation.

---

# 16. Logout

Logout must invalidate the server-side session.

The flow is:

```text id="q8v4m2"
Request logout
  ↓
Authenticate session
  ↓
Revoke/invalidate session
  ↓
Clear browser cookie
```

Clearing the cookie alone is insufficient if the server-side session remains usable.

---

# 17. Logout from All Devices

Where supported, the implementation should provide a mechanism to revoke all active sessions for a user.

This is particularly useful after:

```text id="x6m8q3"
Password compromise
Password reset
Account recovery
Security incident
```

---

# 18. Password Change

A password change should require appropriate authentication.

Recommended flow:

```text id="v7r4p5"
Authenticated session
  ↓
Verify current credentials where appropriate
  ↓
Validate new password
  ↓
Hash new password
  ↓
Update user
  ↓
Invalidate affected sessions
```

The exact session-revocation policy should follow the security specification.

---

# 19. Password Reset

Password reset must use a short-lived, single-use reset mechanism.

Conceptually:

```text id="m8q3n6"
Request reset
  ↓
Generate random reset token
  ↓
Store hashed/token reference
  ↓
Send reset message
  ↓
User submits token
  ↓
Validate expiry + unused state
  ↓
Set new password
  ↓
Invalidate token
  ↓
Invalidate/review active sessions
```

---

# 20. Reset Token Storage

Do not store password-reset tokens in plaintext where avoidable.

Store a secure representation sufficient to verify the submitted token.

Reset records should have:

```text id="q5r8m4"
user_id
token_hash/reference
expires_at
used_at
created_at
```

---

# 21. Password Reset Enumeration

Password-reset requests should not reveal whether an account exists.

A response should use a generic message such as:

```text id="x4n7p8"
If an account exists, reset instructions will be sent.
```

The server may still log the actual internal result securely.

---

# 22. Email Verification

If email verification is part of the Demo authentication flow, use a short-lived verification token.

The token must:

- Be difficult to guess.
- Expire.
- Be single-use.
- Be invalidated after successful verification.

---

# 23. Account Status

User accounts should have explicit lifecycle state.

Examples:

```text id="m6q4r9"
active
disabled
pending verification
```

The exact state machine must follow the approved authentication/domain specification.

Disabled users must not be able to create new authenticated sessions.

---

# 24. Authentication Context

After authentication, the server should create an explicit authentication context.

Conceptually:

```text id="v8n5q3"
AuthContext
├── userId
├── sessionId
└── authentication state
```

Tenant context and permissions are resolved separately.

---

# 25. Tenant Integration

The authenticated User must be resolved against Store/Organization memberships.

Conceptually:

```text id="q7m4p8"
Session
 ↓
User
 ↓
Membership
 ↓
Organization / Store
 ↓
Authorization
```

The authentication package must not silently grant Store access.

---

# 26. Authorization Boundary

Authorization should be performed by the application/service layer or appropriate tenant-aware policy.

Example:

```text id="x5r8m3"
requireAuthenticatedUser()
requireStoreAccess(storeId)
requirePermission("products:write")
```

The exact API may differ.

---

# 27. Role Handling

Roles should come from trusted membership records.

Never trust:

```text id="m4q7n6"
request.body.role
query.role
localStorage.role
client JWT claims
hidden form fields
```

as the authoritative permission source.

---

# 28. Role Changes

If a user's Store role changes:

```text id="v6p3r8"
future authorization checks
```

must use the updated membership state.

Do not allow stale client-side role information to determine access.

---

# 29. Session Revocation After Role Changes

The system may revoke or refresh sessions after sensitive authorization changes.

The exact strategy depends on the authorization/session implementation.

The important requirement is that permission changes must become effective server-side without relying on a browser refresh alone.

---

# 30. Brute-Force Protection

Authentication endpoints must include appropriate protection against repeated credential attempts.

Possible mechanisms include:

```text id="q8m5r3"
Rate limiting
Progressive delays
Temporary lockout
IP/device heuristics
```

The Demo should choose a simple effective mechanism rather than building an elaborate fraud system.

---

# 31. Rate-Limit Identity

Rate limiting should consider more than just IP where appropriate.

For example:

```text id="x7r4n8"
IP address
Account identifier
Authentication endpoint
```

The implementation must avoid making a single stolen or shared IP capable of disabling legitimate users indefinitely.

---

# 32. Credential Error Responses

Authentication failures should use generic messages.

Avoid:

```text id="m3q8p5"
Email does not exist.
```

Prefer:

```text id="v4n7r6"
Invalid email or password.
```

This reduces account enumeration.

---

# 33. CSRF Protection

Cookie-authenticated state-changing requests must have appropriate CSRF protection.

Authentication endpoints such as:

```text id="q5m8r3"
Login
Logout
Password change
Password reset
```

must be reviewed under the application's CSRF strategy.

---

# 34. Origin Validation

Where appropriate, sensitive browser requests should validate trusted origins.

This is particularly important when cookies automatically accompany requests.

---

# 35. CORS

CORS must be restrictive for authenticated APIs.

Do not expose authenticated endpoints to arbitrary origins.

Allowed origins should come from validated configuration.

---

# 36. Authentication API Responses

Authentication APIs should use stable DTOs.

Never return:

```text id="x8q4m6"
password_hash
session secret
reset token
internal authentication metadata
```

Only return information required by the client.

---

# 37. Session Lookup

Every authenticated request should resolve the session securely.

Conceptually:

```text id="m7r3p8"
Cookie
 ↓
Validate session identifier
 ↓
Load session
 ↓
Check expiry/revocation
 ↓
Load user
 ↓
Check user status
 ↓
Create AuthContext
```

Invalid sessions must fail closed.

---

# 38. Expired Sessions

Expired or revoked sessions must not authenticate requests.

The application should remove or invalidate the corresponding browser cookie when appropriate.

---

# 39. Session Cleanup

Expired sessions may be removed through a background cleanup job.

Cleanup must not affect active sessions.

---

# 40. Authentication Logging

Authentication events should be logged with useful security context.

Examples:

```text id="v6m4q8"
Login success
Login failure
Logout
Password reset requested
Password reset completed
Password changed
Session revoked
Account disabled
```

Do not log passwords, tokens, or session identifiers in plaintext.

---

# 41. Security Event Metadata

Useful metadata may include:

```text id="q7r5m3"
requestId
userId where known
event type
timestamp
IP metadata where policy permits
user-agent metadata where useful
```

Privacy requirements must be respected.

---

# 42. Authentication Errors

Authentication failures should be represented with stable internal/application error types.

Examples:

```text id="x4n8p7"
InvalidCredentials
SessionExpired
SessionRevoked
AccountDisabled
InvalidResetToken
ResetTokenExpired
```

Public API error codes should remain stable.

---

# 43. External Authentication Providers

Social login or enterprise SSO is not required for the Demo unless explicitly added later.

Do not introduce OAuth/SSO infrastructure merely because a production Cal Cart platform might eventually require it.

The authentication boundary should remain extensible without implementing unused providers.

---

# 44. Password Policy

The password policy should provide a meaningful minimum standard without creating unnecessary usability problems.

At minimum, enforce:

```text id="m5q8r4"
Minimum length
Reasonable validation
```

Avoid arbitrary complexity rules that encourage users to write passwords such as `Password123!`.

---

# 45. Password Reuse

Advanced password-history enforcement is not required for the Demo unless a security requirement introduces it.

Do not add complexity without a demonstrated need.

---

# 46. Authentication Testing

Authentication must be tested at multiple levels.

Required scenarios include:

```text id="v8r5m2"
Valid login
Invalid password
Unknown account
Disabled account
Session creation
Session expiry
Session revocation
Logout
Password change
Password reset
Token expiration
Token reuse
CSRF protection
Brute-force protection
```

---

# 47. Tenant Security Tests

Authentication tests must also verify that authentication does not bypass tenant authorization.

Examples:

```text id="q4m7n8"
User authenticated for Store A
→ cannot access Store B

User authenticated but not a Store member
→ denied

Staff user
→ cannot perform owner-only operation
```

---

# 48. Security-Critical Integration Tests

At least one integration test should verify:

```text id="x6r3p9"
login
→ session cookie
→ authenticated request
→ tenant resolution
→ authorization
```

This verifies the complete security chain rather than isolated functions.

---

# 49. Authentication Implementation Order

Implement authentication in this order:

```text id="m8q5v4"
1. User persistence
2. Password hashing
3. Session persistence
4. Session creation/lookup
5. Login
6. Logout
7. Authentication context
8. Tenant integration
9. Password change
10. Password reset
11. Email verification where required
12. Brute-force protection
13. Security logging
14. Authentication tests
```

---

# 50. AI-Assisted Authentication Rules

AI-generated authentication code must receive additional review.

The implementation must:

1. Inspect the existing authentication architecture.
2. Never invent custom cryptography.
3. Never store plaintext credentials.
4. Never expose secrets.
5. Preserve server-side authorization.
6. Validate session lifecycle.
7. Consider CSRF.
8. Consider account enumeration.
9. Consider brute-force protection.
10. Test failure paths, not only successful login.

---

# 51. Definition of Done

Authentication implementation is complete when:

```text id="v7m4q3"
[ ] User identity is persisted securely
[ ] Passwords are securely hashed
[ ] Login works
[ ] Logout invalidates sessions
[ ] Sessions expire correctly
[ ] Sessions can be revoked
[ ] Authentication context is available
[ ] Tenant integration works
[ ] Authorization remains separate
[ ] Password reset is secure where required
[ ] Email verification works where required
[ ] Brute-force protection exists
[ ] Generic credential errors prevent enumeration
[ ] CSRF strategy is implemented
[ ] Secure cookies are configured
[ ] Secrets/tokens are never logged
[ ] Authentication APIs expose safe DTOs
[ ] Security tests pass
[ ] TypeScript passes
[ ] Lint passes
```

---

# 52. Final Principle

Authentication is the **identity boundary**, not the permission boundary.

A secure implementation must make it straightforward to answer:

> Who is this user?

while requiring a separate, explicit answer to:

> What is this user allowed to do in this Store?

Keeping those questions separate is essential for preventing authentication bugs from becoming tenant-isolation and authorization failures.