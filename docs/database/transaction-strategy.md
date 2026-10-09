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

# 14. External Payment Transactions & Distributed Consistency

Payment processing introduces a distributed consistency boundary between PostgreSQL and external payment providers (Razorpay).

```text id="q6j3i0"
Local Database Transaction (PostgreSQL)
               ≠
External Gateway API (Razorpay HTTPS)
```

PostgreSQL cannot atomically commit or rollback a charge executed on Razorpay. Therefore, treating a payment as a single monolithic database transaction is architecturally incorrect and dangerous.

### Distributed Failure Boundaries

1. **Network Timeout on Provider Call:** The gateway may have successfully debited the customer, but the local caller received a socket timeout. Rolling back the local transaction and marking the payment `FAILED` would lead to double charging if the customer retries.
2. **Process Crash After Provider Call:** If the server crashes after Razorpay returns success but before PostgreSQL commits, the provider charge exists without an internal record.
3. **Crash Between Payment Capture and Order Creation:** If payment captures successfully but the server crashes before creating the order, the customer is charged without an order being placed.

To guarantee financial correctness, the platform requires:
- Durable database-backed idempotency records (`idempotency_records`).
- Separate local transaction boundaries before and after provider API calls.
- Strict isolation of external network calls outside open database transactions.
- Webhook signature verification and durable deduplication.
- Durable payment attempts and aggregate state machines (`CAPTURED`, `REQUIRES_RECONCILIATION`).
- Idempotent order creation and automated background recovery.

---

# 15. The Canonical 12-Step Payment Transaction & Coordination Sequence

The platform executes payment initiation, provider execution, webhook processing, and checkout completion across explicit transactional phases:

```text
Phase 1: Local Reservation (DB Transaction 1)
  1. Validate store, checkout, server-calculated amount, currency, and request idempotency.
  2. Transactionally insert/reserve Payment (status 'CREATED' or 'PENDING') and PaymentAttempt (status 'INITIATED'); record idempotency reservation.
  3. Commit DB Transaction 1 (release all local database locks).

Phase 2: External Gateway Interaction (Outside DB Transaction)
  4. Dispatch HTTP call to Razorpay (e.g. POST /v1/orders) outside the database transaction.

Phase 3: Dispatch Outcome Persistence (DB Transaction 2)
  5. In a new transaction, persist provider order ID ('order_xxx') into PaymentAttempt and update Payment to 'PENDING'. If the network call timed out, transition to 'REQUIRES_RECONCILIATION'. Commit DB Transaction 2.

Phase 4: Customer Authentication & Webhook Receipt (External Boundary)
  6. Customer completes payment in Razorpay modal. Incoming webhook (or callback) received.
     Verify webhook authenticity (HMAC-SHA256 on raw request body bytes using Webhook Secret) BEFORE opening any database transaction.

Phase 5: Event Deduplication & Payment State Settlement (DB Transaction 3)
  7. Deduplicate event durably by inserting into payment_webhook_events (UNIQUE provider_event_id). If already processed, return HTTP 200 immediately.
  8. Lock payment row (SELECT * FROM payments WHERE id = $1 AND store_id = $2 FOR UPDATE).
     Validate state transition (ensure not regressing from a more advanced state).
     Update payment status to 'CAPTURED', record captured_amount, update payment_attempts status to 'CAPTURED'.
  9. Ensure captured payment state and webhook event PROCESSED status are committed and durable in PostgreSQL before triggering order creation. Commit DB Transaction 3.

Phase 6: Downstream Order Creation & Webhook Acknowledgement
  10. Reliably trigger checkout completion and order creation using the existing application service or a transactional outbox event.
  11. Complete checkout (transition PAYMENT_PENDING -> COMPLETED) and create the Order. Order creation is strictly idempotent, keyed on (store_id, checkout_id).
      If order creation crashes or fails, checkout remains in PAYMENT_PENDING with durable CAPTURED payment; background recovery resumes order creation.
  12. Acknowledge webhook with HTTP 200 OK only after durable persistence of event and payment state.
```

---

# 16. Ambiguous Outcomes and Reconciliation (`REQUIRES_RECONCILIATION`)

When an external provider call fails ambiguously:

```text id="6qfl7j"
Provider request sent
        ↓
Network timeout / Gateway error
        ↓
Application outcome uncertain
```

The system **MUST NOT** assume:

```text id="n1kq40"
network timeout = payment failed
```

Instead:
1. The payment / attempt transitions to `REQUIRES_RECONCILIATION`.
2. The checkout remains in `PAYMENT_PENDING` (customer sees a pending/verifying status).
3. The customer is NOT prompted to charge the card again immediately.
4. A background worker queries Razorpay (`GET /v1/payments/{payment_id}`) or waits for incoming webhooks to resolve the state definitively to `CAPTURED` or `FAILED`.


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

# 20. Database-Backed Idempotency Transactions

Financial idempotency records must be stored durably in PostgreSQL to survive process crashes and coordinate across multiple application replicas. In-memory storage is strictly prohibited for financial operations.

### Execution Pattern

