import type { Database } from "@shopify-clone/db";
import type {
  CheckoutDTO,
  CheckoutItemDTO,
  CheckoutAddressDTO,
} from "@shopify-clone/checkout";

export type { CheckoutAddressDTO };

export interface StorefrontCheckoutItemDTO extends CheckoutItemDTO {
  productSlug: string;
  imageUrl: string | null;
  imageAlt: string | null;
}

export interface StorefrontCheckoutDTO extends Omit<CheckoutDTO, "items"> {
  items: StorefrontCheckoutItemDTO[];
}

interface VariantMetaRow {
  variant_id: string;
  product_id: string;
  product_slug: string;
  image_url: string | null;
  image_alt: string | null;
}

/**
 * Enriches checkout line items with authoritative product slug and primary image media
 * for presentation in the customer storefront checkout review and order confirmation.
 */
export async function enrichCheckout(
  db: Database,
  storeId: string,
  checkout: CheckoutDTO,
): Promise<StorefrontCheckoutDTO> {
  if (!checkout.items || checkout.items.length === 0) {
    return {
      ...checkout,
      items: [],
    };
  }

  const variantIds = checkout.items.map((i) => i.variantId);
  const res = await db.query<VariantMetaRow>(
    `SELECT 
       pv.id AS variant_id,
       p.id AS product_id,
       p.slug AS product_slug,
       pm.url AS image_url,
       pm.alt_text AS image_alt
     FROM product_variants pv
     JOIN products p ON p.id = pv.product_id AND p.store_id = pv.store_id
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

  const items: StorefrontCheckoutItemDTO[] = checkout.items.map((item) => {
    const meta = lookup.get(item.variantId);
    return {
      ...item,
      productSlug: meta?.product_slug || "",
      imageUrl: meta?.image_url ?? null,
      imageAlt: meta?.image_alt ?? null,
    };
  });

  return {
    ...checkout,
    items,
  };
}

/**
 * Email validation according to RFC standards.
 */
export function isValidEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim();
  if (trimmed.includes("..")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

/**
 * Validates shipping or billing address according to domain requirements.
 */
export function validateShippingAddress(address: Partial<CheckoutAddressDTO> | null | undefined): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!address) {
    return { isValid: false, errors: { form: "Address is required" } };
  }

  if (!address.firstName || !address.firstName.trim()) {
    errors.firstName = "First name is required";
  }

  if (!address.lastName || !address.lastName.trim()) {
    errors.lastName = "Last name is required";
  }

  if (!address.addressLine1 || !address.addressLine1.trim()) {
    errors.addressLine1 = "Street address is required";
  }

  if (!address.city || !address.city.trim()) {
    errors.city = "City is required";
  }

  if (!address.postalCode || !address.postalCode.trim()) {
    errors.postalCode = "Postal / ZIP code is required";
  }

  if (!address.country || !address.country.trim()) {
    errors.country = "Country is required";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
