import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OrderConfirmation } from "@/components/storefront/orders/order-confirmation";
import type { OrderDTO } from "@shopify-clone/orders";

describe("Storefront Order Confirmation: OrderConfirmation Component", () => {
  const mockOrder: OrderDTO = {
    id: "ord_019488a0-abcd-7000-8000-000000000001",
    storeId: "store_alpine_123",
    orderNumber: "ORD-2026-1001",
    customerId: "cust_123",
    status: "OPEN",
    paymentStatus: "PAID",
    fulfillmentStatus: "UNFULFILLED",
    currency: "USD",
    subtotal: 9000,
    discountTotal: 1000,
    shippingTotal: 500,
    taxTotal: 400,
    total: 8900,
    grandTotal: 8900,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    items: [
      {
        id: "item_01",
        orderId: "ord_019488a0-abcd-7000-8000-000000000001",
        variantId: "var_01",
        productNameSnapshot: "Alpine Expedition Backpack",
        variantNameSnapshot: "45L / Forest Green",
        skuSnapshot: "ALP-BP-45L",
        quantity: 1,
        unitPrice: 9000,
        subtotal: 9000,
        taxTotal: 400,
        discountTotal: 1000,
        total: 8400,
      },
    ],
    addresses: [
      {
        id: "addr_01",
        orderId: "ord_019488a0-abcd-7000-8000-000000000001",
        storeId: "store_alpine_123",
        type: "SHIPPING",
        name: "Alex Morgan",
        addressLine1: "742 Evergreen Terrace",
        addressLine2: "Apt 2B",
        city: "Springfield",
        state: "OR",
        postalCode: "97477",
        country: "US",
        phone: "+15551234567",
      },
    ],
  };

  it("renders verified paid order with thank-you heading and order number", () => {
    const html = renderToStaticMarkup(
      <OrderConfirmation
        order={mockOrder}
        storeSlug="alpine-outfitters"
        storeName="Alpine Outfitters"
      />,
    );

    expect(html).toContain("Thank You for Your Order!");
    expect(html).toContain("Your payment has been verified.");
    expect(html).toContain("ORD-2026-1001");
    expect(html).toContain("PAID");
  });

  it("renders authoritative items snapshot with variant name, quantity, and price", () => {
    const html = renderToStaticMarkup(
      <OrderConfirmation
        order={mockOrder}
        storeSlug="alpine-outfitters"
        storeName="Alpine Outfitters"
      />,
    );

    expect(html).toContain("Alpine Expedition Backpack");
    expect(html).toContain("45L / Forest Green");
    expect(html).toContain("Qty: 1");
    expect(html).toContain("$90.00");
  });

  it("renders authoritative financial breakdown and total paid", () => {
    const html = renderToStaticMarkup(
      <OrderConfirmation
        order={mockOrder}
        storeSlug="alpine-outfitters"
        storeName="Alpine Outfitters"
      />,
    );

    expect(html).toContain("$90.00"); // Subtotal
    expect(html).toContain("-$10.00"); // Discount
    expect(html).toContain("$5.00"); // Shipping
    expect(html).toContain("$4.00"); // Tax
    expect(html).toContain("$89.00"); // Total Paid
  });

  it("renders customer shipping address with street, unit, city, and state", () => {
    const html = renderToStaticMarkup(
      <OrderConfirmation
        order={mockOrder}
        storeSlug="alpine-outfitters"
        storeName="Alpine Outfitters"
      />,
    );

    expect(html).toContain("Alex Morgan");
    expect(html).toContain("742 Evergreen Terrace");
    expect(html).toContain("Apt 2B");
    expect(html).toContain("Springfield, OR 97477");
    expect(html).toContain("US");
  });

  it("renders pending payment status notice when payment is pending or authorized", () => {
    const pendingOrder: OrderDTO = {
      ...mockOrder,
      paymentStatus: "PENDING",
    };

    const html = renderToStaticMarkup(
      <OrderConfirmation
        order={pendingOrder}
        storeSlug="alpine-outfitters"
        storeName="Alpine Outfitters"
      />,
    );

    expect(html).toContain("Order Received");
    expect(html).toContain("payment verification is in progress");
    expect(html).toContain("PENDING");
  });

  it("renders store-scoped continue shopping link preserving storeSlug", () => {
    const html = renderToStaticMarkup(
      <OrderConfirmation
        order={mockOrder}
        storeSlug="alpine-outfitters"
        storeName="Alpine Outfitters"
      />,
    );

    expect(html).toContain('href="/stores/alpine-outfitters/products"');
    expect(html).toContain("← Continue Shopping");
  });

  it("handles orders without shipping address gracefully", () => {
    const digitalOrder: OrderDTO = {
      ...mockOrder,
      addresses: [],
    };

    const html = renderToStaticMarkup(
      <OrderConfirmation
        order={digitalOrder}
        storeSlug="alpine-outfitters"
        storeName="Alpine Outfitters"
      />,
    );

    expect(html).toContain("ORD-2026-1001");
    expect(html).not.toContain("Shipping Address");
  });
});
