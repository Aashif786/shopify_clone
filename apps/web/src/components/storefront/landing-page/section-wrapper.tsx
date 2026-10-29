"use client";

import React, { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { LandingPageSection, LandingPageTheme } from "@shopify-clone/stores/landing-page";
import { EyeOff } from "lucide-react";

export interface SectionWrapperProps {
  section: LandingPageSection;
  children: React.ReactNode;
  isPreview?: boolean;
  isSelected?: boolean;
  onSelect?: (sectionId: string) => void;
  theme?: LandingPageTheme;
}

const SMOOTH_EASE = [0.16, 1, 0.3, 1] as const;

export function SectionWrapper({
  section,
  children,
  isPreview = false,
  isSelected = false,
  onSelect,
  theme,
}: SectionWrapperProps) {
  const shouldReduceMotion = useReducedMotion();
  const animationsEnabled = theme?.animations?.enabled ?? true;
  const animationPreset = section.animation?.preset || "none";
  const intensity = section.animation?.intensity || theme?.animations?.intensity || "medium";

  // Calculate motion variants
  const motionProps = useMemo(() => {
    if (shouldReduceMotion || !animationsEnabled || animationPreset === "none") {
      return {};
    }

    const duration = intensity === "subtle" ? 0.35 : intensity === "expressive" ? 0.65 : 0.5;
    const distance = intensity === "subtle" ? 16 : intensity === "expressive" ? 36 : 24;

    switch (animationPreset) {
      case "fade-up":
        return {
          initial: { opacity: 0, y: distance },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-40px" },
          transition: { duration, ease: SMOOTH_EASE },
        };
      case "fade-in":
        return {
          initial: { opacity: 0 },
          whileInView: { opacity: 1 },
          viewport: { once: true, margin: "-40px" },
          transition: { duration, ease: "easeOut" as const },
        };
      case "scale-in":
        return {
          initial: { opacity: 0, scale: 0.96 },
          whileInView: { opacity: 1, scale: 1 },
          viewport: { once: true, margin: "-40px" },
          transition: { duration, ease: SMOOTH_EASE },
        };
      case "slide":
        return {
          initial: { opacity: 0, x: -distance },
          whileInView: { opacity: 1, x: 0 },
          viewport: { once: true, margin: "-40px" },
          transition: { duration, ease: SMOOTH_EASE },
        };
      default:
        return {};
    }
  }, [shouldReduceMotion, animationsEnabled, animationPreset, intensity]);

  if (!section.isVisible && !isPreview) {
    return null;
  }


  return (
    <div
      id={`section-${section.id}`}
      data-section-id={section.id}
      data-section-type={section.type}
      onClick={isPreview && onSelect ? () => onSelect(section.id) : undefined}
      className={`relative transition-all duration-200 ${
        isPreview ? "cursor-pointer group select-none" : ""
      } ${
        isPreview && isSelected
          ? "ring-2 ring-primary ring-offset-2 ring-offset-background z-20"
          : isPreview
            ? "hover:ring-1 hover:ring-primary/50"
            : ""
      } ${!section.isVisible && isPreview ? "opacity-45 bg-muted/20 border-y border-dashed border-border" : ""}`}
    >
      {/* Visual Editor Hover / Selected Badge in Preview Mode */}
      {isPreview && (
        <div
          className={`absolute top-2 right-2 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide transition-opacity duration-150 ${
            isSelected
              ? "bg-primary text-primary-foreground shadow-md opacity-100"
              : "bg-background/90 text-foreground border border-border shadow-xs opacity-0 group-hover:opacity-100"
          }`}
        >
          {!section.isVisible && (
            <span className="flex items-center gap-1 text-amber-500 font-normal">
              <EyeOff className="w-3 h-3" />
              <span>Hidden</span>
              <span>•</span>
            </span>
          )}
          <span>{section.title || section.type}</span>
          {isSelected && <span className="opacity-75 text-[10px] uppercase font-mono">(Editing)</span>}
        </div>
      )}

      {/* Animated or Standard Section Body */}
      {Object.keys(motionProps).length > 0 ? (
        <motion.div {...motionProps}>{children}</motion.div>
      ) : (
        <div>{children}</div>
      )}
    </div>
  );
}
