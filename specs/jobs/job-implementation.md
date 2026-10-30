# Background Job Implementation Specification

## 1. Purpose

This document defines the implementation requirements for the **Background Jobs** capability of the Cal Cart commerce platform.

Background jobs provide durable asynchronous execution for work that does not need to complete inside the originating HTTP request or business transaction.

The Demo uses PostgreSQL-backed jobs processed by `apps/worker`. A dedicated queue infrastructure such as Redis, RabbitMQ, or Kafka is not required at this stage.

---

## 2. Scope

The Jobs capability owns:

- Job creation.
- Job persistence.
- Job lifecycle.
- Job claiming.
- Worker execution.
- Retry handling.
- Backoff.
- Failure handling.
- Stale-job recovery.
- Job idempotency.
- Scheduling.
- Graceful worker shutdown.
- Job observability.

It does not own:

- Business-domain rules.
- Payment state.
- Inventory state.
- Order state.
- Notification content.
- Webhook business interpretation.

Jobs execute work owned by the relevant domain or application service.

---

## 3. Worker Location

Background job execution belongs to:

```text
apps/worker/
```

The shared job infrastructure belongs in the appropriate shared package:

```text
packages/
```

Domain-specific job handlers remain owned by their respective modules.

---

## 4. Architecture

The Demo architecture is:

```text
Application / Domain Event
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

PostgreSQL is the durable source of truth for job state.

---

## 5. Why Jobs Exist

Background jobs should be used when work:

- Is not required to complete before the HTTP response.
- May take significant time.
- Depends on external systems.
- Requires retry behavior.
- Can be safely executed asynchronously.
- Should survive application restarts.

Examples:

- Sending notifications.
- Processing webhook events.
- Cleaning expired sessions.
- Expiring inventory reservations.
- Cleaning abandoned uploads.
- Payment reconciliation.
- Deferred media cleanup.

---

## 6. Synchronous vs Asynchronous Work

A business operation should remain synchronous when its result is required for correctness.

Examples:

```text
Checkout
Inventory reservation
Order creation
Payment state transition
```

Secondary effects may be asynchronous:

```text
Email
Notification
Cleanup
Reconciliation
Non-critical processing
```

Do not move transaction-critical logic into a background job merely to make the API appear faster.

---

## 7. Job Entity

Conceptually:

```text
Job
├── id
├── type
├── status
├── payload
├── storeId?
├── organizationId?
├── priority?
├── availableAt
├── attempts
├── maxAttempts
├── lockedAt?
├── lockedBy?
├── lastError?
├── completedAt?
├── failedAt?
├── createdAt
└── updatedAt
```

The exact schema should reflect actual Demo requirements.

---

## 8. Job Status

A practical lifecycle:

```text
PENDING
PROCESSING
COMPLETED
FAILED
CANCELLED
```

A retryable failed job may return to:

```text
PENDING
```

with a future `availableAt`.

---

## 9. Job Type

Job types must be explicit and controlled.

Examples:

```text
SEND_NOTIFICATION
PROCESS_WEBHOOK
EXPIRE_CART
EXPIRE_RESERVATION
CLEANUP_MEDIA
RECONCILE_PAYMENT
```

Avoid accepting arbitrary executable names from client input.

---

## 10. Job Payload

Job payloads should contain only the information necessary to perform the operation.

Prefer stable identifiers:

```text
{
  "orderId": "...",
  "storeId": "..."
}
```

over copying entire domain objects.

The worker should load current authoritative state from PostgreSQL.

---

## 11. Payload Validation

Every job handler must validate its payload before execution.

Invalid payloads should fail safely and should not cause infinite retries.

---

## 12. Tenant Context

Store-scoped jobs must retain sufficient tenant context.

For example:

```text
Job
 ├── storeId
 └── payload
```

The worker must verify that referenced resources belong to the expected Store.

A worker must never assume that a Store ID in a payload is automatically trustworthy.

---

## 13. Job Creation

Jobs should be created through an application-level job service.

Conceptually:

```text
Application Service
      ↓
