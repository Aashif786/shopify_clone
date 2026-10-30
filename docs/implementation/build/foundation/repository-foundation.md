# Repository Foundation

## 1. Purpose

This document defines the implementation requirements for establishing the repository foundation for the Demo.

The repository foundation must provide a clean, reproducible, maintainable workspace before business-domain implementation begins.

It covers:

- Repository structure.
- Workspace configuration.
- Package management.
- TypeScript configuration.
- Source boundaries.
- Development scripts.
- Git hygiene.
- Build tooling.
- Local development conventions.
- AI-assisted development compatibility.

It does not define individual business-domain behavior.

---

# 2. Repository Structure

The repository must maintain the approved modular monolith structure:

```text
calcart/
├── apps/
│   ├── web/
│   └── worker/
├── modules/
│   ├── carts/
│   ├── checkout/
│   ├── customers/
│   ├── discounts/
│   ├── inventory/
│   ├── orders/
│   ├── payments/
│   ├── products/
│   └── stores/
├── packages/
│   ├── auth/
│   ├── config/
│   ├── db/
│   ├── event-bus/
│   ├── tenant/
│   ├── types/
│   ├── ui/
│   └── validation/
├── specs/
├── docs/
├── infrastructure/
└── tests/
```

The implementation must not introduce additional top-level architectural applications without an approved architectural decision.

---

# 3. Repository Root Responsibilities

The root repository should contain only project-wide configuration and documentation.

Typical files include:

```text
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
tsconfig.json
.env.example
.gitignore
README.md
AGENTS.md
CLAUDE.md
```

Additional root files are permitted when required by tooling.

Avoid placing application source code directly in the repository root.

---

# 4. Workspace Model

The repository is a pnpm workspace.

Workspace packages include:

```text
apps/*
modules/*
packages/*
```

The workspace must resolve local package dependencies consistently.

All package names should follow a predictable internal namespace.

Example:

```text
@calcart/config
@calcart/db
@calcart/auth
```

The exact namespace should remain consistent across the repository.

---

# 5. Package Ownership

Each workspace package must have a clearly defined responsibility.

| Package | Responsibility |
|---|---|
| `auth` | Authentication primitives |
| `config` | Typed application configuration |
| `db` | PostgreSQL connectivity and persistence infrastructure |
| `event-bus` | Internal event contracts/dispatch |
| `tenant` | Tenant/store context |
| `types` | Genuinely shared types |
| `ui` | Reusable presentation components |
| `validation` | Shared boundary validation utilities |

A package must not become a miscellaneous utility collection.

---

# 6. Domain Module Ownership

Business modules remain under:

```text
modules/
```

Each module owns its business capability.

Example:

```text
modules/products/
```

owns:

```text
Product
Variant
Product lifecycle
Product-specific business rules
Product application services
Product persistence
Product API-facing contracts where appropriate
```

Other modules must consume Products through its public interface.

---

# 7. Application Ownership

`apps/web` owns application delivery concerns.

It is responsible for:

```text
HTTP
routing
request handling
authentication context
tenant resolution
API responses
web presentation
```

It must not become the owner of domain business rules.

---

# 8. Worker Ownership

`apps/worker` owns background execution.

It is responsible for:

```text
job polling
job claiming
job dispatch
retry execution
graceful shutdown
worker health
```

Business logic remains in the relevant module.

The Worker invokes domain/application capabilities rather than duplicating them.

---

# 9. Source Boundary

A simplified dependency direction should be:

```text
apps
 ↓
modules / packages

modules
 ↓
packages

packages
 ↓
external libraries
```

Business modules must not depend on application-specific implementation details from `apps/web`.

---

# 10. Dependency Direction

Avoid:

```text id="5asb7a"
packages → apps
modules → apps
database → domain modules
```

Prefer:

```text id="j0b8z8"
apps → modules
apps → packages
modules → shared packages
```

Dependencies should flow toward stable lower-level abstractions.

---

# 11. Circular Dependency Prevention

The repository must not intentionally introduce circular workspace dependencies.

Examples of problematic structures:

```text
products → inventory
inventory → products
```

or:

```text
auth → tenant
tenant → auth
```

where both require each other's implementation.

Resolve such relationships through:

- Interfaces.
- Shared contracts.
- Application orchestration.
- Events.

Do not solve cycles through hidden imports.

---

# 12. Package Public API

Each workspace package should expose an intentional public entry point.

Prefer:

