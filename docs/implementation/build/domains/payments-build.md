# Payments Domain Build Implementation

## 1. Purpose

This document defines the concrete implementation approach for the Payments domain in the Demo.

Payments is a critical commerce boundary. The implementation must handle payment creation, provider interaction, payment state, retries, webhooks, refunds, and reconciliation without allowing external provider behavior to corrupt local commerce state.

The central principle is:

> The payment provider is an external dependency. The Payments domain is the authoritative source for the platform's normalized payment state.

---

# 2. Domain Ownership

The Payments module owns:

- Payment records.
- Payment intents where applicable.
- Payment attempts.
- Payment state.
- Provider references.
- Provider adapter contracts.
- Refund records.
- Payment idempotency.
- Payment webhook state integration.
- Provider-state normalization.
- Payment reconciliation requirements.

It does not own:

- Checkout orchestration.
- Orders.
- Inventory.
- Customers.
- Products.
- Discount rules.
- Authentication.

---

# 3. Module Location

Implementation belongs under:

```text id="v5r8m4"
modules/payments/
```

Recommended structure:

```text id="m7q4r6"
modules/payments/
├── domain/
├── application/
├── infrastructure/
└── index.ts
```

The exact internal layout should follow repository conventions.

---

# 4. Payment Model

The Demo should distinguish between:

```text id="x8m4r7"
Payment
Payment Attempt
Refund
Provider Reference
```

A Payment represents the platform-level financial operation.

An Attempt represents an individual interaction with the payment provider.

A Refund represents money returned after a payment according to the approved refund workflow.

---

# 5. Canonical Payment Lifecycle

The payment state machine follows the approved canonical domain specification:

```text id="q5r8m4"
CREATED
PENDING
PROCESSING
AUTHORIZED
CAPTURED
FAILED
CANCELLED
REQUIRES_RECONCILIATION
PARTIALLY_REFUNDED
REFUNDED
```

### Key Semantics
- **`CAPTURED`:** Represents successful settlement of funds. **Only `CAPTURED` payments authorize checkout completion and order fulfillment.**
- **`REQUIRES_RECONCILIATION`:** Represents ambiguous gateway outcomes (such as network timeouts during capture or webhook amount discrepancies) awaiting background resolution.
- **Customer Action:** Subsumed under `PENDING` while the customer interacts with the Razorpay modal.
- **Attempt Lifecycle:** `INITIATED` → `PENDING` → `AUTHORIZED` → `CAPTURED` / `FAILED` / `CANCELLED` / `REQUIRES_RECONCILIATION`.
- **Refund Lifecycle:** `PENDING` → `PROCESSING` → `SUCCEEDED` / `FAILED` / `REQUIRES_RECONCILIATION`.

---

# 6. State Transitions

Payment state changes occur through explicit application operations:

```text id="v6m4r8"
createPayment()
initializePaymentAttempt()
markPending()
markCaptured()
markFailed()
markRequiresReconciliation()
cancelPayment()
refundPayment()
```

The implementation must strictly reject invalid transitions, and stale webhook events must never regress a more advanced state.


---

# 7. Payment Amount

Every payment must have an authoritative amount.

The amount must originate from Checkout's validated final purchase amount.

The client must never directly determine the payment amount.

---

# 8. Money Representation

Payment amounts must use the approved exact monetary representation.

Never use floating-point arithmetic for authoritative financial values.

The implementation must preserve:

```text id="m8q4r6"
amount
currency
```

with exact semantics.

---

# 9. Provider Abstraction

The Payments domain must depend on a provider abstraction rather than directly coupling business logic to a provider SDK.

Conceptually:

```text id="x4r7m8"
Payments Application
        ↓
Payment Provider Interface
        ↓
Provider Adapter
        ↓
External Provider
```

---

# 10. Provider Adapter

The adapter is responsible for translating between:

```text id="q7m5r4"
Internal Payment Contract
        ↕
Provider API
```

Provider-specific types must not leak into the domain layer.

---

# 11. Demo Payment Provider: Razorpay

