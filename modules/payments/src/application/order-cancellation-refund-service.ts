import type { Database, DatabaseClient } from "@shopify-clone/db";
import {
  PaymentAttemptRepository,
  PaymentRepository,
  RefundRepository,
} from "@shopify-clone/db";
import { OrderStatusService } from "@shopify-clone/orders";
import { RefundService } from "./refund-service.js";
import type { PaymentProvider } from "../providers/payment-provider.js";
import { RazorpayTimeoutError } from "../providers/razorpay-types.js";
import { toRefundDTO, type RefundDTO } from "./dtos.js";

export interface ProcessCancellationRefundInput {
  storeId: string;
  orderId: string;
  checkoutId?: string;
  reason?: string;
}

export type CancellationRefundStatus =
  | "NOT_APPLICABLE"
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "REQUIRES_RECONCILIATION";

export interface ProcessCancellationRefundResult {
  status: CancellationRefundStatus;
  refundId?: string;
  providerRefundId?: string;
  amount?: number;
  currency?: string;
  paymentId?: string;
  reason?: string;
  error?: string;
}

export class OrderCancellationRefundService {
  constructor(
    private readonly refundService: RefundService = new RefundService(),
    private readonly paymentRepo: PaymentRepository = new PaymentRepository(),
    private readonly attemptRepo: PaymentAttemptRepository = new PaymentAttemptRepository(),
    private readonly refundRepo: RefundRepository = new RefundRepository(),
    private readonly orderStatusService: OrderStatusService = new OrderStatusService(),
    private readonly provider?: PaymentProvider,
  ) {}

  async processCancellationRefund(
    clientOrDb: Database | DatabaseClient,
    input: ProcessCancellationRefundInput,
  ): Promise<ProcessCancellationRefundResult> {
    const { storeId, orderId, checkoutId, reason } = input;

    if (!storeId || typeof storeId !== "string" || storeId.trim().length === 0) {
      throw new Error("storeId is required");
    }
    if (!orderId || typeof orderId !== "string" || orderId.trim().length === 0) {
      throw new Error("orderId is required");
    }

    // 1. Locate payment associated with this order
    let paymentRow = await this.paymentRepo.findByOrderId(clientOrDb, storeId, orderId);
    if (!paymentRow && checkoutId) {
      const checkoutPayments = await this.paymentRepo.findByCheckoutId(clientOrDb, storeId, checkoutId);
      paymentRow =
        checkoutPayments.find(
          (p) =>
            p.status === "CAPTURED" ||
            p.status === "REFUNDED" ||
            p.status === "PARTIALLY_REFUNDED",
        ) ?? checkoutPayments[0] ?? null;
    }

    if (!paymentRow) {
      return {
        status: "NOT_APPLICABLE",
        reason: "No payment associated with order",
      };
    }

    // 2. Check for existing cancellation refund via deterministic idempotency key
    const idempotencyKey = `order-cancel-refund:${orderId}`;
    const existingRefundRow = await this.refundRepo.findByIdempotencyKey(
      clientOrDb,
      storeId,
      idempotencyKey,
    );

    if (existingRefundRow) {
      if (existingRefundRow.status === "SUCCEEDED") {
        // Ensure order payment status is updated to REFUNDED
        try {
          await this.orderStatusService.updatePaymentStatus(clientOrDb, {
            storeId,
            orderId,
            paymentStatus: "REFUNDED",
            authorizedInternalCall: true,
            actorType: "SYSTEM",
            reason: "Order cancellation refund confirmed",
          });
        } catch {
          // Non-blocking if already REFUNDED
        }

        return {
          status: "SUCCEEDED",
          refundId: existingRefundRow.id,
          providerRefundId: existingRefundRow.provider_refund_id ?? undefined,
          amount: Number(existingRefundRow.amount),
          currency: existingRefundRow.currency,
          paymentId: existingRefundRow.payment_id,
        };
      }

      if (existingRefundRow.status === "REQUIRES_RECONCILIATION") {
        return {
          status: "REQUIRES_RECONCILIATION",
          refundId: existingRefundRow.id,
          amount: Number(existingRefundRow.amount),
          currency: existingRefundRow.currency,
          paymentId: existingRefundRow.payment_id,
          reason: "Refund is awaiting gateway reconciliation",
        };
      }

      if (existingRefundRow.status === "PENDING") {
        // If pending, attempt to dispatch/complete provider refund
        return this.dispatchProviderRefund(
          clientOrDb,
          storeId,
          orderId,
          paymentRow.id,
          paymentRow.currency,
          toRefundDTO(existingRefundRow),
          reason,
        );
      }
    }

    // 3. Check payment capture status
    if (paymentRow.status === "REFUNDED") {
      return {
        status: "NOT_APPLICABLE",
        paymentId: paymentRow.id,
        amount: 0,
        currency: paymentRow.currency,
        reason: "Payment is already fully refunded",
      };
    }

    if (paymentRow.status !== "CAPTURED" && paymentRow.status !== "PARTIALLY_REFUNDED") {
      return {
        status: "NOT_APPLICABLE",
        paymentId: paymentRow.id,
        reason: `Payment is in status '${paymentRow.status}', not captured`,
      };
    }

    // 4. Check remaining refundable amount
    const capturedAmount = Number(paymentRow.captured_amount);
    const refundedAmount = Number(paymentRow.refunded_amount);
    const remainingRefundable = capturedAmount - refundedAmount;

    if (remainingRefundable <= 0) {
      return {
        status: "NOT_APPLICABLE",
        paymentId: paymentRow.id,
        amount: 0,
        currency: paymentRow.currency,
        reason: "Payment is already fully refunded",
      };
    }

    // 5. Create PENDING refund in database transaction
    const refundDTO = await this.refundService.requestRefund(clientOrDb, {
      storeId,
      paymentId: paymentRow.id,
      orderId,
      amount: remainingRefundable,
      reason: reason ?? `Order ${orderId} cancellation refund`,
      idempotencyKey,
    });

    // 6. Dispatch provider call outside database transaction
    return this.dispatchProviderRefund(
      clientOrDb,
      storeId,
      orderId,
      paymentRow.id,
      paymentRow.currency,
      refundDTO,
      reason,
    );
  }

