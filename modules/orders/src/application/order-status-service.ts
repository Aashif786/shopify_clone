import {
  generateUuidV7,
  type Database,
  type DatabaseClient,
  OrderRepository,
  type OrderRow,
} from "@shopify-clone/db";
import {
  CrossStoreOrderAccessError,
  InvalidOrderStateError,
  OrderCancellationError,
  OrderNotFoundError,
  UnauthorizedPaymentStatusChangeError,
} from "../domain/order-errors.js";
import {
  assertValidOrderStatusTransition,
  isValidActorType,
  isValidOrderFulfillmentStatus,
  isValidOrderPaymentStatus,
} from "../domain/order-state.js";
import {
  type CancelOrderInput,
  type OrderDTO,
  type TransitionOrderStatusInput,
  type UpdateOrderFulfillmentStatusInput,
  type UpdateOrderPaymentStatusInput,
} from "./dtos.js";
import { runInTransaction } from "./order-service.js";

export class OrderStatusService {
  constructor(
    private readonly orderRepo: OrderRepository = new OrderRepository(),
  ) {}

  async transitionStatus(
    clientOrDb: Database | DatabaseClient,
    input: TransitionOrderStatusInput,
  ): Promise<OrderDTO> {
    const { storeId, orderId, toStatus, actorType, actorId, reason } = input;

    if (!storeId || typeof storeId !== "string" || storeId.trim().length === 0) {
      throw new InvalidOrderStateError("storeId is required");
    }
    if (!orderId || typeof orderId !== "string" || orderId.trim().length === 0) {
      throw new InvalidOrderStateError("orderId is required");
    }
    if (!isValidActorType(actorType)) {
      throw new InvalidOrderStateError(`Invalid actorType '${actorType}'`);
    }

    return runInTransaction(clientOrDb, async (tx) => {
      // 1. Acquire row lock for concurrency safety
      const orderRow = await this.orderRepo.findByIdForUpdate(tx, storeId, orderId);

      if (!orderRow) {
        // Distinguish cross-store unauthorized access from non-existent order
        const anyStoreRes = await tx.query<{ store_id: string }>(
          `SELECT store_id FROM orders WHERE id = $1`,
          [orderId],
        );
        if (anyStoreRes.rows[0]) {
          throw new CrossStoreOrderAccessError(
            `Order '${orderId}' does not belong to store '${storeId}'`,
          );
        }
        throw new OrderNotFoundError(orderId, storeId);
      }

      // 2. Validate state machine rules (enforces terminal immutability)
      assertValidOrderStatusTransition(orderRow.status, toStatus);

      // 3. Prevent duplicate/stale transition if order is already in non-terminal target state
      if (orderRow.status === toStatus) {
        return this.hydrateOrderDTO(tx, storeId, orderRow);
      }

      // 4. Determine state-specific fields
      let cancelledAt: Date | null | undefined = undefined;
      let cancelReason: string | null | undefined = undefined;
      let completedAt: Date | null | undefined = undefined;
      let fulfillmentStatus: string | undefined = undefined;

      if (toStatus === "CANCELLED") {
        cancelledAt = new Date();
        cancelReason = reason?.trim() || "Cancelled by user";
        fulfillmentStatus = "CANCELLED";
      } else if (toStatus === "COMPLETED") {
        completedAt = new Date();
      } else if (toStatus === "SHIPPED") {
        fulfillmentStatus = "FULFILLED";
      }

      // 5. Update order atomically
      const updatedRow = await this.orderRepo.updateStatus(tx, storeId, orderId, toStatus, {
        fulfillmentStatus,
        cancelledAt,
        cancelReason,
        completedAt,
      });

      // 6. Record status history record
      await this.orderRepo.createStatusHistory(tx, {
        id: generateUuidV7(),
        orderId,
        storeId,
        fromStatus: orderRow.status,
        toStatus,
        reason: reason ?? null,
        actorType,
        actorId: actorId ?? null,
      });

      return this.hydrateOrderDTO(tx, storeId, updatedRow);
    });
  }

  async cancelOrder(
    clientOrDb: Database | DatabaseClient,
    input: CancelOrderInput,
  ): Promise<OrderDTO> {
    if (!input.reason || typeof input.reason !== "string" || input.reason.trim().length === 0) {
      throw new OrderCancellationError("Cancel reason is required when cancelling an order");
    }

    return this.transitionStatus(clientOrDb, {
      storeId: input.storeId,
      orderId: input.orderId,
      toStatus: "CANCELLED",
      actorType: input.actorType ?? "MERCHANT",
      actorId: input.actorId ?? null,
      reason: input.reason.trim(),
    });
  }

