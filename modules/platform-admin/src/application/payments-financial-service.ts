import type { Database } from "@calcart/db";
import { PlatformAuditService } from "./audit-service.js";
import { PlatformSecurityService } from "./security-service.js";
import type { PlatformAdminRole } from "../domain/roles.js";

export interface PaymentSummaryRecord {
  id: string;
  storeId: string;
  storeName: string;
  organizationName: string;
  checkoutId: string;
  orderId: string | null;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  providerPaymentId: string | null;
  providerOrderId: string | null;
  reconciliationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentDetailRecord extends PaymentSummaryRecord {
  attempts: Array<{
    id: string;
    amount: number;
    status: string;
    errorCode: string | null;
    errorDescription: string | null;
    createdAt: string;
  }>;
  webhooks: Array<{
    id: string;
    eventId: string;
    eventType: string;
    status: string;
    retryCount: number;
    errorMessage: string | null;
    processedAt: string | null;
    createdAt: string;
  }>;
  refunds: Array<{
    id: string;
    amount: number;
    status: string;
    providerRefundId: string | null;
    reason: string | null;
    createdAt: string;
  }>;
}

export class PlatformPaymentsFinancialService {
  private readonly auditService: PlatformAuditService;
  private readonly securityService: PlatformSecurityService;

  constructor(private readonly db: Database) {
    this.auditService = new PlatformAuditService(db);
    this.securityService = new PlatformSecurityService(db);
  }

