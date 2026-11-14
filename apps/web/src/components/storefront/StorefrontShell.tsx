"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ShoppingBag, Menu, Search, User, Heart } from "lucide-react";
import { AppearanceToggle } from "./shell/appearance-toggle";
import { CurrencySelector } from "./currency-selector";
import { useOptionalCart } from "../../context/cart-context";
import { useOptionalWishlist } from "../../context/wishlist-context";
import { CartDrawer } from "./cart/cart-drawer";
import { IndexMenu } from "./shell/index-menu";
import { StorefrontFooter } from "./shell/storefront-footer";
import { useLayoutStorefrontIdentity } from "./use-storefront-identity";
import {
  StorefrontPortalContainerContext,
  useStorefrontThemeRoot,
} from "./storefront-theme-root";
import { FontLoader } from "./landing-page/font-loader";
import type { LandingPageTheme } from "@calcart/stores/landing-page";

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
  fullBleed?: boolean;
  theme?: LandingPageTheme;
}

const iconButton =
  "at-press h-10 w-10 items-center justify-center text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const PLACEHOLDER_STORE_NAMES = new Set(["", "Online Store", "Store"]);

export function StorefrontShell({
  children,
  storeName: storeNameProp,
  storeSlug,
  cartItemCount,
  announcement,
  navLinks = [
    { label: "Products", href: storeSlug ? `/stores/${storeSlug}/products` : "/products" },
    { label: "Collections", href: storeSlug ? `/stores/${storeSlug}/collections` : "/collections" },
    { label: "Gift Cards", href: storeSlug ? `/stores/${storeSlug}/gift-cards` : "/gift-cards" },
    { label: "About", href: storeSlug ? `/stores/${storeSlug}/about` : "/about" },
  ],
  onCartClick,
  fullBleed = false,
  theme,
}: StorefrontShellProps) {
  const storeHomeHref = storeSlug ? `/stores/${storeSlug}` : "/";
  const pathname = usePathname();
  const identity = useLayoutStorefrontIdentity(storeSlug);
  // Pages pass a placeholder while their own data loads; the layout-level identity has the real name.
  const storeName =
    PLACEHOLDER_STORE_NAMES.has(storeNameProp) && identity?.isLoaded && identity.storeName
      ? identity.storeName
      : storeNameProp;
  // One resolution of the published theme (page's own theme, else the layout identity for THIS
  // store) shared with the error/not-found states and portalled surfaces.
  const themeRoot = useStorefrontThemeRoot(theme, storeSlug);
  const { appearance, designTheme } = themeRoot;
  const inlineHeader = designTheme.definition.variants.header === "inline";

  const cartContext = useOptionalCart();
  const wishlistContext = useOptionalWishlist();
  const wishlistCount = wishlistContext?.itemCount ?? 0;
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

  const [indexOpen, setIndexOpen] = useState(false);
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);

  const utilityLinks: StorefrontNavLink[] = storeSlug
    ? [
        { label: "Search products", href: `/stores/${storeSlug}/products` },
        {
          label: wishlistCount > 0 ? `Wishlist (${wishlistCount})` : "Wishlist",
          href: `/stores/${storeSlug}/wishlist`,
        },
        { label: "My account", href: `/stores/${storeSlug}/account` },
        { label: "Order tracking", href: `/stores/${storeSlug}/account/orders` },
      ]
    : [];

  const isCurrent = (href: string) => Boolean(pathname && pathname.startsWith(href));

  return (
    <StorefrontPortalContainerContext.Provider value={rootEl}>
    <div
      ref={setRootEl}
      className={`${themeRoot.className} flex min-h-[100dvh] flex-col`}
      style={themeRoot.style}
      {...themeRoot.dataAttributes}
      data-ds-custom={themeRoot.isCustomDesign ? "true" : undefined}
    >
      <FontLoader
        fonts={[
          theme?.typography?.headingFont,
          theme?.typography?.bodyFont,
          ...(theme?.typography?.customFonts || []),
        ]}
      />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-background"
      >
        Skip to content
      </a>

      {/* Announcement: one calm line. No ticker; nothing here moves on its own. */}
      {announcement && (
        <aside
          className="storefront-announcement relative z-50 w-full border-b border-[color:var(--at-hairline)] bg-muted/50"
          role="region"
          aria-label="Announcement"
        >
          <p className="at-container m-0 flex min-h-9 items-center justify-center py-2 text-center text-xs font-medium tracking-wide text-foreground">
            {announcement}
          </p>
        </aside>
      )}

      <header
        className="storefront-header sticky top-0 z-40 w-full border-b border-[color:var(--at-hairline)] bg-background"
        role="banner"
      >
        {inlineHeader ? (
          <div className="at-container flex h-[var(--at-header-h)] items-center gap-4 lg:gap-8">
            <button
              type="button"
              onClick={() => setIndexOpen(true)}
              className={`${iconButton} inline-flex -ml-2 lg:hidden`}
              aria-label="Open navigation menu"
              aria-expanded={indexOpen}
              aria-haspopup="dialog"
            >
              <Menu size={22} strokeWidth={1.5} aria-hidden="true" />
            </button>

            <div className="storefront-brand flex">
              <Link href={storeHomeHref} className="text-foreground" aria-label={`${storeName} home`}>
                <span className="storefront-brand-name">{storeName}</span>
              </Link>
            </div>

            <nav
              className="storefront-nav hidden items-center gap-7 lg:flex"
              aria-label="Storefront Navigation"
            >
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isCurrent(link.href) ? "page" : undefined}
                  className="storefront-nav-link at-link text-sm text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="ml-auto">
            <div className="storefront-actions flex items-center justify-end gap-0.5 sm:gap-1">
              {storeSlug && (
                <Link
                  href={`/stores/${storeSlug}/products`}
                  className={`${iconButton} inline-flex`}
                  aria-label="Search catalog products"
                  title="Search products"
                >
                  <Search size={19} strokeWidth={1.5} aria-hidden="true" />
                </Link>
              )}

              {storeSlug && (
                <Link
                  href={`/stores/${storeSlug}/wishlist`}
                  className={`${iconButton} relative hidden sm:inline-flex`}
                  aria-label={wishlistCount > 0 ? `Wishlist with ${wishlistCount} items` : "Wishlist"}
                  title="Wishlist"
                >
                  <Heart
                    size={19}
                    strokeWidth={1.5}
                    aria-hidden="true"
                    className={wishlistCount > 0 ? "fill-primary text-primary" : ""}
                  />
                </Link>
              )}

              {storeSlug && (
                <Link
                  href={`/stores/${storeSlug}/account`}
                  className={`${iconButton} hidden sm:inline-flex`}
                  aria-label="Customer Account"
                  title="Account"
                >
                  <User size={19} strokeWidth={1.5} aria-hidden="true" />
                </Link>
              )}

              <div className="hidden md:block">
                <CurrencySelector />
              </div>

              {appearance.toggleEnabled && (
                <AppearanceToggle appearance={appearance.appearance} onChange={appearance.setAppearance} />
              )}

              <button
                type="button"
                onClick={handleCartClick}
                aria-label={`Shopping cart with ${effectiveCount} items`}
                data-testid="storefront-cart-button"
                className="storefront-cart-btn at-press ml-1 inline-flex h-10 items-center gap-1.5 px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-3"
              >
                <ShoppingBag size={19} strokeWidth={1.5} aria-hidden="true" className="sm:hidden" />
                <span className="hidden sm:inline">Cart</span>
                {effectiveCount > 0 && (
                  <span
                    key={effectiveCount}
                    className="at-pop at-count at-num text-xs font-semibold text-primary"
                  >
                    <span className="storefront-cart-count" aria-hidden="true">{effectiveCount}</span>
                  </span>
                )}
              </button>
            </div>
            </div>
          </div>
        ) : (
        <div className="at-container grid h-[var(--at-header-h)] grid-cols-[1fr_auto_1fr] items-center gap-4">
          {/* Left: index button below lg, inline navigation from lg */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setIndexOpen(true)}
              className={`${iconButton} inline-flex -ml-2 lg:hidden`}
              aria-label="Open navigation menu"
              aria-expanded={indexOpen}
              aria-haspopup="dialog"
            >
              <Menu size={22} strokeWidth={1.5} aria-hidden="true" />
            </button>

            <nav
              className="storefront-nav hidden items-center gap-7 lg:flex"
              aria-label="Storefront Navigation"
            >
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isCurrent(link.href) ? "page" : undefined}
                  className="storefront-nav-link at-link text-sm text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Centre: the wordmark is the brand */}
          <div className="storefront-brand flex justify-center">
            <Link href={storeHomeHref} className="text-foreground" aria-label={`${storeName} home`}>
              <span className="storefront-brand-name">{storeName}</span>
            </Link>
          </div>

          {/* Right: utilities. Secondary ones move into the index menu on small screens. */}
          <div className="storefront-actions flex items-center justify-end gap-0.5 sm:gap-1">
            {storeSlug && (
              <Link
                href={`/stores/${storeSlug}/products`}
                className={`${iconButton} inline-flex`}
                aria-label="Search catalog products"
                title="Search products"
              >
                <Search size={19} strokeWidth={1.5} aria-hidden="true" />
              </Link>
            )}

            {storeSlug && (
              <Link
                href={`/stores/${storeSlug}/wishlist`}
                className={`${iconButton} relative hidden sm:inline-flex`}
                aria-label={wishlistCount > 0 ? `Wishlist with ${wishlistCount} items` : "Wishlist"}
                title="Wishlist"
              >
                <Heart
                  size={19}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className={wishlistCount > 0 ? "fill-primary text-primary" : ""}
                />
              </Link>
            )}

            {storeSlug && (
              <Link
                href={`/stores/${storeSlug}/account`}
                className={`${iconButton} hidden sm:inline-flex`}
                aria-label="Customer Account"
                title="Account"
              >
                <User size={19} strokeWidth={1.5} aria-hidden="true" />
              </Link>
            )}

            <div className="hidden md:block">
              <CurrencySelector />
            </div>

            {appearance.toggleEnabled && (
              <AppearanceToggle appearance={appearance.appearance} onChange={appearance.setAppearance} />
            )}

            <button
              type="button"
              onClick={handleCartClick}
              aria-label={`Shopping cart with ${effectiveCount} items`}
              data-testid="storefront-cart-button"
              className="storefront-cart-btn at-press ml-1 inline-flex h-10 items-center gap-1.5 px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-3"
            >
              <ShoppingBag size={19} strokeWidth={1.5} aria-hidden="true" className="sm:hidden" />
              <span className="hidden sm:inline">Cart</span>
              {effectiveCount > 0 && (
                <span
                  key={effectiveCount}
                  className="at-pop at-count at-num text-xs font-semibold text-primary"
                >
                  <span className="storefront-cart-count" aria-hidden="true">{effectiveCount}</span>
                </span>
              )}
            </button>
          </div>
        </div>
        )}
      </header>

      <IndexMenu
        open={indexOpen}
        onOpenChange={setIndexOpen}
        container={rootEl}
        storeName={storeName}
        navLinks={navLinks}
        utilityLinks={utilityLinks}
        showCurrency={Boolean(storeSlug)}
      />

      {/* Opacity-only page entrance: content never waits on a transform. */}
      <motion.main
        id="main-content"
        tabIndex={-1}
        className={`${fullBleed ? "flex-1 w-full" : "storefront-main flex-1 w-full"} outline-none`}
        role="main"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      >
        {children}
      </motion.main>

      <StorefrontFooter
        storeName={storeName}
        shopLinks={navLinks}
        accountLinks={
          storeSlug
            ? [
                { label: "My account", href: `/stores/${storeSlug}/account` },
                { label: "Order tracking", href: `/stores/${storeSlug}/account/orders` },
                { label: "Wishlist", href: `/stores/${storeSlug}/wishlist` },
              ]
            : []
        }
      />

      {cartContext && <CartDrawer storeSlug={storeSlug} />}
    </div>
    </StorefrontPortalContainerContext.Provider>
  );
}
