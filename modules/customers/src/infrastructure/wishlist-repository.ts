import type { DatabaseClient } from "@calcart/db";
import { generateUuidV7 } from "@calcart/db";
import type { CustomerWishlistItem } from "../domain/entities/wishlist.js";
import type { WishlistItemDTO } from "../application/dtos.js";

interface WishlistRow {
  id: string;
  store_id: string;
  customer_id: string;
  product_id: string;
  variant_id: string | null;
  created_at: Date;
}

interface EnrichedWishlistRow extends WishlistRow {
  product_title: string;
  product_slug: string;
  price: string | number | null;
  compare_at_price: string | number | null;
  currency: string;
  primary_media_url: string | null;
  variant_title: string | null;
  total_available: string | number | null;
}

export class WishlistRepository {
  async addItem(
    client: DatabaseClient,
    storeId: string,
    customerId: string,
    productId: string,
    variantId?: string | null,
  ): Promise<CustomerWishlistItem> {
    const id = generateUuidV7();
    const cleanVariantId = variantId && variantId.trim().length > 0 ? variantId.trim() : null;

    const res = await client.query<WishlistRow>(
      `INSERT INTO customer_wishlists (id, store_id, customer_id, product_id, variant_id, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (store_id, customer_id, product_id, variant_id) WHERE variant_id IS NOT NULL
       DO UPDATE SET created_at = customer_wishlists.created_at
       RETURNING id, store_id, customer_id, product_id, variant_id, created_at`,
      [id, storeId, customerId, productId, cleanVariantId],
    );

    if (res.rows.length === 0 && cleanVariantId === null) {
      // If no variant conflict branch
      const resNull = await client.query<WishlistRow>(
        `INSERT INTO customer_wishlists (id, store_id, customer_id, product_id, variant_id, created_at)
         VALUES ($1, $2, $3, $4, NULL, NOW())
         ON CONFLICT (store_id, customer_id, product_id) WHERE variant_id IS NULL
         DO UPDATE SET created_at = customer_wishlists.created_at
         RETURNING id, store_id, customer_id, product_id, variant_id, created_at`,
        [id, storeId, customerId, productId],
      );
      if (resNull.rows.length > 0) {
        return this.mapWishlistItem(resNull.rows[0]!);
      }
    }

    if (res.rows.length > 0) {
      return this.mapWishlistItem(res.rows[0]!);
    }

    // Fallback: select existing
    const existing = await this.findItem(client, storeId, customerId, productId, cleanVariantId);
    if (existing) {
      return existing;
    }

    throw new Error("Failed to insert or resolve wishlist item");
  }

  async findItem(
    client: DatabaseClient,
    storeId: string,
    customerId: string,
    productId: string,
    variantId?: string | null,
  ): Promise<CustomerWishlistItem | null> {
    const cleanVariantId = variantId && variantId.trim().length > 0 ? variantId.trim() : null;
    let query: string;
    let params: unknown[];

    if (cleanVariantId) {
      query = `SELECT id, store_id, customer_id, product_id, variant_id, created_at
               FROM customer_wishlists
               WHERE store_id = $1 AND customer_id = $2 AND product_id = $3 AND variant_id = $4`;
      params = [storeId, customerId, productId, cleanVariantId];
    } else {
      query = `SELECT id, store_id, customer_id, product_id, variant_id, created_at
               FROM customer_wishlists
               WHERE store_id = $1 AND customer_id = $2 AND product_id = $3 AND variant_id IS NULL`;
      params = [storeId, customerId, productId];
    }

    const res = await client.query<WishlistRow>(query, params);
    return res.rows.length > 0 ? this.mapWishlistItem(res.rows[0]!) : null;
  }

  async removeItem(
    client: DatabaseClient,
    storeId: string,
    customerId: string,
    productId: string,
    variantId?: string | null,
  ): Promise<boolean> {
    const cleanVariantId = variantId && variantId.trim().length > 0 ? variantId.trim() : null;
    let query: string;
    let params: unknown[];

    if (cleanVariantId) {
      query = `DELETE FROM customer_wishlists
               WHERE store_id = $1 AND customer_id = $2 AND product_id = $3 AND variant_id = $4`;
      params = [storeId, customerId, productId, cleanVariantId];
    } else {
      query = `DELETE FROM customer_wishlists
               WHERE store_id = $1 AND customer_id = $2 AND product_id = $3`;
      params = [storeId, customerId, productId];
    }

    const res = await client.query(query, params);
    return (res.rowCount ?? 0) > 0;
  }

