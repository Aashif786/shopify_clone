"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, Flame, Sparkles } from "lucide-react";
import type { StorefrontLandingSectionProps } from "../types";

interface SecondaryCardItem {
  title: string;
  description: string;
  badge?: string;
  link?: string;
  image?: string;
}

export interface AsymmetricShowcaseSectionConfig {
  heading?: string;
  subtitle?: string;
  spotlightTitle?: string;
  spotlightSubtitle?: string;
  spotlightBadge?: string;
  spotlightLink?: string;
  spotlightImage?: string;
  secondaryCards?: SecondaryCardItem[];
}

export function AsymmetricShowcaseSection({
  section,
  storeSlug,
}: StorefrontLandingSectionProps) {
  const cfg = (section.config || {}) as AsymmetricShowcaseSectionConfig;
  const heading = cfg.heading || "Featured Spotlights";
  const subtitle = cfg.subtitle || "Handpicked pieces designed to make a statement";

  const spotlightTitle = cfg.spotlightTitle || "The Signature Series";
  const spotlightSubtitle =
    cfg.spotlightSubtitle ||
    "Engineered with premium materials and precision-finished for a lasting silhouette.";
  const spotlightBadge = cfg.spotlightBadge || "SPOTLIGHT";
  const spotlightLink = cfg.spotlightLink || `/stores/${encodeURIComponent(storeSlug)}/products`;
  const spotlightImage = cfg.spotlightImage || "";

  const secondaryCards = Array.isArray(cfg.secondaryCards) && cfg.secondaryCards.length > 0
    ? cfg.secondaryCards
    : [
        {
          title: "Seasonal Essentials",
          description: "Effortless versatility for daily rituals and modern transit.",
          badge: "NEW ARRIVALS",
          link: `/stores/${encodeURIComponent(storeSlug)}/products`,
          image: "",
        },
        {
          title: "The Archival Release",
          description: "Limited re-release of our most requested timeless silhouettes.",
          badge: "LIMITED",
          link: `/stores/${encodeURIComponent(storeSlug)}/products`,
          image: "",
        },
      ];

  const resolvedSpotlightLink = spotlightLink.startsWith("/")
    ? spotlightLink
    : `/stores/${encodeURIComponent(storeSlug)}${spotlightLink}`;

  return (
    <section className="storefront-asymmetric max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      <div className="space-y-1 pb-4 border-b border-[var(--landing-border)]">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--landing-primary)] inline-flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5" />
          <span>Curated Highlights</span>
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--landing-text)]">
          {heading}
        </h2>
        {subtitle && (
          <p className="text-sm text-[var(--landing-muted)] max-w-xl">{subtitle}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Large Primary Spotlight Card (7 cols) */}
        <div className="lg:col-span-7">
          <Link
            href={resolvedSpotlightLink}
            className="group relative flex flex-col justify-end h-full min-h-[360px] sm:min-h-[440px] rounded-2xl overflow-hidden border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6 sm:p-8 transition-all duration-300 hover:border-[var(--landing-primary)]/60 hover:shadow-2xl"
          >
            {spotlightImage ? (
              <img
                src={spotlightImage}
                alt={spotlightTitle}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-tr from-[var(--landing-surface)] via-neutral-900 to-neutral-800" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />

            <div className="relative z-10 space-y-3">
              {spotlightBadge && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[var(--landing-primary)] text-[var(--landing-button-text)]">
                  <Sparkles className="w-3 h-3" />
                  <span>{spotlightBadge}</span>
                </span>
              )}
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white group-hover:text-[var(--landing-primary)] transition-colors">
                {spotlightTitle}
              </h3>
              <p className="text-sm sm:text-base text-neutral-300 max-w-lg line-clamp-2">
                {spotlightSubtitle}
              </p>
              <div className="pt-2 inline-flex items-center gap-2 text-sm font-semibold text-white group-hover:text-[var(--landing-primary)]">
                <span>Discover the showcase</span>
                <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </div>
          </Link>
        </div>

        {/* Secondary Stacked Cards (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {secondaryCards.slice(0, 2).map((card: SecondaryCardItem, idx: number) => {
            const cardLink = card.link?.startsWith("/")
              ? card.link
              : `/stores/${encodeURIComponent(storeSlug)}${card.link || "/products"}`;
            return (
              <Link
                key={idx}
                href={cardLink}
                className="group relative flex-1 flex flex-col justify-end min-h-[180px] rounded-2xl overflow-hidden border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6 transition-all duration-300 hover:border-[var(--landing-primary)]/50 hover:shadow-lg"
              >
                {card.image ? (
                  <img
                    src={card.image}
                    alt={card.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 to-neutral-950" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

                <div className="relative z-10 space-y-1.5">
                  {card.badge && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--landing-primary)]">
                      {card.badge}
                    </span>
                  )}
                  <h4 className="text-lg font-bold text-white group-hover:text-[var(--landing-primary)] transition-colors">
                    {card.title}
                  </h4>
                  <p className="text-xs text-neutral-300 line-clamp-2">
                    {card.description}
                  </p>
                  <div className="pt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-white/90 group-hover:text-[var(--landing-primary)]">
                    <span>View item</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
