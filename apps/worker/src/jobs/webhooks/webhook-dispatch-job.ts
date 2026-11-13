import { createHmac } from "node:crypto";
import {
  type Database,
  WebhookRepository,
  type WebhookDeliveryRow,
} from "@calcart/db";

export interface WebhookDispatchJobOptions {
  batchSize?: number;
  asOfDate?: Date;
}

export interface WebhookDispatchJobResult {
  job: "webhook-dispatch";
  sentCount: number;
  failedCount: number;
  totalProcessed: number;
  durationMs: number;
  success: boolean;
  processedIds: string[];
  error?: string;
}

const BACKOFF_INTERVALS_MS = [
  60_000,      // Attempt 1 -> 1 min
  300_000,     // Attempt 2 -> 5 min
  900_000,     // Attempt 3 -> 15 min
  1_800_000,   // Attempt 4 -> 30 min
  3_600_000,   // Attempt 5 -> 60 min
];

export class WebhookDispatchJob {
  private readonly webhookRepo: WebhookRepository;

  constructor(webhookRepo?: WebhookRepository) {
    this.webhookRepo = webhookRepo ?? new WebhookRepository();
  }

  async run(
    database: Database,
    options?: WebhookDispatchJobOptions,
  ): Promise<WebhookDispatchJobResult> {
    const startTime = Date.now();
    const batchSize = Math.max(1, options?.batchSize ?? 50);
    const asOfDate = options?.asOfDate ?? new Date();

    let sentCount = 0;
    let failedCount = 0;
    const processedIds: string[] = [];

    try {
      // 1. Claim pending deliveries
      const deliveries = await this.webhookRepo.claimPendingDeliveries(database, {
        limit: batchSize,
        asOf: asOfDate,
      });

      if (deliveries.length === 0) {
        return {
          job: "webhook-dispatch",
          sentCount: 0,
          failedCount: 0,
          totalProcessed: 0,
          durationMs: Date.now() - startTime,
          success: true,
          processedIds: [],
        };
      }

      // 2. Dispatch each claimed delivery
      for (const delivery of deliveries) {
        processedIds.push(delivery.id);
        const success = await this.dispatchSingleWebhook(database, delivery);
        if (success) {
          sentCount++;
        } else {
          failedCount++;
        }
      }

      return {
        job: "webhook-dispatch",
        sentCount,
        failedCount,
        totalProcessed: deliveries.length,
        durationMs: Date.now() - startTime,
        success: failedCount === 0,
        processedIds,
      };
    } catch (error) {
      console.error("[WebhookDispatchJob] Execution error:", error);
      return {
        job: "webhook-dispatch",
        sentCount,
        failedCount,
        totalProcessed: processedIds.length,
        durationMs: Date.now() - startTime,
        success: false,
        processedIds,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async dispatchSingleWebhook(
    database: Database,
    delivery: WebhookDeliveryRow & { target_url: string; secret: string },
  ): Promise<boolean> {
    const payloadStr = JSON.stringify(delivery.payload);
    const signature = createHmac("sha256", delivery.secret)
      .update(payloadStr)
      .digest("hex");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(delivery.target_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "CalCart-Webhooks/1.0",
          "X-CalCart-Signature": `sha256=${signature}`,
          "X-CalCart-Event": delivery.event_type,
          "X-CalCart-Delivery": delivery.id,
        },
        body: payloadStr,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const statusCode = response.status;
      const responseText = await response.text().catch(() => "");

      if (response.ok) {
        await this.webhookRepo.markDeliverySuccess(database, delivery.id, statusCode, responseText);
        return true;
      }

      // Non-2xx response
      const nextAttempt = delivery.attempts + 1;
      const isTerminal = nextAttempt >= delivery.max_attempts;
      const backoffMs = BACKOFF_INTERVALS_MS[Math.min(delivery.attempts, BACKOFF_INTERVALS_MS.length - 1)] ?? 60_000;
      const nextRetryAt = isTerminal ? null : new Date(Date.now() + backoffMs);

      await this.webhookRepo.markDeliveryFailure(database, delivery.id, {
        statusCode,
        responseBody: responseText,
        errorMessage: `HTTP ${statusCode}: ${responseText.slice(0, 200)}`,
        terminal: isTerminal,
        nextRetryAt,
      });

      return false;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort = err instanceof Error && err.name === "AbortError";
      const errorMsg = isAbort ? "HTTP request timed out after 10 seconds" : (err instanceof Error ? err.message : String(err));

      const nextAttempt = delivery.attempts + 1;
      const isTerminal = nextAttempt >= delivery.max_attempts;
      const backoffMs = BACKOFF_INTERVALS_MS[Math.min(delivery.attempts, BACKOFF_INTERVALS_MS.length - 1)] ?? 60_000;
      const nextRetryAt = isTerminal ? null : new Date(Date.now() + backoffMs);

      await this.webhookRepo.markDeliveryFailure(database, delivery.id, {
        statusCode: null,
        responseBody: null,
        errorMessage: errorMsg,
        terminal: isTerminal,
        nextRetryAt,
      });

      return false;
    }
  }
}
