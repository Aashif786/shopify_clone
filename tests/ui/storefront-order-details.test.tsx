import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OrderDetailView } from "@/components/storefront/orders/order-details-view";
import type { OrderDTO } from "@shopify-clone/orders";

describe("Storefront Order Details: OrderDetailView Component", () => {
  const mockOrder: OrderDTO = {
    id: "01a1828f-262d-7000-8684-b7a4a365e2b1",
    storeId: "store_souled_123",
    orderNumber: "ORD-MVS4367I-1998",
    customerId: "cust_123",
    status: "CONFIRMED",
    paymentStatus: "PAID",
    fulfillmentStatus: "UNFULFILLED",
    currency: "INR",
    subtotal: 99900,
    discountTotal: 10000,
    discountCode: "FESTIVE10",
    shippingTotal: 0,
    taxTotal: 4995,
    total: 94895,
    grandTotal: 94895,
    createdAt: "2026-10-28T12:49:39.249Z",
    updatedAt: "2026-10-28T12:49:39.249Z",
    items: [
      {
        id: "item_01",
        orderId: "01a1828f-262d-7000-8684-b7a4a365e2b1",
        storeId: "store_souled_123",
        variantId: "var_01",
        productNameSnapshot: "Oversized Streetwear Tee",
        variantNameSnapshot: "L / Acid Wash Grey",
        skuSnapshot: "TEE-OVR-L-GRY",
        quantity: 1,
        unitPrice: 99900,
        discountAmount: 10000,
        taxAmount: 4995,
        lineTotal: 89900,
        createdAt: "2026-10-28T12:49:39.249Z",
        updatedAt: "2026-10-28T12:49:39.249Z",
      },
    ],
    addresses: [
      {
        id: "addr_01",
        orderId: "01a1828f-262d-7000-8684-b7a4a365e2b1",
        storeId: "store_souled_123",
        type: "SHIPPING",
        name: "Rahul Sharma",
        addressLine1: "Flat 402, Lotus Residency",
        addressLine2: "Bandra West",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400050",
        country: "India",
        phone: "+919876543210",
        createdAt: "2026-10-28T12:49:39.249Z",
        updatedAt: "2026-10-28T12:49:39.249Z",
      },
    ],
    statusHistory: [
      {
        id: "hist_01",
        orderId: "01a1828f-262d-7000-8684-b7a4a365e2b1",
        storeId: "store_souled_123",
        fromStatus: null,
        toStatus: "CONFIRMED",
        reason: "Order confirmed upon payment authorization",
        actorType: "SYSTEM",
        actorId: null,
        createdAt: "2026-10-28T12:49:40.000Z",
      },
    ],
  };

  it("renders order header with order number, date, and status badges", () => {
    const html = renderToStaticMarkup(
      <OrderDetailView
        order={mockOrder}
        storeSlug="souled-store"
      />,
    );

    expect(html).toContain("ORD-MVS4367I-1998");
    expect(html).toContain("Payment: PAID");
    expect(html).toContain("Fulfillment: UNFULFILLED");
    expect(html).toContain("CONFIRMED");
    expect(html).toContain("Order History");
  });

  it("renders purchased items with snapshot title, variant, SKU, and unit price", () => {
    const html = renderToStaticMarkup(
      <OrderDetailView
        order={mockOrder}
        storeSlug="souled-store"
      />,
    );

    expect(html).toContain("Oversized Streetwear Tee");
    expect(html).toContain("L / Acid Wash Grey");
    expect(html).toContain("SKU: TEE-OVR-L-GRY");
    expect(html).toContain("Qty:");
  });

  it("renders shipping address details accurately", () => {
    const html = renderToStaticMarkup(
      <OrderDetailView
        order={mockOrder}
        storeSlug="souled-store"
      />,
    );

    expect(html).toContain("Rahul Sharma");
    expect(html).toContain("Flat 402, Lotus Residency");
    expect(html).toContain("Bandra West");
    expect(html).toContain("Mumbai, Maharashtra 400050");
    expect(html).toContain("India");
    expect(html).toContain("+919876543210");
  });

  it("renders financial summary with subtotal, discount code, taxes, and total", () => {
    const html = renderToStaticMarkup(
      <OrderDetailView
        order={mockOrder}
        storeSlug="souled-store"
      />,
    );

    expect(html).toContain("Payment Breakdown");
    expect(html).toContain("Subtotal");
    expect(html).toContain("FESTIVE10");
    expect(html).toContain("Shipping");
    expect(html).toContain("Taxes");
    expect(html).toContain("Total");
  });

  it("renders fulfillment progress stepper and activity log", () => {
    const html = renderToStaticMarkup(
      <OrderDetailView
        order={mockOrder}
        storeSlug="souled-store"
      />,
    );

    expect(html).toContain("Fulfillment Progress");
    expect(html).toContain("1. Placed");
    expect(html).toContain("2. Payment");
    expect(html).toContain("3. Fulfillment");
    expect(html).toContain("4. Complete");
    expect(html).toContain("Activity &amp; Tracking Log");
    expect(html).toContain("Order confirmed upon payment authorization");
  });
});
