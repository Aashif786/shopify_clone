# ADR-002: PostgreSQL as the Source of Truth

## Status

**Accepted**

## Date

2026-10-07

---

# 1. Decision

PostgreSQL is the **authoritative transactional source of truth** for the commerce platform.

All core business state required for correctness must ultimately be persisted and validated through PostgreSQL.

This includes:

- Organizations.
- Stores.
- Memberships.
- Products.
- Product pricing.
- Inventory.
- Customers.
- Carts.
- Discounts.
- Checkout state.
- Payments.
- Orders.
- Order items.
- Business state transitions.
- Required audit/history records.

Other systems may cache, index, process, transform, or replicate information, but they must not become competing authoritative sources for core commerce state.

---

# 2. Context

The platform contains business operations where data consistency is critical.

Examples include:

```text
Inventory quantity
Payment state
Order state
Product price
Discount eligibility
Customer ownership
Store ownership
```

Incorrect handling of these values can produce serious business problems.

For example:

```text
Customer A ──┐
             ├── Purchase ──> Inventory
Customer B ──┘
```

If both customers attempt to purchase the final available unit, the system must prevent an invalid inventory state.

Similarly:

```text
Payment
   ↓
Order
   ↓
Inventory
```

must have clearly defined transactional behavior.

The architecture therefore requires a reliable system capable of enforcing:

- Transactions.
- Constraints.
- Referential integrity.
- Unique constraints.
- Concurrency control.
- State transitions.
- Durable persistence.

PostgreSQL provides these capabilities while remaining appropriate for the Demo's scale and operational requirements.

---

# 3. Why PostgreSQL

PostgreSQL is selected because it provides strong relational and transactional guarantees while supporting the complexity expected from a commerce platform.

Important capabilities include:

- ACID transactions.
- Foreign keys.
- Unique constraints.
- Check constraints.
- Indexes.
- Row-level locking.
- Transaction isolation.
- Reliable persistence.
- Mature tooling.
- Strong SQL support.
- JSON support where appropriate.
- Migration tooling.
- Good ecosystem support.

These capabilities align directly with the platform's business requirements.

---

# 4. Core Principle

The platform follows:

> **If a piece of data determines business correctness, PostgreSQL must be able to authoritatively represent and validate it.**

Application code may enforce business rules, but database constraints should protect important invariants wherever practical.

For example:

```text
Application Rule
        +
Database Constraint
        =
Stronger Correctness
```

Application validation alone is not considered sufficient protection against concurrency or unexpected access paths.

---

# 5. Data That Must Remain Authoritative in PostgreSQL

## 5.1 Store Data

PostgreSQL owns:

- Store identity.
- Organization relationship.
- Store status.
- Store configuration.
- Ownership relationships.

---

## 5.2 Product Data

PostgreSQL owns:

- Product identity.
- Product attributes.
- Product status.
- Product pricing.
- Store ownership.
- Publication state.

External search indexes or caches may contain copies of product data, but PostgreSQL remains authoritative.

---

## 5.3 Inventory

PostgreSQL owns:

- Inventory records.
- Available quantities.
- Reserved quantities where applicable.
- Inventory adjustments.
- Inventory state.

Inventory correctness must not depend on a cache.

A cache may accelerate reads.

It must not determine whether a purchase is allowed.

---

## 5.4 Orders

PostgreSQL owns:

- Order identity.
- Customer relationship.
- Store relationship.
- Order items.
- Monetary totals.
- Order status.
- Payment references.
- Historical snapshots.
- Order timestamps.

Historical order information must remain stable even if the underlying product later changes.

For example:

```text
Product Name Today
        ≠
Product Name at Purchase
```

Therefore, order records should preserve the information necessary to represent the historical transaction.

---

## 5.5 Payments

PostgreSQL owns the platform's internal payment state.

For example:

```text
Payment Attempt
    ↓
pending
    ↓
authorized
    ↓
captured
    ↓
failed
```

The external payment provider owns the external payment transaction, but the platform's internal representation remains in PostgreSQL.

Provider APIs are not treated as the application's primary database.

---

# 6. External Systems Are Not Sources of Truth for Core Commerce State

External systems may provide services such as:

- Payment processing.
- Object storage.
- Email delivery.
- Search.
- Caching.
- Analytics.
- Monitoring.

Their responsibilities are isolated from the platform's transactional database.

For example:

```text
PostgreSQL
    │
    ├── Payment Provider
    ├── Object Storage
    ├── Email Provider
    ├── Search Index
    └── Analytics
```

