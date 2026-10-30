"use client";

import React from "react";
import type {
  LandingPageSection,
  LandingPageTheme,
} from "@calcart/stores/landing-page";
import type { ProductSummaryDTO } from "@calcart/products";
import { ElementRenderer } from "./element-renderer";
import { Plus } from "lucide-react";

export interface SectionElementsLayoutProps {
  section: LandingPageSection;
  storeSlug: string;
  storeName?: string;
  storeCurrency?: string;
  products?: ProductSummaryDTO[];
  collections?: Array<{ id: string; name: string; slug?: string; imageUrl?: string; productCount?: number }>;
  isPreview?: boolean;
  selectedElementId?: string | null;
  onSelectElement?: (sectionId: string, elementId: string) => void;
  onOpenAddElement?: (sectionId: string) => void;
  theme?: LandingPageTheme;
}

export function SectionElementsLayout({
  section,
  storeSlug,
  storeName,
  storeCurrency = "USD",
  products = [],
  collections = [],
  isPreview = false,
  selectedElementId,
  onSelectElement,
  onOpenAddElement,
  theme,
}: SectionElementsLayoutProps) {
  const elements = section.elements || [];
  const layout = section.layout || { mode: "stack", containerWidth: "standard", gap: "md" };

  // Container width classes
  const widthClasses: Record<string, string> = {
    standard: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8",
    narrow: "max-w-4xl mx-auto px-4 sm:px-6",
    wide: "max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8",
    fullwidth: "w-full px-4 sm:px-6 lg:px-8",
  };

  // Gap classes
  const gapClasses: Record<string, string> = {
    none: "gap-0",
    xs: "gap-2",
    sm: "gap-4",
    md: "gap-6 sm:gap-8",
    lg: "gap-8 sm:gap-12",
    xl: "gap-12 sm:gap-16",
  };

  const containerWidthClass = widthClasses[layout.containerWidth || "standard"] || widthClasses.standard;
  const gapClass = gapClasses[layout.gap || "md"] || gapClasses.md;

  // Alignment classes for stack/row
  const hAlignClasses: Record<string, string> = {
    left: "items-start justify-start text-left",
    center: "items-center justify-center text-center",
    right: "items-end justify-end text-right",
    "space-between": "justify-between",
  };

  const vAlignClasses: Record<string, string> = {
    top: "items-start",
    center: "items-center",
    bottom: "items-end",
    stretch: "items-stretch",
  };

  // Empty State Dropzone
  if (elements.length === 0) {
    if (isPreview) {
      return (
        <div className={`w-full ${containerWidthClass} py-8`}>
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenAddElement) {
                onOpenAddElement(section.id);
              }
            }}
            className="w-full py-12 px-6 rounded-2xl border-2 border-dashed border-primary/30 hover:border-primary/70 bg-primary/5 hover:bg-primary/10 transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-3 group"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center text-primary transition-transform group-hover:scale-110">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Container is empty</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Click here or use the inspector to add your first element
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  // Layout mode implementation
  const renderLayoutContent = () => {
    switch (layout.mode) {
      case "row":
        return (
          <div
            className={`flex flex-wrap ${gapClass} ${
              layout.stackOnMobile ? "flex-col md:flex-row" : "flex-row"
            } ${hAlignClasses[layout.horizontalAlignment || "left"] || ""} ${
              vAlignClasses[layout.verticalAlignment || "center"] || ""
            }`}
          >
            {elements.map((el) => (
              <ElementRenderer
                key={el.id}
                element={el}
                storeSlug={storeSlug}
                storeName={storeName}
                storeCurrency={storeCurrency}
                products={products}
                collections={collections}
                isPreview={isPreview}
                isSelected={isPreview && selectedElementId === el.id}
                onSelect={(elemId) => onSelectElement?.(section.id, elemId)}
                theme={theme}
                sectionId={section.id}
              />
            ))}
          </div>
        );

      case "columns-2": {
        const ratio = layout.columnsRatio || "50_50";
        const ratioClasses: Record<string, string> = {
          "50_50": "grid-cols-1 md:grid-cols-2",
          "60_40": "grid-cols-1 md:grid-cols-[3fr_2fr]",
          "40_60": "grid-cols-1 md:grid-cols-[2fr_3fr]",
          "70_30": "grid-cols-1 md:grid-cols-[7fr_3fr]",
          "30_70": "grid-cols-1 md:grid-cols-[3fr_7fr]",
          "33_33_33": "grid-cols-1 md:grid-cols-3",
        };
        return (
          <div className={`grid ${ratioClasses[ratio] || "grid-cols-1 md:grid-cols-2"} ${gapClass} items-${layout.verticalAlignment || "start"}`}>
            {elements.map((el) => (
              <ElementRenderer
                key={el.id}
                element={el}
                storeSlug={storeSlug}
                storeName={storeName}
                storeCurrency={storeCurrency}
                products={products}
                collections={collections}
                isPreview={isPreview}
                isSelected={isPreview && selectedElementId === el.id}
                onSelect={(elemId) => onSelectElement?.(section.id, elemId)}
                theme={theme}
                sectionId={section.id}
              />
            ))}
          </div>
        );
      }

      case "columns-3":
        return (
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${gapClass} items-${layout.verticalAlignment || "start"}`}>
            {elements.map((el) => (
              <ElementRenderer
                key={el.id}
                element={el}
                storeSlug={storeSlug}
                storeName={storeName}
                storeCurrency={storeCurrency}
                products={products}
                collections={collections}
                isPreview={isPreview}
                isSelected={isPreview && selectedElementId === el.id}
                onSelect={(elemId) => onSelectElement?.(section.id, elemId)}
                theme={theme}
                sectionId={section.id}
              />
            ))}
          </div>
        );

      case "grid": {
        const cols = layout.gridColumns || 3;
        const gridColsClass =
          cols === 1
            ? "grid-cols-1"
            : cols === 2
              ? "grid-cols-1 sm:grid-cols-2"
              : cols === 4
                ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
        return (
          <div className={`grid ${gridColsClass} ${gapClass}`}>
            {elements.map((el) => (
              <ElementRenderer
                key={el.id}
                element={el}
                storeSlug={storeSlug}
                storeName={storeName}
                storeCurrency={storeCurrency}
                products={products}
                collections={collections}
                isPreview={isPreview}
                isSelected={isPreview && selectedElementId === el.id}
                onSelect={(elemId) => onSelectElement?.(section.id, elemId)}
                theme={theme}
                sectionId={section.id}
              />
            ))}
          </div>
        );
      }

      case "stack":
      default:
        return (
          <div
            className={`flex flex-col w-full ${gapClass} ${
              hAlignClasses[layout.horizontalAlignment || "left"] || "items-start"
            }`}
          >
            {elements.map((el) => (
              <ElementRenderer
                key={el.id}
                element={el}
                storeSlug={storeSlug}
                storeName={storeName}
                storeCurrency={storeCurrency}
                products={products}
                collections={collections}
                isPreview={isPreview}
                isSelected={isPreview && selectedElementId === el.id}
                onSelect={(elemId) => onSelectElement?.(section.id, elemId)}
                theme={theme}
                sectionId={section.id}
              />
            ))}
          </div>
        );
    }
  };

  return <div className={`w-full ${containerWidthClass}`}>{renderLayoutContent()}</div>;
}
