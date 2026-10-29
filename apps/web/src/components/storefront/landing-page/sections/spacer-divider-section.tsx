"use client";

import React from "react";
import type { StorefrontLandingSectionProps } from "../types";

export interface SpacerDividerSectionConfig {
  height?: "sm" | "md" | "lg" | "xl";
  showLine?: boolean;
  style?: "solid" | "dashed" | "gradient";
}

export function SpacerDividerSection({
  section,
}: StorefrontLandingSectionProps) {
  const cfg = (section.config || {}) as SpacerDividerSectionConfig;
  const height = cfg.height || "md"; // "sm" | "md" | "lg" | "xl"
  const showLine = cfg.showLine ?? false;
  const style = cfg.style || "solid"; // "solid" | "dashed" | "gradient"

  const heightClass =
    height === "sm"
      ? "py-4 sm:py-6"
      : height === "lg"
        ? "py-12 sm:py-16"
        : height === "xl"
          ? "py-16 sm:py-24"
          : "py-8 sm:py-10";

  return (
    <section className={`storefront-spacer max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${heightClass}`}>
      {showLine && (
        <div
          className={`w-full ${
            style === "dashed"
              ? "border-b border-dashed border-[var(--landing-border)]"
              : style === "gradient"
                ? "h-px bg-gradient-to-r from-transparent via-[var(--landing-border)] to-transparent"
                : "border-b border-[var(--landing-border)]"
          }`}
        />
      )}
    </section>
  );
}
