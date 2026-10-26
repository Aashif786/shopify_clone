export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";
export type DiscountStatus = "DRAFT" | "ACTIVE" | "DISABLED" | "EXPIRED";

export interface MerchantDiscountDTO {
  id: string;
  storeId: string;
  code: string;
  name: string;
  description: string | null;
  type: DiscountType;
  value: number; // percentage (1-100) or cents (e.g. 2000 for $20.00)
  currency: string | null;
  status: DiscountStatus;
  minimumSubtotal: number; // cents
  maxDiscountAmount: number | null; // cents
  usageLimit: number | null;
  usageCount: number;
  appliesToFirstTimeCustomer?: boolean;
  eligibleProductIds?: string[];
  eligibleCollectionIds?: string[];
  eligibleCategoryIds?: string[];
  eligibleProductTypeIds?: string[];
  eligibleTagIds?: string[];
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiscountFormData {
  code: string;
  name: string;
  description: string;
  type: DiscountType;
  value: string; // "10" or "20.00"
  currency: string;
  status: DiscountStatus;
  minimumSubtotal: string; // "50.00"
  maxDiscountAmount: string; // "25.00"
  usageLimit: string; // "100"
  appliesToFirstTimeCustomer: boolean;
  eligibleProductIds: string[];
  eligibleCollectionIds: string[];
  eligibleCategoryIds: string[];
  eligibleProductTypeIds: string[];
  eligibleTagIds: string[];
  startsAt: string; // "YYYY-MM-DD" or ISO
  endsAt: string; // "YYYY-MM-DD" or ISO
}

/**
 * Normalizes customer or merchant entered discount code: trims whitespace and converts to uppercase.
 */
export function normalizeDiscountCode(code: string | null | undefined): string {
  if (!code || typeof code !== "string") return "";
  return code.trim().toUpperCase();
}

/**
 * Formats discount value for display (e.g. "15% off" or "$20.00 off").
 */
export function formatDiscountValue(
  type: DiscountType,
  value: number,
  currency?: string | null,
): string {
  if (type === "PERCENTAGE") {
    return `${value}% off`;
  }
  const curr = currency ? currency.toUpperCase() : "USD";
  const formatted = (value / 100).toFixed(2);
  return curr === "USD" ? `$${formatted} off` : `${formatted} ${curr} off`;
}

/**
 * Formats minimum spend condition (e.g. "No minimum" or "Min spend $50.00").
 */
export function formatDiscountSpend(
  minimumSubtotal?: number | null,
  currency?: string | null,
): string {
  if (!minimumSubtotal || minimumSubtotal <= 0) {
    return "No minimum";
  }
  const curr = currency ? currency.toUpperCase() : "USD";
  const formatted = (minimumSubtotal / 100).toFixed(2);
  return curr === "USD" ? `Min spend $${formatted}` : `Min spend ${formatted} ${curr}`;
}

/**
 * Formats usage statistics (e.g. "5 / 100 used" or "12 used (Unlimited)").
 */
export function formatDiscountUsage(
  usageCount: number,
  usageLimit?: number | null,
): string {
  if (usageLimit !== null && usageLimit !== undefined && usageLimit > 0) {
    return `${usageCount} / ${usageLimit} used`;
  }
  return `${usageCount} used (Unlimited)`;
}

/**
 * Formats date validity window for display.
 */
export function formatDiscountValidity(
  startsAt?: string | null,
  endsAt?: string | null,
): string {
  if (!startsAt && !endsAt) {
    return "Always active";
  }
  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return iso;
    }
  };

  if (startsAt && endsAt) {
    return `${formatDate(startsAt)} – ${formatDate(endsAt)}`;
  }
  if (startsAt) {
    return `From ${formatDate(startsAt)}`;
  }
  return `Until ${formatDate(endsAt!)}`;
}

/**
 * Validates discount form data client-side before submission.
 */
