"use client";

import React, { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { PageElement, LandingPageTheme } from "@calcart/stores/landing-page";
import type { ProductSummaryDTO } from "@calcart/products";
import { ELEMENT_REGISTRY } from "./element-registry";

// Content Elements
import { HeadingElement } from "./heading-element";
import { ParagraphElement } from "./paragraph-element";
import { ButtonElement } from "./button-element";
import { BadgeElement } from "./badge-element";
import { DividerElement } from "./divider-element";
import { SpacerElement } from "./spacer-element";
import { IconElement } from "./icon-element";

// Media Elements
import { ImageElement } from "./image-element";
import { VideoElement } from "./video-element";

// Commerce Elements
import { ProductCardElement } from "./product-card-element";
import { ProductGridElement } from "./product-grid-element";
import { ProductCarouselElement } from "./product-carousel-element";
import { FeaturedProductElement } from "./featured-product-element";
import { CollectionBannerElement } from "./collection-banner-element";
import { CategoryLinksElement } from "./category-links-element";

// Layout Elements
import { ContainerElement } from "./container-element";
import { ColumnsElement } from "./columns-element";

import { EyeOff, Edit3 } from "lucide-react";

export interface ElementRendererProps {
  element: PageElement;
  storeSlug: string;
  storeName?: string;
  storeCurrency?: string;
  products?: ProductSummaryDTO[];
  collections?: Array<{ id: string; name: string; slug?: string; imageUrl?: string; productCount?: number }>;
  isPreview?: boolean;
  isSelected?: boolean;
  onSelect?: (elementId: string) => void;
  theme?: LandingPageTheme;
  sectionId?: string;
}

const SMOOTH_EASE = [0.16, 1, 0.3, 1] as const;

export function ElementRenderer({
  element,
  storeSlug,
  storeCurrency = "USD",
  products = [],
  collections = [],
  isPreview = false,
  isSelected = false,
  onSelect,
  theme,
}: ElementRendererProps) {
  const shouldReduceMotion = useReducedMotion();
  const def = ELEMENT_REGISTRY[element.type];
  const style = element.style || {};
  const responsive = element.responsive || {};
  const anim = element.animation;

  // Responsive hiding
  const hideMobile = responsive.hideOnMobile;
  const hideTablet = responsive.hideOnTablet;
  const hideDesktop = responsive.hideOnDesktop;

  if (!element.isVisible && !isPreview) {
    return null;
  }

  if (!isPreview) {
    if (hideMobile && hideTablet && hideDesktop) return null;
  }

  // Animation props
  const animationsEnabled = theme?.animations?.enabled ?? true;
  const motionProps = useMemo(() => {
    if (shouldReduceMotion || !animationsEnabled || !anim || anim.preset === "none") {
      return {};
    }

    const duration = anim.duration || 0.4;
    const delay = anim.delay || 0;

    switch (anim.preset) {
      case "fade-up":
        return {
          initial: { opacity: 0, y: 16 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-20px" },
          transition: { duration, delay, ease: SMOOTH_EASE },
        };
      case "fade-in":
        return {
          initial: { opacity: 0 },
          whileInView: { opacity: 1 },
          viewport: { once: true, margin: "-20px" },
          transition: { duration, delay, ease: "easeOut" as const },
        };
      case "scale-in":
        return {
          initial: { opacity: 0, scale: 0.95 },
          whileInView: { opacity: 1, scale: 1 },
          viewport: { once: true, margin: "-20px" },
          transition: { duration, delay, ease: SMOOTH_EASE },
        };
      case "slide":
      case "slide-left":
        return {
          initial: { opacity: 0, x: -20 },
          whileInView: { opacity: 1, x: 0 },
          viewport: { once: true, margin: "-20px" },
          transition: { duration, delay, ease: SMOOTH_EASE },
        };
      case "slide-right":
        return {
          initial: { opacity: 0, x: 20 },
          whileInView: { opacity: 1, x: 0 },
          viewport: { once: true, margin: "-20px" },
          transition: { duration, delay, ease: SMOOTH_EASE },
        };
      default:
        return {};
    }
  }, [shouldReduceMotion, animationsEnabled, anim]);

  // Sizing and margin classes
  const mtMap: Record<string, string> = {
    none: "mt-0",
    xs: "mt-1",
    sm: "mt-2",
    md: "mt-4",
    lg: "mt-6",
    xl: "mt-10",
  };
  const mbMap: Record<string, string> = {
    none: "mb-0",
    xs: "mb-1",
    sm: "mb-2",
    md: "mb-4",
    lg: "mb-6",
    xl: "mb-10",
  };

  const widthMap: Record<string, string> = {
    auto: "w-auto",
    full: "w-full",
    half: "w-full md:w-1/2",
    third: "w-full md:w-1/3",
    two_thirds: "w-full md:w-2/3",
    custom: "",
  };

  const mtClass = style.marginTop ? mtMap[style.marginTop] || "" : "";
  const mbClass = style.marginBottom ? mbMap[style.marginBottom] || "" : "";
  const widthClass = style.width ? widthMap[style.width] || "w-full" : "w-full";

  // Responsive hide CSS
  const responsiveClasses = [
    hideMobile ? (isPreview ? "opacity-75 ring-1 ring-amber-500/30" : "hidden sm:block") : "",
    hideTablet ? (isPreview ? "opacity-75 ring-1 ring-purple-500/30" : "sm:hidden lg:block") : "",
    hideDesktop ? (isPreview ? "opacity-75 ring-1 ring-sky-500/30" : "lg:hidden") : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Render Inner Element
  const renderInner = () => {
    switch (element.type) {
      case "heading":
        return <HeadingElement element={element} />;
      case "paragraph":
        return <ParagraphElement element={element} />;
      case "button":
        return <ButtonElement element={element} storeSlug={storeSlug} />;
      case "badge":
        return <BadgeElement element={element} />;
      case "divider":
        return <DividerElement element={element} />;
      case "spacer":
        return <SpacerElement element={element} isPreview={isPreview} />;
      case "icon":
        return <IconElement element={element} />;
      case "image":
        return <ImageElement element={element} storeSlug={storeSlug} />;
      case "video":
        return <VideoElement element={element} />;
      case "product_card":
        return (
          <ProductCardElement
            element={element}
            storeSlug={storeSlug}
            storeCurrency={storeCurrency}
            products={products}
          />
        );
      case "product_grid":
      case "product_collection":
        return (
          <ProductGridElement
            element={element}
            storeSlug={storeSlug}
            storeCurrency={storeCurrency}
            products={products}
          />
        );
      case "product_carousel":
        return (
          <ProductCarouselElement
            element={element}
            storeSlug={storeSlug}
            storeCurrency={storeCurrency}
            products={products}
          />
        );
      case "featured_product":
        return (
          <FeaturedProductElement
            element={element}
            storeSlug={storeSlug}
            storeCurrency={storeCurrency}
            products={products}
          />
        );
      case "collection_banner":
        return (
          <CollectionBannerElement
            element={element}
            storeSlug={storeSlug}
            collections={collections}
          />
        );
      case "category_links":
        return (
          <CategoryLinksElement
            element={element}
            storeSlug={storeSlug}
            collections={collections}
          />
        );
      case "container":
        return <ContainerElement element={element} isPreview={isPreview} />;
      case "columns":
        return <ColumnsElement element={element} isPreview={isPreview} />;
      case "grid":
      case "stack":
        return (
          <div className="w-full">
            <ContainerElement element={element} isPreview={isPreview} />
          </div>
        );
      default:
        return (
          <div className="p-4 rounded-lg border border-dashed border-border text-xs text-muted-foreground">
            Element ({element.type})
          </div>
        );
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isPreview && onSelect) {
      e.stopPropagation();
      onSelect(element.id);
    }
  };

  return (
    <div
      data-element-id={element.id}
      data-element-type={element.type}
      onClick={handleClick}
      className={`relative transition-all duration-150 ${widthClass} ${mtClass} ${mbClass} ${responsiveClasses} ${
        isPreview
          ? `cursor-pointer group/elem rounded-lg select-none ${
              isSelected
                ? "ring-2 ring-primary ring-offset-2 ring-offset-background z-30"
                : "hover:ring-1 hover:ring-primary/60 hover:bg-primary/5"
            }`
          : ""
      } ${!element.isVisible && isPreview ? "opacity-50 border border-dashed border-amber-500/50" : ""}`}
      style={{
        width: style.width === "custom" && style.customWidth ? style.customWidth : undefined,
      }}
    >
      {/* Editor Badge on Element Hover/Select */}
      {isPreview && (
        <div
          className={`absolute -top-3 left-2 z-40 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono tracking-wide uppercase transition-all duration-150 pointer-events-none ${
            isSelected
              ? "bg-primary text-primary-foreground shadow-md opacity-100 scale-100"
              : "bg-background/90 text-foreground border border-border shadow-xs opacity-0 group-hover/elem:opacity-100 scale-95 group-hover/elem:scale-100"
          }`}
        >
          {!element.isVisible && <EyeOff className="w-2.5 h-2.5 text-amber-500" />}
          <span>{element.label || def?.name || element.type}</span>
          {isSelected && <Edit3 className="w-2.5 h-2.5 ml-0.5 opacity-80" />}
        </div>
      )}

      {/* Render with or without motion wrapper */}
      {Object.keys(motionProps).length > 0 ? (
        <motion.div {...motionProps} className="w-full">
          {renderInner()}
        </motion.div>
      ) : (
        <div className="w-full">{renderInner()}</div>
      )}
    </div>
  );
}
