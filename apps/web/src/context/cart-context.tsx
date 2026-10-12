"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiClient, ApiClientError } from "../lib/api-client";
import type {
  StorefrontCartDTO,
  StorefrontCartItemDTO,
} from "../lib/storefront-cart-helpers";

export type { StorefrontCartDTO, StorefrontCartItemDTO };

export interface CartContextValue {
  cart: StorefrontCartDTO | null;
  storeSlug: string;
  itemCount: number;
  isLoading: boolean;
  isMutating: boolean;
  error: ApiClientError | Error | null;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  addItem: (variantId: string, quantity?: number) => Promise<StorefrontCartDTO>;
  updateQuantity: (itemId: string, quantity: number) => Promise<StorefrontCartDTO>;
  removeItem: (itemId: string) => Promise<StorefrontCartDTO>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

function getStorageKey(storeSlug: string, suffix: string): string {
  return `sc_${storeSlug}_${suffix}`;
}

function getStoredValue(storeSlug: string, suffix: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(getStorageKey(storeSlug, suffix));
  } catch {
    return null;
  }
}

function setStoredValue(storeSlug: string, suffix: string, value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value === null) {
      localStorage.removeItem(getStorageKey(storeSlug, suffix));
    } else {
      localStorage.setItem(getStorageKey(storeSlug, suffix), value);
    }
  } catch {
    // Ignore localStorage errors (e.g., privacy mode)
  }
}

function getOrCreateGuestId(storeSlug: string): string {
  let guestId = getStoredValue(storeSlug, "guest_id");
  if (!guestId) {
    guestId = `guest_${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36)}`;
    setStoredValue(storeSlug, "guest_id", guestId);
  }
  return guestId;
}

export interface CartProviderProps {
  children: ReactNode;
  storeSlug: string;
}

