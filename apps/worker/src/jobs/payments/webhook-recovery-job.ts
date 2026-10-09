import type { Database } from "@shopify-clone/db";
import {
  WebhookRecoveryService,
  type WebhookRecoveryResult,
} from "@shopify-clone/payments";

export interface WebhookRecoveryJobOptions {
  batchSize?: number;
  leaseTimeoutMs?: number;
  provider?: string;
}

export interface WebhookRecoveryJobResult {
  job: "webhook-recovery";
  recoveredCount: number;
  failedCount: number;
  totalProcessed: number;
  durationMs: number;
  success: boolean;
  events: WebhookRecoveryResult["events"];
  error?: string;
}

export class WebhookRecoveryJob {
  private readonly webhookRecoveryService: WebhookRecoveryService;

  constructor(service?: WebhookRecoveryService) {
    this.webhookRecoveryService = service ?? new WebhookRecoveryService();
  }

  async run(
    database: Database,
    options?: WebhookRecoveryJobOptions,
  ): Promise<WebhookRecoveryJobResult> {
    const startTime = Date.now();
    const batchSize = Math.max(1, options?.batchSize ?? 50);
    const leaseTimeoutMs = Math.max(5000, options?.leaseTimeoutMs ?? 60_000);

    try {
      const recoveryResult = await this.webhookRecoveryService.recoverAbandonedEvents(
        database,
        {
          limit: batchSize,
          leaseTimeoutMs,
          provider: options?.provider ?? "razorpay",
        },
      );

      const durationMs = Date.now() - startTime;
      const totalProcessed = recoveryResult.recoveredCount + recoveryResult.failedCount;

      return {
        job: "webhook-recovery",
        recoveredCount: recoveryResult.recoveredCount,
        failedCount: recoveryResult.failedCount,
        totalProcessed,
        durationMs,
        success: recoveryResult.failedCount === 0,
        events: recoveryResult.events,
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMsg =
        err instanceof Error ? err.message : "Webhook recovery job execution error";

      return {
        job: "webhook-recovery",
        recoveredCount: 0,
        failedCount: 0,
        totalProcessed: 0,
        durationMs,
        success: false,
        events: [],
        error: errorMsg,
      };
    }
  }
}
