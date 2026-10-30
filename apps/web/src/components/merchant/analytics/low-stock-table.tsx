"use client";

import React from "react";
import Link from "next/link";
import type { LowStockVariantItem } from "@calcart/orders";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRight, AlertTriangle } from "lucide-react";

interface LowStockTableProps {
  lowStockItems: LowStockVariantItem[];
}

export function LowStockTable({ lowStockItems }: LowStockTableProps) {
  return (
    <div className="bg-card rounded-xl border border-border/60 p-5 flex flex-col gap-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground m-0 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Inventory Alerts &amp; Stock Depletion
          </h3>
          <span className="text-xs text-muted-foreground">
            Variants requiring restock (available inventory &le; 10 units)
          </span>
        </div>

        <Link
          href="/merchant/inventory"
          className="btn btn-outline btn-sm text-xs inline-flex items-center gap-1.5 rounded-lg"
        >
          <span>Manage Inventory</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {lowStockItems.length === 0 ? (
        <div className="py-6 px-4 text-center bg-muted/20 rounded-lg border border-dashed border-border/60 flex flex-col items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            All Inventory Levels are Healthy
          </span>
          <span className="text-xs text-muted-foreground">
            No product variants are currently depleted or below low-stock thresholds.
          </span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground uppercase text-[11px] font-semibold">
                <th className="py-2.5 px-3">Product &amp; Variant</th>
                <th className="py-2.5 px-3">SKU</th>
                <th className="py-2.5 px-3 text-right">Available</th>
                <th className="py-2.5 px-3 text-right">Reserved</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {lowStockItems.map((item) => (
                <tr
                  key={item.inventoryItemId}
                  className="border-b border-border/40 hover:bg-muted/20 transition-colors"
                >
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-foreground">
                      {item.productName}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {item.variantName}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground font-mono text-[11px]">
                    {item.sku || "&mdash;"}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-mono font-bold ${
                      item.availableQuantity <= 0 ? "text-rose-500" : "text-amber-500"
                    }`}
                  >
                    {item.availableQuantity}
                  </td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground font-mono">
                    {item.reservedQuantity}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {item.availableQuantity <= 0 ? (
                      <Badge variant="destructive" className="text-[10px]">Depleted (0)</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Low Stock ({item.availableQuantity})</Badge>
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
