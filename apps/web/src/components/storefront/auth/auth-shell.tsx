"use client";

import React, { type ReactNode } from "react";
import { motion } from "framer-motion";
import { StorefrontShell } from "../StorefrontShell";
import { useStorefrontIdentity } from "../use-storefront-identity";

interface AuthShellProps {
  storeSlug: string;
  children: ReactNode;
  /** Form column width on wide screens. Register needs a little more room. */
  maxWidth?: "sm" | "md";
}

/**
 * Shared frame for the customer utility pages (sign in, register, password
 * recovery, email verification). Atelier treatment: on large screens a split layout,
 * with the merchant's name set large on the left and the form on the right; on small
 * screens just the form. The page's card is flattened (no box, no shadow) via the
 * `at-auth` rules in globals.css. Motion is opacity-only and honours reduced motion.
 */
export function AuthShell({ storeSlug, children, maxWidth = "sm" }: AuthShellProps) {
  const { storeName, theme } = useStorefrontIdentity(storeSlug);

  return (
    <StorefrontShell storeName={storeName} storeSlug={storeSlug} theme={theme} fullBleed>
      <div className="grid min-h-[calc(100dvh-var(--at-header-h)-6rem)] grid-cols-1 lg:grid-cols-2">
        <aside
          className="hidden flex-col justify-end border-r border-[color:var(--at-hairline)] bg-muted/40 p-[var(--at-gutter)] lg:flex"
          aria-hidden="true"
        >
          <p className="at-eyebrow text-muted-foreground">Customer account</p>
          <p className="at-display-xl mt-4 text-foreground">{storeName}</p>
        </aside>

        <div className="flex items-start justify-center px-[var(--at-gutter)] py-12 sm:py-20 lg:items-center">
          <motion.div
            className={`at-auth w-full ${maxWidth === "md" ? "max-w-lg" : "max-w-md"}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          >
            {children}
          </motion.div>
        </div>
      </div>
    </StorefrontShell>
  );
}
