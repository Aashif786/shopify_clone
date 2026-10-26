export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";
export type DiscountStatus = "DRAFT" | "ACTIVE" | "DISABLED" | "EXPIRED";

export type DiscountValidationReason =
  | "DISCOUNT_NOT_FOUND"
  | "DISCOUNT_INACTIVE"
  | "DISCOUNT_EXPIRED"
  | "INVALID_CODE"
  | "MINIMUM_AMOUNT_NOT_MET"
  | "USAGE_LIMIT_REACHED"
  | "CURRENCY_MISMATCH"
  | "CROSS_STORE_ACCESS"
  | "INELIGIBLE_CUSTOMER"
  | "NO_ELIGIBLE_PRODUCTS";

export const VALID_DISCOUNT_TYPES: readonly DiscountType[] = [
  "PERCENTAGE",
  "FIXED_AMOUNT",
] as const;

export const VALID_DISCOUNT_STATUSES: readonly DiscountStatus[] = [
  "DRAFT",
  "ACTIVE",
  "DISABLED",
  "EXPIRED",
] as const;

export function isValidDiscountType(type: unknown): type is DiscountType {
  return typeof type === "string" && VALID_DISCOUNT_TYPES.includes(type as DiscountType);
}

export function isValidDiscountStatus(status: unknown): status is DiscountStatus {
  return typeof status === "string" && VALID_DISCOUNT_STATUSES.includes(status as DiscountStatus);
}
