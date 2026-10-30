# CI/CD

## 1. Purpose

This document defines the Continuous Integration and Continuous Deployment strategy for the Cal Cart commerce platform.

The CI/CD system must provide repeatable verification, controlled deployment, traceability, and safe rollback while remaining appropriately simple for the Demo environment.

---

## 2. Objectives

The CI/CD pipeline must:

- Validate every relevant code change.
- Prevent known-broken code from being deployed.
- Run automated tests.
- Validate type safety and buildability.
- Validate database migrations where applicable.
- Build reproducible deployment artifacts.
- Deploy only from approved branches or release workflows.
- Provide deployment traceability.
- Support rollback.
- Protect secrets.
- Avoid unnecessary infrastructure complexity.

---

## 3. CI/CD Architecture

The intended flow is:

```text
Developer
    │
    ▼
Git Branch
    │
    ▼
Pull Request
    │
    ▼
GitHub Actions
    │
    ├── Lint
    ├── Typecheck
    ├── Unit Tests
    ├── Integration Tests
    ├── Build
    └── Security Checks
    │
    ▼
Merge
    │
    ▼
Deployment Pipeline
    │
    ├── Build Image
    ├── Publish Image
    ├── Deploy VPS
    ├── Apply Migration
    └── Health Check
    │
    ▼
Demo
```

---

## 4. Continuous Integration

CI runs automatically for relevant repository changes.

The CI pipeline should verify the repository before code is merged.

At minimum:

```text
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The exact commands must match the actual root `package.json` scripts.

CI documentation must never claim a command exists until it is implemented.

---

## 5. Pull Request Validation

Pull requests should trigger automated checks.

Typical checks include:

- Dependency installation.
- Formatting/lint validation.
- Type checking.
- Unit tests.
- Integration tests.
- Build validation.
- Relevant E2E tests.
- Security checks.

The required checks should be enforced through GitHub branch protection where appropriate.

---

## 6. Pull Request Quality

A pull request should contain:

- Clear purpose.
- Relevant implementation changes.
- Tests appropriate to the change.
- Migration information if applicable.
- Configuration changes if applicable.
- API/spec changes if applicable.
- Documentation updates where required.

Unrelated changes should not be bundled into the same pull request.

---

## 7. Dependency Installation

CI must use the repository lockfile.

For pnpm-based development:

```text
pnpm install --frozen-lockfile
```

should be preferred for reproducible CI environments.

CI must fail rather than silently modifying the lockfile.

---

## 8. Node and pnpm Versions

CI must use the repository-defined supported Node.js and pnpm versions.

The versions should be centrally defined where practical.

Local development and CI should use compatible versions to avoid environment-specific failures.

---

## 9. Test Database

Integration tests requiring PostgreSQL should run against an isolated CI database.

The CI database must not be connected to Demo or production data.

A typical flow is:

```text
CI Runner
   ↓
PostgreSQL Test Database
   ↓
Migrations
   ↓
Tests
   ↓
Database discarded
```

---

## 10. Database Migrations in CI

Database migrations should be tested automatically.

CI should verify that:

- Migrations apply successfully.
- The schema can be created from scratch.
- Relevant database constraints work.
- Application code works against the migrated schema.

Migration failures must fail CI.

---

## 11. Test Isolation

Tests must not share mutable state unexpectedly.

Where practical:

- Use isolated test databases.
- Reset database state between test suites.
- Use deterministic fixtures.
- Avoid depending on test execution order.

Tests must never modify Demo or production databases.

---

## 12. E2E Testing

Playwright E2E tests should run against an isolated application environment.

Typical flow:

```text
Build Application
      ↓
Start Test Services
      ↓
Apply Migrations
      ↓
Seed Test Data
      ↓
Start Web Application
      ↓
Run Playwright
      ↓
