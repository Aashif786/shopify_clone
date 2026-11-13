import Link from "next/link";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ProductDetailDTO, ProductVariantDTO, ProductOptionDTO, ProductMediaDTO } from "@calcart/products";
import { Spinner } from "@calcart/ui";
import { formatStorePrice } from "./product-card";
import { useOptionalCart } from "../../../context/cart-context";
import { useOptionalWishlist } from "../../../context/wishlist-context";
import { useCurrency } from "../../../context/currency-context";
import {
  ShieldCheck,
  Truck,
  Check,
  ArrowLeft,
  Star,
  Heart,
} from "lucide-react";
import { ProductReviewsSection } from "../reviews/product-reviews-section";
import {
  createSingleFlight,
  describeResolution,
  getMissingOptions,
  getProductOptionGroups,
  getVariantOptionValue,
  parseSelectionFromSearchParams,
  resolveExactVariant,
  selectionFromVariant,
  submitSelectedVariant,
} from "../../../lib/storefront-variant-selection";

export interface VariantInventoryDTO {
  availableQuantity: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
  lowStockThreshold: number;
  maxOrderQuantity: number | null;
  effectiveMaxQuantity: number;
}

export type StorefrontVariantDTO = ProductVariantDTO & {
  inventory?: VariantInventoryDTO;
};

export type StorefrontProductDetailDTO = Omit<ProductDetailDTO, "variants"> & {
  variants: StorefrontVariantDTO[];
  inventory?: {
    isOutOfStock: boolean;
    isLowStock: boolean;
    totalAvailableQuantity: number;
  };
};

export const COLOR_MAP: Record<string, string> = {
  black: "#09090b",
  white: "#ffffff",
  red: "#ef4444",
  blue: "#3b82f6",
  navy: "#1e3a8a",
  green: "#22c55e",
  yellow: "#eab308",
  purple: "#a855f7",
  pink: "#ec4899",
  orange: "#f97316",
  grey: "#6b7280",
  gray: "#6b7280",
  charcoal: "#374151",
  brown: "#78350f",
  beige: "#f5f5dc",
  cream: "#fffdd0",
  olive: "#84cc16",
  maroon: "#881337",
  teal: "#14b8a6",
  gold: "#d97706",
  silver: "#94a3b8",
};

export function getColorHex(colorName: string): string | null {
  const normalized = colorName.toLowerCase().trim();
  if (COLOR_MAP[normalized]) return COLOR_MAP[normalized];
  if (
    normalized.startsWith("#") &&
    (normalized.length === 4 || normalized.length === 7)
  ) {
    return normalized;
  }
  return null;
}

// Shared implementation (Phase 1); re-exported for existing consumers.
export { getVariantOptionValue };

/**
 * Returns the variant for a COMPLETE, exact selection (case-insensitive), else undefined.
 * Partial selections never match: a missing option group yields undefined, not the first hit.
 */
export function findMatchingVariant(
  variants: StorefrontVariantDTO[],
  options: ProductOptionDTO[],
  selections: Record<string, string>
): StorefrontVariantDTO | undefined {
  const result = resolveExactVariant(variants, options, selections);
  return result.status === "resolved" || result.status === "unavailable" ? result.variant : undefined;
}

export interface VariantSelectionResult {
  nextOptions: Record<string, string>;
  matchedVariant: StorefrontVariantDTO | undefined;
  isPublishableSwitch: boolean;
}

/**
 * Pure helper: applies ONE option change to the current selection and reports the exact variant
 * only when the resulting selection is complete and matches a single variant. Other groups are
 * kept as the customer chose them; nothing is adapted, defaulted or first-matched.
 */
export function resolveVariantSelection(
  activeVariants: StorefrontVariantDTO[],
  productOptions: ProductOptionDTO[],
  currentSelections: Record<string, string>,
  changedOptName: string,
  changedValue: string
): VariantSelectionResult {
  const targetOpt = productOptions.find(
    (o) => o.name.toLowerCase() === changedOptName.toLowerCase() || o.id === changedOptName
  );
  const canonicalName = targetOpt ? targetOpt.name : changedOptName;

  const nextOptions: Record<string, string> = {};
  for (const [k, v] of Object.entries(currentSelections)) {
    if (k.toLowerCase() !== canonicalName.toLowerCase()) {
      nextOptions[k] = v;
    }
  }
  nextOptions[canonicalName] = changedValue;

  return {
    nextOptions,
    matchedVariant: findMatchingVariant(activeVariants, productOptions, nextOptions),
    isPublishableSwitch: Boolean(targetOpt?.isPublishable),
  };
}

export interface ProductDetailViewProps {
  product: StorefrontProductDetailDTO;
  storeSlug: string;
  storeName: string;
  storeCurrency?: string;
  initialVariantId?: string | null;
  onAddToCart?: (variantId: string, quantity: number) => Promise<unknown>;
}

