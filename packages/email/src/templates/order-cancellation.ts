import { escapeHtml, renderEmailBaseLayout } from "./base-layout.js";
import { formatCurrency } from "./formatters.js";
import type { OrderCancelledProps, RenderedEmail } from "./types.js";

export function renderOrderCancelledEmail(
  props: OrderCancelledProps,
): RenderedEmail {
  const storeName = escapeHtml(props.storeName);
  const orderNumber = escapeHtml(props.orderNumber);
  const name = props.recipientName ? escapeHtml(props.recipientName) : "there";
  const reason = props.cancelReason ? escapeHtml(props.cancelReason) : "Customer or merchant request";
  const currency = (props.currency ?? "USD").toUpperCase();
  const subject = `Order Cancelled: #${props.orderNumber} from ${props.storeName}`;

  let refundNoticeHtml = "";
  let refundNoticeText = "";

  if (props.refundStatus === "SUCCEEDED" && props.refundAmount && props.refundAmount > 0) {
    const refundStr = formatCurrency(props.refundAmount, currency);
    refundNoticeHtml = `
      <div style="margin: 20px 0; padding: 16px 20px; background-color: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
        <h3 style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #166534;">Refund Issued</h3>
        <p style="margin: 0; font-size: 14px; color: #15803d; line-height: 20px;">
          A full refund of <strong>${refundStr}</strong> has been issued to your original payment method. Depending on your bank, it should reflect in 5–10 business days.
        </p>
      </div>`;
    refundNoticeText = `\nRefund Status: A refund of ${refundStr} has been issued to your original payment method. Please allow 5-10 business days for the credit to appear.\n`;
  } else if (props.refundStatus === "PENDING" && props.refundAmount && props.refundAmount > 0) {
    const refundStr = formatCurrency(props.refundAmount, currency);
    refundNoticeHtml = `
      <div style="margin: 20px 0; padding: 16px 20px; background-color: #fffbeb; border-radius: 8px; border: 1px solid #fef3c7;">
        <h3 style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #92400e;">Refund Processing</h3>
        <p style="margin: 0; font-size: 14px; color: #b45309; line-height: 20px;">
          A refund of <strong>${refundStr}</strong> is currently being processed by our payment gateway. You will receive a separate confirmation once complete.
        </p>
      </div>`;
    refundNoticeText = `\nRefund Status: A refund of ${refundStr} is currently processing.\n`;
  } else {
    refundNoticeHtml = `
      <p style="font-size: 14px; color: #71717a; margin-top: 16px;">
        No charges were captured for this order, or any pending authorization holds will be automatically released by your card issuer.
      </p>`;
    refundNoticeText = `\nNo charges were captured for this order, or authorization holds will release automatically.\n`;
  }

  const contentHtml = `
    <p>Hello ${name},</p>
    <p>Your order <strong>#${orderNumber}</strong> has been cancelled.</p>

    <div style="margin: 20px 0; padding: 16px 20px; background-color: #fafafa; border-radius: 8px; border: 1px solid #f4f4f5;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px;">
        <tr>
          <td style="color: #71717a; padding-bottom: 4px;">Order Number:</td>
          <td align="right" style="font-weight: 600; color: #18181b; padding-bottom: 4px;">#${orderNumber}</td>
        </tr>
        <tr>
          <td style="color: #71717a;">Reason for Cancellation:</td>
          <td align="right" style="font-weight: 500; color: #52525b;">${reason}</td>
        </tr>
      </table>
    </div>

    ${refundNoticeHtml}
  `;

  const html = renderEmailBaseLayout({
    brandTitle: props.storeName,
    headline: "Order Cancelled",
    contentHtml,
    actionText: props.orderUrl ? "View Storefront" : undefined,
    actionUrl: props.orderUrl,
    preheader: `Your order #${props.orderNumber} from ${props.storeName} has been cancelled.`,
    footerText: `Message from <strong>${storeName}</strong>.`,
    footerSubtext: "If you have any questions, reply directly to this email.",
  });

  const text = `Order Cancelled: #${props.orderNumber}
${props.storeName}

Hello ${props.recipientName || "there"},

Your order #${props.orderNumber} has been cancelled.
Reason: ${props.cancelReason || "Customer or merchant request"}
${refundNoticeText}
${props.orderUrl ? `Store URL: ${props.orderUrl}\n` : ""}
If you have any questions, reply to this email for customer support.
`;

  return { subject, html, text };
}
