# API Implementation

## 1. Purpose

This document defines how the Demo HTTP API is implemented within `apps/web`.

The API provides stable business-capability interfaces between clients and application services.

The implementation must prioritize:

- Explicit contracts.
- Strong validation.
- Authentication.
- Tenant isolation.
- Authorization.
- Idempotency.
- Consistent errors.
- Safe serialization.
- Predictable pagination.
- OpenAPI documentation.
- Thin route handlers.

The API must not become a direct database interface.

---

# 2. API Boundary

The API follows:

```text
Client
  ↓
HTTP Route
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
Domain Module
  ↓
Repository / Infrastructure
```

The route handler coordinates the boundary.

Business rules remain inside application/domain layers.

---

# 3. API Version

Business APIs use:

```text
/api/v1/*
```

The version represents the external contract version.

Do not introduce endpoint-specific version formats without an explicit architecture decision.

---

# 4. Business-Capability APIs

Endpoints should represent meaningful capabilities.

Prefer:

```text id="q8m4r6"
POST /api/v1/stores
POST /api/v1/products
POST /api/v1/checkouts
POST /api/v1/orders/:orderId/refunds
```

over exposing database tables as generic CRUD APIs.

---

# 5. Resource Naming

Use consistent plural resource names where appropriate:

```text id="x7m5p3"
stores
products
customers
carts
discounts
checkouts
orders
```

Actions that represent meaningful business operations may use explicit action endpoints.

Example:

```text id="v4n8q6"
POST /api/v1/checkouts/:checkoutId/complete
```

---

# 6. HTTP Methods

Use HTTP methods according to operation semantics.

Typical conventions:

```text id="m6q3r8"
GET
→ Read

POST
→ Create/action

PATCH
→ Partial update

PUT
→ Full replacement where genuinely required

DELETE
→ Explicit deletion where supported
```

Do not use HTTP semantics merely because a method is convenient.

---

# 7. Route Handler Responsibilities

A route handler should generally:

1. Parse request.
2. Authenticate.
3. Resolve tenant.
4. Authorize.
5. Validate input.
6. Extract idempotency information where required.
7. Call application service.
8. Map result to DTO.
9. Return HTTP response.

It should not perform domain calculations directly.

---

# 8. Authentication

Protected endpoints must require authentication unless explicitly public.

Authentication should use:

```text id="p8r5m4"
packages/auth
```

The route must not implement a separate authentication mechanism.

---

# 9. Tenant Resolution

Store-scoped APIs must establish trusted Store context before invoking application services.

A request such as:

```text id="x4m7n8"
POST /api/v1/products
```

must execute against an authorized Store context.

---

# 10. Authorization

Authorization must be evaluated before the operation.

Conceptually:

```text id="q5v8r3"
authenticate
   ↓
resolve Store
   ↓
check permission
   ↓
execute use case
```

The API must never trust client-supplied roles or permissions.

---

# 11. Public Endpoints

Public endpoints must be explicitly identified.

Examples may include:

```text id="m7q4p8"
Published storefront products
Public Store configuration
Public checkout entry points
```

Public does not mean unrestricted access to internal Store data.

---

# 12. Input Validation

Every API input must be validated.

Validate:

```text id="v6n3r5"
Path parameters
Query parameters
Headers where relevant
Request body
Pagination values
IDs
Enums
Dates
Money values
Quantities
```

Use the shared validation package.

---

# 13. DTOs

API DTOs must be explicit.

Do not return:

```text id="x8m4q7"
Database entity
ORM model
Repository result containing internal fields
```

directly to clients.

Map internal representations into stable external contracts.

---

# 14. Request DTOs

Request DTOs should contain only fields that clients are allowed to provide.

Do not accept server-owned fields such as:

```text id="q7r5m8"
createdAt
updatedAt
storeId when derived from context
userId when derived from session
internal status
```

unless explicitly required.

---

# 15. Response DTOs

Response DTOs should expose only required information.

Sensitive internal fields must remain server-side.

For example, never expose:

```text id="m4n8p6"
password hashes
payment secrets
provider credentials
internal session identifiers
private object-storage credentials
```

---

# 16. Serialization

API serialization must be explicit for:

```text id="v8q5r3"
Dates
Money
Decimal values
BigInt/large identifiers where applicable
Enums
```

The API must not silently convert financial values into unsafe floating-point values.

---

# 17. Error Contract

All API errors should follow a consistent structure.

Conceptually:

```text id="x6m4p8"
{
  "error": {
    "code": "...",
    "message": "...",
    "details": ...
  }
}
```

The exact response schema should be defined centrally.

---

# 18. Error Codes

Error codes must be stable and machine-readable.

Examples:

```text id="q7r3m5"
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT
IDEMPOTENCY_CONFLICT
INVENTORY_UNAVAILABLE
CHECKOUT_EXPIRED
PAYMENT_FAILED
```

Do not expose raw database errors as API codes.

---

# 19. Error Mapping

