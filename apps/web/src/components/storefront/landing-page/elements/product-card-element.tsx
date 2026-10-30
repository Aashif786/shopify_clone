"use client";

import React from "react";
import type { PageElement } from "@calcart/stores/landing-page";
import type { ProductSummaryDTO } from "@calcart/products";
import { ProductCard } from "@/components/storefront/products/product-card";
import { ShoppingBag } from "lucide-react";

interface ProductCardElementProps {
  element: PageElement;
  storeSlug: string;
  storeCurrency?: string;
  products?: ProductSummaryDTO[];
}

export function ProductCardElement({
  element,
  storeSlug,
  storeCurrency = "USD",
  products = [],
}: ProductCardElementProps) {
  const content = (element.content || {}) as {
    productId?: string;
    showBadge?: boolean;
  };
  const style = element.style || {};

  const product =
    products.find((p) => p.id === content.productId) || products[0];

  if (!product) {
    return (
      <div
        className="w-full max-w-sm mx-auto p-8 rounded-2xl border border-dashed border-border flex flex-col items-center justify-center text-center bg-card/30"
        style={{ maxWidth: style.maxWidth || "320px" }}
      >
        <ShoppingBag className="w-8 h-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm font-semibold text-foreground">Product Card</p>
        <p className="text-xs text-muted-foreground mt-1">
          Add products to your store to feature them here.
        </p>
      </div>
    );
  }

  return (
    <div
      className="w-full max-w-sm mx-auto"
      style={{ maxWidth: style.maxWidth || "360px" }}
    >
      <ProductCard
        product={product}
        storeSlug={storeSlug}
        storeCurrency={storeCurrency}
      />
    </div>
  );
}
