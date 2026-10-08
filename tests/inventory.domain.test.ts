import { describe, expect, it } from "vitest";
import {
  ADJUSTMENT_REASONS,
  RESERVATION_STATUSES,
  assertValidReservationTransition,
  calculateTotalQuantity,
  isTerminalReservationStatus,
  isValidReservationTransition,
  validateAdjustmentReason,
  validatePositiveQuantity,
  validateQuantity,
  validateQuantityDelta,
  validateReference,
  validateReservationStatus,
  InvalidAdjustmentReasonError,
  InvalidInventoryQuantityError,
  InvalidReservationStateTransitionError,
  type AdjustmentReason,
  type ReservationStatus,
} from "@shopify-clone/inventory";

describe("Inventory Domain Logic", () => {
  describe("Quantity Invariants & Validation", () => {
    it("accepts valid non-negative whole integer quantities", () => {
      expect(validateQuantity(0)).toBe(0);
      expect(validateQuantity(1)).toBe(1);
      expect(validateQuantity(50)).toBe(50);
      expect(validateQuantity(100_000)).toBe(100_000);
    });

    it("rejects floating-point numbers to protect whole unit inventory semantics", () => {
      expect(() => validateQuantity(1.5)).toThrow(InvalidInventoryQuantityError);
      expect(() => validateQuantity(0.001)).toThrow(InvalidInventoryQuantityError);
      expect(() => validateQuantity(99.99)).toThrow(InvalidInventoryQuantityError);
    });

    it("rejects negative quantities", () => {
      expect(() => validateQuantity(-1)).toThrow(InvalidInventoryQuantityError);
      expect(() => validateQuantity(-100)).toThrow(InvalidInventoryQuantityError);
    });

    it("rejects non-numeric, NaN, and infinite values", () => {
      expect(() => validateQuantity("10")).toThrow(InvalidInventoryQuantityError);
      expect(() => validateQuantity(null)).toThrow(InvalidInventoryQuantityError);
      expect(() => validateQuantity(undefined)).toThrow(InvalidInventoryQuantityError);
      expect(() => validateQuantity(NaN)).toThrow(InvalidInventoryQuantityError);
      expect(() => validateQuantity(Infinity)).toThrow(InvalidInventoryQuantityError);
    });
  });

  describe("Positive Quantity Validation (Reservations)", () => {
    it("accepts strictly positive integers", () => {
      expect(validatePositiveQuantity(1)).toBe(1);
      expect(validatePositiveQuantity(10)).toBe(10);
    });

    it("rejects zero and negative numbers for reservations", () => {
      expect(() => validatePositiveQuantity(0)).toThrow(InvalidInventoryQuantityError);
      expect(() => validatePositiveQuantity(-5)).toThrow(InvalidInventoryQuantityError);
    });

    it("rejects floating point values for reservations", () => {
      expect(() => validatePositiveQuantity(2.5)).toThrow(InvalidInventoryQuantityError);
    });
  });

  describe("Quantity Delta Validation (Adjustments)", () => {
    it("accepts non-zero positive and negative whole integers", () => {
      expect(validateQuantityDelta(50)).toBe(50);
      expect(validateQuantityDelta(-20)).toBe(-20);
      expect(validateQuantityDelta(1)).toBe(1);
      expect(validateQuantityDelta(-1)).toBe(-1);
    });

    it("rejects zero delta", () => {
      expect(() => validateQuantityDelta(0)).toThrow(InvalidInventoryQuantityError);
    });

    it("rejects floating-point deltas and invalid types", () => {
      expect(() => validateQuantityDelta(1.5)).toThrow(InvalidInventoryQuantityError);
      expect(() => validateQuantityDelta(-0.5)).toThrow(InvalidInventoryQuantityError);
      expect(() => validateQuantityDelta("10")).toThrow(InvalidInventoryQuantityError);
      expect(() => validateQuantityDelta(NaN)).toThrow(InvalidInventoryQuantityError);
    });
  });

  describe("Adjustment Reason Validation", () => {
    it("accepts all documented adjustment reasons", () => {
      const expectedReasons: AdjustmentReason[] = [
        "INITIAL_STOCK",
        "RESTOCK",
        "MANUAL_CORRECTION",
        "DAMAGED",
        "LOST",
        "RETURNED",
        "OTHER",
      ];

      for (const reason of expectedReasons) {
        expect(validateAdjustmentReason(reason)).toBe(reason);
      }
      expect(ADJUSTMENT_REASONS).toEqual(expectedReasons);
    });

    it("rejects invalid or undocumented adjustment reasons", () => {
      expect(() => validateAdjustmentReason("UNKNOWN")).toThrow(InvalidAdjustmentReasonError);
      expect(() => validateAdjustmentReason("THEFT")).toThrow(InvalidAdjustmentReasonError);
      expect(() => validateAdjustmentReason("")).toThrow(InvalidAdjustmentReasonError);
      expect(() => validateAdjustmentReason(123)).toThrow(InvalidAdjustmentReasonError);
      expect(() => validateAdjustmentReason(null)).toThrow(InvalidAdjustmentReasonError);
    });
  });

  describe("Reservation Status & Lifecycle State Transitions", () => {
    it("contains exactly documented reservation statuses", () => {
      const expectedStatuses: ReservationStatus[] = ["ACTIVE", "RELEASED", "COMMITTED"];
      expect(RESERVATION_STATUSES).toEqual(expectedStatuses);
      for (const status of expectedStatuses) {
        expect(validateReservationStatus(status)).toBe(status);
      }
      expect(() => validateReservationStatus("CANCELLED")).toThrow("Invalid reservation status");
    });

    it("allows legal lifecycle transitions from ACTIVE", () => {
      expect(isValidReservationTransition("ACTIVE", "RELEASED")).toBe(true);
      expect(isValidReservationTransition("ACTIVE", "COMMITTED")).toBe(true);
      expect(() => assertValidReservationTransition("ACTIVE", "RELEASED")).not.toThrow();
      expect(() => assertValidReservationTransition("ACTIVE", "COMMITTED")).not.toThrow();
    });

    it("allows idempotent transitions to the same state", () => {
      expect(isValidReservationTransition("ACTIVE", "ACTIVE")).toBe(true);
      expect(isValidReservationTransition("RELEASED", "RELEASED")).toBe(true);
      expect(isValidReservationTransition("COMMITTED", "COMMITTED")).toBe(true);
      expect(() => assertValidReservationTransition("RELEASED", "RELEASED")).not.toThrow();
    });

    it("rejects transitions from terminal states", () => {
      // RELEASED cannot transition to COMMITTED or back to ACTIVE
      expect(isValidReservationTransition("RELEASED", "COMMITTED")).toBe(false);
      expect(isValidReservationTransition("RELEASED", "ACTIVE")).toBe(false);
      expect(() => assertValidReservationTransition("RELEASED", "COMMITTED")).toThrow(
        InvalidReservationStateTransitionError,
      );
      expect(() => assertValidReservationTransition("RELEASED", "ACTIVE")).toThrow(
        InvalidReservationStateTransitionError,
      );

      // COMMITTED cannot transition to RELEASED or back to ACTIVE
      expect(isValidReservationTransition("COMMITTED", "RELEASED")).toBe(false);
      expect(isValidReservationTransition("COMMITTED", "ACTIVE")).toBe(false);
      expect(() => assertValidReservationTransition("COMMITTED", "RELEASED")).toThrow(
        InvalidReservationStateTransitionError,
      );
      expect(() => assertValidReservationTransition("COMMITTED", "ACTIVE")).toThrow(
        InvalidReservationStateTransitionError,
      );
    });

    it("correctly identifies terminal reservation statuses", () => {
      expect(isTerminalReservationStatus("ACTIVE")).toBe(false);
      expect(isTerminalReservationStatus("RELEASED")).toBe(true);
      expect(isTerminalReservationStatus("COMMITTED")).toBe(true);
    });
  });

  describe("Reference String Validation", () => {
    it("accepts non-empty trimmed references", () => {
      expect(validateReference("checkout-12345")).toBe("checkout-12345");
      expect(validateReference("  order-999  ")).toBe("order-999");
    });

    it("rejects empty, non-string, or overly long references", () => {
      expect(() => validateReference("")).toThrow("cannot be empty");
      expect(() => validateReference("   ")).toThrow("cannot be empty");
      expect(() => validateReference(123)).toThrow("must be a string");
      expect(() => validateReference("a".repeat(256))).toThrow("cannot exceed 255 characters");
    });
  });

  describe("Stock Calculations", () => {
    it("correctly calculates total managed stock as available + reserved", () => {
      expect(calculateTotalQuantity(10, 5)).toBe(15);
      expect(calculateTotalQuantity(0, 0)).toBe(0);
      expect(calculateTotalQuantity(100, 0)).toBe(100);
      expect(calculateTotalQuantity(0, 50)).toBe(50);
    });

    it("rejects invalid inputs when calculating total quantity", () => {
      expect(() => calculateTotalQuantity(-5, 10)).toThrow(InvalidInventoryQuantityError);
      expect(() => calculateTotalQuantity(10, -1)).toThrow(InvalidInventoryQuantityError);
      expect(() => calculateTotalQuantity(1.5, 2)).toThrow(InvalidInventoryQuantityError);
    });
  });
});
