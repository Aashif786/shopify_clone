# Project Conventions

## 1. Purpose

This document defines the structural and day-to-day conventions used throughout the Cal Cart commerce platform.

The purpose is to make the repository predictable for developers and AI-assisted development while preserving the modular-monolith architecture.

These conventions apply to application code, domain modules, shared packages, tests, scripts, and documentation.

---

## 2. Repository Structure

The repository is organized as a pnpm monorepo.

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

### `apps/`

Contains deployable applications.

Current Demo applications:

```text
apps/web
apps/worker
```

- `web` owns the primary web application and API-facing presentation layer.
- `worker` executes asynchronous background jobs.

### `modules/`

Contains business-domain modules.

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

Each module owns its business rules and persistence concerns.

### `packages/`

Contains genuinely shared technical capabilities.

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

Shared packages must not become a dumping ground for business logic.

### `specs/`

Contains feature-level requirements and acceptance criteria.

### `tests/`

Contains cross-module integration and end-to-end tests that do not naturally belong inside a single module.

### `infrastructure/`

Contains local and deployment infrastructure configuration.

### `docs/`

Contains architecture, engineering, domain, security, database, deployment, and other project documentation.

---

## 3. Module Structure

Each domain module should have a consistent internal organization.

A module may use a structure similar to:

```text
modules/products/
├── application/
├── domain/
├── infrastructure/
├── api/
├── index.ts
└── ...
```

Not every module must contain every directory.

Directories should exist only when they provide a real architectural purpose.

### Recommended responsibilities

| Layer | Responsibility |
|---|---|
| `api/` | Request/response boundary |
| `application/` | Use cases and orchestration |
| `domain/` | Business rules and domain models |
| `infrastructure/` | Database and external integrations |
| `index.ts` | Public module interface |

The exact structure may evolve if the module remains internally coherent.

---

## 4. Module Public Interface

Each module should expose an intentional public interface.

Consumers should depend on:

```text
modules/<module>/index.ts
```

or another explicitly documented public entry point.

Consumers should not depend on internal implementation paths such as:

```text
modules/products/infrastructure/repositories/...
modules/orders/domain/internal/...
```

This preserves the ability to change internal implementation without breaking consumers.

---

## 5. Module Ownership

Every business concept must have a clear owner.

Examples:

| Concept | Owner |
|---|---|
| Product | Products |
| Product Variant | Products |
| Inventory Quantity | Inventory |
| Cart | Carts |
| Checkout | Checkout |
| Payment | Payments |
| Order | Orders |
| Customer | Customers |
| Discount | Discounts |
| Store | Stores |

If two modules appear to own the same concept, the boundary should be reviewed before implementation continues.

---

## 6. Cross-Module Dependencies

Cross-module communication should happen through:

- Public interfaces.
- Application services.
- Domain events.
- Explicit contracts.

Avoid direct access to another module's:

- Internal repositories.
- Internal services.
- Internal domain objects.
- Database tables.
- Private implementation files.

For example, Checkout may request inventory reservation through the Inventory interface.

Checkout must not directly modify Inventory tables.

---

## 7. Shared Packages

A capability belongs in `packages/` only when it is genuinely shared and technically appropriate for sharing.

Good candidates:

```text
authentication primitives
database infrastructure
validation utilities
tenant context
shared types
UI components
event infrastructure
configuration
```

Bad candidates:

```text
calculateOrderTotal()
applyDiscount()
reserveInventory()
createOrder()
```

These are business capabilities and belong to their respective modules.

---

## 8. Business Logic Placement

Use the following decision rule:

```text
Is this a business rule?
        │
       Yes
        ↓
Which domain owns it?
        ↓
Put it in that module.
```

Examples:

```text
Inventory reservation → modules/inventory
Discount eligibility → modules/discounts
Checkout completion → modules/checkout
Order cancellation → modules/orders
Payment capture → modules/payments
Product publication → modules/products
```

Generic helpers should only contain logic that is truly generic.

---

## 9. Database Access Convention

Database access belongs behind the appropriate module's infrastructure boundary.

Repositories or query implementations should not be imported across module boundaries.

The database package provides shared database infrastructure, not ownership of business data.

For example:

```text
packages/db
    ↓
database connection / transaction primitives

modules/orders
    ↓
Order persistence

modules/inventory
    ↓
Inventory persistence
```

`packages/db` must not become a global repository layer containing every business query.

---

## 10. API Route Organization

API endpoints should be organized around business capabilities.

Prefer:

```text
/stores
/products
/inventory
/customers
/carts
/checkout
/payments
/orders
```

rather than organizing the application around database tables alone.

