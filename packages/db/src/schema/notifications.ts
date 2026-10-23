export type NotificationType =
  | "ORDER_CONFIRMATION"
  | "ORDER_FULFILLMENT"
  | "ORDER_CANCELLED"
  | "REFUND_CONFIRMATION"
  | "MERCHANT_NEW_ORDER"
  | "LOW_STOCK_ALERT";

export type NotificationOutboxStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED";

export type NotificationErrorCategory =
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "INVALID_ADDRESS"
  | "PROVIDER_ERROR"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export interface NotificationOutboxRow {
  id: string;
  store_id: string;
  notification_type: NotificationType;
  recipient_email: string | null;
  reference_type: string;
  reference_id: string;
  idempotency_key: string;
  payload: Record<string, unknown>;
  status: NotificationOutboxStatus;
  attempts: number;
  max_attempts: number;
  last_attempt_at: Date | null;
  next_retry_at: Date | null;
  processed_at: Date | null;
  error_message: string | null;
  provider_message_id: string | null;
  error_category: NotificationErrorCategory | string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateNotificationOutboxRowInput {
  id?: string;
  storeId: string;
  notificationType: NotificationType;
  recipientEmail?: string | null;
  referenceType: string;
  referenceId: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  maxAttempts?: number;
  nextRetryAt?: Date;
  providerMessageId?: string | null;
  errorCategory?: NotificationErrorCategory | string | null;
}
