import {
  generateUuidV7,
  type Database,
  type DatabaseClient,
  PaymentRepository,
  RefundRepository,
  IdempotencyRepository,
} from "@shopify-clone/db";
import { Payment } from "../domain/payment.js";
import {
  ConcurrentOperationError,
  CrossStorePaymentAccessError,
  InvalidMonetaryAmountError,
  PaymentIdempotencyConflictError,
  PaymentNotFoundError,
  PaymentNotRefundableError,
  RefundExceedsCapturedAmountError,
  RefundNotFoundError,
} from "../domain/payment-errors.js";
import {
  toRefundDTO,
  type CreateRefundInput,
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

        // 4. Verify remaining refundable balance under row lock
        const remainingRefundable = payment.getRemainingRefundableAmount();
        if (input.amount > remainingRefundable) {
          throw new RefundExceedsCapturedAmountError(
            `Requested refund amount (${input.amount}) exceeds remaining refundable balance (${remainingRefundable})`,
          );
        }

        // 5. Check if refund with same idempotency key already exists in database
        const existingRefund = await this.refundRepo.findByIdempotencyKey(
          tx,
          input.storeId,
          input.idempotencyKey,
        );
        if (existingRefund) {
          return toRefundDTO(existingRefund);
        }

        // 6. Verify and resolve valid order reference (INT-02 & INT-03)
        const effectiveOrderId = input.orderId ?? payment.orderId;
        if (!effectiveOrderId) {
          throw new PaymentNotRefundableError(
            `Payment '${input.paymentId}' is not associated with an order and cannot be refunded`,
          );
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
}
