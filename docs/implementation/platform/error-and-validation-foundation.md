# Error and Validation Foundation Implementation

## 1. Purpose

This document defines the foundation for validation and error handling across the Demo.

The objective is to ensure that invalid input, expected business failures, authorization failures, infrastructure failures, and unexpected programming errors are handled consistently without exposing internal implementation details.

---

# 2. Core Principles

The implementation must:

- Validate untrusted input at system boundaries.
- Keep validation separate from authorization.
- Represent expected failures explicitly.
- Preserve stable machine-readable error codes.
- Avoid leaking sensitive information.
- Distinguish retryable and non-retryable failures.
- Log unexpected failures with sufficient context.
- Return consistent API error responses.
- Prevent one module from inventing incompatible error behavior.

---

# 3. Error Categories

Errors should be classified conceptually as:

```text id="h7m3c9"
Validation Error
Authentication Error
Authorization Error
Not Found
Conflict
Business Rule Error
Infrastructure Error
External Service Error
Concurrency Error
Idempotency Error
Unexpected Error
```

The exact implementation should remain simple and consistent.

---

# 4. Validation Boundary

Validation occurs at system boundaries.

Typical flow:

```text id="m8c4x7"
Untrusted Input
    ↓
Parse
    ↓
Validate
    ↓
Authenticated Context
    ↓
Authorized Operation
    ↓
Application Service
```

Malformed input must not reach business logic.

---

# 5. Validation Responsibilities

Validation should check structural properties such as:

- Required fields.
- Types.
- Formats.
- Length.
- Numeric ranges.
- Allowed enum values.
- Nested object structure.
- Array limits.

Business invariants belong to the domain/application layer.

---

# 6. Validation vs Business Rules

Example:

```text id="q5n8m3"
Validation:
quantity must be an integer greater than zero

Business rule:
requested quantity cannot exceed available stock
```

The first is input validation.

The second requires domain state and therefore belongs to the Inventory domain.

---

# 7. Validation Package

Reusable validation infrastructure belongs in:

```text id="x6m3c8"
packages/validation
```

It may provide:

- Schema helpers.
- Common validation primitives.
- Shared validation conventions.

Domain-specific validation schemas should remain with the owning module where appropriate.

---

# 8. Request Validation

API handlers should validate:

- Route parameters.
- Query parameters.
- Request bodies.
- Relevant headers.

Validation errors should be converted into the standard API error contract.

---

# 9. Internal Validation

Internal application services should not blindly trust arbitrary callers.

Even when an API boundary validates input, application-level invariants must still be enforced where the operation can be called through:

- Worker jobs.
- Internal application services.
- Webhooks.
- Future integrations.

---

# 10. Error Object Structure

The application should use a consistent internal error representation.

Conceptually:

```text id="v4m8c7"
ApplicationError
├── code
├── message
├── category
├── status
├── retryable
└── metadata
```

Not every field must be exposed publicly.

---

# 11. Stable Error Codes

Error codes are intended for programmatic handling.

Examples:

```text id="n6c3x9"
VALIDATION_ERROR
AUTHENTICATION_REQUIRED
FORBIDDEN
NOT_FOUND
CONFLICT
INSUFFICIENT_INVENTORY
PAYMENT_FAILED
IDEMPOTENCY_CONFLICT
RATE_LIMITED
INTERNAL_ERROR
```

Codes should not change merely because the internal implementation changes.

---

# 12. Public Error Messages

Public error messages should be:

- Clear.
- Safe.
- Useful to the client.
- Free of internal details.

Avoid exposing:

```text id="p8m4x2"
SQL statements
Stack traces
File paths
Provider credentials
Internal service topology
Database error messages
```

---

# 13. Request ID

Every API error should be associated with the request ID where appropriate.

Example:

```json id="w3m7c8"
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "requestId": "req_123"
  }
}
```

The request ID allows operators to locate the corresponding server-side logs.

---

# 14. Validation Error Response

A validation response may include structured field information.

Conceptually:

```json id="x5c9m4"
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "fields": {
      "email": "Invalid email format"
    },
    "requestId": "req_123"
  }
}
```

Only safe validation information should be returned.

---

# 15. Authentication Errors

Authentication failures should be handled separately from validation.

Examples:

```text id="m7c4x8"
Missing session
Expired session
Invalid session
Invalid credentials
```

Sensitive authentication information must not be returned.

---

# 16. Authorization Errors

Authorization failures should indicate that the requested operation is not permitted.

The response must not expose unnecessary information about protected resources.

---

# 17. Tenant-Safe Errors

For Store-owned resources, cross-tenant access should generally appear as a safe not-found response when revealing the resource's existence would leak information.

Example:

```text id="q8m3v5"
Store A requests Product belonging to Store B
        ↓
Safe NOT_FOUND
```

---

# 18. Business Rule Errors

Business rule failures should use meaningful domain-level error codes.

Examples:

```text id="c7m4n8"
INSUFFICIENT_INVENTORY
PRODUCT_NOT_PURCHASABLE
DISCOUNT_EXPIRED
CART_EMPTY
CHECKOUT_EXPIRED
INVALID_ORDER_TRANSITION
```

These errors represent valid application behavior, not programming failures.

---

# 19. Conflict Errors

Conflicts occur when the requested operation cannot safely proceed because current state conflicts with the request.

Examples:

- Duplicate Store slug.
- Duplicate SKU where uniqueness is required.
- Concurrent update conflict.
- Idempotency-key reuse with different request data.
- Invalid state transition.

These should map to a consistent conflict response.

---

# 20. Concurrency Errors

Concurrency-sensitive operations must handle race conditions explicitly.

Examples:

```text id="n4c8m6"
Inventory update
Checkout completion
Discount usage
Payment state transition
Order state transition
```

A concurrency failure may be:

- Retried internally.
- Returned as a conflict.
- Re-evaluated against current state.

The correct behavior belongs to the owning domain.

---

# 21. Idempotency Errors

The system must distinguish between:

### Safe replay

Same operation and same request.

```text id="v5m8x3"
Return previously stored result
```

### Conflicting reuse

Same idempotency key with different operation/input.

```text id="j7c4n9"
Reject request
```

This behavior follows the idempotency strategy.

---

# 22. External Service Errors

External providers may fail through:

- Timeout.
- Network failure.
- Rejected request.
- Provider outage.
- Invalid provider response.
- Temporary rate limit.

The provider adapter should translate provider-specific failures into application-level errors.

---

# 23. Provider Error Isolation

Business modules must not depend on provider-specific exception classes.

Prefer:

```text id="r6m3c8"
Provider Adapter
    ↓
Application-Level Error
```

rather than:

```text id="x8n4m2"
Order Domain
    ↓
StripeException / ProviderException
```

The domain should remain provider-independent.

---

# 24. Retryable Errors

Errors should be classified where retry behavior matters.

Examples potentially retryable:

- Temporary database connectivity failure.
- Temporary provider timeout.
- Worker infrastructure failure.
- Temporary rate limit.

Examples generally non-retryable:

- Invalid input.
- Authorization failure.
- Invalid payment data.
- Business rule violation.

The owning integration should determine the precise classification.

---

# 25. Worker Error Handling

Worker handlers should distinguish:

```text id="k4m8x7"
Success
Retryable Failure
Permanent Failure
```

Retryable failures should follow the job retry policy.

Permanent failures should be recorded and should not retry indefinitely.

---

# 26. Webhook Errors

Webhook processing requires special treatment.

A webhook may:

- Be duplicated.
- Arrive out of order.
- Arrive before related local state.
- Contain invalid signatures.
- Represent a temporary provider issue.

The webhook implementation must classify failures appropriately.

---

# 27. Database Errors

Database-specific errors should be translated at infrastructure/application boundaries.

For example:

```text id="c8m3x9"
Unique constraint
    ↓
Conflict

Connection failure
    ↓
Infrastructure failure

Foreign-key violation
    ↓
Integrity failure
```

Raw database errors should not escape to API consumers.

---

# 28. Unexpected Errors

Unexpected errors indicate a condition the application did not deliberately model.

Examples:

- Programming bug.
- Impossible state.
- Unexpected dependency failure.
- Unhandled exception.

These should:

1. Be logged.
2. Include correlation context.
3. Be reported to observability tooling where configured.
4. Return a safe generic API response.

---

# 29. Fail Closed

Security-sensitive failures must fail closed.

Examples:

```text id="p7m4c8"
Cannot determine authorization
    ↓
Deny access

Cannot validate session
    ↓
Treat as unauthenticated

Cannot verify webhook signature
    ↓
Reject webhook
```

Never grant access because a security dependency failed.

---

# 30. Error Logging

Errors should be logged with appropriate structured context.

Useful metadata may include:

- Request ID.
- User ID where safe.
- Store ID.
- Operation.
- Error code.
- Retryability.
- Job ID.
- Event ID.

Do not log secrets or sensitive payloads unnecessarily.

---

# 31. Stack Traces

Stack traces are useful for internal debugging.

They should remain server-side.

They must not be returned to normal API clients.

---

# 32. Error Wrapping

When a lower-level error is translated into an application error, preserve the original error internally where useful.

Example:

```text id="w8m4c3"
Provider timeout
    ↓
PaymentProviderUnavailable
    ↓
API / Worker behavior
```

The original error can remain attached for logging/diagnostics without becoming part of the public response.

---

# 33. Error Mapping

The API layer should have a centralized mechanism for mapping application errors to HTTP responses.

Conceptually:

```text id="x6n3m7"
ApplicationError
      ↓
HTTP Error Mapper
      ↓
Status + Error DTO
```

Individual route handlers should not invent their own error formatting.

---

# 34. Error Mapping Examples

