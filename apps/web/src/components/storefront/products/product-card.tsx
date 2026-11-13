"use client";

import Link from "next/link";
import React, { useRef, useState } from "react";
import { useOptionalWishlist } from "../../../context/wishlist-context";
import { useOptionalCart } from "../../../context/cart-context";
import { useCurrency } from "../../../context/currency-context";
import type { ProductSummaryDTO } from "@calcart/products";
import { Spinner } from "@calcart/ui";
import { Heart, Eye, Star } from "lucide-react";
import { StorefrontImage } from "../storefront-image";
import { createSingleFlight, getProductCardAction } from "../../../lib/storefront-variant-selection";

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

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary";

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
  const isOutOfStock = product.isOutOfStock ?? product.variantsCount === 0;
  const isLowStock = product.isLowStock ?? false;

  const wishlistContext = useOptionalWishlist();
  const cartContext = useOptionalCart();
  const inWishlist = wishlistContext
    ? wishlistContext.isInWishlist(product.id, product.variantId)
    : false;
  const [isWishlisting, setIsWishlisting] = useState(false);
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const quickAddFlight = useRef(createSingleFlight());
  const cardAction = getProductCardAction({ ...product, isOutOfStock });
  const { convertPrice } = useCurrency();

  const priceConversion = product.price != null ? convertPrice(product.price) : null;
  const compareAtConversion =
    product.compareAtPrice != null ? convertPrice(product.compareAtPrice) : null;

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

    // Only an unambiguous, in-stock purchasable variant may be added directly. Anything else
    // (several variants, a published listing with options left to pick, missing data) opens
    // the option-selection entry point with the product/listing context preserved.
    if (cardAction.kind === "choose") {
      if (onQuickView) {
        onQuickView(product.slug);
      } else {
        window.location.href = productHref;
      }
      return;
    }

    if (cardAction.kind !== "add" || !cartContext) return;
    const { variantId } = cardAction;
    // Single-flight: a second click before the first request settles is ignored entirely.
    await quickAddFlight.current(async () => {
      setIsQuickAdding(true);
      try {
        await cartContext.addItem(variantId, 1);
      } catch {
        // Toast notification handles feedback; no other variant is ever substituted.
      } finally {
        setIsQuickAdding(false);
      }
    });
  };

  const discountPercent =
    hasCompareAt && product.compareAtPrice && product.price
      ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
      : null;

  const isList = layoutMode === "list";

  const statusLabel = isOutOfStock ? "Out of Stock" : isLowStock ? "Low Stock" : "In Stock";
  const statusTone = isOutOfStock
    ? "bg-muted-foreground"
    : isLowStock
      ? "bg-destructive"
      : "bg-primary";
  const addLabel =
    cardAction.kind === "sold_out"
      ? "Sold out"
      : cardAction.kind === "choose"
        ? "Choose options"
        : "Add to cart";

  const imageFallback = (
    <div
      className="storefront-product-card-fallback flex h-full w-full items-center justify-center p-6 text-muted-foreground"
      role="img"
      aria-label={`Image placeholder for ${product.title}`}
    >
      <span className="storefront-product-card-fallback-text at-eyebrow opacity-70">No image</span>
    </div>
  );

  const media = (
    <div
      className={`ds-media ${isList ? "w-28 shrink-0 sm:w-44" : "w-full"}`}
    >
      <Link
        href={productHref}
        onClick={recordRecentlyViewed}
        className="storefront-product-card-media-link block h-full w-full"
        tabIndex={-1}
        aria-hidden="true"
      >
        {product.primaryMediaUrl ? (
          <StorefrontImage
            src={product.primaryMediaUrl}
            alt={product.primaryMediaAlt || product.title}
            className="storefront-product-card-image h-full w-full object-cover object-center transition-transform duration-[600ms] ease-[var(--at-ease-out)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.03]"
            fallback={imageFallback}
          />
        ) : (
          imageFallback
        )}
      </Link>

      {discountPercent !== null && discountPercent > 0 && (
        <span className="ds-badge at-num pointer-events-none absolute left-0 top-0 px-2 py-1 text-[11px] font-medium tracking-wide">
          −{discountPercent}%
        </span>
      )}

      <button
        type="button"
        onClick={handleToggleWishlist}
        disabled={isWishlisting}
        aria-label={inWishlist ? `Remove ${product.title} from wishlist` : `Add ${product.title} to wishlist`}
        aria-pressed={inWishlist}
        className={`at-press absolute right-1 top-1 z-20 flex h-10 w-10 items-center justify-center text-foreground ${focusRing}`}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-background/85">
          <Heart
            size={15}
            strokeWidth={1.5}
            className={inWishlist ? "fill-primary text-primary" : ""}
            aria-hidden="true"
          />
        </span>
      </button>

      {!isList && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex translate-y-full border-t border-[color:var(--at-hairline)] bg-background transition-transform duration-200 ease-[var(--at-ease-out)] group-focus-within:translate-y-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-y-0 [@media(hover:none)]:translate-y-0">
          {onQuickView && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onQuickView(product.slug);
              }}
              className={`at-press inline-flex h-11 w-11 shrink-0 items-center justify-center border-r border-[color:var(--at-hairline)] text-foreground ${focusRing}`}
              aria-label={`Quick view ${product.title}`}
            >
              <Eye size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={handleQuickAdd}
            disabled={isQuickAdding || cardAction.kind === "sold_out"}
            className={`at-press inline-flex h-11 flex-1 items-center justify-center text-xs font-medium uppercase tracking-[0.12em] text-foreground disabled:text-muted-foreground ${focusRing}`}
            aria-label={`Quick add ${product.title}`}
            data-testid="product-card-quick-add"
          >
            {isQuickAdding ? <Spinner size="sm" /> : addLabel}
          </button>
        </div>
      )}
    </div>
  );

  const details = (
    <div className={`min-w-0 ${isList ? "flex-1 space-y-2 py-1" : "pt-3"}`}>
      {(product.typeName || product.variantsCount > 1) && (
        <div className="flex items-baseline justify-between gap-3">
          {product.typeName ? (
            <span className="at-eyebrow block truncate text-muted-foreground">{product.typeName}</span>
          ) : (
            <span />
          )}
          {product.variantsCount > 1 && (
            <span className="at-num shrink-0 text-[11px] text-muted-foreground">
              {product.variantsCount} options
            </span>
          )}
        </div>
      )}

      <h2 className="storefront-product-card-title at-title mt-1 text-[17px] leading-snug text-foreground">
        <Link
          href={productHref}
          onClick={recordRecentlyViewed}
          className="storefront-product-card-title-link at-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {product.title}
        </Link>
      </h2>

      <div
        className="storefront-product-card-pricing mt-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5"
        aria-label="Pricing"
      >
        {hasPrice && priceConversion ? (
          <>
            <span className="storefront-product-card-price at-num text-sm font-medium text-foreground">
              {priceConversion.presentmentFormatted}
            </span>
            {hasCompareAt && compareAtConversion && (
              <span
                className="storefront-product-card-compare-price at-num text-xs text-muted-foreground line-through"
                aria-label={`Original price ${compareAtConversion.presentmentFormatted}`}
              >
                {compareAtConversion.presentmentFormatted}
              </span>
            )}
            {priceConversion.isConverted && (
              <span className="at-num block w-full text-[11px] text-muted-foreground">
                approx. {priceConversion.baseFormatted}
              </span>
            )}
          </>
        ) : (
          <span className="storefront-product-card-price-unavailable text-xs text-muted-foreground">
            Price unavailable
          </span>
        )}
      </div>

      {Boolean(product.ratingCount && product.ratingCount > 0) && (
        <p className="at-num mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Star size={11} strokeWidth={1.5} className="fill-foreground text-foreground" aria-hidden="true" />
          <span className="text-foreground">{(product.ratingAverage ?? 0).toFixed(1)}</span>
          <span>({product.ratingCount})</span>
        </p>
      )}

      <p
        className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground"
        data-testid="product-card-badge"
      >
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusTone}`} aria-hidden="true" />
        {statusLabel}
      </p>

      {isList && (
        <div className="flex items-center gap-4 pt-2">
          <button
            type="button"
            onClick={handleQuickAdd}
            disabled={isQuickAdding || cardAction.kind === "sold_out"}
            className="at-press inline-flex h-9 items-center border border-foreground px-4 text-xs font-medium uppercase tracking-[0.12em] text-foreground disabled:border-border disabled:text-muted-foreground"
            data-testid="product-card-quick-add"
          >
            {isQuickAdding ? <Spinner size="sm" /> : addLabel}
          </button>
          {onQuickView && (
            <button
              type="button"
              onClick={() => onQuickView(product.slug)}
              className="at-link text-xs text-foreground"
              aria-label={`Quick view ${product.title}`}
            >
              Quick view
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <article
      className={`storefront-product-card group relative text-foreground ${isList ? "flex gap-4 border-b border-[color:var(--at-hairline)] py-5 sm:gap-6" : "flex flex-col"}`}
      data-testid="product-card"
      data-variant-id={product.variantId || undefined}
      data-standalone={product.isStandaloneVariant ? "true" : undefined}
    >
      {media}
      {details}
    </article>
  );
}
