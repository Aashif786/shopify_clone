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
  ProductOptionValue,
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
  variant_id?: string | null;
  is_standalone_variant?: boolean | null;
  display_title?: string | null;
}

interface ProductVariantRow {
  id: string;
  product_id: string;
  store_id: string;
  title: string;
  display_title?: string | null;
  published_as_product?: boolean | null;
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
  media_ids?: string[] | null;
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
  is_publishable: boolean;
  created_at: Date;
  updated_at: Date;
}

interface ProductOptionValueRow {
  id: string;
  product_id: string;
  store_id: string;
  option_id: string;
  value: string;
  display_title: string | null;
  is_published: boolean;
  position: number;
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
    displayTitle: row.display_title ?? null,
    publishedAsProduct: Boolean(row.published_as_product),
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
    mediaIds: Array.isArray(row.media_ids) ? row.media_ids : [],
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

function mapOption(row: ProductOptionRow, optionValues?: ProductOptionValue[]): ProductOption {
  return {
    id: row.id,
    productId: row.product_id,
    storeId: row.store_id,
    name: row.name,
    position: Number(row.position),
    values: Array.isArray(row.values) ? row.values : [],
    isPublishable: Boolean(row.is_publishable),
    optionValues: optionValues || [],
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
  includeStandaloneVariants?: boolean;
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
    variantId?: string | null;
    isStandaloneVariant?: boolean;
    displayTitle?: string | null;
  }>;
  hasMore: boolean;
  nextCursor?: string;
}

export class ProductRepository {
  async findStoreCurrency(
    client: DatabaseClient,
    storeId: string,
  ): Promise<string | null> {
    const res = await client.query<{ currency: string }>(
      "SELECT currency FROM stores WHERE id = $1",
      [storeId],
    );
    return res.rows[0]?.currency ?? null;
  }

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

