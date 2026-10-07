# Jobs Integration Build Implementation

## 1. Purpose

This document defines the concrete implementation approach for the Demo's durable background job system.

Jobs provide asynchronous execution for work that should not block HTTP requests or critical business transactions.

The Demo uses PostgreSQL as the durable job store and `apps/worker` as the execution runtime.

The implementation must prioritize:

- Durability.
- Safe concurrent claiming.
- At-least-once execution.
- Idempotent handlers.
- Bounded retries.
- Recoverability.
- Observability.
- Graceful shutdown.

---

# 2. Ownership

The Jobs integration owns:

- Job records.
- Job lifecycle.
- Job types.
- Job payloads.
- Scheduling.
- Claiming.
- Leases.
- Retry state.
- Failure state.
- Worker coordination.
- Handler registration.
- Job recovery.

It does not own:

- Payment business rules.
- Notification business rules.
- Inventory business rules.
- Webhook business rules.
- Media business rules.

Those domains own their work semantics. Jobs provides the durable execution mechanism.

---

# 3. Runtime Location

Worker runtime:

```text
apps/worker/
```

Job implementation belongs under the approved Jobs integration/module location.

Recommended structure:

```text
modules/jobs/
├── domain/
├── application/
├── infrastructure/
└── index.ts
```

The Worker consumes the public Jobs interfaces rather than reaching directly into arbitrary domain internals.

---

# 4. Architecture

The Demo job architecture is:

```text
Application Service
       ↓
Create Job
       ↓
PostgreSQL
       ↓
apps/worker
       ↓
Claim Job
       ↓
Job Handler
       ↓
Domain/Application Service
       ↓
External Service if required
```

No Redis, Kafka, RabbitMQ, or other distributed broker is required for Demo.

---

# 5. Why PostgreSQL Jobs

PostgreSQL is already the transactional source of truth.

Using PostgreSQL for jobs provides:

- Durable persistence.
- Transactional creation.
- Simple local development.
- One operational dependency.
- Safe row locking.
- Straightforward recovery.

A separate queue should only be introduced when actual scale or operational requirements justify it.

---

# 6. Job Entity

A Job record should contain sufficient information to execute and recover work.

Typical fields:

```text id="x5m8r4"
id
type
payload
status
priority
availableAt
attempts
maxAttempts
lockedAt
lockedBy
leaseExpiresAt
lastError
completedAt
createdAt
updatedAt
```

The exact schema follows the database specification.

---

# 7. Job Status

The lifecycle should be explicit.

Typical states:

```text id="q7r4m6"
PENDING
PROCESSING
COMPLETED
FAILED
CANCELLED
```

A stale `PROCESSING` job must be recoverable.

---

# 8. At-Least-Once Execution

The Worker must assume a job can execute more than once.

For example:

```text id="v6m5r8"
Worker executes handler
      ↓
Business mutation succeeds
      ↓
Worker crashes before marking job complete
      ↓
Job becomes available again
      ↓
Handler runs again
```

Therefore:

> Job handlers must be idempotent.

---

# 9. Job Creation

Applications should create jobs through the Jobs application interface.

For example:

```text id="m4q8r7"
jobs.enqueue({
    type,
    payload,
    availableAt
})
```

The caller must not manually insert arbitrary rows into the job table.

---

# 10. Transactional Job Creation

When a job represents a consequence of a database state change, job creation should occur within the appropriate transaction when required.

Example:

```text id="x8r4m5"
Order state update
+
Notification job
```

must not leave the system believing the Order changed while silently losing the required asynchronous work.

Where reliable atomic event/job publication is required, use the approved database-backed outbox pattern rather than adding a distributed broker.

---

# 11. Job Payload

Payloads must contain only the information required to execute the job.

Prefer:

```text id="q5m7r4"
{
  "notificationId": "..."
}
```

over embedding a complete Notification object.

Benefits include:

- Smaller rows.
- Less stale data.
- Easier retries.
- Clear ownership.

---

# 12. Payload Validation

Every job handler must validate its payload before execution.

A malformed payload must not crash the entire Worker.

Invalid payloads should become a controlled terminal failure when they cannot be repaired automatically.

---

# 13. Job Type Registry

Job handlers should be registered through an explicit registry.

Conceptually:

```text id="v8m4r6"
Job Type
   ↓
Handler
```

Examples:

```text id="m6q4r8"
notification.send
webhook.process
media.cleanup
cart.expire
checkout.expire
```

The exact supported types are defined by actual requirements.

---

# 14. Handler Isolation

A handler should execute one clearly defined unit of work.

It should not become a general-purpose dispatcher containing unrelated business logic.

