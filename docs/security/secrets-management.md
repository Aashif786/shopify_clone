# Secrets Management

## 1. Purpose

This document defines how secrets are created, stored, accessed, rotated, and protected across the Shopify-like commerce platform.

Secrets include credentials, tokens, private keys, encryption keys, signing secrets, database passwords, API keys, and other values that must not be publicly exposed.

---

## 2. Core Principles

Secrets must:

- Never be committed to Git.
- Never be embedded in source code.
- Never be exposed to browser clients unless explicitly required.
- Never be logged.
- Be supplied through controlled configuration.
- Be separated by environment.
- Have the minimum required scope.
- Be rotated when necessary.
- Be accessible only to the components that require them.

---

## 3. Secret Categories

Typical application secrets include:

| Category | Examples |
|---|---|
| Database | PostgreSQL credentials |
| Authentication | Session secrets, signing keys |
| OAuth | Client secrets |
| Payments | Provider secret keys |
| Webhooks | Webhook signing secrets |
| Email | SMTP/API credentials |
| Object storage | Access keys |
| Monitoring | Sentry authentication token |
| Deployment | VPS/CI credentials |
| Encryption | Encryption keys |

Not every secret is required in the Demo.

Only secrets required by implemented functionality should be introduced.

---

## 4. Environment Separation

Secrets must be separated between:

```text
Development
Test
Staging
Production
```

A development secret must never automatically provide access to production resources.

Production credentials must never be placed in local `.env` files distributed to developers.

---

## 5. Local Development

Local development should use environment variables or an approved local secret mechanism.

Example:

```text
DATABASE_URL=...
SESSION_SECRET=...
PAYMENT_SECRET_KEY=...
```

Actual values must remain local and uncommitted.

The repository should contain:

```text
.env.example
```

with placeholders rather than real credentials.

---

## 6. `.env.example`

`.env.example` documents required configuration without containing real secrets.

Example:

```text
DATABASE_URL=
SESSION_SECRET=
PAYMENT_SECRET_KEY=
PAYMENT_WEBHOOK_SECRET=
```

Descriptions may be added where useful.

Do not place realistic production credentials into example files.

---

## 7. Git Protection

Secrets must never be committed.

Developers should use:

- `.gitignore`.
- Secret scanning.
- Pre-commit checks where appropriate.
- CI secret detection.

Common files that should generally remain untracked include:

```text
.env
.env.local
.env.production
```

The exact ignore configuration must match the repository's environment strategy.

---

## 8. Accidental Secret Exposure

If a secret is accidentally committed:

1. Treat it as compromised.
2. Revoke or rotate it.
3. Remove it from active source history where appropriate.
4. Investigate potential exposure.
5. Replace affected credentials.
6. Add or improve secret-detection controls.

Simply deleting the file in a later commit is not sufficient if the secret remains usable.

---

## 9. Secret Rotation

Secrets should support rotation without requiring unnecessary application redesign.

Rotation may be required because of:

- Suspected compromise.
- Employee departure.
- Provider policy.
- Credential expiration.
- Security incident.
- Scheduled security policy.

Applications should avoid architectures where rotating one secret requires a full code rewrite.

---

## 10. Zero Secret Logging

Secrets must never appear in:

- Application logs.
- Error messages.
- Stack traces.
- API responses.
- Database records unless specifically designed for encrypted secret storage.
- Analytics events.
- CI output.
- Monitoring metadata.
- Screenshots or test artifacts.

Logging frameworks should provide redaction where appropriate.

---

## 11. Secret Redaction

Sensitive configuration values should be redacted before logging.

For example:

```text
DATABASE_URL=postgres://...
```

must never appear as a full connection string in logs.

Instead, logs should contain safe metadata such as:

```text
database connection failed
```

without credentials.

---

## 12. Browser Exposure

Only explicitly public configuration may be exposed to the browser.

Examples of potentially public values:

```text
public application URL
public store identifier
public analytics identifier
```

Examples that must remain server-side:

```text
database credentials
payment secret keys
webhook secrets
session secrets
OAuth client secrets
object-storage private credentials
```

Never rely on frontend code to hide a secret.

---

