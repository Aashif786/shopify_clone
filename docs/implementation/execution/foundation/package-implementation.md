# Package Implementation

## 1. Purpose

This document defines the concrete implementation of the shared packages and package boundaries used by the Demo.

The shared packages provide foundational capabilities without becoming a dumping ground for domain logic.

The primary goals are:

- Establish stable internal package contracts.
- Keep infrastructure concerns reusable.
- Prevent domain coupling.
- Provide consistent application behavior.
- Preserve the modular-monolith architecture.
- Support future V1 evolution without premature service extraction.

---

# 2. Package Set

The Demo uses the following shared packages:

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

Each package has a clearly defined responsibility.

---

# 3. Package Dependency Direction

The dependency graph should remain approximately:

```text
                 ┌──────────────┐
                 │    config    │
                 └──────┬───────┘
                        │
          ┌─────────────┼─────────────┐
          ↓             ↓             ↓
        auth           db          validation
          ↓             ↓             ↓
        tenant        event-bus      types
          │             │             │
          └─────────────┼─────────────┘
                        ↓
                  domain modules
                        ↓
                    web / worker
```

The exact dependency graph may evolve, but circular dependencies are prohibited.

---

# 4. Package Design Rules

Every shared package must:

- Have a single primary responsibility.
- Expose a deliberate public API.
- Hide implementation details.
- Avoid unnecessary dependencies.
- Avoid domain-specific business logic.
- Have tests appropriate to its responsibility.
- Avoid importing another domain module.
- Avoid direct dependencies on application-specific code.

---

# 5. `packages/config`

## Responsibility

Centralized application configuration.

It owns:

- Environment parsing.
- Typed configuration.
- Required variable validation.
- Environment-specific behavior.
- Server/client configuration separation.

---

## Expected Structure

```text id="q7m4c8"
packages/config/
├── src/
│   ├── env/
│   ├── config/
│   ├── validation/
│   └── index.ts
├── package.json
└── tsconfig.json
```

The exact structure may be simplified if the configuration implementation remains clear.

---

## Public API

The package should expose typed configuration access rather than raw environment variables.

Example concept:

```text id="v8m3c7"
getServerConfig()
getPublicConfig()
getWorkerConfig()
```

Consumers should not repeatedly call `process.env` throughout the application.

---

## Requirements

Configuration must:

- Validate at startup.
- Distinguish required and optional values.
- Distinguish secrets from public configuration.
- Prevent server secrets from reaching client code.
- Support test configuration.
- Support worker configuration.

---

# 6. `packages/db`

## Responsibility

Database connectivity and shared database infrastructure.

It owns:

- PostgreSQL client setup.
- Connection pooling.
- Transaction primitives.
- Database lifecycle.
- Database health checks.
- Shared persistence infrastructure.

It does not own domain repositories.

---

## Expected Structure

```text id="m8c4x7"
packages/db/
├── src/
│   ├── client/
│   ├── transaction/
│   ├── health/
│   └── index.ts
├── package.json
└── tsconfig.json
```

---

## Database Boundary

Domain modules may depend on the DB package for infrastructure capabilities.

They must not place all domain repositories inside `packages/db`.

Preferred:

```text id="x7m3c8"
modules/products/infrastructure/
    product-repository.ts
```

not:

```text id="q4m8c7"
packages/db/src/product-repository.ts
```

This preserves module ownership.

---

# 7. Transactions

The DB package should expose safe transaction primitives.

The application service should determine the transaction boundary.

Conceptually:

```text id="v6m4c8"
Application Service
      ↓
DB Transaction
      ↓
Repository Operations
      ↓
Commit / Rollback
```

The DB package should not decide business transaction boundaries.

---

# 8. `packages/auth`

## Responsibility

Authentication infrastructure.

It owns:

- Password hashing.
- Session handling.
- Authentication context.
- Session validation.
- Authentication-related security primitives.

It does not decide business permissions.

---

## Expected Structure

```text id="m7c4x8"
packages/auth/
├── src/
│   ├── credentials/
│   ├── sessions/
│   ├── context/
│   ├── security/
│   └── index.ts
├── package.json
└── tsconfig.json
```

---

## Authentication vs Authorization

Authentication answers:

```text id="q8m3c7"
Who is this user?
```

Authorization answers:

```text id="x4m8c7"
What may this user do here?
```

`packages/auth` establishes identity.

Tenant and domain/application layers enforce authorization.

