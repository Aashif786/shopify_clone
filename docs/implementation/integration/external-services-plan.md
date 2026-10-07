# External Services Plan

## 1. Purpose

This document defines how the Demo integrates with external services and providers.

The Demo should use external services where they provide clear value, while avoiding unnecessary infrastructure and vendor coupling.

The architecture must allow providers to be replaced without changing domain business logic.

---

# 2. External Service Principles

External services must follow these rules:

- Provider SDKs remain outside domain logic.
- External calls are isolated behind application interfaces and adapters.
- Secrets are loaded through centralized configuration.
- External failures are translated into application-level errors.
- Critical operations define retry and idempotency behavior.
- External calls must not occur inside unnecessarily long database transactions.
- Provider-specific models must not leak into domain models.
- External service availability must not compromise tenant isolation.
- Integrations must be observable.

---

# 3. Demo External Services

The initial Demo may use:

```text
Cloudflare
PostgreSQL
Object Storage
Payment Provider / Sandbox
Email Provider
Sentry
GitHub / GitHub Actions
```

Not every provider must be enabled on day one.

A service should be introduced when the corresponding feature requires it.

---

# 4. Provider Abstraction

The general pattern is:

```text
Domain / Application
        ↓
Internal Interface
        ↓
Provider Adapter
        ↓
External SDK / HTTP API
```

Example:

```text
Payments
   ↓
PaymentGateway
   ↓
SandboxPaymentAdapter
   ↓
Payment Provider
```

The Payments module must not depend directly on a provider SDK.

---

# 5. Provider Selection

Provider selection should consider:

- Demo requirements.
- API reliability.
- Sandbox availability.
- Documentation quality.
- Webhook support.
- Idempotency support.
- Regional availability.
- Cost.
- Security requirements.
- Ease of replacement.

Avoid selecting a provider solely because its SDK is convenient.

---

# 6. Payment Provider

The payment provider is the most business-critical external integration.

The Demo should use a sandbox/test environment.

Required capabilities:

```text
Create payment
Confirm payment
Receive webhook
Check payment status
Refund payment
```

Provider-specific functionality beyond the Demo requirements should not be implemented prematurely.

---

# 7. Payment Provider Adapter

The adapter should translate between internal payment contracts and provider APIs.

Conceptually:

```text
Payment Application Service
        ↓
PaymentGateway
        ↓
PaymentProviderAdapter
        ↓
Provider API
```

The adapter owns:

- Provider request mapping.
- Provider response mapping.
- Provider error mapping.
- Provider authentication.
- Provider idempotency headers.
- Webhook signature verification support.

---

# 8. Payment Idempotency

Payment creation must support safe retries.

The internal system should maintain its own idempotency record.

Where supported, the same idempotency key should also be passed to the provider.

This provides two layers of protection:

```text
Application idempotency
        +
Provider idempotency
```

---

# 9. Payment Webhooks

Payment providers may send duplicate or delayed events.

Webhook processing must support:

- Signature verification.
- Replay protection.
- Duplicate detection.
- Out-of-order events.
- Provider retries.
- Unknown event handling.
- Durable processing.

The webhook handler should not assume that events arrive exactly once or in chronological order.

---

# 10. Payment Reconciliation

Provider state and local state can temporarily differ.

The architecture should allow reconciliation through:

```text
Local payment state
        ↕
Provider status lookup
```

Reconciliation may initially be a manual or background operation.

A full automated reconciliation platform is outside Demo scope.

---

# 11. Object Storage

Binary media should use object storage rather than PostgreSQL.

Examples:

```text
Product images
Store assets
Uploaded files
```

The application stores metadata in PostgreSQL.

---

# 12. Object Storage Architecture

```text
Web Application
      ↓
Media Service
      ↓
Object Storage
```

PostgreSQL stores:

```text
media id
store id
object key
content type
size
status
metadata
timestamps
```

---

# 13. Object Key Isolation

Object keys must contain sufficient tenant/store context to prevent accidental cross-store collisions.

Example conceptual structure:

```text
stores/{storeId}/products/{productId}/{mediaId}
```

The exact object-key format may evolve.

Object keys should never be directly derived from untrusted user input.

---

# 14. Upload Security

Uploads should validate:

- File size.
- Content type.
- File extension where relevant.
- Object key.
- Store ownership.
- Authorization.

Where appropriate, the application should verify actual file content rather than trusting the client-provided MIME type.

---

# 15. Signed URLs

Private objects should use time-limited signed URLs.

Public storefront media may use controlled public access depending on the storage configuration.

Authorization must occur before issuing access to private objects.

---

# 16. Media Failure Handling

If object storage is temporarily unavailable:

- Metadata must not incorrectly indicate a completed upload.
- Failed uploads should be recoverable.
- Orphaned objects should be detectable.
- Cleanup should occur asynchronously where appropriate.

---

# 17. Email Provider

Email is a secondary integration.

Potential uses:

```text
Account verification
Password reset
Order confirmation
Payment confirmation
Order status updates
```

The application should treat email delivery as asynchronous.

---

# 18. Email Architecture

```text
Domain Event
     ↓
Notification
     ↓
Email Job
     ↓
Email Adapter
     ↓
Email Provider
```

Business transactions should not normally wait for email delivery.

---

# 19. Email Provider Abstraction

Use an internal interface such as:

```text
EmailSender
```

The adapter handles:

- Provider authentication.
- Message construction.
- Provider API calls.
- Error translation.
- Provider response mapping.

The notification domain owns business meaning, not provider-specific implementation.

---

# 20. Email Idempotency

The system should prevent duplicate transactional emails where duplicate delivery would be harmful or confusing.

A notification should have a durable identity.

Retrying a job should not blindly create an unlimited number of identical messages.

---

# 21. Email Failure

Email failures should normally result in:

```text
Notification
    ↓
Failed / Retryable
    ↓
Job retry
```

They should not roll back a successfully completed order.

---

# 22. Cloudflare

Cloudflare may provide:

- DNS.
- TLS.
- Reverse proxy.
- Basic edge protection.
- Caching where appropriate.

The application should not depend on Cloudflare-specific behavior for core business correctness.

---

# 23. Cloudflare and Application Security

Cloudflare can provide an additional security layer, but it does not replace:

- Authentication.
- Authorization.
- Tenant isolation.
- Input validation.
- Application-level rate limiting.
- Webhook verification.

Security must remain correct even if traffic reaches the VPS without Cloudflare-specific protections.

---

# 24. Sentry

Sentry may be used for application error monitoring.

It should capture:

- Unhandled exceptions.
- Request context.
- Worker failures.
- Release/version.
- Relevant correlation identifiers.

Sensitive data must be filtered before transmission.

---

# 25. Observability Provider Isolation

Application code should not become tightly coupled to a monitoring vendor.

Use a small internal observability abstraction where useful.

For example:

```text
Logger
Metrics
ErrorReporter
```

The implementation can initially target Sentry and structured application logs.

---

# 26. GitHub and CI/CD

GitHub and GitHub Actions are development and deployment infrastructure rather than business dependencies.

They may provide:

- Source control.
- Pull requests.
- Automated tests.
- Type checking.
- Builds.
- Deployment workflows.

Production runtime must not depend on GitHub being available.

---

# 27. External Service Configuration

Provider configuration belongs in the centralized configuration system.

Example categories:

```text
PAYMENT_PROVIDER_*
STORAGE_*
EMAIL_PROVIDER_*
SENTRY_*
CLOUDFLARE_*
```

Exact environment variable names should be defined by the configuration implementation.

---

# 28. Secret Management

Secrets must:

- Never be committed.
- Never appear in source code.
- Never appear in logs.
- Never be exposed to browser bundles.
- Be supplied through environment-specific secret configuration.
- Be rotatable.

Examples:

```text
Database credentials
Payment API secrets
Storage credentials
Email credentials
Sentry authentication credentials
```

---

# 29. External Service Timeouts

Every external request should have a bounded timeout.

The application must not allow a provider to hold a request indefinitely.

Timeout values should be configurable where appropriate.

---

# 30. Retry Strategy

Retries should be used only when the failure is potentially transient.

Potentially retryable:

```text
Timeout
Temporary network failure
Provider 5xx
Rate limit with appropriate backoff
```

Usually not retryable:

```text
Invalid credentials
Invalid request
Authorization failure
Invalid payment parameters
Permanent validation error
```

---

# 31. Backoff

Retries should use bounded exponential backoff with jitter where appropriate.

Retries must have a maximum attempt count.

The system must not create unbounded retry loops.

---

# 32. External Calls and Transactions

Avoid:

```text
BEGIN TRANSACTION
    ↓
Database mutation
    ↓
External API call
    ↓
Wait
    ↓
External API response
    ↓
COMMIT
```

Prefer explicit state transitions:

```text
Persist local state
    ↓
Commit
    ↓
Call provider
    ↓
Persist provider result
```

The exact sequence depends on the operation.

---

# 33. Provider Failure and Recovery

External integrations should use explicit states where necessary.

Example:

```text
Payment
    ↓
PENDING
    ↓
PROCESSING
    ↓
SUCCEEDED
```

or:

```text
PROCESSING
    ↓
FAILED
```

This prevents temporary provider failures from being confused with definitive business outcomes.

---

# 34. Rate Limits

