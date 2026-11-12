import { escapeHtml, renderEmailBaseLayout } from "./base-layout.js";
import { formatCurrency } from "./formatters.js";
import type { AbandonedCartRecoveryProps, RenderedEmail } from "./types.js";

export function renderAbandonedCartRecoveryEmail(
  props: AbandonedCartRecoveryProps,
): RenderedEmail {
  const storeName = escapeHtml(props.storeName);
  const name = props.recipientName ? escapeHtml(props.recipientName) : "there";
  const currency = props.currency.toUpperCase();
  const subject = `Did you forget something? Your cart at ${props.storeName} is waiting for you`;

  const recoveryUrl =
    props.recoveryUrl ||
    (props.storeSlug ? `/stores/${encodeURIComponent(props.storeSlug)}/cart` : "/cart");

  // Build items HTML if items provided
  let itemsHtml = "";
  let itemsText = "";

  if (props.items && props.items.length > 0) {
    itemsHtml = `
      <h3 style="margin: 24px 0 12px 0; font-size: 15px; font-weight: 600; color: #18181b;">Items in your cart</h3>
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px;">
        ${props.items
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
          .join("")}
      </table>
    `;

    itemsText =
      "\nItems in your cart:\n" +
      props.items
        .map(
          (item) =>
            `- ${item.name}${item.variantTitle ? ` (${item.variantTitle})` : ""}: Qty ${item.quantity} × ${formatCurrency(item.unitPrice, currency)}`,
        )
        .join("\n") +
      "\n";
  }

  const grandTotalStr = formatCurrency(props.grandTotal, currency);

  const contentHtml = `
    <p>Hello ${name},</p>
    <p>We noticed you left some great items in your shopping cart at <strong>${storeName}</strong>.</p>
    <p>Your items are saved, but stock can be limited. Return now to complete your purchase before items sell out!</p>

    ${itemsHtml}

    <div style="margin: 20px 0; padding: 14px 18px; background-color: #fafafa; border-radius: 8px; border: 1px solid #f4f4f5; display: flex; justify-content: space-between; align-items: center;">
      <span style="font-size: 14px; font-weight: 600; color: #71717a;">Cart Total:</span>
      <span style="font-size: 16px; font-weight: 700; color: #18181b; float: right;">${grandTotalStr}</span>
    </div>

    <div style="margin: 30px 0 20px 0; text-align: center;">
      <a href="${escapeHtml(recoveryUrl)}" style="display: inline-block; background-color: #18181b; color: #ffffff; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 14px; text-decoration: none;">
        Complete Your Purchase &rarr;
      </a>
    </div>

    <p style="font-size: 13px; color: #71717a; text-align: center; margin-top: 20px;">
      If you need any help with your order, please reply to this email.
    </p>
  `;

  const plainText = `
Hello ${name},

We noticed you left some great items in your shopping cart at ${props.storeName}.
Your items are saved, but stock can be limited. Return now to complete your purchase!
${itemsText}
Cart Total: ${grandTotalStr}

Complete your purchase here:
${recoveryUrl}

If you need any help with your order, please reply to this email.
  `.trim();

  return {
    subject,
    html: renderEmailBaseLayout({
      brandTitle: props.storeName,
      headline: "Did you forget something?",
      contentHtml,
      actionText: "Complete Your Purchase",
      actionUrl: recoveryUrl,
    }),
    text: plainText,
  };
}
