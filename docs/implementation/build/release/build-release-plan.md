# Build Release Plan

## 1. Purpose

This document defines the release process for promoting the Demo from a verified implementation into a deployable, repeatable runtime environment.

The release process must prioritize:

- Reproducibility.
- Safety.
- Database integrity.
- Deployment consistency.
- Rollback readiness.
- Minimal manual intervention.
- Clear verification evidence.

The Demo should be simple to deploy without turning deployment itself into a second software project.

---

# 2. Release Principle

The release pipeline is:

```text
Code
 ↓
Pull Request
 ↓
Review
 ↓
CI Verification
 ↓
Merge
 ↓
Build Artifact
 ↓
Deploy
 ↓
Database Migration
 ↓
Web/Worker Restart
 ↓
Health Verification
 ↓
Smoke Tests
 ↓
Release Complete
```

A release is not complete merely because the deployment command succeeds.

---

# 3. Release Scope

The Demo release includes:

```text
apps/web
apps/worker
packages/*
modules/*
Database migrations
Required infrastructure configuration
Required static/build artifacts
```

Do not include:

```text
Local development files
Secrets
Temporary debugging files
Untracked generated artifacts
Developer-specific configuration
```

---

# 4. Release Preconditions

Before release:

```text id="m6q8r4"
[ ] Approved scope
[ ] Code review complete
[ ] CI passing
[ ] Typecheck passing
[ ] Lint passing
[ ] Tests passing
[ ] Security checks passing
[ ] E2E passing
[ ] Production build passing
[ ] Database migrations reviewed
[ ] Configuration reviewed
[ ] Rollback path understood
```

---

# 5. Source of Truth

The release must be built from the Git repository.

The VPS must not contain manually edited application source that differs from the released commit.

The deployed application version must correspond to a known Git commit.

---

# 6. Git Release Reference

Every Demo release should be identifiable through:

```text id="x5r7m4"
Git commit
```

Optionally, a release tag may identify the deployed version.

Example:

```text id="q7m4r8"
demo-v0.1.0
```

The exact versioning convention follows repository policy.

---

# 7. Branch Requirement

Only approved branches should be deployable.

Recommended flow:

```text id="v6r4m8"
feature/*
   ↓
Pull Request
   ↓
main
   ↓
Demo deployment
```

Direct deployment from arbitrary feature branches should not be the normal release path.

---

# 8. CI Verification

GitHub Actions should run the required automated gates before release.

At minimum:

```text id="m8q4r5"
Install
Typecheck
Lint
Format check
Unit tests
Integration tests
Build
```

Critical changes should additionally run:

```text id="x4r7m6"
API tests
Security tests
E2E tests
Concurrency/idempotency tests
```

---

# 9. Build Reproducibility

The same Git commit should produce the same intended application build given the approved environment.

Avoid build dependencies on:

```text id="q5m8r4"
Developer machine state
Untracked files
Local environment variables
Global packages
Manual generated files
```

---

# 10. Dependency Installation

Use the repository's approved package manager and lockfile.

The release environment should install dependencies according to the committed lockfile.

Do not silently update dependencies during deployment.

---

# 11. Production Build

Build:

```text id="v7r4m5"
Web
Worker
```

using the intended Demo deployment configuration.

The build must fail if required code/configuration is missing.

---

# 12. Artifact Strategy

The Demo may use either:

```text id="m4q8r6"
Build on VPS
```

or:

```text id="x6r5m8"
Build in CI
↓
Deploy build
```

The selected implementation must remain consistent.

For a small Demo VPS, building on the VPS can be acceptable if the deployment remains reproducible and resource usage is understood.

---

# 13. VPS Deployment Model

The approved Demo topology is:

```text id="q8m4r5"
Cloudflare
    ↓
VPS
 ├── Web
 ├── Worker
 └── PostgreSQL or approved database location
       ↓
Object Storage
```

The exact database placement follows the infrastructure configuration.

---

# 14. Container Strategy

Docker may be used to provide consistent runtime environments.

The release process should clearly define:

```text id="v5r7m4"
Image/build source
Container configuration
Environment variables
Volumes
Networking
Health checks
Restart behavior
```

Do not introduce Kubernetes for the Demo.

---

# 15. Deployment Sequence

The standard deployment sequence is:

```text id="m6q4r8"
1. Identify release commit
2. Verify CI
3. Connect to Demo environment
4. Pull/obtain approved release
5. Install dependencies if required
6. Build
7. Validate configuration
8. Run database migrations
9. Start/update Web
10. Start/update Worker
11. Run health checks
12. Run smoke tests
13. Verify logs
14. Mark release successful
```

---

# 16. Deployment Safety

Before modifying the running application:

```text id="x7r5m4"
Confirm target environment
Confirm release commit
Confirm database target
Confirm configuration
Confirm backup/recovery state
```

A production command must never accidentally target the wrong environment.

---

# 17. Environment Separation

Maintain clear separation between:

```text id="q4m8r5"
Local
Demo
Future Production
```

The Demo deployment must not use production credentials or production databases.

---

# 18. Configuration Injection

Secrets and environment-specific values must be injected through the approved configuration mechanism.

Do not commit:

```text id="v6r4m8"
Database passwords
Payment secrets
Webhook secrets
Session secrets
Cloud credentials
```

---

# 19. Database Migration Strategy

Database migrations must run before the application version requiring them becomes active.

Preferred sequence:

```text id="m8q4r5"
Deploy compatible application
      ↓
Run migration
      ↓
Activate new behavior
```

For compatible migrations, the exact order may be adjusted according to the migration's requirements.

---

# 20. Migration Safety

Before production-like migration:

```text id="x5r7m4"
Review migration
Test on clean database
Test on representative existing database
Verify expected execution time
Verify constraints/indexes
Verify application compatibility
```

Never run an untested destructive migration during a Demo release.

---

# 21. Expand-and-Contract

When a schema change affects running application versions:

```text id="q7m4r6"
Expand
 ↓
Deploy compatible code
 ↓
Migrate/backfill
 ↓
Switch behavior
 ↓
Contract later
```

Do not assume all schema changes can safely be applied atomically during deployment.

---

# 22. Application Restart

After deployment:

```text id="v8r4m5"
Web
Worker
```

must restart using the new version/configuration.

Verify old processes are not accidentally serving traffic.

---

# 23. Graceful Worker Shutdown

Before replacing a Worker:

```text id="m5q8r4"
Stop accepting new jobs
Allow active work to finish where possible
Release/expire leases appropriately
Terminate cleanly
Start new Worker
```

Durable jobs must remain recoverable if a Worker stops unexpectedly.

---

# 24. Health Checks

After deployment verify:

```text id="x4r7m6"
Web health
Web readiness
Database connectivity
Worker health
```

A successful process startup is not sufficient if the application cannot reach required dependencies.

---

# 25. Smoke Tests

Immediately after deployment, run:

```text id="q6m8r4"
Public Storefront
Merchant login
Product listing
Product detail
Cart
Checkout
Payment sandbox
Order confirmation
Merchant Order view
```

The smoke test should use safe Demo/test data.

---

# 26. Database Smoke Verification

After a successful purchase, verify:

```text id="v7r4m5"
Checkout
Payment
Payment attempt
Inventory reservation/movement
Order
Order Items
Webhook event where applicable
```

have expected final states.

---

# 27. Logging Verification

Inspect Web and Worker logs after deployment.

Verify:

```text id="m4q8r6"
No startup errors
No database errors
No authentication failures caused by deployment
No repeated worker failures
No unexpected provider errors
No secrets
```

---

# 28. Monitoring Verification

Verify the configured monitoring system receives:

```text id="x8r5m4"
Application errors
Worker errors
Relevant runtime events
Release/version metadata where supported
```

Monitoring must identify the deployed version.

---

# 29. Release Identification

The running environment should expose or internally record enough information to identify:

```text id="q5m7r4"
Application version
Git commit
Deployment timestamp
Environment
```

Do not expose sensitive deployment metadata publicly.

---

# 30. Rollout Strategy

For the Demo, use a simple controlled rollout:

```text id="v6r4m8"
Deploy
 ↓
Health check
 ↓
Smoke test
 ↓
Observe
 ↓
Release complete
```

Advanced canary infrastructure is not required for Demo.

---

# 31. Deployment Failure

If deployment fails before the new version is active:

```text id="m8q4r5"
Stop rollout
Fix cause
Retry deployment
```

If the new version is active but unhealthy:

```text id="x4r7m6"
Stop further changes
Assess application state
Use rollback procedure
Verify database compatibility
```

---

# 32. Database Failure During Release

If a migration fails:

