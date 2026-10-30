# Package Setup Implementation

## 1. Purpose

This document defines how the workspace packages and applications should be configured before domain implementation begins.

The goal is to establish clean package boundaries, dependency direction, TypeScript compatibility, and predictable build behavior.

---

# 2. Workspace Packages

The Demo uses the following shared packages:

```text
packages/
├── auth
├── config
├── db
├── event-bus
├── tenant
├── types
├── ui
└── validation
```

These packages provide reusable technical capabilities.

They must not become a second location for arbitrary business logic.

---

# 3. Applications

The workspace contains:

```text
apps/
├── web
└── worker
```

### Web

The main Next.js application.

### Worker

The background processing application.

Both applications should consume shared packages through workspace dependencies.

---

# 4. Package Naming

Use a single internal package scope.

Recommended pattern:

```text
@calcart/auth
@calcart/config
@calcart/db
@calcart/event-bus
@calcart/tenant
@calcart/types
@calcart/ui
@calcart/validation
```

The actual scope should match the repository's final package naming decision.

---

# 5. Package Structure

A typical package should use:

```text
packages/example/
├── package.json
├── tsconfig.json
└── src/
    └── index.ts
```

Packages requiring additional structure may use:

```text
packages/example/
├── src/
│   ├── application/
│   ├── domain/
│   ├── infrastructure/
│   └── index.ts
├── package.json
└── tsconfig.json
```

Only introduce additional layers when the package actually needs them.

---

# 6. Package Public API

Every package should expose an explicit public entry point:

```text
src/index.ts
```

Consumers should import from the package root:

```text id="9f1xqz"
import { ... } from "@calcart/auth";
```

Avoid importing internal files across package boundaries.

---

# 7. Internal Package Boundaries

This is discouraged:

```text id="3k4n7v"
import { SessionRepository }
from "@calcart/auth/src/infrastructure/session-repository";
```

Prefer:

```text id="v7m2c5"
import { ... }
from "@calcart/auth";
```

The public API becomes the compatibility boundary.

---

# 8. Package Responsibility: Auth

```text
packages/auth
```

Owns:

- User identity.
- Authentication.
- Sessions.
- Authentication context.
- Credential handling.

It must not own:

- Store permissions.
- Product access.
- Order access.
- Inventory rules.

---

# 9. Package Responsibility: Config

```text
packages/config
```

Owns:

- Environment parsing.
- Configuration validation.
- Typed configuration.
- Server/public configuration separation.

It should expose a stable configuration interface.

---

# 10. Package Responsibility: Database

```text
packages/db
```

Owns:

- PostgreSQL connection.
- Connection pooling.
- Transaction infrastructure.
- Database utilities.

It must not expose domain-specific repositories globally.

Repositories remain owned by their respective modules.

---

# 11. Package Responsibility: Event Bus

```text
packages/event-bus
```

Owns:

- Event abstractions.
- Event registration infrastructure.
- Event publication mechanism.

It should remain generic.

Domain event definitions remain within the owning domain.

---

# 12. Package Responsibility: Tenant

```text
packages/tenant
```

Owns:

- Tenant context.
- Store context.
- Organization context.
- Membership resolution utilities.

It should consume authentication context rather than implementing authentication itself.

---

# 13. Package Responsibility: Types

```text
packages/types
```

Contains genuinely shared technical types.

Examples:

- Generic identifiers.
- Pagination primitives.
- Common result structures.

It should not contain complete business entities such as:

```text id="8m2v7x"
Product
Order
Checkout
Payment
```

Those belong to their respective modules.

---

# 14. Package Responsibility: UI

```text
packages/ui
```

Owns:

- Shared UI components.
- Design-system primitives.
- Common presentation components.

It must not depend on:

- PostgreSQL.
- Authentication internals.
- Domain repositories.
- Server secrets.

---

# 15. Package Responsibility: Validation

```text
packages/validation
```

Owns reusable validation infrastructure and conventions.

