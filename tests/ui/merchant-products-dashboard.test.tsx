import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProductSummaryDTO, ProductDetailDTO } from "@shopify-clone/products";
import {
  ProductTable,
  formatProductStatusBadge,
} from "@/components/merchant/products/product-table";
import { ProductForm } from "@/components/merchant/products/product-form";
import { ApiClient, ApiClientError } from "@/lib/api-client";

describe("Merchant Products Dashboard: ProductTable Component", () => {
  const mockProducts: ProductSummaryDTO[] = [
    {
      id: "prod_1",
      storeId: "store_123",
      title: "Alpine Ski Jacket",
      slug: "alpine-ski-jacket",
      status: "ACTIVE",
      publishedAt: "2026-01-01T00:00:00Z",
      variantsCount: 3,
      mediaCount: 2,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
    },
    {
      id: "prod_2",
      storeId: "store_123",
      title: "Wool Beanie",
      slug: "wool-beanie",
      status: "DRAFT",
      publishedAt: null,
      variantsCount: 1,
      mediaCount: 0,
      createdAt: "2026-01-03T00:00:00Z",
      updatedAt: "2026-01-03T00:00:00Z",
    },
  ];

  it("renders loading state with spinner when initial loading", () => {
    const html = renderToStaticMarkup(
      <ProductTable products={[]} isLoading={true} />
    );
    expect(html).toContain('class="spinner spinner-lg"');
    expect(html).toContain("Loading products...");
  });

  it("renders empty state with call to action when no products exist", () => {
    const html = renderToStaticMarkup(
      <ProductTable products={[]} isLoading={false} />
    );
    expect(html).toContain("No products found");
    expect(html).toContain("Get started by adding your first product to this store.");
    expect(html).toContain("Add Product");
    expect(html).toContain('href="/merchant/products/new"');
  });

  it("renders error state with retry button when error occurs", () => {
    const testError = new Error("Network connection lost");
    const html = renderToStaticMarkup(
      <ProductTable
        products={[]}
        error={testError}
        onRetry={() => {}}
      />
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Failed to load products");
    expect(html).toContain("Network connection lost");
    expect(html).toContain("Retry");
  });

  it("renders table with product titles, slugs, and counters", () => {
    const html = renderToStaticMarkup(
      <ProductTable products={mockProducts} />
    );
    expect(html).toContain("Alpine Ski Jacket");
    expect(html).toContain("/alpine-ski-jacket");
    expect(html).toContain("Wool Beanie");
    expect(html).toContain("/wool-beanie");
    expect(html).toContain("Store Products");
  });

  it("formats product status badges correctly (ACTIVE, DRAFT, ARCHIVED)", () => {
    const activeBadge = renderToStaticMarkup(formatProductStatusBadge("ACTIVE"));
    expect(activeBadge).toContain('class="badge badge--success badge--sm"');
    expect(activeBadge).toContain("Active");

    const draftBadge = renderToStaticMarkup(formatProductStatusBadge("DRAFT"));
    expect(draftBadge).toContain('class="badge badge--neutral badge--sm"');
    expect(draftBadge).toContain("Draft");

    const archivedBadge = renderToStaticMarkup(formatProductStatusBadge("ARCHIVED"));
    expect(archivedBadge).toContain('class="badge badge--warning badge--sm"');
    expect(archivedBadge).toContain("Archived");
  });

  it("renders pagination load more button when hasMore is true", () => {
    const html = renderToStaticMarkup(
      <ProductTable
        products={mockProducts}
        hasMore={true}
        onLoadMore={() => {}}
      />
    );
    expect(html).toContain("Load More Products");
  });
});

describe("Merchant Products Dashboard: ProductForm Component", () => {
  it("renders all core form sections and inputs", () => {
    const html = renderToStaticMarkup(
      <ProductForm storeId="store_123" />
    );
    // Basic Info Card
    expect(html).toContain("Basic Information");
    expect(html).toContain("Title");
    expect(html).toContain('id="product-title-input"');
    expect(html).toContain('id="product-slug-input"');
    expect(html).toContain('id="product-description-input"');
    expect(html).toContain('id="product-status-select"');

    // Pricing Card
    expect(html).toContain("Pricing");
    expect(html).toContain('id="product-price-input"');
    expect(html).toContain('id="product-compare-at-price-input"');
    expect(html).toContain('id="product-currency-display"');
    expect(html).not.toContain('id="product-currency-input"');

    // Inventory Card
    expect(html).toContain("Inventory");
    expect(html).toContain('id="product-sku-input"');

    // Submit Action
    expect(html).toContain("Save Product");
  });

  it("renders required indicator on title field", () => {
    const html = renderToStaticMarkup(
      <ProductForm storeId="store_123" />
    );
    expect(html).toContain('for="product-title-input"');
    expect(html).toContain('class="form-label__required"');
  });

  it("renders without duplicate key warnings for product types and categories", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const html = renderToStaticMarkup(
      <ProductForm storeId="store_123" />
    );

    const duplicateKeyWarnings = consoleErrorSpy.mock.calls.filter((call) =>
      call.some((arg) => typeof arg === "string" && arg.includes("same key"))
    );

    expect(duplicateKeyWarnings.length).toBe(0);
    expect(html).toContain('id="product-type-select"');
    expect(html).toContain('id="product-category-select"');

    consoleErrorSpy.mockRestore();
  });
});

