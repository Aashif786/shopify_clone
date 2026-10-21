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

export interface ListOrdersRepoOptions {
  storeId: string;
  status?: OrderStatus;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  customerId?: string;
  orderNumber?: string;
  limit?: number;
  cursor?: { createdAt: Date | string; id: string };
}

export interface ListOrdersRepoResult {
  items: OrderRow[];
  hasMore: boolean;
  nextCursor?: { createdAt: string; id: string };
}

export interface CustomerOrderSummary {
  orderCount: number;
  totalSpend: number;
  lastOrderAt: string | null;
  currency: string | null;
}

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
         total, grand_total, cancelled_at, cancel_reason, completed_at,
         guest_token_hash
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9,
         $10, $11, $12, $13, $14,
         $15, $16, $17, $18, $19,
         $20
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
        input.guestTokenHash ?? null,
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

  async list(
    client: DatabaseClient,
    options: ListOrdersRepoOptions,
  ): Promise<ListOrdersRepoResult> {
    const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
    const params: unknown[] = [options.storeId];
    let idx = 2;

    let filterSql = "store_id = $1";

    if (options.status) {
      filterSql += ` AND status = $${idx++}`;
      params.push(options.status);
    }
    if (options.paymentStatus) {
      filterSql += ` AND payment_status = $${idx++}`;
      params.push(options.paymentStatus);
    }
    if (options.fulfillmentStatus) {
      filterSql += ` AND fulfillment_status = $${idx++}`;
      params.push(options.fulfillmentStatus);
    }
    if (options.customerId) {
      filterSql += ` AND customer_id = $${idx++}`;
      params.push(options.customerId);
    }
    if (options.orderNumber) {
      filterSql += ` AND order_number = $${idx++}`;
      params.push(options.orderNumber);
    }
    if (options.cursor) {
      filterSql += ` AND (created_at, id) < ($${idx++}, $${idx++})`;
      params.push(new Date(options.cursor.createdAt), options.cursor.id);
    }

    params.push(limit + 1);
    const limitParamIdx = idx;

    const querySql = `
      SELECT * FROM orders
      WHERE ${filterSql}
      ORDER BY created_at DESC, id DESC
      LIMIT $${limitParamIdx}
    `;

    const res = await client.query<OrderRow>(querySql, params);
    const hasMore = res.rows.length > limit;
    const rows = hasMore ? res.rows.slice(0, limit) : res.rows;

    let nextCursor: { createdAt: string; id: string } | undefined;
    if (hasMore && rows.length > 0) {
      const last = rows[rows.length - 1]!;
      nextCursor = {
        id: last.id,
        createdAt: last.created_at.toISOString(),
      };
    }

    return {
      items: rows,
      hasMore,
      nextCursor,
    };
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

  // --- Customer Order Summaries ---

  async getCustomerOrderSummary(
    client: DatabaseClient,
    storeId: string,
    customerId: string,
  ): Promise<CustomerOrderSummary> {
    const res = await client.query<{
      order_count: string | number;
      total_spend: string | number;
      last_order_at: Date | string | null;
      currency: string | null;
    }>(
      `SELECT
         COUNT(id)::int AS order_count,
         COALESCE(SUM(
           CASE
             WHEN status != 'CANCELLED' AND payment_status NOT IN ('FAILED', 'REFUNDED')
             THEN grand_total
             ELSE 0
           END
         ), 0)::bigint AS total_spend,
         MAX(created_at) AS last_order_at,
         MIN(currency) AS currency
       FROM orders
       WHERE store_id = $1 AND customer_id = $2`,
      [storeId, customerId],
    );

    const row = res.rows[0];
    const orderCount = Number(row?.order_count ?? 0);
    const totalSpend = Number(row?.total_spend ?? 0);
    const lastOrderAt = row?.last_order_at
      ? (row.last_order_at instanceof Date
          ? row.last_order_at.toISOString()
          : new Date(row.last_order_at).toISOString())
      : null;
    const currency = row?.currency ?? null;

    return {
      orderCount,
      totalSpend,
      lastOrderAt,
      currency,
    };
  }

  async getCustomerOrderSummaries(
    client: DatabaseClient,
    storeId: string,
    customerIds: string[],
  ): Promise<Record<string, CustomerOrderSummary>> {
    if (!customerIds || customerIds.length === 0) {
      return {};
    }

    const res = await client.query<{
      customer_id: string;
      order_count: string | number;
      total_spend: string | number;
      last_order_at: Date | string | null;
      currency: string | null;
    }>(
      `SELECT
         customer_id,
         COUNT(id)::int AS order_count,
         COALESCE(SUM(
           CASE
             WHEN status != 'CANCELLED' AND payment_status NOT IN ('FAILED', 'REFUNDED')
             THEN grand_total
             ELSE 0
           END
         ), 0)::bigint AS total_spend,
         MAX(created_at) AS last_order_at,
         MIN(currency) AS currency
       FROM orders
       WHERE store_id = $1 AND customer_id = ANY($2::uuid[])
       GROUP BY customer_id`,
      [storeId, customerIds],
    );

    const result: Record<string, CustomerOrderSummary> = {};
    for (const row of res.rows) {
      if (row.customer_id) {
        result[row.customer_id] = {
          orderCount: Number(row.order_count ?? 0),
          totalSpend: Number(row.total_spend ?? 0),
          lastOrderAt: row.last_order_at
            ? (row.last_order_at instanceof Date
                ? row.last_order_at.toISOString()
                : new Date(row.last_order_at).toISOString())
            : null,
          currency: row.currency ?? null,
        };
      }
    }

    return result;
  }
}
