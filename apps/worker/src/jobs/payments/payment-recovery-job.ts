import type { Database } from "@calcart/db";
import {
  PaymentRecoveryService,
  RazorpayPaymentProvider,
} from "@calcart/payments";

export interface PaymentRecoveryJobOptions {
  batchSize?: number;
}

export interface PaymentRecoveryJobResult {
  job: "payment-recovery";
  orphanedCaptured: {
    recovered: number;
    failed: number;
  };
  ambiguousReconciled: {
    reconciled: number;
    failed: number;
  };
  totalProcessed: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

export class PaymentRecoveryJob {
  private readonly recoveryService: PaymentRecoveryService;

  constructor(service?: PaymentRecoveryService, provider?: RazorpayPaymentProvider) {
    this.recoveryService =
      service ??
      new PaymentRecoveryService(
        undefined,
        undefined,
        undefined,
        undefined,
        provider,
      );
  }

  async run(
    database: Database,
    options?: PaymentRecoveryJobOptions,
  ): Promise<PaymentRecoveryJobResult> {
    const startTime = Date.now();
    const batchSize = Math.max(1, options?.batchSize ?? 50);

    try {
      // 1. Recover captured payments that are missing order linkage
      const orphanedRes = await this.recoveryService.recoverOrphanedCapturedPayments(
        database,
        { limit: batchSize },
      );

      // 2. Reconcile ambiguous payments if provider lookup is available
      const ambiguousRes = await this.recoveryService.reconcileAmbiguousPayments(
        database,
        { limit: batchSize },
      );

      const durationMs = Date.now() - startTime;
      const totalProcessed =
        orphanedRes.recoveredCount +
        orphanedRes.failedCount +
        ambiguousRes.reconciledCount +
        ambiguousRes.failedCount;

      const hasFailures = orphanedRes.failedCount > 0 || ambiguousRes.failedCount > 0;

      return {
        job: "payment-recovery",
        orphanedCaptured: {
          recovered: orphanedRes.recoveredCount,
          failed: orphanedRes.failedCount,
        },
        ambiguousReconciled: {
          reconciled: ambiguousRes.reconciledCount,
          failed: ambiguousRes.failedCount,
        },
        totalProcessed,
        durationMs,
        success: !hasFailures,
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : "Payment recovery job execution error";

      return {
        job: "payment-recovery",
        orphanedCaptured: { recovered: 0, failed: 0 },
        ambiguousReconciled: { reconciled: 0, failed: 0 },
        totalProcessed: 0,
        durationMs,
        success: false,
        error: errorMsg,
      };
    }
  }
}
