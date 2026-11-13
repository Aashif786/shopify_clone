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
        <StorefrontShell storeName={storeName} storeSlug={storeSlug} theme={data?.config?.theme} fullBleed>
          <div className="at-container pb-24 pt-8 sm:pt-14 space-y-12">
            {isLoading ? (
              <div className="space-y-4 " aria-busy="true" aria-label="Loading">
                <div className="h-10 w-2/3 rounded-none bg-muted/70" />
                <div className="h-4 w-full rounded bg-muted/50" />
                <div className="h-4 w-5/6 rounded bg-muted/50" />
              </div>
            ) : (
              <>
                <header className="space-y-3">
                  <p className="at-eyebrow text-muted-foreground">About</p>
                  <h1 className="at-display-xl text-foreground">
                    {cfg.heading?.trim() || storeName}
                  </h1>
                </header>

                {paragraphs.length > 0 ? (
                  <div className="space-y-5 at-lede max-w-2xl text-muted-foreground">
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
                      <li key={pillar.title} className="rounded-none border border-[color:var(--at-hairline)] bg-transparent p-5 space-y-1.5">
                        <h2 className="font-semibold text-foreground">{pillar.title}</h2>
                        {pillar.desc && <p className="text-sm text-muted-foreground leading-relaxed">{pillar.desc}</p>}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-wrap gap-3 pt-2">
                  <Link href={`${base}/products`} className="btn btn-primary btn-md rounded-none px-6 py-2.5 text-sm font-semibold inline-flex items-center gap-2">
                    <span>Browse products</span>
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                  <Link href={`${base}/collections`} className="btn btn-outline btn-md rounded-none px-6 py-2.5 text-sm font-semibold inline-flex items-center gap-2">
                    <span>View collections</span>
                  </Link>
                </div>
              </>
            )}
          </div>
        </StorefrontShell>
  );
}
