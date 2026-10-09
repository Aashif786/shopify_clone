import type { DatabaseClient } from "../database.js";
import type {
  CreateOrderAddressRowInput,
  CreateOrderItemRowInput,
  CreateOrderRowInput,
  CreateOrderStatusHistoryRowInput,
  OrderAddressRow,
  OrderItemRow,
  OrderRow,
  OrderStatus,
  OrderStatusHistoryRow,
} from "../schema/orders.js";

export class OrderRepository {
  async create(
    client: DatabaseClient,
    input: CreateOrderRowInput,
  ): Promise<OrderRow> {
    const res = await client.query<OrderRow>(
      `INSERT INTO orders (
         id, store_id, customer_id, checkout_id, payment_id,
         order_number, status, payment_status, fulfillment_status,
         currency, subtotal, discount_total, shipping_total, tax_total,
         total, grand_total, cancelled_at, cancel_reason, completed_at
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9,
         $10, $11, $12, $13, $14,
         $15, $16, $17, $18, $19
       )
       RETURNING *`,
      [
        input.id,
        input.storeId,
        input.customerId ?? null,
        input.checkoutId ?? null,
        input.paymentId ?? null,
        input.orderNumber,
        input.status ?? "PENDING",
        input.paymentStatus ?? "PENDING",
        input.fulfillmentStatus ?? "UNFULFILLED",
        input.currency,
        (input.subtotal ?? 0).toString(),
        (input.discountTotal ?? 0).toString(),
        (input.shippingTotal ?? 0).toString(),
        (input.taxTotal ?? 0).toString(),
        input.total.toString(),
        (input.grandTotal ?? input.total).toString(),
        input.cancelledAt ?? null,
        input.cancelReason ?? null,
        input.completedAt ?? null,
      ],
    );

    const row = res.rows[0];
    if (!row) {
      throw new Error("Failed to insert order record");
    }
    return row;
  }

  async findById(
    client: DatabaseClient,
    storeId: string,
    id: string,
  ): Promise<OrderRow | null> {
    const res = await client.query<OrderRow>(
      `SELECT * FROM orders WHERE id = $1 AND store_id = $2`,
      [id, storeId],
    );
    return res.rows[0] ?? null;
  }

  async findByIdForUpdate(
    client: DatabaseClient,
    storeId: string,
    id: string,
  ): Promise<OrderRow | null> {
    const res = await client.query<OrderRow>(
      `SELECT * FROM orders WHERE id = $1 AND store_id = $2 FOR UPDATE`,
      [id, storeId],
    );
    return res.rows[0] ?? null;
  }

  async findByOrderNumber(
    client: DatabaseClient,
    storeId: string,
    orderNumber: string,
  ): Promise<OrderRow | null> {
    const res = await client.query<OrderRow>(
      `SELECT * FROM orders WHERE store_id = $1 AND order_number = $2`,
      [storeId, orderNumber],
    );
    return res.rows[0] ?? null;
  }

  async findByCheckoutId(
    client: DatabaseClient,
    storeId: string,
    checkoutId: string,
  ): Promise<OrderRow | null> {
    const res = await client.query<OrderRow>(
      `SELECT * FROM orders WHERE store_id = $1 AND checkout_id = $2`,
      [storeId, checkoutId],
    );
    return res.rows[0] ?? null;
  }

  async updateStatus(
    client: DatabaseClient,
    storeId: string,
    id: string,
    status: OrderStatus,
    fields?: {
      paymentStatus?: string;
      fulfillmentStatus?: string;
      cancelledAt?: Date | null;
      cancelReason?: string | null;
      completedAt?: Date | null;
    },
  ): Promise<OrderRow> {
    const sets = [
      `status = $3`,
      `updated_at = NOW()`,
    ];
    const params: unknown[] = [id, storeId, status];
    let idx = 4;

    if (fields?.paymentStatus !== undefined) {
      sets.push(`payment_status = $${idx++}`);
      params.push(fields.paymentStatus);
    }
    if (fields?.fulfillmentStatus !== undefined) {
      sets.push(`fulfillment_status = $${idx++}`);
      params.push(fields.fulfillmentStatus);
    }
    if (fields?.cancelledAt !== undefined) {
      sets.push(`cancelled_at = $${idx++}`);
      params.push(fields.cancelledAt);
    }
    if (fields?.cancelReason !== undefined) {
      sets.push(`cancel_reason = $${idx++}`);
      params.push(fields.cancelReason);
    }
    if (fields?.completedAt !== undefined) {
      sets.push(`completed_at = $${idx++}`);
      params.push(fields.completedAt);
    }

    const res = await client.query<OrderRow>(
      `UPDATE orders
       SET ${sets.join(", ")}
       WHERE id = $1 AND store_id = $2
       RETURNING *`,
      params,
    );

    const row = res.rows[0];
    if (!row) {
      throw new Error(`Order '${id}' not found in store '${storeId}'`);
    }
    return row;
  }

