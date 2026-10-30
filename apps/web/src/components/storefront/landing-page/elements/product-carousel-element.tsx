"use client";

import React, { useRef } from "react";
import type { PageElement } from "@calcart/stores/landing-page";
import type { ProductSummaryDTO } from "@calcart/products";
import { ProductCard } from "@/components/storefront/products/product-card";
import { ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";

interface ProductCarouselElementProps {
  element: PageElement;
  storeSlug: string;
  storeCurrency?: string;
  products?: ProductSummaryDTO[];
}

export function ProductCarouselElement({
  element,
  storeSlug,
  storeCurrency = "USD",
  products = [],
}: ProductCarouselElementProps) {
  const content = (element.content || {}) as {
    limit?: number;
  };

  const limit = Number(content.limit) || 8;
  const displayProducts = products.slice(0, limit);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const distance = 320;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
  };

  if (displayProducts.length === 0) {
    return (
      <div className="w-full py-12 px-6 rounded-2xl border border-dashed border-border text-center bg-card/20">
        <ShoppingBag className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
        <p className="text-sm font-semibold text-foreground">Product Carousel</p>
        <p className="text-xs text-muted-foreground mt-1">
          Add products to your store to enable the carousel slider.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full group">
      {/* Controls */}
      <button
        onClick={() => scroll("left")}
        aria-label="Previous products"
        className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-background/90 border border-border shadow-md flex items-center justify-center text-foreground hover:bg-background transition-opacity opacity-0 group-hover:opacity-100"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={() => scroll("right")}
        aria-label="Next products"
        className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-background/90 border border-border shadow-md flex items-center justify-center text-foreground hover:bg-background transition-opacity opacity-0 group-hover:opacity-100"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Snap Scroll Strip */}
      <div
        ref={scrollRef}
        className="flex gap-5 overflow-x-auto scroll-smooth pb-4 pt-1 px-1 scrollbar-none snap-x snap-mandatory"
        style={{ scrollbarWidth: "none" }}
      >
        {displayProducts.map((product) => (
          <div
            key={product.variantId ? `${product.id}-${product.variantId}` : product.id}
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
    </div>
  );
}
