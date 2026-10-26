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
  appliesToFirstTimeCustomer?: boolean;
  eligibleProductIds?: string[];
  eligibleCollectionIds?: string[];
  eligibleCategoryIds?: string[];
  eligibleProductTypeIds?: string[];
  eligibleTagIds?: string[];
}

export interface DiscountEvaluationItem {
  id?: string;
  productId: string;
  typeId?: string | null;
  categoryId?: string | null;
  collectionIds?: string[];
  tagIds?: string[];
  price: number;
  quantity: number;
}

export interface DiscountEvaluationContext {
  targetStoreId: string;
  subtotal: number;
  currency: string;
  now?: Date;
  isFirstTimeCustomer?: boolean;
  items?: DiscountEvaluationItem[];
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

  // 6. First-time customer check
  if (discount.appliesToFirstTimeCustomer) {
    if (context.isFirstTimeCustomer === false) {
      return {
        isValid: false,
        code: normalizedCode,
        reason: "INELIGIBLE_CUSTOMER",
        errorMessage: "This discount is only available for first-time customers",
      };
    }
  }

  // 7. Product / Category / Type / Tag / Collection restrictions
  const hasRestrictions = Boolean(
    (discount.eligibleProductIds && discount.eligibleProductIds.length > 0) ||
    (discount.eligibleProductTypeIds && discount.eligibleProductTypeIds.length > 0) ||
    (discount.eligibleCategoryIds && discount.eligibleCategoryIds.length > 0) ||
    (discount.eligibleTagIds && discount.eligibleTagIds.length > 0) ||
    (discount.eligibleCollectionIds && discount.eligibleCollectionIds.length > 0)
  );

  let eligibleSubtotal = context.subtotal;

  if (hasRestrictions && context.items && context.items.length > 0) {
    const eligibleItems = context.items.filter((item) => {
      if (
        discount.eligibleProductIds &&
        discount.eligibleProductIds.length > 0 &&
        discount.eligibleProductIds.includes(item.productId)
      ) {
        return true;
      }
      if (
        item.typeId &&
        discount.eligibleProductTypeIds &&
        discount.eligibleProductTypeIds.length > 0 &&
        discount.eligibleProductTypeIds.includes(item.typeId)
      ) {
        return true;
      }
      if (
        item.categoryId &&
        discount.eligibleCategoryIds &&
        discount.eligibleCategoryIds.length > 0 &&
        discount.eligibleCategoryIds.includes(item.categoryId)
      ) {
        return true;
      }
      if (
        item.tagIds &&
        discount.eligibleTagIds &&
        discount.eligibleTagIds.length > 0 &&
        item.tagIds.some((t) => discount.eligibleTagIds!.includes(t))
      ) {
        return true;
      }
      if (
        item.collectionIds &&
        discount.eligibleCollectionIds &&
        discount.eligibleCollectionIds.length > 0 &&
        item.collectionIds.some((c) => discount.eligibleCollectionIds!.includes(c))
      ) {
        return true;
      }
      return false;
    });

    if (eligibleItems.length === 0) {
      return {
        isValid: false,
        code: normalizedCode,
        reason: "NO_ELIGIBLE_PRODUCTS",
        errorMessage: "This discount code is not applicable to any items in your cart",
      };
    }

    eligibleSubtotal = eligibleItems.reduce((acc, it) => acc + it.price * it.quantity, 0);
  }

  // 8. Minimum subtotal check (evaluates against eligible subtotal if restricted, else full subtotal)
  if (
    discount.minimumSubtotal !== undefined &&
    discount.minimumSubtotal !== null &&
    discount.minimumSubtotal > 0 &&
    eligibleSubtotal < discount.minimumSubtotal
  ) {
    const formattedMin = (discount.minimumSubtotal / 100).toFixed(2);
    return {
      isValid: false,
      code: normalizedCode,
      reason: "MINIMUM_AMOUNT_NOT_MET",
      errorMessage: `Minimum subtotal of $${formattedMin} is required for this discount`,
    };
  }

  // 9. Calculate bounded discount amount on eligible subtotal
  const amount = calculateDiscountAmount(
    discount.type,
    discount.value,
    eligibleSubtotal,
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
