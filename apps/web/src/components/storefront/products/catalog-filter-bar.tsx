"use client";

import React, { useState, useEffect } from "react";
import { Search, X, SlidersHorizontal, ArrowUpDown } from "lucide-react";

export interface CatalogFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  minPrice: string;
  onMinPriceChange: (value: string) => void;
  maxPrice: string;
  onMaxPriceChange: (value: string) => void;
  inStockOnly: boolean;
  onInStockOnlyChange: (value: boolean) => void;
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
}

export function CatalogFilterBar({
  search,
  onSearchChange,
  minPrice,
  onMinPriceChange,
  maxPrice,
  onMaxPriceChange,
  inStockOnly,
  onInStockOnlyChange,
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
  tags,
  selectedTags = [],
  onTagToggle,
}: CatalogFilterBarProps) {
  // Local state for debounced search input
  const [localSearch, setLocalSearch] = useState(search);

  // Sync prop changes into local search
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Debounce search update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== search) {
        onSearchChange(localSearch);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [localSearch, search, onSearchChange]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange(localSearch);
  };

  const handleSearchClear = () => {
    setLocalSearch("");
    onSearchChange("");
  };

  return (
    <div
      className="storefront-catalog-filter-bar w-full bg-card/60 backdrop-blur-md border border-border/60 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4"
      data-testid="catalog-filter-bar"
    >
      {/* Top Controls Row: Search + Filters + Sort */}
      <div className="storefront-filter-controls-row flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Search input form */}
        <form
          onSubmit={handleSearchSubmit}
          className="storefront-search-form flex-1 min-w-0"
          role="search"
          aria-label="Search catalog products"
        >
          <div className="storefront-search-input-wrap relative flex items-center">
            <Search className="storefront-search-icon absolute left-3.5 text-muted-foreground pointer-events-none" aria-hidden="true" size={17} />
            <input
              type="search"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search products by title, description, or SKU..."
              className="storefront-search-input w-full pl-10 pr-9 py-2.5 rounded-full bg-background border border-border/80 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              data-testid="catalog-search-input"
              aria-label="Search products"
            />
            {localSearch && (
              <button
                type="button"
                onClick={handleSearchClear}
                className="storefront-search-clear-btn absolute right-3 text-muted-foreground hover:text-foreground p-1 transition-colors"
                aria-label="Clear search query"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </form>

        {/* Secondary controls: Price range, In-stock, and Sort */}
        <div className="storefront-filter-options-wrap flex flex-wrap items-center gap-3">
          {/* Price Range Filter */}
          <div className="storefront-price-filter-group flex items-center gap-1.5 text-xs bg-background border border-border/80 rounded-full px-3 py-1.5" aria-label="Price range filter">
            <span className="storefront-filter-label text-muted-foreground font-medium">Price:</span>
            <div className="storefront-price-inputs flex items-center gap-1">
              <span className="text-muted-foreground">$</span>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => onMinPriceChange(e.target.value)}
                className="storefront-price-input w-12 bg-transparent text-foreground placeholder:text-muted-foreground text-xs focus:outline-none text-center"
                data-testid="filter-min-price"
                aria-label="Minimum price in dollars"
              />
              <span className="storefront-price-sep text-muted-foreground" aria-hidden="true">–</span>
              <span className="text-muted-foreground">$</span>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => onMaxPriceChange(e.target.value)}
                className="storefront-price-input w-12 bg-transparent text-foreground placeholder:text-muted-foreground text-xs focus:outline-none text-center"
                data-testid="filter-max-price"
                aria-label="Maximum price in dollars"
              />
            </div>
          </div>

          {/* Product Type Filter */}
          {types && types.length > 0 && onTypeChange && (
            <div className="storefront-type-filter relative flex items-center">
              <select
                value={selectedType || ""}
                onChange={(e) => onTypeChange(e.target.value)}
                className="pl-3 pr-7 py-1.5 rounded-full bg-background border border-border/80 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer transition-all"
                aria-label="Filter by Product Type"
              >
                <option value="">All Types</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Category Filter */}
          {categories && categories.length > 0 && onCategoryChange && (
            <div className="storefront-category-filter relative flex items-center">
              <select
                value={selectedCategory || ""}
                onChange={(e) => onCategoryChange(e.target.value)}
                className="pl-3 pr-7 py-1.5 rounded-full bg-background border border-border/80 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer transition-all"
                aria-label="Filter by Category"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Availability Toggle */}
          <label className="storefront-in-stock-label inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-background border border-border/80 text-xs font-medium text-foreground cursor-pointer select-none hover:border-primary/40 transition-colors" data-testid="filter-in-stock-label">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => onInStockOnlyChange(e.target.checked)}
              className="storefront-in-stock-checkbox rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
              data-testid="filter-in-stock-checkbox"
            />
            <span>In stock only</span>
          </label>

          {/* Sort Dropdown */}
          <div className="storefront-sort-group relative flex items-center">
            <ArrowUpDown size={13} className="storefront-sort-icon absolute left-3 text-muted-foreground pointer-events-none" aria-hidden="true" />
            <select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value)}
              className="storefront-sort-select pl-8 pr-8 py-1.5 rounded-full bg-background border border-border/80 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer transition-all"
              data-testid="catalog-sort-select"
              aria-label="Sort products by"
            >
              <option value="created_at_desc">Featured / Newest</option>
              <option value="created_at_asc">Oldest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="title_asc">Alphabetical: A to Z</option>
              <option value="title_desc">Alphabetical: Z to A</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tag Filter Pills */}
      {tags && tags.length > 0 && onTagToggle && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs pt-1 border-t border-border/40">
          <span className="text-muted-foreground font-medium shrink-0 mr-1 text-[11px]">
            Tags:
          </span>
          {tags.map((tag) => {
            const isSelected = selectedTags.includes(tag.name);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => onTagToggle(tag.name)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60"
                }`}
              >
                #{tag.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Active Filter Chips & Clear Action */}
      {(hasActiveFilters || activeCollection || selectedType || selectedCategory || (selectedTags && selectedTags.length > 0)) && (
        <div className="storefront-active-filters-row flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 text-xs" data-testid="active-filter-chips">
          <span className="storefront-active-filters-label text-muted-foreground flex items-center gap-1 font-medium">
            <SlidersHorizontal size={13} aria-hidden="true" />
            Active filters:
          </span>

          {search.trim() && (
            <span className="storefront-filter-chip inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium" data-testid="chip-search">
              Keyword: &ldquo;{search.trim()}&rdquo;
              <button
                type="button"
                onClick={handleSearchClear}
                className="storefront-chip-remove hover:text-foreground p-0.5 rounded-full"
                aria-label="Remove keyword filter"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {(minPrice || maxPrice) && (
            <span className="storefront-filter-chip inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium" data-testid="chip-price">
              Price: ${minPrice || "0"} – ${maxPrice || "Any"}
              <button
                type="button"
                onClick={() => {
                  onMinPriceChange("");
                  onMaxPriceChange("");
                }}
                className="storefront-chip-remove hover:text-foreground p-0.5 rounded-full"
                aria-label="Remove price filter"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {inStockOnly && (
            <span className="storefront-filter-chip inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium" data-testid="chip-in-stock">
              In stock only
              <button
                type="button"
                onClick={() => onInStockOnlyChange(false)}
                className="storefront-chip-remove hover:text-foreground p-0.5 rounded-full"
                aria-label="Remove in stock filter"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {activeCollection && (
            <span className="storefront-filter-chip inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium" data-testid="chip-collection">
              Collection: {activeCollection.title}
              {onClearCollection && (
                <button
                  type="button"
                  onClick={onClearCollection}
                  className="storefront-chip-remove hover:text-foreground p-0.5 rounded-full"
                  aria-label="Remove collection filter"
                >
                  <X size={12} />
                </button>
              )}
            </span>
          )}

          {selectedType && types && (
            <span className="storefront-filter-chip inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
              Type: {types.find((t) => t.id === selectedType)?.name || selectedType}
              {onTypeChange && (
                <button
                  type="button"
                  onClick={() => onTypeChange("")}
                  className="storefront-chip-remove hover:text-foreground p-0.5 rounded-full"
                  aria-label="Remove type filter"
                >
                  <X size={12} />
                </button>
              )}
            </span>
          )}

          {selectedCategory && categories && (
            <span className="storefront-filter-chip inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
              Category: {categories.find((c) => c.id === selectedCategory)?.name || selectedCategory}
              {onCategoryChange && (
                <button
                  type="button"
                  onClick={() => onCategoryChange("")}
                  className="storefront-chip-remove hover:text-foreground p-0.5 rounded-full"
                  aria-label="Remove category filter"
                >
                  <X size={12} />
                </button>
              )}
            </span>
          )}

          {selectedTags && selectedTags.length > 0 && selectedTags.map((tag) => (
            <span key={tag} className="storefront-filter-chip inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
              Tag: #{tag}
              {onTagToggle && (
                <button
                  type="button"
                  onClick={() => onTagToggle(tag)}
                  className="storefront-chip-remove hover:text-foreground p-0.5 rounded-full"
                  aria-label={`Remove tag ${tag}`}
                >
                  <X size={12} />
                </button>
              )}
            </span>
          ))}

          <button
            type="button"
            onClick={onClearFilters}
            className="storefront-clear-all-btn text-muted-foreground hover:text-destructive underline text-xs ml-auto transition-colors font-medium"
            data-testid="clear-all-filters-btn"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
