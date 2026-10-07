# API Architecture

## 1. Purpose

This document defines the API architecture for the commerce platform.

It establishes:

- API responsibilities.
- Request processing flow.
- Authentication.
- Tenant resolution.
- Authorization.
- Input validation.
- Application-service boundaries.
- Response conventions.
- Error handling.
- Idempotency.
- Webhook handling.
- API-to-domain interaction.
- API security requirements.
- API evolution principles.

The API layer is an entry point into the application.

It is **not** the owner of business logic.

---

# 2. API Architecture Principles

The API layer follows these principles:

1. Keep request handlers thin.
2. Authenticate requests before protected operations.
3. Resolve tenant context server-side.
4. Authorize every protected operation.
5. Validate untrusted input.
6. Delegate business operations to application services.
7. Keep domain rules inside domain modules.
8. Keep database access outside presentation handlers.
9. Return consistent responses and errors.
10. Make retry-sensitive operations idempotent.
11. Never trust client-provided authorization claims.
12. Protect webhook endpoints independently.
13. Avoid exposing internal implementation details.

---

# 3. API Position in the Architecture

The API sits between external clients and the application/domain layers.

```text id="d8f0h7"
Client
  ↓
API / Request Handler
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
Domain Module
  ↓
Persistence / Integration
```

The API coordinates request processing.

The domain determines whether the requested business operation is valid.

---

# 4. API Types

The platform may expose several categories of API operations.

## Merchant APIs

Used by merchant users to manage:

- Stores.
- Products.
- Inventory.
- Customers.
- Discounts.
- Orders.

## Customer APIs

Used by customers for:

- Account operations.
- Cart operations.
- Checkout.
- Orders.
- Customer-specific information.

## Storefront APIs

Used by public storefront clients for:

- Store information.
- Published products.
- Product details.
- Cart operations.
- Checkout.

## Webhook APIs

Used by external providers to notify the platform of events.

Examples:

- Payment events.
- Other integration events.

---

# 5. API Boundary

API handlers should perform request-level responsibilities.

A handler may:

```text id="4x7v2w"
Receive request
Validate request shape
Authenticate
Resolve context
Authorize
Call application service
Map result to response
```

A handler should not contain:

```text id="x2h9a3"
Complex pricing rules
Inventory algorithms
Payment state transitions
Order business rules
Direct database mutations
```

Those responsibilities belong to application/domain layers.

---

# 6. Request Pipeline

A protected request follows:

```text id="f2m7w8"
Request
  ↓
Request Parsing
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
Persistence / Integration
  ↓
Response Mapping
```

The order may vary for specific endpoint types, but the security invariants remain unchanged.

---

# 7. Authentication

Authentication determines the identity associated with a request.

The authentication layer may establish:

```text id="q5j2n4"
User ID
Session / Token
Authentication State
```

Authentication does not determine whether the user is allowed to access a particular resource.

That decision belongs to authorization.

---

# 8. Authorization

Authorization determines whether the authenticated actor may perform the requested operation.

A protected operation may require checking:

```text id="6xq2h8"
Authenticated User
      ↓
Organization Membership
      ↓
Store Membership
      ↓
Role / Permission
      ↓
Resource Ownership
      ↓
Requested Action
```

Authorization must be performed server-side.

---

# 9. Tenant Resolution

Store-owned requests must execute within a resolved tenant context.

The server determines the appropriate store from trusted context such as:

- Authenticated membership.
- Valid session context.
- Authorized route/resource relationship.
- Trusted storefront configuration.

A client-provided `storeId` must not automatically establish authorization.

For example:

```text id="x8r1pq"
POST /api/orders

{
  "storeId": "store_123"
}
```

does not prove that the caller may operate on `store_123`.

The server must independently verify access.

---

# 10. Resource Authorization

Knowing a valid store does not automatically authorize access to every resource.

For example:

```text id="8h9p4z"
User
 ↓
Store A
 ↓
Product B
```

requires verification that Product B belongs to Store A or is otherwise legitimately accessible.

Resource ownership must be enforced server-side.

---

# 11. Input Validation

All untrusted API input must be validated.

Inputs may include:

- JSON bodies.
- Query parameters.
- Path parameters.
- Headers.
- Cookies.
- Webhook payloads.

Validation should establish:

- Required fields.
- Data types.
- Allowed values.
- Length limits.
- Numeric boundaries.
- Format requirements.
- Business-level input constraints where appropriate.

Validation is not a replacement for domain rules.

