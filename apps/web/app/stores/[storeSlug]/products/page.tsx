
"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import type { ProductSummaryDTO } from "@shopify-clone/products";
import { Button } from "@shopify-clone/ui";
import { StorefrontShell } from "../../../../src/components/storefront/StorefrontShell";
import { ProductGrid } from "../../../../src/components/storefront/products/product-grid";
import { CatalogFilterBar } from "../../../../src/components/storefront/products/catalog-filter-bar";
import { apiClient, ApiClientError } from "../../../../src/lib/api-client";
import { CartProvider } from "../../../../src/context/cart-context";

interface StorefrontProductsPageProps {
  params: Promise<{ storeSlug: string }>;
}

interface StorefrontCatalogResponse {
  items: ProductSummaryDTO[];
  hasMore: boolean;
  nextCursor?: string;
  store: {
    id: string;
    name: string;
    slug: string;
    currency: string;
  };
}

export default function StorefrontProductsPage({
  params,
}: StorefrontProductsPageProps) {
  const { storeSlug } = use(params);

  const [store, setStore] = useState<StorefrontCatalogResponse["store"] | null>(
    null,
  );
  const [products, setProducts] = useState<ProductSummaryDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiClientError | Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [search, setSearch] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState("created_at_desc");
  const [isInitialized, setIsInitialized] = useState(false);

  // Restore discovery filters from the URL.
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);

    setSearch(searchParams.get("search") || searchParams.get("q") || "");
    setMinPrice(searchParams.get("minPrice") || "");
    setMaxPrice(searchParams.get("maxPrice") || "");
    setInStockOnly(searchParams.get("inStock") === "true");
    setSortBy(
      searchParams.get("sort") ||
        searchParams.get("sortBy") ||
        "created_at_desc",
    );
    setIsInitialized(true);
  }, []);

  // Keep the URL shareable as discovery filters change.
  useEffect(() => {
    if (!isInitialized) return;

    const query = new URLSearchParams();

    if (search.trim()) query.set("search", search.trim());
    if (minPrice.trim()) query.set("minPrice", minPrice.trim());
    if (maxPrice.trim()) query.set("maxPrice", maxPrice.trim());
    if (inStockOnly) query.set("inStock", "true");
    if (sortBy !== "created_at_desc") query.set("sort", sortBy);

    const queryString = query.toString();
    const newUrl = queryString
      ? `${window.location.pathname}?${queryString}`
      : window.location.pathname;

    window.history.replaceState(null, "", newUrl);
  }, [search, minPrice, maxPrice, inStockOnly, sortBy, isInitialized]);

  const fetchCatalog = useCallback(
    async (cursor?: string) => {
      if (!cursor) {
        setIsLoading(true);
        setError(null);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const queryParams: Record<string, string | number | undefined> = {
          limit: 20,
        };

        if (cursor) queryParams.cursor = cursor;
        if (search.trim()) queryParams.search = search.trim();

        if (minPrice.trim()) {
          const parsedMin = Math.round(Number.parseFloat(minPrice) * 100);
          if (Number.isFinite(parsedMin) && parsedMin >= 0) {
            queryParams.minPrice = parsedMin;
          }
        }

        if (maxPrice.trim()) {
          const parsedMax = Math.round(Number.parseFloat(maxPrice) * 100);
          if (Number.isFinite(parsedMax) && parsedMax >= 0) {
            queryParams.maxPrice = parsedMax;
          }
        }

        if (inStockOnly) queryParams.inStock = "true";
        if (sortBy !== "created_at_desc") queryParams.sortBy = sortBy;

        const data = await apiClient.get<StorefrontCatalogResponse>(
          `/api/v1/storefront/${encodeURIComponent(storeSlug)}/products`,
          { params: queryParams },
        );

        setStore(data.store);

        if (cursor) {
          setProducts((previous) => {
            const existingIds = new Set(
              previous.map((item) => item.id),
            );
            return [
              ...previous,
              ...data.items.filter((item) => !existingIds.has(item.id)),
            ];
          });
        } else {
          setProducts(data.items);
        }

        setHasMore(data.hasMore);
        setNextCursor(data.nextCursor);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err
            : new ApiClientError({
                code: "FETCH_FAILED",
                message: "Failed to load store products",
                status: 500,
              }),
        );
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [storeSlug, search, minPrice, maxPrice, inStockOnly, sortBy],
  );

  useEffect(() => {
    if (isInitialized) {
      void fetchCatalog();
    }
  }, [fetchCatalog, isInitialized]);

  const handleClearFilters = useCallback(() => {
    setSearch("");
    setMinPrice("");
    setMaxPrice("");
    setInStockOnly(false);
    setSortBy("created_at_desc");
  }, []);

  const hasActiveFilters = Boolean(
    search.trim() ||
      minPrice.trim() ||
      maxPrice.trim() ||
      inStockOnly ||
      sortBy !== "created_at_desc",
  );

  const isStoreNotFound =
    error instanceof ApiClientError && error.status === 404;

  if (isStoreNotFound) {
    return (
      <StorefrontShell
        storeName="Store Unavailable"
        storeSlug={storeSlug}
        navLinks={[]}
      >
        <main className="catalog-page">
          <section
            className="catalog-state"
            data-testid="store-not-found"
          >
            <div className="catalog-state-card">
              <span className="catalog-state-kicker">STORE UNAVAILABLE</span>
              <div className="catalog-state-icon" aria-hidden="true">
                404
              </div>
              <h1>This storefront isn’t available.</h1>
              <p>
                We couldn’t find an active store at{" "}
                <strong>{storeSlug}</strong>. The address may be incorrect, or
                the storefront may no longer be published.
              </p>
              <a className="catalog-primary-link" href="/">
                Return home <span aria-hidden="true">↗</span>
              </a>
            </div>
          </section>
        </main>
      </StorefrontShell>
    );
  }

  return (
    <CartProvider storeSlug={storeSlug}>
      <StorefrontShell
        storeName={store?.name || "Online Store"}
        storeSlug={storeSlug}
      >
        <main className="catalog-page">
          <section className="catalog-hero" aria-labelledby="catalog-hero-title">
            <div className="catalog-hero-content">
              <span className="catalog-eyebrow">
                <span className="catalog-eyebrow-mark" aria-hidden="true" />
                THE STORE EDIT
              </span>

              <h1 id="catalog-hero-title">
                Good things.
                <br />
                <span>Found here.</span>
              </h1>

              <p>
                Take your time. Explore the collection, find your next
                favourite, and make it yours.
              </p>

              <a className="catalog-hero-link" href="#catalog-products">
                Explore the collection
                <span aria-hidden="true">↓</span>
              </a>
            </div>

            <div className="catalog-hero-art" aria-hidden="true">
              <div className="catalog-art-orbit catalog-art-orbit-outer" />
              <div className="catalog-art-orbit catalog-art-orbit-inner" />
              <div className="catalog-art-core">
                <span>CC</span>
              </div>
              <span className="catalog-art-caption">CURATED FOR EVERY DAY</span>
              <span className="catalog-art-index">01 / DISCOVER</span>
            </div>
          </section>

          <section
            className="catalog-content"
            id="catalog-products"
            aria-labelledby="catalog-heading"
          >
            <header className="catalog-heading-row">
              <div className="catalog-heading-copy">
                <span className="catalog-eyebrow">MADE TO BE DISCOVERED</span>
                <h2 id="catalog-heading">The collection</h2>
                <p>
                  Thoughtfully selected. Ready to explore.
                </p>
              </div>

              <div className="catalog-heading-meta">
                <span className="catalog-status-dot" aria-hidden="true" />
                <span>{isLoading ? "Finding products" : "Explore at your pace"}</span>
              </div>
            </header>

            <div className="catalog-filter-panel">
              <CatalogFilterBar
                search={search}
                onSearchChange={setSearch}
                minPrice={minPrice}
                onMinPriceChange={setMinPrice}
                maxPrice={maxPrice}
                onMaxPriceChange={setMaxPrice}
                inStockOnly={inStockOnly}
                onInStockOnlyChange={setInStockOnly}
                sortBy={sortBy}
                onSortByChange={setSortBy}
                onClearFilters={handleClearFilters}
                hasActiveFilters={hasActiveFilters}
              />
            </div>

            <div className="catalog-results-heading">
              <div>
                <span className="catalog-results-label">
                  {hasActiveFilters ? "YOUR SELECTION" : "THE FULL EDIT"}
                </span>
                <h3>
                  {hasActiveFilters ? "Matching products" : "All products"}
                </h3>
              </div>

              {!isLoading && !error && (
                <span className="catalog-results-count">
                  {products.length} {products.length === 1 ? "item" : "items"}
                  {hasMore ? "+" : ""}
                </span>
              )}
            </div>

            <div className="catalog-grid-wrap">
              <ProductGrid
                products={products}
                storeSlug={storeSlug}
                storeCurrency={store?.currency}
                isLoading={isLoading}
                error={error}
                onRetry={() => void fetchCatalog()}
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                isFiltered={hasActiveFilters}
                onClearFilters={handleClearFilters}
                onLoadMore={() => {
                  if (nextCursor && !isLoadingMore) {
                    void fetchCatalog(nextCursor);
                  }
                }}
              />
            </div>

            {hasMore && !isLoading && !error && (
              <div className="catalog-load-more">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    if (nextCursor && !isLoadingMore) {
                      void fetchCatalog(nextCursor);
                    }
                  }}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? "Loading more…" : "Discover more"}
                </Button>
              </div>
            )}
          </section>

          <footer className="catalog-footer-note">
            <span className="catalog-footer-line" aria-hidden="true" />
            <p>A little discovery goes a long way.</p>
            <span className="catalog-footer-line" aria-hidden="true" />
          </footer>
        </main>
      </StorefrontShell>
    </CartProvider>
  );
}
