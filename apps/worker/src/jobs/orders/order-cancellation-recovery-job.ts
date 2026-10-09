import type { Database } from "@shopify-clone/db";
import { ReservationReleaseService } from "@shopify-clone/inventory";
import {
  OrderCancellationRecoveryService,
  type OrderCancellationRecoverySummary,
} from "@shopify-clone/orders";
import { OrderCancellationRefundService } from "@shopify-clone/payments";
import type { PaymentProvider } from "@shopify-clone/payments";

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
  }
}
