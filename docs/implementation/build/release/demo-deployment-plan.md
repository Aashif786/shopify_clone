# Demo Deployment Plan

## 1. Purpose

This document defines the concrete deployment model for the Demo environment.

The goal is to provide a repeatable deployment process using the approved Demo architecture:

```text
Cloudflare
    ↓
VPS
 ├── Web Application
 ├── Worker
 └── PostgreSQL
       ↓
Object Storage
```

The deployment must remain simple while preserving the security, data-integrity, observability, and recovery requirements already established by the architecture.

---

# 2. Demo Deployment Principles

The Demo deployment must be:

- Reproducible.
- Version-controlled.
- Environment-aware.
- Secure.
- Observable.
- Recoverable.
- Easy for the team to operate.
- Sufficiently close to the eventual V1 deployment model.

Do not introduce infrastructure merely for the appearance of scalability.

---

# 3. Deployment Components

The Demo environment consists of:

```text
Cloudflare
    ↓
Public DNS / TLS
    ↓
VPS
 ├── Reverse proxy / ingress
 ├── Next.js Web
 ├── Background Worker
 └── PostgreSQL
        ↓
Object Storage
```

Additional external services may include:

```text
Payment sandbox
Email provider
Sentry
Object storage
```

Only services required by the implemented Demo functionality should be enabled.

---

# 4. Cloudflare Role

Cloudflare may provide:

```text
DNS
TLS termination
Basic traffic protection
Proxying
```

The application should remain independent of Cloudflare-specific business logic.

The application must still enforce:

```text
Authentication
Authorization
Tenant isolation
Rate limits where required
Input validation
```

Cloudflare must never be treated as an authorization layer.

---

# 5. DNS

The Demo domain should resolve through the approved Cloudflare configuration.

Conceptually:

```text
demo.example.com
      ↓
Cloudflare
      ↓
VPS public IP
```

Use the actual project domain configuration rather than hardcoding hostnames into application logic.

---

# 6. TLS

The public Demo application must use HTTPS.

Verify:

```text
TLS certificate valid
HTTP redirects appropriately where configured
Secure cookies enabled
Mixed-content issues absent
```

Authentication/session cookies must never be intentionally transmitted over plain HTTP.

---

# 7. VPS Requirements

The VPS must provide sufficient resources for:

```text
Web
Worker
PostgreSQL
Docker/runtime
Monitoring
```

The exact VPS size should be based on actual Demo workload rather than speculative V1 scale.

---

# 8. VPS Operating System

Use a supported Linux distribution with:

```text
Security updates
Firewall
SSH access
Docker/runtime support
Time synchronization
Log management
```

The exact distribution is an infrastructure choice and should remain documented in the deployment environment.

---

# 9. VPS Security

Configure:

```text
SSH key authentication
Firewall
Restricted exposed ports
Automatic security updates where appropriate
Non-root application operation where practical
```

Do not expose PostgreSQL publicly unless explicitly required.

---

# 10. Network Exposure

Publicly exposed services should be limited to the required ingress ports.

Typical topology:

```text
Internet
   ↓
Cloudflare
   ↓
HTTP/HTTPS ingress
   ↓
Web
```

PostgreSQL and internal Worker communication should remain private.

---

# 11. Application Runtime

The Web application runs as the customer/merchant-facing runtime.

The Worker runs independently for background processing.

They share:

```text
Database
Configuration conventions
Domain/application packages
```

but have different runtime responsibilities.

---

# 12. Web Runtime

The Web runtime must:

- Start successfully.
- Load validated configuration.
- Connect to PostgreSQL.
- Serve Storefront.
- Serve merchant application.
- Expose health/readiness endpoints.
- Produce structured logs.

The Web runtime must not run long-running background processing.

---

# 13. Worker Runtime

The Worker must:

- Start independently.
- Connect to PostgreSQL.
- Poll durable jobs.
- Claim jobs safely.
- Process jobs.
- Retry failures.
- Recover stale jobs.
- Shut down gracefully.

The Worker must not depend on a browser request remaining open.

---

# 14. PostgreSQL

PostgreSQL is the Demo transactional source of truth.

It stores:

```text
Organizations
Memberships
Stores
Products
Variants
Inventory
Customers
Carts
Discounts
Checkouts
Payments
Orders
Webhooks
Media metadata
Notifications
Jobs
Idempotency records
```

The database must remain private to the application environment.

---

# 15. PostgreSQL Persistence

Database storage must use persistent storage.

A container restart must not destroy the database.

Verify:

```text
Database volume
Backup configuration
Restore procedure
Disk capacity
```

---

# 16. Object Storage

Object storage is used for binary media.

The architecture is:

```text
Application
   ↓
Media abstraction
   ↓
Object Storage
```

PostgreSQL stores media metadata.

Object storage stores binary content.

---

# 17. Payment Provider

The Demo should use an approved sandbox/test payment provider.

Provider secrets must be stored as environment secrets.

