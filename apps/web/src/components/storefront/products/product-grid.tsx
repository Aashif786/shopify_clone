import React from "react";
import type { ProductSummaryDTO } from "@shopify-clone/products";
import { Alert, Button, EmptyState, Spinner } from "@shopify-clone/ui";
import { ProductCard } from "./product-card";

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
}: ProductGridProps) {
  // 1. Initial Loading State
  if (isLoading) {
    return (
      <div
        className="storefront-grid-state storefront-grid-loading"
        data-testid="catalog-loading"
        aria-busy="true"
        aria-live="polite"
      >
        <Spinner size="lg" />
        <p className="storefront-grid-loading-text">Loading catalog...</p>
      </div>
    );
  }

  // 2. Error State
  if (error) {
    return (
      <div className="storefront-grid-state" data-testid="catalog-error">
        <Alert
          variant="danger"
          title="Unable to load products"
          action={
            onRetry ? (
              <Button variant="outline" size="sm" onClick={onRetry}>
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
      <div className="storefront-grid-state" data-testid="catalog-empty">
        <EmptyState
          title="No products available"
          description="This store does not have any published products at the moment. Please check back later!"
        />
      </div>
    );
  }

  // 4. Products Grid
  return (
    <div className="storefront-catalog-container">
      <div
        className="storefront-product-grid"
        role="region"
        aria-label="Products"
        data-testid="product-grid"
      >
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            storeSlug={storeSlug}
            storeCurrency={storeCurrency}
          />
        ))}
      </div>

      {/* Pagination / Load More */}
      {hasMore && (
        <div className="storefront-pagination-container">
          <Button
            variant="outline"
            size="md"
            onClick={onLoadMore}
            loading={isLoadingMore}
            disabled={isLoadingMore}
            aria-label="Load more products"
          >
            {isLoadingMore ? "Loading more..." : "Load More Products"}
          </Button>
        </div>
      )}
    </div>
  );
}
