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
  Lock,
} from "lucide-react";
import { ThemeModeToggle } from "../theme-mode-toggle";
import { useOptionalCart } from "../../context/cart-context";
import { CartDrawer } from "./cart/cart-drawer";
import { Marquee } from "../ui/marquee";

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
  announcement = "Complimentary shipping on orders over $75 \u2022 Use code WELCOME20 for 20% off",
  navLinks = [
    { label: "Products", href: storeSlug ? `/stores/${storeSlug}/products` : "/products" },
    { label: "Collections", href: storeSlug ? `/stores/${storeSlug}/collections` : "/collections" },
    { label: "About", href: storeSlug ? `/stores/${storeSlug}/about` : "/about" },
  ],
  onCartClick,
}: StorefrontShellProps) {
  const storeHomeHref = storeSlug ? `/stores/${storeSlug}` : "/";
  const cartContext = useOptionalCart();
  const effectiveCount =
    cartItemCount !== undefined ? cartItemCount : (cartContext?.itemCount ?? 0);

  const handleCartClick = () => {
    if (onCartClick) {
      onCartClick();
    } else if (cartContext?.openDrawer) {
      cartContext.openDrawer();
    } else if (storeSlug) {
      window.location.href = `/stores/${encodeURIComponent(storeSlug)}/cart`;
    }
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="storefront-layout min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      {/* 1. Announcement Bar — 36px, marquee ticker */}
      {announcement && (
        <aside
          className="storefront-announcement relative z-50 w-full bg-primary/10 border-b border-primary/20 overflow-hidden"
          style={{ height: "36px" }}
          role="region"
          aria-label="Announcement"
        >
          <Marquee
            pauseOnHover
            className="h-full [--duration:28s] [--gap:3rem] py-0"
          >
            <span className="inline-flex items-center gap-3 text-xs font-medium tracking-wide text-foreground/90 whitespace-nowrap px-4">
              <span
                className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0"
                aria-hidden="true"
              />
              {announcement}
            </span>
          </Marquee>
        </aside>
      )}

      {/* 2. Sticky Glassmorphic Navigation Header */}
      <header
        className="storefront-header sticky top-0 z-40 w-full border-b border-border/60 transition-all duration-200"
        style={{
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          backgroundColor: "color-mix(in oklab, var(--color-background) 85%, transparent)",
          boxShadow: "inset 0 -1px 0 rgba(255,255,255,0.04)",
        }}
        role="banner"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4"
          style={{ height: "64px" }}
        >
          {/* Mobile menu trigger */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 -ml-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
            >
              <AnimatePresence mode="wait" initial={false}>
                {mobileMenuOpen ? (
                  <motion.span
                    key="close"
                    initial={{ opacity: 0, rotate: -45, scale: 0.8 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, rotate: 45, scale: 0.8 }}
                    transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                    className="block"
                  >
                    <X size={20} />
                  </motion.span>
                ) : (
                  <motion.span
                    key="open"
                    initial={{ opacity: 0, rotate: 45, scale: 0.8 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, rotate: -45, scale: 0.8 }}
                    transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                    className="block"
                  >
                    <Menu size={20} />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>

          {/* Store Brand / Logo */}
          <div className="storefront-brand flex items-center">
            <a href={storeHomeHref} className="group inline-flex items-center gap-2.5">
              <span
                className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center text-sm font-black shadow-sm transition-transform duration-150 group-hover:scale-105"
                aria-hidden="true"
              >
                {storeName ? storeName.charAt(0).toUpperCase() : "S"}
              </span>
              <span className="font-bold tracking-tight text-lg text-foreground truncate max-w-[180px] sm:max-w-xs">
                <span className="storefront-brand-name">{storeName}</span>
              </span>
            </a>
          </div>

          {/* Desktop Navigation Links — center */}
          <nav
            className="storefront-nav hidden lg:flex items-center gap-1"
            aria-label="Storefront Navigation"
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="storefront-nav-link px-4 py-2 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors duration-150"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right: Search, Theme, Account, Cart */}
          <div className="storefront-actions flex items-center gap-1.5 sm:gap-2">
            {storeSlug && (
              <a
                href={`/stores/${storeSlug}/products`}
                className="hidden sm:inline-flex p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                className="hidden sm:inline-flex p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Customer Account"
                title="Account"
              >
                <User size={18} />
              </a>
            )}

            {/* Cart Button */}
            <button
              type="button"
              onClick={handleCartClick}
              aria-label={`Shopping cart with ${effectiveCount} items`}
              data-testid="storefront-cart-button"
              className="storefront-cart-btn relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold border border-border/60 text-foreground bg-muted/30 hover:bg-muted/60 hover:border-primary/40 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.97]"
              style={{ transition: "transform 150ms cubic-bezier(0.23,1,0.32,1), background-color 150ms ease, border-color 150ms ease" }}
            >
              <ShoppingBag size={15} aria-hidden="true" />
              <span className="hidden sm:inline">Cart</span>
              {effectiveCount > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-black transition-transform duration-150 animate-in zoom-in-50">
                  <span className="storefront-cart-count" aria-hidden="true">{effectiveCount}</span>
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Full-Screen Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              className="lg:hidden fixed inset-0 top-[calc(36px+64px)] z-30 bg-background/98 border-t border-border/60 flex flex-col px-6 pt-8 pb-10"
              style={{
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
              }}
            >
              {/* Close button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                aria-label="Close navigation menu"
              >
                <X size={20} />
              </button>

              {/* Nav links — large */}
              <nav className="flex flex-col gap-2" aria-label="Mobile Storefront Navigation">
                {navLinks.map((link, i) => (
                  <motion.a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.2,
                      delay: i * 0.05,
                      ease: [0.23, 1, 0.32, 1],
                    }}
                    className="flex items-center justify-between px-4 py-4 rounded-2xl text-2xl font-bold text-foreground hover:bg-muted/60 transition-colors"
                  >
                    <span>{link.label}</span>
                    <ArrowRight size={20} className="text-muted-foreground" />
                  </motion.a>
                ))}
              </nav>

              {/* Mobile utility links */}
              {storeSlug && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.18, duration: 0.2 }}
                  className="mt-auto pt-8 border-t border-border/50 flex flex-col gap-2"
                >
                  <a
                    href={`/stores/${storeSlug}/products`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="btn btn-outline btn-md w-full justify-center text-sm gap-2 rounded-xl"
                  >
                    <Search size={16} />
                    <span>Search Products</span>
                  </a>
                  <a
                    href={`/stores/${storeSlug}/account`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="btn btn-outline btn-md w-full justify-center text-sm gap-2 rounded-xl"
                  >
                    <User size={16} />
                    <span>My Account</span>
                  </a>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* 3. Main Content */}
      <motion.main
        className="storefront-main flex-1 w-full"
        role="main"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      >
        {children}
      </motion.main>

      {/* 4. Editorial Footer */}
      <footer
        className="storefront-footer w-full border-t border-border/60 bg-muted/20 pt-16 pb-10 mt-20"
        role="contentinfo"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* 4-column footer grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-border/60">
            {/* Col 1: Brand */}
            <div className="space-y-4 lg:col-span-1">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center text-sm font-black shadow-sm">
                  {storeName ? storeName.charAt(0).toUpperCase() : "S"}
                </span>
                <h3 className="font-bold text-base tracking-tight text-foreground">
                  {storeName}
                </h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px]">
                Handpicked products crafted with care, shipped directly to your door. Quality you can trust.
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-primary" />
                  Verified Merchant
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Truck size={13} className="text-primary" />
                  Fast Dispatch
                </span>
              </div>
            </div>

            {/* Col 2: Shop */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Shop
              </h4>
              <ul className="space-y-2.5 text-sm list-none p-0 m-0">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground transition-colors duration-150"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
                {storeSlug && (
                  <li>
                    <a
                      href={`/stores/${storeSlug}/collections`}
                      className="text-muted-foreground hover:text-foreground transition-colors duration-150"
                    >
                      Featured Collections
                    </a>
                  </li>
                )}
              </ul>
            </div>

            {/* Col 3: Support */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Support
              </h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground list-none p-0 m-0">
                {storeSlug && (
                  <>
                    <li>
                      <a
                        href={`/stores/${storeSlug}/account/orders`}
                        className="hover:text-foreground transition-colors duration-150"
                      >
                        Order Tracking
                      </a>
                    </li>
                    <li>
                      <a
                        href={`/stores/${storeSlug}/about`}
                        className="hover:text-foreground transition-colors duration-150"
                      >
                        Shipping &amp; Returns
                      </a>
                    </li>
                    <li>
                      <a
                        href={`/stores/${storeSlug}/about`}
                        className="hover:text-foreground transition-colors duration-150"
                      >
                        Contact Us
                      </a>
                    </li>
                  </>
                )}
                <li className="flex items-center gap-1.5 text-xs pt-1">
                  <RotateCcw size={12} />
                  30-day effortless returns
                </li>
              </ul>
            </div>

            {/* Col 4: Payment trust */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Secure Payments
              </h4>
              <div className="flex flex-wrap gap-2">
                {["Visa", "Mastercard", "UPI", "NetBanking", "Wallets"].map((method) => (
                  <span
                    key={method}
                    className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold border border-border/70 text-muted-foreground bg-muted/30"
                  >
                    {method}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                <Lock size={12} className="text-primary" />
                <span>256-bit SSL encryption</span>
              </div>
              <p className="text-xs text-muted-foreground">
                All transactions are secured and processed by Razorpay.
              </p>
            </div>
          </div>

          {/* Footer bottom bar */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <span>
              &copy; {new Date().getFullYear()} {storeName}. All rights reserved.
            </span>
            <div className="flex items-center gap-5">
              <span className="flex items-center gap-1.5">
                <Lock size={11} className="text-primary" />
                Secured by Razorpay
              </span>
              <span className="text-muted-foreground/60">Powered by Shopify Clone</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Cart Drawer */}
      {cartContext && <CartDrawer storeSlug={storeSlug} />}
    </div>
  );
}