export function CartProvider({ children, storeSlug }: CartProviderProps) {
  const [cart, setCart] = useState<StorefrontCartDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isMutating, setIsMutating] = useState<boolean>(false);
  const [error, setError] = useState<ApiClientError | Error | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // In-flight mutex to avoid concurrent race conditions
  const mutationLock = useRef<boolean>(false);

  // Total item count across all lines in the cart
  const itemCount = useMemo(() => {
    if (!cart?.items) return 0;
    return cart.items.reduce((total, item) => total + item.quantity, 0);
  }, [cart]);

  // Load cart for the current store
  const refreshCart = useCallback(async () => {
    if (!storeSlug) return;

    setIsLoading(true);
    setError(null);

    const cartId = getStoredValue(storeSlug, "cart_id");
    const guestId = getOrCreateGuestId(storeSlug);

    try {
      const params: Record<string, string> = { guestIdentifier: guestId };
      if (cartId) {
        params.cartId = cartId;
      }

      const res = await apiClient.get<{
        cart: StorefrontCartDTO | null;
        store: { id: string; name: string; slug: string; currency: string };
      }>(`/api/v1/storefront/${encodeURIComponent(storeSlug)}/cart`, {
        params,
      });

      if (res?.cart) {
        setCart(res.cart);
        setStoredValue(storeSlug, "cart_id", res.cart.id);
      } else {
        setCart(null);
        setStoredValue(storeSlug, "cart_id", null);
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 404) {
        setCart(null);
        setStoredValue(storeSlug, "cart_id", null);
      } else {
        setError(
          err instanceof Error
            ? err
            : new ApiClientError({
                code: "CART_LOAD_ERROR",
                message: "Failed to load cart",
                status: 500,
              }),
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [storeSlug]);

  // Synchronize on store change
  useEffect(() => {
    setCart(null);
    setIsDrawerOpen(false);
    refreshCart();
  }, [storeSlug, refreshCart]);

  const addItem = useCallback(
    async (variantId: string, quantity: number = 1): Promise<StorefrontCartDTO> => {
      if (mutationLock.current) {
        throw new Error("Another cart mutation is already in progress");
      }
      mutationLock.current = true;
      setIsMutating(true);
      setError(null);

      try {
        const cartId = getStoredValue(storeSlug, "cart_id") || cart?.id;
        const guestId = getOrCreateGuestId(storeSlug);

        const res = await apiClient.post<{
          cart: StorefrontCartDTO;
          store: unknown;
        }>(`/api/v1/storefront/${encodeURIComponent(storeSlug)}/cart/items`, {
          variantId,
          quantity,
          cartId: cartId || undefined,
          guestIdentifier: guestId,
        });

        setCart(res.cart);
        setStoredValue(storeSlug, "cart_id", res.cart.id);
        return res.cart;
      } catch (err: unknown) {
        const errorObj =
          err instanceof Error
            ? err
            : new ApiClientError({
                code: "ADD_ITEM_FAILED",
                message: "Failed to add item to cart",
                status: 500,
              });
        setError(errorObj);
        throw errorObj;
      } finally {
        mutationLock.current = false;
        setIsMutating(false);
      }
    },
    [storeSlug, cart?.id],
  );

  const updateQuantity = useCallback(
    async (itemId: string, quantity: number): Promise<StorefrontCartDTO> => {
      const cartId = getStoredValue(storeSlug, "cart_id") || cart?.id;
      if (!cartId) {
        throw new Error("Cannot update item: No active cart found");
      }

      if (mutationLock.current) {
        throw new Error("Another cart mutation is already in progress");
      }
      mutationLock.current = true;
      setIsMutating(true);
      setError(null);

      try {
        const res = await apiClient.patch<{
          cart: StorefrontCartDTO;
          store: unknown;
        }>(
          `/api/v1/storefront/${encodeURIComponent(storeSlug)}/cart/items/${encodeURIComponent(itemId)}`,
          {
            quantity,
            cartId,
          },
        );

        setCart(res.cart);
        setStoredValue(storeSlug, "cart_id", res.cart.id);
        return res.cart;
      } catch (err: unknown) {
        const errorObj =
          err instanceof Error
            ? err
            : new ApiClientError({
                code: "UPDATE_ITEM_FAILED",
                message: "Failed to update item quantity",
                status: 500,
              });
        setError(errorObj);
        throw errorObj;
      } finally {
        mutationLock.current = false;
        setIsMutating(false);
      }
    },
    [storeSlug, cart?.id],
  );

  const removeItem = useCallback(
    async (itemId: string): Promise<StorefrontCartDTO> => {
      const cartId = getStoredValue(storeSlug, "cart_id") || cart?.id;
      if (!cartId) {
        throw new Error("Cannot remove item: No active cart found");
      }

      if (mutationLock.current) {
        throw new Error("Another cart mutation is already in progress");
      }
      mutationLock.current = true;
      setIsMutating(true);
      setError(null);

      try {
        const res = await apiClient.delete<{
          cart: StorefrontCartDTO;
          store: unknown;
        }>(
          `/api/v1/storefront/${encodeURIComponent(storeSlug)}/cart/items/${encodeURIComponent(itemId)}?cartId=${encodeURIComponent(cartId)}`,
        );

        setCart(res.cart);
        setStoredValue(storeSlug, "cart_id", res.cart.id);
        return res.cart;
      } catch (err: unknown) {
        const errorObj =
          err instanceof Error
            ? err
            : new ApiClientError({
                code: "REMOVE_ITEM_FAILED",
                message: "Failed to remove item from cart",
                status: 500,
              });
        setError(errorObj);
        throw errorObj;
      } finally {
        mutationLock.current = false;
        setIsMutating(false);
      }
    },
    [storeSlug, cart?.id],
  );

  const clearCart = useCallback(async (): Promise<void> => {
    const cartId = getStoredValue(storeSlug, "cart_id") || cart?.id;
    if (!cartId) return;

    if (mutationLock.current) {
      throw new Error("Another cart mutation is already in progress");
    }
    mutationLock.current = true;
    setIsMutating(true);
    setError(null);

    try {
      const res = await apiClient.delete<{
        cart: StorefrontCartDTO;
        store: unknown;
      }>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/cart?cartId=${encodeURIComponent(cartId)}`,
      );

      setCart(res.cart);
    } catch (err: unknown) {
      const errorObj =
        err instanceof Error
          ? err
          : new ApiClientError({
              code: "CLEAR_CART_FAILED",
              message: "Failed to clear cart",
              status: 500,
            });
      setError(errorObj);
      throw errorObj;
    } finally {
      mutationLock.current = false;
      setIsMutating(false);
    }
  }, [storeSlug, cart?.id]);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      storeSlug,
      itemCount,
      isLoading,
      isMutating,
      error,
      isDrawerOpen,
      openDrawer,
      closeDrawer,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      refreshCart,
    }),
    [
      cart,
      storeSlug,
      itemCount,
      isLoading,
      isMutating,
      error,
      isDrawerOpen,
      openDrawer,
      closeDrawer,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      refreshCart,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}

export function useOptionalCart(): CartContextValue | null {
  return useContext(CartContext) ?? null;
}
