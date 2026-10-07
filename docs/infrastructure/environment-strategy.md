# Environment Strategy

## 1. Purpose

This document defines the environment strategy for the Shopify-like commerce platform.

The goal is to maintain clear separation between development, testing, Demo, and future production environments while keeping the infrastructure appropriate for the current stage of the project.

---

## 2. Environment Principles

Each environment must have:

- Clearly defined purpose.
- Separate configuration.
- Appropriate data.
- Appropriate credentials.
- Appropriate external integrations.
- Controlled access.
- Reproducible deployment behavior.

An environment must never be treated as merely a different `.env` file.

---

## 3. Initial Environment Model

The project should use the following conceptual environments:

```text id="n8q3m7"
Development
    ↓
Test / CI
    ↓
Demo
    ↓
Future Production
```

For the current project, **Demo is the primary deployed environment**.

The environment model should remain simple until additional environments are actually needed.

---

## 4. Development

Development is used by individual developers.

Typical characteristics:

- Local machine.
- Local PostgreSQL.
- Development seed data.
- Sandbox payment provider.
- Development authentication configuration.
- Verbose but safe logging.
- Local object storage or development storage.

Development must never depend on production data.

---

## 5. Test / CI

The test environment is used for automated verification.

It should provide:

- Isolated database.
- Deterministic test data.
- Test authentication configuration.
- Sandbox integrations.
- CI-controlled secrets.
- Automated migrations.
- Unit/integration/E2E execution.

Test data must be disposable.

---

## 6. Demo

The Demo environment is the first shared deployed environment.

Its purpose is to demonstrate and validate the real platform.

Demo should use:

- Real application code.
- PostgreSQL.
- Docker.
- Web application.
- Worker.
- Sandbox/test payments.
- Appropriate object storage.
- Cloudflare or equivalent edge layer.
- Basic monitoring.

Demo is not a production substitute, but it should exercise production-like application behavior.

---

## 7. Future Production

Production will be introduced when the platform is ready for real customers and operational requirements justify it.

Production may evolve to include:

- Managed PostgreSQL.
- Redis.
- Dedicated object storage/CDN.
- Stronger observability.
- Dedicated secret manager.
- High availability.
- Automated backups.
- Disaster recovery.
- Infrastructure-as-code.
- Stronger deployment controls.

These should be introduced based on actual requirements rather than prematurely.

---

## 8. Environment Separation

Each environment must have independent:

- Database.
- Authentication secrets.
- Payment credentials.
- Webhook secrets.
- Object-storage configuration.
- Monitoring configuration.
- Application secrets.

Production credentials must never be reused in development or test.

---

## 9. Configuration Model

Configuration should be provided through environment variables or an approved configuration mechanism.

Application code should not contain environment-specific secrets or URLs.

Conceptually:

```text id="x4m8q2"
Application
      ↓
Configuration layer
      ↓
Environment variables
      ↓
Environment-specific values
```

---

## 10. Typed Configuration

Configuration should be loaded through a centralized configuration layer.

The configuration layer should:

- Parse environment variables.
- Validate required values.
- Apply safe defaults where appropriate.
- Distinguish public and private configuration.
- Reject invalid configuration.

Application code should not repeatedly parse raw environment variables.

---

## 11. Public vs Private Configuration

Configuration must be classified as:

### Public

Safe for browser exposure.

Examples:

- Public application URL.
- Public API URL.
- Public storefront configuration.

### Private

Server-only.

Examples:

- Database credentials.
- Session secrets.
- Payment credentials.
- Webhook secrets.
- OAuth client secrets.

A value should be treated as private unless explicitly determined to be public.

---

## 12. Environment Variables

Environment variables should have consistent naming.

Example:

```text id="m7q3x8"
DATABASE_URL
SESSION_SECRET
PAYMENT_SECRET_KEY
PAYMENT_WEBHOOK_SECRET
```

The actual names must follow the project's configuration implementation.

---

## 13. `.env.example`

The repository should maintain an example configuration file.

It should:

- List required variables.
- Provide safe placeholders.
- Explain non-obvious configuration where useful.
- Never contain real credentials.

Changes to required configuration should update `.env.example`.

