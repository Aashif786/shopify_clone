export interface BaseLayoutOptions {
  preheader?: string;
  brandTitle?: string;
  headline: string;
  contentHtml: string;
  actionText?: string;
  actionUrl?: string;
  securityNotice?: string;
}

/**
 * Escapes HTML characters in user-provided content to prevent HTML injection in emails.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderEmailBaseLayout(options: BaseLayoutOptions): string {
  const brandTitle = options.brandTitle ? escapeHtml(options.brandTitle) : "Shopify Clone";
  const headline = escapeHtml(options.headline);
  const preheader = options.preheader ? escapeHtml(options.preheader) : "";
  const actionButton =
    options.actionText && options.actionUrl
      ? `
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0 20px 0;">
        <tr>
          <td align="center">
            <a href="${escapeHtml(options.actionUrl)}" target="_blank" style="display: inline-block; background: #000000; background-image: linear-gradient(135deg, #09090b 0%, #18181b 100%); color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 600; line-height: 48px; text-align: center; text-decoration: none; width: auto; min-width: 200px; padding: 0 32px; border-radius: 8px; border: 1px solid #27272a; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              ${escapeHtml(options.actionText)}
            </a>
          </td>
        </tr>
      </table>
      <p style="font-size: 12px; line-height: 18px; color: #71717a; text-align: center; margin: 12px 0 24px 0; word-break: break-all;">
        If the button above doesn't work, copy and paste this link into your browser:<br />
        <a href="${escapeHtml(options.actionUrl)}" target="_blank" style="color: #2563eb; text-decoration: underline;">${escapeHtml(options.actionUrl)}</a>
      </p>
    `
      : "";

  const securityNotice = options.securityNotice
    ? `
      <div style="background-color: #fafafa; border-left: 3px solid #71717a; padding: 12px 16px; margin: 24px 0 8px 0; border-radius: 4px;">
        <p style="margin: 0; font-size: 13px; line-height: 18px; color: #52525b;">
          ${options.securityNotice}
        </p>
      </div>
    `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${headline}</title>
  ${preheader ? `<span style="display:none;font-size:0;line-height:0;max-height:0;mso-hide:all;">${preheader}</span>` : ""}
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b; -webkit-font-smoothing: antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f5; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e4e4e7;">
          <!-- Top Accent Gradient Header -->
          <tr>
            <td style="background: #09090b; padding: 24px 32px; border-bottom: 2px solid #27272a;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <span style="font-size: 18px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">
                      ${brandTitle}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body Content Area -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #09090b; line-height: 28px; letter-spacing: -0.01em;">
                ${headline}
              </h1>
              <div style="font-size: 15px; line-height: 24px; color: #3f3f46;">
                ${options.contentHtml}
              </div>
              ${actionButton}
              ${securityNotice}
            </td>
          </tr>
          <!-- Footer Area -->
          <tr>
            <td style="background-color: #fafafa; padding: 20px 32px; border-top: 1px solid #e4e4e7; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; line-height: 18px; color: #71717a;">
                This is an automated transactional security message from <strong>${brandTitle}</strong>.
              </p>
              <p style="margin: 0; font-size: 11px; line-height: 16px; color: #a1a1aa;">
                Never share password reset or invitation links with anyone. Support will never ask for your password.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
