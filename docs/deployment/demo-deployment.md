# Demo Deployment

## 1. Purpose

This document defines the deployment architecture and operational procedure for the Demo environment of the Shopify-like commerce platform.

The Demo must be a real, functional deployment that exercises the same core application architecture intended to evolve into V1.

Infrastructure should remain intentionally simple while protecting the correctness and security of the application.

---

## 2. Demo Deployment Goals

The Demo deployment must provide:

- Publicly accessible storefront/application.
- Merchant administration.
- PostgreSQL persistence.
- Background worker execution.
- Sandbox/test payment processing.
- Object/media storage where required.
- HTTPS.
- Basic monitoring.
- Repeatable deployments.
- Rollback capability.

---

## 3. Demo Architecture

The target architecture is:

```text
                        Internet
                           │
                           ▼
                     Cloudflare
                           │
                           ▼
                         VPS
                    ┌──────┴──────┐
                    │             │
                 Web App        Worker
                    │             │
                    └──────┬──────┘
                           │
                           ▼
                       PostgreSQL
                           │
                           ▼
                     Object Storage
```

The exact hosting topology may evolve without changing the application architecture.

---

## 4. Deployment Components

The Demo consists primarily of:

| Component | Responsibility |
|---|---|
| Cloudflare | DNS, TLS/edge protection |
| VPS | Application runtime |
| Web container | Next.js application |
| Worker container | Background jobs |
| PostgreSQL | Transactional source of truth |
| Object storage | Media/files |
| Sentry or equivalent | Error monitoring |
| GitHub Actions | CI/CD |

---

## 5. VPS

The Demo application may run on a VPS using Docker.

The VPS should provide:

- Sufficient CPU.
- Sufficient memory.
- Persistent storage.
- Docker.
- Docker Compose where used.
- Restricted SSH access.
- Firewall configuration.
- Monitoring.

The VPS should not be treated as a permanent architecture constraint. It is an appropriate Demo hosting choice.

---

## 6. Domain and DNS

The Demo domain should be managed through the chosen DNS provider.

Cloudflare may provide:

- DNS.
- TLS termination.
- Basic edge protection.
- Proxying where appropriate.

DNS records should point to the intended Demo endpoint.

Production and Demo domains must remain distinct.

---

## 7. HTTPS

The Demo must use HTTPS.

Authentication credentials, sessions, checkout information, and other sensitive data must not be transmitted over plaintext HTTP.

TLS configuration should be managed through the chosen edge/reverse-proxy infrastructure.

---

## 8. Reverse Proxy

The deployment should expose only the web application publicly.

Conceptually:

```text
Internet
   ↓
Cloudflare
   ↓
Reverse proxy / ingress
   ↓
Web container
```

The worker and PostgreSQL should not be directly exposed to the public internet.

---

## 9. Application Containers

The deployment should run:

```text
web
worker
```

as separate processes/containers.

The web application handles synchronous user requests.

The worker handles background processing.

---

## 10. PostgreSQL

PostgreSQL is the authoritative transactional source of truth.

The Demo database should be:

- Persistent.
- Backed up.
- Network-restricted.
- Accessible only to required application components.
- Protected by credentials stored outside source control.

---

## 11. Database Placement

PostgreSQL may run:

### On the VPS

Advantages:

- Lower initial cost.
- Simple deployment.
- Easy local operational model.

Risks:

- More operational responsibility.
- VPS failure affects database availability.
- Backup/recovery must be handled carefully.

### Managed PostgreSQL

Advantages:

- Managed backups.
- Easier recovery.
- Better operational reliability.

The Demo may use either approach based on budget and operational requirements.

---

## 12. Database Backups

If PostgreSQL is self-hosted, automated backups are mandatory.

Backups should:

- Run on a defined schedule.
- Be stored outside the database host where practical.
- Be protected from accidental deletion.
- Have retention rules.
- Be periodically restore-tested.

A backup that has never been restored is merely a comforting file.

---

## 13. Object Storage

Product and other uploaded media should use object storage rather than relying on VPS-local application storage.

The application should store:

