import { InvalidCustomerStateTransitionError } from "../errors.js";

export type CustomerStatus = "ACTIVE" | "DISABLED";

export const VALID_CUSTOMER_STATUSES: readonly CustomerStatus[] = [
  "ACTIVE",
  "DISABLED",
] as const;

export function isValidCustomerStatus(status: unknown): status is CustomerStatus {
  return (
    typeof status === "string" &&
    VALID_CUSTOMER_STATUSES.includes(status as CustomerStatus)
  );
}

export interface Customer {
  id: string;
  storeId: string;
  userId: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  status: CustomerStatus;
  createdAt: Date;
  updatedAt: Date;
}

export const VALID_CUSTOMER_TRANSITIONS: Record<
  CustomerStatus,
  readonly CustomerStatus[]
> = {
  ACTIVE: ["ACTIVE", "DISABLED"],
  DISABLED: ["DISABLED", "ACTIVE"],
};

export function isValidCustomerTransition(
  fromStatus: CustomerStatus,
  toStatus: CustomerStatus,
): boolean {
  if (fromStatus === toStatus) {
    return true;
  }
  const allowed = VALID_CUSTOMER_TRANSITIONS[fromStatus] ?? [];
  return allowed.includes(toStatus);
}

export function assertValidCustomerTransition(
  fromStatus: CustomerStatus,
  toStatus: CustomerStatus,
): void {
  if (!isValidCustomerTransition(fromStatus, toStatus)) {
    throw new InvalidCustomerStateTransitionError(fromStatus, toStatus);
  }
}
