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
| **GAP-08** | `event-bus` | Technical Debt | LOW | **Open** | `@calcart/event-bus` is interface-only; no runtime dispatcher |
| **GAP-09** | `security` / `web` | Hardening | LOW | **Open** | No Content Security Policy / security headers in `apps/web/middleware.ts` |
| **GAP-10** | `inventory` / `orders` | Missing Feature | LOW | **Resolved** | Stock threshold made configurable (migration `0016_add_stock_threshold_and_max_order_quantity.sql`) |

### 2.2 New register — production commerce gaps (GAP-11 onward)

| ID | Module / Workflow | Tier | Severity | Short Description |
| :--- | :--- | :--- | :--- | :--- |
| **GAP-11** | `checkout` / new `tax` | Tier 1 | **CRITICAL** | **Resolved (M5)** — `modules/tax` computes per-line GST (CGST+SGST / IGST / export), recalculated on every checkout mutation, with a fail-closed payment guard and numbered immutable tax invoices. Tax-exclusive pricing only; MRP-inclusive pricing deferred |
| **GAP-12** | `checkout` / new `shipping` | Tier 1 | **CRITICAL** | No shipping rate engine. `shippingTotal` is a bare field — no zones, weight/dimension rules, carrier rates, COD, or AWB/label generation |
| **GAP-13** | `orders` / new `returns` | Tier 1 | **HIGH** | **Resolved (M4)** — `modules/returns` with a full RMA state machine, storefront request UI, merchant review queue, and refund via the existing payments path |
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
- **Severity**: MEDIUM — **Resolved (M4), with one deferred sub-item**
- **Original evidence**: `apps/web/app/api/v1/stores/[storeId]/orders/[orderId]/fulfill/route.ts` formatted carrier + tracking into a status string; the `orders` schema had no tracking columns.
- **Resolution**: Migration `0034_add_order_fulfillment_tracking.sql` adds `tracking_carrier`, `tracking_number`, and `tracking_url` to `orders`. `OrderStatusService.updateFulfillmentStatus` persists them inside the existing fulfillment transaction (`COALESCE`-updated, so a re-fulfilment that omits tracking retains the stored values). The fields are exposed on `OrderDTO` through both the list and hydrate read paths, and render as structured, clickable links in the merchant and storefront order views. The status-history `reason` now carries only the merchant note. The fulfillment email already supported carrier/number/URL and is fed from the persisted order values.
- **Boundary hardening**: `fulfillOrderValidator` accepts only absolute `http(s)` tracking URLs, so a `javascript:`/`data:` URL can never be persisted and later rendered as an `href` in order views or email.
- **Deferred**: Per-line-item (partial) fulfillment is **not** delivered. Only order-level `PARTIALLY_FULFILLED` exists, and a single tracking triple is stored per order. Supporting multiple shipments per order requires the `order_fulfillments` child table originally floated as the alternative design; it is not needed until the M6 courier work creates real multi-shipment orders.
- **Verification**: `tests/orders/order-status.service.test.ts` (9 passed) covers persistence and DTO exposure; `tests/security/request-validation.test.ts` (7 passed) covers tracking-URL scheme rejection; `tests/notifications` (24 passed) covers the fulfillment email path.

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
- **Module**: new `modules/shipping`, `modules/checkout`
- **Tier/Severity**: Tier 1 — **CRITICAL**
- **Evidence**: `shippingTotal` is a stored field only; no zones, rate rules, or carrier integration anywhere in `modules/` or `apps/`.
- **Impact**: No real delivery pricing, no COD, no courier handoff or AWB/label generation.
- **Recommended**: Shipping zones + weight/dimension rate rules; courier integrations (Shiprocket / Delhivery / Blue Dart); COD support; label/AWB generation; wire rates into checkout.
- **Acceptance**: Checkout shows accurate per-destination rates; COD selectable; a shipment with AWB is created on fulfillment.

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

**M5 — Tax & GST Engine is complete** (with tax-inclusive pricing deferred, see GAP-11). Together with M4 (structured fulfillment and returns), the checkout-to-post-purchase path now computes tax, charges it, invoices it, and refunds it correctly.

The recommended next milestone is **M6 — Shipping & Logistics** (GAP-12): shipping zones and rate rules, courier integration, COD, and AWB/label generation. It has two inbound dependencies recorded by M5:

1. **Tax on shipping.** `shippingTotal` currently carries no GST because no shipping engine exists. When shipping becomes a priced, taxed service, `calculateGst` and the invoice (which already reserves a shipping line) must tax it, and returns must decide how much shipping is refundable.
2. **Return shipping labels**, deferred from M4, belong here.

The largest known gap left in the tax domain is **MRP-inclusive pricing** (see GAP-11), which should be scheduled deliberately given its reach across four modules. See `docs/audit/implementation-roadmap.md` for full milestone sequencing and acceptance criteria.