---

## 14. Secret Management

Secrets must be managed separately from normal source configuration.

### Development

Use local environment configuration.

### CI

Use CI secret storage.

### Demo

Use secure VPS/runtime configuration or the selected deployment secret mechanism.

### Production

Use a dedicated secret-management mechanism when justified.

The secret-management design is defined in `docs/security/secrets-management.md`.

---

## 15. Database Separation

Each environment must have its own database.

For example:

```text id="q8m3v5"
Development → development database
Test        → test database
Demo        → Demo database
Production  → production database
```

Never point local development at the Demo or production database by accident.

---

## 16. Database Schema Consistency

All environments must use version-controlled migrations.

The expected flow is:

```text id="v5n8m2"
Migration committed
      ↓
Development
      ↓
CI/Test
      ↓
Demo
      ↓
Production
```

Environment differences must not be implemented through undocumented manual schema changes.

---

## 17. Database Data Policy

### Development

Synthetic data.

### Test

Disposable synthetic data.

### Demo

Demo/test data appropriate for demonstrations.

### Production

Real customer/business data.

Production data must never be copied into development or test without an explicitly approved, privacy-safe process.

---

## 18. Payment Environments

Payment providers must remain environment-specific.

Development and Test:

```text id="p3q8m6"
Sandbox/Test credentials
```

Demo:

```text id="x7m2n5"
Sandbox/Test credentials
```

Production:

```text id="r8q4v3"
Live credentials
```

The application must not accidentally connect to live payment processing from non-production environments.

---

## 19. Webhook Environments

Webhook endpoints should be environment-specific.

Each environment should have appropriate:

- Endpoint URL.
- Provider configuration.
- Signing secret.
- Event processing configuration.

Webhook events from one environment must not be processed by another environment.

---

## 20. Object Storage Environments

Object storage should be separated by environment.

Conceptually:

```text id="m4x8q2"
development/
test/
demo/
production/
```

Separate buckets are preferable where practical.

At minimum, object keys and credentials must prevent cross-environment access.

---

## 21. Authentication Environments

Authentication configuration must be environment-specific.

Development users must not authenticate against production systems.

Demo authentication must use the intended Demo identity configuration.

Production identity configuration must be separately controlled.

---

## 22. Monitoring Environments

Monitoring should distinguish environments.

Logs and errors should include an environment identifier.

Example:

```text id="q7m3x8"
environment=development
environment=test
environment=demo
environment=production
```

This prevents Demo failures from being confused with production incidents.

---

## 23. Sentry / Error Tracking

If Sentry or equivalent monitoring is used, releases and environments should be clearly separated.

For example:

```text id="n8q4m2"
project=shopify-clone
environment=demo
release=<commit>
```

Production monitoring must not be polluted by development errors.

---

## 24. Feature Flags

Feature flags may differ between environments.

However, flags must not be used to bypass:

- Authentication.
- Authorization.
- Tenant isolation.
- Payment security.
- Database integrity.

Security controls must never depend solely on a feature flag.

---

## 25. Environment-Specific URLs

Application URLs should come from configuration.

Examples:

```text id="x6m3q8"
APP_URL
API_URL
STOREFRONT_URL
```

Hardcoding Demo or production URLs inside business logic should be avoided.

---

## 26. CORS

CORS configuration must be environment-specific where necessary.

Allowed origins should be explicit.

Avoid:

```text id="m8q3v5"
allow all origins
```

for authenticated or sensitive APIs.

---

## 27. Cookies and Security Settings

Cookie behavior may differ between local HTTP development and HTTPS deployment.

Production/Demo should use appropriate secure settings.

Environment-specific behavior must be deliberate and documented rather than scattered throughout application code.

---

## 28. Logging Levels

Logging may vary by environment.

Example:

```text id="q4n8x2"
Development → debug
Test        → controlled
Demo        → info
Production  → info/warn/error
```

Regardless of environment, sensitive data must remain protected.

---

## 29. Debug Features

Development-only debugging must not accidentally become available in Demo or production.

Examples include:

- Debug endpoints.
- Development seed routes.
- Test authentication shortcuts.
- Mock payment bypasses.
- Detailed internal error pages.