Demo integrates **Razorpay** as the primary external payment gateway.

### Verified Provider Requirements
1. **Authentication:** HTTP Basic Authentication using server-only `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
2. **Order Creation:** `POST https://api.razorpay.com/v1/orders` with `amount` (in paise, `BIGINT`), `currency`, `receipt` (internal attempt ID), and `payment_capture: 1`.
3. **Frontend Callback Verification:** `HMAC-SHA256(order_id + "|" + payment_id, key_secret) === razorpay_signature` using timing-safe comparison.
4. **Webhook Signature Verification:** `HMAC-SHA256(raw_request_body, webhook_secret) === X-Razorpay-Signature`.
5. **Raw Body Byte Preservation:** Next.js API route must preserve raw request bytes before JSON parsing.
6. **Payment Status Lookup:** `GET https://api.razorpay.com/v1/payments/{payment_id}`.
7. **Refunds:** `POST https://api.razorpay.com/v1/payments/{payment_id}/refund` with `amount` (in paise) and `receipt` (`refund.id`).
8. **Official Documentation References:**
   - Orders: https://razorpay.com/docs/api/orders/
   - Payments & Capture: https://razorpay.com/docs/api/payments/
   - Webhooks: https://razorpay.com/docs/webhooks/validate-test/
   - Refunds: https://razorpay.com/docs/api/refunds/


---

# 12. Payment Creation

Payment creation should be initiated by Checkout.

Typical flow:

```text id="x7r4m5"
Checkout
    ↓
Validated payable amount
    ↓
Payments.createPayment()
    ↓
Payment record
    ↓
Provider interaction
    ↓
Payment state
```

---

# 13. Payment Intent

If the selected provider uses payment intents or equivalent objects, the provider reference should be stored separately from the internal Payment ID.

The internal Payment remains the platform's identity.

---

# 14. Provider References

Store provider identifiers required for reconciliation.

Examples:

```text id="q8m4r6"
provider
providerPaymentId
providerAttemptId
```

Never use provider identifiers as the primary domain identity.

---

# 15. Payment Attempts

Each provider interaction should be represented by a Payment Attempt where required.

An attempt should capture enough information to understand:

```text id="v5r7m8"
attempt identity
payment identity
provider
operation
status
provider reference
createdAt
updatedAt
```

Sensitive credentials must never be persisted.

---

# 16. Retry Semantics

Payment operations must be safe against client retries.

A retry must not accidentally create two independent charges for the same logical purchase.

Use:

```text id="m7q4r8"
Application idempotency
+
Provider idempotency where supported
```

---

# 17. Provider Idempotency

Where the provider supports idempotency keys, the Payments adapter should use them.

The provider idempotency identity should be derived from a stable platform operation identity.

Do not generate a new random provider key for every retry of the same logical operation.

---

# 18. Durable Application Idempotency

The platform uses PostgreSQL-backed idempotency to protect all state-mutating payment operations:

```text id="x5r8m4"
HTTP request retries
Worker retries
Webhook retries
Provider timeouts
```

### Storage and Concurrency Contract
- **Durable Storage:** Managed in `idempotency_records` table with unique constraint `UNIQUE (store_id, scope, idempotency_key)`.
- **In-Memory Ban:** In-memory maps (`new Map()`) are strictly prohibited as the authoritative record of financial idempotency.
- **Request Hashing:** SHA-256 hash of canonical JSON request payload. Mismatch with an existing key returns HTTP 409 Conflict (`PAYMENT_IDEMPOTENCY_CONFLICT`).
- **Replay Behavior:** In-progress operations return HTTP 409 with `Retry-After`. Completed operations replay stored `response_body` and `response_status`.
- **Retention:** 24-hour default TTL; financial idempotency retained at least 7 days for auditability.


---

# 19. Timeout Handling

A provider timeout does not necessarily mean payment failure.

For example:

```text id="q6m4r8"
Request sent
    ↓
Network timeout
    ↓
Provider may have processed payment
```

The internal state should therefore support an uncertain/pending condition where required.

