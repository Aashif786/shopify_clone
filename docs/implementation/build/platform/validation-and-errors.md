# Validation and Error Implementation

## 1. Purpose

This document defines the implementation of input validation and application error handling across the Demo.

The objective is to ensure that invalid input, business-rule violations, authorization failures, infrastructure failures, and unexpected defects are handled consistently.

The implementation must provide:

- Boundary validation.
- Explicit business validation.
- Typed application errors.
- Stable API error codes.
- Safe error responses.
- Clear error classification.
- Consistent logging.
- Retry-aware error semantics.
- Tenant-safe failure behavior.

---

# 2. Responsibility Separation

Validation and errors must preserve the following separation:

```text
External Input
      ↓
Boundary Validation
      ↓
Application Service
      ↓
Business Validation
      ↓
Domain Operation
      ↓
Infrastructure
```

Each layer has a different responsibility.

---

# 3. Boundary Validation

Boundary validation verifies that external input has the correct shape.

Examples:

```text
string
number
integer
boolean
enum
email format
ID format
date format
request structure
```

Boundary validation must happen before invalid data reaches domain logic.

---

# 4. Business Validation

Business validation determines whether an otherwise structurally valid operation is allowed.

Examples:

```text
Inventory is available
Discount is active
Cart belongs to Store
Order can transition to requested state
Payment can be refunded
User has required permission
```

Business validation belongs to application/domain layers.

---

# 5. Do Not Duplicate Business Rules in UI

Client-side validation may improve user experience.

It must never become the authoritative business validation mechanism.

For example:

```text
Client:
quantity > 0

Server:
quantity > 0
AND inventory is available
```

The server remains authoritative.

---

# 6. Validation Package

Shared boundary validation is provided by:

```text id="q7m4x8"
packages/validation
```

The package should provide reusable schema definitions and validation utilities.

It must not contain domain-specific business logic.

---

# 7. Schema Definitions

External input should be represented using explicit schemas.

Examples:

```text id="v5r8m3"
CreateProductInput
UpdateProductInput
CreateCartItemInput
CompleteCheckoutInput
CreateDiscountInput
```

Schemas should reject unexpected or invalid fields where appropriate.

---

# 8. Unknown Fields

Requests containing unsupported fields should be handled deliberately.

For security-sensitive endpoints, rejecting unexpected fields is preferred where practical.

This prevents clients from accidentally or intentionally attempting to set server-owned properties.

---

# 9. Server-Owned Fields

External clients must not control fields such as:

```text id="m4q7n5"
createdAt
updatedAt
storeId derived from context
userId derived from session
internal status
payment state
authorization role
```

unless explicitly required by the API contract.

---

# 10. Validation Error Structure

Validation failures should map to a stable API error.

Conceptually:

```text id="x8r5m6"
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": {
      "field": "reason"
    }
  }
}
```

The exact schema is defined by the API contract.

---

# 11. Field-Level Errors

Where useful, validation errors should identify fields.

Example:

```text id="q6m4r8"
quantity
→ Must be a positive integer

email
→ Invalid email format
```

Do not expose internal schema implementation details.

---

# 12. Nested Validation

Nested request objects must be validated recursively.

For example:

```text id="v7r3m5"
Checkout
 ├── customer
 ├── address
 ├── items
 │    ├── variantId
 │    └── quantity
 └── discountCode
```

Every externally supplied field must be validated.

---

# 13. IDs

IDs must be validated according to the repository's identifier strategy.

Do not pass arbitrary strings into repository queries and assume the database will reject them safely.

---

# 14. Quantities

Quantities should be validated for:

```text id="m8q5r4"
integer representation
positive/allowed range
maximum reasonable value
```

Business logic separately verifies whether the requested quantity is actually available.

---

# 15. Monetary Values

Money inputs must be validated using exact representations.

Never parse user-supplied monetary values through floating-point arithmetic and assume the result is exact.

The API contract must define how money is represented.

---

# 16. Dates and Times

Date/time input must be parsed explicitly.

The implementation should reject ambiguous or malformed values.

Persisted timestamps should use the repository's standard timezone policy.

---

# 17. Enum Validation

