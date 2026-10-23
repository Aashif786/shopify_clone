# Technical Debt & Codebase Maintainability Register

This document records architectural technical debt, deprecated patterns, and non-blocking refactoring targets across Cal Cart.

---

## 1. Technical Debt Inventory

| Ref | Domain / Package | Severity | Description | Recommended Remediation |
| :--- | :--- | :--- | :--- | :--- |
| **TD-01** | `packages/event-bus` | Low | Unimplemented interface contracts; packages/event-bus exports types without runtime dispatcher | Implement in-memory Node EventEmitter or transactional outbox pattern |
| **TD-02** | `apps/web/app/stores/[storeSlug]/collections` | Medium | Stub route that instantly redirects to `/products` without collection domain support | Introduce proper collection tagging or formalize redirect |
| **TD-03** | `apps/web/src/lib/api/validation.ts` | Medium | Monolithic 140KB validation file combining schemas for all modules | Split into modular domain validators (`auth.schema.ts`, `orders.schema.ts`) |
| **TD-04** | `apps/web/src/lib/api/openapi.ts` | Low | Static 130KB OpenAPI declaration embedded in TypeScript code | Generate from Zod schemas or maintain as external YAML/JSON spec |
| **TD-05** | `modules/orders` | Medium | Concatenation of carrier tracking details into string audit history | Migrate to structured fulfillment schema (`tracking_number`, `carrier`, `tracking_url`) |
| **TD-06** | `modules/stores` | Low | Store settings split across `stores` table columns and `store_settings` table | Consolidate store configuration into unified settings aggregate |

---

## 2. Refactoring Guidelines

- Do not perform broad architectural rewrites solely to remove technical debt.
- Refactor debt incrementally within targeted milestones when directly touching the affected module.
- Always preserve public API contracts and existing test coverage when addressing technical debt items.
