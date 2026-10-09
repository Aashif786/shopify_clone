export type PaymentStatus =
  | "CREATED"
  | "PENDING"
  | "PROCESSING"
  | "AUTHORIZED"
  | "CAPTURED"
  | "FAILED"
  | "CANCELLED"
  | "REQUIRES_RECONCILIATION"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED";

export type PaymentAttemptStatus =
  | "INITIATED"
  | "PENDING"
  | "AUTHORIZED"
  | "CAPTURED"
  | "FAILED"
  | "CANCELLED"
  | "REQUIRES_RECONCILIATION";

export type PaymentWebhookEventStatus =
  | "RECEIVED"
  | "PROCESSING"
  | "PROCESSED"
  | "IGNORED"
  | "FAILED";

export type RefundStatus =
  | "PENDING"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "REQUIRES_RECONCILIATION";

export type IdempotencyRecordStatus =
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED";

export interface PaymentRow {
  id: string;
  store_id: string;
  checkout_id: string;
  order_id: string | null;
  amount: string | number | bigint;
  currency: string;
  status: PaymentStatus;
  provider: string;
  captured_amount: string | number | bigint;
  refunded_amount: string | number | bigint;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentAttemptRow {
  id: string;
  payment_id: string;
  store_id: string;
  attempt_number: number;
  provider: string;
  provider_order_id: string | null;
  provider_payment_id: string | null;
  provider_signature: string | null;
  amount: string | number | bigint;
  currency: string;
  status: PaymentAttemptStatus;
  failure_code: string | null;
  failure_message: string | null;
  idempotency_key: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentWebhookEventRow {
  id: string;
  store_id: string | null;
  provider: string;
  provider_event_id: string;
  event_type: string;
  signature_verified: boolean;
  payload: Record<string, unknown>;
  payment_id: string | null;
  status: PaymentWebhookEventStatus;
  error_message: string | null;
  processed_at: Date | null;
  created_at: Date;
}

export interface RefundRow {
  id: string;
  store_id: string;
  payment_id: string;
  order_id: string;
  provider: string;
  provider_refund_id: string | null;
  amount: string | number | bigint;
  currency: string;
  status: RefundStatus;
  reason: string | null;
  idempotency_key: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface IdempotencyRecordRow {
  id: string;
  store_id: string;
  scope: string;
  idempotency_key: string;
  request_hash: string;
  status: IdempotencyRecordStatus;
  response_status: number | null;
  response_body: Record<string, unknown> | null;
  resource_id: string | null;
  created_at: Date;
  expires_at: Date;
}

export interface CreatePaymentRowInput {
  id: string;
  storeId: string;
  checkoutId: string;
  orderId?: string | null;
  amount: bigint | number;
  currency: string;
  status?: PaymentStatus;
  provider?: string;
  capturedAmount?: bigint | number;
  refundedAmount?: bigint | number;
}

export interface CreatePaymentAttemptRowInput {
  id: string;
  paymentId: string;
  storeId: string;
  attemptNumber: number;
  provider?: string;
  providerOrderId?: string | null;
  providerPaymentId?: string | null;
  providerSignature?: string | null;
  amount: bigint | number;
  currency: string;
  status?: PaymentAttemptStatus;
  failureCode?: string | null;
  failureMessage?: string | null;
  idempotencyKey?: string | null;
}

export interface CreatePaymentWebhookEventRowInput {
  id: string;
  storeId?: string | null;
  provider?: string;
  providerEventId: string;
  eventType: string;
  signatureVerified?: boolean;
  payload: Record<string, unknown>;
  paymentId?: string | null;
  status?: PaymentWebhookEventStatus;
  errorMessage?: string | null;
  processedAt?: Date | null;
}

export interface CreateRefundRowInput {
  id: string;
  storeId: string;
  paymentId: string;
  orderId: string;
  provider?: string;
  providerRefundId?: string | null;
  amount: bigint | number;
  currency: string;
  status?: RefundStatus;
  reason?: string | null;
  idempotencyKey?: string | null;
}

export interface CreateIdempotencyRecordRowInput {
  id: string;
  storeId: string;
  scope: string;
  idempotencyKey: string;
  requestHash: string;
  status?: IdempotencyRecordStatus;
  responseStatus?: number | null;
  responseBody?: Record<string, unknown> | null;
  resourceId?: string | null;
  expiresAt: Date;
}
