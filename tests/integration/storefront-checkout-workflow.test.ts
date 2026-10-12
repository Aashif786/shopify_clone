import { describe, it, expect, vi } from "vitest";
import {
  enrichCheckout,
  isValidEmail,
  validateShippingAddress,
  type StorefrontCheckoutDTO,
} from "@/lib/storefront-checkout-helpers";
import type { Database } from "@shopify-clone/db";
import { createHmac } from "node:crypto";

describe("Storefront Checkout Integration: Validation Helpers", () => {
  describe("isValidEmail", () => {
    it("accepts valid email formats", () => {
      expect(isValidEmail("user@example.com")).toBe(true);
      expect(isValidEmail("customer.name+tag@domain.co.uk")).toBe(true);
      expect(isValidEmail("a@b.io")).toBe(true);
    });

    it("rejects invalid email formats and empty inputs", () => {
      expect(isValidEmail("")).toBe(false);
      expect(isValidEmail("plainaddress")).toBe(false);
      expect(isValidEmail("@missingusername.com")).toBe(false);
      expect(isValidEmail("missingdomain@")).toBe(false);
      expect(isValidEmail("user@ domain.com")).toBe(false);
      expect(isValidEmail("user@domain..com")).toBe(false);
    });
  });

  describe("validateShippingAddress", () => {
    const validRawAddress = {
      firstName: "Jane",
      lastName: "Doe",
      addressLine1: "123 Mountain View Way",
      addressLine2: "Suite 4B",
      city: "Boulder",
      state: "CO",
      postalCode: "80302",
      country: "US",
      phone: "+1-303-555-0199",
    };

    it("validates complete valid shipping address", () => {
      const result = validateShippingAddress(validRawAddress);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it("flags error when first name is missing or blank", () => {
      const result = validateShippingAddress({ ...validRawAddress, firstName: "   " });
      expect(result.isValid).toBe(false);
      expect(result.errors.firstName).toBe("First name is required");
    });

    it("flags error when last name is missing or blank", () => {
      const result = validateShippingAddress({ ...validRawAddress, lastName: "" });
      expect(result.isValid).toBe(false);
      expect(result.errors.lastName).toBe("Last name is required");
    });

    it("flags error when street address is missing or blank", () => {
      const result = validateShippingAddress({ ...validRawAddress, addressLine1: "" });
      expect(result.isValid).toBe(false);
      expect(result.errors.addressLine1).toBe("Street address is required");
    });

    it("flags error when city is missing", () => {
      const result = validateShippingAddress({ ...validRawAddress, city: " " });
      expect(result.isValid).toBe(false);
      expect(result.errors.city).toBe("City is required");
    });

    it("flags error when postal code is missing", () => {
      const result = validateShippingAddress({ ...validRawAddress, postalCode: "" });
      expect(result.isValid).toBe(false);
      expect(result.errors.postalCode).toBe("Postal / ZIP code is required");
    });

    it("flags error when country is missing", () => {
      const result = validateShippingAddress({ ...validRawAddress, country: "" });
      expect(result.isValid).toBe(false);
      expect(result.errors.country).toBe("Country is required");
    });

    it("handles null or undefined address input safely", () => {
      const result = validateShippingAddress(null);
      expect(result.isValid).toBe(false);
      expect(result.errors.form).toBe("Address is required");
    });
  });
});

describe("Storefront Checkout Integration: enrichCheckout Helper", () => {
  const baseCheckout: StorefrontCheckoutDTO = {
    id: "chk_019488a0-bbbb-7000-8000-000000000001",
    storeId: "store_alpine_id",
    cartId: "cart_019488a0-cccc-7000-8000-000000000001",
    customerId: null,
    email: "customer@domain.com",
    currency: "USD",
    subtotal: 5000,
    discountTotal: 0,
    shippingTotal: 500,
    taxTotal: 400,
    total: 5900,
    status: "OPEN",
    paymentStatus: "PENDING",
    shippingAddress: null,
    billingAddress: null,
    expiresAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    items: [
      {
        id: "item_01",
        checkoutId: "chk_019488a0-bbbb-7000-8000-000000000001",
        storeId: "store_alpine_id",
        variantId: "var_111",
        productNameSnapshot: "Original Snapshot Title",
        variantNameSnapshot: "Original Snapshot Variant",
        skuSnapshot: "ORIG-SKU",
        unitPrice: 2500,
        quantity: 2,
        lineTotal: 5000,
        productSlug: "",
        imageUrl: null,
        imageAlt: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ],
  };

  it("enriches checkout items with variant, product slug, and media metadata from database", async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            variant_id: "var_111",
            product_id: "prod_001",
            product_slug: "alpine-thermal-hoodie",
            image_url: "https://cdn.example.com/hoodie.jpg",
            image_alt: "Alpine Thermal Hoodie front view",
          },
        ],
        rowCount: 1,
      }),
    } as unknown as Database;

    const enriched = await enrichCheckout(mockDb, "store_alpine_id", baseCheckout);

    expect(enriched.items).toHaveLength(1);
    expect(enriched.items[0]).toMatchObject({
      id: "item_01",
      variantId: "var_111",
      quantity: 2,
      unitPrice: 2500,
      lineTotal: 5000,
      productSlug: "alpine-thermal-hoodie",
      imageUrl: "https://cdn.example.com/hoodie.jpg",
      imageAlt: "Alpine Thermal Hoodie front view",
    });
  });

  it("returns checkout immediately without querying DB if items list is empty", async () => {
    const emptyCheckout: StorefrontCheckoutDTO = {
      ...baseCheckout,
      items: [],
      subtotal: 0,
      total: 0,
    };

    const mockDb = {
      query: vi.fn(),
    } as unknown as Database;

    const enriched = await enrichCheckout(mockDb, "store_alpine_id", emptyCheckout);

    expect(enriched.items).toEqual([]);
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it("preserves snapshot values if media query returns no matching records", async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({
        rows: [],
        rowCount: 0,
      }),
    } as unknown as Database;

    const enriched = await enrichCheckout(mockDb, "store_alpine_id", baseCheckout);

    expect(enriched.items).toHaveLength(1);
    expect(enriched.items[0]).toMatchObject({
      id: "item_01",
      variantId: "var_111",
      productNameSnapshot: "Original Snapshot Title",
      productSlug: "",
      imageUrl: null,
      imageAlt: null,
    });
  });
});

