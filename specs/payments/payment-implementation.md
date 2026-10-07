# Payment Implementation Specification

## 1. Purpose

This document defines the implementation requirements for the **Payments** domain of the Shopify-like commerce platform.

The Payments module manages payment intents, payment attempts, provider interactions, payment state, provider webhooks, refunds, and payment idempotency.

Payment processing is a critical financial domain. The implementation must prevent duplicate charges, incorrect payment state, unauthorized refunds, replayed webhooks, and inconsistent relationships between payments and Orders.

---

## 2. Scope

The Payments module owns:

- Payment records.
- Payment intents.
- Payment attempts.
- Payment state.
- Payment provider abstraction.
- Provider adapters.
- Payment authorization/capture where supported.
- Payment failure handling.
- Refunds.
- Provider webhook processing.
- Payment idempotency.
- Provider reference mapping.
- Payment reconciliation state.

The module does not own:

- Checkout lifecycle.
- Orders.
- Carts.
- Inventory.
- Customer profiles.
- Discount rules.
- Product pricing.

Those domains interact with Payments through explicit interfaces.

---

## 3. Domain Position

The primary relationship is:

```text id="f7m3q9"
Checkout
   ↓
Payment
   ├── Payment Attempts
   ├── Provider Reference
   └── Refunds
         ↓
Order
```

The Payments module owns payment state, while Checkout and Orders own their respective business workflows.

---

## 4. Module Location

Implementation belongs under:

```text id="v4x8n2"
modules/payments/
```

Recommended structure:

```text id="m6q2c9"
modules/payments/
├── application/
├── domain/
├── infrastructure/
└── index.ts
```

---

## 5. Layer Responsibilities

### Presentation

Responsible for:

- Authentication.
- Store resolution.
- Authorization.
- Request validation.
- DTO mapping.
- HTTP responses.

### Application

Responsible for:

- Payment use cases.
- Payment state transitions.
- Provider orchestration.
- Idempotency.
- Refund orchestration.
- Webhook processing.

### Domain

Responsible for:

- Payment entity.
- Payment Attempt entity.
- Refund entity.
- State transitions.
- Payment invariants.

### Infrastructure

Responsible for:

- PostgreSQL persistence.
- Payment provider adapters.
- Webhook signature verification.
- Provider API communication.
- Provider-specific DTO mapping.

---

## 6. Provider Abstraction

The Payments module must not couple core business logic directly to a specific payment provider.

Use an internal interface such as:

```text id="q8m4x1"
PaymentProvider
├── createPaymentIntent()
├── authorizePayment()
├── capturePayment()
├── cancelPayment()
├── refundPayment()
└── verifyWebhook()
```

The exact interface depends on the provider capabilities.

---

## 7. Provider Adapter

Provider-specific logic belongs behind an adapter.

Conceptually:

```text id="c5n9p3"
Payments Application
        ↓
PaymentProvider Interface
        ↓
Provider Adapter
        ↓
External Provider
```

Core domain logic must not depend on provider SDK types.

---

## 8. Payment Entity

Conceptually:

```text id="r2x7m8"
Payment
├── id
├── storeId
├── checkoutId?
├── orderId?
├── amount
├── currency
├── status
├── provider
├── providerPaymentId?
├── createdAt
└── updatedAt
```

The exact relationships depend on the final Checkout and Order lifecycle.

---

## 9. Payment Attempt

A Payment may have multiple attempts.

Conceptually:

```text id="n6q3v9"
Payment
  ├── Attempt 1
  ├── Attempt 2
  └── Attempt 3
```

This allows failed or interrupted attempts to remain auditable without overwriting historical payment information.

---

## 10. Payment Attempt Entity

Conceptually:

```text id="p4m8x2"
PaymentAttempt
├── id
├── paymentId
├── provider
├── providerReference?
├── amount
├── status
├── failureCode?
├── failureReason?
├── createdAt
└── updatedAt
```

Provider-specific details should be stored only where necessary.

---

## 11. Payment Status

A practical state model may include:

```text id="w7c2m5"
CREATED
PENDING
AUTHORIZED
CAPTURED
SUCCEEDED
FAILED
CANCELLED
PARTIALLY_REFUNDED
REFUNDED
```