Collect Artifacts
```

---

## 13. Critical E2E Coverage

Critical flows should include:

- Authentication.
- Store creation.
- Product creation.
- Inventory management.
- Storefront browsing.
- Cart creation.
- Checkout.
- Sandbox payment.
- Order creation.
- Order management.

Tenant-isolation and authorization scenarios should also be represented.

---

## 14. Build Verification

The production application build must run in CI.

The build must fail when:

- Type errors prevent compilation.
- Required build configuration is missing.
- Application compilation fails.
- Required generated artifacts cannot be produced.

A successful build does not replace testing.

---

## 15. Static and Security Checks

CI should include appropriate automated security checks.

Potential checks include:

- Dependency vulnerability scanning.
- Secret scanning.
- Static analysis.
- Lockfile validation.
- Container image scanning where available.

Security tooling should produce actionable failures rather than becoming ignored noise.

---

## 16. Secret Scanning

Secrets must be detected before they reach the repository.

CI should scan for common credential patterns.

If a secret is accidentally committed:

1. Stop further propagation.
2. Revoke/rotate the secret.
3. Remove it from the repository history when necessary.
4. Investigate exposure.
5. Verify the replacement secret.

Removing the text from the latest commit alone does not make a leaked credential safe.

---

## 17. Container Build

The deployment pipeline should build the web and worker images from the repository source.

Example:

```text
Git commit
    ↓
Docker build
    ↓
Image
    ↓
Tests / validation
    ↓
Image registry
```

Images should be associated with an immutable identifier such as:

```text
commit SHA
```

rather than relying only on mutable tags such as `latest`.

---

## 18. Image Tagging

Recommended tags include:

```text
web:<commit-sha>
worker:<commit-sha>
```

Optional human-readable release tags may also be used.

The deployed version must be identifiable from the running application or deployment metadata.

---

## 19. Image Registry

Container images should be stored in an authenticated registry.

The registry may be GitHub Container Registry or another suitable provider.

The registry must not expose private application images unintentionally.

---

## 20. Demo Deployment Trigger

Demo deployment should occur only after CI verification succeeds.

A typical model is:

```text
Pull Request
     ↓
CI
     ↓
Merge to deployment branch
     ↓
Build release artifact
     ↓
Deploy Demo
```

The exact branch should follow the repository's Git workflow.

---

## 21. Deployment Authentication

GitHub Actions must authenticate to the VPS or deployment system using dedicated credentials.

Deployment credentials must:

- Be stored as CI secrets.
- Be scoped to deployment.
- Not be committed to Git.
- Not be printed in logs.
- Be rotated when necessary.

---

## 22. SSH Deployment

If SSH is used for Demo deployment:

```text
GitHub Actions
      ↓
Authenticated SSH
      ↓
VPS
      ↓
Pull immutable image
      ↓
Deploy
```

The deployment key should have only the access required to perform deployment.

---

## 23. Deployment Script

Deployment logic should be represented by a version-controlled deployment script rather than a long sequence of manually typed commands.

The script should handle:

- Selecting the application version.
- Pulling images.
- Applying required configuration.
- Running migrations.
- Updating containers.
- Health checks.
- Failure handling.

Secrets must remain external to the repository.

---

## 24. Database Migration During Deployment

Database migrations must be treated as a controlled deployment step.

The pipeline should:

1. Identify the application version.
2. Verify migration compatibility.
3. Apply required migrations.
4. Deploy compatible application code.
5. Verify application health.

Destructive migrations require additional review.

---

## 25. Migration Compatibility

When deployment involves both old and new application versions, schema changes should follow an expand-and-contract strategy.

Example:

```text
Release A
   ↓
Add compatible schema
   ↓
Release B
   ↓
Migrate application usage
   ↓
Release C
   ↓
Remove obsolete schema
```

This minimizes deployment coupling.

---

## 26. Deployment Health Checks

After deployment, CI/CD should verify:

- Web health endpoint.
- Application readiness.
- Worker availability.
- Database connectivity.
- Critical application startup.
- Deployment version.

A deployment should be considered unsuccessful if health checks fail.

---

## 27. Smoke Testing

Post-deployment smoke tests should verify a small number of critical operations.

Example:

```text
Application reachable
       ↓
Authentication works
       ↓
Storefront works
       ↓
Product loads
       ↓
Checkout endpoint/application works
```

Full E2E testing should not necessarily be repeated after every Demo deployment if equivalent validation already occurred in CI.

---

## 28. Deployment Failure

If deployment fails:

- Stop the deployment.
- Preserve relevant logs.
- Do not silently continue.
- Determine whether the previous release remains healthy.
- Roll back if required.
- Record the failure.

The system must not report success when only part of the deployment completed.

---

## 29. Rollback

Rollback should deploy a previously verified application image.

Example:

```text
Current release
      ↓
