import {
  type Database,
  type DatabaseClient,
  PaymentAttemptRepository,
  PaymentRepository,
} from "@shopify-clone/db";
import { PaymentAttempt } from "../domain/payment-attempt.js";
import {
  CrossStorePaymentAccessError,
  InvalidPaymentStateTransitionError,
  PaymentAttemptNotFoundError,
  PaymentNotFoundError,
} from "../domain/payment-errors.js";
import type { PaymentAttemptStatus } from "../domain/payment-state.js";
import {
  toPaymentAttemptDTO,
  type CreatePaymentAttemptInput,
  type PaymentAttemptDTO,
} from "./dtos.js";
import { runInTransaction } from "./payment-service.js";

export class PaymentAttemptService {
  constructor(
    private readonly attemptRepo: PaymentAttemptRepository = new PaymentAttemptRepository(),
    private readonly paymentRepo: PaymentRepository = new PaymentRepository(),
  ) {}

  async createAttempt(
    clientOrDb: Database | DatabaseClient,
    input: CreatePaymentAttemptInput,
  ): Promise<PaymentAttemptDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const paymentRow = await this.paymentRepo.findById(tx, input.storeId, input.paymentId);
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

      if (
        paymentRow.status === "FAILED" ||
        paymentRow.status === "CANCELLED" ||
        paymentRow.status === "REFUNDED"
      ) {
        throw new InvalidPaymentStateTransitionError(
          paymentRow.status,
          "INITIATED",
          { reason: "Cannot add a new attempt to a terminal payment" },
        );
      }

      const latestNumber = await this.attemptRepo.getLatestAttemptNumber(tx, input.paymentId);
      const nextNumber = latestNumber + 1;

      const attempt = PaymentAttempt.create({
        paymentId: input.paymentId,
        storeId: input.storeId,
        attemptNumber: nextNumber,
        amount: Number(paymentRow.amount),
        currency: paymentRow.currency,
        provider: input.provider ?? paymentRow.provider,
        idempotencyKey: input.idempotencyKey,
      });

      const row = await this.attemptRepo.create(tx, {
        id: attempt.id,
        paymentId: attempt.paymentId,
        storeId: attempt.storeId,
        attemptNumber: attempt.attemptNumber,
        amount: attempt.amount,
        currency: attempt.currency,
        provider: attempt.provider,
        status: attempt.status,
        idempotencyKey: attempt.idempotencyKey,
      });

      return toPaymentAttemptDTO(row);
    });
  }

  async getAttempts(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    paymentId: string,
  ): Promise<PaymentAttemptDTO[]> {
    const payment = await this.paymentRepo.findById(clientOrDb, storeId, paymentId);
    if (!payment) {
      throw new PaymentNotFoundError(`Payment '${paymentId}' not found in store '${storeId}'`);
    }

    const rows = await this.attemptRepo.findByPaymentId(clientOrDb, storeId, paymentId);
    return rows.map(toPaymentAttemptDTO);
  }

  async updateAttemptStatus(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    attemptId: string,
    targetStatus: PaymentAttemptStatus,
    patch?: {
      providerPaymentId?: string | null;
      providerSignature?: string | null;
      providerOrderId?: string | null;
      failureCode?: string | null;
      failureMessage?: string | null;
    },
  ): Promise<PaymentAttemptDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const row = await this.attemptRepo.findById(tx, storeId, attemptId);
      if (!row) {
        throw new PaymentAttemptNotFoundError(
          `Payment attempt '${attemptId}' not found in store '${storeId}'`,
        );
      }

      const attempt = PaymentAttempt.reconstitute({
        id: row.id,
        paymentId: row.payment_id,
        storeId: row.store_id,
        attemptNumber: row.attempt_number,
        provider: row.provider,
        providerOrderId: row.provider_order_id,
        providerPaymentId: row.provider_payment_id,
        providerSignature: row.provider_signature,
        amount: Number(row.amount),
        currency: row.currency,
        status: row.status,
        failureCode: row.failure_code,
        failureMessage: row.failure_message,
        idempotencyKey: row.idempotency_key,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      });

      switch (targetStatus) {
        case "PENDING":
          attempt.markPending(patch?.providerOrderId ?? undefined);
          break;
        case "AUTHORIZED":
          attempt.markAuthorized(patch?.providerPaymentId ?? undefined);
          break;
        case "CAPTURED":
          attempt.markCaptured(
            patch?.providerPaymentId ?? undefined,
            patch?.providerSignature ?? undefined,
          );
          break;
        case "FAILED":
          attempt.markFailed(
            patch?.failureCode ?? undefined,
            patch?.failureMessage ?? undefined,
          );
          break;
        case "CANCELLED":
          attempt.markCancelled();
          break;
        case "REQUIRES_RECONCILIATION":
          attempt.markRequiresReconciliation();
          break;
        default:
          break;
      }

      const updatedRow = await this.attemptRepo.updateStatus(
        tx,
        storeId,
        attemptId,
        attempt.status,
        {
          providerPaymentId: attempt.providerPaymentId,
          providerSignature: attempt.providerSignature,
          providerOrderId: attempt.providerOrderId,
          failureCode: attempt.failureCode,
          failureMessage: attempt.failureMessage,
        },
      );

      if (!updatedRow) {
        throw new PaymentAttemptNotFoundError(
          `Payment attempt '${attemptId}' could not be updated`,
        );
      }

      return toPaymentAttemptDTO(updatedRow);
    });
  }
}
