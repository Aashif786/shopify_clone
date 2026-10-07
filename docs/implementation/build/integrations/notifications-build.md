# Notifications Integration Build Implementation

## 1. Purpose

This document defines the concrete implementation approach for Notifications in the Demo.

The Notifications integration is responsible for turning approved business events into customer or merchant communications through supported channels.

It must remain separate from core commerce logic. Products, Orders, Payments, Checkout, and other domains should emit facts or request notification work, while Notifications owns delivery.

---

# 2. Ownership

The Notifications integration owns:

- Notification records.
- Notification types.
- Templates.
- Recipient resolution.
- Delivery channels.
- Delivery state.
- Retry behavior.
- Notification preferences where required.
- Provider adapters.
- Delivery logging.
- Idempotent notification processing.

It does not own:

- Order business rules.
- Payment state.
- Checkout rules.
- Customer identity.
- Product logic.
- Store lifecycle.
- Business decisions about whether an Order is valid.

---

# 3. Module Location

Implementation belongs under:

```text id="8tq4m6"
modules/notifications/
```

Recommended structure:

```text id="m7r5q8"
modules/notifications/
├── domain/
├── application/
├── infrastructure/
└── index.ts
```

Provider-specific code must remain inside infrastructure adapters.

---

# 4. Notification Architecture

The basic flow is:

```text id="x5m8r4"
Business Domain
      ↓
Domain Event / Application Event
      ↓
Notification Application Service
      ↓
Notification Record
      ↓
Durable Job
      ↓
Notification Worker
      ↓
Provider Adapter
      ↓
External Provider
```

This keeps external delivery outside critical commerce transactions.

---

# 5. Events vs Notifications

A domain event describes something that happened.

A notification describes communication resulting from that fact.

For example:

```text id="q7r4m6"
OrderConfirmed
      ↓
Create Order Confirmation Notification
```

The Orders domain owns `OrderConfirmed`.

Notifications owns the decision and mechanics of delivering the corresponding communication.

---

# 6. Supported Channels

The Demo should keep notification channels intentionally limited.

Primary channel:

```text id="v8m5r4"
Email
```

Optional internal channel:

```text id="m4q8r7"
In-app notification
```

Additional channels such as SMS or WhatsApp should not be introduced without a real requirement.

---

# 7. Notification Entity

A Notification record should contain enough information to track delivery.

Typical fields include:

```text id="x6r5m8"
id
storeId
type
channel
recipient
template/version reference
status
attempt count
scheduledAt
sentAt
lastError
createdAt
updatedAt
```

The exact schema follows the database specification.

---

# 8. Notification Status

The Notification lifecycle should be explicit.

Typical states:

```text id="q8m4r5"
PENDING
PROCESSING
SENT
FAILED
CANCELLED
```

The exact state machine should follow the approved implementation specification.

---

# 9. At-Least-Once Delivery

Notifications should assume that delivery work may execute more than once.

Therefore:

> Notification handlers must be idempotent.

The system must not create duplicate messages merely because a worker retries the same job.

---

# 10. Notification Idempotency

For important transactional notifications, use a stable logical identity.

For example:

```text id="v5r8m6"
Order ID
+
Notification Type
+
Channel
```

can form part of a uniqueness strategy.

This can prevent duplicate Order Confirmation notifications.

---

# 11. Transactional Notifications

Transactional notifications include events such as:

```text id="m7q4r5"
Order confirmed
Payment result
Password reset
Email verification
Order cancellation
```

These should not depend on promotional preferences when they are required for the platform's operation or user experience.

---

# 12. Promotional Notifications

Promotional communication must be treated separately from transactional communication.

The Demo does not require a full marketing automation system.

If promotional notifications are later supported, the implementation must respect:

```text id="x4r8m6"
Customer consent/preferences
Store configuration
Unsubscribe requirements
```

---

# 13. Template Ownership

Notification templates belong to the Notifications integration.

Templates should not be embedded directly inside:

```text id="q6m5r8"
Orders
Payments
Checkout
Customers
```

Business modules provide the relevant event/data.

Notifications decides how that information is rendered.

---

# 14. Template Versioning

Templates should have an identifiable version.

This allows a notification to remain traceable even if the current template later changes.

Historical delivery records should not become ambiguous because a template was edited.

---

# 15. Template Variables

Templates should receive explicitly defined variables.

For example:

```text id="v7r4m5"
customerName
orderNumber
orderTotal
storeName
```

Do not expose entire domain entities to template rendering.

---

# 16. Template Safety

Template rendering must prevent unintended code execution.

User-controlled content must be treated as untrusted data.

Do not allow notification templates to execute arbitrary server-side code.

---

# 17. Recipient Resolution

Recipient addresses should be resolved through trusted application data.

For example:

```text id="m8q4r6"
Order
  ↓
Customer
  ↓
Verified email
```

A client must not be allowed to redirect a transactional Order notification to an arbitrary address.

---

# 18. Merchant Notifications

Some notifications may target Store staff.

Recipient resolution must verify:

```text id="x5r7m4"
Store membership
Appropriate role/permission
Valid notification destination
```

Do not send Store A events to Store B staff.

---

# 19. Customer Notifications

Customer notifications must be scoped to the correct:

```text id="q7m4r8"
Store
Customer
Order
Checkout
Payment
```

Cross-tenant recipient resolution is a critical security failure.

---

# 20. Email Provider Abstraction

Email delivery should use an adapter.

Conceptually:

```text id="v6m5r4"
EmailSender
├── send()
└── validateConfiguration()
```

Provider SDKs must not leak into business modules.

---

# 21. Provider Configuration

Provider configuration belongs in centralized typed configuration.

Secrets include:

```text id="m4q8r8"
API keys
SMTP passwords
OAuth credentials
```

These must never be hardcoded.

---

# 22. Email Payload

The email provider adapter should receive an explicit request such as:

```text id="x8r5m6"
recipient
subject
rendered body
optional reply-to
optional metadata
```

Provider-specific request types should remain inside the adapter.

---

# 23. Sending Flow

A typical notification flow is:

```text id="q5m7r4"
Business Event
    ↓
Create Notification
    ↓
Create Job
    ↓
Worker claims Job
    ↓
Load Notification
    ↓
Render Template
    ↓
Call Email Provider
    ↓
Record Result
```

The external provider call must not occur inside a long-running database transaction.

---

# 24. Notification Creation Transaction

When a critical business event requires a notification, creation of the Notification record should occur reliably with the associated application state.

Where the architecture requires atomic event persistence, use the approved transaction/outbox approach.

The Demo should not introduce a distributed messaging platform solely for notifications.

---

# 25. Job Integration

Notification delivery should use the PostgreSQL-backed durable job system.

A notification job should contain enough information to locate the Notification without duplicating large payloads.

For example:

```text id="v8m4r5"
jobType
notificationId
```

---

# 26. Worker Processing

The Worker should:

```text id="m5q8r4"
Claim job
Validate payload
Load notification
Check current status
Render content
Call provider
Persist result
Complete/retry job
```

If the notification is already successfully delivered, the handler should safely exit.

---

# 27. Retry Policy

Retryable failures should use bounded exponential backoff.

Examples of potentially retryable errors:

```text id="x4r7m8"
Provider timeout
Temporary network failure
Provider 5xx
Rate limiting
```

Permanent failures should not be retried indefinitely.

---

# 28. Provider Rate Limits

Provider rate limits should be treated as retryable when appropriate.

The implementation should respect provider retry guidance where available.

Worker concurrency should remain bounded.

---

# 29. Failure Classification

Notification failures should distinguish:

```text id="q6m5r8"
Invalid recipient
Invalid template
Provider authentication failure
Provider unavailable
Rate limit
Network timeout
Internal application error
```

This determines whether the notification should retry.

---

