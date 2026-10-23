# Cal Cart: Prioritized Gap Register

This document serves as the authoritative, evidence-based gap register for the Cal Cart multi-tenant commerce platform, established during the Comprehensive Product Maturity Audit.

---

## 1. Prioritization Framework

Gaps are ranked according to the project's strict architectural priorities:
1. Data integrity, financial correctness, and tenant-isolation defects.
2. Broken critical commerce journeys.
3. Authentication and authorization gaps.
4. Incorrect state transitions and recovery behavior.
5. Missing essential merchant/customer functionality.
6. UX and accessibility defects.
7. Performance and maintainability improvements.
8. Optional enhancements.

---

## 2. Master Gap Register

| ID | Module / Workflow | Classification | Severity | Effort | Short Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GAP-01** | `inventory` / `worker` | Resolved (M1) | **HIGH** | Medium | Expired inventory reservations not reclaimed automatically by worker |
| **GAP-02** | `auth` / `web` | Resolved (M1) | **HIGH** | Small | Missing rate-limiting middleware on public authentication & payment verification routes |
| **GAP-03** | `email` / `orders` | Resolved (M2) | **MEDIUM** | Medium | Transactional order lifecycle emails (order confirmed, fulfilled, cancelled, refunded) with durable outbox delivery |
| **GAP-04** | `orders` / `db` | Technical Debt | **MEDIUM** | Medium | Carrier tracking details concatenated into string history without structured fulfillment entities |
| **GAP-05** | `products` / `web` | Missing Feature | **MEDIUM** | Complete | Resolved in Milestone M3: keyword search across title/description/SKU, variant-aware price range, inventory availability, deterministic sorting, and storefront filter bar |
| **GAP-06** | `products` / `web` | Technical Debt | **MEDIUM** | Complete | Resolved in Milestone M3: migration `0015_create_collections_schema.sql` with composite tenant isolation foreign keys, full collections domain service & APIs, and dedicated storefront gallery/detail pages |
| **GAP-07** | `media` | Missing Feature | **MEDIUM** | Large | Native media upload module missing; merchant image inputs require external static URLs |
| **GAP-08** | `event-bus` | Technical Debt | **LOW** | Small | Unimplemented `EventBus` interface; orphaned abstract package without runtime dispatcher |
| **GAP-09** | `security` / `web` | Suspected Risk | **LOW** | Small | Missing Content Security Policy (CSP) headers in Next.js middleware |
| **GAP-10** | `inventory` / `orders`| Missing Feature | **LOW** | Small | Low-stock inventory threshold is hardcoded in analytics instead of merchant-configurable |

---

## 3. Detailed Gap Specifications

### GAP-01: Expired Inventory Reservation Release Background Worker
- **Module**: `modules/inventory`, `apps/worker`
- **Classification**: Confirmed Defect / Missing Feature
- **Severity**: **HIGH**
- **Evidence**:
  - `modules/inventory/src/infrastructure/inventory-repository.ts` (`findExpiredActiveReservationIds`) implements the query.
  - `apps/worker/src/schedulers/payment-recovery-scheduler.ts` and `apps/worker/src/jobs/` contain no job that periodically executes reservation cleanup.
- **User/Business Impact**: When customers abandon checkouts after stock reservation (15-minute lease), items remain locked in `reserved_quantity` indefinitely. Merchants experience artificial stock depletion, preventing other buyers from completing purchases.
- **Dependencies**: `modules/inventory`, `@shopify-clone/db`, `apps/worker`.
- **Recommended Implementation**:
  1. Create `InventoryExpirationRecoveryJob` in `apps/worker/src/jobs/inventory/inventory-expiration-recovery-job.ts`.
  2. Query active expired reservations across stores and execute `InventoryService.releaseReservation`.
  3. Register job in `PaymentRecoveryScheduler` under distributed database lease locks.
- **Acceptance Criteria**: Expired active reservations are released to available stock within one worker poll cycle (10 seconds).
- **Required Regression Tests**: Vitest worker integration test verifying multi-store expired reservation recovery and stock pool restoration.
- **Estimated Effort**: Medium

---

### GAP-02: Missing Rate Limiting on Public Auth & Payment Verification Endpoints
- **Module**: `apps/web`, `packages/auth`
- **Classification**: Suspected Risk / Missing Security Control
- **Severity**: **HIGH**
- **Evidence**:
  - `apps/web/app/api/v1/auth/login/route.ts`
  - `apps/web/app/api/v1/storefront/[storeSlug]/auth/login/route.ts`
  - `apps/web/app/api/v1/storefront/[storeSlug]/checkout/[checkoutId]/payment/verify/route.ts`