State values and other enumerations must be validated against approved values.

Do not accept arbitrary strings such as:

```text id="x4m7p8"
status="whatever"
```

and rely on downstream code to interpret them.

---

# 18. Validation Before Authorization

The exact ordering may vary by endpoint because authorization can sometimes occur before detailed validation to avoid information disclosure.

The implementation must ensure that:

```text id="q8r4m5"
untrusted input
```

never reaches unsafe business operations.

Security-sensitive resource existence checks should also avoid leaking information.

---

# 19. Error Taxonomy

Application errors should be classified into meaningful categories.

Recommended categories:

```text id="m5q7v3"
Validation
Authentication
Authorization
Not Found
Conflict
Business Rule
Infrastructure
External Provider
Concurrency
Idempotency
Unexpected
```

---

# 20. Validation Errors

Used when input fails structural requirements.

Examples:

```text id="v6r8m4"
Invalid email
Invalid quantity
Missing required field
Malformed ID
Unsupported enum value
```

---

# 21. Authentication Errors

Used when authentication is missing or invalid.

Examples:

```text id="q7m4p8"
UNAUTHENTICATED
SESSION_EXPIRED
ACCOUNT_DISABLED
```

Public API codes should remain stable.

---

# 22. Authorization Errors

Used when an authenticated user lacks permission.

Examples:

```text id="x5r8m3"
FORBIDDEN
INSUFFICIENT_PERMISSION
STORE_ACCESS_DENIED
```

Do not expose internal authorization rules unnecessarily.

---

# 23. Not Found Errors

Used when the requested resource cannot be safely returned.

Examples:

```text id="m8q4r7"
PRODUCT_NOT_FOUND
ORDER_NOT_FOUND
STORE_NOT_FOUND
```

For cross-tenant requests, a not-found response may intentionally conceal resource existence.

---

# 24. Conflict Errors

Use conflicts when the request cannot succeed because of current state or uniqueness.

Examples:

```text id="v4n7m5"
Duplicate SKU
Duplicate Store slug
Invalid state transition
Idempotency conflict
```

---

# 25. Business Rule Errors

Business rules may produce domain-specific errors.

Examples:

```text id="q6r8m4"
INVENTORY_UNAVAILABLE
DISCOUNT_NOT_ELIGIBLE
CHECKOUT_EXPIRED
ORDER_TRANSITION_INVALID
REFUND_NOT_ALLOWED
```

These errors should be explicit rather than represented as generic failures.

---

# 26. Concurrency Errors

Concurrency conflicts should be distinguishable when clients can reasonably retry.

Examples:

```text id="x7m3p8"
RESOURCE_MODIFIED
CONCURRENT_UPDATE
RESERVATION_CONFLICT
```

The application may retry internally where safe.

---

# 27. Idempotency Errors

Idempotency failures should have explicit semantics.

Examples:

```text id="m5q8r4"
IDEMPOTENCY_CONFLICT
IDEMPOTENCY_KEY_REUSED
IDEMPOTENCY_REQUEST_MISMATCH
```

A repeated identical request should generally return the previously established result according to the operation's idempotency contract.

---

# 28. Infrastructure Errors

Infrastructure failures include:

```text id="v8r4m6"
Database unavailable
Storage unavailable
Internal queue failure
Configuration failure
```

These should not expose internal connection details to API consumers.

---

# 29. External Provider Errors

Provider failures should be normalized.

For example:

```text id="q4m7p8"
Payment provider timeout
Email provider unavailable
Storage provider unavailable
```

The application should distinguish retryable from permanent failures where possible.

---

# 30. Unexpected Errors

Unexpected errors indicate defects or unanticipated conditions.

They must:

```text id="x6r5m3"
Be logged
Carry correlation information
Return a safe response
Avoid leaking implementation details
```

They should not be silently converted into successful results.

---

# 31. Error Class Design

Application errors should carry enough information for mapping.

Conceptually:

```text id="m7q4r8"
ApplicationError
├── code
├── category
├── message
├── retryable
├── details
└── cause where appropriate
```

The exact implementation may differ.

---

# 32. Error Codes vs Messages

Clients should rely on:

```text id="v5m8r3"
stable error code
```

