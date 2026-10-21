import {
  type Database,
  type DatabaseClient,
  PaymentAttemptRepository,
  PaymentRepository,
} from "@shopify-clone/db";
import {
  CrossStorePaymentAccessError,
  InvalidPaymentStateTransitionError,
  PaymentAmountMismatchError,
  PaymentAttemptNotFoundError,
  PaymentCurrencyMismatchError,
  PaymentNotFoundError,
  PaymentValidationError,
} from "../domain/payment-errors.js";
import { Payment } from "../domain/payment.js";
import { PaymentAttempt } from "../domain/payment-attempt.js";
import { RazorpayPaymentProvider } from "../providers/razorpay-provider.js";
import { RazorpayTimeoutError } from "../providers/razorpay-types.js";
import {
  toPaymentAttemptDTO,
  toPaymentDTO,
  type PaymentAttemptDTO,
  type PaymentDTO,
} from "./dtos.js";
import type {
  RazorpayOrderDTO,
  VerifyRazorpayCallbackInput,
} from "../dto/razorpay-dto.js";
import { runInTransaction } from "./payment-service.js";
import { PaymentOrderIntegration } from "./payment-order-integration.js";

export interface ProcessedPaymentCallbackResult {
  payment: PaymentDTO;
  attempt: PaymentAttemptDTO;
}

export class ProviderPaymentService {
  constructor(
    private readonly provider: RazorpayPaymentProvider,
    private readonly paymentRepo: PaymentRepository = new PaymentRepository(),
    private readonly attemptRepo: PaymentAttemptRepository = new PaymentAttemptRepository(),
    private readonly orderIntegration: PaymentOrderIntegration = new PaymentOrderIntegration(),
  ) {}

  async createProviderOrder(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    paymentId: string,
    attemptId: string,
  ): Promise<RazorpayOrderDTO> {
    // 1. Load payment and attempt
    const paymentRow = await this.paymentRepo.findById(clientOrDb, storeId, paymentId);
    if (!paymentRow) {
      const anyStore = await clientOrDb.query<{ store_id: string }>(
        `SELECT store_id FROM payments WHERE id = $1`,
        [paymentId],
      );
      if (anyStore.rows.length > 0 && anyStore.rows[0]?.store_id !== storeId) {
        throw new CrossStorePaymentAccessError(
          `Payment '${paymentId}' does not belong to store '${storeId}'`,
        );
      }
      throw new PaymentNotFoundError(`Payment '${paymentId}' not found in store '${storeId}'`);
    }

    const attemptRow = await this.attemptRepo.findById(clientOrDb, storeId, attemptId);
    if (!attemptRow || attemptRow.payment_id !== paymentId) {
      throw new PaymentAttemptNotFoundError(
        `Payment attempt '${attemptId}' not found for payment '${paymentId}' in store '${storeId}'`,
      );
    }

    if (
      paymentRow.status === "FAILED" ||
      paymentRow.status === "CANCELLED" ||
      paymentRow.status === "CAPTURED" ||
      paymentRow.status === "REFUNDED"
    ) {
      throw new InvalidPaymentStateTransitionError(
        paymentRow.status,
        "PENDING",
        { reason: `Cannot create provider order for payment in '${paymentRow.status}' status` },
      );
    }

    if (
      attemptRow.status === "FAILED" ||
      attemptRow.status === "CANCELLED" ||
      attemptRow.status === "CAPTURED"
    ) {
      throw new InvalidPaymentStateTransitionError(
        attemptRow.status,
        "PENDING",
        { reason: `Cannot create provider order for attempt in '${attemptRow.status}' status` },
      );
    }

    // Idempotent return if provider order was already created
    if (attemptRow.provider_order_id) {
      return {
        providerOrderId: attemptRow.provider_order_id,
        amount: Number(attemptRow.amount),
        currency: attemptRow.currency,
        razorpayKeyId: this.provider.keyId,
        paymentId,
        attemptId,
      };
    }

    // Check if provider order was already created on the gateway (e.g. after ambiguous network timeout)
    if (attemptRow.status === "REQUIRES_RECONCILIATION" && this.provider.findOrderByReceipt) {
      const recoveredOrder = await this.provider.findOrderByReceipt(attemptId);
      if (recoveredOrder) {
        await runInTransaction(clientOrDb, async (tx) => {
          await this.attemptRepo.updateStatus(tx, storeId, attemptId, "PENDING", {
            providerOrderId: recoveredOrder.providerOrderId,
          });
          if (paymentRow.status === "CREATED") {
            await this.paymentRepo.updateStatus(tx, storeId, paymentId, "PENDING");
          }
        });

        return {
          providerOrderId: recoveredOrder.providerOrderId,
          amount: recoveredOrder.amount,
          currency: recoveredOrder.currency,
          razorpayKeyId: this.provider.keyId,
          paymentId,
          attemptId,
        };
      }
    }

    // 2. Call Razorpay API outside database transaction
    let orderResult;
    try {
      orderResult = await this.provider.createOrder({
        paymentId,
        attemptId,
        storeId,
        amount: Number(attemptRow.amount),
        currency: attemptRow.currency,
        receipt: attemptId,
        notes: {
          store_id: storeId,
          payment_id: paymentId,
          attempt_id: attemptId,
        },
      });
    } catch (error) {
      if (error instanceof RazorpayTimeoutError) {
        // Do NOT fail the payment on network timeout; mark attempt as uncertain
        await runInTransaction(clientOrDb, async (tx) => {
          await this.attemptRepo.updateStatus(tx, storeId, attemptId, "REQUIRES_RECONCILIATION");
        });
      }
      throw error;
    }

    // 3. Persist provider order ID in database transaction
    await runInTransaction(clientOrDb, async (tx) => {
      await this.attemptRepo.updateStatus(tx, storeId, attemptId, "PENDING", {
        providerOrderId: orderResult.providerOrderId,
      });

      if (paymentRow.status === "CREATED") {
        await this.paymentRepo.updateStatus(tx, storeId, paymentId, "PENDING");
      }
    });

    return {
      providerOrderId: orderResult.providerOrderId,
      amount: orderResult.amount,
      currency: orderResult.currency,
      razorpayKeyId: this.provider.keyId,
      paymentId,
      attemptId,
    };
  }

