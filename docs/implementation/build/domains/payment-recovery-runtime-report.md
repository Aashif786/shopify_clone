# Payment Recovery Runtime: Worker Integration Report

## 1. Executive Summary

This report documents the operational integration of the payment and webhook recovery subsystems into the Shopify Clone background worker runtime (`apps/worker`).

By connecting the previously built `PaymentRecoveryService` and `WebhookRecoveryService` into scheduled background jobs within `apps/worker`, abandoned transactions and unhandled webhooks are automatically detected, reclaimed, and driven to completion without manual intervention.

All requirements have been met and verified:
- **Payment Recovery Job (`PaymentRecoveryJob`):** Reclaims orphaned captured payments (where order creation or checkout completion failed) and reconciles ambiguous payment states with the provider.
- **Webhook Recovery Job (`WebhookRecoveryJob`):** Sweeps and reclaims webhook events abandoned in `PROCESSING` past their lease expiration window using PostgreSQL row-level locks (`SELECT ... FOR UPDATE`).
- **Worker Runtime & Scheduler (`PaymentRecoveryScheduler`):** Periodically runs both jobs, prevents overlapping ticks within the worker process, preserves cross-process concurrency safety via database row locks, and supports clean shutdown.
- **Worker Entry Point (`apps/worker/src/index.ts`):** Automatically initializes the database, configures the recovery scheduler, starts periodic execution, and hooks process signals (`SIGINT`, `SIGTERM`) for graceful teardown.

---

## 2. Files Changed and Responsibilities

| File | Subsystem | Responsibility |
| --- | --- | --- |
| `packages/config/src/index.ts` | Configuration | Added `PaymentRecoveryConfig` and updated `WorkerConfig` with safe validation defaults for recovery polling, batch size, and lease timeouts. |
| `.env.example` | Configuration Documentation | Documented worker recovery environment variables (`PAYMENT_RECOVERY_ENABLED`, `PAYMENT_RECOVERY_POLL_INTERVAL`, `PAYMENT_RECOVERY_BATCH_SIZE`, `PAYMENT_WEBHOOK_LEASE_TIMEOUT`). |
| `apps/worker/package.json` | Dependencies | Added `@shopify-clone/payments` workspace dependency. |
| `apps/worker/src/jobs/payments/payment-recovery-job.ts` | Worker Job | Implements `PaymentRecoveryJob`, querying orphaned captured payments and reconciling ambiguous payment attempts. |
| `apps/worker/src/jobs/payments/webhook-recovery-job.ts` | Worker Job | Implements `WebhookRecoveryJob`, reclaiming expired `PROCESSING` webhook events. |
| `apps/worker/src/schedulers/payment-recovery-scheduler.ts` | Worker Scheduler | Coordinates periodic execution, prevents overlapping ticks, logs structured execution metrics, and handles graceful stop. |
| `apps/worker/src/index.ts` | Worker Entrypoint | Boots database, instantiates jobs and scheduler, starts periodic polling, and registers signal handlers for graceful termination. |
| `tests/worker/payment-recovery-job.test.ts` | Worker Test Suite | 5 tests verifying orphaned capture recovery, idempotent deduplication, failure handling, provider reconciliation, and batch limit enforcement. |
| `tests/worker/webhook-recovery-job.test.ts` | Worker Test Suite | 5 tests verifying expired lease reclamation, skipping completed/active events, concurrent recovery safety, and failure tracking. |
| `tests/integration/payment-recovery-runtime.test.ts` | Runtime Integration | 4 tests verifying worker lifecycle, scheduler startup, overlap prevention, end-to-end recovery execution, and clean shutdown. |

---

## 3. Actual Worker Registration and Execution Path

### Boot Sequence

```
1. process.env / configuration loaded via getServerConfig()
2. database pool initialized & health checked (createDatabase())
3. Optional Razorpay provider created if credentials exist
4. PaymentRecoveryJob & WebhookRecoveryJob instantiated
5. PaymentRecoveryScheduler instantiated with database & configuration
6. scheduler.start():
   ├── Sets up recurring setInterval timer (pollIntervalMs, default 10s)
   └── Triggers initial asynchronous tick()
7. Standalone runtime hooks process.once("SIGINT") & process.once("SIGTERM")
```

### Execution Cycle

On each tick (or manual `runNow()` invocation):
1. **Overlap Guard:** The scheduler checks `isRunning`. If a previous cycle is still in flight (e.g. prolonged database or network operations), the tick immediately skips and logs without stacking concurrency.
2. **Webhook Recovery Job:**
   - Invokes `WebhookRecoveryService.recoverAbandonedEvents(database, { batchSize, leaseTimeoutMs })`.
   - Reclaims events in `PROCESSING` whose `processed_at` timestamp is older than `Date.now() - leaseTimeoutMs`.
   - Re-applies business effects through `PaymentWebhookProcessor` inside a transaction.
   - If payment was captured, triggers `completePurchaseWorkflow`.