The application must use:

```text
Payment abstraction
+
Provider adapter
```

rather than coupling the entire application to provider-specific APIs.

---

# 18. Email Provider

If transactional email is enabled, use the approved notification provider.

Email credentials must remain server-side.

Notification failure must not cause successful Orders to fail.

---

# 19. Sentry / Error Monitoring

The Demo may use Sentry or equivalent error monitoring.

Configure:

```text
Environment
Release/version
Application errors
Worker errors
```

Do not send unnecessary sensitive customer/payment data to the monitoring service.

---

# 20. Environment Configuration

Demo configuration must be provided through environment variables.

Typical categories:

```text
Application
Database
Authentication
Storage
Payments
Notifications
Jobs
Observability
Cloudflare/infrastructure where required
```

The application must load these through the centralized typed configuration layer.

---

# 21. Secrets

Secrets must never be stored in:

```text
Git
Dockerfile
Source code
README
Logs
Client-side configuration
```

Use the approved VPS/CI secret mechanism.

---

# 22. Environment Separation

Maintain separate configuration for:

```text
Local
Demo
Future Production
```

The Demo database must never accidentally point to production infrastructure.

---

# 23. Deployment Source

The VPS should deploy a known Git revision.

Recommended flow:

```text
GitHub
   ↓
Approved main commit
   ↓
VPS
   ↓
Build/deploy
```

Do not manually edit application source files on the VPS.

---

# 24. Deployment Directory

The VPS should use a dedicated application directory.

Conceptually:

```text
/opt/<application>
```

The exact path is an infrastructure decision.

Keep application files, deployment configuration, and persistent data clearly separated.

---

# 25. Docker Deployment

If Docker is used, define:

```text
Web container
Worker container
PostgreSQL container where applicable
Network
Volumes
Environment
Health checks
Restart policy
```

The exact container structure must follow the repository's infrastructure files.

---

# 26. Container Restart Policy

Web and Worker containers should restart automatically after unexpected process failure where appropriate.

However, restart behavior must not hide repeated crashes.

Monitoring must reveal restart loops.

---

# 27. Health Checks

Define health checks for:

```text
Web liveness
Web readiness
Worker health
PostgreSQL availability
```

Readiness should represent whether the application can actually serve required functionality.

---

# 28. Deployment Sequence

Use:

```text
1. Confirm target environment
2. Confirm release commit
3. Verify CI
4. Obtain release source
5. Validate configuration
6. Build application
7. Verify build
8. Run database migrations
9. Update Web
10. Update Worker
11. Verify health
12. Run smoke tests
13. Inspect logs
14. Confirm release
```

---

# 29. Migration Ordering

Before activating code that requires a new schema:

```text
Compatible schema
      ↓
Migration
      ↓
New application behavior
```

For changes requiring backward compatibility, use the approved expand-and-contract strategy.

---

# 30. Database Backup Before Release

Before risky database migrations, verify that an appropriate backup exists.

The team must know:

```text
Backup location
Backup timestamp
Retention
Restore procedure
```

Do not assume the existence of a backup without verifying it.

---

# 31. Deployment Backup

Application deployment itself should not overwrite:

```text
Database volumes
Media storage
Secrets
Persistent configuration
```

Application source and persistent data must remain separate.

---

# 32. Smoke Test

After deployment verify:

```text
GET public Storefront
Merchant login
Product listing
Product detail
Cart
Checkout
Sandbox payment
Order creation
Merchant Order view
```

A smoke test should fail fast on critical errors.

---

# 33. Purchase Verification

The strongest Demo smoke test is a complete purchase:

```text
Storefront
 ↓
Product
 ↓
Cart
 ↓
Checkout
 ↓
Payment
 ↓
Order
```

Verify both:

```text
Customer-facing result
```

and:

```text
Database state
```

---

# 34. Worker Smoke Test

Create a safe background job and verify:

```text
Job persisted
 ↓
Worker claims job
 ↓
Handler executes
 ↓
Job reaches expected state
```

This proves the Worker is not merely running as a process.

---

# 35. Webhook Smoke Test

Use the payment sandbox/provider test mechanism to verify:

```text
Webhook arrives
 ↓
Signature verified
 ↓
Event persisted
 ↓
Worker processes event
 ↓
Payment state updated
```

Repeat the same event and verify idempotency.

---

# 36. Logging

Logs should provide enough context to diagnose:

```text
Request
Job
Webhook
Payment
Order
Database
```

Include correlation identifiers where appropriate.

Never log secrets or payment credentials.

---

# 37. Monitoring

Monitor at minimum:

```text
Web availability
Web error rate
Worker failures
Database availability
Disk usage
Memory usage
CPU usage
Payment failures
Webhook failures
```

The Demo does not require a complex enterprise observability stack.

---

# 38. Disk Monitoring

The VPS must monitor disk usage because:

```text
Database
Docker images
Application logs
Build artifacts
```

