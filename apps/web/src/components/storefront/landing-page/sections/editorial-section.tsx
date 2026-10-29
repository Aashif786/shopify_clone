"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Compass, Sparkles } from "lucide-react";
import type { StorefrontLandingSectionProps } from "../types";

export interface EditorialSectionConfig {
  heading?: string;
  eyebrow?: string;
  description?: string;
  secondaryText?: string;
  imageUrl?: string;
  imagePosition?: "left" | "right";
  ctaText?: string;
  ctaLink?: string;
}

export function EditorialSection({
  section,
  storeSlug,
}: StorefrontLandingSectionProps) {
  const cfg = (section.config || {}) as EditorialSectionConfig;
  const heading = cfg.heading || "Crafted with Intention & Care";
  const eyebrow = cfg.eyebrow || "Our Philosophy";
  const description =
    cfg.description ||
    "We partner with independent makers and sustainable mills to craft objects that balance enduring utility with architectural simplicity.";
  const secondaryText =
    cfg.secondaryText ||
    "Every batch is produced in limited runs to minimize waste and ensure every detail meets our uncompromising standards.";
  const imageUrl = cfg.imageUrl || "";
  const imagePosition = cfg.imagePosition || "right"; // "left" | "right"
  const ctaText = cfg.ctaText || "Explore our story";
  const ctaLink = cfg.ctaLink || `/stores/${encodeURIComponent(storeSlug)}/about`;
  const resolvedCtaLink = ctaLink.startsWith("/") ? ctaLink : `/stores/${encodeURIComponent(storeSlug)}${ctaLink}`;

  const imageOrder = imagePosition === "left" ? "lg:order-1" : "lg:order-2";
  const textOrder = imagePosition === "left" ? "lg:order-2" : "lg:order-1";

  return (
    <section className="storefront-editorial max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
        {/* Text Column */}
        <div className={`lg:col-span-6 space-y-6 ${textOrder}`}>
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--landing-primary)] inline-flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              <span>{eyebrow}</span>
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[var(--landing-text)] leading-tight">
              {heading}
            </h2>
          </div>

          <div className="space-y-4 text-base sm:text-lg leading-relaxed text-[var(--landing-muted)]">
            <p>{description}</p>
            {secondaryText && (
              <p className="text-sm sm:text-base border-l-2 border-[var(--landing-primary)]/40 pl-4 py-1 italic text-[var(--landing-text)]/90">
                {secondaryText}
              </p>
            )}
          </div>

          {ctaText && (
            <div className="pt-2">
              <Link
                href={resolvedCtaLink}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--landing-primary)] text-[var(--landing-button-text)] font-semibold text-sm hover:opacity-90 transition-opacity active:scale-95 shadow-md"
              >
                <span>{ctaText}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>

        {/* Image Column */}
        <div className={`lg:col-span-6 ${imageOrder}`}>
          <div className="relative aspect-4/3 sm:aspect-16/10 rounded-2xl overflow-hidden border border-[var(--landing-border)] bg-[var(--landing-surface)] shadow-xl">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={heading}
                className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-[var(--landing-surface)] to-[var(--landing-border)]/40 text-center space-y-3">
                <Sparkles className="w-12 h-12 text-[var(--landing-primary)]/70 animate-pulse" />
                <p className="text-xs uppercase tracking-widest text-[var(--landing-muted)]">
                  Editorial Visual Showcase
                </p>
                <div className="max-w-xs text-xs text-[var(--landing-muted)]">
                  Add custom imagery in the Landing Page Builder to spotlight studio craftsmanship.
                </div>
              </div>
            )}
            <div className="absolute inset-0 ring-1 ring-inset ring-white/10 pointer-events-none rounded-2xl" />
          </div>
        </div>
      </div>
    </section>
  );
}
