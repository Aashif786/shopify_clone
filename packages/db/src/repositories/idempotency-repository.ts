import type { DatabaseClient } from "../database.js";
import type {
  CreateIdempotencyRecordRowInput,
  IdempotencyRecordRow,
} from "../schema/payments.js";

export class IdempotencyRepository {
  async reserve(
    client: DatabaseClient,
    input: CreateIdempotencyRecordRowInput,
  ): Promise<{ reserved: boolean; record: IdempotencyRecordRow }> {
    const insertRes = await client.query<IdempotencyRecordRow>(
      `INSERT INTO idempotency_records (
         id, store_id, scope, idempotency_key, request_hash,
         status, response_status, response_body, resource_id, expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (store_id, scope, idempotency_key) DO NOTHING
       RETURNING *`,
      [
        input.id,
        input.storeId,
        input.scope,
        input.idempotencyKey,
        input.requestHash,
        input.status ?? "IN_PROGRESS",
        input.responseStatus ?? null,
        input.responseBody ? JSON.stringify(input.responseBody) : null,
        input.resourceId ?? null,
        input.expiresAt.toISOString(),
      ],
    );

    if (insertRes.rows.length > 0 && insertRes.rows[0]) {
      return { reserved: true, record: insertRes.rows[0] };
    }

    const existing = await this.findByKey(
      client,
      input.storeId,
      input.scope,
      input.idempotencyKey,
    );
    if (!existing) {
      throw new Error("Concurrent idempotency record creation conflict, but record not found");
    }
    return { reserved: false, record: existing };
  }

  async findByKey(
    client: DatabaseClient,
    storeId: string,
    scope: string,
    idempotencyKey: string,
  ): Promise<IdempotencyRecordRow | null> {
    const res = await client.query<IdempotencyRecordRow>(
      `SELECT * FROM idempotency_records
       WHERE store_id = $1 AND scope = $2 AND idempotency_key = $3
       LIMIT 1`,
      [storeId, scope, idempotencyKey],
    );
    return res.rows[0] ?? null;
  }

  async complete(
    client: DatabaseClient,
    storeId: string,
    scope: string,
    idempotencyKey: string,
    responseStatus: number,
    responseBody: Record<string, unknown>,
    resourceId?: string | null,
  ): Promise<IdempotencyRecordRow | null> {
    const res = await client.query<IdempotencyRecordRow>(
      `UPDATE idempotency_records
       SET status = 'COMPLETED',
           response_status = $4,
           response_body = $5,
           resource_id = COALESCE($6, resource_id)
       WHERE store_id = $1 AND scope = $2 AND idempotency_key = $3
       RETURNING *`,
      [
        storeId,
        scope,
        idempotencyKey,
        responseStatus,
        JSON.stringify(responseBody),
        resourceId ?? null,
      ],
    );
    return res.rows[0] ?? null;
  }

  async fail(
    client: DatabaseClient,
    storeId: string,
    scope: string,
    idempotencyKey: string,
  ): Promise<IdempotencyRecordRow | null> {
    const res = await client.query<IdempotencyRecordRow>(
      `UPDATE idempotency_records
       SET status = 'FAILED'
       WHERE store_id = $1 AND scope = $2 AND idempotency_key = $3
       RETURNING *`,
      [storeId, scope, idempotencyKey],
    );
    return res.rows[0] ?? null;
  }
}
