# Web Bootstrap Implementation

## 1. Purpose

This document defines the concrete implementation required to bootstrap `apps/web` as the main Next.js application for the Demo.

The web application is responsible for:

- Merchant-facing interfaces.
- Customer-facing Storefront interfaces.
- HTTP/API presentation.
- Request context establishment.
- Authentication integration.
- Tenant and Store resolution.
- Application-service invocation.
- Error handling.
- Health and readiness endpoints.
- Server-side composition.

The web application must remain a presentation and composition layer. Domain business rules must remain inside their owning modules.

---

# 2. Web Application Location

The application lives at:

```text
apps/web/
```

Expected high-level structure:

```text
apps/web/
├── src/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── ...
├── public/
├── package.json
├── tsconfig.json
└── next.config.*
```

The exact Next.js structure may vary with the selected version and routing configuration.

---

# 3. Next.js Configuration

Configure Next.js for the Demo application.

Required:

- TypeScript.
- Strict type checking.
- Appropriate server/client boundaries.
- Production build support.
- Environment configuration.
- Static asset handling.
- API route support.

Avoid introducing framework-specific abstractions that duplicate existing application architecture.

---

# 4. Application Responsibilities

`apps/web` owns:

```text id="q8m4c7"
HTTP Request
      ↓
Request Context
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
Response
```

It does not own:

- Product business rules.
- Inventory rules.
- Checkout calculations.
- Payment state transitions.
- Order state transitions.
- Discount calculation.
- Domain persistence logic.

---

# 5. Routing Strategy

Use Next.js routing for:

- Merchant application pages.
- Storefront pages.
- API routes.

API routes should follow:

```text
/api/v1/*
```

Business capability should determine route organization.

Examples:

```text
/api/v1/stores
/api/v1/products
/api/v1/inventory
/api/v1/customers
/api/v1/carts
/api/v1/discounts
/api/v1/checkouts
/api/v1/payments
/api/v1/orders
```

Exact endpoints must follow their domain specifications.

---

# 6. Route Handler Responsibilities

A route handler should perform only boundary-level work.

Expected sequence:

```text id="m4x8c7"
Receive Request
      ↓
Parse Request
      ↓
Validate Input
      ↓
Authenticate
      ↓
Resolve Tenant / Store
      ↓
Authorize
      ↓
Invoke Application Service
      ↓
Map Result
      ↓
Return Response
```

A route handler must not contain complex domain calculations.

---

# 7. Request Context

Each protected request should establish the context required by the operation.

Typical context:

```text id="v7c3m8"
requestId
userId
organizationId
membershipId
storeId
role
```

Not every field is required for every request.

Public Storefront requests may have:

```text
requestId
storeId
```

without an authenticated user.

---

# 8. Request ID

Every request should receive a request identifier.

If the client provides an acceptable request identifier according to the API policy, it may be propagated safely.

Otherwise the application should generate one.

The identifier should be available to:

- Logs.
- Errors.
- Response headers where appropriate.
- Application context.

---

# 9. Authentication Integration

Protected routes must use the authentication package.

The web layer should:

1. Read the authentication session.
2. Validate the session.
3. Establish user identity.
4. Continue only when authentication requirements are satisfied.

Authentication failures must not expose sensitive details.

---

# 10. Tenant Resolution

Protected merchant routes must resolve the appropriate:

```text
Organization
Store
Membership
Role
```

before executing Store-owned operations.

Tenant context must not be inferred from untrusted request data without authorization checks.

---

# 11. Authorization

Authorization must occur server-side.

Example:

```text id="q5m8c7"
Authenticated User
        ↓
Membership
        ↓
Role
        ↓
Required Permission
        ↓
Application Service
```

The UI may hide unavailable actions, but UI restrictions are never the security boundary.

---

# 12. Public Storefront Resolution

Storefront requests require a different resolution model.

The web layer should resolve a public Store using an approved identifier such as:

- Store slug.
- Store domain.
- Other configured public identifier.

The resolved Store must be verified as publicly accessible.

Unpublished or inactive Stores must not expose protected storefront content.

---

# 13. API Response Mapping

Application services should return application/domain results.

The web layer converts these into API DTOs.

Do not expose database records directly.

Preferred:

```text id="x7m4c8"
Database Record
      ↓
Domain Model
      ↓
Application Result
      ↓
Response DTO
```

---

# 14. Error Handling

Unhandled errors must pass through centralized error handling.

The web layer should map known application errors to stable API responses.

Examples:

```text id="m8c4x7"
Validation Error      → 400
Authentication Error  → 401
Authorization Error   → 403
Not Found             → 404
Conflict              → 409
Rate Limit            → 429
Unexpected Error      → 500
```

