# Webhook Implementation Specification

## 1. Purpose

This document defines the implementation requirements for the **Webhook** capability of the Cal Cart commerce platform.

Webhooks provide a controlled boundary between the platform and external systems. They allow external providers to notify the platform about events such as payment status changes without granting those providers direct access to internal domain logic.

Webhook processing is security-sensitive and must be designed for duplicate delivery, retries, delayed delivery, and out-of-order events.

---

## 2. Scope

The Webhook capability owns:

- Webhook endpoint handling.
- Provider identification.
- Signature verification.
- Request validation.
- Replay protection.
- Event persistence.
- Duplicate detection.
- Processing lifecycle.
- Retry handling.
- Provider event mapping.
- Failure handling.
- Webhook audit information.

It does not own:

- Payment business rules.
- Order business rules.
- Inventory rules.
- Checkout rules.
- Customer rules.
- Provider credentials outside webhook verification requirements.

Provider-specific business handling belongs to the owning domain module.

---

## 3. Module Location

Implementation belongs under:

```text
modules/webhooks/
```

Recommended structure:

```text
modules/webhooks/
├── application/
├── domain/
├── infrastructure/
├── presentation/
└── index.ts
```

---

## 4. Webhook Architecture

The preferred flow is:

```text
External Provider
       ↓
Webhook Endpoint
       ↓
Raw Request Capture
       ↓
Signature Verification
       ↓
Basic Validation
       ↓
Persist Webhook Event
       ↓
Acknowledge Request
       ↓
Background Processing
       ↓
Domain Handler
       ↓
Domain State Update
```

Webhook HTTP handling should remain thin.

---

## 5. Why Webhooks Are Asynchronous

External providers may:

- Retry delivery.
- Send duplicate events.
- Send events out of order.
- Experience network failures.
- Send large payloads.
- Expect a response within a short timeout.

Therefore, the webhook endpoint should generally persist the event and acknowledge it quickly rather than executing complex business logic synchronously.

---

## 6. Supported Providers

The Demo should implement only the providers required by the actual payment or external integration requirements.

For example:

```text
Payment Provider
      ↓
Webhook Adapter
      ↓
Normalized Webhook Event
```

Provider-specific implementations must remain isolated.

---

## 7. Webhook Entity

Conceptually:

```text
WebhookEvent
├── id
├── provider
├── externalEventId
├── eventType
├── status
├── payload
├── signatureMetadata?
├── receivedAt
├── processedAt?
├── failedAt?
├── attemptCount
└── lastError?
```

The exact fields depend on provider requirements and security policy.

---

## 8. Webhook Status

A practical lifecycle:

```text
RECEIVED
PROCESSING
PROCESSED
FAILED
IGNORED
```

The status represents webhook processing, not necessarily the business state produced by the webhook.

---

## 9. External Event ID

Providers commonly provide a unique event identifier.

The implementation should persist it and enforce appropriate uniqueness.

For example:

```text
unique(provider, externalEventId)
```

This is the primary mechanism for duplicate webhook detection.

---

## 10. Duplicate Delivery

Webhook providers may deliver the same event multiple times.

Example:

```text
Provider
   ↓
Event 123
   ↓
Webhook Endpoint
   ↓
Timeout
   ↓
Provider retries Event 123
```

The platform must process Event 123 safely without applying its business effect twice.

---

## 11. Webhook Idempotency

Webhook processing must be idempotent.

Duplicate requests must not cause:

- Duplicate payments.
- Duplicate refunds.
- Duplicate orders.
- Duplicate inventory changes.
- Duplicate notifications.

The Webhook module should provide durable deduplication while the owning domain module must also enforce its own business-level idempotency.

---

## 12. Signature Verification

Webhook authenticity must be verified before accepting the event for processing.

Typical mechanisms include:

- HMAC signatures.
- Provider-specific signature schemes.
- Timestamp-based signatures.

The exact mechanism belongs to the provider adapter.

---

## 13. Raw Payload Requirement

Some providers calculate signatures over the exact raw request body.

Therefore:

```text
Raw Body
   ↓
Signature Verification
   ↓
JSON Parsing
```

may be required.

The framework must not mutate or reserialize the payload before signature verification when the provider requires raw-body verification.

---

## 14. Signature Failure

Invalid signatures must be rejected.

