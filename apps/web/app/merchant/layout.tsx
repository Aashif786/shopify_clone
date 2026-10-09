"use client";

import React from "react";
import { AuthProvider } from "../../src/context/auth-context";
import { StoreProvider } from "../../src/context/store-context";

export default function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <StoreProvider>
        {children}
      </StoreProvider>
    </AuthProvider>
  );
}