  async updatePaymentStatus(
    clientOrDb: Database | DatabaseClient,
    input: UpdateOrderPaymentStatusInput,
  ): Promise<OrderDTO> {
    const { storeId, orderId, paymentStatus, authorizedInternalCall, actorType, actorId, reason } =
      input;

    if (!authorizedInternalCall) {
      throw new UnauthorizedPaymentStatusChangeError(
        "Payment status cannot be modified without authorized internal payment path",
      );
    }

    if (!isValidOrderPaymentStatus(paymentStatus)) {
      throw new InvalidOrderStateError(`Invalid paymentStatus '${paymentStatus}'`);
    }

    return runInTransaction(clientOrDb, async (tx) => {
      const orderRow = await this.orderRepo.findByIdForUpdate(tx, storeId, orderId);

      if (!orderRow) {
        const anyStoreRes = await tx.query<{ store_id: string }>(
          `SELECT store_id FROM orders WHERE id = $1`,
          [orderId],
        );
        if (anyStoreRes.rows[0]) {
          throw new CrossStoreOrderAccessError(
            `Order '${orderId}' does not belong to store '${storeId}'`,
          );
        }
        throw new OrderNotFoundError(orderId, storeId);
      }

      if (orderRow.payment_status === paymentStatus) {
        return this.hydrateOrderDTO(tx, storeId, orderRow);
      }

      const res = await tx.query<OrderRow>(
        `UPDATE orders
         SET payment_status = $1, updated_at = NOW()
         WHERE id = $2 AND store_id = $3
         RETURNING *`,
        [paymentStatus, orderId, storeId],
      );

      const updatedRow = res.rows[0];
      if (!updatedRow) {
        throw new OrderNotFoundError(orderId, storeId);
      }

      await this.orderRepo.createStatusHistory(tx, {
        id: generateUuidV7(),
        orderId,
        storeId,
        fromStatus: `payment:${orderRow.payment_status}`,
        toStatus: `payment:${paymentStatus}`,
        reason: reason ?? `Payment status updated to ${paymentStatus}`,
        actorType: actorType ?? "SYSTEM",
        actorId: actorId ?? null,
      });

      return this.hydrateOrderDTO(tx, storeId, updatedRow);
    });
  }

  async updateFulfillmentStatus(
    clientOrDb: Database | DatabaseClient,
    input: UpdateOrderFulfillmentStatusInput,
  ): Promise<OrderDTO> {
    const { storeId, orderId, fulfillmentStatus, actorType, actorId, reason } = input;

    if (!isValidOrderFulfillmentStatus(fulfillmentStatus)) {
      throw new InvalidOrderStateError(`Invalid fulfillmentStatus '${fulfillmentStatus}'`);
    }

    return runInTransaction(clientOrDb, async (tx) => {
      const orderRow = await this.orderRepo.findByIdForUpdate(tx, storeId, orderId);

      if (!orderRow) {
        const anyStoreRes = await tx.query<{ store_id: string }>(
          `SELECT store_id FROM orders WHERE id = $1`,
          [orderId],
        );
        if (anyStoreRes.rows[0]) {
          throw new CrossStoreOrderAccessError(
            `Order '${orderId}' does not belong to store '${storeId}'`,
          );
        }
        throw new OrderNotFoundError(orderId, storeId);
      }

      if (orderRow.status === "CANCELLED") {
        throw new InvalidOrderStateError("Cannot fulfill an order that has been cancelled");
      }
      if (orderRow.status === "COMPLETED") {
        throw new InvalidOrderStateError("Cannot fulfill an order that is already completed");
      }

      if (orderRow.fulfillment_status === fulfillmentStatus) {
        return this.hydrateOrderDTO(tx, storeId, orderRow);
      }

      let nextStatus = orderRow.status;
      if (
        fulfillmentStatus === "FULFILLED" &&
        (orderRow.status === "CONFIRMED" || orderRow.status === "PROCESSING")
      ) {
        nextStatus = "SHIPPED";
      }

      const res = await tx.query<OrderRow>(
        `UPDATE orders
         SET fulfillment_status = $1, status = $2, updated_at = NOW()
         WHERE id = $3 AND store_id = $4
         RETURNING *`,
        [fulfillmentStatus, nextStatus, orderId, storeId],
      );

      const updatedRow = res.rows[0];
      if (!updatedRow) {
        throw new OrderNotFoundError(orderId, storeId);
      }

      await this.orderRepo.createStatusHistory(tx, {
        id: generateUuidV7(),
        orderId,
        storeId,
        fromStatus: `fulfillment:${orderRow.fulfillment_status}`,
        toStatus: `fulfillment:${fulfillmentStatus}`,
        reason: reason ?? `Fulfillment status updated to ${fulfillmentStatus}`,
        actorType: actorType ?? "MERCHANT",
        actorId: actorId ?? null,
      });

      if (nextStatus !== orderRow.status) {
        await this.orderRepo.createStatusHistory(tx, {
          id: generateUuidV7(),
          orderId,
          storeId,
          fromStatus: orderRow.status,
          toStatus: nextStatus,
          reason: `Order transitioned to ${nextStatus} upon fulfillment`,
          actorType: actorType ?? "MERCHANT",
          actorId: actorId ?? null,
        });
      }

      return this.hydrateOrderDTO(tx, storeId, updatedRow);
    });
  }

