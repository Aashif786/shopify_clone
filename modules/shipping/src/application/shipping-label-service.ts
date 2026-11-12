/**
 * Service for generating high-fidelity, printable shipping labels and packing slips
 * formatted for 4x6 inch (100mm x 150mm) standard thermal label printers and A4 sheets.
 */

export interface ShippingLabelData {
  orderNumber: string;
  orderDate: string;
  carrierName: string;
  trackingNumber: string;
  trackingUrl?: string | null;
  carrierStatus?: string | null;
  isCod: boolean;
  codAmount?: number;
  currency: string;
  totalWeightGrams?: number;
  store: {
    name: string;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
    phone?: string | null;
    gstin?: string | null;
  };
  recipient: {
    name: string;
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    state?: string | null;
    postalCode: string;
    country: string;
    phone?: string | null;
  };
  items: Array<{
    name: string;
    variantTitle?: string | null;
    sku?: string | null;
    quantity: number;
    price: number;
  }>;
}

/**
 * Generates a clean, vector SVG barcode pattern for an AWB or tracking string.
 * Uses Code-128 inspired variable-width bars with quiet zones and human-readable text.
 */
export function generateBarcodeSvg(
  text: string,
  options: { height?: number; width?: number; showText?: boolean } = {},
): string {
  const height = options.height ?? 50;
  const width = options.width ?? 320;
  const showText = options.showText ?? true;

  // Generate deterministic bar widths based on input characters
  const clean = (text || "00000000").replace(/[^a-zA-Z0-9_-]/g, "");
  const bars: Array<{ x: number; w: number }> = [];

  let currentX = 16;
  const unitWidth = Math.max(1.8, (width - 32) / (clean.length * 9));

  // Guard bars at start
  bars.push({ x: currentX, w: unitWidth });
  currentX += unitWidth * 2;
  bars.push({ x: currentX, w: unitWidth });
  currentX += unitWidth * 2;

  // Encode each character into 3 bar/space pairs
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    const b1 = 1 + (code % 3);
    const s1 = 1 + ((code >> 1) % 3);
    const b2 = 1 + ((code >> 2) % 3);
    const s2 = 1 + ((code >> 3) % 2);

    bars.push({ x: currentX, w: b1 * unitWidth });
    currentX += (b1 + s1) * unitWidth;

    bars.push({ x: currentX, w: b2 * unitWidth });
    currentX += (b2 + s2) * unitWidth;
  }

  // Guard bars at end
  bars.push({ x: currentX, w: unitWidth });
  currentX += unitWidth * 2;
  bars.push({ x: currentX, w: unitWidth * 2 });
  currentX += unitWidth * 3;

  const rects = bars
    .map(
      (b) =>
        `<rect x="${b.x.toFixed(1)}" y="4" width="${b.w.toFixed(1)}" height="${(
          height - (showText ? 18 : 8)
        ).toFixed(1)}" fill="#000000" />`,
    )
    .join("");

  const textElement = showText
    ? `<text x="${(width / 2).toFixed(1)}" y="${(height - 2).toFixed(
        1,
      )}" text-anchor="middle" font-family="monospace, monospace" font-size="11" font-weight="700" fill="#000000" letter-spacing="1.5">${clean}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="max-width:100%;height:auto;display:block;margin:0 auto;">${rects}${textElement}</svg>`;
}

