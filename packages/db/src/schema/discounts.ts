export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";
export type DiscountStatus = "DRAFT" | "ACTIVE" | "DISABLED" | "EXPIRED";

export interface DiscountRow {
  id: string;
  store_id: string;
  code: string;
  name: string;
  description: string | null;
  type: DiscountType;
  value: string | number | bigint;
  currency: string | null;
  status: DiscountStatus;
  minimum_subtotal: string | number | bigint;
  max_discount_amount: string | number | bigint | null;
  usage_limit: number | null;
  usage_count: number;
  starts_at: Date | null;
  ends_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateDiscountRowInput {
  id: string;
  storeId: string;
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
  startsAt?: Date | null;
  endsAt?: Date | null;
}

export interface DiscountRedemptionRow {
  id: string;
  discount_id: string;
  store_id: string;
  order_id: string | null;
  checkout_id: string | null;
  customer_id: string | null;
  amount: string | number | bigint;
  currency: string;
  created_at: Date;
}

export interface CreateDiscountRedemptionRowInput {
  id: string;
  discountId: string;
  storeId: string;
  orderId?: string | null;
  checkoutId?: string | null;
  customerId?: string | null;
  amount: number;
  currency: string;
}