These systems consume or process platform state.

They do not replace PostgreSQL as the authoritative source for core business state.

---

# 7. Caching

Caching may be introduced when performance requires it.

A cache is considered:

```text
Derived Data
```

not:

```text
Authoritative Data
```

For example:

```text
PostgreSQL
     ↓
Cache
     ↓
Fast Read
```

If the cache disappears:

```text
Cache Lost
    ↓
Read PostgreSQL
    ↓
Rebuild Cache
```

The system must remain correct.

No critical business operation should require an existing cache entry to determine the authoritative state.

---

# 8. Search Indexes

A future search engine may maintain a product index.

For example:

```text
PostgreSQL
     ↓
Product Change
     ↓
Search Index
```

The search index may become temporarily stale.

That is acceptable for search functionality.

It is not acceptable for:

- Inventory correctness.
- Payment state.
- Order state.
- Authorization.
- Store ownership.
- Financial calculations.

Search infrastructure therefore remains a derived representation.

---

# 9. Object Storage

Media files such as product images may be stored in object storage.

PostgreSQL stores the metadata required to reference those objects.

Conceptually:

```text
PostgreSQL
 └── Media Record
      ├── object key
      ├── store
      └── metadata

Object Storage
 └── Actual File
```

The object itself does not need to be stored in PostgreSQL.

However, ownership and metadata required by the application remain transactionally managed through PostgreSQL.

---

# 10. Transactions

Transactions must be used when multiple changes must succeed or fail together.

Example:

```text
Create Order
    +
Record Order Items
    +
Update Inventory
```

If these operations form one atomic business operation, they should execute within an appropriate transaction boundary.

Conceptually:

```text
BEGIN

Validate operation
Create order
Update inventory
Persist required state

COMMIT
```

If a failure occurs:

```text
ROLLBACK
```

The exact transaction boundaries belong to the relevant domain/application design.

---

# 11. Concurrency Control

PostgreSQL must be used to protect critical concurrent operations.

Examples include:

- Inventory updates.
- Order creation.
- Payment state transitions.
- Unique resource creation.
- Idempotency records.
- Other business operations where concurrent requests can conflict.

Application-level checks such as:

```text
if stock > 0
    purchase()
```

are not sufficient by themselves.

Two requests can observe the same state before either writes.

Database transactions and appropriate locking/constraints must therefore protect the final invariant.

---

# 12. Database Constraints

Important invariants should be reinforced using database constraints where practical.

Examples include:

- Foreign keys.
- Unique constraints.
- Not-null constraints.
- Check constraints.
- Composite uniqueness.
- Referential integrity.

Constraints should prevent impossible states rather than relying entirely on application discipline.

---

# 13. Migrations

Database schema changes must be managed through version-controlled migrations.

The expected process is:

```text
Schema Change
     ↓
Migration
     ↓
Review
     ↓
Test
     ↓
Apply
```

Developers must not rely on manually modifying production database schemas.

Migrations must be:

- Version controlled.
- Reproducible.
- Reviewable.
- Tested.
- Compatible with the application's deployment process.

---

# 14. Application Database Access

Business modules should access PostgreSQL through controlled infrastructure.

Conceptually:

```text
Application Service
       ↓
Domain Logic
       ↓
Repository / Persistence Layer
       ↓
PostgreSQL
```

Presentation code should not directly manipulate database tables.

A module must not bypass another module's ownership boundary simply because its table happens to be accessible.

---

# 15. Data Ownership

Each major business domain has an owning module.

For example:

| Data | Owning Module |
|---|---|
| Organizations | Stores |
| Stores | Stores |
| Products | Products |
| Inventory | Inventory |
| Customers | Customers |
| Carts | Carts |
| Discounts | Discounts |
| Checkout State | Checkout |
| Payments | Payments |
| Orders | Orders |

Other modules may reference or consume information through defined interfaces.

They should not silently become secondary owners of the same business state.

---

# 16. Historical Data

Commerce records must preserve historical correctness.

For example, if a product price changes:

```text
Product
Current Price = ₹1,500
```

an existing order must not suddenly appear to have been purchased at ₹1,500 if it was originally purchased at ₹1,200.

Therefore, transaction records such as order items must preserve the relevant historical values.

Typical snapshots may include:

- Product name.
- SKU.
- Unit price.
- Discount amount.
- Tax amount where applicable.
- Quantity.
- Relevant pricing information.

