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

# 5. Payment Entity

Conceptually:

```text id="p8v4n6"
Payment
├── id
├── store_id
├── checkout_id
├── order_id
├── amount
├── currency
├── status
├── provider
├── provider_payment_id
├── captured_amount
├── refunded_amount
├── created_at
└── updated_at
```

The exact relationship between Checkout and Order may evolve as payment timing requirements become clearer.

---

# 6. Payment Attempt

A Payment may have multiple attempts.

Conceptually:

```text id="c7m2r9"
PaymentAttempt
├── id
├── payment_id
├── provider
├── provider_attempt_id
├── amount
├── currency
├── status
├── failure_code
├── failure_message
├── created_at
└── updated_at
```

Multiple attempts must not result in multiple successful payments for the same purchase.

---

# 7. Payment Lifecycle

Demo uses:

```text id="x5n8q2"
CREATED
PENDING
AUTHORIZED
CAPTURED
FAILED
CANCELLED
PARTIALLY_REFUNDED
REFUNDED
```

Typical flow:

```text id="v3f7k9"
CREATED
   ↓
PENDING
   ↓
AUTHORIZED
   ↓
CAPTURED
   ↓
PARTIALLY_REFUNDED
   ↓
REFUNDED
```

Alternative failure path:

```text id="j4m6p8"
PENDING → FAILED
```

---

# 8. Payment Attempt Lifecycle

An individual attempt may use:

```text id="w8q2s5"
CREATED
PENDING
SUCCEEDED
FAILED
CANCELLED
```

An attempt is not itself the authoritative payment history.

The Payment aggregate represents the overall payment state.

---

# 9. Payment Provider Abstraction

The application must not couple Checkout directly to a specific provider.

Conceptually:

```text id="n6r3t7"
Checkout
    ↓
Payment Application Service
    ↓
Payment Provider Interface
    ↓
Sandbox Provider
```

A future provider can implement the same interface.

---

# 10. Provider Interface

Conceptually:

```text id="k2v9m4"
createPayment()
authorizePayment()
capturePayment()
cancelPayment()
refundPayment()
verifyWebhook()
```

The exact interface should be defined by the implementation requirements of the selected provider.

Provider-specific response formats must remain inside the provider adapter.

---

# 11. Sandbox Provider

Demo should support a deterministic sandbox/test provider.

It should allow controlled outcomes such as:

```text id="a7f5k2"
SUCCESS
FAILURE
PENDING
```

This allows Checkout and Orders to be tested without depending on real financial transactions.

---

# 12. Real Provider Boundary

If a real provider is integrated during Demo, the same abstraction must remain in place.

Application code should depend on:

```text id="h4q8p1"
PaymentProvider
```

rather than:

```text id="d6x3s9"
SpecificProviderSDK
```

Provider SDK usage belongs inside the provider adapter.

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

Idempotency keys and provider-level idempotency mechanisms should be used together where available.

---

# 25. Idempotency

Payment creation, capture, refund, and webhook processing must be idempotent where the operation can create a financial side effect.

The same idempotency key must not be reused for a materially different request.

---

# 26. Idempotency Conflict

If the same idempotency key is submitted with a different request payload:

```text id="h8k2m5"
Request A
key = abc
amount = 1000

Request B
key = abc
amount = 2000
```

the second request must be rejected as an idempotency conflict.

---

# 27. Idempotency Storage

Conceptually:

```text id="c4n7v9"
IdempotencyRecord
├── key
├── scope
├── request_hash
├── response_status
├── response_body
├── created_at
└── expires_at
```

The exact shared implementation may live in a common package.

---

# 28. Webhook Processing

Payment providers may asynchronously notify the platform.

Conceptually:

```text id="s6m3q8"
Provider
   ↓
Webhook
   ↓
Webhook Verification
   ↓
Persist Event
   ↓
Process Event
   ↓
Update Payment
   ↓
Resume Checkout
```

---

# 29. Webhook Verification

Every provider webhook must be authenticated using the provider's documented signature mechanism.

The system must reject:

- invalid signatures
- malformed payloads
- unsupported event types
- replayed events where replay protection is applicable

---

# 30. Webhook Event Entity

Conceptually:

```text id="y7p4k2"
PaymentWebhookEvent
├── id
├── provider
├── provider_event_id
├── event_type
├── signature_verified
├── payload_reference
├── processed_at
├── status
├── created_at
└── updated_at
```

Provider event IDs should be uniquely tracked.

---

# 31. Webhook Idempotency

If the provider sends:

```text id="r8c5m1"
payment.succeeded
payment.succeeded
payment.succeeded
```

