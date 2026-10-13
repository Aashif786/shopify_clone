"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiClient, ApiClientError } from "../lib/api-client";
import { useAuth } from "./auth-context";

export interface StoreSummary {
  id: string;
  name: string;
  slug: string;
  currency: string;
  role?: "owner" | "admin" | "staff";
}

export const STORE_STORAGE_KEY = "shopify_clone_active_store_id";

export interface StoreContextValue {
  stores: StoreSummary[];
  activeStore: StoreSummary | null;
  isLoading: boolean;
  error: ApiClientError | Error | null;
  selectStore: (storeId: string) => void;
  refreshStores: (selectId?: string) => Promise<StoreSummary[]>;
  clearActiveStore: () => void;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

export interface StoreProviderProps {
  children: ReactNode;
  initialStoreId?: string | null;
  initialStores?: StoreSummary[];
  onStoreChange?: (newStore: StoreSummary | null) => void;
}

function getSavedStoreId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function setSavedStoreId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORE_STORAGE_KEY, id);
  } catch {
    // Ignore storage quota or access errors in sandbox
  }
}

function removeSavedStoreId(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORE_STORAGE_KEY);
  } catch {
    // Ignore storage deletion errors in sandbox
  }
}

export function StoreProvider({
  children,
  initialStoreId = null,
  initialStores = [],
  onStoreChange,
}: StoreProviderProps) {
  const { isAuthenticated } = useAuth();
  const [stores, setStores] = useState<StoreSummary[]>(initialStores);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(initialStoreId);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<ApiClientError | Error | null>(null);

  const refreshStores = useCallback(
    async (selectId?: string): Promise<StoreSummary[]> => {
      if (!isAuthenticated) {
        setStores([]);
        setActiveStoreId(null);
        return [];
      }

      setIsLoading(true);
      setError(null);
      try {
        const response = await apiClient.get<{ items: StoreSummary[] }>("/api/v1/stores");
        const list = response.items || [];
        setStores(list);

        setActiveStoreId((prev) => {
          // 1. Explicitly requested store ID takes priority
          if (selectId && list.some((s) => s.id === selectId)) {
            setSavedStoreId(selectId);
            return selectId;
          }

          // 2. Previously selected store ID if still present in authorized stores
          if (prev && list.some((s) => s.id === prev)) {
            return prev;
          }

          // 3. Saved store ID from localStorage if valid for current user
          const saved = getSavedStoreId();
          if (saved && list.some((s) => s.id === saved)) {
            return saved;
          }

          // 4. Default to first available store or null
          const fallback = list.length > 0 && list[0] ? list[0].id : null;
          if (fallback) {
            setSavedStoreId(fallback);
          } else {
            removeSavedStoreId();
          }
          return fallback;
        });

        return list;
      } catch (err: unknown) {
        setError(err instanceof Error ? err : new Error("Failed to load stores"));
        setStores([]);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthenticated]
  );

  const selectStore = useCallback(
    (storeId: string) => {
      if (storeId === activeStoreId) return;

      const target = stores.find((s) => s.id === storeId);
      if (target) {
        setActiveStoreId(storeId);
        setSavedStoreId(storeId);
        if (onStoreChange) {
          onStoreChange(target);
        }
      }
    },
    [activeStoreId, stores, onStoreChange]
  );

  const clearActiveStore = useCallback(() => {
    setActiveStoreId(null);
    removeSavedStoreId();
    if (onStoreChange) {
      onStoreChange(null);
    }
  }, [onStoreChange]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshStores();
    } else {
      setStores([]);
      setActiveStoreId(null);
      removeSavedStoreId();
    }
  }, [isAuthenticated, refreshStores]);

  const activeStore = stores.find((s) => s.id === activeStoreId) || null;

  const value: StoreContextValue = {
    stores,
    activeStore,
    isLoading,
    error,
    selectStore,
    refreshStores,
    clearActiveStore,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
}
