import type { DiscountType, DiscountValidationReason } from "./discount-state.js";
import { InvalidDiscountCodeError } from "./discount-errors.js";

export interface AppliedDiscountDTO {
  code: string;
  name: string;
  type: DiscountType;
  value: number;
  amount: number;
  currency?: string;
  description?: string;
}

export interface DiscountValidationResult {
  isValid: boolean;
  code: string;
  discount?: AppliedDiscountDTO;
  reason?: DiscountValidationReason;
  errorMessage?: string;
}

export interface DiscountPolicyInput {
  storeId: string;
  code: string;
  name: string;
  type: DiscountType;
  value: number;
  currency?: string | null;
  status: string;
  minimumSubtotal?: number;
  maxDiscountAmount?: number | null;
  usageLimit?: number | null;
  usageCount: number;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
}

export interface DiscountEvaluationContext {
  targetStoreId: string;
  subtotal: number;
  currency: string;
  now?: Date;
}

/**
 * Normalizes discount code string: trims whitespace and converts to uppercase.
 */
export function normalizeDiscountCode(code: string | null | undefined): string {
  if (!code || typeof code !== "string") return "";
  return code.trim().toUpperCase();
}

/**
 * Validates discount code format: must be non-empty, between 1 and 64 characters,
 * containing only uppercase alphanumeric characters, hyphens, and underscores.
 */
export function validateDiscountCodeFormat(code: string): void {
  const normalized = normalizeDiscountCode(code);
  if (!normalized || normalized.length === 0) {
    throw new InvalidDiscountCodeError("Discount code cannot be empty");
  }
  if (normalized.length > 64) {
    throw new InvalidDiscountCodeError("Discount code must not exceed 64 characters");
  }
  if (!/^[A-Z0-9_-]+$/.test(normalized)) {
    throw new InvalidDiscountCodeError(
      "Discount code must only contain letters, numbers, hyphens, and underscores",
    );
  }
}

/**
 * Calculates discount amount in integer minor units (cents).
 * Uses integer math (floored) to avoid floating-point errors.
 * Never reduces total below zero and never exceeds qualifying subtotal.
 */
export function calculateDiscountAmount(
  type: DiscountType,
  value: number,
  subtotal: number,
  maxDiscount?: number | null,
): number {
  if (subtotal <= 0 || value <= 0) return 0;

  let rawDiscount = 0;
  if (type === "PERCENTAGE") {
    rawDiscount = Math.floor((subtotal * value) / 100);
  } else if (type === "FIXED_AMOUNT") {
    rawDiscount = Math.floor(value);
  }

  if (maxDiscount !== undefined && maxDiscount !== null && maxDiscount > 0) {
    rawDiscount = Math.min(rawDiscount, maxDiscount);
  }

  // Cap discount at subtotal to prevent negative totals
  return Math.min(rawDiscount, subtotal);
}

/**
 * Evaluates discount policy rules against server-authoritative store context and subtotal.
 */
export function evaluateDiscountPolicy(
  discount: DiscountPolicyInput | null | undefined,
  context: DiscountEvaluationContext,
): DiscountValidationResult {
  const now = context.now ?? new Date();

  if (!discount) {
    return {
      isValid: false,
      code: "",
      reason: "DISCOUNT_NOT_FOUND",
      errorMessage: "Discount code not found for this store",
    };
  }

  const normalizedCode = normalizeDiscountCode(discount.code);

  // 1. Tenant boundary enforcement: Store A discount cannot be applied in Store B
  if (discount.storeId !== context.targetStoreId) {
    return {
      isValid: false,
      code: normalizedCode,
      reason: "DISCOUNT_NOT_FOUND",
      errorMessage: "Discount code not found for this store",
    };
  }

  // 2. Status checks
  if (discount.status === "EXPIRED") {
    return {
      isValid: false,
      code: normalizedCode,
      reason: "DISCOUNT_EXPIRED",
      errorMessage: "Discount code has expired",
    };
  }

  if (discount.status !== "ACTIVE") {
    return {
      isValid: false,
      code: normalizedCode,
      reason: "DISCOUNT_INACTIVE",
      errorMessage: "Discount code is currently inactive",
    };
  }

  // 3. Time validity window
  if (discount.startsAt) {
    const startsAtDate = discount.startsAt instanceof Date ? discount.startsAt : new Date(discount.startsAt);
    if (startsAtDate > now) {
      return {
        isValid: false,
        code: normalizedCode,
        reason: "DISCOUNT_INACTIVE",
        errorMessage: "Discount code has not started yet",
      };
    }
  }

  if (discount.endsAt) {
    const endsAtDate = discount.endsAt instanceof Date ? discount.endsAt : new Date(discount.endsAt);
    if (endsAtDate <= now) {
      return {
        isValid: false,
        code: normalizedCode,
        reason: "DISCOUNT_EXPIRED",
        errorMessage: "Discount code has expired",
      };
    }
  }

  // 4. Currency compatibility for fixed-amount discounts
  if (discount.type === "FIXED_AMOUNT" && discount.currency) {
    if (discount.currency.toUpperCase() !== context.currency.toUpperCase()) {
      return {
        isValid: false,
        code: normalizedCode,
        reason: "CURRENCY_MISMATCH",
        errorMessage: `Discount currency (${discount.currency}) does not match cart currency (${context.currency})`,
      };
    }
  }

  // 5. Usage limit check
  if (
    discount.usageLimit !== undefined &&
    discount.usageLimit !== null &&
    discount.usageLimit > 0 &&
    discount.usageCount >= discount.usageLimit
  ) {
    return {
      isValid: false,
      code: normalizedCode,
      reason: "USAGE_LIMIT_REACHED",
      errorMessage: "Discount code usage limit has been reached",
    };
  }

  // 6. Minimum subtotal check
  if (
    discount.minimumSubtotal !== undefined &&
    discount.minimumSubtotal !== null &&
    discount.minimumSubtotal > 0 &&
    context.subtotal < discount.minimumSubtotal
  ) {
    const formattedMin = (discount.minimumSubtotal / 100).toFixed(2);
    return {
      isValid: false,
      code: normalizedCode,
      reason: "MINIMUM_AMOUNT_NOT_MET",
      errorMessage: `Minimum subtotal of $${formattedMin} is required for this discount`,
    };
  }

  // 7. Calculate bounded discount amount
  const amount = calculateDiscountAmount(
    discount.type,
    discount.value,
    context.subtotal,
    discount.maxDiscountAmount,
  );

  return {
    isValid: true,
    code: normalizedCode,
    discount: {
      code: normalizedCode,
      name: discount.name,
      type: discount.type,
      value: discount.value,
      amount,
      currency: context.currency,
    },
  };
}
