# Orders Task 1: Database Schema and Migrations Implementation Report

## 1. Executive Summary

This report documents the implementation of the foundational Orders database schema and the resolution of deferred foreign-key dependencies from the Payments domain for the Cal Cart platform Demo.

The implementation strictly adheres to `specs/orders/order-spec.md`, `specs/orders/order-implementation.md`, `specs/payments/payment-spec.md`, and `AGENTS.md`. It adds forward migration `0010_create_orders_schema.sql`, implementing store-level multi-tenant isolation, immutable historical snapshots of products and addresses, order status audit trails, integer minor unit monetary fields, and composite foreign-key integrity. It resolves the deferred foreign keys from `payments.order_id` and `refunds.order_id` to `orders (id, store_id)` while preserving the canonical non-null invariant on `refunds.order_id`.

---

## 2. Files Changed and Their Responsibilities

1. **`packages/db/migrations/0010_create_orders_schema.sql`**:
   - Defines the PostgreSQL tables: `orders`, `order_items`, `order_addresses`, and `order_status_history`.
   - Establishes store-level tenant boundaries with composite uniqueness `UNIQUE (id, store_id)`.
   - Adds constraints for valid order statuses, fulfillment statuses, payment statuses, and non-negative financial values.
   - Resolves deferred foreign keys:
     - `payments (order_id, store_id) REFERENCES orders (id, store_id) ON DELETE SET NULL (order_id)`
     - `refunds (order_id, store_id) REFERENCES orders (id, store_id) ON DELETE RESTRICT`
2. **`packages/db/src/schema/orders.ts`**:
   - TypeScript domain row types and input interfaces: `OrderRow`, `CreateOrderRowInput`, `OrderItemRow`, `CreateOrderItemRowInput`, `OrderAddressRow`, `CreateOrderAddressRowInput`, `OrderStatusHistoryRow`, `CreateOrderStatusHistoryRowInput`.
   - String literal union types: `OrderStatus`, `OrderPaymentStatus`, `OrderFulfillmentStatus`, `OrderAddressType`, `OrderStatusHistoryActorType`.
3. **`packages/db/src/repositories/orders.ts`**:
   - `OrderRepository` providing operations for:
     - `create`: Inserts order records with monetary defaults.
     - `findById`: Store-scoped order query.
     - `findByIdForUpdate`: Pessimistic row locking (`SELECT ... FOR UPDATE`) within transactions.
     - `findByOrderNumber`: Store-scoped lookup by human-readable order number.
     - `findByCheckoutId`: Idempotent order correlation by checkout ID.
     - `updateStatus`: Transitions order status and updates related metadata.
     - `createItem` / `findItemsByOrderId`: Persistence and retrieval of immutable line item snapshots.
     - `createAddress` / `findAddressesByOrderId`: Persistence and retrieval of billing/shipping address snapshots.
     - `createStatusHistory` / `findStatusHistoryByOrderId`: Persistence and retrieval of status transition audit records.
4. **`packages/db/src/index.ts`**:
   - Re-exports `schema/orders.js` and `repositories/orders.js` from the `@calcart/db` package.
5. **`tests/orders/order.schema.test.ts`**:
   - 20 comprehensive database-backed integration tests verifying tables, constraints, monetary rules, snapshot immutability, cascade/restrict deletion rules, composite tenant isolation, payments/refunds foreign keys, and repository methods.
6. **`tests/payments/payment.schema.test.ts` & `tests/payments/refund.service.test.ts`**:
   - Updated test seed fixtures so that refund test scenarios reference real persisted order rows in `orders`, ensuring full regression compatibility with the resolved `refunds_order_store_fkey` constraint.

---

## 3. Orders and Order-Item Schema Decisions

- **Integer Minor Units**:
  Consistent with Payments and Checkout, all monetary values (`subtotal`, `discount_total`, `shipping_total`, `tax_total`, `total`, `grand_total`, `unit_price`, `discount_amount`, `tax_amount`, `line_total`) are stored as `BIGINT` minor units (e.g. cents/paise) with non-negative check constraints (`>= 0`).
