"use client";

import React, { useState } from "react";
import { useOptionalCart, type StorefrontCartDTO } from "../../../context/cart-context";
import { formatStorePrice } from "../products/product-card";
import { Spinner } from "@shopify-clone/ui";

export interface CartSummaryProps {
  cart: StorefrontCartDTO;
  storeSlug: string;
  showCheckoutNotice?: boolean;
  onClearCart?: () => void;
  compact?: boolean;
}

export function CartSummary({
  cart,
  storeSlug,
  showCheckoutNotice = true,
  compact = false,
}: CartSummaryProps) {
  const cartContext = useOptionalCart();
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
      className={`cart-summary-card ${compact ? "cart-summary-card--compact" : ""}`}
      data-testid="cart-summary"
    >
      <h2 className="cart-summary-title">Order Summary</h2>

      {clearError && (
        <div className="alert alert--danger" role="alert" style={{ marginBottom: "var(--space-3)" }}>
          <span>{clearError}</span>
        </div>
      )}

      <div className="cart-summary-breakdown">
        {/* Subtotal */}
        <div className="cart-summary-row">
          <span className="cart-summary-label">Subtotal</span>
          <span className="cart-summary-value" data-testid="cart-subtotal">
            {formatStorePrice(cart.subtotal, currency)}
          </span>
        </div>

        {/* Discounts (if present) */}
        {cart.discountTotal > 0 && (
          <div className="cart-summary-row cart-summary-row--discount">
            <span className="cart-summary-label">Discounts</span>
            <span className="cart-summary-value text-success" data-testid="cart-discount">
              -{formatStorePrice(cart.discountTotal, currency)}
            </span>
          </div>
        )}

        {/* Shipping */}
        <div className="cart-summary-row">
          <span className="cart-summary-label">Shipping</span>
          <span className="cart-summary-value" data-testid="cart-shipping">
            {cart.shippingTotal > 0
              ? formatStorePrice(cart.shippingTotal, currency)
              : "Calculated at checkout"}
          </span>
        </div>

        {/* Taxes */}
        <div className="cart-summary-row">
          <span className="cart-summary-label">Taxes</span>
          <span className="cart-summary-value" data-testid="cart-tax">
            {cart.taxTotal > 0
              ? formatStorePrice(cart.taxTotal, currency)
              : "Calculated at checkout"}
          </span>
        </div>

        <div className="cart-summary-divider" />

        {/* Grand Total */}
        <div className="cart-summary-row cart-summary-row--total">
          <span className="cart-summary-total-label font-bold">Estimated Total</span>
          <span className="cart-summary-total-value font-bold" data-testid="cart-grand-total">
            {formatStorePrice(cart.grandTotal, currency)}
          </span>
        </div>
      </div>

      {/* Checkout notice & buttons */}
      {showCheckoutNotice && (
        <div className="cart-summary-checkout-section">
          <button
            type="button"
            className="btn btn-primary btn-md w-full cart-checkout-btn"
            disabled
            aria-disabled="true"
            data-testid="checkout-btn"
            title="Checkout is not implemented in this demo release"
          >
            Checkout Unavailable
          </button>
          <p className="cart-checkout-note text-muted text-xs">
            Payment and checkout processing will be available in the next release.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="cart-summary-actions">
        <a href={catalogHref} className="btn btn-outline btn-sm w-full cart-continue-shopping">
          ← Continue Shopping
        </a>

        {cart.items && cart.items.length > 0 && !compact && (
          <button
            type="button"
            className="btn btn-ghost btn-sm cart-clear-btn"
            onClick={handleClear}
            disabled={isMutating || isClearing}
            data-testid="clear-cart-btn"
          >
            {isClearing ? <Spinner size="sm" /> : "Clear Cart"}
          </button>
        )}
      </div>
    </div>
  );
}
