# Security Verification

## 1. Purpose

This document defines the execution-level security verification required for the Demo.

The objective is to verify that security controls are enforced at the server, application, database, integration, and infrastructure boundaries.

The Demo must protect:

- Authentication.
- Authorization.
- Tenant isolation.
- Customer and merchant data.
- Payment workflows.
- Webhooks.
- Media.
- Sessions.
- Secrets.
- Background jobs.
- APIs.

Security verification must focus on actual attack paths rather than merely checking that security-related code exists.

---

# 2. Security Verification Principles

The following principles apply:

```text
Server-side enforcement
Fail closed
Least privilege
Explicit tenant context
Explicit authorization
Validate external input
Never trust client-provided business state
Protect secrets
Minimize sensitive data
Audit critical operations
```

A UI restriction is never considered a security control by itself.

---

# 3. Security Verification Scope

Verify:

```text
Authentication
Authorization
Tenant isolation
Object-level access
Input validation
API security
Session security
CSRF/CORS behavior
Webhook security
Payment security
Media security
Job security
Database security
Secret handling
Logging
Dependency security
Production access
```

---

# 4. Authentication Verification

Test:

```text
[ ] Valid login succeeds
[ ] Invalid credentials fail
[ ] Invalid credentials do not reveal account existence
[ ] Session is created securely
[ ] Session expires correctly
[ ] Logout invalidates session
[ ] Invalid session is rejected
[ ] Password reset is protected
[ ] Email verification is protected
[ ] Authentication-required endpoints reject unauthenticated requests
```

---

# 5. Password Security

Verify:

```text
[ ] Passwords are never stored in plaintext
[ ] Password hashes use an appropriate password hashing algorithm
[ ] Passwords never appear in logs
[ ] Password reset tokens are protected
[ ] Password reset tokens expire
[ ] Reset tokens cannot be reused
[ ] Password changes invalidate appropriate sessions
```

---

# 6. Session Security

Verify:

```text
[ ] Secure cookies are used in production
[ ] HttpOnly is enabled where appropriate
[ ] SameSite policy is appropriate
[ ] Session identifiers are not exposed to client JavaScript unnecessarily
[ ] Session expiration works
[ ] Logout invalidates the session
[ ] Session fixation is prevented
```

---

# 7. Authorization Verification

Authorization must be tested independently from authentication.

Verify:

```text
[ ] Owner permissions
[ ] Admin permissions
[ ] Staff permissions
[ ] Customer permissions
[ ] Unauthenticated access
[ ] Unauthorized role access
[ ] Resource-level authorization
```

Every protected application service must receive and validate the authorization context.

---

# 8. Role Escalation Tests

Attempt to perform privileged operations using lower-privilege accounts.

Examples:

```text
Staff → change Store ownership
Staff → manage privileged settings
Customer → create Product
Customer → modify Inventory
Customer → access merchant Orders
```

All unauthorized operations must fail.

---

# 9. Tenant Isolation

Tenant isolation is a critical security requirement.

Create:

```text
Organization A
Store A

Organization B
Store B
```

Then attempt:

```text
Store A user → Store B Product
Store A user → Store B Customer
Store A user → Store B Cart
Store A user → Store B Checkout
Store A user → Store B Payment
Store A user → Store B Order
Store A user → Store B Media
```

Every unauthorized operation must fail.

---

# 10. Object-Level Authorization

Test direct identifier manipulation.

Examples:

```text
GET /api/v1/orders/{other-order-id}
GET /api/v1/products/{other-product-id}
GET /api/v1/customers/{other-customer-id}
DELETE /api/v1/media/{other-media-id}
```

Changing an identifier must never bypass Store or user authorization.

---

# 11. Resource Lookup Security

Prefer Store-scoped lookups:

```text
findOrder(storeId, orderId)
```

over:

```text
findOrder(orderId)
```

where the operation is tenant-scoped.

This reduces the risk of accidental cross-tenant access.

---