3. **Payment Recovery Job:**
   - Invokes `PaymentRecoveryService.recoverOrphanedCapturedPayments(database, { limit: batchSize })`.
   - Identifies payments in `CAPTURED` status where `order_id IS NULL`.
   - Invokes `PaymentOrderIntegration.completePurchaseWorkflow` to idempotently create the order from trusted checkout snapshot and mark checkout `COMPLETED`.
   - Invokes `PaymentRecoveryService.reconcileAmbiguousPayments(database, { limit: batchSize })` for attempts in `REQUIRES_RECONCILIATION`.
4. **Structured Logging:** Emits JSON log payload with execution summary, durations, and recovery counts.
5. **State Reset:** Sets `isRunning = false` and clears `inFlightPromise`.

---

## 4. Payment Recovery Behavior

### Orphaned Captured Payments
When a payment was authoritatively captured by Razorpay, but the server or worker crashed before creating the order, the payment remains in `CAPTURED` status with `order_id IS NULL`.
- `PaymentRecoveryJob` scans these records using `paymentRepo.findCapturedWithoutOrder(client, limit)`.
- Re-executes `PaymentOrderIntegration.completePurchaseWorkflow`.
- Guarantees:
  - **No duplicate payment capture:** Does not touch the payment gateway or attempt to recapture funds.
  - **Single order creation:** Uses the trusted checkout snapshot and PostgreSQL unique constraint `orders_store_checkout_idx` to prevent duplicate orders.
  - **Checkout completion:** Atomically finalizes the checkout to `COMPLETED` and links `payments.order_id`.

### Ambiguous Payment States
When an attempt entered `REQUIRES_RECONCILIATION` (e.g. provider network timeout during order creation or amount discrepancy):
- If Razorpay credentials are configured, queries the gateway using `getPayment(provider_payment_id)` or `findOrderByReceipt(attemptId)`.
- If captured at the provider, marks local payment `CAPTURED` and triggers order creation.
- If failed at the provider, marks local payment `FAILED`.
- If provider credentials are not configured or ambiguous state cannot be safely determined, leaves the record in `REQUIRES_RECONCILIATION` for manual operations, avoiding speculative state changes.

---

## 5. Webhook Recovery Behavior

### Lease Mechanism & Crash Reclamation
- When an event is claimed into `PROCESSING`, `processed_at` is set to `NOW()`.
- If a worker crashes mid-flight, the record remains in `PROCESSING`.
- `WebhookRecoveryJob` queries events where `status = 'PROCESSING' AND (processed_at IS NULL OR processed_at <= cutoff)`.
- Inside a transaction, acquires a row lock (`SELECT ... FOR UPDATE`).
- Verifies that `processed_at` is still expired (guards against race conditions).
- Renews lease with `processed_at = NOW()` and re-processes the event payload through `PaymentWebhookProcessor`.
- Upon successful capture, invokes `completePurchaseWorkflow`.
- Terminal statuses (`PROCESSED` or `IGNORED`) are never reclaimed.

---

## 6. Scheduling, Locking, and Overlap Prevention

### In-Process Overlap Prevention
In `PaymentRecoveryScheduler`:
```ts
if (this.isRunning) {
  console.log("[PaymentRecoveryScheduler] Prior recovery run in progress; skipping tick to prevent overlap");
  return null;
}
```
A boolean guard and `inFlightPromise` guarantee that tick executions do not overlap within the single worker process.

### Cross-Process Concurrency Safety
In multi-worker deployments (e.g., multiple container replicas):
- Webhook recovery uses row-level locking (`SELECT * FROM payment_webhook_events WHERE id = $1 FOR UPDATE`).
- Payment and checkout operations use `SELECT ... FOR UPDATE` row locks on checkouts and payments.
- Order creation relies on PostgreSQL unique constraint `orders_store_checkout_idx`.
- If two worker processes concurrently attempt recovery on the same checkout or webhook, one acquires the lock and finishes the transition, while the other discovers the completed state idempotently and exits cleanly.

### Graceful Shutdown
- `stop()` cancels the `setInterval` timer.
- Sets `isStopping = true` to reject new incoming ticks.
- If a recovery cycle is currently executing, `stop()` awaits `inFlightPromise` to allow the in-flight database transactions to commit cleanly before closing the database pool.

---

## 7. Configuration and Deployment Requirements

### Environment Variables

