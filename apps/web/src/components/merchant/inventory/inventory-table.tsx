"use client";

import React, { useState, useMemo } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shopify-clone/ui";
import {
  calculateInventoryKpis,
  groupInventoryByProduct,
  type InventoryVariantItem,
  type ProductInventoryGroup,
} from "../../../lib/merchant-inventory-helpers";
import { ProductInventoryPanel } from "./product-inventory-panel";
import {
  Boxes,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Package,
  SlidersHorizontal,
} from "lucide-react";

export interface InventoryTableProps {
  items: InventoryVariantItem[];
  storeId?: string;
  onAdjustStock: (item: InventoryVariantItem) => void;
  onViewHistory: (item: InventoryVariantItem) => void;
  onUpdateItem?: (updatedItem: InventoryVariantItem) => void;
  canManage?: boolean;
}

export function InventoryTable({
  items,
  storeId,
  onAdjustStock,
  onViewHistory,
  onUpdateItem,
  canManage = true,
}: InventoryTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const kpis = useMemo(() => calculateInventoryKpis(items), [items]);
  const productGroups = useMemo(() => groupInventoryByProduct(items), [items]);

  const selectedProductGroup = useMemo(() => {
    if (!selectedProductId) return null;
    return productGroups.find((g) => g.productId === selectedProductId) || null;
  }, [productGroups, selectedProductId]);

  const filteredProducts = useMemo(() => {
    return productGroups.filter((group) => {
      // 1. Search Query (matches product title, slug, variant title, or variant SKU)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesProduct =
          group.productTitle.toLowerCase().includes(q) ||
          group.productSlug.toLowerCase().includes(q);
        const matchesVariant = group.variants.some(
          (v) =>
            v.variantTitle.toLowerCase().includes(q) ||
            (v.sku && v.sku.toLowerCase().includes(q)),
        );
        if (!matchesProduct && !matchesVariant) {
          return false;
        }
      }

      // 2. Status Filter
      if (statusFilter === "in_stock" && group.status !== "in_stock") return false;
      if (
        statusFilter === "low_stock" &&
        group.lowStockCount === 0 &&
        group.outOfStockCount === 0
      ) {
        return false;
      }
      if (statusFilter === "out_of_stock" && group.outOfStockCount === 0) return false;
      if (statusFilter === "reserved" && group.totalReserved <= 0) return false;

      return true;
    });
  }, [productGroups, searchQuery, statusFilter]);

  const renderStatusBadge = (group: ProductInventoryGroup) => {
    if (group.status === "out_of_stock") {
      return (
        <Badge variant="neutral" size="sm">
          Out of Stock
        </Badge>
      );
    }
    if (group.status === "low_stock") {
      const issueCount = group.lowStockCount + group.outOfStockCount;
      return (
        <Badge variant="warning" size="sm">
          Low Stock ({issueCount})
        </Badge>
      );
    }
    return (
      <Badge variant="success" size="sm">
        In Stock
      </Badge>
    );
  };

  const handleSelectProduct = (product: ProductInventoryGroup) => {
    setSelectedProductId(product.productId);
  };

  return (
    <div className="space-y-6">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tracked Products & Variants */}
        <div className="p-4 bg-card rounded-lg border border-border shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Tracked Products
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground mt-1">
              {productGroups.length}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {kpis.totalVariants} Tracked Variants
            </div>
          </div>
          <div className="p-2.5 rounded-md bg-muted text-muted-foreground">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        {/* Total Available */}
        <div className="p-4 bg-card rounded-lg border border-border shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Available Units
            </div>
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-1">
              {kpis.totalAvailable}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Across all variants
            </div>
          </div>
          <div className="p-2.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Total Reserved */}
        <div className="p-4 bg-card rounded-lg border border-border shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Reserved (Checkouts)
            </div>
            <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 mt-1">
              {kpis.totalReserved}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Held in active checkouts
            </div>
          </div>
          <div className="p-2.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Out of Stock */}
        <div className="p-4 bg-card rounded-lg border border-border shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Out of Stock
            </div>
            <div
              className={`text-2xl font-bold tracking-tight mt-1 ${
                kpis.outOfStockCount > 0 ? "text-destructive" : "text-foreground"
              }`}
            >
              {kpis.outOfStockCount}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {kpis.lowStockCount} low stock variants
            </div>
          </div>
          <div
            className={`p-2.5 rounded-md ${
              kpis.outOfStockCount > 0
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <Card>
        <CardHeader className="pb-4 border-b border-border/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold">Inventory Levels</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Authoritative on-hand, reserved, and available quantities by product. Select a row to manage variant stock.
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px]">
                <Input
                  id="inventory-search"
                  placeholder="Search product, variant, SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-xs h-9 pl-3"
                  aria-label="Search inventory"
                />
              </div>

              <div className="min-w-[160px]">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter inventory by stock status"
                  className="text-xs h-9"
                >
                  <option value="all">All Statuses</option>
                  <option value="in_stock">In Stock (&gt; 5)</option>
                  <option value="low_stock">Low Stock (1–5)</option>
                  <option value="out_of_stock">Out of Stock (0)</option>
                  <option value="reserved">Has Reservations</option>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredProducts.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="text-sm font-semibold text-foreground mb-1">
                No Matching Inventory Records
              </div>
              <p className="text-xs text-muted-foreground m-0 max-w-sm mx-auto">
                No products match the current search query or filter.
              </p>
              {(searchQuery || statusFilter !== "all") && (
                <div className="mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                    }}
                  >
                    Clear Filters
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Table fullWidth>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold text-xs">Product</TableHead>
                  <TableHead className="font-semibold text-xs">Variants</TableHead>
                  <TableHead className="font-semibold text-xs">Status</TableHead>
                  <TableHead align="right" className="font-semibold text-xs">Available</TableHead>
                  <TableHead align="right" className="font-semibold text-xs">Reserved</TableHead>
                  <TableHead align="right" className="font-semibold text-xs">Total On-Hand</TableHead>
                  <TableHead align="right" className="font-semibold text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product, index) => (
                  <TableRow
                    key={product.productId || product.productSlug || `product-${index}`}
                    tabIndex={0}
                    role="button"
                    aria-label={`Manage inventory for ${product.productTitle}`}
                    onClick={() => handleSelectProduct(product)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectProduct(product);
                      }
                    }}
                    className="hover:bg-muted/40 cursor-pointer transition-colors focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
                  >
                    {/* Product Column */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-md bg-muted/80 border border-border/60 flex items-center justify-center shrink-0 text-muted-foreground">
                          <Package className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-foreground hover:underline">
                            {product.productTitle}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[11px]">/{product.productSlug}</span>                            
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* SKU / Options Summary Column */}
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1 max-w-[220px]">
                        <span className="font-medium text-foreground">
                          {product.totalVariants} {product.totalVariants === 1 ? "variant" : "variants"}
                        </span>
                      </div>
                    </TableCell>

                    {/* Stock Status Badge */}
                    <TableCell >
                      {renderStatusBadge(product)}
                    </TableCell>

                    {/* Total Available Units */}
                    <TableCell align="right">
                      <span
                        className={`font-mono text-sm font-bold ${
                          product.totalAvailable > 0 ? "text-foreground" : "text-destructive"
                        }`}
                      >
                        {product.totalAvailable}
                      </span>
                    </TableCell>

                    {/* Reserved Quantity */}
                    <TableCell align="right">
                      {product.totalReserved > 0 ? (
                        <span
                          className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded"
                          title="Stock held by active checkouts"
                        >
                          {product.totalReserved}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs font-mono">
                          0
                        </span>
                      )}
                    </TableCell>

                    {/* Total On-Hand */}
                    <TableCell align="right">
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {product.totalQuantity}
                      </span>
                    </TableCell>

                    {/* Actions */}
                    <TableCell align="right">
                      <div className="flex gap-1.5 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectProduct(product);
                          }}
                          className="h-8 px-2.5 text-xs gap-1"
                          aria-label={`Manage inventory for ${product.productTitle}`}
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          <span>Manage inventory</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Product Inventory Side Panel */}
      <ProductInventoryPanel
        isOpen={Boolean(selectedProductGroup)}
        onClose={() => setSelectedProductId(null)}
        storeId={storeId}
        productGroup={selectedProductGroup}
        onAdjustSuccess={(updatedVariant) => {
          if (onUpdateItem) {
            onUpdateItem(updatedVariant);
          } else {
            onAdjustStock(updatedVariant);
          }
        }}
        onOpenAdvancedAdjust={(variant) => onAdjustStock(variant)}
        onOpenHistory={(variant) => onViewHistory(variant)}
        canManage={canManage}
      />
    </div>
  );
}
