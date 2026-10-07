# Jobs Implementation

## 1. Purpose

This document defines the concrete execution-level implementation of the background job system for the Demo.

The Demo uses PostgreSQL-backed durable jobs processed by:

```text
apps/worker
```

The job system provides reliable asynchronous execution without introducing Redis, Kafka, RabbitMQ, or another distributed queue prematurely.

Jobs are used for work that does not need to execute inside the originating request.

---

# 2. Architecture

The basic flow is:

```text
Application
    ↓
Create Job
    ↓
PostgreSQL
    ↓
apps/worker
    ↓
Claim Job
    ↓
Execute Handler
    ↓
Success / Retry / Failure
```

PostgreSQL remains the source of truth for job state.

---

# 3. Job Ownership

Job infrastructure belongs to:

```text
apps/worker
packages/db
```

The platform job model and scheduling behavior should be shared infrastructure.

Individual domains own their job handlers.

For example:

```text
Notifications → notification delivery handler
Webhooks      → webhook processing handler
Media         → media cleanup handler
Payments      → payment reconciliation handler
Checkout      → checkout expiration handler
```

---

# 4. What a Job Is

A Job represents work that needs to be executed asynchronously.

Examples:

```text
Send notification
Process webhook
Expire checkout
Reconcile payment
Clean orphaned media
```

A Job is not a domain event.

The distinction is:

```text
Event = Something happened
Job   = Something needs to be done
```

---

# 5. Job Model

A Job record may contain:

```text id="m8c4v7"
id
type
status
payload
store_id
attempt_count
max_attempts
available_at
locked_at
locked_by
last_error
created_at
updated_at
completed_at
```

The exact schema follows the database implementation.

---

# 6. Job Status

Use explicit states:

```text id="q5x8m4"
Pending
Processing
Completed
Failed
Cancelled
```

A retryable failure should return the Job to a processable state rather than becoming permanently failed.

---

# 7. Job Lifecycle

Typical lifecycle:

```text id="v7m4c8"
Pending
   ↓
Processing
   ↓
Completed
```

Failure:

```text id="x8n5m4"
Processing
   ↓
Retryable Failure
   ↓
Pending
```

After retry exhaustion:

```text id="m4c8x7"
Processing
   ↓
Failed
```

---

# 8. Job Payload

Payloads should contain only the information required to execute the job.

Example:

```text id="q7n4m8"
{
  notificationId
}
```

or:

```text id="v5c8x4"
{
  webhookEventId
}
```

Prefer IDs over embedding entire database entities.

---

# 9. Job Payload Validation

Every Job handler must validate its payload before execution.

Invalid payloads should fail safely and become observable.

Do not allow arbitrary unvalidated JSON to flow directly into domain operations.

---

# 10. Job Type Registry

Job types should be explicit.

Example:

```text id="x8m4c7"
notification.send
webhook.process
payment.reconcile
checkout.expire
media.cleanup
```

Handlers should be registered centrally.

Conceptually:

```text id="m7c4x8"
Job Type
   ↓
Handler Registry
   ↓
Handler
```

Avoid dynamic code execution based on untrusted job data.

---

# 11. Job Handler Contract

A handler should conceptually implement:

```text id="q5n8c4"
handle(job): Promise<void>
```

The handler should:

- Validate payload.
- Load required resources.
- Execute the required application service.
- Be safe to run more than once.
- Return success only after durable completion.

---

# 12. Idempotent Job Execution

Jobs use at-least-once execution semantics.

Therefore:

```text id="v8m4x7"
A Job may execute more than once.
```

Every critical handler must be idempotent.

Examples:

```text id="x4c8m5"
Notification delivery
Webhook processing
Payment reconciliation
Checkout expiration
Media cleanup
```

---

# 13. Job Creation

Application services create jobs using the shared Job infrastructure.

Example:

```text id="m7n4c8"
Transaction
   ↓
Create Job
   ↓
Commit
```

If the Job represents a required secondary effect, its creation must be coordinated with the business transaction so the trigger cannot silently disappear.

---

# 14. Job Creation and Events

Do not automatically create a Job for every event.

Use a Job when:

```text id="q8x5m4"
Work must happen asynchronously
```

Use an Event when:

```text id="v4m8c7"
Other parts of the system need to know that something happened
```

An event may result in a Job, but the concepts remain separate.

---

# 15. Job Claiming

Workers must claim Jobs safely.

Use PostgreSQL row locking with:

```text id="x7c4m8"
FOR UPDATE SKIP LOCKED
```

Conceptually:

```text id="m5n8x4"
BEGIN
   ↓
Find eligible pending jobs
   ↓
Lock rows
   ↓
Mark Processing
   ↓
COMMIT
```

Multiple workers can therefore process different Jobs concurrently.

---

# 16. Claim Conditions

A Job may be claimed when:

```text id="q4m8c7"
status = Pending
AND
available_at <= now()
```

Stale Processing Jobs may become eligible for recovery according to the configured lease/timeout rules.

---

# 17. Worker Identity

Each worker process should have a worker identifier.

Example:

```text id="v8n4m5"
worker-01
worker-02
```

The identifier may be stored in:

```text id="x5c8m7"
locked_by
```

This helps diagnose stuck or abandoned Jobs.

---

# 18. Processing Lease

A Processing Job should have a timestamp such as:

```text id="m4x8c7"
locked_at
```

If a worker crashes:

```text id="q7n5m4"
Processing
   ↓
Worker disappears
   ↓
Lease expires
   ↓
Job becomes retryable
```

The recovery threshold should be configurable.

---

# 19. Stale Job Recovery

The Worker must periodically identify stale Processing Jobs.

Example:

```text id="v8c4m7"
Processing
AND
locked_at < recovery threshold
```

The job can then be returned to Pending or otherwise marked recoverable.

Recovery must be safe if the original worker is still finishing.

---

# 20. Bounded Concurrency

The Worker must not execute unlimited Jobs simultaneously.

Configure:

```text id="x4m8c7"
WORKER_CONCURRENCY
```

This protects:

- PostgreSQL.
- External providers.
- CPU/memory.
- Application stability.

---

# 21. Graceful Shutdown

When the Worker receives a termination signal:

1. Stop claiming new Jobs.
2. Allow active Jobs to finish where possible.
3. Release/allow recovery of unfinished Jobs.
4. Close database connections.
5. Exit cleanly.

Do not terminate active work blindly when avoidable.

---

# 22. Retry Policy

Jobs should classify errors.

Retryable examples:

```text id="m8c5x4"
Network timeout
Temporary provider outage
Transient database error
Rate limiting
```

Non-retryable examples:

```text id="q4n8m7"
Invalid payload
Invalid domain state
Unsupported job type
Permanent business failure
```

The handler should not retry blindly based on exception type alone.

---

# 23. Retry Backoff

Use bounded exponential or scheduled backoff.

Example:

```text id="v7c4x8"
Attempt 1 → short delay
Attempt 2 → longer delay
Attempt 3 → longer delay
...
```

Configuration should define:

```text id="x5m8c4"
max attempts
base delay
maximum delay
```

---

# 24. Maximum Attempts

Every retryable Job must have a bounded retry count.

Example:

```text id="m4n8c7"
attempt_count >= max_attempts
        ↓
Failed
```

Jobs must not retry forever.

---

# 25. Failure Information

A failed Job should retain:

```text id="q7x4m8"
attempt_count
last_error
failed_at
```

The stored error should be sanitized and should not contain secrets.

---

# 26. Job Cancellation

Some Jobs may become unnecessary.

For example:

```text id="v8m5c4"
Checkout expiration job
```

may become irrelevant after the Checkout has already completed.

The handler should safely recognize this state and mark the Job successful or otherwise terminate it without performing invalid work.

---

# 27. Job Idempotency

Where a logical Job should only exist once, use an idempotency key.

Examples:

```text id="x4c8m7"
checkout:{checkoutId}:expire
payment:{paymentId}:reconcile
notification:{notificationId}:send
webhook:{webhookId}:process
```

The exact key format is implementation-specific.

A unique database constraint should protect uniqueness where appropriate.

---

# 28. Job Scheduling

Jobs may use:

```text id="m8n4c5"
available_at
```

to delay execution.

Examples:

```text id="q5x8m7"
Retry after 30 seconds
Retry after 2 minutes
Expire Checkout at configured time
```

The Worker only claims Jobs whose `available_at` has arrived.

---

# 29. Recurring Work

The Demo does not require a separate distributed scheduler.

Periodic Worker logic can create required maintenance Jobs.

Examples:

```text id="v7m4c8"
Find stale checkouts
Find stale processing jobs
Find unresolved payments
Find stale media
```

The maintenance operation itself must be safe to run repeatedly.

---

# 30. Job Transactions

A Job handler should use the owning domain's application service.

Avoid direct database manipulation from generic Worker code.

Prefer:

```text id="x8c4m7"
Worker
   ↓
Job Handler
   ↓
Domain Application Service
   ↓
Transaction
   ↓
Domain Repository
```

This preserves business rules and module ownership.

---

# 31. External Services

Do not hold a long database transaction while waiting for:

```text id="m5n8c4"
Email provider
Payment provider
Object storage
External API
```

Instead:

```text id="q7c4m8"
Load local state
   ↓
External operation
   ↓
Persist result
```

Use idempotency and reconciliation where the external operation can produce an uncertain outcome.

---

# 32. Job Observability

Every Job execution should produce structured logs containing:

```text id="v4m8x7"
jobId
jobType
storeId
attemptNumber
workerId
duration
status
correlationId
```

Do not log complete payloads if they may contain sensitive data.

---

# 33. Job Metrics

Track useful metrics:

```text id="x8n4c5"
Jobs created
Jobs completed
Jobs failed
Jobs retried
Job execution duration
Queue depth
Stale jobs recovered
Jobs by type
```

These metrics help identify worker or database pressure.

---

# 34. Health Checks

The Worker should expose or integrate with a health mechanism that can determine:

```text id="m7c5x8"
Process is alive
Database connectivity works
Worker loop is running
```

Readiness should not claim full health when required infrastructure is unavailable.

---

# 35. Job Error Isolation

