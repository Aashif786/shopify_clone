import { escapeHtml, renderEmailBaseLayout } from "./base-layout.js";
import type {
  CustomerWelcomeProps,
  MerchantPasswordResetProps,
  PasswordChangedProps,
  RenderedEmail,
  StaffInvitationAcceptedProps,
  StaffInvitationProps,
  StaffInvitationRevokedProps,
  StorefrontPasswordResetProps,
} from "./types.js";

export * from "./types.js";
export * from "./base-layout.js";

/**
 * 1. Merchant Password Reset Email
 */
export function renderMerchantPasswordResetEmail(
  props: MerchantPasswordResetProps
): RenderedEmail {
  const name = props.recipientName ? escapeHtml(props.recipientName) : "there";
  const expiresInMinutes = props.expiresInMinutes ?? 60;
  const subject = "Reset your Shopify Clone password";

  const contentHtml = `
    <p>Hello ${name},</p>
    <p>We received a request to reset the password for your Shopify Clone merchant account.</p>
    <p>Click the button below to choose a new password. For security, this link expires in <strong>${expiresInMinutes} minutes</strong>.</p>
  `;

  const securityNotice =
    "If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged and your account is secure.";

  const html = renderEmailBaseLayout({
    brandTitle: "Shopify Clone Merchant Portal",
    headline: "Reset your password",
    contentHtml,
    actionText: "Reset Password",
    actionUrl: props.resetUrl,
    securityNotice,
    preheader: "Reset your Shopify Clone password. Link expires in 60 minutes.",
  });

  const text = `Reset your Shopify Clone password

Hello ${props.recipientName || "there"},

We received a request to reset the password for your Shopify Clone merchant account.

To reset your password, open the following link in your browser:
${props.resetUrl}

This link is valid for ${expiresInMinutes} minutes.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

Shopify Clone Merchant Portal
`;

  return { subject, html, text };
}

/**
 * 2. Storefront Customer Password Reset Email
 */
export function renderStorefrontPasswordResetEmail(
  props: StorefrontPasswordResetProps
): RenderedEmail {
  const name = props.recipientName ? escapeHtml(props.recipientName) : "there";
  const storeName = escapeHtml(props.storeName);
  const expiresInMinutes = props.expiresInMinutes ?? 60;
  const subject = `Reset your password for ${props.storeName}`;

  const contentHtml = `
    <p>Hello ${name},</p>
    <p>We received a request to reset the password for your customer account at <strong>${storeName}</strong>.</p>
    <p>Click the button below to set a new password. This link will expire in <strong>${expiresInMinutes} minutes</strong>.</p>
  `;

  const securityNotice =
    "If you didn't request this change, you can safely ignore this message. Your customer account remains secure.";

  const html = renderEmailBaseLayout({
    brandTitle: props.storeName,
    headline: "Reset your store password",
    contentHtml,
    actionText: "Reset My Password",
    actionUrl: props.resetUrl,
    securityNotice,
    preheader: `Password reset request for ${props.storeName}.`,
  });

  const text = `Reset your password for ${props.storeName}

Hello ${props.recipientName || "there"},

We received a request to reset the password for your customer account at ${props.storeName}.

To reset your password, visit:
${props.resetUrl}

This link will expire in ${expiresInMinutes} minutes.

If you didn't request this change, you can safely ignore this email.

${props.storeName}
`;

  return { subject, html, text };
}

/**
 * 3. Staff Invitation Email
 */
export function renderStaffInvitationEmail(props: StaffInvitationProps): RenderedEmail {
  const storeName = escapeHtml(props.storeName);
  const inviterName = escapeHtml(props.inviterName);
  const roleDisplay = escapeHtml(props.role.toUpperCase());
  const expiryFormatted =
    props.expiresAt instanceof Date
      ? props.expiresAt.toUTCString()
      : new Date(props.expiresAt).toUTCString();
  const subject = `You've been invited to join ${props.storeName} on Shopify Clone`;

  const contentHtml = `
    <p>Hello,</p>
    <p><strong>${inviterName}</strong> has invited you to join the team at <strong>${storeName}</strong> as a <strong>${roleDisplay}</strong> on Shopify Clone.</p>
    <p>To accept this invitation and access the store management dashboard, click the button below:</p>
  `;

  const securityNotice = `This invitation is intended specifically for ${escapeHtml(
    props.to
  )}. It will expire on <strong>${expiryFormatted}</strong>. If you do not recognize the inviter or store, you can safely discard this email.`;

  const html = renderEmailBaseLayout({
    brandTitle: "Shopify Clone Merchant Portal",
    headline: `Join ${props.storeName}`,
    contentHtml,
    actionText: "Accept Invitation",
    actionUrl: props.inviteUrl,
    securityNotice,
    preheader: `${props.inviterName} invited you to join ${props.storeName}.`,
  });

  const text = `Invitation to join ${props.storeName}

Hello,

${props.inviterName} has invited you to join the team at ${props.storeName} as a ${props.role.toUpperCase()} on Shopify Clone.

To accept this invitation and access the store, visit:
${props.inviteUrl}

This invitation will expire on: ${expiryFormatted}.

If you already have a Shopify Clone account, you can log in to accept. If you're new, you can create a password during acceptance.

Shopify Clone Merchant Portal
`;

  return { subject, html, text };
}

