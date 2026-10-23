import { escapeHtml, renderEmailBaseLayout } from "./base-layout.js";
import { formatCurrency, formatDate } from "./formatters.js";
import type { MerchantNewOrderProps, RenderedEmail } from "./types.js";

export function renderMerchantNewOrderEmail(
  props: MerchantNewOrderProps,
): RenderedEmail {
  const storeName = escapeHtml(props.storeName);
  const orderNumber = escapeHtml(props.orderNumber);
  const currency = props.currency.toUpperCase();
  const customerName = props.customerName ? escapeHtml(props.customerName) : "Guest Customer";
  const customerEmail = props.customerEmail ? escapeHtml(props.customerEmail) : "No email provided";
  const subject = `[New Order] #${props.orderNumber} - ${props.storeName} (${formatCurrency(props.grandTotal, currency)})`;

  // Build items HTML
  const itemsHtml = props.items
    .map((item) => {
      const itemTitle = escapeHtml(item.name);
      const variantTitle = item.variantTitle ? ` (${escapeHtml(item.variantTitle)})` : "";
      const skuStr = item.sku ? `<div style="font-size: 11px; color: #a1a1aa;">SKU: ${escapeHtml(item.sku)}</div>` : "";
      const priceStr = formatCurrency(item.unitPrice, currency);
      const lineTotalStr = formatCurrency(item.lineTotal, currency);

      return `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f4f4f5;">
            <div style="font-weight: 600; color: #18181b;">${itemTitle}${variantTitle}</div>
            ${skuStr}
            <div style="font-size: 13px; color: #71717a;">Qty: ${item.quantity} × ${priceStr}</div>
          </td>
          <td align="right" style="padding: 10px 0; border-bottom: 1px solid #f4f4f5; font-weight: 600; color: #18181b; vertical-align: top;">
            ${lineTotalStr}
          </td>
        </tr>`;
    })
    .join("");

  // Build items plain text
  const itemsText = props.items
    .map(
      (item) =>
        `- ${item.name}${item.variantTitle ? ` (${item.variantTitle})` : ""}${item.sku ? ` [SKU: ${item.sku}]` : ""}: Qty ${item.quantity} × ${formatCurrency(item.unitPrice, currency)} = ${formatCurrency(item.lineTotal, currency)}`,
    )
    .join("\n");

  // Totals
  const subtotalStr = formatCurrency(props.subtotal, currency);
  const discountStr =
    props.discountTotal && props.discountTotal > 0
      ? `-${formatCurrency(props.discountTotal, currency)}`
      : null;
  const shippingStr = formatCurrency(props.shippingTotal ?? 0, currency);
  const taxStr = formatCurrency(props.taxTotal ?? 0, currency);
  const grandTotalStr = formatCurrency(props.grandTotal, currency);

  let addressHtml = "";
  let addressText = "";
  if (props.shippingAddress) {
    const addr = props.shippingAddress;
    const lines = [
      addr.name,
      addr.addressLine1,
      addr.addressLine2,
      [addr.city, addr.state, addr.postalCode].filter(Boolean).join(", "),
      addr.country,
    ].filter(Boolean);

    if (lines.length > 0) {
      addressHtml = `
        <div style="margin-top: 24px; padding: 16px; background-color: #fafafa; border-radius: 8px; border: 1px solid #f4f4f5;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #18181b; text-transform: uppercase; letter-spacing: 0.05em;">Shipping Destination</h3>
          <p style="margin: 0; font-size: 13px; line-height: 20px; color: #52525b;">
            ${lines.map((l) => escapeHtml(l!)).join("<br />")}
          </p>
        </div>`;
      addressText = `\nShipping Destination:\n${lines.join("\n")}\n`;
    }
  }

  const contentHtml = `
    <p>Great news! A new order has been placed in your store <strong>${storeName}</strong>.</p>

    <div style="margin: 20px 0; padding: 16px 20px; background-color: #fafafa; border-radius: 8px; border: 1px solid #f4f4f5;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="font-size: 13px; color: #71717a;">Order Number:</td>
          <td align="right" style="font-size: 14px; font-weight: 600; color: #18181b;">#${orderNumber}</td>
        </tr>
        <tr>
          <td style="font-size: 13px; color: #71717a; padding-top: 4px;">Date:</td>
          <td align="right" style="font-size: 13px; color: #52525b; padding-top: 4px;">${formatDate(props.orderDate ?? new Date())}</td>
        </tr>
        <tr>
          <td style="font-size: 13px; color: #71717a; padding-top: 4px;">Customer:</td>
          <td align="right" style="font-size: 13px; color: #18181b; font-weight: 500; padding-top: 4px;">${customerName} (${customerEmail})</td>
        </tr>
      </table>
    </div>

    <h3 style="margin: 24px 0 12px 0; font-size: 15px; font-weight: 600; color: #18181b;">Purchased Items</h3>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px;">
      ${itemsHtml}
    </table>

    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 16px; font-size: 14px; color: #52525b;">
      <tr>
        <td style="padding: 4px 0;">Subtotal:</td>
        <td align="right" style="padding: 4px 0;">${subtotalStr}</td>
      </tr>
      ${
        discountStr
          ? `<tr>
              <td style="padding: 4px 0; color: #16a34a;">Discount:</td>
              <td align="right" style="padding: 4px 0; color: #16a34a;">${discountStr}</td>
            </tr>`
          : ""
      }
      <tr>
        <td style="padding: 4px 0;">Shipping:</td>
        <td align="right" style="padding: 4px 0;">${shippingStr}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0;">Taxes:</td>
        <td align="right" style="padding: 4px 0;">${taxStr}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0 0 0; font-weight: 700; color: #18181b; border-top: 1px solid #e4e4e7;">Total Paid:</td>
        <td align="right" style="padding: 8px 0 0 0; font-weight: 700; font-size: 16px; color: #18181b; border-top: 1px solid #e4e4e7;">${grandTotalStr}</td>
      </tr>
    </table>

    ${addressHtml}
  `;

  const html = renderEmailBaseLayout({
    brandTitle: `${props.storeName} Merchant Portal`,
    headline: `New Order #${props.orderNumber}`,
    preheader: `New order #${props.orderNumber} received for ${grandTotalStr}`,
    contentHtml,
    actionText: props.dashboardOrderUrl ? "View Order in Merchant Dashboard" : undefined,
    actionUrl: props.dashboardOrderUrl,
  });

  const text = `New Order #${props.orderNumber} in ${props.storeName}
==================================================

A new order has been placed in ${props.storeName}.

Order Number: #${props.orderNumber}
Date: ${formatDate(props.orderDate ?? new Date())}
Customer: ${props.customerName || "Guest Customer"} (${props.customerEmail || "No email"})

Items:
${itemsText}

Financial Summary:
Subtotal: ${subtotalStr}
${discountStr ? `Discount: ${discountStr}\n` : ""}Shipping: ${shippingStr}
Taxes: ${taxStr}
Total: ${grandTotalStr}
${addressText}${props.dashboardOrderUrl ? `\nView order details: ${props.dashboardOrderUrl}\n` : ""}`;

  return { subject, html, text };
}
