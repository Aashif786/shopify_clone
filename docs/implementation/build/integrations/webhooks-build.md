# Webhooks Integration Build Implementation

## 1. Purpose

This document defines the concrete implementation approach for Webhooks in the Demo.

Webhooks are inbound notifications from external systems, primarily payment providers in the Demo. The webhook system must safely receive, authenticate, persist, deduplicate, and process external events without allowing external systems to directly mutate internal business state.

The central rule is:

> External webhook payloads are untrusted input and external providers are not the source of truth for internal domain state.

The application must normalize and apply verified webhook facts through the appropriate domain workflows.

---

# 2. Ownership

The Webhooks integration owns:

- Webhook endpoint handling.
- Raw request capture where required.
- Signature verification.
- Replay protection.
- Event identity and deduplication.
- Webhook persistence.
- Payload validation.
- Event normalization.
- Processing status.
- Retry/reprocessing.
- Provider adapter boundaries.
- Webhook observability.

It does not own:

- Payment state business rules.
- Order lifecycle.
- Inventory state.
- Checkout state.
- Provider credentials outside configuration.
- Customer business logic.

---

# 3. Module Location

Implementation belongs under:

```text id="m5r8q4"
modules/webhooks/
```

Recommended structure:

```text id="x7m4v6"
modules/webhooks/
├── domain/
├── application/
├── infrastructure/
└── index.ts
```

Provider-specific implementations remain inside infrastructure adapters.

---

# 4. Webhook Architecture

The inbound flow is:

```text id="q8r5m4"
External Provider
      ↓
Webhook HTTP Endpoint
      ↓
Capture Raw Request
      ↓
Verify Signature
      ↓
Validate Event Envelope
      ↓
Persist Webhook Event
      ↓
Return Provider Response
      ↓
Durable Processing Job
      ↓
Normalize Event
      ↓
Owning Domain
```

The HTTP endpoint should acknowledge quickly and avoid performing long business workflows synchronously.

---

# 5. Webhook Endpoint

Webhook endpoints must be dedicated to provider integrations.

For example:

```text id="v6m4r8"
/api/v1/webhooks/{provider}
```

The exact route follows the API contract.

Webhook endpoints must not use normal authenticated merchant/customer authorization.

They use provider-specific authentication such as signature verification.

---

# 6. Raw Request Preservation

Signature verification may depend on the exact raw request body.

Therefore, the implementation must preserve the raw payload before transformations that could alter its bytes.

Do not:

```text id="m7q4r5"
Parse JSON
↓
Re-serialize JSON
↓
Verify signature
```

when the provider requires raw-body verification.

Instead:

```text id="x5r8m6"
Raw body
↓
Verify signature
↓
Parse payload
```

---

# 7. Signature Verification

Every supported provider webhook must be authenticated according to that provider's documented signing mechanism.

The implementation must verify:

```text id="q4m8r7"
Signature
Timestamp where applicable
Required headers
Expected provider
```

Invalid signatures must be rejected.

---

# 8. Secret Management

Webhook signing secrets belong in centralized server-only configuration.

They must never appear in:

```text id="v8r4m5"
Source code
Git
Client bundles
API responses
Logs
Error messages
```

Secrets must be loaded through the approved configuration package.

---

# 9. Timestamp Verification

If a provider includes a signed timestamp, the implementation should enforce an acceptable tolerance window.

This reduces replay attacks using previously valid webhook requests.

The tolerance must be configurable rather than hardcoded throughout the codebase.

---

# 10. Replay Protection

Signature verification alone may not prevent replay.

A valid signed request can potentially be sent repeatedly.

Therefore the system should use:

```text id="m6q4r8"
Provider event ID
+
Unique constraint
+
Timestamp validation where supported
```

to prevent duplicate processing.

---

# 11. Webhook Event Identity

Each provider event should have a stable external event identifier.

Store it together with:

```text id="x7r5m4"
provider
eventId
receivedAt
processing status
```

The database should enforce appropriate uniqueness.

For example:

```text id="q5m8r6"
UNIQUE(provider, externalEventId)
```

where supported by the provider's semantics.

---

# 12. Duplicate Requests

If the same webhook is received multiple times:

```text id="v4r8m5"
Request 1 → persisted
Request 2 → duplicate
Request 3 → duplicate
```

the system must not execute the business effect repeatedly.

The handler should recognize the existing event and safely acknowledge the duplicate according to provider expectations.

---

# 13. Webhook Persistence

A Webhook Event record should contain enough information for processing and diagnosis.

Typical fields:

```text id="m8q4r5"
id
provider
externalEventId
eventType
rawPayload/reference
signature verification result
receivedAt
processedAt
status
attempt count
lastError
```

Sensitive payload data should follow the approved retention policy.

---

# 14. Payload Storage

Raw payloads may be retained when required for:

```text id="x5r7m4"
Debugging
Reconciliation
Provider disputes
Reprocessing
Auditability
```

However, storage must respect sensitive-data restrictions.

Do not retain unnecessary payment-sensitive information indefinitely.

---

# 15. Payload Validation

After signature verification, validate the event structure.

Validation should cover:

```text id="q7m4r6"
Provider
Event ID
Event type
Required event fields
Referenced resource identifiers
Expected data types
```

Malformed but correctly signed events must still be rejected or quarantined safely.

---

# 16. Provider Adapter

Each provider should have an adapter responsible for translating provider-specific payloads into an internal representation.

Conceptually:

```text id="v6r5m8"
Provider Webhook
      ↓
Provider Adapter
      ↓
NormalizedWebhookEvent
```

Business modules must not depend on provider-specific payload structures.

---

# 17. Normalized Event

The normalized event should contain only the information required by internal processing.

For example:

```text id="m4q8r7"
provider
eventId
eventType
occurredAt
resourceType
resourceId
normalizedData
```

The exact structure depends on the supported providers.

---

# 18. Provider-Specific Logic

Provider-specific logic belongs inside:

```text id="x8r4m6"
modules/webhooks/infrastructure/
```

Do not spread provider-specific conditionals across Payments, Orders, or Checkout.

Bad:

```text id="q5m7r4"
if provider === "X" ...
if provider === "Y" ...
```

throughout business logic.

Preferred:

```text id="v7m4r6"
Provider Adapter
      ↓
Normalized Event
      ↓
Payment Application Service
```

---

# 19. Processing Model

Webhook processing should be asynchronous.

The endpoint should generally:

```text id="m8q4r5"
Verify
↓
Persist
↓
Queue
↓
Acknowledge
```

The Worker then processes the event.

This prevents slow business operations from causing provider timeout/retry storms.

---

# 20. Job Creation

A durable job should reference the persisted Webhook Event.

For example:

```text id="x4r8m6"
jobType = process_webhook
payload = { webhookEventId }
```

The job should not contain a huge duplicated provider payload unless there is a specific reason.

---

# 21. Worker Processing

The webhook worker should:

```text id="q6m5r8"
Claim Job
↓
Load Webhook Event
↓
Check current status
↓
Normalize event
↓
Dispatch to owning domain
↓
Record processing result
↓
Complete or retry
```

Repeated execution must be safe.

---

# 22. Payment Webhooks

Payment-provider webhooks are the primary Demo use case.

Examples may include:

```text id="v5r7m4"
Payment succeeded
Payment failed
Payment cancelled
Refund completed
```

The exact provider event mapping belongs in the Payments integration.

---

# 23. Payment State Update

A webhook must not directly update arbitrary Payment database fields.

Instead:

```text id="m7q4r6"
Verified Webhook
      ↓
Payments application service
      ↓
Payment state transition
```

This ensures the Payment state machine remains authoritative.

---

# 24. Provider vs Internal State

The provider reports an external event.

The Payments domain determines whether and how that event maps to internal state.

For example:

```text id="x5m8r4"
Provider says:
payment_succeeded

        ↓

Payments validates:
expected payment
valid provider reference
valid transition
not already finalized

        ↓

Internal Payment:
SUCCEEDED
```

---

# 25. Out-of-Order Events

Webhook events may arrive out of order.

For example:

```text id="q8r4m6"
Refund Completed
↓
Payment Succeeded
```

The implementation must not blindly apply events in arrival order.

It should use:

```text id="v6m5r8"
Current state
Provider event timestamp where reliable
Provider resource state where available
Internal transition rules
```