    if (options.includeStandaloneVariants) {
      const params: unknown[] = [options.storeId];
      let pIdx = 2;

      let parentBaseFilter = "p.store_id = $1";
      if (options.status) {
        parentBaseFilter += ` AND p.status = $${pIdx++}`;
        params.push(options.status);
      }

      let searchParamIdx: number | null = null;
      if (options.search && options.search.trim().length > 0) {
        const sanitized = options.search.trim().slice(0, 100);
        const escaped = sanitized.replace(/[%_\\]/g, "\\$&");
        searchParamIdx = pIdx++;
        params.push(`%${escaped}%`);
      }

      let typeFilterSql = "";
      if (options.typeId) {
        const idx = pIdx++;
        params.push(options.typeId);
        typeFilterSql = ` AND p.type_id = $${idx}`;
      } else if (options.typeSlug) {
        const idx = pIdx++;
        params.push(options.typeSlug);
        typeFilterSql = ` AND EXISTS (SELECT 1 FROM product_types pt_f WHERE pt_f.id = p.type_id AND pt_f.store_id = p.store_id AND pt_f.slug = $${idx})`;
      }

      let categoryFilterSql = "";
      if (options.categoryId) {
        const idx = pIdx++;
        params.push(options.categoryId);
        categoryFilterSql = ` AND p.category_id = $${idx}`;
      } else if (options.categorySlug) {
        const idx = pIdx++;
        params.push(options.categorySlug);
        categoryFilterSql = ` AND EXISTS (SELECT 1 FROM categories cat_f WHERE cat_f.id = p.category_id AND cat_f.store_id = p.store_id AND cat_f.slug = $${idx})`;
      }

      let tagFilterSql = "";
      if (options.tags && options.tags.length > 0) {
        const normalizedTags = options.tags.map((t) => t.trim().toLowerCase()).filter(Boolean);
        if (normalizedTags.length > 0) {
          const idx = pIdx++;
          params.push(normalizedTags);
          tagFilterSql = ` AND EXISTS (
            SELECT 1 FROM product_tag_assignments pta_f
            JOIN product_tags pt_f ON pta_f.tag_id = pt_f.id
            WHERE pta_f.product_id = p.id AND pta_f.store_id = p.store_id AND pt_f.normalized_name = ANY($${idx})
          )`;
        }
      }

      let collectionFilterSql = "";
      if (options.collectionSlug && options.collectionSlug.trim().length > 0) {
        const idx = pIdx++;
        params.push(options.collectionSlug.trim());
        collectionFilterSql = ` AND EXISTS (
          SELECT 1 FROM collections col_f
          JOIN collection_products cp_f ON cp_f.collection_id = col_f.id AND cp_f.store_id = col_f.store_id
          WHERE cp_f.product_id = p.id AND col_f.store_id = p.store_id AND col_f.slug = $${idx} AND col_f.status = 'ACTIVE'
        )`;
      } else if (options.collectionId && options.collectionId.trim().length > 0) {
        const idx = pIdx++;
        params.push(options.collectionId.trim());
        collectionFilterSql = ` AND EXISTS (
          SELECT 1 FROM collection_products cp_f
          WHERE cp_f.product_id = p.id AND cp_f.collection_id = $${idx} AND cp_f.store_id = p.store_id
        )`;
      }

      const commonParentFilters = `${parentBaseFilter}${typeFilterSql}${categoryFilterSql}${tagFilterSql}${collectionFilterSql}`;

      let standaloneSearchSql = "";
      let parentSearchSql = "";
      if (searchParamIdx !== null) {
        standaloneSearchSql = ` AND (
          pv.display_title ILIKE $${searchParamIdx} ESCAPE '\\'
          OR pv.title ILIKE $${searchParamIdx} ESCAPE '\\'
          OR p.title ILIKE $${searchParamIdx} ESCAPE '\\'
          OR COALESCE(p.description, '') ILIKE $${searchParamIdx} ESCAPE '\\'
          OR pv.sku ILIKE $${searchParamIdx} ESCAPE '\\'
        )`;
        parentSearchSql = ` AND (
          p.title ILIKE $${searchParamIdx} ESCAPE '\\'
          OR COALESCE(p.description, '') ILIKE $${searchParamIdx} ESCAPE '\\'
          OR EXISTS (
            SELECT 1 FROM product_variants pv_search
            WHERE pv_search.product_id = p.id
              AND pv_search.store_id = p.store_id
              AND pv_search.status = 'ACTIVE'
              AND pv_search.published_as_product = FALSE
              AND (
                pv_search.sku ILIKE $${searchParamIdx} ESCAPE '\\'
                OR pv_search.title ILIKE $${searchParamIdx} ESCAPE '\\'
              )
          )
        )`;
      }

      let standalonePriceSql = "";
      let parentPriceSql = "";
      if (options.minPrice !== undefined && options.minPrice !== null) {
        const minP = Math.max(0, Math.floor(options.minPrice));
        const idx = pIdx++;
        params.push(minP);
        standalonePriceSql += ` AND pv.price >= $${idx}`;
        parentPriceSql += ` AND v_price.price >= $${idx}`;
      }
      if (options.maxPrice !== undefined && options.maxPrice !== null) {
        const maxP = Math.max(0, Math.floor(options.maxPrice));
        const idx = pIdx++;
        params.push(maxP);
        standalonePriceSql += ` AND pv.price <= $${idx}`;
        parentPriceSql += ` AND v_price.price <= $${idx}`;
      }

      let standaloneStockSql = "";
      let parentStockSql = "";
      if (options.inStock === true) {
        standaloneStockSql = ` AND COALESCE(ii.available_quantity, 0) > 0`;
        parentStockSql = ` AND EXISTS (
          SELECT 1 FROM product_variants v_stock
          JOIN inventory_items ii_s ON ii_s.variant_id = v_stock.id AND ii_s.store_id = v_stock.store_id
          WHERE v_stock.product_id = p.id
            AND v_stock.store_id = p.store_id
            AND v_stock.status = 'ACTIVE'
            AND v_stock.published_as_product = FALSE
            AND ii_s.available_quantity > 0
        )`;
      }

      const sortBy = options.sortBy || "created_at_desc";
      let orderBySql = "items.created_at DESC, items.id DESC, items.variant_id DESC NULLS LAST";
      if (sortBy === "created_at_asc") {
        orderBySql = "items.created_at ASC, items.id ASC, items.variant_id ASC NULLS LAST";
      } else if (sortBy === "price_asc") {
        orderBySql = "items.price ASC NULLS LAST, items.id ASC";
      } else if (sortBy === "price_desc") {
        orderBySql = "items.price DESC NULLS LAST, items.id DESC";
      } else if (sortBy === "title_asc") {
        orderBySql = "lower(items.title) ASC, items.id ASC";
      } else if (sortBy === "title_desc") {
        orderBySql = "lower(items.title) DESC, items.id DESC";
      }

      const decoded = options.cursor ? decodeCursor(options.cursor) : null;
      let offsetSql = "";
      if (decoded && decoded.offset !== undefined && decoded.offset > 0) {
        offsetSql = ` OFFSET $${pIdx++}`;
        params.push(decoded.offset);
      }

      params.push(limit + 1);
      const limitParamIndex = pIdx++;

      const standaloneUnionSql = `
        SELECT * FROM (
          -- Part 1A: Option-Level Standalone Listings
          SELECT
            p.id, p.store_id,
            COALESCE(
              NULLIF(pov.display_title, ''),
              p.title || ' - ' || pov.value
            ) AS title,
            p.description, p.slug, p.status, p.type_id, p.category_id,
            p.published_at,
            COALESCE(pv_rep.low_stock_threshold, p.low_stock_threshold) AS low_stock_threshold,
            COALESCE(pv_rep.max_order_quantity, p.max_order_quantity) AS max_order_quantity,
            pov.created_at, pov.updated_at,
            pt.name AS type_name,
            cat.name AS category_name,
            COALESCE(tag_agg.tags, ARRAY[]::text[]) AS tags,
            1 AS variants_count,
            COALESCE(m.media_count, 0) AS media_count,
            pv_rep.price, pv_rep.compare_at_price, pv_rep.currency,
            COALESCE(povm_first.url, pm_first.url) AS primary_media_url,
            COALESCE(povm_first.alt_text, pm_first.alt_text) AS primary_media_alt,
            COALESCE(inv_rep.total_available, 0) AS total_available,
            COALESCE(inv_rep.has_stock, false) AS has_stock,
            COALESCE(rev.rating_average, 0) AS rating_average,
            COALESCE(rev.rating_count, 0) AS rating_count,
            pv_rep.id AS variant_id,
            TRUE AS is_standalone_variant,
            COALESCE(
              NULLIF(pov.display_title, ''),
              p.title || ' - ' || pov.value
            ) AS display_title
          FROM product_options po
          JOIN product_option_values pov ON pov.option_id = po.id AND pov.store_id = po.store_id
          JOIN products p ON p.id = po.product_id AND p.store_id = po.store_id
          JOIN LATERAL (
            SELECT pv.id, pv.sku, pv.price, pv.compare_at_price, pv.currency, pv.low_stock_threshold, pv.max_order_quantity
            FROM product_variants pv
            WHERE pv.product_id = p.id
              AND pv.store_id = p.store_id
              AND pv.status = 'ACTIVE'
              AND (
                (po.position = 0 AND pv.option1 = pov.value) OR
                (po.position = 1 AND pv.option2 = pov.value) OR
                (po.position = 2 AND pv.option3 = pov.value) OR
                (pv.title ILIKE pov.value OR pv.title ILIKE '%' || pov.value || '%')
              )
            ORDER BY pv.position ASC, pv.created_at ASC
            LIMIT 1
          ) pv_rep ON true
          LEFT JOIN LATERAL (
            SELECT SUM(COALESCE(ii_m.available_quantity, 0))::int AS total_available,
                   BOOL_OR(COALESCE(ii_m.available_quantity, 0) > 0) AS has_stock
            FROM product_variants pv_inv
            LEFT JOIN inventory_items ii_m ON ii_m.variant_id = pv_inv.id AND ii_m.store_id = pv_inv.store_id
            WHERE pv_inv.product_id = p.id
              AND pv_inv.store_id = p.store_id
              AND pv_inv.status = 'ACTIVE'
              AND (
                (po.position = 0 AND pv_inv.option1 = pov.value) OR
                (po.position = 1 AND pv_inv.option2 = pov.value) OR
                (po.position = 2 AND pv_inv.option3 = pov.value) OR
                (pv_inv.title ILIKE pov.value OR pv_inv.title ILIKE '%' || pov.value || '%')
              )
          ) inv_rep ON true
          LEFT JOIN LATERAL (
            SELECT pm.url, pm.alt_text
            FROM product_option_value_media povm
            JOIN product_media pm ON pm.id = povm.media_id
            WHERE povm.option_value_id = pov.id
            ORDER BY povm.position ASC, povm.created_at ASC
            LIMIT 1
          ) povm_first ON true
          LEFT JOIN LATERAL (
            SELECT pm.url, pm.alt_text
            FROM product_media pm
            WHERE pm.product_id = p.id
            ORDER BY pm.position ASC, pm.created_at ASC
            LIMIT 1
          ) pm_first ON true
          LEFT JOIN product_types pt ON pt.id = p.type_id AND pt.store_id = p.store_id
          LEFT JOIN categories cat ON cat.id = p.category_id AND cat.store_id = p.store_id
          LEFT JOIN LATERAL (
            SELECT ARRAY_AGG(ptag.name ORDER BY ptag.name) AS tags
            FROM product_tag_assignments pta
            JOIN product_tags ptag ON ptag.id = pta.tag_id
            WHERE pta.product_id = p.id
          ) tag_agg ON true
          LEFT JOIN (
            SELECT product_id, COUNT(*)::int AS media_count
            FROM product_media
            GROUP BY product_id
          ) m ON m.product_id = p.id
          LEFT JOIN (
            SELECT product_id,
                   ROUND(AVG(rating)::numeric, 1)::float AS rating_average,
                   COUNT(*)::int AS rating_count
            FROM product_reviews
            WHERE status = 'PUBLISHED'
            GROUP BY product_id
          ) rev ON rev.product_id = p.id
          WHERE ${commonParentFilters}
            AND po.is_publishable = TRUE
            AND pov.is_published = TRUE
            ${searchParamIdx !== null ? ` AND (
              pov.display_title ILIKE $${searchParamIdx} ESCAPE '\\'
              OR pov.value ILIKE $${searchParamIdx} ESCAPE '\\'
              OR p.title ILIKE $${searchParamIdx} ESCAPE '\\'
              OR COALESCE(p.description, '') ILIKE $${searchParamIdx} ESCAPE '\\'
              OR pv_rep.sku ILIKE $${searchParamIdx} ESCAPE '\\'
            )` : ""}
            ${standalonePriceSql.replace(/pv\./g, "pv_rep.")}
            ${options.inStock === true ? ` AND COALESCE(inv_rep.total_available, 0) > 0` : ""}

          UNION ALL

          -- Part 1B: Legacy standalone variants (if no publishable options defined on product)
          SELECT
            p.id, p.store_id,
            COALESCE(
              NULLIF(pv.display_title, ''),
              CASE WHEN pv.title <> 'Default Title' AND pv.title <> 'Default'
                   THEN p.title || ' - ' || pv.title
                   ELSE p.title END
            ) AS title,
            p.description, p.slug, p.status, p.type_id, p.category_id,
            p.published_at,
            COALESCE(pv.low_stock_threshold, p.low_stock_threshold) AS low_stock_threshold,
            COALESCE(pv.max_order_quantity, p.max_order_quantity) AS max_order_quantity,
            pv.created_at, pv.updated_at,
            pt.name AS type_name,
            cat.name AS category_name,
            COALESCE(tag_agg.tags, ARRAY[]::text[]) AS tags,
            1 AS variants_count,
            COALESCE(m.media_count, 0) AS media_count,
            pv.price, pv.compare_at_price, pv.currency,
            COALESCE(pvm_first.url, pv_legacy.url, pm_first.url) AS primary_media_url,
            COALESCE(pvm_first.alt_text, pv_legacy.alt_text, pm_first.alt_text) AS primary_media_alt,
            COALESCE(ii.available_quantity, 0) AS total_available,
            COALESCE(ii.available_quantity, 0) > 0 AS has_stock,
            COALESCE(rev.rating_average, 0) AS rating_average,
            COALESCE(rev.rating_count, 0) AS rating_count,
            pv.id AS variant_id,
            TRUE AS is_standalone_variant,
            COALESCE(
              NULLIF(pv.display_title, ''),
              CASE WHEN pv.title <> 'Default Title' AND pv.title <> 'Default'
                   THEN p.title || ' - ' || pv.title
                   ELSE p.title END
            ) AS display_title
          FROM products p
          JOIN product_variants pv ON pv.product_id = p.id AND pv.store_id = p.store_id
          LEFT JOIN inventory_items ii ON ii.variant_id = pv.id AND ii.store_id = pv.store_id
          LEFT JOIN LATERAL (
            SELECT pm.url, pm.alt_text
            FROM product_variant_media pvm
            JOIN product_media pm ON pm.id = pvm.media_id
            WHERE pvm.variant_id = pv.id
            ORDER BY pvm.position ASC, pvm.created_at ASC
            LIMIT 1
          ) pvm_first ON true
          LEFT JOIN LATERAL (
            SELECT pm.url, pm.alt_text
            FROM product_media pm
            WHERE pm.id = pv.image_id
            LIMIT 1
          ) pv_legacy ON true
          LEFT JOIN LATERAL (
            SELECT pm.url, pm.alt_text
            FROM product_media pm
            WHERE pm.product_id = p.id
            ORDER BY pm.position ASC, pm.created_at ASC
            LIMIT 1
          ) pm_first ON true
          LEFT JOIN product_types pt ON pt.id = p.type_id AND pt.store_id = p.store_id
          LEFT JOIN categories cat ON cat.id = p.category_id AND cat.store_id = p.store_id
          LEFT JOIN LATERAL (
            SELECT ARRAY_AGG(ptag.name ORDER BY ptag.name) AS tags
            FROM product_tag_assignments pta
            JOIN product_tags ptag ON ptag.id = pta.tag_id
            WHERE pta.product_id = p.id
          ) tag_agg ON true
          LEFT JOIN (
            SELECT product_id, COUNT(*)::int AS media_count
            FROM product_media
            GROUP BY product_id
          ) m ON m.product_id = p.id
          LEFT JOIN (
            SELECT product_id,
                   ROUND(AVG(rating)::numeric, 1)::float AS rating_average,
                   COUNT(*)::int AS rating_count
            FROM product_reviews
            WHERE status = 'PUBLISHED'
            GROUP BY product_id
          ) rev ON rev.product_id = p.id
          WHERE ${commonParentFilters}
            AND pv.status = 'ACTIVE'
            AND pv.published_as_product = TRUE
            AND NOT EXISTS (
              SELECT 1 FROM product_options po_chk
              WHERE po_chk.product_id = p.id AND po_chk.is_publishable = TRUE
            )
            ${standaloneSearchSql}
            ${standalonePriceSql}
            ${standaloneStockSql}

          UNION ALL

          -- Part 2: Parent Products (only if has active variants NOT published as standalone)
          SELECT
            p.id, p.store_id, p.title, p.description, p.slug, p.status, p.type_id, p.category_id,
            p.published_at, p.low_stock_threshold, p.max_order_quantity, p.created_at, p.updated_at,
            pt.name AS type_name,
            cat.name AS category_name,
            COALESCE(tag_agg.tags, ARRAY[]::text[]) AS tags,
            COALESCE(v.variants_count, 0) AS variants_count,
            COALESCE(m.media_count, 0) AS media_count,
            pv_lead.price, pv_lead.compare_at_price, pv_lead.currency,
            pm_first.url AS primary_media_url, pm_first.alt_text AS primary_media_alt,
            COALESCE(inv.total_available, 0) AS total_available,
            COALESCE(inv.has_stock, false) AS has_stock,
            COALESCE(rev.rating_average, 0) AS rating_average,
            COALESCE(rev.rating_count, 0) AS rating_count,
            NULL::uuid AS variant_id,
            FALSE AS is_standalone_variant,
            p.title AS display_title
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
            WHERE product_id = p.id AND status = 'ACTIVE'
            ORDER BY position ASC, created_at ASC
            LIMIT 1
          ) pv_lead ON true
          LEFT JOIN LATERAL (
            SELECT url, alt_text
            FROM product_media
            WHERE product_id = p.id
            ORDER BY position ASC, created_at ASC
            LIMIT 1
          ) pm_first ON true
          LEFT JOIN (
            SELECT pv_inv.product_id,
                   SUM(COALESCE(ii_inv.available_quantity, 0))::int AS total_available,
                   BOOL_OR(COALESCE(ii_inv.available_quantity, 0) > 0) AS has_stock
            FROM product_variants pv_inv
            LEFT JOIN inventory_items ii_inv ON ii_inv.variant_id = pv_inv.id AND ii_inv.store_id = pv_inv.store_id
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
          WHERE ${commonParentFilters}
            AND (
              -- Case A: Product has no publishable options and no legacy standalone variants
              (
                NOT EXISTS (SELECT 1 FROM product_options po_chk WHERE po_chk.product_id = p.id AND po_chk.is_publishable = TRUE)
                AND NOT EXISTS (SELECT 1 FROM product_variants pv_chk WHERE pv_chk.product_id = p.id AND pv_chk.published_as_product = TRUE)
              )
              OR
              -- Case B: Product has active variants uncovered by any published standalone option value
              EXISTS (
                SELECT 1 FROM product_variants pv_uncovered
                WHERE pv_uncovered.product_id = p.id
                  AND pv_uncovered.store_id = p.store_id
                  AND pv_uncovered.status = 'ACTIVE'
                  AND NOT EXISTS (
                    SELECT 1 FROM product_options po_cov
                    JOIN product_option_values pov_cov ON pov_cov.option_id = po_cov.id
                    WHERE po_cov.product_id = p.id
                      AND po_cov.is_publishable = TRUE
                      AND pov_cov.is_published = TRUE
                      AND (
                        (po_cov.position = 0 AND pv_uncovered.option1 = pov_cov.value) OR
                        (po_cov.position = 1 AND pv_uncovered.option2 = pov_cov.value) OR
                        (po_cov.position = 2 AND pv_uncovered.option3 = pov_cov.value) OR
                        (pv_uncovered.title ILIKE pov_cov.value OR pv_uncovered.title ILIKE '%' || pov_cov.value || '%')
                      )
                  )
                  AND NOT EXISTS (
                    SELECT 1 FROM product_variants pv_leg
                    WHERE pv_leg.id = pv_uncovered.id AND pv_leg.published_as_product = TRUE
                  )
              )
            )
            ${parentSearchSql}
            ${parentPriceSql ? parentPriceSql.replace(/v_price\./g, "pv_lead.") : ""}
            ${parentStockSql}
        ) items
        ORDER BY ${orderBySql}
        LIMIT $${limitParamIndex}${offsetSql}
      `;

      const res = await client.query<ProductWithCountsRow>(standaloneUnionSql, params);
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
        variantId: row.variant_id ?? null,
        isStandaloneVariant: Boolean(row.is_standalone_variant),
        displayTitle: row.display_title ?? null,
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

      return { items, hasMore, nextCursor };
    }

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
            AND (
              pv_search.sku ILIKE $${pIdx} ESCAPE '\\'
              OR COALESCE(pv_search.display_title, '') ILIKE $${pIdx} ESCAPE '\\'
              OR pv_search.title ILIKE $${pIdx} ESCAPE '\\'
            )
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
      displayTitle?: string | null;
      publishedAsProduct?: boolean;
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
         id, product_id, store_id, title, display_title, published_as_product, sku, price, compare_at_price, currency,
         position, status, option1, option2, option3, image_id, low_stock_threshold, max_order_quantity
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING id, product_id, store_id, title, display_title, published_as_product, sku, price, compare_at_price, currency,
                 position, status, option1, option2, option3, image_id, low_stock_threshold, max_order_quantity, created_at, updated_at`,
      [
        variant.id,
        variant.productId,
        variant.storeId,
        variant.title,
        variant.displayTitle ?? null,
        Boolean(variant.publishedAsProduct),
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

  async setVariantMedia(
    client: DatabaseClient,
    storeId: string,
    variantId: string,
    mediaIds: string[],
  ): Promise<void> {
    await client.query(
      `DELETE FROM product_variant_media WHERE store_id = $1 AND variant_id = $2`,
      [storeId, variantId],
    );
    for (let i = 0; i < mediaIds.length; i++) {
      const mediaId = mediaIds[i]!;
      await client.query(
        `INSERT INTO product_variant_media (id, store_id, variant_id, media_id, position, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (variant_id, media_id) DO UPDATE SET position = EXCLUDED.position`,
        [generateUuidV7(), storeId, variantId, mediaId, i],
      );
    }
    const primaryMediaId = mediaIds[0] ?? null;
    await client.query(
      `UPDATE product_variants SET image_id = $1, updated_at = NOW() WHERE store_id = $2 AND id = $3`,
      [primaryMediaId, storeId, variantId],
    );
  }

  async getVariantMediaMap(
    client: DatabaseClient,
    storeId: string,
    variantIds: string[],
  ): Promise<Map<string, { mediaIds: string[]; media: ProductMedia[] }>> {
    const map = new Map<string, { mediaIds: string[]; media: ProductMedia[] }>();
    if (variantIds.length === 0) return map;

    const res = await client.query<{
      variant_id: string;
      media_id: string;
      position: number;
      product_id: string;
      url: string;
      alt_text: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT pvm.variant_id, pvm.media_id, pvm.position,
              pm.product_id, pm.url, pm.alt_text, pm.created_at, pm.updated_at
       FROM product_variant_media pvm
       JOIN product_media pm ON pm.id = pvm.media_id
       WHERE pvm.store_id = $1 AND pvm.variant_id = ANY($2)
       ORDER BY pvm.position ASC, pvm.created_at ASC`,
      [storeId, variantIds],
    );

