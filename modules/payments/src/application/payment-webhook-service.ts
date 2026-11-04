import { createHash } from "node:crypto";
import {
  type Database,
  type DatabaseClient,
  generateUuidV7,
  PaymentWebhookEventRepository,
} from "@calcart/db";
import { runInTransaction } from "./payment-service.js";
import { verifyRazorpayWebhookSignature } from "../webhooks/razorpay-webhook-signature.js";
import {
  validateRazorpayWebhookPayload,
  type WebhookProcessingOutcome,
} from "../webhooks/razorpay-webhook-types.js";
import { PaymentWebhookProcessor } from "../webhooks/webhook-processor.js";
import {
  WebhookPayloadValidationError,
  WebhookSecretConfigurationError,
  WebhookSignatureVerificationError,
} from "../webhooks/webhook-errors.js";
import { PaymentOrderIntegration } from "./payment-order-integration.js";
import { PURCHASE_WORKFLOW_BLOCKED_PREFIX } from "../domain/payment-errors.js";

export function signedWebhookEventId(
  rawBody: string | Buffer,
  payload: { id?: string | null },
): string {
  const bodyId = payload.id?.trim();
  if (bodyId) {
    return bodyId;
  }
  const body = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
  return createHash("sha256").update(body).digest("hex");
}

export interface ProcessWebhookInput {
  rawBody: string | Buffer;
  signature?: string | null;
  headerEventId?: string | null;
  webhookSecret?: string;
}

export class PaymentWebhookService {
  constructor(
    private readonly defaultWebhookSecret: string = process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
    private readonly processor: PaymentWebhookProcessor = new PaymentWebhookProcessor(),
    private readonly webhookEventRepo: PaymentWebhookEventRepository = new PaymentWebhookEventRepository(),
    private readonly orderIntegration: PaymentOrderIntegration = new PaymentOrderIntegration(),
    private readonly leaseTimeoutMs: number = 60_000,
  ) {}

