# Repository Bootstrap Implementation

## 1. Purpose

This document defines the implementation steps required to prepare the repository for application development.

The goal is to establish a clean, reproducible monorepo foundation before implementing business domains.

This document covers repository-level setup only. Business-domain implementation must follow the later implementation stages.

---

# 2. Repository Structure

The repository uses a pnpm workspace:

```text
shopify_clone/
├── apps/
├── modules/
├── packages/
├── specs/
├── docs/
├── infrastructure/
├── tests/
├── .github/
├── .cursor/
├── AGENTS.md
├── CLAUDE.md
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
└── README.md
```

The repository structure established during architecture planning should remain the baseline.

---

# 3. Repository Goals

The repository bootstrap must provide:

- Reproducible installation.
- Predictable workspace boundaries.
- TypeScript support.
- Consistent scripts.
- Consistent development commands.
- CI compatibility.
- Environment configuration.
- Clear package ownership.

---

# 4. Package Manager

The repository uses **pnpm**.

The package manager version should be explicitly pinned.

Recommended configuration:

```text id="7q3b1m"
packageManager: pnpm@<approved-version>
```

The exact version should be selected and committed consistently across development and CI.

---

# 5. Workspace Configuration

`pnpm-workspace.yaml` should explicitly define workspace locations.

Conceptually:

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "modules/*"
```

Tests and documentation directories should not be treated as installable packages unless a real requirement exists.

---

# 6. Root Package

The root `package.json` should contain repository-level scripts.

Typical scripts include:

```text id="x8m4c7"
dev
build
typecheck
lint
test
test:unit
test:integration
test:e2e
format
format:check
db:migrate
db:seed
```

Scripts should delegate to workspace packages where appropriate.

---

# 7. Root Scripts

The root scripts should provide a consistent developer interface.

For example:

```text id="m5v9x2"
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

Developers should not need to remember a different command for every package unless a package-specific operation is required.

---

# 8. Node.js Version

The supported Node.js version must be explicitly defined.

Use one authoritative mechanism such as:

```text id="n7c3m8"
.engines
.nvmrc
.volta
```

or the project's selected equivalent.

CI and local development should use the same supported Node.js version.

---

# 9. TypeScript Configuration

The repository should use a shared TypeScript baseline.

The configuration should enforce strict type safety.

Important settings should include:

```text id="p4x8m2"
strict: true
noImplicitAny: true
```

The exact configuration may be adjusted for framework requirements.

---

# 10. TypeScript Project References

Project references should only be introduced when they provide a concrete build or dependency benefit.

Do not create a complicated TypeScript build graph merely because the repository is a monorepo.

The initial Demo should prioritize maintainability.

---

# 11. Path Aliases

Path aliases should remain predictable.

For example:

```text id="c8m3v7"
@/*

@repo/auth
@repo/db
@repo/config
```

The exact aliases should be standardized before implementation.

Aliases must not hide prohibited cross-module dependencies.

---

# 12. Package Naming

Internal packages should use a consistent naming convention.

For example:

```text id="x7m4n9"
@shopify-clone/auth
@shopify-clone/config
@shopify-clone/db
@shopify-clone/event-bus
@shopify-clone/tenant
@shopify-clone/types
@shopify-clone/ui
@shopify-clone/validation
```

The final package scope should match the actual repository/project naming decision.

---

# 13. Application Packages

The initial applications are:

```text id="q5v8c2"
apps/web
apps/worker
```

### `apps/web`

Owns:

- Next.js application.
- HTTP/API presentation.
- Storefront presentation.
- Merchant UI.
- Authentication entry points.
- Request routing.

### `apps/worker`

Owns:

- Worker bootstrap.
- Job polling.
- Job execution.
- Worker lifecycle.

---

# 14. Domain Modules

Domain modules live under:

```text id="h4m7x3"
modules/
```

Current domains:

```text id="9q2x7m"
carts
checkout
customers
discounts
inventory
orders
payments
products
stores
```

Supporting implementation modules may include:

```text id="5m8c4v"
media
notifications
webhooks
```

Jobs remain shared infrastructure with domain-specific handlers.

---

# 15. Module Package Boundaries

Each module should expose a public entry point:

```text id="w6c2n8"
modules/products/index.ts
modules/orders/index.ts
```

Consumers should import from the public entry point.

Avoid imports such as:

```text id="z4m7p3"
modules/products/src/internal/...
```

---

# 16. Package-Level Ownership

Every package/module should have a clearly defined responsibility.

A package must not become a general-purpose location for unrelated code.

When adding a new directory, the developer should be able to answer:

> Which architectural responsibility owns this code?

If that answer is unclear, the code probably belongs somewhere else.

---

# 17. Repository Naming

Use consistent naming:

### Directories

```text
kebab-case
```

### TypeScript files

Use the established project convention consistently.

### Tests

Use explicit names such as:

```text
*.test.ts
*.spec.ts
```

The exact convention should be standardized and not mixed arbitrarily.

---

# 18. Environment Files

The repository should contain:

```text id="a8p4m7"
.env.example
```

Local secrets should use:

```text id="x5c9v2"
.env.local
```

or the environment mechanism selected by the application.

Real secrets must never be committed.

---

# 19. Git Ignore

`.gitignore` must exclude:

```text id="j7m3c8"
node_modules/
.next/
dist/
coverage/
.env
.env.local
*.log
```

along with generated and machine-specific files.

The exact list should match the project's tooling.

---

# 20. Generated Files

Generated artifacts should not be committed unless explicitly required.

Examples:

- Build output.
- Coverage output.
- Local logs.
- Temporary files.
- Generated cache.
- Local database artifacts.

Generated OpenAPI or client code may be committed only if the repository intentionally treats it as a source artifact.

---

# 21. README

