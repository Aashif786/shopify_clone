# Webhook Contracts

## 1. Purpose

This document defines the webhook contract and processing requirements for the Shopify-like commerce platform.

Webhooks are external notifications that can trigger internal state changes. Because providers may retry, delay, duplicate, or reorder webhook deliveries, webhook processing must be authenticated, idempotent, observable, and safe under failure.

---

## 2. Core Principles

Webhook processing must:

- Verify authenticity.
- Validate payloads.
- Resolve the correct tenant.
- Treat delivery as at-least-once.
- Support duplicate delivery.
- Handle retries safely.
- Avoid trusting client-controlled state.
- Preserve transactional integrity.
- Keep provider-specific behavior inside integration adapters.
- Maintain observable processing state.

The system must never assume exactly-once delivery.

---

## 3. Demo Scope

The Demo supports webhook processing primarily for external integrations such as payment providers.

The initial architecture should avoid introducing a generic distributed webhook platform.

Webhook handling remains inside the modular monolith with:

```text id="k4m8x2"
apps/web
    ↓
Webhook endpoint
    ↓
Provider verification
    ↓
Webhook application service
    ↓
Domain module
    ↓
PostgreSQL
```

Background processing may be used when immediate processing is not required.

---

## 4. Webhook Endpoint Structure

Webhook endpoints should be explicit and provider-specific where appropriate.

Example:

```text id="p7q3m5"
POST /api/v1/webhooks/payments/provider
```

The endpoint should not require normal merchant/customer session authentication.

Instead, authentication is performed using the provider's webhook verification mechanism.

---

## 5. Webhook Trust Boundary

A webhook request originates outside the application.

Therefore:

```text id="x5n8r2"
Webhook request
    ↓
UNTRUSTED
    ↓
Verify signature/authenticity
    ↓
Validate event
    ↓
Trusted provider event
```

No state-changing business operation should occur before authenticity verification.

---

## 6. Signature Verification

Webhook signatures must be verified using the provider's documented mechanism.

Verification should use:

- Provider secret.
- Raw request body where required.
- Required signature headers.
- Timestamp validation where supported.

Do not reconstruct the signed payload from parsed JSON if the provider requires verification against the original request bytes.

---

## 7. Replay Protection

Where the provider supplies timestamps, signatures, or event identifiers, the system should use them to reduce replay risk.

The system should reject or safely ignore:

- Invalid signatures.
- Expired signatures.
- Previously processed events.
- Malformed requests.

Exact replay-window rules depend on the provider integration.

---

## 8. Event Identification

Each webhook event should have a stable provider event identifier where available.

Example:

```text id="m3r7x9"
provider = "sandbox-payment"
providerEventId = "evt_123456"
```

The identifier should be persisted so duplicate deliveries can be detected.

---

## 9. Webhook Event Record

The Payments module owns payment webhook records.

A webhook event record should track information such as:

```text id="q8k4v2"
internal ID
provider
provider event ID
event type
received timestamp
processing status
processed timestamp
failure information
associated store/payment where known
```

Sensitive raw payload data should only be stored when necessary and must follow data-protection requirements.

---

## 10. Webhook Lifecycle

A webhook event may follow:

```text id="r5m8x1"
RECEIVED
    ↓
PROCESSING
    ↓
PROCESSED
```

Failure states may include:

```text id="v2q7n4"
FAILED
RETRYABLE
IGNORED
```

The exact persisted state model should follow the Payments implementation.

---

## 11. Duplicate Delivery

Providers may deliver the same event multiple times.

Example:

```text id="n6x3p8"
Provider
   ↓
event_123
   ↓
Application
   ↓
processing succeeds

Provider
   ↓
event_123 again
   ↓
Application
   ↓
already processed
   ↓
no duplicate side effect
```

Duplicate processing must not:

- Capture a payment twice.
- Create multiple orders.
- Refund twice.
- Consume inventory twice.
- Increment usage counters twice.

---

## 12. Idempotent Processing

Webhook handlers must be idempotent.

A common strategy is:

```text id="c7m2q9"
unique(provider, provider_event_id)
```

combined with transactional processing.

The exact database constraint should follow the database design.

---

## 13. Same Event, Different Payload

