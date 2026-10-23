"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
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
  getStockStatus,
  type InventoryVariantItem,
} from "../../../lib/merchant-inventory-helpers";
import {
  Boxes,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";

export interface InventoryTableProps {
  items: InventoryVariantItem[];
  onAdjustStock: (item: InventoryVariantItem) => void;
  onViewHistory: (item: InventoryVariantItem) => void;
  canManage?: boolean;
}

export function InventoryTable({
  items,
  onAdjustStock,
  onViewHistory,
  canManage = true,
}: InventoryTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const kpis = useMemo(() => calculateInventoryKpis(items), [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesProduct = item.productTitle.toLowerCase().includes(q);
        const matchesVariant = item.variantTitle.toLowerCase().includes(q);
        const matchesSku = item.sku ? item.sku.toLowerCase().includes(q) : false;
        if (!matchesProduct && !matchesVariant && !matchesSku) {
          return false;
        }
      }

      // 2. Status Filter
      if (statusFilter === "in_stock" && item.availableQuantity <= 5) return false;
      if (statusFilter === "low_stock" && (item.availableQuantity <= 0 || item.availableQuantity > 5)) return false;
      if (statusFilter === "out_of_stock" && item.availableQuantity > 0) return false;
      if (statusFilter === "reserved" && item.reservedQuantity <= 0) return false;

      return true;
    });
  }, [items, searchQuery, statusFilter]);

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

  return (
    <div className="space-y-6">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Variants */}
        <div className="p-4 bg-card rounded-lg border border-border shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Tracked Variants
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground mt-1">
              {kpis.totalVariants}
            </div>
          </div>
          <div className="p-2.5 rounded-md bg-muted text-muted-foreground">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        {/* Total Available */}
        <div className="p-4 bg-card rounded-lg border border-border shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Available Units
            </div>
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-1">
              {kpis.totalAvailable}
            </div>
          </div>
          <div className="p-2.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Total Reserved */}
        <div className="p-4 bg-card rounded-lg border border-border shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Reserved (Checkouts)
            </div>
            <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 mt-1">
              {kpis.totalReserved}
            </div>
          </div>
          <div className="p-2.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Out of Stock */}
        <div className="p-4 bg-card rounded-lg border border-border shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Out of Stock
            </div>
            <div className={`text-2xl font-bold tracking-tight mt-1 ${
              kpis.outOfStockCount > 0 ? "text-destructive" : "text-foreground"
            }`}>
              {kpis.outOfStockCount}
            </div>
          </div>
          <div className={`p-2.5 rounded-md ${
            kpis.outOfStockCount > 0
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground"
          }`}>
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
                Authoritative on-hand, reserved, and available quantities across all variants.
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
          {filteredItems.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="text-sm font-semibold text-foreground mb-1">
                No Matching Inventory Records
              </div>
              <p className="text-xs text-muted-foreground m-0 max-w-sm mx-auto">
                No variants match the current search query or filter.
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
                  <TableHead className="font-semibold text-xs">Product & Variant</TableHead>
                  <TableHead className="font-semibold text-xs">SKU</TableHead>
                  <TableHead className="font-semibold text-xs">Status</TableHead>
                  <TableHead align="right" className="font-semibold text-xs">Available</TableHead>
                  <TableHead align="right" className="font-semibold text-xs">Reserved</TableHead>
                  <TableHead align="right" className="font-semibold text-xs">Total On-Hand</TableHead>
                  <TableHead align="right" className="font-semibold text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.variantId} className="hover:bg-muted/40 transition-colors">
                    {/* Product & Variant */}
                    <TableCell>
                      <div>
                        <div className="font-semibold text-sm">
                          <Link
                            href={`/merchant/products/${item.productId}`}
                            className="text-foreground hover:text-primary transition-colors hover:underline"
                            title="View product details"
                          >
                            {item.productTitle}
                          </Link>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Variant: <strong className="text-foreground font-medium">{item.variantTitle}</strong>
                        </div>
                      </div>
                    </TableCell>

                    {/* SKU */}
                    <TableCell>
                      {item.sku ? (
                        <span className="font-mono text-xs bg-muted/60 px-1.5 py-0.5 rounded border border-border/50 text-foreground">
                          {item.sku}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          —
                        </span>
                      )}
                    </TableCell>

                    {/* Stock status badge */}
                    <TableCell>
                      {renderStatusBadge(item.availableQuantity)}
                    </TableCell>

                    {/* Available Quantity */}
                    <TableCell align="right">
                      <span className={`font-mono text-sm font-bold ${
                        item.availableQuantity > 0 ? "text-foreground" : "text-destructive"
                      }`}>
                        {item.availableQuantity}
                      </span>
                    </TableCell>

                    {/* Reserved Quantity */}
                    <TableCell align="right">
                      {item.reservedQuantity > 0 ? (
                        <span
                          className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded"
                          title="Stock held by active checkouts"
                        >
                          {item.reservedQuantity}
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
                        {item.totalQuantity}
                      </span>
                    </TableCell>

                    {/* Actions */}
                    <TableCell align="right">
                      <div className="flex gap-1.5 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewHistory(item)}
                          title="View audit movement history"
                          className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                          History
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onAdjustStock(item)}
                          disabled={!canManage}
                          title="Adjust stock quantity"
                          className="h-8 px-2.5 text-xs"
                        >
                          Adjust
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
    </div>
  );
}
