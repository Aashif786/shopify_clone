# Web Foundation

## 1. Purpose

This document defines the implementation requirements for the `apps/web` application.

`apps/web` is the primary Next.js application for the Demo. It provides the web interface, server-side request handling, API endpoints, authentication integration, tenant-aware application access, and storefront experience.

The web application must remain a **thin application layer**. Business rules belong to domain modules and application services.

---

# 2. Web Application Responsibilities

`apps/web` is responsible for:

- Next.js application runtime.
- Routing.
- Server-side request handling.
- API endpoint handlers.
- Authentication integration.
- Tenant/store context resolution.
- Authorization enforcement at application boundaries.
- Request validation.
- Calling application services.
- Rendering merchant interfaces.
- Rendering storefront interfaces.
- Returning consistent API responses.
- Request-level logging and correlation.
- Health/readiness endpoints where applicable.

It must not become the owner of domain business logic.

---

# 3. Approved Application Structure

The implementation should follow the existing repository structure.

Conceptually:

```text
apps/web/
├── package.json
├── tsconfig.json
├── next.config.*
├── src/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── ...
└── ...
```

The exact Next.js structure may evolve as implementation requires, but ownership boundaries must remain stable.

---

# 4. Next.js Application Boundary

The web application is the presentation and HTTP boundary.

The dependency direction is:

```text
Browser
   ↓
Next.js
   ↓
Route / Server Action / Server Component
   ↓
Application Service
   ↓
Domain Module
   ↓
Repository / Infrastructure
   ↓
PostgreSQL / External Service
```

Do not bypass application services to implement business operations directly inside routes.

---

# 5. Route Organization

Routes should be organized around user-facing capabilities rather than database entities alone.

Expected areas include:

```text
Merchant / administration
Storefront
Authentication
API
System/health
```

Exact route names must follow the approved API and product specifications.

---

# 6. API Route Boundary

API routes must remain thin.

A typical flow is:

```text
Request
  ↓
Parse request
  ↓
Authenticate
  ↓
Resolve tenant/store
  ↓
Authorize
  ↓
Validate input
  ↓
Call application service
  ↓
Map result
  ↓
Return response
```

Business logic must not accumulate inside route handlers.

---

# 7. API Versioning

Business-capability APIs use:

```text
/api/v1/*
```

The versioning convention must remain consistent.

Do not create ad-hoc API versions such as:

```text
/api/new
/api/latest
/api/experimental
```

without an explicit architectural decision.

---

# 8. Server Components

Server Components should be preferred for data-heavy authenticated pages where client-side interactivity is not required.

Benefits include:

- Reduced client JavaScript.
- Server-side data access.
- Better protection of server-only dependencies.
- Simpler request flows.

Server Components must still respect module and authorization boundaries.

---

# 9. Client Components

Use Client Components only where browser interactivity requires them.

Examples:

```text
Interactive forms
Dialogs
Dropdowns
Drag-and-drop
Client-side state
Real-time UI behavior
```

Client Components must not directly access:

```text
Database
Server secrets
Private service credentials
Server-only modules
```

---

# 10. Server/Client Boundary

The implementation must clearly separate:

```text
Server-only code
Client-safe code
```

Server-only packages include:

```text
@shopify-clone/db
@shopify-clone/auth
server configuration
payment provider credentials
storage credentials
```

These must never be imported into client bundles.

---

# 11. Authentication Integration

The web application must integrate with `packages/auth`.

Authentication should establish the current user/session context.

Conceptually:

```text
Request
   ↓
Session lookup
   ↓
Authenticated user
   ↓
Tenant/membership resolution
   ↓
Authorization
```

Authentication alone does not grant access to a Store.

---

# 12. Authorization

Authorization must be enforced server-side.

The web layer must not rely on:

```text
hidden UI controls
client state
localStorage
query parameters
client-supplied role values
```

to establish permissions.

---

# 13. Tenant Resolution

Authenticated merchant requests must resolve the relevant tenant/store context.

The implementation must ensure:

```text
Authenticated User
        ↓
Organization Membership
        ↓
Store Membership / Access
        ↓
Authorized Store Context
```

Every store-scoped operation must use trusted server-side context.

---

# 14. Tenant Isolation

A request for Store A must never be able to access Store B's resources merely by changing:

```text
storeId
resourceId
URL parameter
request body
query parameter
```

Tenant isolation must be enforced through application authorization and database query scoping.

---

# 15. Public Storefront Requests

Storefront requests differ from merchant requests because customers may not be authenticated.

The storefront must resolve:

```text
public Store identity
        ↓
published public configuration
        ↓
published products
```

Only intentionally public information may be returned.

---

# 16. Request Context

Where practical, construct an explicit request context.

Example conceptual structure:

```text
RequestContext
├── requestId
├── user
├── organization
├── store
├── permissions
└── correlation metadata
```

Do not use arbitrary global mutable state for request context.

---

# 17. Request IDs

Each request should have a correlation/request identifier.

If the client supplies a valid correlation identifier, it may be accepted subject to validation.

Otherwise the server generates one.

