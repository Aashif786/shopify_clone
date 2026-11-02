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
import type { WishlistItemDTO } from "@calcart/customers";
import { apiClient } from "../lib/api-client";
import { useAuth } from "./auth-context";

export type { WishlistItemDTO };

export interface GuestWishlistEntry {
  productId: string;
  variantId: string | null;
  addedAt: string;
}

export interface WishlistContextValue {
  items: WishlistItemDTO[];
  itemCount: number;
  isLoading: boolean;
  isInWishlist: (productId: string, variantId?: string | null) => boolean;
  toggleWishlist: (productId: string, variantId?: string | null, metadata?: Partial<WishlistItemDTO>) => Promise<boolean>;
  addToWishlist: (productId: string, variantId?: string | null, metadata?: Partial<WishlistItemDTO>) => Promise<void>;
  removeFromWishlist: (productId: string, variantId?: string | null) => Promise<void>;
  removeItemById: (itemId: string) => Promise<void>;
  clearWishlist: () => Promise<void>;
  refreshWishlist: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined);

function getStorageKey(storeSlug: string): string {
  return `cc_${storeSlug}_wishlist`;
}

function getStoredGuestWishlist(storeSlug: string): GuestWishlistEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getStorageKey(storeSlug));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setStoredGuestWishlist(storeSlug: string, items: GuestWishlistEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(storeSlug), JSON.stringify(items));
  } catch {
    // Ignore localStorage write failures (e.g. quota/incognito)
  }
}

export interface WishlistProviderProps {
  children: ReactNode;
  storeSlug: string;
}