can consume disk unexpectedly.

A full disk can become a very efficient distributed denial-of-service attack performed by your own deployment process.

---

# 39. Memory Monitoring

Monitor VPS memory.

Pay particular attention to:

```text
Web process
Worker
PostgreSQL
Docker
Build process
```

Repeated memory exhaustion must be investigated rather than solved by endless restarts.

---

# 40. PostgreSQL Monitoring

At minimum monitor:

```text
Connection availability
Disk usage
Database size
Slow queries where observable
Failed connections
```

Do not expose PostgreSQL publicly for monitoring.

---

# 41. Worker Monitoring

Monitor:

```text
Active jobs
Failed jobs
Retry counts
Stale jobs
Processing latency
Worker restarts
```

A continuously running Worker that processes nothing because every job is failing is not healthy.

---

# 42. Security Monitoring

Monitor for:

```text
Repeated authentication failures
Suspicious API activity
Webhook verification failures
Unexpected error spikes
```

Rate limiting and security controls should remain application-level defenses.

---

# 43. Deployment Failure Handling

If deployment fails before application activation:

```text
Stop
Diagnose
Correct
Redeploy
```

If the new application is active but unhealthy:

```text
Stop rollout
Assess state
Verify database compatibility
Rollback if safe
```

Follow the dedicated rollback plan.

---

# 44. Rollback Requirements

Before release, determine:

```text
Previous application version
Database compatibility
Rollback command/process
Health verification
```

Do not perform a rollback that leaves the application incompatible with the database schema.

---

# 45. Application Rollback

A typical rollback is:

```text
Identify previous known-good revision
        ↓
Deploy previous application version
        ↓
Restart Web/Worker
        ↓
Verify health
        ↓
Run smoke tests
```

Database rollback must be handled separately and only when explicitly supported.

---

# 46. Database Rollback

Prefer forward-compatible migrations and forward fixes.

Do not automatically reverse migrations containing destructive operations.

If recovery requires database restoration, follow the documented backup/recovery process.

---

# 47. VPS Restart Verification

After a planned VPS restart, verify:

```text
PostgreSQL starts
Web starts
Worker starts
Volumes mount
Networking works
Health checks pass
Jobs remain recoverable
Storefront works
```

This should be tested before relying on the VPS as the Demo environment.

---

# 48. Cloudflare Verification

After deployment verify:

```text
DNS resolves
TLS works
Requests reach Web
Expected hostnames work
No unexpected caching of personalized responses
```

Transaction-sensitive responses must not be cached incorrectly.

---

# 49. Public Cache Safety

Safe candidates for caching may include:

```text
Public Store configuration
Published Product data
Public media
```

Do not cache personalized:

```text
Cart
Checkout
Payment
Order
Customer
```

responses in a way that can expose one user's data to another.

---

# 50. Deployment Access

Only authorized team members should have:

```text
VPS SSH access
Deployment credentials
Database administrative access
Payment provider credentials
Cloudflare administrative access
```

Do not distribute root credentials unnecessarily.

---

# 51. Production-Like Restrictions

Even though this is a Demo:

```text
No unrestricted production access for AI agents
No committed credentials
No shared root passwords
No public PostgreSQL
No debug authentication bypass
No arbitrary database editing
```

The Demo should establish habits that remain valid for V1.

---

# 52. Deployment Documentation

The repository should contain enough information for another authorized developer to understand:

```text
How to build
How to deploy
How to migrate
How to start Web
How to start Worker
How to check health
How to inspect logs
How to rollback
```

Do not rely on undocumented tribal knowledge.

---

# 53. Deployment Verification Checklist

Before declaring deployment successful:

```text
[ ] Correct commit deployed
[ ] Configuration validated
[ ] Secrets loaded
[ ] Database reachable
[ ] Migrations successful
[ ] Web healthy
[ ] Worker healthy
[ ] PostgreSQL healthy
[ ] Object storage reachable
[ ] Payment sandbox configured
[ ] Email provider configured where required
[ ] Monitoring active
[ ] Logs clean
[ ] Storefront accessible
[ ] Merchant login works
[ ] Cart works
[ ] Checkout works
[ ] Payment works
[ ] Order created
[ ] Worker job processed
[ ] Webhook processed
[ ] Tenant isolation verified
[ ] No release blockers
```

---

# 54. Deployment Definition of Done

The Demo deployment is complete when:

```text
Known Git revision
        ↓
Successful build
        ↓
Successful migration
        ↓
Healthy Web
        ↓
Healthy Worker
        ↓
Healthy Database
        ↓
Healthy external integrations
        ↓
Successful smoke test
        ↓
Successful purchase
        ↓
Successful background processing
        ↓
Verified monitoring
```

---

# 55. Final Deployment Principle

The Demo deployment should prove that the system can move from:

```text
Developer repository
```

to:

```text
Running commerce application
```

without undocumented manual intervention.

The infrastructure is intentionally small.

The operational discipline is not.