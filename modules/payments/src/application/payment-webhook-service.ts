import { createHash } from "node:crypto";
import {
  type Database,
  type DatabaseClient,
  generateUuidV7,
  PaymentWebhookEventRepository,
} from "@shopify-clone/db";
import { runInTransaction } from "./payment-service.js";
import { verifyRazorpayWebhookSignature } from "../webhooks/razorpay-webhook-signature.js";
import {
  type RazorpayWebhookPayload,
  validateRazorpayWebhookPayload,
  type WebhookProcessingOutcome,
} from "../webhooks/razorpay-webhook-types.js";
import { PaymentWebhookProcessor } from "../webhooks/webhook-processor.js";
import {
  WebhookPayloadValidationError,
  WebhookSignatureVerificationError,
} from "../webhooks/webhook-errors.js";
import { PaymentOrderIntegration } from "./payment-order-integration.js";

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
    if (!input.signature || !secret) {
      throw new WebhookSignatureVerificationError(
        "Missing Razorpay webhook signature or webhook secret",
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

    // 3. Determine Stable Provider Event ID
    const providerEventId = this.resolveProviderEventId(
      validatedPayload,
      input.headerEventId,
    );

    // 4. Transactional Deduplication & Processing
    try {
      return await runInTransaction(clientOrDb, async (tx) => {
        // Check existing event record
        const existing = await this.webhookEventRepo.findByProviderEventId(
          tx,
          "razorpay",
          providerEventId,
        );

        let eventRecordId: string;

        if (existing) {
          if (existing.status === "PROCESSED") {
            return {
              status: "DUPLICATE",
              providerEventId,
              eventType: validatedPayload.event,
              paymentId: existing.payment_id ?? undefined,
              storeId: existing.store_id ?? undefined,
              duplicate: true,
              message: "Event has already been processed",
            };
          }

          if (existing.status === "PROCESSING") {
            const claimedAt = existing.processed_at ?? existing.created_at;
            const isAbandoned =
              Date.now() - new Date(claimedAt).getTime() >= this.leaseTimeoutMs;

            if (!isAbandoned) {
              return {
                status: "DUPLICATE",
                providerEventId,
                eventType: validatedPayload.event,
                duplicate: true,
                message: "Concurrent processing in progress for this event",
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
              status: "IGNORED",
              providerEventId,
              eventType: validatedPayload.event,
              paymentId: existing.payment_id ?? undefined,
              storeId: existing.store_id ?? undefined,
              duplicate: true,
              message: "Event was previously ignored",
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
                  status: "DUPLICATE",
                  providerEventId,
                  eventType: validatedPayload.event,
                  duplicate: true,
                  message: "Event has already been processed",
                };
              }
              return {
                status: "DUPLICATE",
                providerEventId,
                eventType: validatedPayload.event,
                duplicate: true,
                message: "Duplicate event detected concurrently",
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

        // 6. Update Webhook Event Status
        const targetStatus =
          outcome.status === "IGNORED" ? "IGNORED" : "PROCESSED";

        await this.webhookEventRepo.markProcessed(tx, eventRecordId, targetStatus, {
          paymentId: outcome.paymentId ?? null,
          storeId: outcome.storeId ?? null,
          errorMessage: outcome.requiresReconciliation ? outcome.message : null,
        });

        // 7. If payment was captured, trigger downstream purchase workflow
        if (outcome.status === "PROCESSED" && outcome.paymentId && outcome.storeId) {
          await this.orderIntegration.completePurchaseWorkflow(tx, {
            storeId: outcome.storeId,
            paymentId: outcome.paymentId,
          }).catch(() => {
            // Downstream error is recoverable; payment capture remains intact
          });
        }

        return outcome;
      });
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

  /**
   * Resolves a stable, collision-resistant event identifier for Razorpay webhooks.
   * Priority:
   * 1. X-Razorpay-Event-Id header (if provided)
   * 2. payload.id (if provided)
   * 3. Collision-resistant deterministic SHA-256 hash
   */
  private resolveProviderEventId(
    payload: RazorpayWebhookPayload,
    headerEventId?: string | null,
  ): string {
    if (headerEventId && headerEventId.trim()) {
      return headerEventId.trim();
    }

    if (payload.id && payload.id.trim()) {
      return payload.id.trim();
    }

    // Collision-resistant deterministic fallback
    const paymentId = payload.payload.payment?.entity.id ?? "";
    const paymentStatus = payload.payload.payment?.entity.status ?? "";
    const hashBasis = `razorpay:${payload.event}:${paymentId}:${paymentStatus}:${payload.created_at}`;
    return createHash("sha256").update(hashBasis).digest("hex");
  }
}
