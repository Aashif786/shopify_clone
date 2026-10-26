"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Layers } from "lucide-react";
import type { CollectionDTO, ProductSummaryDTO } from "@shopify-clone/products";
import { StorefrontShell } from "../../../../../src/components/storefront/StorefrontShell";
import { ProductGrid } from "../../../../../src/components/storefront/products/product-grid";
import { CatalogFilterBar } from "../../../../../src/components/storefront/products/catalog-filter-bar";
import { apiClient, ApiClientError } from "../../../../../src/lib/api-client";
import { CartProvider } from "../../../../../src/context/cart-context";

interface StoreCollectionDetailPageProps {
  params: Promise<{ storeSlug: string; collectionSlug: string }>;
}

interface StorefrontCollectionResponse {
  collection: CollectionDTO;
  store: {
    id: string;
    name: string;
    slug: string;
    currency: string;
  };
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

export default function StoreCollectionDetailPage({
  params,
}: StoreCollectionDetailPageProps) {
  const { storeSlug, collectionSlug } = use(params);

  const [store, setStore] = useState<{
    id: string;
    name: string;
    slug: string;
    currency: string;
  } | null>(null);
  const [collection, setCollection] = useState<CollectionDTO | null>(null);
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

  // Read URL search params on mount
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

  // Sync to URL
  useEffect(() => {
    if (!isInitialized || typeof window === "undefined") return;

    const queryParams = new URLSearchParams();
    if (search.trim()) queryParams.set("search", search.trim());
    if (minPrice.trim()) queryParams.set("minPrice", minPrice.trim());
    if (maxPrice.trim()) queryParams.set("maxPrice", maxPrice.trim());
    if (inStockOnly) queryParams.set("inStock", "true");
    if (sortBy && sortBy !== "created_at_desc") queryParams.set("sort", sortBy);

    const queryString = queryParams.toString();
    const newUrl = queryString
      ? `${window.location.pathname}?${queryString}`
      : window.location.pathname;

    window.history.replaceState(null, "", newUrl);
  }, [search, minPrice, maxPrice, inStockOnly, sortBy, isInitialized]);

  const fetchCollectionAndProducts = useCallback(
    async (cursor?: string) => {
      if (!cursor) {
        setIsLoading(true);
        setError(null);
      } else {
        setIsLoadingMore(true);
      }

      try {
        // Fetch collection details if not loaded
        if (!cursor) {
          const colData = await apiClient.get<StorefrontCollectionResponse>(
            `/api/v1/storefront/${encodeURIComponent(storeSlug)}/collections/${encodeURIComponent(collectionSlug)}`,
          );
          setCollection(colData.collection);
          setStore(colData.store);
        }

        // Fetch products scoped to collection
        const queryParams: Record<string, string | number | undefined> = {
          collection: collectionSlug,
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

        const prodData = await apiClient.get<StorefrontCatalogResponse>(
          `/api/v1/storefront/${encodeURIComponent(storeSlug)}/products`,
          { params: queryParams },
        );

        if (cursor) {
          setProducts((prev) => [...prev, ...prodData.items]);
        } else {
          setProducts(prodData.items);
        }
        setHasMore(prodData.hasMore);
        setNextCursor(prodData.nextCursor);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err
            : new ApiClientError({
                code: "FETCH_FAILED",
                message: "Failed to load collection products",
                status: 500,
              }),
        );
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [storeSlug, collectionSlug, search, minPrice, maxPrice, inStockOnly, sortBy],
  );

  useEffect(() => {
    if (isInitialized) {
      fetchCollectionAndProducts();
    }
  }, [fetchCollectionAndProducts, isInitialized]);

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

  const isNotFound =
    error instanceof ApiClientError && error.status === 404;

  if (isNotFound) {
    return (
      <StorefrontShell
        storeName="Collection Not Found"
        storeSlug={storeSlug}
        navLinks={[]}
      >
        <div className="storefront-not-found-container max-w-lg mx-auto py-24 px-4 text-center" data-testid="collection-not-found">
          <div className="card p-8 rounded-3xl border border-dashed border-border/80 bg-card/60 space-y-4">
            <span className="text-xs font-mono font-bold tracking-widest text-primary uppercase">ARCHIVE LOOKUP</span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Collection Unavailable
            </h1>
            <p className="text-sm text-muted-foreground">
              The collection &ldquo;{collectionSlug}&rdquo; could not be found or is currently not active.
            </p>
            <div className="pt-2">
              <Link
                href={`/stores/${encodeURIComponent(storeSlug)}/collections`}
                className="btn btn-primary btn-md rounded-2xl px-6 py-2.5 text-xs font-semibold inline-flex items-center gap-2 shadow-md shadow-primary/10"
              >
                <ArrowLeft size={14} />
                <span>View All Collections</span>
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8 sm:space-y-10">
          <div>
            <Link
              href={`/stores/${encodeURIComponent(storeSlug)}/collections`}
              className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-muted-foreground hover:text-foreground transition-colors group uppercase tracking-wider"
            >
              <ArrowLeft size={13} className="group-hover:-translate-x-1 transition-transform" />
              <span>Back to all collections</span>
            </Link>
          </div>

          {/* Crisp Typographic Header — No Bulky Banners */}
          <header className="storefront-page-header flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-border/60">
            <div className="storefront-page-header-copy space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
                <span className="storefront-eyebrow text-xs font-mono font-bold uppercase tracking-widest text-primary">
                  CURATED ARCHIVE
                </span>
              </div>
              <h1 className="storefront-page-title text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-tight" data-testid="collection-title">
                {collection?.title || collectionSlug}
              </h1>
              {collection?.description && (
                <p className="storefront-page-subtitle text-sm text-muted-foreground leading-relaxed max-w-2xl" data-testid="collection-description">
                  {collection.description}
                </p>
              )}
            </div>

            <div className="storefront-page-header-meta flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-card/70 text-xs font-mono font-semibold text-muted-foreground border border-border/60 shadow-sm shrink-0 self-start sm:self-auto" aria-label="Products count">
              <Layers size={14} className="text-primary" aria-hidden="true" />
              <span>{products.length} {products.length === 1 ? "Product" : "Products"} Cataloged</span>
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
            activeCollection={collection ? { title: collection.title, slug: collection.slug } : undefined}
          />

          <ProductGrid
            products={products}
            storeSlug={storeSlug}
            storeCurrency={store?.currency}
            isLoading={isLoading}
            error={error}
            onRetry={() => fetchCollectionAndProducts()}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            isFiltered={hasActiveFilters}
            onClearFilters={handleClearFilters}
            onLoadMore={() => {
              if (nextCursor) {
                fetchCollectionAndProducts(nextCursor);
              }
            }}
          />
        </div>
      </StorefrontShell>
    </CartProvider>
  );
}
