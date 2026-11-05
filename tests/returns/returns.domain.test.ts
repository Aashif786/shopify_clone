import { describe, expect, it } from "vitest";
import type { OrderDTO } from "@calcart/orders";
import {
  assertValidReturnStatusTransition,
  canCustomerCancelReturn,
  canRefundReturn,
  computeLineRefundAmount,
  computeUnitRefundAmount,
  DEFAULT_RETURN_WINDOW_DAYS,
  evaluateReturnEligibility,
  InvalidReturnPolicyError,
  InvalidReturnStatusTransitionError,
  isOpenReturnStatus,
  isTerminalReturnStatus,
  isValidReturnRequestStatus,
  resolveFulfillmentDate,
  ReturnRequestImmutableError,
  assertValidReturnWindowDays,
  type ReturnPolicy,
} from "@calcart/returns";

const DAY_MS = 24 * 60 * 60 * 1000;

function policy(overrides: Partial<ReturnPolicy> = {}): ReturnPolicy {
  return {
    storeId: "store-1",
    isReturnsEnabled: true,
    returnWindowDays: DEFAULT_RETURN_WINDOW_DAYS,
    ...overrides,
  };
}

function buildOrder(overrides: Partial<OrderDTO> = {}): OrderDTO {
  const fulfilledAt = new Date("2026-01-10T00:00:00.000Z").toISOString();
  return {
    id: "order-1",
    storeId: "store-1",
    orderNumber: "ORD-1",
    customerId: "cust-1",
    checkoutId: null,
    paymentId: null,
    status: "SHIPPED",
    paymentStatus: "PAID",
    fulfillmentStatus: "FULFILLED",
    currency: "INR",
    subtotal: 10_000,
    discountTotal: 0,
    shippingTotal: 0,
    taxTotal: 0,
    total: 10_000,
    grandTotal: 10_000,
    cancelledAt: null,
    cancelReason: null,
    completedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    updatedAt: fulfilledAt,
    statusHistory: [
      {
        id: "h1",
        orderId: "order-1",
        storeId: "store-1",
        fromStatus: "fulfillment:UNFULFILLED",
        toStatus: "fulfillment:FULFILLED",
        reason: null,
        actorType: "MERCHANT",
        actorId: null,
        createdAt: fulfilledAt,
      },
    ],
    ...overrides,
  } as OrderDTO;
}

describe("Returns domain: state machine", () => {
  it("permits only the documented lifecycle transitions", () => {
    // Happy path
    expect(() =>
      assertValidReturnStatusTransition("REQUESTED", "APPROVED"),
    ).not.toThrow();
    expect(() =>
      assertValidReturnStatusTransition("APPROVED", "RECEIVED"),
    ).not.toThrow();
    expect(() =>
      assertValidReturnStatusTransition("RECEIVED", "REFUNDED"),
    ).not.toThrow();

    // Rejection and withdrawal
    expect(() =>
      assertValidReturnStatusTransition("REQUESTED", "REJECTED"),
    ).not.toThrow();
    expect(() =>
      assertValidReturnStatusTransition("REQUESTED", "CANCELLED"),
    ).not.toThrow();
  });

  it("refuses to skip receipt and refund straight from REQUESTED or APPROVED", () => {
    expect(() =>
      assertValidReturnStatusTransition("REQUESTED", "REFUNDED"),
    ).toThrow(InvalidReturnStatusTransitionError);
    expect(() =>
      assertValidReturnStatusTransition("APPROVED", "REFUNDED"),
    ).toThrow(InvalidReturnStatusTransitionError);
  });

  it("refuses to reopen terminal return requests", () => {
    for (const terminal of ["REFUNDED", "REJECTED", "CANCELLED"] as const) {
      expect(() =>
        assertValidReturnStatusTransition(terminal, "APPROVED"),
      ).toThrow(ReturnRequestImmutableError);
      expect(isTerminalReturnStatus(terminal)).toBe(true);
    }
  });

  it("treats re-applying the current status as an idempotent no-op", () => {
    for (const status of [
      "REQUESTED",
      "APPROVED",
      "RECEIVED",
      "REFUNDED",
      "REJECTED",
      "CANCELLED",
    ] as const) {
      expect(() =>
        assertValidReturnStatusTransition(status, status),
      ).not.toThrow();
    }
  });

  it("allows customer withdrawal only before a merchant decision", () => {
    expect(canCustomerCancelReturn("REQUESTED")).toBe(true);
    for (const status of [
      "APPROVED",
      "RECEIVED",
      "REFUNDED",
      "REJECTED",
      "CANCELLED",
    ] as const) {
      expect(canCustomerCancelReturn(status)).toBe(false);
    }
  });

  it("allows a refund only once the goods are received", () => {
    expect(canRefundReturn("RECEIVED")).toBe(true);
    for (const status of [
      "REQUESTED",
      "APPROVED",
      "REFUNDED",
      "REJECTED",
      "CANCELLED",
    ] as const) {
      expect(canRefundReturn(status)).toBe(false);
    }
  });

  it("classifies open vs terminal statuses consistently", () => {
    expect(isOpenReturnStatus("REQUESTED")).toBe(true);
    expect(isOpenReturnStatus("APPROVED")).toBe(true);
    expect(isOpenReturnStatus("RECEIVED")).toBe(true);
    expect(isOpenReturnStatus("REFUNDED")).toBe(false);
    expect(isValidReturnRequestStatus("NOPE")).toBe(false);
    expect(isValidReturnRequestStatus("REQUESTED")).toBe(true);
  });
});

