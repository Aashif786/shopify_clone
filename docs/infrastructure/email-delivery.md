# Transactional Email Delivery System

This document outlines the architecture, setup, provider integration, security controls, outbox durability, coverage matrix, and testing practices for transactional emails in Shopify Clone.

---

## 1. Architecture & Provider Integration

Shopify Clone uses **Resend** via the official SDK (`resend`) as its transactional email delivery provider, encapsulated inside the `@shopify-clone/email` package, paired with a durable asynchronous PostgreSQL outbox (`notification_outbox`) and worker daemon for mission-critical commerce notifications.

### Package Structure (`packages/email/`)

- `src/config.ts`: Configuration resolver and base URL validator (enforces anti-host-header injection).
- `src/errors.ts`: Typed error hierarchy (`MissingEmailProviderConfigurationError`, `InvalidEmailProviderConfigurationError`, `EmailDeliveryError`) and standardized error categorization (`categorizeEmailError`) distinguishing transient vs. permanent failures.
- `src/url-builder.ts`: Server-side trusted URL generators deriving links strictly from validated base URL configurations.
- `src/templates/`: Responsive HTML & plain-text templates with dark/light mode support (KINETIC NOVA theme):
  - `merchant-welcome.ts`: Onboarding welcome for newly registered merchant users.
  - `merchant-new-order.ts`: Real-time order alerts for store owners with item summaries, financial totals, shipping destinations, and admin deep-links.
  - `merchant-low-stock.ts`: Inventory stock threshold alerts distinguishing low-stock from out-of-stock events.
  - `merchant-password-reset.ts`: Password reset instructions for merchant users.
  - `storefront-password-reset.ts`: Password reset for storefront buyers, branded with store name and contact details.
  - `staff-invitation.ts`: Staff team invitation with inviter name, store role, and expiration timestamp.
  - `staff-invitation-accepted.ts`: Onboarding confirmation for newly accepted staff members.
  - `staff-invitation-revoked.ts`: Revocation notification when a pending invitation is cancelled.
  - `password-changed.ts`: Security alert dispatched whenever a password mutation occurs.
  - `customer-welcome.ts`: Account registration confirmation for storefront customers.
- `src/service.ts`: `EmailService` client featuring:
  - Masked email logging (`a***z@domain.com`) to protect user PII in server operational logs.
  - Provider timeout protection (`Promise.race` with configurable `RESEND_TIMEOUT_MS`).
  - Standardized `EmailSendResult` returning message IDs, error categories, and transient retry classifications.
  - Fail-safe delivery error handling that prevents failures from crashing user mutations.
  - In-memory email capture during local development and testing.

---

## 2. Dispatch Architecture: Hybrid Direct vs. Outbox Pattern

To balance security and reliability, Shopify Clone employs a **hybrid dispatch architecture**:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Transactional Workflows                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌──────────────────────────────┐          ┌──────────────────────────────┐
│ Direct In-Memory Dispatch    │          │ Asynchronous Outbox Queue    │
│ (Auth & Cryptographic Tokens)│          │ (Commerce & Operations)      │
├──────────────────────────────┤          ├──────────────────────────────┤
│ • Password reset tokens      │          │ • Order confirmation         │
│ • Store staff invitations    │          │ • Order fulfillment/shipping │
│ • Password change alerts     │          │ • Order cancellation         │
│ • Merchant welcome           │          │ • Refund confirmation        │
│                              │          │ • Merchant new order alert   │
│ Rationale:                   │          │ • Merchant low stock alert   │
│ Prevents storing raw secrets │          │                              │
│ in persistent tables         │          │ Rationale:                   │
│ (DB stores SHA-256 hashes).  │          │ Guarantees fail-open         │
└──────────────┬───────────────┘          │ commerce transactions;       │
               │                          │ retries via worker daemon.   │
               │                          └──────────────┬───────────────┘
               │                                         │
               │                                         ▼
               │                          ┌──────────────────────────────┐
               │                          │ PostgreSQL outbox table      │
               │                          │ (SKIP LOCKED batch claims)   │
               │                          └──────────────┬───────────────┘
               │                                         │
               │                                         ▼
               │                          ┌──────────────────────────────┐
               │                          │ apps/worker daemon           │
               │                          │ (exponential backoff+jitter) │
               │                          └──────────────┬───────────────┘
               │                                         │
               └───────────────────┬─────────────────────┘
                                   ▼
                    ┌──────────────────────────────┐
                    │ Resend API Provider / Mock   │
                    └──────────────────────────────┘
