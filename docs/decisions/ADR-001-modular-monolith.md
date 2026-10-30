# ADR-001: Modular Monolith

## Status

**Accepted**

## Date

2026-10-07

---

# 1. Decision

The Demo platform will be implemented as a **modular monolith**.

The application will run as a small number of runtime applications while maintaining explicit internal boundaries between business modules.

The primary runtime applications are:

```text
apps/
├── web/
└── worker/
```

The business capabilities are organized into modules:

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

The modules will remain logically separated even though they initially execute within the same deployment environment.

---

# 2. Context

The platform is intended to become a Cal Cart commerce system.

The Demo must be:

- Functional.
- Multi-tenant.
- Transactionally correct.
- Secure.
- Testable.
- Maintainable.
- Capable of evolving toward V1.

At the same time, the Demo does not yet require:

- Massive scale.
- Independent service deployment.
- Multi-region infrastructure.
- Distributed databases.
- Complex event streaming.
- Service meshes.
- Large infrastructure teams.

Building a microservice architecture before these requirements exist would introduce significant operational complexity without providing proportional value.

The architecture therefore needs to balance:

```text
Simplicity
    +
Correctness
    +
Clear Boundaries
    +
Future Evolution
```

---

# 3. Considered Alternatives

## 3.1 Traditional Monolith

A single application with loosely organized business logic.

Conceptually:

```text id="5f9a8r"
Application
 ├── Products
 ├── Orders
 ├── Payments
 ├── Inventory
 └── Everything Else
```

### Advantages

- Simple deployment.
- Simple local development.
- Low infrastructure overhead.
- Easy debugging initially.

### Disadvantages

- Business boundaries tend to become unclear.
- Modules can become tightly coupled.
- Shared database access can become uncontrolled.
- Business logic tends to spread across unrelated areas.
- Future extraction becomes more difficult.

### Decision

Rejected.

The platform needs stronger internal boundaries than a conventional monolith typically provides.

---

# 4. Microservices

Each major business capability could be deployed independently.

For example:

```text id="z0b1x5"
Products Service
Inventory Service
Checkout Service
Payments Service
Orders Service
Customers Service
```

### Advantages

- Independent deployment.
- Independent scaling.
- Strong runtime isolation.
- Independent technology choices.
- Potentially useful for large teams and high-scale workloads.

### Disadvantages

- Operational complexity.
- Distributed transactions.
- Network failures.
- Service discovery.
- More infrastructure.
- More deployment pipelines.
- More monitoring requirements.
- More complicated local development.
- Increased testing complexity.
- More difficult debugging.
- Potentially duplicated infrastructure.

For the current Demo, these costs are not justified.

### Decision

Rejected for Demo.

Microservices may become appropriate for selected domains in V1 or later if concrete requirements justify extraction.

---

# 5. Modular Monolith

The selected approach combines a single primary application architecture with explicit internal domain boundaries.

```text id="q9r8jk"
                 Modular Monolith
                       │
       ┌───────────────┼────────────────┐
       ▼               ▼                ▼
   Products        Inventory          Orders
       │               │                │
       └───────────────┼────────────────┘
                       ▼
                  PostgreSQL
```

### Advantages

- Simple deployment.
- Simple local development.
- Low infrastructure complexity.
- Clear business boundaries.
- Easier transactions.
- Easier debugging.
- Shared code without uncontrolled coupling.
- Easier future service extraction.
- Strong testing boundaries.

### Disadvantages

- Modules share the same runtime.
- One deployment affects multiple modules.
- Runtime isolation is weaker than true services.
- Teams must actively enforce module boundaries.
- Poor discipline can still turn it into a traditional monolith.

### Decision

Accepted.

---

# 6. Why Modular Monolith Fits Demo

The current requirements favor:

```text id="6du5c4"
Strong Domain Boundaries
        +
Simple Deployment
        +
Transactional Database
        +
Small Infrastructure
```

rather than:

```text id="7p6a3r"
Many Services
        +
Distributed Infrastructure
        +
Distributed Transactions
```

The Demo's most important problems are business correctness and product validation, not service-scale operations.

---

# 7. Architectural Requirements

The modular monolith MUST enforce:

### Module Ownership

Each business concept has one owning module.

### Public Interfaces

Cross-module interactions use controlled public interfaces.

### No Internal Imports

Modules must not depend on another module's internal implementation.

### Data Ownership

Modules own their business state.

### Tenant Isolation

Store-owned resources remain isolated.

### Shared Domain Rules

Business rules are not duplicated between modules.

---

# 8. Module Boundaries

The initial module ownership is:

| Module | Ownership |
|---|---|
| Stores | Organizations and stores |
| Products | Product catalog |
| Inventory | Inventory and stock |
| Customers | Customer identity |
| Carts | Shopping carts |
| Discounts | Discount rules |
| Checkout | Purchase orchestration |
| Payments | Payment lifecycle |
| Orders | Orders and transaction history |

These boundaries represent business ownership rather than deployment boundaries.

---

# 9. Runtime Applications

The modular monolith uses:

```text id="7t2kqs"
apps/web
apps/worker
```

### Web

Handles synchronous requests.

### Worker

Handles asynchronous processing.

Both may invoke the same business modules.

Neither application should maintain an independent implementation of domain rules.

---

# 10. Database Strategy

PostgreSQL is the transactional source of truth.

The modular monolith allows related business operations to use database transactions where appropriate.

For example:

```text id="7g0z1w"
Checkout
   ↓
Inventory
   ↓
Order
```

can be coordinated more easily inside a single application and transactional database than across independent services.

This is particularly important for Demo correctness.

---

# 11. Transactional Benefits

A modular monolith makes it easier to maintain atomic business operations.

