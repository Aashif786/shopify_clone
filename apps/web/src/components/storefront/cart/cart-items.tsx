"use client";

import React, { useState } from "react";
import { useOptionalCart, type StorefrontCartItemDTO } from "../../../context/cart-context";
import { formatStorePrice } from "../products/product-card";
import { Spinner } from "@shopify-clone/ui";
import { AlertCircle } from "lucide-react";

export interface CartItemsProps {
  items: StorefrontCartItemDTO[];
  storeSlug: string;
  currency?: string;
  compact?: boolean;
  onItemClick?: () => void;
}

export function CartItems({
  items,
  storeSlug,
  currency = "USD",
  compact = false,
  onItemClick,
}: CartItemsProps) {
  const cartContext = useOptionalCart();
  const isMutating = cartContext?.isMutating ?? false;
  const updateQuantity = cartContext?.updateQuantity;
  const removeItem = cartContext?.removeItem;
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleQuantityChange = async (itemId: string, newQuantity: number) => {
    if (isMutating) return;
    if (newQuantity < 0 || newQuantity > 999) return;

    setActiveItemId(itemId);
    setLocalError(null);
    try {
      if (newQuantity === 0) {
        await removeItem?.(itemId);
      } else {
        await updateQuantity?.(itemId, newQuantity);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update item quantity";
      setLocalError(msg);
    } finally {
      setActiveItemId(null);
    }
  };

  const handleRemove = async (itemId: string) => {
    if (isMutating) return;

    setActiveItemId(itemId);
    setLocalError(null);
    try {
      await removeItem?.(itemId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove item";
      setLocalError(msg);
    } finally {
      setActiveItemId(null);
    }
  };

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className={`cart-items-container ${compact ? "cart-items--compact" : ""} space-y-4`} data-testid="cart-items-list">
      {localError && (
        <div className="alert alert--danger cart-item-error p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center justify-between" role="alert">
          <span className="flex items-center gap-1.5">
            <AlertCircle size={14} />
            {localError}
          </span>
          <button
            type="button"
            className="cart-error-dismiss hover:opacity-80 p-1"
            onClick={() => setLocalError(null)}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      <ul className="cart-items-list divide-y divide-border/50 list-none p-0 m-0" role="list">
        {items.map((item) => {
          const isItemBusy = isMutating && activeItemId === item.id;
          const isDefaultVariant =
            item.variantTitle === "Default Title" ||
            item.variantTitle === "Default" ||
            !item.variantTitle;

          const productLink = item.productSlug
            ? `/stores/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(item.productSlug)}`
            : undefined;

          return (
            <li
              key={item.id}
              className={`cart-item-row ${compact ? "cart-item-row--compact py-4" : "py-5 sm:py-6"} flex gap-4 items-start`}
              data-testid={`cart-item-${item.id}`}
            >
              {/* Thumbnail Container */}
              <div className={`cart-item-media shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-muted/20 ${compact ? "w-16 h-16 sm:w-20 sm:h-20" : "w-20 h-20 sm:w-24 sm:h-24"}`}>
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.imageAlt || item.productTitle}
                    className="cart-item-image w-full h-full object-cover object-center"
                  />
                ) : (
                  <div
                    className="cart-item-image-fallback w-full h-full flex items-center justify-center text-muted-foreground p-2"
                    role="img"
                    aria-label={`No image available for ${item.productTitle}`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                      className="w-6 h-6 opacity-40"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                )}
              </div>

              {/* Item Details */}
              <div className="cart-item-info flex-1 min-w-0 space-y-1.5">
                <div className="cart-item-header">
                  {productLink ? (
                    <a
                      href={productLink}
                      onClick={onItemClick}
                      className="cart-item-title-link text-sm sm:text-base font-bold text-foreground hover:text-primary transition-colors block line-clamp-1"
                    >
                      {item.productTitle}
                    </a>
                  ) : (
                    <span className="cart-item-title text-sm sm:text-base font-bold text-foreground block line-clamp-1">
                      {item.productTitle}
                    </span>
                  )}

                  {!isDefaultVariant && (
                    <span className="cart-item-variant inline-block text-xs font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md mt-1" data-testid={`cart-item-variant-${item.id}`}>
                      {item.variantTitle}
                    </span>
                  )}

                  {item.sku && (
                    <span className="cart-item-sku text-muted text-xs block font-mono">
                      SKU: {item.sku}
                    </span>
                  )}
                </div>

                {/* Pricing: Unit Price & Line Subtotal */}
                <div className="cart-item-prices flex items-baseline justify-between pt-1">
                  <span className="cart-item-unit-price text-muted text-sm">
                    {formatStorePrice(item.unitPrice, currency)} each
                  </span>
                  <span
                    className="cart-item-line-total font-semibold text-sm sm:text-base text-foreground"
                    data-testid={`cart-item-subtotal-${item.id}`}
                  >
                    {formatStorePrice(item.lineSubtotal, currency)}
                  </span>
                </div>

                {/* Quantity Controls & Remove */}
                <div className="cart-item-actions flex items-center justify-between pt-2">
                  <div
                    className="cart-quantity-stepper flex items-center rounded-xl border border-border/80 bg-background p-0.5 shadow-sm"
                    role="group"
                    aria-label={`Quantity for ${item.productTitle}`}
                  >
                    <button
                      type="button"
                      className="btn btn-outline btn-sm cart-stepper-btn cart-stepper-btn--dec w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold hover:bg-muted"
                      onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                      disabled={isMutating}
                      aria-label={
                        item.quantity === 1
                          ? `Remove ${item.productTitle} from cart`
                          : `Decrease quantity for ${item.productTitle}`
                      }
                      data-testid={`qty-dec-${item.id}`}
                    >
                      -
                    </button>
                    <span
                      className="cart-stepper-val w-8 text-center text-xs font-bold text-foreground"
                      data-testid={`qty-val-${item.id}`}
                      aria-live="polite"
                    >
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm cart-stepper-btn cart-stepper-btn--inc w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold hover:bg-muted"
                      onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                      disabled={isMutating || item.quantity >= 999}
                      aria-label={`Increase quantity for ${item.productTitle}`}
                      data-testid={`qty-inc-${item.id}`}
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    className="btn btn-outline btn-sm cart-item-remove-btn text-xs text-muted-foreground hover:text-destructive hover:border-destructive/30 rounded-xl px-2.5 py-1 transition-colors"
                    onClick={() => handleRemove(item.id)}
                    disabled={isMutating}
                    aria-label={`Remove ${item.productTitle} from cart`}
                    data-testid={`remove-item-${item.id}`}
                  >
                    {isItemBusy ? <Spinner size="sm" /> : "Remove"}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
