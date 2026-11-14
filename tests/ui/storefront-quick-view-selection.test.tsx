import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QuickViewContent } from "@/components/storefront/products/quick-view-modal";
import type { StorefrontProductDetailDTO } from "@/components/storefront/products/product-detail-view";

const sizes = ["S", "M", "L"];
const colors = ["Red", "Blue"];
const fabrics = ["Cotton", "Linen"];

function makeProduct(overrides: Partial<StorefrontProductDetailDTO> = {}): StorefrontProductDetailDTO {
  const variants: StorefrontProductDetailDTO["variants"] = [];
  let price = 2000;
  for (const s of sizes)
    for (const c of colors)
      for (const f of fabrics) {
        variants.push({
          id: `v-${s}-${c}-${f}`,
          productId: "p1",
          title: `${s} / ${c} / ${f}`,
          sku: `SKU-${s}-${c}-${f}`,
          price: (price += 100),
          compareAtPrice: null,
          currency: "USD",
          position: 0,
          status: "ACTIVE",
          option1: s,
          option2: c,
          option3: f,
          inventory: {
            availableQuantity: 10,
            isLowStock: false,
            isOutOfStock: false,
            lowStockThreshold: 5,
            maxOrderQuantity: null,
            effectiveMaxQuantity: 10,
          },
        } as StorefrontProductDetailDTO["variants"][number]);
      }
  return {
    id: "p1",
    storeId: "s1",
    title: "Linen Shirt",
    description: "A shirt.",
    slug: "linen-shirt",
    status: "ACTIVE",
    options: [
      { id: "o1", productId: "p1", name: "Size", position: 0, values: sizes, isPublishable: false },
      { id: "o2", productId: "p1", name: "Color", position: 1, values: colors, isPublishable: true },
      { id: "o3", productId: "p1", name: "Fabric", position: 2, values: fabrics, isPublishable: false },
    ],
    variants,
    media: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  } as unknown as StorefrontProductDetailDTO;
}

const render = (props: Partial<React.ComponentProps<typeof QuickViewContent>> = {}) =>
  renderToStaticMarkup(
    <QuickViewContent product={makeProduct()} storeSlug="shop" productSlug="linen-shirt" addItem={vi.fn()} {...props} />,
  );

const checkedValues = (html: string) =>
  [...html.matchAll(/<input[^>]*type="radio"[^>]*>/g)].map((m) => m[0]).filter((tag) => /checked=""/.test(tag));

describe("QuickView option selectors", () => {
  it("renders one selector per option group, not one button per combination", () => {
    const html = render();
    expect(html).toContain('data-testid="quick-view-option-Size"');
    expect(html).toContain('data-testid="quick-view-option-Color"');
    expect(html).toContain('data-testid="quick-view-option-Fabric"');
    // 3 + 2 + 2 option values, not 12 combinations
    expect(html.match(/type="radio"/g)).toHaveLength(7);
    expect(html).not.toContain("S / Red / Cotton");
    expect(html).not.toMatch(/Options \(\d+ available\)/);
  });

  it("uses real fieldset/legend/radio semantics for keyboard and screen readers", () => {
    const html = render();
    expect(html.match(/<fieldset/g)).toHaveLength(3);
    expect(html).toContain("<legend");
    expect(html).toMatch(/<label for="[^"]+"/);
  });

  it("does not select the first variant or any option by default", () => {
    const html = render();
    expect(checkedValues(html)).toHaveLength(0);
    expect(html).toContain("Select Size +2");
    expect(html).toMatch(/data-testid="quick-view-add-to-cart-btn"/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*data-testid="quick-view-add-to-cart-btn"/);
    expect(html).toContain("Select Size, Color, Fabric to continue.");
  });

  it("shows only a real price range (From) while the selection is incomplete", () => {
    const html = render();
    expect(html).toContain("From");
    expect(html).toContain("21.00"); // cheapest real variant price
    expect(html).not.toContain("SKU-");
  });

  it("preserves a published listing's option and requires the remaining ones", () => {
    const html = render({ listingContext: { optionName: "Color", optionValue: "Red" } });
    const checked = checkedValues(html);
    expect(checked).toHaveLength(1);
    expect(checked[0]).toContain('value="Red"');
    expect(html).toContain("Select Size, Fabric to continue.");
    expect(html).toContain("Select Size +1");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*data-testid="quick-view-add-to-cart-btn"/);
  });

  it("does not preselect from a representative variant of the listing", () => {
    // Only the listing's own option is context; Size/Fabric of any representative stay empty.
    const html = render({ listingContext: { optionName: "Color", optionValue: "Blue" } });
    expect(checkedValues(html).map((t) => /value="([^"]+)"/.exec(t)![1])).toEqual(["Blue"]);
  });

  it("disables only values that cannot exist with the current choices", () => {
    const product = makeProduct();
    product.variants = product.variants.filter((v) => !(v.option1 === "L" && v.option2 === "Red"));
    const html = render({ product, listingContext: { optionName: "Color", optionValue: "Red" } });
    const sizeL = [...html.matchAll(/<input[^>]*value="L"[^>]*>/g)][0]![0];
    expect(sizeL).toContain('disabled=""');
    const sizeM = [...html.matchAll(/<input[^>]*value="M"[^>]*>/g)][0]![0];
    expect(sizeM).not.toContain('disabled=""');
  });

  it("simple product (one variant) shows no selectors and can be added", () => {
    const product = makeProduct();
    product.variants = [product.variants[0]!];
    const html = render({ product });
    expect(html).not.toContain("quick-view-options");
    expect(html).not.toContain('type="radio"');
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*data-testid="quick-view-add-to-cart-btn"/);
    expect(html).toContain("Add to Cart");
    expect(html).toContain("In Stock");
  });

  it("without a cart the add button stays disabled", () => {
    const product = makeProduct();
    product.variants = [product.variants[0]!];
    const html = render({ product, addItem: undefined });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*data-testid="quick-view-add-to-cart-btn"/);
  });
});