---

# 12. Validation Layers

Validation occurs at multiple levels.

## API Validation

Checks request shape.

Example:

```text id="1a8p5d"
quantity must be an integer
quantity must be greater than zero
```

## Domain Validation

Checks business rules.

Example:

```text id="0o7m4e"
Requested quantity
    ≤
Allowed inventory
```

Both are required where applicable.

---

# 13. Application Services

API handlers should invoke application services for business operations.

Example:

```text id="6q8g3v"
POST /api/products
        ↓
ProductApplicationService.createProduct(...)
        ↓
Products Domain
```

The application service coordinates:

- Domain operations.
- Transactions.
- Cross-module calls.
- External integrations.
- Events where appropriate.

---

# 14. API and Domain Separation

The API layer should not directly instantiate or manipulate domain internals.

Incorrect:

```text id="8z1y6w"
API Handler
   ↓
Direct Repository
   ↓
Database
```

Preferred:

```text id="x6v9q4"
API Handler
   ↓
Application Service
   ↓
Domain
   ↓
Repository
   ↓
Database
```

This separation keeps business behavior reusable from:

- Web requests.
- Background jobs.
- Webhooks.
- Other application entry points.

---

# 15. Response Mapping

API responses should expose stable application-level representations.

Internal database models should not automatically become public API contracts.

For example:

```text id="j5w4k1"
Database Entity
      ↓
Application Result
      ↓
API Response DTO
```

This prevents internal schema changes from unnecessarily becoming API-breaking changes.

---

# 16. Response Structure

Responses should be consistent within the API.

Successful responses should provide the data required by the client without exposing unnecessary internal information.

Error responses should provide:

- Machine-readable error code.
- Human-readable message where appropriate.
- Request/correlation identifier when useful.

Internal stack traces, SQL errors, provider credentials, and other sensitive implementation details must not be returned to clients.

---

# 17. Error Categories

The API should distinguish between common failure categories.

Examples include:

### Authentication Error

The caller is not authenticated.

### Authorization Error

The caller is authenticated but lacks permission.

### Validation Error

The request is malformed or invalid.

### Not Found

The requested resource does not exist or is not accessible.

### Conflict

The operation conflicts with current state.

Examples:

- Duplicate resource.
- Invalid state transition.
- Concurrency conflict.

### Business Rule Error

The request violates a domain rule.

### External Dependency Error

An external provider failed or was unavailable.

### Internal Error

An unexpected server-side failure occurred.

---

# 18. Security Through Error Handling

Errors must not reveal sensitive information.

For example, an unauthorized user should not receive:

```text id="d8x7t1"
Product exists in Store A,
but you are not a member of Store A.
```

when such a response could expose tenant information.

The API should return an appropriately generic response where resource existence itself is sensitive.

---

# 19. Idempotency

Operations that may safely be retried must define idempotency behavior.

This is especially important for:

- Checkout completion.
- Payment creation.
- Payment webhooks.
- Order creation.
- Inventory operations where applicable.

A typical request may contain:

```text id="r8p5y2"
Idempotency-Key
```

The server uses the key to prevent unintended duplicate effects.

---

# 20. Idempotency Lifecycle

Conceptually:

```text id="1n7m5v"
Request
  ↓
Idempotency Key
  ↓
Lookup Existing Operation
  │
  ├── Exists → Return Existing Result
  │
  └── New
       ↓
   Execute Operation
       ↓
   Persist Result
       ↓
   Return Result
```

The exact implementation belongs to the relevant application/domain design.

---

# 21. Concurrency

The API must not assume requests arrive sequentially.

Concurrent requests may target:

- The same product.
- The same inventory.
- The same cart.
- The same order.
- The same payment.
- The same discount.

Critical concurrency rules must be enforced in application/domain/database layers.

API-level checks alone are insufficient.

---

# 22. Public Storefront APIs

Public storefront operations have a different trust model.

A storefront request may be unauthenticated.

However, the server must still determine:

```text id="m0g4dr"
Store
  ↓
Published Resource
  ↓
Allowed Operation
```

Public APIs must expose only data intended for public consumption.

Draft products, private customer data, internal payment information, and merchant-only configuration must not leak through storefront endpoints.

---

# 23. Merchant APIs

Merchant APIs require authenticated merchant identity and authorization.

A merchant request should establish:

```text id="6c5w9z"
User
 ↓
Organization
 ↓
Store
 ↓
Role / Permission
 ↓
Resource
 ↓
Action
```

