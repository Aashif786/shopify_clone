# Configuration Foundation

## 1. Purpose

This document defines how application configuration is implemented across the Demo.

Configuration must be:

- Centralized.
- Typed.
- Validated.
- Environment-aware.
- Explicitly scoped.
- Secure.
- Testable.
- Consistent between `apps/web` and `apps/worker`.

The implementation must prevent configuration from becoming a collection of scattered `process.env` references and undocumented assumptions.

---

# 2. Configuration Ownership

Configuration is owned by:

```text
packages/config
```

Applications consume validated configuration from this package.

The preferred dependency flow is:

```text
Environment
    ↓
packages/config
    ↓
Validated configuration
    ↓
apps/web / apps/worker / approved infrastructure
```

---

# 3. Environment Variables

Environment variables are the primary external configuration mechanism for the Demo.

Examples include:

```text
DATABASE_URL
NODE_ENV
APP_URL
SESSION_SECRET
PAYMENT_PROVIDER_SECRET
STORAGE credentials
EMAIL credentials
SENTRY configuration
```

The exact variable set must be maintained in `.env.example`.

---

# 4. No Scattered Environment Access

Application and domain code must not freely access:

```text
process.env.*
```

throughout the repository.

Instead:

```text
process.env
   ↓
configuration loader
   ↓
validated config
   ↓
application code
```

This provides one place to validate and document configuration.

---

# 5. Configuration Categories

Configuration should be grouped by responsibility.

Conceptually:

```text
config
├── app
├── database
├── auth
├── tenant
├── storage
├── payments
├── notifications
├── jobs
└── observability
```

Only categories actually required by the Demo should be implemented.

---

# 6. Application Configuration

Application configuration may include:

```text
environment
application URL
API configuration
runtime mode
logging configuration
```

Example conceptual structure:

```text
config.app.environment
config.app.url
```

---

# 7. Database Configuration

Database configuration should include the information required to establish PostgreSQL connectivity.

The primary connection value is expected to be represented through a secure environment variable such as:

```text
DATABASE_URL
```

Connection pool settings should be explicitly configured where necessary.

---

# 8. Authentication Configuration

Authentication configuration may include:

```text
Session secret
Session lifetime
Cookie behavior
Password/reset configuration
```

Authentication secrets must never have insecure production defaults.

---

# 9. Storage Configuration

Object storage configuration should remain server-side.

Potential values include:

```text
Storage endpoint
Bucket/container
Access key
Secret key
Region where applicable
Public base URL where applicable
```

The exact provider remains behind the storage abstraction.

---

# 10. Payment Configuration

Payment credentials must be server-side only.

Potential configuration includes:

```text
Provider mode
Secret key
Webhook secret
Provider endpoint where configurable
```

Client-facing payment configuration must never expose private provider credentials.

---

# 11. Notification Configuration

Notification providers may require:

```text
SMTP/API credentials
Sender identity
Provider endpoint
```

Credentials must be validated before worker startup when notification processing is enabled.

---

# 12. Job Configuration

Worker job settings should be centralized.

Examples:

```text
JOB_POLL_INTERVAL
JOB_CONCURRENCY
JOB_LEASE_DURATION
JOB_MAX_ATTEMPTS
JOB_BACKOFF_LIMIT
JOB_SHUTDOWN_TIMEOUT
```

Exact variable names may differ from these examples.

---

# 13. Observability Configuration

Observability configuration may include:

```text
Sentry DSN
environment
release identifier
log level
```

Observability failures must not expose secrets.

---

# 14. Required vs Optional Configuration

Every configuration value must be classified as:

```text
Required
Optional
Environment-specific
Feature-dependent
```

For example:

```text
DATABASE_URL
→ required

SENTRY_DSN
→ optional for local development

PAYMENT_PROVIDER_SECRET
→ required when payment integration is enabled
```

---

# 15. Production Safety

Production must not silently fall back to development values.

Examples of unsafe behavior:

```text
Missing SESSION_SECRET
→ generate temporary secret

Missing PAYMENT_SECRET
→ use dummy value

Missing DATABASE_URL
→ connect to localhost
```

Such behavior can cause security or data-integrity failures.

