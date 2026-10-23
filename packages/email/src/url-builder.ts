import { validateAppBaseUrl } from "./config.js";

/**
 * Constructs a secure password reset link for the merchant portal.
 * Always builds from validated appUrl to prevent Host-Header Injection.
 */
export function buildMerchantPasswordResetUrl(appUrl: string, token: string): string {
  const base = validateAppBaseUrl(appUrl);
  return `${base}/merchant/reset-password?token=${encodeURIComponent(token)}`;
}

/**
 * Constructs a secure password reset link for a storefront customer.
 * Scoped to the specific store slug.
 */
export function buildStorefrontPasswordResetUrl(
  appUrl: string,
  storeSlug: string,
  token: string
): string {
  const base = validateAppBaseUrl(appUrl);
  return `${base}/stores/${encodeURIComponent(storeSlug)}/reset-password?token=${encodeURIComponent(token)}`;
}

/**
 * Constructs a secure staff invitation link.
 * Scoped to the merchant portal invitation accept flow.
 */
export function buildStaffInvitationUrl(appUrl: string, token: string): string {
  const base = validateAppBaseUrl(appUrl);
  return `${base}/merchant/invitations/accept?token=${encodeURIComponent(token)}`;
}

/**
 * Constructs a customer account portal link.
 */
export function buildStorefrontAccountUrl(appUrl: string, storeSlug: string): string {
  const base = validateAppBaseUrl(appUrl);
  return `${base}/stores/${encodeURIComponent(storeSlug)}/account`;
}

/**
 * Constructs the merchant portal dashboard link.
 */
export function buildMerchantDashboardUrl(appUrl: string): string {
  const base = validateAppBaseUrl(appUrl);
  return `${base}/merchant`;
}
