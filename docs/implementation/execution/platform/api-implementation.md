# API Implementation

## 1. Purpose

This document defines the concrete implementation of the HTTP API layer for the Demo.

The API layer exposes business capabilities through stable, validated, tenant-aware HTTP endpoints while keeping business logic inside application and domain layers.

The API must remain:

- Thin.
- Explicit.
- Versioned.
- Secure.
- Tenant-aware.
- Idempotency-aware where required.
- Consistent in errors and responses.
- Independent from database implementation details.

---

# 2. API Architecture

The request flow is:

```text
Client
  ↓
HTTP Route
  ↓
Request ID / Request Context
  ↓
Authentication
  ↓
Tenant Resolution
  ↓
Authorization
  ↓
Input Validation
  ↓
Application Service
  ↓
Domain Logic
  ↓
Repository / Integration
  ↓
DTO Mapping
  ↓
HTTP Response
```

Route handlers should coordinate this flow rather than implement business rules.

---

# 3. API Location

The Demo API is hosted by:

```text
apps/web
```

API routes should use the versioned namespace:

```text
/api/v1/*
```

The API implementation should follow the Next.js routing conventions selected during Web Bootstrap implementation.

---

# 4. API Responsibilities

The API layer owns:

- HTTP routing.
- HTTP method handling.
- Request parsing.
- Boundary validation.
- Authentication extraction.
- Tenant context resolution.
- Authorization invocation.
- Idempotency-key extraction.
- Application-service invocation.
- DTO mapping.
- Error translation.
- HTTP status selection.
- Request metadata.
- Response headers.

The API layer does **not** own:

- Business rules.
- Database transactions.
- Product pricing rules.
- Inventory calculations.
- Payment state transitions.
- Order lifecycle rules.

---

# 5. Business-Capability Routing

Routes should represent business capabilities.

Examples:

```text
/api/v1/stores
/api/v1/products
/api/v1/inventory
/api/v1/customers
/api/v1/carts
/api/v1/discounts
/api/v1/checkout
/api/v1/payments
/api/v1/orders
```

Avoid exposing raw database tables as API resources merely because they exist.

---

# 6. API Versioning

Demo uses:

```text
/api/v1
```

Versioning is applied at the API boundary.

A breaking contract change should require a new API version or an explicitly managed compatibility strategy.

Internal application-service interfaces do not need to mirror HTTP versioning.

---

# 7. HTTP Methods

Use HTTP methods according to operation semantics.

Typical mapping:

| Method | Purpose |
|---|---|
| `GET` | Read |
| `POST` | Create or execute an operation |
| `PATCH` | Partial update |
| `DELETE` | Delete/deactivate where supported |

Do not force every business operation into CRUD if an explicit action endpoint is clearer.

---

# 8. Resource and Action Endpoints

Normal resources may use:

```text
GET    /api/v1/products
POST   /api/v1/products
GET    /api/v1/products/:id
PATCH  /api/v1/products/:id
DELETE /api/v1/products/:id
```

Business operations may use explicit actions:

```text
POST /api/v1/checkout
POST /api/v1/orders/:id/cancel
POST /api/v1/orders/:id/refund
POST /api/v1/inventory/:id/adjust
```

The exact routes must follow the corresponding domain specifications.

---

# 9. Route Handler Structure

A route handler should follow a predictable sequence:

```text
Parse Request
    ↓
Create Request Context
    ↓
Authenticate
    ↓
Resolve Tenant
    ↓
Authorize
    ↓
Validate Input
    ↓
Extract Idempotency Key
    ↓
Call Application Service
    ↓
Map Result
    ↓
Return Response
```

Keep handlers short enough that the business behavior is obvious.

---

# 10. Request Context

Every request should establish a request ID.

The request context may contain:

```text
requestId
userId
sessionId
organizationId
membershipId
storeId
role
```

Only values available and relevant to the request should be included.

---

# 11. Request ID

If the client supplies a valid request correlation identifier according to the API policy, it may be accepted.

