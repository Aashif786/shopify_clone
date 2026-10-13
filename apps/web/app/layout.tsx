import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Shopify Clone — Commerce, with character",
  description: "A thoughtful multi-tenant commerce platform for modern merchants and storefronts.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
