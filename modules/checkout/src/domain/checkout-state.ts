import {
  CheckoutAlreadyCompletedError,
  CheckoutExpiredError,
  CheckoutNotEditableError,
  InvalidCheckoutStateTransitionError,
} from "./checkout-errors.js";

export type CheckoutStatus =
  | "OPEN"
  | "PAYMENT_PENDING"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED"
  | "FAILED";

export const VALID_CHECKOUT_STATUSES: readonly CheckoutStatus[] = [
  "OPEN",
  "PAYMENT_PENDING",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
  "FAILED",
] as const;

export type CheckoutPaymentStatus =
  | "PENDING"
  | "AUTHORIZED"
  | "PAID"
  | "FAILED"
  | "CANCELLED";

export const VALID_PAYMENT_STATUSES: readonly CheckoutPaymentStatus[] = [
  "PENDING",
  "AUTHORIZED",
  "PAID",
  "FAILED",
  "CANCELLED",
] as const;

export function isValidCheckoutStatus(status: unknown): status is CheckoutStatus {
  return (
    typeof status === "string" &&
    VALID_CHECKOUT_STATUSES.includes(status as CheckoutStatus)
  );
}

export function isValidPaymentStatus(status: unknown): status is CheckoutPaymentStatus {
  return (
    typeof status === "string" &&
    VALID_PAYMENT_STATUSES.includes(status as CheckoutPaymentStatus)
  );
}

export const VALID_CHECKOUT_TRANSITIONS: Record<
  CheckoutStatus,
  readonly CheckoutStatus[]
> = {
  OPEN: ["OPEN", "PAYMENT_PENDING", "CANCELLED", "EXPIRED", "FAILED"],
  PAYMENT_PENDING: [
    "PAYMENT_PENDING",
    "COMPLETED",
    "OPEN",
    "CANCELLED",
    "EXPIRED",
    "FAILED",
  ],
  COMPLETED: ["COMPLETED"],
  CANCELLED: ["CANCELLED"],
  EXPIRED: ["EXPIRED"],
  FAILED: ["FAILED"],
};

export function isValidCheckoutTransition(
  fromStatus: CheckoutStatus,
  toStatus: CheckoutStatus,
): boolean {
  if (fromStatus === toStatus) {
    return true;
  }
  const allowed = VALID_CHECKOUT_TRANSITIONS[fromStatus] ?? [];
  return allowed.includes(toStatus);
}

export function assertValidCheckoutTransition(
  fromStatus: CheckoutStatus,
  toStatus: CheckoutStatus,
): void {
  if (!isValidCheckoutTransition(fromStatus, toStatus)) {
    throw new InvalidCheckoutStateTransitionError(fromStatus, toStatus);
  }
}

export function isCheckoutEditable(status: CheckoutStatus): boolean {
  return status === "OPEN";
}

export function isTerminalCheckoutStatus(status: CheckoutStatus): boolean {
  return (
    status === "COMPLETED" ||
    status === "CANCELLED" ||
    status === "EXPIRED" ||
    status === "FAILED"
  );
}

export function assertCheckoutEditable(status: CheckoutStatus): void {
  if (status === "OPEN") {
    return;
  }
  if (status === "COMPLETED") {
    throw new CheckoutAlreadyCompletedError();
  }
  if (status === "EXPIRED") {
    throw new CheckoutExpiredError();
  }
  throw new CheckoutNotEditableError(
    `Checkout in status '${status}' cannot be modified`,
  );
}
