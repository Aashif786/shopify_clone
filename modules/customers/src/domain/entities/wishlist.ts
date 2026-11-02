export interface CustomerWishlistItem {
  id: string;
  storeId: string;
  customerId: string;
  productId: string;
  variantId: string | null;
  createdAt: Date;
}