rather than parsing human-readable messages.

Messages may change for clarity without breaking clients.

---

# 33. Error Details

Error details should contain only information safe for the caller.

For example:

```text id="q8r4m6"
{
  "field": "email"
}
```

is appropriate.

Internal SQL queries, stack traces, database connection strings, or provider secrets are not.

---

# 34. Error Cause Preservation

Internal errors should preserve their underlying cause for logging/diagnostics where useful.

Do not expose the raw cause to API clients automatically.

Conceptually:

```text id="x7m5p4"
Public Error
   ↓
Internal Cause
   ↓
Structured Log
```

---

# 35. Error Mapping

The API should centralize error mapping.

Conceptually:

```text id="m4q8r7"
ApplicationError
      ↓
Error Mapper
      ↓
HTTP status
API code
safe message
details
```

This avoids every route inventing its own error format.

---

# 36. HTTP Status Mapping

A consistent baseline is:

| Category | Typical Status |
|---|---:|
| Validation | 400 / 422 |
| Authentication | 401 |
| Authorization | 403 |
| Not Found | 404 |
| Conflict | 409 |
| Rate Limit | 429 |
| Infrastructure | 500 / 503 |
| Unexpected | 500 |

The final status must follow the actual API contract and operation semantics.

---

# 37. Retryability

Errors should indicate whether retrying may be safe.

Examples:

```text id="v6m3r8"
Database timeout
→ retryable

Invalid quantity
→ not retryable

Payment provider timeout
→ potentially retryable

Invalid payment method
→ not retryable
```

Retryability must never be guessed solely from HTTP status.

---

# 38. Worker Error Semantics

Worker handlers should use the same underlying error classification.

The worker then determines:

```text id="q5r8m4"
retry
or
terminal failure
```

This prevents different systems from interpreting the same failure inconsistently.

---

# 39. Transaction Error Handling

When a transaction fails:

```text id="x8m4r7"
Rollback
  ↓
Classify error
  ↓
Retry if safe
  ↓
Return/log appropriate result
```

Do not continue using a transaction context after the transaction has failed.

---

# 40. Constraint Errors

Database constraint violations should be translated into meaningful application errors where the cause is known.

For example:

```text id="m7q5n3"
UNIQUE violation
→ DUPLICATE_SKU
```

Do not expose raw PostgreSQL error text to API consumers.

---

# 41. Foreign Key Errors

Unexpected foreign-key violations usually indicate an application bug or race.

They should be logged with context and mapped safely.

Do not blindly convert every foreign-key error into `404`.

---

# 42. Validation and Database Constraints

Application validation and database constraints serve different roles.

```text id="v4r8m6"
Application validation
→ user-friendly early feedback

Database constraint
→ final integrity protection
```

Both should exist where appropriate.

---

# 43. Error Logging

Logs should contain:

```text id="q6m4r8"
requestId
jobId where applicable
errorCode
operation
route/job type
storeId where safe
userId where safe
duration
```

Avoid sensitive payloads.

---

# 44. Sensitive Data

Never include these in normal logs:

```text id="x5r7m3"
Passwords
Session tokens
Reset tokens
Payment credentials
Webhook secrets
Access tokens
Private storage credentials
Full sensitive request bodies
```

---

# 45. Error Monitoring

Unexpected errors should be sent to the approved observability system where configured.

Expected business errors should not flood error monitoring.

The implementation should distinguish:

```text id="m8q4v6"
expected operational/business failure
```

from:

```text id="v7r5n3"
unexpected software defect
```

---

# 46. User-Facing Error Messages

Messages should be:

- Clear.
- Concise.
- Actionable where possible.
- Non-sensitive.

Example:

```text id="q4m8r7"
"This product is no longer available."
```

is better than exposing:

```text id="x6r3p5"
SQLSTATE 23503: ...
```

---

# 47. Error Handling in UI

The web application should map API/application errors into appropriate UI states.

Examples:

```text id="m5q7r8"
Validation
→ Field error

Authorization
→ Access denied

Not Found
→ Not-found page/state

Conflict
→ Explain conflict and allow correction

Unexpected
→ Safe generic error + retry where appropriate
```

---

