import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { OrderDTO } from "@shopify-clone/orders";
import {
  calculateOrderMetrics,
  canCancelOrderStatus,
  formatOrderDate,
  formatOrderPrice,
  getOrderFulfillmentBadgeConfig,
  getOrderPaymentBadgeConfig,
  getOrderRecipientName,
  getOrderStatusBadgeConfig,
  validateOrderCancellationInput,
  type OrderListFilters,
} from "../../apps/web/src/lib/merchant-order-helpers";
import {
  OrderFulfillmentBadge,
  OrderPaymentBadge,
  OrderStatusBadge,
} from "../../apps/web/src/components/merchant/orders/order-status-badge";
import { OrderListTable } from "../../apps/web/src/components/merchant/orders/order-list-table";
import { OrderCancelDialog } from "../../apps/web/src/components/merchant/orders/order-cancel-dialog";
import { OrderFulfillDialog } from "../../apps/web/src/components/merchant/orders/order-fulfill-dialog";
import { OrderDetailsView } from "../../apps/web/src/components/merchant/orders/order-details-view";
import { ApiClient, ApiClientError } from "../../apps/web/src/lib/api-client";

const mockOrder1: OrderDTO = {
  id: "order_111",
  storeId: "store_abc",
  orderNumber: "1001",
  customerId: "cust_1",
  checkoutId: "chk_1",
  paymentId: "pay_razor_1",
  status: "CONFIRMED",
  paymentStatus: "PAID",
  fulfillmentStatus: "UNFULFILLED",
  currency: "USD",
  subtotal: 10000,
  discountTotal: 1000,
  shippingTotal: 500,
  taxTotal: 800,
  total: 10300,
  grandTotal: 10300,
  cancelledAt: null,
  cancelReason: null,
  completedAt: null,
  createdAt: "2026-10-10T12:00:00Z",
  updatedAt: "2026-10-10T12:05:00Z",
  items: [
    {
      id: "item_1",
      orderId: "order_111",
      storeId: "store_abc",
      productId: "prod_1",
      variantId: "var_1",
      productNameSnapshot: "Classic Crewneck",
      variantNameSnapshot: "Heather Grey / L",
      skuSnapshot: "CC-GRY-L",
      quantity: 2,
      unitPrice: 5000,
      discountAmount: 1000,
      taxAmount: 800,
      lineTotal: 9800,
      createdAt: "2026-10-10T12:00:00Z",
      updatedAt: "2026-10-10T12:00:00Z",
    },
  ],
  addresses: [
    {
      id: "addr_1",
      orderId: "order_111",
      storeId: "store_abc",
      type: "SHIPPING",
      name: "Alice Johnson",
      addressLine1: "123 Market St",
      addressLine2: "Suite 400",
      city: "San Francisco",
      state: "CA",
      postalCode: "94105",
      country: "USA",
      phone: "+1-555-0199",
      createdAt: "2026-10-10T12:00:00Z",
      updatedAt: "2026-10-10T12:00:00Z",
    },
  ],
  statusHistory: [
    {
      id: "hist_1",
      orderId: "order_111",
      storeId: "store_abc",
      fromStatus: null,
      toStatus: "PENDING",
      reason: "Order created via checkout",
      actorType: "CUSTOMER",
      actorId: "cust_1",
      createdAt: "2026-10-10T12:00:00Z",
    },
    {
      id: "hist_2",
      orderId: "order_111",
      storeId: "store_abc",
      fromStatus: "PENDING",
      toStatus: "CONFIRMED",
      reason: "Payment verified via webhook",
      actorType: "SYSTEM",
      actorId: null,
      createdAt: "2026-10-10T12:05:00Z",
    },
  ],
};

const mockOrder2: OrderDTO = {
  id: "order_222",
  storeId: "store_abc",
  orderNumber: "1002",
  customerId: null,
  checkoutId: "chk_2",
  paymentId: null,
  status: "PENDING",
  paymentStatus: "PENDING",
  fulfillmentStatus: "UNFULFILLED",
  currency: "USD",
  subtotal: 4500,
  discountTotal: 0,
  shippingTotal: 0,
  taxTotal: 300,
  total: 4800,
  grandTotal: 4800,
  cancelledAt: null,
  cancelReason: null,
  completedAt: null,
  createdAt: "2026-10-11T14:30:00Z",
  updatedAt: "2026-10-11T14:30:00Z",
  items: [],
  addresses: [],
  statusHistory: [],
};

