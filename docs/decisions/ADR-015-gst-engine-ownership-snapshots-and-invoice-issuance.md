# ADR-015: GST Engine — Module Ownership, Frozen Snapshots, Fail-Closed Payment, and Post-Commit Invoicing

- **Status**: Accepted
- **Date**: 2026-11-05
- **Context**: GAP-11 / Milestone M5 — Tax / GST engine
- **Related**: [ADR-006](./ADR-006-idempotency-strategy.md),
  [ADR-009](./ADR-009-payment-refund-and-capture-integrity.md),
  [ADR-014](./ADR-014-returns-refund-ordering-and-ownership.md)

---

## Context

GST touches the three most sensitive modules in the platform: checkout (what the
customer is shown), payments (what the customer is charged) and orders (the
legal record). Several decisions had non-obvious trade-offs, and one rests on a
property of the database layer that is easy to miss.

---

## Decision 1: A new `modules/tax` owns all tax tables

Settings, per-product profiles, snapshots and invoices live in tables owned by
`modules/tax`, not as columns on `stores`, `products` or `orders`.

**Why.** Adding HSN and rate to `products` would have meant editing the products
schema, repository, DTOs, validators and merchant product form, all for another
domain's data. Owning the data keeps the blast radius inside the new module and
follows the precedent set by `return_policies` in ADR-014. Cross-module
references use composite `(id, store_id)` foreign keys so isolation is enforced
by the database.

Dependency direction is one-way: `checkout → tax`, `payments → tax`, and `tax`
imports only `db`, `types` and `validation`. Tax receives plain inputs and never
imports checkout, orders or payments. Where it needs a view of an order it
declares a structural type (`InvoiceableOrder`) rather than importing
`OrderDTO`.

---

## Decision 2: Tax is computed once per mutation and frozen as a snapshot

Every checkout mutation that changes the taxable base recalculates tax and
upserts a `checkout_tax_snapshots` row. The order handoff and the invoice are
built from that snapshot and never recompute.

**Alternative rejected: recompute at order and invoice time.** A rate or
registration change between payment and invoicing would then produce an invoice
that disagrees with what the customer was charged. The snapshot makes the invoice
a faithful record of the transaction.

**Alternative rejected: store only a tax total on the checkout.** That is what
the platform did before, and it cannot reconstruct a CGST/SGST split per line,
the HSN code, or the rate, all of which a compliant invoice needs.

---

## Decision 3: Payment fails closed on tax

`PaymentService.createPayment` refuses a tax-enabled checkout unless its stored
subtotal, discount and tax match its snapshot (`CHECKOUT_TAX_NOT_CURRENT`).

**Why.** Payment reads `checkout.total` straight from the database. Without a
guard, a checkout with no shipping address yet has no place of supply and
therefore zero tax, and a customer could pay the untaxed amount. The guard
catches a missing address, a stale calculation, and a tampered tax figure with a
single comparison, and does nothing for stores with tax off.

The tax engine is also made authoritative for tax-enabled stores: the existing
merchant route that sets `taxTotal` by hand is overridden on the next
recalculation, rather than becoming a way around the engine.

---

## Decision 4: Invoices are issued **after** the purchase transaction commits

This is the decision with a non-obvious cause.

### What I first built, and why it was wrong

The first design issued the invoice inside the purchase transaction, wrapped in a
`SAVEPOINT` so that an invoicing failure would roll back to the savepoint and let
the order commit. That is standard PostgreSQL practice.

It does not work here. `packages/db`'s `withTransaction` wrapper is **fail-fast**:
the first time any statement in a transaction errors, it latches that error and
makes *every subsequent statement throw it*, including `ROLLBACK TO SAVEPOINT`.
A savepoint therefore cannot recover. Any SQL error during invoicing would have
rolled back the whole transaction: the order, the payment link and the checkout
completion for a customer who had already paid.

This was caught because the first version of the isolation test passed even with
the savepoint deleted. It called `completePurchaseWorkflow` on a pool, which opens
its own transaction and so bypassed the very condition under test. The production
entry point, `finalizeCapturedPurchase`, wraps the workflow in a single
transaction. Routing the tests through it, and then **mutation-testing** (removing
the protection and confirming the test fails), exposed the real behaviour.

### What is built

`finalizeCapturedPurchase` commits the purchase, then issues the invoice in a
**separate transaction** on the pool:

```text
runInTransaction( completePurchaseWorkflow )   → order, payment, checkout committed
issueInvoiceBestEffort( pool )                  → own transaction, failure logged only
```

`issueInvoiceBestEffort` refuses to run when handed a transaction client, because
a failure there could not be contained. A caller that owns a transaction simply
gets no eager invoice; it is issued on first request instead.

### Consequences

- A paid order can never be lost to an invoicing problem. The failure mode is
  "order exists, invoice not yet issued".
- That state is recoverable and self-healing: `loadOrIssueInvoice` issues the
  invoice on the first download request. Issuance is idempotent (one invoice per
  order, enforced by a unique constraint), so concurrent callers converge on one
  invoice and consume one number.
- Numbering stays **gapless**: the sequence counter is incremented inside the
  issuing transaction, so a failed attempt rolls its number back, verified by a
  test that fails an issuance and checks the next invoice is still number 2.
- The window between order creation and invoice issuance is short and not
  customer-visible; the storefront link only appears once an invoice exists.

### The general lesson

Anywhere in this codebase, **a failure inside a transaction cannot be contained,
and `SAVEPOINT` is not an escape hatch**. Existing code that is described as
"fail-open" inside a transaction (for example the notification outbox enqueues)
swallows the exception but does not rescue the transaction if the failure was a
SQL error. That is outside this ADR's scope but worth knowing.

---

## Decision 5: Tax-exclusive pricing for now

Tax is added on top of listed prices. The platform enforces
`total = subtotal − discount + tax + shipping` in carts, checkout, orders and
payments; changing it for MRP-inclusive pricing means touching all four. That is
deferred and called out to merchants in the tax settings screen, because a
store that already lists GST-inclusive prices and enables tax will double-charge.

---

## Decision 6: A checkout discount is itemised onto order lines even without tax

While wiring per-line tax, the order handoff was found to never populate an order
line's `discount_amount`. The consequence reached back into M4: a return on a
discounted order was refunded at the undiscounted price. The regression test
requested 20,000 against 16,000 actually paid.

The discount is now allocated across lines (largest-remainder, so it sums exactly)
for **every** store, and the return arithmetic refunds
`price × qty − discount + tax`, pro-rated and rounded down for partial quantities
so cumulative partial returns never exceed the charge.

---

## Consequences summary

| Property | How it is guaranteed |
| :--- | :--- |
| Tax never skipped at payment | Payment guard compares checkout to snapshot |
| Invoice matches what was charged | Built from the frozen snapshot, totals reconciled before insert |
| Paid order survives invoice failure | Invoice issued after commit, in its own transaction |
| No invoice-number gaps | Counter taken in the issuing transaction; failure rolls it back |
| No duplicate invoices | Unique `(store_id, order_id)`; idempotent, race-safe issuance |
| Invoice cannot be altered | Database trigger rejects UPDATE and DELETE |
| Wrong tax head impossible | Place of supply resolved or rejected, never guessed |
| CGST always equals SGST | Computed once, applied to both heads; database check |
