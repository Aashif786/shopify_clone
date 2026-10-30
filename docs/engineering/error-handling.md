# Error Handling

## 1. Purpose

This document defines how errors are created, propagated, logged, translated, and exposed throughout the Cal Cart commerce platform.

The objective is to make failures:

- Predictable.
- Safe.
- Debuggable.
- Consistent across modules and applications.
- Appropriate for retries where applicable.
- Safe for multi-tenant operation.
- Safe for public API exposure.

Error handling must preserve the distinction between **expected business failures** and **unexpected system failures**.

---

## 2. Core Principles

The platform follows these principles:

1. Errors must represent meaningful failure conditions.
2. Expected business failures should be explicit and predictable.
3. Unexpected failures must not expose internal implementation details.
4. Errors must not bypass authorization or tenant isolation.
5. External provider failures must be isolated behind integration boundaries.
6. Retryable and non-retryable failures must be distinguishable where relevant.
7. Transactions must fail atomically when required.
8. Errors must be observable without leaking sensitive information.
9. API consumers must receive a stable error contract.
10. AI agents must not suppress errors simply to make tests or workflows pass.

---

## 3. Error Categories

Errors should generally fall into one of the following categories.

| Category | Meaning |
|---|---|
| Validation | Input is malformed or violates input constraints |
| Authentication | Caller identity is missing or invalid |
| Authorization | Caller is authenticated but not permitted |
| Not Found | Requested resource does not exist or is not accessible |
| Conflict | Request conflicts with current resource state |
| Business Rule | Domain rule prevents the operation |
| Rate Limit | Request exceeds an allowed rate |
| External Service | External provider failed or returned an unusable result |
| Infrastructure | Database, storage, queue, or other infrastructure failure |
| Internal | Unexpected application failure |

The exact error classes may vary by module, but their semantics must remain consistent.

---

## 4. Expected vs Unexpected Errors

### Expected errors

These are conditions the application anticipates and can safely communicate.

Examples:

```text id="ksn1o7"
ProductNotFound
InsufficientInventory
InvalidCheckoutState
UnauthorizedStoreAccess
DiscountExpired
PaymentAlreadyCaptured
OrderAlreadyCancelled
```

These should be handled explicitly.

### Unexpected errors

Examples:

```text id="i6h4kn"
database connection failure
unexpected null reference
programming bug
unhandled provider response
corrupted internal state
```

These should be captured, logged, and translated into a safe generic response.

Do not expose internal stack traces to customers.

---

## 5. Domain Errors

Domain errors represent violations of business rules.

Examples:

```ts id="1e9k3j"
class InsufficientInventoryError extends DomainError {
  constructor(
    public readonly variantId: string,
    public readonly requested: number,
    public readonly available: number,
  ) {
    super("Insufficient inventory");
  }
}
```

Domain errors should contain enough structured information for application-level handling without storing sensitive information unnecessarily.

Domain errors should not depend on HTTP concepts.

Avoid:

```ts id="yuw0jh"
throw new HttpException(409, "Insufficient inventory");
```

inside domain code.

The domain should remain independent of the transport layer.

---

## 6. Application Errors

Application-level errors represent failures in executing a use case.

Examples:

```text id="7qyr7h"
UnauthorizedStoreAccess
CheckoutNotFound
InvalidCheckoutState
PaymentOperationFailed
OrderCreationConflict
```

Application services may translate lower-level errors into stable application-level errors when necessary.

---

## 7. HTTP/API Errors

HTTP handling belongs at the API boundary.

A domain or application error should be mapped to the appropriate API response.

Example:

```text id="k6q0z6"
InsufficientInventoryError
        ↓
HTTP 409 Conflict
        ↓
stable API error payload
```

The HTTP layer should not require domain code to understand HTTP status codes.

---

## 8. Error Response Contract

Public API errors should use a consistent structure.

Example:

```json id="eqb7kl"
{
  "error": {
    "code": "INSUFFICIENT_INVENTORY",
    "message": "The requested quantity is not available.",
    "requestId": "req_123"
  }
}
```

The contract may later include additional structured fields, but clients should not depend on internal stack traces or database messages.