| Variable | Type | Default | Description |
| --- | --- | --- | --- |
| `PAYMENT_RECOVERY_ENABLED` | boolean | `true` | Enables or disables payment recovery jobs in the worker runtime. |
| `PAYMENT_RECOVERY_POLL_INTERVAL` | integer (ms) | `10000` | Frequency of recovery execution cycles (falls back to `JOB_POLL_INTERVAL`). |
| `PAYMENT_RECOVERY_BATCH_SIZE` | integer | `50` | Maximum number of records processed per recovery cycle (bounded 1-500). |
| `PAYMENT_WEBHOOK_LEASE_TIMEOUT` | integer (ms) | `60000` | Minimum duration before an in-progress webhook is declared abandoned (min 5000ms). |
| `RAZORPAY_KEY_ID` | string | `undefined` | Optional Razorpay API key ID for ambiguous payment reconciliation. |
| `RAZORPAY_KEY_SECRET` | string | `undefined` | Optional Razorpay API key secret. |

All settings have safe defaults. If optional recovery variables are omitted, the worker boots and operates normally.

---

## 8. Observability and Failure Handling

### Structured Logging
Each recovery execution outputs a structured JSON log message:
```json
{
  "tag": "PAYMENT_RECOVERY_CYCLE_COMPLETED",
  "durationMs": 141,
  "paymentRecovery": {
    "orphanedRecovered": 1,
    "orphanedFailed": 0,
    "ambiguousReconciled": 0,
    "ambiguousFailed": 0,
    "success": true
  },
  "webhookRecovery": {
    "recovered": 0,
    "failed": 0,
    "success": true
  }
}
```

### Safety & Privacy Invariants
- No secrets, customer addresses, card details, or raw webhook bodies are logged.
- Failed items increment error counters and record error messages on the database event/attempt row without crashing the scheduler loop.

---

## 9. Test and Validation Results

### Focused Test Suites Executed

1. **Payment Recovery Job Tests (`tests/worker/payment-recovery-job.test.ts`):**
   - Recovers orphaned captured payment awaiting order creation.
   - Skips already completed workflows idempotently.
   - Handles transient failure gracefully without crashing.
   - Reconciles ambiguous payments using configured provider.
   - Respects batch size limits.
   - **Result:** **5/5 PASSED** (8.41s).

2. **Webhook Recovery Job Tests (`tests/worker/webhook-recovery-job.test.ts`):**
   - Reclaims abandoned `PROCESSING` events past lease timeout and finalizes purchase.
   - Does not reprocess completed events (`PROCESSED`/`IGNORED`).
   - Respects active leases within lease window.
   - Handles concurrent recovery attempts safely without duplicate business effects.
   - Records processing failures visibly and allows retry.
   - **Result:** **5/5 PASSED** (7.81s).

3. **Runtime Integration Tests (`tests/integration/payment-recovery-runtime.test.ts`):**
   - Starts worker runtime, registers recovery jobs, and executes recovery cycle.
   - Prevents overlapping execution within the same process.
   - Recovers orphaned payments and webhooks automatically across end-to-end runtime cycle.
   - Handles shutdown cleanly by awaiting in-flight executions and rejecting new ticks.
   - **Result:** **4/4 PASSED** (6.06s).

4. **Combined Regression Suite (Worker + Payments + Webhooks + Workflow):**
   ```bash
   pnpm test tests/worker/payment-recovery-job.test.ts \
             tests/worker/webhook-recovery-job.test.ts \
             tests/integration/payment-recovery-runtime.test.ts \
             tests/payments/payment-recovery.test.ts \
             tests/payments/webhook-recovery.test.ts \
             tests/integration/payment-checkout-order.workflow.test.ts
   ```
   - **Result:** **26/26 PASSED** in 22.00s.

### Typecheck Results
- `pnpm --filter @shopify-clone/worker typecheck`: **PASSED** (`tsc --noEmit` exited 0).
- `pnpm --filter @shopify-clone/config run build`: **PASSED** (`tsc` exited 0).

### Lint Results
- `npx eslint "apps/worker/src/**/*.ts" "tests/worker/**/*.ts" "tests/integration/payment-recovery-runtime.test.ts"`: **PASSED** (0 errors, 0 warnings).

### Diff Check
- `git diff --check`: **PASSED** (0 whitespace/formatting conflicts).

---

## 10. Operational Limitations & Scope Restrictions

1. **Inventory Restoration on Payment Failure / Cancellation (Out of Scope):**
   - Release of reserved stock upon payment expiration or cancellation remains a separate deferred cross-domain workflow.
2. **Automated Refund on Order Cancellation (Out of Scope):**
   - Order cancellation does not automatically trigger payment gateway refund processing; refund operations remain managed by `RefundService`.
3. **Multi-Tenant Sharding:**
   - Recovery queries scan the shared database within standard tenant-partitioned tables. Bounded batch limits prevent database resource exhaustion.