```

### Direct In-Memory Dispatch (Authentication & Secret Tokens)
Cryptographic security tokens (e.g., password reset tokens, staff invitation tokens) must never be persisted in plain text. Since the database only stores cryptographic SHA-256 hashes (`token_hash`), these notifications are sent directly in memory during the request cycle. If the email provider is temporarily unreachable, the user receives an appropriate error or retry response without exposing secrets.

### Asynchronous Outbox Pattern (Commerce & Merchant Operations)
All commerce notifications (`ORDER_CONFIRMATION`, `ORDER_FULFILLMENT`, `ORDER_CANCELLED`, `REFUND_CONFIRMATION`, `MERCHANT_NEW_ORDER`, `LOW_STOCK_ALERT`) are enqueued into the `notification_outbox` table within the active database transaction or immediately following it:
- **Fail-Open Delivery**: Payment captures, order completions, stock deductions, and refund executions are never rolled back or delayed if the third-party email provider experiences downtime or rate limits.
- **Idempotency Guarantees**: Every outbox entry enforces a unique `idempotency_key` constraint, preventing duplicate notifications from being queued on webhook retries or repeated requests.
- **Transactional Consistency**: If a database transaction rolls back, any notification queued within that transaction is automatically discarded.

---

## 3. Application Email Coverage Matrix

| Category | Workflow / Trigger | Outbound Notification | Delivery Mode | Deduplication Key Pattern | Implemented? |
|---|---|---|---|---|---|
| **Authentication & Accounts** | Merchant user registration | Merchant Welcome | Direct | `N/A` (In-memory) | ✅ Implemented |
| | Merchant password reset request | Merchant Password Reset | Direct | `N/A` (One-time token) | ✅ Implemented |
| | Storefront customer password reset | Storefront Password Reset | Direct | `N/A` (One-time token) | ✅ Implemented |
| | Password change mutation | Password Changed Security Alert | Direct | `N/A` (Security alert) | ✅ Implemented |
| | Staff member invited to store | Staff Invitation | Direct | `N/A` (One-time token) | ✅ Implemented |
| | Staff invitation accepted | Staff Invitation Accepted | Direct | `N/A` (Audit event) | ✅ Implemented |
| | Staff invitation revoked | Staff Invitation Revoked | Direct | `N/A` (Audit event) | ✅ Implemented |
| | Storefront customer account creation | Customer Welcome | Direct | `N/A` (In-memory) | ✅ Implemented |
| **Customer Commerce** | Payment capture & order creation | Customer Order Confirmation | Outbox | `order_confirmation:<orderId>` | ✅ Implemented |
| | Order item fulfillment / shipping | Fulfillment & Tracking Notice | Outbox | `order_fulfillment:<fulfillmentId>` | ✅ Implemented |
| | Merchant or staff order cancellation | Customer Order Cancellation | Outbox | `order_cancelled:<orderId>` | ✅ Implemented |
| | Refund capture & issuance | Customer Refund Confirmation | Outbox | `refund_confirmation:<refundId>` | ✅ Implemented |
| | Customer checkout abandoned | Abandoned Checkout Reminder | N/A | N/A | ❌ Excluded (See Below) |
| | Customer storefront contact inquiry | Contact Form Confirmation | N/A | N/A | ❌ Excluded (See Below) |
| **Merchant Operations** | Payment capture & order creation | Merchant New Order Alert | Outbox | `merchant_order_alert:<orderId>` | ✅ Implemented |
| | Inventory reaches or drops below threshold | Merchant Low Stock Alert | Outbox | `low_stock:<storeId>:<variantId>:<qty>` | ✅ Implemented |
| | Inventory restocked above threshold | Stock Recovery Re-arm | State Transition | Resets alert trigger | ✅ Implemented |
| **Platform Operations** | Outbox notification failed 5 retries | Status marked `FAILED` | Outbox | Observable via API | ✅ Implemented |
| | Merchant admin manual retry | Notification Status Reset | API / Outbox | Resets status to `PENDING` | ✅ Implemented |

### Explicitly Excluded Workflows & Rationale
1. **Abandoned Checkout Reminders**: Intentionally unsupported for Demo. Sending marketing or recovery emails to buyers who have entered an email address without a completed order requires an explicit marketing opt-in consent mechanism, privacy policy agreement, and a one-click unsubscribe mechanism. Cal Cart adheres strictly to anti-spam compliance and tenant boundaries.
2. **Customer Storefront Contact Form**: Cal Cart does not feature a generic public contact-form submission endpoint in the storefront. Customer communication occurs through order confirmation reply-to addresses.

---

## 4. Worker Dispatch & Retry Semantics

The background worker daemon (`apps/worker`) executes `NotificationDispatchJob` on a recurring schedule (default: every 10 seconds).

### Concurrent Batch Claiming
```sql
SELECT * FROM notification_outbox
WHERE status = 'PENDING'
  AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
