import type { Database } from "@calcart/db";
import type { PaymentRecoveryConfig } from "@calcart/config";
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
import {
  CartCleanupJob,
  type CartCleanupJobResult,
} from "../jobs/carts/cart-cleanup-job.js";
import {
  WebhookDispatchJob,
  type WebhookDispatchJobResult,
} from "../jobs/webhooks/webhook-dispatch-job.js";

export interface SchedulerRunResult {
  paymentRecovery: PaymentRecoveryJobResult;
  webhookRecovery: WebhookRecoveryJobResult;
  orderCancellation?: OrderCancellationRecoveryJobResult;
  inventoryExpiration?: InventoryExpirationRecoveryJobResult;
  notificationDispatch?: NotificationDispatchJobResult;
  cartCleanup?: CartCleanupJobResult;
  webhookDispatch?: WebhookDispatchJobResult;
  durationMs: number;
}

export class PaymentRecoveryScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isStopping = false;
  private cyclePromise: Promise<SchedulerRunResult> | null = null;

  constructor(
    private readonly database: Database,
    private readonly config: PaymentRecoveryConfig,
    private readonly paymentJob: PaymentRecoveryJob = new PaymentRecoveryJob(),
    private readonly webhookJob: WebhookRecoveryJob = new WebhookRecoveryJob(),
    private readonly orderCancellationJob?: OrderCancellationRecoveryJob,
    private readonly inventoryJob?: InventoryExpirationRecoveryJob,
    private readonly notificationJob?: NotificationDispatchJob,
    private readonly cartCleanupJob?: CartCleanupJob,
    private readonly webhookDispatchJob?: WebhookDispatchJob,
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

    // In test environments, unref so the interval does not hold process open.
    // In non-test environments, the interval MUST remain referenced so the standalone worker process does not exit.
    if (process.env.NODE_ENV === "test" && this.timer && typeof this.timer.unref === "function") {
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

    if (this.cyclePromise) {
      console.log(
        "[PaymentRecoveryScheduler] Prior recovery run in progress; skipping tick to prevent overlap",
      );
      return null;
    }

    return this.startCycle();
  }

  async runNow(): Promise<SchedulerRunResult> {
    if (this.cyclePromise) {
      return this.cyclePromise;
    }
    return this.startCycle();
  }

  private startCycle(): Promise<SchedulerRunResult> {
    const run = this.executeCycle();
    this.cyclePromise = run;
    void run.finally(() => {
      if (this.cyclePromise === run) {
        this.cyclePromise = null;
      }
    });
    return run;
  }

  private async executeCycle(): Promise<SchedulerRunResult> {
    const start = Date.now();

    // 1. Run Webhook Recovery Job (reclaims abandoned webhook leases)
    let webhookResult: WebhookRecoveryJobResult;
    try {
      webhookResult = await this.webhookJob.run(this.database, {
        batchSize: this.config.batchSize,
        leaseTimeoutMs: this.config.leaseTimeoutMs,
      });
    } catch (err) {
      console.error("[PaymentRecoveryScheduler] WebhookRecoveryJob unexpected failure:", err);
      webhookResult = {
        job: "webhook-recovery",
        recoveredCount: 0,
        failedCount: 0,
        totalProcessed: 0,
        durationMs: 0,
        success: false,
        events: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }

    // 2. Run Payment Recovery Job (recovers orphaned captures and ambiguous payments)
    let paymentResult: PaymentRecoveryJobResult;
    try {
      paymentResult = await this.paymentJob.run(this.database, {
        batchSize: this.config.batchSize,
      });
    } catch (err) {
      console.error("[PaymentRecoveryScheduler] PaymentRecoveryJob unexpected failure:", err);
      paymentResult = {
        job: "payment-recovery",
        orphanedCaptured: { recovered: 0, failed: 0 },
        ambiguousReconciled: { reconciled: 0, failed: 0 },
        totalProcessed: 0,
        durationMs: 0,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    // 3. Run Order Cancellation Recovery Job (recovers unreleased reservations and refunds)
    let orderCancellationResult: OrderCancellationRecoveryJobResult | undefined;
    if (this.orderCancellationJob) {
      try {
        orderCancellationResult = await this.orderCancellationJob.run(this.database, {
          batchSize: this.config.batchSize,
        });
      } catch (err) {
        console.error("[PaymentRecoveryScheduler] OrderCancellationRecoveryJob unexpected failure:", err);
        orderCancellationResult = {
          inventoryReservationsRecovered: 0,
          inventoryReservationsFailed: 0,
          refundsRecovered: 0,
          refundsFailed: 0,
          success: false,
        };
      }
    }

    // 4. Run Inventory Expiration Recovery Job (reclaims abandoned active reservations)
    let inventoryExpirationResult: InventoryExpirationRecoveryJobResult | undefined;
    if (this.inventoryJob) {
      try {
        inventoryExpirationResult = await this.inventoryJob.run(this.database, {
          batchSize: this.config.batchSize,
        });
      } catch (err) {
        console.error("[PaymentRecoveryScheduler] InventoryExpirationRecoveryJob unexpected failure:", err);
        inventoryExpirationResult = {
          job: "inventory-expiration-recovery",
          recoveredCount: 0,
          failedCount: 0,
          totalProcessed: 0,
          durationMs: 0,
          success: false,
          releasedReservationIds: [],
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    // 5. Run Cart Cleanup Job (GAP-15: marks abandoned/expired carts, enqueues recovery emails, purges stale carts)
    let cartCleanupResult: CartCleanupJobResult | undefined;
    if (this.cartCleanupJob) {
      try {
        cartCleanupResult = await this.cartCleanupJob.run(this.database, {
          batchSize: this.config.batchSize,
        });
      } catch (err) {
        console.error("[PaymentRecoveryScheduler] CartCleanupJob unexpected failure:", err);
        cartCleanupResult = {
          job: "cart-cleanup",
          abandonedCount: 0,
          expiredCount: 0,
          purgedCount: 0,
          recoveryNotificationsEnqueued: 0,
          totalProcessed: 0,
          durationMs: 0,
          success: false,
          abandonedCartIds: [],
          expiredCartIds: [],
          purgedCartIds: [],
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    // 6. Run Notification Dispatch Job (delivers pending order lifecycle emails)
    let notificationDispatchResult: NotificationDispatchJobResult | undefined;
    if (this.notificationJob) {
      try {
        notificationDispatchResult = await this.notificationJob.run(this.database, {
          batchSize: this.config.batchSize,
        });
      } catch (err) {
        console.error("[PaymentRecoveryScheduler] NotificationDispatchJob unexpected failure:", err);
        notificationDispatchResult = {
          job: "notification-dispatch",
          sentCount: 0,
          failedCount: 0,
          totalProcessed: 0,
          durationMs: 0,
          success: false,
          processedIds: [],
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    // 7. Run Webhook Dispatch Job (GAP-16: delivers outbound webhooks with HMAC-SHA256 signature)
    let webhookDispatchResult: WebhookDispatchJobResult | undefined;
    if (this.webhookDispatchJob) {
      try {
        webhookDispatchResult = await this.webhookDispatchJob.run(this.database, {
          batchSize: this.config.batchSize,
        });
      } catch (err) {
        console.error("[PaymentRecoveryScheduler] WebhookDispatchJob unexpected failure:", err);
        webhookDispatchResult = {
          job: "webhook-dispatch",
          sentCount: 0,
          failedCount: 0,
          totalProcessed: 0,
          durationMs: 0,
          success: false,
          processedIds: [],
          error: err instanceof Error ? err.message : String(err),
        };
      }
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
        cartCleanup: cartCleanupResult
          ? {
              abandoned: cartCleanupResult.abandonedCount,
              expired: cartCleanupResult.expiredCount,
              purged: cartCleanupResult.purgedCount,
              recoveryEnqueued: cartCleanupResult.recoveryNotificationsEnqueued,
              success: cartCleanupResult.success,
            }
          : undefined,
        notificationDispatch: notificationDispatchResult
          ? {
              sent: notificationDispatchResult.sentCount,
              failed: notificationDispatchResult.failedCount,
              success: notificationDispatchResult.success,
            }
          : undefined,
        webhookDispatch: webhookDispatchResult
          ? {
              sent: webhookDispatchResult.sentCount,
              failed: webhookDispatchResult.failedCount,
              success: webhookDispatchResult.success,
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
      cartCleanup: cartCleanupResult,
      webhookDispatch: webhookDispatchResult,
      durationMs,
    };
  }

  async stop(): Promise<void> {
    this.isStopping = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.cyclePromise) {
      console.log(
        "[PaymentRecoveryScheduler] Awaiting in-flight recovery cycle to conclude...",
      );
      await this.cyclePromise.catch(() => undefined);
    }

    console.log("[PaymentRecoveryScheduler] Scheduler stopped cleanly");
  }

  getStatus(): { active: boolean; running: boolean; stopping: boolean } {
    return {
      active: this.timer !== null,
      running: this.cyclePromise !== null,
      stopping: this.isStopping,
    };
  }
}
