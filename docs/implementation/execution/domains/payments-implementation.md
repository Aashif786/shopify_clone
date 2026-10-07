# Payments Implementation

## 1. Purpose

This document defines the concrete implementation of the Payments domain for the Demo.

The Payments domain is responsible for representing payment intent, payment attempts, provider interactions, payment state, refunds, webhook reconciliation, and payment idempotency.

Payments must remain isolated from provider-specific implementation details.

The domain must provide a stable internal payment interface so that the Checkout and Orders domains do not depend directly on a payment provider SDK.

---

# 2. Domain Ownership

Payment implementation belongs to:

```text
modules/payments
```

The module owns:

- Payment records.
- Payment attempts.
- Payment state.
- Provider references.
- Refund records.
- Payment application services.
- Payment provider abstraction.
- Payment webhook interpretation.
- Payment reconciliation.
- Payment-specific idempotency.

It does not own:

```text
Checkout lifecycle
Order lifecycle
Inventory
Product pricing
Cart state
Customer records
```

---

# 3. Payment Architecture

The implementation should separate the domain from external providers.

```text
Checkout
   ↓
Payment Application Service
   ↓
Payment Provider Interface
   ↓
Provider Adapter
   ↓
External Payment Provider
```

For example:

```text
modules/payments/
├── domain/
├── application/
├── infrastructure/
└── api/
```

The exact directory structure should follow repository conventions.

---

# 4. Payment Provider Abstraction

The application layer should depend on an internal interface rather than a provider SDK.

Conceptually:

```text
createPaymentIntent()
confirmPayment()
cancelPayment()
createRefund()
getPaymentStatus()
verifyWebhook()
```

Provider-specific request and response objects must remain inside the adapter layer.

---

# 5. Payment Provider Adapter

The adapter translates between the internal payment contract and the provider API.

```text
Internal Payment Request
        ↓
Provider Adapter
        ↓
Provider SDK/API
        ↓
Provider Response
        ↓
Normalized Payment Result
```

No provider-specific types should leak into Checkout, Orders, or other domain modules.

---

# 6. Payment Model

A Payment record should contain information such as:

```text
id
store_id
checkout_id
order_id
provider
provider_payment_id
currency
amount
status
created_at
updated_at
```

The exact schema must follow the database specification.

---

# 7. Payment Attempt Model

A Payment may contain multiple attempts.

An attempt should capture information such as:

```text
id
payment_id
provider
provider_attempt_id
amount
status
failure_code
failure_message
created_at
updated_at
```

Attempts provide an auditable history without overwriting previous payment attempts.

---

# 8. Payment States

Use explicit payment states.

Example:

```text
Created
Pending
Authorized
Succeeded
Failed
Cancelled
Refunded
PartiallyRefunded
```

The exact state machine must follow the domain specification.

---

# 9. Payment State Transitions

Example:

```text
Created
   ↓
Pending
   ├──→ Authorized
   ├──→ Succeeded
   ├──→ Failed
   └──→ Cancelled

Succeeded
   ├──→ PartiallyRefunded
   └──→ Refunded

Authorized
   └──→ Succeeded
```

Invalid transitions must be rejected.

---

# 10. Amount Integrity

The amount sent to the provider must come from authoritative server-side Checkout/Order totals.

Never trust:

```text
clientAmount
clientCurrency
clientDiscount
```

The payment amount must be calculated and validated server-side.

---

# 11. Currency Integrity

The Payment currency must match the Checkout currency.

When creating an Order:

```text
Payment.currency
=
Checkout.currency
=
Order.currency
```

Currency changes during a payment workflow must not be silently accepted.

---

# 12. Payment Creation

Payment creation should:

1. Resolve Store context.
2. Resolve Checkout.
3. Verify Checkout ownership.
4. Verify Checkout is payable.
5. Verify amount and currency.
6. Create Payment record.
7. Create Payment Attempt.
8. Invoke the provider through the adapter.
9. Persist provider identifiers and normalized state.

The external provider call must not occur inside a long-running database transaction.

---

# 13. External Call Boundary

Avoid:

```text
BEGIN TRANSACTION
   ↓
Create payment
   ↓
Call provider
   ↓
Wait for provider
   ↓
COMMIT
```

Prefer:

```text
Transaction
   ↓
Persist local payment state
   ↓
Commit
   ↓
Call provider
   ↓
Persist provider result
```

This prevents database locks from being held while waiting on an external service.

---

# 14. Provider Idempotency