The handler should normally:

```text id="x7r5m4"
Validate payload
↓
Load relevant record
↓
Invoke owning application service
↓
Handle result
```

---

# 15. Domain Ownership

The Worker must not implement domain rules itself.

Bad:

```text id="q8m4r5"
Worker directly modifies payment status
```

Preferred:

```text id="v5r7m6"
Worker
  ↓
Payments application service
  ↓
Payment state transition
```

This preserves domain boundaries.

---

# 16. Safe Job Claiming

Workers must safely claim jobs under concurrent execution.

The preferred PostgreSQL mechanism is:

```text id="m7q4r8"
SELECT ...
FROM jobs
WHERE status = 'PENDING'
  AND available_at <= now()
ORDER BY priority, available_at
FOR UPDATE SKIP LOCKED
LIMIT ...
```

The selected job is then transitioned to `PROCESSING` within the transaction.

---

# 17. Why SKIP LOCKED

`FOR UPDATE SKIP LOCKED` allows multiple workers to process jobs without waiting on rows already claimed by another worker.

Conceptually:

```text id="x4m8r6"
Worker A → Job 1
Worker B → Job 2
Worker C → Job 3
```

instead of all workers attempting to process the same row.

---

# 18. Lease

A processing job should have a lease or equivalent recovery mechanism.

For example:

```text id="q6r5m8"
lockedAt
lockedBy
leaseExpiresAt
```

If the Worker crashes and the lease expires, another Worker can safely reclaim the job.

---

# 19. Stale Job Recovery

The Worker must periodically identify jobs such as:

```text id="v7m4r6"
status = PROCESSING
leaseExpiresAt < now()
```

and make them eligible for retry.

Recovery must be concurrency-safe.

---

# 20. Worker Identity

Each Worker process should have a unique runtime identity.

This helps with:

```text id="m5q8r4"
Debugging
Lease ownership
Operational diagnostics
```

The identity must not be treated as a permanent security credential.

---

# 21. Polling

The Demo Worker may poll PostgreSQL at a configured interval.

Conceptually:

```text id="x8r4m6"
Poll
 ↓
Claim available jobs
 ↓
Execute
 ↓
Poll again
```

The interval should be configurable.

Avoid busy-looping when no work exists.

---

# 22. Bounded Concurrency

The Worker must limit the number of simultaneously executing jobs.

For example:

```text id="q4m7r5"
Worker
 ├── Job 1
 ├── Job 2
 ├── Job 3
 └── Job 4
```

The exact concurrency limit belongs in configuration.

Do not allow unlimited Promise creation based on database result size.

---

# 23. Job Priority

Priority may be supported if actual requirements justify it.

Critical jobs should not be indefinitely blocked by large volumes of low-priority cleanup work.

Priority must remain simple in Demo.

---

# 24. Scheduled Jobs

Jobs may use:

```text id="v6r8m4"
availableAt
```

to defer execution.

Examples:

```text id="m7q4r5"
Cart expiration
Checkout expiration
Retry after failure
Cleanup
```

The Worker only claims jobs whose `availableAt` has been reached.

---

# 25. Retry Policy

Retryable failures should update:

```text id="x5m8r6"
attempts
availableAt
lastError
```

and return the Job to `PENDING`.

Backoff should be bounded.

---

# 26. Exponential Backoff

A retry delay can follow an exponential pattern:

```text id="q8r4m5"
attempt 1 → short delay
attempt 2 → longer delay
attempt 3 → longer delay
...
```

The exact delay and maximum should be centrally configured.

Do not create indefinite retry loops.

---

# 27. Maximum Attempts

Every job must have a maximum retry count.

Once exceeded:

```text id="v4r7m8"
Job → FAILED
```

The failure remains observable and recoverable where appropriate.

---

# 28. Retryable vs Permanent Errors

Handlers must distinguish:

### Retryable

```text id="m6q5r8"
Temporary network failure
Provider timeout
Temporary database availability issue
Rate limit
```

### Permanent

```text id="x7r4m6"
Malformed payload
Invalid entity identity
Unsupported job type
Irrecoverable business state
```

The shared error classification should determine behavior.

---

# 29. Idempotent Handler Design

Each handler must define what happens if it executes twice.

Examples:

```text id="q5m8r4"
send notification
process webhook
expire cart
expire checkout
cleanup media
```

The implementation must verify current state before applying effects.

---

# 30. Notification Job

A notification job may:

```text id="v8m4r6"
Load Notification
↓
If SENT → return success
↓
If eligible → send
↓
Persist result
```

This prevents duplicate logical sends during ordinary retries.

