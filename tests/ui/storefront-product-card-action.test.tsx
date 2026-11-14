import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProductSummaryDTO } from "@calcart/products";
import { ProductCard } from "@/components/storefront/products/product-card";

describe("Storefront ProductCard: Add to cart vs View Product", () => {
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
    expect(html).not.toContain("View Product");
    expect(html).not.toContain("Choose options");
  });

  it("shows View Product (not Choose options) for a published listing with multiple options", () => {
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
    expect(html).toContain("View Product");
    expect(html).not.toContain("Choose options");
    expect(html).not.toContain("Add to cart");
  });

  it("does not treat a missing purchasable count as a simple product — shows View Product", () => {
    const html = renderToStaticMarkup(
      <ProductCard product={{ ...base, variantId: "v_first" }} storeSlug="s" />,
    );
    expect(html).toContain("View Product");
    expect(html).not.toContain("Choose options");
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

  it("links an option-level listing with its real option selection, not the representative variant", () => {
    const html = renderToStaticMarkup(
      <ProductCard
        product={{
          ...base,
          isStandaloneVariant: true,
          variantId: "rep-variant-id",
          listingOptionName: "Color",
          listingOptionValue: "Red",
          purchasableVariantCount: 3,
          purchasableVariantId: null,
        }}
        storeSlug="s"
      />,
    );
    expect(html).toContain("/stores/s/products/linen-shirt?option%5BColor%5D=Red");
    expect(html).not.toContain("?variant=rep-variant-id");
  });

  it("keeps the exact variant link for legacy standalone variants", () => {
    const html = renderToStaticMarkup(
      <ProductCard
        product={{ ...base, isStandaloneVariant: true, variantId: "legacy-v", purchasableVariantCount: 1, purchasableVariantId: "legacy-v" }}
        storeSlug="s"
      />,
    );
    expect(html).toContain("?variant=legacy-v");
  });
});

describe("Storefront ProductCard: Eye button vs main action button", () => {
  const base: ProductSummaryDTO = {
    id: "prod_btn",
    storeId: "store_btn",
    title: "Canvas Tote",
    slug: "canvas-tote",
    status: "ACTIVE",
    publishedAt: "2026-01-01T00:00:00Z",
    variantsCount: 3,
    mediaCount: 0,
    price: 2500,
    currency: "USD",
    isOutOfStock: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  const chooseProduct: ProductSummaryDTO = {
    ...base,
    isStandaloneVariant: true,
    variantId: "v_rep",
    purchasableVariantCount: 3,
    purchasableVariantId: null,
  };

  it("renders the eye button with aria-label 'Quick view <title>' when onQuickView is provided", () => {
    const html = renderToStaticMarkup(
      <ProductCard product={chooseProduct} storeSlug="demo" onQuickView={() => {}} />,
    );
    expect(html).toContain("Quick view Canvas Tote");
  });

  it("does not render the eye button when onQuickView is not provided", () => {
    const html = renderToStaticMarkup(
      <ProductCard product={chooseProduct} storeSlug="demo" />,
    );
    expect(html).not.toContain("Quick view Canvas Tote");
  });

  it("main action button for 'choose' kind shows 'View Product' and links to PDP — not a modal trigger", () => {
    const html = renderToStaticMarkup(
      <ProductCard product={chooseProduct} storeSlug="demo" onQuickView={() => {}} />,
    );
    expect(html).toContain('data-testid="product-card-main-action"');
    expect(html).toContain("View Product");
    expect(html).toContain("View Product Canvas Tote");
    expect(html).toContain("/stores/demo/products/canvas-tote");
  });

  it("both grid-layout buttons are rendered as distinct elements: eye button and main action", () => {
    const html = renderToStaticMarkup(
      <ProductCard product={chooseProduct} storeSlug="demo" onQuickView={() => {}} />,
    );
    const quickViewCount = (html.match(/Quick view Canvas Tote/g) ?? []).length;
    const mainActionCount = (html.match(/product-card-main-action/g) ?? []).length;
    expect(quickViewCount).toBeGreaterThanOrEqual(1);
    expect(mainActionCount).toBeGreaterThanOrEqual(1);
  });

  it("list-layout quick view button has text 'Quick view' (not an SVG icon)", () => {
    const html = renderToStaticMarkup(
      <ProductCard product={chooseProduct} storeSlug="demo" layoutMode="list" onQuickView={() => {}} />,
    );
    expect(html).toContain("Quick view");
    expect(html).toContain("Quick view Canvas Tote");
  });
});
