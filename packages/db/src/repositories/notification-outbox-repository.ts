import type { DatabaseClient } from "../database.js";
import { generateUuidV7 } from "../uuid.js";
import type {
  CreateNotificationOutboxRowInput,
  NotificationOutboxRow,
} from "../schema/notifications.js";

export interface ClaimPendingOptions {
  limit?: number;
  asOf?: Date;
}

export class NotificationOutboxRepository {
  async create(
    client: DatabaseClient,
    input: CreateNotificationOutboxRowInput,
  ): Promise<NotificationOutboxRow | null> {
    const id = input.id ?? generateUuidV7();
    const maxAttempts = input.maxAttempts ?? 5;
    const nextRetryAt = input.nextRetryAt ?? new Date();

    const res = await client.query<NotificationOutboxRow>(
      `INSERT INTO notification_outbox (
         id, store_id, notification_type, recipient_email,
         reference_type, reference_id, idempotency_key, payload,
         status, attempts, max_attempts, next_retry_at, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', 0, $9, $10, NOW(), NOW())
       ON CONFLICT (store_id, idempotency_key) DO NOTHING
       RETURNING *`,
      [
        id,
        input.storeId,
        input.notificationType,
        input.recipientEmail ?? null,
        input.referenceType,
        input.referenceId,
        input.idempotencyKey,
        JSON.stringify(input.payload),
        maxAttempts,
        nextRetryAt,
      ],
    );

    return res.rows[0] ?? null;
  }

  async findById(
    client: DatabaseClient,
    id: string,
  ): Promise<NotificationOutboxRow | null> {
    const res = await client.query<NotificationOutboxRow>(
      `SELECT * FROM notification_outbox WHERE id = $1`,
      [id],
    );
    return res.rows[0] ?? null;
  }

  async findByStoreAndIdempotencyKey(
    client: DatabaseClient,
    storeId: string,
    idempotencyKey: string,
  ): Promise<NotificationOutboxRow | null> {
    const res = await client.query<NotificationOutboxRow>(
      `SELECT * FROM notification_outbox WHERE store_id = $1 AND idempotency_key = $2`,
      [storeId, idempotencyKey],
    );
    return res.rows[0] ?? null;
  }

  async findByReference(
    client: DatabaseClient,
    storeId: string,
    referenceType: string,
    referenceId: string,
  ): Promise<NotificationOutboxRow[]> {
    const res = await client.query<NotificationOutboxRow>(
      `SELECT * FROM notification_outbox
       WHERE store_id = $1 AND reference_type = $2 AND reference_id = $3
       ORDER BY created_at ASC`,
      [storeId, referenceType, referenceId],
    );
    return res.rows;
  }

  /**
   * Concurrency-safe queue claim using PostgreSQL SKIP LOCKED with atomic status transition to PROCESSING.
   * Multiple background workers can safely poll simultaneously without duplicating work.
   */
  async claimPending(
    client: DatabaseClient,
    options?: ClaimPendingOptions,
  ): Promise<NotificationOutboxRow[]> {
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
    const asOf = options?.asOf ?? new Date();

    const res = await client.query<NotificationOutboxRow>(
      `WITH claimed AS (
         SELECT id FROM notification_outbox
         WHERE (status = 'PENDING' AND next_retry_at <= $1)
            OR (status = 'PROCESSING' AND updated_at < $1 - INTERVAL '5 minutes')
         ORDER BY next_retry_at ASC, created_at ASC
         LIMIT $2
         FOR UPDATE SKIP LOCKED
       )
       UPDATE notification_outbox n
       SET status = 'PROCESSING', updated_at = NOW()
       FROM claimed
       WHERE n.id = claimed.id
       RETURNING n.*`,
      [asOf, limit],
    );

    return res.rows;
  }

  async markSent(
    client: DatabaseClient,
    id: string,
  ): Promise<NotificationOutboxRow | null> {
    const res = await client.query<NotificationOutboxRow>(
      `UPDATE notification_outbox
       SET status = 'SENT',
           attempts = attempts + 1,
           last_attempt_at = NOW(),
           processed_at = NOW(),
           error_message = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id],
    );

    return res.rows[0] ?? null;
  }

  async recordAttemptFailure(
    client: DatabaseClient,
    id: string,
    errorMessage: string,
    nextRetryAt: Date | null,
    isTerminal: boolean,
  ): Promise<NotificationOutboxRow | null> {
    const newStatus = isTerminal ? "FAILED" : "PENDING";

    const res = await client.query<NotificationOutboxRow>(
      `UPDATE notification_outbox
       SET status = $2,
           attempts = attempts + 1,
           last_attempt_at = NOW(),
           next_retry_at = $3,
           error_message = $4,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, newStatus, nextRetryAt, errorMessage],
    );

    return res.rows[0] ?? null;
  }
}
