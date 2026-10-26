"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Layers, Package, Sparkles } from "lucide-react";
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
            <span className="text-xs font-mono font-bold tracking-widest text-primary uppercase">ARCHIVE LOOKUP</span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Store Unavailable
            </h1>
            <p className="text-sm text-muted-foreground">
              The storefront for &ldquo;{storeSlug}&rdquo; could not be found or is currently not active.
            </p>
            <div className="pt-2">
              <Link href="/" className="btn btn-primary btn-md rounded-2xl px-6 py-2.5 text-xs font-semibold inline-flex items-center gap-1.5">
                <span>Return Home</span>
                <ArrowRight size={14} />
              </Link>
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10 sm:space-y-12">
          {/* Crisp Typographic Header */}
          <header className="storefront-page-header flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-border/60">
            <div className="storefront-page-header-copy space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
                <span className="storefront-eyebrow text-xs font-mono font-bold uppercase tracking-widest text-primary">
                  CURATED ARCHIVES
                </span>
              </div>
              <h1 className="storefront-page-title text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
                Collections
              </h1>
              <p className="storefront-page-subtitle text-sm text-muted-foreground leading-relaxed max-w-xl">
                Thematic groupings crafted for distinctive styles, seasonal highlights, and small-batch artisan releases.
              </p>
            </div>

            <div className="storefront-page-header-meta flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-card/70 text-xs font-mono font-semibold text-muted-foreground border border-border/60 shadow-sm shrink-0 self-start sm:self-auto" aria-label="Collections count">
              <Layers size={14} className="text-primary" aria-hidden="true" />
              <span>{collections.length} {collections.length === 1 ? "Collection" : "Collections"} Indexed</span>
            </div>
          </header>

          {/* Loading State */}
          {isLoading && (
            <div
              className="storefront-grid-state storefront-grid-loading py-24 flex flex-col items-center justify-center text-center space-y-4"
              data-testid="collections-loading"
              aria-busy="true"
              aria-live="polite"
            >
              <div className="p-5 rounded-3xl bg-card border border-border/70 shadow-sm inline-block">
                <Spinner size="lg" className="spinner spinner-lg text-primary" />
              </div>
              <p className="storefront-grid-loading-text text-xs font-mono uppercase tracking-widest text-muted-foreground animate-pulse">
                Retrieving collection catalog...
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
              <div className="rounded-3xl border border-dashed border-border/80 bg-card/40 p-10 space-y-4">
                <EmptyState
                  title="No collections available"
                  description="This store does not have any active collections at the moment. Browse all products instead!"
                  action={
                    <Link
                      href={`/stores/${encodeURIComponent(storeSlug)}/products`}
                      className="btn btn-primary btn-sm rounded-xl px-5 py-2 text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <span>View All Products</span>
                      <ArrowRight size={13} />
                    </Link>
                  }
                />
              </div>
            </div>
          )}

          {/* Editorial Collections Grid with Photography/Art Placeholders */}
          {!isLoading && !error && collections.length > 0 && (
            <div
              className="storefront-collections-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8"
              role="region"
              aria-label="Collections"
              data-testid="collections-grid"
            >
              {collections.map((col, index) => (
                <Link
                  key={col.id}
                  href={`/stores/${encodeURIComponent(storeSlug)}/collections/${encodeURIComponent(col.slug)}`}
                  className="storefront-collection-card group relative flex flex-col justify-between p-6 sm:p-7 rounded-3xl border border-border/70 bg-card/60 backdrop-blur-md hover:border-primary/50 hover:bg-card/90 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
                  data-testid={`collection-card-${col.slug}`}
                >
                  <div className="space-y-4">
                    {/* Architectural Editorial Visual Placeholder */}
                    <div className="aspect-[16/10] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-muted/30 via-card to-background border border-border/60 relative flex flex-col justify-between p-4 group-hover:border-primary/40 transition-colors">
                      <div className="flex items-center justify-between z-10">
                        <span className="font-mono text-[11px] font-bold text-muted-foreground/80 tracking-widest uppercase">
                          SERIES 0{index + 1}
                        </span>
                        <span className="storefront-collection-card-count inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-background/80 text-foreground border border-border/60 backdrop-blur-sm">
                          <Package size={11} className="text-primary" />
                          <span>{col.productCount} {col.productCount === 1 ? "product" : "products"}</span>
                        </span>
                      </div>

                      <div className="flex items-end justify-between z-10 pt-6">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                          <Sparkles size={16} />
                        </div>
                        <span className="w-8 h-8 rounded-full bg-background/80 border border-border/60 flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:border-primary/50 transition-colors">
                          <ArrowUpRight size={14} />
                        </span>
                      </div>

                      {/* Ambient background accent */}
                      <div className="absolute inset-0 bg-radial from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    </div>

                    {/* Metadata & Description */}
                    <div className="space-y-2 pt-1">
                      <h2 className="storefront-collection-card-title text-xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                        {col.title}
                      </h2>
                      {col.description && (
                        <p className="storefront-collection-card-desc text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-2">
                          {col.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Sleek Action Row */}
                  <div className="storefront-collection-card-action pt-6 flex items-center gap-1.5 text-xs font-mono font-bold tracking-wider text-primary group-hover:translate-x-1 transition-transform uppercase">
                    <span>Explore Collection</span>
                    <ArrowRight size={13} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </StorefrontShell>
    </CartProvider>
  );
}