```text
Database
→ metadata/object key

Object storage
→ actual file
```

Production-like object storage behavior should be used where practical.

---

## 14. Worker Deployment

The worker should run continuously in the Demo environment.

It should:

- Connect to PostgreSQL.
- Claim pending jobs.
- Process jobs.
- Retry appropriate failures.
- Record job state.
- Emit useful logs.
- Shut down gracefully.

---

## 15. Worker Restart

The worker must tolerate restarts.

A job interrupted during execution must either:

- Be safely retried.
- Remain recoverable.
- Be marked appropriately.

Critical jobs must be idempotent.

---

## 16. Environment Configuration

Demo configuration must be supplied through the deployment environment.

Required values may include:

```text
DATABASE_URL
SESSION_SECRET
PAYMENT_SECRET_KEY
PAYMENT_WEBHOOK_SECRET
OBJECT_STORAGE_CONFIGURATION
MONITORING_CONFIGURATION
```

The actual variables are defined by the implemented configuration layer.

---

## 17. Secret Handling

Secrets must never be committed to Git.

Demo secrets should be stored using the approved deployment secret mechanism.

They must not appear in:

- Dockerfiles.
- GitHub repositories.
- Docker images.
- Logs.
- Screenshots.
- Deployment scripts.

---

## 18. Deployment Artifact

The preferred deployment artifact is a tested Docker image.

Conceptually:

```text
Git commit
   ↓
GitHub Actions
   ↓
Build image
   ↓
Run tests
   ↓
Publish image
   ↓
Deploy image to VPS
```

This provides a traceable connection between source code and deployed software.

---

## 19. Deployment Trigger

A Demo deployment may be triggered after changes are merged into the designated deployment branch.

The exact branch strategy should follow the repository Git workflow.

Deployment must not occur from arbitrary unreviewed local changes.

---

## 20. Pre-Deployment Checks

Before deployment:

```text
[ ] Code review completed
[ ] Dependencies installed
[ ] Lint passes
[ ] Typecheck passes
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Build succeeds
[ ] Relevant E2E tests pass
[ ] Migration changes reviewed
[ ] Environment configuration verified
```

Only checks that were actually executed may be reported as passing.

---

## 21. Database Migrations

Database migrations must be applied deliberately during deployment.

The process should ensure:

```text
Application version
        +
Database schema version
        ↓
Compatible deployment
```

Migrations must be backward-compatible when required for safe rolling or staged deployment.

---

## 22. Migration Safety

Avoid destructive migrations that require simultaneous application changes unless the deployment strategy explicitly supports them.

Prefer:

```text
Expand
  ↓
Deploy compatible application
  ↓
Migrate data
  ↓
Contract
```

This supports safer evolution.

---

## 23. Deployment Sequence

A typical Demo deployment sequence is:

```text
1. Build image
2. Run automated tests
3. Publish image
4. Pull image on VPS
5. Verify configuration
6. Apply compatible migrations
7. Start/update web
8. Start/update worker
9. Verify health
10. Verify critical application flow
```

The exact sequence may change based on migration requirements.

---

## 24. Health Verification

After deployment verify:

- Web application is reachable.
- Health/readiness checks pass.
- Worker is running.
- Database is reachable.
- No startup configuration failures occur.
- Monitoring receives application signals.

---

## 25. Smoke Test

A basic post-deployment smoke test should verify the most important path.

Example:

```text
Open application
    ↓
Authenticate
    ↓
Open store
    ↓
View product
    ↓
Add to cart
    ↓
Reach checkout
```

Where practical, use a sandbox payment to verify the full Demo lifecycle.

---

## 26. Payment Verification

Payment testing after deployment must use sandbox/test credentials.

Verify:

- Payment creation.
- Successful test payment.
- Webhook reception.
- Order creation.
- Correct payment state.

Never use real payment credentials merely because the Demo is publicly accessible.

---

## 27. Webhook Verification

After deployment, verify that the configured webhook endpoint:

- Is reachable.
- Uses HTTPS.
- Receives provider events.
- Validates signatures.
- Persists events correctly.
- Handles duplicates safely.

---

