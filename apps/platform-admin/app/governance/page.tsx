"use client";

import React, { useState, useEffect } from "react";
import { Sliders, Settings, CheckCircle2 } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { ReasonModal } from "@/components/ReasonModal";

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  scopeType: "GLOBAL" | "TENANT" | "STORE";
  targetIds: string[];
  rolloutPercentage: number;
  createdAt: string;
  updatedAt: string;
}

export default function GovernancePage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [settings, setSettings] = useState<Record<string, unknown>>({});

  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
  const [targetEnabled, setTargetEnabled] = useState(false);
  const [targetRollout, setTargetRollout] = useState(100);
  const [flagModalOpen, setFlagModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchGovernanceData = () => {
    Promise.all([
      fetch("/api/platform/governance/flags").then((r) => r.json()),
      fetch("/api/platform/governance/settings").then((r) => r.json()),
    ])
      .then(([flagsJson, settingsJson]) => {
        if (flagsJson?.data?.items) setFlags(flagsJson.data.items);
        if (settingsJson?.data?.settings) setSettings(settingsJson.data.settings);
      });
  };

  useEffect(() => {
    fetchGovernanceData();
  }, []);

  const handleUpdateFlag = async (reason: string) => {
    if (!selectedFlag) return;

    const res = await fetch("/api/platform/governance/flags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: selectedFlag.key,
        enabled: targetEnabled,
        rolloutPercentage: targetRollout,
        reason,
      }),
    });

    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error?.message || "Failed to update feature flag");
    }

    setToast(`Feature flag '${selectedFlag.name}' updated successfully.`);
    setTimeout(() => setToast(null), 4000);
    fetchGovernanceData();
  };

  return (
    <div className="space-y-6">
      <ReasonModal
        isOpen={flagModalOpen}
        title={`Update Flag: ${selectedFlag?.name}`}
        description={`Changing this feature flag will immediately affect runtime behavior across the Cal Cart SaaS platform for all targeted tenants.`}
        actionLabel="Confirm Flag Mutation"
        onConfirm={handleUpdateFlag}
        onClose={() => setFlagModalOpen(false)}
      />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <Sliders className="w-6 h-6 text-sky-400" />
          Platform Governance & Feature Flags
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Dynamic capability toggling, phased tenant rollouts, maintenance mode, and global system parameters
        </p>
      </div>

      {toast && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Feature Flags Table */}
      <div className="rounded-xl border border-white/10 bg-[#0c111c] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Platform Feature Flags</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live runtime feature gates evaluated on storefronts and merchant admin
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">{flags.length} active flag(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-white/5 text-slate-400 font-mono uppercase">
              <tr>
                <th className="py-3 px-4 font-medium">Flag Identifier</th>
                <th className="py-3 px-4 font-medium">Description</th>
                <th className="py-3 px-4 font-medium">Scope</th>
                <th className="py-3 px-4 font-medium">Rollout %</th>
                <th className="py-3 px-4 font-medium">State</th>
                <th className="py-3 px-4 font-medium text-right">Toggle Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {flags.map((flag) => (
                <tr key={flag.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-medium text-white">{flag.name}</div>
                    <div className="text-[10px] text-blue-400 font-mono mt-0.5">{flag.key}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-300 max-w-xs">{flag.description}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10 text-[10px] font-mono">
                      {flag.scopeType}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-300">{flag.rolloutPercentage}%</td>
                  <td className="py-3 px-4">
                    <StatusBadge
                      status={flag.enabled ? "ENABLED" : "DISABLED"}
                      variant={flag.enabled ? "success" : "neutral"}
                    />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => {
                        setSelectedFlag(flag);
                        setTargetEnabled(!flag.enabled);
                        setTargetRollout(flag.enabled ? 0 : 100);
                        setFlagModalOpen(true);
                      }}
                      className={`px-3 py-1 rounded text-xs font-mono font-medium transition-all ${
                        flag.enabled
                          ? "bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30"
                          : "bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white border border-emerald-500/30"
                      }`}
                    >
                      {flag.enabled ? "Disable Flag" : "Enable Flag"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Governance Settings Overview */}
      <div className="rounded-xl border border-white/10 bg-[#0c111c] p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Settings className="w-4 h-4 text-slate-400" />
          Active Platform Operational Configuration
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-4 rounded-lg bg-[#06090e] border border-white/5 space-y-2">
            <div className="text-blue-400 uppercase font-bold text-[11px]">General Settings</div>
            <pre className="text-slate-300 text-[11px] overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(settings.general, null, 2)}
            </pre>
          </div>

          <div className="p-4 rounded-lg bg-[#06090e] border border-white/5 space-y-2">
            <div className="text-purple-400 uppercase font-bold text-[11px]">
              Security & Access Policies
            </div>
            <pre className="text-slate-300 text-[11px] overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(settings.security, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
