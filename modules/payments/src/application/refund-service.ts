import {
  generateUuidV7,
  type Database,
  type DatabaseClient,
  PaymentRepository,
  PaymentAttemptRepository,
  RefundRepository,
  IdempotencyRepository,
} from "@shopify-clone/db";
import { OrderStatusService } from "@shopify-clone/orders";
import { Payment } from "../domain/payment.js";
import {
  AmbiguousRefundPendingError,
  ConcurrentOperationError,
  CrossStorePaymentAccessError,
  InvalidMonetaryAmountError,
  PaymentGatewayError,
  PaymentIdempotencyConflictError,
  PaymentNotFoundError,
  PaymentNotRefundableError,
  RefundExceedsCapturedAmountError,
  RefundNotFoundError,
} from "../domain/payment-errors.js";
import type { PaymentProvider } from "../providers/payment-provider.js";
import { RazorpayTimeoutError } from "../providers/razorpay-types.js";
import {
  toRefundDTO,
  type CreateRefundInput,
  type ExecuteMerchantRefundInput,
  type ExecuteMerchantRefundResult,
  type OrderRefundSummaryDTO,
  type RefundDTO,
} from "./dtos.js";
import {
  computeRequestHash,
  runInTransaction,
} from "./payment-service.js";

export class RefundService {
  constructor(
    private readonly refundRepo: RefundRepository = new RefundRepository(),
    private readonly paymentRepo: PaymentRepository = new PaymentRepository(),
    private readonly idempotencyRepo: IdempotencyRepository = new IdempotencyRepository(),
    private readonly attemptRepo: PaymentAttemptRepository = new PaymentAttemptRepository(),
    private readonly orderStatusService: OrderStatusService = new OrderStatusService(),
    private readonly defaultProvider?: PaymentProvider,
  ) {}

  async requestRefund(
    clientOrDb: Database | DatabaseClient,
    input: CreateRefundInput,
  ): Promise<RefundDTO> {
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new InvalidMonetaryAmountError("Refund amount must be a positive integer in minor units");
    }

    const requestHash = computeRequestHash({
      paymentId: input.paymentId,
      orderId: input.orderId ?? null,
      amount: input.amount,
      reason: input.reason ?? null,
    });

    // 1. Idempotency Check & Atomic Reservation
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const reservation = await this.idempotencyRepo.reserve(clientOrDb, {
      id: generateUuidV7(),
      storeId: input.storeId,
      scope: "payments:refund",
      idempotencyKey: input.idempotencyKey,
      requestHash,
      expiresAt,
    });

    if (!reservation.reserved) {
      if (reservation.record.request_hash !== requestHash) {
        throw new PaymentIdempotencyConflictError(
          `Idempotency key '${input.idempotencyKey}' has already been used with different refund parameters`,
        );
      }
      if (reservation.record.status === "COMPLETED" && reservation.record.response_body) {
        return reservation.record.response_body as unknown as RefundDTO;
      }
      if (reservation.record.status === "IN_PROGRESS") {
        throw new ConcurrentOperationError(
          `Refund operation is currently in progress for idempotency key '${input.idempotencyKey}'`,
        );
      }
    }

