# AGENTS.md

## 1. Project Overview

Cal Cart is a modern, multi-tenant modular commerce platform inspired by Shopify. It provides an end-to-end commerce system supporting both merchant self-service (store administration, catalog, orders, discounts, inventory, team management) and customer-facing storefronts (product catalog, search, filtering, cart management, checkout, and payment processing).

### Development Priorities

Prioritize engineering decisions in this order:

1. **Correctness and security**: Real authentication, strict authorization, tenant isolation, and cryptographic signature verification.
2. **Functional end-to-end workflows**: Complete user journeys with real database records, genuine API integrations, and accurate state transitions.
3. **Tenant isolation and data integrity**: Guaranteed multi-tenant boundaries and concurrency-safe data operations.
4. **Clear, consistent, premium user experience**: Modern, polished UI/UX adhering to verified design systems and motion standards.
5. **Maintainability and future extensibility**: Modular code organization, strong typing, clean interfaces, and comprehensive tests.

Visual completeness must never substitute for functional completeness. Do not fabricate metrics, mock data, or fake successful payments. Every implemented feature must connect to real backend APIs and database operations.

---

## 2. Architecture and Module Boundaries

Cal Cart is designed as a **modular monolith** with clean layer separation:

```text
apps/
  web/         → Next.js 15 (App Router) web application (storefront and merchant admin)
  worker/      → Background jobs, asynchronous processing, and event workers
modules/       → Domain business logic and services
  carts/       → Cart persistence, item management, and session handling
  checkout/    → Checkout sessions, line item pricing, and address management
  customers/   → Customer accounts, profiles, and order history
  discounts/   → Discount codes, rule engines, and price adjustments
  inventory/   → Concurrency-safe inventory tracking and stock reservations
  orders/      → Order lifecycle, line items, fulfillments, and status tracking
  payments/    → Razorpay integration, payment intents, signatures, and reconciliation
  products/    → Products, variants, options, and collections
  stores/      → Store settings, tenant configuration, and staff access
packages/      → Shared packages and foundational libraries
  auth/        → Authentication strategies and session utilities
  config/      → Shared environment configuration and validation
  db/          → Prisma client, PostgreSQL schema, migrations, and seed scripts
  email/       → Transactional email templates and delivery services
  event-bus/   → In-process domain event publishing and subscription
  tenant/      → Tenant context resolution, scoping, and middleware helpers
  types/       → Shared TypeScript definitions and domain models
  ui/          → Shared React component library
  validation/  → Zod schemas and request validation helpers
specs/         → Feature specifications and domain requirements
docs/          → System documentation, architecture records, and database guides
tests/         → Automated unit, integration, and end-to-end test suites
```

### Architectural Rules

- **Keep business logic in `modules/`**: Application services, domain models, and business calculations belong in modules.
- **Keep shared infrastructure in `packages/`**: Reusable utilities, database access, configuration, and shared types belong in packages.
- **Keep API handlers thin**: Next.js route handlers (`apps/web/app/api/...`) parse/validate inputs, resolve auth/tenant context, delegate execution to module services, and format HTTP responses.
- **Enforce module encapsulation**: Modules interact exclusively through public service interfaces or defined domain events.
  - Never import another module's internal implementation details.
  - Never directly query or mutate another module's internal database tables.
  - Never bypass another module's business validation rules.
  - Maintain explicit, unidirectional module dependencies; circular dependencies are prohibited.
- **No premature microservices**: Maintain modular monolithic boundaries without introducing microservices or unnecessary distributed infrastructure.

---

## 3. Security and Multi-Tenancy

Tenant isolation is mandatory across the platform.

```text
Organization → Organization Members → Stores → Store Members → Store-Owned Data
```

### Authorization and Access Control

- **Server-Side Authorization**: Derive tenant ownership, store membership, and permissions exclusively on the server from trusted session credentials and persisted database records. Never trust client-provided tenant or store IDs.
- **Query Scoping**: Scope all protected database queries and mutations to the authenticated organization and store ID.
- **Role-Based Permissions**: Respect distinct organization roles (`owner`, `admin`, `member`) and store roles. Organization membership does not confer automatic authorization for every store operation, and store membership never grants organization administration privileges.
- **Platform Administration**: Platform super-admin capabilities (e.g. `users.is_platform_admin`) must enforce separate server-side checks and must never weaken or bypass standard tenant isolation logic.
- **Preserve Context**: Maintain tenant context across asynchronous workers, event subscribers, background jobs, and webhook handlers.
- **Zero Secrets in Code**: Never commit secrets, credentials, or API keys. Never expose server environment variables to client bundles.
- **Input Validation**: Treat all external inputs as untrusted. Validate inputs at system boundaries using schemas from `@shopify-clone/validation`.

