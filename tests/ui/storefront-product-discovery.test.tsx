import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProductSummaryDTO, ProductDetailDTO } from "@calcart/products";
import {
  ProductCard,
  formatStorePrice,
} from "@/components/storefront/products/product-card";
import { ProductGrid } from "@/components/storefront/products/product-grid";
import { ProductDetailView } from "@/components/storefront/products/product-detail-view";
import { ApiClient, ApiClientError } from "@/lib/api-client";

describe("Storefront Product Discovery: Price Formatting", () => {
  it("formats minor units (cents) into localized currency strings", () => {
    expect(formatStorePrice(4900, "USD")).toBe("$49.00");
    expect(formatStorePrice(19999, "USD")).toBe("$199.99");
    expect(formatStorePrice(0, "USD")).toBe("$0.00");
    expect(formatStorePrice(100, "USD")).toBe("$1.00");
  });

  it("handles different currencies correctly", () => {
    const eur = formatStorePrice(4500, "EUR");
    expect(eur).toContain("45.00");

    const gbp = formatStorePrice(3500, "GBP");
    expect(gbp).toContain("35.00");
  });

  it("handles null and undefined prices gracefully", () => {
    expect(formatStorePrice(null)).toBe("—");
    expect(formatStorePrice(undefined)).toBe("—");
  });
});

describe("Storefront Product Discovery: ProductCard Component", () => {
  const sampleProduct: ProductSummaryDTO = {
    id: "prod_001",
    storeId: "store_alpine",
    title: "All-Terrain Snowboard",
    slug: "all-terrain-snowboard",
    status: "ACTIVE",
    publishedAt: "2026-01-01T00:00:00Z",
    variantsCount: 3,
    mediaCount: 1,
    price: 49900, // $499.00
    compareAtPrice: 59900, // $599.00
    currency: "USD",
    primaryMediaUrl: "https://cdn.example.com/snowboard.jpg",
    primaryMediaAlt: "Snowboard top sheet graphic",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
  };

  it("renders product title, formatted price, and store-scoped link", () => {
    const html = renderToStaticMarkup(
      <ProductCard
        product={sampleProduct}
        storeSlug="alpine-outfitters"
      />,
    );

    expect(html).toContain("All-Terrain Snowboard");
    expect(html).toContain("/stores/alpine-outfitters/products/all-terrain-snowboard");
    expect(html).toContain("$499.00");
    expect(html).toContain("$599.00");
    expect(html).toContain("In Stock");
  });

  it("renders image fallback when product has no media", () => {
    const productWithoutMedia: ProductSummaryDTO = {
      ...sampleProduct,
      primaryMediaUrl: null,
      primaryMediaAlt: null,
    };

    const html = renderToStaticMarkup(
      <ProductCard
        product={productWithoutMedia}
        storeSlug="alpine-outfitters"
      />,
    );

    expect(html).toContain("storefront-product-card-fallback");
    expect(html).toContain('aria-label="Image placeholder for All-Terrain Snowboard"');
    expect(html).toContain("No image");
    expect(html).not.toContain("<img");
  });

  it("renders actual image when primary media is present", () => {
    const html = renderToStaticMarkup(
      <ProductCard
        product={sampleProduct}
        storeSlug="alpine-outfitters"
      />,
    );

    expect(html).toContain('<img src="https://cdn.example.com/snowboard.jpg"');
    expect(html).toContain('alt="Snowboard top sheet graphic"');
  });

  it("does not expose internal UUID database identifiers in customer UI", () => {
    const html = renderToStaticMarkup(
      <ProductCard
        product={sampleProduct}
        storeSlug="alpine-outfitters"
      />,
    );

    expect(html).not.toContain("prod_001");
    expect(html).not.toContain("store_alpine");
  });

  it("indicates unavailable status when product has no variants", () => {
    const unavailableProduct: ProductSummaryDTO = {
      ...sampleProduct,
      variantsCount: 0,
      price: null,
    };

    const html = renderToStaticMarkup(
      <ProductCard
        product={unavailableProduct}
        storeSlug="alpine-outfitters"
      />,
    );

    expect(html).toContain("Out of Stock");
    expect(html).toContain("Price unavailable");
  });
});