  private async dispatchProviderRefund(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    orderId: string,
    paymentId: string,
    currency: string,
    refundDTO: RefundDTO,
    reason?: string,
  ): Promise<ProcessCancellationRefundResult> {
    // If no external provider configured, simulate gateway success
    if (!this.provider || !this.provider.createRefund) {
      const syntheticProviderRefundId = `sim_rfnd_${refundDTO.id.slice(0, 16)}`;
      const succeededRefund = await this.refundService.recordRefundSuccess(
        clientOrDb,
        storeId,
        refundDTO.id,
        syntheticProviderRefundId,
      );

      try {
        await this.orderStatusService.updatePaymentStatus(clientOrDb, {
          storeId,
          orderId,
          paymentStatus: "REFUNDED",
          authorizedInternalCall: true,
          actorType: "SYSTEM",
          reason: "Order cancellation refund succeeded",
        });
      } catch {
        // Non-blocking if already updated
      }

      return {
        status: "SUCCEEDED",
        refundId: succeededRefund.id,
        providerRefundId: syntheticProviderRefundId,
        amount: succeededRefund.amount,
        currency: succeededRefund.currency,
        paymentId: succeededRefund.paymentId,
      };
    }

    // Retrieve provider payment ID from attempts
    const attempts = await this.attemptRepo.findByPaymentId(clientOrDb, storeId, paymentId);
    const capturedAttempt =
      attempts.find((a) => a.status === "CAPTURED" && a.provider_payment_id) ??
      attempts.find((a) => a.provider_payment_id) ??
      attempts[0];

    const providerPaymentId = capturedAttempt?.provider_payment_id ?? paymentId;

    try {
      const providerResult = await this.provider.createRefund({
        paymentId,
        providerPaymentId,
        amount: refundDTO.amount,
        currency,
        reason: reason ?? `Order ${orderId} cancellation refund`,
        receipt: refundDTO.id.slice(0, 40),
      });

      if (providerResult.status === "succeeded" || providerResult.status === "processed") {
        const succeededRefund = await this.refundService.recordRefundSuccess(
          clientOrDb,
          storeId,
          refundDTO.id,
          providerResult.providerRefundId,
        );

        try {
          await this.orderStatusService.updatePaymentStatus(clientOrDb, {
            storeId,
            orderId,
            paymentStatus: "REFUNDED",
            authorizedInternalCall: true,
            actorType: "SYSTEM",
            reason: "Order cancellation refund succeeded",
          });
        } catch {
          // Non-blocking
        }

        return {
          status: "SUCCEEDED",
          refundId: succeededRefund.id,
          providerRefundId: providerResult.providerRefundId,
          amount: succeededRefund.amount,
          currency: succeededRefund.currency,
          paymentId: succeededRefund.paymentId,
        };
      }

      // If pending provider response
      return {
        status: "PENDING",
        refundId: refundDTO.id,
        amount: refundDTO.amount,
        currency: refundDTO.currency,
        paymentId: refundDTO.paymentId,
      };
    } catch (err) {
      if (err instanceof RazorpayTimeoutError) {
        await this.refundService.recordRefundReconciliation(clientOrDb, storeId, refundDTO.id);
        return {
          status: "REQUIRES_RECONCILIATION",
          refundId: refundDTO.id,
          amount: refundDTO.amount,
          currency: refundDTO.currency,
          paymentId: refundDTO.paymentId,
          error: err.message,
        };
      }

      await this.refundService.recordRefundFailure(clientOrDb, storeId, refundDTO.id);
      return {
        status: "FAILED",
        refundId: refundDTO.id,
        amount: refundDTO.amount,
        currency: refundDTO.currency,
        paymentId: refundDTO.paymentId,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