## 13. Next.js Environment Handling

Because the Demo uses Next.js, environment variables intended for browser exposure must be explicitly distinguished from server-only configuration.

Variables using the framework's public prefix must be treated as public.

Before exposing a variable, verify that its value is safe for any user to see.

---

## 14. Configuration Validation

Required secrets should be validated during application startup or configuration initialization.

Example:

```text
Missing PAYMENT_WEBHOOK_SECRET
        ↓
Configuration validation failure
        ↓
Application does not start correctly
```

The system should fail clearly rather than silently operating with insecure defaults.

---

## 15. No Insecure Defaults

Security-sensitive configuration must not use predictable fallback values such as:

```text
secret
password
admin
development-secret
changeme
```

Defaults may exist for harmless local configuration, but authentication and encryption secrets must require intentional configuration.

---

## 16. Database Credentials

Database credentials should:

- Be environment-specific.
- Have only required database privileges.
- Never appear in source control.
- Never appear in logs.
- Be rotated when required.

Production database access should be restricted to the required application components.

---

## 17. Payment Credentials

Payment provider credentials are highly sensitive.

They must:

- Remain server-side.
- Never be sent to browsers.
- Never be committed.
- Never appear in logs.
- Be separated between test and production environments.
- Be rotated if exposed.

The application must use provider sandbox/test credentials during development and automated testing.

---

## 18. Webhook Secrets

Webhook signing secrets must remain server-side.

Webhook verification should:

```text
Incoming webhook
  ↓
Read provider signature
  ↓
Use server-side secret
  ↓
Verify signature
  ↓
Accept or reject
```

The secret must never be returned through an API or frontend response.

---

## 19. Authentication Secrets

Session and token-signing secrets must be:

- Cryptographically strong.
- Environment-specific.
- Stored securely.
- Rotatable according to the authentication architecture.
- Excluded from logs.

Changing a signing secret may invalidate existing sessions depending on implementation.

This behavior should be intentional and documented.

---

## 20. Object Storage Credentials

Private object-storage credentials must remain server-side.

Where possible, the application should avoid exposing long-lived storage credentials to browsers.

For direct browser uploads, use controlled mechanisms such as appropriately scoped temporary upload authorization.

---

## 21. OAuth Credentials

OAuth client secrets must remain server-side.

Public OAuth client identifiers may sometimes be exposed depending on the provider, but client secrets must never be treated as public configuration.

Redirect URIs must be explicitly configured and validated.

---

## 22. CI/CD Secrets

CI/CD systems may require secrets for:

- Container registry.
- VPS deployment.
- Cloudflare.
- Monitoring.
- External providers.

CI secrets should:

- Be stored in the CI platform's secret store.
- Be scoped to required workflows/environments.
- Not be printed.
- Not be written into repository files.
- Use least privilege.

---

## 23. Deployment Secrets

Production deployment should inject secrets at deployment/runtime rather than committing them into the application image or repository.

A typical model is:

```text
GitHub
  ↓
CI/CD
  ↓
Deployment
  ↓
Production environment
  ↓
Runtime secrets
```

The exact secret-management mechanism may evolve as infrastructure matures.

---

## 24. Docker Secrets

Secrets must not be embedded into Docker images through:

```text
Dockerfile
ENV SECRET=...
COPY .env ...
```

Build-time secrets and runtime secrets must be handled deliberately.

A production image should not contain development `.env` files.

---

## 25. Docker Compose

Local Docker Compose configuration may reference environment variables from the developer's environment or local environment files.

Actual credentials must remain outside version control.

Example:

```yaml
services:
  db:
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```

The repository should contain configuration structure, not real credentials.

---

## 26. Least Privilege

Each component should receive only the secrets it requires.

For example:

```text
Web app
→ database access
→ payment provider access if required

Worker
→ database access
→ provider credentials required by its jobs

Browser
→ no server secrets
```

Do not provide every secret to every process simply because it is convenient.

---

## 27. Worker Secrets

Background workers must receive only credentials required for their jobs.

A worker should not automatically receive:

- Unused provider credentials.
- Deployment credentials.
- Administrative secrets.
- Unrelated service keys.

This reduces blast radius if the worker is compromised.