A single failing Job must not terminate the entire Worker process.

For example:

```text id="q4n8m7"
Job A → failure
Job B → continues
Job C → continues
```

Unexpected handler errors must be caught at the worker boundary and recorded.

---

# 36. Unknown Job Types

If the Worker encounters an unknown Job type:

```text id="v8c4m5"
Do not execute arbitrary logic
Do not silently delete the Job
Record failure
Alert/observe the configuration problem
```

This protects against deployment/version mismatches.

---

# 37. Deployment Compatibility

During deployment, old Jobs may remain in PostgreSQL.

Therefore:

- Job payloads should remain backward-compatible during rolling deployments where applicable.
- Removing a Job handler should require deliberate migration.
- Database migrations must account for existing Jobs.
- New handlers should tolerate older valid payloads where necessary.

---

# 38. Worker and API Deployment

The Demo may deploy:

```text id="x5m8c4"
Web Container
Worker Container
PostgreSQL
```

The Worker is independently restartable.

The Worker must not require the Web process to remain alive in order to process already persisted Jobs.

---

# 39. Job Security

Protect against:

```text id="m4n8x7"
Unauthorized Job creation
Cross-tenant payloads
Sensitive payload logging
Arbitrary job-type execution
Forged job identifiers
```

Only trusted server-side application code should create privileged Jobs.

---

# 40. Job Repository

The shared Job infrastructure may expose:

```text id="q8c5m4"
createJob
claimJobs
markCompleted
markFailed
reschedule
recoverStaleJobs
cancelJob
findById
```

The repository owns persistence mechanics, not business rules.

---

# 41. Worker Components

A reasonable Worker structure is:

```text id="v7m4c8"
apps/worker/src/
├── index.ts
├── worker-loop.ts
├── job-registry.ts
├── job-runner.ts
├── job-recovery.ts
└── jobs/
```

Exact structure may follow the implementation conventions established during repository bootstrap.

---

# 42. Job Handler Organization

Domain-specific handlers should remain close to their owning integration/domain logic.

Example:

```text id="x4n8m7"
jobs/
├── checkout/
├── payments/
├── notifications/
├── webhooks/
└── media/
```

Handlers should invoke application services rather than implementing business rules themselves.

---

# 43. Testing Strategy

The job system requires several testing levels.

Unit tests:

```text id="m8c4x7"
[ ] Retry classification
[ ] Backoff calculation
[ ] Handler dispatch
[ ] Payload validation
[ ] Job state transitions
```

Integration tests:

```text id="q5n8m4"
[ ] Job persistence
[ ] Job claiming
[ ] Concurrent workers
[ ] Stale recovery
[ ] Retry scheduling
```

---

# 44. Concurrency Tests

Verify:

```text id="v7c4m8"
[ ] Two workers claim different Jobs
[ ] Two workers cannot claim the same Job
[ ] Stale Job recovery is safe
[ ] Duplicate Job creation is prevented where required
[ ] Handler execution remains idempotent
```

---

# 45. Failure-Recovery Tests

Verify:

```text id="x8m4c7"
[ ] Worker crashes during processing
[ ] Database unavailable
[ ] External provider timeout
[ ] Handler throws unexpected error
[ ] Retry exhaustion
[ ] Unknown Job type
[ ] Invalid payload
```

---

# 46. Implementation Sequence

Implement Jobs in this order:

```text id="m5c8x4"
1. Define Job schema
2. Define Job state machine
3. Create migration
4. Implement Job repository
5. Implement Job creation API
6. Implement claim logic
7. Implement Worker loop
8. Implement Job registry
9. Implement handler execution
10. Implement retry classification
11. Implement backoff
12. Implement stale-job recovery
13. Implement graceful shutdown
14. Implement bounded concurrency
15. Implement job observability
16. Integrate Notifications
17. Integrate Webhooks
18. Integrate Payments
19. Integrate Checkout
20. Integrate Media
21. Add unit tests
22. Add integration tests
23. Add concurrency tests
24. Add failure-recovery tests
25. Verify tenant and security boundaries
```

---

# 47. Definition of Done

Jobs implementation is complete when:

```text id="q8m4v7"
[ ] PostgreSQL Job schema exists
[ ] Job states are enforced
[ ] Jobs can be created
[ ] Jobs can be claimed safely
[ ] FOR UPDATE SKIP LOCKED is used
[ ] Multiple workers can run safely
[ ] Job handlers are registered explicitly
[ ] Payloads are validated
[ ] Jobs are idempotent
[ ] Retry classification works
[ ] Backoff works
[ ] Maximum attempts are enforced
[ ] Stale Jobs can be recovered
[ ] Graceful shutdown works
[ ] Worker concurrency is bounded
[ ] Failed Jobs remain observable
[ ] Unknown Job types fail safely
[ ] External calls are not wrapped in long DB transactions
[ ] Notifications can run asynchronously
[ ] Webhooks can run asynchronously
[ ] Payment reconciliation can run asynchronously
[ ] Checkout expiration can run asynchronously
[ ] Media cleanup can run asynchronously
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Concurrency tests pass
[ ] Failure-recovery tests pass
```