"use client";

import Link from "next/link";
import React, { useState, useEffect } from "react";
import { Eye } from "lucide-react";

import { useCurrency } from "../../../context/currency-context";

export interface RecentlyViewedItem {
  id: string;
  slug: string;
  title: string;
  price?: number | null;
  currency?: string | null;
  primaryMediaUrl?: string | null;
}

export interface RecentlyViewedShelfProps {
  storeSlug: string;
  onQuickView?: (slug: string) => void;
}

export function RecentlyViewedShelf({ storeSlug, onQuickView }: RecentlyViewedShelfProps) {
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);
  const { convertPrice } = useCurrency();

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(`cc_${storeSlug}_recently_viewed`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setItems(parsed.slice(0, 6));
        }
      }
    } catch {
      // Ignore
    }
  }, [storeSlug]);

  if (items.length === 0) return null;

  return (
    <section
      className="recently-viewed-shelf pt-10 pb-6 border-t border-[color:var(--at-hairline)] space-y-4"
      aria-label="Recently viewed products"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          
          <h2 className="at-title text-xl text-foreground">Recently Viewed</h2>
        </div>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.removeItem(`cc_${storeSlug}_recently_viewed`);
              setItems([]);
            } catch {
              // Ignore storage errors
            }
          }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear History
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {items.map((item) => {
          const productHref = `/stores/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(item.slug)}`;
          const priceConversion = item.price != null ? convertPrice(item.price) : null;

          return (
            <div
              key={item.id}
              className="group relative rounded-none border border-[color:var(--at-hairline)]  p-3 flex flex-col justify-between hover:border-primary/40  transition-all"
            >
              <div className="relative aspect-square w-full rounded-none overflow-hidden bg-muted/30 mb-2.5">
                {item.primaryMediaUrl ? (
                  <img
                    src={item.primaryMediaUrl}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                    No image
                  </div>
                )}
                {onQuickView && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      onQuickView(item.slug);
                    }}
                    className="absolute bottom-2 right-2 p-1.5 rounded-none bg-background/90 text-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-xs"
                    aria-label={`Quick view ${item.title}`}
                  >
                    <Eye size={13} />
                  </button>
                )}
              </div>

              <div className="space-y-1">
                <Link
                  href={productHref}
                  className="text-xs font-semibold text-foreground hover:text-primary transition-colors block line-clamp-1"
                >
                  {item.title}
                </Link>
                <span className="text-xs font-bold text-foreground block">
                  {priceConversion ? priceConversion.presentmentFormatted : "—"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