Otherwise the application should generate one.

The identifier should appear in:

- Structured logs.
- Error responses where appropriate.
- Relevant tracing/correlation data.

Do not allow arbitrary values to compromise logging systems.

---

# 12. Authentication

Protected API routes must resolve authentication before application execution.

Authentication should provide:

```text
userId
sessionId
```

The API must not trust:

```text
userId
```

or equivalent identity fields supplied by the request body.

---

# 13. Tenant Resolution

Merchant routes must establish the correct Store context.

The request may contain a Store identifier, but the API must verify:

```text
User
  ↓
Membership
  ↓
Store
```

before passing tenant context to the application service.

---

# 14. Authorization

Authorization must be checked server-side.

Typical flow:

```text
Authentication
      ↓
Tenant Context
      ↓
Permission Check
      ↓
Application Service
```

The frontend must never be the only authorization layer.

---

# 15. Public Storefront APIs

Public Storefront endpoints may not require merchant authentication.

They still require Store resolution.

For example:

```text
Storefront Domain / Slug
        ↓
Store Resolution
        ↓
Public Store Validation
        ↓
Published Resource Query
```

Only public Store data should be returned.

---

# 16. Input Validation

All untrusted input must be validated at the API boundary.

Validate:

- Path parameters.
- Query parameters.
- Request bodies.
- Headers used by the application.
- Pagination values.
- Filters.
- Sorting values.
- Idempotency keys.
- Upload metadata.

Use the shared validation package where appropriate.

---

# 17. Validation vs Business Rules

API validation should establish structural correctness.

Example:

```text
quantity must be an integer
```

belongs at the boundary.

A rule such as:

```text
quantity cannot exceed available inventory
```

belongs to the appropriate application/domain layer.

Do not duplicate business rules across route handlers.

---

# 18. Request Body Validation

Request bodies should be parsed and validated before reaching application services.

Reject:

- Invalid JSON.
- Unexpected structural shapes where the contract disallows them.
- Missing required fields.
- Invalid field types.
- Invalid formats.
- Oversized payloads.

---

# 19. Query Parameters

Query parameters should have explicit schemas.

Typical parameters include:

```text
page
limit
cursor
sort
status
search
```

Only supported filters and sort fields should be accepted.

Never construct unrestricted SQL fragments from client-provided values.

---

# 20. Pagination

Collection APIs should use the pagination strategy defined in the API architecture.

Cursor pagination is preferred for large or changing collections where appropriate.

Responses should expose enough metadata for clients to continue pagination.

Example:

```json id="g2f8n4"
{
  "data": [],
  "nextCursor": "..."
}
```

Exact response contracts belong to the API specification.

---

# 21. Sorting

Sorting must use an allowlist.

For example:

```text
createdAt
updatedAt
name
price
```

The API should map external sort names to known internal query expressions.

Never pass raw client-provided column names directly into SQL.

---

# 22. Filtering

Filtering should be explicit and domain-specific.

Example:

```text
GET /api/v1/orders?status=paid
```

The application must validate whether the requested filter is supported.

Unsupported filters should produce a stable client error.

---

# 23. DTOs

API responses should use explicit DTOs.

Do not return raw database records.

DTOs provide:

- Stable API contracts.
- Sensitive-field protection.
- Versioning control.
- Response consistency.

---

# 24. Request DTOs

Incoming request structures should also be explicit.

For example:

```text
CreateProductInput
UpdateProductInput
CreateDiscountInput
CreateCheckoutInput
```

Avoid passing generic request objects throughout the application.

---

# 25. Database Model Isolation

The API must never expose database-specific implementation details.

Do not return:

- Database error messages.
- Internal table names.
- SQL statements.
- Internal repository structures.
- Unnecessary database identifiers.

---

# 26. Response Structure

Responses should follow consistent conventions.

A successful response may contain:

```json id="n8f3q5"
{
  "data": {}
}
```

Collections may contain:

```json id="m7c2x8"
{
  "data": [],
  "nextCursor": null
}
```

