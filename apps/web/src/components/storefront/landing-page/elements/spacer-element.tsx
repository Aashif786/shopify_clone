"use client";

import React from "react";
import type { PageElement } from "@calcart/stores/landing-page";

interface SpacerElementProps {
  element: PageElement;
  isPreview?: boolean;
}

export function SpacerElement({ element, isPreview = false }: SpacerElementProps) {
  const content = (element.content || {}) as {
    height?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  };

  const heightClasses: Record<string, string> = {
    xs: "h-3",
    sm: "h-6",
    md: "h-12",
    lg: "h-20",
    xl: "h-32",
    "2xl": "h-48",
  };

  const height = heightClasses[content.height || "md"] || "h-12";

  return (
    <div
      className={`w-full ${height} ${
        isPreview ? "relative border border-dashed border-border/30 flex items-center justify-center" : ""
      }`}
    >
      {isPreview && (
        <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground/40 select-none">
          Spacer ({content.height || "md"})
        </span>
      )}
    </div>
  );
}
