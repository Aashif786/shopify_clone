import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  InMemoryEventBus,
  getEventBus,
  resetGlobalEventBus,
  type DomainEvent,
} from "@calcart/event-bus";

interface OrderCreatedPayload {
  orderId: string;
  storeId: string;
  amount: number;
}

interface ProductUpdatedPayload {
  productId: string;
  storeId: string;
  title: string;
}

describe("InMemoryEventBus (GAP-08)", () => {
  let bus: InMemoryEventBus;

  beforeEach(() => {
    bus = new InMemoryEventBus();
  });

  it("subscribes and receives matching domain events", async () => {
    const received: DomainEvent<OrderCreatedPayload>[] = [];
    bus.subscribe<OrderCreatedPayload>("order.created", (event) => {
      received.push(event);
    });

    const event: DomainEvent<OrderCreatedPayload> = {
      eventId: "evt_1",
      eventType: "order.created",
      occurredAt: new Date(),
      payload: { orderId: "ord_100", storeId: "store_1", amount: 4999 },
    };

    await bus.publish(event);

    expect(received).toHaveLength(1);
    expect(received[0].payload.orderId).toBe("ord_100");
    expect(received[0].payload.amount).toBe(4999);
  });

  it("does not deliver events to handlers of a different event type", async () => {
    const orderHandler = vi.fn();
    const productHandler = vi.fn();

    bus.subscribe("order.created", orderHandler);
    bus.subscribe("product.updated", productHandler);

    await bus.publish({
      eventId: "evt_prod",
      eventType: "product.updated",
      occurredAt: new Date(),
      payload: { productId: "p1", storeId: "s1", title: "Shirt" },
    });

    expect(productHandler).toHaveBeenCalledTimes(1);
    expect(orderHandler).not.toHaveBeenCalled();
  });

  it("supports wildcard subscription to receive all domain events", async () => {
    const allEvents: string[] = [];
    bus.subscribe("*", (event) => {
      allEvents.push(event.eventType);
    });

    await bus.publish({
      eventId: "e1",
      eventType: "order.created",
      occurredAt: new Date(),
      payload: {},
    });

    await bus.publish({
      eventId: "e2",
      eventType: "customer.registered",
      occurredAt: new Date(),
      payload: {},
    });

    expect(allEvents).toEqual(["order.created", "customer.registered"]);
  });

  it("unsubscribes using the returned disposer callback", async () => {
    const handler = vi.fn();
    const unsubscribe = bus.subscribe("order.paid", handler);

    await bus.publish({
      eventId: "e1",
      eventType: "order.paid",
      occurredAt: new Date(),
      payload: {},
    });

    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();

    await bus.publish({
      eventId: "e2",
      eventType: "order.paid",
      occurredAt: new Date(),
      payload: {},
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(bus.listenerCount("order.paid")).toBe(0);
  });

  it("unsubscribes using the unsubscribe method", async () => {
    const handler = vi.fn();
    bus.subscribe("cart.abandoned", handler);
    expect(bus.listenerCount("cart.abandoned")).toBe(1);

    const removed = bus.unsubscribe("cart.abandoned", handler);
    expect(removed).toBe(true);
    expect(bus.listenerCount("cart.abandoned")).toBe(0);

    const removedAgain = bus.unsubscribe("cart.abandoned", handler);
    expect(removedAgain).toBe(false);
  });

  it("unsubscribes wildcard handlers properly", async () => {
    const wildcard = vi.fn();
    const unsub = bus.subscribe("*", wildcard);
    expect(bus.listenerCount("*")).toBe(1);

    unsub();
    expect(bus.listenerCount("*")).toBe(0);

    await bus.publish({
      eventId: "e1",
      eventType: "any.event",
      occurredAt: new Date(),
      payload: {},
    });

    expect(wildcard).not.toHaveBeenCalled();
  });

  it("isolates errors in one subscriber so siblings still run", async () => {
    const onError = vi.fn();
    const resilientBus = new InMemoryEventBus({ onError });

    const failingHandler = vi.fn().mockImplementation(() => {
      throw new Error("Simulated subscriber failure");
    });
    const succeedingHandler = vi.fn();

    resilientBus.subscribe("checkout.completed", failingHandler);
    resilientBus.subscribe("checkout.completed", succeedingHandler);

    const event: DomainEvent = {
      eventId: "e_chk",
      eventType: "checkout.completed",
      occurredAt: new Date(),
      payload: { checkoutId: "chk_123" },
    };

    // publish must NOT throw
    await expect(resilientBus.publish(event)).resolves.not.toThrow();

    expect(failingHandler).toHaveBeenCalledTimes(1);
    expect(succeedingHandler).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe("Simulated subscriber failure");
  });

  it("counts active listeners accurately", () => {
    const h1 = () => {};
    const h2 = () => {};
    const w1 = () => {};

    expect(bus.listenerCount()).toBe(0);

    bus.subscribe("order.created", h1);
    bus.subscribe("order.created", h2);
    bus.subscribe("*", w1);

    expect(bus.listenerCount("order.created")).toBe(3); // 2 specific + 1 wildcard
    expect(bus.listenerCount("other.event")).toBe(1); // 0 specific + 1 wildcard
    expect(bus.listenerCount()).toBe(3); // total unique subscriptions
  });

  it("clears all listeners on clear()", () => {
    bus.subscribe("a", () => {});
    bus.subscribe("b", () => {});
    bus.subscribe("*", () => {});

    expect(bus.listenerCount()).toBe(3);

    bus.clear();

    expect(bus.listenerCount()).toBe(0);
  });

  describe("Global Event Bus Singleton", () => {
    beforeEach(() => {
      resetGlobalEventBus();
    });

    it("provides a consistent shared singleton", () => {
      const b1 = getEventBus();
      const b2 = getEventBus();
      expect(b1).toBe(b2);
    });

    it("clears cleanly on resetGlobalEventBus", () => {
      const b1 = getEventBus();
      b1.subscribe("test", () => {});
      expect(b1.listenerCount("test")).toBe(1);

      resetGlobalEventBus();
      const b2 = getEventBus();
      expect(b2.listenerCount("test")).toBe(0);
    });
  });
});
