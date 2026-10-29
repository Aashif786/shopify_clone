"use client";

import React, { useRef, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { ProductCard } from "@/components/storefront/products/product-card";
import type { StorefrontLandingSectionProps } from "../types";

export interface ProductCarouselSectionConfig {
  heading?: string;
  subtitle?: string;
  limit?: number;
  viewAllLink?: string;
  productIds?: string[];
}

export function ProductCarouselSection({
  section,
  storeSlug,
  storeCurrency,
  products = [],
}: StorefrontLandingSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const cfg = (section.config || {}) as ProductCarouselSectionConfig;
  const heading = cfg.heading || "Trending Releases";
  const subtitle = cfg.subtitle || "Swipe through our newest curated selections";
  const limit = Number(cfg.limit) || 8;
  const viewAllLink = cfg.viewAllLink || `/stores/${encodeURIComponent(storeSlug)}/products`;
  const selectedProductIds: string[] = Array.isArray(cfg.productIds) ? cfg.productIds : [];

  const displayProducts = useMemo(() => {
    let list = [...products];
    if (selectedProductIds.length > 0) {
      list = list.filter((p) => selectedProductIds.includes(p.id));
    }
    return list.slice(0, limit);
  }, [products, selectedProductIds, limit]);

  const handleScroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const offset = direction === "left" ? -340 : 340;
    scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  return (
    <section className="storefront-carousel max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 py-8 sm:py-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[var(--landing-border)]">
        <div className="space-y-1">
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

          <Link
            href={viewAllLink.startsWith("/") ? viewAllLink : `/stores/${encodeURIComponent(storeSlug)}${viewAllLink}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--landing-primary)] hover:underline ml-2"
          >
            <span>View all</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {displayProducts.length === 0 ? (
        <div className="py-12 text-center rounded-xl border border-dashed border-[var(--landing-border)] bg-[var(--landing-surface)]/50">
          <p className="text-sm text-[var(--landing-muted)]">No products available in this showcase.</p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex items-stretch gap-6 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scrollbar-none scroll-smooth"
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
      )}
    </section>
  );
}
