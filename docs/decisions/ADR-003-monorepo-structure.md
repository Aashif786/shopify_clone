# ADR-003: Monorepo Structure

## Status

**Accepted**

## Date

2026-10-07

---

# 1. Decision

The platform will use a **single monorepository** containing the applications, business modules, shared packages, specifications, tests, infrastructure, and architecture documentation required by the platform.

The repository will use **pnpm workspaces** for package management and dependency coordination.

The repository structure will remain organized by architectural responsibility rather than by deployment unit alone.

The initial structure is:

```text
calcart/
├── apps/
├── modules/
├── packages/
├── specs/
├── tests/
├── infrastructure/
└── docs/
```

---

# 2. Context

The platform is being developed as a modular monolith.

The Demo currently has two runtime applications:

```text
apps/
├── web/
└── worker/
```

At the same time, the system contains multiple business domains and shared technical capabilities.

Keeping these components in separate repositories would introduce unnecessary coordination overhead.

The project therefore needs:

- One source repository.
- Clear module boundaries.
- Shared dependency management.
- Shared TypeScript configuration.
- Shared testing infrastructure.
- Consistent tooling.
- Atomic changes across related components.
- Easy local development.
- A clear path toward future application/service separation.

A monorepo provides these capabilities without requiring multiple repositories.

---

# 3. Repository Structure

The repository is organized into the following major areas:

```text
apps/
    Runtime applications

modules/
    Business domain modules

packages/
    Shared technical capabilities

specs/
    Feature and domain requirements

tests/
    Cross-module and end-to-end tests

infrastructure/
    Deployment and operational configuration

docs/
    Architecture and engineering documentation
```

Each directory has a distinct purpose.

---

# 4. Applications

The `apps/` directory contains deployable runtime applications.

Current applications:

```text
apps/
├── web/
└── worker/
```

## Web

The web application handles:

- HTTP requests.
- Storefront interactions.
- Merchant interfaces.
- Authentication entry points.
- API/request handling.
- Response rendering.

The web application should remain thin and delegate business behavior to the appropriate modules.

## Worker

The worker handles:

- Background jobs.
- Asynchronous processing.
- Scheduled work.
- Webhook processing where appropriate.
- Retryable secondary operations.

The worker should reuse the same business modules rather than implementing duplicate business rules.

---

# 5. Business Modules

The `modules/` directory contains business capabilities.

```text
modules/
├── carts/
├── checkout/
├── customers/
├── discounts/
├── inventory/
├── orders/
├── payments/
├── products/
└── stores/
```

Modules are organized around business ownership.

For example:

```text
modules/products
```

owns product-domain behavior.

It does not merely represent a UI page or API route.

---

# 6. Shared Packages

The `packages/` directory contains reusable technical or cross-cutting capabilities.

Current packages include:

```text
packages/
├── auth/
├── config/
├── db/
├── event-bus/
├── tenant/
├── types/
├── ui/
└── validation/
```

Examples:

### `auth`

Authentication and identity-related infrastructure.

### `config`

Environment and application configuration.

### `db`

Database connectivity and shared database infrastructure.

### `event-bus`

Internal event infrastructure.

### `tenant`

Technical tenant-context handling.

### `types`

Carefully selected shared types.

### `ui`

Reusable interface components.

### `validation`

Shared validation infrastructure and schemas where genuinely reusable.

Shared packages must not become a dumping ground for arbitrary business logic.

---

# 7. Specifications

The `specs/` directory contains feature and domain requirements.

```text
specs/
├── checkout/
├── customers/
├── discounts/
├── inventory/
├── orders/
├── payments/
├── products/
├── storefront/
└── stores/
```

Specifications describe **what the system must do**.

Architecture documentation describes **how the system is structured**.

Implementation code describes **how the requirements are realized**.

These concerns should remain distinct.

---

# 8. Tests

The `tests/` directory contains tests that cross individual package or module boundaries.

```text
tests/
├── e2e/
└── integration/
```

Module-specific unit tests may live closer to the module implementation.

Cross-module behavior belongs in integration tests.

Complete user journeys belong in end-to-end tests.

Conceptually:

```text
Unit
  ↓
Module
  ↓
Integration
  ↓
End-to-End
```

---

# 9. Infrastructure

The `infrastructure/` directory contains operational configuration and scripts.

```text
infrastructure/
├── docker/
├── environments/
└── scripts/
```

This directory should contain infrastructure concerns rather than business logic.

Examples include:

- Docker configuration.
- Environment configuration templates.
- Deployment scripts.
- Operational scripts.

Future infrastructure may expand as requirements grow.

---

# 10. Documentation

The `docs/` directory contains project documentation organized by concern.

Examples include:

