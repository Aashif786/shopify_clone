import React from "react";
import type { ProductSummaryDTO } from "@shopify-clone/products";
import { Alert, Button, EmptyState, Spinner } from "@shopify-clone/ui";
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
  // 1. Initial Loading State
  if (isLoading) {
    return (
      <div
        className="storefront-grid-state storefront-grid-loading py-24 flex flex-col items-center justify-center text-center space-y-4"
        data-testid="catalog-loading"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-sm">
          <Spinner size="lg" />
        </div>
        <p className="storefront-grid-loading-text text-sm font-medium text-muted-foreground animate-pulse">
          Loading catalog...
        </p>
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

  // 4. Products Grid
  return (
    <div className="storefront-catalog-container space-y-12">
      <div
        className="storefront-product-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8"
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
            className="rounded-full px-8 py-2.5 text-sm font-semibold shadow-sm hover:border-primary hover:bg-primary/5 transition-all"
          >
            {isLoadingMore ? "Loading more..." : "Load More Products"}
          </Button>
        </div>
      )}
    </div>
  );
}
