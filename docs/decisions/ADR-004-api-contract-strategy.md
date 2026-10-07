# ADR-004: API Contract Strategy

## Status

**Accepted**

## Date

2026-10-07

## Decision

The platform will use **versioned, business-capability-oriented HTTP APIs with explicit request/response contracts**, validated at the API boundary and documented through OpenAPI.

The Demo will expose the primary API under:

```text
/api/v1/*
```

The API layer will remain thin. Business rules will live in application/domain modules rather than route handlers.

---

## 1. Context

The Shopify-like platform requires APIs for:

- Store management.
- Product management.
- Inventory.
- Customers.
- Carts.
- Discounts.
- Checkout.
- Payments.
- Orders.
- Storefront operations.
- Webhooks.
- Internal application workflows.

The platform must support a real Demo while remaining capable of evolving into V1 without forcing a fundamental API redesign.

Several approaches were considered:

1. Unversioned APIs.
2. Versioned REST-style HTTP APIs.
3. GraphQL-first architecture.
4. Direct database-backed API generation.
5. Separate APIs for every domain module.

The platform needs predictable contracts, clear authorization boundaries, strong validation, and straightforward debugging.

---

## 2. Decision Drivers

The decision is based on:

- API stability.
- Clear contracts.
- Tenant isolation.
- Authorization.
- Ease of implementation.
- Ease of testing.
- Documentation.
- Debuggability.
- Idempotency support.
- Webhook compatibility.
- Demo simplicity.
- V1 evolution.
- AI-assisted development safety.

---

## 3. Chosen Approach

The platform will use versioned HTTP APIs.

The primary Demo API namespace is:

```text
/api/v1/
```

Examples:

```text
/api/v1/stores
/api/v1/products
/api/v1/inventory
/api/v1/customers
/api/v1/carts
/api/v1/checkout
/api/v1/payments
/api/v1/orders
```

The exact endpoint structure is defined by the relevant API and feature specifications.

---

## 4. Business-Capability Orientation

Endpoints should represent business capabilities rather than exposing database tables mechanically.

Prefer:

```text
POST /api/v1/checkout/complete
```

when the operation represents a checkout completion use case.

Avoid designing the API as:

```text
POST /api/v1/checkout_items/update_database_row
```

The API should expose meaningful business operations.

---

## 5. API Layer Responsibilities

API handlers are responsible for:

- Receiving HTTP requests.
- Authenticating the request.
- Establishing tenant context.
- Authorizing the operation.
- Validating input.
- Calling application services.
- Mapping application results to DTOs.
- Returning standardized errors.

They should not contain substantial business logic.

---

## 6. Application Layer Responsibilities

Application services own use cases such as:

- Create product.
- Adjust inventory.
- Create cart.
- Apply discount.
- Start checkout.
- Complete checkout.
- Create payment.
- Create order.
- Transition order state.

Application services coordinate domain rules, repositories, transactions, and integrations.

---

## 7. Domain Layer Responsibilities

The domain layer owns business rules and invariants.

Examples:

- Product state transitions.
- Inventory availability rules.
- Discount eligibility.
- Checkout rules.
- Payment state transitions.
- Order state transitions.

The HTTP API must not become the source of truth for these rules.

---

## 8. Explicit DTOs

API request and response models must be explicit.

Database models must not automatically become public API contracts.

Example:

```text id="8f6j2a"
Database Model
      ↓
Application Mapping
      ↓
API DTO
      ↓
HTTP Response
```

This prevents internal schema changes from unintentionally becoming public API changes.

---

## 9. Request Validation

All externally supplied API input must be validated at the boundary.

Validation should cover:

- Required fields.
- Data types.
- Formats.
- Lengths.
- Enumerations.
- Numeric ranges.
- Arrays.
- Nested structures.
- Pagination.
- Filtering.
- Sorting.

Business validation remains the responsibility of the application/domain layer.

---

## 10. Authentication

Authenticated API requests must establish the server-side identity of the caller.

The server must not trust:

- User IDs supplied by clients.
- Store IDs supplied by clients without authorization checks.
- Role values supplied by clients.
- Tenant identifiers as proof of membership.

Authentication and authorization are separate concerns.

---

## 11. Tenant Context

Every tenant-sensitive API operation must resolve its authorized tenant/store context.

Conceptually:

```text id="x7h3s1"
Request
  ↓
Authenticated Identity
  ↓
Membership / Customer Context
  ↓
Authorized Store
  ↓
Application Service
```

Tenant context must be enforced server-side.

---

## 12. Authorization

Authorization must occur before performing tenant-sensitive operations.

Examples:

```text
products.create
products.update
inventory.adjust
orders.read
orders.update
stores.manage
```