describe("Merchant Products Dashboard: API Integration & Validation Contracts", () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient("http://localhost:3000");
    vi.restoreAllMocks();
  });

  it("fetches products for active store with pagination query params", async () => {
    let capturedUrl = "";
    let capturedHeaders: Headers | undefined;

    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (url, init) => {
      capturedUrl = String(url);
      capturedHeaders = new Headers(init?.headers);
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            items: [
              {
                id: "p_1",
                storeId: "store_abc",
                title: "Test Shoe",
                slug: "test-shoe",
                status: "ACTIVE",
                publishedAt: "2026-01-01T00:00:00Z",
                variantsCount: 1,
                mediaCount: 1,
                createdAt: "2026-01-01T00:00:00Z",
                updatedAt: "2026-01-01T00:00:00Z",
              },
            ],
            hasMore: false,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    });

    const res = await client.get<{ items: ProductSummaryDTO[]; hasMore: boolean }>(
      "/api/v1/stores/store_abc/products",
      {
        storeId: "store_abc",
        params: { limit: 20, status: "ACTIVE" },
      }
    );

    expect(capturedUrl).toContain("/api/v1/stores/store_abc/products?limit=20&status=ACTIVE");
    expect(capturedHeaders?.get("x-store-id")).toBe("store_abc");
    expect(res.items.length).toBe(1);
    expect(res.items[0]?.title).toBe("Test Shoe");
  });

  it("creates a product with price converted to minor units (cents)", async () => {
    let capturedBody: unknown = null;

    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (_url, init) => {
      capturedBody = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            id: "p_new",
            storeId: "store_abc",
            title: "Performance Hoodie",
            slug: "performance-hoodie",
            description: "Warm and lightweight hoodie",
            status: "DRAFT",
            publishedAt: null,
            variants: [
              {
                id: "v_1",
                productId: "p_new",
                title: "Default Title",
                sku: "HOOD-01",
                price: 4999,
                compareAtPrice: 6999,
                currency: "USD",
                position: 0,
                status: "ACTIVE",
                createdAt: "2026-01-01T00:00:00Z",
                updatedAt: "2026-01-01T00:00:00Z",
              },
            ],
            media: [],
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
          },
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }
      );
    });

    const payload = {
      title: "Performance Hoodie",
      description: "Warm and lightweight hoodie",
      price: 4999, // $49.99 in minor units
      compareAtPrice: 6999, // $69.99 in minor units
      sku: "HOOD-01",
      currency: "USD",
      status: "DRAFT" as const,
    };

    const created = await client.post<ProductDetailDTO>(
      "/api/v1/stores/store_abc/products",
      payload,
      { storeId: "store_abc" }
    );

    expect(capturedBody).toEqual(payload);
    expect(created.id).toBe("p_new");
    expect(created.variants[0]?.price).toBe(4999);
  });

  it("handles 403 Forbidden when user lacks admin permissions for creation", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Operation requires at least admin role in this store",
          },
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    try {
      await client.post("/api/v1/stores/store_staff/products", { title: "Forbidden Product" });
      expect.fail("Should have thrown ApiClientError");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiClientError);
      const apiErr = err as ApiClientError;
      expect(apiErr.status).toBe(403);
      expect(apiErr.code).toBe("FORBIDDEN");
      expect(apiErr.isForbidden).toBe(true);
      expect(apiErr.message).toBe("Operation requires at least admin role in this store");
    }
  });

  it("handles 400 validation error mapping field-level errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            fields: {
              title: "Product title is required and cannot be empty",
              price: "Price must be a non-negative integer in minor units (e.g. cents)",
            },
          },
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    try {
      await client.post("/api/v1/stores/store_1/products", { title: "", price: -10 });
      expect.fail("Should have thrown ApiClientError");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiClientError);
      const apiErr = err as ApiClientError;
      expect(apiErr.isValidationError).toBe(true);
      expect(apiErr.fields?.title).toBe("Product title is required and cannot be empty");
      expect(apiErr.fields?.price).toBe("Price must be a non-negative integer in minor units (e.g. cents)");
    }
  });

  it("renders ProductForm currency display reflecting the store operating currency without an independent editable input", () => {
    const html = renderToStaticMarkup(
      <ProductForm storeId="store_1" />
    );
    expect(html).toContain('id="product-currency-display"');
    expect(html).toContain("Store default operating currency");
    expect(html).not.toContain('id="product-currency-input"');
  });
});
