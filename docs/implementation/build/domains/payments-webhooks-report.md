# Cal Cart: Payments Task 5 — Razorpay Webhook Processing Implementation Report

## 1. Executive Summary

This report documents the implementation of secure, reliable, and durable Razorpay webhook processing for the Cal Cart Demo's Payments module, adhering strictly to `specs/payments/payment-spec.md` and `AGENTS.md`.

All Razorpay webhook requests are cryptographically verified using HMAC-SHA256 on the exact raw HTTP request body bytes against the configured `RAZORPAY_WEBHOOK_SECRET`. Webhook events are transactionally deduplicated in the database table `payment_webhook_events` to ensure idempotency and prevent duplicate financial transitions or race conditions under concurrent deliveries. Out-of-order and stale events are handled safely without regressing canonical terminal or captured states. Neither order creation nor checkout completion were introduced, preserving strict modular boundaries.

---

## 2. Files Changed and Their Responsibilities

1. **`modules/payments/src/webhooks/razorpay-webhook-signature.ts`**:
   - Cryptographic verification of Razorpay webhook signatures.
   - Extracts signature from `x-razorpay-signature` header.
   - Validates hexadecimal signature format (64-character SHA-256).
   - Computes HMAC-SHA256 over exact raw request body buffer using `RAZORPAY_WEBHOOK_SECRET`.
   - Uses `crypto.timingSafeEqual` over length-matched buffers to protect against timing side-channel attacks.
   - Never leaks or logs secrets, signatures, or payload contents.

2. **`modules/payments/src/webhooks/razorpay-webhook-types.ts`**:
   - Defines strongly-typed structures for Razorpay webhook payloads and entity representations (`RazorpayWebhookPayload`, `RazorpayPaymentEntity`).
   - Defines processing outcomes (`WebhookProcessResult`: `PROCESSED`, `IGNORED`, `DUPLICATE`, `RECONCILIATION_REQUIRED`).
   - Implements runtime payload validation (`validateRazorpayWebhookPayload`) to guard against malformed JSON or unverified payload shapes before domain ingestion.

3. **`modules/payments/src/webhooks/webhook-errors.ts`**:
   - Comprehensive error taxonomy extending `PaymentBaseError`:
     - `WebhookSignatureVerificationError`: Missing/invalid header, secret, format, or HMAC mismatch.
     - `WebhookPayloadValidationError`: Missing/malformed required payload attributes.
     - `WebhookDuplicateEventError`: Concurrent or already-processed event duplicate.
     - `WebhookEntityNotFoundError`: Target payment attempt or payment not found in database.
     - `WebhookProcessingError`: Invariant violation, mismatch, or transient processing failure.

4. **`modules/payments/src/webhooks/webhook-processor.ts`**:
   - Domain processing engine implementing `PaymentWebhookProcessor`.
   - Correlates provider entity identifiers (`order_id`, `id`) to local payment attempts and payments.
   - Acquires pessimistic row locks (`findByIdForUpdate`) within database transactions.
   - Verifies financial invariants: amount matching, currency matching, and provider identity matching.
   - Handles events:
     - `payment.captured`: Transitions payment to `CAPTURED` and attempt to `SUCCESS`. Transitions through `PENDING` if initial status was `CREATED`.
     - `payment.authorized`: Transitions payment to `AUTHORIZED` and attempt to `AUTHORIZED`. Transitions through `PENDING` if initial status was `CREATED`.
     - `payment.failed`: Transitions payment to `FAILED` and attempt to `FAILED` (unless already in terminal or captured status).
     - Unsupported events (e.g. `order.paid`): Safely recorded as `IGNORED` without state alteration.
   - Guard against stale/out-of-order deliveries: Never regresses terminal or captured payments (`CAPTURED`, `REFUNDED`, `PARTIALLY_REFUNDED`).
   - Flags amount/currency anomalies as `REQUIRES_RECONCILIATION` without fabricating captures.

