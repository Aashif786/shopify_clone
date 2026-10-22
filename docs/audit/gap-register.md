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
| **GAP-01** | `inventory` / `worker` | Confirmed Defect | **HIGH** | Medium | Expired inventory reservations not reclaimed automatically by worker |
| **GAP-02** | `auth` / `web` | Suspected Risk | **HIGH** | Small | Missing rate-limiting middleware on public authentication & payment verification routes |
| **GAP-03** | `email` / `orders` | Missing Feature | **MEDIUM** | Medium | Missing customer order lifecycle emails (order placed, fulfilled, cancelled, refunded) |
| **GAP-04** | `orders` / `db` | Technical Debt | **MEDIUM** | Medium | Carrier tracking details concatenated into string history without structured fulfillment entities |
| **GAP-05** | `products` / `web` | Missing Feature | **MEDIUM** | Medium | Storefront catalog discovery lacks search keyword queries, price filtering, and sorting |
| **GAP-06** | `products` / `web` | Technical Debt | **MEDIUM** | Medium | Storefront `/collections` route is a dummy redirect to `/products` without collection domain |
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
- **Module**: `packages/email`, `modules/orders`, `apps/web`
- **Classification**: Missing Feature
- **Severity**: **MEDIUM**
- **Evidence**:
  - `packages/email/src/templates/index.ts` defines password reset and invitation templates, but zero order lifecycle templates.
- **User/Business Impact**: Buyers do not receive email receipts or shipping updates, causing anxiety and increasing merchant support burden.
- **Dependencies**: `packages/email`, Resend integration.
- **Recommended Implementation**:
  1. Add `renderOrderConfirmationEmail`, `renderOrderFulfillmentEmail`, and `renderOrderCancelledEmail` templates to `packages/email`.
  2. Dispatch email delivery asynchronously upon successful payment callback and order status transitions.
- **Acceptance Criteria**: Succeeded payment verification triggers email delivery with order summary, items, and totals.
- **Required Regression Tests**: Integration test verifying email template rendering and dispatch in `test` delivery mode.
- **Estimated Effort**: Medium

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
- **Evidence**:
  - `apps/web/app/stores/[storeSlug]/products/page.tsx`
  - `modules/products/src/application/product-service.ts` (`listProducts` takes only `limit` and `cursor`).
- **User/Business Impact**: Buyers on stores with large catalogs cannot find specific products, reducing sales conversion.
- **Dependencies**: `modules/products`, PostgreSQL index.
- **Recommended Implementation**:
  1. Extend `ListProductsOptions` with `search?: string`, `minPrice?: number`, `maxPrice?: number`, `sortBy?: 'price_asc' | 'price_desc' | 'created_at'`.
  2. Implement `ILIKE` / full-text search clause in `ProductRepository.listProducts`.
  3. Add search input and sort dropdown to storefront UI.
- **Acceptance Criteria**: Querying `?search=mug` returns matching products; sorting by price updates display.
- **Required Regression Tests**: Product repository and API search tests.
- **Estimated Effort**: Medium

---

### GAP-06: Storefront `/collections` Route is a Dummy Redirect
- **Module**: `modules/products`, `apps/web`
- **Classification**: Technical Debt / Incomplete Domain
- **Severity**: **MEDIUM**
- **Evidence**:
  - `apps/web/app/stores/[storeSlug]/collections/page.tsx` line 11 immediately redirects to `/products`.
  - No `collections` table in database schema.
- **User/Business Impact**: Merchants cannot create curated collections (e.g. "Summer Collection", "Sale").
- **Dependencies**: Database schema, product domain.
- **Recommended Implementation**:
  - Phase 1: Either document collections as future capability and clean up the redirect route, or implement minimal collection tagging.
- **Acceptance Criteria**: Clear architectural decision recorded.
- **Required Regression Tests**: Storefront navigation tests.
- **Estimated Effort**: Medium

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
