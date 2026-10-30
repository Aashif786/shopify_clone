# Docker Strategy

## 1. Purpose

This document defines how Docker is used within the Cal Cart commerce platform.

Docker provides reproducible infrastructure and deployment environments while keeping the Demo architecture intentionally simple.

Docker is an implementation tool, not a reason to introduce additional infrastructure.

---

## 2. Core Principles

Docker usage should:

- Produce reproducible environments.
- Keep images small and secure.
- Separate build-time and runtime concerns.
- Avoid embedding secrets.
- Support local development.
- Support Demo deployment.
- Keep application and infrastructure concerns clear.
- Avoid unnecessary containerization complexity.

---

## 3. Demo Container Architecture

The Demo may use:

```text id="n8m3q7"
Cloudflare
    ↓
VPS
    ↓
Docker
 ┌───────────────┐
 │ Web           │
 │ Worker        │
 │ PostgreSQL*   │
 └───────────────┘
```

`*` PostgreSQL may be hosted separately if the deployment design requires it.

The Demo should not require Kubernetes.

---

## 4. Application Containers

The primary application processes are:

```text id="x7q2m5"
apps/web
apps/worker
```

They may be built into separate Docker images because they have different runtime responsibilities.

The web container serves the Next.js application.

The worker container executes background jobs.

---

## 5. Database Container

PostgreSQL may run in Docker for local development.

For Demo production, PostgreSQL may be:

- A dedicated Docker container on the VPS.
- A managed PostgreSQL service.

The choice should depend on operational requirements rather than forcing a particular infrastructure model.

---

## 6. Dockerfile Strategy

Application Dockerfiles should:

- Use a supported Node.js base image.
- Use deterministic dependency installation.
- Use multi-stage builds where beneficial.
- Avoid unnecessary packages.
- Run as a non-root user where practical.
- Contain no secrets.
- Produce only required runtime artifacts.

---

## 7. Multi-Stage Builds

Application images should prefer multi-stage builds where they reduce final image size and attack surface.

Conceptually:

```text id="q3m8x7"
Dependency stage
      ↓
Build stage
      ↓
Production runtime stage
```

Build tooling should not unnecessarily remain in the final runtime image.

---

## 8. Dependency Installation

Docker builds should use the repository lockfile.

For pnpm-based builds:

```text id="v4n7p2"
pnpm-lock.yaml
```

must be respected.

The Docker build should fail rather than silently resolving different dependency versions.

---

## 9. Build Context

The Docker build context should contain only files required for the build.

Avoid copying:

```text id="m8q3x6"
.git
.env
local secrets
node_modules
test artifacts
temporary files
```

into Docker build contexts unless explicitly required.

A suitable `.dockerignore` should be maintained.

---

## 10. Secrets

Secrets must never be baked into images.

Do not use:

```dockerfile id="q7m3x8"
ENV DATABASE_PASSWORD=...
```

with real credentials.

Runtime secrets should be injected through the deployment environment.

---

## 11. Runtime Configuration

Containers should receive configuration at runtime.

Conceptually:

```text id="x5n8m2"
Docker image
      +
Runtime environment
      ↓
Application
```

This allows the same image to be promoted between environments without rebuilding it for each environment.

---

## 12. Environment Separation

Images should not contain environment-specific application secrets.

Environment differences should primarily come from:

- Runtime configuration.
- Infrastructure.
- External services.
- Environment-specific deployment settings.

---

## 13. Port Exposure

Containers should expose only required ports.

For example:

```text id="r8m3q5"
Web
→ application port

Worker
→ no public port unless required

PostgreSQL
→ private/internal access
```

Database ports should not be publicly exposed in production unless explicitly required and secured.

---

## 14. Network Isolation

Docker networks should separate internal services from publicly accessible services where practical.

Example:

```text id="p4q7m8"
Public network
    ↓
Web

Internal network
    ↓
Web
Worker
PostgreSQL
```

The worker and database should not be directly exposed to the public internet.

---

## 15. Container Health

