import { escapeHtml, renderEmailBaseLayout } from "./base-layout.js";
import type { MerchantWelcomeProps, RenderedEmail } from "./types.js";

export function renderMerchantWelcomeEmail(
  props: MerchantWelcomeProps,
): RenderedEmail {
  const name = props.recipientName ? escapeHtml(props.recipientName) : "Merchant";
  const subject = "Welcome to Cal Cart! Start building your commerce store";

  const contentHtml = `
    <p>Hello ${name},</p>
    <p>Welcome to <strong>Cal Cart</strong>! Your merchant account has been successfully created.</p>
    <p>You can now create and manage stores, add products and variants, configure inventory tracking, and start accepting online orders from customers worldwide.</p>

    <div style="margin: 24px 0; padding: 20px; background-color: #fafafa; border-radius: 8px; border: 1px solid #f4f4f5;">
      <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #18181b; text-transform: uppercase; letter-spacing: 0.05em;">Next Steps</h3>
      <ol style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 24px; color: #52525b;">
        <li>Create or switch into your online store.</li>
        <li>Add products, variants, and stock quantities.</li>
        <li>Configure payment settings and test checkout.</li>
        <li>Invite team members to manage fulfillment and operations.</li>
      </ol>
    </div>
  `;

  const html = renderEmailBaseLayout({
    brandTitle: "Cal Cart Merchant Portal",
    headline: "Welcome to Cal Cart",
    preheader: "Your merchant account is ready. Start building your store today.",
    contentHtml,
    actionText: "Go to Merchant Dashboard",
    actionUrl: props.dashboardUrl,
    securityNotice: "Never share your merchant account password with anyone. We will never ask for your password via email.",
  });

  const text = `Welcome to Cal Cart!
==================================================

Hello ${props.recipientName || "Merchant"},

Welcome to Cal Cart! Your merchant account has been successfully created.

Next Steps:
1. Create or switch into your online store.
2. Add products, variants, and stock quantities.
3. Configure payment settings and test checkout.
4. Invite team members to manage fulfillment and operations.

Access your merchant dashboard:
${props.dashboardUrl}
`;

  return { subject, html, text };
}