5. **`modules/payments/src/application/payment-webhook-service.ts`**:
   - Orchestration application service implementing `PaymentWebhookService`.
   - Verifies signature prior to database interaction to protect deduplication storage from poisoning.
   - Resolves a stable provider event ID (`event.id` or header or deterministic SHA-256 hash fallback).
   - Manages durable lifecycle in `payment_webhook_events`:
     - Inserts record with `status: 'PROCESSING'`.
     - Catches unique constraint violations on `(provider, provider_event_id)` to gracefully acknowledge duplicates (`DUPLICATE`).
     - Executes processing inside transaction and updates record to `status: 'PROCESSED'` or `status: 'IGNORED'`.
     - On unexpected failure, commits `status: 'FAILED'` with error details in an isolated transaction to facilitate retries while releasing locks.

6. **`apps/web/app/api/v1/webhooks/payments/razorpay/route.ts`**:
   - Next.js App Router POST endpoint at `/api/v1/webhooks/payments/razorpay`.
   - Reads raw HTTP request body bytes exactly once (`req.text()`) to prevent JSON re-serialization byte divergence.
   - Enforces signature check independently of storefront/merchant session middleware.
   - Responds HTTP 200 `{ received: true }` for processed/ignored events.
   - Responds HTTP 200 `{ received: true, duplicate: true }` for verified duplicates to stop gateway retry storms.
   - Responds HTTP 400 for bad signatures or invalid payloads.
   - Responds HTTP 500 on transient failures to trigger standard gateway retry policies.

7. **`apps/web/tsconfig.json`**:
   - Added path alias `"@calcart/db": ["../../packages/db/src/index.ts"]` to allow web application to resolve shared DB types in tests and builds.

8. **Tests Added**:
   - `tests/payments/razorpay-webhook-signature.test.ts` (13 tests)
   - `tests/payments/payment-webhook-processor.test.ts` (14 tests)
   - `tests/payments/payment-webhook.api.test.ts` (7 tests)

---

## 3. Webhook Signature Verification and Raw-Body Handling

- **Raw Request Body Integrity**:
  The Next.js App Router handler calls `await req.text()` directly on the incoming `Request`. This extracts the exact byte-for-byte payload as transmitted by Razorpay. Re-serializing parsed JSON was strictly avoided because formatting variations (whitespace, property order, Unicode escaping) invalidate cryptographic HMAC digests.
- **Constant-Time Comparison**:
  HMAC-SHA256 is generated using `crypto.createHmac('sha256', secret).update(rawBody).digest('hex')`. Signatures are validated for hex structure and 64-character length, converted to `Buffer.from(..., 'hex')`, and compared with `crypto.timingSafeEqual()`. If buffer lengths diverge or signatures are malformed, verification immediately returns `false` without timing variance.
- **Secret Isolation**:
  The webhook secret is retrieved strictly from the `RAZORPAY_WEBHOOK_SECRET` environment variable, ensuring the frontend client callback secret (`RAZORPAY_KEY_SECRET`) is never reused for webhooks.

---

## 4. Supported Event Types and State Transitions

| Razorpay Event | Expected Payload Entity | Local State Transition | Attempt State Transition | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `payment.captured` | `payment.entity` (`status: "captured"`) | `CREATED`/`PENDING`/`AUTHORIZED` $\rightarrow$ `CAPTURED` | `PENDING`/`AUTHORIZED` $\rightarrow$ `SUCCESS` | Invariants checked: exact amount, currency, and provider IDs match. Transitions through `PENDING` if initial status is `CREATED`. |
| `payment.authorized` | `payment.entity` (`status: "authorized"`) | `CREATED`/`PENDING` $\rightarrow$ `AUTHORIZED` | `PENDING` $\rightarrow$ `AUTHORIZED` | Does not regress `CAPTURED` payments. |
| `payment.failed` | `payment.entity` (`status: "failed"`) | `CREATED`/`PENDING` $\rightarrow$ `FAILED` | `PENDING` $\rightarrow$ `FAILED` | Does not overwrite `CAPTURED` payments (prevents race regression). |
| Amount / Currency Mismatch | Any | $\rightarrow$ `REQUIRES_RECONCILIATION` | $\rightarrow$ `FAILED` | Flagged for manual audit; never marked as captured. |
| Other Events (e.g. `order.paid`) | Various | Unchanged | Unchanged | Recorded as `IGNORED` with HTTP 200 to acknowledge receipt. |

---

## 5. Durable Deduplication and Concurrency Behavior

- **Database-Level Deduplication**:
  The PostgreSQL schema includes `payment_webhook_events` with unique constraint `UNIQUE (provider, provider_event_id)`.