External providers may enforce rate limits.

The application should:

- Detect provider rate limits.
- Respect retry-after information where available.
- Apply bounded retry behavior.
- Avoid aggressive retry storms.
- Record provider throttling.

---

# 35. External Service Health

The application should distinguish:

```text
Application health
Provider availability
```

A temporary provider outage should not necessarily cause the entire application readiness check to fail.

For example, a payment provider outage does not mean the web application process is unhealthy.

---

# 36. External Service Testing

Tests should not depend on live third-party services by default.

Use:

- Provider mocks.
- Contract fixtures.
- Local test adapters.
- Sandbox integration tests where required.

Critical provider behavior should be covered by integration tests against the provider sandbox when practical.

---

# 37. Provider Adapter Testing

Each adapter should test:

```text
Successful request
Validation failure
Authentication failure
Timeout
Provider error
Rate limit
Malformed response
Duplicate request
Webhook verification
```

---

# 38. Webhook Testing

Webhook tests should cover:

- Valid signatures.
- Invalid signatures.
- Expired/replayed events.
- Duplicate events.
- Unknown events.
- Malformed payloads.
- Out-of-order events.
- Provider retry behavior.

---

# 39. External Service Failure Matrix

| Service | Failure | Expected Behavior |
|---|---|---|
| Payment provider | Timeout | Preserve recoverable payment state |
| Payment provider | 5xx | Retry where safe |
| Payment provider | Invalid request | Return business/application error |
| Email provider | Timeout | Retry notification job |
| Object storage | Upload failure | Mark upload unsuccessful |
| Object storage | Temporary outage | Retry where appropriate |
| Sentry | Unavailable | Application continues |
| Cloudflare | Unavailable | Core application remains logically correct |
| GitHub | Unavailable | Runtime continues |

---

# 40. Demo vs Future V1

The Demo should deliberately avoid unnecessary infrastructure.

### Demo

```text
Payment Provider
Object Storage
Email Provider
Sentry
Cloudflare
```

### Future V1 may add

```text
Dedicated search
Advanced email infrastructure
Multiple payment providers
CDN optimization
Advanced observability
Managed infrastructure
Queue/broker infrastructure
Provider failover
Automated reconciliation
```

These should be introduced because of actual requirements, not because the architecture diagram looked lonely.

---

# 41. External Service Security

Every integration must consider:

- Credential protection.
- Least-privilege credentials.
- TLS.
- Request signing where supported.
- Webhook verification.
- Replay protection.
- Input validation.
- Output validation.
- Sensitive-data minimization.
- Auditability.

---

# 42. Tenant Context

External requests must preserve tenant/store context internally.

For example:

```text
Store
  ↓
Payment Request
  ↓
Provider
```

The provider does not become the source of tenant authorization.

The application must establish the tenant context before performing the operation.

---

# 43. Provider Data Mapping

Do not persist provider-specific response objects directly as core domain entities.

Instead:

```text
Provider Response
      ↓
Adapter Mapping
      ↓
Application Result
      ↓
Domain State
```

Provider-specific fields may be retained as integration metadata where justified.

---

# 44. External Integration Logging

Logs should contain enough information to diagnose provider failures without leaking secrets.

Useful metadata includes:

```text
provider
operation
requestId
correlationId
storeId
internal resource ID
provider resource ID
duration
result category
```

Do not log:

- API secrets.
- Passwords.
- Full payment credentials.
- Sensitive authentication tokens.
- Complete private customer payloads unnecessarily.

---

# 45. External Service Monitoring

Monitor at least:

```text
Request count
Success rate
Failure rate
Latency
Timeouts
Rate limits
Retry count
Webhook failures
Job failures
```

Payment and storage integrations deserve stronger monitoring because of their direct business impact.

---

# 46. External Integration Definition of Done

An external integration is complete when:

```text
[ ] Internal interface defined
[ ] Provider adapter implemented
[ ] Configuration defined
[ ] Secrets protected
[ ] Timeout configured
[ ] Retry behavior defined
[ ] Idempotency behavior defined where required
[ ] Provider errors translated
[ ] Logging implemented
[ ] Sensitive data protected
[ ] Unit tests implemented
[ ] Integration tests implemented where appropriate
[ ] Failure behavior verified
[ ] Documentation updated
```

---

# 47. Final Principle

External services are replaceable dependencies, not owners of the commerce platform.

The application's business state must remain understandable and recoverable even when an external provider is unavailable.

The architecture should therefore follow:

```text
Business Logic
      ↓
Internal Contract
      ↓
Adapter
      ↓
External Provider
```

This keeps the Demo simple while preserving a clean path toward multiple providers, stronger infrastructure, and V1-scale reliability.