# Staging Deployment Guide & Release Gate

## 1. Purpose & Environment Scope

This document specifies the deployment architecture, configuration rules, startup sequence, and operational safeguards for the **Cal Cart Staging Environment**.

The staging environment is a release gate designed to mirror production configuration and infrastructure topology while safely executing against sandboxed external providers (e.g. Razorpay test mode). Live payment transactions and production customer card debits are strictly prohibited.

---

## 2. Infrastructure Topology

Staging operates as a modular monolith running two continuous Node.js services alongside a transactional PostgreSQL database:

```text
                             Inbound Traffic
                                    │
                                    ▼
                         Reverse Proxy / CDN (HTTPS)
                                    │
                     ┌──────────────┴──────────────┐
                     │ Port 3000                   │
                     ▼                             │
            Next.js Web Service                    │
             (@shopify-clone/web)                  │
                     │                             │
                     ├──────────────────────┐      │
                     │                      │      ▼
                     │              Standalone Worker
                     │            (@shopify-clone/worker)
                     ▼                      │
             PostgreSQL 16 Database ◄───────┘
          (Single Source of Truth, ACID)
```

### Components
1. **Web Service (`apps/web`)**: Next.js App Router application serving merchant portal, customer storefront, and public/webhook REST APIs (`/api/v1/*`).
2. **Background Worker (`apps/worker`)**: Standalone Node.js daemon executing continuous schedulers for payment reconciliation, webhook lease recovery, and order cancellation recovery.
3. **Database (`packages/db`)**: PostgreSQL 16+ database with advisory lock migration coordination and transactional row locks.

---

## 3. Environment Configuration & Secret Management

### Environment Tiering Rules (`APP_ENV` vs `NODE_ENV`)

Next.js builds and runtime commands set `NODE_ENV="production"` for optimized bundling and performance. To distinguish real production from staging:

* **Staging Setting**: `NODE_ENV=production` AND `APP_ENV=staging`
* **Test Gateway Integration**: In staging (`APP_ENV=staging`), Razorpay test credentials (`rzp_test_*`) are permitted to allow verification against the live Razorpay sandbox API.
* **Mock Transport Disabled**: Mock payment transports are strictly disabled in staging. All gateway requests use real HTTPS transport to provider endpoints.
* **Placeholder Defense**: Placeholder credentials (e.g. `<...>`, `placeholder`, `example`) are blocked fail-closed across both staging and production.

### Required Staging Environment Variables

| Variable Name | Required | Example / Description | Hardening / Validation Rules |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | Yes | `production` | Set by Next.js runtime. |
| `APP_ENV` | Yes | `staging` | Distinguishes staging from production. |
| `APP_URL` | Yes | `https://staging.calcart.example.com` | Valid URL required. Must be accessible by webhooks. |
| `PORT` | No | `3000` | Port for web service (default: 3000). |
| `DATABASE_URL` | Yes | `postgresql://user:pass@host:5432/calcart_staging?sslmode=require` | Must be a real connection string. Placeholders rejected. |
| `AUTH_SECRET` | Yes | Secure 64-character random hex string | Must be $\ge 32$ characters. Placeholders rejected. |
| `RAZORPAY_KEY_ID` | Yes | `rzp_test_xxxxxxxxxxxxxx` | Razorpay sandbox test key ID. |
| `RAZORPAY_KEY_SECRET` | Yes | Sandbox secret key | Razorpay sandbox test secret key. |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | Cryptographic HMAC secret | Must match webhook configuration in Razorpay dashboard. |
| `RESEND_API_KEY` | Optional | `re_xxxxxxxxxxxx` | Resend API key for staging email delivery. |
| `RESEND_FROM_EMAIL` | Optional | `Cal Cart Staging <staging@calcart.dev>` | Verified staging sender address. |
| `JOB_POLL_INTERVAL` | No | `10000` | Worker poll interval in ms (default: 10000ms / 10s). |
| `JOB_CONCURRENCY` | No | `4` | Worker job concurrency limit (default: 4). |

---

## 4. Deployment Sequence

To prevent race conditions, schema mismatches, and downtime, deployment must follow this strict ordered sequence:

```mermaid
flowchart TD
    A["1. Code Checkout & Dependency Install (pnpm install --frozen-lockfile)"] --> B["2. Build Packages & Artifacts (pnpm build)"]
    B --> C["3. Execute Database Migrations (pnpm run db:migrate)"]
    C --> D["4. Start / Reload Web Service (pnpm --filter @shopify-clone/web run start)"]
    D --> E["5. Verify Web Health Endpoint (GET /api/v1/health)"]
    E --> F["6. Start / Reload Background Worker (pnpm --filter @shopify-clone/worker run start)"]
```