```text id="k6k9qz"
BEGIN (Transaction 1)

insert into idempotency_records (store_id, scope, idempotency_key, request_hash, status)
values ($1, $2, $3, $4, 'IN_PROGRESS')
on conflict (store_id, scope, idempotency_key) do nothing;

if row not inserted:
    select status, request_hash, response_status, response_body from idempotency_records ...;
    if existing.request_hash != incoming.request_hash:
        throw IdempotencyConflictError (HTTP 409)
    if existing.status == 'COMPLETED':
        return cached response_body
    if existing.status == 'IN_PROGRESS':
        throw ConcurrentOperationError (HTTP 409 with Retry-After)

perform local database reservation
COMMIT (Transaction 1)

execute external provider operation outside transaction

BEGIN (Transaction 2)
update entity state
update idempotency_records set status = 'COMPLETED', response_status = $1, response_body = $2
COMMIT (Transaction 2)
```

The database unique constraint `UNIQUE (store_id, scope, idempotency_key)` provides the ultimate concurrent race barrier.

---

# 21. Webhook Processing Transaction

Webhook handling follows strict signature and transactional boundaries:

```text id="zq6zbr"
Receive webhook request
      ↓
Preserve raw request body bytes
      ↓
Verify HMAC-SHA256 signature with Webhook Secret
      ↓ [Invalid -> HTTP 400 Reject immediately]
BEGIN (PostgreSQL Transaction)
      ↓
Deduplicate event (INSERT INTO payment_webhook_events ON CONFLICT DO NOTHING)
      ↓
If duplicate already processed:
      COMMIT & return HTTP 200 OK
      ↓
Row-lock payment (SELECT * FROM payments WHERE id = $1 FOR UPDATE)
      ↓
Validate state transition (ensure no backward / stale mutation)
      ↓
Update payment (status = 'CAPTURED', captured_amount = payload.amount)
      ↓
Update payment_attempt (status = 'CAPTURED')
      ↓
Update webhook event (status = 'PROCESSED')
      ↓
COMMIT
      ↓
Execute idempotent order creation
      ↓
Return HTTP 200 OK to Razorpay
```

---

# 21.1 Refund Transaction Boundaries & Concurrency Protection

Refund processing must be fully protected against duplicate and concurrent requests:

```text
Step 1: Reservation Transaction (PostgreSQL)
  BEGIN
    Check idempotency_records for duplicate request
    Lock payment row: SELECT * FROM payments WHERE id = $1 AND store_id = $2 FOR UPDATE
    Validate payment.status IN ('CAPTURED', 'PARTIALLY_REFUNDED')
    Validate requested_amount <= (captured_amount - refunded_amount)
    Insert refunds record (status = 'PENDING')
  COMMIT (Lock released)

Step 2: External Refund Call (Outside Transaction)
  Call Razorpay API: POST /v1/payments/{payment_id}/refund with receipt = refund.id

Step 3: Outcome Persistence (PostgreSQL)
  BEGIN
    Lock payment row FOR UPDATE
    If Razorpay returns 'processed':
      Update refunds status = 'SUCCEEDED', provider_refund_id = res.id
      Update payment: increment refunded_amount = refunded_amount + refund.amount
      Update payment status to 'REFUNDED' (if refunded_amount == captured_amount) or 'PARTIALLY_REFUNDED'
    If Razorpay returns 'pending':
      Update refunds status = 'PENDING' (await webhook)
    If Razorpay returns failure:
      Update refunds status = 'FAILED'
    If timeout / ambiguous:
      Update refunds status = 'REQUIRES_RECONCILIATION'
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

# 35. Checkout and Payment Coordination Contract

Checkout coordinates the purchase lifecycle, while Payments owns financial transactions.

```text id="m5x8d1"
1. Checkout in OPEN state collects items, shipping, discounts, and customer identity.
2. Checkout transitions to PAYMENT_PENDING via beginPayment().
3. Payment and PaymentAttempt are created with immutable snapshot of checkout totals.
4. Razorpay order is created outside database transactions.
5. Customer pays via frontend modal; webhook / verification confirms payment.
6. Payment aggregate reaches CAPTURED status.
7. Verified CAPTURED payment triggers completeCheckout() requiring payment verification.
8. Checkout transitions PAYMENT_PENDING -> COMPLETED and creates the Order atomically.
9. If payment fails, checkout transitions PAYMENT_PENDING -> OPEN via markPaymentFailed() for retry.
```

The critical rule is that a provider charge must never be assumed reversible merely because a PostgreSQL transaction rolls back.

---

# 36. Order and Payment Consistency

The platform defines valid combinations of order and payment states:

```text id="84owic"
Order: PENDING
Payment: PENDING

Order: CONFIRMED
Payment: CAPTURED

Order: PROCESSING / DELIVERED
Payment: CAPTURED

Order: CANCELLED
Payment: FAILED or CANCELLED

Order: PARTIALLY_REFUNDED
Payment: PARTIALLY_REFUNDED

Order: CANCELLED / REFUNDED
Payment: REFUNDED
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