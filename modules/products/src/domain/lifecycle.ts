import type { ProductStatus, VariantStatus } from "./entities.js";
import { InvalidProductStateTransitionError } from "./errors.js";

export const VALID_PRODUCT_TRANSITIONS: Record<
  ProductStatus,
  readonly ProductStatus[]
> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["DRAFT", "ARCHIVED"],
  ARCHIVED: ["DRAFT"],
};

export function isValidProductTransition(
  fromStatus: ProductStatus,
  toStatus: ProductStatus,
): boolean {
  if (fromStatus === toStatus) {
    return true;
  }
  const allowed = VALID_PRODUCT_TRANSITIONS[fromStatus] ?? [];
  return allowed.includes(toStatus);
}

export function assertValidProductTransition(
  fromStatus: ProductStatus,
  toStatus: ProductStatus,
): void {
  if (!isValidProductTransition(fromStatus, toStatus)) {
    throw new InvalidProductStateTransitionError(fromStatus, toStatus);
  }
}

export const VALID_VARIANT_TRANSITIONS: Record<
  VariantStatus,
  readonly VariantStatus[]
> = {
  ACTIVE: ["INACTIVE", "ARCHIVED"],
  INACTIVE: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: ["ACTIVE", "INACTIVE"],
};

export function isValidVariantTransition(
  fromStatus: VariantStatus,
  toStatus: VariantStatus,
): boolean {
  if (fromStatus === toStatus) {
    return true;
  }
  const allowed = VALID_VARIANT_TRANSITIONS[fromStatus] ?? [];
  return allowed.includes(toStatus);
}

export function assertValidVariantTransition(
  fromStatus: VariantStatus,
  toStatus: VariantStatus,
): void {
  if (!isValidVariantTransition(fromStatus, toStatus)) {
    throw new InvalidProductStateTransitionError(fromStatus, toStatus);
  }
}