The exact format should be standardized across the API rather than decided independently by each module.

---

# 27. HTTP Status Codes

Use HTTP status codes consistently.

Typical examples:

| Status | Meaning |
|---|---|
| `200` | Successful read/update/action |
| `201` | Resource created |
| `204` | Successful operation with no response body |
| `400` | Malformed/invalid request |
| `401` | Authentication required/failed |
| `403` | Authenticated but unauthorized |
| `404` | Resource unavailable/not found |
| `409` | Conflict |
| `422` | Valid request shape but unacceptable validation/business input, where used |
| `429` | Rate limit exceeded |
| `500` | Unexpected server error |
| `503` | Temporarily unavailable dependency/system |

The project should standardize when `400` versus `422` is used rather than allowing inconsistent module behavior.

---

# 28. Error Contract

Errors should use a stable structure.

Example:

```json id="q4m8c7"
{
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Product not found.",
    "requestId": "..."
  }
}
```

Client-facing messages must be safe.

Internal error details belong in logs, not responses.

---

# 29. Tenant-Safe Errors

If a resource exists in another tenant, the API should generally behave as though it is unavailable.

Do not reveal:

```text
This product belongs to another Store.
```

This prevents cross-tenant information leakage.

---

# 30. Idempotency

Mutation endpoints that can safely be retried must support the project's idempotency strategy where required.

Examples:

```text
Checkout completion
Payment creation
Order creation
Refund
Inventory adjustment
Webhook processing
```

The API should extract an idempotency key and pass it to the application layer.

The application layer owns the actual idempotency transaction.

---

# 31. Idempotency Header

Use a documented request header such as:

```text
Idempotency-Key
```

The key should be:

- Validated.
- Bounded in size.
- Associated with the authenticated tenant/user where appropriate.
- Stored according to the idempotency implementation.
- Reused only for the same logical operation/request contract.

---

# 32. Idempotency Conflicts

If the same idempotency key is reused with a different request fingerprint, reject it with a stable conflict/error response.

Do not silently execute a different operation.

---

# 33. Transactions

Route handlers must not manually coordinate complex database transactions.

Instead:

```text
Route
 ↓
Application Service
 ↓
Transaction
```

The application service owns the transaction boundary.

---

# 34. External Calls

Do not perform slow external calls inside unnecessarily long database transactions.

For example, payment workflows should coordinate:

```text
Application Service
 ↓
DB state
 ↓
Provider call
 ↓
DB reconciliation
```

according to the payment implementation specification.

---

# 35. File Uploads

File upload endpoints must enforce:

- Authentication where required.
- Tenant ownership.
- File size limits.
- Content-type validation.
- File-count limits.
- Safe object naming.
- Storage authorization.

Binary content should not be stored directly in PostgreSQL unless explicitly required.

---

# 36. Webhook API Boundary

Webhook endpoints are separate from normal authenticated APIs.

They must perform:

```text
Raw Request Capture
      ↓
Signature Verification
      ↓
Replay Protection
      ↓
Provider Event Validation
      ↓
Durable Persistence
      ↓
Async Processing
```

Do not require merchant session authentication for provider webhooks.

---

# 37. Content Types

The API should explicitly support expected content types.

Typical JSON endpoints should require:

```text
application/json
```

Upload endpoints may support multipart requests where required.

Unexpected content types should be rejected safely.

---

# 38. Request Size Limits

API requests must have bounded sizes.

Limits should exist for:

- JSON bodies.
- Query strings.
- Headers.
- File uploads.

Limits should be configured centrally.

---

# 39. Rate Limiting

Rate limiting should be applied according to endpoint risk.

Higher-risk endpoints include:

- Authentication.
- Password reset.
- Checkout.
- Payment.
- Webhooks.
- Public storefront operations exposed to abuse.

Demo may use simple infrastructure, but rate-sensitive endpoints must still have protection.

---

# 40. CSRF

Cookie-authenticated state-changing requests require CSRF protection.

