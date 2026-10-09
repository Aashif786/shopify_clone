import type { Database, DatabaseClient } from "@shopify-clone/db";
import type {
  InventoryReleaseCoordinator,
  CancellationRefundCoordinator,
} from "./order-cancellation-coordinator.js";

export interface OrderCancellationRecoveryOptions {
  batchSize?: number;
}

export interface OrderCancellationRecoverySummary {
  inventoryReservationsRecovered: number;
  inventoryReservationsFailed: number;
  refundsRecovered: number;
  refundsFailed: number;
  success: boolean;
}

export class OrderCancellationRecoveryService {
  constructor(
    private readonly inventoryReleaseService?: InventoryReleaseCoordinator,
    private readonly refundService?: CancellationRefundCoordinator,
  ) {}

  async recoverPendingCancellations(
    clientOrDb: Database | DatabaseClient,
    options?: OrderCancellationRecoveryOptions,
  ): Promise<OrderCancellationRecoverySummary> {
    const limit = Math.max(1, Math.min(options?.batchSize ?? 50, 200));

    let inventoryReservationsRecovered = 0;
    let inventoryReservationsFailed = 0;
    let refundsRecovered = 0;
    let refundsFailed = 0;

    // 1. Recover unreleased inventory reservations on cancelled orders
    if (this.inventoryReleaseService) {
      const candidateReservationsQuery = await clientOrDb.query<{
        order_id: string;
        store_id: string;
        checkout_id: string | null;
      }>(
        `SELECT DISTINCT o.id AS order_id, o.store_id, o.checkout_id
         FROM orders o
         JOIN inventory_reservations r
           ON r.store_id = o.store_id
           AND (
             (r.reference_type = 'order' AND r.reference_id = o.id::text)
             OR (r.reference_type = 'checkout' AND o.checkout_id IS NOT NULL AND r.reference_id = o.checkout_id::text)
           )
         WHERE o.status = 'CANCELLED'
           AND r.status = 'ACTIVE'
         LIMIT $1`,
        [limit],
      );

      for (const row of candidateReservationsQuery.rows) {
        try {
          const res = await this.inventoryReleaseService.releaseOrderReservations(clientOrDb, {
            storeId: row.store_id,
            orderId: row.order_id,
            checkoutId: row.checkout_id ?? undefined,
          });
          if (res.releasedCount > 0) {
            inventoryReservationsRecovered += res.releasedCount;
          }
        } catch (err) {
          inventoryReservationsFailed++;
          console.error(
            `[OrderCancellationRecoveryService] Failed to release inventory for order ${row.order_id}:`,
            err instanceof Error ? err.message : String(err),
          );
        }
      }
    }

    // 2. Recover uninitiated or pending refunds on cancelled orders
    if (this.refundService) {
      const candidateRefundsQuery = await clientOrDb.query<{
        order_id: string;
        store_id: string;
        checkout_id: string | null;
      }>(
        `SELECT DISTINCT o.id AS order_id, o.store_id, o.checkout_id
         FROM orders o
         JOIN payments p
           ON p.store_id = o.store_id
           AND (p.order_id = o.id OR (o.checkout_id IS NOT NULL AND p.checkout_id = o.checkout_id))
         WHERE o.status = 'CANCELLED'
           AND (
             (p.status = 'CAPTURED' AND (p.captured_amount - p.refunded_amount) > 0)
             OR EXISTS (
               SELECT 1 FROM refunds rf
               WHERE rf.store_id = o.store_id
                 AND rf.payment_id = p.id
                 AND rf.status = 'PENDING'
             )
           )
         LIMIT $1`,
        [limit],
      );

      for (const row of candidateRefundsQuery.rows) {
        try {
          const res = await this.refundService.processCancellationRefund(clientOrDb, {
            storeId: row.store_id,
            orderId: row.order_id,
            checkoutId: row.checkout_id ?? undefined,
            reason: "Order cancellation recovery",
          });
          if (res.status === "SUCCEEDED") {
            refundsRecovered++;
          } else if (res.status === "FAILED") {
            refundsFailed++;
          }
        } catch (err) {
          refundsFailed++;
          console.error(
            `[OrderCancellationRecoveryService] Failed to process refund recovery for order ${row.order_id}:`,
            err instanceof Error ? err.message : String(err),
          );
        }
      }
    }

    return {
      inventoryReservationsRecovered,
      inventoryReservationsFailed,
      refundsRecovered,
      refundsFailed,
      success: inventoryReservationsFailed === 0 && refundsFailed === 0,
    };
  }
}
