import {
  type CreateProviderOrderInput,
  type CreateProviderRefundInput,
  type PaymentProvider,
  type ProviderOrderResult,
  type ProviderPaymentResult,
  type ProviderRefundResult,
  type VerifySignatureInput,
} from "./payment-provider.js";
import { RazorpayClient } from "../infrastructure/razorpay-client.js";
import { verifyRazorpayPaymentSignature } from "./razorpay-signature.js";

export interface RazorpayProviderConfig {
  keyId: string;
  keySecret: string;
  client?: RazorpayClient;
}

export class RazorpayPaymentProvider implements PaymentProvider {
  readonly name = "razorpay";
  readonly keyId: string;
  private readonly keySecret: string;
  private readonly client: RazorpayClient;

  constructor(config: RazorpayProviderConfig) {
    if (!config.keyId || !config.keyId.trim()) {
      throw new Error("Razorpay keyId is required");
    }
    if (!config.keySecret || !config.keySecret.trim()) {
      throw new Error("Razorpay keySecret is required");
    }

    this.keyId = config.keyId.trim();
    this.keySecret = config.keySecret.trim();
    this.client = config.client ?? new RazorpayClient({
      keyId: this.keyId,
      keySecret: this.keySecret,
    });
  }

  async createOrder(input: CreateProviderOrderInput): Promise<ProviderOrderResult> {
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new Error("Order amount must be a positive integer in minor currency units");
    }
    if (!input.currency || !/^[A-Z]{3}$/.test(input.currency)) {
      throw new Error("Order currency must be a valid 3-letter ISO code");
    }
    const response = await this.client.createOrder({
      amount: input.amount,
      currency: input.currency,
      receipt: input.receipt.slice(0, 40),
      payment_capture: 1,
      notes: input.notes,
    });

    return {
      providerOrderId: response.id,
      amount: response.amount,
      currency: response.currency,
      status: response.status,
      receipt: response.receipt,
    };
  }

  async getPayment(providerPaymentId: string): Promise<ProviderPaymentResult> {
    const response = await this.client.getPayment(providerPaymentId);

    return {
      providerPaymentId: response.id,
      providerOrderId: response.order_id,
      amount: response.amount,
      currency: response.currency,
      status: response.status,
      method: response.method,
      captured: response.captured,
      errorCode: response.error_code,
      errorMessage: response.error_description,
    };
  }

  async getOrder(providerOrderId: string): Promise<ProviderOrderResult> {
    const response = await this.client.getOrder(providerOrderId);
    return {
      providerOrderId: response.id,
      amount: response.amount,
      currency: response.currency,
      status: response.status,
      receipt: response.receipt,
    };
  }

  async findOrderByReceipt(receipt: string): Promise<ProviderOrderResult | null> {
    const response = await this.client.findOrderByReceipt(receipt);
    if (!response) {
      return null;
    }
    return {
      providerOrderId: response.id,
      amount: response.amount,
      currency: response.currency,
      status: response.status,
      receipt: response.receipt,
    };
  }

  async createRefund(input: CreateProviderRefundInput): Promise<ProviderRefundResult> {
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new Error("Refund amount must be a positive integer in minor currency units");
    }
    const response = await this.client.createRefund(input.providerPaymentId, {
      amount: input.amount,
      notes: input.notes,
      receipt: input.receipt?.slice(0, 40),
    });

    const statusMap: Record<string, "pending" | "processed" | "succeeded" | "failed"> = {
      pending: "pending",
      processed: "succeeded",
      failed: "failed",
    };

    return {
      providerRefundId: response.id,
      amount: response.amount,
      currency: response.currency,
      status: statusMap[response.status] ?? "pending",
    };
  }

  verifyPaymentSignature(input: VerifySignatureInput): boolean {
    return verifyRazorpayPaymentSignature({
      orderId: input.orderId,
      paymentId: input.paymentId,
      signature: input.signature,
      keySecret: this.keySecret,
    });
  }
}
