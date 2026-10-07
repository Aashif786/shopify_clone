# Validation and Error Handling Implementation

## 1. Purpose

This document defines the concrete implementation of request validation, application errors, error translation, and failure handling for the Demo.

The objective is to ensure that invalid input, authorization failures, business conflicts, infrastructure failures, and unexpected errors are handled consistently without leaking internal implementation details.

The implementation must provide:

- Boundary validation.
- Typed application errors.
- Stable API error codes.
- Consistent HTTP mapping.
- Safe client-facing messages.
- Retry classification.
- Tenant-safe failures.
- Transaction-safe failure handling.
- Worker and webhook error handling.
- Structured diagnostic logging.

---

# 2. Ownership

Shared validation infrastructure belongs to:

```text
packages/validation
```

Shared error types and error utilities may live in an appropriate platform/shared package according to the established package structure.

Domain-specific business errors remain owned by their domain modules.

The API layer translates application errors into HTTP responses.

The worker translates application errors into job outcomes.

---

# 3. Error Flow

The standard flow is:

```text
Input
 ↓
Boundary Validation
 ↓
Application Service
 ↓
Domain Validation
 ↓
Repository / Integration
 ↓
Error
 ↓
Error Classification
 ↓
Contextual Logging
 ↓
Transport-Specific Mapping
```

The same underlying application error should not need to know whether it originated from HTTP, a worker, or another internal caller.

---

# 4. Validation Layers

Validation occurs at multiple boundaries.

### Boundary validation

Validates external input:

- HTTP request bodies.
- Query parameters.
- Path parameters.
- Headers.
- Job payloads.
- Webhook payloads.
- Provider responses.

### Application validation

Validates use-case requirements.

### Domain validation

Enforces business invariants.

### Database constraints

Provide final integrity protection.

---

# 5. Validation Responsibility

Use the earliest appropriate layer.

Example:

```text id="v6c8m4"
"quantity": "abc"
        ↓
API validation
```

But:

```text id="m8c4x7"
quantity > available inventory
        ↓
Inventory application/domain logic
```

Do not move business rules into generic request schemas simply because the validation library makes it convenient.

---

# 6. Validation Package

`packages/validation` should provide reusable infrastructure such as:

- Schema definitions where genuinely shared.
- Parsing helpers.
- Validation result handling.
- Common primitive validators.
- Safe validation error conversion.

It should not become a dumping ground for every domain's business rules.

---

# 7. Input Validation

Validate all externally controlled values.

Examples:

```text id="q7m4c8"
Email
Password
UUID / identifiers
Slug
SKU
Money
Quantity
Currency
Dates
Pagination
Sort fields
Filters
Idempotency keys
File metadata
```

Validation must happen before unsafe values reach repositories or external providers.

---

# 8. Strict Parsing

Prefer strict parsing.

For example:

```text id="x8m3c7"
"10"
```

should not silently become an integer unless the API contract explicitly defines string-to-number coercion.

Consistent parsing prevents subtle differences between endpoints.

---

# 9. Unknown Fields

Request schemas should explicitly define whether unknown fields are:

- Rejected.
- Stripped.
- Preserved.

For security-sensitive operations, rejecting unexpected fields is generally preferable.

This prevents clients from believing unsupported fields were applied.

---

# 10. Validation Error Structure

Validation failures should produce stable application errors.

Example:

```json id="m5c8x7"
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "fields": {
      "email": ["Invalid email address."]
    },
    "requestId": "..."
  }
}
```

The exact public schema should remain consistent across endpoints.

---

# 11. Application Error Model

The application should use a typed error model.

Conceptually:

```text id="q8m4c7"
ApplicationError
├── code
├── message
├── category
├── retryable
├── status
└── metadata
```

Only safe fields should be exposed externally.

---

# 12. Error Categories

The implementation should distinguish categories such as:

```text id="v7m3c8"
Validation
Authentication
Authorization
Tenant
NotFound
Conflict
BusinessRule
Concurrency
Idempotency
ExternalDependency
Database
RateLimit
Internal
```

Categories support consistent handling without forcing every domain to invent its own error framework.

---

# 13. Stable Error Codes

API consumers should depend on stable error codes rather than message text.

