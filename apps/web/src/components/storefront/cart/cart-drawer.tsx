"use client";

import Link from "next/link";
import React, { useEffect, useRef } from "react";
import {
  useOptionalCart,
  type StorefrontCartDTO,
  type AppliedDiscountDTO,
} from "../../../context/cart-context";
import { CartItems } from "./cart-items";
import { formatStorePrice } from "../products/product-card";
import { DiscountCodeForm } from "../discounts/discount-code-form";
import { AppliedDiscounts } from "../discounts/applied-discounts";
import { Alert, Spinner } from "@calcart/ui";
import { ShoppingBag, X, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface CartDrawerProps {
  storeSlug?: string;
  cart?: StorefrontCartDTO | null;
  isOpen?: boolean;
  onClose?: () => void;
  appliedDiscount?: AppliedDiscountDTO | null;
}

export function CartDrawer({
  storeSlug: propStoreSlug,
  cart: propCart,
  isOpen: propIsOpen,
  onClose: propOnClose,
  appliedDiscount: propAppliedDiscount,
}: CartDrawerProps) {
  const cartContext = useOptionalCart();

  const cart = propCart !== undefined ? propCart : (cartContext?.cart ?? null);
  const storeSlug = propStoreSlug || cartContext?.storeSlug || "";
  const isDrawerOpen = propIsOpen !== undefined ? propIsOpen : (cartContext?.isDrawerOpen ?? false);
  const closeDrawer = propOnClose || (cartContext?.closeDrawer ?? (() => {}));
  const appliedDiscount = propAppliedDiscount !== undefined ? propAppliedDiscount : (cartContext?.appliedDiscount ?? null);
  const isMutating = cartContext?.isMutating ?? false;
  const isLoading = cartContext?.isLoading ?? false;
  const error = cartContext?.error ?? null;
  const applyDiscount = cartContext?.applyDiscount;
  const removeDiscount = cartContext?.removeDiscount;
  const itemCount = cart?.items?.reduce((total, item) => total + item.quantity, 0) ?? 0;
  const drawerRef = useRef<HTMLDivElement>(null);

  // Escape closes, Tab is trapped inside the dialog, body scroll is locked, and focus
  // returns to the element that opened the drawer.
  useEffect(() => {
    if (!isDrawerOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = drawerRef.current;
    panel?.focus({ preventScroll: true });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeDrawer();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === drawerRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [isDrawerOpen, closeDrawer]);

  const currency = cart?.currency || "USD";
  const cartPageHref = `/stores/${encodeURIComponent(storeSlug)}/cart`;
  const catalogHref = `/stores/${encodeURIComponent(storeSlug)}/products`;

  return (
    <AnimatePresence>
      {isDrawerOpen && (
    <motion.div
      key="cart-drawer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
      className="cart-drawer-overlay modal-backdrop fixed inset-0 z-[60] bg-foreground/40 flex justify-end"
      role="presentation"
      data-testid="cart-drawer-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeDrawer();
        }
      }}
    >
      <motion.div
        ref={drawerRef}
        tabIndex={-1}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        className="cart-drawer-panel w-full max-w-md bg-background text-foreground h-full flex flex-col border-l border-[color:var(--at-hairline)] outline-none"
        data-testid="cart-drawer"
      >
        {/* Drawer Header */}
        <div className="cart-drawer-header px-6 h-[var(--at-header-h)] border-b border-[color:var(--at-hairline)] flex items-center justify-between">
          <div className="cart-drawer-title-group flex items-baseline gap-3">
            <h2 id="cart-drawer-title" className="cart-drawer-title at-title text-2xl text-foreground">
              Your Cart
            </h2>
            <span className="cart-drawer-count at-num text-muted-foreground text-xs" data-testid="cart-drawer-count">
              ({itemCount} {itemCount === 1 ? "item" : "items"})
            </span>
          </div>

          <button
            type="button"
            className="cart-drawer-close at-press inline-flex h-10 w-10 -mr-2 items-center justify-center text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            onClick={closeDrawer}
            aria-label="Close cart drawer"
            data-testid="cart-drawer-close"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Global Error Banner (Only for initial load failure when no cart items can be displayed) */}
        {error && !cart && (
          <div className="cart-drawer-error p-4 border-b border-destructive/20 bg-destructive/10">
            <Alert variant="danger">
              {error.message || "Failed to load cart"}
            </Alert>
          </div>
        )}

        {/* Drawer Body */}
        <div className="cart-drawer-body flex-1 overflow-y-auto px-6 py-2 scrollbar-thin">
          {isLoading && !cart ? (
            <div className="cart-drawer-loading py-20 flex flex-col items-center justify-center text-center space-y-3" data-testid="cart-drawer-loading">
              <Spinner size="md" />
              <p className="text-muted-foreground text-sm">
                Loading cart...
              </p>
            </div>
          ) : !cart || cart.items.length === 0 ? (
            <div className="cart-drawer-empty py-24 flex flex-col items-center justify-center text-center space-y-4" data-testid="cart-drawer-empty">
              <div className="cart-empty-icon text-muted-foreground" aria-hidden="true">
                <ShoppingBag size={28} strokeWidth={1.25} />
              </div>
              <div className="space-y-1">
                <h3 className="cart-empty-title at-title text-2xl text-foreground">Your cart is empty</h3>
                <p className="cart-empty-text text-muted-foreground text-xs max-w-xs">
                  Explore our catalog to find items you love.
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href={catalogHref}
                  onClick={closeDrawer}
                  className="at-press inline-flex h-11 items-center bg-primary px-6 text-xs font-medium uppercase tracking-[0.12em] text-primary-foreground"
                  data-testid="cart-empty-continue-btn"
                >
                  Start Shopping
                </Link>
              </div>
            </div>
          ) : (
            <CartItems
              items={cart.items}
              storeSlug={storeSlug}
              currency={currency}
              compact={true}
              onItemClick={closeDrawer}
            />
          )}
        </div>

        {/* Drawer Footer */}
        {cart && cart.items.length > 0 && (
          <div className="cart-drawer-footer border-t border-[color:var(--at-hairline)] bg-background p-6 space-y-4" data-testid="cart-drawer-footer">
            <div className="space-y-2">
              <div className="cart-drawer-subtotal-row flex items-center justify-between text-sm">
                <span className="cart-drawer-subtotal-label text-muted-foreground font-medium">Subtotal</span>
                <span
                  className="cart-drawer-subtotal-value at-num text-base text-foreground"
                  data-testid="cart-drawer-subtotal"
                >
                  {formatStorePrice(cart.subtotal, currency)}
                </span>
              </div>

              {cart.discountTotal > 0 && (
                <div
                  className="cart-drawer-subtotal-row flex items-center justify-between text-sm text-foreground"
                >
                  <span className="cart-drawer-subtotal-label">Discounts</span>
                  <span
                    className="cart-drawer-subtotal-value font-bold"
                    data-testid="cart-drawer-discount"
                  >
                    -{formatStorePrice(cart.discountTotal, currency)}
                  </span>
                </div>
              )}
            </div>

            {/* Discount Form in Drawer */}
            <div className="cart-drawer-discount-wrap">
              {cart.discountTotal > 0 ? (
                <AppliedDiscounts
                  discount={appliedDiscount}
                  discountTotal={cart.discountTotal}
                  currency={currency}
                  onRemove={removeDiscount ? async () => { await removeDiscount(); } : undefined}
                  disabled={isMutating}
                  compact={true}
                />
              ) : (
                <DiscountCodeForm
                  onApply={async (code) => {
                    await applyDiscount?.(code);
                  }}
                  disabled={isMutating}
                  compact={true}
                />
              )}
            </div>

            <p className="cart-drawer-taxes-note text-muted-foreground text-[11px] text-center">
              Taxes and shipping calculated at checkout
            </p>

            <div className="cart-drawer-actions flex flex-col gap-2">
              <Link
                href={`/stores/${encodeURIComponent(storeSlug)}/checkout`}
                onClick={closeDrawer}
                className="cart-drawer-checkout-btn at-press flex h-12 w-full items-center justify-center gap-2 bg-primary text-xs font-medium uppercase tracking-[0.14em] text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                data-testid="cart-drawer-checkout-btn"
              >
                <Lock size={14} strokeWidth={1.5} />
                <span>Proceed to Checkout</span>
              </Link>
              <Link
                href={cartPageHref}
                onClick={closeDrawer}
                className="at-link self-center text-xs text-foreground"
                data-testid="view-full-cart-btn"
              >
                View Full Cart ({itemCount})
              </Link>
              <button
                type="button"
                className="at-link self-center text-xs text-muted-foreground"
                onClick={closeDrawer}
              >
                Continue Shopping
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  );
}
