import type { Database } from "@calcart/db";
import {
  CartService,
  type CartLifecycleCleanupOptions,
  type CartLifecycleCleanupResult,
} from "@calcart/carts";

export interface CartCleanupJobOptions extends CartLifecycleCleanupOptions {}

export interface CartCleanupJobResult {
  job: "cart-cleanup";
  abandonedCount: number;
  expiredCount: number;
  purgedCount: number;
  recoveryNotificationsEnqueued: number;
  totalProcessed: number;
  durationMs: number;
  success: boolean;
  abandonedCartIds: string[];
  expiredCartIds: string[];
  purgedCartIds: string[];
  error?: string;
}

export class CartCleanupJob {
  private readonly cartService: CartService;

  constructor(cartService?: CartService) {
    this.cartService = cartService ?? new CartService();
  }

  async run(
    database: Database,
    options?: CartCleanupJobOptions,
  ): Promise<CartCleanupJobResult> {
    const startTime = Date.now();

    try {
      const result: CartLifecycleCleanupResult =
        await this.cartService.processCartLifecycleAndCleanup(database, options);

      const durationMs = Date.now() - startTime;

      if (result.totalProcessed > 0) {
        console.log(
          `[CartCleanupJob] Processed carts: ${result.abandonedCount} abandoned, ${result.expiredCount} expired, ${result.purgedCount} purged (${result.recoveryNotificationsEnqueued} recovery emails enqueued) in ${durationMs}ms`,
        );
      }

      return {
        job: "cart-cleanup",
        abandonedCount: result.abandonedCount,
        expiredCount: result.expiredCount,
        purgedCount: result.purgedCount,
        recoveryNotificationsEnqueued: result.recoveryNotificationsEnqueued,
        totalProcessed: result.totalProcessed,
        durationMs,
        success: result.success,
        abandonedCartIds: result.abandonedCartIds,
        expiredCartIds: result.expiredCartIds,
        purgedCartIds: result.purgedCartIds,
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMsg =
        err instanceof Error ? err.message : "Cart cleanup job execution error";
      console.error("[CartCleanupJob] Fatal error during cart cleanup execution:", err);

      return {
        job: "cart-cleanup",
        abandonedCount: 0,
        expiredCount: 0,
        purgedCount: 0,
        recoveryNotificationsEnqueued: 0,
        totalProcessed: 0,
        durationMs,
        success: false,
        abandonedCartIds: [],
        expiredCartIds: [],
        purgedCartIds: [],
        error: errorMsg,
      };
    }
  }
}