Application/domain errors should be translated into HTTP responses through a centralized mapping strategy.

Conceptually:

```text id="m8q4v7"
Application Error
      ↓
API Error Mapper
      ↓
HTTP status + stable code
```

---

# 20. Unexpected Errors

Unexpected errors should:

- Be logged.
- Include correlation information.
- Return a safe generic response.
- Avoid exposing stack traces or internal implementation details.

Example:

```text id="v5n7r4"
Internal server error.
```

The detailed diagnostic remains server-side.

---

# 21. Validation Errors

Validation failures should identify the invalid fields without exposing internal implementation details.

Example:

```text id="x4m8q6"
{
  "error": {
    "code": "VALIDATION_ERROR",
    "details": {
      "quantity": "Must be a positive integer"
    }
  }
}
```

---

# 22. Authentication Errors

Unauthenticated requests should return the approved authentication error.

Do not reveal sensitive information about the resource being requested.

---

# 23. Authorization Errors

Unauthorized access must not leak another tenant's data.

Depending on the API contract, an inaccessible resource may be represented as:

```text id="q6r4m8"
404 Not Found
```

rather than revealing its existence through `403`.

---

# 24. Pagination

Collection endpoints should use a consistent pagination model.

Cursor pagination is preferred for large or mutable collections where appropriate.

Conceptually:

```text id="m7p5q3"
GET /products?limit=20&cursor=...
```

Response:

```text id="v8n4r6"
{
  "items": [...],
  "pageInfo": {
    "hasMore": true,
    "nextCursor": "..."
  }
}
```

---

# 25. Pagination Limits

Clients must not be allowed to request unbounded result sets.

For example:

```text id="x5q8m4"
limit <= configured maximum
```

The exact maximum should be centrally configured.

Invalid pagination parameters must fail validation.

---

# 26. Stable Ordering

Paginated queries require deterministic ordering.

Avoid ordering solely by a non-unique field.

Prefer a stable combination such as:

```text id="q7m3r8"
created_at + id
```

where appropriate.

---

# 27. Filtering

Filtering should be explicitly supported by each endpoint.

Do not expose arbitrary SQL-like filtering.

For example:

```text id="m4r8p5"
status=published
createdAfter=...
```

only where defined by the API contract.

---

# 28. Sorting

Sorting options should be allowlisted.

Never pass arbitrary client-provided column names directly into SQL.

---

# 29. Search

The Demo does not require a dedicated search engine.

API search capabilities should use PostgreSQL-supported queries where appropriate.

Do not introduce Elasticsearch/OpenSearch merely to support simple Demo catalog queries.

---

# 30. Idempotency

Mutation endpoints that can be retried must support the approved idempotency mechanism.

Important examples:

```text id="v6q4r8"
Checkout completion
Payment operations
Refunds
Order creation
Inventory adjustments
Webhook processing
```

---

# 31. Idempotency Header

The API may use a standard request header such as:

```text id="x8m5p3"
Idempotency-Key
```

The exact header and semantics must remain consistent across the API.

---

# 32. Idempotency Validation

The server should associate an idempotency key with:

```text id="q5r7m4"
operation
authenticated identity
Store context
request fingerprint
result/status
```

A key reused for a materially different request must be rejected.

---

# 33. Concurrent Requests

Two concurrent requests using the same idempotency key must not produce two independent successful mutations.

The database-backed idempotency implementation must provide the required synchronization.

---

# 34. API Request Size

Endpoints must enforce reasonable request-size limits.

This is particularly important for:

```text id="m8q4p6"
JSON bodies
File metadata
Webhook payloads
Public endpoints
```

Large binary uploads should use the Media/storage flow rather than unrestricted API bodies.

---

# 35. Content Types

Endpoints should explicitly define accepted request content types.

For JSON APIs:

```text id="v7r3n8"
Content-Type: application/json
```

Unexpected content types should be rejected where appropriate.

---

# 36. HTTP Headers

The API should validate or safely handle important headers such as:

```text id="x4q8m5"
Authorization/session cookies
Content-Type
Idempotency-Key
Correlation/request ID where supported
```

Do not blindly trust arbitrary client headers.

---

# 37. Correlation IDs

Every request should have a request/correlation identifier.

The identifier should propagate to:

```text id="q6m4r7"
Logs
Application services
Events where appropriate
Jobs where appropriate
```

---

# 38. API Logging

API logging should capture structured metadata such as:

```text id="m5r8q3"
requestId
method
route
status
duration
userId where appropriate
storeId where appropriate
errorCode
```

Avoid logging full request bodies by default.

---

# 39. Rate Limiting

Sensitive and publicly accessible APIs should have appropriate rate limits.

Examples:

```text id="v8q4m6"
Login
Password reset
Public checkout
Webhook ingestion
High-cost public queries
```

Demo rate limiting should remain simple and configurable.

---

# 40. CORS

CORS must be explicitly configured.

Authenticated APIs must not allow arbitrary origins.

