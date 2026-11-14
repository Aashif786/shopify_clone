"use client";

import React, { useContext, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { PageElement, LandingPageTheme } from "@calcart/stores/landing-page";
import { isContainerElement } from "@calcart/stores/landing-page";
import type { ProductSummaryDTO } from "@calcart/products";
import { ELEMENT_REGISTRY } from "./element-registry";
import {
  ElementSelectionContext,
  StaggerRevealContext,
  getElementMotion,
  resolveIntensity,
} from "../motion";
import { getResponsiveVisibilityClasses } from "../responsive";

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

import { EyeOff, Edit3, GripVertical } from "lucide-react";

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
  onOpenAddElement?: (sectionId: string, parentElementId?: string) => void;
  onMoveElement?: (
    sectionId: string,
    sourceId: string,
    targetId: string,
    position: "before" | "after" | "inside" | "beside-left" | "beside-right",
  ) => void;
  theme?: LandingPageTheme;
  sectionId?: string;
}

export function ElementRenderer({
  element,
  storeSlug,
  storeName,
  storeCurrency = "USD",
  products = [],
  collections = [],
  isPreview = false,
  isSelected = false,
  onSelect,
  onOpenAddElement,
  onMoveElement,
  theme,
  sectionId,
}: ElementRendererProps) {
  const shouldReduceMotion = useReducedMotion();
  const def = ELEMENT_REGISTRY[element.type];
  const style = element.style || {};
  const responsive = element.responsive || {};
  const anim = element.animation;

  // Drag and drop state
  const [dragOverZone, setDragOverZone] = useState<"before" | "after" | "beside-left" | "beside-right" | "inside" | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Responsive hiding
  const hideMobile = responsive.hideOnMobile;
  const hideTablet = responsive.hideOnTablet;
  const hideDesktop = responsive.hideOnDesktop;

  // Entrance motion is resolved by the shared module so Studio and live match.
  // Hooks must run before any early return below (rules of hooks).
  const animationsEnabled = theme?.animations?.enabled ?? true;
  const joinStagger = useContext(StaggerRevealContext) && (!anim || anim.preset === "none");
  const selectedIdFromTree = useContext(ElementSelectionContext);
  const motionProps = useMemo(
    () =>
      getElementMotion({
        animation: anim,
        enabled: animationsEnabled,
        reduced: shouldReduceMotion,
        joinStagger,
        intensity: resolveIntensity(theme?.animations?.intensity),
        isPreview,
      }),
    // Keyed on the animation fields rather than the object identity, so edits to
    // unrelated element properties never rebuild (or replay) the reveal.
    [anim?.preset, anim?.duration, anim?.delay, animationsEnabled, shouldReduceMotion, joinStagger, theme?.animations?.intensity, isPreview],
  );

  if (element.isVisible === false && !isPreview) {
    return null;
  }

  if (!isPreview) {
    if (hideMobile && hideTablet && hideDesktop) return null;
  }

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
  const ptMap: Record<string, string> = {
    none: "pt-0",
    xs: "pt-1",
    sm: "pt-2",
    md: "pt-4",
    lg: "pt-6",
    xl: "pt-10",
  };
  const pbMap: Record<string, string> = {
    none: "pb-0",
    xs: "pb-1",
    sm: "pb-2",
    md: "pb-4",
    lg: "pb-6",
    xl: "pb-10",
  };

  const widthMap: Record<string, string> = {
    auto: "w-auto",
    full: "w-full",
    half: "w-full md:w-1/2 md:max-w-[50%]",
    third: "w-full md:w-1/3 md:max-w-[33.333%]",
    two_thirds: "w-full md:w-2/3 md:max-w-[66.666%]",
    custom: "",
  };

  const selfAlignMap: Record<string, string> = {
    auto: "",
    start: "self-start mr-auto",
    center: "self-center mx-auto",
    end: "self-end ml-auto",
  };

  const selfAlignClass =
    style.alignSelf && style.alignSelf !== "auto"
      ? selfAlignMap[style.alignSelf] || ""
      : style.textAlign === "center"
        ? "self-center mx-auto"
        : style.textAlign === "right"
          ? "self-end ml-auto"
          : "";

  const mtClass = style.marginTop ? mtMap[style.marginTop] || "" : "";
  const mbClass = style.marginBottom ? mbMap[style.marginBottom] || "" : "";
  const ptClass = style.paddingTop ? ptMap[style.paddingTop] || "" : "";
  const pbClass = style.paddingBottom ? pbMap[style.paddingBottom] || "" : "";

  const isButton = element.type === "button";
  const buttonIsFull =
    (element.content as Record<string, unknown>)?.isFullWidth === true ||
    style.width === "full";
  const defaultWidth = isButton ? (buttonIsFull ? "w-full" : "w-auto") : "w-full";
  const widthClass = style.width ? widthMap[style.width] || defaultWidth : defaultWidth;

  // Responsive hide CSS (standardized across sections and elements)
  const responsiveClasses = getResponsiveVisibilityClasses(
    hideMobile,
    hideTablet,
    hideDesktop,
    isPreview,
  );

  // Render Inner Element
  const renderInner = () => {
    switch (element.type) {
      case "heading":
        return <HeadingElement element={element} />;
      case "paragraph":
        return <ParagraphElement element={element} />;
      case "button":
        return <ButtonElement element={element} storeSlug={storeSlug} isPreview={isPreview} />;
      case "badge":
        return <BadgeElement element={element} />;
      case "divider":
        return <DividerElement element={element} />;
      case "spacer":
        return <SpacerElement element={element} isPreview={isPreview} />;
      case "icon":
        return <IconElement element={element} />;
      case "image":
        return <ImageElement element={element} storeSlug={storeSlug} isPreview={isPreview} />;
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
            isPreview={isPreview}
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
            isPreview={isPreview}
          />
        );
      case "collection_banner":
        return (
          <CollectionBannerElement
            element={element}
            storeSlug={storeSlug}
            collections={collections}
            isPreview={isPreview}
          />
        );
      case "category_links":
        return (
          <CategoryLinksElement
            element={element}
            storeSlug={storeSlug}
            collections={collections}
            isPreview={isPreview}
          />
        );
      case "container":
      case "row":
      case "column":
      case "grid":
      case "stack":
        return (
          <ContainerElement
            element={element}
            isPreview={isPreview}
            onOpenAddElement={onOpenAddElement && sectionId ? () => onOpenAddElement(sectionId, element.id) : undefined}
          >
            {Array.isArray(element.children) && element.children.length > 0
              ? element.children.map((child) => (
                  <ElementRenderer
                    key={child.id}
                    element={child}
                    storeSlug={storeSlug}
                    storeName={storeName}
                    storeCurrency={storeCurrency}
                    products={products}
                    collections={collections}
                    isPreview={isPreview}
                    isSelected={isPreview && selectedIdFromTree === child.id}
                    onSelect={onSelect}
                    onOpenAddElement={onOpenAddElement}
                    onMoveElement={onMoveElement}
                    theme={theme}
                    sectionId={sectionId}
                  />
                ))
              : null}
          </ContainerElement>
        );
      case "columns":
        return (
          <ColumnsElement element={element} isPreview={isPreview}>
            {Array.isArray(element.children) && element.children.length > 0
              ? element.children.map((child) => (
                  <ElementRenderer
                    key={child.id}
                    element={child}
                    storeSlug={storeSlug}
                    storeName={storeName}
                    storeCurrency={storeCurrency}
                    products={products}
                    collections={collections}
                    isPreview={isPreview}
                    isSelected={isPreview && selectedIdFromTree === child.id}
                    onSelect={onSelect}
                    onOpenAddElement={onOpenAddElement}
                    onMoveElement={onMoveElement}
                    theme={theme}
                    sectionId={sectionId}
                  />
                ))
              : null}
          </ColumnsElement>
        );
      default:
        return (
          <div className="p-4 rounded-lg border border-dashed border-border text-xs text-muted-foreground">
            Element ({element.type})
          </div>
        );
    }
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    if (isPreview) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("a, button, [role='button'], form, input[type='submit']")) {
        e.preventDefault();
      }
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isPreview) {
      e.preventDefault();
      e.stopPropagation();
      if (onSelect) {
        onSelect(element.id);
      }
    }
  };

  // Drag and Drop Event Handlers
  const handleDragStart = (e: React.DragEvent) => {
    if (!isPreview) return;
    e.stopPropagation();
    setIsDragging(true);
    e.dataTransfer.setData(
      "application/calcart-element",
      JSON.stringify({ sectionId: sectionId || "", elementId: element.id })
    );
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDragOverZone(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isPreview) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;

    const relX = x / w;
    const relY = y / h;

    const isContainer = isContainerElement(element.type);

    if (isContainer && relX >= 0.15 && relX <= 0.85 && relY >= 0.15 && relY <= 0.85) {
      setDragOverZone("inside");
    } else if (relY < 0.25) {
      setDragOverZone("before");
    } else if (relY > 0.75) {
      setDragOverZone("after");
    } else if (relX < 0.35) {
      setDragOverZone("beside-left");
    } else if (relX > 0.65) {
      setDragOverZone("beside-right");
    } else if (isContainer) {
      setDragOverZone("inside");
    } else {
      setDragOverZone(relY < 0.5 ? "before" : "after");
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setDragOverZone(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!isPreview) return;
    e.preventDefault();
    e.stopPropagation();
    const zone = dragOverZone;
    setDragOverZone(null);

    try {
      const raw = e.dataTransfer.getData("application/calcart-element");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data.elementId || data.elementId === element.id) return;

      if (onMoveElement && sectionId) {
        onMoveElement(
          sectionId,
          data.elementId,
          element.id,
          zone || (isContainerElement(element.type) ? "inside" : "after")
        );
      }
    } catch {
      // Ignore parse error
    }
  };

  return (
    <div
      data-element-id={element.id}
      data-element-type={element.type}
      onClick={handleClick}
      onClickCapture={handleClickCapture}
      draggable={isPreview}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative transition-all duration-150 ${widthClass} ${selfAlignClass} ${mtClass} ${mbClass} ${ptClass} ${pbClass} ${responsiveClasses} ${
        isPreview
          ? `cursor-grab active:cursor-grabbing group/elem rounded-lg select-none ${
              isDragging ? "opacity-35 scale-[0.98] ring-2 ring-primary ring-dashed pointer-events-none" : ""
            } ${
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
          className={`absolute -top-3 left-2 z-40 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] tracking-wide uppercase transition-all duration-150 pointer-events-none ${
            isSelected
              ? "bg-primary text-primary-foreground shadow-md opacity-100 scale-100"
              : "bg-background/90 text-foreground border border-border shadow-xs opacity-0 group-hover/elem:opacity-100 scale-95 group-hover/elem:scale-100"
          }`}
        >
          <GripVertical className="w-2.5 h-2.5 opacity-60 mr-0.5" />
          {!element.isVisible && <EyeOff className="w-2.5 h-2.5 text-amber-500" />}
          <span>{element.label || def?.name || element.type}</span>
          {isSelected && <Edit3 className="w-2.5 h-2.5 ml-0.5 opacity-80" />}
        </div>
      )}

      {/* Visual Drop Zone Indicators */}
      {isPreview && dragOverZone === "before" && (
        <div className="absolute -top-1.5 left-0 right-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="w-full h-1 bg-primary rounded-full shadow-[0_0_12px_rgba(var(--landing-primary,59,130,246),0.9)]" />
          <span className="absolute -top-4 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold tracking-wider uppercase shadow-md flex items-center gap-1">
            Insert Above
          </span>
        </div>
      )}

      {isPreview && dragOverZone === "after" && (
        <div className="absolute -bottom-1.5 left-0 right-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="w-full h-1 bg-primary rounded-full shadow-[0_0_12px_rgba(var(--landing-primary,59,130,246),0.9)]" />
          <span className="absolute -bottom-4 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold tracking-wider uppercase shadow-md flex items-center gap-1">
            Insert Below
          </span>
        </div>
      )}

      {isPreview && dragOverZone === "beside-left" && (
        <div className="absolute top-0 bottom-0 -left-1.5 z-50 flex flex-col items-center justify-center pointer-events-none">
          <div className="h-full w-1.5 bg-primary rounded-full shadow-[0_0_12px_rgba(var(--landing-primary,59,130,246),0.9)]" />
          <span className="absolute -left-4 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold tracking-wider uppercase shadow-md whitespace-nowrap">
            Place Beside
          </span>
        </div>
      )}

      {isPreview && dragOverZone === "beside-right" && (
        <div className="absolute top-0 bottom-0 -right-1.5 z-50 flex flex-col items-center justify-center pointer-events-none">
          <div className="h-full w-1.5 bg-primary rounded-full shadow-[0_0_12px_rgba(var(--landing-primary,59,130,246),0.9)]" />
          <span className="absolute -right-4 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold tracking-wider uppercase shadow-md whitespace-nowrap">
            Place Beside
          </span>
        </div>
      )}

      {isPreview && dragOverZone === "inside" && (
        <div className="absolute inset-0 z-50 rounded-lg pointer-events-none border-2 border-primary bg-primary/10 shadow-[0_0_20px_rgba(var(--landing-primary,59,130,246),0.25)] flex items-center justify-center">
          <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold tracking-wider uppercase shadow-md flex items-center gap-1.5">
            Drop Inside Container
          </span>
        </div>
      )}

      {/* Render with or without motion wrapper */}
      {motionProps ? (
        <motion.div
          // Remounts (replays) only when the merchant edits this element's motion
          // settings; ordinary re-renders never replay the reveal.
          key={`anim-${anim?.preset}-${anim?.duration}-${anim?.delay}-${joinStagger ? "s" : ""}`}
          {...motionProps}
          className="w-full"
        >
          <StaggerRevealContext.Provider value={false}>{renderInner()}</StaggerRevealContext.Provider>
        </motion.div>
      ) : (
        <div className="w-full"><StaggerRevealContext.Provider value={false}>{renderInner()}</StaggerRevealContext.Provider></div>
      )}
    </div>
  );
}
