"use client";

import React from "react";
import type { PageElement } from "@calcart/stores/landing-page";

interface ColumnsElementProps {
  element: PageElement;
  children?: React.ReactNode;
  isPreview?: boolean;
}

export function ColumnsElement({ element, children, isPreview = false }: ColumnsElementProps) {
  const content = (element.content || {}) as {
    ratio?: "50_50" | "60_40" | "40_60" | "70_30" | "30_70" | "33_33_33";
    gap?: "none" | "xs" | "sm" | "md" | "lg" | "xl";
    stackOnMobile?: boolean;
  };

  const ratio = content.ratio || "50_50";
  const gap = content.gap || "md";
  const stackOnMobile = content.stackOnMobile ?? true;

  const gapClasses: Record<string, string> = {
    none: "gap-0",
    xs: "gap-2",
    sm: "gap-4",
    md: "gap-6 sm:gap-8",
    lg: "gap-8 sm:gap-12",
    xl: "gap-12 sm:gap-16",
  };

  const ratioClasses: Record<string, string> = {
    "50_50": "grid-cols-1 md:grid-cols-2",
    "60_40": "grid-cols-1 md:grid-cols-[3fr_2fr]",
    "40_60": "grid-cols-1 md:grid-cols-[2fr_3fr]",
    "70_30": "grid-cols-1 md:grid-cols-[7fr_3fr]",
    "30_70": "grid-cols-1 md:grid-cols-[3fr_7fr]",
    "33_33_33": "grid-cols-1 md:grid-cols-3",
  };

  const mobileClass = stackOnMobile ? "" : "grid-flow-col";

  return (
    <div className={`grid w-full ${ratioClasses[ratio] || "grid-cols-1 md:grid-cols-2"} ${gapClasses[gap] || "gap-6"} ${mobileClass}`}>
      {children ? (
        children
      ) : isPreview ? (
        <>
          <div className="py-8 px-4 text-center text-xs font-mono text-muted-foreground/60 border border-dashed border-border/40 rounded-lg">
            Column 1 ({ratio.split("_")[0]}%)
          </div>
          <div className="py-8 px-4 text-center text-xs font-mono text-muted-foreground/60 border border-dashed border-border/40 rounded-lg">
            Column 2 ({ratio.split("_")[1]}%)
          </div>
        </>
      ) : null}
    </div>
  );
}
