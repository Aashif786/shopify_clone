# API Contract Principles

## 1. Purpose

This document defines the API contract principles for the Demo commerce platform.

It establishes:

- API design conventions
- Resource boundaries
- Request and response rules
- Authentication and authorization behavior
- Tenant scoping
- Validation
- Error handling
- Pagination
- Idempotency
- Concurrency
- Webhooks
- Versioning
- Documentation
- API security
- Internal vs external contracts

The API is a transport boundary over the application's domain and application services.

It must not become the source of business rules.

---

# 2. API Design Principles

The API follows these principles:

1. APIs expose business capabilities, not database tables.
2. API handlers remain thin.
3. Business rules belong to application/domain layers.
4. Tenant context is resolved server-side.
5. Client-provided tenant identifiers are never trusted by themselves.
6. Authorization occurs before protected operations.
7. Input validation is mandatory.
8. Response structures should be stable and predictable.
9. Errors should be machine-readable and human-understandable.
10. Financial and critical mutations must support safe retries where required.
11. APIs must not expose internal implementation details unnecessarily.
12. API contracts must be documented and testable.
13. Breaking changes require deliberate versioning.
14. Internal APIs and public storefront APIs may have different representations.

---

# 3. API Architecture

The request flow is:

```text id="w7m3x8"
Client
  ↓
HTTP Request
  ↓
Route Handler
  ↓
Authentication
  ↓
Tenant Resolution
  ↓
Authorization
  ↓
Request Validation
  ↓
Application Service
  ↓
Domain
  ↓
Persistence / Integration
  ↓
Response Mapping
  ↓
HTTP Response
```

The route handler should not contain substantial business logic.

---

# 4. API Surface

Demo may expose several logical API areas:

```text id="q4x8n2"
Authentication
Store Management
Products
Inventory
Customers
Carts
Discounts
Checkout
Payments
Orders
Storefront
Webhooks
```

The exact URL structure is an implementation detail, but logical boundaries should remain aligned with domain ownership.

---

# 5. API Resource Principle

API resources should represent business concepts.

Prefer:

```text id="p6m2x9"
POST /stores/{storeId}/products
```

over:

```text id="v8q3m5"
POST /database/product_rows
```

Prefer:

```text id="x4n7k2"
POST /checkouts/{checkoutId}/complete
```

over:

```text id="j5m8q1"
PATCH /checkouts/{checkoutId}
{
  "status": "COMPLETED"
}
```

The API should expose business operations rather than arbitrary database mutations.

---

# 6. HTTP Methods

Use HTTP methods consistently.

### GET

Read data.

```text id="c8x2m7"
GET /products
```

### POST

Create resources or execute non-idempotent/business operations.

```text id="q7m3v9"
POST /products
POST /checkouts/{id}/complete
```

### PATCH

Partially update mutable resources where appropriate.

```text id="n5x8m2"
PATCH /products/{id}
```

### PUT

Use only where full replacement semantics are genuinely required.

### DELETE

Use for deletion where deletion is actually supported.

Do not use HTTP method semantics to bypass business lifecycle rules.

---

# 7. Resource URLs

Resource paths should communicate ownership and scope.

Example:

```text id="r6m3x8"
GET /stores/{storeId}/products/{productId}
```

The server must still verify that:

```text id="v2q7n5"
product.store_id == storeId
```

The URL is not a security boundary.

---

# 8. Tenant Resolution

Tenant context should be established before accessing store-owned resources.

Possible sources include:

- authenticated membership
- selected merchant store
- storefront domain
- trusted server-side routing
- validated store identifier

The server determines the authoritative tenant context.

---

# 9. Tenant Isolation

Every protected store-scoped request must enforce:

```text id="m8x4q2"
Authenticated Actor
        ↓
Organization Access
        ↓
Store Access
        ↓
Resource Store Ownership
```

The API must reject cross-store access.

Example:

```text id="p7n3x8"
User has access to Store A

GET /stores/B/orders
```

must not return Store B data.

---

# 10. Authentication

Authentication establishes the caller's identity.

The API must distinguish:

```text id="q4m8x1"
Unauthenticated
```

from:

