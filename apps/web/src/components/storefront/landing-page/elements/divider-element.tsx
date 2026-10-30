"use client";

import React from "react";
import type { PageElement } from "@calcart/stores/landing-page";

interface DividerElementProps {
  element: PageElement;
}

export function DividerElement({ element }: DividerElementProps) {
  const content = (element.content || {}) as {
    style?: "solid" | "dashed" | "dotted" | "gradient";
    thickness?: number; // 1, 2, 4
    color?: string;
    width?: "full" | "half" | "third";
  };
  const style = element.style || {};

  const borderStyle = content.style || "solid";
  const thickness = content.thickness || 1;
  const widthMode = content.width || "full";

  const widthClasses: Record<string, string> = {
    full: "w-full",
    half: "w-1/2",
    third: "w-1/3",
  };

  const alignClasses: Record<string, string> = {
    left: "mr-auto",
    center: "mx-auto",
    right: "ml-auto",
  };

  const align = alignClasses[style.textAlign || "center"] || "mx-auto";
  const width = widthClasses[widthMode] || "w-full";

  if (borderStyle === "gradient") {
    return (
      <div className={`py-4 ${width} ${align}`}>
        <div
          className="h-[1px] w-full bg-gradient-to-r from-transparent via-border to-transparent"
          style={{ height: `${thickness}px` }}
        />
      </div>
    );
  }

  const borderStyleClass =
    borderStyle === "dashed"
      ? "border-dashed"
      : borderStyle === "dotted"
        ? "border-dotted"
        : "border-solid";

  return (
    <div className={`py-4 ${width} ${align}`}>
      <hr
        className={`border-0 border-t ${borderStyleClass} border-border/80`}
        style={{
          borderTopWidth: `${thickness}px`,
          borderColor: content.color || style.color || undefined,
        }}
      />
    </div>
  );
}