# 12. Input Validation

Every external input must be validated.

Test:

```text
[ ] Missing fields
[ ] Invalid types
[ ] Oversized strings
[ ] Invalid identifiers
[ ] Invalid enum values
[ ] Negative quantities
[ ] Invalid monetary values
[ ] Invalid dates
[ ] Malformed JSON
[ ] Unexpected payload structures
```

Validation must occur before business logic executes.

---

# 13. SQL Injection Verification

Attempt SQL injection against:

```text
Search fields
Product filters
Order filters
Store identifiers
Customer lookup
Pagination parameters
Query parameters
```

Verify that parameterized database access prevents SQL injection.

Do not construct SQL using untrusted string concatenation.

---

# 14. Cross-Site Scripting Verification

Test user-controlled content such as:

```text
Product title
Product description
Store name
Customer name
Order notes
Discount names
```

Verify that values are safely rendered.

Stored content must not execute arbitrary browser JavaScript.

---

# 15. HTML and Rich Content

If the Demo supports HTML or rich text:

```text
[ ] HTML is explicitly sanitized
[ ] Dangerous tags are removed
[ ] Dangerous attributes are removed
[ ] JavaScript URLs are rejected
[ ] Inline scripts are rejected
```

If rich HTML is not required, plain text is preferable.

---

# 16. CSRF Verification

For cookie-based authentication, verify CSRF protection for state-changing requests where applicable.

Test:

```text
POST
PUT
PATCH
DELETE
```

Attempt requests without the required CSRF protection.

The exact mechanism must follow the authentication architecture.

---

# 17. CORS Verification

Verify that:

```text
[ ] Allowed origins are explicit
[ ] Wildcard origins are not used with credentials
[ ] Untrusted origins cannot perform authenticated requests
[ ] Allowed methods are limited
[ ] Allowed headers are appropriate
```

Production configuration must not use development-wide CORS settings.

---

# 18. API Security

Verify:

```text
[ ] Authentication
[ ] Authorization
[ ] Request validation
[ ] Response filtering
[ ] Pagination limits
[ ] Request size limits
[ ] Rate limiting where required
[ ] Consistent error responses
```

Do not expose internal database records directly.

---

# 19. Information Disclosure

Attempt to trigger errors using invalid input.

Verify responses do not expose:

```text
Database connection strings
SQL statements
Filesystem paths
Stack traces
Provider secrets
Environment variables
Internal credentials
```

Detailed diagnostics should remain server-side.

---

# 20. Enumeration Protection

Authentication and account-related endpoints should avoid unnecessary information disclosure.

Examples:

```text
Unknown email
Existing email
Unknown customer
Existing customer
```

Responses should not unnecessarily reveal whether an account exists.

---

# 21. Rate-Limit Verification

At minimum, assess rate limiting for sensitive endpoints:

```text
Login
Password reset
Email verification
Checkout completion
Payment operations
Webhook endpoints
Upload endpoints
```

The Demo may use simple application/infrastructure-level rate limiting.

---

# 22. Payment Security

Verify:

```text
[ ] Client cannot modify payment amount
[ ] Client cannot modify payment currency
[ ] Client cannot mark payment successful
[ ] Payment provider references are validated
[ ] Provider idempotency is used where available
[ ] Application idempotency is enforced
[ ] Unknown payment outcomes are reconciled
[ ] Sensitive payment credentials are never stored
```

---

# 23. Payment Data Protection

Verify the application does not store:

```text
Raw card number
CVV
Magnetic stripe data
Provider secret keys
```

Only required provider references and safe metadata should be persisted.

---

# 24. Webhook Security

Webhook endpoints must be tested for:

```text
[ ] Invalid signature
[ ] Missing signature
[ ] Modified payload
[ ] Replay attack
[ ] Duplicate event
[ ] Invalid timestamp
[ ] Oversized payload
[ ] Unsupported event
```

Invalid webhooks must not modify business state.

---

# 25. Webhook Replay Test

