import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductForm } from "@/components/merchant/products/product-form";
import type { ProductDetailDTO } from "@calcart/products";

describe("Merchant Product Form: Sticky Publishing & Option-Wise Pricing", () => {
  const sampleProduct: ProductDetailDTO = {
    id: "prod-tee",
    storeId: "store-1",
    title: "Classic Cotton T-Shirt",
    description: "Everyday comfort tee.",
    slug: "classic-cotton-t-shirt",
    status: "ACTIVE",
    publishedAt: "2026-01-01T00:00:00Z",
    lowStockThreshold: 5,
    maxOrderQuantity: 10,
    options: [
      {
        id: "opt-color",
        productId: "prod-tee",
        name: "Color",
        position: 0,
        values: ["White", "Black", "Tie-Dye"],
        isPublishable: false,
        optionValues: [],
      },
      {
        id: "opt-size",
        productId: "prod-tee",
        name: "Size",
        position: 1,
        values: ["S", "M", "L", "XL"],
        isPublishable: false,
        optionValues: [],
      },
    ],
    variants: [
      {
        id: "var-white-s",
        productId: "prod-tee",
        title: "White / S",
        price: 1800,
        compareAtPrice: 2200,
        currency: "USD",
        position: 0,
        status: "ACTIVE",
        sku: "TEE-WHT-S",
        option1: "White",
        option2: "S",
        lowStockThreshold: 5,
        maxOrderQuantity: 10,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "var-white-xl",
        productId: "prod-tee",
        title: "White / XL",
        price: 1800,
        compareAtPrice: 2200,
        currency: "USD",
        position: 1,
        status: "ACTIVE",
        sku: "TEE-WHT-XL",
        option1: "White",
        option2: "XL",
        lowStockThreshold: 5,
        maxOrderQuantity: 10,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "var-black-s",
        productId: "prod-tee",
        title: "Black / S",
        price: 2200,
        compareAtPrice: 2600,
        currency: "USD",
        position: 2,
        status: "ACTIVE",
        sku: "TEE-BLK-S",
        option1: "Black",
        option2: "S",
        lowStockThreshold: 5,
        maxOrderQuantity: 10,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "var-tiedy-s",
        productId: "prod-tee",
        title: "Tie-Dye / S",
        price: 2800,
        compareAtPrice: null,
        currency: "USD",
        position: 3,
        status: "ACTIVE",
        sku: "TEE-TDY-S",
        option1: "Tie-Dye",
        option2: "S",
        lowStockThreshold: 5,
        maxOrderQuantity: 10,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ],
    media: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  it("renders Publishing & Status card as sticky with lg:sticky lg:top-20 z-10", () => {
    const html = renderToStaticMarkup(
      <ProductForm storeId="store-1" initialProduct={sampleProduct} />
    );

    // Verify Publishing & Status card has sticky positioning classes
    expect(html).toContain("Publishing &amp; Status");
    expect(html).toMatch(/lg:sticky\s+lg:top-20\s+z-10/);

    // Verify parent layout grid does not force items-start which would break sticky column stretch
    expect(html).toContain('class="grid grid-cols-1 lg:grid-cols-12 gap-6"');
    expect(html).not.toContain('grid-cols-1 lg:grid-cols-12 gap-6 items-start');
  });

  it("renders Option-Wise Price Assigning tool with multi-option selector tabs ('works both ways')", () => {
    const html = renderToStaticMarkup(
      <ProductForm storeId="store-1" initialProduct={sampleProduct} />
    );

    // Verify Option-Wise Pricing tool is rendered
    expect(html).toContain("Option-Wise Price Assigning");
    expect(html).toContain("Flexible Both Ways");
    expect(html).toContain("Assign prices by:");

    // Verify both options (Color and Size) are available as selector tabs
    expect(html).toContain("Color");
    expect(html).toContain("3 values");
    expect(html).toContain("Size");
    expect(html).toContain("4 values");

    // Default selected option is Color (Option 0)
    expect(html).toContain("Apply All Color Prices");
    expect(html).toContain("White");
    expect(html).toContain("Black");
    expect(html).toContain("Tie-Dye");
  });

  it("renders inline option pricing inside each option card in the options builder", () => {
    const html = renderToStaticMarkup(
      <ProductForm storeId="store-1" initialProduct={sampleProduct} />
    );

    // Verify option cards show inline price controls
    expect(html).toContain("Price by Color");
    expect(html).toContain("Price by Size");
    expect(html).toContain("Apply all Color prices");
    expect(html).toContain("Apply all Size prices");
  });

  it("correctly pre-populates option-wise prices from existing variant data", () => {
    const html = renderToStaticMarkup(
      <ProductForm storeId="store-1" initialProduct={sampleProduct} />
    );

    // White variant is 1800 minor units ($18.00)
    expect(html).toContain('value="18.00"');
    // Black variant is 2200 minor units ($22.00)
    expect(html).toContain('value="22.00"');
    // Tie-Dye variant is 2800 minor units ($28.00)
    expect(html).toContain('value="28.00"');
  });
});
