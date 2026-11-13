export type OutboundWebhookStatus = "PENDING" | "SUCCESS" | "FAILED";

export interface WebhookSubscriptionRow {
  id: string;
  store_id: string;
  name: string;
  url: string;
  secret: string;
  event_types: string[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface WebhookDeliveryRow {
  id: string;
  store_id: string;
  subscription_id: string;
  event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: OutboundWebhookStatus;
  attempts: number;
  max_attempts: number;
  next_retry_at: Date;
  response_status_code: number | null;
  response_body: string | null;
  error_message: string | null;
  delivered_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateWebhookSubscriptionInput {
  id?: string;
  storeId: string;
  name: string;
  url: string;
  secret: string;
  eventTypes?: string[];
  isActive?: boolean;
}

export interface EnqueueWebhookDeliveryInput {
  id?: string;
  storeId: string;
  subscriptionId: string;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  maxAttempts?: number;
}
