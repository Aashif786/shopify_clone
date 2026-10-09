import {
  InvalidOrderStatusTransitionError,
  OrderCancellationError,
  OrderImmutableError,
} from "./order-errors.js";

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "COMPLETED";

export const VALID_ORDER_STATUSES: readonly OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "COMPLETED",
] as const;

export type OrderPaymentStatus =
  | "PENDING"
  | "AUTHORIZED"
  | "PAID"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED"
  | "FAILED";

export const VALID_ORDER_PAYMENT_STATUSES: readonly OrderPaymentStatus[] = [
  "PENDING",
  "AUTHORIZED",
  "PAID",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "FAILED",
] as const;

export type OrderFulfillmentStatus =
  | "UNFULFILLED"
  | "PARTIALLY_FULFILLED"
  | "FULFILLED"
  | "CANCELLED";

export const VALID_ORDER_FULFILLMENT_STATUSES: readonly OrderFulfillmentStatus[] = [
  "UNFULFILLED",
  "PARTIALLY_FULFILLED",
  "FULFILLED",
  "CANCELLED",
] as const;

export type OrderAddressType = "BILLING" | "SHIPPING";

export type OrderStatusHistoryActorType = "CUSTOMER" | "MERCHANT" | "SYSTEM";

export const VALID_ORDER_STATUS_HISTORY_ACTOR_TYPES: readonly OrderStatusHistoryActorType[] = [
  "CUSTOMER",
  "MERCHANT",
  "SYSTEM",
] as const;

export const VALID_ORDER_TRANSITIONS: Record<
  OrderStatus,
  readonly OrderStatus[]
> = {
  PENDING: ["PENDING", "CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CONFIRMED", "PROCESSING", "CANCELLED"],
  PROCESSING: ["PROCESSING", "SHIPPED", "CANCELLED"],
  SHIPPED: ["SHIPPED", "DELIVERED"],
  DELIVERED: ["DELIVERED", "COMPLETED"],
  CANCELLED: ["CANCELLED"],
  COMPLETED: ["COMPLETED"],
};

export function isValidOrderStatus(status: unknown): status is OrderStatus {
  return (
    typeof status === "string" &&
    VALID_ORDER_STATUSES.includes(status as OrderStatus)
  );
}

export function isValidOrderPaymentStatus(
  status: unknown,
): status is OrderPaymentStatus {
  return (
    typeof status === "string" &&
    VALID_ORDER_PAYMENT_STATUSES.includes(status as OrderPaymentStatus)
  );
}

export function isValidOrderFulfillmentStatus(
  status: unknown,
): status is OrderFulfillmentStatus {
  return (
    typeof status === "string" &&
    VALID_ORDER_FULFILLMENT_STATUSES.includes(status as OrderFulfillmentStatus)
  );
}

export function isValidActorType(
  actorType: unknown,
): actorType is OrderStatusHistoryActorType {
  return (
    typeof actorType === "string" &&
    VALID_ORDER_STATUS_HISTORY_ACTOR_TYPES.includes(
      actorType as OrderStatusHistoryActorType,
    )
  );
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return status === "CANCELLED" || status === "COMPLETED";
}

export function canCancelOrderStatus(status: OrderStatus): boolean {
  return (
    status === "PENDING" ||
    status === "CONFIRMED" ||
    status === "PROCESSING"
  );
}

export function isValidOrderStatusTransition(
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
): boolean {
  const allowed = VALID_ORDER_TRANSITIONS[fromStatus];
  return allowed ? allowed.includes(toStatus) : false;
}

export function assertValidOrderStatusTransition(
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
): void {
  if (fromStatus === toStatus) {
    return; // Idempotent no-op
  }

  if (isTerminalOrderStatus(fromStatus)) {
    throw new OrderImmutableError(
      `Order is in terminal status '${fromStatus}' and cannot transition to '${toStatus}'`,
    );
  }

  if (toStatus === "CANCELLED" && !canCancelOrderStatus(fromStatus)) {
    throw new OrderCancellationError(
      `Cannot cancel order in status '${fromStatus}'. Cancellation is only permitted from PENDING, CONFIRMED, or PROCESSING.`,
    );
  }

  if (!isValidOrderStatusTransition(fromStatus, toStatus)) {
    throw new InvalidOrderStatusTransitionError(fromStatus, toStatus);
  }
}
