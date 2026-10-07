    # Codebase Readiness

## 1. Purpose

This document defines the conditions the repository must satisfy before substantial Demo implementation begins.

The purpose is to ensure that the repository is structurally ready for implementation and that foundational problems are resolved before domain code begins accumulating.

Codebase readiness is a **precondition for implementation**, not a replacement for testing.

---

# 2. Readiness Objective

Before implementing business domains, the repository must provide a reliable foundation for:

```text id="q7m2kc"
Source control
Workspace management
TypeScript
Application startup
Worker startup
Configuration
Database access
Migrations
Testing
Linting
Formatting
Environment management
Logging
Error handling
Authentication
Tenant context
```

---

# 3. Repository Baseline

The repository must contain the approved high-level structure:

```text id="a5k9tz"
apps/
  web/
  worker/

modules/
  stores/
  products/
  inventory/
  customers/
  carts/
  discounts/
  checkout/
  payments/
  orders/

packages/
  auth/
  config/
  db/
  event-bus/
  tenant/
  types/
  ui/
  validation/

docs/
specs/
tests/
infrastructure/
```

Additional directories may exist when justified by implementation requirements.

Do not create new top-level architectural areas merely for convenience.

---

# 4. Root Configuration

Verify the presence and correctness of:

```text id="h4n8pv"
package.json
pnpm-workspace.yaml
tsconfig.json
.env.example
AGENTS.md
CLAUDE.md
README.md
```

Also verify:

```text id="f0yq8s"
.github/
.cursor/
```

where applicable to the development workflow.

---

# 5. Package Manager Readiness

The repository uses pnpm.

Verify:

```text id="5k3s0w"
[ ] pnpm is available
[ ] Workspace configuration resolves correctly
[ ] package.json files are valid
[ ] Lockfile is present once dependencies are installed
[ ] Workspace packages resolve correctly
[ ] No accidental npm/yarn lockfiles exist
```

Do not maintain multiple competing package-manager lockfiles.

---

# 6. Workspace Resolution

Run the dependency installation from repository root.

Verify:

```text id="m1c4x7"
Root
 ↓
Workspace discovery
 ↓
apps/*
 ↓
modules/*
 ↓
packages/*
```

All intended workspace packages must resolve without broken local references.

---

# 7. TypeScript Readiness

TypeScript must operate in strict mode.

Verify:

```text id="q8m4c2"
[ ] Root configuration loads
[ ] Workspace projects load
[ ] Path aliases resolve
[ ] Shared packages resolve
[ ] Web project resolves
[ ] Worker project resolves
[ ] No hidden implicit-any errors
```

Do not suppress TypeScript errors globally to achieve readiness.

---

# 8. Build Baseline

The repository should establish a baseline build command.

The build must clearly identify:

```text id="v5n7c4"
web build
worker build
shared package compilation where applicable
```

A baseline build failure must be resolved before large-scale feature development.

---

# 9. Lint Baseline

The repository must have a reproducible linting command.

Verify:

```text id="x4m8q7"
[ ] Linter is configured
[ ] Workspace files are discovered
[ ] Generated files are excluded appropriately
[ ] Configuration files are valid
[ ] Existing source passes baseline lint
```

Do not disable lint rules merely because existing code violates them.

---

# 10. Formatting Baseline

Formatting must be deterministic.

Verify:

```text id="m7c4v8"
[ ] Formatter is configured
[ ] Formatting command exists
[ ] Check mode exists where practical
[ ] Generated files are excluded
```

Formatting should not become a manual review burden.

---

# 11. Git Readiness

Verify:

```text id="q5x8m4"
[ ] Repository is initialized
[ ] main branch exists
[ ] .gitignore is correct
[ ] Secrets are ignored
[ ] Build output is ignored
[ ] Local environment files are ignored
[ ] Temporary files are ignored
```

Never commit:

```text id="v4m8c7"
.env
private keys
credentials
database dumps
node_modules
build output
local logs
```

---

