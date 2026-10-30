"use client";

import React, { useMemo } from "react";
import type { StorefrontLandingPageConfig } from "@calcart/stores/landing-page";
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
  onSelectSection?: (sectionId: string) => void;
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
  onSelectSection,
}: StorefrontLandingRendererProps) {
  const theme = config?.theme;
  const colors = theme?.colors;
  const globalBg = theme?.background;
  const typography = theme?.typography;
  const buttons = theme?.buttons;

  // Compute CSS custom properties
  const themeStyles = useMemo(() => {
    if (!colors) return {};

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

    return {
      "--landing-bg": colors.background,
      "--landing-surface": colors.surface,
      "--landing-text": typography?.headingColor || colors.text,
      "--landing-muted": colors.mutedText,
      "--landing-primary": colors.primary,
      "--landing-secondary": colors.secondary,
      "--landing-border": colors.border,
      "--landing-button-text": colors.buttonText,
      "--landing-body-color": typography?.bodyColor || colors.text,
      "--landing-heading-weight": typography?.headingWeight ? headingWeightMap[typography.headingWeight] || "700" : "700",
      "--landing-body-weight": typography?.bodyWeight ? bodyWeightMap[typography.bodyWeight] || "400" : "400",
      "--landing-btn-radius": buttons?.shape ? btnRadiusMap[buttons.shape] || "12px" : "12px",
    } as React.CSSProperties;
  }, [colors, typography, buttons]);

  const fontClass = useMemo(() => {
    const heading = typography?.headingFont;
    if (heading === "serif") return "font-serif";
    if (heading === "mono") return "font-mono";
    return "font-sans";
  }, [typography?.headingFont]);

  const sections = config?.sections || [];

  return (
    <div
      className={`storefront-landing-root relative w-full min-h-screen transition-colors duration-300 ${fontClass}`}
      style={{
        ...themeStyles,
        backgroundColor: "var(--landing-bg, #0d0e12)",
        color: "var(--landing-text, #f3f4f6)",
      }}
    >
      {/* Global Background Layer */}
      {globalBg && globalBg.type === "image" && globalBg.imageUrl && (
        <div
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
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
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
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
              onSelect={onSelectSection}
              theme={theme}
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
