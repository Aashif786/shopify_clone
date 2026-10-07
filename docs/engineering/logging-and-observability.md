# Logging and Observability

## 1. Purpose

This document defines the logging and observability standards for the Shopify-like commerce platform.

The objective is to make the system diagnosable in development and Demo production environments without introducing unnecessary observability infrastructure.

The Demo should provide enough visibility to answer:

- What happened?
- Where did it happen?
- Which request or job caused it?
- Which tenant/store was affected?
- Did the operation succeed or fail?
- How long did it take?
- Can the failure be reproduced or investigated?

Observability must not compromise security or tenant isolation.

---

## 2. Observability Principles

The platform follows these principles:

1. Prefer structured logs over arbitrary console output.
2. Every important operation should be traceable through a correlation identifier.
3. Logs should contain useful context but avoid sensitive information.
4. Business-critical failures should be observable.
5. Logs should support debugging without becoming the primary data store.
6. Metrics should measure important system behavior rather than everything imaginable.
7. Error monitoring should capture unexpected failures.
8. Observability should remain simple in the Demo.
9. Instrumentation must not materially alter business behavior.
10. Production logs must never become a source of sensitive customer or payment data.

---

## 3. Demo Observability Stack

The Demo should use a deliberately small observability stack.

Target components:

```text
Application
    ↓
Structured logs
    ↓
Centralized/container logs

Application errors
    ↓
Sentry or equivalent error monitoring

Health endpoints
    ↓
Deployment / operational checks
```

Additional metrics or distributed tracing should only be introduced when actual requirements justify them.

Do not introduce a complete enterprise observability platform merely because one exists.

---

## 4. Structured Logging

Application logs should use structured fields rather than manually constructed strings.

Prefer:

```json id="1l1vqw"
{
  "level": "info",
  "event": "order.created",
  "requestId": "req_123",
  "storeId": "store_123",
  "orderId": "order_123"
}
```

over:

```text id="f4m8f1"
Order created for store store_123
```

Structured logs allow logs to be searched and filtered consistently.

---

## 5. Log Levels

Use log levels consistently.

### DEBUG

Development and troubleshooting information.

Examples:

- Detailed application flow.
- Diagnostic state.
- Development-only information.

DEBUG logs should generally not be enabled at high volume in production.

### INFO

Normal important operational events.

Examples:

- Application startup.
- Worker startup.
- Job completed.
- Order created.
- Payment captured.
- Deployment version loaded.

### WARN

Unexpected but recoverable conditions.

Examples:

- Retry scheduled.
- External provider temporarily unavailable.
- Deprecated behavior detected.
- Job approaching retry limit.

### ERROR

Failures requiring investigation.

Examples:

- Unexpected application exception.
- Failed critical job.
- Payment provider integration failure.
- Database operation failure.
- Webhook processing failure.

ERROR should not simply mean "a user entered invalid data."

---

## 6. What to Log

Important operations should include sufficient context.

Common fields:

```text id="q1n4pm"
timestamp
level
event
service
environment
version
requestId
userId
organizationId
storeId
operation
resourceType
resourceId
durationMs
status
errorCode
```

Only include fields that are relevant to the event.

Avoid creating huge log objects containing entire request or response payloads.

---

## 7. Correlation IDs

Requests should have a correlation/request identifier.

Example:

```text id="6q4rwy"
requestId = req_01H...
```

The identifier should be:

- Unique enough for operational tracing.
- Safe to expose to the client where useful.
- Included in server logs.
- Included in relevant error responses.

Example:

```json id="h83g5j"
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred.",
    "requestId": "req_123"
  }
}
```

This allows support and engineering teams to connect a customer-visible failure with server-side logs.

---

## 8. Background Job Correlation

Background jobs require their own execution context.

Useful fields:

```text id="w4m3kr"
jobId
jobType
attempt
requestId
eventId
storeId
```

When a job originates from a request, preserve the originating request ID where practical.

Example:

```text id="6g7c5a"
HTTP request
    ↓
OrderCreated
    ↓
SendOrderConfirmationEmail
    ↓
jobId + requestId
```

This makes asynchronous workflows traceable.

---

## 9. Event Correlation

Domain events should carry or be associated with an event identifier.

Example:

```text id="y8m2pc"
eventId
eventType
aggregateType
aggregateId
storeId
occurredAt
```

Consumers should log the event ID when processing it.

This is especially important for:

- Webhooks.
- Payment events.
- Order events.
- Inventory events.
- Background processing.

---

## 10. Tenant Context

Tenant/store identifiers should be included in relevant operational logs.

For example:

```json id="e8o2rj"
{
  "event": "inventory.reservation.failed",
  "storeId": "store_123",
  "variantId": "variant_456",
  "reason": "INSUFFICIENT_INVENTORY"
}
```

Tenant context must never be used as a reason to bypass authorization.

Logging `storeId` does not establish that the caller was authorized to access the store.

---

## 11. Sensitive Data

Never log:

- Passwords.
- Password hashes.
- Session tokens.
- Access tokens.
- Refresh tokens.
- API keys.
- Webhook signing secrets.
- Private keys.
- Payment card numbers.
- CVV/CVC.
- Full authentication headers.
- Raw authorization headers.
- Sensitive customer information without a legitimate operational need.

Do not log entire request bodies by default.

---

## 12. Customer Data

Customer information should be minimized in logs.

Avoid logging complete:

```text id="q1yd1h"
customer profiles
addresses
phone numbers
order contents
```

unless specifically required for a controlled operational investigation.

Prefer stable identifiers:

```text id="n7o8r1"
customerId
orderId
storeId
```

If an email address must be logged for a specific operational reason, use an appropriately masked representation where possible.

---

## 13. Payment Logging

Payment logging requires additional restrictions.

Log safe metadata such as:

```text id="x7b1f0"
paymentId
paymentAttemptId
orderId
storeId
provider
currency
amount
providerEventId
status
```

Never log raw payment credentials or secrets.

Do not log full provider request or response payloads unless the data has been explicitly reviewed and sanitized.

---

## 14. Authentication and Authorization Logging

Security-sensitive events should be observable.

Examples:

```text id="f8g4sy"
authentication.success
authentication.failure
authorization.denied
session.expired
webhook.signature.invalid
```

Useful fields may include:

```text id="x7h8b1"
requestId
userId
storeId
resourceType
resourceId
operation
reasonCode
```

Do not log authentication secrets.

Repeated authorization failures may indicate a security issue and should be observable.

---

## 15. Security Event Logging

Security-relevant events should be distinguishable from ordinary application events.

Examples:

```text id="c3p6t1"
security.authorization_denied
security.invalid_webhook_signature
security.invalid_session
security.cross_tenant_access_attempt
```

Security events should contain enough information for investigation while respecting data minimization.

---

## 16. Business Events vs Operational Logs

Business events and logs serve different purposes.

### Business events

Represent facts used by application workflows.

Examples:

```text id="s0x8k4"
OrderCreated
PaymentCaptured
InventoryReserved
```

They may be consumed by application components.

### Operational logs

Describe execution and system behavior.

Examples:

```text id="5v1xj7"
payment provider request timed out
job retry scheduled
database query failed
```

Operational logs are not a substitute for domain events.

---

## 17. Metrics

The Demo should collect a focused set of useful metrics.

### Application

- Request count.
- Request latency.
- Error rate.
- HTTP status distribution.

### Database

- Connection failures.
- Query failures.
- Transaction failures.
- Pool exhaustion where measurable.

### Commerce

- Checkout failures.
- Payment failures.
- Order creation failures.
- Inventory reservation failures.
- Webhook failures.

### Worker

- Jobs processed.
- Job failures.
- Retry counts.
- Processing duration.

Metrics should focus on actionable signals.

---

## 18. Latency Measurement

Important operations should measure duration.

Examples:

```text id="t0m1v7"
request duration
checkout duration
payment provider duration
database operation duration
job duration
webhook processing duration
```

Use milliseconds or another consistent unit.

Slow operations should be distinguishable from normal operations.

---

## 19. Health Checks

The web application should expose an appropriate health endpoint.

A basic health check should establish that the application process is functioning.

A readiness check may additionally verify required dependencies.

For example:

```text id="v8r4jk"
/health
/ready
```

The exact endpoint structure may follow the deployment implementation.

Health checks must not expose:

- Secrets.
- Database credentials.
- Internal topology.
- Detailed infrastructure information.

---

## 20. Worker Health

The worker should provide enough operational information to determine whether background processing is functioning.

Useful signals include:

```text id="4o3p2m"
worker running
job polling active
recent successful job
recent failed job
queue/backlog state
```

The worker should fail visibly rather than silently stopping background processing.

---

## 21. Error Monitoring

Unexpected application errors should be captured by the configured error monitoring system.

Sentry or an equivalent service may be used.

Captured errors should include safe contextual information such as:

```text id="d4q8z1"
environment
application version
requestId
storeId
userId where appropriate
operation
error code
```

Do not attach sensitive request data automatically.

---

## 22. Release and Version Tracking

Application errors should be associated with a deployable version where possible.

Useful metadata:

```text id="z5c8n2"
application version
git commit SHA
environment
deployment timestamp
```

This makes it possible to identify whether an issue started after a particular deployment.

---

## 23. Logging in Development

Local development should make failures easy to inspect.

Development logs may contain more diagnostic detail than production logs, but secrets must still never be logged.

Developer-friendly output may include:

```text id="r8q2f4"
request
operation
duration
error
stack trace
```

Sensitive values must remain protected in every environment.

---

## 24. Logging in Production

Production logging should prioritize:

- Signal over volume.
- Structured fields.
- Security.
- Searchability.
- Operational relevance.

Do not enable verbose debug logging indefinitely.

Production log volume should be controlled so that useful events are not buried beneath repetitive noise.

---

## 25. Sampling

High-volume diagnostic data may eventually require sampling.

Sampling must not remove important security or commerce failure signals.

Do not sample away:

```text id="3k9z5h"
payment failures
authorization failures
tenant-isolation failures
webhook signature failures
critical job failures
unexpected application exceptions
```

Sampling strategy should be introduced only when actual volume requires it.

---

## 26. Alerting

Alerts should correspond to actionable conditions.

Examples:

```text id="c2v7m8"
application error rate exceeds threshold
worker stops processing jobs
database becomes unavailable
payment failures spike
webhook processing failures spike
disk capacity becomes unsafe
```

Avoid alerting on every individual user error.

For example, one invalid discount code should not page an engineer.

---

## 27. Operational Dashboards

The Demo does not require a large analytics platform.

A basic operational view should make it possible to understand:

- Application health.
- Recent errors.
- Request failures.
- Worker health.
- Payment failures.
- Checkout failures.
- Database health.

Business analytics belong to future product capabilities and should not be confused with operational observability.

---

## 28. Performance Impact

Observability must not materially degrade application performance.

Avoid:

- Logging large payloads.
- Excessive synchronous logging.
- Repeated expensive serialization.
- Unnecessary database queries solely for logging.
- High-cardinality metrics without justification.

Instrumentation should be lightweight and asynchronous where appropriate.

---

## 29. Failure of Observability Systems

The application must not fail a business operation merely because logging or error monitoring is temporarily unavailable.

For example:

```text id="6q7m3p"
Order creation
    ↓
Sentry unavailable
    ↓
Order creation should still proceed
```

Observability is important, but it is not the source of truth for commerce transactions.

---

## 30. Observability and Privacy

Logs and monitoring systems may contain operationally sensitive information.

Access should therefore be restricted.

Production observability data should follow:

- Least privilege.
- Appropriate retention.
- Secure access.
- Data minimization.
- Organization security policies.

Logs should not become an uncontrolled copy of the production database.

---

## 31. AI-Assisted Development

AI agents must preserve observability when modifying important workflows.

When adding or modifying:

- Payment processing.
- Checkout.
- Inventory.
- Orders.
- Webhooks.
- Background jobs.
- Authentication.
- Authorization.

the agent should verify that appropriate logging and error monitoring remain available.

Agents must not remove logging merely to silence errors.

They must also avoid adding excessive logging as a substitute for fixing the underlying problem.

---

## 32. Testing Observability

Important observability behavior should be tested where practical.

Examples:

- Errors produce the expected error code.
- Request IDs propagate correctly.
- Job failures include job context.
- Webhook failures include event context.
- Sensitive fields are not logged.
- Health endpoints return appropriate states.

Logging implementation itself does not require exhaustive unit testing, but critical security and operational behavior must be verified.

---

## 33. Demo-to-V1 Evolution

The Demo should establish stable observability concepts without prematurely implementing enterprise infrastructure.

### Demo

```text id="j6r3c9"
Structured application logs
Error monitoring
Request correlation
Basic health checks
Focused metrics
Basic operational visibility
```

### V1

May add:

```text id="z9x2q4"
Centralized log platform
Advanced metrics
Distributed tracing
OpenTelemetry
Service-level objectives
Advanced alerting
Dedicated operational dashboards
```

The transition should extend existing instrumentation rather than require application-wide rewrites.

---

## 34. Definition of Done

Observability is considered adequate when:

- Important requests can be correlated.
- Critical background jobs are traceable.
- Unexpected errors are captured.
- Critical commerce failures are observable.
- Health and readiness can be checked.
- Sensitive information is protected.
- Logs are structured and searchable.
- Production logging remains reasonably low-noise.
- Observability failures do not break commerce operations.
- Relevant security events are visible.
- The implementation remains simple enough for the Demo.

The purpose of observability is not to produce more data. It is to make the system understandable when something inevitably goes wrong.