describe("QuickView variant-specific image gallery", () => {
  function makeProductWithMedia(): StorefrontProductDetailDTO {
    const base = makeProduct();
    const now = new Date().toISOString();
    base.media = [
      { id: "m-red-1", productId: "p1", variantId: null, url: "https://example.com/red-front.jpg", altText: "Red Front", position: 0, createdAt: now, updatedAt: now },
      { id: "m-red-2", productId: "p1", variantId: null, url: "https://example.com/red-back.jpg", altText: "Red Back", position: 1, createdAt: now, updatedAt: now },
      { id: "m-blue-1", productId: "p1", variantId: null, url: "https://example.com/blue-front.jpg", altText: "Blue Front", position: 2, createdAt: now, updatedAt: now },
      { id: "m-gen-1", productId: "p1", variantId: null, url: "https://example.com/general-look.jpg", altText: "General Look", position: 3, createdAt: now, updatedAt: now },
    ];

    // Assign Red media to Red option value and Blue media to Blue option value
    base.options = [
      { id: "o1", productId: "p1", name: "Size", position: 0, values: ["S", "M", "L"], isPublishable: false },
      {
        id: "o2",
        productId: "p1",
        name: "Color",
        position: 1,
        values: ["Red", "Blue", "Green"],
        isPublishable: true,
        optionValues: [
          { id: "ov-red", optionId: "o2", value: "Red", displayTitle: "SM - Red", isPublished: true, position: 0, mediaIds: ["m-red-1", "m-red-2"], createdAt: "", updatedAt: "" },
          { id: "ov-blue", optionId: "o2", value: "Blue", displayTitle: "SM - Blue", isPublished: true, position: 1, mediaIds: ["m-blue-1"], createdAt: "", updatedAt: "" },
          { id: "ov-green", optionId: "o2", value: "Green", displayTitle: "SM - Green", isPublished: true, position: 2, mediaIds: [], createdAt: "", updatedAt: "" },
        ],
      },
      { id: "o3", productId: "p1", name: "Fabric", position: 2, values: ["Cotton", "Linen"], isPublishable: false },
    ];

    return base;
  }

  it("1. opening Quick View for published variant (Red) shows only Red images and excludes Blue images", () => {
    const product = makeProductWithMedia();
    const html = render({
      product,
      listingContext: { optionName: "Color", optionValue: "Red" },
    });

    // Contains Red images
    expect(html).toContain("https://example.com/red-front.jpg");
    expect(html).toContain("https://example.com/red-back.jpg");
    // Strictly excludes other variant images
    expect(html).not.toContain("https://example.com/blue-front.jpg");
    expect(html).not.toContain("https://example.com/general-look.jpg");
  });

  it("2. opening Quick View for published variant (Blue) shows only Blue images and excludes Red images", () => {
    const product = makeProductWithMedia();
    const html = render({
      product,
      listingContext: { optionName: "Color", optionValue: "Blue" },
    });

    // Contains Blue images
    expect(html).toContain("https://example.com/blue-front.jpg");
    // Strictly excludes other variant images
    expect(html).not.toContain("https://example.com/red-front.jpg");
    expect(html).not.toContain("https://example.com/red-back.jpg");
    expect(html).not.toContain("https://example.com/general-look.jpg");
  });

  it("3. opening Quick View for option value without assigned images falls back to unassigned general product images", () => {
    const product = makeProductWithMedia();
    const html = render({
      product,
      listingContext: { optionName: "Color", optionValue: "Green" },
    });

    // Falls back to general unassigned image
    expect(html).toContain("https://example.com/general-look.jpg");
    // Strictly excludes other variant images
    expect(html).not.toContain("https://example.com/red-front.jpg");
    expect(html).not.toContain("https://example.com/red-back.jpg");
    expect(html).not.toContain("https://example.com/blue-front.jpg");
  });

  it("4. when no variant-specific images exist and no general images exist, never leaks unrelated variant images", () => {
    const product = makeProductWithMedia();
    // Remove the general look image so only variant-assigned images exist
    product.media = product.media.filter((m) => m.id !== "m-gen-1");

    const html = render({
      product,
      listingContext: { optionName: "Color", optionValue: "Green" },
    });

    // Never shows Red or Blue images
    expect(html).not.toContain("https://example.com/red-front.jpg");
    expect(html).not.toContain("https://example.com/blue-front.jpg");
  });
});
