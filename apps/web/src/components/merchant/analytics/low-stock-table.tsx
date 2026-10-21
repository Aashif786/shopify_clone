"use client";

import React from "react";
import type { LowStockVariantItem } from "@shopify-clone/orders";
import { Badge } from "@/components/ui/badge";

interface LowStockTableProps {
  lowStockItems: LowStockVariantItem[];
}

export function LowStockTable({ lowStockItems }: LowStockTableProps) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        padding: "var(--space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-2)",
        }}
      >
        <div>
          <h3
            style={{
              fontSize: "var(--font-size-base)",
              fontWeight: 600,
              color: "var(--color-text)",
              margin: 0,
            }}
          >
            Inventory Alerts & Stock Depletion
          </h3>
          <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
            Variants requiring restock (available inventory ≤ 10 units)
          </span>
        </div>

        <a href="/merchant/inventory" className="btn btn-outline btn-sm">
          Manage Inventory →
        </a>
      </div>

      {lowStockItems.length === 0 ? (
        <div
          style={{
            padding: "var(--space-6) var(--space-4)",
            textAlign: "center",
            background: "var(--color-surface-subtle)",
            borderRadius: "var(--radius-md)",
            border: "1px dashed var(--color-border)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--space-2)",
          }}
        >
          <span style={{ fontSize: "20px" }}>✓</span>
          <span style={{ fontWeight: 600, color: "var(--color-success, #10b981)" }}>
            All Inventory Levels are Healthy
          </span>
          <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
            No product variants are currently depleted or below low-stock thresholds.
          </span>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: "var(--font-size-sm)",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--color-border)",
                  color: "var(--color-text-muted)",
                  fontSize: "var(--font-size-xs)",
                  textTransform: "uppercase",
                }}
              >
                <th style={{ padding: "8px 12px" }}>Product & Variant</th>
                <th style={{ padding: "8px 12px" }}>SKU</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Available</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Reserved</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {lowStockItems.map((item) => (
                <tr
                  key={item.inventoryItemId}
                  style={{
                    borderBottom: "1px solid var(--color-border-subtle)",
                  }}
                >
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ fontWeight: 500, color: "var(--color-text)" }}>
                      {item.productName}
                    </div>
                    <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                      {item.variantName}
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
                    {item.sku || "—"}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      textAlign: "right",
                      fontWeight: 700,
                      color: item.availableQuantity <= 0 ? "var(--color-danger, #ef4444)" : "var(--color-warning, #f59e0b)",
                    }}
                  >
                    {item.availableQuantity}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--color-text-muted)" }}>
                    {item.reservedQuantity}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    {item.availableQuantity <= 0 ? (
                      <Badge variant="destructive">Depleted (0)</Badge>
                    ) : (
                      <Badge variant="secondary">Low Stock ({item.availableQuantity})</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