Domain-specific schemas may remain within the owning module.

Avoid creating a giant central schema package containing every feature's business rules.

---

# 16. Package Dependencies

A recommended dependency direction is:

```text id="h7c3m9"
config
types
validation
     ↓
db
     ↓
auth
tenant
event-bus
     ↓
domain modules
     ↓
apps/web
apps/worker
```

This is a conceptual dependency direction. Actual relationships should remain as small as necessary.

---

# 17. Dependency Restrictions

Packages must not create circular dependencies.

For example:

```text id="q6m8x3"
auth → tenant
tenant → auth
```

should be carefully designed so that the dependency remains directional.

If a shared concept is genuinely needed by both packages, move only that neutral concept into an appropriate lower-level package.

---

# 18. Application Dependencies

`apps/web` may depend on:

```text id="x3v7m5"
auth
config
db
event-bus
tenant
types
ui
validation
domain modules
```

The exact dependency set should remain minimal.

`apps/web` should not expose raw infrastructure to the client.

---

# 19. Worker Dependencies

`apps/worker` may depend on:

```text id="n8c4m2"
config
db
event-bus
domain modules
job infrastructure
```

It should not depend on UI packages.

---

# 20. UI Server Boundary

Next.js server code and client code must remain distinguishable.

Client components must never receive:

- Database clients.
- Provider credentials.
- Server secrets.
- Private infrastructure objects.

Only serializable, client-safe data should cross the server/client boundary.

---

# 21. Environment Configuration

Environment variables should be consumed through the configuration package.

Avoid:

```text id="m5q8v3"
process.env.SOME_VALUE
```

scattered throughout the codebase.

Prefer a centralized configuration layer that:

- Parses.
- Validates.
- Types.
- Classifies.

configuration values.

---

# 22. Public Configuration

Only explicitly public configuration may reach browser code.

Examples may include:

```text id="v7x3c5"
PUBLIC_APP_URL
PUBLIC_STORE_DOMAIN
```

depending on the final application design.

Secrets must remain server-only.

---

# 23. Database Package Usage

Application modules should obtain database access through the shared DB infrastructure.

Example:

```text id="k8m2x7"
import { db } from "@calcart/db";
```

Domain modules then use their own repository abstractions.

The database package must not become a global ORM access layer where every module freely queries every table.

---

# 24. Repository Ownership

Example:

```text id="c4n7m8"
modules/products/
    infrastructure/
        product-repository.ts
```

The Products module owns the Product repository.

The repository may use the shared DB package internally.

---

# 25. Domain Package Dependencies

Domain modules should not automatically depend on every shared package.

For example, Products may require:

```text id="a6p3m9"
db
validation
types
tenant
```

but should not depend on:

```text id="s8q4x2"
ui
```

unless the module has a legitimate presentation-layer integration.

---

# 26. Dependency Installation Rules

When adding a dependency:

1. Determine which package actually owns the dependency.
2. Install it there.
3. Avoid installing it at the workspace root unless it is truly repository-wide.
4. Avoid duplicate versions.
5. Update the lockfile.
6. Verify affected packages.

---

# 27. Runtime vs Development Dependencies

Dependencies must be placed correctly.

Runtime dependencies belong under:

```text id="y7n3v5"
dependencies
```

Build/test/tooling dependencies belong under:

```text id="m4c8x2"
devDependencies
```

Do not ship development-only tools in production runtime images.

---

# 28. Dependency Version Policy

The repository should avoid unnecessary version fragmentation.

Where multiple packages use the same dependency:

- Prefer a consistent version.
- Update intentionally.
- Verify compatibility.
- Avoid forced upgrades merely for cosmetic consistency.

---

# 29. Package Build Strategy

Packages should compile in a way compatible with the consuming application.

The Demo should avoid building a complicated independent artifact pipeline unless required.

Source-based workspace consumption is acceptable during development.

---

# 30. Package TypeScript Configuration

