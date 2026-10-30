import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { formatStorePrice } from "@/components/storefront/products/product-card";
import { CartItems } from "@/components/storefront/cart/cart-items";
import { CartSummary } from "@/components/storefront/cart/cart-summary";
import { CartDrawer } from "@/components/storefront/cart/cart-drawer";
import { ProductDetailView } from "@/components/storefront/products/product-detail-view";
import { StorefrontShell } from "@/components/storefront/StorefrontShell";
import {
  CartProvider,
  useCart,
  type StorefrontCartDTO,
  type StorefrontCartItemDTO,
} from "@/context/cart-context";
import type { ProductDetailDTO } from "@calcart/products";

// Sample cart data
const mockCartItem1: StorefrontCartItemDTO = {
  id: "item_01",
  variantId: "var_01",
  unitPrice: 3500, // $35.00
  quantity: 2,
  lineSubtotal: 7000, // $70.00
  productTitle: "Trail Running Shoes",
  productSlug: "trail-running-shoes",
  variantTitle: "Size 10 / Blue",
  sku: "TRS-10-BLU",
  imageUrl: "https://cdn.example.com/shoes.jpg",
  imageAlt: "Trail running shoes side view",
};

const mockCartItem2: StorefrontCartItemDTO = {
  id: "item_02",
  variantId: "var_02",
  unitPrice: 1500, // $15.00
  quantity: 1,
  lineSubtotal: 1500, // $15.00
  productTitle: "Running Water Bottle",
  productSlug: "running-water-bottle",
  variantTitle: "Default Title",
  sku: null,
  imageUrl: null,
  imageAlt: null,
};

const mockCart: StorefrontCartDTO = {
  id: "cart_abc123",
  storeId: "store_alpine",
  currency: "USD",
  subtotal: 8500, // $85.00
  discountTotal: 1000, // $10.00
  taxTotal: 600, // $6.00
  shippingTotal: 500, // $5.00
  grandTotal: 8600, // $86.00
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  items: [mockCartItem1, mockCartItem2],
};

