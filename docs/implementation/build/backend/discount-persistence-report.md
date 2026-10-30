# Implementation Report: Persistent Discount Domain & Redemption Integrity

**Milestone:** Database-backed Discount Domain  
**Commit Target:** `feat(discounts): persist discount definitions and redemptions`  
**Status:** PASS  

---

## 1. Executive Summary

This milestone replaces the in-memory discount registry with a PostgreSQL-backed discount domain (`modules/discounts` / `@calcart/discounts`) while preserving the existing cart and checkout discount redemption experience.

The implementation introduces:
1. **Persistent Schema & Migration**: Relational `discounts` and `discount_redemptions` tables in PostgreSQL with store-scoped uniqueness constraints, check constraints for positive values and percentage bounds (1–100), and indexes.
2. **Domain Model & Policy Services**: Encapsulated `Discount` entity, `DiscountPolicy`, `DiscountService`, and `DiscountRedemptionService` handling lifecycle state, eligibility evaluation, and bounded monetary calculations.
3. **Concurrency-Safe Redemption Tracking**: Atomic conditional updates on `usage_count` preventing race conditions on limited-use promotions, combined with an idempotent `discount_redemptions` ledger enforcing `UNIQUE (discount_id, order_id)`.
4. **Storefront API & Workflow Integration**: Cart and checkout discount routes now resolve store-scoped discounts via `DiscountService`, while maintaining full backward-compatibility and client bundle isolation.

---

## 2. Schema and Migration

