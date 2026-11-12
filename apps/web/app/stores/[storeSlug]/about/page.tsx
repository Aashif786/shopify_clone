"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { StorefrontLandingPageConfig } from "@calcart/stores/landing-page";
import { StorefrontShell } from "../../../../src/components/storefront/StorefrontShell";
import { apiClient } from "../../../../src/lib/api-client";
import type { BrandStorySectionConfig } from "../../../../src/components/storefront/landing-page/sections/brand-story-section";

interface StoreAboutPageProps {
  params: Promise<{ storeSlug: string }>;
}

interface LandingResponse {
  store: { id: string; name: string; slug: string; currency: string };
  config: StorefrontLandingPageConfig | null;
}

/**
 * About page. Shows only what the merchant has actually written (their visible
 * "brand story" landing section). It never invents provenance, sourcing, founder
 * or policy copy; with no merchant story it renders a plain, honest page.
 */
export default function StoreAboutPage({ params }: StoreAboutPageProps) {
  const { storeSlug } = use(params);
  const [data, setData] = useState<LandingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<LandingResponse>(`/api/v1/storefront/${encodeURIComponent(storeSlug)}/landing-page`)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeSlug]);

  const storeName = data?.store?.name ?? "Store";
  const story = data?.config?.sections?.find((s) => s.type === "brand_story" && s.isVisible);
  const cfg = (story?.config ?? {}) as BrandStorySectionConfig;
  const paragraphs =
    typeof cfg.storyText === "string" && cfg.storyText.trim()
      ? [cfg.storyText.trim()]
      : Array.isArray(cfg.storyParagraphs)
        ? cfg.storyParagraphs.filter((p) => typeof p === "string" && p.trim())
        : [];
  const pillars = Array.isArray(cfg.pillars) ? cfg.pillars.filter((p) => p?.title) : [];
  const base = `/stores/${encodeURIComponent(storeSlug)}`;

  return (
        <StorefrontShell storeName={storeName} storeSlug={storeSlug} theme={data?.config?.theme}>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 space-y-10">
            {isLoading ? (
              <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading">
                <div className="h-10 w-2/3 rounded-xl bg-muted/70" />
                <div className="h-4 w-full rounded bg-muted/50" />
                <div className="h-4 w-5/6 rounded bg-muted/50" />
              </div>
            ) : (
              <>
                <header className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">About</p>
                  <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground">
                    {cfg.heading?.trim() || storeName}
                  </h1>
                </header>

                {paragraphs.length > 0 ? (
                  <div className="space-y-4 text-base sm:text-lg leading-relaxed text-muted-foreground">
                    {paragraphs.map((text, i) => (
                      <p key={i}>{text}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-base text-muted-foreground leading-relaxed">
                    {storeName} hasn&apos;t published a story yet. You can browse the catalog and collections below.
                  </p>
                )}

                {pillars.length > 0 && (
                  <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4 list-none p-0 m-0">
                    {pillars.map((pillar) => (
                      <li key={pillar.title} className="rounded-2xl border border-border/60 bg-card/60 p-5 space-y-1.5">
                        <h2 className="font-semibold text-foreground">{pillar.title}</h2>
                        {pillar.desc && <p className="text-sm text-muted-foreground leading-relaxed">{pillar.desc}</p>}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-wrap gap-3 pt-2">
                  <Link href={`${base}/products`} className="btn btn-primary btn-md rounded-xl px-6 py-2.5 text-sm font-semibold inline-flex items-center gap-2">
                    <span>Browse products</span>
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                  <Link href={`${base}/collections`} className="btn btn-outline btn-md rounded-xl px-6 py-2.5 text-sm font-semibold inline-flex items-center gap-2">
                    <span>View collections</span>
                  </Link>
                </div>
              </>
            )}
          </div>
        </StorefrontShell>
  );
}
