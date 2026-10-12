"use client";

import React, { useState } from "react";
import { useOptionalCart, type StorefrontCartItemDTO } from "../../../context/cart-context";
import { formatStorePrice } from "../products/product-card";
import { Spinner } from "@shopify-clone/ui";

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
    <div className={`cart-items-container ${compact ? "cart-items--compact" : ""}`} data-testid="cart-items-list">
      {localError && (
        <div className="alert alert--danger cart-item-error" role="alert" style={{ marginBottom: "var(--space-3)" }}>
          <span>{localError}</span>
          <button
            type="button"
            className="cart-error-dismiss"
            onClick={() => setLocalError(null)}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      <ul className="cart-items-list" role="list">
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
              className={`cart-item-row ${compact ? "cart-item-row--compact" : ""}`}
              data-testid={`cart-item-${item.id}`}
            >
              {/* Thumbnail */}
              <div className="cart-item-media">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.imageAlt || item.productTitle}
                    className="cart-item-image"
                  />
                ) : (
                  <div
                    className="cart-item-image-fallback"
                    role="img"
                    aria-label={`No image available for ${item.productTitle}`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
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
              <div className="cart-item-info">
                <div className="cart-item-header">
                  {productLink ? (
                    <a
                      href={productLink}
                      onClick={onItemClick}
                      className="cart-item-title-link"
                    >
                      {item.productTitle}
                    </a>
                  ) : (
                    <span className="cart-item-title">{item.productTitle}</span>
                  )}

                  {!isDefaultVariant && (
                    <span className="cart-item-variant" data-testid={`cart-item-variant-${item.id}`}>
                      {item.variantTitle}
                    </span>
                  )}

                  {item.sku && (
                    <span className="cart-item-sku text-muted text-xs">
                      SKU: {item.sku}
                    </span>
                  )}
                </div>

                {/* Pricing: Unit Price & Line Subtotal */}
                <div className="cart-item-prices">
                  <span className="cart-item-unit-price text-muted text-sm">
                    {formatStorePrice(item.unitPrice, currency)} each
                  </span>
                  <span
                    className="cart-item-line-total font-semibold"
                    data-testid={`cart-item-subtotal-${item.id}`}
                  >
                    {formatStorePrice(item.lineSubtotal, currency)}
                  </span>
                </div>

                {/* Quantity Controls & Remove */}
                <div className="cart-item-actions">
                  <div
                    className="cart-quantity-stepper"
                    role="group"
                    aria-label={`Quantity for ${item.productTitle}`}
                  >
                    <button
                      type="button"
                      className="btn btn-outline btn-sm cart-stepper-btn cart-stepper-btn--dec"
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
                      className="cart-stepper-val"
                      data-testid={`qty-val-${item.id}`}
                      aria-live="polite"
                    >
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm cart-stepper-btn cart-stepper-btn--inc"
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
                    className="btn btn-outline btn-sm cart-item-remove-btn"
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
