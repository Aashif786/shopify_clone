# Webhooks Implementation

## 1. Purpose

This document defines the concrete execution-level implementation of the Webhooks integration for the Demo.

The Webhooks subsystem receives external provider events, validates them, persists them durably, prevents replay and duplicate processing, and dispatches normalized events to the appropriate domain workflows.

The primary Demo use case is payment-provider webhooks, but the design must remain provider-agnostic enough to support additional integrations later.

---

# 2. Ownership

Webhook implementation belongs to:

```text id="v8m4x7"
modules/webhooks
```

The module owns:

- Webhook endpoint handling.
- Raw event capture.
- Provider identification.
- Signature verification.
- Replay protection.
- Event deduplication.
- Webhook state.
- Event normalization.
- Processing coordination.
- Retry behavior.

It does not own:

```text id="m5c8q2"
Payment business rules
Order business rules
Inventory business rules
Customer business rules
Provider-specific business state
```

Those remain owned by their respective domains.

---

# 3. Webhook Architecture

The flow is:

```text id="x7n4c8"
External Provider
      ↓
Webhook HTTP Endpoint
      ↓
Raw Request Capture
      ↓
Provider Identification
      ↓
Signature Verification
      ↓
Replay / Duplicate Protection
      ↓
Persist Event
      ↓
Return Fast HTTP Response
      ↓
Worker Processing
      ↓
Domain Application Service
```

The HTTP endpoint should not perform long-running business processing synchronously.

---

# 4. Why Webhooks Are Asynchronous

External providers generally expect a quick acknowledgement.

Avoid:

```text id="q8m3v7"
Webhook Request
      ↓
Verify
      ↓
Update Payment
      ↓
Create Order
      ↓
Send Notification
      ↓
Wait
      ↓
HTTP Response
```

Prefer:

```text id="c5x8n4"
Webhook Request
      ↓
Verify
      ↓
Persist
      ↓
HTTP 2xx
      ↓
Worker
      ↓
Business Processing
```

This improves resilience and prevents provider retries caused by slow application processing.

---

# 5. Webhook Record

A webhook event record may contain:

```text id="n7m4c8"
id
provider
event_type
provider_event_id
payload
signature_metadata
status
received_at
processed_at
failure_count
last_error
```

Where Store ownership can be reliably determined, include:

```text id="v4x8m2"
store_id
```

The exact schema follows the database specification.

---

# 6. Raw Payload Preservation

Where required for signature verification and troubleshooting, preserve the original request payload.

Do not normalize or transform the payload before signature verification.

Example:

```text id="x8c4m7"
Raw HTTP Body
      ↓
Signature Verification
      ↓
Parse JSON
      ↓
Normalize
```

The raw payload should be protected because it may contain sensitive information.

---

# 7. Signature Verification

Every supported provider must have a verification adapter.

Conceptually:

```text id="m5n8c4"
Webhook
   ↓
Provider Adapter
   ↓
verifySignature(rawBody, headers, secret)
   ↓
Verified / Rejected
```

Invalid signatures must not reach business processing.

---

# 8. Webhook Secrets

Webhook secrets must:

- Be stored in server-side configuration.
- Never be committed.
- Never be returned to clients.
- Never be logged.
- Be rotatable.
- Be separated by provider/environment where necessary.

---

# 9. Provider Resolution

The endpoint should identify the provider using the configured route or trusted request metadata.

Example:

```text id="q7c4n8"
POST /api/v1/webhooks/payments/provider-a
```

The provider identifier must not be trusted from arbitrary payload fields.

---

# 10. Event ID

Provider event IDs should be captured whenever available.

For example:

```text id="v8m3x5"
provider = provider-a
provider_event_id = evt_123
```

The combination should be protected by a unique database constraint.

---

# 11. Replay Protection

Webhook events may be intentionally or accidentally replayed.

Protection should include:

```text id="x4m8c7"
Provider event ID
+
Signature timestamp where supported
+
Timestamp tolerance
+
Database deduplication
```

Repeated delivery of the same event must not repeat business effects.

---

# 12. Duplicate Webhook Delivery

Example:

```text id="m7c4n8"
Webhook A
   ↓
Payment Succeeded
   ↓
Webhook A again
```

The second event must not:

```text id="q5x8m4"
Create another Order
Finalize Inventory again
Send duplicate transactional effects
```

The persisted event state and business-domain idempotency mechanisms provide protection.

---

# 13. Timestamp Validation

Where providers include signed timestamps, validate the timestamp against an acceptable tolerance.

Reject requests that are:

- Too old.
- Too far in the future.
- Missing required signature metadata.

The exact tolerance should be provider-specific and configurable.

---

# 14. Webhook Persistence

After successful verification:

```text id="v4m8c7"
BEGIN
   ↓
Insert Webhook Event
   ↓
Commit
```

If the event already exists:

```text id="x7n5c4"
Return successful acknowledgement
```

provided the duplicate is safely recognized.

---

# 15. HTTP Response Strategy

Typical behavior:

```text id="m8c4v7"
Valid + Persisted
    → 2xx

Invalid Signature
    → 4xx

Malformed Request
    → 4xx

Temporary Internal Failure
    → 5xx
```

The exact status code depends on provider expectations.

Do not acknowledge an event as successfully received if it was not durably persisted.

---

# 16. Webhook Processing State

Use explicit states:

```text id="q4n8c5"
Received
Processing
Processed
Failed
Ignored
```

Example:

```text id="v7m4x8"
Received
   ↓
Processing
   ↓
Processed
```

Retryable failures may return to a processable state.

---

# 17. Event Normalization

Provider-specific payloads should be converted into an internal event representation.

Example:

```text id="x8c5m4"
Provider Event
      ↓
Provider Adapter
      ↓
Normalized Payment Event
      ↓
Payments Application Service
```

The Payments domain should not understand provider-specific JSON structures.

---

# 18. Normalized Event

A normalized event may contain:

```text id="m5x8n7"
provider
providerEventId
eventType
resourceType
resourceId
occurredAt
payload
```

Only fields required by the receiving domain should be exposed.

---

# 19. Payment Webhook Example

A provider may send:

```text id="q7m4c8"
payment.completed
```

The normalized internal event could become:

```text id="v8n5x4"
PaymentSucceeded
```

The Webhooks module performs normalization.

The Payments module owns the meaning of `PaymentSucceeded`.

---

# 20. Domain Processing

After normalization:

```text id="x4c8m7"
Webhook Worker
      ↓
Payments Application Service
      ↓
Payment State Transition
      ↓
Committed Event
      ↓
Checkout / Orders / Notifications
```

Do not directly update Payment tables from generic webhook code.

---

# 21. Transaction Boundary

Webhook processing should use a database transaction around local state changes.

Example:

```text id="m7n4c8"
BEGIN
   ↓
Lock Webhook Event
   ↓
Verify Processable State
   ↓
Call Domain Application Service
   ↓
Record Processed State
   ↓
COMMIT
```

External provider calls should not occur inside this transaction.

---

# 22. Concurrency Protection

Two workers may attempt to process the same webhook.

Use:

- Row-level locking.
- Unique constraints.
- State checks.
- Idempotent domain operations.

Example:

```text id="q8m5x4"
Worker A → Processing
Worker B → sees Processing/Processed
Worker B → exits safely
```

---

# 23. Worker Integration

Webhook processing should use the PostgreSQL-backed job system.

Flow:

```text id="v5c8m7"
Webhook Event
      ↓
Processing Job
      ↓
apps/worker
      ↓
Webhook Processor
```

The job must use the standard retry and claiming mechanisms.

---

# 24. Retry Strategy

Retry only failures that are potentially recoverable.

Retryable:

```text id="x7m4n8"
Temporary database failure
Transient application failure
Temporary downstream infrastructure failure
```

Potentially non-retryable:

```text id="m8c5q4"
Invalid event structure
Unsupported event type
Invalid business transition
Corrupt provider payload
```

Unknown failures should remain observable rather than disappearing silently.

---

# 25. Retry Backoff

Use bounded retry delays.

Example:

```text id="q4x8m7"
Attempt 1
   ↓
Short delay

Attempt 2
   ↓
Longer delay

Attempt 3
   ↓
Longer delay

Final failure
```

Configuration should control the maximum attempts and backoff.

---

# 26. Failed Webhooks

Failed events should remain inspectable.

Store:

```text id="v8m4c5"
failure_count
last_error
last_attempt_at
next_attempt_at
```

Do not delete failed events simply because processing failed.

They are operational evidence and may be required for reconciliation.

---

# 27. Ignored Events

An event may be intentionally ignored when:

- The provider sends an unsupported event type.
- The event is irrelevant to the Demo.
- The resource does not belong to the application.
- The event is valid but does not require business action.

Ignored events should still be recorded with a reason.

---

# 28. Out-of-Order Events

External systems may deliver events out of order.

Example:

```text id="x5c8m4"
PaymentSucceeded
      ↓
PaymentPending
```

The receiving domain must reject or safely ignore an invalid downgrade.

The Webhooks module should not invent business-state rules.

---

# 29. Webhook-to-Payment Mapping

Provider references should map to local Payments using trusted fields.

Possible lookup:

```text id="m7x4c8"
provider
+
provider_payment_id
```

Never trust arbitrary customer-provided identifiers.

---

# 30. Webhook-to-Store Resolution

When the provider event does not directly contain a Store ID, resolve the Store through a previously stored provider reference.

For example:

```text id="q8n5m4"
Provider Payment ID
      ↓
Local Payment
      ↓
store_id
```

Never select a Store based solely on untrusted webhook payload fields.

---

# 31. Payment Webhook and Order Creation

A successful payment webhook may trigger completion of the purchase workflow.

Example:

```text id="v4m8c7"
PaymentSucceeded
      ↓
Checkout completion
      ↓
Order creation
      ↓
Inventory finalization
```

Every downstream operation must remain idempotent.

---

