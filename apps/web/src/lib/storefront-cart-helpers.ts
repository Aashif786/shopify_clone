import type { Database } from "@calcart/db";
import type { CartDTO, CartItemDTO } from "@calcart/carts";

export interface StorefrontCartItemDTO extends CartItemDTO {
  productTitle: string;
  productSlug: string;
  variantTitle: string;
  sku: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
}

export interface StorefrontCartDTO extends Omit<CartDTO, "items"> {
  items: StorefrontCartItemDTO[];
}

interface VariantMetaRow {
  variant_id: string;
  variant_title: string;
  sku: string | null;
  product_id: string;
  product_title: string;
  product_slug: string;
  image_url: string | null;
  image_alt: string | null;
}

/**
 * Enriches cart items with authoritative product and variant metadata
 * (title, slug, variant title, SKU, primary image) for presentation in storefront.
 */
export async function enrichCart(
  db: Database,
  storeId: string,
  cart: CartDTO,
): Promise<StorefrontCartDTO> {
  if (!cart.items || cart.items.length === 0) {
    return {
      ...cart,
      items: [],
    };
  }

  const variantIds = cart.items.map((i) => i.variantId);
  const res = await db.query<VariantMetaRow>(
    `SELECT 
       pv.id AS variant_id,
       pv.title AS variant_title,
       pv.sku,
       p.id AS product_id,
       p.title AS product_title,
       p.slug AS product_slug,
       COALESCE(vpm.url, pm.url) AS image_url,
       COALESCE(vpm.alt_text, pm.alt_text) AS image_alt
     FROM product_variants pv
     JOIN products p ON p.id = pv.product_id AND p.store_id = pv.store_id
     LEFT JOIN product_media vpm ON vpm.id = pv.image_id
     LEFT JOIN LATERAL (
       SELECT url, alt_text
       FROM product_media
       WHERE product_id = p.id
       ORDER BY position ASC, created_at ASC
       LIMIT 1
     ) pm ON true
     WHERE pv.id = ANY($1::uuid[]) AND pv.store_id = $2`,
    [variantIds, storeId],
  );

  const lookup = new Map<string, VariantMetaRow>(
    res.rows.map((row) => [row.variant_id, row]),
  );

  const items: StorefrontCartItemDTO[] = cart.items.map((item) => {
    const meta = lookup.get(item.variantId);
    return {
      ...item,
      productTitle: meta?.product_title || "Unknown Product",
      productSlug: meta?.product_slug || "",
      variantTitle: meta?.variant_title || "Default",
      sku: meta?.sku ?? null,
      imageUrl: meta?.image_url ?? null,
      imageAlt: meta?.image_alt ?? null,
    };
  });

  return {
    ...cart,
    items,
  };
}
