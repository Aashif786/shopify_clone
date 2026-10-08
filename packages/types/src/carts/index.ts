export type CartStatus = "ACTIVE" | "CONVERTED" | "ABANDONED" | "EXPIRED";

export interface CartItemDto {
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

export interface CartDto {
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
  items: CartItemDto[];
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}
