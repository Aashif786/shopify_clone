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

// ---------------------------------------------------------------------------
// Phase 2: listing context, option groups, availability, submission
// ---------------------------------------------------------------------------

export type InventoryAwareVariant = SelectableVariant & {
  inventory?: VariantInventoryLike & { effectiveMaxQuantity?: number };
};

/**
 * What a published listing actually represents. Option-level listings carry the publishable
 * option group + value; legacy standalone variants carry the (complete) variant itself.
 * The representative variant of an option-level listing is deliberately NOT part of it.
 */
export type ListingContext =
  | { optionName: string; optionValue: string }
  | { variantId: string };

export function getListingContext(
  product: Pick<
    ProductSummaryDTO,
    "listingOptionName" | "listingOptionValue" | "variantId" | "isStandaloneVariant"
  >,
): ListingContext | null {
  if (product.listingOptionName && product.listingOptionValue) {
    return { optionName: product.listingOptionName, optionValue: product.listingOptionValue };
  }
  if (product.isStandaloneVariant && product.variantId) return { variantId: product.variantId };
  return null;
}

/** Full selection of every option group from one exact variant (explicit variant identity). */
export function selectionFromVariant(
  options: ProductOptionDTO[],
  variant: ProductVariantDTO,
): OptionSelection {
  const selection: OptionSelection = {};
  for (const opt of options) {
    const value = getVariantOptionValue(variant, opt, options);
    if (value) selection[opt.name] = value;
  }
  return selection;
}

/** Preselection from a published listing; anything the listing does not define stays empty. */
export function buildListingSelection<V extends SelectableVariant>(
  options: ProductOptionDTO[],
  variants: V[],
  context: ListingContext | null | undefined,
): OptionSelection {
  if (!context) return {};
  if ("optionName" in context) {
    const opt = options.find((o) => norm(o.name) === norm(context.optionName));
    const value = opt?.values.find((v) => norm(v) === norm(context.optionValue));
    return opt && value ? { [opt.name]: value } : {};
  }
  const variant = variants.find((v) => v.id === context.variantId);
  return variant ? buildInitialSelection(options, variant) : {};
}

/** Preselection from option[Name]=Value or name=value query params, validated against the product. */
export function parseSelectionFromSearchParams(
  params: URLSearchParams,
  options: ProductOptionDTO[],
): OptionSelection {
  const selection: OptionSelection = {};
  for (const opt of options) {
    const raw =
      params.get(`option[${opt.name}]`) ??
      params.get(`option[${opt.name.toLowerCase()}]`) ??
      params.get(opt.name) ??
      params.get(opt.name.toLowerCase());
    const value = raw ? opt.values.find((v) => norm(v) === norm(raw)) : undefined;
    if (value) selection[opt.name] = value;
  }
  return selection;
}

/**
 * Product-page URL for a card. Option-level listings pass their real selection
 * (option[Color]=Red); legacy standalone variants pass their exact variant id.
 * The representative variant of an option-level listing is never sent as identity.
 */
export function buildProductHref(
  storeSlug: string,
  product: Pick<
    ProductSummaryDTO,
    "slug" | "listingOptionName" | "listingOptionValue" | "variantId" | "isStandaloneVariant"
  >,
): string {
  const base = `/stores/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(product.slug)}`;
  const ctx = getListingContext(product);
  if (!ctx) return base;
  const params = new URLSearchParams();
  if ("optionName" in ctx) params.set(`option[${ctx.optionName}]`, ctx.optionValue);
  else params.set("variant", ctx.variantId);
  return `${base}?${params.toString()}`;
}