Provider-level uncertainty must still be handled according to the Notifications design.

---

# 31. Webhook Job

A webhook processing job may:

```text id="m4q7r5"
Load Webhook Event
↓
If already processed → return success
↓
Normalize
↓
Invoke owning domain
↓
Mark processed
```

Business-level idempotency remains required.

---

# 32. Media Cleanup Job

Media cleanup jobs should only delete objects that satisfy the approved cleanup criteria.

For example:

```text id="x6r5m8"
Failed upload
+
Retention period expired
+
No valid association
```

The job must not blindly delete objects based on age alone.

---

# 33. Cart Expiration Job

Cart expiration should use the Cart domain's application service.

The job must not directly delete arbitrary Cart rows.

The Cart domain determines whether the Cart is actually eligible for expiration.

---

# 34. Checkout Expiration Job

Checkout expiration must use the Checkout application workflow.

Where reservations exist, expiration must coordinate safely with Inventory.

The job must not independently manipulate reservation rows.

---

# 35. External Calls

External provider calls must occur outside long database transactions.

For example:

```text id="q7m4r5"
Claim job
↓
Short DB transaction
↓
External API call
↓
Short DB transaction
```

This prevents long-held locks and connection exhaustion.

---

# 36. Job Result Persistence

A successful handler should update the Job to:

```text id="v5r8m4"
COMPLETED
```

and record the completion timestamp.

A failed retryable execution should return it to an eligible pending state.

A terminal failure becomes:

```text id="m8q4r6"
FAILED
```

---

# 37. Graceful Shutdown

The Worker must support graceful shutdown.

On shutdown:

```text id="x4r7m8"
Stop claiming new jobs
↓
Allow active handlers to finish within limits
↓
Release/expire leases as appropriate
↓
Close DB connections
↓
Exit
```

The Worker must not terminate abruptly while pretending active work completed.

---

# 38. Shutdown Timeout

Graceful shutdown should have a bounded timeout.

Jobs that cannot finish within the configured window should become recoverable through lease expiration.

---

# 39. Database Connection Management

Worker database connections must be bounded.

The Worker should not create a new unrestricted database connection for every job.

Use the shared database package and connection pool.

---

# 40. Transaction Scope

A job handler should keep database transactions short.

For example:

```text id="q5m8r4"
Claim transaction
      ↓
Commit
      ↓
Business work
      ↓
Persistence transaction
      ↓
Commit
```

Do not keep the claim transaction open during expensive work.

---

# 41. Job Concurrency and Domain Locks

Job concurrency must respect domain-level concurrency rules.

Examples:

```text id="v7m4r6"
Inventory
Payments
Checkout
Orders
```

may require their own database locking/idempotency mechanisms.

Worker concurrency does not replace those protections.

---

# 42. Observability

Every Job should produce structured telemetry.

Useful fields include:

```text id="m6q8r5"
jobId
jobType
attempt
workerId
status
duration
storeId where applicable
correlationId
errorCode
```

Do not log entire payloads by default.

---

# 43. Metrics

Useful metrics include:

```text id="x8r4m6"
jobs_created_total
jobs_completed_total
jobs_failed_total
jobs_retried_total
jobs_processing_duration
jobs_queue_delay
jobs_stale_recovered_total
```

Exact naming follows shared observability conventions.

---

# 44. Queue Health

Worker health should consider:

```text id="q7m5r4"
Worker process state
Database connectivity
Oldest pending job age
Stale processing jobs
Repeated failures
```

A Worker process being alive does not necessarily mean the job system is healthy.

---

# 45. Health Endpoint

The Worker should expose or integrate with the approved health/readiness mechanism.

Readiness should fail when the Worker cannot perform useful work due to a critical dependency failure.

---

# 46. Security

Job processing must protect against:

```text id="v4r8m6"
Unauthorized job creation
Cross-tenant payloads
Malicious payloads
Secret leakage
Arbitrary handler execution
```

Job types must be registered explicitly.

Never allow a client to submit:

```text id="m5q7r4"
jobType = arbitrary_function_name
```

and have the Worker execute it.

---

# 47. Tenant Context

Jobs that operate on Store-owned data must carry enough trusted context to resolve the Store safely.

Prefer referencing a durable entity:

```text id="x6m4r8"
notificationId
webhookEventId
cartId
checkoutId
```

and derive ownership from the database.

Do not trust arbitrary Store IDs supplied by clients.

---

# 48. Job Cancellation

Cancellation should be supported only where the job semantics allow it.

A job that has already caused an external side effect cannot necessarily be safely cancelled.

For example:

```text id="q8r5m4"
Email already accepted by provider
```

