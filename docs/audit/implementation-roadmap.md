# Cal Cart: Dependency-Aware Implementation Roadmap

This roadmap groups the findings from the Product Maturity Audit and the current gap register into small, self-contained, dependency-aware milestones. Each milestone has clear boundaries, explicit exclusions, and rigorous acceptance criteria.

> **Status refresh — 2026-11-04.** Milestones M1–M3 are complete and verified in the current codebase. This revision supersedes the original M4/M5 plan: it sequences the remaining Tier-1 commerce gaps (tax, shipping, returns, stored-value) and the platform/ecosystem work ahead of the chosen differentiation wedge. See `docs/audit/gap-register.md` for gap detail.

---

## Roadmap Overview

```mermaid
flowchart LR
  M1["M1: Inventory Reclaim & Rate Limiting"] --> M2["M2: Customer Emails"]
  M2 --> M3["M3: Catalog Discovery & Collections"]
  M3 --> M4["M4: Structured Fulfillment & Returns"]
  M4 --> M5["M5: Tax & GST Engine"]
  M5 --> M6["M6: Shipping & Logistics"]
  M6 --> M7["M7: Retention Instruments"]
  M7 --> M8["M8: Platform API & Ecosystem"]
  M8 --> M9["M9: Differentiation Wedge"]
```

---

## Milestone Matrix

| Milestone | Target Domain | Primary Focus | Gaps Addressed | Status / Est. |
| :--- | :--- | :--- | :--- | :--- |
| **M1** | Reliability & Security | Expired reservation reclaim & route rate limiting | GAP-01, GAP-02 | **Complete** |
| **M2** | Customer Communications | Transactional order lifecycle emails | GAP-03 | **Complete** |
| **M3** | Storefront Discovery | Search, filtering, sorting, collections | GAP-05, GAP-06 | **Complete** |
| **M4** | Merchant Operations | Structured tracking + customer returns/RMA | GAP-04, GAP-13 | **Recommended next · ~1 wk** |
| **M5** | Checkout Correctness | Tax / GST computation & compliant invoices | GAP-11 | ~1.5–2 wk |
| **M6** | Logistics | Shipping rates, couriers, COD, AWB | GAP-12 | ~2–3 wk |
| **M7** | Retention | Gift cards / store credit + abandoned-cart recovery | GAP-14, GAP-15 | ~1.5 wk |
| **M8** | Platform & Ecosystem | Event-bus runtime, public API, webhooks | GAP-08, GAP-16 | ~2–3 wk |
| **M9** | Differentiation | India-first + white-label build-out; AI accelerant | — | Ongoing |

*Estimates are rough order-of-magnitude for one experienced engineer and exclude design iteration.*

---

## Completed Milestones (M1–M3)

- **M1 — Inventory Hold Reclaim & Rate Limiting.** `inventory-expiration-recovery-job` releases expired holds under distributed lease locks; sliding-window rate limiting guards login and payment-verify routes. Verified.
- **M2 — Customer Email Notifications.** Durable `notification_outbox` with `FOR UPDATE SKIP LOCKED` claim; order confirmation, fulfillment, cancellation, and refund templates; `NotificationDispatchJob` with exponential backoff. Verified.
- **M3 — Catalog Discovery & Collections.** Keyword search across title/description/SKU, variant-aware price filtering, authoritative in-stock filter, deterministic sorting with cursor pagination, and a full collections domain with storefront gallery/detail pages. Verified.

---

## Milestone 4: Structured Fulfillment & Customer Returns (Recommended Next)

### Objective
Replace free-form tracking strings with structured carrier data and give customers a self-service return path, closing the post-purchase trust gap with minimal new infrastructure.

### Scope
- Migration adding structured tracking (`tracking_carrier`, `tracking_number`, `tracking_url`) or an `order_fulfillments` table supporting partial fulfillment.
- Structured tracking fields in the merchant fulfillment form and `OrderDTO`; clickable tracking in storefront order views.
- A `return_requests` entity and state machine (requested → approved/rejected → received → refunded), a storefront return-request UI, and merchant review, reusing the existing refund path.

### Exclusions
- No carrier API integration yet (that is M6); tracking numbers are merchant-entered.
- No automated return shipping labels.

### Acceptance Criteria
1. Merchant-entered carrier and tracking render as structured, clickable links in customer order views.
2. A customer can request a return on an eligible order; the merchant can approve and process it through to refund.

---

## Milestone 5: Tax & GST Engine

### Objective
Compute tax correctly and issue GST-compliant invoices, making the platform usable by real Indian merchants.

### Scope
- A `tax` module computing tax from product tax class / HSN code, store registration state, and customer place-of-supply, producing a correct CGST/SGST/IGST split.
- GST invoice numbering, templates, and storage; wired into checkout price recalculation and the order record.

### Acceptance Criteria
1. Checkout totals include correctly split GST per line item.
2. Every paid order produces a downloadable, compliant tax invoice.

---

## Milestone 6: Shipping & Logistics

### Objective
Provide real delivery pricing and courier handoff, including COD.

### Scope
- Shipping zones and weight/dimension rate rules wired into checkout.
- Courier integration (Shiprocket / Delhivery / Blue Dart) for rates and AWB/label generation.
- COD as a selectable method with its own reconciliation path.

### Acceptance Criteria
1. Checkout shows accurate per-destination rates; COD is selectable where allowed.
2. Fulfillment creates a shipment with a real AWB and printable label.

---

## Milestone 7: Retention Instruments

### Objective
Lift conversion and retention on an already-working funnel.

### Scope
- Gift card / store-credit ledger: issuance, checkout redemption, balance tracking, refund-to-credit.
- Abandoned-cart worker job: flag/purge stale carts and enqueue recovery emails via the notification outbox.

### Acceptance Criteria
1. A gift card can be sold, redeemed partially at checkout, and its balance tracked idempotently.
2. An abandoned cart triggers a recovery email, and stale carts are purged on schedule.

---

## Milestone 8: Platform API & Ecosystem

### Objective
Open the platform to third parties — the long-term moat.

### Scope
- Implement the `event-bus` runtime dispatcher (GAP-08).
- A versioned, authenticated public merchant API with per-store API keys.
- Outbound webhook subscriptions built on the event-bus runtime; delivery via the durable outbox pattern.

### Acceptance Criteria
1. A third party can authenticate with a store API key and read/write core resources.
2. Domain events deliver to subscribed webhook endpoints with retry and signature verification.

---

## Milestone 9: Differentiation Wedge (Ongoing)

Build out the strategic direction on top of the now-complete commerce core:
- **India-first** (go-to-market): UPI, the GST and courier work from M5/M6, COD, and WhatsApp order notifications and catalog.
- **Platform / white-label** (positioning): elevate the `apps/platform-admin` operator console so a customer can run their own vertical multi-merchant platform.
- **AI-native** (accelerant): AI storefront/section generation on the existing landing-page builder, AI merchandising, and an AI support agent over order/catalog data.
