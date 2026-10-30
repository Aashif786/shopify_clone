"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import type { PageElement } from "@calcart/stores/landing-page";
import type { ProductSummaryDTO } from "@calcart/products";
import { ProductCard } from "@/components/storefront/products/product-card";
import { ArrowRight, ShoppingBag } from "lucide-react";

interface ProductGridElementProps {
  element: PageElement;
  storeSlug: string;
  storeCurrency?: string;
  products?: ProductSummaryDTO[];
}

export function ProductGridElement({
  element,
  storeSlug,
  storeCurrency = "USD",
  products = [],
}: ProductGridElementProps) {
  const content = (element.content || {}) as {
    columns?: number;
    limit?: number;
    showViewAll?: boolean;
    viewAllText?: string;
    viewAllLink?: string;
    productIds?: string[];
  };

  const columns = Number(content.columns) || 4;
  const limit = Number(content.limit) || 8;
  const showViewAll = content.showViewAll ?? true;
  const viewAllText = content.viewAllText || "View all products";
  const rawLink = content.viewAllLink || "/products";
  const viewAllHref = rawLink.startsWith("http")
    ? rawLink
    : `/stores/${storeSlug}${rawLink.startsWith("/") ? rawLink : `/${rawLink}`}`;

  const selectedProductIds = Array.isArray(content.productIds) ? content.productIds : [];

  const displayProducts = useMemo(() => {
    let list = [...products];
    if (selectedProductIds.length > 0) {
      list = list.filter((p) => selectedProductIds.includes(p.id));
    }
    return list.slice(0, limit);
  }, [products, selectedProductIds, limit]);

  const gridClasses: Record<number, string> = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className="w-full space-y-6">
      {displayProducts.length > 0 ? (
        <div className={`grid ${gridClasses[columns] || gridClasses[4]} gap-6`}>
          {displayProducts.map((product) => (
            <ProductCard
              key={product.variantId ? `${product.id}-${product.variantId}` : product.id}
              product={product}
              storeSlug={storeSlug}
              storeCurrency={storeCurrency}
            />
          ))}
        </div>
      ) : (
        <div className="py-12 px-6 rounded-2xl border border-dashed border-border text-center bg-card/20">
          <ShoppingBag className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">Products Catalog</p>
          <p className="text-xs text-muted-foreground mt-1">
            Products published in your store will automatically appear here.
          </p>
        </div>
      )}

      {showViewAll && displayProducts.length > 0 && (
        <div className="flex justify-center pt-2">
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline group"
          >
            <span>{viewAllText}</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      )}
    </div>
  );
}
