import { escapeHtml, renderEmailBaseLayout } from "./base-layout.js";
import type { OrderFulfillmentProps, RenderedEmail } from "./types.js";

export function renderOrderFulfillmentEmail(
  props: OrderFulfillmentProps,
): RenderedEmail {
  const storeName = escapeHtml(props.storeName);
  const orderNumber = escapeHtml(props.orderNumber);
  const name = props.recipientName ? escapeHtml(props.recipientName) : "there";
  const isPartial = props.fulfillmentStatus === "PARTIALLY_FULFILLED";

  const statusLabel = isPartial ? "partially shipped" : "on its way";
  const headline = isPartial ? "Part of your order has shipped" : "Your order is on the way!";
  const subject = isPartial
    ? `Shipping update: Order #${props.orderNumber} partially shipped`
    : `Your order #${props.orderNumber} has shipped!`;

  let trackingHtml = "";
  let trackingText = "";

  if (props.trackingNumber || props.carrier) {
    const carrierName = props.carrier ? escapeHtml(props.carrier) : "Carrier";
    const trackingNum = props.trackingNumber ? escapeHtml(props.trackingNumber) : "N/A";
    const trackingLink = props.trackingUrl
      ? `<a href="${escapeHtml(props.trackingUrl)}" target="_blank" style="color: #2563eb; text-decoration: underline;">${trackingNum}</a>`
      : trackingNum;

    trackingHtml = `
      <div style="margin: 20px 0; padding: 16px 20px; background-color: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
        <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: #166534; text-transform: uppercase; letter-spacing: 0.05em;">Tracking Information</h3>
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px;">
          ${props.carrier ? `
          <tr>
            <td style="color: #15803d; padding-bottom: 4px;">Carrier:</td>
            <td align="right" style="font-weight: 600; color: #166534; padding-bottom: 4px;">${carrierName}</td>
          </tr>` : ""}
          ${props.trackingNumber ? `
          <tr>
            <td style="color: #15803d;">Tracking Number:</td>
            <td align="right" style="font-weight: 600; color: #166534;">${trackingLink}</td>
          </tr>` : ""}
        </table>
      </div>`;

    trackingText = `\nTracking Information:\nCarrier: ${props.carrier || "Standard"}\nTracking Number: ${props.trackingNumber || "N/A"}${props.trackingUrl ? `\nTrack Package: ${props.trackingUrl}` : ""}\n`;
  }

  const contentHtml = `
    <p>Hello ${name},</p>
    <p>Good news! Your order <strong>#${orderNumber}</strong> is ${statusLabel}.</p>
    ${trackingHtml}
    <p style="font-size: 14px; color: #52525b; line-height: 22px;">
      ${isPartial
        ? "The remaining items in your order will be shipped separately as soon as they become available."
        : "You can track the shipment progress using the information above."}
    </p>
  `;

  const html = renderEmailBaseLayout({
    brandTitle: props.storeName,
    headline,
    contentHtml,
    actionText: props.trackingUrl ? "Track Package" : props.orderUrl ? "View Order Status" : undefined,
    actionUrl: props.trackingUrl || props.orderUrl,
    preheader: `Your order #${props.orderNumber} from ${props.storeName} is ${statusLabel}.`,
    footerText: `Thank you for shopping with <strong>${storeName}</strong>.`,
    footerSubtext: "Questions about your shipment? Reply to this email for customer support.",
  });

  const text = `${headline}
${props.storeName}

Hello ${props.recipientName || "there"},

Good news! Your order #${props.orderNumber} is ${statusLabel}.
${trackingText}
${isPartial ? "The remaining items will be shipped separately as soon as they become available.\n" : ""}
${props.trackingUrl ? `Track Package: ${props.trackingUrl}\n` : props.orderUrl ? `View Order Status: ${props.orderUrl}\n` : ""}
Thank you for shopping with ${props.storeName}.
`;

  return { subject, html, text };
}
