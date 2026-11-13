"use client";

import Link from "next/link";
import React, { useState } from "react";
import { useOptionalCart, type StorefrontCartDTO } from "../../../context/cart-context";
import { formatStorePrice } from "../products/product-card";
import { DiscountCodeForm } from "../discounts/discount-code-form";
import { AppliedDiscounts } from "../discounts/applied-discounts";
import { Spinner } from "@calcart/ui";
import { Lock, ShieldCheck } from "lucide-react";
import type { AppliedDiscountDTO } from "../../../lib/storefront-discount-helpers";

export interface CartSummaryProps {
  cart: StorefrontCartDTO;
  storeSlug: string;
  showCheckoutNotice?: boolean;
  checkoutEnabled?: boolean;
  onClearCart?: () => void;
  compact?: boolean;
  appliedDiscount?: AppliedDiscountDTO | null;
  onApplyDiscount?: (code: string) => Promise<void> | void;
  onRemoveDiscount?: () => Promise<void> | void;
}

export function CartSummary({
  cart,
  storeSlug,
  showCheckoutNotice = true,
  checkoutEnabled = false,
  compact = false,
  appliedDiscount,
  onApplyDiscount,
  onRemoveDiscount,
}: CartSummaryProps) {
  const cartContext = useOptionalCart();
  const effectiveAppliedDiscount = appliedDiscount !== undefined ? appliedDiscount : cartContext?.appliedDiscount;
  const handleApply = onApplyDiscount ?? (async (code: string) => { await cartContext?.applyDiscount(code); });
  const handleRemove = onRemoveDiscount ?? (cartContext?.removeDiscount ? async () => { await cartContext.removeDiscount(); } : undefined);
  const isMutating = cartContext?.isMutating ?? false;
  const clearCart = cartContext?.clearCart;
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [clearError, setClearError] = useState<string | null>(null);

  const handleClear = async () => {
    if (isMutating || isClearing) return;
    setIsClearing(true);
    setClearError(null);
    try {
      await clearCart?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to clear cart";
      setClearError(msg);
    } finally {
      setIsClearing(false);
    }
  };

  const currency = cart.currency || "USD";
  const catalogHref = `/stores/${encodeURIComponent(storeSlug)}/products`;

  return (
    <div
      className={`cart-summary-card ${compact ? "cart-summary-card--compact p-4" : "p-6 sm:p-8"} border-t border-foreground space-y-6 pt-6`}
      data-testid="cart-summary"
    >
      <div className="flex items-center justify-between">
        <h2 className="cart-summary-title at-title text-2xl text-foreground">
          Order Summary
        </h2>
        <span className="text-xs at-num text-muted-foreground">
          {cart.items?.length || 0} {cart.items?.length === 1 ? "item" : "items"}
        </span>
      </div>

      {clearError && (
        <div className="alert alert--danger p-3 border border-destructive text-destructive text-xs" role="alert">
          <span>{clearError}</span>
        </div>
      )}

      {/* Discount Redemption Section */}
      {cart.items && cart.items.length > 0 && (
        <div className="cart-summary-discount-section pt-1">
          {cart.discountTotal > 0 ? (
            <AppliedDiscounts
              discount={effectiveAppliedDiscount}
              discountTotal={cart.discountTotal}
              currency={currency}
              onRemove={handleRemove}
              disabled={isMutating}
              compact={compact}
            />
          ) : (
            <DiscountCodeForm
              onApply={handleApply}
              disabled={isMutating}
              compact={compact}
            />
          )}
        </div>
      )}

      {/* Cost Breakdown */}
      <div className="cart-summary-breakdown space-y-3 pt-3 border-t border-[color:var(--at-hairline)] text-sm">
        {/* Subtotal */}
        <div className="cart-summary-row flex items-center justify-between">
          <span className="cart-summary-label text-muted-foreground font-medium">Subtotal</span>
          <span className="cart-summary-value at-num text-foreground" data-testid="cart-subtotal">
            {formatStorePrice(cart.subtotal, currency)}
          </span>
        </div>

        {/* Discounts (if present) */}
        {cart.discountTotal > 0 && (
          <div className="cart-summary-row cart-summary-row--discount flex items-center justify-between text-foreground">
            <span className="cart-summary-label">Discounts</span>
            <span className="cart-summary-value text-success" data-testid="cart-discount">
              -{formatStorePrice(cart.discountTotal, currency)}
            </span>
          </div>
        )}

        {/* Shipping */}
        <div className="cart-summary-row flex items-center justify-between">
          <span className="cart-summary-label text-muted-foreground font-medium">Shipping</span>
          <span className="cart-summary-value font-medium text-foreground" data-testid="cart-shipping">
            {cart.shippingTotal > 0
              ? formatStorePrice(cart.shippingTotal, currency)
              : "Calculated at checkout"}
          </span>
        </div>

        {/* Taxes */}
        <div className="cart-summary-row flex items-center justify-between">
          <span className="cart-summary-label text-muted-foreground font-medium">Taxes</span>
          <span className="cart-summary-value font-medium text-foreground" data-testid="cart-tax">
            {cart.taxTotal > 0
              ? formatStorePrice(cart.taxTotal, currency)
              : "Calculated at checkout"}
          </span>
        </div>

        <div className="cart-summary-divider pt-2 border-b border-[color:var(--at-hairline)]" />

        {/* Grand Total */}
        <div className="cart-summary-row cart-summary-row--total flex items-baseline justify-between pt-1">
          <span className="cart-summary-total-label at-title text-lg text-foreground">Estimated Total</span>
          <span className="cart-summary-total-value at-num text-2xl text-foreground" data-testid="cart-grand-total">
            {formatStorePrice(cart.grandTotal, currency)}
          </span>
        </div>
      </div>

      {/* Checkout notice & buttons */}
      {showCheckoutNotice && (
        <div className="cart-summary-checkout-section space-y-3 pt-2">
          {checkoutEnabled ? (
            <>
              <Link
                href={`/stores/${encodeURIComponent(storeSlug)}/checkout`}
                className={`cart-checkout-btn at-press flex h-12 w-full items-center justify-center gap-2 bg-primary text-xs font-medium uppercase tracking-[0.14em] text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  cart.items.length === 0 || isMutating ? "opacity-50 pointer-events-none" : ""
                }`}
                aria-disabled={cart.items.length === 0 || isMutating}
                data-testid="checkout-btn"
                onClick={(e) => {
                  if (cart.items.length === 0 || isMutating) {
                    e.preventDefault();
                  }
                }}
              >
                <Lock size={14} strokeWidth={1.5} />
                <span>Proceed to Checkout</span>
              </Link>
              <p className="cart-checkout-note text-muted-foreground text-xs text-center flex items-center justify-center gap-1.5 pt-1">
                <ShieldCheck size={14} strokeWidth={1.5} />
                <span>Secure checkout powered by Razorpay.</span>
              </p>
            </>
          ) : (
            <>
              <button
                type="button"
                className="cart-checkout-btn h-12 w-full bg-primary text-xs font-medium uppercase tracking-[0.14em] text-primary-foreground opacity-60 cursor-not-allowed"
                disabled
                aria-disabled="true"
                data-testid="checkout-btn"
                title="Checkout is not implemented in this demo release"
              >
                Checkout Unavailable
              </button>
              <p className="cart-checkout-note text-muted text-xs text-center">
                Payment and checkout processing will be available in the next release.
              </p>
            </>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="cart-summary-actions space-y-2 pt-2">
        <Link
          href={catalogHref}
          className="cart-continue-shopping at-link flex justify-center text-xs text-muted-foreground"
        >
          ← Continue Shopping
        </Link>

        {cart.items && cart.items.length > 0 && !compact && (
          <button
            type="button"
            className="cart-clear-btn at-link mx-auto flex items-center justify-center text-xs text-muted-foreground"
            onClick={handleClear}
            disabled={isMutating || isClearing}
            data-testid="clear-cart-btn"
          >
            {isClearing ? <Spinner size="sm" /> : <>
              <span>Clear Cart</span>
            </>}
          </button>
        )}
      </div>
    </div>
  );
}