```text id="q7m5r4"
Do not blindly rerun
Inspect migration state
Determine whether it committed
Determine application compatibility
Apply approved forward repair or recovery procedure
```

Do not manually edit migration history to hide the failure.

---

# 33. Rollback Compatibility

Application rollback must consider database compatibility.

Before every release determine:

```text id="v8m4r5"
Can previous application version run against new schema?
```

If not, use an expand-and-contract strategy or another approved migration approach.

---

# 34. Release Cancellation

A release may be cancelled before activation if:

```text id="m5q4r8"
CI fails
Migration is unsafe
Configuration is incorrect
Critical security issue appears
Smoke test fails
Critical dependency is unavailable
```

Do not continue simply because deployment has already started.

---

# 35. Release Evidence

Record:

```text id="x6r8m4"
Release commit
CI result
Migration result
Deployment result
Health result
Smoke test result
Known issues
Rollback decision
```

This creates a traceable release history.

---

# 36. Release Checklist

Before deployment:

```text id="q8m4r5"
[ ] Correct branch
[ ] Correct commit
[ ] CI green
[ ] Tests green
[ ] Build green
[ ] Security checks green
[ ] Migration reviewed
[ ] Configuration reviewed
[ ] Backup/recovery state understood
[ ] Rollback path understood
```

After deployment:

```text id="v7r4m6"
[ ] Migration successful
[ ] Web healthy
[ ] Worker healthy
[ ] Database healthy
[ ] Storefront works
[ ] Merchant login works
[ ] Cart works
[ ] Checkout works
[ ] Sandbox payment works
[ ] Order creation works
[ ] Logs clean
[ ] Monitoring receiving data
```

---

# 37. Release Approval

A Demo release is approved only when:

```text id="m4q8r5"
All blocking verification gates pass
+
Deployment succeeds
+
Health checks pass
+
Smoke tests pass
+
No critical security issue remains
```

---

# 38. Post-Release Observation

After deployment, observe the environment for:

```text id="x5r7m4"
Application errors
Database errors
Worker failures
Payment failures
Webhook failures
Unexpected latency
Authentication problems
```

The initial observation period should focus on the critical purchase path.

---

# 39. Post-Release Database Review

After the first successful Demo purchase, verify database state.

This confirms that:

```text id="q7m8r4"
Deployment
+
Migration
+
Runtime
+
Business logic
```

are operating together correctly.

---

# 40. Hotfix Strategy

A critical production-like Demo defect should use:

```text id="v6r4m8"
Short-lived hotfix branch
 ↓
Targeted fix
 ↓
Regression test
 ↓
CI
 ↓
Deploy
 ↓
Smoke test
```

Do not modify the VPS source manually as the normal hotfix process.

---

# 41. Release Notes

Each meaningful Demo release should record:

```text id="m8q4r5"
New functionality
Bug fixes
Database changes
Configuration changes
Known limitations
Verification performed
```

Keep release notes concise and factual.

---

# 42. AI Release Rules

AI agents must:

1. Read the actual root `AGENTS.md`.
2. Read deployment, infrastructure, database migration, security, and verification documentation before modifying release behavior.
3. Never deploy to an unintended environment.
4. Never expose secrets.
5. Never bypass CI or required verification.
6. Never manually alter production-like database state to make a release pass.
7. Never claim deployment success without actual verification.
8. Treat migration compatibility as a release concern.
9. Preserve rollback capability.
10. Avoid introducing new deployment infrastructure unless explicitly approved.

---

# 43. Definition of Done

The release is complete when:

```text id="x4r8m6"
[ ] Release commit identified
[ ] CI passed
[ ] Build passed
[ ] Security checks passed
[ ] Configuration validated
[ ] Database migration completed
[ ] Web deployed
[ ] Worker deployed
[ ] Health checks passed
[ ] Smoke tests passed
[ ] Critical purchase flow passed
[ ] Logs reviewed
[ ] Monitoring verified
[ ] Release evidence recorded
[ ] No release blockers remain
```

---

# 44. Final Release Gate

The release process must establish:

```text id="q5m7r4"
Known Code
   ↓
Known Build
   ↓
Known Database State
   ↓
Known Runtime
   ↓
Verified Health
   ↓
Verified Purchase
   ↓
Observable Release
```

Only then is the Demo release considered complete.

The deployment process should remain deliberately simple. The complexity belongs in the correctness of the commerce system, not in making a small Demo VPS deployment resemble an enterprise space program.