The exact schema belongs to the database and order-domain documentation.

---

# 17. Idempotency

PostgreSQL should support idempotency for operations where duplicate requests can produce incorrect results.

Examples include:

- Payment callbacks.
- Checkout completion.
- Order creation.
- Inventory operations.
- Webhook processing.

A typical pattern is:

```text
Request
  ↓
Idempotency Key
  ↓
Check Existing Operation
  ↓
Execute Once
  ↓
Persist Result
```

Database constraints should be used where they can provide reliable duplicate protection.

---

# 18. Payment Provider State

The payment provider may know about an external payment transaction before the application receives the corresponding webhook or response.

Therefore:

```text
External Provider State
        +
Internal PostgreSQL State
```

must be reconciled through defined integration behavior.

The application must not assume that a network response alone represents the complete payment lifecycle.

Webhook processing and retries must be idempotent.

---

# 19. Failure Recovery

If PostgreSQL is temporarily unavailable, critical business operations should fail safely.

The system must not:

- Pretend that an order was created.
- Pretend that payment succeeded.
- Invent inventory state.
- Silently discard transactional changes.

The application should return an appropriate failure response and allow safe retry where applicable.

---

# 20. Backups and Recovery

PostgreSQL data must be backed up according to the deployment environment.

The production strategy should eventually include:

- Automated backups.
- Backup retention.
- Restore testing.
- Point-in-time recovery where supported.
- Recovery procedures.

The Demo may use simpler infrastructure, but the data model must not depend on disposable storage.

---

# 21. Read Replicas

Read replicas are not required for Demo.

They may be introduced later if read workload becomes a measurable bottleneck.

If introduced:

```text
Primary
  ↓
Authoritative Writes

Replica
  ↓
Eligible Read Workloads
```

Critical read-after-write operations must account for replication lag.

A replica must never become an independent source of truth.

---

# 22. Future Database Evolution

As the platform grows, PostgreSQL may evolve through:

```text
Demo
  ↓
Managed PostgreSQL
  ↓
Connection Pooling
  ↓
Read Replicas
  ↓
Partitioning
  ↓
Further Scaling
```

The exact sequence will depend on measured requirements.

Sharding or multiple databases should not be introduced until there is a demonstrated need.

---

# 23. Consequences

## Positive Consequences

- Strong transactional guarantees.
- Centralized business state.
- Reliable referential integrity.
- Easier consistency management.
- Simpler architecture.
- Easier local development.
- Easier integration testing.
- Clear data ownership.
- Straightforward backup strategy.

## Negative Consequences

- PostgreSQL becomes a critical infrastructure dependency.
- Very high scale may require additional architecture.
- Some workloads may eventually need specialized storage.
- Database contention must be monitored.
- Careless schema design can create performance problems.

These consequences are accepted for Demo.

---

# 24. What PostgreSQL Is Not

PostgreSQL is not required to store every type of data in the platform.

It is not intended to replace:

- Object storage for large media files.
- Search engines for specialized search workloads.
- Caches for performance optimization.
- Analytics warehouses for large analytical workloads.
- External payment providers.
- Email delivery services.

The principle is:

> **PostgreSQL owns core business truth, not every byte produced by the platform.**

---

# 25. Decision Rules

When evaluating a new datastore or external storage system, the following questions must be answered:

1. What problem does the new system solve?
2. Why is PostgreSQL insufficient?
3. Is the new system authoritative or derived?
4. What happens if it becomes unavailable?
5. How is consistency maintained?
6. How is data recovered?
7. Who owns the data?
8. How is it tested?
9. What operational complexity does it introduce?
10. Can the system be introduced without weakening core business correctness?

If the system is intended to become authoritative for existing core commerce state, the decision requires an explicit architecture review.

---

# 26. Related Decisions

This ADR is related to:

- `ADR-001-modular-monolith.md`
- `ADR-003-monorepo-structure.md`

Related architecture documents:

- `docs/database/data-ownership.md`
- `docs/domain/domain-boundaries.md`
- `docs/architecture/system-overview.md`
- `docs/architecture/module-boundaries.md`
- `docs/architecture/integration-architecture.md`

---

# 27. Final Decision

PostgreSQL is the **authoritative transactional source of truth** for the Demo platform.

The architecture will use external systems, caches, indexes, and derived data stores when they provide clear value, but none of them may silently become a competing source of truth for core commerce state.

The governing principle is:

> **Optimize around the source of truth. Do not replace the source of truth merely because another system is fashionable.**