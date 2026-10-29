"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, Layers } from "lucide-react";
import type { StorefrontLandingSectionProps } from "../types";

interface CollectionShowcaseItem {
  id?: string;
  name: string;
  slug?: string;
  description?: string;
  productCount?: number;
  products_count?: number;
  imageUrl?: string;
}

export interface CollectionShowcaseSectionConfig {
  heading?: string;
  subtitle?: string;
  columns?: number;
  viewAllLink?: string;
  items?: CollectionShowcaseItem[];
}

export function CollectionShowcaseSection({
  section,
  storeSlug,
  collections = [],
}: StorefrontLandingSectionProps) {
  const cfg = (section.config || {}) as CollectionShowcaseSectionConfig;
  const heading = cfg.heading || "Shop by Category";
  const subtitle = cfg.subtitle || "Browse through our thoughtfully structured collections";
  const columns = Number(cfg.columns) || 3;
  const viewAllLink = cfg.viewAllLink || `/stores/${encodeURIComponent(storeSlug)}/collections`;
  const items = Array.isArray(cfg.items) && cfg.items.length > 0 ? cfg.items : collections;

  // Fallback demo items if no collections configured or empty
  const displayCollections =
    items.length > 0
      ? items
      : [
          {
            id: "col-1",
            name: "Apparel & Essentials",
            slug: "apparel",
            description: "Signature everyday wear",
            productCount: 12,
            imageUrl: "",
          },
          {
            id: "col-2",
            name: "Accessories & Carry",
            slug: "accessories",
            description: "Built for modern journeys",
            productCount: 8,
            imageUrl: "",
          },
          {
            id: "col-3",
            name: "Home & Objects",
            slug: "home",
            description: "Refined aesthetic accents",
            productCount: 15,
            imageUrl: "",
          },
        ];

  const gridClass =
    columns === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : columns === 4
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="storefront-collections max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 py-8 sm:py-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[var(--landing-border)]">
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--landing-primary)]">
            Explore Collections
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

        <Link
          href={viewAllLink.startsWith("/") ? viewAllLink : `/stores/${encodeURIComponent(storeSlug)}${viewAllLink}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--landing-primary)] hover:underline"
        >
          <span>All collections</span>
          <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>

      <div className={`grid ${gridClass} gap-6`}>
        {(displayCollections as CollectionShowcaseItem[]).map((col: CollectionShowcaseItem, idx: number) => {
          const colSlug = col.slug || col.name?.toLowerCase().replace(/\s+/g, "-") || `category-${idx + 1}`;
          const href = `/stores/${encodeURIComponent(storeSlug)}/collections/${encodeURIComponent(colSlug)}`;
          return (
            <Link
              key={col.id || idx}
              href={href}
              className="group relative block overflow-hidden rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6 transition-all duration-300 hover:border-[var(--landing-primary)]/50 hover:shadow-xl"
            >
              <div className="aspect-video w-full rounded-xl overflow-hidden bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center relative mb-4">
                {col.imageUrl ? (
                  <img
                    src={col.imageUrl}
                    alt={col.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-neutral-400 group-hover:text-primary transition-colors">
                    <Layers className="w-10 h-10 mb-2 opacity-60" />
                    <span className="text-xs font-medium uppercase tracking-wider">Curated Collection</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-3 left-3 text-xs font-medium text-white/90 bg-black/40 backdrop-blur-xs px-2.5 py-1 rounded-full border border-white/10">
                  {col.productCount ?? col.products_count ?? "Curated"} items
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-[var(--landing-text)] group-hover:text-[var(--landing-primary)] transition-colors">
                    {col.name}
                  </h3>
                  <ArrowUpRight className="w-4 h-4 text-[var(--landing-muted)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--landing-primary)]" />
                </div>
                {col.description && (
                  <p className="text-xs text-[var(--landing-muted)] line-clamp-2">
                    {col.description}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
