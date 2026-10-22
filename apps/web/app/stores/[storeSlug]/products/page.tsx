"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import type { ProductSummaryDTO } from "@shopify-clone/products";
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

  const [store, setStore] = useState<{
    id: string;
    name: string;
    slug: string;
    currency: string;
  } | null>(null);
  const [products, setProducts] = useState<ProductSummaryDTO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiClientError | Error | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  // Discovery Filter & Sort States
  const [search, setSearch] = useState<string>("");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>("created_at_desc");
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Read URL search parameters on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const urlSearch = searchParams.get("search") || searchParams.get("q") || "";
      const urlMinPrice = searchParams.get("minPrice") || "";
      const urlMaxPrice = searchParams.get("maxPrice") || "";
      const urlInStock = searchParams.get("inStock") === "true";
      const urlSort = searchParams.get("sort") || searchParams.get("sortBy") || "created_at_desc";

      setSearch(urlSearch);
      setMinPrice(urlMinPrice);
      setMaxPrice(urlMaxPrice);
      setInStockOnly(urlInStock);
      setSortBy(urlSort);
      setIsInitialized(true);
    }
  }, []);

  // Synchronize filter states to URL
  useEffect(() => {
    if (!isInitialized || typeof window === "undefined") return;

    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (minPrice.trim()) params.set("minPrice", minPrice.trim());
    if (maxPrice.trim()) params.set("maxPrice", maxPrice.trim());
    if (inStockOnly) params.set("inStock", "true");
    if (sortBy && sortBy !== "created_at_desc") params.set("sort", sortBy);

    const queryString = params.toString();
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
        if (cursor) {
          queryParams.cursor = cursor;
        }
        if (search.trim()) {
          queryParams.search = search.trim();
        }
        if (minPrice.trim()) {
          const parsedMin = Math.round(parseFloat(minPrice) * 100);
          if (!Number.isNaN(parsedMin) && parsedMin >= 0) {
            queryParams.minPrice = parsedMin;
          }
        }
        if (maxPrice.trim()) {
          const parsedMax = Math.round(parseFloat(maxPrice) * 100);
          if (!Number.isNaN(parsedMax) && parsedMax >= 0) {
            queryParams.maxPrice = parsedMax;
          }
        }
        if (inStockOnly) {
          queryParams.inStock = "true";
        }
        if (sortBy && sortBy !== "created_at_desc") {
          queryParams.sortBy = sortBy;
        }

        const data = await apiClient.get<StorefrontCatalogResponse>(
          `/api/v1/storefront/${encodeURIComponent(storeSlug)}/products`,
          { params: queryParams },
        );

        setStore(data.store);
        if (cursor) {
          setProducts((prev) => [...prev, ...data.items]);
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

  // Re-fetch whenever filters change
  useEffect(() => {
    if (isInitialized) {
      fetchCatalog();
    }
  }, [fetchCatalog, isInitialized]);

  const handleClearFilters = () => {
    setSearch("");
    setMinPrice("");
    setMaxPrice("");
    setInStockOnly(false);
    setSortBy("created_at_desc");
  };

  const hasActiveFilters = Boolean(
    search.trim() ||
      minPrice.trim() ||
      maxPrice.trim() ||
      inStockOnly ||
      (sortBy && sortBy !== "created_at_desc"),
  );

  const isStoreNotFound =
    error instanceof ApiClientError && error.status === 404;

  // Handle 404 Store Not Found
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
        <section className="storefront-discovery-hero">
          <div>
            <span className="storefront-eyebrow">/ DISCOVERY MODE</span>
            <h1>Objects with<br /><em>presence.</em></h1>
            <p>Explore the catalog as a living field of products, materials, and ideas.</p>
          </div>
        </section>

        <header className="storefront-page-header">
          <div className="storefront-page-header-copy">
            <span className="storefront-eyebrow">The collection</span>
            <h1 className="storefront-page-title">All Products</h1>
            <p className="storefront-page-subtitle">
              Discover our published collection of quality products.
            </p>
          </div>
          <div className="storefront-page-header-meta" aria-label="Catalog information">
            <span className="storefront-live-dot" aria-hidden="true" />
            Curated for you
          </div>
        </header>

        {/* Discovery Filter and Search Bar */}
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

        <ProductGrid
          products={products}
          storeSlug={storeSlug}
          storeCurrency={store?.currency}
          isLoading={isLoading}
          error={error}
          onRetry={() => fetchCatalog()}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          isFiltered={hasActiveFilters}
          onClearFilters={handleClearFilters}
          onLoadMore={() => {
            if (nextCursor) {
              fetchCatalog(nextCursor);
            }
          }}
        />
      </StorefrontShell>
    </CartProvider>
  );
}
