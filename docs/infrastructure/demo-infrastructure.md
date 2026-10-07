# Demo Infrastructure

## 1. Purpose

This document defines the infrastructure architecture for the Demo version of the commerce platform.

It establishes:

- Deployment topology.
- Runtime components.
- Environment structure.
- Docker usage.
- VPS responsibilities.
- PostgreSQL deployment.
- Object storage.
- Cloudflare responsibilities.
- Networking.
- Secrets and configuration.
- Deployment flow.
- Backups.
- Monitoring.
- Operational boundaries.
- Demo-to-V1 infrastructure evolution.

The Demo infrastructure is intentionally simple while maintaining the reliability and security required for a real commerce platform.

---

# 2. Infrastructure Principles

The Demo infrastructure follows these principles:

1. Keep infrastructure simple.
2. Avoid premature distributed systems.
3. Keep PostgreSQL authoritative.
4. Keep production access restricted.
5. Separate environments.
6. Store secrets outside source control.
7. Use reproducible deployment configuration.
8. Use Docker where it improves consistency.
9. Maintain backups for persistent data.
10. Make failures observable.
11. Simplify infrastructure, not business correctness.
12. Introduce infrastructure complexity only when justified.

---

# 3. Demo Deployment Topology

The initial deployment is conceptually:

```text
                         Internet
                            │
                            ▼
                       Cloudflare
                     DNS / TLS / CDN
                            │
                            ▼
                         VPS
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
              Web                    Worker
                │                       │
                └───────────┬───────────┘
                            │
                            ▼
                       PostgreSQL
                            │
                            └──────────────► Object Storage
```

The exact physical placement of PostgreSQL may vary depending on the selected hosting arrangement.

---

# 4. Core Infrastructure Components

The Demo requires the following infrastructure capabilities:

| Component | Purpose |
|---|---|
| Cloudflare | DNS, TLS, edge protection, optional caching |
| VPS / Host | Application runtime |
| Web | Synchronous application runtime |
| Worker | Background processing |
| PostgreSQL | Transactional source of truth |
| Object Storage | Media files |
| GitHub | Source control and CI/CD |
| Monitoring | Operational visibility |
| Sentry or equivalent | Application error tracking |

Additional infrastructure should only be introduced when required.

---

# 5. VPS

The VPS provides the initial application runtime environment.

It may host:

```text
Web Application
Worker
Reverse Proxy where required
Docker Runtime
Operational Scripts
```

The VPS must be configured with appropriate:

- Firewall rules.
- SSH access controls.
- Operating system updates.
- Runtime permissions.
- Disk monitoring.
- Resource monitoring.

---

# 6. Web Runtime

The web application is deployed from:

```text id="p6g7v1"
apps/web
```

Its responsibilities include:

- HTTP requests.
- Storefront operations.
- Merchant operations.
- Authentication flows.
- API requests.
- Synchronous business operations.

The web runtime should remain stateless wherever practical.

Persistent business state belongs in PostgreSQL or appropriate external storage.

---

# 7. Worker Runtime

The worker is deployed from:

```text id="4y7z8c"
apps/worker
```

It handles:

- Background jobs.
- Scheduled work.
- Retryable operations.
- Notifications.
- Webhook processing where appropriate.
- Secondary asynchronous effects.

The worker should not become a second implementation of the application's business rules.

It invokes shared application/domain functionality.

---

# 8. PostgreSQL

PostgreSQL is the authoritative transactional database.

It stores core business state including:

- Stores.
- Memberships.
- Products.
- Inventory.
- Customers.
- Carts.
- Discounts.
- Checkout state.
- Payments.
- Orders.

The database must be persistent.

It must not depend on ephemeral container storage.

---

# 9. PostgreSQL Deployment Options

For Demo, PostgreSQL may be:

### Option A: Managed PostgreSQL

Preferred when practical.

Benefits include:

- Managed backups.
- Easier upgrades.
- Monitoring.
- Recovery tooling.
- Reduced operational responsibility.

### Option B: VPS-Hosted PostgreSQL

Acceptable for Demo when infrastructure constraints require it.

If hosted on the VPS, PostgreSQL must use persistent storage and an explicit backup strategy.

The architecture does not require PostgreSQL to run inside the same container as the web application.

---

# 10. Database Connectivity

Applications connect to PostgreSQL through configuration.

Conceptually:

```text id="p1v3c6"
Web ───────┐
           ├──> PostgreSQL
Worker ────┘
```

Database credentials must not be hardcoded.

Connections should use appropriate pooling and limits for the available PostgreSQL resources.

---

# 11. Docker