  private async hydrateOrderDTO(
    client: Database | DatabaseClient,
    storeId: string,
    orderRow: OrderRow,
  ): Promise<OrderDTO> {
    const items = await this.orderRepo.findItemsByOrderId(client, storeId, orderRow.id);
    const addresses = await this.orderRepo.findAddressesByOrderId(client, storeId, orderRow.id);
    const history = await this.orderRepo.findStatusHistoryByOrderId(client, storeId, orderRow.id);

    return {
      id: orderRow.id,
      storeId: orderRow.store_id,
      orderNumber: orderRow.order_number,
      customerId: orderRow.customer_id,
      checkoutId: orderRow.checkout_id,
      paymentId: orderRow.payment_id,
      status: orderRow.status,
      paymentStatus: orderRow.payment_status,
      fulfillmentStatus: orderRow.fulfillment_status,
      currency: orderRow.currency,
      subtotal: Number(orderRow.subtotal),
      discountTotal: Number(orderRow.discount_total),
      shippingTotal: Number(orderRow.shipping_total),
      taxTotal: Number(orderRow.tax_total),
      total: Number(orderRow.total),
      grandTotal: Number(orderRow.grand_total),
      cancelledAt: orderRow.cancelled_at ? orderRow.cancelled_at.toISOString() : null,
      cancelReason: orderRow.cancel_reason,
      completedAt: orderRow.completed_at ? orderRow.completed_at.toISOString() : null,
      discountId: orderRow.discount_id ?? null,
      discountCode: orderRow.discount_code ?? null,
      createdAt: orderRow.created_at.toISOString(),
      updatedAt: orderRow.updated_at.toISOString(),
      items: items.map((i) => ({
        id: i.id,
        orderId: i.order_id,
        storeId: i.store_id,
        productId: i.product_id,
        variantId: i.variant_id,
        productNameSnapshot: i.product_name_snapshot,
        variantNameSnapshot: i.variant_name_snapshot,
        skuSnapshot: i.sku_snapshot,
        quantity: i.quantity,
        unitPrice: Number(i.unit_price),
        discountAmount: Number(i.discount_amount),
        taxAmount: Number(i.tax_amount),
        lineTotal: Number(i.line_total),
        createdAt: i.created_at.toISOString(),
        updatedAt: i.updated_at.toISOString(),
      })),
      addresses: addresses.map((a) => ({
        id: a.id,
        orderId: a.order_id,
        storeId: a.store_id,
        type: a.type,
        name: a.name,
        addressLine1: a.address_line_1,
        addressLine2: a.address_line_2,
        city: a.city,
        state: a.state,
        postalCode: a.postal_code,
        country: a.country,
        phone: a.phone,
        createdAt: a.created_at.toISOString(),
        updatedAt: a.updated_at.toISOString(),
      })),
      statusHistory: history.map((h) => ({
        id: h.id,
        orderId: h.order_id,
        storeId: h.store_id,
        fromStatus: h.from_status,
        toStatus: h.to_status,
        reason: h.reason,
        actorType: h.actor_type,
        actorId: h.actor_id,
        createdAt: h.created_at.toISOString(),
      })),
    };
  }
}