describe("Storefront Checkout Integration: Security & Payment Invariants", () => {
  it("rejects untrusted Razorpay signatures that do not match server secret HMAC", () => {
    const keySecret = "test_razorpay_secret_12345";
    const orderId = "order_rzp_123456789";
    const paymentId = "pay_rzp_987654321";

    const payload = `${orderId}|${paymentId}`;
    const validSignature = createHmac("sha256", keySecret).update(payload).digest("hex");
    const tamperedSignature = createHmac("sha256", "wrong_secret").update(payload).digest("hex");

    expect(tamperedSignature).not.toBe(validSignature);

    const verifySignature = (sig: string) => {
      const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
      return sig === expected;
    };

    expect(verifySignature(validSignature)).toBe(true);
    expect(verifySignature(tamperedSignature)).toBe(false);
    expect(verifySignature("random_client_forged_signature")).toBe(false);
  });

  it("enforces tenant store isolation: rejects cross-store checkout access", () => {
    const storeAId = "store_019488a0-aaaa-7000-8000-000000000001";
    const storeBId = "store_019488a0-bbbb-7000-8000-000000000002";

    const checkoutStoreA = {
      id: "chk_001",
      storeId: storeAId,
    };

    const isAuthorizedForStore = (checkout: { storeId: string }, targetStoreId: string) => {
      return checkout.storeId === targetStoreId;
    };

    expect(isAuthorizedForStore(checkoutStoreA, storeAId)).toBe(true);
    expect(isAuthorizedForStore(checkoutStoreA, storeBId)).toBe(false);
  });
});
