# Local Development

## 1. Purpose

This document defines the local development environment for the Cal Cart commerce platform.

The goal is to provide developers with a consistent, reproducible environment that closely reflects the Demo architecture without introducing unnecessary infrastructure complexity.

---

## 2. Development Principles

Local development should:

- Be reproducible.
- Minimize environment-specific behavior.
- Use the same core technologies as Demo deployment.
- Keep infrastructure simple.
- Protect secrets.
- Support fast feedback.
- Make database setup predictable.
- Allow individual modules to be developed independently where practical.

---

## 3. Local Architecture

The expected local architecture is:

```text
Developer Machine
      │
      ├── Next.js Web App
      │
      ├── Worker
      │
      ├── PostgreSQL
      │
      └── Optional local supporting services
```

Docker may be used for infrastructure dependencies while application code runs directly on the developer machine.

---

## 4. Required Tooling

The project should standardize on:

- Node.js version defined by the repository.
- pnpm.
- Git.
- Docker/Docker Compose where required.
- PostgreSQL through the approved local setup.
- A supported IDE/editor.

The exact versions should be defined in repository configuration rather than duplicated across documentation.

---

## 5. Repository Setup

A new developer should be able to:

```text id="n5m8q3"
Clone repository
      ↓
Install dependencies
      ↓
Configure environment
      ↓
Start infrastructure
      ↓
Run migrations
      ↓
Seed development data
      ↓
Start application
      ↓
Run tests
```

Setup instructions must remain synchronized with the actual repository.

---

## 6. Dependency Installation

Dependencies should be installed from the repository lockfile.

For pnpm:

```bash id="8x3m6q"
pnpm install --frozen-lockfile
```

Developers should avoid manually modifying dependency versions unless intentionally performing a dependency change.

---

## 7. Environment Configuration

Local configuration should be based on:

```text id="q7m2v8"
.env.example
```

Developers should create an appropriate local environment file without committing it.

Example:

```text id="r4n8x3"
.env.local
```

The actual environment-file strategy must follow the repository's configuration implementation.

---

## 8. Environment Validation

The application should validate required configuration during startup.

A missing required value should produce a clear error rather than causing an unrelated runtime failure later.

Example:

```text id="m6x3q9"
Missing DATABASE_URL
→ configuration error
```

---

## 9. Local Database

PostgreSQL should be the primary local database.

The local database should reflect the application's actual PostgreSQL behavior as closely as practical.

Do not use an in-memory database as a substitute for PostgreSQL integration testing.

---

## 10. Docker PostgreSQL

Docker may provide the local PostgreSQL environment.

A typical setup is:

```text id="v8q3m5"
Docker
  ↓
PostgreSQL container
  ↓
Application
```

The exact image version should be pinned in repository configuration.

---

## 11. Database Initialization

A new local environment should support:

```text id="x4m7q2"
Create database
      ↓
Run migrations
      ↓
Seed development data
```

Database initialization must be repeatable.

---

## 12. Migrations

Database schema changes must be performed through the project's migration system.

Developers should not manually modify production-like schemas using ad-hoc SQL that bypasses migrations.

The migration workflow should support:

- Applying migrations.
- Creating new migrations.
- Resetting development databases where appropriate.
- Verifying migration state.

---

## 13. Seed Data

Development seed data should provide realistic entities such as:

```text id="p7n3m8"
Organization
Store
Users
Memberships
Products
Variants
Inventory
Customers
Discounts
Orders
```

Seed data must be clearly identified as development data.

It must never contain real customer information or production secrets.

---

## 14. Test Data vs Development Data

Development data and automated test data should remain conceptually separate.

Development data exists for:

```text id="k8m4x2"
manual development
UI testing
local demonstrations
```

Test data exists for:

```text id="q3v7n5"
deterministic automated tests
```

Tests should not depend on mutable developer seed data.

---

## 15. Starting the Web Application

The main application runs from:

```text id="m9x3q6"
apps/web
```

The repository's actual package scripts should define the canonical development command.

Do not document commands that are not present in the repository.

---

## 16. Starting the Worker

Background processing runs from:

```text id="x7q2m8"
apps/worker
```

The worker should be independently startable during development.

This allows developers to test:

- Background jobs.
- Retry behavior.
- Webhook processing.
- Notifications.
- Recovery workflows.

---

## 17. Running Web and Worker Together

For normal development, both application processes may run simultaneously:

```text id="r5m8q3"
Terminal 1 → Web
Terminal 2 → Worker
Terminal 3 → Infrastructure
```

A future development orchestrator may simplify this, but unnecessary tooling should not be introduced prematurely.

---

## 18. Local Service Ports

Local service ports should be centrally documented or configured.

Typical services may include:

```text id="q6n3x8"
Web application
PostgreSQL
Optional object storage emulator
Optional supporting services
```

Port collisions should be resolved through environment configuration rather than hardcoded assumptions where practical.

---

## 19. Local Object Storage

If media functionality requires object storage, development may use:

- A local object-storage-compatible service.
- A dedicated development bucket.
- A controlled cloud development bucket.