Job Service
      ↓
PostgreSQL
```

Direct SQL inserts into the jobs table from arbitrary application code should be avoided.

---

## 14. Transactional Job Creation

When a job is required because of a business transaction, job creation should occur within the same database transaction where appropriate.

Example:

```text
Order Transaction
    ↓
Create Order
    ↓
Create Notification Job
    ↓
Commit
```

This prevents the system from committing the Order while silently losing required asynchronous work.

---

## 15. External Calls

External provider calls must not occur while holding a long database transaction.

Correct pattern:

```text
Database Transaction
      ↓
Commit
      ↓
Worker
      ↓
External Provider
```

---

## 16. Job Claiming

Multiple workers may run concurrently.

Job claiming must prevent two workers from processing the same job simultaneously.

The Demo should use PostgreSQL row locking.

A typical mechanism is:

```text
SELECT ...
FOR UPDATE SKIP LOCKED
```

followed by marking the selected job as `PROCESSING`.

---

## 17. Claiming Requirements

Claiming should:

- Select only eligible jobs.
- Respect `availableAt`.
- Respect status.
- Lock rows safely.
- Assign worker identity where useful.
- Set `lockedAt`.
- Increment attempt count according to the defined policy.

The claim operation should be atomic.

---

## 18. Worker Identity

Each worker process may have a unique worker identifier.

Example:

```text
worker-host-01:process-123
```

The identifier is useful for:

- Debugging.
- Stale-job recovery.
- Operational logs.

It must not be treated as an authentication credential.

---

## 19. Processing Flow

Typical processing:

```text
PENDING
   ↓
Claim
   ↓
PROCESSING
   ↓
Load required data
   ↓
Execute handler
   ↓
COMPLETED
```

Failure:

```text
PROCESSING
   ↓
Retryable failure
   ↓
PENDING
   ↓
Future availableAt
```

Permanent failure:

```text
PROCESSING
   ↓
FAILED
```

---

## 20. Attempt Counting

Each processing attempt should be tracked.

Example:

```text
attempts = 1
attempts = 2
attempts = 3
```

The job should stop retrying after `maxAttempts`.

---

## 21. Retry Classification

Errors must be classified as:

### Retryable

Examples:

- Temporary database failure.
- Network timeout.
- Temporary provider outage.
- Rate limiting.
- Temporary dependency failure.

### Non-retryable

Examples:

- Invalid payload.
- Unsupported job type.
- Permanent validation failure.
- Irrecoverable business rule violation.

The classification must be explicit.

---

## 22. Backoff

Retryable jobs should use bounded exponential backoff.

Conceptually:

```text
Attempt 1 → short delay
Attempt 2 → longer delay
Attempt 3 → longer delay
...
```

The maximum delay must be bounded.

Configuration should control:

- Initial delay.
- Maximum delay.
- Maximum attempts.

---

## 23. Jitter

Where many jobs may fail simultaneously, a small randomized delay may be added to prevent synchronized retries.

Jitter must remain bounded and must not make retry behavior impossible to reason about.

---

## 24. Idempotency

Every important job handler must be safe to retry.

Examples:

```text
SEND_NOTIFICATION
PROCESS_WEBHOOK
RECONCILE_PAYMENT
EXPIRE_RESERVATION
```

A worker crash may happen after an external operation succeeds but before the job is marked `COMPLETED`.

Therefore:

```text
Job retry ≠ guaranteed single execution
```

Handlers must be designed accordingly.

---

## 25. Job Idempotency Strategies

Possible strategies include:

- Domain-level unique constraints.
- Idempotency keys.
- Existing state checks.
- Durable operation records.
- Provider-level idempotency.
- State-machine validation.

The correct strategy depends on the job.

---

## 26. No Generic "Exactly Once"

The system must not claim that jobs execute exactly once.

The practical guarantee is:

```text
At-least-once execution
+
Idempotent handlers
```

This is the safer and more realistic model.

---

## 27. State-Based Idempotency

A handler should inspect current state before applying an operation.

Example:

```text
Payment already CAPTURED
      ↓
