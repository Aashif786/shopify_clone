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
        <div className="storefront-not-found-container" data-testid="store-not-found">
          <div className="card" style={{ maxWidth: "600px", margin: "var(--space-12) auto", padding: "var(--space-8)", textAlign: "center" }}>
            <h1 style={{ fontSize: "var(--font-size-2xl)", marginBottom: "var(--space-2)" }}>
              Store Unavailable
            </h1>
            <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--space-6)" }}>
              The storefront for &ldquo;{storeSlug}&rdquo; could not be found or is currently not active.
            </p>
            <a href="/" className="btn btn-primary btn-md">
              Return Home
            </a>
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
        <header className="storefront-page-header">
          <div className="storefront-page-header-copy">
            <span className="storefront-eyebrow">Curated Sets</span>
            <h1 className="storefront-page-title">Collections</h1>
            <p className="storefront-page-subtitle">
              Explore our curated groupings of products, crafted for themes and styles.
            </p>
          </div>
          <div className="storefront-page-header-meta" aria-label="Collections count">
            <Layers size={14} aria-hidden="true" />
            {collections.length} {collections.length === 1 ? "collection" : "collections"}
          </div>
        </header>

        {/* Loading State */}
        {isLoading && (
          <div
            className="storefront-grid-state storefront-grid-loading"
            data-testid="collections-loading"
            aria-busy="true"
            aria-live="polite"
          >
            <Spinner size="lg" />
            <p className="storefront-grid-loading-text">Loading collections...</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="storefront-grid-state" data-testid="collections-error">
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
          <div className="storefront-grid-state" data-testid="collections-empty">
            <EmptyState
              title="No collections available"
              description="This store does not have any active collections at the moment. Browse all products instead!"
              action={
                <a
                  href={`/stores/${encodeURIComponent(storeSlug)}/products`}
                  className="btn btn-primary btn-sm"
                >
                  View All Products
                </a>
              }
            />
          </div>
        )}

        {/* Collections Grid */}
        {!isLoading && !error && collections.length > 0 && (
          <div
            className="storefront-collections-grid"
            role="region"
            aria-label="Collections"
            data-testid="collections-grid"
          >
            {collections.map((col) => (
              <a
                key={col.id}
                href={`/stores/${encodeURIComponent(storeSlug)}/collections/${encodeURIComponent(col.slug)}`}
                className="storefront-collection-card"
                data-testid={`collection-card-${col.slug}`}
              >
                <div>
                  <div className="storefront-collection-card-header">
                    <h2 className="storefront-collection-card-title">{col.title}</h2>
                    <span className="storefront-collection-card-count">
                      <Package size={12} style={{ display: "inline", marginRight: "4px", verticalAlign: "middle" }} />
                      {col.productCount} {col.productCount === 1 ? "product" : "products"}
                    </span>
                  </div>
                  {col.description && (
                    <p className="storefront-collection-card-desc">{col.description}</p>
                  )}
                </div>
                <div className="storefront-collection-card-action">
                  <span>Explore Collection</span>
                  <ArrowRight size={14} />
                </div>
              </a>
            ))}
          </div>
        )}
      </StorefrontShell>
    </CartProvider>
  );
}
