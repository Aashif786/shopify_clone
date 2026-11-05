# Tax / GST Specification

## 1. Purpose

This specification defines the Tax domain of the Cal Cart commerce platform (gap
**GAP-11**, milestone **M5**): computing Indian GST at checkout, splitting it
correctly, and issuing a compliant tax invoice for every paid order.

The Tax domain owns:

- Per-store GST registration (`tax_settings`)
- Per-product HSN/SAC code and GST rate (`product_tax_profiles`)
- The GST calculation and its frozen per-checkout result (`checkout_tax_snapshots`)
- Tax invoices and their numbering (`tax_invoices`, `tax_invoice_lines`,
  `tax_invoice_sequences`)

It does **not** own:

- Checkout totals or line items (`modules/checkout`)
- Orders and order lines (`modules/orders`)
- Payments (`modules/payments`)
- Product data (`modules/products`)

Other modules reach Tax only through `TaxService`. Tax never reads another
module's tables and never imports `modules/checkout`, `modules/orders` or
`modules/payments`.

---

## 2. Scope

### In scope

- GST computed per line from the product's rate and the buyer's place of supply.
- Correct split into CGST + SGST (intra-state) or IGST (inter-state).
- Zero-rated treatment of deliveries outside India (exports).
- Discounts reducing the taxable value.
- A fail-closed payment guard so a customer is never charged an amount that
  skipped the tax engine.
- A numbered, immutable tax invoice per paid order, as printable HTML.

### Explicitly out of scope (deferred)

- **Tax-inclusive (MRP) pricing.** Tax is always added on top of the listed
  price. See section 4.
- **Tax on shipping.** There is no shipping engine yet (GAP-12), so
  `shippingTotal` carries no GST. Revisit with M6.
- **Compensation cess**, TCS/TDS, and reverse-charge supplies.
- **Credit notes.** A correction to an invoice is a separate document. Issued
  invoices are immutable; there is no edit path.
- **B2B buyer GSTIN capture** at checkout. Invoices are issued to the shipping
  party without a buyer GSTIN.
