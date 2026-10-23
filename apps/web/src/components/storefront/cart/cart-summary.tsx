"use client";

import React, { useState } from "react";
import { useOptionalCart, type StorefrontCartDTO } from "../../../context/cart-context";
import { formatStorePrice } from "../products/product-card";
import { DiscountCodeForm } from "../discounts/discount-code-form";
import { AppliedDiscounts } from "../discounts/applied-discounts";
import { Spinner } from "@shopify-clone/ui";
import { Lock, Trash2, ShieldCheck } from "lucide-react";
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
      className={`cart-summary-card ${compact ? "cart-summary-card--compact p-4" : "p-6 sm:p-8"} rounded-3xl border border-border/70 bg-card/90 backdrop-blur-md shadow-sm space-y-6`}
      data-testid="cart-summary"
    >
      <div className="flex items-center justify-between">
        <h2 className="cart-summary-title text-xl font-extrabold tracking-tight text-foreground">
          Order Summary
        </h2>
        <span className="text-xs text-muted-foreground font-medium">
          {cart.items?.length || 0} {cart.items?.length === 1 ? "item" : "items"}
        </span>
      </div>

      {clearError && (
        <div className="alert alert--danger p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs" role="alert">
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
      <div className="cart-summary-breakdown space-y-3 pt-3 border-t border-border/50 text-sm">
        {/* Subtotal */}
        <div className="cart-summary-row flex items-center justify-between">
          <span className="cart-summary-label text-muted-foreground font-medium">Subtotal</span>
          <span className="cart-summary-value font-semibold text-foreground" data-testid="cart-subtotal">
            {formatStorePrice(cart.subtotal, currency)}
          </span>
        </div>

        {/* Discounts (if present) */}
        {cart.discountTotal > 0 && (
          <div className="cart-summary-row cart-summary-row--discount flex items-center justify-between text-emerald-500 font-semibold">
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

        <div className="cart-summary-divider pt-2 border-b border-border/50" />

        {/* Grand Total */}
        <div className="cart-summary-row cart-summary-row--total flex items-baseline justify-between pt-1">
          <span className="cart-summary-total-label font-bold text-base sm:text-lg text-foreground">Estimated Total</span>
          <span className="cart-summary-total-value font-bold text-2xl tracking-tight text-foreground" data-testid="cart-grand-total">
            {formatStorePrice(cart.grandTotal, currency)}
          </span>
        </div>
      </div>

      {/* Checkout notice & buttons */}
      {showCheckoutNotice && (
        <div className="cart-summary-checkout-section space-y-3 pt-2">
          {checkoutEnabled ? (
            <>
              <a
                href={`/stores/${encodeURIComponent(storeSlug)}/checkout`}
                className={`btn btn-primary btn-md w-full cart-checkout-btn h-12 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-primary/20 transition-all ${
                  cart.items.length === 0 || isMutating ? "btn-disabled opacity-50 pointer-events-none" : ""
                }`}
                aria-disabled={cart.items.length === 0 || isMutating}
                data-testid="checkout-btn"
                onClick={(e) => {
                  if (cart.items.length === 0 || isMutating) {
                    e.preventDefault();
                  }
                }}
              >
                <Lock size={16} />
                <span>Proceed to Checkout</span>
              </a>
              <p className="cart-checkout-note text-muted text-xs text-center flex items-center justify-center gap-1.5 pt-1">
                <ShieldCheck size={14} className="text-primary" />
                <span>Secure checkout powered by Razorpay.</span>
              </p>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-primary btn-md w-full cart-checkout-btn h-12 rounded-2xl text-sm font-bold opacity-60 cursor-not-allowed"
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
        <a
          href={catalogHref}
          className="btn btn-outline btn-sm w-full cart-continue-shopping rounded-xl h-10 flex items-center justify-center text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          ← Continue Shopping
        </a>

        {cart.items && cart.items.length > 0 && !compact && (
          <button
            type="button"
            className="btn btn-ghost btn-sm cart-clear-btn w-full text-xs text-muted-foreground hover:text-destructive flex items-center justify-center gap-1.5 transition-colors"
            onClick={handleClear}
            disabled={isMutating || isClearing}
            data-testid="clear-cart-btn"
          >
            {isClearing ? <Spinner size="sm" /> : <>
              <Trash2 size={13} />
              <span>Clear Cart</span>
            </>}
          </button>
        )}
      </div>
    </div>
  );
}
