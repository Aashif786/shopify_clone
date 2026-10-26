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
        style={{ height: `${height}px` }}
        className="flex items-center justify-center rounded-xl border border-border/60 bg-card text-xs text-muted-foreground"
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
    <div className="rounded-xl border border-border/60 bg-card p-4 sm:p-5 shadow-xs flex flex-col gap-3">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground m-0">
            Sales &amp; Orders Over Time
          </h3>
          <span className="text-xs text-muted-foreground">
            Daily gross vs net sales and order volume
          </span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-primary inline-block" />
            <span>Net Sales</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-muted-foreground/30 border border-border inline-block" />
            <span>Gross Sales</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto block"
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
                  stroke="currentColor"
                  className="text-border/40"
                  strokeDasharray={pct > 0 && pct < 1 ? "4 4" : undefined}
                />
                {pct > 0 && (
                  <text
                    x={chartWidth - paddingRight - 4}
                    y={y - 4}
                    textAnchor="end"
                    fill="currentColor"
                    className="text-muted-foreground text-[10px] font-mono select-none"
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
                className="cursor-pointer"
              >
                {/* Background hover highlight */}
                {isHovered && (
                  <rect
                    x={paddingLeft + index * barSlotWidth}
                    y={paddingTop}
                    width={barSlotWidth}
                    height={innerHeight}
                    fill="currentColor"
                    className="text-muted/40"
                    rx="4"
                  />
                )}

                {/* Gross Sales Background Bar */}
                <rect
                  x={xCenter - barWidth / 2}
                  y={grossY}
                  width={barWidth}
                  height={Math.max(2, grossHeight)}
                  fill="currentColor"
                  className="text-muted-foreground/30"
                  opacity={isHovered ? 0.7 : 0.4}
                  rx="2"
                />

                {/* Net Sales Foreground Bar */}
                <rect
                  x={xCenter - barWidth / 2}
                  y={netY}
                  width={barWidth}
                  height={Math.max(2, netHeight)}
                  fill="currentColor"
                  className="text-primary"
                  opacity={isHovered ? 1 : 0.85}
                  rx="2"
                />

                {/* X Axis Date Label */}
                {(data.length <= 14 || index % Math.ceil(data.length / 8) === 0) && (
                  <text
                    x={xCenter}
                    y={chartHeight - 14}
                    textAnchor="middle"
                    fill="currentColor"
                    className="text-muted-foreground font-mono text-[10px] select-none"
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
          <div className="p-3 bg-popover text-popover-foreground border border-border/60 rounded-lg text-xs shadow-md mt-2 flex flex-col gap-1.5 max-w-sm">
            <div className="font-semibold border-b border-border/50 pb-1 text-foreground flex items-center justify-between">
              <span className="font-mono">{hoveredPoint.date}</span>
              <span className="text-muted-foreground font-normal">
                {hoveredPoint.orderCount} {hoveredPoint.orderCount === 1 ? "Order" : "Orders"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Net Sales:</span>
              <span className="font-mono font-semibold text-foreground">
                {formatOrderPrice(hoveredPoint.netSales, currency)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Gross Sales:</span>
              <span className="font-mono text-muted-foreground">
                {formatOrderPrice(hoveredPoint.grossSales, currency)}
              </span>
            </div>
            {hoveredPoint.discounts > 0 && (
              <div className="flex justify-between gap-4 text-emerald-600 dark:text-emerald-400">
                <span>Discounts:</span>
                <span className="font-mono">-{formatOrderPrice(hoveredPoint.discounts, currency)}</span>
              </div>
            )}
            {hoveredPoint.refunds > 0 && (
              <div className="flex justify-between gap-4 text-destructive">
                <span>Refunds:</span>
                <span className="font-mono">-{formatOrderPrice(hoveredPoint.refunds, currency)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
