"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  applyAppearanceToTheme,
  isStorefrontAppearance,
  resolveAppearance,
  type LandingPageTheme,
  type StorefrontAppearance,
} from "@calcart/stores/landing-page";

/**
 * Visitor appearance (light/dark) for a storefront, used only when the merchant has
 * enabled the appearance toggle. The choice is a per-store, per-browser convenience, so it
 * lives in localStorage (same-origin, never sent to the server). Every read is guarded:
 * storage can be blocked in private windows, and the page must still render.
 */

const CHANGE_EVENT = "calcart:storefront-appearance";

export function appearanceStorageKey(storeSlug: string): string {
  return `cc_${storeSlug.trim().toLowerCase()}_appearance`;
}

function readChoice(storeSlug: string | undefined): StorefrontAppearance | null {
  if (!storeSlug || typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(appearanceStorageKey(storeSlug));
    return isStorefrontAppearance(stored) ? stored : null;
  } catch {
    return null;
  }
}

function readSystem(): StorefrontAppearance | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  const media =
    typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  media?.addEventListener?.("change", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
    media?.removeEventListener?.("change", callback);
  };
}

export interface StorefrontAppearanceState {
  /** The appearance currently rendered. */
  appearance: StorefrontAppearance;
  /** True only when the merchant enabled the toggle; gate the toggle UI on this. */
  toggleEnabled: boolean;
  /** The theme to render: the merchant theme, re-expressed for `appearance` when toggling is enabled. */
  theme: LandingPageTheme | undefined;
  setAppearance: (next: StorefrontAppearance) => void;
}

/**
 * Resolves the theme a storefront should actually render.
 *
 * With the toggle off this returns the merchant's theme untouched (so legacy and
 * non-toggle stores render exactly as before). With it on, the visitor's saved choice wins,
 * then the system preference, then the merchant default.
 */
export function useStorefrontAppearance(
  theme: LandingPageTheme | undefined,
  storeSlug: string | undefined,
): StorefrontAppearanceState {
  const toggleEnabled = theme?.appearanceToggle === true;

  const choice = useSyncExternalStore(
    subscribe,
    () => (toggleEnabled ? readChoice(storeSlug) : null),
    () => null,
  );
  const system = useSyncExternalStore(
    subscribe,
    () => (toggleEnabled ? readSystem() : null),
    () => null,
  );

  const appearance = resolveAppearance(theme, choice, system);

  const effectiveTheme = useMemo(() => {
    if (!theme || !toggleEnabled) return theme;
    return applyAppearanceToTheme(theme, appearance);
  }, [theme, toggleEnabled, appearance]);

  const setAppearance = useCallback(
    (next: StorefrontAppearance) => {
      if (!storeSlug) return;
      try {
        window.localStorage.setItem(appearanceStorageKey(storeSlug), next);
      } catch {
        // Storage unavailable: the choice simply is not remembered.
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [storeSlug],
  );

  return { appearance, toggleEnabled, theme: effectiveTheme, setAppearance };
}