Exact mappings must follow the API error contract.

---

# 15. Tenant-Safe Not Found

When a resource belongs to another tenant, the API must not reveal its existence.

For example:

```text id="v4m8c7"
Tenant A requests Tenant B product
        ↓
Safe not-found behavior
```

The web layer must preserve this behavior rather than converting it into a revealing authorization response.

---

# 16. Input Validation

All externally supplied input must be validated.

Validation applies to:

- JSON bodies.
- Query parameters.
- Path parameters.
- Headers where applicable.
- Form data.
- File metadata.
- Webhook payloads.

Validation must occur before business logic execution.

---

# 17. Request Size Limits

Configure reasonable request-size limits.

Different limits may apply to:

- JSON requests.
- Form submissions.
- File uploads.
- Webhook requests.

The application must reject excessively large requests before unnecessary processing.

---

# 18. File Upload Boundary

File uploads should not pass large binary data through application services unnecessarily.

The preferred flow is:

```text id="q6m4c8"
Client
  ↓
Upload Authorization
  ↓
Object Storage
  ↓
Media Metadata
  ↓
Product / Store Association
```

The exact direct-upload strategy may be implemented when Media functionality is introduced.

---

# 19. API Idempotency

The web layer should extract idempotency keys for operations that require them.

The key should be passed to the application service.

The web layer must not implement business-specific idempotency logic itself.

Example:

```text id="x8m3c7"
Idempotency-Key
      ↓
Request Context
      ↓
Application Service
      ↓
Persistence
```

---

# 20. Transaction Boundaries

The web layer must not manually coordinate database transactions around arbitrary HTTP code.

The application service owns the business transaction.

Preferred:

```text id="m7c4x8"
Route Handler
    ↓
Application Service
    ↓
Transaction
    ↓
Repositories
```

External API calls must not be placed inside long-running database transactions.

---

# 21. Server and Client Components

Next.js server/client boundaries must be explicit.

Server components should handle:

- Server-side data access.
- Protected data.
- Server-only configuration.
- Application-service composition.

Client components should handle:

- User interaction.
- Browser state.
- Interactive forms.
- Client-side UI behavior.

Sensitive server configuration must never be imported into client components.

---

# 22. Merchant Application

The merchant interface should provide the Demo workflows required by the product specification.

Initial navigation should cover capabilities such as:

```text id="q4m8c7"
Dashboard
Stores / Store Settings
Products
Inventory
Customers
Discounts
Orders
```

The UI should consume application/API contracts rather than directly querying the database.

---

# 23. Storefront Application

The same web application may serve Storefront functionality during Demo.

Required flows include:

```text id="v8m4c7"
Store Resolution
      ↓
Product Listing
      ↓
Product Detail
      ↓
Add to Cart
      ↓
Cart
      ↓
Checkout
      ↓
Payment
      ↓
Order Confirmation
```

A separate Storefront application is not required for Demo.

---

# 24. Loading and Failure States

Pages and interactive flows should explicitly handle:

- Loading.
- Empty state.
- Validation failure.
- Authorization failure.
- Not found.
- Network/API failure.
- Successful completion.

Do not allow unhandled errors to produce confusing blank screens.

---

# 25. Health Endpoint

Implement:

```text
/health
```

The endpoint should provide a lightweight process health indication.

It should not perform expensive dependency checks on every health request.

---

# 26. Readiness Endpoint

Implement:

```text
/ready
```

Readiness should verify the dependencies required for the web application to safely serve traffic.

At minimum, this should include database availability once PostgreSQL is a required runtime dependency.

---

# 27. Health Response Design

Responses should be machine-readable.

Example conceptual response:

```json id="v5c8m4"
{
  "status": "ok"
}
```

Readiness may include dependency state internally while avoiding unnecessary sensitive information.

---

# 28. Logging

The web application should use structured logging.

Useful fields include:

```text id="m8c4x7"
requestId
method
route
statusCode
durationMs
userId
organizationId
storeId
```

Sensitive values must be excluded.

Do not log:

- Passwords.
- Session secrets.
- Payment credentials.
- Full authentication tokens.
- Sensitive customer information unnecessarily.

---

# 29. Request Logging

The application should record useful request lifecycle information.

At minimum:

```text id="x7m4c8"
Request started
Request completed
Request failed
```

Logging volume should remain appropriate for the environment.

Health checks should not flood production logs.

---

# 30. Rate Limiting

The web layer should provide an integration point for rate limiting.

Rate limiting is especially important for:

- Authentication.
- Password reset.
- Public APIs.
- Checkout/payment endpoints.
- Webhooks.

The Demo may begin with simple infrastructure, but critical abuse-sensitive endpoints must not be left completely unprotected.

