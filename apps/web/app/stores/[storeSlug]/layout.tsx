import { ReactNode } from "react";
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
    <StorefrontMotionProvider>
      <CurrencyProvider storeSlug={storeSlug}>
        <StorefrontProviders storeSlug={storeSlug}>{children}</StorefrontProviders>
      </CurrencyProvider>
    </StorefrontMotionProvider>
  );
}
