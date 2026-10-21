import type { DatabaseClient } from "../database.js";

export interface SalesAggregationRow {
  order_count: string | number;
  gross_sales: string | number;
  discounts: string | number;
  shipping_total: string | number;
  tax_total: string | number;
  total_sales: string | number;
}

export interface RefundsAggregationRow {
  refunds_total: string | number;
  refund_count: string | number;
}

export interface OrdersByStatusRow {
  status: string;
  count: string | number;
  total_amount: string | number;
}

export interface OrdersByPaymentStatusRow {
  payment_status: string;
  count: string | number;
}

export interface OrdersByFulfillmentStatusRow {
  fulfillment_status: string;
  count: string | number;
}

export interface DailySalesTrendRow {
  date: string;
  order_count: string | number;
  gross_sales: string | number;
  discounts: string | number;
  total_sales: string | number;
}

export interface DailyRefundsTrendRow {
  date: string;
  refunds: string | number;
}

export interface TopProductRow {
  product_id: string | null;
  product_name: string;
  units_sold: string | number;
  gross_revenue: string | number;
  discount_amount: string | number;
  net_revenue: string | number;
}

export interface LowStockVariantRow {
  inventory_item_id: string;
  variant_id: string;
  product_id: string;
  product_name: string;
  variant_name: string;
  sku: string | null;
  available_quantity: number;
  reserved_quantity: number;
}

export interface CustomerMetricsRow {
  total_customers: string | number;
  new_customers: string | number;
  active_customers: string | number;
  repeat_customers: string | number;
}

export interface TopCustomerRow {
  customer_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  order_count: string | number;
  total_spent: string | number;
}

export class AnalyticsRepository {
  async getStoreSettings(
    client: DatabaseClient,
    storeId: string,
  ): Promise<{ currency: string; timezone: string }> {
    const res = await client.query<{ currency: string; timezone: string }>(
      `SELECT currency, timezone FROM stores WHERE id = $1 LIMIT 1`,
      [storeId],
    );
    return {
      currency: res.rows[0]?.currency ?? "USD",
      timezone: res.rows[0]?.timezone ?? "UTC",
    };
  }

  async getStoreCurrency(
    client: DatabaseClient,
    storeId: string,
  ): Promise<string> {
    const settings = await this.getStoreSettings(client, storeId);
    return settings.currency;
  }

