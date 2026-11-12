"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  X,
  SlidersHorizontal,
  ArrowUpDown,
  Clock,
  ExternalLink,
  Tag,
  Folder,
  Sparkles,
  Grid2x2,
  Columns3,
  Columns2,
  List,
} from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import type { SearchSuggestionsResultDTO, SearchSuggestionItemDTO } from "@calcart/products";
import { formatStorePrice } from "./product-card";

export interface CatalogFilterBarProps {
  storeSlug?: string;
  storeCurrency?: string;
  search: string;
  onSearchChange: (value: string) => void;
  minPrice: string;
  onMinPriceChange: (value: string) => void;
  maxPrice: string;
  onMaxPriceChange: (value: string) => void;
  inStockOnly: boolean;
  onInStockOnlyChange: (value: boolean) => void;
  onSaleOnly?: boolean;
  onOnSaleOnlyChange?: (value: boolean) => void;
  selectedSizes?: string[];
  onSizeRemove?: (size: string) => void;
  selectedColors?: string[];
  onColorRemove?: (color: string) => void;
  selectedMaterials?: string[];
  onMaterialRemove?: (material: string) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  activeCollection?: { title: string; slug: string };
  onClearCollection?: () => void;
  types?: Array<{ id: string; name: string; slug: string }>;
  selectedType?: string;
  onTypeChange?: (typeId: string) => void;
  categories?: Array<{ id: string; name: string; slug: string }>;
  selectedCategory?: string;
  onCategoryChange?: (categoryId: string) => void;
  tags?: Array<{ id: string; name: string }>;
  selectedTags?: string[];
  onTagToggle?: (tag: string) => void;
  onOpenMobileFilters?: () => void;
  activeFilterCount?: number;
  layoutMode?: "grid-4" | "grid-3" | "grid-2" | "list";
  onLayoutModeChange?: (mode: "grid-4" | "grid-3" | "grid-2" | "list") => void;
}

