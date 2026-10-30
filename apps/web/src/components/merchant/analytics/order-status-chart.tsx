"use client";

import React from "react";
import type {
  FulfillmentStatusDistributionItem,
  OrderStatusDistributionItem,
  PaymentStatusDistributionItem,
} from "@calcart/orders";
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
    <div className="rounded-xl border border-border/60 bg-card p-4 sm:p-5 shadow-xs flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground m-0">
          Order &amp; Payment Status Breakdown
        </h3>
        <span className="text-xs text-muted-foreground">
          Distribution across {totalOrders} total orders placed in period
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Order Lifecycle Status */}
        <div className="bg-muted/30 p-3.5 rounded-lg border border-border/50 flex flex-col gap-3">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Order Lifecycle
          </span>

          {ordersByStatus.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              No orders in period
            </span>
          ) : (
            <div className="space-y-2.5">
              {ordersByStatus.map((item) => {
                const pct = totalOrders > 0 ? Math.round((item.count / totalOrders) * 100) : 0;
                const isCancelled = item.status === "CANCELLED";
                const isCompleted = item.status === "COMPLETED" || item.status === "DELIVERED";

                return (
                  <div key={item.status} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-foreground">{item.status}</span>
                      <span className="text-muted-foreground font-mono text-[11px]">
                        {item.count} ({pct}%) • {formatOrderPrice(item.totalAmount, currency)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full rounded-full transition-all ${
                          isCancelled
                            ? "bg-destructive"
                            : isCompleted
                            ? "bg-emerald-500"
                            : "bg-primary"
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Payment Status */}
        <div className="bg-muted/30 p-3.5 rounded-lg border border-border/50 flex flex-col gap-3">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Payment Settlement
          </span>

          {ordersByPayment.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              No payments recorded
            </span>
          ) : (
            <div className="space-y-2.5">
              {ordersByPayment.map((item) => {
                const pct = totalOrders > 0 ? Math.round((item.count / totalOrders) * 100) : 0;
                const isPaid = item.paymentStatus === "PAID";
                const isRefunded =
                  item.paymentStatus === "REFUNDED" ||
                  item.paymentStatus === "PARTIALLY_REFUNDED";

                return (
                  <div key={item.paymentStatus} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-foreground">{item.paymentStatus}</span>
                      <span className="text-muted-foreground font-mono text-[11px]">
                        {item.count} orders ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full rounded-full transition-all ${
                          isPaid
                            ? "bg-emerald-500"
                            : isRefunded
                            ? "bg-amber-500"
                            : "bg-muted-foreground/40"
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Fulfillment Status */}
        <div className="bg-muted/30 p-3.5 rounded-lg border border-border/50 flex flex-col gap-3">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Fulfillment Progress
          </span>

          {ordersByFulfillment.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              No fulfillments in period
            </span>
          ) : (
            <div className="space-y-2.5">
              {ordersByFulfillment.map((item) => {
                const pct = totalOrders > 0 ? Math.round((item.count / totalOrders) * 100) : 0;
                const isFulfilled = item.fulfillmentStatus === "FULFILLED";

                return (
                  <div key={item.fulfillmentStatus} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-foreground">{item.fulfillmentStatus}</span>
                      <span className="text-muted-foreground font-mono text-[11px]">
                        {item.count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full rounded-full transition-all ${
                          isFulfilled
                            ? "bg-emerald-500"
                            : "bg-primary/80"
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