```text
docs/
├── ai/
├── api/
├── architecture/
├── database/
├── decisions/
├── deployment/
├── domain/
├── engineering/
├── infrastructure/
├── product/
├── security/
└── testing/
```

Documentation should remain close to the architectural concerns it describes.

The repository should not depend on undocumented architectural assumptions.

---

# 11. Package Management

The repository uses:

```text
pnpm
```

with workspace support.

The workspace allows related packages and applications to be developed together while maintaining explicit dependency relationships.

Conceptually:

```text
apps/web
    ↓
modules/*
    ↓
packages/*
```

and:

```text
apps/worker
    ↓
modules/*
    ↓
packages/*
```

The dependency graph must remain intentional.

---

# 12. Dependency Direction

The monorepo does not mean every package may import every other package.

Dependencies should follow architectural boundaries.

A simplified direction is:

```text
Applications
     ↓
Business Modules
     ↓
Shared Infrastructure Packages
     ↓
External Systems
```

Some cross-cutting packages may be used at multiple levels where appropriate.

Business modules should not depend on application-specific UI code.

The worker should not depend on web presentation code.

---

# 13. Module Dependencies

Modules may interact with other modules through public interfaces.

For example:

```text
Checkout
   ↓
Inventory Public Interface
```

rather than:

```text
Checkout
   ↓
Inventory Internal Repository
```

The repository structure must make these boundaries understandable to developers and AI coding tools.

---

# 14. Shared Package Rules

A package belongs in `packages/` when it provides genuinely reusable functionality.

Good candidates include:

- Database infrastructure.
- Authentication infrastructure.
- Validation utilities.
- Configuration.
- UI primitives.
- Technical event infrastructure.

Poor candidates include:

```text
packages/
├── order-helpers/
├── product-business-rules/
├── random-utils/
└── common-business-logic/
```

if they exist only to bypass module ownership.

Business logic should remain with the module that owns it.

---

# 15. Atomic Changes

One major advantage of the monorepo is the ability to make coordinated changes atomically.

For example, a feature may require changes to:

```text
specs/
modules/
packages/
apps/
tests/
```

These changes can be reviewed together.

This is particularly useful when implementing a feature that crosses multiple architectural boundaries.

---

# 16. Local Development

A developer should be able to clone the repository and work on the platform without manually coordinating multiple repositories.

The expected workflow is conceptually:

```text
Clone Repository
      ↓
Install Dependencies
      ↓
Configure Environment
      ↓
Start Required Services
      ↓
Run Web / Worker
      ↓
Run Tests
```

The exact commands are defined by the project's tooling and root configuration.

---

# 17. CI/CD

The monorepo should support centralized CI/CD.

Typical checks include:

```text
Lint
Typecheck
Tests
Build
Database Checks
```

CI should eventually become capable of determining which components changed and running the appropriate checks.

However, optimization should not compromise correctness.

A change affecting shared infrastructure or core modules may require broader validation.

---

# 18. Versioning

The Demo does not require independent versioning of every internal package.

Applications, modules, and packages evolve together as part of the platform.

Internal package versions do not need to behave like independently published public libraries.

If a package later becomes an independently consumed external product, its versioning strategy can be reconsidered.

---

# 19. Deployment

The monorepo does not require every repository component to be deployed independently.

For Demo:

```text
Repository
    │
    ├── Web deployment
    └── Worker deployment
```

Both deployments may use the same repository and release process.

This keeps deployment straightforward while preserving internal separation.

---

# 20. Future Application Separation

The monorepo intentionally does not prevent future runtime separation.

For example, V1 could eventually introduce:

```text
apps/
├── web/
├── storefront/
├── admin/
├── api/
└── worker/
```

The same repository can continue to contain these applications.

Runtime separation therefore does not require repository fragmentation.

---

# 21. Future Service Extraction

A business module may eventually become an independently deployed service.

For example:

```text
modules/payments
```

could later evolve toward:

```text
services/payments
```

or another service-oriented structure.

The extraction should preserve the module's conceptual ownership and public interfaces where practical.

The repository can continue to host the service during the transition.

---

# 22. Monorepo Does Not Mean Shared Everything

A common failure mode of monorepos is assuming that everything should be reusable.

That is not the goal.

The goal is:

```text
Shared Repository
      +
Explicit Ownership
      +
Controlled Dependencies
```

not:

```text
Shared Repository
      +
Everything Imports Everything
```

The latter would simply create a larger version of the same architectural problem the modular design is intended to prevent.

---

# 23. Code Ownership

As the team grows, ownership may be defined around:

- Applications.
- Modules.
- Packages.
- Infrastructure.

Ownership should follow business and technical boundaries.

