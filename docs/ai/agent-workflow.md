# Agent Workflow

## 1. Purpose

This document defines the standard workflow AI coding agents must follow when working on the Shopify-like commerce platform.

The workflow is designed to make AI-assisted development:

- Predictable.
- Reviewable.
- Safe.
- Consistent with the architecture.
- Compatible with human development workflows.

AI agents should behave as disciplined implementation assistants rather than autonomous architects.

---

## 2. Standard Workflow

Every implementation task should follow:

```text id="j4x7p2"
Receive task
    ↓
Read repository instructions
    ↓
Inspect repository state
    ↓
Read relevant documentation
    ↓
Inspect existing implementation
    ↓
Identify affected module(s)
    ↓
Plan smallest safe change
    ↓
Implement
    ↓
Add/update tests
    ↓
Run verification
    ↓
Review diff
    ↓
Report result
```

Do not skip directly from task description to implementation.

---

## 3. Step 1: Read Repository Instructions

Before starting any task, the AI agent **MUST read the actual contents of the root `AGENTS.md` file using the available file-reading capabilities. Do not rely on memory, cached context, or assumptions about its contents.**

The agent must also identify additional applicable instruction files such as:

```text id="0v6m2n"
CLAUDE.md
.cursor/rules/*
```

The agent must follow the most specific applicable instructions.

---

## 4. Step 2: Inspect Repository State

Before modifying files, inspect the current Git state.

Typical commands:

```powershell id="n7p3x5"
git status
git branch --show-current
git diff
```

The purpose is to identify:

- Current branch.
- Existing uncommitted changes.
- Files already being modified.
- Potential conflicts with the requested work.

The agent must not overwrite unrelated developer changes.

---

## 5. Step 3: Read Relevant Documentation

Identify the documentation relevant to the task.

For a product feature, this may include:

```text id="c3m8q1"
docs/architecture/*
docs/domain/*
docs/database/*
specs/products/product-spec.md
```

For an API change:

```text id="z8f2r4"
docs/api/*
docs/security/*
relevant feature specification
```

For database changes:

```text id="h5k7w3"
docs/database/*
relevant domain documentation
relevant feature specification
```

Only the necessary documents need to be read, but the agent must not knowingly implement against documented constraints it has not inspected.

---

## 6. Step 4: Inspect Existing Implementation

Search the codebase for:

- Related functionality.
- Existing services.
- Existing repositories.
- Existing validation.
- Existing authorization.
- Existing tests.
- Existing API routes.
- Existing database models.
- Existing provider integrations.

The objective is to reuse established patterns where appropriate.

Do not create a duplicate implementation because the existing implementation was not searched for.

---

## 7. Step 5: Identify Ownership

Determine which module owns the requested behavior.

Example:

```text id="w3r9k2"
Product creation
→ Products

Inventory reservation
→ Inventory

Checkout completion
→ Checkout

Payment capture
→ Payments

Order cancellation
→ Orders
```

If the task spans multiple modules, identify the coordination point.

Usually this is an application service or explicit workflow rather than direct cross-module database access.

---

## 8. Step 6: Identify Constraints

Before implementation, identify relevant constraints.

Examples:

### Security

```text id="k6n2p8"
authentication
authorization
tenant isolation
input validation
secret handling
```

### Data

```text id="r5v8m1"
foreign keys
unique constraints
transactions
concurrency
historical records
```

### Commerce

```text id="q2x7c4"
inventory
pricing
payment state
discount usage
order state
idempotency
```

### Operations

```text id="m9w3h6"
logging
jobs
webhooks
retries
observability
```

---

## 9. Step 7: Plan the Smallest Safe Change

Before editing, define:

```text id="n3k8v5"
Files to modify
Files to add
Tests to add/update
Documentation to update
Verification required
```

The implementation should be as small as possible while fully satisfying the requirement.

Do not redesign unrelated components.

---

## 10. Step 8: Implement

Implementation should follow existing project conventions.

The agent should:

- Preserve module ownership.
- Reuse existing abstractions where appropriate.
- Use typed interfaces.
- Validate external input.
- Enforce authorization.
- Preserve tenant isolation.
- Handle expected errors.
- Preserve transaction boundaries.
- Consider retries and concurrency.

Implementation should remain understandable to human reviewers.

---

## 11. Step 9: Add or Update Tests

Tests should be added or updated based on behavior.

