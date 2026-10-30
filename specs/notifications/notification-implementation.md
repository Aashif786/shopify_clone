# Notification Implementation Specification

## 1. Purpose

This document defines the implementation requirements for the **Notifications** capability of the Cal Cart commerce platform.

The Notifications capability is responsible for delivering user-facing messages triggered by business events. It must remain separate from the business domains that generate those events.

---

## 2. Scope

The Notifications capability owns:

- Notification creation.
- Notification templates.
- Notification delivery requests.
- Delivery channels.
- Delivery status.
- Retry handling.
- Recipient resolution.
- Notification preferences where required.
- Delivery failure handling.
- Notification audit/history.

It does not own:

- Orders.
- Payments.
- Customers.
- Products.
- Checkout.
- Store configuration.
- Business transaction rules.

Business modules produce facts. Notifications decide how those facts are communicated.

---

## 3. Module Location

Implementation belongs under:

```text
modules/notifications/
```

Recommended structure:

```text
modules/notifications/
├── application/
├── domain/
├── infrastructure/
├── presentation/
└── index.ts
```

---

## 4. Notification Architecture

The preferred Demo flow is:

```text
Business Operation
       ↓
Domain Event
       ↓
Notification Handler
       ↓
Notification Record / Job
       ↓
Notification Worker
       ↓
Delivery Provider
       ↓
Recipient
```

Notifications should generally be asynchronous.

A customer placing an order should not remain blocked while an email provider takes its time remembering how SMTP works.

---

## 5. Event-Driven Triggering

Business modules may emit events such as:

```text
OrderCreated
PaymentSucceeded
PaymentFailed
OrderCancelled
RefundCompleted
CustomerCreated
StoreCreated
```

The Notifications capability consumes relevant events and determines whether a notification should be generated.

---

## 6. Events vs Notifications

A domain event represents:

> Something happened.

A notification represents:

> Communicate something to someone because something happened.

For example:

```text
OrderCreated
    ↓
CustomerOrderConfirmationNotification
```

The Order module must not directly call an email provider.

---

## 7. Supported Channels

The Demo should initially support only required channels.

Potential channels:

```text
EMAIL
IN_APP
```

SMS, WhatsApp, push notifications, and other channels should not be introduced without an actual requirement.

---

## 8. Notification Entity

Conceptually:

```text
Notification
├── id
├── storeId?
├── recipientUserId?
├── recipientCustomerId?
├── type
├── channel
├── status
├── payload
├── scheduledAt?
├── sentAt?
├── failedAt?
├── createdAt
└── updatedAt
```

The exact recipient model depends on the notification type.

---

## 9. Notification Status

A practical lifecycle:

```text
PENDING
PROCESSING
SENT
FAILED
CANCELLED
```

The status must represent delivery processing rather than the underlying business event.

---

## 10. Notification Types

Notification types should be explicit rather than arbitrary strings scattered throughout the codebase.

Examples:

```text
ORDER_CONFIRMATION
PAYMENT_SUCCESS
PAYMENT_FAILURE
ORDER_CANCELLED
REFUND_CONFIRMATION
CUSTOMER_WELCOME
STORE_INVITATION
```

Only required Demo notification types should be implemented initially.

---

## 11. Recipient Resolution

Recipient information must be resolved from authoritative domain data.

For example:

```text
OrderCreated
    ↓
Order Customer
    ↓
Customer Contact Information
    ↓
Notification Recipient
```

The notification system must not blindly trust recipient information embedded in client requests.

---

## 12. Recipient Snapshot

For important notifications, the delivery request may store a recipient snapshot.

For example:

```text
recipientEmail
recipientName
```

This prevents later customer profile changes from altering the intended recipient of an already-created notification.

---

## 13. Store Context

Store-scoped notifications must retain the relevant Store ID.

This supports:

- Tenant isolation.
- Template selection.
- Store branding.
- Auditing.
- Authorization.
- Debugging.

Platform-wide notifications may omit Store ownership where appropriate.

---

## 14. Notification Templates

Templates should be managed separately from business logic.

Conceptually:

```text
Notification Type
       ↓
Template
       ↓
Payload
       ↓
Rendered Message
```

Business modules should provide structured event data rather than constructing email HTML themselves.

---

## 15. Template Inputs

Templates may consume structured data such as:

```text
order.number
customer.name
order.total
store.name
payment.status
```

Template rendering must use trusted structured data.

Raw HTML supplied by customers must not be inserted into trusted templates without sanitization.

---

## 16. Template Versioning

Templates may evolve over time.

For critical notifications, storing a template/version reference can improve auditability.

The Demo may use application-managed templates without a full merchant-facing template editor.

---

## 17. Email Delivery

Email delivery should be abstracted behind a provider interface.

Conceptually:

```text
Notification Service
       ↓
EmailSender
       ↓
Email Provider Adapter
```

Provider SDK calls must remain inside infrastructure adapters.

---

## 18. Email Provider Interface

A conceptual interface:

```text
sendEmail({
  to,
  subject,
  html,
  text
})
```

Provider-specific fields should not leak into domain logic.

---

## 19. Provider Failures

