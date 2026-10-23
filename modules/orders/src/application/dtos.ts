export * from "../dto/order-dto.js";
import type { OrderDTO } from "../dto/order-dto.js";

import type {
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderStatus,
  OrderStatusHistoryActorType,
} from "../domain/order-state.js";

export interface TrustedCheckoutAddressData {
  name?: string;
  firstName?: string | null;
  lastName?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
  phone?: string | null;
}

export interface TrustedCheckoutItemData {
  id?: string;
  variantId?: string | null;
  productId?: string | null;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  skuSnapshot?: string | null;
  unitPrice: number;
  quantity: number;
  discountAmount?: number;
  taxAmount?: number;
  lineTotal?: number;
}

export interface TrustedCheckoutData {
  id: string;
  storeId: string;
  customerId?: string | null;
  currency: string;
  items: TrustedCheckoutItemData[];
  subtotal?: number;
  discountTotal?: number;
  shippingTotal?: number;
  taxTotal?: number;
  total?: number;
  shippingAddress?: TrustedCheckoutAddressData | null;
  billingAddress?: TrustedCheckoutAddressData | null;
  paymentId?: string | null;
  guestTokenHash?: string | null;
  discountId?: string | null;
  discountCode?: string | null;
}

export interface CreateOrderFromCheckoutInput {
  storeId: string;
  checkout: TrustedCheckoutData;
  paymentId?: string | null;
  initialStatus?: OrderStatus;
  actorType?: OrderStatusHistoryActorType;
  actorId?: string | null;
}

export interface TransitionOrderStatusInput {
  storeId: string;
  orderId: string;
  toStatus: OrderStatus;
  actorType: OrderStatusHistoryActorType;
  actorId?: string | null;
  reason?: string | null;
}

export interface CancelOrderInput {
  storeId: string;
  orderId: string;
  reason: string;
  actorType?: OrderStatusHistoryActorType;
  actorId?: string | null;
}

export interface UpdateOrderPaymentStatusInput {
  storeId: string;
  orderId: string;
  paymentStatus: OrderPaymentStatus;
  authorizedInternalCall: boolean;
  actorType?: OrderStatusHistoryActorType;
  actorId?: string | null;
  reason?: string | null;
}

export interface UpdateOrderFulfillmentStatusInput {
  storeId: string;
  orderId: string;
  fulfillmentStatus: OrderFulfillmentStatus;
  actorType?: OrderStatusHistoryActorType;
  actorId?: string | null;
  reason?: string | null;
}

export interface ListOrdersQueryDto {
  status?: OrderStatus;
  paymentStatus?: OrderPaymentStatus;
  fulfillmentStatus?: OrderFulfillmentStatus;
  customerId?: string;
  orderNumber?: string;
  limit?: number;
  cursor?: string;
}

export interface ListOrdersResultDto {
  items: OrderDTO[];
  hasMore: boolean;
  nextCursor?: string;
}
