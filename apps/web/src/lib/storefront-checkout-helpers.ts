import type { Database } from "@calcart/db";
import { TaxService } from "@calcart/tax";
import type {
  CheckoutDTO,
  CheckoutItemDTO,
  CheckoutAddressDTO,
} from "@calcart/checkout";

export type { CheckoutAddressDTO };

export interface StorefrontCheckoutItemDTO extends CheckoutItemDTO {
  productSlug: string;
  imageUrl: string | null;
  imageAlt: string | null;
}

export interface StorefrontTaxLineDTO {
  /** The checkout line's variant id. */
  lineId: string;
  description: string;
  hsnCode: string | null;
  rateBps: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxAmount: number;
}

export interface StorefrontTaxBreakdownDTO {
  supplyType: "INTRA_STATE" | "INTER_STATE" | "EXPORT";
  placeOfSupplyName: string | null;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  taxTotal: number;
  lines: StorefrontTaxLineDTO[];
}

export interface StorefrontCheckoutDTO extends Omit<CheckoutDTO, "items" | "guestTokenHash"> {
  items: StorefrontCheckoutItemDTO[];
}

export interface StorefrontCheckoutWithTaxDTO extends StorefrontCheckoutDTO {
  /** True when the store charges GST, even before a breakdown is available. */
  taxEnabled: boolean;
  /** Per-line GST split, or null until tax can be calculated (no address yet). */
  tax: StorefrontTaxBreakdownDTO | null;
}

const taxService = new TaxService();

/**
 * Reads the frozen GST calculation the checkout total was built from. Never
 * recalculates: what the customer sees is exactly what they will be charged.
 */
async function loadTaxBreakdown(
  db: Database,
  storeId: string,
  checkoutId: string,
): Promise<{ taxEnabled: boolean; tax: StorefrontTaxBreakdownDTO | null }> {
  const settings = await taxService.getSettings(db, storeId);
  if (!settings.isEnabled) {
    return { taxEnabled: false, tax: null };
  }

  const snapshot = await taxService.getCheckoutTaxSnapshot(db, storeId, checkoutId);
  if (!snapshot) {
    return { taxEnabled: true, tax: null };
  }

  return {
    taxEnabled: true,
    tax: {
      supplyType: snapshot.supplyType,
      placeOfSupplyName: snapshot.placeOfSupplyName,
      taxableTotal: snapshot.taxableTotal,
      cgstTotal: snapshot.cgstTotal,
      sgstTotal: snapshot.sgstTotal,
      igstTotal: snapshot.igstTotal,
      taxTotal: snapshot.taxTotal,
      lines: snapshot.lines.map((line) => ({
        lineId: line.lineId,
        description: line.description,
        hsnCode: line.hsnCode,
        rateBps: line.rateBps,
        taxableValue: line.taxableValue,
        cgst: line.cgst,
        sgst: line.sgst,
        igst: line.igst,
        taxAmount: line.taxAmount,
      })),
    },
  };
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
 * Strips internal guestTokenHash from client-facing checkout data.
 */
export async function enrichCheckout(
  db: Database,
  storeId: string,
  checkout: CheckoutDTO,
): Promise<StorefrontCheckoutDTO> {
  const sanitizedCheckout = { ...checkout };
  delete (sanitizedCheckout as { guestTokenHash?: string | null }).guestTokenHash;
  if (!sanitizedCheckout.items || sanitizedCheckout.items.length === 0) {
    return {
      ...sanitizedCheckout,
      items: [],
    };
  }

  const variantIds = sanitizedCheckout.items.map((i) => i.variantId);
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

  const items: StorefrontCheckoutItemDTO[] = sanitizedCheckout.items.map((item) => {
    const meta = lookup.get(item.variantId);
    return {
      ...item,
      productSlug: meta?.product_slug || "",
      imageUrl: meta?.image_url ?? null,
      imageAlt: meta?.image_alt ?? null,
    };
  });

  return {
    ...sanitizedCheckout,
    items,
  };
}

/**
 * `enrichCheckout` plus the GST breakdown the total was built from.
 *
 * Kept separate on purpose: `enrichCheckout` has a pinned contract (it makes no
 * database call for an empty basket and strips internal fields) that other
 * callers and tests rely on, so tax is layered on top rather than folded in.
 * Every storefront checkout response uses this one, so a customer always sees
 * the same per-line split that the payment will charge.
 */
export async function enrichCheckoutWithTax(
  db: Database,
  storeId: string,
  checkout: CheckoutDTO,
): Promise<StorefrontCheckoutWithTaxDTO> {
  const enriched = await enrichCheckout(db, storeId, checkout);
  const { taxEnabled, tax } = await loadTaxBreakdown(db, storeId, checkout.id);
  return { ...enriched, taxEnabled, tax };
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
