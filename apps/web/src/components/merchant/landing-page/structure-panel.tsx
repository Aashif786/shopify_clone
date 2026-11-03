"use client";

import React, { useState, useEffect } from "react";
import type { LandingPageSection, PageElement, ElementType } from "@calcart/stores/landing-page";
import { isContainerElement, findParentInTree } from "@calcart/stores/landing-page";
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
  GripVertical,
  FolderMinus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface StructurePanelProps {
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
  onOpenAddElementModal?: (sectionId: string, parentElementId?: string) => void;
  onMoveElement?: (
    sectionId: string,
    sourceId: string,
    targetId: string,
    position: "before" | "after" | "inside" | "beside-left" | "beside-right",
  ) => void;
  onDuplicateElement?: (sectionId: string, elementId: string) => void;
  onDeleteElement?: (sectionId: string, elementId: string, unwrapChildren?: boolean) => void;
  onClose?: () => void;
  className?: string;
}

function getContainerBadge(type: ElementType): { label: string; className: string } | null {
  switch (type) {
    case "row":
      return { label: "Row", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" };
    case "column":
      return { label: "Col", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
    case "grid":
      return { label: "Grid", className: "bg-purple-500/10 text-purple-400 border-purple-500/20" };
    case "stack":
      return { label: "Stack", className: "bg-orange-500/10 text-orange-400 border-orange-500/20" };
    case "columns":
      return { label: "Columns", className: "bg-teal-500/10 text-teal-400 border-teal-500/20" };
    case "container":
      return { label: "Box", className: "bg-sky-500/10 text-sky-400 border-sky-500/20" };
    default:
      return null;
  }
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
  onDuplicateElement,
  onDeleteElement,
  onClose,
  className,
}: StructurePanelProps) {
  // Track expanded state for sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    sections.forEach((sec) => {
      initial[sec.id] = true;
    });
    return initial;
  });

  // Track expanded state for container elements
  const [expandedContainers, setExpandedContainers] = useState<Record<string, boolean>>({});

  // Drag and drop state within the tree
  const [draggedElementId, setDraggedElementId] = useState<string | null>(null);
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<"before" | "after" | "inside" | null>(null);

  // Auto-expand ancestors when selectedElementId changes
  useEffect(() => {
    if (!selectedElementId || !selectedSectionId) return;
    const sec = sections.find((s) => s.id === selectedSectionId);
    if (!sec || !sec.elements) return;

    let currentId: string | null = selectedElementId;
    const toExpand: Record<string, boolean> = {};

    while (currentId) {
      const parentInfo = findParentInTree(sec.elements, currentId);
      if (parentInfo?.parent) {
        toExpand[parentInfo.parent.id] = true;
        currentId = parentInfo.parent.id;
      } else {
        break;
      }
    }

    if (Object.keys(toExpand).length > 0) {
      setExpandedContainers((prev) => ({ ...prev, ...toExpand }));
    }
  }, [selectedElementId, selectedSectionId, sections]);

  const toggleSectionExpanded = (sectionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const toggleContainerExpanded = (elementId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedContainers((prev) => ({
      ...prev,
      [elementId]: prev[elementId] === undefined ? false : !prev[elementId],
    }));
  };

  return (
    <aside
      className={
        className ||
        "w-72 shrink-0 border-r border-border bg-card/40 flex flex-col h-full overflow-hidden select-none"
      }
    >
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

                {/* Child Elements (Hierarchical Tree Branch) */}
                {isExpanded && (
                  <div className="bg-background/40 border-t border-border/40 pl-3 pr-2 py-1.5 space-y-1">
                    {elements.length > 0 ? (
                      elements.map((el, elIdx, allTopElements) => {
                        const renderElementRow = (
                          item: PageElement,
                          itemIdx: number,
                          siblings: PageElement[],
                          depth = 0,
                        ): React.ReactNode => {
                          const elDef = ELEMENT_REGISTRY[item.type as ElementType];
                          const ElIcon = elDef?.icon || Box;
                          const isElementSelected =
                            selectedSectionId === section.id && selectedElementId === item.id;
                          const isContainer = isContainerElement(item.type);
                          const containerBadge = getContainerBadge(item.type);
                          const hasChildren = Array.isArray(item.children) && item.children.length > 0;
                          const isContainerOpen = expandedContainers[item.id] !== false; // default open

                          const isDraggedOver = dragOverTargetId === item.id;
                          const dropBorderClass =
                            isDraggedOver && dragOverZone === "before"
                              ? "border-t-2 border-primary"
                              : isDraggedOver && dragOverZone === "after"
                                ? "border-b-2 border-primary"
                                : isDraggedOver && dragOverZone === "inside"
                                  ? "bg-primary/20 ring-1 ring-primary"
                                  : "";

                          return (
                            <React.Fragment key={item.id}>
                              <div
                                draggable
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  setDraggedElementId(item.id);
                                  e.dataTransfer.setData("text/calcart-tree-element", item.id);
                                  e.dataTransfer.effectAllowed = "move";
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  e.dataTransfer.dropEffect = "move";

                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const relY = (e.clientY - rect.top) / rect.height;

                                  let zone: "before" | "after" | "inside";
                                  if (isContainer && relY >= 0.25 && relY <= 0.75) {
                                    zone = "inside";
                                  } else if (relY < 0.35) {
                                    zone = "before";
                                  } else {
                                    zone = "after";
                                  }

                                  setDragOverTargetId(item.id);
                                  setDragOverZone(zone);
                                }}
                                onDragLeave={(e) => {
                                  e.stopPropagation();
                                  if (dragOverTargetId === item.id) {
                                    setDragOverTargetId(null);
                                    setDragOverZone(null);
                                  }
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const sourceId =
                                    e.dataTransfer.getData("text/calcart-tree-element") || draggedElementId;
                                  const zone = dragOverZone;

                                  setDraggedElementId(null);
                                  setDragOverTargetId(null);
                                  setDragOverZone(null);

                                  if (sourceId && sourceId !== item.id && onMoveElement) {
                                    onMoveElement(
                                      section.id,
                                      sourceId,
                                      item.id,
                                      zone || (isContainer ? "inside" : "after"),
                                    );
                                  }
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectElement?.(section.id, item.id);
                                }}
                                style={{ paddingLeft: `${depth * 14 + 6}px` }}
                                className={`flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-all cursor-pointer group/elem relative ${dropBorderClass} ${
                                  isElementSelected
                                    ? "bg-primary text-primary-foreground font-semibold shadow-2xs ring-1 ring-primary"
                                    : "text-muted-foreground hover:text-foreground hover:bg-card/90"
                                }`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  {/* Container Expand / Collapse Chevron */}
                                  {isContainer ? (
                                    <button
                                      type="button"
                                      onClick={(e) => toggleContainerExpanded(item.id, e)}
                                      className="p-0.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                      title={isContainerOpen ? "Collapse container" : "Expand container"}
                                    >
                                      {isContainerOpen ? (
                                        <ChevronDown className="w-3 h-3" />
                                      ) : (
                                        <ChevronRight className="w-3 h-3" />
                                      )}
                                    </button>
                                  ) : (
                                    <GripVertical className="w-2.5 h-2.5 opacity-40 shrink-0 cursor-grab" />
                                  )}

                                  <ElIcon className="w-3 h-3 shrink-0" />
                                  <span className="truncate text-[11px] font-medium">
                                    {item.label || elDef?.name || item.type}
                                  </span>

                                  {/* Container Mode Badge */}
                                  {containerBadge && (
                                    <span
                                      className={`text-[9px] px-1 py-0 rounded border font-mono uppercase tracking-wider shrink-0 ${containerBadge.className}`}
                                    >
                                      {containerBadge.label}
                                    </span>
                                  )}
                                </div>

                                {/* Hover Action Buttons */}
                                <div
                                  className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/elem:opacity-100 transition-opacity"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {/* Container Quick + Add Child */}
                                  {isContainer && onOpenAddElementModal && (
                                    <button
                                      type="button"
                                      onClick={() => onOpenAddElementModal(section.id, item.id)}
                                      title={`Add element into ${containerBadge?.label || "container"}`}
                                      className="p-1 rounded hover:bg-primary/20 text-primary cursor-pointer transition-colors"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  )}

                                  {/* Sibling Reordering (Up / Down) */}
                                  {onMoveElement && siblings.length > 1 && (
                                    <>
                                      <button
                                        type="button"
                                        disabled={itemIdx === 0}
                                        onClick={() => {
                                          const prevSibling = siblings[itemIdx - 1];
                                          if (prevSibling) {
                                            onMoveElement(section.id, item.id, prevSibling.id, "before");
                                          }
                                        }}
                                        title="Move up"
                                        className="p-0.5 rounded hover:bg-muted/80 disabled:opacity-20 cursor-pointer"
                                      >
                                        <ChevronUp className="w-2.5 h-2.5" />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={itemIdx === siblings.length - 1}
                                        onClick={() => {
                                          const nextSibling = siblings[itemIdx + 1];
                                          if (nextSibling) {
                                            onMoveElement(section.id, item.id, nextSibling.id, "after");
                                          }
                                        }}
                                        title="Move down"
                                        className="p-0.5 rounded hover:bg-muted/80 disabled:opacity-20 cursor-pointer"
                                      >
                                        <ChevronDown className="w-2.5 h-2.5" />
                                      </button>
                                    </>
                                  )}

                                  {/* Duplicate Action */}
                                  {onDuplicateElement && (
                                    <button
                                      type="button"
                                      onClick={() => onDuplicateElement(section.id, item.id)}
                                      title="Duplicate element"
                                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                                    >
                                      <Copy className="w-2.5 h-2.5" />
                                    </button>
                                  )}

                                  {/* Unwrap Children Action (for Containers) */}
                                  {isContainer && hasChildren && onDeleteElement && (
                                    <button
                                      type="button"
                                      onClick={() => onDeleteElement(section.id, item.id, true)}
                                      title="Unwrap children (keep contents)"
                                      className="p-1 rounded hover:bg-amber-500/20 text-amber-400 cursor-pointer"
                                    >
                                      <FolderMinus className="w-2.5 h-2.5" />
                                    </button>
                                  )}

                                  {/* Delete Action */}
                                  {onDeleteElement && (
                                    <button
                                      type="button"
                                      onClick={() => onDeleteElement(section.id, item.id, false)}
                                      title="Delete element"
                                      className="p-1 rounded hover:bg-destructive/20 text-destructive cursor-pointer"
                                    >
                                      <Trash2 className="w-2.5 h-2.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Render Nested Children */}
                              {isContainer && isContainerOpen && Array.isArray(item.children) && (
                                <div className="space-y-0.5 relative">
                                  {item.children.length > 0 ? (
                                    item.children.map((child: PageElement, childIdx: number) =>
                                      renderElementRow(child, childIdx, item.children || [], depth + 1),
                                    )
                                  ) : (
                                    <div
                                      style={{ paddingLeft: `${(depth + 1) * 14 + 10}px` }}
                                      className="text-[10px] text-muted-foreground/60 py-1 italic"
                                    >
                                      Empty container
                                    </div>
                                  )}
                                </div>
                              )}
                            </React.Fragment>
                          );
                        };

                        return renderElementRow(el, elIdx, allTopElements, 0);
                      })
                    ) : (
                      <div className="text-[11px] text-muted-foreground/60 py-1.5 italic text-center">
                        No elements in section
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
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 text-[11px] font-semibold text-primary hover:text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors mt-2 border border-dashed border-primary/30 cursor-pointer shadow-2xs"
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
