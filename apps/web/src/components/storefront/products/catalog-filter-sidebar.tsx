"use client";

import React, { useState } from "react";
import {
  SlidersHorizontal,
  X,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Check,
  Tag,
  Layers,
  Palette,
  Ruler,
  DollarSign,
  Percent,
  PackageCheck,
} from "lucide-react";
import type { CatalogFilterFacetsDTO } from "@calcart/products";

export interface CatalogFilterSidebarProps {
  facets: CatalogFilterFacetsDTO | null;
  currency?: string;
  totalResults: number;
  // State
  minPrice: string;
  onMinPriceChange: (val: string) => void;
  maxPrice: string;
  onMaxPriceChange: (val: string) => void;
  inStockOnly: boolean;
  onInStockOnlyChange: (val: boolean) => void;
  onSaleOnly: boolean;
  onOnSaleOnlyChange: (val: boolean) => void;
  selectedSizes: string[];
  onSizeToggle: (size: string) => void;
  selectedColors: string[];
  onColorToggle: (color: string) => void;
  selectedMaterials: string[];
  onMaterialToggle: (material: string) => void;
  selectedType: string;
  onTypeChange: (typeId: string) => void;
  selectedCategory: string;
  onCategoryChange: (categoryId: string) => void;
  onClearAll: () => void;
  hasActiveFilters: boolean;
  // Mobile drawer controls
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

// Color name to CSS color mapping
const COLOR_MAP: Record<string, string> = {
  black: "#0a0a0a",
  white: "#ffffff",
  grey: "#6b7280",
  gray: "#6b7280",
  charcoal: "#374151",
  silver: "#d1d5db",
  navy: "#1e3a8a",
  blue: "#2563eb",
  sky: "#38bdf8",
  teal: "#0d9488",
  cyan: "#06b6d4",
  green: "#16a34a",
  emerald: "#059669",
  olive: "#556b2f",
  forest: "#14532d",
  yellow: "#eab308",
  mustard: "#ca8a04",
  orange: "#ea580c",
  amber: "#d97706",
  red: "#dc2626",
  crimson: "#991b1b",
  maroon: "#800000",
  burgundy: "#701a75",
  pink: "#ec4899",
  rose: "#f43f5e",
  purple: "#9333ea",
  violet: "#7c3aed",
  indigo: "#4f46e5",
  brown: "#78350f",
  tan: "#d2b48c",
  beige: "#f5f5dc",
  cream: "#fffdd0",
  khaki: "#c3b091",
  gold: "#d4af37",
};

function resolveColorHex(colorName: string): string {
  const normalized = colorName.trim().toLowerCase();
  for (const [key, hex] of Object.entries(COLOR_MAP)) {
    if (normalized.includes(key)) {
      return hex;
    }
  }
  return "#94a3b8";
}

export function CatalogFilterSidebar({
  facets,
  totalResults,
  minPrice,
  onMinPriceChange,
  maxPrice,
  onMaxPriceChange,
  inStockOnly,
  onInStockOnlyChange,
  onSaleOnly,
  onOnSaleOnlyChange,
  selectedSizes,
  onSizeToggle,
  selectedColors,
  onColorToggle,
  selectedMaterials,
  onMaterialToggle,
  selectedType,
  onTypeChange,
  selectedCategory,
  onCategoryChange,
  onClearAll,
  hasActiveFilters,
  isOpenMobile = false,
  onCloseMobile,
}: CatalogFilterSidebarProps) {
  // Collapsible section toggles
  const [openSections, setOpenSections] = useState({
    price: true,
    availability: true,
    size: true,
    color: true,
    material: true,
    category: true,
    type: true,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const activeFiltersCount =
    (minPrice ? 1 : 0) +
    (maxPrice ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (onSaleOnly ? 1 : 0) +
    selectedSizes.length +
    selectedColors.length +
    selectedMaterials.length +
    (selectedType ? 1 : 0) +
    (selectedCategory ? 1 : 0);

  // Price presets in dollars
  const pricePresets = [
    { label: "Under $25", min: "", max: "25" },
    { label: "$25 - $50", min: "25", max: "50" },
    { label: "$50 - $100", min: "50", max: "100" },
    { label: "$100+", min: "100", max: "" },
  ];

  // Derive size, color, material options from facets
  const sizeOption = facets?.options?.find(
    (o) => o.name.toLowerCase() === "size" || o.name.toLowerCase() === "sizes",
  );
  const colorOption = facets?.options?.find(
    (o) =>
      o.name.toLowerCase() === "color" ||
      o.name.toLowerCase() === "colour" ||
      o.name.toLowerCase() === "colors",
  );
  const materialOption = facets?.options?.find(
    (o) =>
      o.name.toLowerCase() === "material" ||
      o.name.toLowerCase() === "fabric" ||
      o.name.toLowerCase() === "materials",
  );

  const content = (
    <div className="space-y-6">
      {/* Header bar on desktop / drawer top */}
      <div className="flex items-center justify-between pb-3 border-b border-[color:var(--at-hairline)]">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={16} className="text-primary" />
          <span className="font-bold text-sm tracking-tight text-foreground">Filters</span>
          {activeFiltersCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
              {activeFiltersCount}
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
          >
            <RotateCcw size={12} />
            <span>Reset All</span>
          </button>
        )}
      </div>

      {/* 1. Availability & Sale Switches */}
      <div className="space-y-3">
        <label className="flex items-center justify-between p-3 rounded-none border border-[color:var(--at-hairline)] bg-transparent hover:bg-transparent transition-colors cursor-pointer select-none">
          <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <PackageCheck size={15} className="text-primary" />
            <span>In Stock Only</span>
          </span>
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => onInStockOnlyChange(e.target.checked)}
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between p-3 rounded-none border border-[color:var(--at-hairline)] bg-transparent hover:bg-transparent transition-colors cursor-pointer select-none">
          <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Percent size={15} className="text-destructive" />
            <span>On Sale / Discounted</span>
          </span>
          <input
            type="checkbox"
            checked={onSaleOnly}
            onChange={(e) => onOnSaleOnlyChange(e.target.checked)}
            className="h-4 w-4 rounded border-border text-destructive focus:ring-destructive cursor-pointer"
          />
        </label>
      </div>

      {/* 2. Price Range */}
      <div className="border-t border-[color:var(--at-hairline)] pt-4">
        <button
          type="button"
          onClick={() => toggleSection("price")}
          className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-foreground pb-3 cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <DollarSign size={14} className="text-muted-foreground" />
            <span>Price Range</span>
          </span>
          {openSections.price ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {openSections.price && (
          <div className="space-y-3 pt-1">
            {/* Min / Max Inputs */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-muted-foreground block mb-1">Min ($)</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={minPrice}
                  onChange={(e) => onMinPriceChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-none bg-transparent border border-[color:var(--at-hairline)] text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary transition-all"
                />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block mb-1">Max ($)</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Any"
                  value={maxPrice}
                  onChange={(e) => onMaxPriceChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-none bg-transparent border border-[color:var(--at-hairline)] text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary transition-all"
                />
              </div>
            </div>

            {/* Price Presets */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {pricePresets.map((preset) => {
                const isActive = minPrice === preset.min && maxPrice === preset.max;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      if (isActive) {
                        onMinPriceChange("");
                        onMaxPriceChange("");
                      } else {
                        onMinPriceChange(preset.min);
                        onMaxPriceChange(preset.max);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-none text-[11px] font-medium transition-all cursor-pointer ${
                      isActive
                        ? "bg-foreground text-background font-bold "
                        : "bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. Sizes */}
      {sizeOption && sizeOption.values && sizeOption.values.length > 0 && (
        <div className="border-t border-[color:var(--at-hairline)] pt-4">
          <button
            type="button"
            onClick={() => toggleSection("size")}
            className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-foreground pb-3 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Ruler size={14} className="text-muted-foreground" />
              <span>Size</span>
              {selectedSizes.length > 0 && (
                <span className="text-[10px] text-primary lowercase font-normal">
                  ({selectedSizes.length} selected)
                </span>
              )}
            </span>
            {openSections.size ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {openSections.size && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {sizeOption.values.map((s) => {
                const isSelected = selectedSizes.includes(s.value);
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => onSizeToggle(s.value)}
                    className={`min-w-9 px-2.5 py-1.5 rounded-none text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? "bg-primary text-primary-foreground  scale-105"
                        : "bg-transparent hover:bg-muted text-foreground border border-[color:var(--at-hairline)]"
                    }`}
                  >
                    <span>{s.value}</span>
                    <span className="text-[9px] opacity-70">({s.count})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. Colors */}
      {colorOption && colorOption.values && colorOption.values.length > 0 && (
        <div className="border-t border-[color:var(--at-hairline)] pt-4">
          <button
            type="button"
            onClick={() => toggleSection("color")}
            className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-foreground pb-3 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Palette size={14} className="text-muted-foreground" />
              <span>Color</span>
              {selectedColors.length > 0 && (
                <span className="text-[10px] text-primary lowercase font-normal">
                  ({selectedColors.length} selected)
                </span>
              )}
            </span>
            {openSections.color ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {openSections.color && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              {colorOption.values.map((c) => {
                const isSelected = selectedColors.includes(c.value);
                const hex = resolveColorHex(c.value);
                const isWhite = hex.toLowerCase() === "#ffffff" || hex.toLowerCase() === "#fffdd0";
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => onColorToggle(c.value)}
                    className={`flex items-center gap-2 p-1.5 rounded-none border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/10  font-bold"
                        : "border-border/40 bg-muted/20 hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <span
                      className={`h-4 w-4 rounded-full shrink-0 flex items-center justify-center ${
                        isWhite ? "border border-[color:var(--at-hairline)]" : ""
                      }`}
                      style={{ backgroundColor: hex }}
                    >
                      {isSelected && (
                        <Check
                          size={10}
                          className={isWhite ? "text-foreground" : "text-white"}
                        />
                      )}
                    </span>
                    <span className="text-xs truncate flex-1">{c.value}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {c.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. Materials */}
      {materialOption && materialOption.values && materialOption.values.length > 0 && (
        <div className="border-t border-[color:var(--at-hairline)] pt-4">
          <button
            type="button"
            onClick={() => toggleSection("material")}
            className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-foreground pb-3 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Layers size={14} className="text-muted-foreground" />
              <span>Material</span>
            </span>
            {openSections.material ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {openSections.material && (
            <div className="space-y-1.5 pt-1">
              {materialOption.values.map((m) => {
                const isSelected = selectedMaterials.includes(m.value);
                return (
                  <label
                    key={m.value}
                    className="flex items-center justify-between text-xs p-1.5 rounded-none hover:bg-transparent cursor-pointer select-none"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onMaterialToggle(m.value)}
                        className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                      />
                      <span className={isSelected ? "font-bold text-foreground" : "text-foreground/90"}>
                        {m.value}
                      </span>
                    </span>
                    <span className="text-[10px] text-muted-foreground">({m.count})</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 6. Categories */}
      {facets && facets.categories && facets.categories.length > 0 && (
        <div className="border-t border-[color:var(--at-hairline)] pt-4">
          <button
            type="button"
            onClick={() => toggleSection("category")}
            className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-foreground pb-3 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Tag size={14} className="text-muted-foreground" />
              <span>Category</span>
            </span>
            {openSections.category ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {openSections.category && (
            <div className="space-y-1.5 pt-1">
              {facets.categories.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <label
                    key={cat.id}
                    className="flex items-center justify-between text-xs p-1.5 rounded-none hover:bg-transparent cursor-pointer select-none"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="facet-category"
                        checked={isSelected}
                        onChange={() => onCategoryChange(isSelected ? "" : cat.id)}
                        className="h-3.5 w-3.5 text-primary focus:ring-primary cursor-pointer"
                      />
                      <span className={isSelected ? "font-bold text-foreground" : "text-foreground/90"}>
                        {cat.name}
                      </span>
                    </span>
                    <span className="text-[10px] text-muted-foreground">({cat.count})</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 7. Product Type */}
      {facets && facets.productTypes && facets.productTypes.length > 0 && (
        <div className="border-t border-[color:var(--at-hairline)] pt-4">
          <button
            type="button"
            onClick={() => toggleSection("type")}
            className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-foreground pb-3 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Tag size={14} className="text-muted-foreground" />
              <span>Product Type</span>
            </span>
            {openSections.type ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {openSections.type && (
            <div className="space-y-1.5 pt-1">
              {facets.productTypes.map((t) => {
                const isSelected = selectedType === t.id;
                return (
                  <label
                    key={t.id}
                    className="flex items-center justify-between text-xs p-1.5 rounded-none hover:bg-transparent cursor-pointer select-none"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="facet-type"
                        checked={isSelected}
                        onChange={() => onTypeChange(isSelected ? "" : t.id)}
                        className="h-3.5 w-3.5 text-primary focus:ring-primary cursor-pointer"
                      />
                      <span className={isSelected ? "font-bold text-foreground" : "text-foreground/90"}>
                        {t.name}
                      </span>
                    </span>
                    <span className="text-[10px] text-muted-foreground">({t.count})</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 xl:w-72 shrink-0">
        <div className="sticky top-24 rounded-none border border-[color:var(--at-hairline)] bg-card/60 backdrop-blur-md p-5 ">
          {content}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Slide-over panel */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-background border-l border-[color:var(--at-hairline)]  flex flex-col">
              {/* Drawer Top */}
              <div className="p-4 sm:p-6 border-b border-[color:var(--at-hairline)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={18} className="text-primary" />
                  <h2 className="text-base font-bold text-foreground">Filter Catalog</h2>
                </div>
                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  aria-label="Close filters drawer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">{content}</div>

              {/* Drawer Bottom Actions */}
              <div className="p-4 sm:p-6 border-t border-[color:var(--at-hairline)] bg-muted/20 flex items-center gap-3">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={onClearAll}
                    className="btn btn-outline btn-md flex-1 rounded-none text-xs font-bold"
                  >
                    Reset All
                  </button>
                )}
                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="btn btn-primary btn-md flex-1 rounded-none text-xs font-bold  shadow-primary/20"
                >
                  Show {totalResults} {totalResults === 1 ? "Result" : "Results"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
