"use client";

import React, { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { LandingPageSection, LandingPageTheme } from "@calcart/stores/landing-page";
import type { ProductSummaryDTO } from "@calcart/products";
import { EyeOff, Smartphone, Monitor } from "lucide-react";
import { SectionElementsLayout } from "./elements/section-elements-layout";

export interface SectionWrapperProps {
  section: LandingPageSection;
  children: React.ReactNode;
  isPreview?: boolean;
  isSelected?: boolean;
  selectedElementId?: string | null;
  onSelect?: (sectionId: string) => void;
  onSelectElement?: (sectionId: string, elementId: string) => void;
  onOpenAddElement?: (sectionId: string) => void;
  theme?: LandingPageTheme;
  storeSlug?: string;
  storeName?: string;
  storeCurrency?: string;
  products?: ProductSummaryDTO[];
  collections?: Array<{ id: string; name: string; slug?: string; imageUrl?: string; productCount?: number }>;
}

const SMOOTH_EASE = [0.16, 1, 0.3, 1] as const;

export function SectionWrapper({
  section,
  children,
  isPreview = false,
  isSelected = false,
  selectedElementId,
  onSelect,
  onSelectElement,
  onOpenAddElement,
  theme,
  storeSlug = "",
  storeName,
  storeCurrency = "USD",
  products = [],
  collections = [],
}: SectionWrapperProps) {
  const shouldReduceMotion = useReducedMotion();
  const animationsEnabled = theme?.animations?.enabled ?? true;
  const animationPreset = section.animation?.preset || "none";
  const intensity = section.animation?.intensity || theme?.animations?.intensity || "medium";
  const styles = section.styles;
  const secBg = styles?.background;

  // Responsive hide rules
  const hideOnMobile = styles?.hideOnMobile ?? false;
  const hideOnDesktop = styles?.hideOnDesktop ?? false;

  // Motion variants
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

  // Live storefront hide
  if (!isPreview) {
    if (hideOnMobile && hideOnDesktop) return null;
  }

  // Padding classes
  const ptMap: Record<string, string> = {
    none: "pt-0",
    xs: "pt-2 sm:pt-4",
    sm: "pt-4 sm:pt-8",
    md: "pt-8 sm:pt-12",
    lg: "pt-12 sm:pt-20",
    xl: "pt-16 sm:pt-28",
    "2xl": "pt-24 sm:pt-36",
  };
  const pbMap: Record<string, string> = {
    none: "pb-0",
    xs: "pb-2 sm:pb-4",
    sm: "pb-4 sm:pb-8",
    md: "pb-8 sm:pb-12",
    lg: "pb-12 sm:pb-20",
    xl: "pb-16 sm:pb-28",
    "2xl": "pb-24 sm:pb-36",
  };

  const ptClass = styles?.paddingTop ? ptMap[styles.paddingTop] || "" : "";
  const pbClass = styles?.paddingBottom ? pbMap[styles.paddingBottom] || "" : "";

  // Radius & Shadow
  const radiusMap: Record<string, string> = {
    none: "rounded-none",
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    "2xl": "rounded-2xl",
    full: "rounded-full",
  };
  const radiusClass = styles?.borderRadius ? radiusMap[styles.borderRadius] || "" : "";

  const shadowMap: Record<string, string> = {
    none: "shadow-none",
    sm: "shadow-xs",
    md: "shadow-md",
    lg: "shadow-lg",
    xl: "shadow-2xl",
    glow: "shadow-[0_0_40px_rgba(var(--landing-primary),0.2)]",
  };
  const shadowClass = styles?.boxShadow ? shadowMap[styles.boxShadow] || "" : "";

  // Alignment
  const alignClass =
    styles?.alignment === "center"
      ? "text-center"
      : styles?.alignment === "right"
        ? "text-right"
        : "";

  // Responsive display classes
  const responsiveClasses = [
    hideOnMobile ? (isPreview ? "opacity-75 ring-1 ring-amber-500/30" : "hidden md:block") : "",
    hideOnDesktop ? (isPreview ? "opacity-75 ring-1 ring-sky-500/30" : "md:hidden") : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Determine whether to render dynamic elements layout or legacy section component
  const hasElements = Array.isArray(section.elements) && section.elements.length > 0;
  const isCustomContainer = section.type === "custom_container";

  const renderedContent =
    hasElements || isCustomContainer ? (
      <SectionElementsLayout
        section={section}
        storeSlug={storeSlug}
        storeName={storeName}
        storeCurrency={storeCurrency}
        products={products}
        collections={collections}
        isPreview={isPreview}
        selectedElementId={selectedElementId}
        onSelectElement={onSelectElement}
        onOpenAddElement={onOpenAddElement}
        theme={theme}
      />
    ) : (
      children
    );

  return (
    <div
      id={`section-${section.id}`}
      data-section-id={section.id}
      data-section-type={section.type}
      onClick={isPreview && onSelect ? () => onSelect(section.id) : undefined}
      className={`relative w-full transition-all duration-200 overflow-hidden ${ptClass} ${pbClass} ${radiusClass} ${shadowClass} ${alignClass} ${responsiveClasses} ${
        isPreview ? "cursor-pointer group select-none" : ""
      } ${
        isPreview && isSelected
          ? "ring-2 ring-primary ring-offset-2 ring-offset-background z-20"
          : isPreview
            ? "hover:ring-1 hover:ring-primary/50"
            : ""
      } ${!section.isVisible && isPreview ? "opacity-45 bg-muted/20 border-y border-dashed border-border" : ""}`}
      style={{
        backgroundColor:
          secBg?.type === "color" && secBg.color ? secBg.color : undefined,
        background:
          secBg?.type === "gradient" && secBg.gradient ? secBg.gradient : undefined,
      }}
    >
      {/* Section-level Image Background Layer */}
      {secBg && secBg.type === "image" && secBg.imageUrl && (
        <div
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
          aria-hidden="true"
        >
          <div
            className="w-full h-full"
            style={{
              backgroundImage: `url(${secBg.imageUrl})`,
              backgroundPosition: secBg.position || "center",
              backgroundSize: secBg.size || "cover",
              backgroundRepeat: secBg.repeat || "no-repeat",
              opacity: typeof secBg.opacity === "number" ? secBg.opacity / 100 : 1,
              filter: secBg.blur ? `blur(${secBg.blur}px)` : undefined,
            }}
          />
          {secBg.overlayColor && (
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: secBg.overlayColor,
                opacity: typeof secBg.overlayOpacity === "number" ? secBg.overlayOpacity / 100 : 0.4,
              }}
            />
          )}
        </div>
      )}

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
          {hideOnMobile && (
            <span className="flex items-center gap-0.5 text-amber-400 font-normal" title="Hidden on mobile">
              <Smartphone className="w-2.5 h-2.5" />
              <span>Desk only</span>
              <span>•</span>
            </span>
          )}
          {hideOnDesktop && (
            <span className="flex items-center gap-0.5 text-sky-400 font-normal" title="Hidden on desktop">
              <Monitor className="w-2.5 h-2.5" />
              <span>Mob only</span>
              <span>•</span>
            </span>
          )}
          <span>{section.title || section.type}</span>
          {isSelected && <span className="opacity-75 text-[10px] uppercase font-mono">(Editing)</span>}
        </div>
      )}

      {/* Animated or Standard Section Body */}
      <div className="relative z-10 w-full">
        {Object.keys(motionProps).length > 0 ? (
          <motion.div {...motionProps}>{renderedContent}</motion.div>
        ) : (
          <div>{renderedContent}</div>
        )}
      </div>
    </div>
  );
}