---

# 20. Unknown Payment State

When payment outcome is uncertain:

```text id="v8r5m4"
Do not mark FAILED without evidence.
Do not retry blindly.
Do not create another charge.
```

Use provider lookup, webhook confirmation, or reconciliation according to the provider contract.

---

# 21. Payment Webhooks

Payment providers may notify the platform asynchronously.

Webhook handling belongs to the Webhooks integration and Payments domain together:

```text id="m5q7r4"
Webhook
  ↓
Verify signature
  ↓
Persist event
  ↓
Deduplicate
  ↓
Normalize provider event
  ↓
Payments state transition
```

---

# 22. Webhook Authority

A valid provider webhook can update the normalized payment state according to the approved provider contract.

Webhook processing must remain idempotent.

---

# 23. Webhook Ordering

Provider events may arrive:

```text id="x7r4m6"
late
duplicated
out of order
```

The implementation must not blindly assume chronological delivery.

Payment state transitions must reject or safely handle invalid transitions.

---

# 24. Duplicate Webhooks

The same provider event must not cause:

```text id="q5m8r4"
duplicate order creation
duplicate inventory finalization
duplicate payment state transition
duplicate refund
```

Webhook event identity and application idempotency must protect against this.

---

# 25. Payment Success & Checkout Completion Contract

A payment reaches `CAPTURED` only after verified cryptographic proof (HMAC callback verification or verified webhook event).

### Checkout Completion Contract
1. Precondition: Checkout must be in `PAYMENT_PENDING`.
2. Amount & Currency: Derived strictly from server-side checkout snapshot; client cannot alter them.
3. Verification Required: Only a verified, `CAPTURED` payment allows `completeCheckout()`.
4. Transition: Checkout transitions `PAYMENT_PENDING -> COMPLETED`.
5. Idempotent Order Creation: Duplicate capture events return existing order idempotently without creating duplicate charges or reducing inventory twice.
6. Order Creation Recovery: If order creation crashes after payment capture, checkout remains safely in `PAYMENT_PENDING` with durable `CAPTURED` payment; background recovery worker resumes order creation.


---

# 26. Payment Failure

A confirmed payment failure should:

```text id="m8q4r6"
Mark Payment failed
Record attempt result
Expose retryable/non-retryable semantics
Allow Checkout to handle the failure
```

A payment failure must not create a completed Order.

---

# 27. Payment Cancellation

Cancellation must use the approved payment state machine.

If the provider supports cancellation, the provider adapter performs the external operation.

The application then normalizes the result.

---

# 28. Refunds Implementation

**Refunds are fully in scope for Demo implementation.**

The Payments domain owns:
- `refunds` table records.
- Refund amount accounting (`BIGINT` in smallest currency unit).
- Cumulative refunded tracking on parent payment (`payments.refunded_amount`).
- Provider refund references (`provider_refund_id`).
- Concurrency serialization and database-level refund protection.

---

# 29. Refund Amount & Invariants

Refund amounts must:
- Be integer values > 0 in smallest currency unit (`BIGINT`).
- Not exceed `(captured_amount - refunded_amount)`.
- Maintain the strict invariant: `0 <= refunded_amount <= captured_amount`.
- Enforced both at service level and by database constraint `payments_refunded_amount_check`.

---

# 30. Refund State & Lifecycle

```text id="q7m4r5"
PENDING
PROCESSING
SUCCEEDED
FAILED
REQUIRES_RECONCILIATION
```

---

# 31. Refund Concurrency & Execution Sequence

1. Merchant initiates refund via `POST /api/v1/stores/:storeId/payments/:paymentId/refunds`.
2. Open DB Transaction 1:
   - Check `idempotency_records`.
   - Execute `SELECT * FROM payments WHERE id = $1 AND store_id = $2 FOR UPDATE` (locks payment row).
   - Validate `payment.status IN ('CAPTURED', 'PARTIALLY_REFUNDED')`.
   - Validate `amount <= (captured_amount - refunded_amount)`.
   - Insert `refunds` record with `status = 'PENDING'`.
   - Commit DB Transaction 1 (releases lock).
