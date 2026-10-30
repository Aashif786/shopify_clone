import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeDiscountCode,
  calculateDiscountAmount,
  evaluateDiscountCode,
  registerStoreDiscount,
  clearStoreDiscounts,
  resolveStoreDiscount,
} from "@/lib/storefront-discount-helpers";
import type { Database } from "@calcart/db";
import { Cart } from "@calcart/carts";
import { Checkout, CheckoutItem } from "@calcart/checkout";

const mockDb = null as unknown as Database;

describe("Storefront Discount Integration: Normalization", () => {
  it("normalizes discount code by trimming and converting to uppercase", () => {
    expect(normalizeDiscountCode("  welcome10  ")).toBe("WELCOME10");
    expect(normalizeDiscountCode("save20")).toBe("SAVE20");
    expect(normalizeDiscountCode("SuMmEr_50 ")).toBe("SUMMER_50");
  });

  it("handles blank and whitespace inputs safely", () => {
    expect(normalizeDiscountCode("")).toBe("");
    expect(normalizeDiscountCode("   ")).toBe("");
  });
});

describe("Storefront Discount Integration: Calculation Mechanics", () => {
  it("calculates percentage discounts accurately in integer cents", () => {
    // 10% on $100.00 (10000 cents) = 1000 cents
    expect(calculateDiscountAmount("PERCENTAGE", 10, 10000)).toBe(1000);
    // 15% on $50.00 (5000 cents) = 750 cents
    expect(calculateDiscountAmount("PERCENTAGE", 15, 5000)).toBe(750);
    // 33% on $99.99 (9999 cents) = 3299 cents (floored)
    expect(calculateDiscountAmount("PERCENTAGE", 33, 9999)).toBe(3299);
  });

  it("calculates fixed amount discounts accurately in integer cents", () => {
    // $20.00 off on $100.00
    expect(calculateDiscountAmount("FIXED_AMOUNT", 2000, 10000)).toBe(2000);
  });

  it("caps discount at subtotal to prevent negative totals", () => {
    // $50.00 discount on a $30.00 subtotal must cap at $30.00
    expect(calculateDiscountAmount("FIXED_AMOUNT", 5000, 3000)).toBe(3000);
  });

  it("returns zero discount for non-positive subtotals", () => {
    expect(calculateDiscountAmount("PERCENTAGE", 10, 0)).toBe(0);
    expect(calculateDiscountAmount("FIXED_AMOUNT", 2000, 0)).toBe(0);
  });
});