Examples:

```text id="x5m8c4"
INVALID_INPUT
AUTHENTICATION_REQUIRED
AUTHENTICATION_FAILED
FORBIDDEN
RESOURCE_NOT_FOUND
RESOURCE_CONFLICT
INSUFFICIENT_INVENTORY
INVALID_CHECKOUT_STATE
PAYMENT_FAILED
IDEMPOTENCY_CONFLICT
RATE_LIMITED
INTERNAL_ERROR
```

Domain-specific codes should remain meaningful and consistent.

---

# 14. Error Messages

Client-facing messages must be:

- Clear.
- Short.
- Safe.
- Actionable where appropriate.

Do not expose:

```text id="m7c4x8"
SQL errors
Stack traces
File paths
Provider credentials
Internal service URLs
Database schema
Raw provider responses
```

---

# 15. Authentication Errors

Authentication failures should not reveal unnecessary account information.

For example, avoid distinguishing publicly between:

```text id="q8m3c7"
Unknown email
Incorrect password
```

when that would enable account enumeration.

---

# 16. Authorization Errors

Authorization failures should be handled separately from authentication.

Typical cases:

```text id="v4m8c7"
Unauthenticated
        → 401

Authenticated but insufficient permission
        → 403
```

Tenant-safe resource access may instead return a not-found style response where appropriate.

---

# 17. Tenant-Safe Not Found

If a resource does not belong to the current tenant, return the same externally visible behavior used for an unavailable resource.

Do not expose:

```text id="x7m4c8"
Resource exists but belongs to another Store.
```

This is both an error-handling rule and a security rule.

---

# 18. Business Rule Errors

Business rules should produce explicit errors.

Examples:

```text id="m8c4x7"
Cannot publish inactive product
Cannot checkout empty cart
Cannot reserve insufficient inventory
Cannot refund invalid payment
Cannot cancel completed order
```

The error should identify the business condition without exposing internal implementation details.

---

# 19. Conflict Errors

Use conflict errors when the requested operation conflicts with current state.

Examples:

```text id="q5m8c4"
Duplicate SKU
Duplicate discount code
Concurrent state transition
Already processed operation
Existing idempotency key with different request
```

These should map consistently to conflict semantics.

---

# 20. Concurrency Errors

Concurrency failures should be explicitly classified.

Examples:

```text id="v8m3c7"
Inventory changed concurrently
Order state changed concurrently
Resource version conflict
Database serialization failure
```

Retryable concurrency errors may be retried according to the application operation.

The client should not blindly retry every error.

---

# 21. Idempotency Errors

Idempotency handling must distinguish:

### Same key, same request

Return the previously established result according to the operation contract.

### Same key, different request

Reject with an idempotency conflict.

### Request currently executing

Return the defined in-progress/conflict behavior.

### Stored result expired

Follow the documented retention policy.

---

# 22. Database Error Translation

Raw database errors must not escape the application boundary.

For example:

```text id="x4m8c7"
Unique constraint violation
        ↓
Repository / infrastructure classification
        ↓
Application-level conflict
```

The application should translate known constraint failures into meaningful errors.

Unknown database failures become internal errors and are logged securely.

---

# 23. Deadlock Handling

Database deadlocks should be handled according to the transaction strategy.

Where safe:

```text id="m7c4x8"
Detect deadlock
 ↓
Rollback
 ↓
Retry bounded number of times
```

Do not automatically retry non-idempotent operations without verifying that the transaction was completely rolled back and the operation semantics permit retrying.

---

# 24. Transaction Failure

When a transaction fails:

```text id="q8m3c7"
Transaction
   ↓
Failure
   ↓
Rollback
   ↓
No partial transaction state
```

The application must not return success merely because part of the operation completed.

External side effects require separate handling.

---

# 25. External Dependency Errors

External provider failures should be classified into:

```text id="v5m8c4"
Timeout
Rate Limited
Temporary Unavailable
Permanent Rejection
Invalid Request
Authentication Failure
Unknown Failure
```

Retryability depends on the category.

---

# 26. External Error Translation

Do not expose provider-specific implementation details directly.

For example, an internal payment provider response should become an application-level error such as:

