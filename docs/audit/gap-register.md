# Cal Cart: Prioritized Gap Register

This document is the authoritative, evidence-based gap register for the Cal Cart multi-tenant commerce platform. It was first established during the Comprehensive Product Maturity Audit and is maintained as a living document.

> **Status refresh — 2026-11-04.** The register was rewritten against the current codebase (33 migrations, 3 apps, ~135K LOC, 135 test suites). The original audit was written at 13 migrations; several items it listed as gaps have since shipped and are now marked **Resolved**. New gaps identified against a production commerce feature set (tax, shipping/logistics, returns, stored-value, ecosystem) have been added as GAP-11 onward.

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

### 2.1 Original register (GAP-01 – GAP-10)

| ID | Module / Workflow | Classification | Severity | Status | Short Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GAP-01** | `inventory` / `worker` | Missing Feature | HIGH | **Resolved (M1)** | Expired inventory reservations now reclaimed by `inventory-expiration-recovery-job` |
| **GAP-02** | `auth` / `web` | Security Control | HIGH | **Resolved (M1)** | Sliding-window rate limiting added on login & payment-verify routes (`apps/web/src/lib/rate-limiter.ts`) |
| **GAP-03** | `email` / `orders` | Missing Feature | MEDIUM | **Resolved (M2)** | Order lifecycle emails via durable notification outbox |
| **GAP-04** | `orders` / `db` | Technical Debt | MEDIUM | **Resolved (M4, partial)** | Structured `tracking_carrier` / `tracking_number` / `tracking_url` columns replace the status-string concatenation; per-line-item fulfillment still deferred |
| **GAP-05** | `products` / `web` | Missing Feature | MEDIUM | **Resolved (M3)** | Keyword search, variant-aware price range, stock, and deterministic sorting |
| **GAP-06** | `products` / `web` | Incomplete Domain | MEDIUM | **Resolved (M3)** | Collections domain, APIs, and storefront gallery/detail pages |
| **GAP-07** | `media` | Missing Feature | MEDIUM | **Resolved** | Native upload dropzone + per-store uploads routes + CSV import/export with ZIP image bundles |
| **GAP-08** | `event-bus` | Technical Debt | LOW | **Resolved** | `@calcart/event-bus` runtime dispatcher (`InMemoryEventBus`) with async decoupling, wildcards, and fault isolation |
| **GAP-09** | `security` / `web` | Hardening | LOW | **Resolved (M6b)** | Content Security Policy (with Razorpay & embed allowances), `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and HSTS implemented in `apps/web/middleware.ts` via `security-headers.ts` |
| **GAP-10** | `inventory` / `orders` | Missing Feature | LOW | **Resolved** | Stock threshold made configurable (migration `0016_add_stock_threshold_and_max_order_quantity.sql`) |

### 2.2 New register — production commerce gaps (GAP-11 onward)

| ID | Module / Workflow | Tier | Severity | Short Description |
| :--- | :--- | :--- | :--- | :--- |
| **GAP-11** | `checkout` / new `tax` | Tier 1 | **CRITICAL** | **Resolved (M5)** — `modules/tax` computes per-line GST (CGST+SGST / IGST / export), recalculated on every checkout mutation, with a fail-closed payment guard and numbered immutable tax invoices. Tax-exclusive pricing only; MRP-inclusive pricing deferred |
| **GAP-12** | `checkout` / new `shipping` | Tier 1 | **CRITICAL** | **Resolved (M6)** — Shipping rate engine, postal/state zones, courier integrations (Delhivery, Blue Dart, Shiprocket, Manual), pure vector Code 128 barcode thermal label generator, and order dispatch workflow |
| **GAP-13** | `orders` / new `returns` | Tier 1 | **HIGH** | **Resolved (M4)** — `modules/returns` with a full RMA state machine, storefront request UI, merchant review queue, refund via existing payments path, inventory restocking on receipt, and customer return labels |
| **GAP-14** | new `giftcards` | Tier 1 | **MEDIUM** | **Resolved (M7)** — Stored-value instruments (`modules/giftcards`, migration `0040`): digital gift cards with high-entropy non-ambiguous codes, customer store credits, append-only financial ledgers, email code delivery via notification outbox, and zero-payment checkout |
| **GAP-15** | `carts` / `worker` / `email` | Tier 1 | **MEDIUM** | **Resolved (M7)** — `CartCleanupJob` in `apps/worker` transitions stale active carts to `ABANDONED`, past-due carts to `EXPIRED`, enqueues idempotent `ABANDONED_CART_RECOVERY` emails to `notification_outbox`, and purges stale carts with cascade item deletion |
| **GAP-16** | `web` / new `api` | Tier 3 | **MEDIUM** | **Resolved (M8)** — Public REST API surface (`/api/v1/public/products`, `/orders`, `/inventory`, `/webhooks`) with bearer API keys (`cc_live_...`), SHA-256 hash auth, scoped permissions, outbound webhook subscriptions, durable outbox delivery with HMAC-SHA256 signatures, and merchant developer management UI |
| **GAP-17** | `web` / `products` | Tier 2 | **MEDIUM** | **Resolved** — Multi-currency presentment engine (migration `0045`, `store_currencies`), custom exchange rates, charm (.99) rounding rules, storefront `CurrencySelector`, live conversion in catalog & product pages, and `/merchant/settings` management UI |
| **GAP-18** | `email` / new `marketing` | Tier 2 | **LOW** | **Resolved** — Newsletter subscriber capture (migration `0038`, `newsletter_subscribers`), deduplication, double opt-in verification tokens, CSV export, and `/merchant/customers` subscriber administration |
| **GAP-19** | new `subscriptions` | Tier 2 | **LOW** | No product-subscription / recurring-order model for merchants (platform-admin "subscriptions" bills merchants, not their customers) |
| **GAP-20** | `web` | Tier 3 | **LOW** | No cache/scale layer (in-memory rate limiter, no Redis, single-region) — acceptable now; named before scale forces it |

---

## 3. Detailed Specifications — Open & New Gaps

Resolved gaps (GAP-01, 02, 03, 05, 06, 07, 10) retain their original specifications in version history; only open and new gaps are detailed below.

### GAP-04: Structured Order Fulfillment & Carrier Tracking
- **Module**: `modules/orders`, `packages/db`, `apps/web`
- **Severity**: MEDIUM — **Resolved (M4), with one deferred sub-item**
- **Original evidence**: `apps/web/app/api/v1/stores/[storeId]/orders/[orderId]/fulfill/route.ts` formatted carrier + tracking into a status string; the `orders` schema had no tracking columns.
- **Resolution**: Migration `0034_add_order_fulfillment_tracking.sql` adds `tracking_carrier`, `tracking_number`, and `tracking_url` to `orders`. `OrderStatusService.updateFulfillmentStatus` persists them inside the existing fulfillment transaction (`COALESCE`-updated, so a re-fulfilment that omits tracking retains the stored values). The fields are exposed on `OrderDTO` through both the list and hydrate read paths, and render as structured, clickable links in the merchant and storefront order views. The status-history `reason` now carries only the merchant note. The fulfillment email already supported carrier/number/URL and is fed from the persisted order values.
- **Boundary hardening**: `fulfillOrderValidator` accepts only absolute `http(s)` tracking URLs, so a `javascript:`/`data:` URL can never be persisted and later rendered as an `href` in order views or email.
- **Deferred**: Per-line-item (partial) fulfillment is **not** delivered. Only order-level `PARTIALLY_FULFILLED` exists, and a single tracking triple is stored per order. Supporting multiple shipments per order requires the `order_fulfillments` child table originally floated as the alternative design; it is not needed until the M6 courier work creates real multi-shipment orders.
- **Verification**: `tests/orders/order-status.service.test.ts` (9 passed) covers persistence and DTO exposure; `tests/security/request-validation.test.ts` (7 passed) covers tracking-URL scheme rejection; `tests/notifications` (24 passed) covers the fulfillment email path.

### GAP-08: EventBus Runtime
- **Module**: `packages/event-bus`
- **Severity**: LOW — **Resolved**
- **Original evidence**: `packages/event-bus/src/index.ts` declared interfaces only; modules orchestrated synchronously without an in-process async event dispatcher.
- **Resolution**: Implemented `InMemoryEventBus` in `packages/event-bus/src/in-memory-event-bus.ts`, providing:
  - Exact event subscription and wildcard (`*`) event pattern matching.
  - Asynchronous dispatching across subscribers via `Promise.allSettled`.
  - Fault isolation so handler exceptions never abort sibling handlers or crash publishers.
  - Return of clean disposer functions from `subscribe()`, plus explicit `unsubscribe()`, `listenerCount()`, and `clear()`.
  - Global singleton instance (`getEventBus()`) and teardown helpers (`resetGlobalEventBus()`).
  - Verified with 11 automated unit tests in `tests/event-bus/event-bus.test.ts`. This provides the foundational decoupled seam for GAP-16 outbound webhooks.

### GAP-09: Content Security Policy & Security Headers
- **Module**: `apps/web`
- **Severity**: LOW — **Resolved (M6b)**
- **Evidence**: `apps/web/middleware.ts` applies `applySecurityHeaders` from `apps/web/src/lib/security-headers.ts` on all incoming requests, rewrites, and redirects.
- **Specification**: Complete CSP directives (`default-src`, `script-src`, `style-src`, `img-src`, `connect-src`, `frame-src`, `media-src`, `object-src: 'none'`, `base-uri: 'self'`, `form-action`, `frame-ancestors: 'self'`) with whitelisted Razorpay gateway domains (`checkout.razorpay.com`, `api.razorpay.com`, `lumberjack.razorpay.com`), video embed hosts (YouTube, Vimeo), image CDNs, plus `X-Frame-Options: SAMEORIGIN`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and production HSTS. Verified with 15 automated integration tests in `tests/security/security-headers.test.ts`.

### GAP-11: Tax / GST Engine
- **Module**: `modules/tax` (new), `modules/checkout`, `modules/payments`, `apps/web`, `packages/db`
- **Tier/Severity**: Tier 1 — **Resolved (M5), with deferred sub-items**
- **Original evidence**: `modules/checkout/src/domain/checkout.ts` validated and stored `taxTotal` but no service computed it; no tax tables existed.
- **Resolution**: Migration `0036_create_tax_schema.sql` adds `tax_settings`, `product_tax_profiles`, `checkout_tax_snapshots`, `tax_invoices`, `tax_invoice_lines` and `tax_invoice_sequences`. A new `modules/tax` computes GST per line from the product's HSN/rate and the buyer's place of supply: CGST + SGST for the seller's own state, IGST for another state, none for an export. `CheckoutService` recalculates it after every mutation that changes the taxable base (items, shipping address, discount). The result is frozen as a per-checkout snapshot that the order and invoice are built from, so a later rate change cannot alter a paid order. Each paid order of a tax-enabled store gets a gapless-numbered (`INV/2627/000001`), immutable, print-ready GST invoice, downloadable by the merchant and by the customer who owns the order. Merchants configure GSTIN, registration and per-product HSN/rate on `/merchant/tax`; the storefront checkout shows the per-line GST split.
- **Integrity**:
  - *Fail-closed payment*: `PaymentService.createPayment` refuses a tax-enabled checkout whose stored tax does not match its snapshot, which catches a missing shipping address, a stale calculation and a tampered figure with one comparison.
  - *Paid orders survive invoicing failures*: the invoice is issued after the purchase transaction commits, in its own transaction, with lazy issuance as the safety net. See ADR-015 for why a `SAVEPOINT` inside the purchase transaction was **not** viable.
  - *Exact arithmetic*: integer basis points and integer rounding throughout; CGST always equals SGST; the discount is allocated by largest-remainder so line discounts sum exactly; `BigInt` is used where a product could exceed 2^53.
  - *GSTIN checksum* is validated and verified against a published sample GSTIN; the 16-character invoice-number rule and the April–March financial year (evaluated in IST) are enforced in code and by a database check.
  - *Off by default*: a store with tax off is completely unaffected.
- **Also fixed (a latent GAP-13 defect)**: the order handoff never populated an order line's `discount_amount`, so a return on a discounted order was refunded at the undiscounted price (20,000 requested against 16,000 paid in the regression test). Discount and tax are now itemised onto order lines for every store, and return refunds use `price × qty − discount + tax`, pro-rated and rounded down so partial returns can never exceed what was paid. This closes the "tax-exclusion" dependency recorded against M4.
- **Deliberately deferred** (full reasoning in `specs/tax/tax-spec.md`):
  - **Tax-inclusive (MRP) pricing.** Tax is added on top of listed prices. Inclusive pricing means changing the `total = subtotal − discount + tax + shipping` invariant in carts, checkout, orders and payments. A store that already lists GST-inclusive prices must lower them before enabling tax; the settings screen says so. **This is the largest remaining gap in the domain.**
  - Tax on shipping (needs GAP-12), compensation cess, reverse charge, credit notes, buyer GSTIN capture (B2B), PDF output, and e-invoicing (IRN).
- **Verification**: `tests/tax/tax.domain.test.ts`, `tests/tax/tax.service.test.ts`, `tests/tax/tax.api.test.ts`, `tests/tax/tax.ui-helpers.test.ts`, plus tax-aware cases added to `tests/returns/returns.domain.test.ts`. The two invariants that matter most (a paid order survives an invoicing error; a discounted return refunds the discounted amount) were **mutation-tested**: removing the protection makes the test fail.

### GAP-12: Shipping Rate Engine & Logistics
- **Module**: `modules/shipping` (new), `modules/checkout`, `modules/orders`, `apps/web`, `packages/db`
- **Tier/Severity**: Tier 1 — **RESOLVED (M6)**
- **Original evidence**: `shippingTotal` was a stored field only; no zones, rate rules, or carrier integration anywhere in `modules/` or `apps/`.
- **Resolution**:
  - Migration `0041_create_shipments.sql` adds the `shipments` table with composite unique key `(store_id, order_id)`, constraints, provider codes, tracking URLs, and carrier statuses.
  - A new `modules/shipping` domain implements:
    - Postal code and state zone matching (`findMatchingZone`, `evaluateRatesForCart`).
    - Flat, order subtotal, and weight-tiered shipping rate rules.
    - Courier integrations with standardized AWB generation and official tracking portals (`DelhiveryCarrierProvider`, `BlueDartCarrierProvider`, `ShiprocketCarrierProvider`, `CompositeCarrierProvider`, and `ManualCarrierProvider`).
    - Standard 4x6" thermal and A4 shipping label generator (`ShippingLabelService`) with pure vector Code 128 barcode SVG generation, routing PIN box, COD/Prepaid badge, item declaration, and printable HTML view (`/api/v1/stores/[storeId]/orders/[orderId]/shipments/label`).
  - Checkout integration: real-time destination postal code shipping rate calculation, COD support with selective gating and cash collection reconciliation.
  - Merchant UI: `OrderDispatchDialog` with courier preset buttons (Delhivery, Blue Dart, Shiprocket, Custom), automatic AWB assignment, and `OrderDetailsView` shipment status card with direct "Print Label" action.
- **Verification**: Verified with clean monorepo typecheck across all 26 packages and Next.js production build.

### GAP-13: Customer-Initiated Returns / RMA
- **Module**: `modules/returns` (new), `apps/web`, `packages/db`, `packages/email`, `apps/worker`
- **Tier/Severity**: Tier 1 — **Resolved (M4)**
- **Original evidence**: Cancellation and refund flows lived in `modules/orders` and were merchant-triggered only; no return-request entity existed.
- **Resolution**: Migration `0035_create_returns_schema.sql` adds `return_requests`, `return_request_items`, `return_request_events`, and `return_policies`. A new `modules/returns` owns the lifecycle `REQUESTED → APPROVED/REJECTED → RECEIVED → REFUNDED` (plus customer `CANCELLED`), with eligibility, server-side refund arithmetic, and an append-only audit trail. Customers request and withdraw returns from the storefront order page; merchants review, receive, and refund from `/merchant/returns`. The refund reuses `RefundService.executeMerchantRefund` rather than reimplementing refunds.
- **Integrity**: A refund is legal only from `RECEIVED`, and uses the deterministic idempotency key `return-refund:<id>`, so retries and concurrent clicks replay the original refund instead of charging twice. Returnable quantity accounts for prior non-rejected returns, and a partial unique index allows only one in-flight return per order. See [ADR-014](../decisions/ADR-014-returns-refund-ordering-and-ownership.md) for the refund-ordering rationale.
- **Tenant isolation**: Every table is `store_id`-scoped and every cross-table reference uses a composite `(id, store_id)` foreign key, so a return cannot reference another store's order, order item, customer, or refund.
- **Deliberately deferred**: return shipping labels / reverse logistics (M6), inventory restocking on receipt, refund-to-store-credit (GAP-14), and exchanges. See `specs/returns/returns-spec.md` for the full exclusion list and reasoning.
- **Verification**: `tests/returns/returns.domain.test.ts` (22 passed), `tests/returns/returns.service.test.ts` (21 passed), `tests/returns/returns.api.test.ts` (9 passed).

### GAP-14: Gift Cards & Store Credit
- **Module**: new `modules/giftcards`, `packages/db`
- **Tier/Severity**: Tier 1 — **MEDIUM**
- **Status**: **RESOLVED (M7)**
- **Original evidence**: No stored-value instruments in schema or modules.
- **Resolution**: Migration `0040_create_gift_cards_and_store_credits_schema.sql` establishes `gift_cards`, `store_credits`, `gift_card_transactions`, `store_credit_transactions`, `checkout_gift_cards`, and `order_gift_cards`. A new `modules/giftcards` provides:
  - Secure 16-character alphanumeric code generation (`GC-XXXX-XXXX-XXXX`) excluding ambiguous characters (`0/O`, `1/I`), normalization, and SHA-256 indexing.
  - Concurrency-safe atomic balance redemption with `FOR UPDATE` row-locking, preventing double-spending and overdrawing (`CHECK (current_balance >= 0)`).
  - Append-only immutable financial audit ledgers with idempotency key enforcement (`gift_card_transactions`, `store_credit_transactions`).
  - Checkout integration: partial or full gift card application (`applyGiftCard`, `removeGiftCard`), stackable cards, and automatic order conversion into `order_gift_cards` via `PaymentOrderIntegration`.
  - Zero-payment purchase completion (`completeZeroPaymentPurchaseWorkflow`) for orders 100% paid by gift cards.
  - Customer return RMA refund-to-store-credit workflow in `modules/returns` (`refundMethod: "STORE_CREDIT"`).
  - Verified with 23 automated tests across `tests/giftcards/giftcards.test.ts`, `tests/giftcards/checkout-giftcard-integration.test.ts`, and `tests/returns/returns-store-credit.test.ts`.

### GAP-15: Abandoned-Cart Recovery
- **Module**: `modules/carts`, `apps/worker`, `packages/email`, `packages/db`
- **Tier/Severity**: Tier 1 — **MEDIUM**
- **Status**: **RESOLVED (M7)**
- **Evidence**: `CartCleanupJob` runs periodically in `apps/worker` via `PaymentRecoveryScheduler`. It transitions inactive carts to `ABANDONED`, past-due carts to `EXPIRED`, enqueues idempotent `ABANDONED_CART_RECOVERY` transactional emails in `notification_outbox`, and purges stale expired carts older than retention threshold with cascade item cleanup.
- **Impact**: Reclaims database storage and recovers abandoned customer carts.

### GAP-16: Public Merchant API, Webhooks & App Model
- **Module**: `apps/web` public API surface, `packages/auth`, `packages/db`, `packages/event-bus`, `apps/worker`
- **Tier/Severity**: Tier 3 — **RESOLVED (M8)**
- **Original evidence**: 130+ internal v1 routes existed, but none were an authenticated public API; no outbound webhooks; event-bus was inactive.
- **Resolution**:
  - Migration `0043_create_api_keys_and_webhooks.sql` establishes `store_api_keys`, `webhook_subscriptions`, and `webhook_deliveries` outbox table.
  - Per-store Bearer API key authentication (`cc_live_...` / `cc_test_...`) with fast prefix lookup, SHA-256 server-side hashing, and granular scopes (`read:products`, `write:products`, `read:orders`, `write:orders`, `read:inventory`, `write:inventory`, `read:webhooks`, `write:webhooks`).
  - Public REST API endpoints:
    - Products: `GET /api/v1/public/products`, `GET /api/v1/public/products/[productId]`, `POST /api/v1/public/products`
    - Orders: `GET /api/v1/public/orders`, `GET /api/v1/public/orders/[orderId]`
    - Inventory: `GET /api/v1/public/inventory`, `POST /api/v1/public/inventory/adjust`
    - Webhooks: `GET /api/v1/public/webhooks`, `POST /api/v1/public/webhooks`, `DELETE /api/v1/public/webhooks/[webhookId]`
  - Outbound Webhooks:
    - Automatic domain event interception from `globalEventBus` (`order.created`, `order.paid`, `order.fulfilled`, `shipment.delivered`, `return.received`) enqueues deliveries into `webhook_deliveries`.
    - Background worker `WebhookDispatchJob` in `apps/worker` signs payloads with HMAC-SHA256 (`X-CalCart-Signature`), posts to endpoints with 10s timeout, and handles exponential retry backoff.
  - Merchant UI: `/merchant/developer` allows merchants to generate keys with one-time secret revelation, configure webhook endpoints, and inspect real-time delivery logs.
- **Verification**: Verified with monorepo `pnpm typecheck` (0 errors across 26 workspaces) and Next.js production build (`50 routes` compiled).

### GAP-17: Multi-Currency Presentment & Localization
- **Module**: `web`, `packages/db`, `packages/types`
- **Tier/Severity**: Tier 2 — **RESOLVED**
- **Resolution**:
  - Migration `0045_create_store_currencies.sql` adds `store_currencies` table with composite key `(store_id, currency)`, custom exchange rates, rounding rules (`NONE`, `NINETY_NINE`, `INTEGER`), and active toggles.
  - Storefront API `/api/v1/storefront/[storeSlug]/currencies` and merchant management APIs `/api/v1/stores/[storeId]/currencies`.
  - Client currency context `CurrencyProvider` and selector component `CurrencySelector` with Framer Motion spring physics.
  - Live converted prices with charm pricing (.99) in `ProductCard`, `ProductDetailView`, `CartDrawer`, and transparent settlement notice in store's base currency.
  - Merchant management UI `StoreCurrenciesManager` in `/merchant/settings` with live conversion calculator.
- **Verification**: Verified with clean monorepo `pnpm typecheck` (26 workspaces) and Next.js production build (`50 routes`).

### GAP-18: Marketing & Newsletter Subscribers
- **Module**: `modules/customers`, `apps/web`, `packages/db`
- **Tier/Severity**: Tier 2 — **RESOLVED**
- **Resolution**:
  - Migration `0038_create_newsletter_subscribers.sql` creates `newsletter_subscribers`.
  - Storefront newsletter subscription API with deduplication, SHA-256 confirmation tokens, and source tracking.
  - Merchant subscriber management API `/api/v1/stores/[storeId]/newsletter/subscribers` supporting search, filtering by status, and CSV export.
  - Merchant UI tab in `/merchant/customers` for inspecting and exporting subscriber lists.

### GAP-19 – GAP-20 (Briefly)
- **GAP-19 Product subscriptions**: recurring-order model for merchants selling subscriptions.
- **GAP-20 Scale layer**: Redis-backed rate limiting/caching and multi-region readiness when scale requires it.

---

## 4. Next Milestone

**M5 (Tax & GST Engine), M6 (Shipping & Logistics), and M7 (Retention Instruments) are complete.** The core commerce funnel — catalog, cart, tax computation, shipping rate zones, courier dispatch, AWB generation, thermal label printing, gift cards, and automated abandoned-cart recovery — is functionally verified end-to-end.

The recommended next milestone is **M8 — Platform API & Ecosystem** (GAP-16):
1. **Public Merchant API**: versioned, authenticated merchant REST API with per-store API keys.
2. **Outbound Webhooks**: durable outbox event publishing powered by the in-memory event-bus runtime (GAP-08).

Sub-items deferred for future enhancement:
- **Tax-inclusive (MRP) pricing** (GAP-11): reach across four modules.
- **Return shipping labels / reverse logistics** (GAP-13 extension).
