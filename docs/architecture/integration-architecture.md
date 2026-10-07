# Integration Architecture

## 1. Purpose

This document defines how the Demo platform integrates with external systems.

The goal is to keep external dependencies isolated from the core commerce domain while providing reliable integration behavior.

The architecture covers:

- Payment providers
- Object storage
- Email/notifications
- Authentication providers
- Error monitoring
- DNS/CDN infrastructure
- External webhooks
- Future third-party integrations

The Demo should use external services where they provide clear value, without allowing provider-specific behavior to leak throughout the application.

---

# 2. Integration Principles

All external integrations should follow these principles:

1. External providers are treated as untrusted boundaries.
2. Provider-specific code stays isolated.
3. Core business logic should not depend directly on provider SDKs.
4. External failures must not corrupt internal state.
5. Webhooks must be authenticated.
6. Webhook processing must be idempotent.
7. Sensitive credentials must never be hardcoded.
8. External operations should be observable.
9. Integrations should be replaceable where practical.
10. The Demo should avoid unnecessary third-party dependencies.

---

# 3. Integration Boundary

The general architecture is:

```text id="1m8w0a"
                 Commerce Core
                      │
                      ▼
              Integration Interface
                      │
                      ▼
                Provider Adapter
                      │
                      ▼
               External Provider
```

For example:

```text id="h6f2s8"
Payments Module
      ↓
Payment Provider Interface
      ↓
Payment Adapter
      ↓
Payment Provider API
```

The business module should know what operation it needs.

It should not need to know the provider's SDK implementation details.

---

# 4. Integration Categories

The Demo may use the following external categories:

| Integration | Purpose | Criticality |
|---|---|---|
| Payment Provider | Process customer payments | Critical |
| Object Storage | Store media | Important |
| Email Provider | Notifications | Secondary |
| Cloudflare | DNS/CDN/security | Infrastructure |
| Error Monitoring | Application observability | Operational |
| Authentication Provider | Optional identity support | Security-sensitive |
| GitHub | Source control/CI | Development/Deployment |

Not every integration needs to exist in the first Demo implementation.

---

# 5. Payment Integration

Payments are the most sensitive external integration.

The architecture is:

```text id="l3b7k9"
Checkout
   ↓
Payments Module
   ↓
Payment Interface
   ↓
Provider Adapter
   ↓
Payment Provider
```

The Payments module owns the internal payment lifecycle.

The provider owns the actual external payment processing.

---

# 6. Payment Provider Abstraction

The internal payment interface should conceptually support operations such as:

```text id="a8jyd4"
createPayment()
getPaymentStatus()
cancelPayment()
handleWebhook()
```

The exact interface depends on the selected provider.

Provider-specific concepts should not spread into:

- Checkout
- Orders
- Inventory
- Carts

---

# 7. Payment Request Flow

A payment request follows:

```text id="c7g6zi"
Customer
   ↓
Checkout
   ↓
Payments Module
   ↓
Create Payment Attempt
   ↓
Provider Adapter
   ↓
Payment Provider
   ↓
Provider Result
   ↓
Payment State
```

The internal payment state must be maintained independently of the provider response format.

---

# 8. Payment Webhooks

Payment providers may asynchronously report payment state.

The flow is:

```text id="a4cl3s"
Payment Provider
       ↓
Webhook Endpoint
       ↓
Verify Authenticity
       ↓
Identify Payment
       ↓
Validate Event
       ↓
Check Idempotency
       ↓
Update Payment State
       ↓
Trigger Required Effects
```

Webhook processing must not trust the request body until authenticity has been verified.

---

# 9. Payment Idempotency

Payment operations must be retry-safe.

The architecture should support an idempotency mechanism that prevents repeated requests from creating duplicate payment effects.

Conceptually:

```text id="qpjk1v"
Client Request
     ↓
Idempotency Key
     ↓
Payment Operation
     ↓
Stored Result
```

A repeated request with the same logical operation should resolve to the existing operation where appropriate.

---

# 10. Payment Provider Failure

The system must distinguish between:

- Temporary provider outage.
- Timeout.
- Rate limit.
- Invalid request.
- Payment rejection.
- Authentication/configuration failure.

For example:

```text id="4vml2g"
Provider Timeout
      ↓
Payment remains recoverable
      ↓
Retry / Provider Confirmation
```

The system must not assume that a timeout means the payment definitely failed.

This is especially important because external systems may have completed an operation even when the client did not receive the response.

---

# 11. Object Storage

Object storage is intended for persistent media.

Examples:

- Product images
- Store assets
- Other supported media

The architecture is:

```text id="0ct5hi"
Application
    ↓
Storage Interface
    ↓
Object Storage Provider
```

The application server should not be treated as the permanent storage location for production media.

---

# 12. Media Upload Flow

A typical upload flow may be:

```text id="5n7a3s"
Merchant
   ↓
Application
   ↓
Authorization
   ↓
Generate Upload Permission
   ↓
Object Storage
   ↓
Upload Media
   ↓
Application Records Media Reference
```

The application should store metadata and references rather than unnecessarily storing large binary files inside PostgreSQL.

---

# 13. Media Access

Media may be:

- Public.
- Private.
- Restricted to authorized users.

Access policy must be determined by the resource.

Private media must not become publicly accessible merely because someone knows its storage key.

---

# 14. Object Storage Failures

If object storage is unavailable:

```text id="7h08w8"
Upload
  ↓
Storage Failure
  ↓
Operation Fails
  ↓
No Invalid Media Reference Created
```

The application should not record a successful media association if the required upload did not actually complete.

---

# 15. Email Integration

Email is a secondary integration.

Typical uses include:

- Order confirmation
- Order status notifications
- Account-related messages
- Operational notifications

The architecture is:

```text id="0z7s6m"
Application Event
      ↓
Notification Job
      ↓
Email Service Interface
      ↓
Email Provider
```

---

# 16. Email Failure

Email delivery should not determine whether a commerce transaction succeeds.

For example:

```text id="m1s3a9"
Order Created
      ↓
Commit
      ↓
Email Job
      ↓
Email Provider Failure
      ↓
Retry
```

The order remains valid even if email delivery fails.

---

# 17. Authentication Integrations

The platform may use an external identity provider if required.

However, authentication integration must remain behind the authentication boundary.

Conceptually:

```text id="2n6d9w"
Application
    ↓
Auth Package
    ↓
Identity Provider Adapter
    ↓
External Identity Provider
```

The core application should consume a normalized identity rather than provider-specific objects.

---

# 18. Authentication Provider Failure

If an external identity provider is unavailable, the system must fail safely.

Authentication failure must not:

- Grant access.
- Create an unauthenticated merchant session.
- Bypass authorization.
- Expose protected resources.

---

# 19. Error Monitoring

The platform may integrate with an error monitoring service such as Sentry.

Monitoring integration is operational rather than business-critical.

Conceptually:

```text id="srrl4r"
Application Error
      ↓
Error Boundary
      ↓
Monitoring Adapter
      ↓
Monitoring Provider
```

Monitoring failures must not cause the primary business operation to fail.

---

# 20. Logging vs Monitoring

Logging and monitoring serve different purposes.

### Logging

Provides operational records about application behavior.

### Monitoring

Provides centralized visibility into:

- Exceptions
- Performance
- Failures
- Trends
- Alerts

Sensitive information must not be sent to either system unnecessarily.

---

# 21. Cloudflare / Edge Integration

Cloudflare may provide:

- DNS
- TLS
- CDN
- Basic edge protection
- Traffic routing

Conceptually:

```text id="q2i1ai"
Customer
   ↓
Cloudflare
   ↓
VPS / Application
```

Cloudflare is infrastructure rather than a business-domain dependency.

The application should remain functional independently of Cloudflare-specific APIs wherever practical.

---

# 22. GitHub and CI/CD

GitHub is used for:

- Source control
- Pull requests
- Code review
- GitHub Actions
- Deployment automation

Conceptually:

```text id="ks5j1v"
Developer
   ↓
GitHub
   ↓
CI
   ├── Lint
   ├── Typecheck
   ├── Tests
   └── Build
        ↓
Deployment
```

Deployment architecture is defined separately.

---

# 23. Webhook Architecture

External systems may send webhooks to the platform.

The general flow is:

```text id="5y0v44"
External Provider
      ↓
HTTPS Webhook Endpoint
      ↓
Authenticity Verification
      ↓
Payload Validation
      ↓
Integration Event
      ↓
Application / Worker
      ↓
Domain Operation
```

Webhook endpoints should perform only the processing necessary to safely accept the event before handing longer work to asynchronous processing where appropriate.

---

# 24. Webhook Security

Webhook endpoints MUST verify:

- Signature or equivalent authenticity mechanism.
- Expected event format.
- Provider identity.
- Event structure.

They MUST reject malformed or unauthenticated events.

Secrets used for webhook verification MUST be stored securely.

---

# 25. Webhook Idempotency

Every provider event that can produce a business effect should have a reliable duplicate-detection mechanism.

Conceptually:

```text id="z9e8ef"
Provider Event ID
      ↓
Already Processed?
   /        \
 Yes         No
 ↓            ↓
Ignore      Process
              ↓
         Record Event
```

The exact storage mechanism is implementation-specific.

---

# 26. External API Timeouts

External calls must have controlled timeouts.

The application should not allow a provider that has stopped responding to hold application resources indefinitely.

Conceptually:

```text id="j9p1sf"
External Request
      ↓
Timeout Boundary
      ↓
Success / Failure
```

Timeout behavior must be appropriate to the operation.

---

# 27. External API Retries

Retries should only occur when safe.

Potentially retryable:

- Connection timeout.
- Temporary network failure.
- Temporary server error.
- Rate limit with provider guidance.

Potentially unsafe to retry blindly:

- Payment creation.
- Non-idempotent external mutation.
- Operations with unknown completion status.

Where possible, provider-supported idempotency should be used.

---

# 28. External State vs Internal State

The platform must distinguish:

```text id="m46y6k"
Internal State
       +
External Provider State
```

The external provider is authoritative for provider-owned operations.

The platform is authoritative for its own business state.

For example:

```text id="j3a9t8"
Payment Provider
→ Payment processing result

Commerce Platform
→ Internal payment state
→ Order state
→ Customer-visible order
```

Synchronization between these states must be deliberate.

---

# 29. Integration Configuration

Provider configuration must be externalized.

Examples:

```text id="g0f2be"
PAYMENT_PROVIDER_KEY
STORAGE_ACCESS_KEY
EMAIL_API_KEY
WEBHOOK_SECRET
```

Credentials MUST:

- Never be committed to Git.
- Never be hardcoded.
- Never be exposed to the browser.
- Be supplied through appropriate environment/secret management.
- Be separated between environments.

---

# 30. Environment Separation

Integrations should use separate configuration for:

```text id="4b7oqa"
Local Development
       ↓
Demo / Staging
       ↓
Production
```

For payment processing in particular:

```text id="3v4m5q"
Development / Demo
→ Sandbox Provider

Production
→ Production Provider
```

Production credentials must never be used casually during development.

---

# 31. Integration Adapters

Provider-specific implementation should be isolated.

Conceptually:

```text id="q6o1kz"
payments/
├── domain/
├── application/
└── infrastructure/
    └── providers/
        ├── provider-a/
        └── provider-b/
```

The exact structure may differ during implementation.

The architectural principle remains:

> Provider-specific logic stays behind the integration boundary.

---

# 32. Integration Testing

External integrations should be tested at multiple levels.

### Unit Tests

Test provider-independent business logic.

### Integration Tests

Test adapters against supported provider APIs or controlled test environments.

### Mock / Stub Tests

Test failure conditions without requiring real external services.

### End-to-End Tests

Use sandbox providers where appropriate.

Production credentials must never be required for ordinary automated tests.

---

# 33. Integration Failure Isolation

External failures should remain isolated from unrelated parts of the platform.

For example:

```text id="a8b9tr"
Email Provider Down
      ↓
Email Jobs Retry
      ↓
Orders Continue Operating
```

Similarly:

```text id="e1v0af"
Monitoring Provider Down
      ↓
Monitoring Event Lost / Buffered
      ↓
Application Continues
```

One optional external service must not become a single point of failure for the commerce core.

---

# 34. Integration Observability

External operations should provide sufficient context for troubleshooting.

Useful information includes:

- Provider name.
- Operation.
- Internal resource ID.
- External reference ID.
- Request/correlation ID.
- Success/failure status.
- Error category.
- Timing information.

Sensitive credentials and payment information must never be logged.

---

# 35. Integration Ownership

The ownership model should remain clear.

| Integration | Owning Area |
|---|---|
| Payment provider | Payments |
| Object storage | Media / relevant domain |
| Email provider | Notifications / application infrastructure |
| Authentication provider | Auth package |
| Error monitoring | Infrastructure |
| Cloudflare | Infrastructure |
| GitHub | Development / CI |

The owner is responsible for isolating provider-specific behavior.

---

# 36. Integration Selection Principles

When choosing a provider:

1. Prefer mature and well-supported services.
2. Prefer APIs with strong sandbox support.
3. Prefer explicit idempotency mechanisms.
4. Prefer reliable webhook support.
5. Prefer reasonable operational visibility.
6. Avoid unnecessary vendor lock-in.
7. Avoid introducing multiple providers for the same capability without a concrete requirement.
8. Keep provider credentials and configuration isolated.

The Demo does not need multiple providers merely to demonstrate architectural ambition.

---

# 37. Demo Integration Scope

The Demo should initially support only the integrations required by the product lifecycle.

Expected categories:

```text id="h24u1y"
PostgreSQL
Payment Sandbox
Object Storage
Email / Notification Provider
Error Monitoring
Cloudflare / DNS
GitHub / CI
```

Optional integrations should be added only when a real feature requires them.

---

# 38. V1 Evolution

As the platform grows, integration infrastructure may evolve toward:

```text id="e8apq5"
Commerce Core
     │
     ├── Payment Service
     ├── Notification Service
     ├── Media Service
     ├── Search
     ├── Analytics
     └── External Integrations
```

However, the initial modular boundaries should remain intact.

Provider replacement should ideally affect the adapter/integration layer rather than the business domain.

---

# 39. Integration Anti-Patterns

The following patterns should be avoided.

### Provider SDK in Domain Logic

```text id="o5k9s3"
Order Domain
   ↓
Payment Provider SDK
```

### Provider Object Leaking Across Modules

```text id="uhd1d8"
Checkout
   ↓
ProviderSpecificPaymentObject
```

### Unverified Webhooks

```text id="3fys8m"
Webhook
   ↓
Update Payment
```

without authenticity verification.

### Blind External Retries

```text id="9qkh2a"
Unknown Payment Result
   ↓
Create Payment Again
```

### Secrets in Source Code

```text id="1n8b9j"
const API_KEY = "..."
```

### External Provider as Internal Source of Truth

The application must not assume that an external provider's API response replaces its own transactional database state.

---

# 40. Integration Invariants

All external integrations must preserve:

1. Provider-specific logic remains isolated.
2. Credentials remain secure.
3. External failures do not corrupt internal state.
4. Webhooks are authenticated.
5. Duplicate events are safe.
6. Retry behavior is controlled.
7. Timeouts are defined.
8. Sensitive information is not logged.
9. Integration state is observable.
10. Business modules remain provider-independent where practical.

---

# 41. Definition of Done

The integration architecture is correctly implemented when:

- Payment providers are isolated behind the Payments module.
- Provider-specific SDKs do not leak into domain logic.
- Object storage is abstracted from business modules.
- Email processing is asynchronous where appropriate.
- Webhooks are authenticated and idempotent.
- External failures are classified and handled safely.
- Provider credentials are externalized.
- Development and production integrations are separated.
- External calls have appropriate timeout and retry behavior.
- Integration operations are observable.
- Automated tests can run without production credentials.
- Optional external services cannot corrupt core commerce state.

---

# 42. Summary

The integration model is:

```text
                 Commerce Platform
                        │
              ┌─────────┼─────────┐
              │         │         │
              ▼         ▼         ▼
           Payments   Storage    Email
              │         │         │
              ▼         ▼         ▼
           Provider  Provider   Provider
```

All external systems remain behind controlled boundaries.

The core principle is:

> **External providers provide capabilities, but the commerce platform owns its business state. Provider-specific failures, APIs, and implementation details must remain contained at the integration boundary.**