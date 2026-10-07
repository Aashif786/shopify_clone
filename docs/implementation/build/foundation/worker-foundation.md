# Worker Foundation

## 1. Purpose

This document defines the implementation requirements for `apps/worker`.

The worker is the background-processing runtime for the Demo. It executes durable asynchronous jobs that should not block web requests.

The worker must remain deliberately simple while providing reliable:

- Job claiming.
- Retry handling.
- Idempotent execution.
- Failure handling.
- Stale-job recovery.
- Graceful shutdown.
- Bounded concurrency.
- Structured logging.
- Operational visibility.

The Demo uses **PostgreSQL-backed durable jobs**. Redis, Kafka, RabbitMQ, and other distributed queue infrastructure are not required.

---

# 2. Worker Responsibilities

`apps/worker` is responsible for:

- Starting the worker runtime.
- Loading validated configuration.
- Connecting to PostgreSQL.
- Claiming available jobs.
- Executing registered job handlers.
- Handling retries.
- Recovering stale jobs.
- Recording job outcomes.
- Respecting job scheduling.
- Preventing uncontrolled concurrency.
- Logging execution context.
- Gracefully shutting down.

The worker must not become a second application layer containing duplicated business logic.

---

# 3. Worker Boundary

The worker follows:

```text id="7wq4pk"
PostgreSQL Job Record
        ↓
Job Claiming
        ↓
Job Dispatcher
        ↓
Registered Handler
        ↓
Application Service
        ↓
Domain Module / Integration
```

The worker coordinates execution.

The owning module remains responsible for the business operation.

---

# 4. Approved Worker Structure

Conceptually:

```text id="h2m8vn"
apps/worker/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── runtime/
    ├── jobs/
    └── ...
```

The exact internal structure may evolve, but worker infrastructure and domain-specific handlers should remain distinguishable.

---

# 5. Worker Startup

Startup should follow:

```text id="m7x4rq"
Process starts
  ↓
Load configuration
  ↓
Validate configuration
  ↓
Initialize logging
  ↓
Initialize database
  ↓
Register job handlers
  ↓
Verify worker dependencies
  ↓
Begin processing
```

A worker with invalid required configuration must fail clearly rather than running partially configured.

---

# 6. Worker Shutdown

The worker must support graceful shutdown.

When receiving a shutdown signal:

```text id="k8v5ps"
Stop claiming new jobs
        ↓
Allow active jobs to finish within a bounded period
        ↓
Release/recover unfinished ownership as appropriate
        ↓
Close database resources
        ↓
Exit
```

The worker must not intentionally abandon jobs without a recovery mechanism.

---

# 7. Durable Job Storage

Jobs are persisted in PostgreSQL.

The job system must support concepts such as:

```text id="p4q9wc"
id
type
payload
status
attempt count
available time
claimed time
lease/lock information
last error
created time
updated time
```

The exact schema follows the database and jobs implementation specifications.

---

# 8. Job States

The implementation should support explicit states such as:

```text id="r5m7tx"
pending
processing
completed
failed
```

Additional states may be used when required by the approved job specification.

State transitions must be explicit and validated.

---

# 9. Job Claiming

Multiple worker processes must be able to operate safely without claiming the same job simultaneously.

The Demo should use PostgreSQL row locking, including:

```text id="c7p2kn"
SELECT ...
FOR UPDATE SKIP LOCKED
```

where appropriate.

The claim operation must be short and transactional.

---

# 10. Claim Transaction

A job claim transaction should:

```text id="v8r4mh"
Select eligible job
  ↓
Lock row
  ↓
Verify eligibility
  ↓
Mark job as processing
  ↓
Record claim/lease metadata
  ↓
Commit
```

Do not keep the database transaction open while executing the actual job.

---

# 11. Job Eligibility

A job may be eligible when:

```text id="n6t8ys"
status = pending
AND availableAt <= current time
```

A stale processing job may become eligible for recovery according to the configured lease/timeout rules.

---

# 12. Worker Concurrency

