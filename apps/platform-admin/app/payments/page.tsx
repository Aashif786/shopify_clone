"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CreditCard,
  Search,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Receipt,
  FileQuestion,
  RotateCcw,
} from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";

interface PaymentItem {
  id: string;
  storeId: string;
  storeName: string;
  organizationName: string;
  checkoutId: string;
  orderId: string | null;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  providerPaymentId: string | null;
  providerOrderId: string | null;
  reconciliationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

function PaymentsContent() {
  const searchParams = useSearchParams();
  const initialOrphaned = searchParams.get("orphaned") === "true";

  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({
    totalVolumeCents: 0,
    capturedCount: 0,
    failedCount: 0,
    orphanedCount: 0,
    stuckRefundsCount: 0,
  });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [orphanedOnly, setOrphanedOnly] = useState(initialOrphaned);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 20;

  const fetchPayments = () => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(page * limit),
    });
    if (search) params.append("search", search);
    if (status) params.append("status", status);
    if (orphanedOnly) params.append("orphaned", "true");

    fetch(`/api/platform/payments?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (json?.data) {
          setPayments(json.data.items);
          setTotal(json.data.total);
          setStats(json.data.stats);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPayments();
  }, [page, status, orphanedOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchPayments();
  };

  const formatCurrency = (cents: number, curr = "INR") => {
    return `${curr} ${(cents / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <CreditCard className="w-6 h-6 text-blue-400" />
          Payment Operations & Financial Reconciliation
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Razorpay transaction lifecycle, settlement verification, webhook telemetry, and exception reconciliation
        </p>
      </div>

      {/* Financial Operations Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Captured Volume"
          value={formatCurrency(stats.totalVolumeCents)}
          subtitle={`${stats.capturedCount} captured transaction(s)`}
          icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
        />
        <MetricCard
          title="Orphaned Captures"
          value={stats.orphanedCount}
          subtitle="Captured without order record"
          alertVariant={stats.orphanedCount > 0 ? "critical" : "normal"}
          icon={<FileQuestion className="w-4 h-4 text-rose-400" />}
        />
        <MetricCard
          title="Stuck In-Flight Refunds"
          value={stats.stuckRefundsCount}
          subtitle="Processing > 15 minutes"
          alertVariant={stats.stuckRefundsCount > 0 ? "warning" : "normal"}
          icon={<RotateCcw className="w-4 h-4 text-amber-400" />}
        />
        <MetricCard
          title="Failed Payment Attempts"
          value={stats.failedCount}
          subtitle="Customer card/UPI declines"
          icon={<Receipt className="w-4 h-4 text-slate-400" />}
        />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-xl border border-white/10 bg-[#0c111c]">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Razorpay payment ID (pay_...), order ID, or store..."
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
            <option value="CAPTURED">CAPTURED</option>
            <option value="PENDING">PENDING</option>
            <option value="FAILED">FAILED</option>
            <option value="REFUNDED">REFUNDED</option>
          </select>

          <button
            onClick={() => {
              setOrphanedOnly(!orphanedOnly);
              setPage(0);
            }}
            className={`px-3 py-2 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
              orphanedOnly
                ? "bg-rose-600 text-white shadow-md shadow-rose-600/30 font-semibold"
                : "bg-white/5 border border-white/10 text-slate-300 hover:text-white"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            Orphaned Captures Only
          </button>
        </div>
      </div>

      {/* Payments Table */}
      <div className="rounded-xl border border-white/10 bg-[#0c111c] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-white/5 text-slate-400 font-mono uppercase">
              <tr>
                <th className="py-3 px-4 font-medium">Transaction ID / Provider</th>
                <th className="py-3 px-4 font-medium">Store & Tenant</th>
                <th className="py-3 px-4 font-medium">Amount</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Order Reference</th>
                <th className="py-3 px-4 font-medium">Reconciliation Note</th>
                <th className="py-3 px-4 font-medium">Created</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    Loading payment records...
                  </td>
                </tr>
              )}

              {!loading && payments.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No transactions found matching criteria.
                  </td>
                </tr>
              )}

              {!loading &&
                payments.map((p) => {
                  const isOrphaned = p.status === "CAPTURED" && !p.orderId;

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-white/5 transition-colors ${
                        isOrphaned ? "bg-rose-950/10" : ""
                      }`}
                    >
                      <td className="py-3 px-4 font-mono">
                        <div className="text-white font-medium">
                          {p.providerPaymentId || "Awaiting Gateway"}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[180px]">
                          {p.id}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        <div className="font-medium text-white">{p.storeName}</div>
                        <div className="text-[10px] text-slate-500">{p.organizationName}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-emerald-400 font-medium">
                        {formatCurrency(p.amount, p.currency)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={p.status} pulse={p.status === "PENDING"} />
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">
                        {p.orderId ? (
                          <span className="text-slate-300">Order linked</span>
                        ) : isOrphaned ? (
                          <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-semibold">
                            MISSING ORDER
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-xs truncate max-w-[160px]">
                        {p.reconciliationReason || "—"}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                        {new Date(p.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/payments/${p.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/5 hover:bg-blue-600 text-slate-300 hover:text-white transition-all text-xs font-medium"
                        >
                          Inspect
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-3 border-t border-white/10 text-xs text-slate-400">
          <div>
            Showing {payments.length} of {total} transaction(s)
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

export default function PaymentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs font-mono text-slate-500">Loading payments console...</div>}>
      <PaymentsContent />
    </Suspense>
  );
}
