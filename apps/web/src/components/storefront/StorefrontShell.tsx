"use client";

import React, { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag,
  Menu,
  X,
  Search,
  User,
  ShieldCheck,
  Truck,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
import { ThemeModeToggle } from "../theme-mode-toggle";
import dynamic from "next/dynamic";
import { useOptionalCart } from "../../context/cart-context";

const CartDrawer = dynamic(
  () => import("./cart/cart-drawer").then((mod) => mod.CartDrawer),
  { ssr: false }
);

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
  announcement = "Complimentary shipping on orders over $75 • Use code WELCOME20 for 20% off",
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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="storefront-layout story-storefront min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      {/* 1. Sleek Announcement Bar */}
      {announcement && (
        <aside
          className="storefront-announcement relative z-50 w-full bg-gradient-to-r from-primary/10 via-primary/15 to-primary/10 border-b border-primary/20 py-2 px-4 text-center text-xs font-medium tracking-wide text-foreground flex items-center justify-center gap-2"
          role="region"
          aria-label="Announcement"
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
          <span>{announcement}</span>
        </aside>
      )}

      {/* 2. Glassmorphic Navigation Header */}
      <header
        className="storefront-header sticky top-0 z-40 w-full backdrop-blur-xl bg-background/85 border-b border-border/60 transition-all duration-200"
        role="banner"
      >
        <div className="storefront-header-inner max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
          {/* Mobile menu trigger */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          {/* Store Brand / Logo */}
          <div className="storefront-brand flex items-center">
            <a href={storeHomeHref} className="storefront-brand-name">
              <span className="group inline-flex items-center gap-2 font-bold tracking-tight text-xl sm:text-2xl text-foreground hover:opacity-90 transition-opacity">
                <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-sm font-black shadow-sm group-hover:scale-105 transition-transform">
                  {storeName ? storeName.charAt(0).toUpperCase() : "S"}
                </span>
                <span className="truncate max-w-[200px] sm:max-w-xs">{storeName}</span>
              </span>
            </a>
          </div>

          {/* Desktop Navigation Links */}
          <nav
            className="storefront-nav hidden lg:flex items-center gap-1 xl:gap-2"
            aria-label="Storefront Navigation"
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="storefront-nav-link px-3.5 py-1.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Action Center: Search, Theme, Account, Cart */}
          <div className="storefront-actions flex items-center gap-2 sm:gap-3">
            {storeSlug && (
              <a
                href={`/stores/${storeSlug}/products`}
                className="hidden sm:inline-flex p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Search catalog products"
                title="Search products"
              >
                <Search size={18} />
              </a>
            )}

            <ThemeModeToggle />

            {storeSlug && (
              <a
                href={`/stores/${storeSlug}/account`}
                className="btn btn-outline btn-sm inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                aria-label="Customer Account"
                style={{ textDecoration: "none" }}
              >
                <User size={14} className="hidden sm:inline" />
                <span>Account</span>
              </a>
            )}

            {/* Cart Trigger */}
            <button
              type="button"
              className="btn btn-outline btn-sm storefront-cart-btn relative inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-primary/10 hover:border-primary/40 transition-all duration-200"
              onClick={handleCartClick}
              aria-label={`Shopping cart with ${effectiveCount} items`}
              data-testid="storefront-cart-button"
            >
              <span className="storefront-cart-label inline-flex items-center gap-1.5">
                <ShoppingBag size={15} aria-hidden="true" />
                <span>Cart</span>
              </span>
              {effectiveCount > 0 && (
                <span className="storefront-cart-count" aria-hidden="true">
                  {effectiveCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden border-b border-border/60 bg-background/95 backdrop-blur-xl px-4 pt-3 pb-6 space-y-3"
            >
              <div className="flex flex-col space-y-1">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3 py-2.5 rounded-lg text-base font-medium text-foreground hover:bg-muted transition-colors flex items-center justify-between"
                  >
                    <span>{link.label}</span>
                    <ArrowRight size={16} className="text-muted-foreground" />
                  </a>
                ))}
              </div>

              {storeSlug && (
                <div className="pt-3 border-t border-border/50 flex flex-col gap-2">
                  <a
                    href={`/stores/${storeSlug}/products`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="btn btn-outline btn-md w-full justify-center text-sm gap-2"
                  >
                    <Search size={16} />
                    <span>Search Products</span>
                  </a>
                  <a
                    href={`/stores/${storeSlug}/account`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="btn btn-outline btn-md w-full justify-center text-sm gap-2"
                  >
                    <User size={16} />
                    <span>My Account</span>
                  </a>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* 3. Main Content Container */}
      <motion.main
        className="storefront-main flex-1 w-full"
        role="main"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        {children}
      </motion.main>

      {/* 4. Modern Editorial Footer */}
      <footer className="storefront-footer w-full border-t border-border/60 bg-muted/30 pt-16 pb-12 mt-20" role="contentinfo">
        <div className="storefront-footer-inner max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="storefront-footer-top grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-border/60">
            {/* Store bio */}
            <div className="space-y-4 lg:col-span-1">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-sm font-black shadow-sm">
                  {storeName ? storeName.charAt(0).toUpperCase() : "S"}
                </span>
                <h3 className="font-bold text-lg tracking-tight text-foreground">{storeName}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your one-stop shop for quality products. Handcrafted, curated with care, and shipped directly to your door.
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                <span className="inline-flex items-center gap-1"><ShieldCheck size={14} className="text-primary" /> Verified Merchant</span>
                <span className="inline-flex items-center gap-1"><Truck size={14} className="text-primary" /> Fast Dispatch</span>
              </div>
            </div>

            {/* Quick Links */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Shop</h4>
              <ul className="storefront-nav-list space-y-2.5 text-sm list-none p-0 m-0">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="storefront-nav-link text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                    </a>
                  </li>
                ))}
                {storeSlug && (
                  <li>
                    <a href={`/stores/${storeSlug}/collections`} className="text-muted-foreground hover:text-foreground transition-colors">
                      Featured Collections
                    </a>
                  </li>
                )}
              </ul>
            </div>

            {/* Customer Care */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer Support</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground list-none p-0 m-0">
                {storeSlug && (
                  <>
                    <li>
                      <a href={`/stores/${storeSlug}/account/orders`} className="hover:text-foreground transition-colors">
                        Order Tracking
                      </a>
                    </li>
                    <li>
                      <a href={`/stores/${storeSlug}/about`} className="hover:text-foreground transition-colors">
                        Shipping & Returns
                      </a>
                    </li>
                  </>
                )}
                <li className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                  <RotateCcw size={13} /> 30-day effortless returns policy
                </li>
              </ul>
            </div>

            {/* Newsletter Club */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stay Connected</h4>
              <p className="text-xs text-muted-foreground">
                Join our newsletter for exclusive drops, seasonal sales, and member-only promotions.
              </p>
              <form onSubmit={(e) => e.preventDefault()} className="flex gap-1.5">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary flex-1 min-w-0"
                />
                <button
                  type="submit"
                  className="btn btn-primary btn-sm rounded-lg px-3 text-xs shrink-0"
                >
                  Join
                </button>
              </form>
            </div>
          </div>

          {/* Footer bottom bar */}
          <div className="storefront-footer-bottom pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <span>© {new Date().getFullYear()} {storeName}. All rights reserved.</span>
            <div className="flex items-center gap-6">
              <span>Secure Razorpay 256-bit SSL Checkout</span>
              <span className="font-medium text-foreground/80">Powered by Shopify Clone</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Cart Drawer Component */}
      {cartContext && <CartDrawer storeSlug={storeSlug} />}
    </div>
  );
}
