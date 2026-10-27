import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProductDetailDTO } from "@shopify-clone/products";
import {
  ProductDetails,
  formatPriceMinor,
} from "@/components/merchant/products/product-details";
import { ProductStatusActions } from "@/components/merchant/products/product-status-actions";
import { ProductEditForm } from "@/components/merchant/products/product-edit-form";
import { ApiClient, ApiClientError } from "@/lib/api-client";

describe("Merchant Product Details: ProductDetails Component", () => {
  const mockProduct: ProductDetailDTO = {
    id: "prod_100",
    storeId: "store_abc",
    title: "All-Mountain Snowboard",
    slug: "all-mountain-snowboard",
    description: "Versatile snowboard designed for backcountry and groomers.",
    status: "ACTIVE",
    publishedAt: "2026-01-15T10:00:00Z",
    variants: [
      {
        id: "var_101",
        productId: "prod_100",
        title: "158cm / Standard",
        sku: "SNOW-158",
        price: 49900, // $499.00
        compareAtPrice: 59900, // $599.00
        currency: "USD",
        position: 0,
        status: "ACTIVE",
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      },
    ],
    media: [
      {
        id: "med_101",
        productId: "prod_100",
        variantId: null,
        url: "https://example.com/snowboard.jpg",
        altText: "Top sheet graphic",
        position: 0,
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      },
    ],
    createdAt: "2026-01-15T10:00:00Z",
    updatedAt: "2026-01-16T12:00:00Z",
  };

  it("formats minor units into currency strings accurately", () => {
    expect(formatPriceMinor(49900, "USD")).toBe("$499.00");
    expect(formatPriceMinor(1999, "USD")).toBe("$19.99");
    expect(formatPriceMinor(0, "USD")).toBe("$0.00");
  });

  it("renders product title, status badge, slug, and description", () => {
    const html = renderToStaticMarkup(
      <ProductDetails
        product={mockProduct}
        storeId="store_abc"
        userRole="admin"
        onEditClick={() => {}}
        onProductUpdate={() => {}}
      />
    );
    expect(html).toContain("All-Mountain Snowboard");
    expect(html).toContain("Active");
    expect(html).toContain('class="badge badge--success badge--sm"');
    expect(html).toContain("/all-mountain-snowboard");
    expect(html).toContain("Versatile snowboard designed for backcountry and groomers.");
  });

  it("renders pricing and compare-at pricing with currency", () => {
    const html = renderToStaticMarkup(
      <ProductDetails
        product={mockProduct}
        storeId="store_abc"
        userRole="admin"
        onEditClick={() => {}}
        onProductUpdate={() => {}}
      />
    );
    expect(html).toContain("$499.00");
    expect(html).toContain("$599.00");
    expect(html).toContain("SNOW-158");
    expect(html).toContain("USD");
  });

  it("renders variants table with titles, SKUs, and prices", () => {
    const html = renderToStaticMarkup(
      <ProductDetails
        product={mockProduct}
        storeId="store_abc"
        userRole="admin"
        onEditClick={() => {}}
        onProductUpdate={() => {}}
      />
    );
    expect(html).toContain("158cm / Standard");
    expect(html).toContain("SNOW-158");
    expect(html).toContain("Variants (1)");
  });

  it("renders Edit Product button for admin role, hides for staff role", () => {
    const adminHtml = renderToStaticMarkup(
      <ProductDetails
        product={mockProduct}
        storeId="store_abc"
        userRole="admin"
        onEditClick={() => {}}
        onProductUpdate={() => {}}
      />
    );
    expect(adminHtml).toContain("Edit Product");

    const staffHtml = renderToStaticMarkup(
      <ProductDetails
        product={mockProduct}
        storeId="store_abc"
        userRole="staff"
        onEditClick={() => {}}
        onProductUpdate={() => {}}
      />
    );
    expect(staffHtml).not.toContain("Edit Product");
  });
});

