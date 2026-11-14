"use client";

import React, { useMemo } from "react";
import {
  type StorefrontLandingPageConfig,
  type LandingPageThemeMode,
  DEFAULT_THEME_COLORS,
  resolveDesignThemeTokens,
  resolveThemeSemanticTokens,
} from "@calcart/stores/landing-page";
import "../design-themes.css";
import { designThemeFontClassName } from "../../../lib/design-theme-fonts";
import { useStorefrontAppearance } from "../../../lib/storefront-appearance";
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
  onOpenAddElement?: (sectionId: string, parentElementId?: string) => void;
  onMoveElement?: (
    sectionId: string,
    sourceId: string,
    targetId: string,
    position: "before" | "after" | "inside" | "beside-left" | "beside-right",
  ) => void;
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
  onMoveElement,
}: StorefrontLandingRendererProps) {
  // On the live storefront the visitor's appearance (when the merchant enabled the toggle)
  // is applied; the editor preview always shows the merchant's own configuration.
  const appearance = useStorefrontAppearance(isPreview ? undefined : config?.theme, storeSlug);
  const theme = isPreview ? config?.theme : (appearance.theme ?? config?.theme);
  const designTheme = useMemo(() => resolveDesignThemeTokens(theme?.designTheme), [theme?.designTheme]);
  const isCustomDesign = designTheme.id !== "rustic-heritage";
  const explicitMode = theme?.mode;
  const mode: LandingPageThemeMode = explicitMode || "default";
  const colors = theme?.colors;
  const globalBg = theme?.background;
  const typography = theme?.typography;

  // Compute centralized semantic design tokens
  const semanticTheme = useMemo(() => {
    return resolveThemeSemanticTokens(theme);
  }, [theme]);

  const fontClass = useMemo(() => {
    const heading = typography?.headingFont;
    if (heading === "serif") return "font-serif";
    if (heading === "mono") return "";
    return "font-sans";
  }, [typography?.headingFont]);

  const modeClass = semanticTheme.modeClass;
  const sections = config?.sections || [];

  const handleClickCapture = (e: React.MouseEvent) => {
    if (isPreview) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("a, button, [role='button'], form, input[type='submit']")) {
        e.preventDefault();
      }
    }
  };

  const handleSubmitCapture = (e: React.FormEvent) => {
    if (isPreview) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const resolvedBackgroundColor = useMemo(() => {
    if (globalBg?.type === "color" && globalBg.color) {
      return globalBg.color;
    }
    if (explicitMode === "light" || explicitMode === "dark") {
      return "var(--landing-bg)";
    }
    if (explicitMode === "disabled") {
      return "transparent";
    }
    if (colors?.background && colors.background !== DEFAULT_THEME_COLORS.background) {
      return colors.background;
    }
    return globalBg ? undefined : "transparent";
  }, [globalBg, explicitMode, colors?.background]);

  const resolvedTextColor = useMemo(() => {
    if (explicitMode === "disabled") {
      return "inherit";
    }
    if (explicitMode === "light" || explicitMode === "dark") {
      return "var(--landing-text)";
    }
    if (colors?.text && colors.text !== DEFAULT_THEME_COLORS.text) {
      return colors.text;
    }
    return "inherit";
  }, [explicitMode, colors?.text]);

  return (
    <div
      onClickCapture={handleClickCapture}
      onSubmitCapture={handleSubmitCapture}
      className={`storefront-landing-root relative w-full min-h-screen transition-colors duration-300 ${modeClass ? modeClass + " " : ""}${fontClass} ${designThemeFontClassName} min-h-full shrink-0 flex-1 flex flex-col`.trim()}
      data-theme-mode={mode}
      {...designTheme.dataAttributes}
      data-ds-custom={isCustomDesign ? "true" : undefined}
      style={{
        ...(designTheme.cssVars as React.CSSProperties),
        ...(semanticTheme.cssVars as React.CSSProperties),
        // Button shape belongs to the design theme (Rustic Heritage keeps the merchant's own choice).
        ...(isCustomDesign ? { "--landing-btn-radius": "var(--ds-radius-btn)" } : {}),
        backgroundColor: resolvedBackgroundColor,
        color: resolvedTextColor,
      }}
    >
            {/* Global Background Layers - full height page coverage */}
      {globalBg && globalBg.type === "color" && globalBg.color && (
        <div
          className="pointer-events-none z-0 overflow-hidden absolute inset-0"
          style={{
            backgroundColor: globalBg.color,
            opacity: typeof globalBg.opacity === "number" ? globalBg.opacity / 100 : 1,
          }}
          aria-hidden="true"
        />
      )}

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
              onMoveElement={onMoveElement}
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