/**
 * 4. Staff Invitation Accepted Confirmation Email
 */
export function renderStaffInvitationAcceptedEmail(
  props: StaffInvitationAcceptedProps
): RenderedEmail {
  const storeName = escapeHtml(props.storeName);
  const role = escapeHtml(props.role.toUpperCase());
  const subject = `Invitation accepted: Welcome to ${props.storeName}`;

  const contentHtml = `
    <p>Hello,</p>
    <p>Your invitation to join <strong>${storeName}</strong> as a <strong>${role}</strong> has been successfully accepted.</p>
    <p>You can now manage products, orders, inventory, and store settings based on your permissions.</p>
  `;

  const html = renderEmailBaseLayout({
    brandTitle: "Shopify Clone Merchant Portal",
    headline: "Welcome to the team!",
    contentHtml,
    actionText: "Open Merchant Dashboard",
    actionUrl: props.dashboardUrl,
    preheader: `Your invitation to join ${props.storeName} was accepted.`,
  });

  const text = `Welcome to ${props.storeName}!

Your invitation to join ${props.storeName} as a ${props.role.toUpperCase()} has been successfully accepted.

Access your merchant dashboard here:
${props.dashboardUrl}

Shopify Clone Merchant Portal
`;

  return { subject, html, text };
}

/**
 * 5. Staff Invitation Revoked Notification
 */
export function renderStaffInvitationRevokedEmail(
  props: StaffInvitationRevokedProps
): RenderedEmail {
  const storeName = escapeHtml(props.storeName);
  const subject = `Notice: Invitation to join ${props.storeName} has been cancelled`;

  const contentHtml = `
    <p>Hello,</p>
    <p>This message is to notify you that the pending invitation to join <strong>${storeName}</strong> on Shopify Clone has been cancelled by the store administrator.</p>
    <p>If you believe this was done in error, please contact the store owner or your team administrator.</p>
  `;

  const html = renderEmailBaseLayout({
    brandTitle: "Shopify Clone Merchant Portal",
    headline: "Invitation Cancelled",
    contentHtml,
    preheader: `The invitation to join ${props.storeName} was cancelled.`,
  });

  const text = `Notice: Invitation to join ${props.storeName} cancelled

The pending invitation to join ${props.storeName} on Shopify Clone has been cancelled by the store administrator.

If you have questions, please contact the store administrator.

Shopify Clone Merchant Portal
`;

  return { subject, html, text };
}

/**
 * 6. Password Changed Security Notification
 */
export function renderPasswordChangedEmail(props: PasswordChangedProps): RenderedEmail {
  const name = props.recipientName ? escapeHtml(props.recipientName) : "there";
  const changedAtFormatted = props.changedAt
    ? props.changedAt instanceof Date
      ? props.changedAt.toUTCString()
      : new Date(props.changedAt).toUTCString()
    : new Date().toUTCString();
  const subject = "Security Alert: Your password has been changed";

  const contentHtml = `
    <p>Hello ${name},</p>
    <p>The password for your Shopify Clone account was successfully changed on <strong>${changedAtFormatted}</strong>.</p>
    <p>For your security, all active sessions on other devices have been automatically signed out.</p>
  `;

  const securityNotice =
    "IMPORTANT: If you did not make this change, please reset your password immediately and contact support to secure your account.";

  const html = renderEmailBaseLayout({
    brandTitle: "Shopify Clone Security",
    headline: "Password Changed",
    contentHtml,
    securityNotice,
    preheader: "Your account password was recently changed.",
  });

  const text = `Security Alert: Your password has been changed

Hello ${props.recipientName || "there"},

The password for your Shopify Clone account was successfully changed on ${changedAtFormatted}.

All prior sessions have been invalidated across devices.

If you did not perform this change, please reset your password immediately.

Shopify Clone Security
`;

  return { subject, html, text };
}

/**
 * 7. Storefront Customer Welcome Email
 */
export function renderCustomerWelcomeEmail(props: CustomerWelcomeProps): RenderedEmail {
  const name = props.recipientName ? escapeHtml(props.recipientName) : "there";
  const storeName = escapeHtml(props.storeName);
  const subject = `Welcome to ${props.storeName}!`;

  const contentHtml = `
    <p>Hello ${name},</p>
    <p>Thank you for creating an account with <strong>${storeName}</strong>!</p>
    <p>With your account, you can track current orders, view your purchase history, and manage your saved shipping addresses.</p>
  `;

  const html = renderEmailBaseLayout({
    brandTitle: props.storeName,
    headline: `Welcome to ${props.storeName}`,
    contentHtml,
    actionText: "Visit My Account",
    actionUrl: props.accountUrl,
    preheader: `Thank you for creating an account at ${props.storeName}!`,
  });

  const text = `Welcome to ${props.storeName}!

Hello ${props.recipientName || "there"},

Thank you for creating an account with ${props.storeName}.

You can view your order history and manage your account here:
${props.accountUrl}

${props.storeName}
`;

  return { subject, html, text };
}
