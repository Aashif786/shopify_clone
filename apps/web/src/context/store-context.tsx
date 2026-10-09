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

export interface StoreContextValue {
  stores: StoreSummary[];
  activeStore: StoreSummary | null;
  isLoading: boolean;
  error: ApiClientError | Error | null;
  selectStore: (storeId: string) => void;
  refreshStores: () => Promise<void>;
  clearActiveStore: () => void;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

export interface StoreProviderProps {
  children: ReactNode;
  initialStoreId?: string | null;
  initialStores?: StoreSummary[];
  onStoreChange?: (newStore: StoreSummary | null) => void;
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

  const refreshStores = useCallback(async () => {
    if (!isAuthenticated) {
      setStores([]);
      setActiveStoreId(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{ items: StoreSummary[] }>("/api/v1/stores");
      const list = response.items || [];
      setStores(list);

      // If activeStoreId is not set or not in the retrieved stores list, pick the first one
      setActiveStoreId((prev) => {
        if (prev && list.some((s) => s.id === prev)) {
          return prev;
        }
        return list.length > 0 && list[0] ? list[0].id : null;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error("Failed to load stores"));
      setStores([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const selectStore = useCallback(
    (storeId: string) => {
      if (storeId === activeStoreId) return;

      const target = stores.find((s) => s.id === storeId);
      if (target) {
        // Enforce cache invalidation and state reset when changing store
        setActiveStoreId(storeId);
        if (onStoreChange) {
          onStoreChange(target);
        }
      }
    },
    [activeStoreId, stores, onStoreChange]
  );

  const clearActiveStore = useCallback(() => {
    setActiveStoreId(null);
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
