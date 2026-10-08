import type { Cart, CartItem, CartStatus } from "../index.js";

export interface CreateCartInput {
  customerId?: string | null;
  guestIdentifier?: string | null;
  currency?: string;
  expiresAt?: Date | null;
}

export interface AddCartItemInput {
  variantId: string;
  quantity: number;
}

export interface UpdateCartItemQuantityInput {
  quantity: number;
}

export interface CartItemDTO {
  id: string;
  cartId: string;
  storeId: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
  lineSubtotal: number;
  createdAt: string;
  updatedAt: string;
}

export interface CartDTO {
  id: string;
  storeId: string;
  customerId: string | null;
  guestIdentifier: string | null;
  status: CartStatus;
  currency: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingTotal: number;
  grandTotal: number;
  items: CartItemDTO[];
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toCartItemDTO(item: CartItem): CartItemDTO {
  return {
    id: item.id,
    cartId: item.cartId,
    storeId: item.storeId,
    variantId: item.variantId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineSubtotal: item.lineSubtotal,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function toCartDTO(cart: Cart): CartDTO {
  return {
    id: cart.id,
    storeId: cart.storeId,
    customerId: cart.customerId,
    guestIdentifier: cart.guestIdentifier,
    status: cart.status,
    currency: cart.currency,
    subtotal: cart.subtotal,
    discountTotal: cart.discountTotal,
    taxTotal: cart.taxTotal,
    shippingTotal: cart.shippingTotal,
    grandTotal: cart.grandTotal,
    items: cart.items.map(toCartItemDTO),
    expiresAt: cart.expiresAt ? cart.expiresAt.toISOString() : null,
    createdAt: cart.createdAt.toISOString(),
    updatedAt: cart.updatedAt.toISOString(),
  };
}
