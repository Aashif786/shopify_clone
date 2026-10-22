import type { Database } from "@shopify-clone/db";
import {
  InventoryService,
  type InventoryReservationDTO,
} from "@shopify-clone/inventory";

export interface InventoryExpirationRecoveryJobOptions {
  batchSize?: number;
  asOfDate?: Date;
}

export interface InventoryExpirationRecoveryJobResult {
  job: "inventory-expiration-recovery";
  recoveredCount: number;
  failedCount: number;
  totalProcessed: number;
  durationMs: number;
  success: boolean;
  releasedReservationIds: string[];
  error?: string;
}

export class InventoryExpirationRecoveryJob {
  private readonly inventoryService: InventoryService;

  constructor(inventoryService?: InventoryService) {
    this.inventoryService = inventoryService ?? new InventoryService();
  }

  async run(
    database: Database,
    options?: InventoryExpirationRecoveryJobOptions,
  ): Promise<InventoryExpirationRecoveryJobResult> {
    const startTime = Date.now();
    const batchSize = Math.max(1, options?.batchSize ?? 50);
    const asOfDate = options?.asOfDate ?? new Date();

    try {
      const result = await this.inventoryService.expireAllExpiredReservations(
        database,
        {
          limit: batchSize,
          asOfDate,
        },
      );

      const durationMs = Date.now() - startTime;
      const totalProcessed = result.expiredCount + result.failedCount;

      if (result.expiredCount > 0 || result.failedCount > 0) {
        console.log(
          `[InventoryExpirationRecoveryJob] Recovered ${result.expiredCount} expired reservations (${result.failedCount} failed)`,
        );
      }

      return {
        job: "inventory-expiration-recovery",
        recoveredCount: result.expiredCount,
        failedCount: result.failedCount,
        totalProcessed,
        durationMs,
        success: result.failedCount === 0,
        releasedReservationIds: result.released.map((r: InventoryReservationDTO) => r.id),
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMsg =
        err instanceof Error ? err.message : "Inventory expiration recovery job execution error";

      return {
        job: "inventory-expiration-recovery",
        recoveredCount: 0,
        failedCount: 0,
        totalProcessed: 0,
        durationMs,
        success: false,
        releasedReservationIds: [],
        error: errorMsg,
      };
    }
  }
}
