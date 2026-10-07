# Background Jobs Plan

## 1. Purpose

This document defines the implementation strategy for background processing in the Demo.

Background jobs are used for work that should not block a user-facing request or a critical database transaction.

The Demo uses PostgreSQL-backed durable jobs processed by `apps/worker`.

A separate Redis, Kafka, RabbitMQ, or cloud queue is not required for the initial implementation.

---

# 2. Job Architecture

The basic architecture is:

```text id="m8c4x7"
Web Application
      ↓
PostgreSQL Job Record
      ↓
apps/worker
      ↓
Job Handler
      ↓
Domain / External Service
```

PostgreSQL provides durable job state.

---

# 3. Why PostgreSQL Jobs

PostgreSQL is already the Demo's transactional source of truth.

Using PostgreSQL for jobs provides:

- Durable persistence.
- Transactional creation of jobs.
- Simple local development.
- No additional infrastructure.
- Clear operational behavior.
- Straightforward recovery.

The system can later move to a dedicated queue if scale requires it.

---

# 4. Job Responsibilities

Jobs should handle secondary or deferred work such as:

- Notifications.
- Email delivery.
- Media cleanup.
- Media processing.
- Webhook processing.
- Payment reconciliation.
- Expired checkout cleanup.
- Expired cart cleanup.
- Other scheduled maintenance.

Jobs should not replace synchronous operations that are required to establish business correctness.

---

# 5. What Must Remain Synchronous

The following operations must not depend on a background worker to establish their initial critical state:

```text id="q7m3c8"
Inventory reservation
Checkout validation
Payment initiation state
Order creation
Authorization
Tenant resolution
Critical database mutations
```

Background processing may continue secondary work afterward.

---

# 6. Job Record

A job should contain sufficient information for durable execution.

Conceptually:

```text id="x5m8n4"
Job
├── id
├── type
├── status
├── payload
├── attempts
├── maxAttempts
├── availableAt
├── lockedAt
├── lockedBy
├── lastError
├── createdAt
└── updatedAt
```

The exact schema belongs to the database implementation.

---

# 7. Job States

A typical lifecycle is:

```text id="m4c8x7"
PENDING
   ↓
RUNNING
   ↓
SUCCEEDED
```

Failure may result in:

```text id="v7n3m8"
RUNNING
   ↓
RETRY_WAIT
   ↓
RUNNING
```

Permanent failure:

```text id="q8c4m6"
RUNNING
   ↓
FAILED
```

---

# 8. Job Claiming

Workers must safely claim jobs without multiple workers executing the same job concurrently.

PostgreSQL row locking should be used.

The intended pattern is based on:

```text id="x3m7c9"
SELECT ...
FOR UPDATE SKIP LOCKED
```

The claim operation must be short and transactional.

---

# 9. Multiple Workers

The architecture should support multiple worker processes even though the Demo may initially run one.

Conceptually:

```text id="n6m4x8"
             ┌── Worker A
PostgreSQL ──┼── Worker B
             └── Worker C
```

Workers must not assume they are the only consumer.

---

# 10. Job Idempotency

Jobs operate with at-least-once execution semantics.

Therefore:

> A job handler must be safe to execute more than once.

Examples:

```text id="p8c3m7"
Send notification
Process webhook
Cleanup media
Reconcile payment
Release expired reservation
```

A retry must not create incorrect duplicate business state.

---

# 11. Job Identity

Each job has a unique internal identifier.

Where duplicate scheduling is possible, the application should also use a domain-specific idempotency key or uniqueness constraint.

For example:

```text id="m5x8c4"
Notification
    ↓
notificationId
    ↓
Notification Delivery Job
```

This prevents duplicate logical work from becoming duplicate external actions.

---

# 12. Job Payloads

Payloads should contain identifiers and small execution parameters rather than large serialized domain objects.

Prefer:

```text id="v4c7m8"
{
  "orderId": "...",
  "storeId": "..."
}
```

over storing an entire Order object.

The handler should load current required state through the appropriate module interface.

---

# 13. Tenant Context

Jobs must preserve tenant context.

