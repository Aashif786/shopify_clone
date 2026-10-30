import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductReviewsSection } from "@/components/storefront/reviews/product-reviews-section";
import { ProductCard } from "@/components/storefront/products/product-card";
import type { ProductSummaryDTO } from "@calcart/products";

describe("Storefront Product Reviews UI Components", () => {
  const testProduct = {
    id: "prod_123",
    slug: "linen-blazer",
    title: "Classic Linen Blazer",
  };

  it("renders ProductReviewsSection layout with ratings and reviews heading", () => {
    const html = renderToStaticMarkup(
      <ProductReviewsSection product={testProduct} storeSlug="artisan-atelier" />,
    );

    expect(html).toContain("Ratings &amp; Reviews");
    expect(html).toContain("Verified Feedback");
    expect(html).toContain("Sort by:");
    expect(html).toContain("Newest First");
    expect(html).toContain("reviews-section");
    expect(html).toContain("Filter by 5 stars");
  });

  it("renders ProductCard with star rating indicator when ratingCount > 0", () => {
    const productWithReviews: ProductSummaryDTO = {
      id: "prod_456",
      storeId: "store_789",
      title: "Artisan Leather Tote",
      slug: "artisan-leather-tote",
      status: "ACTIVE",
      publishedAt: "2026-01-01T00:00:00Z",
      variantsCount: 1,
      mediaCount: 1,
      price: 18000,
      currency: "USD",
      lowStockThreshold: 5,
      maxOrderQuantity: null,
      ratingAverage: 4.8,
      ratingCount: 16,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };

    const html = renderToStaticMarkup(
      <ProductCard product={productWithReviews} storeSlug="artisan-atelier" />,
    );

    expect(html).toContain("Artisan Leather Tote");
    expect(html).toContain("4.8");
    expect(html).toContain("(16)");
  });

  it("omits star rating indicator on ProductCard when ratingCount is 0 or null", () => {
    const productWithoutReviews: ProductSummaryDTO = {
      id: "prod_789",
      storeId: "store_789",
      title: "New Unreviewed Scarf",
      slug: "new-unreviewed-scarf",
      status: "ACTIVE",
      publishedAt: "2026-01-01T00:00:00Z",
      variantsCount: 1,
      mediaCount: 1,
      price: 4500,
      currency: "USD",
      lowStockThreshold: 5,
      maxOrderQuantity: null,
      ratingAverage: null,
      ratingCount: 0,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };

    const html = renderToStaticMarkup(
      <ProductCard product={productWithoutReviews} storeSlug="artisan-atelier" />,
    );

    expect(html).toContain("New Unreviewed Scarf");
    expect(html).not.toContain("(0)");
  });
});
