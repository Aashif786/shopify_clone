# Multi-Tenant Commerce Platform

A multi-tenant, Shopify-like commerce platform architected as a modular monolith. The system supports multiple independent merchant stores within organizations, with strict tenant isolation, concurrency-safe inventory and checkout flows, and clean domain boundaries.

---

## 1. Project Purpose

The purpose of this project is to build a real, functional multi-tenant commerce platform. The architecture is structured as a modular monolith to provide clear domain boundaries and maintainability with simple operational infrastructure, designed so that the initial demo implementation can evolve into production V1 without requiring a fundamental architectural rewrite.

---

## 2. Implementation Status & Demo Scope

### Current Implementation State (Foundation Phase)
The repository currently implements the **foundation phase**. The following components are active and verified:
- **Monorepo Workspace**: pnpm monorepo structure configuring `apps/*`, `packages/*`, and `modules/*`.
- **Shared TypeScript Baseline**: Root `tsconfig.json` enforcing strict TypeScript settings (`strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`), extended by all packages and applications.
- **Foundation Packages**:
  - `@shopify-clone/auth`: Context types and authentication contracts.
  - `@shopify-clone/config`: Environment configuration loader with fail-fast startup validation for required secrets (`DATABASE_URL`, `AUTH_SECRET`).
  - `@shopify-clone/db`: PostgreSQL pool, transactions, health checks, UUIDv7, and SQL migrations.
  - `@shopify-clone/event-bus`: In-memory domain event bus and dispatcher interfaces.
  - `@shopify-clone/tenant`: Multi-tenant and store isolation context models.
  - `@shopify-clone/types`: Shared utility types and standardized API response envelopes.
  - `@shopify-clone/ui`: Shared UI component primitives.
  - `@shopify-clone/validation`: Zod-based validation helpers and schemas.
- **Applications**:
  - `apps/web`: Next.js 15 application shell configured with App Router and transpilePackages.
  - `apps/worker`: Background worker bootstrap entry point.
- **Quality & CI Tooling**: ESLint 9 flat configuration, Prettier, Vitest test suite, `.editorconfig`, and GitHub Actions CI workflow.

### Upcoming Implementation Phases (Not Yet Implemented)
The following domain modules and infrastructure services are planned for subsequent phases and are **not yet implemented**:
- **Domain persistence**: Domain module repositories and remaining commerce tables.
- **Authentication**: User authentication, session management, and credential verification.
- **Tenant Isolation Runtime**: Server-side tenant isolation enforcement middleware and query scoping.
- **Domain Modules** (`modules/`): Business logic for `products`, `inventory`, `carts`, `discounts`, `checkout`, `orders`, `payments`, `customers`, and `stores`.
- **Worker Infrastructure**: Distributed job processing queue and asynchronous event consumers.
- **Deployment Pipelines**: Container packaging and production deployment automation.

### Demo Scope Target
The target for the Demo is a working commerce system demonstrating organization and store administration, product catalog management, concurrency-safe inventory tracking, cart and checkout flows, order placement, and simulated payment processing.

---

## 3. Technology Stack

- **Package Manager**: pnpm (`pnpm@12.9.1` via pnpm workspaces)
- **Language**: TypeScript 5.8+ (Strict mode enabled across all packages)
- **Web Framework**: Next.js 15 (App Router, React 19)
- **Runtime**: Node.js 20+
- **Database**: PostgreSQL (planned transactional source of truth)
- **Validation**: Zod 3.24+
- **Code Quality**: ESLint 9, Prettier 3
- **Testing**: Vitest 3
- **CI/CD**: GitHub Actions

---

## 4. Repository Structure

```text
shopify-clone/
├── apps/
│   ├── web/                  # Next.js web application (storefront / admin)
│   └── worker/               # Background worker entry point
├── packages/                 # Shared libraries and infrastructure contracts
│   ├── auth/                 # Auth context types and contracts
│   ├── config/               # Configuration loading & startup validation
│   ├── db/                   # Database client interfaces
│   ├── event-bus/            # In-memory domain event bus
│   ├── tenant/               # Multi-tenant context models
│   ├── types/                # Shared utility types and API envelopes
│   ├── ui/                   # Shared UI primitives
│   └── validation/           # Validation utilities
├── modules/                  # Domain business modules (upcoming implementation)
├── docs/                     # Architectural, engineering, and database documentation
├── specs/                    # Domain specifications and requirements
├── tests/                    # Monorepo foundation and integration tests
├── .github/workflows/        # GitHub Actions CI definitions
└── .editorconfig             # Editor formatting defaults
```

