"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "../../src/context/auth-context";
import { StoreProvider } from "../../src/context/store-context";
import { Spinner } from "@shopify-clone/ui";

const PUBLIC_MERCHANT_ROUTES = [
  "/merchant/login",
  "/merchant/register",
  "/merchant/forgot-password",
  "/merchant/reset-password",
];

function MerchantAuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicRoute =
    PUBLIC_MERCHANT_ROUTES.some(
      (route) => pathname === route || pathname?.startsWith(route + "/")
    ) || pathname?.startsWith("/merchant/invitations");

  useEffect(() => {
    if (!isLoading && !user && !isPublicRoute) {
      const redirectUrl = pathname
        ? `/merchant/login?redirect=${encodeURIComponent(pathname)}`
        : "/merchant/login";
      router.push(redirectUrl);
    }
  }, [isLoading, user, isPublicRoute, pathname, router]);

  if (isLoading && !isPublicRoute) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <Spinner size="lg" label="Authenticating merchant..." />
      </div>
    );
  }

  if (!user && !isPublicRoute) {
    return null;
  }

  return <>{children}</>;
}

export default function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <StoreProvider>
        <MerchantAuthGuard>{children}</MerchantAuthGuard>
      </StoreProvider>
    </AuthProvider>
  );
}
