import { randomUUID } from "node:crypto";
import type { Database } from "@calcart/db";
import type { PlatformAdminRole } from "../domain/roles.js";

export interface CreateAuditLogParams {
  actorId: string;
  actorRole: PlatformAdminRole;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  tenantId?: string | null;
  storeId?: string | null;
  reason: string;
  details?: Record<string, unknown>;
  status?: "SUCCESS" | "FAILURE";
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface PlatformAuditLogRecord {
  id: string;
  actorId: string;
  actorEmail?: string;
  actorName?: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  tenantId: string | null;
  tenantName?: string | null;
  storeId: string | null;
  storeName?: string | null;
  reason: string;
  details: Record<string, unknown>;
  status: "SUCCESS" | "FAILURE";
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditLogFilter {
  actorId?: string;
  action?: string;
  resourceType?: string;
  tenantId?: string;
  storeId?: string;
  status?: "SUCCESS" | "FAILURE";
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export class PlatformAuditService {
  constructor(private readonly db: Database) {}

  async record(params: CreateAuditLogParams): Promise<PlatformAuditLogRecord> {
    const id = randomUUID();
    const reason = params.reason?.trim();
    if (!reason || reason.length < 5) {
      throw new Error("Audit log reason is mandatory and must be at least 5 characters.");
    }

    const result = await this.db.query<{
      id: string;
      actor_id: string;
      actor_role: string;
      action: string;
      resource_type: string;
      resource_id: string | null;
      tenant_id: string | null;
      store_id: string | null;
      reason: string;
      details: string | Record<string, unknown>;
      status: "SUCCESS" | "FAILURE";
      ip_address: string | null;
      user_agent: string | null;
      created_at: Date;
    }>(
      `INSERT INTO platform_audit_logs (
        id, actor_id, actor_role, action, resource_type, resource_id,
        tenant_id, store_id, reason, details, status, ip_address, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, NOW())
      RETURNING *`,
      [
        id,
        params.actorId,
        params.actorRole,
        params.action,
        params.resourceType,
        params.resourceId ?? null,
        params.tenantId ?? null,
        params.storeId ?? null,
        reason,
        JSON.stringify(params.details ?? {}),
        params.status ?? "SUCCESS",
        params.ipAddress ?? null,
        params.userAgent ?? null,
      ]
    );

    const row = result.rows[0];
    if (!row) throw new Error("Failed to insert audit log");

    return {
      id: row.id,
      actorId: row.actor_id,
      actorRole: row.actor_role,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      tenantId: row.tenant_id,
      storeId: row.store_id,
      reason: row.reason,
      details: typeof row.details === "string" ? JSON.parse(row.details) : row.details,
      status: row.status,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at.toISOString(),
    };
  }

  async list(filter: AuditLogFilter = {}): Promise<{
    items: PlatformAuditLogRecord[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const conditions: string[] = ["1=1"];
    const values: unknown[] = [];
    let pIdx = 1;

    if (filter.actorId) {
      conditions.push(`pal.actor_id = $${pIdx++}`);
      values.push(filter.actorId);
    }
    if (filter.action) {
      conditions.push(`pal.action ILIKE $${pIdx++}`);
      values.push(`%${filter.action}%`);
    }
    if (filter.resourceType) {
      conditions.push(`pal.resource_type = $${pIdx++}`);
      values.push(filter.resourceType);
    }
    if (filter.tenantId) {
      conditions.push(`pal.tenant_id = $${pIdx++}`);
      values.push(filter.tenantId);
    }
    if (filter.storeId) {
      conditions.push(`pal.store_id = $${pIdx++}`);
      values.push(filter.storeId);
    }
    if (filter.status) {
      conditions.push(`pal.status = $${pIdx++}`);
      values.push(filter.status);
    }
    if (filter.startDate) {
      conditions.push(`pal.created_at >= $${pIdx++}`);
      values.push(filter.startDate);
    }
    if (filter.endDate) {
      conditions.push(`pal.created_at <= $${pIdx++}`);
      values.push(filter.endDate);
    }

    const whereClause = conditions.join(" AND ");

    const countRes = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM platform_audit_logs pal WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countRes.rows[0]?.count ?? "0", 10);

    const limit = Math.min(Math.max(filter.limit ?? 25, 1), 100);
    const offset = Math.max(filter.offset ?? 0, 0);

    values.push(limit);
    const limitIdx = pIdx++;
    values.push(offset);
    const offsetIdx = pIdx++;

    const rowsRes = await this.db.query<{
      id: string;
      actor_id: string;
      actor_email: string | null;
      actor_name: string | null;
      actor_role: string;
      action: string;
      resource_type: string;
      resource_id: string | null;
      tenant_id: string | null;
      tenant_name: string | null;
      store_id: string | null;
      store_name: string | null;
      reason: string;
      details: string | Record<string, unknown>;
      status: "SUCCESS" | "FAILURE";
      ip_address: string | null;
      user_agent: string | null;
      created_at: Date;
    }>(
      `SELECT
        pal.id,
        pal.actor_id,
        u.email as actor_email,
        u.name as actor_name,
        pal.actor_role,
        pal.action,
        pal.resource_type,
        pal.resource_id,
        pal.tenant_id,
        o.name as tenant_name,
        pal.store_id,
        s.name as store_name,
        pal.reason,
        pal.details,
        pal.status,
        pal.ip_address,
        pal.user_agent,
        pal.created_at
      FROM platform_audit_logs pal
      LEFT JOIN users u ON u.id = pal.actor_id
      LEFT JOIN organizations o ON o.id = pal.tenant_id
      LEFT JOIN stores s ON s.id = pal.store_id
      WHERE ${whereClause}
      ORDER BY pal.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      values
    );

    const items: PlatformAuditLogRecord[] = rowsRes.rows.map((row) => ({
      id: row.id,
      actorId: row.actor_id,
      actorEmail: row.actor_email ?? undefined,
      actorName: row.actor_name ?? undefined,
      actorRole: row.actor_role,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      storeId: row.store_id,
      storeName: row.store_name,
      reason: row.reason,
      details: typeof row.details === "string" ? JSON.parse(row.details) : row.details,
      status: row.status,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at.toISOString(),
    }));

    return { items, total, limit, offset };
  }
}
