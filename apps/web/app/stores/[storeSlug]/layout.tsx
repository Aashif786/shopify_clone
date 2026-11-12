import { ReactNode } from "react";
import { CurrencyProvider } from "@/context/currency-context";

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ storeSlug: string }>;
}

export default async function StorefrontLayout({ children, params }: LayoutProps) {
  const { storeSlug } = await params;
  return (
    <CurrencyProvider storeSlug={storeSlug}>
      {children}
    </CurrencyProvider>
  );
}
