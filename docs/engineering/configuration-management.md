# Configuration Management

## 1. Purpose

This document defines how application configuration is declared, validated, loaded, accessed, and managed across development, testing, Demo deployment, and future V1 environments.

Configuration must be:

- Explicit.
- Validated.
- Environment-aware.
- Secure.
- Centralized.
- Easy to change without modifying application code.

Secrets must never be committed to source control.

---

## 2. Configuration Principles

The platform follows these principles:

1. Configuration belongs outside business logic.
2. Environment-specific values must not be hardcoded.
3. Required configuration must be validated during startup.
4. Secrets must be supplied through secure environment mechanisms.
5. Application code should access configuration through a centralized configuration layer.
6. Configuration names must be consistent.
7. Invalid configuration should cause early failure rather than unpredictable runtime behavior.
8. Public client configuration must be explicitly separated from server-only configuration.
9. Configuration changes must be documented when they affect deployment or behavior.
10. AI agents must never invent credentials or commit real secrets.

---

## 3. Configuration Categories

Configuration should be classified into categories.

### Application configuration

Examples:

```text
NODE_ENV
APP_ENV
APP_URL
LOG_LEVEL
```

### Database configuration

Examples:

```text
DATABASE_URL
DATABASE_POOL_SIZE
```

### Authentication configuration

Examples:

```text
AUTH_SECRET
SESSION_SECRET
AUTH_PROVIDER_*
```

### Payment configuration

Examples:

```text
PAYMENT_PROVIDER
PAYMENT_PROVIDER_SECRET_KEY
PAYMENT_WEBHOOK_SECRET
```

### Storage configuration

Examples:

```text
STORAGE_PROVIDER
STORAGE_BUCKET
STORAGE_REGION
STORAGE_ACCESS_KEY
STORAGE_SECRET_KEY
```

### Email configuration

Examples:

```text
EMAIL_PROVIDER
EMAIL_API_KEY
EMAIL_FROM
```

### Observability configuration

Examples:

```text
SENTRY_DSN
SENTRY_ENVIRONMENT
```

The exact variables depend on the providers actually used by the implementation.

---

## 4. Environment Separation

The platform should distinguish at least:

```text
development
test
production
```

Additional environments may be introduced later if required.

Example:

```text id="7u3qmx"
Development
    ↓
Local developer machine

Test
    ↓
Automated tests / CI

Production
    ↓
Demo deployment
```

Environment-specific values must not be mixed.

---

## 5. `.env.example`

The repository should maintain a `.env.example` file containing the names of required environment variables without real secrets.

Example:

```text id="z7k8xq"
DATABASE_URL=
AUTH_SECRET=
PAYMENT_PROVIDER_SECRET_KEY=
PAYMENT_WEBHOOK_SECRET=
```

The example file should:

- Document required configuration.
- Use safe placeholder values where useful.
- Never contain production credentials.
- Be updated when new required configuration is introduced.

---

## 6. Secret Management

Secrets include:

- Passwords.
- API keys.
- Signing keys.
- Session secrets.
- Database credentials.
- Provider credentials.
- Webhook secrets.
- Private keys.

Secrets must be provided through secure mechanisms such as:

- Deployment environment variables.
- VPS secret configuration.
- CI/CD secret storage.
- Managed secret storage when introduced.

Do not store secrets in:

```text
Git
README files
source code
documentation
test fixtures
logs
client bundles
```

---

## 7. Public vs Server-Only Configuration

Next.js applications may expose variables prefixed with:

```text
NEXT_PUBLIC_
```

These values must be treated as public.

Never place secrets in public configuration.

For example:

```text
NEXT_PUBLIC_APP_URL
```

may be public.

A payment provider secret must remain server-only:

```text
PAYMENT_PROVIDER_SECRET_KEY
```

The configuration layer should enforce this separation.

---

## 8. Centralized Configuration

Application code should access configuration through a centralized configuration module.

Prefer:

```ts id="p7k1sv"
config.database.url
config.auth.sessionSecret
config.payment.provider
```

over:

```ts id="j8v5bq"
process.env.DATABASE_URL
process.env.AUTH_SECRET
process.env.PAYMENT_PROVIDER
```

throughout the codebase.

Direct environment access should be limited to the configuration implementation and narrowly justified infrastructure boundaries.

---

## 9. Configuration Validation

Configuration should be validated when the application starts.

Required configuration should fail fast.

Example:

