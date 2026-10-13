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
      // Prevent background scrolling while drawer is open
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
      className="cart-drawer-overlay modal-backdrop"
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
        className="cart-drawer-panel"
        data-testid="cart-drawer"
      >
        {/* Drawer Header */}
        <div className="cart-drawer-header">
          <div className="cart-drawer-title-group">
            <h2 id="cart-drawer-title" className="cart-drawer-title">
              Your Cart
            </h2>
            <span className="cart-drawer-count text-muted text-sm" data-testid="cart-drawer-count">
              ({itemCount} {itemCount === 1 ? "item" : "items"})
            </span>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm cart-drawer-close"
            onClick={closeDrawer}
            aria-label="Close cart drawer"
            data-testid="cart-drawer-close"
          >
            ✕
          </button>
        </div>

        {/* Mutation Loading Banner */}
        {isMutating && (
          <div className="cart-drawer-busy-banner" role="status" aria-live="polite">
            <Spinner size="sm" />
            <span>Updating cart...</span>
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div className="cart-drawer-error" style={{ padding: "var(--space-3) var(--space-4)" }}>
            <Alert variant="danger">
              {error.message || "Failed to update cart"}
            </Alert>
          </div>
        )}

        {/* Drawer Body */}
        <div className="cart-drawer-body">
          {isLoading && !cart ? (
            <div className="cart-drawer-loading" data-testid="cart-drawer-loading">
              <Spinner size="md" />
              <p className="text-muted text-sm" style={{ marginTop: "var(--space-2)" }}>
                Loading cart...
              </p>
            </div>
          ) : !cart || cart.items.length === 0 ? (
            <div className="cart-drawer-empty" data-testid="cart-drawer-empty">
              <div className="cart-empty-icon" aria-hidden="true">
                CART
              </div>
              <h3 className="cart-empty-title">Your cart is empty</h3>
              <p className="cart-empty-text text-muted text-sm">
                Explore our catalog to find items you love.
              </p>
              <div style={{ marginTop: "var(--space-4)" }}>
                <a
                  href={catalogHref}
                  onClick={closeDrawer}
                  className="btn btn-primary btn-sm"
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
          <div className="cart-drawer-footer" data-testid="cart-drawer-footer">
            <div className="cart-drawer-subtotal-row">
              <span className="cart-drawer-subtotal-label">Subtotal</span>
              <span
                className="cart-drawer-subtotal-value font-bold"
                data-testid="cart-drawer-subtotal"
              >
                {formatStorePrice(cart.subtotal, currency)}
              </span>
            </div>

            {cart.discountTotal > 0 && (
              <div
                className="cart-drawer-subtotal-row"
                style={{ color: "var(--color-success)", marginTop: "var(--space-1)" }}
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

            <div className="cart-drawer-discount-wrap" style={{ margin: "var(--space-2) 0" }}>
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

            <p className="cart-drawer-taxes-note text-muted text-xs">
              Taxes and shipping calculated at checkout
            </p>

            <div className="cart-drawer-actions" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <a
                href={`/stores/${encodeURIComponent(storeSlug)}/checkout`}
                onClick={closeDrawer}
                className="btn btn-primary btn-md w-full cart-drawer-checkout-btn"
                data-testid="cart-drawer-checkout-btn"
              >
                Proceed to Checkout
              </a>
              <a
                href={cartPageHref}
                onClick={closeDrawer}
                className="btn btn-outline btn-sm w-full"
                data-testid="view-full-cart-btn"
              >
                View Full Cart ({itemCount})
              </a>
              <button
                type="button"
                className="btn btn-ghost btn-xs w-full text-muted"
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
