"use client";

import React from "react";
import { X, RotateCcw } from "lucide-react";

export interface ActiveFilterChipsProps {
  search: string;
  onClearSearch: () => void;
  minPrice: string;
  maxPrice: string;
  onClearPrice: () => void;
  inStockOnly: boolean;
  onClearInStock: () => void;
  onSaleOnly: boolean;
  onClearOnSale: () => void;
  selectedSizes: string[];
  onRemoveSize: (size: string) => void;
  selectedColors: string[];
  onRemoveColor: (color: string) => void;
  selectedMaterials: string[];
  onRemoveMaterial: (material: string) => void;
  selectedType: string;
  typeName?: string;
  onClearType: () => void;
  selectedCategory: string;
  categoryName?: string;
  onClearCategory: () => void;
  selectedTags: string[];
  onRemoveTag: (tag: string) => void;
  onClearAll: () => void;
  totalResults: number;
}

export function ActiveFilterChips({
  search,
  onClearSearch,
  minPrice,
  maxPrice,
  onClearPrice,
  inStockOnly,
  onClearInStock,
  onSaleOnly,
  onClearOnSale,
  selectedSizes,
  onRemoveSize,
  selectedColors,
  onRemoveColor,
  selectedMaterials,
  onRemoveMaterial,
  selectedType,
  typeName,
  onClearType,
  selectedCategory,
  categoryName,
  onClearCategory,
  selectedTags,
  onRemoveTag,
  onClearAll,
  totalResults,
}: ActiveFilterChipsProps) {
  const hasAnyFilter = Boolean(
    search.trim() ||
      minPrice ||
      maxPrice ||
      inStockOnly ||
      onSaleOnly ||
      selectedSizes.length > 0 ||
      selectedColors.length > 0 ||
      selectedMaterials.length > 0 ||
      selectedType ||
      selectedCategory ||
      selectedTags.length > 0,
  );

  if (!hasAnyFilter) return null;

  return (
    <div
      className="active-filter-chips flex flex-wrap items-center gap-2 py-3 px-4 rounded-none bg-transparent border border-[color:var(--at-hairline)] text-xs"
      data-testid="active-filter-chips"
    >
      <span className="font-semibold text-muted-foreground mr-1">Active Filters ({totalResults} {totalResults === 1 ? "item" : "items"}):</span>

      {/* Search Query Chip */}
      {search.trim() && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-none bg-background border border-[color:var(--at-hairline)] text-foreground font-medium shadow-2xs">
          <span>Search: &ldquo;{search}&rdquo;</span>
          <button
            type="button"
            onClick={onClearSearch}
            className="hover:text-destructive p-0.5 rounded transition-colors"
            aria-label="Remove search filter"
          >
            <X size={12} />
          </button>
        </span>
      )}

      {/* Price Range Chip */}
      {(minPrice || maxPrice) && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-none bg-background border border-[color:var(--at-hairline)] text-foreground font-medium shadow-2xs">
          <span>
            Price: {minPrice ? `$${minPrice}` : "$0"} - {maxPrice ? `$${maxPrice}` : "Any"}
          </span>
          <button
            type="button"
            onClick={onClearPrice}
            className="hover:text-destructive p-0.5 rounded transition-colors"
            aria-label="Remove price filter"
          >
            <X size={12} />
          </button>
        </span>
      )}

      {/* In Stock Only */}
      {inStockOnly && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-none bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-medium">
          <span>In Stock</span>
          <button
            type="button"
            onClick={onClearInStock}
            className="hover:opacity-80 p-0.5 rounded transition-opacity"
            aria-label="Remove in stock filter"
          >
            <X size={12} />
          </button>
        </span>
      )}

      {/* On Sale Only */}
      {onSaleOnly && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-none bg-destructive/10 border border-destructive/30 text-destructive font-medium">
          <span>On Sale</span>
          <button
            type="button"
            onClick={onClearOnSale}
            className="hover:opacity-80 p-0.5 rounded transition-opacity"
            aria-label="Remove on sale filter"
          >
            <X size={12} />
          </button>
        </span>
      )}

      {/* Category */}
      {selectedCategory && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-none bg-background border border-[color:var(--at-hairline)] text-foreground font-medium shadow-2xs">
          <span>Category: {categoryName || "Selected"}</span>
          <button
            type="button"
            onClick={onClearCategory}
            className="hover:text-destructive p-0.5 rounded transition-colors"
            aria-label="Remove category filter"
          >
            <X size={12} />
          </button>
        </span>
      )}

      {/* Type */}
      {selectedType && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-none bg-background border border-[color:var(--at-hairline)] text-foreground font-medium shadow-2xs">
          <span>Type: {typeName || "Selected"}</span>
          <button
            type="button"
            onClick={onClearType}
            className="hover:text-destructive p-0.5 rounded transition-colors"
            aria-label="Remove type filter"
          >
            <X size={12} />
          </button>
        </span>
      )}

      {/* Sizes */}
      {selectedSizes.map((size) => (
        <span
          key={`size-${size}`}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-none bg-background border border-[color:var(--at-hairline)] text-foreground font-medium shadow-2xs"
        >
          <span>Size: {size}</span>
          <button
            type="button"
            onClick={() => onRemoveSize(size)}
            className="hover:text-destructive p-0.5 rounded transition-colors"
            aria-label={`Remove size ${size}`}
          >
            <X size={12} />
          </button>
        </span>
      ))}

      {/* Colors */}
      {selectedColors.map((color) => (
        <span
          key={`color-${color}`}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-none bg-background border border-[color:var(--at-hairline)] text-foreground font-medium shadow-2xs"
        >
          <span>Color: {color}</span>
          <button
            type="button"
            onClick={() => onRemoveColor(color)}
            className="hover:text-destructive p-0.5 rounded transition-colors"
            aria-label={`Remove color ${color}`}
          >
            <X size={12} />
          </button>
        </span>
      ))}

      {/* Materials */}
      {selectedMaterials.map((mat) => (
        <span
          key={`mat-${mat}`}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-none bg-background border border-[color:var(--at-hairline)] text-foreground font-medium shadow-2xs"
        >
          <span>Material: {mat}</span>
          <button
            type="button"
            onClick={() => onRemoveMaterial(mat)}
            className="hover:text-destructive p-0.5 rounded transition-colors"
            aria-label={`Remove material ${mat}`}
          >
            <X size={12} />
          </button>
        </span>
      ))}

      {/* Tags */}
      {selectedTags.map((tag) => (
        <span
          key={`tag-${tag}`}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-none bg-background border border-[color:var(--at-hairline)] text-foreground font-medium shadow-2xs"
        >
          <span>Tag: #{tag}</span>
          <button
            type="button"
            onClick={() => onRemoveTag(tag)}
            className="hover:text-destructive p-0.5 rounded transition-colors"
            aria-label={`Remove tag ${tag}`}
          >
            <X size={12} />
          </button>
        </span>
      ))}

      {/* Clear All Button */}
      <button
        type="button"
        onClick={onClearAll}
        className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors cursor-pointer py-1 px-2 rounded-none hover:bg-primary/10"
      >
        <RotateCcw size={12} />
        <span>Clear all</span>
      </button>
    </div>
  );
}
