import {
  InvalidPaymentAttemptStateTransitionError,
  InvalidPaymentStateTransitionError,
  InvalidRefundStateTransitionError,
} from "./payment-errors.js";

export type PaymentStatus =
  | "CREATED"
  | "PENDING"
  | "PROCESSING"
  | "AUTHORIZED"
  | "CAPTURED"
  | "FAILED"
  | "CANCELLED"
  | "REQUIRES_RECONCILIATION"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED";

export const VALID_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "CREATED",
  "PENDING",
  "PROCESSING",
  "AUTHORIZED",
  "CAPTURED",
  "FAILED",
  "CANCELLED",
  "REQUIRES_RECONCILIATION",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
] as const;

export type PaymentAttemptStatus =
  | "INITIATED"
  | "PENDING"
  | "AUTHORIZED"
  | "CAPTURED"
  | "FAILED"
  | "CANCELLED"
  | "REQUIRES_RECONCILIATION";

export const VALID_PAYMENT_ATTEMPT_STATUSES: readonly PaymentAttemptStatus[] = [
  "INITIATED",
  "PENDING",
  "AUTHORIZED",
  "CAPTURED",
  "FAILED",
  "CANCELLED",
  "REQUIRES_RECONCILIATION",
] as const;

export type RefundStatus =
  | "PENDING"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "REQUIRES_RECONCILIATION";

export const VALID_REFUND_STATUSES: readonly RefundStatus[] = [
  "PENDING",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "REQUIRES_RECONCILIATION",
] as const;

export function isValidPaymentStatus(status: unknown): status is PaymentStatus {
  return (
    typeof status === "string" &&
    VALID_PAYMENT_STATUSES.includes(status as PaymentStatus)
  );
}

export function isValidPaymentAttemptStatus(
  status: unknown,
): status is PaymentAttemptStatus {
  return (
    typeof status === "string" &&
    VALID_PAYMENT_ATTEMPT_STATUSES.includes(status as PaymentAttemptStatus)
  );
}

export function isValidRefundStatus(status: unknown): status is RefundStatus {
  return (
    typeof status === "string" &&
    VALID_REFUND_STATUSES.includes(status as RefundStatus)
  );
}

export const VALID_PAYMENT_TRANSITIONS: Record<
  PaymentStatus,
  readonly PaymentStatus[]
> = {
  CREATED: ["CREATED", "PENDING", "CANCELLED", "FAILED"],
  PENDING: [
    "PENDING",
    "PROCESSING",
    "AUTHORIZED",
    "CAPTURED",
    "FAILED",
    "CANCELLED",
    "REQUIRES_RECONCILIATION",
  ],
  PROCESSING: [
    "PROCESSING",
    "AUTHORIZED",
    "CAPTURED",
    "FAILED",
    "REQUIRES_RECONCILIATION",
  ],
  AUTHORIZED: [
    "AUTHORIZED",
    "CAPTURED",
    "CANCELLED",
    "FAILED",
    "REQUIRES_RECONCILIATION",
  ],
  CAPTURED: ["CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED"],
  PARTIALLY_REFUNDED: ["PARTIALLY_REFUNDED", "REFUNDED"],
  REFUNDED: ["REFUNDED"],
  FAILED: ["FAILED"],
  CANCELLED: ["CANCELLED"],
  REQUIRES_RECONCILIATION: [
    "REQUIRES_RECONCILIATION",
    "AUTHORIZED",
    "CAPTURED",
    "FAILED",
    "CANCELLED",
  ],
};

export const VALID_PAYMENT_ATTEMPT_TRANSITIONS: Record<
  PaymentAttemptStatus,
  readonly PaymentAttemptStatus[]
> = {
  INITIATED: ["INITIATED", "PENDING", "FAILED", "CANCELLED"],
  PENDING: [
    "PENDING",
    "AUTHORIZED",
    "CAPTURED",
    "FAILED",
    "CANCELLED",
    "REQUIRES_RECONCILIATION",
  ],
  AUTHORIZED: [
    "AUTHORIZED",
    "CAPTURED",
    "FAILED",
    "CANCELLED",
    "REQUIRES_RECONCILIATION",
  ],
  CAPTURED: ["CAPTURED"],
  FAILED: ["FAILED"],
  CANCELLED: ["CANCELLED"],
  REQUIRES_RECONCILIATION: [
    "REQUIRES_RECONCILIATION",
    "AUTHORIZED",
    "CAPTURED",
    "FAILED",
    "CANCELLED",
  ],
};

export const VALID_REFUND_TRANSITIONS: Record<
  RefundStatus,
  readonly RefundStatus[]
> = {
  PENDING: ["PENDING", "PROCESSING", "SUCCEEDED", "FAILED", "REQUIRES_RECONCILIATION"],
  PROCESSING: ["PROCESSING", "SUCCEEDED", "FAILED", "REQUIRES_RECONCILIATION"],
  REQUIRES_RECONCILIATION: [
    "REQUIRES_RECONCILIATION",
    "SUCCEEDED",
    "FAILED",
  ],
  SUCCEEDED: ["SUCCEEDED"],
  FAILED: ["FAILED"],
};

export function isValidPaymentTransition(
  fromStatus: PaymentStatus,
  toStatus: PaymentStatus,
): boolean {
  if (fromStatus === toStatus) {
    return true;
  }
  const allowed = VALID_PAYMENT_TRANSITIONS[fromStatus] ?? [];
  return allowed.includes(toStatus);
}

export function assertValidPaymentTransition(
  fromStatus: PaymentStatus,
  toStatus: PaymentStatus,
): void {
  if (!isValidPaymentTransition(fromStatus, toStatus)) {
    throw new InvalidPaymentStateTransitionError(fromStatus, toStatus);
  }
}

export function isValidPaymentAttemptTransition(
  fromStatus: PaymentAttemptStatus,
  toStatus: PaymentAttemptStatus,
): boolean {
  if (fromStatus === toStatus) {
    return true;
  }
  const allowed = VALID_PAYMENT_ATTEMPT_TRANSITIONS[fromStatus] ?? [];
  return allowed.includes(toStatus);
}

export function assertValidPaymentAttemptTransition(
  fromStatus: PaymentAttemptStatus,
  toStatus: PaymentAttemptStatus,
): void {
  if (!isValidPaymentAttemptTransition(fromStatus, toStatus)) {
    throw new InvalidPaymentAttemptStateTransitionError(fromStatus, toStatus);
  }
}

export function isValidRefundTransition(
  fromStatus: RefundStatus,
  toStatus: RefundStatus,
): boolean {
  if (fromStatus === toStatus) {
    return true;
  }
  const allowed = VALID_REFUND_TRANSITIONS[fromStatus] ?? [];
  return allowed.includes(toStatus);
}

export function assertValidRefundTransition(
  fromStatus: RefundStatus,
  toStatus: RefundStatus,
): void {
  if (!isValidRefundTransition(fromStatus, toStatus)) {
    throw new InvalidRefundStateTransitionError(fromStatus, toStatus);
  }
}

export function isTerminalPaymentStatus(status: PaymentStatus): boolean {
  return status === "REFUNDED" || status === "FAILED" || status === "CANCELLED";
}

export function isRefundablePaymentStatus(status: PaymentStatus): boolean {
  return status === "CAPTURED" || status === "PARTIALLY_REFUNDED";
}
