import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DiscountCodeForm } from "@/components/storefront/discounts/discount-code-form";
import { AppliedDiscounts } from "@/components/storefront/discounts/applied-discounts";
import { CartSummary } from "@/components/storefront/cart/cart-summary";
import { CartDrawer } from "@/components/storefront/cart/cart-drawer";
import { CheckoutSummary } from "@/components/storefront/checkout/checkout-summary";
import type { AppliedDiscountDTO } from "@/lib/storefront-discount-helpers";
import type { StorefrontCartDTO, StorefrontCartItemDTO } from "@/lib/storefront-cart-helpers";
import type { StorefrontCheckoutDTO } from "@/lib/storefront-checkout-helpers";

describe("Storefront UI: DiscountCodeForm Component", () => {
  it("renders accessible discount input and apply button", () => {
    const handleApply = vi.fn();
    const html = renderToStaticMarkup(
      <DiscountCodeForm onApply={handleApply} />,
    );

    expect(html).toContain('id="discount-code-input"');
    expect(html).toContain('placeholder="Discount code"');
    expect(html).toContain('data-testid="apply-discount-btn"');
    expect(html).toContain("Apply");
    expect(html).toContain("Discount code");
  });

  it("shows loading state and disables inputs during mutation lock", () => {
    const handleApply = vi.fn();
    const html = renderToStaticMarkup(
      <DiscountCodeForm onApply={handleApply} isLoading={true} />,
    );

    expect(html).toContain("disabled=\"\"");
    expect(html).toContain("Applying...");
    expect(html).toContain('aria-busy="true"');
  });

  it("renders validation and server error message when passed", () => {
    const handleApply = vi.fn();
    const html = renderToStaticMarkup(
      <DiscountCodeForm
        onApply={handleApply}
        error="Discount code EXPIRED10 has expired"
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Discount code EXPIRED10 has expired");
  });

  it("supports compact layout mode for drawers and checkout sidebars", () => {
    const handleApply = vi.fn();
    const html = renderToStaticMarkup(
      <DiscountCodeForm onApply={handleApply} compact={true} />,
    );

    expect(html).toContain("discount-code-form--compact");
  });
});

describe("Storefront UI: AppliedDiscounts Component", () => {
  const mockDiscount: AppliedDiscountDTO = {
    code: "WELCOME10",
    name: "10% Welcome Discount",
    type: "PERCENTAGE",
    amount: 1000,
    formattedAmount: "$10.00",
    description: "10% off your first order",
  };

  it("renders applied discount code, tag icon, and formatted deduction amount", () => {
    const html = renderToStaticMarkup(
      <AppliedDiscounts
        discount={mockDiscount}
        discountTotal={1000}
        currency="USD"
      />,
    );

    expect(html).toContain("WELCOME10");
    expect(html).toContain("-$10.00");
    expect(html).toContain("10% Welcome Discount");
    expect(html).toContain('data-testid="applied-discount-badge"');
  });

  it("renders remove button when onRemove handler is provided", () => {
    const handleRemove = vi.fn();
    const html = renderToStaticMarkup(
      <AppliedDiscounts
        discount={mockDiscount}
        discountTotal={1000}
        currency="USD"
        onRemove={handleRemove}
      />,
    );

    expect(html).toContain('data-testid="remove-discount-btn"');
    expect(html).toContain('aria-label="Remove discount code WELCOME10"');
    expect(html).toContain("✕");
  });

  it("shows loading spinner and disables remove button during removal mutation", () => {
    const handleRemove = vi.fn();
    const html = renderToStaticMarkup(
      <AppliedDiscounts
        discount={mockDiscount}
        discountTotal={1000}
        currency="USD"
        onRemove={handleRemove}
        isLoading={true}
      />,
    );

    expect(html).toContain("disabled=\"\"");
    expect(html).toContain("Loading...");
  });

  it("falls back to generic discount label when discount details are minimal", () => {
    const html = renderToStaticMarkup(
      <AppliedDiscounts
        discount={null}
        discountTotal={2000}
        currency="USD"
      />,
    );

    expect(html).toContain("DISCOUNT");
    expect(html).toContain("-$20.00");
  });
});

describe("Storefront UI: CartSummary Integration with Discounts", () => {
  const mockItem: StorefrontCartItemDTO = {
    id: "item_01",
    variantId: "var_01",
    unitPrice: 5000,
    quantity: 2,
    lineSubtotal: 10000,
    productTitle: "Waterproof Hiking Jacket",
    productSlug: "waterproof-hiking-jacket",
    variantTitle: "Large / Forest Green",
    sku: "JKT-LG-GRN",
    imageUrl: null,
    imageAlt: null,
  };

  const baseCart: StorefrontCartDTO = {
    id: "cart_test_1",
    storeId: "store_123",
    currency: "USD",
    subtotal: 10000,
    discountTotal: 0,
    taxTotal: 800,
    shippingTotal: 0,
    grandTotal: 10800,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    items: [mockItem],
  };

  it("renders discount form when no discount is applied", () => {
    const html = renderToStaticMarkup(
      <CartSummary
        cart={baseCart}
        storeSlug="alpine-outfitters"
        appliedDiscount={null}
        onApplyDiscount={vi.fn()}
      />,
    );

    expect(html).toContain('id="discount-code-input"');
    expect(html).toContain('data-testid="apply-discount-btn"');
    expect(html).not.toContain('data-testid="cart-discount"');
  });

  it("renders applied discount badge and server-authoritative negative deduction row", () => {
    const discountedCart: StorefrontCartDTO = {
      ...baseCart,
      discountTotal: 2000, // $20.00
      grandTotal: 8800, // $88.00 (100.00 - 20.00 + 8.00 tax)
    };

    const discountDTO: AppliedDiscountDTO = {
      code: "SAVE20",
      name: "$20 Off Order",
      type: "FIXED_AMOUNT",
      amount: 2000,
      formattedAmount: "$20.00",
      description: "$20 off orders over $50",
    };

    const html = renderToStaticMarkup(
      <CartSummary
        cart={discountedCart}
        storeSlug="alpine-outfitters"
        appliedDiscount={discountDTO}
        onRemoveDiscount={vi.fn()}
      />,
    );

    expect(html).toContain("SAVE20");
    expect(html).toContain('data-testid="cart-discount"');
    expect(html).toContain("-$20.00");
    expect(html).toContain('data-testid="cart-grand-total"');
    expect(html).toContain("$88.00");
  });
});

describe("Storefront UI: CartDrawer Integration with Discounts", () => {
  const mockItem: StorefrontCartItemDTO = {
    id: "item_01",
    variantId: "var_01",
    unitPrice: 5000,
    quantity: 1,
    lineSubtotal: 5000,
    productTitle: "Beanie",
    productSlug: "beanie",
    variantTitle: "Default",
    sku: null,
    imageUrl: null,
    imageAlt: null,
  };

  const cartWithDiscount: StorefrontCartDTO = {
    id: "cart_drawer_1",
    storeId: "store_123",
    currency: "USD",
    subtotal: 5000,
    discountTotal: 500,
    taxTotal: 400,
    shippingTotal: 0,
    grandTotal: 4900,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    items: [mockItem],
  };

  it("renders discount breakdown row in open drawer footer when discount exists", () => {
    const html = renderToStaticMarkup(
      <CartDrawer
        cart={cartWithDiscount}
        isOpen={true}
        onClose={vi.fn()}
        storeSlug="alpine-outfitters"
      />,
    );

    expect(html).toContain('data-testid="cart-drawer-discount"');
    expect(html).toContain("-$5.00");
    expect(html).toContain('data-testid="cart-drawer-subtotal"');
    expect(html).toContain("$50.00");
  });
});

describe("Storefront UI: CheckoutSummary Integration with Discounts", () => {
  const mockCheckout: StorefrontCheckoutDTO = {
    id: "chk_disc_1",
    storeId: "store_123",
    cartId: "cart_disc_1",
    status: "OPEN",
    email: "customer@example.com",
    shippingAddress: null,
    billingAddress: null,
    currency: "USD",
    subtotal: 10000,
    discountTotal: 1000,
    taxTotal: 720,
    shippingTotal: 500,
    total: 10220, // 100 - 10 + 7.20 + 5.00
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    items: [
      {
        id: "item_chk_1",
        productId: "prod_1",
        variantId: "var_1",
        quantity: 1,
        unitPrice: 10000,
        lineTotal: 10000,
        productNameSnapshot: "Pro Shell Jacket",
        variantNameSnapshot: "Default",
        skuSnapshot: "PRO-SH-01",
        imageUrl: null,
        imageAlt: null,
      },
    ],
  };

  it("renders authoritative discount row in checkout summary breakdown", () => {
    const discountDTO: AppliedDiscountDTO = {
      code: "WELCOME10",
      name: "10% Welcome Discount",
      type: "PERCENTAGE",
      amount: 1000,
      formattedAmount: "$10.00",
    };

    const html = renderToStaticMarkup(
      <CheckoutSummary
        checkout={mockCheckout}
        storeSlug="alpine-outfitters"
        appliedDiscount={discountDTO}
        onRemoveDiscount={vi.fn()}
      />,
    );

    expect(html).toContain('data-testid="checkout-discount"');
    expect(html).toContain("-$10.00");
    expect(html).toContain('data-testid="checkout-total"');
    expect(html).toContain("$102.20");
    expect(html).toContain('data-testid="applied-discount-badge"');
  });

  it("renders discount code form in checkout when no discount is applied yet", () => {
    const checkoutWithoutDiscount: StorefrontCheckoutDTO = {
      ...mockCheckout,
      discountTotal: 0,
      total: 11220,
    };

    const handleApply = vi.fn();
    const html = renderToStaticMarkup(
      <CheckoutSummary
        checkout={checkoutWithoutDiscount}
        storeSlug="alpine-outfitters"
        onApplyDiscount={handleApply}
      />,
    );

    expect(html).toContain('id="discount-code-input"');
    expect(html).toContain('data-testid="apply-discount-btn"');
    expect(html).not.toContain('data-testid="checkout-discount"');
  });
});
