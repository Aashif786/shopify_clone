"use client";

import React from "react";
import { motion } from "framer-motion";
import type { ProductSummaryDTO } from "@calcart/products";
import { Alert, Button } from "@calcart/ui";
import { ProductCard } from "./product-card";
import type { ListingContext } from "../../../lib/storefront-variant-selection";
import { RotateCcw } from "lucide-react";

export type CatalogLayoutMode = "grid-4" | "grid-3" | "grid-2" | "list";

export interface ProductGridProps {
  products: ProductSummaryDTO[];
  storeSlug: string;
  storeCurrency?: string;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  isFiltered?: boolean;
  onClearFilters?: () => void;
  layoutMode?: CatalogLayoutMode;
  onQuickView?: (slug: string, context?: ListingContext | null) => void;
  /** @deprecated Suggestion chips were removed: they were hard-coded terms, not store data. */
  onSelectSuggestion?: (query: string) => void;
}

export function ProductGrid({
  products,
  storeSlug,
  storeCurrency,
  isLoading = false,
  error = null,
  onRetry,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  isFiltered = false,
  onClearFilters,
  layoutMode = "grid-4",
  onQuickView,
}: ProductGridProps) {
  // 1. Initial loading: skeleton frames in the same 4:5 ratio as real cards, so nothing jumps.
  if (isLoading) {
    return (
      <div
        className="storefront-grid-state storefront-grid-loading"
        data-testid="catalog-loading"
        aria-busy="true"
        aria-live="polite"
      >
        <p className="sr-only">Loading catalog...</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4 sm:gap-x-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} aria-hidden="true">
              <div className="at-skeleton aspect-[4/5] w-full" />
              <div className="at-skeleton mt-3 h-3 w-1/3" />
              <div className="at-skeleton mt-2 h-4 w-4/5" />
              <div className="at-skeleton mt-2 h-3 w-1/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. Error
  if (error) {
    return (
      <div className="storefront-grid-state mx-auto max-w-xl py-16" data-testid="catalog-error">
        <Alert
          variant="danger"
          title="Unable to load products"
          action={
            onRetry ? (
              <Button variant="outline" size="sm" onClick={onRetry} data-testid="catalog-retry-button">
                Try Again
              </Button>
            ) : undefined
          }
        >
          {error.message || "An error occurred while loading the product catalog."}
        </Alert>
      </div>
    );
  }

  // 3. Empty: a plain typographic statement with one way out.
  if (products.length === 0) {
    return (
      <div className="storefront-grid-state border-y border-[color:var(--at-hairline)] py-20 text-center" data-testid="catalog-empty">
        <p className="at-eyebrow text-muted-foreground">{isFiltered ? "No results" : "Nothing here yet"}</p>
        <h2 className="at-display-md mx-auto mt-3 max-w-lg text-foreground">
          {isFiltered ? "No matching products found" : "No products available"}
        </h2>
        <p className="at-lede mx-auto mt-4 max-w-md text-muted-foreground">
          {isFiltered
            ? "Nothing matches this combination of filters. Try widening your criteria."
            : "This store does not have any published products at the moment. Please check back later!"}
        </p>
        {isFiltered && (
          <button
            type="button"
            onClick={onClearFilters}
            data-testid="empty-clear-filters-btn"
            className="mt-8 ds-btn ds-btn-outline"
          >
            <RotateCcw size={13} strokeWidth={1.5} aria-hidden="true" />
            Clear all filters
          </button>
        )}
      </div>
    );
  }

  // 4. Layout
  const gridLayoutClass =
    {
      "grid-4": "grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4",
      "grid-3": "grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3",
      "grid-2": "grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2",
      list: "flex flex-col",
    }[layoutMode] || "grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4";

  // 5. Products Grid
  return (
    <div className="storefront-catalog-container space-y-12">
      <div
        className={`storefront-product-grid ${gridLayoutClass}`}
        role="region"
        aria-label="Products"
        data-testid="product-grid"
      >
        {products.map((product, index) => (
          <motion.div
            key={product.variantId ? `${product.id}-${product.variantId}` : product.id}
            className="h-full min-w-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1], delay: (index % 8) * 0.03 }}
          >
            <ProductCard
              product={product}
              storeSlug={storeSlug}
              storeCurrency={storeCurrency}
              layoutMode={layoutMode === "list" ? "list" : "grid"}
              onQuickView={onQuickView}
            />
          </motion.div>
        ))}
      </div>

      {/* Pagination / Load more */}
      {hasMore && (
        <div className="storefront-pagination-container flex justify-center border-t border-[color:var(--at-hairline)] pt-10">
          <Button
            variant="outline"
            size="md"
            onClick={onLoadMore}
            loading={isLoadingMore}
            disabled={isLoadingMore}
            aria-label="Load more products"
            data-testid="catalog-load-more"
            className="at-press rounded-none border-foreground px-10 text-xs font-medium uppercase tracking-[0.12em]"
          >
            {isLoadingMore ? "Loading more..." : "Load More Products"}
          </Button>
        </div>
      )}
    </div>
  );
}
