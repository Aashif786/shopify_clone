import type { DatabaseClient } from "../database.js";
import { generateUuidV7 } from "../uuid.js";
import type {
  CreateNotificationOutboxRowInput,
  NotificationErrorCategory,
  NotificationOutboxRow,
  NotificationOutboxStatus,
} from "../schema/notifications.js";

export interface ClaimPendingOptions {
  limit?: number;
  asOf?: Date;
}

export interface ListNotificationsOptions {
  status?: NotificationOutboxStatus | string;
  limit?: number;
  offset?: number;
}

export interface ListNotificationsResult {
  items: NotificationOutboxRow[];
  total: number;
  limit: number;
  offset: number;
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
         status, attempts, max_attempts, next_retry_at,
         provider_message_id, error_category, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', 0, $9, $10, $11, $12, NOW(), NOW())
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
        input.providerMessageId ?? null,
        input.errorCategory ?? null,
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

  async findByStoreAndId(
    client: DatabaseClient,
    storeId: string,
    id: string,
  ): Promise<NotificationOutboxRow | null> {
    const res = await client.query<NotificationOutboxRow>(
      `SELECT * FROM notification_outbox WHERE store_id = $1 AND id = $2`,
      [storeId, id],
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
    providerMessageId?: string | null,
  ): Promise<NotificationOutboxRow | null> {
    const res = await client.query<NotificationOutboxRow>(
      `UPDATE notification_outbox
       SET status = 'SENT',
           attempts = attempts + 1,
           last_attempt_at = NOW(),
           processed_at = NOW(),
           error_message = NULL,
           error_category = NULL,
           provider_message_id = COALESCE($2, provider_message_id),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, providerMessageId ?? null],
    );

    return res.rows[0] ?? null;
  }

  async recordAttemptFailure(
    client: DatabaseClient,
    id: string,
    errorMessage: string,
    nextRetryAt: Date | null,
    isTerminal: boolean,
    errorCategory?: NotificationErrorCategory | string | null,
  ): Promise<NotificationOutboxRow | null> {
    const newStatus = isTerminal ? "FAILED" : "PENDING";

    const res = await client.query<NotificationOutboxRow>(
      `UPDATE notification_outbox
       SET status = $2,
           attempts = attempts + 1,
           last_attempt_at = NOW(),
           next_retry_at = $3,
           error_message = $4,
           error_category = COALESCE($5, error_category),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, newStatus, nextRetryAt, errorMessage, errorCategory ?? null],
    );

    return res.rows[0] ?? null;
  }

  /**
   * Lists store-scoped notifications with pagination, status filtering, and count for merchant visibility.
   * Enforces strict store tenant isolation.
   */
  async listByStore(
    client: DatabaseClient,
    storeId: string,
    options?: ListNotificationsOptions,
  ): Promise<ListNotificationsResult> {
    const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
    const offset = Math.max(options?.offset ?? 0, 0);

    const conditions: string[] = ["store_id = $1"];
    const params: unknown[] = [storeId];

    if (options?.status) {
      params.push(options.status.toUpperCase());
      conditions.push(`status = $${params.length}`);
    }

    const whereClause = conditions.join(" AND ");

    const countRes = await client.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM notification_outbox WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countRes.rows[0]?.count ?? "0", 10);

    params.push(limit);
    const limitParamIdx = params.length;
    params.push(offset);
    const offsetParamIdx = params.length;

    const itemsRes = await client.query<NotificationOutboxRow>(
      `SELECT * FROM notification_outbox
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}`,
      params,
    );

    return {
      items: itemsRes.rows,
      total,
      limit,
      offset,
    };
  }

  /**
   * Resets a FAILED notification back to PENDING for immediate retry by authorized store operators.
   * Enforces store-level authorization.
   */
  async retryNotification(
    client: DatabaseClient,
    storeId: string,
    id: string,
  ): Promise<NotificationOutboxRow | null> {
    const res = await client.query<NotificationOutboxRow>(
      `UPDATE notification_outbox
       SET status = 'PENDING',
           attempts = 0,
           next_retry_at = NOW(),
           error_message = NULL,
           error_category = NULL,
           updated_at = NOW()
       WHERE store_id = $1 AND id = $2 AND status = 'FAILED'
       RETURNING *`,
      [storeId, id],
    );

    return res.rows[0] ?? null;
  }
}
