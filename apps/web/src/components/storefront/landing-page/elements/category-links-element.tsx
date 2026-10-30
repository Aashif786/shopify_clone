"use client";

import React from "react";
import Link from "next/link";
import type { PageElement } from "@calcart/stores/landing-page";
import { Tag } from "lucide-react";

interface CategoryLinksElementProps {
  element: PageElement;
  storeSlug: string;
  collections?: Array<{ id: string; name: string; slug?: string; imageUrl?: string; productCount?: number }>;
}

export function CategoryLinksElement({
  element,
  storeSlug,
  collections = [],
}: CategoryLinksElementProps) {
  const content = (element.content || {}) as {
    style?: "pills" | "cards";
    showCount?: boolean;
  };
  const style = element.style || {};

  const displayCollections =
    collections.length > 0
      ? collections
      : [
          { id: "1", name: "New Arrivals", slug: "new-arrivals", productCount: 12 },
          { id: "2", name: "Bestsellers", slug: "bestsellers", productCount: 24 },
          { id: "3", name: "Apparel", slug: "apparel", productCount: 18 },
          { id: "4", name: "Accessories", slug: "accessories", productCount: 9 },
          { id: "5", name: "Limited Edition", slug: "limited", productCount: 6 },
        ];

  const showCount = content.showCount ?? true;

  const alignClasses: Record<string, string> = {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end",
  };

  return (
    <div
      className={`flex flex-wrap gap-2.5 w-full ${alignClasses[style.textAlign || "center"] || "justify-center"}`}
    >
      {displayCollections.map((col) => {
        const href = `/stores/${encodeURIComponent(storeSlug)}/collections/${encodeURIComponent(col.slug || col.id)}`;
        return (
          <Link
            key={col.id}
            href={href}
            className="group inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/70 bg-card/60 backdrop-blur-xs text-xs sm:text-sm font-medium text-foreground hover:border-primary/50 hover:bg-card shadow-2xs hover:shadow-xs active:scale-[0.98] transition-all"
          >
            <Tag className="w-3.5 h-3.5 text-primary opacity-80 group-hover:opacity-100" />
            <span>{col.name}</span>
            {showCount && col.productCount !== undefined && (
              <span className="text-[11px] font-mono text-muted-foreground ml-0.5">
                ({col.productCount})
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