describe("Returns domain: refund arithmetic", () => {
  it("nets the line discount off the per-unit refund", () => {
    // 3 units at 1000, 300 discount on the line => 100 off each unit.
    expect(
      computeUnitRefundAmount({
        unitPrice: 1000,
        discountAmount: 300,
        quantity: 3,
      }),
    ).toBe(900);
  });

  it("refunds exactly the line total when the whole line is returned", () => {
    // Guards against per-unit rounding leaking or losing minor units:
    // 3 units at 1000 with a 301 discount is 2699, not 3 * 899 = 2697.
    const item = { unitPrice: 1000, discountAmount: 301, quantity: 3 };
    expect(computeLineRefundAmount(item, 3)).toBe(2699);
    expect(computeLineRefundAmount(item, 4)).toBe(2699);
  });

  it("never returns a negative refund when the discount exceeds the price", () => {
    expect(
      computeUnitRefundAmount({
        unitPrice: 500,
        discountAmount: 9999,
        quantity: 1,
      }),
    ).toBe(0);
    expect(
      computeLineRefundAmount(
        { unitPrice: 500, discountAmount: 9999, quantity: 2 },
        2,
      ),
    ).toBe(0);
  });

  it("returns zero for non-positive quantities", () => {
    const item = { unitPrice: 1000, discountAmount: 0, quantity: 2 };
    expect(computeLineRefundAmount(item, 0)).toBe(0);
    expect(computeLineRefundAmount(item, -1)).toBe(0);
    expect(
      computeUnitRefundAmount({ unitPrice: 1000, discountAmount: 0, quantity: 0 }),
    ).toBe(0);
  });
});

