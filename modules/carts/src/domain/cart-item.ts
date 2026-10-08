import { generateUuidV7 } from "@shopify-clone/db";
import { InvalidCartPriceError, InvalidQuantityError } from "./cart-errors.js";

export const DEFAULT_MAX_CART_ITEM_QUANTITY = 999;

export function validateCartQuantity(
  quantity: unknown,
  maxQuantity: number = DEFAULT_MAX_CART_ITEM_QUANTITY,
): number {
  if (
    typeof quantity !== "number" ||
    !Number.isInteger(quantity) ||
    Number.isNaN(quantity)
  ) {
    throw new InvalidQuantityError("Quantity must be a valid integer");
  }
  if (quantity <= 0) {
    throw new InvalidQuantityError("Quantity must be a positive integer greater than zero");
  }
  if (quantity > maxQuantity) {
    throw new InvalidQuantityError(`Quantity cannot exceed the maximum allowed limit of ${maxQuantity}`);
  }
  return quantity;
}

export function validateCartUnitPrice(price: unknown): number {
  if (
    typeof price !== "number" ||
    !Number.isInteger(price) ||
    Number.isNaN(price)
  ) {
    throw new InvalidCartPriceError("Unit price must be an integer minor units (e.g. cents)");
  }
  if (price < 0) {
    throw new InvalidCartPriceError("Unit price cannot be negative");
  }
  return price;
}

export function calculateLineSubtotal(quantity: number, unitPrice: number): number {
  const validQty = validateCartQuantity(quantity);
  const validPrice = validateCartUnitPrice(unitPrice);
  return validQty * validPrice;
}

export interface CartItem {
  id: string;
  cartId: string;
  storeId: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
  lineSubtotal: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCartItemParams {
  id?: string;
  cartId: string;
  storeId: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export function createCartItem(params: CreateCartItemParams): CartItem {
  const quantity = validateCartQuantity(params.quantity);
  const unitPrice = validateCartUnitPrice(params.unitPrice);
  const lineSubtotal = calculateLineSubtotal(quantity, unitPrice);
  const now = new Date();

  return {
    id: params.id ?? generateUuidV7(),
    cartId: params.cartId,
    storeId: params.storeId,
    variantId: params.variantId,
    quantity,
    unitPrice,
    lineSubtotal,
    createdAt: params.createdAt ?? now,
    updatedAt: params.updatedAt ?? now,
  };
}
