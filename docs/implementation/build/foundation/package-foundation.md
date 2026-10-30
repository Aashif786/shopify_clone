# Package Foundation

## 1. Purpose

This document defines the implementation requirements for the shared packages that form the foundation of the Demo.

The shared packages provide reusable infrastructure and cross-cutting capabilities without becoming a dumping ground for business logic.

The primary objectives are:

- Clear ownership.
- Stable dependency direction.
- Minimal coupling.
- Reusable infrastructure.
- Explicit public APIs.
- Type safety.
- Testability.

---

# 2. Package Set

The approved shared packages are:

```text id="q8m4c7"
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

Each package must have a narrowly defined responsibility.

---

# 3. Dependency Direction

The preferred dependency direction is:

```text id="v7m4c8"
types
  ↓
validation
  ↓
config
  ↓
db
  ↓
auth
  ↓
tenant
  ↓
application/modules
```

`event-bus` and `ui` remain independent where possible.

This is a logical dependency direction, not a requirement that every package depend directly on the package above it.

---

# 4. Package Public API

Every package must expose a deliberate public entry point.

Example:

```text id="x8c4m7"
packages/config/src/index.ts
packages/db/src/index.ts
packages/auth/src/index.ts
```

Consumers should import through the package boundary.

Avoid imports into implementation internals such as:

```text id="m5n8c4"
@calcart/db/src/internal/...
```

---

# 5. Internal Package Structure

Where complexity justifies it:

```text id="q7c4m8"
packages/<package>/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── <implementation>
    └── ...
```

Do not create unnecessary subdirectories for trivial packages.

---

# 6. `packages/types`

## Responsibility

Contains genuinely shared type contracts.

Examples:

```text id="v8m4x7"
Identifiers
Pagination
Common API response primitives
Common error contracts
Shared metadata
```

## Must Not Own

```text id="x5c8m4"
Product types
Order business rules
Payment state logic
Inventory calculations
Store business rules
```

Domain types remain in domain modules.

---

# 7. Shared Identifier Types

Where useful, shared identifiers may provide semantic typing.

Example:

```text id="m4n8c7"
UserId
OrganizationId
StoreId
ProductId
OrderId
```

The implementation must avoid unnecessary type complexity.

The purpose is to prevent accidental identifier mixing where the risk is meaningful.

---

# 8. Pagination Contracts

Shared pagination contracts should define consistent API behavior.

Typical concepts:

```text id="q8c5m4"
limit
cursor
hasMore
nextCursor
```

Pagination behavior must remain consistent across APIs without forcing every endpoint to use identical query semantics where business requirements differ.

---

# 9. `packages/config`

## Responsibility

Provides typed, validated configuration.

It should centralize:

```text id="v7m4c8"
Database configuration
Application configuration
Authentication configuration
Session configuration
Storage configuration
Payment configuration
Email configuration
Observability configuration
```

---

# 10. Configuration Access

Application code should consume typed configuration rather than accessing environment variables directly throughout the repository.

Prefer:

```text id="x8c4m7"
config.database
config.auth
config.storage
```

over scattered:

```text id="m5n8c4"
process.env.*
```

---

# 11. Configuration Validation

Configuration must be validated during startup.

Required behavior:

```text id="q7c4m8"
Valid configuration
→ application starts

Invalid configuration
→ clear failure
```

Security-sensitive variables must not silently fall back to unsafe defaults.

---

# 12. Server/Public Configuration

Configuration must distinguish between:

```text id="v8m4x7"
server-only configuration
public configuration
```

Server-only secrets must never enter client bundles.

Examples of server-only values:

```text id="x5c8m4"
Database credentials
Session secrets
Payment secret keys
Storage credentials
Webhook secrets
```

---

# 13. `packages/db`

## Responsibility

Provides shared PostgreSQL infrastructure.

It owns:

```text id="m4n8c7"
Database client/connection
Transaction support
Migration integration
Database infrastructure utilities
```

Domain-specific repositories remain with their owning modules.

---

# 14. Database Package Boundary

The database package should not become the owner of business logic.

Avoid:

```text id="q8c5m4"
db.createOrder()
db.reserveInventory()
db.applyDiscount()
```

when those are domain operations.

Instead:

```text id="v7m4c8"
Orders module
 → Order repository
 → DB package

Inventory module
 → Inventory repository
 → DB package
