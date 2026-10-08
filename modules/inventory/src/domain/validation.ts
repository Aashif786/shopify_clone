import type { AdjustmentReason, ReservationStatus } from "./entities.js";
import {
  InvalidAdjustmentReasonError,
  InvalidInventoryQuantityError,
} from "./errors.js";

export const ADJUSTMENT_REASONS: readonly AdjustmentReason[] = [
  "INITIAL_STOCK",
  "RESTOCK",
  "MANUAL_CORRECTION",
  "DAMAGED",
  "LOST",
  "RETURNED",
  "OTHER",
] as const;

export const RESERVATION_STATUSES: readonly ReservationStatus[] = [
  "ACTIVE",
  "RELEASED",
  "COMMITTED",
] as const;

export function validateQuantity(
  quantity: unknown,
  fieldName = "Quantity",
): number {
  if (
    typeof quantity !== "number" ||
    !Number.isInteger(quantity) ||
    Number.isNaN(quantity) ||
    !Number.isFinite(quantity)
  ) {
    throw new InvalidInventoryQuantityError(
      `${fieldName} must be a whole integer`,
      { field: fieldName, value: quantity },
    );
  }

  if (quantity < 0) {
    throw new InvalidInventoryQuantityError(
      `${fieldName} cannot be negative`,
      { field: fieldName, value: quantity },
    );
  }

  return quantity;
}

export function validatePositiveQuantity(
  quantity: unknown,
  fieldName = "Quantity",
): number {
  const validated = validateQuantity(quantity, fieldName);
  if (validated <= 0) {
    throw new InvalidInventoryQuantityError(
      `${fieldName} must be greater than zero`,
      { field: fieldName, value: quantity },
    );
  }
  return validated;
}

export function validateQuantityDelta(delta: unknown): number {
  if (
    typeof delta !== "number" ||
    !Number.isInteger(delta) ||
    Number.isNaN(delta) ||
    !Number.isFinite(delta)
  ) {
    throw new InvalidInventoryQuantityError(
      "Adjustment quantity delta must be a non-zero whole integer",
      { field: "quantityDelta", value: delta },
    );
  }

  if (delta === 0) {
    throw new InvalidInventoryQuantityError(
      "Adjustment quantity delta cannot be zero",
      { field: "quantityDelta", value: delta },
    );
  }

  return delta;
}

export function validateAdjustmentReason(reason: unknown): AdjustmentReason {
  if (typeof reason !== "string") {
    throw new InvalidAdjustmentReasonError(reason);
  }
  const match = ADJUSTMENT_REASONS.find((r) => r === reason);
  if (!match) {
    throw new InvalidAdjustmentReasonError(reason);
  }
  return match;
}

export function validateReservationStatus(status: unknown): ReservationStatus {
  if (typeof status !== "string") {
    throw new Error("Reservation status must be a string");
  }
  const match = RESERVATION_STATUSES.find((s) => s === status);
  if (!match) {
    throw new Error(`Invalid reservation status '${status}'`);
  }
  return match;
}

export function validateReference(
  reference: unknown,
  fieldName = "Reference",
): string {
  if (typeof reference !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }
  const trimmed = reference.trim();
  if (trimmed.length === 0) {
    throw new Error(`${fieldName} cannot be empty`);
  }
  if (trimmed.length > 255) {
    throw new Error(`${fieldName} cannot exceed 255 characters`);
  }
  return trimmed;
}

export function calculateTotalQuantity(
  availableQuantity: number,
  reservedQuantity: number,
): number {
  const avail = validateQuantity(availableQuantity, "Available quantity");
  const res = validateQuantity(reservedQuantity, "Reserved quantity");
  return avail + res;
}
