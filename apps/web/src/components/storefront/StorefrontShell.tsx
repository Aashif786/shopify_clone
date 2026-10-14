"use client";

import React, { type ReactNode } from "react";
import { motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { ThemeModeToggle } from "../theme-mode-toggle";
import { useOptionalCart } from "../../context/cart-context";
import { CartDrawer } from "./cart/cart-drawer";

export interface StorefrontNavLink {
  label: string;
  href: string;
}

export interface StorefrontShellProps {
  children: ReactNode;
  storeName: string;
  storeSlug?: string;
  cartItemCount?: number;
  announcement?: string;
  navLinks?: StorefrontNavLink[];
  onCartClick?: () => void;
}

export function StorefrontShell({
  children,
  storeName,
  storeSlug,
  cartItemCount,
  announcement,
  navLinks = [
    { label: "Products", href: storeSlug ? `/stores/${storeSlug}/products` : "/products" },
    { label: "Collections", href: storeSlug ? `/stores/${storeSlug}/collections` : "/collections" },
    { label: "About", href: storeSlug ? `/stores/${storeSlug}/about` : "/about" },
  ],
  onCartClick,
}: StorefrontShellProps) {
  const storeHomeHref = storeSlug ? `/stores/${storeSlug}` : "/";
  const cartContext = useOptionalCart();
  const effectiveCount = cartItemCount !== undefined ? cartItemCount : (cartContext?.itemCount ?? 0);
  const handleCartClick = onCartClick || cartContext?.openDrawer;

  return (
    <div className="storefront-layout">
      {/* Announcement Banner */}
      {announcement && (
        <aside className="storefront-announcement" role="region" aria-label="Announcement">
          {announcement}
        </aside>
      )}

      {/* Storefront Header */}
      <header className="storefront-header" role="banner">
        <div className="storefront-header-inner">
          {/* Brand Logo / Store Name */}
          <div className="storefront-brand">
            <a href={storeHomeHref} className="storefront-brand-name">
              {storeName}
            </a>
          </div>

          {/* Navigation Links */}
          <nav className="storefront-nav" aria-label="Storefront Navigation">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="storefront-nav-link">
                {link.label}
              </a>
            ))}
          </nav>

          {/* Store Actions / Cart */}
          <div className="storefront-actions">
            <ThemeModeToggle />
            <button
              type="button"
              className="btn btn-outline btn-sm storefront-cart-btn"
              onClick={handleCartClick}
              aria-label={`Shopping cart with ${effectiveCount} items`}
              data-testid="storefront-cart-button"
            >
              <span className="storefront-cart-label"><ShoppingBag aria-hidden="true" /> Cart</span>
              {effectiveCount > 0 && (
                <span className="storefront-cart-count" aria-hidden="true">
                  {effectiveCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <motion.main
        className="storefront-main"
        role="main"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        {children}
      </motion.main>

      {/* Storefront Footer */}
      <footer className="storefront-footer" role="contentinfo">
        <div className="storefront-footer-inner">
          <div className="storefront-footer-top">
            <div>
              <h3>{storeName}</h3>
              <p>Your one-stop shop for quality products.</p>
            </div>
            <div>
              <h4>Quick Links</h4>
              <ul className="storefront-nav-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {navLinks.map((link) => (
                  <li key={link.href} style={{ marginBottom: "var(--space-2)" }}>
                    <a href={link.href} className="storefront-nav-link">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="storefront-footer-bottom">
            <span>© {new Date().getFullYear()} {storeName}. All rights reserved.</span>
            <span>Powered by Shopify Clone</span>
          </div>
        </div>
      </footer>

      {/* Cart Drawer Overlay (active if CartProvider is mounted) */}
      {cartContext && <CartDrawer storeSlug={storeSlug} />}
    </div>
  );
}