For example, a Staff user may be permitted to update inventory but not transfer store ownership.

---

# 24. Customer APIs

Customer operations must remain scoped to the authenticated customer where applicable.

For example:

```text id="h6m3p9"
GET /api/orders/order_123
```

must verify that the authenticated customer is authorized to view `order_123`.

Knowing the order ID is not authorization.

---

# 25. Webhooks

Webhook endpoints are treated as external system entry points.

The processing flow is:

```text id="9f6j1r"
Provider
  ↓
Webhook Endpoint
  ↓
Signature Verification
  ↓
Payload Validation
  ↓
Idempotency Check
  ↓
Application Service
  ↓
Domain State Transition
```

Webhook endpoints must not blindly trust incoming requests.

---

# 26. Webhook Authentication

Where the provider supports it, webhook authenticity should be verified using mechanisms such as:

- Signature verification.
- Shared secrets.
- Provider-specific verification methods.

A webhook must not modify business state before authenticity is established.

---

# 27. Webhook Idempotency

Webhook delivery may occur more than once.

The API must assume:

```text id="3v0q5e"
Webhook
Webhook
Webhook
```

may represent the same external event.

Processing must therefore be idempotent.

Repeated delivery must not result in:

- Duplicate orders.
- Duplicate payment captures.
- Duplicate inventory changes.
- Duplicate notifications.

---

# 28. API Transactions

The API layer should not define arbitrary transaction boundaries.

Transactions belong around business operations.

For example:

```text id="3e9w5u"
Checkout Application Service
        ↓
Transaction
        ├── Validate required state
        ├── Update required domain state
        └── Persist transaction result
```

The API simply invokes the operation.

---

# 29. External Integrations

API handlers should not directly contain provider-specific business logic.

For example:

```text id="5c9t8x"
API
 ↓
Payment Application Service
 ↓
Payment Provider Interface
 ↓
Provider Adapter
 ↓
External Provider
```

This keeps external provider details isolated from API contracts and domain logic.

---

# 30. Pagination

Collection APIs should use a consistent pagination strategy.

Pagination must:

- Be deterministic.
- Avoid accidental unbounded queries.
- Support appropriate limits.
- Validate requested limits.
- Avoid exposing excessive data.

The specific pagination mechanism can be selected based on the expected data volume and API requirements.

---

# 31. Filtering and Sorting

Filtering and sorting must be explicitly supported by an endpoint.

Clients must not be allowed to construct arbitrary database queries.

For example:

```text id="p5k8w4"
?sort=createdAt
```

may be valid if `createdAt` is an allowed field.

The server should reject unsupported or unsafe query fields.

---

# 32. Rate Limiting

Rate limiting may be applied to public and sensitive endpoints.

Higher-risk operations may require stricter controls.

Potential targets include:

- Authentication endpoints.
- Password/reset operations.
- Public APIs.
- Checkout endpoints.
- Payment operations.
- Webhook endpoints where appropriate.

The Demo may use basic controls, with more advanced rate limiting introduced if required.

---

# 33. Observability

API requests should support operational tracing through appropriate identifiers.

Useful information includes:

- Request ID.
- Correlation ID.
- Endpoint.
- Method.
- Response status.
- Duration.
- Relevant tenant/store context.
- Error category.

Sensitive data must not be logged unnecessarily.

---

# 34. Logging Rules

Logs must not contain:

- Passwords.
- Authentication secrets.
- Payment credentials.
- Access tokens.
- Sensitive customer information unnecessarily.
- Full payment card data.
- Webhook secrets.

Logs should provide enough context to diagnose failures without becoming a second database full of secrets.

---

# 35. API Versioning

The Demo does not require premature multi-version API infrastructure.

However, APIs should be designed with stable contracts.

Breaking changes should be deliberate.

When V1 requires versioning, options may include:

```text id="z8b1p4"
 /api/v1/...
```

or another explicit versioning strategy.

The chosen mechanism should be documented before introduction.

---

# 36. Internal vs Public APIs

Not every application service must become a public API endpoint.

Internal operations may remain internal.

For example:

```text id="m4c6n8"
Worker
  ↓
Order Application Service
```

does not require:

```text id="w5j7k2"
HTTP Request
  ↓
Order API
```

The API is one application entry point, not the only way business logic may execute.

---

# 37. Background Processing

Background jobs should reuse application/domain services.

Example:

```text id="j3s6w0"
Worker Job
  ↓
Payment Service
  ↓
Payments Domain
```

