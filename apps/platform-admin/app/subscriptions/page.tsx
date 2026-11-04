"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Receipt, Layers, TrendingUp, Check, AlertCircle, Building2 } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";

interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  description: string;
  monthlyPriceCents: number;
  currency: string;
  maxStores: number;
  maxProductsPerStore: number;
  transactionFeeBasisPoints: number;
  features: string[];
  status: string;
}

export default function SubscriptionsPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [mrrCents, setMrrCents] = useState(0);
  const [activeSubs, setActiveSubs] = useState(0);
  const [subscribersByPlan, setSubscribersByPlan] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/platform/subscriptions")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load subscription data");
        return res.json();
      })
      .then((json) => {
        if (json?.data) {
          setPlans(json.data.plans || []);
          setMrrCents(json.data.mrrCents || 0);
          setActiveSubs(json.data.activeSubscriptions || 0);
          setSubscribersByPlan(json.data.subscribersByPlan || {});
        }
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  const formatCurrency = (cents: number, curr = "INR") => {
    return `${curr} ${(cents / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
    })}`;
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-500 font-mono text-xs">
        Loading SaaS Subscription Architecture...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <Receipt className="w-6 h-6 text-purple-400" />
          Subscriptions & Platform Billing
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          SaaS subscription plans, recurring platform revenue (MRR/ARR), and quota management
        </p>
      </div>

      {/* Accounting Distinction Alert */}
      <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-950/20 text-xs text-blue-300 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-white">Revenue Recognition Boundary:</span> Merchant Gross Merchandise Value (GMV) represents customer checkout volume processed by tenant stores. Only SaaS subscription invoices and platform take rates represent Cal Cart platform software revenue.
        </div>
      </div>

      {/* Subscription Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Monthly Recurring Revenue (MRR)"
          value={formatCurrency(mrrCents)}
          subtitle="Annualized run rate (ARR): "
          icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
        />
        <MetricCard
          title="Active Subscriptions"
          value={activeSubs}
          subtitle="Paid tenant organizations"
          icon={<Layers className="w-4 h-4 text-purple-400" />}
        />
        <MetricCard
          title="Platform Take Rate"
          value="0.75% - 2.0%"
          subtitle="Basis points by plan tier"
          icon={<Receipt className="w-4 h-4 text-sky-400" />}
        />
        <MetricCard
          title="Plan Tiers"
          value={plans.length}
          subtitle="Standard public tiers"
          icon={<Building2 className="w-4 h-4 text-slate-400" />}
        />
      </div>

      {/* Plans Tier Grid */}
      <div>
        <h2 className="text-sm font-mono uppercase tracking-wider text-slate-400 mb-3">
          SaaS Subscription Plan Tiers
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="p-6 rounded-2xl border border-white/10 bg-[#0c111c] hover:border-white/20 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  <StatusBadge status={plan.status} />
                </div>
                <div className="text-[11px] font-mono text-purple-400 mb-2">
                  {subscribersByPlan[plan.code] || 0} active tenant{subscribersByPlan[plan.code] === 1 ? "" : "s"}
                </div>
                <p className="text-xs text-slate-400 mb-4">{plan.description}</p>
                <div className="flex items-baseline gap-1 text-2xl font-bold font-mono text-white mb-6">
                  {formatCurrency(plan.monthlyPriceCents, plan.currency)}
                  <span className="text-xs text-slate-400 font-sans font-normal">/ month</span>
                </div>

                <div className="space-y-2 mb-6 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Max {plan.maxStores} Storefront(s)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Up to {plan.maxProductsPerStore.toLocaleString()} Products/store</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{(plan.transactionFeeBasisPoints / 100).toFixed(2)}% Transaction fee</span>
                  </div>
                  {plan.features.map((feat) => (
                    <div key={feat} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                <Link
                  href={`/tenants?plan=${plan.code}`}
                  className="w-full block py-2 rounded-lg bg-white/5 hover:bg-white/10 text-center text-xs font-medium text-slate-300 transition-colors"
                >
                  View Subscribed Tenants
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
