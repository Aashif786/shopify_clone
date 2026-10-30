"use client";

import React from "react";
import type { PageElement } from "@calcart/stores/landing-page";

interface HeadingElementProps {
  element: PageElement;
}

export function HeadingElement({ element }: HeadingElementProps) {
  const content = (element.content || {}) as {
    text?: string;
    level?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    eyebrow?: string;
  };
  const style = element.style || {};

  const Tag = content.level || "h2";
  const text = content.text || "Heading Text";

  const sizeClasses: Record<string, string> = {
    xs: "text-xs",
    sm: "text-sm",
    base: "text-base",
    lg: "text-lg md:text-xl",
    xl: "text-xl md:text-2xl",
    "2xl": "text-2xl md:text-3xl",
    "3xl": "text-3xl md:text-4xl",
    "4xl": "text-4xl md:text-5xl",
    "5xl": "text-4xl md:text-6xl",
    "6xl": "text-5xl md:text-7xl",
  };

  const weightClasses: Record<string, string> = {
    normal: "font-normal",
    medium: "font-medium",
    semibold: "font-semibold",
    bold: "font-bold",
    extrabold: "font-extrabold",
  };

  const alignClasses: Record<string, string> = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
    justify: "text-justify",
  };

  const fontClasses: Record<string, string> = {
    sans: "font-sans",
    serif: "font-serif",
    mono: "font-mono",
    display: "font-sans tracking-tight",
  };

  const sizeClass = style.fontSize ? sizeClasses[style.fontSize] || sizeClasses["3xl"] : sizeClasses["3xl"];
  const weightClass = style.fontWeight ? weightClasses[style.fontWeight] || weightClasses["bold"] : weightClasses["bold"];
  const alignClass = style.textAlign ? alignClasses[style.textAlign] || alignClasses["left"] : alignClasses["left"];
  const fontClass = style.fontFamily ? fontClasses[style.fontFamily] || "" : "";

  return (
    <div
      className={`w-full ${alignClass}`}
      style={{ maxWidth: style.maxWidth || undefined }}
    >
      {content.eyebrow && (
        <span className="inline-block text-xs font-semibold tracking-wider uppercase text-primary mb-2 opacity-90">
          {content.eyebrow}
        </span>
      )}
      <Tag
        className={`tracking-tight leading-tight ${sizeClass} ${weightClass} ${fontClass} transition-colors duration-150`}
        style={{ color: style.color || "inherit" }}
      >
        {text}
      </Tag>
    </div>
  );
}
