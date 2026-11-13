import type { DomainEvent, EventBus, EventHandler } from "./index.js";

export type EventBusErrorHandler = (error: unknown, event: DomainEvent<unknown>) => void;

export interface InMemoryEventBusOptions {
  onError?: EventBusErrorHandler;
}

/**
 * The stored form of a handler, with its payload type erased.
 *
 * One registry holds handlers for many unrelated payload types at once, so the
 * stored type must be opaque. `EventHandler<unknown>` would be wrong: it claims
 * every handler accepts every payload. `DomainEvent<never>` is the one event
 * type assignable to all of them (parameters are contravariant and `never` is
 * assignable to any `T`), so every `EventHandler<T>` stores without a cast and
 * the single unavoidable cast sits at the dispatch boundary in `publish`.
 */
type ErasedEventHandler = EventHandler<never>;

/**
 * In-memory domain event bus dispatcher.
 *
 * Provides in-process, asynchronous decoupled domain event publishing and
 * subscription with fault isolation (handler errors do not abort sibling handlers).
 */
export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, Set<ErasedEventHandler>>();
  private readonly wildcardHandlers = new Set<ErasedEventHandler>();
  private readonly onError?: EventBusErrorHandler;

  constructor(options: InMemoryEventBusOptions = {}) {
    this.onError = options.onError;
  }

  /**
   * Subscribe a handler to a specific event type or wildcard ("*").
   * Returns an unsubscribe callback for easy cleanup.
   */
  subscribe<T = unknown>(eventType: string, handler: EventHandler<T>): () => void {
    if (!eventType || typeof eventType !== "string") {
      throw new TypeError("Event type must be a non-empty string");
    }
    if (typeof handler !== "function") {
      throw new TypeError("Event handler must be a function");
    }

    if (eventType === "*") {
      this.wildcardHandlers.add(handler);
      return () => {
        this.wildcardHandlers.delete(handler);
      };
    }

    let set = this.handlers.get(eventType);
    if (!set) {
      set = new Set();
      this.handlers.set(eventType, set);
    }
    set.add(handler);

    return () => {
      this.unsubscribe(eventType, handler);
    };
  }

  /**
   * Unsubscribe a previously registered handler.
   */
  unsubscribe<T = unknown>(eventType: string, handler: EventHandler<T>): boolean {
    if (eventType === "*") {
      return this.wildcardHandlers.delete(handler);
    }

    const set = this.handlers.get(eventType);
    if (!set) return false;

    const deleted = set.delete(handler);
    if (set.size === 0) {
      this.handlers.delete(eventType);
    }
    return deleted;
  }

  /**
   * Publish a domain event to all registered matching handlers.
   *
   * Executes all handlers in parallel using Promise.allSettled. A thrown error
   * in one handler is isolated and will not prevent other handlers from executing.
   */
  async publish<T = unknown>(event: DomainEvent<T>): Promise<void> {
    if (!event || typeof event.eventType !== "string") {
      throw new TypeError("Event must be a valid DomainEvent object with an eventType string");
    }

    const targetHandlers: ErasedEventHandler[] = [];

    const specificSet = this.handlers.get(event.eventType);
    if (specificSet && specificSet.size > 0) {
      targetHandlers.push(...specificSet);
    }

    if (this.wildcardHandlers.size > 0) {
      targetHandlers.push(...this.wildcardHandlers);
    }

    if (targetHandlers.length === 0) {
      return;
    }

    const promises = targetHandlers.map(async (handler) => {
      try {
        await (handler as EventHandler<T>)(event);
      } catch (err) {
        if (this.onError) {
          try {
            this.onError(err, event as DomainEvent<unknown>);
          } catch {
            // Prevent error handler from crashing the publisher
          }
        }
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Returns the count of active listeners for a given event type,
   * or the total count across all event types.
   */
  listenerCount(eventType?: string): number {
    if (eventType === "*") {
      return this.wildcardHandlers.size;
    }
    if (eventType) {
      return (this.handlers.get(eventType)?.size ?? 0) + this.wildcardHandlers.size;
    }

    let count = this.wildcardHandlers.size;
    for (const set of this.handlers.values()) {
      count += set.size;
    }
    return count;
  }

  /**
   * Remove all registered handlers. Useful for testing teardown.
   */
  clear(): void {
    this.handlers.clear();
    this.wildcardHandlers.clear();
  }
}

/**
 * Global shared in-memory event bus singleton.
 */
let globalEventBus: InMemoryEventBus | null = null;

export function getEventBus(): InMemoryEventBus {
  if (!globalEventBus) {
    globalEventBus = new InMemoryEventBus({
      onError: (err, event) => {
        // Safe standard logging in server environments without unhandled rejection
        if (typeof console !== "undefined" && console.error) {
          console.error(`[EventBus] Unhandled error in subscriber for event "${event.eventType}":`, err);
        }
      },
    });
  }
  return globalEventBus;
}

export function resetGlobalEventBus(): void {
  if (globalEventBus) {
    globalEventBus.clear();
    globalEventBus = null;
  }
}