Do not capture again
```

Similarly:

```text
Reservation already RELEASED
      ↓
Do not release again
```

---

## 28. Stale Jobs

A worker may crash while a job is:

```text
PROCESSING
```

The job must not remain permanently locked.

The system should use:

```text
lockedAt
```

and a configured timeout to identify stale jobs.

---

## 29. Stale Job Recovery

A recovery process may:

```text
PROCESSING
+ lockedAt older than threshold
        ↓
Reset to PENDING
        ↓
Schedule retry
```

Recovery must be safe against a still-running worker.

The threshold should be longer than the expected normal processing duration.

---

## 30. Graceful Shutdown

The Worker must support graceful shutdown.

When receiving a termination signal:

1. Stop claiming new jobs.
2. Allow active jobs to finish within a bounded period.
3. Release or safely leave recoverable processing state.
4. Close database connections.
5. Exit.

---

## 31. Worker Concurrency

Worker concurrency must be bounded.

Example configuration:

```text
WORKER_CONCURRENCY=5
```

The exact value should depend on:

- Database capacity.
- External provider limits.
- Job duration.
- VPS resources.

Unlimited concurrency is not a performance strategy.

---

## 32. Job Priority

Priority may be supported if required.

For the Demo, simple FIFO behavior among eligible jobs is sufficient unless a real business requirement needs priority.

If priority is implemented, it must not starve low-priority work indefinitely.

---

## 33. Scheduled Jobs

Jobs may use:

```text
availableAt
```

to schedule future execution.

Example:

```text
availableAt = future timestamp
```

The worker processes the job once that time is reached.

A dedicated scheduler service is not required for the Demo.

---

## 34. Recurring Work

Recurring operational work may use a lightweight scheduler or periodic worker process.

Examples:

- Expire reservations.
- Clean expired sessions.
- Recover stale jobs.
- Cleanup failed media.

Recurring tasks should enqueue normal jobs rather than embedding complex business logic directly into a scheduler.

---

## 35. Job Cancellation

Jobs may be cancelled when they are no longer relevant.

Examples:

- A scheduled operation becomes unnecessary.
- A Store is deleted.
- A related business object reaches a terminal state.

Cancellation must be state-safe and must not interrupt an already committed business transaction.

---

## 36. Job Dependencies

Jobs should avoid complex dependency graphs in the Demo.

If ordering is required, prefer:

```text
Job A completes
      ↓
Create Job B
```

rather than implementing a generic workflow engine.

---

## 37. Job Payload Versioning

Long-lived jobs may outlive the code version that created them.

For important jobs, the payload may include a version:

```text
{
  "version": 1,
  "orderId": "..."
}
```

Handlers should remain compatible with currently pending jobs during deployments.

---

## 38. Deployment Compatibility

A deployment must not immediately invalidate existing pending jobs.

Code changes affecting job payloads should follow backward-compatible migration practices.

If a job format must change:

```text
Old Handler
   +
