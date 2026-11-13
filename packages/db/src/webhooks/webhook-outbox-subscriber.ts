import { globalEventBus, type DomainEvent } from "@calcart/event-bus";
import { WebhookRepository } from "../repositories/webhook-repository.js";
import type { Database } from "../database.js";

const webhookRepo = new WebhookRepository();
let isInitialized = false;

interface EventWithStoreId {
  storeId?: string;
  [key: string]: unknown;
}

/**
 * Subscribes to global domain events and automatically enqueues outbound webhook deliveries
 * for any store with active matching subscriptions.
 */
export function initializeOutboundWebhookListener(db: Database): void {
  if (isInitialized) return;
  isInitialized = true;

  globalEventBus.subscribe("*", async (event: DomainEvent<unknown>) => {
    try {
      const payload = event.payload as EventWithStoreId | undefined;
      const storeId = payload?.storeId;

      if (!storeId || typeof storeId !== "string") {
        return;
      }

      // Find active subscriptions for this store and event
      const subscriptions = await webhookRepo.findActiveSubscriptionsForEvent(
        db,
        storeId,
        event.eventType,
      );

      if (subscriptions.length === 0) {
        return;
      }

      // Enqueue a delivery for each matching subscription
      for (const sub of subscriptions) {
        await webhookRepo.enqueueDelivery(db, {
          storeId,
          subscriptionId: sub.id,
          eventId: event.eventId,
          eventType: event.eventType,
          payload: {
            eventId: event.eventId,
            eventType: event.eventType,
            occurredAt: event.occurredAt.toISOString(),
            data: event.payload,
          },
        });
      }
    } catch (err) {
      console.error(
        `[WebhookOutboxSubscriber] Failed to enqueue webhook delivery for ${event.eventType}:`,
        err,
      );
    }
  });
}
