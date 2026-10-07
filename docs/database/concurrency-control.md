# Database Concurrency Control

## 1. Purpose

This document defines how the Demo commerce platform prevents race conditions and maintains business correctness when multiple operations execute concurrently.

Concurrency may occur through:

- Multiple customers
- Multiple browser tabs
- Merchant and customer actions occurring simultaneously
- Payment provider retries
- Duplicate webhooks
- Background worker retries
- Multiple worker instances
- API request retries
- Network-induced duplicate requests
- Concurrent inventory purchases
- Concurrent discount redemption

The objective is to ensure that concurrent operations produce the same valid business state that would have resulted from a correct sequential execution.

---

# 2. Core Principle

Concurrency correctness is a business requirement, not merely a database optimization concern.

The platform must assume that:

```text
Two requests can execute at the same time.
```

Therefore, the application must never rely on:

```text
Read
↓
Assume nothing changed
↓
Write
```

when the underlying business state can change concurrently.

Concurrency-sensitive operations must use appropriate combinations of:

- PostgreSQL transactions
- Row-level locking
- Atomic updates
- Unique constraints
- Check constraints
- Idempotency
- State validation
- Transaction isolation
- Retry handling

---

# 3. Concurrency Model

The Demo platform uses PostgreSQL as the authoritative transactional database.

The primary concurrency mechanisms are:

```text id="8f3z3d"
Application transaction
        +
Database constraints
        +
Row-level locks
        +
Atomic SQL updates
        +
Idempotency
        +
State-machine validation
```

No external cache, search engine, queue, or payment provider is authoritative for core transactional state.

---

# 4. Types of Concurrency Problems

The system must explicitly defend against:

## 4.1 Lost Updates

Two operations read the same value and one overwrites the other's change.

Example:

```text id="4a3p6f"
Inventory = 10

Request A reads 10
Request B reads 10

A writes 7
B writes 6

Expected result: 3
Actual result: 6
```

---

## 4.2 Overselling

Two customers attempt to purchase the last available unit.

```text id="g1h4fs"
Inventory = 1

Customer A → purchase 1
Customer B → purchase 1
```

Both must not succeed.

---

## 4.3 Duplicate Effects

A client retries an operation:

```text id="x3w7p8"
POST /checkout/complete

Request 1 → succeeds
Request 2 → retry
```

The system must not create two orders or charge the customer twice.

---

## 4.4 Duplicate Webhooks

A provider may deliver:

```text id="z8y3q4"
payment.succeeded
payment.succeeded
payment.succeeded
```

The business effect must occur once.

---

## 4.5 State Transition Race

Two workers attempt:

```text id="w8y2n6"
PENDING → CONFIRMED
```

at the same time.

Only one should perform the transition.

---

## 4.6 Usage Limit Race

A discount has:

```text id="e4n7s1"
Limit = 10
Current usage = 9
```

Two customers redeem simultaneously.

The system must not end with 11 successful usages.

---

# 5. General Rule: Read-Modify-Write

Any operation of the form:

```text id="4k5s3u"
READ state
↓
calculate new state
↓
WRITE state
```

must be evaluated for concurrency.

If the state can change between the read and write, the operation needs protection.

Possible solutions:

- `SELECT ... FOR UPDATE`
- atomic `UPDATE ... WHERE`
- optimistic concurrency
- unique constraint
- serializable transaction
- idempotency

The solution should match the business operation.

---

# 6. Inventory Concurrency

Inventory is the highest-priority concurrency-sensitive domain.

Consider:

```text id="w0r1l6"
available_quantity = 1
```

Two checkout requests arrive simultaneously.

A naive implementation:

```text id="i8g5o2"
SELECT available_quantity

if available_quantity >= requested:
    UPDATE inventory
```

is unsafe.

Both requests may observe the same quantity.

---

# 7. Inventory Row Locking

A straightforward Demo strategy is:

```text id="e3x1k9"
BEGIN

SELECT inventory
FOR UPDATE

validate available quantity

UPDATE inventory

COMMIT
```

The row lock ensures another transaction cannot modify the same inventory row concurrently until the transaction completes.

