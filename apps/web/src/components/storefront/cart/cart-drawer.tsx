"use client";

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
import { Alert, Spinner } from "@shopify-clone/ui";
import { ShoppingBag, X, Lock } from "lucide-react";

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

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isDrawerOpen) {
        closeDrawer();
      }
    }

    if (isDrawerOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isDrawerOpen, closeDrawer]);

  if (!isDrawerOpen) return null;

  const currency = cart?.currency || "USD";
  const cartPageHref = `/stores/${encodeURIComponent(storeSlug)}/cart`;
  const catalogHref = `/stores/${encodeURIComponent(storeSlug)}/products`;

  return (
    <div
      className="cart-drawer-overlay modal-backdrop fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity flex justify-end"
      role="presentation"
      data-testid="cart-drawer-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeDrawer();
        }
      }}
    >
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        className="cart-drawer-panel w-full max-w-md bg-background text-foreground h-full shadow-2xl flex flex-col border-l border-border/80 animate-in slide-in-from-right duration-300"
        data-testid="cart-drawer"
      >
        {/* Drawer Header */}
        <div className="cart-drawer-header px-6 py-5 border-b border-border/60 flex items-center justify-between bg-muted/20">
          <div className="cart-drawer-title-group flex items-center gap-2.5">
            <ShoppingBag size={20} className="text-primary" />
            <h2 id="cart-drawer-title" className="cart-drawer-title text-lg font-bold tracking-tight text-foreground">
              Your Cart
            </h2>
            <span className="cart-drawer-count text-muted-foreground text-xs font-semibold px-2 py-0.5 rounded-full bg-muted" data-testid="cart-drawer-count">
              ({itemCount} {itemCount === 1 ? "item" : "items"})
            </span>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm cart-drawer-close p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            onClick={closeDrawer}
            aria-label="Close cart drawer"
            data-testid="cart-drawer-close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mutation Loading Banner */}
        {isMutating && (
          <div className="cart-drawer-busy-banner px-4 py-2 bg-primary/10 border-b border-primary/20 text-xs font-medium text-primary flex items-center justify-center gap-2" role="status" aria-live="polite">
            <Spinner size="sm" />
            <span>Updating cart...</span>
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div className="cart-drawer-error p-4 border-b border-destructive/20 bg-destructive/10">
            <Alert variant="danger">
              {error.message || "Failed to update cart"}
            </Alert>
          </div>
        )}

        {/* Drawer Body */}
        <div className="cart-drawer-body flex-1 overflow-y-auto p-6 scrollbar-thin">
          {isLoading && !cart ? (
            <div className="cart-drawer-loading py-20 flex flex-col items-center justify-center text-center space-y-3" data-testid="cart-drawer-loading">
              <Spinner size="md" />
              <p className="text-muted-foreground text-sm">
                Loading cart...
              </p>
            </div>
          ) : !cart || cart.items.length === 0 ? (
            <div className="cart-drawer-empty py-20 flex flex-col items-center justify-center text-center space-y-4" data-testid="cart-drawer-empty">
              <div className="cart-empty-icon w-16 h-16 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground checkout-glyph" aria-hidden="true">
                <ShoppingBag size={28} className="opacity-50" />
              </div>
              <div className="space-y-1">
                <h3 className="cart-empty-title text-base font-bold text-foreground">Your cart is empty</h3>
                <p className="cart-empty-text text-muted-foreground text-xs max-w-xs">
                  Explore our catalog to find items you love.
                </p>
              </div>
              <div className="pt-2">
                <a
                  href={catalogHref}
                  onClick={closeDrawer}
                  className="btn btn-primary btn-sm rounded-full px-5 py-2 text-xs font-semibold"
                  data-testid="cart-empty-continue-btn"
                >
                  Start Shopping
                </a>
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
          <div className="cart-drawer-footer border-t border-border/80 bg-card p-6 space-y-4 shadow-lg" data-testid="cart-drawer-footer">
            <div className="space-y-2">
              <div className="cart-drawer-subtotal-row flex items-center justify-between text-sm">
                <span className="cart-drawer-subtotal-label text-muted-foreground font-medium">Subtotal</span>
                <span
                  className="cart-drawer-subtotal-value font-bold text-base text-foreground"
                  data-testid="cart-drawer-subtotal"
                >
                  {formatStorePrice(cart.subtotal, currency)}
                </span>
              </div>

              {cart.discountTotal > 0 && (
                <div
                  className="cart-drawer-subtotal-row flex items-center justify-between text-sm text-emerald-500 font-semibold"
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
              <a
                href={`/stores/${encodeURIComponent(storeSlug)}/checkout`}
                onClick={closeDrawer}
                className="btn btn-primary btn-md w-full cart-drawer-checkout-btn rounded-xl font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-primary/20 transition-all text-sm h-11"
                data-testid="cart-drawer-checkout-btn"
              >
                <Lock size={15} />
                <span>Proceed to Checkout</span>
              </a>
              <a
                href={cartPageHref}
                onClick={closeDrawer}
                className="btn btn-outline btn-sm w-full rounded-xl text-xs font-semibold h-9 flex items-center justify-center hover:bg-muted"
                data-testid="view-full-cart-btn"
              >
                View Full Cart ({itemCount})
              </a>
              <button
                type="button"
                className="btn btn-ghost btn-xs w-full text-muted-foreground hover:text-foreground text-xs"
                onClick={closeDrawer}
              >
                Continue Shopping
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
