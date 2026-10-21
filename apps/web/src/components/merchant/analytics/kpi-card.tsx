"use client";

import React from "react";
import { formatOrderPrice } from "../../../lib/merchant-order-helpers";

interface KpiCardProps {
  title: string;
  value: number;
  isMonetary?: boolean;
  currency?: string;
  priorValue?: number;
  deltaPct?: number;
  invertDeltaColor?: boolean; // For refunds/cancellations, higher is not necessarily better
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

  // Color logic
  let deltaColor = "var(--color-text-muted)";
  let deltaBg = "var(--color-surface-subtle, rgba(0,0,0,0.04))";

  if (!isZero) {
    if (invertDeltaColor) {
      deltaColor = isPositive ? "var(--color-danger, #ef4444)" : "var(--color-success, #10b981)";
      deltaBg = isPositive ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)";
    } else {
      deltaColor = isPositive ? "var(--color-success, #10b981)" : "var(--color-danger, #ef4444)";
      deltaBg = isPositive ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)";
    }
  }

  const arrow = isZero ? "—" : isPositive ? "↑" : "↓";
  const deltaSign = isPositive ? "+" : "";

  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        padding: "var(--space-5)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: "var(--space-3)",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span
          style={{
            fontSize: "var(--font-size-sm)",
            fontWeight: 600,
            color: "var(--color-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {title}
        </span>
        {icon && (
          <span
            style={{
              fontSize: "var(--font-size-xs)",
              color: "var(--color-text-muted)",
              background: "var(--color-surface-subtle)",
              padding: "2px 6px",
              borderRadius: "var(--radius-sm)",
            }}
          >
            {icon}
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
        <span
          style={{
            fontSize: "var(--font-size-2xl, 24px)",
            fontWeight: 700,
            color: "var(--color-text)",
            letterSpacing: "-0.02em",
          }}
        >
          {formattedValue}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
        {hasDelta && (
          <span
            style={{
              fontSize: "var(--font-size-xs)",
              fontWeight: 600,
              color: deltaColor,
              background: deltaBg,
              padding: "2px 8px",
              borderRadius: "var(--radius-full, 9999px)",
              display: "inline-flex",
              alignItems: "center",
              gap: "2px",
            }}
          >
            <span>{arrow}</span>
            <span>{deltaSign}{deltaPct}%</span>
          </span>
        )}

        {formattedPrior && (
          <span
            style={{
              fontSize: "var(--font-size-xs)",
              color: "var(--color-text-muted)",
            }}
          >
            vs prior ({formattedPrior})
          </span>
        )}
      </div>

      {helperText && (
        <span
          style={{
            fontSize: "var(--font-size-xs)",
            color: "var(--color-text-muted)",
            marginTop: "var(--space-1)",
          }}
        >
          {helperText}
        </span>
      )}
    </div>
  );
}