---

# 31. CSRF and CORS

The application must define explicit policies for:

- Cookie-authenticated requests.
- Cross-origin API requests.
- Browser form submissions.
- Webhook requests.

Do not use permissive wildcard CORS for authenticated production APIs without a deliberate reason.

---

# 32. Content-Type Handling

Routes should explicitly validate expected content types.

Examples:

```text id="q5m8c7"
application/json
multipart/form-data
application/x-www-form-urlencoded
```

depending on the endpoint.

Unexpected content types should be rejected safely.

---

# 33. API Documentation

The web application must eventually expose or generate OpenAPI documentation for supported API contracts.

OpenAPI should reflect:

- Request schemas.
- Response schemas.
- Authentication requirements.
- Error responses.
- Pagination.
- Idempotency requirements.

Generated documentation must remain synchronized with implementation.

---

# 34. Webhook Routes

Webhook routes must be isolated from normal authenticated API behavior.

Conceptually:

```text id="v8m4c7"
/api/v1/webhooks/<provider>
```

Webhook handling must:

1. Preserve the raw request where signature verification requires it.
2. Verify authenticity.
3. Persist the event.
4. Deduplicate.
5. Return the appropriate provider response.
6. Process asynchronously when appropriate.

Webhook-specific behavior belongs to the Webhooks integration.

---

# 35. Dependency Injection and Composition

The web application should compose application dependencies at controlled boundaries.

For example:

```text id="m4c8x7"
Web Bootstrap
   ↓
Repositories
   ↓
Domain Services
   ↓
Application Services
   ↓
Route Handlers
```

Do not instantiate complex infrastructure independently inside every route.

---

# 36. Application Startup

Startup should follow:

```text id="x7m3c8"
Load Configuration
      ↓
Validate Configuration
      ↓
Initialize Required Infrastructure
      ↓
Initialize Application Services
      ↓
Start HTTP Application
      ↓
Expose Health / Readiness
```

The application should fail clearly when required startup dependencies are invalid.

---

# 37. Graceful Shutdown

The web process must handle termination signals appropriately.

Shutdown should:

1. Stop accepting new work.
2. Allow active requests to finish within a bounded period.
3. Close database connections.
4. Release resources.
5. Exit cleanly.

The exact behavior depends on the Next.js runtime and deployment model.

---

# 38. Error Boundary Strategy

The web UI should have appropriate error boundaries for:

- Route-level failures.
- Application failures.
- Unexpected rendering failures.

Error pages must not expose:

- Stack traces.
- Database details.
- Provider credentials.
- Internal implementation details.

Detailed diagnostic information belongs in logs/error monitoring.

---

# 39. Web Tests

The bootstrap must establish testing support for:

### Unit

- Request helpers.
- DTO mapping.
- Utility behavior.

### Integration

- API handlers.
- Authentication integration.
- Tenant resolution.
- Database interactions.

### E2E

- Login.
- Merchant workflows.
- Storefront workflows.
- Checkout.

---

# 40. Bootstrap Verification

The web application is considered bootstrapped when:

```text id="q8m4c7"
[ ] Next.js starts
[ ] Development server works
[ ] Production build works
[ ] Typecheck passes
[ ] Lint passes
[ ] /health works
[ ] /ready works
[ ] Request IDs are available
[ ] Errors map consistently
[ ] Auth integration works
[ ] Tenant context can be established
[ ] API routing works
[ ] Server/client boundaries are valid
[ ] No secrets reach client bundles
[ ] Tests execute
```

---

# 41. Implementation Sequence

Implement the web foundation in this order:

```text id="v6m3c8"
1. Configure Next.js
2. Configure TypeScript
3. Configure environment access
4. Establish application structure
5. Establish request context
6. Integrate authentication
7. Integrate tenant resolution
8. Establish API routing
9. Establish validation
10. Establish centralized errors
11. Add health/readiness
12. Add structured request logging
13. Establish merchant application shell
14. Establish Storefront shell
15. Add webhook route foundation
16. Add API documentation integration
17. Add tests
18. Verify production build
```

---

# 42. Definition of Done

The web foundation is complete when:

- `apps/web` starts locally.
- Production builds succeed.
- API routing is established.
- Authentication can be integrated.
- Tenant context can be resolved.
- Validation and error handling are centralized.
- Health/readiness endpoints work.
- Structured request logging exists.
- Merchant and Storefront shells exist.
- Webhook routing has a secure foundation.
- Server/client boundaries are enforced.
- No domain business logic has leaked into the presentation layer.
- Relevant tests pass.

The result should be a stable application shell capable of receiving the domain implementations without requiring another architectural rewrite.