"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2,
  Store,
  CreditCard,
  TrendingUp,
  Receipt,
  AlertTriangle,
  ArrowUpRight,
  ShieldAlert,
  Activity,
  Layers,
  ShoppingBag,
} from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";

interface DashboardData {
  kpis: {
    totalOrganizations: number;
    totalStores: number;
    activeStores: number;
    suspendedStores: number;
    draftStores: number;
    totalMerchants: number;
    totalCustomers: number;
    totalProducts: number;
    totalOrders: number;
    totalTransactions: number;
    capturedPaymentVolumeCents: number;
    refundVolumeCents: number;
    netPaymentVolumeCents: number;
    gmvCents: number;
    platformSubscriptionRevenueCents: number;
    activeSubscriptions: number;
    trialSubscriptions: number;
    cancelledSubscriptions: number;
    failedPaymentsCount: number;
    orphanedCapturedPaymentsCount: number;
    stuckRefundsCount: number;
    pendingWebhooksCount: number;
    outboxBacklogCount: number;
  };
  timeSeries: Array<{
    date: string;
    orders: number;
    gmvCents: number;
    capturedPaymentCents: number;
    newStores: number;
  }>;
  healthSummary: {
    workerStatus: "HEALTHY" | "DEGRADED" | "ATTENTION";
    paymentPipelineStatus: "HEALTHY" | "WARNING" | "CRITICAL";
    databaseStatus: "CONNECTED" | "UNAVAILABLE";
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetch(`/api/platform/dashboard/metrics?days=${days}`)
      .then((res) => res.json())
      .then((json) => {
        if (json?.data) setData(json.data);
      })
      .finally(() => setLoading(false));
  }, [days]);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-white/5 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-32 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const { kpis, healthSummary } = data;
  const formatCurrency = (cents: number) => {
    return `₹${(cents / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const hasCriticalIncidents =
    kpis.orphanedCapturedPaymentsCount > 0 || kpis.stuckRefundsCount > 0;

  return (
    <div className="space-y-8">
      {/* Top Banner / Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Command Center Overview
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time ecosystem scale, financial volume, tenant health, and operational pipeline
          </p>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-white/5 border border-white/10 self-start sm:self-auto">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                days === d
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Last {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Critical Operational Warning Banner */}
      {hasCriticalIncidents && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/20 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-rose-200">
                Action Required: Payment Pipeline Exceptions Detected
              </div>
              <div className="text-xs text-rose-300/80 mt-0.5">
                {kpis.orphanedCapturedPaymentsCount > 0 &&
                  `${kpis.orphanedCapturedPaymentsCount} captured payment(s) missing order records. `}
                {kpis.stuckRefundsCount > 0 &&
                  `${kpis.stuckRefundsCount} refund(s) stuck in processing.`}
              </div>
            </div>
          </div>
          <Link
            href="/payments?orphaned=true"
            className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors"
          >
            Investigate Payments
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Primary Financial & Platform KPIs */}
      <div>
        <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">
          Platform Financial Intelligence
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Gross Merchandise Value (GMV)"
            value={formatCurrency(kpis.gmvCents)}
            subtitle="Total value of processed orders across all stores"
            icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
          />
          <MetricCard
            title="Captured Payment Volume"
            value={formatCurrency(kpis.capturedPaymentVolumeCents)}
            subtitle="Verified captured Razorpay payments"
            icon={<CreditCard className="w-4 h-4 text-blue-400" />}
          />
          <MetricCard
            title="Net Payment Volume"
            value={formatCurrency(kpis.netPaymentVolumeCents)}
            subtitle={`Captured minus ${formatCurrency(kpis.refundVolumeCents)} refunds`}
            icon={<Receipt className="w-4 h-4 text-purple-400" />}
          />
          <MetricCard
            title="SaaS Subscription Revenue"
            value={formatCurrency(kpis.platformSubscriptionRevenueCents)}
            subtitle={`${kpis.activeSubscriptions} active tenant plan(s)`}
            icon={<Layers className="w-4 h-4 text-sky-400" />}
          />
        </div>
      </div>

      {/* Ecosystem Scale & Health */}
      <div>
        <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">
          Tenancy & Platform Scale
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Organizations"
            value={kpis.totalOrganizations}
            subtitle="Platform tenant accounts"
            icon={<Building2 className="w-4 h-4 text-slate-400" />}
          />
          <MetricCard
            title="Total Stores"
            value={kpis.totalStores}
            subtitle={`${kpis.activeStores} active • ${kpis.suspendedStores} suspended • ${kpis.draftStores} draft`}
            icon={<Store className="w-4 h-4 text-slate-400" />}
          />
          <MetricCard
            title="Merchants & Staff"
            value={kpis.totalMerchants}
            subtitle="Registered merchant operators"
            icon={<ShoppingBag className="w-4 h-4 text-slate-400" />}
          />
          <MetricCard
            title="Total Customers"
            value={kpis.totalCustomers}
            subtitle="Storefront buyer accounts"
            icon={<Activity className="w-4 h-4 text-slate-400" />}
          />
        </div>
      </div>

      {/* Pipeline & Operational Metrics */}
      <div>
        <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">
          Operations, Background Queues & Security
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Payment Pipeline"
            value={healthSummary.paymentPipelineStatus}
            badge={<StatusBadge status={healthSummary.paymentPipelineStatus} pulse />}
            subtitle={`${kpis.failedPaymentsCount} failed payment attempts`}
            alertVariant={
              healthSummary.paymentPipelineStatus === "CRITICAL"
                ? "critical"
                : healthSummary.paymentPipelineStatus === "WARNING"
                ? "warning"
                : "normal"
            }
          />
          <MetricCard
            title="Background Workers"
            value={healthSummary.workerStatus}
            badge={<StatusBadge status={healthSummary.workerStatus} />}
            subtitle={`${kpis.outboxBacklogCount} email outbox backlog`}
          />
          <MetricCard
            title="Webhook Delivery"
            value={kpis.pendingWebhooksCount}
            subtitle="Webhooks pending or in retry"
            icon={<Activity className="w-4 h-4 text-amber-400" />}
          />
          <MetricCard
            title="Security Center"
            value="Guarded"
            subtitle="Audit logs & session monitoring active"
            icon={<ShieldAlert className="w-4 h-4 text-emerald-400" />}
          />
        </div>
      </div>

      {/* Trend Preview Table */}
      <div className="rounded-xl border border-white/10 bg-[#0c111c] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Daily Commerce & Order Velocity</h2>
            <p className="text-xs text-slate-400 mt-0.5">Aggregated metrics over the selected period</p>
          </div>
          <Link
            href="/analytics"
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
          >
            Full Analytics Center
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 text-slate-400 font-mono uppercase">
              <tr>
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">Orders Count</th>
                <th className="pb-3 font-medium">GMV Total</th>
                <th className="pb-3 font-medium">Captured Payments</th>
                <th className="pb-3 font-medium">New Stores Provisioned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.timeSeries.slice(-7).reverse().map((day) => (
                <tr key={day.date} className="hover:bg-white/5 transition-colors">
                  <td className="py-2.5 font-mono text-slate-300">{day.date}</td>
                  <td className="py-2.5 font-mono text-white">{day.orders}</td>
                  <td className="py-2.5 font-mono text-emerald-400">{formatCurrency(day.gmvCents)}</td>
                  <td className="py-2.5 font-mono text-blue-400">{formatCurrency(day.capturedPaymentCents)}</td>
                  <td className="py-2.5 font-mono text-slate-400">{day.newStores}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
