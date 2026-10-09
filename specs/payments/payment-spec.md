# Payment Specification

## 1. Purpose

This specification defines the functional and technical requirements for the Payments domain of the Demo commerce platform.

The Payments domain is responsible for:

- Payment lifecycle management
- Payment attempts
- Payment provider integration
- Payment authorization and capture state
- Payment verification
- Payment webhooks
- Payment idempotency
- Refund coordination
- Provider-specific integration boundaries
- Payment failure handling

The Payments domain does not own:

- Carts
- Checkout state
- Inventory
- Products
- Discounts
- Customer profiles
- Orders

Those domains interact with Payments through defined interfaces.

---

# 2. Scope

The Demo Payments module supports:

- Sandbox/test payments
- Payment provider abstraction
- Payment attempts
- Payment authorization
- Payment capture
- Payment failure
- Payment pending states
- Provider webhooks
- Idempotent payment processing
- Amount and currency verification
- Refund support
- Payment history
- Payment reconciliation support

---

# 3. Out of Scope

Demo does not require:

- Multiple production payment providers
- Payment orchestration across providers
- Complex fraud detection
- Chargeback automation
- BNPL
- Cryptocurrency payments
- Subscription billing
- Recurring payments
- Advanced payment routing
- Multi-currency settlement
- Payment-method optimization
- PCI-heavy card storage
- Automated financial reconciliation systems

These may be introduced later.

---

# 4. Domain Ownership

The Payments module owns:

```text id="q3k8m1"
Payment
PaymentAttempt
PaymentWebhookEvent
Refund
```

It is authoritative for:

- payment state
- provider references
- payment attempts
- payment verification
- webhook processing
- refund state

Orders remain authoritative for order lifecycle.

---

# 5. Payment Entity & Database Schema Specification

The `payments` entity represents the authoritative platform record for a payment associated with a checkout.

### Schema Definition (Migration Requirement)

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  checkout_id UUID NOT NULL,
  order_id UUID,
  amount BIGINT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CREATED',
  provider TEXT NOT NULL DEFAULT 'razorpay',
  captured_amount BIGINT NOT NULL DEFAULT 0,
  refunded_amount BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payments_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT payments_checkout_store_fkey FOREIGN KEY (checkout_id, store_id)
    REFERENCES checkouts (id, store_id) ON DELETE RESTRICT,
  CONSTRAINT payments_order_store_fkey FOREIGN KEY (order_id, store_id)
    REFERENCES orders (id, store_id) ON DELETE SET NULL,
  CONSTRAINT payments_status_check CHECK (status IN (
    'CREATED',
    'PENDING',
    'PROCESSING',
    'AUTHORIZED',
    'CAPTURED',
    'FAILED',
    'CANCELLED',
    'REQUIRES_RECONCILIATION',
    'PARTIALLY_REFUNDED',
    'REFUNDED'
  )),
  CONSTRAINT payments_currency_format_check CHECK (currency = UPPER(TRIM(currency)) AND LENGTH(currency) = 3),
  CONSTRAINT payments_amount_check CHECK (amount > 0),
  CONSTRAINT payments_captured_amount_check CHECK (captured_amount >= 0 AND captured_amount <= amount),
  CONSTRAINT payments_refunded_amount_check CHECK (refunded_amount >= 0 AND refunded_amount <= captured_amount)
);

CREATE INDEX payments_store_id_idx ON payments (store_id);
CREATE INDEX payments_checkout_id_idx ON payments (checkout_id);
CREATE INDEX payments_order_id_idx ON payments (order_id);
CREATE INDEX payments_store_status_idx ON payments (store_id, status);
CREATE INDEX payments_store_created_at_idx ON payments (store_id, created_at DESC);

-- Partial unique index ensuring at most ONE active payment per checkout while allowing retries after failure/cancellation
CREATE UNIQUE INDEX payments_active_checkout_idx ON payments (store_id, checkout_id)
  WHERE status NOT IN ('FAILED', 'CANCELLED');
```

---

# 6. Payment Attempt Entity & Database Schema Specification

A Payment may undergo multiple provider attempts (e.g. if an initial attempt fails or times out and the customer retries). Each interaction with the provider is tracked durably in `payment_attempts`.

### Schema Definition (Migration Requirement)

```sql
CREATE TABLE payment_attempts (
  id UUID PRIMARY KEY,
  payment_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  attempt_number INT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'razorpay',
  provider_order_id TEXT,
  provider_payment_id TEXT,
  provider_signature TEXT,
  amount BIGINT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'INITIATED',
  failure_code TEXT,
  failure_message TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_attempts_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT payment_attempts_payment_store_fkey FOREIGN KEY (payment_id, store_id)
    REFERENCES payments (id, store_id) ON DELETE CASCADE,
  CONSTRAINT payment_attempts_payment_attempt_unique UNIQUE (payment_id, attempt_number),
  CONSTRAINT payment_attempts_status_check CHECK (status IN (
    'INITIATED',
    'PENDING',
    'AUTHORIZED',
    'CAPTURED',
    'FAILED',
    'CANCELLED',
    'REQUIRES_RECONCILIATION'
  )),
  CONSTRAINT payment_attempts_currency_format_check CHECK (currency = UPPER(TRIM(currency)) AND LENGTH(currency) = 3),
  CONSTRAINT payment_attempts_amount_check CHECK (amount > 0)
);

CREATE INDEX payment_attempts_payment_id_idx ON payment_attempts (payment_id);
CREATE INDEX payment_attempts_store_id_idx ON payment_attempts (store_id);
CREATE INDEX payment_attempts_provider_order_idx ON payment_attempts (provider, provider_order_id)
  WHERE provider_order_id IS NOT NULL;