Provider failures should be classified as:

```text
Retryable
Non-retryable
Unknown
```

Examples of potentially retryable failures:

- Temporary provider outage.
- Network timeout.
- Rate limit.

Examples of potentially non-retryable failures:

- Invalid recipient.
- Permanently rejected message.
- Invalid provider configuration.

---

## 20. Retry Strategy

Retries should use bounded exponential backoff.

Conceptually:

```text
Attempt 1
   ↓
wait
Attempt 2
   ↓
wait longer
Attempt 3
   ↓
Final failure
```

The Demo should define a finite maximum retry count.

---

## 21. Idempotent Delivery

Notification processing must be safe to retry.

A worker must not accidentally send the same notification repeatedly because a process crashed after the provider accepted the message.

Where the provider supports idempotency, provider-level idempotency should be used.

Otherwise, the application must minimize duplicate delivery through durable state and provider response tracking.

---

## 22. Delivery State

A worker should claim notification work before processing it.

Conceptually:

```text
PENDING
   ↓
PROCESSING
   ↓
SENT
```

or:

```text
PROCESSING
   ↓
FAILED
   ↓
PENDING
```

depending on retry policy.

---

## 23. Worker Processing

The existing `apps/worker` application should process notification jobs.

The worker must:

- Claim jobs safely.
- Respect retry limits.
- Handle crashes.
- Recover stale processing jobs.
- Avoid unbounded concurrency.
- Shut down gracefully.

---

## 24. PostgreSQL Job Coordination

For the Demo, PostgreSQL-backed jobs are sufficient.

The worker may use:

```text
SELECT ... FOR UPDATE SKIP LOCKED
```

to safely claim work.

A separate Redis queue is not required merely to send a few emails.

---

## 25. Notification Transaction Boundary

Creating a notification record should be transactional with the business event where required.

For example:

```text
Order Transaction
    ↓
Create Order
    ↓
Record Event / Notification Work
    ↓
Commit
```

External email delivery must occur outside the database transaction.

---

## 26. Reliability

The system should avoid:

```text
Order committed
Email request lost
```

and:

```text
Email sent
Order transaction rolled back
```

Business correctness takes priority over immediate notification delivery.

---

## 27. Outbox Consideration

If reliable event publication is required, an outbox mechanism may be used.

For the Demo, the implementation may use the existing PostgreSQL event/job strategy rather than introducing a separate messaging platform.

The outbox should only be introduced where it materially improves reliability.

---

## 28. Notification Preferences

Where required, users may control non-critical notification preferences.

Examples:

```text
Marketing email
Promotional notifications
Optional product notifications
```

Transactional notifications such as payment receipts or order confirmations should not automatically be disabled by marketing preferences.

---

## 29. Customer Preferences

Customer preferences must remain Store-scoped where the notification is Store-specific.

For example:

```text
Store A
  Customer X
    Preferences

Store B
  Customer X
    Preferences
```

must not accidentally share Store-specific preferences.

---

## 30. Transactional vs Promotional

Notifications should distinguish:

### Transactional

Examples:

- Order confirmation.
- Payment receipt.
- Refund confirmation.
- Password/security notifications.

### Promotional

Examples:

- Marketing campaigns.
- Promotional offers.
- Product announcements.

Promotional delivery requires different consent and preference handling.

---

## 31. Merchant Notifications

Merchant notifications may include:

- New order.
- Payment failure.
- Low inventory.
- Refund completion.
- Store invitation.

Only notifications required by the Demo should be implemented.

---

## 32. Customer Notifications

Customer notifications may include:

- Order confirmation.
- Payment confirmation.
- Order cancellation.
- Refund confirmation.
- Account/security notifications.

---

## 33. Notification Authorization

Notification creation must respect the ownership of the triggering event.

For example, a Store A Order event must never create a notification containing Store B information.

Recipient access must also be validated.

---

## 34. Data Minimization

Notification payloads should contain only information required for delivery.

Avoid copying entire domain objects into notification records.

For example, an order confirmation does not require the complete internal Order aggregate.

---

## 35. Sensitive Information

Notifications must not contain:

- Passwords.
- Authentication tokens.
- Payment credentials.
- Provider secrets.
- Internal security information.

Payment notifications may include safe transaction information such as:

- Order number.
- Amount.
- Currency.
- Status.

---

## 36. Notification APIs

Potential internal/admin APIs:

```text
GET /api/v1/notifications
GET /api/v1/notifications/{notificationId}
```

Customer-facing notification APIs may include:

```text
GET /api/v1/me/notifications
POST /api/v1/me/notifications/{notificationId}/read
```

Only required endpoints should be implemented.

---

## 37. In-App Notifications

If in-app notifications are implemented, the database should retain notification state such as:

```text
readAt?
```

The notification remains associated with the appropriate User or Customer.

---

## 38. Read State

Reading a notification should be idempotent.

Repeated requests should not create additional state or duplicate records.

---

## 39. Notification History

Notification records should provide enough history to determine:

- What notification was generated.
- Which channel was used.
- Who received it.
- When processing occurred.
- Whether delivery succeeded.
- Whether retries occurred.

