"use client";

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatOrderPrice } from "../../../lib/merchant-order-helpers";
import { NumberTicker } from "../../ui/number-ticker";

interface KpiCardProps {
  title: string;
  value: number;
  isMonetary?: boolean;
  currency?: string;
  priorValue?: number;
  deltaPct?: number;
  invertDeltaColor?: boolean;
  helperText?: string;
  icon?: React.ReactNode;
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
  const formattedPrior =
    priorValue !== undefined
      ? isMonetary
        ? formatOrderPrice(priorValue, currency)
        : priorValue.toLocaleString("en-US")
      : null;

  const hasDelta = deltaPct !== undefined && !Number.isNaN(deltaPct);
  const isPositive = (deltaPct ?? 0) > 0;
  const isZero = (deltaPct ?? 0) === 0;

  let deltaBg = "bg-muted text-muted-foreground";
  if (!isZero && hasDelta) {
    if (invertDeltaColor) {
      deltaBg = isPositive
        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    } else {
      deltaBg = isPositive
        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        : "bg-rose-500/10 text-rose-600 dark:text-rose-400";
    }
  }

  const deltaSign = isPositive ? "+" : "";

  return (
    <div className="kpi-card group relative bg-card rounded-xl border border-border/60 p-5 flex flex-col gap-3 hover:border-border transition-colors">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider leading-none">
          {title}
        </span>
        {icon && (
          <span className="text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
            {icon}
          </span>
        )}
      </div>

      {/* Primary metric */}
      <div className="flex items-baseline gap-1.5">
        {isMonetary ? (
          <div className="text-2xl font-bold tracking-tight text-foreground font-mono leading-none" aria-label={`${title}: ${formatOrderPrice(value, currency)}`}>
            <span className="text-base font-semibold text-muted-foreground mr-0.5">
              {currency === "USD" ? "$" : currency === "INR" ? "₹" : currency === "EUR" ? "€" : ""}
            </span>
            <NumberTicker value={value / 100} decimalPlaces={2} />
          </div>
        ) : (
          <div className="text-2xl font-bold tracking-tight text-foreground font-mono leading-none" aria-label={`${title}: ${value.toLocaleString()}`}>
            <NumberTicker value={value} />
          </div>
        )}
      </div>

      {/* Delta + prior */}
      <div className="flex items-center gap-2 flex-wrap min-h-[22px]">
        {hasDelta && (
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full leading-none ${deltaBg}`}>
            {isZero ? (
              <Minus className="h-3 w-3" aria-hidden="true" />
            ) : isPositive ? (
              <TrendingUp className="h-3 w-3" aria-hidden="true" />
            ) : (
              <TrendingDown className="h-3 w-3" aria-hidden="true" />
            )}
            <span>{deltaSign}{deltaPct}%</span>
          </span>
        )}
        {formattedPrior && (
          <span className="text-[11px] text-muted-foreground truncate">
            vs {formattedPrior}
          </span>
        )}
        {!hasDelta && !formattedPrior && (
          <span className="text-[11px] text-muted-foreground/40 font-mono">—</span>
        )}
      </div>

      {helperText && (
        <span className="text-[11px] text-muted-foreground border-t border-border/40 pt-2 leading-relaxed">
          {helperText}
        </span>
      )}
    </div>
  );
}