Worker concurrency must be explicitly bounded.

Do not create:

```text id="j4x6qd"
unlimited promises
unbounded worker loops
one process per job
```

A configured concurrency limit should control the number of simultaneous jobs.

---

# 13. Job Handler Registry

Job types should map to explicit handlers.

Conceptually:

```text id="y8p3kc"
Job Type
   ↓
Handler Registry
   ↓
Handler
```

Example:

```text id="d5q7mv"
send_notification → notification handler
process_webhook   → webhook handler
cleanup_media     → media handler
```

The registry should reject unknown job types.

---

# 14. Handler Responsibility

A job handler should:

1. Validate the job payload.
2. Load required state.
3. Execute the required application operation.
4. Respect authorization/context requirements where applicable.
5. Maintain idempotency.
6. Return a clear success/failure outcome.

Handlers should not silently swallow failures.

---

# 15. Business Logic Ownership

Do not implement major business rules inside job handlers.

Avoid:

```text id="s8k5yr"
job handler
  → directly mutates several domain tables
```

Prefer:

```text id="q4m7tx"
job handler
  → application service
  → owning domain module
```

This keeps synchronous and asynchronous execution paths consistent.

---

# 16. Job Payloads

Job payloads must contain the minimum information required to execute the operation.

Prefer identifiers:

```text id="w6n9pk"
orderId
storeId
customerId
webhookEventId
notificationId
```

rather than copying entire database records into job payloads.

---

# 17. Payload Validation

Every job payload must be validated before execution.

Malformed payloads should not cause uncontrolled handler failures.

Validation should distinguish:

```text id="p7r5mc"
Malformed job
Retryable execution failure
Permanent business failure
```

---

# 18. Idempotent Job Execution

Job execution is **at least once**, not exactly once.

A job may execute more than once because of:

- Worker crashes.
- Network failures.
- Database failures.
- Process termination.
- Lease expiration.
- Retry handling.

Therefore every handler must be safe against duplicate execution.

---

# 19. Idempotency Strategy

Use appropriate mechanisms such as:

```text id="t3m8vq"
Unique database constraints
Idempotency records
State checks
Provider idempotency keys
Processed-event records
Atomic state transitions
```

Do not rely solely on the worker's job status.

---

# 20. Retry Classification

Failures must be classified.

### Retryable

Examples:

```text id="k5x9nw"
Temporary database failure
Temporary provider outage
Network timeout
Rate limit
Transient infrastructure failure
```

### Non-Retryable

Examples:

```text id="r7p4mc"
Malformed payload
Invalid permanent configuration
Unsupported job type
Permanent business rule violation
```

The exact classification should be defined by the owning integration/domain.

---

# 21. Retry Policy

Retries should use bounded attempts and controlled backoff.

Conceptually:

```text id="m8q6tz"
Attempt 1
   ↓
short delay
   ↓
Attempt 2
   ↓
longer delay
   ↓
Attempt 3
   ↓
...
   ↓
terminal failure
```

Avoid infinite retries.

---

# 22. Backoff

Backoff should prevent a failing external dependency from creating a tight retry loop.

The implementation may use exponential backoff with an upper limit.

Jitter may be introduced where useful to reduce synchronized retries.

The exact values should be configuration-driven.

---

# 23. Terminal Failure

When a job exceeds its retry policy:

```text id="x4p7ks"
Mark terminal failure
Record useful error information
Stop retrying
Expose operational visibility
```

The system must preserve enough information to investigate the failure.

---

# 24. Stale Job Recovery

A worker may crash after claiming a job.

The system must detect stale processing jobs based on lease/timeout information.

Recovery should:

```text id="n7w3mq"
Identify stale job
  ↓
Verify lease is expired
  ↓
Return job to executable state
  ↓
Increment/reconcile attempts appropriately
```

Recovery must avoid taking ownership from an active worker.

---

# 25. Lease Ownership

Where a lease model is used, the worker should have a unique execution identity.

Conceptually:

```text id="c8r5vt"
workerId
claimedAt
leaseUntil
```

A worker must not update another worker's active job without proving that its lease has expired.

---

# 26. Polling

The worker may poll PostgreSQL for available work.

Polling must be controlled.

Avoid:

```text id="m5k8qx"
busy loop
zero-delay database polling
unbounded queries
```

Use a reasonable polling interval and wake-up strategy.

---

# 27. Empty Queue Behavior

When no jobs are available, the worker should:

```text id="v4p7ny"
Wait
  ↓
Poll again
```

It should not continuously hammer PostgreSQL.

---

# 28. Job Priority

Demo jobs should not introduce a complex scheduling system unless required.

If priority is implemented, it must remain simple and deterministic.

Priority must not compromise fairness or cause critical jobs to become permanently starved.

---

# 29. Transaction Boundaries

A worker must not keep a PostgreSQL transaction open while performing:

```text id="q8m4wr"
External HTTP calls
Email delivery
Payment provider calls
Object storage operations
Long computations
```

Use short transactions for state transitions and separate external operations.

---

# 30. External Integration Jobs

For provider operations:

```text id="x7n5pk"
Claim job
  ↓
Load current state
  ↓
Call provider
  ↓
Persist result
```

The provider response must not automatically be treated as authoritative without applying the domain's state-transition rules.

---

# 31. Payment Jobs

Payment-related jobs require additional protection.

They must support:

```text id="r6m8vq"
Provider idempotency
Application idempotency
Safe retries
State validation
Webhook reconciliation
```

A retry must never blindly create a second payment operation.

---

# 32. Webhook Jobs

Webhook processing jobs should:

```text id="k4p9xt"
Load persisted webhook event
  ↓
Verify it has not already been processed
  ↓
Apply required state transition
  ↓
Record processing outcome
```

Duplicate webhook delivery must be harmless.

---

# 33. Notification Jobs

Notification jobs should:

```text id="n5w7mr"
Load notification
  ↓
Check current delivery state
  ↓
Attempt delivery
  ↓
Persist result
```

A retry must not unintentionally send duplicate transactional notifications when the notification system provides an idempotency mechanism.

---

# 34. Cleanup Jobs

Cleanup jobs may remove expired or temporary resources.

Examples:

```text id="j8q4vp"
Expired carts
Expired sessions
Temporary media
Stale records
Old operational data
```

Cleanup must respect retention and business rules.

Never delete historical order/payment information merely because it is old.

---

# 35. Job Logging

Every job execution should produce structured logs containing useful identifiers.

Examples:

```text id="c6m9rx"
jobId
jobType
attempt
workerId
duration
result
errorCode
storeId where applicable
correlationId where applicable
```

Do not log full sensitive payloads.

---

# 36. Error Logging

Errors should capture enough context to diagnose the failure.

Do not expose:

```text id="p8r5mk"
Passwords
Payment secrets
Session tokens
Webhook signatures
Private credentials
```

Sensitive provider responses should be minimized or sanitized.

---

# 37. Metrics

The worker should expose useful operational measurements where the observability implementation supports them.

Examples:

```text id="t7n4qw"
Jobs claimed
Jobs completed
Jobs failed
Retry count
Execution duration
Queue age
Stale job recoveries
```

Demo observability should remain simple and useful.

---

# 38. Worker Health

The worker should expose or report enough information to determine whether it is functioning.

Useful signals include:

```text id="x5m8vr"
Process alive
Database reachable
Last successful polling/claim
Active job count
Recent failure count
```

A worker that is running but cannot process jobs should be distinguishable from a healthy worker.

---

# 39. Graceful Error Handling

A job failure must not crash the entire worker process unless the failure indicates an unrecoverable process-level condition.

Expected job failures should be isolated to the affected job.

---

# 40. Process-Level Failures

The worker should terminate when continuing would be unsafe.

Examples may include:

```text id="q4k7mx"
Invalid critical configuration
Corrupted required runtime state
Unrecoverable initialization failure
```

The deployment environment should restart the process when appropriate.

