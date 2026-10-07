# Worker Bootstrap Implementation

## 1. Purpose

This document defines the concrete implementation required to bootstrap `apps/worker` as the background-processing application for the Demo.

The worker provides durable asynchronous processing without introducing a separate queue infrastructure during Demo.

The worker is responsible for:

- Starting the background-processing runtime.
- Connecting to PostgreSQL.
- Polling durable jobs.
- Safely claiming jobs.
- Dispatching registered handlers.
- Executing jobs with bounded concurrency.
- Retrying retryable failures.
- Recovering stale jobs.
- Recording job outcomes.
- Supporting graceful shutdown.
- Providing operational visibility.

The worker must remain a generic execution runtime. Business logic belongs to the owning domain or integration.

---

# 2. Worker Location

The worker lives at:

```text
apps/worker/
```

Expected structure:

```text
apps/worker/
├── src/
│   ├── bootstrap/
│   ├── runtime/
│   ├── jobs/
│   ├── handlers/
│   ├── health/
│   └── index.ts
├── package.json
└── tsconfig.json
```

The exact structure may be simplified as implementation stabilizes.

---

# 3. Worker Responsibilities

The worker owns:

```text
Configuration
    ↓
Database Connection
    ↓
Job Polling
    ↓
Job Claiming
    ↓
Handler Dispatch
    ↓
Execution
    ↓
Completion / Retry / Failure
```

It does not own:

- Payment business rules.
- Notification business rules.
- Inventory business rules.
- Checkout business rules.
- Webhook business rules.

Those remain within their respective modules.

---

# 4. Worker Architecture

The runtime should follow:

```text
Worker Process
     │
     ├── Configuration
     │
     ├── Database
     │
     ├── Job Repository
     │
     ├── Job Claiming
     │
     ├── Handler Registry
     │
     ├── Scheduler / Poller
     │
     ├── Retry Manager
     │
     └── Shutdown Manager
```

---

# 5. Configuration

The worker must use centralized configuration from:

```text
packages/config
```

Worker-specific settings should include:

- Database connection.
- Poll interval.
- Batch size.
- Maximum concurrency.
- Job timeout where appropriate.
- Retry configuration.
- Stale-job threshold.
- Logging level.
- Environment.
- Application version.

No worker code should read raw environment variables directly.

---

# 6. Startup Sequence

Worker startup should follow:

```text
Load Configuration
      ↓
Validate Configuration
      ↓
Initialize Logger
      ↓
Initialize Database
      ↓
Initialize Job Repository
      ↓
Initialize Handler Registry
      ↓
Recover Stale Jobs
      ↓
Start Polling
```

If a required dependency cannot initialize, the worker must fail clearly rather than entering a partially functioning state.

---

# 7. Database Connection

The worker uses PostgreSQL as the source of truth for jobs.

It should use:

```text
packages/db
```

for connection management.

The worker must not create a separate database connection implementation.

---

# 8. Job Persistence

Jobs are stored in PostgreSQL.

The job record should contain enough information to support:

- Identification.
- Type.
- Payload.
- Status.
- Availability.
- Attempts.
- Retry information.
- Failure information.
- Timestamps.
- Ownership/lease information where required.
- Tenant context where applicable.

The exact schema follows the Jobs implementation specification.

---

# 9. Job Lifecycle

A job should move through controlled states.

Conceptually:

```text
Pending
   ↓
Running
   ├──→ Completed
   ├──→ Retry Pending
   └──→ Failed
```

A stale `Running` job may be recovered according to the defined recovery strategy.

Invalid state transitions must be rejected.

---

# 10. Job Claiming

Workers must safely claim jobs without processing the same job concurrently under normal operation.

The preferred PostgreSQL pattern is based on:

```text
FOR UPDATE SKIP LOCKED
```

Conceptually:

```text
Transaction
    ↓
Select eligible jobs
    ↓
Lock rows
    ↓
Mark as Running
    ↓
Commit
```

The transaction should remain short.

The actual job execution must occur outside the claim transaction.

---

# 11. Why Execution Happens Outside the Claim Transaction

External work may take seconds or longer.

Holding a database transaction while:

- Calling a payment provider.
- Sending email.
- Uploading files.
- Calling another service.

would unnecessarily hold database locks.

Therefore:

```text
Claim
  ↓
Commit
  ↓
Execute
  ↓
Persist Result
```

is preferred.

---

# 12. Handler Registry

The worker should maintain a registry mapping job types to handlers.

Conceptually:

```text
Job Type
   ↓
Handler Registry
   ↓
Handler
```

Example job types may include:

```text
notification.send
webhook.process
media.cleanup
payment.reconcile
inventory.release
```

Only job types required by the Demo should be registered.

---

# 13. Handler Contract

A handler should receive a validated job payload and execution context.

The context may contain:

```text
jobId
attempt
organizationId
storeId
correlationId
```

where available.

Handlers should return a clear execution result or throw a categorized error.

---