Sensitive message content should be retained only as long as justified.

---

## 40. Failure Handling

A failed notification must not cause the underlying business transaction to fail after that transaction has already committed.

For example:

```text
Order creation succeeds
Email fails
```

The Order remains successful.

The notification is retried or marked failed according to policy.

---

## 41. Dead-Letter Handling

After exhausting retries, a notification may enter a terminal failed state.

Operational tooling should allow inspection and controlled retry where useful.

A full enterprise dead-letter queue is not required for the Demo.

---

## 42. Rate Limiting

Provider rate limits must be respected.

The worker should avoid unlimited concurrent delivery.

Concurrency should be configurable.

---

## 43. Provider Configuration

Provider credentials must be loaded through centralized configuration.

Examples:

```text
EMAIL_PROVIDER
EMAIL_API_KEY
EMAIL_FROM_ADDRESS
EMAIL_FROM_NAME
```

Secrets must remain server-side.

---

## 44. Logging

Structured logs should include:

```text
notificationId
notificationType
channel
storeId
recipientReference
attempt
status
requestId
jobId
```

Do not log full message bodies when they contain sensitive customer information.

---

## 45. Metrics

Useful metrics include:

- Notifications created.
- Notifications sent.
- Notifications failed.
- Retry count.
- Delivery latency.
- Provider errors.
- Queue depth.
- Processing duration.

Metrics should support operational troubleshooting without exposing customer data.

---

## 46. Events

The Notifications module may emit events such as:

```text
NotificationCreated
NotificationSent
NotificationFailed
```

These events are operational facts and should not be confused with the original business events.

---

## 47. Testing Strategy

### Unit Tests

Test:

- Notification type selection.
- Recipient resolution.
- Template rendering.
- Preference rules.
- Retry classification.
- State transitions.

### Integration Tests

Test:

- Notification persistence.
- Job claiming.
- Provider adapter.
- Retry behavior.
- Failure handling.
- Tenant isolation.

### API Tests

Test:

- Notification retrieval.
- Read state.
- Authorization.
- Invalid notification access.

### E2E Tests

Test:

```text
Create Order
   ↓
Order Event
   ↓
Notification Created
   ↓
Worker Processes Notification
   ↓
Provider Called
   ↓
Notification Marked SENT
```

---

## 48. Critical Reliability Tests

```text
[ ] Duplicate event does not create unintended duplicate notification
[ ] Worker retry does not corrupt notification state
[ ] Provider timeout is handled
[ ] Provider rejection is handled
[ ] Worker crash does not permanently lose work
[ ] Stale PROCESSING notifications can recover
[ ] Cross-tenant notification access is denied
[ ] Transactional notification does not alter business transaction correctness
[ ] Notification payload does not expose secrets
```

---

## 49. Implementation Sequence

```text
1. Define notification types
2. Define notification lifecycle
3. Define supported channels
4. Define recipient model
5. Define notification schema
6. Create migrations
7. Define notification application services
8. Implement template system
9. Implement recipient resolution
10. Implement notification persistence
11. Implement job creation
12. Implement worker processing
13. Implement provider abstraction
14. Implement email adapter
15. Implement retry handling
16. Implement stale-job recovery
17. Implement notification APIs
18. Implement required preferences
19. Implement notification events
20. Add unit tests
21. Add integration tests
22. Add API tests
23. Add E2E tests
```

---

## 50. Demo Simplifications

The Demo does not require:

- Multi-provider routing.
- SMS infrastructure.
- WhatsApp integration.
- Push notification infrastructure.
- Marketing automation.
- Advanced campaign management.
- Template builder UI.
- Notification analytics warehouse.
- Complex preference orchestration.
- Dedicated message broker.

A PostgreSQL-backed notification/job system with one required delivery provider is sufficient.

---

## 51. V1 Evolution

The Notifications boundary can later support:

- Multiple email providers.
- SMS.
- Push notifications.
- WhatsApp.
- Provider failover.
- Advanced notification preferences.
- Template management UI.
- Localization.
- Delivery analytics.
- Dedicated messaging infrastructure.
- Event streaming.

These additions should not require business modules to directly depend on individual notification providers.

---

## 52. Definition of Done

The Notifications implementation is complete when:

```text
[ ] Notification domain model exists
[ ] Notification lifecycle exists
[ ] Required notification types are defined
[ ] Recipient resolution exists
[ ] Store context is preserved
[ ] Tenant isolation is enforced
[ ] Templates are separated from business logic
[ ] Provider abstraction exists
[ ] Required delivery provider works
[ ] Notification jobs are durable
[ ] Worker processing works
[ ] Retry behavior exists
[ ] Failed notifications are recoverable
[ ] Duplicate processing is controlled
[ ] Notification preferences work where required
[ ] Transactional notifications are distinguished from promotional notifications
[ ] Sensitive data is protected
[ ] Secrets are not logged
[ ] APIs exist where required
[ ] Structured logging exists
[ ] Operational metrics exist
[ ] Unit tests exist
[ ] Integration tests exist
[ ] API tests exist
[ ] E2E notification workflow works
[ ] Documentation matches implementation
```