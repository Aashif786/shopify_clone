import type { Database } from "@calcart/db";
import { ReservationReleaseService } from "@calcart/inventory";
import {
  OrderCancellationRecoveryService,
  type OrderCancellationRecoverySummary,
} from "@calcart/orders";
import { OrderCancellationRefundService } from "@calcart/payments";
import type { PaymentProvider } from "@calcart/payments";

export interface OrderCancellationRecoveryJobOptions {
  batchSize?: number;
}

export type OrderCancellationRecoveryJobResult = OrderCancellationRecoverySummary;

export class OrderCancellationRecoveryJob {
  private readonly recoveryService: OrderCancellationRecoveryService;

  constructor(
    recoveryService?: OrderCancellationRecoveryService,
    provider?: PaymentProvider,
  ) {
    if (recoveryService) {
      this.recoveryService = recoveryService;
    } else {
      const releaseService = new ReservationReleaseService();
      const refundService = new OrderCancellationRefundService(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        provider,
      );
      this.recoveryService = new OrderCancellationRecoveryService(
        releaseService,
        refundService,
      );
    }
  }

  async run(
    database: Database,
    options?: OrderCancellationRecoveryJobOptions,
  ): Promise<OrderCancellationRecoveryJobResult> {
    try {
      const summary = await this.recoveryService.recoverPendingCancellations(database, {
        batchSize: options?.batchSize,
      });

      if (
        summary.inventoryReservationsRecovered > 0 ||
        summary.refundsRecovered > 0 ||
        summary.inventoryReservationsFailed > 0 ||
        summary.refundsFailed > 0
      ) {
        console.log(
          `[OrderCancellationRecoveryJob] Recovered ${summary.inventoryReservationsRecovered} inventory reservations (${summary.inventoryReservationsFailed} failed), ${summary.refundsRecovered} refunds (${summary.refundsFailed} failed)`,
        );
      }

      return summary;
    } catch (err) {
      console.error("[OrderCancellationRecoveryJob] Unexpected execution error:", err);
      return {
        inventoryReservationsRecovered: 0,
        inventoryReservationsFailed: 0,
        refundsRecovered: 0,
        refundsFailed: 0,
        success: false,
      };
    }
  }
}
