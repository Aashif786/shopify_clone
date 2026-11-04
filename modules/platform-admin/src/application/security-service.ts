import { randomUUID } from "node:crypto";
import type { Database } from "@calcart/db";

export type SecuritySeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export interface SecurityEventParams {
  eventType: string;
  severity: SecuritySeverity;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown>;
}

export interface SecurityEventRecord {
  id: string;
  eventType: string;
  severity: SecuritySeverity;
  userId: string | null;
  userEmail?: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export class PlatformSecurityService {
  constructor(private readonly db: Database) {}

  async record(params: SecurityEventParams): Promise<SecurityEventRecord> {
    const id = randomUUID();
    const result = await this.db.query<{
      id: string;
      event_type: string;
      severity: SecuritySeverity;
      user_id: string | null;
      ip_address: string | null;
      user_agent: string | null;
      details: string | Record<string, unknown>;
      created_at: Date;
    }>(
      `INSERT INTO platform_security_events (
        id, event_type, severity, user_id, ip_address, user_agent, details, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
      RETURNING *`,
      [
        id,
        params.eventType,
        params.severity,
        params.userId ?? null,
        params.ipAddress ?? null,
        params.userAgent ?? null,
        JSON.stringify(params.details ?? {}),
      ]
    );

    const row = result.rows[0];
    if (!row) throw new Error("Failed to insert security event");

    return {
      id: row.id,
      eventType: row.event_type,
      severity: row.severity,
      userId: row.user_id,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      details: typeof row.details === "string" ? JSON.parse(row.details) : row.details,
      createdAt: row.created_at.toISOString(),
    };
  }

  async list(filter: {
    eventType?: string;
    severity?: SecuritySeverity;
    userId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: SecurityEventRecord[]; total: number }> {
    const conditions: string[] = ["1=1"];
    const values: unknown[] = [];
    let pIdx = 1;

    if (filter.eventType) {
      conditions.push(`pse.event_type ILIKE $${pIdx++}`);
      values.push(`%${filter.eventType}%`);
    }
    if (filter.severity) {
      conditions.push(`pse.severity = $${pIdx++}`);
      values.push(filter.severity);
    }
    if (filter.userId) {
      conditions.push(`pse.user_id = $${pIdx++}`);
      values.push(filter.userId);
    }

    const whereClause = conditions.join(" AND ");

    const countRes = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM platform_security_events pse WHERE ${whereClause}`,
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
      event_type: string;
      severity: SecuritySeverity;
      user_id: string | null;
      user_email: string | null;
      ip_address: string | null;
      user_agent: string | null;
      details: string | Record<string, unknown>;
      created_at: Date;
    }>(
      `SELECT
        pse.id,
        pse.event_type,
        pse.severity,
        pse.user_id,
        u.email as user_email,
        pse.ip_address,
        pse.user_agent,
        pse.details,
        pse.created_at
      FROM platform_security_events pse
      LEFT JOIN users u ON u.id = pse.user_id
      WHERE ${whereClause}
      ORDER BY pse.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      values
    );

    const items: SecurityEventRecord[] = rowsRes.rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      severity: row.severity,
      userId: row.user_id,
      userEmail: row.user_email,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      details: typeof row.details === "string" ? JSON.parse(row.details) : row.details,
      createdAt: row.created_at.toISOString(),
    }));

    return { items, total };
  }
}