to determine whether an event is applicable.

---

# 26. Duplicate Business Effects

A webhook may be duplicated even if the provider event ID is unique due to downstream retries.

Business effects must therefore also be idempotent.

For example:

```text id="m4q7r5"
Webhook dedupe
+
Payment transition validation
+
Payment idempotency
```

provide multiple layers of protection.

---

# 27. Webhook and Order Creation

A payment webhook must not blindly create an Order.

The approved Checkout/Payments/Orders workflow determines whether an Order should exist.

For example:

```text id="x7r4m8"
Payment webhook
      ↓
Payment state update
      ↓
Checkout completion workflow
      ↓
Order creation
```

This prevents provider callbacks from bypassing commerce rules.

---

# 28. Transaction Boundaries

Webhook persistence should use a short database transaction.

Business processing should use its own application-service transaction.

Do not hold a transaction open while:

```text id="q5m8r6"
Calling provider APIs
Waiting for network I/O
Performing expensive processing
```

---

# 29. Acknowledgement Strategy

The webhook endpoint should return a provider-appropriate success response only after the event has been safely persisted or otherwise durably accepted.

If persistence fails, the response should indicate failure so the provider can retry where appropriate.

Do not acknowledge an event that was lost.

---

# 30. Processing Failure

If asynchronous processing fails after the webhook has been persisted:

```text id="v8m4r5"
Webhook remains persisted
Job retries
Failure is observable
```

The original external event should not need to be resent manually merely because internal processing failed.

---

# 31. Retry Policy

Retryable failures should use bounded backoff.

Examples:

```text id="m6q4r8"
Temporary database failure
Transient internal service failure
Provider API timeout during reconciliation
Temporary dependency outage
```

Permanent validation or authorization failures should not retry indefinitely.

---

# 32. Dead-Letter Handling

If a Webhook Event repeatedly fails processing, it should reach a terminal/error state.

The system must preserve enough information for manual or automated reprocessing.

The Demo does not require a separate message broker dead-letter queue.

The PostgreSQL-backed job system is sufficient.

---

# 33. Reprocessing

Authorized operators should be able to reprocess a failed Webhook Event where safe.

Reprocessing must:

```text id="x5r7m6"
Reuse the original event
Remain idempotent
Record another attempt
Preserve the original payload
```

It must not create a new fake event identity.

---

# 34. Security Logging

Logs should contain:

```text id="q7m4r8"
provider
eventId
eventType
webhookId
processing result
correlation ID
```

Do not log:

```text id="v4m8r6"
Webhook secrets
Authorization headers
Raw sensitive payment data
Full signed payloads unless explicitly required
```

---

# 35. Tenant Resolution

External webhook requests may not carry an internal Store ID.

The application must derive ownership using trusted provider references and internal mappings.

Never trust a Store ID supplied inside an arbitrary webhook payload unless it is independently verified.

---

# 36. Store Isolation

Once the internal Payment/Store relationship is resolved, all downstream processing must remain Store-scoped.

A malicious or malformed event must not allow:

```text id="m8q5r4"
Provider event for Store A
      ↓
Payment belonging to Store B
```

to be accepted.

---

# 37. Provider Credential Rotation

The system should support safe webhook-secret rotation where the provider supports it.

During rotation, the implementation may temporarily need to accept:

```text id="x6r4m8"
Current secret
Previous secret
```

with controlled expiration.

Do not leave obsolete secrets active indefinitely.

---

# 38. API Boundary

Webhook endpoints are machine-to-machine interfaces.

They should not return internal domain entities.

Responses should be provider-appropriate and minimal.

---

# 39. Request Limits

Webhook endpoints should enforce reasonable:

```text id="q5m7r4"
Request body size
Header limits
Timeouts
Rate limits where appropriate
```

Do not allow arbitrarily large payloads.

---

# 40. Content Type

The endpoint must validate expected content types.

Unexpected content should be rejected safely.

Do not parse arbitrary content using permissive fallback behavior.

---

# 41. Observability

Webhook metrics should include:

```text id="v7m4r6"
webhook_received_total
webhook_rejected_total
webhook_duplicate_total
webhook_processing_total
webhook_processing_failure_total
webhook_processing_duration
```

