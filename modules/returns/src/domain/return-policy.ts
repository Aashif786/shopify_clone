import type { OrderDTO } from "@calcart/orders";
import { InvalidReturnPolicyError } from "./return-errors.js";

/**
 * Return window applied when a store has no `return_policies` row.
 * Stores opt into a different window by persisting a policy.
 */
export const DEFAULT_RETURN_WINDOW_DAYS = 14;

export const MAX_RETURN_WINDOW_DAYS = 365;

export interface ReturnPolicy {
  storeId: string;
  isReturnsEnabled: boolean;
  returnWindowDays: number;
}

export function defaultReturnPolicy(storeId: string): ReturnPolicy {
  return {
    storeId,
    isReturnsEnabled: true,
    returnWindowDays: DEFAULT_RETURN_WINDOW_DAYS,
  };
}

export type ReturnIneligibilityReason =
  | "RETURNS_DISABLED"
  | "ORDER_CANCELLED"
  | "ORDER_NOT_FULFILLED"
  | "ORDER_NOT_PAID"
  | "ORDER_FULLY_REFUNDED"
  | "RETURN_WINDOW_EXPIRED";

export interface ReturnEligibility {
  isEligible: boolean;
  reason: ReturnIneligibilityReason | null;
  /** Timestamp the return window is measured from (the fulfilment moment). */
  windowStartsAt: Date | null;
  /** Inclusive deadline for requesting a return, null when not yet fulfilled. */
  windowEndsAt: Date | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Resolves the moment an order became returnable.
 *
 * `orders` has no `fulfilled_at` column, but `updateFulfillmentStatus` writes
 * an append-only status-history entry with `to_status = 'fulfillment:FULFILLED'`,
 * so that entry's timestamp is the authoritative fulfilment moment. Falls back
 * to `completedAt` for orders fulfilled before history was recorded, and
 * returns null when the order has never been fulfilled.
 */
export function resolveFulfillmentDate(order: OrderDTO): Date | null {
  const history = order.statusHistory ?? [];

  const fulfillmentEntries = history
    .filter(
      (entry) =>
        entry.toStatus === "fulfillment:FULFILLED" ||
        entry.toStatus === "fulfillment:PARTIALLY_FULFILLED",
    )
    .map((entry) => new Date(entry.createdAt))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  if (fulfillmentEntries[0]) {
    return fulfillmentEntries[0];
  }

  // Orders fulfilled before fulfilment history existed.
  if (
    order.completedAt &&
    (order.fulfillmentStatus === "FULFILLED" ||
      order.fulfillmentStatus === "PARTIALLY_FULFILLED")
  ) {
    const completed = new Date(order.completedAt);
    if (!Number.isNaN(completed.getTime())) {
      return completed;
    }
  }

  return null;
}

/**
 * Decides whether a customer may open a return on this order.
 *
 * Deliberately ignores whether another return request already exists — that is
 * a persistence-level concern enforced by the `one open return per order`
 * partial unique index and checked by the service.
 */
export function evaluateReturnEligibility(
  order: OrderDTO,
  policy: ReturnPolicy,
  now: Date = new Date(),
): ReturnEligibility {
  const windowStartsAt = resolveFulfillmentDate(order);
  const windowEndsAt = windowStartsAt
    ? new Date(windowStartsAt.getTime() + policy.returnWindowDays * MS_PER_DAY)
    : null;

  const base = { windowStartsAt, windowEndsAt };

  if (!policy.isReturnsEnabled) {
    return { isEligible: false, reason: "RETURNS_DISABLED", ...base };
  }

  if (order.status === "CANCELLED") {
    return { isEligible: false, reason: "ORDER_CANCELLED", ...base };
  }

  // Goods must have shipped before they can come back.
  if (
    order.fulfillmentStatus !== "FULFILLED" &&
    order.fulfillmentStatus !== "PARTIALLY_FULFILLED"
  ) {
    return { isEligible: false, reason: "ORDER_NOT_FULFILLED", ...base };
  }

  // A return ends in a refund, so there must be captured money to refund.
  if (order.paymentStatus === "REFUNDED") {
    return { isEligible: false, reason: "ORDER_FULLY_REFUNDED", ...base };
  }
  if (
    order.paymentStatus !== "PAID" &&
    order.paymentStatus !== "PARTIALLY_REFUNDED"
  ) {
    return { isEligible: false, reason: "ORDER_NOT_PAID", ...base };
  }

  if (!windowStartsAt || !windowEndsAt) {
    return { isEligible: false, reason: "ORDER_NOT_FULFILLED", ...base };
  }

  if (now.getTime() > windowEndsAt.getTime()) {
    return { isEligible: false, reason: "RETURN_WINDOW_EXPIRED", ...base };
  }

  return { isEligible: true, reason: null, ...base };
}

/** The parts of an order line that decide what a customer actually paid for it. */
export interface RefundableLine {
  unitPrice: number;
  discountAmount: number;
  /** GST charged on the line. Zero for a store that does not charge tax. */
  taxAmount?: number;
  quantity: number;
}

/**
 * What the customer was charged for the whole line:
 * price x quantity, less its share of any discount, plus the tax on it.
 *
 * Tax is included because the customer paid it. A line's `taxAmount` is the
 * frozen figure from the checkout's tax snapshot, so it is exactly what was
 * charged, regardless of any rate change since.
 */
export function lineChargedAmount(item: RefundableLine): number {
  return Math.max(
    0,
    item.unitPrice * item.quantity - item.discountAmount + (item.taxAmount ?? 0),
  );
}

/**
 * Per-unit refundable value of an order line, for display. The authoritative
 * figure for a request is `computeLineRefundAmount`, which is exact for a
 * whole line; this rounds down so the preview never overstates a refund.
 */
export function computeUnitRefundAmount(item: RefundableLine): number {
  if (item.quantity <= 0) {
    return 0;
  }
  return Math.floor(lineChargedAmount(item) / item.quantity);
}

/**
 * Refundable value of returning `returnQuantity` units of an order line.
 *
 * Returning the whole line refunds exactly what it was charged, so rounding
 * can never leak or lose a minor unit. A partial return is pro-rated and
 * rounded DOWN: successive partial returns of one line can then never add up
 * to more than the customer paid, even though the last unit may be a paisa
 * short, which is the safe direction for a merchant's money.
 */
export function computeLineRefundAmount(
  item: RefundableLine,
  returnQuantity: number,
): number {
  if (returnQuantity <= 0) {
    return 0;
  }
  const charged = lineChargedAmount(item);
  if (returnQuantity >= item.quantity) {
    return charged;
  }
  // BigInt: charged x quantity can exceed 2^53 on a large line.
  return Number(
    (BigInt(charged) * BigInt(returnQuantity)) / BigInt(item.quantity),
  );
}

export function assertValidReturnWindowDays(days: number): void {
  if (
    !Number.isInteger(days) ||
    days < 0 ||
    days > MAX_RETURN_WINDOW_DAYS
  ) {
    throw new InvalidReturnPolicyError(
      `returnWindowDays must be an integer between 0 and ${MAX_RETURN_WINDOW_DAYS}`,
    );
  }
}