```text id="v6n2p9"
Authenticated but unauthorized
```

Typical responses:

```text id="z8x3m5"
401 Unauthorized
403 Forbidden
```

Authentication implementation details belong to the Auth package.

---

# 11. Authorization

Authorization determines whether the authenticated actor may perform the requested operation.

Examples:

```text id="r5q7m2"
OWNER
ADMIN
STAFF
CUSTOMER
```

Authorization must be:

- server-side
- tenant-aware
- operation-specific
- independent of client UI restrictions

Hiding a button is not authorization. Humans have spent decades learning this lesson and apparently still need reminders.

---

# 12. Role-Based Authorization

Roles provide a baseline permission model.

Example:

| Operation | Owner | Admin | Staff |
|---|---:|---:|---:|
| Manage store | Yes | Yes | Limited |
| Manage products | Yes | Yes | Yes |
| Manage inventory | Yes | Yes | Yes |
| Manage members | Yes | Yes | No |
| Manage payments | Yes | Yes | Limited |
| Manage orders | Yes | Yes | Yes |

Exact permissions are defined by the authorization implementation and product requirements.

---

# 13. Customer Authorization

Customers have a different authorization model.

A customer may:

- access their own profile
- manage their own addresses
- access their own cart
- access their own checkout
- access their own orders

They must not access another customer's resources.

---

# 14. Request Validation

Every externally supplied request must be validated before business processing.

Validation includes:

- required fields
- types
- string lengths
- numeric ranges
- enum values
- identifiers
- formats
- nested objects
- business-relevant structural constraints

Validation libraries belong at the API/application boundary.

---

# 15. Validation Layers

Validation should occur at multiple levels.

### Transport validation

Examples:

```text id="m3x8q7"
valid UUID
valid email format
valid integer
required field present
```

### Application validation

Examples:

```text id="p6n2v4"
resource belongs to store
actor may perform operation
```

### Domain validation

Examples:

```text id="v8q3m1"
cannot cancel fulfilled order
cannot reserve unavailable inventory
```

### Database constraints

Examples:

```text id="x5m7q2"
unique store slug
foreign keys
check constraints
```

No single layer should be expected to protect every invariant.

---

# 16. Request DTOs

API requests should use explicit request DTOs.

Example:

```text id="j4m8x2"
CreateProductRequest
{
  title
  description
  variants
}
```

The DTO should not automatically become the database entity.

The application service receives validated input and applies business rules.

---

# 17. Response DTOs

Responses should use explicit representations.

Example:

```text id="r7q3m9"
ProductResponse
{
  id
  title
  slug
  status
  variants
}
```

Avoid returning raw ORM/database objects.

This prevents accidental exposure of:

- internal IDs
- secrets
- provider metadata
- internal timestamps
- authorization data
- database implementation details

---

# 18. Public Storefront Responses

Storefront responses should expose only customer-relevant data.

For example:

```text id="n8m2x5"
PublicProduct
{
  id
  title
  description
  slug
  media
  variants
  price
  availability
}
```

Do not expose:

```text id="q4x7m1"
internal_cost
supplier_id
private_notes
payment_provider_reference
internal_inventory_metadata
```

---

# 19. Merchant API Responses

Merchant responses may expose additional information.

Example:

```text id="w6m3p8"
MerchantProduct
{
  id
  title
  status
  variants
  inventory
  createdAt
  updatedAt
}
```

The response must still respect the actor's permissions.

---

# 20. Error Contract

Errors should use a consistent structure.

Conceptually:

```json
{
  "error": {
    "code": "INSUFFICIENT_INVENTORY",
    "message": "The requested quantity is not available.",
    "requestId": "..."
  }
}
```

The exact schema may evolve, but error codes should remain stable enough for clients to handle known business conditions.

---

# 21. Error Categories

Common categories:

```text id="x8q2m5"
VALIDATION_ERROR
AUTHENTICATION_REQUIRED
FORBIDDEN
NOT_FOUND
CONFLICT
BUSINESS_RULE_VIOLATION
RATE_LIMITED
INTERNAL_ERROR
EXTERNAL_SERVICE_ERROR
```

Domain-specific codes may exist underneath these categories.

---

