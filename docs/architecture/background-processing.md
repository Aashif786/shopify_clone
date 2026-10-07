# Background Processing Architecture

## 1. Purpose

This document defines the architecture for asynchronous and background processing in the Demo platform.

Background processing is used when work does not need to block the user's request or when an operation must be retried independently.

The Demo uses:

```text
apps/worker
```

as the primary background-processing runtime.

The architecture must preserve:

- Tenant isolation
- Business invariants
- Transactional correctness
- Idempotency
- Retry safety
- Observability
- Failure recovery

---

# 2. Background Processing Goals

The background-processing system should:

1. Keep user-facing requests responsive.
2. Move suitable secondary work out of synchronous request paths.
3. Support retryable operations.
4. Prevent duplicate business effects.
5. Preserve tenant context.
6. Make failures observable.
7. Keep the Demo infrastructure simple.
8. Provide a path toward more scalable V1 processing.

---

# 3. Worker Application

The worker application is located at:

```text
apps/worker
```

It is a separate runtime application within the same repository.

The worker may consume:

- Jobs
- Application events
- Scheduled tasks
- External webhook follow-up work

The worker uses the same business modules and shared packages as the web application.

---

# 4. Worker Responsibilities

The worker is responsible for:

- Executing asynchronous jobs.
- Processing retryable work.
- Consuming application events where appropriate.
- Running scheduled background tasks.
- Executing secondary effects.
- Recording job success/failure.
- Applying retry policies.

The worker MUST NOT become an independent implementation of business logic.

---

# 5. What Should Be Asynchronous

Work is a good candidate for background processing when:

- It does not need to determine the immediate transaction result.
- It may take significant time.
- It can safely be retried.
- It interacts with an external service.
- It is a secondary effect of a completed business operation.
- Temporary failure should not block the primary transaction.

Examples:

- Sending confirmation emails.
- Processing non-critical notifications.
- Secondary webhook processing.
- Non-critical media processing.
- Cleanup operations.
- Retryable external integrations.

---

# 6. What Should Remain Synchronous

Critical operations that determine the immediate business result should generally remain synchronous when atomicity is required.

Examples:

- Validating checkout eligibility.
- Validating inventory availability.
- Calculating the final purchase amount.
- Critical order creation.
- Critical payment state transitions.
- Authorization decisions.

The system must not move a transaction-critical operation into a background job merely because queues are fashionable.

---

# 7. Basic Architecture

The Demo processing model is:

```text
                    ┌──────────────────┐
                    │    apps/web      │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ Application Core │
                    └────────┬─────────┘
                             │
                    Job / Event Creation
                             │
                             ▼
                    ┌──────────────────┐
                    │ Background Queue │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   apps/worker    │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ Application Core │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ Domain / Infra   │
                    └──────────────────┘
```

The exact queue implementation may evolve.

The architecture must not assume Redis or another specific queue technology unless the implementation actually requires it.

---

# 8. Job Model

A background job represents work that should be executed asynchronously.

A conceptual job contains:

```text
Job
├── Job ID
├── Job Type
├── Payload
├── Tenant Context
├── Attempt Count
├── Status
├── Created At
├── Scheduled At
├── Started At
└── Completed At / Failed At
```

The exact persistence model is implementation-specific.

---

# 9. Job Types

Jobs should represent meaningful operations.

Examples:

```text
SendOrderConfirmation
SendOrderStatusNotification
ProcessPaymentFollowUp
ProcessWebhook
ProcessMedia
CleanupExpiredData
```

Jobs should not become generic containers for arbitrary application logic.

---

# 10. Job Payloads

Job payloads should contain the minimum information required to execute the operation.

Prefer:

```text
job:
  type: SendOrderConfirmation
  orderId: 123
  storeId: 456
```

over copying the entire order or customer object into the job.

The worker should load current authoritative state when appropriate.

---

# 11. Tenant Context

Every job that operates on store-owned resources must preserve tenant context.

Conceptually:

```text
Job
├── organizationId
├── storeId
└── resourceId
```

