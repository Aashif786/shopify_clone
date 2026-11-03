"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import type { ProductSummaryDTO } from "@calcart/products";
import type { PaginatedResult } from "@calcart/types";
import { formatStorePrice } from "@/components/storefront/products/product-card";
import {
  Search,
  X,
  Package,
  Check,
  AlertCircle,
  Plus,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

// ============================================================================
// Types
// ============================================================================

export interface ProductPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "single" | "multiple";
  selectedId?: string | null;
  selectedIds?: string[];
  onSelect: (product: ProductSummaryDTO | null) => void;
  onMultiSelect?: (products: ProductSummaryDTO[]) => void;
  products?: ProductSummaryDTO[];
  storeId?: string;
  storeSlug?: string;
  storeCurrency?: string;
  title?: string;
  description?: string;
}

export interface ProductPickerProps {
  value?: string | null;
  values?: string[];
  mode?: "single" | "multiple";
  onChange?: (productId: string | null) => void;
  onMultiChange?: (productIds: string[]) => void;
  products?: ProductSummaryDTO[];
  storeId?: string;
  storeSlug?: string;
  storeCurrency?: string;
  label?: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  emptyLabel?: string;
  className?: string;
}

// Helpers for robust property access across DTO and storefront product representations
export function getProductPrice(p: ProductSummaryDTO): number | null {
  if (typeof p.price === "number") return p.price;
  const anyP = p as unknown as { priceRange?: { min: number } };
  if (anyP.priceRange && typeof anyP.priceRange.min === "number") {
    return anyP.priceRange.min;
  }
  return null;
}

export function getProductImageUrl(p: ProductSummaryDTO): string | null {
  if (p.primaryMediaUrl) return p.primaryMediaUrl;
  const anyP = p as unknown as { primaryImageUrl?: string };
  if (typeof anyP.primaryImageUrl === "string" && anyP.primaryImageUrl) {
    return anyP.primaryImageUrl;
  }
  return null;
}

export function getProductVariantsCount(p: ProductSummaryDTO): number {
  if (typeof p.variantsCount === "number") return p.variantsCount;
  const anyP = p as unknown as { variantCount?: number };
  if (typeof anyP.variantCount === "number") return anyP.variantCount;
  return 1;
}

// ============================================================================
// ProductPickerDialog Component
// ============================================================================

