# Notifications Implementation

## 1. Purpose

This document defines the concrete execution-level implementation of the Notifications integration for the Demo.

The Notifications system provides a common mechanism for delivering user-facing and system-generated notifications without embedding communication-provider logic inside business domains.

It supports:

- Email notifications.
- In-app notifications where required.
- Notification templates.
- Delivery attempts.
- Retry handling.
- Idempotency.
- User/store notification preferences where required.

The Demo should implement only the notification channels and workflows actually required by the product.

---

# 2. Ownership

Notification implementation belongs to:

```text id="h8p3m6"
modules/notifications
```

The module owns:

- Notification records.
- Notification templates.
- Notification creation.
- Delivery orchestration.
- Delivery attempts.
- Notification state.
- Retry behavior.
- Channel adapters.
- Notification preferences where required.

It does not own:

```text id="q5x7n2"
Orders
Payments
Customers
Stores
Products
Checkout
Business-domain rules
```

Business domains generate facts or request notifications through the Notifications public interface.

---

# 3. Notification Architecture

The intended flow is:

```text id="m4c8v7"
Business Domain
      ↓
Domain Event / Notification Request
      ↓
Notifications
      ↓
Notification Record
      ↓
Worker Job
      ↓
Channel Adapter
      ↓
Provider
```

For example:

```text id="v7n3x5"
OrderCreated
      ↓
Create Order Confirmation Notification
      ↓
Queue Delivery Job
      ↓
Email Adapter
      ↓
Email Provider
```

---

# 4. Notification Channels

The Demo should prioritize:

```text id="x8m4q2"
Email
```

Optional:

```text id="c5v9n7"
In-app notifications
```

Do not introduce SMS, push notifications, WhatsApp, or other channels unless an actual requirement exists.

The architecture should allow additional channels later.

---

# 5. Notification Model

A Notification record may contain:

```text id="n6c4x8"
id
store_id
recipient_user_id
recipient_customer_id
type
channel
status
subject
payload
created_at
updated_at
```

The exact schema follows the database design.

---

# 6. Delivery Model

Delivery should be asynchronous.

Typical flow:

```text id="p8m3v6"
Application Transaction
       ↓
Create Notification / Outbox Event
       ↓
Worker Job
       ↓
Send Notification
       ↓
Persist Delivery Result
```

Business transactions should not wait for email providers.

---

# 7. Why Delivery Is Asynchronous

External notification providers can be slow or unavailable.

Avoid:

```text id="q4x8m7"
Create Order
   ↓
Call Email Provider
   ↓
Wait
   ↓
Create Order Response
```

Prefer:

```text id="v5c9n3"
Create Order
   ↓
Commit
   ↓
Create Notification Job
   ↓
Return
```

The Worker handles delivery separately.

---

# 8. Notification Types

Examples for the Demo:

```text id="m7x4c8"
ORDER_CREATED
ORDER_STATUS_CHANGED
ORDER_CANCELLED
PAYMENT_SUCCEEDED
PAYMENT_FAILED
PASSWORD_RESET
EMAIL_VERIFICATION
```

The exact supported list should remain small and tied to product requirements.

---

# 9. Notification Templates

Templates should be separated from business logic.

Example:

```text id="n8c5v2"
Template
 ├── type
 ├── channel
 ├── subject
 └── body
```

Business code should provide structured notification data rather than constructing provider-specific messages.

---

# 10. Template Rendering

Conceptually:

```text id="p4m8x7"
Notification Type
      ↓
Template
      ↓
Structured Payload
      ↓
Rendered Message
      ↓
Channel Adapter
```

Template rendering must be deterministic and testable.

---

# 11. Template Variables

Example Order notification variables:

```text id="c7n4m9"
customerName
orderNumber
orderTotal
currency
storeName
orderUrl
```

Do not allow arbitrary template execution.

Templates must only access explicitly supplied variables.

---

# 12. Notification Payload

Payloads should contain structured data.

For example:

```text id="x8m5v3"
{
  orderNumber,
  customerName,
  total,
  currency
}
```

Avoid passing entire database entities to the notification system.

This reduces coupling and prevents accidental sensitive-data exposure.

---

# 13. Email Adapter

The Notifications module should use an internal interface:

```text id="q6v9m4"
EmailProvider
 ├── send()
```

The implementation can use the configured email provider.

Provider-specific SDK types remain inside the adapter.

---

# 14. Provider Isolation

Business domains must never call:

```text id="p7m3x8"
SMTP library
Email provider SDK
Provider HTTP API
```

directly.

Instead:

```text id="v4c8n5"
Business Domain
      ↓
Notifications
      ↓
EmailProvider
      ↓
Provider Adapter
```

This keeps provider changes localized.

---

# 15. Email Composition

