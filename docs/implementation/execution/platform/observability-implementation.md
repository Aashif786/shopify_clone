# Observability Implementation

## 1. Purpose

This document defines the concrete implementation of logging, monitoring, health checks, metrics, error tracking, and operational visibility for the Demo.

The objective is to make the system diagnosable without introducing unnecessary observability infrastructure.

Demo observability should be:

- Structured.
- Useful.
- Low-overhead.
- Privacy-conscious.
- Consistent across Web and Worker.
- Suitable for VPS deployment.
- Expandable for V1.

---

# 2. Observability Components

The Demo uses:

```text id="w7m4c8"
Application Logs
      +
Health Checks
      +
Operational Metrics
      +
Error Monitoring
      +
Deployment Metadata
```

The primary application components are:

```text id="q8c3v7"
apps/web
apps/worker
PostgreSQL
External Providers
```

---

# 3. Observability Ownership

Application-level observability conventions should be implemented through shared infrastructure where appropriate.

The platform should provide reusable capabilities for:

- Structured logging.
- Request correlation.
- Job correlation.
- Error reporting.
- Health checks.
- Metrics.

Domain modules should emit domain-relevant events and operational information without implementing independent logging systems.

---

# 4. Structured Logging

Application logs should use structured records rather than arbitrary text.

A log record should support fields such as:

```text id="m5x8c4"
timestamp
level
message
service
environment
release
requestId
userId
organizationId
storeId
operation
durationMs
errorCode
```

Only applicable fields should be included.

---

# 5. Log Levels

Use predictable log levels:

| Level | Purpose |
|---|---|
| `debug` | Development diagnostics |
| `info` | Normal operational events |
| `warn` | Recoverable or suspicious conditions |
| `error` | Failed operations requiring attention |
| `fatal` | Process-level failure |

Avoid using `error` for expected business rejections.

---

# 6. Request Correlation

Every HTTP request should have a request identifier.

Flow:

```text id="v8m3c7"
HTTP Request
    ↓
requestId
    ↓
Application Service
    ↓
Database / Provider
    ↓
Logs / Error Monitoring
```

This allows an operator to trace a failed operation across application layers.

---

# 7. Job Correlation

Worker executions should have job-specific correlation.

Example:

```text id="x4c7m8"
jobId
requestId if originating request exists
eventId if event-driven
organizationId
storeId
jobType
attempt
```

This makes asynchronous failures traceable back to their origin.

---

# 8. Event Correlation

Events should carry sufficient metadata for operational tracing.

Typical metadata:

```text id="q7m4c8"
eventId
eventType
occurredAt
organizationId
storeId
correlationId
causationId where supported
```

Do not put sensitive business payloads into logs merely to make events easier to debug.

---

# 9. Tenant Context in Logs

Where operationally necessary, logs may include:

```text id="m8c4x7"
organizationId
storeId
```

This allows operators to identify affected Stores.

Tenant identifiers are operational metadata, not authorization.

Logs must never be used as a substitute for application-level access control.

---

# 10. Sensitive Data Protection

Never log:

```text id="v5m8c4"
Passwords
Session tokens
Authentication cookies
API keys
Payment secrets
Webhook signatures
Full card information
Full authorization headers
```

Avoid logging unnecessary:

- Customer addresses.
- Email bodies.
- Personal information.
- Payment details.

Use redaction utilities where required.

---

# 11. Error Monitoring

Unexpected application errors should be reported to the configured error-monitoring service.

The Demo may use Sentry or an equivalent provider.

Error reports should include:

```text id="x8m3c7"
Error type
Stack trace
Environment
Release
Request ID
Operation
Service
Relevant tenant context
```

Sensitive fields must be filtered before transmission.

---

# 12. Error Monitoring Boundaries

Not every expected error should generate an error-monitoring alert.

For example:

```text id="q4m8c7"
Invalid password
Insufficient inventory
Invalid discount
Expected checkout rejection
```

are normal application behavior.

Unexpected infrastructure failures should be monitored.

---

# 13. Release Identification

Every deployment should expose a release/version identifier.

Use it in:

- Application logs.
- Error monitoring.
- Deployment metadata.
- Health information where appropriate.

This allows failures to be correlated with a specific deployment.

---

# 14. Environment Identification

Logs and monitoring data must identify the environment:

```text id="v7m4c8"
development
test
demo
production
```

Production monitoring must never accidentally ingest development environment data.

---

# 15. Health Endpoint

The Web application should expose:

```text id="x5c8m7"
/health
```

The endpoint should verify that the application process is running.

It should remain lightweight.

A successful health response should not require a complete business workflow.

---

