"use client";

import React from "react";
import type { LandingPageSection } from "@calcart/stores/landing-page";
import { SECTION_REGISTRY } from "@/components/storefront/landing-page/registry";
import {
  ChevronUp,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  Layers,
  Plus,
  Trash2,
  PanelLeftClose,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StructurePanelProps {
  sections: LandingPageSection[];
  selectedSectionId: string | null;
  onSelectSection: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onToggleVisibility: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenAddModal: () => void;
  onClose?: () => void;
  className?: string;
}

export function StructurePanel({
  sections,
  selectedSectionId,
  onSelectSection,
  onMoveUp,
  onMoveDown,
  onToggleVisibility,
  onDuplicate,
  onDelete,
  onOpenAddModal,
  onClose,
  className,
}: StructurePanelProps) {
  return (
    <aside className={className || "w-72 shrink-0 border-r border-border bg-card/40 flex flex-col h-full overflow-hidden"}>
      {/* Header */}
      <div className="p-3.5 border-b border-border flex items-center justify-between gap-2 shrink-0 bg-card/60">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-primary shrink-0" />
          <h2 className="text-xs font-bold tracking-tight uppercase font-mono truncate">Sections</h2>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0 font-mono">
            {sections.length}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-xs cursor-pointer"
            title="Add section"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Collapse sections panel"
              aria-label="Collapse sections panel"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Sections List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sections.length === 0 ? (
          <div className="py-12 px-4 text-center border border-dashed border-border rounded-xl">
            <p className="text-xs text-muted-foreground mb-3">No sections on page yet.</p>
            <button
              type="button"
              onClick={onOpenAddModal}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Add your first section
            </button>
          </div>
        ) : (
          sections.map((section, idx) => {
            const def = SECTION_REGISTRY[section.type];
            const Icon = def?.icon || Layers;
            const isSelected = selectedSectionId === section.id;

            return (
              <div
                key={section.id}
                onClick={() => onSelectSection(section.id)}
                className={`group relative flex items-center gap-2.5 p-2.5 rounded-xl border transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40"
                    : "border-border/70 bg-card/60 hover:bg-card hover:border-border"
                } ${!section.isVisible ? "opacity-60" : ""}`}
              >
                {/* Drag / Order Arrows */}
                <div className="flex flex-col items-center gap-0.5 shrink-0 text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => onMoveUp(idx)}
                    aria-label="Move section up"
                    className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:hover:bg-transparent"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === sections.length - 1}
                    onClick={() => onMoveDown(idx)}
                    aria-label="Move section down"
                    className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:hover:bg-transparent"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Section Icon */}
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground/80 group-hover:text-primary"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                {/* Title & Type */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold truncate text-foreground">
                      {section.title || def?.title || section.type}
                    </span>
                    {!section.isVisible && (
                      <span className="text-[10px] text-amber-500 font-mono">(hidden)</span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
                    {section.type.replace(/_/g, " ")}
                  </span>
                </div>

                {/* Row Quick Action Buttons */}
                <div
                  className="flex items-center gap-1 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => onToggleVisibility(section.id)}
                    title={section.isVisible ? "Hide section" : "Show section"}
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                  >
                    {section.isVisible ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-amber-500" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onDuplicate(section.id)}
                    title="Duplicate section"
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onDelete(section.id)}
                    title="Delete section"
                    className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