- **Currency Invariant**:
  `currency` is strictly constrained to uppercase 3-letter ISO-4217 format (`CHECK (currency = UPPER(TRIM(currency)) AND LENGTH(currency) = 3)`).
- **Immutable Purchase Snapshots**:
  `order_items` stores `product_name_snapshot`, `variant_name_snapshot`, and `sku_snapshot` directly. Foreign keys to `products` and `product_variants` are configured with `ON DELETE SET NULL`, ensuring historical orders remain fully legible, accurate, and intact even if catalogue items are deleted or modified.
- **Address Immutability**:
  `order_addresses` stores historical billing and shipping address copies, decoupled from customer profile address updates, with `UNIQUE (order_id, type)` ensuring at most one billing and one shipping address per order.
- **Audit History**:
  `order_status_history` captures transition audit logs with `actor_type` constrained to `'CUSTOMER'`, `'MERCHANT'`, or `'SYSTEM'`.
- **Order Numbering**:
  `order_number` is unique per store (`UNIQUE (store_id, order_number)`), permitting independent human-readable numbering sequences across tenants.
- **Checkout Idempotency**:
  A partial unique index `orders_store_checkout_idx` on `(store_id, checkout_id) WHERE checkout_id IS NOT NULL` prevents duplicate order creation for the same checkout.

---

## 4. Migration Number and Ordering

- **Migration Number**: `0010_create_orders_schema.sql`.
- **Sequence**:
  1. `0001_initial_identity.sql` (Organizations, Stores, Users)
  2. `0002_create_store_settings.sql`
  3. `0003_create_products_schema.sql` (Products, Variants)
  4. `0004_create_inventory_schema.sql`
  5. `0005_add_inventory_adjustment_reference_unique.sql`
  6. `0006_create_customers_schema.sql`
  7. `0007_create_carts_schema.sql`
  8. `0008_create_checkout_schema.sql` (Checkouts, Checkout Items)
  9. `0009_create_payments_schema.sql` (Payments, Attempts, Webhooks, Refunds, Idempotency)
  10. `0010_create_orders_schema.sql` (Orders, Items, Addresses, History + Deferred Payments/Refunds FKs)
- **Ordering Justification**:
  Migration 0010 executes forward. Because the `orders` table is created in 0010, the deferred foreign-key constraints on `payments.order_id` and `refunds.order_id` are added within 0010 after the `orders` table is declared.

---

## 5. Payment and Refund Foreign-Key Implementation

### `payments.order_id`
- **Schema**: Added constraint `CONSTRAINT payments_order_store_fkey FOREIGN KEY (order_id, store_id) REFERENCES orders (id, store_id) ON DELETE SET NULL (order_id)`.
- **Rationale**: `payments.order_id` is nullable because payments are created and authorized during checkout before an order exists. When the order is created, the order ID is linked. If the order is deleted, the payment record is preserved with `order_id = NULL`.

### `refunds.order_id`
- **Schema**: Added constraint `CONSTRAINT refunds_order_store_fkey FOREIGN KEY (order_id, store_id) REFERENCES orders (id, store_id) ON DELETE RESTRICT`.
- **Rationale**: A refund is an authoritative financial reversal tied to an order. Deleting an order that has processed refunds is strictly restricted (`ON DELETE RESTRICT`) to prevent orphaned financial records.

---

## 6. Refund Lifecycle Compatibility and Nullability Decision (INT-03)

### Decision: `refunds.order_id` REMAINS `NOT NULL`
- **Canonical Specification**: `specs/payments/payment-spec.md` line 875 explicitly defines `order_id UUID NOT NULL` and `CONSTRAINT refunds_order_store_fkey FOREIGN KEY (order_id, store_id) REFERENCES orders (id, store_id) ON DELETE RESTRICT`.
- **Domain Alignment**: In `specs/orders/order-spec.md` (Sections 19, 36–38, 611), refunds are coordinated strictly through the order lifecycle (e.g. cancellation, returns).
- **Checkout Completion Architecture**: In `docs/domain/cross-domain-workflows.md` (Section 29), any captured payment triggers checkout completion and idempotent order creation. If a crash occurs post-capture, a background recovery worker finishes order creation. Captured payments are never left in an orphaned state without an order.
- **Integrity Guarantee**: We rejected weakening `order_id` to nullable and rejected generating fake orders. Every refund legitimately represents an order refund. Test fixtures in `tests/payments/` were updated to seed real orders rather than using dummy unpersisted UUIDs.

