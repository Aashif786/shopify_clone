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
  subscribe<T>(eventType: string, handler: EventHandler<T>): void;
}
