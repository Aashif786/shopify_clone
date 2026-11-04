import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  changePercent?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  alertVariant?: "critical" | "warning" | "normal";
}

export function MetricCard({
  title,
  value,
  subtitle,
  changePercent,
  changeLabel,
  icon,
  badge,
  alertVariant = "normal",
}: MetricCardProps) {
  const borderClass =
    alertVariant === "critical"
      ? "border-rose-500/40 bg-rose-950/10"
      : alertVariant === "warning"
      ? "border-amber-500/40 bg-amber-950/10"
      : "border-white/10 bg-[#0c111c]/90 hover:border-white/20";

  return (
    <div
      className={`relative p-5 rounded-xl border backdrop-blur-md transition-all duration-200 ${borderClass}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
          {title}
        </span>
        <div className="flex items-center gap-2">
          {badge}
          {icon && <div className="text-slate-400">{icon}</div>}
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-white font-mono">
          {value}
        </span>
      </div>

      {(subtitle || changePercent !== undefined) && (
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
          {changePercent !== undefined && (
            <span
              className={`inline-flex items-center gap-0.5 font-medium ${
                changePercent > 0
                  ? "text-emerald-400"
                  : changePercent < 0
                  ? "text-rose-400"
                  : "text-slate-400"
              }`}
            >
              {changePercent > 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : changePercent < 0 ? (
                <TrendingDown className="w-3 h-3" />
              ) : (
                <Minus className="w-3 h-3" />
              )}
              {Math.abs(changePercent)}%
            </span>
          )}
          {changeLabel && <span>{changeLabel}</span>}
          {subtitle && !changeLabel && <span>{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