The transaction must remain short.

---

# 8. Atomic Inventory Update

An alternative is an atomic conditional update.

Conceptually:

```sql id="d0qf5e"
UPDATE inventory_items
SET available_quantity = available_quantity - $quantity
WHERE id = $inventory_id
  AND available_quantity >= $quantity;
```

Then verify the affected row count.

If:

```text id="q4n8f2"
rows affected = 1
```

the inventory operation succeeded.

If:

```text id="u2v6c7"
rows affected = 0
```

the operation did not have sufficient inventory or the record did not match.

This can reduce unnecessary read-modify-write races.

---

# 9. Inventory Adjustment History

Inventory quantity and its adjustment record must be updated atomically.

Correct:

```text id="0a8g2x"
BEGIN

update inventory
insert adjustment

COMMIT
```

Incorrect:

```text id="d5y1t8"
update inventory
COMMIT

insert adjustment
```

The second approach can leave quantity and history inconsistent.

---

# 10. Inventory Reservation

If reservations are used:

```text id="8p2e7m"
available_quantity
reserved_quantity
```

must be modified atomically.

Example:

```text id="0q7n4f"
BEGIN

lock inventory row

verify available quantity

available_quantity -= requested
reserved_quantity += requested

create reservation

COMMIT
```

The reservation state must correspond exactly to the quantity movement.

---

# 11. Inventory Release

Releasing a reservation must be idempotent.

Example:

```text id="z3y8v2"
Reservation = ACTIVE
```

First release:

```text id="m1x7c4"
ACTIVE → RELEASED
inventory restored
```

Second release:

```text id="n4q6p8"
RELEASED → no-op
```

It must not restore inventory twice.

---

# 12. Inventory Across Multiple Variants

A checkout may contain multiple variants.

Example:

```text id="4y8f1a"
Variant A → 2
Variant B → 1
Variant C → 4
```

If multiple inventory rows are locked, locks should be acquired in a deterministic order.

For example:

```text id="7w5c3d"
Sort inventory IDs
    ↓
Lock A
    ↓
Lock B
    ↓
Lock C
```

This reduces the likelihood of deadlocks caused by different transactions acquiring the same locks in different orders.

---

# 13. Cart Concurrency

Customers may modify the same cart from:

- multiple tabs
- multiple devices
- repeated requests

Cart operations should therefore be atomic at the individual operation level.

For example:

```text id="f8y2z3"
UPDATE cart_item
SET quantity = ...
WHERE cart_id = ...
  AND variant_id = ...
```

The exact behavior for simultaneous quantity updates must be defined.

The system should not silently lose updates.

---

# 14. Cart Item Uniqueness

A cart should generally contain one line for a given variant.

Therefore:

```text id="j7m3k5"
UNIQUE(cart_id, variant_id)
```

can prevent duplicate cart-item rows.

If two requests attempt to add the same variant concurrently:

```text id="u5v8q1"
Request A → INSERT
Request B → INSERT
```

the database constraint prevents two separate rows.

The application can then retry/update the existing row as appropriate.

---

# 15. Checkout Concurrency

Checkout completion is particularly sensitive.

Possible concurrent requests:

```text id="4s8n1x"
Browser double-click
Browser retry
Mobile + desktop
Network retry
Worker retry
```

The platform must ensure that one logical checkout cannot produce multiple successful orders.

---

# 16. Checkout Idempotency

Checkout completion should use an idempotency mechanism.

Conceptually:

```text id="z6k2p9"
store_id
operation_type
idempotency_key
request_hash
result_reference
```

A duplicate request with the same valid key should return the original operation result rather than executing the purchase again.

---

# 17. Idempotency Key Scope

An idempotency key must be scoped appropriately.

A generic global key:

```text id="f1z5n0"
ABC123
```

should not accidentally collide between unrelated stores or operation types.

A safer conceptual scope is:

```text id="9j7s4k"
(store_id, operation_type, idempotency_key)
```

The final scope depends on the API contract.

---

# 18. Idempotency Request Consistency