### Error fields

Typical fields include:

- `code`
- `message`
- `requestId`
- Optional structured `details` where safe

Error codes should be stable identifiers.

Messages may be changed for clarity without requiring clients to parse them.

Clients must use error codes rather than message text for programmatic behavior.

---

## 9. Error Codes

Error codes should be:

- Stable.
- Machine-readable.
- Descriptive.
- Scoped appropriately.

Examples:

```text id="gynh94"
STORE_NOT_FOUND
STORE_ACCESS_DENIED
PRODUCT_NOT_FOUND
INVALID_PRODUCT_STATE
INSUFFICIENT_INVENTORY
CART_NOT_FOUND
CHECKOUT_EXPIRED
CHECKOUT_INVALID_STATE
PAYMENT_FAILED
PAYMENT_ALREADY_CAPTURED
ORDER_NOT_FOUND
ORDER_ALREADY_CANCELLED
INVALID_DISCOUNT
```

Avoid codes such as:

```text id="52r9cm"
ERROR_1
FAILED
BAD_REQUEST
SOMETHING_WRONG
```

where the code does not communicate useful meaning.

---

## 10. Resource Not Found and Tenant Isolation

Not-found behavior must not accidentally reveal resources belonging to another tenant.

For a request such as:

```text id="v5iv4m"
GET /stores/store-A/orders/order-123
```

if `order-123` belongs to another store, the system must not disclose its existence.

Depending on the security model, the system may return a generic not-found response rather than distinguishing:

```text
does not exist
```

from:

```text
exists but belongs to another tenant
```

Tenant isolation takes priority over detailed error disclosure.

---

## 11. Authentication Errors

Authentication failures should not reveal sensitive information.

Examples:

- Missing credentials.
- Invalid session.
- Expired session.
- Invalid token.

The API should return the documented authentication error.

Do not expose:

- Token parsing internals.
- JWT signing details.
- Session storage details.
- Authentication provider internals.

---

## 12. Authorization Errors

Authorization failures should be handled independently from authentication.

Example:

```text id="n3q9kz"
Authenticated user
        ↓
Member of Store A
        ↓
Requests Store B resource
        ↓
Authorization failure
```

Do not rely on frontend visibility as an authorization mechanism.

Every protected operation must enforce authorization server-side.

---

## 13. Validation Errors

Invalid external input should produce a predictable validation response.

Examples:

```text id="x1bl9m"
invalid UUID
missing required field
invalid email
negative quantity
unsupported currency
malformed pagination parameter
```

Validation errors should identify safe field-level information where useful.

Do not include raw parser stack traces or internal schema implementation details.

---

## 14. Conflict Errors

Use conflict errors when the requested operation cannot be completed because the resource's current state conflicts with the request.

Examples:

```text id="vwr1sp"
attempting to publish an archived product
capturing an already captured payment
creating a duplicate store slug
adding a duplicate cart item where uniqueness is required
cancelling an already cancelled order
```

Typical API mapping:

```text id="d0c3w4"
HTTP 409 Conflict
```

The exact status code should follow the API contract.

---

## 15. Business Rule Errors

Business rules should fail explicitly.

Examples:

```text id="8k0mzo"
inventory is insufficient
discount is expired
discount usage limit reached
store is suspended
checkout has expired
refund exceeds captured amount
final store owner cannot be removed
```

Do not convert business failures into generic internal errors.

---

## 16. Database Errors

Database errors should be translated where the application can safely identify their meaning.

Examples:

```text id="j2u1sj"
unique constraint violation
foreign key violation
serialization failure
deadlock
connection failure
```

### Known constraint failures

A known constraint violation may map to a domain/application conflict.

### Serialization or deadlock failures

These may be retried when the operation is designed to be safely retried.

### Connection or infrastructure failures

These should normally propagate as infrastructure failures and be logged with sufficient diagnostic context.

Never expose raw SQL errors to public API clients.

---

## 17. Transactions and Rollback

A failed transactional operation must leave the database in the expected atomic state.

Example:

```text id="y9s3dx"
Checkout completion
    ↓
reserve inventory
    ↓
create order
    ↓
record payment state
    ↓
transaction failure
    ↓
rollback transactional changes
```

