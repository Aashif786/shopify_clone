# ADR-005: Background Job Strategy

## Status

**Accepted**

## Date

2026-10-07

## Decision

The platform will use a **PostgreSQL-backed background job system** for the Demo environment.

Background jobs will be persisted in PostgreSQL and processed by the dedicated `apps/worker` application.

The Demo will not introduce Redis, Kafka, RabbitMQ, or another dedicated queueing infrastructure unless actual requirements justify the additional operational complexity.

---

## 1. Context

The platform requires asynchronous processing for work that should not block synchronous HTTP requests.

Examples include:

- Email delivery.
- Notifications.
- Media processing.
- Webhook follow-up processing.
- Order-related secondary actions.
- Cleanup tasks.
- Retryable external integrations.
- Scheduled maintenance tasks.

The platform is currently a modular monolith with:

```text
apps/web
apps/worker
PostgreSQL
```

A dedicated queue infrastructure would increase operational complexity during the Demo without being necessary for the expected workload.

---

## 2. Decision Drivers

The decision is based on:

- Demo simplicity.
- Reliability.
- Transactional consistency.
- Retry support.
- Idempotency.
- Operational cost.
- Observability.
- Concurrency control.
- Future scalability.
- Existing PostgreSQL architecture.
- Avoiding premature infrastructure.

---

## 3. Chosen Architecture

The architecture is:

```text id="z8s1qf"
Web / Application
       ↓
Create Job Record
       ↓
PostgreSQL
       ↓
Worker
       ↓
Claim Job
       ↓
Execute
       ↓
Complete / Retry / Fail
```

PostgreSQL acts as the durable job store.

The worker is responsible for execution.

---

## 4. Why PostgreSQL

PostgreSQL is already the platform's transactional source of truth.

Using it for Demo jobs provides:

- Durable persistence.
- Transactional job creation.
- Simple local development.
- Fewer infrastructure dependencies.
- Easier backup/recovery.
- Straightforward operational debugging.

---

## 5. Transactional Job Creation

Where a job must correspond to a successful database mutation, the job record should be created within the same transaction when appropriate.

Example:

```text id="e6r8k2"
BEGIN
  ↓
Create Order
  ↓
Create Notification Job
  ↓
COMMIT
```

If the transaction fails, neither the order nor the associated transactional job should be left in an inconsistent state.

---

## 6. Events vs Jobs

The platform distinguishes:

### Event

A fact that something happened.

Example:

```text id="v7k2cx"
OrderCreated
```

### Job

Work that needs to be performed.

Example:

```text id="f9q3na"
SendOrderConfirmationEmail
```

An event may result in one or more jobs.

Events describe facts. Jobs describe work.

---

## 7. Job Ownership

The worker executes jobs, but domain ownership remains with the relevant module.

For example:

```text id="6f3y7d"
Orders module
    ↓
Defines order-related job contract
    ↓
Worker
    ↓
Executes registered handler
```

The worker must not become the owner of business rules belonging to domain modules.

---

## 8. Job Structure

A job record should contain enough information to safely process work.

Conceptually:

```text id="q7c4mn"
id
type
payload
status
attempt_count
available_at
locked_at
completed_at
failed_at
last_error
created_at
updated_at
```

The exact schema belongs to the implementation.

---

## 9. Job Status

Typical states are:

```text id="b2z5rm"
pending
running
completed
failed
```

A retryable failure may return a job to a pending/retryable state.

The exact state machine should remain explicit.

---

## 10. Job Claiming

Workers must claim jobs safely when multiple workers are running.

A PostgreSQL strategy may use:

```text id="v3j7hx"
SELECT ...
FOR UPDATE SKIP LOCKED
```

This allows workers to process independent jobs concurrently without incorrectly claiming the same job.

---

## 11. Claiming Rules

A worker should:

1. Find an eligible job.
2. Lock/claim it.
3. Mark it as running.
4. Commit the claim.
5. Execute the work outside the claim transaction.
6. Record completion or retry state.

Long-running work should not hold a database lock for its entire execution.

---

## 12. Job Visibility

Jobs must not remain permanently invisible if a worker crashes after claiming them.

The system should track enough state to identify stale running jobs.