ORDER BY created_at ASC
LIMIT 10
FOR UPDATE SKIP LOCKED;
```
`FOR UPDATE SKIP LOCKED` guarantees that multiple worker replicas can operate simultaneously without race conditions or duplicate sends.

### Exponential Backoff with Jitter
Failed deliveries (due to rate limits, timeouts, or network hiccups) compute the next attempt using:
$$\text{Delay} = \min(\text{baseDelay} \times 2^{\text{attempt} - 1}, \text{maxDelay}) \times (1 \pm \text{jitter})$$
- Base delay: `15 seconds`
- Max delay: `1 hour`
- Jitter: `±15%` randomized variance to avoid thundering herd on provider recovery.

### Failure Classification
- **Transient Errors** (`RATE_LIMIT`, `TIMEOUT`, `NETWORK_ERROR`, 5xx `PROVIDER_ERROR`): Re-queued for retry up to 5 attempts.
- **Permanent Errors** (`INVALID_ADDRESS`, 4xx `AUTHENTICATION_ERROR`): Marked immediately as `FAILED` without burning retry attempts.
- **Provider Tracking**: Upon successful delivery, the provider's message identifier (`provider_message_id`) is stored for auditing and webhook reconciliation.

---

## 5. Low-Stock Alert State Machine

Low-stock alerts employ a stateful threshold-crossing model to avoid alert spam:

```text
   Initial Stock > Threshold
               │
               ▼  (Stock Decrement)
   Available <= Threshold (or == 0)  ──►  Enqueue LOW_STOCK_ALERT Outbox Entry
               │
               ▼  (Further Decrements below threshold)
   Available continues to drop       ──►  Suppressed (No duplicate alert sent)
               │
               ▼  (Stock Restock)
   Available > Threshold             ──►  Re-arms alert trigger for next crossing
```

- **Threshold Resolution**: Reads custom variant alert threshold, falling back to default (5 units).
- **Idempotency Key**: Scoped to store, variant, and transition quantity: `low_stock:<storeId>:<variantId>:<availableQuantity>`.

---

## 6. Merchant Notification Observability APIs

Store administrators can inspect and manage notification health directly via REST APIs:

### 1. List Store Notifications
`GET /api/v1/stores/:storeId/notifications`
- **Authorization**: Store Owner or Admin (`requireStoreRole(['OWNER', 'ADMIN'])`).
- **Query Parameters**:
  - `page` (default: 1)
  - `limit` (default: 20, max: 100)
  - `status` (optional filter: `PENDING`, `PROCESSING`, `SENT`, `FAILED`)
- **Response**: Paginated list of notifications with delivery attempts, next retry timestamp, error classification, and provider message ID. Recipient emails are sanitized/masked.

### 2. Manual Retry Notification
`POST /api/v1/stores/:storeId/notifications/:notificationId/retry`
- **Authorization**: Store Owner or Admin.
- **Behavior**: Resets a `FAILED` notification back to `PENDING`, clearing the error message and setting `next_attempt_at = NOW()`.
- **Tenant Protection**: Strict check ensures the notification belongs to `:storeId`.

---

## 7. Environment Variables

All email delivery settings are configured via server-only environment variables. Placeholders are documented in `.env.example`:

| Variable | Required in Production | Default / Fallback | Description |
|---|---|---|---|
| `EMAIL_PROVIDER_MODE` | No | `development` | Provider mode: `resend`, `development`, or `test`. |
| `RESEND_API_KEY` | Yes (when `resend` mode) | None | Secret API key from Resend dashboard (`re_...`). |
| `RESEND_FROM_EMAIL` | Yes | `Shopify Clone <notifications@shopifyclone.com>` | Sender address and display name for outbound emails. |
| `RESEND_REPLY_TO_EMAIL`| No | None | Optional reply-to address. |
| `RESEND_TIMEOUT_MS` | No | `10000` (10 seconds) | Outbound network request timeout in milliseconds. |
| `APP_URL` | Yes | `http://localhost:3000` | Validated application base URL used for link generation. |

