import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ProductDetailView,
  getColorHex,
  getVariantOptionValue,
  findMatchingVariant,
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

  describe("Option Value Extraction & Variant Matching Logic", () => {
    const testOptions = [
      { id: "opt_model", productId: "p1", name: "Model", position: 0, values: ["Black", "Blue", "Red"], isPublishable: true, createdAt: "", updatedAt: "" },
      { id: "opt_size", productId: "p1", name: "Size", position: 1, values: ["S", "M", "L"], isPublishable: false, createdAt: "", updatedAt: "" },
      { id: "opt_fabric", productId: "p1", name: "Fabric", position: 2, values: ["Cotton", "Poly"], isPublishable: false, createdAt: "", updatedAt: "" },
    ];

    const testVariants = [
      {
        id: "var_red_s_cotton",
        productId: "p1",
        title: "Red / S / Cotton",
        sku: "RED-S-COT",
        price: 3000,
        position: 0,
        status: "ACTIVE" as const,
        option1: "Red",
        option2: "S",
        option3: "Cotton",
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "var_red_m_cotton",
        productId: "p1",
        title: "Red / M / Cotton",
        sku: "RED-M-COT",
        price: 3200,
        position: 1,
        status: "ACTIVE" as const,
        option1: "Red",
        option2: "M",
        option3: "Cotton",
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "var_blue_s_cotton",
        productId: "p1",
        title: "Blue / S / Cotton",
        sku: "BLU-S-COT",
        price: 3000,
        position: 2,
        status: "ACTIVE" as const,
        option1: "Blue",
        option2: "S",
        option3: "Cotton",
        createdAt: "",
        updatedAt: "",
      },
    ];

    it("extracts option values accurately based on option position and fallback", () => {
      const v = testVariants[0]!;
      expect(getVariantOptionValue(v, testOptions[0]!, testOptions)).toBe("Red");
      expect(getVariantOptionValue(v, testOptions[1]!, testOptions)).toBe("S");
      expect(getVariantOptionValue(v, testOptions[2]!, testOptions)).toBe("Cotton");

      // Fallback from title when option fields are null
      const titleOnlyVariant = {
        ...v,
        option1: null,
        option2: null,
        option3: null,
        title: "Blue / L / Poly",
      };
      expect(getVariantOptionValue(titleOnlyVariant, testOptions[0]!, testOptions)).toBe("Blue");
      expect(getVariantOptionValue(titleOnlyVariant, testOptions[1]!, testOptions)).toBe("L");
      expect(getVariantOptionValue(titleOnlyVariant, testOptions[2]!, testOptions)).toBe("Poly");
    });

    it("matches exact variant combinations case-insensitively", () => {
      const match = findMatchingVariant(testVariants, testOptions, {
        Model: "red",
        Size: "M",
        Fabric: "Cotton",
      });
      expect(match).toBeDefined();
      expect(match!.id).toBe("var_red_m_cotton");
    });

    it("returns undefined when combination does not exist", () => {
      const match = findMatchingVariant(testVariants, testOptions, {
        Model: "Red",
        Size: "XL",
        Fabric: "Cotton",
      });
      expect(match).toBeUndefined();
    });
  });

  describe("Publishable Option Listing & Non-Publishable Options Independence", () => {
    const standaloneListingProduct: StorefrontProductDetailDTO = {
      id: "prod_tee_001",
      storeId: "store_tee",
      title: "Graphic Boxy Tee",
      slug: "graphic-boxy-tee",
      description: "Vintage streetwear cotton tee.",
      status: "ACTIVE",
      publishedAt: "2026-02-01T10:00:00Z",
      lowStockThreshold: 5,
      maxOrderQuantity: 10,
      options: [
        {
          id: "opt_model",
          productId: "prod_tee_001",
          name: "Model",
          position: 0,
          values: ["Black", "Blue", "Red"],
          isPublishable: true,
          optionValues: [
            {
              id: "ov_black",
              optionId: "opt_model",
              value: "Black",
              displayTitle: "Pitch Black Graphic Tee",
              isPublished: true,
              position: 0,
              mediaIds: ["med_blk"],
              createdAt: "",
              updatedAt: "",
            },
            {
              id: "ov_blue",
              optionId: "opt_model",
              value: "Blue",
              displayTitle: "Cobalt Blue Graphic Tee",
              isPublished: true,
              position: 1,
              mediaIds: ["med_blu"],
              createdAt: "",
              updatedAt: "",
            },
            {
              id: "ov_red",
              optionId: "opt_model",
              value: "Red",
              displayTitle: "Crimson Red Graphic Tee",
              isPublished: true,
              position: 2,
              mediaIds: ["med_red"],
              createdAt: "",
              updatedAt: "",
            },
          ],
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "opt_size",
          productId: "prod_tee_001",
          name: "Size",
          position: 1,
          values: ["S", "M", "L"],
          isPublishable: false,
          createdAt: "",
          updatedAt: "",
        },
      ],
      variants: [
        // Red variants
        {
          id: "var_red_s",
          productId: "prod_tee_001",
          title: "Red / S",
          sku: "TEE-RED-S",
          price: 2800,
          position: 0,
          status: "ACTIVE",
          option1: "Red",
          option2: "S",
          option3: null,
          inventory: { availableQuantity: 10, isLowStock: false, isOutOfStock: false, lowStockThreshold: 5, maxOrderQuantity: 10, effectiveMaxQuantity: 10 },
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "var_red_m",
          productId: "prod_tee_001",
          title: "Red / M",
          sku: "TEE-RED-M",
          price: 2800,
          position: 1,
          status: "ACTIVE",
          option1: "Red",
          option2: "M",
          option3: null,
          inventory: { availableQuantity: 15, isLowStock: false, isOutOfStock: false, lowStockThreshold: 5, maxOrderQuantity: 10, effectiveMaxQuantity: 10 },
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "var_red_l",
          productId: "prod_tee_001",
          title: "Red / L",
          sku: "TEE-RED-L",
          price: 3000,
          position: 2,
          status: "ACTIVE",
          option1: "Red",
          option2: "L",
          option3: null,
          inventory: { availableQuantity: 0, isLowStock: false, isOutOfStock: true, lowStockThreshold: 5, maxOrderQuantity: 10, effectiveMaxQuantity: 0 },
          createdAt: "",
          updatedAt: "",
        },
        // Blue variants
        {
          id: "var_blue_s",
          productId: "prod_tee_001",
          title: "Blue / S",
          sku: "TEE-BLU-S",
          price: 3200,
          position: 3,
          status: "ACTIVE",
          option1: "Blue",
          option2: "S",
          option3: null,
          inventory: { availableQuantity: 20, isLowStock: false, isOutOfStock: false, lowStockThreshold: 5, maxOrderQuantity: 10, effectiveMaxQuantity: 10 },
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "var_blue_m",
          productId: "prod_tee_001",
          title: "Blue / M",
          sku: "TEE-BLU-M",
          price: 3200,
          position: 4,
          status: "ACTIVE",
          option1: "Blue",
          option2: "M",
          option3: null,
          inventory: { availableQuantity: 25, isLowStock: false, isOutOfStock: false, lowStockThreshold: 5, maxOrderQuantity: 10, effectiveMaxQuantity: 10 },
          createdAt: "",
          updatedAt: "",
        },
      ],
      media: [
        { id: "med_blk", productId: "prod_tee_001", url: "https://example.com/black.jpg", altText: "Black Tee", position: 0, createdAt: "", updatedAt: "" },
        { id: "med_blu", productId: "prod_tee_001", url: "https://example.com/blue.jpg", altText: "Blue Tee", position: 1, createdAt: "", updatedAt: "" },
        { id: "med_red", productId: "prod_tee_001", url: "https://example.com/red.jpg", altText: "Red Tee", position: 2, createdAt: "", updatedAt: "" },
      ],
      createdAt: "",
      updatedAt: "",
    };

    it("renders standalone Red listing with Red display title and preserves all non-publishable Size options", () => {
      const html = renderToStaticMarkup(
        <ProductDetailView
          product={standaloneListingProduct}
          storeSlug="apparel"
          storeName="Apparel"
          storeCurrency="USD"
          initialVariantId="var_red_s"
        />
      );

      // 1. Shows Red standalone listing display title
      expect(html).toContain("Crimson Red Graphic Tee");

      // 2. Contains Size pills S, M, L for independent selection
      expect(html).toContain('data-testid="pill-size-s"');
      expect(html).toContain('data-testid="pill-size-m"');
      expect(html).toContain('data-testid="pill-size-l"');

      // 3. Isolated Red media
      expect(html).toContain("https://example.com/red.jpg");
      expect(html).not.toContain("https://example.com/blue.jpg");

      // 4. Initial price and SKU for Red / S
      expect(html).toContain("$28.00");
      expect(html).toContain("TEE-RED-S");
    });

    it("allows initializing directly on Size M without being forced to Size S", () => {
      const html = renderToStaticMarkup(
        <ProductDetailView
          product={standaloneListingProduct}
          storeSlug="apparel"
          storeName="Apparel"
          storeCurrency="USD"
          initialVariantId="var_red_m"
        />
      );

      expect(html).toContain("Crimson Red Graphic Tee");
      expect(html).toContain("TEE-RED-M");
      expect(html).toContain("$28.00");
    });

    it("renders out-of-stock indicator on genuinely out-of-stock combination Red / L", () => {
      const html = renderToStaticMarkup(
        <ProductDetailView
          product={standaloneListingProduct}
          storeSlug="apparel"
          storeName="Apparel"
          storeCurrency="USD"
          initialVariantId="var_red_l"
        />
      );

      expect(html).toContain("Out of Stock");
      expect(html).toContain("TEE-RED-L");
    });

    it("renders Blue standalone listing with Blue display title and media when opened with Blue variant", () => {
      const html = renderToStaticMarkup(
        <ProductDetailView
          product={standaloneListingProduct}
          storeSlug="apparel"
          storeName="Apparel"
          storeCurrency="USD"
          initialVariantId="var_blue_s"
        />
      );

      expect(html).toContain("Cobalt Blue Graphic Tee");
      expect(html).toContain("https://example.com/blue.jpg");
      expect(html).not.toContain("https://example.com/red.jpg");
      expect(html).toContain("$32.00");
      expect(html).toContain("TEE-BLU-S");
    });
  });
});
