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
  const [types, setTypes] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [tags, setTags] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedType, setSelectedType] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load classification filters
  useEffect(() => {
    let isMounted = true;
    async function loadFilters() {
      try {
        const [typesRes, catsRes, tagsRes] = await Promise.allSettled([
          apiClient.get<{ items: Array<{ id: string; name: string; slug: string }> }>(
            `/api/v1/storefront/${encodeURIComponent(storeSlug)}/product-types`,
          ),
          apiClient.get<{ items: Array<{ id: string; name: string; slug: string }> }>(
            `/api/v1/storefront/${encodeURIComponent(storeSlug)}/categories`,
          ),
          apiClient.get<{ items: Array<{ id: string; name: string }> }>(
            `/api/v1/storefront/${encodeURIComponent(storeSlug)}/tags`,
          ),
        ]);
        if (isMounted) {
          if (typesRes.status === "fulfilled" && typesRes.value?.items) {
            setTypes(typesRes.value.items);
          }
          if (catsRes.status === "fulfilled" && catsRes.value?.items) {
            setCategories(catsRes.value.items);
          }
          if (tagsRes.status === "fulfilled" && tagsRes.value?.items) {
            setTags(tagsRes.value.items);
          }
        }
      } catch {
        // Fallback gracefully
      }
    }
    void loadFilters();
    return () => {
      isMounted = false;
    };
  }, [storeSlug]);

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
    setSelectedType(searchParams.get("type") || searchParams.get("typeId") || "");
    setSelectedCategory(searchParams.get("category") || searchParams.get("categoryId") || "");
    const rawTags = searchParams.get("tags");
    if (rawTags) {
      setSelectedTags(rawTags.split(",").map((t) => t.trim()).filter(Boolean));
    }
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
    if (selectedType) query.set("type", selectedType);
    if (selectedCategory) query.set("category", selectedCategory);
    if (selectedTags.length > 0) query.set("tags", selectedTags.join(","));

    const queryString = query.toString();
    const newUrl = queryString
      ? `${window.location.pathname}?${queryString}`
      : window.location.pathname;

    window.history.replaceState(null, "", newUrl);
  }, [
    search,
    minPrice,
    maxPrice,
    inStockOnly,
    sortBy,
    selectedType,
    selectedCategory,
    selectedTags,
    isInitialized,
  ]);

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
        if (selectedType) queryParams.typeId = selectedType;
        if (selectedCategory) queryParams.categoryId = selectedCategory;
        if (selectedTags.length > 0) queryParams.tags = selectedTags.join(",");

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
    [
      storeSlug,
      search,
      minPrice,
      maxPrice,
      inStockOnly,
      sortBy,
      selectedType,
      selectedCategory,
      selectedTags,
    ],
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
    setSelectedType("");
    setSelectedCategory("");
    setSelectedTags([]);
  }, []);

  const handleTagToggle = useCallback((tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName)
        ? prev.filter((t) => t !== tagName)
        : [...prev, tagName]
    );
  }, []);

  const hasActiveFilters = Boolean(
    search.trim() ||
      minPrice.trim() ||
      maxPrice.trim() ||
      inStockOnly ||
      sortBy !== "created_at_desc" ||
      selectedType ||
      selectedCategory ||
      selectedTags.length > 0,
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
        <main className="catalog-page max-w-xl mx-auto py-24 px-4 text-center">
          <section
            className="catalog-state p-8 rounded-3xl border border-dashed border-border/80 bg-card/60 space-y-4"
            data-testid="store-not-found"
          >
            <div className="catalog-state-card space-y-3">
              <span className="catalog-state-kicker text-xs font-mono font-bold tracking-widest text-primary">STORE UNAVAILABLE</span>
              <div className="catalog-state-icon text-4xl font-black text-muted-foreground" aria-hidden="true">
                404
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">This storefront isn’t available.</h1>
              <p className="text-sm text-muted-foreground">
                We couldn’t find an active store at{" "}
                <strong>{storeSlug}</strong>. The address may be incorrect, or
                the storefront may no longer be published.
              </p>
              <div className="pt-2">
                <a className="catalog-primary-link btn btn-primary btn-md rounded-2xl px-6 text-xs font-semibold" href="/">
                  Return home <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
          </section>
        </main>
      </StorefrontShell>
    );
  }

  const storeName = store?.name || "Online Store";

  return (
    <CartProvider storeSlug={storeSlug}>
      <StorefrontShell
        storeName={storeName}
        storeSlug={storeSlug}
      >
        <main className="catalog-page max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10 sm:space-y-12">
          {/* 1. Sleek Editorial Header — Preserves semantics and eliminates bulky hero block */}
          <div className="catalog-hero pb-6 border-b border-border/60 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="catalog-hero-content space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2">
                <span className="catalog-eyebrow-mark w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
                <span className="catalog-eyebrow text-xs font-mono font-bold tracking-widest text-primary uppercase">CATALOG &amp; COLLECTION</span>
              </div>
              <h1 id="catalog-hero-title" className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
                All Products
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Explore handpicked goods crafted in small batches with verified provenance.
              </p>
              <a
                className="catalog-hero-link sr-only"
                href="#catalog-products"
              >
                <span>Explore the collection</span>
              </a>
            </div>

            <div className="text-right shrink-0">
              <span className="text-xs font-mono text-muted-foreground">
                {products.length} {products.length === 1 ? "Item" : "Items"} Listed
              </span>
            </div>

            <div className="catalog-hero-art hidden" aria-hidden="true">
              <div className="catalog-art-orbit catalog-art-orbit-outer">CC</div>
              <div className="catalog-art-core"><span>CC</span></div>
              <span className="catalog-art-caption">CURATED</span>
              <span className="catalog-art-index">01</span>
            </div>
          </div>

          {/* 2. Catalog Products & Filters Section */}
          <section
            className="catalog-content space-y-8"
            id="catalog-products"
            aria-labelledby="catalog-heading"
          >
            <header className="catalog-heading-row flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-border/60">
              <div className="catalog-heading-copy space-y-1">
                <span className="catalog-eyebrow text-xs font-bold uppercase tracking-wider text-primary">MADE TO BE DISCOVERED</span>
                <h2 id="catalog-heading" className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                  The collection
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Thoughtfully selected. Ready to explore.
                </p>
              </div>

              <div className="catalog-heading-meta flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className="catalog-status-dot w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                <span>{isLoading ? "Finding products" : "Explore at your pace"}</span>
              </div>
            </header>

            {/* Filter Bar */}
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
                types={types}
                selectedType={selectedType}
                onTypeChange={setSelectedType}
                categories={categories}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                tags={tags}
                selectedTags={selectedTags}
                onTagToggle={handleTagToggle}
              />
            </div>

            {/* Results Counter Heading */}
            <div className="catalog-results-heading flex items-center justify-between text-xs pt-2">
              <div>
                <span className="catalog-results-label font-mono font-bold tracking-wider text-muted-foreground block text-[11px]">
                  {hasActiveFilters ? "YOUR SELECTION" : "THE FULL EDIT"}
                </span>
                <h3 className="font-bold text-base text-foreground">
                  {hasActiveFilters ? "Matching products" : "All products"}
                </h3>
              </div>

              {!isLoading && !error && (
                <span className="catalog-results-count font-semibold px-3 py-1 rounded-full bg-muted/60 text-muted-foreground border border-border/50">
                  {products.length} {products.length === 1 ? "item" : "items"}
                  {hasMore ? "+" : ""}
                </span>
              )}
            </div>

            {/* Grid Container */}
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
          </section>

          {/* Catalog Footer Note */}
          <footer className="catalog-footer-note py-8 text-center flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="catalog-footer-line flex-1 h-px bg-border/60" aria-hidden="true" />
            <p className="font-medium">A little discovery goes a long way.</p>
            <span className="catalog-footer-line flex-1 h-px bg-border/60" aria-hidden="true" />
          </footer>
        </main>
      </StorefrontShell>
    </CartProvider>
  );
}
