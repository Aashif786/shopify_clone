# Database Transaction Strategy

## 1. Purpose

This document defines how PostgreSQL transactions are used to protect business correctness in the Demo commerce platform.

The strategy covers:

- Transaction boundaries
- Atomic operations
- Multi-step commerce workflows
- Cross-module transactions
- External integrations
- Concurrency-sensitive operations
- Idempotency
- Failure handling
- Retry behavior
- Transaction isolation
- Background jobs
- Webhooks

The primary goal is not to maximize transaction usage.

The goal is to ensure that every operation that must be atomic is actually atomic, while avoiding unnecessarily long or fragile transactions.

---

# 2. Core Principle

PostgreSQL is the authoritative transactional source of truth for core commerce state.

A transaction should be used whenever multiple database changes must be treated as one logical operation.

The basic rule is:

```text id="1q8gtd"
Either all required internal state changes succeed
or none of them become committed.
```

However:

```text id="w6h1d4"
PostgreSQL transaction
        ≠
External API transaction
```

An external payment provider, email provider, or object-storage service cannot participate directly in the same PostgreSQL transaction.

External operations therefore require explicit coordination, idempotency, and reconciliation.

---

# 3. Transaction Design Principles

Transactions must follow these principles:

1. Keep transaction boundaries explicit.
2. Keep transactions as short as practical.
3. Perform critical validation inside the transaction when concurrent changes could invalidate it.
4. Use database constraints as final integrity barriers.
5. Lock only what is required.
6. Avoid network calls inside database transactions whenever possible.
7. Never assume external APIs are transactional.
8. Make retryable operations idempotent.
9. Keep business invariants inside application/domain services.
10. Use PostgreSQL transactions for authoritative state changes.
11. Do not use transactions to hide architectural boundary problems.
12. Test transaction behavior under failure and concurrency.

---

# 4. Transaction Ownership

The application service that coordinates a business operation owns the transaction boundary.

For example:

```text id="3fzxg5"
Checkout Application Service
        ↓
BEGIN
        ↓
Inventory operations
Payment state operations
Order creation
        ↓
COMMIT
```

The individual domain modules define their business rules.

The application service coordinates the transaction.

A low-level repository should not arbitrarily begin and commit transactions for every database operation.

---

# 5. Transaction Scope

A transaction should contain only the operations that need atomicity.

For example:

```text id="e6f1tr"
BEGIN
    validate current business state
    update inventory
    create order
    create order items
    create payment state
    create required internal events
COMMIT
```

Unrelated operations should remain outside the transaction.

For example, sending an email should not normally occur inside the transaction.

---

# 6. Operations Requiring Transactions

The following operations are transaction-sensitive:

- Inventory adjustments
- Inventory reservation/release
- Cart finalization
- Checkout completion
- Order creation
- Order state transitions
- Payment state updates
- Discount usage updates
- Idempotency record creation
- Webhook processing
- Background job state transitions

The exact transaction boundary depends on the operation.

---

# 7. Store Creation Transaction

Creating a store may involve:

```text id="8d3z0q"
Organization validation
        ↓
Store creation
        ↓
Store settings creation
        ↓
Owner membership creation
```

These changes should generally succeed or fail together.

Conceptually:

```text id="u6q7m9"
BEGIN

create store
create default settings
create owner membership

COMMIT
```

If one required operation fails, the store should not be left partially initialized.

---

# 8. Product Creation Transaction

Basic product creation may require:

```text id="fr91hm"
Product
Product variants
Initial media metadata
```

These records should be created atomically when they form one logical product creation operation.

External media upload should not be treated as part of the PostgreSQL transaction.

Instead:

```text id="u0vdyj"
Upload media
      ↓
Store media reference
```

or:

```text id="g7m7g1"
Create product
      ↓
Upload media asynchronously
      ↓
Attach media reference
```

depending on the final workflow.

---

# 9. Inventory Adjustment Transaction

Inventory modification is one of the most important transaction boundaries.

Example:

```text id="zq3l7f"
BEGIN

lock/read inventory row
validate requested adjustment
validate resulting quantity
update inventory quantity
create inventory adjustment record

COMMIT
```

The quantity update and history record must not be separated.

Otherwise the system could produce:

```text id="5n8yqj"
Quantity updated
Adjustment record failed
```

or:

```text id="r1b0xk"
Adjustment recorded
Quantity update failed
```

Both states are incorrect.