const mockCancelledOrder: OrderDTO = {
  id: "order_333",
  storeId: "store_abc",
  orderNumber: "1003",
  customerId: "cust_2",
  checkoutId: "chk_3",
  paymentId: "pay_3",
  status: "CANCELLED",
  paymentStatus: "REFUNDED",
  fulfillmentStatus: "CANCELLED",
  currency: "USD",
  subtotal: 6000,
  discountTotal: 0,
  shippingTotal: 0,
  taxTotal: 0,
  total: 6000,
  grandTotal: 6000,
  cancelledAt: "2026-10-12T09:00:00Z",
  cancelReason: "Customer requested cancellation via support",
  completedAt: null,
  createdAt: "2026-10-11T18:00:00Z",
  updatedAt: "2026-10-12T09:00:00Z",
};

describe("Merchant Orders Management (Milestone C2)", () => {
  describe("merchant-order-helpers", () => {
    it("formats monetary cents into currency strings", () => {
      expect(formatOrderPrice(10300, "USD")).toBe("$103.00");
      expect(formatOrderPrice(0, "USD")).toBe("$0.00");
      expect(formatOrderPrice(null, "USD")).toBe("—");
      expect(formatOrderPrice(undefined, "USD")).toBe("—");
    });

    it("formats order dates safely", () => {
      const formatted = formatOrderDate("2026-10-10T12:00:00Z");
      expect(formatted).toContain("2026");
      expect(formatOrderDate(null)).toBe("—");
      expect(formatOrderDate("invalid-date")).toBe("—");
    });

    it("extracts recipient name correctly", () => {
      expect(getOrderRecipientName(mockOrder1)).toBe("Alice Johnson");
      expect(getOrderRecipientName(mockOrder2)).toBe("Guest Customer");
    });

    it("calculates accurate KPI summary metrics", () => {
      const metrics = calculateOrderMetrics([mockOrder1, mockOrder2, mockCancelledOrder]);
      expect(metrics.totalOrders).toBe(3);
      // Cancelled orders are excluded from net revenue: 10300 + 4800 = 15100 cents
      expect(metrics.totalRevenue).toBe(15100);
      expect(metrics.pendingCount).toBe(1);
      expect(metrics.paidCount).toBe(1);
    });

    it("validates order cancellation input", () => {
      expect(validateOrderCancellationInput("")).toBe("Cancellation reason is required.");
      expect(validateOrderCancellationInput("   ")).toBe("Cancellation reason is required.");
      expect(validateOrderCancellationInput("a".repeat(501))).toBe(
        "Cancellation reason cannot exceed 500 characters.",
      );
      expect(validateOrderCancellationInput("Customer requested cancellation")).toBeNull();
    });

    it("evaluates canCancelOrderStatus according to backend rules", () => {
      expect(canCancelOrderStatus("PENDING")).toBe(true);
      expect(canCancelOrderStatus("CONFIRMED")).toBe(true);
      expect(canCancelOrderStatus("PROCESSING")).toBe(true);
      expect(canCancelOrderStatus("SHIPPED")).toBe(false);
      expect(canCancelOrderStatus("DELIVERED")).toBe(false);
      expect(canCancelOrderStatus("COMPLETED")).toBe(false);
      expect(canCancelOrderStatus("CANCELLED")).toBe(false);
    });

    it("provides badge configs for all state domains", () => {
      expect(getOrderStatusBadgeConfig("CONFIRMED").variant).toBe("info");
      expect(getOrderStatusBadgeConfig("CANCELLED").variant).toBe("danger");
      expect(getOrderPaymentBadgeConfig("PAID").variant).toBe("success");
      expect(getOrderPaymentBadgeConfig("FAILED").variant).toBe("danger");
      expect(getOrderFulfillmentBadgeConfig("UNFULFILLED").variant).toBe("warning");
      expect(getOrderFulfillmentBadgeConfig("FULFILLED").variant).toBe("success");
    });
  });

  describe("OrderStatusBadge Components", () => {
    it("renders OrderStatusBadge with expected markup", () => {
      const html = renderToStaticMarkup(<OrderStatusBadge status="CONFIRMED" />);
      expect(html).toContain("Confirmed");

      const cancelledHtml = renderToStaticMarkup(<OrderStatusBadge status="CANCELLED" />);
      expect(cancelledHtml).toContain("Cancelled");
    });

    it("renders OrderPaymentBadge and OrderFulfillmentBadge", () => {
      const payHtml = renderToStaticMarkup(<OrderPaymentBadge status="PAID" />);
      expect(payHtml).toContain("Paid");

      const fulHtml = renderToStaticMarkup(<OrderFulfillmentBadge status="UNFULFILLED" />);
      expect(fulHtml).toContain("Unfulfilled");
    });
  });

  describe("OrderListTable Component", () => {
    const defaultFilters: OrderListFilters = {
      orderNumber: "",
      status: "ALL",
      paymentStatus: "ALL",
      fulfillmentStatus: "ALL",
    };

    it("renders order list with columns, KPI cards, and rows", () => {
      const html = renderToStaticMarkup(
        <OrderListTable
          orders={[mockOrder1, mockOrder2]}
          hasMore={false}
          filters={defaultFilters}
          isLoading={false}
          canManage={true}
          userRole="owner"
          onFilterChange={vi.fn()}
          onResetFilters={vi.fn()}
          onCancelOrder={vi.fn()}
        />,
      );

      // KPI cards
      expect(html).toContain("Total Orders");
      expect(html).toContain("Net Revenue");
      // Order numbers
      expect(html).toContain("#1001");
      expect(html).toContain("#1002");
      // Recipient
      expect(html).toContain("Alice Johnson");
      // Price
      expect(html).toContain("$103.00");
      expect(html).toContain("$48.00");
      // Details link
      expect(html).toContain("/merchant/orders/order_111");
    });

    it("renders empty state when order collection is empty", () => {
      const html = renderToStaticMarkup(
        <OrderListTable
          orders={[]}
          hasMore={false}
          filters={defaultFilters}
          isLoading={false}
          canManage={true}
          userRole="owner"
          onFilterChange={vi.fn()}
          onResetFilters={vi.fn()}
          onCancelOrder={vi.fn()}
        />,
      );

      expect(html).toContain("No Orders Found");
    });

    it("renders pagination controls when hasMore is true", () => {
      const html = renderToStaticMarkup(
        <OrderListTable
          orders={[mockOrder1]}
          hasMore={true}
          filters={defaultFilters}
          isLoading={false}
          canManage={true}
          userRole="owner"
          onFilterChange={vi.fn()}
          onNextPage={vi.fn()}
          onResetFilters={vi.fn()}
          onCancelOrder={vi.fn()}
        />,
      );

      expect(html).toContain("Load More Orders");
    });

    it("disables cancellation trigger for staff users", () => {
      const html = renderToStaticMarkup(
        <OrderListTable
          orders={[mockOrder1]}
          hasMore={false}
          filters={defaultFilters}
          isLoading={false}
          canManage={true}
          userRole="staff"
          onFilterChange={vi.fn()}
          onResetFilters={vi.fn()}
          onCancelOrder={vi.fn()}
        />,
      );

      expect(html).toContain("Requires Admin or Owner role");
      expect(html).toContain("disabled");
    });
  });

  describe("OrderDetailsView Component", () => {
    it("renders order details, items, addresses, and financials", () => {
      const html = renderToStaticMarkup(
        <OrderDetailsView
          order={mockOrder1}
          userRole="owner"
          onOpenCancel={vi.fn()}
        />,
      );

      expect(html).toContain("Order #1001");
      expect(html).toContain("Classic Crewneck");
      expect(html).toContain("Heather Grey / L");
      expect(html).toContain("CC-GRY-L");
      expect(html).toContain("Alice Johnson");
      expect(html).toContain("123 Market St");
      expect(html).toContain("Grand Total");
      expect(html).toContain("$103.00");
      expect(html).toContain("pay_razor_1");
      expect(html).toContain("Order Lifecycle &amp; Audit Timeline");
      expect(html).toContain("Payment verified via webhook");
    });

    it("renders cancelled alert banner when order is cancelled", () => {
      const html = renderToStaticMarkup(
        <OrderDetailsView
          order={mockCancelledOrder}
          userRole="owner"
          onOpenCancel={vi.fn()}
        />,
      );

      expect(html).toContain("Order Cancelled");
      expect(html).toContain("Customer requested cancellation via support");
    });

    it("renders fulfillment pipeline status and action button when eligible", () => {
      const onOpenFulfill = vi.fn();
      const html = renderToStaticMarkup(
        <OrderDetailsView
          order={mockOrder1}
          userRole="owner"
          onOpenCancel={vi.fn()}
          onOpenFulfill={onOpenFulfill}
        />,
      );

      expect(html).toContain("Fulfillment Pipeline");
      expect(html).toContain("Fulfill Order");
      expect(html).toContain("Fulfill Items Now");
    });
  });

  describe("OrderFulfillDialog Component", () => {
    it("renders fulfillment form with carrier, tracking, and notes inputs", () => {
      const html = renderToStaticMarkup(
        <OrderFulfillDialog
          storeId="store_abc"
          order={mockOrder1}
          isOpen={true}
          userRole="owner"
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
      );

      expect(html).toContain("Fulfill Order #1001");
      expect(html).toContain("Shipping Carrier / Partner");
      expect(html).toContain("Tracking Number / Waybill ID");
      expect(html).toContain("Confirm Fulfillment");
      expect(html).toContain("Alice Johnson");
    });
  });

  describe("OrderCancelDialog Component", () => {
    it("renders dialog when open with consequence alerts and reason input", () => {
      const html = renderToStaticMarkup(
        <OrderCancelDialog
          storeId="store_abc"
          order={mockOrder1}
          isOpen={true}
          userRole="owner"
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
      );

      expect(html).toContain("Cancel Order #1001");
      expect(html).toContain("Irreversible Order Action");
      expect(html).toContain("Release all reserved product inventory");
      expect(html).toContain("Cancellation Reason");
    });

    it("renders permission warning when user is a staff member", () => {
      const html = renderToStaticMarkup(
        <OrderCancelDialog
          storeId="store_abc"
          order={mockOrder1}
          isOpen={true}
          userRole="staff"
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
      );

      expect(html).toContain("Permission Required");
      expect(html).toContain("Staff role");
    });

    it("returns null when dialog is closed", () => {
      const html = renderToStaticMarkup(
        <OrderCancelDialog
          storeId="store_abc"
          order={mockOrder1}
          isOpen={false}
          userRole="owner"
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
      );

      expect(html).toBe("");
    });
  });

  describe("API Client & Order Cancellation Workflow", () => {
    it("handles successful order cancellation via API client", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: {
            ...mockOrder1,
            status: "CANCELLED",
            cancelReason: "Out of stock",
            cancelledAt: "2026-10-13T10:00:00Z",
          },
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      try {
        const client = new ApiClient("http://localhost:3000");

        const cancelled = await client.post<OrderDTO>(
          `/api/v1/stores/store_abc/orders/${mockOrder1.id}/cancel`,
          { reason: "Out of stock" },
        );

        expect(cancelled.status).toBe("CANCELLED");
        expect(cancelled.cancelReason).toBe("Out of stock");
        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/v1/stores/store_abc/orders/order_111/cancel",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ reason: "Out of stock" }),
          }),
        );
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("propagates 403 Forbidden error for unauthorized cancellation", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Operation requires at least admin role in this store",
          },
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      try {
        const client = new ApiClient("http://localhost:3000");

        await expect(
          client.post(`/api/v1/stores/store_abc/orders/order_111/cancel`, {
            reason: "Unauthorized attempt",
          }),
        ).rejects.toThrow(ApiClientError);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("propagates 400 ORDER_IMMUTABLE on duplicate cancellation attempts", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: false,
          error: {
            code: "ORDER_IMMUTABLE",
            message: "Order is in terminal status 'CANCELLED' and cannot transition to 'CANCELLED'",
          },
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      try {
        const client = new ApiClient("http://localhost:3000");

        await client.post(`/api/v1/stores/store_abc/orders/order_333/cancel`, {
          reason: "Duplicate cancel attempt",
        });
        expect.unreachable("Should have thrown ApiClientError");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiClientError);
        expect((err as ApiClientError).status).toBe(400);
        expect((err as ApiClientError).code).toBe("ORDER_IMMUTABLE");
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("queries orders with filtering parameters correctly", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: {
            items: [mockOrder1],
            hasMore: false,
          },
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      try {
        const client = new ApiClient("http://localhost:3000");

        const queryParams = new URLSearchParams({
          status: "CONFIRMED",
          paymentStatus: "PAID",
          limit: "50",
        });

        const res = await client.get<{ items: OrderDTO[]; hasMore: boolean }>(
          `/api/v1/stores/store_abc/orders?${queryParams.toString()}`,
        );

        expect(res.items).toHaveLength(1);
        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/v1/stores/store_abc/orders?status=CONFIRMED&paymentStatus=PAID&limit=50",
          expect.objectContaining({ method: "GET" }),
        );
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });
});