The worker should not bypass the API layer merely because it is internal.

This also avoids duplicating business logic.

---

# 38. API Security Requirements

All protected API operations must:

- Authenticate the caller.
- Resolve tenant context.
- Authorize the operation.
- Validate input.
- Enforce resource ownership.
- Protect against duplicate operations where necessary.
- Avoid leaking sensitive information.
- Use secure transport in deployed environments.
- Keep secrets outside source code.

---

# 39. Anti-Patterns

The following patterns are prohibited:

### Fat Route Handler

Business logic lives inside HTTP handlers.

### Direct Database API

Handlers directly mutate database tables.

### Client-Controlled Authorization

Client claims determine permissions.

### ID-Only Authorization

Possession of a resource ID grants access.

### Unverified Webhook

Webhook modifies state before verification.

### Duplicate Business Logic

API and domain layers implement competing rules.

### Provider Leakage

External provider SDK types become public API contracts.

### Unbounded Queries

Endpoints allow unrestricted data retrieval.

### Sensitive Error Leakage

Internal errors are returned directly to clients.

---

# 40. API Flow Examples

## Create Product

```text id="l4p6s2"
Merchant Request
      ↓
Authenticate
      ↓
Resolve Store
      ↓
Authorize Product Creation
      ↓
Validate Input
      ↓
Products Application Service
      ↓
Products Domain
      ↓
PostgreSQL
      ↓
Response
```

---

## Add Cart Item

```text id="q1k5d9"
Customer Request
      ↓
Authenticate / Resolve Session
      ↓
Resolve Store
      ↓
Validate Product
      ↓
Cart Application Service
      ↓
Carts Domain
      ↓
Persistence
      ↓
Response
```

---

## Complete Checkout

```text id="u8j2c4"
Checkout Request
      ↓
Authenticate / Resolve Customer
      ↓
Resolve Store
      ↓
Authorize
      ↓
Validate
      ↓
Checkout Application Service
      ↓
Inventory
      ↓
Discounts
      ↓
Payments
      ↓
Orders
      ↓
Transaction / Required State
      ↓
Response
```

---

## Payment Webhook

```text id="e7s1v9"
Payment Provider
      ↓
Webhook Endpoint
      ↓
Verify Signature
      ↓
Validate Payload
      ↓
Check Idempotency
      ↓
Payments Application Service
      ↓
Payment State Transition
      ↓
PostgreSQL
      ↓
Secondary Events
```

---

# 41. API Design Rules for AI Agents

AI coding agents working on APIs must:

1. Read the root `AGENTS.md`.
2. Read relevant architecture documentation.
3. Read the relevant feature specification.
4. Identify the owning domain.
5. Reuse existing application services and patterns.
6. Avoid adding business logic to handlers.
7. Avoid direct cross-module database access.
8. Preserve tenant and authorization checks.
9. Add or update tests for changed behavior.
10. Avoid introducing new API conventions without architectural justification.

Agents must not invent endpoints merely because an internal operation exists.

---

# 42. Testing Requirements

API changes should include appropriate tests.

Testing should cover:

### Authentication

- Unauthenticated requests are rejected where required.

### Authorization

- Unauthorized users cannot perform protected actions.

### Tenant Isolation

- Cross-store access is rejected.

### Validation

- Invalid input is rejected safely.

### Business Rules

- Domain constraints are enforced.

### Idempotency

- Retries do not duplicate side effects.

### Webhooks

- Invalid signatures are rejected.
- Duplicate events are handled safely.

### Errors

- Correct error categories and safe responses are returned.

---

# 43. Evolution Toward V1

The Demo API architecture should support later growth without requiring a complete rewrite.

Possible V1 additions include:

- Dedicated API application.
- Separate storefront application.
- Separate merchant/admin application.
- API versioning.
- Advanced rate limiting.
- Distributed caching.
- API gateway capabilities.
- More comprehensive observability.
- Public developer APIs.

These should be introduced based on actual requirements.

---

# 44. Final Principle

The API is the **boundary through which requests enter the application**, not the place where the business architecture lives.

The governing flow is:

```text id="7z6k1w"
Request
  ↓
Authenticate
  ↓
Resolve Tenant
  ↓
Authorize
  ↓
Validate
  ↓
Application Service
  ↓
Domain
  ↓
Persistence / Integration
```

The governing rule is:

> **Keep HTTP thin, keep authorization server-side, and keep business truth inside the domain.**