3. Call Razorpay API: `POST /v1/payments/{payment_id}/refund` outside open database transactions.
4. Open DB Transaction 2:
   - Lock payment row `FOR UPDATE`.
   - If Razorpay returns `processed`:
     - Update `refunds`: `status = 'SUCCEEDED'`, `provider_refund_id = res.id`.
     - Increment `payments.refunded_amount += amount`.
     - Update `payments.status` to `REFUNDED` (if sum == captured) or `PARTIALLY_REFUNDED`.
     - Publish `PaymentRefunded` domain event.
   - If Razorpay returns `pending`: set `refunds.status = 'PENDING'`.
   - If Razorpay returns failure: set `refunds.status = 'FAILED'`.
   - If timeout / error: set `refunds.status = 'REQUIRES_RECONCILIATION'`.
   - Commit DB Transaction 2.

---

# 32. Refund Authorization

Refund operations are merchant-controlled operations.

The application must verify:

```text id="v8m4r6"
Authenticated merchant
+
Store access
+
Refund permission
+
Order/payment relationship
```

Customers must not be able to arbitrarily request a provider refund through public APIs.

---

# 33. Order Relationship

Payments may reference the relevant Order once the purchase has produced an Order.

However, the payment record must remain independently identifiable.

Historical payment records must not be silently rewritten when Order information changes.

---

# 34. Checkout Relationship

Checkout creates/orchestrates payment operations.

Payments must not create Checkout records or bypass Checkout's purchase workflow.

---

# 35. Payment State and Order State

Payment status and Order status are different concepts.

For example:

```text id="m6q4r8"
Payment
→ SUCCEEDED

Order
→ FULFILLMENT_PENDING
```

The implementation must not collapse them into one status field.

---

# 36. Provider Error Mapping

Provider-specific failures must be normalized.

Examples:

```text id="x5r8m4"
CARD_DECLINED
PROVIDER_TIMEOUT
PROVIDER_UNAVAILABLE
INVALID_PAYMENT_METHOD
PROVIDER_CONFLICT
```

Provider-specific raw messages should not become the public API contract.

---

# 37. Retryability

Payment errors must indicate whether retry is safe.

Examples:

```text id="q8m5r4"
Card declined
→ not automatically retryable

Provider timeout
→ potentially retryable, but outcome may be uncertain

Provider unavailable before request
→ potentially retryable

Duplicate provider request
→ resolve existing operation rather than charging again
```

---

# 38. Payment Security

The application must not store sensitive payment credentials unless explicitly required and compliant.

The Demo should rely on the payment provider's secure mechanisms.

Never store:

```text id="v7r4m8"
Card number
CVV
Provider secret keys
Raw payment credentials
```

---

# 39. Secrets

Provider credentials must come from server-side configuration.

They must never be:

```text id="m5q8r6"
Returned to clients
Logged
Committed to Git
Stored in frontend bundles
Embedded in database records unnecessarily
```

---

# 40. Client/Server Boundary

The frontend may receive only provider/client tokens explicitly intended for client-side payment collection.

Server-side provider credentials remain server-only.

---

# 41. Payment Logging

Safe operational fields may include:

```text id="x6r4m8"
paymentId
attemptId
provider
provider reference where safe
status
operation
requestId
```

Never log payment credentials or provider secrets.

---

# 42. Payment Events

The Payments domain may emit facts such as:

```text id="q7m5r4"
PaymentCreated
PaymentPending
PaymentSucceeded
PaymentFailed
PaymentCancelled
RefundCreated
RefundSucceeded
RefundFailed
```

Events should be emitted only after the local state transition succeeds.

---

# 43. Event Consumers

Checkout, Orders, Notifications, and other approved consumers may react to payment events.

Payments must not directly modify another module's internal persistence.

---

# 44. Reconciliation

A payment may require reconciliation when:

```text id="v8m4r6"
provider response is uncertain
webhook is delayed
local state differs from provider state
```

