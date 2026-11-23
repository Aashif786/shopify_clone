"use client";

import React from "react";
import type { PageElement } from "@calcart/stores/landing-page";
import { resolveFontFamily } from "@/lib/font-library";

interface ParagraphElementProps {
  element: PageElement;
  isPreview?: boolean;
  isSelected?: boolean;
  onUpdateElement?: (element: PageElement) => void;
}

export function ParagraphElement({
  element,
  isPreview = false,
  isSelected = false,
  onUpdateElement,
}: ParagraphElementProps) {
  const content = (element.content || {}) as {
    text?: string;
  };
  const style = element.style || {};

  const text = content.text || "Write your paragraph text here...";

  const sizeClasses: Record<string, string> = {
    xs: "text-xs",
    sm: "text-sm",
    base: "text-base",
    lg: "text-lg",
    xl: "text-xl",
  };

  const alignClasses: Record<string, string> = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
    justify: "text-justify",
  };

  const lineHeightClasses: Record<string, string> = {
    tight: "leading-tight",
    normal: "leading-normal",
    relaxed: "leading-relaxed",
    loose: "leading-loose",
  };

  const sizeClass = style.fontSize ? sizeClasses[style.fontSize] || sizeClasses.base : sizeClasses.base;
  const alignClass = style.textAlign ? alignClasses[style.textAlign] || alignClasses.left : alignClasses.left;
  const lineClass = style.lineHeight ? lineHeightClasses[style.lineHeight] || lineHeightClasses.relaxed : lineHeightClasses.relaxed;

  const marginClass =
    style.textAlign === "center"
      ? "mx-auto"
      : style.textAlign === "right"
        ? "ml-auto"
        : "";

  const handleBlur = (e: React.FocusEvent<HTMLParagraphElement>) => {
    if (!isPreview || !onUpdateElement) return;
    const newText = e.currentTarget.textContent || "";
    if (newText !== text) {
      onUpdateElement({
        ...element,
        content: {
          ...(element.content as Record<string, unknown>),
          text: newText,
        },
      });
    }
  };

  return (
    <div
      className={`w-full ${alignClass} ${marginClass}`}
      style={{ maxWidth: style.maxWidth || undefined }}
    >
      <p
        contentEditable={isPreview && isSelected}
        suppressContentEditableWarning={true}
        onBlur={handleBlur}
        className={`${sizeClass} ${lineClass} opacity-85 transition-colors duration-150 ${
          isPreview && isSelected ? "outline-none ring-1 ring-primary/40 rounded-xs px-1 cursor-text" : ""
        }`}
        style={{
          color: style.color || "var(--landing-muted, #9ca3af)",
          fontFamily: style.fontFamily ? resolveFontFamily(style.fontFamily) : "var(--landing-font-body, inherit)",
        }}
      >
        {text}
      </p>
    </div>
  );
}
