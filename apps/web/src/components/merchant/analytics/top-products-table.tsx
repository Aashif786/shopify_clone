"use client";

import React, { useState } from "react";
import type { TopProductItem } from "@shopify-clone/orders";
import { formatOrderPrice } from "../../../lib/merchant-order-helpers";

interface TopProductsTableProps {
  topByUnits: TopProductItem[];
  topByRevenue: TopProductItem[];
  currency?: string;
}

export function TopProductsTable({
  topByUnits,
  topByRevenue,
  currency = "USD",
}: TopProductsTableProps) {
  const [tab, setTab] = useState<"units" | "revenue">("units");

  const items = tab === "units" ? topByUnits : topByRevenue;

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
            Top Performing Products
          </h3>
          <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
            Best-selling catalog items in this reporting period
          </span>
        </div>

        {/* Tab Toggle */}
        <div
          style={{
            display: "inline-flex",
            background: "var(--color-surface-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "2px",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          <button
            type="button"
            onClick={() => setTab("units")}
            style={{
              padding: "4px 12px",
              fontSize: "var(--font-size-xs)",
              fontWeight: 600,
              borderRadius: "var(--radius-sm)",
              border: "none",
              cursor: "pointer",
              background: tab === "units" ? "var(--color-surface)" : "transparent",
              color: tab === "units" ? "var(--color-text)" : "var(--color-text-muted)",
              boxShadow: tab === "units" ? "var(--shadow-sm)" : "none",
            }}
          >
            By Units Sold
          </button>
          <button
            type="button"
            onClick={() => setTab("revenue")}
            style={{
              padding: "4px 12px",
              fontSize: "var(--font-size-xs)",
              fontWeight: 600,
              borderRadius: "var(--radius-sm)",
              border: "none",
              cursor: "pointer",
              background: tab === "revenue" ? "var(--color-surface)" : "transparent",
              color: tab === "revenue" ? "var(--color-text)" : "var(--color-text-muted)",
              boxShadow: tab === "revenue" ? "var(--shadow-sm)" : "none",
            }}
          >
            By Net Revenue
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div
          style={{
            padding: "var(--space-8) 0",
            textAlign: "center",
            color: "var(--color-text-muted)",
            fontSize: "var(--font-size-sm)",
          }}
        >
          No product sales recorded in this period.
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
                <th style={{ padding: "8px 12px", width: "40px" }}>#</th>
                <th style={{ padding: "8px 12px" }}>Product</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Units Sold</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Gross Revenue</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Discounts</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Net Revenue</th>
              </tr>
            </thead>
            <tbody>
              {items.map((prod, index) => (
                <tr
                  key={`${prod.productId ?? index}-${prod.productName}`}
                  style={{
                    borderBottom: "1px solid var(--color-border-subtle)",
                  }}
                >
                  <td style={{ padding: "10px 12px", color: "var(--color-text-muted)", fontWeight: 600 }}>
                    {index + 1}
                  </td>
                  <td style={{ padding: "10px 12px", fontWeight: 500, color: "var(--color-text)" }}>
                    {prod.productName || "Unnamed Product"}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>
                    {prod.unitsSold.toLocaleString()}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--color-text-muted)" }}>
                    {formatOrderPrice(prod.grossRevenue, currency)}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--color-text-muted)" }}>
                    {prod.discountAmount > 0
                      ? `-${formatOrderPrice(prod.discountAmount, currency)}`
                      : "—"}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      textAlign: "right",
                      fontWeight: 600,
                      color: "var(--color-primary, #2563eb)",
                    }}
                  >
                    {formatOrderPrice(prod.netRevenue, currency)}
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
