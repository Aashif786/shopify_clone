import type { Database } from "@calcart/db";
import { PlatformAuditService } from "./audit-service.js";
import { PlatformSecurityService } from "./security-service.js";
import type { PlatformAdminRole } from "../domain/roles.js";

export interface TenantSummaryRecord {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  storeCount: number;
  primaryOwnerEmail: string | null;
  primaryOwnerName: string | null;
  planName: string;
  planCode: string;
  subscriptionStatus: string;
  totalOrders: number;
  gmvCents: number;
}

export interface Tenant360Profile {
  overview: {
    id: string;
    name: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  subscription: {
    planId: string;
    planName: string;
    planCode: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    maxStores: number;
    maxProductsPerStore: number;
  } | null;
  stores: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    currency: string;
    createdAt: string;
    productCount: number;
    orderCount: number;
    primaryDomain: string | null;
  }>;
  members: Array<{
    userId: string;
    name: string;
    email: string;
    orgRole: string;
    orgStatus: string;
    createdAt: string;
  }>;
  metrics: {
    totalProducts: number;
    totalOrders: number;
    gmvCents: number;
    capturedPaymentCents: number;
    refundCents: number;
    customerCount: number;
  };
  operationalHealth: {
    orphanedPayments: number;
    failedWebhooks: number;
    pendingNotifications: number;
  };
  activityHistory: Array<{
    id: string;
    action: string;
    actorId: string;
    actorRole: string;
    reason: string;
    status: string;
    createdAt: string;
  }>;
  securityEvents: Array<{
    id: string;
    eventType: string;
    severity: string;
    userId: string | null;
    createdAt: string;
  }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    storeName: string;
    totalAmount: number;
    currency: string;
    status: string;
    createdAt: string;
  }>;
  recentPayments: Array<{
    id: string;
    storeName: string;
    amount: number;
    currency: string;
    status: string;
    provider: string;
    createdAt: string;
  }>;
  domains: Array<{
    id: string;
    storeName: string;
    domain: string;
    status: string;
    isPrimary: boolean;
    verifiedAt: string | null;
  }>;
}

export class PlatformTenantService {
  private readonly auditService: PlatformAuditService;
  private readonly securityService: PlatformSecurityService;

  constructor(private readonly db: Database) {
    this.auditService = new PlatformAuditService(db);
    this.securityService = new PlatformSecurityService(db);
  }