Failure detected
      ↓
Previous verified image
      ↓
Deploy
      ↓
Health check
```

Database rollback must be handled separately.

See:

`docs/deployment/rollback-strategy.md`

---

## 30. CI/CD Environment Separation

CI/CD must maintain strict environment boundaries.

```text
Development
     │
     ├── Test/CI
     │
     └── Demo
```

CI must never accidentally use:

- Demo database credentials.
- Production credentials.
- Real payment credentials.
- Production object storage.

---

## 31. Environment Secrets

Secrets should be configured independently for each environment.

Examples:

```text
CI_DATABASE_URL
DEMO_DATABASE_URL
DEMO_PAYMENT_SECRET
DEMO_WEBHOOK_SECRET
```

Actual naming follows the project's configuration implementation.

---

## 32. Deployment Concurrency

Concurrent deployments to the same environment should be prevented or serialized.

For example:

```text
Deployment A ────────┐
                     ├── Demo
Deployment B ────────┘
```

should not result in unpredictable ordering.

GitHub Actions environments/concurrency controls should be used where appropriate.

---

## 33. Deployment Locking

Only one Demo deployment should modify the environment at a time.

If a new deployment supersedes an older pending deployment, the deployment system may cancel the older pending run where safe.

A deployment already performing a database migration requires additional care.

---

## 34. Database Safety in CI/CD

CI/CD must never automatically execute destructive database commands against Demo without explicit safeguards.

Commands such as:

```text
DROP DATABASE
TRUNCATE
db reset
destructive migration
```

must not be part of a normal deployment pipeline.

---

## 35. Artifact Traceability

Every Demo deployment should be traceable to:

```text
Git commit
    ↓
CI run
    ↓
Container image
    ↓
Deployment
```

This allows an operator to determine exactly what code is running.

---

## 36. Release Metadata

The application should expose or log enough information to identify the deployed release.

Useful metadata includes:

- Git commit SHA.
- Application version.
- Build timestamp.
- Deployment environment.

Sensitive build information must not be exposed publicly.

---

## 37. Monitoring Integration

Deployments should integrate with monitoring where supported.

Useful signals include:

- Deployment started.
- Deployment completed.
- Deployment failed.
- Release version.
- Application error rate after deployment.

Sentry release tracking may be used for application errors.

---

## 38. CI/CD Notifications

Important failures should be visible to the development team.

At minimum, developers should be able to identify:

- Failed CI.
- Failed deployment.
- Failed migration.
- Failed smoke test.

Notifications should not contain secrets or sensitive application data.

---

## 39. AI-Assisted CI/CD

AI-generated CI/CD changes must be reviewed before merging.

AI agents must not:

- Add arbitrary deployment services.
- Disable failing checks to obtain a green pipeline.
- Remove security scanning to avoid failures.
- Hardcode credentials.
- Modify production deployment settings without authorization.
- Claim successful deployment without actual evidence.

---

## 40. Demo CI/CD Pipeline

The intended Demo pipeline is:

```text
Developer
   ↓
Feature Branch
   ↓
Pull Request
   ↓
Install Dependencies
   ↓
Lint
   ↓
Typecheck
   ↓
Unit Tests
   ↓
Integration Tests
   ↓
Security Checks
   ↓
Build
   ↓
Review
   ↓
Merge
   ↓
Build Container
   ↓
Publish Immutable Image
   ↓
Deploy Demo
   ↓
Run Migrations
   ↓
Health Check
   ↓
Smoke Test
   ↓
Demo Available
```

---

## 41. Definition of Done

The CI/CD implementation is complete when:

```text
[ ] Pull requests trigger CI
[ ] Dependencies use the lockfile
[ ] Linting is automated
[ ] Type checking is automated
[ ] Tests are automated
[ ] Build validation is automated
[ ] Integration tests use isolated infrastructure
[ ] E2E tests run in an isolated environment
[ ] Security checks are present
[ ] Secrets are protected
[ ] Container images are traceable
[ ] Demo deployment is automated or consistently repeatable
[ ] Database migrations are controlled
[ ] Deployment health checks exist
[ ] Smoke testing exists
[ ] Rollback is supported
[ ] Deployment concurrency is controlled
[ ] Environment boundaries are enforced
[ ] Deployment failures are visible
[ ] No CI/CD step falsely reports success
```