/** Authoritative option groups, or groups derived from the variants' option1..3 when none exist. */
export function getProductOptionGroups(
  options: ProductOptionDTO[] | undefined,
  variants: SelectableVariant[],
  productId = "",
): ProductOptionDTO[] {
  if (options && options.length > 0) return options;
  const groups: ProductOptionDTO[] = [];
  const cols = ["option1", "option2", "option3"] as const;
  cols.forEach((col, i) => {
    const values = Array.from(
      new Set(variants.map((v) => v[col]).filter((x): x is string => Boolean(x))),
    );
    if (values.length > 0) {
      groups.push({
        id: `opt-${i + 1}`,
        productId,
        name: `Option ${i + 1}`,
        position: i,
        values,
        isPublishable: false,
        optionValues: [],
      });
    }
  });
  return groups;
}

export type OptionValueState = "available" | "out_of_stock" | "nonexistent";

/**
 * State of one option value given the OTHER groups' current choices. "nonexistent" only when no
 * active variant has that combination; "out_of_stock" only when known inventory says every
 * candidate is out. Never speculates when inventory is unknown.
 */
export function getOptionValueState<V extends SelectableVariant>(
  variants: V[],
  options: ProductOptionDTO[],
  selection: OptionSelection,
  optionName: string,
  value: string,
): OptionValueState {
  const target = options.find((o) => norm(o.name) === norm(optionName));
  if (!target) return "nonexistent";
  const candidates = getPurchasableVariants(variants).filter((variant) =>
    options.every((opt) => {
      const actual = norm(getVariantOptionValue(variant, opt, options));
      if (opt === target) return actual === norm(value);
      const chosen = selectionValue(selection, opt);
      return chosen === "" || actual === norm(chosen);
    }),
  );
  if (candidates.length === 0) return "nonexistent";
  const allOut = candidates.every((c) => c.inventory !== undefined && isVariantOutOfStock(c));
  return allOut ? "out_of_stock" : "available";
}

/** Human-readable reason a selection cannot be added; null when it can. */
export function describeResolution(resolution: VariantResolution): string | null {
  switch (resolution.status) {
    case "resolved":
      return null;
    case "incomplete":
      return `Select ${resolution.missingOptions.join(", ")}`;
    case "not_found":
      return "This combination is not available.";
    case "ambiguous":
      return "This combination could not be matched to a single product. Please contact the store.";
    case "unavailable":
      return "This option is out of stock.";
  }
}

export type SubmitSelectionResult<V extends SelectableVariant = SelectableVariant> =
  | { status: "added"; variant: V }
  | { status: "rejected"; resolution: Exclude<VariantResolution<V>, { status: "resolved" }>; message: string }
  | { status: "busy" }
  | { status: "failed"; message: string };

/**
 * Validate the COMPLETE selection, resolve the exact variant, then submit it once.
 * Incomplete / nonexistent / ambiguous / unavailable selections never reach addItem,
 * and a second call while one is pending is ignored.
 */
export async function submitSelectedVariant<V extends InventoryAwareVariant>(args: {
  variants: V[];
  options: ProductOptionDTO[];
  selection: OptionSelection;
  quantity: number;
  addItem: (variantId: string, quantity: number) => Promise<unknown>;
  flight: ReturnType<typeof createSingleFlight>;
}): Promise<SubmitSelectionResult<V>> {
  const resolution = resolveExactVariant(args.variants, args.options, args.selection);
  if (resolution.status !== "resolved") {
    return { status: "rejected", resolution, message: describeResolution(resolution) ?? "" };
  }
  const { variant } = resolution;
  const cap = variant.inventory?.effectiveMaxQuantity;
  if (cap !== undefined && cap <= 0) {
    const unavailable = { status: "unavailable", variant } as const;
    return { status: "rejected", resolution: unavailable, message: describeResolution(unavailable) ?? "" };
  }
  const quantity = Math.max(1, cap !== undefined ? Math.min(cap, args.quantity) : args.quantity);
  const outcome = await args.flight(async () => {
    try {
      await args.addItem(variant.id, quantity);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Failed to add item to cart";
    }
  });
  if (!outcome.ran) return { status: "busy" };
  return outcome.value ? { status: "failed", message: outcome.value } : { status: "added", variant };
}
