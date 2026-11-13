"use client";

import React, { useContext, type ReactNode } from "react";

import { CartProvider } from "../../context/cart-context";
import { WishlistProvider } from "../../context/wishlist-context";
import {
  StorefrontIdentityContext,
  useStorefrontIdentity,
  type StorefrontIdentity,
} from "./use-storefront-identity";

/**
 * The merchant's resolved PUBLISHED store name and theme, fetched once for the whole
 * storefront subtree. `StorefrontShell` falls back to it when a page does not pass its own `theme`,
 * so every route (cart, checkout, product detail, ...) carries the merchant's branding
 * instead of only the pages that happened to fetch it. Returns null outside the
 * provider (e.g. isolated component tests), in which case callers use their own props.
 */
export function useOptionalStorefrontIdentity(): StorefrontIdentity | null {
  return useContext(StorefrontIdentityContext);
}

function StorefrontIdentityProvider({
  storeSlug,
  children,
}: {
  storeSlug: string;
  children: ReactNode;
}) {
  const identity = useStorefrontIdentity(storeSlug);
  // Tag the identity with its store so a consumer for another store can never read it.
  const value = React.useMemo(() => ({ ...identity, slug: storeSlug }), [identity, storeSlug]);
  return (
    <StorefrontIdentityContext.Provider value={value}>
      {children}
    </StorefrontIdentityContext.Provider>
  );
}

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
    <StorefrontIdentityProvider storeSlug={storeSlug}>
      <CartProvider storeSlug={storeSlug}>
        <WishlistProvider storeSlug={storeSlug}>{children}</WishlistProvider>
      </CartProvider>
    </StorefrontIdentityProvider>
  );
}
