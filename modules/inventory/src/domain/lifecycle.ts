import type { ReservationStatus } from "./entities.js";
import { InvalidReservationStateTransitionError } from "./errors.js";

export const VALID_RESERVATION_TRANSITIONS: Record<
  ReservationStatus,
  readonly ReservationStatus[]
> = {
  ACTIVE: ["RELEASED", "COMMITTED"],
  RELEASED: [],
  COMMITTED: [],
};

export function isValidReservationTransition(
  fromStatus: ReservationStatus,
  toStatus: ReservationStatus,
): boolean {
  if (fromStatus === toStatus) {
    return true;
  }
  const allowed = VALID_RESERVATION_TRANSITIONS[fromStatus] ?? [];
  return allowed.includes(toStatus);
}

export function assertValidReservationTransition(
  fromStatus: ReservationStatus,
  toStatus: ReservationStatus,
): void {
  if (!isValidReservationTransition(fromStatus, toStatus)) {
    throw new InvalidReservationStateTransitionError(fromStatus, toStatus);
  }
}

export function isTerminalReservationStatus(status: ReservationStatus): boolean {
  return status === "RELEASED" || status === "COMMITTED";
}
