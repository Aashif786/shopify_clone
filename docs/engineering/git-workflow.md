# Git Workflow

## 1. Purpose

This document defines the Git workflow for the Shopify-like commerce platform.

The workflow is designed to:

- Keep the repository stable.
- Make changes reviewable.
- Support parallel development.
- Protect the Demo from accidental regressions.
- Maintain a clean path toward V1.
- Work effectively with both human developers and AI coding agents.

Git history should communicate meaningful engineering changes, not the emotional journey of debugging at 2 AM.

---

## 2. Repository

The project is maintained in Git and hosted on a remote repository.

The repository contains:

```text
id="0g3p8m"
application code
domain modules
shared packages
tests
documentation
specifications
infrastructure
CI/CD configuration
```

Generated artifacts and secrets must not be committed unless explicitly required.

---

## 3. Main Branch

The primary integration branch is:

```text
main
```

`main` should remain in a buildable and testable state.

Changes should normally reach `main` through reviewed pull requests rather than direct pushes.

---

## 4. Branch Strategy

Use short-lived feature or fix branches.

Examples:

```text
feature/product-creation
feature/checkout-flow
feature/customer-addresses
fix/inventory-race
fix/payment-webhook
fix/tenant-isolation
refactor/order-module
docs/api-contracts
chore/dependency-update
```

Branch names should describe the work.

Avoid:

```text
test
new
changes
final
latest
branch2
mybranch
```

---

## 5. Branch Naming

Recommended format:

```text
<type>/<short-description>
```

Supported types include:

```text
feature
fix
refactor
docs
test
chore
```

Examples:

```text
feature/cart-management
fix/checkout-idempotency
refactor/payment-adapter
docs/deployment-guide
test/inventory-concurrency
chore/update-nextjs
```

Keep names short enough to be readable.

---

## 6. Starting New Work

Before creating a branch:

1. Ensure the working tree is understood.
2. Update from the latest `main`.
3. Create the new branch from the appropriate base.
4. Confirm the correct branch before making changes.

Typical workflow:

```powershell id="p5e4qz"
git switch main
git pull origin main
git switch -c feature/product-creation
```

Do not blindly pull or reset if the working tree contains uncommitted work.

---

## 7. Checking Repository State

Before beginning work, use:

```powershell id="n2k7qx"
git status
```

Review:

- Current branch.
- Modified files.
- Untracked files.
- Staged changes.

Do not overwrite or discard existing user changes without explicit intent.

---

## 8. Pulling Changes

To update the current branch from its configured remote:

```powershell id="3p7s0n"
git pull
```

To bring the latest `main` changes into the current feature branch:

```powershell id="8m2w5h"
git pull origin main
```

When running this from a feature branch, Git attempts to merge `origin/main` into the current branch.

An alternative workflow is rebasing:

```powershell id="0q6c4z"
git fetch origin
git rebase origin/main
```

The project should use the team's agreed integration strategy consistently.

---

## 9. Fetch vs Pull

`git fetch` downloads remote changes without changing the current working branch.

```powershell id="k4h2s7"
git fetch origin
```

`git pull` generally performs:

```text id="r7x3m1"
fetch
+
merge or rebase
```

depending on repository configuration.

Developers should understand which operation they are performing before resolving conflicts.

---

## 10. Committing Changes

Commits should represent a coherent change.

Good commit:

```text id="b1x9v3"
feat(products): add product creation flow
```

Poor commits:

```text id="8v2j1k"
changes
fixed
update
final
```

Avoid combining unrelated work into one commit.

---

## 11. Commit Message Convention

Use a conventional structure:

```text id="g4n8m2"
<type>(<scope>): <description>
```

Examples:

```text id="q5k1r7"
feat(products): add product creation
fix(inventory): prevent concurrent overselling
fix(checkout): make completion idempotent
docs(api): define checkout errors
test(payments): cover duplicate webhook delivery
refactor(orders): isolate order state transitions
chore(deps): update validation library
```

The scope should identify the relevant module or area.

---

## 12. Commit Granularity

Commits should be:

- Small enough to review.
- Complete enough to understand.
- Buildable when practical.
- Focused on one logical change.

