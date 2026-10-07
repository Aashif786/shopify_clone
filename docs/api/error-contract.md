# API Error Contract

## 1. Purpose

This document defines the standard error contract for the Shopify-like commerce platform API.

The goal is to provide predictable, machine-readable errors for API consumers while preventing internal implementation details, sensitive information, and tenant data from leaking through error responses.

---

## 2. Core Principles

API errors must be:

- Consistent.
- Machine-readable.
- Safe.
- Actionable where appropriate.
- Stable across compatible API versions.
- Independent of internal database or framework errors.

Clients should rely primarily on stable error codes rather than parsing human-readable messages.

---

## 3. Standard Error Shape

API errors should follow a common structure:

```json id="m2v7q9"
{
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Product not found",
    "requestId": "req_01HXYZ..."
  }
}
```

Additional structured fields may be included where useful.

The contract should remain stable within an API major version.

---

## 4. Error Fields

### `code`

A stable machine-readable identifier.

Example:

```text id="q8n3m5"
PRODUCT_NOT_FOUND
```

Clients may use this value to implement programmatic behavior.

### `message`

A human-readable explanation suitable for the API consumer.

Messages should not expose sensitive internal information.

### `requestId`

A correlation identifier used to locate the corresponding server-side logs.

It should not contain secrets or sensitive business data.

---

## 5. Optional Error Details

Some errors may include structured details.

Example:

```json id="f4k8r2"
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "requestId": "req_01HXYZ...",
    "details": {
      "fields": {
        "price": "Must be greater than zero"
      }
    }
  }
}
```

Details must remain safe for client exposure.

---

## 6. Error Categories

The API should distinguish common error categories:

```text id="v6m2x8"
VALIDATION_ERROR
AUTHENTICATION_REQUIRED
FORBIDDEN
NOT_FOUND
CONFLICT
BUSINESS_RULE_VIOLATION
RATE_LIMITED
EXTERNAL_SERVICE_ERROR
INTERNAL_ERROR
```

Specific stable error codes should identify the actual failure where useful.

---

## 7. HTTP Status Codes

Use HTTP status codes consistently.

| Status | Category | Example |
|---|---|---|
| `400` | Invalid request | Malformed request |
| `401` | Authentication | Missing/invalid authentication |
| `403` | Authorization | Insufficient permission |
| `404` | Not found | Resource unavailable |
| `409` | Conflict | Duplicate SKU |
| `422` | Semantic validation | Invalid business input |
| `429` | Rate limit | Too many requests |
| `500` | Internal failure | Unexpected application error |
| `502` | Dependency failure | Invalid upstream response |
| `503` | Service unavailable | Temporary dependency outage |

The exact status should reflect the semantics of the failure.

---

## 8. Validation Errors

Invalid client input should produce a validation error.

Example:

```json id="z8x3p5"
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "requestId": "req_01HXYZ...",
    "details": {
      "fields": {
        "name": "Required",
        "price": "Must be greater than zero"
      }
    }
  }
}
```

Validation errors should identify fields where doing so is safe and useful.

---

## 9. Authentication Errors

When authentication is missing or invalid:

```text id="a7m4k2"
401 Unauthorized
```

Example:

```json id="p3r8x1"
{
  "error": {
    "code": "AUTHENTICATION_REQUIRED",
    "message": "Authentication is required.",
    "requestId": "req_01HXYZ..."
  }
}
```

Do not expose authentication implementation details.

---

## 10. Authorization Errors

When an authenticated user lacks permission:

```text id="w5q9n3"
403 Forbidden
```

Example:

```json id="m8v2c6"
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action.",
    "requestId": "req_01HXYZ..."
  }
}
```

---

## 11. Tenant-Safe Not Found

For tenant-isolated resources, the API may return `404 Not Found` instead of revealing that a resource exists in another tenant.

Example:

```text id="x4k7p2"
User from Store A requests an Order belonging to Store B
        ↓
404 NOT_FOUND
```

The response must not reveal:

```text id="n6m3q8"
Store B exists
Order belongs to Store B
Store B's internal identifiers
```

This prevents information leakage across tenants.

---

## 12. Resource Not Found

A missing resource should use a stable error code.

Example:

```json id="r7q2m4"
{
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Product not found.",
    "requestId": "req_01HXYZ..."
  }
}
```

Do not expose database query details.

---

## 13. Conflict Errors

Use `409 Conflict` when the request conflicts with existing state.

Examples:

```text id="g5m8x2"
duplicate product slug
duplicate SKU
duplicate discount code
duplicate membership
invalid concurrent state change
idempotency conflict
```

Example:

```json id="j3v9k1"
{
  "error": {
    "code": "SKU_ALREADY_EXISTS",
    "message": "The SKU is already in use.",
    "requestId": "req_01HXYZ..."
  }
}
```