    try {
      return await runInTransaction(clientOrDb, async (tx) => {
        // 2. Row-Level Lock: Serialize concurrent refund requests on the parent payment aggregate
        const paymentRow = await this.paymentRepo.findByIdForUpdate(
          tx,
          input.storeId,
          input.paymentId,
        );

        if (!paymentRow) {
          const anyStore = await tx.query<{ store_id: string }>(
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

        const payment = Payment.reconstitute({
          id: paymentRow.id,
          storeId: paymentRow.store_id,
          checkoutId: paymentRow.checkout_id,
          orderId: paymentRow.order_id,
          amount: Number(paymentRow.amount),
          currency: paymentRow.currency,
          status: paymentRow.status,
          provider: paymentRow.provider,
          capturedAmount: Number(paymentRow.captured_amount),
          refundedAmount: Number(paymentRow.refunded_amount),
          createdAt: new Date(paymentRow.created_at),
          updatedAt: new Date(paymentRow.updated_at),
        });

        // 3. Verify eligible state (must be CAPTURED or PARTIALLY_REFUNDED)
        if (!payment.isRefundable()) {
          throw new PaymentNotRefundableError(
            `Payment '${input.paymentId}' in status '${payment.status}' is not eligible for refunds`,
          );
        }

        // 3.5 Check for ambiguous in-flight refunds
        const hasAmbiguous = await this.refundRepo.hasAmbiguousRefund(
          tx,
          input.storeId,
          input.paymentId,
        );
        if (hasAmbiguous) {
          throw new AmbiguousRefundPendingError(
            `Payment '${input.paymentId}' has a pending refund in REQUIRES_RECONCILIATION status. Reconcile provider outcome before requesting new refunds.`,
          );
        }

        // 4. Verify remaining unreserved refundable balance under row lock (accounting for in-flight refunds)
        const inFlightAmount = await this.refundRepo.getInFlightRefundAmount(
          tx,
          input.storeId,
          input.paymentId,
        );
        const remainingRefundable = Math.max(
          0,
          payment.getRemainingRefundableAmount() - inFlightAmount,
        );
        if (input.amount > remainingRefundable) {
          throw new RefundExceedsCapturedAmountError(
            `Requested refund amount (${input.amount}) exceeds remaining unreserved refundable balance (${remainingRefundable})`,
          );
        }

        // 5. Verify and resolve valid order reference (INT-02 & INT-03)
        const effectiveOrderId = input.orderId ?? payment.orderId;
        if (!effectiveOrderId) {
          throw new PaymentNotRefundableError(
            `Payment '${input.paymentId}' is not associated with an order and cannot be refunded`,
          );
        }

        // 6. Check if refund with same idempotency key already exists in database
        const existingRefund = await this.refundRepo.findByIdempotencyKey(
          tx,
          input.storeId,
          input.idempotencyKey,
        );
        if (existingRefund) {
          if (
            existingRefund.order_id !== effectiveOrderId ||
            existingRefund.payment_id !== input.paymentId ||
            Number(existingRefund.amount) !== input.amount ||
            (existingRefund.reason !== null && existingRefund.reason !== (input.reason ?? null))
          ) {
            throw new PaymentIdempotencyConflictError(
              `Idempotency key '${input.idempotencyKey}' has already been used with different refund parameters`,
            );
          }
          return toRefundDTO(existingRefund);
        }

        // If payment was not previously linked to this order, persist order linkage under row lock
        if (!payment.orderId && effectiveOrderId) {
          await this.paymentRepo.updateStatus(
            tx,
            input.storeId,
            payment.id,
            payment.status,
            { orderId: effectiveOrderId },
          );
        }

        // 7. Record provisional PENDING refund record
        const refundId = generateUuidV7();
        const refundRow = await this.refundRepo.create(tx, {
          id: refundId,
          storeId: input.storeId,
          paymentId: input.paymentId,
          orderId: effectiveOrderId,
          amount: input.amount,
          currency: payment.currency,
          status: "PENDING",
          reason: input.reason ?? null,
          idempotencyKey: input.idempotencyKey,
        });

        const result = toRefundDTO(refundRow);

        // 8. Complete idempotency record
        await this.idempotencyRepo.complete(
          tx,
          input.storeId,
          "payments:refund",
          input.idempotencyKey,
          201,
          result as unknown as Record<string, unknown>,
          refundId,
        );

        return result;
      });
    } catch (error) {
      try {
        await this.idempotencyRepo.fail(
          clientOrDb,
          input.storeId,
          "payments:refund",
          input.idempotencyKey,
        );
      } catch {
        // Suppress failure marking error to preserve original exception
      }
      throw error;
    }
  }

  async recordRefundSuccess(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    refundId: string,
    providerRefundId: string,
  ): Promise<RefundDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const refundRow = await this.refundRepo.findById(tx, storeId, refundId);
      if (!refundRow) {
        throw new RefundNotFoundError(`Refund '${refundId}' not found in store '${storeId}'`);
      }

      if (refundRow.status === "SUCCEEDED") {
        return toRefundDTO(refundRow);
      }

      // Row-lock parent payment
      const paymentRow = await this.paymentRepo.findByIdForUpdate(
        tx,
        storeId,
        refundRow.payment_id,
      );
      if (!paymentRow) {
        throw new PaymentNotFoundError(
          `Payment '${refundRow.payment_id}' not found in store '${storeId}'`,
        );
      }

      const payment = Payment.reconstitute({
        id: paymentRow.id,
        storeId: paymentRow.store_id,
        checkoutId: paymentRow.checkout_id,
        orderId: paymentRow.order_id,
        amount: Number(paymentRow.amount),
        currency: paymentRow.currency,
        status: paymentRow.status,
        provider: paymentRow.provider,
        capturedAmount: Number(paymentRow.captured_amount),
        refundedAmount: Number(paymentRow.refunded_amount),
        createdAt: new Date(paymentRow.created_at),
        updatedAt: new Date(paymentRow.updated_at),
      });

      // Apply refund accumulation to parent aggregate
      payment.recordRefund(Number(refundRow.amount));

      // Update parent payment row
      await this.paymentRepo.updateAmounts(
        tx,
        storeId,
        payment.id,
        payment.capturedAmount,
        payment.refundedAmount,
        payment.status,
      );

      // Update refund row status to SUCCEEDED
      const updatedRefund = await this.refundRepo.updateStatus(
        tx,
        storeId,
        refundId,
        "SUCCEEDED",
        { providerRefundId },
      );

      if (!updatedRefund) {
        throw new RefundNotFoundError(`Refund '${refundId}' could not be updated`);
      }

      return toRefundDTO(updatedRefund);
    });
  }

  async recordRefundFailure(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    refundId: string,
  ): Promise<RefundDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const refundRow = await this.refundRepo.findById(tx, storeId, refundId);
      if (!refundRow) {
        throw new RefundNotFoundError(`Refund '${refundId}' not found in store '${storeId}'`);
      }

      const updated = await this.refundRepo.updateStatus(tx, storeId, refundId, "FAILED");
      if (!updated) {
        throw new RefundNotFoundError(`Refund '${refundId}' could not be updated`);
      }

      return toRefundDTO(updated);
    });
  }

  async recordRefundReconciliation(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    refundId: string,
  ): Promise<RefundDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const refundRow = await this.refundRepo.findById(tx, storeId, refundId);
      if (!refundRow) {
        throw new RefundNotFoundError(`Refund '${refundId}' not found in store '${storeId}'`);
      }

      const updated = await this.refundRepo.updateStatus(
        tx,
        storeId,
        refundId,
        "REQUIRES_RECONCILIATION",
      );
      if (!updated) {
        throw new RefundNotFoundError(`Refund '${refundId}' could not be updated`);
      }

      return toRefundDTO(updated);
    });
  }

  async getRefund(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    refundId: string,
  ): Promise<RefundDTO> {
    const row = await this.refundRepo.findById(clientOrDb, storeId, refundId);
    if (!row) {
      throw new RefundNotFoundError(`Refund '${refundId}' not found in store '${storeId}'`);
    }
    return toRefundDTO(row);
  }

  async getRefundsByPaymentId(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    paymentId: string,
  ): Promise<RefundDTO[]> {
    const rows = await this.refundRepo.findByPaymentId(clientOrDb, storeId, paymentId);
    return rows.map(toRefundDTO);
  }

  async getRefundsByOrderId(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    orderId: string,
  ): Promise<RefundDTO[]> {
    const rows = await this.refundRepo.findByOrderId(clientOrDb, storeId, orderId);
    return rows.map(toRefundDTO);
  }

  async getOrderRefundSummary(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    orderId: string,
  ): Promise<OrderRefundSummaryDTO | null> {
    const orderRes = await clientOrDb.query<{ id: string; store_id: string; checkout_id: string | null }>(
      `SELECT id, store_id, checkout_id FROM orders WHERE id = $1`,
      [orderId],
    );
    if (orderRes.rows.length === 0) {
      throw new PaymentNotFoundError(`Order '${orderId}' not found in store '${storeId}'`);
    }
    if (orderRes.rows[0]?.store_id !== storeId) {
      throw new CrossStorePaymentAccessError(`Order '${orderId}' does not belong to store '${storeId}'`);
    }

    const checkoutId = orderRes.rows[0]?.checkout_id;
    let paymentRow = await this.paymentRepo.findByOrderId(clientOrDb, storeId, orderId);
    if (!paymentRow && checkoutId) {
      const checkoutPayments = await this.paymentRepo.findByCheckoutId(
        clientOrDb,
        storeId,
        checkoutId,
      );
      paymentRow =
        checkoutPayments.find(
          (p) =>
            p.status === "CAPTURED" ||
            p.status === "PARTIALLY_REFUNDED" ||
            p.status === "REFUNDED",
        ) ?? checkoutPayments[0] ?? null;
    }

    if (!paymentRow) {
      return null;
    }

    const inFlightAmount = await this.refundRepo.getInFlightRefundAmount(
      clientOrDb,
      storeId,
      paymentRow.id,
    );
    const hasAmbiguous = await this.refundRepo.hasAmbiguousRefund(
      clientOrDb,
      storeId,
      paymentRow.id,
    );

    const capturedAmount = Number(paymentRow.captured_amount);
    const refundedAmount = Number(paymentRow.refunded_amount);
    const remainingRefundable = Math.max(0, capturedAmount - refundedAmount - inFlightAmount);
    const isRefundable =
      !hasAmbiguous &&
      (paymentRow.status === "CAPTURED" || paymentRow.status === "PARTIALLY_REFUNDED") &&
      remainingRefundable > 0;

    const refunds = await this.getRefundsByOrderId(clientOrDb, storeId, orderId);

    return {
      paymentId: paymentRow.id,
      orderId,
      currency: paymentRow.currency,
      totalAmount: Number(paymentRow.amount),
      capturedAmount,
      refundedAmount,
      remainingRefundable,
      isRefundable,
      paymentStatus: paymentRow.status,
      refunds,
    };
  }

  async executeMerchantRefund(
    clientOrDb: Database | DatabaseClient,
    input: ExecuteMerchantRefundInput,
  ): Promise<ExecuteMerchantRefundResult> {
    const { storeId, orderId, reason, actorId, actorType } = input;

    if (!storeId || typeof storeId !== "string" || storeId.trim().length === 0) {
      throw new Error("storeId is required");
    }
    if (!orderId || typeof orderId !== "string" || orderId.trim().length === 0) {
      throw new Error("orderId is required");
    }
    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      throw new Error("Refund reason is required and must not be empty");
    }
    if (reason.trim().length > 500) {
      throw new Error("Refund reason cannot exceed 500 characters");
    }

    // 1. Verify order exists and belongs to store
    const orderRes = await clientOrDb.query<{
      id: string;
      store_id: string;
      status: string;
      payment_status: string;
      checkout_id: string | null;
      total: string | number;
      grand_total: string | number;
    }>(
      `SELECT id, store_id, status, payment_status, checkout_id, total, grand_total
       FROM orders
       WHERE id = $1 AND store_id = $2`,
      [orderId, storeId],
    );

    if (orderRes.rows.length === 0) {
      const anyStoreOrder = await clientOrDb.query<{ store_id: string }>(
        `SELECT store_id FROM orders WHERE id = $1`,
        [orderId],
      );
      if (anyStoreOrder.rows.length > 0 && anyStoreOrder.rows[0]?.store_id !== storeId) {
        throw new CrossStorePaymentAccessError(`Order '${orderId}' does not belong to store '${storeId}'`);
      }
      throw new PaymentNotFoundError(`Order '${orderId}' not found in store '${storeId}'`);
    }

    const orderRow = orderRes.rows[0]!;

    if (orderRow.status === "CANCELLED") {
      throw new PaymentNotRefundableError(
        `Cannot refund order '${orderId}' because it is cancelled`,
      );
    }

    // 2. Locate payment for order
    let paymentRow = await this.paymentRepo.findByOrderId(clientOrDb, storeId, orderId);
    if (!paymentRow && orderRow.checkout_id) {
      const checkoutPayments = await this.paymentRepo.findByCheckoutId(
        clientOrDb,
        storeId,
        orderRow.checkout_id,
      );
      paymentRow =
        checkoutPayments.find(
          (p) =>
            p.status === "CAPTURED" ||
            p.status === "PARTIALLY_REFUNDED" ||
            p.status === "REFUNDED",
        ) ?? checkoutPayments[0] ?? null;
    }

    if (!paymentRow) {
      throw new PaymentNotFoundError(`No payment found for order '${orderId}' in store '${storeId}'`);
    }

    // 2.5 Idempotency replay check
    if (input.idempotencyKey) {
      const existingRefund = await this.refundRepo.findByIdempotencyKey(
        clientOrDb,
        storeId,
        input.idempotencyKey,
      );
      if (existingRefund) {
        if (
          existingRefund.order_id !== orderId ||
          existingRefund.payment_id !== paymentRow.id ||
          (input.amount !== undefined && Number(existingRefund.amount) !== input.amount) ||
          (existingRefund.reason !== null && existingRefund.reason !== reason.trim())
        ) {
          throw new PaymentIdempotencyConflictError(
            `Idempotency key '${input.idempotencyKey}' has already been used with different refund parameters`,
          );
        }
        const inFlight = await this.refundRepo.getInFlightRefundAmount(
          clientOrDb,
          storeId,
          paymentRow.id,
        );
        const remaining = Math.max(
          0,
          Number(paymentRow.captured_amount) - Number(paymentRow.refunded_amount) - inFlight,
        );
        const orderPaymentStatus =
          paymentRow.status === "REFUNDED" ? "REFUNDED" : "PARTIALLY_REFUNDED";
        return {
          status: existingRefund.status,
          refund: toRefundDTO(existingRefund),
          providerRefundId: existingRefund.provider_refund_id ?? undefined,
          orderPaymentStatus,
          remainingRefundable: remaining,
        };
      }
    }

    // 2.7 Ambiguous provider outcome guard: block new refunds while an ambiguous refund is pending reconciliation
    const hasAmbiguous = await this.refundRepo.hasAmbiguousRefund(
      clientOrDb,
      storeId,
      paymentRow.id,
    );
    if (hasAmbiguous) {
      throw new AmbiguousRefundPendingError(
        `Payment '${paymentRow.id}' has a refund in REQUIRES_RECONCILIATION status. Resolve or reconcile provider outcome before requesting new refunds.`,
      );
    }

    // 3. Verify eligible payment status
    if (paymentRow.status === "REFUNDED") {
      throw new PaymentNotRefundableError(`Payment '${paymentRow.id}' is already fully refunded`);
    }

    if (paymentRow.status !== "CAPTURED" && paymentRow.status !== "PARTIALLY_REFUNDED") {
      throw new PaymentNotRefundableError(
        `Payment '${paymentRow.id}' in status '${paymentRow.status}' is not eligible for refunds (must be CAPTURED or PARTIALLY_REFUNDED)`,
      );
    }

    // 4. Verify refundable amount (accounting for in-flight pending/processing refunds)
    const inFlightAmount = await this.refundRepo.getInFlightRefundAmount(
      clientOrDb,
      storeId,
      paymentRow.id,
    );
    const capturedAmount = Number(paymentRow.captured_amount);
    const refundedAmount = Number(paymentRow.refunded_amount);
    const remainingRefundable = Math.max(0, capturedAmount - refundedAmount - inFlightAmount);

    if (remainingRefundable <= 0) {
      throw new PaymentNotRefundableError(
        `Payment '${paymentRow.id}' has no remaining unreserved refundable balance`,
      );
    }

    const effectiveAmount = input.amount !== undefined ? input.amount : remainingRefundable;

    if (!Number.isInteger(effectiveAmount) || effectiveAmount <= 0) {
      throw new InvalidMonetaryAmountError(
        "Refund amount must be a positive integer in minor units (paise/cents)",
      );
    }

    if (effectiveAmount > remainingRefundable) {
      throw new RefundExceedsCapturedAmountError(
        `Requested refund amount (${effectiveAmount}) exceeds remaining unreserved refundable balance (${remainingRefundable})`,
      );
    }

    // 5. Idempotency reservation and PENDING refund record creation
    const idempotencyKey = input.idempotencyKey || `merchant-refund:${orderId}:${effectiveAmount}:${generateUuidV7()}`;

    const refundDTO = await this.requestRefund(clientOrDb, {
      storeId,
      paymentId: paymentRow.id,
      orderId,
      amount: effectiveAmount,
      reason: reason.trim(),
      idempotencyKey,
    });

    if (refundDTO.status === "SUCCEEDED") {
      const isFull = (refundedAmount + effectiveAmount) >= capturedAmount;
      return {
        status: "SUCCEEDED",
        refund: refundDTO,
        providerRefundId: refundDTO.providerRefundId ?? undefined,
        orderPaymentStatus: isFull ? "REFUNDED" : "PARTIALLY_REFUNDED",
        remainingRefundable: Math.max(0, remainingRefundable - effectiveAmount),
      };
    }

    // 6. External provider dispatch
    const provider = input.provider ?? this.defaultProvider;

    if (!provider || !provider.createRefund) {
      if (process.env.NODE_ENV === "production" || process.env.APP_ENV === "production") {
        throw new PaymentGatewayError(
          "Payment gateway provider is not configured for production environment",
        );
      }

      // In development / demo environment without external provider credentials, simulate gateway success
      const syntheticProviderRefundId = `sim_rfnd_${refundDTO.id.slice(0, 16)}`;
      const succeededRefund = await this.recordRefundSuccess(
        clientOrDb,
        storeId,
        refundDTO.id,
        syntheticProviderRefundId,
      );

      const isFull = (refundedAmount + effectiveAmount) >= capturedAmount;
      const targetPaymentStatus = isFull ? "REFUNDED" : "PARTIALLY_REFUNDED";

      try {
        await this.orderStatusService.updatePaymentStatus(clientOrDb, {
          storeId,
          orderId,
          paymentStatus: targetPaymentStatus,
          authorizedInternalCall: true,
          actorType: actorType ?? "MERCHANT",
          actorId,
          reason: reason.trim(),
        });
      } catch {
        // Non-blocking if already in target status
      }

      return {
        status: "SUCCEEDED",
        refund: succeededRefund,
        providerRefundId: syntheticProviderRefundId,
        orderPaymentStatus: targetPaymentStatus,
        remainingRefundable: Math.max(0, remainingRefundable - effectiveAmount),
      };
    }

    // Dispatch external provider call
    const attempts = await this.attemptRepo.findByPaymentId(clientOrDb, storeId, paymentRow.id);
    const capturedAttempt =
      attempts.find((a) => a.status === "CAPTURED" && a.provider_payment_id) ??
      attempts.find((a) => a.provider_payment_id) ??
      attempts[0];

    const providerPaymentId = capturedAttempt?.provider_payment_id ?? paymentRow.id;

    try {
      const providerResult = await provider.createRefund({
        paymentId: paymentRow.id,
        providerPaymentId,
        amount: refundDTO.amount,
        currency: paymentRow.currency,
        reason: reason.trim(),
        receipt: refundDTO.id.slice(0, 40),
      });

      if (providerResult.status === "succeeded" || providerResult.status === "processed") {
        const succeededRefund = await this.recordRefundSuccess(
          clientOrDb,
          storeId,
          refundDTO.id,
          providerResult.providerRefundId,
        );

        const isFull = (refundedAmount + effectiveAmount) >= capturedAmount;
        const targetPaymentStatus = isFull ? "REFUNDED" : "PARTIALLY_REFUNDED";

        try {
          await this.orderStatusService.updatePaymentStatus(clientOrDb, {
            storeId,
            orderId,
            paymentStatus: targetPaymentStatus,
            authorizedInternalCall: true,
            actorType: actorType ?? "MERCHANT",
            actorId,
            reason: reason.trim(),
          });
        } catch {
          // Non-blocking
        }

        return {
          status: "SUCCEEDED",
          refund: succeededRefund,
          providerRefundId: providerResult.providerRefundId,
          orderPaymentStatus: targetPaymentStatus,
          remainingRefundable: Math.max(0, remainingRefundable - effectiveAmount),
        };
      }

      // Pending provider processing
      return {
        status: "PENDING",
        refund: refundDTO,
        orderPaymentStatus: paymentRow.status as "REFUNDED" | "PARTIALLY_REFUNDED",
        remainingRefundable,
      };
    } catch (err) {
      if (err instanceof RazorpayTimeoutError) {
        await this.recordRefundReconciliation(clientOrDb, storeId, refundDTO.id);
        return {
          status: "REQUIRES_RECONCILIATION",
          refund: refundDTO,
          error: err.message,
          orderPaymentStatus: paymentRow.status as "REFUNDED" | "PARTIALLY_REFUNDED",
          remainingRefundable,
        };
      }

      await this.recordRefundFailure(clientOrDb, storeId, refundDTO.id);
      return {
        status: "FAILED",
        refund: refundDTO,
        error: err instanceof Error ? err.message : String(err),
        orderPaymentStatus: paymentRow.status as "REFUNDED" | "PARTIALLY_REFUNDED",
        remainingRefundable,
      };
    }
  }
}
