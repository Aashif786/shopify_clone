import type { Database, DatabaseClient } from "@calcart/db";
import { OrderRepository } from "@calcart/db";
import { NotificationOutboxService } from "./notification-outbox-service.js";
import { OrderStatusService } from "./order-status-service.js";
import {
  CrossStoreOrderAccessError,
  OrderCancellationError,
  OrderImmutableError,
  OrderNotFoundError,
} from "../domain/order-errors.js";
import {
  canCancelOrderStatus,
  type OrderFulfillmentStatus,
  type OrderPaymentStatus,
  type OrderStatus,
} from "../domain/order-state.js";
import type { OrderDTO } from "./dtos.js";

export interface CancelOrderWorkflowInput {
  storeId: string;
  orderId: string;
  reason: string;
  actorType?: "CUSTOMER" | "MERCHANT" | "SYSTEM";
  actorId?: string | null;
  allowAlreadyCancelled?: boolean;
}

export interface InventoryReleaseCoordinator {
  releaseOrderReservations(
    clientOrDb: Database | DatabaseClient,
    input: { storeId: string; orderId?: string; checkoutId?: string },
  ): Promise<{ releasedCount: number; skippedCount: number; reservations?: unknown[] }>;
}

export interface CancellationRefundCoordinator {
  processCancellationRefund(
    clientOrDb: Database | DatabaseClient,
    input: { storeId: string; orderId: string; checkoutId?: string; reason?: string },
  ): Promise<{
    status: "NOT_APPLICABLE" | "PENDING" | "SUCCEEDED" | "FAILED" | "REQUIRES_RECONCILIATION";
    refundId?: string;
    amount?: number;
    error?: string;
  }>;
}

export interface OrderCancellationWorkflowResult {
  order: OrderDTO;
  cancellationStatus: "CANCELLED" | "ALREADY_CANCELLED";
  inventory: {
    released: boolean;
    releasedCount: number;
    skippedCount: number;
    error?: string;
  };
  refund: {
    status: "NOT_APPLICABLE" | "PENDING" | "SUCCEEDED" | "FAILED" | "REQUIRES_RECONCILIATION";
    refundId?: string;
    amount?: number;
    error?: string;
  };
}

export class OrderCancellationCoordinator {
  constructor(
    private readonly orderStatusService: OrderStatusService = new OrderStatusService(),
    private readonly orderRepo: OrderRepository = new OrderRepository(),
    private readonly inventoryReleaseService?: InventoryReleaseCoordinator,
    private readonly refundService?: CancellationRefundCoordinator,
    private readonly notificationOutboxService: NotificationOutboxService = new NotificationOutboxService(),
  ) {}

  async cancelOrder(
    clientOrDb: Database | DatabaseClient,
    input: CancelOrderWorkflowInput,
  ): Promise<OrderCancellationWorkflowResult> {
    const { storeId, orderId, reason, actorType = "MERCHANT", actorId = null } = input;

    if (!storeId || typeof storeId !== "string" || storeId.trim().length === 0) {
      throw new Error("storeId is required");
    }
    if (!orderId || typeof orderId !== "string" || orderId.trim().length === 0) {
      throw new Error("orderId is required");
    }
    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      throw new OrderCancellationError("Cancel reason is required when cancelling an order");
    }

    // 1. Inspect current order state
    const existingRow = await this.orderRepo.findById(clientOrDb, storeId, orderId);
    if (!existingRow) {
      // Check if order exists in any other store (tenant isolation validation)
      const queryable = clientOrDb as {
        query?: (sql: string, params: unknown[]) => Promise<{ rows: Array<{ store_id: string }> }>;
      };
      const anyStore = await queryable.query?.(
        `SELECT store_id FROM orders WHERE id = $1`,
        [orderId],
      );
      if (anyStore?.rows?.[0]) {
        throw new CrossStoreOrderAccessError(
          `Order '${orderId}' does not belong to store '${storeId}'`,
        );
      }
      throw new OrderNotFoundError(orderId, storeId);
    }

    let order: OrderDTO;
    let isAlreadyCancelled = false;

