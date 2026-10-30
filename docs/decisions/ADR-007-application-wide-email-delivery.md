# ADR-007: Application-Wide Transactional Notification Delivery Architecture

## Status

**Accepted**

## Date

2026-10-23

## Decision

The platform implements a **hybrid transactional notification delivery architecture** combining:
1. **Durable PostgreSQL Outbox (`notification_outbox`) & Background Worker Processing (`apps/worker`)** for all business and commerce lifecycle events (`ORDER_CONFIRMATION`, `ORDER_FULFILLMENT`, `ORDER_CANCELLED`, `REFUND_CONFIRMATION`, `MERCHANT_NEW_ORDER`, `LOW_STOCK_ALERT`).
2. **Ephemeral Direct Dispatch via `@calcart/email`** for time-sensitive security and authentication events (`MERCHANT_PASSWORD_RESET`, `STOREFRONT_PASSWORD_RESET`, `STAFF_INVITATION`, `STAFF_INVITATION_ACCEPTED`, `STAFF_INVITATION_REVOKED`, `PASSWORD_CHANGED`, `MERCHANT_WELCOME`, `CUSTOMER_WELCOME`).

---

## 1. Context & Problem Statement

Cal Cart requires a reliable, secure, multi-tenant email notification system spanning customer commerce, merchant operations, inventory alerts, and authentication lifecycle events.

Key constraints:
- **Commerce Integrity:** Email provider downtime or throttling must never block or roll back payment capture, order creation, inventory reservations, or refund processing.
- **Security & Secret Minimization:** High-entropy plaintext credentials (e.g. password reset tokens, staff invitation tokens) must never be persisted in plaintext inside database outbox tables or query logs. Only SHA-256 hashes (`token_hash`) are stored in PostgreSQL.
- **Tenant Isolation:** Notifications and operational logs must strictly respect store boundaries (`store_id`). Cross-tenant leakage of store branding, order items, or customer PII is prohibited.
- **Idempotency & Concurrency:** Repeated webhooks, retried callbacks, and concurrent worker polling must never dispatch duplicate emails or cause race conditions.

---

## 2. Decision Details

### 2.1 Outbox vs. Direct Dispatch Division

| Category | Workflows | Delivery Mechanism | Architectural Rationale |
|---|---|---|---|
| **Customer Commerce** | Order Confirmation, Fulfillment, Cancellation, Refund Confirmation | **Durable Outbox** (`notification_outbox`) | Must be atomic with business state mutations; decoupled from external Resend latency; retryable via worker. |
| **Merchant Operations** | New Order Alert, Low Stock Alert | **Durable Outbox** (`notification_outbox`) | Guarantees delivery to store operators even if provider experiences transient outages during checkout or restocking. |
| **Authentication & Tokens** | Merchant Password Reset, Customer Password Reset, Staff Invitation | **Direct In-Memory Dispatch** (`EmailService`) | Security requirement: Raw cryptographic tokens must remain ephemeral in memory during request lifecycle. Storing tokens in outbox tables would expose them to any database read access. |
| **Security Alerts** | Password Changed, Staff Invite Revoked/Accepted, Welcomes | **Direct In-Memory Dispatch** (`EmailService`) | Fast, user-interactive confirmation with fail-safe error handling (never crashes user session). |

### 2.2 Concurrency & Worker Claiming (`FOR UPDATE SKIP LOCKED`)
- Workers poll `notification_outbox` using `SELECT ... FOR UPDATE SKIP LOCKED` inside a transaction.
- Rows are atomically transitioned from `PENDING` to `PROCESSING`.
- Stale `PROCESSING` rows older than 5 minutes (indicating a worker crash or abnormal termination) are automatically reclaimed and re-queued.

### 2.3 Bounded Retries with Exponential Backoff and Jitter
- Transient errors (e.g., rate limits, network timeouts, 5xx server errors) are retried up to 5 times.
- Schedule: `60s`, `300s`, `900s`, `1800s`, `3600s` with randomized `±15%` jitter to avoid thundering herd spikes.
- Terminal errors (e.g., malformed email addresses, missing recipients) immediately transition to `FAILED` without futile retries.

### 2.4 Low-Stock Threshold Crossing & Alert Deduplication
- Low-stock alerts are triggered **only on threshold crossings**: when available inventory transitions from `> threshold` to `<= threshold`, or reaches `0`.
- Ongoing adjustments while stock remains below threshold do not enqueue duplicate alerts.
- Restocking above the threshold resets the state, re-arming the system for future threshold crossings.
- Idempotency key pattern: `low_stock:${storeId}:${variantId}:${newQuantity}`.

### 2.5 Operational Visibility & Safe Retries
- Store staff can view store-scoped notifications via `GET /api/v1/stores/[storeId]/notifications`.
- Store administrators can manually retry failed notifications via `POST /api/v1/stores/[storeId]/notifications/[notificationId]/retry`, resetting status to `PENDING` with immediate retry time.
- All operational queries enforce `WHERE store_id = $1` to preserve tenant boundaries.

---

## 3. Consequences

### Positive
- Zero risk of commerce transaction rollbacks due to email delivery failures.
- Zero plaintext cryptographic tokens persisted in background job tables.
- Comprehensive coverage across all user and merchant personas.
- Transparent operational observability with error categorization (`RATE_LIMIT`, `TIMEOUT`, `INVALID_ADDRESS`, `PROVIDER_ERROR`, `NETWORK_ERROR`).

### Trade-offs & Mitigations
- In-memory auth emails can fail if Resend is completely unreachable during a password reset request. Mitigated by generic anti-enumeration HTTP 200 responses and clear instructions for users to retry.
- Exactly-once delivery cannot be guaranteed across network boundaries if a worker crashes immediately after provider acceptance. Mitigated by provider message IDs and idempotent outbox records.