```text id="h6n2yq"
Application startup
      ↓
Load environment
      ↓
Validate configuration
      ↓
Valid → start application
Invalid → fail startup
```

Do not allow the application to start with missing critical configuration and fail later during a customer request.

---

## 10. Type-Safe Configuration

The configuration layer should expose validated, typed values.

Example:

```ts id="9p7xw4"
type AppConfig = {
  environment: "development" | "test" | "production";
  database: {
    url: string;
  };
  auth: {
    secret: string;
  };
};
```

Consumers should not repeatedly parse environment variables themselves.

---

## 11. Defaults

Defaults are appropriate for non-sensitive optional configuration.

Examples:

```text id="8q0k1s"
LOG_LEVEL=info
```

or a reasonable request timeout.

Avoid defaults for security-critical configuration.

Do not silently invent:

```text id="4j7m1p"
AUTH_SECRET
DATABASE_PASSWORD
PAYMENT_PROVIDER_SECRET
```

Missing security-sensitive configuration should cause startup failure.

---

## 12. Environment-Specific Behavior

Environment-specific behavior should be explicit.

Examples:

```text id="3g9v2m"
development
→ verbose logging

test
→ isolated database

production
→ secure logging and production providers
```

Avoid scattering checks throughout business logic:

```ts id="v5k2r9"
if (process.env.NODE_ENV === "production") {
  // ...
}
```

when the behavior can be represented cleanly through configuration or infrastructure.

---

## 13. Feature Flags

Feature flags may be introduced when there is a genuine need for controlled rollout.

They should not become a substitute for normal application configuration.

A feature flag should have:

- Clear purpose.
- Defined owner.
- Known default.
- Rollout behavior.
- Removal plan where temporary.

Avoid permanent flags that create multiple undocumented application behaviors.

---

## 14. Payment Configuration

Payment configuration requires special handling.

The application must distinguish between:

```text id="0q8r6v"
Demo/test provider
Production provider
```

The Demo should use sandbox/test credentials and endpoints.

The application must never accidentally use production payment credentials in local development or automated tests.

Payment environment mismatches should fail fast.

---

## 15. Database Configuration

The database connection configuration should include only the values required by the database layer.

Typical configuration:

```text id="6z4k0m"
DATABASE_URL
DATABASE_POOL_SIZE
```

Connection pool configuration must be appropriate for the deployment environment.

Do not hardcode production database addresses into application code.

---

## 16. Storage Configuration

Object storage configuration should remain server-side.

Typical values may include:

```text id="k8y2p3"
STORAGE_PROVIDER
STORAGE_BUCKET
STORAGE_REGION
STORAGE_ACCESS_KEY
STORAGE_SECRET_KEY
```

Public media URLs may be exposed when appropriate, but credentials must never be sent to the browser.

---

## 17. Email Configuration

Email provider configuration should be centralized.

Typical values may include:

```text id="b7q5s4"
EMAIL_PROVIDER
EMAIL_API_KEY
EMAIL_FROM
```

Email credentials must remain server-side.

Development environments should use a safe test provider or local mail capture mechanism when available.

---

## 18. Configuration and Background Workers

Workers must load and validate the same required configuration relevant to their responsibilities.

Do not assume that because the web application validates a variable, the worker automatically has it.

The worker should fail startup when required worker configuration is missing.

Example:

```text id="r6n3k9"
Worker
    ↓
Validate worker configuration
    ↓
Start job processing
```

---

## 19. Configuration and CI/CD

CI/CD systems may provide configuration through protected secrets and environment variables.

CI must not print secret values in logs.

Use separate credentials for:

```text id="5w9m3c"
CI
Development
Production
```

where practical.

Production deployment credentials should have the minimum permissions required.

---

## 20. Configuration Rotation

Secrets should be replaceable without changing source code.

Examples:

```text id="1p8y7v"
database credentials
API keys
webhook signing secrets
session secrets
```

When rotating a secret, deployment procedures must account for active sessions or provider verification requirements where applicable.

Secret rotation procedures should not require committing the new secret to Git.

---

## 21. Configuration Changes

Configuration changes should be reviewed like code changes when they affect application behavior or security.

Examples requiring review:

- New secret.
- New external provider.
- Database connection change.
- Authentication configuration change.
- Payment configuration change.
- Storage access change.
- Production URL change.

Small operational value changes may be handled through deployment configuration without source changes, provided the change is documented and controlled.

---

## 22. Configuration Naming

Environment variables should use:

```text
UPPER_SNAKE_CASE
```

