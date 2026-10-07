# CLAUDE.md

## Instructions

This project follows the rules defined in `AGENTS.md`.

`AGENTS.md` is the canonical source of truth for:

- architecture
- security
- multi-tenancy
- database rules
- testing
- module boundaries
- AI development rules
- change discipline

Before starting any task, you MUST read the actual contents of the root `AGENTS.md` file using the available file-reading capabilities. Do not rely on memory, cached context, or assumptions about its contents.

## Before Coding

1. Inspect the relevant existing code.
2. Read the relevant `specs/` files.
3. Read relevant `docs/` files when working on architecture, security, database, or domain behavior.
4. Follow existing patterns and module boundaries.
5. Make the smallest correct change.

## During Coding

- Do not invent architecture when an existing pattern applies.
- Do not modify unrelated files.
- Do not bypass validation, authorization, tenant isolation, or tests.
- Do not introduce unnecessary dependencies or abstractions.
- Keep business logic inside the appropriate domain module.
- Preserve existing behavior unless the task explicitly requires changing it.

## Verification

Use `pnpm` as the package manager.

After implementation, run the relevant verification commands defined in `package.json`.

At minimum, run the applicable:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Do not claim a check passed unless it was actually executed.

## Changes Requiring Extra Care

Before making substantial changes to:

- architecture
- database schema
- authentication
- authorization
- tenant isolation
- payments
- inventory
- orders
- public APIs

explain the proposed approach and affected areas before implementation.

For architectural decisions, update `docs/decisions/`.

## Final Response

When completing a task, summarize:

1. What changed.
2. Files/modules affected.
3. Tests and verification performed.
4. Any known limitations or follow-up work.

Do not hide failed checks or unresolved issues.
