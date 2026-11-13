"use client";

import Link from "next/link";
import React, { use, useCallback, useEffect, useState } from "react";
import type { ProductSummaryDTO, CatalogFilterFacetsDTO } from "@calcart/products";
import { useStorefrontIdentity } from "../../../../src/components/storefront/use-storefront-identity";
import { StorefrontShell } from "../../../../src/components/storefront/StorefrontShell";
import { ProductGrid, type CatalogLayoutMode } from "../../../../src/components/storefront/products/product-grid";
import { CatalogFilterBar } from "../../../../src/components/storefront/products/catalog-filter-bar";
import { CatalogFilterSidebar } from "../../../../src/components/storefront/products/catalog-filter-sidebar";
import { CatalogHero } from "../../../../src/components/storefront/products/catalog-hero";
import { ActiveFilterChips } from "../../../../src/components/storefront/products/active-filter-chips";
import { RecentlyViewedShelf } from "../../../../src/components/storefront/products/recently-viewed-shelf";
import { QuickViewModal } from "../../../../src/components/storefront/products/quick-view-modal";
import { apiClient, ApiClientError } from "../../../../src/lib/api-client";

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
  const { theme } = useStorefrontIdentity(storeSlug);

  const [store, setStore] = useState<StorefrontCatalogResponse["store"] | null>(
    null,
  );
  const [products, setProducts] = useState<ProductSummaryDTO[]>([]);
  const [facets, setFacets] = useState<CatalogFilterFacetsDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiClientError | Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Filter states
  const [search, setSearch] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("featured");
  const [types, setTypes] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [tags, setTags] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedType, setSelectedType] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [layoutMode, setLayoutMode] = useState<CatalogLayoutMode>("grid-4");
  const [quickViewSlug, setQuickViewSlug] = useState<string | null>(null);

  // Load classification filters & dynamic facets
  useEffect(() => {
    let isMounted = true;
    async function loadMetadata() {
      try {
        const [facetsRes, typesRes, catsRes, tagsRes] = await Promise.allSettled([
          apiClient.get<CatalogFilterFacetsDTO>(
            `/api/v1/storefront/${encodeURIComponent(storeSlug)}/products/filters`,
          ),
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
          if (facetsRes.status === "fulfilled" && facetsRes.value) {
            setFacets(facetsRes.value);
          }
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
    void loadMetadata();
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
    setOnSaleOnly(searchParams.get("onSale") === "true" || searchParams.get("sale") === "true");

    const rawSizes = searchParams.get("sizes") || searchParams.get("size");
    if (rawSizes) {
      setSelectedSizes(rawSizes.split(",").map((s) => s.trim()).filter(Boolean));
    }

    const rawColors = searchParams.get("colors") || searchParams.get("color");
    if (rawColors) {
      setSelectedColors(rawColors.split(",").map((c) => c.trim()).filter(Boolean));
    }

    const rawMaterials = searchParams.get("materials") || searchParams.get("material");
    if (rawMaterials) {
      setSelectedMaterials(rawMaterials.split(",").map((m) => m.trim()).filter(Boolean));
    }

    setSortBy(
      searchParams.get("sort") ||
        searchParams.get("sortBy") ||
        "featured",
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
    if (onSaleOnly) query.set("onSale", "true");
    if (selectedSizes.length > 0) query.set("sizes", selectedSizes.join(","));
    if (selectedColors.length > 0) query.set("colors", selectedColors.join(","));
    if (selectedMaterials.length > 0) query.set("materials", selectedMaterials.join(","));
    if (sortBy && sortBy !== "featured") query.set("sort", sortBy);
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
    onSaleOnly,
    selectedSizes,
    selectedColors,
    selectedMaterials,
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
        if (onSaleOnly) queryParams.onSale = "true";
        if (selectedSizes.length > 0) queryParams.sizes = selectedSizes.join(",");
        if (selectedColors.length > 0) queryParams.colors = selectedColors.join(",");
        if (selectedMaterials.length > 0) queryParams.materials = selectedMaterials.join(",");
        if (sortBy) queryParams.sortBy = sortBy;
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
      } catch (err) {
        setError(
          err instanceof Error
            ? err
            : new Error("An error occurred loading the catalog."),
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
      onSaleOnly,
      selectedSizes,
      selectedColors,
      selectedMaterials,
      sortBy,
      selectedType,
      selectedCategory,
      selectedTags,
    ],
  );

  // Trigger catalog fetch when initialized or filters change
  useEffect(() => {
    if (!isInitialized) return;
    const timer = setTimeout(() => {
      void fetchCatalog();
    }, 150);
    return () => clearTimeout(timer);
  }, [fetchCatalog, isInitialized]);

  const handleClearFilters = useCallback(() => {
    setSearch("");
    setMinPrice("");
    setMaxPrice("");
    setInStockOnly(false);
    setOnSaleOnly(false);
    setSelectedSizes([]);
    setSelectedColors([]);
    setSelectedMaterials([]);
    setSortBy("featured");
    setSelectedType("");
    setSelectedCategory("");
    setSelectedTags([]);
  }, []);

  const handleSizeToggle = useCallback((size: string) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size],
    );
  }, []);

  const handleColorToggle = useCallback((color: string) => {
    setSelectedColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color],
    );
  }, []);

  const handleMaterialToggle = useCallback((material: string) => {
    setSelectedMaterials((prev) =>
      prev.includes(material)
        ? prev.filter((m) => m !== material)
        : [...prev, material],
    );
  }, []);

  const handleTagToggle = useCallback((tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName)
        ? prev.filter((t) => t !== tagName)
        : [...prev, tagName],
    );
  }, []);

  const hasActiveFilters = Boolean(
    search.trim() ||
      minPrice.trim() ||
      maxPrice.trim() ||
      inStockOnly ||
      onSaleOnly ||
      selectedSizes.length > 0 ||
      selectedColors.length > 0 ||
      selectedMaterials.length > 0 ||
      (sortBy && sortBy !== "featured") ||
      selectedType ||
      selectedCategory ||
      selectedTags.length > 0,
  );

  const activeFilterCount =
    (search.trim() ? 1 : 0) +
    (minPrice.trim() ? 1 : 0) +
    (maxPrice.trim() ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (onSaleOnly ? 1 : 0) +
    selectedSizes.length +
    selectedColors.length +
    selectedMaterials.length +
    (selectedType ? 1 : 0) +
    (selectedCategory ? 1 : 0) +
    selectedTags.length;

  const isStoreNotFound =
    error instanceof ApiClientError && error.status === 404;

  if (isStoreNotFound) {
    return (
      <StorefrontShell
        storeName="Store Unavailable"
        storeSlug={storeSlug}
        navLinks={[]}
      >
        <div className="catalog-page max-w-xl mx-auto py-24 px-4 text-center">
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
                <Link className="catalog-primary-link btn btn-primary btn-md rounded-full px-6 text-xs font-semibold" href="/">
                  Return home <span aria-hidden="true">↗</span>
                </Link>
              </div>
            </div>
          </section>
        </div>
      </StorefrontShell>
    );
  }

  const storeName = store?.name || "Online Store";

  return (
        <StorefrontShell
          storeName={storeName}
          storeSlug={storeSlug}
          theme={theme}
          fullBleed>
          <div className="catalog-page at-container pb-20 pt-6 sm:pt-10">
            {/* 1. Breadcrumbs */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link href={`/stores/${encodeURIComponent(storeSlug)}`} className="at-link">
                {storeName}
              </Link>
              <span aria-hidden="true">/</span>
              <span className="text-foreground" aria-current="page">Products</span>
            </nav>

            {/* 2. Visual Editorial Hero with Live Count, Quick Filter Tabs & Assurance Marquee */}
            <CatalogHero
              storeName={storeName}
              totalProducts={products.length}
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              onSaleOnly={onSaleOnly}
              onToggleSale={setOnSaleOnly}
              inStockOnly={inStockOnly}
              onToggleInStock={setInStockOnly}
            />

            {/* 3. Top Filter & Search Bar with Layout Density Switcher */}
            <section aria-label="Catalog filters and search" className="space-y-3 py-6">
              <CatalogFilterBar
                storeSlug={storeSlug}
                search={search}
                onSearchChange={setSearch}
                minPrice={minPrice}
                onMinPriceChange={setMinPrice}
                maxPrice={maxPrice}
                onMaxPriceChange={setMaxPrice}
                inStockOnly={inStockOnly}
                onInStockOnlyChange={setInStockOnly}
                onSaleOnly={onSaleOnly}
                onOnSaleOnlyChange={setOnSaleOnly}
                selectedSizes={selectedSizes}
                onSizeRemove={(s) => setSelectedSizes((prev) => prev.filter((item) => item !== s))}
                selectedColors={selectedColors}
                onColorRemove={(c) => setSelectedColors((prev) => prev.filter((item) => item !== c))}
                selectedMaterials={selectedMaterials}
                onMaterialRemove={(m) => setSelectedMaterials((prev) => prev.filter((item) => item !== m))}
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
                onOpenMobileFilters={() => setIsMobileDrawerOpen(true)}
                activeFilterCount={activeFilterCount}
                layoutMode={layoutMode}
                onLayoutModeChange={setLayoutMode}
              />

              {/* 3b. Active Filter Removable Tag Chips */}
              <ActiveFilterChips
                search={search}
                onClearSearch={() => setSearch("")}
                minPrice={minPrice}
                maxPrice={maxPrice}
                onClearPrice={() => {
                  setMinPrice("");
                  setMaxPrice("");
                }}
                inStockOnly={inStockOnly}
                onClearInStock={() => setInStockOnly(false)}
                onSaleOnly={onSaleOnly}
                onClearOnSale={() => setOnSaleOnly(false)}
                selectedSizes={selectedSizes}
                onRemoveSize={(s) => setSelectedSizes((prev) => prev.filter((item) => item !== s))}
                selectedColors={selectedColors}
                onRemoveColor={(c) => setSelectedColors((prev) => prev.filter((item) => item !== c))}
                selectedMaterials={selectedMaterials}
                onRemoveMaterial={(m) => setSelectedMaterials((prev) => prev.filter((item) => item !== m))}
                selectedType={selectedType}
                typeName={types.find((t) => t.id === selectedType)?.name}
                onClearType={() => setSelectedType("")}
                selectedCategory={selectedCategory}
                categoryName={categories.find((c) => c.id === selectedCategory)?.name}
                onClearCategory={() => setSelectedCategory("")}
                selectedTags={selectedTags}
                onRemoveTag={(t) => setSelectedTags((prev) => prev.filter((item) => item !== t))}
                onClearAll={handleClearFilters}
                totalResults={products.length}
              />
            </section>

            {/* 4. Body Content: Left Sidebar + Right Products Grid */}
            <div className="flex flex-col items-start gap-10 lg:flex-row lg:gap-14">
              {/* Desktop Sidebar & Mobile Drawer */}
              <CatalogFilterSidebar
                facets={facets}
                currency={store?.currency}
                totalResults={products.length}
                minPrice={minPrice}
                onMinPriceChange={setMinPrice}
                maxPrice={maxPrice}
                onMaxPriceChange={setMaxPrice}
                inStockOnly={inStockOnly}
                onInStockOnlyChange={setInStockOnly}
                onSaleOnly={onSaleOnly}
                onOnSaleOnlyChange={setOnSaleOnly}
                selectedSizes={selectedSizes}
                onSizeToggle={handleSizeToggle}
                selectedColors={selectedColors}
                onColorToggle={handleColorToggle}
                selectedMaterials={selectedMaterials}
                onMaterialToggle={handleMaterialToggle}
                selectedType={selectedType}
                onTypeChange={setSelectedType}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                onClearAll={handleClearFilters}
                hasActiveFilters={hasActiveFilters}
                isOpenMobile={isMobileDrawerOpen}
                onCloseMobile={() => setIsMobileDrawerOpen(false)}
              />

              {/* Product Grid */}
              <section id="catalog-products" aria-label="Products list" className="flex-1 min-w-0 w-full">
                <ProductGrid
                  products={products}
                  storeSlug={storeSlug}
                  isLoading={isLoading}
                  error={error}
                  onRetry={() => void fetchCatalog()}
                  hasMore={hasMore}
                  isLoadingMore={isLoadingMore}
                  isFiltered={hasActiveFilters}
                  onClearFilters={handleClearFilters}
                  layoutMode={layoutMode}
                  onQuickView={setQuickViewSlug}
                  onSelectSuggestion={(term) => setSearch(term)}
                  onLoadMore={() => {
                    if (nextCursor && !isLoadingMore) {
                      void fetchCatalog(nextCursor);
                    }
                  }}
                />
              </section>
            </div>

            {/* 5. Recently Viewed Shelf */}
            <div className="mt-24"><RecentlyViewedShelf storeSlug={storeSlug} onQuickView={setQuickViewSlug} /></div>

            {/* 6. Quick View Modal */}
            <QuickViewModal
              productSlug={quickViewSlug}
              storeSlug={storeSlug}
              isOpen={Boolean(quickViewSlug)}
              onClose={() => setQuickViewSlug(null)}
            />

          </div>
        </StorefrontShell>
  );
}
