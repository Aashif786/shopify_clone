import React from "react";
import type { ProductSummaryDTO } from "@shopify-clone/products";
import { Badge } from "@shopify-clone/ui";
import { ArrowUpRight } from "lucide-react";

export interface ProductCardProps {
  product: ProductSummaryDTO;
  storeSlug: string;
  storeCurrency?: string;
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
}: ProductCardProps) {
  const productHref = `/stores/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(product.slug)}`;
  const displayCurrency = product.currency || storeCurrency || "USD";
  const hasPrice = product.price !== null && product.price !== undefined;
  const hasCompareAt =
    product.compareAtPrice !== null &&
    product.compareAtPrice !== undefined &&
    hasPrice &&
    product.compareAtPrice > (product.price ?? 0);
  const isOutOfStock = product.isOutOfStock ?? (product.variantsCount === 0);
  const isLowStock = product.isLowStock ?? false;

  // Calculate discount percentage if compareAt exists
  const discountPercent =
    hasCompareAt && product.compareAtPrice && product.price
      ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
      : null;

  return (
    <article
      className="storefront-product-card card group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card text-card-foreground shadow-sm hover:shadow-xl hover:shadow-primary/5 hover:border-primary/40 transition-all duration-300"
      data-testid="product-card"
    >
      {/* 1. Media Container */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted/40">
        <a
          href={productHref}
          className="storefront-product-card-media-link block w-full h-full"
          tabIndex={-1}
          aria-hidden="true"
        >
          {product.primaryMediaUrl ? (
            <img
              src={product.primaryMediaUrl}
              alt={product.primaryMediaAlt || product.title}
              className="storefront-product-card-image w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
              loading="lazy"
            />
          ) : (
            <div
              className="storefront-product-card-fallback w-full h-full flex flex-col items-center justify-center p-6 text-muted-foreground bg-muted/20"
              role="img"
              aria-label={`Image placeholder for ${product.title}`}
            >
              <svg
                className="storefront-product-card-fallback-icon w-12 h-12 stroke-1 opacity-40 mb-2"
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
              <span className="storefront-product-card-fallback-text text-xs font-medium uppercase tracking-wider opacity-60">
                No image
              </span>
            </div>
          )}
        </a>

        {/* Status Badge Overlays */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10 pointer-events-none">
          {isOutOfStock ? (
            <Badge variant="warning" size="sm" data-testid="product-card-badge" className="font-semibold shadow-sm backdrop-blur-md">
              Out of Stock
            </Badge>
          ) : isLowStock ? (
            <Badge variant="warning" size="sm" data-testid="product-card-badge" className="font-semibold shadow-sm backdrop-blur-md">
              Low Stock
            </Badge>
          ) : (
            <Badge variant="success" size="sm" data-testid="product-card-badge" className="font-semibold shadow-sm backdrop-blur-md">
              In Stock
            </Badge>
          )}
        </div>

        {/* Savings Badge */}
        {discountPercent !== null && discountPercent > 0 && (
          <div className="absolute top-3 right-3 z-10 pointer-events-none">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive text-destructive-foreground shadow-sm">
              SAVE {discountPercent}%
            </span>
          </div>
        )}

        {/* Hover Quick View Pill */}
        <div className="absolute inset-x-3 bottom-3 z-10 translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none">
          <div className="w-full py-2 px-3 rounded-xl bg-background/90 backdrop-blur-md text-foreground text-xs font-semibold shadow-lg border border-border/60 flex items-center justify-center gap-1.5">
            <span>View Product</span>
            <ArrowUpRight size={14} />
          </div>
        </div>
      </div>

      {/* 2. Product Details */}
      <div className="storefront-product-card-body card-body p-4 sm:p-5 flex flex-col flex-1 justify-between gap-3">
        <div className="storefront-product-card-header space-y-1">
          <h2 className="storefront-product-card-title text-base font-semibold tracking-tight text-foreground line-clamp-2">
            <a
              href={productHref}
              className="storefront-product-card-title-link hover:text-primary transition-colors"
            >
              {product.title}
            </a>
          </h2>
        </div>

        {/* Pricing */}
        <div className="storefront-product-card-pricing flex items-baseline gap-2 pt-1 border-t border-border/40" aria-label="Pricing">
          {hasPrice ? (
            <>
              <span className="storefront-product-card-price text-base font-bold text-foreground">
                {formatStorePrice(product.price, displayCurrency)}
              </span>
              {hasCompareAt && (
                <span
                  className="storefront-product-card-compare-price text-xs font-medium text-muted-foreground line-through"
                  aria-label={`Original price ${formatStorePrice(product.compareAtPrice, displayCurrency)}`}
                >
                  {formatStorePrice(product.compareAtPrice, displayCurrency)}
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
