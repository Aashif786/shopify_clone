# API Foundation Implementation

## 1. Purpose

This document defines the implementation foundation for the Demo HTTP API.

The API layer provides the boundary between external clients and application use cases. It must remain thin, predictable, tenant-aware, secure, and independent of internal database structures.

---

# 2. API Architecture

The API follows:

```text id="c4m8x7"
HTTP Request
      ↓
Route / Handler
      ↓
Request Parsing
      ↓
Authentication
      ↓
Tenant Resolution
      ↓
Authorization
      ↓
Validation
      ↓
Application Service
      ↓
Domain
      ↓
Repository / Infrastructure
      ↓
PostgreSQL / External Provider
```

The API layer coordinates the request but does not own business logic.

---

# 3. API Version

The initial API namespace is:

```text id="r7n3m9"
/api/v1
```

All versioned business-capability endpoints should use this namespace.

---

# 4. Business-Capability Routing

Endpoints should be organized around business capabilities.

Examples:

```text id="x5m8c3"
/api/v1/auth
/api/v1/stores
/api/v1/products
/api/v1/inventory
/api/v1/customers
/api/v1/carts
/api/v1/discounts
/api/v1/checkout
/api/v1/payments
/api/v1/orders
/api/v1/storefront
/api/v1/media
/api/v1/webhooks
```

Exact endpoint structures are defined by individual domain specifications.

---

# 5. Thin Route Handlers

A route handler should primarily:

1. Receive the request.
2. Parse input.
3. Resolve authentication.
4. Resolve tenant context.
5. Authorize the operation.
6. Validate input.
7. Invoke an application service.
8. Map the result to an HTTP response.

It should not contain complex business rules.

---

# 6. Business Logic Boundary

Avoid:

```text id="q8c4m7"
HTTP Handler
    ↓
Business calculations
    ↓
Direct SQL
    ↓
External API
```

Prefer:

```text id="m5x9c3"
HTTP Handler
    ↓
Application Service
    ↓
Domain
    ↓
Infrastructure
```

---

# 7. Request Parsing

Request parsing should convert raw HTTP input into structured application input.

Examples:

- JSON body.
- Route parameters.
- Query parameters.
- Headers.

Malformed requests should be rejected before application logic executes.

---

# 8. Input Validation

All externally supplied input must be validated.

Validation should cover:

- Required fields.
- Data types.
- Length limits.
- Formats.
- Enumerated values.
- Numeric ranges.
- Nested structures.

Validation is not authorization.

---

# 9. Validation vs Authorization

These are separate concerns.

```text id="v6m3x8"
Validation
    ↓
Is this input structurally valid?

Authorization
    ↓
Is this actor allowed to perform this operation?
```

Both checks are required.

---

# 10. Authentication

Protected API operations must establish authentication before executing the business operation.

Conceptually:

```text id="k7n4c9"
Request
    ↓
Session
    ↓
Authenticated User
```

Unauthenticated access must be rejected where authentication is required.

---

# 11. Tenant Resolution

For Store-scoped operations:

```text id="p4m8x3"
Authenticated User
    ↓
Store Selection
    ↓
Membership
    ↓
Tenant Context
```

A Store identifier supplied by the client is not proof of access.

---

# 12. Authorization

Authorization must be performed server-side.

Examples:

```text id="n8c5m2"
Owner → full Store administration

Admin → administrative operations

Staff → permitted operational operations

Customer → own customer-facing resources
```

The exact permissions are defined by the authorization model.

---

# 13. Resource Ownership

The API must ensure that nested resources belong to the current Store.

For example:

```text id="w3m7x9"
/stores/store-a/products/product-b
```

must not succeed if `product-b` belongs to another Store.

Ownership should be verified as part of the application operation.

---

# 14. API DTOs

External API request and response structures should use explicit DTOs.

Do not expose database records directly.

Example:

```text id="c6n8m4"
Database Row
    ↓
Domain Model
    ↓
Application Result
    ↓
API Response DTO
```

---

# 15. Request DTOs

Request DTOs should represent what the API accepts.

For example:

```text id="m8x3v5"
CreateProductRequest
UpdateProductRequest
AddCartItemRequest
CreateCheckoutRequest
```

They should not automatically become domain entities.

---

# 16. Response DTOs

Responses should expose only data required by the client.

Do not return:

- Password hashes.
- Internal database metadata.
- Provider secrets.
- Internal authorization information.
- Private infrastructure details.

---

# 17. HTTP Methods

Use HTTP methods according to their intended semantics.

Typical usage:

```text id="q4m7x8"
GET     → Read
POST    → Create / Action
PUT     → Full replacement where appropriate
PATCH   → Partial update
DELETE  → Delete / Remove
```

Business actions that do not naturally map to CRUD may use explicit action endpoints.

---

# 18. Resource Naming

Use consistent plural resource names.

Examples:

```text id="x9c4m7"
/products
/orders
/customers
/stores
```

