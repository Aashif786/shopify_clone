import { createHash } from "node:crypto";
import {
  generateUuidV7,
  type Database,
  type DatabaseClient,
  PaymentRepository,
  PaymentAttemptRepository,
  IdempotencyRepository,
} from "@calcart/db";
import { Payment } from "../domain/payment.js";
import { PaymentAttempt } from "../domain/payment-attempt.js";
import {
  ConcurrentOperationError,
  CrossStorePaymentAccessError,
  InvalidCheckoutStateForPaymentError,
  PaymentActiveConflictError,
  PaymentIdempotencyConflictError,
  PaymentNotFoundError,
} from "../domain/payment-errors.js";
import type { PaymentStatus } from "../domain/payment-state.js";
import {
  toPaymentAttemptDTO,
  toPaymentDTO,
  type CreatePaymentInput,
  type PaymentCreationResultDTO,
  type PaymentDTO,
} from "./dtos.js";

function isDatabase(client: Database | DatabaseClient): client is Database {
  return "withTransaction" in client;
}

export async function runInTransaction<T>(
  clientOrDb: Database | DatabaseClient,
  fn: (tx: DatabaseClient) => Promise<T>,
): Promise<T> {
  if (isDatabase(clientOrDb)) {
    return clientOrDb.withTransaction(fn);
  }
  return fn(clientOrDb);
}

function canonicalStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map((item) => canonicalStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const entries = keys.map(
    (key) => `${JSON.stringify(key)}:${canonicalStringify((obj as Record<string, unknown>)[key])}`,
  );
  return `{${entries.join(",")}}`;
}

export function computeRequestHash(payload: unknown): string {
  const canonical = canonicalStringify(payload);
  return createHash("sha256").update(canonical).digest("hex");
}

interface CheckoutSummaryRow {
  id: string;
  store_id: string;
  total: string | number;
  currency: string;
  status: string;
  payment_status: string;
  expires_at: Date | null;
}

export class PaymentService {
  constructor(
    private readonly paymentRepo: PaymentRepository = new PaymentRepository(),
    private readonly attemptRepo: PaymentAttemptRepository = new PaymentAttemptRepository(),
    private readonly idempotencyRepo: IdempotencyRepository = new IdempotencyRepository(),
  ) {}

