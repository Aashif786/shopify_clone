# Performance, Observability & Health Monitoring

This document defines performance benchmarks, query monitoring, health endpoints, and background job telemetry across Cal Cart.

---

## 1. System Health Checks

### API Health Endpoint: `GET /api/v1/health`
- **Location**: `apps/web/app/api/v1/health/route.ts`
- **Behavior**:
  - Executes `ctx.db.healthCheck()`, executing `SELECT 1` against the active PostgreSQL connection pool.
  - Returns HTTP 200 `{ status: "healthy", database: "healthy", timestamp: ... }` when database ping succeeds.
  - Returns HTTP 503 `{ error: { code: "DATABASE_UNAVAILABLE" } }` when database ping times out or throws.
- **Usage**: Used by container orchestration (Docker/Kubernetes) liveness and readiness probes.

---

## 2. Background Worker Observability

### Worker Lease Telemetry (`apps/worker`)
- Schedulers acquire distributed advisory locks in PostgreSQL before job execution.
- Metrics logged:
  - `lease_acquired` / `lease_failed`
  - `job_duration_ms`
  - `items_recovered` (e.g. stalled payments, retried webhooks, recovered cancellations)
  - `errors_count`

---

## 3. Database Performance & Indexing Conventions

- **Composite Tenant Indexing**: Every high-volume table contains a composite index prefixed by `store_id`:
  - `orders (store_id, created_at)`
  - `orders (store_id, status)`
  - `products (store_id, status, created_at)`
  - `inventory_items (store_id, variant_id)`
  - `refunds (store_id, status, created_at)`
- **Partial Unique Indexes**:
  - `checkouts_guest_token_hash_idx` ON `checkouts (store_id, guest_token_hash) WHERE guest_token_hash IS NOT NULL`
  - `orders_guest_token_hash_idx` ON `orders (store_id, guest_token_hash) WHERE guest_token_hash IS NOT NULL`
- **Query Guidelines**:
  - Always enforce `LIMIT` on unbounded queries (max 100).
  - Use keyset/cursor pagination based on `(created_at, id)` instead of high-offset `OFFSET` scans.

---

## 4. Structured Logging Conventions

Log records in API routes and services follow standard JSON structure:
```json
{
  "timestamp": "2026-10-22T04:45:00.000Z",
  "level": "info",
  "requestId": "req_01a15...",
  "storeId": "store_01a15...",
  "event": "payment_verified",
  "paymentId": "pay_01a15...",
  "durationMs": 42
}
```
Credentials, password hashes, payment gateway secrets, and session cookies are strictly excluded from logs.
