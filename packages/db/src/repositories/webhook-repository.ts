import type { DatabaseClient } from "../database.js";
import { generateUuidV7 } from "../uuid.js";
import type {
  CreateWebhookSubscriptionInput,
  EnqueueWebhookDeliveryInput,
  WebhookDeliveryRow,
  WebhookSubscriptionRow,
} from "../schema/webhooks.js";

export class WebhookRepository {
  // ---------------------------------------------------------------------------
  // Subscriptions
  // ---------------------------------------------------------------------------
  async createSubscription(
    client: DatabaseClient,
    input: CreateWebhookSubscriptionInput,
  ): Promise<WebhookSubscriptionRow> {
    const id = input.id ?? generateUuidV7();
    const eventTypes = input.eventTypes ?? ["order.created", "order.paid"];
    const isActive = input.isActive ?? true;

    const res = await client.query<WebhookSubscriptionRow>(
      `INSERT INTO webhook_subscriptions (
         id, store_id, name, url, secret, event_types, is_active, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [id, input.storeId, input.name, input.url, input.secret, eventTypes, isActive],
    );

    const row = res.rows[0];
    if (!row) {
      throw new Error("Failed to create webhook subscription");
    }
    return row;
  }

  async findSubscriptionsByStore(
    client: DatabaseClient,
    storeId: string,
  ): Promise<WebhookSubscriptionRow[]> {
    const res = await client.query<WebhookSubscriptionRow>(
      `SELECT * FROM webhook_subscriptions
       WHERE store_id = $1
       ORDER BY created_at DESC`,
      [storeId],
    );
    return res.rows;
  }

  async findSubscriptionById(
    client: DatabaseClient,
    storeId: string,
    id: string,
  ): Promise<WebhookSubscriptionRow | null> {
    const res = await client.query<WebhookSubscriptionRow>(
      `SELECT * FROM webhook_subscriptions
       WHERE store_id = $1 AND id = $2`,
      [storeId, id],
    );
    return res.rows[0] ?? null;
  }

  async findActiveSubscriptionsForEvent(
    client: DatabaseClient,
    storeId: string,
    eventType: string,
  ): Promise<WebhookSubscriptionRow[]> {
    const res = await client.query<WebhookSubscriptionRow>(
      `SELECT * FROM webhook_subscriptions
       WHERE store_id = $1
         AND is_active = TRUE
         AND ($2 = ANY(event_types) OR '*' = ANY(event_types))`,
      [storeId, eventType],
    );
    return res.rows;
  }

  async deleteSubscription(
    client: DatabaseClient,
    storeId: string,
    id: string,
  ): Promise<boolean> {
    const res = await client.query(
      `DELETE FROM webhook_subscriptions
       WHERE store_id = $1 AND id = $2`,
      [storeId, id],
    );
    return (res.rowCount ?? 0) > 0;
  }

  // ---------------------------------------------------------------------------
  // Deliveries (Outbox)
  // ---------------------------------------------------------------------------
  async enqueueDelivery(
    client: DatabaseClient,
    input: EnqueueWebhookDeliveryInput,
  ): Promise<WebhookDeliveryRow> {
    const id = input.id ?? generateUuidV7();
    const maxAttempts = input.maxAttempts ?? 5;

    const res = await client.query<WebhookDeliveryRow>(
      `INSERT INTO webhook_deliveries (
         id, store_id, subscription_id, event_id, event_type, payload,
         status, attempts, max_attempts, next_retry_at, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', 0, $7, NOW(), NOW(), NOW())
       RETURNING *`,
      [
        id,
        input.storeId,
        input.subscriptionId,
        input.eventId,
        input.eventType,
        JSON.stringify(input.payload),
        maxAttempts,
      ],
    );

    const row = res.rows[0];
    if (!row) {
      throw new Error("Failed to enqueue webhook delivery");
    }
    return row;
  }

  async claimPendingDeliveries(
    client: DatabaseClient,
    options: { limit?: number; asOf?: Date } = {},
  ): Promise<Array<WebhookDeliveryRow & { target_url: string; secret: string }>> {
    const limit = options.limit ?? 25;
    const asOf = options.asOf ?? new Date();

    const res = await client.query<WebhookDeliveryRow & { target_url: string; secret: string }>(
      `SELECT d.*, s.url AS target_url, s.secret
       FROM webhook_deliveries d
       JOIN webhook_subscriptions s ON s.id = d.subscription_id
       WHERE d.status = 'PENDING'
         AND d.next_retry_at <= $1
         AND s.is_active = TRUE
       ORDER BY d.next_retry_at ASC
       LIMIT $2
       FOR UPDATE SKIP LOCKED`,
      [asOf, limit],
    );

    return res.rows;
  }

  async markDeliverySuccess(
    client: DatabaseClient,
    id: string,
    statusCode: number,
    responseBody?: string | null,
  ): Promise<void> {
    await client.query(
      `UPDATE webhook_deliveries
       SET status = 'SUCCESS',
           attempts = attempts + 1,
           response_status_code = $2,
           response_body = $3,
           error_message = NULL,
           delivered_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [id, statusCode, responseBody ? responseBody.slice(0, 1000) : null],
    );
  }

  async markDeliveryFailure(
    client: DatabaseClient,
    id: string,
    input: {
      statusCode?: number | null;
      responseBody?: string | null;
      errorMessage: string;
      terminal: boolean;
      nextRetryAt?: Date | null;
    },
  ): Promise<void> {
    const status = input.terminal ? "FAILED" : "PENDING";

    await client.query(
      `UPDATE webhook_deliveries
       SET status = $2,
           attempts = attempts + 1,
           response_status_code = $3,
           response_body = $4,
           error_message = $5,
           next_retry_at = COALESCE($6, next_retry_at),
           updated_at = NOW()
       WHERE id = $1`,
      [
        id,
        status,
        input.statusCode ?? null,
        input.responseBody ? input.responseBody.slice(0, 1000) : null,
        input.errorMessage.slice(0, 500),
        input.nextRetryAt ?? null,
      ],
    );
  }

  async findDeliveriesByStore(
    client: DatabaseClient,
    storeId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ items: WebhookDeliveryRow[]; total: number }> {
    const totalRes = await client.query<{ count: string }>(
      `SELECT count(*) AS count FROM webhook_deliveries WHERE store_id = $1`,
      [storeId],
    );
    const total = parseInt(totalRes.rows[0]?.count ?? "0", 10);

    const itemsRes = await client.query<WebhookDeliveryRow>(
      `SELECT * FROM webhook_deliveries
       WHERE store_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [storeId, limit, offset],
    );

    return { items: itemsRes.rows, total };
  }
}
