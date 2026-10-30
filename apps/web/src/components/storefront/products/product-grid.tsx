import React from "react";
import type { ProductSummaryDTO } from "@calcart/products";
import { Alert, Button, EmptyState, Spinner } from "@calcart/ui";
import { ProductCard } from "./product-card";
import { Sparkles } from "lucide-react";

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
}: ProductGridProps) {
  // 1. Initial Loading State: Skeletons + Spinner indicator
  if (isLoading) {
    return (
      <div
        className="storefront-grid-state storefront-grid-loading py-12 flex flex-col items-center justify-center text-center space-y-8"
        data-testid="catalog-loading"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="p-3.5 rounded-2xl bg-card border border-border/60 shadow-xs">
            <Spinner size="lg" />
          </div>
          <p className="storefront-grid-loading-text text-xs font-mono font-medium tracking-wider uppercase text-muted-foreground animate-pulse">
            Loading catalog...
          </p>
        </div>

        {/* Skeleton Grid Preview */}
        <div className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 opacity-60">
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

  // 3. Empty State
  if (products.length === 0) {
    return (
      <div className="storefront-grid-state max-w-xl mx-auto py-20 px-4 text-center" data-testid="catalog-empty">
        <div className="rounded-3xl border border-dashed border-border/80 bg-muted/20 p-10 sm:p-14 space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
            <Sparkles size={22} />
          </div>
          <EmptyState
            title={isFiltered ? "No matching products found" : "No products available"}
            description={
              isFiltered
                ? "We couldn't find any products matching your criteria. Try adjusting your search query, price range, or filter options."
                : "This store does not have any published products at the moment. Please check back later!"
            }
            action={
              isFiltered && onClearFilters ? (
                <Button variant="outline" size="sm" onClick={onClearFilters} data-testid="empty-clear-filters-btn">
                  Clear Filters
                </Button>
              ) : undefined
            }
          />
        </div>
      </div>
    );
  }

  // 4. Products Grid: 2 columns mobile, 3 tablet, 4 desktop
  return (
    <div className="storefront-catalog-container space-y-12">
      <div
        className="storefront-product-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8"
        role="region"
        aria-label="Products"
        data-testid="product-grid"
      >
        {products.map((product) => (
          <ProductCard
            key={product.variantId ? `${product.id}-${product.variantId}` : product.id}
            product={product}
            storeSlug={storeSlug}
            storeCurrency={storeCurrency}
          />
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
            className="rounded-full px-8 py-2.5 text-xs font-semibold uppercase tracking-wider shadow-xs hover:border-foreground/30 hover:bg-muted/50 transition-all cursor-pointer"
          >
            {isLoadingMore ? "Loading more..." : "Load More Products"}
          </Button>
        </div>
      )}
    </div>
  );
}
