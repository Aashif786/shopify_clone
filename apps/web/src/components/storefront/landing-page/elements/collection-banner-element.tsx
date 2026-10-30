"use client";

import React from "react";
import Link from "next/link";
import type { PageElement } from "@calcart/stores/landing-page";
import { ArrowRight, Layers } from "lucide-react";

interface CollectionBannerElementProps {
  element: PageElement;
  storeSlug: string;
  collections?: Array<{ id: string; name: string; slug?: string; imageUrl?: string; productCount?: number }>;
}

export function CollectionBannerElement({
  element,
  storeSlug,
  collections = [],
}: CollectionBannerElementProps) {
  const content = (element.content || {}) as {
    collectionId?: string;
    title?: string;
    subtitle?: string;
    imageUrl?: string;
    ctaText?: string;
  };

  const selectedCol = collections.find((c) => c.id === content.collectionId) || collections[0];

  const title = content.title || selectedCol?.name || "Featured Collection";
  const subtitle = content.subtitle || `${selectedCol?.productCount || "Explore"} curated essentials`;
  const imageUrl =
    content.imageUrl ||
    selectedCol?.imageUrl ||
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80";
  const ctaText = content.ctaText || "Shop Collection";

  const slug = selectedCol?.slug || "all";
  const href = `/stores/${encodeURIComponent(storeSlug)}/collections/${encodeURIComponent(slug)}`;

  return (
    <div className="relative w-full overflow-hidden rounded-3xl aspect-[16/7] md:aspect-[21/8] shadow-xl border border-border/40 group">
      <img
        src={imageUrl}
        alt={title}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
      <div className="relative z-10 h-full flex flex-col justify-center p-8 sm:p-12 md:p-16 max-w-xl text-white space-y-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
          <Layers className="w-3.5 h-3.5" />
          <span>Collection</span>
        </span>
        <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
          {title}
        </h3>
        <p className="text-sm sm:text-base text-gray-300 leading-relaxed max-w-md">
          {subtitle}
        </p>
        <div className="pt-2">
          <Link
            href={href}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold bg-white text-black hover:bg-gray-100 transition-all shadow-md active:scale-[0.98]"
          >
            <span>{ctaText}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