---

## 7. Tenant Integrity Considerations

- All order domain tables contain `store_id UUID NOT NULL REFERENCES stores (id) ON DELETE RESTRICT`.
- `orders` enforces `UNIQUE (id, store_id)`.
- Subordinate tables (`order_items`, `order_addresses`, `order_status_history`) use composite foreign keys `FOREIGN KEY (order_id, store_id) REFERENCES orders (id, store_id)` with `ON DELETE CASCADE`.
- Cross-tenant references (e.g. customer from Store A on an order in Store B, or checkout from Store A on an order in Store B) are rejected at the database level via composite foreign keys.
- Both deferred foreign keys (`payments_order_store_fkey` and `refunds_order_store_fkey`) use composite `(order_id, store_id)` to guarantee payments and refunds can only reference orders belonging to the identical store tenant.

---

## 8. Integration Debt Items (INT-02 & INT-03)

| Debt Item | Description | Status | Evidence |
| :--- | :--- | :--- | :--- |
| **INT-02** | Deferred `payments.order_id` and `refunds.order_id` foreign keys | **RESOLVED** | Added composite foreign keys in migration `0010_create_orders_schema.sql`. Verified with database-backed integration tests in `tests/orders/order.schema.test.ts`. |
| **INT-03** | `refunds.order_id` nullability and refund lifecycle | **RESOLVED** | Confirmed canonical requirement: `refunds.order_id` remains `NOT NULL` with `REFERENCES orders (id, store_id) ON DELETE RESTRICT`. Regression test fixtures updated to seed valid order entities. |
| **Integration Debt Register** | Standalone register file | **NOT PRESENT** | The repository does not maintain an `integration-debt-register.md` file; status is tracked in implementation reports. |

---

## 9. Tests Executed and Exact Results

### 1. Orders Schema Test Suite
- `tests/orders/order.schema.test.ts`: **20 passed (20)** (31.48s)
  - Table existence and migration 0010 execution
  - Valid order creation with minor unit amounts
  - Invalid order status rejection
  - Negative total, subtotal, and grand_total rejection
  - Currency format validation
  - Unique store-scoped order numbering
  - Unique store-scoped checkout idempotency
  - Immutable item snapshots and line total
  - Non-positive item quantity rejection
  - Order-to-item cascade deletion
  - Order address snapshots & unique (order_id, type)
  - Status history audit persistence & actor validation
  - Cross-store customer isolation rejection
  - Cross-store checkout isolation rejection
  - `payments.order_id` foreign-key verification & non-existent order rejection
  - `payments.order_id` set to null on order deletion
  - `refunds.order_id` foreign-key verification & non-existent order rejection
  - Restrict order deletion when active refunds exist
  - `OrderRepository` CRUD, row locking, and status updates
  - `OrderRepository` items, addresses, and history operations

### 2. Payments & Database Regression Suites
- `tests/database.migration.test.ts`: **4 passed (4)** (782ms)
- `tests/payments/payment.schema.test.ts`: **28 passed (28)** (47.18s)
- `tests/payments/refund.service.test.ts`: **9 passed (9)** (23.43s)

**Total Tests**: **61 passed, 0 failed**.

---

## 10. Quality Checks: Typecheck, Lint, and Diff Results

- `pnpm typecheck`: Exit code 0 (all packages pass `tsc --noEmit`).
- `pnpm lint`: Exit code 0 (0 ESLint errors).
- `git diff --check`: Exit code 0 (0 whitespace or formatting issues).

---

## 11. Known Limitations

- **Order Application Services**: Not implemented in this task; belongs to Orders Task 2.
- **Checkout Completion & Payment Capture**: Not implemented in this task; belongs to downstream orchestration.
- **Inventory Allocations**: Physical stock mutations remain within the inventory domain.