---

# 10. Inventory Reservation Transaction

If the Demo checkout flow uses inventory reservations, reservation must be atomic.

Conceptually:

```text id="3w3v5e"
BEGIN

lock inventory row
verify available quantity
decrease available quantity
increase reserved quantity
create reservation record if required

COMMIT
```

A reservation must never succeed without the corresponding inventory change.

---

# 11. Inventory Release Transaction

When a reservation expires or is cancelled:

```text id="v2p2ei"
BEGIN

verify reservation state
restore available quantity
decrease reserved quantity
mark reservation released

COMMIT
```

The operation must be idempotent.

Running it twice must not restore the same inventory twice.

---

# 12. Cart Update Transactions

Cart operations are usually smaller transactions.

Example:

```text id="h4p5f0"
BEGIN

verify cart ownership
verify variant belongs to store
validate quantity
insert/update cart item

COMMIT
```

A cart update does not need to hold a long-running transaction across the entire browser interaction.

Each request should perform its own atomic operation.

---

# 13. Checkout Transaction Boundary

Checkout is the most important orchestration workflow.

A simplified internal workflow is:

```text id="3snxgs"
BEGIN
    load checkout
    verify checkout state

    validate product state
    validate inventory
    validate discount eligibility

    perform required inventory operation

    calculate/confirm final totals

    create order
    create order items
    create order address snapshots

    record internal payment state

    update checkout state

    create internal domain events/outbox records
COMMIT
```

The exact payment sequence depends on the payment provider integration.

The database transaction must never assume that a provider API call can be rolled back.

---

# 14. External Payment Transactions

Payment processing introduces a distributed consistency problem.

For example:

```text id="q6j3i0"
Application
    ↓
Payment Provider
    ↓
Provider charges customer
    ↓
Application crashes
```

The provider charge cannot be rolled back by PostgreSQL automatically.

Therefore, payment workflows require:

- provider idempotency keys
- internal payment attempts
- webhook processing
- reconciliation
- explicit payment states
- safe retry behavior

The database transaction protects internal state.

The payment provider protects external financial processing through its own idempotency mechanisms where available.

---

# 15. Payment Creation Strategy

A safe pattern is:

```text id="7y8i4g"
Create internal payment attempt
        ↓
Call provider using idempotency key
        ↓
Receive provider result
        ↓
Update internal payment state
```

The provider call should normally occur outside a long-held PostgreSQL transaction.

The internal payment state must be designed to represent intermediate states such as:

```text id="c92mcz"
PENDING
PROCESSING
SUCCEEDED
FAILED
UNKNOWN
```

The exact state machine is defined in the Payments domain documentation.

---

# 16. Unknown Payment Outcome

The system must explicitly handle:

```text id="6qfl7j"
Provider request sent
        ↓
Network failure
        ↓
Application does not know whether payment succeeded
```

The system must not automatically assume:

```text id="n1kq40"
network error = payment failed
```

Instead, the payment may enter an unknown/reconciliation state.

A subsequent provider lookup or webhook can establish the final state.

This is a critical financial correctness rule.

---

# 17. Order Creation Transaction

Order creation must be atomic from the internal database perspective.

At minimum:

```text id="n3p2y1"
BEGIN

create order
create order items
create order address snapshots
create order status history
associate payment state
apply required inventory changes
record required internal events

COMMIT
```

A partially created order must never appear as a completed transaction.

---

# 18. Order State Transition Transaction

Order state transitions should be atomic.

Example:

```text id="g7mlf9"
BEGIN

load current order state
verify valid transition
update order status
create order status history

COMMIT
```

The current state and history record must remain consistent.

---

# 19. Discount Usage Transaction

If a discount has usage limits, usage must be updated safely.

A naive workflow:

```text id="3j3k8d"
COUNT existing usages
        ↓
if count < limit
        ↓
create usage
```

is unsafe under concurrency.

Two requests may both observe:

```text id="v6k4y8"
usage = 9
limit = 10
```

and both create usage records.

The transaction strategy must therefore use an appropriate combination of:

- row locking
- atomic updates
- unique constraints
- transaction isolation
- idempotency

The exact mechanism belongs to the Discounts implementation.

---

# 20. Idempotency Transactions

Idempotency records must be created atomically with the operation they protect where appropriate.

Example:

```text id="k6k9qz"
BEGIN

insert idempotency record

if duplicate:
    return previously stored result

perform business operation

store operation result

COMMIT
```