If the same provider event identifier arrives with materially different payload data, the system should treat this as suspicious.

It should not blindly overwrite the previously stored event.

The system should:

1. Detect the conflict.
2. Preserve the original event record.
3. Log the anomaly safely.
4. Prevent unsafe duplicate processing.

---

## 14. Event Validation

After signature verification, validate:

- Event identifier.
- Event type.
- Required fields.
- Provider resource identifier.
- Amount where applicable.
- Currency where applicable.
- Event timestamp where applicable.

Invalid payloads must not enter domain processing.

---

## 15. Tenant Resolution

Webhook requests must resolve the correct store/tenant using trusted integration configuration.

Do not trust a request field such as:

```text id="u8r3m7"
storeId
organizationId
```

as sufficient proof of tenant ownership.

The system should determine which integration/account/store the webhook belongs to using server-side configuration and verified provider information.

---

## 16. Payment Webhook Processing

Payment webhook events may update:

- Payment state.
- Payment attempt state.
- Checkout state.
- Order state through the appropriate workflow.

The webhook must not directly manipulate unrelated module internals.

---

## 17. Payment State Authority

Payment provider events can provide authoritative information about provider-side payment state.

However, internal state transitions must still follow the Payments domain rules.

Example:

```text id="j5q8m3"
Provider:
payment captured
        ↓
Webhook
        ↓
Payments module
        ↓
Validate current state
        ↓
Apply valid transition
        ↓
Publish internal event
        ↓
Checkout/Orders react appropriately
```

---

## 18. Order Creation Through Webhooks

A payment webhook may be part of a recovery workflow where payment succeeds but the original request times out.

The system must support safe recovery without creating duplicate orders.

Order creation must remain idempotent.

The webhook should not blindly create an order every time a payment-success event arrives.

---

## 19. Checkout Completion

If a payment-success event indicates that checkout payment completed, the system may trigger checkout completion according to the documented workflow.

The operation must verify:

- Checkout identity.
- Payment identity.
- Expected amount.
- Expected currency.
- Current checkout state.
- Inventory reservation state.
- Existing order.

---

## 20. Amount Verification

Payment events must not automatically authorize an internal order based solely on a provider resource identifier.

Where applicable, verify:

```text id="x7m2q5"
provider amount
=
expected checkout/payment amount
```

and:

```text id="f3n8k1"
provider currency
=
expected currency
```

Mismatches must fail safely and be observable.

---

## 21. Out-of-Order Events

Webhook events may arrive out of order.

Example:

```text id="v6q3m8"
CAPTURED
arrives before
AUTHORIZED
```

The system must not blindly apply invalid state transitions.

Possible strategies include:

- Ignoring obsolete events.
- Reconciling current provider state.
- Recording the event for later processing.
- Applying only valid state transitions.

The strategy depends on the provider.

---

## 22. Retryable Failures

Some webhook processing failures are temporary.

Examples:

- Database temporarily unavailable.
- Internal dependency unavailable.
- Temporary provider lookup failure.

These may be retried.

Retries must remain idempotent.

---

## 23. Non-Retryable Failures

Some failures should not be retried indefinitely.

Examples:

- Invalid signature.
- Unsupported event type.
- Malformed payload.
- Permanently invalid event.
- Impossible state transition requiring manual investigation.

These should be marked appropriately and surfaced through observability.

---

## 24. Webhook Response

The HTTP response should reflect the processing semantics expected by the provider.

The endpoint should acknowledge successfully processed or safely accepted events.

For retryable processing failures, the response should allow provider retry behavior when appropriate.

The exact status strategy must be implemented according to the provider contract.

---

## 25. Processing Synchronization

Where webhook processing changes multiple related records, the state transition should use an appropriate database transaction.

For example:

```text id="b4q8m2"
Webhook event
+
Payment update
+
Relevant internal state update
```

should be atomic where required.

External network calls should not be held inside long database transactions.

---

## 26. Webhook and Events

A webhook is an external event.

After processing, the system may publish internal domain events.

Example:

```text id="s8m3x7"
Provider webhook
    ↓
PaymentCaptured
    ↓
Internal domain event
    ↓
Order/Checkout workflow
```

Do not expose provider-specific webhook structures directly to internal modules.

---

