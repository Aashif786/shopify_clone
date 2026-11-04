"use client";

import React, { useState, useEffect } from "react";
import { FileText, Search } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";

interface AuditLogItem {
  id: string;
  actorId: string;
  actorEmail?: string;
  actorName?: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  tenantId: string | null;
  tenantName?: string | null;
  storeId: string | null;
  storeName?: string | null;
  reason: string;
  details: Record<string, unknown>;
  status: "SUCCESS" | "FAILURE";
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const limit = 25;

  const fetchLogs = () => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(page * limit),
    });
    if (action) params.append("action", action);
    if (resourceType) params.append("resourceType", resourceType);

    fetch(`/api/platform/audit?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (json?.data) {
          setLogs(json.data.items);
          setTotal(json.data.total);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, [page, action, resourceType]);

  return (
    <div className="space-y-6">
      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-xl rounded-xl border border-white/10 bg-[#0c111c] p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white font-mono">
                Audit Record: {selectedLog.id}
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Action Name</span>
                <span className="font-mono text-white font-bold">{selectedLog.action}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Actor</span>
                <span className="font-mono text-slate-200">
                  {selectedLog.actorName} ({selectedLog.actorEmail}) [{selectedLog.actorRole}]
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Resource</span>
                <span className="font-mono text-slate-300">
                  {selectedLog.resourceType} ({selectedLog.resourceId || "global"})
                </span>
              </div>
              <div className="py-2">
                <span className="text-slate-400 block mb-1">Administrative Justification</span>
                <div className="p-3 rounded-lg bg-[#06090e] border border-white/10 font-sans text-slate-200 leading-relaxed">
                  {selectedLog.reason}
                </div>
              </div>
              <div className="py-2">
                <span className="text-slate-400 block mb-1">Audit Payload & Diffs</span>
                <pre className="p-3 rounded-lg bg-[#06090e] border border-white/10 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-48">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <FileText className="w-6 h-6 text-purple-400" />
          Immutable Platform Audit Trail
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Cryptographically append-only audit trail recording all privileged administrator mutations with mandatory reasons
        </p>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-xl border border-white/10 bg-[#0c111c]">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(0);
            }}
            placeholder="Filter by action name (e.g. auth.login, tenant.status_change)..."
            className="w-full rounded-lg border border-white/10 bg-[#06090e] pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <select
          value={resourceType}
          onChange={(e) => {
            setResourceType(e.target.value);
            setPage(0);
          }}
          className="rounded-lg border border-white/10 bg-[#06090e] px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 w-full sm:w-auto"
        >
          <option value="">All Resource Types</option>
          <option value="organization">organization</option>
          <option value="payment">payment</option>
          <option value="user">user</option>
          <option value="platform_feature_flag">platform_feature_flag</option>
          <option value="platform_admin_session">platform_admin_session</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-xl border border-white/10 bg-[#0c111c] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-white/5 text-slate-400 font-mono uppercase">
              <tr>
                <th className="py-3 px-4 font-medium">Timestamp (UTC)</th>
                <th className="py-3 px-4 font-medium">Actor</th>
                <th className="py-3 px-4 font-medium">Action</th>
                <th className="py-3 px-4 font-medium">Target Resource</th>
                <th className="py-3 px-4 font-medium">Recorded Justification</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    Loading audit trail...
                  </td>
                </tr>
              )}

              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No audit records matching filter criteria.
                  </td>
                </tr>
              )}

              {!loading &&
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-white">{log.actorName || "Admin"}</div>
                      <div className="text-[10px] text-blue-400 font-mono uppercase">
                        {log.actorRole}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-white font-medium">{log.action}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      <div>{log.resourceType}</div>
                      {log.resourceId && (
                        <div className="text-[10px] text-slate-500 truncate max-w-[120px]">
                          {log.resourceId}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-300 text-xs truncate max-w-[220px]">
                      {log.reason}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-mono transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-3 border-t border-white/10 text-xs text-slate-400">
          <div>
            Showing {logs.length} of {total} audit event(s)
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
