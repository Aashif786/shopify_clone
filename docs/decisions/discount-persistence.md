# ADR-007: Persistent Discount Domain and Redemption Integrity

## Status

**Accepted**

## Date

2026-10-12

## Context

The demo milestone implemented discount normalization, eligibility evaluation, and monetary calculations using an in-process, memory-resident registry (`discountStoreRegistry`). While this provided an interactive storefront demonstration, it suffered from critical operational shortcomings:

1. **Lack of Durability**: All merchant-defined discounts and usage counters were lost across server restarts or worker reinitialization.
2. **Multi-Process Inconsistency**: Multiple web or background worker instances could not share authoritative discount definitions or redemption counts.
3. **Vulnerability to Race Conditions**: Concurrent redemption attempts against a coupon with a configured `usage_limit` could overshoot the quota due to the absence of database-level row locking or conditional atomic increments.
4. **Audit and Idempotency Absence**: No persistent redemption ledger existed to verify which discount was redeemed by which order, preventing reliable reconciliation, duplicate event protection, and cancellation/refund restitution.

The platform requires a production-grade, PostgreSQL-backed discount domain that adheres to the established modular monolith architecture, enforces multi-tenant store isolation, and integrates seamlessly with checkout and order lifecycles.

---

## Decision

The platform adopts a **dedicated persistent domain module (`modules/discounts`) backed by PostgreSQL** with strict tenant boundaries, atomic conditional usage increments, and an audit-ready redemption ledger.

### 1. Architectural Structure

- **Domain Module**: `modules/discounts` encapsulating domain entities (`Discount`), domain policies (`DiscountPolicy`), domain state & errors, application services (`DiscountService`, `DiscountRedemptionService`), and infrastructure repositories (`DiscountRepository`).
- **Database Schema**: Managed in `packages/db` via migration `0011_create_discounts_schema.sql`, defining two relational tables:
  - `discounts`: Stores definition, type (`PERCENTAGE` or `FIXED_AMOUNT`), integer value, status, spend threshold, caps, validity timestamps, and usage counters.
  - `discount_redemptions`: Audit and idempotency ledger recording redemptions linked to specific orders, stores, and customers.
- **Storefront Integration**: Server API routes (`cart/discount` and `checkout/[checkoutId]/discount`) query `DiscountService` for store-scoped definitions. Storefront client components consume pure, client-safe helpers without bundling database drivers.

### 2. Multi-Tenancy and Data Isolation

- Every discount and redemption record is strictly scoped to `store_id`.
- Store-scoped uniqueness is enforced at the database level: `UNIQUE (store_id, code)` ensuring Store A and Store B can independently utilize the same marketing code (e.g., `SUMMER20`) without conflict.
- Foreign keys enforce cascade deletion from stores (`ON DELETE CASCADE`).

### 3. Concurrency and Redemption Integrity

- **Atomic Usage Updates**: Redemptions increment `usage_count` conditionally via:
  ```sql
  UPDATE discounts
  SET usage_count = usage_count + 1, updated_at = NOW()
  WHERE id = $1 AND (usage_limit IS NULL OR usage_count < usage_limit)
  RETURNING *;
  ```
  If zero rows are returned, the slot has been exhausted, raising `DiscountUsageLimitExceededError`.
- **Idempotency Guard**: `discount_redemptions` enforces `UNIQUE (discount_id, order_id)`. Repeated checkout completion or webhook delivery returns the existing redemption record without incrementing `usage_count`.
- **Reversibility**: Order cancellation, payment failure, or refunds trigger `revertRedemption`, which deletes the redemption row and atomically decrements `usage_count`, restoring the usage slot for customers.

---

## Alternatives Considered

1. **In-Memory Registry with Periodic Redis Sync**:
   - *Rejected*: Adds extraneous infrastructure dependencies; does not satisfy ACID transactional guarantees with PostgreSQL order mutations; violates monorepo design principles.
2. **Single-Table Counter Without Redemption Ledger**:
   - *Rejected*: Lacks order-level auditability; cannot detect duplicate completion events; cannot reliably restore usage slots upon order refund or payment cancellation.
3. **Full Merchant Administration Endpoint in this Milestone**:
   - *Deferred*: Merchant discount administration UI and CRUD API will be implemented as a dedicated following milestone on top of this stable persistence foundation.

---

## Consequences

### Positive

- **True Persistence**: Discounts and redemption counters survive process restarts and scale horizontally across cluster nodes.
- **Race Condition Prevention**: Conditional SQL updates prevent usage-limit oversubscription under concurrent shopping bursts.
- **Idempotent Webhooks & Retries**: Repeated order completion events safely return the existing redemption without double-counting.
- **Clean Boundaries**: Domain business rules remain inside `modules/discounts` while API handlers remain thin.
- **Preserved Storefront Experience**: Zero regression in cart and checkout user workflows.

### Negative / Trade-Offs

- Requires database migration `0011_create_discounts_schema.sql` to be run before persistent queries execute.
- Fallback in-memory registry retained solely for offline mock tests and backward compatibility.

---

## Migration Approach

1. Database migration `0011_create_discounts_schema.sql` added to `packages/db/migrations/`.
2. Schema typings exported in `packages/db/src/schema/discounts.ts`.
3. `@shopify-clone/discounts` module created and linked across workspace.
4. Existing storefront routes and helpers updated to query persistent `DiscountService` first.
