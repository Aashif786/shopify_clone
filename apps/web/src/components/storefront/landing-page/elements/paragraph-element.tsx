"use client";

import React from "react";
import type { PageElement } from "@calcart/stores/landing-page";

interface ParagraphElementProps {
  element: PageElement;
}

export function ParagraphElement({ element }: ParagraphElementProps) {
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

  return (
    <div
      className={`w-full ${alignClass}`}
      style={{ maxWidth: style.maxWidth || "65ch" }}
    >
      <p
        className={`${sizeClass} ${lineClass} opacity-85 transition-colors duration-150`}
        style={{ color: style.color || "var(--landing-muted, #9ca3af)" }}
      >
        {text}
      </p>
    </div>
  );
}
