"use client";

import React, { useRef, useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ProductCard } from "@/components/storefront/products/product-card";
import type { StorefrontLandingSectionProps } from "../types";
import type { CarouselSlide } from "@calcart/stores/landing-page";

export interface ProductCarouselSectionConfig {
  heading?: string;
  subtitle?: string;
  sourceType?: "products" | "custom_slides" | "mixed";
  slides?: CarouselSlide[];
  productIds?: string[];
  limit?: number;
  viewAllLink?: string;
  layout?: "standard" | "cards" | "hero_showcase" | "fullwidth";
  aspectRatio?: "16:9" | "4:3" | "1:1" | "21:9" | "auto";
  autoplay?: boolean;
  autoplayInterval?: number; // seconds
  transition?: "slide" | "fade";
  showArrows?: boolean;
  showPagination?: boolean;
  cardSpacing?: "compact" | "normal" | "spacious";
  alignment?: "left" | "center";
}

const DEFAULT_SLIDES: CarouselSlide[] = [
  {
    id: "slide_1",
    type: "custom_image",
    imageUrl: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80",
    title: "Seasonal Architecture Drop",
    subtitle: "Precision-tailored pieces crafted with organic cotton and recycled minerals.",
    badge: "LIMITED EDITION",
    ctaText: "Shop the drop",
    ctaLink: "/products",
  },
  {
    id: "slide_2",
    type: "custom_image",
    imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1600&q=80",
    title: "Minimalist Daily Accents",
    subtitle: "Engineered for durability and tactile elegance in your everyday environment.",
    badge: "BESTSELLER",
    ctaText: "Explore highlights",
    ctaLink: "/products",
  },
  {
    id: "slide_3",
    type: "custom_image",
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1600&q=80",
    title: "Acoustic & Studio Gear",
    subtitle: "Clean acoustic engineering meet sculptural matte silhouettes.",
    badge: "CURATOR CHOICE",
    ctaText: "Discover sound",
    ctaLink: "/products",
  },
];

