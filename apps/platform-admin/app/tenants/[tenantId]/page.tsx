"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Store,
  Users,
  CreditCard,
  Activity,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Ban,
  RotateCcw,
  ShieldAlert,
  Layers,
  ShoppingBag,
  Receipt,
  Globe,
  FileText,
  Sliders,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { ReasonModal } from "@/components/ReasonModal";

interface Tenant360Data {
  overview: {
    id: string;
    name: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  subscription: {
    planId: string;
    planName: string;
    planCode: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    maxStores: number;
    maxProductsPerStore: number;
  } | null;
  stores: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    currency: string;
    createdAt: string;
    productCount: number;
    orderCount: number;
    primaryDomain: string | null;
  }>;
  members: Array<{
    userId: string;
    name: string;
    email: string;
    orgRole: string;
    orgStatus: string;
    createdAt: string;
  }>;
  metrics: {
    totalProducts: number;
    totalOrders: number;
    gmvCents: number;
    capturedPaymentCents: number;
    refundCents: number;
    customerCount: number;
  };
  operationalHealth: {
    orphanedPayments: number;
    failedWebhooks: number;
    pendingNotifications: number;
  };
  activityHistory: Array<{
    id: string;
    action: string;
    actorId: string;
    actorRole: string;
    reason: string;
    status: string;
    createdAt: string;
  }>;
  securityEvents: Array<{
    id: string;
    eventType: string;
    severity: string;
    userId: string | null;
    createdAt: string;
  }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    storeName: string;
    totalAmount: number;
    currency: string;
    status: string;
    createdAt: string;
  }>;
  recentPayments: Array<{
    id: string;
    storeName: string;
    amount: number;
    currency: string;
    status: string;
    provider: string;
    createdAt: string;
  }>;
  domains: Array<{
    id: string;
    storeName: string;
    domain: string;
    status: string;
    isPrimary: boolean;
    verifiedAt: string | null;
  }>;
}

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.tenantId as string;

  const [data, setData] = useState<Tenant360Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<"ACTIVE" | "SUSPENDED" | "ARCHIVED">("SUSPENDED");

  const fetchTenant = () => {
    setLoading(true);
    fetch(`/api/platform/tenants/${tenantId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Tenant not found");
        return res.json();
      })
      .then((json) => {
        if (json?.data) setData(json.data);
      })
      .catch(() => router.push("/tenants"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTenant();
  }, [tenantId]);

  const handleStatusUpdate = async (reason: string) => {
    const res = await fetch(`/api/platform/tenants/${tenantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: targetStatus, reason }),
    });

    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error?.message || "Failed to update tenant status");
    }

    fetchTenant();
  };

  const handlePlanChange = async (planCode: string) => {
    const reason = prompt("Enter administrative reason for subscription plan adjustment:");
    if (!reason || reason.trim().length < 5) {
      alert("Plan update cancelled: a reason of at least 5 characters is required.");
      return;
    }

    const res = await fetch(`/api/platform/tenants/${tenantId}/subscription`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planCode, reason: reason.trim() }),
    });

    if (res.ok) {
      fetchTenant();
    } else {
      const json = await res.json();
      alert(`Error updating plan: ${json.error?.message || "Failed"}`);
    }
  };

  if (loading || !data) {
    return (
      <div className="py-12 text-center text-slate-500 font-mono text-xs">
        Loading Tenant 360 Profile...
      </div>
    );
  }

  const {
    overview,
    subscription,
    stores,
    members,
    metrics,
    operationalHealth,
    activityHistory = [],
    securityEvents = [],
    recentOrders = [],
    recentPayments = [],
    domains = [],
  } = data;

  const owners = members.filter((m) => m.orgRole === "owner");
  const teamMembers = members.filter((m) => m.orgRole !== "owner");

  const formatCurrency = (cents: number) =>
    `₹${(cents / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const tabs = [
    { id: "overview", label: "1. Overview", icon: Building2 },
    { id: "organizations", label: "2. Organizations", icon: Layers },
    { id: "stores", label: `3. Stores (${stores.length})`, icon: Store },
    { id: "owners", label: `4. Owners & Merchants (${owners.length})`, icon: Users },
    { id: "team", label: `5. Team Members (${teamMembers.length})`, icon: Users },
    { id: "products", label: "6. Products & Inventory", icon: ShoppingBag },
    { id: "orders", label: `7. Orders & Customers (${metrics.totalOrders})`, icon: ShoppingBag },
    { id: "payments", label: "8. Payments & Refunds", icon: CreditCard },
    { id: "subscription", label: "9. Subscription & Billing", icon: Receipt },
    { id: "limits", label: "10. Usage & Limits", icon: Sliders },
    { id: "domains", label: `11. Domains & Integrations (${domains.length})`, icon: Globe },
    { id: "activity", label: `12. Activity History (${activityHistory.length})`, icon: FileText },
    { id: "security", label: `13. Security (${securityEvents.length})`, icon: ShieldAlert },
    { id: "health", label: "14. Operational Health", icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <ReasonModal
        isOpen={statusModalOpen}
        title={targetStatus === "SUSPENDED" ? "Suspend Tenant Organization" : "Reactivate Tenant"}
        description={
          targetStatus === "SUSPENDED"
            ? "Suspending this tenant will immediately cascade suspension to all associated stores and prevent customer storefront transactions."
            : "Reactivating this tenant will restore associated stores to ACTIVE status."
        }
        isDestructive={targetStatus === "SUSPENDED"}
        actionLabel={targetStatus === "SUSPENDED" ? "Confirm Suspension" : "Reactivate Tenant"}
        onConfirm={handleStatusUpdate}
        onClose={() => setStatusModalOpen(false)}
      />

      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/tenants"
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-white">{overview.name}</h1>
              <StatusBadge status={overview.status} pulse={overview.status === "ACTIVE"} />
            </div>
            <div className="text-xs text-slate-400 font-mono mt-0.5">Tenant ID: {overview.id}</div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {overview.status === "ACTIVE" ? (
            <button
              onClick={() => {
                setTargetStatus("SUSPENDED");
                setStatusModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-rose-600/20 border border-rose-500/30 text-rose-300 hover:bg-rose-600 hover:text-white transition-all text-xs font-medium flex items-center gap-1.5"
            >
              <Ban className="w-3.5 h-3.5" />
              Suspend Tenant
            </button>
          ) : (
            <button
              onClick={() => {
                setTargetStatus("ACTIVE");
                setStatusModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600 hover:text-white transition-all text-xs font-medium flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reactivate Tenant
            </button>
          )}
        </div>
      </div>

      {/* Vitals Quick Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-white/10 bg-[#0c111c]">
          <div className="text-[11px] font-mono uppercase text-slate-400">Total GMV</div>
          <div className="text-lg font-bold text-emerald-400 font-mono mt-1">
            {formatCurrency(metrics.gmvCents)}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-white/10 bg-[#0c111c]">
          <div className="text-[11px] font-mono uppercase text-slate-400">Orders Processed</div>
          <div className="text-lg font-bold text-white font-mono mt-1">
            {metrics.totalOrders.toLocaleString()}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-white/10 bg-[#0c111c]">
          <div className="text-[11px] font-mono uppercase text-slate-400">Stores / Quota</div>
          <div className="text-lg font-bold text-blue-400 font-mono mt-1">
            {stores.length} / {subscription?.maxStores ?? 1}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-white/10 bg-[#0c111c]">
          <div className="text-[11px] font-mono uppercase text-slate-400">Plan Tier</div>
          <div className="text-lg font-bold text-indigo-400 font-mono mt-1">
            {subscription?.planName || "Starter"}
          </div>
        </div>
      </div>

      {/* 14 Navigation Tabs */}
      <div className="flex border-b border-white/10 space-x-1 overflow-x-auto pb-1 scrollbar-thin">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-3 text-xs font-medium transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? "border-blue-500 text-white font-semibold bg-white/5 rounded-t"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-white/10 bg-[#0c111c] p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Tenant Organization Vitals</h3>
            <dl className="divide-y divide-white/5 text-xs">
              <div className="py-2.5 flex justify-between">
                <dt className="text-slate-400">Organization Name</dt>
                <dd className="font-medium text-white">{overview.name}</dd>
              </div>
              <div className="py-2.5 flex justify-between">
                <dt className="text-slate-400">Registration Date</dt>
                <dd className="font-mono text-slate-300">
                  {new Date(overview.createdAt).toLocaleString()}
                </dd>
              </div>
              <div className="py-2.5 flex justify-between">
                <dt className="text-slate-400">Account Status</dt>
                <dd>
                  <StatusBadge status={overview.status} />
                </dd>
              </div>
              <div className="py-2.5 flex justify-between">
                <dt className="text-slate-400">Active Stores Count</dt>
                <dd className="font-mono text-white">{stores.length}</dd>
              </div>
              <div className="py-2.5 flex justify-between">
                <dt className="text-slate-400">Customer Accounts</dt>
                <dd className="font-mono text-white">{metrics.customerCount}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0c111c] p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Operational & Pipeline Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#06090e] border border-white/5">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <CreditCard className="w-4 h-4 text-slate-400" />
                  <span>Orphaned Captured Payments</span>
                </div>
                <span
                  className={`text-xs font-mono font-bold ${
                    operationalHealth.orphanedPayments > 0 ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {operationalHealth.orphanedPayments}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-[#06090e] border border-white/5">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Activity className="w-4 h-4 text-slate-400" />
                  <span>Failed Webhook Events</span>
                </div>
                <span
                  className={`text-xs font-mono font-bold ${
                    operationalHealth.failedWebhooks > 0 ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {operationalHealth.failedWebhooks}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-[#06090e] border border-white/5">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span>Notification Outbox Backlog</span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-300">
                  {operationalHealth.pendingNotifications}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Organizations */}
      {activeTab === "organizations" && (
        <div className="rounded-xl border border-white/10 bg-[#0c111c] p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white">Organization Hierarchy & Tenant Isolation</h3>
          <p className="text-xs text-slate-400">
            Tenant boundaries enforce database scoping: all stores, catalogs, inventory items, orders, and customer records belong exclusively to this organization context.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-lg bg-[#06090e] border border-white/5">
              <div className="text-[11px] text-slate-400">Organization ID</div>
              <div className="font-mono text-xs text-white mt-1 select-all">{overview.id}</div>
            </div>
            <div className="p-4 rounded-lg bg-[#06090e] border border-white/5">
              <div className="text-[11px] text-slate-400">Isolation Layer</div>
              <div className="font-mono text-xs text-emerald-400 mt-1">Multi-Tenant Scoped</div>
            </div>
            <div className="p-4 rounded-lg bg-[#06090e] border border-white/5">
              <div className="text-[11px] text-slate-400">Registered At</div>
              <div className="font-mono text-xs text-slate-300 mt-1">{new Date(overview.createdAt).toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Stores */}
      {activeTab === "stores" && (
        <div className="rounded-xl border border-white/10 bg-[#0c111c] overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-white/5 text-slate-400 font-mono uppercase">
              <tr>
                <th className="py-3 px-4 font-medium">Store Name & Slug</th>
                <th className="py-3 px-4 font-medium">Primary Domain</th>
                <th className="py-3 px-4 font-medium">Products</th>
                <th className="py-3 px-4 font-medium">Orders</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Created</th>
                <th className="py-3 px-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {stores.map((s) => (
                <tr key={s.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4 font-medium text-white">
                    <div>{s.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{s.slug}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-300 font-mono">
                    {s.primaryDomain ? (
                      <span className="flex items-center gap-1 text-blue-400">
                        {s.primaryDomain}
                        <ExternalLink className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-300">{s.productCount}</td>
                  <td className="py-3 px-4 font-mono text-slate-300">{s.orderCount}</td>
                  <td className="py-3 px-4">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      href={`/stores/${s.id}`}
                      className="px-2 py-1 rounded bg-white/5 hover:bg-blue-600 text-slate-300 hover:text-white transition-colors"
                    >
                      Store Detail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: Owners and merchants */}
      {activeTab === "owners" && (
        <div className="rounded-xl border border-white/10 bg-[#0c111c] overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-white/5 text-slate-400 font-mono uppercase">
              <tr>
                <th className="py-3 px-4 font-medium">Owner Name</th>
                <th className="py-3 px-4 font-medium">Email</th>
                <th className="py-3 px-4 font-medium">Role</th>
                <th className="py-3 px-4 font-medium">Account Status</th>
                <th className="py-3 px-4 font-medium">Joined Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {owners.map((m) => (
                <tr key={m.userId} className="hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4 font-medium text-white">{m.name}</td>
                  <td className="py-3 px-4 font-mono text-slate-300">{m.email}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono uppercase font-bold">
                      ORGANIZATION OWNER
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={m.orgStatus} />
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 5: Team members */}
      {activeTab === "team" && (
        <div className="rounded-xl border border-white/10 bg-[#0c111c] overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-white/5 text-slate-400 font-mono uppercase">
              <tr>
                <th className="py-3 px-4 font-medium">Name</th>
                <th className="py-3 px-4 font-medium">Email</th>
                <th className="py-3 px-4 font-medium">Role</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Joined Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {teamMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No additional staff members enrolled beyond the primary owner.
                  </td>
                </tr>
              ) : (
                teamMembers.map((m) => (
                  <tr key={m.userId} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-medium text-white">{m.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">{m.email}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-mono uppercase">
                        {m.orgRole}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={m.orgStatus} />
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 6: Products and inventory */}
      {activeTab === "products" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-white/10 bg-[#0c111c]">
              <div className="text-xs text-slate-400">Total Products</div>
              <div className="text-2xl font-bold font-mono text-white mt-1">{metrics.totalProducts}</div>
              <div className="text-[11px] text-slate-500 mt-1">Across all {stores.length} store(s)</div>
            </div>
            <div className="p-4 rounded-xl border border-white/10 bg-[#0c111c]">
              <div className="text-xs text-slate-400">Products Quota</div>
              <div className="text-2xl font-bold font-mono text-blue-400 mt-1">
                {subscription?.maxProductsPerStore ?? 250} / store
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Plan limit tier enforcement</div>
            </div>
            <div className="p-4 rounded-xl border border-white/10 bg-[#0c111c]">
              <div className="text-xs text-slate-400">Catalog Density</div>
              <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                {stores.length > 0 ? Math.round(metrics.totalProducts / stores.length) : 0} avg / store
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Active inventory distribution</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: Orders and customers */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-white/10 bg-[#0c111c]">
              <div className="text-xs text-slate-400">Total Orders Placed</div>
              <div className="text-2xl font-bold font-mono text-white mt-1">{metrics.totalOrders}</div>
            </div>
            <div className="p-4 rounded-xl border border-white/10 bg-[#0c111c]">
              <div className="text-xs text-slate-400">Registered Storefront Customers</div>
              <div className="text-2xl font-bold font-mono text-blue-400 mt-1">{metrics.customerCount}</div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0c111c] overflow-hidden">
            <div className="p-3 border-b border-white/10 bg-white/5 font-mono text-xs font-semibold text-slate-300">
              Recent Tenant Orders
            </div>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-slate-400 font-mono uppercase">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Order #</th>
                  <th className="py-2.5 px-4 font-medium">Store</th>
                  <th className="py-2.5 px-4 font-medium">Amount</th>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                  <th className="py-2.5 px-4 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      No orders placed for this tenant yet.
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-medium text-white">{o.orderNumber}</td>
                      <td className="py-2.5 px-4 text-slate-300">{o.storeName}</td>
                      <td className="py-2.5 px-4 font-mono text-emerald-400">{formatCurrency(o.totalAmount)}</td>
                      <td className="py-2.5 px-4"><StatusBadge status={o.status} /></td>
                      <td className="py-2.5 px-4 font-mono text-slate-400">{new Date(o.createdAt).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 8: Payments and refunds */}
      {activeTab === "payments" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-white/10 bg-[#0c111c]">
              <div className="text-xs text-slate-400">Captured Payment Volume</div>
              <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                {formatCurrency(metrics.capturedPaymentCents)}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-white/10 bg-[#0c111c]">
              <div className="text-xs text-slate-400">Total Refunded Volume</div>
              <div className="text-2xl font-bold font-mono text-rose-400 mt-1">
                {formatCurrency(metrics.refundCents)}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-white/10 bg-[#0c111c]">
              <div className="text-xs text-slate-400">Net Merchant Processed</div>
              <div className="text-2xl font-bold font-mono text-white mt-1">
                {formatCurrency(Math.max(0, metrics.capturedPaymentCents - metrics.refundCents))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0c111c] overflow-hidden">
            <div className="p-3 border-b border-white/10 bg-white/5 font-mono text-xs font-semibold text-slate-300">
              Recent Transactions
            </div>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-slate-400 font-mono uppercase">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Payment ID</th>
                  <th className="py-2.5 px-4 font-medium">Store</th>
                  <th className="py-2.5 px-4 font-medium">Amount</th>
                  <th className="py-2.5 px-4 font-medium">Provider</th>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                  <th className="py-2.5 px-4 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentPayments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      No payment transactions recorded for this tenant yet.
                    </td>
                  </tr>
                ) : (
                  recentPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-medium text-white">{p.id}</td>
                      <td className="py-2.5 px-4 text-slate-300">{p.storeName}</td>
                      <td className="py-2.5 px-4 font-mono text-emerald-400">{formatCurrency(p.amount)}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-400 uppercase">{p.provider}</td>
                      <td className="py-2.5 px-4"><StatusBadge status={p.status} /></td>
                      <td className="py-2.5 px-4 font-mono text-slate-400">{new Date(p.createdAt).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 9: Subscription and billing */}
      {activeTab === "subscription" && (
        <div className="rounded-xl border border-white/10 bg-[#0c111c] p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">SaaS Plan & Platform Limits</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Current tenant subscription tier, quota enforcement, and renewal terms
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePlanChange("starter")}
                className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-xs text-slate-300 font-mono"
              >
                Set Starter
              </button>
              <button
                onClick={() => handlePlanChange("growth")}
                className="px-2.5 py-1 rounded bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600 hover:text-white text-xs font-mono"
              >
                Set Growth
              </button>
              <button
                onClick={() => handlePlanChange("enterprise")}
                className="px-2.5 py-1 rounded bg-purple-600/20 border border-purple-500/30 text-purple-400 hover:bg-purple-600 hover:text-white text-xs font-mono"
              >
                Set Enterprise
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-[#06090e] border border-white/5">
              <div className="text-xs text-slate-400">Current Plan</div>
              <div className="text-base font-bold text-white mt-1">
                {subscription?.planName || "Starter Plan"}
              </div>
              <div className="text-xs text-blue-400 font-mono mt-0.5">
                Status: {subscription?.status || "ACTIVE"}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-[#06090e] border border-white/5">
              <div className="text-xs text-slate-400">Store Limit Quota</div>
              <div className="text-base font-bold text-white mt-1">
                {stores.length} / {subscription?.maxStores ?? 1} Stores
              </div>
            </div>
            <div className="p-4 rounded-lg bg-[#06090e] border border-white/5">
              <div className="text-xs text-slate-400">Max Products Per Store</div>
              <div className="text-base font-bold text-white mt-1">
                {subscription?.maxProductsPerStore ?? 250} Products
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 10: Usage and limits */}
      {activeTab === "limits" && (
        <div className="rounded-xl border border-white/10 bg-[#0c111c] p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white">Resource Quota Utilization</h3>
          <div className="space-y-4 pt-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Store Quota</span>
                <span className="font-mono text-white">{stores.length} / {subscription?.maxStores ?? 1} stores</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${Math.min(100, (stores.length / (subscription?.maxStores || 1)) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Product Catalog Quota</span>
                <span className="font-mono text-white">{metrics.totalProducts} products</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${Math.min(100, (metrics.totalProducts / ((subscription?.maxProductsPerStore || 250) * Math.max(1, stores.length))) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 11: Domains and integrations */}
      {activeTab === "domains" && (
        <div className="rounded-xl border border-white/10 bg-[#0c111c] overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-white/5 text-slate-400 font-mono uppercase">
              <tr>
                <th className="py-3 px-4 font-medium">Domain</th>
                <th className="py-3 px-4 font-medium">Associated Store</th>
                <th className="py-3 px-4 font-medium">Primary Status</th>
                <th className="py-3 px-4 font-medium">DNS & Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {domains.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    No custom domains connected to this tenant yet.
                  </td>
                </tr>
              ) : (
                domains.map((d) => (
                  <tr key={d.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-blue-400">{d.domain}</td>
                    <td className="py-3 px-4 text-white">{d.storeName}</td>
                    <td className="py-3 px-4">
                      {d.isPrimary ? (
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-mono">PRIMARY</span>
                      ) : (
                        <span className="text-slate-500 text-[10px] font-mono">SECONDARY</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={d.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 12: Activity history */}
      {activeTab === "activity" && (
        <div className="rounded-xl border border-white/10 bg-[#0c111c] overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-white/5 text-slate-400 font-mono uppercase">
              <tr>
                <th className="py-3 px-4 font-medium">Action</th>
                <th className="py-3 px-4 font-medium">Admin Role</th>
                <th className="py-3 px-4 font-medium">Reason & Justification</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {activityHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No administrative audit events recorded for this tenant yet.
                  </td>
                </tr>
              ) : (
                activityHistory.map((a) => (
                  <tr key={a.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-white">{a.action}</td>
                    <td className="py-3 px-4 font-mono text-purple-400 uppercase text-[11px]">{a.actorRole}</td>
                    <td className="py-3 px-4 text-slate-300 max-w-xs truncate">{a.reason}</td>
                    <td className="py-3 px-4"><StatusBadge status={a.status} /></td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{new Date(a.createdAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 13: Security */}
      {activeTab === "security" && (
        <div className="rounded-xl border border-white/10 bg-[#0c111c] overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-white/5 text-slate-400 font-mono uppercase">
              <tr>
                <th className="py-3 px-4 font-medium">Security Event</th>
                <th className="py-3 px-4 font-medium">Severity</th>
                <th className="py-3 px-4 font-medium">User Target</th>
                <th className="py-3 px-4 font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {securityEvents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    No security anomalies or lockout incidents recorded.
                  </td>
                </tr>
              ) : (
                securityEvents.map((se) => (
                  <tr key={se.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-mono text-white">{se.eventType}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                        se.severity === "CRITICAL" || se.severity === "HIGH" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" : "bg-white/5 text-slate-300"
                      }`}>
                        {se.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{se.userId || "System"}</td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{new Date(se.createdAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 14: Operational health */}
      {activeTab === "health" && (
        <div className="rounded-xl border border-white/10 bg-[#0c111c] p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white">Tenant Anomaly Detection & Telemetry</h3>
          {operationalHealth.orphanedPayments === 0 && operationalHealth.failedWebhooks === 0 ? (
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>No critical payment or webhook exceptions detected for this tenant.</span>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>
                Attention required: {operationalHealth.orphanedPayments} orphaned payments,{" "}
                {operationalHealth.failedWebhooks} failed webhooks.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