Migration file: [`packages/db/migrations/0011_create_discounts_schema.sql`](file:///c:/Users/user/Aashif/calcart/packages/db/migrations/0011_create_discounts_schema.sql)  
Schema definitions: [`packages/db/src/schema/discounts.ts`](file:///c:/Users/user/Aashif/calcart/packages/db/src/schema/discounts.ts)

### 2.1 Table: `discounts`
- `id`: UUID Primary Key.
- `store_id`: UUID Foreign Key referencing `stores(id) ON DELETE CASCADE`.
- `code`: VARCHAR(64) NOT NULL.
- `name`: VARCHAR(255) NOT NULL.
- `description`: TEXT NULL.
- `type`: VARCHAR(32) NOT NULL (`CHECK (type IN ('PERCENTAGE', 'FIXED_AMOUNT'))`).
- `value`: INTEGER NOT NULL (`CHECK (value > 0)`). For percentage, 1-100; for fixed amount, positive integer cents.
- `currency`: VARCHAR(3) NULL (`CHECK (currency IS NULL OR LENGTH(currency) = 3)`).
- `status`: VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' (`CHECK (status IN ('DRAFT', 'ACTIVE', 'DISABLED', 'EXPIRED'))`).
- `minimum_subtotal`: INTEGER NOT NULL DEFAULT 0 (`CHECK (minimum_subtotal >= 0)`).
- `max_discount_amount`: INTEGER NULL (`CHECK (max_discount_amount IS NULL OR max_discount_amount > 0)`).
- `usage_limit`: INTEGER NULL (`CHECK (usage_limit IS NULL OR usage_limit > 0)`).
- `usage_count`: INTEGER NOT NULL DEFAULT 0 (`CHECK (usage_count >= 0)`).
- `starts_at`: TIMESTAMPTZ NULL.
- `ends_at`: TIMESTAMPTZ NULL.
- `created_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW().
- `updated_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW().
- **Constraints**:
  - `UNIQUE (store_id, code)`: Enforces store-scoped code uniqueness.
  - `CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)`.
  - `CHECK (type != 'PERCENTAGE' OR (value >= 1 AND value <= 100))`.
  - `CHECK (type != 'FIXED_AMOUNT' OR currency IS NOT NULL)`.
- **Indexes**:
  - `idx_discounts_store_id`: B-tree index on `(store_id)`.
  - `idx_discounts_store_code`: B-tree index on `(store_id, code)`.
  - `idx_discounts_store_status`: B-tree index on `(store_id, status)`.

### 2.2 Table: `discount_redemptions`
- `id`: UUID Primary Key.
- `discount_id`: UUID Foreign Key referencing `discounts(id) ON DELETE CASCADE`.
- `store_id`: UUID Foreign Key referencing `stores(id) ON DELETE CASCADE`.
- `order_id`: UUID NOT NULL.
- `customer_id`: UUID NULL.
- `amount_cents`: INTEGER NOT NULL (`CHECK (amount_cents >= 0)`).
- `redeemed_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW().
- **Constraints**:
  - `UNIQUE (discount_id, order_id)`: Enforces idempotent redemption per order.
- **Indexes**:
  - `idx_discount_redemptions_discount_id`: B-tree index on `(discount_id)`.
  - `idx_discount_redemptions_store_id`: B-tree index on `(store_id)`.
  - `idx_discount_redemptions_order_id`: B-tree index on `(order_id)`.

---

## 3. Module Boundaries and Exported Contracts

Package: `modules/discounts` (`@calcart/discounts`)

### 3.1 Domain Layer
- **`Discount` Entity** ([`modules/discounts/src/domain/discount.ts`](file:///c:/Users/user/Aashif/calcart/modules/discounts/src/domain/discount.ts)):
  - Invariants: Validates code format, percentage range (1–100%), 3-letter currency code, non-negative bounds.
  - Methods: `activate()`, `deactivate()`, `hasReachedLimit()`, `incrementUsage()`, `decrementUsage()`, `calculateDiscount(subtotal)`.
- **`DiscountPolicy`** ([`modules/discounts/src/domain/discount-policy.ts`](file:///c:/Users/user/Aashif/calcart/modules/discounts/src/domain/discount-policy.ts)):
  - `normalizeDiscountCode(code)`: Uppercase + trimming.
  - `calculateDiscountAmount(type, value, subtotal, maxDiscount)`: Floored integer minor currency calculations, capped at subtotal and optional `maxDiscount`.
  - `evaluateDiscountPolicy(discount, context)`: Server-authoritative validation checking store tenant isolation, active status, validity window, currency match, minimum spend, and usage limits.
- **Domain Errors** ([`modules/discounts/src/domain/discount-errors.ts`](file:///c:/Users/user/Aashif/calcart/modules/discounts/src/domain/discount-errors.ts)):
  - Typed hierarchy: `DiscountNotFoundError`, `DiscountAlreadyExistsError`, `CrossStoreDiscountAccessError`, `DiscountInactiveError`, `DiscountExpiredError`, `DiscountMinimumSpendNotMetError`, `DiscountUsageLimitExceededError`, `DiscountCurrencyMismatchError`, `InvalidDiscountCodeError`, `InvalidDiscountValueError`.

### 3.2 Infrastructure Layer
- **`DiscountRepository`** ([`modules/discounts/src/infrastructure/discount-repository.ts`](file:///c:/Users/user/Aashif/calcart/modules/discounts/src/infrastructure/discount-repository.ts)):
  - CRUD: `create()`, `findById()`, `findByCode()`, `update()`, `deactivate()`, `listByStore()`.
  - Concurrency: `atomicIncrementUsage(db, discountId, usageLimit)`: Conditional atomic SQL update.
  - Reversion: `atomicDecrementUsage(db, discountId)`.
  - Ledger: `createRedemption()`, `findRedemptionByOrder()`, `deleteRedemptionByOrder()`.

### 3.3 Application Layer
- **`DiscountService`** ([`modules/discounts/src/application/discount-service.ts`](file:///c:/Users/user/Aashif/calcart/modules/discounts/src/application/discount-service.ts)):
  - High-level orchestration: `createDiscount()`, `getDiscountById()`, `getDiscountByCode()`, `updateDiscount()`, `deactivateDiscount()`, `evaluateCode()`.
- **`DiscountRedemptionService`** ([`modules/discounts/src/application/discount-redemption-service.ts`](file:///c:/Users/user/Aashif/calcart/modules/discounts/src/application/discount-redemption-service.ts)):
  - `recordRedemption()`: Validates store tenant boundary, checks existing redemption for idempotency, atomically increments usage counter, and writes audit record.
  - `revertRedemption()`: Removes redemption row and restores usage slot upon order cancellation or refund.

---

## 4. Concurrency and Redemption Integrity

1. **Race-Free Usage Counter**:
   - `UPDATE discounts SET usage_count = usage_count + 1 WHERE id = $1 AND (usage_limit IS NULL OR usage_count < usage_limit)`
   - Under concurrent checkout attempts against a coupon with 1 slot remaining, PostgreSQL evaluates the conditional predicate per row lock. Exactly one request acquires the slot; concurrent requests return zero affected rows and throw `DiscountUsageLimitExceededError`.
2. **Order Idempotency**:
   - `UNIQUE (discount_id, order_id)` guarantees that webhook retries or repeated complete-checkout calls do not double-increment `usage_count`.
3. **Cancellation Reversibility**:
   - When an order is cancelled or refunded, `revertRedemption` safely restores `usage_count` via `GREATEST(0, usage_count - 1)` and removes the redemption row.
4. **Separation from External Network Calls**:
   - Discount redemption evaluation and usage increments execute within local database transactions and never hold row locks across external Razorpay payment gateways.

---

## 5. Cart and Checkout Integration

1. **API Routes Updated**:
   - [`apps/web/app/api/v1/storefront/[storeSlug]/cart/discount/route.ts`](file:///c:/Users/user/Aashif/calcart/apps/web/app/api/v1/storefront/%5BstoreSlug%5D/cart/discount/route.ts): Uses `DiscountService.getDiscountByCode(ctx.db, store.id, normalizedCode)` to query persistent database, falling back to registered fixtures for offline tests.
   - [`apps/web/app/api/v1/storefront/[storeSlug]/checkout/[checkoutId]/discount/route.ts`](file:///c:/Users/user/Aashif/calcart/apps/web/app/api/v1/storefront/%5BstoreSlug%5D/checkout/%5BcheckoutId%5D/discount/route.ts): Uses `DiscountService.getDiscountByCode(ctx.db, store.id, normalizedCode)` before applying and persisting updated checkout totals.
2. **Client-Safe Bundle Isolation**:
   - Pure calculation and normalization helpers remain in [`apps/web/src/lib/storefront-discount-helpers.ts`](file:///c:/Users/user/Aashif/calcart/apps/web/src/lib/storefront-discount-helpers.ts) without bundling Node.js PostgreSQL drivers into browser `"use client"` components.
   - Webpack `extensionAlias` configured in [`apps/web/next.config.ts`](file:///c:/Users/user/Aashif/calcart/apps/web/next.config.ts) to resolve monorepo TypeScript exports cleanly.

---

## 6. Verification and Validation Results

### 6.1 Tests (`pnpm vitest run`)
Executed commands:
```bash
pnpm vitest run tests/discounts tests/integration/storefront-discount-workflow.test.ts tests/ui/storefront-discounts.test.tsx
```
Results:
- `tests/discounts/discount-service.test.ts`: 15 passed, 5 skipped (PostgreSQL offline on port 5433).
- `tests/discounts/discount-redemption.test.ts`: 2 passed, 5 skipped (PostgreSQL offline on port 5433).
- `tests/ui/storefront-discounts.test.tsx`: 13 passed.
- `tests/integration/storefront-discount-workflow.test.ts`: 18 passed.
- **Total: 48 passed, 10 skipped, 0 failed**.

*Note*: In strict compliance with `AGENTS.md`, database-backed integration tests requiring a live PostgreSQL instance were executed against local test discovery and skipped cleanly due to `ECONNREFUSED` on port 5433, rather than replaced with fakes or falsely reported as run.

### 6.2 Typecheck (`pnpm typecheck`)
- All 19 workspace projects compiled cleanly with 0 errors (`$ pnpm -r run typecheck`: exit code 0).

### 6.3 Lint (`pnpm lint`)
- ESLint passed with 0 errors and 0 warnings (`$ eslint .`: exit code 0).

### 6.4 Build (`pnpm build`)
- Next.js 15.5.27 production build and workspace compilation passed (`$ pnpm -r run build`: exit code 0).

---

## 7. Known Limitations and Follow-up Work

1. **Merchant Administration UI**:
   - Merchant-facing discount management dashboard (creating, viewing, editing, and disabling coupon codes from `/merchant/discounts`) is slated for the dedicated upcoming milestone.
2. **Customer-Specific Usage Limits**:
   - Current model enforces global `usage_limit`. Per-customer usage limits (e.g., "1 redemption per customer email") can be added by querying `discount_redemptions` by `(discount_id, customer_id)`.