describe("Merchant Product Details: ProductStatusActions Component", () => {
  const draftProduct: ProductDetailDTO = {
    id: "p_draft",
    storeId: "store_abc",
    title: "Draft Board",
    slug: "draft-board",
    description: null,
    status: "DRAFT",
    publishedAt: null,
    variants: [],
    media: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  const activeProduct: ProductDetailDTO = {
    ...draftProduct,
    id: "p_active",
    status: "ACTIVE",
    publishedAt: "2026-01-02T00:00:00Z",
  };

  const archivedProduct: ProductDetailDTO = {
    ...draftProduct,
    id: "p_archived",
    status: "ARCHIVED",
  };

  it("renders Publish and Archive buttons for DRAFT status", () => {
    const html = renderToStaticMarkup(
      <ProductStatusActions
        product={draftProduct}
        storeId="store_abc"
        userRole="admin"
        onStatusChange={() => {}}
      />
    );
    expect(html).toContain("Publish Product");
    expect(html).toContain("Archive Product");
    expect(html).not.toContain("Unpublish (Draft)");
  });

  it("renders Unpublish and Archive buttons for ACTIVE status", () => {
    const html = renderToStaticMarkup(
      <ProductStatusActions
        product={activeProduct}
        storeId="store_abc"
        userRole="admin"
        onStatusChange={() => {}}
      />
    );
    expect(html).toContain("Unpublish (Draft)");
    expect(html).toContain("Archive Product");
    expect(html).not.toContain("Publish Product");
  });

  it("renders Restore to Draft button for ARCHIVED status", () => {
    const html = renderToStaticMarkup(
      <ProductStatusActions
        product={archivedProduct}
        storeId="store_abc"
        userRole="admin"
        onStatusChange={() => {}}
      />
    );
    expect(html).toContain("Restore to Draft");
    expect(html).not.toContain("Publish Product");
    expect(html).not.toContain("Archive Product");
  });

  it("displays permission message when user has staff role", () => {
    const html = renderToStaticMarkup(
      <ProductStatusActions
        product={draftProduct}
        storeId="store_abc"
        userRole="staff"
        onStatusChange={() => {}}
      />
    );
    expect(html).toContain("Admin privileges required to change product status.");
    expect(html).not.toContain("Publish Product");
  });
});

describe("Merchant Product Details: ProductEditForm Component", () => {
  const existingProduct: ProductDetailDTO = {
    id: "p_edit_1",
    storeId: "store_abc",
    title: "Trail Runners",
    slug: "trail-runners",
    description: "Rugged trail running shoes",
    status: "ACTIVE",
    publishedAt: "2026-01-01T00:00:00Z",
    variants: [
      {
        id: "var_edit_1",
        productId: "p_edit_1",
        title: "Default Title",
        sku: "TRAIL-01",
        price: 12999, // $129.99
        compareAtPrice: 15999, // $159.99
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
  };

  it("pre-populates form inputs from persisted product data", () => {
    const html = renderToStaticMarkup(
      <ProductEditForm
        product={existingProduct}
        storeId="store_abc"
        onSuccess={() => {}}
        onCancel={() => {}}
      />
    );
    expect(html).toContain('value="Trail Runners"');
    expect(html).toContain('value="trail-runners"');
    expect(html).toContain("Rugged trail running shoes");
    expect(html).toContain('value="129.99"');
    expect(html).toContain('value="159.99"');
    expect(html).toContain('value="TRAIL-01"');
    expect(html).toContain("Save Changes");
    expect(html).toContain("Cancel");
  });

  it("pre-populates form inputs from persisted product data with options and variants", () => {
    const multiVariantProduct: ProductDetailDTO = {
      id: "p_edit_2",
      storeId: "store_abc",
      title: "Alpine Jacket",
      slug: "alpine-jacket",
      description: "Waterproof technical shell",
      status: "ACTIVE",
      typeId: "type_apparel",
      categoryId: "cat_outerwear",
      tags: ["outerwear", "winter", "waterproof"],
      publishedAt: "2026-01-01T00:00:00Z",
      options: [
        {
          id: "opt_size",
          productId: "p_edit_2",
          name: "Size",
          position: 0,
          values: ["S", "M", "L"],
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
      variants: [
        {
          id: "var_s",
          productId: "p_edit_2",
          title: "S",
          sku: "ALPINE-S",
          price: 29900,
          compareAtPrice: 34900,
          currency: "USD",
          position: 0,
          status: "ACTIVE",
          option1: "S",
          option2: null,
          option3: null,
          inventoryQuantity: 25,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
        {
          id: "var_m",
          productId: "p_edit_2",
          title: "M",
          sku: "ALPINE-M",
          price: 29900,
          compareAtPrice: 34900,
          currency: "USD",
          position: 1,
          status: "ACTIVE",
          option1: "M",
          option2: null,
          option3: null,
          inventoryQuantity: 30,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
      media: [
        {
          id: "med_1",
          productId: "p_edit_2",
          variantId: null,
          url: "https://example.com/alpine.jpg",
          altText: "Front view of Alpine Jacket",
          position: 0,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };

    const html = renderToStaticMarkup(
      <ProductEditForm
        product={multiVariantProduct}
        storeId="store_abc"
        onSuccess={() => {}}
        onCancel={() => {}}
      />
    );
    expect(html).toContain('value="Alpine Jacket"');
    expect(html).toContain('value="alpine-jacket"');
    expect(html).toContain("Waterproof technical shell");
    expect(html).toContain("Edit Product: Alpine Jacket");
    expect(html).toContain("Size");
    expect(html).toContain("S");
    expect(html).toContain("M");
    expect(html).toContain("L");
    expect(html).toContain('value="ALPINE-S"');
    expect(html).toContain('value="ALPINE-M"');
    expect(html).toContain("outerwear");
    expect(html).toContain("winter");
    expect(html).toContain("waterproof");
    expect(html).toContain("https://example.com/alpine.jpg");
    expect(html).toContain("Save Changes");
    expect(html).toContain("Cancel");
  });
});

describe("Merchant Product Details: API Integration & Lifecycle Transitions", () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient("http://localhost:3000");
    vi.restoreAllMocks();
  });

  it("fetches single product detail with store scoping", async () => {
    let capturedHeaders: Headers | undefined;

    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (_url, init) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            id: "p_target",
            storeId: "store_xyz",
            title: "Target Product",
            slug: "target-product",
            description: null,
            status: "DRAFT",
            publishedAt: null,
            variants: [],
            media: [],
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    });

    const res = await client.get<ProductDetailDTO>(
      "/api/v1/stores/store_xyz/products/p_target",
      { storeId: "store_xyz" }
    );

    expect(capturedHeaders?.get("x-store-id")).toBe("store_xyz");
    expect(res.id).toBe("p_target");
    expect(res.title).toBe("Target Product");
  });

  it("executes publish lifecycle transition endpoint", async () => {
    let capturedUrl = "";

    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (url) => {
      capturedUrl = String(url);
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            id: "p_target",
            status: "ACTIVE",
            publishedAt: "2026-01-10T00:00:00Z",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    });

    const res = await client.post<{ id: string; status: string }>(
      "/api/v1/stores/store_xyz/products/p_target/publish",
      {},
      { storeId: "store_xyz" }
    );

    expect(capturedUrl).toContain("/api/v1/stores/store_xyz/products/p_target/publish");
    expect(res.status).toBe("ACTIVE");
  });

  it("executes archive lifecycle transition endpoint", async () => {
    let capturedUrl = "";

    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (url) => {
      capturedUrl = String(url);
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            id: "p_target",
            status: "ARCHIVED",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    });

    const res = await client.post<{ id: string; status: string }>(
      "/api/v1/stores/store_xyz/products/p_target/archive",
      {},
      { storeId: "store_xyz" }
    );

    expect(capturedUrl).toContain("/api/v1/stores/store_xyz/products/p_target/archive");
    expect(res.status).toBe("ARCHIVED");
  });

  it("handles 404 when product is not found or belongs to another store", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Product not found",
          },
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    try {
      await client.get("/api/v1/stores/store_xyz/products/non_existent", { storeId: "store_xyz" });
      expect.fail("Should have thrown ApiClientError");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiClientError);
      const apiErr = err as ApiClientError;
      expect(apiErr.status).toBe(404);
      expect(apiErr.isNotFound).toBe(true);
    }
  });

  it("handles 400 when invalid state transition is requested", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "INVALID_STATE_TRANSITION",
            message: "Cannot transition product from ARCHIVED to ACTIVE",
          },
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    try {
      await client.post("/api/v1/stores/store_xyz/products/p_archived/publish", {}, { storeId: "store_xyz" });
      expect.fail("Should have thrown ApiClientError");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiClientError);
      const apiErr = err as ApiClientError;
      expect(apiErr.status).toBe(400);
      expect(apiErr.code).toBe("INVALID_STATE_TRANSITION");
      expect(apiErr.message).toBe("Cannot transition product from ARCHIVED to ACTIVE");
    }
  });
});
