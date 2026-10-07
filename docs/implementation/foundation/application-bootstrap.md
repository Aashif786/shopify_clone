# Application Bootstrap Implementation

## 1. Purpose

This document defines the implementation requirements for bootstrapping the two runtime applications of the Demo:

```text
apps/web
apps/worker
```

The objective is to establish predictable startup, configuration loading, dependency initialization, lifecycle management, and health behavior before business-domain implementation begins.

---

# 2. Runtime Applications

The Demo contains two primary runtime processes.

## Web

```text
apps/web
```

Responsible for:

- Next.js application.
- HTTP requests.
- API routes.
- Merchant interface.
- Storefront interface.
- Authentication entry points.

## Worker

```text
apps/worker
```

Responsible for:

- Background job polling.
- Job claiming.
- Job execution.
- Retry processing.
- Scheduled work.
- Worker health.

---

# 3. Application Startup Principles

Startup should be deterministic.

The application must:

1. Load configuration.
2. Validate required configuration.
3. Initialize required infrastructure.
4. Verify required dependencies.
5. Start accepting requests or jobs.
6. Report readiness.

An application must not start in a partially configured state when the missing configuration is required for safe operation.

---

# 4. Web Startup Flow

Conceptually:

```text id="q8m3c5"
Process Starts
    ↓
Load Configuration
    ↓
Validate Configuration
    ↓
Initialize Application
    ↓
Initialize Required Infrastructure
    ↓
Register Routes
    ↓
Start Next.js
    ↓
Ready
```

Next.js manages much of the application lifecycle, but project-specific initialization must remain explicit.

---

# 5. Worker Startup Flow

The Worker should follow:

```text id="m4x7n2"
Process Starts
    ↓
Load Configuration
    ↓
Validate Configuration
    ↓
Initialize Logger
    ↓
Initialize Database
    ↓
Register Job Handlers
    ↓
Verify Dependencies
    ↓
Start Worker Loop
    ↓
Ready
```

---

# 6. Configuration Before Infrastructure

Configuration must be validated before initializing infrastructure that depends on it.

For example:

```text id="v6p9c3"
Environment
    ↓
Config Validation
    ↓
Database Initialization
```

not:

```text id="r3m8x5"
Database
    ↓
Discover Missing Configuration
```

---

# 7. Required Configuration

Configuration should distinguish between:

### Required

Missing values prevent safe startup.

### Optional

Missing values have a documented safe default.

### Public

Safe to expose to browser code.

### Secret

Server-only.

The configuration package owns this classification.

---

# 8. Environment Separation

The application should support distinct environments:

```text id="x7c4m9"
development
test
staging
production
```

The Demo may initially deploy only development and production, but configuration must not assume they are identical.

---

# 9. Development Startup

Local development should provide a simple workflow.

Target command:

```text id="p5m8x3"
pnpm dev
```

The command should start the Web application and required development infrastructure according to the local-development strategy.

---

# 10. Worker Development

The Worker should have an explicit development command.

For example:

```text id="k4n7c2"
pnpm --filter <worker-package> dev
```

The root workspace may later provide a combined command.

---

# 11. Production Processes

Production should run the applications as separate processes:

```text id="w6m3x8"
Web Process
Worker Process
```

They may run on the same VPS in the Demo.

Separating processes preserves the architectural boundary between request handling and asynchronous processing.

---

# 12. Database Initialization

The Web and Worker may share the same PostgreSQL database.

They should use the shared DB package.

Database migrations should be executed as an explicit deployment step rather than implicitly every time an application starts.

---

# 13. Migration Separation

Application startup should not automatically run destructive or unknown database migrations.

Preferred deployment sequence:

```text id="c8m5v7"
Deploy Code
    ↓
Run Migrations
    ↓
Verify
    ↓
Start / Restart Applications
```

This makes migration behavior observable and controllable.

---

# 14. Database Connection Management

The shared database package should provide:

- Connection pooling.
- Connection lifecycle.
- Transaction support.
- Safe shutdown.

Each runtime process should reuse its configured connection pool rather than creating a new connection for every request.

---

# 15. Web Database Usage

The Web application should:

- Use pooled connections.
- Keep transactions short.
- Release connections correctly.
- Avoid long-running transactions during external API calls.

---

# 16. Worker Database Usage

The Worker should:

- Use pooled connections.
- Claim jobs transactionally.
- Keep job-claim transactions short.
- Release resources after processing.
- Close connections during shutdown.