cannot be undone merely by changing the Job status.

---

# 49. Job Dependencies

Jobs should not form unnecessary dependency chains.

If:

```text id="v7m4r6"
Job A
 ↓
Job B
 ↓
Job C
```

becomes necessary, each stage must remain independently recoverable and idempotent.

Prefer a single application workflow where the work is naturally one operation.

---

# 50. Database Constraints

The Jobs table should enforce appropriate constraints for:

```text id="m4q8r5"
Valid status
Valid attempt count
Required type
Required payload
Required timestamps
Lease consistency where applicable
```

Indexes should support:

```text id="x5r8m6"
status
availableAt
leaseExpiresAt
priority where used
```

---

# 51. Testing Strategy

### Unit Tests

Test:

```text id="q6m5r4"
Retry calculation
Failure classification
State transitions
Payload validation
Handler registration
```

### Integration Tests

Test:

```text id="v8r4m6"
Job creation
Job claiming
Concurrent claiming
Lease recovery
Retry persistence
Completion
Failure
```

### Worker Tests

Test:

```text id="m7q5r8"
Startup
Polling
Handler execution
Concurrency limits
Graceful shutdown
Stale recovery
```

---

# 52. Critical Concurrency Test

Run multiple Workers against the same database and verify:

```text id="x4r8m5"
One pending job
+
Multiple Workers
=
One active claim
```

No job should be simultaneously processed by multiple Workers because of an unsafe claim implementation.

Handlers must still remain idempotent as a second layer of protection.

---

# 53. Failure Tests

Explicitly test:

```text id="q7m4r6"
Worker crashes during processing
Database disconnects
Provider times out
Handler throws
Job payload is invalid
Lease expires
Job exceeds retry limit
Shutdown occurs during active work
```

Every scenario must leave the system recoverable or clearly terminal.

---

# 54. Implementation Order

Implement Jobs in this order:

```text id="v6r5m8"
1. Job schema
2. Job status model
3. Job repository
4. Job creation service
5. Claiming with FOR UPDATE SKIP LOCKED
6. Lease handling
7. Handler registry
8. Payload validation
9. Worker polling loop
10. Bounded concurrency
11. Retry/backoff
12. Stale recovery
13. Graceful shutdown
14. Observability
15. Health/readiness
16. Domain-specific handlers
17. Unit tests
18. Integration tests
19. Concurrency tests
20. Failure/recovery tests
```

---

# 55. AI Implementation Rules

AI agents implementing Jobs must:

1. Read the actual root `AGENTS.md`.
2. Read Jobs, Worker, Database, Configuration, Observability, and all relevant domain specifications.
3. Use PostgreSQL as the Demo durable job store.
4. Use `FOR UPDATE SKIP LOCKED` for safe claiming.
5. Make every handler idempotent.
6. Keep external calls outside long transactions.
7. Use bounded concurrency.
8. Implement stale-job recovery.
9. Never execute arbitrary handler names from user input.
10. Preserve tenant isolation.
11. Avoid introducing Redis or another broker without an approved architectural decision.

---

# 56. Definition of Done

Jobs implementation is complete when:

```text id="m8q4r5"
[ ] Job schema exists
[ ] Job lifecycle is implemented
[ ] Job creation works
[ ] Jobs are durably persisted
[ ] Concurrent claiming is safe
[ ] FOR UPDATE SKIP LOCKED is used
[ ] Leases are implemented
[ ] Stale jobs are recoverable
[ ] Handler registry is explicit
[ ] Payloads are validated
[ ] Worker polling works
[ ] Concurrency is bounded
[ ] Retry/backoff works
[ ] Permanent failures terminate safely
[ ] Handlers are idempotent
[ ] Graceful shutdown works
[ ] External calls occur outside long transactions
[ ] Worker health is observable
[ ] Metrics/logging are implemented
[ ] Tenant isolation is preserved
[ ] Concurrency tests pass
[ ] Failure/recovery tests pass
[ ] TypeScript passes
[ ] Lint passes
```

---

# 57. Final Principle

The Demo job system should be **boring, durable, and recoverable**.

Its core model is:

```text id="x5r7m4"
PostgreSQL
    ↓
Durable Job
    ↓
Safe Claim
    ↓
Idempotent Handler
    ↓
Retry or Complete
```

The platform does not need a distributed queue merely to prove that it knows how to install one.

PostgreSQL plus disciplined job semantics are sufficient for the Demo. The important engineering property is not the sophistication of the queue. It is that background work survives crashes, retries safely, respects domain boundaries, and can be understood and recovered when something inevitably goes wrong.