describe("Returns domain: eligibility", () => {
  it("anchors the return window on the fulfilment history entry", () => {
    const order = buildOrder();
    const resolved = resolveFulfillmentDate(order);
    expect(resolved?.toISOString()).toBe("2026-01-10T00:00:00.000Z");

    const result = evaluateReturnEligibility(
      order,
      policy({ returnWindowDays: 14 }),
      new Date("2026-01-20T00:00:00.000Z"),
    );
    expect(result.isEligible).toBe(true);
    expect(result.windowEndsAt?.toISOString()).toBe("2026-01-24T00:00:00.000Z");
  });

  it("expires exactly after the configured window", () => {
    const order = buildOrder();
    const within = evaluateReturnEligibility(
      order,
      policy({ returnWindowDays: 14 }),
      new Date("2026-01-24T00:00:00.000Z"),
    );
    expect(within.isEligible).toBe(true);

    const after = evaluateReturnEligibility(
      order,
      policy({ returnWindowDays: 14 }),
      new Date("2026-01-24T00:00:01.000Z"),
    );
    expect(after.isEligible).toBe(false);
    expect(after.reason).toBe("RETURN_WINDOW_EXPIRED");
  });

  it("rejects unfulfilled, cancelled, unpaid and fully refunded orders", () => {
    const now = new Date("2026-01-12T00:00:00.000Z");

    expect(
      evaluateReturnEligibility(
        buildOrder({ fulfillmentStatus: "UNFULFILLED", statusHistory: [] }),
        policy(),
        now,
      ).reason,
    ).toBe("ORDER_NOT_FULFILLED");

    expect(
      evaluateReturnEligibility(
        buildOrder({ status: "CANCELLED" }),
        policy(),
        now,
      ).reason,
    ).toBe("ORDER_CANCELLED");

    expect(
      evaluateReturnEligibility(
        buildOrder({ paymentStatus: "PENDING" }),
        policy(),
        now,
      ).reason,
    ).toBe("ORDER_NOT_PAID");

    expect(
      evaluateReturnEligibility(
        buildOrder({ paymentStatus: "REFUNDED" }),
        policy(),
        now,
      ).reason,
    ).toBe("ORDER_FULLY_REFUNDED");
  });

  it("allows a return on a partially refunded order", () => {
    const result = evaluateReturnEligibility(
      buildOrder({ paymentStatus: "PARTIALLY_REFUNDED" }),
      policy(),
      new Date("2026-01-12T00:00:00.000Z"),
    );
    expect(result.isEligible).toBe(true);
  });

  it("honours a store that has switched returns off", () => {
    const result = evaluateReturnEligibility(
      buildOrder(),
      policy({ isReturnsEnabled: false }),
      new Date("2026-01-12T00:00:00.000Z"),
    );
    expect(result.isEligible).toBe(false);
    expect(result.reason).toBe("RETURNS_DISABLED");
  });

  it("supports a zero-day window, which closes returns the moment they ship", () => {
    const result = evaluateReturnEligibility(
      buildOrder(),
      policy({ returnWindowDays: 0 }),
      new Date("2026-01-10T00:00:01.000Z"),
    );
    expect(result.isEligible).toBe(false);
    expect(result.reason).toBe("RETURN_WINDOW_EXPIRED");
  });

  it("falls back to completedAt when fulfilment history is absent", () => {
    const completedAt = new Date("2026-02-01T00:00:00.000Z").toISOString();
    const order = buildOrder({ statusHistory: [], completedAt });
    expect(resolveFulfillmentDate(order)?.toISOString()).toBe(completedAt);
  });

  it("uses the latest fulfilment entry when an order ships more than once", () => {
    const order = buildOrder({
      statusHistory: [
        {
          id: "h1",
          orderId: "order-1",
          storeId: "store-1",
          fromStatus: "fulfillment:UNFULFILLED",
          toStatus: "fulfillment:PARTIALLY_FULFILLED",
          reason: null,
          actorType: "MERCHANT",
          actorId: null,
          createdAt: new Date("2026-01-05T00:00:00.000Z").toISOString(),
        },
        {
          id: "h2",
          orderId: "order-1",
          storeId: "store-1",
          fromStatus: "fulfillment:PARTIALLY_FULFILLED",
          toStatus: "fulfillment:FULFILLED",
          reason: null,
          actorType: "MERCHANT",
          actorId: null,
          createdAt: new Date("2026-01-15T00:00:00.000Z").toISOString(),
        },
      ],
    });
    expect(resolveFulfillmentDate(order)?.toISOString()).toBe(
      "2026-01-15T00:00:00.000Z",
    );
  });

  it("ignores unrelated status history entries", () => {
    const order = buildOrder({
      statusHistory: [
        {
          id: "h1",
          orderId: "order-1",
          storeId: "store-1",
          fromStatus: "PENDING",
          toStatus: "CONFIRMED",
          reason: null,
          actorType: "SYSTEM",
          actorId: null,
          createdAt: new Date("2026-01-02T00:00:00.000Z").toISOString(),
        },
      ],
      completedAt: null,
    });
    expect(resolveFulfillmentDate(order)).toBeNull();
    expect(
      evaluateReturnEligibility(order, policy(), new Date()).reason,
    ).toBe("ORDER_NOT_FULFILLED");
  });
});

describe("Returns domain: policy validation", () => {
  it("accepts the supported window range and rejects everything else", () => {
    expect(() => assertValidReturnWindowDays(0)).not.toThrow();
    expect(() => assertValidReturnWindowDays(14)).not.toThrow();
    expect(() => assertValidReturnWindowDays(365)).not.toThrow();

    for (const invalid of [-1, 366, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => assertValidReturnWindowDays(invalid)).toThrow(
        InvalidReturnPolicyError,
      );
    }
  });

  it("defaults to a 14-day window", () => {
    expect(DEFAULT_RETURN_WINDOW_DAYS).toBe(14);
    const result = evaluateReturnEligibility(
      buildOrder(),
      policy(),
      new Date(
        new Date("2026-01-10T00:00:00.000Z").getTime() + 13 * DAY_MS,
      ),
    );
    expect(result.isEligible).toBe(true);
  });
});