```text id="x7m4c8"
PAYMENT_PROVIDER_UNAVAILABLE
```

rather than exposing the provider's raw response.

Provider-specific details remain available in secure logs where appropriate.

---

# 27. Timeout Handling

Every external dependency should have bounded timeouts.

A timeout should not leave:

- Open database transactions.
- Hanging HTTP requests.
- Unbounded worker execution.

Timeouts should be classified separately from successful or permanent failures.

---

# 28. Rate-Limit Errors

When an external dependency rate-limits the application:

- Classify the failure.
- Respect provider retry guidance where available.
- Apply bounded retries.
- Use backoff.
- Avoid retry storms.
- Record useful operational metrics.

---

# 29. API Error Mapping

The API layer maps application errors into HTTP responses.

Conceptually:

```text id="m4c8x7"
ApplicationError
       ↓
HTTP Error Mapper
       ↓
Status Code
Error Code
Safe Message
Request ID
```

No route should invent its own error format.

---

# 30. Unexpected Errors

Unexpected errors should become a generic internal error.

Example:

```json id="q7m4c8"
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred.",
    "requestId": "..."
  }
}
```

The detailed exception belongs in internal logs/error monitoring.

---

# 31. Error Logging

Unexpected and operationally significant errors should include structured diagnostic information.

Useful fields:

```text id="v8m3c7"
requestId
userId
organizationId
storeId
operation
errorCode
errorCategory
retryable
duration
```

Sensitive values must be excluded.

---

# 32. Error Monitoring

Unexpected errors should be sent to the configured error-monitoring system where appropriate.

Monitoring should capture:

- Error type.
- Stack trace.
- Release/version.
- Request correlation.
- Relevant operation.
- Environment.

Do not send secrets or unnecessary customer data.

---

# 33. Worker Error Handling

Worker handlers must classify errors into:

```text id="x5m8c4"
Success
Retryable Failure
Permanent Failure
```

Retryable failures should follow job retry policy.

Permanent failures should not be retried indefinitely.

---

# 34. Job Error Examples

Retryable:

```text id="m7c4x8"
Temporary provider timeout
Database deadlock
Temporary network failure
Provider rate limit
```

Usually permanent:

```text id="q8m3c7"
Invalid payload
Unsupported job version
Invalid business state
Invalid provider credentials
```

Classification must be operation-specific where necessary.

---

# 35. Webhook Error Handling

Webhook processing should distinguish:

```text id="v4m8c7"
Invalid signature
Malformed payload
Duplicate event
Temporary processing failure
Permanent processing failure
```

A duplicate valid event should be safely ignored or return the established processing result.

Temporary failures should remain retryable according to webhook strategy.

---

# 36. Validation of Webhook Payloads

Webhook payloads must be validated after authenticity verification.

Do not trust the provider payload simply because it has a recognized event type.

Validate:

- Required fields.
- Types.
- Provider identifiers.
- Event timestamps where applicable.
- Event version.
- Expected resource structure.

---

# 37. File and Media Errors

Media operations should classify failures such as:

```text id="x8m4c7"
Invalid file type
File too large
Invalid metadata
Unauthorized Store
Storage unavailable
Object missing
Upload expired
```

These should produce stable application errors where they cross an API boundary.

---

# 38. Payment Errors

Payment errors require particularly careful classification.

Examples:

```text id="m5c8x7"
Payment declined
Payment provider unavailable
Invalid payment request
Duplicate payment request
Webhook processing failure
Refund rejected
```

A declined payment is not necessarily an infrastructure failure and should not automatically trigger retries.

---

# 39. Inventory Errors

Inventory operations should distinguish:

```text id="q7m4c8"
INSUFFICIENT_INVENTORY
INVENTORY_RESERVATION_CONFLICT
INVALID_INVENTORY_STATE
INVENTORY_NOT_FOUND
```

Inventory correctness takes precedence over optimistic success responses.

---

# 40. Checkout Errors

Checkout failures may include:

```text id="v8m3c7"
CART_EMPTY
CART_EXPIRED
PRODUCT_UNAVAILABLE
PRICE_CHANGED
DISCOUNT_INVALID
INVENTORY_UNAVAILABLE
CHECKOUT_ALREADY_COMPLETED
PAYMENT_REQUIRED
CHECKOUT_CONFLICT
```

