# Coding Standards

## 1. Purpose

This document defines the coding standards for the Shopify-like commerce platform.

The standards apply to all application code, domain modules, shared packages, workers, tests, scripts, and supporting infrastructure code.

The goals are:

- Keep code predictable and easy to review.
- Preserve module boundaries.
- Make business logic explicit and testable.
- Prevent accidental coupling.
- Reduce implementation differences between developers and AI coding agents.
- Keep the Demo architecture suitable for evolution toward V1.

These standards complement `AGENTS.md` and the detailed architecture and domain documentation under `docs/`.

---

## 2. General Principles

Code should follow these principles:

1. Prefer clarity over cleverness.
2. Prefer explicit behavior over implicit behavior.
3. Keep functions and classes focused on one responsibility.
4. Keep business rules close to the domain that owns them.
5. Keep infrastructure concerns out of domain logic.
6. Validate external input at system boundaries.
7. Never trust client-provided authorization, pricing, inventory, payment, or tenant information.
8. Prefer existing project patterns over introducing new abstractions.
9. Avoid abstractions that have only one meaningful implementation unless they provide a clear boundary.
10. Keep changes narrowly scoped to the requested task.

Code should be understandable by another developer without requiring knowledge of the original implementation process.

---

## 3. TypeScript Standards

The project uses TypeScript as the primary application language.

### 3.1 Type Safety

Use strict TypeScript configuration.

Avoid:

```ts
any
```

unless there is a documented and justified boundary where no safer type is practical.

Prefer:

```ts
unknown
```

when the type of external data is not known.

Narrow unknown values explicitly before use.

### 3.2 Explicit Types

Use explicit types for:

- Public function parameters.
- Public function return values.
- Module interfaces.
- Application service contracts.
- API DTOs.
- Event payloads.
- External integration contracts.

Local variables may rely on inference when the inferred type is obvious.

Prefer:

```ts
function createProduct(input: CreateProductInput): Promise<Product> {
  // ...
}
```

over relying on implicit public contracts.

### 3.3 Type Aliases and Interfaces

Use types or interfaces based on the purpose of the abstraction.

Prefer domain-specific types for important concepts:

```ts
type StoreId = string;
type ProductId = string;
type OrderId = string;
```

Avoid representing important domain concepts with ambiguous primitive values when doing so would make incorrect usage easy.

---

## 4. Naming Conventions

Names must describe intent.

### Files

Use lowercase kebab-case for general files:

```text
product-service.ts
order-repository.ts
create-checkout.ts
```

Tests should clearly identify the subject:

```text
product-service.test.ts
checkout-service.integration.test.ts
checkout.e2e.spec.ts
```

### Variables and Functions

Use camelCase:

```ts
const productId = ...
const availableQuantity = ...

createProduct()
reserveInventory()
calculateOrderTotal()
```

### Types

Use PascalCase:

```ts
Product
ProductVariant
CreateProductInput
OrderStatus
PaymentAttempt
```

### Constants

Use descriptive names.

For module-level immutable constants:

```ts
const MAX_CART_ITEM_QUANTITY = 100;
```

Avoid unexplained constants:

```ts
const MAX = 100;
```

### Boolean Names

Boolean values should read naturally:

```ts
isActive
hasInventory
canCheckout
shouldRetry
isAuthorized
```

Avoid ambiguous names such as:

```ts
active
valid
check
flag
```

---

## 5. Functions

Functions should have one clear responsibility.

Prefer:

```ts
validateCheckout()
calculateCheckoutTotals()
reserveInventory()
createPaymentAttempt()
```

over large functions that perform unrelated operations.

Avoid deeply nested control flow.

Prefer early validation and explicit failure handling:

```ts
if (!store) {
  throw new StoreNotFoundError(storeId);
}

if (!store.isActive) {
  throw new StoreInactiveError(store.id);
}
```

rather than deeply nesting the entire function.

### Function Size

There is no arbitrary maximum line count.

However, a function should be reconsidered when:

- It performs multiple unrelated responsibilities.
- It contains several nested branches.
- It manages multiple transaction stages.
- It mixes business logic with HTTP, database, and external API concerns.
- It becomes difficult to test independently.

---

## 6. Domain Code

Domain logic belongs in the module that owns the corresponding business capability.

Examples:

```text
modules/products/
modules/inventory/
modules/checkout/
modules/orders/
```

Do not place commerce rules in generic utility packages merely because they are reusable.

For example, inventory reservation logic belongs to the Inventory module, not:

```text
packages/utils/
packages/helpers/
```

A module should expose intentional public interfaces rather than allowing consumers to depend on internal implementation details.

---

## 7. Application Services

Application services coordinate use cases.

They may:

- Validate application-level preconditions.
- Resolve tenant context.
- Call domain operations.
- Coordinate multiple domain modules through public interfaces.
- Start and manage database transactions.
- Publish domain events.
- Schedule background work.
- Coordinate external integrations.

They should not become dumping grounds for every business rule.

For example:

```text
Checkout application service
    ↓
validate checkout
    ↓
calculate final pricing
    ↓
reserve inventory
    ↓
coordinate payment
    ↓
create order
    ↓
publish resulting events
```

The individual business rules should remain owned by their respective domains.

---

## 8. API and Presentation Code

API handlers, route handlers, server actions, and controllers should remain thin.

They should primarily:

1. Parse the request.
2. Authenticate the request.
3. Resolve tenant/store context.
4. Validate input.
5. Authorize the requested operation.
6. Call an application service.
7. Map the result to the API response.
8. Map known errors to the API error contract.

Avoid placing substantial business logic directly inside route handlers.

Bad:

```text
HTTP handler
 ├── validate inventory
 ├── calculate discount
 ├── update cart
 ├── charge payment
 └── create order
```

Preferred:

```text
HTTP handler
    ↓
application service
    ↓
domain modules
    ↓
repositories / integrations
```

---

## 9. Database Access

Database access must respect module ownership.

A module may directly access its own persistence implementation.

Other modules must use the owning module's public application/domain interface.

Do not import another module's repository merely because the required table is convenient.

Avoid:

```ts
import { ProductRepository } from "@/modules/products/internal/...";
```

from the Inventory module.

Prefer:

```ts
const product = await productCatalog.getVariant(variantId);
```

when the Product module exposes that capability.

Database constraints must complement application validation.

Important business invariants must not depend solely on application code.

---

## 10. Transactions

Transaction boundaries belong at the application-service/use-case level unless a documented lower-level transaction is required.

Keep transactions:

- Short.
- Explicit.
- Deterministic.
- Free from unnecessary external network calls.

Do not hold a database transaction open while waiting for an external payment provider unless the architecture explicitly requires and safely supports that behavior.

For concurrency-sensitive operations:

- Use database constraints.
- Use appropriate row locks.
- Use atomic updates where appropriate.
- Use idempotency where required.
- Maintain deterministic lock ordering.

Refer to:

- `docs/database/transaction-strategy.md`
- `docs/database/concurrency-control.md`

for detailed rules.

---

## 11. Error Handling

Errors must represent meaningful failure conditions.

Prefer domain/application errors such as:

```ts
StoreNotFoundError
UnauthorizedError
ProductNotFoundError
InsufficientInventoryError
InvalidCheckoutStateError
PaymentFailedError
```

over generic errors where callers need to distinguish the failure.

Do not expose internal stack traces, SQL errors, secrets, or implementation details through public APIs.

Errors crossing module boundaries should use stable contracts.

Refer to:

```text
docs/engineering/error-handling.md
docs/api/error-contract.md
```

---

## 12. Validation

Validate data at system boundaries.

Examples:

- HTTP request bodies.
- Query parameters.
- Path parameters.
- Webhook payloads.
- Environment variables.
- External provider responses.
- Background job payloads.

Use shared validation schemas where appropriate.

Validation does not replace authorization.

For example:

```text
Valid storeId
≠
Authorized access to storeId
```

Both must be established.

---

## 13. Money and Quantities

Never use floating-point arithmetic for monetary values.

Use the project's defined money representation consistently.

Examples of valid approaches include:

```text
integer minor units
```

or another explicitly defined exact representation.

Money calculations must preserve:

- Amount.
- Currency.
- Rounding rules.

Quantities must use appropriate numeric types and must respect domain constraints.

Inventory quantities must never become negative unless the specific business rule explicitly permits it.

---

## 14. Dates and Time

Store timestamps using a consistent timezone-independent representation.

Business operations involving dates must explicitly account for the relevant store timezone where applicable.

Do not use the server's local timezone as an implicit business rule.

Avoid ambiguous date strings.

Prefer structured date/time representations and explicit serialization formats.

---

## 15. Immutability and Historical Data

Do not mutate historical commerce records when doing so would destroy information required for auditing or customer-facing history.

Examples include:

- Order prices.
- Order item descriptions.
- Order addresses.
- Applied discount information.
- Payment records.
- Status history.

Current catalog information may change.

Historical order information must remain authoritative for the order that was actually created.

---

## 16. Comments

Comments should explain **why**, not merely restate **what** the code does.

Avoid:

```ts
// Increment quantity
quantity += 1;
```

Prefer:

```ts
// Inventory quantities are updated atomically here to prevent
// concurrent checkout requests from overselling stock.
```

Do not leave obsolete comments after changing code.

Do not use comments as a substitute for clear naming.

---

## 17. Logging

Logs should provide useful operational information without exposing sensitive data.

Do not log:

- Passwords.
- Access tokens.
- Refresh tokens.
- Payment credentials.
- Full authentication headers.
- Sensitive customer information unless explicitly required.
- Secrets.

Prefer structured logging with fields such as:

```text
requestId
storeId
userId
orderId
checkoutId
jobId
eventId
operation
status
duration
```

Use appropriate log levels.

Avoid excessive logging inside high-frequency code paths.

---

## 18. External Integrations

External providers must be isolated behind explicit integration boundaries.

Examples:

```text
payments/provider/
storage/provider/
email/provider/
```