export function ProductCarouselSection({
  section,
  storeSlug,
  storeCurrency,
  products = [],
}: StorefrontLandingSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const cfg = (section.config || {}) as ProductCarouselSectionConfig;

  const heading = cfg.heading ?? "Trending Releases";
  const subtitle = cfg.subtitle ?? "Swipe through our newest curated selections";
  const sourceType = cfg.sourceType || (cfg.slides && cfg.slides.length > 0 ? "custom_slides" : "products");
  const limit = Number(cfg.limit) || 8;
  const viewAllLink = cfg.viewAllLink || `/stores/${encodeURIComponent(storeSlug)}/products`;
  const layout = cfg.layout || "standard";
  const aspectRatio = cfg.aspectRatio || "16:9";
  const autoplay = cfg.autoplay ?? false;
  const autoplayInterval = (Number(cfg.autoplayInterval) || 5) * 1000;
  const transition = cfg.transition || "slide";
  const showArrows = cfg.showArrows ?? true;
  const showPagination = cfg.showPagination ?? true;
  const cardSpacing = cfg.cardSpacing || "normal";
  const alignment = cfg.alignment || "left";

  const selectedProductIds: string[] = Array.isArray(cfg.productIds) ? cfg.productIds : [];

  // Resolved slides or product list
  const slides = useMemo(() => {
    if (sourceType === "custom_slides" || sourceType === "mixed") {
      const list = cfg.slides && cfg.slides.length > 0 ? cfg.slides : DEFAULT_SLIDES;
      return list;
    }
    return [];
  }, [sourceType, cfg.slides]);

  const displayProducts = useMemo(() => {
    let list = [...products];
    if (selectedProductIds.length > 0) {
      list = list.filter((p) => selectedProductIds.includes(p.id));
    }
    return list.slice(0, limit);
  }, [products, selectedProductIds, limit]);

  // Active slide index for hero/fullwidth layout
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const totalSlides = sourceType === "custom_slides" ? slides.length : displayProducts.length;

  const nextSlide = useCallback(() => {
    if (totalSlides <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    if (totalSlides <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  // Autoplay timer
  useEffect(() => {
    if (!autoplay || isPaused || totalSlides <= 1) return;
    const timer = setInterval(() => {
      nextSlide();
    }, autoplayInterval);
    return () => clearInterval(timer);
  }, [autoplay, isPaused, totalSlides, autoplayInterval, nextSlide]);

  const handleScroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const offset = direction === "left" ? -340 : 340;
    scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  // Aspect ratio helper
  const aspectClass =
    aspectRatio === "16:9"
      ? "aspect-video"
      : aspectRatio === "4:3"
        ? "aspect-4/3"
        : aspectRatio === "1:1"
          ? "aspect-square"
          : aspectRatio === "21:9"
            ? "aspect-[21/9]"
            : "aspect-video";

  // Spacing gap class
  const gapClass =
    cardSpacing === "compact"
      ? "gap-3 sm:gap-4"
      : cardSpacing === "spacious"
        ? "gap-8 sm:gap-10"
        : "gap-6";

  // 1. HERO SHOWCASE / FULLWIDTH LAYOUT
  if (layout === "hero_showcase" || layout === "fullwidth") {
    const isHero = layout === "hero_showcase";
    const currentSlide = slides[currentIndex] || slides[0] || DEFAULT_SLIDES[0];

    return (
      <section
        className={`storefront-carousel-hero relative w-full overflow-hidden ${
          isHero ? "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12" : "py-4 sm:py-8"
        }`}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Header if defined */}
        {(heading || subtitle) && (
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[var(--landing-border)] mb-6">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--landing-primary)]">
                Featured Carousel
              </span>
              {heading && (
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--landing-text)]">
                  {heading}
                </h2>
              )}
              {subtitle && (
                <p className="text-sm text-[var(--landing-muted)] max-w-xl">
                  {subtitle}
                </p>
              )}
            </div>

            {showArrows && totalSlides > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={prevSlide}
                  aria-label="Previous slide"
                  className="p-2.5 rounded-full border border-[var(--landing-border)] bg-[var(--landing-surface)] text-[var(--landing-text)] hover:bg-[var(--landing-border)] transition-colors active:scale-95"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={nextSlide}
                  aria-label="Next slide"
                  className="p-2.5 rounded-full border border-[var(--landing-border)] bg-[var(--landing-surface)] text-[var(--landing-text)] hover:bg-[var(--landing-border)] transition-colors active:scale-95"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Cinematic Slide Stage */}
        <div
          className={`relative w-full ${isHero ? "rounded-3xl" : "rounded-none"} overflow-hidden shadow-2xl bg-[var(--landing-surface)] ${aspectClass} min-h-[360px] sm:min-h-[480px] lg:min-h-[560px]`}
        >
          <AnimatePresence mode="wait">
            {currentSlide && (
              <motion.div
                key={currentSlide.id || currentIndex}
                initial={
                  transition === "fade"
                    ? { opacity: 0 }
                    : { opacity: 0, x: 60 }
                }
                animate={{ opacity: 1, x: 0 }}
                exit={
                  transition === "fade"
                    ? { opacity: 0 }
                    : { opacity: 0, x: -60 }
                }
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 w-full h-full"
              >
                {/* Background image */}
                <div
                  className="absolute inset-0 w-full h-full bg-cover bg-center transition-transform duration-700 ease-out scale-100 hover:scale-105"
                  style={{ backgroundImage: `url(${currentSlide.imageUrl || DEFAULT_SLIDES[0]?.imageUrl || ""})` }}
                />

                {/* Rich Gradient Vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--landing-bg)] via-[var(--landing-bg)]/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--landing-bg)]/80 via-transparent to-transparent" />

                {/* Content Overlay */}
                <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-12 lg:p-16 max-w-2xl space-y-4 z-10">
                  {currentSlide.badge && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--landing-primary)]/20 border border-[var(--landing-primary)]/40 text-[var(--landing-primary)] text-xs font-bold tracking-wide w-fit">
                      <Sparkles className="w-3 h-3" />
                      <span>{currentSlide.badge}</span>
                    </div>
                  )}

                  {currentSlide.title && (
                    <h3 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[var(--landing-text)] leading-tight">
                      {currentSlide.title}
                    </h3>
                  )}

                  {currentSlide.subtitle && (
                    <p className="text-sm sm:text-base text-[var(--landing-muted)] max-w-lg leading-relaxed">
                      {currentSlide.subtitle}
                    </p>
                  )}

                  {currentSlide.ctaText && (
                    <div className="pt-2">
                      <Link
                        href={
                          currentSlide.ctaLink?.startsWith("/")
                            ? currentSlide.ctaLink
                            : `/stores/${encodeURIComponent(storeSlug)}${currentSlide.ctaLink || "/products"}`
                        }
                        className="btn btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-[var(--landing-btn-radius,12px)] text-sm font-bold shadow-lg hover:shadow-[var(--landing-primary)]/20 transition-all active:scale-95"
                      >
                        <span>{currentSlide.ctaText}</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Arrows Overlay on Stage */}
          {showArrows && totalSlides > 1 && (
            <div className="absolute inset-y-0 inset-x-4 flex items-center justify-between pointer-events-none z-20">
              <button
                type="button"
                onClick={prevSlide}
                aria-label="Previous slide"
                className="pointer-events-auto p-3 rounded-full bg-[var(--landing-surface)]/80 backdrop-blur-md border border-[var(--landing-border)] text-[var(--landing-text)] hover:bg-[var(--landing-surface)] transition-all shadow-md active:scale-90"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={nextSlide}
                aria-label="Next slide"
                className="pointer-events-auto p-3 rounded-full bg-[var(--landing-surface)]/80 backdrop-blur-md border border-[var(--landing-border)] text-[var(--landing-text)] hover:bg-[var(--landing-surface)] transition-all shadow-md active:scale-90"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Dots Pagination */}
          {showPagination && totalSlides > 1 && (
            <div className="absolute bottom-4 right-6 sm:bottom-6 sm:right-10 flex items-center gap-2 z-20">
              {Array.from({ length: totalSlides }).map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`Jump to slide ${idx + 1}`}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                    currentIndex === idx
                      ? "w-7 bg-[var(--landing-primary)]"
                      : "w-2 bg-[var(--landing-border)] hover:bg-[var(--landing-muted)]"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  // 2. STANDARD SLIDER & CARD CAROUSEL LAYOUTS
  return (
    <section
      className="storefront-carousel max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 py-8 sm:py-12"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[var(--landing-border)]">
        <div className={`space-y-1 ${alignment === "center" ? "text-center sm:text-left" : ""}`}>
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--landing-primary)]">
            Curated Carousel
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--landing-text)]">
            {heading}
          </h2>
          {subtitle && (
            <p className="text-sm text-[var(--landing-muted)] max-w-xl">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {showArrows && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleScroll("left")}
                aria-label="Scroll left"
                className="p-2 rounded-full border border-[var(--landing-border)] bg-[var(--landing-surface)] text-[var(--landing-text)] hover:bg-[var(--landing-border)] transition-colors active:scale-95"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleScroll("right")}
                aria-label="Scroll right"
                className="p-2 rounded-full border border-[var(--landing-border)] bg-[var(--landing-surface)] text-[var(--landing-text)] hover:bg-[var(--landing-border)] transition-colors active:scale-95"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <Link
            href={viewAllLink.startsWith("/") ? viewAllLink : `/stores/${encodeURIComponent(storeSlug)}${viewAllLink}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--landing-primary)] hover:underline ml-2"
          >
            <span>View all</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Custom Slides Carousel */}
      {sourceType === "custom_slides" ? (
        slides.length === 0 ? (
          <div className="py-12 text-center rounded-xl border border-dashed border-[var(--landing-border)] bg-[var(--landing-surface)]/50">
            <p className="text-sm text-[var(--landing-muted)]">No slides configured in this carousel.</p>
          </div>
        ) : (
          <div
            ref={scrollRef}
            className={`flex items-stretch ${gapClass} overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scrollbar-none scroll-smooth`}
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {slides.map((slide, sIdx) => (
              <div
                key={slide.id || sIdx}
                className={`w-[300px] sm:w-[360px] lg:w-[400px] shrink-0 snap-start rounded-2xl overflow-hidden border border-[var(--landing-border)] bg-[var(--landing-surface)] flex flex-col justify-between shadow-md hover:shadow-xl transition-all duration-300 group`}
              >
                <div className={`relative w-full ${aspectClass} overflow-hidden bg-muted`}>
                  {slide.imageUrl && (
                    <div
                      className="w-full h-full bg-cover bg-center transition-transform duration-500 ease-out group-hover:scale-105"
                      style={{ backgroundImage: `url(${slide.imageUrl})` }}
                    />
                  )}
                  {slide.badge && (
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-[var(--landing-primary)] text-[var(--landing-button-text,#000)] text-[11px] font-bold shadow-xs">
                      {slide.badge}
                    </div>
                  )}
                </div>

                <div className="p-5 flex flex-col justify-between flex-1 space-y-3">
                  <div className="space-y-1">
                    {slide.title && (
                      <h4 className="text-base font-bold text-[var(--landing-text)] leading-snug">
                        {slide.title}
                      </h4>
                    )}
                    {slide.subtitle && (
                      <p className="text-xs text-[var(--landing-muted)] line-clamp-2">
                        {slide.subtitle}
                      </p>
                    )}
                  </div>

                  {slide.ctaText && (
                    <div>
                      <Link
                        href={
                          slide.ctaLink?.startsWith("/")
                            ? slide.ctaLink
                            : `/stores/${encodeURIComponent(storeSlug)}${slide.ctaLink || "/products"}`
                        }
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--landing-primary)] hover:underline"
                      >
                        <span>{slide.ctaText}</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Store Products Carousel */
        displayProducts.length === 0 ? (
          <div className="py-12 text-center rounded-xl border border-dashed border-[var(--landing-border)] bg-[var(--landing-surface)]/50">
            <p className="text-sm text-[var(--landing-muted)]">No products available in this showcase.</p>
          </div>
        ) : (
          <div
            ref={scrollRef}
            className={`flex items-stretch ${gapClass} overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scrollbar-none scroll-smooth`}
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {displayProducts.map((product) => (
              <div
                key={product.id}
                className="w-[260px] sm:w-[280px] shrink-0 snap-start"
              >
                <ProductCard
                  product={product}
                  storeSlug={storeSlug}
                  storeCurrency={storeCurrency}
                />
              </div>
            ))}
          </div>
        )
      )}
    </section>
  );
}