The database uniqueness constraint provides the final protection against duplicate keys.

The application must also validate that retries using the same key represent the same logical request.

---

# 21. Webhook Processing Transaction

Webhook handling should generally follow:

```text id="zq6zbr"
Receive webhook
      ↓
Verify signature
      ↓
Validate payload
      ↓
BEGIN
      ↓
Register/check event ID
      ↓
Apply internal state change
      ↓
Record processing result
      ↓
COMMIT
```

If the event was already successfully processed:

```text id="xk8x0z"
return success
```

without repeating the business operation.

---

# 22. Webhook External Side Effects

A webhook transaction should not perform unnecessary network operations inside the database transaction.

For example:

```text id="c1pqyn"
Webhook
   ↓
BEGIN
   ↓
Update payment
   ↓
Send email
   ↓
COMMIT
```

is undesirable.

If email delivery fails, the database transaction may roll back even though the payment state was already successfully determined.

Instead:

```text id="v2s6m8"
Webhook
   ↓
BEGIN
   ↓
Update payment
Record notification event/job
   ↓
COMMIT
   ↓
Worker sends email
```

This separates transactional truth from secondary effects.

---

# 23. Event/Outbox Transaction

When a business change must reliably trigger asynchronous work, the database may record an event/outbox entry in the same transaction.

Example:

```text id="i5x3ph"
BEGIN

update order
create order history
create outbox event

COMMIT
```

The worker later processes the event.

This prevents the failure scenario:

```text id="f8mbi4"
Order committed
Event publication failed
```

where the business state exists but the secondary action is lost.

The Demo implementation may use a PostgreSQL-backed mechanism rather than a dedicated message broker.

---

# 24. Background Job Transactions

A worker job should protect state transitions.

Example:

```text id="a2zj6s"
BEGIN

claim job
update attempt/status

COMMIT
```

The actual business operation may use another transaction depending on the job.

For a job that performs one atomic business operation:

```text id="y4n4z0"
BEGIN

execute business operation
mark job completed

COMMIT
```

This prevents a successful operation from being marked as failed because the completion state was not persisted.

---

# 25. Job Failure

If a job fails:

```text id="h3f4v5"
BEGIN

record failure
increment attempt count
schedule retry

COMMIT
```

The retry mechanism must distinguish:

- transient failures
- permanent failures
- unknown outcomes

Business operations themselves must remain idempotent.

---

# 26. Transaction Isolation

PostgreSQL's default isolation level may be sufficient for many Demo operations.

The platform should not increase isolation globally without a concrete requirement.

Isolation should be selected according to the operation.

Typical strategies include:

- Read Committed for ordinary operations
- Row-level locks for inventory/concurrency-sensitive workflows
- Serializable transactions only where business correctness requires stronger guarantees

The choice must be documented per operation when it materially affects correctness.

---

# 27. Row-Level Locking

Row-level locks should be used when concurrent operations could otherwise violate a business invariant.

Examples:

```text id="eq3vst"
Inventory quantity
Discount usage counter
Payment state transition
Order state transition
Job claiming
```

Locks should be:

- narrowly scoped
- acquired in a consistent order
- held for as short a period as possible

Long-running transactions increase contention and reduce system throughput.

---

# 28. Deadlock Prevention

Cross-row or cross-table transactions should acquire locks in a predictable order.

For example, if an operation needs:

```text id="eoq2jc"
Product A
Product B
```

different code paths should not lock them in opposite orders.

Where practical:

```text id="zj8r3m"
sort IDs
    ↓
acquire locks consistently
```

The application should also be prepared to retry transactions that fail because of transient database concurrency errors.

---

# 29. Retry Strategy

A database transaction may fail due to:

- serialization conflicts
- deadlocks
- temporary connection failures
- transient database errors

Retryable transactions should:

1. Roll back completely.
2. Recreate the transaction.
3. Re-read required state.
4. Re-run business logic.
5. Commit again.

The application must never continue using partially completed state from the failed transaction.

---

# 30. Transaction and Validation Timing

Validation should occur at the correct boundary.

Validation that cannot become invalid concurrently may occur before the transaction.

Validation that depends on mutable state must occur inside the transaction.

Example:

```text id="2uwg7c"
"Is inventory >= requested quantity?"
```

must be evaluated against transactionally protected state.

A validation performed outside the transaction may become stale before the update occurs.

