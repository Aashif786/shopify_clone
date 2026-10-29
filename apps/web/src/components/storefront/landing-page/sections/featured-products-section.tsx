"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import { ProductCard } from "@/components/storefront/products/product-card";
import type { StorefrontLandingSectionProps } from "../types";

export interface FeaturedProductsSectionConfig {
  heading?: string;
  subtitle?: string;
  columns?: number;
  limit?: number;
  viewAllLink?: string;
  productIds?: string[];
}

export function FeaturedProductsSection({
  section,
  storeSlug,
  storeCurrency,
  products = [],
}: StorefrontLandingSectionProps) {
  const cfg = (section.config || {}) as FeaturedProductsSectionConfig;
  const heading = cfg.heading || "Favourites, for good reason.";
  const subtitle = cfg.subtitle || "Explore our most sought-after pieces and latest releases.";
  const columns = Number(cfg.columns) || 4;
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

  const gridClass =
    columns === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : columns === 3
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <section className="storefront-featured max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 py-8 sm:py-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[var(--landing-border)]">
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--landing-primary)]">
            Featured Collection
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--landing-text)]">
            {heading}
          </h2>
          {subtitle && (
            <p className="text-sm text-[var(--landing-muted)]">{subtitle}</p>
          )}
        </div>
        {viewAllLink && (
          <Link
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--landing-primary)] hover:underline shrink-0"
            href={viewAllLink.startsWith("/") ? viewAllLink : `/stores/${encodeURIComponent(storeSlug)}${viewAllLink}`}
          >
            <span>View all products</span>
            <ArrowRight size={15} />
          </Link>
        )}
      </div>

      {displayProducts.length > 0 ? (
        <div className={`grid ${gridClass} gap-6 sm:gap-8`}>
          {displayProducts.map((product) => (
            <ProductCard
              key={product.variantId ? `${product.id}-${product.variantId}` : product.id}
              product={product}
              storeSlug={storeSlug}
              storeCurrency={storeCurrency}
            />
          ))}
        </div>
      ) : (
        <div className="max-w-md mx-auto py-16 text-center space-y-3">
          <Star size={28} className="mx-auto text-[var(--landing-muted)] opacity-50" aria-hidden="true" />
          <p className="text-sm font-medium text-[var(--landing-muted)]">
            Products will appear here once added to your store catalog.
          </p>
        </div>
      )}
    </section>
  );
}
