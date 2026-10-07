# Repository Implementation

## 1. Purpose

This document defines the concrete implementation work required to establish the repository as a stable foundation for the Demo.

The repository must support:

- A pnpm monorepo.
- Next.js application development.
- Background worker development.
- Shared internal packages.
- TypeScript strictness.
- Consistent development commands.
- Automated validation.
- CI/CD integration.
- AI-assisted development.
- Future evolution toward V1 without restructuring the repository unnecessarily.

The implementation should establish infrastructure and conventions without introducing unnecessary services or tooling.

---

# 2. Repository Structure

The implemented repository should preserve the following high-level structure:

```text
shopify_clone/
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
├── docs/
├── specs/
├── infrastructure/
├── tests/
├── .github/
└── root configuration files
```

The implementation must not create additional applications or services unless an actual requirement justifies them.

---

# 3. Repository Bootstrap

## 3.1 Package Manager

Use pnpm as the repository package manager.

The repository must contain:

```text
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
```

The lockfile must be committed.

Dependency installation must use the lockfile in CI and deployment environments.

---

## 3.2 Node.js Version

Define a supported Node.js version explicitly.

The version should be declared consistently through the repository's supported version mechanism.

All developers and CI environments should use the same supported major version.

---

# 4. Root Package Configuration

The root `package.json` should provide only repository-level responsibilities.

Required script categories:

```text
dev
build
start
lint
typecheck
test
test:unit
test:integration
test:e2e
format
format:check
check
```

The exact script names may be adjusted to match the selected tooling, but equivalent capabilities must exist.

---

# 5. Workspace Configuration

`pnpm-workspace.yaml` must define the workspace locations.

Expected workspace groups:

```text
apps/*
packages/*
modules/*
```

Documentation, tests, infrastructure, and configuration directories must not accidentally become pnpm packages.

---

# 6. Package Naming

Internal packages should use a consistent namespace.

Example:

```text
@shopify-clone/auth
@shopify-clone/config
@shopify-clone/db
@shopify-clone/event-bus
@shopify-clone/tenant
@shopify-clone/types
@shopify-clone/ui
@shopify-clone/validation
```

Domain modules should follow the same naming convention if they are independently imported as packages.

The actual package scope must be chosen once and used consistently.

---

# 7. TypeScript Configuration

The repository must use strict TypeScript.

Required principles:

- `strict` enabled.
- No implicit `any`.
- No unchecked type assumptions at external boundaries.
- Explicit types for public APIs.
- Shared compiler configuration.
- Consistent module resolution.

TypeScript configuration should distinguish between:

```text
Browser/client code
Server code
Worker code
Shared packages
```

Server-only dependencies must not leak into browser bundles.

---

# 8. Root TypeScript Configuration

Create a root TypeScript configuration for shared compiler settings.

It should define common settings such as:

- Target.
- Module system.
- Strictness.
- Module resolution.
- Source maps.
- Declaration behavior where required.
- Path conventions.

Application-specific configuration may extend the root configuration.

---

# 9. Package TypeScript Configuration

Each independently compiled package should have its own TypeScript configuration where required.

Package configuration should:

- Extend shared settings.
- Restrict source boundaries.
- Avoid importing files through filesystem-relative paths from another package.
- Expose public APIs through package exports.

---

# 10. Public Package Exports

Packages must expose stable entry points.

Preferred:

```text
@shopify-clone/db
@shopify-clone/db/repositories
```

where justified.

Avoid:

```text
../../../packages/db/src/internal/file
```

Cross-package imports must use public package boundaries.

---

# 11. Application Boundaries

## Web

`apps/web` owns:

- HTTP/API presentation.
- Next.js application behavior.
- Web UI.
- Request context creation.
- Route handlers.
- Server-side application composition.

It must not own domain rules belonging to modules.

## Worker

`apps/worker` owns:

- Worker startup.
- Job polling.
- Job dispatch.
- Graceful shutdown.
- Worker-level observability.

Job business logic belongs to the appropriate module or integration package.