API handlers should delegate to application services.

Avoid placing complex business workflows directly in route handlers.

---

## 11. DTO Conventions

External boundaries should use explicit DTOs.

For example:

```ts
type CreateProductInput = {
  name: string;
  description?: string;
  variants: CreateProductVariantInput[];
};
```

Do not pass raw request objects deep into domain code.

Map external input into application-level input.

Similarly, map domain/application results into response DTOs rather than returning persistence models directly.

---

## 12. Validation Conventions

Validation should occur as close as practical to the system boundary.

Typical flow:

```text
Request
  ↓
Schema validation
  ↓
Authentication
  ↓
Tenant resolution
  ↓
Authorization
  ↓
Application service
  ↓
Domain rules
```

Validation and authorization are separate responsibilities.

Valid input does not imply permission to perform the requested operation.

---

## 13. Tenant Context

Tenant/store context must be explicit in server-side application execution.

Typical request flow:

```text
Request
  ↓
Authenticate
  ↓
Resolve organization/store
  ↓
Verify membership/access
  ↓
Execute store-scoped operation
```

Do not depend on a client-provided store ID without verifying that the authenticated actor may access that store.

Background jobs and webhook handlers must establish tenant context through trusted persisted data rather than client state.

---

## 14. IDs

Use stable identifiers for persisted entities.

IDs should not encode business meaning unless there is a documented reason.

Prefer:

```text
internal entity ID
```

for relationships.

Business identifiers such as order numbers should be separate from internal database identifiers when both are required.

Example:

```text
Order ID:
8b8f...

Order Number:
ORD-2026-000123
```

---

## 15. Slugs and Human-Readable Identifiers

Slugs should be used where human-readable URLs are required.

Examples:

```text
/products/blue-running-shoes
/stores/example-store
```

Slugs must have clearly defined ownership and uniqueness scope.

For store-owned resources, uniqueness is normally store-scoped unless the feature explicitly requires global uniqueness.

---

## 16. Environment Variables

Environment variables should follow a consistent naming convention:

```text
DATABASE_URL
NEXT_PUBLIC_*
PAYMENT_PROVIDER_*
STORAGE_*
AUTH_*
```

Secrets must never be committed to source control.

`.env.example` should document required configuration without containing real secrets.

Environment-specific configuration belongs in the appropriate environment configuration mechanism.

---

## 17. Configuration Access

Application code should access configuration through the project's configuration layer rather than repeatedly reading `process.env` throughout business logic.

Prefer:

```ts
config.database.url
config.payment.provider
```

over:

```ts
process.env.DATABASE_URL
```

inside domain or application code.

This provides centralized validation and makes configuration behavior predictable.

---

## 18. Logging Conventions

Use structured logs.

Include identifiers that help trace operations:

```text
requestId
storeId
userId
checkoutId
orderId
paymentId
jobId
eventId
```

Do not log secrets or sensitive payment information.

Avoid using arbitrary `console.log` statements as permanent application observability.

Development-only debugging may use temporary logging but must be removed or replaced before completion.

---

## 19. Error Conventions

Errors should be classified according to their meaning.

Typical categories include:

```text
ValidationError
AuthenticationError
AuthorizationError
NotFoundError
ConflictError
BusinessRuleError
ExternalServiceError
InternalError
```

Domain-specific errors may extend or map into these categories.

Public API responses must use the documented error contract.

Internal implementation details must not leak through public error responses.

---

## 20. Events

Domain events should use clear past-tense names.

Examples:

```text
ProductPublished
InventoryReserved
CheckoutCompleted
PaymentCaptured
OrderCreated
OrderCancelled
```

Event payloads should contain enough information for consumers to process the event without exposing unnecessary internal state.

Events should remain stable once they are consumed by another component.

---

## 21. Background Jobs

Job names should describe work rather than events.

Examples:

```text
SendOrderConfirmationEmail
ProcessPaymentWebhook
ReleaseExpiredInventoryReservation
ReconcilePayment
```

Jobs should include enough context to execute independently.

Where appropriate, jobs should support:

- Retry.
- Idempotency.
- Failure tracking.
- Dead-letter or terminal failure handling.
- Observability.

---

## 22. Tests

Tests should be located according to scope.

### Module-local tests

Tests closely tied to one module should live with that module where practical.

Example:

```text
modules/inventory/
├── domain/
├── application/
└── ...
```

### Integration tests

Cross-module or database-backed tests belong under:

```text
tests/integration/
```

### End-to-end tests

Full user journeys belong under:

```text
tests/e2e/
```

Examples:

```text
merchant creates store
merchant creates product
customer adds product to cart
customer completes checkout
merchant views order
```

