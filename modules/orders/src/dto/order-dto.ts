import type {
  OrderAddressType,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderStatus,
  OrderStatusHistoryActorType,
} from "../domain/order-state.js";
import type { Order, OrderAddress, OrderStatusHistoryEntry } from "../domain/order.js";
import type { OrderItem } from "../domain/order-item.js";

export interface OrderItemDTO {
  id: string;
  orderId: string;
  storeId: string;
  productId: string | null;
  variantId: string | null;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  skuSnapshot: string | null;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderAddressDTO {
  id: string;
  orderId: string;
  storeId: string;
  type: OrderAddressType;
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderStatusHistoryDTO {
  id: string;
  orderId: string;
  storeId: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  actorType: OrderStatusHistoryActorType;
  actorId: string | null;
  createdAt: string;
}

export interface OrderDTO {
  id: string;
  storeId: string;
  orderNumber: string;
  customerId: string | null;
  checkoutId: string | null;
  paymentId: string | null;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  fulfillmentStatus: OrderFulfillmentStatus;
  currency: string;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  total: number;
  grandTotal: number;
  cancelledAt: string | null;
  cancelReason: string | null;
  completedAt: string | null;
  guestTokenHash?: string | null;
  discountId?: string | null;
  discountCode?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: OrderItemDTO[];
  addresses?: OrderAddressDTO[];
  statusHistory?: OrderStatusHistoryDTO[];
}

export function toOrderItemDTO(item: OrderItem): OrderItemDTO {
  return {
    id: item.id,
    orderId: item.orderId,
    storeId: item.storeId,
    productId: item.productId,
    variantId: item.variantId,
    productNameSnapshot: item.productNameSnapshot,
    variantNameSnapshot: item.variantNameSnapshot,
    skuSnapshot: item.skuSnapshot,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discountAmount: item.discountAmount,
    taxAmount: item.taxAmount,
    lineTotal: item.lineTotal,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function toOrderAddressDTO(address: OrderAddress): OrderAddressDTO {
  return {
    id: address.id,
    orderId: address.orderId,
    storeId: address.storeId,
    type: address.type,
    name: address.name,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
    phone: address.phone,
    createdAt: address.createdAt.toISOString(),
    updatedAt: address.updatedAt.toISOString(),
  };
}

export function toOrderStatusHistoryDTO(
  entry: OrderStatusHistoryEntry,
): OrderStatusHistoryDTO {
  return {
    id: entry.id,
    orderId: entry.orderId,
    storeId: entry.storeId,
    fromStatus: entry.fromStatus,
    toStatus: entry.toStatus,
    reason: entry.reason,
    actorType: entry.actorType,
    actorId: entry.actorId,
    createdAt: entry.createdAt.toISOString(),
  };
}

export function toOrderDTO(
  order: Order,
  items?: OrderItem[],
  addresses?: OrderAddress[],
  history?: OrderStatusHistoryEntry[],
): OrderDTO {
  const effectiveItems = items ?? (order.items.length > 0 ? [...order.items] : undefined);
  const effectiveAddresses = addresses ?? (order.addresses.length > 0 ? [...order.addresses] : undefined);
  const effectiveHistory = history ?? (order.statusHistory.length > 0 ? [...order.statusHistory] : undefined);

  return {
    id: order.id,
    storeId: order.storeId,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    checkoutId: order.checkoutId,
    paymentId: order.paymentId,
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    currency: order.currency,
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    shippingTotal: order.shippingTotal,
    taxTotal: order.taxTotal,
    total: order.total,
    grandTotal: order.grandTotal,
    cancelledAt: order.cancelledAt ? order.cancelledAt.toISOString() : null,
    cancelReason: order.cancelReason,
    completedAt: order.completedAt ? order.completedAt.toISOString() : null,
    guestTokenHash: order.guestTokenHash,
    discountId: order.discountId,
    discountCode: order.discountCode,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: effectiveItems ? effectiveItems.map(toOrderItemDTO) : undefined,
    addresses: effectiveAddresses ? effectiveAddresses.map(toOrderAddressDTO) : undefined,
    statusHistory: effectiveHistory ? effectiveHistory.map(toOrderStatusHistoryDTO) : undefined,
  };
}