describe("Storefront Discount Integration: Eligibility & Rules Evaluation", () => {
  const storeId = "store_alpha";
  const currency = "USD";

  beforeEach(() => {
    clearStoreDiscounts();
  });

  it("successfully evaluates valid percentage discount (WELCOME10)", async () => {
    const discount = await resolveStoreDiscount(mockDb, storeId, "WELCOME10");
    expect(discount).not.toBeNull();

    const result = evaluateDiscountCode(discount, {
      targetStoreId: storeId,
      subtotal: 10000,
      currency,
    });

    expect(result.isValid).toBe(true);
    expect(result.discount).toBeDefined();
    expect(result.discount?.code).toBe("WELCOME10");
    expect(result.discount?.amount).toBe(1000);
    expect(result.discount?.currency).toBe("USD");
  });

  it("successfully evaluates fixed amount discount meeting minimum spend (SAVE20)", async () => {
    // Subtotal: $60.00 (meets $50 min spend)
    const discount = await resolveStoreDiscount(mockDb, storeId, "SAVE20");
    expect(discount).not.toBeNull();

    const result = evaluateDiscountCode(discount, {
      targetStoreId: storeId,
      subtotal: 6000,
      currency,
    });

    expect(result.isValid).toBe(true);
    expect(result.discount?.code).toBe("SAVE20");
    expect(result.discount?.amount).toBe(2000);
  });

  it("rejects discount when subtotal is below minimum spend threshold", async () => {
    // Subtotal: $40.00 (below $50.00 threshold)
    const discount = await resolveStoreDiscount(mockDb, storeId, "SAVE20");
    expect(discount).not.toBeNull();

    const result = evaluateDiscountCode(discount, {
      targetStoreId: storeId,
      subtotal: 4000,
      currency,
    });

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe("MINIMUM_AMOUNT_NOT_MET");
    expect(result.errorMessage).toContain("Minimum subtotal of $50.00 is required");
    expect(result.discount).toBeUndefined();
  });

  it("rejects expired discount code with clear reason", async () => {
    const discount = await resolveStoreDiscount(mockDb, storeId, "EXPIRED10");
    expect(discount).not.toBeNull();

    const result = evaluateDiscountCode(discount, {
      targetStoreId: storeId,
      subtotal: 10000,
      currency,
    });

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe("DISCOUNT_EXPIRED");
    expect(result.errorMessage).toContain("has expired");
  });

  it("rejects discount code when usage limit is reached", async () => {
    const discount = await resolveStoreDiscount(mockDb, storeId, "LIMITREACHED");
    expect(discount).not.toBeNull();

    const result = evaluateDiscountCode(discount, {
      targetStoreId: storeId,
      subtotal: 10000,
      currency,
    });

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe("USAGE_LIMIT_REACHED");
    expect(result.errorMessage).toContain("usage limit");
  });

  it("rejects inactive discount code", () => {
    const inactiveDiscount = {
      id: "disc_inactive",
      storeId,
      code: "NOTYET",
      name: "Future Promotion",
      type: "PERCENTAGE" as const,
      value: 20,
      currency: "USD",
      status: "INACTIVE" as const,
    };

    const result = evaluateDiscountCode(inactiveDiscount, {
      targetStoreId: storeId,
      subtotal: 10000,
      currency,
    });

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe("DISCOUNT_INACTIVE");
    expect(result.errorMessage).toContain("currently inactive");
  });

  it("rejects unrecognized or non-existent discount codes", async () => {
    const discount = await resolveStoreDiscount(mockDb, storeId, "BOGUS_CODE_99");
    expect(discount).toBeNull();

    const result = evaluateDiscountCode(discount, {
      targetStoreId: storeId,
      subtotal: 10000,
      currency,
    });

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe("DISCOUNT_NOT_FOUND");
    expect(result.errorMessage).toContain("not found");
  });

  it("rejects discount codes with mismatched currency", () => {
    const eurDiscount = {
      id: "disc_eur",
      storeId,
      code: "EURO10",
      name: "Euro Special",
      type: "FIXED_AMOUNT" as const,
      value: 1000,
      currency: "EUR",
      status: "ACTIVE" as const,
    };

    const result = evaluateDiscountCode(eurDiscount, {
      targetStoreId: storeId,
      subtotal: 10000,
      currency: "USD",
    });

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe("CURRENCY_MISMATCH");
    expect(result.errorMessage).toContain("does not match cart currency");
  });
});

describe("Storefront Discount Integration: Multi-Tenant Store Isolation", () => {
  beforeEach(() => {
    clearStoreDiscounts();
  });

  it("strictly enforces store tenant boundary: store A discounts cannot be used in store B", async () => {
    const storeAId = "store_alpine_outfitters";
    const storeBId = "store_urban_threads";

    // Register exclusive promotion for Store A
    registerStoreDiscount({
      id: "disc_alpine_promo",
      storeId: storeAId,
      code: "ALPINEVIP",
      name: "Alpine VIP 25% Off",
      type: "PERCENTAGE",
      value: 25,
      currency: "USD",
      status: "ACTIVE",
    });

    // Attempt to redeem on Store A -> Must SUCCEED
    const discountForStoreA = await resolveStoreDiscount(mockDb, storeAId, "ALPINEVIP");
    expect(discountForStoreA).not.toBeNull();

    const resultStoreA = evaluateDiscountCode(discountForStoreA, {
      targetStoreId: storeAId,
      subtotal: 10000,
      currency: "USD",
    });
    expect(resultStoreA.isValid).toBe(true);
    expect(resultStoreA.discount?.amount).toBe(2500);

    // Attempt to resolve on Store B -> Must return null (not found for Store B)
    const discountForStoreB = await resolveStoreDiscount(mockDb, storeBId, "ALPINEVIP");
    expect(discountForStoreB).toBeNull();

    // Even if maliciously passing Store A's discount object with Store B's target context:
    const tamperedAttempt = evaluateDiscountCode(discountForStoreA, {
      targetStoreId: storeBId,
      subtotal: 10000,
      currency: "USD",
    });
    expect(tamperedAttempt.isValid).toBe(false);
    expect(tamperedAttempt.reason).toBe("DISCOUNT_NOT_FOUND");
    expect(tamperedAttempt.discount).toBeUndefined();
  });
});