export function validateDiscountFormData(data: DiscountFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  const normalizedCode = normalizeDiscountCode(data.code);
  if (!normalizedCode) {
    errors.code = "Discount code is required";
  } else if (normalizedCode.length > 64) {
    errors.code = "Discount code cannot exceed 64 characters";
  } else if (!/^[A-Z0-9_-]+$/.test(normalizedCode)) {
    errors.code = "Discount code must contain only letters, numbers, hyphens, and underscores";
  }

  if (!data.name.trim()) {
    errors.name = "Discount name is required";
  } else if (data.name.trim().length > 255) {
    errors.name = "Discount name cannot exceed 255 characters";
  }

  if (!data.value.trim()) {
    errors.value = "Discount value is required";
  } else {
    const val = Number(data.value);
    if (isNaN(val) || val <= 0) {
      errors.value = "Value must be a positive number";
    } else if (data.type === "PERCENTAGE") {
      if (!Number.isInteger(val) || val < 1 || val > 100) {
        errors.value = "Percentage discount must be an integer between 1 and 100";
      }
    }
  }

  if (data.type === "FIXED_AMOUNT") {
    if (!data.currency.trim()) {
      errors.currency = "Currency is required for fixed amount discounts";
    } else if (data.currency.trim().length !== 3) {
      errors.currency = "Currency must be a 3-letter code (e.g. USD)";
    }
  }

  if (data.minimumSubtotal.trim()) {
    const min = Number(data.minimumSubtotal);
    if (isNaN(min) || min < 0) {
      errors.minimumSubtotal = "Minimum subtotal must be a non-negative number";
    }
  }

  if (data.maxDiscountAmount.trim()) {
    const max = Number(data.maxDiscountAmount);
    if (isNaN(max) || max <= 0) {
      errors.maxDiscountAmount = "Max discount amount must be a positive number";
    }
  }

  if (data.usageLimit.trim()) {
    const limit = Number(data.usageLimit);
    if (isNaN(limit) || !Number.isInteger(limit) || limit <= 0) {
      errors.usageLimit = "Usage limit must be a positive integer";
    }
  }

  if (data.startsAt && data.endsAt) {
    const start = new Date(data.startsAt);
    const end = new Date(data.endsAt);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end <= start) {
      errors.endsAt = "End date must be after start date";
    }
  }

  return errors;
}

/**
 * Converts form data to API payload (translating currency values to integer cents).
 */
export function formDataToPayload(data: DiscountFormData) {
  const code = normalizeDiscountCode(data.code);
  const isPercentage = data.type === "PERCENTAGE";

  let valueInUnits = 0;
  if (isPercentage) {
    valueInUnits = Math.round(Number(data.value));
  } else {
    // Fixed amount: convert dollars to cents
    valueInUnits = Math.round(Number(data.value) * 100);
  }

  let minimumSubtotalCents = 0;
  if (data.minimumSubtotal.trim()) {
    minimumSubtotalCents = Math.round(Number(data.minimumSubtotal) * 100);
  }

  let maxDiscountAmountCents: number | null = null;
  if (isPercentage && data.maxDiscountAmount.trim()) {
    maxDiscountAmountCents = Math.round(Number(data.maxDiscountAmount) * 100);
  }

  let usageLimitNum: number | null = null;
  if (data.usageLimit.trim()) {
    usageLimitNum = Math.round(Number(data.usageLimit));
  }

  return {
    code,
    name: data.name.trim(),
    description: data.description.trim() ? data.description.trim() : null,
    type: data.type,
    value: valueInUnits,
    currency: isPercentage ? null : data.currency.trim().toUpperCase(),
    status: data.status,
    minimumSubtotal: minimumSubtotalCents,
    maxDiscountAmount: maxDiscountAmountCents,
    usageLimit: usageLimitNum,
    appliesToFirstTimeCustomer: data.appliesToFirstTimeCustomer,
    eligibleProductIds: data.eligibleProductIds,
    eligibleCollectionIds: data.eligibleCollectionIds,
    eligibleCategoryIds: data.eligibleCategoryIds,
    eligibleProductTypeIds: data.eligibleProductTypeIds,
    eligibleTagIds: data.eligibleTagIds,
    startsAt: data.startsAt ? new Date(data.startsAt).toISOString() : null,
    endsAt: data.endsAt ? new Date(data.endsAt).toISOString() : null,
  };
}

/**
 * Converts existing Discount DTO into form state for the edit form.
 */
export function discountToFormData(discount: MerchantDiscountDTO): DiscountFormData {
  const isPercentage = discount.type === "PERCENTAGE";
  const valueStr = isPercentage
    ? String(discount.value)
    : (discount.value / 100).toFixed(2);

  const minSubtotalStr =
    discount.minimumSubtotal > 0 ? (discount.minimumSubtotal / 100).toFixed(2) : "";

  const maxDiscountStr =
    discount.maxDiscountAmount !== null && discount.maxDiscountAmount > 0
      ? (discount.maxDiscountAmount / 100).toFixed(2)
      : "";

  const toDateInputString = (iso?: string | null): string => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      return d.toISOString().split("T")[0] ?? "";
    } catch {
      return "";
    }
  };

  return {
    code: discount.code,
    name: discount.name,
    description: discount.description ?? "",
    type: discount.type,
    value: valueStr,
    currency: discount.currency ?? "USD",
    status: discount.status,
    minimumSubtotal: minSubtotalStr,
    maxDiscountAmount: maxDiscountStr,
    usageLimit: discount.usageLimit ? String(discount.usageLimit) : "",
    appliesToFirstTimeCustomer: Boolean(discount.appliesToFirstTimeCustomer),
    eligibleProductIds: discount.eligibleProductIds ?? [],
    eligibleCollectionIds: discount.eligibleCollectionIds ?? [],
    eligibleCategoryIds: discount.eligibleCategoryIds ?? [],
    eligibleProductTypeIds: discount.eligibleProductTypeIds ?? [],
    eligibleTagIds: discount.eligibleTagIds ?? [],
    startsAt: toDateInputString(discount.startsAt),
    endsAt: toDateInputString(discount.endsAt),
  };
}