---

## 14. Business Rule Errors

A syntactically valid request may still violate a domain rule.

Examples:

```text id="p8m4q6"
INSUFFICIENT_INVENTORY
INVALID_ORDER_TRANSITION
DISCOUNT_NOT_APPLICABLE
CHECKOUT_EXPIRED
PAYMENT_NOT_CAPTURED
REFUND_EXCEEDS_PAYMENT
```

These should use stable business-oriented error codes.

---

## 15. State Transition Errors

Invalid state transitions should be explicit.

Example:

```json id="u6r2m8"
{
  "error": {
    "code": "INVALID_ORDER_TRANSITION",
    "message": "The order cannot be moved to the requested state.",
    "requestId": "req_01HXYZ..."
  }
}
```

Do not silently ignore an invalid transition.

---

## 16. Inventory Errors

Inventory failures should use meaningful codes.

Examples:

```text id="c4x7m2"
INSUFFICIENT_INVENTORY
INVENTORY_ITEM_NOT_FOUND
RESERVATION_EXPIRED
RESERVATION_ALREADY_RELEASED
INVALID_RESERVATION_STATE
```

The response should not expose internal locking or database details.

---

## 17. Checkout Errors

Examples:

```text id="v9n3q5"
CHECKOUT_NOT_FOUND
CHECKOUT_EXPIRED
CHECKOUT_ALREADY_COMPLETED
CHECKOUT_INVALID_STATE
CART_EMPTY
PRICING_CHANGED
INVENTORY_UNAVAILABLE
DISCOUNT_INVALID
```

Checkout errors should allow clients to determine whether the user can retry, update the cart, or restart checkout.

---

## 18. Payment Errors

Payment errors must be especially careful not to expose provider secrets or sensitive payment information.

Examples:

```text id="k8q4m1"
PAYMENT_FAILED
PAYMENT_NOT_FOUND
PAYMENT_ALREADY_CAPTURED
PAYMENT_ALREADY_REFUNDED
PAYMENT_AMOUNT_MISMATCH
PAYMENT_CURRENCY_MISMATCH
PAYMENT_PROVIDER_UNAVAILABLE
PAYMENT_WEBHOOK_INVALID
```

Provider-specific internal error messages should not be exposed directly.

---

## 19. Order Errors

Examples:

```text id="s7m2x5"
ORDER_NOT_FOUND
ORDER_ALREADY_CANCELLED
ORDER_CANNOT_BE_CANCELLED
ORDER_INVALID_STATE
ORDER_CREATION_FAILED
```

Order errors must preserve the distinction between order state and payment state.

---

## 20. Rate Limit Errors

Rate-limited requests should return:

```text id="n5r8q2"
429 Too Many Requests
```

Example:

```json id="x3m7k4"
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please try again later.",
    "requestId": "req_01HXYZ..."
  }
}
```

Where appropriate, the response may include retry information through standard HTTP headers.

---

## 21. External Service Errors

External provider failures should be translated into safe internal API errors.

Do not expose raw provider responses.

Example:

```json id="q9k4m6"
{
  "error": {
    "code": "PAYMENT_PROVIDER_UNAVAILABLE",
    "message": "The payment service is temporarily unavailable.",
    "requestId": "req_01HXYZ..."
  }
}
```

Internal logs may retain appropriate provider context subject to security and privacy rules.

---

## 22. Internal Errors

Unexpected failures should return a generic internal error.

Example:

```json id="h2v7n5"
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred.",
    "requestId": "req_01HXYZ..."
  }
}
```

Do not return:

- Stack traces.
- SQL statements.
- File paths.
- Environment variables.
- Credentials.
- Internal service topology.

---

## 23. Error Codes

Error codes should be:

- Uppercase.
- Stable.
- Descriptive.
- Machine-readable.
- Domain-oriented where appropriate.

Examples:

```text id="b8q3m7"
PRODUCT_NOT_FOUND
SKU_ALREADY_EXISTS
INSUFFICIENT_INVENTORY
CHECKOUT_EXPIRED
PAYMENT_FAILED
ORDER_NOT_FOUND
FORBIDDEN
```

Avoid vague codes such as:

```text id="y6r2p8"
ERROR
FAILED
BAD_REQUEST
```

when a more precise code is available.

---

## 24. Error Code Stability

Once an error code is publicly exposed, its meaning should remain stable within the API major version.

Do not reuse an existing code for a substantially different condition.

If semantics change significantly, introduce a new code or API version where appropriate.

---

## 25. Error Messages

Messages should:

- Be understandable.
- Avoid unnecessary implementation details.
- Avoid secrets.
- Avoid sensitive tenant information.
- Be safe to display to end users where appropriate.