  async listTenants(params: {
    search?: string;
    status?: string;
    planCode?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: TenantSummaryRecord[]; total: number }> {
    const conditions: string[] = ["1=1"];
    const values: unknown[] = [];
    let pIdx = 1;

    if (params.search) {
      conditions.push(`(o.name ILIKE $${pIdx} OR u.email ILIKE $${pIdx})`);
      values.push(`%${params.search}%`);
      pIdx++;
    }

    if (params.status) {
      conditions.push(`o.status = $${pIdx++}`);
      values.push(params.status);
    }

    if (params.planCode) {
      conditions.push(`pp.code = $${pIdx++}`);
      values.push(params.planCode);
    }

    const whereClause = conditions.join(" AND ");

    const countRes = await this.db.query<{ count: string }>(
      `SELECT COUNT(DISTINCT o.id)::text as count
       FROM organizations o
       LEFT JOIN organization_memberships om ON om.organization_id = o.id AND om.role = 'owner'
       LEFT JOIN users u ON u.id = om.user_id
       LEFT JOIN platform_subscriptions ps ON ps.organization_id = o.id
       LEFT JOIN platform_plans pp ON pp.id = ps.plan_id
       WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countRes.rows[0]?.count ?? "0", 10);

    const limit = Math.min(Math.max(params.limit ?? 25, 1), 100);
    const offset = Math.max(params.offset ?? 0, 0);

    values.push(limit);
    const limitIdx = pIdx++;
    values.push(offset);
    const offsetIdx = pIdx++;

    const rowsRes = await this.db.query<{
      id: string;
      name: string;
      status: string;
      created_at: Date;
      store_count: string;
      owner_email: string | null;
      owner_name: string | null;
      plan_name: string | null;
      plan_code: string | null;
      subscription_status: string | null;
      total_orders: string;
      gmv_cents: string;
    }>(
      `SELECT
        o.id,
        o.name,
        o.status,
        o.created_at,
        COUNT(DISTINCT s.id)::text AS store_count,
        MAX(u.email) AS owner_email,
        MAX(u.name) AS owner_name,
        COALESCE(MAX(pp.name), 'Starter Plan') AS plan_name,
        COALESCE(MAX(pp.code), 'starter') AS plan_code,
        COALESCE(MAX(ps.status), 'ACTIVE') AS subscription_status,
        COALESCE(SUM(ord.order_count), 0)::text AS total_orders,
        COALESCE(SUM(ord.gmv_sum), 0)::text AS gmv_cents
      FROM organizations o
      LEFT JOIN organization_memberships om ON om.organization_id = o.id AND om.role = 'owner'
      LEFT JOIN users u ON u.id = om.user_id
      LEFT JOIN stores s ON s.organization_id = o.id
      LEFT JOIN platform_subscriptions ps ON ps.organization_id = o.id
      LEFT JOIN platform_plans pp ON pp.id = ps.plan_id
      LEFT JOIN (
        SELECT store_id, COUNT(*) AS order_count, SUM(CASE WHEN status != 'CANCELLED' THEN total ELSE 0 END) AS gmv_sum
        FROM orders
        GROUP BY store_id
      ) ord ON ord.store_id = s.id
      WHERE ${whereClause}
      GROUP BY o.id, o.name, o.status, o.created_at
      ORDER BY o.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      values
    );

    const items: TenantSummaryRecord[] = rowsRes.rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      storeCount: parseInt(row.store_count, 10),
      primaryOwnerEmail: row.owner_email,
      primaryOwnerName: row.owner_name,
      planName: row.plan_name ?? "Starter Plan",
      planCode: row.plan_code ?? "starter",
      subscriptionStatus: row.subscription_status ?? "ACTIVE",
      totalOrders: parseInt(row.total_orders, 10),
      gmvCents: parseInt(row.gmv_cents, 10),
    }));

    return { items, total };
  }

  async getTenant360(tenantId: string): Promise<Tenant360Profile | null> {
    const orgRes = await this.db.query<{
      id: string;
      name: string;
      status: string;
      created_at: Date;
      updated_at: Date;
    }>("SELECT id, name, status, created_at, updated_at FROM organizations WHERE id = $1", [
      tenantId,
    ]);

    const org = orgRes.rows[0];
    if (!org) return null;

    // Subscription
    const subRes = await this.db.query<{
      plan_id: string;
      plan_name: string;
      plan_code: string;
      status: string;
      current_period_start: Date;
      current_period_end: Date;
      max_stores: number;
      max_products_per_store: number;
    }>(
      `SELECT
        pp.id AS plan_id,
        pp.name AS plan_name,
        pp.code AS plan_code,
        ps.status,
        ps.current_period_start,
        ps.current_period_end,
        pp.max_stores,
        pp.max_products_per_store
      FROM platform_subscriptions ps
      JOIN platform_plans pp ON pp.id = ps.plan_id
      WHERE ps.organization_id = $1
      ORDER BY ps.created_at DESC
      LIMIT 1`,
      [tenantId]
    );

    const sub = subRes.rows[0];

    // Stores
    const storesRes = await this.db.query<{
      id: string;
      name: string;
      slug: string;
      status: string;
      currency: string;
      created_at: Date;
      product_count: string;
      order_count: string;
      primary_domain: string | null;
    }>(
      `SELECT
        s.id,
        s.name,
        s.slug,
        s.status,
        s.currency,
        s.created_at,
        COUNT(DISTINCT p.id)::text AS product_count,
        COUNT(DISTINCT ord.id)::text AS order_count,
        MAX(sd.domain) AS primary_domain
      FROM stores s
      LEFT JOIN products p ON p.store_id = s.id
      LEFT JOIN orders ord ON ord.store_id = s.id
      LEFT JOIN store_domains sd ON sd.store_id = s.id AND sd.is_primary = TRUE
      WHERE s.organization_id = $1
      GROUP BY s.id, s.name, s.slug, s.status, s.currency, s.created_at
      ORDER BY s.created_at DESC`,
      [tenantId]
    );

    // Members
    const membersRes = await this.db.query<{
      user_id: string;
      name: string;
      email: string;
      org_role: string;
      org_status: string;
      created_at: Date;
    }>(
      `SELECT
        u.id AS user_id,
        u.name,
        u.email,
        om.role AS org_role,
        om.status AS org_status,
        om.created_at
      FROM organization_memberships om
      JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = $1
      ORDER BY om.created_at ASC`,
      [tenantId]
    );

    // Aggregate metrics
    const metricsRes = await this.db.query<{
      total_products: string;
      total_orders: string;
      gmv_cents: string;
      captured_cents: string;
      refund_cents: string;
      customer_count: string;
    }>(
      `SELECT
        (SELECT COUNT(*)::text FROM products p JOIN stores s ON s.id = p.store_id WHERE s.organization_id = $1) AS total_products,
        (SELECT COUNT(*)::text FROM orders o JOIN stores s ON s.id = o.store_id WHERE s.organization_id = $1) AS total_orders,
        (SELECT COALESCE(SUM(CASE WHEN o.status != 'CANCELLED' THEN o.total ELSE 0 END), 0)::text FROM orders o JOIN stores s ON s.id = o.store_id WHERE s.organization_id = $1) AS gmv_cents,
        (SELECT COALESCE(SUM(CASE WHEN pmt.status IN ('CAPTURED', 'REFUNDED') THEN pmt.amount ELSE 0 END), 0)::text FROM payments pmt JOIN stores s ON s.id = pmt.store_id WHERE s.organization_id = $1) AS captured_cents,
        (SELECT COALESCE(SUM(CASE WHEN ref.status = 'COMPLETED' THEN ref.amount ELSE 0 END), 0)::text FROM refunds ref JOIN stores s ON s.id = ref.store_id WHERE s.organization_id = $1) AS refund_cents,
        (SELECT COUNT(*)::text FROM customers c JOIN stores s ON s.id = c.store_id WHERE s.organization_id = $1) AS customer_count`,
      [tenantId]
    );

    const m = metricsRes.rows[0] || {
      total_products: "0",
      total_orders: "0",
      gmv_cents: "0",
      captured_cents: "0",
      refund_cents: "0",
      customer_count: "0",
    };

    // Health
    const healthRes = await this.db.query<{
      orphaned_payments: string;
      failed_webhooks: string;
      pending_notifications: string;
    }>(
      `SELECT
        (SELECT COUNT(*)::text FROM payments pmt JOIN stores s ON s.id = pmt.store_id WHERE s.organization_id = $1 AND pmt.status = 'CAPTURED' AND pmt.order_id IS NULL) AS orphaned_payments,
        (SELECT COUNT(*)::text FROM payment_webhook_events pwe JOIN stores s ON s.id = pwe.store_id WHERE s.organization_id = $1 AND pwe.status = 'FAILED') AS failed_webhooks,
        (SELECT COUNT(*)::text FROM notification_outbox no JOIN stores s ON s.id = no.store_id WHERE s.organization_id = $1 AND no.status IN ('PENDING', 'FAILED')) AS pending_notifications`,
      [tenantId]
    );

    const h = healthRes.rows[0] || {
      orphaned_payments: "0",
      failed_webhooks: "0",
      pending_notifications: "0",
    };

    // Activity History (Audit Logs for this tenant)
    const auditRes = await this.db.query<{
      id: string;
      action: string;
      actor_id: string;
      actor_role: string;
      reason: string;
      status: string;
      created_at: Date;
    }>(
      `SELECT id, action, actor_id, actor_role, reason, status, created_at
       FROM platform_audit_logs
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [tenantId]
    );

    // Security Events
    const securityRes = await this.db.query<{
      id: string;
      event_type: string;
      severity: string;
      user_id: string | null;
      created_at: Date;
    }>(
      `SELECT pse.id, pse.event_type, pse.severity, pse.user_id, pse.created_at
       FROM platform_security_events pse
       WHERE pse.user_id IN (SELECT user_id FROM organization_memberships WHERE organization_id = $1)
       ORDER BY pse.created_at DESC
       LIMIT 10`,
      [tenantId]
    );

    // Recent Orders across all stores
    const ordersRes = await this.db.query<{
      id: string;
      order_number: string;
      store_name: string;
      total: number;
      currency: string;
      status: string;
      created_at: Date;
    }>(
      `SELECT o.id, o.order_number, s.name as store_name, o.total, o.currency, o.status, o.created_at
       FROM orders o
       JOIN stores s ON s.id = o.store_id
       WHERE s.organization_id = $1
       ORDER BY o.created_at DESC
       LIMIT 10`,
      [tenantId]
    );

    // Recent Payments
    const paymentsRes = await this.db.query<{
      id: string;
      store_name: string;
      amount: number;
      currency: string;
      status: string;
      provider: string;
      created_at: Date;
    }>(
      `SELECT p.id, s.name as store_name, p.amount, p.currency, p.status, p.provider, p.created_at
       FROM payments p
       JOIN stores s ON s.id = p.store_id
       WHERE s.organization_id = $1
       ORDER BY p.created_at DESC
       LIMIT 10`,
      [tenantId]
    );

    // Store Domains
    const domainsRes = await this.db.query<{
      id: string;
      store_name: string;
      domain: string;
      status: string;
      is_primary: boolean;
      verified_at: Date | null;
    }>(
      `SELECT sd.id, s.name as store_name, sd.domain, sd.status, sd.is_primary, sd.verified_at
       FROM store_domains sd
       JOIN stores s ON s.id = sd.store_id
       WHERE s.organization_id = $1
       ORDER BY sd.is_primary DESC, sd.created_at DESC`,
      [tenantId]
    );

    return {
      overview: {
        id: org.id,
        name: org.name,
        status: org.status,
        createdAt: org.created_at.toISOString(),
        updatedAt: org.updated_at.toISOString(),
      },
      subscription: sub
        ? {
            planId: sub.plan_id,
            planName: sub.plan_name,
            planCode: sub.plan_code,
            status: sub.status,
            currentPeriodStart: sub.current_period_start.toISOString(),
            currentPeriodEnd: sub.current_period_end.toISOString(),
            maxStores: sub.max_stores,
            maxProductsPerStore: sub.max_products_per_store,
          }
        : null,
      stores: storesRes.rows.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        status: s.status,
        currency: s.currency,
        createdAt: s.created_at.toISOString(),
        productCount: parseInt(s.product_count, 10),
        orderCount: parseInt(s.order_count, 10),
        primaryDomain: s.primary_domain,
      })),
      members: membersRes.rows.map((mem) => ({
        userId: mem.user_id,
        name: mem.name,
        email: mem.email,
        orgRole: mem.org_role,
        orgStatus: mem.org_status,
        createdAt: mem.created_at.toISOString(),
      })),
      metrics: {
        totalProducts: parseInt(m.total_products, 10),
        totalOrders: parseInt(m.total_orders, 10),
        gmvCents: parseInt(m.gmv_cents, 10),
        capturedPaymentCents: parseInt(m.captured_cents, 10),
        refundCents: parseInt(m.refund_cents, 10),
        customerCount: parseInt(m.customer_count, 10),
      },
      operationalHealth: {
        orphanedPayments: parseInt(h.orphaned_payments, 10),
        failedWebhooks: parseInt(h.failed_webhooks, 10),
        pendingNotifications: parseInt(h.pending_notifications, 10),
      },
      activityHistory: auditRes.rows.map((a) => ({
        id: a.id,
        action: a.action,
        actorId: a.actor_id,
        actorRole: a.actor_role,
        reason: a.reason,
        status: a.status,
        createdAt: a.created_at.toISOString(),
      })),
      securityEvents: securityRes.rows.map((se) => ({
        id: se.id,
        eventType: se.event_type,
        severity: se.severity,
        userId: se.user_id,
        createdAt: se.created_at.toISOString(),
      })),
      recentOrders: ordersRes.rows.map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        storeName: o.store_name,
        totalAmount: o.total,
        currency: o.currency,
        status: o.status,
        createdAt: o.created_at.toISOString(),
      })),
      recentPayments: paymentsRes.rows.map((p) => ({
        id: p.id,
        storeName: p.store_name,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        provider: p.provider,
        createdAt: p.created_at.toISOString(),
      })),
      domains: domainsRes.rows.map((d) => ({
        id: d.id,
        storeName: d.store_name,
        domain: d.domain,
        status: d.status,
        isPrimary: d.is_primary,
        verifiedAt: d.verified_at ? d.verified_at.toISOString() : null,
      })),
    };
  }

  async updateTenantStatus(params: {
    tenantId: string;
    newStatus: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
    reason: string;
    actorId: string;
    actorRole: PlatformAdminRole;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<void> {
    const orgRes = await this.db.query<{ id: string; status: string }>(
      "SELECT id, status FROM organizations WHERE id = $1",
      [params.tenantId]
    );
    const org = orgRes.rows[0];
    if (!org) throw new Error("Organization not found");

    const previousStatus = org.status;

    await this.db.query("UPDATE organizations SET status = $1, updated_at = NOW() WHERE id = $2", [
      params.newStatus,
      params.tenantId,
    ]);

    // Also cascade store statuses if suspending
    if (params.newStatus === "SUSPENDED") {
      await this.db.query(
        "UPDATE stores SET status = 'SUSPENDED', updated_at = NOW() WHERE organization_id = $1 AND status = 'ACTIVE'",
        [params.tenantId]
      );
    } else if (params.newStatus === "ACTIVE" && previousStatus === "SUSPENDED") {
      await this.db.query(
        "UPDATE stores SET status = 'ACTIVE', updated_at = NOW() WHERE organization_id = $1 AND status = 'SUSPENDED'",
        [params.tenantId]
      );
    }

    await this.auditService.record({
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: "tenant.status_change",
      resourceType: "organization",
      resourceId: params.tenantId,
      tenantId: params.tenantId,
      reason: params.reason,
      status: "SUCCESS",
      details: {
        previousStatus,
        newStatus: params.newStatus,
      },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    if (params.newStatus === "SUSPENDED") {
      await this.securityService.record({
        eventType: "TENANT_SUSPENDED_BY_ADMIN",
        severity: "HIGH",
        userId: params.actorId,
        details: {
          tenantId: params.tenantId,
          reason: params.reason,
        },
      });
    }
  }
}