The worker must never assume that a job belongs to a particular store merely because the resource identifier exists.

Tenant context must be verified before processing.

---

# 12. Job Execution Flow

A standard job follows:

```text
Job Available
     ↓
Worker Claims Job
     ↓
Load Job Context
     ↓
Resolve Tenant
     ↓
Validate Job
     ↓
Invoke Application Service
     ↓
Execute Domain Operation
     ↓
Persist Result
     ↓
Mark Job Complete
```

If processing fails:

```text
Processing Failure
      ↓
Classify Failure
      ↓
Retryable?
   /       \
 Yes        No
  ↓          ↓
Retry      Mark Failed
```

---

# 13. Retryable Failures

Examples of potentially retryable failures:

- Temporary database connectivity issue.
- Temporary external provider outage.
- Network timeout.
- Temporary rate limit.
- Transient infrastructure failure.

Retryability must be determined by the operation.

Not every error should be retried.

---

# 14. Non-Retryable Failures

Examples include:

- Invalid job payload.
- Resource permanently deleted.
- Business rule violation.
- Invalid state transition.
- Authentication failure that cannot be recovered automatically.
- Unsupported job type.

Such failures should be recorded rather than endlessly retried.

Infinite retries are not resilience. They are a machine discovering the same mistake repeatedly.

---

# 15. Retry Strategy

Retryable jobs should use controlled retries.

Conceptually:

```text
Attempt 1
   ↓
Failure
   ↓
Wait
   ↓
Attempt 2
   ↓
Failure
   ↓
Wait
   ↓
Attempt 3
   ↓
Failure
   ↓
Final Failure
```

The exact retry count and delay should depend on the operation.

Backoff should be used where appropriate.

---

# 16. Idempotency

Background jobs must be designed so that retries do not unintentionally duplicate business effects.

For example:

```text
SendOrderConfirmation
```

must not send unlimited duplicate confirmations simply because a worker restarted.

Similarly:

```text
ProcessPaymentWebhook
```

must not apply the same payment event multiple times.

Idempotency is therefore a fundamental property of background processing.

---

# 17. Idempotency Strategies

Possible strategies include:

### Unique Operation Identifier

```text
operationId
```

The system records whether the operation has already been completed.

### Event Identifier

External events can be identified by a provider event ID.

### Database Constraint

A unique constraint can prevent duplicate processing.

### State Check

The application can verify whether the intended state change has already occurred.

The appropriate mechanism depends on the operation.

---

# 18. Event Processing

Application events may be processed asynchronously.

Example:

```text
Order Created
     ↓
OrderCreated Event
     ↓
Worker
     ├──→ Send Confirmation
     └──→ Other Secondary Effects
```

Events should represent facts that have already occurred.

Examples:

```text
OrderCreated
PaymentSucceeded
PaymentFailed
OrderStatusChanged
InventoryAdjusted
```

---

# 19. Event vs Job

Events and jobs have different purposes.

### Event

Represents:

> Something happened.

Example:

```text
OrderCreated
```

### Job

Represents:

> Something needs to be done.

Example:

```text
SendOrderConfirmation
```

A common pattern is:

```text
OrderCreated
     ↓
Create SendOrderConfirmation Job
     ↓
Worker Executes Job
```

---

# 20. Event Publication

Events associated with transactional state should not be published in a way that allows the event to exist without the corresponding database state.

For example:

```text
Transaction
 ├── Update Order
 └── Record Event
        ↓
      Commit
        ↓
 Worker processes event
```

The exact implementation may use an outbox-style mechanism if required.

The architectural principle is that important events must remain consistent with the transaction that produced them.

---

# 21. Transactional Boundary

A background job must not be treated as a substitute for a database transaction.

For example:

```text
Order Creation
```

should not depend on:

```text
Worker eventually creates the order
```

if the order must exist atomically with the checkout operation.

Instead:

```text
Checkout Transaction
 ├── Required business state
 └── Required order state
        ↓
      Commit
        ↓
Secondary Background Work
```

---