const sampleProduct: ProductDetailDTO = {
  id: "prod_001",
  storeId: "store_alpine",
  title: "All-Terrain Snowboard",
  slug: "all-terrain-snowboard",
  status: "ACTIVE",
  description: "High performance snowboard for all terrains.",
  variants: [
    {
      id: "var_156",
      productId: "prod_001",
      storeId: "store_alpine",
      title: "156 cm",
      sku: "AT-SNOW-156",
      price: 49900,
      compareAtPrice: 59900,
      costPrice: null,
      currency: "USD",
      status: "ACTIVE",
      position: 1,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
    {
      id: "var_160",
      productId: "prod_001",
      storeId: "store_alpine",
      title: "160 cm",
      sku: "AT-SNOW-160",
      price: 52900,
      compareAtPrice: null,
      costPrice: null,
      currency: "USD",
      status: "ACTIVE",
      position: 2,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  ],
  media: [
    {
      id: "med_01",
      productId: "prod_001",
      url: "https://cdn.example.com/snowboard.jpg",
      altText: "Snowboard view",
      position: 1,
      createdAt: "2026-01-01T00:00:00Z",
    },
  ],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("Storefront Cart: Monetary & Price Correctness", () => {
  it("formats minor units (cents) into localized currency strings", () => {
    expect(formatStorePrice(8500, "USD")).toBe("$85.00");
    expect(formatStorePrice(1000, "USD")).toBe("$10.00");
    expect(formatStorePrice(49999, "USD")).toBe("$499.99");
    expect(formatStorePrice(0, "USD")).toBe("$0.00");
  });

  it("handles null or undefined price without crashing", () => {
    expect(formatStorePrice(null)).toBe("—");
    expect(formatStorePrice(undefined)).toBe("—");
  });

  it("handles alternative currencies properly", () => {
    const eur = formatStorePrice(4500, "EUR");
    expect(eur).toContain("45.00");
    const gbp = formatStorePrice(3500, "GBP");
    expect(gbp).toContain("35.00");
  });
});

describe("Storefront Cart: CartItems Component", () => {
  it("renders cart item details including title, variant, unit price, quantity, and line total", () => {
    const html = renderToStaticMarkup(
      <CartItems
        items={mockCart.items}
        storeSlug="alpine-outfitters"
        currency="USD"
      />,
    );

    expect(html).toContain("Trail Running Shoes");
    expect(html).toContain("Size 10 / Blue");
    expect(html).toContain("SKU: TRS-10-BLU");
    expect(html).toContain("$35.00 each");
    expect(html).toContain("$70.00");
    expect(html).toContain('data-testid="qty-val-item_01"');
    expect(html).toContain(">2<");
  });

  it("hides Default Title variant badge for single default options", () => {
    const html = renderToStaticMarkup(
      <CartItems
        items={[mockCartItem2]}
        storeSlug="alpine-outfitters"
        currency="USD"
      />,
    );

    expect(html).toContain("Running Water Bottle");
    // Should NOT show "Default Title" badge in the UI
    expect(html).not.toContain("data-testid=\"cart-item-variant-item_02\"");
  });

  it("renders primary image thumbnail and fallback placeholder", () => {
    const html = renderToStaticMarkup(
      <CartItems
        items={mockCart.items}
        storeSlug="alpine-outfitters"
      />,
    );

    // Item 1 has image
    expect(html).toContain('<img src="https://cdn.example.com/shoes.jpg"');
    expect(html).toContain('alt="Trail running shoes side view"');

    // Item 2 has fallback
    expect(html).toContain('aria-label="No image available for Running Water Bottle"');
  });

  it("links items to store-scoped product detail page", () => {
    const html = renderToStaticMarkup(
      <CartItems
        items={[mockCartItem1]}
        storeSlug="alpine-outfitters"
      />,
    );

    expect(html).toContain(
      'href="/stores/alpine-outfitters/products/trail-running-shoes"',
    );
  });

  it("supports compact mode for cart drawer", () => {
    const html = renderToStaticMarkup(
      <CartItems
        items={mockCart.items}
        storeSlug="alpine-outfitters"
        compact={true}
      />,
    );

    expect(html).toContain("cart-items--compact");
    expect(html).toContain("cart-item-row--compact");
  });

  it("returns null when items array is empty", () => {
    const html = renderToStaticMarkup(
      <CartItems
        items={[]}
        storeSlug="alpine-outfitters"
      />,
    );

    expect(html).toBe("");
  });
});

describe("Storefront Cart: CartSummary Component", () => {
  it("renders server-authoritative subtotal, discounts, shipping, tax, and grand total", () => {
    const html = renderToStaticMarkup(
      <CartSummary
        cart={mockCart}
        storeSlug="alpine-outfitters"
        showCheckoutNotice={true}
      />,
    );

    expect(html).toContain("Order Summary");
    expect(html).toContain("$85.00"); // Subtotal
    expect(html).toContain("-$10.00"); // Discounts
    expect(html).toContain("$5.00"); // Shipping
    expect(html).toContain("$6.00"); // Tax
    expect(html).toContain("$86.00"); // Grand total
  });

  it("displays disabled checkout action with explanation notice", () => {
    const html = renderToStaticMarkup(
      <CartSummary
        cart={mockCart}
        storeSlug="alpine-outfitters"
        showCheckoutNotice={true}
      />,
    );

    expect(html).toContain("Checkout Unavailable");
    expect(html).toContain('disabled=""');
    expect(html).toContain(
      "Payment and checkout processing will be available in the next release.",
    );
  });

  it("includes store-scoped Continue Shopping link", () => {
    const html = renderToStaticMarkup(
      <CartSummary
        cart={mockCart}
        storeSlug="alpine-outfitters"
      />,
    );

    expect(html).toContain('href="/stores/alpine-outfitters/products"');
    expect(html).toContain("← Continue Shopping");
  });

  it("displays Clear Cart action when items are present", () => {
    const html = renderToStaticMarkup(
      <CartSummary
        cart={mockCart}
        storeSlug="alpine-outfitters"
      />,
    );

    expect(html).toContain('data-testid="clear-cart-btn"');
    expect(html).toContain("Clear Cart");
  });
});

describe("Storefront Cart: StorefrontShell Cart Indicator", () => {
  it("displays cart button with item count badge when items exist", () => {
    const html = renderToStaticMarkup(
      <StorefrontShell
        storeName="Alpine Outfitters"
        storeSlug="alpine-outfitters"
        cartItemCount={3}
      >
        <div>Page Content</div>
      </StorefrontShell>,
    );

    expect(html).toContain('data-testid="storefront-cart-button"');
    expect(html).toContain('aria-label="Shopping cart with 3 items"');
    expect(html).toContain('class="storefront-cart-count"');
    expect(html).toContain(">3<");
  });

  it("hides count badge when cart is empty (0 items)", () => {
    const html = renderToStaticMarkup(
      <StorefrontShell
        storeName="Alpine Outfitters"
        storeSlug="alpine-outfitters"
        cartItemCount={0}
      >
        <div>Page Content</div>
      </StorefrontShell>,
    );

    expect(html).toContain('aria-label="Shopping cart with 0 items"');
    expect(html).not.toContain('data-testid="storefront-cart-count"');
  });

  it("attaches accessible attributes to header banner and navigation", () => {
    const html = renderToStaticMarkup(
      <StorefrontShell
        storeName="Alpine Outfitters"
        storeSlug="alpine-outfitters"
      >
        <div>Content</div>
      </StorefrontShell>,
    );

    expect(html).toContain('role="banner"');
    expect(html).toContain('role="main"');
    expect(html).toContain('role="contentinfo"');
  });
});

describe("Storefront Cart: ProductDetailView Add-to-Cart Flow", () => {
  it("renders quantity selector and Add to Cart button for multi-variant product", () => {
    const html = renderToStaticMarkup(
      <ProductDetailView
        product={sampleProduct}
        storeSlug="alpine-outfitters"
        storeName="Alpine Outfitters"
      />,
    );

    // Quantity selector
    expect(html).toContain('data-testid="decrease-quantity-btn"');
    expect(html).toContain('data-testid="increase-quantity-btn"');
    expect(html).toContain('data-testid="quantity-input"');
    expect(html).toContain('value="1"');

    // Add to cart button
    expect(html).toContain('data-testid="add-to-cart-button"');
    expect(html).toContain("Add to Cart");

    // Variant selector
    expect(html).toContain('data-testid="variant-selector"');
    expect(html).toContain("156 cm");
    expect(html).toContain("160 cm");
  });

  it("renders Add to Cart for default single variant product", () => {
    const singleVariantProduct: ProductDetailDTO = {
      ...sampleProduct,
      variants: [
        {
          id: "var_single",
          productId: "prod_001",
          storeId: "store_alpine",
          title: "Default Title",
          sku: "SNOW-DEF",
          price: 39900,
          compareAtPrice: null,
          costPrice: null,
          currency: "USD",
          status: "ACTIVE",
          position: 1,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
    };

    const html = renderToStaticMarkup(
      <ProductDetailView
        product={singleVariantProduct}
        storeSlug="alpine-outfitters"
        storeName="Alpine Outfitters"
      />,
    );

    expect(html).toContain('data-testid="default-variant-badge"');
    expect(html).toContain("Standard option");
    expect(html).toContain('data-testid="add-to-cart-button"');
    expect(html).toContain("Add to Cart");
  });

  it("disables Add to Cart when all variants are inactive or out of stock", () => {
    const outOfStockProduct: ProductDetailDTO = {
      ...sampleProduct,
      variants: [],
    };

    const html = renderToStaticMarkup(
      <ProductDetailView
        product={outOfStockProduct}
        storeSlug="alpine-outfitters"
        storeName="Alpine Outfitters"
      />,
    );

    expect(html).toContain('disabled=""');
    expect(html).toContain("Out of Stock");
  });
});

describe("Storefront Cart: Store Isolation & Scope", () => {
  it("never generates cross-store navigation URLs", () => {
    const html = renderToStaticMarkup(
      <CartSummary
        cart={mockCart}
        storeSlug="nordic-gear"
      />,
    );

    expect(html).toContain("/stores/nordic-gear/products");
    expect(html).not.toContain("alpine-outfitters");
  });

  it("scopes cart items to active store slug", () => {
    const html = renderToStaticMarkup(
      <CartItems
        items={[mockCartItem1]}
        storeSlug="peak-sports"
      />,
    );

    expect(html).toContain("/stores/peak-sports/products/trail-running-shoes");
    expect(html).not.toContain("/stores/alpine-outfitters");
  });
});

describe("Storefront Cart: CartDrawer Component", () => {
  it("renders null when drawer is closed", () => {
    function DrawerTestWrapper() {
      return (
        <CartProvider storeSlug="alpine-outfitters">
          <CartDrawer storeSlug="alpine-outfitters" />
        </CartProvider>
      );
    }

    const html = renderToStaticMarkup(<DrawerTestWrapper />);
    expect(html).toBe("");
  });
});

describe("Storefront Cart: CartProvider Context", () => {
  it("initializes cart context with store slug and zero items", () => {
    function CartConsumer() {
      const { storeSlug, itemCount } = useCart();
      return (
        <div data-testid="cart-state">
          {storeSlug}: {itemCount} items
        </div>
      );
    }

    const html = renderToStaticMarkup(
      <CartProvider storeSlug="mountain-gear">
        <CartConsumer />
      </CartProvider>,
    );

    expect(html).toContain("mountain-gear: 0 items");
  });
});
