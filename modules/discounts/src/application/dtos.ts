import type { DiscountType, DiscountStatus } from "../domain/discount-state.js";
import type { Discount } from "../domain/discount.js";
import type { DiscountRedemption } from "../infrastructure/discount-repository.js";

export interface CreateDiscountDTO {
  id?: string;
  code: string;
  name: string;
  description?: string | null;
  type: DiscountType;
  value: number;
  currency?: string | null;
  status?: DiscountStatus;
  minimumSubtotal?: number;
  maxDiscountAmount?: number | null;
  usageLimit?: number | null;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
}

export interface UpdateDiscountDTO {
  name?: string;
  description?: string | null;
  value?: number;
  status?: DiscountStatus;
  minimumSubtotal?: number;
  maxDiscountAmount?: number | null;
  usageLimit?: number | null;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
}

export interface DiscountDTO {
  id: string;
  storeId: string;
  code: string;
  name: string;
  description: string | null;
  type: DiscountType;
  value: number;
  currency: string | null;
  status: DiscountStatus;
  minimumSubtotal: number;
  maxDiscountAmount: number | null;
  usageLimit: number | null;
  usageCount: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiscountRedemptionDTO {
  id: string;
  discountId: string;
  storeId: string;
  orderId: string | null;
  checkoutId: string | null;
  customerId: string | null;
  amount: number;
  currency: string;
  createdAt: string;
}

export function toDiscountDTO(discount: Discount): DiscountDTO {
  const data = discount.toData();
  return {
    id: data.id,
    storeId: data.storeId,
    code: data.code,
    name: data.name,
    description: data.description,
    type: data.type,
    value: data.value,
    currency: data.currency,
    status: data.status,
    minimumSubtotal: data.minimumSubtotal,
    maxDiscountAmount: data.maxDiscountAmount,
    usageLimit: data.usageLimit,
    usageCount: data.usageCount,
    startsAt: data.startsAt ? data.startsAt.toISOString() : null,
    endsAt: data.endsAt ? data.endsAt.toISOString() : null,
    createdAt: data.createdAt.toISOString(),
    updatedAt: data.updatedAt.toISOString(),
  };
}

export function toRedemptionDTO(redemption: DiscountRedemption): DiscountRedemptionDTO {
  return {
    id: redemption.id,
    discountId: redemption.discountId,
    storeId: redemption.storeId,
    orderId: redemption.orderId,
    checkoutId: redemption.checkoutId,
    customerId: redemption.customerId,
    amount: redemption.amount,
    currency: redemption.currency,
    createdAt: redemption.createdAt.toISOString(),
  };
}