export function WishlistProvider({ children, storeSlug }: WishlistProviderProps) {
  const { user, isAuthenticated } = useAuth();
  const [items, setItems] = useState<WishlistItemDTO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const hasMergedGuestRef = useRef<boolean>(false);

  // Helper key generator
  const makeKey = useCallback((productId: string, variantId?: string | null) => {
    return `${productId}:${variantId || ""}`;
  }, []);

  // Quick lookup set
  const wishlistKeySet = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      set.add(makeKey(item.productId, item.variantId));
      // Also index by productId alone so parent cards reflect favorited state
      set.add(item.productId);
    }
    return set;
  }, [items, makeKey]);

  const isInWishlist = useCallback(
    (productId: string, variantId?: string | null) => {
      if (!productId) return false;
      if (variantId) {
        return wishlistKeySet.has(makeKey(productId, variantId));
      }
      return wishlistKeySet.has(productId);
    },
    [wishlistKeySet, makeKey],
  );

  // Fetch / refresh wishlist
  const refreshWishlist = useCallback(async () => {
    if (!storeSlug) return;
    setIsLoading(true);

    try {
      if (isAuthenticated) {
        // Authenticated customer: check if there are guest items to merge first
        const guestItems = getStoredGuestWishlist(storeSlug);
        if (guestItems.length > 0 && !hasMergedGuestRef.current) {
          hasMergedGuestRef.current = true;
          try {
            const mergeRes = await apiClient.post<{ items: WishlistItemDTO[] }>(
              `/api/v1/storefront/${encodeURIComponent(storeSlug)}/wishlist/merge`,
              { items: guestItems.map((g) => ({ productId: g.productId, variantId: g.variantId })) },
            );
            setItems(mergeRes.items || []);
            setStoredGuestWishlist(storeSlug, []);
            setIsLoading(false);
            return;
          } catch {
            // Fall through to regular fetch if merge fails
          }
        }

        const res = await apiClient.get<{ items: WishlistItemDTO[] }>(
          `/api/v1/storefront/${encodeURIComponent(storeSlug)}/wishlist`,
        );
        setItems(res.items || []);
      } else {
        // Guest user: load from localStorage and batch resolve rich details
        const guestEntries = getStoredGuestWishlist(storeSlug);
        if (guestEntries.length === 0) {
          setItems([]);
        } else {
          try {
            const batchRes = await apiClient.post<{ items: WishlistItemDTO[] }>(
              `/api/v1/storefront/${encodeURIComponent(storeSlug)}/wishlist/batch`,
              {
                items: guestEntries.map((g) => ({
                  productId: g.productId,
                  variantId: g.variantId,
                })),
              },
            );
            setItems(batchRes.items || []);
          } catch {
            // Fallback: minimal stubs
            setItems(
              guestEntries.map((g) => ({
                id: `guest_${g.productId}_${g.variantId || "def"}`,
                storeId: "",
                customerId: "guest",
                productId: g.productId,
                variantId: g.variantId,
                productTitle: "Wishlist Item",
                productSlug: "",
                price: null,
                compareAtPrice: null,
                currency: "USD",
                primaryMediaUrl: null,
                isOutOfStock: false,
                createdAt: g.addedAt,
              })),
            );
          }
        }
      }
    } catch {
      // Soft failure
    } finally {
      setIsLoading(false);
    }
  }, [storeSlug, isAuthenticated]);

  useEffect(() => {
    refreshWishlist();
  }, [refreshWishlist]);

  // Add item
  const addToWishlist = useCallback(
    async (productId: string, variantId?: string | null, metadata?: Partial<WishlistItemDTO>) => {
      if (!productId || !storeSlug) return;
      const cleanVariantId = variantId || null;

      // Optimistic update
      const tempId = `temp_${Date.now()}`;
      const newItem: WishlistItemDTO = {
        id: tempId,
        storeId: "",
        customerId: isAuthenticated ? (user?.id || "auth") : "guest",
        productId,
        variantId: cleanVariantId,
        productTitle: metadata?.productTitle || "Product",
        productSlug: metadata?.productSlug || "",
        price: metadata?.price ?? null,
        compareAtPrice: metadata?.compareAtPrice ?? null,
        currency: metadata?.currency || "USD",
        primaryMediaUrl: metadata?.primaryMediaUrl ?? null,
        isOutOfStock: metadata?.isOutOfStock ?? false,
        variantTitle: metadata?.variantTitle ?? null,
        createdAt: new Date().toISOString(),
      };

      setItems((prev) => {
        const exists = prev.some(
          (p) => p.productId === productId && (p.variantId || null) === cleanVariantId,
        );
        if (exists) return prev;
        return [newItem, ...prev];
      });

      if (!isAuthenticated) {
        const guestEntries = getStoredGuestWishlist(storeSlug);
        const filtered = guestEntries.filter(
          (g) => !(g.productId === productId && (g.variantId || null) === cleanVariantId),
        );
        filtered.unshift({
          productId,
          variantId: cleanVariantId,
          addedAt: new Date().toISOString(),
        });
        setStoredGuestWishlist(storeSlug, filtered);
        return;
      }

      try {
        await apiClient.post(`/api/v1/storefront/${encodeURIComponent(storeSlug)}/wishlist`, {
          productId,
          variantId: cleanVariantId,
        });
      } catch (err) {
        // Rollback on server error
        setItems((prev) => prev.filter((p) => p.id !== tempId));
        throw err;
      }
    },
    [storeSlug, isAuthenticated, user],
  );

  // Remove item
  const removeFromWishlist = useCallback(
    async (productId: string, variantId?: string | null) => {
      if (!productId || !storeSlug) return;
      const cleanVariantId = variantId || null;

      let removedItem: WishlistItemDTO | undefined;
      setItems((prev) => {
        removedItem = prev.find(
          (p) => p.productId === productId && (p.variantId || null) === cleanVariantId,
        );
        return prev.filter(
          (p) => !(p.productId === productId && (p.variantId || null) === cleanVariantId),
        );
      });

      if (!isAuthenticated) {
        const guestEntries = getStoredGuestWishlist(storeSlug);
        const filtered = guestEntries.filter(
          (g) => !(g.productId === productId && (g.variantId || null) === cleanVariantId),
        );
        setStoredGuestWishlist(storeSlug, filtered);
        return;
      }

      try {
        await apiClient.delete(`/api/v1/storefront/${encodeURIComponent(storeSlug)}/wishlist`, {
          body: JSON.stringify({
            productId,
            variantId: cleanVariantId,
          }),
        });
      } catch (err) {
        // Rollback
        if (removedItem) {
          setItems((prev) => [removedItem!, ...prev]);
        }
        throw err;
      }
    },
    [storeSlug, isAuthenticated],
  );

  // Remove by ID
  const removeItemById = useCallback(
    async (itemId: string) => {
      if (!itemId || !storeSlug) return;

      let removedItem: WishlistItemDTO | undefined;
      setItems((prev) => {
        removedItem = prev.find((p) => p.id === itemId);
        return prev.filter((p) => p.id !== itemId);
      });

      if (!isAuthenticated && removedItem) {
        const guestEntries = getStoredGuestWishlist(storeSlug);
        const filtered = guestEntries.filter(
          (g) =>
            !(
              g.productId === removedItem!.productId &&
              (g.variantId || null) === (removedItem!.variantId || null)
            ),
        );
        setStoredGuestWishlist(storeSlug, filtered);
        return;
      }

      try {
        await apiClient.delete(`/api/v1/storefront/${encodeURIComponent(storeSlug)}/wishlist`, {
          body: JSON.stringify({
            itemId,
          }),
        });
      } catch (err) {
        if (removedItem) {
          setItems((prev) => [removedItem!, ...prev]);
        }
        throw err;
      }
    },
    [storeSlug, isAuthenticated],
  );

  // Clear all
  const clearWishlist = useCallback(async () => {
    if (!storeSlug) return;
    const previous = [...items];
    setItems([]);

    if (!isAuthenticated) {
      setStoredGuestWishlist(storeSlug, []);
      return;
    }

    try {
      await apiClient.delete(`/api/v1/storefront/${encodeURIComponent(storeSlug)}/wishlist`, {
        body: JSON.stringify({
          clear: true,
        }),
      });
    } catch (err) {
      setItems(previous);
      throw err;
    }
  }, [storeSlug, items, isAuthenticated]);

  // Toggle
  const toggleWishlist = useCallback(
    async (productId: string, variantId?: string | null, metadata?: Partial<WishlistItemDTO>) => {
      if (isInWishlist(productId, variantId)) {
        await removeFromWishlist(productId, variantId);
        return false;
      } else {
        await addToWishlist(productId, variantId, metadata);
        return true;
      }
    },
    [isInWishlist, removeFromWishlist, addToWishlist],
  );

  const value = useMemo<WishlistContextValue>(
    () => ({
      items,
      itemCount: items.length,
      isLoading,
      isInWishlist,
      toggleWishlist,
      addToWishlist,
      removeFromWishlist,
      removeItemById,
      clearWishlist,
      refreshWishlist,
    }),
    [
      items,
      isLoading,
      isInWishlist,
      toggleWishlist,
      addToWishlist,
      removeFromWishlist,
      removeItemById,
      clearWishlist,
      refreshWishlist,
    ],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}

export function useOptionalWishlist(): WishlistContextValue | undefined {
  return useContext(WishlistContext);
}