```text
packages/db/src/index.ts
```

as the package boundary.

Consumers should import:

```text
@calcart/db
```

rather than:

```text
@calcart/db/src/internal/some-file
```

Internal files remain private.

---

# 13. Domain Public API

Each domain module should similarly expose a public entry point.

Example:

```text
modules/products/src/index.ts
```

Consumers should use the public module interface.

Do not import:

```text
modules/products/src/infrastructure/...
```

from another module.

---

# 14. Internal Directory Convention

Where appropriate, domain modules may use:

```text
src/
├── domain/
├── application/
├── infrastructure/
└── index.ts
```

The exact internal structure can vary when justified, but ownership boundaries must remain clear.

---

# 15. Package.json Standards

Each workspace package should define only the scripts and dependencies it actually needs.

Avoid copying a large root configuration into every package.

Typical scripts may include:

```text
build
typecheck
lint
test
```

The root should orchestrate workspace-wide operations.

---

# 16. Root Scripts

The root `package.json` should provide predictable commands for:

```text
install
dev
build
typecheck
lint
format
test
test:unit
test:integration
test:e2e
db:migrate
db:seed
```

Exact command names may vary, but equivalent functionality must exist.

---

# 17. Development Command

A developer should be able to start the required development processes through documented commands.

Expected conceptual behavior:

```text
Database
   ↓
Web
   +
Worker
```

The development workflow should not require undocumented manual intervention.

---

# 18. TypeScript Configuration

TypeScript configuration should support:

```text
strict mode
workspace packages
path/package resolution
server-side applications
shared packages
```

Do not weaken compiler settings merely to accommodate legacy or incomplete code.

---

# 19. TypeScript Project Boundaries

Where useful, separate configurations may exist for:

```text
web
worker
shared packages
tests
```

The configuration should make ownership and build boundaries explicit.

Avoid a single enormous configuration containing every possible concern if it reduces clarity.

---

# 20. Build Output

Generated build artifacts must not be treated as source code.

Examples:

```text
dist/
.next/
coverage/
build/
```

must be ignored where appropriate.

Build output should be reproducible from source.

---

# 21. Git Ignore Rules

`.gitignore` must exclude:

```text
node_modules/
.env
.env.*
!.env.example
.next/
dist/
build/
coverage/
logs/
temporary files
OS-specific files
editor-specific temporary files
```

Only add exceptions when a file is intentionally version-controlled.

---

# 22. Environment Files

Use:

```text
.env.example
```

as the documented configuration template.

Local developers may use:

```text
.env.local
```

or the project-approved equivalent.

Never commit local secrets.

---

# 23. Repository Documentation

The root README should explain:

```text
What the project is
Repository structure
Prerequisites
Installation
Environment setup
Database setup
Development startup
Testing
Build
Deployment references
```

It should link to detailed documentation instead of becoming an enormous architecture manual.

---

# 24. AGENTS.md

`AGENTS.md` remains the primary repository-level AI implementation instruction.

It should stay compact and point AI tools toward detailed documentation.

AI tools must read the actual file from the repository before starting work.

---

# 25. CLAUDE.md and Cursor Rules

`CLAUDE.md` and `.cursor/rules/` must remain consistent with `AGENTS.md`.

They may provide tool-specific instructions but must not contradict repository-level rules.

Required behavior:

```text id="w4b4re"
Read actual AGENTS.md
 ↓
Read relevant documentation
 ↓
Inspect code
 ↓
Implement
 ↓
Verify
```

---

# 26. Source Control Baseline

Before feature implementation:

```text
[ ] Git repository initialized
[ ] main branch exists
[ ] Working tree is understood
[ ] .gitignore verified
[ ] Initial repository state committed
[ ] Remote configured where applicable
```

Do not begin major feature work with an unexplained dirty baseline.

---

# 27. Commit Baseline

The foundation should be committed separately from domain implementation.

Recommended conceptual history:

```text
chore(repo): establish workspace foundation
chore(repo): configure TypeScript
chore(repo): configure development tooling
chore(repo): establish test foundation
```

This makes later debugging and rollback easier.

---

# 28. Dependency Installation

Dependencies must be installed from the repository root.

Verify:

```text
pnpm install
```

produces a valid workspace installation.

The lockfile must be committed once the dependency set is established.

---

# 29. Dependency Hygiene

The foundation must not introduce unnecessary dependencies.

Before adding a dependency:

```text
Requirement
 ↓
Existing capability check
 ↓
Compatibility check
 ↓
Security/maintenance check
 ↓
Add only if justified
```

---

# 30. Node and Tooling Versions

Development tooling versions must be documented sufficiently for reproducibility.

Where appropriate, use repository-level version management for:

```text
Node.js
pnpm
```

Do not assume every developer happens to have the same environment.

---

# 31. Local Development Consistency

A developer's machine should not require custom undocumented configuration to run the project.

Avoid dependencies on:

```text
machine-specific absolute paths
personal credentials
global packages
manual database modifications
```

---

# 32. Test Directory Ownership

The repository uses:

```text
tests/
├── e2e/
└── integration/
```

Domain-local unit tests may remain near the code they test when consistent with the testing strategy.

Integration and E2E tests should remain centrally discoverable.

---

# 33. Infrastructure Directory Ownership

Infrastructure-related configuration belongs under:

```text
infrastructure/
├── docker/
├── environments/
└── scripts/
```

Do not scatter deployment infrastructure throughout business modules.

---

# 34. Documentation Directory Ownership

Documentation remains organized by concern:

```text
docs/
├── architecture
├── database
├── domain
├── api
├── security
├── testing
├── deployment
├── infrastructure
├── engineering
├── implementation
└── ...
```

Implementation details must not replace architecture documentation.

---

# 35. Generated Code

Generated files must have a clearly defined source.

If generated code is used:

```text
source
  ↓
generation command
  ↓
generated output
```

Document whether generated output is:

```text
committed
or
recreated during build
```

Do not manually edit generated files without a documented reason.

---

# 36. Build Reproducibility

A clean checkout must be able to reproduce the application build.

Expected conceptual flow:

```text
Clean checkout
 ↓
Install locked dependencies
 ↓
Load configuration
 ↓
Build
 ↓
Successful output
```

No undocumented local file should be required.

---

# 37. Clean Checkout Verification

Periodically verify the repository from a clean environment.

Test:

```text
git clone
pnpm install
configuration
database setup
migration
seed
build
tests
```

This catches hidden dependencies on developer machines.

---

# 38. Foundation Health Check

The repository foundation should have a simple verification sequence:

```text
Install
 ↓
Typecheck
 ↓
Lint
 ↓
Test
 ↓
Build
```

All baseline checks must succeed before domain implementation begins.

---

# 39. Failure Handling

When foundation setup fails:

```text
Identify root cause
 ↓
Fix foundation
 ↓
Repeat verification
```

Do not work around broken infrastructure inside domain code.

For example, do not add application-level hacks because the database package is incorrectly configured.

---

# 40. Repository Security

Verify:

```text
[ ] No secrets committed
[ ] No production credentials
[ ] No database dumps containing sensitive data
[ ] No private keys
[ ] No provider API keys
[ ] No accidental `.env` files
```

Run secret scanning before declaring the repository foundation complete.

---

# 41. Repository Performance

The foundation should avoid unnecessary build overhead.

Do not introduce:

```text
large generated assets
unnecessary dependencies
duplicate compilation
redundant build stages
```

Optimize only after establishing a correct baseline.

---

# 42. Foundation Verification Checklist

```text
[ ] Repository structure matches approved architecture
[ ] pnpm workspace resolves
[ ] package boundaries are correct
[ ] TypeScript is strict
[ ] Root scripts work
[ ] Web package resolves
[ ] Worker package resolves
[ ] Shared packages resolve
[ ] Build works
[ ] Type checking works
[ ] Linting works
[ ] Formatting works
[ ] Git ignore rules work
[ ] Environment template exists
[ ] README provides setup instructions
[ ] AGENTS.md is present
[ ] CLAUDE.md is consistent
[ ] Cursor rules are consistent
[ ] Test directories are ready
[ ] Infrastructure directories are ready
[ ] Secret scanning passes
```

---

# 43. Definition of Done

Repository foundation is complete when:

```text
[ ] A clean checkout can install successfully
[ ] Workspace packages resolve correctly
[ ] Web and Worker projects resolve
[ ] Shared package boundaries are enforced
[ ] TypeScript passes
[ ] Lint passes
[ ] Formatting checks pass
[ ] Baseline tests execute
[ ] Build succeeds
[ ] Environment configuration is documented
[ ] Git hygiene is established
[ ] AI instructions are consistent
[ ] No secrets are present
[ ] Development setup is reproducible
```

The repository is then ready for the next foundation layer: **package implementation**.