A recovery mechanism may return abandoned jobs to a retryable state after an appropriate timeout.

---

## 13. Worker Crash Recovery

Example:

```text id="d1s9k3"
Worker claims job
       ↓
Worker crashes
       ↓
Job remains running
       ↓
Recovery detects stale claim
       ↓
Job becomes retryable
       ↓
Another worker processes it
```

The recovery behavior must be safe for the job's business effect.

---

## 14. Job Idempotency

Jobs must be designed for safe retries.

A job may execute more than once because of:

- Worker crashes.
- Network failures.
- Timeouts.
- Process termination.
- Retry policies.
- Duplicate scheduling.

A retry must not create unintended duplicate business effects.

---

## 15. Examples of Idempotent Jobs

Suitable examples include:

- Send notification using a deduplication mechanism.
- Process a specific webhook event.
- Generate media derivative for a known object.
- Recalculate derived information.
- Synchronize an external resource using a known external identifier.

---

## 16. Non-Idempotent Work

If a job performs inherently non-idempotent external work, the implementation must introduce a durable mechanism to make the overall operation safely retryable.

For example:

```text id="h6x2j4"
Job
 ↓
Idempotency record
 ↓
External operation
 ↓
Persist result
```

The exact approach depends on the provider and operation.

---

## 17. Retry Policy

Retryable failures should use bounded retries.

A job may include:

```text id="r2n6c8"
attempt_count
max_attempts
available_at
```

Retry delays should normally use increasing backoff.

---

## 18. Retryable Errors

Examples may include:

- Temporary network failure.
- External service timeout.
- Temporary provider unavailability.
- Database connection interruption.

The exact classification depends on the operation.

---

## 19. Non-Retryable Errors

Examples may include:

- Invalid permanent input.
- Unsupported operation.
- Invalid job payload.
- Missing required resource that cannot recover automatically.
- Authentication failure caused by permanently invalid configuration.

These jobs should move to an appropriate failed state rather than retry indefinitely.

---

## 20. Retry Limits

Jobs must have bounded retries.

Infinite retry loops can:

- Consume worker capacity.
- Flood external services.
- Hide real failures.
- Increase costs.

After the configured retry limit, the job should become permanently failed or enter a recoverable dead-letter-like state.

---

## 21. Failed Jobs

Failed jobs should retain enough diagnostic information to investigate:

- Job type.
- Attempt count.
- Last error category.
- Relevant timestamps.
- Correlation/request ID where available.

Sensitive payload data must not be exposed unnecessarily.

---

## 22. Dead-Letter Behavior

The Demo does not require a separate message broker dead-letter queue.

Persistently failed jobs may remain in PostgreSQL with a terminal failed state.

Future tooling may provide:

- Retry failed job.
- Inspect failure.
- Mark resolved.
- Replay job.

---

## 23. Job Payloads

Job payloads should contain stable identifiers rather than large snapshots when practical.

Prefer:

```text id="f3q8y0"
{
  "orderId": "..."
}
```

over embedding an entire mutable order object.

The worker can load the current required state from the authoritative database.

Historical behavior must still use appropriate snapshots when the job is explicitly tied to historical state.

---

## 24. Payload Versioning

Long-lived or retryable job payloads may outlive the application version that created them.

Therefore, important job payloads should be designed for compatibility.

Where necessary, include a payload version:

```text id="c4m7x1"
{
  "version": 1,
  "orderId": "..."
}
```

Handlers should support the required historical payload versions during the migration window.

---

## 25. Job Timeouts

Jobs should have reasonable execution expectations.

Long-running jobs should not block the entire worker indefinitely.

The worker should support appropriate timeout or cancellation behavior where practical.

---

## 26. Graceful Shutdown

When a worker receives a shutdown signal:

1. Stop claiming new jobs.
2. Allow safe in-progress work to finish where possible.
3. Release/recover claims appropriately.
4. Close database connections.
5. Exit cleanly.

The worker must not intentionally abandon work without recording recoverable state.

---

## 27. Worker Concurrency

The worker may process multiple jobs concurrently when safe.

Concurrency should be bounded to prevent:

- Database overload.
- Memory exhaustion.
- External provider overload.
- Excessive CPU usage.

The appropriate limit is an operational configuration rather than an arbitrary permanent constant.

---

## 28. Priority

The Demo does not require a complex priority queue.

If prioritization is necessary, jobs may include a simple priority value.

The system should avoid introducing elaborate scheduling infrastructure without a real requirement.

---

## 29. Scheduling

Scheduled jobs may use a timestamp such as:

```text id="n4p7s2"
available_at
```

The worker can process jobs once they become eligible.

A separate scheduler service is not required for the Demo unless actual requirements emerge.

---

## 30. Recurring Jobs

Recurring jobs should not depend on an in-memory timer that disappears when the worker restarts.

Recurring work should be represented by durable scheduling logic.

The Demo may use an external scheduler or controlled worker scheduling mechanism where necessary.

---

## 31. Job Observability

Worker logs should include:

- Job ID.
- Job type.
- Attempt number.
- Duration.
- Result.
- Error classification.
- Correlation ID where available.

Do not log secrets or sensitive payloads.

---

## 32. Metrics

Useful worker metrics include:

- Jobs processed.
- Jobs succeeded.
- Jobs failed.
- Jobs retried.
- Processing duration.
- Queue depth.
- Oldest pending job age.
- Stale running jobs.

Metrics should focus on operationally meaningful signals.

---

## 33. Monitoring

The Demo should monitor:

```text id="a7c2m5"
Worker availability
Queue depth
Failure rate
Retry rate
Processing latency
Stale jobs
```

A continuously growing queue is an operational failure signal.

---

## 34. Job Error Handling

A worker should distinguish:

```text id="d7v4m2"
Expected business failure
Temporary infrastructure failure
Permanent configuration failure
Unexpected application failure
```

The retry decision should be based on the classification.

---

## 35. External Integrations

External calls from jobs must:

- Use provider adapters.
- Have timeouts.
- Handle transient failures.
- Avoid logging credentials.
- Support safe retries.
- Respect provider rate limits.
- Preserve idempotency where required.

---

## 36. Email Jobs

Email delivery is a typical asynchronous operation.

Example:

```text id="m6q8t1"
Order created
    ↓
Create email job
    ↓
Worker
    ↓
Email provider
    ↓
Success / Retry
```

Order creation must not depend on the email provider responding successfully when email is a secondary effect.

---

## 37. Notification Jobs

Notifications should be generated from business events or explicit application actions.

The notification system must not alter authoritative order/payment/inventory state merely because notification delivery fails.

---

## 38. Media Jobs

Media processing may use background jobs for:

- Image resizing.
- Thumbnail generation.
- Metadata extraction.
- File validation.
- Cleanup.

The original uploaded object and its processing state must remain recoverable.

---

## 39. Webhook Jobs

Webhook reception may be split into:

```text id="c7p5z2"
Receive webhook
    ↓
Verify signature
    ↓
Persist event
    ↓
Create processing job
    ↓
Worker processes event
```

This allows the HTTP endpoint to acknowledge valid events quickly while preserving durable processing.

The exact provider requirements must be respected.

---

## 40. Transaction Boundaries

The worker should keep database transactions short.

Prefer:

```text id="u1m8q4"
Claim transaction
    ↓
Commit
    ↓
Execute external work
    ↓
Result transaction
    ↓
Commit
```

rather than holding a database transaction open during slow external operations.

---

## 41. Worker Database Access

The worker may access the database through the same domain module interfaces and persistence boundaries used by the web application.

It must not bypass module ownership simply because it is a separate process.

---

## 42. Security

Worker processing must enforce appropriate security boundaries.

Jobs must not allow arbitrary payloads to:

- Execute SQL.
- Execute shell commands.
- Access arbitrary files.
- Access unrelated tenant data.
- Invoke unauthorized external operations.

Job payloads must be treated as application-controlled data, not executable instructions.

---

## 43. Tenant Context

Tenant-sensitive jobs must preserve enough information to resolve the correct tenant/store context.

Example:

```text id="b6r1n9"
Job
  ↓
Store ID
  ↓
Authorization / ownership validation
  ↓
Module operation
```