# 22. Worker and Domain Reuse

The worker should invoke existing application/domain capabilities.

Preferred:

```text
Worker
  ↓
Application Service
  ↓
Domain Module
```

Avoid:

```text
Worker
  ↓
Custom Business Logic
  ↓
Direct Database Manipulation
```

The second approach creates two different versions of the business rules.

---

# 23. Worker and Authorization

Background jobs do not necessarily have a human user.

Therefore, authorization must be modeled appropriately.

A job should have a trusted execution context that determines:

- Which tenant it belongs to.
- Which operation it is performing.
- Why the operation is allowed.
- Which system capability is executing it.

The worker must not impersonate arbitrary users simply to bypass authorization.

---

# 24. Scheduled Jobs

Scheduled jobs may be used for:

- Cleanup.
- Expiration processing.
- Maintenance.
- Periodic synchronization.
- Other non-interactive tasks.

Scheduled processing should remain limited in Demo.

A scheduled task must still preserve:

- Tenant isolation.
- Idempotency.
- Retry safety.
- Observability.

---

# 25. Webhook Processing

Webhooks may initially enter through the web application.

Conceptually:

```text
External Provider
       ↓
Webhook Endpoint
       ↓
Verify Signature
       ↓
Validate Event
       ↓
Persist / Queue Work
       ↓
Worker
       ↓
Application Service
```

The webhook endpoint should remain lightweight where the provider permits asynchronous processing.

---

# 26. Payment Webhooks

Payment webhooks require additional care.

```text
Payment Provider
       ↓
Webhook
       ↓
Verify Authenticity
       ↓
Identify Payment
       ↓
Check Event Idempotency
       ↓
Update Payment State
       ↓
Trigger Required Secondary Effects
```

Payment state changes must remain authoritative.

The worker must not create duplicate orders because the provider sends the same event multiple times.

---

# 27. Notifications

Notifications are a strong candidate for asynchronous processing.

Example:

```text
Order Created
      ↓
OrderCreated
      ↓
Notification Job
      ↓
Worker
      ↓
Email Provider
```

If email delivery fails:

```text
Email Failure
      ↓
Retry
      ↓
Success
```

A notification failure must not undo the completed order.

---

# 28. External Provider Failures

When an external provider is unavailable:

```text
Worker
  ↓
Provider Call
  ↓
Failure
  ↓
Classify Failure
  ↓
Retry if appropriate
```

The system should distinguish:

- Temporary failure.
- Permanent failure.
- Invalid request.
- Provider rejection.
- Rate limiting.

The business state should remain internally consistent regardless of provider availability.

---

# 29. Job Concurrency

Multiple workers or processes may eventually execute jobs concurrently.

Therefore, jobs that modify shared business state must be designed for concurrency.

Examples:

- Inventory operations.
- Payment state changes.
- Order state changes.

The application/database must enforce the relevant invariants.

A worker-level check alone is insufficient protection.

---

# 30. Duplicate Job Delivery

The system should assume a job may be delivered more than once.

Example:

```text
Job A
  ↓
Worker 1 processes
  ↓
Worker crashes before acknowledging
  ↓
Job A becomes available again
  ↓
Worker 2 processes
```

The business operation must remain safe.

This is why idempotency belongs to the business operation rather than only the queue.

---

# 31. Failed Job Handling

Failed jobs should have a terminal state after retry exhaustion.

Conceptually:

```text
Pending
  ↓
Running
  ↓
Failed
  ↓
Retrying
  ↓
Failed Permanently
```

The system should preserve enough information to diagnose the failure.

This may include:

- Error category.
- Attempt count.
- Last failure timestamp.
- Job type.
- Resource identifier.
- Tenant context.
- Correlation ID.

Sensitive payload data must not be unnecessarily stored in logs.

---

# 32. Dead-Letter / Failed Work

A full enterprise dead-letter architecture is not required for the Demo.

However, permanently failed jobs must be discoverable.

A basic mechanism may be sufficient initially.

The V1 architecture can later introduce:

- Dead-letter queues.
- Manual replay.
- Operational dashboards.
- Advanced retry policies.
- Queue prioritization.

---

# 33. Observability

Background processing should provide enough information to answer:

- Which job failed?
- Which tenant was affected?
- Which resource was involved?
- How many attempts occurred?
- Why did it fail?
- When did it fail?
- Is it retrying?
- Did it eventually succeed?

Worker logs should include safe correlation information.

---

# 34. Job Priority

The Demo does not require a complex priority system.

If prioritization becomes necessary, it can be introduced later.

Critical business operations should not be artificially delayed behind large amounts of low-value background work.

---

# 35. Queue Technology

The architecture intentionally does not mandate a specific queue technology at this stage.

The Demo should use the simplest reliable mechanism that satisfies current requirements.

Possible future V1 infrastructure may include:

- Redis-backed queues.
- Managed queue services.
- Dedicated job infrastructure.

The queue implementation is an infrastructure concern, not a domain decision.

---

# 36. Background Processing Anti-Patterns

The following patterns should be avoided.

### Business Logic Duplication

```text
Web
  → Order Rules

Worker
  → Different Order Rules
```

### Transaction-Critical Work Hidden in Jobs

```text
Checkout
  → Queue Order Creation
  → Return Success
```

when the order itself must be part of the transaction.

### Infinite Retries

```text
Failure
 → Retry
 → Retry
 → Retry
 → Retry forever
```

### Ignoring Tenant Context

```text
Worker
 → Resource ID
 → Process Without Store Verification
```

### Non-Idempotent Jobs

```text
Retry
 → Duplicate Payment / Order / Inventory Effect
```

---

# 37. Demo Background Processing Scope

The Demo should initially support only the background processing that provides clear value.

Likely candidates include:

- Notifications.
- Payment/webhook follow-up.
- Retryable external integrations.
- Basic scheduled cleanup.
- Other clearly asynchronous secondary effects.

The Demo does not require:

- Distributed event streaming.
- Complex workflow engines.
- Multi-region queues.
- Advanced job orchestration.
- Enterprise scheduler infrastructure.

---

# 38. V1 Evolution

As traffic and operational requirements increase, the architecture can evolve:

```text
Demo

Web
 │
 ▼
Simple Queue
 │
 ▼
Worker
```

toward:

```text
V1

Web/API
   │
   ▼
Event / Job Infrastructure
   │
   ├──→ Worker Pool A
   ├──→ Worker Pool B
   ├──→ Notification Workers
   ├──→ Integration Workers
   └──→ Processing Workers
```

The business modules should remain independent of the specific queue technology.

---

# 39. Background Processing Invariants

Every asynchronous operation must preserve:

1. Tenant context.
2. Business authorization assumptions.
3. Domain invariants.
4. Transactional correctness.
5. Retry safety.
6. Idempotency.
7. Failure visibility.
8. Appropriate observability.
9. Safe handling of external failures.
10. No duplicate business effects.

---

# 40. Definition of Done

Background processing is correctly implemented when:

- `apps/worker` can execute supported jobs.
- Jobs have identifiable types and execution state.
- Tenant context is preserved.
- Jobs use existing application/domain logic.
- Retryable failures are retried safely.
- Non-retryable failures reach a terminal state.
- Critical operations are not incorrectly moved outside required transactions.
- Duplicate job delivery is safe.
- Webhooks are authenticated and idempotent.
- External failures do not corrupt internal business state.
- Failed jobs are observable.
- Sensitive information is not unnecessarily logged.
- The architecture does not depend on premature queue infrastructure.

---

# 41. Summary

The background-processing model is:

```text
Application Event / Job
          ↓
     Queue / Scheduler
          ↓
      apps/worker
          ↓
   Application Service
          ↓
      Domain Module
          ↓
 Database / Integration
          ↓
   Success / Retry / Failure
```

The core principle is:

> **Background processing is for asynchronous work, not for avoiding transactional correctness. Jobs must preserve tenant context, reuse domain logic, tolerate retries, and never create duplicate business effects.**