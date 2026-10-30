# Code Change Safety

## 1. Purpose

This document defines safety requirements for AI-assisted code changes in the Cal Cart commerce platform.

The platform handles multi-tenant stores, customer information, inventory, payments, and orders. AI-generated changes must therefore prioritize correctness, security, data integrity, and controlled scope.

---

## 2. Core Principle

AI-generated code is **untrusted until inspected and verified**.

An AI agent must not assume that generated code is correct simply because it:

- Compiles.
- Looks idiomatic.
- Matches a familiar framework pattern.
- Passes a superficial test.
- Resembles an existing implementation.

Every change must be evaluated against the repository's actual architecture and requirements.

---

## 3. Mandatory Repository Instructions

Before starting any task, the AI agent **MUST read the actual contents of the root `AGENTS.md` file using the available file-reading capabilities. Do not rely on memory, cached context, or assumptions about its contents.**

Applicable repository-specific instructions must also be read and followed.

---

## 4. Safety Priority

When implementing a change, use this priority:

```text
Security
    ↓
Data integrity
    ↓
Tenant isolation
    ↓
Business correctness
    ↓
API compatibility
    ↓
Reliability
    ↓
Performance
    ↓
Code elegance
```

A cleaner implementation must never be preferred over a safer one.

---

## 5. Change Classification

Before implementation, classify the change.

### Low risk

Examples:

- Copy changes.
- Non-functional styling.
- Documentation.
- Isolated UI improvements.

### Medium risk

Examples:

- API changes.
- Validation changes.
- Non-critical database queries.
- Background jobs.
- Business rules.

### High risk

Examples:

- Authentication.
- Authorization.
- Tenant isolation.
- Payments.
- Refunds.
- Inventory.
- Checkout.
- Orders.
- Database migrations.
- Webhooks.
- Secrets.
- Production infrastructure.

Higher-risk changes require deeper inspection and stronger verification.

---

## 6. Inspect Existing Changes

Before editing:

```powershell
git status
git diff
```

Determine whether the working tree already contains developer changes.

AI agents must preserve unrelated work.

Never use broad reset or cleanup commands simply to remove existing modifications.

---

## 7. Smallest Safe Change

Prefer:

```text
small targeted change
```

over:

```text
large redesign
```

The change should modify only what is necessary to satisfy the requirement.

Unrelated refactoring increases:

- Review complexity.
- Regression risk.
- Merge conflicts.
- Debugging difficulty.

---

## 8. File Safety

Before creating, modifying, moving, or deleting a file:

- Confirm it belongs to the task.
- Check whether it already exists.
- Check whether it contains unrelated changes.
- Confirm whether other files depend on it.

Never overwrite an existing file merely because a generated version appears cleaner.

---

## 9. Deletion Safety

Deletion requires additional caution.

Before deleting code, determine:

- Whether it is imported elsewhere.
- Whether it is used dynamically.
- Whether tests depend on it.
- Whether configuration references it.
- Whether it is part of a public contract.

Do not delete unused-looking code without sufficient repository inspection when the impact is uncertain.

---

## 10. Database Safety

Database changes are high-risk.

Before changing the schema:

1. Inspect the current schema.
2. Inspect relevant specifications.
3. Inspect existing migrations.
4. Identify dependencies.
5. Consider existing data.
6. Define constraints.
7. Define indexes.
8. Define rollback or recovery considerations.
9. Test the migration.

Never assume development schema state represents production state.

---

## 11. Migration Safety

Database migrations should follow the project's migration strategy.

Prefer backward-compatible sequences where required:

```text
expand
  ↓
deploy compatible code
  ↓
migrate data
  ↓
switch behavior
  ↓
contract
```

Avoid destructive schema changes when existing application versions may still depend on the old structure.

---

## 12. Transaction Safety

For transactional changes, determine:

- What must be atomic.
- What can fail independently.
- What must roll back.
- What happens during retries.
- What happens during concurrent execution.

Keep external network calls outside long database transactions whenever possible.

---

## 13. Concurrency Safety

Assume concurrent execution.

For shared state, ask:

```text
What if two requests update this simultaneously?
What if the same request is submitted twice?
What if a worker retries?
What if a webhook is delivered twice?
```

Relevant techniques may include:

- Row locking.
- Atomic conditional updates.
- Unique constraints.
- Idempotency keys.
- Deterministic lock ordering.

---

## 14. Tenant Safety