# 22. HTTP Status Mapping

Recommended baseline:

| Condition | HTTP Status |
|---|---:|
| Successful read | 200 |
| Successful creation | 201 |
| Successful deletion with no body | 204 |
| Invalid request | 400 |
| Unauthenticated | 401 |
| Unauthorized | 403 |
| Resource not found | 404 |
| Business/state conflict | 409 |
| Validation failure | 422 where appropriate |
| Rate limited | 429 |
| Unexpected server failure | 500 |
| External dependency failure | 502/503 where appropriate |

The application must use consistent semantics rather than arbitrary status codes.

---

# 23. Not Found vs Forbidden

The platform should deliberately decide whether unauthorized resource access should appear as:

```text id="q3m8x7"
403 Forbidden
```

or:

```text id="v5n2p9"
404 Not Found
```

For sensitive resources, returning `404` may prevent resource existence disclosure.

The decision should be consistent by resource type.

---

# 24. Pagination

List endpoints should support pagination.

Example:

```text id="m7x4q2"
GET /stores/{storeId}/orders?limit=25&cursor=...
```

Cursor-based pagination is preferred for large or frequently changing datasets.

Responses may include:

```json
{
  "data": [],
  "pagination": {
    "nextCursor": "...",
    "hasMore": true
  }
}
```

---

# 25. Pagination Rules

The server must:

- enforce maximum page size
- validate cursor values
- preserve tenant scope
- use deterministic ordering
- avoid exposing internal database cursors directly

Default and maximum limits should be defined centrally.

---

# 26. Filtering

Filters should be explicit.

Example:

```text id="n3x8m7"
GET /orders?status=CONFIRMED
```

Do not allow arbitrary SQL-like filtering expressions from clients.

Supported filters should be intentionally defined.

---

# 27. Sorting

Sorting should use an allowlist.

Example:

```text id="p8m4q2"
sort=created_at
sort=-created_at
```

The API must reject unsupported fields.

Do not pass arbitrary client strings directly into SQL `ORDER BY`.

---

# 28. Search

Demo should not introduce a dedicated search engine.

Basic filtering and PostgreSQL-supported search are sufficient where required.

A dedicated search system may be introduced later if actual requirements justify it.

---

# 29. Idempotency

Critical mutation endpoints should support idempotency.

Examples:

```text id="x5q8m3"
POST /checkouts/{id}/complete
POST /payments
POST /payments/{id}/refund
POST /orders/{id}/cancel
```

The client may provide:

```text id="v7m2n9"
Idempotency-Key
```

The server must define:

- scope
- expiration
- request matching
- stored result
- replay behavior

---

# 30. Idempotency-Key Rules

For the same operation and key:

```text id="j3x8q5"
Same request
    ↓
Return original result
```

If the same key is reused with materially different input:

```text id="r6m2v8"
Reject request
```

This prevents accidental key reuse from producing unpredictable behavior.

---

# 31. Optimistic Concurrency

Where appropriate, APIs may expose version information.

Example:

```text id="q8n3m5"
version: 12
```

A mutation may require:

```text id="m4x7p2"
expectedVersion = 12
```

If the resource has already changed:

```text id="z5q2n8"
409 Conflict
```

This is useful for merchant-facing editing workflows.

---

# 32. Critical Commerce Concurrency

For operations such as:

- inventory reservation
- payment
- refund
- checkout completion
- order transitions

API-level concurrency controls are not sufficient by themselves.

The database/domain layer must enforce the actual invariant.

---

# 33. API Transactions

Route handlers should not manually manage arbitrary transaction logic.

Preferred:

```text id="w3m8q6"
Route Handler
    ↓
Application Service
    ↓
Transaction Boundary
    ↓
Domain Operations
```

This keeps transaction behavior consistent across:

- HTTP requests
- background jobs
- webhook processing
- future internal callers

---

# 34. Webhook API

Webhook endpoints are integration boundaries.

Example:

```text id="p7x4m2"
POST /webhooks/{provider}
```

Webhook handling must:

1. Receive request.
2. Verify authenticity.
3. Validate event structure.
4. Determine provider event identity.
5. Check idempotency.
6. Process valid state transitions.
7. Persist processing result.
8. Return an appropriate response.