# 14. Handler Ownership

Job handlers should belong to the domain or integration responsible for the work.

For example:

```text
modules/notifications/
    application/
    infrastructure/
    jobs/
```

rather than placing all business logic inside:

```text
apps/worker/
```

The worker only discovers and executes the handler.

---

# 15. Job Payload Validation

Job payloads must be validated before execution.

A malformed job must not reach business logic as an unchecked object.

Validation should include:

- Job type.
- Required fields.
- Data types.
- Tenant context where required.
- Version compatibility where required.

---

# 16. Job Versioning

Long-lived jobs may survive application deployments.

Therefore, payload structures must be handled carefully.

If payload versioning is required, use an explicit version field.

Example:

```json id="8f0f10"
{
  "version": 1,
  "storeId": "...",
  "resourceId": "..."
}
```

Do not silently reinterpret incompatible historical payloads.

---

# 17. Tenant Context

Jobs that operate on Store-owned resources must carry enough context to preserve tenant isolation.

Example:

```text
organizationId
storeId
resourceId
```

The handler must verify that the resource belongs to the expected tenant context.

Never trust a job payload as proof of authorization.

---

# 18. Authorization in Jobs

Background jobs do not have an interactive user session.

Therefore, job authorization is based on:

- Trusted job creation.
- Tenant context.
- Resource ownership.
- Domain invariants.

A job must not bypass domain-level ownership checks merely because it originated from an internal system.

---

# 19. Polling

The worker should poll for eligible jobs at a configurable interval.

Polling should:

- Avoid excessive database load.
- Wake promptly when work is available.
- Respect shutdown state.
- Handle temporary database failures.

The initial Demo implementation may use straightforward polling.

A more advanced queue can be introduced later without changing job handler contracts.

---

# 20. Batch Size

The worker should claim jobs in bounded batches.

Batch size must be configurable.

The default should be conservative enough to avoid:

- Excessive memory usage.
- Database contention.
- Provider overload.

---

# 21. Concurrency

Worker concurrency must be bounded.

Example:

```text
Worker
  ├── Job A
  ├── Job B
  ├── Job C
  └── Job D
```

The maximum number of concurrent handlers must be configurable.

Do not create unlimited promises from a large database result.

---

# 22. Job Timeouts

Long-running handlers should have appropriate timeout protection where technically possible.

A timeout must not automatically assume that the external operation failed.

For example:

```text
Payment Provider Request
        ↓
Worker Timeout
        ↓
Unknown external state
```

This requires reconciliation rather than blindly retrying a potentially successful operation.

---

# 23. Retry Classification

Errors must be classified.

### Retryable

Examples:

- Temporary database failure.
- Network timeout.
- Provider temporary outage.
- Rate limit.
- Temporary storage failure.

### Non-Retryable

Examples:

- Invalid payload.
- Unsupported job type.
- Permanent validation failure.
- Invalid configuration.
- Irrecoverable business condition.

---

# 24. Retry Policy

Retry behavior should include:

```text
attempt count
backoff
next available time
maximum attempts
final failure state
```

Exponential or bounded backoff should be used where appropriate.

Retries must not become an infinite loop.

---

# 25. Idempotent Job Execution

Jobs must be designed for at-least-once execution.

A handler may execute more than once due to:

- Worker crash.
- Network failure.
- Database failure after external success.
- Process termination.
- Stale-job recovery.

Therefore, handlers must be idempotent or use a durable idempotency mechanism.

---

# 26. External Side Effects

External operations require particular care.

Example:

```text
Send Email
   ↓
Provider accepts request
   ↓
Worker crashes before recording success
```

The job may be retried.

The integration must therefore use provider idempotency, application-level deduplication, or another appropriate mechanism where supported.

---

# 27. Payment Jobs

Payment-related jobs must receive additional protection.

Examples:

```text
payment.reconcile
payment.refund
```

Payment handlers must:

- Be idempotent.
- Preserve provider references.
- Handle unknown provider state safely.
- Avoid duplicate financial operations.
- Record reconciliation results.

---

# 28. Notification Jobs

Notification jobs should:

- Resolve the notification.
- Verify delivery state.
- Attempt delivery.
- Record the result.
- Retry transient failures.
- Avoid duplicate delivery where possible.

The worker should not contain notification templates or business decisions.

---

# 29. Webhook Jobs

Webhook processing jobs should:

- Load the persisted webhook event.
- Verify it has not already been completed.
- Process it through the owning integration.
- Record processing state.
- Retry safe failures.
- Preserve the original event.

Webhook handlers must tolerate duplicate delivery.

---

# 30. Inventory Jobs

Inventory-related jobs may include:

- Reservation expiration.
- Cleanup.
- Reconciliation.

Inventory jobs must use the same concurrency and data-integrity rules as synchronous inventory operations.

They must not directly manipulate database quantities outside inventory-owned application services.

---

# 31. Media Jobs

Media jobs may include:

- Orphan cleanup.
- Failed-upload cleanup.
- Object deletion.
- Metadata reconciliation.

Object storage operations should happen outside long database transactions.

---

# 32. Job Recovery

At startup and during normal operation, the worker should identify stale jobs.

Conceptually:

```text
Running
   ↓
Lease / heartbeat expires
   ↓
Eligible for recovery
   ↓
Pending / Retry Pending
```

Recovery must be safe against another worker still processing the original job.

---

# 33. Worker Crash Recovery

If a worker terminates unexpectedly:

- Claimed jobs must eventually become recoverable.
- Other workers must not wait forever.
- External side effects must remain protected by idempotency.

Crash recovery must be tested explicitly.

---

# 34. Graceful Shutdown

When receiving a termination signal:

```text
Stop Polling
      ↓
Stop Claiming New Jobs
      ↓
Allow Active Jobs to Finish
      ↓
Respect Shutdown Timeout
      ↓
Release Resources
      ↓
Close Database
      ↓
Exit
```

Jobs that cannot finish within the shutdown window must be safely recoverable.

---

# 35. Worker Health

The worker should expose operational health information appropriate to its runtime environment.

At minimum, monitoring should be able to determine:

- Process is running.
- Database connection is functional.
- Polling loop is active.
- Jobs are being processed.

Health reporting must not expose secrets or job payloads containing sensitive data.

---

# 36. Structured Logging

Worker logs should contain useful correlation information:

```text
jobId
jobType
attempt
organizationId
storeId
correlationId
durationMs
result
```

Sensitive payload values must not be logged.

---

# 37. Metrics

Useful worker metrics include:

```text
jobs_claimed_total
jobs_completed_total
jobs_failed_total
jobs_retried_total
job_duration_ms
job_queue_delay_ms
active_jobs
stale_jobs_recovered_total
```

The exact metric system may remain simple for Demo.

---

# 38. Error Reporting

Unexpected worker exceptions should be reported to the configured error-monitoring system.

Expected business failures should remain structured and should not generate excessive error alerts.

---

# 39. Database Failure Handling

If PostgreSQL becomes temporarily unavailable:

```text
Worker
   ↓
Database Error
   ↓
Backoff
   ↓
Retry Connection / Poll
```

The worker should not enter a tight failure loop.

---

# 40. Unknown Job Types

If a job references an unknown handler:

1. Do not execute arbitrary logic.
2. Record the failure.
3. Classify the error appropriately.
4. Avoid infinite retries for permanently unsupported job types.
5. Alert or surface the condition operationally.

---

# 41. Worker Security

The worker must:

- Use least-privileged credentials where possible.
- Avoid exposing HTTP interfaces unnecessarily.
- Protect secrets.
- Validate job payloads.
- Preserve tenant boundaries.
- Avoid logging sensitive data.
- Avoid arbitrary code execution based on job payloads.

Job type should map to a known handler, never to dynamically imported code supplied by a job.

---

# 42. Testing Strategy

The worker must be tested at multiple levels.

## Unit Tests

Test:

- Handler selection.
- Retry classification.
- Backoff calculation.
- Payload validation.
- State transition logic.

## Integration Tests

Test:

- Job insertion.
- Claiming.
- Concurrent workers.
- Completion.
- Retry.
- Failure.
- Stale recovery.

## Failure Tests

Test:

- Worker crash.
- Database failure.
- Handler timeout.
- Duplicate execution.
- Provider failure.

---

# 43. Concurrency Verification

At least two worker processes should be tested against the same job queue.

Expected behavior:

```text
Job X
  ↓
Worker A claims X
Worker B cannot claim X
```

This verifies the database locking strategy.

---

# 44. Worker Implementation Sequence

Implement in this order:

```text
1. Configure worker application
2. Connect database
3. Implement job repository
4. Implement job state model
5. Implement job claiming
6. Implement handler registry
7. Implement payload validation
8. Implement handler execution
9. Implement completion
10. Implement retry behavior
11. Implement stale-job recovery
12. Implement bounded concurrency
13. Implement graceful shutdown
14. Add structured logging
15. Add worker health
16. Add metrics/error reporting
17. Add integration tests
18. Verify concurrent execution
```

---

# 45. Definition of Done

The worker foundation is complete when:

```text
[ ] Worker starts successfully
[ ] Configuration is validated
[ ] PostgreSQL connection works
[ ] Jobs can be claimed safely
[ ] Handler registry works
[ ] Payload validation works
[ ] Job completion works
[ ] Retry behavior works
[ ] Non-retryable failures stop retrying
[ ] Stale jobs can recover
[ ] Concurrency is bounded
[ ] Duplicate execution is handled safely
[ ] Graceful shutdown works
[ ] Worker logging works
[ ] Health information is available
[ ] Integration tests pass
[ ] Concurrent worker behavior is verified
```

The worker should remain a **small durable execution engine**, not a second business-logic application. Its purpose is to execute work reliably while allowing the domain modules to remain the owners of that work.