# 12. Environment Configuration

`.env.example` must document required configuration without containing secrets.

Configuration should cover required categories such as:

```text id="x8c4m7"
Application
Database
Authentication
Session
Object Storage
Payment Provider
Email Provider
Observability
```

Only variables actually required by the implementation should be included.

---

# 13. Configuration Validation

Application startup must validate required configuration.

Expected behavior:

```text id="m5n8c4"
Valid configuration
→ application starts

Invalid/missing required configuration
→ clear startup failure
```

Do not allow the application to silently start with dangerous defaults for security-sensitive configuration.

---

# 14. Development Environment

A new developer should be able to understand how to start the project from the repository documentation.

Minimum flow:

```text id="q7c4m8"
Clone
 ↓
Install dependencies
 ↓
Configure environment
 ↓
Start infrastructure
 ↓
Run migrations
 ↓
Seed development data
 ↓
Start Web
 ↓
Start Worker
```

---

# 15. Database Readiness

PostgreSQL must be available through the documented development setup.

Verify:

```text id="v8m4x7"
[ ] Database starts
[ ] Connection succeeds
[ ] Credentials are configured
[ ] Application can connect
[ ] Worker can connect
[ ] Connection failures are reported clearly
```

---

# 16. Database Migration Readiness

The migration system must support:

```text id="x5c8m4"
Create migration
Apply migration
Check migration state
Reset development database where supported
```

Migrations must be version-controlled.

---

# 17. Database Schema Baseline

Before domain implementation, foundational database infrastructure should support:

```text id="m4n8c7"
Organizations
Users
Memberships
Stores
```

The exact final domain schema is implemented incrementally according to the database implementation plan.

Do not create every future table merely because the architecture mentions it.

---

# 18. Database Transaction Readiness

Verify that application code can execute transactions through the shared database package.

The abstraction must support:

```text id="q8c5m4"
BEGIN
operations
COMMIT
ROLLBACK
```

and the transaction context must be usable by application services.

---

# 19. Database Error Handling

Verify that database errors can be classified appropriately.

Examples:

```text id="v7m4c8"
Unique constraint violation
Foreign key violation
Connection failure
Transaction failure
Serialization/deadlock failure
```

Do not expose raw database errors through public APIs.

---

# 20. Web Application Readiness

`apps/web` must be able to:

```text id="x8c4m7"
[ ] Start locally
[ ] Load configuration
[ ] Connect to required infrastructure
[ ] Respond to health checks
[ ] Resolve API routes
[ ] Access shared packages
[ ] Establish authentication context
[ ] Establish tenant context
```

---

# 21. Worker Readiness

`apps/worker` must be able to:

```text id="m5n8c4"
[ ] Start independently
[ ] Load configuration
[ ] Connect to PostgreSQL
[ ] Log startup
[ ] Process a test job
[ ] Handle shutdown
[ ] Exit cleanly on fatal configuration failure
```

The Worker must not depend on the Web process remaining alive.

---

# 22. Graceful Shutdown

Both Web and Worker must support graceful shutdown.

Expected behavior:

```text id="q7c4m8"
Receive shutdown signal
 ↓
Stop accepting new work
 ↓
Finish safe in-flight work where practical
 ↓
Close database connections
 ↓
Close external connections
 ↓
Exit
```

Worker shutdown must avoid corrupting job state.

---

# 23. Health Checks

The Web application should expose a health endpoint suitable for deployment verification.

Health checks should distinguish where appropriate between:

```text id="v8m4x7"
process alive
dependencies ready
```

Do not expose sensitive diagnostic information through health endpoints.

---

# 24. Logging Readiness

The logging foundation must support structured output.

At minimum:

```text id="x5c8m4"
timestamp
level
service
environment
message
requestId where applicable
```

Additional context can be added as implementation matures.

---

# 25. Error Handling Readiness

The repository must have a consistent error model before domain implementation begins.

It should support:

```text id="m4n8c7"
Validation errors
Authentication errors
Authorization errors
Not found
Conflict
Business errors
External dependency failures
Internal failures
```

---

# 26. Authentication Readiness

Authentication infrastructure must provide a clear mechanism for:

```text id="q8c5m4"
Identify User
Create Session
Read Session
Invalidate Session
```

Authentication must be independent from role-based authorization.

---

# 27. Tenant Context Readiness

The repository must provide a consistent mechanism for resolving:

```text id="v7m4c8"
User
Organization
Membership
Store
```

for authenticated merchant requests.

The mechanism must not rely on arbitrary client-provided tenant identifiers.

---

# 28. Authorization Readiness

Authorization infrastructure must support checking:

```text id="x8c4m7"
User
 ↓
Membership
 ↓
Role
 ↓
Permission
 ↓
Resource
```

Domain-specific authorization rules can be added as domains are implemented.

---

# 29. Validation Package Readiness

`packages/validation` should provide the shared validation conventions used at application boundaries.

It should not become a repository for every business rule.

Boundary validation:

```text id="m5n8c4"
type
format
required fields
shape
size
```

Domain validation:

```text id="q7c4m8"
business invariants
state transitions
eligibility
```

must remain separate.

---

# 30. Shared Types Readiness

`packages/types` should contain genuinely shared contracts.

Do not use it as a dumping ground for every type in the application.

Good candidates include:

```text id="v8m4x7"
common identifiers
pagination contracts
shared API primitives
common result/error structures
```

Domain-specific types remain in their owning modules.

---

# 31. UI Package Readiness

`packages/ui` should provide reusable presentation components.

It must not contain:

```text id="x5c8m4"
database logic
business rules
authorization
payment logic
tenant resolution
```

UI components remain presentation concerns.

---

# 32. Event Bus Readiness

The Demo event-bus package should establish the internal event contract mechanism.

It should support:

```text id="m4n8c7"
Publish event
Subscribe/handle event
Typed event payloads
Correlation metadata where required
```

It does not need to become a distributed message broker.

---

# 33. Test Infrastructure Readiness

Before domain implementation, establish:

```text id="q8c5m4"
Unit test runner
Integration test runner
Test database strategy
Test environment configuration
Test factories
Test cleanup
```

The exact tooling should follow the approved testing architecture.

---

# 34. Test Database Isolation

Integration tests must not accidentally use:

```text id="v7m4c8"
development database
staging database
production database
```

Use a dedicated test database or equivalent isolated environment.

---

# 35. Test Factory Readiness

Factories should make it easy to create:

```text id="x8c4m7"
User
Organization
Membership
Store
Product
Variant
Inventory
Customer
Cart
```

as each domain becomes available.

Factories should create valid state by default.

---

# 36. Local Infrastructure Readiness

Local infrastructure should be minimal.

Required services should be limited to what the Demo actually needs.

Expected baseline:

```text id="m5n8c4"
PostgreSQL
```

Additional local services should be introduced only when an approved feature requires them.

Do not require Redis or Kafka simply because future V1 may use them.

---

# 37. Docker Readiness

Docker configuration should support reproducible local infrastructure where required.

Verify:

```text id="q7c4m8"
[ ] PostgreSQL container starts
[ ] Data persistence works
[ ] Environment variables work
[ ] Ports are documented
[ ] Container shutdown is clean
```

Do not duplicate application configuration between incompatible Docker and local setups.

---

# 38. CI Readiness

CI must be capable of running the baseline checks:

```text id="v8m4x7"
Install
 ↓
Type check
 ↓
Lint
 ↓
Unit tests
 ↓
Integration tests
 ↓
Build
```

E2E and security checks should be added according to the verification pipeline.

---

# 39. CI Environment Isolation

CI must use isolated credentials and infrastructure.

Never use production:

```text id="x5c8m4"
database credentials
payment credentials
storage credentials
email credentials
```

in ordinary CI testing.

---

# 40. Dependency Baseline

Before feature development:

```text id="m4n8c7"
[ ] Dependencies install cleanly
[ ] No unnecessary duplicates
[ ] No known critical vulnerability introduced knowingly
[ ] Versions are locked
[ ] Workspace package boundaries are correct
```

Do not perform broad dependency upgrades simply to make the repository appear modern.

---

# 41. Documentation Readiness

Implementation documentation must be discoverable.

At minimum:

```text id="q8c5m4"
Architecture
Product
Domain
Implementation
Testing
Security
Deployment
```

must remain organized according to the established documentation hierarchy.

---

# 42. AI Tool Readiness

AI-assisted development tools must be able to discover:

```text id="v7m4c8"
AGENTS.md
CLAUDE.md
.cursor/rules/
docs/
specs/
```

AI instructions must clearly establish that repository files are authoritative.

---

# 43. Repository Instruction Verification

Before implementation starts, verify that:

```text id="x8c4m7"
AGENTS.md
CLAUDE.md
.cursor/rules/
```

do not contain contradictory instructions.

The repository should have one consistent implementation policy.

---

# 44. Baseline Verification Commands

The exact commands depend on the final package scripts, but the repository must expose equivalent operations for:

```text id="m5n8c4"
Install dependencies
Type check
Lint
Format check
Unit tests
Integration tests
Build
Database migration
Database seed
Development startup
```

Do not allow essential verification to depend on undocumented manual steps.

---

# 45. Codebase Readiness Checklist

Before moving into domain implementation:

```text id="q7c4m8"
[ ] Repository structure verified
[ ] pnpm workspace verified
[ ] TypeScript verified
[ ] Build baseline established
[ ] Lint baseline established
[ ] Formatting baseline established
[ ] Git configuration verified
[ ] Environment configuration verified
[ ] PostgreSQL available
[ ] Database connection verified
[ ] Migration system verified
[ ] Transaction support verified
[ ] Web bootstrap verified
[ ] Worker bootstrap verified
[ ] Graceful shutdown verified
[ ] Health checks verified
[ ] Logging verified
[ ] Error model verified
[ ] Authentication foundation verified
[ ] Tenant context verified
[ ] Authorization foundation verified
[ ] Validation foundation verified
[ ] Shared types verified
[ ] Event infrastructure verified
[ ] Test infrastructure verified
[ ] Test database isolation verified
[ ] Docker/local infrastructure verified
[ ] CI baseline verified
[ ] AI repository instructions verified
```

---

# 46. Readiness Blocking Conditions

Implementation must stop if any of the following remain unresolved:

```text id="v8m4x7"
Broken workspace resolution
Broken TypeScript configuration
Missing database connectivity
Unreliable migrations
No isolated test database
Missing authentication foundation
Missing tenant context
Missing authorization foundation
Secrets exposed in repository
CI unable to execute baseline checks
Contradictory repository instructions
```

Do not build business domains on top of an unstable foundation.

---

# 47. Readiness Exit Criteria

The codebase is ready when:

```text id="x5c8m4"
[ ] A clean checkout can install successfully
[ ] The workspace resolves correctly
[ ] Web starts
[ ] Worker starts
[ ] PostgreSQL starts
[ ] Migrations execute
[ ] Tests can run against isolated data
[ ] Type checking passes
[ ] Linting passes
[ ] Formatting checks pass
[ ] CI baseline passes
[ ] Authentication foundation is operational
[ ] Tenant context is operational
[ ] Authorization foundation is operational
[ ] Configuration validation works
[ ] Logging works
[ ] Errors are handled consistently
```

---

# 48. Definition of Done

Codebase readiness is complete when the repository provides a stable, reproducible foundation for implementing the commerce domains.

The team should be able to begin implementing Stores without first solving unrelated repository, tooling, configuration, database, authentication, or testing problems.

The expected result is:

```text id="m4n8c7"
Clean repository
      +
Reproducible environment
      +
Stable foundation
      +
Reliable verification
      +
Clear implementation boundaries
      ↓
Ready for domain implementation
```