The API implementation must use the strategy established in the authentication security design.

Webhook requests are protected through provider signature verification instead.

---

# 41. CORS

CORS must be explicit.

For credentialed requests:

- Allow only trusted origins.
- Do not use unrestricted wildcard origins.
- Configure allowed methods and headers deliberately.

---

# 42. API Logging

Every request should be observable through structured logging where appropriate.

Useful fields include:

```text
requestId
route
method
status
duration
userId
organizationId
storeId
errorCode
```

Do not log:

- Passwords.
- Session tokens.
- Payment secrets.
- Authorization headers.
- Full sensitive customer data.

---

# 43. API Metrics

Track useful operational metrics such as:

```text
Request count
Error count
Latency
Rate-limit responses
Authentication failures
Checkout failures
Payment failures
Webhook failures
```

Metrics should support identifying operational problems without collecting unnecessary personal data.

---

# 44. API Documentation

The API should have an OpenAPI contract.

The contract should document:

- Routes.
- Methods.
- Authentication requirements.
- Request schemas.
- Response schemas.
- Error responses.
- Pagination.
- Idempotency requirements.
- Webhook endpoints.

The API implementation and specification must remain synchronized.

---

# 45. Internal Application APIs

Application services are internal contracts.

They should not automatically become HTTP endpoints.

For example:

```text
checkoutService.completeCheckout()
```

does not imply that the service must be directly exposed to clients.

HTTP remains an adapter around application capabilities.

---

# 46. API Dependency Direction

The dependency direction should remain:

```text
apps/web API
      ↓
Application Services
      ↓
Domain
      ↓
Repositories / Infrastructure
```

The domain must not depend on HTTP concepts.

Avoid importing:

```text
Request
Response
NextRequest
NextResponse
```

into domain logic.

---

# 47. API Testing

Every API capability should include appropriate tests.

Test categories:

```text
Unit
Integration
API/route
Security
Authorization
Tenant isolation
Idempotency
Concurrency
E2E
```

Critical APIs require stronger coverage.

---

# 48. API Security Tests

At minimum verify:

```text
[ ] Unauthenticated requests are rejected
[ ] Unauthorized roles are rejected
[ ] Cross-tenant requests are rejected
[ ] Invalid input is rejected
[ ] Sensitive fields are not returned
[ ] CSRF protection works
[ ] CORS policy works
[ ] Rate limits work
[ ] Idempotency works
[ ] Request size limits work
[ ] Webhook signatures are verified
```

---

# 49. API Implementation Sequence

Implement in this order:

```text
1. Establish API routing structure
2. Establish request context
3. Integrate authentication
4. Integrate tenant resolution
5. Integrate authorization
6. Establish validation helpers
7. Establish DTO conventions
8. Establish error mapping
9. Establish pagination utilities
10. Establish idempotency extraction
11. Establish request limits
12. Establish CSRF/CORS policy
13. Establish rate limiting
14. Establish OpenAPI structure
15. Implement domain routes incrementally
16. Add API integration tests
17. Add security tests
18. Verify API contracts
```

---

# 50. Definition of Done

The API foundation is complete when:

```text
[ ] /api/v1 is established
[ ] Routes are business-capability oriented
[ ] Handlers remain thin
[ ] Authentication is integrated
[ ] Tenant resolution is integrated
[ ] Authorization is server-side
[ ] Input validation is centralized
[ ] DTOs isolate database models
[ ] Errors use stable contracts
[ ] Pagination is consistent
[ ] Idempotency is supported where required
[ ] Request limits exist
[ ] CSRF/CORS are configured
[ ] Rate limiting exists for sensitive endpoints
[ ] Webhooks have a separate security boundary
[ ] OpenAPI is maintained
[ ] Structured logging exists
[ ] API tests pass
[ ] Security tests pass
[ ] Cross-tenant access is prevented
```

The API should remain a **thin transport boundary**. When business logic starts accumulating inside route handlers, that is not a clever shortcut. It is the beginning of architectural entropy wearing a fake moustache.