The root README should provide:

- Project purpose.
- Architecture summary.
- Requirements.
- Installation.
- Local development.
- Testing.
- Database setup.
- Environment configuration.
- Deployment overview.
- Links to detailed documentation.

The README should remain an entry point, not duplicate the complete architecture documentation.

---

# 22. AGENTS.md

`AGENTS.md` remains the primary repository-level instruction file for AI-assisted development.

AI agents must read the actual file before beginning a task.

They must not rely on cached or remembered content.

Detailed architecture remains under `docs/`.

---

# 23. CLAUDE.md

`CLAUDE.md` provides tool-specific guidance for Claude-based development.

It must remain aligned with `AGENTS.md` and the actual repository architecture.

It must not become a competing architecture document.

---

# 24. Cursor Rules

Cursor rules remain under:

```text id="x7m4q9"
.cursor/rules/
```

Rules should reinforce repository behavior without duplicating every project specification.

The most important rule is that AI agents inspect the actual repository and documentation before modifying code.

---

# 25. GitHub Configuration

The repository should contain:

```text id="m8c3v6"
.github/
├── pull_request_template.md
└── workflows/
```

CI workflows should eventually cover:

- Installation.
- Type checking.
- Linting.
- Unit tests.
- Integration tests.
- Build.
- E2E tests where environment support exists.

---

# 26. Branching

The implementation should use short-lived feature branches.

Example:

```text id="k2x7m4"
main
  │
  ├── feature/stores
  ├── feature/products
  ├── feature/inventory
  └── feature/checkout
```

Do not maintain long-lived branches for individual domains unless there is a concrete organizational requirement.

---

# 27. Commit Discipline

Commits should be:

- Focused.
- Descriptive.
- Buildable where practical.
- Free from secrets.
- Free from unrelated changes.

Large generated AI changes should be reviewed and split where necessary.

---

# 28. Dependency Installation

Dependencies should be added through pnpm.

Example:

```text id="g6v2m9"
pnpm add <dependency>
```

Workspace dependencies should use the appropriate workspace protocol where applicable.

Do not manually edit the lockfile.

---

# 29. Dependency Lockfile

The repository must commit the pnpm lockfile.

The lockfile provides reproducible dependency resolution.

CI should install using the frozen lockfile.

---

# 30. Dependency Hygiene

Before adding a dependency, verify:

- It is actually required.
- It supports the selected Node.js version.
- It is actively maintained.
- Its license is acceptable.
- It does not duplicate an existing dependency.
- It does not introduce unnecessary infrastructure.

AI-generated dependency additions require the same scrutiny as human-generated additions.

---

# 31. Local Development Command

The repository should eventually support:

```text id="p4m8x7"
pnpm dev
```

which starts the required development applications and services according to the local development strategy.

The exact orchestration mechanism should remain simple.

---

# 32. Build Command

The repository should support:

```text id="v8c3m5"
pnpm build
```

The build must verify that:

- Web application compiles.
- Worker compiles.
- Shared packages resolve correctly.
- TypeScript boundaries remain valid.

---

# 33. Type Checking

The repository should support:

```text id="z5n7c2"
pnpm typecheck
```

Type checking must run in CI.

Strict typing is part of the platform's correctness strategy.

---

# 34. Linting

The repository should support:

```text id="m6x9q4"
pnpm lint
```

Linting should focus on meaningful correctness and maintainability rules.

Avoid excessive stylistic rules that create noise without improving reliability.

---

# 35. Formatting

The repository should standardize formatting.

Developers and CI should use the same formatter configuration.

The project should provide:

```text id="r3c7v8"
pnpm format
pnpm format:check
```

where supported.

---

# 36. Test Commands

The repository should expose predictable test commands.

For example:

```text id="b5m8x2"
pnpm test
pnpm test:unit
pnpm test:integration
pnpm test:e2e
```

Tests should remain separated by execution cost and infrastructure requirements.

---

# 37. Repository Validation

Before application implementation begins, verify:

```text id="x9q4m7"
[ ] pnpm workspace resolves
[ ] All intended packages are discovered
[ ] Web package resolves
[ ] Worker package resolves
[ ] TypeScript resolves
[ ] Root scripts execute
[ ] Lockfile is valid
[ ] Git ignores generated files
[ ] Environment example exists
[ ] CI can install dependencies
```

---

# 38. Initial Repository Health Check

Run the repository health checks before beginning business-domain implementation:

```text id="n3v8c5"
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

If a command is not yet implemented, the repository should clearly document that limitation rather than pretending the check passed.

---

# 39. Repository Bootstrap Definition of Done

The repository bootstrap is complete when:

```text id="q7m2x8"
[ ] pnpm version is defined
[ ] Node.js version is defined
[ ] Workspace configuration is valid
[ ] Root package scripts exist
[ ] Web workspace exists
[ ] Worker workspace exists
[ ] Shared packages resolve
[ ] TypeScript configuration works
[ ] Path aliases are defined
[ ] Environment strategy exists
[ ] .gitignore is correct
[ ] Lockfile is committed
[ ] README provides setup instructions
[ ] AGENTS.md exists
[ ] CLAUDE.md exists
[ ] Cursor rules exist
[ ] GitHub CI foundation exists
[ ] Linting works
[ ] Formatting works
[ ] Type checking works
[ ] Test runner works
[ ] Build works
[ ] No secrets are committed
```

---

# 40. Final Repository Principle

The repository should make the correct implementation path obvious.

A developer joining the project should be able to determine:

```text id="s4c8m2"
Where does this code belong?
        ↓
Which module owns it?
        ↓
Which package does it depend on?
        ↓
Which specification defines it?
        ↓
How do I test it?
```

If the repository structure cannot answer those questions, the bootstrap is not finished.