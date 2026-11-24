import { createHmac } from "node:crypto";
import {
  type Database,
  WebhookRepository,
  type WebhookDeliveryRow,
} from "@calcart/db";
import { validateWebhookUrl } from "@calcart/validation";

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

/**
 * Reads at most maxBytes (default 4KB) from response body stream and cancels
 * the remainder to prevent huge remote payloads from exhausting worker memory.
 */
async function readBoundedBody(response: Response, maxBytes: number = 4096): Promise<string> {
  if (!response.body) {
    return "";
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done || !value) {
        break;
      }
      const remaining = maxBytes - totalBytes;
      if (value.length > remaining) {
        chunks.push(value.subarray(0, remaining));
        totalBytes += remaining;
        await reader.cancel();
        break;
      } else {
        chunks.push(value);
        totalBytes += value.length;
        if (totalBytes >= maxBytes) {
          await reader.cancel();
          break;
        }
      }
    }
  } catch {
    // If stream reading fails or is aborted, decode whatever was buffered
  }

  const concatenated = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    concatenated.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(concatenated);
}

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

      // 2. Dispatch claimed deliveries with bounded concurrency (max 5 in flight)
      const CONCURRENCY_LIMIT = 5;
      let deliveryIndex = 0;

      const workerCount = Math.min(CONCURRENCY_LIMIT, deliveries.length);
      const workers = Array.from({ length: workerCount }, async () => {
        while (deliveryIndex < deliveries.length) {
          const currentIndex = deliveryIndex++;
          const delivery = deliveries[currentIndex];
          if (!delivery) break;

          processedIds.push(delivery.id);
          const success = await this.dispatchSingleWebhook(database, delivery);
          if (success) {
            sentCount++;
          } else {
            failedCount++;
          }
        }
      });

      await Promise.all(workers);

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
    // 1. SSRF check immediately before fetch to defeat DNS rebinding
    const ssrfCheck = await validateWebhookUrl(delivery.target_url);
    if (!ssrfCheck.valid) {
      const errorMsg = `SSRF Protection: ${ssrfCheck.error || "Blocked destination"}`;
      console.warn(`[WebhookDispatchJob] Delivery ${delivery.id} blocked by SSRF validation: ${errorMsg}`);
      await this.webhookRepo.markDeliveryFailure(database, delivery.id, {
        statusCode: null,
        responseBody: null,
        errorMessage: errorMsg,
        terminal: true,
        nextRetryAt: null,
      });
      return false;
    }

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
        redirect: "error",
      });

      clearTimeout(timeoutId);
      const statusCode = response.status;
      const responseText = await readBoundedBody(response, 4096);

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