---

# 31. Database Constraints as Final Protection

Application code should validate business rules.

The database should enforce invariants that can be expressed structurally.

Examples:

```text id="q3i4g7"
NOT NULL
FOREIGN KEY
UNIQUE
CHECK
```

This creates multiple layers of protection.

Example:

```text id="1q5u9j"
Application:
    "SKU must be unique"

Database:
    UNIQUE(store_id, sku)
```

If a race occurs, PostgreSQL remains the final integrity barrier.

---

# 32. Transaction and Module Boundaries

A transaction may span multiple business modules when one business operation requires atomic changes.

For example:

```text id="y50x3n"
Checkout
   ├── Inventory
   ├── Payments
   └── Orders
```

This does not mean the modules share ownership.

Each module still owns:

- its entities
- its rules
- its repositories
- its state transitions

The Checkout application service coordinates the operation.

---

# 33. Cross-Module Transactions

Cross-module transactions should be used selectively.

Valid example:

```text id="0ibkz5"
Checkout completion
    ↓
Inventory update
    ↓
Order creation
```

Invalid pattern:

```text id="e2u7d9"
Every API request
    ↓
Open giant transaction
    ↓
Touch every module
```

Transactions should represent real business atomicity, not become a substitute for architectural boundaries.

---

# 34. External API Calls and Transactions

Avoid:

```text id="8hszjw"
BEGIN
    call payment provider
    call email provider
    call object storage
    update database
COMMIT
```

Problems include:

- long locks
- transaction timeouts
- external latency
- provider failures
- connection exhaustion
- unpredictable rollback behavior

Prefer:

```text id="4uxo7q"
Prepare internal state
      ↓
External operation
      ↓
Short database transaction
      ↓
Persist result
```

or:

```text id="ndkr8w"
Database transaction
      ↓
Persist pending operation/event
      ↓
Commit
      ↓
Worker performs external operation
```

depending on the workflow.

---

# 35. Checkout and Payment Coordination

Checkout must distinguish between:

```text id="1n6g7u"
Internal transaction state
```

and:

```text id="k9j4o6"
External payment state
```

A robust sequence may be:

```text id="m5x8d1"
1. Validate checkout
2. Establish idempotent payment operation
3. Request payment provider operation
4. Receive result or unknown outcome
5. Persist payment state
6. Complete internal order workflow
7. Emit secondary events
```

The exact ordering depends on the payment provider and business rules.

The critical rule is that a provider charge must never be assumed reversible merely because a PostgreSQL transaction rolls back.

---

# 36. Order and Payment Consistency

The platform must define valid combinations of order and payment states.

Examples:

```text id="84owic"
Order: PENDING
Payment: PENDING

Order: CONFIRMED
Payment: SUCCEEDED

Order: CANCELLED
Payment: FAILED
```

Invalid combinations must be rejected or reconciled.

The Payments and Orders modules must not independently invent conflicting interpretations of payment success.

---

# 37. Transactional State Machines

State transitions must be validated against the current state.

Example:

```text id="i6x5k0"
PENDING
   ↓
CONFIRMED
   ↓
FULFILLED
```

A concurrent request must not perform:

```text id="r43m1n"
FULFILLED → PENDING
```

unless explicitly permitted.

The state transition and history record should be committed together.

Detailed state machines are defined separately in:

```text
docs/domain/state-machines.md
```

---

# 38. Read Transactions

Not every read requires an explicit application-managed transaction.

Ordinary reads can generally use PostgreSQL's normal transaction behavior.

Explicit read transactions may be required when:

- multiple reads must observe the same consistent state
- rows need to be locked
- a calculation depends on a stable snapshot
- a read is part of a read-modify-write operation

The system should avoid wrapping ordinary API reads in unnecessary long-lived transactions.

---

# 39. Pagination Transactions

Large list queries should not hold long transactions unnecessarily.

For example:

```text id="0h7k9v"
GET /orders?page=1
```

should normally execute a bounded query and release the database connection promptly.

Cursor pagination may be preferred later for large datasets.

The Demo implementation should choose pagination based on actual requirements rather than introducing complexity without need.

---

# 40. Transaction Timeouts

Transactions should not remain open indefinitely.

The system should use reasonable:

- query timeouts
- transaction timeouts
- connection timeouts

especially for production environments.

Long-running business workflows should be modeled as state machines or background jobs rather than one giant database transaction.

---