  async getSalesMetrics(
    client: DatabaseClient,
    storeId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<SalesAggregationRow> {
    const res = await client.query<SalesAggregationRow>(
      `SELECT
         COALESCE(COUNT(CASE WHEN status != 'CANCELLED' THEN id END), 0)::int AS order_count,
         COALESCE(SUM(subtotal), 0)::bigint AS gross_sales,
         COALESCE(SUM(discount_total), 0)::bigint AS discounts,
         COALESCE(SUM(shipping_total), 0)::bigint AS shipping_total,
         COALESCE(SUM(tax_total), 0)::bigint AS tax_total,
         COALESCE(SUM(grand_total), 0)::bigint AS total_sales
       FROM orders
       WHERE store_id = $1
         AND created_at >= $2 AND created_at <= $3
         AND (status != 'CANCELLED' OR payment_status IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'))
         AND payment_status != 'FAILED'`,
      [storeId, startDate.toISOString(), endDate.toISOString()],
    );

    return (
      res.rows[0] ?? {
        order_count: 0,
        gross_sales: 0,
        discounts: 0,
        shipping_total: 0,
        tax_total: 0,
        total_sales: 0,
      }
    );
  }

  async getRefundsMetrics(
    client: DatabaseClient,
    storeId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<RefundsAggregationRow> {
    const res = await client.query<RefundsAggregationRow>(
      `SELECT
         COALESCE(SUM(amount), 0)::bigint AS refunds_total,
         COALESCE(COUNT(id), 0)::int AS refund_count
       FROM refunds
       WHERE store_id = $1
         AND status = 'SUCCEEDED'
         AND created_at >= $2 AND created_at <= $3`,
      [storeId, startDate.toISOString(), endDate.toISOString()],
    );

    return (
      res.rows[0] ?? {
        refunds_total: 0,
        refund_count: 0,
      }
    );
  }

  async getOrdersByStatus(
    client: DatabaseClient,
    storeId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<OrdersByStatusRow[]> {
    const res = await client.query<OrdersByStatusRow>(
      `SELECT
         status,
         COUNT(id)::int AS count,
         COALESCE(SUM(grand_total), 0)::bigint AS total_amount
       FROM orders
       WHERE store_id = $1
         AND created_at >= $2 AND created_at <= $3
       GROUP BY status
       ORDER BY count DESC`,
      [storeId, startDate.toISOString(), endDate.toISOString()],
    );
    return res.rows;
  }

  async getOrdersByPaymentStatus(
    client: DatabaseClient,
    storeId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<OrdersByPaymentStatusRow[]> {
    const res = await client.query<OrdersByPaymentStatusRow>(
      `SELECT
         payment_status,
         COUNT(id)::int AS count
       FROM orders
       WHERE store_id = $1
         AND created_at >= $2 AND created_at <= $3
       GROUP BY payment_status
       ORDER BY count DESC`,
      [storeId, startDate.toISOString(), endDate.toISOString()],
    );
    return res.rows;
  }

  async getOrdersByFulfillmentStatus(
    client: DatabaseClient,
    storeId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<OrdersByFulfillmentStatusRow[]> {
    const res = await client.query<OrdersByFulfillmentStatusRow>(
      `SELECT
         fulfillment_status,
         COUNT(id)::int AS count
       FROM orders
       WHERE store_id = $1
         AND created_at >= $2 AND created_at <= $3
       GROUP BY fulfillment_status
       ORDER BY count DESC`,
      [storeId, startDate.toISOString(), endDate.toISOString()],
    );
    return res.rows;
  }

  async getDailySalesTrend(
    client: DatabaseClient,
    storeId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DailySalesTrendRow[]> {
    const res = await client.query<DailySalesTrendRow>(
      `SELECT
         TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS date,
         COALESCE(COUNT(CASE WHEN status != 'CANCELLED' THEN id END), 0)::int AS order_count,
         COALESCE(SUM(subtotal), 0)::bigint AS gross_sales,
         COALESCE(SUM(discount_total), 0)::bigint AS discounts,
         COALESCE(SUM(grand_total), 0)::bigint AS total_sales
       FROM orders
       WHERE store_id = $1
         AND created_at >= $2 AND created_at <= $3
         AND (status != 'CANCELLED' OR payment_status IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'))
         AND payment_status != 'FAILED'
       GROUP BY DATE_TRUNC('day', created_at)
       ORDER BY DATE_TRUNC('day', created_at) ASC`,
      [storeId, startDate.toISOString(), endDate.toISOString()],
    );
    return res.rows;
  }

  async getDailyRefundsTrend(
    client: DatabaseClient,
    storeId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DailyRefundsTrendRow[]> {
    const res = await client.query<DailyRefundsTrendRow>(
      `SELECT
         TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS date,
         COALESCE(SUM(amount), 0)::bigint AS refunds
       FROM refunds
       WHERE store_id = $1
         AND status = 'SUCCEEDED'
         AND created_at >= $2 AND created_at <= $3
       GROUP BY DATE_TRUNC('day', created_at)
       ORDER BY DATE_TRUNC('day', created_at) ASC`,
      [storeId, startDate.toISOString(), endDate.toISOString()],
    );
    return res.rows;
  }

  async getTopProducts(
    client: DatabaseClient,
    storeId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 10,
    orderBy: "units" | "revenue" = "units",
  ): Promise<TopProductRow[]> {
    const orderClause =
      orderBy === "units" ? "units_sold DESC" : "net_revenue DESC";

    const res = await client.query<TopProductRow>(
      `SELECT
         oi.product_id,
         oi.product_name_snapshot AS product_name,
         COALESCE(SUM(oi.quantity), 0)::int AS units_sold,
         COALESCE(SUM(oi.quantity * oi.unit_price), 0)::bigint AS gross_revenue,
         COALESCE(SUM(oi.discount_amount), 0)::bigint AS discount_amount,
         COALESCE(SUM(oi.quantity * oi.unit_price - oi.discount_amount), 0)::bigint AS net_revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id AND o.store_id = oi.store_id
       WHERE oi.store_id = $1
         AND o.created_at >= $2 AND o.created_at <= $3
         AND (o.status != 'CANCELLED' OR o.payment_status IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'))
         AND o.payment_status != 'FAILED'
       GROUP BY oi.product_id, oi.product_name_snapshot
       ORDER BY ${orderClause}
       LIMIT $4`,
      [storeId, startDate.toISOString(), endDate.toISOString(), limit],
    );
    return res.rows;
  }

  async getLowStockVariants(
    client: DatabaseClient,
    storeId: string,
    threshold: number = 10,
    limit: number = 20,
  ): Promise<LowStockVariantRow[]> {
    const res = await client.query<LowStockVariantRow>(
      `SELECT
         ii.id AS inventory_item_id,
         ii.variant_id,
         pv.product_id,
         p.title AS product_name,
         pv.title AS variant_name,
         pv.sku,
         ii.available_quantity,
         ii.reserved_quantity
       FROM inventory_items ii
       JOIN product_variants pv ON pv.id = ii.variant_id AND pv.store_id = ii.store_id
       JOIN products p ON p.id = pv.product_id AND p.store_id = ii.store_id
       WHERE ii.store_id = $1
         AND ii.available_quantity <= $2
       ORDER BY ii.available_quantity ASC
       LIMIT $3`,
      [storeId, threshold, limit],
    );
    return res.rows;
  }

  async getCustomerMetrics(
    client: DatabaseClient,
    storeId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CustomerMetricsRow> {
    const res = await client.query<CustomerMetricsRow>(
      `SELECT
         (SELECT COUNT(id)::int FROM customers WHERE store_id = $1) AS total_customers,
         (SELECT COUNT(id)::int FROM customers WHERE store_id = $1 AND created_at >= $2 AND created_at <= $3) AS new_customers,
         (SELECT COUNT(DISTINCT customer_id)::int FROM orders WHERE store_id = $1 AND customer_id IS NOT NULL AND created_at >= $2 AND created_at <= $3 AND (status != 'CANCELLED' OR payment_status IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')) AND payment_status != 'FAILED') AS active_customers,
         (SELECT COUNT(*)::int FROM (
            SELECT customer_id FROM orders WHERE store_id = $1 AND customer_id IS NOT NULL AND (status != 'CANCELLED' OR payment_status IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')) AND payment_status != 'FAILED' GROUP BY customer_id HAVING COUNT(id) > 1
          ) repeat_sub) AS repeat_customers`,
      [storeId, startDate.toISOString(), endDate.toISOString()],
    );

    return (
      res.rows[0] ?? {
        total_customers: 0,
        new_customers: 0,
        active_customers: 0,
        repeat_customers: 0,
      }
    );
  }

  async getTopSpendingCustomers(
    client: DatabaseClient,
    storeId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 10,
  ): Promise<TopCustomerRow[]> {
    const res = await client.query<TopCustomerRow>(
      `SELECT
         c.id AS customer_id,
         c.email,
         c.first_name,
         c.last_name,
         COUNT(CASE WHEN o.status != 'CANCELLED' THEN o.id END)::int AS order_count,
         COALESCE(SUM(o.grand_total), 0)::bigint AS total_spent
       FROM customers c
       JOIN orders o ON o.customer_id = c.id AND o.store_id = c.store_id
       WHERE c.store_id = $1
         AND o.created_at >= $2 AND o.created_at <= $3
         AND (o.status != 'CANCELLED' OR o.payment_status IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'))
         AND o.payment_status != 'FAILED'
       GROUP BY c.id, c.email, c.first_name, c.last_name
       ORDER BY total_spent DESC
       LIMIT $4`,
      [storeId, startDate.toISOString(), endDate.toISOString(), limit],
    );
    return res.rows;
  }
}
