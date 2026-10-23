"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import { ArrowRight, Layers, Package } from "lucide-react";
import type { CollectionDTO } from "@shopify-clone/products";
import { Alert, Button, EmptyState, Spinner } from "@shopify-clone/ui";
import { StorefrontShell } from "../../../../src/components/storefront/StorefrontShell";
import { apiClient, ApiClientError } from "../../../../src/lib/api-client";
import { CartProvider } from "../../../../src/context/cart-context";

interface StoreCollectionsPageProps {
  params: Promise<{ storeSlug: string }>;
}

interface StorefrontCollectionsResponse {
  items: CollectionDTO[];
  total: number;
  store: {
    id: string;
    name: string;
    slug: string;
    currency: string;
  };
}

export default function StoreCollectionsPage({
  params,
}: StoreCollectionsPageProps) {
  const { storeSlug } = use(params);

  const [store, setStore] = useState<{
    id: string;
    name: string;
    slug: string;
    currency: string;
  } | null>(null);
  const [collections, setCollections] = useState<CollectionDTO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiClientError | Error | null>(null);

  const fetchCollections = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.get<StorefrontCollectionsResponse>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/collections`,
      );

      setStore(data.store);
      setCollections(data.items);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err
          : new ApiClientError({
              code: "FETCH_FAILED",
              message: "Failed to load store collections",
              status: 500,
            }),
      );
    } finally {
      setIsLoading(false);
    }
  }, [storeSlug]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const isStoreNotFound =
    error instanceof ApiClientError && error.status === 404;

  if (isStoreNotFound) {
    return (
      <StorefrontShell
        storeName="Store Not Found"
        storeSlug={storeSlug}
        navLinks={[]}
      >
        <div className="storefront-not-found-container max-w-lg mx-auto py-24 px-4 text-center" data-testid="store-not-found">
          <div className="card p-8 rounded-3xl border border-dashed border-border/80 bg-card/60 space-y-4">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Store Unavailable
            </h1>
            <p className="text-sm text-muted-foreground">
              The storefront for &ldquo;{storeSlug}&rdquo; could not be found or is currently not active.
            </p>
            <div className="pt-2">
              <a href="/" className="btn btn-primary btn-md rounded-2xl px-6 py-2.5 text-xs font-semibold">
                Return Home
              </a>
            </div>
          </div>
        </div>
      </StorefrontShell>
    );
  }

  return (
    <CartProvider storeSlug={storeSlug}>
      <StorefrontShell
        storeName={store?.name || "Online Store"}
        storeSlug={storeSlug}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
          <header className="storefront-page-header flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-border/60">
            <div className="storefront-page-header-copy space-y-1">
              <span className="storefront-eyebrow text-xs font-bold uppercase tracking-wider text-primary">Curated Sets</span>
              <h1 className="storefront-page-title text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                Collections
              </h1>
              <p className="storefront-page-subtitle text-sm text-muted-foreground">
                Explore our curated groupings of products, crafted for themes and styles.
              </p>
            </div>
            <div className="storefront-page-header-meta flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/60 text-xs font-semibold text-muted-foreground border border-border/50" aria-label="Collections count">
              <Layers size={14} aria-hidden="true" />
              <span>{collections.length} {collections.length === 1 ? "collection" : "collections"}</span>
            </div>
          </header>

          {/* Loading State */}
          {isLoading && (
            <div
              className="storefront-grid-state storefront-grid-loading py-24 flex flex-col items-center justify-center text-center space-y-3"
              data-testid="collections-loading"
              aria-busy="true"
              aria-live="polite"
            >
              <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-sm inline-block">
                <Spinner size="lg" className="spinner spinner-lg text-primary" />
              </div>
              <p className="storefront-grid-loading-text text-sm font-medium text-muted-foreground animate-pulse">
                Loading collections...
              </p>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="storefront-grid-state max-w-xl mx-auto py-16 px-4" data-testid="collections-error">
              <Alert
                variant="danger"
                title="Unable to load collections"
                action={
                  <Button variant="outline" size="sm" onClick={() => fetchCollections()}>
                    Try Again
                  </Button>
                }
              >
                {error.message || "An error occurred while loading collections."}
              </Alert>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && collections.length === 0 && (
            <div className="storefront-grid-state max-w-xl mx-auto py-20 px-4 text-center" data-testid="collections-empty">
              <div className="rounded-3xl border border-dashed border-border/80 bg-muted/20 p-10 space-y-4">
                <EmptyState
                  title="No collections available"
                  description="This store does not have any active collections at the moment. Browse all products instead!"
                  action={
                    <a
                      href={`/stores/${encodeURIComponent(storeSlug)}/products`}
                      className="btn btn-primary btn-sm rounded-xl px-5 py-2 text-xs font-semibold"
                    >
                      View All Products
                    </a>
                  }
                />
              </div>
            </div>
          )}

          {/* Collections Grid */}
          {!isLoading && !error && collections.length > 0 && (
            <div
              className="storefront-collections-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8"
              role="region"
              aria-label="Collections"
              data-testid="collections-grid"
            >
              {collections.map((col) => (
                <a
                  key={col.id}
                  href={`/stores/${encodeURIComponent(storeSlug)}/collections/${encodeURIComponent(col.slug)}`}
                  className="storefront-collection-card group relative flex flex-col justify-between p-6 sm:p-8 rounded-3xl border border-border/70 bg-card/80 backdrop-blur-md hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
                  data-testid={`collection-card-${col.slug}`}
                >
                  <div className="space-y-3">
                    <div className="storefront-collection-card-header flex items-center justify-between gap-2">
                      <h2 className="storefront-collection-card-title text-xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                        {col.title}
                      </h2>
                      <span className="storefront-collection-card-count inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border/50">
                        <Package size={12} />
                        <span>{col.productCount} {col.productCount === 1 ? "product" : "products"}</span>
                      </span>
                    </div>
                    {col.description && (
                      <p className="storefront-collection-card-desc text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-3">
                        {col.description}
                      </p>
                    )}
                  </div>

                  <div className="storefront-collection-card-action pt-6 flex items-center gap-1.5 text-xs font-bold text-primary group-hover:translate-x-1 transition-transform">
                    <span>Explore Collection</span>
                    <ArrowRight size={14} />
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </StorefrontShell>
    </CartProvider>
  );
}
