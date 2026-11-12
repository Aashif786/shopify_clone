"use client";

import { useEffect, useState } from "react";
import type { LandingPageTheme } from "@calcart/stores/landing-page";
import { apiClient } from "../../lib/api-client";

export interface StorefrontIdentity {
  storeName: string;
  theme?: LandingPageTheme;
  isLoaded: boolean;
}

interface LandingIdentityResponse {
  store?: { name?: string };
  config?: { theme?: LandingPageTheme } | null;
}

/**
 * Resolves the merchant's real store name and theme from the public landing-page
 * endpoint so utility pages (sign in, register, recovery) keep the store's identity
 * instead of showing a generic label. Falls back to a neutral name on failure.
 */
export function useStorefrontIdentity(storeSlug: string, fallbackName = "Store"): StorefrontIdentity {
  const [identity, setIdentity] = useState<StorefrontIdentity>({
    storeName: fallbackName,
    isLoaded: false,
  });

  useEffect(() => {
    let active = true;
    apiClient
      .get<LandingIdentityResponse>(`/api/v1/storefront/${encodeURIComponent(storeSlug)}/landing-page`)
      .then((res) => {
        if (!active) return;
        setIdentity({
          storeName: res?.store?.name || fallbackName,
          theme: res?.config?.theme,
          isLoaded: true,
        });
      })
      .catch(() => {
        if (active) setIdentity((prev) => ({ ...prev, isLoaded: true }));
      });
    return () => {
      active = false;
    };
  }, [storeSlug, fallbackName]);

  return identity;
}