Docker may be used to provide reproducible runtime environments.

Typical components may include:

```text id="0g6w4e"
Web Container
Worker Container
Optional Local PostgreSQL Container
```

Docker is primarily a packaging and runtime consistency mechanism.

It does not replace architectural boundaries.

---

# 12. Local Development

Local development should approximate the production architecture where practical without requiring production infrastructure.

A developer may run:

```text id="g6v9r0"
Web
Worker
PostgreSQL
```

using local tooling and/or Docker.

External services may use:

- Local development substitutes.
- Sandbox environments.
- Development accounts.

Production credentials must never be used for local development.

---

# 13. Environments

The platform should distinguish at least:

```text id="j8q3d4"
Development
Staging / Demo
Production
```

The exact environment count may remain small during Demo development.

Each environment must have its own configuration and credentials.

Production data must not be casually copied into development.

---

# 14. Environment Configuration

Configuration should be provided through environment variables or an equivalent secure configuration mechanism.

Examples include:

```text id="k4s2m8"
DATABASE_URL
AUTH_SECRET
PAYMENT_PROVIDER_KEY
OBJECT_STORAGE credentials
EMAIL_PROVIDER credentials
SENTRY configuration
```

Actual variable names should be defined by the implementation.

Secrets must never be committed to Git.

---

# 15. `.env.example`

The repository should maintain an example configuration file.

It may contain:

```text id="0g6m3c"
DATABASE_URL=
AUTH_SECRET=
PAYMENT_PROVIDER_KEY=
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_BUCKET=
SENTRY_DSN=
```

The example file must contain placeholders only.

It must not contain real credentials.

---

# 16. Secrets

Secrets must be managed outside source control.

Examples include:

- Database passwords.
- Authentication secrets.
- Payment provider credentials.
- Object storage credentials.
- Email credentials.
- Deployment credentials.

Access should follow least privilege.

Production secrets should not be broadly distributed across developers or AI tools.

---

# 17. Production Access

Production infrastructure access must be restricted.

Developers and automated agents should not receive unrestricted production access.

Where operational access is required:

- Use dedicated accounts.
- Use least privilege.
- Use auditable credentials.
- Restrict SSH access.
- Avoid shared passwords.
- Rotate credentials when necessary.

AI coding agents should not be given unrestricted production database or server access.

---

# 18. Cloudflare

Cloudflare may provide the external edge layer.

Responsibilities may include:

- DNS.
- TLS.
- Domain routing.
- Basic DDoS protection.
- CDN functionality where appropriate.
- Security controls.

Conceptually:

```text id="3y6z4x"
User
  ↓
Cloudflare
  ↓
VPS
```

Cloudflare should not become the source of truth for application state.

---

# 19. TLS

Production traffic must use HTTPS.

TLS termination may occur at:

```text id="j9n4b2"
Cloudflare
```

or an appropriate reverse proxy/origin layer.

Internal communication should use secure connections where required by the deployment environment.

---

# 20. Domain Routing

The deployment should use clear domain/subdomain responsibilities.

A possible structure is:

```text id="5f2c7d"
example.com
www.example.com
api.example.com
```

The exact domain structure is determined during deployment configuration.

The application should not hardcode environment-specific domain names.

---

# 21. Object Storage

Product images and other large media should use object storage rather than PostgreSQL.

Conceptually:

```text id="n4v7x1"
Application
    ↓
Object Storage
    ↓
Media File

PostgreSQL
    ↓
Media Metadata / Object Reference
```

The database remains responsible for ownership and metadata.

---

# 22. Media Access

Media access should respect ownership requirements.

Private media may require controlled access mechanisms.

Public storefront assets may use publicly accessible or CDN-backed delivery where appropriate.

The application must not expose private objects simply because an object key is known.

---

# 23. Background Jobs

The Demo worker handles asynchronous processing.

The infrastructure should provide a mechanism for:

- Job creation.
- Job execution.
- Retry handling.
- Failure tracking.
- Scheduling where required.

The initial implementation should remain simple.

A distributed queue system such as Redis should not be introduced merely because queues are theoretically useful.

---

# 24. Redis

Redis is **not required by default** for Demo.

It may be introduced when there is a concrete requirement such as:

- High-throughput job processing.
- Distributed locks.
- Shared caching.
- Session infrastructure.
- Rate limiting.
- Other demonstrated workload requirements.

PostgreSQL remains the authoritative source of truth even if Redis is introduced.

---

# 25. Search Infrastructure

A dedicated search engine is not required for Demo.

Product search may initially use PostgreSQL capabilities appropriate to the workload.