export function ProductDetailView({
  product,
  storeSlug,
  storeName,
  storeCurrency,
  initialVariantId,
  onAddToCart,
}: ProductDetailViewProps) {
  const cartContext = useOptionalCart();
  const wishlistContext = useOptionalWishlist();
  const [isWishlisting, setIsWishlisting] = useState(false);
  const { convertPrice } = useCurrency();

  // Active variants only
  const activeVariants = product.variants.filter((v) => v.status === "ACTIVE");

  // An explicit exact variant (?variant= written by this page, or the initialVariantId prop).
  // Published-listing context arrives as option[Name]=Value params and is NOT a variant identity.
  const explicitVariant = React.useMemo(() => {
    if (typeof window !== "undefined") {
      const urlVar = new URLSearchParams(window.location.search).get("variant");
      if (urlVar) {
        const found = activeVariants.find((v) => v.id === urlVar);
        if (found) return found;
      }
    }
    if (initialVariantId) {
      return activeVariants.find((v) => v.id === initialVariantId);
    }
    return undefined;
  }, [activeVariants, initialVariantId]);

  // Authoritative option groups (or groups derived from the variants' option1..3)
  const productOptions = React.useMemo(
    () => getProductOptionGroups(product.options, activeVariants, product.id),
    [product.options, activeVariants, product.id],
  );

  // Selections start from an explicit variant or the published listing's option params only;
  // every remaining option is left for the customer to choose.
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
    if (explicitVariant) return selectionFromVariant(productOptions, explicitVariant);
    if (typeof window !== "undefined") {
      return parseSelectionFromSearchParams(new URLSearchParams(window.location.search), productOptions);
    }
    return {};
  });

  // Only used for products with several variants but no option groups (plain variant buttons).
  const [selectedVariantId, setSelectedVariantId] = useState<string>(() => explicitVariant?.id ?? "");
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number>(0);
  const [brokenMediaUrls, setBrokenMediaUrls] = useState<Set<string>>(() => new Set());
  const [quantity, setQuantity] = useState<number>(1);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [addSuccess, setAddSuccess] = useState<boolean>(false);
  const [addError, setAddError] = useState<string | null>(null);

  // A product with a single purchasable variant has nothing to choose.
  const resolutionOptions = React.useMemo(
    () => (activeVariants.length > 1 ? productOptions : []),
    [activeVariants.length, productOptions],
  );
  const resolution = React.useMemo(
    () => resolveExactVariant<StorefrontVariantDTO>(activeVariants, resolutionOptions, selectedOptions),
    [activeVariants, resolutionOptions, selectedOptions],
  );
  const usesPlainVariantButtons = resolutionOptions.length === 0 && activeVariants.length > 1;

  // Exact, complete selection only: no first-variant default and no partial-match fallback.
  const selectedVariant: StorefrontVariantDTO | undefined = React.useMemo(() => {
    if (usesPlainVariantButtons) return activeVariants.find((v) => v.id === selectedVariantId);
    return resolution.status === "resolved" || resolution.status === "unavailable"
      ? resolution.variant
      : undefined;
  }, [usesPlainVariantButtons, activeVariants, selectedVariantId, resolution]);
  const missingOptions = getMissingOptions(resolutionOptions, selectedOptions);
  const selectionMessage =
    usesPlainVariantButtons || resolution.status === "resolved" || resolution.status === "unavailable"
      ? null
      : resolution.status === "incomplete"
        ? `Select ${missingOptions.join(", ")}`
        : describeResolution(resolution);
  const addFlight = React.useRef(createSingleFlight());

  const inWishlist = wishlistContext
    ? wishlistContext.isInWishlist(product.id, selectedVariant?.id || null)
    : false;

  // Track previous initialVariantId prop to prevent user clicks from being reset
  const prevInitialVariantIdRef = React.useRef(initialVariantId);

  React.useEffect(() => {
    setSelectedMediaIndex(0);
  }, [selectedVariant?.id]);

  // Keep ?variant= in sync with the EXACT resolved variant; remove it while the selection is incomplete
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const current = url.searchParams.get("variant");
    if (selectedVariant?.id) {
      if (current !== selectedVariant.id) {
        url.searchParams.set("variant", selectedVariant.id);
        window.history.replaceState(null, "", url.toString());
      }
    } else if (current) {
      url.searchParams.delete("variant");
      window.history.replaceState(null, "", url.toString());
    }
  }, [selectedVariant?.id]);

  const applyExactVariant = React.useCallback(
    (target: StorefrontVariantDTO) => {
      setSelectedVariantId(target.id);
      setSelectedMediaIndex(0);
      if (productOptions.length > 0) {
        setSelectedOptions(selectionFromVariant(productOptions, target));
      }
    },
    [productOptions],
  );

  // Handle external or prop changes to initialVariantId ONLY when the prop actually changes
  React.useEffect(() => {
    if (initialVariantId && initialVariantId !== prevInitialVariantIdRef.current) {
      prevInitialVariantIdRef.current = initialVariantId;
      const target = activeVariants.find((v) => v.id === initialVariantId);
      if (target) applyExactVariant(target);
    }
  }, [initialVariantId, activeVariants, applyExactVariant]);

  // Listen to browser forward/back button navigation
  React.useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const urlVar = params.get("variant");
      const target = urlVar ? activeVariants.find((v) => v.id === urlVar) : undefined;
      if (target) {
        prevInitialVariantIdRef.current = target.id;
        applyExactVariant(target);
      } else {
        setSelectedOptions(parseSelectionFromSearchParams(params, productOptions));
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeVariants, productOptions, applyExactVariant]);

  // Compute variant-specific display title (with fallback)
  const displayProductTitle = React.useMemo(() => {
    // 1. Look for selected publishable option value first
    if (productOptions && productOptions.length > 0) {
      for (const opt of productOptions) {
        if (opt.isPublishable && opt.optionValues && opt.optionValues.length > 0) {
          const selectedVal = selectedOptions[opt.name];
          if (selectedVal) {
            const matchedVal = opt.optionValues.find(
              (ov) => ov.value.trim().toLowerCase() === selectedVal.trim().toLowerCase()
            );
            if (matchedVal?.displayTitle && matchedVal.displayTitle.trim().length > 0) {
              return matchedVal.displayTitle.trim();
            }
            if (matchedVal) {
              return `${product.title} - ${matchedVal.value}`;
            }
          }
        }
      }
    }

    // 2. Fallback to variant's displayTitle or title if available
    if (selectedVariant?.displayTitle && selectedVariant.displayTitle.trim().length > 0) {
      return selectedVariant.displayTitle.trim();
    }
    if (
      selectedVariant &&
      selectedVariant.title &&
      selectedVariant.title !== "Default Title" &&
      selectedVariant.title !== "Default"
    ) {
      return `${product.title} - ${selectedVariant.title}`;
    }
    return product.title;
  }, [product.title, productOptions, selectedOptions, selectedVariant]);

  // Synchronize document/tab title with the active listing/variant title
  React.useEffect(() => {
    if (typeof document !== "undefined" && displayProductTitle) {
      document.title = `${displayProductTitle} | ${storeName}`;
    }
  }, [displayProductTitle, storeName]);

  // Compute gallery media filtered strictly to the selected option value / variant
  const variantGalleryMedia = React.useMemo(() => {
    if (!product.media || product.media.length === 0) {
      return [];
    }

    // 1. Check if any publishable option has assigned media for the selected value
    if (productOptions && productOptions.length > 0) {
      for (const opt of productOptions) {
        if (opt.isPublishable && opt.optionValues && opt.optionValues.length > 0) {
          const selectedVal = selectedOptions[opt.name];
          if (selectedVal) {
            const matchedVal = opt.optionValues.find(
              (ov) => ov.value.trim().toLowerCase() === selectedVal.trim().toLowerCase()
            );
            if (matchedVal) {
              if (matchedVal.media && matchedVal.media.length > 0) {
                return matchedVal.media;
              }
              if (matchedVal.mediaIds && matchedVal.mediaIds.length > 0) {
                const assigned = matchedVal.mediaIds
                  .map((mId) => product.media.find((m) => m.id === mId))
                  .filter(Boolean) as typeof product.media;
                if (assigned.length > 0) return assigned;
              }
            }
          }
        }
      }
    }

    // 1B. Check if any configured option has assigned media for the selected value
    if (productOptions && productOptions.length > 0) {
      for (const opt of productOptions) {
        if (opt.optionValues && opt.optionValues.length > 0) {
          const selectedVal = selectedOptions[opt.name];
          if (selectedVal) {
            const matchedVal = opt.optionValues.find(
              (ov) => ov.value.trim().toLowerCase() === selectedVal.trim().toLowerCase()
            );
            if (matchedVal) {
              if (matchedVal.media && matchedVal.media.length > 0) {
                return matchedVal.media;
              }
              if (matchedVal.mediaIds && matchedVal.mediaIds.length > 0) {
                const assigned = matchedVal.mediaIds
                  .map((mId) => product.media.find((m) => m.id === mId))
                  .filter(Boolean) as typeof product.media;
                if (assigned.length > 0) return assigned;
              }
            }
          }
        }
      }
    }

    // 2. Check selected variant media (backward compatibility)
    if (selectedVariant) {
      if (selectedVariant.media && selectedVariant.media.length > 0) {
        return selectedVariant.media;
      }
      if (selectedVariant.mediaIds && selectedVariant.mediaIds.length > 0) {
        const assigned = selectedVariant.mediaIds
          .map((mId) => product.media.find((m) => m.id === mId))
          .filter(Boolean) as typeof product.media;
        if (assigned.length > 0) {
          return assigned;
        }
      }
      const legacyAssigned = product.media.filter(
        (m) =>
          m.id === selectedVariant.imageId ||
          m.variantId === selectedVariant.id ||
          (selectedVariant.imageUrl && m.url === selectedVariant.imageUrl)
      );
      if (legacyAssigned.length > 0) {
        return legacyAssigned;
      }
    }

    // 3. Fallback: option value / variant has NO assigned images. Display unassigned general product images.
    // Never show images assigned exclusively to OTHER option values or variants!
    const otherAssignedMediaIds = new Set<string>();
    if (productOptions) {
      for (const opt of productOptions) {
        if (opt.optionValues) {
          for (const ov of opt.optionValues) {
            const isCurrentSelected =
              selectedOptions[opt.name]?.trim().toLowerCase() === ov.value.trim().toLowerCase();
            if (!isCurrentSelected && ov.mediaIds) {
              for (const mid of ov.mediaIds) otherAssignedMediaIds.add(mid);
            }
          }
        }
      }
    }
    for (const v of product.variants) {
      if (selectedVariant && v.id === selectedVariant.id) continue;
      if (v.mediaIds) {
        for (const mId of v.mediaIds) otherAssignedMediaIds.add(mId);
      }
      if (v.media) {
        for (const m of v.media) otherAssignedMediaIds.add(m.id);
      }
      if (v.imageId) otherAssignedMediaIds.add(v.imageId);
    }

    const unassigned = product.media.filter(
      (m) =>
        !otherAssignedMediaIds.has(m.id) &&
        (!m.variantId || (selectedVariant && m.variantId === selectedVariant.id))
    );

    if (unassigned.length > 0) {
      return unassigned;
    }

    return product.media;
  }, [product.media, product.variants, productOptions, selectedOptions, selectedVariant]);

  const handleSelectOption = (optName: string, value: string) => {
    const result = resolveVariantSelection(
      activeVariants,
      productOptions,
      selectedOptions,
      optName,
      value
    );
    setSelectedOptions(result.nextOptions);
    if (result.matchedVariant) setSelectedVariantId(result.matchedVariant.id);
    setAddError(null);
    setAddSuccess(false);
  };

  const getOptionValueAvailability = (
    optName: string,
    _optIdx: number,
    val: string
  ) => {
    const targetOpt = productOptions.find(
      (o) => o.name.toLowerCase() === optName.toLowerCase() || o.id === optName
    );
    const isPublishable = Boolean(targetOpt?.isPublishable);

    if (isPublishable) {
      // 1. Publishable option (e.g. Model = Black, Blue, Red):
      // Does ANY active variant have this Model?
      const variantsWithVal = activeVariants.filter((v) => {
        const actual = targetOpt ? getVariantOptionValue(v, targetOpt, productOptions) : null;
        return actual?.toLowerCase() === val.toLowerCase();
      });

      if (variantsWithVal.length === 0) {
        return { exists: false, isOutOfStock: true };
      }

      // Out of stock ONLY if ALL variants with this model are out of stock
      const anyInStock = variantsWithVal.some((v) => {
        const isOut =
          v.inventory?.isOutOfStock ??
          (v.inventory !== undefined ? v.inventory.availableQuantity <= 0 : false);
        return !isOut;
      });

      return { exists: true, isOutOfStock: !anyInStock };
    }

    // 2. Non-publishable option (e.g. Size = S, M, L):
    // Evaluated strictly within the context of the currently selected publishable option(s)
    const publishableOpts = productOptions.filter((o) => o.isPublishable);

    const variantsInPublishableContext = activeVariants.filter((v) => {
      return publishableOpts.every((pOpt) => {
        const selected =
          selectedOptions[pOpt.name] ??
          Object.entries(selectedOptions).find(
            ([k]) => k.toLowerCase() === pOpt.name.toLowerCase()
          )?.[1];
        if (!selected) return true;
        const actual = getVariantOptionValue(v, pOpt, productOptions);
        return actual?.toLowerCase() === selected.toLowerCase();
      });
    });

    const matchingVariants = variantsInPublishableContext.filter((v) => {
      const actual = targetOpt ? getVariantOptionValue(v, targetOpt, productOptions) : null;
      return actual?.toLowerCase() === val.toLowerCase();
    });

    if (matchingVariants.length === 0) {
      // Check if it exists across ANY variant in this product
      const existsInProduct = activeVariants.some((v) => {
        const actual = targetOpt ? getVariantOptionValue(v, targetOpt, productOptions) : null;
        return actual?.toLowerCase() === val.toLowerCase();
      });
      return { exists: existsInProduct, isOutOfStock: true };
    }

    // Exact combination check (including other non-publishable options if selected):
    const exactComboMatch = matchingVariants.find((v) => {
      return productOptions.every((opt) => {
        const expected =
          opt.name.toLowerCase() === optName.toLowerCase()
            ? val
            : (selectedOptions[opt.name] ??
               Object.entries(selectedOptions).find(
                 ([k]) => k.toLowerCase() === opt.name.toLowerCase()
               )?.[1]);
        if (!expected) return true;
        const actual = getVariantOptionValue(v, opt, productOptions);
        return actual?.toLowerCase() === expected.toLowerCase();
      });
    });

    if (exactComboMatch) {
      const isOut =
        exactComboMatch.inventory?.isOutOfStock ??
        (exactComboMatch.inventory !== undefined
          ? exactComboMatch.inventory.availableQuantity <= 0
          : false);
      return { exists: true, isOutOfStock: isOut };
    }

    const anyInStock = matchingVariants.some((v) => {
      const isOut =
        v.inventory?.isOutOfStock ??
        (v.inventory !== undefined ? v.inventory.availableQuantity <= 0 : false);
      return !isOut;
    });

    return { exists: true, isOutOfStock: !anyInStock };
  };

  const selectedVariantInventory = selectedVariant?.inventory;
  const variantOut = (v: StorefrontVariantDTO) =>
    v.inventory ? (v.inventory.isOutOfStock ?? v.inventory.availableQuantity <= 0) : false;
  // Stock is only asserted for the exact selected variant; with no selection yet, the product is
  // "out of stock" only when it has no purchasable variant or every one is known to be out.
  const isOutOfStock = selectedVariant
    ? variantOut(selectedVariant)
    : activeVariants.length === 0 || activeVariants.every(variantOut);
  const isLowStock = selectedVariantInventory?.isLowStock ?? false;
  const availableQuantity =
    selectedVariantInventory?.availableQuantity ??
    (isOutOfStock ? 0 : 999);
  const maxOrderQuantity =
    selectedVariantInventory?.maxOrderQuantity ??
    selectedVariant?.maxOrderQuantity ??
    product.maxOrderQuantity ??
    null;
  const effectiveMaxQuantity =
    selectedVariantInventory?.effectiveMaxQuantity ??
    Math.max(
      0,
      maxOrderQuantity !== null
        ? Math.min(availableQuantity, maxOrderQuantity)
        : availableQuantity,
    );

  const currency =
    selectedVariant?.currency || storeCurrency || "USD";
  const price = selectedVariant?.price;
  // Before an exact variant is chosen, show only a range derived from real variant prices.
  const activePrices = activeVariants.map((v) => v.price);
  const minActivePrice = activePrices.length > 0 ? Math.min(...activePrices) : undefined;
  const showFromPrice =
    !selectedVariant && activePrices.length > 0 && Math.max(...activePrices) !== minActivePrice;
  const shownPrice = price ?? minActivePrice;
  const compareAtPrice = selectedVariant?.compareAtPrice;
  const hasCompareAt =
    compareAtPrice !== null &&
    compareAtPrice !== undefined &&
    price !== undefined &&
    compareAtPrice > price;

  // Calculate discount percentage
  const discountPercent =
    hasCompareAt && compareAtPrice && price
      ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
      : null;

  // Determine if this product has selectable variants vs a single default variant
  const isDefaultSingleVariant =
    activeVariants.length <= 1 &&
    (activeVariants.length === 0 ||
      activeVariants[0]?.title === "Default Title" ||
      activeVariants[0]?.title === "Default");

  const currentMedia =
    variantGalleryMedia && variantGalleryMedia.length > 0
      ? variantGalleryMedia[selectedMediaIndex] || variantGalleryMedia[0]
      : undefined;

  const catalogHref = `/stores/${encodeURIComponent(storeSlug)}/products`;

  return (
    <div className="storefront-product-detail-container at-container pb-24 pt-6 sm:pt-8" data-testid="product-detail-view">
      {/* 1. Navigation Breadcrumbs */}
      <nav className="storefront-breadcrumbs mb-8 flex items-center text-xs text-muted-foreground" aria-label="Breadcrumb">
        <ol className="storefront-breadcrumb-list flex items-center gap-2 flex-wrap list-none p-0 m-0">
          <li>
            <Link href={`/stores/${encodeURIComponent(storeSlug)}`} className="storefront-breadcrumb-link at-link">
              {storeName}
            </Link>
          </li>
          <li aria-hidden="true" className="storefront-breadcrumb-sep text-border">/</li>
          <li>
            <Link href={catalogHref} className="storefront-breadcrumb-link at-link">
              Products
            </Link>
          </li>
          <li aria-hidden="true" className="storefront-breadcrumb-sep text-border">/</li>
          <li aria-current="page" className="storefront-breadcrumb-current text-foreground font-semibold truncate max-w-xs sm:max-w-md">
            {displayProductTitle}
          </li>
        </ol>
      </nav>

      {/* 2. Main Product Layout (Asymmetric 4:5 Gallery Left, Sticky Buying Column Right) */}
      <div className="storefront-product-detail-layout grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-16">
        {/* Left Column: Media Gallery (7 cols on lg) */}
        <div className="storefront-product-gallery lg:col-span-7 space-y-4">
          <div className="storefront-product-gallery-main relative aspect-[4/5] w-full overflow-hidden bg-muted group">
            {currentMedia && !brokenMediaUrls.has(currentMedia.url) ? (
              <AnimatePresence initial={false} mode="popLayout">
                <motion.img
                  key={currentMedia.url}
                  src={currentMedia.url}
                  alt={currentMedia.altText || displayProductTitle}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                  decoding="async"
                  className="storefront-gallery-main-image absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                  data-testid="main-product-image"
                  onError={() => setBrokenMediaUrls((prev) => new Set(prev).add(currentMedia.url))}
                />
              </AnimatePresence>
            ) : (
              <div
                className="storefront-gallery-fallback w-full h-full flex flex-col items-center justify-center p-8 text-muted-foreground bg-muted/10"
                role="img"
                aria-label={`No image available for ${displayProductTitle}`}
                data-testid="product-image-fallback"
              >
                <div className="w-16 h-16 rounded-none bg-muted/30 border border-[color:var(--at-hairline)] flex items-center justify-center mb-4">
                  <svg
                    className="storefront-gallery-fallback-icon w-8 h-8 stroke-1 text-muted-foreground/60"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <span className="text-sm font-medium tracking-wide">No product image available</span>
              </div>
            )}

            {/* Savings Pill Overlay */}
            {discountPercent !== null && discountPercent > 0 && (
              <div className="absolute top-4 left-4 z-10">
                <span className="at-num inline-flex items-center bg-foreground px-3 py-1.5 text-xs font-medium tracking-wide text-background">
                  −{discountPercent}%
                </span>
              </div>
            )}
          </div>

          {/* Media Thumbnails */}
          {variantGalleryMedia && variantGalleryMedia.length > 1 && (
            <div
              className="storefront-gallery-thumbnails"
              role="tablist"
              aria-label="Product Media Thumbnails"
              style={{ display: "flex", alignItems: "center", gap: "0.75rem", overflowX: "auto", paddingBottom: "0.5rem" }}
              onKeyDown={(e) => {
                const count = variantGalleryMedia.length;
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  const next = (selectedMediaIndex + (e.key === "ArrowRight" ? 1 : -1) + count) % count;
                  setSelectedMediaIndex(next);
                  const tabs = e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');
                  tabs[next]?.focus();
                }
              }}
            >
              {variantGalleryMedia.map((media: ProductMediaDTO, idx: number) => (
                <button
                  key={media.id || idx}
                  type="button"
                  role="tab"
                  aria-selected={idx === selectedMediaIndex}
                  aria-label={`Show image ${idx + 1} of ${variantGalleryMedia.length}`}
                  tabIndex={idx === selectedMediaIndex ? 0 : -1}
                  className={`storefront-gallery-thumb-btn relative shrink-0 w-20 h-24 rounded-none overflow-hidden border-2 transition-[opacity,border-color,box-shadow] duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    idx === selectedMediaIndex
                      ? "storefront-gallery-thumb-btn--active border-foreground"
                      : "border-[color:var(--at-hairline)] opacity-60 hover:opacity-100 hover:border-border"
                  }`}
                  onClick={() => setSelectedMediaIndex(idx)}
                >
                  <img
                    src={media.url}
                    alt={media.altText || `${displayProductTitle} view ${idx + 1}`}
                    className="storefront-gallery-thumb-img w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Product Purchase Info (5 cols on lg, sticky) */}
        <div className="storefront-product-info lg:col-span-5 lg:sticky lg:top-28">
          <div className="space-y-7">
              {/* Header: Brand Eyebrow, Title, SKU, Stock Status */}
              <div className="storefront-info-header space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="at-eyebrow text-muted-foreground">
                    {storeName}
                  </span>
                  {product.typeName && (
                    <>
                      <span className="text-border" aria-hidden="true">•</span>
                      <span className="at-eyebrow text-muted-foreground">
                        {product.typeName}
                      </span>
                    </>
                  )}
                  {product.categoryName && (
                    <>
                      <span className="text-border" aria-hidden="true">•</span>
                      <span className="at-eyebrow text-muted-foreground">
                        {product.categoryName}
                      </span>
                    </>
                  )}
                </div>

                <h1 className="storefront-product-title at-display-md text-foreground" data-testid="product-title">
                  {displayProductTitle}
                </h1>

                {Boolean(product.ratingCount && product.ratingCount > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      document.getElementById("reviews-section")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer group text-left"
                    data-testid="pdp-rating-summary"
                  >
                    <div className="flex items-center text-amber-500">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={13}
                          className={
                            s <= Math.round(product.ratingAverage ?? 0)
                              ? "fill-amber-400 text-amber-500"
                              : "text-muted-foreground/30 fill-transparent"
                          }
                        />
                      ))}
                    </div>
                    <span className="font-bold text-foreground ">
                      {(product.ratingAverage ?? 0).toFixed(1)}
                    </span>
                    <span className="text-muted-foreground group-hover:underline">
                      ({product.ratingCount} {product.ratingCount === 1 ? "review" : "reviews"})
                    </span>
                  </button>
                )}

                <div className="storefront-status-row flex flex-wrap items-center gap-2.5 pt-1">
                  {!selectedVariant && !isOutOfStock ? null : isOutOfStock ? (
                    <span data-testid="stock-badge" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground" aria-hidden="true" />Out of Stock</span>
                  ) : isLowStock ? (
                    <span data-testid="stock-badge" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><span className="inline-block h-1.5 w-1.5 rounded-full bg-destructive" aria-hidden="true" />Only {availableQuantity} left</span>
                  ) : (
                    <span data-testid="stock-badge" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />In Stock</span>
                  )}

                  {maxOrderQuantity !== null && (
                    <span className="text-muted-foreground text-xs storefront-limit-badge px-2.5 py-0.5 rounded-full bg-muted/60 border border-[color:var(--at-hairline)]" data-testid="max-order-limit">
                      Limit {maxOrderQuantity} per order
                    </span>
                  )}

                  {selectedVariant?.sku && (
                    <span className="storefront-sku text-xs text-muted-foreground " data-testid="product-sku">
                      SKU: {selectedVariant.sku}
                    </span>
                  )}
                </div>
              </div>

              {/* Price Section with Crisp Monospace Typography */}
              {(() => {
                const priceConv = shownPrice != null ? convertPrice(shownPrice) : null;
                const compareConv = compareAtPrice != null ? convertPrice(compareAtPrice) : null;
                return (
                  <div className="storefront-price-section flex flex-wrap items-baseline gap-3.5 py-4 border-y border-[color:var(--at-hairline)]" aria-label="Pricing">
                    <span className="storefront-price-main at-num text-2xl sm:text-3xl font-medium text-foreground" data-testid="product-price">
                      {showFromPrice && <span className="mr-1.5 text-sm text-muted-foreground">From</span>}
                      {priceConv ? priceConv.presentmentFormatted : formatStorePrice(shownPrice, currency)}
                    </span>
                    {hasCompareAt && (
                      <span
                        className="storefront-price-compare at-num text-base text-muted-foreground line-through"
                        aria-label={`Was ${compareConv ? compareConv.presentmentFormatted : formatStorePrice(compareAtPrice, currency)}`}
                      >
                        {compareConv ? compareConv.presentmentFormatted : formatStorePrice(compareAtPrice, currency)}
                      </span>
                    )}
                    {priceConv?.isConverted && (
                      <span className="text-xs text-muted-foreground/80 self-end pb-1 w-full sm:w-auto">
                        approx. {priceConv.baseFormatted}
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* Product Options & Variant Pickers */}
              {!isDefaultSingleVariant && productOptions.length > 0 && (
                <div className="storefront-variant-picker space-y-4" data-testid="variant-selector">
                  {productOptions.map((opt, optIdx) => {
                    const isColor =
                      opt.name.toLowerCase() === "color" ||
                      opt.name.toLowerCase() === "colour";
                    const currentVal =
                      selectedOptions[opt.name] ||
                      Object.entries(selectedOptions).find(
                        ([k]) => k.toLowerCase() === opt.name.toLowerCase()
                      )?.[1] ||
                      "";

                    return (
                      <fieldset
                        key={opt.id}
                        className="storefront-option-fieldset space-y-2.5"
                      >
                        <legend className="storefront-variant-picker-label text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {opt.name}:{" "}
                          <span className="text-foreground normal-case font-sans font-semibold ml-1">
                            {currentVal}
                          </span>
                        </legend>

                        {isColor ? (
                          /* Color Swatches */
                          <div
                            className="storefront-color-swatches flex flex-wrap gap-2.5 items-center pt-0.5"
                            role="radiogroup"
                            aria-label={opt.name}
                          >
                            {opt.values.map((val) => {
                              const isSelected =
                                currentVal.toLowerCase() === val.toLowerCase();
                              const hex = getColorHex(val);
                              const { exists, isOutOfStock: isValOutOfStock } =
                                getOptionValueAvailability(opt.name, optIdx, val);

                              return (
                                <button
                                  key={val}
                                  type="button"
                                  role="radio"
                                  aria-checked={isSelected}
                                  aria-label={`${val}${isValOutOfStock ? " (Out of Stock)" : ""}`}
                                  onClick={() => handleSelectOption(opt.name, val)}
                                  className={`relative group p-0.5 rounded-full transition-all focus:outline-hidden cursor-pointer ${
                                    isSelected
                                      ? "ring-2 ring-primary ring-offset-2 ring-offset-card scale-110"
                                      : "hover:scale-105 hover:ring-1 hover:ring-border/80"
                                  } ${!exists ? "opacity-30 cursor-not-allowed" : ""}`}
                                  title={`${val}${isValOutOfStock ? " - Out of stock" : ""}`}
                                  data-testid={`swatch-${val.toLowerCase()}`}
                                >
                                  <span
                                    className="w-7 h-7 rounded-full flex items-center justify-center border border-black/15 relative overflow-hidden"
                                    style={{ backgroundColor: hex || "#888888" }}
                                  >
                                    {isSelected && (
                                      <Check
                                        size={12}
                                        className={`stroke-[3] ${
                                          val.toLowerCase() === "white" ||
                                          val.toLowerCase() === "beige" ||
                                          val.toLowerCase() === "cream"
                                            ? "text-black"
                                            : "text-white"
                                        }`}
                                      />
                                    )}
                                    {isValOutOfStock && (
                                      <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <span className="w-full h-0.5 bg-rose-500 rotate-45 transform" />
                                      </span>
                                    )}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          /* Size, Material, Style, etc. tactile pills */
                          <div
                            className="storefront-option-pills flex flex-wrap gap-2"
                            role="radiogroup"
                            aria-label={opt.name}
                          >
                            {opt.values.map((val) => {
                              const isSelected =
                                currentVal.toLowerCase() === val.toLowerCase();
                              const { exists, isOutOfStock: isValOutOfStock } =
                                getOptionValueAvailability(opt.name, optIdx, val);

                              return (
                                <button
                                  key={val}
                                  type="button"
                                  role="radio"
                                  aria-checked={isSelected}
                                  onClick={() => handleSelectOption(opt.name, val)}
                                  className={`min-h-[38px] px-4 py-2 rounded-none text-xs font-semibold transition-all relative cursor-pointer ${
                                    isSelected
                                      ? "bg-foreground text-background font-bold ring-2 ring-primary/30"
                                      : "bg-card border border-border/80 text-foreground hover:border-primary/50 hover:bg-muted/40"
                                  } ${
                                    isValOutOfStock
                                      ? "opacity-50 line-through text-muted-foreground border-dashed"
                                      : ""
                                  } ${
                                    !exists
                                      ? "opacity-30 cursor-not-allowed border-dashed"
                                      : ""
                                  }`}
                                  data-testid={`pill-${opt.name.toLowerCase()}-${val.toLowerCase()}`}
                                >
                                  <span>{val}</span>
                                  {isValOutOfStock && !isSelected && (
                                    <span className="sr-only"> (Out of stock)</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </fieldset>
                    );
                  })}
                </div>
              )}

              {/* Fallback to simple Variant Buttons if no option definitions exist */}
              {!isDefaultSingleVariant &&
                productOptions.length === 0 &&
                activeVariants.length > 1 && (
                  <fieldset
                    className="storefront-variant-picker space-y-3"
                    data-testid="variant-selector"
                  >
                    <legend className="storefront-variant-picker-label text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Variant:{" "}
                      <span className="text-foreground normal-case font-sans font-semibold ml-1">
                        {selectedVariant?.title}
                      </span>
                    </legend>
                    <div
                      className="storefront-variant-options flex flex-wrap gap-2.5"
                      role="radiogroup"
                      aria-label="Product variants"
                    >
                      {activeVariants.map((variant) => {
                        const isSelected = variant.id === selectedVariant?.id;
                        return (
                          <button
                            key={variant.id}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            className={`btn ${
                              isSelected
                                ? "btn-primary ring-2 ring-primary/25"
                                : "btn-outline hover:border-primary/50 hover:bg-muted/40"
                            } btn-sm storefront-variant-btn rounded-none px-4 py-2 text-xs font-semibold transition-all`}
                            onClick={() => setSelectedVariantId(variant.id)}
                            data-testid={`variant-btn-${variant.id}`}
                          >
                            {variant.title}
                            {variant.price !== undefined &&
                              variant.price !== price && (
                                <span className="storefront-variant-btn-price ml-1.5 opacity-80 font-normal">
                                  (
                                  {formatStorePrice(
                                    variant.price,
                                    variant.currency || currency
                                  )}
                                  )
                                </span>
                              )}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                )}

              {/* Single Variant Display Notice */}
              {isDefaultSingleVariant && activeVariants.length === 1 && (
                <div
                  className="storefront-default-variant-note"
                  data-testid="default-variant-badge"
                >
                  <span className="text-muted-foreground text-xs font-medium">
                    Standard option
                  </span>
                </div>
              )}

              {/* Add to Cart Actions */}
              <div className="storefront-add-to-cart-container space-y-4 pt-2">
                {selectionMessage && (
                  <p className="text-xs text-muted-foreground" role="status" data-testid="select-options-hint">
                    {selectionMessage}
                  </p>
                )}
                {!cartContext && addSuccess && (
                  <div
                    className="alert alert--success storefront-cart-feedback p-3.5 rounded-none bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center justify-between"
                    role="status"
                    data-testid="add-to-cart-success"
                  >
                    <span className="flex items-center gap-2">
                      <Check size={16} className="text-emerald-400 shrink-0" />
                      <span>Added {quantity} {quantity === 1 ? "item" : "items"} to cart!</span>
                    </span>
                    <Link
                      href={`/stores/${encodeURIComponent(storeSlug)}/cart`}
                      className="btn btn-outline btn-xs rounded-none px-3 py-1 text-xs font-semibold cursor-pointer"
                      data-testid="open-cart-after-add"
                    >
                      View in Cart
                    </Link>
                  </div>
                )}

                {!cartContext && addError && (
                  <div
                    className="alert alert--danger storefront-cart-feedback p-3.5 rounded-none bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium"
                    role="alert"
                    data-testid="add-to-cart-error"
                  >
                    <span>{addError}</span>
                  </div>
                )}

                <div className="storefront-cart-actions-row flex items-center gap-3">
                  {/* Quantity Stepper */}
                  <div className="storefront-quantity-control">
                    <label htmlFor="product-qty-input" className="sr-only">
                      Quantity
                    </label>
                    <div className="cart-quantity-stepper flex items-center rounded-none border border-border/80 bg-background/80 p-1">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm cart-stepper-btn w-9 h-9 rounded-none flex items-center justify-center text-sm font-bold hover:bg-muted"
                        onClick={() => {
                          setQuantity((q) => Math.max(1, q - 1));
                          setAddSuccess(false);
                        }}
                        disabled={isOutOfStock || quantity <= 1 || isAdding}
                        aria-label="Decrease quantity"
                        data-testid="decrease-quantity-btn"
                      >
                        -
                      </button>
                      <input
                        id="product-qty-input"
                        type="number"
                        min={isOutOfStock ? 0 : 1}
                        max={effectiveMaxQuantity}
                        value={isOutOfStock ? 0 : Math.min(quantity, effectiveMaxQuantity || 1)}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) {
                            const clampMax = effectiveMaxQuantity > 0 ? effectiveMaxQuantity : 1;
                            setQuantity(Math.max(1, Math.min(clampMax, val)));
                          }
                          setAddSuccess(false);
                        }}
                        className="cart-quantity-input w-12 text-center bg-transparent text-sm font-semibold text-foreground focus:outline-none"
                        disabled={isOutOfStock || effectiveMaxQuantity <= 0 || isAdding}
                        aria-label="Product quantity"
                        data-testid="quantity-input"
                      />
                      <button
                        type="button"
                        className="btn btn-outline btn-sm cart-stepper-btn w-9 h-9 rounded-none flex items-center justify-center text-sm font-bold hover:bg-muted"
                        onClick={() => {
                          setQuantity((q) => Math.min(effectiveMaxQuantity, q + 1));
                          setAddSuccess(false);
                        }}
                        disabled={
                          isOutOfStock ||
                          effectiveMaxQuantity <= 0 ||
                          quantity >= effectiveMaxQuantity ||
                          isAdding
                        }
                        aria-label="Increase quantity"
                        data-testid="increase-quantity-btn"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Add to Cart Button */}
                  <button
                    type="button"
                    className="storefront-add-to-cart-btn flex-1 ds-btn ds-btn-primary"
                    disabled={
                      !selectedVariant ||
                      activeVariants.length === 0 ||
                      isOutOfStock ||
                      effectiveMaxQuantity <= 0 ||
                      isAdding ||
                      cartContext?.isMutating
                    }
                    onClick={async () => {
                      if (isAdding || cartContext?.isMutating) return;
                      const addItem: (variantId: string, qty: number) => Promise<unknown> =
                        onAddToCart ??
                        (cartContext ? (id, qty) => cartContext.addItem(id, qty) : async () => undefined);

                      setIsAdding(true);
                      setAddSuccess(false);
                      setAddError(null);

                      try {
                        // Re-resolve the complete selection to the exact variant at submit time.
                        const result = await submitSelectedVariant({
                          variants: usesPlainVariantButtons
                            ? selectedVariant
                              ? [selectedVariant]
                              : []
                            : activeVariants,
                          options: usesPlainVariantButtons ? [] : resolutionOptions,
                          selection: selectedOptions,
                          quantity,
                          addItem,
                          flight: addFlight.current,
                        });
                        if (result.status === "added") setAddSuccess(true);
                        else if (result.status === "rejected" || result.status === "failed") {
                          setAddError(result.message);
                        }
                      } finally {
                        setIsAdding(false);
                      }
                    }}
                    data-testid="add-to-cart-button"
                  >
                    {isAdding ? (
                      <>
                        <Spinner size="sm" />
                        <span>Adding...</span>
                      </>
                    ) : isOutOfStock || effectiveMaxQuantity <= 0 ? (
                      "Out of Stock"
                    ) : !selectedVariant && missingOptions.length > 0 ? (
                      `Select ${missingOptions[0]}`
                    ) : (
                      <>
                        <span>Add to Cart</span>
                      </>
                    )}
                  </button>

                  {/* Wishlist Button */}
                  <button
                    type="button"
                    onClick={async () => {
                      if (!wishlistContext) return;
                      setIsWishlisting(true);
                      try {
                        await wishlistContext.toggleWishlist(
                          product.id,
                          selectedVariant?.id || null,
                          {
                            productTitle: product.title,
                            productSlug: product.slug,
                            price: selectedVariant?.price ?? 0,
                            compareAtPrice: selectedVariant?.compareAtPrice ?? null,
                            currency: selectedVariant?.currency || storeCurrency || "USD",
                            primaryMediaUrl: variantGalleryMedia[0]?.url || product.media?.[0]?.url || null,
                            isOutOfStock,
                            variantTitle: selectedVariant?.title ?? null,
                          }
                        );
                      } finally {
                        setIsWishlisting(false);
                      }
                    }}
                    disabled={isWishlisting}
                    aria-label={inWishlist ? "Remove from Wishlist" : "Add to Wishlist"}
                    aria-pressed={inWishlist}
                    className={`h-12 w-12 shrink-0 rounded-none border flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-95 ${
                      inWishlist
                        ? "bg-transparent border-foreground text-primary"
                        : "bg-muted/30 border-[color:var(--at-hairline)] text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                    title={inWishlist ? "In Wishlist" : "Add to Wishlist"}
                  >
                    <Heart
                      size={20}
                      className={`transition-transform duration-200 ${
                        inWishlist ? "fill-primary scale-110" : "scale-100"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Checkout assurances (only statements that are true for every store) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-4 border-t border-[color:var(--at-hairline)] text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={15} className="text-primary shrink-0" />
                  <span>Secure payment powered by Razorpay</span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck size={15} className="text-primary shrink-0" />
                  <span>Shipping and taxes calculated at checkout</span>
                </div>
              </div>

              {/* Long-form Description */}
              {product.description && (
                <div className="storefront-description-section pt-4 border-t border-[color:var(--at-hairline)] space-y-2.5">
                  <h2 className="storefront-section-heading text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Description
                  </h2>
                  <div className="storefront-description-content text-sm text-foreground/90 leading-relaxed space-y-2">
                    {product.description.split("\n\n").map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Product Tags */}
              {product.tags && product.tags.length > 0 && (
                <div className="storefront-tags-section pt-3 border-t border-[color:var(--at-hairline)] space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Tags
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {product.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted/60 text-muted-foreground border border-[color:var(--at-hairline)]"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Back to Catalog Link */}
              <div className="storefront-back-action pt-2">
                <Link
                  href={catalogHref}
                  className="storefront-back-btn at-link inline-flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <ArrowLeft size={14} />
                  <span>Back to All Products</span>
                </Link>
              </div>
            </div>
        </div>
      </div>

      {/* Product Reviews and Ratings Section */}
      <ProductReviewsSection
        product={{ id: product.id, slug: product.slug, title: product.title }}
        storeSlug={storeSlug}
      />
    </div>
  );
}