describe("Storefront Product Discovery: ProductGrid Component", () => {
  const mockProducts: ProductSummaryDTO[] = [
    {
      id: "prod_1",
      storeId: "store_123",
      title: "Alpine Ski Jacket",
      slug: "alpine-ski-jacket",
      status: "ACTIVE",
      publishedAt: "2026-01-01T00:00:00Z",
      variantsCount: 2,
      mediaCount: 1,
      price: 24900,
      currency: "USD",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
    },
    {
      id: "prod_2",
      storeId: "store_123",
      title: "Thermal Gloves",
      slug: "thermal-gloves",
      status: "ACTIVE",
      publishedAt: "2026-01-03T00:00:00Z",
      variantsCount: 1,
      mediaCount: 0,
      price: 4900,
      currency: "USD",
      createdAt: "2026-01-03T00:00:00Z",
      updatedAt: "2026-01-03T00:00:00Z",
    },
  ];

  it("renders loading spinner and message during initial load", () => {
    const html = renderToStaticMarkup(
      <ProductGrid
        products={[]}
        storeSlug="peak-shop"
        isLoading={true}
      />,
    );

    expect(html).toContain('data-testid="catalog-loading"');
    expect(html).toContain("Loading catalog...");
    expect(html).toContain('class="spinner spinner-lg"');
  });

  it("renders empty state when no products are found", () => {
    const html = renderToStaticMarkup(
      <ProductGrid
        products={[]}
        storeSlug="peak-shop"
        isLoading={false}
      />,
    );

    expect(html).toContain('data-testid="catalog-empty"');
    expect(html).toContain("No products available");
    expect(html).toContain("This store does not have any published products at the moment.");
  });

  it("renders error state with retry button when error occurs", () => {
    const error = new Error("Connection failed");
    const html = renderToStaticMarkup(
      <ProductGrid
        products={[]}
        storeSlug="peak-shop"
        error={error}
        onRetry={() => {}}
      />,
    );

    expect(html).toContain('data-testid="catalog-error"');
    expect(html).toContain("Unable to load products");
    expect(html).toContain("Connection failed");
    expect(html).toContain("Try Again");
  });

  it("renders responsive grid of products when products exist", () => {
    const html = renderToStaticMarkup(
      <ProductGrid
        products={mockProducts}
        storeSlug="peak-shop"
      />,
    );

    expect(html).toContain('data-testid="product-grid"');
    expect(html).toContain("Alpine Ski Jacket");
    expect(html).toContain("/stores/peak-shop/products/alpine-ski-jacket");
    expect(html).toContain("Thermal Gloves");
    expect(html).toContain("/stores/peak-shop/products/thermal-gloves");
  });

  it("renders pagination button when hasMore is true", () => {
    const html = renderToStaticMarkup(
      <ProductGrid
        products={mockProducts}
        storeSlug="peak-shop"
        hasMore={true}
        isLoadingMore={false}
        onLoadMore={() => {}}
      />,
    );

    expect(html).toContain("Load More Products");
    expect(html).toContain('aria-label="Load more products"');
  });

  it("omits pagination button when hasMore is false", () => {
    const html = renderToStaticMarkup(
      <ProductGrid
        products={mockProducts}
        storeSlug="peak-shop"
        hasMore={false}
      />,
    );

    expect(html).not.toContain("Load More Products");
  });
});