  async listPayments(params: {
    search?: string;
    storeId?: string;
    status?: string;
    isOrphaned?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    items: PaymentSummaryRecord[];
    total: number;
    stats: {
      totalVolumeCents: number;
      capturedCount: number;
      failedCount: number;
      orphanedCount: number;
      stuckRefundsCount: number;
    };
  }> {
    const conditions: string[] = ["1=1"];
    const values: unknown[] = [];
    let pIdx = 1;

    if (params.search) {
      conditions.push(
        `(pa.provider_payment_id ILIKE $${pIdx} OR pa.provider_order_id ILIKE $${pIdx} OR s.name ILIKE $${pIdx} OR p.id::text ILIKE $${pIdx})`
      );
      values.push(`%${params.search}%`);
      pIdx++;
    }
    if (params.storeId) {
      conditions.push(`p.store_id = $${pIdx++}`);
      values.push(params.storeId);
    }
    if (params.status) {
      conditions.push(`p.status = $${pIdx++}`);
      values.push(params.status);
    }
    if (params.isOrphaned) {
      conditions.push(`p.status = 'CAPTURED' AND p.order_id IS NULL`);
    }

    const whereClause = conditions.join(" AND ");

    const countRes = await this.db.query<{ count: string }>(
      `SELECT COUNT(DISTINCT p.id)::text as count
       FROM payments p
       JOIN stores s ON s.id = p.store_id
       LEFT JOIN payment_attempts pa ON pa.payment_id = p.id
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
      store_id: string;
      store_name: string;
      organization_name: string;
      checkout_id: string;
      order_id: string | null;
      amount: number;
      currency: string;
      status: string;
      provider: string;
      provider_payment_id: string | null;
      provider_order_id: string | null;
      reconciliation_reason: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT
        p.id,
        p.store_id,
        s.name AS store_name,
        o.name AS organization_name,
        p.checkout_id,
        p.order_id,
        p.amount,
        p.currency,
        p.status,
        p.provider,
        MAX(pa.provider_payment_id) AS provider_payment_id,
        MAX(pa.provider_order_id) AS provider_order_id,
        p.reconciliation_reason,
        p.created_at,
        p.updated_at
      FROM payments p
      JOIN stores s ON s.id = p.store_id
      JOIN organizations o ON o.id = s.organization_id
      LEFT JOIN payment_attempts pa ON pa.payment_id = p.id
      WHERE ${whereClause}
      GROUP BY p.id, p.store_id, s.name, o.name, p.checkout_id, p.order_id, p.amount, p.currency, p.status, p.provider, p.reconciliation_reason, p.created_at, p.updated_at
      ORDER BY p.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      values
    );

    // Global Stats for Financial Control Center
    const statsRes = await this.db.query<{
      captured_cents: string;
      captured_count: string;
      failed_count: string;
      orphaned_count: string;
      stuck_refunds: string;
    }>(`
      SELECT
        COALESCE(SUM(CASE WHEN status IN ('CAPTURED', 'REFUNDED') THEN amount ELSE 0 END), 0)::text AS captured_cents,
        COUNT(CASE WHEN status = 'CAPTURED' THEN 1 END)::text AS captured_count,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END)::text AS failed_count,
        COUNT(CASE WHEN status = 'CAPTURED' AND order_id IS NULL THEN 1 END)::text AS orphaned_count,
        (SELECT COUNT(*)::text FROM refunds WHERE status IN ('PENDING', 'PROCESSING') AND created_at < NOW() - INTERVAL '15 minutes') AS stuck_refunds
      FROM payments
    `);

    const st = statsRes.rows[0] || {
      captured_cents: "0",
      captured_count: "0",
      failed_count: "0",
      orphaned_count: "0",
      stuck_refunds: "0",
    };

    const items: PaymentSummaryRecord[] = rowsRes.rows.map((r) => ({
      id: r.id,
      storeId: r.store_id,
      storeName: r.store_name,
      organizationName: r.organization_name,
      checkoutId: r.checkout_id,
      orderId: r.order_id,
      amount: r.amount,
      currency: r.currency,
      status: r.status,
      provider: r.provider,
      providerPaymentId: r.provider_payment_id,
      providerOrderId: r.provider_order_id,
      reconciliationReason: r.reconciliation_reason,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    }));

    return {
      items,
      total,
      stats: {
        totalVolumeCents: parseInt(st.captured_cents, 10),
        capturedCount: parseInt(st.captured_count, 10),
        failedCount: parseInt(st.failed_count, 10),
        orphanedCount: parseInt(st.orphaned_count, 10),
        stuckRefundsCount: parseInt(st.stuck_refunds, 10),
      },
    };
  }

  async getPaymentDetail(paymentId: string): Promise<PaymentDetailRecord | null> {
    const pmtRes = await this.db.query<{
      id: string;
      store_id: string;
      store_name: string;
      organization_name: string;
      checkout_id: string;
      order_id: string | null;
      amount: number;
      currency: string;
      status: string;
      provider: string;
      provider_payment_id: string | null;
      provider_order_id: string | null;
      reconciliation_reason: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT
        p.id,
        p.store_id,
        s.name AS store_name,
        o.name AS organization_name,
        p.checkout_id,
        p.order_id,
        p.amount,
        p.currency,
        p.status,
        p.provider,
        MAX(pa.provider_payment_id) AS provider_payment_id,
        MAX(pa.provider_order_id) AS provider_order_id,
        p.reconciliation_reason,
        p.created_at,
        p.updated_at
      FROM payments p
      JOIN stores s ON s.id = p.store_id
      JOIN organizations o ON o.id = s.organization_id
      LEFT JOIN payment_attempts pa ON pa.payment_id = p.id
      WHERE p.id = $1
      GROUP BY p.id, p.store_id, s.name, o.name, p.checkout_id, p.order_id, p.amount, p.currency, p.status, p.provider, p.reconciliation_reason, p.created_at, p.updated_at`,
      [paymentId]
    );

    const payment = pmtRes.rows[0];
    if (!payment) return null;

    // Attempts
    const attemptsRes = await this.db.query<{
      id: string;
      amount: number;
      status: string;
      failure_code: string | null;
      failure_message: string | null;
      created_at: Date;
    }>(
      "SELECT id, amount, status, failure_code, failure_message, created_at FROM payment_attempts WHERE payment_id = $1 ORDER BY attempt_number ASC",
      [paymentId]
    );

    // Webhooks
    const webhooksRes = await this.db.query<{
      id: string;
      event_id: string;
      event_type: string;
      status: string;
      retry_count: number;
      error_message: string | null;
      processed_at: Date | null;
      created_at: Date;
    }>(
      `SELECT id, provider_event_id AS event_id, event_type, status, 0 AS retry_count, error_message, processed_at, created_at
       FROM payment_webhook_events
       WHERE payment_id = $1 OR (store_id = $2 AND (payload->>'payment_id' = $3 OR payload->'payload'->'payment'->'entity'->>'id' = $3))
       ORDER BY created_at DESC
       LIMIT 10`,
      [payment.id, payment.store_id, payment.provider_payment_id ?? payment.id]
    );

    // Refunds
    const refundsRes = await this.db.query<{
      id: string;
      amount: number;
      status: string;
      provider_refund_id: string | null;
      reason: string | null;
      created_at: Date;
    }>(
      "SELECT id, amount, status, provider_refund_id, reason, created_at FROM refunds WHERE payment_id = $1 ORDER BY created_at ASC",
      [paymentId]
    );

    return {
      id: payment.id,
      storeId: payment.store_id,
      storeName: payment.store_name,
      organizationName: payment.organization_name,
      checkoutId: payment.checkout_id,
      orderId: payment.order_id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      provider: payment.provider,
      providerPaymentId: payment.provider_payment_id,
      providerOrderId: payment.provider_order_id,
      reconciliationReason: payment.reconciliation_reason,
      createdAt: payment.created_at.toISOString(),
      updatedAt: payment.updated_at.toISOString(),
      attempts: attemptsRes.rows.map((a) => ({
        id: a.id,
        amount: a.amount,
        status: a.status,
        errorCode: a.failure_code,
        errorDescription: a.failure_message,
        createdAt: a.created_at.toISOString(),
      })),
      webhooks: webhooksRes.rows.map((w) => ({
        id: w.id,
        eventId: w.event_id,
        eventType: w.event_type,
        status: w.status,
        retryCount: w.retry_count,
        errorMessage: w.error_message,
        processedAt: w.processed_at ? w.processed_at.toISOString() : null,
        createdAt: w.created_at.toISOString(),
      })),
      refunds: refundsRes.rows.map((r) => ({
        id: r.id,
        amount: r.amount,
        status: r.status,
        providerRefundId: r.provider_refund_id,
        reason: r.reason,
        createdAt: r.created_at.toISOString(),
      })),
    };
  }

  async markReconciliationNote(params: {
    paymentId: string;
    reason: string;
    actorId: string;
    actorRole: PlatformAdminRole;
  }): Promise<void> {
    const paymentRes = await this.db.query<{ id: string; status: string; store_id: string }>(
      "SELECT id, status, store_id FROM payments WHERE id = $1",
      [params.paymentId]
    );
    const payment = paymentRes.rows[0];
    if (!payment) throw new Error("Payment not found");

    await this.db.query(
      "UPDATE payments SET reconciliation_reason = $1, updated_at = NOW() WHERE id = $2",
      [params.reason, params.paymentId]
    );

    await this.auditService.record({
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: "payment.reconciliation_reason_set",
      resourceType: "payment",
      resourceId: params.paymentId,
      storeId: payment.store_id,
      reason: params.reason,
      status: "SUCCESS",
      details: { previousStatus: payment.status },
    });

    await this.securityService.record({
      eventType: "PAYMENT_RECONCILIATION_NOTE_SET",
      severity: "INFO",
      userId: params.actorId,
      details: { paymentId: params.paymentId, reason: params.reason },
    });
  }
}
