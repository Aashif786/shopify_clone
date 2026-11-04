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
| **GAP-04** | `orders` / `db` | Technical Debt | MEDIUM | **Open** | Carrier tracking still concatenated into a status string; no structured fulfillment entity |
| **GAP-05** | `products` / `web` | Missing Feature | MEDIUM | **Resolved (M3)** | Keyword search, variant-aware price range, stock, and deterministic sorting |
| **GAP-06** | `products` / `web` | Incomplete Domain | MEDIUM | **Resolved (M3)** | Collections domain, APIs, and storefront gallery/detail pages |
| **GAP-07** | `media` | Missing Feature | MEDIUM | **Resolved** | Native upload dropzone + per-store uploads routes + CSV import/export with ZIP image bundles |
| **GAP-08** | `event-bus` | Technical Debt | LOW | **Open** | `@calcart/event-bus` is interface-only; no runtime dispatcher |
| **GAP-09** | `security` / `web` | Hardening | LOW | **Open** | No Content Security Policy / security headers in `apps/web/middleware.ts` |
| **GAP-10** | `inventory` / `orders` | Missing Feature | LOW | **Resolved** | Stock threshold made configurable (migration `0016_add_stock_threshold_and_max_order_quantity.sql`) |

### 2.2 New register — production commerce gaps (GAP-11 onward)

| ID | Module / Workflow | Tier | Severity | Short Description |
| :--- | :--- | :--- | :--- | :--- |
| **GAP-11** | `checkout` / new `tax` | Tier 1 | **CRITICAL** | No tax engine. `taxTotal` is stored/validated but never computed — no GST (CGST/SGST/IGST), HSN codes, or compliant invoices |
| **GAP-12** | `checkout` / new `shipping` | Tier 1 | **CRITICAL** | No shipping rate engine. `shippingTotal` is a bare field — no zones, weight/dimension rules, carrier rates, COD, or AWB/label generation |
| **GAP-13** | `orders` / new `returns` | Tier 1 | **HIGH** | No customer-initiated returns/RMA. Cancellation and refund are merchant-only |
| **GAP-14** | new `giftcards` | Tier 1 | **MEDIUM** | No gift cards or store credit (stored-value instruments) |
| **GAP-15** | `carts` / `worker` | Tier 1 | **MEDIUM** | No abandoned-cart purge job and no recovery email path |
| **GAP-16** | `web` / new `api` | Tier 3 | **MEDIUM** | No public merchant API, outbound webhooks, or app/extension model. GAP-08's event-bus runtime is the enabling seam |
| **GAP-17** | `web` / `products` | Tier 2 | **MEDIUM** | No multi-currency presentment or i18n / vernacular-language storefronts |
| **GAP-18** | `email` / new `marketing` | Tier 2 | **LOW** | Only transactional email exists; no campaigns, segmentation, or automation |
| **GAP-19** | new `subscriptions` | Tier 2 | **LOW** | No product-subscription / recurring-order model for merchants (platform-admin "subscriptions" bills merchants, not their customers) |
| **GAP-20** | `web` | Tier 3 | **LOW** | No cache/scale layer (in-memory rate limiter, no Redis, single-region) — acceptable now; named before scale forces it |

---

## 3. Detailed Specifications — Open & New Gaps

Resolved gaps (GAP-01, 02, 03, 05, 06, 07, 10) retain their original specifications in version history; only open and new gaps are detailed below.

### GAP-04: Structured Order Fulfillment & Carrier Tracking
- **Module**: `modules/orders`, `packages/db`, `apps/web`
- **Severity**: MEDIUM — **Open**
- **Evidence**: `apps/web/app/api/v1/stores/[storeId]/orders/[orderId]/fulfill/route.ts` formats carrier + tracking into a status string; `orders` schema has no `tracking_carrier` / `tracking_number` / `tracking_url` columns.
- **Impact**: Customers cannot see clickable tracking; merchants cannot do partial line-item fulfillment.
- **Recommended**: Add a structured `order_fulfillments` table (or tracking columns), expose fields in `OrderDTO`, render clickable tracking in storefront order views.

### GAP-08: EventBus Runtime
- **Module**: `packages/event-bus`
- **Severity**: LOW — **Open**
- **Evidence**: `packages/event-bus/src/index.ts` declares interfaces only; modules orchestrate synchronously.
- **Impact**: No async decoupling and no seam for outbound webhooks (see GAP-16).
- **Recommended**: Implement an in-memory async dispatcher or transactional-outbox publisher, then build GAP-16 on top of it.