### Step 1: Pre-deployment Build
```bash
pnpm install --frozen-lockfile
pnpm build
```

### Step 2: Database Migration Execution
Database migrations must execute and complete **before** application processes start:
```bash
pnpm run db:migrate
```
* **Concurrency Safety**: `runMigrations` acquires a PostgreSQL advisory lock (`MIGRATION_ADVISORY_LOCK_KEY = 7421903384`). Even if multiple deployment runners trigger migrations simultaneously, only one runner executes the SQL scripts, while others wait safely.
* **Transactional Invariance**: Every migration file runs inside a dedicated `BEGIN ... COMMIT` block. If any migration fails, it rolls back cleanly without leaving partial tables.
* **Status Check**: Verify applied migrations using `pnpm run db:migrate:status`.

### Step 3: Launch Web Service
```bash
pnpm --filter @shopify-clone/web run start
```

### Step 4: Launch Background Worker
```bash
pnpm --filter @shopify-clone/worker run start
```

---

## 5. Background Worker Architecture & Duplicate Safeguards

The Cal Cart worker (`@shopify-clone/worker`) runs as a dedicated daemon and executes three critical reconciliation jobs:

1. **Webhook Recovery Job (`WebhookRecoveryJob`)**:
   * Scans for webhook processing leases that were abandoned (due to worker restarts or transient crashes) older than `PAYMENT_WEBHOOK_LEASE_TIMEOUT` (default: 60s).
   * Reclaims and processes pending events using transactional `FOR UPDATE SKIP LOCKED` row locking.
2. **Payment Recovery Job (`PaymentRecoveryJob`)**:
   * Reconciles ambiguous payment states (`REQUIRES_RECONCILIATION`) and orphaned captured payments.
   * Communicates with Razorpay test gateway to confirm capture status and finalizes orders or releases reservations.
3. **Order Cancellation Recovery Job (`OrderCancellationRecoveryJob`)**:
   * Scans for cancelled orders whose inventory reservations or refunds were delayed.
   * Atomically transitions inventory and initiates gateway refunds.

### Duplicate Execution Prevention
* **In-Memory Guard**: `PaymentRecoveryScheduler` maintains an `isRunning` lock; overlapping intervals skip execution rather than spawning duplicate concurrent jobs.
* **Database Row Locking**: Recovery queries use `FOR UPDATE SKIP LOCKED` to serialize processing and prevent multiple worker instances from processing the same payment or webhook event simultaneously.
* **Graceful Shutdown**: The process listens for `SIGINT` and `SIGTERM`. It stops interval timers, waits for the active recovery cycle to complete, and closes database connection pools cleanly before exiting.

---

## 6. Health Checks, Readiness, & Observability

### Web Service Health Check
The web service exposes a real database-probing health check at:
* **Path**: `GET /api/v1/health`
* **Healthy Response (HTTP 200)**:
  ```json
  {
    "success": true,
    "data": {
      "status": "healthy",
      "database": "healthy",
      "timestamp": "2026-10-21T12:00:00.000Z"
    }
  }
  ```
* **Failure Response (HTTP 503)**:
  ```json
  {
    "success": false,
    "error": {
      "code": "DATABASE_UNAVAILABLE",
      "message": "Database connectivity check failed"
    }
  }
  ```

### Worker Log Observability
The worker emits structured single-line JSON logs on every recovery execution cycle:
```json
{
  "tag": "PAYMENT_RECOVERY_CYCLE_COMPLETED",
  "durationMs": 42,
  "paymentRecovery": {
    "orphanedRecovered": 0,
    "orphanedFailed": 0,
    "ambiguousReconciled": 0,
    "ambiguousFailed": 0,
    "success": true
  },
  "webhookRecovery": {
    "recovered": 0,
    "failed": 0,
    "success": true
  },
  "orderCancellation": {
    "inventoryRecovered": 0,
    "inventoryFailed": 0,
    "refundsRecovered": 0,
    "refundsFailed": 0
  }
}
```

---

## 7. Rollback & Recovery Procedure

If a staging release fails health checks or encounters critical defects:

1. **Stop Worker Daemon**: Immediately send `SIGTERM` to the worker process to halt recovery schedulers cleanly.
2. **Revert Web Application**: Reroute traffic or redeploy the prior verified release bundle.
3. **Database Compatibility**: Cal Cart migrations are strictly additive. Rolling back web application binaries does not require destructive database rollbacks unless a breaking schema alteration occurred.
4. **Inspect Recovery Logs**: Review worker logs for any orders or payments flagged as `REQUIRES_RECONCILIATION`.