At minimum, consider:

```text id="g5v1r9"
happy path
validation failure
authorization failure
tenant isolation
business rule failure
concurrency
idempotency
state transition
```

Not every feature requires every category, but critical paths require deeper coverage.

---

## 12. Step 10: Run Targeted Verification

Before running the complete suite, run the tests most closely related to the change.

Examples:

```powershell id="q7m2x5"
pnpm test -- products
pnpm test -- inventory
```

The exact syntax depends on the project's configured test runner.

Targeted verification speeds up development and helps isolate failures.

---

## 13. Step 11: Run Full Verification

When appropriate, run the baseline project checks:

```powershell id="p8k3w1"
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Database changes should also run the relevant database/migration checks.

Do not claim success for any command that was not actually executed.

---

## 14. Step 12: Review the Diff

Before reporting completion:

```powershell id="h6r2q9"
git diff
git status
```

Review for:

- Unintended files.
- Debugging code.
- Temporary comments.
- Hardcoded credentials.
- Unnecessary dependencies.
- Accidental formatting changes.
- Missing tests.
- Security regressions.
- Unrelated refactoring.

The agent should inspect the final state, not merely trust the implementation process.

---

## 15. Step 13: Documentation Synchronization

If behavior or architecture changed, update relevant documentation.

Examples:

```text id="b9x4m6"
New API behavior
→ API documentation

New domain behavior
→ feature specification/domain docs

Schema change
→ database documentation

Architectural decision
→ ADR

Deployment change
→ deployment documentation
```

Do not update unrelated documentation merely for completeness.

---

## 16. Step 14: Report Completion

The final report should contain:

### Summary

What was implemented.

### Files

Important files changed.

### Tests

Tests added or modified.

### Verification

Actual commands executed and their results.

### Notes

Known limitations or follow-up concerns.

Example:

```text id="f2n7w5"
Implemented product creation.

Changed:
- modules/products/...
- apps/web/...

Tests:
- Added product creation integration tests.

Verification:
- pnpm lint ✓
- pnpm typecheck ✓
- pnpm test ✓
- pnpm build ✓
```

Do not claim checks passed unless the command actually ran successfully.

---

## 17. Handling Failed Verification

If a check fails:

```text id="c5m8q2"
Identify failure
    ↓
Determine whether change caused it
    ↓
Fix if appropriate
    ↓
Re-run
    ↓
Report final result
```

If the failure is unrelated or caused by the environment, report it explicitly.

Never hide the failure.

---

## 18. Handling Ambiguity

If the task is ambiguous:

### Low-impact ambiguity

Use the existing architecture and conventions to make the safest reasonable interpretation.

### High-impact ambiguity

Ask for clarification when the choice would affect:

- Database schema.
- Public API.
- Security.
- Tenant model.
- Payment behavior.
- Inventory behavior.
- Architecture.
- Data migration.
- Deployment.

Do not make irreversible architectural decisions based on assumptions.

---

## 19. Handling Existing Work

If the repository contains uncommitted changes:

```text id="x9q3v5"
inspect
    ↓
identify ownership
    ↓
avoid overwriting
    ↓
make targeted changes
```

Do not:

```text id="k7m2p4"
git reset --hard
git clean -fd
discard files
overwrite modified code
```

unless explicitly instructed.

---

## 20. Handling Existing Bugs

If the requested task exposes an unrelated bug:

- Fix it only if the fix is small, clearly necessary, and within scope.
- Otherwise report it separately.

Do not turn every task into a repository-wide cleanup exercise.

---

## 21. Refactoring During Feature Work

Refactoring is appropriate when required for the requested feature.

It should not be performed merely because the agent prefers another implementation style.

If a refactor is substantial:

1. Explain why it is necessary.
2. Keep it logically separate where practical.
3. Add appropriate regression tests.
4. Verify behavior before and after.

---

## 22. Database Change Workflow

For a database-affecting task:

```text id="q3n8x6"
Read database documentation
    ↓
Inspect current schema
    ↓
Identify required migration
    ↓
Design constraints/indexes
    ↓
Implement migration
    ↓
Update application code
    ↓
Run migration tests
    ↓
Run integration tests
    ↓
Verify build
```

Do not modify database structure without considering existing data.

---

## 23. API Change Workflow

For API changes:

```text id="m8q5v2"
Read API contract
    ↓
Inspect existing endpoint
    ↓