---

# 12. Domain Module Boundaries

Each domain module should expose public application interfaces.

Example:

```text
modules/products/
├── domain/
├── application/
├── infrastructure/
├── api/
└── index.ts
```

The exact internal directory structure may evolve, but ownership must remain clear.

A module's internal implementation must not be imported directly by another module.

---

# 13. Root Configuration Files

The repository should maintain:

```text
.env.example
.gitignore
.editorconfig
package.json
pnpm-workspace.yaml
tsconfig.json
README.md
AGENTS.md
CLAUDE.md
```

Additional configuration files should be added only when required by actual tooling.

---

# 14. Environment Files

Environment configuration should follow:

```text
.env.example
.env.local
```

`.env.local` must never be committed.

The example file must contain:

- Required variable names.
- Safe placeholder values.
- Short descriptions where useful.

It must never contain real credentials.

---

# 15. Git Configuration

`.gitignore` must exclude at minimum:

```text
node_modules/
.next/
dist/
coverage/
.env
.env.*
!.env.example
```

Additional generated artifacts should be added as needed.

Do not ignore source files or important project configuration simply to make the repository cleaner.

---

# 16. Repository Documentation

The root `README.md` should explain:

- Project purpose.
- Demo scope.
- Technology stack.
- Repository structure.
- Prerequisites.
- Installation.
- Environment setup.
- Local development.
- Database startup.
- Tests.
- Build.
- Deployment overview.
- Documentation locations.

Detailed architecture must remain in `docs/`.

---

# 17. Developer Setup

A new developer should be able to perform approximately:

```text
Clone repository
      ↓
Install Node/pnpm
      ↓
pnpm install
      ↓
Configure environment
      ↓
Start local dependencies
      ↓
Run migrations
      ↓
Seed development data
      ↓
pnpm dev
```

The exact commands must be documented in `README.md`.

---

# 18. Root Development Commands

The root project should provide commands for common operations.

Examples:

```text
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
```

Database commands should also be exposed through a predictable interface.

For example:

```text
pnpm db:migrate
pnpm db:seed
pnpm db:reset
```

The exact command names may follow the selected database tooling.

---

# 19. Local Infrastructure

The repository should provide a simple local infrastructure strategy.

For Demo, PostgreSQL should be runnable locally through Docker.

Expected concept:

```text
Developer Machine
      │
      ├── Next.js
      ├── Worker
      │
      └── Docker
            └── PostgreSQL
```

Do not add Redis, Kafka, Elasticsearch, or other infrastructure merely because they may be useful in V1.

---

# 20. Docker Repository Support

Infrastructure files should live under:

```text
infrastructure/docker/
```

Docker configuration should support local development and, where appropriate, production packaging.

Application source code should remain outside infrastructure-specific directories.

---

# 21. CI Foundation

GitHub Actions should validate pull requests.

Minimum checks:

```text
Install dependencies
      ↓
Lint
      ↓
Typecheck
      ↓
Unit tests
      ↓
Build
```

Integration tests requiring PostgreSQL should run against a disposable test database/service.

---

# 22. CI Dependency Installation

CI should use the committed pnpm lockfile.

Dependency installation must fail when the lockfile and package manifests are inconsistent.

This prevents CI from silently producing a dependency graph different from the developer environment.

---

# 23. CI Caching

Dependency caching may be enabled where it improves build time.

Caching must never compromise reproducibility.

A cache miss must still produce the same result as a cache hit.

---

# 24. Build Verification

The CI build must verify the actual application packages.

At minimum:

```text
Web build
Worker build
Shared package compilation where independently built
```

A successful TypeScript check alone is not sufficient to establish that the application can build.

---

# 25. Test Execution

CI should eventually execute:

```text
Unit
Integration
API
Security
E2E
```

The earliest repository bootstrap may run only the tests that exist at that point.

As implementation progresses, CI coverage should expand.

---

# 26. Code Quality

Repository tooling should enforce:

- Formatting.
- Linting.
- Type safety.
- Consistent imports.
- Unused code detection where practical.

Formatting should be automated rather than debated manually in every pull request.

Humanity has suffered enough from whitespace arguments.

---

# 27. Editor Configuration

`.editorconfig` should establish consistent:

- Indentation.
- Line endings.
- Character encoding.
- Trailing whitespace.
- Final newline.

Editor-specific preferences should not be committed unless they are project-wide requirements.

---

# 28. Module Import Rules

The repository should enforce dependency direction.

Preferred:

```text
Presentation
    ↓
Application
    ↓
Domain
    ↓
Infrastructure
```

Infrastructure implementations may depend on domain/application contracts as appropriate.

Domain code must not depend on:

- Next.js.
- HTTP handlers.
- Browser APIs.
- Provider SDKs.
- Database clients directly.

---

# 29. Dependency Rules

Shared packages must remain domain-neutral.

For example:

```text
packages/types
```

must not import:

```text
modules/orders
```

A shared package that becomes dependent on one domain is no longer truly shared.

---

# 30. Circular Dependency Prevention

Circular dependencies must not be introduced between:

- Modules.
- Packages.
- Layers.

If two modules require each other, use:

- Public interfaces.
- Domain events.
- Application orchestration.
- Historical snapshots.
- A neutral shared abstraction.

Do not solve cycles by moving everything into a giant "utils" package.

---

# 31. Generated Files

Generated files must be clearly identified.

Examples:

```text
.next/
dist/
coverage/
generated API clients
generated types
```

Generated source should not be manually edited unless the generation workflow explicitly requires it.

---

# 32. Secrets

The repository must never contain:

- Database passwords.
- API keys.
- Payment credentials.
- Session secrets.
- Object storage credentials.
- Email provider credentials.
- Cloudflare credentials.

Secrets belong in environment-specific secret management.

---

# 33. Production Configuration

Production configuration must not depend on developer-local files.

Production should receive configuration through the deployment environment.

The repository contains configuration definitions and validation, not production secrets.

---

# 34. AI Development Support

The repository already contains:

```text
AGENTS.md
CLAUDE.md
.cursor/rules/
```

These files establish AI development constraints.

AI tools must:

1. Read the actual root `AGENTS.md`.
2. Inspect relevant architecture and specification documents.
3. Inspect existing implementation.
4. Identify the smallest safe change.
5. Implement only the requested scope.
6. Run appropriate validation.
7. Review the final diff.

AI tools must not treat cached instructions as a substitute for reading the current repository instructions.

---

# 35. Repository Bootstrap Verification

The repository foundation is complete when:

```text
[ ] pnpm install succeeds
[ ] Workspace packages resolve
[ ] TypeScript configuration works
[ ] Web application starts
[ ] Worker starts
[ ] PostgreSQL can be connected
[ ] Environment validation works
[ ] Lint passes
[ ] Typecheck passes
[ ] Tests can execute
[ ] Web build succeeds
[ ] Worker build succeeds
[ ] CI workflow executes successfully
```

---

# 36. Implementation Sequence

Repository implementation should proceed in this order:

```text
1. Verify existing repository
2. Verify package manager configuration
3. Establish TypeScript configuration
4. Establish workspace package configuration
5. Configure shared packages
6. Configure web application
7. Configure worker application
8. Configure environment handling
9. Configure local Docker support
10. Configure testing commands
11. Configure linting/formatting
12. Configure GitHub Actions
13. Verify complete repository bootstrap
```

---

# 37. Repository Definition of Done

The repository foundation is complete when a new developer can clone the repository and, using documented commands, reach a working local development environment without manually reconstructing undocumented configuration.

The foundation must provide:

```text
Reproducible Setup
+
Clear Boundaries
+
Strict Type Safety
+
Working Build
+
Automated Validation
+
Local Development
+
CI Verification
+
AI-Safe Development
```

This foundation must remain intentionally boring. Its job is to make the rest of the platform easier to build, test, review, deploy, and eventually evolve into V1.