# 30. Duplicate Delivery Protection

A worker retry after an uncertain provider response is inherently difficult.

For example:

```text id="v7m4r6"
Provider accepts email
      ↓
Network timeout
      ↓
Worker sees failure
      ↓
Worker retries
```

The provider may receive the message twice.

Where the provider supports an idempotency key, use one.

Otherwise the system must use the strongest available deduplication strategy and document the remaining delivery uncertainty.

---

# 31. Notification History

The Notification record should preserve delivery history sufficient for support and debugging.

Do not store unnecessary sensitive message content indefinitely.

---

# 32. Sensitive Data

Notifications may contain:

```text id="m8q4r5"
Customer information
Order information
Payment-related information
Addresses
```

Logs must not contain full sensitive message contents by default.

---

# 33. Logging

Structured logs may include:

```text id="x5r7m4"
notificationId
jobId
storeId
notificationType
channel
provider
attempt
result
correlationId
```

Do not log:

```text id="q8m4r6"
provider secrets
access tokens
password-reset tokens
full message bodies
unnecessary customer data
```

---

# 34. Password Reset Notifications

Password reset messages are security-sensitive.

They must:

- Use short-lived tokens.
- Avoid logging tokens.
- Avoid exposing whether an account exists through public API behavior.
- Use approved Auth workflows.
- Never store plaintext passwords.

Notifications only delivers the message. Auth owns token generation and validation.

---

# 35. Email Verification

Email verification follows the same principle.

Auth owns:

```text id="v6r5m8"
Verification token
Expiration
Validation
Account state
```

Notifications only renders and sends the message.

---

# 36. Order Notifications

Typical Demo Order notifications may include:

```text id="m4q8r7"
Order confirmation
Order cancellation
Payment result where required
```

The Order/Payment domains emit the underlying facts.

Notifications formats them for delivery.

---

# 37. Payment Notifications

Payment-related notifications must never expose sensitive payment credentials.

Safe information may include:

```text id="x7r4m6"
Payment result
Order number
Amount
Currency
```

Do not include:

```text id="q5m8r4"
Full card number
CVV
Provider secret
Authentication credentials
```

---

# 38. Notification Preferences

If preferences are implemented in Demo, they must distinguish between:

```text id="v8m4r5"
Required transactional notifications
Optional notifications
```

Do not allow a preference mechanism to accidentally disable security-critical messages such as password reset or required account verification.

---

# 39. Store Configuration

Stores may configure limited notification behavior such as:

```text id="m7q4r6"
Sender display name
Reply-to address
Enabled notification types
```

All configuration must be validated and Store-scoped.

---

# 40. Sender Identity

Sender addresses must come from trusted configuration.

A client must not be allowed to set arbitrary sender addresses on transactional messages.

---

# 41. API Exposure

The Notifications system should expose only APIs actually required by the Demo.

Merchant-facing functionality may include:

```text id="x4r8m6"
View notification delivery state
```

Internal delivery APIs should not be exposed publicly.

---

# 42. Notification DTOs

Use explicit DTOs such as:

```text id="q7m5r8"
NotificationSummaryDTO
NotificationDetailsDTO
NotificationPreferenceDTO
```

Do not serialize database entities directly.

---

# 43. Tenant Isolation

Every notification must be associated with the correct Store where the notification is Store-scoped.

The system must prevent:

```text id="v5r7m4"
Store A event
    ↓
Store B recipient
```

from occurring.

This applies to creation, queries, jobs, and delivery.

---

# 44. Event Context

Events consumed by Notifications should carry enough trusted context to resolve:

```text id="m8q4r5"
Store
Entity
Entity ID
Event type
```

Notifications should retrieve additional information through approved interfaces when required rather than trusting arbitrary client payloads.

---

# 45. Event Ordering

Notification delivery must tolerate events arriving late or more than once.

For example:

```text id="x6r4m8"
OrderConfirmed
OrderConfirmed
```

must not produce two confirmation notifications when the notification identity requires uniqueness.