# 16. Readiness Endpoint

The Web application should expose:

```text id="m4c8x7"
/ready
```

Readiness should verify required dependencies such as PostgreSQL connectivity.

Conceptually:

```text id="q8m3c7"
Process Running
      ↓
Configuration Valid
      ↓
Required Dependencies Available
      ↓
Ready
```

---

# 17. Health vs Readiness

These endpoints serve different purposes.

### Health

Answers:

> Is the process alive?

### Readiness

Answers:

> Can this process currently serve requests?

Do not make `/health` depend on every external provider.

---

# 18. Worker Health

The Worker should expose operational health information appropriate for the deployment model.

At minimum operators should be able to determine:

```text id="v8m4c7"
Worker process running
Database reachable
Polling active
Jobs being claimed
Recent execution activity
```

A Worker that is alive but no longer processing jobs must be detectable.

---

# 19. Database Health

Database health checks should verify connectivity without executing expensive queries.

Useful information includes:

- Connection success.
- Connection latency.
- Pool availability where exposed.

Database health failures should be observable without exposing credentials.

---

# 20. Operational Metrics

The Demo should track a focused set of metrics.

Examples:

```text id="x7m3c8"
HTTP request count
HTTP error count
HTTP latency
Database latency
Worker job count
Worker job failures
Worker job duration
Webhook failures
Payment failures
Checkout failures
```

Avoid building an elaborate metrics platform before operational need exists.

---

# 21. Request Metrics

Track:

```text id="m8c4x7"
Requests by route
Requests by method
Response status
Latency
```

Where practical, avoid creating high-cardinality metric labels from:

- User IDs.
- Order IDs.
- Request IDs.
- Arbitrary URLs.

High-cardinality identifiers belong in logs, not metric labels.

---

# 22. Worker Metrics

Worker metrics should include:

```text id="q5m8c4"
Jobs claimed
Jobs completed
Jobs failed
Jobs retried
Job duration
Retry count
Stale jobs recovered
```

These metrics help detect queue backlog and processing failures.

---

# 23. Business-Critical Metrics

The following operations deserve explicit operational visibility:

```text id="v4c8m7"
Checkout failures
Payment failures
Order creation failures
Inventory reservation failures
Webhook failures
Notification delivery failures
```

These are more useful than collecting hundreds of generic metrics that nobody looks at.

---

# 24. Inventory Observability

Inventory operations should make it possible to diagnose:

- Reservation failures.
- Release failures.
- Finalization failures.
- Concurrency conflicts.
- Negative-stock protection failures.

Do not log full inventory records unnecessarily.

---

# 25. Payment Observability

Payment operations should provide enough information to investigate:

```text id="x8m4c7"
Payment attempt
Provider
Payment state
Provider reference
Failure category
Webhook event
Refund operation
```

Sensitive payment credentials must never be logged.

---

# 26. Checkout Observability

Checkout failures should be traceable through:

```text id="m7c4x8"
Checkout ID
Cart ID where appropriate
Store ID
Payment attempt
Inventory operation
Order creation
```

Identifiers are preferable to logging full checkout contents.

---

# 27. Order Observability

Order operations should allow investigation of:

```text id="q8m3c7"
Order creation
State transitions
Cancellation
Refund
Payment relationship
Inventory relationship
```

Historical order data itself should not be duplicated into logs.

---

# 28. Webhook Observability

Track webhook processing using:

```text id="v5m8c4"
Provider
Event ID
Event type
Signature result
Processing status
Attempt count
Failure category
Processing duration
```

Do not log:

- Signature secrets.
- Raw authentication headers.
- Entire payloads unless explicitly justified and securely handled.

---

# 29. Notification Observability

Notification processing should track:

```text id="x4c8m7"
Notification type
Channel
Delivery state
Attempt
Failure category
Duration
```

Do not log full email content.

---

# 30. Logging External Providers

Provider calls should record operational metadata such as:

```text id="m8c4x7"
Provider
Operation
Duration
Success/failure
Retry count
Failure category
```

Do not log authorization headers or credentials.

---

# 31. Database Logging

Application-level database errors should contain enough context to diagnose failures.

Do not log:

```text id="q7m4c8"
Full SQL containing sensitive values
Connection strings
Passwords
Secrets
```

Query timing may be recorded where useful.

---

# 32. Slow Operation Detection

The system should identify unusually slow operations.

Potential categories:

```text id="v8m3c7"
Slow HTTP request
Slow database query
Slow provider request
Slow job
```

Thresholds should be configurable rather than scattered throughout the codebase.

---

# 33. Alerting

Demo alerting should focus on actionable failures.

