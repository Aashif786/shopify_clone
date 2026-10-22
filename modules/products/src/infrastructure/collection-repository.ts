import type { DatabaseClient } from "@shopify-clone/db";
import type {
  Collection,
  CollectionStatus,
  CollectionWithProductCount,
} from "../domain/entities.js";

interface CollectionRow {
  id: string;
  store_id: string;
  title: string;
  slug: string;
  description: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}

interface CollectionWithCountRow extends CollectionRow {
  product_count: number | string;
}

function mapCollection(row: CollectionRow): Collection {
  return {
    id: row.id,
    storeId: row.store_id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    status: row.status as CollectionStatus,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapCollectionWithCount(row: CollectionWithCountRow): CollectionWithProductCount {
  return {
    ...mapCollection(row),
    productCount: Number(row.product_count || 0),
  };
}

export interface ListCollectionsOptions {
  storeId: string;
  status?: CollectionStatus;
  limit?: number;
  offset?: number;
}

export class CollectionRepository {
  async insertCollection(
    client: DatabaseClient,
    collection: {
      id: string;
      storeId: string;
      title: string;
      slug: string;
      description?: string | null;
      status?: CollectionStatus;
    },
  ): Promise<Collection> {
    const res = await client.query<CollectionRow>(
      `INSERT INTO collections (id, store_id, title, slug, description, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, store_id, title, slug, description, status, created_at, updated_at`,
      [
        collection.id,
        collection.storeId,
        collection.title,
        collection.slug,
        collection.description ?? null,
        collection.status ?? "ACTIVE",
      ],
    );
    return mapCollection(res.rows[0]!);
  }

  async findCollectionById(
    client: DatabaseClient,
    storeId: string,
    collectionId: string,
  ): Promise<CollectionWithProductCount | null> {
    const res = await client.query<CollectionWithCountRow>(
      `SELECT 
         c.id, c.store_id, c.title, c.slug, c.description, c.status, c.created_at, c.updated_at,
         COALESCE(cp.product_count, 0)::int AS product_count
       FROM collections c
       LEFT JOIN (
         SELECT collection_id, COUNT(*)::int AS product_count
         FROM collection_products
         GROUP BY collection_id
       ) cp ON cp.collection_id = c.id
       WHERE c.store_id = $1 AND c.id = $2`,
      [storeId, collectionId],
    );
    return res.rows[0] ? mapCollectionWithCount(res.rows[0]) : null;
  }

  async findCollectionBySlug(
    client: DatabaseClient,
    storeId: string,
    slug: string,
  ): Promise<CollectionWithProductCount | null> {
    const res = await client.query<CollectionWithCountRow>(
      `SELECT 
         c.id, c.store_id, c.title, c.slug, c.description, c.status, c.created_at, c.updated_at,
         COALESCE(cp.product_count, 0)::int AS product_count
       FROM collections c
       LEFT JOIN (
         SELECT collection_id, COUNT(*)::int AS product_count
         FROM collection_products
         GROUP BY collection_id
       ) cp ON cp.collection_id = c.id
       WHERE c.store_id = $1 AND c.slug = $2`,
      [storeId, slug],
    );
    return res.rows[0] ? mapCollectionWithCount(res.rows[0]) : null;
  }

  async listCollections(
    client: DatabaseClient,
    options: ListCollectionsOptions,
  ): Promise<{ items: CollectionWithProductCount[]; total: number }> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    const offset = Math.max(options.offset ?? 0, 0);
    const params: unknown[] = [options.storeId];
    let paramIdx = 2;

    let statusSql = "";
    if (options.status) {
      statusSql = ` AND c.status = $${paramIdx++}`;
      params.push(options.status);
    }

    const countRes = await client.query<{ total: number | string }>(
      `SELECT COUNT(*)::int AS total FROM collections c WHERE c.store_id = $1${statusSql}`,
      params,
    );
    const total = Number(countRes.rows[0]?.total || 0);

    const queryParams = [...params, limit, offset];
    const res = await client.query<CollectionWithCountRow>(
      `SELECT 
         c.id, c.store_id, c.title, c.slug, c.description, c.status, c.created_at, c.updated_at,
         COALESCE(cp.product_count, 0)::int AS product_count
       FROM collections c
       LEFT JOIN (
         SELECT collection_id, COUNT(*)::int AS product_count
         FROM collection_products
         GROUP BY collection_id
       ) cp ON cp.collection_id = c.id
       WHERE c.store_id = $1${statusSql}
       ORDER BY c.created_at DESC
       LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
      queryParams,
    );

    return {
      items: res.rows.map(mapCollectionWithCount),
      total,
    };
  }

  async updateCollection(
    client: DatabaseClient,
    storeId: string,
    collectionId: string,
    updates: {
      title?: string;
      slug?: string;
      description?: string | null;
      status?: CollectionStatus;
    },
  ): Promise<CollectionWithProductCount | null> {
    const setClauses: string[] = ["updated_at = NOW()"];
    const params: unknown[] = [storeId, collectionId];
    let paramIdx = 3;

    if (updates.title !== undefined) {
      setClauses.push(`title = $${paramIdx++}`);
      params.push(updates.title);
    }
    if (updates.slug !== undefined) {
      setClauses.push(`slug = $${paramIdx++}`);
      params.push(updates.slug);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIdx++}`);
      params.push(updates.description);
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIdx++}`);
      params.push(updates.status);
    }

    await client.query(
      `UPDATE collections
       SET ${setClauses.join(", ")}
       WHERE store_id = $1 AND id = $2`,
      params,
    );

    return this.findCollectionById(client, storeId, collectionId);
  }

  async deleteCollection(
    client: DatabaseClient,
    storeId: string,
    collectionId: string,
  ): Promise<boolean> {
    const res = await client.query(
      `DELETE FROM collections WHERE store_id = $1 AND id = $2`,
      [storeId, collectionId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async addProductToCollection(
    client: DatabaseClient,
    storeId: string,
    collectionId: string,
    productId: string,
    position: number = 0,
  ): Promise<void> {
    await client.query(
      `INSERT INTO collection_products (collection_id, product_id, store_id, position)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (collection_id, product_id)
       DO UPDATE SET position = EXCLUDED.position`,
      [collectionId, productId, storeId, position],
    );
  }

  async removeProductFromCollection(
    client: DatabaseClient,
    storeId: string,
    collectionId: string,
    productId: string,
  ): Promise<boolean> {
    const res = await client.query(
      `DELETE FROM collection_products
       WHERE store_id = $1 AND collection_id = $2 AND product_id = $3`,
      [storeId, collectionId, productId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async listCollectionProductIds(
    client: DatabaseClient,
    storeId: string,
    collectionId: string,
  ): Promise<string[]> {
    const res = await client.query<{ product_id: string }>(
      `SELECT product_id
       FROM collection_products
       WHERE store_id = $1 AND collection_id = $2
       ORDER BY position ASC, created_at ASC`,
      [storeId, collectionId],
    );
    return res.rows.map((r) => r.product_id);
  }
}
