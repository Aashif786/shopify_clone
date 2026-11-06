import { describe, expect, it } from "vitest";
import { getNextOrderAction } from "../../apps/web/src/lib/merchant-order-helpers";

describe("getNextOrderAction", () => {
  it.each([
    ["PENDING", "UNFULFILLED", "CONFIRMED", "Confirm order"],
    ["CONFIRMED", "UNFULFILLED", "PROCESSING", "Start processing"],
    ["SHIPPED", "FULFILLED", "DELIVERED", "Mark as delivered"],
    ["DELIVERED", "FULFILLED", "COMPLETED", "Complete order"],
  ] as const)("offers the next step from %s", (status, fulfillmentStatus, toStatus, label) => {
    const action = getNextOrderAction({ status, fulfillmentStatus });
    expect(action?.toStatus).toBe(toStatus);
    expect(action?.label).toBe(label);
    expect(action?.description.length).toBeGreaterThan(0);
  });

  it("leaves dispatching to the fulfill dialog while an order is still being processed", () => {
    expect(getNextOrderAction({ status: "PROCESSING", fulfillmentStatus: "UNFULFILLED" })).toBeNull();
    expect(
      getNextOrderAction({ status: "PROCESSING", fulfillmentStatus: "PARTIALLY_FULFILLED" }),
    ).toBeNull();
  });

  it("offers shipping for a processing order that was already fulfilled", () => {
    expect(
      getNextOrderAction({ status: "PROCESSING", fulfillmentStatus: "FULFILLED" })?.toStatus,
    ).toBe("SHIPPED");
  });

  it.each(["COMPLETED", "CANCELLED"] as const)("offers nothing for a %s order", (status) => {
    expect(getNextOrderAction({ status, fulfillmentStatus: "FULFILLED" })).toBeNull();
  });

  it("never offers cancellation as a next step", () => {
    for (const status of [
      "PENDING",
      "CONFIRMED",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
      "COMPLETED",
      "CANCELLED",
    ] as const) {
      expect(getNextOrderAction({ status, fulfillmentStatus: "FULFILLED" })?.toStatus).not.toBe(
        "CANCELLED",
      );
    }
  });
});
