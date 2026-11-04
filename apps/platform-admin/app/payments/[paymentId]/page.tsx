"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  CreditCard,
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  Activity,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { ReasonModal } from "@/components/ReasonModal";

interface PaymentDetailData {
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
  attempts: Array<{
    id: string;
    amount: number;
    status: string;
    errorCode: string | null;
    errorDescription: string | null;
    createdAt: string;
  }>;
  webhooks: Array<{
    id: string;
    eventId: string;
    eventType: string;
    status: string;
    retryCount: number;
    errorMessage: string | null;
    processedAt: string | null;
    createdAt: string;
  }>;
  refunds: Array<{
    id: string;
    amount: number;
    status: string;
    providerRefundId: string | null;
    reason: string | null;
    createdAt: string;
  }>;
}

export default function PaymentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const paymentId = params.paymentId as string;

  const [data, setData] = useState<PaymentDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchPayment = () => {
    setLoading(true);
    fetch(`/api/platform/payments/${paymentId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Payment not found");
        return res.json();
      })
      .then((json) => {
        if (json?.data) setData(json.data);
      })
      .catch(() => router.push("/payments"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPayment();
  }, [paymentId, router]);

  const handleSetReconciliationNote = async (reason: string) => {
    const res = await fetch(`/api/platform/payments/${paymentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });

    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error?.message || "Failed to annotate payment.");
    }

    setToast("Reconciliation note successfully recorded.");
    setTimeout(() => setToast(null), 4000);
    fetchPayment();
  };

  if (loading || !data) {
    return (
      <div className="py-12 text-center text-slate-500 font-mono text-xs">
        Loading Transaction Telemetry...
      </div>
    );
  }

  const formatCurrency = (cents: number) =>
    `${data.currency} ${(cents / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const isOrphaned = data.status === "CAPTURED" && !data.orderId;

  return (
    <div className="space-y-6">
      <ReasonModal
        isOpen={reconcileModalOpen}
        title="Annotate Payment Reconciliation Note"
        description="Provide a cryptographic audit explanation detailing the investigation and resolution status for this transaction."
        actionLabel="Save Audit Annotation"
        onConfirm={handleSetReconciliationNote}
        onClose={() => setReconcileModalOpen(false)}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/payments"
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
                {data.providerPaymentId || data.id}
              </h1>
              <StatusBadge status={data.status} />
              {isOrphaned && (
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-semibold">
                  MISSING ORDER RECORD
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-2">
              <span>Internal ID: {data.id}</span>
              <span>•</span>
              <span>{data.storeName} ({data.organizationName})</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setReconcileModalOpen(true)}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all shadow-md shadow-blue-600/20 self-start sm:self-auto"
        >
          Add Reconciliation Note
        </button>
      </div>

      {toast && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Vitals Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-white/10 bg-[#0c111c] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Financial Details</h2>
          <dl className="divide-y divide-white/5 text-xs">
            <div className="py-2.5 flex justify-between">
              <dt className="text-slate-400">Total Charged</dt>
              <dd className="font-mono text-emerald-400 font-bold text-sm">
                {formatCurrency(data.amount)}
              </dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-slate-400">Gateway Provider</dt>
              <dd className="font-mono text-white uppercase">{data.provider}</dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-slate-400">Razorpay Order ID</dt>
              <dd className="font-mono text-slate-300">{data.providerOrderId || "—"}</dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-slate-400">Associated Checkout ID</dt>
              <dd className="font-mono text-slate-300 truncate max-w-[200px]">{data.checkoutId}</dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-slate-400">Associated Order ID</dt>
              <dd className="font-mono text-slate-300">
                {data.orderId || <span className="text-rose-400 font-bold">NULL (Orphaned)</span>}
              </dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-slate-400">Recorded At</dt>
              <dd className="font-mono text-slate-300">
                {new Date(data.createdAt).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0c111c] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Reconciliation Note & Analysis</h2>
          {data.reconciliationReason ? (
            <div className="p-4 rounded-lg bg-[#06090e] border border-white/10 text-xs text-slate-200">
              <div className="font-mono text-[10px] uppercase text-blue-400 mb-1">
                Active Audit Annotation
              </div>
              <p className="leading-relaxed">{data.reconciliationReason}</p>
            </div>
          ) : (
            <div className="text-xs text-slate-500 py-6 text-center">
              No reconciliation note recorded yet. If this payment requires investigation or manual settlement, click &ldquo;Add Reconciliation Note&rdquo; above.
            </div>
          )}
        </div>
      </div>

      {/* Gateway Attempts */}
      <div className="rounded-xl border border-white/10 bg-[#0c111c] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-blue-400" />
          Gateway Payment Attempts ({data.attempts.length})
        </h2>
        {data.attempts.length === 0 ? (
          <div className="text-xs text-slate-500 py-4 text-center">No attempt logs recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-slate-400 font-mono uppercase">
                <tr>
                  <th className="pb-2">Attempt ID</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Error Code</th>
                  <th className="pb-2">Description</th>
                  <th className="pb-2">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.attempts.map((a) => (
                  <tr key={a.id} className="hover:bg-white/5 font-mono">
                    <td className="py-2.5 text-slate-400 truncate max-w-[120px]">{a.id}</td>
                    <td className="py-2.5 text-white">{formatCurrency(a.amount)}</td>
                    <td className="py-2.5">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="py-2.5 text-rose-400">{a.errorCode || "—"}</td>
                    <td className="py-2.5 text-slate-400 font-sans">{a.errorDescription || "—"}</td>
                    <td className="py-2.5 text-slate-400 text-[11px]">
                      {new Date(a.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Webhook History */}
      <div className="rounded-xl border border-white/10 bg-[#0c111c] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-amber-400" />
          Associated Webhook Ingestion Events ({data.webhooks.length})
        </h2>
        {data.webhooks.length === 0 ? (
          <div className="text-xs text-slate-500 py-4 text-center">No associated webhooks found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-slate-400 font-mono uppercase">
                <tr>
                  <th className="pb-2">Webhook Event ID</th>
                  <th className="pb-2">Event Type</th>
                  <th className="pb-2">Processing Status</th>
                  <th className="pb-2">Retries</th>
                  <th className="pb-2">Error Note</th>
                  <th className="pb-2">Received Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.webhooks.map((w) => (
                  <tr key={w.id} className="hover:bg-white/5 font-mono">
                    <td className="py-2.5 text-slate-300">{w.eventId}</td>
                    <td className="py-2.5 text-blue-400">{w.eventType}</td>
                    <td className="py-2.5">
                      <StatusBadge status={w.status} />
                    </td>
                    <td className="py-2.5 text-slate-300">{w.retryCount}</td>
                    <td className="py-2.5 text-rose-400 font-sans">{w.errorMessage || "—"}</td>
                    <td className="py-2.5 text-slate-400 text-[11px]">
                      {new Date(w.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Refunds History */}
      <div className="rounded-xl border border-white/10 bg-[#0c111c] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-purple-400" />
          Associated Refunds ({data.refunds.length})
        </h2>
        {data.refunds.length === 0 ? (
          <div className="text-xs text-slate-500 py-4 text-center">No refund records exist for this payment.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-slate-400 font-mono uppercase">
                <tr>
                  <th className="pb-2">Refund ID</th>
                  <th className="pb-2">Gateway Refund ID</th>
                  <th className="pb-2">Refunded Amount</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Reason</th>
                  <th className="pb-2">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.refunds.map((r) => (
                  <tr key={r.id} className="hover:bg-white/5 font-mono">
                    <td className="py-2.5 text-slate-400">{r.id}</td>
                    <td className="py-2.5 text-purple-400">{r.providerRefundId || "Pending"}</td>
                    <td className="py-2.5 text-rose-400 font-bold">{formatCurrency(r.amount)}</td>
                    <td className="py-2.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="py-2.5 text-slate-300 font-sans">{r.reason || "—"}</td>
                    <td className="py-2.5 text-slate-400 text-[11px]">
                      {new Date(r.createdAt).toLocaleString()}
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
