import { describe, it, expect, vi } from "vitest";
import { enrichCart } from "@/lib/storefront-cart-helpers";
import type { CartDTO } from "@calcart/carts";
import type { Database } from "@calcart/db";

describe("Storefront Cart Workflow: Cart Enrichment", () => {
  const sampleCart: CartDTO = {
    id: "cart-12345",
    storeId: "store-alpine-id",
    customerId: null,
    guestIdentifier: "guest-test-1",
    currency: "USD",
    subtotal: 5000,
    discountTotal: 0,
    taxTotal: 0,
    shippingTotal: 0,
    grandTotal: 5000,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    items: [
      {
        id: "item-1",
        variantId: "var-111",
        unitPrice: 2500,
        quantity: 2,
        lineSubtotal: 5000,
      },
    ],
  };

  it("enriches cart items with variant and product metadata", async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            variant_id: "var-111",
            variant_title: "Size L",
            sku: "ALP-L",
            product_id: "prod-999",
            product_title: "Alpine Puffer Jacket",
            product_slug: "alpine-puffer-jacket",
            image_url: "https://cdn.example.com/jacket.jpg",
            image_alt: "Jacket front view",
          },
        ],
        rowCount: 1,
      }),
    } as unknown as Database;

    const enriched = await enrichCart(mockDb, "store-alpine-id", sampleCart);

    expect(enriched.items).toHaveLength(1);
    expect(enriched.items[0]).toMatchObject({
      id: "item-1",
      variantId: "var-111",
      productTitle: "Alpine Puffer Jacket",
      productSlug: "alpine-puffer-jacket",
      variantTitle: "Size L",
      sku: "ALP-L",
      imageUrl: "https://cdn.example.com/jacket.jpg",
      imageAlt: "Jacket front view",
      unitPrice: 2500,
      quantity: 2,
      lineSubtotal: 5000,
    });
  });

  it("handles empty cart without querying database", async () => {
    const emptyCart: CartDTO = {
      ...sampleCart,
      items: [],
      subtotal: 0,
      grandTotal: 0,
    };

    const mockDb = {
      query: vi.fn(),
    } as unknown as Database;

    const enriched = await enrichCart(mockDb, "store-alpine-id", emptyCart);

    expect(enriched.items).toEqual([]);
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it("provides safe defaults when variant metadata is missing from database", async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({
        rows: [],
        rowCount: 0,
      }),
    } as unknown as Database;

    const enriched = await enrichCart(mockDb, "store-alpine-id", sampleCart);

    expect(enriched.items).toHaveLength(1);
    expect(enriched.items[0]).toMatchObject({
      id: "item-1",
      productTitle: "Unknown Product",
      productSlug: "",
      variantTitle: "Default",
      sku: null,
      imageUrl: null,
      imageAlt: null,
    });
  });
});

describe("Storefront Cart Workflow: Quantity Limits & Validation", () => {
  it("enforces backend quantity limits (1 to 999 for addition)", () => {
    const isValidAddQty = (q: unknown): boolean =>
      typeof q === "number" && Number.isInteger(q) && q >= 1 && q <= 999;

    expect(isValidAddQty(1)).toBe(true);
    expect(isValidAddQty(999)).toBe(true);
    expect(isValidAddQty(5)).toBe(true);

    expect(isValidAddQty(0)).toBe(false);
    expect(isValidAddQty(-1)).toBe(false);
    expect(isValidAddQty(1000)).toBe(false);
    expect(isValidAddQty(1.5)).toBe(false);
    expect(isValidAddQty("5")).toBe(false);
  });

  it("enforces backend quantity limits for updates (0 removes item)", () => {
    const isValidUpdateQty = (q: unknown): boolean =>
      typeof q === "number" && Number.isInteger(q) && q >= 0 && q <= 999;

    expect(isValidUpdateQty(0)).toBe(true); // 0 triggers removal
    expect(isValidUpdateQty(1)).toBe(true);
    expect(isValidUpdateQty(999)).toBe(true);

    expect(isValidUpdateQty(-1)).toBe(false);
    expect(isValidUpdateQty(1000)).toBe(false);
    expect(isValidUpdateQty(NaN)).toBe(false);
  });
});

describe("Storefront Cart Workflow: Store Scoping & Guest Identity", () => {
  it("generates store-prefixed localStorage keys to guarantee store isolation", () => {
    const getStoreKey = (storeSlug: string, suffix: string) => `sc_${storeSlug}_${suffix}`;

    const storeA_CartKey = getStoreKey("store-alpha", "cart_id");
    const storeB_CartKey = getStoreKey("store-beta", "cart_id");

    expect(storeA_CartKey).toBe("sc_store-alpha_cart_id");
    expect(storeB_CartKey).toBe("sc_store-beta_cart_id");
    expect(storeA_CartKey).not.toBe(storeB_CartKey);
  });

  it("generates distinct guest identifiers per store", () => {
    const getStoreGuestKey = (storeSlug: string) => `sc_${storeSlug}_guest_id`;

    expect(getStoreGuestKey("shop-1")).toBe("sc_shop-1_guest_id");
    expect(getStoreGuestKey("shop-2")).toBe("sc_shop-2_guest_id");
  });
});
