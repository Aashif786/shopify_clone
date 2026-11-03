"use client";

import React from "react";
import type { HistoryEntry } from "./use-editor-history";
import { History, Undo2, Redo2, X, Clock, CheckCircle2, CircleDot, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  past: HistoryEntry[];
  future: HistoryEntry[];
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onJumpToPast: (index: number) => void;
  onJumpToFuture: (index: number) => void;
}

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 10) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  return `${diffHours}h ago`;
}

function getCategoryBadge(category: HistoryEntry["category"]): { label: string; className: string } {
  switch (category) {
    case "element":
      return { label: "Element", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" };
    case "layout":
      return { label: "Layout", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
    case "section":
      return { label: "Section", className: "bg-purple-500/10 text-purple-400 border-purple-500/20" };
    case "theme":
      return { label: "Theme", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
    default:
      return { label: "Edit", className: "bg-muted text-muted-foreground" };
  }
}

export function HistoryPanel({
  isOpen,
  onClose,
  past,
  future,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onJumpToPast,
  onJumpToFuture,
}: HistoryPanelProps) {
  if (!isOpen) return null;

  const totalSteps = past.length + future.length + 1;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-80 sm:w-96 bg-card border-l border-border shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 select-none">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-card/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold tracking-tight">Editing History</h2>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono">
            {past.length} changes
          </Badge>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          title="Close history"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Action Toolbar */}
      <div className="px-4 py-2.5 border-b border-border/60 bg-muted/20 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted active:scale-95 transition-all disabled:opacity-40 shadow-xs cursor-pointer"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-3.5 h-3.5" />
          <span>Undo</span>
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted active:scale-95 transition-all disabled:opacity-40 shadow-xs cursor-pointer"
          title="Redo (Ctrl+Shift+Z / Ctrl+Y)"
        >
          <Redo2 className="w-3.5 h-3.5" />
          <span>Redo</span>
        </button>
      </div>

      {/* History Timeline */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {totalSteps === 1 && (
          <div className="py-12 px-4 text-center border border-dashed border-border rounded-xl">
            <Clock className="w-8 h-8 opacity-30 mx-auto mb-2 text-muted-foreground" />
            <p className="text-xs font-semibold text-foreground">Clean Session</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Make edits in the editor or canvas to create history snapshots.
            </p>
          </div>
        )}

        {/* Future Actions (Redoable) */}
        {future.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 px-1">
              Redoable Actions
            </span>
            {future.map((entry, idx) => {
              const badge = getCategoryBadge(entry.category);
              return (
                <div
                  key={entry.id}
                  onClick={() => onJumpToFuture(idx)}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-dashed border-border/70 bg-card/30 opacity-70 hover:opacity-100 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CircleDot className="w-3.5 h-3.5 text-muted-foreground shrink-0 group-hover:text-primary" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{entry.description}</p>
                      <span className="text-[10px] text-muted-foreground">{formatRelativeTime(entry.timestamp)}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 shrink-0 font-mono ${badge.className}`}>
                    {badge.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}

        {/* Present State (Current) */}
        <div className="p-3 rounded-xl border-2 border-primary bg-primary/10 shadow-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="text-xs font-bold text-foreground">Current State</p>
              <p className="text-[10px] text-muted-foreground">Active in builder workspace</p>
            </div>
          </div>
          <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider">
            Now
          </Badge>
        </div>

        {/* Past Actions (Undoable) */}
        {past.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 px-1">
              Previous Actions
            </span>
            {[...past].reverse().map((entry, revIdx) => {
              const originalIdx = past.length - 1 - revIdx;
              const badge = getCategoryBadge(entry.category);
              return (
                <div
                  key={entry.id}
                  onClick={() => onJumpToPast(originalIdx)}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-border/80 bg-card/60 hover:border-primary/60 hover:bg-card transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0 group-hover:text-primary" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{entry.description}</p>
                      <span className="text-[10px] text-muted-foreground">{formatRelativeTime(entry.timestamp)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 font-mono ${badge.className}`}>
                      {badge.label}
                    </Badge>
                    <ArrowRight className="w-3 h-3 text-muted-foreground/40 group-hover:text-primary transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Notes */}
      <div className="p-3 border-t border-border bg-card/80 text-[10px] text-muted-foreground font-mono flex items-center justify-between">
        <span>Ctrl+Z (Undo)</span>
        <span>Ctrl+Shift+Z (Redo)</span>
      </div>
    </div>
  );
}
