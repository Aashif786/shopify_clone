import type { DatabaseClient } from "@calcart/db";
import { generateUuidV7 } from "@calcart/db";
import type {
  NewsletterSubscriber,
  NewsletterSubscriberStatus,
} from "../domain/entities/newsletter-subscriber.js";

interface NewsletterSubscriberRow {
  id: string;
  store_id: string;
  email: string;
  status: NewsletterSubscriberStatus;
  source: string;
  subscribed_at: Date;
  unsubscribed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UpsertSubscriberResult {
  subscriber: NewsletterSubscriber;
  isNew: boolean;
}

export class NewsletterRepository {
  private mapRow(row: NewsletterSubscriberRow): NewsletterSubscriber {
    return {
      id: row.id,
      storeId: row.store_id,
      email: row.email,
      status: row.status,
      source: row.source,
      subscribedAt: new Date(row.subscribed_at),
      unsubscribedAt: row.unsubscribed_at ? new Date(row.unsubscribed_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async subscribe(
    client: DatabaseClient,
    storeId: string,
    email: string,
    source: string = "STOREFRONT_LANDING",
  ): Promise<UpsertSubscriberResult> {
    const id = generateUuidV7();
    const normalizedEmail = email.trim().toLowerCase();

    // Check if already exists to determine if this is an initial subscription
    const existing = await this.findByStoreAndEmail(client, storeId, normalizedEmail);

    const res = await client.query<NewsletterSubscriberRow>(
      `INSERT INTO newsletter_subscribers (
        id, store_id, email, status, source, subscribed_at, created_at, updated_at
      ) VALUES ($1, $2, $3, 'SUBSCRIBED', $4, NOW(), NOW(), NOW())
      ON CONFLICT (store_id, email)
      DO UPDATE SET
        status = 'SUBSCRIBED',
        subscribed_at = CASE
          WHEN newsletter_subscribers.status = 'UNSUBSCRIBED' THEN NOW()
          ELSE newsletter_subscribers.subscribed_at
        END,
        unsubscribed_at = NULL,
        updated_at = NOW()
      RETURNING id, store_id, email, status, source, subscribed_at, unsubscribed_at, created_at, updated_at`,
      [id, storeId, normalizedEmail, source],
    );

    return {
      subscriber: this.mapRow(res.rows[0]!),
      isNew: !existing,
    };
  }

  async unsubscribe(
    client: DatabaseClient,
    storeId: string,
    email: string,
  ): Promise<NewsletterSubscriber | null> {
    const normalizedEmail = email.trim().toLowerCase();

    const res = await client.query<NewsletterSubscriberRow>(
      `UPDATE newsletter_subscribers
       SET status = 'UNSUBSCRIBED', unsubscribed_at = NOW(), updated_at = NOW()
       WHERE store_id = $1 AND email = $2
       RETURNING id, store_id, email, status, source, subscribed_at, unsubscribed_at, created_at, updated_at`,
      [storeId, normalizedEmail],
    );

    if (res.rows.length === 0) return null;
    return this.mapRow(res.rows[0]!);
  }

  async findByStoreAndEmail(
    client: DatabaseClient,
    storeId: string,
    email: string,
  ): Promise<NewsletterSubscriber | null> {
    const normalizedEmail = email.trim().toLowerCase();

    const res = await client.query<NewsletterSubscriberRow>(
      `SELECT id, store_id, email, status, source, subscribed_at, unsubscribed_at, created_at, updated_at
       FROM newsletter_subscribers
       WHERE store_id = $1 AND email = $2
       LIMIT 1`,
      [storeId, normalizedEmail],
    );

    if (res.rows.length === 0) return null;
    return this.mapRow(res.rows[0]!);
  }

  async countByStore(client: DatabaseClient, storeId: string): Promise<{ total: number; active: number }> {
    const res = await client.query<{ total: string; active: string }>(
      `SELECT
         COUNT(*)::text as total,
         COUNT(*) FILTER (WHERE status = 'SUBSCRIBED')::text as active
       FROM newsletter_subscribers
       WHERE store_id = $1`,
      [storeId],
    );

    const row = res.rows[0];
    return {
      total: row ? parseInt(row.total, 10) : 0,
      active: row ? parseInt(row.active, 10) : 0,
    };
  }

  async listSubscribers(
    client: DatabaseClient,
    storeId: string,
    filter: {
      search?: string;
      status?: "ALL" | "SUBSCRIBED" | "UNSUBSCRIBED";
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ items: NewsletterSubscriber[]; total: number; activeCount: number }> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 250);
    const offset = Math.max(filter.offset ?? 0, 0);

    const conditions: string[] = ["store_id = $1"];
    const params: unknown[] = [storeId];
    let pIdx = 2;

    if (filter.status && filter.status !== "ALL") {
      conditions.push(`status = $${pIdx++}`);
      params.push(filter.status);
    }

    if (filter.search && filter.search.trim()) {
      conditions.push(`email ILIKE $${pIdx++}`);
      params.push(`%${filter.search.trim()}%`);
    }

    const whereClause = conditions.join(" AND ");

    const countsRes = await client.query<{ total: string; active: string }>(
      `SELECT
         COUNT(*)::text as total,
         COUNT(*) FILTER (WHERE status = 'SUBSCRIBED')::text as active
       FROM newsletter_subscribers
       WHERE store_id = $1`,
      [storeId],
    );

    const total = parseInt(countsRes.rows[0]?.total ?? "0", 10);
    const activeCount = parseInt(countsRes.rows[0]?.active ?? "0", 10);

    const query = `
      SELECT id, store_id, email, status, source, subscribed_at, unsubscribed_at, created_at, updated_at
      FROM newsletter_subscribers
      WHERE ${whereClause}
      ORDER BY subscribed_at DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++}
    `;
    params.push(limit, offset);

    const res = await client.query<NewsletterSubscriberRow>(query, params);

    return {
      items: res.rows.map((r) => this.mapRow(r)),
      total,
      activeCount,
    };
  }
}
