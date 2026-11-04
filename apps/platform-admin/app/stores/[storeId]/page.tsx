"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  ArrowLeft,
  ShoppingBag,
  Globe,
  Users,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";

interface StoreDetailData {
  store: {
    id: string;
    organizationId: string;
    organizationName: string;
    name: string;
    slug: string;
    status: string;
    currency: string;
    locale: string;
    timezone: string;
    createdAt: string;
    updatedAt: string;
  };
  domains: Array<{
    id: string;
    domain: string;
    status: string;
    isPrimary: boolean;
    verifiedAt: string | null;
    createdAt: string;
  }>;
  members: Array<{
    userId: string;
    name: string;
    email: string;
    role: string;
    status: string;
    createdAt: string;
  }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    totalAmount: number;
    currency: string;
    status: string;
    paymentStatus: string;
    fulfillmentStatus: string;
    customerEmail: string | null;
    createdAt: string;
  }>;
  metrics: {
    productCount: number;
    orderCount: number;
    gmvCents: number;
    customerCount: number;
    capturedCents: number;
    refundCents: number;
  };
}

export default function StoreDetailPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = params.storeId as string;

  const [data, setData] = useState<StoreDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/platform/stores/${storeId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Store not found");
        return res.json();
      })
      .then((json) => {
        if (json?.data) setData(json.data);
      })
      .catch(() => router.push("/stores"))
      .finally(() => setLoading(false));
  }, [storeId, router]);

  if (loading || !data) {
    return (
      <div className="py-12 text-center text-slate-500 font-mono text-xs">
        Loading Store 360 Profile...
      </div>
    );
  }

  const { store, domains, members, recentOrders, metrics } = data;
  const formatCurrency = (cents: number) =>
    `${store.currency} ${(cents / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/stores"
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-white">{store.name}</h1>
              <StatusBadge status={store.status} />
            </div>
            <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-2">
              <span>Slug: {store.slug}</span>
              <span>•</span>
              <Link
                href={`/tenants/${store.organizationId}`}
                className="hover:text-blue-400 transition-colors flex items-center gap-1"
              >
                <Building2 className="w-3 h-3 text-slate-500" />
                <span>{store.organizationName}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-white/10 bg-[#0c111c]">
          <div className="text-[11px] font-mono uppercase text-slate-400">Total GMV</div>
          <div className="text-lg font-bold text-emerald-400 font-mono mt-1">
            {formatCurrency(metrics.gmvCents)}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-white/10 bg-[#0c111c]">
          <div className="text-[11px] font-mono uppercase text-slate-400">Orders Placed</div>
          <div className="text-lg font-bold text-white font-mono mt-1">
            {metrics.orderCount.toLocaleString()}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-white/10 bg-[#0c111c]">
          <div className="text-[11px] font-mono uppercase text-slate-400">Catalog Products</div>
          <div className="text-lg font-bold text-blue-400 font-mono mt-1">
            {metrics.productCount}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-white/10 bg-[#0c111c]">
          <div className="text-[11px] font-mono uppercase text-slate-400">Customers</div>
          <div className="text-lg font-bold text-indigo-400 font-mono mt-1">
            {metrics.customerCount}
          </div>
        </div>
      </div>

      {/* Store Overview and Domains */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-white/10 bg-[#0c111c] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Store Configuration & Localization</h2>
          <dl className="divide-y divide-white/5 text-xs">
            <div className="py-2.5 flex justify-between">
              <dt className="text-slate-400">Store ID</dt>
              <dd className="font-mono text-slate-300">{store.id}</dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-slate-400">Operating Currency</dt>
              <dd className="font-mono text-white">{store.currency}</dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-slate-400">Locale / Timezone</dt>
              <dd className="font-mono text-slate-300">
                {store.locale} ({store.timezone})
              </dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-slate-400">Created Date</dt>
              <dd className="font-mono text-slate-300">
                {new Date(store.createdAt).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0c111c] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-400" />
            Configured Domains
          </h2>
          {domains.length === 0 ? (
            <div className="text-xs text-slate-500 py-6 text-center">
              No custom domains bound. Using platform subdomain:{" "}
              <span className="font-mono text-blue-400">{store.slug}.calcart.com</span>
            </div>
          ) : (
            <div className="space-y-2">
              {domains.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-[#06090e] border border-white/5 text-xs"
                >
                  <div className="flex items-center gap-2 font-mono text-white">
                    <span>{d.domain}</span>
                    {d.isPrimary && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                        Primary
                      </span>
                    )}
                  </div>
                  <StatusBadge status={d.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Store Members */}
      <div className="rounded-xl border border-white/10 bg-[#0c111c] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-400" />
          Store Staff & Roles
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 text-slate-400 font-mono uppercase">
              <tr>
                <th className="pb-2">User Name</th>
                <th className="pb-2">Email</th>
                <th className="pb-2">Store Role</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {members.map((m) => (
                <tr key={m.userId} className="hover:bg-white/5">
                  <td className="py-2.5 font-medium text-white">{m.name}</td>
                  <td className="py-2.5 font-mono text-slate-300">{m.email}</td>
                  <td className="py-2.5">
                    <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-mono uppercase">
                      {m.role}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="py-2.5 font-mono text-slate-400 text-[11px]">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="rounded-xl border border-white/10 bg-[#0c111c] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-amber-400" />
          Recent Orders
        </h2>
        {recentOrders.length === 0 ? (
          <div className="text-xs text-slate-500 py-6 text-center">No orders processed yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-slate-400 font-mono uppercase">
                <tr>
                  <th className="pb-2">Order #</th>
                  <th className="pb-2">Customer</th>
                  <th className="pb-2">Total Amount</th>
                  <th className="pb-2">Payment Status</th>
                  <th className="pb-2">Order Status</th>
                  <th className="pb-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-white/5">
                    <td className="py-2.5 font-mono text-white font-medium">#{o.orderNumber}</td>
                    <td className="py-2.5 text-slate-300 font-mono">{o.customerEmail || "Guest"}</td>
                    <td className="py-2.5 font-mono text-emerald-400 font-medium">
                      {formatCurrency(o.totalAmount)}
                    </td>
                    <td className="py-2.5">
                      <StatusBadge status={o.paymentStatus} />
                    </td>
                    <td className="py-2.5">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="py-2.5 font-mono text-slate-400 text-[11px]">
                      {new Date(o.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
