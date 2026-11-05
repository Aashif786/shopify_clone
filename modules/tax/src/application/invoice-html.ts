import { amountInWordsInr } from "../domain/amount-in-words.js";
import { formatGstRate } from "../domain/gst-calculation.js";
import { financialYearLabel } from "../domain/invoice-number.js";
import type { TaxInvoiceDTO } from "./dtos.js";

function escapeHtml(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(minorUnits: number, currency: string): string {
  const amount = minorUnits / 100;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
  }
}

function formatIssueDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

function addressBlock(parts: Array<string | null | undefined>): string {
  return parts
    .filter((part): part is string => !!part && part.trim().length > 0)
    .map((part) => escapeHtml(part))
    .join("<br />");
}

/**
 * Renders a GST tax invoice as a self-contained, print-ready HTML document.
 *
 * It carries the particulars Rule 46 of the CGST Rules requires: supplier name,
 * address and GSTIN; a unique invoice number and date; the recipient's name,
 * address and state; place of supply; per-line description, HSN code, quantity,
 * taxable value, and rate and amount of each tax head; and the invoice total in
 * words. Every interpolated value is HTML-escaped.
 */
export function renderTaxInvoiceHtml(invoice: TaxInvoiceDTO): string {
  const { seller, buyer, currency } = invoice;
  const isIntra = invoice.supplyType === "INTRA_STATE";
  const isExport = invoice.supplyType === "EXPORT";

  const taxHeaders = isIntra
    ? `<th class="num">CGST</th><th class="num">SGST</th>`
    : isExport
      ? ""
      : `<th class="num">IGST</th>`;

  const lineRows = invoice.lines
    .map((line) => {
      const taxCells = isIntra
        ? `<td class="num">${escapeHtml(money(line.cgst, currency))}</td><td class="num">${escapeHtml(money(line.sgst, currency))}</td>`
        : isExport
          ? ""
          : `<td class="num">${escapeHtml(money(line.igst, currency))}</td>`;
      return `
        <tr>
          <td>${line.lineNumber}</td>
          <td>${escapeHtml(line.description)}</td>
          <td>${escapeHtml(line.hsnCode ?? "—")}</td>
          <td class="num">${line.quantity}</td>
          <td class="num">${escapeHtml(money(line.unitPrice, currency))}</td>
          <td class="num">${escapeHtml(money(line.discount, currency))}</td>
          <td class="num">${escapeHtml(money(line.taxableValue, currency))}</td>
          <td class="num">${escapeHtml(formatGstRate(line.gstRateBps))}</td>
          ${taxCells}
          <td class="num">${escapeHtml(money(line.lineTotal, currency))}</td>
        </tr>`;
    })
    .join("");

  const taxTotals = isIntra
    ? `<tr><td>CGST</td><td class="num">${escapeHtml(money(invoice.cgstTotal, currency))}</td></tr>
       <tr><td>SGST</td><td class="num">${escapeHtml(money(invoice.sgstTotal, currency))}</td></tr>`
    : isExport
      ? ""
      : `<tr><td>IGST</td><td class="num">${escapeHtml(money(invoice.igstTotal, currency))}</td></tr>`;

  const words =
    currency.toUpperCase() === "INR"
      ? `<p class="words"><strong>Amount in words:</strong> ${escapeHtml(amountInWordsInr(invoice.grandTotal))}</p>`
      : "";

  const exportNote = isExport
    ? `<p class="note">Supply meant for export. No Indian GST is charged on this invoice.</p>`
    : "";

  const placeOfSupply = invoice.placeOfSupplyName
    ? `${escapeHtml(invoice.placeOfSupplyName)} (${escapeHtml(invoice.placeOfSupplyCode ?? "")})`
    : "Outside India";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tax Invoice ${escapeHtml(invoice.invoiceNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #111; margin: 0; padding: 24px; background: #fff; }
    .sheet { max-width: 960px; margin: 0 auto; }
    h1 { font-size: 20px; margin: 0 0 4px; letter-spacing: 0.02em; }
    .head { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
    .meta { text-align: right; line-height: 1.6; }
    .parties { display: flex; gap: 24px; margin-bottom: 16px; }
    .party { flex: 1; border: 1px solid #ccc; padding: 10px 12px; line-height: 1.5; }
    .party h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 6px; color: #555; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f4f4f4; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
    .num { text-align: right; white-space: nowrap; }
    .totals { margin-left: auto; width: 320px; }
    .totals td { border: none; border-bottom: 1px solid #eee; }
    .totals tr.grand td { border-top: 2px solid #111; font-weight: bold; font-size: 14px; }
    .words, .note, .foot { line-height: 1.5; }
    .foot { margin-top: 24px; display: flex; justify-content: space-between; gap: 24px; color: #444; }
    .sign { text-align: right; min-width: 220px; padding-top: 40px; border-top: 1px solid #999; }
    @media print { body { padding: 0; } .sheet { max-width: none; } }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      <div>
        <h1>TAX INVOICE</h1>
        <div>${escapeHtml(seller.legalName)}</div>
      </div>
      <div class="meta">
        <div><strong>Invoice No:</strong> ${escapeHtml(invoice.invoiceNumber)}</div>
        <div><strong>Date:</strong> ${escapeHtml(formatIssueDate(invoice.issuedAt))}</div>
        <div><strong>Financial year:</strong> ${escapeHtml(financialYearLabel(invoice.financialYear))}</div>
        <div><strong>Reverse charge:</strong> No</div>
      </div>
    </div>

    <div class="parties">
      <div class="party">
        <h2>Supplier</h2>
        <strong>${escapeHtml(seller.legalName)}</strong><br />
        ${addressBlock([seller.addressLine1, seller.addressLine2, `${seller.city} ${seller.postalCode}`.trim(), seller.stateName])}
        <br /><strong>GSTIN:</strong> ${escapeHtml(seller.gstin)}
        <br /><strong>State code:</strong> ${escapeHtml(seller.stateCode)}
      </div>
      <div class="party">
        <h2>Bill to / Ship to</h2>
        <strong>${escapeHtml(buyer.name)}</strong><br />
        ${addressBlock([buyer.addressLine1, buyer.addressLine2, `${buyer.city} ${buyer.postalCode ?? ""}`.trim(), buyer.state, buyer.country])}
        ${buyer.gstin ? `<br /><strong>GSTIN:</strong> ${escapeHtml(buyer.gstin)}` : ""}
        <br /><strong>Place of supply:</strong> ${placeOfSupply}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Description</th>
          <th>HSN/SAC</th>
          <th class="num">Qty</th>
          <th class="num">Unit price</th>
          <th class="num">Discount</th>
          <th class="num">Taxable value</th>
          <th class="num">Rate</th>
          ${taxHeaders}
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>${lineRows}
      </tbody>
    </table>

    <table class="totals">
      <tbody>
        <tr><td>Taxable value</td><td class="num">${escapeHtml(money(invoice.taxableTotal, currency))}</td></tr>
        ${taxTotals}
        ${invoice.shippingTotal > 0 ? `<tr><td>Shipping</td><td class="num">${escapeHtml(money(invoice.shippingTotal, currency))}</td></tr>` : ""}
        <tr class="grand"><td>Invoice total</td><td class="num">${escapeHtml(money(invoice.grandTotal, currency))}</td></tr>
      </tbody>
    </table>

    ${words}
    ${exportNote}

    <div class="foot">
      <div>This is a computer-generated invoice.</div>
      <div class="sign">Authorised signatory<br />${escapeHtml(seller.legalName)}</div>
    </div>
  </div>
</body>
</html>`;
}
