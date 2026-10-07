# Observability Foundation Implementation

## 1. Purpose

This document defines the observability foundation for the Demo.

The objective is to make application behavior understandable in development and production by providing structured logs, health information, error reporting, operational context, and basic metrics without introducing unnecessary infrastructure.

---

# 2. Observability Principles

The observability system must provide:

- Useful structured logs.
- Request correlation.
- Job correlation.
- Error visibility.
- Health and readiness information.
- Basic operational metrics.
- Deployment/release identification.
- Safe handling of sensitive information.

Observability must help diagnose problems without becoming a source of new security or performance problems.

---

# 3. Initial Observability Stack

The Demo should keep observability intentionally small.

Initial components:

```text id="8c4m7x"
Application Logs
        ↓
Sentry / Error Monitoring
        ↓
Basic Infrastructure Monitoring
```

Additional monitoring systems should be introduced only when operational requirements justify them.

---

# 4. Application Logging

Both runtime applications should use structured logging:

```text id="m7x3c9"
apps/web
apps/worker
```

Logs should be machine-readable where practical.

---

# 5. Structured Log Fields

Common fields may include:

```text id="q8m4n2"
timestamp
level
message
application
environment
version
requestId
userId
organizationId
storeId
jobId
eventId
operation
duration
errorCode
```

Only include fields relevant to the event.

---

# 6. Log Levels

Use consistent levels:

```text id="v5c8m3"
debug
info
warn
error
```

### Debug

Detailed development information.

### Info

Normal operational events.

### Warn

Unexpected but recoverable conditions.

### Error

Failures requiring investigation or recovery.

---

# 7. Production Log Level

Production should normally avoid excessive debug logging.

The default level should be configurable.

Sensitive data must never become safe merely because the log level is `debug`.

---

# 8. Request Correlation

Every HTTP request should receive or propagate a request identifier.

Conceptually:

```text id="n6m3x8"
HTTP Request
    ↓
requestId
    ↓
Logs
    ↓
Application Service
    ↓
External Operation
```

This allows one operation to be traced across multiple log entries.

---

# 9. Worker Correlation

Worker execution should have a job identifier.

Example:

```text id="c7m4x9"
Job
├── jobId
├── type
└── attempt
```

Logs produced during execution should include the job ID.

---

# 10. Event Correlation

Domain and integration events should include their event identity where useful.

This helps determine:

- Which event was processed.
- Whether it was retried.
- Which job originated from it.
- Whether duplicate processing occurred.

---

# 11. Tenant Context in Logs

Tenant identifiers may be included in internal logs:

```text id="p8n3m7"
organizationId
storeId
```

This is particularly useful for diagnosing:

- Authorization failures.
- Storefront problems.
- Inventory issues.
- Checkout failures.
- Order processing failures.

Sensitive customer data should not be logged merely for convenience.

---

# 12. User Context

A user ID may be included where useful.

Avoid logging:

- Passwords.
- Session tokens.
- Authentication headers.
- Payment credentials.
- Password-reset tokens.
- Verification tokens.

---

# 13. Request Logging

The API layer should capture useful request metadata.

Typical fields:

```text id="x4m8c7"
HTTP method
route
status
duration
requestId
```

Request bodies should not automatically be logged.

---

# 14. Response Logging

Responses should generally record:

- Status code.
- Duration.
- Request ID.

Avoid logging complete response bodies by default.

---

# 15. Error Monitoring

Unexpected application errors should be reported to the configured error-monitoring system.

The Demo may use Sentry or an equivalent service.

Error monitoring should include useful context without exposing secrets.

---

# 16. Error Monitoring Context

Where appropriate, attach:

- Application.
- Environment.
- Release/version.
- Request ID.
- User ID.
- Store ID.
- Job ID.
- Operation.

Avoid attaching full request payloads unless explicitly safe.

---

# 17. Release Tracking

Deployments should identify the running application version.

Possible identifiers:

```text id="m9c4x8"
Git commit SHA
Release version
Build identifier
```

This allows an error to be correlated with the code that produced it.

---

# 18. Health Endpoint

The Web application should expose a lightweight health endpoint.

Example:

```text id="q5m8c3"
/health
```

It should answer whether the process is alive.

---

# 19. Readiness Endpoint

Readiness determines whether the application can safely serve normal traffic.

Example:

```text id="v7m3x9"
/ready
```

Readiness may verify:

- Required configuration.
- Database connectivity.
- Essential runtime dependencies.

---

# 20. Health vs Readiness

These endpoints have different meanings:

```text id="c8m4n7"
Health
    =
Is the process alive?

Readiness
    =
Can this process safely handle work?
```

A process may be alive while not being ready.

---

# 21. Worker Health

The Worker must provide enough operational information to determine:

- Process is running.
- Database is available.
- Worker loop is active.
- Jobs can be claimed.
- Shutdown is not stuck.

The exact health mechanism may be a lightweight endpoint or another deployment-compatible mechanism.

---

# 22. Database Monitoring

The database should be monitored for:

- Availability.
- Connection failures.
- Pool exhaustion.
- Query failures.
- Storage utilization.
- Significant performance degradation.

The Demo does not require a dedicated database monitoring platform unless operational needs justify one.

---

# 23. Application Metrics

The initial Demo should track only useful operational metrics.

Examples:

```text id="x6n3m8"
HTTP request count
HTTP error count
HTTP latency
Worker job success count
Worker job failure count
Worker job retry count
Database connection failures
Payment failures
Webhook processing failures
```

---

# 24. Business Metrics

Basic operational business metrics may be recorded where useful.

Examples:

```text id="k4m8c7"
Checkout attempts
Checkout failures
Orders created
Payments succeeded
Payments failed
Inventory reservation failures
```

The Demo does not require a separate analytics warehouse.

---

# 25. Metrics Cardinality

Avoid high-cardinality metric labels.

Do not create metrics with arbitrary:

```text id="w7m3c9"
customerId
orderId
requestId
email
```

as metric dimensions.

These values belong in logs/traces rather than metric labels.

---

# 26. Latency Measurement

Important operations should record duration where useful.

Examples:

- API requests.
- Database operations where measurable.
- External provider calls.
- Worker jobs.

Latency information should help identify bottlenecks without generating excessive telemetry.

---

# 27. External Provider Observability

Provider integrations should record:

- Operation.
- Provider.
- Duration.
- Success/failure.
- Retryability.
- Correlation information.

Do not log provider secrets or full sensitive requests.

---

# 28. Payment Observability

Payment operations require particularly careful monitoring.

Useful signals include:

```text id="n8c4m6"
Payment attempt
Provider response
Payment failure
Webhook received
Webhook rejected
Webhook processed
Refund attempted
Refund failed
```

Sensitive payment information must not be logged.

---

# 29. Inventory Observability

Inventory-related operational signals may include:

- Reservation failures.
- Insufficient inventory.
- Concurrent update conflicts.
- Release failures.
- Inventory adjustment failures.

These signals help detect correctness problems.

---

# 30. Checkout Observability

Checkout should provide enough visibility to identify failures across:

```text id="p5m8x3"
Cart
 ↓
Pricing
 ↓
Discount
 ↓
Inventory
 ↓
Payment
 ↓
Order
```

A failed checkout should be traceable to its failure stage.

---

# 31. Order Observability

Order lifecycle transitions should be observable.

Examples:

```text id="x7c3m9"
Order Created
Order Paid
Order Processing
Order Completed
Order Cancelled
Order Refunded
```

Do not log sensitive customer information with every state transition.

---

# 32. Webhook Observability

Webhook processing should expose:

- Received.
- Signature rejected.
- Duplicate detected.
- Processing started.
- Processing succeeded.
- Processing failed.
- Retry scheduled.

Webhook IDs may be logged where safe.

---

# 33. Worker Observability

Worker logs should identify:

```text id="m6n4c8"
jobId
jobType
attempt
duration
result
failure category
```

This makes retry and failure behavior diagnosable.

---

# 34. Worker Metrics

Useful Worker metrics include:

- Jobs claimed.
- Jobs completed.
- Jobs failed.
- Jobs retried.
- Jobs permanently failed.
- Job duration.
- Queue depth where available.
- Stale jobs recovered.

---

# 35. Database Query Logging

Do not enable unrestricted SQL query logging in production.

Query logging may expose:

- Sensitive values.
- Excessive log volume.
- Performance overhead.

Use database-level performance tools where necessary.

---

# 36. Sensitive Data Policy

Observability systems must treat the following as sensitive:

```text id="q8m3x7"
Passwords
Session tokens
Reset tokens
Verification tokens
API keys
Provider secrets
Payment credentials
Authorization headers
Sensitive customer data
```

These values must not appear in logs or error-monitoring payloads.

---

# 37. Log Redaction

Where request metadata is captured automatically, sensitive headers and fields must be explicitly redacted.

Examples:

```text id="v4m8c9"
Authorization
Cookie
Set-Cookie
password
token
secret
apiKey
```

The exact list should be maintained centrally.

---

# 38. Privacy

Observability should collect only information needed for operational purposes.

Do not retain detailed customer information merely because it might someday be useful.

Retention policies should be appropriate to the environment.

---

# 39. Development Observability

Development should make failures easy to diagnose.

Useful development behavior includes:

- Readable logs.
- Debug-level logging when enabled.
- Clear startup failures.
- Local error stack traces.
- Database migration output.

Development convenience must not weaken production security defaults.

---

# 40. Production Observability

Production should prioritize:

- Actionable errors.
- Stable structured logs.
- Health information.
- Basic metrics.
- Deployment correlation.
- Security-safe context.

Avoid noisy telemetry that provides little operational value.

---

# 41. Alerting

The Demo should initially alert only on meaningful operational failures.

Examples:

```text id="n5c8m3"
Application unavailable
Database unavailable
Worker stopped
High error rate
Repeated payment failures
Repeated webhook failures
```

Do not create alerts for every warning.

---

# 42. Alert Severity

Alerts should distinguish:

```text id="m8x4c7"
Critical
High
Warning
Informational
```

Critical alerts should represent conditions requiring immediate attention.

---

# 43. Deployment Verification

After deployment, verify:

```text id="c6m9x4"
Web health
Web readiness
Worker health
Database connectivity
Recent application errors
Migration status
```

This should be part of the deployment verification process.

---

# 44. Observability During Rollback

Rollback procedures should preserve enough telemetry to determine:

- Which version failed.
- When failure started.
- Whether rollback restored health.
- Whether database changes remain compatible.

Do not erase logs merely because an application version was rolled back.

---

# 45. Observability and Testing

Tests should verify:

- Request IDs are generated.
- Error logs contain correlation context.
- Secrets are redacted.
- Health endpoint works.
- Readiness correctly reports dependency failure.
- Worker failures are observable.

---

# 46. Observability Package Boundaries

Observability utilities may be provided through a shared technical package if required.

They must remain infrastructure-level utilities.

Domain modules should emit meaningful domain events/log metadata but should not depend on a specific monitoring vendor.

---

# 47. Vendor Isolation

Application code should not become tightly coupled to a specific monitoring provider.

Prefer:

```text id="x8m3c7"
Application
    ↓
Observability Interface
    ↓
Sentry / Logging Provider
```

rather than scattering provider-specific SDK calls throughout business logic.

---

# 48. Failure of Observability

The application should normally continue operating if an external observability provider is unavailable.

For example:

```text id="q4m8x3"
Sentry unavailable
    ↓
Application continues
    ↓
Local/server logging remains available
```

Observability must not become a single point of failure for commerce operations.

---

# 49. Observability Definition of Done

```text id="v7m4c8"
[ ] Structured logging exists
[ ] Web logs include request IDs
[ ] Worker logs include job IDs
[ ] Tenant context is included safely
[ ] Error monitoring is integrated
[ ] Release/version identification exists
[ ] Health endpoint exists
[ ] Readiness endpoint exists
[ ] Worker health exists
[ ] Basic HTTP metrics exist
[ ] Worker metrics exist
[ ] Important payment signals exist
[ ] Important webhook signals exist
[ ] Database failures are observable
[ ] Secrets are redacted
[ ] Sensitive headers are excluded
[ ] Production logs are appropriately filtered
[ ] Alerting covers meaningful failures
[ ] Deployment verification checks observability
[ ] Observability tests exist
```

---

# 50. Final Principle

Observability should make the system explainable:

```text id="k3n8m6"
Request
  ↓
requestId
  ↓
Application Operation
  ↓
Domain Event / Job
  ↓
External Integration
  ↓
Logs + Metrics + Errors
```

The goal is not to collect every possible byte of telemetry. The goal is to answer, quickly and safely:

**What happened, where did it happen, why did it happen, and which version caused it?**