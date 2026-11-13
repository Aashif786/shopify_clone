import { ReactNode } from "react";
import { Fraunces } from "next/font/google";
import { CurrencyProvider } from "@/context/currency-context";
import { StorefrontProviders } from "@/components/storefront/storefront-providers";
import { StorefrontMotionProvider } from "@/components/storefront/motion/storefront-motion";

// Atelier display serif. Scoped to the storefront subtree (not the root layout) so the
// merchant dashboard and platform admin never download it. `opsz` lets large headlines
// use the high-contrast display cut and small text the sturdier text cut.
const atelierSerif = Fraunces({
  subsets: ["latin"],
  variable: "--font-atelier-serif",
  axes: ["opsz"],
  display: "swap",
});

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ storeSlug: string }>;
}

export default async function StorefrontLayout({ children, params }: LayoutProps) {
  const { storeSlug } = await params;
  return (
    <div className={`${atelierSerif.variable} contents`}>
      <StorefrontMotionProvider>
        <CurrencyProvider storeSlug={storeSlug}>
          <StorefrontProviders storeSlug={storeSlug}>{children}</StorefrontProviders>
        </CurrencyProvider>
      </StorefrontMotionProvider>
    </div>
  );
}