Containers should have appropriate health checks where practical.

Health checks should distinguish:

- Process is running.
- Application is ready.
- Dependencies are available.

A process that is alive but unable to serve traffic should not necessarily be considered healthy.

---

## 16. Web Health

The web application should provide an appropriate health/readiness mechanism.

Health endpoints should:

- Be lightweight.
- Avoid exposing secrets.
- Avoid expensive database operations unless required.
- Clearly communicate application availability.

---

## 17. Worker Health

The worker should expose or provide an appropriate health signal where practical.

Useful checks may include:

- Worker process alive.
- Database connectivity.
- Ability to claim jobs.
- Recent successful processing.

The worker does not need a publicly accessible HTTP endpoint merely for the sake of symmetry.

---

## 18. PostgreSQL Persistence

If PostgreSQL runs in Docker, database data must use persistent storage.

Do not rely on the container filesystem for production database durability.

Example:

```text id="n6m3q8"
PostgreSQL container
      ↓
Persistent volume
      ↓
Database data
```

Backups remain necessary even when persistent volumes are used.

---

## 19. Database Backups

Docker does not provide database backup by itself.

Production PostgreSQL should have an explicit backup strategy covering:

- Backup frequency.
- Retention.
- Storage.
- Restore testing.
- Recovery objectives.

Backup architecture is defined separately from container strategy.

---

## 20. Restart Policies

Production application containers should restart automatically when appropriate.

Restart policies must not hide persistent failures.

Repeated restart loops should be observable and investigated.

---

## 21. Graceful Shutdown

Containers must support graceful shutdown.

The application should:

- Stop accepting new work.
- Finish or safely terminate active work.
- Close database connections.
- Flush appropriate logs.
- Allow worker jobs to be safely retried when interrupted.

Graceful shutdown is particularly important for the worker.

---

## 22. Worker Job Safety

A worker container may terminate unexpectedly.

Therefore jobs must be designed for safe retry and idempotent processing where required.

Container reliability does not replace application-level job correctness.

---

## 23. Docker Compose

Docker Compose may be used for local development and Demo environments where appropriate.

A typical local composition may include:

```text id="v3m8q6"
web
worker
postgres
```

Additional services should be added only when the application actually requires them.

---

## 24. Local Development Compose

Local Compose configuration should make it easy to start infrastructure.

For example:

```text id="q8m4n2"
docker compose up -d
```

The exact command and service definitions must match the repository configuration.

---

## 25. Production Compose

For the Demo VPS, Docker Compose may be used to orchestrate:

- Web.
- Worker.
- PostgreSQL if self-hosted.
- Supporting infrastructure where necessary.

This is sufficient for the initial deployment.

Kubernetes is not required for the Demo.

---

## 26. Container Image Tags

Images should use traceable tags.

Recommended identifiers include:

```text id="m7x3q8"
commit SHA
release version
```

Avoid relying exclusively on mutable tags such as:

```text id="r2n8v5"
latest
```

for production deployments.

---

## 27. Image Promotion

Ideally the same tested image should be promoted through environments rather than rebuilding different images from the same source.

Conceptually:

```text id="x4m8q7"
Commit
  ↓
CI build
  ↓
Test image
  ↓
Registry
  ↓
Demo deployment
```

This improves deployment reproducibility.

---

## 28. Container Registry

The project may use a container registry for deployment images.

Registry credentials must:

- Be stored as CI/CD secrets.
- Have minimal permissions.
- Never be committed.
- Never appear in logs.

The registry provider can evolve without changing application architecture.

---

## 29. Image Security

Images should be periodically checked for:

- Known vulnerable dependencies.
- Outdated base images.
- Unnecessary packages.
- Root execution.
- Embedded secrets.

Security scanning should be treated as a useful signal rather than an excuse to blindly upgrade everything in one terrifying afternoon.

---

## 30. Base Image Updates

Base images should be updated deliberately.

Updates should include:

- Security review.
- Build verification.
- Test execution.
- Compatibility checks.

