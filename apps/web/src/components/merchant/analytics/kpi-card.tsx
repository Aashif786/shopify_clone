"use client";

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatOrderPrice } from "../../../lib/merchant-order-helpers";

interface KpiCardProps {
  title: string;
  value: number;
  isMonetary?: boolean;
  currency?: string;
  priorValue?: number;
  deltaPct?: number;
  invertDeltaColor?: boolean;
  helperText?: string;
  icon?: string;
}

export function KpiCard({
  title,
  value,
  isMonetary = true,
  currency = "USD",
  priorValue,
  deltaPct,
  invertDeltaColor = false,
  helperText,
  icon,
}: KpiCardProps) {
  const formattedValue = isMonetary
    ? formatOrderPrice(value, currency)
    : value.toLocaleString("en-US");

  const formattedPrior =
    priorValue !== undefined
      ? isMonetary
        ? formatOrderPrice(priorValue, currency)
        : priorValue.toLocaleString("en-US")
      : null;

  const hasDelta = deltaPct !== undefined && !Number.isNaN(deltaPct);
  const isPositive = (deltaPct ?? 0) > 0;
  const isZero = (deltaPct ?? 0) === 0;

  let deltaColorClass = "text-muted-foreground bg-muted";

  if (!isZero) {
    if (invertDeltaColor) {
      deltaColorClass = isPositive
        ? "text-rose-600 dark:text-rose-400 bg-rose-500/10"
        : "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10";
    } else {
      deltaColorClass = isPositive
        ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
        : "text-rose-600 dark:text-rose-400 bg-rose-500/10";
    }
  }

  const deltaSign = isPositive ? "+" : "";

  return (
    <div className="bg-card rounded-xl border border-border/70 p-4 shadow-sm flex flex-col justify-between gap-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </span>
        {icon && (
          <span className="text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
            {icon}
          </span>
        )}
      </div>

      <div>
        <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
          {formattedValue}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {hasDelta && (
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${deltaColorClass}`}
          >
            {isZero ? (
              <Minus className="h-3 w-3" />
            ) : isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>
              {deltaSign}{deltaPct}%
            </span>
          </span>
        )}

        {formattedPrior && (
          <span className="text-[11px] text-muted-foreground truncate">
            vs prior ({formattedPrior})
          </span>
        )}
      </div>

      {helperText && (
        <span className="text-[11px] text-muted-foreground border-t border-border/40 pt-2 -mb-0.5">
          {helperText}
        </span>
      )}
    </div>
  );
}