Every tenant-scoped operation must verify tenant ownership server-side.

Do not rely on:

```text
client-provided organization ID
client-provided store ID
client-provided membership role
```

A malicious user must not be able to modify an identifier and gain access to another tenant's data.

---

## 15. Authorization Safety

Every protected operation must verify permission.

The agent must distinguish:

```text
authenticated
```

from:

```text
authorized
```

Being logged in does not grant access to every store or operation.

---

## 16. Authentication Safety

Authentication changes require careful handling of:

- Passwords.
- Sessions.
- Tokens.
- Cookies.
- Expiration.
- Account status.
- Login attempts.
- Recovery mechanisms.

Never weaken authentication simply to simplify development or testing.

---

## 17. Secret Safety

Never commit or expose:

- Database passwords.
- API keys.
- Access tokens.
- Private keys.
- Webhook secrets.
- Payment credentials.

Do not place server secrets in client-exposed configuration.

Use environment configuration and the project's secret-management strategy.

---

## 18. Input Safety

Treat all external input as untrusted.

Sources include:

- Browser requests.
- Query parameters.
- Path parameters.
- Form data.
- Uploaded files.
- Webhooks.
- Third-party API responses.
- Background job payloads.

Validate input before using it in business operations.

---

## 19. SQL Safety

Database queries must use parameterized mechanisms provided by the database layer.

Do not construct SQL by concatenating untrusted input.

Avoid patterns equivalent to:

```ts
const query = `SELECT * FROM users WHERE id = '${userId}'`;
```

Use the project's database abstraction and parameterization mechanisms.

---

## 20. XSS Safety

User-controlled content must not be rendered as trusted HTML without appropriate sanitization and justification.

This includes:

- Product descriptions.
- Store content.
- Customer names.
- Reviews if added later.
- Uploaded metadata.
- External provider content.

Avoid unsafe HTML rendering unless the content has been deliberately sanitized.

---

## 21. File Upload Safety

When handling uploaded files, consider:

- File size.
- File type.
- MIME type.
- File extension.
- Storage location.
- Access control.
- Object naming.
- Malware/security implications.
- Public versus private access.

Never trust a client-provided filename or MIME type as proof of file contents.

---

## 22. Payment Safety

Payment changes require strict verification.

The system must never trust the browser as the source of truth for:

- Payment success.
- Payment amount.
- Payment currency.
- Provider transaction state.

Payment provider responses and verified webhooks must be handled through the Payments module.

Never store raw card credentials.

---

## 23. Inventory Safety

Inventory changes must preserve stock correctness.

Never use a read-modify-write sequence without considering concurrent updates.

Unsafe pattern:

```text
read quantity
calculate quantity - requested
write quantity
```

without appropriate concurrency protection.

Inventory operations must use the documented transactional strategy.

---

## 24. Order Safety

Orders are historical records.

AI-generated changes must not accidentally overwrite:

- Historical price.
- Quantity.
- Product snapshot.
- Address snapshot.
- Discount information.

Current catalog changes must not rewrite historical order facts.

---

## 25. Webhook Safety

Webhook handlers must assume:

```text
duplicate delivery
out-of-order delivery
delayed delivery
malformed payload
forged request
provider retry
```

Verify authenticity before processing.

Use idempotent processing.

Do not trust webhook data merely because it comes from a URL designated for a provider.

---

## 26. Background Job Safety

Jobs must be safe to retry.

A worker may crash:

```text
before processing
during processing
after external success
before acknowledging completion
```

The implementation must account for these cases where relevant.

Tenant context must remain explicit for tenant-owned jobs.

---

## 27. External Provider Safety

External systems are unreliable.

Expect:

- Timeouts.
- Rate limits.
- Partial failures.
- Duplicate responses.
- Delayed responses.
- Provider outages.
- Schema changes.

Provider integrations must not allow provider-specific failures to corrupt internal state.

---

## 28. Error Safety

Errors must not expose sensitive implementation details to clients.

Avoid returning:

```text
database connection strings
SQL statements
stack traces
internal file paths
provider credentials
private tokens
```

Production responses should use the project's stable error contract.

---

## 29. Logging Safety

Logs must be treated as sensitive operational data.

Do not log:

- Passwords.
- Access tokens.
- API keys.
- Payment credentials.
- Session secrets.
- Webhook secrets.

Be cautious with:

- Email addresses.
- Customer information.
- Order details.
- Provider payloads.

