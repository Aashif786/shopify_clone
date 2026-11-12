"use client";

import React from "react";
import { Check, ShieldCheck, Sparkles, Star, Truck, Heart } from "lucide-react";
import type { StorefrontLandingSectionProps } from "../types";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  sparkles: Sparkles,
  check: Check,
  truck: Truck,
  shield: ShieldCheck,
  heart: Heart,
};

interface TrustBadgeItem {
  icon: string;
  title: string;
  description: string;
}

interface ReviewItem {
  quote: string;
  author: string;
  role?: string;
  rating?: number;
}

export interface TestimonialsSectionConfig {
  heading?: string;
  subtitle?: string;
  badges?: TrustBadgeItem[];
  items?: ReviewItem[];
}

export function TestimonialsSection({
  section,
}: StorefrontLandingSectionProps) {
  const cfg = (section.config || {}) as TestimonialsSectionConfig;
  const heading = cfg.heading || "Why customers choose us";
  const subtitle = cfg.subtitle || "";

  // Only merchant-authored badges and reviews are shown. Nothing is invented.
  const badges: TrustBadgeItem[] = Array.isArray(cfg.badges) ? cfg.badges : [];
  const items: ReviewItem[] = Array.isArray(cfg.items) ? cfg.items : [];

  if (badges.length === 0 && items.length === 0) return null;

  return (
    <section className="storefront-testimonials max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      {/* Trust Badges Bar */}
      {badges.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-6 sm:p-8 rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)]/60">
          {(badges as TrustBadgeItem[]).map((b: TrustBadgeItem, idx: number) => {
            const IconComponent = ICON_MAP[b.icon] || Sparkles;
            return (
              <div key={idx} className="flex items-start gap-3.5">
                <div className="p-2 rounded-lg bg-[var(--landing-primary)]/10 text-[var(--landing-primary)] shrink-0">
                  <IconComponent className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-sm font-bold text-[var(--landing-text)]">
                    {b.title}
                  </h4>
                  <p className="text-xs text-[var(--landing-muted)] leading-relaxed">
                    {b.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reviews Grid */}
      {items.length > 0 && (
        <div className="space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--landing-text)]">
              {heading}
            </h3>
            {subtitle && (
              <p className="text-sm text-[var(--landing-muted)]">{subtitle}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(items as ReviewItem[]).map((rev: ReviewItem, idx: number) => {
              const rating = Math.min(Math.max(Number(rev.rating) || 0, 0), 5);
              return (
                <div
                  key={idx}
                  className="p-6 rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] flex flex-col justify-between space-y-4 hover:border-[var(--landing-primary)]/40 transition-colors shadow-sm"
                >
                  <div className="space-y-3">
                    {/* Stars */}
                    {rating > 0 && (
                    <div className="flex items-center gap-1 text-amber-400">
                      {Array.from({ length: 5 }).map((_, sIdx) => (
                        <Star
                          key={sIdx}
                          className={`w-4 h-4 ${
                            sIdx < rating ? "fill-amber-400" : "text-neutral-600"
                          }`}
                        />
                      ))}
                    </div>
                    )}
                    <blockquote className="text-sm sm:text-base text-[var(--landing-text)] italic leading-relaxed">
                      "{rev.quote}"
                    </blockquote>
                  </div>

                  <div className="pt-3 border-t border-[var(--landing-border)]">
                    <p className="text-xs font-bold text-[var(--landing-text)]">
                      {rev.author}
                    </p>
                    {rev.role && (
                      <p className="text-[11px] text-[var(--landing-muted)]">
                        {rev.role}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