A job should contain enough information to identify the relevant Store or Organization.

Example:

```text id="x8m3c6"
Job
 ├── storeId
 ├── jobType
 └── payload
```

Handlers must verify ownership before performing domain operations.

---

# 14. Job Handler Boundaries

Each job type should map to a dedicated handler.

Conceptually:

```text id="q6m4x8"
Job Type
    ↓
Handler Registry
    ↓
Specific Handler
```

Example:

```text id="m8c4n7"
send_order_confirmation
        ↓
OrderConfirmationHandler
```

The handler should use application services rather than directly manipulating another module's database tables.

---

# 15. Worker Architecture

The Worker application should contain:

```text id="v3c8m5"
Worker Bootstrap
    ↓
Job Poller
    ↓
Job Claimer
    ↓
Handler Registry
    ↓
Job Handler
    ↓
Application Services
```

The worker should share foundational packages with the web application.

---

# 16. Polling

The Demo worker may use database polling.

Conceptually:

```text id="x7m4c8"
Poll
 ↓
Claim available jobs
 ↓
Execute
 ↓
Record result
 ↓
Wait
 ↓
Poll again
```

Polling intervals should be configurable.

The worker should avoid aggressive polling when no work exists.

---

# 17. Bounded Concurrency

The worker must limit the number of concurrently executing jobs.

This prevents:

- Database exhaustion.
- Provider overload.
- CPU exhaustion.
- Memory exhaustion.
- Retry storms.

Concurrency should be configurable.

---

# 18. Job Execution Timeout

Jobs should not be allowed to execute indefinitely.

Where practical, handlers should have bounded execution time.

Long-running operations should use explicit state rather than holding a worker slot indefinitely.

---

# 19. Retry Strategy

Retry behavior should depend on the failure.

### Retryable

```text id="n4c8m7"
Temporary provider failure
Network timeout
Temporary database connectivity issue
Rate limiting
Transient storage failure
```

### Usually non-retryable

```text id="p7m3x8"
Invalid payload
Permanent validation failure
Authorization failure
Unsupported operation
Malformed provider response
```

---

# 20. Retry Backoff

Retries should use bounded exponential backoff with jitter.

Example conceptual progression:

```text id="m6c4x8"
Attempt 1 → short delay
Attempt 2 → longer delay
Attempt 3 → longer delay
...
Final attempt
```

Exact timing should be configurable.

Retries must have a maximum attempt count.

---

# 21. Dead Jobs

A job that exhausts its retry policy becomes permanently failed.

Failed jobs should retain enough information for diagnosis:

- Job ID.
- Job type.
- Error category.
- Last error.
- Attempt count.
- Relevant resource ID.
- Timestamps.

---

# 22. Failed Job Recovery

The system should support controlled recovery.

Possible operations:

```text id="v8m4c3"
Retry failed job
Requeue job
Mark permanently resolved
Inspect failure
```

Recovery must not bypass business invariants.

---

# 23. Stale Jobs

A worker may crash after claiming a job.

The system must detect stale running jobs.

Conceptually:

```text id="x5c8m7"
RUNNING
   ↓
Worker crashes
   ↓
Lease becomes stale
   ↓
Recovery process
   ↓
PENDING / RETRY_WAIT
```

A stale-job threshold should be configurable.

---

# 24. Graceful Shutdown

When a worker receives a shutdown signal:

1. Stop claiming new jobs.
2. Allow active short-running jobs to finish where possible.
3. Release or recover claim state safely.
4. Close database connections.
5. Exit cleanly.

The worker must not silently abandon jobs.

---

# 25. Job Transactions

A job handler should use explicit transaction boundaries.

Example:

```text id="m7c4x8"
Claim Job
   ↓
Commit Claim
   ↓
Execute Handler
   ↓
Persist Result
```

Long external operations should not keep the claim transaction open.

---

# 26. External Calls

External calls may occur inside job execution when required.

For example:

```text id="q8m3c6"
Notification Job
    ↓
Email Provider
```

The handler must then persist the outcome and determine whether the job should succeed or retry.

---

# 27. Job and Domain Events

