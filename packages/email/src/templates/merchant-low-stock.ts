import { escapeHtml, renderEmailBaseLayout } from "./base-layout.js";
import type { MerchantLowStockProps, RenderedEmail } from "./types.js";

export function renderMerchantLowStockEmail(
  props: MerchantLowStockProps,
): RenderedEmail {
  const storeName = escapeHtml(props.storeName);
  const productTitle = escapeHtml(props.productTitle);
  const variantTitle = props.variantTitle ? ` - ${escapeHtml(props.variantTitle)}` : "";
  const sku = props.sku ? escapeHtml(props.sku) : "N/A";
  const isOut = props.isOutOfStock || props.availableQuantity <= 0;

  const statusLabel = isOut ? "OUT OF STOCK" : "LOW STOCK";
  const statusColor = isOut ? "#dc2626" : "#d97706";
  const statusBg = isOut ? "#fef2f2" : "#fffbeb";
  const statusBorder = isOut ? "#fecaca" : "#fde68a";

  const subject = `[${statusLabel}] ${props.productTitle}${props.variantTitle ? ` (${props.variantTitle})` : ""} in ${props.storeName}`;

  const contentHtml = `
    <p>Attention: Inventory for <strong>${productTitle}${variantTitle}</strong> has reached a critical level in <strong>${storeName}</strong>.</p>

    <div style="margin: 20px 0; padding: 18px 20px; background-color: ${statusBg}; border: 1px solid ${statusBorder}; border-radius: 8px;">
      <div style="display: inline-block; padding: 4px 10px; background-color: ${statusColor}; color: #ffffff; font-size: 12px; font-weight: 700; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">
        ${statusLabel}
      </div>

      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px;">
        <tr>
          <td style="color: #71717a; padding: 4px 0;">Product:</td>
          <td align="right" style="font-weight: 600; color: #18181b; padding: 4px 0;">${productTitle}${variantTitle}</td>
        </tr>
        <tr>
          <td style="color: #71717a; padding: 4px 0;">SKU:</td>
          <td align="right" style="color: #52525b; font-family: monospace; padding: 4px 0;">${sku}</td>
        </tr>
        <tr>
          <td style="color: #71717a; padding: 4px 0;">Available Stock:</td>
          <td align="right" style="font-weight: 700; color: ${statusColor}; font-size: 16px; padding: 4px 0;">${props.availableQuantity} units</td>
        </tr>
        <tr>
          <td style="color: #71717a; padding: 4px 0;">Configured Threshold:</td>
          <td align="right" style="color: #52525b; padding: 4px 0;">${props.lowStockThreshold} units</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 14px; color: #52525b;">
      ${
        isOut
          ? "This item is currently sold out and customers may no longer be able to purchase it until restocked."
          : "Inventory has crossed below your alert threshold. Consider restocking soon to avoid stockouts."
      }
    </p>
  `;

  const html = renderEmailBaseLayout({
    brandTitle: `${props.storeName} Merchant Portal`,
    headline: `${statusLabel}: Inventory Alert`,
    preheader: `${statusLabel}: ${props.productTitle}${props.variantTitle ? ` (${props.variantTitle})` : ""} has ${props.availableQuantity} units remaining`,
    contentHtml,
    actionText: props.dashboardInventoryUrl ? "Update Inventory in Dashboard" : undefined,
    actionUrl: props.dashboardInventoryUrl,
    securityNotice: "This automated inventory notification was triggered based on your store's stock thresholds.",
  });

  const text = `${statusLabel}: Inventory Alert for ${props.storeName}
==================================================

Product: ${props.productTitle}${props.variantTitle ? ` (${props.variantTitle})` : ""}
SKU: ${props.sku || "N/A"}
Current Stock: ${props.availableQuantity} units
Configured Alert Threshold: ${props.lowStockThreshold} units
Status: ${statusLabel}

${
  isOut
    ? "This item is currently out of stock. Please restock to ensure continued availability."
    : "Inventory is running low. Please review and replenish inventory if required."
}
${props.dashboardInventoryUrl ? `\nManage inventory: ${props.dashboardInventoryUrl}\n` : ""}`;

  return { subject, html, text };
}