---

# 35. Webhook Security

Webhook handlers must validate:

- signature
- timestamp/replay protections where supported
- provider identity
- event identifier
- expected event structure

The system must not trust:

```text id="k8m3q5"
customerId
paymentId
orderId
status
```

merely because the request contains them.

---

# 36. Webhook Response Strategy

The endpoint should acknowledge events according to provider expectations.

Processing may be:

```text id="v6q2n8"
synchronous
```

or:

```text id="m4x8p3"
persist event → process asynchronously
```

For expensive processing, the webhook endpoint should persist the event safely and return promptly.

---

# 37. API Versioning

Demo should avoid unnecessary version proliferation.

Preferred initial strategy:

```text id="q7m3x8"
Current API
```

A major version may be introduced when breaking changes are genuinely required.

For example:

```text id="n5x2p9"
/api/v1/...
```

Versioning strategy must be consistent across the public API.

---

# 38. Backward Compatibility

Non-breaking changes include:

- adding optional response fields
- adding optional request fields
- adding new resources
- adding new enum values only when clients are designed to tolerate them

Potentially breaking changes include:

- removing fields
- changing field types
- changing semantics
- removing enum values
- changing required request fields
- changing authentication requirements

---

# 39. API Deprecation

Deprecated APIs should have:

- documented replacement
- migration guidance
- deprecation notice
- defined removal timeline

Do not silently remove an API contract.

---

# 40. Authentication Context

Authenticated requests should provide enough context for application services to determine:

```text id="x3m8q7"
user_id
organization memberships
store memberships
roles
permissions
```

The API should pass a normalized authorization context rather than raw authentication tokens into business logic.

---

# 41. Service-to-Service Authentication

Demo does not require a complex service mesh.

Internal application boundaries may use trusted application context.

When external or separately deployed services are introduced in V1, service authentication must become explicit.

---

# 42. Secrets

The API must never expose:

- password hashes
- session secrets
- API secrets
- payment credentials
- provider signing secrets
- database credentials

Secrets must be loaded from environment/secret management mechanisms.

---

# 43. Sensitive Data

API responses and logs must minimize sensitive information.

Do not return or log:

- payment credentials
- authentication secrets
- unnecessary personal data
- provider secrets
- raw authorization headers

---

# 44. Rate Limiting

Rate limiting should be applied where abuse or resource exhaustion is possible.

Priority areas include:

- authentication
- password/reset flows
- checkout completion
- payment operations
- webhooks
- public storefront APIs

Demo may implement basic controls at the application or edge layer.

Advanced distributed rate limiting can be introduced later.

---

# 45. Request Size Limits

The API should enforce reasonable limits for:

- JSON payload size
- multipart uploads
- query parameters
- nested arrays
- product descriptions
- cart item counts

Large files should use object storage upload flows rather than large API payloads.

---

# 46. API Logging

Requests should produce structured logs containing useful correlation information.

Example:

```text id="r8x3m7"
request_id
route
method
status
duration
user_id
organization_id
store_id
```

Sensitive request bodies should not be logged indiscriminately.

---

# 47. API Observability

Critical endpoints should expose:

- request count
- latency
- error rate
- rate-limit events
- dependency failures
- database failures

Critical commerce operations should also be traceable using correlation identifiers.

---

# 48. API Contract Documentation

API contracts should be represented through OpenAPI where practical.

The documentation should describe:

- endpoints
- parameters
- request bodies
- response bodies
- authentication
- errors
- pagination
- idempotency
- webhook contracts

Generated API documentation should reflect the actual implementation.

Documentation must not become an imaginary API that nobody implemented.

---

# 49. API Testing

Every important endpoint should have tests for:

### Authentication

- missing credentials
- invalid credentials
- expired credentials

### Authorization

- allowed role
- forbidden role
- wrong store
- wrong organization

### Validation

- missing fields
- invalid types
- invalid values
- oversized payloads

### Business Rules

- invalid state transitions
- insufficient inventory
- invalid discounts
- payment failures

### Concurrency

- duplicate requests
- concurrent mutations
- webhook retries

