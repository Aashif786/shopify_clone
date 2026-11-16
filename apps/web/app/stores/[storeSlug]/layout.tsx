import { ReactNode } from "react";
import { designThemeFontClassName } from "@/lib/design-theme-fonts";
import { CurrencyProvider } from "@/context/currency-context";
import { StorefrontProviders } from "@/components/storefront/storefront-providers";
import { StorefrontMotionProvider } from "@/components/storefront/motion/storefront-motion";
import type { StorefrontIdentity } from "@/components/storefront/use-storefront-identity";
import { StoreService } from "@calcart/stores";
import { getDb } from "@/lib/db";

const storeService = new StoreService();

/**
 * The store's PUBLISHED name and theme (never a draft), read once on the server so the first
 * paint of every storefront route already uses the merchant's palette. On any failure the
 * client falls back to fetching the same public data itself.
 */
async function loadPublishedIdentity(storeSlug: string): Promise<StorefrontIdentity | undefined> {
  try {
    const published = await storeService.getPublishedLandingPageBySlug(getDb(), storeSlug);
    return {
      storeName: published.store.name,
      theme: published.config?.theme,
      isLoaded: true,
    };
  } catch {
    return undefined;
  }
}

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ storeSlug: string }>;
}

export default async function StorefrontLayout({ children, params }: LayoutProps) {
  const { storeSlug } = await params;
  const initialIdentity = await loadPublishedIdentity(storeSlug);
  return (
    <div className={`${designThemeFontClassName} contents`}>
      <StorefrontMotionProvider>
        <CurrencyProvider storeSlug={storeSlug}>
          <StorefrontProviders storeSlug={storeSlug} initialIdentity={initialIdentity}>
            {children}
          </StorefrontProviders>
        </CurrencyProvider>
      </StorefrontMotionProvider>
    </div>
  );
}
