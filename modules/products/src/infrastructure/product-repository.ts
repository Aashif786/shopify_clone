import { generateUuidV7, type DatabaseClient } from "@shopify-clone/db";
import type {
  Category,
  Product,
  ProductMedia,
  ProductStatus,
  ProductTag,
  ProductType,
  ProductVariant,
  ProductWithDetails,
  VariantStatus,
  ProductOption,
} from "../domain/entities.js";

interface ProductRow {
  id: string;
  store_id: string;
  title: string;
  description: string | null;
  slug: string;
  status: string;
  type_id?: string | null;
  category_id?: string | null;
  published_at: Date | null;
  low_stock_threshold?: number | string | null;
  max_order_quantity?: number | string | null;
  created_at: Date;
  updated_at: Date;
}

interface ProductWithCountsRow extends ProductRow {
  variants_count: number | string;
  media_count: number | string;
  type_name?: string | null;
  category_name?: string | null;
  tags?: string[] | null;
  price?: number | string | null;
  compare_at_price?: number | string | null;
  currency?: string | null;
  primary_media_url?: string | null;
  primary_media_alt?: string | null;
  total_available?: number | string | null;
  has_stock?: boolean | null;
  rating_average?: number | string | null;
  rating_count?: number | string | null;
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
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  image_id?: string | null;
  image_url?: string | null;
  available_quantity?: number | string | null;
  low_stock_threshold?: number | string | null;
  max_order_quantity?: number | string | null;
  created_at: Date;
  updated_at: Date;
}

interface ProductOptionRow {
  id: string;
  product_id: string;
  store_id: string;
  name: string;
  position: number;
  values: string[];
  created_at: Date;
  updated_at: Date;
}

interface ProductMediaRow {
  id: string;
  product_id: string;
  variant_id: string | null;
  store_id?: string | null;
  url: string;
  alt_text: string | null;
  position: number;
  created_at: Date;
  updated_at: Date;
}

interface ProductTypeRow {
  id: string;
  store_id: string;
  name: string;
  slug: string;
  created_at: Date;
  updated_at: Date;
}

interface CategoryRow {
  id: string;
  store_id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  position: number;
  created_at: Date;
  updated_at: Date;
}