CREATE UNIQUE INDEX payment_attempts_provider_payment_idx ON payment_attempts (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;
```

---

# 7. Canonical Payment Lifecycle

The platform uses a single, internally consistent, canonical payment state machine across all specifications and runtime services.

### Canonical States

| State | Classification | Description |
|---|---|---|
| `CREATED` | Initial | Local payment entity initialized for checkout; provider order not yet dispatched. |
| `PENDING` | In-Flight | Payment session/order created with Razorpay (`order_xxx`); awaiting customer authentication or payment submission. |
| `PROCESSING` | In-Flight | Payment received by provider; capture or webhook validation is actively processing locally. |
| `AUTHORIZED` | Intermediate | Payment authorized by card network/issuing bank, holding funds; capture pending (applicable in two-step auth/capture). |
| `CAPTURED` | Terminal (Settlement) | Funds captured successfully. **This is the sole successful payment state that authorizes checkout completion and order creation.** |
| `FAILED` | Terminal (Attempt) | Payment failed, declined, or timed out irrevocably. Permits checkout transition `PAYMENT_PENDING -> OPEN` for customer retry. |
| `CANCELLED` | Terminal | Payment explicitly cancelled by customer or merchant prior to capture. |
| `REQUIRES_RECONCILIATION` | Ambiguous | Provider outcome is uncertain (e.g. gateway timeout, webhook amount/currency mismatch, or conflicting provider payload). Prevents blind failure or duplicate charges; triggers automated worker verification. |
| `PARTIALLY_REFUNDED` | Post-Capture | At least one refund processed, with cumulative `refunded_amount < captured_amount`. |
| `REFUNDED` | Terminal (Final) | Cumulative `refunded_amount == captured_amount`. All captured funds returned. |

### Rationale for Canonical State Choices

- **`CAPTURED` vs `SUCCEEDED`:** In payment and commerce domains, `SUCCEEDED` is ambiguous because an authorization can "succeed" without moving funds. Order fulfillment requires settled funds. Using `CAPTURED` eliminates ambiguity and maps directly to the financial invariant.
- **Handling of `REQUIRES_ACTION`:** In Razorpay Standard Checkout (and UPI/3DS), customer OTP/redirection happens within the provider's client-side SDK modal. The platform's internal state remains `PENDING` until webhook or client callback delivers verified cryptographic proof. A separate `REQUIRES_ACTION` state is not required at the aggregate level for Demo.
- **Requirement for `REQUIRES_RECONCILIATION`:** External network calls can fail ambiguously. If an HTTP call to Razorpay times out during capture, treating it as `FAILED` risks charging a customer without delivering goods, while treating it as `CAPTURED` risks fulfilling unpaid orders. `REQUIRES_RECONCILIATION` isolates ambiguous transactions for safe background resolution.

### Permitted State Transitions

```text
CREATED
  ├── pending ────────────────► PENDING
  ├── cancel ─────────────────► CANCELLED
  └── fail ───────────────────► FAILED

PENDING
  ├── processing ─────────────► PROCESSING
  ├── authorize ──────────────► AUTHORIZED
  ├── capture (auto/direct) ──► CAPTURED
  ├── fail ───────────────────► FAILED
  ├── cancel ─────────────────► CANCELLED
  └── network timeout/error ──► REQUIRES_RECONCILIATION

PROCESSING
  ├── authorize ──────────────► AUTHORIZED
  ├── capture ────────────────► CAPTURED
  ├── fail ───────────────────► FAILED
  └── ambiguous outcome ──────► REQUIRES_RECONCILIATION

AUTHORIZED
  ├── capture ────────────────► CAPTURED
  ├── cancel/void ────────────► CANCELLED
  ├── fail ───────────────────► FAILED
  └── timeout during capture ─► REQUIRES_RECONCILIATION

CAPTURED
  ├── partial refund ─────────► PARTIALLY_REFUNDED
  └── full refund ────────────► REFUNDED

PARTIALLY_REFUNDED
  ├── subsequent partial ─────► PARTIALLY_REFUNDED
  └── final refund (sum==cap) ─► REFUNDED

REQUIRES_RECONCILIATION
  ├── verified authorized ───► AUTHORIZED
  ├── verified captured ─────► CAPTURED
  ├── verified failed ───────► FAILED
  └── verified cancelled ────► CANCELLED
```

### Forbidden Transitions & Invariants

1. **Terminal State Immutability:** `REFUNDED`, `CANCELLED`, and `FAILED` are terminal. They cannot transition to any active payment state.
2. **No Backward Movement from Captured:** `CAPTURED` cannot transition backward to `CREATED`, `PENDING`, `PROCESSING`, `AUTHORIZED`, `FAILED`, or `CANCELLED`.
3. **No Uncaptured Refunds:** A payment cannot enter `PARTIALLY_REFUNDED` or `REFUNDED` from `CREATED`, `PENDING`, `PROCESSING`, `AUTHORIZED`, or `FAILED`.
4. **Stale / Out-of-Order Webhook Protection:** A webhook delivering an earlier status (e.g. `payment.authorized` or `payment.pending` arriving after `payment.captured`) must be acknowledged and logged, but must NEVER overwrite or regress a more advanced state.

---

# 8. Payment Attempt Lifecycle

An individual `payment_attempt` records a single interaction cycle with Razorpay:

```text
INITIATED
   ├── order created ───────► PENDING
   ├── direct fail ─────────► FAILED
   └── cancel ──────────────► CANCELLED

PENDING
   ├── authorized ──────────► AUTHORIZED
   ├── captured ────────────► CAPTURED
   ├── failed / declined ───► FAILED
   ├── cancelled ───────────► CANCELLED
   └── timeout / ambiguous ─► REQUIRES_RECONCILIATION

AUTHORIZED
   ├── captured ────────────► CAPTURED
   └── voided / failed ─────► FAILED / CANCELLED

REQUIRES_RECONCILIATION
   ├── resolved success ────► CAPTURED
   └── resolved failed ─────► FAILED
```

---

# 9. Payment Provider Abstraction

The core application and Checkout domain must never depend directly on Razorpay SDKs or Razorpay-specific types.

```text
Checkout / API Layer
        ↓
Payments Application Service
        ↓
PaymentProvider Interface
        ↓
RazorpayPaymentProvider Adapter (or SandboxPaymentProvider)
        ↓
External Razorpay API (HTTPS)
```

### Provider Interface Contract

```typescript
export interface PaymentProvider {
  createOrder(input: CreateProviderOrderInput): Promise<ProviderOrderResult>;
  capturePayment(input: CaptureProviderPaymentInput): Promise<ProviderPaymentResult>;
  verifyPaymentSignature(input: VerifySignatureInput): boolean;
  verifyWebhookSignature(rawBody: string | Buffer, signature: string, secret: string): boolean;
  getPaymentStatus(providerPaymentId: string): Promise<ProviderPaymentResult>;
  createRefund(input: CreateProviderRefundInput): Promise<ProviderRefundResult>;
}
```

---

# 10. Provider Adapter: Razorpay Implementation Requirements

Demo integrates **Razorpay** as the primary external payment gateway.

### Verified Razorpay API Requirements & Contracts

1. **Authentication:**
   - Standard HTTP Basic Authentication using `Key ID` (username) and `Key Secret` (password).
   - Configured server-side via `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. Must never be exposed to clients or logged.

2. **Order Creation:**
   - Endpoint: `POST https://api.razorpay.com/v1/orders`
   - Payload:
     - `amount`: Monetary amount in the smallest currency unit (e.g. paise for INR: 10000 = ₹100.00). Must be an integer `BIGINT`.
     - `currency`: 3-letter ISO code (e.g. `"INR"`, `"USD"`).
     - `receipt`: Internal payment attempt ID or payment ID (serves as provider-side correlation).
     - `payment_capture`: Set to `1` for automatic capture upon authorization, or `0` for manual two-step capture.
     - `notes`: Metadata containing `store_id` and `checkout_id`.
   - Response: `id` (e.g. `order_EKwxwAgItmmXdp`), `status: "created"`, `amount`, `currency`.

3. **Frontend Payment Callback Verification:**
   - When customer completes checkout in the Razorpay Standard Checkout modal, client receives:
     - `razorpay_order_id`
     - `razorpay_payment_id`
     - `razorpay_signature`
   - Server-side cryptographic verification requirement:
     `HMAC-SHA256(order_id + "|" + payment_id, key_secret) === razorpay_signature`
   - Timing-safe comparison must be used. Client submission alone NEVER marks payment as `CAPTURED` without this verification or verified webhook confirmation.

4. **Payment Status Lookup / Reconciliation:**
   - Endpoint: `GET https://api.razorpay.com/v1/payments/{payment_id}`
   - Returns provider status: `"created"`, `"authorized"`, `"captured"`, `"refunded"`, `"failed"`.
   - Used by reconciliation worker for payments in `REQUIRES_RECONCILIATION`.

5. **Refunds:**
   - Endpoint: `POST https://api.razorpay.com/v1/payments/{payment_id}/refund`
   - Payload:
     - `amount`: Refund amount in smallest currency unit (`BIGINT`).
     - `receipt`: Internal refund ID for correlation and duplicate prevention.
     - `notes`: `store_id`, `order_id`, reason.
   - Response: `id` (e.g. `rfnd_EKwzOHskqR2OGv`), `status: "processed"` or `"pending"`, `amount`.

6. **Authoritative Razorpay Documentation References:**
   - Orders API: https://razorpay.com/docs/api/orders/
   - Payments & Capture: https://razorpay.com/docs/api/payments/
   - Webhook Signature Validation: https://razorpay.com/docs/webhooks/validate-test/
   - Refunds API: https://razorpay.com/docs/api/refunds/

---

# 11. Deterministic Sandbox Provider

For automated CI, integration tests, and environments without network access, a `SandboxPaymentProvider` implements `PaymentProvider`:
- Configurable deterministic responses based on test tokens or amount triggers:
  - `amount == 99900` -> declines with `CARD_DECLINED`
  - `amount == 99800` -> simulates network timeout / `REQUIRES_RECONCILIATION`
  - standard amounts -> simulates immediate authorization and capture
- Emits synthetic webhooks with valid HMAC signatures for test validation.

---

# 12. Real Provider Integration Boundary Rules

1. All Razorpay SDK calls must be encapsulated within `RazorpayPaymentProvider` inside `modules/payments/src/providers/`.
2. Razorpay API errors (e.g. `BAD_REQUEST_ERROR`, `GATEWAY_ERROR`) must be caught and mapped into normalized platform errors (`PaymentProviderError`, `PaymentDeclinedError`, `PaymentNetworkError`).
3. Database transactions must NEVER be held open across Razorpay network calls.


---

# 13. Payment Creation

Payment creation begins from a validated Checkout.

The server must determine:

- checkout ID
- store
- amount
- currency
- customer context
- payment method information
- idempotency key

The client must not be trusted to determine the final amount.

---

# 14. Amount Authority

The authoritative amount comes from Checkout.

Conceptually:

```text id="u5m8r2"
Checkout.grand_total
        ↓
Payment.amount
```

A client-provided amount must never override the server-calculated checkout total.

---

# 15. Currency Authority

Payment currency must match checkout currency.

```text id="e9p3v6"
Payment.currency == Checkout.currency
```

A mismatch must reject the payment operation.

---

# 16. Amount Verification

When a provider reports success, the platform must verify:

```text id="f2k7n4"
provider_amount == expected_amount
```

and:

```text id="b8m5q1"
provider_currency == expected_currency
```

A successful provider response with an unexpected amount must not automatically finalize the order.

---

# 17. Payment Method Data

The platform should not store raw payment credentials.

For card payments, use provider-hosted fields, tokens, payment intents, or equivalent provider-managed mechanisms.

Do not store:

- full card numbers
- CVV
- provider secret keys
- sensitive authentication material

---

# 18. Payment Initiation

Conceptually:

```text id="t6p9w3"
Checkout
 ↓
Validate checkout
 ↓
Create Payment
 ↓
Create PaymentAttempt
 ↓
Provider operation
 ↓
Persist provider result
```

The provider operation must be safely retryable.

---

# 19. Pending Payments

A provider may return a pending state.

In this case:

```text id="r4m8y2"
Payment = PENDING
```

The checkout must not be marked completed.

The system waits for:

- provider confirmation
- webhook
- explicit provider status check
- recovery process

---

# 20. Authorization and Capture

Where the provider supports separate authorization and capture:

```text id="j7q3n5"
AUTHORIZED
    ↓
CAPTURED
```

The Demo payment flow may simplify this into immediate capture.

The architecture must still allow authorization/capture separation later.

---

# 21. Capture

Capture represents successful movement of funds according to the provider's payment model.

A capture must be idempotent.

Repeated capture requests must not capture the same payment multiple times.

---

# 22. Payment Failure

Payment failures must be persisted with safe diagnostic information.

Conceptually:

```text id="m3f8k2"
PaymentAttempt
    ↓
FAILED
    ↓
failure_code
failure_reason
```

Provider secrets or sensitive credentials must never be persisted in failure messages.

---

# 23. Retry Behavior

A failed payment may be retried.

Each attempt should be independently identifiable.

Example:

```text id="x9v4c6"
Payment
 ├── Attempt 1 → FAILED
 └── Attempt 2 → SUCCEEDED
```

Only the successful attempt contributes to successful payment state.

---

# 24. Duplicate Payment Prevention

The system must prevent:

```text id="p5q7r1"
Same checkout
+
Same logical payment request
+
Repeated request
=
Multiple successful charges
```

Duplicate charges are prevented through a combination of:
1. Database-backed application idempotency records (`idempotency_records`).
2. Partial unique database constraints preventing multiple active payments per checkout (`payments_active_checkout_idx`).
3. Stable provider idempotency keys (`receipt` correlation in Razorpay Orders API).

---

# 25. Durable Database-Backed Idempotency

Payment creation, capture, webhook processing, and refunds must be protected by durable PostgreSQL-backed idempotency.

**Critical Rule:** In-memory maps (`new Map()`) are strictly forbidden as the authoritative record of financial idempotency. Financial operations must survive application restarts and execute safely across multiple server replicas.

### Idempotency Key Scope and Uniqueness

- Idempotency records are scoped to `(store_id, scope, idempotency_key)`.
- Enforced at the database level via a `UNIQUE (store_id, scope, idempotency_key)` constraint.
- Scopes:
  - `payments:create`
  - `payments:refund`
  - `checkout:complete`
  - `webhooks:razorpay`

---

# 26. Request Hashing and Idempotency Conflict Semantics

When an incoming request presents an `Idempotency-Key`:
1. The request payload is normalized and serialized to canonical JSON (sorted keys, no extraneous whitespace).
2. A SHA-256 hash is computed: `request_hash = sha256(canonicalPayload)`.
3. If an existing record matches `(store_id, scope, idempotency_key)`:
   - **Payload Hash Mismatch:** If `existing.request_hash !== request_hash`, the request is immediately rejected with HTTP 409 Conflict (`PAYMENT_IDEMPOTENCY_CONFLICT`).
   - **In-Progress Operation:** If `existing.status === 'IN_PROGRESS'`, a concurrent execution is active; return HTTP 409 Conflict with `Retry-After: 2`.
   - **Completed Operation:** If `existing.status === 'COMPLETED'`, the operation is replayed safely by returning the persisted `response_body` and `response_status` without re-executing business logic or external provider calls.

---

# 27. Idempotency Schema & Storage Specification

### Schema Definition (Migration Requirement)

```sql
CREATE TABLE idempotency_records (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  response_status INT,
  response_body JSONB,
  resource_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT idempotency_records_store_scope_key_unique UNIQUE (store_id, scope, idempotency_key),
  CONSTRAINT idempotency_records_status_check CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED'))
);

CREATE INDEX idempotency_records_store_idx ON idempotency_records (store_id);
CREATE INDEX idempotency_records_expires_at_idx ON idempotency_records (expires_at);
```

### Payment Attempts vs Parent Aggregate & Provider Keys

- **Parent Payment Aggregate:** Represents the overall purchase attempt for a checkout (`payments`).
- **Payment Attempt:** Represents a specific attempt with Razorpay (`payment_attempts`).
- **Operation Retry vs New Attempt:**
  - An HTTP retry with the same `Idempotency-Key` returns the existing `payment_attempt` result (replayed response).
  - A customer-driven retry after a verified payment failure creates a NEW `payment_attempt` with an incremented `attempt_number` and a new `Idempotency-Key`, while linking to the existing or newly allowed payment aggregate.
- **Stable Provider Idempotency Keys:** When calling Razorpay Orders API, the `receipt` parameter is populated with the deterministic `attempt.id` (or `payment.id`), ensuring Razorpay deduplicates the order if the network request is retried.
- **Retention & Cleanup Policy:** Idempotency records have a default TTL of 24 hours (`expires_at = NOW() + INTERVAL '24 hours'`). Records for completed financial transactions are retained for at least 7 days for auditability before partition or background cleanup.

---

# 28. Webhook Processing Architecture

Razorpay notifies the platform asynchronously of payment status updates.

```text id="s6m3q8"
External Razorpay Gateway
        ↓ POST /api/v1/webhooks/payments/razorpay
Preserve Raw Request Bytes (Buffer)
        ↓
Cryptographic Signature Verification (HMAC-SHA256)
        ↓ [Invalid: HTTP 400/401 Reject]
Durable Event Deduplication (INSERT INTO payment_webhook_events)
        ↓ [Duplicate: HTTP 200 Acknowledge]
Execute Transactional State Update (SELECT ... FOR UPDATE)
        ↓
Commit Local Database Transaction
        ↓
Trigger Downstream Checkout / Order Completion
        ↓
HTTP 200 OK Response to Razorpay
```

---

# 29. Webhook Signature Verification Requirements

1. **Raw Body Byte Preservation:**
   - In Next.js App Router API route (`/api/v1/webhooks/payments/razorpay`), the handler MUST preserve the exact raw request body buffer before any JSON parsing.
   - Any re-serialization of parsed JSON modifies byte order/whitespace and invalidates HMAC signatures.
2. **Signature Verification Algorithm:**
   - Extract header: `X-Razorpay-Signature`.
   - Compute: `expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBodyBuffer).digest('hex')`.
   - Verification: `crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(receivedSignature))`.
   - Webhook processing must immediately abort with HTTP 400 Bad Request if the signature is invalid or missing.
3. **Execution Boundary:**
   - Signature verification occurs BEFORE entering any database transaction or mutating any entity.

---

# 30. Webhook Event Entity & Schema Specification

Every verified webhook payload is durably recorded in `payment_webhook_events`.

### Schema Definition (Migration Requirement)

```sql
CREATE TABLE payment_webhook_events (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores (id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'razorpay',
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB NOT NULL,
  payment_id UUID,
  status TEXT NOT NULL DEFAULT 'RECEIVED',
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_webhook_events_provider_event_id_unique UNIQUE (provider, provider_event_id),
  CONSTRAINT payment_webhook_events_status_check CHECK (status IN (
    'RECEIVED',
    'PROCESSING',
    'PROCESSED',
    'IGNORED',
    'FAILED'
  ))
);

CREATE INDEX payment_webhook_events_store_id_idx ON payment_webhook_events (store_id);
CREATE INDEX payment_webhook_events_payment_id_idx ON payment_webhook_events (payment_id);
CREATE INDEX payment_webhook_events_status_idx ON payment_webhook_events (status);
```

---

# 31. Webhook Deduplication and Idempotency

- Razorpay provides event deduplication via header `X-Razorpay-Event-Id` and `event.id` in payload.
- The `UNIQUE (provider, provider_event_id)` constraint guarantees durable deduplication across multiple server instances.
- If an event arrives that already exists with `status = 'PROCESSED'`:
  - Return HTTP 200 OK immediately.
  - Do NOT re-execute order creation, inventory finalization, or payment transitions.

---

# 32. Out-of-Order and Stale Webhook Handling

Webhooks may arrive out of chronological order (e.g. `payment.authorized` delivered after `payment.captured`).

**Stale Event Rules:**
1. If internal payment status is `CAPTURED`:
   - A subsequent `payment.authorized` or `payment.pending` event is recognized as stale.
   - The event is marked `status = 'IGNORED'` in `payment_webhook_events`.
   - The payment status is NOT changed.
   - Return HTTP 200 OK.
2. If internal payment status is `CAPTURED`:
   - A subsequent `payment.failed` event cannot move the payment backward to `FAILED`. It is logged as an anomaly for reconciliation.
3. If internal payment status is `REFUNDED`:
   - No payment event can move it back to `CAPTURED` or `PENDING`.

---

# 33. Webhook Processing Transaction

Webhook handling must follow strict transactional boundaries:
1. Verify raw HMAC signature outside transaction.
2. Begin local PostgreSQL transaction:
   - Insert webhook event record into `payment_webhook_events` (or skip if already recorded).
   - Lock target payment row with `SELECT ... FOR UPDATE`.
   - Validate state transition.
   - Update `payments` row (e.g. status to `CAPTURED`, set `captured_amount`).
   - Update `payment_attempts` row to `CAPTURED`.
   - Mark webhook event `status = 'PROCESSED'`.
3. Commit transaction.
4. Execute checkout completion / order creation downstream.

---

# 34. Webhook and External Calls Boundary

- External API calls (to Razorpay or email providers) MUST NEVER execute inside the open PostgreSQL transaction.
- If external work or status confirmation is needed:
  `Commit local transaction -> Dispatch external call -> Persist result in new transaction`.

---

# 35. Checkout Integration & Completion Contract

The Payments domain integrates with Checkout to authorize order creation while preserving strict domain boundaries.

### Checkout Completion Contract

1. **Pre-Payment State:** Checkout must be in status `PAYMENT_PENDING` before a payment can be captured (transitioned from `OPEN` via `checkoutService.beginPayment()`).
2. **Authoritative Amounts:** Payment amount and currency are derived strictly from server-calculated `checkout.total` and `checkout.currency`.
3. **Snapshot Immutability:** Once a payment attempt is created, its amount and currency are snapshotted and completely immutable.
4. **No Client Trust:** An API caller, client token, or webhook cannot directly complete a checkout without server-side verification of payment state.
5. **Verified Captured Requirement:** Under the Demo payment model, ONLY a verified, `CAPTURED` payment aggregate authorizes checkout completion.
6. **Checkout State Transition:** Checkout completion enforces the valid transition `PAYMENT_PENDING -> COMPLETED`.
7. **Idempotent Order Creation:** Duplicate payment-captured events must not create duplicate orders. If an order already exists for `(store_id, checkout_id)`, checkout completion returns the existing order record.
8. **Failure & Retry Contract:** If payment fails (`FAILED`), checkout transitions `PAYMENT_PENDING -> OPEN` via `checkout.markPaymentFailed()`, releasing temporary locks and allowing the customer to retry with a new payment attempt.
9. **Ambiguous Outcome Contract:** If a payment outcome is ambiguous (`REQUIRES_RECONCILIATION`), checkout remains in `PAYMENT_PENDING`. It is neither marked completed nor failed until reconciliation completes.
10. **Order Creation Recovery Path:** If payment is successfully committed as `CAPTURED` but order creation fails (e.g. process crash or database error during order creation), the payment and checkout remain safely durable in PostgreSQL. A background recovery worker detects checkouts in `PAYMENT_PENDING` with captured payments and resumes order creation idempotently using `checkout.id` as the order idempotency key.

---

# 36. Order Integration

- Once an order is created, the `payments.order_id` field is populated with the new order ID.
- The Orders module owns order fulfillment, shipments, and customer-facing order lifecycle.
- Payments does not mutate order fulfillment status directly; it communicates financial state via domain events (`PaymentCaptured`, `PaymentRefunded`).

---

# 37. Payment and Order State Decoupling

Payment status and Order status are distinct business entities:

| Scenario | Payment Status | Order Status |
|---|---|---|
| Order placed, fulfillment pending | `CAPTURED` | `PENDING` / `CONFIRMED` |
| Order fully fulfilled | `CAPTURED` | `DELIVERED` / `COMPLETED` |
| Items returned, partial refund | `PARTIALLY_REFUNDED` | `CONFIRMED` / `PROCESSING` |
| Full return & refund | `REFUNDED` | `CANCELLED` |

---

# 38. Refunds Domain Specification

**Refunds are fully in scope for Demo implementation.**

### Supported Refund Scenarios
- Full refunds (100% of captured amount).
- Partial refunds (multiple partial refunds up to captured amount).
- Duplicate refund request protection via database idempotency.
- Concurrent refund request protection via row-level locking.
- Provider outcome handling (immediate success, pending, failed, reconciliation).

---

# 39. Refund Entity & Schema Specification

### Schema Definition (Migration Requirement)

```sql
CREATE TABLE refunds (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT,
  payment_id UUID NOT NULL,
  order_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'razorpay',
  provider_refund_id TEXT,
  amount BIGINT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  reason TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT refunds_id_store_id_unique UNIQUE (id, store_id),
  CONSTRAINT refunds_payment_store_fkey FOREIGN KEY (payment_id, store_id)
    REFERENCES payments (id, store_id) ON DELETE RESTRICT,
  CONSTRAINT refunds_order_store_fkey FOREIGN KEY (order_id, store_id)
    REFERENCES orders (id, store_id) ON DELETE RESTRICT,
  CONSTRAINT refunds_amount_check CHECK (amount > 0),
  CONSTRAINT refunds_currency_format_check CHECK (currency = UPPER(TRIM(currency)) AND LENGTH(currency) = 3),
  CONSTRAINT refunds_status_check CHECK (status IN (
    'PENDING',
    'PROCESSING',
    'SUCCEEDED',
    'FAILED',
    'REQUIRES_RECONCILIATION'
  ))
);

CREATE INDEX refunds_store_id_idx ON refunds (store_id);
CREATE INDEX refunds_payment_id_idx ON refunds (payment_id);
CREATE INDEX refunds_order_id_idx ON refunds (order_id);
CREATE INDEX refunds_store_status_idx ON refunds (store_id, status);
CREATE UNIQUE INDEX refunds_idempotency_idx ON refunds (store_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX refunds_provider_refund_idx ON refunds (provider, provider_refund_id)
  WHERE provider_refund_id IS NOT NULL;
```

---

# 40. Refund Rules, Limits & Concurrency Protection

1. **Allowed Source States:** A refund can ONLY be initiated if the parent payment is in `CAPTURED` or `PARTIALLY_REFUNDED`.
2. **Amount Validation:**
   - `amount` must be a positive integer `BIGINT` > 0.
   - `currency` must match payment currency.
   - `requested_amount <= (payment.captured_amount - payment.refunded_amount)`.
3. **Concurrent Refund Serialization:**
   - The application service MUST execute `SELECT * FROM payments WHERE id = $1 AND store_id = $2 FOR UPDATE`.
   - This row lock serializes all concurrent refund attempts on the payment.
   - The remaining refundable amount is verified under the lock.
   - A `PENDING` refund record is inserted, and a provisional reservation or transaction commit occurs before calling Razorpay.
4. **Database Check Constraint Barrier:**
   - In addition to service checks, the database constraint `payments_refunded_amount_check CHECK (refunded_amount >= 0 AND refunded_amount <= captured_amount)` acts as an unbreakable barrier against oversights.

---

# 41. Refund Execution & Provider Workflow

1. Merchant initiates refund via `POST /api/v1/stores/:storeId/payments/:paymentId/refunds`.
2. Step 1 (Local Transaction):
   - Check `idempotency_records`.
   - Lock `payments` row `FOR UPDATE`.
   - Verify `payment.status IN ('CAPTURED', 'PARTIALLY_REFUNDED')`.
   - Verify `amount <= (payment.captured_amount - payment.refunded_amount)`.
   - Insert `refunds` record with `status = 'PENDING'`.
   - Commit local transaction (release database lock).
3. Step 2 (External Call):
   - Call Razorpay API: `POST https://api.razorpay.com/v1/payments/{payment_id}/refund`.
   - Pass `amount` (paise) and `receipt` (`refund.id`).
4. Step 3 (Outcome Persistence):
   - Open new database transaction.
   - If Razorpay returns `status: "processed"`:
     - Update `refunds` row: `status = 'SUCCEEDED'`, `provider_refund_id = res.id`.
     - Update `payments` row: increment `refunded_amount = refunded_amount + refund.amount`.
     - If `payment.refunded_amount == payment.captured_amount`, set `payment.status = 'REFUNDED'`; else `payment.status = 'PARTIALLY_REFUNDED'`.
     - Publish `PaymentRefunded` domain event.
   - If Razorpay returns `status: "pending"`:
     - Update `refunds` row: `status = 'PENDING'`, await webhook `refund.processed`.
   - If Razorpay returns error / failure:
     - Update `refunds` row: `status = 'FAILED'`.
   - If timeout / network error:
     - Update `refunds` row: `status = 'REQUIRES_RECONCILIATION'`, await reconciliation or webhook.
   - Commit transaction.

---

# 42. Refund Authorization Model

Refunds are merchant-only operations requiring verified store permissions:

| Operation | Store Owner | Store Admin | Store Staff | Customer |
|---|---|---|---|---|
| View payments | Yes | Yes | Yes | Self-only |
| View payment attempts | Yes | Yes | Yes | No |
| Initiate refund | Yes | Yes | No | **Forbidden (403)** |
| View refunds | Yes | Yes | Yes | No |
| Manage provider keys | Yes | No | No | **Forbidden (403)** |

---

# 43. Refund and Orders Boundary

- Payments owns the financial refund transaction and ledger (`refunds`, `payments.refunded_amount`).
- Once a refund succeeds, Payments publishes `PaymentRefunded` via the Event Bus.
- The Orders module listens to `PaymentRefunded` and updates order financial status (`PARTIALLY_REFUNDED` or `REFUNDED`), audit logs, and customer notifications.
- Payments never directly mutates Orders database tables.

---

# 44. Payment Provider Configuration

Provider configuration is scoped per store or system-wide environment:
- `RAZORPAY_KEY_ID`: Public key identifier.
- `RAZORPAY_KEY_SECRET`: Secret key for API authentication and callback HMAC verification.
- `RAZORPAY_WEBHOOK_SECRET`: Secret for verifying `X-Razorpay-Signature` on incoming webhooks.
- Secrets must never be stored in plain database fields or committed to git.

---

# 45. Provider Secrets Security

Secrets must be supplied via secure server environment variables.
They must not be:
- Hardcoded in source files.
- Returned in API responses.
- Written to operational logs.
- Bundled into client-side code.

---

# 46. Sandbox Configuration

Demo environments should use Razorpay test mode credentials (`rzp_test_...`).
Production credentials are strictly prohibited in development and Demo environments.

---

# 47. Payment API Contracts & Store-Scoped Route Naming

In accordance with the repository's established store-scoped API architecture:

### Endpoints

```text
POST /api/v1/stores/:storeId/checkouts/:checkoutId/payments
GET  /api/v1/stores/:storeId/payments/:paymentId
POST /api/v1/stores/:storeId/payments/:paymentId/refunds
GET  /api/v1/stores/:storeId/payments/:paymentId/refunds
POST /api/v1/webhooks/payments/razorpay
```

### Route Contracts

#### 1. Create Payment for Checkout
- **Method / Path:** `POST /api/v1/stores/:storeId/checkouts/:checkoutId/payments`
- **Auth:** Store staff/admin or active customer owning the checkout.
- **Headers:** `Idempotency-Key` (required), `Content-Type: application/json`.
- **Request Body:**
  ```json
  {
    "provider": "razorpay"
  }
  ```
- **Response (HTTP 201 Created):**
  ```json
  {
    "paymentId": "uuid",
    "attemptId": "uuid",
    "provider": "razorpay",
    "providerOrderId": "order_EKwxwAgItmmXdp",
    "amount": 10000,
    "currency": "INR",
    "status": "PENDING",
    "razorpayKeyId": "rzp_test_..."
  }
  ```

#### 2. Get Payment Status
- **Method / Path:** `GET /api/v1/stores/:storeId/payments/:paymentId`
- **Auth:** Store staff, admin, owner.
- **Response (HTTP 200 OK):**
  ```json
  {
    "id": "uuid",
    "storeId": "uuid",
    "checkoutId": "uuid",
    "orderId": "uuid",
    "amount": 10000,
    "currency": "INR",
    "status": "CAPTURED",
    "capturedAmount": 10000,
    "refundedAmount": 0,
    "createdAt": "2026-10-09T10:00:00Z"
  }
  ```

#### 3. Initiate Refund
- **Method / Path:** `POST /api/v1/stores/:storeId/payments/:paymentId/refunds`
- **Auth:** Store admin or owner (HTTP 403 for staff).
- **Headers:** `Idempotency-Key` (required).
- **Request Body:**
  ```json
  {
    "amount": 4000,
    "reason": "Customer return - damaged goods"
  }
  ```
- **Response (HTTP 201 Created):**
  ```json
  {
    "id": "uuid",
    "paymentId": "uuid",
    "amount": 4000,
    "currency": "INR",
    "status": "SUCCEEDED",
    "providerRefundId": "rfnd_EKwzOHskqR2OGv",
    "remainingRefundable": 6000
  }
  ```

---

# 48. Provider Webhook API Contract

- **Method / Path:** `POST /api/v1/webhooks/payments/razorpay`
- **Auth:** Public trust boundary. Authenticated strictly via HMAC signature.
- **Headers:**
  - `X-Razorpay-Signature`: HMAC-SHA256 signature over raw request body.
  - `X-Razorpay-Event-Id`: Unique event ID.
- **Raw Request Body:** UTF-8 raw payload preserved before JSON parsing.
- **Response:**
  - Valid & processed: HTTP 200 `{"received": true}`.
  - Valid & duplicate: HTTP 200 `{"received": true, "duplicate": true}`.
  - Invalid signature: HTTP 400 Bad Request `{"error": "Invalid signature"}`.


---

# 49. Payment Error Conditions

Structured errors should include:

```text id="m5q8x3"
PAYMENT_NOT_FOUND
PAYMENT_ACCESS_DENIED
PAYMENT_AMOUNT_MISMATCH
PAYMENT_CURRENCY_MISMATCH
PAYMENT_ALREADY_CAPTURED
PAYMENT_ALREADY_REFUNDED
PAYMENT_FAILED
PAYMENT_PENDING
PAYMENT_PROVIDER_ERROR
PAYMENT_IDEMPOTENCY_CONFLICT
PAYMENT_INVALID_STATE
PAYMENT_REFUND_LIMIT_EXCEEDED
PAYMENT_WEBHOOK_INVALID
PAYMENT_WEBHOOK_REPLAYED
```

---

# 50. Payment Access Isolation

Payment records must be scoped by Store and associated business entity.

A customer must not be able to retrieve another customer's payment.

A merchant must not access payments belonging to another Store.

---

# 51. Payment State Transitions

State transitions must be explicit.

Example:

```text id="w9c4p7"
CREATED → PENDING
PENDING → AUTHORIZED
PENDING → FAILED
AUTHORIZED → CAPTURED
AUTHORIZED → CANCELLED
CAPTURED → PARTIALLY_REFUNDED
CAPTURED → REFUNDED
```

Invalid transitions must be rejected.

---

# 52. Provider State Mapping

Provider-specific states must be mapped into platform states.

For example:

```text id="r3k7m5"
Provider:
requires_action

Platform:
PENDING
```

Provider-specific terminology must not leak throughout the application.

---

# 53. Provider Failure Mapping

Provider errors should be normalized.

Conceptually:

```text id="j8v2n6"
Provider timeout
Provider declined
Provider invalid request
Provider unavailable
```

may map to platform-level error categories.

Raw provider responses may be retained securely for diagnostics where appropriate.

---

# 54. Payment Reconciliation

The architecture should allow reconciliation between:

```text id="y5p8q3"
Platform payment state
        ↕
Provider payment state
```

Demo may implement basic manual or worker-assisted reconciliation.

Advanced financial reconciliation is outside Demo scope.

---

# 55. Recovery Processing

A background worker may identify inconsistent states such as:

```text id="x4m7r2"
Payment provider = SUCCESS
Platform = PENDING
```

and initiate safe state reconciliation.

All recovery operations must be idempotent.

---

# 56. Observability

Payment logs should include:

```text id="p7c3n8"
payment_id
payment_attempt_id
store_id
checkout_id
order_id
provider
provider_reference
operation
status
request_id
error_code
duration
```

Never log:

- card numbers
- CVV
- authentication secrets
- private payment credentials

---

# 57. Metrics

Useful metrics include:

- payment success rate
- payment failure rate
- pending payment count
- provider error rate
- webhook processing failures
- refund success rate
- duplicate/idempotency conflicts
- payment processing latency

Metrics must avoid exposing sensitive customer data.

---

# 58. Testing Requirements

Unit tests must cover:

- payment state transitions
- amount validation
- currency validation
- provider mapping
- failure mapping
- refund limits
- idempotency behavior
- webhook event processing

---

# 59. Integration Tests

Integration tests must cover:

- sandbox provider
- payment creation
- successful payment
- failed payment
- pending payment
- webhook processing
- duplicate webhook delivery
- capture
- cancellation
- refunds
- payment isolation
- checkout integration

---

# 60. Webhook Tests

At minimum:

```text id="g6r9k2"
Valid signature
    ↓
Event accepted
    ↓
Payment updated

Same event again
    ↓
No duplicate business effect
```

Invalid signatures must be rejected.

---

# 61. Payment Failure Test

Test:

```text id="n4p8x6"
Checkout
 ↓
Payment attempt
 ↓
Provider declines
 ↓
Payment = FAILED
 ↓
Checkout remains recoverable
 ↓
Inventory reservation released
```

---

# 62. Duplicate Payment Test

Send the same payment request repeatedly.

Expected:

```text id="v7m3q5"
One logical payment
One successful provider operation
No duplicate charge
```

---

# 63. Refund Test

Test:

```text id="k5r8c2"
Captured = ₹1,000
Refund = ₹400
Refund succeeds
```

Then:

```text id="m2x7p4"
Refunded = ₹400
Remaining refundable = ₹600
```

A second refund exceeding ₹600 must be rejected.

---

# 64. End-to-End Payment Flow

Complete Demo flow:

```text id="f8q3n7"
Customer
  ↓
Cart
  ↓
Checkout
  ↓
Payment
  ↓
Provider
  ↓
Payment confirmation
  ↓
Order
  ↓
Inventory commitment
  ↓
Checkout completion
```

---

# 65. Failure Recovery Flow

Example:

```text id="y2m6r9"
Provider confirms payment
       ↓
Application unavailable
       ↓
Webhook/event persisted
       ↓
Worker retries processing
       ↓
Payment reconciled
       ↓
Order creation resumed
```

The final system must converge to a correct state without duplicate financial effects.

---

# 66. Anti-Patterns

Do not:

- trust frontend payment success
- trust frontend payment amounts
- store raw card data
- directly couple Checkout to provider SDKs
- treat webhook delivery as exactly once
- process duplicate webhooks as new payments
- perform long provider calls inside database transactions
- allow refunds beyond captured amount
- create duplicate charges on retries
- expose provider secrets
- expose raw provider credentials through APIs
- build a payment microservice for Demo

---

# 67. Demo Implementation Boundary

The Demo implementation should use:

```text id="r7k4n2"
modules/payments
packages/db
packages/auth
packages/tenant
packages/validation
packages/event-bus
```

Interactions:

```text id="h5m8q3"
Payments
 ├── Checkout → payment orchestration
 ├── Orders → financial order relationship
 ├── Stores → provider configuration
 └── External Provider → payment execution
```

Provider-specific implementation must remain isolated from the rest of the application.

---

# 68. Demo-to-V1 Evolution

The Payments domain should support future additions such as:

- multiple providers
- payment routing
- saved payment methods
- authorization/capture flows
- fraud checks
- 3DS/SCA handling
- automated reconciliation
- chargebacks
- subscription billing
- regional payment methods
- multi-currency settlement

These should be added behind the Payments boundary rather than spreading provider-specific logic throughout Checkout or Orders.

---

# 69. Acceptance Criteria

The Payments module is complete for Demo when:

- Sandbox payments are supported.
- Payment providers are accessed through an abstraction.
- Payment attempts are persisted.
- Payment states are explicit and validated.
- Payment amount is derived from authoritative Checkout state.
- Currency is verified.
- Provider success is verified server-side.
- Duplicate payment requests are safely handled.
- Idempotency conflicts are detected.
- Payment webhooks are signature-verified.
- Duplicate webhook events are safely ignored.
- Failed payments do not create completed orders.
- Pending payments can be resumed.
- Payment recovery is supported.
- Refunds are supported where required.
- Refund amounts cannot exceed captured amounts.
- Refunds are idempotent.
- Payment access is store-scoped.
- Sensitive payment information is not stored.
- Provider secrets are securely managed.
- Integration tests cover success, failure, pending, webhook, retry, and refund flows.
- End-to-end checkout-to-payment-to-order flow works correctly.