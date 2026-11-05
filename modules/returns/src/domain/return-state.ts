import {
  InvalidReturnStatusTransitionError,
  ReturnRequestImmutableError,
} from "./return-errors.js";

export type ReturnRequestStatus =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "RECEIVED"
  | "REFUNDED"
  | "CANCELLED";

export const VALID_RETURN_REQUEST_STATUSES: readonly ReturnRequestStatus[] = [
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "RECEIVED",
  "REFUNDED",
  "CANCELLED",
] as const;

export type ReturnRequestActorType = "CUSTOMER" | "MERCHANT" | "SYSTEM";

export const VALID_RETURN_ACTOR_TYPES: readonly ReturnRequestActorType[] = [
  "CUSTOMER",
  "MERCHANT",
  "SYSTEM",
] as const;

/**
 * The return lifecycle.
 *
 *   REQUESTED ──approve──> APPROVED ──receive──> RECEIVED ──refund──> REFUNDED
 *       │                                                                │
 *       ├──reject──> REJECTED                                      (terminal)
 *       └──cancel──> CANCELLED  (customer withdraws before a decision)
 *
 * Each status maps to itself so that re-applying the current status is an
 * idempotent no-op, matching the convention in `modules/orders`.
 */
export const VALID_RETURN_TRANSITIONS: Record<
  ReturnRequestStatus,
  readonly ReturnRequestStatus[]
> = {
  REQUESTED: ["REQUESTED", "APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["APPROVED", "RECEIVED", "REJECTED"],
  RECEIVED: ["RECEIVED", "REFUNDED"],
  REJECTED: ["REJECTED"],
  REFUNDED: ["REFUNDED"],
  CANCELLED: ["CANCELLED"],
};

/** Statuses that occupy the "one open return per order" slot. */
export const OPEN_RETURN_REQUEST_STATUSES: readonly ReturnRequestStatus[] = [
  "REQUESTED",
  "APPROVED",
  "RECEIVED",
] as const;

export function isValidReturnRequestStatus(
  status: unknown,
): status is ReturnRequestStatus {
  return (
    typeof status === "string" &&
    VALID_RETURN_REQUEST_STATUSES.includes(status as ReturnRequestStatus)
  );
}

export function isValidReturnActorType(
  actorType: unknown,
): actorType is ReturnRequestActorType {
  return (
    typeof actorType === "string" &&
    VALID_RETURN_ACTOR_TYPES.includes(actorType as ReturnRequestActorType)
  );
}

export function isTerminalReturnStatus(status: ReturnRequestStatus): boolean {
  return (
    status === "REJECTED" || status === "REFUNDED" || status === "CANCELLED"
  );
}

export function isOpenReturnStatus(status: ReturnRequestStatus): boolean {
  return OPEN_RETURN_REQUEST_STATUSES.includes(status);
}

export function isValidReturnStatusTransition(
  fromStatus: ReturnRequestStatus,
  toStatus: ReturnRequestStatus,
): boolean {
  const allowed = VALID_RETURN_TRANSITIONS[fromStatus];
  return allowed ? allowed.includes(toStatus) : false;
}

export function assertValidReturnStatusTransition(
  fromStatus: ReturnRequestStatus,
  toStatus: ReturnRequestStatus,
): void {
  if (fromStatus === toStatus) {
    return; // Idempotent no-op
  }

  if (isTerminalReturnStatus(fromStatus)) {
    throw new ReturnRequestImmutableError(
      `Return request is in terminal status '${fromStatus}' and cannot transition to '${toStatus}'`,
    );
  }

  if (!isValidReturnStatusTransition(fromStatus, toStatus)) {
    throw new InvalidReturnStatusTransitionError(fromStatus, toStatus);
  }
}

/**
 * Only the customer who owns the return may withdraw it, and only before the
 * merchant has decided on it.
 */
export function canCustomerCancelReturn(
  status: ReturnRequestStatus,
): boolean {
  return status === "REQUESTED";
}

/** A refund may only be issued once the goods are back with the merchant. */
export function canRefundReturn(status: ReturnRequestStatus): boolean {
  return status === "RECEIVED";
}
