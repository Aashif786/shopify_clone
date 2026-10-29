import React, { useState } from "react";
import type { ProductDetailDTO, ProductVariantDTO, ProductOptionDTO, ProductMediaDTO } from "@shopify-clone/products";
import { Badge, Card, CardContent, Spinner } from "@shopify-clone/ui";
import { formatStorePrice } from "./product-card";
import { useOptionalCart } from "../../../context/cart-context";
import {
  ShoppingBag,
  ShieldCheck,
  Truck,
  RotateCcw,
  Check,
  Sparkles,
  ArrowLeft,
  Star,
} from "lucide-react";
import { ProductReviewsSection } from "../reviews/product-reviews-section";

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

/**
 * Extracts the string value of an option for a given variant.
 * Respects option position, option1..3, and title fallback.
 */
export function getVariantOptionValue(
  v: ProductVariantDTO,
  opt: ProductOptionDTO,
  allOptions: ProductOptionDTO[] = []
): string | null {
  let pos = typeof opt.position === "number" ? opt.position : -1;
  if (pos < 0 || pos > 2) {
    const idx = allOptions.findIndex(
      (o) => o.id === opt.id || o.name.toLowerCase() === opt.name.toLowerCase()
    );
    pos = idx >= 0 ? idx : 0;
  }
  const val = pos === 0 ? v.option1 : pos === 1 ? v.option2 : pos === 2 ? v.option3 : null;
  if (val && val.trim().length > 0) return val.trim();
  if (v.title && v.title !== "Default Title" && v.title !== "Default") {
    const parts = v.title.split("/").map((p) => p.trim());
    const part = parts[pos];
    if (part) return part;
  }
  return null;
}

/**
 * Finds the variant matching the selected options map exactly.
 * Case-insensitive on both option names and option values.
 */
export function findMatchingVariant(
  variants: StorefrontVariantDTO[],
  options: ProductOptionDTO[],
  selections: Record<string, string>
): StorefrontVariantDTO | undefined {
  const normalizedSelections: Record<string, string> = {};
  for (const [k, v] of Object.entries(selections)) {
    if (v !== undefined && v !== null) {
      normalizedSelections[k.trim().toLowerCase()] = v.trim().toLowerCase();
    }
  }

  return variants.find((v) => {
    return options.every((opt) => {
      const selected = normalizedSelections[opt.name.trim().toLowerCase()];
      if (!selected) return true;
      const actual = getVariantOptionValue(v, opt, options);
      return actual?.toLowerCase() === selected;
    });
  });
}

export interface VariantSelectionResult {
  nextOptions: Record<string, string>;
  matchedVariant: StorefrontVariantDTO | undefined;
  isPublishableSwitch: boolean;
}