These must be explicitly restricted or removed from deployed environments.

---

## 30. Environment Detection

Application behavior should use centralized environment configuration rather than scattered checks such as:

```text id="x7m4q8"
if NODE_ENV === ...
```

Business logic should not depend directly on environment variables.

Environment-specific behavior belongs in configuration/infrastructure boundaries.

---

## 31. CI Environment

CI should provide a controlled environment containing:

- Required configuration.
- Test database.
- Test secrets.
- Sandbox provider credentials where required.
- Appropriate environment identifier.

CI must never receive production secrets unless a highly specific, reviewed deployment step requires them.

---

## 32. Demo Deployment Configuration

Demo deployment should be reproducible from repository configuration plus securely stored environment values.

The deployment should define:

- Image/version.
- Runtime environment.
- Database connection.
- Worker configuration.
- Domain configuration.
- Object storage.
- Monitoring.
- Payment sandbox configuration.

---

## 33. Production Promotion

When production is introduced, deployment should promote a verified artifact rather than rebuilding arbitrary source code directly on the server.

Conceptually:

```text id="p8m3x7"
Git commit
   ↓
CI
   ↓
Tests
   ↓
Build artifact
   ↓
Demo
   ↓
Production
```

The exact promotion process will depend on the eventual deployment infrastructure.

---

## 34. Environment Access Control

Access should become increasingly restricted:

```text id="n4m8q2"
Development → broad developer access
Test        → CI-controlled
Demo        → restricted team access
Production  → tightly restricted
```

Production access must be explicitly authorized and auditable.

---

## 35. AI Environment Access

AI development tools must not receive unrestricted production access.

AI agents should normally work with:

- Local development.
- Test environments.
- Safe Demo access where explicitly authorized.

Production access, especially to databases and secrets, must require explicit controlled procedures.

---

## 36. Environment Drift

Environment drift should be minimized.

Common sources include:

- Manual server changes.
- Different dependency versions.
- Untracked configuration.
- Manual database changes.
- Different runtime versions.

Version-controlled configuration and repeatable deployment processes should reduce drift.

---

## 37. Environment Validation

Deployment should validate critical configuration before starting the application.

Examples:

```text id="j7m3q8"
Missing DATABASE_URL
→ deployment/startup failure

Production using sandbox payment configuration
→ explicit configuration review/error where required

Missing webhook secret
→ webhook processing unavailable/fails safely
```

---

## 38. Environment Promotion Checklist

Before promoting an artifact:

```text id="x5q8m3"
[ ] Correct commit/image identified
[ ] Tests passed
[ ] Configuration verified
[ ] Database migrations reviewed
[ ] Required secrets configured
[ ] Payment environment verified
[ ] Webhook configuration verified
[ ] Object storage configuration verified
[ ] Monitoring configured
[ ] Rollback artifact available
```

---

## 39. Demo-to-V1 Evolution

The environment strategy should evolve gradually.

### Demo

```text
Local
Test/CI
Demo VPS
```

### V1

Potentially:

```text
Local
Test
Staging
Production
```

Additional staging infrastructure should be introduced when deployment risk and team size justify it.

---

## 40. Anti-Patterns

Avoid:

- Sharing production databases.
- Sharing production credentials.
- Copying production data into local environments casually.
- Hardcoding environment URLs.
- Environment-specific business logic.
- Debug endpoints in production.
- Live payment credentials in Demo.
- Untracked manual production configuration.
- Giving AI unrestricted production access.

---

## 41. Definition of Done

Environment strategy is complete when:

```text id="q8m4x3"
[ ] Development environment is defined
[ ] Test/CI environment is defined
[ ] Demo environment is defined
[ ] Production evolution path is defined
[ ] Databases are separated
[ ] Secrets are separated
[ ] Payment environments are separated
[ ] Webhook environments are separated
[ ] Object storage is separated
[ ] Monitoring distinguishes environments
[ ] Configuration is centralized
[ ] Public/private configuration is distinguished
[ ] Debug functionality is restricted
[ ] Production access is restricted
[ ] Environment drift is minimized
[ ] Deployment configuration is reproducible
```