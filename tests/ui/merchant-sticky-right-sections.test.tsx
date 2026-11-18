import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "fs";
import path from "path";
import { ProductDetails } from "../../apps/web/src/components/merchant/products/product-details";
import type { ProductDetailDTO } from "@calcart/products";

describe("Merchant Portal Sticky Right-Side Sections", () => {
  const dummyProduct: ProductDetailDTO = {
    id: "prod-101",
    storeId: "store-101",
    title: "Test Artisan Shirt",
    slug: "test-artisan-shirt",
    description: "Handcrafted cotton apparel",
    status: "ACTIVE",
    hasVariants: true,
    typeId: null,
    categoryId: null,
    publishedAt: "2026-01-01T00:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    options: [
      {
        id: "opt-1",
        productId: "prod-101",
        name: "Size",
        position: 0,
        values: ["M", "L"],
        isPublishable: false,
        optionValues: [],
      },
    ],
    variants: [
      {
        id: "var-1",
        productId: "prod-101",
        title: "Default Variant",
        price: 3500,
        compareAtPrice: 4000,
        currency: "USD",
        position: 0,
        status: "ACTIVE",
        sku: "TEST-SKU-01",
        option1: "M",
        option2: null,
        lowStockThreshold: 5,
        maxOrderQuantity: 10,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ],
    media: [],
  };

  it("renders ProductDetails with sticky right sidebar for pricing and metadata", () => {
    const html = renderToStaticMarkup(
      <ProductDetails product={dummyProduct} />
    );

    // Parent layout should have items-start to allow sticky height decoupling
    expect(html).toContain("grid-cols-1 md:grid-cols-3 gap-6 items-start");

    // Right column must have sticky positioning and top-20 offset
    expect(html).toContain("md:sticky");
    expect(html).toContain("md:top-20");
    expect(html).toContain("md:self-start");
    expect(html).toContain("Pricing &amp; SKU");
    expect(html).toContain("Product Metadata");
  });

  it("CollectionForm source contains sticky right column styling and items-start layout", () => {
    const filePath = path.resolve(
      process.cwd(),
      "apps/web/src/components/merchant/collections/collection-form.tsx"
    );
    const content = fs.readFileSync(filePath, "utf-8");

    expect(content).toContain("grid grid-cols-1 lg:grid-cols-3 gap-6 items-start");
    expect(content).toContain("space-y-6 lg:sticky lg:top-20 lg:self-start");
  });

  it("OrderDetailsView source contains sticky right column styling", () => {
    const filePath = path.resolve(
      process.cwd(),
      "apps/web/src/components/merchant/orders/order-details-view.tsx"
    );
    const content = fs.readFileSync(filePath, "utf-8");

    expect(content).toContain("lg:col-span-4 space-y-6 lg:sticky lg:top-20 lg:self-start");
  });

  it("CustomerDetailsView source contains sticky right column styling", () => {
    const filePath = path.resolve(
      process.cwd(),
      "apps/web/src/components/merchant/customers/customer-details-view.tsx"
    );
    const content = fs.readFileSync(filePath, "utf-8");

    expect(content).toContain("space-y-6 lg:sticky lg:top-20 lg:self-start");
  });

  it("merchant-theme.css contains sticky rules for 2-column SplitGrid dashboard panels", () => {
    const filePath = path.resolve(
      process.cwd(),
      "apps/web/app/merchant/merchant-theme.css"
    );
    const css = fs.readFileSync(filePath, "utf-8");

    expect(css).toContain(".mt-grid-2 > :last-child");
    expect(css).toContain("position: sticky;");
    expect(css).toContain("top: 5rem;");
    expect(css).toContain("align-self: start;");
  });
});
