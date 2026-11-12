"use client";

import React from "react";
import { Quote } from "lucide-react";
import type { StorefrontLandingSectionProps } from "../types";

interface PillarItem {
  title: string;
  desc: string;
}

export interface BrandStorySectionConfig {
  heading?: string;
  quote?: string;
  quoteAuthor?: string;
  quoteAuthorRole?: string;
  storyText?: string;
  storyParagraphs?: string[];
  pillars?: PillarItem[];
}

export function BrandStorySection({
  section,
  storeName,
}: StorefrontLandingSectionProps) {
  const cfg = (section.config || {}) as BrandStorySectionConfig;
  const heading = cfg.heading || `The Story Behind ${storeName || "Our Brand"}`;
  // Only merchant-authored copy is rendered; no placeholder quote, founders or pillars.
  const quote = cfg.quote?.trim() || "";
  const quoteAuthor = cfg.quoteAuthor?.trim() || "";
  const quoteAuthorRole = cfg.quoteAuthorRole?.trim() || "";

  const storyParagraphs: string[] =
    typeof cfg.storyText === "string" && cfg.storyText
      ? [cfg.storyText]
      : Array.isArray(cfg.storyParagraphs)
        ? cfg.storyParagraphs.filter(Boolean)
        : [];

  const pillars: PillarItem[] = Array.isArray(cfg.pillars) ? cfg.pillars.filter((p) => p?.title) : [];

  if (!quote && storyParagraphs.length === 0 && pillars.length === 0) return null;

  return (
    <section className="storefront-brand-story max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-12">
      {/* Pull Quote Header */}
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="inline-flex p-3 rounded-full bg-[var(--landing-surface)] border border-[var(--landing-border)] text-[var(--landing-primary)] shadow-xs">
          <Quote className="w-6 h-6 rotate-180" />
        </div>
        {heading && (
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--landing-primary)] block">
            {heading}
          </span>
        )}
        {quote && (
          <blockquote className="text-xl sm:text-3xl font-serif italic text-[var(--landing-text)] leading-snug">
            "{quote}"
          </blockquote>
        )}
        {quote && quoteAuthor && (
          <div className="space-y-0.5">
            <p className="text-sm font-bold text-[var(--landing-text)]">{quoteAuthor}</p>
            {quoteAuthorRole && <p className="text-xs text-[var(--landing-muted)]">{quoteAuthorRole}</p>}
          </div>
        )}
      </div>

      {/* Narrative Split */}
      <div className="pt-6 border-t border-[var(--landing-border)] grid grid-cols-1 md:grid-cols-2 gap-8 text-left text-sm sm:text-base text-[var(--landing-muted)] leading-relaxed">
        {storyParagraphs.map((para: string, idx: number) => (
          <p key={idx}>{para}</p>
        ))}
      </div>

      {/* Brand Pillars */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6">
        {pillars.map((pillar: PillarItem, idx: number) => (
          <div
            key={idx}
            className="p-6 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)]/70 text-left space-y-2 hover:border-[var(--landing-primary)]/40 transition-colors"
          >
            <span className="text-xs font-mono font-bold text-[var(--landing-primary)]">
              0{idx + 1}
            </span>
            <h4 className="text-base font-bold text-[var(--landing-text)]">
              {pillar.title}
            </h4>
            <p className="text-xs text-[var(--landing-muted)] leading-relaxed">
              {pillar.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
