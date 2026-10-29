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
  SlidersHorizontal,
  History,
  AlertTriangle,
  Clock,
  Plus,
  Minus,
  Copy,
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
  initialEditingVariantId?: string | null;
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
  initialEditingVariantId = null,
}: ProductInventoryPanelProps) {
  const [variantSearch, setVariantSearch] = useState("");
  // Currently expanded/editing variantId (only 1 variant edited at a time)
  const [editingVariantId, setEditingVariantId] = useState<string | null>(initialEditingVariantId);
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
  // Copied SKU feedback
  const [copiedSku, setCopiedSku] = useState<string | null>(null);

  // References for focus management
  const triggerRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const activeInputRef = useRef<HTMLInputElement | null>(null);
  const editButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Capture trigger element when panel opens
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      setVariantSearch("");
      setEditingVariantId(initialEditingVariantId);
      setEditedQuantities({});
      setSavingVariantIds({});
      setSavedVariantIds({});
      setVariantErrors({});
      setShowUnsavedConfirm(false);
      setCopiedSku(null);

      const timer = setTimeout(() => {
        if (initialEditingVariantId && activeInputRef.current) {
          activeInputRef.current.focus();
        } else if (productGroup && productGroup.variants.length > 3 && searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 60);
      return () => clearTimeout(timer);
    } else {
      if (triggerRef.current && typeof triggerRef.current.focus === "function") {
        const el = triggerRef.current;
        setTimeout(() => el.focus(), 50);
      }
      return undefined;
    }
  }, [isOpen, productGroup?.productId, initialEditingVariantId]);

  // Focus input when editingVariantId changes
  useEffect(() => {
    if (editingVariantId) {
      const timer = setTimeout(() => {
        if (activeInputRef.current) {
          activeInputRef.current.focus();
          activeInputRef.current.select();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [editingVariantId]);

  // Check if active editing variant has unsaved changes
  const activeEditingVariant = useMemo(() => {
    if (!productGroup || !editingVariantId) return null;
    return productGroup.variants.find((v) => v.variantId === editingVariantId) || null;
  }, [productGroup, editingVariantId]);

  const isEditingDirty = useMemo(() => {
    if (!activeEditingVariant) return false;
    const edited = editedQuantities[activeEditingVariant.variantId];
    if (edited === undefined) return false;
    const parsed = parseInt(edited, 10);
    return !isNaN(parsed) && parsed !== activeEditingVariant.availableQuantity;
  }, [activeEditingVariant, editedQuantities]);

  const hasUnsavedChanges = isEditingDirty;

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
        } else if (editingVariantId) {
          // Collapse active editor if not dirty
          setEditingVariantId(null);
        } else {
          onClose();
        }
      }
    },
    [showUnsavedConfirm, hasUnsavedChanges, editingVariantId, onClose],
  );

  const handleToggleEdit = (variantId: string) => {
    if (!canManage) return;

    // If currently editing another variant with unsaved changes, prompt first
    if (hasUnsavedChanges && editingVariantId !== variantId) {
      setShowUnsavedConfirm(true);
      return;
    }

    if (editingVariantId === variantId) {
      // Collapse
      setEditingVariantId(null);
    } else {
      // Expand this variant
      setEditingVariantId(variantId);
      // Initialize edited quantity if not set
      const targetVariant = productGroup?.variants.find((v) => v.variantId === variantId);
      if (targetVariant && editedQuantities[variantId] === undefined) {
        setEditedQuantities((prev) => ({
          ...prev,
          [variantId]: String(targetVariant.availableQuantity),
        }));
      }
    }
  };

  const handleQuantityChange = (variantId: string, value: string) => {
    setEditedQuantities((prev) => ({
      ...prev,
      [variantId]: value,
    }));
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

  const handleCancelEdit = (variant: InventoryVariantItem) => {
    // Revert local edit
    setEditedQuantities((prev) => {
      const next = { ...prev };
      delete next[variant.variantId];
      return next;
    });
    setVariantErrors((prev) => {
      const next = { ...prev };
      delete next[variant.variantId];
      return next;
    });
    setEditingVariantId(null);
    setShowUnsavedConfirm(false);

    // Return focus to the variant edit button
    const btn = editButtonRefs.current[variant.variantId];
    if (btn) {
      setTimeout(() => btn.focus(), 30);
    }
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
      handleCancelEdit(variant);
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

      // Clear dirty edit and collapse editor
      setEditedQuantities((prev) => {
        const next = { ...prev };
        delete next[variant.variantId];
        return next;
      });
      setEditingVariantId(null);

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

      // Return focus to edit button
      const btn = editButtonRefs.current[variant.variantId];
      if (btn) {
        setTimeout(() => btn.focus(), 30);
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

  const handleCopySku = (sku: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(sku);
      setCopiedSku(sku);
      setTimeout(() => setCopiedSku(null), 2000);
    }
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
        {/* Compact Header */}
        <SheetHeader className="p-3.5 sm:p-4 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-md bg-muted border border-border/70 flex items-center justify-center shrink-0 text-muted-foreground shadow-xs">
                <Package className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-sm sm:text-base font-bold tracking-tight text-foreground truncate flex items-center gap-1.5">
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
                <SheetDescription className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
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

          {/* Compact Horizontal KPI Summary Strip */}
          <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground mt-2.5 py-1.5 px-3 bg-background/80 rounded-md border border-border/50 shadow-xs flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-muted-foreground">Available:</span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                {productGroup.totalAvailable}
              </strong>
            </div>
            <span className="text-border hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Reserved:</span>
              <strong className="text-amber-600 dark:text-amber-400 font-mono font-bold">
                {productGroup.totalReserved}
              </strong>
            </div>
            <span className="text-border hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">On-Hand:</span>
              <strong className="text-foreground font-mono font-bold">
                {productGroup.totalQuantity}
              </strong>
            </div>
          </div>
        </SheetHeader>

        {/* Unsaved Changes Confirmation Banner */}
        {showUnsavedConfirm && (
          <div className="p-3 bg-amber-500/10 border-b border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shrink-0 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>You have unsaved stock changes in the active editor.</span>
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
                  if (activeEditingVariant) {
                    handleCancelEdit(activeEditingVariant);
                  }
                  setShowUnsavedConfirm(false);
                  onClose();
                }}
                className="h-7 px-2.5 text-xs"
              >
                Discard Changes
              </Button>
            </div>
          </div>
        )}

        {/* Sticky Variant Search Bar */}
        {productGroup.variants.length > 1 && (
          <div className="p-2.5 sm:p-3 border-b border-border/40 bg-muted/10 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchInputRef}
                placeholder="Filter variants by name or SKU..."
                value={variantSearch}
                onChange={(e) => setVariantSearch(e.target.value)}
                className="h-8 text-xs pl-8 pr-8"
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
              <div className="text-[11px] text-muted-foreground mt-1 px-0.5">
                Showing {filteredVariants.length} of {productGroup.variants.length} variants
              </div>
            )}
          </div>
        )}

        {/* Variants List (Independently Scrollable Container) */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/40">
          {filteredVariants.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              No variants match &quot;{variantSearch}&quot;.
            </div>
          ) : (
            filteredVariants.map((variant) => {
              const isEditing = editingVariantId === variant.variantId;
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
              const delta = (parseInt(displayVal, 10) || 0) - currentAvailable;

              return (
                <div
                  key={variant.variantId}
                  className={`transition-colors ${
                    isEditing ? "bg-muted/30" : "hover:bg-muted/15"
                  }`}
                >
                  {/* Compact Collapsed Row (approx 64-76px high) */}
                  <div
                    tabIndex={0}
                    role="button"
                    aria-expanded={isEditing}
                    aria-label={`Variant ${variant.variantTitle}, ${variant.availableQuantity} available`}
                    onClick={() => handleToggleEdit(variant.variantId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleToggleEdit(variant.variantId);
                      }
                    }}
                    className="p-3 sm:px-4 sm:py-3 flex items-center justify-between gap-3 cursor-pointer select-none focus-visible:bg-muted/30 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
                  >
                    {/* Left: Title, Badges, SKU, Price */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground truncate">
                          {variant.variantTitle}
                        </span>
                        {renderStatusBadge(
                          isDirty ? parseInt(displayVal, 10) || 0 : currentAvailable,
                        )}
                        {variant.reservedQuantity > 0 && (
                          <span
                            className="font-mono text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0"
                            title={`${variant.reservedQuantity} reserved in checkouts`}
                          >
                            <Clock className="w-3 h-3" />
                            {variant.reservedQuantity}
                          </span>
                        )}
                        {isSaved && !isDirty && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded animate-in fade-in">
                            <Check className="w-3 h-3" />
                            Saved
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                        {variant.sku ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground">
                            <span>{variant.sku}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopySku(variant.sku!);
                              }}
                              className="p-0.5 text-muted-foreground hover:text-foreground rounded focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-hidden"
                              title="Copy SKU to clipboard"
                              aria-label={`Copy SKU ${variant.sku}`}
                            >
                              {copiedSku === variant.sku ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3 text-muted-foreground/70" />
                              )}
                            </button>
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground/60">—</span>
                        )}
                        <span>•</span>
                        <span className="text-foreground font-medium text-[11px]">
                          ${(variant.price / 100).toFixed(2)} {variant.currency}
                        </span>
                      </div>
                    </div>

                    {/* Right: Available stock count & Row Actions */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div
                          className={`font-mono text-base font-bold leading-none ${
                            currentAvailable > 0 ? "text-foreground" : "text-destructive"
                          }`}
                        >
                          {currentAvailable}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                          avail
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          ref={(el) => {
                            editButtonRefs.current[variant.variantId] = el;
                          }}
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleEdit(variant.variantId)}
                          disabled={!canManage}
                          className="h-7 px-2 text-xs gap-1 font-medium"
                          aria-label={`Adjust stock for ${variant.variantTitle}`}
                        >
                          <SlidersHorizontal className="w-3 h-3" />
                          <span>{isEditing ? "Close" : "Adjust..."}</span>
                        </Button>

                        {onOpenHistory && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onOpenHistory(variant)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            title="View audit movement history"
                            aria-label={`Audit history for ${variant.variantTitle}`}
                          >
                            <History className="w-3.5 h-3.5" />
                            <span className="sr-only">History</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Focused Inline Editor (Rendered Only for the Selected Variant) */}
                  {isEditing && (
                    <div
                      className="bg-muted/40 border-t border-primary/20 p-3 sm:p-4 space-y-3 animate-in fade-in duration-150"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <span>Adjusting stock for:</span>
                          <strong className="text-primary font-bold">
                            {variant.variantTitle}
                          </strong>
                        </div>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          Current available: {currentAvailable}
                        </span>
                      </div>

                      {/* Steppers & Quantity Input */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor={`qty-input-${variant.variantId}`}
                            className="text-xs font-medium text-muted-foreground"
                          >
                            Available:
                          </label>
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
                              id={`qty-input-${variant.variantId}`}
                              ref={activeInputRef}
                              type="number"
                              min="0"
                              value={displayVal}
                              onChange={(e) =>
                                handleQuantityChange(variant.variantId, e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (isDirty && !isSaving) {
                                    handleSaveVariant(variant);
                                  }
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  handleCancelEdit(variant);
                                }
                              }}
                              disabled={!canManage || isSaving}
                              className="w-16 h-8 text-center text-xs font-mono font-bold bg-transparent border-x border-border/40 focus:outline-hidden"
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

                          {/* Delta indicator pill */}
                          {isDirty && (
                            <span
                              className={`font-mono text-xs font-semibold px-2 py-0.5 rounded ${
                                delta > 0
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                                  : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                              }`}
                            >
                              {delta > 0 ? `+${delta}` : delta} (was {currentAvailable})
                            </span>
                          )}
                        </div>

                        {/* Save & Cancel Actions */}
                        <div className="flex items-center gap-1.5 ml-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelEdit(variant)}
                            disabled={isSaving}
                            className="h-8 px-3 text-xs"
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleSaveVariant(variant)}
                            disabled={isSaving || !isDirty}
                            className="h-8 px-3 text-xs gap-1.5"
                            aria-label={`Save stock for ${variant.variantTitle}`}
                          >
                            {isSaving ? (
                              <Spinner size="sm" />
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Save</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Secondary Link for Detailed Multi-Reason Adjustment */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs text-muted-foreground">
                        <span>Need custom adjustment reasons (Damaged, Return, Audit)?</span>
                        {onOpenAdvancedAdjust && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onOpenAdvancedAdjust(variant)}
                            disabled={!canManage}
                            className="h-6 px-2 text-xs text-primary hover:text-primary/80 gap-1"
                            aria-label={`Detailed adjustment for ${variant.variantTitle}`}
                          >
                            <SlidersHorizontal className="w-3 h-3" />
                            <span>Detailed Adjust...</span>
                          </Button>
                        )}
                      </div>

                      {/* Inline Error Reporting */}
                      {error && (
                        <div className="mt-2 text-[11px] font-medium text-destructive flex items-center gap-1.5 animate-in fade-in">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{error}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Compact Footer */}
        <div className="p-3 sm:px-4 border-t border-border/60 bg-muted/20 shrink-0 flex items-center justify-between gap-3">
          {hasUnsavedChanges ? (
            <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
              Unsaved changes in active editor
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              All changes saved. Press <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-muted rounded border border-border">Esc</kbd> to exit.
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={requestClose}
            className="h-8 px-4 text-xs font-medium"
          >
            Done
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
