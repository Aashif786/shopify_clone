import {
  generateUuidV7,
  type Database,
  type DatabaseClient,
  PaymentRepository,
  PaymentAttemptRepository,
  IdempotencyRepository,
} from "@calcart/db";
import { CheckoutRepository } from "@calcart/checkout";
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
import { CheckoutExpiredError } from "@calcart/checkout";
import {
  toPaymentAttemptDTO,
  toPaymentDTO,
  type PaymentAttemptDTO,
  type PaymentDTO,
} from "./dtos.js";
import { toCheckoutDTO, type CheckoutDTO } from "@calcart/checkout";
import { computeRequestHash, runInTransaction } from "./payment-service.js";

export interface InitializePaymentForCheckoutInput {
  storeId: string;
  checkoutId: string;
  idempotencyKey?: string;
  provider?: string;
}

export interface InitializePaymentForCheckoutResult {
  payment: PaymentDTO;
  attempt: PaymentAttemptDTO;
  checkout: CheckoutDTO;
  isExisting: boolean;
}

interface RawCheckoutRow {
  id: string;
  store_id: string;
  cart_id: string;
  customer_id: string | null;
  email: string | null;
  status: string;
  currency: string;
  subtotal: string | number;
  discount_total: string | number;
  tax_total: string | number;
  shipping_total: string | number;
  total: string | number;
  payment_status: string;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export class PaymentCheckoutCoordinator {
  private readonly inFlightOperations = new Map<
    string,
    Promise<InitializePaymentForCheckoutResult>
  >();

  constructor(
    private readonly paymentRepo: PaymentRepository = new PaymentRepository(),
    private readonly attemptRepo: PaymentAttemptRepository = new PaymentAttemptRepository(),
    private readonly idempotencyRepo: IdempotencyRepository = new IdempotencyRepository(),
    private readonly checkoutRepo: CheckoutRepository = new CheckoutRepository(),
  ) {}

  /**
   * Atomically coordinates checkout state transition to PAYMENT_PENDING and local payment initialization.
   */
  async initializePaymentForCheckout(
    clientOrDb: Database | DatabaseClient,
    input: InitializePaymentForCheckoutInput,
  ): Promise<InitializePaymentForCheckoutResult> {
    if (input.idempotencyKey) {
      const cacheKey = `${input.storeId}:payments:checkout-init:${input.idempotencyKey}`;
      const inFlight = this.inFlightOperations.get(cacheKey);
      if (inFlight) {
        return inFlight;
      }

      const executionPromise = this.executeInitialization(clientOrDb, input).finally(() => {
        this.inFlightOperations.delete(cacheKey);
      });

      this.inFlightOperations.set(cacheKey, executionPromise);
      return executionPromise;
    }

    return this.executeInitialization(clientOrDb, input);
  }

  private async executeInitialization(
    clientOrDb: Database | DatabaseClient,
    input: InitializePaymentForCheckoutInput,
  ): Promise<InitializePaymentForCheckoutResult> {
    const requestHash = computeRequestHash({
      checkoutId: input.checkoutId,
      provider: input.provider ?? "razorpay",
    });

    // 1. Optional Idempotency Check & Reservation
    if (input.idempotencyKey) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const reservation = await this.idempotencyRepo.reserve(clientOrDb, {
        id: generateUuidV7(),
        storeId: input.storeId,
        scope: "payments:checkout-init",
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
          return reservation.record.response_body as unknown as InitializePaymentForCheckoutResult;
        }

        // Poll briefly if in-progress across processes
        if (reservation.record.status === "IN_PROGRESS") {
          for (let i = 0; i < 5; i++) {
            await new Promise((resolve) => setTimeout(resolve, 50));
            const check = await this.idempotencyRepo.findByKey(
              clientOrDb,
              input.storeId,
              "payments:checkout-init",
              input.idempotencyKey,
            );
            if (check?.status === "COMPLETED" && check.response_body) {
              return check.response_body as unknown as InitializePaymentForCheckoutResult;
            }
          }
          throw new ConcurrentOperationError(
            `Payment initialization is currently in progress for idempotency key '${input.idempotencyKey}'`,
          );
        }
      }
    }

    try {
      return await runInTransaction(clientOrDb, async (tx) => {
        // 2. Lock Checkout Row with FOR UPDATE for Concurrency Safety
        const checkoutRes = await tx.query<RawCheckoutRow>(
          `SELECT id, store_id, cart_id, customer_id, email, status, currency,
                  subtotal, discount_total, tax_total, shipping_total, total,
                  payment_status, expires_at, created_at, updated_at
           FROM checkouts
           WHERE id = $1
           FOR UPDATE`,
          [input.checkoutId],
        );

        if (checkoutRes.rows.length === 0 || !checkoutRes.rows[0]) {
          const anyStore = await tx.query<{ store_id: string }>(
            `SELECT store_id FROM checkouts WHERE id = $1`,
            [input.checkoutId],
          );
          if (anyStore.rows.length > 0 && anyStore.rows[0]?.store_id !== input.storeId) {
            throw new CrossStorePaymentAccessError(
              `Checkout '${input.checkoutId}' does not belong to store '${input.storeId}'`,
            );
          }
          throw new PaymentNotFoundError(
            `Checkout '${input.checkoutId}' not found in store '${input.storeId}'`,
          );
        }

        const rawCheckout = checkoutRes.rows[0];
        if (rawCheckout.store_id !== input.storeId) {
          throw new CrossStorePaymentAccessError(
            `Checkout '${input.checkoutId}' does not belong to store '${input.storeId}'`,
          );
        }

        // 3. Verify Checkout State Eligibility
        if (
          rawCheckout.status === "COMPLETED" ||
          rawCheckout.status === "CANCELLED" ||
          rawCheckout.status === "EXPIRED" ||
          rawCheckout.status === "FAILED"
        ) {
          throw new InvalidCheckoutStateForPaymentError(
            `Checkout '${input.checkoutId}' is in status '${rawCheckout.status}' and cannot accept payment`,
          );
        }

        if (rawCheckout.expires_at && new Date(rawCheckout.expires_at) <= new Date()) {
          throw new CheckoutExpiredError("Checkout has expired and cannot enter payment");
        }

        const payableTotal = Number(rawCheckout.total);
        if (payableTotal <= 0) {
          throw new InvalidCheckoutStateForPaymentError(
            "Checkout total must be greater than zero to create a payment",
          );
        }

        // 4. Check for Existing Active Payment
        const activePayment = await this.paymentRepo.findActiveByCheckoutId(
          tx,
          input.storeId,
          input.checkoutId,
        );

        if (activePayment) {
          // If already active, check if this is an idempotent retry
          const attempts = await this.attemptRepo.findByPaymentId(
            tx,
            input.storeId,
            activePayment.id,
          );
          const latestAttempt = attempts[attempts.length - 1];

          if (latestAttempt) {
            const checkoutEntity = await this.checkoutRepo.findWithItems(
              tx,
              input.storeId,
              input.checkoutId,
            );
            const result: InitializePaymentForCheckoutResult = {
              payment: toPaymentDTO(activePayment),
              attempt: toPaymentAttemptDTO(latestAttempt),
              checkout: checkoutEntity ? toCheckoutDTO(checkoutEntity) : (rawCheckout as unknown as CheckoutDTO),
              isExisting: true,
            };

            if (input.idempotencyKey) {
              await this.idempotencyRepo.complete(
                tx,
                input.storeId,
                "payments:checkout-init",
                input.idempotencyKey,
                200,
                result as unknown as Record<string, unknown>,
                activePayment.id,
              );
            }

            return result;
          }

          throw new PaymentActiveConflictError(
            `An active payment '${activePayment.id}' already exists for checkout '${input.checkoutId}'`,
          );
        }

        // 5. Transition Checkout OPEN -> PAYMENT_PENDING
        if (rawCheckout.status === "OPEN") {
          await tx.query(
            `UPDATE checkouts
             SET status = 'PAYMENT_PENDING', payment_status = 'PENDING', updated_at = NOW()
             WHERE id = $1 AND store_id = $2`,
            [input.checkoutId, input.storeId],
          );
        }

        // 6. Create Local Payment Record
        const payment = Payment.create({
          storeId: input.storeId,
          checkoutId: input.checkoutId,
          amount: payableTotal,
          currency: rawCheckout.currency,
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

        // 7. Create Immutable Payment Attempt Record
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

        // Load hydrated checkout DTO
        const checkoutEntity = await this.checkoutRepo.findWithItems(
          tx,
          input.storeId,
          input.checkoutId,
        );

        const result: InitializePaymentForCheckoutResult = {
          payment: toPaymentDTO(paymentRow),
          attempt: toPaymentAttemptDTO(attemptRow),
          checkout: checkoutEntity ? toCheckoutDTO(checkoutEntity) : (rawCheckout as unknown as CheckoutDTO),
          isExisting: false,
        };

        // 8. Complete Idempotency Record
        if (input.idempotencyKey) {
          await this.idempotencyRepo.complete(
            tx,
            input.storeId,
            "payments:checkout-init",
            input.idempotencyKey,
            201,
            result as unknown as Record<string, unknown>,
            payment.id,
          );
        }

        return result;
      });
    } catch (error) {
      if (input.idempotencyKey) {
        await this.idempotencyRepo.fail(
          clientOrDb,
          input.storeId,
          "payments:checkout-init",
          input.idempotencyKey,
        ).catch(() => {});
      }
      throw error;
    }
  }
}
