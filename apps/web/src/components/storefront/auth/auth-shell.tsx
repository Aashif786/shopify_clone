"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { StorefrontShell } from "../StorefrontShell";
import { useStorefrontIdentity } from "../use-storefront-identity";

interface AuthShellProps {
  storeSlug: string;
  children: ReactNode;
  /** Card width on wide screens. Register needs a little more room. */
  maxWidth?: "sm" | "md";
}

/**
 * Shared frame for the customer utility pages (sign in, register, password
 * recovery, email verification). It keeps the merchant's own name and theme in the
 * header, centres the form card on a soft branded backdrop, and fades the card in
 * (opacity/transform only; motion is disabled automatically for reduced-motion users).
 */
export function AuthShell({ storeSlug, children, maxWidth = "sm" }: AuthShellProps) {
  const { storeName, theme } = useStorefrontIdentity(storeSlug);

  return (
    <StorefrontShell storeName={storeName} storeSlug={storeSlug} theme={theme}>
      <div className="relative isolate">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent"
        />
        <div className="flex min-h-[calc(100dvh-14rem)] items-start sm:items-center justify-center px-4 py-10 sm:py-16">
          <motion.div
            className={`w-full ${maxWidth === "md" ? "max-w-lg" : "max-w-md"} [&>*]:rounded-3xl [&>*]:shadow-xl [&>*]:shadow-black/5`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
          >
            {children}
          </motion.div>
        </div>
      </div>
    </StorefrontShell>
  );
}
