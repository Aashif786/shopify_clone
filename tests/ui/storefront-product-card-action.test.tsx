import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProductSummaryDTO } from "@calcart/products";
import { ProductCard } from "@/components/storefront/products/product-card";

describe("Storefront ProductCard: Add to cart vs Choose options", () => {
  const base: ProductSummaryDTO = {
    id: "prod_cta",
    storeId: "store_cta",
    title: "Linen Shirt",
    slug: "linen-shirt",
    status: "ACTIVE",
    publishedAt: "2026-01-01T00:00:00Z",
    variantsCount: 1,
    mediaCount: 0,
    price: 4900,
    currency: "USD",
    isOutOfStock: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  it("shows Add to cart only when exactly one purchasable variant is identified", () => {
    const html = renderToStaticMarkup(
      <ProductCard
        product={{ ...base, variantId: "v_only", purchasableVariantCount: 1, purchasableVariantId: "v_only" }}
        storeSlug="s"
      />,
    );
    expect(html).toContain("Add to cart");
    expect(html).not.toContain("Choose options");
  });

  it("shows Choose options for a published listing whose variantId is only one of several variants", () => {
    // Option-level listings report variantsCount = 1; the listing variantId is just a representative.
    const html = renderToStaticMarkup(
      <ProductCard
        product={{
          ...base,
          isStandaloneVariant: true,
          variantId: "v_first",
          purchasableVariantCount: 3,
          purchasableVariantId: null,
        }}
        storeSlug="s"
      />,
    );
    expect(html).toContain("Choose options");
    expect(html).not.toContain("Add to cart");
  });

  it("does not treat a missing purchasable count as a simple product", () => {
    const html = renderToStaticMarkup(
      <ProductCard product={{ ...base, variantId: "v_first" }} storeSlug="s" />,
    );
    expect(html).toContain("Choose options");
  });

  it("shows Sold out when out of stock", () => {
    const html = renderToStaticMarkup(
      <ProductCard
        product={{ ...base, isOutOfStock: true, variantId: "v", purchasableVariantCount: 1, purchasableVariantId: "v" }}
        storeSlug="s"
      />,
    );
    expect(html).toContain("Sold out");
  });
});
