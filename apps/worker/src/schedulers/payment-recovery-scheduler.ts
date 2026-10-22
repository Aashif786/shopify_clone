import type { Database } from "@shopify-clone/db";
import type { PaymentRecoveryConfig } from "@shopify-clone/config";
import {
  PaymentRecoveryJob,
  type PaymentRecoveryJobResult,
} from "../jobs/payments/payment-recovery-job.js";
import {
  WebhookRecoveryJob,
  type WebhookRecoveryJobResult,
} from "../jobs/payments/webhook-recovery-job.js";
import {
  OrderCancellationRecoveryJob,
  type OrderCancellationRecoveryJobResult,
} from "../jobs/orders/order-cancellation-recovery-job.js";
import {
  InventoryExpirationRecoveryJob,
  type InventoryExpirationRecoveryJobResult,
} from "../jobs/inventory/inventory-expiration-recovery-job.js";
import {
  NotificationDispatchJob,
  type NotificationDispatchJobResult,
} from "../jobs/notifications/notification-dispatch-job.js";

export interface SchedulerRunResult {
  paymentRecovery: PaymentRecoveryJobResult;
  webhookRecovery: WebhookRecoveryJobResult;
  orderCancellation?: OrderCancellationRecoveryJobResult;
  inventoryExpiration?: InventoryExpirationRecoveryJobResult;
  notificationDispatch?: NotificationDispatchJobResult;
  durationMs: number;
}

export class PaymentRecoveryScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isStopping = false;
  private inFlightPromise: Promise<SchedulerRunResult> | null = null;

  constructor(
    private readonly database: Database,
    private readonly config: PaymentRecoveryConfig,
    private readonly paymentJob: PaymentRecoveryJob = new PaymentRecoveryJob(),
    private readonly webhookJob: WebhookRecoveryJob = new WebhookRecoveryJob(),
    private readonly orderCancellationJob?: OrderCancellationRecoveryJob,
    private readonly inventoryJob?: InventoryExpirationRecoveryJob,
    private readonly notificationJob?: NotificationDispatchJob,
  ) {}

  start(): void {
    if (!this.config.enabled) {
      console.log(
        "[PaymentRecoveryScheduler] Payment recovery is disabled via configuration",
      );
      return;
    }

    if (this.timer) {
      return;
    }

    this.isStopping = false;
    console.log(
      `[PaymentRecoveryScheduler] Starting scheduler: interval=${this.config.pollIntervalMs}ms, batchSize=${this.config.batchSize}, leaseTimeout=${this.config.leaseTimeoutMs}ms`,
    );

    // Schedule periodic execution
    this.timer = setInterval(() => {
      void this.tick().catch((err) => {
        console.error("[PaymentRecoveryScheduler] Unexpected tick failure:", err);
      });
    }, this.config.pollIntervalMs);

    // Unref so the interval does not hold process open in test runners
    if (this.timer && typeof this.timer.unref === "function") {
      this.timer.unref();
    }

    // Trigger initial tick asynchronously
    void this.tick().catch((err) => {
      console.error("[PaymentRecoveryScheduler] Initial tick failure:", err);
    });
  }

  async tick(): Promise<SchedulerRunResult | null> {
    if (this.isStopping) {
      return null;
    }

    if (this.isRunning) {
      console.log(
        "[PaymentRecoveryScheduler] Prior recovery run in progress; skipping tick to prevent overlap",
      );
      return null;
    }

    this.isRunning = true;
    try {
      this.inFlightPromise = this.runNow();
      const result = await this.inFlightPromise;
      return result;
    } finally {
      this.isRunning = false;
      this.inFlightPromise = null;
    }
  }

  async runNow(): Promise<SchedulerRunResult> {
    const start = Date.now();

    // 1. Run Webhook Recovery Job (reclaims abandoned webhook leases)
    const webhookResult = await this.webhookJob.run(this.database, {
      batchSize: this.config.batchSize,
      leaseTimeoutMs: this.config.leaseTimeoutMs,
    });

    // 2. Run Payment Recovery Job (recovers orphaned captures and ambiguous payments)
    const paymentResult = await this.paymentJob.run(this.database, {
      batchSize: this.config.batchSize,
    });

    // 3. Run Order Cancellation Recovery Job (recovers unreleased reservations and refunds)
    let orderCancellationResult: OrderCancellationRecoveryJobResult | undefined;
    if (this.orderCancellationJob) {
      orderCancellationResult = await this.orderCancellationJob.run(this.database, {
        batchSize: this.config.batchSize,
      });
    }

    // 4. Run Inventory Expiration Recovery Job (reclaims abandoned active reservations)
    let inventoryExpirationResult: InventoryExpirationRecoveryJobResult | undefined;
    if (this.inventoryJob) {
      inventoryExpirationResult = await this.inventoryJob.run(this.database, {
        batchSize: this.config.batchSize,
      });
    }

    // 5. Run Notification Dispatch Job (delivers pending order lifecycle emails)
    let notificationDispatchResult: NotificationDispatchJobResult | undefined;
    if (this.notificationJob) {
      notificationDispatchResult = await this.notificationJob.run(this.database, {
        batchSize: this.config.batchSize,
      });
    }

    const durationMs = Date.now() - start;

    console.log(
      JSON.stringify({
        tag: "PAYMENT_RECOVERY_CYCLE_COMPLETED",
        durationMs,
        paymentRecovery: {
          orphanedRecovered: paymentResult.orphanedCaptured.recovered,
          orphanedFailed: paymentResult.orphanedCaptured.failed,
          ambiguousReconciled: paymentResult.ambiguousReconciled.reconciled,
          ambiguousFailed: paymentResult.ambiguousReconciled.failed,
          success: paymentResult.success,
        },
        webhookRecovery: {
          recovered: webhookResult.recoveredCount,
          failed: webhookResult.failedCount,
          success: webhookResult.success,
        },
        orderCancellation: orderCancellationResult
          ? {
              inventoryRecovered: orderCancellationResult.inventoryReservationsRecovered,
              inventoryFailed: orderCancellationResult.inventoryReservationsFailed,
              refundsRecovered: orderCancellationResult.refundsRecovered,
              refundsFailed: orderCancellationResult.refundsFailed,
              success: orderCancellationResult.success,
            }
          : undefined,
        inventoryExpiration: inventoryExpirationResult
          ? {
              recovered: inventoryExpirationResult.recoveredCount,
              failed: inventoryExpirationResult.failedCount,
              success: inventoryExpirationResult.success,
            }
          : undefined,
        notificationDispatch: notificationDispatchResult
          ? {
              sent: notificationDispatchResult.sentCount,
              failed: notificationDispatchResult.failedCount,
              success: notificationDispatchResult.success,
            }
          : undefined,
      }),
    );

    return {
      paymentRecovery: paymentResult,
      webhookRecovery: webhookResult,
      orderCancellation: orderCancellationResult,
      inventoryExpiration: inventoryExpirationResult,
      notificationDispatch: notificationDispatchResult,
      durationMs,
    };
  }

  async stop(): Promise<void> {
    this.isStopping = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.inFlightPromise) {
      console.log(
        "[PaymentRecoveryScheduler] Awaiting in-flight recovery cycle to conclude...",
      );
      await this.inFlightPromise.catch(() => {});
    }

    console.log("[PaymentRecoveryScheduler] Scheduler stopped cleanly");
  }

  getStatus(): { active: boolean; running: boolean; stopping: boolean } {
    return {
      active: this.timer !== null,
      running: this.isRunning,
      stopping: this.isStopping,
    };
  }
}
