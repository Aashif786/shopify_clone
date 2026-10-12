import type { DatabaseClient } from "@shopify-clone/db";
import type {
  Product,
  ProductMedia,
  ProductStatus,
  ProductVariant,
  ProductWithDetails,
  VariantStatus,
} from "../domain/entities.js";

interface ProductRow {
  id: string;
  store_id: string;
  title: string;
  description: string | null;
  slug: string;
  status: string;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface ProductWithCountsRow extends ProductRow {
  variants_count: number | string;
  media_count: number | string;
  price?: number | string | null;
  compare_at_price?: number | string | null;
  currency?: string | null;
  primary_media_url?: string | null;
  primary_media_alt?: string | null;
}

interface ProductVariantRow {
  id: string;
  product_id: string;
  store_id: string;
  title: string;
  sku: string | null;
  price: string | number;
  compare_at_price: string | number | null;
  currency: string;
  position: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

interface ProductMediaRow {
  id: string;
  product_id: string;
  variant_id: string | null;
  url: string;
  alt_text: string | null;
  position: number;
  created_at: Date;
  updated_at: Date;
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    storeId: row.store_id,
    title: row.title,
    description: row.description,
    slug: row.slug,
    status: row.status as ProductStatus,
    publishedAt: row.published_at ? new Date(row.published_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapVariant(row: ProductVariantRow): ProductVariant {
  return {
    id: row.id,
    productId: row.product_id,
    storeId: row.store_id,
    title: row.title,
    sku: row.sku,
    price: Number(row.price),
    compareAtPrice:
      row.compare_at_price !== null ? Number(row.compare_at_price) : null,
    currency: row.currency,
    position: Number(row.position),
    status: row.status as VariantStatus,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapMedia(row: ProductMediaRow): ProductMedia {
  return {
    id: row.id,
    productId: row.product_id,
    variantId: row.variant_id,
    url: row.url,
    altText: row.alt_text,
    position: Number(row.position),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function encodeCursor(payload: { id: string; createdAt: string }): string {
  return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
}

function decodeCursor(cursor: string): { id: string; createdAt: string } | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === "string" && typeof parsed.createdAt === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export interface ListProductsOptions {
  storeId: string;
  status?: ProductStatus;
  limit?: number;
  cursor?: string;
}

export interface ListProductsResult {
  items: Array<{
    product: Product;
    variantsCount: number;
    mediaCount: number;
    price?: number | null;
    compareAtPrice?: number | null;
    currency?: string | null;
    primaryMediaUrl?: string | null;
    primaryMediaAlt?: string | null;
  }>;
  hasMore: boolean;
  nextCursor?: string;
}

export class ProductRepository {
  async insertProduct(
    client: DatabaseClient,
    product: {
      id: string;
      storeId: string;
      title: string;
      description?: string | null;
      slug: string;
      status: ProductStatus;
      publishedAt?: Date | null;
    },
  ): Promise<Product> {
    const res = await client.query<ProductRow>(
      `INSERT INTO products (id, store_id, title, description, slug, status, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, store_id, title, description, slug, status, published_at, created_at, updated_at`,
      [
        product.id,
        product.storeId,
        product.title,
        product.description ?? null,
        product.slug,
        product.status,
        product.publishedAt ?? null,
      ],
    );
    return mapProduct(res.rows[0]!);
  }

  async findProductById(
    client: DatabaseClient,
    storeId: string,
    productId: string,
  ): Promise<Product | null> {
    const res = await client.query<ProductRow>(
      `SELECT id, store_id, title, description, slug, status, published_at, created_at, updated_at
       FROM products
       WHERE store_id = $1 AND id = $2`,
      [storeId, productId],
    );
    return res.rows[0] ? mapProduct(res.rows[0]) : null;
  }

  async findProductBySlug(
    client: DatabaseClient,
    storeId: string,
    slug: string,
  ): Promise<Product | null> {
    const res = await client.query<ProductRow>(
      `SELECT id, store_id, title, description, slug, status, published_at, created_at, updated_at
       FROM products
       WHERE store_id = $1 AND slug = $2`,
      [storeId, slug],
    );
    return res.rows[0] ? mapProduct(res.rows[0]) : null;
  }

  async listProducts(
    client: DatabaseClient,
    options: ListProductsOptions,
  ): Promise<ListProductsResult> {
    const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
    const params: unknown[] = [options.storeId];
    let paramIdx = 2;

    let filterSql = "p.store_id = $1";

    if (options.status) {
      filterSql += ` AND p.status = $${paramIdx++}`;
      params.push(options.status);
    }

    if (options.cursor) {
      const decoded = decodeCursor(options.cursor);
      if (decoded) {
        filterSql += ` AND (p.created_at, p.id) < ($${paramIdx++}, $${paramIdx++})`;
        params.push(new Date(decoded.createdAt), decoded.id);
      }
    }

    params.push(limit + 1);
    const limitParamIndex = paramIdx;

    const querySql = `
      SELECT 
        p.id, p.store_id, p.title, p.description, p.slug, p.status, p.published_at, p.created_at, p.updated_at,
        COALESCE(v.variants_count, 0) AS variants_count,
        COALESCE(m.media_count, 0) AS media_count,
        pv.price, pv.compare_at_price, pv.currency,
        pm.url AS primary_media_url, pm.alt_text AS primary_media_alt
      FROM products p
      LEFT JOIN (
        SELECT product_id, COUNT(*)::int AS variants_count
        FROM product_variants
        GROUP BY product_id
      ) v ON v.product_id = p.id
      LEFT JOIN (
        SELECT product_id, COUNT(*)::int AS media_count
        FROM product_media
        GROUP BY product_id
      ) m ON m.product_id = p.id
      LEFT JOIN LATERAL (
        SELECT price, compare_at_price, currency
        FROM product_variants
        WHERE product_id = p.id
        ORDER BY position ASC, created_at ASC
        LIMIT 1
      ) pv ON true
      LEFT JOIN LATERAL (
        SELECT url, alt_text
        FROM product_media
        WHERE product_id = p.id
        ORDER BY position ASC, created_at ASC
        LIMIT 1
      ) pm ON true
      WHERE ${filterSql}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT $${limitParamIndex}
    `;

    const res = await client.query<ProductWithCountsRow>(querySql, params);
    const hasMore = res.rows.length > limit;
    const rows = hasMore ? res.rows.slice(0, limit) : res.rows;

    const items = rows.map((row) => ({
      product: mapProduct(row),
      variantsCount: Number(row.variants_count),
      mediaCount: Number(row.media_count),
      price: row.price !== null && row.price !== undefined ? Number(row.price) : null,
      compareAtPrice:
        row.compare_at_price !== null && row.compare_at_price !== undefined
          ? Number(row.compare_at_price)
          : null,
      currency: row.currency ?? null,
      primaryMediaUrl: row.primary_media_url ?? null,
      primaryMediaAlt: row.primary_media_alt ?? null,
    }));

    let nextCursor: string | undefined;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1]!;
      nextCursor = encodeCursor({
        id: last.product.id,
        createdAt: last.product.createdAt.toISOString(),
      });
    }

    return {
      items,
      hasMore,
      nextCursor,
    };
  }

  async updateProduct(
    client: DatabaseClient,
    storeId: string,
    productId: string,
    data: {
      title?: string;
      description?: string | null;
      slug?: string;
      status?: ProductStatus;
      publishedAt?: Date | null;
    },
  ): Promise<Product | null> {
    const updates: string[] = ["updated_at = NOW()"];
    const values: unknown[] = [storeId, productId];
    let paramIdx = 3;

    if (data.title !== undefined) {
      updates.push(`title = $${paramIdx++}`);
      values.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIdx++}`);
      values.push(data.description);
    }
    if (data.slug !== undefined) {
      updates.push(`slug = $${paramIdx++}`);
      values.push(data.slug);
    }
    if (data.status !== undefined) {
      updates.push(`status = $${paramIdx++}`);
      values.push(data.status);
    }
    if (data.publishedAt !== undefined) {
      updates.push(`published_at = $${paramIdx++}`);
      values.push(data.publishedAt);
    }

    const res = await client.query<ProductRow>(
      `UPDATE products
       SET ${updates.join(", ")}
       WHERE store_id = $1 AND id = $2
       RETURNING id, store_id, title, description, slug, status, published_at, created_at, updated_at`,
      values,
    );

    return res.rows[0] ? mapProduct(res.rows[0]) : null;
  }

  async insertVariant(
    client: DatabaseClient,
    variant: {
      id: string;
      productId: string;
      storeId: string;
      title: string;
      sku?: string | null;
      price: number;
      compareAtPrice?: number | null;
      currency: string;
      position?: number;
      status?: VariantStatus;
    },
  ): Promise<ProductVariant> {
    const res = await client.query<ProductVariantRow>(
      `INSERT INTO product_variants (
        id, product_id, store_id, title, sku, price, compare_at_price, currency, position, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, product_id, store_id, title, sku, price, compare_at_price, currency, position, status, created_at, updated_at`,
      [
        variant.id,
        variant.productId,
        variant.storeId,
        variant.title,
        variant.sku ?? null,
        variant.price,
        variant.compareAtPrice ?? null,
        variant.currency,
        variant.position ?? 0,
        variant.status ?? "ACTIVE",
      ],
    );
    return mapVariant(res.rows[0]!);
  }

  async findVariantById(
    client: DatabaseClient,
    storeId: string,
    productId: string,
    variantId: string,
  ): Promise<ProductVariant | null> {
    const res = await client.query<ProductVariantRow>(
      `SELECT id, product_id, store_id, title, sku, price, compare_at_price, currency, position, status, created_at, updated_at
       FROM product_variants
       WHERE store_id = $1 AND product_id = $2 AND id = $3`,
      [storeId, productId, variantId],
    );
    return res.rows[0] ? mapVariant(res.rows[0]) : null;
  }

  async findVariantBySku(
    client: DatabaseClient,
    storeId: string,
    sku: string,
  ): Promise<ProductVariant | null> {
    const res = await client.query<ProductVariantRow>(
      `SELECT id, product_id, store_id, title, sku, price, compare_at_price, currency, position, status, created_at, updated_at
       FROM product_variants
       WHERE store_id = $1 AND sku = $2`,
      [storeId, sku],
    );
    return res.rows[0] ? mapVariant(res.rows[0]) : null;
  }

  async listVariantsByProductId(
    client: DatabaseClient,
    storeId: string,
    productId: string,
  ): Promise<ProductVariant[]> {
    const res = await client.query<ProductVariantRow>(
      `SELECT id, product_id, store_id, title, sku, price, compare_at_price, currency, position, status, created_at, updated_at
       FROM product_variants
       WHERE store_id = $1 AND product_id = $2
       ORDER BY position ASC, created_at ASC`,
      [storeId, productId],
    );
    return res.rows.map(mapVariant);
  }

  async countVariants(
    client: DatabaseClient,
    storeId: string,
    productId: string,
  ): Promise<number> {
    const res = await client.query<{ count: string | number }>(
      `SELECT COUNT(*)::int AS count
       FROM product_variants
       WHERE store_id = $1 AND product_id = $2`,
      [storeId, productId],
    );
    return Number(res.rows[0]?.count ?? 0);
  }

  async updateVariant(
    client: DatabaseClient,
    storeId: string,
    productId: string,
    variantId: string,
    data: {
      title?: string;
      sku?: string | null;
      price?: number;
      compareAtPrice?: number | null;
      position?: number;
      status?: VariantStatus;
    },
  ): Promise<ProductVariant | null> {
    const updates: string[] = ["updated_at = NOW()"];
    const values: unknown[] = [storeId, productId, variantId];
    let paramIdx = 4;

    if (data.title !== undefined) {
      updates.push(`title = $${paramIdx++}`);
      values.push(data.title);
    }
    if (data.sku !== undefined) {
      updates.push(`sku = $${paramIdx++}`);
      values.push(data.sku);
    }
    if (data.price !== undefined) {
      updates.push(`price = $${paramIdx++}`);
      values.push(data.price);
    }
    if (data.compareAtPrice !== undefined) {
      updates.push(`compare_at_price = $${paramIdx++}`);
      values.push(data.compareAtPrice);
    }
    if (data.position !== undefined) {
      updates.push(`position = $${paramIdx++}`);
      values.push(data.position);
    }
    if (data.status !== undefined) {
      updates.push(`status = $${paramIdx++}`);
      values.push(data.status);
    }

    const res = await client.query<ProductVariantRow>(
      `UPDATE product_variants
       SET ${updates.join(", ")}
       WHERE store_id = $1 AND product_id = $2 AND id = $3
       RETURNING id, product_id, store_id, title, sku, price, compare_at_price, currency, position, status, created_at, updated_at`,
      values,
    );

    return res.rows[0] ? mapVariant(res.rows[0]) : null;
  }

  async deleteVariant(
    client: DatabaseClient,
    storeId: string,
    productId: string,
    variantId: string,
  ): Promise<boolean> {
    const res = await client.query(
      `DELETE FROM product_variants
       WHERE store_id = $1 AND product_id = $2 AND id = $3`,
      [storeId, productId, variantId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async insertMedia(
    client: DatabaseClient,
    media: {
      id: string;
      productId: string;
      variantId?: string | null;
      url: string;
      altText?: string | null;
      position?: number;
    },
  ): Promise<ProductMedia> {
    const res = await client.query<ProductMediaRow>(
      `INSERT INTO product_media (id, product_id, variant_id, url, alt_text, position)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, product_id, variant_id, url, alt_text, position, created_at, updated_at`,
      [
        media.id,
        media.productId,
        media.variantId ?? null,
        media.url,
        media.altText ?? null,
        media.position ?? 0,
      ],
    );
    return mapMedia(res.rows[0]!);
  }

  async listMediaByProductId(
    client: DatabaseClient,
    productId: string,
  ): Promise<ProductMedia[]> {
    const res = await client.query<ProductMediaRow>(
      `SELECT id, product_id, variant_id, url, alt_text, position, created_at, updated_at
       FROM product_media
       WHERE product_id = $1
       ORDER BY position ASC, created_at ASC`,
      [productId],
    );
    return res.rows.map(mapMedia);
  }

  async getProductWithDetails(
    client: DatabaseClient,
    storeId: string,
    productId: string,
  ): Promise<ProductWithDetails | null> {
    const product = await this.findProductById(client, storeId, productId);
    if (!product) {
      return null;
    }
    const variants = await this.listVariantsByProductId(
      client,
      storeId,
      productId,
    );
    const media = await this.listMediaByProductId(client, productId);
    return { product, variants, media };
  }
}