A worker must never assume that a job payload's tenant identifier is trustworthy merely because it came from a database record.

---

## 44. Job Data Retention

Completed jobs should have an appropriate retention policy.

Retention should balance:

- Operational debugging.
- Audit requirements.
- Database growth.
- Privacy.

Large payloads should not be retained indefinitely without justification.

---

## 45. Cleanup

Cleanup jobs may remove or archive:

- Old completed jobs.
- Expired temporary records.
- Stale processing records.

Cleanup must never remove business records that are still required for correctness or auditability.

---

## 46. Testing

The job system requires:

### Unit tests

- Job handlers.
- Retry classification.
- Payload validation.
- State transitions.

### Integration tests

- Job claiming.
- PostgreSQL locking.
- Retry persistence.
- Transaction behavior.
- Concurrent workers.

### E2E tests

- Critical workflows that produce jobs.
- End-to-end processing of important asynchronous operations.

---

## 47. Concurrency Testing

Tests should simulate multiple workers competing for the same pending jobs.

Expected behavior:

```text id="r5c8v1"
Job
 ↓
Worker A → claims
Worker B → skips
```

Only one worker should own the job at a time.

---

## 48. Failure Testing

Worker tests should simulate:

- Worker crash.
- Database interruption.
- External timeout.
- External failure.
- Invalid payload.
- Maximum retries.
- Duplicate execution.

The expected recovery behavior must be explicit.

---

## 49. AI-Assisted Job Development

AI agents modifying the job system must:

- Read the relevant architecture and job documentation.
- Preserve idempotency.
- Preserve retry semantics.
- Consider concurrency.
- Consider worker crashes.
- Respect tenant boundaries.
- Avoid introducing a new queue infrastructure without justification.
- Add tests for failure and retry behavior.

AI must not "fix" queue problems by simply increasing retry counts or hiding failures.

---

## 50. Rejected Alternatives

### Redis Queue

Not required for the expected Demo workload.

May be introduced later when PostgreSQL-backed jobs become an operational bottleneck.

### Kafka

Rejected for the Demo because event-stream infrastructure is unnecessary for current requirements.

### RabbitMQ

Rejected because the Demo does not require a dedicated message broker.

### In-Memory Queue

Rejected because jobs would be lost on process restart and would not provide durable execution.

### External SaaS Queue

Rejected because the Demo can meet requirements using existing PostgreSQL infrastructure.

---

## 51. Migration Path to V1

The job abstraction should isolate job execution from the storage mechanism.

Conceptually:

```text id="g4v2n8"
Application
    ↓
Job Interface
    ↓
PostgreSQL Job Store
```

Later:

```text id="k8m5s3"
Application
    ↓
Job Interface
    ↓
Redis / Queue Infrastructure
```

The application should not depend directly on PostgreSQL-specific queue mechanics outside the persistence implementation.

---

## 52. Consequences

### Positive

- Simple Demo infrastructure.
- Durable jobs.
- Transactional job creation.
- Easy local development.
- No additional queue service.
- Strong PostgreSQL consistency.
- Straightforward debugging.

### Negative

- PostgreSQL handles additional workload.
- High-scale queue throughput may eventually require dedicated infrastructure.
- Job scheduling is less sophisticated than specialized queue systems.
- Worker scalability is bounded by the database-backed design.

These tradeoffs are acceptable for the Demo.

---

## 53. Definition of Done

The background job strategy is implemented when:

```text id="y2r6p4"
[ ] PostgreSQL-backed job persistence exists
[ ] apps/worker processes jobs
[ ] Job states are defined
[ ] Job claiming is concurrency-safe
[ ] Jobs support retries
[ ] Retry limits exist
[ ] Jobs are idempotent where required
[ ] Stale jobs can recover
[ ] Worker shutdown is graceful
[ ] Job payloads are validated
[ ] Tenant context is preserved
[ ] External calls have appropriate timeout/retry behavior
[ ] Worker observability exists
[ ] Job concurrency is tested
[ ] Failure recovery is tested
[ ] Webhook/job interaction is tested where applicable
[ ] No unnecessary queue infrastructure is introduced
[ ] Future queue replacement can occur behind an abstraction
```