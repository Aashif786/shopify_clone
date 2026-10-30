# Task Execution Rules

## 1. Purpose

This document defines the rules AI agents must follow when executing development tasks in the Cal Cart commerce platform.

The objective is to ensure that AI-generated changes are:

- Correct.
- Scoped.
- Reviewable.
- Consistent with the repository architecture.
- Safe for multi-tenant commerce.
- Properly verified.

AI agents must execute the requested task, not reinterpret it into a larger redesign.

---

## 2. Mandatory First Step

Before starting any task, the AI agent **MUST read the actual contents of the root `AGENTS.md` file using the available file-reading capabilities. Do not rely on memory, cached context, or assumptions about its contents.**

The agent must also identify and follow other applicable repository instruction files.

---

## 3. Understand the Requested Outcome

Before implementation, determine:

- What the user explicitly requested.
- What behavior should exist after the change.
- What behavior must remain unchanged.
- Which module owns the behavior.
- Which files are likely affected.
- What tests should prove the result.

The requested outcome is more important than the implementation technique.

---

## 4. Scope the Task

Every task should have a defined scope.

### In scope

Changes directly required to satisfy the request.

### Related but not required

Potential improvements that may be useful later.

### Out of scope

Unrelated refactoring, architecture changes, dependency upgrades, or cleanup.

AI agents must not silently expand the task into unrelated work.

---

## 5. Inspect Before Editing

Before modifying code, inspect:

```text id="r6n2v8"
repository instructions
relevant docs
existing implementation
related tests
current Git changes
```

Search before creating.

If an existing implementation already solves part of the problem, extend it instead of creating a competing implementation.

---

## 6. Preserve Existing Work

AI agents must assume that uncommitted changes may belong to a human developer.

Before editing:

```powershell id="p3x7m1"
git status
```

The agent must avoid overwriting unrelated modifications.

Never use destructive Git commands to obtain a clean working tree unless explicitly authorized.

---

## 7. Identify the Owning Module

Every business behavior must have a clear owner.

The agent should determine whether the task belongs to:

```text id="c8m4q2"
stores
products
inventory
customers
carts
discounts
checkout
payments
orders
```

or another documented component.

Business logic should live in its owning module.

---

## 8. Cross-Module Changes

When a task involves multiple domains:

- Keep each domain's rules inside its owning module.
- Coordinate through public interfaces/application services.
- Use domain events where appropriate.
- Do not access another module's internal tables or implementation.

Example:

```text id="h7q3v5"
Checkout
  ↓
Inventory public interface
  ↓
Reservation

Checkout
  ↓
Payments public interface
  ↓
Payment attempt
```

The coordinating workflow should not directly mutate Inventory or Payments internals.

---

## 9. Define the Change Before Coding

For non-trivial tasks, identify:

```text id="k2n8x4"
Required behavior
Affected modules
Affected files
Data changes
API changes
Security implications
Tests required
Documentation required
```

The implementation should then follow that boundary.

---

## 10. Prefer Existing Patterns

Before introducing a new abstraction, search for an existing example.

Reuse established patterns for:

- Validation.
- Application services.
- Repositories.
- Errors.
- DTOs.
- API responses.
- Transactions.
- Tests.
- Logging.
- Events.
- Jobs.

Consistency reduces maintenance cost and makes AI-generated changes easier for humans to review.

---

## 11. Avoid Premature Abstraction

Do not introduce abstractions merely because they might be useful later.

Avoid unnecessary:

```text id="m4p9r7"
base classes
generic repositories
generic service layers
factory hierarchies
dependency injection frameworks
event frameworks
workflow engines
```

An abstraction should solve an actual repeated problem.

---

## 12. Business Logic Placement

Business rules must be implemented at the appropriate layer.

### Presentation

Responsible for:

- Request parsing.
- Authentication context.
- Input validation.
- Response mapping.

### Application

Responsible for:

- Use-case orchestration.
- Transaction boundaries.
- Coordination between domains.
- Authorization decisions.

### Domain

Responsible for:

- Business rules.
- Invariants.
- State transitions.
- Value objects.

### Infrastructure

Responsible for:

- Database access.
- External providers.
- Storage.
- Runtime-specific implementations.

Do not put business rules into API handlers simply because they are convenient.

---

## 13. Input Validation

All external input must be validated at the application boundary.