Avoid inconsistent naming such as mixing:

```text id="f5m8n2"
/product
/orders
/getCustomer
```

---

# 19. Business Actions

Some operations are business actions rather than generic updates.

Examples:

```text id="v7m3c9"
/checkout/{id}/complete
/orders/{id}/cancel
/payments/{id}/refund
/inventory/{id}/adjust
```

The API should expose the domain operation clearly rather than pretending every action is a generic CRUD update.

---

# 20. Idempotency

State-changing critical operations should support idempotency where required.

Examples:

- Checkout completion.
- Payment creation.
- Refunds.
- Inventory adjustments where retry behavior matters.
- Order creation.
- Webhook processing.

The API should accept an idempotency key according to the established idempotency strategy.

---

# 21. Idempotency Header

Where applicable, use a consistent request header.

Conceptually:

```text id="j6c8m3"
Idempotency-Key: <client-generated-key>
```

The server must define:

- Key scope.
- Request fingerprinting.
- Replay behavior.
- Expiration/retention.
- Concurrent request behavior.

---

# 22. Safe Retries

Clients should be able to safely retry operations explicitly documented as idempotent.

The server must not accidentally create:

```text id="r8m4x2"
duplicate payment
duplicate order
duplicate refund
duplicate inventory mutation
```

because a client retried a request after a timeout.

---

# 23. Pagination

Collection endpoints should use a consistent pagination strategy.

The initial implementation should follow the API pagination specification rather than inventing different pagination rules per domain.

Examples:

```text id="n5c9v7"
GET /products?cursor=...
GET /orders?cursor=...
```

---

# 24. Filtering

Filtering parameters should be explicit.

Example:

```text id="k7m3x8"
/orders?status=paid
```

Unsupported filters should return a validation error rather than silently being ignored.

---

# 25. Sorting

Sorting should use an explicit allowlist.

Clients must not be allowed to inject arbitrary SQL ordering expressions.

Example:

```text id="x4m8c7"
?sort=created_at
?sort=-created_at
```

only where supported by the endpoint.

---

# 26. Search

The Demo does not require a dedicated search engine.

Simple search/filter behavior may use PostgreSQL where appropriate.

API design must not introduce a search-service dependency merely to provide basic filtering.

---

# 27. Error Contract

All API errors should follow the common error contract.

Conceptually:

```json id="w8m3c6"
{
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Product was not found",
    "requestId": "..."
  }
}
```

The exact response structure must follow:

```text id="p5n8x3"
docs/api/error-contract.md
```

---

# 28. Error Codes

Error codes should be stable machine-readable identifiers.

Examples:

```text id="c7m4v9"
VALIDATION_ERROR
AUTHENTICATION_REQUIRED
FORBIDDEN
NOT_FOUND
CONFLICT
RATE_LIMITED
INTERNAL_ERROR
```

Domain-specific codes may be introduced when they provide meaningful client behavior.

---

# 29. HTTP Status Codes

Use appropriate HTTP status codes consistently.

Typical examples:

```text id="m3x8c5"
200 → Successful read/update
201 → Created
204 → Successful operation without body
400 → Invalid request
401 → Authentication required
403 → Forbidden
404 → Not found
409 → Conflict
422 → Semantically invalid input where applicable
429 → Rate limited
500 → Unexpected server error
```

The project should avoid arbitrary status-code variations between modules.

---

# 30. Not-Found Safety

Tenant-sensitive resources may intentionally return a generic not-found response when the resource exists but belongs to another tenant.

This prevents information disclosure.

---

# 31. Request IDs

Every API request should have a correlation/request identifier.

The identifier should:

- Appear in logs.
- Be included in error responses where appropriate.
- Be propagated to downstream operations where useful.

---

# 32. Logging

API logging should capture operational metadata such as:

- Request ID.
- Route.
- HTTP method.
- Status.
- Duration.
- User ID where appropriate.
- Store ID where appropriate.

Do not log:

- Passwords.
- Session tokens.
- Payment secrets.
- Authorization headers.
- Sensitive customer data unnecessarily.

---

# 33. Rate Limiting

Rate limiting should be applied to abuse-sensitive endpoints.

Examples:

- Login.
- Password reset.
- Public checkout endpoints.
- Webhook endpoints where appropriate.
- Expensive public Storefront operations.

The Demo may use a simple implementation suitable for its scale.

---

# 34. API Authentication Cookies

When browser authentication uses cookies, state-changing requests must follow the established CSRF protection strategy.

The API must not assume that SameSite settings alone automatically solve every deployment scenario.

---

# 35. CORS

CORS should be explicitly configured where required.

Do not use unrestricted:

```text id="q4m8x7"
Access-Control-Allow-Origin: *
```

for credentialed APIs.

---

# 36. Content Types

JSON APIs should use:

```text id="z7c3m9"
application/json
```

where appropriate.

The API should reject unsupported content types for endpoints that require structured JSON input.

---

# 37. Request Size Limits