---

# 9. Session Implementation

Session infrastructure should support:

- Session creation.
- Session lookup.
- Expiration.
- Revocation.
- Secure cookie integration.
- Request authentication context.

Sessions should be stored durably according to the authentication architecture.

The package should not assume that an in-memory session store is sufficient for production-like behavior.

---

# 10. `packages/tenant`

## Responsibility

Tenant and store context.

It owns:

- Organization resolution.
- Membership resolution interfaces.
- Store context.
- Tenant-scoped request context.
- Tenant-aware access helpers.

It does not own domain business rules.

---

## Expected Structure

```text id="n5c8m4"
packages/tenant/
├── src/
│   ├── context/
│   ├── resolution/
│   ├── authorization/
│   └── index.ts
├── package.json
└── tsconfig.json
```

---

# 11. Tenant Context

A protected request should be able to establish context similar to:

```text id="v8m4c7"
User
Organization
Membership
Store
Role
```

Not every request requires every field.

Public Storefront requests may resolve Store context without an authenticated user.

---

# 12. Tenant Safety

Tenant utilities must make it difficult to accidentally perform an unscoped operation.

Repositories should receive explicit scope information where required.

Example concept:

```text id="q7c4m8"
findProduct({
  storeId,
  productId
})
```

rather than:

```text id="x8m3c7"
findProduct(productId)
```

for Store-owned resources.

---

# 13. `packages/validation`

## Responsibility

Shared boundary validation.

It provides:

- Request validation.
- DTO validation.
- Environment validation support where appropriate.
- Common validation helpers.

It must not contain domain-specific business rules.

---

## Expected Structure

```text id="m4c8x7"
packages/validation/
├── src/
│   ├── common/
│   ├── request/
│   ├── response/
│   └── index.ts
├── package.json
└── tsconfig.json
```

---

# 14. Validation Layers

Validation should occur at multiple levels.

### Boundary Validation

Checks:

- Required fields.
- Data types.
- Format.
- Size.
- Allowed input shape.

### Domain Validation

Checks:

- Business invariants.
- State transitions.
- Business constraints.

The validation package should not replace domain validation.

---

# 15. `packages/types`

## Responsibility

Small, domain-neutral shared types.

Examples may include:

- IDs.
- Pagination primitives.
- Request metadata.
- Generic result types.
- Shared transport types.

The package must remain deliberately small.

---

# 16. Types That Must Not Live Here

Do not place domain models into `packages/types`.

Avoid:

```text id="v6m8c4"
Product
Order
Checkout
Payment
InventoryReservation
```

unless the type is genuinely transport-level and domain-neutral.

Domain-owned types belong to their modules.

---

# 17. Type Duplication

Some duplication is acceptable.

For example:

```text id="x4m8c7"
Product domain type
Product API response DTO
Product database record
```

do not need to be the same TypeScript type.

Forcing them into one shared type creates unwanted coupling.

---

# 18. `packages/event-bus`

## Responsibility

Internal domain event infrastructure.

It provides mechanisms for:

- Publishing events.
- Registering handlers.
- Dispatching events.
- Carrying event metadata.

It does not define domain business rules.

---

# 19. Event Design

Events represent facts.

Examples:

```text id="q8m3c7"
ProductPublished
InventoryReserved
CheckoutCompleted
PaymentSucceeded
OrderCreated
```

Events should contain sufficient information for consumers without requiring access to another module's private implementation.

---

# 20. Event Metadata

Events should support useful metadata such as:

```text id="m7c4x8"
eventId
eventType
occurredAt
organizationId
storeId
correlationId
causationId
payload
```

Only include fields that are actually required.

---

# 21. Event Reliability

The event-bus package must not create false guarantees.

If an event is required to survive process failure, use the durable event/outbox strategy defined by the architecture rather than relying on an in-memory event emitter.

---

# 22. `packages/ui`

## Responsibility

Shared UI primitives.

Examples:

- Buttons.
- Inputs.
- Dialogs.
- Tables.
- Form primitives.
- Layout primitives.
- Feedback components.

The package should contain presentation primitives, not commerce business logic.

---

# 23. UI Boundary

Do not place:

```text id="v4c8m7"
Checkout calculation
Payment state
Inventory rules
Order transitions
Discount calculation
```

inside the UI package.

UI components consume application/API data.

---

# 24. Client/Server Separation

Shared UI components must respect Next.js client/server boundaries.

