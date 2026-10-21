import type { DatabaseClient } from "../database.js";
import type {
  CreateRefundRowInput,
  RefundRow,
  RefundStatus,
} from "../schema/payments.js";

export class RefundRepository {
  async create(
    client: DatabaseClient,
    input: CreateRefundRowInput,
  ): Promise<RefundRow> {
    const res = await client.query<RefundRow>(
      `INSERT INTO refunds (
         id, store_id, payment_id, order_id, provider,
         provider_refund_id, amount, currency, status, reason, idempotency_key
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        input.id,
        input.storeId,
        input.paymentId,
        input.orderId,
        input.provider ?? "razorpay",
        input.providerRefundId ?? null,
        input.amount.toString(),
        input.currency,
        input.status ?? "PENDING",
        input.reason ?? null,
        input.idempotencyKey ?? null,
      ],
    );
    const row = res.rows[0];
    if (!row) {
      throw new Error("Failed to insert refund record");
    }
    return row;
  }

  async findById(
    client: DatabaseClient,
    storeId: string,
    id: string,
  ): Promise<RefundRow | null> {
    const res = await client.query<RefundRow>(
      `SELECT * FROM refunds WHERE id = $1 AND store_id = $2`,
      [id, storeId],
    );
    return res.rows[0] ?? null;
  }

  async findByPaymentId(
    client: DatabaseClient,
    storeId: string,
    paymentId: string,
  ): Promise<RefundRow[]> {
    const res = await client.query<RefundRow>(
      `SELECT * FROM refunds
       WHERE store_id = $1 AND payment_id = $2
       ORDER BY created_at ASC`,
      [storeId, paymentId],
    );
    return res.rows;
  }

  async findByOrderId(
    client: DatabaseClient,
    storeId: string,
    orderId: string,
  ): Promise<RefundRow[]> {
    const res = await client.query<RefundRow>(
      `SELECT * FROM refunds
       WHERE store_id = $1 AND order_id = $2
       ORDER BY created_at DESC`,
      [storeId, orderId],
    );
    return res.rows;
  }

  async findByIdempotencyKey(
    client: DatabaseClient,
    storeId: string,
    idempotencyKey: string,
  ): Promise<RefundRow | null> {
    const res = await client.query<RefundRow>(
      `SELECT * FROM refunds
       WHERE store_id = $1 AND idempotency_key = $2
       LIMIT 1`,
      [storeId, idempotencyKey],
    );
    return res.rows[0] ?? null;
  }

  async findByProviderRefundId(
    client: DatabaseClient,
    provider: string,
    providerRefundId: string,
  ): Promise<RefundRow | null> {
    const res = await client.query<RefundRow>(
      `SELECT * FROM refunds
       WHERE provider = $1 AND provider_refund_id = $2
       LIMIT 1`,
      [provider, providerRefundId],
    );
    return res.rows[0] ?? null;
  }

  async getInFlightRefundAmount(
    client: DatabaseClient,
    storeId: string,
    paymentId: string,
  ): Promise<number> {
    const res = await client.query<{ sum: string | null }>(
      `SELECT COALESCE(SUM(amount), 0) as sum
       FROM refunds
       WHERE store_id = $1
         AND payment_id = $2
         AND status IN ('PENDING', 'PROCESSING', 'REQUIRES_RECONCILIATION')`,
      [storeId, paymentId],
    );
    return Number(res.rows[0]?.sum ?? 0);
  }

  async hasAmbiguousRefund(
    client: DatabaseClient,
    storeId: string,
    paymentId: string,
  ): Promise<boolean> {
    const res = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM refunds
         WHERE store_id = $1
           AND payment_id = $2
           AND status = 'REQUIRES_RECONCILIATION'
       ) as exists`,
      [storeId, paymentId],
    );
    return Boolean(res.rows[0]?.exists);
  }

  async updateStatus(
    client: DatabaseClient,
    storeId: string,
    id: string,
    status: RefundStatus,
    patch?: {
      providerRefundId?: string | null;
    },
  ): Promise<RefundRow | null> {
    const setClauses = ["status = $3", "updated_at = NOW()"];
    const values: unknown[] = [id, storeId, status];
    let paramIndex = 4;

    if (patch?.providerRefundId !== undefined) {
      setClauses.push(`provider_refund_id = $${paramIndex++}`);
      values.push(patch.providerRefundId);
    }

    const res = await client.query<RefundRow>(
      `UPDATE refunds
       SET ${setClauses.join(", ")}
       WHERE id = $1 AND store_id = $2
       RETURNING *`,
      values,
    );
    return res.rows[0] ?? null;
  }
}