the platform must process the event exactly once from a business-effect perspective.

Repeated deliveries may safely return an already-processed result.

---

# 32. Webhook Replay Protection

Where the provider supplies timestamps or signed event identifiers, the system should use them to reduce replay risk.

Previously processed provider event IDs must not trigger duplicate state transitions.

---

# 33. Webhook Processing Transaction

Webhook handling should:

1. Verify the signature.
2. Validate the event.
3. Persist the event if new.
4. Update the payment state.
5. Trigger required downstream processing.
6. Mark the event processed.

The transaction must be short.

---

# 34. Webhook and External Calls

Webhook processing must not perform unnecessary long-running external calls inside the database transaction.

If external work is required:

```text id="w3k6p9"
Persist verified event
      ↓
Commit
      ↓
Background processing
```

---

# 35. Checkout Integration

Payments communicates successful payment state to Checkout.

Conceptually:

```text id="n5r7x3"
Payment succeeded
       ↓
Checkout resumes
       ↓
Order creation
       ↓
Checkout completed
```

Payments must not directly manipulate Checkout database tables.

---

# 36. Order Integration

Payments may reference an Order once the Order exists.

The Orders module owns the order lifecycle.

Payments must not decide whether an order is:

- fulfilled
- cancelled
- shipped
- delivered

---

# 37. Payment and Order State

The system must support states where:

```text id="k4v8m2"
Payment = CAPTURED
Order = PENDING
```

temporarily.

The architecture must not assume that payment and order state transitions occur in one indivisible operation across external systems.

Recovery mechanisms must reconcile these states safely.

---

# 38. Refunds

Demo supports basic refunds.

A Refund conceptually contains:

```text id="p9x5r7"
Refund
├── id
├── payment_id
├── order_id
├── amount
├── currency
├── status
├── provider_refund_id
├── reason
├── created_at
└── updated_at
```

---

# 39. Refund Lifecycle

A refund may use:

```text id="m6q2t8"
PENDING
SUCCEEDED
FAILED
CANCELLED
```

A successful refund updates the payment's refunded amount.

---

# 40. Refund Limits

The platform must prevent:

```text id="f3n8c5"
total refunded amount > captured amount
```

Partial refunds are allowed where supported.

Example:

```text id="z7r4p2"
Captured = ₹1,000
Refund 1 = ₹400
Remaining refundable = ₹600
```

---

# 41. Refund Idempotency

Refund requests must be idempotent.

Repeated requests must not create duplicate refunds.

Provider-level refund identifiers should be persisted where available.

---

# 42. Refund Authorization

Refunds require appropriate merchant permissions.

Suggested permissions:

| Operation | Owner | Admin | Staff |
|---|---:|---:|---:|
| View payments | Yes | Yes | Yes |
| View payment attempts | Yes | Yes | Yes |
| Initiate refund | Yes | Yes | Optional |
| View refunds | Yes | Yes | Yes |
| Manage provider configuration | Yes | Yes | No |

The final authorization model follows the Stores specification.

---

# 43. Refund and Orders Boundary

Orders may request a refund.

Conceptually:

```text id="q8m3v6"
Order
 ↓
Payment refund interface
 ↓
Payments
 ↓
Provider
```

Orders remains responsible for order-level cancellation/refund status.

Payments remains responsible for the financial transaction.

---

# 44. Payment Provider Configuration

Provider configuration should be associated with the appropriate Store or platform configuration model.

Secrets must be stored securely.

Never commit provider credentials to source control.

---

# 45. Provider Secrets

Examples:

```text id="v6n9k2"
API keys
Secret keys
Webhook signing secrets
Private credentials
```

must be supplied through secure environment or secret-management mechanisms.

They must not be:

- hard-coded
- committed
- returned through APIs
- logged

---

# 46. Sandbox Configuration

Demo environments should use sandbox/test credentials.

Production credentials must never be required for local development.

---

# 47. Payment API

Conceptual endpoints:

```text id="c8r5m2"
POST /checkout/{checkoutId}/payment
GET  /payments/{paymentId}
POST /payments/{paymentId}/capture
POST /payments/{paymentId}/cancel
POST /payments/{paymentId}/refund
POST /webhooks/payments/{provider}
```

The exact endpoint structure follows the API architecture specification.

---

# 48. Webhook Endpoint

Webhook endpoints should:

- accept provider payloads
- verify signatures
- validate event structure
- persist events
- return appropriate acknowledgement
- process asynchronously when appropriate

Webhook endpoints must not trust the request body without verification.

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