import type { DatabaseClient } from "../database.js";
import type {
  CreatePaymentWebhookEventRowInput,
  PaymentWebhookEventRow,
  PaymentWebhookEventStatus,
} from "../schema/payments.js";

export class PaymentWebhookEventRepository {
  async create(
    client: DatabaseClient,
    input: CreatePaymentWebhookEventRowInput,
  ): Promise<PaymentWebhookEventRow> {
    const res = await client.query<PaymentWebhookEventRow>(
      `INSERT INTO payment_webhook_events (
         id, store_id, provider, provider_event_id, event_type,
         signature_verified, payload, payment_id, status, error_message, processed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        input.id,
        input.storeId ?? null,
        input.provider ?? "razorpay",
        input.providerEventId,
        input.eventType,
        input.signatureVerified ?? false,
        JSON.stringify(input.payload),
        input.paymentId ?? null,
        input.status ?? "RECEIVED",
        input.errorMessage ?? null,
        input.processedAt ?? null,
      ],
    );
    const row = res.rows[0];
    if (!row) {
      throw new Error("Failed to insert payment webhook event record");
    }
    return row;
  }

  async createIfNotExists(
    client: DatabaseClient,
    input: CreatePaymentWebhookEventRowInput,
  ): Promise<PaymentWebhookEventRow | null> {
    const res = await client.query<PaymentWebhookEventRow>(
      `INSERT INTO payment_webhook_events (
         id, store_id, provider, provider_event_id, event_type,
         signature_verified, payload, payment_id, status, error_message, processed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (provider, provider_event_id) DO NOTHING
       RETURNING *`,
      [
        input.id,
        input.storeId ?? null,
        input.provider ?? "razorpay",
        input.providerEventId,
        input.eventType,
        input.signatureVerified ?? false,
        JSON.stringify(input.payload),
        input.paymentId ?? null,
        input.status ?? "RECEIVED",
        input.errorMessage ?? null,
        input.processedAt ?? null,
      ],
    );
    return res.rows[0] ?? null;
  }

  async findById(
    client: DatabaseClient,
    id: string,
  ): Promise<PaymentWebhookEventRow | null> {
    const res = await client.query<PaymentWebhookEventRow>(
      `SELECT * FROM payment_webhook_events WHERE id = $1`,
      [id],
    );
    return res.rows[0] ?? null;
  }

  async findByProviderEventId(
    client: DatabaseClient,
    provider: string,
    providerEventId: string,
  ): Promise<PaymentWebhookEventRow | null> {
    const res = await client.query<PaymentWebhookEventRow>(
      `SELECT * FROM payment_webhook_events
       WHERE provider = $1 AND provider_event_id = $2
       LIMIT 1`,
      [provider, providerEventId],
    );
    return res.rows[0] ?? null;
  }

  async markProcessed(
    client: DatabaseClient,
    id: string,
    status: PaymentWebhookEventStatus,
    patch?: {
      errorMessage?: string | null;
      paymentId?: string | null;
      storeId?: string | null;
    },
  ): Promise<PaymentWebhookEventRow | null> {
    const setClauses = ["status = $2", "processed_at = NOW()"];
    const values: unknown[] = [id, status];
    let paramIndex = 3;

    if (patch?.errorMessage !== undefined) {
      setClauses.push(`error_message = $${paramIndex++}`);
      values.push(patch.errorMessage);
    }

    if (patch?.paymentId !== undefined) {
      setClauses.push(`payment_id = $${paramIndex++}`);
      values.push(patch.paymentId);
    }

    if (patch?.storeId !== undefined) {
      setClauses.push(`store_id = $${paramIndex++}`);
      values.push(patch.storeId);
    }

    const res = await client.query<PaymentWebhookEventRow>(
      `UPDATE payment_webhook_events
       SET ${setClauses.join(", ")}
       WHERE id = $1
       RETURNING *`,
      values,
    );
    return res.rows[0] ?? null;
  }

  async markProcessing(
    client: DatabaseClient,
    id: string,
  ): Promise<PaymentWebhookEventRow | null> {
    const res = await client.query<PaymentWebhookEventRow>(
      `UPDATE payment_webhook_events
       SET status = 'PROCESSING', processed_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id],
    );
    return res.rows[0] ?? null;
  }

  async findAbandonedProcessing(
    client: DatabaseClient,
    leaseCutoff: Date,
    limit = 50,
  ): Promise<PaymentWebhookEventRow[]> {
    const res = await client.query<PaymentWebhookEventRow>(
      `SELECT * FROM payment_webhook_events
       WHERE status = 'PROCESSING'
         AND (processed_at IS NULL OR processed_at <= $1)
       ORDER BY created_at ASC
       LIMIT $2`,
      [leaseCutoff, limit],
    );
    return res.rows;
  }
}
