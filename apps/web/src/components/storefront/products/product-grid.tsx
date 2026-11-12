"use client";

import React from "react";
import { motion } from "framer-motion";
import type { ProductSummaryDTO } from "@calcart/products";
import { Alert, Button } from "@calcart/ui";
import { ProductCard } from "./product-card";
import { Sparkles, RotateCcw, Search } from "lucide-react";

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
  onQuickView?: (slug: string) => void;
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
  // 1. Initial Loading State: Skeletons + Spinner indicator
  if (isLoading) {
    return (
      <div
        className="storefront-grid-state storefront-grid-loading py-6 flex flex-col items-center justify-center text-center space-y-8"
        data-testid="catalog-loading"
        aria-busy="true"
        aria-live="polite"
      >
        <p className="sr-only">Loading catalog items...</p>

        {/* Skeleton Grid Preview */}
        <div className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border/40 bg-card/30 overflow-hidden space-y-3 p-3 animate-pulse"
            >
              <div className="aspect-[3/4] w-full rounded-xl bg-muted/60" />
              <div className="space-y-2 py-2">
                <div className="h-2.5 w-1/3 rounded bg-muted/70" />
                <div className="h-3.5 w-4/5 rounded bg-muted" />
                <div className="h-3 w-1/4 rounded bg-muted/70 pt-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. Error State
  if (error) {
    return (
      <div className="storefront-grid-state max-w-xl mx-auto py-16 px-4" data-testid="catalog-error">
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

  // 3. Empty State with Interactive Recovery
  if (products.length === 0) {
    return (
      <div className="storefront-grid-state max-w-xl mx-auto py-16 px-4 text-center" data-testid="catalog-empty">
        <div className="rounded-3xl border border-dashed border-border/80 bg-card/60 backdrop-blur-xs p-8 sm:p-12 space-y-5 shadow-xs">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-muted/60 border border-border/80 flex items-center justify-center text-muted-foreground">
            {isFiltered ? <Search size={24} className="text-primary" /> : <Sparkles size={24} />}
          </div>

          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
              {isFiltered ? "No matching products found" : "No products available"}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              {isFiltered
                ? "We couldn't find any products matching your current combination of filters. Try broadening your criteria or reset filters."
                : "This store does not have any published products at the moment. Please check back later!"}
            </p>
          </div>

          {/* Recovery Options for Filtered State */}
          {isFiltered && (
            <div className="pt-2 space-y-4">
              <div className="flex justify-center">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onClearFilters}
                  data-testid="empty-clear-filters-btn"
                  className="rounded-xl px-5 font-bold inline-flex items-center gap-1.5"
                >
                  <RotateCcw size={13} />
                  <span>Clear All Filters</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. Determine Grid Layout Classes
  const gridLayoutClass = {
    "grid-4": "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6",
    "grid-3": "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8",
    "grid-2": "grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8",
    "list": "flex flex-col gap-4",
  }[layoutMode] || "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6";

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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
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

      {/* Pagination / Load More */}
      {hasMore && (
        <div className="storefront-pagination-container flex justify-center pt-8 pb-4">
          <Button
            variant="outline"
            size="md"
            onClick={onLoadMore}
            loading={isLoadingMore}
            disabled={isLoadingMore}
            aria-label="Load more products"
            data-testid="catalog-load-more"
            className="rounded-full px-8 py-2.5 text-xs font-semibold uppercase tracking-wider shadow-xs hover:border-foreground/30 hover:bg-muted/50 transition-[background-color,border-color] cursor-pointer"
          >
            {isLoadingMore ? "Loading more..." : "Load More Products"}
          </Button>
        </div>
      )}
    </div>
  );
}
