# API Versioning

## 1. Purpose

This document defines the API versioning strategy for the Cal Cart commerce platform.

The goal is to allow the API to evolve without unnecessary breaking changes while keeping the Demo implementation simple enough to operate as a modular monolith.

---

## 2. Versioning Principles

The API should follow these principles:

- Prefer backward-compatible changes.
- Avoid breaking existing consumers unnecessarily.
- Version public contracts deliberately.
- Keep internal module interfaces separate from public API versions.
- Document contract changes.
- Treat API compatibility as a product concern, not merely a routing concern.

The Demo should not introduce a complex API gateway or version-management infrastructure prematurely.

---

## 3. Demo Strategy

For the Demo, the public API should use a single explicit major version:

```text
/api/v1/*
```

Examples:

```text
/api/v1/stores
/api/v1/products
/api/v1/customers
/api/v1/carts
/api/v1/checkout
/api/v1/payments
/api/v1/orders
```

The version applies to the public API contract, not to internal domain modules.

---

## 4. Why URL Versioning

The Demo uses URL-based major versioning because it is:

- Explicit.
- Easy to understand.
- Easy to test.
- Easy to document.
- Easy to route in Next.js.
- Easy to operate without additional infrastructure.

The initial API should not require:

- API gateway version negotiation.
- Header-based version routing.
- Content negotiation.
- Multiple simultaneously deployed API frameworks.

These may be considered later if requirements justify them.

---

## 5. Version Scope

Versioning applies to externally consumed API contracts.

It does not require separate versions for:

- Internal application services.
- Domain entities.
- Repositories.
- Database models.
- Internal worker functions.
- Internal module interfaces.

Internal code should evolve through normal refactoring and compatibility practices.

---

## 6. API Structure

A typical API structure is:

```text
apps/web
└── API routes
    └── /api/v1
        ├── stores
        ├── products
        ├── inventory
        ├── customers
        ├── carts
        ├── checkout
        ├── payments
        └── orders
```

The exact filesystem organization may follow Next.js routing conventions, but the externally visible contract must remain clear.

---

## 7. Business-Capability APIs

API endpoints should be organized around business capabilities.

Prefer:

```text
POST /api/v1/products
POST /api/v1/carts
POST /api/v1/checkout
POST /api/v1/orders
```

over exposing database tables directly.

The API represents business operations rather than the database schema.

---

## 8. Backward-Compatible Changes

The following changes are generally backward-compatible:

- Adding an optional request field.
- Adding a new endpoint.
- Adding a new response field when clients tolerate unknown fields.
- Adding a new pagination option.
- Adding a new resource.
- Adding new optional metadata.

Compatibility should still be verified against actual consumers.

---

## 9. Breaking Changes

The following are potentially breaking:

- Removing a response field.
- Renaming a response field.
- Changing a field's type.
- Changing an existing field's meaning.
- Making an optional request field mandatory.
- Removing an endpoint.
- Changing authentication requirements.
- Changing error semantics relied upon by clients.
- Changing pagination semantics incompatibly.

Breaking changes require explicit review.

---

## 10. Major Version Changes

A new major version should be introduced only when compatibility cannot reasonably be maintained.

Example:

```text
/api/v1/products
/api/v2/products
```

A major version should represent a deliberate contract change rather than an implementation refactor.

---

## 11. Version Lifecycle

When a new API version is introduced:

```text
Design
  ↓
Implement
  ↓
Test
  ↓
Document
  ↓
Release
  ↓
Migrate consumers
  ↓
Deprecate old version
  ↓
Remove old version
```

The old version should not be removed immediately unless there are no supported consumers.

---

## 12. Deprecation

When an API is deprecated:

- Document the replacement.
- Identify affected consumers.
- Define a migration period where appropriate.
- Avoid silently changing behavior.
- Remove the old version only after the supported migration process.

Deprecation policy should be appropriate to the actual consumers of the platform.

---

## 13. Internal API Stability

Internal module interfaces are not automatically public APIs.

Internal interfaces may evolve when:

- All consumers are updated.
- Tests are updated.
- Module boundaries remain valid.
- No external contract is broken.

Do not add public API versioning to internal interfaces unnecessarily.

---

## 14. Request Contracts

Each endpoint should define:

- HTTP method.
- Path.
- Authentication requirement.
- Authorization requirement.
- Tenant context.
- Request parameters.
- Request body.
- Validation rules.
- Idempotency requirements.
- Success response.
- Error responses.

Example:

```text id="7d4qk2"
POST /api/v1/products

Authentication:
Required

Authorization:
Store Admin/Owner/authorized Staff

Tenant:
Store resolved from authenticated context

Request:
Product creation DTO

Response:
201 Created

Errors:
400 Validation Error
401 Authentication Required
403 Forbidden
409 Conflict
```

---

## 15. Response Contracts

Responses should use explicit DTOs.

Do not expose database entities directly.

A response should contain only the fields intended for the API consumer.

This prevents database implementation details from becoming accidental API contracts.

---

## 16. API DTOs

DTOs should be separated from:

- Database models.
- ORM models.
- Domain aggregates.
- Provider SDK objects.

The mapping should be deliberate.

Example:

```text id="k8n3p5"
Database record
      ↓
Domain/application model
      ↓
API response DTO
```

This separation allows internal implementation to evolve without automatically changing the API.

---

## 17. Error Contract

All versioned APIs should use the documented error contract.

A typical error response should include:

```json id="1q7m3z"
{
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Product not found",
    "requestId": "..."
  }
}
```

The exact schema is defined by:

```text
docs/api/error-contract.md
```

Clients should rely on stable error codes rather than parsing human-readable messages.

---

## 18. Validation

API requests must be validated before entering application services.

Validation should cover:

- Required fields.
- Types.
- Formats.
- Ranges.
- Enumerations.
- Identifier formats.
- Quantity limits.
- Money values.
- Date ranges.

Invalid requests should fail consistently.

---

## 19. Authentication

Protected API endpoints must require the project's authentication mechanism.

Authentication establishes identity.

Authorization determines whether that identity may perform the requested operation.

These responsibilities must remain separate.

---

## 20. Tenant Context

Store-scoped APIs must establish tenant context before accessing store-owned data.

The server must derive trusted tenant context from authenticated membership and request routing.

A client-provided identifier must not bypass tenant authorization.

---

## 21. Idempotency

Operations with externally visible side effects should support idempotency where appropriate.

Typical candidates include:

```text id="x6q9m2"
checkout completion
payment creation
payment capture
refund
order creation
webhook processing
```

The API should define which operations accept idempotency keys.

Idempotency behavior must be documented as part of the endpoint contract.

---

## 22. HTTP Semantics

Use HTTP methods consistently:

```text id="v2r8k4"
GET     read
POST    create/action
PUT     full replacement where appropriate
PATCH   partial update where supported
DELETE  deletion/archive where appropriate
```

The chosen method should reflect the operation's semantics.

Do not use `POST` for every operation merely because it is convenient.

---

## 23. Status Codes

Use meaningful HTTP status codes.

Typical examples:

| Status | Meaning |
|---|---|
| `200` | Successful request |
| `201` | Resource created |
| `202` | Accepted for asynchronous processing |
| `204` | Successful request with no response body |
| `400` | Invalid request |
| `401` | Authentication required |
| `403` | Insufficient permission |
| `404` | Resource not found |
| `409` | Conflict |
| `422` | Semantically invalid request where applicable |
| `429` | Rate limited |
| `500` | Unexpected server failure |
| `502`/`503` | External/dependency availability failure where appropriate |

The API should avoid using status codes inconsistently.

---

## 24. Pagination

Collection endpoints should use the project's documented pagination strategy.

Pagination must define:

- Page or cursor semantics.
- Default limits.
- Maximum limits.
- Ordering.
- Filters.
- Stable results where possible.

Do not allow unbounded collection queries.

The detailed pagination contract is defined in:

```text
docs/api/pagination-and-filtering.md
```

---

## 25. Filtering and Sorting

Filtering and sorting must be explicitly supported by each endpoint.

Do not expose arbitrary database query expressions.

Allowed fields and operators should be defined by the endpoint.

User-provided sort or filter fields must be validated against an allowlist.

---

## 26. API Documentation

Public API contracts should be documented using the project's API documentation strategy.

OpenAPI should describe:

- Endpoints.
- Request schemas.
- Response schemas.
- Authentication.
- Errors.
- Pagination.
- Idempotency.
- Webhooks where applicable.

Documentation should reflect actual behavior.

---

## 27. Webhooks

Webhook endpoints are part of the external contract but have different trust and authentication characteristics.

Webhook APIs must define:

- Provider.
- Endpoint.
- Signature verification.
- Required headers.
- Event identifiers.
- Payload format.
- Idempotency behavior.
- Response behavior.

See:

```text
docs/api/webhook-contracts.md
```

---

## 28. API Security

All API endpoints must consider:

- Authentication.
- Authorization.
- Tenant isolation.
- Input validation.
- Rate limiting where required.
- Sensitive data exposure.
- Error exposure.
- CSRF considerations where applicable.
- Idempotency.
- Auditability for sensitive operations.

Security must not depend on frontend behavior.

---

## 29. API Performance

The Demo should optimize only where real bottlenecks exist.

Basic requirements include:

- Appropriate database indexes.
- Bounded collection queries.
- Efficient joins.
- Avoidance of N+1 queries.
- Reasonable response payloads.

Do not introduce caching or distributed infrastructure without a demonstrated need.

---

## 30. API Compatibility Testing

Changes to public APIs should include tests covering:

- Request validation.
- Authentication.
- Authorization.
- Tenant isolation.
- Success responses.
- Error responses.
- Idempotency where applicable.
- Pagination where applicable.
- Backward compatibility when modifying existing contracts.

---

## 31. API Evolution Rules

When changing an endpoint:

1. Determine whether the change is breaking.
2. Prefer a backward-compatible change.
3. Update API documentation.
4. Update automated tests.
5. Update affected consumers.
6. Introduce a new major version only when necessary.

Do not create a new version merely to avoid updating an implementation.

---

## 32. Demo-to-V1 Evolution

The Demo should establish stable business-oriented API boundaries without building unnecessary API infrastructure.

V1 may later introduce:

- More explicit API products.
- Dedicated API applications.
- API gateways.
- Advanced rate limiting.
- API keys.
- Partner APIs.
- More sophisticated version lifecycle management.

These should be added when actual requirements justify them.

---

## 33. API Versioning Checklist

Before releasing an API change:

```text
[ ] Endpoint behavior is defined
[ ] Authentication is defined
[ ] Authorization is defined
[ ] Tenant context is defined
[ ] Request validation exists
[ ] Response DTO is explicit
[ ] Error contract is followed
[ ] Idempotency is considered
[ ] Pagination is bounded where applicable
[ ] Security implications are reviewed
[ ] Tests are updated
[ ] OpenAPI/documentation is updated
[ ] Compatibility impact is understood
[ ] No unnecessary version was introduced
```