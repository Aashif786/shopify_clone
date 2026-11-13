import type {
  ProductOptionDTO,
  ProductSummaryDTO,
  ProductVariantDTO,
} from "@calcart/products";

/**
 * Shared, pure storefront variant-selection logic (product cards now, Quick View later).
 *
 * Source of truth: a product's option groups (`ProductOptionDTO`) and its real variants
 * (`option1..3`). `variantsCount`, published-listing IDs and "first matching variant" are
 * NOT purchasable identity. A variant is only resolved when every option group has a
 * value and exactly one ACTIVE variant matches that complete selection.
 */

export interface VariantInventoryLike {
  availableQuantity: number;
  isOutOfStock?: boolean;
}

export type SelectableVariant = ProductVariantDTO & { inventory?: VariantInventoryLike };

/** option name -> chosen value */
export type OptionSelection = Record<string, string>;

export type VariantResolution<V extends SelectableVariant = SelectableVariant> =
  | { status: "resolved"; variant: V }
  | { status: "incomplete"; missingOptions: string[] }
  | { status: "not_found" }
  | { status: "ambiguous"; candidates: V[] }
  | { status: "unavailable"; variant: V };

const norm = (value: string | null | undefined): string => (value ?? "").trim().toLowerCase();

/** Value a variant holds for an option group (by option position), or null. */
export function getVariantOptionValue(
  variant: ProductVariantDTO,
  option: ProductOptionDTO,
  allOptions: ProductOptionDTO[] = [],
): string | null {
  let pos = typeof option.position === "number" ? option.position : -1;
  if (pos < 0 || pos > 2) {
    const idx = allOptions.findIndex(
      (o) => o.id === option.id || norm(o.name) === norm(option.name),
    );
    pos = idx >= 0 ? idx : 0;
  }
  const val =
    pos === 0 ? variant.option1 : pos === 1 ? variant.option2 : pos === 2 ? variant.option3 : null;
  if (val && val.trim().length > 0) return val.trim();
  if (variant.title && variant.title !== "Default Title" && variant.title !== "Default") {
    const part = variant.title.split("/").map((p) => p.trim())[pos];
    if (part) return part;
  }
  return null;
}

export function getPurchasableVariants<V extends SelectableVariant>(variants: V[]): V[] {
  return variants.filter((v) => v.status === "ACTIVE");
}

export function isVariantOutOfStock(variant: SelectableVariant): boolean {
  const inv = variant.inventory;
  if (!inv) return false; // unknown here; the cart backend remains the authority
  return inv.isOutOfStock ?? inv.availableQuantity <= 0;
}

function selectionValue(selection: OptionSelection, option: ProductOptionDTO): string {
  for (const [key, value] of Object.entries(selection)) {
    if (norm(key) === norm(option.name) || key === option.id) return value?.trim() ?? "";
  }
  return "";
}

/**
 * Whether the customer must make a choice before anything can be added:
 * more than one ACTIVE purchasable variant exists.
 */
export function requiresOptionSelection(variants: SelectableVariant[]): boolean {
  return getPurchasableVariants(variants).length !== 1;
}

/**
 * Initial selection from a published listing's context. Only PUBLISHABLE option groups are
 * preselected from the listing variant (that is what the listing represents); other groups
 * stay empty so the customer must choose. When the product has no publishable option the
 * listing variant is itself the complete identity (legacy standalone variant).
 */
export function buildInitialSelection(
  options: ProductOptionDTO[],
  listingVariant?: ProductVariantDTO | null,
): OptionSelection {
  const selection: OptionSelection = {};
  if (!listingVariant) return selection;
  const anyPublishable = options.some((o) => o.isPublishable);
  for (const opt of options) {
    if (anyPublishable && !opt.isPublishable) continue;
    const value = getVariantOptionValue(listingVariant, opt, options);
    if (value) selection[opt.name] = value;
  }
  return selection;
}

/** Option group names that still have no value. */
export function getMissingOptions(
  options: ProductOptionDTO[],
  selection: OptionSelection,
): string[] {
  return options.filter((opt) => selectionValue(selection, opt) === "").map((o) => o.name);
}

export function isSelectionComplete(
  options: ProductOptionDTO[],
  selection: OptionSelection,
): boolean {
  return getMissingOptions(options, selection).length === 0;
}

/**
 * Resolve the exact purchasable variant for a COMPLETE selection.
 * Never falls back to the first variant, never matches partially, never relies on order.
 */
export function resolveExactVariant<V extends SelectableVariant>(
  variants: V[],
  options: ProductOptionDTO[],
  selection: OptionSelection,
): VariantResolution<V> {
  const active = getPurchasableVariants(variants);

  // A product with no option groups is only addressable when it has a single variant.
  if (options.length === 0) {
    if (active.length === 1) return finalize(active[0]!);
    return active.length === 0
      ? { status: "not_found" }
      : { status: "ambiguous", candidates: active };
  }

  const missing = getMissingOptions(options, selection);
  if (missing.length > 0) return { status: "incomplete", missingOptions: missing };

  const matches = active.filter((variant) =>
    options.every(
      (opt) => norm(getVariantOptionValue(variant, opt, options)) === norm(selectionValue(selection, opt)),
    ),
  );

  if (matches.length === 0) return { status: "not_found" };
  if (matches.length > 1) return { status: "ambiguous", candidates: matches };
  return finalize(matches[0]!);
}

function finalize<V extends SelectableVariant>(variant: V): VariantResolution<V> {
  return isVariantOutOfStock(variant)
    ? { status: "unavailable", variant }
    : { status: "resolved", variant };
}

// ---------------------------------------------------------------------------
// Product-card action
// ---------------------------------------------------------------------------

export type ProductCardAction =
  | { kind: "add"; variantId: string }
  | { kind: "choose" }
  | { kind: "sold_out" };

/**
 * Decide the card's primary action from server-provided purchasable data.
 * Direct add only when exactly one ACTIVE purchasable variant is identified and in stock.
 * Anything else (several variants, an unresolved published listing, missing data) means the
 * customer must choose options.
 */
export function getProductCardAction(
  product: Pick<
    ProductSummaryDTO,
    "purchasableVariantCount" | "purchasableVariantId" | "isOutOfStock" | "variantsCount"
  >,
): ProductCardAction {
  const count = product.purchasableVariantCount;
  const hasNoVariants = count === 0 || (count === undefined && product.variantsCount === 0);
  if (product.isOutOfStock || hasNoVariants) return { kind: "sold_out" };
  if (count === 1 && product.purchasableVariantId) {
    return { kind: "add", variantId: product.purchasableVariantId };
  }
  return { kind: "choose" };
}

// ---------------------------------------------------------------------------
// Duplicate-submission guard
// ---------------------------------------------------------------------------

/**
 * Single-flight guard: while one task is pending, further calls are ignored (not queued),
 * so a double click can never submit the same cart mutation twice.
 */
export function createSingleFlight() {
  let busy = false;
  return async function run<T>(task: () => Promise<T>): Promise<{ ran: boolean; value?: T }> {
    if (busy) return { ran: false };
    busy = true;
    try {
      return { ran: true, value: await task() };
    } finally {
      busy = false;
    }
  };
}
