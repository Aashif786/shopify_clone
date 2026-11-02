"use client";

import React, { useMemo } from "react";
import type { StorefrontLandingPageConfig, LandingPageThemeMode } from "@calcart/stores/landing-page";
import type { ProductSummaryDTO } from "@calcart/products";
import { SECTION_REGISTRY } from "./registry";
import { SectionWrapper } from "./section-wrapper";

export interface StorefrontLandingRendererProps {
  config: StorefrontLandingPageConfig;
  storeSlug: string;
  storeName?: string;
  storeCurrency?: string;
  products?: ProductSummaryDTO[];
  collections?: Array<{ id: string; name: string; slug?: string; imageUrl?: string; productCount?: number }>;
  isPreview?: boolean;
  selectedSectionId?: string;
  selectedElementId?: string | null;
  onSelectSection?: (sectionId: string) => void;
  onSelectElement?: (sectionId: string, elementId: string) => void;
  onOpenAddElement?: (sectionId: string) => void;
}

export function StorefrontLandingRenderer({
  config,
  storeSlug,
  storeName,
  storeCurrency = "USD",
  products = [],
  collections = [],
  isPreview = false,
  selectedSectionId,
  selectedElementId,
  onSelectSection,
  onSelectElement,
  onOpenAddElement,
}: StorefrontLandingRendererProps) {
  const theme = config?.theme;
  const explicitMode = theme?.mode;
  const mode: LandingPageThemeMode = explicitMode || "default";
  const colors = theme?.colors;
  const globalBg = theme?.background;
  const typography = theme?.typography;
  const buttons = theme?.buttons;

  // Compute CSS custom properties
  const themeStyles = useMemo(() => {
    if (explicitMode === "disabled") {
      return {};
    }

    // Font weight mapping
    const headingWeightMap = {
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
      extrabold: "800",
    };
    const bodyWeightMap = {
      normal: "400",
      medium: "500",
    };

    // Button radius mapping
    const btnRadiusMap = {
      sharp: "0px",
      rounded: "12px",
      pill: "9999px",
    };

    const isLight = explicitMode === "light";
    const isDark = explicitMode === "dark";
    const isDefault = explicitMode === "default";

    // Mode-aware token resolutions
    let baseBg: string;
    let baseSurface: string;
    let baseText: string;
    let baseMuted: string;
    let basePrimary: string;
    let baseSecondary: string;
    let baseBorder: string;
    let baseButtonText: string;

    if (isDefault) {
      baseBg = colors?.background && colors.background.startsWith("var(")
        ? colors.background
        : "var(--color-background, transparent)";
      baseSurface = colors?.surface && colors.surface.startsWith("var(")
        ? colors.surface
        : "var(--color-bg-surface, var(--card, transparent))";
      baseText = typography?.headingColor || (colors?.text && colors.text.startsWith("var(") ? colors.text : "var(--color-foreground, inherit)");
      baseMuted = colors?.mutedText && colors.mutedText.startsWith("var(")
        ? colors.mutedText
        : "var(--color-muted-foreground, #64748b)";
      basePrimary = colors?.primary && colors.primary.startsWith("var(")
        ? colors.primary
        : "var(--color-primary, #0f172a)";
      baseSecondary = colors?.secondary || "var(--color-cobalt-500, #3b82f6)";
      baseBorder = colors?.border && colors.border.startsWith("var(")
        ? colors.border
        : "var(--color-border, rgba(15, 23, 42, 0.08))";
      baseButtonText = colors?.buttonText && colors.buttonText.startsWith("var(")
        ? colors.buttonText
        : "var(--color-primary-contrast, #ffffff)";
    } else if (isLight) {
      baseBg = colors?.background && colors.background !== "#0d0e12" ? colors.background : "#ffffff";
      baseSurface = colors?.surface && colors.surface !== "#16181f" ? colors.surface : "#f8fafc";
      baseText = typography?.headingColor || (colors?.text && colors.text !== "#f3f4f6" ? colors.text : "#0f172a");
      baseMuted = colors?.mutedText && colors.mutedText !== "#9ca3af" ? colors.mutedText : "#64748b";
      basePrimary = colors?.primary && colors.primary !== "#fafafa" ? colors.primary : "#0f172a";
      baseSecondary = colors?.secondary || "#3b82f6";
      baseBorder = colors?.border && colors.border !== "#27272a" ? colors.border : "rgba(15, 23, 42, 0.1)";
      baseButtonText = colors?.buttonText && colors.buttonText !== "#09090b" ? colors.buttonText : "#ffffff";
    } else if (isDark) {
      baseBg = colors?.background && colors.background !== "#ffffff" && colors.background !== "#fafafa" ? colors.background : "#090b0e";
      baseSurface = colors?.surface && colors.surface !== "#f8fafc" ? colors.surface : "#11141a";
      baseText = typography?.headingColor || (colors?.text && colors.text !== "#0f172a" ? colors.text : "#f9fafb");
      baseMuted = colors?.mutedText && colors.mutedText !== "#64748b" ? colors.mutedText : "#94a3b8";
      basePrimary = colors?.primary && colors.primary !== "#0f172a" ? colors.primary : "#3b82f6";
      baseSecondary = colors?.secondary || "#60a5fa";
      baseBorder = colors?.border || "rgba(255, 255, 255, 0.08)";
      baseButtonText = colors?.buttonText || "#ffffff";
    } else {
      // Legacy fallback for configs without explicit mode
      baseBg = colors?.background || "var(--color-background, transparent)";
      baseSurface = colors?.surface || "var(--color-bg-surface, transparent)";
      baseText = typography?.headingColor || colors?.text || "var(--color-foreground, inherit)";
      baseMuted = colors?.mutedText || "var(--color-muted-foreground, #64748b)";
      basePrimary = colors?.primary || "#0f172a";
      baseSecondary = colors?.secondary || "#3b82f6";
      baseBorder = colors?.border || "rgba(15, 23, 42, 0.08)";
      baseButtonText = colors?.buttonText || "#ffffff";
    }

    return {
      "--landing-bg": baseBg,
      "--landing-background": baseBg,
      "--landing-surface": baseSurface,
      "--landing-text": baseText,
      "--landing-muted": baseMuted,
      "--landing-primary": basePrimary,
      "--landing-secondary": baseSecondary,
      "--landing-border": baseBorder,
      "--landing-button-text": baseButtonText,
      "--landing-body-color": typography?.bodyColor || (isDefault ? "var(--color-foreground, inherit)" : baseText),
      "--landing-heading-weight": typography?.headingWeight ? headingWeightMap[typography.headingWeight] || "700" : "700",
      "--landing-body-weight": typography?.bodyWeight ? bodyWeightMap[typography.bodyWeight] || "400" : "400",
      "--landing-btn-radius": buttons?.shape ? btnRadiusMap[buttons.shape] || "12px" : "12px",
      "--primary": basePrimary,
      "--primary-foreground": baseButtonText,
      "--color-primary": basePrimary,
      "--color-primary-contrast": baseButtonText,
      "--background": baseBg,
      "--color-bg-canvas": baseBg,
      "--foreground": baseText,
      "--color-text-primary": baseText,
      "--border": baseBorder,
      "--color-border-default": baseBorder,
      "--card": baseSurface,
      "--color-bg-surface": baseSurface,
    } as React.CSSProperties;
  }, [explicitMode, colors, typography, buttons]);

  const fontClass = useMemo(() => {
    const heading = typography?.headingFont;
    if (heading === "serif") return "font-serif";
    if (heading === "mono") return "font-mono";
    return "font-sans";
  }, [typography?.headingFont]);

  const modeClass = explicitMode === "light" ? "light" : explicitMode === "dark" ? "dark" : "";
  const sections = config?.sections || [];

  return (
    <div
      className={`storefront-landing-root relative w-full min-h-screen transition-colors duration-300 ${modeClass} ${fontClass}`}
      data-theme-mode={mode}
      style={{
        ...themeStyles,
        backgroundColor: explicitMode
          ? (mode === "disabled" || mode === "default"
              ? (globalBg ? undefined : "transparent")
              : "var(--landing-bg)")
          : (colors?.background || "transparent"),
        color: explicitMode
          ? (mode === "disabled" || mode === "default"
              ? "inherit"
              : "var(--landing-text)")
          : (colors?.text || "inherit"),
      }}
    >
      {/* Global Background Layer */}
      {globalBg && globalBg.type === "image" && globalBg.imageUrl && (
        <div
          className={`pointer-events-none z-0 overflow-hidden ${isPreview ? "absolute inset-0" : "fixed inset-0"}`}
          aria-hidden="true"
        >
          <div
            className="w-full h-full"
            style={{
              backgroundImage: `url(${globalBg.imageUrl})`,
              backgroundPosition: globalBg.position || "center",
              backgroundSize: globalBg.size || "cover",
              backgroundRepeat: globalBg.repeat || "no-repeat",
              opacity: typeof globalBg.opacity === "number" ? globalBg.opacity / 100 : 1,
              filter: globalBg.blur ? `blur(${globalBg.blur}px)` : undefined,
            }}
          />
          {globalBg.overlayColor && (
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: globalBg.overlayColor,
                opacity: typeof globalBg.overlayOpacity === "number" ? globalBg.overlayOpacity / 100 : 0.4,
              }}
            />
          )}
        </div>
      )}

      {globalBg && globalBg.type === "gradient" && globalBg.gradient && (
        <div
          className={`pointer-events-none z-0 overflow-hidden ${isPreview ? "absolute inset-0" : "fixed inset-0"}`}
          style={{
            background: globalBg.gradient,
            opacity: typeof globalBg.opacity === "number" ? globalBg.opacity / 100 : 1,
          }}
          aria-hidden="true"
        />
      )}

      {/* Sections Flow */}
      <div className="relative z-10 w-full flex flex-col">
        {sections.map((section) => {
          const def = SECTION_REGISTRY[section.type];
          if (!def) {
            return null;
          }

          const SectionComponent = def.component;
          const isSelected = isPreview && selectedSectionId === section.id;

          return (
            <SectionWrapper
              key={section.id}
              section={section}
              isPreview={isPreview}
              isSelected={isSelected}
              selectedElementId={selectedElementId}
              onSelect={onSelectSection}
              onSelectElement={onSelectElement}
              onOpenAddElement={onOpenAddElement}
              theme={theme}
              storeSlug={storeSlug}
              storeName={storeName}
              storeCurrency={storeCurrency}
              products={products}
              collections={collections}
            >
              <SectionComponent
                section={section}
                storeSlug={storeSlug}
                storeName={storeName}
                storeCurrency={storeCurrency}
                products={products}
                collections={collections}
                isPreview={isPreview}
                isSelected={isSelected}
                onSelect={onSelectSection}
                theme={theme}
              />
            </SectionWrapper>
          );
        })}
      </div>
    </div>
  );
}