# 32. Webhook and Notifications

Notifications should consume committed domain events.

Avoid:

```text id="x7c5m4"
Webhook
   ↓
Send Email Directly
```

Prefer:

```text id="m8n4c7"
Webhook
   ↓
Payment State Updated
   ↓
PaymentSucceeded Event
   ↓
Notifications
```

This keeps responsibilities separated.

---

# 33. Webhook Security

Protect against:

```text id="q5m8x4"
Forged webhooks
Replay attacks
Duplicate events
Cross-tenant event injection
Payload tampering
Secret leakage
Oversized payloads
Malformed JSON
Unexpected event types
```

Request-size limits must be enforced.

---

# 34. Sensitive Data

Webhook payloads may contain sensitive information.

Therefore:

- Do not log complete payloads.
- Restrict database access.
- Encrypt sensitive data at rest according to infrastructure capabilities.
- Retain only what is required.
- Redact sensitive fields in diagnostics.

---

# 35. Webhook API

Provider endpoints should be isolated from ordinary authenticated application APIs.

Example:

```text id="v8m4n7"
POST /api/v1/webhooks/payments/provider-a
POST /api/v1/webhooks/payments/provider-b
```

Webhook endpoints use signature verification rather than normal user authentication.

---

# 36. Webhook Repository

Repository operations may include:

```text id="x4c8m5"
createEvent
findByProviderEventId
findById
lockForProcessing
markProcessing
markProcessed
markFailed
markIgnored
findRetryableEvents
```

Unique constraints should protect duplicate provider events.

---

# 37. Webhook Application Services

Typical services:

```text id="m7n5c8"
receiveWebhook
processWebhook
retryWebhook
normalizeWebhook
```

The actual business state transition remains inside the owning domain.

---

# 38. Webhook Provider Adapter

Each provider adapter should implement the common contract:

```text id="q8x4m7"
parse()
verifySignature()
normalize()
extractEventId()
extractEventType()
```

Provider-specific logic remains isolated.

---

# 39. Observability

Useful fields include:

```text id="v5m8c4"
webhookId
provider
providerEventId
eventType
storeId
paymentId
jobId
attemptNumber
correlationId
```

Metrics should include:

```text id="x7n4m8"
Webhook received count
Verification failures
Duplicate events
Processing failures
Processing latency
Retry count
```

---

# 40. Webhook Tests

Unit tests should cover:

```text id="m8c5x7"
[ ] Signature verification
[ ] Timestamp validation
[ ] Event ID extraction
[ ] Event type extraction
[ ] Payload normalization
[ ] Invalid payload handling
[ ] Provider-specific mapping
```

---

# 41. Integration Tests

Verify:

```text id="q4x8m6"
[ ] Webhook persistence
[ ] Duplicate event handling
[ ] Worker processing
[ ] Payment state update
[ ] Checkout integration
[ ] Order integration
[ ] Notification event generation
[ ] Tenant resolution
```

---

# 42. Concurrency Tests

Verify:

```text id="v7m4c8"
[ ] Two workers process same event
[ ] Duplicate webhook delivery
[ ] Webhook + reconciliation
[ ] Webhook + client payment confirmation
[ ] Out-of-order events
```

Only one valid business effect should occur.

---

# 43. Failure-Recovery Tests

Verify:

```text id="x5n8m4"
[ ] Database failure during processing
[ ] Worker crash
[ ] Provider sends duplicate event
[ ] Temporary processing failure
[ ] Permanent processing failure
[ ] Retry exhaustion
[ ] Unknown payment outcome
```

Failed events must remain recoverable and observable.

---

# 44. Implementation Sequence

Implement Webhooks in this order:

```text id="m8c4x7"
1. Define Webhook Event schema
2. Define Webhook state machine
3. Create migration
4. Implement provider interface
5. Implement signature verification
6. Implement event ID extraction
7. Implement duplicate protection
8. Implement Webhook repository
9. Implement Webhook receive service
10. Implement event normalization
11. Implement Worker processing
12. Implement retry/backoff
13. Integrate Payments
14. Integrate Checkout
15. Integrate Orders through domain workflows
16. Integrate Notifications through domain events
17. Implement observability
18. Add unit tests
19. Add integration tests
20. Add concurrency tests
21. Add failure-recovery tests
22. Verify webhook security
```

---

# 45. Definition of Done

Webhook implementation is complete when:

```text id="q7m4x8"
[ ] Webhook schema exists
[ ] Raw payload can be retained safely
[ ] Provider identification works
[ ] Signature verification works
[ ] Replay protection works
[ ] Duplicate event protection works
[ ] Event state machine works
[ ] Events are durably persisted
[ ] HTTP acknowledgement is fast
[ ] Worker processing works
[ ] Event normalization works
[ ] Payment integration works
[ ] Out-of-order events are handled safely
[ ] Retry/backoff works
[ ] Failed events remain observable
[ ] Tenant resolution is secure
[ ] Sensitive payloads are protected
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Concurrency tests pass
[ ] Failure-recovery tests pass
```