"use client";

import Link from "next/link";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { X, ShoppingBag, ExternalLink } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useOptionalCart } from "../../../context/cart-context";

import { useCurrency } from "../../../context/currency-context";

import { Spinner } from "@calcart/ui";
import type { StorefrontProductDetailDTO, StorefrontVariantDTO } from "./product-detail-view";
import { OptionSelector } from "./option-selector";
import {
  buildListingSelection,
  createSingleFlight,
  describeResolution,
  getMissingOptions,
  getOptionValueState,
  getProductOptionGroups,
  getPurchasableVariants,
  resolveExactVariant,
  submitSelectedVariant,
  type ListingContext,
  type OptionSelection,
} from "../../../lib/storefront-variant-selection";

export interface QuickViewModalProps {
  productSlug: string | null;
  storeSlug: string;
  isOpen: boolean;
  onClose: () => void;
  /** The published listing the customer opened Quick View from, if any. */
  listingContext?: ListingContext | null;
}

export function QuickViewModal({
  productSlug,
  storeSlug,
  isOpen,
  onClose,
  listingContext = null,
}: QuickViewModalProps) {
  const [product, setProduct] = useState<StorefrontProductDetailDTO | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const cartContext = useOptionalCart();

  // Load product detail on open
  useEffect(() => {
    if (!isOpen || !productSlug) {
      setProduct(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    async function loadProduct() {
      try {
        const res = await apiClient.get<{ product: StorefrontProductDetailDTO }>(
          `/api/v1/storefront/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(productSlug!)}`,
        );
        // No variant is selected here: the customer (or the published listing) decides.
        if (isMounted && res.product) setProduct(res.product);
      } catch (err) {
        console.error("Failed to load quick view product:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadProduct();
    return () => {
      isMounted = false;
    };
  }, [isOpen, productSlug, storeSlug]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-view-title"
      data-testid="quick-view-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden border border-[color:var(--at-hairline)] bg-background text-foreground [border-radius:var(--ds-radius-card,0px)] [box-shadow:var(--ds-card-shadow,0_24px_60px_-20px_rgb(0_0_0/0.35))] md:flex-row"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="at-press absolute right-3 top-3 z-20 bg-background/85 p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [border-radius:var(--ds-radius-btn,0px)]"
          aria-label="Close Quick View"
          data-testid="quick-view-close-btn"
        >
          <X size={18} />
        </button>

        {isLoading || !product ? (
          <div className="w-full py-32 flex flex-col items-center justify-center gap-3">
            <Spinner size="lg" />
            <span className="at-eyebrow animate-pulse text-muted-foreground">
              Loading product details...
            </span>
          </div>
        ) : (
          <QuickViewContent
            // A different product or listing starts from its own preselection.
            key={`${product.id}:${JSON.stringify(listingContext)}`}
            product={product}
            storeSlug={storeSlug}
            productSlug={productSlug}
            listingContext={listingContext}
            addItem={cartContext ? (variantId, qty) => cartContext.addItem(variantId, qty) : undefined}
            onAdded={onClose}
            onNavigate={onClose}
          />
        )}
      </motion.div>
    </div>
  );
}

export interface QuickViewContentProps {
  product: StorefrontProductDetailDTO;
  storeSlug: string;
  productSlug: string | null;
  listingContext?: ListingContext | null;
  addItem?: (variantId: string, quantity: number) => Promise<unknown>;
  onAdded?: () => void;
  onNavigate?: () => void;
}

/** Product information, option selectors and add-to-cart for Quick View (no fetching). */
export function QuickViewContent({
  product,
  storeSlug,
  productSlug,
  listingContext = null,
  addItem,
  onAdded,
  onNavigate,
}: QuickViewContentProps) {
  const { convertPrice } = useCurrency();
  const activeVariants = useMemo(() => getPurchasableVariants(product.variants), [product.variants]);
  // A product with a single purchasable variant has nothing for the customer to choose.
  const options = useMemo(
    () =>
      activeVariants.length > 1
        ? getProductOptionGroups(product.options, activeVariants, product.id)
        : [],
    [product.options, product.id, activeVariants],
  );

  // Only what the published listing defines is preselected; everything else is the customer's choice.
  const [selection, setSelection] = useState<OptionSelection>(() =>
    buildListingSelection(options, activeVariants, listingContext),
  );
  const [selectedImage, setSelectedImage] = useState<string | null>(product.media?.[0]?.url ?? null);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flight = useRef(createSingleFlight());

  const resolution = resolveExactVariant<StorefrontVariantDTO>(activeVariants, options, selection);
  const selectedVariant =
    resolution.status === "resolved" || resolution.status === "unavailable" ? resolution.variant : null;
  const missingOptions = getMissingOptions(options, selection);
  const blockedReason = describeResolution(resolution);
  const canAdd = resolution.status === "resolved" && Boolean(addItem);

  // Price: exact when resolved; otherwise only a range derived from real variant prices.
  const prices = activeVariants.map((v) => v.price);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const pricesDiffer = prices.length > 0 && Math.max(...prices) !== minPrice;
  const price = selectedVariant?.price ?? minPrice;
  const showFrom = !selectedVariant && pricesDiffer;
  const compareAtPrice = selectedVariant?.compareAtPrice ?? null;
  const hasCompareAt = compareAtPrice !== null && compareAtPrice > price;
  const priceConversion = convertPrice(price);
  const compareAtConversion = compareAtPrice !== null ? convertPrice(compareAtPrice) : null;

  const inventory = selectedVariant?.inventory;
  const isOutOfStock = resolution.status === "unavailable";
  const maxQuantity = inventory?.effectiveMaxQuantity ?? 99;

  const handleSelect = (optionName: string, value: string) => {
    setSelection((prev) => ({ ...prev, [optionName]: value }));
    setError(null);
    setQuantity(1);
  };

  const handleAddToCart = async () => {
    if (isAdding) return;
    if (!addItem) {
      setError("Cart is unavailable right now.");
      return;
    }
    setError(null);
    setIsAdding(true);
    try {
      const result = await submitSelectedVariant({
        variants: activeVariants,
        options,
        selection,
        quantity,
        addItem,
        flight: flight.current,
      });
      if (result.status === "added") onAdded?.();
      else if (result.status === "rejected" || result.status === "failed") setError(result.message);
    } finally {
      setIsAdding(false);
    }
  };

  const productUrl = `/stores/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(productSlug || product.slug)}`;

  return (
    <>
      {/* Left Column: Image Gallery Preview */}
      <div className="flex w-full flex-col justify-between border-b border-[color:var(--at-hairline)] bg-muted/30 p-6 md:w-1/2 md:border-b-0 md:border-r">
        <div className="ds-media w-full">
          {selectedImage ? (
            <img src={selectedImage} alt={product.title} className="w-full h-full object-cover object-center" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <ShoppingBag size={48} className="opacity-30" />
            </div>
          )}
          {hasCompareAt && (
            <span className="ds-badge at-num pointer-events-none absolute left-0 top-0 px-2 py-1 text-[11px] font-medium tracking-wide">
              Sale
            </span>
          )}
        </div>

        {/* Thumbnail Strip */}
        {product.media && product.media.length > 1 && (
          <div className="flex gap-2 pt-4 overflow-x-auto scrollbar-none">
            {product.media.map((med) => (
              <button
                key={med.id}
                type="button"
                onClick={() => setSelectedImage(med.url)}
                aria-label="Show product image"
                className={`relative h-14 w-14 shrink-0 overflow-hidden border-2 transition-[opacity,border-color] [border-radius:var(--ds-radius-media,0px)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  selectedImage === med.url
                    ? "border-foreground"
                    : "border-[color:var(--at-hairline)] opacity-70 hover:opacity-100"
                }`}
              >
                <img src={med.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right Column: Product Actions */}
      <div className="flex w-full flex-col justify-between overflow-y-auto p-6 sm:p-8 md:w-1/2">
        <div className="space-y-4">
          {product.typeName && (
            <span className="at-eyebrow block text-muted-foreground">
              {product.typeName}
            </span>
          )}

          <h2 id="quick-view-title" className="at-title text-2xl leading-snug text-foreground sm:text-[1.75rem]">
            {product.title}
          </h2>

          {/* Pricing */}
          <div className="flex items-baseline gap-2.5" data-testid="quick-view-price">
            {showFrom && <span className="text-xs text-muted-foreground">From</span>}
            <span className="at-num text-xl font-medium text-foreground">
              {priceConversion.presentmentFormatted}
            </span>
            {hasCompareAt && compareAtConversion && (
              <span className="at-num text-sm text-muted-foreground line-through">
                {compareAtConversion.presentmentFormatted}
              </span>
            )}
            {/* Stock is only stated for an exactly resolved variant with real inventory data. */}
            {selectedVariant && inventory && (
              <span
                className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
                data-testid="quick-view-stock"
              >
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    isOutOfStock ? "bg-muted-foreground" : inventory.isLowStock ? "bg-destructive" : "bg-primary"
                  }`}
                  aria-hidden="true"
                />
                {isOutOfStock
                  ? "Out of Stock"
                  : inventory.isLowStock
                    ? `Only ${inventory.availableQuantity} left`
                    : "In Stock"}
              </span>
            )}
          </div>

          {/* Short Description */}
          {product.description && (
            <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {product.description}
            </p>
          )}

          {/* Option selectors: one per option group, never one per combination */}
          {options.length > 0 && (
            <div className="space-y-4 pt-2" data-testid="quick-view-options">
              {options.map((opt) => (
                <OptionSelector
                  key={opt.id}
                  option={opt}
                  value={
                    Object.entries(selection).find(([k]) => k.toLowerCase() === opt.name.toLowerCase())?.[1] ?? ""
                  }
                  onChange={handleSelect}
                  isRequiredMissing={missingOptions.includes(opt.name)}
                  getValueState={(val) => getOptionValueState(activeVariants, options, selection, opt.name, val)}
                />
              ))}
            </div>
          )}

          {/* Quantity Stepper */}
          <div className="space-y-2 pt-2">
            <label className="text-xs font-semibold text-foreground block" id="quick-view-qty-label">
              Quantity
            </label>
            <div
              className="inline-flex items-center border border-[color:var(--at-hairline)] bg-background p-1 [border-radius:var(--ds-radius-input,0px)]"
              role="group"
              aria-labelledby="quick-view-qty-label"
            >
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
                className="flex h-8 w-8 items-center justify-center text-xs font-medium transition-colors hover:bg-muted disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary [border-radius:var(--ds-radius-input,0px)]"
              >
                -
              </button>
              <span className="at-num w-10 text-center text-xs font-medium" aria-live="polite">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(Math.max(1, Math.min(99, maxQuantity)), q + 1))}
                disabled={quantity >= Math.min(99, maxQuantity)}
                aria-label="Increase quantity"
                className="flex h-8 w-8 items-center justify-center text-xs font-medium transition-colors hover:bg-muted disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary [border-radius:var(--ds-radius-input,0px)]"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="mt-6 space-y-3 border-t border-[color:var(--at-hairline)] pt-6">
          {(error || (blockedReason && !isOutOfStock)) && (
            <p
              className="text-xs text-muted-foreground"
              role={error ? "alert" : "status"}
              data-testid="quick-view-selection-hint"
            >
              {error ?? (missingOptions.length > 0 ? `Select ${missingOptions.join(", ")} to continue.` : blockedReason)}
            </p>
          )}
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={isAdding || !canAdd}
            className="ds-btn ds-btn-primary w-full"
            data-testid="quick-view-add-to-cart-btn"
          >
            {isAdding ? (
              <>
                <Spinner size="sm" />
                <span>Adding to cart...</span>
              </>
            ) : isOutOfStock ? (
              "Out of Stock"
            ) : resolution.status === "incomplete" ? (
              `Select ${missingOptions[0]}${missingOptions.length > 1 ? ` +${missingOptions.length - 1}` : ""}`
            ) : resolution.status === "resolved" ? (
              <>
                <ShoppingBag size={16} />
                <span>Add to Cart ({priceConversion.presentmentFormatted})</span>
              </>
            ) : (
              "Unavailable"
            )}
          </button>

          <Link
            href={productUrl}
            onClick={onNavigate}
            className="at-link inline-flex w-full items-center justify-center gap-1.5 pt-1 text-center text-xs text-muted-foreground hover:text-foreground"
          >
            <span>View Full Product Details</span>
            <ExternalLink size={13} />
          </Link>
        </div>
      </div>
    </>
  );
}
