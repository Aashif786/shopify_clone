"use client";

import React, { useState } from "react";
import type { DailySalesTrendPoint } from "@shopify-clone/orders";
import { formatOrderPrice } from "../../../lib/merchant-order-helpers";

interface SalesTrendChartProps {
  data: DailySalesTrendPoint[];
  currency?: string;
  height?: number;
}

export function SalesTrendChart({
  data,
  currency = "USD",
  height = 240,
}: SalesTrendChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div
        style={{
          height: `${height}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--color-surface-subtle)",
          borderRadius: "var(--radius-md)",
          color: "var(--color-text-muted)",
          fontSize: "var(--font-size-sm)",
        }}
      >
        No sales data available for the selected period
      </div>
    );
  }

  const maxSales = Math.max(
    ...data.map((d) => Math.max(d.grossSales, d.netSales)),
    100 // minimum scale 1 dollar / 100 cents
  );

  const chartWidth = 800;
  const chartHeight = height;
  const paddingBottom = 40;
  const paddingTop = 20;
  const paddingLeft = 10;
  const paddingRight = 10;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const barSlotWidth = innerWidth / data.length;
  const barWidth = Math.max(4, Math.min(24, barSlotWidth * 0.6));

  const hoveredPoint = hoveredIndex !== null ? data[hoveredIndex] : null;

  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        padding: "var(--space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
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
            Sales & Orders Over Time
          </h3>
          <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
            Daily gross vs net sales and order volume
          </span>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
            <span
              style={{
                width: "12px",
                height: "12px",
                background: "var(--color-primary, #2563eb)",
                borderRadius: "2px",
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
              Net Sales
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
            <span
              style={{
                width: "12px",
                height: "12px",
                background: "var(--color-border-strong, #94a3b8)",
                borderRadius: "2px",
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
              Gross Sales
            </span>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div style={{ position: "relative", width: "100%", overflowX: "auto" }}>
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          style={{ width: "100%", height: "auto", display: "block" }}
          role="img"
          aria-label="Daily sales and order trend chart"
        >
          {/* Horizontal grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = paddingTop + innerHeight * (1 - pct);
            const labelVal = Math.round((maxSales * pct) / 100);
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke="var(--color-border-subtle, rgba(0,0,0,0.06))"
                  strokeDasharray={pct > 0 && pct < 1 ? "4 4" : undefined}
                />
                {pct > 0 && (
                  <text
                    x={chartWidth - paddingRight - 4}
                    y={y - 4}
                    textAnchor="end"
                    fill="var(--color-text-muted)"
                    fontSize="10"
                    opacity="0.6"
                  >
                    ${labelVal}
                  </text>
                )}
              </g>
            );
          })}

          {/* Bars */}
          {data.map((point, index) => {
            const xCenter = paddingLeft + index * barSlotWidth + barSlotWidth / 2;
            const grossHeight = (point.grossSales / maxSales) * innerHeight;
            const netHeight = (Math.max(0, point.netSales) / maxSales) * innerHeight;

            const grossY = paddingTop + innerHeight - grossHeight;
            const netY = paddingTop + innerHeight - netHeight;

            const isHovered = hoveredIndex === index;

            return (
              <g
                key={point.date}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Background hover highlight */}
                {isHovered && (
                  <rect
                    x={paddingLeft + index * barSlotWidth}
                    y={paddingTop}
                    width={barSlotWidth}
                    height={innerHeight}
                    fill="var(--color-surface-hover, rgba(0,0,0,0.03))"
                    rx="4"
                  />
                )}

                {/* Gross Sales Background Bar */}
                <rect
                  x={xCenter - barWidth / 2}
                  y={grossY}
                  width={barWidth}
                  height={Math.max(2, grossHeight)}
                  fill="var(--color-border-strong, #94a3b8)"
                  opacity={isHovered ? 0.8 : 0.4}
                  rx="2"
                />

                {/* Net Sales Foreground Bar */}
                <rect
                  x={xCenter - barWidth / 2}
                  y={netY}
                  width={barWidth}
                  height={Math.max(2, netHeight)}
                  fill="var(--color-primary, #2563eb)"
                  opacity={isHovered ? 1 : 0.85}
                  rx="2"
                />

                {/* X Axis Date Label */}
                {(data.length <= 14 || index % Math.ceil(data.length / 8) === 0) && (
                  <text
                    x={xCenter}
                    y={chartHeight - 14}
                    textAnchor="middle"
                    fill="var(--color-text-muted)"
                    fontSize="11"
                  >
                    {point.date.slice(5)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div
            style={{
              padding: "var(--space-2) var(--space-3)",
              background: "var(--color-surface-raised, #1e293b)",
              color: "#ffffff",
              borderRadius: "var(--radius-md)",
              fontSize: "var(--font-size-xs)",
              boxShadow: "var(--shadow-md)",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              marginTop: "var(--space-2)",
            }}
          >
            <div style={{ fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.2)", paddingBottom: "2px" }}>
              {hoveredPoint.date} • {hoveredPoint.orderCount} {hoveredPoint.orderCount === 1 ? "Order" : "Orders"}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-4)" }}>
              <span style={{ opacity: 0.8 }}>Net Sales:</span>
              <span style={{ fontWeight: 600 }}>{formatOrderPrice(hoveredPoint.netSales, currency)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-4)" }}>
              <span style={{ opacity: 0.8 }}>Gross Sales:</span>
              <span>{formatOrderPrice(hoveredPoint.grossSales, currency)}</span>
            </div>
            {hoveredPoint.discounts > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-4)" }}>
                <span style={{ opacity: 0.8 }}>Discounts:</span>
                <span>-{formatOrderPrice(hoveredPoint.discounts, currency)}</span>
              </div>
            )}
            {hoveredPoint.refunds > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-4)" }}>
                <span style={{ opacity: 0.8 }}>Refunds:</span>
                <span>-{formatOrderPrice(hoveredPoint.refunds, currency)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
