import { WebhookPayloadValidationError } from "./webhook-errors.js";

export const SUPPORTED_PAYMENT_WEBHOOK_EVENTS = [
  "payment.captured",
  "payment.failed",
  "payment.authorized",
] as const;

export type SupportedPaymentWebhookEvent =
  (typeof SUPPORTED_PAYMENT_WEBHOOK_EVENTS)[number];

export interface RazorpayPaymentEntity {
  id: string;
  entity: "payment";
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  order_id?: string | null;
  method?: string;
  captured?: boolean;
  error_code?: string | null;
  error_description?: string | null;
  error_reason?: string | null;
  error_source?: string | null;
  error_step?: string | null;
  notes?: Record<string, unknown>;
}

export interface RazorpayWebhookPayload {
  id?: string;
  entity: "event";
  account_id?: string;
  event: string;
  contains: string[];
  payload: {
    payment?: {
      entity: RazorpayPaymentEntity;
    };
    order?: {
      entity: Record<string, unknown>;
    };
    [key: string]: unknown;
  };
  created_at: number;
}

export type WebhookProcessingStatus =
  | "PROCESSED"
  | "IGNORED"
  | "DUPLICATE"
  | "RECONCILIATION_REQUIRED"
  | "FAILED";

export interface WebhookProcessingOutcome {
  status: WebhookProcessingStatus;
  providerEventId: string;
  eventType: string;
  paymentId?: string;
  attemptId?: string;
  storeId?: string;
  duplicate?: boolean;
  message?: string;
  requiresReconciliation?: boolean;
}

/**
 * Validates untrusted incoming JSON at runtime.
 * Throws WebhookPayloadValidationError on malformed shape or missing critical fields.
 */
export function validateRazorpayWebhookPayload(raw: unknown): RazorpayWebhookPayload {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new WebhookPayloadValidationError("Webhook payload must be a non-null JSON object");
  }

  const obj = raw as Record<string, unknown>;

  if (obj.entity !== "event") {
    throw new WebhookPayloadValidationError(
      `Invalid webhook entity: expected 'event', received '${String(obj.entity)}'`,
    );
  }

  if (typeof obj.event !== "string" || !obj.event.trim()) {
    throw new WebhookPayloadValidationError("Webhook payload missing 'event' name");
  }

  if (!obj.payload || typeof obj.payload !== "object" || Array.isArray(obj.payload)) {
    throw new WebhookPayloadValidationError("Webhook payload missing 'payload' object container");
  }

  const payloadContainer = obj.payload as Record<string, unknown>;

  // If this is a supported payment event, strictly validate the payment entity
  if (SUPPORTED_PAYMENT_WEBHOOK_EVENTS.includes(obj.event as SupportedPaymentWebhookEvent)) {
    const paymentWrapper = payloadContainer.payment as Record<string, unknown> | undefined;
    if (!paymentWrapper || typeof paymentWrapper !== "object" || !paymentWrapper.entity) {
      throw new WebhookPayloadValidationError(
        `Webhook event '${obj.event}' missing 'payload.payment.entity'`,
      );
    }

    const entity = paymentWrapper.entity as Record<string, unknown>;
    if (typeof entity.id !== "string" || !entity.id.trim()) {
      throw new WebhookPayloadValidationError(
        `Webhook event '${obj.event}' payment entity missing valid 'id'`,
      );
    }

    if (
      typeof entity.amount !== "number" ||
      !Number.isInteger(entity.amount) ||
      entity.amount <= 0
    ) {
      throw new WebhookPayloadValidationError(
        `Webhook event '${obj.event}' payment entity has invalid monetary 'amount'`,
      );
    }

    if (typeof entity.currency !== "string" || entity.currency.trim().length !== 3) {
      throw new WebhookPayloadValidationError(
        `Webhook event '${obj.event}' payment entity has invalid 3-letter 'currency'`,
      );
    }

    if (typeof entity.status !== "string" || !entity.status.trim()) {
      throw new WebhookPayloadValidationError(
        `Webhook event '${obj.event}' payment entity missing 'status'`,
      );
    }
  }

  return {
    id: typeof obj.id === "string" ? obj.id.trim() : undefined,
    entity: "event",
    account_id: typeof obj.account_id === "string" ? obj.account_id : undefined,
    event: obj.event.trim(),
    contains: Array.isArray(obj.contains) ? (obj.contains as string[]) : [],
    payload: payloadContainer as RazorpayWebhookPayload["payload"],
    created_at: typeof obj.created_at === "number" ? obj.created_at : Math.floor(Date.now() / 1000),
  };
}