    if (existingRow.status === "CANCELLED") {
      if (!input.allowAlreadyCancelled) {
        // Enforce state machine immutability on repeated client requests
        throw new OrderImmutableError(
          `Order is in terminal status 'CANCELLED' and cannot transition to 'CANCELLED'`,
        );
      }
      isAlreadyCancelled = true;
      order = {
        id: existingRow.id,
        storeId: existingRow.store_id,
        customerId: existingRow.customer_id,
        checkoutId: existingRow.checkout_id ?? null,
        paymentId: existingRow.payment_id ?? null,
        orderNumber: existingRow.order_number,
        status: existingRow.status as OrderStatus,
        paymentStatus: existingRow.payment_status as OrderPaymentStatus,
        fulfillmentStatus: existingRow.fulfillment_status as OrderFulfillmentStatus,
        currency: existingRow.currency,
        subtotal: Number(existingRow.subtotal),
        discountTotal: Number(existingRow.discount_total),
        shippingTotal: Number(existingRow.shipping_total),
        taxTotal: Number(existingRow.tax_total),
        total: Number(existingRow.grand_total),
        grandTotal: Number(existingRow.grand_total),
        cancelledAt: existingRow.cancelled_at ? existingRow.cancelled_at.toISOString() : null,
        cancelReason: existingRow.cancel_reason ?? null,
        completedAt: existingRow.completed_at ? existingRow.completed_at.toISOString() : null,
        items: [],
        createdAt: existingRow.created_at.toISOString(),
        updatedAt: existingRow.updated_at.toISOString(),
      };
    } else {
      // Check allowed cancellation states (PENDING, CONFIRMED, PROCESSING)
      if (!canCancelOrderStatus(existingRow.status as OrderStatus)) {
        throw new OrderCancellationError(
          `Cannot cancel order in status '${existingRow.status}'. Cancellation is only permitted from PENDING, CONFIRMED, or PROCESSING.`,
        );
      }

      // Transition order status to CANCELLED atomically
      order = await this.orderStatusService.cancelOrder(clientOrDb, {
        storeId,
        orderId,
        reason: reason.trim(),
        actorType,
        actorId,
      });
    }

    // 2. Coordinated Side Effect: Release Inventory Reservations
    let inventoryResult = {
      released: true,
      releasedCount: 0,
      skippedCount: 0,
      error: undefined as string | undefined,
    };

    if (this.inventoryReleaseService) {
      try {
        const invRes = await this.inventoryReleaseService.releaseOrderReservations(clientOrDb, {
          storeId,
          orderId,
          checkoutId: order.checkoutId ?? undefined,
        });
        inventoryResult = {
          released: true,
          releasedCount: invRes.releasedCount,
          skippedCount: invRes.skippedCount,
          error: undefined,
        };
      } catch (err) {
        inventoryResult = {
          released: false,
          releasedCount: 0,
          skippedCount: 0,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    // 3. Coordinated Side Effect: Refund Payment
    let refundResult = {
      status: "NOT_APPLICABLE" as
        | "NOT_APPLICABLE"
        | "PENDING"
        | "SUCCEEDED"
        | "FAILED"
        | "REQUIRES_RECONCILIATION",
      refundId: undefined as string | undefined,
      amount: undefined as number | undefined,
      error: undefined as string | undefined,
    };

    if (this.refundService) {
      try {
        const refRes = await this.refundService.processCancellationRefund(clientOrDb, {
          storeId,
          orderId,
          checkoutId: order.checkoutId ?? undefined,
          reason: reason.trim(),
        });
        refundResult = {
          status: refRes.status,
          refundId: refRes.refundId,
          amount: refRes.amount,
          error: refRes.error,
        };
      } catch (err) {
        refundResult = {
          status: "FAILED",
          refundId: undefined,
          amount: undefined,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    // 4. Coordinated Side Effect: Queue Order Cancellation Notification (Idempotent, fail-open)
    if (!isAlreadyCancelled) {
      await this.notificationOutboxService.queueOrderCancellation(clientOrDb, {
        storeId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        cancelReason: reason.trim(),
        refundStatus: refundResult.status,
        refundAmount: refundResult.amount,
        currency: order.currency,
      });
    }

    return {
      order,
      cancellationStatus: isAlreadyCancelled ? "ALREADY_CANCELLED" : "CANCELLED",
      inventory: inventoryResult,
      refund: refundResult,
    };
  }
}
