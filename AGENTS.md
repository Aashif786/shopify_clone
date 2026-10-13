# AGENTS.md

## Project

Shopify Clone is a Shopify-like, multi-tenant commerce platform.

**Current target: Demo.**

The Demo must be a real, functional commerce system with simple infrastructure and a codebase that can evolve into V1 without a fundamental rewrite.

### Development Priorities

Prioritize in this order:

1. Correctness and security.
2. Functional end-to-end workflows.
3. Tenant isolation and data integrity.
4. Clear, consistent user experience.
5. Maintainability and future extensibility.
6. Additional features and infrastructure only when justified.

Do not build V1 infrastructure or hypothetical features merely because they might be useful later.

A Demo feature must use real business logic and actual API integrations wherever the capability is implemented. Visual completeness must not be confused with functional completeness.

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
- Reuse existing services, packages, utilities, and abstractions where appropriate.

### Module Boundaries

Modules must interact through their public interfaces, application services, or defined events.

Do not:

- Import another module's internal implementation.
- Directly query another module's internal tables.
- Bypass another module's business rules.
- Create circular module dependencies.

Before changing a module, inspect its existing implementation, relevant specification in `specs/`, and documentation in `docs/`.

---

## Domain

Current modules:

`carts`, `checkout`, `customers`, `discounts`, `inventory`, `orders`, `payments`, `products`, `stores`

Each module owns its business rules.

Do not create a new module, package, service, or abstraction when an existing solution can safely support the requirement.

Treat refunds, organization administration, fulfillment, and platform operations as separate capabilities whose implementation status must be verified before use.

---

## Multi-Tenancy and Merchant Self-Service

Tenant isolation is mandatory.

```text
Organization → Organization Members → Stores → Store Members → Store-owned data
```

The organization and store membership models have distinct responsibilities.

### Organization-Level Responsibilities

Subject to implemented APIs and authorization rules, organization owners and authorized administrators may manage:

- Organization details.
- Organization membership.
- Access to stores within the organization.
- Organization-level settings.

### Store-Level Responsibilities

Subject to store membership and role permissions, store owners and authorized staff may manage:

- Products and variants.
- Inventory.
- Orders and fulfillment.
- Customers.
- Discounts.
- Store settings.
- Store team membership.

### Security Rules

- Enforce tenant ownership and authorization server-side.
- Never trust client-provided tenant or store IDs.
- Scope protected queries to authorized organizations and stores.
- Never allow unauthorized cross-tenant access.
- Preserve tenant context in workers and webhooks.
- Test tenant isolation and role boundaries.
- Do not treat organization membership as automatic authorization for every store operation.
- Do not treat store membership as organization administration permission.
- Preserve existing owner protections and role restrictions.

### Platform Administration

A full Super Admin dashboard is not a prerequisite for the Demo.

Do not introduce a platform administrator role, database migration, or cross-tenant administrative API solely to create a dashboard.

Implement platform-level operational access only when an explicit requirement justifies it. Such access must use separate server-side authorization and must not weaken ordinary tenant isolation.

---

## UI and User Experience

The Demo uses the existing Next.js application and shared UI foundation.

### UI Rules

- Inspect and reuse `packages/ui`, shared components, design tokens, and existing layouts before adding dependencies.
- Follow the repository's installed React, Next.js, CSS, and component-library versions.
- Maintain consistent navigation, typography, spacing, forms, tables, dialogs, badges, and status indicators.
- Prefer responsive, accessible, reusable components.
- Keep presentation components separate from API access and business logic.
- Do not introduce a new UI framework without demonstrating a concrete need.
- Do not replace working pages merely to match a template.
- Do not perform large visual rewrites unrelated to the current task.

### Functional UI

- Connect implemented features to real backend APIs.
- Use the existing API client, authentication, and tenant context.
- Provide loading, empty, validation, error, and success states as appropriate.
- Never fabricate successful API responses or payment outcomes.
- Do not present mock data as real merchant or customer data.
- Mark incomplete capabilities honestly.
- Do not make a feature appear functional when its required backend operation is missing.

The UI may be visually complete before every workflow is implemented, but the distinction must remain clear.

---

## Security

Treat all external input as untrusted.

Never:

- Commit secrets.
- Expose server secrets.
- Bypass authentication or authorization.
- Bypass tenant isolation.
- Trust client-side permissions.
- Log credentials or tokens.
- Disable security controls to make development easier.
- Allow users to assign themselves privileged roles.

Validate inputs at system boundaries.

Authorization must be derived from trusted server-side identity, persisted permissions, and the relevant resource context.

---

## Database

PostgreSQL is the transactional source of truth.

- Schema changes require migrations.
- Use constraints for important invariants.
- Use transactions where atomicity is required.
- Respect tenant boundaries in all queries.
- Never manually modify production schema.
- Preserve compatibility with existing data and migrations.
- Avoid destructive schema changes without an explicit requirement and migration plan.