Permissions are enforced according to the authorization model.

A user having a valid session does not automatically have permission to perform every operation.

---

## 13. Resource-Level Authorization

Authorization must be applied to the actual resource.

For example:

```text
GET /api/v1/orders/{orderId}
```

must verify that the authenticated caller is authorized to access that specific order.

Knowing an order ID is not sufficient.

---

## 14. Tenant-Safe Not Found Behavior

Where appropriate, unauthorized access to a resource should appear as a safe not-found response.

This reduces resource enumeration and prevents disclosure of another tenant's resource existence.

The exact error behavior must follow the API error contract.

---

## 15. Versioning

The API uses major URL versioning:

```text
/api/v1/
```

Breaking changes should require a deliberate version change.

Example:

```text
/api/v1/products
/api/v2/products
```

Minor compatible changes should not unnecessarily create new API versions.

---

## 16. Breaking Changes

Examples of breaking changes include:

- Removing a response field clients rely on.
- Changing field meaning.
- Changing a field type incompatibly.
- Removing an endpoint.
- Changing required request fields.
- Changing authentication requirements.
- Changing semantics of a successful operation.

Breaking changes require deliberate migration planning.

---

## 17. Backward-Compatible Changes

Examples include:

- Adding optional response fields.
- Adding new endpoints.
- Adding optional request fields.
- Adding new non-breaking enum values where clients tolerate them.

Compatibility must still be evaluated for the actual client ecosystem.

---

## 18. Response Structure

Responses should use stable DTOs.

Successful responses should be predictable.

Collection endpoints should provide consistent pagination metadata according to the API pagination strategy.

Errors should follow:

```text id="1xj4m0"
{
  "error": {
    "code": "machine_readable_code",
    "message": "Human-readable message",
    "requestId": "request-id",
    "details": {}
  }
}
```

The exact fields may vary where a specific endpoint requires additional information.

---

## 19. Error Codes

Error codes must be stable and machine-readable.

Examples:

```text id="q2w9t5"
AUTHENTICATION_REQUIRED
FORBIDDEN
RESOURCE_NOT_FOUND
VALIDATION_ERROR
CONFLICT
IDEMPOTENCY_CONFLICT
INSUFFICIENT_INVENTORY
CHECKOUT_NOT_AVAILABLE
PAYMENT_FAILED
INVALID_WEBHOOK
```

Codes should represent meaningful application conditions rather than implementation-specific exceptions.

---

## 20. HTTP Status Codes

The API should use standard HTTP semantics where practical.

Examples:

| Situation | Status |
|---|---:|
| Successful read | `200` |
| Successful creation | `201` |
| Successful operation with no body | `204` |
| Invalid request | `400` |
| Authentication required | `401` |
| Insufficient permission | `403` |
| Resource unavailable to caller | `404` |
| Business/resource conflict | `409` |
| Validation failure | `422` where appropriate |
| Rate limited | `429` |
| Unexpected server failure | `500` |

The API must remain consistent.

---

## 21. Idempotency

Critical mutation endpoints must support idempotency where repeated requests could produce duplicate effects.

Examples include:

- Checkout completion.
- Payment creation.
- Order creation.
- External provider operations.

Idempotency behavior must be defined explicitly for each applicable endpoint.

---

## 22. Idempotency Key

Where supported, clients provide an idempotency key through a documented request mechanism.

The server must define:

- Scope.
- Validity period.
- Request matching.
- Stored result.
- Conflict behavior.
- Retry behavior.

A reused key with a materially different request must not silently produce an unrelated result.

---

## 23. Pagination

Collection endpoints must not return unbounded datasets.

Pagination should:

- Use a bounded page size.
- Prefer cursor-based pagination for primary APIs.
- Enforce a maximum page size.
- Use deterministic ordering.
- Respect tenant boundaries.

The detailed pagination contract is defined in:

`docs/api/pagination-and-filtering.md`

---

## 24. Filtering

Filtering must use explicitly supported fields.

Clients must not be able to provide arbitrary SQL expressions or raw query fragments.

Example:

```text
GET /api/v1/products?status=active
```

is acceptable when `status` is an explicitly supported filter.

---

## 25. Sorting

Sorting fields must be allowlisted.

Example:

```text
sort=createdAt
```

must map to known application/database behavior.

Arbitrary SQL ordering must never be accepted from clients.

---

## 26. API Documentation

The API should be documented using OpenAPI.

The specification should describe:

- Endpoints.
- Methods.
- Authentication.
- Request schemas.
- Response schemas.
- Error responses.
- Pagination.
- Idempotency.
- Webhooks.
- Important examples.

The OpenAPI contract should evolve with the implemented API.

---

## 27. Contract and Implementation Consistency

