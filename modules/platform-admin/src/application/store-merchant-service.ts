import type { Database } from "@calcart/db";
import { PlatformAuditService } from "./audit-service.js";
import { PlatformSecurityService } from "./security-service.js";
import type { PlatformAdminRole } from "../domain/roles.js";

export interface StoreSummaryRecord {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
  organizationName: string;
  status: string;
  currency: string;
  createdAt: string;
  primaryDomain: string | null;
  productCount: number;
  orderCount: number;
  gmvCents: number;
}

export interface StoreDetailRecord {
  store: {
    id: string;
    organizationId: string;
    organizationName: string;
    name: string;
    slug: string;
    status: string;
    currency: string;
    locale: string;
    timezone: string;
    createdAt: string;
    updatedAt: string;
  };
  domains: Array<{
    id: string;
    domain: string;
    status: string;
    isPrimary: boolean;
    verifiedAt: string | null;
    createdAt: string;
  }>;
  members: Array<{
    userId: string;
    name: string;
    email: string;
    role: string;
    status: string;
    createdAt: string;
  }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    totalAmount: number;
    currency: string;
    status: string;
    paymentStatus: string;
    fulfillmentStatus: string;
    customerEmail: string | null;
    createdAt: string;
  }>;
  metrics: {
    productCount: number;
    orderCount: number;
    gmvCents: number;
    customerCount: number;
    capturedCents: number;
    refundCents: number;
  };
}

export interface MerchantSummaryRecord {
  id: string;
  email: string;
  name: string;
  status: string;
  createdAt: string;
  isPlatformAdmin: boolean;
  storeCount: number;
  organizationCount: number;
  activeSessionCount: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
}

export class PlatformStoreMerchantService {
  private readonly auditService: PlatformAuditService;
  private readonly securityService: PlatformSecurityService;

  constructor(private readonly db: Database) {
    this.auditService = new PlatformAuditService(db);
    this.securityService = new PlatformSecurityService(db);
  }

