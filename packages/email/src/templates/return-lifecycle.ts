import { escapeHtml, renderEmailBaseLayout } from "./base-layout.js";
import { formatCurrency } from "./formatters.js";
import type {
  ReturnApprovedProps,
  ReturnRejectedProps,
  ReturnRequestedProps,
  RenderedEmail,
} from "./types.js";

function renderReturnSummaryHtml(params: {
  returnNumber: string;
  orderNumber: string;
  amount: number;
  currency: string;
  reason: string | null | undefined;
  accentBg: string;
  accentBorder: string;
  accentHeading: string;
  accentBody: string;
}): string {
  const rows: string[] = [
    `<tr>
       <td style="color: ${params.accentBody}; padding-bottom: 4px;">Return:</td>
       <td align="right" style="font-weight: 600; color: ${params.accentHeading}; padding-bottom: 4px;">${escapeHtml(params.returnNumber)}</td>
     </tr>`,
    `<tr>
       <td style="color: ${params.accentBody}; padding-bottom: 4px;">Order:</td>
       <td align="right" style="font-weight: 600; color: ${params.accentHeading}; padding-bottom: 4px;">#${escapeHtml(params.orderNumber)}</td>
     </tr>`,
    `<tr>
       <td style="color: ${params.accentBody};">Refund value:</td>
       <td align="right" style="font-weight: 600; color: ${params.accentHeading};">${escapeHtml(formatCurrency(params.amount, params.currency))}</td>
     </tr>`,
  ];

  if (params.reason && params.reason.trim().length > 0) {
    rows.push(
      `<tr>
         <td style="color: ${params.accentBody}; padding-top: 4px;">Reason:</td>
         <td align="right" style="font-weight: 600; color: ${params.accentHeading}; padding-top: 4px;">${escapeHtml(params.reason)}</td>
       </tr>`,
    );
  }

  return `
    <div style="margin: 20px 0; padding: 16px 20px; background-color: ${params.accentBg}; border-radius: 8px; border: 1px solid ${params.accentBorder};">
      <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: ${params.accentHeading}; text-transform: uppercase; letter-spacing: 0.05em;">Return Details</h3>
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px;">
        ${rows.join("\n")}
      </table>
    </div>`;
}

function renderReturnSummaryText(params: {
  returnNumber: string;
  orderNumber: string;
  amount: number;
  currency: string;
  reason: string | null | undefined;
}): string {
  const lines = [
    `Return: ${params.returnNumber}`,
    `Order: #${params.orderNumber}`,
    `Refund value: ${formatCurrency(params.amount, params.currency)}`,
  ];
  if (params.reason && params.reason.trim().length > 0) {
    lines.push(`Reason: ${params.reason}`);
  }
  return `\nReturn Details:\n${lines.join("\n")}\n`;
}

/**
 * Merchant-facing alert: a customer has opened a return request.
 */
export function renderReturnRequestedEmail(
  props: ReturnRequestedProps,
): RenderedEmail {
  const storeName = escapeHtml(props.storeName);
  const customerLabel = props.customerName
    ? escapeHtml(props.customerName)
    : "A customer";
  const subject = `New return request ${props.returnNumber} for order #${props.orderNumber}`;

  const summaryHtml = renderReturnSummaryHtml({
    returnNumber: props.returnNumber,
    orderNumber: props.orderNumber,
    amount: props.requestedAmount,
    currency: props.currency,
    reason: props.reason,
    accentBg: "#fffbeb",
    accentBorder: "#fde68a",
    accentHeading: "#92400e",
    accentBody: "#b45309",
  });

  const contentHtml = `
    <p>Hello,</p>
    <p>${customerLabel} has requested a return on order <strong>#${escapeHtml(props.orderNumber)}</strong> at <strong>${storeName}</strong>.</p>
    ${summaryHtml}
    <p style="font-size: 14px; color: #52525b; line-height: 22px;">
      Review the request in your dashboard to approve or decline it. Once you receive the
      returned goods you can mark the return as received and issue the refund.
    </p>
  `;

  const html = renderEmailBaseLayout({
    brandTitle: props.storeName,
    headline: "New return request",
    contentHtml,
    actionText: props.dashboardReturnUrl ? "Review Return" : undefined,
    actionUrl: props.dashboardReturnUrl,
    preheader: `${props.returnNumber} on order #${props.orderNumber} needs review.`,
    footerText: `This is an operational alert for <strong>${storeName}</strong>.`,
  });

  const text = `New return request
${props.storeName}

${props.customerName || "A customer"} has requested a return on order #${props.orderNumber}.
${renderReturnSummaryText({
  returnNumber: props.returnNumber,
  orderNumber: props.orderNumber,
  amount: props.requestedAmount,
  currency: props.currency,
  reason: props.reason,
})}
${props.dashboardReturnUrl ? `Review the return: ${props.dashboardReturnUrl}\n` : ""}
Review the request to approve or decline it.
`;

  return { subject, html, text };
}

/**
 * Customer-facing: the merchant approved the return.
 */
