"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Input,
  Spinner,
} from "@shopify-clone/ui";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "../../../components/ui/sheet";
import {
  getStockStatus,
  type InventoryVariantItem,
  type ProductInventoryGroup,
} from "../../../lib/merchant-inventory-helpers";
import { ApiClientError, apiClient } from "../../../lib/api-client";
import type { InventoryItemDTO, InventoryAdjustmentDTO } from "@shopify-clone/inventory";
import {
  Package,
  ExternalLink,
  Search,
  Check,
  X,
  RotateCcw,
  SlidersHorizontal,
  History,
  AlertTriangle,
  Clock,
  Plus,
  Minus,
  Save,
} from "lucide-react";

export interface ProductInventoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  storeId?: string;
  productGroup: ProductInventoryGroup | null;
  onAdjustSuccess?: (updatedVariant: InventoryVariantItem) => void;
  onOpenAdvancedAdjust?: (variant: InventoryVariantItem) => void;
  onOpenHistory?: (variant: InventoryVariantItem) => void;
  canManage?: boolean;
}

export function ProductInventoryPanel({
  isOpen,
  onClose,
  storeId,
  productGroup,
  onAdjustSuccess,
  onOpenAdvancedAdjust,
  onOpenHistory,
  canManage = true,
}: ProductInventoryPanelProps) {
  const [variantSearch, setVariantSearch] = useState("");
  // Track edited available quantities: variantId -> string input
  const [editedQuantities, setEditedQuantities] = useState<Record<string, string>>({});
  // Track saving state per variantId
  const [savingVariantIds, setSavingVariantIds] = useState<Record<string, boolean>>({});
  // Track temporary success state per variantId
  const [savedVariantIds, setSavedVariantIds] = useState<Record<string, boolean>>({});
  // Track error messages per variantId
  const [variantErrors, setVariantErrors] = useState<Record<string, string>>({});
  // Confirmation state if closing with dirty changes
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  // References for focus management
  const triggerRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const firstQuantityInputRef = useRef<HTMLInputElement | null>(null);

  // Capture trigger element when panel opens
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      setVariantSearch("");
      setEditedQuantities({});
      setSavingVariantIds({});
      setSavedVariantIds({});
      setVariantErrors({});
      setShowUnsavedConfirm(false);
      setBatchError(null);

      // Auto-focus after dialog mount
      const timer = setTimeout(() => {
        if (productGroup && productGroup.variants.length > 3 && searchInputRef.current) {
          searchInputRef.current.focus();
        } else if (firstQuantityInputRef.current) {
          firstQuantityInputRef.current.focus();
        }
      }, 60);
      return () => clearTimeout(timer);
    } else {
      // Restore focus to triggering control when closing
      if (triggerRef.current && typeof triggerRef.current.focus === "function") {
        const el = triggerRef.current;
        setTimeout(() => el.focus(), 50);
      }
      return undefined;
    }
  }, [isOpen, productGroup?.productId]);

  // Check if any variant has unsaved changes
  const dirtyVariants = useMemo(() => {
    if (!productGroup) return [];
    return productGroup.variants.filter((v) => {
      const edited = editedQuantities[v.variantId];
      if (edited === undefined) return false;
      const parsed = parseInt(edited, 10);
      return !isNaN(parsed) && parsed !== v.availableQuantity;
    });
  }, [productGroup, editedQuantities]);

  const hasUnsavedChanges = dirtyVariants.length > 0;

  // Filter variants by search query
  const filteredVariants = useMemo(() => {
    if (!productGroup) return [];
    if (!variantSearch.trim()) return productGroup.variants;
    const q = variantSearch.toLowerCase().trim();
    return productGroup.variants.filter((v) => {
      const matchTitle = v.variantTitle.toLowerCase().includes(q);
      const matchSku = v.sku ? v.sku.toLowerCase().includes(q) : false;
      return matchTitle || matchSku;
    });
  }, [productGroup, variantSearch]);

  // Handle close request with dirty check
  const requestClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowUnsavedConfirm(true);
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, onClose]);

  // Intercept Escape key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (showUnsavedConfirm) {
          setShowUnsavedConfirm(false);
        } else if (hasUnsavedChanges) {
          setShowUnsavedConfirm(true);
        } else {
          onClose();
        }
      }
    },
    [showUnsavedConfirm, hasUnsavedChanges, onClose],
  );

  const handleQuantityChange = (variantId: string, value: string) => {
    setEditedQuantities((prev) => ({
      ...prev,
      [variantId]: value,
    }));
    // Clear error on change
    if (variantErrors[variantId]) {
      setVariantErrors((prev) => {
        const next = { ...prev };
        delete next[variantId];
        return next;
      });
    }
  };

  const handleStepQuantity = (variant: InventoryVariantItem, step: number) => {
    const currentStr = editedQuantities[variant.variantId];
    const currentVal =
      currentStr !== undefined ? parseInt(currentStr, 10) : variant.availableQuantity;
    const base = isNaN(currentVal) ? variant.availableQuantity : currentVal;
    const nextVal = Math.max(0, base + step);
    handleQuantityChange(variant.variantId, String(nextVal));
  };

  const handleRevertVariant = (variantId: string) => {
    setEditedQuantities((prev) => {
      const next = { ...prev };
      delete next[variantId];
      return next;
    });
    setVariantErrors((prev) => {
      const next = { ...prev };
      delete next[variantId];
      return next;
    });
  };

  const handleSaveVariant = async (variant: InventoryVariantItem) => {
    if (!storeId || !canManage) return;

    const editedStr = editedQuantities[variant.variantId];
    const newQty =
      editedStr !== undefined ? parseInt(editedStr, 10) : variant.availableQuantity;

    if (isNaN(newQty) || newQty < 0) {
      setVariantErrors((prev) => ({
        ...prev,
        [variant.variantId]: "Quantity must be 0 or greater",
      }));
      return;
    }

    const delta = newQty - variant.availableQuantity;
    if (delta === 0) {
      handleRevertVariant(variant.variantId);
      return;
    }

    setSavingVariantIds((prev) => ({ ...prev, [variant.variantId]: true }));
    setVariantErrors((prev) => {
      const next = { ...prev };
      delete next[variant.variantId];
      return next;
    });

    try {
      const reason = delta > 0 ? "RESTOCK" : "MANUAL_CORRECTION";
      const response = await apiClient.post<{
        item: InventoryItemDTO;
        adjustment: InventoryAdjustmentDTO;
      }>(`/api/v1/stores/${storeId}/inventory/${variant.variantId}/adjust`, {
        quantityDelta: delta,
        reason,
        referenceType: "quick_panel_adjustment",
        referenceId: null,
      });

      const updatedDto = response.item;
      const updatedVariant: InventoryVariantItem = {
        ...variant,
        availableQuantity: updatedDto.availableQuantity,
        reservedQuantity: updatedDto.reservedQuantity,
        totalQuantity: updatedDto.totalQuantity,
        isInitialized: true,
        inventoryItemId: updatedDto.id,
      };

      // Clear dirty edit
      setEditedQuantities((prev) => {
        const next = { ...prev };
        delete next[variant.variantId];
        return next;
      });

      // Show temporary saved badge
      setSavedVariantIds((prev) => ({ ...prev, [variant.variantId]: true }));
      setTimeout(() => {
        setSavedVariantIds((prev) => {
          const next = { ...prev };
          delete next[variant.variantId];
          return next;
        });
      }, 2500);

      if (onAdjustSuccess) {
        onAdjustSuccess(updatedVariant);
      }
    } catch (err: unknown) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to update variant stock.";
      setVariantErrors((prev) => ({
        ...prev,
        [variant.variantId]: message,
      }));
    } finally {
      setSavingVariantIds((prev) => ({ ...prev, [variant.variantId]: false }));
    }
  };

  const handleSaveAll = async () => {
    if (!storeId || !canManage || dirtyVariants.length === 0) return;
    setBatchError(null);

    for (const v of dirtyVariants) {
      await handleSaveVariant(v);
    }
  };

  const handleDiscardAll = () => {
    setEditedQuantities({});
    setVariantErrors({});
    setShowUnsavedConfirm(false);
  };

  const renderStatusBadge = (available: number) => {
    const status = getStockStatus(available);
    if (status === "out_of_stock") {
      return (
        <Badge variant="neutral" size="sm">
          Out of Stock
        </Badge>
      );
    }
    if (status === "low_stock") {
      return (
        <Badge variant="warning" size="sm">
          Low Stock ({available})
        </Badge>
      );
    }
    return (
      <Badge variant="success" size="sm">
        In Stock
      </Badge>
    );
  };

  if (!productGroup) return null;

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          requestClose();
        }
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full sm:max-w-[560px] p-0 flex flex-col gap-0 overflow-hidden bg-background border-l border-border shadow-2xl"
        onKeyDown={handleKeyDown}
        aria-label={`Product inventory: ${productGroup.productTitle}`}
      >
        {/* Header */}
        <SheetHeader className="p-4 sm:p-5 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-11 h-11 rounded-lg bg-muted border border-border/70 flex items-center justify-center shrink-0 text-muted-foreground shadow-xs">
                <Package className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground truncate flex items-center gap-1.5">
                  <span className="truncate">{productGroup.productTitle}</span>
                  <Link
                    href={`/merchant/products/${productGroup.productId}`}
                    className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
                    title="Open product editor"
                    aria-label={`Open product editor for ${productGroup.productTitle}`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>/{productGroup.productSlug}</span>
                  <span>•</span>
                  <span>{productGroup.totalVariants} variants</span>
                </SheetDescription>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={requestClose}
              className="h-8 w-8 p-0 rounded-md text-muted-foreground hover:text-foreground shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
              aria-label="Close inventory panel"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* KPI metrics bar */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-border/40">
            <div className="bg-card/60 rounded-md p-2 border border-border/40 text-center">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Available
              </div>
              <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                {productGroup.totalAvailable}
              </div>
            </div>

            <div className="bg-card/60 rounded-md p-2 border border-border/40 text-center">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Reserved
              </div>
              <div className="text-base font-bold text-amber-600 dark:text-amber-400 mt-0.5 font-mono">
                {productGroup.totalReserved}
              </div>
            </div>

            <div className="bg-card/60 rounded-md p-2 border border-border/40 text-center">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                On-Hand
              </div>
              <div className="text-base font-bold text-foreground mt-0.5 font-mono">
                {productGroup.totalQuantity}
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Unsaved Changes Confirmation Banner */}
        {showUnsavedConfirm && (
          <div className="p-3 bg-amber-500/10 border-b border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shrink-0 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>You have unsaved stock changes. Discard them?</span>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUnsavedConfirm(false)}
                className="h-7 px-2.5 text-xs bg-background hover:bg-muted text-foreground"
              >
                Keep Editing
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  handleDiscardAll();
                  onClose();
                }}
                className="h-7 px-2.5 text-xs"
              >
                Discard Changes
              </Button>
            </div>
          </div>
        )}

        {/* Batch Error Banner */}
        {batchError && (
          <div className="p-3 bg-destructive/10 border-b border-destructive/20 text-destructive text-xs flex items-center justify-between gap-2 shrink-0">
            <span>{batchError}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBatchError(null)}
              className="h-6 w-6 p-0"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        {/* Variant Search Bar (shown when more than 1 variant) */}
        {productGroup.variants.length > 1 && (
          <div className="p-3 border-b border-border/40 bg-muted/10 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchInputRef}
                placeholder="Filter variants by name or SKU..."
                value={variantSearch}
                onChange={(e) => setVariantSearch(e.target.value)}
                className="h-8.5 text-xs pl-8 pr-8"
                aria-label="Filter variants in product"
              />
              {variantSearch && (
                <button
                  type="button"
                  onClick={() => setVariantSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-hidden"
                  aria-label="Clear variant search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {variantSearch && (
              <div className="text-[11px] text-muted-foreground mt-1.5 px-0.5">
                Showing {filteredVariants.length} of {productGroup.variants.length} variants
              </div>
            )}
          </div>
        )}

        {/* Variants List (Scrollable Area) */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/40 p-3 sm:p-4 space-y-3">
          {filteredVariants.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              No variants match &quot;{variantSearch}&quot;.
            </div>
          ) : (
            filteredVariants.map((variant, index) => {
              const currentAvailable = variant.availableQuantity;
              const editedValue = editedQuantities[variant.variantId];
              const isDirty =
                editedValue !== undefined &&
                parseInt(editedValue, 10) !== currentAvailable &&
                !isNaN(parseInt(editedValue, 10));
              const displayVal = editedValue !== undefined ? editedValue : String(currentAvailable);
              const isSaving = Boolean(savingVariantIds[variant.variantId]);
              const isSaved = Boolean(savedVariantIds[variant.variantId]);
              const error = variantErrors[variant.variantId];

              return (
                <div
                  key={variant.variantId}
                  className={`p-3.5 rounded-lg border transition-all ${
                    isDirty
                      ? "bg-amber-500/5 border-amber-500/30 shadow-xs"
                      : "bg-card border-border/60 hover:border-border"
                  }`}
                >
                  {/* Row Top: Title, SKU, Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-foreground flex items-center gap-2 flex-wrap">
                        <span>{variant.variantTitle}</span>
                        {isDirty && (
                          <span className="text-[10px] font-medium bg-amber-500/15 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20">
                            Modified
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                        {variant.sku ? (
                          <span className="font-mono text-[11px] bg-muted/60 px-1.5 py-0.5 rounded border border-border/50 text-foreground">
                            {variant.sku}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">No SKU</span>
                        )}
                        <span>•</span>
                        <span className="font-medium text-foreground">
                          ${(variant.price / 100).toFixed(2)} {variant.currency}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {variant.reservedQuantity > 0 && (
                        <span
                          className="font-mono text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                          title={`${variant.reservedQuantity} units reserved in active checkouts`}
                        >
                          <Clock className="w-3 h-3" />
                          {variant.reservedQuantity}
                        </span>
                      )}
                      {renderStatusBadge(
                        isDirty ? parseInt(displayVal, 10) || 0 : currentAvailable,
                      )}
                    </div>
                  </div>

                  {/* Stock Edit Controls */}
                  <div className="mt-3 pt-3 border-t border-border/40 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Available:
                      </span>
                      <div className="flex items-center rounded-md border border-border shadow-xs bg-background overflow-hidden focus-within:ring-2 focus-within:ring-primary">
                        <button
                          type="button"
                          onClick={() => handleStepQuantity(variant, -1)}
                          disabled={!canManage || isSaving}
                          className="h-8 w-7 inline-flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                          title="Decrease available stock by 1"
                          aria-label={`Decrease available stock for ${variant.variantTitle}`}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>

                        <input
                          ref={index === 0 ? firstQuantityInputRef : undefined}
                          type="number"
                          min="0"
                          value={displayVal}
                          onChange={(e) => handleQuantityChange(variant.variantId, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (isDirty && !isSaving) {
                                handleSaveVariant(variant);
                              }
                            }
                          }}
                          disabled={!canManage || isSaving}
                          className="w-14 h-8 text-center text-xs font-mono font-bold bg-transparent border-x border-border/40 focus:outline-hidden"
                          aria-label={`Available quantity for ${variant.variantTitle}`}
                        />

                        <button
                          type="button"
                          onClick={() => handleStepQuantity(variant, 1)}
                          disabled={!canManage || isSaving}
                          className="h-8 w-7 inline-flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                          title="Increase available stock by 1"
                          aria-label={`Increase available stock for ${variant.variantTitle}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Save / Revert actions when modified */}
                      {isDirty && (
                        <div className="flex items-center gap-1 animate-in fade-in duration-100">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleSaveVariant(variant)}
                            disabled={isSaving}
                            className="h-8 px-2.5 text-xs gap-1 shadow-xs"
                            aria-label={`Save stock for ${variant.variantTitle}`}
                          >
                            {isSaving ? (
                              <Spinner size="sm" />
                            ) : (
                              <>
                                <Save className="w-3.5 h-3.5" />
                                <span>Save</span>
                              </>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevertVariant(variant.variantId)}
                            disabled={isSaving}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            title="Revert edits"
                            aria-label={`Revert changes for ${variant.variantTitle}`}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}

                      {/* Saved temporary confirmation */}
                      {isSaved && !isDirty && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded animate-in fade-in">
                          <Check className="w-3.5 h-3.5" />
                          Saved
                        </span>
                      )}
                    </div>

                    {/* Secondary Actions: Advanced Adjust & History */}
                    <div className="flex items-center gap-1 ml-auto">
                      {onOpenHistory && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenHistory(variant)}
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                          title="View audit movement history"
                          aria-label={`Audit history for ${variant.variantTitle}`}
                        >
                          <History className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">History</span>
                        </Button>
                      )}

                      {onOpenAdvancedAdjust && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onOpenAdvancedAdjust(variant)}
                          disabled={!canManage}
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                          title="Open full adjustment dialog with reasons and reference"
                          aria-label={`Detailed adjustment for ${variant.variantTitle}`}
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Adjust...</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Inline Error Message */}
                  {error && (
                    <div className="mt-2 text-[11px] font-medium text-destructive flex items-center gap-1.5 animate-in fade-in">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-border/60 bg-muted/20 shrink-0">
          {hasUnsavedChanges ? (
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                <strong className="text-foreground font-semibold">
                  {dirtyVariants.length}
                </strong>{" "}
                variant{dirtyVariants.length > 1 ? "s" : ""} modified
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDiscardAll}
                  className="h-8 text-xs"
                >
                  Discard All
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveAll}
                  className="h-8 text-xs gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save All Changes</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                All changes saved. Press <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-muted rounded border border-border">Esc</kbd> to exit.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="h-8 px-4 text-xs font-medium"
              >
                Done
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