New Handler
```

may temporarily be required during deployment.

---

## 39. Database Constraints

The database should enforce valid job states and relationships where practical.

Potential fields and constraints include:

```text
status
attempts >= 0
max_attempts > 0
```

Foreign keys should be used for strongly owned references where appropriate.

---

## 40. Indexing

Important indexes may include:

```text
jobs(status, available_at)
jobs(status, locked_at)
jobs(type, status)
jobs(store_id, created_at)
```

The exact index set should follow actual worker queries.

---

## 41. Job Retention

Completed and failed jobs should not grow indefinitely.

A cleanup policy should define how long historical jobs are retained.

Retention must balance:

- Debugging.
- Auditability.
- Storage growth.
- Privacy.

---

## 42. Failed Job Retention

Failed jobs should generally remain available longer than successfully completed jobs when operational debugging requires them.

The retention period should be configurable.

---

## 43. Job Error Storage

A failed job may store safe error metadata such as:

```text
errorCode
errorMessage
failedAt
attempts
```

Do not store:

- Passwords.
- API keys.
- Authentication tokens.
- Provider secrets.
- Sensitive request headers.

---

## 44. Logging

Worker logs should be structured.

Useful fields:

```text
jobId
jobType
storeId
workerId
attempt
status
duration
requestId
```

Logs should allow an operator to trace a job without exposing sensitive payloads.

---

## 45. Metrics

Useful metrics include:

- Queue depth.
- Job processing rate.
- Job success count.
- Job failure count.
- Retry count.
- Processing latency.
- Stale-job count.
- Jobs by type.
- Jobs exceeding processing thresholds.

---

## 46. Health Checks

The Worker should expose or report operational health.

Health should consider:

- Database connectivity.
- Worker process state.
- Ability to claim jobs.

Readiness should fail when the worker cannot safely process work.

---

## 47. Domain Job Handlers

Domain-specific handlers should remain close to the domain they operate on.

For example:

```text
modules/
├── payments/
│   └── application/jobs/
├── notifications/
│   └── application/jobs/
└── inventory/
    └── application/jobs/
```

The shared job runner invokes the handler through a controlled registration mechanism.

---

## 48. Handler Registry

Job handlers should be explicitly registered.

Conceptually:

```text
Job Type
   ↓
Handler Registry
   ↓
Specific Handler
```

Do not dynamically execute arbitrary functions based on database values.

---

## 49. Handler Contract

A handler should have a predictable contract such as:

```text
handle(payload, context)
```

where context may contain:

- Job ID.
- Worker ID.
- Store context.
- Attempt number.
- Logging context.

---

## 50. Authorization in Jobs

Jobs execute server-side, but they must still respect domain ownership and tenant boundaries.

A job processing:

```text
storeId = Store A
```

must not accidentally load or modify:

```text
Store B
```

data.

Worker execution is trusted infrastructure, not a bypass around authorization and data ownership rules.

---

## 51. Notification Jobs

Notification delivery is a major job consumer.

Example:

```text
OrderCreated
   ↓
Create SEND_NOTIFICATION job
   ↓
Worker
   ↓
Notification Service
   ↓
Email Provider
```

Notification-specific behavior belongs to the Notifications module.

---

## 52. Webhook Jobs

Webhook processing may use:

```text
PROCESS_WEBHOOK
```

The handler should:

- Load the durable webhook event.
- Validate processing state.
- Apply domain consequences.
- Mark the webhook processed or retryable.

The job must be idempotent.

---

## 53. Inventory Jobs

Inventory may require jobs for:

- Reservation expiration.
- Cleanup.
- Reconciliation where required.

Inventory correctness must not depend solely on a scheduled cleanup job.

Expired reservations must also be handled safely during relevant synchronous operations where required.

---

## 54. Payment Jobs

Payment jobs may include:

- Reconciliation.
- Status checks.
- Refund recovery.

A payment job must never blindly assume that a timeout means payment failure.

External provider state must be checked where necessary.

---

## 55. Media Jobs

Media jobs may include:

- Cleanup of abandoned uploads.
- Deferred object deletion.
- Integrity checks.

Media jobs must not delete objects that are still referenced by valid domain records.

---

## 56. Job Security

The job system must protect against:

- Malicious payload injection.
- Arbitrary handler execution.
- Cross-tenant processing.
- Secret leakage.
- Unauthorized job creation.
- Unsafe retry loops.

Client-facing APIs must never allow arbitrary job types or arbitrary handler names.

---

## 57. Testing Strategy

### Unit Tests

Test:

- Job state transitions.
- Retry classification.
- Backoff calculation.
- Payload validation.
- Handler registration.
- Idempotency behavior.

### Integration Tests

Test:

- Job creation.
- Job claiming.
- Concurrent workers.
- Database locking.
- Retry scheduling.
- Stale-job recovery.
- Job completion.

### Concurrency Tests

Test:

```text
Two Workers
     ↓