The identifier should be available to:

```text
Logs
Application services
Errors
Background work where propagated
```

---

# 18. Input Validation

All external input must be validated before reaching business logic.

Sources include:

```text
Path parameters
Query parameters
Headers
JSON bodies
Form data
Cookies where applicable
Webhook requests
```

Use the shared validation infrastructure.

---

# 19. Validation vs Business Rules

The web layer validates input shape.

For example:

```text
quantity is an integer
email has valid structure
currency has valid format
```

Domain/application logic validates business rules.

For example:

```text
inventory is available
discount is eligible
order transition is valid
```

Do not move business rules into UI validation simply because it is convenient.

---

# 20. Error Handling

API routes must map application errors into stable API responses.

Expected errors should not produce arbitrary stack traces or framework-specific responses.

Conceptually:

```text
Domain/Application Error
        ↓
HTTP Error Mapper
        ↓
Stable API Error
```

Unexpected errors must be logged appropriately and exposed to clients without leaking internal details.

---

# 21. HTTP Status Codes

Use status codes consistently.

Examples:

```text
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
429 Too Many Requests
500 Internal Server Error
```

The exact status depends on the operation and API contract.

Do not choose status codes solely based on convenience.

---

# 22. Not-Found and Authorization Safety

When appropriate, the application should avoid revealing whether a resource belonging to another tenant exists.

For example, an unauthorized resource may be represented as:

```text
404 Not Found
```

rather than exposing tenant information through:

```text
403 Forbidden
```

The exact behavior must follow the API/security specification.

---

# 23. Idempotency

Endpoints that perform retry-sensitive mutations must support the approved idempotency model.

Critical examples include:

```text
Checkout completion
Payment operations
Refunds
Inventory adjustments
Order creation
```

The web layer must pass idempotency information to the application service.

It must not implement incomplete ad-hoc idempotency independently.

---

# 24. Request Body Handling

Request bodies should be:

- Parsed once.
- Validated.
- Converted into explicit application DTOs.
- Passed to the application layer.

Avoid passing raw framework request objects deep into domain code.

---

# 25. Response DTOs

API responses should use explicit DTOs.

Do not expose database entities directly.

This protects:

```text
Internal schema
Sensitive fields
Implementation details
Future schema changes
```

---

# 26. Serialization

Responses must use predictable serialization.

Special values such as:

```text
Date
Decimal
BigInt
```

must have explicit serialization behavior.

Money must never silently become an unsafe floating-point representation.

---

# 27. Database Access

Route handlers must not perform arbitrary database queries.

Avoid:

```text
route
  → db.query(...)
```

for business operations.

Prefer:

```text
route
  → application service
  → domain repository
  → database
```

This preserves module ownership.

---

# 28. Storefront Data Access

Storefront pages must access published catalog data through the Products/Storefront interfaces.

They must not directly query internal product tables from presentation code.

---

# 29. Merchant UI

Merchant pages should consume application-facing services and APIs according to the approved architecture.

Merchant interfaces include areas such as:

```text
Dashboard
Stores
Products
Inventory
Customers
Orders
Discounts
Settings
```

The UI should not independently recreate server-side business rules.

---

# 30. Forms and Mutations

Forms should follow a predictable flow:

```text
User input
  ↓
Client validation where useful
  ↓
Server request
  ↓
Server validation
  ↓
Authorization
  ↓
Application service
  ↓
Result
  ↓
UI state update
```

Client validation is a usability feature, not a security boundary.

---

# 31. Loading and Error States

Important pages and mutations must define:

```text
Loading state
Success state
Validation error
Authorization error
Not-found state
Unexpected error state
```

Do not allow failed requests to silently appear successful.

---

# 32. Cache and Revalidation

Caching must not violate commerce correctness.

Never allow stale data to determine authoritative:

```text
Inventory
Payment state
Checkout state
Order state
Authorization
```

Caching may be used for safe read-heavy data where appropriate.

The database remains authoritative for transactional state.

---

# 33. Storefront Caching

Published storefront/catalog data may use framework caching or revalidation where appropriate.

Cache invalidation must be considered when:

```text
Product publication changes
Product details change
Store configuration changes
Product becomes unavailable
```

Do not introduce complex caching infrastructure for Demo without a demonstrated need.

---

# 34. Security Headers

The web application should establish appropriate security headers.

At minimum, evaluate:

```text
Content-Security-Policy
X-Content-Type-Options
Referrer-Policy
Frame protection
HTTPS enforcement in production
```

Exact values should follow deployment/security configuration.

---

# 35. CSRF Protection

State-changing browser requests must have appropriate CSRF protection when cookie-based authentication is used.

Do not assume that:

```text
POST
```

automatically means CSRF-safe.

---

# 36. CORS

CORS should be restrictive.

The application should not use:

```text
Access-Control-Allow-Origin: *
```

for authenticated APIs unless there is a specific, reviewed reason.

Allowed origins must come from trusted configuration.

---

# 37. Rate Limiting

Rate limiting should be considered for sensitive endpoints such as:

```text
Login
Password reset
Authentication attempts
Webhook endpoints
Public checkout operations
```

The Demo implementation should remain appropriately simple and must not introduce distributed infrastructure without a requirement.

---

# 38. File Uploads

The web application should not accept unrestricted file uploads.

Uploads must use the Media implementation and enforce:

```text
File type validation
Size limits
Filename/object-key safety
Authorization
Storage policy
```

Binary files should not be stored directly in PostgreSQL unless explicitly required.

---

# 39. External Service Calls

The web application must not contain provider-specific business logic.

Prefer:

```text
Web
 ↓
Application Service
 ↓
Provider Interface
 ↓
Provider Adapter
```

Examples include:

```text
Payment provider
Object storage
Email provider
```

---

# 40. Background Jobs

The web application should enqueue durable work rather than performing long-running secondary tasks during a request.

Examples:

```text
Send notification
Process webhook
Clean expired resources
Process media
Retry external delivery
```

The request should remain short where the operation does not require synchronous completion.

---

# 41. Health Endpoints

The web application should expose appropriate health/readiness behavior.

Health checks should distinguish between:

```text
Application process is alive
Application is ready to serve traffic
Critical dependency is unavailable
```

Health endpoints must not expose secrets or internal diagnostic information.

---

# 42. Logging

Request-level logging should capture useful structured metadata.

Typical fields:

```text
requestId
route
method
status
duration
userId where appropriate
storeId where appropriate
error code
```

Never log:

```text
Passwords
Session secrets
Payment credentials
Webhook secrets
Full sensitive request bodies
```

---

# 43. Observability Integration

The web application must integrate with the shared observability implementation.

Errors should contain enough context to diagnose:

```text
Which request failed
Which operation failed
Which Store was involved
Which correlation ID applies
```

Sensitive customer data must remain minimized.

---

# 44. Performance Baseline

The Demo does not require premature performance optimization.

The implementation should nevertheless avoid obvious problems:

```text
Unbounded database queries
N+1 queries in critical paths
Large unnecessary client bundles
Repeated authentication lookups
Repeated expensive calculations
Unbounded request payloads
```

Correctness takes priority over micro-optimization.

---

# 45. Dependency Restrictions

`apps/web` may depend on:

```text
Shared packages
Domain public APIs
Approved infrastructure adapters
```

It must not depend on another module's private implementation.

Avoid imports such as:

```text
modules/products/src/internal/...
```

---

# 46. Domain Boundary Enforcement

A web route must not reach around a domain module because the required function is inconvenient to access.

If a required capability is missing:

```text
Identify owning module
Create appropriate public application interface
Use that interface
```

Do not duplicate domain logic in the web layer.

---

# 47. Testing Requirements

The web foundation must support:

```text
Unit tests
API/route tests
Authorization tests
Tenant-isolation tests
Validation tests
Error-response tests
E2E tests
```

Critical paths should test both successful and rejected requests.

---

# 48. Build and Development Scripts

`apps/web/package.json` should provide predictable scripts such as:

```text
dev
build
start
typecheck
lint
test
```

Exact commands must match the repository's root tooling.

---

# 49. Local Development

A developer should be able to start the web application using the repository's documented development workflow.

The application must:

- Load validated configuration.
- Connect to the configured database.
- Fail clearly when required infrastructure is unavailable.
- Provide useful startup errors.
- Avoid silently running in a partially configured state.

---

# 50. Production Build

The production build must:

```text
Compile successfully
Validate server/client boundaries
Exclude server secrets from client bundles
Produce the expected Next.js output
Start successfully with production configuration
```

---

# 51. Web Foundation Implementation Order

Implement the web foundation in this order:

```text
1. Next.js application bootstrap
2. TypeScript configuration
3. Environment/config integration
4. Application layout and routing
5. Server/client boundaries
6. Authentication integration
7. Tenant context integration
8. Authorization integration
9. API infrastructure
10. Validation/error mapping
11. Logging/observability
12. Health/readiness
13. Shared UI integration
14. Test infrastructure
```

Domain-specific pages and flows should be implemented later through the vertical slices.

---

# 52. Definition of Done

The web foundation is complete when:

```text
[ ] Next.js application starts locally
[ ] Production build succeeds
[ ] TypeScript passes
[ ] Lint passes
[ ] Server/client boundaries are enforced
[ ] Configuration is validated
[ ] Authentication integration works
[ ] Tenant context is available
[ ] Authorization can be enforced
[ ] API versioning is established
[ ] Request validation is established
[ ] Error mapping is established
[ ] Request correlation/logging works
[ ] Health/readiness behavior exists
[ ] Database access respects module boundaries
[ ] Critical mutation paths support idempotency
[ ] No business logic is duplicated in routes
[ ] Security-sensitive values remain server-side
[ ] Tests execute successfully
```

---

# 53. Final Principle

`apps/web` is the **entry point to the platform, not the platform itself**.

It should translate HTTP and UI interactions into well-defined application operations while preserving authentication, tenant isolation, authorization, validation, observability, and security.

The domain modules remain responsible for the actual commerce rules.