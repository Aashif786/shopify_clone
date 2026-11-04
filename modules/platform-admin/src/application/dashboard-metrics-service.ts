import type { Database } from "@calcart/db";

export interface DashboardOverviewMetrics {
  kpis: {
    totalOrganizations: number;
    totalStores: number;
    activeStores: number;
    suspendedStores: number;
    draftStores: number;
    totalMerchants: number;
    totalCustomers: number;
    totalProducts: number;
    totalOrders: number;
    totalTransactions: number;
    capturedPaymentVolumeCents: number;
    refundVolumeCents: number;
    netPaymentVolumeCents: number;
    gmvCents: number;
    platformSubscriptionRevenueCents: number;
    activeSubscriptions: number;
    trialSubscriptions: number;
    cancelledSubscriptions: number;
    failedPaymentsCount: number;
    orphanedCapturedPaymentsCount: number;
    stuckRefundsCount: number;
    pendingWebhooksCount: number;
    outboxBacklogCount: number;
  };
  timeSeries: {
    date: string;
    orders: number;
    gmvCents: number;
    capturedPaymentCents: number;
    newStores: number;
  }[];
  healthSummary: {
    workerStatus: "HEALTHY" | "DEGRADED" | "ATTENTION";
    paymentPipelineStatus: "HEALTHY" | "WARNING" | "CRITICAL";
    databaseStatus: "CONNECTED" | "UNAVAILABLE";
  };
}

export interface MetricDateFilter {
  startDate?: string;
  endDate?: string;
  periodDays?: number;
}

export class PlatformDashboardMetricsService {
  constructor(private readonly db: Database) {}