A reconciliation process may query the provider and normalize the local state.

This should be implemented only where the chosen provider requires it.

---

# 45. Reconciliation Safety

Reconciliation must be idempotent.

It must not:

```text id="m4q8r7"
create duplicate payments
create duplicate orders
finalize inventory twice
```

# 46. Concrete Database Schema & Constraints Specification

The implementation requires the following relational schema design for migration readiness:

### 1. `payments`
- `id UUID PRIMARY KEY`
- `store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT`
- `checkout_id UUID NOT NULL`
- `order_id UUID`
- `amount BIGINT NOT NULL`
- `currency TEXT NOT NULL`
- `status TEXT NOT NULL DEFAULT 'CREATED'`
- `provider TEXT NOT NULL DEFAULT 'razorpay'`
- `captured_amount BIGINT NOT NULL DEFAULT 0`
- `refunded_amount BIGINT NOT NULL DEFAULT 0`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- **Constraints & Indexes:**
  - `UNIQUE (id, store_id)`
  - Foreign key: `(checkout_id, store_id) REFERENCES checkouts (id, store_id)`
  - Check constraints: `status IN ('CREATED', 'PENDING', 'PROCESSING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'CANCELLED', 'REQUIRES_RECONCILIATION', 'PARTIALLY_REFUNDED', 'REFUNDED')`
  - `currency = UPPER(TRIM(currency)) AND LENGTH(currency) = 3`
  - `amount > 0`
  - `captured_amount >= 0 AND captured_amount <= amount`
  - `refunded_amount >= 0 AND refunded_amount <= captured_amount`
  - **Partial Unique Index:** `CREATE UNIQUE INDEX payments_active_checkout_idx ON payments (store_id, checkout_id) WHERE status NOT IN ('FAILED', 'CANCELLED');` (prevents multiple active payments while enabling retries).

### 2. `payment_attempts`
- `id UUID PRIMARY KEY`
- `payment_id UUID NOT NULL`
- `store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT`
- `attempt_number INT NOT NULL`
- `provider TEXT NOT NULL DEFAULT 'razorpay'`
- `provider_order_id TEXT`
- `provider_payment_id TEXT`
- `provider_signature TEXT`
- `amount BIGINT NOT NULL`
- `currency TEXT NOT NULL`
- `status TEXT NOT NULL DEFAULT 'INITIATED'`
- `failure_code TEXT`
- `failure_message TEXT`
- `idempotency_key TEXT`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- **Constraints & Indexes:**
  - `UNIQUE (id, store_id)`
  - Foreign key: `(payment_id, store_id) REFERENCES payments (id, store_id)`
  - `UNIQUE (payment_id, attempt_number)`
  - Check constraints: `status IN ('INITIATED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'CANCELLED', 'REQUIRES_RECONCILIATION')`, `amount > 0`
  - Unique index: `CREATE UNIQUE INDEX payment_attempts_provider_payment_idx ON payment_attempts (provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL;`

### 3. `payment_webhook_events`
- `id UUID PRIMARY KEY`
- `store_id UUID REFERENCES stores (id) ON DELETE SET NULL`
- `provider TEXT NOT NULL DEFAULT 'razorpay'`
- `provider_event_id TEXT NOT NULL`
- `event_type TEXT NOT NULL`
- `signature_verified BOOLEAN NOT NULL DEFAULT FALSE`
- `payload JSONB NOT NULL`
- `payment_id UUID`
- `status TEXT NOT NULL DEFAULT 'RECEIVED'`
- `error_message TEXT`
- `processed_at TIMESTAMPTZ`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- **Constraints & Indexes:**
  - `UNIQUE (provider, provider_event_id)`
  - Check constraint: `status IN ('RECEIVED', 'PROCESSING', 'PROCESSED', 'IGNORED', 'FAILED')`

