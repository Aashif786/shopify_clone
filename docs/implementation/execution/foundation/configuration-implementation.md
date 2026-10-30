# Configuration Implementation

## 1. Purpose

This document defines the concrete implementation of centralized configuration for the Demo.

Configuration must provide:

- Typed environment variables.
- Startup validation.
- Clear environment separation.
- Server/client safety.
- Worker configuration.
- Provider configuration.
- Test configuration.
- Safe secret handling.
- Predictable behavior across local, CI, and deployment environments.

Configuration is infrastructure. Business modules must consume validated configuration and must not independently interpret raw environment variables.

---

# 2. Configuration Ownership

Configuration is owned by:

```text id="m8c4x7"
packages/config
```

Applications consume configuration through the package.

The following must not become normal application patterns:

```ts
process.env.DATABASE_URL
process.env.PAYMENT_SECRET
process.env.SESSION_SECRET
```

throughout arbitrary files.

Instead:

```text id="q7m3c8"
Environment
    ↓
Config Loader
    ↓
Validation
    ↓
Typed Configuration
    ↓
Application
```

---

# 3. Configuration Categories

Configuration should be organized into logical categories.

```text id="v8c4m7"
Application
Database
Authentication
Tenant
Worker
Logging
Observability
Object Storage
Payments
Email
Cloudflare / Deployment
Feature Flags
```

Only categories actually required by the Demo should be enabled.

---

# 4. Configuration Sources

Configuration may come from:

```text id="x5m8c3"
Environment Variables
        ↓
Configuration Loader
        ↓
Typed Runtime Configuration
```

Environment variables are the primary runtime configuration mechanism.

Configuration files containing environment-specific secrets must not be committed.

---

# 5. Environment Separation

The implementation must distinguish:

```text id="m4c8x7"
development
test
demo
production
```

The exact deployment naming may vary, but behavior must be explicit.

Each environment should have independent:

- Database.
- Authentication secrets.
- Provider credentials.
- Object storage configuration.
- Monitoring configuration.

---

# 6. `.env.example`

The repository must maintain:

```text id="q8m3c7"
.env.example
```

It should contain:

- Every required environment variable.
- Safe placeholder values.
- Short descriptions where useful.

Example:

```text
DATABASE_URL=postgresql://user:password@localhost:5432/calcart
```

must remain a non-production example.

---

# 7. Secret Handling

Secrets include:

- Database credentials.
- Session secrets.
- Password-reset secrets.
- Payment credentials.
- Webhook secrets.
- Object-storage credentials.
- Email credentials.
- Monitoring tokens.
- Deployment credentials.

Secrets must:

- Never be committed.
- Never be logged.
- Never be returned in API responses.
- Never be bundled into browser code.
- Be injected through the deployment environment.

---

# 8. Public vs Server Configuration

Configuration must distinguish between:

### Server-only

Examples:

```text id="v7m4c8"
DATABASE_URL
SESSION_SECRET
PAYMENT_SECRET
STORAGE_SECRET
WEBHOOK_SECRET
```

### Public

Examples:

```text id="x4m8c7"
PUBLIC_APP_URL
PUBLIC_STORE_URL
PUBLIC_API_BASE_URL
```

Public configuration must never contain secrets.

---

# 9. Client Configuration

Next.js client-side configuration should only expose explicitly approved public variables.

The implementation must not pass the entire configuration object into client components.

Preferred:

```text id="m8c4x7"
Server Config
   ↓
Explicit Public Config
   ↓
Client
```

---

# 10. Typed Configuration

Configuration should expose typed values.

For example:

```ts
type AppConfig = {
  environment: "development" | "test" | "demo" | "production";
  appUrl: string;
};
```

The exact implementation may use the project's selected validation library.

Consumers should receive types rather than repeatedly parsing strings.

---

# 11. Startup Validation

Required configuration must be validated during startup.

If a required value is missing or invalid:

```text id="q6m3c8"
Application Startup
      ↓
Configuration Validation
      ↓
Invalid
      ↓
Fail Fast
```

The application should not start in a partially configured state.

---

# 12. Error Messages

Configuration errors should identify:

- Missing variable.
- Invalid variable.
- Expected format.

They must not expose the actual secret value.

Bad:

```text
PAYMENT_SECRET is invalid: sk_live_xxxxxxxxx
```

Good:

```text
PAYMENT_SECRET is missing or invalid.
```

---

# 13. Application Configuration

Application configuration should include values such as:

```text id="v8m4c7"
APP_ENV
APP_URL
API_BASE_URL
LOG_LEVEL
```

Values must be validated for correct format.

URLs must be parsed as URLs rather than treated as arbitrary strings.

---

# 14. Database Configuration

Database configuration should support:

```text id="m4c8x7"
DATABASE_URL
DB_POOL_MIN
DB_POOL_MAX
DB_CONNECTION_TIMEOUT
```

Only values that are genuinely required should be exposed as configuration.

Connection tuning should have safe defaults.

---

# 15. Database Security

Production database configuration must support:

- TLS where required.
- Credential separation.
- Restricted network access.
- Appropriate connection limits.

Database credentials must not be embedded in source code.

---

# 16. Authentication Configuration

Authentication configuration may include:

```text id="q7m3c8"
SESSION_SECRET
SESSION_TTL
PASSWORD_RESET_TTL
AUTH_COOKIE_NAME
```

Sensitive values must remain server-side.

Authentication configuration must fail startup if critical security secrets are missing in production-like environments.

---

# 17. Cookie Configuration

Cookie behavior should be derived from environment configuration where appropriate.

Production should enforce secure behavior.

Typical settings include:

```text id="x8m4c7"
Secure
HttpOnly
SameSite
Domain
Path
```

The application should not blindly copy development cookie settings into production.

---

# 18. Worker Configuration

Worker configuration should include:

```text id="v5c8m4"
WORKER_POLL_INTERVAL_MS
WORKER_BATCH_SIZE
WORKER_CONCURRENCY
WORKER_MAX_ATTEMPTS
WORKER_STALE_JOB_TIMEOUT_MS
WORKER_SHUTDOWN_TIMEOUT_MS
```

Safe defaults should be provided where possible.

---

# 19. Logging Configuration

Support:

```text id="m8c4x7"
LOG_LEVEL
LOG_FORMAT
```

Development may use a developer-friendly format.

Production should use structured logs suitable for centralized processing.

---

# 20. Observability Configuration

Configuration may include:

```text id="q4m7c8"
SENTRY_DSN
SENTRY_ENVIRONMENT
SENTRY_RELEASE
```

Monitoring integrations should be disabled or safely configured when not required.

Missing optional monitoring configuration should not necessarily prevent local development.

---

# 21. Object Storage Configuration

When Media is enabled, configuration should support:

```text id="x7m4c8"
STORAGE_ENDPOINT
STORAGE_BUCKET
STORAGE_REGION
STORAGE_ACCESS_KEY
STORAGE_SECRET_KEY
```

Provider-specific details should remain behind the storage adapter.

---

# 22. Payment Configuration

Payment configuration should distinguish Demo/test credentials from production credentials.

Example categories:

```text id="m5c8x7"
PAYMENT_PROVIDER
PAYMENT_PUBLIC_KEY
PAYMENT_SECRET_KEY
PAYMENT_WEBHOOK_SECRET
PAYMENT_ENVIRONMENT
```

Production credentials must never be used in local development by accident.

---

# 23. Email Configuration

When Notifications are enabled, configuration may include:

```text id="q8m3c7"
EMAIL_PROVIDER
EMAIL_FROM_ADDRESS
EMAIL_API_KEY
```

The provider implementation must remain behind an adapter.

---

# 24. Provider Environment Separation

Provider environments must be explicit.

For example:

```text id="v4m8c7"
Demo
  ↓
Sandbox Provider

Production
  ↓
Production Provider
```

The configuration layer must prevent accidental provider mixing where practical.

---

# 25. Feature Flags

Feature flags should be used only when they solve a real requirement.

Appropriate uses include:

- Gradual Demo functionality.
- Operational safety.
- Provider migration.
- Controlled rollout.

Do not create flags for every unfinished feature.

---

# 26. Feature Flag Rules

Flags must have:

- A defined name.
- A clear purpose.
- A default.
- An environment policy.
- An owner.
- A removal plan where temporary.

Temporary flags should not become permanent architecture.

---

# 27. Configuration Immutability

Once configuration is loaded:

```text id="m7c4x8"
Load
 ↓
Validate
 ↓
Freeze / Treat as Immutable
 ↓
Application Runtime
```