A dedicated search engine should only be introduced when:

- Catalog size requires it.
- Search relevance requirements exceed PostgreSQL capabilities.
- Search workload materially impacts transactional workloads.

Search indexes remain derived data.

---

# 26. Deployment Flow

The initial deployment flow is:

```text id="b7z2k4"
Developer
   ↓
Git Commit
   ↓
GitHub
   ↓
CI
   ↓
Build / Test
   ↓
Deployment
   ↓
VPS
   ↓
Web / Worker
```

The exact deployment mechanism may use GitHub Actions and deployment scripts.

Production deployment must not rely on manually copying arbitrary files.

---

# 27. Database Migration During Deployment

Database migrations must be handled deliberately.

Conceptually:

```text id="j6q4w2"
Build
  ↓
Deploy Application
  ↓
Run Compatible Migration
  ↓
Verify
  ↓
Activate New Version
```

Migration strategy must account for compatibility between application versions.

Destructive schema changes should not be introduced casually.

---

# 28. Zero-Downtime Considerations

The Demo does not require complex zero-downtime deployment infrastructure.

However, migrations and application changes should avoid unnecessary downtime.

Where a schema change affects running application versions, use a compatibility-first approach:

```text id="m2v5c9"
Add Compatible Schema
       ↓
Deploy Code
       ↓
Migrate Data
       ↓
Remove Obsolete Schema Later
```

This becomes more important as V1 infrastructure scales.

---

# 29. Backups

Persistent PostgreSQL data must be backed up.

A backup strategy should define:

- Backup frequency.
- Retention.
- Storage location.
- Encryption.
- Access control.
- Restore procedure.

A backup that has never been restored is an assumption wearing a costume.

Restore testing must therefore be performed periodically.

---

# 30. Object Storage Backups

Media storage should have its own durability and recovery strategy.

Depending on the provider, this may include:

- Versioning.
- Replication.
- Lifecycle policies.
- Backup copies.

The database metadata and object storage must remain consistent enough to recover application functionality.

---

# 31. Monitoring

The Demo should monitor at least:

### Application

- Error rate.
- Request failures.
- Request latency.
- Application crashes.

### Worker

- Job failures.
- Retry counts.
- Processing latency.
- Stuck jobs.

### Database

- Availability.
- Connection usage.
- Storage.
- Query performance where practical.

### Infrastructure

- CPU.
- Memory.
- Disk.
- Network.
- Container health.

---

# 32. Error Tracking

An application error tracking system such as Sentry may be used.

It should capture:

- Exceptions.
- Stack traces.
- Request context.
- Relevant deployment information.

Sensitive data must be filtered.

Error tracking must not become a mechanism for collecting unnecessary customer information.

---

# 33. Health Checks

Runtime applications should expose appropriate health information.

Health checks may distinguish between:

### Liveness

The process is running.

### Readiness

The process can perform required work.

For example:

```text id="3j7k0x"
Web
 ├── Liveness
 └── Readiness

Worker
 ├── Liveness
 └── Readiness
```

Health checks should not perform expensive business operations.

---

# 34. Logging

Logs should be structured enough to support troubleshooting.

Useful fields include:

- Timestamp.
- Application.
- Environment.
- Request ID.
- Correlation ID.
- Error category.
- Operation.
- Tenant/store context where safe.

Logs must not expose secrets or unnecessary sensitive customer data.

---

# 35. Resource Management

The VPS must have resource limits appropriate to the workload.

The team should monitor:

- CPU.
- RAM.
- Disk.
- Database connections.
- Worker concurrency.

The Demo should not assume unlimited VPS resources.

Resource pressure should be visible before it becomes an outage.

---

# 36. Firewall and Network Security

The VPS should expose only required ports.

Typical public access may include:

```text id="3p6k4r"
HTTPS
SSH where required
```

Database ports should not be publicly exposed unless there is a specific secured requirement.

Administrative services should remain private whenever possible.

---

# 37. SSH Access

SSH access should use:

- Key-based authentication.
- Restricted accounts.
- Strong access controls.
- Minimal exposed surface.

Password-based root login should be avoided.

Direct root access should not be the normal application deployment mechanism.

---

# 38. Deployment Artifacts

Deployments should use reproducible artifacts.

Potentially:

```text id="7x8m3d"
Git Commit
   ↓
CI Build
   ↓
Container Image / Build Artifact
   ↓
Deployment
```

The exact artifact strategy may evolve.

The important requirement is that production deployment corresponds to a known source revision.

---

# 39. Rollback

A deployment should have a rollback strategy.

Rollback may involve:

