"use client";

import React from "react";
import Link from "next/link";
import type { CustomerAnalyticsDto } from "@calcart/orders";
import { formatOrderPrice } from "../../../lib/merchant-order-helpers";
import { ArrowRight, Users } from "lucide-react";

interface CustomerAnalyticsCardProps {
  data: CustomerAnalyticsDto;
  currency?: string;
}

export function CustomerAnalyticsCard({
  data,
  currency = "USD",
}: CustomerAnalyticsCardProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 sm:p-5 shadow-xs flex flex-col gap-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground m-0 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-primary" />
            Customer Growth &amp; Retention
          </h3>
          <span className="text-xs text-muted-foreground">
            Buyer acquisition, repeat purchasing, and top customers
          </span>
        </div>

        <Link
          href="/merchant/customers"
          className="btn btn-outline btn-sm h-7 text-xs inline-flex items-center gap-1 font-semibold"
        >
          <span>View All Customers</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Metric Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total Customers
          </div>
          <div className="text-lg font-bold font-mono text-foreground mt-0.5">
            {data.totalCustomers.toLocaleString()}
          </div>
        </div>

        <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            New in Period
          </div>
          <div className="text-lg font-bold font-mono text-primary mt-0.5">
            +{data.newCustomersInPeriod.toLocaleString()}
          </div>
        </div>

        <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Active Buyers
          </div>
          <div className="text-lg font-bold font-mono text-foreground mt-0.5">
            {data.activeCustomersInPeriod.toLocaleString()}
          </div>
        </div>

        <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Repeat Buyers
          </div>
          <div className="text-lg font-bold font-mono text-emerald-500 mt-0.5">
            {data.repeatCustomerCount.toLocaleString()}
          </div>
        </div>

        <div className="bg-muted/30 p-3 rounded-lg border border-border/50 col-span-2 sm:col-span-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Repeat Rate
          </div>
          <div className="text-lg font-bold font-mono text-foreground mt-0.5">
            {data.repeatCustomerRate}%
          </div>
        </div>
      </div>

      {/* Top Spenders Table */}
      {data.topCustomers.length > 0 && (
        <div className="mt-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            Top Spending Customers in Period
          </span>
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40 text-muted-foreground">
                  <th className="py-2 px-3 font-semibold text-[11px] uppercase tracking-wider">Customer</th>
                  <th className="py-2 px-3 font-semibold text-[11px] uppercase tracking-wider text-right">Orders</th>
                  <th className="py-2 px-3 font-semibold text-[11px] uppercase tracking-wider text-right">Total Spent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.topCustomers.map((cust) => {
                  const name = [cust.firstName, cust.lastName].filter(Boolean).join(" ");
                  return (
                    <tr key={cust.customerId} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-foreground">
                          {name || cust.email}
                        </div>
                        {name && (
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {cust.email}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-foreground">
                        {cust.orderCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-primary">
                        {formatOrderPrice(cust.totalSpent, currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
