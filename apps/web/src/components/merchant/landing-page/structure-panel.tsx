"use client";

import React, { useState } from "react";
import type { LandingPageSection } from "@calcart/stores/landing-page";
import { SECTION_REGISTRY } from "@/components/storefront/landing-page/registry";
import { ELEMENT_REGISTRY } from "@/components/storefront/landing-page/elements/element-registry";
import {
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Layers,
  Plus,
  Trash2,
  PanelLeftClose,
  Box,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StructurePanelProps {
  sections: LandingPageSection[];
  selectedSectionId: string | null;
  selectedElementId?: string | null;
  onSelectSection: (id: string) => void;
  onSelectElement?: (sectionId: string, elementId: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onToggleVisibility: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenAddModal: () => void;
  onOpenAddElementModal?: (sectionId: string) => void;
  onMoveElement?: (sectionId: string, elementIndex: number, direction: "up" | "down") => void;
  onDeleteElement?: (sectionId: string, elementId: string) => void;
  onClose?: () => void;
  className?: string;
}

export function StructurePanel({
  sections,
  selectedSectionId,
  selectedElementId,
  onSelectSection,
  onSelectElement,
  onMoveUp,
  onMoveDown,
  onToggleVisibility,
  onDuplicate,
  onDelete,
  onOpenAddModal,
  onOpenAddElementModal,
  onMoveElement,
  onDeleteElement,
  onClose,
  className,
}: StructurePanelProps) {
  // Keep track of which section accordion nodes are expanded
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    sections.forEach((sec) => {
      initial[sec.id] = true;
    });
    return initial;
  });

  const toggleSectionExpanded = (sectionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  return (
    <aside className={className || "w-72 shrink-0 border-r border-border bg-card/40 flex flex-col h-full overflow-hidden select-none"}>
      {/* Header */}
      <div className="p-3.5 border-b border-border flex items-center justify-between gap-2 shrink-0 bg-card/60">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-primary shrink-0" />
          <h2 className="text-xs font-bold tracking-tight uppercase font-mono truncate">Page Tree</h2>
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
            <span>Section</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Collapse tree panel"
              aria-label="Collapse tree panel"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Sections and Elements Tree */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
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
            const isSectionSelected = selectedSectionId === section.id && !selectedElementId;
            const isAnyChildSelected = selectedSectionId === section.id && !!selectedElementId;
            const isExpanded = expandedSections[section.id] ?? true;
            const elements = section.elements || [];

            return (
              <div
                key={section.id}
                className={`rounded-xl border transition-all duration-150 overflow-hidden ${
                  isSectionSelected
                    ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40"
                    : isAnyChildSelected
                      ? "border-primary/40 bg-card/70"
                      : "border-border/70 bg-card/60 hover:bg-card hover:border-border"
                } ${!section.isVisible ? "opacity-60" : ""}`}
              >
                {/* Section Header Row */}
                <div
                  onClick={() => onSelectSection(section.id)}
                  className="flex items-center gap-2 p-2 cursor-pointer group"
                >
                  {/* Expand / Collapse Chevron */}
                  <button
                    type="button"
                    onClick={(e) => toggleSectionExpanded(section.id, e)}
                    className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Section Icon */}
                  <div
                    className={`p-1.5 rounded-lg shrink-0 ${
                      isSectionSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground/80 group-hover:text-primary"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>

                  {/* Section Title */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold truncate text-foreground">
                        {section.title || def?.title || section.type}
                      </span>
                      {!section.isVisible && (
                        <span className="text-[10px] text-amber-500 font-mono">(hidden)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span className="uppercase font-mono tracking-wider">{section.type.replace(/_/g, " ")}</span>
                      {elements.length > 0 && (
                        <span>• {elements.length} {elements.length === 1 ? "element" : "elements"}</span>
                      )}
                    </div>
                  </div>

                  {/* Section Actions */}
                  <div
                    className="flex items-center gap-0.5 shrink-0 opacity-80 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => onMoveUp(idx)}
                      aria-label="Move section up"
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === sections.length - 1}
                      onClick={() => onMoveDown(idx)}
                      aria-label="Move section down"
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleVisibility(section.id)}
                      title={section.isVisible ? "Hide section" : "Show section"}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {section.isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-amber-500" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDuplicate(section.id)}
                      title="Duplicate section"
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(section.id)}
                      title="Delete section"
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Child Elements (Tree Branch) */}
                {isExpanded && (
                  <div className="bg-background/40 border-t border-border/40 pl-6 pr-2 py-1.5 space-y-1">
                    {elements.length > 0 ? (
                      elements.map((el, elIdx) => {
                        const elDef = ELEMENT_REGISTRY[el.type];
                        const ElIcon = elDef?.icon || Box;
                        const isElementSelected =
                          selectedSectionId === section.id && selectedElementId === el.id;

                        return (
                          <div
                            key={el.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectElement?.(section.id, el.id);
                            }}
                            className={`flex items-center justify-between gap-2 px-2 py-1 rounded-lg text-xs transition-colors cursor-pointer group/elem ${
                              isElementSelected
                                ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-card"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <ElIcon className="w-3 h-3 shrink-0" />
                              <span className="truncate text-[11px]">
                                {el.label || elDef?.name || el.type}
                              </span>
                            </div>

                            <div
                              className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/elem:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {onMoveElement && (
                                <>
                                  <button
                                    type="button"
                                    disabled={elIdx === 0}
                                    onClick={() => onMoveElement(section.id, elIdx, "up")}
                                    className="p-0.5 rounded hover:bg-muted/60 disabled:opacity-20 cursor-pointer"
                                  >
                                    <ChevronUp className="w-2.5 h-2.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={elIdx === elements.length - 1}
                                    onClick={() => onMoveElement(section.id, elIdx, "down")}
                                    className="p-0.5 rounded hover:bg-muted/60 disabled:opacity-20 cursor-pointer"
                                  >
                                    <ChevronDown className="w-2.5 h-2.5" />
                                  </button>
                                </>
                              )}
                              {onDeleteElement && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteElement(section.id, el.id)}
                                  className="p-0.5 rounded hover:bg-red-500/20 text-red-400 cursor-pointer"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-[11px] text-muted-foreground/60 py-1 italic">
                        No elements inside container
                      </div>
                    )}

                    {/* Quick + Add Element to this Section */}
                    {onOpenAddElementModal && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenAddElementModal(section.id);
                        }}
                        className="w-full flex items-center justify-center gap-1 py-1 px-2 text-[10px] font-semibold text-primary hover:text-primary-foreground hover:bg-primary/80 rounded-md transition-colors mt-1 border border-dashed border-primary/30"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Element</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