---

# 17. Dependency Initialization

Only infrastructure required by the process should be initialized.

For example:

The Web process does not need to initialize the Worker loop.

The Worker does not need to initialize browser UI infrastructure.

Avoid unnecessary startup dependencies.

---

# 18. Request Context

The Web application should create a request context containing relevant metadata.

Conceptually:

```text id="j7c3m8"
Request
├── requestId
├── authentication
├── tenant
└── tracing/logging context
```

The context should be passed explicitly into application services where required.

---

# 19. Request ID

Each request should receive a request identifier.

If a trusted upstream already supplies a valid correlation identifier, the application may propagate it according to the deployment security policy.

The request ID should appear in structured logs.

---

# 20. Authentication Initialization

Authentication infrastructure should be initialized before protected routes execute.

The application must be able to:

- Resolve sessions.
- Reject invalid sessions.
- Construct authenticated context.

Authentication must not be implemented as client-only state.

---

# 21. Tenant Initialization

Tenant resolution occurs after authentication for protected operations.

Typical pipeline:

```text id="s4m8x2"
Request
  ↓
Authentication
  ↓
Tenant Resolution
  ↓
Authorization
  ↓
Application Service
```

Public Storefront routes may use a different resolution path while still enforcing Store ownership and visibility.

---

# 22. Error Initialization

The Web application must have centralized error handling.

Unexpected errors should:

- Be logged.
- Receive a request ID.
- Return a safe response.
- Avoid leaking internal details.

Expected application errors should map to stable API error codes.

---

# 23. Validation Initialization

Boundary validation must occur before application services execute.

Example:

```text id="q9m4x7"
HTTP Request
    ↓
Parse
    ↓
Validate
    ↓
Authenticate
    ↓
Authorize
    ↓
Application Service
```

The exact middleware order may vary where authentication is required before validation of protected resources, but every boundary must remain enforced.

---

# 24. Health Endpoint

The Web application should expose a lightweight health endpoint.

Example:

```text id="g6c3v8"
GET /health
```

The endpoint should indicate whether the process is alive.

It should not perform expensive database queries on every health request.

---

# 25. Readiness Endpoint

A readiness endpoint may verify required dependencies.

Example:

```text id="n8m5x2"
GET /ready
```

It may verify:

- Database connectivity.
- Required configuration.
- Required infrastructure.

The exact checks should remain lightweight.

---

# 26. Worker Health

The Worker should expose or publish sufficient health information to determine:

- Process is running.
- Database is reachable.
- Worker loop is active.
- Jobs can be claimed.

A Worker that is alive but unable to process jobs should not be considered fully healthy.

---

# 27. Graceful Shutdown

Both applications must support graceful shutdown.

The Web process should:

1. Stop accepting new work where supported.
2. Allow active requests to finish within a bounded period.
3. Close database connections.
4. Flush relevant logs/telemetry.
5. Exit.

The Worker should additionally:

1. Stop claiming new jobs.
2. Allow active jobs to finish within a bounded period.
3. Leave recoverable state.
4. Close database connections.
5. Exit.

---

# 28. Shutdown Timeout

Shutdown must have a maximum duration.

A process must not remain indefinitely stuck waiting for a request, job, or provider.

After the configured grace period, the process may terminate according to the runtime/deployment policy.

---

# 29. Crash Recovery

The system must assume processes can terminate unexpectedly.

Therefore:

- Database transactions must roll back safely.
- Jobs must recover through stale-job handling.
- Sessions must remain valid or invalid according to their persisted state.
- External operations must use idempotency where required.

Application startup should not depend on process-local state surviving a crash.

---

# 30. Logging Initialization

Structured logging should be initialized early enough to capture startup failures.

Startup logs should include:

- Application name.
- Environment.
- Version/release identifier where available.
- Startup stage.
- Failure category where startup fails.

Secrets must never be logged.

---

# 31. Version Information

The application should expose a build/release identifier to operational tooling.

For example:

```text id="w3m7c9"
APP_VERSION
GIT_COMMIT_SHA
```

The exact mechanism depends on the deployment pipeline.

---

# 32. Runtime Configuration

Runtime configuration should be loaded once and treated as immutable for the lifetime of the process unless a deliberate dynamic configuration system is introduced later.

Avoid repeatedly reading and parsing environment variables inside business logic.

---

# 33. Dependency Health

Startup validation should distinguish:

### Configuration failure

Example:

```text id="x8m4p7"
DATABASE_URL missing
```