Validate:

- Types.
- Required fields.
- Formats.
- Ranges.
- Enumerations.
- Identifiers.
- Quantities.
- Money values.
- Dates.

Validation does not replace authorization.

---

## 14. Authorization

Every protected mutation must verify authorization server-side.

The agent must consider:

```text id="q5v2k8"
Who is making the request?
Which organization do they belong to?
Which store are they accessing?
What role do they have?
What action are they allowed to perform?
```

Client-side restrictions are never sufficient.

---

## 15. Tenant Isolation

Every store-scoped operation must resolve tenant context from trusted server-side context.

The agent must prevent:

```text id="s8n4m2"
cross-store reads
cross-store updates
cross-store deletes
cross-store order access
cross-store customer access
cross-store inventory access
```

Tenant isolation must be enforced even if a malicious client modifies identifiers.

---

## 16. Database Changes

When a task changes persistent data:

1. Inspect the current schema.
2. Determine whether a migration is required.
3. Consider foreign keys and constraints.
4. Consider indexes.
5. Consider existing data.
6. Consider transaction boundaries.
7. Consider concurrency.
8. Update relevant tests and documentation.

Never treat a database change as only a TypeScript type change.

---

## 17. Transaction Rules

A transaction should contain the operations that must succeed or fail together.

Keep transactions:

- Short.
- Deterministic.
- Focused.

Do not perform slow external API calls inside long database transactions.

If an external operation is required, design the workflow around its actual failure and retry semantics.

---

## 18. Concurrency

For shared mutable resources, explicitly consider concurrent requests.

High-risk examples:

```text id="x7q3m9"
inventory
discount usage
checkout completion
payment capture
refunds
order transitions
webhook processing
```

Use appropriate:

- Row locks.
- Conditional updates.
- Unique constraints.
- Idempotency keys.
- Deterministic lock ordering.

Do not assume requests execute sequentially.

---

## 19. Idempotency

Before implementing a retryable operation, determine whether repeating it is safe.

If the operation can create a side effect, establish an idempotency mechanism where required.

The agent must distinguish:

```text id="b6m2x9"
safe retry
unsafe retry
duplicate request
provider duplicate event
timeout after successful external operation
```

---

## 20. State Transitions

State changes must respect the documented state machine.

Do not directly assign arbitrary status values if the domain defines valid transitions.

Example:

```text id="n4r8k2"
OPEN
  ↓
PAYMENT_PENDING
  ↓
PAYMENT_PROCESSING
  ↓
COMPLETED
```

Invalid transitions must fail explicitly.

---

## 21. Payment Tasks

Payment-related implementation must verify:

- Amount.
- Currency.
- Provider state.
- Idempotency.
- Webhook authenticity.
- Duplicate events.
- Retry behavior.
- Refund limits.
- Order/payment state separation.

Never trust a client-provided payment-success flag.

---

## 22. Inventory Tasks

Inventory-related implementation must verify:

- Available quantity.
- Reserved quantity.
- Reservation lifecycle.
- Atomic updates.
- Concurrent requests.
- Duplicate reservation/release operations.
- Multi-item operations.

Never calculate inventory availability solely in application memory.

---

## 23. Order Tasks

Order-related implementation must preserve historical correctness.

Order records should retain historical:

- Product information.
- Variant information.
- Prices.
- Discounts.
- Addresses.
- Quantities.

Changing the current product catalog must not rewrite historical order facts.

---

## 24. API Changes

For API changes, preserve:

- Authentication.
- Authorization.
- Tenant isolation.
- Validation.
- Error contracts.
- Pagination conventions.
- Idempotency requirements.
- API documentation.

Do not silently change existing response shapes when a compatible extension is sufficient.

---

## 25. Error Behavior

Expected failures should use the project's established error model.

Examples:

```text id="v8q2m5"
validation error
authentication error
authorization error
not found
conflict
business rule violation
rate limit
external provider failure
internal error
```

Do not expose internal database errors or provider internals directly to clients.

---

## 26. Background Jobs

When adding a job, define:

- Job purpose.
- Payload.
- Owning module.
- Retry behavior.
- Maximum attempts.
- Failure handling.
- Idempotency.
- Observability.

Jobs must respect tenant context when operating on tenant-owned resources.

---

## 27. Webhooks

