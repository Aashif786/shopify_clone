/**
 * Row types for the customer-initiated returns / RMA domain (migration 0035).
 *
 * The business logic that owns these tables lives in `modules/returns`; these
 * types describe only the persisted shape, mirroring the convention used by
 * `schema/orders.ts` and `schema/discounts.ts`.
 */

export type ReturnRequestStatus =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "RECEIVED"
  | "REFUNDED"
  | "CANCELLED";

export type ReturnRequestActorType = "CUSTOMER" | "MERCHANT" | "SYSTEM";

export interface ReturnPolicyRow {
  id: string;
  store_id: string;
  is_returns_enabled: boolean;
  return_window_days: number;
  created_at: Date;
  updated_at: Date;
}

export interface ReturnRequestRow {
  id: string;
  store_id: string;
  order_id: string;
  customer_id: string | null;
  return_number: string;
  status: ReturnRequestStatus;
  reason: string;
  customer_note: string | null;
  merchant_note: string | null;
  currency: string;
  requested_amount: string | number | bigint;
  refunded_amount: string | number | bigint | null;
  refund_id: string | null;
  requested_at: Date;
  decided_at: Date | null;
  decided_by_user_id: string | null;
  received_at: Date | null;
  refunded_at: Date | null;
  cancelled_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ReturnRequestItemRow {
  id: string;
  return_request_id: string;
  store_id: string;
  order_item_id: string;
  quantity: number;
  unit_price_snapshot: string | number | bigint;
  line_refund_amount: string | number | bigint;
  product_name_snapshot: string;
  variant_name_snapshot: string | null;
  sku_snapshot: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ReturnRequestEventRow {
  id: string;
  return_request_id: string;
  store_id: string;
  from_status: ReturnRequestStatus | null;
  to_status: ReturnRequestStatus;
  actor_type: ReturnRequestActorType;
  actor_id: string | null;
  reason: string | null;
  created_at: Date;
}