The checkout application service should determine the correct failure state.

---

# 41. Order Errors

Order operations may fail because:

```text id="x5m8c4"
Order not found
Invalid state transition
Unauthorized Store access
Refund unavailable
Cancellation unavailable
Concurrent update
```

Historical Order information must not be silently mutated to hide the failure.

---

# 42. Validation in Background Jobs

Job payloads must be validated before execution.

A malformed job should not repeatedly fail until retry exhaustion.

Instead:

```text id="m7c4x8"
Invalid Payload
 ↓
Permanent Failure
 ↓
Record Diagnostic State
```

---

# 43. Validation in Events

Events crossing module boundaries should have validated contracts.

Consumers should not assume an event payload is valid merely because another module produced it.

Event schema/version handling should be explicit.

---

# 44. Fail-Closed Security

Security-related uncertainty must fail closed.

Examples:

```text id="q8m4c7"
Cannot resolve membership
Cannot verify session
Cannot verify webhook signature
Cannot establish Store ownership
Cannot validate authorization context
```

Do not continue execution with guessed or incomplete security context.

---

# 45. Error Response Security

Never return:

```text id="v4m8c7"
Stack traces
SQL queries
Database connection strings
Secret values
Session tokens
Provider credentials
Filesystem paths
Internal service topology
```

in production API responses.

---

# 46. Error Handling in Development

Development environments may provide richer diagnostics to developers, but the application should still preserve the same architectural error boundaries.

Do not create development-only business behavior that cannot exist in production.

---

# 47. Validation Testing

Validation tests should cover:

```text id="x7m3c8"
[ ] Missing required fields
[ ] Invalid field types
[ ] Invalid formats
[ ] Invalid ranges
[ ] Unknown fields
[ ] Oversized requests
[ ] Invalid pagination
[ ] Invalid sorting
[ ] Invalid identifiers
```

---

# 48. Error Handling Testing

Test:

```text id="m8c4x7"
[ ] Stable error codes
[ ] Correct HTTP mappings
[ ] Safe error messages
[ ] Tenant-safe not-found
[ ] Authorization failures
[ ] Conflict handling
[ ] Idempotency conflicts
[ ] Database constraint translation
[ ] Retry classification
[ ] External provider failures
[ ] Unexpected errors
```

---

# 49. Security Testing

Verify that error responses cannot be used to infer:

- Other tenants.
- Existing accounts.
- Internal database structure.
- Provider credentials.
- Private resources.
- Hidden Store information.

Error handling is part of the security boundary, not merely presentation polish.

---

# 50. Implementation Sequence

Implement in this order:

```text id="q5m8c4"
1. Define shared validation conventions
2. Define ApplicationError model
3. Define stable error categories
4. Define stable error codes
5. Implement validation helpers
6. Implement API error mapper
7. Implement authentication/authorization error handling
8. Implement tenant-safe not-found handling
9. Implement database error translation
10. Implement external dependency classification
11. Implement retry classification
12. Implement worker error handling
13. Implement webhook error handling
14. Integrate structured logging
15. Integrate error monitoring
16. Add validation tests
17. Add API error tests
18. Add security tests
```

---

# 51. Definition of Done

Validation and error handling are complete when:

```text id="v7m3c8"
[ ] External input is validated
[ ] Domain rules remain outside boundary schemas
[ ] Application errors are typed
[ ] Error codes are stable
[ ] API error responses are consistent
[ ] Tenant-safe errors are enforced
[ ] Authentication failures are safe
[ ] Authorization failures are distinct
[ ] Database errors are translated
[ ] External errors are classified
[ ] Retryability is explicit
[ ] Worker errors are classified
[ ] Webhook failures are handled safely
[ ] Unexpected errors are monitored
[ ] Sensitive data is excluded from responses/logs
[ ] Security failures fail closed
[ ] Validation tests pass
[ ] Error-handling tests pass
[ ] Security tests pass
```

The final principle is simple: **validate at boundaries, enforce business rules in the owning domain, translate failures at infrastructure boundaries, and never let an internal error become a security disclosure.**