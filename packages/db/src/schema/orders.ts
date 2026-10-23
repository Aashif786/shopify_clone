export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "COMPLETED";

export type OrderPaymentStatus =
  | "PENDING"
  | "AUTHORIZED"
  | "PAID"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED"
  | "FAILED";

export type OrderFulfillmentStatus =
  | "UNFULFILLED"
  | "PARTIALLY_FULFILLED"
  | "FULFILLED"
  | "CANCELLED";

export type OrderAddressType = "BILLING" | "SHIPPING";

export type OrderStatusHistoryActorType = "CUSTOMER" | "MERCHANT" | "SYSTEM";

export interface OrderRow {
  id: string;
  store_id: string;
  customer_id: string | null;
  checkout_id: string | null;
  payment_id: string | null;
  order_number: string;
  status: OrderStatus;
  payment_status: OrderPaymentStatus;
  fulfillment_status: OrderFulfillmentStatus;
  currency: string;
  subtotal: string | number | bigint;
  discount_total: string | number | bigint;
  shipping_total: string | number | bigint;
  tax_total: string | number | bigint;
  total: string | number | bigint;
  grand_total: string | number | bigint;
  cancelled_at: Date | null;
  cancel_reason: string | null;
  completed_at: Date | null;
  guest_token_hash?: string | null;
  discount_id?: string | null;
  discount_code?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateOrderRowInput {
  id: string;
  storeId: string;
  customerId?: string | null;
  checkoutId?: string | null;
  paymentId?: string | null;
  orderNumber: string;
  status?: OrderStatus;
  paymentStatus?: OrderPaymentStatus;
  fulfillmentStatus?: OrderFulfillmentStatus;
  currency: string;
  subtotal?: string | number | bigint;
  discountTotal?: string | number | bigint;
  shippingTotal?: string | number | bigint;
  taxTotal?: string | number | bigint;
  total: string | number | bigint;
  grandTotal?: string | number | bigint;
  cancelledAt?: Date | null;
  cancelReason?: string | null;
  completedAt?: Date | null;
  guestTokenHash?: string | null;
  discountId?: string | null;
  discountCode?: string | null;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  store_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name_snapshot: string;
  variant_name_snapshot: string;
  sku_snapshot: string | null;
  quantity: number;
  unit_price: string | number | bigint;
  discount_amount: string | number | bigint;
  tax_amount: string | number | bigint;
  line_total: string | number | bigint;
  created_at: Date;
  updated_at: Date;
}

export interface CreateOrderItemRowInput {
  id: string;
  orderId: string;
  storeId: string;
  productId?: string | null;
  variantId?: string | null;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  skuSnapshot?: string | null;
  quantity: number;
  unitPrice: string | number | bigint;
  discountAmount?: string | number | bigint;
  taxAmount?: string | number | bigint;
  lineTotal: string | number | bigint;
}

export interface OrderAddressRow {
  id: string;
  order_id: string;
  store_id: string;
  type: OrderAddressType;
  name: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string | null;
  postal_code: string;
  country: string;
  phone: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateOrderAddressRowInput {
  id: string;
  orderId: string;
  storeId: string;
  type: OrderAddressType;
  name: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
  phone?: string | null;
}

export interface OrderStatusHistoryRow {
  id: string;
  order_id: string;
  store_id: string;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  actor_type: OrderStatusHistoryActorType;
  actor_id: string | null;
  created_at: Date;
}

export interface CreateOrderStatusHistoryRowInput {
  id: string;
  orderId: string;
  storeId: string;
  fromStatus?: string | null;
  toStatus: string;
  reason?: string | null;
  actorType?: OrderStatusHistoryActorType;
  actorId?: string | null;
}