Reusing an idempotency key with a different request must not silently execute the new request.

Example:

```text id="3x6v2q"
Request A:
key = ABC
amount = 1000

Request B:
key = ABC
amount = 5000
```

The system must reject the second request because the key represents a different operation payload.

A request hash may be stored to detect this.

---

# 19. Order Creation Race

Order creation must prevent:

```text id="4n9k7w"
Checkout
   ↓
Order A

same Checkout
   ↓
Order B
```

Possible protections include:

- idempotency
- unique checkout completion constraint
- checkout state transition
- transactional locking

A strong design can combine these protections.

---

# 20. Checkout State Locking

A checkout completion operation may:

```text id="m2x6q8"
BEGIN

SELECT checkout
FOR UPDATE

verify status

complete checkout

COMMIT
```

The lock ensures concurrent completion attempts serialize for the same checkout.

The second request then observes the updated state.

---

# 21. Order State Concurrency

Order state transitions must be atomic.

Example:

```text id="w4p8s2"
PENDING → CONFIRMED
```

Two requests attempting the same transition should not produce duplicate history or conflicting state.

A transaction may:

```text id="d7y1k3"
lock order
↓
verify current state
↓
perform transition
↓
create history
↓
commit
```

---

# 22. Optimistic State Transition

Some transitions can use conditional updates.

Example:

```sql id="m5c9v3"
UPDATE orders
SET status = 'CONFIRMED'
WHERE id = $id
  AND status = 'PENDING';
```

Then:

```text id="k2f7s1"
rows affected = 1
```

means the transition succeeded.

```text id="p6v3d8"
rows affected = 0
```

means another operation changed the state first or the transition was invalid.

This approach can avoid explicit row locking where appropriate.

---

# 23. Payment Concurrency

Payments may receive state changes from:

- checkout requests
- provider responses
- webhooks
- reconciliation jobs
- retries

Therefore payment state transitions must be protected.

The system must not allow:

```text id="h8y4q2"
SUCCEEDED → FAILED
```

unless the payment state machine explicitly allows that transition.

---

# 24. Payment Provider References

Provider references should be protected by uniqueness constraints where the provider guarantees uniqueness.

Example:

```text id="a7c3m9"
UNIQUE(provider, provider_reference)
```

This prevents duplicate internal payment records from being created for the same external payment.

---

# 25. Payment Webhook Concurrency

A payment provider may deliver the same webhook simultaneously through retries.

Example:

```text id="t5x8q4"
Worker A → payment.succeeded
Worker B → payment.succeeded
```

Both workers may attempt to update the same payment.

Protection should include:

```text id="v9m2k7"
unique provider event ID
+
transactional state transition
```

Only one successful business transition should occur.

---

# 26. Webhook Event Uniqueness

Webhook events should use a uniqueness constraint such as:

```text id="p4n7r1"
UNIQUE(provider, provider_event_id)
```

When the same event arrives again:

```text id="c8w3y6"
INSERT
    ↓
duplicate constraint
    ↓
recognize already-processed event
```

The exact duplicate-handling behavior must distinguish:

- already processed
- currently processing
- previously failed

---

# 27. Webhook State Transition

A webhook handler should not simply do:

```text id="r6k1v9"
payment.status = provider.status
```

It should:

1. Verify the webhook.
2. Identify the internal entity.
3. Load current state.
4. Validate the transition.
5. Apply the transition atomically.
6. Record the event/result.
7. Commit.

This prevents stale or out-of-order provider events from corrupting state.

---

# 28. Out-of-Order Webhooks

External systems may deliver events out of order.

Example:

```text id="q8s2f4"
payment.succeeded
payment.processing
```

The system must not blindly apply the second event and move the payment backward.

Provider event timestamps, sequence numbers, or internal state-machine rules may be used where supported.

The application must define which transitions are valid.

---

# 29. Discount Concurrency

Discount limits are concurrency-sensitive.

Consider:

```text id="v4n7m2"
Limit = 1

Customer A → redeem
Customer B → redeem
```

Both requests must not succeed.

Possible approaches include:

- row-level lock on discount
- atomic usage counter
- unique usage constraint
- transaction isolation

The final implementation should prefer the simplest mechanism that correctly represents the business rule.

---

# 30. Per-Customer Discount Limits

For rules such as:

```text id="z7c2m5"
One use per customer
```

the database can provide an additional integrity barrier:

```text id="k9p4r6"
UNIQUE(discount_id, customer_id)
```

if the business rule means exactly one usage record per customer.

This prevents a race where two simultaneous requests both create usage records.

---

# 31. Background Job Concurrency

The worker may process the same logical job more than once.

Reasons include:

- worker crash
- timeout
- retry
- duplicate delivery
- multiple workers

Therefore jobs must be designed for:

```text id="h2v8s5"
at-least-once execution
```

unless the infrastructure guarantees stronger semantics.

Business operations must remain idempotent.

---

# 32. Job Claiming

A PostgreSQL-backed job queue may use row locking to claim work.

Conceptually:

```sql id="q5k1n8"
SELECT ...
FROM jobs
WHERE status = 'AVAILABLE'
  AND available_at <= NOW()
ORDER BY available_at
FOR UPDATE SKIP LOCKED
LIMIT 1;
```

The job can then be marked as processing within a transaction.

`SKIP LOCKED` allows multiple workers to claim different jobs without waiting on already-claimed rows.

The exact implementation belongs to the worker infrastructure.

---

# 33. Job Completion

A worker should not blindly mark a job complete after an unrelated failure.

The logical operation should be:

```text id="u4c8m1"
execute business operation
        ↓
persist successful result
        ↓
mark job completed
```

Where atomicity between business state and job state is required, both should participate in the same transaction.

---

# 34. Job Retry Concurrency

A failed worker may leave a job temporarily appearing as processing.

The system should use:

- lease/timeout
- heartbeat where needed
- retry timestamps
- attempt counters

to allow recovery.

The recovery mechanism must avoid two workers simultaneously believing they exclusively own the same job.

---

# 35. Customer Concurrency

Customer profile updates may occur concurrently.

For non-critical profile fields, last-write-wins may be acceptable.

For important fields such as account state or identity associations, stronger concurrency rules may be required.

The system should not apply heavyweight locking to ordinary profile edits without a business reason.

---

# 36. Store Configuration Concurrency

Merchant settings may also be edited concurrently.

For Demo, simple last-write-wins behavior may be acceptable for non-critical settings.

For security-sensitive settings, such as payment configuration or access roles, explicit authorization and stronger state handling may be required.

---

# 37. Membership Concurrency

Membership operations can race:

```text id="8x3j6q"
Admin removes Staff
Staff request arrives simultaneously
```

Authorization should be evaluated using current membership state.

A revoked membership must not remain valid merely because a previous request loaded stale authorization information.

Security-sensitive authorization should not rely on long-lived cached membership data.

---

# 38. Tenant Context Under Concurrency

Every concurrent operation must preserve its tenant context.

For example:

```text id="q4w8k3"
Worker Job
    ↓
store_id = Store A
```

The worker must never accidentally execute:

```text id="m6x2p9"
query without store scope
```

because worker concurrency makes tenant leakage particularly dangerous.

Tenant context should be explicit in job payloads where required.

---

# 39. Cache and Concurrency

If caching is introduced later:

```text id="j8q2v5"
Cache ≠ source of truth
```

Concurrent writes must still be correct if the cache is:

- stale
- unavailable
- inconsistent
- bypassed

Database state remains authoritative.

Cache invalidation must not be required for correctness of critical business operations.

---

# 40. Distributed Concurrency

The Demo platform should avoid distributed locking infrastructure unless an actual requirement exists.

Redis-based distributed locks, for example, should not be introduced merely because multiple workers exist.

PostgreSQL row locks and constraints are sufficient for many Demo workflows.

A distributed lock should only be considered when:

- the operation spans systems that cannot share a DB transaction
- PostgreSQL locking cannot represent the required coordination
- measured requirements justify additional infrastructure

---

# 41. Deadlock Prevention

