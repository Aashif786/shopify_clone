"use client";

import type { ReactNode } from "react";
import { CartProvider } from "../../context/cart-context";
import { WishlistProvider } from "../../context/wishlist-context";

/**
 * Cart and wishlist state live in the shared storefront layout so they survive
 * client-side navigation: no cart refetch flash, an open drawer stays coherent, and
 * guest-cart continuity is preserved across routes. Pages must NOT mount their own
 * providers (an inner provider would shadow this one and break that continuity).
 */
export function StorefrontProviders({
  storeSlug,
  children,
}: {
  storeSlug: string;
  children: ReactNode;
}) {
  return (
    <CartProvider storeSlug={storeSlug}>
      <WishlistProvider storeSlug={storeSlug}>{children}</WishlistProvider>
    </CartProvider>
  );
}
