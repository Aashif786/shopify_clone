export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface MerchantPasswordResetProps {
  to: string;
  recipientName?: string;
  resetUrl: string;
  expiresInMinutes?: number;
}

export interface StorefrontPasswordResetProps {
  to: string;
  recipientName?: string;
  storeName: string;
  storeSlug: string;
  resetUrl: string;
  expiresInMinutes?: number;
}

export interface StaffInvitationProps {
  to: string;
  storeName: string;
  inviterName: string;
  role: string;
  inviteUrl: string;
  expiresAt: Date | string;
}

export interface StaffInvitationAcceptedProps {
  to: string;
  storeName: string;
  role: string;
  dashboardUrl: string;
}

export interface StaffInvitationRevokedProps {
  to: string;
  storeName: string;
}

export interface PasswordChangedProps {
  to: string;
  recipientName?: string;
  changedAt?: Date | string;
}

export interface CustomerWelcomeProps {
  to: string;
  storeName: string;
  storeSlug: string;
  accountUrl: string;
  recipientName?: string;
}
