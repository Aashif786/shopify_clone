import { describe, expect, it } from "vitest";
import { generateUuidV7 } from "@shopify-clone/db";
import {
  Order,
  OrderAddress,
  type OrderProps,
  validateOrderCurrency,
} from "../../modules/orders/src/domain/order.js";
import {
  OrderItem,
  validateOrderItemQuantity,
  validateOrderMonetaryAmount,
} from "../../modules/orders/src/domain/order-item.js";
import {
  assertValidOrderStatusTransition,
  canCancelOrderStatus,
  isTerminalOrderStatus,
  isValidOrderStatus,
  isValidOrderStatusTransition,
} from "../../modules/orders/src/domain/order-state.js";
import {
  InvalidCurrencyError,
  InvalidMonetaryAmountError,
  InvalidOrderAddressError,
  InvalidOrderItemError,
  InvalidOrderStateError,
  InvalidOrderStatusTransitionError,
  InvalidQuantityError,
  OrderCancellationError,
  OrderImmutableError,
  OrderTotalsMismatchError,
  UnauthorizedPaymentStatusChangeError,
} from "../../modules/orders/src/domain/order-errors.js";

describe("Order Domain Model", () => {
  const storeId = generateUuidV7();
  const customerId = generateUuidV7();
  const checkoutId = generateUuidV7();

  describe("Monetary and Currency Invariants", () => {
    it("validates valid 3-letter currency codes", () => {
      expect(validateOrderCurrency("USD")).toBe("USD");
      expect(validateOrderCurrency("INR")).toBe("INR");
      expect(validateOrderCurrency("EUR")).toBe("EUR");
    });

    it("rejects invalid currencies", () => {
      expect(() => validateOrderCurrency("usd")).toThrow(InvalidCurrencyError);
      expect(() => validateOrderCurrency("US")).toThrow(InvalidCurrencyError);
      expect(() => validateOrderCurrency("USDT")).toThrow(InvalidCurrencyError);
      expect(() => validateOrderCurrency(123)).toThrow(InvalidCurrencyError);
    });

    it("validates positive and zero integer monetary amounts in minor units", () => {
      expect(validateOrderMonetaryAmount(0, "Amount", true)).toBe(0);
      expect(validateOrderMonetaryAmount(1000, "Amount", true)).toBe(1000);
      expect(validateOrderMonetaryAmount(1_000_000_000_000, "Amount", true)).toBe(
        1_000_000_000_000,
      );
    });

    it("rejects invalid monetary amounts", () => {
      expect(() => validateOrderMonetaryAmount(-1, "Amount", true)).toThrow(
        InvalidMonetaryAmountError,
      );
      expect(() => validateOrderMonetaryAmount(12.34, "Amount", true)).toThrow(
        InvalidMonetaryAmountError,
      );
      expect(() => validateOrderMonetaryAmount(NaN, "Amount", true)).toThrow(
        InvalidMonetaryAmountError,
      );
      expect(() => validateOrderMonetaryAmount(Infinity, "Amount", true)).toThrow(
        InvalidMonetaryAmountError,
      );
      expect(() =>
        validateOrderMonetaryAmount(1_000_000_000_001, "Amount", true),
      ).toThrow(InvalidMonetaryAmountError);
    });

    it("validates item quantities correctly", () => {
      expect(validateOrderItemQuantity(1)).toBe(1);
      expect(validateOrderItemQuantity(100)).toBe(100);
      expect(() => validateOrderItemQuantity(0)).toThrow(InvalidQuantityError);
      expect(() => validateOrderItemQuantity(-5)).toThrow(InvalidQuantityError);
      expect(() => validateOrderItemQuantity(1.5)).toThrow(InvalidQuantityError);
      expect(() => validateOrderItemQuantity(100_000)).toThrow(InvalidQuantityError);
    });
  });

  describe("OrderItem Model & Snapshots", () => {
    it("creates an order item with valid snapshot and calculated line totals", () => {
      const orderId = generateUuidV7();
      const item = new OrderItem({
        orderId,
        storeId,
        productId: generateUuidV7(),
        variantId: generateUuidV7(),
        productNameSnapshot: "Silk Shirt",
        variantNameSnapshot: "Size M / Blue",
        skuSnapshot: "SHIRT-M-BLU",
        quantity: 2,
        unitPrice: 1500,
        discountAmount: 200,
        taxAmount: 100,
      });

      expect(item.productNameSnapshot).toBe("Silk Shirt");
      expect(item.variantNameSnapshot).toBe("Size M / Blue");
      expect(item.skuSnapshot).toBe("SHIRT-M-BLU");
      expect(item.quantity).toBe(2);
      expect(item.unitPrice).toBe(1500);
      expect(item.discountAmount).toBe(200);
      expect(item.taxAmount).toBe(100);
      // (2 * 1500) - 200 + 100 = 2900
      expect(item.lineTotal).toBe(2900);
    });

    it("rejects item if snapshot strings are missing or empty", () => {
      const orderId = generateUuidV7();
      expect(
        () =>
          new OrderItem({
            orderId,
            storeId,
            productNameSnapshot: "",
            variantNameSnapshot: "Variant",
            quantity: 1,
            unitPrice: 100,
          }),
      ).toThrow(InvalidOrderItemError);

      expect(
        () =>
          new OrderItem({
            orderId,
            storeId,
            productNameSnapshot: "Product",
            variantNameSnapshot: "   ",
            quantity: 1,
            unitPrice: 100,
          }),
      ).toThrow(InvalidOrderItemError);
    });

    it("rejects item if discount exceeds base price", () => {
      const orderId = generateUuidV7();
      expect(
        () =>
          new OrderItem({
            orderId,
            storeId,
            productNameSnapshot: "Product",
            variantNameSnapshot: "Variant",
            quantity: 1,
            unitPrice: 1000,
            discountAmount: 1500,
          }),
      ).toThrow(InvalidMonetaryAmountError);
    });

    it("rejects item if supplied lineTotal does not match calculated total", () => {
      const orderId = generateUuidV7();
      expect(
        () =>
          new OrderItem({
            orderId,
            storeId,
            productNameSnapshot: "Product",
            variantNameSnapshot: "Variant",
            quantity: 2,
            unitPrice: 1000,
            lineTotal: 9999, // Should be 2000
          }),
      ).toThrow(InvalidMonetaryAmountError);
    });
  });

  describe("OrderAddress Model", () => {
    it("creates valid billing and shipping addresses", () => {
      const orderId = generateUuidV7();
      const addr = new OrderAddress({
        orderId,
        storeId,
        type: "SHIPPING",
        name: "Jane Doe",
        addressLine1: "123 Main St",
        addressLine2: "Suite 4B",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "USA",
        phone: "+1234567890",
      });

      expect(addr.type).toBe("SHIPPING");
      expect(addr.name).toBe("Jane Doe");
      expect(addr.city).toBe("New York");
    });

    it("rejects address with missing required fields", () => {
      const orderId = generateUuidV7();
      expect(
        () =>
          new OrderAddress({
            orderId,
            storeId,
            type: "BILLING",
            name: "",
            addressLine1: "Line 1",
            city: "City",
            postalCode: "12345",
            country: "USA",
          }),
      ).toThrow(InvalidOrderAddressError);
    });
  });

  describe("Order Aggregate Model & Lifecycle Invariants", () => {
    it("validates status and transition helpers", () => {
      expect(isValidOrderStatus("PENDING")).toBe(true);
      expect(isValidOrderStatus("INVALID")).toBe(false);
      expect(isValidOrderStatusTransition("PENDING", "CONFIRMED")).toBe(true);
      expect(isValidOrderStatusTransition("PENDING", "DELIVERED")).toBe(false);
      expect(isTerminalOrderStatus("CANCELLED")).toBe(true);
      expect(isTerminalOrderStatus("COMPLETED")).toBe(true);
      expect(isTerminalOrderStatus("PROCESSING")).toBe(false);
      expect(canCancelOrderStatus("PENDING")).toBe(true);
      expect(canCancelOrderStatus("SHIPPED")).toBe(false);
      expect(() => assertValidOrderStatusTransition("PENDING", "SHIPPED")).toThrow(
        InvalidOrderStatusTransitionError,
      );
    });

    it("rejects order with missing storeId or orderNumber", () => {
      expect(
        () =>
          new Order({
            storeId: "",
            orderNumber: "ORD-1",
            currency: "USD",
            subtotal: 0,
          }),
      ).toThrow(InvalidOrderStateError);

      expect(
        () =>
          new Order({
            storeId,
            orderNumber: "",
            currency: "USD",
            subtotal: 0,
          }),
      ).toThrow(InvalidOrderStateError);
    });

    function createTestOrder(overrides?: Partial<OrderProps>) {
      const orderId = generateUuidV7();
      const item = new OrderItem({
        orderId,
        storeId,
        productNameSnapshot: "Test Product",
        variantNameSnapshot: "Default Variant",
        quantity: 1,
        unitPrice: 5000,
      });

      return new Order({
        id: orderId,
        storeId,
        orderNumber: "ORD-TEST-001",
        customerId,
        checkoutId,
        currency: "USD",
        subtotal: 5000,
        discountTotal: 500,
        shippingTotal: 200,
        taxTotal: 300,
        total: 5000, // 5000 - 500 + 200 + 300 = 5000
        grandTotal: 5000,
        items: [item],
        ...overrides,
      });
    }

    it("creates order and verifies totals invariant", () => {
      const order = createTestOrder();
      expect(order.status).toBe("PENDING");
      expect(order.paymentStatus).toBe("PENDING");
      expect(order.fulfillmentStatus).toBe("UNFULFILLED");
      expect(order.subtotal).toBe(5000);
      expect(order.discountTotal).toBe(500);
      expect(order.shippingTotal).toBe(200);
      expect(order.taxTotal).toBe(300);
      expect(order.total).toBe(5000);
      expect(order.grandTotal).toBe(5000);
    });

    it("rejects inconsistent order total or grand total", () => {
      expect(
        () =>
          createTestOrder({
            total: 9999, // Inconsistent with 5000 - 500 + 200 + 300 = 5000
          }),
      ).toThrow(OrderTotalsMismatchError);

      expect(
        () =>
          createTestOrder({
            grandTotal: 6000, // Grand total must match total
          }),
      ).toThrow(OrderTotalsMismatchError);
    });

    it("rejects order if items subtotal does not match order subtotal", () => {
      const orderId = generateUuidV7();
      const item = new OrderItem({
        orderId,
        storeId,
        productNameSnapshot: "Product",
        variantNameSnapshot: "Variant",
        quantity: 1,
        unitPrice: 2000,
      });

      expect(
        () =>
          new Order({
            id: orderId,
            storeId,
            orderNumber: "ORD-MISMATCH",
            currency: "USD",
            subtotal: 5000, // item is only 2000!
            total: 5000,
            items: [item],
          }),
      ).toThrow(OrderTotalsMismatchError);
    });

    it("enforces valid status transitions: PENDING -> CONFIRMED -> PROCESSING -> SHIPPED -> DELIVERED -> COMPLETED", () => {
      const order = createTestOrder();
      expect(order.status).toBe("PENDING");

      order.confirm();
      expect(order.status).toBe("CONFIRMED");

      order.startProcessing();
      expect(order.status).toBe("PROCESSING");

      order.markShipped();
      expect(order.status).toBe("SHIPPED");
      expect(order.fulfillmentStatus).toBe("FULFILLED");

      order.markDelivered();
      expect(order.status).toBe("DELIVERED");

      order.complete();
      expect(order.status).toBe("COMPLETED");
      expect(order.completedAt).not.toBeNull();
    });

    it("rejects invalid forward or backward transitions", () => {
      const order = createTestOrder();
      expect(() => order.markShipped()).toThrow(InvalidOrderStatusTransitionError);
      expect(() => order.complete()).toThrow(InvalidOrderStatusTransitionError);

      order.confirm();
      order.startProcessing();
      order.markShipped();

      // Shipped cannot go back to CONFIRMED or PENDING
      expect(() => order.transitionStatus("CONFIRMED")).toThrow(
        InvalidOrderStatusTransitionError,
      );
      expect(() => order.transitionStatus("PENDING")).toThrow(
        InvalidOrderStatusTransitionError,
      );
    });

    it("permits cancellation from PENDING, CONFIRMED, and PROCESSING", () => {
      const order1 = createTestOrder();
      order1.cancel("Customer changed mind");
      expect(order1.status).toBe("CANCELLED");
      expect(order1.cancelReason).toBe("Customer changed mind");
      expect(order1.cancelledAt).not.toBeNull();
      expect(order1.fulfillmentStatus).toBe("CANCELLED");

      const order2 = createTestOrder();
      order2.confirm();
      order2.cancel("Merchant cancelled");
      expect(order2.status).toBe("CANCELLED");

      const order3 = createTestOrder();
      order3.confirm();
      order3.startProcessing();
      order3.cancel("Out of stock");
      expect(order3.status).toBe("CANCELLED");
    });

    it("forbids cancellation once SHIPPED, DELIVERED, or COMPLETED", () => {
      const order = createTestOrder();
      order.confirm();
      order.startProcessing();
      order.markShipped();

      expect(() => order.cancel("Too late")).toThrow(OrderCancellationError);

      const deliveredOrder = createTestOrder();
      deliveredOrder.confirm();
      deliveredOrder.startProcessing();
      deliveredOrder.markShipped();
      deliveredOrder.markDelivered();

      expect(() => deliveredOrder.cancel("Too late")).toThrow(OrderCancellationError);
    });

    it("prevents any transitions out of terminal states (COMPLETED / CANCELLED)", () => {
      const cancelledOrder = createTestOrder();
      cancelledOrder.cancel("Cancel");
      expect(() => cancelledOrder.confirm()).toThrow(OrderImmutableError);
      expect(() => cancelledOrder.cancel("Again")).toThrow(OrderImmutableError);

      const completedOrder = createTestOrder();
      completedOrder.confirm();
      completedOrder.startProcessing();
      completedOrder.markShipped();
      completedOrder.markDelivered();
      completedOrder.complete();

      expect(() => completedOrder.transitionStatus("CONFIRMED")).toThrow(
        OrderImmutableError,
      );
      expect(() => completedOrder.cancel("Return")).toThrow(OrderImmutableError);
    });

    it("rejects unauthorized direct payment status modification", () => {
      const order = createTestOrder();
      expect(() => order.updatePaymentStatus("PAID", false)).toThrow(
        UnauthorizedPaymentStatusChangeError,
      );

      // Authorized internal call succeeds
      order.updatePaymentStatus("PAID", true);
      expect(order.paymentStatus).toBe("PAID");
    });

    it("rejects cross-store access assertion", () => {
      const order = createTestOrder();
      const anotherStore = generateUuidV7();
      expect(() => order.assertBelongsToStore(anotherStore)).toThrow(
        /does not belong to store/,
      );
    });
  });
});