### 4. `refunds`
- `id UUID PRIMARY KEY`
- `store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT`
- `payment_id UUID NOT NULL`
- `order_id UUID NOT NULL`
- `provider TEXT NOT NULL DEFAULT 'razorpay'`
- `provider_refund_id TEXT`
- `amount BIGINT NOT NULL`
- `currency TEXT NOT NULL`
- `status TEXT NOT NULL DEFAULT 'PENDING'`
- `reason TEXT`
- `idempotency_key TEXT`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- **Constraints & Indexes:**
  - `UNIQUE (id, store_id)`
  - Foreign key: `(payment_id, store_id) REFERENCES payments (id, store_id)`
  - `UNIQUE (store_id, idempotency_key) WHERE idempotency_key IS NOT NULL`
  - `UNIQUE (provider, provider_refund_id) WHERE provider_refund_id IS NOT NULL`
  - Check constraints: `status IN ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REQUIRES_RECONCILIATION')`, `amount > 0`

### 5. `idempotency_records`
- `id UUID PRIMARY KEY`
- `store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT`
- `scope TEXT NOT NULL`
- `idempotency_key TEXT NOT NULL`
- `request_hash TEXT NOT NULL`
- `status TEXT NOT NULL DEFAULT 'IN_PROGRESS'`
- `response_status INT`
- `response_body JSONB`
- `resource_id UUID`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `expires_at TIMESTAMPTZ NOT NULL`
- **Constraints & Indexes:**
  - `UNIQUE (store_id, scope, idempotency_key)`
  - Check constraint: `status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED')`

---

# 47. Transaction Boundaries & 12-Step Coordination Sequence

Transactions follow strict boundaries to prevent long locks and isolation breaches:
1. Validate store, checkout, server-calculated amounts, and request idempotency.
2. DB Transaction 1: Insert Payment (`CREATED`/`PENDING`) and PaymentAttempt (`INITIATED`); record idempotency reservation.
3. Commit DB Transaction 1 (release locks).
4. Dispatch external call to Razorpay (`POST /v1/orders`) outside DB transaction.
5. DB Transaction 2: Persist Razorpay order ID (`order_xxx`) in PaymentAttempt; commit.
6. Customer pays via frontend modal. Incoming webhook or callback received.
   Verify raw HMAC signature outside database transaction.
7. DB Transaction 3: Deduplicate event in `payment_webhook_events`. If duplicate, commit and return 200 OK.
8. Row-lock payment with `SELECT ... FOR UPDATE`, validate transition, update payment to `CAPTURED`, record `captured_amount`, update attempt.
9. Commit DB Transaction 3 (captured state is durable).
10. Trigger checkout completion requiring verified captured payment.
11. Complete checkout (`PAYMENT_PENDING -> COMPLETED`) and create Order idempotently.
12. Return HTTP 200 OK to Razorpay.


---

# 48. Payment State Recovery

The system must support recovery from states such as:

```text id="v6r4m8"
Provider succeeded
Local request timed out

Provider response unknown
Webhook delayed

Worker crashed
Payment attempt still pending
```

Recovery must rely on durable state, provider references, webhooks, and reconciliation where available.

---

# 48.1 Store-Scoped API Route Architecture & Contracts

In accordance with the repository's established store-scoped URL convention:

### Endpoints
- `POST /api/v1/stores/:storeId/checkouts/:checkoutId/payments`: Create payment attempt for checkout.
  - Requires `Idempotency-Key` header.
  - Auth: Store staff/admin or active customer owning the checkout.
  - Returns `paymentId`, `attemptId`, `providerOrderId`, `amount`, `currency`, `status`, `razorpayKeyId`.
- `GET /api/v1/stores/:storeId/payments/:paymentId`: Get payment status.
  - Auth: Store staff, admin, owner.
- `POST /api/v1/stores/:storeId/payments/:paymentId/refunds`: Initiate refund.
  - Requires `Idempotency-Key` header.
  - Auth: Store admin or owner (HTTP 403 for staff).
- `GET /api/v1/stores/:storeId/payments/:paymentId/refunds`: List refunds.
  - Auth: Store staff, admin, owner.
- `POST /api/v1/webhooks/payments/razorpay`: Razorpay webhook ingestion.
  - Public trust boundary authenticated strictly via `X-Razorpay-Signature` HMAC on raw request body.