export function renderReturnApprovedEmail(
  props: ReturnApprovedProps,
): RenderedEmail {
  const storeName = escapeHtml(props.storeName);
  const name = props.recipientName ? escapeHtml(props.recipientName) : "there";
  const subject = `Your return ${props.returnNumber} has been approved`;

  const summaryHtml = renderReturnSummaryHtml({
    returnNumber: props.returnNumber,
    orderNumber: props.orderNumber,
    amount: props.requestedAmount,
    currency: props.currency,
    reason: props.reason,
    accentBg: "#f0fdf4",
    accentBorder: "#bbf7d0",
    accentHeading: "#166534",
    accentBody: "#15803d",
  });

  const noteHtml = props.merchantNote
    ? `<p style="font-size: 14px; color: #52525b; line-height: 22px;"><strong>A note from ${storeName}:</strong><br />${escapeHtml(props.merchantNote)}</p>`
    : "";

  const contentHtml = `
    <p>Hello ${name},</p>
    <p>Good news — your return request for order <strong>#${escapeHtml(props.orderNumber)}</strong> has been approved.</p>
    ${summaryHtml}
    ${noteHtml}
    <p style="font-size: 14px; color: #52525b; line-height: 22px;">
      Please send the items back to ${storeName}. Your refund will be issued once the
      returned items have been received and checked.
    </p>
  `;

  const html = renderEmailBaseLayout({
    brandTitle: props.storeName,
    headline: "Your return was approved",
    contentHtml,
    actionText: props.orderUrl ? "View Order" : undefined,
    actionUrl: props.orderUrl,
    preheader: `Return ${props.returnNumber} approved. Send your items back to ${props.storeName}.`,
    footerText: `Thank you for shopping with <strong>${storeName}</strong>.`,
    footerSubtext: "Questions about your return? Reply to this email for support.",
  });

  const text = `Your return was approved
${props.storeName}

Hello ${props.recipientName || "there"},

Your return request for order #${props.orderNumber} has been approved.
${renderReturnSummaryText({
  returnNumber: props.returnNumber,
  orderNumber: props.orderNumber,
  amount: props.requestedAmount,
  currency: props.currency,
  reason: props.reason,
})}${props.merchantNote ? `\nA note from ${props.storeName}: ${props.merchantNote}\n` : ""}
Please send the items back. Your refund will be issued once they have been received and checked.
${props.orderUrl ? `\nView your order: ${props.orderUrl}\n` : ""}
Thank you for shopping with ${props.storeName}.
`;

  return { subject, html, text };
}

/**
 * Customer-facing: the merchant declined the return.
 */
export function renderReturnRejectedEmail(
  props: ReturnRejectedProps,
): RenderedEmail {
  const storeName = escapeHtml(props.storeName);
  const name = props.recipientName ? escapeHtml(props.recipientName) : "there";
  const subject = `Update on your return ${props.returnNumber}`;

  const summaryHtml = renderReturnSummaryHtml({
    returnNumber: props.returnNumber,
    orderNumber: props.orderNumber,
    amount: props.requestedAmount,
    currency: props.currency,
    reason: props.reason,
    accentBg: "#fef2f2",
    accentBorder: "#fecaca",
    accentHeading: "#991b1b",
    accentBody: "#b91c1c",
  });

  const noteHtml = props.merchantNote
    ? `<p style="font-size: 14px; color: #52525b; line-height: 22px;"><strong>Reason given by ${storeName}:</strong><br />${escapeHtml(props.merchantNote)}</p>`
    : "";

  const contentHtml = `
    <p>Hello ${name},</p>
    <p>We've reviewed your return request for order <strong>#${escapeHtml(props.orderNumber)}</strong>, and unfortunately it could not be approved.</p>
    ${summaryHtml}
    ${noteHtml}
    <p style="font-size: 14px; color: #52525b; line-height: 22px;">
      If you believe this decision was made in error, reply to this email and the
      ${storeName} team will take another look.
    </p>
  `;

  const html = renderEmailBaseLayout({
    brandTitle: props.storeName,
    headline: "Update on your return",
    contentHtml,
    actionText: props.orderUrl ? "View Order" : undefined,
    actionUrl: props.orderUrl,
    preheader: `Your return ${props.returnNumber} could not be approved.`,
    footerText: `Thank you for shopping with <strong>${storeName}</strong>.`,
    footerSubtext: "Questions about this decision? Reply to this email for support.",
  });

  const text = `Update on your return
${props.storeName}

Hello ${props.recipientName || "there"},

We've reviewed your return request for order #${props.orderNumber}, and unfortunately it could not be approved.
${renderReturnSummaryText({
  returnNumber: props.returnNumber,
  orderNumber: props.orderNumber,
  amount: props.requestedAmount,
  currency: props.currency,
  reason: props.reason,
})}${props.merchantNote ? `\nReason given by ${props.storeName}: ${props.merchantNote}\n` : ""}
If you believe this was made in error, reply to this email and we'll take another look.
${props.orderUrl ? `\nView your order: ${props.orderUrl}\n` : ""}
Thank you for shopping with ${props.storeName}.
`;

  return { subject, html, text };
}
