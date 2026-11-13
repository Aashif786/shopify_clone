"use client";

import React, { useMemo } from "react";
import {
  type StorefrontLandingPageConfig,
  type LandingPageThemeMode,
  resolveThemeSemanticTokens,
} from "@calcart/stores/landing-page";
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
  const theme = config?.theme;
  const explicitMode = theme?.mode;
  const mode: LandingPageThemeMode = explicitMode || "default";
  const colors = theme?.colors;
  const globalBg = theme?.background;
  const typography = theme?.typography;

  // Compute centralized semantic design tokens
  const semanticTheme = useMemo(() => {
    return resolveThemeSemanticTokens(config?.theme);
  }, [config?.theme]);

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

  return (
    <div
      onClickCapture={handleClickCapture}
      onSubmitCapture={handleSubmitCapture}
      className={`storefront-landing-root relative w-full min-h-screen transition-colors duration-300 ${modeClass} ${fontClass}`}
      data-theme-mode={mode}
      style={{
        ...(semanticTheme.cssVars as React.CSSProperties),
        backgroundColor: explicitMode
          ? (explicitMode === "disabled" || explicitMode === "default"
              ? (globalBg ? undefined : "transparent")
              : "var(--landing-bg)")
          : (colors?.background || "transparent"),
        color: explicitMode
          ? (explicitMode === "disabled" || explicitMode === "default"
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