Clients should not use messages as stable machine-readable identifiers.

---

## 26. Request IDs

Every API request should have a request/correlation identifier.

The identifier should:

- Be unique enough for operational tracing.
- Be returned to the client.
- Be included in relevant logs.
- Not contain sensitive information.

Example:

```text id="r3m8x1"
req_01HXYZ...
```

---

## 27. Logging Errors

Server-side logging should record enough information to diagnose failures.

Depending on the error:

```text id="k7v2m4"
requestId
userId where safe
organization/store context
operation
error code
internal error details
stack trace for unexpected failures
```

Sensitive information must be excluded.

---

## 28. Expected vs Unexpected Errors

### Expected errors

Examples:

- Validation failure.
- Unauthorized request.
- Resource not found.
- Inventory unavailable.
- Invalid state transition.

These should be translated into known API responses.

### Unexpected errors

Examples:

- Programming errors.
- Unexpected database failures.
- Unhandled exceptions.

These should produce a safe generic API response while preserving diagnostic information in server-side monitoring.

---

## 29. Error Mapping

Internal errors should be mapped at the API boundary.

Conceptually:

```text id="t4x8m2"
Domain Error
    ↓
Application Error
    ↓
API Error Mapping
    ↓
HTTP Response
```

Internal error types should not become accidental public API contracts.

---

## 30. Database Error Mapping

Known database constraint failures may be translated into business errors.

Examples:

```text id="m8q3v6"
unique constraint
→ SKU_ALREADY_EXISTS

foreign key constraint
→ appropriate domain/resource error
```

Raw database error messages must not be returned to clients.

---

## 31. Idempotency Errors

Idempotent endpoints must distinguish:

### Same request, already completed

Return the original result where appropriate.

### Same idempotency key, different request

Return a conflict.

Example:

```text id="x5r7n2"
IDEMPOTENCY_KEY_REUSED
```

Do not execute a different operation under an existing idempotency key.

---

## 32. Webhook Errors

Webhook endpoints should return responses appropriate to provider retry behavior.

Invalid signatures should fail safely.

Processing failures must be distinguishable internally so that retryable failures can be retried without creating duplicate effects.

Do not expose internal processing details to external providers unnecessarily.

---

## 33. Background Job Errors

Job failures do not always become API errors.

Jobs should:

- Record failure state.
- Log safely.
- Retry where appropriate.
- Stop retrying non-retryable failures.
- Preserve tenant context.
- Remain observable.

If a synchronous API operation queues a job, the API response should clearly communicate whether work is accepted or completed.

---

## 34. Frontend Handling

Frontend clients should generally use:

```text id="q6m8v3"
HTTP status
+
error.code
+
safe details
```

rather than parsing `message`.

For example:

```text id="r4x2k7"
INSUFFICIENT_INVENTORY
→ Display stock availability message

CHECKOUT_EXPIRED
→ Restart checkout

AUTHENTICATION_REQUIRED
→ Redirect to authentication

FORBIDDEN
→ Display permission error
```

---

## 35. Security Requirements

Error responses must not become an information-disclosure channel.

Review errors for:

- Cross-tenant leakage.
- User enumeration.
- Resource enumeration.
- Database details.
- Provider details.
- Secret exposure.
- Internal architecture disclosure.

Fail closed when uncertain.

---

## 36. Testing

Error contract tests should verify:

### Structure

- Error object exists.
- Code exists.
- Message exists where required.
- Request ID exists.

### Semantics

- Correct HTTP status.
- Correct error code.
- Correct business behavior.

### Security

- No sensitive information.
- No cross-tenant leakage.
- No internal stack traces.
- No provider secrets.

### Compatibility

- Existing error codes retain their meaning.
- Response shape remains compatible within the API version.

---

## 37. Demo-to-V1 Evolution

The Demo should establish a stable error contract without introducing an overly complex error framework.

V1 may later add:

- More comprehensive error catalogs.
- Advanced localization.
- API-specific error metadata.
- Error analytics.
- Standardized tracing headers.
- More detailed partner-facing diagnostics.

These should be introduced only when justified.

---

## 38. Error Contract Checklist

Before releasing an API endpoint:

```text id="w2k8m5"
[ ] Success response is defined
[ ] Validation errors are defined
[ ] Authentication errors are defined
[ ] Authorization errors are defined
[ ] Not-found behavior is defined
[ ] Conflict behavior is defined
[ ] Business rule errors are defined
[ ] External provider failures are translated
[ ] Internal failures are sanitized
[ ] Error codes are stable and meaningful
[ ] Request ID is available
[ ] Tenant information is protected
[ ] Sensitive data is not exposed
[ ] Tests cover important failure paths
[ ] API documentation is updated
```