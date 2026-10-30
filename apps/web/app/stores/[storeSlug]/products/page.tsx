"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import type { ProductSummaryDTO } from "@calcart/products";
import { StorefrontShell } from "../../../../src/components/storefront/StorefrontShell";
import { ProductGrid } from "../../../../src/components/storefront/products/product-grid";
import { CatalogFilterBar } from "../../../../src/components/storefront/products/catalog-filter-bar";
import { apiClient, ApiClientError } from "../../../../src/lib/api-client";
import { CartProvider } from "../../../../src/context/cart-context";
import { Sparkles } from "lucide-react";

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

  // Restore discovery filters from URL
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

  // Keep URL updated as filters change
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
            const existingKeys = new Set(
              previous.map((item) => (item.variantId ? `${item.id}-${item.variantId}` : item.id)),
            );
            return [
              ...previous,
              ...data.items.filter((item) => !existingKeys.has(item.variantId ? `${item.id}-${item.variantId}` : item.id)),
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
            <div className="catalog-state-card space-y-3 p-8">
              <span className="catalog-state-kicker text-xs font-mono font-bold tracking-widest text-primary uppercase">
                STORE UNAVAILABLE
              </span>
              <div className="catalog-state-icon text-4xl font-black text-muted-foreground" aria-hidden="true">
                404
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                This storefront isn’t available.
              </h1>
              <p className="text-sm text-muted-foreground">
                We couldn’t find an active store at{" "}
                <strong>{storeSlug}</strong>. The address may be incorrect, or
                the storefront may no longer be published.
              </p>
              <div className="pt-2">
                <a className="catalog-primary-link btn btn-primary btn-md rounded-full px-6 text-xs font-semibold" href="/">
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
        <main className="catalog-page max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
          {/* 1. Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <a href={`/stores/${encodeURIComponent(storeSlug)}`} className="hover:text-foreground transition-colors">
              {storeName}
            </a>
            <span className="opacity-40">/</span>
            <span className="text-foreground">Catalog</span>
          </nav>

          {/* 2. Editorial Header: Confident, Clean, Immediate */}
          <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-border/60">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
                <span className="text-[11px] font-mono font-semibold tracking-wider uppercase text-muted-foreground">
                  Curated Catalog
                </span>
              </div>
              <h1
                id="catalog-hero-title"
                className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground"
              >
                All Products
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Discover limited editions, signature graphics, and everyday streetwear essentials.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-mono text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-full border border-border/50">
                {products.length} {products.length === 1 ? "Item" : "Items"} Listed
              </span>
            </div>
          </header>

          {/* 3. Quick Category & Style Pills */}
          {(types.length > 0 || categories.length > 0) && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar text-xs">
              <button
                type="button"
                onClick={() => {
                  setSelectedType("");
                  setSelectedCategory("");
                }}
                className={`px-3.5 py-1.5 rounded-full font-medium transition-all shrink-0 cursor-pointer text-xs ${
                  !selectedType && !selectedCategory
                    ? "bg-foreground text-background shadow-xs font-semibold"
                    : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50"
                }`}
              >
                All Styles
              </button>
              {types.map((type) => {
                const isSelected = selectedType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => {
                      setSelectedType(isSelected ? "" : type.id);
                    }}
                    className={`px-3.5 py-1.5 rounded-full font-medium transition-all shrink-0 cursor-pointer text-xs ${
                      isSelected
                        ? "bg-foreground text-background shadow-xs font-semibold"
                        : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50"
                    }`}
                  >
                    {type.name}
                  </button>
                );
              })}
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(isSelected ? "" : cat.id);
                    }}
                    className={`px-3.5 py-1.5 rounded-full font-medium transition-all shrink-0 cursor-pointer text-xs ${
                      isSelected
                        ? "bg-foreground text-background shadow-xs font-semibold"
                        : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50"
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* 4. Filter Toolbar */}
          <section aria-label="Catalog filters">
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
          </section>

          {/* 5. Product Grid */}
          <section id="catalog-products" aria-label="Products list">
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
          </section>

          {/* 6. Refined Storefront Footer Accent */}
          <footer className="pt-12 pb-6 text-center flex items-center justify-center gap-4 text-xs text-muted-foreground/70">
            <span className="flex-1 h-px bg-border/40" aria-hidden="true" />
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <Sparkles size={12} className="text-primary/70" />
              <span>Authentic Merchandise &bull; Guaranteed Quality</span>
            </div>
            <span className="flex-1 h-px bg-border/40" aria-hidden="true" />
          </footer>
        </main>
      </StorefrontShell>
    </CartProvider>
  );
}