  async getOverviewMetrics(filter: MetricDateFilter = {}): Promise<DashboardOverviewMetrics> {
    const periodDays = filter.periodDays ?? 30;

    // 1. Entities scale counts
    const entityCounts = await this.db.query<{
      total_orgs: string;
      total_stores: string;
      active_stores: string;
      suspended_stores: string;
      draft_stores: string;
      total_merchants: string;
      total_customers: string;
      total_products: string;
    }>(`
      SELECT
        (SELECT COUNT(*)::text FROM organizations) AS total_orgs,
        (SELECT COUNT(*)::text FROM stores) AS total_stores,
        (SELECT COUNT(*)::text FROM stores WHERE status = 'ACTIVE') AS active_stores,
        (SELECT COUNT(*)::text FROM stores WHERE status = 'SUSPENDED') AS suspended_stores,
        (SELECT COUNT(*)::text FROM stores WHERE status = 'DRAFT') AS draft_stores,
        (SELECT COUNT(DISTINCT user_id)::text FROM store_memberships) AS total_merchants,
        (SELECT COUNT(*)::text FROM customers) AS total_customers,
        (SELECT COUNT(*)::text FROM products) AS total_products
    `);

    const ec = entityCounts.rows[0] || {
      total_orgs: "0",
      total_stores: "0",
      active_stores: "0",
      suspended_stores: "0",
      draft_stores: "0",
      total_merchants: "0",
      total_customers: "0",
      total_products: "0",
    };

    // 2. Orders and GMV
    const orderMetrics = await this.db.query<{
      total_orders: string;
      gmv_cents: string;
    }>(`
      SELECT
        COUNT(*)::text AS total_orders,
        COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN total ELSE 0 END), 0)::text AS gmv_cents
      FROM orders
    `);

    const om = orderMetrics.rows[0] || { total_orders: "0", gmv_cents: "0" };

    // 3. Payments & Financial Transactions
    const paymentMetrics = await this.db.query<{
      total_transactions: string;
      captured_cents: string;
      failed_payments: string;
      orphaned_captures: string;
    }>(`
      SELECT
        COUNT(*)::text AS total_transactions,
        COALESCE(SUM(CASE WHEN status IN ('CAPTURED', 'REFUNDED', 'PARTIALLY_REFUNDED') THEN amount ELSE 0 END), 0)::text AS captured_cents,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END)::text AS failed_payments,
        COUNT(CASE WHEN status = 'CAPTURED' AND order_id IS NULL THEN 1 END)::text AS orphaned_captures
      FROM payments
    `);

    const pm = paymentMetrics.rows[0] || {
      total_transactions: "0",
      captured_cents: "0",
      failed_payments: "0",
      orphaned_captures: "0",
    };

    // 4. Refunds
    const refundMetrics = await this.db.query<{
      refund_cents: string;
      stuck_refunds: string;
    }>(`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN amount ELSE 0 END), 0)::text AS refund_cents,
        COUNT(CASE WHEN status IN ('PENDING', 'PROCESSING') AND created_at < NOW() - INTERVAL '15 minutes' THEN 1 END)::text AS stuck_refunds
      FROM refunds
    `);

    const rm = refundMetrics.rows[0] || { refund_cents: "0", stuck_refunds: "0" };

    // 5. SaaS Subscriptions
    const subMetrics = await this.db.query<{
      active_subs: string;
      trial_subs: string;
      cancelled_subs: string;
      sub_revenue_cents: string;
    }>(`
      SELECT
        COUNT(CASE WHEN ps.status = 'ACTIVE' THEN 1 END)::text AS active_subs,
        COUNT(CASE WHEN ps.status = 'TRIAL' THEN 1 END)::text AS trial_subs,
        COUNT(CASE WHEN ps.status = 'CANCELLED' THEN 1 END)::text AS cancelled_subs,
        COALESCE(SUM(CASE WHEN ps.status = 'ACTIVE' THEN pp.monthly_price_cents ELSE 0 END), 0)::text AS sub_revenue_cents
      FROM platform_subscriptions ps
      JOIN platform_plans pp ON pp.id = ps.plan_id
    `);

    const sm = subMetrics.rows[0] || {
      active_subs: "0",
      trial_subs: "0",
      cancelled_subs: "0",
      sub_revenue_cents: "0",
    };

    // 6. Operational queues (Webhooks & Outbox)
    const queueMetrics = await this.db.query<{
      pending_webhooks: string;
      outbox_backlog: string;
    }>(`
      SELECT
        (SELECT COUNT(*)::text FROM payment_webhook_events WHERE status IN ('PENDING', 'FAILED')) AS pending_webhooks,
        (SELECT COUNT(*)::text FROM notification_outbox WHERE status IN ('PENDING', 'FAILED')) AS outbox_backlog
    `);

    const qm = queueMetrics.rows[0] || { pending_webhooks: "0", outbox_backlog: "0" };

    // 7. Time series trends for the requested days
    const timeSeriesRes = await this.db.query<{
      day: string;
      orders_count: string;
      gmv_sum: string;
      payments_sum: string;
      new_stores: string;
    }>(`
      WITH dates AS (
        SELECT generate_series(
          CURRENT_DATE - ($1 || ' days')::interval,
          CURRENT_DATE,
          '1 day'::interval
        )::date AS d
      )
      SELECT
        to_char(dates.d, 'YYYY-MM-DD') AS day,
        COALESCE(ord.orders_count, 0)::text AS orders_count,
        COALESCE(ord.gmv_sum, 0)::text AS gmv_sum,
        COALESCE(pmt.payments_sum, 0)::text AS payments_sum,
        COALESCE(st.new_stores, 0)::text AS new_stores
      FROM dates
      LEFT JOIN (
        SELECT
          DATE(created_at) AS d,
          COUNT(*) AS orders_count,
          SUM(CASE WHEN status != 'CANCELLED' THEN total ELSE 0 END) AS gmv_sum
        FROM orders
        GROUP BY DATE(created_at)
      ) ord ON ord.d = dates.d
      LEFT JOIN (
        SELECT
          DATE(created_at) AS d,
          SUM(CASE WHEN status IN ('CAPTURED', 'REFUNDED') THEN amount ELSE 0 END) AS payments_sum
        FROM payments
        GROUP BY DATE(created_at)
      ) pmt ON pmt.d = dates.d
      LEFT JOIN (
        SELECT
          DATE(created_at) AS d,
          COUNT(*) AS new_stores
        FROM stores
        GROUP BY DATE(created_at)
      ) st ON st.d = dates.d
      ORDER BY dates.d ASC
    `, [periodDays]);

    const capturedCents = parseInt(pm.captured_cents, 10);
    const refundCents = parseInt(rm.refund_cents, 10);
    const netPaymentCents = Math.max(0, capturedCents - refundCents);
    const orphanedCaptures = parseInt(pm.orphaned_captures, 10);
    const stuckRefunds = parseInt(rm.stuck_refunds, 10);
    const pendingWebhooks = parseInt(qm.pending_webhooks, 10);
    const outboxBacklog = parseInt(qm.outbox_backlog, 10);

    let paymentPipelineStatus: "HEALTHY" | "WARNING" | "CRITICAL" = "HEALTHY";
    if (orphanedCaptures > 5 || stuckRefunds > 5) {
      paymentPipelineStatus = "CRITICAL";
    } else if (orphanedCaptures > 0 || stuckRefunds > 0 || pendingWebhooks > 10) {
      paymentPipelineStatus = "WARNING";
    }

    let workerStatus: "HEALTHY" | "DEGRADED" | "ATTENTION" = "HEALTHY";
    if (outboxBacklog > 50 || pendingWebhooks > 50) {
      workerStatus = "ATTENTION";
    } else if (outboxBacklog > 10 || pendingWebhooks > 10) {
      workerStatus = "DEGRADED";
    }

    return {
      kpis: {
        totalOrganizations: parseInt(ec.total_orgs, 10),
        totalStores: parseInt(ec.total_stores, 10),
        activeStores: parseInt(ec.active_stores, 10),
        suspendedStores: parseInt(ec.suspended_stores, 10),
        draftStores: parseInt(ec.draft_stores, 10),
        totalMerchants: parseInt(ec.total_merchants, 10),
        totalCustomers: parseInt(ec.total_customers, 10),
        totalProducts: parseInt(ec.total_products, 10),
        totalOrders: parseInt(om.total_orders, 10),
        totalTransactions: parseInt(pm.total_transactions, 10),
        capturedPaymentVolumeCents: capturedCents,
        refundVolumeCents: refundCents,
        netPaymentVolumeCents: netPaymentCents,
        gmvCents: parseInt(om.gmv_cents, 10),
        platformSubscriptionRevenueCents: parseInt(sm.sub_revenue_cents, 10),
        activeSubscriptions: parseInt(sm.active_subs, 10),
        trialSubscriptions: parseInt(sm.trial_subs, 10),
        cancelledSubscriptions: parseInt(sm.cancelled_subs, 10),
        failedPaymentsCount: parseInt(pm.failed_payments, 10),
        orphanedCapturedPaymentsCount: orphanedCaptures,
        stuckRefundsCount: stuckRefunds,
        pendingWebhooksCount: pendingWebhooks,
        outboxBacklogCount: outboxBacklog,
      },
      timeSeries: timeSeriesRes.rows.map((row) => ({
        date: row.day,
        orders: parseInt(row.orders_count, 10),
        gmvCents: parseInt(row.gmv_sum, 10),
        capturedPaymentCents: parseInt(row.payments_sum, 10),
        newStores: parseInt(row.new_stores, 10),
      })),
      healthSummary: {
        workerStatus,
        paymentPipelineStatus,
        databaseStatus: "CONNECTED",
      },
    };
  }
}