The system must not process the event or enqueue business work from an unauthenticated webhook.

A public response should avoid exposing internal signature-validation details.

---

## 15. Replay Protection

If the provider supplies a timestamp or equivalent replay-protection value, the implementation should validate it.

Example:

```text
Signature
+
Timestamp
+
Shared Secret
```

The acceptable timestamp window must be configurable.

---

## 16. Replay Attempts

An otherwise valid signature with an unacceptable timestamp should be rejected where the provider's protocol supports timestamp validation.

Previously processed event IDs must also remain protected against replay.

---

## 17. Request Size Limits

Webhook endpoints must enforce appropriate request-size limits.

A malicious or malfunctioning provider must not be able to force the application to consume unbounded memory.

Limits should match the provider's documented maximum payload sizes.

---

## 18. Provider Identification

The endpoint must determine which provider sent the webhook using trusted routing information.

Provider identification may use:

- Dedicated endpoint path.
- Provider-specific endpoint.
- Verified headers.

Do not rely solely on arbitrary client-provided JSON fields to determine provider identity.

---

## 19. Endpoint Structure

Potential endpoint structure:

```text
POST /api/v1/webhooks/{provider}
```

For example:

```text
POST /api/v1/webhooks/payment-provider
```

The exact public endpoint should match the configured provider integration.

---

## 20. Authentication Boundary

Webhooks do not authenticate through normal User sessions.

The authentication model is:

```text
External Provider
       ↓
Signature Verification
       ↓
Trusted Webhook Event
```

A normal browser session must not be required.

---

## 21. Tenant Resolution

Not every webhook request contains a Store ID directly.

Tenant context should be resolved from trusted provider metadata or the associated internal payment/integration record.

For example:

```text
Webhook
   ↓
Provider Event
   ↓
Payment / Integration Reference
   ↓
Store
```

A Store ID supplied only by the webhook payload must not be trusted without verification.

---

## 22. Payment Webhooks

Payment webhooks may communicate events such as:

```text
PAYMENT_AUTHORIZED
PAYMENT_CAPTURED
PAYMENT_SUCCEEDED
PAYMENT_FAILED
PAYMENT_CANCELLED
REFUND_CREATED
REFUND_SUCCEEDED
REFUND_FAILED
```

The Payments module owns interpretation of these events.

---

## 23. Webhook Normalization

Provider-specific payloads should be converted into an internal representation.

Conceptually:

```text
Provider Payload
      ↓
Provider Adapter
      ↓
Normalized Event
      ↓
Payments Application Service
```

Business logic should not depend directly on provider-specific JSON structures.

---

## 24. Event Mapping

A provider event may map to an internal event type.

Example:

```text
provider.payment.completed
          ↓
PaymentCaptured
```

Mappings must be explicit.

Unknown provider events should not be guessed.

---

## 25. Unknown Event Types

Unknown events should generally be:

1. Authenticated.
2. Persisted.
3. Marked as ignored or unsupported.
4. Acknowledged when appropriate.

The endpoint should not fail simply because a provider introduced an event type the application does not yet use.

---

## 26. Processing Lifecycle

Typical flow:

```text
RECEIVED
    ↓
Persist
    ↓
Return success
    ↓
Worker claims event
    ↓
PROCESSING
    ↓
Domain handler
    ↓
PROCESSED
```

Failures may result in:

```text
PROCESSING
    ↓
FAILED
    ↓
Retry
    ↓
PROCESSING
```

---

## 27. Database Transaction

Webhook processing that changes business state must use an appropriate database transaction.

For example:

```text
Webhook Processing Transaction
    ↓
Lock / validate relevant Payment
    ↓
Apply state transition
    ↓
Record webhook processing state
    ↓
Record required events/jobs
    ↓
Commit
```

The transaction must remain short.

---

## 28. External Calls

Do not perform unrelated external API calls inside the core database transaction.

For example, do not hold a payment row lock while waiting for a notification provider.

Use:

```text
Database transaction
      ↓
Commit
      ↓
Background job
      ↓
External service
```

---

## 29. Out-of-Order Events

Providers may deliver:

```text
PaymentSucceeded
```

before:

```text
PaymentCaptured
```

or another event sequence that differs from the expected order.

The Payments module must use state-transition rules that prevent invalid regression.

Webhook ordering must never be assumed.

