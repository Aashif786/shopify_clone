import React from "react";

export type StatusVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "purple";

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  pulse?: boolean;
  className?: string;
}

export function StatusBadge({ status, variant, pulse = false, className = "" }: StatusBadgeProps) {
  let computedVariant = variant;
  const upper = status.toUpperCase();

  if (!computedVariant) {
    if (["ACTIVE", "HEALTHY", "SUCCESS", "CAPTURED", "COMPLETED", "TRUE", "ENABLED", "CONNECTED"].includes(upper)) {
      computedVariant = "success";
    } else if (["WARNING", "PENDING", "PROCESSING", "TRIAL", "PAST_DUE", "DEGRADED"].includes(upper)) {
      computedVariant = "warning";
    } else if (["FAILED", "SUSPENDED", "CRITICAL", "ARCHIVED", "DANGER", "CANCELLED", "ERROR", "DISABLED"].includes(upper)) {
      computedVariant = "danger";
    } else if (["INFO", "INVITED", "DRAFT"].includes(upper)) {
      computedVariant = "info";
    } else {
      computedVariant = "neutral";
    }
  }

  const variantStyles: Record<StatusVariant, { bg: string; dot: string }> = {
    success: {
      bg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
      dot: "bg-emerald-400",
    },
    warning: {
      bg: "bg-amber-500/10 border-amber-500/20 text-amber-400",
      dot: "bg-amber-400",
    },
    danger: {
      bg: "bg-rose-500/10 border-rose-500/20 text-rose-400",
      dot: "bg-rose-400",
    },
    info: {
      bg: "bg-sky-500/10 border-sky-500/20 text-sky-400",
      dot: "bg-sky-400",
    },
    purple: {
      bg: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400",
      dot: "bg-indigo-400",
    },
    neutral: {
      bg: "bg-slate-500/10 border-slate-500/20 text-slate-300",
      dot: "bg-slate-400",
    },
  };

  const current = variantStyles[computedVariant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${current.bg} ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {pulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${current.dot}`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${current.dot}`} />
      </span>
      {status}
    </span>
  );
}