---

## 5. Prerequisites

- **Node.js**: `>= 20.0.0`
- **pnpm**: `>= 10.0.0` (Repository uses `pnpm@12.9.1`; enable with `corepack enable` if needed)
- **Git**

---

## 6. Installation

Clone the repository and install all dependencies using the lockfile:

```bash
git clone <repository-url>
cd shopify_clone
pnpm install --frozen-lockfile
```

---

## 7. Environment Setup

Copy the example environment configuration template:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Description | Default | Required for Server Startup |
|---|---|---|---|
| `NODE_ENV` | Application environment (`development`, `test`, `production`) | `development` | No |
| `PORT` | Web application port | `3000` | No |
| `APP_URL` | Base application URL | `http://localhost:3000` | No |
| `NEXT_PUBLIC_APP_URL` | Public application URL exposed to client | `http://localhost:3000` | No |
| `DATABASE_URL` | PostgreSQL connection string | - | **Yes** |
| `AUTH_SECRET` | Secret key used for signing authentication tokens | - | **Yes** |
| `JOB_POLL_INTERVAL` | Background worker polling interval (ms) | `5000` | No |
| `JOB_CONCURRENCY` | Background worker concurrent task limit | `4` | No |

*Note: Server startup fails fast if `DATABASE_URL` or `AUTH_SECRET` is missing or empty.*

---

## 8. Local Development

Start the Next.js web application in development mode:

```bash
pnpm dev
```

The web application will be available at `http://localhost:3000`.

To run the background worker (once configured with environment variables):

```bash
pnpm --filter @shopify-clone/worker dev
```

---

## 9. Database Startup & Requirements

- **Target Database**: PostgreSQL 16+.
- **Local database**: `docker compose up -d postgres`
- **Current State**: `@shopify-clone/db` provides a connection pool, `withTransaction`, health checks, UUIDv7 IDs, and a custom SQL migration runner with advisory locking. The foundation schema is `packages/db/migrations/0001_initial_identity.sql`.
- **Migration Command**:
  ```bash
  pnpm db:migrate
  ```
  Requires `DATABASE_URL`. Status: `pnpm db:migrate:status`.

---

## 10. Tests

Run the test suite using Vitest:

```bash
pnpm test
```

Unit tests do not require PostgreSQL. Database integration tests require `DATABASE_URL` pointing at an isolated PostgreSQL instance.

---

## 11. Typecheck, Lint, and Build

Execute quality and build checks across all packages in the workspace:

```bash
# Typecheck all packages and applications (tsc --noEmit)
pnpm typecheck

# Lint all files using ESLint flat config
pnpm lint

# Check formatting using Prettier
pnpm format:check

# Format code with Prettier
pnpm format

# Build all packages and applications (Next.js build + tsc)
pnpm build
```

---

## 12. Deployment Overview

- **Architecture**: Modular monolith with two deployable targets: `apps/web` (Next.js web application) and `apps/worker` (background worker process).
- **Current State**: Production deployments and container configurations are not yet implemented. Continuous Integration is enforced via GitHub Actions on pull requests and pushes to `main`.
- **Target Requirements**: Production deployments will require managed PostgreSQL, persistent environment variable injection (`DATABASE_URL`, `AUTH_SECRET`), and isolated network boundaries.

---

## 13. Documentation & Specifications

Authoritative documentation is located in `docs/` and `specs/`:

- **Engineering Rules & AI Guidance**: [`AGENTS.md`](./AGENTS.md)
- **Architecture**: [`docs/architecture/`](./docs/architecture/)
- **Engineering Conventions**:
  - Project Conventions: [`docs/engineering/project-conventions.md`](./docs/engineering/project-conventions.md)
  - Configuration Management: [`docs/engineering/configuration-management.md`](./docs/engineering/configuration-management.md)
  - Dependency Management: [`docs/engineering/dependency-management.md`](./docs/engineering/dependency-management.md)
- **Database Architecture**: [`docs/database/`](./docs/database/)
- **Security & Multi-Tenancy**: [`docs/security/`](./docs/security/)
- **Domain Specifications**: [`specs/`](./specs/) (`products`, `inventory`, `carts`, `discounts`, `checkout`, `orders`, `payments`, `stores`, `auth`, `customers`, `webhooks`)