---

## 4. Commerce and Payments

Critical commerce domains: `inventory`, `checkout`, `orders`, `payments`, `refunds`, `pricing`, `discounts`.

### Transactional Guarantees and Concurrency

- **Database Transactions**: Execute multi-step mutations (e.g., checkout completion, order placement, stock allocation) within database transactions to preserve atomicity and consistency.
- **Concurrency-Safe Inventory**: Prevent race conditions and overselling with concurrency-safe stock decrement and reservation logic.
- **Idempotency**: Protect payment creation, checkout submission, and webhook processing with idempotency keys and state checks to prevent duplicate charges or orders.
- **Explicit State Transitions**: Enforce valid order and payment state machine transitions (e.g., `pending` → `authorized` → `captured` → `fulfilled`). Disallow out-of-order or invalid transitions.

### Razorpay Integration

- Complete payment workflows using the official server-side Razorpay SDK and client checkout integration.
- Verify payment signatures cryptographically using HMAC-SHA256 and the shared key secret before confirming any transaction.
- Preserve and support server-side webhook processing and payment recovery/reconciliation for asynchronous payment confirmation.
- Never report payment or order success on the frontend without verified confirmation from the backend workflow.

---

## 5. UI/UX and Mandatory Design Skills

### Mandatory Frontend Design Skills Rule

> [!IMPORTANT]
> **Every UI-related task and prompt must actively inspect and apply the relevant installed frontend design skills and UI components.** Future AI agents must follow this rule automatically without requiring user reminders.

Before beginning any frontend or UI engineering work, agents must inspect the installed skill files in `.agents/skills/` and follow their specific instructions. Select the skills relevant to the task:

#### 1. Installed Design & Engineering Skills (`.agents/skills/`)
- `design-taste-frontend`: Senior UI/UX engineering, metric-based visual hierarchy, typography, high-density layouts, layout contrast, avoiding generic template aesthetics.
- `emil-design-eng`: UI polish, interaction states, tactile micro-interactions, spring curves, and the details that make software feel high-grade.
- `animate`: Decision workflow for purposeful web animations, curve and duration selection, interruptible transitions.
- `animation-performance`: 60fps frame budget, composite-only properties (`transform`, `opacity`), avoiding layout thrashing, CSS vs. WAAPI vs. Framer Motion.
- `animation-vocabulary`: Precise naming and implementation of motion effects and interaction patterns.
- `find-animation-opportunities`: Identifying places where purposeful motion elevates user experience.
- `improve-animations`: Auditing, prioritizing, and systematically fixing motion and transition issues.
- `review-animations`: Critiquing existing animations, timing curves, and interaction delays.
- `animate-expo`: React Native/Expo animation patterns (applicable if mobile/Expo surfaces are addressed).

*(Note: The `magic-ui` skill is not installed in `.agents/skills`. Do not claim it is installed or invent instructions for it.)*

#### 2. Verified UI Components & Foundation
- **UI Stack**: Next.js 15 (App Router), React 19, Tailwind CSS v4, Lucide icons, Framer Motion.
- **Component Libraries**: shadcn/ui primitives in `apps/web/src/components/ui/` and shared components in `packages/ui/`.
- **Installed Magic UI Components**: The following verified Magic UI components are available in `apps/web/src/components/ui/`:
  - `marquee.tsx`: Infinite scrolling marquee for logos, announcements, and featured items.
  - `number-ticker.tsx`: Smooth animated number counters for metrics, prices, and stats.
  - `shimmer-button.tsx`: Premium interactive call-to-action button with animated shimmer effects.

#### 3. Ten-Step Mandatory UI Workflow
When designing or modifying user interfaces:
1. **Analyze Requirements & Persona**: Understand the workflow (merchant density vs. storefront conversion).
2. **Inspect Installed Skills**: Check `.agents/skills/` for relevant guidance.
3. **Select Applicable Skills**: Actively engage `design-taste-frontend`, `emil-design-eng`, or specific animation skills.
4. **Read Skill Instructions**: Follow the design rules and principles defined in the skill files.
5. **Inspect Existing UI Primitives**: Reuse components in `packages/ui` and `apps/web/src/components/ui/`.
6. **Plan Visual Hierarchy & Layout**: Define typography, high-density tables/cards, spacing, and interaction states.
7. **Implement Component Architecture**: Compose clean, modular, accessible React components using Tailwind CSS and verified UI primitives.
8. **Ensure Responsiveness & Theming**: Support mobile, tablet, and desktop layouts with robust light and dark mode styling.
9. **Verify Interactive States**: Implement complete hover, active, focus, loading skeletons, empty states, and validation error messages.
10. **Preserve Functional Integrity**: Keep all backend API connections, auth headers, forms, filters, and business logic fully intact.

