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
  getStockStatus,
  type InventoryVariantItem,
} from "../../../lib/merchant-inventory-helpers";

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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      {/* KPI Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "var(--space-3)",
        }}
      >
        {/* Total Variants */}
        <div
          style={{
            padding: "var(--space-4)",
            backgroundColor: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Tracked Variants
          </div>
          <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: 700, color: "var(--color-text-primary)", marginTop: "var(--space-1)" }}>
            {kpis.totalVariants}
          </div>
        </div>

        {/* Total Available */}
        <div
          style={{
            padding: "var(--space-4)",
            backgroundColor: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Available Units
          </div>
          <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: 700, color: "var(--color-success, #16a34a)", marginTop: "var(--space-1)" }}>
            {kpis.totalAvailable}
          </div>
        </div>

        {/* Total Reserved */}
        <div
          style={{
            padding: "var(--space-4)",
            backgroundColor: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Reserved (Checkouts)
          </div>
          <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: 700, color: "var(--color-warning, #d97706)", marginTop: "var(--space-1)" }}>
            {kpis.totalReserved}
          </div>
        </div>

        {/* Out of Stock */}
        <div
          style={{
            padding: "var(--space-4)",
            backgroundColor: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Out of Stock
          </div>
          <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: 700, color: kpis.outOfStockCount > 0 ? "var(--color-danger, #dc2626)" : "var(--color-text-primary)", marginTop: "var(--space-1)" }}>
            {kpis.outOfStockCount}
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <Card>
        <CardHeader>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "var(--space-3)",
            }}
          >
            <div>
              <CardTitle>Inventory Levels</CardTitle>
              <p style={{ margin: "4px 0 0", color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
                Authoritative on-hand, reserved, and available quantities across all variants.
              </p>
            </div>

            {/* Filter controls */}
            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ minWidth: "220px" }}>
                <Input
                  id="inventory-search"
                  placeholder="Search product, variant, SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ fontSize: "var(--font-size-sm)" }}
                  aria-label="Search inventory"
                />
              </div>

              <div style={{ minWidth: "160px" }}>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter inventory by stock status"
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

        <CardContent>
          {filteredItems.length === 0 ? (
            <div
              style={{
                padding: "var(--space-8)",
                textAlign: "center",
                color: "var(--color-text-muted)",
              }}
            >
              <div style={{ fontSize: "var(--font-size-md)", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "var(--space-2)" }}>
                No Matching Inventory Records
              </div>
              <p style={{ margin: 0, fontSize: "var(--font-size-sm)" }}>
                No variants match the current search query or filter.
              </p>
              {(searchQuery || statusFilter !== "all") && (
                <div style={{ marginTop: "var(--space-4)" }}>
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
                <TableRow>
                  <TableHead>Product & Variant</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead align="right">Available</TableHead>
                  <TableHead align="right">Reserved</TableHead>
                  <TableHead align="right">Total On-Hand</TableHead>
                  <TableHead align="right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.variantId}>
                    {/* Product & Variant */}
                    <TableCell>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>
                          <a
                            href={`/merchant/products/${item.productId}`}
                            style={{ color: "var(--color-primary)", textDecoration: "none" }}
                            title="View product details"
                          >
                            {item.productTitle}
                          </a>
                        </div>
                        <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)", marginTop: "2px" }}>
                          Variant: <strong>{item.variantTitle}</strong>
                        </div>
                      </div>
                    </TableCell>

                    {/* SKU */}
                    <TableCell>
                      {item.sku ? (
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "11px",
                            backgroundColor: "var(--color-bg)",
                            padding: "2px 6px",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          {item.sku}
                        </span>
                      ) : (
                        <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
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
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: "var(--font-size-sm)",
                          fontFamily: "var(--font-mono)",
                          color:
                            item.availableQuantity > 0
                              ? "var(--color-text-primary)"
                              : "var(--color-danger, #dc2626)",
                        }}
                      >
                        {item.availableQuantity}
                      </span>
                    </TableCell>

                    {/* Reserved Quantity */}
                    <TableCell align="right">
                      {item.reservedQuantity > 0 ? (
                        <span
                          style={{
                            fontWeight: 600,
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--font-size-xs)",
                            color: "var(--color-warning, #d97706)",
                          }}
                          title="Stock held by active checkouts"
                        >
                          {item.reservedQuantity}
                        </span>
                      ) : (
                        <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
                          0
                        </span>
                      )}
                    </TableCell>

                    {/* Total On-Hand */}
                    <TableCell align="right">
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: "var(--font-size-sm)",
                          fontFamily: "var(--font-mono)",
                          color: "var(--color-text-primary)",
                        }}
                      >
                        {item.totalQuantity}
                      </span>
                    </TableCell>

                    {/* Actions */}
                    <TableCell align="right">
                      <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewHistory(item)}
                          title="View audit movement history"
                        >
                          History
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onAdjustStock(item)}
                          disabled={!canManage}
                          title="Adjust stock quantity"
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
