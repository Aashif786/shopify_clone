import {
  type Database,
  type DatabaseClient,
  PaymentWebhookEventRepository,
} from "@shopify-clone/db";
import { PaymentWebhookProcessor } from "./webhook-processor.js";
import { PaymentOrderIntegration } from "../application/payment-order-integration.js";
import type {
  RazorpayWebhookPayload,
  WebhookProcessingOutcome,
} from "./razorpay-webhook-types.js";
import { runInTransaction } from "../application/payment-service.js";

export interface RecoverWebhooksOptions {
  leaseTimeoutMs?: number;
  limit?: number;
  provider?: string;
}

export interface WebhookRecoveryItemResult {
  id: string;
  providerEventId: string;
  status: "PROCESSED" | "FAILED" | "IGNORED";
  errorMessage?: string;
  paymentId?: string;
}

export interface WebhookRecoveryResult {
  recoveredCount: number;
  failedCount: number;
  events: WebhookRecoveryItemResult[];
}

export class WebhookRecoveryService {
  constructor(
    private readonly webhookEventRepo: PaymentWebhookEventRepository = new PaymentWebhookEventRepository(),
    private readonly processor: PaymentWebhookProcessor = new PaymentWebhookProcessor(),
    private readonly orderIntegration: PaymentOrderIntegration = new PaymentOrderIntegration(),
  ) {}

  /**
   * Scans for webhook events abandoned in PROCESSING status where the processing lease
   * has expired (processed_at/created_at older than leaseTimeoutMs).
   *
   * Reclaims the events safely using row-level locking (SELECT ... FOR UPDATE), re-applies
   * domain effects via PaymentWebhookProcessor, and triggers order creation/checkout completion
   * if the payment was captured.
   */
  async recoverAbandonedEvents(
    clientOrDb: Database | DatabaseClient,
    options?: RecoverWebhooksOptions,
  ): Promise<WebhookRecoveryResult> {
    const leaseTimeoutMs = options?.leaseTimeoutMs ?? 60_000;
    const limit = options?.limit ?? 50;
    const cutoff = new Date(Date.now() - leaseTimeoutMs);

    const abandonedRows = await this.webhookEventRepo.findAbandonedProcessing(
      clientOrDb,
      cutoff,
      limit,
    );

    const results: WebhookRecoveryItemResult[] = [];
    let recoveredCount = 0;
    let failedCount = 0;

    for (const row of abandonedRows) {
      try {
        const itemResult = await runInTransaction(clientOrDb, async (tx) => {
          // Lock event row with FOR UPDATE
          const lockedRes = await tx.query<{
            id: string;
            status: string;
            processed_at: Date | null;
            created_at: Date;
            payload: unknown;
            provider_event_id: string;
            event_type: string;
            store_id: string | null;
            payment_id: string | null;
          }>(
            `SELECT * FROM payment_webhook_events WHERE id = $1 FOR UPDATE`,
            [row.id],
          );

          const lockedRow = lockedRes.rows[0];
          if (!lockedRow) {
            return null;
          }

          // Verify that it is still in PROCESSING and still expired
          if (lockedRow.status !== "PROCESSING") {
            return null;
          }

          const claimedAt = lockedRow.processed_at ?? lockedRow.created_at;
          if (new Date(claimedAt) > cutoff) {
            // Another worker claimed or renewed this lease recently
            return null;
          }

          // Renew lease
          await tx.query(
            `UPDATE payment_webhook_events SET processed_at = NOW() WHERE id = $1`,
            [lockedRow.id],
          );

          const payload = (typeof lockedRow.payload === "string"
            ? JSON.parse(lockedRow.payload)
            : lockedRow.payload) as RazorpayWebhookPayload;

          // Re-execute domain processing
          const outcome: WebhookProcessingOutcome = await this.processor.process(
            tx,
            payload,
            lockedRow.provider_event_id,
          );

          const targetStatus = outcome.status === "IGNORED" ? "IGNORED" : "PROCESSED";
          await this.webhookEventRepo.markProcessed(tx, lockedRow.id, targetStatus, {
            paymentId: outcome.paymentId ?? null,
            storeId: outcome.storeId ?? null,
            errorMessage: outcome.requiresReconciliation ? outcome.message : null,
          });

          // Trigger downstream purchase workflow if captured
          if (outcome.status === "PROCESSED" && outcome.paymentId && outcome.storeId) {
            await this.orderIntegration.completePurchaseWorkflow(tx, {
              storeId: outcome.storeId,
              paymentId: outcome.paymentId,
            }).catch(() => {
              // Order creation failure is recoverable; payment remains captured
            });
          }

          return {
            id: lockedRow.id,
            providerEventId: lockedRow.provider_event_id,
            status: targetStatus,
            paymentId: outcome.paymentId,
          } as WebhookRecoveryItemResult;
        });

        if (itemResult) {
          results.push(itemResult);
          recoveredCount++;
        }
      } catch (err) {
        failedCount++;
        const errMsg = err instanceof Error ? err.message : "Webhook recovery error";
        results.push({
          id: row.id,
          providerEventId: row.provider_event_id,
          status: "FAILED",
          errorMessage: errMsg,
        });

        // Record failure status on event row outside the failed transaction
        await runInTransaction(clientOrDb, async (errTx) => {
          await this.webhookEventRepo.markProcessed(errTx, row.id, "FAILED", {
            errorMessage: errMsg,
          });
        }).catch(() => {});
      }
    }

    return {
      recoveredCount,
      failedCount,
      events: results,
    };
  }
}