```

---

# 15. Transaction Interface

The DB package must provide a safe transaction abstraction.

Conceptually:

```text id="x8c4m7"
transaction(async (tx) => {
    ...
})
```

The exact API may differ.

The transaction context must be capable of being passed through application services and repositories.

---

# 16. Connection Lifecycle

The DB package must handle:

```text id="m5n8c4"
connection creation
connection reuse/pooling
connection shutdown
connection errors
```

The implementation must avoid opening unnecessary database connections per request.

---

# 17. `packages/auth`

## Responsibility

Provides authentication infrastructure.

It should support:

```text id="q7c4m8"
User identification
Session creation
Session lookup
Session invalidation
Authentication context
```

Authentication is distinct from authorization.

---

# 18. Auth Package Boundaries

The auth package must not own:

```text id="v8m4x7"
Store roles
Product permissions
Order permissions
Inventory authorization
```

Those are application/domain authorization concerns.

---

# 19. Session Security

The authentication package must support secure session handling.

Verify:

```text id="x5c8m4"
HttpOnly where appropriate
Secure cookies in production
Appropriate SameSite behavior
Expiration
Invalidation
Session rotation where required
```

Exact implementation follows the authentication specification.

---

# 20. `packages/tenant`

## Responsibility

Provides tenant/store context resolution.

It should support concepts such as:

```text id="m4n8c7"
OrganizationContext
StoreContext
MembershipContext
```

The package should make tenant context explicit to application services.

---

# 21. Tenant Context Rules

Tenant context must come from trusted server-side information.

Do not treat:

```text id="q8c5m4"
clientStoreId
queryStoreId
bodyStoreId
```

as proof of authorization.

The resolved Store must be validated against the authenticated user's membership and permissions.

---

# 22. `packages/validation`

## Responsibility

Provides shared boundary-validation utilities.

It should support:

```text id="v7m4c8"
Request schemas
Environment schemas
Webhook schemas where appropriate
Common primitive validation
```

---

# 23. Validation Ownership

Validation must remain separated into:

```text id="x8c4m7"
Boundary validation
        +
