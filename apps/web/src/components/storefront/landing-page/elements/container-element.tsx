"use client";

import React from "react";
import type { PageElement } from "@calcart/stores/landing-page";

interface ContainerElementProps {
  element: PageElement;
  children?: React.ReactNode;
  isPreview?: boolean;
}

export function ContainerElement({ element, children, isPreview = false }: ContainerElementProps) {
  const content = (element.content || {}) as {
    containerWidth?: "standard" | "narrow" | "wide" | "fullwidth";
    paddingY?: "none" | "sm" | "md" | "lg" | "xl";
    backgroundColor?: string;
    borderRadius?: "none" | "sm" | "md" | "lg" | "xl" | "2xl";
    borderWidth?: number;
    borderColor?: string;
  };
  const style = element.style || {};

  const widthClasses: Record<string, string> = {
    standard: "max-w-5xl mx-auto",
    narrow: "max-w-3xl mx-auto",
    wide: "max-w-7xl mx-auto",
    fullwidth: "w-full",
  };

  const pyClasses: Record<string, string> = {
    none: "py-0 px-0",
    sm: "py-4 px-4 sm:px-6",
    md: "py-8 px-6 sm:px-8",
    lg: "py-12 px-8 sm:px-12",
    xl: "py-16 px-8 sm:px-16",
  };

  const radiusClasses: Record<string, string> = {
    none: "rounded-none",
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    "2xl": "rounded-2xl",
  };

  const width = widthClasses[content.containerWidth || "standard"] || "max-w-5xl mx-auto";
  const py = pyClasses[content.paddingY || "md"] || "py-8 px-6";
  const radius = radiusClasses[content.borderRadius || "xl"] || "rounded-xl";

  return (
    <div
      className={`w-full ${width} ${py} ${radius} transition-all`}
      style={{
        backgroundColor: content.backgroundColor || style.backgroundColor || undefined,
        borderWidth: content.borderWidth ? `${content.borderWidth}px` : undefined,
        borderColor: content.borderColor || style.borderColor || undefined,
      }}
    >
      {children ? (
        children
      ) : isPreview ? (
        <div className="py-6 text-center text-xs font-mono text-muted-foreground/60 border border-dashed border-border/40 rounded-lg">
          Nested Container Block
        </div>
      ) : null}
    </div>
  );
}
