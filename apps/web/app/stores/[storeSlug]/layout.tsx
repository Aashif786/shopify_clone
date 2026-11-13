import { ReactNode } from "react";
import { designThemeFontClassName } from "@/lib/design-theme-fonts";
import { CurrencyProvider } from "@/context/currency-context";
import { StorefrontProviders } from "@/components/storefront/storefront-providers";
import { StorefrontMotionProvider } from "@/components/storefront/motion/storefront-motion";

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ storeSlug: string }>;
}

export default async function StorefrontLayout({ children, params }: LayoutProps) {
  const { storeSlug } = await params;
  return (
    <div className={`${designThemeFontClassName} contents`}>
      <StorefrontMotionProvider>
        <CurrencyProvider storeSlug={storeSlug}>
          <StorefrontProviders storeSlug={storeSlug}>{children}</StorefrontProviders>
        </CurrencyProvider>
      </StorefrontMotionProvider>
    </div>
  );
}