Detailed database rules belong in `docs/database/`.

---

## Commerce and Payments

Treat these as critical:

`inventory`, `checkout`, `orders`, `payments`, `refunds`, `pricing`, `discounts`

Critical mutations must account for:

- Transactions.
- Concurrency.
- Retries.
- Idempotency.
- Explicit state transitions.
- Authorization and tenant ownership.

Payment and checkout mutations must support safe retries.

Inventory changes must be concurrency-safe.

Preserve existing Razorpay integration, signature verification, webhook handling, and payment recovery behavior when modifying adjacent UI or APIs.

Do not duplicate existing payment implementations. Inspect the current code and complete or correct the existing integration where appropriate.

Never report payment success unless confirmed by the trusted backend workflow.

The exact implementation strategy is defined in the relevant domain and database documentation.

---

## Implementation Workflow

AI agents are implementation assistants, not autonomous architects.

Before changing code:

1. Read this file and relevant nested `AGENTS.md` files.
2. Inspect the current Git status.
3. Inspect existing code and tests.
4. Read relevant specifications and documentation.
5. Verify API contracts and existing implementation status.
6. Identify the smallest safe implementation.
7. Explain significant architectural changes before implementing them.

### Scope Discipline

- Implement one defined milestone or task at a time.
- Avoid combining unrelated features into a single change.
- Do not silently expand scope.
- Do not rewrite working modules without necessity.
- Do not invent missing API contracts or assume undocumented behavior.
- If a dependency or required capability is missing, identify the gap before implementing a workaround.
- Reuse existing patterns and dependencies.
- Stop and report material ambiguity or security conflicts instead of guessing.

### Demo Versus V1

For Demo implementation:

- Prefer a working, end-to-end implementation over broad but incomplete feature coverage.
- Keep infrastructure simple.
- Defer nonessential production infrastructure.
- Preserve the architectural boundaries needed for future V1 development.
- Avoid premature abstractions and hypothetical scalability work.

Do not compromise security, tenant isolation, payment correctness, or data integrity to meet demo deadlines.

---

## Git and Change Discipline

Before modifying files, inspect `git status`.

During implementation:

- Modify only files required for the current task.
- Preserve unrelated user changes.
- Never overwrite local configuration or environment files without explicit authorization.
- Never commit secrets or local environment credentials.
- Review `git diff` before completing the task.
- Report uncommitted changes and relevant side effects.

When a task explicitly requests a commit:

- Stage only task-related files.
- Use the exact commit message requested by the task.
- Report the actual commit hash.
- Do not claim a commit was created unless it exists.

Do not create unnecessary commits when none were requested.

---
## Testing and Verification

Testing is part of implementation. Verification must be proportional to the scope and risk of the change.

### Rules

- Run tests relevant to the changed code and affected workflows.
- Run `pnpm typecheck` when TypeScript or type contracts are affected.
- Run `pnpm lint` when code changes could introduce lint issues.
- Run `pnpm build` when application code, shared packages, dependencies, configuration, or build behavior may be affected.
- For database, authorization, tenant isolation, payments, checkout, and inventory changes, run the relevant integration, security, and critical-path tests.
- For documentation-only changes, do not run the full application test suite unless the documentation change affects generated artifacts or executable configuration.
- Run the full test suite and build for major milestones, release candidates, or changes with broad impact.
- Use only commands defined by the repository's `package.json`. Use `pnpm`.

### Completion Report

Before completing a task:

1. Inspect `git diff` and `git status`.
2. Report the checks actually executed and their results.
3. Report failures and checks that could not be run.
4. Briefly explain any skipped verification that would normally be relevant to the change.

Never claim a check passed unless it actually ran successfully. Never remove or weaken tests merely to make verification pass.
## Documentation

```text
AGENTS.md → global AI/engineering rules
docs/     → how the system works
specs/    → what the system must do
modules/  → implementation
```

Keep documentation synchronized with significant architectural changes.

Read existing documentation before creating new documents.

Do not generate redundant documentation or planning files when existing documents already serve the purpose.

---

## Production Safety

Keep development, Demo, staging, and production separate.

- Never use production credentials or databases for development.
- AI agents must not have unrestricted production access.
- Production changes require human approval.
- Do not run destructive commands against shared or production environments without explicit authorization.

---

## Definition of Done

A feature is complete when its relevant requirements are satisfied:

- Implementation.
- Input validation.
- Authentication and authorization.
- Tenant isolation.
- Error handling.
- Tests.
- Migrations, where required.
- Documentation, where required.
- Relevant verification checks.

Follow the applicable feature specification for additional requirements.

A UI shell, placeholder card, or planned-feature badge does not constitute a completed business workflow.

---

## Principle

Build a **real but deliberately small commerce platform**.

Prefer:

**Correctness + security + simplicity + maintainability + working user journeys**

over premature complexity, unnecessary infrastructure, and superficial feature completeness.