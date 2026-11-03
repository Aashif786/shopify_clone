import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProductSummaryDTO } from "@calcart/products";
import {
  ProductPicker,
  ProductPickerDialog,
  getProductPrice,
  getProductImageUrl,
  getProductVariantsCount,
} from "../../apps/web/src/components/merchant/landing-page/product-picker";
import { FeaturedProductsSection } from "../../apps/web/src/components/storefront/landing-page/sections/featured-products-section";
import { ProductCarouselSection } from "../../apps/web/src/components/storefront/landing-page/sections/product-carousel-section";
import { ProductCarouselElement } from "../../apps/web/src/components/storefront/landing-page/elements/product-carousel-element";

const MOCK_PRODUCTS: ProductSummaryDTO[] = [
  {
    id: "prod_1",
    storeId: "store_test",
    title: "Minimalist Leather Backpack",
    slug: "minimalist-leather-backpack",
    status: "ACTIVE",
    price: 14900,
    primaryMediaUrl: "https://example.com/backpack.jpg",
    variantsCount: 1,
    mediaCount: 1,
    lowStockThreshold: 5,
    maxOrderQuantity: null,
    publishedAt: null,
    sku: "BP-LTHR-001",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "prod_2",
    storeId: "store_test",
    title: "Ceramic Pour-Over Mug",
    slug: "ceramic-pour-over-mug",
    status: "ACTIVE",
    price: 3200,
    primaryMediaUrl: null,
    variantsCount: 3,
    mediaCount: 0,
    lowStockThreshold: 5,
    maxOrderQuantity: null,
    publishedAt: null,
    sku: "MUG-CRM-002",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "prod_3",
    storeId: "store_test",
    title: "Merino Wool Beanie",
    slug: "merino-wool-beanie",
    status: "ACTIVE",
    price: 2800,
    primaryMediaUrl: "https://example.com/beanie.jpg",
    variantsCount: 1,
    mediaCount: 1,
    lowStockThreshold: 5,
    maxOrderQuantity: null,
    publishedAt: null,
    sku: "WOL-BEAN-003",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe("Universal Product Picker for Landing Page Elements", () => {
  describe("Helper Functions", () => {
    it("extracts prices accurately from numeric price or priceRange", () => {
      expect(getProductPrice(MOCK_PRODUCTS[0])).toBe(14900);
      expect(getProductPrice(MOCK_PRODUCTS[1])).toBe(3200);

      const legacyProduct = {
        priceRange: { min: 5500, max: 6000 },
      } as unknown as ProductSummaryDTO;
      expect(getProductPrice(legacyProduct)).toBe(5500);

      const emptyProduct = {} as unknown as ProductSummaryDTO;
      expect(getProductPrice(emptyProduct)).toBeNull();
    });

    it("extracts images accurately from primaryMediaUrl or primaryImageUrl", () => {
      expect(getProductImageUrl(MOCK_PRODUCTS[0])).toBe("https://example.com/backpack.jpg");
      expect(getProductImageUrl(MOCK_PRODUCTS[1])).toBeNull();

      const storefrontProduct = {
        primaryImageUrl: "https://example.com/legacy.png",
      } as unknown as ProductSummaryDTO;
      expect(getProductImageUrl(storefrontProduct)).toBe("https://example.com/legacy.png");
    });

    it("extracts variant counts accurately", () => {
      expect(getProductVariantsCount(MOCK_PRODUCTS[0])).toBe(1);
      expect(getProductVariantsCount(MOCK_PRODUCTS[1])).toBe(3);

      const legacyProduct = {
        variantCount: 5,
      } as unknown as ProductSummaryDTO;
      expect(getProductVariantsCount(legacyProduct)).toBe(5);
    });
  });

  describe("ProductPicker Trigger Card States", () => {
    it("renders empty/auto state with clear label and action button", () => {
      const html = renderToStaticMarkup(
        <ProductPicker
          mode="single"
          value=""
          products={MOCK_PRODUCTS}
          label="Featured Product"
          description="Choose a specific product from your catalog"
        />,
      );

      expect(html).toContain("Featured Product");
      expect(html).toContain("Choose a specific product from your catalog");
      expect(html).toContain("Auto (First Catalog Item)");
      expect(html).toContain("Select Product");
    });

    it("renders selected product state with image, title, price, and SKU", () => {
      const html = renderToStaticMarkup(
        <ProductPicker
          mode="single"
          value="prod_1"
          products={MOCK_PRODUCTS}
          storeCurrency="USD"
          label="Single Product"
        />,
      );

      expect(html).toContain("Minimalist Leather Backpack");
      expect(html).toContain("BP-LTHR-001");
      expect(html).toContain("$149.00");
      expect(html).toContain("Change");
      expect(html).toContain("Reset to Auto");
      expect(html).toContain('title="Remove product"');
      expect(html).toContain("https://example.com/backpack.jpg");
    });

    it("renders fallback package icon when product has no image", () => {
      const html = renderToStaticMarkup(
        <ProductPicker
          mode="single"
          value="prod_2"
          products={MOCK_PRODUCTS}
          storeCurrency="USD"
        />,
      );

      expect(html).toContain("Ceramic Pour-Over Mug");
      expect(html).toContain("MUG-CRM-002");
      expect(html).toContain("$32.00");
      expect(html).toContain("lucide-package");
    });

    it("renders unavailable/deleted product state gracefully", () => {
      const html = renderToStaticMarkup(
        <ProductPicker
          mode="single"
          value="deleted_prod_999"
          products={MOCK_PRODUCTS}
          label="Product Selector"
        />,
      );

      expect(html).toContain("Product Unavailable or Deleted");
      expect(html).toContain("deleted_prod_999");
      expect(html).toContain("Re-select");
      expect(html).toContain('title="Remove product"');
    });

    it("renders multiple selection summary and selected product cards", () => {
      const html = renderToStaticMarkup(
        <ProductPicker
          mode="multiple"
          values={["prod_1", "prod_3"]}
          products={MOCK_PRODUCTS}
          storeCurrency="USD"
          label="Curated Products"
        />,
      );

      expect(html).toContain("Curated Products");
      expect(html).toContain("Edit Selected Products (2)");
      expect(html).toContain("Minimalist Leather Backpack");
      expect(html).toContain("Merino Wool Beanie");
      expect(html).toContain("Reset to Auto");
    });

    it("renders multiple selection empty trigger when no products are selected", () => {
      const html = renderToStaticMarkup(
        <ProductPicker
          mode="multiple"
          values={[]}
          products={MOCK_PRODUCTS}
          label="Carousel Items"
          emptyLabel="Auto (Store Catalog)"
          placeholder="Select specific items..."
        />,
      );

      expect(html).toContain("Carousel Items");
      expect(html).toContain("Auto (Store Catalog)");
      expect(html).toContain("Select specific items...");
      expect(html).toContain("Curate Products");
    });
  });

  describe("ProductPickerDialog Modal Content", () => {
    it("renders search input, dialog title, and full product list", () => {
      const html = renderToStaticMarkup(
        <ProductPickerDialog
          open={true}
          onOpenChange={() => {}}
          products={MOCK_PRODUCTS}
          selectedId="prod_1"
          onSelect={() => {}}
          storeCurrency="USD"
          title="Select Product for Card"
        />,
      );

      expect(html).toContain("Select Product for Card");
      expect(html).toContain("Search by product name or SKU...");
      expect(html).toContain("Minimalist Leather Backpack");
      expect(html).toContain("Ceramic Pour-Over Mug");
      expect(html).toContain("Merino Wool Beanie");
      expect(html).toContain("BP-LTHR-001");
      expect(html).toContain("MUG-CRM-002");
      expect(html).toContain("WOL-BEAN-003");
      expect(html).toContain("3 variants");
    });

    it("renders empty state when no products exist", () => {
      const html = renderToStaticMarkup(
        <ProductPickerDialog
          open={true}
          onOpenChange={() => {}}
          products={[]}
          onSelect={() => {}}
        />,
      );

      expect(html).toContain("No products available in this store");
    });

    it("renders multiple mode with Apply Selection button and count", () => {
      const html = renderToStaticMarkup(
        <ProductPickerDialog
          open={true}
          onOpenChange={() => {}}
          mode="multiple"
          selectedIds={["prod_1", "prod_2"]}
          products={MOCK_PRODUCTS}
          onSelect={() => {}}
          onMultiSelect={() => {}}
        />,
      );

      expect(html).toContain("Apply Selection");
      expect(html).toContain("2 products selected");
      expect(html).toContain("Cancel");
    });

    it("does not render dialog content when open is false", () => {
      const html = renderToStaticMarkup(
        <ProductPickerDialog
          open={false}
          onOpenChange={() => {}}
          products={MOCK_PRODUCTS}
          onSelect={() => {}}
        />,
      );

      expect(html).toBe("");
    });
  });

  describe("Storefront Sections & Elements Filtering by Curated productIds", () => {
    it("filters FeaturedProductsSection products when productIds are specified", () => {
      const html = renderToStaticMarkup(
        <FeaturedProductsSection
          section={{
            id: "featured_sec_1",
            type: "featured_products",
            config: {
              heading: "Handpicked Essentials",
              productIds: ["prod_1", "prod_3"],
            },
          }}
          storeSlug="aurora"
          storeCurrency="USD"
          products={MOCK_PRODUCTS}
        />,
      );

      expect(html).toContain("Handpicked Essentials");
      expect(html).toContain("Minimalist Leather Backpack");
      expect(html).toContain("Merino Wool Beanie");
      expect(html).not.toContain("Ceramic Pour-Over Mug");
    });

    it("filters ProductCarouselSection products when productIds are specified", () => {
      const html = renderToStaticMarkup(
        <ProductCarouselSection
          section={{
            id: "carousel_sec_1",
            type: "product_carousel",
            config: {
              heading: "Featured Rotation",
              sourceType: "products",
              productIds: ["prod_2"],
            },
          }}
          storeSlug="aurora"
          storeCurrency="USD"
          products={MOCK_PRODUCTS}
        />,
      );

      expect(html).toContain("Featured Rotation");
      expect(html).toContain("Ceramic Pour-Over Mug");
      expect(html).not.toContain("Minimalist Leather Backpack");
      expect(html).not.toContain("Merino Wool Beanie");
    });

    it("filters ProductCarouselElement when productIds are specified", () => {
      const html = renderToStaticMarkup(
        <ProductCarouselElement
          element={{
            id: "elem_carousel_1",
            type: "product_carousel",
            content: {
              productIds: ["prod_3"],
            },
          }}
          products={MOCK_PRODUCTS}
          storeSlug="aurora"
          storeCurrency="USD"
        />,
      );

      expect(html).toContain("Merino Wool Beanie");
      expect(html).not.toContain("Minimalist Leather Backpack");
      expect(html).not.toContain("Ceramic Pour-Over Mug");
    });
  });
});
