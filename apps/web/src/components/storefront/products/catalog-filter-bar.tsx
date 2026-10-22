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
    <div className="storefront-catalog-filter-bar" data-testid="catalog-filter-bar">
      {/* Top Controls Row: Search + Sort */}
      <div className="storefront-filter-controls-row">
        {/* Search input form */}
        <form
          onSubmit={handleSearchSubmit}
          className="storefront-search-form"
          role="search"
          aria-label="Search catalog products"
        >
          <div className="storefront-search-input-wrap">
            <Search className="storefront-search-icon" aria-hidden="true" size={18} />
            <input
              type="search"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search products by title, description, or SKU..."
              className="storefront-search-input"
              data-testid="catalog-search-input"
              aria-label="Search products"
            />
            {localSearch && (
              <button
                type="button"
                onClick={handleSearchClear}
                className="storefront-search-clear-btn"
                aria-label="Clear search query"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </form>

        {/* Secondary controls: Price range, In-stock, and Sort */}
        <div className="storefront-filter-options-wrap">
          {/* Price Range Filter */}
          <div className="storefront-price-filter-group" aria-label="Price range filter">
            <span className="storefront-filter-label">Price:</span>
            <div className="storefront-price-inputs">
              <input
                type="number"
                min="0"
                step="any"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => onMinPriceChange(e.target.value)}
                className="storefront-price-input"
                data-testid="filter-min-price"
                aria-label="Minimum price in dollars"
              />
              <span className="storefront-price-sep" aria-hidden="true">–</span>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => onMaxPriceChange(e.target.value)}
                className="storefront-price-input"
                data-testid="filter-max-price"
                aria-label="Maximum price in dollars"
              />
            </div>
          </div>

          {/* Availability Toggle */}
          <label className="storefront-in-stock-label" data-testid="filter-in-stock-label">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => onInStockOnlyChange(e.target.checked)}
              className="storefront-in-stock-checkbox"
              data-testid="filter-in-stock-checkbox"
            />
            <span>In stock only</span>
          </label>

          {/* Sort Dropdown */}
          <div className="storefront-sort-group">
            <ArrowUpDown size={15} className="storefront-sort-icon" aria-hidden="true" />
            <select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value)}
              className="storefront-sort-select"
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

      {/* Active Filter Chips & Clear Action */}
      {(hasActiveFilters || activeCollection) && (
        <div className="storefront-active-filters-row" data-testid="active-filter-chips">
          <span className="storefront-active-filters-label">
            <SlidersHorizontal size={13} aria-hidden="true" />
            Active filters:
          </span>

          {search.trim() && (
            <span className="storefront-filter-chip" data-testid="chip-search">
              Keyword: &ldquo;{search.trim()}&rdquo;
              <button
                type="button"
                onClick={handleSearchClear}
                className="storefront-chip-remove"
                aria-label="Remove keyword filter"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {(minPrice || maxPrice) && (
            <span className="storefront-filter-chip" data-testid="chip-price">
              Price: ${minPrice || "0"} – ${maxPrice || "Any"}
              <button
                type="button"
                onClick={() => {
                  onMinPriceChange("");
                  onMaxPriceChange("");
                }}
                className="storefront-chip-remove"
                aria-label="Remove price filter"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {inStockOnly && (
            <span className="storefront-filter-chip" data-testid="chip-in-stock">
              In stock only
              <button
                type="button"
                onClick={() => onInStockOnlyChange(false)}
                className="storefront-chip-remove"
                aria-label="Remove in stock filter"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {activeCollection && (
            <span className="storefront-filter-chip" data-testid="chip-collection">
              Collection: {activeCollection.title}
              {onClearCollection && (
                <button
                  type="button"
                  onClick={onClearCollection}
                  className="storefront-chip-remove"
                  aria-label="Remove collection filter"
                >
                  <X size={12} />
                </button>
              )}
            </span>
          )}

          <button
            type="button"
            onClick={onClearFilters}
            className="storefront-clear-all-btn"
            data-testid="clear-all-filters-btn"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