Provider-specific request and response formats must not leak throughout the domain.

Prefer:

```text
Payment domain
    ↓
Payment provider interface
    ↓
Provider adapter
    ↓
External provider
```

rather than allowing provider SDK types throughout the application.

---

## 19. Async Jobs and Events

Events represent facts that already happened.

Examples:

```text
OrderCreated
PaymentCaptured
InventoryReserved
ProductPublished
```

Jobs represent work that needs to be performed.

Examples:

```text
SendOrderConfirmationEmail
ProcessPaymentWebhook
ReleaseExpiredInventoryReservation
```

Do not use events and jobs interchangeably.

Background jobs must be safe against duplicate execution where the operation can be retried.

---

## 20. API Contracts

API request and response structures must use explicit DTOs.

Do not expose database models directly as public API contracts.

Avoid leaking:

- Internal database IDs when not intended.
- Internal implementation fields.
- Provider-specific objects.
- Internal error structures.

Public API contracts should remain stable even if internal implementations change.

---

## 21. Tests

Tests must follow the same naming and module structure as production code where practical.

Test behavior, not implementation details.

Prefer assertions such as:

```text
checkout completes successfully
inventory cannot be oversold
unauthorized user cannot access another store
duplicate payment request does not create duplicate payment
```

over assertions about internal method calls unless the interaction itself is the behavior being tested.

Critical commerce behavior requires tests covering:

- Success.
- Validation failures.
- Authorization failures.
- Concurrency.
- Retries.
- Idempotency.
- State transitions.
- Tenant isolation.

---

## 22. Imports and Dependencies

Prefer imports from public module entry points.

Avoid importing internal files from another module.

Example:

```text
modules/inventory/index.ts
```

may expose the supported Inventory interface.

Consumers should not depend on:

```text
modules/inventory/internal/repositories/...
```

Keep dependency direction intentional.

A lower-level shared package must not import a higher-level business module merely for convenience.

---

## 23. Configuration

Do not hardcode:

- Secrets.
- Database credentials.
- API keys.
- Provider credentials.
- Environment-specific URLs.
- Deployment-specific configuration.

Configuration must come through the project's configuration layer.

Environment variables should be validated during application startup where appropriate.

---

## 24. Security-Sensitive Code

Security-sensitive code requires extra scrutiny.

Examples:

- Authentication.
- Authorization.
- Tenant resolution.
- Session handling.
- Password handling.
- Webhook verification.
- Payment handling.
- File uploads.
- Signed URLs.
- Secret management.

Do not weaken security controls merely to make a feature easier to implement.

Never trust:

```text
client-provided storeId
client-provided user role
client-provided price
client-provided inventory
client-provided payment status
```

These values must be verified or derived server-side.

---

## 25. Performance

Do not optimize prematurely.

First establish:

1. Correctness.
2. Clear ownership.
3. Appropriate database queries.
4. Appropriate indexes.
5. Measurable performance characteristics.

Avoid introducing caching, queues, distributed systems, or specialized infrastructure without a demonstrated requirement.

For the Demo, PostgreSQL-backed functionality is preferred when it is sufficient.

---

## 26. Dependency Rules

Before adding a dependency:

1. Check whether the project already provides the required capability.
2. Check whether the platform/runtime already provides it.
3. Confirm that the dependency solves a real requirement.
4. Consider maintenance and security implications.
5. Avoid dependencies that introduce unnecessary architectural complexity.

AI agents must not add dependencies simply because they are familiar with them.

---

## 27. Formatting and Static Analysis

All code must follow the repository's configured formatter and linting rules.

Developers and AI agents must not introduce formatting systems that conflict with the repository configuration.

Before considering a change complete, run the applicable project checks.

Expected baseline checks include:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Only report a check as passing if it was actually executed successfully.

---

## 28. Change Discipline

A change should be as small as reasonably possible.

Do not combine unrelated:

```text
feature work
refactoring
dependency upgrades
formatting changes
architecture changes
```

into one change unless they are genuinely required together.

Avoid opportunistic rewrites.

If an existing implementation is working and the requested task does not require changing it, leave it alone.

---

## 29. AI-Assisted Development

AI-generated code follows the same standards as human-written code.

AI agents must:

1. Read the repository instructions.
2. Inspect the existing implementation.
3. Read relevant specifications and architecture documents.
4. Identify the owning module.
5. Follow existing patterns.
6. Make the smallest safe change.
7. Add or update appropriate tests.
8. Run relevant verification commands.
9. Report actual verification results.

AI agents must not invent new architecture when an existing project pattern satisfies the requirement.

---

## 30. Definition of Acceptable Code

Code is acceptable when it is:

- Correct.
- Type-safe.
- Testable.
- Tenant-safe.
- Authorized.
- Consistent with module ownership.
- Consistent with project conventions.
- Observable where operationally important.
- Reasonably maintainable.
- Verified by applicable automated checks.

The goal is not maximum abstraction or maximum code quality in isolation.

The goal is **simple, correct, maintainable software that preserves the architecture of the platform**.