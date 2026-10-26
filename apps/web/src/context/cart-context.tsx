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
import type { AppliedDiscountDTO } from "../lib/storefront-discount-helpers";

export type { StorefrontCartDTO, StorefrontCartItemDTO, AppliedDiscountDTO };

export interface CartContextValue {
  cart: StorefrontCartDTO | null;
  storeSlug: string;
  itemCount: number;
  isLoading: boolean;
  isMutating: boolean;
  error: ApiClientError | Error | null;
  isDrawerOpen: boolean;
  appliedDiscount: AppliedDiscountDTO | null;
  openDrawer: () => void;
  closeDrawer: () => void;
  addItem: (variantId: string, quantity?: number) => Promise<StorefrontCartDTO>;
  updateQuantity: (itemId: string, quantity: number) => Promise<StorefrontCartDTO>;
  removeItem: (itemId: string) => Promise<StorefrontCartDTO>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  applyDiscount: (code: string) => Promise<StorefrontCartDTO>;
  removeDiscount: () => Promise<StorefrontCartDTO>;
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
  if (typeof document !== "undefined") {
    try {
      const cookieKey = `sc_${storeSlug}_guest_id`;
      if (!document.cookie.includes(`${cookieKey}=`)) {
        document.cookie = `${cookieKey}=${encodeURIComponent(guestId)}; path=/; max-age=31536000; SameSite=Lax`;
      }
      if (!document.cookie.includes("sc_guest_id=")) {
        document.cookie = `sc_guest_id=${encodeURIComponent(guestId)}; path=/; max-age=31536000; SameSite=Lax`;
      }
    } catch {
      // Ignore cookie errors
    }
  }
  return guestId;
}

export interface CartProviderProps {
  children: ReactNode;
  storeSlug: string;
}


