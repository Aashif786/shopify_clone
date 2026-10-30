import type { DatabaseClient } from "@calcart/db";
import {
  PaymentAttemptRepository,
  PaymentRepository,
  RefundRepository,
} from "@calcart/db";
import { RefundService } from "../application/refund-service.js";
import { Payment } from "../domain/payment.js";
import { PaymentAttempt } from "../domain/payment-attempt.js";
import {
  type RazorpayWebhookPayload,
  SUPPORTED_PAYMENT_WEBHOOK_EVENTS,
  type SupportedPaymentWebhookEvent,
  type WebhookProcessingOutcome,
} from "./razorpay-webhook-types.js";
import { WebhookEntityNotFoundError } from "./webhook-errors.js";

export class PaymentWebhookProcessor {
  constructor(
    private readonly paymentRepo: PaymentRepository = new PaymentRepository(),
    private readonly attemptRepo: PaymentAttemptRepository = new PaymentAttemptRepository(),
    private readonly refundRepo: RefundRepository = new RefundRepository(),
    private readonly refundService: RefundService = new RefundService(),
  ) {}

  /**
   * Processes a validated Razorpay webhook event within an open database transaction.
   *
   * Enforces:
   * 1. Correlation to local payment attempt and payment via provider_payment_id, provider_order_id, or notes.
   * 2. Tenant isolation and row locking (SELECT ... FOR UPDATE).
   * 3. Amount and currency invariants (transitions to REQUIRES_RECONCILIATION on mismatch).
   * 4. State transitions without regressing terminal states (stale event protection).
   * 5. No external network calls within the transaction.
   */
  async process(
    client: DatabaseClient,
    payload: RazorpayWebhookPayload,
    providerEventId: string,
  ): Promise<WebhookProcessingOutcome> {
    const eventType = payload.event;

    // 1. Check if event is supported
    if (!SUPPORTED_PAYMENT_WEBHOOK_EVENTS.includes(eventType as SupportedPaymentWebhookEvent)) {
      return {
        status: "IGNORED",
        providerEventId,
        eventType,
        message: `Unsupported event type: ${eventType}`,
      };
    }

    // 1.5 Handle Refund Reconciliation Events
    if (eventType === "refund.processed" || eventType === "refund.failed") {
      const refundEntity = payload.payload.refund?.entity;
      if (!refundEntity) {
        return {
          status: "IGNORED",
          providerEventId,
          eventType,
          message: "No refund entity in webhook payload",
        };
      }

      // Locate refund record
      let refundRow = await this.refundRepo.findByProviderRefundId(
        client,
        "razorpay",
        refundEntity.id,
      );

      if (!refundRow && refundEntity.receipt) {
        const candidate = await client.query<{ id: string; store_id: string; payment_id: string; status: string; amount: string }>(
          `SELECT * FROM refunds WHERE id = $1 LIMIT 1`,
          [refundEntity.receipt],
        );
        refundRow = (candidate.rows[0] as unknown as typeof refundRow) ?? null;
      }

      if (!refundRow && refundEntity.notes?.refund_id) {
        const candidate = await client.query<{ id: string; store_id: string; payment_id: string; status: string; amount: string }>(
          `SELECT * FROM refunds WHERE id = $1 LIMIT 1`,
          [String(refundEntity.notes.refund_id)],
        );
        refundRow = (candidate.rows[0] as unknown as typeof refundRow) ?? null;
      }

      if (!refundRow && refundEntity.payment_id) {
        const attempt = await this.attemptRepo.findByProviderPaymentId(
          client,
          "razorpay",
          refundEntity.payment_id,
        );
        if (attempt) {
          const matchingRefunds = await this.refundRepo.findByPaymentId(
            client,
            attempt.store_id,
            attempt.payment_id,
          );
          refundRow =
            matchingRefunds.find(
              (r) =>
                (r.status === "PENDING" ||
                  r.status === "PROCESSING" ||
                  r.status === "REQUIRES_RECONCILIATION") &&
                Number(r.amount) === refundEntity.amount,
            ) ?? null;
        }
      }

      if (!refundRow) {
        throw new WebhookEntityNotFoundError(
          `No local refund record found for Razorpay refund '${refundEntity.id}' (payment '${refundEntity.payment_id}')`,
        );
      }

      const storeId = refundRow.store_id;
      const paymentId = refundRow.payment_id;

      if (eventType === "refund.processed") {
        if (refundRow.status === "SUCCEEDED") {
          return {
            status: "IGNORED",
            providerEventId,
            eventType,
            paymentId,
            storeId,
            message: "Refund is already marked as SUCCEEDED",
          };
        }

        await this.refundService.recordRefundSuccess(
          client,
          storeId,
          refundRow.id,
          refundEntity.id,
        );

        return {
          status: "PROCESSED",
          providerEventId,
          eventType,
          paymentId,
          storeId,
        };
      }

      if (eventType === "refund.failed") {
        if (refundRow.status === "FAILED") {
          return {
            status: "IGNORED",
            providerEventId,
            eventType,
            paymentId,
            storeId,
            message: "Refund is already marked as FAILED",
          };
        }

        await this.refundService.recordRefundFailure(
          client,
          storeId,
          refundRow.id,
        );

        return {
          status: "PROCESSED",
          providerEventId,
          eventType,
          paymentId,
          storeId,
        };
      }
    }

    const paymentEntity = payload.payload.payment?.entity;
    if (!paymentEntity) {
      return {
        status: "IGNORED",
        providerEventId,
        eventType,
        message: "No payment entity in webhook payload",
      };
    }

    // 2. Correlate local payment attempt
    let attemptRow = await this.attemptRepo.findByProviderPaymentId(
      client,
      "razorpay",
      paymentEntity.id,
    );

    if (!attemptRow && paymentEntity.order_id) {
      const attempts = await this.attemptRepo.findByProviderOrderId(
        client,
        "razorpay",
        paymentEntity.order_id,
      );
      if (attempts.length > 0) {
        attemptRow = attempts[attempts.length - 1] ?? null;
      }
    }

    if (!attemptRow && paymentEntity.notes) {
      const notesAttemptId = paymentEntity.notes.attempt_id;
      const notesStoreId = paymentEntity.notes.store_id;
      if (typeof notesAttemptId === "string" && typeof notesStoreId === "string") {
        attemptRow = await this.attemptRepo.findById(client, notesStoreId, notesAttemptId);
      }
    }

    if (!attemptRow) {
      throw new WebhookEntityNotFoundError(
        `No local payment attempt found for Razorpay payment '${paymentEntity.id}' or order '${paymentEntity.order_id ?? ""}'`,
      );
    }

    const storeId = attemptRow.store_id;
    const paymentId = attemptRow.payment_id;

    // 3. Lock and load payment row (SELECT ... FOR UPDATE)
    const lockedPaymentRow = await this.paymentRepo.findByIdForUpdate(
      client,
      storeId,
      paymentId,
    );

    if (!lockedPaymentRow) {
      throw new WebhookEntityNotFoundError(
        `Payment '${paymentId}' not found for store '${storeId}'`,
      );
    }

    const payment = Payment.reconstitute({
      id: lockedPaymentRow.id,
      storeId: lockedPaymentRow.store_id,
      checkoutId: lockedPaymentRow.checkout_id,
      orderId: lockedPaymentRow.order_id,
      amount: Number(lockedPaymentRow.amount),
      currency: lockedPaymentRow.currency,
      status: lockedPaymentRow.status,
      provider: lockedPaymentRow.provider,
      capturedAmount: Number(lockedPaymentRow.captured_amount),
      refundedAmount: Number(lockedPaymentRow.refunded_amount),
      createdAt: new Date(lockedPaymentRow.created_at),
      updatedAt: new Date(lockedPaymentRow.updated_at),
    });

    const attempt = PaymentAttempt.reconstitute({
      id: attemptRow.id,
      paymentId: attemptRow.payment_id,
      storeId: attemptRow.store_id,
      attemptNumber: attemptRow.attempt_number,
      provider: attemptRow.provider,
      providerOrderId: attemptRow.provider_order_id,
      providerPaymentId: attemptRow.provider_payment_id,
      providerSignature: attemptRow.provider_signature,
      amount: Number(attemptRow.amount),
      currency: attemptRow.currency,
      status: attemptRow.status,
      failureCode: attemptRow.failure_code,
      failureMessage: attemptRow.failure_message,
      idempotencyKey: attemptRow.idempotency_key,
      createdAt: new Date(attemptRow.created_at),
      updatedAt: new Date(attemptRow.updated_at),
    });

    // If payment is in CREATED status, transition to PENDING to enable subsequent transitions
    if (payment.status === "CREATED") {
      payment.markPending();
    }

    // 4. Validate Amount and Currency Invariants
    const payloadAmount = paymentEntity.amount;
    const payloadCurrency = paymentEntity.currency.toUpperCase();

    if (
      payloadAmount !== attempt.amount ||
      payloadCurrency !== attempt.currency.toUpperCase()
    ) {
      // Ambiguous outcome: mark REQUIRES_RECONCILIATION
      payment.markRequiresReconciliation();
      attempt.markRequiresReconciliation();

      await this.paymentRepo.updateStatus(
        client,
        storeId,
        payment.id,
        payment.status,
      );
      await this.attemptRepo.updateStatus(
        client,
        storeId,
        attempt.id,
        attempt.status,
        {
          providerPaymentId: paymentEntity.id,
          failureCode: "PAYMENT_MISMATCH",
          failureMessage: `Amount or currency mismatch: gateway ${payloadAmount} ${payloadCurrency} vs attempt ${attempt.amount} ${attempt.currency}`,
        },
      );

      return {
        status: "RECONCILIATION_REQUIRED",
        providerEventId,
        eventType,
        paymentId: payment.id,
        attemptId: attempt.id,
        storeId,
        requiresReconciliation: true,
        message: "Monetary amount or currency mismatch detected",
      };
    }

    // 5. Handle Supported Events with Stale Event Protection
    if (eventType === "payment.captured") {
      if (payment.isCaptured() || payment.status === "REFUNDED") {
        // Stale duplicate/out-of-order event: already captured/refunded
        return {
          status: "IGNORED",
          providerEventId,
          eventType,
          paymentId: payment.id,
          attemptId: attempt.id,
          storeId,
          message: "Payment is already captured or refunded",
        };
      }

      payment.markCaptured(payloadAmount);
      attempt.markCaptured(paymentEntity.id);

      await this.paymentRepo.updateStatus(
        client,
        storeId,
        payment.id,
        payment.status,
        { capturedAmount: payment.capturedAmount },
      );
      await this.attemptRepo.updateStatus(
        client,
        storeId,
        attempt.id,
        attempt.status,
        { providerPaymentId: paymentEntity.id },
      );

      return {
        status: "PROCESSED",
        providerEventId,
        eventType,
        paymentId: payment.id,
        attemptId: attempt.id,
        storeId,
      };
    }

    if (eventType === "payment.authorized") {
      if (payment.isCaptured() || payment.status === "REFUNDED") {
        // Stale event: do not regress captured/refunded payment
        return {
          status: "IGNORED",
          providerEventId,
          eventType,
          paymentId: payment.id,
          attemptId: attempt.id,
          storeId,
          message: "Payment is already captured; ignoring stale authorization event",
        };
      }

      if (payment.status === "CREATED" || payment.status === "PENDING") {
        payment.markAuthorized();
        attempt.markAuthorized(paymentEntity.id);

        await this.paymentRepo.updateStatus(
          client,
          storeId,
          payment.id,
          payment.status,
        );
        await this.attemptRepo.updateStatus(
          client,
          storeId,
          attempt.id,
          attempt.status,
          { providerPaymentId: paymentEntity.id },
        );

        return {
          status: "PROCESSED",
          providerEventId,
          eventType,
          paymentId: payment.id,
          attemptId: attempt.id,
          storeId,
        };
      }

      return {
        status: "IGNORED",
        providerEventId,
        eventType,
        paymentId: payment.id,
        attemptId: attempt.id,
        storeId,
        message: `Authorization ignored for current payment state '${payment.status}'`,
      };
    }

    if (eventType === "payment.failed") {
      if (payment.isCaptured() || payment.status === "REFUNDED") {
        // Section 32 Invariant: A subsequent payment.failed event cannot move CAPTURED backward to FAILED
        return {
          status: "IGNORED",
          providerEventId,
          eventType,
          paymentId: payment.id,
          attemptId: attempt.id,
          storeId,
          message: "Payment is already captured; cannot regress to failed",
        };
      }

      payment.markFailed();
      attempt.markFailed(
        paymentEntity.error_code ?? undefined,
        paymentEntity.error_description ?? undefined,
      );

      await this.paymentRepo.updateStatus(
        client,
        storeId,
        payment.id,
        payment.status,
      );
      await this.attemptRepo.updateStatus(
        client,
        storeId,
        attempt.id,
        attempt.status,
        {
          providerPaymentId: paymentEntity.id,
          failureCode: paymentEntity.error_code,
          failureMessage: paymentEntity.error_description,
        },
      );

      return {
        status: "PROCESSED",
        providerEventId,
        eventType,
        paymentId: payment.id,
        attemptId: attempt.id,
        storeId,
      };
    }

    return {
      status: "IGNORED",
      providerEventId,
      eventType,
      paymentId: payment.id,
      attemptId: attempt.id,
      storeId,
      message: `Event '${eventType}' not applicable for status updates`,
    };
  }
}