  async createPayment(
    clientOrDb: Database | DatabaseClient,
    input: CreatePaymentInput,
  ): Promise<PaymentCreationResultDTO> {
    const requestHash = computeRequestHash({
      checkoutId: input.checkoutId,
      provider: input.provider ?? "razorpay",
    });

    // 1. Idempotency Check & Atomic Reservation
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24-hour TTL
    const reservation = await this.idempotencyRepo.reserve(clientOrDb, {
      id: generateUuidV7(),
      storeId: input.storeId,
      scope: "payments:create",
      idempotencyKey: input.idempotencyKey,
      requestHash,
      expiresAt,
    });

    if (!reservation.reserved) {
      if (reservation.record.request_hash !== requestHash) {
        throw new PaymentIdempotencyConflictError(
          `Idempotency key '${input.idempotencyKey}' has already been used with different parameters`,
        );
      }
      if (reservation.record.status === "COMPLETED" && reservation.record.response_body) {
        return reservation.record.response_body as unknown as PaymentCreationResultDTO;
      }
      if (reservation.record.status === "IN_PROGRESS") {
        throw new ConcurrentOperationError(
          `Payment creation is currently in progress for idempotency key '${input.idempotencyKey}'`,
        );
      }
    }

    try {
      return await runInTransaction(clientOrDb, async (tx) => {
        // 2. Validate Checkout in Database
        const checkoutRes = await tx.query<CheckoutSummaryRow>(
          `SELECT id, store_id, total, currency, status, payment_status, expires_at
           FROM checkouts
           WHERE id = $1`,
          [input.checkoutId],
        );

        if (checkoutRes.rows.length === 0 || !checkoutRes.rows[0]) {
          throw new PaymentNotFoundError(`Checkout '${input.checkoutId}' not found`);
        }

        const checkout = checkoutRes.rows[0];
        if (checkout.store_id !== input.storeId) {
          throw new CrossStorePaymentAccessError(
            `Checkout '${input.checkoutId}' does not belong to store '${input.storeId}'`,
          );
        }

        // Check if checkout is eligible for payment
        if (
          checkout.status === "COMPLETED" ||
          checkout.status === "CANCELLED" ||
          checkout.status === "EXPIRED" ||
          checkout.status === "FAILED"
        ) {
          throw new InvalidCheckoutStateForPaymentError(
            `Checkout '${input.checkoutId}' is in status '${checkout.status}' and cannot accept payment`,
          );
        }

        // 3. Ensure no active payment exists for this checkout
        const activePayment = await this.paymentRepo.findActiveByCheckoutId(
          tx,
          input.storeId,
          input.checkoutId,
        );
        if (activePayment) {
          throw new PaymentActiveConflictError(
            `An active payment '${activePayment.id}' already exists for checkout '${input.checkoutId}'`,
          );
        }

        const payableTotal = Number(checkout.total);
        if (payableTotal <= 0) {
          throw new InvalidCheckoutStateForPaymentError(
            "Checkout total must be greater than zero to create a payment",
          );
        }

        // If checkout is OPEN, transition it to PAYMENT_PENDING
        if (checkout.status === "OPEN") {
          await tx.query(
            `UPDATE checkouts
             SET status = 'PAYMENT_PENDING', payment_status = 'PENDING', updated_at = NOW()
             WHERE id = $1 AND store_id = $2`,
            [input.checkoutId, input.storeId],
          );
        }

        // 4. Create Payment Aggregate
        const payment = Payment.create({
          storeId: input.storeId,
          checkoutId: input.checkoutId,
          amount: payableTotal,
          currency: checkout.currency,
          provider: input.provider ?? "razorpay",
        });

        const paymentRow = await this.paymentRepo.create(tx, {
          id: payment.id,
          storeId: payment.storeId,
          checkoutId: payment.checkoutId,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          provider: payment.provider,
          capturedAmount: payment.capturedAmount,
          refundedAmount: payment.refundedAmount,
        });

        // 5. Create Payment Attempt (immutable snapshot of amount and currency)
        const attempt = PaymentAttempt.create({
          paymentId: payment.id,
          storeId: input.storeId,
          attemptNumber: 1,
          amount: payment.amount,
          currency: payment.currency,
          provider: payment.provider,
          idempotencyKey: input.idempotencyKey,
        });

        const attemptRow = await this.attemptRepo.create(tx, {
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

        const result: PaymentCreationResultDTO = {
          payment: toPaymentDTO(paymentRow),
          attempt: toPaymentAttemptDTO(attemptRow),
        };

        // 6. Complete Idempotency Record
        await this.idempotencyRepo.complete(
          tx,
          input.storeId,
          "payments:create",
          input.idempotencyKey,
          201,
          result as unknown as Record<string, unknown>,
          payment.id,
        );

        return result;
      });
    } catch (error) {
      // Mark idempotency failed so callers can retry cleanly if wanted
      try {
        await this.idempotencyRepo.fail(
          clientOrDb,
          input.storeId,
          "payments:create",
          input.idempotencyKey,
        );
      } catch {
        // Suppress failure marking error to preserve original exception
      }
      throw error;
    }
  }

  async getPayment(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    paymentId: string,
  ): Promise<PaymentDTO> {
    const row = await this.paymentRepo.findById(clientOrDb, storeId, paymentId);
    if (!row) {
      // Check if it belongs to another store for clear diagnostic error
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

    return toPaymentDTO(row);
  }

  async getActivePaymentByCheckoutId(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    checkoutId: string,
  ): Promise<PaymentDTO | null> {
    const row = await this.paymentRepo.findActiveByCheckoutId(clientOrDb, storeId, checkoutId);
    return row ? toPaymentDTO(row) : null;
  }

  async getPaymentsByCheckoutId(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    checkoutId: string,
  ): Promise<PaymentDTO[]> {
    const rows = await this.paymentRepo.findByCheckoutId(clientOrDb, storeId, checkoutId);
    return rows.map(toPaymentDTO);
  }

  async updatePaymentStatus(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    paymentId: string,
    targetStatus: PaymentStatus,
    patch?: {
      capturedAmount?: number;
      orderId?: string | null;
    },
  ): Promise<PaymentDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const row = await this.paymentRepo.findByIdForUpdate(tx, storeId, paymentId);
      if (!row) {
        throw new PaymentNotFoundError(`Payment '${paymentId}' not found in store '${storeId}'`);
      }

      const payment = Payment.reconstitute({
        id: row.id,
        storeId: row.store_id,
        checkoutId: row.checkout_id,
        orderId: row.order_id,
        amount: Number(row.amount),
        currency: row.currency,
        status: row.status,
        provider: row.provider,
        capturedAmount: Number(row.captured_amount),
        refundedAmount: Number(row.refunded_amount),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      });

      switch (targetStatus) {
        case "PENDING":
          payment.markPending();
          break;
        case "PROCESSING":
          payment.markProcessing();
          break;
        case "AUTHORIZED":
          payment.markAuthorized();
          break;
        case "CAPTURED":
          payment.markCaptured(patch?.capturedAmount);
          break;
        case "FAILED":
          payment.markFailed();
          break;
        case "CANCELLED":
          payment.markCancelled();
          break;
        case "REQUIRES_RECONCILIATION":
          payment.markRequiresReconciliation();
          break;
        default:
          break;
      }

      if (patch?.orderId !== undefined && patch.orderId !== null) {
        payment.setOrderId(patch.orderId);
      }

      const updatedRow = await this.paymentRepo.updateStatus(
        tx,
        storeId,
        paymentId,
        payment.status,
        {
          capturedAmount: payment.capturedAmount,
          orderId: payment.orderId,
        },
      );

      if (!updatedRow) {
        throw new PaymentNotFoundError(`Payment '${paymentId}' could not be updated`);
      }

      return toPaymentDTO(updatedRow);
    });
  }
}