### Dependency failure

Example:

```text id="j5c9v2"
PostgreSQL unavailable
```

### Application failure

Example:

```text id="r7m3x6"
Required handler registration failed
```

These should produce useful operational diagnostics without exposing sensitive values.

---

# 34. Web Route Registration

Routes should be organized by business capability.

Conceptually:

```text id="q6n8c3"
/api/v1/auth
/api/v1/stores
/api/v1/products
/api/v1/inventory
/api/v1/customers
/api/v1/carts
/api/v1/checkout
/api/v1/payments
/api/v1/orders
/api/v1/storefront
/api/v1/media
/api/v1/notifications
/api/v1/webhooks
```

The exact Next.js routing implementation may vary.

---

# 35. API Versioning

The initial API namespace is:

```text id="m9x4c7"
/api/v1/
```

Business capability routes should remain grouped under this namespace.

Version changes should follow the API versioning strategy.

---

# 36. Webhook Startup

Webhook routes must be registered without requiring normal browser authentication.

However, they must use their own verification mechanism.

Webhook initialization should not expose provider secrets to client-side code.

---

# 37. Worker Handler Registration

The Worker should register supported job handlers explicitly.

Conceptually:

```text id="v8m3q5"
Job Type
   ↓
Handler Registry
   ↓
Handler
```

Unknown job types should fail safely rather than being dynamically executed.

---

# 38. Application Dependency Graph

At runtime:

```text id="k4c8m7"
apps/web
   ↓
config
auth
tenant
db
domain interfaces
   ↓
PostgreSQL / Providers

apps/worker
   ↓
config
db
job infrastructure
domain handlers
   ↓
PostgreSQL / Providers
```

---

# 39. Local Development Dependencies

The initial local environment should require only what is necessary:

```text id="q7m3x9"
Node.js
pnpm
PostgreSQL
```

Docker may provide PostgreSQL and other local infrastructure for consistency.

External provider integrations may use sandbox/test credentials or development adapters.

---

# 40. Production Startup

Production startup should follow:

```text id="n5c8v2"
Container / Process Start
       ↓
Load Configuration
       ↓
Validate Configuration
       ↓
Initialize Runtime
       ↓
Verify Required Dependencies
       ↓
Ready
```

Database migrations should remain a deployment step rather than being silently executed during application startup.

---

# 41. Startup Failure Policy

If required configuration or infrastructure is unavailable, the process should fail clearly.

Do not silently continue with:

- Missing database.
- Missing authentication secret.
- Invalid provider configuration.
- Invalid required environment values.

Failing early is safer than running partially configured security-sensitive software.

---

# 42. Testing Application Bootstrap

Bootstrap tests should verify:

- Configuration validation.
- Application initialization.
- Database initialization.
- Health endpoint.
- Readiness behavior.
- Graceful shutdown.
- Worker startup.
- Worker shutdown.

---

# 43. Development Experience

A developer should be able to determine quickly:

```text id="x3m7q8"
How do I start Web?
How do I start Worker?
How do I start PostgreSQL?
How do I run migrations?
How do I seed data?
How do I run tests?
```

These commands should be documented in the root README and local-development documentation.

---

# 44. Application Bootstrap Definition of Done

```text id="r8c4m6"
[ ] Web application starts
[ ] Worker application starts
[ ] Configuration loads correctly
[ ] Required configuration is validated
[ ] Database connection initializes correctly
[ ] Connection pools are configured
[ ] Request context exists
[ ] Authentication integration exists
[ ] Tenant context integration exists
[ ] Centralized error handling exists
[ ] Structured logging initializes
[ ] Health endpoint exists
[ ] Readiness behavior exists
[ ] Worker health exists
[ ] Graceful Web shutdown exists
[ ] Graceful Worker shutdown exists
[ ] Startup failures are explicit
[ ] Runtime version information exists
[ ] API v1 routing foundation exists
[ ] Webhook route foundation exists
[ ] Job handler registration exists
[ ] Bootstrap tests exist
[ ] Local startup workflow is documented
```

---

# 45. Final Bootstrap Principle

The application bootstrap should establish a reliable runtime shell before business logic is introduced.

The desired state is:

```text id="c7m2x9"
Configuration
      ↓
Infrastructure
      ↓
Runtime
      ↓
Request / Job Processing
```

Once this foundation works, domain implementation can proceed without every feature inventing its own startup, configuration, database, logging, and lifecycle behavior.