The exact states must correspond to the supported provider workflow.

---

## 12. State Transitions

Valid transitions should be explicit.

Example:

```text id="z3n8q4"
CREATED
   ↓
PENDING
   ↓
AUTHORIZED
   ↓
CAPTURED
   ↓
SUCCEEDED
```

Failure:

```text id="j6m2x9"
PENDING → FAILED
```

Cancellation:

```text id="v8q4c1"
PENDING → CANCELLED
```

Refund transitions occur only after a successful/captured payment.

---

## 13. Invalid Transitions

The implementation must reject invalid transitions such as:

```text id="b5r7m3"
FAILED → CAPTURED
REFUNDED → CAPTURED
CANCELLED → AUTHORIZED
```

unless an explicit provider recovery workflow supports the transition.

---

## 14. Payment Amount

The Payment amount must be calculated server-side.

The client must never be authoritative for:

- Amount.
- Currency.
- Order total.
- Refund amount.

Payment amount must originate from the validated Checkout/Order context.

---

## 15. Money Representation

Payment amounts must use exact monetary representation.

Recommended:

```text id="x9m4q7"
integer minor units
```

Example:

```text id="a2c8v5"
₹1,500.75
→
150075 paise
```

Floating-point arithmetic must not be used as the authoritative financial representation.

---

## 16. Currency

Each Payment has one explicit currency.

The Payment amount and currency must match the Checkout transaction context.

Unsupported currency mismatches must be rejected.

---

## 17. Payment Intent

Where supported, the system should create a payment intent before attempting provider-side payment processing.

Conceptually:

```text id="m7p3x8"
Checkout
   ↓
Payment Intent
   ↓
Provider
   ↓
Payment Attempt
```

The intent identifies the logical payment operation.

---

## 18. Payment Attempt Creation

A Payment Attempt represents an individual attempt to process the Payment.

The system should preserve failed attempts rather than overwriting them.

This supports:

- Retry.
- Debugging.
- Reconciliation.
- Auditability.

---

## 19. Idempotency

Payment operations must be strongly idempotent.

Critical operations include:

- Payment intent creation.
- Payment authorization.
- Payment capture.
- Payment cancellation.
- Refund creation.
- Webhook processing.

A retry must not cause a duplicate financial operation.

---

## 20. Provider Idempotency

Where the payment provider supports idempotency keys, the platform must use them.

The application idempotency key and provider idempotency key should be associated with the same logical operation.

---

## 21. Internal Idempotency

The platform should persist enough information to determine whether a requested operation has already been processed.

Conceptually:

```text id="q5x8n2"
Store
+
Operation
+
Idempotency Key
+
Request Fingerprint
+
Result
```

A reused key with a different request fingerprint must fail with an idempotency conflict.

---

## 22. Duplicate Payment Protection

The following must never happen because of a retry:

```text id="k3m7v9"
Checkout
  ↓
Payment attempt A
  ↓
Timeout

Retry
  ↓
Payment attempt B
  ↓
Two provider charges
```

The workflow must first determine the state of the original attempt before creating another charge.

---

## 23. Provider Timeout

A provider timeout does not necessarily mean payment failure.

The system should represent the payment as uncertain/pending where appropriate.

Recovery should use:

- Provider status lookup.
- Webhook.
- Reconciliation.

Blindly charging again is prohibited.

---

## 24. Provider Webhooks

Provider webhooks are a critical source of asynchronous payment state.

Webhook processing must:

1. Receive raw payload.
2. Verify provider signature.
3. Validate event structure.
4. Identify provider event ID.
5. Deduplicate the event.
6. Map provider state.
7. Apply valid internal state transition.
8. Persist the result.
9. Trigger required downstream work.

---

## 25. Webhook Signature Verification

Webhook authenticity must be verified before processing.

Invalid signatures must be rejected.

The implementation must not trust:

- Client-submitted payment status.
- Unverified webhook payloads.
- Provider identifiers without authentication.

---

## 26. Webhook Replay Protection

Provider event IDs should be tracked where available.

A previously processed event must not apply its financial effect twice.

Example:

```text id="r8c4m2"
Webhook Event 123
      ↓
Processed

Webhook Event 123 again
      ↓
Ignored safely
```

---

## 27. Webhook Ordering

Webhook delivery may be:

- Delayed.
- Duplicated.
- Out of order.

The implementation must not assume network delivery order.

State transitions must therefore validate whether the incoming provider state is valid for the current internal state.

---

## 28. Payment-to-Checkout Relationship

Checkout may reference Payment state, but Payments owns payment state.

Checkout must not directly mutate Payment records.

Example:

```text id="v2n7x5"
Checkout
  ↓
Payment Application Interface
  ↓
Payment
```

---

## 29. Payment-to-Order Relationship

After an Order exists, the Payment should reference the Order where appropriate.

Orders should retain enough payment information for historical transaction representation.

The Payment module remains authoritative for actual payment state.

---

## 30. Payment Completion

A successful payment should be represented explicitly.

The workflow may be:

```text id="c9m3q8"
Provider confirms payment
       ↓
Payment → SUCCEEDED
       ↓
Notify Checkout
       ↓
Create/complete Order
```

The exact orchestration depends on the Checkout implementation.

---

## 31. Order Creation Race

A payment webhook and the original Checkout request may both attempt to complete the purchase.

The system must ensure:

```text id="m4x8p2"
One successful payment
+
One Order
+
One inventory finalization
```

rather than duplicate business effects.

---

## 32. Refunds

The Payments module owns refund operations.

A Refund may be:

```text id="n7q2c5"
FULL
PARTIAL
```

depending on the supported product requirements.

---

## 33. Refund Entity

Conceptually:

```text id="x5m9v3"
Refund
├── id
├── paymentId
├── orderId
├── amount
├── currency
├── status
├── providerRefundId?
├── reason?
├── createdAt
└── updatedAt
```

---

## 34. Refund Validation

Before creating a refund:

- Payment must be refundable.
- Refund amount must be positive.
- Currency must match.
- Total refunded amount must not exceed refundable amount.
- Caller must be authorized.
- Refund must belong to the correct Store.

---

## 35. Refund Concurrency

Two concurrent refund requests must not refund more than the original payment amount.

The implementation should use:

- Transactional locking.
- Atomic accounting.
- Unique references.
- Provider idempotency.

---

## 36. Refund Idempotency

Retrying the same refund request must not create two provider refunds.

A stable business reference should identify the logical refund operation.

---

## 37. Partial Refund

Example:

```text id="p6c2m8"
Payment = ₹1,000
Refund = ₹250
Remaining refundable = ₹750
```

The system must maintain exact cumulative refund accounting.

---

## 38. Full Refund

A full refund should transition the payment to an appropriate final state once the provider confirms the refund.

Example:

```text id="w8m4q1"
CAPTURED
   ↓
REFUND REQUESTED
   ↓
REFUNDED
```

The exact intermediate state may be represented through the Refund entity.

---

## 39. Refund and Order

Order status and Payment status must remain conceptually separate.

For example:

```text id="r3x7n9"
Order → REFUNDED
Payment → REFUNDED
```

may occur together through orchestration, but neither module should directly modify the other's internal state.

---

## 40. Authorization

Potential permissions include:

```text id="q8m2c6"
payments.read
payments.manage
payments.refund
```

Customers should not have access to merchant refund operations.

---

## 41. Tenant Isolation

Every Payment must belong to the correct Store.

Every operation must validate:

```text id="k5n9v2"
Store
  ↓
Payment
  ↓
Checkout / Order
```

Cross-tenant payment access must be denied.

---

## 42. Sensitive Payment Data

The application must never store unnecessary sensitive payment credentials.

Do not store raw:

- Card numbers.
- CVVs.
- Provider authentication secrets.

The platform should use provider-hosted/tokenized payment flows where appropriate.

---

## 43. Provider Secrets

Provider credentials must:

- Remain server-side.
- Come from secure configuration.
- Never be committed to Git.
- Never be logged.
- Never be returned in API responses.

---

## 44. API Endpoints

Potential merchant endpoints:

```text id="f7x3m8"
GET  /api/v1/payments/{paymentId}
GET  /api/v1/orders/{orderId}/payments
POST /api/v1/payments/{paymentId}/refunds
GET  /api/v1/payments/{paymentId}/refunds
```