Production startup should fail clearly when required configuration is missing.

---

# 16. Development Defaults

Development may have safe defaults where appropriate.

For example:

```text
local PostgreSQL host
development logging level
local application URL
```

Defaults must never weaken security boundaries.

---

# 17. Configuration Validation

Configuration validation must happen before dependent services start.

Conceptually:

```text
Load environment
      ↓
Parse values
      ↓
Validate types
      ↓
Validate required fields
      ↓
Validate relationships
      ↓
Create typed config
```

Invalid configuration should produce a clear error.

---

# 18. Type Safety

Consumers should receive typed configuration.

Avoid:

```text
config.get("something")
```

returning an untyped value throughout the application.

Prefer structured configuration with explicit types.

---

# 19. Boolean Configuration

Environment variables are strings.

Boolean configuration must therefore be parsed explicitly.

Avoid treating:

```text
"false"
```

as truthy simply because JavaScript considers non-empty strings truthy.

---

# 20. Numeric Configuration

Numeric values must be parsed and validated.

For example:

```text
JOB_CONCURRENCY=4
```

must become a number and must satisfy an appropriate range.

Invalid values must fail validation.

---

# 21. URLs

URL configuration must be validated as URLs where appropriate.

Examples:

```text
Application URL
Storage endpoint
Provider endpoint
Webhook-related URLs
```

Malformed URLs should fail startup rather than producing obscure runtime failures.

---

# 22. Secrets

Secrets must be treated differently from ordinary configuration.

Examples:

```text
Session secrets
Database credentials
Payment credentials
Storage secrets
Webhook secrets
Email credentials
```

Secrets must:

- Remain server-side.
- Never be committed.
- Never appear in logs.
- Never be included in client bundles.
- Never be placed in documentation with real values.

---

# 23. `.env.example`

The repository must maintain a complete `.env.example`.

It should:

- List required variables.
- List optional variables.
- Provide safe placeholder values.
- Explain purpose where useful.
- Avoid real secrets.

Example:

```text
DATABASE_URL=
SESSION_SECRET=
APP_URL=http://localhost:3000
```

The file must stay synchronized with configuration validation.

---

# 24. Local `.env` Files

Local secrets may be stored in environment-specific ignored files such as:

```text
.env.local
```

These files must never be committed.

The repository's Git configuration must ensure local secret files are ignored.

---

# 25. Environment Separation

The Demo should distinguish at least:

```text
development
test
production
```

Configuration must not accidentally cross these environments.

---

# 26. Test Configuration

Tests should use isolated configuration.

Examples:

```text
Test database
Test authentication secrets
Mock/test providers
Disabled external side effects where appropriate
```

Production credentials must never be required for normal test execution.

---

# 27. Test Database Safety

The test environment must not accidentally connect to a production database.

Where practical, configuration validation should detect suspicious production configuration in test mode.

Tests must fail rather than risk destructive operations against the wrong database.

---

# 28. Client-Safe Configuration

Only explicitly approved public configuration may cross the server/client boundary.

Examples might include:

```text
Public application URL
Public storefront configuration
Public provider identifiers
```

Never expose:

```text
Database URL
Session secret
Payment secret
Storage secret
Webhook secret
```

---

# 29. Next.js Environment Behavior

Next.js has special handling for client-exposed environment variables.

Variables intentionally exposed to the browser must follow the project's explicit public configuration convention.

Do not prefix a secret with a client-exposed environment naming convention merely to make it accessible.

---

# 30. Worker Configuration

`apps/worker` should consume the same central configuration package while using only the configuration relevant to worker execution.

The worker should not require unrelated browser/public configuration.

---

# 31. Configuration Loading

Configuration should be loaded once during application initialization.

Avoid repeatedly parsing environment variables during every request or job.

---

# 32. Configuration Immutability

Once configuration has been validated and initialized, it should be treated as immutable.

Do not modify global configuration at runtime.

If dynamic configuration becomes necessary later, it should be introduced as an explicit subsystem rather than mutating the startup configuration object.

---

# 33. Feature Flags

Feature flags should be used sparingly.

A feature flag must have:

```text
Purpose
Owner
Default
Environment behavior
Removal plan
```

