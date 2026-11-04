"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Building2, Store, ArrowRight } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";

interface TenantItem {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  storeCount: number;
  primaryOwnerEmail: string | null;
  primaryOwnerName: string | null;
  planName: string;
  planCode: string;
  subscriptionStatus: string;
  totalOrders: number;
  gmvCents: number;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 20;

  const fetchTenants = () => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(page * limit),
    });
    if (search) params.append("search", search);
    if (status) params.append("status", status);
    if (plan) params.append("plan", plan);

    fetch(`/api/platform/tenants?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (json?.data) {
          setTenants(json.data.items);
          setTotal(json.data.total);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTenants();
  }, [page, status, plan]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchTenants();
  };

  const formatCurrency = (cents: number) => {
    return `₹${(cents / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-indigo-400" />
            Organizations & Tenants Directory
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Global tenant lifecycle administration, store adoption, and quota governance
          </p>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-xl border border-white/10 bg-[#0c111c]">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search organizations by name, ID, or owner email..."
            className="w-full rounded-lg border border-white/10 bg-[#06090e] pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
            className="rounded-lg border border-white/10 bg-[#06090e] px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>

          <select
            value={plan}
            onChange={(e) => {
              setPlan(e.target.value);
              setPage(0);
            }}
            className="rounded-lg border border-white/10 bg-[#06090e] px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Plans</option>
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="rounded-xl border border-white/10 bg-[#0c111c] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-white/5 text-slate-400 font-mono uppercase">
              <tr>
                <th className="py-3 px-4 font-medium">Organization / Tenant</th>
                <th className="py-3 px-4 font-medium">Primary Owner</th>
                <th className="py-3 px-4 font-medium">Stores</th>
                <th className="py-3 px-4 font-medium">SaaS Plan</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Orders</th>
                <th className="py-3 px-4 font-medium">GMV Volume</th>
                <th className="py-3 px-4 font-medium">Created At</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    Loading tenants directory...
                  </td>
                </tr>
              )}

              {!loading && tenants.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No matching tenants found.
                  </td>
                </tr>
              )}

              {!loading &&
                tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-medium text-white">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate max-w-xs">{t.name}</span>
                      </div>
                      <div className="font-mono text-[10px] text-slate-500 truncate mt-0.5">
                        {t.id}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      <div>{t.primaryOwnerName || "Unknown"}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {t.primaryOwnerEmail || "—"}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      <span className="inline-flex items-center gap-1">
                        <Store className="w-3 h-3 text-slate-500" />
                        {t.storeCount}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-mono">
                        {t.planName}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {t.totalOrders.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-400 font-medium">
                      {formatCurrency(t.gmvCents)}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/tenants/${t.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/5 hover:bg-blue-600 text-slate-300 hover:text-white transition-all text-xs font-medium"
                      >
                        360 View
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-3 border-t border-white/10 text-xs text-slate-400">
          <div>
            Showing {tenants.length} of {total} tenant(s)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-white disabled:opacity-30"
            >
              Previous
            </button>
            <span className="font-mono">Page {page + 1}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * limit >= total}
              className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-white disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