### GAP-09: Content Security Policy & Security Headers
- **Module**: `apps/web`
- **Severity**: LOW — **Open**
- **Evidence**: `apps/web/middleware.ts` sets no CSP, `X-Frame-Options`, or HSTS.
- **Recommended**: Add security headers in middleware with explicit Razorpay script/frame allowances.

### GAP-11: Tax / GST Engine
- **Module**: new `modules/tax`, `modules/checkout`
- **Tier/Severity**: Tier 1 — **CRITICAL**
- **Evidence**: `modules/checkout/src/domain/checkout.ts` validates and stores `taxTotal` but no service computes it; no tax tables in migrations.
- **Impact**: Indian merchants cannot issue GST-compliant invoices (CGST/SGST/IGST split, HSN codes, place-of-supply rules). This blocks real-world selling in the target market.
- **Recommended**: A `tax` module computing tax from product HSN/tax-class, store state, and customer place-of-supply; GST invoice numbering and templates; wire into checkout recalculation.
- **Acceptance**: Checkout totals include correctly split GST per line; a compliant tax invoice is generated per order.

### GAP-12: Shipping Rate Engine & Logistics
- **Module**: new `modules/shipping`, `modules/checkout`
- **Tier/Severity**: Tier 1 — **CRITICAL**
- **Evidence**: `shippingTotal` is a stored field only; no zones, rate rules, or carrier integration anywhere in `modules/` or `apps/`.
- **Impact**: No real delivery pricing, no COD, no courier handoff or AWB/label generation.
- **Recommended**: Shipping zones + weight/dimension rate rules; courier integrations (Shiprocket / Delhivery / Blue Dart); COD support; label/AWB generation; wire rates into checkout.
- **Acceptance**: Checkout shows accurate per-destination rates; COD selectable; a shipment with AWB is created on fulfillment.

### GAP-13: Customer-Initiated Returns / RMA
- **Module**: new `modules/returns`, `modules/orders`
- **Tier/Severity**: Tier 1 — **HIGH**
- **Evidence**: Cancellation and refund flows live in `modules/orders` and are merchant-triggered only; no return-request entity.
- **Impact**: Customers cannot request returns; merchants handle them out-of-band.
- **Recommended**: A `return_requests` entity with a state machine (requested → approved/rejected → received → refunded), storefront request UI, and merchant review, reusing the existing refund path.

### GAP-14: Gift Cards & Store Credit
- **Module**: new `modules/giftcards`
- **Tier/Severity**: Tier 1 — **MEDIUM**
- **Evidence**: No stored-value instruments in schema or modules.
- **Impact**: No gift cards for sale, and refunds cannot be issued as store credit.
- **Recommended**: Gift card / store-credit ledger with issuance, redemption at checkout, and balance tracking; idempotent like discounts/refunds.

### GAP-15: Abandoned-Cart Recovery
- **Module**: `modules/carts`, `apps/worker`, `packages/email`
- **Tier/Severity**: Tier 1 — **MEDIUM**
- **Evidence**: Carts are abandoned but no worker job purges old carts and no recovery email template exists.
- **Impact**: Lost conversion and unbounded cart-table growth.
- **Recommended**: A worker job to flag/purge stale carts and enqueue recovery emails through the existing notification outbox.

### GAP-16: Public Merchant API, Webhooks & App Model
- **Module**: new `apps/web` public API surface, `packages/event-bus`
- **Tier/Severity**: Tier 3 — **MEDIUM**
- **Evidence**: 130+ internal v1 routes exist, but none are a documented, authenticated public API; no outbound webhooks; event-bus has no runtime (GAP-08).
- **Impact**: No third-party ecosystem — the primary moat a commerce platform builds over time.
- **Recommended**: Resolve GAP-08, then expose a versioned public API with per-store API keys, outbound webhook subscriptions (built on the event-bus runtime), and a minimal app/extension model.

### GAP-17 – GAP-20 (Tier 2/3, briefly)
- **GAP-17 Multi-currency / i18n**: presentment currency and vernacular-language storefronts.
- **GAP-18 Marketing**: broadcast campaigns, segmentation, and automation beyond transactional email.
- **GAP-19 Product subscriptions**: recurring-order model for merchants selling subscriptions.
- **GAP-20 Scale layer**: Redis-backed rate limiting/caching and multi-region readiness when scale requires it.

---

## 4. Next Milestone

The recommended next milestone remains **Structured Fulfillment & Returns** (GAP-04 + GAP-13) — the smallest Tier-1 increment that closes the post-purchase trust gap — followed by **Tax/GST** (GAP-11) and **Shipping/Logistics** (GAP-12), which are the price of entry for real Indian merchants. See `docs/audit/implementation-roadmap.md` for full milestone sequencing and acceptance criteria.