Provider requests should use provider-supported idempotency keys where available.

For example:

```text
internal payment attempt
        ↓
stable provider idempotency key
        ↓
provider
```

Retries must not create duplicate charges.

---

# 15. Application Idempotency

Provider idempotency alone is insufficient.

The application must also prevent duplicate internal operations.

Use the platform's PostgreSQL-backed idempotency mechanism for operations such as:

```text
Create payment
Confirm payment
Create refund
Process webhook
Complete checkout
```

---

# 16. Payment Intent Creation

Payment intent creation should establish the payment operation before provider interaction.

Example:

```text
Checkout
   ↓
Payment
   ↓
Payment Attempt
   ↓
Provider Intent
```

The local record should retain enough information to reconcile the provider operation if the application crashes after the provider call.

---

# 17. Crash Between Provider Call and Persistence

A critical failure scenario is:

```text
Application
   ↓
Provider charge succeeds
   ↓
Application crashes
   ↓
Local database update never occurs
```

The system must recover through:

- Provider idempotency.
- Stored provider references.
- Webhooks.
- Payment reconciliation.
- Retry-safe processing.

Never assume that an unrecorded local result means the provider operation failed.

---

# 18. Payment Confirmation

Confirmation should validate:

```text
Payment exists
Payment belongs to Store
Payment is associated with valid Checkout
Payment amount is unchanged
Payment currency is unchanged
Payment is in a confirmable state
```

Then invoke the provider adapter.

---

# 19. Payment Success

When the provider confirms successful payment:

```text
Provider Success
      ↓
Payment Succeeded
      ↓
Checkout Payment State Updated
      ↓
Order Completion Workflow
```

The Payments domain does not directly manipulate Order internals.

It exposes the resulting payment state to the Checkout/Order workflow.

---

# 20. Payment Failure

A payment failure should be represented explicitly.

Store:

- Stable failure code.
- Provider failure code where safe.
- Human-readable diagnostic message where appropriate.
- Attempt state.
- Timestamp.

Do not expose sensitive provider diagnostics directly to customers.

---

# 21. Temporary Provider Failure

Network errors, timeouts, and provider outages should not automatically become permanent payment failures.

Classify errors into:

```text
Business failure
Technical failure
Unknown outcome
```

Unknown outcomes require reconciliation rather than blindly retrying a charge.

---

# 22. Payment Webhooks

Webhook processing is a critical payment mechanism.

Flow:

```text
Provider
   ↓
Webhook Endpoint
   ↓
Raw Event Capture
   ↓
Signature Verification
   ↓
Replay Protection
   ↓
Deduplication
   ↓
Normalize Event
   ↓
Process Payment State
```

Webhook implementation follows the Webhooks domain specification.

---

# 23. Webhook Signature Verification

Every supported provider webhook must verify authenticity before mutating payment state.

Invalid signatures must be rejected.

Signature verification must use the raw request payload where required by the provider.

---

# 24. Webhook Replay Protection

Persist a provider event identifier.

Repeated delivery of the same event must not cause:

```text
Duplicate payment transition
Duplicate Order
Duplicate inventory finalization
Duplicate refund
```

Use a unique database constraint where appropriate.

---

# 25. Out-of-Order Webhooks

Webhook events may arrive out of order.

The implementation must not blindly apply every event based solely on arrival order.

For example:

```text
PaymentSucceeded
      ↓
PaymentPending
```

must not downgrade a payment that has already reached a terminal or more advanced state.

Use provider timestamps, event sequencing where available, and valid local state transitions.

---

# 26. Webhook Transaction

Webhook state processing should be transactional.

A simplified flow:

```text
BEGIN
   ↓
Deduplicate event
   ↓
Load Payment
   ↓
Validate transition
   ↓
Update Payment
   ↓
Record event processing
   ↓
COMMIT
```

No external provider call should occur inside this transaction.

---

# 27. Payment-to-Checkout Integration

Payment state changes may trigger Checkout workflows.

For example:

```text
Payment Succeeded
      ↓
Checkout completion
      ↓
Order creation
```

The integration should use application services or committed events rather than direct manipulation of Checkout tables.

---

# 28. Payment-to-Order Integration

Orders should retain a stable payment reference.

However:

```text
Payments owns payment state.
Orders owns order state.
```

Neither module should directly modify the other's internal database tables.

---

# 29. Refunds

Refunds belong to Payments.

A refund should contain:

```text
id
payment_id
order_id
amount
currency
status
provider_refund_id
reason
created_at
updated_at
```

