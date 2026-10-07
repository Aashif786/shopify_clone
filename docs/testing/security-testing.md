# Security Testing

## 1. Purpose

This document defines the security-testing strategy for the Shopify-like commerce platform.

Security testing verifies that authentication, authorization, tenant isolation, input handling, data protection, integrations, and critical business operations resist unauthorized access and unsafe behavior.

Security testing is treated as a continuous engineering responsibility rather than a final pre-release activity.

---

## 2. Security Testing Principles

Security tests should:

- Test security boundaries explicitly.
- Verify server-side enforcement.
- Assume client input is untrusted.
- Verify tenant isolation.
- Test authentication and authorization separately.
- Test both positive and negative cases.
- Protect sensitive data in test environments.
- Focus heavily on high-risk business operations.
- Avoid relying exclusively on static analysis or dependency scanners.
- Never use production credentials or production customer data.

---

## 3. Security Testing Scope

Security testing covers:

- Authentication.
- Authorization.
- Tenant isolation.
- Session security.
- Input validation.
- API security.
- Database access.
- Webhooks.
- Payment flows.
- Inventory operations.
- Order operations.
- File/media handling.
- Secrets.
- Dependency security.
- Background jobs.
- Error handling.
- Logging and observability.

---

## 4. Risk-Based Priority

The highest security-testing priority is:

1. Tenant isolation.
2. Authorization.
3. Authentication.
4. Payment operations.
5. Checkout.
6. Inventory.
7. Order access.
8. Webhooks.
9. Input validation.
10. File/media access.
11. Secrets and configuration.
12. Dependency vulnerabilities.

A vulnerability allowing one merchant to access another merchant's data is significantly more severe than a cosmetic UI issue. Humanity occasionally benefits from prioritizing the actual disaster.

---

## 5. Authentication Testing

Authentication tests should verify:

- Valid credentials succeed.
- Invalid credentials fail.
- Missing credentials fail.
- Expired sessions fail.
- Invalid sessions fail.
- Session invalidation works where supported.
- Protected endpoints reject unauthenticated requests.
- Authentication state cannot be forged through client-controlled fields.

---

## 6. Authorization Testing

Authorization must be tested independently from authentication.

Tests should verify:

```text id="x3k8m1"
Authenticated
≠
Authorized
```

A valid user must still be denied when they lack permission for the requested operation.

Test:

- Owner permissions.
- Admin permissions.
- Staff permissions.
- Customer permissions.
- Guest permissions.
- Suspended memberships.
- Removed memberships.

---

## 7. Tenant Isolation Testing

Tenant isolation is a mandatory security boundary.

Tests should attempt:

```text id="m7q2v9"
Store A user
→ Store B resource
```

Across:

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
- Media.

Expected result:

```text id="r4n8x2"
Access denied
or
tenant-safe not-found
```

No cross-tenant data may be exposed.

---

## 8. IDOR Testing

Insecure Direct Object Reference vulnerabilities must be tested explicitly.

Example:

```text id="v8m3q5"
GET /api/v1/orders/order-A
```

while authenticated as a user belonging only to Store B.

Changing an identifier must never bypass authorization.

Test both:

- Sequential IDs.
- Random/public identifiers.

Security must never depend on identifiers being difficult to guess.

---

## 9. API Authorization Testing

Every protected API operation should have authorization tests.

Test:

```text id="n5x8q3"
No authentication
→ rejected

Authenticated but wrong tenant
→ rejected

Authenticated correct tenant but insufficient role
→ rejected

Authenticated correct tenant and role
→ allowed
```

---

## 10. Input Validation Testing

Test malformed and unexpected input at every public boundary.

Examples:

- Missing fields.
- Wrong data types.
- Empty strings.
- Excessively long strings.
- Negative quantities.
- Invalid prices.
- Invalid currency.
- Invalid dates.
- Invalid enum values.
- Unexpected object properties.
- Invalid identifiers.

Validation must occur server-side.

---

## 11. Injection Testing

Security tests should verify resistance to:

- SQL injection.
- Command injection.
- Template injection where applicable.
- HTML injection.
- XSS.
- Unsafe dynamic query construction.

Database access should use parameterized queries or the project's safe database abstraction.

User input must never be concatenated directly into executable queries or commands.

---

## 12. XSS Testing

Test user-controlled fields that may later be rendered.

Potentially sensitive fields include:

- Product names.
- Product descriptions.
- Customer names.
- Store names.
- Addresses.
- Discount descriptions.
- Order notes where supported.

Verify that malicious HTML or scripts are treated as data rather than executable content.

---

## 13. CSRF Testing

Where browser authentication uses cookies, verify that state-changing requests cannot be triggered cross-site without appropriate protections.

Test:

- Checkout mutations.
- Cart mutations.
- Product changes.
- Inventory changes.
- Store settings.
- Order changes.
- Membership changes.