export class ShippingLabelService {
  /**
   * Formats a monetary integer amount into readable currency string (e.g. ₹1,299.00).
   */
  private formatAmount(amountPaise: number, currency: string = "INR"): string {
    const symbol = currency.toUpperCase() === "INR" ? "₹" : `${currency.toUpperCase()} `;
    const num = (amountPaise / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${symbol}${num}`;
  }

  /**
   * Generates a fully self-contained HTML document ready for direct thermal printing
   * or A4 preview with high-contrast typography, routing boxes, and AWB barcode.
   */
  renderHtmlShippingLabel(data: ShippingLabelData): string {
    const barcodeSvg = generateBarcodeSvg(data.trackingNumber, { height: 56, width: 340 });
    const isCod = data.isCod;
    const codDisplay = isCod
      ? this.formatAmount(data.codAmount ?? 0, data.currency)
      : null;

    const totalQty = data.items.reduce((sum, item) => sum + item.quantity, 0);
    const weightGrams = data.totalWeightGrams ?? 500;
    const weightDisplay = weightGrams >= 1000 ? `${(weightGrams / 1000).toFixed(2)} kg` : `${weightGrams} g`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shipping Label #${data.orderNumber} - ${data.trackingNumber}</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #000;
      background-color: #f3f4f6;
      padding: 24px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print {
      max-width: 400px;
      margin: 0 auto 16px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .print-btn {
      background: #111827;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 10px 20px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .print-btn:hover {
      background: #000000;
    }
    .label-page {
      width: 100mm;
      min-height: 150mm;
      background: #ffffff;
      margin: 0 auto;
      border: 2px solid #000;
      padding: 6mm;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #000;
      padding-bottom: 4mm;
      margin-bottom: 3mm;
    }
    .carrier-title {
      font-size: 16px;
      font-weight: 900;
      letter-spacing: -0.5px;
      text-transform: uppercase;
    }
    .service-badge {
      font-size: 10px;
      font-weight: 700;
      background: #000;
      color: #fff;
      padding: 2px 6px;
      border-radius: 4px;
      letter-spacing: 0.5px;
    }
    .barcode-section {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 3mm;
      margin-bottom: 3mm;
    }
    .routing-banner {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-bottom: 2px solid #000;
      margin-bottom: 3mm;
    }
    .pin-box {
      border-right: 2px solid #000;
      padding: 3mm;
      text-align: center;
    }
    .pin-label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .pin-val {
      font-size: 20px;
      font-weight: 900;
      font-family: monospace;
      letter-spacing: 2px;
      margin-top: 1mm;
    }
    .payment-box {
      padding: 3mm;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
      ${isCod ? "background: #000; color: #fff;" : "background: #fff; color: #000;"}
    }
    .payment-badge {
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.5px;
    }
    .payment-amount {
      font-size: 14px;
      font-weight: 900;
      margin-top: 1mm;
    }
    .address-section {
      border-bottom: 2px solid #000;
      padding-bottom: 3mm;
      margin-bottom: 3mm;
      font-size: 11px;
      line-height: 1.35;
    }
    .address-label {
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #374151;
      margin-bottom: 1mm;
    }
    .recipient-name {
      font-size: 13px;
      font-weight: 800;
      margin-bottom: 1mm;
    }
    .store-section {
      border-bottom: 1px solid #9ca3af;
      padding-bottom: 2.5mm;
      margin-bottom: 2.5mm;
      font-size: 9.5px;
      line-height: 1.3;
      color: #374151;
    }
    .specs-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 2mm;
      border-bottom: 1px solid #9ca3af;
      padding-bottom: 2.5mm;
      margin-bottom: 2.5mm;
      font-size: 9px;
      text-align: center;
    }
    .spec-item {
      display: flex;
      flex-direction: column;
    }
    .spec-title {
      font-weight: 700;
      color: #6b7280;
      text-transform: uppercase;
      font-size: 8px;
    }
    .spec-val {
      font-weight: 800;
      color: #000;
      margin-top: 1px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9px;
      margin-bottom: 2.5mm;
    }
    .items-table th {
      text-align: left;
      border-bottom: 1px solid #000;
      padding-bottom: 1mm;
      font-weight: 800;
      font-size: 8px;
      text-transform: uppercase;
    }
    .items-table td {
      padding: 1.5mm 0;
      border-bottom: 1px dashed #e5e7eb;
    }
    .items-table .text-right {
      text-align: right;
    }
    .footer-note {
      margin-top: auto;
      text-align: center;
      font-size: 8px;
      color: #6b7280;
      line-height: 1.3;
      border-top: 1px solid #e5e7eb;
      padding-top: 2mm;
    }

    @media print {
      body {
        background: #fff;
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
      .label-page {
        width: 100mm;
        height: 150mm;
        margin: 0;
        border: none;
        box-shadow: none;
        page-break-after: always;
      }
      @page {
        size: 100mm 150mm;
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="print-btn" onclick="window.print()">
      🖨️ Print Shipping Label (4x6)
    </button>
    <span style="font-size: 12px; color: #4b5563;">AWB: <strong>${data.trackingNumber}</strong></span>
  </div>

  <div class="label-page">
    <!-- Header -->
    <div class="header-row">
      <div class="carrier-title">${data.carrierName}</div>
      <div class="service-badge">EXPRESS SURFACE / AIR</div>
    </div>

    <!-- Barcode Section -->
    <div class="barcode-section">
      ${barcodeSvg}
    </div>

    <!-- Routing and Payment Banner -->
    <div class="routing-banner">
      <div class="pin-box">
        <div class="pin-label">DEST PIN CODE</div>
        <div class="pin-val">${data.recipient.postalCode}</div>
      </div>
      <div class="payment-box">
        <div class="payment-badge">${isCod ? "CASH ON DELIVERY" : "PREPAID"}</div>
        ${isCod ? `<div class="payment-amount">COLLECT ${codDisplay}</div>` : `<div style="font-size: 9px; margin-top: 2px;">DO NOT COLLECT CASH</div>`}
      </div>
    </div>

    <!-- Shipping Address -->
    <div class="address-section">
      <div class="address-label">SHIP TO (DELIVERY ADDRESS):</div>
      <div class="recipient-name">${data.recipient.name}</div>
      <div>${data.recipient.addressLine1}</div>
      ${data.recipient.addressLine2 ? `<div>${data.recipient.addressLine2}</div>` : ""}
      <div><strong>${data.recipient.city}</strong>, ${data.recipient.state || ""} - ${data.recipient.postalCode}</div>
      <div>${data.recipient.country}</div>
      ${data.recipient.phone ? `<div style="margin-top: 2px; font-weight: 700;">TEL: ${data.recipient.phone}</div>` : ""}
    </div>

    <!-- Store Origin Details -->
    <div class="store-section">
      <div class="address-label" style="font-size: 8px;">RETURN ADDRESS / SHIPPER:</div>
      <div style="font-weight: 700; color: #000;">${data.store.name}</div>
      <div>${[data.store.city, data.store.state, data.store.postalCode].filter(Boolean).join(", ")}</div>
      ${data.store.gstin ? `<div>GSTIN: <strong>${data.store.gstin}</strong></div>` : ""}
    </div>

    <!-- Package & Order Specs -->
    <div class="specs-grid">
      <div class="spec-item">
        <span class="spec-title">Order #</span>
        <span class="spec-val">${data.orderNumber}</span>
      </div>
      <div class="spec-item">
        <span class="spec-title">Date</span>
        <span class="spec-val">${data.orderDate}</span>
      </div>
      <div class="spec-item">
        <span class="spec-title">Weight</span>
        <span class="spec-val">${weightDisplay}</span>
      </div>
      <div class="spec-item">
        <span class="spec-title">Total Units</span>
        <span class="spec-val">${totalQty}</span>
      </div>
    </div>

    <!-- Item Declaration -->
    <table class="items-table">
      <thead>
        <tr>
          <th>Item Snapshot</th>
          <th style="width: 25%;">SKU</th>
          <th class="text-right" style="width: 15%;">Qty</th>
        </tr>
      </thead>
      <tbody>
        ${data.items
          .slice(0, 4)
          .map(
            (item) => `
          <tr>
            <td>
              <div style="font-weight: 700;">${item.name}</div>
              ${item.variantTitle ? `<div style="font-size: 8px; color: #6b7280;">${item.variantTitle}</div>` : ""}
            </td>
            <td><code>${item.sku || "—"}</code></td>
            <td class="text-right font-bold">×${item.quantity}</td>
          </tr>`,
          )
          .join("")}
        ${
          data.items.length > 4
            ? `<tr><td colspan="3" style="text-align: center; color: #6b7280; font-style: italic;">+ ${
                data.items.length - 4
              } more line items...</td></tr>`
            : ""
        }
      </tbody>
    </table>

    <!-- Footer -->
    <div class="footer-note">
      Computer generated shipping label. No signature required.<br>
      Routing powered by Cal Cart Logistics Network. Standard Carrier Terms apply.
    </div>
  </div>
</body>
</html>`;
  }
}