Allowed origins should come from validated configuration.

---

# 41. CSRF

Cookie-authenticated APIs require an appropriate CSRF strategy for state-changing browser requests.

Do not assume that SameSite cookies alone eliminate every CSRF consideration.

---

# 42. Webhook APIs

Webhook endpoints have a different authentication model.

They should:

```text id="x7m4r8"
Receive raw request
Verify signature
Apply replay protection
Persist event
Deduplicate
Enqueue processing
Return appropriate response
```

Do not treat webhook requests as normal user-authenticated API requests.

---

# 43. Public Storefront APIs

Public APIs must expose only:

```text id="q5n8p4"
Published products
Public Store information
Publicly available catalog data
Explicitly permitted checkout information
```

Draft products, internal inventory state, customer records, and merchant configuration must remain private.

---

# 44. API Transactions

API handlers should not manually manage arbitrary database transactions.

The application service owns the transaction boundary.

Example:

```text id="m6r4q7"
API route
  ↓
Application service
  ↓
transaction
  ↓
domain operation
```

---

# 45. Long Operations

Long-running secondary work should be delegated to jobs.

Examples:

```text id="v7q5m3"
Notification delivery
Webhook processing
Media processing
Cleanup
Provider retries
```

The API should not keep HTTP requests open unnecessarily.

---

# 46. API Contract Documentation

The API should be documented using OpenAPI.

Documentation must describe:

```text id="x4m8r6"
Paths
Methods
Parameters
Request schemas
Response schemas
Errors
Authentication
Idempotency
Pagination
```

---

# 47. OpenAPI Source of Truth

The OpenAPI contract should be generated or maintained from the actual API implementation in a way that prevents documentation drift.

Do not manually maintain a completely separate API description that can diverge from the implementation.

---

# 48. Contract Changes

API changes should be reviewed for compatibility.

Potential breaking changes include:

```text id="q8r5m4"
Removing fields
Renaming fields
Changing types
Changing required fields
Changing status semantics
Changing authentication behavior
```

Breaking changes require deliberate versioning or migration strategy.

---

# 49. Backward Compatibility

Within `/api/v1`, avoid unnecessary breaking changes.

Prefer additive changes where practical:

```text id="m7q4n8"
Add optional response field
Add optional request field
Add new endpoint
```

Do not change existing semantics silently.

---

# 50. API Tests

API tests must cover:

```text id="v6m3r8"
Authentication
Authorization
Tenant isolation
Validation
Success responses
Error responses
Pagination
Idempotency
Concurrency
Webhook security
Rate limiting where applicable
```

---

# 51. Contract Tests

Important endpoints should verify:

```text id="x5q8m4"
Request matches schema
Response matches schema
Error matches schema
```

This helps prevent accidental API drift.

---

# 52. Security Tests

API security tests must attempt:

```text id="q7r4m8"
Cross-tenant access
Missing authentication
Insufficient role
Manipulated Store ID
Manipulated resource ID
Invalid session
Replay/idempotency abuse
Malformed payload
Oversized input
```

---

# 53. API Implementation Order

Implement the API foundation in this order:

```text id="m8q5r4"
1. Routing structure
2. API versioning
3. Request context
4. Authentication middleware/helpers
5. Tenant resolution
6. Authorization
7. Validation
8. Error contract/mapping
9. DTO mapping
10. Pagination
11. Idempotency integration
12. Logging/correlation
13. OpenAPI
14. API tests
```

Domain endpoints should then be implemented through the vertical slices.

---

# 54. AI-Assisted API Rules

AI-generated API code must:

1. Read the actual `AGENTS.md`.
2. Inspect the relevant API/domain specifications.
3. Follow existing endpoint patterns.
4. Validate every external input.
5. Preserve tenant isolation.
6. Enforce server-side authorization.
7. Avoid direct database access from routes.
8. Preserve idempotency semantics.
9. Use stable DTOs.
10. Update tests and API documentation together.
11. Review the final diff for accidental exposure.

---

# 55. Definition of Done

API implementation is complete when:

```text id="v4n7m6"
[ ] `/api/v1/*` structure exists
[ ] Routes are business-capability oriented
[ ] Authentication is enforced
[ ] Tenant context is enforced
[ ] Authorization is server-side
[ ] Inputs are validated
[ ] DTOs are explicit
[ ] Errors use stable contracts
[ ] Pagination is bounded and deterministic
[ ] Idempotency is supported where required
[ ] CORS is controlled
[ ] CSRF strategy is implemented
[ ] Request correlation exists
[ ] Sensitive data is not logged
[ ] OpenAPI documentation exists
[ ] API tests pass
[ ] Security tests pass
[ ] TypeScript passes
[ ] Lint passes
```

---

# 56. Final Principle

The API is a **contract boundary, not a database doorway**.

Its job is to translate external requests into authorized application operations while preserving tenant isolation, validation, idempotency, security, and stable response semantics.

The internal architecture may evolve. The API contract must remain deliberate and predictable.