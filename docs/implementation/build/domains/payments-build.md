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

# 5. Payment Lifecycle

The payment state machine must follow the approved domain specification.

Typical states may include:

```text id="q5r8m4"
CREATED
PENDING
AUTHORIZED
SUCCEEDED
FAILED
CANCELLED
PARTIALLY_REFUNDED
REFUNDED
```

The exact state set remains authoritative.

---

# 6. State Transitions

Payment state changes must occur through explicit operations.

Examples:

```text id="v6m4r8"
createPayment()
initializePayment()
markPending()
markSucceeded()
markFailed()
cancelPayment()
refundPayment()
```

The implementation must reject invalid transitions.

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

# 11. Demo Payment Provider

The Demo may use a sandbox/test payment provider.

The provider must behave like a real integration:

```text id="v8r4m6"
Payment request
→ Provider response
→ Payment state
→ Webhook where applicable
```

Do not replace the payment system with a fake boolean such as:

```text id="m6q5r8"
paymentSuccessful = true
```

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

# 18. Application Idempotency

The application-level idempotency system protects the platform even if:

```text id="x5r8m4"
HTTP request retries
Worker retries
Webhook retries
Provider timeouts
```

occur.

The exact storage mechanism follows the approved PostgreSQL-backed idempotency architecture.

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

# 25. Payment Success

A successful payment must be reflected in the internal Payment state.

Checkout then coordinates:

```text id="v6r8m4"
Payment success
→ Inventory finalization
→ Order creation
→ Checkout completion
```

The Payments module must not directly manipulate Inventory or Orders persistence.

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

# 28. Refunds

Refunds are separate payment operations.

The Payments domain owns:

```text id="x4r7m8"
Refund record
Refund amount
Refund status
Provider refund reference
Refund idempotency
```

---

# 29. Refund Amount

Refund amount must:

- Use exact money.
- Not exceed the refundable amount.
- Follow the approved partial/full refund rules.

The implementation must prevent cumulative refunds from exceeding the original captured amount.

---

# 30. Refund State

The refund state should follow the approved state machine.

Typical states may include:

```text id="q7m4r5"
PENDING
SUCCEEDED
FAILED
CANCELLED
```

The exact set remains authoritative.

---

# 31. Refund Idempotency

A retry of the same refund request must not issue multiple refunds.

Refund operations require an explicit idempotency identity.

Provider idempotency should also be used where available.

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

---

# 46. Database Constraints

The database should enforce critical relationships and uniqueness.

Examples:

```text id="x7r5m4"
Payment → Store
Payment → Checkout
Payment → Order where applicable
Payment Attempt → Payment
Refund → Payment
Provider reference uniqueness where required
```

Exact constraints follow the database specification.

---

# 47. Transaction Boundaries

Database transactions should protect local state transitions.

Do not hold transactions open while calling providers.

A safe conceptual pattern is:

```text id="q5m8r4"
Local transaction
    ↓
Create/prepare payment operation
    ↓
Commit
    ↓
Provider call
    ↓
Local transaction
    ↓
Persist normalized result
```

The exact workflow depends on provider semantics.

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