The API specification must not become fictional documentation.

When an endpoint changes:

```text
Implementation
       +
OpenAPI
       +
Tests
```

must remain consistent.

CI may later validate the OpenAPI contract against the implementation.

---

## 28. Webhooks

Webhook endpoints are API boundaries for untrusted external systems.

They must:

- Validate signatures.
- Validate event structure.
- Protect against replay.
- Persist event identity.
- Handle duplicate delivery.
- Resolve the correct tenant safely.
- Validate important business fields.
- Process events idempotently.

Webhook contracts are defined separately in:

`docs/api/webhook-contracts.md`

---

## 29. External Provider Adapters

External payment or service-provider APIs must not leak provider-specific contracts throughout the application.

Use adapters such as:

```text id="q0v7hp"
Application Service
      ↓
Provider Interface
      ↓
Payment Adapter
      ↓
External Provider
```

This keeps provider-specific behavior isolated.

---

## 30. Internal APIs

Internal module communication should not automatically become HTTP calls.

Inside the modular monolith, modules should normally communicate through:

- Application interfaces.
- Domain events.
- Explicit module contracts.

HTTP should be introduced when there is an actual process/service boundary.

---

## 31. API Security

API implementation must protect against:

- Authentication bypass.
- Authorization bypass.
- IDOR.
- Cross-tenant access.
- Injection.
- Malformed input.
- Excessive request sizes.
- Enumeration.
- Replay attacks.
- Duplicate mutation.
- Sensitive-data exposure.

Security controls must be enforced server-side.

---

## 32. API Logging

API logs should include useful operational context such as:

- Request ID.
- Route.
- Method.
- Status.
- Duration.
- Relevant tenant context where safe.
- Error code.

Logs must not contain:

- Passwords.
- Session secrets.
- Payment secrets.
- Authorization tokens.
- Sensitive customer data unnecessarily.

---

## 33. API Testing

Each important API endpoint should have appropriate tests covering:

- Valid requests.
- Validation failures.
- Authentication.
- Authorization.
- Tenant isolation.
- Business conflicts.
- Idempotency.
- Error mapping.
- Response shape.

Critical endpoints should also receive E2E coverage.

---

## 34. API Evolution Toward V1

The Demo API should establish stable domain boundaries without prematurely introducing multiple independent services.

Future V1 architecture may introduce:

```text
Admin API
Storefront API
Internal API
```

or separate deployable services where justified.

The Demo API contracts should therefore avoid exposing internal implementation details that would make future separation unnecessarily difficult.

---

## 35. Rejected Alternatives

### Unversioned API

Rejected because breaking changes would become difficult to manage safely.

### GraphQL-first

Rejected for the Demo because it introduces additional schema, resolver, authorization, caching, and operational complexity without a demonstrated requirement.

GraphQL may be evaluated later if client requirements justify it.

### Database-generated API

Rejected because database schemas are internal persistence structures, not appropriate public business contracts.

### One API per module

Rejected because the Demo uses a modular monolith. Module boundaries do not require independent network services.

---

## 36. Consequences

### Positive

- Predictable API contracts.
- Easier client integration.
- Strong validation boundaries.
- Clear authorization.
- Easier testing.
- Easier debugging.
- Straightforward webhook support.
- Controlled API evolution.
- Compatible with future service extraction.

### Negative

- DTO mapping introduces additional code.
- OpenAPI requires maintenance.
- Versioning requires discipline.
- API compatibility must be actively managed.

These costs are accepted because API stability is important to the platform.

---

## 37. Implementation Rules

API implementations must:

1. Use `/api/v1/*`.
2. Keep route handlers thin.
3. Validate external input.
4. Resolve authentication server-side.
5. Resolve tenant context server-side.
6. Enforce authorization.
7. Call application services.
8. Return explicit DTOs.
9. Use standardized errors.
10. Support idempotency where required.
11. Apply bounded pagination.
12. Document public contracts.
13. Add appropriate tests.
14. Avoid leaking internal database structures.

---

## 38. Definition of Done

The API contract strategy is considered implemented when:

```text
[ ] /api/v1 namespace exists
[ ] Business-capability endpoints are defined
[ ] API handlers are thin
[ ] Request validation exists
[ ] Authentication is enforced
[ ] Tenant context is enforced
[ ] Authorization is enforced
[ ] DTOs are explicit
[ ] Error contract is consistent
[ ] Pagination is bounded
[ ] Idempotency is implemented where required
[ ] Webhook contracts are protected
[ ] OpenAPI documentation exists
[ ] API tests cover security boundaries
[ ] Breaking changes require deliberate versioning
[ ] Internal module boundaries are not replaced by unnecessary HTTP calls
```