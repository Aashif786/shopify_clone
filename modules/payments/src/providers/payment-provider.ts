export interface CreateProviderOrderInput {
  paymentId: string;
  attemptId: string;
  storeId: string;
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface ProviderOrderResult {
  providerOrderId: string;
  amount: number;
  currency: string;
  status: string;
  receipt?: string;
}

export interface ProviderPaymentResult {
  providerPaymentId: string;
  providerOrderId?: string | null;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method?: string;
  captured: boolean;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface VerifySignatureInput {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface CreateProviderRefundInput {
  paymentId: string;
  providerPaymentId: string;
  amount: number;
  currency: string;
  reason?: string | null;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface ProviderRefundResult {
  providerRefundId: string;
  amount: number;
  currency: string;
  status: "pending" | "processed" | "succeeded" | "failed";
}

export interface PaymentProvider {
  readonly name: string;
  createOrder(input: CreateProviderOrderInput): Promise<ProviderOrderResult>;
  getPayment(providerPaymentId: string): Promise<ProviderPaymentResult>;
  verifyPaymentSignature(input: VerifySignatureInput): boolean;
  getOrder?(providerOrderId: string): Promise<ProviderOrderResult>;
  getOrderPayments?(providerOrderId: string): Promise<ProviderPaymentResult[]>;
  findOrderByReceipt?(receipt: string): Promise<ProviderOrderResult | null>;
  createRefund?(input: CreateProviderRefundInput): Promise<ProviderRefundResult>;
}