The exact schema follows the database specification.

---

# 30. Refund Validation

Before creating a refund:

```text
Payment exists
Payment belongs to Store
Payment is refundable
Refund amount > 0
Refund amount <= refundable amount
Currency matches
```

The cumulative refund amount must never exceed the original successful payment amount.

---

# 31. Partial Refunds

Example:

```text
Original Payment:      ₹1,000
Refund 1:                ₹200
Refund 2:                ₹300
Remaining refundable:   ₹500
```

Refund calculations must use exact monetary arithmetic.

---

# 32. Refund Idempotency

Refund requests must be idempotent.

A retry must not create multiple provider refunds for the same logical operation.

Use:

```text
Application idempotency key
+
Provider idempotency key
+
Unique provider refund reference
```

where supported.

---

# 33. Refund State

Example:

```text
Created
Pending
Succeeded
Failed
Cancelled
```

A refund should only contribute to the refunded amount once it reaches the appropriate successful state.

---

# 34. Payment Reconciliation

Reconciliation is required for uncertain provider states.

Examples:

```text
Local Payment = Pending
Provider      = Succeeded
```

The reconciliation workflow should update local state safely.

Potential sources:

- Provider API.
- Webhooks.
- Scheduled reconciliation jobs.

---

# 35. Reconciliation Jobs

The Worker may periodically process unresolved payments.

Example:

```text
Find pending/unknown payments
        ↓
Query provider
        ↓
Normalize result
        ↓
Apply valid state transition
```

The job must be idempotent.

---

# 36. Payment Retry Rules

Retry only when the operation is safe.

Potentially retryable:

```text
Network timeout
Temporary provider outage
Rate limiting
Transient infrastructure error
```

Do not blindly retry:

```text
Card declined
Invalid payment details
Invalid request
Permanent provider rejection
```

Unknown payment outcomes require reconciliation before another charge attempt.

---

# 37. Payment Repository

Repository operations may include:

```text
createPayment
findById
findByCheckoutId
findByProviderReference
createAttempt
updatePaymentState
createRefund
findRefund
lockPaymentForUpdate
```

All operations must preserve Store ownership.

---

# 38. Payment Application Services

Typical application services:

```text
createPayment
confirmPayment
handleProviderWebhook
reconcilePayment
createRefund
getPayment
```

The application layer owns transaction coordination.

---

# 39. Provider Interface

The provider interface should expose normalized internal contracts.

For example:

```text
PaymentProvider
 ├── createIntent()
 ├── confirmIntent()
 ├── cancelIntent()
 ├── createRefund()
 ├── getPaymentStatus()
 └── verifyWebhook()
```

Provider-specific types remain behind the adapter.

---

# 40. Payment DTOs

Use explicit DTOs such as:

```text
PaymentSummary
PaymentDetail
CreatePaymentInput
ConfirmPaymentInput
RefundPaymentInput
RefundSummary
```

Do not expose database models directly.

---

# 41. Payment API

Typical merchant/admin endpoints may include:

```text
GET  /api/v1/payments/:id
POST /api/v1/payments/:id/refunds
```

Customer-facing payment operations should follow the Checkout API rather than exposing unnecessary internal payment controls.

Provider webhooks use dedicated endpoints, for example:

```text
POST /api/v1/webhooks/payments/:provider
```

Exact routes must follow the API architecture and OpenAPI contract.

---

# 42. Authorization

Payment access must be checked server-side.

A user must not be able to access another Store's payment by changing:

```text
paymentId
orderId
checkoutId
```

Resource lookup must always include Store context.

---

# 43. Tenant Isolation

Every Payment operation must enforce:

```text
payment.store_id
=
currentStore.id
```

Related resources must be validated against the same Store.

Cross-tenant provider references must never be accepted as sufficient authorization.

---

# 44. Sensitive Payment Data

Do not store unnecessary sensitive payment credentials.

Do not store:

```text
Raw card number
CVV
Full magnetic stripe data
Provider secrets
```

Store only the provider references and non-sensitive metadata required for reconciliation and display.

---

# 45. Logging

Never log:

```text
Card numbers
CVV
Authentication secrets
Webhook secrets
Provider credentials
Sensitive payment payloads
```

Useful structured fields include:

```text
storeId
paymentId
checkoutId
orderId
provider
providerPaymentId
attemptId
correlationId
```

---

# 46. Payment Events

Potential domain events include:

```text
PaymentCreated
PaymentPending
PaymentSucceeded
PaymentFailed
PaymentCancelled
RefundCreated
RefundSucceeded
RefundFailed
```

Events represent committed facts.

They should not be emitted before the corresponding database state is durable.

---

# 47. Payment Jobs

Background jobs may handle:

```text
Payment reconciliation
Webhook retry
Refund reconciliation
Pending payment cleanup
```

Every job must be safe for at-least-once execution.

---

# 48. Critical Transaction Rules

Payment implementation must follow these rules:

1. Never hold database transactions across slow provider calls.
2. Never trust client payment amounts.
3. Never assume a timeout means payment failure.
4. Never blindly retry an unknown payment outcome.
5. Use provider idempotency when supported.
6. Use application-level idempotency.
7. Persist provider references.
8. Protect webhook processing with signature verification and deduplication.
9. Enforce valid state transitions.
10. Preserve Store isolation.

---

# 49. Payment Tests

Unit tests should cover:

```text
[ ] Payment state transitions
[ ] Invalid transitions
[ ] Amount validation
[ ] Currency validation
[ ] Refund limits
[ ] Partial refunds
[ ] Refund state transitions
[ ] Retry classification
```

---

# 50. Provider Adapter Tests

Provider adapters should test:

```text
[ ] Intent creation mapping
[ ] Confirmation mapping
[ ] Refund mapping
[ ] Status mapping
[ ] Error mapping
[ ] Webhook signature verification
[ ] Provider response normalization
```

External provider calls should be mocked in automated tests.

---

# 51. Integration Tests

Verify:

```text
[ ] Checkout → Payment
[ ] Payment → Checkout
[ ] Payment → Order
[ ] Payment webhook processing
[ ] Payment reconciliation
[ ] Refund workflow
[ ] Idempotent retries
[ ] Duplicate webhook delivery
```

---

# 52. Concurrency Tests

Verify:

```text
[ ] Two payment creation requests
[ ] Two confirmation requests
[ ] Duplicate webhook events
[ ] Concurrent refund requests
[ ] Refund exceeding remaining amount
[ ] Payment webhook + client confirmation
[ ] Reconciliation + webhook
```

Only valid final state may survive.

---

# 53. Failure-Recovery Tests

Test at minimum:

```text
[ ] Provider timeout
[ ] Provider unavailable
[ ] Provider succeeds before local crash
[ ] Provider failure after local Payment creation
[ ] Unknown payment outcome
[ ] Webhook delayed
[ ] Webhook duplicated
[ ] Webhook arrives out of order
[ ] Worker retry
```

---

# 54. Implementation Sequence

Implement Payments in this order:

```text
1. Define Payment schema
2. Define Payment Attempt schema
3. Define Refund schema
4. Create migrations
5. Implement Payment state machine
6. Implement Payment repository
7. Implement provider interface
8. Implement provider adapter
9. Implement Payment application services
10. Implement provider idempotency
11. Implement application idempotency
12. Implement Checkout integration
13. Implement webhook processing
14. Implement refund workflow
15. Implement reconciliation
16. Implement payment APIs
17. Implement payment events
18. Implement payment jobs
19. Add unit tests
20. Add provider adapter tests
21. Add integration tests
22. Add concurrency tests
23. Add failure-recovery tests
24. Verify tenant isolation and security
```

---

# 55. Definition of Done

Payments implementation is complete when:

```text
[ ] Payment schema exists
[ ] Payment attempts are tracked
[ ] Payment state machine is enforced
[ ] Provider abstraction exists
[ ] Provider adapter is isolated
[ ] Payment creation works
[ ] Payment confirmation works
[ ] Provider idempotency works where supported
[ ] Application idempotency works
[ ] Webhook signature verification works
[ ] Webhook deduplication works
[ ] Out-of-order events are handled safely
[ ] Payment reconciliation works
[ ] Refunds work
[ ] Partial refunds work
[ ] Refund limits are enforced
[ ] Checkout integration works
[ ] Order integration works
[ ] Tenant isolation works
[ ] Sensitive payment data is protected
[ ] Structured logging works
[ ] Required events/jobs work
[ ] Unit tests pass
[ ] Provider adapter tests pass
[ ] Integration tests pass
[ ] Concurrency tests pass
[ ] Failure-recovery tests pass
```

The Payments domain is intentionally isolated because payment providers change, fail, retry, and occasionally behave like payment providers. The rest of the commerce platform should not have to care which particular external service is responsible for the chaos.