describe("Storefront Discount Integration: Server-Authoritative Totals Recalculation", () => {
  it("enforces server authority: Cart domain sets discountTotal and adjusts grandTotal atomically", () => {
    const cart = Cart.reconstitute({
      id: "cart_disc_auth_1",
      storeId: "store_123",
      currency: "USD",
      status: "ACTIVE",
      subtotal: 10000, // $100.00
      discountTotal: 0,
      taxTotal: 800, // $8.00
      shippingTotal: 500, // $5.00
      grandTotal: 11300, // $113.00
      guestIdentifier: "guest_123",
      customerId: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [
        {
          id: "item_1",
          cartId: "cart_disc_auth_1",
          storeId: "store_123",
          variantId: "var_1",
          quantity: 1,
          unitPrice: 10000,
          lineSubtotal: 10000,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    // Apply authoritative 20% discount (2000 cents)
    const discountAmount = 2000;
    cart.setTotals({
      discountTotal: discountAmount,
      taxTotal: 800,
      shippingTotal: 500,
    });

    expect(cart.discountTotal).toBe(2000);
    // grandTotal = 10000 - 2000 + 800 + 500 = 9300 ($93.00)
    expect(cart.grandTotal).toBe(9300);
  });

  it("propagates cart discount into newly initialized checkout session", () => {
    const cart = Cart.reconstitute({
      id: "cart_disc_auth_2",
      storeId: "store_123",
      currency: "USD",
      status: "ACTIVE",
      subtotal: 10000,
      discountTotal: 1500, // $15.00 discount
      taxTotal: 800,
      shippingTotal: 0,
      grandTotal: 9300,
      guestIdentifier: "guest_456",
      customerId: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [
        {
          id: "item_2",
          cartId: "cart_disc_auth_2",
          storeId: "store_123",
          variantId: "var_2",
          quantity: 1,
          unitPrice: 10000,
          lineSubtotal: 10000,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    // Reconstitute checkout with matching cart discountTotal
    const checkout = Checkout.reconstitute({
      id: "chk_disc_auth_2",
      storeId: cart.storeId,
      cartId: cart.id,
      status: "OPEN",
      currency: cart.currency,
      subtotal: cart.subtotal,
      discountTotal: cart.discountTotal,
      taxTotal: cart.taxTotal,
      shippingTotal: cart.shippingTotal,
      total: Math.max(0, cart.subtotal - cart.discountTotal + cart.taxTotal + cart.shippingTotal),
      shippingAddress: null,
      billingAddress: null,
      email: null,
      customerId: null,
      paymentStatus: "PENDING",
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
    });

    expect(checkout.discountTotal).toBe(1500);
    expect(checkout.total).toBe(9300);
  });

  it("recalculates checkout totals correctly upon removing discount", () => {
    const checkout = Checkout.reconstitute({
      id: "chk_disc_auth_3",
      storeId: "store_123",
      cartId: "cart_3",
      status: "OPEN",
      currency: "USD",
      subtotal: 10000,
      discountTotal: 2000,
      taxTotal: 800,
      shippingTotal: 0,
      total: 8800,
      shippingAddress: null,
      billingAddress: null,
      email: null,
      customerId: null,
      paymentStatus: "PENDING",
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [
        new CheckoutItem({
          id: "chk_item_3",
          checkoutId: "chk_disc_auth_3",
          storeId: "store_123",
          variantId: "var_3",
          productNameSnapshot: "Camp Tent",
          variantNameSnapshot: "Default",
          unitPrice: 10000,
          quantity: 1,
        }),
      ],
    });

    // Remove discount
    checkout.setDiscountTotal(0);
    expect(checkout.discountTotal).toBe(0);
    expect(checkout.total).toBe(10800);
  });
});