Deadlocks may occur when concurrent transactions acquire locks in inconsistent orders.

Example:

```text id="2y6r8v"
Transaction A:
lock Inventory A
lock Inventory B

Transaction B:
lock Inventory B
lock Inventory A
```

Both can wait indefinitely until PostgreSQL detects the deadlock.

To reduce this risk:

1. Lock resources in deterministic order.
2. Keep transactions short.
3. Avoid unnecessary locks.
4. Avoid external network calls while holding locks.
5. Retry safe transactions after transient deadlock errors.

---

# 42. Lock Duration

Locks should be held only as long as necessary.

Bad:

```text id="x4n8q1"
BEGIN
lock inventory
call payment provider
wait 5 seconds
send email
COMMIT
```

Better:

```text id="b7m3z5"
perform external work where appropriate
        ↓
short transaction
        ↓
lock
validate
update
commit
```

Long-held locks reduce throughput and increase contention.

---

# 43. Transaction Isolation

The default PostgreSQL isolation level should be used unless a specific operation requires stronger behavior.

Possible escalation:

```text id="6y1v4q"
Read Committed
    ↓
Row locking / atomic updates
    ↓
Serializable
```

The platform should not use Serializable globally merely to avoid thinking about concurrency.

That would replace one problem with several more expensive ones.

---

# 44. Serializable Transactions

Serializable isolation may be appropriate for particularly difficult business invariants.

If used, the application must expect serialization failures.

The operation must be retried from the beginning.

Conceptually:

```text id="9f2x6m"
BEGIN SERIALIZABLE
    ↓
business operation
    ↓
serialization conflict
    ↓
ROLLBACK
    ↓
retry complete operation
```

Partial reuse of stale state is not acceptable.

---

# 45. Atomic Counters

Counters may use atomic database updates.

Example:

```sql id="6r0v5k"
UPDATE ...
SET usage_count = usage_count + 1
WHERE usage_count < usage_limit;
```

The application checks whether a row was updated.

This can be preferable to:

```text id="q7s2j8"
SELECT count
UPDATE count
```

for simple counters.

However, counters should not replace detailed usage records when auditability is required.

---

# 46. Unique Constraints as Concurrency Controls

Unique constraints are among the simplest concurrency mechanisms.

Examples:

```text id="r1m6k9"
UNIQUE(store_id, sku)
UNIQUE(store_id, code)
UNIQUE(cart_id, variant_id)
UNIQUE(provider, provider_event_id)
UNIQUE(payment_id, attempt_number)
UNIQUE(store_id, order_number)
```

Two concurrent inserts may race.

PostgreSQL resolves the race through the uniqueness constraint.

The application handles the resulting success or conflict.

---

# 47. Optimistic Concurrency

Optimistic concurrency may use:

```text id="v5k8m2"
version
updated_at
state
```

For example:

```sql id="t4n9q3"
UPDATE orders
SET status = 'CONFIRMED',
    version = version + 1
WHERE id = $id
  AND version = $expected_version;
```

If zero rows are updated, another operation changed the record first.

This is useful where explicit locking would create unnecessary contention.

The Demo platform should use optimistic concurrency only where it provides a clear benefit.

---

# 48. Pessimistic Concurrency

Pessimistic locking uses:

```sql id="f7c2m4"
SELECT ...
FOR UPDATE;
```

It is appropriate when:

- contention is expected
- a state decision must be made from current locked state
- the operation is short
- serialization is easier than conflict handling

Inventory and checkout completion are strong candidates.

---

# 49. Choosing the Mechanism

Use:

### Unique constraint

When the invariant is uniqueness.

### Atomic update

When the operation can be expressed as a conditional state change.

### Row lock

When several dependent decisions must be made from the same mutable state.

### Optimistic concurrency

When conflicts are relatively uncommon and retrying is cheap.

### Serializable isolation

When correctness requires serialization that simpler mechanisms cannot safely provide.

### Idempotency

When the same logical operation may be submitted multiple times.

These mechanisms may be combined.

---

# 50. Concurrency Matrix