> [!CAUTION]
> Never commit real `RESEND_API_KEY` credentials to source control or expose them to client-side bundles (`NEXT_PUBLIC_`).

---

## 8. Resend Account & DNS Setup

To send real transactional emails in production:

1. **Create a Resend Account:** Sign up at [https://resend.com](https://resend.com).
2. **Add Domain:** Navigate to **Domains** and click **Add Domain** (e.g., `shopifyclone.com` or `mail.shopifyclone.com`).
3. **Configure DNS Records:**
   - **SPF:** TXT record providing authorization for Resend to send on behalf of your domain.
   - **DKIM:** 3 CNAME records generated by Resend to cryptographically sign outbound emails.
   - **DMARC:** TXT record at `_dmarc.yourdomain.com` (e.g. `v=DMARC1; p=none; rua=mailto:dmarc-reports@yourdomain.com`).
   - **MX:** Fallback record if configuring receiving or inbound handling.
4. **Verify Domain:** Wait for DNS propagation and click **Verify** in the Resend dashboard until status shows `Verified`.
5. **Generate API Key:** Go to **API Keys**, create an API key with **Sending access** (restricted to the verified domain if possible), and store it securely in production secrets management as `RESEND_API_KEY`.
6. **Set Sender Email:** Configure `RESEND_FROM_EMAIL` using an address matching the verified domain (e.g., `Shopify Clone <notifications@yourdomain.com>`).

---

## 9. Local Development Behavior

For local development (`NODE_ENV=development` or `EMAIL_PROVIDER_MODE=development`):
- Outbound emails are **not sent over the internet**.
- The `EmailService` safely intercepts and captures every email in an in-memory buffer.
- Safe operational logs are printed to the terminal console showing the template name, recipient mask, subject, and delivery simulation.
- Developers can inspect simulated delivery without setting up a live Resend account or risking spam reports.

---

## 10. Security & Anti-Abuse Controls

1. **Host-Header Injection Protection:** Reset and invitation URLs are strictly generated using `validateAppBaseUrl(config.appUrl)`. Dynamic HTTP request `Host` or `X-Forwarded-Host` headers are never used to construct token links.
2. **Generic Responses (Anti-Enumeration):** Password reset requests return generic 200 OK responses regardless of whether an account exists, preventing email address enumeration.
3. **No Plaintext Tokens in Database or API Responses:**
   - Reset and invitation tokens are generated with high-entropy cryptographic random bytes.
   - Only the SHA-256 hash is persisted in PostgreSQL (`token_hash`).
   - In production (`NODE_ENV=production`), raw tokens and token URLs are omitted from API response payloads.
4. **Masked Operational Logs:** Recipient email addresses are automatically masked (e.g., `j***e@example.com`) before logging to prevent PII exposure in centralized logging systems.
5. **Safe Timeout & Provider Failures:** Resend network calls run under a strict timeout barrier. A provider downtime or DNS resolution failure logs a safe operational error without crashing merchant invitation creation or leaking internal stack traces to callers.
6. **Tenant Isolation:** Outbox notifications and management endpoints enforce strict `store_id` isolation. Staff from store A cannot view or retry notifications belonging to store B.

---

## 11. Automated Testing

Automated integration tests are located in:
- `tests/email.integration.test.ts`: Core provider client, URL security, auth templates, and direct sending.
- `tests/notifications/application-wide-email-system.test.ts`: Outbox queueing, merchant templates, backoff with jitter, error categorization, low-stock threshold crossing, and observability endpoints.

- **Execution:**
  ```bash
  pnpm vitest run tests/email.integration.test.ts
  pnpm vitest run tests/notifications/application-wide-email-system.test.ts
  ```