An email delivery should contain:

```text id="m8x4q7"
recipient
subject
body
template/type
metadata
```

HTML and plain-text versions may be supported where appropriate.

---

# 16. Recipient Resolution

Recipient information must be resolved from trusted server-side data.

Do not trust:

```text id="n5c7v2"
client-supplied arbitrary recipient email
```

for transactional notifications.

For example:

```text id="q8m4x6"
Order
 ↓
Customer
 ↓
Verified/appropriate email
 ↓
Notification
```

---

# 17. Transactional vs Promotional

The Demo should distinguish:

```text id="c4x9m7"
Transactional
Promotional
```

Transactional notifications include:

- Order confirmation.
- Payment result.
- Password reset.
- Email verification.

Promotional notifications should require appropriate preference/consent handling.

---

# 18. Notification Preferences

Where supported, preferences should be Store/Customer scoped.

Example:

```text id="v6n3m8"
Customer
 ├── order notifications → enabled
 └── promotional email   → disabled
```

Mandatory transactional messages should not necessarily be suppressible through ordinary promotional preferences.

---

# 19. Notification Status

Use explicit states:

```text id="x7m4c9"
Pending
Processing
Sent
Failed
Cancelled
```

A notification should not be marked `Sent` until the provider adapter reports successful submission.

---

# 20. Delivery Attempts

A separate delivery-attempt record may capture:

```text id="p5c8n4"
notification_id
attempt_number
provider
status
provider_message_id
failure_code
failure_message
created_at
```

This allows retries without losing delivery history.

---

# 21. Notification Idempotency

A notification must not be sent repeatedly because the same business event is processed multiple times.

Example:

```text id="m8x3v7"
OrderCreated Event
      ↓
Notification Job
      ↓
Worker Retry
```

The retry must recognize that the logical notification already exists or has already been successfully delivered.

---

# 22. Idempotency Key

Notification creation should derive a stable idempotency key where possible.

Example:

```text id="q4n8c5"
order:{orderId}:created:email
```

The exact format is implementation-specific.

A unique database constraint should protect the invariant where practical.

---

# 23. Delivery Job

Notification delivery should use the PostgreSQL-backed job system.

Example:

```text id="v7m5x2"
Notification Created
      ↓
Create Job
      ↓
Worker claims Job
      ↓
Load Notification
      ↓
Send through Adapter
      ↓
Persist Result
```

The Worker follows the standard job implementation.

---

# 24. Worker Claiming

Notification jobs must use the established job claiming strategy:

```text id="c8x4m9"
FOR UPDATE SKIP LOCKED
```

This prevents multiple workers from claiming the same pending job simultaneously.

---

# 25. Retry Policy

Retry transient failures.

Examples:

```text id="n5m7c3"
Provider timeout
Network failure
Temporary provider outage
Rate limiting
```

Do not retry permanent failures indefinitely.

Examples:

```text id="p8x4v6"
Invalid recipient
Invalid request
Rejected message
Unsupported content
```

---

# 26. Exponential Backoff

Retries should use bounded backoff.

Example:

```text id="m4c8n7"
Attempt 1 → short delay
Attempt 2 → longer delay
Attempt 3 → longer delay
...
Final failure → terminal state
```

Exact delays should be configuration-driven.

---

# 27. Dead-Letter Handling

The Demo does not need a separate distributed dead-letter system.

Failed notifications can remain in PostgreSQL with:

```text id="q7v3x5"
status = Failed
attempt_count
last_error
next_attempt_at
```

Operational tooling can later expose failed notifications.

---

# 28. Event Integration

Business domains may publish committed events such as:

```text id="x8m4c6"
OrderCreated
OrderCancelled
PaymentSucceeded
PaymentFailed
```

Notifications consumes these facts.

It should not modify the originating domain's state.

---

# 29. Event-to-Notification Mapping

Example:

```text id="v5n8m4"
OrderCreated
   ↓
Notification Type = ORDER_CREATED
   ↓
Channel = EMAIL
   ↓
Recipient = Customer Email
```

Mapping logic belongs to Notifications rather than Orders.

---

# 30. Notification Transaction Boundaries

Notification creation should be consistent with the business event.

Where the event and notification record are persisted transactionally, they must share an appropriate transaction boundary.

Where asynchronous event publication is used, the platform must avoid silently losing the notification trigger.

The existing event/outbox strategy should be followed rather than introducing a second delivery mechanism.

---

# 31. Provider Failure

If the email provider fails:

```text id="m9x4c7"
Notification
   ↓
Retryable Failure
   ↓
Job Retry
```

The originating Order, Payment, or other business operation should not be rolled back simply because notification delivery failed.

---

# 32. Notification Failure Isolation

For example:

```text id="q8c5m3"
Order Created
      ↓
Order committed successfully
      ↓
Email delivery fails
```

The Order must remain created.

Notification delivery is a secondary effect.

---

# 33. Notification Security

Protect against:

```text id="v4m8x7"
Cross-tenant notification access
Email address leakage
Sensitive payload logging
Unauthorized template access
Provider credential exposure
Template injection
```

Notification content should contain only the minimum required information.

---

# 34. Tenant Isolation

Every notification should carry the relevant Store context where the notification is Store-owned.

For example:

```text id="n7c4x8"
notification.store_id
=
currentStore.id
```

System-level notifications may follow a separate explicit scope.

Never infer tenant ownership from a recipient alone.

---

# 35. Logging

Useful fields include:

```text id="p5m8c4"
notificationId
storeId
notificationType
channel
recipientReference
attemptNumber
provider
jobId
correlationId
```

Avoid logging full message bodies or sensitive recipient information unnecessarily.

---

# 36. Notification API

The Demo should not expose unrestricted notification creation to normal clients.

Internal application services should create notifications.

Administrative endpoints, if required, must be explicitly authorized.

Possible operational endpoint:

```text id="x8n4m7"
GET /api/v1/notifications/:id
```

Only expose it when a real product requirement exists.

---

# 37. Notification Repository

Repository operations may include:

```text id="c6m9v2"
create
findById
findByIdempotencyKey
updateStatus
createAttempt
findPendingDelivery
```

All Store-owned queries must enforce tenant scope.

---

# 38. Notification Application Services

Typical services:

```text id="q4x8n5"
createNotification
processNotification
retryNotification
cancelNotification
```

Template rendering and provider dispatch should remain separated enough to test independently.

---

# 39. Notification DTOs

Use explicit DTOs for any exposed notification data:

```text id="m7c4v8"
NotificationSummary
NotificationDetail
NotificationPreferences
```

Never return provider SDK objects or internal delivery records directly.

---

# 40. Tests

Unit tests should cover:

```text id="v8n3m6"
[ ] Notification type mapping
[ ] Template rendering
[ ] Template variable validation
[ ] Preference evaluation
[ ] Status transitions
[ ] Retry classification
[ ] Idempotency
```

---

# 41. Integration Tests

Verify:

```text id="x5m8c4"
[ ] Order event → notification
[ ] Payment event → notification
[ ] Notification → Worker job
[ ] Worker → Email adapter
[ ] Delivery result persistence
[ ] Retry behavior
[ ] Duplicate event handling
[ ] Tenant isolation
```

---

# 42. Provider Adapter Tests

Verify:

```text id="p7c4m8"
[ ] Message mapping
[ ] Provider response handling
[ ] Provider error normalization
[ ] Timeout handling
[ ] Rate-limit handling
```

Provider SDK calls should be mocked.

---

# 43. Failure-Recovery Tests

Verify:

```text id="n4x8c6"
[ ] Provider timeout
[ ] Provider unavailable
[ ] Worker crash during delivery
[ ] Duplicate job execution
[ ] Duplicate business event
[ ] Permanent provider failure
[ ] Retry exhaustion
[ ] Notification already sent
```

Repeated processing must not create uncontrolled duplicate deliveries.

---

# 44. Implementation Sequence

Implement Notifications in this order:

```text id="m8v4c7"
1. Define Notification schema
2. Define Delivery Attempt schema
3. Define Notification state machine
4. Create migrations
5. Implement Notification repository
6. Implement notification application service
7. Implement template system
8. Implement EmailProvider interface
9. Implement provider adapter
10. Implement event-to-notification mappings
11. Implement idempotency
12. Implement Worker delivery job
13. Implement retry/backoff
14. Implement preferences where required
15. Integrate Orders
16. Integrate Payments
17. Integrate Auth
18. Add APIs only where required
19. Add unit tests
20. Add integration tests
21. Add provider adapter tests
22. Add failure-recovery tests
23. Verify tenant isolation and sensitive-data handling
```

---

# 45. Definition of Done

Notifications implementation is complete when:

```text id="q6x8m4"
[ ] Notification schema exists
[ ] Delivery attempts are tracked
[ ] Notification states are enforced
[ ] Email channel works
[ ] Provider adapter is isolated
[ ] Templates work
[ ] Structured payloads work
[ ] Event mappings work
[ ] Idempotency works
[ ] Worker delivery works
[ ] Retries work
[ ] Backoff works
[ ] Permanent failures stop retrying
[ ] Transactional notifications work
[ ] Preferences work where required
[ ] Tenant isolation works
[ ] Sensitive information is protected
[ ] Order notifications work
[ ] Payment notifications work
[ ] Authentication notifications work
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Provider adapter tests pass
[ ] Failure-recovery tests pass
```