---

# 46. Database Constraints

The database should enforce appropriate uniqueness and ownership constraints.

Examples:

```text id="q5m8r4"
Notification → Store
Notification type
Channel
Logical source identity
Notification status
```

A uniqueness constraint should be used where necessary to prevent duplicate transactional notifications.

---

# 47. Cleanup

Notification records and failed delivery history should follow a defined retention policy.

The Demo should avoid indefinite storage of unnecessary communication data.

Cleanup can run through the durable job system.

---

# 48. Testing Strategy

### Unit Tests

Test:

```text id="v7m4r6"
Template rendering
Recipient rules
Notification state transitions
Failure classification
Preference rules
```

### Integration Tests

Test:

```text id="m5q8r4"
Notification persistence
Job creation
Provider adapter
Retry behavior
Idempotency
Store isolation
```

### Worker Tests

Test:

```text id="x8r4m6"
Successful delivery
Retryable failure
Permanent failure
Duplicate execution
Already-sent notification
Provider timeout
```

---

# 49. Security Tests

At minimum verify:

```text id="q6m5r8"
[ ] Cross-store notification access is blocked
[ ] Unauthorized users cannot view private delivery information
[ ] Password-reset tokens are never logged
[ ] Provider credentials are not exposed
[ ] Customer data is not unnecessarily logged
[ ] Arbitrary sender addresses are rejected
[ ] Template input cannot execute arbitrary code
```

---

# 50. Implementation Order

Implement Notifications in this order:

```text id="v4r7m6"
1. Notification schema
2. Notification domain model
3. Notification state machine
4. Template model
5. Email sender interface
6. Provider adapter
7. Recipient resolution
8. Notification application service
9. Job integration
10. Worker handler
11. Retry/failure handling
12. Idempotency
13. Transactional notification flows
14. Preferences if required
15. Merchant delivery visibility
16. Observability
17. Cleanup jobs
18. Unit tests
19. Integration tests
20. Worker/security tests
```

---

# 51. AI Implementation Rules

AI agents implementing Notifications must:

1. Read the actual root `AGENTS.md`.
2. Read Notifications, Jobs, Auth, Orders, Payments, Customers, API, Security, and Observability specifications.
3. Keep notification delivery outside critical commerce transactions.
4. Use provider adapters.
5. Never expose provider credentials.
6. Never log security tokens.
7. Make worker processing idempotent.
8. Treat external delivery as potentially uncertain.
9. Preserve Store and recipient isolation.
10. Avoid introducing unnecessary messaging infrastructure.

---

# 52. Definition of Done

Notifications implementation is complete when:

```text id="m8q4r5"
[ ] Notification records are persisted
[ ] Notification lifecycle is implemented
[ ] Templates are versioned or otherwise traceable
[ ] Email provider is abstracted
[ ] Provider secrets are centralized
[ ] Recipient resolution is secure
[ ] Transactional notifications work
[ ] Jobs are created reliably
[ ] Worker delivery works
[ ] Retry behavior works
[ ] Permanent failures terminate safely
[ ] Duplicate notification creation is prevented
[ ] Duplicate worker execution is safe
[ ] Store isolation is enforced
[ ] Sensitive data is protected
[ ] Password-reset/verification flows are secure
[ ] Observability is implemented
[ ] Cleanup is supported
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Worker tests pass
[ ] Security tests pass
[ ] TypeScript passes
[ ] Lint passes
```

---

# 53. Final Principle

Notifications should be **downstream of business truth**.

The correct architecture is:

```text id="x5r8m4"
Business Event
      ↓
Notification
      ↓
Durable Job
      ↓
Provider
```

not:

```text id="q7m4r6"
Order
  ↓
SMTP call
  ↓
hope
```

Commerce transactions must remain correct even when an email provider is unavailable. A customer can receive an email late and recover. A payment, inventory mutation, or Order that was corrupted because the mail server sneezed is a rather more expensive problem.