### Tenant Isolation

- cross-store reads
- cross-store writes
- cross-organization access

---

# 50. API Contract Testing

API contracts should verify that:

```text id="m7q3x8"
Request schema
        ↓
Application behavior
        ↓
Response schema
```

remain aligned.

Breaking contract changes should fail CI where contract tests are available.

---

# 51. Internal Application APIs

Modules may expose application-level interfaces such as:

```text id="x4n8p2"
ProductService
InventoryService
CustomerService
CheckoutService
PaymentService
OrderService
```

These are internal contracts.

They should not automatically become public HTTP endpoints.

---

# 52. Public API vs Internal Interface

Public API:

```text id="q6m3x9"
HTTP
Authentication
Serialization
Rate limits
Versioning
```

Internal interface:

```text id="v8p2n5"
Typed function/service contract
Domain errors
Application context
Transaction coordination
```

Keeping these separate allows the internal architecture to evolve without breaking external clients.

---

# 53. API and Domain Boundaries

The API layer may:

- parse HTTP
- validate transport input
- authenticate
- authorize
- call application services
- map domain errors
- serialize responses

The API layer must not:

- directly update domain tables
- calculate authoritative payment totals
- decide inventory availability
- implement order state transitions
- bypass module boundaries

---

# 54. API and Database Boundaries

The API should never assume database schema equals API schema.

For example:

```text id="n4x7m2"
Database:
product_variants

API:
variants
```

Database migrations must not automatically become public API changes.

---

# 55. Demo API Strategy

Demo should prioritize:

- clear REST-style contracts
- TypeScript types
- request validation
- consistent errors
- tenant-aware authorization
- idempotent critical mutations
- OpenAPI documentation
- integration tests
- simple pagination
- secure webhook handling

Demo does not require:

- GraphQL unless a real requirement appears
- API gateway microservices
- service mesh
- complex API composition
- multiple public API versions
- generated SDKs for every language

---

# 56. Demo-to-V1 Evolution

The API architecture should allow future additions such as:

- dedicated public API
- merchant API
- storefront API
- webhooks API
- partner APIs
- API keys
- OAuth applications
- rate limiting infrastructure
- API gateway
- generated SDKs

These should be introduced when actual consumers and operational requirements justify them.

---

# 57. API Anti-Patterns

Avoid:

### Database-as-API

Exposing CRUD endpoints for every table.

### Fat route handlers

Putting business logic directly inside API handlers.

### Client-controlled authorization

Trusting role/store identifiers supplied by the browser.

### Client-controlled totals

Accepting final price/payment totals from the client.

### Status patching

Allowing arbitrary status updates.

### Inconsistent errors

Returning unrelated error structures from different modules.

### Unbounded queries

Allowing arbitrary limits, filters, or sorting.

### Hidden side effects

Making simple GET endpoints mutate business state.

### Premature versioning

Creating multiple API versions before consumers exist.

---

# 58. Core API Invariants

The API layer must guarantee:

1. Every protected request is authenticated where required.
2. Authorization is enforced server-side.
3. Tenant context is validated.
4. Input is validated.
5. API handlers do not bypass domain rules.
6. Critical mutations support safe retry behavior.
7. Business errors are mapped consistently.
8. Sensitive information is not exposed.
9. Webhooks are authenticated and idempotent.
10. Pagination is bounded.
11. Database entities are not blindly serialized.
12. API contracts remain aligned with implementation.
13. Cross-tenant access is rejected.
14. Critical commerce operations remain concurrency-safe.
15. Public API behavior remains independent from database implementation details.

---

# 59. Definition of Done

The API architecture is sufficiently defined when:

- API boundaries are clear.
- Authentication and authorization behavior is defined.
- Tenant resolution is defined.
- Request and response contracts are understood.
- Validation layers are separated.
- Error contracts are consistent.
- Pagination and filtering rules are established.
- Idempotency requirements are documented.
- Webhook handling is defined.
- API versioning strategy is established.
- Security requirements are documented.
- API testing requirements are defined.
- OpenAPI documentation is planned.
- Public API and internal application interfaces remain separate.
- The API can evolve toward V1 without forcing a rewrite of the domain layer.