---

# 41. Database Failure

If PostgreSQL becomes temporarily unavailable:

```text id="v8n5qr"
Detect failure
Log failure
Apply controlled retry/backoff
Avoid busy looping
Recover when database becomes available
```

The worker must not mark jobs completed without durable confirmation.

---

# 42. Job Completion

A job should be marked completed only after its required work has successfully finished and the completion state has been durably recorded.

Do not report success before the required state transition is committed.

---

# 43. Job Failure Recording

Failed jobs should preserve:

```text id="m7p4tx"
attempt count
last error
failure timestamp
job type
relevant identifiers
```

Error information should be bounded so repeated failures cannot grow database records indefinitely.

---

# 44. Worker Configuration

Worker configuration should come from the centralized configuration system.

Relevant values may include:

```text id="y5q8mv"
Polling interval
Concurrency
Lease duration
Retry limits
Backoff limits
Shutdown timeout
```

Do not scatter these values across source files.

---

# 45. Worker Security

The worker must use only the credentials and permissions it requires.

Production worker credentials must not be embedded in source code.

The worker must not expose unnecessary administrative endpoints.

---

# 46. Worker Dependency Direction

The worker may depend on:

```text id="c8m5rx"
packages/*
modules/* public application interfaces
approved infrastructure adapters
```

Domain modules must not depend on `apps/worker`.

The dependency direction remains:

```text id="p4n7qw"
Worker
  ↓
Application/Domain
  ↓
Infrastructure
```

---

# 47. Testing Requirements

Worker implementation must include tests for:

```text id="t8m4vk"
Job claiming
Concurrent claiming
Handler dispatch
Successful execution
Retry behavior
Permanent failure
Idempotent execution
Stale job recovery
Graceful shutdown
Unknown job types
Malformed payloads
```

Critical job handlers should also have integration tests against PostgreSQL.

---

# 48. Concurrency Testing

At least one integration test should prove that concurrent workers do not process the same job simultaneously under normal claiming conditions.

Additional tests should cover:

```text id="x6q8mr"
Claim race
Lease expiration
Worker crash/recovery
Duplicate execution
```

---

# 49. Worker Development Scripts

`apps/worker/package.json` should provide predictable scripts such as:

```text id="m5r7vk"
dev
build
start
typecheck
lint
test
```

The exact commands must align with repository-level tooling.

---

# 50. Worker Implementation Order

Implement the worker in this order:

```text id="q8n4tx"
1. Process bootstrap
2. Configuration integration
3. Database connection
4. Job model/repository integration
5. Job claiming
6. Handler registry
7. Execution loop
8. Retry handling
9. Stale recovery
10. Graceful shutdown
11. Logging/observability
12. Worker tests
13. Domain/integration handlers
```

---

# 51. Definition of Done

The worker foundation is complete when:

```text id="v7m5rq"
[ ] Worker starts successfully
[ ] Configuration is validated
[ ] PostgreSQL connection works
[ ] Jobs are durably persisted
[ ] Concurrent workers claim safely
[ ] Job handlers are explicitly registered
[ ] Unknown job types fail safely
[ ] Payloads are validated
[ ] Job execution is idempotent
[ ] Retry policy is bounded
[ ] Backoff is implemented
[ ] Terminal failures are recorded
[ ] Stale jobs can recover
[ ] Concurrency is bounded
[ ] Shutdown is graceful
[ ] External calls occur outside long DB transactions
[ ] Sensitive information is not logged
[ ] Worker health is observable
[ ] Critical behavior is integration-tested
[ ] Production build succeeds
[ ] TypeScript and lint checks pass
```

---

# 52. Final Principle

The worker is a **durable execution engine, not a second application**.

Its purpose is to reliably execute asynchronous work while keeping business ownership inside the appropriate application and domain modules.

The Demo should achieve reliable background processing through PostgreSQL, explicit job contracts, safe concurrency, idempotent handlers, bounded retries, and recoverable failures without prematurely introducing distributed infrastructure.