Domain business validation
```

For example:

```text id="m5n8c4"
quantity must be an integer
```

belongs to boundary validation.

```text id="q7c4m8"
quantity cannot exceed available inventory
```

belongs to Inventory business logic.

---

# 24. `packages/event-bus`

## Responsibility

Provides internal event contracts and dispatch mechanisms.

It should support:

```text id="v8m4x7"
Typed event definitions
Event publishing
Event handling
Correlation metadata
```

It is not a distributed message broker.

---

# 25. Event Bus Scope

The Demo event bus is intended for internal application communication.

It must not require:

```text id="x5c8m4"
Kafka
RabbitMQ
NATS
Redis Streams
```

unless a later architectural decision introduces one.

---

# 26. Event Contract

Events should contain:

```text id="m4n8c7"
event name/type
event identifier
occurred timestamp
relevant aggregate/entity identifier
Store context where appropriate
minimal required payload
```

Avoid putting arbitrary database rows into events.

---

# 27. Event Handler Isolation

An event handler should:

```text id="q8c5m4"
receive event
validate expected payload
execute its responsibility
record outcome where required
handle duplicate delivery safely
```

One event handler failure must not silently corrupt the originating transaction.

---

# 28. `packages/ui`

## Responsibility

Provides reusable presentation components.

Examples:

```text id="v7m4c8"
Buttons
Inputs
Forms
Tables
Dialogs
Navigation
Feedback components
```

---

# 29. UI Package Restrictions

UI components must not contain:

```text id="x8c4m7"
database calls
business rules
authorization decisions
payment logic
tenant resolution
```

They may accept already-authorized data and invoke application-facing callbacks.

---

# 30. Server and Client Boundaries

The UI package must respect the framework's server/client execution model.

Client-only components must not accidentally import:

```text id="m5n8c4"
database packages
server secrets
server-only configuration
```

---

# 31. Shared Package Testing

Each package should have tests appropriate to its responsibility.

Examples:

| Package | Test Focus |
|---|---|
| `types` | Type contracts/build |
| `config` | Validation/default behavior |
| `db` | Connection/transaction behavior |
| `auth` | Session behavior |
| `tenant` | Context resolution |
| `validation` | Boundary validation |
| `event-bus` | Event dispatch/contracts |
| `ui` | Component behavior |

---

# 32. Package Dependency Restrictions

Packages must not import business modules unless explicitly required by architecture.

Avoid:

```text id="q7c4m8"
packages/db → modules/orders
packages/auth → modules/products
packages/ui → modules/inventory
```

Shared packages should remain reusable and lower-level.

---

# 33. Package-to-App Restrictions

Shared packages should not depend on:

```text id="v8m4x7"
apps/web
apps/worker
```

The application consumes the shared packages, not the reverse.

---

# 34. Package-to-Package Dependencies

Before introducing a package dependency:

```text id="x5c8m4"
Check whether it creates a cycle
Check whether the dependency is truly shared
Check whether a lower-level package is more appropriate
```

Do not create dependencies solely to avoid moving a small piece of code.

---

# 35. Package API Stability

Once another module begins depending on a package public API:

```text id="m4n8c7"
Treat it as a contract
```

Breaking changes should be deliberate and coordinated.

Internal implementation can change without affecting consumers if the public contract remains stable.

---

# 36. Package Error Strategy

Shared packages should expose meaningful typed errors where appropriate.

Examples:

```text id="q8c5m4"
ConfigurationError
DatabaseConnectionError
AuthenticationError
ValidationError
```

Business-specific errors belong in business modules.

---

# 37. Package Logging

Shared infrastructure should use the common logging approach rather than inventing independent logging systems.

Packages should include contextual information without exposing secrets.

---

# 38. Package Configuration

Packages should receive configuration through the centralized configuration system where appropriate.

Avoid each package independently reading:

```text id="v7m4c8"
process.env
```

This creates hidden configuration dependencies.

---

# 39. Package Initialization

Avoid expensive or side-effect-heavy work during module import.

Prefer explicit initialization:

```text id="x8c4m7"
createDatabaseClient()
createAuthService()
createEventBus()
```

rather than hidden global initialization.

This improves testing and lifecycle control.

---

# 40. Package Lifecycle

Long-lived resources should support cleanup.

Examples:

```text id="m5n8c4"
Database pool
Event listeners
External connections
```

Applications must be able to shut them down cleanly.

---

# 41. Testability

Shared packages should expose dependency injection points where external behavior must be controlled.

Examples:

```text id="q7c4m8"
Clock
Database
External provider
Event dispatcher
Storage adapter
```

Do not introduce a dependency-injection framework unless actual complexity requires one.

Simple constructor/function injection is preferred.

---

# 42. No Global Mutable State

Avoid mutable global state for:

```text id="v8m4x7"
current user
current Store
current request
current transaction
payment state
cart state
```

Pass required context explicitly.

---

# 43. Request Context

Request-scoped values may be represented through an explicit context object.

Typical information:

```text id="x5c8m4"
requestId
user
organization
store
permissions
```

Do not make request context globally mutable.

---

# 44. Package Documentation

Each non-trivial package should document:

```text id="m4n8c7"
Purpose
Public API
Dependencies
Initialization
Testing
Security considerations
```

The package README should remain concise and link to deeper architecture documentation where necessary.

---

# 45. Package Implementation Order

Implement packages in this approximate order:

```text id="q8c5m4"
1. types
2. config
3. validation
4. db
5. auth
6. tenant
7. event-bus
8. ui
```

This order reflects dependencies and does not require every package to be completely feature-rich before the next begins.

---

# 46. Package Completion Criteria

A package is considered ready when:

```text id="v7m4c8"
[ ] Responsibility is documented
[ ] Public API is defined
[ ] Dependencies are appropriate
[ ] No circular dependency exists
[ ] Type checking passes
[ ] Tests exist where applicable
[ ] Error behavior is defined
[ ] Initialization is explicit
[ ] Shutdown is handled where required
[ ] No secrets are exposed
```

---

# 47. Foundation Integration

After package implementation:

```text id="x8c4m7"
packages
   ↓
apps/web
packages
   ↓
apps/worker
packages
   ↓
domain modules
```

All consuming applications and modules should use the established package APIs.

---

# 48. Package Verification Checklist

```text id="m5n8c4"
[ ] Workspace package definitions are valid
[ ] Public entry points exist
[ ] Internal files remain private
[ ] Dependencies are correctly scoped
[ ] No package depends on apps
[ ] No accidental domain dependencies exist
[ ] TypeScript passes
[ ] Tests pass
[ ] Build passes
[ ] Configuration is centralized
[ ] Secrets remain server-side
[ ] Initialization is explicit
[ ] Resource cleanup is supported
[ ] Package responsibilities remain narrow
```

---

# 49. Definition of Done

The shared package foundation is complete when the repository has stable, reusable implementations for:

```text id="q7c4m8"
Types
Configuration
Database
Authentication
Tenant Context
Validation
Event Infrastructure
UI
```

without introducing unnecessary business logic or architectural coupling.

The resulting package layer should make domain implementation **easier without making domain ownership ambiguous**.