Do not introduce flags for every small implementation detail.

---

# 34. Demo Feature Flags

Demo feature flags may be appropriate for:

```text
Experimental integration
Optional provider
Staged feature rollout
Operational fallback
```

They must not be used to hide unfinished core functionality while claiming the Demo is complete.

---

# 35. Provider Configuration

External providers must be configured behind provider-specific adapters.

For example:

```text
Payment configuration
       ↓
Payment adapter

Storage configuration
       ↓
Storage adapter

Notification configuration
       ↓
Notification adapter
```

Domain modules should not read provider credentials directly.

---

# 36. Configuration and Module Boundaries

Domain modules should receive capabilities through interfaces or application services.

Avoid:

```text
Product module
  → process.env.PAYMENT_SECRET
```

or:

```text
Order module
  → process.env.STORAGE_KEY
```

Configuration access must follow ownership boundaries.

---

# 37. Configuration Errors

Configuration errors should be classified clearly.

Examples:

```text
Missing required value
Invalid value
Invalid format
Unsupported environment
Conflicting configuration
```

Startup errors should identify the configuration problem without printing secret values.

---

# 38. Error Messages

Good:

```text
SESSION_SECRET is required in production.
```

Bad:

```text
SESSION_SECRET is invalid: sk_live_abc123...
```

Never include actual secret contents in errors.

---

# 39. Configuration Logging

Startup may log non-sensitive configuration metadata such as:

```text
environment=development
database=configured
storage=configured
payments=sandbox
```

It must not log:

```text
Secret values
Connection strings containing passwords
Tokens
Private keys
Webhook secrets
```

---

# 40. Configuration Changes

Configuration changes should be reviewed like code changes when they affect:

- Security.
- Data integrity.
- External providers.
- Production behavior.
- Resource consumption.

Changing a production environment variable is not automatically harmless just because no source code changed.

---

# 41. Secret Rotation

The implementation should allow secrets to be rotated without changing source code.

Examples:

```text
Session secret
Payment credentials
Storage credentials
Webhook secret
Email credentials
```

Rotation procedures belong to deployment/operations documentation.

---

# 42. Configuration Testing

Tests should verify:

```text
Required values are enforced
Invalid values are rejected
Defaults behave correctly
Boolean parsing is correct
Numeric ranges are enforced
URLs are validated
Production restrictions work
Client-safe configuration excludes secrets
```

---

# 43. Configuration Package Tests

`packages/config` should have focused tests for configuration parsing and validation.

Tests should not require the full application to start.

---

# 44. Configuration Dependency Rules

`packages/config` should remain low-level.

It must not depend on:

```text
modules/*
apps/web
apps/worker
```

Configuration should describe infrastructure/application settings, not domain behavior.

---

# 45. Configuration Implementation Order

Implement configuration in this order:

```text
1. Define configuration categories
2. Define environment variables
3. Define `.env.example`
4. Implement parsing
5. Implement validation
6. Implement typed configuration object
7. Add environment-specific rules
8. Add client-safe configuration
9. Integrate with web
10. Integrate with worker
11. Add tests
```

---

# 46. Definition of Done

Configuration foundation is complete when:

```text
[ ] All required configuration is documented
[ ] `.env.example` is complete
[ ] Configuration is centrally owned
[ ] Environment variables are parsed explicitly
[ ] Configuration is strongly typed
[ ] Required values are validated
[ ] Production safety rules are enforced
[ ] Test configuration is isolated
[ ] Client-safe configuration is separated
[ ] Secrets remain server-side
[ ] Web consumes validated configuration
[ ] Worker consumes validated configuration
[ ] Provider credentials remain behind adapters
[ ] Configuration errors are clear
[ ] Secrets never appear in logs
[ ] Configuration tests pass
[ ] TypeScript passes
[ ] Lint passes
```

---

# 47. Final Principle

Configuration is infrastructure, not business logic.

The implementation should make it difficult to accidentally:

- Use an invalid value.
- Expose a secret.
- Connect tests to production.
- Access environment variables from arbitrary code.
- Start production with unsafe defaults.

A centralized, typed, validated configuration layer provides a small but important foundation for the rest of the platform. 