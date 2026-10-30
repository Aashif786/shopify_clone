# AI Development Rules

## 1. Purpose

This document defines the rules for AI-assisted development within the Cal Cart commerce platform.

AI coding agents are implementation assistants. They may accelerate development, analysis, testing, documentation, and debugging, but they do not replace architectural ownership or engineering judgment.

The repository's architecture, specifications, security requirements, and existing implementation remain authoritative.

---

## 2. Core Principle

AI must **understand before changing**.

Before modifying code, an AI agent must establish:

```text id="1x8f4m"
Repository instructions
        ↓
Relevant architecture
        ↓
Relevant domain/specification
        ↓
Existing implementation
        ↓
Task requirements
        ↓
Smallest correct change
```

An agent must not begin implementation based only on the user's short request when the repository already contains authoritative documentation.

---

## 3. Mandatory Repository Instructions

Before starting any task, the AI agent **MUST read the actual contents of the root `AGENTS.md` file using the available file-reading capabilities. Do not rely on memory, cached context, or assumptions about its contents.**

This requirement applies to every implementation task.

If the repository contains additional applicable instruction files, the agent must identify and follow them according to their scope.

Examples include:

```text id="3f8xk1"
AGENTS.md
CLAUDE.md
.cursor/rules/*
```

The actual repository files are authoritative.

---

## 4. Understand the Task

Before changing code, the agent must identify:

- What the user actually requested.
- Which behavior must change.
- Which module owns the behavior.
- Which files are likely affected.
- Which specifications apply.
- Which constraints apply.
- Whether the task changes architecture, database behavior, security, or API contracts.

If the request is ambiguous in a way that could materially change the implementation, the agent should clarify rather than invent requirements.

---

## 5. Read Relevant Documentation

The agent should inspect relevant documentation before implementation.

Typical hierarchy:

```text id="7s5n1p"
AGENTS.md
    ↓
Architecture documentation
    ↓
Domain documentation
    ↓
Feature specification
    ↓
Database/API/security documentation
    ↓
Existing implementation
```

Not every task requires every document.

The agent should read the documents relevant to the requested change.

---

## 6. Inspect Existing Code

Before writing new code, inspect the current implementation.

The agent should determine:

- Existing patterns.
- Existing abstractions.
- Existing interfaces.
- Existing error handling.
- Existing validation.
- Existing authorization.
- Existing database access.
- Existing tests.
- Existing configuration.

Do not create a second implementation of something that already exists.

---

## 7. Do Not Invent Architecture

AI agents must not introduce architectural changes merely because they seem cleaner.

Do not automatically add:

```text id="9r4m2w"
microservices
Redis
Kafka
Elasticsearch
Kubernetes
new API applications
new databases
service meshes
workflow engines
```

unless the requirement and existing architecture justify them.

The Demo deliberately uses a modular monolith.

---

## 8. Preserve Module Ownership

Every business capability has an owning module.

The AI agent must identify the owner before implementing behavior.

Examples:

```text id="h8m5z1"
Products → modules/products
Inventory → modules/inventory
Checkout → modules/checkout
Payments → modules/payments
Orders → modules/orders
Customers → modules/customers
Discounts → modules/discounts
Stores → modules/stores
```

Do not implement business logic in another module simply because the current task happens to call it.

---

## 9. Respect Public Module Interfaces

AI agents must not bypass module boundaries for convenience.

Do not import:

```text id="f7k2m9"
another module's internal repository
another module's internal service
another module's private domain implementation
another module's database tables
```

Use supported public interfaces or events.

---

## 10. Preserve Tenant Isolation

Every store-scoped operation must remain tenant-aware.

AI-generated code must not trust:

```text id="2h9k4p"
client-provided storeId
client-provided organizationId
client-provided user role
```

without server-side verification.

Before completing a change, the agent should consider:

```text id="r6v1n8"
Can a user from Store A access Store B data?
Can a user modify Store B data?
Can a background job operate under the wrong tenant?
Can a webhook resolve the wrong store?
```

---

## 11. Preserve Authorization

Authentication does not establish permission.

AI agents must verify authorization for every protected operation.

Do not rely on:

- Hidden UI elements.
- Client-side checks.
- Route visibility.
- Assumed user roles.
- Store IDs supplied by the browser.

Authorization must be enforced server-side.

---

## 12. Protect Business-Critical Correctness

AI agents must treat the following as high-risk areas:

- Inventory.
- Checkout.
- Payments.
- Orders.
- Discounts.
- Authentication.
- Authorization.
- Tenant isolation.
- Database transactions.
- Webhooks.
- Idempotency.

Changes in these areas require careful inspection and appropriate tests.

---

## 13. Do Not Trust Client State

Client-provided values must never become authoritative for critical commerce state.

Do not trust the client for:

```text id="v6k2r7"
price
discount amount
inventory availability
payment success
order status
store ownership
permissions
```

The server must derive or verify authoritative state.

---

## 14. Database Safety

AI agents must respect PostgreSQL as the transactional source of truth.

Database changes must consider:

- Constraints.
- Transactions.
- Foreign keys.
- Unique indexes.
- Indexing.
- Concurrency.
- Migration ordering.
- Existing data.

Do not modify the schema casually.

---

## 15. Transaction Safety

For transaction-sensitive operations, the agent must understand:

- What must be atomic.
- What can occur outside the transaction.
- What happens on failure.
- What happens during concurrent execution.
- Whether retrying is safe.

Never move an external API call into a database transaction simply because it makes the code appear sequential.

---

## 16. Concurrency Safety

When modifying:

- Inventory.
- Payments.
- Checkout.
- Orders.
- Discount usage.
- Webhooks.

the agent must explicitly consider concurrent requests.

Ask:

```text id="u5m8r2"
What if two requests execute simultaneously?
What if the same request executes twice?
What if the provider response arrives twice?
What if one operation times out after the external system succeeded?
```

---

## 17. Idempotency

Critical operations must remain safely retryable where required.

AI agents should identify whether the operation can be repeated.

Examples:

```text id="b3q7x5"
payment creation
payment capture
refund
order creation
checkout completion
inventory reservation
webhook processing
```

Do not implement a retry without understanding its side effects.

---

## 18. Error Handling

AI agents must not swallow errors to make code appear successful.

Never use:

```ts id="j3s7m1"
try {
  await operation();
} catch {
  // ignore
}
```

for meaningful application failures.

Errors should be:

- Handled.
- Translated.
- Propagated.
- Retried.

according to their actual semantics.

---

## 19. Logging Safety

AI-generated code must never log:

- Passwords.
- Tokens.
- API keys.
- Payment credentials.
- Webhook secrets.
- Private keys.
- Sensitive customer information without justification.

If logging is added, it should use safe structured context.

---

## 20. Secrets

AI agents must never:

- Invent production credentials.
- Request unnecessary secrets in source code.
- Commit `.env` files containing secrets.
- Place secrets in frontend code.
- Print secrets during debugging.

Use `.env.example` and the project's configuration mechanism.

---

## 21. Dependency Discipline

Before adding a dependency, the agent must:

1. Search existing dependencies.
2. Check whether the project already solves the problem.
3. Check whether a platform capability is sufficient.
4. Determine the correct package scope.
5. Consider security and maintenance.
6. Add only if justified.

A dependency must not be added merely because it makes generated code easier.

---

## 22. Minimal Change Principle

AI agents should make the smallest change that correctly satisfies the task.

Avoid unrelated:

```text id="y7f4k3"
refactors
renames
formatting changes
dependency upgrades
architecture changes
file moves
```

unless they are required.

Small changes are easier to review, test, revert, and understand.

---

## 23. Existing Patterns First

Before introducing a new pattern, search the repository for an existing example.

Examples:

```text id="e3n6p1"
existing repository
existing application service
existing validation schema
existing API response
existing error type
existing test factory
existing provider adapter
```

Reuse established patterns when appropriate.

Consistency is generally more valuable than novelty.

---

## 24. Do Not Over-Abbreviate Code

AI-generated code should optimize for readability.

Avoid cryptic variables:

```ts id="f8k2m6"
const x = ...
const d = ...
const r = ...
```

Prefer:

```ts id="n7v3q1"
const product = ...
const discount = ...
const reservation = ...
```

Exceptions are appropriate for conventional short-lived variables such as loop indices.

---

## 25. Comments

AI agents should not generate comments that merely restate code.

Comments should explain:

- Why an unusual decision exists.
- Why a lock is required.
- Why a retry is bounded.
- Why a provider workaround exists.
- Why a migration follows a particular sequence.

Remove obsolete comments when behavior changes.

---

## 26. Tests Are Required for Behavior Changes

When behavior changes, AI agents should add or update tests.

The tests should cover the actual requirement.

For critical functionality, include relevant:

- Success cases.
- Failure cases.
- Authorization.
- Tenant isolation.
- Concurrency.
- Idempotency.
- State transitions.

Do not generate superficial tests merely to satisfy coverage.

---

## 27. Test Existing Behavior Before Refactoring

When modifying existing behavior, determine whether existing tests protect it.

If a refactor changes implementation but should preserve behavior:

1. Run existing tests.
2. Make the change.
3. Run the tests again.
4. Add tests for newly identified risks.

Do not assume a refactor is safe simply because the code compiles.

---

## 28. Verification

AI agents must run applicable verification commands after implementation.

Baseline commands include:

```powershell id="p8m3r7"
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Additional checks may include:

```powershell id="w5n9k2"
database migrations
integration tests
E2E tests
security tests
```

The exact commands depend on the repository configuration.

An agent must never claim:

```text id="x4q7m1"
tests passed
build passed
lint passed
```

unless the command was actually executed successfully.

---

## 29. Verification Failure

If verification fails, the agent must:

1. Identify whether the failure was caused by the change.
2. Fix relevant issues where appropriate.
3. Re-run the affected check.
4. Report remaining failures accurately.

Do not hide or suppress failures merely to produce a clean result.

---

## 30. Production Safety

AI agents must treat production access as restricted.

Do not:

- Modify production data without explicit authorization and a safe procedure.
- Run destructive database commands casually.
- Rotate production secrets without authorization.
- Disable production security controls.
- Delete production resources.
- Execute irreversible migrations without a deployment plan.

When production operations are required, the agent should follow the documented deployment and operational procedures.

---

## 31. Database Destructive Operations

AI agents must not casually execute:

```text id="q6x3n8"
DROP DATABASE
TRUNCATE production tables
DELETE production data
DROP production columns
```

Destructive operations require explicit authorization and a validated procedure.

Development/test databases may be reset according to documented testing workflows.

---

## 32. File Safety

AI agents must avoid deleting or overwriting unrelated files.

Before destructive file operations:

- Confirm the file is part of the requested change.
- Check whether it contains user changes.
- Preserve unrelated work.

Do not use broad cleanup commands when a targeted change is sufficient.

---

## 33. Documentation Synchronization

When implementation changes documented behavior, AI agents should update the relevant documentation.

Examples:

```text id="4n7s2v"
API change
→ API documentation

Domain behavior change
→ Domain/specification

Database behavior change
→ Database documentation

Architecture change
→ ADR

Deployment change
→ Deployment documentation
```

Do not modify architecture documentation merely to make an implementation violation appear intentional.

---

## 34. AI Output Verification

AI-generated output must be treated as unverified until checked.

The agent should verify:

- Imports exist.
- Functions exist.
- Types match.
- APIs are real.
- Database fields exist.
- Environment variables exist.
- Dependencies are installed.
- Tests actually execute.
- Documentation matches implementation.

Do not rely on generated code that merely looks plausible.

---

## 35. Handling Uncertainty

If the agent does not know:

- Which module owns a capability.
- Which API exists.
- Which database field exists.
- Which provider configuration is correct.
- Which architectural decision applies.

it must inspect the repository and documentation rather than guessing.

If uncertainty remains material after inspection, it should stop and request clarification rather than making a potentially destructive assumption.

---

## 36. Task Completion Report

After completing a task, the agent should summarize:

### Changed

What files or behavior changed.

### Reason

Why the change was necessary.

### Tests

Which tests were added or modified.

### Verification

Which commands were actually run and their results.

### Limitations

Any unresolved issues or environmental limitations.

Do not report speculative success.

---

## 37. AI Anti-Patterns

AI agents must avoid:

### Hallucinated APIs

Using functions or libraries that do not exist.

### Architecture invention

Adding services or infrastructure without requirements.

### Silent behavior changes

Changing unrelated behavior while implementing a feature.

### Fake completion

Claiming code works without executing verification.

### Test manipulation

Changing tests solely to make them pass without fixing the underlying behavior.

### Error suppression

Catching and ignoring meaningful failures.

### Security bypasses

Removing authorization, tenant checks, validation, or signature verification for convenience.

### Dependency inflation

Adding libraries for trivial functionality.

---

## 38. Priority When Instructions Conflict

When multiple instructions appear to conflict, use this priority:

```text id="9v4m2q"
Security and data integrity
        ↓
Repository instructions
        ↓
Explicit architecture decisions
        ↓
Feature specifications
        ↓
Existing established project patterns
        ↓
General coding preferences
```

An AI agent must not use a lower-priority convention to bypass a higher-priority security or architectural requirement.

---

## 39. Demo-to-V1 Compatibility

AI implementation should preserve the path from Demo to V1.

The agent should prefer:

```text id="k7p3w5"
stable domain boundaries
stable contracts
clear interfaces
correct transactional behavior
```

over:

```text id="m2x8q4"
premature microservices
premature distributed infrastructure
speculative abstractions
```

The goal is to make the Demo structurally evolvable, not to implement V1 infrastructure prematurely.

---

## 40. Definition of Done

An AI-assisted implementation is complete when:

- The actual repository instructions were read.
- Relevant architecture and specifications were inspected.
- Existing implementation patterns were considered.
- Correct module ownership was preserved.
- Tenant isolation and authorization were preserved.
- Security-sensitive behavior was reviewed.
- Critical operations remain correct under retries and concurrency.
- Appropriate tests were added or updated.
- Relevant verification commands were actually executed.
- Documentation was updated where required.
- No unnecessary dependencies or infrastructure were introduced.
- The final report accurately reflects what was changed and verified.