The exact protection mechanism should follow the authentication architecture.

---

## 14. Session Security

Security tests should verify:

- Secure cookie configuration.
- Appropriate `HttpOnly` usage.
- Appropriate `SameSite` configuration.
- Session expiration.
- Session invalidation.
- No sensitive information stored unnecessarily in browser-accessible storage.

Session implementation details should remain consistent with the authentication architecture.

---

## 15. Password Security

If the platform manages passwords directly, test that:

- Passwords are never stored in plaintext.
- Password hashes use an appropriate password-hashing algorithm.
- Password values never appear in logs.
- Authentication responses do not reveal whether unnecessary account details exist.
- Password reset tokens are protected.
- Reset tokens expire and cannot be reused.

---

## 16. Brute-Force Protection

Authentication and other sensitive operations should have appropriate protection against abuse.

Test behavior under repeated:

- Login failures.
- Password reset requests.
- Verification attempts.
- Payment attempts where applicable.

The exact rate-limiting implementation may evolve as infrastructure evolves.

---

## 17. Enumeration Testing

Security tests should identify unnecessary account or resource enumeration.

Examples:

- Login responses.
- Password reset.
- Customer lookup.
- Order lookup.
- Store lookup.

Responses should not reveal sensitive existence information unless intentionally required by the product behavior.

---

## 18. Payment Security Testing

Payment-related security tests should verify:

- Client cannot set the authoritative payment amount.
- Client cannot change payment currency.
- Client cannot mark payment as successful.
- Payment state comes from trusted application/provider flows.
- Duplicate payment attempts are handled safely.
- Refund amounts cannot exceed refundable amounts.
- Unauthorized users cannot access payment information.

Raw card credentials must never be stored by the application.

---

## 19. Checkout Security Testing

Test attempts to manipulate:

- Product price.
- Quantity.
- Discount amount.
- Currency.
- Inventory availability.
- Customer identity.
- Store identity.
- Payment state.

The server must recalculate and validate authoritative values.

---

## 20. Inventory Security Testing

Unauthorized users must not be able to:

- Increase inventory.
- Decrease inventory.
- Create reservations.
- Release another customer's reservation.
- Modify inventory history.
- Access another store's inventory.

Concurrency tests should also verify that security checks cannot be bypassed during simultaneous operations.

---

## 21. Order Security Testing

Verify that users can access only orders they are authorized to access.

Test:

```text id="k9m4x7"
Customer A → Order A = allowed
Customer A → Order B = rejected

Store A staff → Store A order = allowed
Store A staff → Store B order = rejected
```

Historical order information must not leak through API responses, URLs, logs, or error messages.

---

## 22. Webhook Security Testing

Webhook endpoints must be treated as untrusted external input.

Test:

- Missing signature.
- Invalid signature.
- Modified payload.
- Wrong provider.
- Replay of an old event.
- Duplicate event.
- Unknown event.
- Invalid event structure.
- Invalid tenant mapping.

Only verified webhook events may trigger protected state changes.

---

## 23. Webhook Replay Testing

Send the same valid webhook event repeatedly.

Expected behavior:

```text id="w3q8m5"
First event
→ processed

Repeated event
→ no duplicate side effect
```

The event-processing mechanism must provide replay protection and idempotency.

---

## 24. File and Media Security

If object storage is used, test:

- Unauthorized upload.
- Unauthorized download.
- Cross-tenant object access.
- Invalid file type.
- Excessive file size.
- Malicious filenames.
- Unsafe object keys.
- Public/private access rules.

Object storage keys must not allow one tenant to access another tenant's objects.

---

## 25. Path Traversal Testing

Any user-controlled file path, filename, or object key must be tested against traversal patterns.

Examples include attempts to reference:

```text
../
../../
absolute paths
unexpected object prefixes
```

User-controlled paths must never determine arbitrary filesystem locations.

---

## 26. Secrets Testing

Security tests and repository checks should verify that secrets are not committed.

Check for accidental exposure of:

- API keys.
- Database credentials.
- Payment credentials.
- Session secrets.
- OAuth credentials.
- Webhook secrets.

`.env.example` may contain placeholders but must never contain real credentials.

---

## 27. Logging Security

Security tests should verify that sensitive information does not appear in:

- Application logs.
- Error responses.
- Audit records.
- Test output.
- CI logs.

Sensitive examples include:

- Passwords.
- Tokens.
- API keys.
- Payment credentials.
- Session secrets.
- Full payment details.

---

## 28. Error Disclosure Testing

Trigger known failures and verify that responses do not expose:

- Stack traces.
- SQL statements.
- Internal file paths.
- Environment variables.
- Provider credentials.
- Internal service details.

The API should return the documented error contract.

---

## 29. Database Security Testing

Verify:

- Application roles have only required permissions.
- Production credentials are not reused in test environments.
- Database connections require appropriate authentication.
- Tenant-scoped queries are enforced by application logic.
- Sensitive columns are not unnecessarily exposed.

Database constraints should provide a final integrity boundary.

---

## 30. Background Job Security

Background jobs must preserve security context.

Test that:

- Jobs contain sufficient tenant context.
- A job cannot accidentally operate on another tenant.
- Job payloads do not contain unnecessary secrets.
- Unauthorized job creation is prevented.
- Failed jobs do not expose sensitive data.

---

## 31. Dependency Security

Dependency security checks should identify:

- Known vulnerabilities.
- Abandoned critical dependencies.
- Suspicious packages.
- Unexpected transitive dependencies.

Dependency updates must still be reviewed for compatibility and security impact.

Automated scanners are useful signals, not substitutes for engineering review.

---

## 32. Security Headers

The application should verify appropriate security headers for the deployed environment.

Depending on architecture, this may include:

- Content Security Policy.
- Strict Transport Security.
- X-Content-Type-Options.
- Referrer-Policy.
- Frame protection.
- Appropriate permissions policy.

The exact header configuration should be tested against the actual deployment architecture.

---

## 33. HTTPS Testing

Production traffic must use HTTPS.

Tests should verify:

- HTTP redirects or is otherwise appropriately handled.
- Secure cookies are used.
- Mixed content is avoided.
- Sensitive information is not transmitted over insecure channels.

---

## 34. Rate Limiting

Sensitive endpoints should have appropriate abuse protection.

Potential targets include:

- Authentication.
- Password reset.
- Public checkout operations.
- Payment operations.
- Webhooks.
- Expensive API queries.

Tests should verify that rate limiting fails safely and does not accidentally allow bypass through tenant or user identifiers.

---

## 35. Security Regression Tests

Every discovered security vulnerability should result in a regression test when practical.

The test should reproduce:

```text id="p6m2x8"
vulnerability
→ expected secure behavior
```

The regression test should remain permanently in the relevant test suite.

---

## 36. Automated Security Checks

CI should include appropriate automated checks such as:

```text id="q8n4m7"
Type checking
Linting
Dependency vulnerability scanning
Secret detection
Unit tests
Integration tests
Security tests
E2E tests
```

The exact CI pipeline should be defined in the deployment and CI/CD documentation.

---

## 37. Manual Security Testing

Automated tests do not replace manual security review.

Manual testing should periodically examine:

- Authorization boundaries.
- Tenant isolation.
- Authentication flows.
- Payment flows.
- Webhooks.
- File access.
- Administrative functionality.
- Unexpected API behavior.

Manual testing should be performed against non-production environments unless explicitly authorized otherwise.

---

## 38. Security Test Data

Security tests must use synthetic data.

Never use:

- Real customer passwords.
- Real payment credentials.
- Real personal information.
- Production session tokens.
- Production API keys.

Test secrets must be isolated from production secrets.

---

## 39. AI-Generated Security Tests

AI-generated security tests require human review.

AI must not be allowed to:

- Disable security controls to make tests pass.
- Replace authorization with mocks.
- Hardcode secrets.
- Use production credentials.
- Remove tenant checks.
- Weaken validation.
- Modify security tests to hide failures.

A security test that makes the system less secure is not a successful test.

---

## 40. Security Test Reporting

Security test failures should include:

- Test name.
- Affected capability.
- Security boundary involved.
- Reproduction conditions.
- Expected behavior.
- Actual behavior.
- Severity.
- Relevant request or correlation ID where safe.

Sensitive values must be redacted.

---

## 41. Severity

Security findings should be prioritized based on impact.

### Critical

Examples:

- Cross-tenant data access.
- Authentication bypass.
- Payment manipulation.
- Arbitrary code execution.
- Exposure of production secrets.

### High

Examples:

- Privilege escalation.
- Unauthorized order access.
- Webhook authentication bypass.
- Significant customer data exposure.

### Medium

Examples:

- Limited information disclosure.
- Missing protection on lower-risk endpoints.
- Moderate abuse vectors.

### Low

Examples:

- Minor security hardening issues.
- Non-sensitive information leakage with limited impact.

Severity should consider exploitability and business impact.

---

## 42. Definition of Done

Security testing is complete for a feature when:

```text
[ ] Authentication behavior is tested
[ ] Authorization behavior is tested
[ ] Tenant isolation is tested
[ ] Input validation is tested
[ ] Critical business rules are protected
[ ] Sensitive operations are tested for abuse
[ ] Webhooks are verified
[ ] Idempotency is tested where required
[ ] Sensitive data is not exposed
[ ] Secrets are not present in source or logs
[ ] Security regression tests exist for discovered issues
[ ] Automated security checks pass
[ ] Relevant manual security review is complete
[ ] No production credentials or data were used
[ ] Security-relevant verification was actually executed
``` 