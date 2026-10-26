"use client";

import React, { useState } from "react";
import type { TopProductItem } from "@shopify-clone/orders";
import { formatOrderPrice } from "../../../lib/merchant-order-helpers";
import { Package } from "lucide-react";

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
    <div className="rounded-xl border border-border/60 bg-card p-4 sm:p-5 shadow-xs flex flex-col gap-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground m-0 flex items-center gap-1.5">
            <Package className="w-4 h-4 text-primary" />
            Top Performing Products
          </h3>
          <span className="text-xs text-muted-foreground">
            Best-selling catalog items in this reporting period
          </span>
        </div>

        {/* Tab Toggle */}
        <div className="inline-flex p-0.5 rounded-lg border border-border/60 bg-muted/30">
          <button
            type="button"
            onClick={() => setTab("units")}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
              tab === "units"
                ? "bg-background text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            By Units Sold
          </button>
          <button
            type="button"
            onClick={() => setTab("revenue")}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
              tab === "revenue"
                ? "bg-background text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            By Net Revenue
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          No product sales recorded in this period.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-muted-foreground uppercase text-[11px] tracking-wider">
                <th className="py-2.5 px-3 w-10">#</th>
                <th className="py-2.5 px-3">Product</th>
                <th className="py-2.5 px-3 text-right">Units</th>
                <th className="py-2.5 px-3 text-right">Gross</th>
                <th className="py-2.5 px-3 text-right">Discounts</th>
                <th className="py-2.5 px-3 text-right">Net Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {items.map((prod, index) => (
                <tr
                  key={`${prod.productId ?? index}-${prod.productName}`}
                  className="hover:bg-muted/30 transition-colors"
                >
                  <td className="py-2.5 px-3 text-muted-foreground font-mono font-medium">
                    {index + 1}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-foreground">
                    {prod.productName || "Unnamed Product"}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-foreground">
                    {prod.unitsSold.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                    {formatOrderPrice(prod.grossRevenue, currency)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                    {prod.discountAmount > 0
                      ? `-${formatOrderPrice(prod.discountAmount, currency)}`
                      : "—"}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-primary">
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
