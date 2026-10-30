# Code Review

## 1. Purpose

This document defines the code review standards for the Cal Cart commerce platform.

Code review exists to catch defects, protect architectural boundaries, improve maintainability, and prevent security or data-integrity failures before changes reach shared environments.

Review is not a popularity contest and it is not an opportunity to rewrite somebody else's code into your personal dialect of JavaScript.

---

## 2. Review Principles

Code review should prioritize:

1. Correctness.
2. Security.
3. Tenant isolation.
4. Authorization.
5. Data integrity.
6. Concurrency safety.
7. Idempotency.
8. API correctness.
9. Test coverage.
10. Maintainability.

Reviewers should distinguish between:

- Blocking issues.
- Important improvements.
- Minor suggestions.
- Personal preferences.

Not every stylistic disagreement deserves to block a feature.

---

## 3. Pull Request Scope

A pull request should have a clear purpose.

Reviewers should be able to answer:

- What problem does this change solve?
- What behavior changed?
- Which modules are affected?
- What risks exist?
- How was the change tested?

If the PR contains unrelated changes, the author should split them where practical.

---

## 4. Review Order

Reviewers should generally review in this order:

```text id="n3v6s8"
1. Requirements
2. Architecture
3. Security
4. Data correctness
5. Business logic
6. Error handling
7. Tests
8. API behavior
9. Maintainability
10. Style
```

This prevents formatting concerns from distracting from actual defects.

---

## 5. Requirements Review

Confirm that the implementation satisfies the relevant specification.

Reviewers should compare the PR against:

```text id="2q8m5v"
feature specification
domain documentation
API contract
database requirements
security requirements
```

Do not approve behavior merely because the implementation looks reasonable.

The question is whether it satisfies the intended requirement.

---

## 6. Architecture Review

Verify that the change respects the modular-monolith architecture.

Check:

- Correct module ownership.
- Appropriate application-service boundaries.
- No direct access to another module's internals.
- No unnecessary new services.
- No unnecessary infrastructure.
- Shared packages remain genuinely shared.
- Dependency direction remains valid.

A feature that works but violates architecture should not be treated as complete.

---

## 7. Module Boundary Review

For every cross-module dependency, ask:

```text id="5b8p2z"
Why does this module need this capability?
Who owns the capability?
Is the dependency using a public interface?
Could an event or existing application service be more appropriate?
```

Reject changes that directly manipulate another module's internal database tables or repositories.

---

## 8. Multi-Tenancy Review

Every store-scoped operation must be reviewed for tenant isolation.

Verify:

- Tenant context is resolved server-side.
- Authenticated user belongs to the relevant organization/store.
- Resource queries are appropriately scoped.
- IDs cannot be used to bypass tenant boundaries.
- Background jobs preserve tenant context.
- Webhooks resolve tenant context through trusted data.
- Error responses do not leak cross-tenant resource existence.

Example attack that must fail:

```text id="3f8m2c"
User belongs to Store A
        ↓
Requests Order belonging to Store B
        ↓
Access denied
```

---

## 9. Authorization Review

Authentication is not authorization.

Reviewers must verify that the operation checks the actor's actual permissions.

Examples:

```text id="c2n7x5"
Customer
→ may access own customer data

Store Staff
→ may perform permitted store operations

Store Owner
→ may perform owner-only operations

Cross-store member
→ must not access unrelated store data
```

Frontend restrictions are not sufficient.

---

## 10. Input Validation Review

Check that external input is validated before entering application logic.

Review:

- Request bodies.
- Query parameters.
- Path parameters.
- Headers where relevant.
- Webhooks.
- Background job payloads.
- External provider responses.

Validation must not be treated as authorization.

---

## 11. Business Logic Review

Review business rules carefully.

For commerce features, verify:

- Pricing is server-authoritative.
- Inventory is server-authoritative.
- Payment state is provider-verified.
- Order state follows the defined state machine.
- Discounts are validated server-side.
- Historical order information is preserved.
- Invalid state transitions are rejected.

Business logic should live in the appropriate domain rather than being duplicated across endpoints.

---

## 12. Database Review

For database changes, inspect:

- Schema changes.
- Foreign keys.
- Unique constraints.
- Check constraints.
- Nullability.
- Indexes.
- Migration ordering.
- Query behavior.
- Transaction boundaries.
- Historical data implications.

Ask:

```text id="7m4p2q"
What happens when two requests execute this operation simultaneously?
```

For commerce systems, this question is mandatory rather than philosophical.

---

## 13. Concurrency Review

Concurrency-sensitive operations require explicit review.

Examples:

- Inventory reservation.
- Inventory release.
- Checkout completion.
- Payment state transitions.
- Discount usage.
- Order creation.
- Webhook processing.

Review for:

- Race conditions.
- Lost updates.
- Duplicate operations.
- Incorrect locking.
- Deadlocks.
- Deterministic lock ordering.
- Retry behavior.

