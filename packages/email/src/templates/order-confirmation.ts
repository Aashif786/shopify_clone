import { escapeHtml, renderEmailBaseLayout } from "./base-layout.js";
import { formatCurrency, formatDate } from "./formatters.js";
import type { OrderConfirmationProps, RenderedEmail } from "./types.js";

export function renderOrderConfirmationEmail(
  props: OrderConfirmationProps,
): RenderedEmail {
  const storeName = escapeHtml(props.storeName);
  const orderNumber = escapeHtml(props.orderNumber);
  const name = props.recipientName ? escapeHtml(props.recipientName) : "there";
  const currency = props.currency.toUpperCase();
  const subject = `Order Confirmation: ${props.orderNumber} from ${props.storeName}`;

  // Build items HTML
  const itemsHtml = props.items
    .map((item) => {
      const itemTitle = escapeHtml(item.name);
      const variantTitle = item.variantTitle ? ` (${escapeHtml(item.variantTitle)})` : "";
      const priceStr = formatCurrency(item.unitPrice, currency);
      const lineTotalStr = formatCurrency(item.lineTotal, currency);

      return `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f4f4f5;">
            <div style="font-weight: 600; color: #18181b;">${itemTitle}${variantTitle}</div>
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
        `- ${item.name}${item.variantTitle ? ` (${item.variantTitle})` : ""}: Qty ${item.quantity} × ${formatCurrency(item.unitPrice, currency)} = ${formatCurrency(item.lineTotal, currency)}`,
    )
    .join("\n");

  // Financial summary lines
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
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #18181b; text-transform: uppercase; letter-spacing: 0.05em;">Shipping Address</h3>
          <p style="margin: 0; font-size: 13px; line-height: 20px; color: #52525b;">
            ${lines.map((l) => escapeHtml(l!)).join("<br />")}
          </p>
        </div>`;
      addressText = `\nShipping Address:\n${lines.join("\n")}\n`;
    }
  }

  const contentHtml = `
    <p>Hello ${name},</p>
    <p>Thank you for your order! We've received order <strong>#${orderNumber}</strong> and are preparing it for shipment.</p>

    <div style="margin: 20px 0; padding: 16px 20px; background-color: #fafafa; border-radius: 8px; border: 1px solid #f4f4f5;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="font-size: 13px; color: #71717a;">Order Number:</td>
          <td align="right" style="font-size: 14px; font-weight: 600; color: #18181b;">#${orderNumber}</td>
        </tr>
        <tr>
          <td style="font-size: 13px; color: #71717a; padding-top: 4px;">Order Date:</td>
          <td align="right" style="font-size: 13px; color: #52525b; padding-top: 4px;">${formatDate(props.orderDate ?? new Date())}</td>
        </tr>
      </table>
    </div>

    <h3 style="margin: 24px 0 12px 0; font-size: 15px; font-weight: 600; color: #18181b;">Order Summary</h3>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px;">
      ${itemsHtml}
    </table>

    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 16px; font-size: 14px; color: #52525b;">
      <tr>
        <td style="padding: 4px 0;">Subtotal</td>
        <td align="right" style="padding: 4px 0; color: #18181b;">${subtotalStr}</td>
      </tr>
      ${discountStr ? `
      <tr>
        <td style="padding: 4px 0; color: #16a34a;">Discounts</td>
        <td align="right" style="padding: 4px 0; color: #16a34a;">${discountStr}</td>
      </tr>` : ""}
      <tr>
        <td style="padding: 4px 0;">Shipping</td>
        <td align="right" style="padding: 4px 0; color: #18181b;">${shippingStr}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0;">Tax</td>
        <td align="right" style="padding: 4px 0; color: #18181b;">${taxStr}</td>
      </tr>
      <tr>
        <td style="padding: 12px 0 4px 0; border-top: 2px solid #e4e4e7; font-weight: 700; font-size: 16px; color: #18181b;">Total</td>
        <td align="right" style="padding: 12px 0 4px 0; border-top: 2px solid #e4e4e7; font-weight: 700; font-size: 16px; color: #18181b;">${grandTotalStr}</td>
      </tr>
    </table>

    ${addressHtml}
  `;

  const html = renderEmailBaseLayout({
    brandTitle: props.storeName,
    headline: "Order Confirmed!",
    contentHtml,
    actionText: props.orderUrl ? "View Order Status" : undefined,
    actionUrl: props.orderUrl,
    preheader: `Thank you for your order #${props.orderNumber} with ${props.storeName}.`,
    footerText: `Thank you for shopping with <strong>${storeName}</strong>.`,
    footerSubtext: "Questions about your order? Reply directly to this email for customer support.",
  });

  const text = `Order Confirmation: #${props.orderNumber}
${props.storeName}

Hello ${props.recipientName || "there"},

Thank you for your order! We've received order #${props.orderNumber} and are preparing it for shipment.

Items:
${itemsText}

Subtotal: ${subtotalStr}
${discountStr ? `Discounts: ${discountStr}\n` : ""}Shipping: ${shippingStr}
Tax: ${taxStr}
Total: ${grandTotalStr}
${addressText}
${props.orderUrl ? `View Order Status: ${props.orderUrl}\n\n` : ""}Thank you for shopping with ${props.storeName}.
`;

  return { subject, html, text };
}