Endpoints must enforce appropriate request-size limits.

This is especially important for:

- JSON bodies.
- Media uploads.
- Webhook requests.

Large payload handling should not allow trivial resource exhaustion.

---

# 38. File Uploads

Large media files should not normally pass through ordinary JSON API handlers.

The media implementation should use the storage strategy defined in:

```text id="m5x8c3"
specs/media/media-implementation.md
```

The API may issue controlled upload instructions or signed URLs.

---

# 39. Webhooks

Webhook endpoints are special API boundaries.

They must support:

- Raw request handling where required.
- Signature verification.
- Replay protection.
- Event persistence.
- Idempotent processing.

They must not use normal merchant authentication as their primary verification mechanism.

---

# 40. API Versioning Strategy

The Demo starts with:

```text id="v6m3n8"
/api/v1
```

Breaking changes should not silently alter the meaning of an existing v1 contract.

If a future breaking API is required:

```text id="k8c4x5"
/api/v2
```

may be introduced according to the versioning strategy.

---

# 41. OpenAPI

The API should maintain an OpenAPI contract.

The contract should describe:

- Routes.
- Methods.
- Parameters.
- Request schemas.
- Response schemas.
- Authentication.
- Error responses.

The OpenAPI document should remain synchronized with implementation.

---

# 42. API Contract Ownership

The team implementing a domain owns its endpoint behavior.

For example:

```text id="r4m8c2"
Products
    ↓
Product API contract

Orders
    ↓
Order API contract
```

Cross-domain endpoints should have explicitly identified ownership.

---

# 43. Internal vs External APIs

Not every application-level operation needs to become an HTTP endpoint.

Internal operations may remain:

```text id="x7n3m9"
Application Service
```

or use internal event/job mechanisms.

Do not create HTTP calls between modules inside the same modular monolith.

---

# 44. API and Module Boundaries

The API may call application services from modules.

It must not bypass module boundaries to access another module's repositories directly.

Preferred:

```text id="p8c4m7"
API
 ↓
Products Application Service
 ↓
Products Domain
```

Not:

```text id="q5n8x3"
API
 ↓
Products Repository
 ↓
Database
```

for operations requiring business rules.

---

# 45. Transactions

The API layer must not manually manage complex transactions.

Transaction ownership belongs to the application service/use-case layer.

Example:

```text id="m6x3c9"
API
 ↓
CheckoutService.complete()
 ↓
Transaction
 ↓
Checkout + Inventory + Payment State
```

---

# 46. External Integrations

API handlers must not directly call provider SDKs where the operation belongs to an application service and provider adapter.

Preferred:

```text id="v9m4x7"
API
 ↓
Application Service
 ↓
Payment Gateway Interface
 ↓
Provider Adapter
```

---

# 47. API Timeouts

External operations invoked during API requests must have bounded timeouts.

The API must not wait indefinitely for an external service.

Operations that can safely become asynchronous should use the job/event architecture instead.

---

# 48. API Security Boundary

Every protected endpoint must establish:

```text id="x5c8m2"
Authentication
    ↓
Tenant Context
    ↓
Authorization
    ↓
Validation
    ↓
Business Operation
```

Skipping one of these steps must be an explicit documented exception.

---

# 49. API Testing

The API foundation must include tests for:

### Contract behavior

- Valid requests.
- Invalid requests.
- Response schemas.
- HTTP status codes.

### Security

- Unauthenticated requests.
- Unauthorized requests.
- Cross-tenant access.
- Invalid session.
- CSRF behavior where applicable.

### Reliability

- Idempotent retries.
- Duplicate requests.
- Provider failures.
- Timeout behavior.

---

# 50. API Definition of Done

```text id="u6m3x8"
[ ] /api/v1 namespace exists
[ ] Business-capability routing is established
[ ] Route handlers are thin
[ ] Request parsing exists
[ ] Input validation exists
[ ] Authentication integration exists
[ ] Tenant resolution exists
[ ] Authorization integration exists
[ ] Explicit request DTOs exist
[ ] Explicit response DTOs exist
[ ] Common error contract exists
[ ] Request IDs exist
[ ] Pagination strategy is implemented
[ ] Filtering strategy is implemented
[ ] Sorting allowlists exist
[ ] Idempotency support exists where required
[ ] Rate limiting strategy exists
[ ] CORS is restricted
[ ] Request-size limits exist
[ ] Webhook boundary exists
[ ] OpenAPI contract exists
[ ] API tests exist
```

---

# 51. Final API Principle

The API is a boundary, not the business layer.

The intended architecture is:

```text id="n8m4c7"
HTTP
 ↓
Boundary Validation
 ↓
Authentication
 ↓
Tenant Resolution
 ↓
Authorization
 ↓
Application Service
 ↓
Domain
 ↓
Infrastructure
```

If a route handler starts calculating inventory, deciding payment state, or directly manipulating database tables, the API boundary has already begun eating the architecture. Keep it thin and let the owning domain do its job.