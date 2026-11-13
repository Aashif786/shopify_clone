import { describe, it, expect, afterEach, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ProductDetailView,
  findMatchingVariant,
  resolveVariantSelection,
  getVariantOptionValue,
  type StorefrontProductDetailDTO,
} from "@/components/storefront/products/product-detail-view";
import * as shared from "../../apps/web/src/lib/storefront-variant-selection";

const sizes = ["S", "M"];
const colors = ["Red", "Blue"];

function makeProduct(overrides: Partial<StorefrontProductDetailDTO> = {}): StorefrontProductDetailDTO {
  const variants: StorefrontProductDetailDTO["variants"] = [];
  let price = 3000;
  for (const c of colors)
    for (const s of sizes) {
      variants.push({
        id: `v-${c}-${s}`,
        productId: "p1",
        title: `${c} / ${s}`,
        sku: `SKU-${c}-${s}`,
        price: (price += 500),
        compareAtPrice: null,
        currency: "USD",
        position: 0,
        status: "ACTIVE",
        option1: c,
        option2: s,
        option3: null,
        inventory: {
          availableQuantity: 8,
          isLowStock: false,
          isOutOfStock: false,
          lowStockThreshold: 5,
          maxOrderQuantity: null,
          effectiveMaxQuantity: 8,
        },
      } as StorefrontProductDetailDTO["variants"][number]);
    }
  return {
    id: "p1",
    storeId: "s1",
    title: "Tee",
    description: "A tee.",
    slug: "tee",
    status: "ACTIVE",
    options: [
      { id: "o1", productId: "p1", name: "Color", position: 0, values: colors, isPublishable: true },
      { id: "o2", productId: "p1", name: "Size", position: 1, values: sizes, isPublishable: false },
    ],
    variants,
    media: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  } as unknown as StorefrontProductDetailDTO;
}

const render = (product = makeProduct(), props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    <ProductDetailView product={product} storeSlug="shop" storeName="Shop" storeCurrency="USD" {...props} />,
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProductDetailView: no arbitrary defaults, exact variant only", () => {
  it("does not select the first option value or the first variant", () => {
    const html = render();
    expect(html).not.toContain('aria-checked="true"');
    expect(html).not.toContain("SKU-Red-S");
    expect(html).toContain('data-testid="select-options-hint"');
    expect(html).toContain("Select Color, Size");
    // add-to-cart is blocked and says what is missing
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*data-testid="add-to-cart-button"/);
    expect(html).toContain("Select Color");
    // stock is not asserted for an unresolved selection
    expect(html).not.toContain('data-testid="stock-badge"');
  });

  it("shows only a real price range until an exact variant is chosen", () => {
    const html = render();
    expect(html).toContain("From");
    expect(html).toContain("35.00"); // cheapest real variant price
  });

  it("preserves a published listing's option and still requires the rest", () => {
    vi.stubGlobal("window", { location: { search: "?option%5BColor%5D=Red", href: "http://x/?option%5BColor%5D=Red" } });
    const html = render();
    expect(html).toContain('aria-checked="true"');
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html).toContain("Select Size");
    expect(html).not.toContain("Select Color,");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*data-testid="add-to-cart-button"/);
  });

  it("an explicit exact variant (initialVariantId) is a complete selection", () => {
    const html = render(makeProduct(), { initialVariantId: "v-Blue-M" });
    expect(html).toContain("SKU-Blue-M");
    expect(html).not.toContain('data-testid="select-options-hint"');
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*data-testid="add-to-cart-button"/);
  });

  it("simple product (single variant) stays purchasable with no selection", () => {
    const product = makeProduct();
    product.variants = [{ ...product.variants[0]!, title: "Default Title", option1: null, option2: null }];
    product.options = [];
    const html = render(product);
    expect(html).toContain('data-testid="default-variant-badge"');
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*data-testid="add-to-cart-button"/);
  });

  it("out-of-stock exact variant cannot be added", () => {
    const product = makeProduct();
    product.variants = product.variants.map((v) =>
      v.id === "v-Red-S"
        ? { ...v, inventory: { ...v.inventory!, availableQuantity: 0, isOutOfStock: true, effectiveMaxQuantity: 0 } }
        : v,
    );
    const html = render(product, { initialVariantId: "v-Red-S" });
    expect(html).toContain("Out of Stock");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*data-testid="add-to-cart-button"/);
  });
});

describe("ProductDetailView helpers use the shared selection logic", () => {
  const product = makeProduct();
  const active = product.variants;
  const options = product.options!;

  it("re-exports the shared getVariantOptionValue (no duplicate implementation)", () => {
    expect(getVariantOptionValue).toBe(shared.getVariantOptionValue);
  });

  it("findMatchingVariant rejects partial matches and resolves complete ones", () => {
    expect(findMatchingVariant(active, options, { Color: "Red" })).toBeUndefined();
    expect(findMatchingVariant(active, options, {})).toBeUndefined();
    expect(findMatchingVariant(active, options, { Color: "red", Size: "m" })?.id).toBe("v-Red-M");
    expect(findMatchingVariant(active, options, { Color: "Red", Size: "XL" })).toBeUndefined();
  });

  it("resolveVariantSelection returns a variant only for a complete selection and never adapts other options", () => {
    const first = resolveVariantSelection(active, options, {}, "Color", "Red");
    expect(first.nextOptions).toEqual({ Color: "Red" });
    expect(first.matchedVariant).toBeUndefined();

    const second = resolveVariantSelection(active, options, first.nextOptions, "Size", "S");
    expect(second.matchedVariant?.id).toBe("v-Red-S");

    // switching the publishable option keeps the customer's Size and re-resolves exactly
    const third = resolveVariantSelection(active, options, second.nextOptions, "Color", "Blue");
    expect(third.nextOptions).toEqual({ Color: "Blue", Size: "S" });
    expect(third.matchedVariant?.id).toBe("v-Blue-S");
  });
});