---

## 30. State Transition Validation

Every webhook-driven state transition must validate:

- Current internal state.
- Incoming provider state.
- Provider event identity.
- Event timestamp where available.
- Whether the event was already processed.

Invalid transitions must not silently corrupt payment state.

---

## 31. Unknown State

If the provider reports a state that the platform does not understand, the event should be recorded and safely ignored or marked for manual/retry processing according to policy.

Never guess the business meaning of an unknown state.

---

## 32. Webhook Retry Strategy

Webhook processing retries should use bounded retry behavior.

Retryable examples:

- Temporary database failure.
- Temporary provider lookup failure.
- Transient infrastructure error.

Non-retryable examples:

- Invalid business state.
- Permanently malformed event.
- Unsupported event where no handler exists.

---

## 33. Provider Reconciliation

Webhook delivery must not be the only source of truth when the external provider offers a query API.

For critical payment states, reconciliation may query the provider after uncertain outcomes.

Example:

```text
Webhook missing
      ↓
Payment remains PENDING
      ↓
Reconciliation Job
      ↓
Provider Status
      ↓
Update Payment
```

---

## 34. Webhook and Idempotency Keys

Webhook event IDs and application idempotency keys solve different problems.

### Webhook Event ID

Prevents processing the same provider event more than once.

### Application Idempotency Key

Protects client/API operations from repeated requests.

Both mechanisms may be required.

---

## 35. Webhook Persistence

The raw or safely retained provider payload may be stored for:

- Debugging.
- Auditing.
- Reprocessing.
- Reconciliation.

Payload retention must follow security and privacy requirements.

---

## 36. Sensitive Payload Data

Webhook payloads may contain sensitive information.

Storage and logging must avoid unnecessary retention of:

- Payment credentials.
- Authentication data.
- Secrets.
- Full card data.
- Provider tokens.

Only data required for processing and auditability should be retained.

---

## 37. Webhook Secret Management

Provider webhook secrets must be stored in secure server-side configuration.

They must never be:

- Committed to Git.
- Returned through APIs.
- Logged.
- Exposed to frontend code.

---

## 38. Secret Rotation

The implementation should support provider secret rotation where practical.

During rotation, the system may temporarily support:

```text
Current Secret
+
Previous Secret
```

until the provider migration is complete.

---

## 39. API Response

A successfully authenticated webhook should generally return a simple success response after durable persistence.

The response should not contain internal processing details.

---

## 40. Acknowledgement Strategy

The endpoint should acknowledge the webhook once the event is safely persisted according to the system's durability guarantees.

It should not wait unnecessarily for:

- Email delivery.
- Order notifications.
- Analytics processing.
- Long-running reconciliation.
- Unrelated external APIs.

---

## 41. Security

Webhook endpoints must protect against:

- Forged requests.
- Replay attacks.
- Duplicate delivery.
- Oversized payloads.
- Malformed JSON.
- Provider impersonation.
- Tenant confusion.
- Secret leakage.
- Unauthorized state changes.

---

## 42. Logging

Structured logs may include:

```text
webhookEventId
provider
eventType
processingStatus
attemptCount
requestId
receivedAt
```

Do not log full sensitive payloads or signature secrets.

---

## 43. Metrics

Useful metrics include:

- Webhooks received.
- Signature failures.
- Duplicate events.
- Processing latency.
- Processing failures.
- Retry count.
- Unknown event count.
- Provider-specific error rates.
- Pending webhook count.

---

## 44. Events Produced by Webhook Processing

Webhook processing may produce domain events such as:

```text
PaymentCaptured
PaymentFailed
RefundSucceeded
```

The Webhook module should not duplicate the business domain's ownership of those events.

The Webhook module reports the external fact and invokes the owning application service.

---

## 45. Database Constraints

Important constraints may include:

```text
unique(provider, external_event_id)
```

Foreign keys should protect associations to relevant internal records.

Indexes should support:

```text
(provider, external_event_id)
(status, received_at)
(provider, received_at)
```

---

## 46. Background Jobs

The Worker may process:

- Pending webhook events.
- Retryable failures.
- Stale processing events.
- Payment reconciliation.
- Optional webhook cleanup.

These jobs must be idempotent.

---

## 47. Stale Processing Recovery

If a worker crashes while processing:

```text
PROCESSING
```

