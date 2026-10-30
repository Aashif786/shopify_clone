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

  // Compute CSS custom properties
  const themeStyles = useMemo(() => {
    if (!colors) return {};
    return {
      "--landing-bg": colors.background,
      "--landing-surface": colors.surface,
      "--landing-text": colors.text,
      "--landing-muted": colors.mutedText,
      "--landing-primary": colors.primary,
      "--landing-secondary": colors.secondary,
      "--landing-border": colors.border,
      "--landing-button-text": colors.buttonText,
    } as React.CSSProperties;
  }, [colors]);

  const fontClass = useMemo(() => {
    const heading = theme?.typography?.headingFont;
    if (heading === "serif") return "font-serif";
    if (heading === "mono") return "font-mono";
    return "font-sans";
  }, [theme?.typography?.headingFont]);

  const sections = config?.sections || [];

  return (
    <div
      className={`storefront-landing-root min-h-screen transition-colors duration-300 ${fontClass}`}
      style={{
        ...themeStyles,
        backgroundColor: "var(--landing-bg, #0d0e12)",
        color: "var(--landing-text, #f3f4f6)",
      }}
    >
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
  );
}