Domain events may create jobs for secondary work.

Example:

```text id="v4m8x7"
OrderCreated
    ↓
Create Notification Job
    ↓
Worker
    ↓
Send Email
```

The event represents the fact.

The job represents the work.

---

# 28. Job Creation Atomicity

When a job is required as a consequence of a critical database mutation, job creation should be coordinated carefully with that transaction.

Avoid:

```text id="n6c4m8"
Commit Order
   ↓
Create Job
   ↓
Application crashes
```

which can leave the order without required asynchronous work.

Where reliable event delivery is required, use a PostgreSQL-backed transactional event/outbox mechanism consistent with the architecture.

---

# 29. Outbox Consideration

The Demo does not require a full distributed messaging platform.

A PostgreSQL outbox-style mechanism may be introduced when an event must be durably recorded with the transaction that created it.

Conceptually:

```text id="x7m3c9"
Business Transaction
      ↓
Domain State + Outbox Record
      ↓
Commit
      ↓
Worker
      ↓
Process Event
```

This should be introduced only for workflows that actually require durable event delivery.

---

# 30. Notification Jobs

Typical notification workflow:

```text id="m8c4x6"
Order Created
    ↓
Notification Record
    ↓
Email Job
    ↓
Worker
    ↓
Email Provider
```

The notification record should provide durable business-level identity.

---

# 31. Webhook Jobs

Webhook processing may follow:

```text id="q5m8c3"
Webhook Received
    ↓
Persist Event
    ↓
Webhook Job
    ↓
Verify / Normalize / Process
```

The raw webhook should remain available for diagnosis where appropriate.

---

# 32. Payment Jobs

Potential payment-related jobs include:

- Payment reconciliation.
- Provider status synchronization.
- Refund status synchronization.
- Failed-provider-operation recovery.

Payment jobs must preserve payment idempotency.

---

# 33. Inventory Jobs

Potential inventory jobs include:

- Expired reservation release.
- Inventory reconciliation.
- Cleanup of stale records.

Critical inventory changes must still use Inventory application services.

A job must never directly modify stock quantities outside the Inventory module.

---

# 34. Checkout Jobs

Potential checkout jobs include:

- Expired checkout cleanup.
- Expired reservation release.
- Abandoned checkout maintenance.

A job must respect the Checkout state machine.

---

# 35. Media Jobs

Potential media jobs include:

- Failed-upload cleanup.
- Orphan detection.
- Object deletion.
- Thumbnail generation.
- Metadata processing.

These operations must be safe to retry.

---

# 36. Scheduled Jobs

Some maintenance work is time-based.

Examples:

```text id="v6c4m8"
Expired carts
Expired checkouts
Stale reservations
Stale jobs
Media cleanup
```

The Demo may implement scheduled execution using the worker rather than introducing a separate scheduler service.

---

# 37. Scheduling Strategy

A simple approach is:

```text id="x8m3c7"
Worker
  ↓
Periodic scheduler loop
  ↓
Create due jobs
  ↓
Normal job processing
```

Scheduled operations must have uniqueness or idempotency protection to prevent duplicate job creation.

---

# 38. Job Observability

Each job execution should record:

- Job ID.
- Job type.
- Store ID where applicable.
- Attempt number.
- Worker ID.
- Start time.
- End time.
- Duration.
- Result.
- Error category.
- Correlation ID.

Sensitive payloads must not be logged indiscriminately.

---

# 39. Worker Metrics

Monitor:

```text id="m4c8x7"
Pending jobs
Running jobs
Successful jobs
Failed jobs
Retry count
Execution latency
Queue age
Stale jobs
```

Queue age is particularly useful for detecting a worker that is falling behind.

---

# 40. Worker Health

The Worker should expose or report:

- Process health.
- Database connectivity.
- Last successful polling time.
- Active job count.
- Failed-job rate.

A worker that is alive but unable to process jobs should be distinguishable from a healthy worker.

---

# 41. Security

Job execution must enforce:

- Trusted job creation.
- Tenant context.
- Authorization through application services.
- Payload validation.
- No client-controlled arbitrary job types.
- No arbitrary handler invocation.
- Secret protection.
- Safe logging.