  async verifyAndProcessCallback(
    clientOrDb: Database | DatabaseClient,
    input: VerifyRazorpayCallbackInput,
  ): Promise<ProcessedPaymentCallbackResult> {
    if (!input) {
      throw new PaymentValidationError("Callback input is required");
    }
    if (!input.storeId || typeof input.storeId !== "string" || !input.storeId.trim()) {
      throw new PaymentValidationError("storeId is required");
    }
    if (!input.paymentId || typeof input.paymentId !== "string" || !input.paymentId.trim()) {
      throw new PaymentValidationError("paymentId is required");
    }
    if (!input.attemptId || typeof input.attemptId !== "string" || !input.attemptId.trim()) {
      throw new PaymentValidationError("attemptId is required");
    }
    if (!input.razorpayPaymentId || typeof input.razorpayPaymentId !== "string" || !input.razorpayPaymentId.trim()) {
      throw new PaymentValidationError("razorpayPaymentId is required");
    }
    if (!input.razorpayOrderId || typeof input.razorpayOrderId !== "string" || !input.razorpayOrderId.trim()) {
      throw new PaymentValidationError("razorpayOrderId is required");
    }
    if (!input.razorpaySignature || typeof input.razorpaySignature !== "string" || !input.razorpaySignature.trim()) {
      throw new PaymentValidationError("razorpaySignature is required");
    }

    // 1. Authoritative record and tenant validation
    const paymentRow = await this.paymentRepo.findById(clientOrDb, input.storeId, input.paymentId);
    if (!paymentRow) {
      const anyStore = await clientOrDb.query<{ store_id: string }>(
        `SELECT store_id FROM payments WHERE id = $1`,
        [input.paymentId],
      );
      if (anyStore.rows.length > 0 && anyStore.rows[0]?.store_id !== input.storeId) {
        throw new CrossStorePaymentAccessError(
          `Payment '${input.paymentId}' does not belong to store '${input.storeId}'`,
        );
      }
      throw new PaymentNotFoundError(
        `Payment '${input.paymentId}' not found in store '${input.storeId}'`,
      );
    }

    if (input.checkoutId && paymentRow.checkout_id !== input.checkoutId) {
      throw new PaymentValidationError(
        `Payment '${input.paymentId}' is associated with checkout '${paymentRow.checkout_id}', not '${input.checkoutId}'`,
      );
    }

    const attemptRow = await this.attemptRepo.findById(clientOrDb, input.storeId, input.attemptId);
    if (!attemptRow || attemptRow.payment_id !== input.paymentId) {
      throw new PaymentAttemptNotFoundError(
        `Payment attempt '${input.attemptId}' not found for payment '${input.paymentId}'`,
      );
    }

    if (!attemptRow.provider_order_id) {
      throw new PaymentValidationError(
        `Payment attempt '${input.attemptId}' has no associated provider order ID`,
      );
    }

    // 2. Confirm callback order ID matches the persisted order ID originally returned to Razorpay Checkout
    // Reject immediately if the order ID differs or if an internal checkout ID was substituted
    if (input.razorpayOrderId.trim() !== attemptRow.provider_order_id.trim()) {
      throw new PaymentValidationError(
        `Callback order ID '${input.razorpayOrderId}' does not match attempt provider order ID '${attemptRow.provider_order_id}'`,
      );
    }

    // 3. Verify frontend HMAC signature against the authoritative persisted provider order ID
    const isSignatureValid = this.provider.verifyPaymentSignature({
      orderId: attemptRow.provider_order_id,
      paymentId: input.razorpayPaymentId.trim(),
      signature: input.razorpaySignature.trim(),
    });

    if (!isSignatureValid) {
      throw new PaymentValidationError("Invalid Razorpay payment callback signature");
    }

    // 3. Authoritative gateway status lookup outside database transaction
    const gatewayPayment = await this.provider.getPayment(input.razorpayPaymentId);

    // Verify returned gateway payment belongs to expected order
    if (
      gatewayPayment.providerOrderId &&
      attemptRow.provider_order_id &&
      gatewayPayment.providerOrderId !== attemptRow.provider_order_id
    ) {
      await runInTransaction(clientOrDb, async (tx) => {
        await this.paymentRepo.updateStatus(tx, input.storeId, input.paymentId, "REQUIRES_RECONCILIATION");
        await this.attemptRepo.updateStatus(tx, input.storeId, input.attemptId, "REQUIRES_RECONCILIATION");
      });
      throw new PaymentValidationError(
        `Gateway order ID '${gatewayPayment.providerOrderId}' does not match attempt provider order ID '${attemptRow.provider_order_id}'`,
      );
    }

    // 4. Verify amounts and currency match
    if (gatewayPayment.amount !== Number(attemptRow.amount)) {
      await runInTransaction(clientOrDb, async (tx) => {
        await this.paymentRepo.updateStatus(tx, input.storeId, input.paymentId, "REQUIRES_RECONCILIATION");
        await this.attemptRepo.updateStatus(tx, input.storeId, input.attemptId, "REQUIRES_RECONCILIATION");
      });
      throw new PaymentAmountMismatchError(
        `Gateway amount (${gatewayPayment.amount}) does not match expected amount (${attemptRow.amount})`,
      );
    }

    if (gatewayPayment.currency.toUpperCase() !== attemptRow.currency.toUpperCase()) {
      await runInTransaction(clientOrDb, async (tx) => {
        await this.paymentRepo.updateStatus(tx, input.storeId, input.paymentId, "REQUIRES_RECONCILIATION");
        await this.attemptRepo.updateStatus(tx, input.storeId, input.attemptId, "REQUIRES_RECONCILIATION");
      });
      throw new PaymentCurrencyMismatchError(
        `Gateway currency (${gatewayPayment.currency}) does not match expected currency (${attemptRow.currency})`,
      );
    }

    // 5. Update state in database transaction
    const result = await runInTransaction(clientOrDb, async (tx) => {
      const lockedPayment = await this.paymentRepo.findByIdForUpdate(
        tx,
        input.storeId,
        input.paymentId,
      );
      if (!lockedPayment) {
        throw new PaymentNotFoundError(`Payment '${input.paymentId}' not found`);
      }

      const lockedAttempt = await this.attemptRepo.findById(tx, input.storeId, input.attemptId);
      if (!lockedAttempt) {
        throw new PaymentAttemptNotFoundError(`Attempt '${input.attemptId}' not found`);
      }

      const payment = Payment.reconstitute({
        id: lockedPayment.id,
        storeId: lockedPayment.store_id,
        checkoutId: lockedPayment.checkout_id,
        orderId: lockedPayment.order_id,
        amount: Number(lockedPayment.amount),
        currency: lockedPayment.currency,
        status: lockedPayment.status,
        provider: lockedPayment.provider,
        capturedAmount: Number(lockedPayment.captured_amount),
        refundedAmount: Number(lockedPayment.refunded_amount),
        createdAt: new Date(lockedPayment.created_at),
        updatedAt: new Date(lockedPayment.updated_at),
      });

      const attempt = PaymentAttempt.reconstitute({
        id: lockedAttempt.id,
        paymentId: lockedAttempt.payment_id,
        storeId: lockedAttempt.store_id,
        attemptNumber: lockedAttempt.attempt_number,
        provider: lockedAttempt.provider,
        providerOrderId: lockedAttempt.provider_order_id,
        providerPaymentId: lockedAttempt.provider_payment_id,
        providerSignature: lockedAttempt.provider_signature,
        amount: Number(lockedAttempt.amount),
        currency: lockedAttempt.currency,
        status: lockedAttempt.status,
        failureCode: lockedAttempt.failure_code,
        failureMessage: lockedAttempt.failure_message,
        idempotencyKey: lockedAttempt.idempotency_key,
        createdAt: new Date(lockedAttempt.created_at),
        updatedAt: new Date(lockedAttempt.updated_at),
      });

      // Stale event protection: do not regress CAPTURED or REFUNDED
      if (!payment.isCaptured() && payment.status !== "REFUNDED") {
        if (gatewayPayment.status === "captured") {
          payment.markCaptured(gatewayPayment.amount);
          attempt.markCaptured(input.razorpayPaymentId, input.razorpaySignature);
        } else if (gatewayPayment.status === "authorized") {
          payment.markAuthorized();
          attempt.markAuthorized(input.razorpayPaymentId);
        } else if (gatewayPayment.status === "failed") {
          payment.markFailed();
          attempt.markFailed(
            gatewayPayment.errorCode ?? undefined,
            gatewayPayment.errorMessage ?? undefined,
          );
        } else {
          payment.markRequiresReconciliation();
          attempt.markRequiresReconciliation();
        }
      }

      const updatedPaymentRow = await this.paymentRepo.updateStatus(
        tx,
        input.storeId,
        payment.id,
        payment.status,
        { capturedAmount: payment.capturedAmount },
      );

      const updatedAttemptRow = await this.attemptRepo.updateStatus(
        tx,
        input.storeId,
        attempt.id,
        attempt.status,
        {
          providerPaymentId: attempt.providerPaymentId,
          providerSignature: attempt.providerSignature,
          failureCode: attempt.failureCode,
          failureMessage: attempt.failureMessage,
        },
      );

      return {
        payment: toPaymentDTO(updatedPaymentRow ?? lockedPayment),
        attempt: toPaymentAttemptDTO(updatedAttemptRow ?? lockedAttempt),
      };
    });

    // 6. Trigger downstream purchase workflow if payment was captured
    if (result.payment.status === "CAPTURED") {
      await this.orderIntegration.completePurchaseWorkflow(clientOrDb, {
        storeId: input.storeId,
        paymentId: input.paymentId,
      }).catch(() => {
        // Downstream order failure is recoverable; payment capture remains intact
      });
    }

    return result;
  }
}
