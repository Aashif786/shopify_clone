"use client";

import { createContext, useContext, useEffect, useState } from "react";
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
 * Set once by `StorefrontProviders` in the storefront layout. Every route under
 * /stores/[slug] reads the same published identity from here instead of fetching it again.
 * `slug` records which store the identity belongs to so it can never be served to another.
 */
export const StorefrontIdentityContext = createContext<(StorefrontIdentity & { slug: string }) | null>(null);

interface FetchedIdentity extends StorefrontIdentity {
  slug: string;
}

/**
 * Fetches a store's PUBLISHED identity (name + theme) from the public landing-page endpoint.
 * Drafts are never exposed there. The result is tagged with its store slug and discarded when
 * the slug changes, so store A's theme can never render for store B while B is loading.
 */
function useFetchedIdentity(storeSlug: string, fallbackName: string, enabled: boolean): StorefrontIdentity & { slug: string } {
  const [fetched, setFetched] = useState<FetchedIdentity | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    apiClient
      .get<LandingIdentityResponse>(`/api/v1/storefront/${encodeURIComponent(storeSlug)}/landing-page`)
      .then((res) => {
        if (!active) return;
        setFetched({
          slug: storeSlug,
          storeName: res?.store?.name || fallbackName,
          theme: res?.config?.theme,
          isLoaded: true,
        });
      })
      .catch(() => {
        // Missing/failed theme data keeps the platform fallback (no theme).
        if (active) setFetched({ slug: storeSlug, storeName: fallbackName, isLoaded: true });
      });
    return () => {
      active = false;
    };
  }, [storeSlug, fallbackName, enabled]);

  return fetched && fetched.slug === storeSlug
    ? fetched
    : { slug: storeSlug, storeName: fallbackName, isLoaded: false };
}

/**
 * Resolves the merchant's real store name and theme so utility pages keep the store's
 * identity instead of a generic label.
 *
 * Inside the storefront layout this returns the layout-level identity (one request for the
 * whole subtree, as long as it belongs to `storeSlug`); only when rendered outside the
 * provider (isolated components/tests) does it fetch for itself. Falls back to a neutral
 * name on failure.
 */
export function useStorefrontIdentity(storeSlug: string, fallbackName = "Store"): StorefrontIdentity {
  const shared = useContext(StorefrontIdentityContext);
  const usesShared = shared !== null && shared.slug === storeSlug;
  const own = useFetchedIdentity(storeSlug, fallbackName, !usesShared);
  const resolved = usesShared ? shared : own;
  return { storeName: resolved.storeName, theme: resolved.theme, isLoaded: resolved.isLoaded };
}

/** The layout-level identity for `storeSlug`, or null outside the provider / for another store. */
export function useLayoutStorefrontIdentity(storeSlug?: string): StorefrontIdentity | null {
  const shared = useContext(StorefrontIdentityContext);
  if (!shared) return null;
  if (storeSlug !== undefined && shared.slug !== storeSlug) return null;
  return shared;
}