#### 4. UI Redesigns vs. Functional Preservation
- Complete UI redesigns of storefronts, merchant dashboards, landing pages, or checkout flows are fully permitted and encouraged when requested by the user.
- Agents are not restricted to minor styling tweaks; they may rebuild layouts, replace card patterns, update navigation, and modernize design aesthetics.
- However, redesigns must never break backend integrations, API contracts, validations, tenant isolation, or payment correctness.

---

## 6. Implementation Workflow

AI agents are implementation assistants, not autonomous architects. Follow this disciplined workflow:

### Pre-Implementation Checklist
1. **Inspect Git Status**: Run `git status` to verify working branch state and untracked files.
2. **Inspect Code & Tests**: Review existing implementations, tests, and component patterns before making changes.
3. **Review Specs & Docs**: Consult `specs/` and `docs/` for business rules and API contracts.
4. **Verify Boundaries**: Ensure planned changes respect module boundaries and tenant isolation.
5. **Formulate Minimal Safe Plan**: Select the smallest, cleanest implementation that achieves the user's objective.

### Scope Discipline
- Implement one defined milestone or task at a time.
- Avoid combining unrelated refactors into a single change.
- Never silently expand scope or modify files outside the task requirements.
- Reuse existing packages, services, utilities, and components before introducing new ones.
- Stop and report material ambiguity, architectural conflicts, or security concerns rather than guessing.

---

## 7. Testing and Verification

Verification is mandatory for all code modifications and must be proportional to the risk and scope of the change.

### Verification Commands (`package.json`)
Use `pnpm` exclusively for running scripts:

- `pnpm typecheck`: Run TypeScript typechecking across all workspaces (`pnpm -r run typecheck`).
- `pnpm test`: Run unit and integration tests with Vitest (`vitest run --passWithNoTests`).
- `pnpm lint`: Run ESLint across the codebase (`eslint .`).
- `pnpm build`: Build all applications and packages (`pnpm -r run build`).
- `pnpm test:e2e`: Run Playwright end-to-end test suite (`playwright test`).
- `pnpm db:migrate:status`: Verify Prisma database migration status.

### Verification Rules
- Run `pnpm typecheck` whenever TypeScript code, types, or module contracts are modified.
- Run `pnpm lint` when code changes could affect formatting or lint rules.
- Run `pnpm test` (or targeted Vitest runs) whenever business logic, services, utilities, or API routes are modified.
- Run `pnpm build` when changing shared packages, configuration, build setup, or web layouts.
- For payments, checkout, inventory, and tenant isolation changes, run the relevant integration and critical-path tests.
- For documentation-only changes, skip the full test suite.
- **Honest Completion Reporting**:
  - Always report the exact commands executed and their output/status.
  - Report failures and any checks that could not be run.
  - Never claim a check passed unless it ran and succeeded in the environment.
  - Never weaken, bypass, or delete tests to force verification to pass.

---

## 8. Documentation

Cal Cart maintains structured documentation across four distinct tiers:

```text
AGENTS.md → Global engineering rules, design requirements, and agent instructions
docs/     → Architecture guides, database design, payment flows, and technical references
specs/    → Feature requirements, domain rules, and acceptance criteria
modules/  → Domain-specific READMEs and module contracts
```

- Keep documentation synchronized with meaningful architectural or schema changes.
- Read existing documentation before creating new files.
- Do not create redundant documentation or ad-hoc planning files when existing documents serve the purpose.

---

## 9. Git Safety

Maintain strict change discipline in Git:

- Always inspect `git status` before and after modifying files.
- Modify only the files required for the assigned task. Preserve unrelated user changes.
- **Never use `git add .` or `git add -A`**. Stage only specific task-related files explicitly.
- Never commit secrets, credentials, or environment files (`.env`, `.env.local`).
- Review `git diff` before completing any change to ensure no accidental edits exist.
- **Do not commit unless explicitly instructed by the user.** When instructed, use the exact commit message requested and report the resulting commit hash.
- **Never push (`git push`) or deploy** unless explicitly authorized by the user.