---

## 23. Test Naming

Test names should describe behavior.

Prefer:

```text
reserves inventory when sufficient stock exists
rejects reservation when stock is insufficient
prevents a customer from accessing another store's order
does not create duplicate orders on checkout retry
```

Avoid vague names:

```text
works
test1
handles error
should pass
```

---

## 24. Documentation References

When implementing a feature, developers should identify the relevant documentation before changing code.

Typical hierarchy:

```text
AGENTS.md
    ↓
Architecture docs
    ↓
Domain docs
    ↓
Feature specification
    ↓
Implementation
```

For example, an inventory change should normally consider:

```text
docs/architecture/module-boundaries.md
docs/database/concurrency-control.md
docs/domain/domain-model.md
specs/inventory/inventory-spec.md
```

The exact documents depend on the change.

---

## 25. Git Conventions

Branches should describe the work being performed.

Examples:

```text
feature/product-creation
feature/checkout-flow
fix/inventory-race
fix/payment-webhook
refactor/order-module
docs/api-contracts
```

Commits should describe the actual change.

Prefer:

```text
feat(products): add product creation flow
fix(inventory): prevent concurrent overselling
docs(api): define checkout error contract
```

Avoid meaningless commit messages such as:

```text
changes
update
fix stuff
final
latest
```

---

## 26. Pull Requests

Pull requests should remain focused.

A PR should normally contain:

- What changed.
- Why it changed.
- Relevant implementation details.
- Tests performed.
- Known limitations.
- Any migration or deployment considerations.

Unrelated refactoring should be separated unless required for the feature.

---

## 27. Documentation and Code Consistency

When behavior changes, relevant documentation must be updated.

Examples:

- API behavior changes → update API documentation.
- Domain behavior changes → update domain/spec documentation.
- Database schema changes → update database documentation.
- Architecture changes → update architecture/ADR documentation.
- Security behavior changes → update security documentation.

Documentation must describe the current system, not an intended future implementation.

---

## 28. AI Agent Conventions

AI agents must follow the repository's established conventions.

Before modifying code, an AI agent should:

1. Read the root `AGENTS.md`.
2. Read relevant architecture documentation.
3. Read the applicable feature specification.
4. Inspect the existing implementation.
5. Identify the owning module.
6. Follow existing naming and structural patterns.
7. Make the smallest appropriate change.
8. Update tests.
9. Run applicable verification commands.

AI agents must not:

- Invent new services without justification.
- Introduce unnecessary dependencies.
- Move files solely for stylistic reasons.
- Rewrite unrelated code.
- Modify unrelated modules.
- Bypass authorization or tenant checks.
- Disable tests or linting to make a change pass.
- Claim verification that was not performed.

---

## 29. Demo-Specific Conventions

The Demo intentionally favors simplicity where doing so does not compromise correctness.

Allowed simplifications include:

- PostgreSQL instead of a distributed database.
- A modular monolith instead of microservices.
- Basic PostgreSQL search instead of a dedicated search engine.
- Simple background processing instead of a distributed queue platform.
- Sandbox payment provider.
- Basic observability.
- Single-region deployment.

These simplifications must not compromise:

- Tenant isolation.
- Authorization.
- Database integrity.
- Inventory correctness.
- Payment correctness.
- Order correctness.
- Idempotency.
- Input validation.
- Security fundamentals.

---

## 30. Avoiding Premature Architecture

Do not add infrastructure merely because it may eventually be required by V1.

Examples of changes that require justification:

```text
Redis
Kafka
Elasticsearch
Kubernetes
Microservices
Service mesh
Distributed tracing infrastructure
Dedicated analytics warehouse
Complex workflow engine
```

The correct question is not:

> "Will Cal Cart eventually need this?"

The correct question is:

> "Does the current requirement justify this complexity?"

The architecture should preserve a clean path toward V1 without implementing V1 infrastructure prematurely.

---

## 31. Convention Priority

When conventions conflict, use this priority order:

1. Security and data integrity.
2. Explicit architectural decisions.
3. Domain ownership and business requirements.
4. Feature specifications.
5. Established project conventions.
6. General coding preferences.

A local convention must not override an explicit architectural or security requirement.

---

## 32. Definition of Done

A change following these conventions should leave the repository:

- Structurally consistent.
- Type-safe.
- Properly tested.
- Tenant-safe.
- Authorized.
- Documented where behavior changed.
- Free from unnecessary dependencies.
- Free from unrelated modifications.
- Verified using the applicable project checks.

Consistency is valuable because future developers, reviewers, and AI agents should be able to predict where code belongs and how it should behave without rediscovering the architecture every time.