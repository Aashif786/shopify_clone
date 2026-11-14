"use client";

import React, { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import type { LandingPageTheme } from "@calcart/stores/landing-page";
import { resolveDesignThemeTokens, resolveThemeSemanticTokens } from "@calcart/stores/landing-page";
import "./design-themes.css";
import { designThemeFontClassName } from "../../lib/design-theme-fonts";
import { resolveFontFamily } from "../../lib/font-library";
import { useStorefrontAppearance, type StorefrontAppearanceState } from "../../lib/storefront-appearance";
import { useLayoutStorefrontIdentity } from "./use-storefront-identity";

/**
 * Single place where a store's PUBLISHED design-system theme becomes the CSS custom
 * properties, data attributes and classes every storefront surface inherits.
 *
 * The same resolution is used by `StorefrontShell`, the route error/not-found/loading states
 * and anything portalled out of the shell, so no surface can fall back to platform defaults
 * while the rest of the page carries the merchant's theme. Design theme (Rustic Heritage, ...)
 * and light/dark appearance stay independent: appearance only re-expresses the palette of the
 * selected design theme (see `useStorefrontAppearance`), it never swaps the design theme.
 */

/**
 * Maps the merchant's heading-font choice onto the display face used by Atelier type.
 * No choice (or "serif") keeps the Atelier serif, so a store that never configured
 * typography still gets the platform identity while a merchant's explicit choice wins.
 */
function resolveDisplayFont(theme?: LandingPageTheme): string {
  const heading = theme?.typography?.headingFont;
  if (!heading) return "var(--at-serif)";
  if (heading === "sans") return "var(--font-sans)";
  if (heading === "display") return "var(--font-display, var(--font-sans))";
  if (heading === "mono") return "var(--font-mono)";
  return resolveFontFamily(heading, "var(--at-serif)");
}

type ThemeDataAttributes = ReturnType<typeof resolveDesignThemeTokens>["dataAttributes"];

export interface StorefrontThemeRoot {
  appearance: StorefrontAppearanceState;
  designTheme: ReturnType<typeof resolveDesignThemeTokens>;
  /** Classes that carry fonts, surface colours and the light/dark mode class. */
  className: string;
  style: CSSProperties;
  dataAttributes: ThemeDataAttributes;
  isCustomDesign: boolean;
}

/**
 * Resolves the theme root for a storefront subtree. A page's own `theme` wins; otherwise the
 * layout-level published identity for `storeSlug` is used (never another store's).
 */
export function useStorefrontThemeRoot(
  theme: LandingPageTheme | undefined,
  storeSlug: string | undefined,
): StorefrontThemeRoot {
  const identity = useLayoutStorefrontIdentity(storeSlug);
  const baseTheme = theme ?? identity?.theme;
  // With the merchant's appearance toggle on, the visitor's saved/system choice is applied;
  // with it off this returns the merchant theme unchanged.
  const appearance = useStorefrontAppearance(baseTheme, storeSlug);
  const effectiveTheme = appearance.theme;

  const designTheme = React.useMemo(
    () => resolveDesignThemeTokens(effectiveTheme?.designTheme),
    [effectiveTheme?.designTheme],
  );
  const isCustomDesign = designTheme.id !== "rustic-heritage";
  const semanticTheme = React.useMemo(
    () => (effectiveTheme ? resolveThemeSemanticTokens(effectiveTheme) : null),
    [effectiveTheme],
  );
  const style = React.useMemo(() => {
    const headingFamily = resolveFontFamily(effectiveTheme?.typography?.headingFont, "inherit");
    const bodyFamily = resolveFontFamily(effectiveTheme?.typography?.bodyFont, "inherit");
    return {
      ...designTheme.cssVars,
      ...(semanticTheme?.cssVars ?? {}),
      "--landing-font-heading": headingFamily,
      "--landing-font-body": bodyFamily,
      ...(effectiveTheme?.typography?.headingFont ? { "--ds-font-heading": headingFamily } : {}),
      ...(effectiveTheme?.typography?.bodyFont ? { "--ds-font-body": bodyFamily } : {}),
      // Rustic Heritage keeps honouring the merchant's heading-font choice; the other
      // design themes bring their own display face.
      "--at-display": isCustomDesign ? "var(--ds-font-heading)" : resolveDisplayFont(effectiveTheme),
    } as CSSProperties;
  }, [semanticTheme, effectiveTheme, designTheme, isCustomDesign]);

  return {
    appearance,
    designTheme,
    className: `storefront-layout ${designThemeFontClassName} bg-background text-foreground antialiased selection:bg-primary/20 selection:text-foreground ${semanticTheme?.modeClass || ""}`,
    style,
    dataAttributes: designTheme.dataAttributes,
    isCustomDesign,
  };
}

/**
 * Wraps content that is rendered OUTSIDE the shell (route error / not-found / loading states)
 * in the same theme root, so it matches the store instead of showing platform defaults.
 */
export function StorefrontThemeScope({
  storeSlug,
  as: Tag = "div",
  className = "",
  children,
  ...rest
}: {
  storeSlug: string | undefined;
  as?: "div" | "main";
  className?: string;
  children: ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "style">) {
  const root = useStorefrontThemeRoot(undefined, storeSlug);
  return (
    <Tag
      className={`${root.className} ${className}`}
      style={root.style}
      {...root.dataAttributes}
      data-ds-custom={root.isCustomDesign ? "true" : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/**
 * The shell root element. Portalled surfaces (dialogs, drawers, popups) must mount inside it
 * so they inherit the active theme's CSS variables, fonts and data attributes. Null outside a
 * shell (isolated components); callers then fall back to the document body.
 */
export const StorefrontPortalContainerContext = createContext<HTMLElement | null>(null);

export function useStorefrontPortalContainer(): HTMLElement | null {
  return useContext(StorefrontPortalContainerContext);
}
