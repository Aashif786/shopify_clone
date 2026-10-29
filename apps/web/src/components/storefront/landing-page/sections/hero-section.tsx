"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, ArrowUpRight } from "lucide-react";
import type { StorefrontLandingSectionProps } from "../types";

export interface HeroSectionConfig {
  headline?: string;
  subheading?: string;
  eyebrow?: string;
  ctaText?: string;
  ctaLink?: string;
  cta2Text?: string;
  cta2Link?: string;
  layout?: "split" | "centered" | "minimal";
  textAlignment?: "left" | "center" | "right";
  backgroundStyle?: "gradient" | "solid" | "image";
  backgroundImage?: string;
  overlayOpacity?: number;
  badge?: string;
}

export function HeroSection({
  section,
  storeSlug,
  storeName,
}: StorefrontLandingSectionProps) {
  const cfg = (section.config || {}) as HeroSectionConfig;
  const headline = cfg.headline || `${storeName || "Store"} made memorable.`;
  const subheading =
    cfg.subheading ||
    "Thoughtful pieces, beautiful details, and a little more delight in every delivery. Handcrafted in small batches with sustainable materials.";
  const eyebrow = cfg.eyebrow || "Curated for the everyday";
  const ctaText = cfg.ctaText || "Shop the collection";
  const ctaLink = cfg.ctaLink || `/stores/${encodeURIComponent(storeSlug)}/products`;
  const cta2Text = cfg.cta2Text || "Our story";
  const cta2Link = cfg.cta2Link || `/stores/${encodeURIComponent(storeSlug)}/about`;
  const layout = cfg.layout || "split";
  const textAlignment = cfg.textAlignment || (layout === "centered" ? "center" : "left");
  const backgroundStyle = cfg.backgroundStyle || "gradient";
  const backgroundImage = cfg.backgroundImage || "";
  const overlayOpacity = typeof cfg.overlayOpacity === "number" ? cfg.overlayOpacity : 40;
  const badge = cfg.badge || "NEW SEASONAL ESSENTIALS";

  const resolvedCtaLink = ctaLink.startsWith("/") ? ctaLink : `/stores/${encodeURIComponent(storeSlug)}${ctaLink}`;
  const resolvedCta2Link = cta2Link.startsWith("/") ? cta2Link : `/stores/${encodeURIComponent(storeSlug)}${cta2Link}`;

  const alignClass =
    textAlignment === "center"
      ? "text-center items-center mx-auto"
      : textAlignment === "right"
        ? "text-right items-end ml-auto"
        : "text-left items-start";

  return (
    <section
      className={`storefront-hero relative overflow-hidden pt-12 sm:pt-20 lg:pt-24 pb-12 sm:pb-16 ${
        backgroundStyle === "solid" ? "bg-[var(--landing-surface)]" : ""
      }`}
      style={
        backgroundStyle === "image" && backgroundImage
          ? {
              backgroundImage: `url(${backgroundImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {/* Background Image Overlay if applicable */}
      {backgroundStyle === "image" && backgroundImage && (
        <div
          className="absolute inset-0 bg-background pointer-events-none"
          style={{ opacity: overlayOpacity / 100 }}
        />
      )}

      {/* Ambient Glow Orb for Gradient Style */}
      {backgroundStyle === "gradient" && (
        <div className="absolute top-1/4 right-1/4 w-80 h-80 sm:w-96 sm:h-96 rounded-full bg-[var(--landing-primary)]/15 blur-3xl -z-10 pointer-events-none" />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {layout === "split" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Copy (7 cols) */}
            <div className={`lg:col-span-7 flex flex-col ${alignClass} space-y-6 sm:space-y-8`}>
              {eyebrow && (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--landing-primary)]/10 border border-[var(--landing-primary)]/20 text-[var(--landing-primary)] text-xs font-semibold tracking-wide">
                  <Sparkles size={14} aria-hidden="true" />
                  <span>{eyebrow}</span>
                </div>
              )}

              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-[var(--landing-text)] leading-[1.08]">
                {headline}
              </h1>

              {subheading && (
                <p className="text-base sm:text-lg text-[var(--landing-muted)] leading-relaxed max-w-xl">
                  {subheading}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4 pt-2">
                {ctaText && (
                  <Link
                    href={resolvedCtaLink}
                    className="btn btn-primary btn-lg rounded-2xl px-8 py-3.5 text-sm font-bold shadow-xl hover:shadow-[var(--landing-primary)]/25 transition-all inline-flex items-center gap-2 group"
                  >
                    <span>{ctaText}</span>
                    <ArrowRight
                      size={16}
                      className="group-hover:translate-x-1 transition-transform"
                    />
                  </Link>
                )}

                {cta2Text && (
                  <Link
                    href={resolvedCta2Link}
                    className="px-6 py-3.5 rounded-2xl text-sm font-semibold text-[var(--landing-text)] hover:bg-[var(--landing-surface)] border border-transparent hover:border-[var(--landing-border)] transition-colors inline-flex items-center gap-1.5"
                  >
                    <span>{cta2Text}</span>
                    <ArrowRight size={14} />
                  </Link>
                )}
              </div>
            </div>

            {/* Showcase Visual Card (5 cols) */}
            <div className="lg:col-span-5 relative flex items-center justify-center">
              <div className="relative w-full max-w-sm aspect-[4/5] p-6 rounded-3xl bg-[var(--landing-surface)]/80 backdrop-blur-2xl border border-[var(--landing-border)] shadow-2xl flex flex-col justify-between overflow-hidden">
                <div className="flex items-center justify-between">
                  {badge && (
                    <div className="px-3 py-1.5 rounded-full bg-[var(--landing-primary)]/10 border border-[var(--landing-primary)]/20 text-[var(--landing-primary)] text-[11px] font-bold">
                      {badge}
                    </div>
                  )}
                  <div className="text-[10px] font-mono text-[var(--landing-muted)] font-semibold">
                    EST. 2024
                  </div>
                </div>

                <div className="my-auto py-8 text-center space-y-3">
                  <div className="w-20 h-20 mx-auto rounded-2xl bg-[var(--landing-primary)]/10 text-[var(--landing-primary)] flex items-center justify-center shadow-inner">
                    <Sparkles size={32} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono uppercase tracking-widest text-[var(--landing-muted)]">
                      COLLECTION SPOTLIGHT
                    </span>
                    <strong className="block text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--landing-text)]">
                      {storeName || "Crafted with Care"}
                    </strong>
                    <small className="block text-xs text-[var(--landing-muted)] font-medium">
                      Designed with intention
                    </small>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[var(--landing-background)]/60 border border-[var(--landing-border)]/60 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-[var(--landing-text)]">Handcrafted Drop</div>
                    <div className="text-[11px] text-[var(--landing-muted)]">Verified authentic store</div>
                  </div>
                  <Link
                    href={resolvedCtaLink}
                    className="w-8 h-8 rounded-xl bg-[var(--landing-primary)] text-[var(--landing-button-text)] flex items-center justify-center hover:scale-105 transition-transform"
                  >
                    <ArrowUpRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Centered or Minimal Layout */
          <div className={`max-w-3xl mx-auto flex flex-col ${alignClass} space-y-6 sm:space-y-8`}>
            {eyebrow && (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--landing-primary)]/10 border border-[var(--landing-primary)]/20 text-[var(--landing-primary)] text-xs font-semibold tracking-wide">
                <Sparkles size={14} aria-hidden="true" />
                <span>{eyebrow}</span>
              </div>
            )}

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-[var(--landing-text)] leading-[1.1]">
              {headline}
            </h1>

            {subheading && (
              <p className="text-base sm:text-lg text-[var(--landing-muted)] leading-relaxed max-w-xl">
                {subheading}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              {ctaText && (
                <Link
                  href={resolvedCtaLink}
                  className="btn btn-primary btn-lg rounded-2xl px-8 py-3.5 text-sm font-bold shadow-xl hover:shadow-[var(--landing-primary)]/25 transition-all inline-flex items-center gap-2 group"
                >
                  <span>{ctaText}</span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              )}
              {cta2Text && (
                <Link
                  href={resolvedCta2Link}
                  className="px-6 py-3.5 rounded-2xl text-sm font-semibold text-[var(--landing-text)] hover:bg-[var(--landing-surface)] border border-transparent hover:border-[var(--landing-border)] transition-colors inline-flex items-center gap-1.5"
                >
                  <span>{cta2Text}</span>
                  <ArrowRight size={14} />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