---

## 14. Transaction Review

Verify that transaction boundaries are appropriate.

Check:

- Related database changes are atomic.
- Transactions are not unnecessarily long.
- External network calls are not held inside inappropriate database transactions.
- Failures cause expected rollback behavior.
- Transaction retries are safe.

A transaction should represent a meaningful unit of consistency.

---

## 15. Idempotency Review

Critical operations must be reviewed for safe retries.

Examples:

```text id="7z4p8n"
payment creation
payment capture
refund
checkout completion
order creation
inventory reservation
inventory release
webhook processing
```

Ask:

```text id="1m6q3v"
What happens if this exact request arrives twice?
```

If the answer is "we get two orders," the implementation is not ready.

---

## 16. Payment Review

Payment-related changes require additional scrutiny.

Review:

- Amount source.
- Currency source.
- Provider state.
- Idempotency.
- Webhook verification.
- Replay protection.
- Timeout behavior.
- Retry behavior.
- Refund limits.
- Sensitive data handling.

Never trust a client-provided payment success flag.

---

## 17. Inventory Review

Inventory changes require special attention.

Verify:

- Quantity cannot become invalid.
- Concurrent reservations are safe.
- Insufficient stock is rejected.
- Duplicate reservations do not double-consume inventory.
- Release and commit behavior is correct.
- Reservation state transitions are valid.
- Multi-item operations are atomic where required.

---

## 18. Order Review

Orders are historical records.

Review that the implementation preserves:

- Historical prices.
- Historical product information.
- Historical discounts.
- Historical addresses.
- Payment references.
- Order status history.

Do not make historical order data depend on mutable current catalog data.

---

## 19. API Review

Check:

- Request validation.
- Authentication.
- Authorization.
- Tenant context.
- Response structure.
- Error contract.
- Pagination.
- Idempotency where applicable.
- HTTP semantics.
- Sensitive data exposure.

API responses should not expose raw database entities or provider SDK objects.

---

## 20. Error Handling Review

Verify that:

- Expected business failures have meaningful error codes.
- Unexpected errors are safely translated.
- Internal stack traces are not exposed.
- Sensitive information is not logged.
- Retryable failures are distinguishable where necessary.
- Transactions fail safely.
- Background jobs handle failure correctly.

---

## 21. Logging Review

Review important changes for sufficient observability.

Ask:

```text id="9p3r7c"
If this operation fails in production, can we determine what happened?
```

Important operations should have useful context such as:

```text id="3k8w1m"
requestId
storeId
userId
resourceId
operation
jobId
eventId
```

Do not log secrets or sensitive payment data.

---

## 22. Testing Review

Every meaningful behavior change should have appropriate tests.

Review whether tests cover:

### Success

The expected workflow works.

### Validation

Invalid input is rejected.

### Authorization

Unauthorized access fails.

### Tenant isolation

Cross-tenant access fails.

### Business rules

Invalid states and business constraints fail correctly.

### Concurrency

Race-sensitive operations remain correct.

### Idempotency

Repeated requests do not create duplicate effects.

### Integration

Database and external integration behavior works correctly.

### End-to-end

Important customer or merchant workflows remain functional.

---

## 23. Test Quality

Do not approve tests merely because they increase coverage numbers.

Good tests:

- Test observable behavior.
- Have clear names.
- Fail for meaningful reasons.
- Avoid unnecessary implementation coupling.
- Cover important edge cases.

Weak tests often:

- Mock everything.
- Assert internal method calls instead of outcomes.
- Test trivial getters.
- Ignore authorization.
- Ignore concurrency.
- Ignore failure states.

---

## 24. Frontend Review

For frontend changes, review:

- Loading states.
- Error states.
- Empty states.
- Accessibility.
- Responsive behavior.
- Authentication behavior.
- Authorization behavior.
- Server/client boundaries.
- Form validation.
- Optimistic updates.
- Race conditions.
- Data freshness.

Never rely on hiding UI elements as the only authorization mechanism.

---

## 25. Performance Review

Performance should be reviewed when the change affects potentially high-volume paths.

Look for:

- N+1 queries.
- Missing indexes.
- Large unbounded queries.
- Excessive API calls.
- Unnecessary client-side rendering.
- Large payloads.
- Expensive repeated computations.
- Unbounded background work.

Do not introduce caching simply because the code could theoretically be faster.

Measure before introducing significant complexity.

---

## 26. Dependency Review

If the PR adds dependencies, verify:

- Why the dependency is necessary.
- Whether an existing dependency could solve the problem.
- Correct workspace scope.
- Security considerations.
- License compatibility.
- Maintenance status.
- Bundle/runtime impact.
- Architectural impact.

Unnecessary dependencies should not be approved simply because they make implementation shorter.

---

## 27. Database Migration Review

For migrations, review:

- Forward migration.
- Existing production data.
- Constraints.
- Index creation.
- Lock duration.
- Backward compatibility.
- Application deployment order.
- Rollback implications.

Avoid destructive migrations without a deliberate migration plan.

For larger changes, prefer an expand-and-contract strategy.

---

## 28. Security Review

Security-sensitive changes should receive additional scrutiny.

Areas include:

- Authentication.
- Authorization.
- Tenant isolation.
- Sessions.
- Password handling.
- File uploads.
- Webhooks.
- Payments.
- Secrets.
- Data access.
- External integrations.

Ask:

```text id="g7n2q4"
Can an attacker control this input?
Can another tenant access this resource?
Can the operation be replayed?
Can the operation be performed without authorization?
Can sensitive information leak through errors or logs?
```

---

## 29. AI-Generated Code Review

AI-generated code must be reviewed as ordinary code.

Do not assume generated code is correct because:

- It compiles.
- Tests pass.
- The implementation looks sophisticated.
- The AI described it confidently.

Reviewers should pay particular attention to:

- Invented abstractions.
- Unnecessary dependencies.
- Incorrect module ownership.
- Missing authorization.
- Missing tenant checks.
- Race conditions.
- Incorrect transaction boundaries.
- Silent error handling.
- Overly broad refactors.

---

## 30. Documentation Review

When behavior or architecture changes, verify that documentation is updated.

Examples:

```text id="7q3f8m"
API behavior
→ API docs

domain behavior
→ domain/spec docs

schema behavior
→ database docs

architectural decision
→ ADR

deployment behavior
→ deployment docs

security behavior
→ security docs
```

Do not require documentation changes when the implementation genuinely does not change documented behavior.

---

## 31. Review Comments

Review comments should be:

- Specific.
- Actionable.
- Technically justified.
- Respectful.
- Focused on the code.

Prefer:

```text id="b6x8s1"
"This query is not scoped by storeId. A user from Store B could potentially retrieve Store A data. Please enforce tenant scope before the repository call."
```

over:

```text id="x1c7p5"
"Seems wrong."
```

---

## 32. Blocking vs Non-Blocking Comments

Use clear severity.

### Blocking

Issues that must be fixed before merge:

- Security vulnerability.
- Tenant isolation failure.
- Data corruption risk.
- Incorrect payment behavior.
- Broken inventory correctness.
- Broken critical business logic.
- Missing required authorization.
- Unhandled migration risk.

### Non-blocking

Examples:

- Naming improvement.
- Minor refactor suggestion.
- Optional readability improvement.

Reviewers should avoid blocking a correct feature over personal stylistic preference.

---

## 33. Approval Criteria

A reviewer should approve when:

- Requirements are satisfied.
- Architecture is respected.
- Security is adequate.
- Tenant isolation is preserved.
- Business logic is correct.
- Database behavior is safe.
- Critical operations handle concurrency and retries.
- Appropriate tests exist.
- Documentation is updated where necessary.
- Verification results are credible.

Approval means the reviewer accepts the change as suitable for integration, not that the code is mathematically perfect.

---

## 34. Review Checklist

### Requirements

- [ ] Correct specification implemented.
- [ ] Scope is clear.
- [ ] No unrelated behavior changed.

### Architecture

- [ ] Correct module owns the logic.
- [ ] Public module interfaces are respected.
- [ ] No unnecessary services or infrastructure.
- [ ] Dependency direction is valid.

### Security

- [ ] Authentication is correct.
- [ ] Authorization is enforced server-side.
- [ ] Tenant isolation is preserved.
- [ ] Sensitive information is protected.

### Data

- [ ] Transactions are correct.
- [ ] Constraints are appropriate.
- [ ] Concurrency is safe.
- [ ] Historical data is preserved.

### Commerce

- [ ] Pricing is server-authoritative.
- [ ] Inventory is concurrency-safe.
- [ ] Payment state is verified.
- [ ] Order creation is idempotent where required.
- [ ] Discounts are correctly validated.

### Testing

- [ ] Success path tested.
- [ ] Failure paths tested.
- [ ] Authorization tested.
- [ ] Tenant isolation tested.
- [ ] Critical retry/idempotency behavior tested.
- [ ] Relevant integration/E2E coverage exists.

### Operations

- [ ] Important failures are observable.
- [ ] Logs contain safe diagnostic context.
- [ ] No secrets are logged.

### Verification

- [ ] Lint passed.
- [ ] Typecheck passed.
- [ ] Tests passed.
- [ ] Build passed.
- [ ] Database checks passed where applicable.

---

## 35. Definition of Done

A code review is complete when:

- The reviewer understands the purpose of the change.
- Requirements are satisfied.
- Architectural boundaries are preserved.
- Security and tenant isolation are verified.
- Commerce-critical correctness has been reviewed.
- Tests provide appropriate confidence.
- Important operational concerns are addressed.
- Blocking review comments are resolved.
- The change is suitable for integration into the target branch.