Application components should not mutate global configuration.

---

# 28. Configuration Access

Consumers should receive only the configuration they need.

For example:

```text id="x5m8c4"
Payment Adapter
      ↓
Payment Configuration
```

rather than:

```text id="q8m3c7"
Payment Adapter
      ↓
Entire Application Configuration
```

This reduces accidental secret exposure and coupling.

---

# 29. Configuration and Dependency Injection

Configuration should be passed into infrastructure components during construction where practical.

Example:

```text id="v4c8m7"
Config
 ↓
PaymentAdapter(config)
```

This makes dependencies explicit and simplifies testing.

---

# 30. Test Configuration

Tests should use dedicated configuration.

Test configuration must ensure:

- Isolated database.
- Non-production credentials.
- Deterministic behavior.
- Safe external integrations.
- Controlled timeouts.

Tests must never accidentally connect to production resources.

---

# 31. CI Configuration

CI should receive required variables through GitHub Actions configuration/secrets.

CI must not depend on a developer's `.env.local`.

Public test configuration may be defined directly in workflow configuration where safe.

Secrets must use CI secret storage.

---

# 32. Docker Configuration

Docker environments should receive configuration through environment injection.

Do not bake secrets into:

- Dockerfiles.
- Images.
- Source code.
- Committed Compose files.

---

# 33. Production Configuration

Production configuration must be provided by the deployment environment.

The application should validate:

```text id="m8c4x7"
Required variables
Correct formats
Secure settings
Provider configuration
Database configuration
```

before accepting traffic.

---

# 34. Configuration Rotation

Secrets should be replaceable without source-code changes.

Examples:

```text id="q7m4c8"
Database credential rotation
Session secret rotation
Provider key rotation
Webhook secret rotation
Storage credential rotation
```

Rotation strategy must account for active sessions and external provider configuration where relevant.

---

# 35. Secret Rotation and Sessions

Changing a session signing/validation secret may invalidate existing sessions depending on the implementation.

This behavior must be intentional and documented.

Do not accidentally invalidate all users during an unrelated deployment.

---

# 36. Configuration Failure Modes

Configuration failures should fail safely.

Examples:

### Missing Database URL

```text
Startup → Fail
```

### Missing Optional Sentry DSN

```text
Startup → Continue
Monitoring → Disabled
```

### Missing Production Payment Secret

```text
Startup → Fail
```

when payment functionality is enabled and the secret is required.

---

# 37. Configuration Testing

Tests should cover:

```text id="v6m4c8"
[ ] Valid configuration
[ ] Missing required variable
[ ] Invalid URL
[ ] Invalid numeric value
[ ] Invalid enum
[ ] Public/server separation
[ ] Production security requirements
[ ] Test environment behavior
[ ] Worker configuration
```

Secret values must never appear in test failure output.

---

# 38. Configuration Implementation Sequence

Implement in this order:

```text id="x8m3c7"
1. Define configuration categories
2. Define environment variable names
3. Implement schema validation
4. Implement server configuration loader
5. Implement public configuration loader
6. Implement worker configuration
7. Add environment separation
8. Add startup validation
9. Integrate web application
10. Integrate worker
11. Integrate database
12. Integrate provider configuration
13. Add tests
14. Verify CI configuration
15. Verify Docker configuration
```

---

# 39. Configuration Verification

Before proceeding, verify:

```text id="q5m8c4"
[ ] `.env.example` is complete
[ ] No secrets are committed
[ ] Config loads successfully
[ ] Invalid config fails safely
[ ] Web can consume typed config
[ ] Worker can consume typed config
[ ] Database config works
[ ] Test environment is isolated
[ ] CI configuration works
[ ] Client cannot access server secrets
[ ] Production security requirements are enforced
```

---

# 40. Definition of Done

Configuration implementation is complete when:

- All required runtime configuration is centrally defined.
- Environment variables are validated.
- Applications no longer depend on scattered raw `process.env` access.
- Server and client configuration are separated.
- Worker configuration is supported.
- Provider credentials are isolated.
- Test and production environments cannot accidentally overlap.
- Secrets are excluded from source control and logs.
- Configuration failures are deterministic and safe.
- Web and worker startup correctly consume validated configuration.

The configuration layer should make the application predictable. Configuration should tell the system how to run, not quietly become another place where business logic goes to hide.