---


# 49. Testing Strategy

### Unit Tests

Test:

```text id="m7q4r5"
Payment state transitions
Refund rules
Amount validation
Error mapping
Retryability
```

### Integration Tests

Test:

```text id="x8r4m6"
Payment persistence
Attempts
Refund persistence
Idempotency
Webhook state updates
```

### Provider Tests

Use sandbox/test provider behavior where available.

Test:

```text id="q6m5r8"
Success
Decline
Timeout
Duplicate request
Webhook
Refund
```

---

# 50. Critical Payment Tests

Mandatory scenarios include:

```text id="v5r7m4"
Two identical payment requests
Payment provider timeout
Provider success followed by local timeout
Duplicate success webhook
Out-of-order webhook
Refund retry
Concurrent refund attempts
Payment success + order creation retry
```

---

# 51. Security Tests

At minimum verify:

```text id="m8q4r6"
[ ] Provider secrets are server-only
[ ] Payment credentials are never logged
[ ] Unauthorized users cannot create payments
[ ] Unauthorized users cannot refund payments
[ ] Store A cannot access Store B payments
[ ] Client cannot modify payment amount
[ ] Duplicate requests cannot create duplicate charges
[ ] Webhook signatures are verified
```

---

# 52. Implementation Order

Implement Payments in this order:

```text id="x4r8m6"
1. Payment database schema
2. Payment domain/state model
3. Payment repository
4. Provider interface
5. Provider adapter
6. Payment creation
7. Payment attempt tracking
8. Idempotency
9. Provider error normalization
10. Webhook integration
11. Refunds
12. Reconciliation where required
13. Events
14. API/application integration
15. Unit tests
16. Provider integration tests
17. Webhook/idempotency tests
18. Security tests
19. Checkout integration
20. Order completion verification
```

---

# 53. AI Implementation Rules

AI agents implementing Payments must:

1. Read the actual root `AGENTS.md`.
2. Read Payments, Checkout, Orders, Webhooks, Database, Security, and Idempotency specifications.
3. Never treat provider responses as the only source of local state.
4. Never blindly retry uncertain payment operations.
5. Preserve provider idempotency.
6. Preserve application idempotency.
7. Never log sensitive payment information.
8. Keep provider-specific types inside adapters.
9. Add failure and webhook tests.
10. Review duplicate-charge scenarios explicitly.
11. Avoid unrelated changes.
12. Review the final payment state transitions and diff.

---

# 54. Definition of Done

Payments implementation is complete when:

```text id="v7m4r8"
[ ] Payment records work
[ ] Payment attempts are tracked
[ ] Provider abstraction exists
[ ] Provider adapter works
[ ] Payment amount is authoritative
[ ] Exact money handling is used
[ ] Application idempotency works
[ ] Provider idempotency is used where supported
[ ] Provider failures are normalized
[ ] Timeout/uncertain states are handled
[ ] Webhooks are verified and deduplicated
[ ] Refunds work
[ ] Refund limits are enforced
[ ] Refunds are idempotent
[ ] Store isolation is enforced
[ ] Authorization is enforced
[ ] Secrets are protected
[ ] Sensitive payment data is not logged
[ ] Reconciliation works where required
[ ] Payment events are correct
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Provider tests pass
[ ] Webhook/idempotency tests pass
[ ] Security tests pass
[ ] TypeScript passes
[ ] Lint passes
```

---

# 55. Final Principle

Payments must assume that networks fail, providers retry, webhooks arrive late, workers crash, and humans click buttons twice.

The implementation must therefore make this safe:

```text id="m5q8r4"
Same request twice
→ one logical payment

Provider timeout
→ uncertain, not blindly failed

Duplicate webhook
→ one logical state transition

Refund retry
→ one logical refund

Provider success + local failure
→ recoverable state
```

The goal is not merely to make a payment succeed. The goal is to ensure that **whatever happens around the payment, the platform's financial state remains correct and recoverable**.