# 48. Error Handling in Checkout

Checkout requires special handling.

The implementation must distinguish:

```text id="v8r4m6"
Cart invalid
Inventory unavailable
Discount invalid
Checkout expired
Payment failed
Payment pending
Order creation conflict
```

A payment failure must not automatically imply that the order was never created unless the workflow explicitly guarantees that relationship.

---

# 49. Error Handling in Payments

Payment errors must distinguish:

```text id="q7m3r5"
Declined
Provider timeout
Provider unavailable
Duplicate request
Invalid provider state
Webhook pending
```

The application must not assume a timeout means payment definitely failed.

---

# 50. Error Handling in Inventory

Inventory failures must preserve correctness.

Examples:

```text id="x5r8m4"
Insufficient inventory
Reservation expired
Concurrent reservation conflict
Invalid release
```

Do not return success if the inventory mutation did not commit.

---

# 51. Error Handling in Webhooks

Webhook processing errors should distinguish:

```text id="m6q4r8"
Invalid signature
Replay
Duplicate event
Malformed payload
Temporary processing failure
Permanent processing failure
```

Only appropriate failures should trigger retries.

---

# 52. Error Handling in Jobs

Job handlers should never:

```text id="v7n5r3"
catch everything
log it
return success
```

This would convert real failures into silent data loss.

Every failure must be classified and surfaced to the worker runtime.

---

# 53. Validation Testing

Validation tests should cover:

```text id="q8m4r6"
Missing fields
Wrong types
Boundary values
Invalid IDs
Invalid enums
Malformed dates
Invalid money
Oversized values
Unexpected fields
Nested invalid structures
```

---

# 54. Error Testing

Error tests should verify:

```text id="x4r7m8"
Correct application error
Correct HTTP status
Correct stable code
Safe message
No sensitive information
Correct retryability
Correct logging behavior
```

---

# 55. Tenant-Safe Error Testing

Test that an unauthorized resource does not reveal:

```text id="m5q8r4"
Other Store's existence
Other tenant IDs
Internal database details
Private customer information
```

---

# 56. AI-Assisted Validation and Error Rules

AI-generated validation/error code must:

1. Inspect existing error contracts.
2. Reuse established schemas.
3. Avoid duplicate error systems.
4. Distinguish validation from business rules.
5. Preserve stable error codes.
6. Avoid leaking sensitive data.
7. Preserve retry semantics.
8. Test failure paths.
9. Verify API responses.
10. Review the final diff.

---

# 57. Implementation Order

Implement validation and errors in this order:

```text id="v6r4m8"
1. Shared validation utilities
2. Base application error model
3. Error categories/codes
4. API error contract
5. Central error mapper
6. Boundary validation integration
7. Database error mapping
8. Concurrency/idempotency errors
9. Worker error integration
10. Logging/observability integration
11. Validation tests
12. Error/security tests
```

---

# 58. Definition of Done

Validation and error implementation is complete when:

```text id="q7m5r3"
[ ] External inputs are validated
[ ] Business validation remains in domain/application layers
[ ] Server-owned fields are protected
[ ] Validation errors have stable codes
[ ] Authentication errors are consistent
[ ] Authorization errors are safe
[ ] Not-found behavior is tenant-safe
[ ] Conflicts are represented explicitly
[ ] Retryability is defined
[ ] Database errors are normalized
[ ] Provider errors are normalized
[ ] Worker errors use shared semantics
[ ] Unexpected errors are monitored
[ ] Sensitive data is excluded from logs
[ ] API error responses are consistent
[ ] Critical failure paths are tested
[ ] TypeScript passes
[ ] Lint passes
```

---

# 59. Final Principle

Validation prevents malformed input from entering the system.

Error handling prevents failures from becoming ambiguous, insecure, or silently successful.

Together they create a predictable boundary:

```text id="x8m4r6"
Invalid input
    → clear rejection

Invalid business operation
    → explicit business error

Temporary failure
    → safe retry where appropriate

Unexpected defect
    → visible diagnostic failure

Security violation
    → fail closed
```

The platform should never confuse "the request failed" with "nothing happened." In commerce systems, that distinction is where many very expensive bugs begin.