Avoid using unpinned or floating infrastructure versions where reproducibility matters.

---

## 31. Non-Root Containers

Application containers should run as a non-root user where practical.

This reduces the potential impact of a container compromise.

The application must still have only the filesystem permissions it actually requires.

---

## 32. Filesystem Security

Containers should use a minimal writable filesystem.

Where possible:

- Application code should be read-only.
- Temporary files should use controlled temporary directories.
- Persistent application data should use explicit storage.

Do not rely on container-local files for business-critical state.

---

## 33. Logging

Container logs should be emitted through standard output/error where practical.

The deployment environment can then collect and forward them.

Avoid writing uncontrolled application log files inside containers.

---

## 34. Time and Time Zones

Containers should use a predictable system time configuration.

Business timestamps should be stored according to the database/domain time strategy.

Applications should not rely on a developer's local time zone being available inside the container.

---

## 35. Resource Limits

Production containers should have appropriate CPU and memory expectations.

Resource limits should be based on observed usage.

Avoid arbitrary limits that cause legitimate checkout, worker, or database operations to fail.

---

## 36. Web Resource Protection

The web container should not be responsible for processing unbounded requests.

Application-level:

- Request-size limits.
- Upload limits.
- Pagination limits.
- Timeout handling.

must still be enforced.

Docker resource limits are an additional safeguard, not the primary validation mechanism.

---

## 37. Worker Resource Protection

Workers should prevent a single malformed or unexpectedly expensive job from consuming all available resources.

Job payloads should be bounded and validated.

Long-running or resource-intensive tasks should have explicit limits.

---

## 38. Docker and Tenant Isolation

Docker itself does not provide application tenant isolation.

Tenant isolation must remain enforced through:

- Authentication.
- Authorization.
- Store context.
- Application logic.
- Database constraints.
- Tenant-scoped queries.

Containers must never be treated as a substitute for application security.

---

## 39. AI Development Requirements

AI-assisted Docker changes must:

- Read the actual `AGENTS.md`.
- Inspect existing Docker configuration.
- Preserve current environment assumptions.
- Avoid adding unnecessary services.
- Never embed secrets.
- Avoid introducing Kubernetes or other orchestration platforms without a justified requirement.
- Verify image builds after changes.
- Review Dockerfile changes for security implications.

---

## 40. Production Access

Docker management access on the production VPS must be restricted.

Do not expose Docker's management API publicly.

SSH and deployment access should follow the project's production-access policy.

---

## 41. Rollback

Docker-based deployments should support returning to a previously known-good image.

Because images are immutable deployment artifacts, rollback should generally mean:

```text id="f9m3q8"
Select previous image
      ↓
Deploy previous image
      ↓
Verify health
```

Database rollback requires separate migration considerations.

---

## 42. Docker Development Checklist

```text id="k7q4m8"
[ ] Docker configuration is version controlled
[ ] Images use the repository lockfile
[ ] Multi-stage builds are used where beneficial
[ ] Secrets are not baked into images
[ ] .dockerignore is maintained
[ ] Containers expose only required ports
[ ] Internal services are network-isolated
[ ] PostgreSQL uses persistent storage when self-hosted
[ ] Health checks exist where useful
[ ] Graceful shutdown is supported
[ ] Worker jobs tolerate restart
[ ] Images are traceable to source commits
[ ] Security scanning is available
[ ] Containers run without unnecessary root privileges
```

---

## 43. Definition of Done

Docker infrastructure is complete when:

```text id="q3n8x5"
[ ] Web image builds successfully
[ ] Worker image builds successfully
[ ] Local infrastructure starts reproducibly
[ ] Runtime configuration is externalized
[ ] No secrets are embedded
[ ] Production networking is appropriately restricted
[ ] Persistent database storage is configured where required
[ ] Container health is observable
[ ] Graceful shutdown works
[ ] Images are traceable
[ ] Deployment can use a known-good image
[ ] Rollback can select a previous image
[ ] Relevant build and deployment verification was actually executed
```