  /**
   * Processes an incoming Razorpay webhook.
   *
   * 1. Cryptographically verifies HMAC signature over raw body BEFORE touching the database.
   * 2. Parses and runtime-validates untrusted JSON payload.
   * 3. Determines stable provider event identity.
   * 4. Enforces durable deduplication and concurrency control via payment_webhook_events.
   * 5. Orchestrates transactional state updates via PaymentWebhookProcessor.
   */
  async processWebhook(
    clientOrDb: Database | DatabaseClient,
    input: ProcessWebhookInput,
  ): Promise<WebhookProcessingOutcome> {
    const secret = input.webhookSecret ?? this.defaultWebhookSecret;

    // 1. Signature Verification Boundary
    if (!secret || !secret.trim()) {
      throw new WebhookSecretConfigurationError(
        "Payment webhook secret is not configured",
      );
    }

    const lowerSecret = secret.toLowerCase();
    if (
      lowerSecret.includes("placeholder") ||
      lowerSecret.includes("<") ||
      lowerSecret.includes("example")
    ) {
      throw new WebhookSecretConfigurationError(
        "Payment webhook secret is not properly configured. Placeholder credentials cannot be used.",
      );
    }

    if (!input.signature || !input.signature.trim()) {
      throw new WebhookSignatureVerificationError(
        "Missing Razorpay webhook signature",
      );
    }

    const isValidSignature = verifyRazorpayWebhookSignature({
      rawBody: input.rawBody,
      signature: input.signature,
      webhookSecret: secret,
    });

    if (!isValidSignature) {
      throw new WebhookSignatureVerificationError(
        "Invalid Razorpay webhook signature",
      );
    }

    // 2. Parse & Runtime Validate Payload
    let parsedJson: unknown;
    try {
      const bodyStr =
        typeof input.rawBody === "string"
          ? input.rawBody
          : input.rawBody.toString("utf8");
      parsedJson = JSON.parse(bodyStr);
    } catch {
      throw new WebhookPayloadValidationError(
        "Malformed JSON in webhook request body",
      );
    }

    const validatedPayload = validateRazorpayWebhookPayload(parsedJson);

    // 3. Event identity comes from the signed body. The unsigned event-id header is ignored.
    const providerEventId = signedWebhookEventId(input.rawBody, validatedPayload);

    // 4. Transactional Deduplication & Processing
    try {
      const stage = await runInTransaction(clientOrDb, async (tx) => {
        // Check existing event record
        const existing = await this.webhookEventRepo.findByProviderEventId(
          tx,
          "razorpay",
          providerEventId,
        );

        let eventRecordId: string;

        if (existing) {
          if (
            existing.status === "FAILED" &&
            existing.error_message?.startsWith(PURCHASE_WORKFLOW_BLOCKED_PREFIX)
          ) {
            return {
              kind: "done" as const,
              outcome: {
                status: "RECONCILIATION_REQUIRED" as const,
                providerEventId,
                eventType: validatedPayload.event,
                paymentId: existing.payment_id ?? undefined,
                storeId: existing.store_id ?? undefined,
                duplicate: true,
                requiresReconciliation: true,
                message: existing.error_message,
              },
            };
          }

          if (existing.status === "PROCESSED") {
            return {
              kind: "done" as const,
              outcome: {
                status: "DUPLICATE" as const,
                providerEventId,
                eventType: validatedPayload.event,
                paymentId: existing.payment_id ?? undefined,
                storeId: existing.store_id ?? undefined,
                duplicate: true,
                message: "Event has already been processed",
              },
            };
          }

          if (existing.status === "PROCESSING") {
            const claimedAt = existing.processed_at ?? existing.created_at;
            const isAbandoned =
              Date.now() - new Date(claimedAt).getTime() >= this.leaseTimeoutMs;

            if (!isAbandoned) {
              return {
                kind: "done" as const,
                outcome: {
                  status: "DUPLICATE" as const,
                  providerEventId,
                  eventType: validatedPayload.event,
                  duplicate: true,
                  message: "Concurrent processing in progress for this event",
                },
              };
            }

            // Reclaim abandoned event
            eventRecordId = existing.id;
            await tx.query(
              `UPDATE payment_webhook_events SET status = 'PROCESSING', processed_at = NOW() WHERE id = $1`,
              [existing.id],
            );
          } else if (existing.status === "IGNORED") {
            return {
              kind: "done" as const,
              outcome: {
                status: "IGNORED" as const,
                providerEventId,
                eventType: validatedPayload.event,
                paymentId: existing.payment_id ?? undefined,
                storeId: existing.store_id ?? undefined,
                duplicate: true,
                message: "Event was previously ignored",
              },
            };
          } else {
            // Retry previously failed or received event
            eventRecordId = existing.id;
            await tx.query(
              `UPDATE payment_webhook_events SET status = 'PROCESSING', processed_at = NOW() WHERE id = $1`,
              [existing.id],
            );
          }
        } else {
          eventRecordId = generateUuidV7();
          const created = await this.webhookEventRepo.createIfNotExists(tx, {
            id: eventRecordId,
            provider: "razorpay",
            providerEventId,
            eventType: validatedPayload.event,
            signatureVerified: true,
            payload: validatedPayload as unknown as Record<string, unknown>,
            status: "PROCESSING",
            processedAt: new Date(),
          });

          if (!created) {
            // Concurrent race won by another worker
            const raceExisting = await this.webhookEventRepo.findByProviderEventId(
              tx,
              "razorpay",
              providerEventId,
            );
            if (raceExisting) {
              if (raceExisting.status === "PROCESSED" || raceExisting.status === "IGNORED") {
                return {
                  kind: "done" as const,
                  outcome: {
                    status: "DUPLICATE" as const,
                    providerEventId,
                    eventType: validatedPayload.event,
                    duplicate: true,
                    message: "Event has already been processed",
                  },
                };
              }
              return {
                kind: "done" as const,
                outcome: {
                  status: "DUPLICATE" as const,
                  providerEventId,
                  eventType: validatedPayload.event,
                  duplicate: true,
                  message: "Duplicate event detected concurrently",
                },
              };
            }
          }
        }

        // 5. Execute Domain Processing
        const outcome = await this.processor.process(
          tx,
          validatedPayload,
          providerEventId,
        );

        const needsOrder =
          validatedPayload.event === "payment.captured" &&
          (outcome.status === "PROCESSED" || outcome.status === "IGNORED") &&
          Boolean(outcome.paymentId && outcome.storeId);

        if (!needsOrder) {
          const targetStatus = outcome.status === "IGNORED" ? "IGNORED" : "PROCESSED";
          await this.webhookEventRepo.markProcessed(tx, eventRecordId, targetStatus, {
            paymentId: outcome.paymentId ?? null,
            storeId: outcome.storeId ?? null,
            errorMessage: outcome.requiresReconciliation ? outcome.message : null,
          });
          return { kind: "done" as const, outcome };
        }

        return { kind: "finalize" as const, outcome, eventRecordId };
      });

      if (stage.kind === "done") {
        return stage.outcome;
      }

      const finalized = await this.orderIntegration.finalizeCapturedPurchase(clientOrDb, {
        storeId: stage.outcome.storeId ?? "",
        paymentId: stage.outcome.paymentId ?? "",
      });

      if (finalized.status === "blocked") {
        const message = `${PURCHASE_WORKFLOW_BLOCKED_PREFIX} ${finalized.reason}`;
        await runInTransaction(clientOrDb, async (tx) => {
          await this.webhookEventRepo.markProcessed(tx, stage.eventRecordId, "FAILED", {
            paymentId: stage.outcome.paymentId ?? null,
            storeId: stage.outcome.storeId ?? null,
            errorMessage: message,
          });
        });
        return {
          status: "RECONCILIATION_REQUIRED",
          providerEventId,
          eventType: validatedPayload.event,
          paymentId: stage.outcome.paymentId,
          attemptId: stage.outcome.attemptId,
          storeId: stage.outcome.storeId,
          requiresReconciliation: true,
          message,
        };
      }

      const targetStatus = stage.outcome.status === "IGNORED" ? "IGNORED" : "PROCESSED";
      await runInTransaction(clientOrDb, async (tx) => {
        await this.webhookEventRepo.markProcessed(tx, stage.eventRecordId, targetStatus, {
          paymentId: stage.outcome.paymentId ?? null,
          storeId: stage.outcome.storeId ?? null,
        });
      });

      return stage.outcome;
    } catch (err) {
      // Record failure for audit and retryability outside the rolled back transaction
      await runInTransaction(clientOrDb, async (errTx) => {
        const existing = await this.webhookEventRepo.findByProviderEventId(
          errTx,
          "razorpay",
          providerEventId,
        );
        const errMsg = err instanceof Error ? err.message : "Webhook processing error";
        if (existing) {
          await this.webhookEventRepo.markProcessed(errTx, existing.id, "FAILED", {
            errorMessage: errMsg,
          });
        } else {
          await this.webhookEventRepo.create(errTx, {
            id: generateUuidV7(),
            provider: "razorpay",
            providerEventId,
            eventType: validatedPayload.event,
            signatureVerified: true,
            payload: validatedPayload as unknown as Record<string, unknown>,
            status: "FAILED",
            errorMessage: errMsg,
          });
        }
      }).catch(() => {});
      throw err;
    }
  }

}
