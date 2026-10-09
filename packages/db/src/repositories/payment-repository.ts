import type { DatabaseClient } from "../database.js";
import type {
  CreatePaymentRowInput,
  PaymentRow,
  PaymentStatus,
} from "../schema/payments.js";

export class PaymentRepository {
  async create(
    client: DatabaseClient,
    input: CreatePaymentRowInput,
  ): Promise<PaymentRow> {
    const res = await client.query<PaymentRow>(
      `INSERT INTO payments (
         id, store_id, checkout_id, order_id, amount, currency,
         status, provider, captured_amount, refunded_amount
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        input.id,
        input.storeId,
        input.checkoutId,
        input.orderId ?? null,
        input.amount.toString(),
        input.currency,
        input.status ?? "CREATED",
        input.provider ?? "razorpay",
        (input.capturedAmount ?? 0).toString(),
        (input.refundedAmount ?? 0).toString(),
      ],
    );
    const row = res.rows[0];
    if (!row) {
      throw new Error("Failed to insert payment record");
    }
    return row;
  }

  async findById(
    client: DatabaseClient,
    storeId: string,
    id: string,
  ): Promise<PaymentRow | null> {
    const res = await client.query<PaymentRow>(
      `SELECT * FROM payments WHERE id = $1 AND store_id = $2`,
      [id, storeId],
    );
    return res.rows[0] ?? null;
  }

  async findByIdForUpdate(
    client: DatabaseClient,
    storeId: string,
    id: string,
  ): Promise<PaymentRow | null> {
    const res = await client.query<PaymentRow>(
      `SELECT * FROM payments WHERE id = $1 AND store_id = $2 FOR UPDATE`,
      [id, storeId],
    );
    return res.rows[0] ?? null;
  }

  async findActiveByCheckoutId(
    client: DatabaseClient,
    storeId: string,
    checkoutId: string,
  ): Promise<PaymentRow | null> {
    const res = await client.query<PaymentRow>(
      `SELECT * FROM payments
       WHERE store_id = $1 AND checkout_id = $2 AND status NOT IN ('FAILED', 'CANCELLED')
       LIMIT 1`,
      [storeId, checkoutId],
    );
    return res.rows[0] ?? null;
  }

  async findByCheckoutId(
    client: DatabaseClient,
    storeId: string,
    checkoutId: string,
  ): Promise<PaymentRow[]> {
    const res = await client.query<PaymentRow>(
      `SELECT * FROM payments
       WHERE store_id = $1 AND checkout_id = $2
       ORDER BY created_at DESC`,
      [storeId, checkoutId],
    );
    return res.rows;
  }

  async updateStatus(
    client: DatabaseClient,
    storeId: string,
    id: string,
    status: PaymentStatus,
    patch?: {
      capturedAmount?: bigint | number;
      refundedAmount?: bigint | number;
      orderId?: string | null;
    },
  ): Promise<PaymentRow | null> {
    const setClauses = ["status = $3", "updated_at = NOW()"];
    const values: unknown[] = [id, storeId, status];
    let paramIndex = 4;

    if (patch?.capturedAmount !== undefined) {
      setClauses.push(`captured_amount = $${paramIndex++}`);
      values.push(patch.capturedAmount.toString());
    }

    if (patch?.refundedAmount !== undefined) {
      setClauses.push(`refunded_amount = $${paramIndex++}`);
      values.push(patch.refundedAmount.toString());
    }

    if (patch?.orderId !== undefined) {
      setClauses.push(`order_id = $${paramIndex++}`);
      values.push(patch.orderId);
    }

    const res = await client.query<PaymentRow>(
      `UPDATE payments
       SET ${setClauses.join(", ")}
       WHERE id = $1 AND store_id = $2
       RETURNING *`,
      values,
    );
    return res.rows[0] ?? null;
  }

  async updateAmounts(
    client: DatabaseClient,
    storeId: string,
    id: string,
    capturedAmount: bigint | number,
    refundedAmount: bigint | number,
    status?: PaymentStatus,
  ): Promise<PaymentRow | null> {
    let sql: string;
    let values: unknown[];

    if (status) {
      sql = `UPDATE payments
             SET captured_amount = $3, refunded_amount = $4, status = $5, updated_at = NOW()
             WHERE id = $1 AND store_id = $2
             RETURNING *`;
      values = [id, storeId, capturedAmount.toString(), refundedAmount.toString(), status];
    } else {
      sql = `UPDATE payments
             SET captured_amount = $3, refunded_amount = $4, updated_at = NOW()
             WHERE id = $1 AND store_id = $2
             RETURNING *`;
      values = [id, storeId, capturedAmount.toString(), refundedAmount.toString()];
    }

    const res = await client.query<PaymentRow>(sql, values);
    return res.rows[0] ?? null;
  }
}
