import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductForm } from "@/components/merchant/products/product-form";
import { ProductDetails } from "@/components/merchant/products/product-details";
import { ProductDetailView } from "@/components/storefront/products/product-detail-view";
import type { ProductDetailDTO } from "@calcart/products";

describe("Option-Level Standalone Publishing UI", () => {
  const sampleProduct: ProductDetailDTO = {
    id: "prod-1",
    storeId: "store-1",
    title: "Essential Crewneck Tee",
    description: "Comfortable organic cotton tee.",
    slug: "essential-crewneck-tee",
    status: "ACTIVE",
    publishedAt: "2026-01-01T00:00:00Z",
    lowStockThreshold: 5,
    maxOrderQuantity: 10,
    options: [
      {
        id: "opt-color",
        productId: "prod-1",
        name: "Color",
        position: 0,
        values: ["Blue", "Black", "Red"],
        isPublishable: true,
        optionValues: [
          {
            id: "ov-blue",
            optionId: "opt-color",
            value: "Blue",
            displayTitle: "Cobalt Blue Essential Tee",
            isPublished: true,
            position: 0,
            mediaIds: ["med-blue"],
            media: [
              {
                id: "med-blue",
                productId: "prod-1",
                variantId: null,
                url: "https://example.com/blue.jpg",
                altText: "Blue Tee",
                position: 0,
                createdAt: "2026-01-01T00:00:00Z",
                updatedAt: "2026-01-01T00:00:00Z",
              },
            ],
          },
          {
            id: "ov-black",
            optionId: "opt-color",
            value: "Black",
            displayTitle: "Midnight Black Essential Tee",
            isPublished: true,
            position: 1,
            mediaIds: ["med-black"],
            media: [
              {
                id: "med-black",
                productId: "prod-1",
                variantId: null,
                url: "https://example.com/black.jpg",
                altText: "Black Tee",
                position: 1,
                createdAt: "2026-01-01T00:00:00Z",
                updatedAt: "2026-01-01T00:00:00Z",
              },
            ],
          },
          {
            id: "ov-red",
            optionId: "opt-color",
            value: "Red",
            displayTitle: "Scarlet Red Essential Tee",
            isPublished: false,
            position: 2,
            mediaIds: [],
          },
        ],
      },
      {
        id: "opt-size",
        productId: "prod-1",
        name: "Size",
        position: 1,
        values: ["S", "M", "L"],
        isPublishable: false,
      },
    ],
    variants: [
      {
        id: "var-blue-s",
        productId: "prod-1",
        title: "Blue / S",
        price: 3200,
        compareAtPrice: 3800,
        currency: "USD",
        position: 0,
        status: "ACTIVE",
        sku: "TEE-BLU-S",
        option1: "Blue",
        option2: "S",
        lowStockThreshold: 5,
        maxOrderQuantity: 10,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "var-black-s",
        productId: "prod-1",
        title: "Black / S",
        price: 3200,
        compareAtPrice: null,
        currency: "USD",
        position: 1,
        status: "ACTIVE",
        sku: "TEE-BLK-S",
        option1: "Black",
        option2: "S",
        lowStockThreshold: 5,
        maxOrderQuantity: 10,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ],
    media: [
      {
        id: "med-blue",
        productId: "prod-1",
        variantId: null,
        url: "https://example.com/blue.jpg",
        altText: "Blue Tee",
        position: 0,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "med-black",
        productId: "prod-1",
        variantId: null,
        url: "https://example.com/black.jpg",
        altText: "Black Tee",
        position: 1,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  it("renders option-level standalone publishing toggle on option cards", () => {
    const html = renderToStaticMarkup(
      <ProductForm mode="edit" initialProduct={sampleProduct} storeSlug="test-store" />
    );

    expect(html).toContain("Publish values as standalone products");
    expect(html).toContain("Standalone Listings (3 values)");
    expect(html).toContain("Cobalt Blue Essential Tee");
    expect(html).toContain("Midnight Black Essential Tee");
  });

  it("removes per-combination publish checkboxes and bulk publish buttons from variant matrix", () => {
    const html = renderToStaticMarkup(
      <ProductForm mode="edit" initialProduct={sampleProduct} storeSlug="test-store" />
    );

    // Matrix header must NOT have a "Publish" column or "Display Title" or "Images" column
    expect(html).not.toContain('<th class="py-2.5 px-3 w-20 text-center" title="Publish variant');
    expect(html).not.toContain("Publish as Product");
    expect(html).not.toContain("Unpublish as Product");
  });

  it("displays Standalone Publishable badge on product details options breakdown", () => {
    const html = renderToStaticMarkup(
      <ProductDetails product={sampleProduct} storeId="store-1" userRole="OWNER" />
    );

    expect(html).toContain("Standalone Publishable");
    expect(html).toContain("Color:");
    expect(html).toContain("Size:");
  });

  it("renders option-value specific display title in storefront product detail view", () => {
    const html = renderToStaticMarkup(
      <ProductDetailView
        product={sampleProduct}
        storeSlug="test-store"
        storeName="Test Store"
        initialVariantId="var-blue-s"
      />
    );

    expect(html).toContain("Cobalt Blue Essential Tee");
  });
});
