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

export interface EmailOrderItem {
  name: string;
  variantTitle?: string | null;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface EmailAddress {
  name?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export interface OrderConfirmationProps {
  to: string;
  storeName: string;
  storeSlug: string;
  orderNumber: string;
  orderId: string;
  orderDate?: Date | string;
  recipientName?: string;
  currency: string;
  items: EmailOrderItem[];
  subtotal: number;
  discountTotal?: number;
  shippingTotal?: number;
  taxTotal?: number;
  grandTotal: number;
  shippingAddress?: EmailAddress | null;
  orderUrl?: string;
}

export interface OrderFulfillmentProps {
  to: string;
  storeName: string;
  storeSlug: string;
  orderNumber: string;
  orderId: string;
  recipientName?: string;
  fulfillmentStatus: "FULFILLED" | "PARTIALLY_FULFILLED" | string;
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  orderUrl?: string;
  items?: EmailOrderItem[];
}

export interface OrderCancelledProps {
  to: string;
  storeName: string;
  storeSlug: string;
  orderNumber: string;
  orderId: string;
  recipientName?: string;
  cancelReason?: string | null;
  refundStatus?: "NOT_APPLICABLE" | "PENDING" | "SUCCEEDED" | "FAILED" | "REQUIRES_RECONCILIATION" | string;
  refundAmount?: number;
  currency?: string;
  orderUrl?: string;
}

export interface RefundConfirmationProps {
  to: string;
  storeName: string;
  storeSlug: string;
  orderNumber: string;
  orderId: string;
  refundId: string;
  recipientName?: string;
  amount: number;
  currency: string;
  isFullRefund: boolean;
  reason?: string | null;
  orderUrl?: string;
}