async function acquireMutationLock(
  lockRef: React.MutableRefObject<boolean>,
  timeoutMs = 2500,
): Promise<boolean> {
  const start = Date.now();
  while (lockRef.current) {
    if (Date.now() - start > timeoutMs) {
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  lockRef.current = true;
  return true;
}

export function CartProvider({ children, storeSlug }: CartProviderProps) {
  const [cart, setCart] = useState<StorefrontCartDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isMutating, setIsMutating] = useState<boolean>(false);
  const [error, setError] = useState<ApiClientError | Error | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscountDTO | null>(null);

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
        headers: { "x-guest-identifier": guestId },
        guestIdentifier: guestId,
      });

      if (res?.cart) {
        setCart(res.cart);
        setStoredValue(storeSlug, "cart_id", res.cart.id);
        if (res.cart.discountCode && res.cart.discountTotal > 0) {
          setAppliedDiscount({
            code: res.cart.discountCode,
            name: res.cart.discountCode,
            type: "PERCENTAGE",
            value: res.cart.discountTotal,
            amount: res.cart.discountTotal,
            currency: res.cart.currency,
          });
        } else if (res.cart.discountTotal === 0) {
          setAppliedDiscount(null);
        }
      } else {
        setCart(null);
        setAppliedDiscount(null);
        setStoredValue(storeSlug, "cart_id", null);
      }
    } catch (err: unknown) {
      if (
        err instanceof ApiClientError &&
        (err.status === 404 || err.status === 403 || err.code === "CART_ACCESS_DENIED")
      ) {
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
      const acquired = await acquireMutationLock(mutationLock, 2500);
      if (!acquired) {
        throw new Error("Cart operation in progress. Please try again.");
      }
      setIsMutating(true);
      setError(null);

      try {
        const cartId = getStoredValue(storeSlug, "cart_id") || cart?.id;
        const guestId = getOrCreateGuestId(storeSlug);

        let res;
        try {
          res = await apiClient.post<{
            cart: StorefrontCartDTO;
            store: unknown;
          }>(
            `/api/v1/storefront/${encodeURIComponent(storeSlug)}/cart/items`,
            {
              variantId,
              quantity,
              cartId: cartId || undefined,
              guestIdentifier: guestId,
            },
            {
              headers: { "x-guest-identifier": guestId },
              guestIdentifier: guestId,
            },
          );
        } catch (postErr: unknown) {
          // If stored cart ID is stale/unauthorized (403 CART_ACCESS_DENIED or 404), clear it and retry cleanly
          if (
            cartId &&
            postErr instanceof ApiClientError &&
            (postErr.status === 403 || postErr.status === 404 || postErr.code === "CART_ACCESS_DENIED")
          ) {
            setStoredValue(storeSlug, "cart_id", null);
            res = await apiClient.post<{
              cart: StorefrontCartDTO;
              store: unknown;
            }>(
              `/api/v1/storefront/${encodeURIComponent(storeSlug)}/cart/items`,
              {
                variantId,
                quantity,
                guestIdentifier: guestId,
              },
              {
                headers: { "x-guest-identifier": guestId },
                guestIdentifier: guestId,
              },
            );
          } else {
            throw postErr;
          }
        }

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

      const acquired = await acquireMutationLock(mutationLock, 2500);
      if (!acquired) {
        throw new Error("Cart operation in progress. Please try again.");
      }
      setIsMutating(true);
      setError(null);

      try {
        const guestId = getOrCreateGuestId(storeSlug);
        const res = await apiClient.patch<{
          cart: StorefrontCartDTO;
          store: unknown;
        }>(
          `/api/v1/storefront/${encodeURIComponent(storeSlug)}/cart/items/${encodeURIComponent(itemId)}`,
          {
            quantity,
            cartId,
            guestIdentifier: guestId,
          },
          {
            headers: { "x-guest-identifier": guestId },
            guestIdentifier: guestId,
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

      const acquired = await acquireMutationLock(mutationLock, 2500);
      if (!acquired) {
        throw new Error("Cart operation in progress. Please try again.");
      }
      setIsMutating(true);
      setError(null);

      try {
        const guestId = getOrCreateGuestId(storeSlug);
        const res = await apiClient.delete<{
          cart: StorefrontCartDTO;
          store: unknown;
        }>(
          `/api/v1/storefront/${encodeURIComponent(storeSlug)}/cart/items/${encodeURIComponent(itemId)}?cartId=${encodeURIComponent(cartId)}&guestIdentifier=${encodeURIComponent(guestId)}`,
          {
            headers: { "x-guest-identifier": guestId },
            guestIdentifier: guestId,
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
    if (!cartId) {
      setCart(null);
      setAppliedDiscount(null);
      return;
    }

    const acquired = await acquireMutationLock(mutationLock, 2000);
    if (!acquired) {
      // Non-blocking fallback: clear local cart and stored cart ID without throwing
      setCart(null);
      setAppliedDiscount(null);
      setStoredValue(storeSlug, "cart_id", null);
      return;
    }

    setIsMutating(true);
    setError(null);

    try {
      const guestId = getOrCreateGuestId(storeSlug);
      await apiClient.delete<{
        cart: StorefrontCartDTO;
        store: unknown;
      }>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/cart?cartId=${encodeURIComponent(cartId)}&guestIdentifier=${encodeURIComponent(guestId)}`,
        {
          headers: { "x-guest-identifier": guestId },
          guestIdentifier: guestId,
        },
      );

      setCart(null);
      setAppliedDiscount(null);
      setStoredValue(storeSlug, "cart_id", null);
    } catch (err: unknown) {
      // Ensure local state and storage are always cleared even on network failure
      setCart(null);
      setAppliedDiscount(null);
      setStoredValue(storeSlug, "cart_id", null);
      console.warn("Non-fatal clearCart network failure:", err);
    } finally {
      mutationLock.current = false;
      setIsMutating(false);
    }
  }, [storeSlug, cart?.id]);

  const applyDiscount = useCallback(
    async (code: string): Promise<StorefrontCartDTO> => {
      const cartId = getStoredValue(storeSlug, "cart_id") || cart?.id;
      if (!cartId) {
        throw new Error("Cannot apply discount: No active cart found");
      }

      const acquired = await acquireMutationLock(mutationLock, 2500);
      if (!acquired) {
        throw new Error("Cart operation in progress. Please try again.");
      }
      setIsMutating(true);

      try {
        const guestId = getOrCreateGuestId(storeSlug);
        const res = await apiClient.post<{
          cart: StorefrontCartDTO;
          discount: AppliedDiscountDTO;
          store: unknown;
        }>(
          `/api/v1/storefront/${encodeURIComponent(storeSlug)}/cart/discount`,
          {
            code,
            cartId,
            guestIdentifier: guestId,
          },
          {
            headers: { "x-guest-identifier": guestId },
            guestIdentifier: guestId,
          },
        );

        setCart(res.cart);
        setAppliedDiscount(res.discount);
        return res.cart;
      } catch (err: unknown) {
        const errorObj =
          err instanceof Error
            ? err
            : new ApiClientError({
                code: "APPLY_DISCOUNT_FAILED",
                message: "Failed to apply discount code",
                status: 500,
              });
        // Note: Do not call setError(errorObj) so global cart page is not alerted with red banner.
        // DiscountCodeForm handles displaying inline errors to the user.
        throw errorObj;
      } finally {
        mutationLock.current = false;
        setIsMutating(false);
      }
    },
    [storeSlug, cart?.id],
  );

  const removeDiscount = useCallback(async (): Promise<StorefrontCartDTO> => {
    const cartId = getStoredValue(storeSlug, "cart_id") || cart?.id;
    if (!cartId) {
      throw new Error("Cannot remove discount: No active cart found");
    }

    const acquired = await acquireMutationLock(mutationLock, 2500);
    if (!acquired) {
      throw new Error("Cart operation in progress. Please try again.");
    }
    setIsMutating(true);

    try {
      const guestId = getOrCreateGuestId(storeSlug);
      const res = await apiClient.delete<{
        cart: StorefrontCartDTO;
        store: unknown;
      }>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/cart/discount?cartId=${encodeURIComponent(cartId)}&guestIdentifier=${encodeURIComponent(guestId)}`,
        {
          headers: { "x-guest-identifier": guestId },
          guestIdentifier: guestId,
        },
      );

      setCart(res.cart);
      setAppliedDiscount(null);
      return res.cart;
    } catch (err: unknown) {
      const errorObj =
        err instanceof Error
          ? err
          : new ApiClientError({
              code: "REMOVE_DISCOUNT_FAILED",
              message: "Failed to remove discount",
              status: 500,
            });
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
      appliedDiscount,
      openDrawer,
      closeDrawer,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      refreshCart,
      applyDiscount,
      removeDiscount,
    }),
    [
      cart,
      storeSlug,
      itemCount,
      isLoading,
      isMutating,
      error,
      isDrawerOpen,
      appliedDiscount,
      openDrawer,
      closeDrawer,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      refreshCart,
      applyDiscount,
      removeDiscount,
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