  // --- Order Items ---

  async createItem(
    client: DatabaseClient,
    input: CreateOrderItemRowInput,
  ): Promise<OrderItemRow> {
    const res = await client.query<OrderItemRow>(
      `INSERT INTO order_items (
         id, order_id, store_id, product_id, variant_id,
         product_name_snapshot, variant_name_snapshot, sku_snapshot,
         quantity, unit_price, discount_amount, tax_amount, line_total
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        input.id,
        input.orderId,
        input.storeId,
        input.productId ?? null,
        input.variantId ?? null,
        input.productNameSnapshot,
        input.variantNameSnapshot,
        input.skuSnapshot ?? null,
        input.quantity,
        input.unitPrice.toString(),
        (input.discountAmount ?? 0).toString(),
        (input.taxAmount ?? 0).toString(),
        input.lineTotal.toString(),
      ],
    );

    const row = res.rows[0];
    if (!row) {
      throw new Error("Failed to insert order item record");
    }
    return row;
  }

  async findItemsByOrderId(
    client: DatabaseClient,
    storeId: string,
    orderId: string,
  ): Promise<OrderItemRow[]> {
    const res = await client.query<OrderItemRow>(
      `SELECT * FROM order_items WHERE store_id = $1 AND order_id = $2 ORDER BY created_at ASC`,
      [storeId, orderId],
    );
    return res.rows;
  }

  // --- Order Addresses ---

  async createAddress(
    client: DatabaseClient,
    input: CreateOrderAddressRowInput,
  ): Promise<OrderAddressRow> {
    const res = await client.query<OrderAddressRow>(
      `INSERT INTO order_addresses (
         id, order_id, store_id, type, name,
         address_line_1, address_line_2, city, state, postal_code, country, phone
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        input.id,
        input.orderId,
        input.storeId,
        input.type,
        input.name,
        input.addressLine1,
        input.addressLine2 ?? null,
        input.city,
        input.state ?? null,
        input.postalCode,
        input.country,
        input.phone ?? null,
      ],
    );

    const row = res.rows[0];
    if (!row) {
      throw new Error("Failed to insert order address record");
    }
    return row;
  }

  async findAddressesByOrderId(
    client: DatabaseClient,
    storeId: string,
    orderId: string,
  ): Promise<OrderAddressRow[]> {
    const res = await client.query<OrderAddressRow>(
      `SELECT * FROM order_addresses WHERE store_id = $1 AND order_id = $2`,
      [storeId, orderId],
    );
    return res.rows;
  }

  // --- Order Status History ---

  async createStatusHistory(
    client: DatabaseClient,
    input: CreateOrderStatusHistoryRowInput,
  ): Promise<OrderStatusHistoryRow> {
    const res = await client.query<OrderStatusHistoryRow>(
      `INSERT INTO order_status_history (
         id, order_id, store_id, from_status, to_status, reason, actor_type, actor_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.id,
        input.orderId,
        input.storeId,
        input.fromStatus ?? null,
        input.toStatus,
        input.reason ?? null,
        input.actorType ?? "SYSTEM",
        input.actorId ?? null,
      ],
    );

    const row = res.rows[0];
    if (!row) {
      throw new Error("Failed to insert order status history record");
    }
    return row;
  }

  async findStatusHistoryByOrderId(
    client: DatabaseClient,
    storeId: string,
    orderId: string,
  ): Promise<OrderStatusHistoryRow[]> {
    const res = await client.query<OrderStatusHistoryRow>(
      `SELECT * FROM order_status_history WHERE store_id = $1 AND order_id = $2 ORDER BY created_at ASC`,
      [storeId, orderId],
    );
    return res.rows;
  }
}
