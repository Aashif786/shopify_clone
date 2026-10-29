import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ProductDetailView,
  getColorHex,
  getVariantOptionValue,
  findMatchingVariant,
  resolveVariantSelection,
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

  describe("Interactive Variant Switching & Standalone Listing Resolution", () => {
    const standaloneProduct: StorefrontProductDetailDTO = {
      id: "prod_sm_001",
      storeId: "store_sm",
      title: "SM",
      slug: "sm",
      description: "Spider-Man Marvel tee with standalone model publishing.",
      status: "ACTIVE",
      publishedAt: "2026-02-01T10:00:00Z",
      options: [
        {
          id: "opt_model",
          productId: "prod_sm_001",
          name: "Model",
          position: 0,
          values: ["Black", "Blue", "Red"],
          isPublishable: true,
          optionValues: [
            { id: "ov_black", optionId: "opt_model", value: "Black", displayTitle: "SM - Black", isPublished: true, position: 0, mediaIds: ["m_blk"], createdAt: "", updatedAt: "" },
            { id: "ov_blue", optionId: "opt_model", value: "Blue", displayTitle: "SM - Blue", isPublished: true, position: 1, mediaIds: ["m_blu"], createdAt: "", updatedAt: "" },
            { id: "ov_red", optionId: "opt_model", value: "Red", displayTitle: "SM - Red", isPublished: true, position: 2, mediaIds: ["m_red"], createdAt: "", updatedAt: "" },
          ],
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "opt_size",
          productId: "prod_sm_001",
          name: "Size",
          position: 1,
          values: ["S", "M", "L"],
          isPublishable: false,
          createdAt: "",
          updatedAt: "",
        },
      ],
      variants: [
        // Black
        { id: "v_blk_s", productId: "prod_sm_001", title: "Black / S", sku: "SM-BLK-S", price: 89900, position: 0, status: "ACTIVE", option1: "Black", option2: "S", option3: null, inventory: { availableQuantity: 10, isLowStock: false, isOutOfStock: false, lowStockThreshold: 5, maxOrderQuantity: null, effectiveMaxQuantity: 10 }, createdAt: "", updatedAt: "" },
        { id: "v_blk_m", productId: "prod_sm_001", title: "Black / M", sku: "SM-BLK-M", price: 89900, position: 1, status: "ACTIVE", option1: "Black", option2: "M", option3: null, inventory: { availableQuantity: 15, isLowStock: false, isOutOfStock: false, lowStockThreshold: 5, maxOrderQuantity: null, effectiveMaxQuantity: 15 }, createdAt: "", updatedAt: "" },
        { id: "v_blk_l", productId: "prod_sm_001", title: "Black / L", sku: "SM-BLK-L", price: 89900, position: 2, status: "ACTIVE", option1: "Black", option2: "L", option3: null, inventory: { availableQuantity: 5, isLowStock: true, isOutOfStock: false, lowStockThreshold: 5, maxOrderQuantity: null, effectiveMaxQuantity: 5 }, createdAt: "", updatedAt: "" },
        // Blue
        { id: "v_blu_s", productId: "prod_sm_001", title: "Blue / S", sku: "SM-BLU-S", price: 94900, position: 3, status: "ACTIVE", option1: "Blue", option2: "S", option3: null, inventory: { availableQuantity: 20, isLowStock: false, isOutOfStock: false, lowStockThreshold: 5, maxOrderQuantity: null, effectiveMaxQuantity: 20 }, createdAt: "", updatedAt: "" },
        { id: "v_blu_m", productId: "prod_sm_001", title: "Blue / M", sku: "SM-BLU-M", price: 94900, position: 4, status: "ACTIVE", option1: "Blue", option2: "M", option3: null, inventory: { availableQuantity: 25, isLowStock: false, isOutOfStock: false, lowStockThreshold: 5, maxOrderQuantity: null, effectiveMaxQuantity: 25 }, createdAt: "", updatedAt: "" },
        // Blue has no L in this catalog scenario (tests unavailable combination fallback)
        // Red
        { id: "v_red_s", productId: "prod_sm_001", title: "Red / S", sku: "SM-RED-S", price: 89900, position: 5, status: "ACTIVE", option1: "Red", option2: "S", option3: null, inventory: { availableQuantity: 12, isLowStock: false, isOutOfStock: false, lowStockThreshold: 5, maxOrderQuantity: null, effectiveMaxQuantity: 12 }, createdAt: "", updatedAt: "" },
        { id: "v_red_m", productId: "prod_sm_001", title: "Red / M", sku: "SM-RED-M", price: 89900, position: 6, status: "ACTIVE", option1: "Red", option2: "M", option3: null, inventory: { availableQuantity: 8, isLowStock: false, isOutOfStock: false, lowStockThreshold: 5, maxOrderQuantity: null, effectiveMaxQuantity: 8 }, createdAt: "", updatedAt: "" },
        { id: "v_red_l", productId: "prod_sm_001", title: "Red / L", sku: "SM-RED-L", price: 89900, position: 7, status: "ACTIVE", option1: "Red", option2: "L", option3: null, inventory: { availableQuantity: 0, isLowStock: false, isOutOfStock: true, lowStockThreshold: 5, maxOrderQuantity: null, effectiveMaxQuantity: 0 }, createdAt: "", updatedAt: "" },
      ],
      media: [
        { id: "m_blk", productId: "prod_sm_001", url: "https://example.com/sm-blk.jpg", altText: "SM Black", position: 0, createdAt: "", updatedAt: "" },
        { id: "m_blu", productId: "prod_sm_001", url: "https://example.com/sm-blu.jpg", altText: "SM Blue", position: 1, createdAt: "", updatedAt: "" },
        { id: "m_red", productId: "prod_sm_001", url: "https://example.com/sm-red.jpg", altText: "SM Red", position: 2, createdAt: "", updatedAt: "" },
      ],
      createdAt: "",
      updatedAt: "",
    };

    it("1. opening the Red listing resolves Model = Red and initial size", () => {
      const redInitial = standaloneProduct.variants.find((v) => v.id === "v_red_s")!;
      const selectedOpts: Record<string, string> = {};
      standaloneProduct.options!.forEach((opt) => {
        selectedOpts[opt.name] = getVariantOptionValue(redInitial, opt, standaloneProduct.options!)!;
      });

      expect(selectedOpts).toEqual({ Model: "Red", Size: "S" });
      const matched = findMatchingVariant(standaloneProduct.variants, standaloneProduct.options!, selectedOpts);
      expect(matched?.id).toBe("v_red_s");
      expect(matched?.sku).toBe("SM-RED-S");
    });

    it("2. clicking Size = M resolves the correct M / Red variant and preserves Model = Red", () => {
      const current = { Model: "Red", Size: "S" };
      const result = resolveVariantSelection(
        standaloneProduct.variants,
        standaloneProduct.options!,
        current,
        "Size",
        "M"
      );

      expect(result.nextOptions).toEqual({ Model: "Red", Size: "M" });
      expect(result.matchedVariant).toBeDefined();
      expect(result.matchedVariant!.id).toBe("v_red_m");
      expect(result.matchedVariant!.sku).toBe("SM-RED-M");
      expect(result.matchedVariant!.price).toBe(89900);
      expect(result.isPublishableSwitch).toBe(false);
    });

    it("3. clicking Size = L resolves the correct L / Red variant with out-of-stock inventory", () => {
      const current = { Model: "Red", Size: "M" };
      const result = resolveVariantSelection(
        standaloneProduct.variants,
        standaloneProduct.options!,
        current,
        "Size",
        "L"
      );

      expect(result.nextOptions).toEqual({ Model: "Red", Size: "L" });
      expect(result.matchedVariant).toBeDefined();
      expect(result.matchedVariant!.id).toBe("v_red_l");
      expect(result.matchedVariant!.sku).toBe("SM-RED-L");
      expect(result.matchedVariant!.inventory?.isOutOfStock).toBe(true);
      expect(result.matchedVariant!.inventory?.availableQuantity).toBe(0);
      expect(result.isPublishableSwitch).toBe(false);
    });

    it("4. clicking Model = Blue switches to Blue listing while preserving Size = M", () => {
      const current = { Model: "Red", Size: "M" };
      const result = resolveVariantSelection(
        standaloneProduct.variants,
        standaloneProduct.options!,
        current,
        "Model",
        "Blue"
      );

      expect(result.nextOptions).toEqual({ Model: "Blue", Size: "M" });
      expect(result.matchedVariant).toBeDefined();
      expect(result.matchedVariant!.id).toBe("v_blu_m");
      expect(result.matchedVariant!.sku).toBe("SM-BLU-M");
      expect(result.matchedVariant!.price).toBe(94900);
      expect(result.isPublishableSwitch).toBe(true);
    });

    it("5. size remains independently selectable after switching to Blue listing", () => {
      const current = { Model: "Blue", Size: "M" };
      const result = resolveVariantSelection(
        standaloneProduct.variants,
        standaloneProduct.options!,
        current,
        "Size",
        "S"
      );

      expect(result.nextOptions).toEqual({ Model: "Blue", Size: "S" });
      expect(result.matchedVariant).toBeDefined();
      expect(result.matchedVariant!.id).toBe("v_blu_s");
      expect(result.matchedVariant!.sku).toBe("SM-BLU-S");
      expect(result.isPublishableSwitch).toBe(false);
    });

    it("6. repeatedly switching between valid combinations works deterministically without corruption", () => {
      let state = { Model: "Red", Size: "S" };

      // Red/S -> Red/M
      let res = resolveVariantSelection(standaloneProduct.variants, standaloneProduct.options!, state, "Size", "M");
      expect(res.matchedVariant?.id).toBe("v_red_m");
      state = res.nextOptions;

      // Red/M -> Red/L
      res = resolveVariantSelection(standaloneProduct.variants, standaloneProduct.options!, state, "Size", "L");
      expect(res.matchedVariant?.id).toBe("v_red_l");
      state = res.nextOptions;

      // Red/L -> Black/L (Black has L, preserves L!)
      res = resolveVariantSelection(standaloneProduct.variants, standaloneProduct.options!, state, "Model", "Black");
      expect(res.nextOptions).toEqual({ Model: "Black", Size: "L" });
      expect(res.matchedVariant?.id).toBe("v_blk_l");
      expect(res.isPublishableSwitch).toBe(true);
      state = res.nextOptions;

      // Black/L -> Black/M
      res = resolveVariantSelection(standaloneProduct.variants, standaloneProduct.options!, state, "Size", "M");
      expect(res.matchedVariant?.id).toBe("v_blk_m");
      state = res.nextOptions;

      // Black/M -> Red/M
      res = resolveVariantSelection(standaloneProduct.variants, standaloneProduct.options!, state, "Model", "Red");
      expect(res.matchedVariant?.id).toBe("v_red_m");
      expect(res.nextOptions).toEqual({ Model: "Red", Size: "M" });
      state = res.nextOptions;

      // Red/M -> Red/S
      res = resolveVariantSelection(standaloneProduct.variants, standaloneProduct.options!, state, "Size", "S");
      expect(res.matchedVariant?.id).toBe("v_red_s");
    });

    it("7. gracefully adapts non-publishable options when a combination does not exist for a newly selected model", () => {
      // Blue does not have Size = L in this product
      const current = { Model: "Red", Size: "L" };
      const result = resolveVariantSelection(
        standaloneProduct.variants,
        standaloneProduct.options!,
        current,
        "Model",
        "Blue"
      );

      // Model must be Blue, and Size must adapt to the first available Blue variant (S)
      expect(result.nextOptions.Model).toBe("Blue");
      expect(result.matchedVariant).toBeDefined();
      expect(result.matchedVariant!.option1).toBe("Blue");
      expect(result.isPublishableSwitch).toBe(true);
    });

    it("8. handles case-insensitivity on option names and option values", () => {
      const current = { model: "red", size: "s" };
      const result = resolveVariantSelection(
        standaloneProduct.variants,
        standaloneProduct.options!,
        current,
        "size",
        "M"
      );

      expect(result.matchedVariant).toBeDefined();
      expect(result.matchedVariant!.id).toBe("v_red_m");
    });

    it("9. works correctly with dual publishable options and multiple non-publishable options", () => {
      const complexOptions = [
        { id: "o_color", productId: "p_comp", name: "Color", position: 0, values: ["Navy", "Olive"], isPublishable: true, createdAt: "", updatedAt: "" },
        { id: "o_fabric", productId: "p_comp", name: "Fabric", position: 1, values: ["Pique", "Jersey"], isPublishable: true, createdAt: "", updatedAt: "" },
        { id: "o_size", productId: "p_comp", name: "Size", position: 2, values: ["M", "L"], isPublishable: false, createdAt: "", updatedAt: "" },
      ];

      const complexVariants = [
        { id: "v_n_p_m", productId: "p_comp", title: "Navy / Pique / M", sku: "N-P-M", price: 4500, position: 0, status: "ACTIVE" as const, option1: "Navy", option2: "Pique", option3: "M", createdAt: "", updatedAt: "" },
        { id: "v_n_p_l", productId: "p_comp", title: "Navy / Pique / L", sku: "N-P-L", price: 4500, position: 1, status: "ACTIVE" as const, option1: "Navy", option2: "Pique", option3: "L", createdAt: "", updatedAt: "" },
        { id: "v_n_j_m", productId: "p_comp", title: "Navy / Jersey / M", sku: "N-J-M", price: 4800, position: 2, status: "ACTIVE" as const, option1: "Navy", option2: "Jersey", option3: "M", createdAt: "", updatedAt: "" },
        { id: "v_o_p_m", productId: "p_comp", title: "Olive / Pique / M", sku: "O-P-M", price: 4500, position: 3, status: "ACTIVE" as const, option1: "Olive", option2: "Pique", option3: "M", createdAt: "", updatedAt: "" },
      ];

      // Switch non-publishable Size: M -> L
      const sizeRes = resolveVariantSelection(
        complexVariants,
        complexOptions,
        { Color: "Navy", Fabric: "Pique", Size: "M" },
        "Size",
        "L"
      );
      expect(sizeRes.matchedVariant?.id).toBe("v_n_p_l");
      expect(sizeRes.isPublishableSwitch).toBe(false);

      // Switch publishable Fabric: Pique -> Jersey
      const fabricRes = resolveVariantSelection(
        complexVariants,
        complexOptions,
        { Color: "Navy", Fabric: "Pique", Size: "M" },
        "Fabric",
        "Jersey"
      );
      expect(fabricRes.matchedVariant?.id).toBe("v_n_j_m");
      expect(fabricRes.isPublishableSwitch).toBe(true);
    });
  });
});