Future CI configuration may enforce ownership through mechanisms such as repository ownership rules.

---

# 24. Change Discipline

A developer modifying one area should avoid unrelated changes.

For example, a product feature should not casually modify:

```text
payments/
inventory/
infrastructure/
```

unless the feature genuinely requires those changes.

This keeps reviews understandable and reduces accidental coupling.

---

# 25. Architectural Boundaries in a Monorepo

The repository structure itself is not sufficient to enforce architecture.

The project should progressively introduce automated checks where practical.

Potential checks include:

- Forbidden imports.
- Dependency direction validation.
- Module boundary validation.
- Package dependency restrictions.
- TypeScript project references where useful.
- Lint rules.

Automation should reinforce documented architecture rather than replace architectural reasoning.

---

# 26. Consequences

## Positive Consequences

### Easier Coordination

Related changes can be implemented and reviewed together.

### Shared Tooling

The platform can share:

- TypeScript configuration.
- Linting.
- Testing.
- Build tooling.
- CI configuration.

### Easier Local Development

Developers do not need multiple repositories to run the platform.

### Atomic Changes

Cross-module changes can be committed together.

### Future Flexibility

Runtime applications and services can later be separated without requiring repository fragmentation.

### Better Architectural Visibility

The repository structure clearly exposes the distinction between:

```text
Apps
Modules
Packages
Specs
Tests
Infrastructure
Documentation
```

---

# 27. Negative Consequences

## Larger Repository

The repository will grow as the platform grows.

## Dependency Management

The dependency graph can become complex if not controlled.

## CI Complexity

As the repository grows, CI may require smarter change detection.

## Boundary Enforcement

Developers can still create bad dependencies unless boundaries are actively enforced.

## Potential Build Coupling

Poorly configured shared packages can cause unrelated applications to rebuild unnecessarily.

These consequences are accepted.

---

# 28. Risks

## Risk 1: Shared Package Explosion

Too much code may be moved into packages.

### Mitigation

Require a clear reason for shared ownership.

---

## Risk 2: Circular Dependencies

Modules may begin depending on one another in both directions.

### Mitigation

Use explicit public interfaces and architecture review for new cross-module dependencies.

---

## Risk 3: Repository Becomes Difficult to Navigate

As the project grows, the structure may become overwhelming.

### Mitigation

Maintain clear directory ownership and documentation.

---

## Risk 4: CI Becomes Slow

A large repository may eventually make full validation expensive.

### Mitigation

Introduce intelligent affected-component checks while preserving required full validation for critical changes.

---

## Risk 5: False Sense of Isolation

A monorepo can make it appear that module boundaries exist even when code freely bypasses them.

### Mitigation

Combine:

- Directory conventions.
- Public interfaces.
- Code review.
- Dependency rules.
- Automated boundary checks.

---

# 29. Decision Rules

New top-level repository areas should have a clear architectural purpose.

Before adding a new package, ask:

1. Is this genuinely shared?
2. Does it belong to a business module instead?
3. Does it contain business logic?
4. Would sharing it create coupling?
5. Does another application actually need it?

Before adding a new application, ask:

1. Does it have a distinct runtime responsibility?
2. Does it need independent deployment?
3. Does it need a different runtime boundary?
4. Could the existing application reasonably own the responsibility?

Before creating a new repository, ask:

1. Is repository-level isolation actually required?
2. Is there a separate ownership boundary?
3. Is independent lifecycle management necessary?
4. Would a monorepo create a real problem?

Repository fragmentation should not be introduced merely because the project has grown.

---

# 30. When This ADR Should Be Revisited

This decision should be reconsidered if:

- Repository size becomes a significant operational problem.
- Independent ownership requires repository isolation.
- CI/CD constraints become materially limiting.
- Regulatory or security requirements require strict repository separation.
- Independent product lifecycles become necessary.
- A future organization structure makes a monorepo impractical.

Until then, the monorepo remains the preferred structure.

---

# 31. Related Decisions

This ADR is related to:

- `ADR-001-modular-monolith.md`
- `ADR-002-postgresql-source-of-truth.md`

Related architecture documents:

- `docs/architecture/application-architecture.md`
- `docs/architecture/module-boundaries.md`
- `docs/architecture/demo-to-v1-evolution.md`

---

# 32. Final Decision

The platform will use a **single monorepository** managed with pnpm workspaces.

The repository will maintain explicit separation between:

```text
Applications
Business Modules
Shared Packages
Specifications
Tests
Infrastructure
Documentation
```

The monorepo provides the coordination and development benefits required by the Demo while preserving enough architectural discipline to support future runtime and service separation.

> **One repository does not mean one giant codebase. It means one coordinated codebase with deliberate boundaries.**