# 41. Failure Scenarios

Transaction design must handle cases such as:

### Database failure

```text
BEGIN
    changes
    database failure
ROLLBACK
```

No partial internal state should remain.

### Application crash

```text
BEGIN
    changes
    process crashes
```

PostgreSQL should roll back the uncommitted transaction.

### External provider failure

The internal system must preserve an explicit payment/integration state rather than silently assuming success or failure.

### Duplicate request

Idempotency must prevent duplicate financial/business effects.

### Concurrent request

Locks, constraints, atomic updates, or isolation must prevent invalid state.

---

# 42. Transaction Observability

Important transactional operations should expose enough information for debugging.

Useful metadata includes:

- request ID
- correlation ID
- operation ID
- tenant/store ID
- entity ID
- transaction outcome
- retry count
- failure category

Sensitive information must not be logged.

Database errors should be mapped to safe application errors.

---

# 43. Testing Transaction Behavior

Critical transaction behavior must be integration-tested against PostgreSQL.

Tests should cover:

### Inventory

- concurrent purchases
- insufficient inventory
- reservation/release
- duplicate operations

### Orders

- atomic creation
- state transitions
- history consistency

### Payments

- duplicate requests
- failed attempts
- provider retries
- unknown outcomes
- webhook duplication

### Discounts

- usage limits
- concurrent redemption

### Jobs

- duplicate execution
- failed execution
- retry behavior

Unit tests alone are insufficient for these behaviors.

---

# 44. Demo Transaction Strategy

The Demo platform should use:

```text id="8z7v3n"
PostgreSQL transactions
+
row-level locking where required
+
database constraints
+
idempotency
+
application-level state machines
+
PostgreSQL-backed event/job mechanisms where appropriate
```

It does not require:

- distributed transaction coordinators
- two-phase commit
- distributed databases
- event-sourcing for all domains
- complex saga infrastructure

These would add infrastructure complexity without solving a demonstrated Demo requirement.

---

# 45. Demo-to-V1 Evolution

As the platform scales, transaction strategy may evolve to include:

- stronger connection pooling
- read replicas for non-transactional reads
- queue-backed workflows
- outbox processing
- distributed workflow orchestration
- service-specific transaction boundaries
- reconciliation systems
- partitioned historical tables

However, the fundamental rule remains:

```text id="l2g0ma"
PostgreSQL remains authoritative for transactional business state
until a deliberate architecture decision changes that model.
```

---

# 46. Transaction Anti-Patterns

Avoid:

### Giant transactions

One transaction spanning an entire user journey.

### External calls inside long transactions

Payment/email/storage calls while holding database locks.

### Check-then-act without concurrency protection

Especially for inventory and discount limits.

### Application-only uniqueness

Relying entirely on `SELECT` before `INSERT`.

### Retrying without idempotency

A retry may repeat a business effect.

### Treating rollback as external rollback

A database rollback cannot undo a provider-side payment.

### Holding transactions across user interaction

Never keep a database transaction open while waiting for a browser or user.

### Hidden transactions

Repositories silently opening independent transactions that break a larger business operation.

---

# 47. Transaction Invariants

The following must remain true:

1. Atomic business operations commit all required internal state changes together.
2. Failed transactions leave no partial internal state.
3. Inventory modifications are concurrency-safe.
4. Order creation is atomic.
5. Order state and status history remain consistent.
6. Payment operations are retry-safe.
7. Duplicate webhooks do not duplicate business effects.
8. Discount usage limits cannot be bypassed through races.
9. Database constraints provide final integrity protection.
10. External APIs are never treated as participants in PostgreSQL transactions.
11. Long-running external operations do not hold database locks unnecessarily.
12. Cross-module transactions preserve module ownership.
13. Retryable transaction failures re-read current state.
14. Historical records remain internally consistent.
15. Transaction boundaries correspond to actual business atomicity.

---

# 48. Definition of Done

The transaction strategy is complete when:

- Critical transactional operations are identified.
- Transaction ownership is defined.
- Checkout transaction behavior is documented.
- Inventory concurrency behavior is documented.
- Order creation and transitions are documented.
- Payment/external API boundaries are documented.
- Webhook transactions are documented.
- Idempotency requirements are defined.
- Background job transaction behavior is defined.
- Isolation and locking principles are defined.
- Failure and retry behavior is defined.
- Transaction testing requirements are defined.
- Demo infrastructure remains intentionally simple.