The exact naming follows shared observability conventions.

---

# 42. Correlation

A webhook should receive or generate a correlation identifier that propagates into:

```text id="m4q8r5"
Webhook record
Processing job
Payment workflow
Order workflow
Logs
```

This allows one provider event to be traced through the system.

---

# 43. Testing Strategy

### Unit Tests

Test:

```text id="x8r4m6"
Signature verification
Timestamp validation
Payload validation
Provider normalization
Event mapping
```

### Integration Tests

Test:

```text id="q6m5r8"
Webhook persistence
Unique event constraint
Job creation
Payment state transition
Duplicate event processing
Out-of-order events
```

### End-to-End Tests

Test:

```text id="v5r7m4"
Provider event
↓
Webhook endpoint
↓
Persistence
↓
Worker
↓
Payment state
↓
Checkout/Order outcome
```

---

# 44. Security Tests

At minimum verify:

```text id="m7q4r6"
[ ] Invalid signatures are rejected
[ ] Expired signatures are rejected where applicable
[ ] Duplicate events are not reprocessed
[ ] Cross-store events cannot mutate another Store
[ ] Provider secrets are not exposed
[ ] Raw sensitive payloads are protected
[ ] Malformed payloads fail safely
[ ] Webhook endpoint does not bypass authentication boundaries
[ ] Replay attacks do not create duplicate business effects
```

---

# 45. Critical Failure Tests

Explicitly test:

```text id="x4r8m5"
Database unavailable during webhook receipt
Duplicate webhook
Worker crash after business mutation
Worker crash before business mutation
Provider timeout
Out-of-order events
Invalid provider reference
Payment already finalized
Order already created
```

The final state must remain consistent and recoverable.

---

# 46. Implementation Order

Implement Webhooks in this order:

```text id="q8m5r4"
1. Webhook schema
2. Provider endpoint
3. Raw-body handling
4. Signature verification
5. Timestamp/replay protection
6. Event identity/deduplication
7. Persistence
8. Provider adapters
9. Normalized event model
10. Durable job integration
11. Worker processing
12. Payments integration
13. Retry/failure handling
14. Reprocessing support
15. Observability
16. Security tests
17. Integration tests
18. End-to-end webhook tests
```

---

# 47. AI Implementation Rules

AI agents implementing Webhooks must:

1. Read the actual root `AGENTS.md`.
2. Read Webhooks, Payments, Checkout, Orders, Jobs, API, Security, Configuration, and Observability specifications.
3. Preserve raw request data when signature verification requires it.
4. Verify signatures before trusting payload content.
5. Implement replay protection.
6. Make event processing idempotent.
7. Never allow webhooks to bypass domain application services.
8. Keep provider-specific logic inside adapters.
9. Never expose webhook secrets or sensitive payload data.
10. Test duplicate, delayed, failed, and out-of-order events.

---

# 48. Definition of Done

Webhooks implementation is complete when:

```text id="v6r4m8"
[ ] Webhook endpoints exist
[ ] Raw-body handling is correct
[ ] Signatures are verified
[ ] Timestamp validation is implemented where applicable
[ ] Replay protection works
[ ] Event IDs are deduplicated
[ ] Events are durably persisted
[ ] Provider payloads are normalized
[ ] Durable processing jobs are created
[ ] Worker processing works
[ ] Payment integration works
[ ] Duplicate business effects are prevented
[ ] Out-of-order events are handled safely
[ ] Failed processing is retryable
[ ] Terminal failures are observable
[ ] Reprocessing is supported where required
[ ] Tenant isolation is enforced
[ ] Sensitive payloads are protected
[ ] Correlation IDs are propagated
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Security tests pass
[ ] End-to-end webhook tests pass
[ ] TypeScript passes
[ ] Lint passes
```

---

# 49. Final Principle

A webhook is **an external claim that something happened**, not permission to rewrite the database.

The safe flow is:

```text id="m5q8r4"
External Provider
      ↓
Authenticate
      ↓
Persist
      ↓
Deduplicate
      ↓
Normalize
      ↓
Domain Application Service
      ↓
Validated State Transition
```

This keeps the platform resilient when providers retry events, deliver them out of order, time out, or behave like external systems inevitably do.