Examples:

```text
DATABASE_URL
AUTH_SECRET
PAYMENT_PROVIDER
PAYMENT_WEBHOOK_SECRET
SENTRY_DSN
```

Use consistent prefixes for related configuration.

Avoid ambiguous names such as:

```text
KEY
TOKEN
SECRET
URL
```

without identifying their purpose.

Prefer:

```text
PAYMENT_PROVIDER_SECRET_KEY
STORAGE_ACCESS_KEY
AUTH_SESSION_SECRET
```

---

## 23. Configuration Documentation

Every required environment variable should be documented in `.env.example` and, where necessary, deployment documentation.

Documentation should explain:

- What the variable controls.
- Whether it is required.
- Which environments use it.
- Whether it is secret.
- Where it is obtained.

Do not document actual credential values.

---

## 24. Local Development

Local developers should be able to configure the application without access to production secrets.

The local environment should use:

- Local PostgreSQL or approved development database.
- Sandbox payment providers.
- Development storage.
- Development authentication configuration.
- Development observability configuration.

Production credentials must never be required for normal local development.

---

## 25. Testing

Automated tests should not depend on developer-specific environment values.

Tests should use:

- Dedicated test configuration.
- Test database.
- Deterministic secrets where safe.
- Mock or sandbox providers.
- Isolated storage where required.

Tests must not accidentally connect to production resources.

---

## 26. Configuration Safety Checks

Where practical, the application should detect obviously unsafe environment combinations.

Examples:

```text id="r5k7s1"
test environment + production payment endpoint
development + production database
production + missing secure session secret
```

Unsafe combinations should fail startup or deployment validation.

---

## 27. Configuration and Multi-Tenancy

Tenant-specific business configuration must not be confused with infrastructure configuration.

Infrastructure configuration:

```text id="0m3f9n"
DATABASE_URL
PAYMENT_PROVIDER
STORAGE_BUCKET
```

Tenant/store configuration:

```text id="w6v8q2"
store currency
store locale
store timezone
store branding
store settings
```

Tenant-specific configuration belongs in the appropriate domain/database model.

It must not be represented as environment variables.

---

## 28. Configuration and Secrets in Logs

Configuration loading must never log secret values.

Avoid:

```text id="8c2q7p"
Loaded configuration:
{
  DATABASE_URL: "...",
  AUTH_SECRET: "..."
}
```

If startup diagnostics are required, log only safe metadata.

Example:

```text id="j7m1z5"
Database configuration loaded
Payment provider: sandbox
Environment: development
```

---

## 29. AI-Assisted Development

AI agents must follow strict configuration safety rules.

They must:

- Inspect `.env.example` before introducing configuration.
- Reuse existing configuration conventions.
- Never invent real credentials.
- Never commit `.env` files containing secrets.
- Never print secrets in generated logs.
- Avoid changing production configuration unless explicitly authorized.
- Update `.env.example` when introducing required variables.
- Update relevant deployment documentation when configuration changes.

AI agents must not assume that a missing environment variable should simply be given a hardcoded fallback.

---

## 30. Demo-to-V1 Evolution

The Demo configuration architecture should remain compatible with future deployment growth.

### Demo

```text id="q3p9w6"
Environment variables
Central configuration module
Basic secret management
Sandbox integrations
Single-region deployment
```

### V1

May add:

```text id="n6k4x2"
Managed secret storage
Multiple deployment environments
Secret rotation automation
Provider-specific configuration
Advanced feature flagging
Environment promotion controls
```

The application should continue consuming typed configuration through the same configuration boundary.

---

## 31. Configuration Checklist

Before completing a configuration-related change, verify:

- [ ] Required variables are identified.
- [ ] Configuration is centrally defined.
- [ ] Values are validated.
- [ ] Secrets remain server-side.
- [ ] `.env.example` is updated.
- [ ] Test configuration remains isolated.
- [ ] Production credentials are not used locally.
- [ ] Unsafe environment combinations are prevented where practical.
- [ ] Relevant deployment documentation is updated.
- [ ] No secrets were committed or logged.

---

## 32. Definition of Done

Configuration management is complete when:

- Configuration is centralized.
- Required values are validated at startup.
- Secrets are securely supplied.
- Public and private configuration are separated.
- Environment-specific behavior is explicit.
- Local and test environments are isolated from production.
- Configuration changes are documented.
- AI-assisted changes follow the same safety rules.
- The configuration boundary can evolve toward V1 without requiring application-wide changes.