```text id="v4m8c9"
VALIDATION_ERROR
    → 400 / 422 according to contract

AUTHENTICATION_REQUIRED
    → 401

FORBIDDEN
    → 403

NOT_FOUND
    → 404

CONFLICT
    → 409

RATE_LIMITED
    → 429

Unexpected Error
    → 500
```

The final status mapping must remain consistent with the API error contract.

---

# 35. Error Handling in Transactions

If an application operation fails inside a transaction:

```text id="n7c4m8"
BEGIN
   ↓
Operations
   ↓
Error
   ↓
ROLLBACK
```

The application must not return success if the transaction failed.

---

# 36. Partial Failure

Multi-step operations must explicitly define what happens when one step fails.

Examples:

- Checkout.
- Payment.
- Order creation.
- Inventory reservation.
- Refund.

The domain/application service should define the state transition rather than relying on generic exception handling.

---

# 37. External Call Failure

External calls should not leave database state ambiguous.

The implementation should use:

- Explicit intermediate states.
- Idempotency.
- Webhooks.
- Reconciliation.
- Retry mechanisms.

depending on the operation.

---

# 38. Validation and Security

Validation must not be treated as a complete security mechanism.

For example:

```text id="m5x8c4"
Valid Store ID
≠
Authorized Store access
```

Input validation establishes structural correctness.

Authorization establishes permission.

---

# 39. Error Handling in Background Jobs

A job handler should never silently swallow an error.

Each failure should result in one of:

```text id="q7n3m8"
Retry
Permanent failure
Successful recovery
```

The job state must reflect the outcome.

---

# 40. Error Handling in Events

Event consumers should be idempotent.

If processing fails:

- Retry where appropriate.
- Record failure.
- Avoid duplicating side effects.
- Preserve event identity.

---

# 41. Error Handling in Notifications

Notification failures should not normally roll back the core business transaction.

For example:

```text id="x8m4c7"
Order Created
    ↓
Committed

Email Delivery
    ↓
Fails
    ↓
Retry Notification Job
```

The order should not disappear because an email provider had a bad afternoon.

---

# 42. Error Handling in Media

Media operations may fail independently of core business operations.

Examples:

- Upload failure.
- Object storage unavailable.
- Invalid file.
- Processing failure.

The media domain must define whether the operation is:

- Retryable.
- Reversible.
- Eventually consistent.

---

# 43. Error Handling and Auditability

Important state changes should remain auditable even when secondary operations fail.

For example:

```text id="v3m9c5"
Payment State Changed
    ↓
Notification Failed
```

The payment state must remain authoritative.

---

# 44. Error Testing

Tests must cover:

### Validation

- Missing fields.
- Invalid types.
- Invalid formats.
- Boundary values.

### Security

- Unauthenticated access.
- Unauthorized access.
- Cross-tenant access.
- Invalid webhook signatures.

### Business rules

- Invalid state transitions.
- Insufficient inventory.
- Invalid discounts.
- Expired checkout.

### Reliability

- Database failures.
- Provider failures.
- Timeouts.
- Duplicate requests.
- Retry behavior.

---

# 45. Error Response Consistency

All API modules should use the same response shape.

Do not allow:

```text id="j6m4x8"
Products → { error: "..." }

Orders → { message: "..." }

Payments → { failure: "..." }
```

unless the API contract explicitly requires a different external provider/webhook structure.

---

# 46. Error Documentation

Publicly relevant errors should be documented in API specifications.

Each documented error should include:

- Code.
- Meaning.
- HTTP status.
- When it occurs.
- Expected client behavior.

---

# 47. Validation and Error Definition of Done

```text id="c9m3x7"
[ ] Validation package exists
[ ] Boundary validation is implemented
[ ] Validation is separate from authorization
[ ] Application errors have stable codes
[ ] Error categories are defined
[ ] HTTP error mapping is centralized
[ ] Validation responses are consistent
[ ] Authentication errors are consistent
[ ] Authorization errors are consistent
[ ] Tenant-safe not-found behavior exists
[ ] Conflict behavior exists
[ ] Idempotency errors are defined
[ ] Retryable errors are classified
[ ] Worker failures are classified
[ ] Webhook failures are classified
[ ] Provider errors are translated
[ ] Database errors are translated
[ ] Unexpected errors are safely handled
[ ] Security failures fail closed
[ ] Secrets are excluded from logs
[ ] Error responses include request IDs where appropriate
[ ] Error tests exist
```

---

# 48. Final Principle

The error architecture should make failures predictable:

```text id="m8c4x7"
Invalid Input
    ↓
Validation Error

Invalid Identity
    ↓
Authentication Error

Invalid Permission
    ↓
Authorization Error

Invalid Business State
    ↓
Domain Error

Temporary Dependency Failure
    ↓
Retryable Infrastructure Error

Unexpected Failure
    ↓
Logged Internal Error
```

The goal is not to eliminate failures. That would require eliminating software, which unfortunately remains socially unpopular. The goal is to make every important failure understandable, safe, observable, and recoverable.