Avoid creating dozens of meaningless commits for trivial edits.

Also avoid one enormous commit containing an entire feature, unrelated refactors, dependency changes, and documentation updates.

---

## 13. Staging Changes

Before committing:

```powershell id="f3r6v1"
git status
git diff
```

Review the actual changes.

Stage only the intended files:

```powershell id="q7n4z2"
git add path/to/file
```

Then review staged changes:

```powershell id="h1w8p5"
git diff --cached
```

Avoid blindly staging everything with:

```powershell id="9k5j2x"
git add .
```

when unrelated changes may exist.

---

## 14. Sensitive Files

Never commit:

```text
.env
production secrets
private keys
API credentials
database passwords
provider credentials
authentication secrets
```

The repository should provide safe templates such as:

```text id="a5x2m7"
.env.example
```

If a secret is accidentally committed, removing it from the latest commit is not sufficient if it has already reached a remote repository. The credential must be rotated.

---

## 15. Generated Files

Do not commit generated files unless they are intentionally version-controlled.

Common examples that normally remain ignored:

```text id="g7q3z9"
node_modules/
.next/
coverage/
local build output
temporary files
environment files containing secrets
```

The exact ignore policy is defined by `.gitignore`.

---

## 16. Documentation Changes

Documentation changes should be committed with the implementation they describe when the documentation is required for that implementation.

For independent documentation work, use a documentation branch:

```text id="k9x4r1"
docs/architecture-review
docs/api-contracts
```

Documentation must reflect the actual system rather than speculative future architecture.

---

## 17. Database Migrations

Database migrations must be committed together with the code that depends on them when the migration is part of the feature.

A migration should never exist only on one developer's local machine.

Before merging a migration:

- Verify migration ordering.
- Verify forward application.
- Test affected queries.
- Test relevant constraints.
- Confirm compatibility with application deployment behavior.

---

## 18. Pull Requests

Pull requests should contain a focused change.

A PR should normally include:

### Summary

What changed.

### Reason

Why the change was required.

### Implementation

Important technical decisions.

### Testing

Commands actually executed and their results.

### Risks

Known risks or limitations.

### Database/deployment impact

Required when applicable.

---

## 19. Pull Request Size

Prefer smaller PRs.

Large PRs should be split when possible.

A large PR may be appropriate for:

- A complete foundational feature.
- A coordinated schema and application change.
- An architectural migration.

Even then, unrelated changes should remain separate.

---

## 20. Code Review

Reviewers should focus on:

1. Correctness.
2. Security.
3. Tenant isolation.
4. Authorization.
5. Data integrity.
6. Concurrency.
7. Idempotency.
8. API contract behavior.
9. Tests.
10. Maintainability.

Style issues should not distract from correctness and security issues.

---

## 21. Required Checks

Before merging, applicable project checks should pass.

Baseline checks:

```powershell id="m3v7q2"
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Database changes should additionally run the relevant migration and database tests.

Do not claim a check passed unless it was actually executed.

---

## 22. CI Checks

Pull requests should be validated by CI.

Expected CI responsibilities include:

```text id="c9w1z4"
install dependencies
validate lockfile
lint
typecheck
unit tests
integration tests where configured
build
```

Security or dependency checks may also run depending on repository configuration.

---

## 23. Merging

The repository should use the team's configured pull-request merge strategy consistently.

Possible strategies include:

```text id="x4p8j2"
merge commit
squash merge
rebase merge
```

The chosen strategy should preserve understandable project history.

Do not rewrite shared branch history without explicit agreement.

---

## 24. Rebasing

Rebase may be used to keep a feature branch current with `main`.

Example:

```powershell id="f6m2q8"
git fetch origin
git rebase origin/main
```

During a rebase:

1. Resolve conflicts carefully.
2. Review each resolved file.
3. Run applicable tests.
4. Continue the rebase.
5. Force-push only when required.

---

## 25. Force Push

Force-push must be used carefully.

Prefer:

```powershell id="p8c3z1"
git push --force-with-lease
```

over:

```powershell id="n2x7r4"
git push --force
```

Never force-push shared protected branches such as `main`.

---

## 26. Merge Conflicts

When conflicts occur:

1. Understand both changes.
2. Identify the intended final behavior.
3. Resolve the conflict deliberately.
4. Do not simply choose one side blindly.
5. Review the resulting diff.
6. Run relevant tests.
7. Continue the merge or rebase.

For business-critical files, verify domain behavior after conflict resolution.

---

## 27. Working Tree Safety

Do not discard user changes without explicit authorization.

Avoid destructive commands such as:

```powershell id="r7n5k2"
git reset --hard
git clean -fd
```

unless the consequences are understood and the operation is explicitly intended.

AI agents must be especially careful because uncommitted work may belong to the developer.

---

## 28. AI-Assisted Git Operations

AI agents may assist with Git operations but must preserve developer work.

Before changing Git state, an agent should inspect:

```powershell id="x5f8q3"
git status
git branch --show-current
git diff
```

Agents must not:

- Delete branches without authorization.
- Reset uncommitted work.
- Force-push shared branches.
- Rewrite history casually.
- Commit secrets.
- Commit unrelated changes.
- Claim that a commit or push succeeded unless it actually did.

---

## 29. AI-Generated Commits

AI-generated commits must follow the same commit conventions as human-created commits.

The commit message should describe the actual implementation.

An AI agent must not create a commit containing work that the developer did not intend to include.

---

## 30. Remote Operations

Before pushing:

```powershell id="r5c2v7"
git status
git diff
git log --oneline -n 5
```

Verify:

- Correct branch.
- Correct files.
- Correct commit.
- Correct remote.
- No secrets.
- No unrelated changes.

Then push:

```powershell id="z7n4m1"
git push origin <branch>
```

---

## 31. Main Branch Protection

`main` should be protected where the Git hosting platform supports it.

Recommended protections include:

- Pull request requirement.
- CI requirement.
- Restricted direct pushes.
- Review requirement for sensitive changes.
- Secret scanning where available.

The exact protection rules may evolve with team size and deployment maturity.

---

## 32. Release Tags

Release tags may be introduced when deployment versioning requires them.

Tags should be immutable identifiers of released source states.

Example:

```text id="w3f8q6"
v0.1.0
v0.2.0
v1.0.0
```

Do not use arbitrary tags such as:

```text id="y2r5n8"
latest
final
real-final
production-final
```

as the sole representation of releases.

---

## 33. Hotfixes

Urgent production fixes should still follow the normal safety principles.

Typical flow:

```text id="h5q2m7"
main
  ↓
hotfix branch
  ↓
fix
  ↓
tests
  ↓
review
  ↓
deploy
```

The urgency of a fix does not justify bypassing security or verification without a deliberate incident procedure.

---

## 34. Rollback and Git

Rollback should preferably use a known-good application version or commit.

Do not casually rewrite Git history to undo a production deployment.

Deployment rollback procedures are defined separately in:

```text id="0x9k3p"
docs/deployment/rollback-strategy.md
```

---

## 35. Demo-to-V1 Evolution

The Git workflow should remain useful as the platform grows.

### Demo

```text id="n4m7x2"
main
feature/fix branches
pull requests
CI verification
basic branch protection
```

### V1

May add:

```text id="k6p3r9"
release automation
environment promotion
deployment approvals
release tags
automated changelogs
stricter branch protections
```

The core branch and review model should remain stable.

---

## 36. Git Checklist

Before creating a PR:

- [ ] Correct branch.
- [ ] Working tree reviewed.
- [ ] No secrets.
- [ ] No unrelated changes.
- [ ] Commit messages are meaningful.
- [ ] Tests added or updated.
- [ ] Documentation updated where necessary.
- [ ] Database migrations included where necessary.
- [ ] Lint passed.
- [ ] Typecheck passed.
- [ ] Tests passed.
- [ ] Build passed.
- [ ] PR description accurately reflects the changes.

---

## 37. Definition of Done

A Git change is ready for integration when:

- The correct branch contains only the intended work.
- The change has meaningful commits.
- Sensitive files are excluded.
- Relevant tests and checks pass.
- Documentation reflects changed behavior where necessary.
- The pull request clearly explains the change.
- Review requirements are satisfied.
- No unintentional history or working-tree changes are introduced.