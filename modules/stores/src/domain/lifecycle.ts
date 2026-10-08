import type { StoreStatus, MembershipStatus } from "./entities.js";
import { InvalidStoreStatusTransitionError } from "./errors.js";

const VALID_STORE_TRANSITIONS: Record<StoreStatus, readonly StoreStatus[]> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["SUSPENDED", "ARCHIVED"],
  SUSPENDED: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: [],
};

export function isValidStoreTransition(
  from: StoreStatus,
  to: StoreStatus,
): boolean {
  if (from === to) {
    return true; // No-op
  }
  const allowed = VALID_STORE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export function assertValidStoreTransition(
  from: StoreStatus,
  to: StoreStatus,
): void {
  if (!isValidStoreTransition(from, to)) {
    throw new InvalidStoreStatusTransitionError(from, to);
  }
}

const VALID_MEMBERSHIP_TRANSITIONS: Record<
  MembershipStatus,
  readonly MembershipStatus[]
> = {
  INVITED: ["ACTIVE", "REMOVED"],
  ACTIVE: ["SUSPENDED", "REMOVED"],
  SUSPENDED: ["ACTIVE", "REMOVED"],
  REMOVED: [],
};

export function isValidMembershipTransition(
  from: MembershipStatus,
  to: MembershipStatus,
): boolean {
  if (from === to) {
    return true;
  }
  const allowed = VALID_MEMBERSHIP_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export function assertValidMembershipTransition(
  from: MembershipStatus,
  to: MembershipStatus,
): void {
  if (!isValidMembershipTransition(from, to)) {
    throw new InvalidStoreStatusTransitionError(from, to);
  }
}