describe("Storefront Product Discovery: ProductDetailView Component", () => {
  const multiVariantProduct: ProductDetailDTO = {
    id: "prod_detail_1",
    storeId: "store_mountain",
    title: "Technical Hardshell Jacket",
    slug: "technical-hardshell-jacket",
    description: "Built for alpine conditions with breathable waterproof fabric.",
    status: "ACTIVE",
    publishedAt: "2026-01-10T00:00:00Z",
    variants: [
      {
        id: "var_sm",
        productId: "prod_detail_1",
        title: "Small / Black",
        sku: "JACKET-SM-BLK",
        price: 34900,
        compareAtPrice: 39900,
        currency: "USD",
        position: 0,
        status: "ACTIVE",
        createdAt: "2026-01-10T00:00:00Z",
        updatedAt: "2026-01-10T00:00:00Z",
      },
      {
        id: "var_md",
        productId: "prod_detail_1",
        title: "Medium / Black",
        sku: "JACKET-MD-BLK",
        price: 34900,
        compareAtPrice: 39900,
        currency: "USD",
        position: 1,
        status: "ACTIVE",
        createdAt: "2026-01-10T00:00:00Z",
        updatedAt: "2026-01-10T00:00:00Z",
      },
      {
        id: "var_archived",
        productId: "prod_detail_1",
        title: "Large / Discontinued",
        sku: "JACKET-LG-DISC",
        price: 29900,
        compareAtPrice: null,
        currency: "USD",
        position: 2,
        status: "ARCHIVED",
        createdAt: "2026-01-10T00:00:00Z",
        updatedAt: "2026-01-10T00:00:00Z",
      },
    ],
    media: [
      {
        id: "med_1",
        productId: "prod_detail_1",
        variantId: null,
        url: "https://cdn.example.com/jacket-front.jpg",
        altText: "Jacket front view",
        position: 0,
        createdAt: "2026-01-10T00:00:00Z",
        updatedAt: "2026-01-10T00:00:00Z",
      },
      {
        id: "med_2",
        productId: "prod_detail_1",
        variantId: null,
        url: "https://cdn.example.com/jacket-back.jpg",
        altText: "Jacket back view",
        position: 1,
        createdAt: "2026-01-10T00:00:00Z",
        updatedAt: "2026-01-10T00:00:00Z",
      },
    ],
    createdAt: "2026-01-10T00:00:00Z",
    updatedAt: "2026-01-10T00:00:00Z",
  };

  const singleVariantProduct: ProductDetailDTO = {
    id: "prod_detail_2",
    storeId: "store_mountain",
    title: "Beanie Hat",
    slug: "beanie-hat",
    description: "Warm knitted winter beanie.",
    status: "ACTIVE",
    publishedAt: "2026-01-10T00:00:00Z",
    variants: [
      {
        id: "var_def",
        productId: "prod_detail_2",
        title: "Default Title",
        sku: "BEANIE-ONE-SIZE",
        price: 2500,
        compareAtPrice: null,
        currency: "USD",
        position: 0,
        status: "ACTIVE",
        createdAt: "2026-01-10T00:00:00Z",
        updatedAt: "2026-01-10T00:00:00Z",
      },
    ],
    media: [],
    createdAt: "2026-01-10T00:00:00Z",
    updatedAt: "2026-01-10T00:00:00Z",
  };

  it("renders product title, price, SKU, and description", () => {
    const html = renderToStaticMarkup(
      <ProductDetailView
        product={multiVariantProduct}
        storeSlug="mountain-gear"
        storeName="Mountain Gear"
      />,
    );

    expect(html).toContain("Technical Hardshell Jacket");
    expect(html).toContain("$349.00");
    expect(html).toContain("$399.00");
    expect(html).toContain("JACKET-SM-BLK");
    expect(html).toContain("Built for alpine conditions with breathable waterproof fabric.");
  });

  it("distinguishes selectable variants and filters out non-active variants", () => {
    const html = renderToStaticMarkup(
      <ProductDetailView
        product={multiVariantProduct}
        storeSlug="mountain-gear"
        storeName="Mountain Gear"
      />,
    );

    expect(html).toContain('data-testid="variant-selector"');
    expect(html).toContain("Small / Black");
    expect(html).toContain("Medium / Black");
    // Non-active/archived variant must not be displayed to customer
    expect(html).not.toContain("Large / Discontinued");
  });

  it("identifies single default variant without rendering unnecessary variant selector buttons", () => {
    const html = renderToStaticMarkup(
      <ProductDetailView
        product={singleVariantProduct}
        storeSlug="mountain-gear"
        storeName="Mountain Gear"
      />,
    );

    expect(html).toContain('data-testid="default-variant-badge"');
    expect(html).toContain("Standard option");
    expect(html).not.toContain('data-testid="variant-selector"');
  });

  it("renders main image and thumbnails when multiple media items exist", () => {
    const html = renderToStaticMarkup(
      <ProductDetailView
        product={multiVariantProduct}
        storeSlug="mountain-gear"
        storeName="Mountain Gear"
      />,
    );

    expect(html).toContain('src="https://cdn.example.com/jacket-front.jpg"');
    expect(html).toContain('alt="Jacket front view"');
    expect(html).toContain('class="storefront-gallery-thumbnails"');
  });

  it("renders image fallback when product has no media", () => {
    const html = renderToStaticMarkup(
      <ProductDetailView
        product={singleVariantProduct}
        storeSlug="mountain-gear"
        storeName="Mountain Gear"
      />,
    );

    expect(html).toContain('data-testid="product-image-fallback"');
    expect(html).toContain("No product image available");
  });

  it("provides breadcrumb navigation back to the store catalog", () => {
    const html = renderToStaticMarkup(
      <ProductDetailView
        product={multiVariantProduct}
        storeSlug="mountain-gear"
        storeName="Mountain Gear"
      />,
    );

    expect(html).toContain('href="/stores/mountain-gear/products"');
    expect(html).toContain("Products");
    expect(html).toContain('href="/stores/mountain-gear"');
    expect(html).toContain("Mountain Gear");
  });
});