export function ProductPickerDialog({
  open,
  onOpenChange,
  mode = "single",
  selectedId,
  selectedIds = [],
  onSelect,
  onMultiSelect,
  products = [],
  storeId,
  storeCurrency = "USD",
  title,
  description,
}: ProductPickerDialogProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [serverResults, setServerResults] = useState<ProductSummaryDTO[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tempSelectedIds, setTempSelectedIds] = useState<string[]>(selectedIds);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync tempSelectedIds when dialog opens
  useEffect(() => {
    if (open) {
      setTempSelectedIds(selectedIds || []);
      setSearch("");
      setDebouncedSearch("");
      setServerResults(null);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [open, selectedIds]);

  // Handle Escape key to close dialog
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  // Debounce search input (250ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Merchant catalog search / hydrate. The public storefront list is ACTIVE-only
  // and a different shape (`items`), so the editor always uses the store API.
  useEffect(() => {
    if (!open || !storeId) {
      setServerResults(null);
      return;
    }

    const searching = debouncedSearch.length > 0;
    if (!searching && products.length > 0) {
      setServerResults(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    apiClient
      .get<PaginatedResult<ProductSummaryDTO>>(
        `/api/v1/stores/${encodeURIComponent(storeId)}/products`,
        {
          storeId,
          params: {
            limit: 50,
            search: searching ? debouncedSearch : undefined,
          },
        },
      )
      .then((res) => {
        if (isMounted) {
          setServerResults((res.items || []).filter((product) => product.status !== "ARCHIVED"));
        }
      })
      .catch((err) => {
        console.warn("Merchant product search failed, falling back to local products:", err);
        if (isMounted) setServerResults(null);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, storeId, debouncedSearch, products.length]);

  // Active product pool (server search results or local products)
  const productPool = useMemo(() => {
    if (serverResults !== null) return serverResults;
    return products;
  }, [serverResults, products]);

  // Filtered products with case-insensitive title and SKU matching
  const filteredProducts = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    if (!q) return productPool;

    return productPool.filter((p) => {
      const titleMatch = (p.title || "").toLowerCase().includes(q);
      const skuMatch = p.sku ? p.sku.toLowerCase().includes(q) : false;
      const displayTitleMatch = p.displayTitle
        ? p.displayTitle.toLowerCase().includes(q)
        : false;
      return titleMatch || skuMatch || displayTitleMatch;
    });
  }, [productPool, debouncedSearch]);

  // Selection handlers
  const handleSelectSingle = (p: ProductSummaryDTO) => {
    onSelect(p);
    onOpenChange(false);
  };

  const handleToggleMulti = (p: ProductSummaryDTO) => {
    setTempSelectedIds((prev) => {
      if (prev.includes(p.id)) {
        return prev.filter((id) => id !== p.id);
      } else {
        return [...prev, p.id];
      }
    });
  };

  const handleApplyMulti = () => {
    if (onMultiSelect) {
      const selected = productPool.filter((p) => tempSelectedIds.includes(p.id));
      onMultiSelect(selected);
    }
    onOpenChange(false);
  };

  // Clear search input
  const handleClearSearch = () => {
    setSearch("");
    setDebouncedSearch("");
    setServerResults(null);
    searchInputRef.current?.focus();
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-picker-title"
      aria-describedby="product-picker-desc"
      data-testid="product-picker-dialog-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        data-testid="product-picker-dialog"
        className="max-w-md w-full p-0 overflow-hidden bg-background text-foreground border border-border shadow-2xl rounded-2xl flex flex-col max-h-[85vh] sm:max-h-[620px] relative animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 pb-3 border-b border-border/80 text-left">
          <div className="flex items-center justify-between pr-2">
            <div>
              <h2
                id="product-picker-title"
                className="text-base font-bold tracking-tight text-foreground flex items-center gap-2"
              >
                <Package className="w-4 h-4 text-primary" />
                <span>{title || (mode === "multiple" ? "Select Products" : "Select Product")}</span>
              </h2>
              <p id="product-picker-desc" className="text-xs text-muted-foreground mt-0.5">
                {description || "Search by product name or SKU to link to this element."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search Input Bar */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name or SKU..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-input bg-card/60 text-foreground placeholder:text-muted-foreground focus:bg-background focus:outline-hidden focus:ring-1 focus:ring-primary transition-all font-sans"
              data-testid="product-picker-search"
            />
            {search && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Product List */}
        <div
          className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1 divide-y divide-border/30 max-h-[380px]"
          data-testid="product-picker-list"
        >
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 text-muted-foreground">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-medium">Searching catalog...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-2">
              <Package className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <p className="text-xs font-semibold text-foreground">
                {search ? `No products matching "${search}"` : "No products available in this store"}
              </p>
              {search && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1 mt-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear search filter</span>
                </button>
              )}
            </div>
          ) : (
            filteredProducts.map((p) => {
              const isSelected =
                mode === "single"
                  ? selectedId === p.id
                  : tempSelectedIds.includes(p.id);

              const priceFormatted = formatStorePrice(getProductPrice(p), p.currency || storeCurrency);
              const imgUrl = getProductImageUrl(p);
              const variantsCount = getProductVariantsCount(p);

              return (
                <div
                  key={p.id}
                  data-product-id={p.id}
                  data-testid={`product-option-${p.id}`}
                  onClick={() =>
                    mode === "single" ? handleSelectSingle(p) : handleToggleMulti(p)
                  }
                  className={`flex items-center gap-3 p-2.5 rounded-xl transition-all duration-150 cursor-pointer select-none group text-left ${
                    isSelected
                      ? "bg-primary/10 border border-primary/30 ring-1 ring-primary/20"
                      : "hover:bg-muted/60 border border-transparent"
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-muted/60 border border-border/50 flex items-center justify-center relative shadow-2xs">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={p.primaryMediaAlt || p.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-5 h-5 text-muted-foreground/60" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {p.title}
                      </p>
                      {p.displayTitle && p.displayTitle !== p.title && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          ({p.displayTitle})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground font-mono">
                        {priceFormatted}
                      </span>

                      {p.sku && (
                        <span className="px-1.5 py-0.2 rounded bg-muted text-[10px] font-mono text-muted-foreground border border-border/50">
                          SKU: {p.sku}
                        </span>
                      )}

                      {variantsCount > 1 && (
                        <span className="text-[10px] text-muted-foreground">
                          · {variantsCount} variants
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Checkbox / Indicator */}
                  <div className="shrink-0 flex items-center">
                    {mode === "single" ? (
                      isSelected ? (
                        <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-border/80 group-hover:border-primary/50 transition-colors" />
                      )
                    ) : (
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-input bg-card group-hover:border-primary"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer (For multiple mode actions) */}
        {mode === "multiple" && (
          <div className="p-3 sm:p-4 border-t border-border/80 bg-muted/20 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {tempSelectedIds.length} {tempSelectedIds.length === 1 ? "product" : "products"} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-3 py-1.5 rounded-lg border border-input text-xs font-medium hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyMulti}
                className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-2xs cursor-pointer"
              >
                Apply Selection
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ProductPicker (Inspector Card & Trigger)
// ============================================================================

export function ProductPicker({
  value,
  values = [],
  mode = "single",
  onChange,
  onMultiChange,
  products = [],
  storeId,
  storeSlug = "",
  storeCurrency = "USD",
  label = "Product",
  description,
  placeholder = "Select product...",
  disabled = false,
  allowClear = true,
  emptyLabel = "Auto (First Catalog Item)",
  className = "",
}: ProductPickerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  // Single-selected product lookup
  const selectedProduct = useMemo(() => {
    if (!value || mode !== "single") return null;
    return products.find((p) => p.id === value) || null;
  }, [value, mode, products]);

  // Multiple-selected products lookup
  const selectedProductList = useMemo(() => {
    if (mode !== "multiple") return [];
    return products.filter((p) => values.includes(p.id));
  }, [values, mode, products]);

  // Detected state: Product ID was set by merchant, but is not present in products list
  const isUnavailable = Boolean(value && !selectedProduct && mode === "single");

  // Clear single selection
  const handleClearSingle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onChange) onChange(null);
  };

  // Quick remove from multi
  const handleRemoveFromMulti = (idToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMultiChange) {
      onMultiChange(values.filter((id) => id !== idToRemove));
    }
  };

  return (
    <div className={`space-y-1.5 ${className}`} data-testid="product-picker-container">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-foreground">{label}</label>
          {allowClear && (mode === "single" ? Boolean(value) : values.length > 0) && (
            <button
              type="button"
              onClick={mode === "single" ? handleClearSingle : () => onMultiChange?.([])}
              className="text-[11px] text-muted-foreground hover:text-foreground hover:underline transition-colors cursor-pointer"
            >
              Reset to Auto
            </button>
          )}
        </div>
      )}

      {description && (
        <p className="text-[11px] text-muted-foreground leading-snug">{description}</p>
      )}

      {/* SINGLE SELECT MODE */}
      {mode === "single" && (
        <div className="space-y-2">
          {selectedProduct ? (
            /* Selected Product Card */
            <div
              onClick={() => !disabled && setDialogOpen(true)}
              className="group relative flex items-center justify-between p-2.5 rounded-xl border border-border/80 bg-card/60 hover:bg-card hover:border-primary/40 transition-all duration-150 cursor-pointer shadow-2xs"
            >
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-muted/60 border border-border/50 flex items-center justify-center relative">
                  {getProductImageUrl(selectedProduct) ? (
                    <img
                      src={getProductImageUrl(selectedProduct)!}
                      alt={selectedProduct.primaryMediaAlt || selectedProduct.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-5 h-5 text-muted-foreground/60" />
                  )}
                </div>

                <div className="min-w-0 space-y-0.5">
                  <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                    {selectedProduct.title}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                    <span className="font-semibold text-foreground/80">
                      {formatStorePrice(getProductPrice(selectedProduct), selectedProduct.currency || storeCurrency)}
                    </span>
                    {selectedProduct.sku && (
                      <span className="px-1.5 py-0.2 rounded bg-muted/80 text-muted-foreground border border-border/40">
                        SKU: {selectedProduct.sku}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[11px] font-semibold text-primary px-2 py-1 rounded-md bg-primary/10 border border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  Change
                </span>
                {allowClear && (
                  <button
                    type="button"
                    onClick={handleClearSingle}
                    title="Remove product"
                    className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ) : isUnavailable ? (
            /* Unavailable Product Warning Card */
            <div
              onClick={() => !disabled && setDialogOpen(true)}
              className="flex items-center justify-between p-2.5 rounded-xl border border-destructive/40 bg-destructive/5 hover:bg-destructive/10 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-destructive truncate">
                    Product Unavailable or Deleted
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground truncate">
                    ID: {value}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[11px] font-semibold text-destructive px-2 py-0.5 rounded border border-destructive/30">
                  Re-select
                </span>
                {allowClear && (
                  <button
                    type="button"
                    onClick={handleClearSingle}
                    title="Remove product"
                    className="p-1 rounded text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Empty / Auto State Trigger Button */
            <button
              type="button"
              disabled={disabled}
              onClick={() => setDialogOpen(true)}
              className="w-full flex items-center justify-between p-2.5 rounded-xl border border-dashed border-border/80 bg-muted/20 hover:bg-muted/50 hover:border-border text-left transition-all duration-150 cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 border border-border/50 text-muted-foreground group-hover:text-primary transition-colors">
                  <Search className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {emptyLabel}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {placeholder}
                  </p>
                </div>
              </div>

              <span className="text-[11px] font-semibold text-primary px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 shrink-0">
                Select Product
              </span>
            </button>
          )}
        </div>
      )}

      {/* MULTIPLE SELECT MODE */}
      {mode === "multiple" && (
        <div className="space-y-2">
          {selectedProductList.length > 0 ? (
            <div className="space-y-1.5">
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {selectedProductList.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-1.5 pl-2 rounded-lg border border-border/70 bg-card/60 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <div className="w-7 h-7 rounded overflow-hidden shrink-0 bg-muted/60 border border-border/40 flex items-center justify-center">
                        {getProductImageUrl(p) ? (
                          <img
                            src={getProductImageUrl(p)!}
                            alt={p.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-3.5 h-3.5 text-muted-foreground/50" />
                        )}
                      </div>
                      <span className="font-medium text-foreground truncate text-xs">
                        {p.title}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleRemoveFromMulti(p.id, e)}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      title="Remove from curated list"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className="w-full py-1.5 px-3 rounded-lg border border-dashed border-border/80 hover:bg-muted/50 text-xs font-semibold text-primary flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Edit Selected Products ({selectedProductList.length})</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setDialogOpen(true)}
              className="w-full flex items-center justify-between p-2.5 rounded-xl border border-dashed border-border/80 bg-muted/20 hover:bg-muted/50 hover:border-border text-left transition-all duration-150 cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 border border-border/50 text-muted-foreground group-hover:text-primary transition-colors">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {emptyLabel}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {placeholder}
                  </p>
                </div>
              </div>

              <span className="text-[11px] font-semibold text-primary px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 shrink-0">
                Curate Products
              </span>
            </button>
          )}
        </div>
      )}

      {/* Modal Dialog */}
      <ProductPickerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={mode}
        selectedId={value}
        selectedIds={values}
        onSelect={(p) => {
          if (onChange) onChange(p ? p.id : null);
        }}
        onMultiSelect={(selectedList) => {
          if (onMultiChange) onMultiChange(selectedList.map((p) => p.id));
        }}
        products={products}
        storeId={storeId}
        storeSlug={storeSlug}
        storeCurrency={storeCurrency}
        title={mode === "multiple" ? "Curate Products" : "Select Product"}
        description={
          mode === "multiple"
            ? "Pick multiple products from your store to feature in this layout."
            : "Search and select a product to display."
        }
      />
    </div>
  );
}