/**
 * Pure resolution helper: derives the next selected options map and matching purchasable variant.
 * Preserves standalone listing identity and maintains independent non-publishable options.
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
  const isPublishable = Boolean(targetOpt?.isPublishable);

  const nextOptions: Record<string, string> = {};
  for (const [k, v] of Object.entries(currentSelections)) {
    if (k.toLowerCase() !== canonicalName.toLowerCase()) {
      nextOptions[k] = v;
    }
  }
  nextOptions[canonicalName] = changedValue;

  let matchedVariant = findMatchingVariant(activeVariants, productOptions, nextOptions);

  if (isPublishable) {
    // When switching a publishable option (e.g. Model = Blue),
    // preserve current non-publishable choices if valid; otherwise adapt to the first valid combination for the new model.
    if (!matchedVariant) {
      const fallback = activeVariants.find((v) => {
        const actual = targetOpt ? getVariantOptionValue(v, targetOpt, productOptions) : null;
        return actual?.toLowerCase() === changedValue.toLowerCase();
      });

      if (fallback) {
        matchedVariant = fallback;
        productOptions.forEach((opt) => {
          if (!opt.isPublishable) {
            const optVal = getVariantOptionValue(fallback, opt, productOptions);
            if (optVal) {
              nextOptions[opt.name] = optVal;
            }
          }
        });
      }
    }
  } else {
    // When switching a non-publishable option (e.g. Size = M) within the current listing,
    // strictly preserve the current publishable option values (the listing identity).
    if (!matchedVariant) {
      const publishableOpts = productOptions.filter((o) => o.isPublishable);
      const fallback = activeVariants.find((v) => {
        const matchPub = publishableOpts.every((pOpt) => {
          const expected = nextOptions[pOpt.name];
          if (!expected) return true;
          const actual = getVariantOptionValue(v, pOpt, productOptions);
          return actual?.toLowerCase() === expected.toLowerCase();
        });
        if (!matchPub) return false;
        const targetVal = targetOpt ? getVariantOptionValue(v, targetOpt, productOptions) : null;
        return targetVal?.toLowerCase() === changedValue.toLowerCase();
      });

      if (fallback) {
        matchedVariant = fallback;
        productOptions.forEach((opt) => {
          if (!opt.isPublishable && opt.name.toLowerCase() !== canonicalName.toLowerCase()) {
            const optVal = getVariantOptionValue(fallback, opt, productOptions);
            if (optVal) {
              nextOptions[opt.name] = optVal;
            }
          }
        });
      }
    }
  }

  return {
    nextOptions,
    matchedVariant,
    isPublishableSwitch: isPublishable,
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

  // Active variants only
  const activeVariants = product.variants.filter((v) => v.status === "ACTIVE");

  // Determine initial variant from URL query param, props, or first active variant
  const initialVariant = React.useMemo(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const urlVar = sp.get("variant");
      if (urlVar) {
        const found = activeVariants.find((v) => v.id === urlVar);
        if (found) return found;
      }
      // Check direct option query params, e.g. ?color=Red or ?option[Color]=Red
      for (const opt of product.options || []) {
        const valFromParam =
          sp.get(opt.name.toLowerCase()) ||
          sp.get(opt.name) ||
          sp.get(`option[${opt.name.toLowerCase()}]`) ||
          sp.get(`option[${opt.name}]`);
        if (valFromParam) {
          const found = activeVariants.find((v) => {
            const actual = getVariantOptionValue(v, opt, product.options || []);
            return actual?.toLowerCase() === valFromParam.toLowerCase();
          });
          if (found) return found;
        }
      }
    }
    if (initialVariantId) {
      const found = activeVariants.find((v) => v.id === initialVariantId);
      if (found) return found;
    }
    return activeVariants[0];
  }, [activeVariants, initialVariantId, product.options]);

  // Determine configured options (either from product.options or derived from variants)
  const productOptions = React.useMemo(() => {
    if (product.options && product.options.length > 0) {
      return product.options;
    }
    const opt1Vals = Array.from(
      new Set(activeVariants.map((v) => v.option1).filter(Boolean))
    ) as string[];
    const opt2Vals = Array.from(
      new Set(activeVariants.map((v) => v.option2).filter(Boolean))
    ) as string[];
    const opt3Vals = Array.from(
      new Set(activeVariants.map((v) => v.option3).filter(Boolean))
    ) as string[];

    const list: ProductOptionDTO[] = [];
    if (opt1Vals.length > 0) {
      list.push({ id: "opt-1", productId: product.id, name: "Option 1", position: 0, values: opt1Vals, isPublishable: false, optionValues: [] });
    }
    if (opt2Vals.length > 0) {
      list.push({ id: "opt-2", productId: product.id, name: "Option 2", position: 1, values: opt2Vals, isPublishable: false, optionValues: [] });
    }
    if (opt3Vals.length > 0) {
      list.push({ id: "opt-3", productId: product.id, name: "Option 3", position: 2, values: opt3Vals, isPublishable: false, optionValues: [] });
    }
    return list;
  }, [product.options, activeVariants]);

  // Track user selections for each option
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(
    () => {
      const initial: Record<string, string> = {};
      const targetVariant = initialVariant || activeVariants[0];
      if (productOptions.length > 0) {
        productOptions.forEach((opt) => {
          let val = targetVariant ? getVariantOptionValue(targetVariant, opt, productOptions) : null;
          if (!val && typeof window !== "undefined") {
            const sp = new URLSearchParams(window.location.search);
            val =
              sp.get(opt.name.toLowerCase()) ||
              sp.get(opt.name) ||
              sp.get(`option[${opt.name.toLowerCase()}]`) ||
              sp.get(`option[${opt.name}]`);
          }
          initial[opt.name] = val || opt.values[0] || "";
        });
      }
      return initial;
    }
  );

  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    () => initialVariant?.id || activeVariants[0]?.id || "",
  );
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [addSuccess, setAddSuccess] = useState<boolean>(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Resolve matching variant based on selected options
  const selectedVariant: StorefrontVariantDTO | undefined = React.useMemo(() => {
    if (productOptions.length > 0) {
      const exactMatch = findMatchingVariant(activeVariants, productOptions, selectedOptions);
      if (exactMatch) return exactMatch;

      // Fallback matching: prioritize matching publishable options first
      const publishableOpts = productOptions.filter((o) => o.isPublishable);
      if (publishableOpts.length > 0) {
        const pubMatch = activeVariants.find((v) => {
          return publishableOpts.every((pOpt) => {
            const expected = selectedOptions[pOpt.name];
            if (!expected) return true;
            const actual = getVariantOptionValue(v, pOpt, productOptions);
            return actual?.toLowerCase() === expected.toLowerCase();
          });
        });
        if (pubMatch) return pubMatch;
      }
    }

    return (
      activeVariants.find((v) => v.id === selectedVariantId) ||
      activeVariants[0]
    );
  }, [productOptions, activeVariants, selectedOptions, selectedVariantId]);

  // Track previous initialVariantId prop to prevent user clicks from being reset
  const prevInitialVariantIdRef = React.useRef(initialVariantId);

  // Sync selected variant ID state when matching variant is resolved
  React.useEffect(() => {
    if (selectedVariant && selectedVariant.id !== selectedVariantId) {
      setSelectedVariantId(selectedVariant.id);
      setSelectedMediaIndex(0);
    }
  }, [selectedVariant, selectedVariantId]);

  // Synchronize variant with URL query parameter without full reload
  React.useEffect(() => {
    if (typeof window !== "undefined" && selectedVariant?.id) {
      const url = new URL(window.location.href);
      if (url.searchParams.get("variant") !== selectedVariant.id) {
        url.searchParams.set("variant", selectedVariant.id);
        window.history.replaceState(null, "", url.toString());
      }
    }
  }, [selectedVariant?.id]);

  // Handle external or prop changes to initialVariantId ONLY when the prop actually changes
  React.useEffect(() => {
    if (initialVariantId && initialVariantId !== prevInitialVariantIdRef.current) {
      prevInitialVariantIdRef.current = initialVariantId;
      const target = activeVariants.find((v) => v.id === initialVariantId);
      if (target) {
        setSelectedVariantId(target.id);
        setSelectedMediaIndex(0);
        if (productOptions.length > 0) {
          const nextOpts: Record<string, string> = {};
          productOptions.forEach((opt) => {
            const val = getVariantOptionValue(target, opt, productOptions);
            nextOpts[opt.name] = val || opt.values[0] || "";
          });
          setSelectedOptions(nextOpts);
        }
      }
    }
  }, [initialVariantId, activeVariants, productOptions]);

  // Listen to browser forward/back button navigation
  React.useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const urlVar = new URLSearchParams(window.location.search).get("variant");
      if (urlVar) {
        const target = activeVariants.find((v) => v.id === urlVar);
        if (target) {
          prevInitialVariantIdRef.current = target.id;
          setSelectedVariantId(target.id);
          setSelectedMediaIndex(0);
          if (productOptions.length > 0) {
            const nextOpts: Record<string, string> = {};
            productOptions.forEach((opt) => {
              const val = getVariantOptionValue(target, opt, productOptions);
              nextOpts[opt.name] = val || opt.values[0] || "";
            });
            setSelectedOptions(nextOpts);
          }
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeVariants, productOptions]);

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
    if (result.matchedVariant) {
      setSelectedVariantId(result.matchedVariant.id);
      setSelectedMediaIndex(0);

      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        if (url.searchParams.get("variant") !== result.matchedVariant.id) {
          url.searchParams.set("variant", result.matchedVariant.id);
          if (result.isPublishableSwitch) {
            window.history.pushState(null, "", url.toString());
          } else {
            window.history.replaceState(null, "", url.toString());
          }
        }
      }
    }
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
  const isOutOfStock =
    selectedVariantInventory?.isOutOfStock ??
    (selectedVariantInventory !== undefined
      ? selectedVariantInventory.availableQuantity <= 0
      : activeVariants.length === 0);
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
    <div className="storefront-product-detail-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8" data-testid="product-detail-view">
      {/* 1. Navigation Breadcrumbs */}
      <nav className="storefront-breadcrumbs flex items-center text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider" aria-label="Breadcrumb">
        <ol className="storefront-breadcrumb-list flex items-center gap-2 flex-wrap list-none p-0 m-0">
          <li>
            <a href={`/stores/${encodeURIComponent(storeSlug)}`} className="storefront-breadcrumb-link hover:text-foreground transition-colors">
              {storeName}
            </a>
          </li>
          <li aria-hidden="true" className="storefront-breadcrumb-sep text-border">/</li>
          <li>
            <a href={catalogHref} className="storefront-breadcrumb-link hover:text-foreground transition-colors">
              Products
            </a>
          </li>
          <li aria-hidden="true" className="storefront-breadcrumb-sep text-border">/</li>
          <li aria-current="page" className="storefront-breadcrumb-current text-foreground font-semibold truncate max-w-xs sm:max-w-md">
            {displayProductTitle}
          </li>
        </ol>
      </nav>

      {/* 2. Main Product Layout (Asymmetric 4:5 Gallery Left, Sticky Buying Column Right) */}
      <div className="storefront-product-detail-layout grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start">
        {/* Left Column: Media Gallery (7 cols on lg) */}
        <div className="storefront-product-gallery lg:col-span-7 space-y-4">
          <div className="storefront-product-gallery-main relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-border/70 bg-card/40 backdrop-blur-sm shadow-sm group">
            {currentMedia ? (
              <img
                src={currentMedia.url}
                alt={currentMedia.altText || displayProductTitle}
                className="storefront-gallery-main-image w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                data-testid="main-product-image"
              />
            ) : (
              <div
                className="storefront-gallery-fallback w-full h-full flex flex-col items-center justify-center p-8 text-muted-foreground bg-muted/10"
                role="img"
                aria-label={`No image available for ${displayProductTitle}`}
                data-testid="product-image-fallback"
              >
                <div className="w-16 h-16 rounded-2xl bg-muted/30 border border-border/60 flex items-center justify-center mb-4">
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
                <span className="text-xs font-mono text-muted-foreground/70 mt-1 uppercase tracking-widest">Architectural Studio Archive</span>
              </div>
            )}

            {/* Savings Pill Overlay */}
            {discountPercent !== null && discountPercent > 0 && (
              <div className="absolute top-4 left-4 z-10">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono font-bold bg-destructive text-destructive-foreground shadow-md tracking-wider">
                  SAVE {discountPercent}%
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
            >
              {variantGalleryMedia.map((media: ProductMediaDTO, idx: number) => (
                <button
                  key={media.id || idx}
                  type="button"
                  role="tab"
                  aria-selected={idx === selectedMediaIndex}
                  className={`storefront-gallery-thumb-btn relative shrink-0 w-20 h-24 rounded-2xl overflow-hidden border-2 transition-all cursor-pointer ${
                    idx === selectedMediaIndex
                      ? "storefront-gallery-thumb-btn--active border-primary ring-2 ring-primary/20 scale-102 shadow-md"
                      : "border-border/60 opacity-60 hover:opacity-100 hover:border-border"
                  }`}
                  onClick={() => setSelectedMediaIndex(idx)}
                >
                  <img
                    src={media.url}
                    alt={media.altText || `${displayProductTitle} view ${idx + 1}`}
                    className="storefront-gallery-thumb-img w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Product Purchase Info (5 cols on lg, sticky) */}
        <div className="storefront-product-info lg:col-span-5 lg:sticky lg:top-28">
          <Card className="rounded-3xl border border-border/70 bg-card/70 backdrop-blur-xl shadow-lg shadow-black/5">
            <CardContent className="p-6 sm:p-8 space-y-6">
              {/* Header: Brand Eyebrow, Title, SKU, Stock Status */}
              <div className="storefront-info-header space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
                  <span className="text-xs font-mono font-bold uppercase tracking-widest text-primary">
                    {storeName}
                  </span>
                  {product.typeName && (
                    <>
                      <span className="text-border" aria-hidden="true">•</span>
                      <span className="text-xs font-mono font-medium text-muted-foreground uppercase">
                        {product.typeName}
                      </span>
                    </>
                  )}
                  {product.categoryName && (
                    <>
                      <span className="text-border" aria-hidden="true">•</span>
                      <span className="text-xs font-mono font-medium text-muted-foreground uppercase">
                        {product.categoryName}
                      </span>
                    </>
                  )}
                </div>

                <h1 className="storefront-product-title text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-tight" data-testid="product-title">
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
                    <span className="font-bold text-foreground font-mono">
                      {(product.ratingAverage ?? 0).toFixed(1)}
                    </span>
                    <span className="text-muted-foreground group-hover:underline">
                      ({product.ratingCount} {product.ratingCount === 1 ? "review" : "reviews"})
                    </span>
                  </button>
                )}

                <div className="storefront-status-row flex flex-wrap items-center gap-2.5 pt-1">
                  {isOutOfStock ? (
                    <Badge variant="warning" size="md" data-testid="stock-badge" className="font-semibold">
                      Out of Stock
                    </Badge>
                  ) : isLowStock ? (
                    <Badge variant="warning" size="md" data-testid="stock-badge" className="font-semibold">
                      Only {availableQuantity} left
                    </Badge>
                  ) : (
                    <Badge variant="success" size="md" data-testid="stock-badge" className="font-semibold">
                      In Stock
                    </Badge>
                  )}

                  {maxOrderQuantity !== null && (
                    <span className="text-muted-foreground text-xs font-mono storefront-limit-badge px-2.5 py-0.5 rounded-full bg-muted/60 border border-border/50" data-testid="max-order-limit">
                      Limit {maxOrderQuantity} per order
                    </span>
                  )}

                  {selectedVariant?.sku && (
                    <span className="storefront-sku text-xs text-muted-foreground font-mono" data-testid="product-sku">
                      SKU: {selectedVariant.sku}
                    </span>
                  )}
                </div>
              </div>

              {/* Price Section with Crisp Monospace Typography */}
              <div className="storefront-price-section flex items-baseline gap-3.5 py-4 border-y border-border/60" aria-label="Pricing">
                <span className="storefront-price-main font-mono text-3xl sm:text-4xl font-bold tracking-tight text-foreground" data-testid="product-price">
                  {formatStorePrice(price, currency)}
                </span>
                {hasCompareAt && (
                  <span
                    className="storefront-price-compare font-mono text-base font-medium text-muted-foreground line-through"
                    aria-label={`Was ${formatStorePrice(compareAtPrice, currency)}`}
                  >
                    {formatStorePrice(compareAtPrice, currency)}
                  </span>
                )}
              </div>

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
                      opt.values[0] ||
                      "";

                    return (
                      <fieldset
                        key={opt.id}
                        className="storefront-option-fieldset space-y-2.5"
                      >
                        <legend className="storefront-variant-picker-label text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
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
                                    className="w-7 h-7 rounded-full flex items-center justify-center border border-black/15 shadow-xs relative overflow-hidden"
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
                                  className={`min-h-[38px] px-4 py-2 rounded-xl text-xs font-semibold transition-all relative cursor-pointer ${
                                    isSelected
                                      ? "bg-foreground text-background font-bold shadow-xs ring-2 ring-primary/30"
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
                    <legend className="storefront-variant-picker-label text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
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
                                ? "btn-primary shadow-sm ring-2 ring-primary/25"
                                : "btn-outline hover:border-primary/50 hover:bg-muted/40"
                            } btn-sm storefront-variant-btn rounded-xl px-4 py-2 text-xs font-semibold transition-all`}
                            onClick={() => setSelectedVariantId(variant.id)}
                            data-testid={`variant-btn-${variant.id}`}
                          >
                            {variant.title}
                            {variant.price !== undefined &&
                              variant.price !== price && (
                                <span className="storefront-variant-btn-price ml-1.5 opacity-80 font-mono font-normal">
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
                  <span className="text-muted-foreground text-xs font-mono font-medium">
                    Standard option
                  </span>
                </div>
              )}

              {/* Add to Cart Actions */}
              <div className="storefront-add-to-cart-container space-y-4 pt-2">
                {addSuccess && (
                  <div
                    className="alert alert--success storefront-cart-feedback p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center justify-between"
                    role="status"
                    data-testid="add-to-cart-success"
                  >
                    <span className="flex items-center gap-2">
                      <Check size={16} className="text-emerald-400 shrink-0" />
                      <span>Added {quantity} {quantity === 1 ? "item" : "items"} to cart!</span>
                    </span>
                    <a
                      href={`/stores/${encodeURIComponent(storeSlug)}/cart`}
                      onClick={(e) => {
                        if (cartContext?.openDrawer) {
                          e.preventDefault();
                          cartContext.openDrawer();
                        }
                      }}
                      className="btn btn-outline btn-xs rounded-xl px-3 py-1 text-xs font-semibold cursor-pointer"
                      data-testid="open-cart-after-add"
                    >
                      View in Cart
                    </a>
                  </div>
                )}

                {addError && (
                  <div
                    className="alert alert--danger storefront-cart-feedback p-3.5 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium"
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
                    <div className="cart-quantity-stepper flex items-center rounded-2xl border border-border/80 bg-background/80 p-1 shadow-sm">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm cart-stepper-btn w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold hover:bg-muted"
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
                        className="cart-quantity-input w-12 text-center bg-transparent text-sm font-mono font-semibold text-foreground focus:outline-none"
                        disabled={isOutOfStock || effectiveMaxQuantity <= 0 || isAdding}
                        aria-label="Product quantity"
                        data-testid="quantity-input"
                      />
                      <button
                        type="button"
                        className="btn btn-outline btn-sm cart-stepper-btn w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold hover:bg-muted"
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
                    className="btn btn-primary btn-md storefront-add-to-cart-btn flex-1 h-12 rounded-2xl text-sm font-bold gap-2 shadow-lg shadow-primary/10 hover:shadow-primary/25 active:scale-[0.98] transition-all cursor-pointer"
                    disabled={
                      !selectedVariant ||
                      activeVariants.length === 0 ||
                      isOutOfStock ||
                      effectiveMaxQuantity <= 0 ||
                      isAdding ||
                      cartContext?.isMutating
                    }
                    onClick={async () => {
                      if (
                        !selectedVariant ||
                        activeVariants.length === 0 ||
                        isOutOfStock ||
                        effectiveMaxQuantity <= 0
                      )
                        return;
                      const orderQty = Math.max(
                        1,
                        Math.min(effectiveMaxQuantity, quantity),
                      );
                      if (isAdding || cartContext?.isMutating) return;

                      setIsAdding(true);
                      setAddSuccess(false);
                      setAddError(null);

                      try {
                        if (onAddToCart) {
                          await onAddToCart(selectedVariant.id, orderQty);
                        } else if (cartContext) {
                          await cartContext.addItem(selectedVariant.id, orderQty);
                        }
                        setAddSuccess(true);
                      } catch (err: unknown) {
                        const msg =
                          err instanceof Error ? err.message : "Failed to add item to cart";
                        setAddError(msg);
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
                    ) : (
                      <>
                        <ShoppingBag size={18} />
                        <span>Add to Cart</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Value Props Strip */}
              <div className="grid grid-cols-2 gap-3.5 pt-4 border-t border-border/50 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Truck size={15} className="text-primary shrink-0" />
                  <span>Complimentary shipping over $75</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck size={15} className="text-primary shrink-0" />
                  <span>100% Genuine Guaranteed</span>
                </div>
                <div className="flex items-center gap-2">
                  <RotateCcw size={15} className="text-primary shrink-0" />
                  <span>30-Day Hassle-Free Returns</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles size={15} className="text-primary shrink-0" />
                  <span>Curated Small-Batch Pieces</span>
                </div>
              </div>

              {/* Long-form Description */}
              {product.description && (
                <div className="storefront-description-section pt-4 border-t border-border/50 space-y-2.5">
                  <h2 className="storefront-section-heading text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">
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
                <div className="storefront-tags-section pt-3 border-t border-border/50 space-y-2">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground block">
                    Tags
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {product.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted/60 text-muted-foreground border border-border/50"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Back to Catalog Link */}
              <div className="storefront-back-action pt-2">
                <a
                  href={catalogHref}
                  className="btn btn-outline btn-md storefront-back-btn w-full rounded-2xl justify-center text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-2"
                >
                  <ArrowLeft size={14} />
                  <span>Back to All Products</span>
                </a>
              </div>
            </CardContent>
          </Card>
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