| Domain | Main Risk | Primary Protection |
|---|---|---|
| Inventory | Overselling | Row lock / atomic update |
| Cart | Duplicate items | Unique constraint |
| Checkout | Duplicate completion | Idempotency + state lock |
| Discounts | Usage-limit race | Constraint / lock |
| Payments | Duplicate charge/state | Provider idempotency + internal idempotency |
| Webhooks | Duplicate delivery | Unique event ID + state transition |
| Orders | Conflicting transitions | State validation + lock/conditional update |
| Jobs | Duplicate execution | Claiming + idempotent operation |
| Memberships | Stale authorization | Current server-side authorization |
| Store settings | Lost updates | Appropriate update strategy |
| Product SKU | Duplicate SKU | Unique constraint |

---

# 51. Concurrency Testing

Concurrency behavior must be tested explicitly.

Tests should simulate:

- two purchases of the final inventory unit
- concurrent checkout completion
- duplicate payment requests
- duplicate webhooks
- concurrent discount redemption
- simultaneous order transitions
- multiple workers claiming jobs
- concurrent cart updates
- concurrent inventory adjustments

Tests should verify final database state rather than merely checking HTTP responses.

---

# 52. Failure During Concurrency

The system must remain correct if a process crashes:

```text id="x2v7q9"
after lock acquisition
before update

after update
before commit

after provider request
before database update

after database commit
before response
```

Each scenario must have a defined recovery mechanism.

In particular:

```text id="j4c8m6"
database commit
+
client timeout
```

must not cause the client retry to create a duplicate business operation.

This is one of the primary reasons idempotency exists.

---

# 53. Observability

Concurrency failures should be diagnosable.

Useful metadata:

- request ID
- operation ID
- store ID
- entity ID
- idempotency key
- transaction retry count
- deadlock/serialization retry count
- job ID
- webhook event ID

Logs must not contain sensitive payment credentials or unnecessary personal information.

---

# 54. Demo Strategy

The Demo implementation should keep concurrency infrastructure deliberately simple:

```text id="j7x4p1"
PostgreSQL
+
transactions
+
row-level locks
+
atomic updates
+
unique constraints
+
idempotency
+
worker job claiming
```

It does not require:

- distributed locking services
- Kafka
- complex workflow engines
- multi-database coordination
- distributed transactions

unless actual requirements emerge.

---

# 55. V1 Evolution

V1 may eventually introduce:

- Redis-based coordination where justified
- dedicated queues
- distributed workers
- stronger workflow orchestration
- service-level isolation
- higher-volume database strategies
- reconciliation services
- advanced optimistic concurrency mechanisms

These should solve measured scaling or reliability problems rather than hypothetical ones.

The fundamental business invariants remain unchanged.

---

# 56. Concurrency Invariants

The platform must guarantee:

1. Inventory cannot be oversold through concurrent operations.
2. Inventory history remains consistent with inventory state.
3. A logical checkout cannot create duplicate successful orders.
4. A logical payment operation cannot create duplicate financial effects.
5. Duplicate webhooks cannot repeat business effects.
6. Invalid state transitions cannot succeed through races.
7. Discount limits cannot be bypassed through concurrent redemption.
8. Cart items cannot be duplicated when uniqueness is required.
9. Multiple workers cannot simultaneously claim the same exclusive job.
10. Tenant context remains correct across concurrent requests and jobs.
11. Database constraints remain the final integrity barrier.
12. Retryable operations are idempotent.
13. Deadlocks and serialization failures are safely retryable where appropriate.
14. External provider uncertainty is represented explicitly.
15. Concurrency correctness does not depend on client behavior.

---

# 57. Definition of Done

Concurrency control is sufficiently defined when:

- Major race conditions are identified.
- Inventory protection is defined.
- Checkout idempotency is defined.
- Payment concurrency is defined.
- Webhook duplication is handled.
- Discount limits are protected.
- Order transitions are protected.
- Worker concurrency is defined.
- Locking principles are documented.
- Retry behavior is documented.
- Unique constraints are identified.
- Concurrency tests are required for critical workflows.
- Demo infrastructure remains simple while preserving correctness.