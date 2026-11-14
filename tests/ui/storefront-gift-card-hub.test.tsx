import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GiftCardPurchaseView } from "@/components/storefront/gift-cards/gift-card-purchase-view";
import { GiftCardRedeemView } from "@/components/storefront/gift-cards/gift-card-redeem-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/stores/test-store/gift-cards",
}));

vi.mock("../../apps/web/node_modules/next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/stores/test-store/gift-cards",
}));

vi.mock("@/context/cart-context", () => ({
  useCart: () => ({
    cart: null,
    refreshCart: vi.fn(),
  }),
}));

describe("Storefront Gift Cards Hub & Redemption UI", () => {
  const denominations = [
    { variantId: "v-500", title: "INR 500", amount: 50000, sku: "GC-50000" },
    { variantId: "v-1000", title: "INR 1,000", amount: 100000, sku: "GC-100000" },
  ];

  it("1. Renders Buy tab by default with denomination buttons and switch to redeem link", () => {
    const html = renderToStaticMarkup(
      <GiftCardPurchaseView
        storeSlug="test-store"
        storeName="Artisan Coffee"
        currency="INR"
        denominations={denominations}
      />,
    );

    expect(html).toContain("Buy Gift Card");
    expect(html).toContain("Redeem &amp; Check Balance");
    expect(html).toContain("1. Select Value");
    expect(html).toContain("Already received a gift card?");
    expect(html).toContain("Check balance or redeem here");
    expect(html).toContain("data-testid=\"buy-gift-card-button\"");
  });

  it("2. Renders Redeem tab when initialTab is set to redeem", () => {
    const html = renderToStaticMarkup(
      <GiftCardPurchaseView
        storeSlug="test-store"
        storeName="Artisan Coffee"
        currency="INR"
        denominations={denominations}
        initialTab="redeem"
      />,
    );

    expect(html).toContain("Redeem &amp; Check Balance");
    expect(html).toContain("Gift Card Code");
    expect(html).toContain("data-testid=\"redeem-code-input\"");
    expect(html).toContain("data-testid=\"check-balance-button\"");
    expect(html).toContain("Two Ways to Redeem");
    expect(html).toContain("Deposit to Store Credit");
    expect(html).toContain("Apply at Checkout");
  });

  it("3. GiftCardRedeemView renders check balance form and guidelines", () => {
    const html = renderToStaticMarkup(
      <GiftCardRedeemView
        storeSlug="test-store"
        storeName="Artisan Coffee"
        currency="INR"
      />,
    );

    expect(html).toContain("Redeem &amp; Check Balance");
    expect(html).toContain("e.g. GC-A7K2-9MNP-4R8X");
    expect(html).toContain("Check Balance");
    expect(html).toContain("GIFT VOUCHER PORTAL");
    expect(html).toContain("Two Ways to Redeem");
  });
});
