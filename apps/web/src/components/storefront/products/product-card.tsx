import React from "react";
import type { ProductSummaryDTO } from "@shopify-clone/products";
import { Badge } from "@shopify-clone/ui";

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
  const isAvailable = product.variantsCount > 0;

  return (
    <article className="storefront-product-card card" data-testid="product-card">
      {/* Product Image / Fallback Container */}
      <a
        href={productHref}
        className="storefront-product-card-media-link"
        tabIndex={-1}
        aria-hidden="true"
      >
        {product.primaryMediaUrl ? (
          <img
            src={product.primaryMediaUrl}
            alt={product.primaryMediaAlt || product.title}
            className="storefront-product-card-image"
            loading="lazy"
          />
        ) : (
          <div
            className="storefront-product-card-fallback"
            role="img"
            aria-label={`Image placeholder for ${product.title}`}
          >
            <svg
              className="storefront-product-card-fallback-icon"
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
            <span className="storefront-product-card-fallback-text">No image</span>
          </div>
        )}
      </a>

      {/* Product Details */}
      <div className="storefront-product-card-body card-body">
        <div className="storefront-product-card-header">
          <h2 className="storefront-product-card-title">
            <a href={productHref} className="storefront-product-card-title-link">
              {product.title}
            </a>
          </h2>
          {isAvailable ? (
            <Badge variant="success" size="sm">
              In Stock
            </Badge>
          ) : (
            <Badge variant="warning" size="sm">
              Unavailable
            </Badge>
          )}
        </div>

        {/* Pricing */}
        <div className="storefront-product-card-pricing" aria-label="Pricing">
          {hasPrice ? (
            <>
              <span className="storefront-product-card-price">
                {formatStorePrice(product.price, displayCurrency)}
              </span>
              {hasCompareAt && (
                <span
                  className="storefront-product-card-compare-price"
                  aria-label={`Original price ${formatStorePrice(product.compareAtPrice, displayCurrency)}`}
                >
                  {formatStorePrice(product.compareAtPrice, displayCurrency)}
                </span>
              )}
            </>
          ) : (
            <span className="storefront-product-card-price-unavailable">
              Price unavailable
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