The worker is a privileged backend process and must not blindly trust job payloads.

---

# 42. Job Payload Validation

Every handler should validate its payload before execution.

Invalid payloads should normally fail permanently rather than retry indefinitely.

Example:

```text id="v7m3c8"
Missing orderId
    ↓
Validation failure
    ↓
FAILED
```

not:

```text id="x4m8c7"
Retry forever
```

---

# 43. Job Type Registry

Job types should be explicitly registered.

Conceptually:

```text id="n8c4m6"
{
  "send_order_email": OrderEmailHandler,
  "cleanup_media": MediaCleanupHandler,
  "process_webhook": WebhookHandler
}
```

Unknown job types must fail safely.

---

# 44. Dependency Direction

The worker should depend on application services and public module interfaces.

Preferred:

```text id="m5c8x7"
Worker
   ↓
Application Service
   ↓
Domain
   ↓
Infrastructure
```

Avoid:

```text id="q7m4c8"
Worker
   ↓
Direct SQL into business module tables
```

---

# 45. Testing

### Unit tests

Test:

- Retry classification.
- Backoff.
- Handler logic.
- Payload validation.
- Job state transitions.

### Integration tests

Test:

- Job creation.
- Claiming.
- Concurrent workers.
- Retry persistence.
- Stale recovery.
- Transaction behavior.

### End-to-end tests

Test complete flows such as:

```text id="v8m3c6"
Order Created
    ↓
Notification Job
    ↓
Worker
    ↓
Notification Delivered
```

---

# 46. Concurrency Testing

At minimum, test:

```text id="x4m7c8"
Two workers claiming the same job
Two workers processing different jobs
Stale worker recovery
Duplicate scheduling
Concurrent retry
```

Only one worker should successfully claim a given job execution lease.

---

# 47. Failure Testing

Test:

- Worker crash.
- Database connection loss.
- Provider timeout.
- Provider 5xx.
- Invalid payload.
- Handler exception.
- Process restart.
- Job claim becoming stale.

The objective is recovery without duplicate business effects.

---

# 48. Demo Scope

The Demo requires:

```text id="m8c4x7"
[ ] PostgreSQL job table
[ ] Worker process
[ ] Job claiming
[ ] Handler registry
[ ] Retry policy
[ ] Backoff
[ ] Idempotent handlers
[ ] Stale-job recovery
[ ] Graceful shutdown
[ ] Basic scheduling
[ ] Job observability
```

A dedicated queue broker is not required.

---

# 49. Future V1 Evolution

If workload increases, the job abstraction should allow migration toward:

```text id="q6m3c8"
PostgreSQL Jobs
      ↓
Dedicated Queue
      ↓
Multiple Workers
      ↓
Autoscaling
```

The domain modules should not need to know which transport is used.

Only the job infrastructure should change.

---

# 50. Definition of Done

Background processing is complete when:

```text id="x7m4c9"
[ ] Jobs are durably persisted
[ ] Jobs can be safely claimed
[ ] Multiple workers are supported
[ ] Handlers are explicitly registered
[ ] Payloads are validated
[ ] Retries are bounded
[ ] Backoff is implemented
[ ] Failed jobs are inspectable
[ ] Stale jobs are recoverable
[ ] Graceful shutdown works
[ ] Tenant context is preserved
[ ] Critical handlers are idempotent
[ ] External failures are handled
[ ] Worker health is observable
[ ] Integration tests pass
[ ] Critical concurrency tests pass
```

---

# 51. Final Principle

Background processing exists to move **non-critical work out of critical request paths**, not to hide business logic behind a queue.

The core model is:

```text id="n5c8m4"
Critical Business Operation
        ↓
PostgreSQL Transaction
        ↓
Durable State / Event
        ↓
Background Job
        ↓
Worker
        ↓
Secondary Effect
```

The Demo keeps this architecture deliberately simple with PostgreSQL-backed jobs while preserving the interfaces and operational behavior needed to evolve toward a dedicated queue when scale actually demands it.