- **User/Business Impact**: Endpoints can be spammed by automated scripts, exposing merchant accounts to credential brute-forcing and payment gateway verification abuse.
- **Dependencies**: In-memory / PostgreSQL-backed rate limiter utility.
- **Recommended Implementation**:
  1. Implement IP and tenant-scoped sliding window rate limiter in `apps/web/src/lib/rate-limiter.ts`.
  2. Enforce max 5 login attempts / minute per IP on login routes; return HTTP 429 Too Many Requests.
  3. Enforce max 10 verification requests / minute per checkout.
- **Acceptance Criteria**: 6th rapid login attempt from same IP returns 429 with `Retry-After` header.
- **Required Regression Tests**: API unit tests verifying 429 response on threshold breach.
- **Estimated Effort**: Small

---

### GAP-03: Missing Transactional Order & Fulfillment Lifecycle Customer Emails
- **Module**: `packages/email`, `modules/orders`, `packages/db`, `apps/worker`
- **Classification**: Missing Feature (Resolved in Milestone M2)
- **Severity**: **MEDIUM**
- **Evidence**:
  - `packages/email/src/templates/index.ts` defines password reset and invitation templates, but previously lacked order lifecycle templates.
- **User/Business Impact**: Buyers do not receive email receipts or shipping updates, causing anxiety and increasing merchant support burden.
- **Resolution Summary**:
  1. Created migration `0014_create_notification_outbox_schema.sql` providing durable `notification_outbox` table with idempotency constraint `UNIQUE(store_id, idempotency_key)` and indices.
  2. Implemented `NotificationOutboxRepository` with atomic `FOR UPDATE SKIP LOCKED` claim and status transitions (`PENDING`, `PROCESSING`, `SENT`, `FAILED`).
  3. Implemented responsive HTML + plaintext email templates in `packages/email/src/templates/`:
     - Order Confirmation (`renderOrderConfirmationEmail`) with itemized pricing, subtotal, discounts, shipping, tax, grand total, and shipping address.
     - Order Fulfillment (`renderOrderFulfillmentEmail`) with carrier name, tracking number, tracking link, and partial fulfillment clarity.
     - Order Cancellation (`renderOrderCancelledEmail`) with cancellation reason and transparent refund status.
     - Refund Confirmation (`renderRefundConfirmationEmail`) with full/partial refund amount and 5–10 business days return explanation.
  4. Created fail-open `NotificationOutboxService` in `@shopify-clone/orders` and wired triggers to authoritative state transitions:
     - Order Confirmation: `PaymentOrderIntegration.processCapturedPayment`
     - Fulfillment: `POST /api/v1/stores/[storeId]/orders/[orderId]/fulfill/route.ts`
     - Cancellation: `OrderCancellationCoordinator.cancelOrder`
     - Refund Confirmation: `RefundService.recordRefundSuccess`
  5. Implemented `NotificationDispatchJob` in `apps/worker` with exponential backoff retry intervals (1m, 5m, 15m, 30m, 1h), terminal failure handling for invalid addresses, and registered in `PaymentRecoveryScheduler`.
  6. Added 12 comprehensive integration tests in `tests/notifications/order-lifecycle-notifications.test.ts` covering confirmation, fulfillment, cancellation, refunds, concurrency, retry backoff, and tenant isolation.
- **Estimated Effort**: Medium (Complete)

---

### GAP-04: Free-Form Concatenation of Carrier Tracking Info into Status Reason
- **Module**: `modules/orders`, `packages/db`, `apps/web`
- **Classification**: Technical Debt / Architectural Limitation
- **Severity**: **MEDIUM**
- **Evidence**:
  - `apps/web/app/api/v1/stores/[storeId]/orders/[orderId]/fulfill/route.ts` lines 43-50 format carrier and tracking number into string: `Carrier: X | Tracking #: Y`.
  - `packages/db/migrations/0010_create_orders_schema.sql` has no `carrier` or `tracking_number` columns.
- **User/Business Impact**: Customers cannot view direct tracking URLs or structured carrier badges; merchants cannot perform partial line-item fulfillments.
- **Dependencies**: Database migration, orders domain DTOs.
- **Recommended Implementation**:
  1. Add migration `0014_add_order_fulfillment_tracking.sql` adding `tracking_carrier`, `tracking_number`, `tracking_url` to `orders` (or dedicated `fulfillments` table).
  2. Expose structured tracking fields in `OrderDTO` and render clickable tracking links in storefront order confirmation.
- **Acceptance Criteria**: Merchant-provided carrier and tracking number are displayed as structured badges with clickable URLs.
- **Required Regression Tests**: Order fulfillment integration tests.
- **Estimated Effort**: Medium

---

### GAP-05: Storefront Catalog Discovery Lacks Search, Filtering, and Sorting
- **Module**: `modules/products`, `apps/web`
- **Classification**: Missing Feature
- **Severity**: **MEDIUM**
- **Status**: **RESOLVED (Milestone M3)**
- **Evidence**:
  - `apps/web/app/stores/[storeSlug]/products/page.tsx`
  - `modules/products/src/application/product-service.ts`
