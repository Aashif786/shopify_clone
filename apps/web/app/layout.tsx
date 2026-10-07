import type { ReactNode } from "react";

export const metadata = {
  title: "Shopify Clone",
  description: "Multi-tenant commerce platform",
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