    for (const row of res.rows) {
      let entry = map.get(row.variant_id);
      if (!entry) {
        entry = { mediaIds: [], media: [] };
        map.set(row.variant_id, entry);
      }
      entry.mediaIds.push(row.media_id);
      entry.media.push({
        id: row.media_id,
        productId: row.product_id,
        variantId: row.variant_id,
        storeId,
        url: row.url,
        altText: row.alt_text,
        position: Number(row.position),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      });
    }

    return map;
  }

  async findVariantById(
    client: DatabaseClient,
    storeId: string,
    variantId: string,
  ): Promise<ProductVariant | null> {
    const res = await client.query<ProductVariantRow>(
      `SELECT pv.id, pv.product_id, pv.store_id, pv.title, pv.display_title, pv.published_as_product,
              pv.sku, pv.price, pv.compare_at_price,
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
    if (!res.rows[0]) return null;
    const variant = mapVariant(res.rows[0]);
    const mediaMap = await this.getVariantMediaMap(client, storeId, [variant.id]);
    const mEntry = mediaMap.get(variant.id);
    if (mEntry && mEntry.mediaIds.length > 0) {
      variant.mediaIds = mEntry.mediaIds;
      variant.media = mEntry.media;
    } else if (variant.imageId) {
      variant.mediaIds = [variant.imageId];
    }
    return variant;
  }

  async findVariantBySku(
    client: DatabaseClient,
    storeId: string,
    sku: string,
  ): Promise<ProductVariant | null> {
    const res = await client.query<ProductVariantRow>(
      `SELECT pv.id, pv.product_id, pv.store_id, pv.title, pv.display_title, pv.published_as_product,
              pv.sku, pv.price, pv.compare_at_price,
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
    if (!res.rows[0]) return null;
    const variant = mapVariant(res.rows[0]);
    const mediaMap = await this.getVariantMediaMap(client, storeId, [variant.id]);
    const mEntry = mediaMap.get(variant.id);
    if (mEntry && mEntry.mediaIds.length > 0) {
      variant.mediaIds = mEntry.mediaIds;
      variant.media = mEntry.media;
    } else if (variant.imageId) {
      variant.mediaIds = [variant.imageId];
    }
    return variant;
  }

  async listVariantsByProductId(
    client: DatabaseClient,
    storeId: string,
    productId: string,
  ): Promise<ProductVariant[]> {
    const res = await client.query<ProductVariantRow>(
      `SELECT pv.id, pv.product_id, pv.store_id, pv.title, pv.display_title, pv.published_as_product,
              pv.sku, pv.price, pv.compare_at_price,
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
    const variants = res.rows.map(mapVariant);
    const variantIds = variants.map((v) => v.id);
    if (variantIds.length > 0) {
      const mediaMap = await this.getVariantMediaMap(client, storeId, variantIds);
      for (const v of variants) {
        const mEntry = mediaMap.get(v.id);
        if (mEntry && mEntry.mediaIds.length > 0) {
          v.mediaIds = mEntry.mediaIds;
          v.media = mEntry.media;
        } else if (v.imageId) {
          v.mediaIds = [v.imageId];
        }
      }
    }
    return variants;
  }

  async updateVariant(
    client: DatabaseClient,
    storeId: string,
    productId: string,
    variantId: string,
    data: {
      title?: string;
      displayTitle?: string | null;
      publishedAsProduct?: boolean;
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
    if (data.displayTitle !== undefined) {
      updates.push(`display_title = $${paramIdx++}`);
      values.push(data.displayTitle ? data.displayTitle.trim() : null);
    }
    if (data.publishedAsProduct !== undefined) {
      updates.push(`published_as_product = $${paramIdx++}`);
      values.push(Boolean(data.publishedAsProduct));
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
       RETURNING id, product_id, store_id, title, display_title, published_as_product, sku, price, compare_at_price, currency, position, status,
                 option1, option2, option3, image_id, low_stock_threshold, max_order_quantity, created_at, updated_at`,
      values,
    );

    if (!res.rows[0]) {
      return null;
    }

    if (data.inventoryQuantity !== undefined && data.inventoryQuantity !== null) {
      await client.query(
        `INSERT INTO inventory_items (id, store_id, variant_id, available_quantity, reserved_quantity, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 0, NOW(), NOW())
         ON CONFLICT (variant_id) DO UPDATE
         SET available_quantity = EXCLUDED.available_quantity, updated_at = NOW()`,
        [generateUuidV7(), storeId, variantId, Math.max(0, data.inventoryQuantity)],
      );
    }

    return mapVariant(res.rows[0]);
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

  async hasVariantReferences(
    client: DatabaseClient,
    storeId: string,
    variantId: string,
  ): Promise<boolean> {
    const res = await client.query<{ has_ref: boolean }>(
      `SELECT (
         EXISTS (SELECT 1 FROM inventory_items WHERE store_id = $1 AND variant_id = $2)
         OR EXISTS (SELECT 1 FROM cart_items WHERE store_id = $1 AND variant_id = $2)
         OR EXISTS (SELECT 1 FROM checkout_items WHERE store_id = $1 AND variant_id = $2)
         OR EXISTS (SELECT 1 FROM order_items WHERE store_id = $1 AND variant_id = $2)
       ) AS has_ref`,
      [storeId, variantId],
    );
    return Boolean(res.rows[0]?.has_ref);
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
      `SELECT id, product_id, store_id, name, position, values, is_publishable, created_at, updated_at
       FROM product_options
       WHERE store_id = $1 AND product_id = $2
       ORDER BY position ASC, created_at ASC`,
      [storeId, productId],
    );

    if (res.rows.length === 0) return [];

    const valRes = await client.query<ProductOptionValueRow>(
      `SELECT id, product_id, store_id, option_id, value, display_title, is_published, position, created_at, updated_at
       FROM product_option_values
       WHERE store_id = $1 AND product_id = $2
       ORDER BY position ASC, created_at ASC`,
      [storeId, productId],
    );

    const mediaRes = await client.query<{
      option_value_id: string;
      media_id: string;
      position: number;
      url: string;
      alt_text: string | null;
      product_id: string;
      variant_id: string | null;
      store_id: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT povm.option_value_id, povm.media_id, povm.position,
              pm.url, pm.alt_text, pm.product_id, pm.variant_id, pm.store_id,
              pm.created_at, pm.updated_at
       FROM product_option_value_media povm
       JOIN product_media pm ON pm.id = povm.media_id
       WHERE povm.store_id = $1 AND povm.product_id = $2
       ORDER BY povm.position ASC, povm.created_at ASC`,
      [storeId, productId],
    );

    const mediaByValId = new Map<string, Array<{ mediaId: string; media: ProductMedia }>>();
    for (const m of mediaRes.rows) {
      const list = mediaByValId.get(m.option_value_id) || [];
      list.push({
        mediaId: m.media_id,
        media: {
          id: m.media_id,
          productId: m.product_id,
          variantId: m.variant_id,
          storeId: m.store_id,
          url: m.url,
          altText: m.alt_text,
          position: m.position,
          createdAt: new Date(m.created_at),
          updatedAt: new Date(m.updated_at),
        },
      });
      mediaByValId.set(m.option_value_id, list);
    }

    const valByOptId = new Map<string, ProductOptionValue[]>();
    for (const v of valRes.rows) {
      const mList = mediaByValId.get(v.id) || [];
      const optionVal: ProductOptionValue = {
        id: v.id,
        storeId: v.store_id,
        productId: v.product_id,
        optionId: v.option_id,
        value: v.value,
        displayTitle: v.display_title,
        isPublished: Boolean(v.is_published),
        position: Number(v.position),
        mediaIds: mList.map((x) => x.mediaId),
        media: mList.map((x) => x.media),
        createdAt: new Date(v.created_at),
        updatedAt: new Date(v.updated_at),
      };
      const list = valByOptId.get(v.option_id) || [];
      list.push(optionVal);
      valByOptId.set(v.option_id, list);
    }

    return res.rows.map((row) => mapOption(row, valByOptId.get(row.id)));
  }

  async setProductOptions(
    client: DatabaseClient,
    storeId: string,
    productId: string,
    options: Array<{
      name: string;
      position?: number;
      values: string[];
      isPublishable?: boolean;
      optionValues?: Array<{
        value: string;
        displayTitle?: string | null;
        isPublished?: boolean;
        position?: number;
        mediaIds?: string[];
      }>;
    }>,
  ): Promise<ProductOption[]> {
    const currentOptionsRes = await client.query<ProductOptionRow>(
      `SELECT id, product_id, store_id, name, position, values, is_publishable, created_at, updated_at
       FROM product_options
       WHERE store_id = $1 AND product_id = $2`,
      [storeId, productId],
    );
    const currentOptionsByName = new Map<string, ProductOptionRow>(
      currentOptionsRes.rows.map((r) => [r.name.trim().toLowerCase(), r]),
    );

    const handledOptionIds = new Set<string>();
    const insertedOrUpdated: ProductOption[] = [];

    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      if (!opt || !opt.name || !opt.name.trim()) continue;
      const optName = opt.name.trim();
      const pos = opt.position !== undefined ? opt.position : i;
      const cleanValues = Array.from(new Set((opt.values || []).map((v) => v.trim()).filter(Boolean)));
      const isPublishable = Boolean(opt.isPublishable);

      const existingOpt = currentOptionsByName.get(optName.toLowerCase());
      let optId: string;

      if (existingOpt) {
        optId = existingOpt.id;
        handledOptionIds.add(optId);
        await client.query(
          `UPDATE product_options
           SET position = $1, values = $2, is_publishable = $3, updated_at = NOW()
           WHERE id = $4 AND store_id = $5`,
          [pos, cleanValues, isPublishable, optId, storeId],
        );
      } else {
        optId = generateUuidV7();
        handledOptionIds.add(optId);
        await client.query(
          `INSERT INTO product_options (id, product_id, store_id, name, position, values, is_publishable, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
          [optId, productId, storeId, optName, pos, cleanValues, isPublishable],
        );
      }

      const currentValuesRes = await client.query<ProductOptionValueRow>(
        `SELECT id, product_id, store_id, option_id, value, display_title, is_published, position, created_at, updated_at
         FROM product_option_values
         WHERE option_id = $1 AND store_id = $2`,
        [optId, storeId],
      );
      const currentValByVal = new Map<string, ProductOptionValueRow>(
        currentValuesRes.rows.map((r) => [r.value.trim().toLowerCase(), r]),
      );

      const inputValuesByVal = new Map<string, {
        value: string;
        displayTitle?: string | null;
        isPublished?: boolean;
        position?: number;
        mediaIds?: string[];
      }>();
      if (opt.optionValues) {
        for (const ov of opt.optionValues) {
          if (ov && ov.value) {
            inputValuesByVal.set(ov.value.trim().toLowerCase(), ov);
          }
        }
      }

      const activeValIds = new Set<string>();
      const savedOptionValues: ProductOptionValue[] = [];

      for (let vIdx = 0; vIdx < cleanValues.length; vIdx++) {
        const val = cleanValues[vIdx]!;
        const inputVal = inputValuesByVal.get(val.toLowerCase());
        const existingVal = currentValByVal.get(val.toLowerCase());

        let valId: string;
        const displayTitle = inputVal?.displayTitle !== undefined
          ? (inputVal.displayTitle ? inputVal.displayTitle.trim() : null)
          : (existingVal ? existingVal.display_title : null);

        const isPublished = inputVal?.isPublished !== undefined
          ? Boolean(inputVal.isPublished)
          : (existingVal ? Boolean(existingVal.is_published) : true);

        const valPos = inputVal?.position !== undefined ? inputVal.position : vIdx;

        if (existingVal) {
          valId = existingVal.id;
          activeValIds.add(valId);
          await client.query(
            `UPDATE product_option_values
             SET display_title = $1, is_published = $2, position = $3, updated_at = NOW()
             WHERE id = $4 AND store_id = $5`,
            [displayTitle, isPublished, valPos, valId, storeId],
          );
        } else {
          valId = generateUuidV7();
          activeValIds.add(valId);
          await client.query(
            `INSERT INTO product_option_values (id, store_id, product_id, option_id, value, display_title, is_published, position, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
            [valId, storeId, productId, optId, val, displayTitle, isPublished, valPos],
          );
        }

        let assignedMediaIds: string[] = [];
        if (inputVal?.mediaIds !== undefined) {
          assignedMediaIds = inputVal.mediaIds.filter(Boolean);
          await client.query(
            `DELETE FROM product_option_value_media WHERE option_value_id = $1 AND store_id = $2`,
            [valId, storeId],
          );
          for (let mIdx = 0; mIdx < assignedMediaIds.length; mIdx++) {
            const mId = assignedMediaIds[mIdx]!;
            const povmId = generateUuidV7();
            await client.query(
              `INSERT INTO product_option_value_media (id, store_id, product_id, option_value_id, media_id, position, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, NOW())
               ON CONFLICT (option_value_id, media_id) DO UPDATE SET position = $6`,
              [povmId, storeId, productId, valId, mId, mIdx],
            );
          }
        } else {
          const currentMedia = await client.query<{ media_id: string }>(
            `SELECT media_id FROM product_option_value_media WHERE option_value_id = $1 ORDER BY position ASC`,
            [valId],
          );
          assignedMediaIds = currentMedia.rows.map((r) => r.media_id);
        }

        savedOptionValues.push({
          id: valId,
          storeId,
          productId,
          optionId: optId,
          value: val,
          displayTitle,
          isPublished,
          position: valPos,
          mediaIds: assignedMediaIds,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      for (const oldVal of currentValuesRes.rows) {
        if (!activeValIds.has(oldVal.id)) {
          await client.query(`DELETE FROM product_option_values WHERE id = $1 AND store_id = $2`, [oldVal.id, storeId]);
        }
      }

      insertedOrUpdated.push({
        id: optId,
        storeId,
        productId,
        name: optName,
        position: pos,
        values: cleanValues,
        isPublishable,
        optionValues: savedOptionValues,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    for (const oldOpt of currentOptionsRes.rows) {
      if (!handledOptionIds.has(oldOpt.id)) {
        await client.query(`DELETE FROM product_options WHERE id = $1 AND store_id = $2`, [oldOpt.id, storeId]);
      }
    }

    return insertedOrUpdated;
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
