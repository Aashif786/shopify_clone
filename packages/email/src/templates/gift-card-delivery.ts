import { escapeHtml, renderEmailBaseLayout } from "./base-layout.js";
import { formatCurrency } from "./formatters.js";
import type { GiftCardDeliveryProps, RenderedEmail } from "./types.js";

export function renderGiftCardDeliveryEmail(
  props: GiftCardDeliveryProps,
): RenderedEmail {
  const storeName = escapeHtml(props.storeName);
  const name = props.recipientName ? escapeHtml(props.recipientName) : "there";
  const currency = props.currency.toUpperCase();
  const balanceStr = formatCurrency(props.initialBalance, currency);
  const subject = `Your ${props.storeName} Gift Card (${balanceStr})`;

  const storeUrl =
    props.storeUrl ||
    (props.storeSlug ? `/stores/${encodeURIComponent(props.storeSlug)}` : "/");

  const expiryNotice = props.expiresAt
    ? `<p style="margin: 8px 0 0 0; font-size: 12px; color: #71717a;">Expires on ${new Date(props.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>`
    : `<p style="margin: 8px 0 0 0; font-size: 12px; color: #71717a;">This gift card does not expire.</p>`;

  const contentHtml = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #18181b;">
      Here is your gift card, ${name}!
    </h2>
    <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.5; color: #52525b;">
      You have received a <strong>${balanceStr}</strong> digital gift card for <strong>${storeName}</strong>. You can redeem it at checkout for any items in our store.
    </p>

    <!-- Gift Card Voucher Box -->
    <div style="margin: 24px 0; padding: 24px; background: linear-gradient(135deg, #18181b 0%, #27272a 100%); border-radius: 16px; text-align: center; color: #ffffff; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);">
      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #a1a1aa; margin-bottom: 8px;">
        ${storeName} Digital Gift Card
      </div>
      <div style="font-size: 32px; font-weight: 800; color: #ffffff; margin-bottom: 16px; letter-spacing: -0.02em;">
        ${balanceStr}
      </div>
      <div style="margin: 0 auto; display: inline-block; padding: 10px 20px; background: rgba(255, 255, 255, 0.1); border: 1px dashed rgba(255, 255, 255, 0.3); border-radius: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 18px; font-weight: 700; letter-spacing: 0.15em; color: #ffffff;">
        ${escapeHtml(props.code)}
      </div>
      <div style="margin-top: 14px; font-size: 12px; color: #d4d4d8;">
        Enter this code at checkout to apply your balance.
      </div>
      ${expiryNotice}
    </div>

    <!-- CTA Button -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0 24px 0;">
      <tr>
        <td align="center">
          <a href="${storeUrl}" style="display: inline-block; padding: 12px 32px; background-color: #18181b; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px;">
            Shop at ${storeName}
          </a>
        </td>
      </tr>
    </table>

    <p style="margin: 24px 0 0 0; font-size: 12px; line-height: 1.5; color: #a1a1aa;">
      Need help? Reply to this email or contact customer support.
    </p>
  `;

  const text = `
Here is your gift card, ${props.recipientName || "there"}!

You have received a ${balanceStr} digital gift card for ${props.storeName}.

Gift Card Code: ${props.code}
Value: ${balanceStr}
${props.expiresAt ? `Expires: ${new Date(props.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "Does not expire"}

Redeem your code at checkout: ${storeUrl}
  `.trim();

  const html = renderEmailBaseLayout({
    brandTitle: props.storeName,
    headline: `Your Gift Card (${balanceStr})`,
    contentHtml,
    preheader: `Your ${props.storeName} gift card for ${balanceStr} is ready to use!`,
  });

  return { subject, html, text };
}