The choice should prioritize tenant isolation and predictable behavior.

Production buckets must never be used for normal local development.

---

## 20. Payment Development

Payment integrations must use provider sandbox/test credentials.

Local development must never process real payments.

Test scenarios should include:

- Successful payment.
- Failed payment.
- Refund.
- Webhook delivery.
- Duplicate webhook.
- Payment timeout/recovery.

---

## 21. Webhook Development

External webhooks may require a secure development tunnel or provider-specific development mechanism.

The local environment must verify webhook signatures exactly as production does.

Developers should not disable webhook verification merely because local networking is inconvenient.

---

## 22. Authentication Development

Local authentication should use development/test configuration.

Developers should be able to create test identities without interacting with production identity systems.

Authentication flows should remain as close as practical to the actual application behavior.

---

## 23. Multi-Tenant Development

Developers should maintain at least two development stores when working on tenant-sensitive functionality.

Example:

```text id="f8m3q7"
Store A
  Product A

Store B
  Product B
```

This makes accidental cross-tenant access easier to detect during development.

---

## 24. Debugging

Debugging should use:

- Structured application logs.
- Database inspection.
- Browser developer tools.
- Worker logs.
- Request/correlation IDs.

Debug logging must not expose secrets or sensitive customer information.

---

## 25. Logging

Local logging may be more verbose than production logging, but security rules remain unchanged.

Never log:

- Passwords.
- Session tokens.
- API keys.
- Payment credentials.
- Webhook secrets.
- Full sensitive personal data.

---

## 26. Hot Reloading

Application development should use the framework's normal development-mode reload behavior.

Developers should not introduce custom reload mechanisms unless required by the architecture.

---

## 27. Code Quality Checks

Before opening a pull request, developers should run the repository's configured checks.

The expected categories include:

```text id="n4m7x2"
Lint
Typecheck
Unit tests
Integration tests
Build
Relevant E2E tests
```

The actual commands must come from the repository's package scripts.

---

## 28. Git Workflow

Developers should work on short-lived branches.

Typical flow:

```text id="q8m3v6"
Update main
  ↓
Create feature branch
  ↓
Implement
  ↓
Run verification
  ↓
Commit
  ↓
Open PR
```

Never commit secrets or generated local state.

---

## 29. Local Database Reset

A database reset may be used during development when appropriate.

Reset operations must:

- Clearly target the development database.
- Never target production.
- Be documented.
- Reapply migrations.
- Recreate seed data where configured.

Commands capable of destructive resets should require deliberate developer execution.

---

## 30. Production Protection

Local tooling must make accidental production access difficult.

Developers should not casually configure:

```text id="p6x2m8"
production DATABASE_URL
production payment credentials
production object storage
production secret keys
```

into normal local development.

---

## 31. AI-Assisted Development

AI coding tools must follow the project's AI development rules.

Before making changes, the AI must:

1. Read the actual root `AGENTS.md`.
2. Inspect the repository state.
3. Read relevant architecture/specification documents.
4. Inspect existing implementation patterns.
5. Make the smallest safe change.
6. Run appropriate verification.
7. Review the resulting diff.

AI must not assume the local environment matches another developer's environment.

---

## 32. Troubleshooting

Common categories of local-development failures include:

### Dependencies

```text
pnpm install
```

Verify Node.js and pnpm versions before changing dependency configuration.

### Database

Check:

- PostgreSQL container status.
- `DATABASE_URL`.
- Migration state.
- Database connectivity.

### Application

Check:

- Environment variables.
- Package scripts.
- Application logs.
- Port conflicts.

### Worker

Check:

- Worker configuration.
- Database connectivity.
- Job availability.
- Worker logs.

---

## 33. Dependency Changes

When adding a dependency:

- Confirm it is actually required.
- Check whether existing packages already provide the capability.
- Prefer established project dependencies.
- Review maintenance and security.
- Update the lockfile.
- Run relevant tests.

AI-generated dependency additions require the same review as human-generated changes.

---

## 34. Local Development Documentation

Local-development instructions should remain close to the actual repository configuration.

If commands change, documentation must be updated.

Avoid maintaining contradictory setup instructions across:

- README.
- Docs.
- Package scripts.
- AI instructions.

---

## 35. Development Environment Reproducibility

A new developer should be able to reproduce the essential environment without relying on undocumented machine-specific configuration.

Machine-specific workarounds should not become project architecture.

---

## 36. Definition of Done

Local development is considered properly configured when:

```text id="z8m3q6"
[ ] Repository can be cloned
[ ] Dependencies install from lockfile
[ ] Environment configuration is documented
[ ] Required configuration is validated
[ ] PostgreSQL starts successfully
[ ] Migrations can be applied
[ ] Development seed data can be created
[ ] Web application starts
[ ] Worker starts
[ ] Test environment is available
[ ] Payment uses sandbox/test configuration
[ ] Production credentials are isolated
[ ] Tenant isolation can be tested locally
[ ] Relevant quality checks can run locally
[ ] Documentation matches actual repository commands
```