Use correlation identifiers rather than sensitive payloads where possible.

---

## 30. Dependency Safety

Before adding a dependency:

- Check whether an existing dependency already solves the problem.
- Review its purpose.
- Confirm compatibility.
- Consider known security issues.
- Confirm package scope.
- Keep the dependency graph minimal.

Do not add packages simply because generated code commonly uses them.

---

## 31. API Compatibility Safety

Before changing an existing API:

- Search for consumers.
- Check tests.
- Check frontend usage.
- Check documentation.
- Determine whether the change is backward-compatible.

Avoid breaking clients unnecessarily.

---

## 32. Configuration Safety

Configuration changes must consider:

- Local development.
- Test environments.
- Demo deployment.
- Production.
- Server-only values.
- Client-exposed values.

Update `.env.example` when introducing required environment variables.

Never commit actual secrets.

---

## 33. Production Safety

Production is not an AI sandbox.

AI agents must not independently perform destructive operations such as:

```text
database reset
production data deletion
destructive migration
secret destruction
infrastructure deletion
payment configuration removal
```

unless explicitly authorized and covered by an appropriate operational procedure.

---

## 34. Verification Safety

A successful code generation step is not verification.

The agent must actually execute applicable checks.

Typical checks include:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For high-risk changes, also run relevant:

```text
integration tests
database tests
security tests
E2E tests
```

---

## 35. Diff Safety Review

Before completion, inspect:

```powershell
git diff
git status
```

Look specifically for:

- Unexpected files.
- Secret values.
- Debugging code.
- Unrelated refactors.
- Changed dependencies.
- Changed configuration.
- Missing tests.
- Accidental API changes.

---

## 36. AI-Generated Code Review

AI-generated code should receive additional scrutiny for:

- Hallucinated functions.
- Incorrect imports.
- Incorrect framework APIs.
- Incorrect database fields.
- Missing authorization.
- Missing tenant checks.
- Missing validation.
- Incorrect async behavior.
- Unsafe retries.
- Race conditions.
- Incomplete error handling.

Plausible-looking code is not evidence of correctness.

---

## 37. Do Not Disable Safety Controls

AI agents must not remove or weaken:

- Authentication.
- Authorization.
- Tenant isolation.
- Input validation.
- CSRF protection where applicable.
- Webhook verification.
- Rate limiting where required.
- Database constraints.
- Idempotency protections.

Temporary removal for convenience is not acceptable.

---

## 38. No Test Manipulation

Tests must not be modified solely to make an implementation pass.

Legitimate test changes include:

- Updating expected behavior after a deliberate requirement change.
- Adding coverage for new behavior.
- Correcting an obsolete expectation.
- Improving test isolation.

The implementation must satisfy the intended behavior, not merely satisfy the test suite.

---

## 39. No Fake Verification

The agent must never claim:

```text
"All tests passed"
"Build is successful"
"Migration succeeded"
"Deployment succeeded"
```

unless the relevant operation was actually executed and succeeded.

If a command cannot be run, state that clearly.

---

## 40. Handling Uncertainty

When the agent is uncertain about a high-impact decision:

1. Inspect repository documentation.
2. Search existing implementation.
3. Check existing tests.
4. Check architectural decisions.
5. Determine whether the uncertainty can be resolved safely.

If not, stop before making a potentially irreversible change.

---

## 41. Documentation Safety

Documentation must not be changed to hide implementation problems.

If implementation violates documented architecture, fix the implementation or explicitly revise the architecture through the appropriate process.

Documentation should describe deliberate decisions, not rationalize accidental behavior.

---

## 42. Safe Completion Checklist

Before completing an AI-generated change:

```text
[ ] AGENTS.md was actually read
[ ] Relevant instructions were followed
[ ] Existing Git changes were preserved
[ ] Relevant documentation was inspected
[ ] Correct module ownership was identified
[ ] Tenant isolation was preserved
[ ] Authorization was preserved
[ ] Input validation was considered
[ ] Database integrity was preserved
[ ] Transactions were reviewed
[ ] Concurrency was considered
[ ] Idempotency was considered
[ ] Sensitive data is protected
[ ] No secrets were added
[ ] Tests were added or updated
[ ] Verification was actually executed
[ ] Final diff was reviewed
[ ] Documentation was updated where required
[ ] No unrelated changes were introduced
```

A change is safe to report as complete only when the applicable items have been addressed.