- **PDF output.** Invoices are print-ready HTML (use the browser's Save as PDF),
  which avoids adding a rendering dependency.
- **E-invoicing / IRN** for businesses above the e-invoicing turnover threshold.

---

## 3. Off by default

A store with no `tax_settings` row, or `is_enabled = FALSE`, computes **zero**
tax and issues no invoices. Every existing store behaves exactly as it did
before this milestone. Tax is opt-in per store.

When a store has tax **off**:

- Checkout totals are untouched, including a merchant-set `taxTotal` through the
  existing merchant checkout route.
- The payment guard does not apply.
- No tax snapshot or invoice is created.

When a store has tax **on**, the engine is authoritative: any manually supplied
tax figure is overwritten on the next recalculation.

---

## 4. Tax-exclusive pricing

GST is added on top of the listed price, so the platform-wide invariant

```text
total = subtotal − discountTotal + taxTotal + shippingTotal
```

holds unchanged. Carts, checkout, orders and payments all enforce that
invariant, and the Tax milestone deliberately does not change it.

Many Indian merchants quote **MRP, which already includes GST**. Such a store
must lower its listed prices before enabling tax, or customers pay the tax twice.
The merchant tax screen says so. Supporting inclusive pricing means a tax
component embedded in `subtotal` and a change to that invariant in four modules;
it is the largest known gap in this domain and is tracked as follow-up work.

---

## 5. Calculation

### 5.1 Place of supply

| Buyer destination | Supply type | Tax levied |
| :--- | :--- | :--- |
| India, same state as seller | `INTRA_STATE` | CGST + SGST |
| India, different state | `INTER_STATE` | IGST |
| Outside India | `EXPORT` | none |

The seller's state comes from `tax_settings.state_code`, which must match the
first two digits of the GSTIN. The buyer's state comes from the **shipping**
address (billing is irrelevant to place of supply).

State input is free text, so it is resolved to a GST state code from the full
name, a known alias or former name (Orissa, Pondicherry), a two-letter
abbreviation (MH, DL), or the numeric code. An Indian address whose state does
not resolve is **rejected** with `INVALID_PLACE_OF_SUPPLY`; guessing would charge
the wrong tax head.

### 5.2 Per-line arithmetic

For each line:

```text
gross    = unitPrice × quantity
discount = this line's share of the checkout discount
taxable  = gross − discount
intra:  CGST = SGST = round(taxable × rateBps ÷ 20000)
inter:  IGST        = round(taxable × rateBps ÷ 10000)
```

- Rates are integer **basis points** (1800 = 18%), so 0.25% and 2.5% are exact.
- All arithmetic is integer; rounding is half-up. No floating point enters a tax
  figure.
- CGST and SGST are computed once and applied to both heads, so they are equal
  by construction, as the law requires, even when the half-rate rounds.
- The checkout discount is allocated across lines by the **largest-remainder
  method**, so line discounts sum to exactly the discount applied. A discount
  larger than the subtotal is clamped.
- A product with no `product_tax_profiles` row uses the store's
  `default_gst_rate_bps` and carries no HSN code.

### 5.3 When it is recalculated

`CheckoutService` recalculates tax after every mutation that changes the taxable
base: creating a checkout, adding, resizing, removing or clearing items, changing
the shipping address, and changing the discount. Recalculating on only some of
these would leave a stale figure for payment to charge.

### 5.4 The frozen snapshot

Each recalculation upserts one `checkout_tax_snapshots` row holding the per-line
result, the seller's registration at that moment, and the totals. The order
handoff and the invoice are built from this snapshot, never recomputed, so a
later rate or registration change cannot alter a checkout the customer already
paid.

Database constraints back the arithmetic: `tax_total = cgst + sgst + igst`,
`cgst = sgst`, and a supply is never both intra- and inter-state.

---

## 6. Payment guard

`PaymentService.createPayment` calls `TaxService.assertCheckoutTaxCurrent` inside
its transaction. For a tax-enabled store it refuses payment with
`CHECKOUT_TAX_NOT_CURRENT` unless the checkout's stored subtotal, discount and
tax all match its snapshot. This catches, with one rule:

- a checkout with **no shipping address** yet (no snapshot exists),
- a **stale** calculation,
- a checkout whose tax figure was **tampered with** after calculation.

The customer is therefore never charged an amount that skipped or contradicted
the tax engine.

---

## 7. Order handoff

When the order is created from the paid checkout, each order line receives its
share of the discount and its GST (`order_items.discount_amount`,
`order_items.tax_amount`), so that

```text
sum(lineTotal) = grandTotal − shippingTotal
```

Tax figures are taken from the snapshot only if the snapshot's tax total equals
the tax that was charged. If it does not, the order still completes at the
charged amount with zero per-line tax and no invoice, rather than blocking an
order for money already captured.

The discount is allocated onto lines **even for stores that charge no tax**. A
line that records no discount would otherwise be refunded at full price by a
return (see `specs/returns/returns-spec.md` section 3.4).

---

## 8. Invoices

### 8.1 Content

An invoice carries the particulars Rule 46 of the CGST Rules requires: supplier
name, address and GSTIN; a unique serial number and date; the recipient's name,
address and state; place of supply; for each line the description, HSN/SAC code,
quantity, taxable value, and rate and amount of each tax head; the total, and the
total in words (INR only).

### 8.2 Numbering

Format `INV/<fy>/<serial>`, for example `INV/2627/000001`.

- At most **16 characters** of letters, digits, `-` and `/` (Rule 46). Enforced by
  a database check as well as in code. A serial past 999,999 widens to seven
  digits, exactly 16 characters; beyond that issuance is refused rather than
  truncated.
- The financial year runs **April to March, evaluated in IST**. An invoice raised
  at 00:30 IST on 1 April belongs to the new year even though it is still 31
  March in UTC.
- Numbers are **gapless** per store per financial year. The counter is taken with
  an atomic upsert inside the issuing transaction, so a failed attempt rolls its
  number back, and concurrent issuers serialise on the counter row.

### 8.3 Immutability

`tax_invoices` and `tax_invoice_lines` reject `UPDATE` and `DELETE` through a
database trigger. An issued invoice is a legal record; a correction would be a
credit note, which is deferred.

### 8.4 When it is issued

**After** the purchase transaction commits, in its own transaction, through
`PaymentOrderIntegration.finalizeCapturedPurchase`. It is best effort: a failure
is logged and never affects the paid order. The invoice is also issued
**lazily** on the first request for it (idempotent, one invoice per order), which
is the safety net for any failure and for orders placed before a store enabled
tax.

Why not inside the purchase transaction: see ADR-015. In short, the database
layer rejects every statement after the first failure in a transaction, so an
invoicing error raised inside it would roll back an order the customer has
already paid for.

### 8.5 Delivery

| Method | Path | Notes |
| :--- | :--- | :--- |
| `GET` | `/api/v1/stores/[storeId]/orders/[orderId]/invoice` | Merchant staff |
| `GET` | `/api/v1/storefront/[storeSlug]/orders/[orderId]/invoice` | Order owner |

Default response is HTML; `?format=json` returns the invoice as JSON;
`?download=1` serves it as an attachment. The storefront route uses the same
ownership check as the order itself (session customer or guest token, the latter
also accepted as a `guestToken` query parameter so a link can carry it); a
non-owner receives the same `ORDER_NOT_FOUND` 404 as a missing order.

The document is personal data, so it is served `Cache-Control: private,
no-store`, `X-Content-Type-Options: nosniff`, and a CSP of
`default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'`. Every
interpolated value is HTML-escaped.

---

## 9. API surface

| Method | Path | Min role |
| :--- | :--- | :--- |
| `GET` | `/api/v1/stores/[storeId]/tax/settings` | staff |
| `PATCH` | `/api/v1/stores/[storeId]/tax/settings` | **admin** |
| `GET` | `/api/v1/stores/[storeId]/tax/profiles?productIds=a,b` | staff |
| `GET` | `/api/v1/stores/[storeId]/products/[productId]/tax` | staff |
| `PUT` / `DELETE` | `/api/v1/stores/[storeId]/products/[productId]/tax` | **admin** |

Settings and rates change what every customer is charged and what is printed on
legal documents, hence admin. Product ownership is confirmed through
`ProductService` before a profile is written; the composite
`(product_id, store_id)` foreign key is the database-level backstop.

The storefront checkout responses include `taxEnabled` and a `tax` breakdown
(per-line rate, HSN and CGST/SGST/IGST), read from the snapshot and never
recalculated, so the customer sees exactly what will be charged.

---

## 10. Tenant isolation

- Every table carries `store_id`; every repository statement is store-scoped.
- Every reference to another module's row is a composite `(id, store_id)` foreign
  key (`products`, `checkouts`, `orders`).
- Invoices reference orders `ON DELETE RESTRICT`, so a legal record cannot be
  cascaded away.

---

## 11. Acceptance criteria

1. Checkout totals include correctly split GST per line item.
2. Every paid order of a tax-enabled store has a downloadable, numbered, immutable
   tax invoice.
3. A customer is never charged a tax-enabled checkout whose tax is missing, stale
   or altered.
4. A paid order is never lost to an invoicing failure.
5. A return refunds the tax the customer actually paid, and never more than was
   paid in total.
6. A store with tax off is completely unaffected.