---

## 28. Secret Storage in Database

Secrets should not normally be stored directly in PostgreSQL.

If the product later requires storing provider credentials or other tenant-specific secrets, they should use an appropriate encryption-at-rest design with controlled key management.

Encryption keys must not be stored alongside encrypted values without appropriate protection.

---

## 29. Tenant-Specific Secrets

If future functionality requires each store to configure its own external provider credentials:

```text
Store
  ↓
Encrypted credential
  ↓
Provider adapter
```

Access must be:

- Tenant-scoped.
- Authorization-controlled.
- Audited where appropriate.
- Redacted from logs.
- Decrypted only when required.

The Demo should not build complex secret-management infrastructure without a real requirement.

---

## 30. Secret Access Auditing

Sensitive administrative secret operations should be auditable where appropriate.

Examples:

- Secret creation.
- Secret replacement.
- Secret deletion.
- Provider credential changes.

Audit records must not contain the actual secret values.

---

## 31. Production Access

Production credentials and secret stores must have restricted access.

Developers and AI agents must not receive unrestricted production secret access.

Production operations should use:

- Least privilege.
- Controlled credentials.
- Auditable access.
- Separate production environment configuration.

---

## 32. AI Development Rules

AI-assisted development must never:

- Request or expose production secrets unnecessarily.
- Commit credentials.
- Generate fake credentials that resemble real production secrets.
- Print environment variables for debugging without filtering.
- Include secrets in tests.
- Place secrets into source files.
- Copy production `.env` files into the repository.
- Disable secret validation to make development easier.

If a task requires a credential, use the approved environment configuration mechanism.

---

## 33. Secret Detection

The project should use automated secret detection where practical.

Detection should cover common credential patterns such as:

- API keys.
- Private keys.
- Tokens.
- Database URLs containing credentials.
- Cloud credentials.
- Provider secrets.

Secret detection should run before sensitive changes are merged where practical.

---

## 34. Secret Rotation Procedure

When a secret must be rotated:

```text
Identify secret
  ↓
Generate replacement
  ↓
Configure replacement
  ↓
Deploy/update dependent component
  ↓
Verify functionality
  ↓
Revoke old secret
  ↓
Verify old secret no longer works
```

The order should be adapted to provider-specific rotation requirements.

---

## 35. Compromised Secret Procedure

If a production secret is suspected to be compromised:

1. Revoke or disable it immediately when safe.
2. Generate a replacement.
3. Deploy the replacement.
4. Investigate access logs.
5. Identify affected systems.
6. Determine whether data was accessed.
7. Add regression/security controls.
8. Document the incident.

Security response should prioritize containment over preserving convenience.

---

## 36. Secret Testing

Security tests should verify:

```text
[ ] Secrets are not returned by APIs
[ ] Secrets are not present in logs
[ ] Browser bundles contain no server secrets
[ ] Missing required secrets fail safely
[ ] Invalid credentials fail safely
[ ] Test and production credentials remain separated
[ ] Secret rotation works where required
[ ] Webhook secrets remain server-side
[ ] Payment secrets remain server-side
```

---

## 37. Secret Management Evolution

### Demo

Use:

- Environment variables.
- `.env.example`.
- VPS environment configuration.
- CI/CD secret storage.
- Basic secret detection.

### V1

May introduce:

- Dedicated secret manager.
- Automated rotation.
- Stronger audit trails.
- Fine-grained workload identity.
- Managed key infrastructure.

The Demo should not introduce a dedicated secrets platform without a demonstrated need.

---

## 38. Definition of Done

Secrets management is complete when:

```text
[ ] No secrets are committed
[ ] .env.example contains placeholders only
[ ] Environment separation exists
[ ] Server-only secrets remain server-side
[ ] Secrets are not logged
[ ] Required configuration is validated
[ ] Production credentials are isolated
[ ] CI/CD secrets use secure storage
[ ] Docker images contain no runtime secrets
[ ] Components receive only required secrets
[ ] Secret detection is configured where appropriate
[ ] Rotation procedures are defined
[ ] Compromise response is defined
[ ] Relevant security tests pass
[ ] Production access is restricted
```