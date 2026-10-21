"use client";

import React from "react";
import type {
  FulfillmentStatusDistributionItem,
  OrderStatusDistributionItem,
  PaymentStatusDistributionItem,
} from "@shopify-clone/orders";
import { formatOrderPrice } from "../../../lib/merchant-order-helpers";

interface OrderStatusChartProps {
  ordersByStatus: OrderStatusDistributionItem[];
  ordersByPayment: PaymentStatusDistributionItem[];
  ordersByFulfillment: FulfillmentStatusDistributionItem[];
  currency?: string;
}

export function OrderStatusChart({
  ordersByStatus,
  ordersByPayment,
  ordersByFulfillment,
  currency = "USD",
}: OrderStatusChartProps) {
  const totalOrders = ordersByStatus.reduce((acc, curr) => acc + curr.count, 0);

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
      <div>
        <h3
          style={{
            fontSize: "var(--font-size-base)",
            fontWeight: 600,
            color: "var(--color-text)",
            margin: 0,
          }}
        >
          Order & Payment Status Breakdown
        </h3>
        <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
          Distribution across {totalOrders} total orders placed in period
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "var(--space-4)",
        }}
      >
        {/* Order Lifecycle Status */}
        <div
          style={{
            background: "var(--color-surface-subtle)",
            padding: "var(--space-4)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
          }}
        >
          <span
            style={{
              fontSize: "var(--font-size-xs)",
              fontWeight: 600,
              color: "var(--color-text-muted)",
              textTransform: "uppercase",
            }}
          >
            Order Lifecycle
          </span>

          {ordersByStatus.length === 0 ? (
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
              No orders in period
            </span>
          ) : (
            ordersByStatus.map((item) => {
              const pct = totalOrders > 0 ? Math.round((item.count / totalOrders) * 100) : 0;
              const isCancelled = item.status === "CANCELLED";
              const isCompleted = item.status === "COMPLETED" || item.status === "DELIVERED";

              return (
                <div key={item.status} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "var(--font-size-xs)",
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{item.status}</span>
                    <span style={{ color: "var(--color-text-muted)" }}>
                      {item.count} ({pct}%) • {formatOrderPrice(item.totalAmount, currency)}
                    </span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: "6px",
                      background: "var(--color-border-subtle)",
                      borderRadius: "3px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: isCancelled
                          ? "var(--color-danger, #ef4444)"
                          : isCompleted
                          ? "var(--color-success, #10b981)"
                          : "var(--color-primary, #2563eb)",
                        borderRadius: "3px",
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Payment Status */}
        <div
          style={{
            background: "var(--color-surface-subtle)",
            padding: "var(--space-4)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
          }}
        >
          <span
            style={{
              fontSize: "var(--font-size-xs)",
              fontWeight: 600,
              color: "var(--color-text-muted)",
              textTransform: "uppercase",
            }}
          >
            Payment Settlement
          </span>

          {ordersByPayment.length === 0 ? (
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
              No payments recorded
            </span>
          ) : (
            ordersByPayment.map((item) => {
              const pct = totalOrders > 0 ? Math.round((item.count / totalOrders) * 100) : 0;
              const isPaid = item.paymentStatus === "PAID";
              const isRefunded =
                item.paymentStatus === "REFUNDED" ||
                item.paymentStatus === "PARTIALLY_REFUNDED";

              return (
                <div key={item.paymentStatus} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "var(--font-size-xs)",
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{item.paymentStatus}</span>
                    <span style={{ color: "var(--color-text-muted)" }}>
                      {item.count} orders ({pct}%)
                    </span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: "6px",
                      background: "var(--color-border-subtle)",
                      borderRadius: "3px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: isPaid
                          ? "var(--color-success, #10b981)"
                          : isRefunded
                          ? "var(--color-warning, #f59e0b)"
                          : "var(--color-border-strong)",
                        borderRadius: "3px",
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Fulfillment Status */}
        <div
          style={{
            background: "var(--color-surface-subtle)",
            padding: "var(--space-4)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
          }}
        >
          <span
            style={{
              fontSize: "var(--font-size-xs)",
              fontWeight: 600,
              color: "var(--color-text-muted)",
              textTransform: "uppercase",
            }}
          >
            Fulfillment Progress
          </span>

          {ordersByFulfillment.length === 0 ? (
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
              No fulfillments in period
            </span>
          ) : (
            ordersByFulfillment.map((item) => {
              const pct = totalOrders > 0 ? Math.round((item.count / totalOrders) * 100) : 0;
              const isFulfilled = item.fulfillmentStatus === "FULFILLED";

              return (
                <div key={item.fulfillmentStatus} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "var(--font-size-xs)",
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{item.fulfillmentStatus}</span>
                    <span style={{ color: "var(--color-text-muted)" }}>
                      {item.count} ({pct}%)
                    </span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: "6px",
                      background: "var(--color-border-subtle)",
                      borderRadius: "3px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: isFulfilled
                          ? "var(--color-success, #10b981)"
                          : "var(--color-border-strong)",
                        borderRadius: "3px",
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