Webhook handlers must:

1. Verify authenticity.
2. Validate the payload.
3. Identify the correct tenant.
4. Detect duplicate events.
5. Apply state changes safely.
6. Return an appropriate response.
7. Support provider retries.

Webhook processing must not assume exactly-once delivery.

---

## 28. External Integrations

External systems must be isolated behind internal interfaces where appropriate.

Provider-specific details should remain in adapters.

The domain should not depend directly on provider SDK types.

---

## 29. Configuration

When adding configuration:

- Add the required environment variable.
- Update `.env.example`.
- Update centralized configuration.
- Mark secrets as server-only.
- Validate required configuration at startup where appropriate.
- Document the setting.

Never hardcode credentials or provider secrets.

---

## 30. Dependencies

Before adding a dependency:

1. Search the repository.
2. Check existing packages.
3. Determine whether native functionality is sufficient.
4. Evaluate maintenance and security.
5. Confirm the package belongs in the correct workspace.

Avoid dependency duplication.

---

## 31. File Changes

Only create or modify files required for the task.

Avoid generating large numbers of speculative files.

A task should not produce:

```text id="w3k8p4"
unused abstractions
empty placeholder modules
unused configuration
future-only infrastructure
```

unless explicitly requested.

---

## 32. Tests

Every behavior change should have appropriate tests.

Tests should verify behavior rather than implementation details.

For critical commerce operations, include negative cases where relevant:

```text id="m7q4x2"
unauthorized access
wrong tenant
invalid state
duplicate request
concurrent request
insufficient inventory
invalid payment state
```

---

## 33. Test Data

Test fixtures and factories should:

- Be deterministic.
- Avoid shared mutable state.
- Create only required data.
- Respect tenant relationships.
- Avoid real credentials.
- Avoid production data.

Tests must not depend on personal developer data.

---

## 34. Verification Commands

Use the repository's actual scripts.

Typical verification:

```powershell id="r4n8v2"
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Additional targeted tests should be run when appropriate.

Never invent command names if they are not defined by the project.

---

## 35. Review the Final Diff

Before declaring completion:

```powershell id="x5m9q3"
git diff
git status
```

Check for:

- Unrelated changes.
- Debug logs.
- Temporary code.
- Secrets.
- Incorrect imports.
- Missing tests.
- Accidental API changes.
- Security regressions.

---

## 36. Documentation

Update documentation when the task changes documented behavior.

Possible updates include:

```text id="q8k2m6"
specification
API contract
database documentation
architecture documentation
ADR
deployment documentation
security documentation
```

Documentation must describe the actual implementation, not an intended future state.

---

## 37. Handling Failed Tests

If tests fail:

- Do not hide the failure.
- Determine whether the change caused it.
- Fix the underlying problem where appropriate.
- Re-run the affected checks.
- Report unresolved failures.

Changing tests solely to remove failures without preserving the intended behavior is prohibited.

---

## 38. Handling Unexpected Requirements

If implementation reveals a requirement that is not covered by the current architecture:

Do not immediately introduce a major architectural solution.

Instead:

1. Identify the conflict.
2. Inspect existing decisions.
3. Determine whether a smaller solution exists.
4. Escalate architectural changes when necessary.
5. Document the resulting decision if architecture changes.

---

## 39. Scope Expansion

An AI agent must not silently expand the task.

For example, a request to:

```text
"Add product creation"
```

does not automatically authorize:

```text id="z3m7q8"
rewriting the product module
adding Elasticsearch
redesigning authentication
rewriting the database layer
introducing microservices
```

Only implement what is necessary for the requested outcome.

---

## 40. Production Safety

AI agents must not perform destructive production operations without explicit authorization.

This includes:

- Production data deletion.
- Production database resets.
- Destructive migrations.
- Secret replacement.
- Infrastructure deletion.
- Payment configuration changes.

Implementation and production operations must remain separately controlled.

---

## 41. Completion Criteria

A task is complete only when:

- The task requirements are satisfied.
- Relevant architecture is respected.
- Correct module ownership is preserved.
- Tenant isolation remains intact.
- Authorization remains enforced.
- Critical operations remain transactionally correct.
- Appropriate tests exist.
- Relevant verification has been executed.
- The final diff contains no unintended changes.
- Documentation is updated when necessary.
- The final report accurately describes the result.
