"use client";

import React from "react";
import Link from "next/link";
import type { PageElement } from "@calcart/stores/landing-page";
import type { ProductSummaryDTO } from "@calcart/products";
import { formatStorePrice } from "@/components/storefront/products/product-card";
import { ArrowRight, ShoppingBag, Sparkles } from "lucide-react";

interface FeaturedProductElementProps {
  element: PageElement;
  storeSlug: string;
  storeCurrency?: string;
  products?: ProductSummaryDTO[];
}

export function FeaturedProductElement({
  element,
  storeSlug,
  storeCurrency = "USD",
  products = [],
}: FeaturedProductElementProps) {
  const content = (element.content || {}) as {
    productId?: string;
    imagePosition?: "left" | "right";
    ctaText?: string;
    description?: string;
  };

  const product =
    products.find((p) => p.id === content.productId) || products[0];

  const imagePosition = content.imagePosition || "left";
  const ctaText = content.ctaText || "Shop Product";

  if (!product) {
    return (
      <div className="w-full py-12 px-6 rounded-2xl border border-dashed border-border text-center bg-card/20">
        <ShoppingBag className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
        <p className="text-sm font-semibold text-foreground">Featured Product</p>
        <p className="text-xs text-muted-foreground mt-1">
          Add a product to your catalog to highlight it in this spotlight container.
        </p>
      </div>
    );
  }

  const href = `/stores/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(product.slug)}`;
  const priceFormatted = formatStorePrice(product.price, product.currency || storeCurrency);
  const compareAtFormatted = product.compareAtPrice
    ? formatStorePrice(product.compareAtPrice, product.currency || storeCurrency)
    : null;

  return (
    <div
      className={`w-full overflow-hidden rounded-3xl border border-border/60 bg-card/60 backdrop-blur-xs shadow-xl grid grid-cols-1 md:grid-cols-2 items-center ${
        imagePosition === "right" ? "md:grid-flow-dense" : ""
      }`}
    >
      {/* Product Image */}
      <div
        className={`relative aspect-square md:aspect-[4/3] w-full overflow-hidden bg-muted/30 ${
          imagePosition === "right" ? "md:col-start-2" : ""
        }`}
      >
        {product.primaryMediaUrl ? (
          <img
            src={product.primaryMediaUrl}
            alt={product.title}
            className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted/40 text-muted-foreground">
            <ShoppingBag className="w-12 h-12 stroke-[1.2]" />
          </div>
        )}
        <div className="absolute top-4 left-4">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-background/90 text-foreground shadow-xs">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Spotlight</span>
          </span>
        </div>
      </div>

      {/* Product Details */}
      <div className="p-8 md:p-12 space-y-5">
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Curated Highlight
          </span>
          <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
            {product.title}
          </h3>
          {content.description ? (
            <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
              {content.description}
            </p>
          ) : product.categoryName ? (
            <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
              Part of our curated {product.categoryName} collection.
            </p>
          ) : null}
        </div>

        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold text-foreground">{priceFormatted}</span>
          {compareAtFormatted && (
            <span className="text-base text-muted-foreground line-through opacity-70">
              {compareAtFormatted}
            </span>
          )}
        </div>

        <div>
          <Link
            href={href}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-primary text-primary-foreground hover:opacity-95 shadow-md active:scale-[0.98] transition-all"
          >
            <span>{ctaText}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
