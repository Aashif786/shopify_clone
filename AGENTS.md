# AGENTS.md

## Project

Shopify-like, multi-tenant commerce platform.

Current target: **Demo**.

The Demo must be a real, functional system with simple infrastructure and a codebase that can evolve into V1 without a fundamental rewrite.

---

## Architecture

The Demo is a **modular monolith**.

```text
apps/web       → Next.js application
apps/worker    → background jobs
modules/       → domain/business logic
packages/      → shared libraries/infrastructure
specs/         → feature requirements
docs/          → project documentation
tests/         → automated tests
```

Rules:

- Keep business logic in `modules/`.
- Keep shared code in `packages/`.
- Keep API handlers thin.
- Do not duplicate business rules.
- Do not introduce microservices without an approved architectural decision.
- Do not add infrastructure for hypothetical requirements.
- Keep module dependencies explicit and one-directional.

### Module Boundaries

Modules must interact through their **public interfaces, application services, or defined events**.

Do not:

- import another module's internal implementation
- directly query another module's internal tables
- bypass another module's business rules
- create circular module dependencies

---

## Domain

Current modules:

`carts`, `checkout`, `customers`, `discounts`, `inventory`, `orders`, `payments`, `products`, `stores`

Each module owns its business rules.

Before modifying a module, read its relevant specification in `specs/` and relevant documentation in `docs/`.

---

## Multi-Tenancy

Tenant isolation is mandatory.

```text
Organization → Store → Membership/User → Store-owned data
```

Rules:

- Enforce tenant ownership server-side.
- Never trust client-provided tenant/store IDs.
- Scope protected queries to the authorized tenant.
- Never allow cross-tenant access.
- Preserve tenant context in workers and webhooks.
- Test tenant isolation.

---

## Security

Treat all external input as untrusted.

Never:

- commit secrets
- expose server secrets
- bypass authentication or authorization
- bypass tenant isolation
- trust client permissions
- log credentials or tokens
- disable security controls to make development easier

Validate inputs at system boundaries.

---

## Database

PostgreSQL is the transactional source of truth.

- Schema changes require migrations.
- Use constraints for important invariants.
- Use transactions where atomicity is required.
- Respect tenant boundaries in all queries.
- Never manually modify production schema.

Detailed database rules belong in `docs/database/`.

---

## Commerce

Treat these as critical:

`inventory`, `checkout`, `orders`, `payments`, `refunds`, `pricing`, `discounts`

Critical mutations must account for:

- transactions
- concurrency
- retries
- idempotency
- explicit state transitions

Payment and checkout mutations must support safe retries.

Inventory changes must be concurrency-safe.

The exact implementation strategy is defined in the relevant domain/database documentation.

---

## Testing & Verification

Testing is part of implementation.

- Unit test business logic.
- Integration test database, security, and module behavior.
- E2E test critical user journeys.
- Never remove or weaken tests merely to make CI pass.

### Standard Commands

Use **pnpm**. Do not substitute npm or yarn.

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:migrate
```

Only run commands that are defined by the repository's `package.json`.

Before completing a task:

1. Run relevant tests.
2. Run `pnpm typecheck`.
3. Run `pnpm lint`.
4. Run `pnpm build` when the change affects the application/build.
5. Report any checks that could not be run.

Do not claim a check passed unless it was actually run.

---

## AI Rules

AI agents are implementation assistants, not autonomous architects.

Before changing code:

1. Read this file.
2. Inspect existing code.
3. Read relevant specs/docs.
4. Follow existing patterns.
5. Make the smallest safe change.

Do not:

- invent architecture unnecessarily
- add unnecessary dependencies
- modify unrelated code
- silently change requirements
- remove tests
- bypass security
- expose secrets
- rewrite large areas without necessity

For significant architectural changes, explain the proposed change before implementation.

---

## Change Discipline

Before creating a new package, module, dependency, abstraction, service, or database structure, check whether an existing solution can be reused.

Prefer simple solutions over premature abstraction.

Do not implement hypothetical requirements.

Do not perform unrelated refactoring while implementing a feature.

---

## Documentation

```text
AGENTS.md → global AI/engineering rules
docs/     → how the system works
specs/    → what the system must do
modules/  → implementation
```

Keep documentation synchronized with significant architectural changes.

---

## Production Safety

Keep development, Demo, staging, and production separate.

Never use production credentials or databases for development.

AI agents must not have unrestricted production access.

Production changes require human approval.

---

## Definition of Done

A feature is complete when its relevant:

- implementation
- validation
- authorization
- tenant isolation
- tests
- error handling
- migrations
- documentation
- CI checks

are complete.

Follow the relevant specification for feature-specific requirements.

## Principle

Build a **real but deliberately small commerce platform**.

Prefer:

**correctness + security + simplicity + maintainability**

over premature complexity.