the event must not remain permanently stuck.

A recovery mechanism should identify stale processing records and return them to a retryable state where safe.

---

## 48. Testing Strategy

### Unit Tests

Test:

- Signature verification.
- Replay validation.
- Provider event parsing.
- Event mapping.
- State transition validation.
- Duplicate detection.

### Integration Tests

Test:

- Webhook persistence.
- Database uniqueness.
- Worker processing.
- Payment state changes.
- Retry handling.
- Stale-event recovery.

### Security Tests

Test:

- Invalid signatures.
- Modified payloads.
- Replay attempts.
- Wrong provider secrets.
- Cross-tenant events.
- Oversized payloads.
- Malformed payloads.

### E2E Tests

Test:

```text
Provider Webhook
      ↓
Authenticate
      ↓
Persist Event
      ↓
Worker
      ↓
Payment State Update
      ↓
Order / Checkout Consequence
```

---

## 49. Critical Webhook Tests

```text
[ ] Valid signature is accepted
[ ] Invalid signature is rejected
[ ] Modified payload is rejected
[ ] Replay protection works
[ ] Duplicate event is not processed twice
[ ] Duplicate event cannot create duplicate payment effects
[ ] Unknown event types are safely handled
[ ] Out-of-order events cannot corrupt state
[ ] Retryable failures are retried
[ ] Non-retryable failures terminate correctly
[ ] Stale PROCESSING events recover
[ ] Cross-tenant processing is prevented
[ ] Sensitive payload data is protected
[ ] Webhook endpoint does not require user authentication
[ ] Provider secrets are never logged
```

---

## 50. Implementation Sequence

```text
1. Define webhook event model
2. Define provider abstraction
3. Define provider event mappings
4. Define signature verification interface
5. Define replay protection rules
6. Create database schema
7. Create migrations
8. Implement raw request handling
9. Implement signature verification
10. Implement webhook persistence
11. Implement duplicate detection
12. Implement provider adapters
13. Implement event normalization
14. Implement background processing
15. Implement retry handling
16. Implement stale-event recovery
17. Integrate with Payments
18. Implement reconciliation where required
19. Implement metrics and structured logging
20. Add API endpoint tests
21. Add security tests
22. Add integration tests
23. Add E2E webhook tests
```

---

## 51. Demo Simplifications

The Demo does not require:

- Multiple payment providers unless needed.
- Dedicated event-streaming infrastructure.
- Kafka.
- RabbitMQ.
- External webhook gateway.
- Multi-region webhook processing.
- Advanced event replay UI.
- Complex provider routing.
- Enterprise webhook subscription management.

PostgreSQL-backed durable webhook persistence and the existing Worker architecture are sufficient.

---

## 52. V1 Evolution

The same Webhooks boundary can later support:

- Multiple payment providers.
- Provider failover.
- Dedicated webhook gateway infrastructure.
- Event streaming.
- Advanced replay tooling.
- Webhook observability dashboards.
- Higher-volume asynchronous processing.
- Multi-region ingestion.
- Merchant-configurable outbound webhooks.

Outbound merchant webhooks should remain conceptually separate from inbound provider webhooks even if they eventually share infrastructure.

---

## 53. Definition of Done

The Webhook implementation is complete when:

```text
[ ] Webhook module exists
[ ] Provider abstraction exists
[ ] Provider identification exists
[ ] Raw request handling is correct
[ ] Signature verification exists
[ ] Replay protection exists where supported
[ ] Request-size limits exist
[ ] Webhook events are persisted
[ ] External event IDs are deduplicated
[ ] Webhook processing is asynchronous where appropriate
[ ] Worker processing works
[ ] Retry behavior exists
[ ] Stale processing recovery exists
[ ] Provider events are normalized
[ ] Payment integration works
[ ] Out-of-order events are handled safely
[ ] Invalid state transitions are rejected
[ ] Reconciliation exists where required
[ ] Tenant isolation is enforced
[ ] Provider secrets are protected
[ ] Sensitive payload data is protected
[ ] Structured logging exists
[ ] Operational metrics exist
[ ] Database constraints exist
[ ] Required indexes exist
[ ] Unit tests exist
[ ] Integration tests exist
[ ] Security tests exist
[ ] E2E webhook tests exist
[ ] Documentation matches implementation
```