Customer-facing payment operations should expose only the minimum required information.

Provider webhook endpoints may follow:

```text id="n4c8p2"
POST /api/v1/webhooks/payments/{provider}
```

The final API surface must follow the API contract.

---

## 45. Webhook Endpoint Security

Webhook endpoints must:

- Verify signatures.
- Validate payload structure.
- Enforce replay protection.
- Avoid trusting client authentication mechanisms intended for normal users.
- Return appropriate provider-compatible responses.
- Avoid leaking internal errors.

---

## 46. Database Constraints

Potential constraints include:

```text id="m2x7q5"
amount > 0
refund amount > 0
refund currency = payment currency
```

Provider references should have appropriate uniqueness rules.

Webhook event IDs should be unique per provider where applicable.

---

## 47. Database Indexing

Likely indexes include:

```text id="v8p3c6"
store_id
checkout_id
order_id
provider_payment_id
payment_id + created_at
payment_id + status
provider + provider_event_id
```

Refund queries should also have appropriate Payment/Order indexes.

---

## 48. Transactions

Database transactions are required for internal payment state changes that must remain atomic.

Examples:

```text id="x6m9r4"
Payment state update
+
Attempt update
+
Idempotency record
```

External provider calls should not occur inside long database transactions.

---

## 49. External Provider Workflow

A safe high-level pattern is:

```text id="p3q8m5"
Create internal attempt
       ↓
Commit
       ↓
Call provider
       ↓
Persist provider result
       ↓
Transition internal state
```

The exact sequence may differ for provider-specific workflows, but the implementation must remain recoverable after crashes or timeouts.

---

## 50. Payment Recovery

A worker may process unresolved Payments.

Examples:

```text id="c4m7x2"
PENDING payment
      ↓
Check provider state
      ↓
Update internal state
```

Recovery must be safe to retry.

It must never blindly initiate another charge.

---

## 51. Reconciliation

The Demo may implement basic reconciliation for uncertain payment states.

Potential workflow:

```text id="j8n3q6"
Internal payment
      ↓
Provider status lookup
      ↓
Compare states
      ↓
Resolve discrepancy
```

Advanced financial reconciliation can be added in V1.

---

## 52. Events

Potential Payment events:

```text id="r5x9m3"
PaymentCreated
PaymentPending
PaymentAuthorized
PaymentSucceeded
PaymentFailed
PaymentCancelled
RefundCreated
RefundSucceeded
RefundFailed
```

Events represent completed facts.

Critical financial state must be persisted transactionally before publishing dependent events.

---

## 53. Background Jobs

Potential jobs include:

- Payment status reconciliation.
- Retry provider status queries.
- Process pending refunds.
- Recover incomplete payment workflows.
- Reconcile webhook/state discrepancies.

Jobs must be idempotent.

---

## 54. Error Handling

Potential stable errors include:

```text id="q7m4x8"
PAYMENT_NOT_FOUND
PAYMENT_ACCESS_DENIED
PAYMENT_ALREADY_COMPLETED
PAYMENT_ALREADY_REFUNDED
PAYMENT_PROVIDER_ERROR
PAYMENT_PENDING
PAYMENT_FAILED
PAYMENT_CURRENCY_MISMATCH
REFUND_NOT_ALLOWED
REFUND_AMOUNT_INVALID
REFUND_ALREADY_PROCESSED
WEBHOOK_SIGNATURE_INVALID
WEBHOOK_ALREADY_PROCESSED
IDEMPOTENCY_CONFLICT
```

Provider-specific sensitive details should not be exposed directly.

---

## 55. Testing Strategy

### Unit Tests

Test:

- Payment state transitions.
- Refund rules.
- Amount validation.
- Currency validation.
- Idempotency behavior.

### Integration Tests

Test:

- PostgreSQL persistence.
- Unique constraints.
- Payment attempts.
- Refund accounting.
- Concurrent refunds.
- Tenant isolation.
- Webhook deduplication.

### Provider Adapter Tests

Provider adapters should use mocked/test provider environments.

Test:

- Request mapping.
- Response mapping.
- Error mapping.
- Signature verification.
- Timeout behavior.

### API Tests

Test:

- Authorization.
- Payment retrieval.
- Refund creation.
- Webhook endpoints.
- Error contracts.

### E2E Tests

Test:

```text id="m8q2v5"
Checkout
  ↓
Payment
  ↓
Order
  ↓
Refund
```

using a sandbox/test provider.

---

## 56. Critical Payment Tests

```text id="x4c9m7"
[ ] Payment amount comes from server-side Checkout data
[ ] Client cannot override payment amount
[ ] Payment currency cannot be manipulated
[ ] Duplicate payment request is idempotent
[ ] Provider timeout does not cause duplicate charge
[ ] Successful webhook is processed once
[ ] Duplicate webhook is ignored safely
[ ] Out-of-order webhook cannot corrupt state
[ ] Invalid webhook signature is rejected
[ ] Payment failure releases appropriate workflow state
[ ] Successful payment creates only one Order
[ ] Concurrent refund requests cannot over-refund
[ ] Refund retry does not create duplicate refund
[ ] Cross-tenant payment access is denied
[ ] Sensitive payment credentials are never stored/logged
```

---

## 57. Implementation Sequence

Recommended implementation order:

```text id="z7m3q8"
1. Define Payment domain model
2. Define Payment Attempt model
3. Define Refund model
4. Define payment state machine
5. Define provider interface
6. Define provider adapter contract
7. Define database schema
8. Create migrations
9. Implement repositories
10. Implement Payment application services
11. Implement provider adapter
12. Implement idempotency
13. Implement webhook verification
14. Implement webhook processing
15. Integrate with Checkout
16. Integrate with Orders
17. Implement refunds
18. Implement recovery/reconciliation jobs
19. Implement APIs
20. Add unit tests
21. Add integration tests
22. Add provider adapter tests
23. Add concurrency tests
24. Add webhook tests
25. Add E2E payment tests
```

---

## 58. Demo Simplifications

The Demo intentionally does not require:

- Multiple production payment providers.
- Complex payment routing.
- Payment orchestration across regions.
- Advanced fraud detection.
- Chargeback management.
- Automated financial reconciliation at enterprise scale.
- Multi-currency settlement.
- Payment-method vaulting.
- Subscription billing.
- Complex payout systems.

The Demo should use a sandbox/test payment provider or controlled payment adapter while preserving real payment workflow semantics.

---

## 59. V1 Evolution

The Payments module can later support:

- Multiple payment providers.
- Provider routing.
- Payment method management.
- Advanced fraud systems.
- Chargebacks.
- Automated reconciliation.
- Settlement tracking.
- Multi-currency payments.
- Subscription billing.
- Payment retries with provider-aware policies.
- Advanced financial reporting.

The provider abstraction should make these additions possible without coupling the rest of the application to a provider SDK.

---

## 60. Definition of Done

The Payments implementation is complete when:

```text id="c8m4x7"
[ ] Payment entity exists
[ ] Payment Attempt entity exists
[ ] Refund entity exists
[ ] Payment lifecycle exists
[ ] Provider abstraction exists
[ ] Provider adapter exists
[ ] Server-side amount calculation is enforced
[ ] Exact money representation is used
[ ] Currency validation exists
[ ] Payment idempotency exists
[ ] Provider idempotency is used where supported
[ ] Duplicate charge protection exists
[ ] Provider timeout recovery exists
[ ] Webhook signature verification exists
[ ] Webhook replay protection exists
[ ] Webhook deduplication exists
[ ] Out-of-order webhook handling exists
[ ] Refunds are implemented
[ ] Refund concurrency is safe
[ ] Refund idempotency exists
[ ] Tenant isolation is enforced
[ ] Authorization is enforced
[ ] Sensitive payment data is protected
[ ] Database constraints exist
[ ] Appropriate indexes exist
[ ] Recovery/reconciliation jobs exist where required
[ ] Unit tests exist
[ ] Integration tests exist
[ ] Provider adapter tests exist
[ ] Concurrency tests exist
[ ] Webhook tests exist
[ ] API tests exist
[ ] E2E payment flow exists
[ ] Documentation matches implementation
```