Potential alerts:

```text id="x5m8c4"
Application unavailable
Database unavailable
Worker stopped processing
High API error rate
Payment failure spike
Webhook processing failures
Job retry/backlog growth
```

Do not alert on every individual expected business rejection.

---

# 34. Deployment Verification

After deployment, verify:

```text id="m7c4x8"
Web process running
Worker process running
/health succeeds
/ready succeeds
Database reachable
Logs flowing
Error monitoring connected
Critical API works
Worker processes a test job
```

---

# 35. Graceful Shutdown Observability

When shutting down:

```text id="q8m4c7"
Stop accepting new work
        ↓
Stop job polling
        ↓
Allow active operations to finish
        ↓
Close database connections
        ↓
Exit
```

Logs should clearly indicate shutdown progress.

---

# 36. Startup Observability

Application startup should record:

```text id="v4m8c7"
Service
Environment
Release
Startup completion
Database connectivity
Worker readiness
```

Never print secrets or complete environment variables.

---

# 37. Crash Recovery

Unexpected process termination should be detectable.

For Worker:

```text id="x7m3c8"
Process crash
 ↓
Unfinished jobs remain persisted
 ↓
Stale-job recovery
 ↓
Another worker execution
```

Observability should make repeated crashes visible.

---

# 38. Privacy

Observability data should follow the same privacy principles as application data.

Avoid collecting information merely because it is technically possible.

Logs and monitoring systems should have appropriate:

- Retention.
- Access control.
- Redaction.
- Environment separation.

---

# 39. Production Log Access

Production logs should be restricted.

Access should be granted only to people who require it for:

- Operations.
- Debugging.
- Security investigation.

Production logs should not become an unrestricted copy of customer data.

---

# 40. Observability Configuration

Observability configuration belongs in centralized application configuration.

Examples:

```text id="m8c4x7"
LOG_LEVEL
SENTRY_DSN
RELEASE_VERSION
METRICS_ENABLED
HEALTH_CHECK_ENABLED
```

Exact configuration names should follow the configuration implementation.

---

# 41. Local Development

Local development should provide useful logs without requiring production monitoring infrastructure.

Developers should be able to:

```text id="q5m8c4"
Start Web
Start Worker
Run PostgreSQL
Observe requests
Observe jobs
Inspect errors
```

External monitoring services may be optional locally.

---

# 42. Test Environment

Tests should not accidentally send production monitoring data.

Test configuration should isolate:

- Logs.
- Error monitoring.
- Metrics.
- Database.
- External provider credentials.

---

# 43. Observability Testing

Test:

```text id="v7m4c8"
[ ] Request IDs are generated
[ ] Request IDs propagate
[ ] Job IDs are logged
[ ] Tenant context is handled correctly
[ ] Sensitive fields are redacted
[ ] Errors reach monitoring
[ ] Health endpoint works
[ ] Readiness detects database failure
[ ] Worker health is observable
[ ] Shutdown is logged
```

---

# 44. Security Testing

Verify that observability cannot leak:

```text id="x8c4m7"
[ ] Passwords
[ ] Session tokens
[ ] Cookies
[ ] API keys
[ ] Payment credentials
[ ] Webhook secrets
[ ] Authorization headers
[ ] Sensitive customer information
```

---

# 45. Implementation Sequence

Implement in this order:

```text id="m4c8x7"
1. Define structured logging interface
2. Implement request correlation
3. Implement application context logging
4. Implement Worker/job correlation
5. Implement error monitoring
6. Implement release/environment metadata
7. Implement /health
8. Implement /ready
9. Implement Worker health
10. Implement basic metrics
11. Add critical business metrics
12. Add sensitive-data redaction
13. Add slow-operation detection
14. Configure alerting
15. Add deployment verification
16. Add observability tests
17. Verify production configuration
```

---

# 46. Definition of Done

Observability is complete when:

```text id="q7m3c8"
[ ] Web logs are structured
[ ] Worker logs are structured
[ ] Request correlation works
[ ] Job correlation works
[ ] Tenant context is safely observable
[ ] Sensitive data is redacted
[ ] Error monitoring is integrated
[ ] Releases are identifiable
[ ] /health works
[ ] /ready works
[ ] Worker health is observable
[ ] Core metrics exist
[ ] Critical business failures are measurable
[ ] Slow operations are detectable
[ ] Production alerts are actionable
[ ] Graceful shutdown is observable
[ ] Crash recovery is detectable
[ ] Observability tests pass
```

The Demo does not need an observability cathedral. It needs enough trustworthy signals to answer three questions quickly: **Is the system healthy? What failed? Where did it fail?**