Components requiring browser APIs or React client state should explicitly use the appropriate client boundary.

Server-only dependencies must never enter client bundles.

---

# 25. Package Testing

Each package should have tests appropriate to its responsibilities.

### Config

Test:

- Valid configuration.
- Missing configuration.
- Invalid values.
- Public/private separation.

### DB

Test:

- Connection.
- Transaction behavior.
- Health checks.

### Auth

Test:

- Password operations.
- Session lifecycle.
- Expiration.
- Revocation.

### Tenant

Test:

- Context resolution.
- Membership resolution.
- Isolation helpers.

### Validation

Test:

- Valid inputs.
- Invalid inputs.
- Boundary behavior.

### Event Bus

Test:

- Event registration.
- Dispatch.
- Metadata.
- Failure behavior.

### UI

Test reusable component behavior where appropriate.

---

# 26. Package Build Order

The initial implementation order should be:

```text id="q5m8c4"
config
   ↓
types
   ↓
validation
   ↓
db
   ↓
auth
   ↓
tenant
   ↓
event-bus
   ↓
ui
```

Actual dependencies may permit some packages to be implemented in parallel.

---

# 27. Package Dependency Restrictions

The following restrictions apply.

### Shared packages must not depend on:

```text id="x7m4c8"
apps/web
apps/worker
```

### Shared packages must not depend on:

```text id="m8c3q7"
modules/*
```

unless a deliberately defined architectural exception exists.

### Domain modules may depend on:

```text id="v4m8c7"
packages/*
```

where the dependency is appropriate.

---

# 28. Domain Package Exposure

A domain module should expose a public entry point.

Example:

```text id="q8m4c7"
modules/products/src/index.ts
```

Consumers should depend on the module's public API rather than internal implementation files.

---

# 29. Provider SDK Isolation

External provider SDKs must remain behind integration boundaries.

For example:

```text id="m6c4x8"
Payment SDK
    ↓
Payment Adapter
    ↓
Payment Interface
    ↓
Checkout / Payment Application Service
```

The rest of the application should not directly import provider SDKs.

---

# 30. Package Configuration

Every package should define:

- Name.
- Version.
- Private/public status.
- Entry point.
- Type declarations where required.
- Runtime dependencies.
- Development dependencies.
- Build configuration.

Internal packages should generally remain private to the repository.

---

# 31. Dependency Installation Rules

When adding a dependency:

1. Confirm it solves a real requirement.
2. Check whether an existing dependency already provides the capability.
3. Determine whether it belongs at root, package, module, or application level.
4. Confirm server/client compatibility.
5. Check maintenance and security implications.
6. Install through pnpm.
7. Commit the lockfile.
8. Run relevant validation.

Do not add dependencies merely to reduce a few lines of code.

---

# 32. Package API Stability

Once another module begins depending on a package API:

- Avoid unnecessary breaking changes.
- Update all consumers deliberately.
- Keep internal implementation private.
- Document meaningful contract changes.

Package APIs should evolve deliberately rather than through accidental imports.

---

# 33. Implementation Sequence

The concrete package implementation should proceed as:

```text id="x5m8c7"
1. Verify package directories
2. Configure package manifests
3. Configure TypeScript
4. Implement config
5. Implement shared types
6. Implement validation
7. Implement database infrastructure
8. Implement authentication infrastructure
9. Implement tenant infrastructure
10. Implement event infrastructure
11. Implement shared UI primitives
12. Verify package dependency graph
13. Verify builds and tests
```

---

# 34. Package Verification

Before proceeding to application and domain implementation:

```text id="v8m4c7"
[ ] All packages install
[ ] Package imports resolve
[ ] Typecheck passes
[ ] Builds pass
[ ] No circular dependencies
[ ] No domain package leakage
[ ] No server/client boundary violations
[ ] Public exports work
[ ] Tests pass
[ ] Lockfile is consistent
```

---

# 35. Definition of Done

The shared package foundation is complete when:

- Every shared package has a clear owner and responsibility.
- Public APIs are defined.
- Dependency direction is valid.
- Packages build successfully.
- Tests cover foundational behavior.
- Domain logic remains inside domain modules.
- Provider-specific code remains isolated.
- Web and worker applications can consume the required packages.
- No unnecessary infrastructure dependency has been introduced.

The package layer should remain a **foundation, not a second application**. If business logic starts accumulating here, the architecture is already drifting.