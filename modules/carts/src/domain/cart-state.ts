import {
  CartAlreadyConvertedError,
  CartExpiredError,
  CartNotEditableError,
  InvalidCartStateTransitionError,
} from "./cart-errors.js";

export type CartStatus = "ACTIVE" | "CONVERTED" | "ABANDONED" | "EXPIRED";

export const VALID_CART_STATUSES: readonly CartStatus[] = [
  "ACTIVE",
  "CONVERTED",
  "ABANDONED",
  "EXPIRED",
] as const;

export function isValidCartStatus(status: unknown): status is CartStatus {
  return (
    typeof status === "string" &&
    VALID_CART_STATUSES.includes(status as CartStatus)
  );
}

export const VALID_CART_TRANSITIONS: Record<
  CartStatus,
  readonly CartStatus[]
> = {
  ACTIVE: ["ACTIVE", "CONVERTED", "ABANDONED", "EXPIRED"],
  CONVERTED: ["CONVERTED"],
  ABANDONED: ["ABANDONED"],
  EXPIRED: ["EXPIRED"],
};

export function isValidCartTransition(
  fromStatus: CartStatus,
  toStatus: CartStatus,
): boolean {
  if (fromStatus === toStatus) {
    return true;
  }
  const allowed = VALID_CART_TRANSITIONS[fromStatus] ?? [];
  return allowed.includes(toStatus);
}

export function assertValidCartTransition(
  fromStatus: CartStatus,
  toStatus: CartStatus,
): void {
  if (!isValidCartTransition(fromStatus, toStatus)) {
    throw new InvalidCartStateTransitionError(fromStatus, toStatus);
  }
}

export function isCartEditable(status: CartStatus): boolean {
  return status === "ACTIVE";
}

export function assertCartEditable(status: CartStatus): void {
  if (status === "ACTIVE") {
    return;
  }
  if (status === "CONVERTED") {
    throw new CartAlreadyConvertedError();
  }
  if (status === "EXPIRED") {
    throw new CartExpiredError();
  }
  throw new CartNotEditableError();
}
