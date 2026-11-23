"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import { apiClient } from "../lib/api-client";
import type { SavedCheckoutAddress } from "../components/storefront/checkout/shipping-address-form";

export interface CustomerUser {
  id: string;
  email: string;
  name: string;
}

export interface CustomerProfile {
  id: string;
  storeId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  emailVerified: boolean;
  addresses?: SavedCheckoutAddress[];
}

export interface CustomerAuthContextValue {
  customer: CustomerProfile | null;
  user: CustomerUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | undefined>(undefined);

export interface CustomerAuthProviderProps {
  children: ReactNode;
  storeSlug: string;
}

export function CustomerAuthProvider({ children, storeSlug }: CustomerAuthProviderProps) {
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchAuth = useCallback(async () => {
    if (!storeSlug) {
      setUser(null);
      setCustomer(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await apiClient.get<{
        customer: CustomerProfile | null;
        user: CustomerUser | null;
      }>(`/api/v1/storefront/${encodeURIComponent(storeSlug)}/auth/me`);

      if (res && res.user) {
        setUser(res.user);
        setCustomer(res.customer);
      } else {
        setUser(null);
        setCustomer(null);
      }
    } catch {
      setUser(null);
      setCustomer(null);
    } finally {
      setIsLoading(false);
    }
  }, [storeSlug]);

  useEffect(() => {
    fetchAuth();
  }, [fetchAuth]);

  const logout = useCallback(async () => {
    try {
      await apiClient.post(`/api/v1/storefront/${encodeURIComponent(storeSlug)}/auth/logout`);
    } catch {
      // Proceed with client logout even if endpoint fails
    } finally {
      setUser(null);
      setCustomer(null);
    }
  }, [storeSlug]);

  const value = useMemo<CustomerAuthContextValue>(
    () => ({
      customer,
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      refresh: fetchAuth,
      logout,
    }),
    [customer, user, isLoading, fetchAuth, logout]
  );

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth(): CustomerAuthContextValue {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error("useCustomerAuth must be used within a CustomerAuthProvider");
  }
  return context;
}

export function useOptionalCustomerAuth(): CustomerAuthContextValue | null {
  return useContext(CustomerAuthContext) ?? null;
}