- **Deduplication Life-Cycle**:
  1. `PaymentWebhookService` derives a stable provider event ID from `x-razorpay-event-id` or payload `id`, falling back to a deterministic SHA-256 hash of `(event_name + payment_id + created_at)` if absent.
  2. The service creates an event record with `status: 'PROCESSING'`.
  3. If a duplicate delivery occurs concurrently or sequentially, the repository's unique key constraint fires, and the service catches the conflict to return `{ outcome: 'DUPLICATE' }`.
  4. The API route returns HTTP 200 `{ received: true, duplicate: true }`, signaling the provider to discontinue delivery attempts without re-executing business logic.
- **Row Locking**:
  During processing, `findByIdForUpdate` is invoked on the payment row to serialize concurrent webhook deliveries or races with client-side return callbacks.

---

## 6. Retry and Failure-Recovery Behavior

- **Transient Failure Handling**:
  If a database error occurs during event processing, the transaction aborts. In an isolated recovery transaction, the service logs `status: 'FAILED'` with the error message in `payment_webhook_events`.
- **Safe Retries**:
  Because the status is marked `FAILED` rather than `PROCESSED`, subsequent retries by Razorpay are permitted to re-attempt processing once transient issues resolve.
- **HTTP Gateway Status Codes**:
  - `400 Bad Request`: Returned for missing/invalid signatures or malformed payloads, preventing useless provider retries.
  - `500 Internal Server Error`: Returned for transient failures, prompting Razorpay's standard exponential backoff retries.
  - `200 OK`: Returned for successfully processed, safely ignored, or recognized duplicate events.

---

## 7. Schema or Migration Changes

- **No Schema Changes or New Migrations Required**:
  The existing schema established in Task 2 (`packages/db/src/schema/payments.ts`) and repository (`packages/db/src/repositories/payment-webhook-event-repository.ts`) already defined the necessary tables and fields (`provider`, `provider_event_id`, `event_type`, `status`, `store_id`, `payload`, `error_message`, `processed_at`).
  The existing schema was verified and used directly without modification.

---

## 8. Tests Executed with Exact Results

### Focused Test Suites
1. **`tests/payments/razorpay-webhook-signature.test.ts`**:
   - 13 passed (Valid signature, invalid signature, header missing, secret missing, empty secret, malformed signature hex/length, body tampering, empty body, raw bytes handling, etc.).
2. **`tests/payments/payment-webhook-processor.test.ts`**:
   - 14 passed (Capturing payment, authorizing payment, failed payment, currency mismatch, amount mismatch, unsupported events, stale event protection, idempotency, etc.).
3. **`tests/payments/payment-webhook.api.test.ts`**:
   - 7 passed (Valid request processing, invalid signature 400, malformed JSON 400, missing header 400, duplicate delivery 200, retryable failure 500, tenant auth independence).

### Regression Test Suites
1. `tests/payments/refund.service.test.ts` (9 tests passed)
2. `tests/payments/razorpay-provider.test.ts` (14 tests passed)
3. `tests/payments/payment.domain.test.ts` (22 tests passed)
4. `tests/payments/razorpay-signature.test.ts` (15 tests passed)
5. `tests/payments/provider-payment-service.test.ts` (12 tests passed)
6. `tests/payments/payment.service.test.ts` (13 tests passed)

**Total Test Count**: 119 tests passing across all payment suites with 0 failures.

---

## 9. Quality Checks: Typecheck, Lint, and Diff Results

- **TypeScript Typecheck**: Checked across all packages (`packages/db`, `modules/payments`, `apps/web`). All types resolved cleanly without errors.
- **ESLint**: Clean across payments and web apps.
- **Git Diff Check**: No whitespace or formatting errors.

---

## 10. Known Limitations and Out-of-Scope Confirmation

- **No Checkout Completion**:
  As mandated by `AGENTS.md` and the task prompt, checkout completion is strictly out of scope and was not implemented.
- **No Order Creation**:
  Order creation upon successful payment capture belongs to downstream checkout/order orchestration modules and was not implemented in this webhook handler.
- **No Inventory Mutations**:
  Inventory reservations and releases remain strictly within the inventory module.
- **Provider Scope**:
  Razorpay is the sole provider integrated. No other payment gateways or asynchronous message queues were introduced.