  async removeItemById(
    client: DatabaseClient,
    storeId: string,
    customerId: string,
    itemId: string,
  ): Promise<boolean> {
    const res = await client.query(
      `DELETE FROM customer_wishlists
       WHERE id = $1 AND store_id = $2 AND customer_id = $3`,
      [itemId, storeId, customerId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async clearWishlist(
    client: DatabaseClient,
    storeId: string,
    customerId: string,
  ): Promise<number> {
    const res = await client.query(
      `DELETE FROM customer_wishlists
       WHERE store_id = $1 AND customer_id = $2`,
      [storeId, customerId],
    );
    return res.rowCount ?? 0;
  }

  async listWishlistItems(
    client: DatabaseClient,
    storeId: string,
    customerId: string,
  ): Promise<WishlistItemDTO[]> {
    const sql = `
      SELECT
        cw.id,
        cw.store_id,
        cw.customer_id,
        cw.product_id,
        cw.variant_id,
        cw.created_at,
        p.title AS product_title,
        p.slug AS product_slug,
        COALESCE(pv.price, pv_fallback.price, 0) AS price,
        COALESCE(pv.compare_at_price, pv_fallback.compare_at_price) AS compare_at_price,
        COALESCE(pv.currency, pv_fallback.currency, 'USD') AS currency,
        COALESCE(pv.title, NULL) AS variant_title,
        COALESCE(
          pm_variant.url,
          pm_primary.url,
          (SELECT url FROM product_media WHERE product_id = p.id ORDER BY position ASC LIMIT 1)
        ) AS primary_media_url,
        COALESCE(
          (
            SELECT SUM(COALESCE(ii.available_quantity, 0))
            FROM inventory_items ii
            WHERE ii.store_id = cw.store_id
              AND ii.variant_id = COALESCE(cw.variant_id, pv_fallback.id)
          ),
          0
        ) AS total_available
      FROM customer_wishlists cw
      JOIN products p ON p.id = cw.product_id AND p.store_id = cw.store_id
      LEFT JOIN product_variants pv ON pv.id = cw.variant_id AND pv.store_id = cw.store_id
      LEFT JOIN LATERAL (
        SELECT id, price, compare_at_price, currency
        FROM product_variants
        WHERE product_id = p.id AND store_id = p.store_id AND status = 'ACTIVE'
        ORDER BY position ASC LIMIT 1
      ) pv_fallback ON true
      LEFT JOIN product_media pm_variant ON pm_variant.id = pv.image_id
      LEFT JOIN LATERAL (
        SELECT url
        FROM product_media
        WHERE product_id = p.id AND position = 0
        LIMIT 1
      ) pm_primary ON true
      WHERE cw.store_id = $1 AND cw.customer_id = $2
      ORDER BY cw.created_at DESC
    `;

    const res = await client.query<EnrichedWishlistRow>(sql, [storeId, customerId]);

    return res.rows.map((row) => {
      const avail = Number(row.total_available ?? 0);
      return {
        id: row.id,
        storeId: row.store_id,
        customerId: row.customer_id,
        productId: row.product_id,
        variantId: row.variant_id,
        productTitle: row.product_title,
        productSlug: row.product_slug,
        price: row.price !== null ? Number(row.price) : null,
        compareAtPrice: row.compare_at_price !== null ? Number(row.compare_at_price) : null,
        currency: row.currency || "USD",
        primaryMediaUrl: row.primary_media_url,
        isOutOfStock: avail <= 0,
        variantTitle: row.variant_title,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      };
    });
  }

  async countWishlistItems(
    client: DatabaseClient,
    storeId: string,
    customerId: string,
  ): Promise<number> {
    const res = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM customer_wishlists
       WHERE store_id = $1 AND customer_id = $2`,
      [storeId, customerId],
    );
    return parseInt(res.rows[0]?.count ?? "0", 10);
  }

  async mergeItems(
    client: DatabaseClient,
    storeId: string,
    customerId: string,
    items: Array<{ productId: string; variantId?: string | null }>,
  ): Promise<number> {
    let mergedCount = 0;
    for (const item of items) {
      if (!item.productId) continue;
      try {
        await this.addItem(client, storeId, customerId, item.productId, item.variantId);
        mergedCount++;
      } catch {
        // Ignore single item failure during merge to keep resilient
      }
    }
    return mergedCount;
  }

  async batchResolveItems(
    client: DatabaseClient,
    storeId: string,
    items: Array<{ productId: string; variantId?: string | null }>,
  ): Promise<WishlistItemDTO[]> {
    if (!items || items.length === 0) return [];
    const productIds = Array.from(new Set(items.map((i) => i.productId).filter(Boolean)));
    if (productIds.length === 0) return [];

    const sql = `
      SELECT
        p.id AS product_id,
        pv.id AS variant_id,
        p.title AS product_title,
        p.slug AS product_slug,
        COALESCE(pv.price, pv_fallback.price, 0) AS price,
        COALESCE(pv.compare_at_price, pv_fallback.compare_at_price) AS compare_at_price,
        COALESCE(pv.currency, pv_fallback.currency, 'USD') AS currency,
        pv.title AS variant_title,
        COALESCE(
          pm_variant.url,
          pm_primary.url,
          (SELECT url FROM product_media WHERE product_id = p.id ORDER BY position ASC LIMIT 1)
        ) AS primary_media_url,
        COALESCE(
          (
            SELECT SUM(COALESCE(ii.available_quantity, 0))
            FROM inventory_items ii
            WHERE ii.store_id = p.store_id
              AND ii.variant_id = COALESCE(pv.id, pv_fallback.id)
          ),
          0
        ) AS total_available
      FROM products p
      LEFT JOIN LATERAL (
        SELECT id, title, price, compare_at_price, currency, image_id
        FROM product_variants
        WHERE product_id = p.id AND store_id = p.store_id AND status = 'ACTIVE'
        ORDER BY position ASC LIMIT 1
      ) pv_fallback ON true
      LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.store_id = p.store_id AND pv.status = 'ACTIVE'
      LEFT JOIN product_media pm_variant ON pm_variant.id = pv.image_id
      LEFT JOIN LATERAL (
        SELECT url
        FROM product_media
        WHERE product_id = p.id AND position = 0
        LIMIT 1
      ) pm_primary ON true
      WHERE p.store_id = $1 AND p.id = ANY($2) AND p.status = 'ACTIVE'
    `;

    const res = await client.query<{
      product_id: string;
      variant_id: string | null;
      product_title: string;
      product_slug: string;
      price: string | number | null;
      compare_at_price: string | number | null;
      currency: string;
      variant_title: string | null;
      primary_media_url: string | null;
      total_available: string | number | null;
    }>(sql, [storeId, productIds]);
    const rowMap = new Map<string, (typeof res.rows)[0]>();
    for (const r of res.rows) {
      const key = `${r.product_id}:${r.variant_id || ""}`;
      rowMap.set(key, r);
      if (!rowMap.has(r.product_id)) {
        rowMap.set(r.product_id, r);
      }
    }

    const results: WishlistItemDTO[] = [];
    for (const item of items) {
      const match =
        (item.variantId ? rowMap.get(`${item.productId}:${item.variantId}`) : null) ||
        rowMap.get(item.productId);
      if (match) {
        const avail = Number(match.total_available ?? 0);
        results.push({
          id: `guest_${item.productId}_${item.variantId || "default"}`,
          storeId,
          customerId: "guest",
          productId: match.product_id,
          variantId: item.variantId ?? (match.variant_id || null),
          createdAt: new Date().toISOString(),
          productTitle: match.product_title,
          productSlug: match.product_slug,
          price: Number(match.price),
          compareAtPrice: match.compare_at_price ? Number(match.compare_at_price) : null,
          currency: match.currency,
          variantTitle: match.variant_title ?? null,
          primaryMediaUrl: match.primary_media_url ?? null,
          isOutOfStock: avail <= 0,
          totalAvailable: avail,
        });
      }
    }
    return results;
  }

  private mapWishlistItem(row: WishlistRow): CustomerWishlistItem {
    return {
      id: row.id,
      storeId: row.store_id,
      customerId: row.customer_id,
      productId: row.product_id,
      variantId: row.variant_id,
      createdAt: new Date(row.created_at),
    };
  }
}
