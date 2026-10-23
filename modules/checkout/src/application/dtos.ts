import type { Checkout, CheckoutAddress, CheckoutItem } from "../domain/checkout.js";
import type { CheckoutPaymentStatus, CheckoutStatus } from "../domain/checkout-state.js";

export interface CheckoutAddressDTO {
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
}

export interface CheckoutItemDTO {
  id: string;
  checkoutId: string;
  storeId: string;
  variantId: string;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  skuSnapshot: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutDTO {
  id: string;
  storeId: string;
  cartId: string;
  customerId: string | null;
  email: string | null;
  status: CheckoutStatus;
  currency: string;
  subtotal: number;
  discountTotal: number;
  discountId?: string | null;
  discountCode?: string | null;
  taxTotal: number;
  shippingTotal: number;
  total: number;
  shippingAddress: CheckoutAddressDTO | null;
  billingAddress: CheckoutAddressDTO | null;
  paymentStatus: CheckoutPaymentStatus;
  expiresAt: string | null;
  guestTokenHash?: string | null;
  guestToken?: string | null;
  createdAt: string;
  updatedAt: string;
  items: CheckoutItemDTO[];
}

export interface CreateCheckoutInput {
  cartId: string;
  customerId?: string | null;
  email?: string | null;
  currency?: string;
  shippingAddress?: CheckoutAddressDTO | null;
  billingAddress?: CheckoutAddressDTO | null;
  expiresAt?: Date | null;
  guestTokenHash?: string | null;
  idempotencyKey?: string | null;
}

export interface CreateCheckoutFromCartInput {
  customerId?: string | null;
  email?: string | null;
  shippingAddress?: CheckoutAddressDTO | null;
  billingAddress?: CheckoutAddressDTO | null;
  expiresAt?: Date | null;
  guestTokenHash?: string | null;
  caller?: {
    customerId?: string | null;
    guestIdentifier?: string | null;
  };
  idempotencyKey?: string | null;
}

export interface AddCheckoutItemInput {
  variantId: string;
  quantity: number;
}

export interface UpdateCheckoutItemQuantityInput {
  quantity: number;
}

export interface UpdateCheckoutCustomerInput {
  customerId?: string | null;
  email?: string | null;
}

export interface UpdateCheckoutAddressesInput {
  shippingAddress?: CheckoutAddressDTO | null;
  billingAddress?: CheckoutAddressDTO | null;
}

export interface UpdateCheckoutTotalsInput {
  discountTotal?: number;
  discountId?: string | null;
  discountCode?: string | null;
  taxTotal?: number;
  shippingTotal?: number;
}

export function toAddressDTO(address: CheckoutAddress | null): CheckoutAddressDTO | null {
  if (!address) {
    return null;
  }
  return {
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 ?? null,
    city: address.city,
    state: address.state ?? null,
    postalCode: address.postalCode,
    country: address.country,
    firstName: address.firstName ?? null,
    lastName: address.lastName ?? null,
    phone: address.phone ?? null,
  };
}

export function toCheckoutItemDTO(item: CheckoutItem): CheckoutItemDTO {
  return {
    id: item.id,
    checkoutId: item.checkoutId,
    storeId: item.storeId,
    variantId: item.variantId,
    productNameSnapshot: item.productNameSnapshot,
    variantNameSnapshot: item.variantNameSnapshot,
    skuSnapshot: item.skuSnapshot,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    lineTotal: item.lineTotal,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function toCheckoutDTO(checkout: Checkout, guestToken?: string | null): CheckoutDTO {
  const token = typeof guestToken === "string" ? guestToken : null;
  return {
    id: checkout.id,
    storeId: checkout.storeId,
    cartId: checkout.cartId,
    customerId: checkout.customerId,
    email: checkout.email,
    status: checkout.status,
    currency: checkout.currency,
    subtotal: checkout.subtotal,
    discountTotal: checkout.discountTotal,
    discountId: checkout.discountId,
    discountCode: checkout.discountCode,
    taxTotal: checkout.taxTotal,
    shippingTotal: checkout.shippingTotal,
    total: checkout.total,
    shippingAddress: toAddressDTO(checkout.shippingAddress),
    billingAddress: toAddressDTO(checkout.billingAddress),
    paymentStatus: checkout.paymentStatus,
    expiresAt: checkout.expiresAt ? checkout.expiresAt.toISOString() : null,
    guestTokenHash: checkout.guestTokenHash,
    guestToken: token,
    createdAt: checkout.createdAt.toISOString(),
    updatedAt: checkout.updatedAt.toISOString(),
    items: checkout.items.map(toCheckoutItemDTO),
  };
}
