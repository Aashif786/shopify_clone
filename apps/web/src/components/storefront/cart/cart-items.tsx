"use client";

import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useOptionalCart, type StorefrontCartItemDTO } from "../../../context/cart-context";
import { formatStorePrice } from "../products/product-card";
import { Spinner } from "@calcart/ui";
import { StorefrontImage } from "../storefront-image";
import { Plus, Minus } from "lucide-react";

export interface CartItemsProps {
  items: StorefrontCartItemDTO[];
  storeSlug: string;
  currency?: string;
  compact?: boolean;
  onItemClick?: () => void;
}

/**
 * Briefly animates a value when it changes. The value always comes from the
 * server-confirmed cart, so nothing animates optimistically; the first render never animates.
 */
function ChangeFlash({ value, children }: { value: string | number; children: React.ReactNode }) {
  const previous = useRef(value);
  const changed = previous.current !== value;
  useEffect(() => {
    previous.current = value;
  }, [value]);
  return (
    <motion.span
      key={value}
      className="inline-block"
      initial={changed ? { opacity: 0.35, y: 4 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.span>
  );
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

  const handleQuantityChange = async (itemId: string, newQuantity: number) => {
    if (isMutating) return;
    if (newQuantity < 0 || newQuantity > 999) return;

    setActiveItemId(itemId);
    try {
      if (newQuantity === 0) {
        await removeItem?.(itemId);
      } else {
        await updateQuantity?.(itemId, newQuantity);
      }
    } catch {
      // Feedback and error states are presented non-intrusively via cart toast
    } finally {
      setActiveItemId(null);
    }
  };

  const handleRemove = async (itemId: string) => {
    if (isMutating) return;

    setActiveItemId(itemId);
    try {
      await removeItem?.(itemId);
    } catch {
      // Feedback and error states are presented non-intrusively via cart toast
    } finally {
      setActiveItemId(null);
    }
  };

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className={`cart-items-container ${compact ? "cart-items--compact" : ""} space-y-4`} data-testid="cart-items-list">
      <ul className="cart-items-list relative divide-y divide-[color:var(--at-hairline)] list-none p-0 m-0" role="list">
        <AnimatePresence initial={false} mode="popLayout">
        {items.map((item) => {
          const isItemBusy = isMutating && activeItemId === item.id;
          const isDefaultVariant =
            item.variantTitle === "Default Title" ||
            item.variantTitle === "Default" ||
            !item.variantTitle;

          const productLink = item.productSlug
            ? `/stores/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(item.productSlug)}`
            : undefined;

          const noImage = (
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
          );

          return (
            <motion.li
              key={item.id}
              layout="position"
              exit={{ opacity: 0, x: -16 }}
              animate={{ opacity: isItemBusy ? 0.6 : 1 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className={`cart-item-row ${compact ? "cart-item-row--compact py-4" : "py-5 sm:py-6"} flex gap-4 items-start`}
              data-testid={`cart-item-${item.id}`}
            >
              {/* Thumbnail Container */}
              <div className={`cart-item-media shrink-0 overflow-hidden bg-muted ${compact ? "w-16 aspect-[4/5] sm:w-20" : "w-20 aspect-[4/5] sm:w-24"}`}>
                {item.imageUrl ? (
                  <StorefrontImage
                    src={item.imageUrl}
                    alt={item.imageAlt || item.productTitle}
                    className="cart-item-image w-full h-full object-cover object-center"
                    fallback={noImage}
                  />
                ) : (
                  noImage
                )}
              </div>

              {/* Item Details */}
              <div className="cart-item-info flex-1 min-w-0 space-y-1.5">
                <div className="cart-item-header">
                  {productLink ? (
                    <Link
                      href={productLink}
                      onClick={onItemClick}
                      className="cart-item-title-link at-title at-link text-base text-foreground block line-clamp-2"
                    >
                      {item.productTitle}
                    </Link>
                  ) : (
                    <span className="cart-item-title at-title text-base text-foreground block line-clamp-2">
                      {item.productTitle}
                    </span>
                  )}

                  {!isDefaultVariant && (
                    <span className="cart-item-variant block text-xs text-muted-foreground mt-0.5" data-testid={`cart-item-variant-${item.id}`}>
                      {item.variantTitle}
                    </span>
                  )}

                  {item.sku && (
                    <span className="cart-item-sku text-muted-foreground at-num text-[11px] block">
                      SKU: {item.sku}
                    </span>
                  )}
                </div>

                {/* Pricing: Unit Price & Line Subtotal */}
                <div className="cart-item-prices flex items-baseline justify-between pt-1">
                  <span className="cart-item-unit-price text-muted-foreground text-xs sm:text-sm">
                    {formatStorePrice(item.unitPrice, currency)} each
                  </span>
                  <span
                    className="cart-item-line-total at-num text-sm text-foreground"
                    data-testid={`cart-item-subtotal-${item.id}`}
                  >
                    <ChangeFlash value={item.lineSubtotal}>{formatStorePrice(item.lineSubtotal, currency)}</ChangeFlash>
                  </span>
                </div>

                {/* Quantity Controls & Remove */}
                <div className="cart-item-actions flex items-center justify-between pt-2">
                  <div
                    className="cart-quantity-stepper flex items-center border border-[color:var(--at-hairline)]"
                    role="group"
                    aria-label={`Quantity for ${item.productTitle}`}
                  >
                    <button
                      type="button"
                      className="cart-stepper-btn w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center text-xs hover:bg-muted at-press transition-[background-color,transform] duration-150 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                      disabled={isMutating}
                      aria-label={
                        item.quantity === 1
                          ? `Remove ${item.productTitle} from cart`
                          : `Decrease quantity for ${item.productTitle}`
                      }
                      data-testid={`qty-dec-${item.id}`}
                    >
                      <Minus size={12} />
                    </button>
                    <span
                      className="cart-stepper-val w-8 text-center text-xs at-num text-foreground"
                      data-testid={`qty-val-${item.id}`}
                      aria-live="polite"
                    >
                      <ChangeFlash value={item.quantity}>{item.quantity}</ChangeFlash>
                    </span>
                    <button
                      type="button"
                      className="cart-stepper-btn w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center text-xs hover:bg-muted at-press transition-[background-color,transform] duration-150 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                      disabled={isMutating || item.quantity >= 999}
                      aria-label={`Increase quantity for ${item.productTitle}`}
                      data-testid={`qty-inc-${item.id}`}
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  <button
                    type="button"
                    className="cart-item-remove-btn at-link text-xs text-muted-foreground px-1 py-2 min-h-10 sm:min-h-0 inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    onClick={() => handleRemove(item.id)}
                    disabled={isMutating}
                    aria-label={`Remove ${item.productTitle} from cart`}
                    data-testid={`remove-item-${item.id}`}
                  >
                    {isItemBusy ? (
                      <Spinner size="sm" />
                    ) : (
                      <>
                        <span>Remove</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.li>
          );
        })}
        </AnimatePresence>
      </ul>
    </div>
  );
}