interface ProductTagRow {
  id: string;
  store_id: string;
  name: string;
  normalized_name: string;
  created_at: Date;
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    storeId: row.store_id,
    title: row.title,
    description: row.description,
    slug: row.slug,
    status: row.status as ProductStatus,
    typeId: row.type_id ?? null,
    categoryId: row.category_id ?? null,
    publishedAt: row.published_at ? new Date(row.published_at) : null,
    lowStockThreshold: row.low_stock_threshold !== undefined && row.low_stock_threshold !== null
      ? Number(row.low_stock_threshold)
      : 5,
    maxOrderQuantity: row.max_order_quantity !== undefined && row.max_order_quantity !== null
      ? Number(row.max_order_quantity)
      : null,
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
    option1: row.option1 ?? null,
    option2: row.option2 ?? null,
    option3: row.option3 ?? null,
    imageId: row.image_id ?? null,
    imageUrl: row.image_url ?? null,
    inventoryQuantity:
      row.available_quantity !== undefined && row.available_quantity !== null
        ? Number(row.available_quantity)
        : undefined,
    lowStockThreshold: row.low_stock_threshold !== undefined && row.low_stock_threshold !== null
      ? Number(row.low_stock_threshold)
      : null,
    maxOrderQuantity: row.max_order_quantity !== undefined && row.max_order_quantity !== null
      ? Number(row.max_order_quantity)
      : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapOption(row: ProductOptionRow): ProductOption {
  return {
    id: row.id,
    productId: row.product_id,
    storeId: row.store_id,
    name: row.name,
    position: Number(row.position),
    values: Array.isArray(row.values) ? row.values : [],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapMedia(row: ProductMediaRow): ProductMedia {
  return {
    id: row.id,
    productId: row.product_id,
    variantId: row.variant_id,
    storeId: row.store_id ?? null,
    url: row.url,
    altText: row.alt_text,
    position: Number(row.position),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapProductType(row: ProductTypeRow): ProductType {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    slug: row.slug,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    storeId: row.store_id,
    parentId: row.parent_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    position: Number(row.position),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapProductTag(row: ProductTagRow): ProductTag {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    normalizedName: row.normalized_name,
    createdAt: new Date(row.created_at),
  };
}

export type ProductSortBy =
  | "created_at_desc"
  | "created_at_asc"
  | "price_asc"
  | "price_desc"
  | "title_asc"
  | "title_desc";

interface CursorPayload {
  id?: string;
  createdAt?: string;
  offset?: number;
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return {
        id: typeof parsed.id === "string" ? parsed.id : undefined,
        createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : undefined,
        offset:
          typeof parsed.offset === "number" &&
          Number.isInteger(parsed.offset) &&
          parsed.offset >= 0
            ? parsed.offset
            : undefined,
      };
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
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: ProductSortBy;
  collectionId?: string;
  collectionSlug?: string;
  typeId?: string;
  typeSlug?: string;
  categoryId?: string;
  categorySlug?: string;
  tags?: string[];
}

export interface ListProductsResult {
  items: Array<{
    product: Product;
    variantsCount: number;
    mediaCount: number;
    typeId?: string | null;
    typeName?: string | null;
    categoryId?: string | null;
    categoryName?: string | null;
    tags?: string[];
    price?: number | null;
    compareAtPrice?: number | null;
    currency?: string | null;
    primaryMediaUrl?: string | null;
    primaryMediaAlt?: string | null;
    totalAvailableQuantity?: number;
    isOutOfStock?: boolean;
    isLowStock?: boolean;
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
      typeId?: string | null;
      categoryId?: string | null;
      publishedAt?: Date | null;
      lowStockThreshold?: number;
      maxOrderQuantity?: number | null;
    },
  ): Promise<Product> {
    const res = await client.query<ProductRow>(
      `INSERT INTO products (id, store_id, title, description, slug, status, type_id, category_id, published_at, low_stock_threshold, max_order_quantity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, store_id, title, description, slug, status, type_id, category_id, published_at, low_stock_threshold, max_order_quantity, created_at, updated_at`,
      [
        product.id,
        product.storeId,
        product.title,
        product.description ?? null,
        product.slug,
        product.status,
        product.typeId ?? null,
        product.categoryId ?? null,
        product.publishedAt ?? null,
        product.lowStockThreshold ?? 5,
        product.maxOrderQuantity ?? null,
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
      `SELECT id, store_id, title, description, slug, status, type_id, category_id, published_at, low_stock_threshold, max_order_quantity, created_at, updated_at
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
      `SELECT id, store_id, title, description, slug, status, type_id, category_id, published_at, low_stock_threshold, max_order_quantity, created_at, updated_at
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

    if (options.search && options.search.trim().length > 0) {
      const sanitized = options.search.trim().slice(0, 100);
      const escaped = sanitized.replace(/[%_\\]/g, "\\$&");
      const likeParam = `%${escaped}%`;
      const pIdx = paramIdx++;
      params.push(likeParam);
      filterSql += ` AND (
        p.title ILIKE $${pIdx} ESCAPE '\\'
        OR COALESCE(p.description, '') ILIKE $${pIdx} ESCAPE '\\'
        OR EXISTS (
          SELECT 1 FROM product_variants pv_search
          WHERE pv_search.product_id = p.id
            AND pv_search.store_id = p.store_id
            AND pv_search.sku ILIKE $${pIdx} ESCAPE '\\'
        )
      )`;
    }

    if (options.typeId) {
      filterSql += ` AND p.type_id = $${paramIdx++}`;
      params.push(options.typeId);
    } else if (options.typeSlug) {
      const pIdx = paramIdx++;
      params.push(options.typeSlug);
      filterSql += ` AND EXISTS (
        SELECT 1 FROM product_types pt_filter
        WHERE pt_filter.id = p.type_id
          AND pt_filter.store_id = p.store_id
          AND pt_filter.slug = $${pIdx}
      )`;
    }

    if (options.categoryId) {
      filterSql += ` AND p.category_id = $${paramIdx++}`;
      params.push(options.categoryId);
    } else if (options.categorySlug) {
      const pIdx = paramIdx++;
      params.push(options.categorySlug);
      filterSql += ` AND EXISTS (
        SELECT 1 FROM categories cat_filter
        WHERE cat_filter.id = p.category_id
          AND cat_filter.store_id = p.store_id
          AND cat_filter.slug = $${pIdx}
      )`;
    }

    if (options.tags && options.tags.length > 0) {
      const normalizedTags = options.tags.map((t) => t.trim().toLowerCase()).filter(Boolean);
      if (normalizedTags.length > 0) {
        const pIdx = paramIdx++;
        params.push(normalizedTags);
        // By default: OR across selected tags
        filterSql += ` AND EXISTS (
          SELECT 1 FROM product_tag_assignments pta_filter
          JOIN product_tags pt_filter ON pta_filter.tag_id = pt_filter.id
          WHERE pta_filter.product_id = p.id
            AND pta_filter.store_id = p.store_id
            AND pt_filter.normalized_name = ANY($${pIdx})
        )`;
      }
    }

    if (options.minPrice !== undefined || options.maxPrice !== undefined) {
      let priceCondition = "";
      if (options.minPrice !== undefined && options.minPrice !== null) {
        const minP = Math.max(0, Math.floor(options.minPrice));
        const pIdx = paramIdx++;
        params.push(minP);
        priceCondition += ` AND v_price.price >= $${pIdx}`;
      }
      if (options.maxPrice !== undefined && options.maxPrice !== null) {
        const maxP = Math.max(0, Math.floor(options.maxPrice));
        const pIdx = paramIdx++;
        params.push(maxP);
        priceCondition += ` AND v_price.price <= $${pIdx}`;
      }
      if (priceCondition) {
        filterSql += ` AND EXISTS (
          SELECT 1 FROM product_variants v_price
          WHERE v_price.product_id = p.id
            AND v_price.store_id = p.store_id
            AND v_price.status = 'ACTIVE'
            ${priceCondition}
        )`;
      }
    }

    if (options.inStock === true) {
      filterSql += ` AND EXISTS (
        SELECT 1 FROM product_variants v_stock
        JOIN inventory_items ii ON ii.variant_id = v_stock.id AND ii.store_id = v_stock.store_id
        WHERE v_stock.product_id = p.id
          AND v_stock.store_id = p.store_id
          AND v_stock.status = 'ACTIVE'
          AND ii.available_quantity > 0
      )`;
    }

    if (options.collectionSlug && options.collectionSlug.trim().length > 0) {
      const slugParam = options.collectionSlug.trim();
      const pIdx = paramIdx++;
      params.push(slugParam);
      filterSql += ` AND EXISTS (
        SELECT 1 FROM collections col
        JOIN collection_products cp ON cp.collection_id = col.id AND cp.store_id = col.store_id
        WHERE cp.product_id = p.id
          AND col.store_id = p.store_id
          AND col.slug = $${pIdx}
          AND col.status = 'ACTIVE'
      )`;
    } else if (options.collectionId && options.collectionId.trim().length > 0) {
      const idParam = options.collectionId.trim();
      const pIdx = paramIdx++;
      params.push(idParam);
      filterSql += ` AND EXISTS (
        SELECT 1 FROM collection_products cp
        WHERE cp.product_id = p.id
          AND cp.collection_id = $${pIdx}
          AND cp.store_id = p.store_id
      )`;
    }

    const sortBy = options.sortBy || "created_at_desc";
    let orderBySql = "p.created_at DESC, p.id DESC";
    if (sortBy === "created_at_asc") {
      orderBySql = "p.created_at ASC, p.id ASC";
    } else if (sortBy === "price_asc") {
      orderBySql = "pv.price ASC NULLS LAST, p.id ASC";
    } else if (sortBy === "price_desc") {
      orderBySql = "pv.price DESC NULLS LAST, p.id DESC";
    } else if (sortBy === "title_asc") {
      orderBySql = "lower(p.title) ASC, p.id ASC";
    } else if (sortBy === "title_desc") {
      orderBySql = "lower(p.title) DESC, p.id DESC";
    }

    const decoded = options.cursor ? decodeCursor(options.cursor) : null;
    let offsetSql = "";

    if (decoded) {
      if (sortBy === "created_at_desc" && decoded.createdAt && decoded.id) {
        filterSql += ` AND (p.created_at, p.id) < ($${paramIdx++}, $${paramIdx++})`;
        params.push(new Date(decoded.createdAt), decoded.id);
      } else if (decoded.offset !== undefined && decoded.offset > 0) {
        offsetSql = ` OFFSET $${paramIdx++}`;
        params.push(decoded.offset);
      }
    }

    params.push(limit + 1);
    const limitParamIndex = paramIdx++;

    const querySql = `
      SELECT 
        p.id, p.store_id, p.title, p.description, p.slug, p.status, p.type_id, p.category_id, p.published_at, p.low_stock_threshold, p.max_order_quantity, p.created_at, p.updated_at,
        pt.name AS type_name,
        cat.name AS category_name,
        COALESCE(tag_agg.tags, ARRAY[]::text[]) AS tags,
        COALESCE(v.variants_count, 0) AS variants_count,
        COALESCE(m.media_count, 0) AS media_count,
        pv.price, pv.compare_at_price, pv.currency,
        pm.url AS primary_media_url, pm.alt_text AS primary_media_alt,
        COALESCE(inv.total_available, 0) AS total_available,
        COALESCE(inv.has_stock, false) AS has_stock,
        COALESCE(rev.rating_average, 0) AS rating_average,
        COALESCE(rev.rating_count, 0) AS rating_count
      FROM products p
      LEFT JOIN product_types pt ON pt.id = p.type_id AND pt.store_id = p.store_id
      LEFT JOIN categories cat ON cat.id = p.category_id AND cat.store_id = p.store_id
      LEFT JOIN LATERAL (
        SELECT ARRAY_AGG(ptag.name ORDER BY ptag.name) AS tags
        FROM product_tag_assignments pta
        JOIN product_tags ptag ON ptag.id = pta.tag_id
        WHERE pta.product_id = p.id
      ) tag_agg ON true
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
      LEFT JOIN (
        SELECT pv_inv.product_id,
               SUM(COALESCE(ii.available_quantity, 0))::int AS total_available,
               BOOL_OR(COALESCE(ii.available_quantity, 0) > 0) AS has_stock
        FROM product_variants pv_inv
        LEFT JOIN inventory_items ii ON ii.variant_id = pv_inv.id AND ii.store_id = pv_inv.store_id
        WHERE pv_inv.status = 'ACTIVE'
        GROUP BY pv_inv.product_id
      ) inv ON inv.product_id = p.id
      LEFT JOIN (
        SELECT product_id,
               ROUND(AVG(rating)::numeric, 1)::float AS rating_average,
               COUNT(*)::int AS rating_count
        FROM product_reviews
        WHERE status = 'PUBLISHED'
        GROUP BY product_id
      ) rev ON rev.product_id = p.id
      WHERE ${filterSql}
      ORDER BY ${orderBySql}
      LIMIT $${limitParamIndex}${offsetSql}
    `;

    const res = await client.query<ProductWithCountsRow>(querySql, params);
    const hasMore = res.rows.length > limit;
    const rows = hasMore ? res.rows.slice(0, limit) : res.rows;

    const items = rows.map((row) => ({
      product: mapProduct(row),
      variantsCount: Number(row.variants_count),
      mediaCount: Number(row.media_count),
      typeId: row.type_id ?? null,
      typeName: row.type_name ?? null,
      categoryId: row.category_id ?? null,
      categoryName: row.category_name ?? null,
      tags: Array.isArray(row.tags) ? row.tags : [],
      price: row.price !== null && row.price !== undefined ? Number(row.price) : null,
      compareAtPrice:
        row.compare_at_price !== null && row.compare_at_price !== undefined
          ? Number(row.compare_at_price)
          : null,
      currency: row.currency ?? null,
      primaryMediaUrl: row.primary_media_url ?? null,
      primaryMediaAlt: row.primary_media_alt ?? null,
      totalAvailableQuantity: Number(row.total_available ?? 0),
      isOutOfStock:
        Number(row.variants_count) === 0 ||
        !row.has_stock ||
        Number(row.total_available ?? 0) <= 0,
      isLowStock:
        Number(row.variants_count) > 0 &&
        Boolean(row.has_stock) &&
        Number(row.total_available ?? 0) > 0 &&
        Number(row.total_available ?? 0) <= Number(row.low_stock_threshold ?? 5),
      ratingAverage:
        row.rating_count && Number(row.rating_count) > 0 ? Number(row.rating_average) : null,
      ratingCount: Number(row.rating_count ?? 0),
    }));

    let nextCursor: string | undefined;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1]!;
      const currentOffset = decoded?.offset ?? 0;
      nextCursor = encodeCursor({
        id: last.product.id,
        createdAt: last.product.createdAt.toISOString(),
        offset: currentOffset + items.length,
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
      typeId?: string | null;
      categoryId?: string | null;
      publishedAt?: Date | null;
      lowStockThreshold?: number;
      maxOrderQuantity?: number | null;
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
    if (data.typeId !== undefined) {
      updates.push(`type_id = $${paramIdx++}`);
      values.push(data.typeId);
    }
    if (data.categoryId !== undefined) {
      updates.push(`category_id = $${paramIdx++}`);
      values.push(data.categoryId);
    }
    if (data.publishedAt !== undefined) {
      updates.push(`published_at = $${paramIdx++}`);
      values.push(data.publishedAt);
    }
    if (data.lowStockThreshold !== undefined) {
      updates.push(`low_stock_threshold = $${paramIdx++}`);
      values.push(data.lowStockThreshold);
    }
    if (data.maxOrderQuantity !== undefined) {
      updates.push(`max_order_quantity = $${paramIdx++}`);
      values.push(data.maxOrderQuantity);
    }

    const res = await client.query<ProductRow>(
      `UPDATE products
       SET ${updates.join(", ")}
       WHERE store_id = $1 AND id = $2
       RETURNING id, store_id, title, description, slug, status, type_id, category_id, published_at, low_stock_threshold, max_order_quantity, created_at, updated_at`,
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
      currency?: string;
      position?: number;
      status?: VariantStatus;
      option1?: string | null;
      option2?: string | null;
      option3?: string | null;
      imageId?: string | null;
      lowStockThreshold?: number | null;
      maxOrderQuantity?: number | null;
      inventoryQuantity?: number;
    },
  ): Promise<ProductVariant> {
    const res = await client.query<ProductVariantRow>(
      `INSERT INTO product_variants (
         id, product_id, store_id, title, sku, price, compare_at_price, currency,
         position, status, option1, option2, option3, image_id, low_stock_threshold, max_order_quantity
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING id, product_id, store_id, title, sku, price, compare_at_price, currency,
                 position, status, option1, option2, option3, image_id, low_stock_threshold, max_order_quantity, created_at, updated_at`,
      [
        variant.id,
        variant.productId,
        variant.storeId,
        variant.title,
        variant.sku ?? null,
        variant.price,
        variant.compareAtPrice ?? null,
        variant.currency ?? "USD",
        variant.position ?? 0,
        variant.status ?? "ACTIVE",
        variant.option1 ?? null,
        variant.option2 ?? null,
        variant.option3 ?? null,
        variant.imageId ?? null,
        variant.lowStockThreshold ?? null,
        variant.maxOrderQuantity ?? null,
      ],
    );

    if (variant.inventoryQuantity !== undefined && variant.inventoryQuantity !== null) {
      await client.query(
        `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 0, NOW(), NOW())
         ON CONFLICT (variant_id) DO UPDATE
         SET available_quantity = EXCLUDED.available_quantity, updated_at = NOW()`,
        [generateUuidV7(), variant.storeId, variant.id, Math.max(0, variant.inventoryQuantity)],
      );
    }

    const row = res.rows[0]!;
    if (variant.inventoryQuantity !== undefined) {
      row.available_quantity = variant.inventoryQuantity;
    }
    return mapVariant(row);
  }

  async findVariantById(
    client: DatabaseClient,
    storeId: string,
    variantId: string,
  ): Promise<ProductVariant | null> {
    const res = await client.query<ProductVariantRow>(
      `SELECT pv.id, pv.product_id, pv.store_id, pv.title, pv.sku, pv.price, pv.compare_at_price,
              pv.currency, pv.position, pv.status, pv.low_stock_threshold, pv.max_order_quantity,
              pv.option1, pv.option2, pv.option3, pv.image_id, pv.created_at, pv.updated_at,
              pm.url AS image_url,
              ii.available_quantity
       FROM product_variants pv
       LEFT JOIN product_media pm ON pm.id = pv.image_id
       LEFT JOIN inventory_items ii ON ii.variant_id = pv.id AND ii.store_id = pv.store_id
       WHERE pv.store_id = $1 AND pv.id = $2`,
      [storeId, variantId],
    );
    return res.rows[0] ? mapVariant(res.rows[0]) : null;
  }

  async findVariantBySku(
    client: DatabaseClient,
    storeId: string,
    sku: string,
  ): Promise<ProductVariant | null> {
    const res = await client.query<ProductVariantRow>(
      `SELECT pv.id, pv.product_id, pv.store_id, pv.title, pv.sku, pv.price, pv.compare_at_price,
              pv.currency, pv.position, pv.status, pv.low_stock_threshold, pv.max_order_quantity,
              pv.option1, pv.option2, pv.option3, pv.image_id, pv.created_at, pv.updated_at,
              pm.url AS image_url,
              ii.available_quantity
       FROM product_variants pv
       LEFT JOIN product_media pm ON pm.id = pv.image_id
       LEFT JOIN inventory_items ii ON ii.variant_id = pv.id AND ii.store_id = pv.store_id
       WHERE pv.store_id = $1 AND pv.sku = $2`,
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
      `SELECT pv.id, pv.product_id, pv.store_id, pv.title, pv.sku, pv.price, pv.compare_at_price,
              pv.currency, pv.position, pv.status, pv.low_stock_threshold, pv.max_order_quantity,
              pv.option1, pv.option2, pv.option3, pv.image_id, pv.created_at, pv.updated_at,
              pm.url AS image_url,
              ii.available_quantity
       FROM product_variants pv
       LEFT JOIN product_media pm ON pm.id = pv.image_id
       LEFT JOIN inventory_items ii ON ii.variant_id = pv.id AND ii.store_id = pv.store_id
       WHERE pv.store_id = $1 AND pv.product_id = $2
       ORDER BY pv.position ASC, pv.created_at ASC`,
      [storeId, productId],
    );
    return res.rows.map(mapVariant);
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
      option1?: string | null;
      option2?: string | null;
      option3?: string | null;
      imageId?: string | null;
      lowStockThreshold?: number | null;
      maxOrderQuantity?: number | null;
      inventoryQuantity?: number;
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
    if (data.option1 !== undefined) {
      updates.push(`option1 = $${paramIdx++}`);
      values.push(data.option1);
    }
    if (data.option2 !== undefined) {
      updates.push(`option2 = $${paramIdx++}`);
      values.push(data.option2);
    }
    if (data.option3 !== undefined) {
      updates.push(`option3 = $${paramIdx++}`);
      values.push(data.option3);
    }
    if (data.imageId !== undefined) {
      updates.push(`image_id = $${paramIdx++}`);
      values.push(data.imageId);
    }
    if (data.lowStockThreshold !== undefined) {
      updates.push(`low_stock_threshold = $${paramIdx++}`);
      values.push(data.lowStockThreshold);
    }
    if (data.maxOrderQuantity !== undefined) {
      updates.push(`max_order_quantity = $${paramIdx++}`);
      values.push(data.maxOrderQuantity);
    }

    const res = await client.query<ProductVariantRow>(
      `UPDATE product_variants
       SET ${updates.join(", ")}
       WHERE store_id = $1 AND product_id = $2 AND id = $3
       RETURNING id, product_id, store_id, title, sku, price, compare_at_price, currency, position, status,
                 option1, option2, option3, image_id, low_stock_threshold, max_order_quantity, created_at, updated_at`,
      values,
    );

    if (data.inventoryQuantity !== undefined && data.inventoryQuantity !== null) {
      await client.query(
        `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 0, NOW(), NOW())
         ON CONFLICT (variant_id) DO UPDATE
         SET available_quantity = EXCLUDED.available_quantity, updated_at = NOW()`,
        [generateUuidV7(), storeId, variantId, Math.max(0, data.inventoryQuantity)],
      );
    }

    return res.rows[0] ? mapVariant(res.rows[0]) : null;
  }

  async batchUpdateVariants(
    client: DatabaseClient,
    storeId: string,
    productId: string,
    updates: Array<{
      id: string;
      title?: string;
      sku?: string | null;
      price?: number;
      compareAtPrice?: number | null;
      position?: number;
      status?: VariantStatus;
      option1?: string | null;
      option2?: string | null;
      option3?: string | null;
      imageId?: string | null;
      lowStockThreshold?: number | null;
      maxOrderQuantity?: number | null;
      inventoryQuantity?: number;
    }>,
  ): Promise<ProductVariant[]> {
    const results: ProductVariant[] = [];
    for (const update of updates) {
      const updated = await this.updateVariant(client, storeId, productId, update.id, update);
      if (updated) {
        results.push(updated);
      }
    }
    return results;
  }

  async countActiveVariantsByProductId(
    client: DatabaseClient,
    storeId: string,
    productId: string,
  ): Promise<number> {
    const res = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM product_variants
       WHERE store_id = $1 AND product_id = $2 AND status = 'ACTIVE'`,
      [storeId, productId],
    );
    return parseInt(res.rows[0]?.count ?? "0", 10);
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

  // --- Product Types ---
  async insertProductType(
    client: DatabaseClient,
    type: { id: string; storeId: string; name: string; slug: string },
  ): Promise<ProductType> {
    const res = await client.query<ProductTypeRow>(
      `INSERT INTO product_types (id, store_id, name, slug)
       VALUES ($1, $2, $3, $4)
       RETURNING id, store_id, name, slug, created_at, updated_at`,
      [type.id, type.storeId, type.name.trim(), type.slug],
    );
    return mapProductType(res.rows[0]!);
  }

  async findProductTypeById(
    client: DatabaseClient,
    storeId: string,
    id: string,
  ): Promise<ProductType | null> {
    const res = await client.query<ProductTypeRow>(
      `SELECT id, store_id, name, slug, created_at, updated_at
       FROM product_types
       WHERE store_id = $1 AND id = $2`,
      [storeId, id],
    );
    return res.rows[0] ? mapProductType(res.rows[0]) : null;
  }

  async findProductTypeBySlug(
    client: DatabaseClient,
    storeId: string,
    slug: string,
  ): Promise<ProductType | null> {
    const res = await client.query<ProductTypeRow>(
      `SELECT id, store_id, name, slug, created_at, updated_at
       FROM product_types
       WHERE store_id = $1 AND slug = $2`,
      [storeId, slug],
    );
    return res.rows[0] ? mapProductType(res.rows[0]) : null;
  }

  async findProductTypeByName(
    client: DatabaseClient,
    storeId: string,
    name: string,
  ): Promise<ProductType | null> {
    const res = await client.query<ProductTypeRow>(
      `SELECT id, store_id, name, slug, created_at, updated_at
       FROM product_types
       WHERE store_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))`,
      [storeId, name],
    );
    return res.rows[0] ? mapProductType(res.rows[0]) : null;
  }

  async listProductTypes(
    client: DatabaseClient,
    storeId: string,
  ): Promise<ProductType[]> {
    const res = await client.query<ProductTypeRow>(
      `SELECT id, store_id, name, slug, created_at, updated_at
       FROM product_types
       WHERE store_id = $1
       ORDER BY name ASC`,
      [storeId],
    );
    return res.rows.map(mapProductType);
  }

  async updateProductType(
    client: DatabaseClient,
    storeId: string,
    id: string,
    data: { name?: string; slug?: string },
  ): Promise<ProductType | null> {
    const updates: string[] = ["updated_at = NOW()"];
    const values: unknown[] = [storeId, id];
    let paramIdx = 3;
    if (data.name !== undefined) {
      updates.push(`name = $${paramIdx++}`);
      values.push(data.name.trim());
    }
    if (data.slug !== undefined) {
      updates.push(`slug = $${paramIdx++}`);
      values.push(data.slug);
    }
    const res = await client.query<ProductTypeRow>(
      `UPDATE product_types
       SET ${updates.join(", ")}
       WHERE store_id = $1 AND id = $2
       RETURNING id, store_id, name, slug, created_at, updated_at`,
      values,
    );
    return res.rows[0] ? mapProductType(res.rows[0]) : null;
  }

  async deleteProductType(
    client: DatabaseClient,
    storeId: string,
    id: string,
  ): Promise<boolean> {
    const res = await client.query(
      `DELETE FROM product_types WHERE store_id = $1 AND id = $2`,
      [storeId, id],
    );
    return (res.rowCount ?? 0) > 0;
  }

  // --- Categories ---
  async insertCategory(
    client: DatabaseClient,
    cat: {
      id: string;
      storeId: string;
      parentId?: string | null;
      name: string;
      slug: string;
      description?: string | null;
      position?: number;
    },
  ): Promise<Category> {
    const res = await client.query<CategoryRow>(
      `INSERT INTO categories (id, store_id, parent_id, name, slug, description, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, store_id, parent_id, name, slug, description, position, created_at, updated_at`,
      [
        cat.id,
        cat.storeId,
        cat.parentId ?? null,
        cat.name.trim(),
        cat.slug,
        cat.description ?? null,
        cat.position ?? 0,
      ],
    );
    return mapCategory(res.rows[0]!);
  }

  async findCategoryById(
    client: DatabaseClient,
    storeId: string,
    id: string,
  ): Promise<Category | null> {
    const res = await client.query<CategoryRow>(
      `SELECT id, store_id, parent_id, name, slug, description, position, created_at, updated_at
       FROM categories
       WHERE store_id = $1 AND id = $2`,
      [storeId, id],
    );
    return res.rows[0] ? mapCategory(res.rows[0]) : null;
  }

  async findCategoryBySlug(
    client: DatabaseClient,
    storeId: string,
    slug: string,
  ): Promise<Category | null> {
    const res = await client.query<CategoryRow>(
      `SELECT id, store_id, parent_id, name, slug, description, position, created_at, updated_at
       FROM categories
       WHERE store_id = $1 AND slug = $2`,
      [storeId, slug],
    );
    return res.rows[0] ? mapCategory(res.rows[0]) : null;
  }

  async listCategories(
    client: DatabaseClient,
    storeId: string,
  ): Promise<Category[]> {
    const res = await client.query<CategoryRow>(
      `SELECT id, store_id, parent_id, name, slug, description, position, created_at, updated_at
       FROM categories
       WHERE store_id = $1
       ORDER BY position ASC, name ASC`,
      [storeId],
    );
    return res.rows.map(mapCategory);
  }

  async updateCategory(
    client: DatabaseClient,
    storeId: string,
    id: string,
    data: {
      name?: string;
      slug?: string;
      parentId?: string | null;
      description?: string | null;
      position?: number;
    },
  ): Promise<Category | null> {
    const updates: string[] = ["updated_at = NOW()"];
    const values: unknown[] = [storeId, id];
    let paramIdx = 3;
    if (data.name !== undefined) {
      updates.push(`name = $${paramIdx++}`);
      values.push(data.name.trim());
    }
    if (data.slug !== undefined) {
      updates.push(`slug = $${paramIdx++}`);
      values.push(data.slug);
    }
    if (data.parentId !== undefined) {
      updates.push(`parent_id = $${paramIdx++}`);
      values.push(data.parentId);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIdx++}`);
      values.push(data.description);
    }
    if (data.position !== undefined) {
      updates.push(`position = $${paramIdx++}`);
      values.push(data.position);
    }
    const res = await client.query<CategoryRow>(
      `UPDATE categories
       SET ${updates.join(", ")}
       WHERE store_id = $1 AND id = $2
       RETURNING id, store_id, parent_id, name, slug, description, position, created_at, updated_at`,
      values,
    );
    return res.rows[0] ? mapCategory(res.rows[0]) : null;
  }

  async deleteCategory(
    client: DatabaseClient,
    storeId: string,
    id: string,
  ): Promise<boolean> {
    const res = await client.query(
      `DELETE FROM categories WHERE store_id = $1 AND id = $2`,
      [storeId, id],
    );
    return (res.rowCount ?? 0) > 0;
  }

  // --- Product Tags ---
  async findOrCreateTags(
    client: DatabaseClient,
    storeId: string,
    tagNames: string[],
  ): Promise<ProductTag[]> {
    const uniqueNormalized = new Map<string, string>();
    for (const raw of tagNames) {
      const clean = raw.trim();
      const norm = clean.toLowerCase();
      if (norm.length > 0 && !uniqueNormalized.has(norm)) {
        uniqueNormalized.set(norm, clean);
      }
    }

    if (uniqueNormalized.size === 0) return [];

    const tags: ProductTag[] = [];
    for (const [norm, orig] of uniqueNormalized.entries()) {
      const res = await client.query<ProductTagRow>(
        `INSERT INTO product_tags (id, store_id, name, normalized_name)
         VALUES (gen_random_uuid(), $1, $2, $3)
         ON CONFLICT (store_id, normalized_name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, store_id, name, normalized_name, created_at`,
        [storeId, orig, norm],
      );
      if (res.rows[0]) {
        tags.push(mapProductTag(res.rows[0]));
      }
    }
    return tags;
  }

  async listTags(
    client: DatabaseClient,
    storeId: string,
  ): Promise<ProductTag[]> {
    const res = await client.query<ProductTagRow>(
      `SELECT id, store_id, name, normalized_name, created_at
       FROM product_tags
       WHERE store_id = $1
       ORDER BY name ASC`,
      [storeId],
    );
    return res.rows.map(mapProductTag);
  }

  async setProductTags(
    client: DatabaseClient,
    storeId: string,
    productId: string,
    tagNames: string[],
  ): Promise<string[]> {
    // 1. Find or create tags
    const tags = await this.findOrCreateTags(client, storeId, tagNames);

    // 2. Clear current product tag assignments
    await client.query(
      `DELETE FROM product_tag_assignments WHERE store_id = $1 AND product_id = $2`,
      [storeId, productId],
    );

    // 3. Re-assign
    if (tags.length > 0) {
      for (const t of tags) {
        await client.query(
          `INSERT INTO product_tag_assignments (product_id, tag_id, store_id)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [productId, t.id, storeId],
        );
      }
    }
    return tags.map((t) => t.name);
  }

  async getProductTags(
    client: DatabaseClient,
    storeId: string,
    productId: string,
  ): Promise<string[]> {
    const res = await client.query<{ name: string }>(
      `SELECT pt.name
       FROM product_tags pt
       JOIN product_tag_assignments pta ON pta.tag_id = pt.id AND pta.store_id = pt.store_id
       WHERE pta.store_id = $1 AND pta.product_id = $2
       ORDER BY pt.name ASC`,
      [storeId, productId],
    );
    return res.rows.map((r) => r.name);
  }

  // --- Media ---
  async insertMedia(
    client: DatabaseClient,
    media: {
      id: string;
      productId: string;
      variantId?: string | null;
      storeId?: string | null;
      url: string;
      altText?: string | null;
      position?: number;
    },
  ): Promise<ProductMedia> {
    const res = await client.query<ProductMediaRow>(
      `INSERT INTO product_media (id, product_id, variant_id, store_id, url, alt_text, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, product_id, variant_id, store_id, url, alt_text, position, created_at, updated_at`,
      [
        media.id,
        media.productId,
        media.variantId ?? null,
        media.storeId ?? null,
        media.url,
        media.altText ?? null,
        media.position ?? 0,
      ],
    );
    return mapMedia(res.rows[0]!);
  }

  async findMediaById(
    client: DatabaseClient,
    storeId: string,
    mediaId: string,
  ): Promise<ProductMedia | null> {
    const res = await client.query<ProductMediaRow>(
      `SELECT id, product_id, variant_id, store_id, url, alt_text, position, created_at, updated_at
       FROM product_media
       WHERE (store_id = $1 OR store_id IS NULL) AND id = $2`,
      [storeId, mediaId],
    );
    return res.rows[0] ? mapMedia(res.rows[0]) : null;
  }

  async deleteMedia(
    client: DatabaseClient,
    storeId: string,
    productId: string,
    mediaId: string,
  ): Promise<boolean> {
    const res = await client.query(
      `DELETE FROM product_media
       WHERE id = $1 AND product_id = $2 AND (store_id = $3 OR store_id IS NULL)`,
      [mediaId, productId, storeId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async reorderMedia(
    client: DatabaseClient,
    storeId: string,
    productId: string,
    mediaIds: string[],
  ): Promise<void> {
    for (let pos = 0; pos < mediaIds.length; pos++) {
      await client.query(
        `UPDATE product_media
         SET position = $1, updated_at = NOW()
         WHERE id = $2 AND product_id = $3 AND (store_id = $4 OR store_id IS NULL)`,
        [pos, mediaIds[pos], productId, storeId],
      );
    }
  }

  async listMediaByProductId(
    client: DatabaseClient,
    productId: string,
  ): Promise<ProductMedia[]> {
    const res = await client.query<ProductMediaRow>(
      `SELECT id, product_id, variant_id, store_id, url, alt_text, position, created_at, updated_at
       FROM product_media
       WHERE product_id = $1
       ORDER BY position ASC, created_at ASC`,
      [productId],
    );
    return res.rows.map(mapMedia);
  }

  async listProductOptions(
    client: DatabaseClient,
    storeId: string,
    productId: string,
  ): Promise<ProductOption[]> {
    const res = await client.query<ProductOptionRow>(
      `SELECT id, product_id, store_id, name, position, values, created_at, updated_at
       FROM product_options
       WHERE store_id = $1 AND product_id = $2
       ORDER BY position ASC, created_at ASC`,
      [storeId, productId],
    );
    return res.rows.map(mapOption);
  }

  async setProductOptions(
    client: DatabaseClient,
    storeId: string,
    productId: string,
    options: Array<{ name: string; position?: number; values: string[] }>,
  ): Promise<ProductOption[]> {
    await client.query(
      `DELETE FROM product_options WHERE store_id = $1 AND product_id = $2`,
      [storeId, productId],
    );

    const inserted: ProductOption[] = [];
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      if (!opt || !opt.name || !opt.name.trim()) continue;
      const optId = generateUuidV7();
      const pos = opt.position !== undefined ? opt.position : i;
      const cleanValues = Array.from(new Set((opt.values || []).map((v) => v.trim()).filter(Boolean)));

      const res = await client.query<ProductOptionRow>(
        `INSERT INTO product_options (id, product_id, store_id, name, position, values, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING id, product_id, store_id, name, position, values, created_at, updated_at`,
        [optId, productId, storeId, opt.name.trim(), pos, cleanValues],
      );
      if (res.rows[0]) {
        inserted.push(mapOption(res.rows[0]));
      }
    }
    return inserted;
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
    const options = await this.listProductOptions(client, storeId, productId);
    const media = await this.listMediaByProductId(client, productId);
    const tags = await this.getProductTags(client, storeId, productId);
    const type = product.typeId
      ? await this.findProductTypeById(client, storeId, product.typeId)
      : null;
    const category = product.categoryId
      ? await this.findCategoryById(client, storeId, product.categoryId)
      : null;

    const reviewRes = await client.query<{ rating_average: number; rating_count: number }>(
      `SELECT ROUND(AVG(rating)::numeric, 1)::float AS rating_average, COUNT(*)::int AS rating_count
       FROM product_reviews
       WHERE store_id = $1 AND product_id = $2 AND status = 'PUBLISHED'`,
      [storeId, productId],
    );
    const reviewRow = reviewRes.rows[0];
    const ratingCount = reviewRow ? Number(reviewRow.rating_count) : 0;
    const ratingAverage = ratingCount > 0 && reviewRow ? Number(reviewRow.rating_average) : null;

    return { product, variants, options, media, tags, type, category, ratingAverage, ratingCount };
  }
}
