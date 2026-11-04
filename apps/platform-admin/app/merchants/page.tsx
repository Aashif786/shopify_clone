"use client";

import React, { useState, useEffect } from "react";
import { Search, Users, LogOut, CheckCircle2 } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { ReasonModal } from "@/components/ReasonModal";

interface MerchantItem {
  id: string;
  email: string;
  name: string;
  status: string;
  createdAt: string;
  isPlatformAdmin: boolean;
  storeCount: number;
  organizationCount: number;
  activeSessionCount: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
}

export default function MerchantsPage() {
  const [merchants, setMerchants] = useState<MerchantItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 20;

  const [selectedUser, setSelectedUser] = useState<MerchantItem | null>(null);
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchMerchants = () => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(page * limit),
    });
    if (search) params.append("search", search);
    if (status) params.append("status", status);

    fetch(`/api/platform/merchants?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (json?.data) {
          setMerchants(json.data.items);
          setTotal(json.data.total);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMerchants();
  }, [page, status]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchMerchants();
  };

  const handleRevokeSessions = async (reason: string) => {
    if (!selectedUser) return;
    const res = await fetch("/api/platform/merchants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: selectedUser.id,
        action: "revoke_sessions",
        reason,
      }),
    });

    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error?.message || "Failed to revoke sessions");
    }

    setToast(`Successfully terminated active sessions for ${selectedUser.email}`);
    setTimeout(() => setToast(null), 4000);
    fetchMerchants();
  };

  return (
    <div className="space-y-6">
      <ReasonModal
        isOpen={revokeModalOpen}
        title="Revoke All Merchant Sessions"
        description={`This will immediately invalidate all active web sessions for ${selectedUser?.email}. The merchant will be logged out of all devices immediately.`}
        isDestructive
        actionLabel="Revoke All Sessions"
        onConfirm={handleRevokeSessions}
        onClose={() => setRevokeModalOpen(false)}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-sky-400" />
            Merchants & Access Governance
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Global identity administration, credential security, session termination, and privilege enforcement
          </p>
        </div>
      </div>

      {toast && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-xl border border-white/10 bg-[#0c111c]">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search merchants by email or display name..."
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
          </select>
        </div>
      </div>

      {/* Merchants Table */}
      <div className="rounded-xl border border-white/10 bg-[#0c111c] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-white/5 text-slate-400 font-mono uppercase">
              <tr>
                <th className="py-3 px-4 font-medium">Merchant Account</th>
                <th className="py-3 px-4 font-medium">Platform Privilege</th>
                <th className="py-3 px-4 font-medium">Tenant Orgs</th>
                <th className="py-3 px-4 font-medium">Store Memberships</th>
                <th className="py-3 px-4 font-medium">Active Sessions</th>
                <th className="py-3 px-4 font-medium">Account Status</th>
                <th className="py-3 px-4 font-medium">Registered</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    Loading merchants...
                  </td>
                </tr>
              )}

              {!loading && merchants.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No merchants found.
                  </td>
                </tr>
              )}

              {!loading &&
                merchants.map((m) => (
                  <tr key={m.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-medium text-white">
                      <div>{m.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{m.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      {m.isPlatformAdmin ? (
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-mono">
                          PLATFORM_ADMIN
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">Standard Merchant</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">{m.organizationCount}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">{m.storeCount}</td>
                    <td className="py-3 px-4 font-mono">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] ${
                          m.activeSessionCount > 0
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "text-slate-500"
                        }`}
                      >
                        {m.activeSessionCount} active
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {m.lockedUntil && new Date(m.lockedUntil) > new Date() ? (
                        <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-mono">
                          LOCKED
                        </span>
                      ) : (
                        <StatusBadge status={m.status} />
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {m.activeSessionCount > 0 && (
                        <button
                          onClick={() => {
                            setSelectedUser(m);
                            setRevokeModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600 border border-rose-500/30 text-rose-300 hover:text-white transition-all text-xs font-medium inline-flex items-center gap-1"
                        >
                          <LogOut className="w-3 h-3" />
                          Revoke Sessions
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-3 border-t border-white/10 text-xs text-slate-400">
          <div>
            Showing {merchants.length} of {total} merchant(s)
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
