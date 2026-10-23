import { escapeHtml, renderEmailBaseLayout } from "./base-layout.js";
import { formatCurrency } from "./formatters.js";
import type { RefundConfirmationProps, RenderedEmail } from "./types.js";

export function renderRefundConfirmationEmail(
  props: RefundConfirmationProps,
): RenderedEmail {
  const storeName = escapeHtml(props.storeName);
  const orderNumber = escapeHtml(props.orderNumber);
  const name = props.recipientName ? escapeHtml(props.recipientName) : "there";
  const currency = props.currency.toUpperCase();
  const refundAmountStr = formatCurrency(props.amount, currency);
  const refundTypeLabel = props.isFullRefund ? "Full refund" : "Partial refund";

  const subject = `Refund Confirmation for Order #${props.orderNumber} - ${refundAmountStr}`;

  const reasonHtml = props.reason
    ? `
      <tr>
        <td style="color: #71717a; padding-top: 6px;">Reason:</td>
        <td align="right" style="color: #52525b; padding-top: 6px;">${escapeHtml(props.reason)}</td>
      </tr>`
    : "";

  const contentHtml = `
    <p>Hello ${name},</p>
    <p>We've processed a ${refundTypeLabel.toLowerCase()} for your order <strong>#${orderNumber}</strong>.</p>

    <div style="margin: 20px 0; padding: 16px 20px; background-color: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px;">
        <tr>
          <td style="color: #15803d; padding-bottom: 4px;">Refund Amount:</td>
          <td align="right" style="font-size: 18px; font-weight: 700; color: #166534; padding-bottom: 4px;">${refundAmountStr}</td>
        </tr>
        <tr>
          <td style="color: #15803d; padding-bottom: 4px;">Type:</td>
          <td align="right" style="font-weight: 600; color: #166534; padding-bottom: 4px;">${refundTypeLabel}</td>
        </tr>
        <tr>
          <td style="color: #15803d;">Order Number:</td>
          <td align="right" style="font-weight: 600; color: #166534;">#${orderNumber}</td>
        </tr>
        ${reasonHtml}
      </table>
    </div>

    <p style="font-size: 14px; color: #52525b; line-height: 22px;">
      This amount has been credited to your original payment method. Depending on your bank or credit card issuer, it typically takes <strong>5 to 10 business days</strong> for the funds to reflect in your statement.
    </p>
  `;

  const html = renderEmailBaseLayout({
    brandTitle: props.storeName,
    headline: "Refund Processed",
    contentHtml,
    actionText: props.orderUrl ? "View Order Status" : undefined,
    actionUrl: props.orderUrl,
    preheader: `A refund of ${refundAmountStr} has been processed for your order #${props.orderNumber}.`,
    footerText: `Thank you for shopping with <strong>${storeName}</strong>.`,
    footerSubtext: "Questions regarding your refund? Reply directly to this email for customer support.",
  });

  const text = `Refund Processed
${props.storeName}

Hello ${props.recipientName || "there"},

We've processed a ${refundTypeLabel.toLowerCase()} of ${refundAmountStr} for your order #${props.orderNumber}.
${props.reason ? `Reason: ${props.reason}\n` : ""}
This amount has been credited to your original payment method. Please allow 5-10 business days for the funds to appear on your bank statement.

${props.orderUrl ? `View Order: ${props.orderUrl}\n` : ""}
Thank you for shopping with ${props.storeName}.
`;

  return { subject, html, text };
}
