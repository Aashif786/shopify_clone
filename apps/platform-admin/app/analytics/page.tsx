"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  Download,
  CreditCard,
  Receipt,
  ShoppingBag,
} from "lucide-react";
import { MetricCard } from "@/components/MetricCard";

interface AnalyticsData {
  kpis: {
    totalOrders: number;
    gmvCents: number;
    capturedPaymentVolumeCents: number;
    refundVolumeCents: number;
    netPaymentVolumeCents: number;
    totalStores: number;
    activeStores: number;
  };
  timeSeries: Array<{
    date: string;
    orders: number;
    gmvCents: number;
    capturedPaymentCents: number;
    newStores: number;
  }>;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/platform/dashboard/metrics?days=${days}`)
      .then((res) => res.json())
      .then((json) => {
        if (json?.data) setData(json.data);
      })
      .finally(() => setLoading(false));
  }, [days]);

  const exportCsv = () => {
    if (!data?.timeSeries) return;
    const headers = "Date,Orders,GMV_INR,Captured_INR,New_Stores\n";
    const rows = data.timeSeries
      .map(
        (t) =>
          `${t.date},${t.orders},${(t.gmvCents / 100).toFixed(2)},${(
            t.capturedPaymentCents / 100
          ).toFixed(2)},${t.newStores}`
      )
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `calcart-platform-analytics-${days}d.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading || !data) {
    return (
      <div className="py-12 text-center text-slate-500 font-mono text-xs">
        Compiling Platform Analytics...
      </div>
    );
  }

  const { kpis, timeSeries } = data;
  const aovCents = kpis.totalOrders > 0 ? Math.round(kpis.gmvCents / kpis.totalOrders) : 0;
  const refundRate =
    kpis.capturedPaymentVolumeCents > 0
      ? ((kpis.refundVolumeCents / kpis.capturedPaymentVolumeCents) * 100).toFixed(2)
      : "0.00";

  const formatCurrency = (cents: number) =>
    `₹${(cents / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-emerald-400" />
            Platform Commerce & Business Analytics
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Aggregated cross-tenant commerce intelligence, GMV velocity, order conversion, and financial metrics
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-white/5 border border-white/10">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                  days === d ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          <button
            onClick={exportCsv}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white transition-all text-xs font-medium flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Analytics KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Gross Merchandise Value"
          value={formatCurrency(kpis.gmvCents)}
          subtitle="Processed orders volume"
          icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
        />
        <MetricCard
          title="Average Order Value (AOV)"
          value={formatCurrency(aovCents)}
          subtitle="Basket size across all stores"
          icon={<ShoppingBag className="w-4 h-4 text-blue-400" />}
        />
        <MetricCard
          title="Refund Rate"
          value={`${refundRate}%`}
          subtitle={formatCurrency(kpis.refundVolumeCents) + " refunded"}
          icon={<Receipt className="w-4 h-4 text-purple-400" />}
        />
        <MetricCard
          title="Order Throughput"
          value={kpis.totalOrders.toLocaleString()}
          subtitle="Total completed orders"
          icon={<CreditCard className="w-4 h-4 text-amber-400" />}
        />
      </div>

      {/* Daily Aggregates Detailed Table */}
      <div className="rounded-xl border border-white/10 bg-[#0c111c] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">
            Daily Breakdown ({days} Days)
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {timeSeries.length} recorded daily buckets
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 text-slate-400 font-mono uppercase">
              <tr>
                <th className="pb-3 font-medium">Date (UTC)</th>
                <th className="pb-3 font-medium">Orders Count</th>
                <th className="pb-3 font-medium">GMV Total</th>
                <th className="pb-3 font-medium">Captured Volume</th>
                <th className="pb-3 font-medium">New Stores Launched</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {timeSeries.slice().reverse().map((day) => (
                <tr key={day.date} className="hover:bg-white/5 transition-colors">
                  <td className="py-2.5 text-slate-300">{day.date}</td>
                  <td className="py-2.5 text-white font-bold">{day.orders}</td>
                  <td className="py-2.5 text-emerald-400 font-bold">{formatCurrency(day.gmvCents)}</td>
                  <td className="py-2.5 text-blue-400">{formatCurrency(day.capturedPaymentCents)}</td>
                  <td className="py-2.5 text-slate-400">{day.newStores}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