## 27. Provider Adapter Boundary

Provider-specific logic should remain inside the integration layer.

The adapter should translate:

```text id="n5r7k2"
Provider Event
      ↓
Internal Payment Event
```

The Payments domain should not depend directly on provider SDK types.

---

## 28. Raw Payload Storage

Raw webhook payloads should be stored only when useful for:

- Debugging.
- Auditability.
- Reconciliation.
- Provider dispute handling.

If stored:

- Minimize sensitive information.
- Protect access.
- Define retention.
- Avoid storing payment credentials.
- Avoid exposing payloads through normal APIs.

---

## 29. Logging

Webhook logs should include safe operational context such as:

```text id="q2x8m4"
requestId
provider
providerEventId
eventType
store context where safe
processing result
processing duration
```

Do not log:

- Webhook secrets.
- Authorization credentials.
- Payment credentials.
- Full sensitive payloads unnecessarily.

---

## 30. Observability

Webhook processing should expose enough information to identify:

- Delivery failures.
- Verification failures.
- Processing failures.
- Retry patterns.
- Duplicate events.
- Processing latency.
- Provider-specific problems.

Important failures should be visible through the project's monitoring system.

---

## 31. Security

Webhook endpoints must consider:

- Signature forgery.
- Replay attacks.
- Malformed payloads.
- Event enumeration.
- Tenant confusion.
- Denial-of-service.
- Sensitive payload exposure.

Authentication must occur before state-changing processing.

---

## 32. Testing

Webhook tests should cover:

### Authentication

- Valid signature.
- Invalid signature.
- Missing signature.
- Expired signature where supported.

### Payload

- Valid event.
- Malformed payload.
- Missing required fields.
- Unsupported event type.

### Idempotency

- Duplicate event.
- Same event delivered multiple times.
- Same event after processing failure.

### State

- Valid transition.
- Duplicate transition.
- Out-of-order event.
- Unexpected provider state.

### Tenant isolation

- Correct store resolution.
- Invalid integration/store mapping.
- Cross-tenant event attempt.

### Failure

- Retryable database failure.
- Non-retryable validation failure.
- Provider lookup failure.

---

## 33. Reconciliation

Webhook processing should not be the only mechanism for maintaining payment correctness.

The system should support reconciliation or recovery workflows when:

- Webhooks are delayed.
- Webhooks are lost.
- Internal processing fails after provider success.
- Local and provider state diverge.

The Demo may keep reconciliation simple, but the architecture should not assume webhooks are infallible.

---

## 34. Webhook Security Checklist

Before enabling a webhook:

```text id="e7m3q9"
[ ] Provider identity is known
[ ] Signature verification is implemented
[ ] Replay protection is considered
[ ] Event IDs are persisted
[ ] Duplicate events are handled
[ ] Payload validation exists
[ ] Tenant resolution is server-side
[ ] Sensitive payload data is protected
[ ] Provider-specific logic is isolated
[ ] Invalid events fail safely
```

---

## 35. Webhook Reliability Checklist

```text id="w4n8x2"
[ ] Processing is idempotent
[ ] Retryable failures are identified
[ ] Non-retryable failures are identified
[ ] Out-of-order events are handled
[ ] State transitions are validated
[ ] Database transactions are appropriate
[ ] External calls are not held inside long transactions
[ ] Recovery/reconciliation exists where required
[ ] Duplicate side effects are prevented
[ ] Processing is observable
```

---

## 36. Demo-to-V1 Evolution

The Demo should establish correct webhook security and idempotency without introducing a distributed event-processing platform.

V1 may later add:

- Dedicated webhook ingestion.
- Durable queues.
- Dead-letter queues.
- Advanced retry orchestration.
- Event replay.
- Provider reconciliation workers.
- Distributed event processing.
- Advanced webhook analytics.

These should be introduced only when scale and reliability requirements justify them.

---

## 37. Definition of Done

A webhook implementation is complete when:

- Authenticity is verified.
- Payloads are validated.
- Correct tenant context is established.
- Duplicate delivery is safe.
- State transitions are validated.
- Critical updates are transactional.
- Retry behavior is defined.
- Sensitive information is protected.
- Relevant tests exist.
- Observability is available.
- Documentation matches the implementation.