## 28. Monitoring

Demo monitoring should include:

- Application errors.
- Worker failures.
- Database availability.
- Container health.
- Deployment failures.
- Authentication failures where useful.
- Payment/webhook failures.

Sentry or an equivalent service may provide application error tracking.

---

## 29. Logs

Deployment logs should be structured and searchable.

Logs must not expose:

- Passwords.
- API keys.
- Session secrets.
- Payment credentials.
- Webhook secrets.

Request and job correlation IDs should be preserved where practical.

---

## 30. Rollback

A deployment must be reversible.

Rollback should normally select a previously known-good application image.

Example:

```text
Current
  ↓
Problem detected
  ↓
Previous image
  ↓
Deploy
  ↓
Verify
```

Database rollback is a separate problem and must not be assumed to be automatic.

---

## 31. Rollback Decision

Rollback should be considered when:

- Application fails to start.
- Critical workflow is broken.
- Authentication is unavailable.
- Payment processing is broken.
- Tenant isolation is compromised.
- Severe data corruption is suspected.

Security or data-integrity issues take priority over keeping the latest release online.

---

## 32. SSH Access

SSH access to the VPS should be restricted.

Recommended controls include:

- Key-based authentication.
- Disabled password login where practical.
- Restricted users.
- Firewall rules.
- Minimal administrative access.

Production-like Demo access should not use shared administrator passwords.

---

## 33. Firewall

Only required public ports should be exposed.

Typical public exposure:

```text
443 HTTPS
80 HTTP redirect where required
```

SSH should be restricted according to the hosting/security configuration.

PostgreSQL and internal application services should not be publicly exposed.

---

## 34. File System

Application containers should not rely on local VPS files for business-critical state.

Persistent business data belongs in:

- PostgreSQL.
- Object storage.
- Other explicitly managed persistent services.

---

## 35. Deployment Data Safety

Deployments must not:

- Drop production-like tables accidentally.
- Reset the Demo database.
- Delete object storage.
- Replace secrets unintentionally.
- Execute destructive commands without explicit safeguards.

Deployment scripts should make destructive actions difficult to perform accidentally.

---

## 36. AI Deployment Safety

AI agents must not independently perform unrestricted production-like deployment operations.

AI-assisted deployment changes must:

- Inspect current deployment configuration.
- Understand migration impact.
- Verify target environment.
- Avoid exposing secrets.
- Review the deployment diff.
- Run required checks.
- Never claim deployment success without evidence.

---

## 37. Demo Limitations

The Demo intentionally does not require:

- Kubernetes.
- Multi-region deployment.
- Automatic horizontal scaling.
- Complex service meshes.
- Dedicated search clusters.
- Distributed databases.
- Multi-region failover.
- Enterprise disaster-recovery infrastructure.

These may be introduced later when justified.

---

## 38. V1 Evolution

The Demo deployment should evolve toward:

```text
Demo
  ↓
Hardened infrastructure
  ↓
Managed services
  ↓
Production
```

The application architecture should not need to be fundamentally rewritten when infrastructure becomes more sophisticated.

---

## 39. Deployment Checklist

```text
[ ] Correct commit/image selected
[ ] CI verification passed
[ ] Environment configuration verified
[ ] Secrets available
[ ] Database backup available
[ ] Migration reviewed
[ ] Image deployed
[ ] Web healthy
[ ] Worker healthy
[ ] Database reachable
[ ] Webhook reachable
[ ] Sandbox payment verified
[ ] Smoke test passed
[ ] Monitoring verified
[ ] Rollback artifact available
```

---

## 40. Definition of Done

A Demo deployment is complete when:

```text
[ ] Application is accessible over HTTPS
[ ] Web container is healthy
[ ] Worker is running
[ ] PostgreSQL is available
[ ] Database migrations are applied safely
[ ] Object storage is available where required
[ ] Sandbox payment integration works
[ ] Webhooks work
[ ] Monitoring is active
[ ] Secrets remain protected
[ ] Critical smoke tests pass
[ ] Rollback is possible
[ ] No production credentials are used
[ ] Deployment is traceable to a source commit
```