- **Implementation**:
  - Extended `ListProductsOptions` with `search`, `minPrice`, `maxPrice`, `inStock`, `sortBy`, `collectionId`, `collectionSlug`.
  - Added parameterized SQL search filtering across `title`, `description`, and variant `sku` with escape character protection.
  - Implemented variant-aware price range filtering (`v.price >= minPrice AND v.price <= maxPrice`).
  - Implemented authoritative stock check against `inventory_items.available_quantity > 0`.
  - Implemented deterministic sorting (`created_at_desc`, `created_at_asc`, `price_asc`, `price_desc`, `title_asc`, `title_desc`) with tie-breaker and cursor pagination.
  - Integrated `CatalogFilterBar` into storefront UI with URL parameter synchronization.
- **Verification**: Verified via `tests/products.search-filter.test.ts`.

---

### GAP-06: Storefront `/collections` Route is a Dummy Redirect
- **Module**: `modules/products`, `apps/web`
- **Classification**: Technical Debt / Incomplete Domain
- **Severity**: **MEDIUM**
- **Status**: **RESOLVED (Milestone M3)**
- **Evidence**:
  - `apps/web/app/stores/[storeSlug]/collections/page.tsx`
- **Implementation**:
  - Created migration `0015_create_collections_schema.sql` defining `collections` and `collection_products` with composite foreign keys `(collection_id, store_id)` and `(product_id, store_id)` for strict tenant isolation.
  - Implemented `CollectionRepository` and `CollectionService` supporting collection CRUD and product assignment.
  - Added storefront collection endpoints (`GET /api/v1/storefront/[storeSlug]/collections`, `GET /api/v1/storefront/[storeSlug]/collections/[collectionSlug]`) and merchant management endpoints (`/api/v1/stores/[storeId]/collections/*`).
  - Implemented Storefront Collections Gallery page at `/stores/[storeSlug]/collections` and Collection Detail page at `/stores/[storeSlug]/collections/[collectionSlug]`.
- **Verification**: Verified via `tests/collections.test.ts`.

---

### GAP-07: Native Media Upload Module Missing
- **Module**: `modules/media`, `apps/web`
- **Classification**: Missing Feature
- **Severity**: **MEDIUM**
- **Evidence**:
  - `specs/media/media-implementation.md` specifies the module, but `modules/media/` is absent.
  - Merchant product form accepts only raw URL strings.
- **User/Business Impact**: Merchants must manually upload images to third-party hosts and paste image links.
- **Dependencies**: Object storage service (Cloudflare R2, AWS S3).
- **Recommended Implementation**:
  1. Implement `modules/media` for presigned upload URL generation and metadata tracking.
  2. Add image file dropzone in merchant product creation view.
- **Acceptance Criteria**: Merchant can drag and drop a JPEG/PNG file and see it previewed and linked to the variant.
- **Required Regression Tests**: Media service unit tests.
- **Estimated Effort**: Large

---

### GAP-08: Unimplemented EventBus Interface in `packages/event-bus`
- **Module**: `packages/event-bus`
- **Classification**: Technical Debt
- **Severity**: **LOW**
- **Evidence**:
  - `packages/event-bus/src/index.ts` contains only interface declarations; zero implementations.
- **User/Business Impact**: No direct user impact; developers may assume an event bus exists when calls are synchronous.
- **Dependencies**: None.
- **Recommended Implementation**:
  - Implement an in-memory asynchronous emitter or transactional outbox publisher, or document the direct synchronous orchestration pattern.
- **Acceptance Criteria**: Clear architectural pattern followed across modules.
- **Estimated Effort**: Small

---

### GAP-09: Missing Content Security Policy (CSP) Headers
- **Module**: `apps/web`
- **Classification**: Suspected Risk / Hardening
- **Severity**: **LOW**
- **Evidence**:
  - `apps/web/middleware.ts` lacks security headers.
- **User/Business Impact**: Missing defense-in-depth against malicious script injections.
- **Dependencies**: None.
- **Recommended Implementation**:
  - Add CSP and security headers in Next.js middleware with explicit Razorpay script/frame allowances.
- **Acceptance Criteria**: Security headers present on all responses.
- **Estimated Effort**: Small

---

### GAP-10: Hardcoded Low-Stock Inventory Threshold
- **Module**: `modules/inventory`, `modules/orders`
- **Classification**: Missing Feature
- **Severity**: **LOW**
- **Evidence**:
  - `modules/orders/src/application/analytics-service.ts` line 461 hardcodes threshold to 10 units.
- **User/Business Impact**: Low-stock alerts in merchant analytics may be inaccurate for high-volume items or made-to-order goods.
- **Dependencies**: `modules/inventory`.
- **Recommended Implementation**: Allow threshold parameter in `getLowStockVariants(client, storeId, threshold = 10)`.
- **Acceptance Criteria**: Merchant can specify custom threshold via query param.
- **Estimated Effort**: Small