  async listStores(params: {
    search?: string;
    organizationId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: StoreSummaryRecord[]; total: number }> {
    const conditions: string[] = ["1=1"];
    const values: unknown[] = [];
    let pIdx = 1;

    if (params.search) {
      conditions.push(`(s.name ILIKE $${pIdx} OR s.slug ILIKE $${pIdx} OR o.name ILIKE $${pIdx})`);
      values.push(`%${params.search}%`);
      pIdx++;
    }
    if (params.organizationId) {
      conditions.push(`s.organization_id = $${pIdx++}`);
      values.push(params.organizationId);
    }
    if (params.status) {
      conditions.push(`s.status = $${pIdx++}`);
      values.push(params.status);
    }

    const whereClause = conditions.join(" AND ");

    const countRes = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text as count
       FROM stores s
       JOIN organizations o ON o.id = s.organization_id
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
      slug: string;
      organization_id: string;
      organization_name: string;
      status: string;
      currency: string;
      created_at: Date;
      primary_domain: string | null;
      product_count: string;
      order_count: string;
      gmv_cents: string;
    }>(
      `SELECT
        s.id,
        s.name,
        s.slug,
        s.organization_id,
        o.name AS organization_name,
        s.status,
        s.currency,
        s.created_at,
        MAX(sd.domain) AS primary_domain,
        COUNT(DISTINCT p.id)::text AS product_count,
        COUNT(DISTINCT ord.id)::text AS order_count,
        COALESCE(SUM(CASE WHEN ord.status != 'CANCELLED' THEN ord.total ELSE 0 END), 0)::text AS gmv_cents
      FROM stores s
      JOIN organizations o ON o.id = s.organization_id
      LEFT JOIN store_domains sd ON sd.store_id = s.id AND sd.is_primary = TRUE
      LEFT JOIN products p ON p.store_id = s.id
      LEFT JOIN orders ord ON ord.store_id = s.id
      WHERE ${whereClause}
      GROUP BY s.id, s.name, s.slug, s.organization_id, o.name, s.status, s.currency, s.created_at
      ORDER BY s.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      values
    );

    const items: StoreSummaryRecord[] = rowsRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      organizationId: r.organization_id,
      organizationName: r.organization_name,
      status: r.status,
      currency: r.currency,
      createdAt: r.created_at.toISOString(),
      primaryDomain: r.primary_domain,
      productCount: parseInt(r.product_count, 10),
      orderCount: parseInt(r.order_count, 10),
      gmvCents: parseInt(r.gmv_cents, 10),
    }));

    return { items, total };
  }

  async getStoreDetail(storeId: string): Promise<StoreDetailRecord | null> {
    const storeRes = await this.db.query<{
      id: string;
      organization_id: string;
      organization_name: string;
      name: string;
      slug: string;
      status: string;
      currency: string;
      locale: string;
      timezone: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT
        s.id,
        s.organization_id,
        o.name as organization_name,
        s.name,
        s.slug,
        s.status,
        s.currency,
        s.locale,
        s.timezone,
        s.created_at,
        s.updated_at
      FROM stores s
      JOIN organizations o ON o.id = s.organization_id
      WHERE s.id = $1`,
      [storeId]
    );

    const store = storeRes.rows[0];
    if (!store) return null;

    // Domains
    const domainsRes = await this.db.query<{
      id: string;
      domain: string;
      status: string;
      is_primary: boolean;
      verified_at: Date | null;
      created_at: Date;
    }>(
      "SELECT id, domain, status, is_primary, verified_at, created_at FROM store_domains WHERE store_id = $1 ORDER BY is_primary DESC, created_at ASC",
      [storeId]
    );

    // Members
    const membersRes = await this.db.query<{
      user_id: string;
      name: string;
      email: string;
      role: string;
      status: string;
      created_at: Date;
    }>(
      `SELECT
        u.id as user_id,
        u.name,
        u.email,
        sm.role,
        sm.status,
        sm.created_at
      FROM store_memberships sm
      JOIN users u ON u.id = sm.user_id
      WHERE sm.store_id = $1
      ORDER BY sm.created_at ASC`,
      [storeId]
    );

    // Recent orders
    const ordersRes = await this.db.query<{
      id: string;
      order_number: string;
      total_amount: number;
      currency: string;
      status: string;
      payment_status: string;
      fulfillment_status: string;
      customer_email: string | null;
      created_at: Date;
    }>(
      `SELECT
        o.id,
        o.order_number,
        o.total as total_amount,
        o.currency,
        o.status,
        o.payment_status,
        o.fulfillment_status,
        c.email as customer_email,
        o.created_at
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.store_id = $1
      ORDER BY o.created_at DESC
      LIMIT 10`,
      [storeId]
    );

    // Store Metrics
    const metricsRes = await this.db.query<{
      product_count: string;
      order_count: string;
      gmv_cents: string;
      customer_count: string;
      captured_cents: string;
      refund_cents: string;
    }>(
      `SELECT
        (SELECT COUNT(*)::text FROM products WHERE store_id = $1) AS product_count,
        (SELECT COUNT(*)::text FROM orders WHERE store_id = $1) AS order_count,
        (SELECT COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN total ELSE 0 END), 0)::text FROM orders WHERE store_id = $1) AS gmv_cents,
        (SELECT COUNT(*)::text FROM customers WHERE store_id = $1) AS customer_count,
        (SELECT COALESCE(SUM(CASE WHEN status IN ('CAPTURED', 'REFUNDED') THEN amount ELSE 0 END), 0)::text FROM payments WHERE store_id = $1) AS captured_cents,
        (SELECT COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN amount ELSE 0 END), 0)::text FROM refunds WHERE store_id = $1) AS refund_cents`,
      [storeId]
    );

    const m = metricsRes.rows[0] || {
      product_count: "0",
      order_count: "0",
      gmv_cents: "0",
      customer_count: "0",
      captured_cents: "0",
      refund_cents: "0",
    };

    return {
      store: {
        id: store.id,
        organizationId: store.organization_id,
        organizationName: store.organization_name,
        name: store.name,
        slug: store.slug,
        status: store.status,
        currency: store.currency,
        locale: store.locale,
        timezone: store.timezone,
        createdAt: store.created_at.toISOString(),
        updatedAt: store.updated_at.toISOString(),
      },
      domains: domainsRes.rows.map((d) => ({
        id: d.id,
        domain: d.domain,
        status: d.status,
        isPrimary: d.is_primary,
        verifiedAt: d.verified_at?.toISOString() ?? null,
        createdAt: d.created_at.toISOString(),
      })),
      members: membersRes.rows.map((mem) => ({
        userId: mem.user_id,
        name: mem.name,
        email: mem.email,
        role: mem.role,
        status: mem.status,
        createdAt: mem.created_at.toISOString(),
      })),
      recentOrders: ordersRes.rows.map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        totalAmount: o.total_amount,
        currency: o.currency,
        status: o.status,
        paymentStatus: o.payment_status,
        fulfillmentStatus: o.fulfillment_status,
        customerEmail: o.customer_email,
        createdAt: o.created_at.toISOString(),
      })),
      metrics: {
        productCount: parseInt(m.product_count, 10),
        orderCount: parseInt(m.order_count, 10),
        gmvCents: parseInt(m.gmv_cents, 10),
        customerCount: parseInt(m.customer_count, 10),
        capturedCents: parseInt(m.captured_cents, 10),
        refundCents: parseInt(m.refund_cents, 10),
      },
    };
  }

  async listMerchants(params: {
    search?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: MerchantSummaryRecord[]; total: number }> {
    const conditions: string[] = ["1=1"];
    const values: unknown[] = [];
    let pIdx = 1;

    if (params.search) {
      conditions.push(`(u.email ILIKE $${pIdx} OR u.name ILIKE $${pIdx})`);
      values.push(`%${params.search}%`);
      pIdx++;
    }
    if (params.status) {
      conditions.push(`u.status = $${pIdx++}`);
      values.push(params.status);
    }

    const whereClause = conditions.join(" AND ");

    const countRes = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM users u WHERE ${whereClause}`,
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
      email: string;
      name: string;
      status: string;
      created_at: Date;
      is_platform_admin: boolean;
      store_count: string;
      org_count: string;
      active_sessions: string;
      locked_until: Date | null;
      last_login_at: Date | null;
    }>(
      `SELECT
        u.id,
        u.email,
        u.name,
        u.status,
        u.created_at,
        COALESCE(u.is_platform_admin, FALSE) AS is_platform_admin,
        COUNT(DISTINCT sm.store_id)::text AS store_count,
        COUNT(DISTINCT om.organization_id)::text AS org_count,
        (SELECT COUNT(*)::text FROM sessions s WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > NOW()) AS active_sessions,
        pau.locked_until,
        pau.last_login_at
      FROM users u
      LEFT JOIN store_memberships sm ON sm.user_id = u.id
      LEFT JOIN organization_memberships om ON om.user_id = u.id
      LEFT JOIN platform_admin_users pau ON pau.id = u.id
      WHERE ${whereClause}
      GROUP BY u.id, u.email, u.name, u.status, u.created_at, u.is_platform_admin, pau.locked_until, pau.last_login_at
      ORDER BY u.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      values
    );

    const items: MerchantSummaryRecord[] = rowsRes.rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      status: r.status,
      createdAt: r.created_at.toISOString(),
      isPlatformAdmin: Boolean(r.is_platform_admin),
      storeCount: parseInt(r.store_count, 10),
      organizationCount: parseInt(r.org_count, 10),
      activeSessionCount: parseInt(r.active_sessions, 10),
      lockedUntil: r.locked_until ? r.locked_until.toISOString() : null,
      lastLoginAt: r.last_login_at ? r.last_login_at.toISOString() : null,
    }));

    return { items, total };
  }

  async revokeMerchantSessions(params: {
    userId: string;
    reason: string;
    actorId: string;
    actorRole: PlatformAdminRole;
  }): Promise<{ revokedCount: number }> {
    const res = await this.db.query(
      `UPDATE sessions
       SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
      [params.userId]
    );

    await this.auditService.record({
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: "user.sessions_revoked",
      resourceType: "user",
      resourceId: params.userId,
      reason: params.reason,
      status: "SUCCESS",
      details: { rowCount: res.rowCount },
    });

    await this.securityService.record({
      eventType: "MERCHANT_SESSIONS_REVOKED_BY_ADMIN",
      severity: "MEDIUM",
      userId: params.userId,
      details: { actorId: params.actorId, reason: params.reason },
    });

    return { revokedCount: res.rowCount ?? 0 };
  }
}
