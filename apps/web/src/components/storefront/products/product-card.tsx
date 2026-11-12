"use client";

import React, { useState } from "react";
import { useOptionalWishlist } from "../../../context/wishlist-context";
import { useOptionalCart } from "../../../context/cart-context";
import { useCurrency } from "../../../context/currency-context";
import type { ProductSummaryDTO } from "@calcart/products";
import { Badge, Spinner } from "@calcart/ui";
import { Star, Heart, Eye, ShoppingBag, Plus } from "lucide-react";

export interface ProductCardProps {
  product: ProductSummaryDTO;
  storeSlug: string;
  storeCurrency?: string;
  layoutMode?: "grid" | "list";
  onQuickView?: (slug: string) => void;
}

/**
 * Format monetary amount in minor units (cents) into a localized currency string.
 */
export function formatStorePrice(
  cents: number | null | undefined,
  currency: string = "USD",
): string {
  if (cents === null || cents === undefined) {
    return "—";
  }
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function ProductCard({
  product,
  storeSlug,
  storeCurrency,
  layoutMode = "grid",
  onQuickView,
}: ProductCardProps) {
  const productHref = product.variantId
    ? `/stores/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(product.slug)}?variant=${encodeURIComponent(product.variantId)}`
    : `/stores/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(product.slug)}`;
  const displayCurrency = product.currency || storeCurrency || "USD";
  const hasPrice = product.price !== null && product.price !== undefined;
  const hasCompareAt =
    product.compareAtPrice !== null &&
    product.compareAtPrice !== undefined &&
    hasPrice &&
    product.compareAtPrice > (product.price ?? 0);
  const isOutOfStock = product.isOutOfStock ?? (product.variantsCount === 0);
  const isLowStock = product.isLowStock ?? false;

  const wishlistContext = useOptionalWishlist();
  const cartContext = useOptionalCart();
  const inWishlist = wishlistContext ? wishlistContext.isInWishlist(product.id, product.variantId) : false;
  const [isWishlisting, setIsWishlisting] = useState(false);
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const { convertPrice } = useCurrency();

  const priceConversion = product.price != null ? convertPrice(product.price) : null;
  const compareAtConversion = product.compareAtPrice != null ? convertPrice(product.compareAtPrice) : null;

  const recordRecentlyViewed = () => {
    if (typeof window === "undefined") return;
    try {
      const key = `cc_${storeSlug}_recently_viewed`;
      const raw = localStorage.getItem(key);
      const existing = raw ? JSON.parse(raw) : [];
      const item = {
        id: product.id,
        slug: product.slug,
        title: product.title,
        price: product.price,
        currency: displayCurrency,
        primaryMediaUrl: product.primaryMediaUrl,
      };
      const filtered = [item, ...existing.filter((x: { id: string }) => x.id !== product.id)].slice(0, 10);
      localStorage.setItem(key, JSON.stringify(filtered));
    } catch {
      // Ignore
    }
  };

  const handleToggleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!wishlistContext) return;
    setIsWishlisting(true);
    try {
      await wishlistContext.toggleWishlist(product.id, product.variantId, {
        productTitle: product.title,
        productSlug: product.slug,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        currency: displayCurrency,
        primaryMediaUrl: product.primaryMediaUrl,
        isOutOfStock,
        variantTitle: product.displayTitle ?? null,
      });
    } catch {
      // Handled
    } finally {
      setIsWishlisting(false);
    }
  };

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // If multiple variants exist, open quick view to allow selecting size/color
    if (product.variantsCount > 1 || !product.variantId) {
      if (onQuickView) {
        onQuickView(product.slug);
      } else {
        window.location.href = productHref;
      }
      return;
    }

    if (!cartContext || isQuickAdding || isOutOfStock) return;
    setIsQuickAdding(true);
    try {
      await cartContext.addItem(product.variantId, 1);
    } catch {
      // Toast notification handles feedback
    } finally {
      setIsQuickAdding(false);
    }
  };

  // Calculate discount percentage if compareAt exists
  const discountPercent =
    hasCompareAt && product.compareAtPrice && product.price
      ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
      : null;

  // --- LIST VIEW LAYOUT ---
  if (layoutMode === "list") {
    return (
      <article
        className="storefront-product-card group relative flex flex-col sm:flex-row overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xs text-card-foreground shadow-xs hover:shadow-lg hover:border-foreground/25 transition-all duration-300 p-4 gap-4 sm:gap-6 items-center"
        data-testid="product-card"
        data-variant-id={product.variantId || undefined}
        data-standalone={product.isStandaloneVariant ? "true" : undefined}
      >
        {/* Media */}
        <div className="relative w-full sm:w-44 aspect-square sm:aspect-square shrink-0 rounded-xl overflow-hidden bg-muted/30">
          <a
            href={productHref}
            onClick={recordRecentlyViewed}
            className="block w-full h-full"
            tabIndex={-1}
            aria-hidden="true"
          >
            {product.primaryMediaUrl ? (
              <img
                src={product.primaryMediaUrl}
                alt={product.primaryMediaAlt || product.title}
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs font-mono">
                No image
              </div>
            )}
          </a>
          {/* Wishlist Button */}
          <button
            type="button"
            onClick={handleToggleWishlist}
            disabled={isWishlisting}
            className="absolute top-2 right-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground backdrop-blur-md transition-all shadow-xs"
            aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart size={14} className={inWishlist ? "fill-primary text-primary" : ""} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2 w-full">
          <div className="flex flex-wrap items-center gap-2">
            {product.typeName && (
              <span className="text-[10px] font-mono font-semibold tracking-wider text-muted-foreground uppercase">
                {product.typeName}
              </span>
            )}
            {product.categoryName && (
              <span className="text-[10px] font-mono text-muted-foreground/70">
                &bull; {product.categoryName}
              </span>
            )}
          </div>

          <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
            <a
              href={productHref}
              onClick={recordRecentlyViewed}
              className="hover:text-primary transition-colors focus:outline-none"
            >
              {product.title}
            </a>
          </h2>

          {Boolean(product.ratingCount && product.ratingCount > 0) && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Star size={12} className="fill-amber-400 text-amber-500" />
              <span className="font-bold text-foreground">{(product.ratingAverage ?? 0).toFixed(1)}</span>
              <span>({product.ratingCount} reviews)</span>
            </div>
          )}

          {/* Badges / Options pill */}
          <div className="flex items-center gap-2 pt-1">
            {isOutOfStock ? (
              <Badge variant="warning" size="sm">Out of Stock</Badge>
            ) : isLowStock ? (
              <Badge variant="warning" size="sm">Low Stock</Badge>
            ) : (
              <Badge variant="success" size="sm">In Stock</Badge>
            )}
            {product.variantsCount > 1 && (
              <span className="text-[11px] font-mono font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                {product.variantsCount} options available
              </span>
            )}
          </div>
        </div>

        {/* Price & Actions on Right */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-48 shrink-0 gap-3 border-t sm:border-t-0 sm:border-l border-border/40 pt-3 sm:pt-0 sm:pl-6">
          <div className="text-left sm:text-right">
            <span className="text-lg font-extrabold text-foreground font-mono block">
              {priceConversion ? priceConversion.presentmentFormatted : "—"}
            </span>
            {hasCompareAt && compareAtConversion && (
              <span className="text-xs font-medium text-muted-foreground line-through font-mono block">
                {compareAtConversion.presentmentFormatted}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onQuickView && (
              <button
                type="button"
                onClick={() => onQuickView(product.slug)}
                className="btn btn-outline btn-sm rounded-xl px-2.5 py-1.5 text-xs"
                title="Quick View"
                aria-label={`Quick view ${product.title}`}
              >
                <Eye size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={handleQuickAdd}
              disabled={isQuickAdding || isOutOfStock}
              className="btn btn-primary btn-sm rounded-xl px-4 py-1.5 text-xs font-bold inline-flex items-center gap-1.5 shadow-xs"
              data-testid="product-card-quick-add"
            >
              {isQuickAdding ? (
                <Spinner size="sm" />
              ) : isOutOfStock ? (
                "Sold Out"
              ) : (
                <>
                  <Plus size={13} />
                  <span>{product.variantsCount > 1 ? "Select Option" : "Add"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </article>
    );
  }

  // --- GRID VIEW LAYOUT (Default) ---
  return (
    <article
      className="storefront-product-card group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xs text-card-foreground shadow-xs hover:shadow-xl hover:shadow-primary/5 hover:border-foreground/25 transition-all duration-300"
      data-testid="product-card"
      data-variant-id={product.variantId || undefined}
      data-standalone={product.isStandaloneVariant ? "true" : undefined}
    >
      {/* 1. Media Container with Portrait Aspect Ratio */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted/30">
        <a
          href={productHref}
          onClick={recordRecentlyViewed}
          className="storefront-product-card-media-link block w-full h-full"
          tabIndex={-1}
          aria-hidden="true"
        >
          {product.primaryMediaUrl ? (
            <img
              src={product.primaryMediaUrl}
              alt={product.primaryMediaAlt || product.title}
              className="storefront-product-card-image w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
              loading="lazy"
            />
          ) : (
            <div
              className="storefront-product-card-fallback w-full h-full flex flex-col items-center justify-center p-6 text-muted-foreground bg-muted/20"
              role="img"
              aria-label={`Image placeholder for ${product.title}`}
            >
              <svg
                className="storefront-product-card-fallback-icon w-10 h-10 stroke-1 opacity-40 mb-2"
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
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="storefront-product-card-fallback-text text-[11px] font-mono uppercase tracking-wider opacity-60">
                No image
              </span>
            </div>
          )}
        </a>

        {/* Status Badge Overlays */}
        <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 flex flex-col items-start gap-1.5 z-10 pointer-events-none">
          {isOutOfStock ? (
            <Badge variant="warning" size="sm" data-testid="product-card-badge" className="font-semibold shadow-xs backdrop-blur-md">
              Out of Stock
            </Badge>
          ) : isLowStock ? (
            <Badge variant="warning" size="sm" data-testid="product-card-badge" className="font-semibold shadow-xs backdrop-blur-md">
              Low Stock
            </Badge>
          ) : (
            <Badge variant="success" size="sm" data-testid="product-card-badge" className="font-semibold shadow-xs backdrop-blur-md">
              In Stock
            </Badge>
          )}
          {discountPercent !== null && discountPercent > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-destructive text-destructive-foreground shadow-xs">
              SAVE {discountPercent}%
            </span>
          )}
        </div>

        {/* Wishlist toggle button */}
        <button
          type="button"
          onClick={handleToggleWishlist}
          disabled={isWishlisting}
          aria-label={inWishlist ? `Remove ${product.title} from wishlist` : `Add ${product.title} to wishlist`}
          aria-pressed={inWishlist}
          className={`absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-90 ${
            inWishlist
              ? "bg-background/95 text-primary shadow-md border border-primary/30"
              : "bg-background/70 text-muted-foreground hover:text-foreground hover:bg-background/90 border border-border/40 shadow-xs"
          }`}
        >
          <Heart
            size={16}
            className={`transition-transform duration-200 ${
              inWishlist ? "fill-primary scale-110" : "scale-100"
            }`}
          />
        </button>

        {/* Hover Quick Actions Bar: Quick View & Quick Add */}
        <div className="absolute inset-x-2.5 bottom-2.5 z-10 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-200 ease-out flex items-center gap-1.5">
          {onQuickView && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onQuickView(product.slug);
              }}
              className="flex-1 py-2 px-2.5 rounded-xl bg-background/95 hover:bg-background backdrop-blur-md text-foreground text-xs font-semibold shadow-lg border border-border/60 flex items-center justify-center gap-1 transition-colors"
              aria-label={`Quick view ${product.title}`}
            >
              <Eye size={13} />
              <span>Preview</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleQuickAdd}
            disabled={isQuickAdding || isOutOfStock}
            className="flex-1 py-2 px-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-lg flex items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-50"
            aria-label={`Quick add ${product.title}`}
            data-testid="product-card-quick-add"
          >
            {isQuickAdding ? (
              <Spinner size="sm" />
            ) : isOutOfStock ? (
              <span>Out of Stock</span>
            ) : (
              <>
                <ShoppingBag size={13} />
                <span>{product.variantsCount > 1 ? "Options" : "Quick Add"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Product Details */}
      <div className="storefront-product-card-body p-3.5 sm:p-4 flex flex-col flex-1 justify-between gap-2.5">
        <div className="storefront-product-card-header space-y-1">
          <div className="flex items-center justify-between gap-2">
            {product.typeName && (
              <span className="text-[10px] font-mono font-semibold tracking-wider text-muted-foreground uppercase block truncate">
                {product.typeName}
              </span>
            )}
            {product.variantsCount > 1 && (
              <span className="text-[10px] font-mono text-muted-foreground/70 shrink-0">
                +{product.variantsCount} options
              </span>
            )}
          </div>
          <h2 className="storefront-product-card-title text-sm sm:text-base font-semibold tracking-tight text-foreground line-clamp-1">
            <a
              href={productHref}
              onClick={recordRecentlyViewed}
              className="storefront-product-card-title-link hover:text-primary transition-colors focus:outline-none"
            >
              {product.title}
            </a>
          </h2>
          {Boolean(product.ratingCount && product.ratingCount > 0) && (
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground pt-0.5">
              <div className="flex items-center text-amber-500">
                <Star size={11} className="fill-amber-400 text-amber-500" />
              </div>
              <span className="font-bold text-foreground">{(product.ratingAverage ?? 0).toFixed(1)}</span>
              <span>({product.ratingCount})</span>
            </div>
          )}
        </div>

        {/* Pricing */}
        <div className="storefront-product-card-pricing flex flex-wrap items-baseline gap-1.5 pt-2 border-t border-border/40" aria-label="Pricing">
          {hasPrice && priceConversion ? (
            <>
              <span className="storefront-product-card-price text-sm sm:text-base font-bold text-foreground font-mono">
                {priceConversion.presentmentFormatted}
              </span>
              {hasCompareAt && compareAtConversion && (
                <span
                  className="storefront-product-card-compare-price text-xs font-medium text-muted-foreground line-through font-mono"
                  aria-label={`Original price ${compareAtConversion.presentmentFormatted}`}
                >
                  {compareAtConversion.presentmentFormatted}
                </span>
              )}
              {priceConversion.isConverted && (
                <span className="text-[11px] font-mono text-muted-foreground/80 block w-full">
                  approx. {priceConversion.baseFormatted}
                </span>
              )}
            </>
          ) : (
            <span className="storefront-product-card-price-unavailable text-xs text-muted-foreground font-medium">
              Price unavailable
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