Each package should extend the repository TypeScript baseline where appropriate.

Example conceptual structure:

```text id="k2m9x5"
tsconfig.json
    ↓
shared/base config
    ↓
package-specific settings
```

Package-specific overrides should be minimal.

---

# 31. Package Exports

Use explicit package exports where supported.

Example:

```json id="x9c4m7"
{
  "exports": {
    ".": "./src/index.ts"
  }
}
```

Additional subpath exports should be introduced only when a public API genuinely requires them.

---

# 32. Domain Module Exports

Domain modules should expose public application contracts such as:

```text id="p7m3x8"
createProduct
getProduct
updateProduct
validatePurchasability
```

They should not expose:

```text id="f4c8n2"
ProductRepository
DatabaseTable
InternalDomainState
```

unless another architectural layer explicitly requires the interface.

---

# 33. API and Domain Separation

API DTOs should not automatically become domain entities.

For example:

```text id="v8m4c7"
CreateProductRequest
        ↓
Application Input
        ↓
Product Domain
```

This protects the domain from changes to the external HTTP contract.

---

# 34. Database and Domain Separation

Database records should not automatically become domain entities.

For example:

```text id="x5q8m3"
ProductRow
    ↓
Repository Mapping
    ↓
Product Domain Model
```

This prevents persistence concerns from leaking into business logic.

---

# 35. Event Package Boundary

The event infrastructure should provide technical mechanisms.

The owning module defines events such as:

```text id="n7c3m5"
ProductPublished
OrderCreated
PaymentSucceeded
```

The event package must not define the business meaning of those events.

---

# 36. UI Package Boundary

The UI package should provide reusable presentation primitives.

Feature-specific UI should remain in:

```text id="q4m8x7"
apps/web
```

unless it is genuinely reusable.

Avoid turning `packages/ui` into a dumping ground for every React component.

---

# 37. Testing Dependencies

Tests should use the same package boundaries as production where practical.

Unit tests may use:

- Pure functions.
- Test doubles.
- In-memory implementations.

Integration tests may use:

- PostgreSQL.
- Real repositories.
- Real application services.

---

# 38. Package-Level Testing

A package should be testable independently where useful.

For example:

```text id="m8v3c6"
packages/auth
    ↓
unit tests

packages/validation
    ↓
unit tests
```

Domain integration behavior belongs primarily in domain/module tests.

---

# 39. Circular Dependency Detection

The project should introduce automated dependency checks if circular imports become a realistic risk.

Do not add a dependency-analysis tool merely because it exists.

The initial architecture and TypeScript boundaries should prevent most violations.

---

# 40. Package Setup Verification

After package setup:

```text id="v5n9x3"
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

must succeed or clearly identify the remaining intentionally incomplete components.

---

# 41. Definition of Done

Package setup is complete when:

```text id="j6c4m8"
[ ] All shared packages have package.json files
[ ] All shared packages have TypeScript configuration
[ ] Public entry points exist
[ ] Workspace dependencies resolve
[ ] Package names are standardized
[ ] Dependency direction is defined
[ ] Circular dependencies are avoided
[ ] Web package resolves shared packages
[ ] Worker package resolves shared packages
[ ] Runtime/dev dependencies are classified correctly
[ ] Environment access is centralized
[ ] Database access is behind the DB package
[ ] Domain repositories remain module-owned
[ ] UI remains presentation-only
[ ] Package exports are explicit
[ ] TypeScript compilation works
[ ] Linting works
[ ] Tests work
[ ] Build works
```

---

# 42. Final Package Boundary Principle

The purpose of packages is not to create more folders.

The purpose is to make ownership and dependency direction obvious:

```text id="n4x7m2"
Shared Technical Capability
          ↓
Public Package API
          ↓
Domain Module
          ↓
Application Use Case
          ↓
Application / Worker
```

A package should exist because it represents a meaningful architectural boundary, not because the repository looked lonely.