Define request/response behavior
    ↓
Validate input
    ↓
Authorize
    ↓
Implement application service
    ↓
Map response/error
    ↓
Update tests
    ↓
Update documentation
```

Public API behavior should not be changed accidentally.

---

## 24. Security-Sensitive Workflow

For security-sensitive changes:

```text id="y4p8n3"
Read security documentation
    ↓
Identify trust boundaries
    ↓
Identify attacker-controlled inputs
    ↓
Verify authorization
    ↓
Verify tenant isolation
    ↓
Implement
    ↓
Add negative security tests
    ↓
Review logs/error exposure
    ↓
Run verification
```

Security should be considered before implementation rather than patched afterward.

---

## 25. Payment Workflow

Payment changes require additional verification.

The agent should inspect:

```text id="s2m7x4"
payment specification
checkout specification
order specification
idempotency strategy
webhook contract
security documentation
```

Then verify:

- Amount authority.
- Currency authority.
- Provider state.
- Idempotency.
- Webhook verification.
- Retry behavior.
- Timeout behavior.
- Refund constraints.

---

## 26. Inventory Workflow

Inventory changes should inspect:

```text id="h8q3m1"
inventory specification
database concurrency documentation
checkout workflow
order workflow
```

Then verify:

- Atomicity.
- Locking.
- Quantity constraints.
- Reservation lifecycle.
- Duplicate operations.
- Concurrent requests.
- Multi-item behavior.

---

## 27. Background Job Workflow

For job changes:

```text id="v7n2c8"
Read job strategy
    ↓
Identify job ownership
    ↓
Define payload
    ↓
Define retry behavior
    ↓
Define idempotency behavior
    ↓
Implement
    ↓
Add job tests
    ↓
Verify failure handling
```

Jobs should not become hidden business workflows that bypass domain rules.

---

## 28. Event Workflow

For event changes:

1. Identify the domain fact.
2. Define the event name.
3. Define the stable payload.
4. Identify consumers.
5. Determine transaction/publication semantics.
6. Implement event publication.
7. Test duplicate and failure behavior.

Events should represent facts, not commands disguised as facts.

---

## 29. External Integration Workflow

For external providers:

```text id="g3r7m2"
Inspect existing integration
    ↓
Define internal interface
    ↓
Isolate provider-specific implementation
    ↓
Translate provider errors
    ↓
Handle timeout/retry semantics
    ↓
Add provider tests
    ↓
Add integration tests where appropriate
```

Provider-specific SDK types should not leak throughout the domain.

---

## 30. Performance Workflow

Performance changes should follow:

```text id="z5k8q3"
Identify measurable problem
    ↓
Measure current behavior
    ↓
Identify bottleneck
    ↓
Apply smallest effective optimization
    ↓
Measure again
    ↓
Verify correctness
```

Do not introduce caching, queues, or distributed systems merely because they might improve theoretical performance.

---

## 31. AI Planning Discipline

For non-trivial tasks, the agent may internally structure the work as:

```text id="x2m6p8"
Understand
Inspect
Plan
Implement
Test
Verify
Review
Report
```

The plan should remain proportional to task complexity.

A simple bug fix should not result in a massive architecture exercise.

A database/payment architecture change should not be treated like a one-line UI change.

---

## 32. No Autonomous Architecture Drift

If implementation reveals that the current architecture cannot satisfy the requirement cleanly, stop before introducing a major structural change.

The agent should identify:

- The limitation.
- The affected boundaries.
- The possible architectural options.
- The likely consequences.

Architectural changes should be deliberate and documented.

---

## 33. Production Operations

AI agents must not independently perform destructive production operations.

Production actions require explicit authorization and appropriate operational procedures.

Examples requiring additional caution:

```text id="r8q3m5"
production migrations
data deletion
secret rotation
payment configuration changes
infrastructure deletion
database resets
```

Code implementation and production operation should remain distinct activities.

---

## 34. Definition of Done

An AI agent has completed a task when:

- Repository instructions were read.
- Relevant documentation was inspected.
- Existing implementation was understood.
- Correct module ownership was identified.
- The smallest appropriate change was implemented.
- Security and tenant boundaries were preserved.
- Tests were added or updated.
- Relevant verification was executed.
- The final diff was reviewed.
- Documentation was updated where required.
- No unrelated changes were introduced.
- The completion report accurately states what happened.