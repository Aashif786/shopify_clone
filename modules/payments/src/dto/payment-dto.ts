import type {
  PaymentAttemptStatus,
  PaymentStatus,
  RefundStatus,
} from "../domain/payment-state.js";

export interface PaymentDTO {
  id: string;
  storeId: string;
  checkoutId: string;
  orderId: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: string;
  capturedAmount: number;
  refundedAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAttemptDTO {
  id: string;
  paymentId: string;
  storeId: string;
  attemptNumber: number;
  provider: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  amount: number;
  currency: string;
  status: PaymentAttemptStatus;
  failureCode: string | null;
  failureMessage: string | null;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RefundDTO {
  id: string;
  storeId: string;
  paymentId: string;
  orderId: string;
  provider: string;
  providerRefundId: string | null;
  amount: number;
  currency: string;
  status: RefundStatus;
  reason: string | null;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
}