Same Job
     ↓
Only one claims it
```

Also test simultaneous stale-job recovery and worker processing.

### E2E Tests

Test:

```text
Business Event
   ↓
Job Created
   ↓
Worker Claims Job
   ↓
Handler Executes
   ↓
Business Effect Occurs
   ↓
Job Completed
```

---

## 58. Critical Job Tests

```text
[ ] Two workers cannot claim the same job concurrently
[ ] Retryable failures return to PENDING
[ ] Non-retryable failures become FAILED
[ ] maxAttempts is enforced
[ ] Backoff is applied
[ ] Stale PROCESSING jobs recover
[ ] Worker shutdown is graceful
[ ] Job handlers are idempotent
[ ] Invalid payloads do not retry forever
[ ] Unknown job types fail safely
[ ] Cross-tenant job execution is prevented
[ ] Completed jobs are not reprocessed
[ ] Scheduled jobs are not executed early
[ ] Pending jobs survive application restart
```

---

## 59. Implementation Sequence

```text
1. Define Job entity
2. Define Job lifecycle
3. Define Job type registry
4. Define handler contract
5. Create database schema
6. Create migrations
7. Implement Job repository
8. Implement Job creation service
9. Implement atomic job claiming
10. Implement worker loop
11. Implement handler registry
12. Implement job execution
13. Implement retry classification
14. Implement backoff
15. Implement stale-job recovery
16. Implement graceful shutdown
17. Implement concurrency controls
18. Implement scheduled execution
19. Implement cleanup policies
20. Implement logging
21. Implement metrics
22. Implement worker health checks
23. Integrate notification jobs
24. Integrate webhook jobs
25. Integrate required domain jobs
26. Add unit tests
27. Add integration tests
28. Add concurrency tests
29. Add E2E tests
```

---

## 60. Demo Simplifications

The Demo does not require:

- Redis.
- RabbitMQ.
- Kafka.
- BullMQ.
- Temporal.
- Kubernetes workers.
- Distributed workflow orchestration.
- Complex DAG execution.
- Multi-region workers.
- Autoscaling worker clusters.
- Enterprise queue management UI.

PostgreSQL-backed durable jobs with one Worker application are sufficient for the expected Demo workload.

---

## 61. V1 Evolution

The Job capability can later evolve toward:

- Redis-backed queues.
- Dedicated queue infrastructure.
- Multiple worker pools.
- Priority queues.
- Scheduled job infrastructure.
- Dead-letter queues.
- Advanced retry policies.
- Distributed tracing.
- Horizontal worker scaling.
- Queue autoscaling.
- Workflow orchestration where justified.

The application-level job interface should remain stable enough that the underlying queue implementation can change without rewriting domain modules.

---

## 62. Definition of Done

The Background Jobs implementation is complete when:

```text
[ ] Job entity exists
[ ] Job lifecycle exists
[ ] Job type registry exists
[ ] Handler contract exists
[ ] PostgreSQL persistence works
[ ] Jobs survive application restart
[ ] Atomic job claiming works
[ ] Concurrent workers are safe
[ ] Worker process exists
[ ] Worker concurrency is bounded
[ ] Retry classification exists
[ ] Exponential backoff exists
[ ] Maximum attempts are enforced
[ ] Stale-job recovery exists
[ ] Graceful shutdown exists
[ ] Scheduled jobs work where required
[ ] Job payloads are validated
[ ] Job handlers are idempotent
[ ] Tenant context is enforced
[ ] Arbitrary handler execution is prevented
[ ] Job retention exists
[ ] Structured logging exists
[ ] Metrics exist
[ ] Worker health checks exist
[ ] Notification integration works
[ ] Webhook integration works
[ ] Required domain jobs work
[ ] Unit tests exist
[ ] Integration tests exist
[ ] Concurrency tests exist
[ ] E2E job workflows exist
[ ] Documentation matches implementation
```