For example:

```text id="b4u7dy"
Transaction
 ├── Validate / change inventory
 ├── Create order
 └── Persist required state
       ↓
     Commit
```

A distributed microservice architecture would introduce additional complexity around:

- Distributed transactions.
- Compensation.
- Eventual consistency.
- Failure recovery.

That complexity is unnecessary for the current requirements.

---

# 12. Operational Benefits

The selected architecture reduces the initial operational footprint.

The Demo can be deployed as:

```text id="2vl9me"
VPS
 ├── Web
 ├── Worker
 └── PostgreSQL / Managed PostgreSQL
```

instead of requiring:

```text id="6j9m2k"
Multiple Services
Multiple Deployments
Service Discovery
Message Infrastructure
Distributed Observability
Multiple Datastores
```

This keeps the system manageable for a small development team.

---

# 13. Development Benefits

The modular monolith provides:

- One repository.
- One dependency management system.
- Shared types.
- Shared tooling.
- Easier local debugging.
- Easier integration testing.
- Easier end-to-end testing.
- Atomic changes across related modules.

The standard package manager is:

```text id="b4d3n2"
pnpm
```

---

# 14. Testing Benefits

The module structure enables testing at multiple levels.

```text id="d9y0m2"
Module Unit Tests
       ↓
Application Tests
       ↓
Integration Tests
       ↓
End-to-End Tests
```

A module can be tested without deploying it as a separate service.

This provides many of the development benefits of service boundaries without the operational cost of service deployment.

---

# 15. Future Service Extraction

The modular architecture intentionally leaves room for future extraction.

Potential candidates include:

- Payments.
- Search.
- Notifications.
- Analytics.
- Media processing.

The extraction process should be:

```text id="2c8jv4"
Stable Module Boundary
        ↓
Real Scaling / Isolation Requirement
        ↓
Service Boundary
        ↓
Network Interface
        ↓
Independent Deployment
```

The existence of a module does not imply that it should become a service.

---

# 16. Consequences

## Positive Consequences

### Simpler Infrastructure

The Demo can run with a small infrastructure footprint.

### Easier Transactions

Critical commerce operations can use database transactions more naturally.

### Lower Operational Cost

Fewer services require fewer deployment and monitoring systems.

### Faster Development

Developers can work across related modules without coordinating multiple services.

### Strong Domain Boundaries

The codebase remains organized around business capabilities.

### Future Flexibility

Well-defined modules can later be extracted if required.

---

# 17. Negative Consequences

### Shared Runtime

A runtime failure can affect multiple modules.

### Shared Deployment

Modules cannot initially be deployed independently.

### Boundary Discipline Required

Developers must actively prevent cross-module coupling.

### Shared Database

All modules initially rely on the same PostgreSQL system.

### Scaling Granularity

Individual modules cannot independently scale at runtime until extracted or otherwise isolated.

These limitations are accepted for Demo.

---

# 18. Risks

## Risk 1 — Monolith Becomes a Blob

If developers bypass module boundaries, the system may degrade into a traditional monolith.

### Mitigation

- Explicit module ownership.
- Public interfaces.
- Code review.
- Architecture documentation.
- Automated checks where practical.

---

## Risk 2 — Shared Database Coupling

Modules may begin accessing each other's tables directly.

### Mitigation

- Explicit data ownership.
- Repository boundaries.
- Public module interfaces.
- Database architecture rules.

---

## Risk 3 — Premature Service Extraction

The team may extract services before requirements justify them.

### Mitigation

Service extraction requires a concrete architectural reason such as:

- Scale.
- Isolation.
- Team ownership.
- Independent deployment.
- Reliability.

---

## Risk 4 — Shared Package Abuse

Developers may move business logic into shared packages to avoid module boundaries.

### Mitigation

Shared packages should contain technical or genuinely cross-cutting capabilities, not arbitrary domain logic.

---

# 19. Decision Rules

Future architectural decisions should preserve this decision unless new requirements demonstrate that it is no longer appropriate.

Before introducing a new service, ask:

1. What problem does the service solve?
2. Why can't the existing module solve it?
3. Does it require independent scaling?
4. Does it require independent deployment?
5. Does it require stronger isolation?
6. What new operational complexity does it introduce?
7. What happens when the service is unavailable?
8. How will transactions work across the boundary?
9. How will the service be tested locally?
10. Who owns and operates it?

If these questions cannot be answered clearly, the new service should not be introduced yet.

---

# 20. When This ADR Should Be Revisited

This decision should be reconsidered when one or more of the following become true:

- A module has materially different scaling requirements.
- Independent deployment becomes necessary.
- Runtime isolation becomes necessary.
- A separate team owns a domain.
- Service-level reliability requirements differ.
- A domain requires infrastructure that cannot reasonably remain inside the monolith.
- The database or runtime becomes a measurable bottleneck.

The decision should be revisited based on evidence, not architectural fashion.

---

# 21. Related Decisions

This ADR is related to:

- `ADR-002-postgresql-source-of-truth.md`
- `ADR-003-monorepo-structure.md`

It is also supported by:

- `docs/architecture/system-overview.md`
- `docs/architecture/application-architecture.md`
- `docs/architecture/module-boundaries.md`
- `docs/architecture/demo-to-v1-evolution.md`

---

# 22. Final Decision

The Demo will use a **modular monolith**.

The architecture will prioritize:

```text id="7i4h2z"
Strong Domain Boundaries
          +
Transactional Correctness
          +
Simple Infrastructure
          +
Future Evolution
```

The platform will not introduce microservices merely to appear scalable.

Services may be introduced later when real requirements justify the operational and architectural complexity.

> **Build the domain boundaries now. Distribute them only when the system gives us a reason to.**