"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Copy, Tag } from "lucide-react";
import type { StorefrontLandingSectionProps } from "../types";

export interface PromotionalBannerSectionConfig {
  bannerText?: string;
  highlightCode?: string;
  badgeText?: string;
  link?: string;
  style?: "accent" | "minimal" | "gradient";
}

export function PromotionalBannerSection({
  section,
  storeSlug,
}: StorefrontLandingSectionProps) {
  const [copied, setCopied] = useState(false);
  const cfg = (section.config || {}) as PromotionalBannerSectionConfig;
  const bannerText = cfg.bannerText || "Complimentary shipping on orders over $75";
  const highlightCode = cfg.highlightCode || "WELCOME20";
  const badgeText = cfg.badgeText || "LIMITED OFFER";
  const link = cfg.link || `/stores/${encodeURIComponent(storeSlug)}/products`;
  const style = cfg.style || "accent"; // "accent" | "minimal" | "gradient"

  const handleCopyCode = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!highlightCode) return;
    try {
      await navigator.clipboard.writeText(highlightCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const resolvedLink = link.startsWith("/") ? link : `/stores/${encodeURIComponent(storeSlug)}${link}`;

  return (
    <section className="storefront-promo max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
      <div
        className={`relative overflow-hidden rounded-2xl border border-[var(--landing-border)] px-6 py-6 sm:px-8 sm:py-8 flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-300 ${
          style === "accent"
            ? "bg-[var(--landing-surface)] shadow-lg"
            : style === "gradient"
              ? "bg-gradient-to-r from-[var(--landing-surface)] via-[var(--landing-border)]/30 to-[var(--landing-surface)] shadow-md"
              : "bg-[var(--landing-surface)]/60"
        }`}
      >
        {/* Decorative corner accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--landing-primary)]/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />

        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left z-10">
          {badgeText && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[var(--landing-primary)] text-[var(--landing-button-text)] shrink-0">
              <Tag className="w-3 h-3" />
              <span>{badgeText}</span>
            </span>
          )}
          <p className="text-base sm:text-lg font-medium text-[var(--landing-text)]">
            {bannerText}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 shrink-0 z-10">
          {highlightCode && (
            <button
              type="button"
              onClick={handleCopyCode}
              title="Click to copy code"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-dashed border-[var(--landing-primary)]/50 bg-[var(--landing-background)] hover:bg-[var(--landing-surface)] text-xs font-mono font-bold text-[var(--landing-text)] transition-colors active:scale-95 cursor-pointer"
            >
              <span className="text-[var(--landing-primary)] tracking-wider">
                {highlightCode}
              </span>
              {copied ? (
                <span className="inline-flex items-center text-emerald-400 gap-1 text-[11px] font-sans font-semibold">
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied</span>
                </span>
              ) : (
                <Copy className="w-3.5 h-3.5 text-[var(--landing-muted)] hover:text-[var(--landing-text)]" />
              )}
            </button>
          )}

          {link && (
            <Link
              href={resolvedLink}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--landing-primary)] text-[var(--landing-button-text)] text-xs sm:text-sm font-semibold hover:opacity-90 transition-opacity active:scale-95"
            >
              <span>Explore collection</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
