"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { CollectionDTO } from "@calcart/products";
import { Alert, Button } from "@calcart/ui";
import { useStorefrontIdentity } from "../../../../src/components/storefront/use-storefront-identity";
import { StorefrontShell } from "../../../../src/components/storefront/StorefrontShell";
import { apiClient, ApiClientError } from "../../../../src/lib/api-client";

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
  const { theme } = useStorefrontIdentity(storeSlug);

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
    <StorefrontShell
      storeName={store?.name || "Online Store"}
      storeSlug={storeSlug}
      theme={theme}
          fullBleed>
      <div className="at-container pb-24 pt-8 sm:pt-14">
        <header className="storefront-page-header flex flex-col gap-6 pb-10 sm:pb-16 lg:flex-row lg:items-end lg:justify-between">
          <div className="storefront-page-header-copy max-w-3xl">
            <p className="storefront-eyebrow at-eyebrow text-muted-foreground">Browse by collection</p>
            <h1 className="storefront-page-title at-display-xl mt-3 text-foreground">Collections</h1>
            <p className="storefront-page-subtitle at-lede mt-5 max-w-xl text-muted-foreground">
              Browse this store&apos;s products grouped into collections.
            </p>
          </div>
          <p className="storefront-page-header-meta at-num text-sm text-muted-foreground" aria-label="Collections count">
            <span className="text-foreground">{collections.length}</span>{" "}
            {collections.length === 1 ? "Collection" : "Collections"}
          </p>
        </header>

        {isLoading && (
          <div
            className="storefront-grid-state storefront-grid-loading border-t border-[color:var(--at-hairline)]"
            data-testid="collections-loading"
            aria-busy="true"
            aria-live="polite"
          >
            {[0, 1, 2].map((i) => (
              <div key={i} className="border-b border-[color:var(--at-hairline)] py-10" aria-hidden="true">
                <div className="at-skeleton h-10 w-2/3 max-w-xl" />
                <div className="at-skeleton mt-4 h-3 w-1/4" />
              </div>
            ))}
            <span className="sr-only">Loading collections</span>
          </div>
        )}

        {error && !isLoading && (
          <div className="storefront-grid-state mx-auto max-w-xl py-16" data-testid="collections-error">
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

        {!isLoading && !error && collections.length === 0 && (
          <div
            className="storefront-grid-state border-y border-[color:var(--at-hairline)] py-20 text-center"
            data-testid="collections-empty"
          >
            <h2 className="at-display-md text-foreground">No collections available</h2>
            <p className="at-lede mx-auto mt-4 max-w-md text-muted-foreground">
              This store does not have any active collections at the moment. Browse all products instead!
            </p>
            <Link
              href={`/stores/${encodeURIComponent(storeSlug)}/products`}
              className="mt-8 ds-btn ds-btn-outline"
            >
              View all products
              <ArrowRight size={14} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </div>
        )}

        {!isLoading && !error && collections.length > 0 && (
          <ol
            className="storefront-collections-grid border-t border-[color:var(--at-hairline)]"
            aria-label="Collections"
            data-testid="collections-grid"
          >
            {collections.map((col, index) => (
              <motion.li
                key={col.id}
                className="border-b border-[color:var(--at-hairline)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1], delay: Math.min(index, 8) * 0.04 }}
              >
                <Link
                  href={`/stores/${encodeURIComponent(storeSlug)}/collections/${encodeURIComponent(col.slug)}`}
                  className="storefront-collection-card group grid grid-cols-[auto_1fr_auto] items-baseline gap-x-5 gap-y-2 py-8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:grid-cols-[4rem_1fr_auto_auto] sm:gap-x-8 sm:py-12"
                  data-testid={`collection-card-${col.slug}`}
                >
                  <span className="at-num text-sm text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <h2 className="storefront-collection-card-title at-display-md text-foreground transition-transform duration-300 ease-[var(--at-ease-out)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-2">
                      {col.title}
                    </h2>
                    {col.description && (
                      <p className="storefront-collection-card-desc mt-3 line-clamp-2 max-w-xl text-sm text-muted-foreground">
                        {col.description}
                      </p>
                    )}
                  </div>
                  <span className="storefront-collection-card-count at-num hidden text-sm text-muted-foreground sm:block">
                    {col.productCount} {col.productCount === 1 ? "product" : "products"}
                  </span>
                  <span className="storefront-collection-card-action self-center text-foreground" aria-hidden="true">
                    <ArrowUpRight size={22} strokeWidth={1.25} />
                  </span>
                </Link>
              </motion.li>
            ))}
          </ol>
        )}
      </div>
    </StorefrontShell>
  );
}