Capture a valid webhook.

Then resend the same request.

Expected:

```text
First request
    → Processed

Second request
    → Recognized as duplicate
    → No duplicate business effect
```

---

# 26. Media Security

Verify:

```text
[ ] Upload size limits
[ ] MIME validation
[ ] Object-key sanitization
[ ] Path traversal prevention
[ ] Cross-store access prevention
[ ] Unauthorized deletion prevention
[ ] Private media access protection
[ ] Signed URL expiration
```

---

# 27. File Upload Abuse

Attempt uploads containing:

```text
Executable files
Unexpected MIME types
Oversized files
Malformed files
Path traversal filenames
Double extensions
```

The application must reject unsupported content.

Do not rely only on filename extensions.

---

# 28. Object Storage Security

Verify:

```text
[ ] Bucket credentials are server-side only
[ ] Public access is limited to intended objects
[ ] Private objects require authorization
[ ] Signed URLs expire
[ ] Object keys cannot be chosen arbitrarily by clients
[ ] Cross-store object access is prevented
```

---

# 29. Job Security

Verify that clients cannot create arbitrary privileged Jobs.

Test attempts to submit:

```text
Unknown job type
Forged store ID
Forged payment ID
Forged notification ID
Malformed payload
```

Only trusted application code should create privileged background work.

---

# 30. Job Payload Security

Job payloads must not contain unnecessary secrets.

Verify that logs and database records do not contain:

```text
Passwords
Session tokens
Provider secrets
Webhook secrets
Payment credentials
```

---

# 31. Notification Security

Verify:

```text
[ ] Recipient is resolved from trusted data
[ ] Client cannot redirect transactional email arbitrarily
[ ] Sensitive payloads are not logged
[ ] Templates cannot execute arbitrary code
[ ] Cross-store notification access is blocked
```

---

# 32. Database Security

Verify:

```text
[ ] Production credentials are not committed
[ ] Application database user has only required permissions
[ ] Migrations use controlled credentials
[ ] Test database is isolated
[ ] Production database is not used by tests
[ ] Backups are protected
```

---

# 33. Database Integrity as Security

Security verification must also confirm database constraints that prevent invalid states.

Test:

```text
[ ] Unique constraints
[ ] Foreign keys
[ ] Check constraints
[ ] Store-scoped uniqueness
[ ] Idempotency uniqueness
[ ] Webhook event uniqueness
```

Application validation is not a substitute for database integrity.

---

# 34. Transaction Security

Verify that security-sensitive state changes are transactional where required.

Examples:

```text
Inventory reservation
Payment state transition
Order creation
Refund creation
Discount usage
Webhook processing
Idempotency recording
```

Partial state must not create an authorization or financial bypass.

---

# 35. Logging Security

Search application logs for:

```text
password
token
secret
authorization
cookie
card
cvv
api_key
webhook_secret
```

Sensitive values must not appear.

Structured logs should contain safe identifiers instead.

---

# 36. Error Security

Verify that expected application errors are safe.

For example:

```text
Expected:
ORDER_NOT_FOUND

Not acceptable:
PostgreSQL error: relation "orders" ...
```

Internal errors should be logged server-side and represented to clients through stable error responses.

---

# 37. Secret Management

Verify:

```text
[ ] .env files are ignored
[ ] .env.example contains placeholders only
[ ] Secrets are not committed
[ ] Secrets are not included in frontend bundles
[ ] Provider credentials are server-only
[ ] CI secrets are stored through CI secret mechanisms
[ ] Production secrets are separated from Demo/local secrets
```

---

# 38. Frontend Secret Verification

Inspect the production build and browser-exposed configuration.

Verify that only explicitly public configuration is exposed.

Never expose:

```text
Database credentials
Payment secret keys
Object storage secret keys
Webhook secrets
Session signing secrets
Private API credentials
```

---

# 39. Dependency Security

CI should check dependencies for known vulnerabilities where practical.

Review:

```text
[ ] Production dependencies
[ ] Transitive dependencies
[ ] Provider SDKs
[ ] Authentication libraries
[ ] File-processing libraries
```

Do not blindly upgrade dependencies without compatibility verification.

---

# 40. Security Headers

Verify appropriate production headers such as:

```text
Content-Security-Policy
X-Content-Type-Options
Referrer-Policy
Strict-Transport-Security
```

The exact policy must be compatible with the application.

Do not enable an overly restrictive CSP without testing actual application behavior.

---

# 41. HTTPS Verification

Production traffic must use HTTPS.

Verify:

```text
[ ] HTTP redirects or is otherwise blocked
[ ] Secure cookies are used
[ ] TLS certificates are valid
[ ] Internal sensitive endpoints are not exposed over plaintext
```

---

# 42. Production Access

Production access must be restricted.

Verify:

```text
[ ] SSH access is restricted
[ ] Database is not publicly exposed unnecessarily
[ ] Application secrets are not accessible to normal users
[ ] Production admin credentials are protected
[ ] AI development tooling does not receive unrestricted production access
```

---

# 43. Backup Security

Verify:

```text
[ ] Backups exist
[ ] Backups are access-controlled
[ ] Backup credentials are protected
[ ] Backup storage is not publicly accessible
[ ] Restore procedure is documented
```

A backup that anyone can download is merely a second database with worse marketing.

---

# 44. Security Regression Testing

Every security bug fix must produce a regression test.

Process:

```text
1. Reproduce vulnerability
2. Add failing security test
3. Implement fix
4. Verify focused test
5. Run broader security suite
```

---

# 45. Security Test Matrix

| Area | Required Verification |
|---|---|
| Authentication | Login/session/reset |
| Authorization | Role and resource access |
| Tenant Isolation | Cross-store attacks |
| API | Validation and exposure |
| Payments | Amount/idempotency |
| Webhooks | Signature/replay |
| Media | Upload/access |
| Jobs | Payload/privilege |
| Database | Constraints/credentials |
| Secrets | Repository/build/logs |
| Logging | Sensitive-data leakage |
| Infrastructure | HTTPS/access |
| Dependencies | Vulnerability review |

---

# 46. Security Verification Execution Order

Run security verification in this order:

```text
1. Authentication
2. Authorization
3. Tenant isolation
4. Object-level access
5. Input validation
6. API security
7. Payment security
8. Webhook security
9. Media security
10. Job security
11. Database security
12. Secret scanning
13. Logging inspection
14. Dependency scanning
15. Production configuration review
```

---

# 47. Security Exit Criteria

Security verification is successful only when:

```text
[ ] No known critical authorization bypass exists
[ ] No cross-tenant access exists
[ ] Critical payment operations are protected
[ ] Webhook signatures are enforced
[ ] Replay protection works
[ ] Sensitive credentials are not exposed
[ ] Secrets are not committed
[ ] Sensitive data is not logged
[ ] File uploads are constrained
[ ] Background jobs cannot be arbitrarily triggered
[ ] Database constraints protect critical invariants
[ ] Security regression tests pass
[ ] Production configuration has been reviewed
```

---

# 48. Definition of Done

Security verification is complete when:

```text
[ ] Authentication security tests pass
[ ] Authorization tests pass
[ ] Tenant isolation tests pass
[ ] Object-level access tests pass
[ ] Input validation tests pass
[ ] API security tests pass
[ ] CSRF/CORS behavior is verified
[ ] Payment security tests pass
[ ] Webhook security tests pass
[ ] Media security tests pass
[ ] Job security tests pass
[ ] Database security checks pass
[ ] Secret scanning passes
[ ] Sensitive logging review passes
[ ] Dependency security review passes
[ ] Security headers are configured
[ ] HTTPS configuration is verified
[ ] Production access is restricted
[ ] Backup access is protected
[ ] Security regression tests are present
[ ] No unresolved critical security issue remains
```