```text id="q9j3w2"
Previous Application Version
        ↓
Redeploy
```

Database rollback is more complicated.

Destructive migrations should therefore be avoided or designed with a recovery strategy.

Database backups provide an additional recovery mechanism but should not be treated as the normal rollback mechanism for every deployment.

---

# 40. Demo Infrastructure Scope

The Demo infrastructure intentionally excludes or minimizes:

- Kubernetes.
- Service mesh.
- Multi-region deployment.
- Complex orchestration.
- Dedicated search clusters.
- Distributed caching.
- Kafka-style event streaming.
- Infrastructure-as-code at enterprise scale.
- Multi-datacenter deployment.
- Database sharding.

These technologies may become appropriate later.

They are not requirements of the current Demo.

---

# 41. V1 Evolution

As the platform grows, infrastructure may evolve toward:

```text id="8r5n4v"
Cloudflare
     ↓
Load Balancer
     ↓
Web / API / Storefront
     ↓
Worker Pool
     ↓
Managed PostgreSQL
     ↓
Redis / Queue where justified
     ↓
Object Storage + CDN
     ↓
Search Infrastructure
     ↓
Observability Platform
```

This evolution should happen incrementally.

---

# 42. Infrastructure Evolution Triggers

Infrastructure should become more complex only when there is evidence.

Examples:

### Add Redis

When database-backed or in-process coordination becomes a measurable bottleneck.

### Add Search Engine

When search requirements exceed PostgreSQL capabilities.

### Add Read Replicas

When read load materially impacts the primary database.

### Add Load Balancing

When one web runtime is insufficient.

### Add Worker Pool

When asynchronous workload requires independent scaling.

### Add Multi-Region

When availability or latency requirements justify it.

---

# 43. Infrastructure as Code

The Demo may use scripts and configuration files for reproducible deployment.

A more comprehensive infrastructure-as-code setup may be introduced for V1 when infrastructure complexity justifies it.

The goal is not to avoid infrastructure automation.

The goal is to avoid building an elaborate infrastructure abstraction before the infrastructure itself requires it.

---

# 44. Environment Separation

Environment configuration must remain isolated.

The following must never be mixed casually:

```text id="1t7k4v"
Development Credentials
Staging Credentials
Production Credentials
```

Production databases must not be used for ordinary development.

Production secrets must not be copied into source repositories.

---

# 45. AI and Infrastructure Access

AI coding agents may assist with:

- Infrastructure configuration.
- Docker files.
- CI configuration.
- Deployment scripts.
- Monitoring configuration.

However:

- Production credentials must remain protected.
- Production databases must not be exposed unnecessarily.
- Agents must not receive unrestricted production access.
- Infrastructure changes require review.
- Destructive commands must be treated as high risk.

AI agents must follow the project's root `AGENTS.md`.

---

# 46. Testing Infrastructure Changes

Infrastructure changes should be validated where practical.

Checks may include:

```text id="q8n5c7"
Configuration Validation
Docker Build
Application Build
Health Check
Migration Test
Deployment Smoke Test
```

Production changes should be tested in a lower environment when practical.

---

# 47. Disaster Recovery

The Demo should define basic recovery procedures for:

- Application failure.
- VPS failure.
- Database failure.
- Object storage failure.
- Credential compromise.
- Deployment failure.

Recovery priorities should be:

```text id="k2w8c3"
Protect Data
   ↓
Restore Database
   ↓
Restore Application
   ↓
Restore Integrations
   ↓
Verify Business Operations
```

Exact recovery objectives will become more formal as the platform approaches V1.

---

# 48. Security Principles

Infrastructure must follow:

- Least privilege.
- Secret isolation.
- HTTPS.
- Restricted network exposure.
- Secure SSH.
- Regular updates.
- Persistent database storage.
- Backups.
- Monitoring.
- Controlled production access.

Infrastructure convenience must not override security requirements.

---

# 49. Operational Responsibilities

The team should clearly assign responsibility for:

- VPS administration.
- Database management.
- Deployments.
- Backups.
- Monitoring.
- DNS.
- Secrets.
- Incident response.

The exact ownership model may evolve with team size.

---

# 50. Final Principle

The Demo infrastructure is intentionally small:

```text id="v0w2g9"
Cloudflare
    ↓
VPS
 ├── Web
 └── Worker
    ↓
PostgreSQL

Object Storage
    ↑
Application
```

It provides the minimum infrastructure required to operate a real commerce platform safely.

The governing principle is:

> **Keep the infrastructure simple enough to operate, but never simplify away the safeguards required for business correctness and security.**