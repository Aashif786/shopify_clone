"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  Lock,
  LogOut,
  RefreshCw,
  UserCheck,
  CheckCircle2,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { ReasonModal } from "@/components/ReasonModal";

interface SecurityEventItem {
  id: string;
  eventType: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  userId: string | null;
  userEmail?: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

interface AdminSessionItem {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
}

export default function SecurityPage() {
  const [events, setEvents] = useState<SecurityEventItem[]>([]);
  const [sessions, setSessions] = useState<AdminSessionItem[]>([]);
  const [severity, setSeverity] = useState("");

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchSecurityData = () => {
    const params = new URLSearchParams();
    if (severity) params.append("severity", severity);

    Promise.all([
      fetch(`/api/platform/security/events?${params.toString()}`).then((r) => r.json()),
      fetch("/api/platform/security/sessions").then((r) => r.json()),
    ])
      .then(([eventsJson, sessionsJson]) => {
        if (eventsJson?.data?.items) setEvents(eventsJson.data.items);
        if (sessionsJson?.data?.items) setSessions(sessionsJson.data.items);
      });
  };

  useEffect(() => {
    fetchSecurityData();
  }, [severity]);

  const handleRevokeSession = async (reason: string) => {
    if (!selectedSessionId) return;

    const res = await fetch("/api/platform/security/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: selectedSessionId, reason }),
    });

    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error?.message || "Failed to revoke admin session");
    }

    setToast("Admin session successfully terminated and revoked.");
    setTimeout(() => setToast(null), 4000);
    fetchSecurityData();
  };

  return (
    <div className="space-y-6">
      <ReasonModal
        isOpen={revokeModalOpen}
        title="Revoke Privileged Platform Session"
        description="This will immediately revoke this platform administrator session and log an audit event."
        isDestructive
        actionLabel="Revoke Admin Session"
        onConfirm={handleRevokeSession}
        onClose={() => setRevokeModalOpen(false)}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-emerald-400" />
            Security Center & Privileged Session Governance
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time security telemetry, brute-force lockout monitoring, and active administrative session control
          </p>
        </div>

        <button
          onClick={fetchSecurityData}
          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {toast && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Active Platform Admin Sessions */}
      <div className="rounded-xl border border-white/10 bg-[#0c111c] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">
              Active Privileged Administrator Sessions ({sessions.length})
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">Enforcing 8h session limits</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 text-slate-400 font-mono uppercase">
              <tr>
                <th className="pb-2">Administrator</th>
                <th className="pb-2">Role</th>
                <th className="pb-2">IP Address</th>
                <th className="pb-2">User Agent</th>
                <th className="pb-2">Session Created</th>
                <th className="pb-2">Expires</th>
                <th className="pb-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {sessions.map((s) => (
                <tr key={s.id} className="hover:bg-white/5">
                  <td className="py-2.5 font-sans">
                    <div className="font-medium text-white">{s.userName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{s.userEmail}</div>
                  </td>
                  <td className="py-2.5">
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] uppercase">
                      {s.role}
                    </span>
                  </td>
                  <td className="py-2.5 text-slate-300">{s.ipAddress || "—"}</td>
                  <td className="py-2.5 text-slate-400 font-sans text-xs truncate max-w-[180px]">
                    {s.userAgent || "—"}
                  </td>
                  <td className="py-2.5 text-slate-400 text-[11px]">
                    {new Date(s.createdAt).toLocaleTimeString()}
                  </td>
                  <td className="py-2.5 text-slate-400 text-[11px]">
                    {new Date(s.expiresAt).toLocaleTimeString()}
                  </td>
                  <td className="py-2.5 text-right font-sans">
                    <button
                      onClick={() => {
                        setSelectedSessionId(s.id);
                        setRevokeModalOpen(true);
                      }}
                      className="px-2 py-1 rounded bg-rose-600/20 hover:bg-rose-600 border border-rose-500/30 text-rose-300 hover:text-white transition-all text-xs font-medium inline-flex items-center gap-1"
                    >
                      <LogOut className="w-3 h-3" />
                      Terminate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Events Stream */}
      <div className="rounded-xl border border-white/10 bg-[#0c111c] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">Security Telemetry Events</h2>
          </div>

          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#06090e] px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500 font-mono"
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
            <option value="INFO">INFO</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 text-slate-400 font-mono uppercase">
              <tr>
                <th className="pb-2">Severity</th>
                <th className="pb-2">Event Type</th>
                <th className="pb-2">Account Target</th>
                <th className="pb-2">IP Origin</th>
                <th className="pb-2">Details</th>
                <th className="pb-2">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No security events recorded matching filter.
                  </td>
                </tr>
              ) : (
                events.map((e) => (
                  <tr key={e.id} className="hover:bg-white/5">
                    <td className="py-2.5">
                      <StatusBadge status={e.severity} />
                    </td>
                    <td className="py-2.5 font-mono text-white font-medium">{e.eventType}</td>
                    <td className="py-2.5 text-slate-300 font-mono">
                      {e.userEmail || e.userId || "—"}
                    </td>
                    <td className="py-2.5 text-slate-400 font-mono">{e.ipAddress || "—"}</td>
                    <td className="py-2.5 text-slate-400 font-mono text-[11px] truncate max-w-[200px]">
                      {JSON.stringify(e.details)}
                    </td>
                    <td className="py-2.5 font-mono text-slate-400 text-[11px]">
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
