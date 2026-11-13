"use client";

import React from "react";
import type { PageElement } from "@calcart/stores/landing-page";
import { Plus } from "lucide-react";

interface ContainerElementProps {
  element: PageElement;
  children?: React.ReactNode;
  isPreview?: boolean;
  onOpenAddElement?: () => void;
}

export function ContainerElement({ element, children, isPreview = false, onOpenAddElement }: ContainerElementProps) {
  const content = (element.content || {}) as {
    layoutMode?: "auto" | "stack" | "row" | "columns" | "grid";
    gap?: "none" | "xs" | "sm" | "md" | "lg" | "xl";
    horizontalAlignment?: "start" | "center" | "end" | "space-between";
    verticalAlignment?: "start" | "center" | "end" | "stretch";
    wrap?: boolean;
    stackOnMobile?: boolean;
    containerWidth?: "standard" | "narrow" | "wide" | "fullwidth";
    paddingY?: "none" | "sm" | "md" | "lg" | "xl";
    backgroundColor?: string;
    borderRadius?: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";
    borderWidth?: number;
    borderColor?: string;
    boxShadow?: "none" | "sm" | "md" | "lg" | "glow";
  };
  const style = element.style || {};

  const widthClasses: Record<string, string> = {
    standard: "max-w-5xl mx-auto",
    narrow: "max-w-3xl mx-auto",
    wide: "max-w-7xl mx-auto",
    fullwidth: "w-full",
  };

  const gapClasses: Record<string, string> = {
    none: "gap-0",
    xs: "gap-2",
    sm: "gap-3",
    md: "gap-4 sm:gap-6",
    lg: "gap-6 sm:gap-8",
    xl: "gap-8 sm:gap-12",
  };

  const pyClasses: Record<string, string> = {
    none: "py-0 px-0",
    sm: "py-3 px-3 sm:px-4",
    md: "py-6 px-4 sm:px-6",
    lg: "py-10 px-6 sm:px-8",
    xl: "py-14 px-8 sm:px-12",
  };

  const radiusClasses: Record<string, string> = {
    none: "rounded-none",
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    "2xl": "rounded-2xl",
    full: "rounded-full",
  };

  const shadowClasses: Record<string, string> = {
    none: "shadow-none",
    sm: "shadow-xs",
    md: "shadow-md",
    lg: "shadow-xl",
    glow: "shadow-[0_0_30px_rgba(var(--landing-primary,59,130,246),0.2)]",
  };

  const width = content.containerWidth ? widthClasses[content.containerWidth] || "w-full" : "w-full";
  const py = pyClasses[content.paddingY || (style.paddingTop as string) || "md"] || "py-4 px-4";
  const radius = radiusClasses[content.borderRadius || style.borderRadius || "xl"] || "rounded-xl";
  const shadow = shadowClasses[content.boxShadow || style.boxShadow || "none"] || "";
  const gap = gapClasses[content.gap || "md"] || gapClasses.md;

  // Determine layout classes based on element type or layoutMode
  let layoutClass = `flex flex-col ${gap}`;
  const mode = content.layoutMode || (element.type === "row" ? "row" : element.type === "grid" ? "grid" : element.type === "column" ? "stack" : "stack");

  if (mode === "row" || element.type === "row") {
    const wrapClass = content.wrap !== false ? "flex-wrap" : "flex-nowrap";
    const mobileClass = content.stackOnMobile ? "flex-col md:flex-row" : "flex-row";
    layoutClass = `flex ${mobileClass} ${wrapClass} ${gap}`;
  } else if (mode === "grid" || element.type === "grid") {
    layoutClass = `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${gap}`;
  } else if (mode === "columns" || element.type === "columns") {
    layoutClass = `grid grid-cols-1 md:grid-cols-2 ${gap}`;
  }

  // Alignments
  const hAlignClass =
    content.horizontalAlignment === "center"
      ? "justify-center"
      : content.horizontalAlignment === "end"
        ? "justify-end"
        : content.horizontalAlignment === "space-between"
          ? "justify-between"
          : "justify-start";

  const vAlignClass =
    content.verticalAlignment === "center"
      ? "items-center"
      : content.verticalAlignment === "end"
        ? "items-end"
        : content.verticalAlignment === "stretch"
          ? "items-stretch"
          : "items-start";

  return (
    <div
      className={`w-full ${width} ${py} ${radius} ${shadow} ${layoutClass} ${hAlignClass} ${vAlignClass} transition-all`}
      style={{
        backgroundColor: content.backgroundColor || style.backgroundColor || undefined,
        borderWidth: content.borderWidth ? `${content.borderWidth}px` : style.borderWidth === "thin" ? "1px" : style.borderWidth === "medium" ? "2px" : undefined,
        borderColor: content.borderColor || style.borderColor || undefined,
        minWidth: style.minWidth || undefined,
        maxWidth: style.maxWidth || undefined,
        minHeight: style.minHeight || undefined,
        maxHeight: style.maxHeight || undefined,
      }}
    >
      {children ? (
        children
      ) : isPreview ? (
        <div
          onClick={(e) => {
            if (onOpenAddElement) {
              e.stopPropagation();
              onOpenAddElement();
            }
          }}
          className="w-full py-8 px-4 text-center border-2 border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/5 rounded-none cursor-pointer flex flex-col items-center justify-center space-y-2 transition-all group"
        >
          <div className="w-8 h-8 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center text-primary transition-transform group-hover:scale-110">
            <Plus className="w-4 h-4" />
          </div>
          <p className="text-xs font-semibold text-foreground">Empty {element.label || element.type}</p>
          <p className="text-[11px] text-muted-foreground">Drag elements here or click to add</p>
        </div>
      ) : null}
    </div>
  );
}
