import type { Payment } from "../domain/payment.js";
import type { PaymentAttempt } from "../domain/payment-attempt.js";
import type { PaymentRow, PaymentAttemptRow, RefundRow } from "@shopify-clone/db";
import type {
  PaymentDTO,
  PaymentAttemptDTO,
  RefundDTO,
} from "../dto/payment-dto.js";

export type { PaymentDTO, PaymentAttemptDTO, RefundDTO };

export interface CreatePaymentInput {
  storeId: string;
  checkoutId: string;
  provider?: string;
  idempotencyKey: string;
}

export interface CreatePaymentAttemptInput {
  storeId: string;
  paymentId: string;
  provider?: string;
  idempotencyKey?: string;
}

export interface CreateRefundInput {
  storeId: string;
  paymentId: string;
  amount: number;
  reason?: string | null;
  idempotencyKey: string;
}

export interface PaymentCreationResultDTO {
  payment: PaymentDTO;
  attempt: PaymentAttemptDTO;
}

export function toPaymentDTO(payment: Payment | PaymentRow): PaymentDTO {
  if ("capturedAmount" in payment) {
    return {
      id: payment.id,
      storeId: payment.storeId,
      checkoutId: payment.checkoutId,
      orderId: payment.orderId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      provider: payment.provider,
      capturedAmount: payment.capturedAmount,
      refundedAmount: payment.refundedAmount,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    };
  }

  return {
    id: payment.id,
    storeId: payment.store_id,
    checkoutId: payment.checkout_id,
    orderId: payment.order_id,
    amount: Number(payment.amount),
    currency: payment.currency,
    status: payment.status,
    provider: payment.provider,
    capturedAmount: Number(payment.captured_amount),
    refundedAmount: Number(payment.refunded_amount),
    createdAt: new Date(payment.created_at).toISOString(),
    updatedAt: new Date(payment.updated_at).toISOString(),
  };
}

export function toPaymentAttemptDTO(
  attempt: PaymentAttempt | PaymentAttemptRow,
): PaymentAttemptDTO {
  if ("attemptNumber" in attempt) {
    return {
      id: attempt.id,
      paymentId: attempt.paymentId,
      storeId: attempt.storeId,
      attemptNumber: attempt.attemptNumber,
      provider: attempt.provider,
      providerOrderId: attempt.providerOrderId,
      providerPaymentId: attempt.providerPaymentId,
      amount: attempt.amount,
      currency: attempt.currency,
      status: attempt.status,
      failureCode: attempt.failureCode,
      failureMessage: attempt.failureMessage,
      idempotencyKey: attempt.idempotencyKey,
      createdAt: attempt.createdAt.toISOString(),
      updatedAt: attempt.updatedAt.toISOString(),
    };
  }

  return {
    id: attempt.id,
    paymentId: attempt.payment_id,
    storeId: attempt.store_id,
    attemptNumber: attempt.attempt_number,
    provider: attempt.provider,
    providerOrderId: attempt.provider_order_id,
    providerPaymentId: attempt.provider_payment_id,
    amount: Number(attempt.amount),
    currency: attempt.currency,
    status: attempt.status,
    failureCode: attempt.failure_code,
    failureMessage: attempt.failure_message,
    idempotencyKey: attempt.idempotency_key,
    createdAt: new Date(attempt.created_at).toISOString(),
    updatedAt: new Date(attempt.updated_at).toISOString(),
  };
}

export function toRefundDTO(refund: RefundRow): RefundDTO {
  return {
    id: refund.id,
    storeId: refund.store_id,
    paymentId: refund.payment_id,
    orderId: refund.order_id,
    provider: refund.provider,
    providerRefundId: refund.provider_refund_id,
    amount: Number(refund.amount),
    currency: refund.currency,
    status: refund.status,
    reason: refund.reason,
    idempotencyKey: refund.idempotency_key,
    createdAt: new Date(refund.created_at).toISOString(),
    updatedAt: new Date(refund.updated_at).toISOString(),
  };
}
