import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ProductDetailView,
  getColorHex,
  type StorefrontProductDetailDTO,
} from "@/components/storefront/products/product-detail-view";

describe("Storefront Variant Options & PDP Selection", () => {
  describe("Color Swatch Mapping", () => {
    it("resolves recognized color names to authentic hex codes", () => {
      expect(getColorHex("Red")).toBe("#ef4444");
      expect(getColorHex("blue")).toBe("#3b82f6");
      expect(getColorHex("Black")).toBe("#09090b");
      expect(getColorHex("White")).toBe("#ffffff");
      expect(getColorHex("Navy")).toBe("#1e3a8a");
      expect(getColorHex("Green")).toBe("#22c55e");
    });

    it("handles case-insensitivity, whitespace, and raw hex inputs", () => {
      expect(getColorHex("  RED  ")).toBe("#ef4444");
      expect(getColorHex("#ff0055")).toBe("#ff0055");
      expect(getColorHex("#fff")).toBe("#fff");
      expect(getColorHex("unknown-color-xyz")).toBeNull();
    });
  });

  describe("ProductDetailView Option Controls", () => {
    const multiVariantProduct: StorefrontProductDetailDTO = {
      id: "prod_luffy_shirt",
      storeId: "store_manga",
      title: "Luffy T-Shirt",
      slug: "luffy-t-shirt",
      description: "Premium cotton anime streetwear shirt.",
      status: "ACTIVE",
      publishedAt: "2026-02-01T10:00:00Z",
      typeId: null,
      typeName: "Apparel",
      categoryId: null,
      categoryName: "T-Shirts",
      tags: ["anime", "one-piece", "cotton"],
      lowStockThreshold: 5,
      maxOrderQuantity: 10,
      options: [
        {
          id: "opt_size",
          productId: "prod_luffy_shirt",
          name: "Size",
          position: 0,
          values: ["S", "M", "L", "XL"],
          createdAt: "2026-02-01T10:00:00Z",
          updatedAt: "2026-02-01T10:00:00Z",
        },
        {
          id: "opt_color",
          productId: "prod_luffy_shirt",
          name: "Color",
          position: 1,
          values: ["Red", "Blue", "Black"],
          createdAt: "2026-02-01T10:00:00Z",
          updatedAt: "2026-02-01T10:00:00Z",
        },
      ],
      variants: [
        {
          id: "var_s_red",
          productId: "prod_luffy_shirt",
          title: "S / Red",
          sku: "LUFFY-S-RED",
          price: 2999, // $29.99
          compareAtPrice: 3499, // $34.99
          currency: "USD",
          position: 0,
          status: "ACTIVE",
          option1: "S",
          option2: "Red",
          option3: null,
          imageId: "med_red",
          imageUrl: "https://example.com/luffy-red.jpg",
          lowStockThreshold: 5,
          maxOrderQuantity: 10,
          inventory: {
            availableQuantity: 15,
            isLowStock: false,
            isOutOfStock: false,
            lowStockThreshold: 5,
            maxOrderQuantity: 10,
            effectiveMaxQuantity: 10,
          },
          createdAt: "2026-02-01T10:00:00Z",
          updatedAt: "2026-02-01T10:00:00Z",
        },
        {
          id: "var_m_red",
          productId: "prod_luffy_shirt",
          title: "M / Red",
          sku: "LUFFY-M-RED",
          price: 2999,
          compareAtPrice: 3499,
          currency: "USD",
          position: 1,
          status: "ACTIVE",
          option1: "M",
          option2: "Red",
          option3: null,
          imageId: "med_red",
          imageUrl: "https://example.com/luffy-red.jpg",
          lowStockThreshold: 5,
          maxOrderQuantity: 10,
          inventory: {
            availableQuantity: 0,
            isLowStock: false,
            isOutOfStock: true,
            lowStockThreshold: 5,
            maxOrderQuantity: 10,
            effectiveMaxQuantity: 0,
          },
          createdAt: "2026-02-01T10:00:00Z",
          updatedAt: "2026-02-01T10:00:00Z",
        },
        {
          id: "var_l_blue",
          productId: "prod_luffy_shirt",
          title: "L / Blue",
          sku: "LUFFY-L-BLUE",
          price: 3199, // $31.99
          compareAtPrice: null,
          currency: "USD",
          position: 2,
          status: "ACTIVE",
          option1: "L",
          option2: "Blue",
          option3: null,
          imageId: "med_blue",
          imageUrl: "https://example.com/luffy-blue.jpg",
          lowStockThreshold: 5,
          maxOrderQuantity: 10,
          inventory: {
            availableQuantity: 3,
            isLowStock: true,
            isOutOfStock: false,
            lowStockThreshold: 5,
            maxOrderQuantity: 10,
            effectiveMaxQuantity: 3,
          },
          createdAt: "2026-02-01T10:00:00Z",
          updatedAt: "2026-02-01T10:00:00Z",
        },
      ],
      media: [
        {
          id: "med_red",
          productId: "prod_luffy_shirt",
          variantId: "var_s_red",
          url: "https://example.com/luffy-red.jpg",
          altText: "Luffy Red Shirt",
          position: 0,
          createdAt: "2026-02-01T10:00:00Z",
          updatedAt: "2026-02-01T10:00:00Z",
        },
        {
          id: "med_blue",
          productId: "prod_luffy_shirt",
          variantId: "var_l_blue",
          url: "https://example.com/luffy-blue.jpg",
          altText: "Luffy Blue Shirt",
          position: 1,
          createdAt: "2026-02-01T10:00:00Z",
          updatedAt: "2026-02-01T10:00:00Z",
        },
      ],
      createdAt: "2026-02-01T10:00:00Z",
      updatedAt: "2026-02-01T10:00:00Z",
    };

    it("renders size pills and color swatches with proper accessibility attributes", () => {
      const html = renderToStaticMarkup(
        <ProductDetailView
          product={multiVariantProduct}
          storeSlug="anime-vault"
          storeName="Anime Vault"
          storeCurrency="USD"
        />
      );

      // Verify Option Headers
      expect(html).toContain("Size:");
      expect(html).toContain("Color:");

      // Verify Size Pills
      expect(html).toContain('data-testid="pill-size-s"');
      expect(html).toContain('data-testid="pill-size-m"');
      expect(html).toContain('data-testid="pill-size-l"');
      expect(html).toContain('data-testid="pill-size-xl"');

      // Verify Color Swatches
      expect(html).toContain('data-testid="swatch-red"');
      expect(html).toContain('data-testid="swatch-blue"');
      expect(html).toContain('data-testid="swatch-black"');

      // Verify Color Swatch background hex styling
      expect(html).toContain("background-color:#ef4444"); // Red
      expect(html).toContain("background-color:#3b82f6"); // Blue
      expect(html).toContain("background-color:#09090b"); // Black

      // Verify pricing, SKU, and stock badge for default variant
      expect(html).toContain("$29.99");
      expect(html).toContain("$34.99");
      expect(html).toContain("LUFFY-S-RED");
      expect(html).toContain("In Stock");
    });

    it("renders single default variant note when product has no multi-option variants", () => {
      const singleProduct: StorefrontProductDetailDTO = {
        ...multiVariantProduct,
        options: [],
        variants: [
          {
            ...multiVariantProduct.variants[0]!,
            title: "Default Title",
            option1: null,
            option2: null,
          },
        ],
      };

      const html = renderToStaticMarkup(
        <ProductDetailView
          product={singleProduct}
          storeSlug="anime-vault"
          storeName="Anime Vault"
          storeCurrency="USD"
        />
      );

      expect(html).toContain('data-testid="default-variant-badge"');
      expect(html).toContain("Standard option");
    });

    it("preselects initialVariantId and displays variant displayTitle and isolated media gallery", () => {
      const productWithStandalone: StorefrontProductDetailDTO = {
        ...multiVariantProduct,
        variants: [
          {
            ...multiVariantProduct.variants[0]!,
            id: "var_red_standalone",
            displayTitle: "Special Crimson Luffy Tee",
            publishedAsProduct: true,
            mediaIds: ["med_red"],
          },
          {
            ...multiVariantProduct.variants[2]!,
            id: "var_blue_standalone",
            displayTitle: "Ocean Blue Luffy Tee",
            publishedAsProduct: true,
            mediaIds: ["med_blue"],
          },
        ],
        media: [
          {
            id: "med_red",
            productId: "prod_luffy_shirt",
            variantId: "var_red_standalone",
            url: "https://example.com/crimson-luffy.jpg",
            altText: "Crimson Luffy Tee",
            position: 0,
            createdAt: "2026-02-01T10:00:00Z",
            updatedAt: "2026-02-01T10:00:00Z",
          },
          {
            id: "med_blue",
            productId: "prod_luffy_shirt",
            variantId: "var_blue_standalone",
            url: "https://example.com/ocean-blue-luffy.jpg",
            altText: "Ocean Blue Luffy Tee",
            position: 1,
            createdAt: "2026-02-01T10:00:00Z",
            updatedAt: "2026-02-01T10:00:00Z",
          },
          {
            id: "med_general",
            productId: "prod_luffy_shirt",
            variantId: null,
            url: "https://example.com/general-lookbook.jpg",
            altText: "Lookbook Shot",
            position: 2,
            createdAt: "2026-02-01T10:00:00Z",
            updatedAt: "2026-02-01T10:00:00Z",
          },
        ],
      };

      // 1. Initial view with initialVariantId="var_blue_standalone"
      const blueHtml = renderToStaticMarkup(
        <ProductDetailView
          product={productWithStandalone}
          storeSlug="anime-vault"
          storeName="Anime Vault"
          storeCurrency="USD"
          initialVariantId="var_blue_standalone"
        />
      );

      // Verify title uses variant displayTitle
      expect(blueHtml).toContain("Ocean Blue Luffy Tee");

      // Verify isolated gallery: includes blue image, strictly excludes other variant's images
      expect(blueHtml).toContain("https://example.com/ocean-blue-luffy.jpg");
      expect(blueHtml).not.toContain("https://example.com/crimson-luffy.jpg");

      // 2. Initial view with initialVariantId="var_red_standalone"
      const redHtml = renderToStaticMarkup(
        <ProductDetailView
          product={productWithStandalone}
          storeSlug="anime-vault"
          storeName="Anime Vault"
          storeCurrency="USD"
          initialVariantId="var_red_standalone"
        />
      );

      expect(redHtml).toContain("Special Crimson Luffy Tee");
      expect(redHtml).toContain("https://example.com/crimson-luffy.jpg");
      expect(redHtml).not.toContain("https://example.com/ocean-blue-luffy.jpg");

      // 3. Variant without assigned images falls back to unassigned general product images
      const unassignedVariantProduct: StorefrontProductDetailDTO = {
        ...productWithStandalone,
        variants: [
          {
            ...multiVariantProduct.variants[1]!,
            id: "var_unassigned",
            title: "M / Green",
            displayTitle: null,
            publishedAsProduct: false,
            mediaIds: [],
            media: [],
            imageId: null,
            imageUrl: null,
          },
        ],
      };

      const unassignedHtml = renderToStaticMarkup(
        <ProductDetailView
          product={unassignedVariantProduct}
          storeSlug="anime-vault"
          storeName="Anime Vault"
          storeCurrency="USD"
          initialVariantId="var_unassigned"
        />
      );

      expect(unassignedHtml).toContain("https://example.com/general-lookbook.jpg");
      expect(unassignedHtml).not.toContain("https://example.com/crimson-luffy.jpg");
      expect(unassignedHtml).not.toContain("https://example.com/ocean-blue-luffy.jpg");
    });
  });
});
