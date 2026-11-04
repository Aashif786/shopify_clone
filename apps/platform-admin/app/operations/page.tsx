"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Server,
  Mail,
  RotateCcw,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { MetricCard } from "@/components/MetricCard";

interface Incident {
  id: string;
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  category: "PAYMENT" | "WORKER" | "NOTIFICATION" | "SECURITY" | "DATABASE";
  description: string;
  affectedCount: number;
  sampleEntityId?: string | null;
  detectedAt: string;
  recommendedAction: string;
}

interface HealthData {
  database: {
    status: "CONNECTED" | "ERROR";
    activeConnections: number;
    latencyMs: number;
  };
  worker: {
    status: "HEALTHY" | "DEGRADED" | "NEEDS_ATTENTION";
    notificationBacklog: number;
    failedNotifications: number;
    failedWebhooks: number;
    pendingWebhooks: number;
    orphanedCapturedPayments: number;
    stuckRefunds: number;
    expiredReservations: number;
  };
  incidents: Incident[];
}

export default function OperationsPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = () => {
    setLoading(true);
    fetch("/api/platform/operations/health")
      .then((res) => res.json())
      .then((json) => {
        if (json?.data) setData(json.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000); // Poll every 15s for real-time telemetry
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="py-12 text-center text-slate-500 font-mono text-xs">
        Collecting Platform Telemetry...
      </div>
    );
  }

  const { database, worker, incidents } = data || {
    database: { status: "CONNECTED", activeConnections: 5, latencyMs: 1 },
    worker: {
      status: "HEALTHY",
      notificationBacklog: 0,
      failedNotifications: 0,
      failedWebhooks: 0,
      pendingWebhooks: 0,
      orphanedCapturedPayments: 0,
      stuckRefunds: 0,
      expiredReservations: 0,
    },
    incidents: [],
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-rose-400" />
            Operations, Reliability & Incident Center
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time pipeline observability, worker telemetry, dead-letter recovery, and automated incident triage
          </p>
        </div>

        <button
          onClick={fetchHealth}
          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Poll Telemetry
        </button>
      </div>

      {/* Vitals Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="PostgreSQL Core Health"
          value={`${database.latencyMs}ms`}
          badge={<StatusBadge status={database.status} pulse={database.status === "CONNECTED"} />}
          subtitle="Query latency check"
          icon={<Database className="w-4 h-4 text-emerald-400" />}
        />
        <MetricCard
          title="Background Worker Pipeline"
          value={worker.status}
          badge={<StatusBadge status={worker.status} />}
          subtitle="Scheduler & recovery loops"
          icon={<Server className="w-4 h-4 text-blue-400" />}
          alertVariant={worker.status === "NEEDS_ATTENTION" ? "critical" : worker.status === "DEGRADED" ? "warning" : "normal"}
        />
        <MetricCard
          title="Outbox Email Backlog"
          value={worker.notificationBacklog}
          subtitle={`${worker.failedNotifications} delivery failures`}
          icon={<Mail className="w-4 h-4 text-amber-400" />}
        />
        <MetricCard
          title="Dead-Letter Webhooks"
          value={worker.failedWebhooks}
          subtitle={`${worker.pendingWebhooks} awaiting retry`}
          icon={<RotateCcw className="w-4 h-4 text-purple-400" />}
        />
      </div>

      {/* Active Incidents Center */}
      <div className="rounded-xl border border-white/10 bg-[#0c111c] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">
              Automated Incident Detection ({incidents.length})
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {incidents.length === 0 ? "All systems optimal" : `${incidents.length} active incident(s)`}
          </span>
        </div>

        {incidents.length === 0 ? (
          <div className="p-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <div className="font-semibold text-white">No active operational incidents.</div>
              <div className="text-slate-400 mt-0.5">
                Payment reconciliations, webhook listeners, and outbox notification jobs are operating within nominal thresholds.
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map((inc) => (
              <div
                key={inc.id}
                className="p-4 rounded-xl border border-white/10 bg-[#06090e] space-y-3 hover:border-white/20 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={inc.severity} pulse={inc.severity === "CRITICAL"} />
                    <span className="text-sm font-bold text-white">{inc.title}</span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Detected: {new Date(inc.detectedAt).toLocaleTimeString()}
                  </span>
                </div>

                <p className="text-xs text-slate-300">{inc.description}</p>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-white/5 text-xs">
                  <div className="text-slate-400">
                    <span className="font-semibold text-slate-200">Recommended Runbook:</span>{" "}
                    {inc.recommendedAction}
                  </div>

                  {inc.category === "PAYMENT" && (
                    <Link
                      href="/payments?orphaned=true"
                      className="px-3 py-1 rounded bg-rose-600/20 border border-rose-500/30 text-rose-300 hover:bg-rose-600 hover:text-white transition-all font-medium inline-flex items-center gap-1 shrink-0"
                    >
                      Inspect in Payments Console
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Background Jobs Runbook Overview */}
      <div className="rounded-xl border border-white/10 bg-[#0c111c] p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white">Registered Worker Recovery Jobs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-lg bg-[#06090e] border border-white/5 space-y-1">
            <div className="font-mono text-blue-400 font-bold">PaymentRecoveryJob</div>
            <p className="text-slate-400">
              Scans for authorized/captured payments stuck without orders, verifies Razorpay signature & order state, and triggers auto-reconciliation.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-[#06090e] border border-white/5 space-y-1">
            <div className="font-mono text-purple-400 font-bold">WebhookRecoveryJob</div>
            <p className="text-slate-400">
              Re-executes unhandled webhook payloads from `payment_webhook_events` with exponential backoff and idempotency verification.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-[#06090e] border border-white/5 space-y-1">
            <div className="font-mono text-amber-400 font-bold">NotificationDispatchJob</div>
            <p className="text-slate-400">
              Dispatches pending transactional emails from `notification_outbox` through configured Resend/SMTP gateways.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-[#06090e] border border-white/5 space-y-1">
            <div className="font-mono text-emerald-400 font-bold">InventoryExpirationRecoveryJob</div>
            <p className="text-slate-400">
              Reclaims stock reservations where checkout TTL has expired without completed order placement.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
