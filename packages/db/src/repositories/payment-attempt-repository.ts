import type { DatabaseClient } from "../database.js";
import type {
  CreatePaymentAttemptRowInput,
  PaymentAttemptRow,
  PaymentAttemptStatus,
} from "../schema/payments.js";

export class PaymentAttemptRepository {
  async create(
    client: DatabaseClient,
    input: CreatePaymentAttemptRowInput,
  ): Promise<PaymentAttemptRow> {
    const res = await client.query<PaymentAttemptRow>(
      `INSERT INTO payment_attempts (
         id, payment_id, store_id, attempt_number, provider,
         provider_order_id, provider_payment_id, provider_signature,
         amount, currency, status, failure_code, failure_message, idempotency_key
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        input.id,
        input.paymentId,
        input.storeId,
        input.attemptNumber,
        input.provider ?? "razorpay",
        input.providerOrderId ?? null,
        input.providerPaymentId ?? null,
        input.providerSignature ?? null,
        input.amount.toString(),
        input.currency,
        input.status ?? "INITIATED",
        input.failureCode ?? null,
        input.failureMessage ?? null,
        input.idempotencyKey ?? null,
      ],
    );
    const row = res.rows[0];
    if (!row) {
      throw new Error("Failed to insert payment attempt record");
    }
    return row;
  }

  async findById(
    client: DatabaseClient,
    storeId: string,
    id: string,
  ): Promise<PaymentAttemptRow | null> {
    const res = await client.query<PaymentAttemptRow>(
      `SELECT * FROM payment_attempts WHERE id = $1 AND store_id = $2`,
      [id, storeId],
    );
    return res.rows[0] ?? null;
  }

  async findByPaymentId(
    client: DatabaseClient,
    storeId: string,
    paymentId: string,
  ): Promise<PaymentAttemptRow[]> {
    const res = await client.query<PaymentAttemptRow>(
      `SELECT * FROM payment_attempts
       WHERE store_id = $1 AND payment_id = $2
       ORDER BY attempt_number ASC`,
      [storeId, paymentId],
    );
    return res.rows;
  }

  async findByProviderPaymentId(
    client: DatabaseClient,
    provider: string,
    providerPaymentId: string,
  ): Promise<PaymentAttemptRow | null> {
    const res = await client.query<PaymentAttemptRow>(
      `SELECT * FROM payment_attempts
       WHERE provider = $1 AND provider_payment_id = $2
       LIMIT 1`,
      [provider, providerPaymentId],
    );
    return res.rows[0] ?? null;
  }

  async findByProviderOrderId(
    client: DatabaseClient,
    provider: string,
    providerOrderId: string,
  ): Promise<PaymentAttemptRow[]> {
    const res = await client.query<PaymentAttemptRow>(
      `SELECT * FROM payment_attempts
       WHERE provider = $1 AND provider_order_id = $2
       ORDER BY attempt_number ASC`,
      [provider, providerOrderId],
    );
    return res.rows;
  }

  async getLatestAttemptNumber(
    client: DatabaseClient,
    paymentId: string,
  ): Promise<number> {
    const res = await client.query<{ max_attempt: string | number | null }>(
      `SELECT MAX(attempt_number) as max_attempt FROM payment_attempts WHERE payment_id = $1`,
      [paymentId],
    );
    const maxVal = res.rows[0]?.max_attempt;
    return maxVal != null ? Number(maxVal) : 0;
  }

  async updateStatus(
    client: DatabaseClient,
    storeId: string,
    id: string,
    status: PaymentAttemptStatus,
    patch?: {
      failureCode?: string | null;
      failureMessage?: string | null;
      providerPaymentId?: string | null;
      providerSignature?: string | null;
      providerOrderId?: string | null;
    },
  ): Promise<PaymentAttemptRow | null> {
    const setClauses = ["status = $3", "updated_at = NOW()"];
    const values: unknown[] = [id, storeId, status];
    let paramIndex = 4;

    if (patch?.failureCode !== undefined) {
      setClauses.push(`failure_code = $${paramIndex++}`);
      values.push(patch.failureCode);
    }

    if (patch?.failureMessage !== undefined) {
      setClauses.push(`failure_message = $${paramIndex++}`);
      values.push(patch.failureMessage);
    }

    if (patch?.providerPaymentId !== undefined) {
      setClauses.push(`provider_payment_id = $${paramIndex++}`);
      values.push(patch.providerPaymentId);
    }

    if (patch?.providerSignature !== undefined) {
      setClauses.push(`provider_signature = $${paramIndex++}`);
      values.push(patch.providerSignature);
    }

    if (patch?.providerOrderId !== undefined) {
      setClauses.push(`provider_order_id = $${paramIndex++}`);
      values.push(patch.providerOrderId);
    }

    const res = await client.query<PaymentAttemptRow>(
      `UPDATE payment_attempts
       SET ${setClauses.join(", ")}
       WHERE id = $1 AND store_id = $2
       RETURNING *`,
      values,
    );
    return res.rows[0] ?? null;
  }
}