describe("Storefront Product Discovery: Store & Product Isolation Rules", () => {
  it("enforces tenant store scoping in URLs", () => {
    const storeASlug = "store-alpha";
    const storeBSlug = "store-beta";

    const product: ProductSummaryDTO = {
      id: "prod_iso_1",
      storeId: "store_alpha_id",
      title: "Alpha Shoes",
      slug: "alpha-shoes",
      status: "ACTIVE",
      publishedAt: "2026-01-01T00:00:00Z",
      variantsCount: 1,
      mediaCount: 0,
      price: 9900,
      currency: "USD",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };

    const cardA = renderToStaticMarkup(
      <ProductCard product={product} storeSlug={storeASlug} />,
    );
    expect(cardA).toContain(`/stores/${storeASlug}/products/alpha-shoes`);
    expect(cardA).not.toContain(`/stores/${storeBSlug}/`);
  });

  it("handles 404 ApiClientError properly for store or product not-found", async () => {
    const client = new ApiClient();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: false,
        error: {
          code: "STOREFRONT_NOT_FOUND",
          message: "Store not found or unavailable",
        },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(
      client.get("/api/v1/storefront/nonexistent-store/products"),
    ).rejects.toThrowError(ApiClientError);

    try {
      await client.get("/api/v1/storefront/nonexistent-store/products");
    } catch (err) {
      expect(err instanceof ApiClientError).toBe(true);
      if (err instanceof ApiClientError) {
        expect(err.status).toBe(404);
        expect(err.code).toBe("STOREFRONT_NOT_FOUND");
        expect(err.isNotFound).toBe(true);
      }
    }

    vi.unstubAllGlobals();
  });

  it("handles product not-found 404 when product is unpublished, archived, or non-existent", async () => {
    const client = new ApiClient();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: false,
        error: {
          code: "PRODUCT_NOT_FOUND",
          message: "Product not found or unavailable",
        },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    try {
      await client.get("/api/v1/storefront/store-1/products/draft-product");
    } catch (err) {
      expect(err instanceof ApiClientError).toBe(true);
      if (err instanceof ApiClientError) {
        expect(err.status).toBe(404);
        expect(err.code).toBe("PRODUCT_NOT_FOUND");
      }
    }

    vi.unstubAllGlobals();
  });
});