Do not catch an error inside a transaction and continue as if the failed operation succeeded unless the failure is explicitly handled and the transaction remains valid.

---

## 18. External Service Errors

External integrations include:

- Payment providers.
- Object storage.
- Email providers.
- Authentication providers.
- Other third-party APIs.

Provider-specific failures must be translated into internal integration errors.

Example:

```text id="e1y4xg"
Stripe timeout
        ↓
PaymentProviderTimeout
        ↓
application handling
```

Provider SDK error objects should not leak through the application.

---

## 19. Retryable Errors

Some failures are safe to retry.

Examples may include:

```text id="8v5lpn"
temporary database serialization failure
temporary network failure
provider timeout
temporary service unavailable
```

Retries must only occur when the operation is designed to be safe for repetition.

For commerce operations, retry behavior must account for:

- Idempotency.
- Transaction boundaries.
- External provider state.
- Duplicate side effects.
- State transitions.

A timeout does not automatically mean that an external operation failed.

For example:

```text id="m7g8cp"
payment request sent
        ↓
provider processed payment
        ↓
response timed out
```

The application must reconcile the provider state rather than blindly issuing another payment.

---

## 20. Non-Retryable Errors

Do not retry errors that represent permanent business or validation failures.

Examples:

```text id="j17h3g"
invalid input
unauthorized access
insufficient inventory
expired discount
invalid checkout state
unsupported operation
```

Retrying these wastes resources and may amplify failures.

---

## 21. Idempotency and Error Handling

Operations that support idempotency must preserve the result of a previous attempt where appropriate.

Example:

```text id="f2cbxq"
Request A
    ↓
Idempotency key: abc
    ↓
Operation succeeds

Request B
    ↓
Idempotency key: abc
    ↓
Return the same logical result
```

A retried request must not accidentally create:

- Duplicate orders.
- Duplicate payments.
- Duplicate refunds.
- Duplicate inventory reservations.
- Duplicate webhook processing.

Refer to:

```text id="5w2k5s"
docs/decisions/ADR-006-idempotency-strategy.md
```

for the dedicated idempotency strategy.

---

## 22. Webhook Errors

Webhook processing must distinguish between:

- Invalid signature.
- Invalid payload.
- Duplicate webhook.
- Already processed event.
- Temporary processing failure.
- Permanent processing failure.

Invalid signatures should be rejected.

Duplicate events should be safely ignored or treated as already processed.

Temporary failures may be retried according to the provider's webhook behavior.

Webhook processing must be idempotent.

---

## 23. Background Job Errors

Jobs must distinguish between retryable and terminal failures.

Example:

```text id="w2x4nc"
Job execution
    ↓
temporary provider timeout
    ↓
retry
```

versus:

```text id="2g75eu"
Job execution
    ↓
invalid permanent payload
    ↓
mark failed
```

A job should not retry indefinitely.

Retries should have bounded attempts and appropriate backoff.

Job failures must be observable.

---

## 24. Logging Errors

Unexpected errors should be logged with enough context to diagnose the failure.

Useful fields include:

```text id="6t8ypw"
requestId
storeId
userId
operation
errorCode
resourceId
jobId
eventId
duration
```

Do not log:

- Passwords.
- Authentication tokens.
- Payment credentials.
- Secret keys.
- Full sensitive customer data.
- Raw webhook secrets.

Structured error logging should preserve the original error for internal diagnosis where safe.

---

## 25. Error Context

Errors should carry useful context without becoming overloaded with unrelated data.

Good:

```text id="5w2p1v"
orderId
paymentId
checkoutId
operation
```

Bad:

```text id="c0qg6d"
entire HTTP request
entire user object
full database row
authentication headers
payment provider credentials
```

Error context must follow data minimization principles.

---

## 26. Frontend Error Handling

The frontend must not assume every failure is an unexpected server error.

It should distinguish at least:

```text id="b0k7t2"
Validation
Authentication
Authorization
Conflict
Business rule
Temporary failure
Unexpected failure
```

Examples:

```text id="s2k5hz"
INSUFFICIENT_INVENTORY
→ Tell customer the requested quantity is unavailable.

CHECKOUT_EXPIRED
→ Ask customer to restart checkout.

UNAUTHORIZED
→ Request authentication.

PAYMENT_FAILED
→ Allow supported recovery/retry.

INTERNAL_ERROR
→ Show a safe generic message.
```

Frontend behavior should be driven by stable error codes.

---

## 27. User-Facing Messages

User-facing messages should be:

- Clear.
- Concise.
- Actionable where possible.
- Free from internal implementation details.

Prefer:

```text id="qj5m8k"
"The requested quantity is no longer available."
```

over:

```text id="x8o1cy"
"InventoryReservationService failed because UPDATE inventory_items returned SQLSTATE 23514."
```

The database should not be invited into the customer conversation.

---

## 28. Error Boundaries

Unexpected failures should be caught at appropriate application boundaries.

For web requests:

```text id="a3g5n9"
Route / API boundary
    ↓
global error handling
```

For workers:

```text id="r2m7sv"
Job execution boundary
    ↓
job failure handling
```

For asynchronous event processing:

```text id="u7m3jc"
Event consumer boundary
    ↓
event failure handling
```

Error boundaries should prevent one failure from crashing unrelated work where practical.

---

## 29. Fail Safe

When a security-sensitive decision cannot be safely determined, the system should fail closed.

Examples:

```text id="qz9zqf"
cannot verify authorization
→ deny access

cannot verify webhook signature
→ reject webhook

cannot verify payment state
→ do not mark payment successful

cannot determine tenant ownership
→ deny access
```

Correctness and security take priority over convenience.

---

## 30. Observability

Important errors should be observable through the project's logging and monitoring infrastructure.

At minimum, monitor:

- Unexpected application errors.
- Failed background jobs.
- Payment failures.
- Webhook failures.
- Database failures.
- Authentication failures.
- Authorization anomalies.
- Repeated checkout failures.

Error monitoring must provide enough context to identify affected operations without exposing sensitive data.

---

## 31. Error Handling Anti-Patterns

Do not:

### Swallow errors

```ts id="c0t7xm"
try {
  await operation();
} catch {
  // ignore
}
```

### Return success after failure

```ts id="7q0j1m"
try {
  await createOrder();
} catch {
  return { success: true };
}
```

### Expose internal errors

```ts id="xq5f3e"
return {
  error: databaseError.message,
};
```

### Retry blindly

```ts id="k3l7v9"
while (true) {
  await chargePayment();
}
```

### Use generic errors everywhere

```ts id="b9r1c4"
throw new Error("Something went wrong");
```

when the caller needs to distinguish the actual failure.

---

## 32. Error Handling by Layer

| Layer | Responsibility |
|---|---|
| API | Map errors to transport responses |
| Application | Coordinate expected failures |
| Domain | Enforce business rules |
| Infrastructure | Translate infrastructure/provider failures |
| Worker | Retry or terminate jobs appropriately |
| Frontend | Present safe recovery behavior |
| Monitoring | Record unexpected operational failures |

No layer should take over responsibilities belonging to another layer.

---

## 33. Testing Error Handling

Tests must cover important failure paths.

At minimum, critical commerce workflows should test:

- Invalid input.
- Unauthorized access.
- Cross-tenant access.
- Missing resources.
- Invalid state transitions.
- Insufficient inventory.
- Concurrent operations.
- Duplicate requests.
- Payment failures.
- Provider timeouts.
- Webhook duplication.
- Transaction rollback.
- Retry behavior.
- Unexpected failures.

Error responses should be tested for both correctness and information leakage.

---

## 34. Definition of Done

Error handling is complete when:

- Expected failures are explicitly represented.
- Unexpected failures are safely handled.
- Public APIs use a stable error contract.
- Sensitive information is not exposed.
- Tenant isolation remains intact during failures.
- Transactions roll back correctly.
- Retry behavior is deliberate.
- Critical operations are idempotent where required.
- Background job failures are observable.
- External provider failures are isolated.
- Relevant failure paths are covered by tests.
- Actual verification results are reported accurately.