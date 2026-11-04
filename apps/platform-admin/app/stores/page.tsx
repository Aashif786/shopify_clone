"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Store, ExternalLink, ArrowRight, Building2 } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";

interface StoreItem {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
  organizationName: string;
  status: string;
  currency: string;
  createdAt: string;
  primaryDomain: string | null;
  productCount: number;
  orderCount: number;
  gmvCents: number;
}

export default function StoresPage() {
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 20;

  const fetchStores = () => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(page * limit),
    });
    if (search) params.append("search", search);
    if (status) params.append("status", status);

    fetch(`/api/platform/stores?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (json?.data) {
          setStores(json.data.items);
          setTotal(json.data.total);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStores();
  }, [page, status]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchStores();
  };

  const formatCurrency = (cents: number, curr = "INR") => {
    return `${curr} ${(cents / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Store className="w-6 h-6 text-emerald-400" />
            Stores Directory
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Global catalog of merchant storefronts, custom domains, and commerce volumes
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
            placeholder="Search stores by name, slug, or organization..."
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
            <option value="DRAFT">DRAFT</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </div>
      </div>

      {/* Stores Table */}
      <div className="rounded-xl border border-white/10 bg-[#0c111c] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-white/5 text-slate-400 font-mono uppercase">
              <tr>
                <th className="py-3 px-4 font-medium">Store Name & Slug</th>
                <th className="py-3 px-4 font-medium">Tenant Organization</th>
                <th className="py-3 px-4 font-medium">Custom Domain</th>
                <th className="py-3 px-4 font-medium">Products</th>
                <th className="py-3 px-4 font-medium">Orders</th>
                <th className="py-3 px-4 font-medium">GMV Processed</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Created</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    Loading stores directory...
                  </td>
                </tr>
              )}

              {!loading && stores.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No matching stores found.
                  </td>
                </tr>
              )}

              {!loading &&
                stores.map((s) => (
                  <tr key={s.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-medium text-white">
                      <div className="flex items-center gap-2">
                        <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate max-w-xs">{s.name}</span>
                      </div>
                      <div className="font-mono text-[10px] text-slate-500 truncate mt-0.5">
                        {s.slug}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      <Link
                        href={`/tenants/${s.organizationId}`}
                        className="hover:text-blue-400 transition-colors flex items-center gap-1.5"
                      >
                        <Building2 className="w-3 h-3 text-slate-500" />
                        <span className="truncate max-w-[150px]">{s.organizationName}</span>
                      </Link>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {s.primaryDomain ? (
                        <span className="inline-flex items-center gap-1 text-blue-400">
                          {s.primaryDomain}
                          <ExternalLink className="w-3 h-3" />
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">{s.productCount}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">{s.orderCount}</td>
                    <td className="py-3 px-4 font-mono text-emerald-400 font-medium">
                      {formatCurrency(s.gmvCents, s.currency)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/stores/${s.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/5 hover:bg-blue-600 text-slate-300 hover:text-white transition-all text-xs font-medium"
                      >
                        Store 360
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
            Showing {stores.length} of {total} store(s)
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
