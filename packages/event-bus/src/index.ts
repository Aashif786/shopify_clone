export interface DomainEvent<T = unknown> {
  eventId: string;
  eventType: string;
  occurredAt: Date;
  payload: T;
  correlationId?: string;
}

export type EventHandler<T = unknown> = (event: DomainEvent<T>) => Promise<void> | void;

export interface EventBus {
  publish<T>(event: DomainEvent<T>): Promise<void>;
  subscribe<T>(eventType: string, handler: EventHandler<T>): () => void;
  unsubscribe?<T>(eventType: string, handler: EventHandler<T>): boolean;
}

export * from "./in-memory-event-bus.js";

import { InMemoryEventBus } from "./in-memory-event-bus.js";

export const globalEventBus: InMemoryEventBus = new InMemoryEventBus({
  onError: (error, event) => {
    console.error(`[EventBus] Handler failed for "${event.eventType}":`, error);
  },
});

export interface OrderCreatedPayload {
  storeId: string;
  orderId: string;
  orderNumber: string;
  customerId: string | null;
  total: number;
  currency: string;
}

export interface OrderPaidPayload {
  storeId: string;
  orderId: string;
  orderNumber: string;
  paymentId: string;
  amount: number;
  currency: string;
}

export interface OrderFulfilledPayload {
  storeId: string;
  orderId: string;
  orderNumber: string;
  shipmentId: string;
  trackingNumber: string | null;
  carrierName: string | null;
}

export interface ShipmentDeliveredPayload {
  storeId: string;
  orderId: string;
  shipmentId: string;
  deliveredAt: string;
}

export interface ReturnReceivedPayload {
  storeId: string;
  returnId: string;
  orderId: string;
  restocked: boolean;
}