function getRecentSearches(storeSlug?: string): string[] {
  if (typeof window === "undefined" || !storeSlug) return [];
  try {
    const raw = localStorage.getItem(`cc_${storeSlug}_recent_searches`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(storeSlug: string | undefined, query: string): void {
  if (typeof window === "undefined" || !storeSlug || !query.trim()) return;
  try {
    const trimmed = query.trim();
    const existing = getRecentSearches(storeSlug);
    const updated = [trimmed, ...existing.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, 5);
    localStorage.setItem(`cc_${storeSlug}_recent_searches`, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

function clearRecentSearches(storeSlug?: string): void {
  if (typeof window === "undefined" || !storeSlug) return;
  try {
    localStorage.removeItem(`cc_${storeSlug}_recent_searches`);
  } catch {
    // Ignore
  }
}

export function CatalogFilterBar({
  storeSlug,
  storeCurrency = "USD",
  search,
  onSearchChange,
  minPrice,
  onMinPriceChange,
  maxPrice,
  onMaxPriceChange,
  inStockOnly,
  onInStockOnlyChange,
  onSaleOnly = false,
  onOnSaleOnlyChange,
  selectedSizes = [],
  onSizeRemove,
  selectedColors = [],
  onColorRemove,
  selectedMaterials = [],
  onMaterialRemove,
  sortBy,
  onSortByChange,
  onClearFilters,
  hasActiveFilters,
  activeCollection,
  onClearCollection,
  types,
  selectedType,
  onTypeChange,
  categories,
  selectedCategory,
  onCategoryChange,
  selectedTags = [],
  onTagToggle,
  onOpenMobileFilters,
  activeFilterCount = 0,
  layoutMode = "grid-4",
  onLayoutModeChange,
}: CatalogFilterBarProps) {
  // Local state for debounced search input
  const [localSearch, setLocalSearch] = useState(search);
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestionItemDTO[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Sync prop changes into local search
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Load recent searches
  useEffect(() => {
    if (storeSlug) {
      setRecentSearches(getRecentSearches(storeSlug));
    }
  }, [storeSlug]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch search suggestions debounced
  useEffect(() => {
    if (!storeSlug || !localSearch.trim() || localSearch.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await apiClient.get<SearchSuggestionsResultDTO>(
          `/api/v1/storefront/${encodeURIComponent(storeSlug)}/products/search-suggestions`,
          { params: { q: localSearch.trim() } },
        );
        if (res && res.suggestions) {
          setSuggestions(res.suggestions);
        }
      } catch {
        setSuggestions([]);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [localSearch, storeSlug]);

  // Debounce search update to parent
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== search) {
        onSearchChange(localSearch);
        if (localSearch.trim()) {
          saveRecentSearch(storeSlug, localSearch.trim());
          if (storeSlug) setRecentSearches(getRecentSearches(storeSlug));
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, search, onSearchChange, storeSlug]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange(localSearch);
    if (localSearch.trim()) {
      saveRecentSearch(storeSlug, localSearch.trim());
      if (storeSlug) setRecentSearches(getRecentSearches(storeSlug));
    }
    setIsFocused(false);
  };

  const handleSearchClear = () => {
    setLocalSearch("");
    onSearchChange("");
    setSuggestions([]);
  };

  const handleSelectRecent = (term: string) => {
    setLocalSearch(term);
    onSearchChange(term);
    setIsFocused(false);
  };

  const handleClearRecents = () => {
    clearRecentSearches(storeSlug);
    setRecentSearches([]);
  };

  const showDropdown =
    isFocused &&
    ((recentSearches.length > 0 && !localSearch.trim()) || suggestions.length > 0);

  return (
    <div
      className="storefront-catalog-filter-bar w-full space-y-3.5"
      data-testid="catalog-filter-bar"
    >
      {/* Primary Toolbar Row: Search + Secondary Controls */}
      <div className="storefront-filter-controls-row flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input with Autocomplete Suggestions */}
        <div ref={searchContainerRef} className="relative flex-1 min-w-0 max-w-md">
          <form
            onSubmit={handleSearchSubmit}
            className="storefront-search-form"
            role="search"
            aria-label="Search catalog products"
          >
            <div className="storefront-search-input-wrap relative flex items-center">
              <Search
                className="storefront-search-icon absolute left-3.5 text-muted-foreground pointer-events-none"
                aria-hidden="true"
                size={16}
              />
              <input
                type="search"
                value={localSearch}
                onFocus={() => setIsFocused(true)}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Search products, brands, SKU, sizes..."
                className="storefront-search-input w-full pl-10 pr-9 py-2.5 rounded-full bg-muted/40 border border-border/60 text-xs text-foreground placeholder:text-muted-foreground focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-xs"
                data-testid="catalog-search-input"
                aria-label="Search products"
                autoComplete="off"
              />
              {localSearch && (
                <button
                  type="button"
                  onClick={handleSearchClear}
                  className="storefront-search-clear-btn absolute right-3 text-muted-foreground hover:text-foreground p-1 transition-colors"
                  aria-label="Clear search query"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </form>

          {/* Autocomplete / Recent Dropdown */}
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-2xl border border-border/80 bg-background/95 backdrop-blur-md shadow-2xl overflow-hidden divide-y divide-border/40 animate-in fade-in-50 zoom-in-95 duration-150">
              {/* Recent searches */}
              {!localSearch.trim() && recentSearches.length > 0 && (
                <div className="p-3">
                  <div className="flex items-center justify-between pb-2 px-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-bold">
                      <Clock size={12} />
                      Recent Searches
                    </span>
                    <button
                      type="button"
                      onClick={handleClearRecents}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recentSearches.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => handleSelectRecent(term)}
                        className="px-2.5 py-1 rounded-lg text-xs bg-muted/40 hover:bg-muted text-foreground transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Search size={11} className="text-muted-foreground" />
                        <span>{term}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="p-2 max-h-80 overflow-y-auto divide-y divide-border/30">
                  {suggestions.map((item, idx) => (
                    <div key={`${item.type}-${item.title}-${idx}`} className="py-1">
                      {item.type === "product" ? (
                        <a
                          href={
                            item.slug
                              ? `/stores/${encodeURIComponent(storeSlug || "")}/products/${encodeURIComponent(item.slug)}`
                              : "#"
                          }
                          className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors group"
                        >
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              className="h-10 w-10 rounded-lg object-cover bg-muted shrink-0"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                              <Sparkles size={16} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                              {item.title}
                            </h4>
                            <div className="flex items-center gap-2 pt-0.5">
                              {item.price !== null && item.price !== undefined && (
                                <span className="text-[11px] font-bold text-foreground">
                                  {formatStorePrice(item.price, item.currency || storeCurrency)}
                                </span>
                              )}
                              {item.inStock !== undefined && (
                                <span
                                  className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-full ${
                                    item.inStock
                                      ? "bg-emerald-500/10 text-emerald-600"
                                      : "bg-amber-500/10 text-amber-600"
                                  }`}
                                >
                                  {item.inStock ? "In Stock" : "Out of Stock"}
                                </span>
                              )}
                            </div>
                          </div>
                          <ExternalLink size={13} className="text-muted-foreground opacity-40 group-hover:opacity-100 transition-opacity" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setLocalSearch(item.title);
                            onSearchChange(item.title);
                            setIsFocused(false);
                          }}
                          className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-muted/50 text-left transition-colors cursor-pointer group"
                        >
                          {item.type === "category" ? (
                            <Folder size={14} className="text-primary shrink-0" />
                          ) : (
                            <Tag size={14} className="text-primary shrink-0" />
                          )}
                          <span className="text-xs font-medium text-foreground flex-1 truncate group-hover:text-primary transition-colors">
                            {item.title}
                          </span>
                          <span className="text-[10px] font-mono uppercase text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                            {item.type}
                          </span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filter Controls Group */}
        <div className="storefront-filter-options-wrap flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Mobile Filter Button (opens drawer) */}
          {onOpenMobileFilters && (
            <button
              type="button"
              onClick={onOpenMobileFilters}
              className="lg:hidden inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-muted/40 hover:bg-muted/70 border border-border/60 text-xs font-bold text-foreground transition-all cursor-pointer"
            >
              <SlidersHorizontal size={14} className="text-primary" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-black">
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}

          {/* Sort Dropdown */}
          <div className="storefront-sort-group relative flex items-center">
            <ArrowUpDown
              size={13}
              className="storefront-sort-icon absolute left-3 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
            <select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value)}
              className="storefront-sort-select pl-8 pr-8 py-2 rounded-full bg-muted/40 hover:bg-muted/60 border border-border/60 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer transition-all shadow-xs"
              data-testid="catalog-sort-select"
              aria-label="Sort products by"
            >
              <option value="featured">Featured</option>
              <option value="newest">Newest Arrivals</option>
              <option value="best_selling">Best Selling</option>
              <option value="most_popular">Most Popular</option>
              <option value="highest_rated">Highest Rated</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="title_asc">Alphabetical: A to Z</option>
              <option value="title_desc">Alphabetical: Z to A</option>
            </select>
          </div>

          {/* Layout Density Switcher */}
          {onLayoutModeChange && (
            <div className="hidden sm:inline-flex items-center p-1 rounded-full bg-muted/40 border border-border/60 gap-0.5">
              <button
                type="button"
                onClick={() => onLayoutModeChange("grid-4")}
                className={`p-1.5 rounded-full transition-colors ${
                  layoutMode === "grid-4"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="4-Column Grid View"
                aria-label="4-Column Grid View"
              >
                <Grid2x2 size={13} />
              </button>
              <button
                type="button"
                onClick={() => onLayoutModeChange("grid-3")}
                className={`p-1.5 rounded-full transition-colors ${
                  layoutMode === "grid-3"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="3-Column Grid View"
                aria-label="3-Column Grid View"
              >
                <Columns3 size={13} />
              </button>
              <button
                type="button"
                onClick={() => onLayoutModeChange("grid-2")}
                className={`p-1.5 rounded-full transition-colors ${
                  layoutMode === "grid-2"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="2-Column Lookbook View"
                aria-label="2-Column Grid View"
              >
                <Columns2 size={13} />
              </button>
              <button
                type="button"
                onClick={() => onLayoutModeChange("list")}
                className={`p-1.5 rounded-full transition-colors ${
                  layoutMode === "list"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="List View"
                aria-label="List View"
              >
                <List size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Active Filter Chips & Clear Action */}
      {(hasActiveFilters ||
        search.trim() ||
        minPrice.trim() ||
        maxPrice.trim() ||
        inStockOnly ||
        onSaleOnly ||
        selectedSizes.length > 0 ||
        selectedColors.length > 0 ||
        selectedMaterials.length > 0 ||
        selectedType ||
        selectedCategory ||
        (selectedTags && selectedTags.length > 0) ||
        activeCollection) && (
        <div
          className="storefront-active-filters-row flex flex-wrap items-center gap-1.5 pt-1 text-xs"
          data-testid="active-filter-chips"
        >
          <span className="storefront-active-filters-label text-muted-foreground flex items-center gap-1 text-[11px] font-medium mr-1">
            <SlidersHorizontal size={12} aria-hidden="true" />
            Active:
          </span>

          {search.trim() && (
            <span
              className="storefront-filter-chip inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-medium"
              data-testid="chip-search"
            >
              &ldquo;{search.trim()}&rdquo;
              <button
                type="button"
                onClick={handleSearchClear}
                className="storefront-chip-remove hover:text-foreground p-0.5 rounded-full cursor-pointer"
                aria-label="Remove keyword filter"
              >
                <X size={11} />
              </button>
            </span>
          )}

          {inStockOnly && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs font-medium">
              In Stock
              <button
                type="button"
                onClick={() => onInStockOnlyChange(false)}
                className="hover:text-foreground p-0.5 rounded-full cursor-pointer"
              >
                <X size={11} />
              </button>
            </span>
          )}

          {onSaleOnly && onOnSaleOnlyChange && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 text-xs font-medium">
              On Sale
              <button
                type="button"
                onClick={() => onOnSaleOnlyChange(false)}
                className="hover:text-foreground p-0.5 rounded-full cursor-pointer"
              >
                <X size={11} />
              </button>
            </span>
          )}

          {(minPrice || maxPrice) && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-medium">
              ${minPrice || "0"} – ${maxPrice || "Any"}
              <button
                type="button"
                onClick={() => {
                  onMinPriceChange("");
                  onMaxPriceChange("");
                }}
                className="hover:text-foreground p-0.5 rounded-full cursor-pointer"
              >
                <X size={11} />
              </button>
            </span>
          )}

          {selectedSizes.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-muted text-foreground border border-border/60 text-xs font-medium"
            >
              Size: {s}
              {onSizeRemove && (
                <button
                  type="button"
                  onClick={() => onSizeRemove(s)}
                  className="hover:text-foreground p-0.5 rounded-full cursor-pointer"
                >
                  <X size={11} />
                </button>
              )}
            </span>
          ))}

          {selectedColors.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-muted text-foreground border border-border/60 text-xs font-medium"
            >
              Color: {c}
              {onColorRemove && (
                <button
                  type="button"
                  onClick={() => onColorRemove(c)}
                  className="hover:text-foreground p-0.5 rounded-full cursor-pointer"
                >
                  <X size={11} />
                </button>
              )}
            </span>
          ))}

          {selectedMaterials.map((m) => (
            <span
              key={m}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-muted text-foreground border border-border/60 text-xs font-medium"
            >
              {m}
              {onMaterialRemove && (
                <button
                  type="button"
                  onClick={() => onMaterialRemove(m)}
                  className="hover:text-foreground p-0.5 rounded-full cursor-pointer"
                >
                  <X size={11} />
                </button>
              )}
            </span>
          ))}

          {selectedType && onTypeChange && types && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-medium">
              Type: {types.find((t) => t.id === selectedType)?.name || selectedType}
              <button
                type="button"
                onClick={() => onTypeChange("")}
                className="hover:text-foreground p-0.5 rounded-full cursor-pointer"
              >
                <X size={11} />
              </button>
            </span>
          )}

          {selectedCategory && onCategoryChange && categories && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-medium">
              Category: {categories.find((c) => c.id === selectedCategory)?.name || selectedCategory}
              <button
                type="button"
                onClick={() => onCategoryChange("")}
                className="hover:text-foreground p-0.5 rounded-full cursor-pointer"
              >
                <X size={11} />
              </button>
            </span>
          )}

          {activeCollection && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-medium">
              Collection: {activeCollection.title}
              {onClearCollection && (
                <button
                  type="button"
                  onClick={onClearCollection}
                  className="hover:text-foreground p-0.5 rounded-full cursor-pointer"
                >
                  <X size={11} />
                </button>
              )}
            </span>
          )}

          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-muted text-foreground border border-border/60 text-xs font-medium"
            >
              #{tag}
              {onTagToggle && (
                <button
                  type="button"
                  onClick={() => onTagToggle(tag)}
                  className="hover:text-foreground p-0.5 rounded-full cursor-pointer"
                >
                  <X size={11} />
                </button>
              )}
            </span>
          ))}

          <button
            type="button"
            onClick={onClearFilters}
            className="storefront-clear-all-btn text-[11px] font-semibold text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1 cursor-pointer transition-colors"
            data-testid="clear-all-filters-btn"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
