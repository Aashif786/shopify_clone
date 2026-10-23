"use client";

import React from "react";
import type { StorefrontCheckoutDTO } from "../../../lib/storefront-checkout-helpers";
import type { AppliedDiscountDTO } from "../../../lib/storefront-discount-helpers";
import { formatStorePrice } from "../products/product-card";
import { DiscountCodeForm } from "../discounts/discount-code-form";
import { AppliedDiscounts } from "../discounts/applied-discounts";

export interface CheckoutSummaryProps {
  checkout: StorefrontCheckoutDTO;
  storeSlug?: string;
  appliedDiscount?: AppliedDiscountDTO | null;
  onApplyDiscount?: (code: string) => Promise<void> | void;
  onRemoveDiscount?: () => Promise<void> | void;
  isDiscountLoading?: boolean;
}

export function CheckoutSummary({
  checkout,
  appliedDiscount,
  onApplyDiscount,
  onRemoveDiscount,
  isDiscountLoading = false,
}: CheckoutSummaryProps) {
  const currency = checkout.currency || "USD";

  return (
    <aside
      className="checkout-summary-card card rounded-3xl border border-border/70 bg-card p-6 sm:p-7 shadow-sm space-y-6"
      data-testid="checkout-summary"
    >
      <div className="flex items-center justify-between">
        <h2 className="checkout-summary-title font-extrabold text-lg tracking-tight text-foreground">
          Order Summary
        </h2>
        <span className="text-xs text-muted-foreground font-semibold">
          {checkout.items.reduce((acc, it) => acc + it.quantity, 0)} items
        </span>
      </div>

      {/* Items List */}
      <ul className="checkout-summary-items-list divide-y divide-border/50 list-none p-0 m-0" role="list">
        {checkout.items.map((item) => (
          <li
            key={item.id}
            className="checkout-summary-item flex items-center gap-3.5 py-3.5"
            data-testid={`checkout-item-${item.id}`}
          >
            {/* Thumbnail */}
            <div
              className="checkout-item-thumbnail-wrap relative w-14 h-14 shrink-0 rounded-xl overflow-hidden border border-border/60 bg-muted/30 flex items-center justify-center"
            >
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.imageAlt || item.productNameSnapshot}
                  className="w-full h-full object-cover object-center"
                />
              ) : (
                <span className="checkout-glyph text-[10px] font-mono text-muted-foreground font-bold" aria-hidden="true">
                  BOX
                </span>
              )}
              {/* Quantity badge */}
              <span
                className="checkout-item-qty-badge absolute -top-1.5 -right-1.5 bg-foreground text-background rounded-full text-[10px] font-bold px-1.5 min-w-[18px] h-[18px] flex items-center justify-center shadow-sm"
                data-testid={`checkout-item-qty-${item.id}`}
              >
                {item.quantity}
              </span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-0.5">
              <div
                className="checkout-item-title font-bold text-xs sm:text-sm text-foreground truncate"
              >
                {item.productNameSnapshot}
              </div>
              {item.variantNameSnapshot &&
                item.variantNameSnapshot !== "Default Title" &&
                item.variantNameSnapshot !== "Default" && (
                  <div className="checkout-item-variant text-muted-foreground text-xs truncate">
                    {item.variantNameSnapshot}
                  </div>
                )}
              {item.skuSnapshot && (
                <div className="checkout-item-sku text-muted text-[11px] font-mono text-muted-foreground">
                  SKU: {item.skuSnapshot}
                </div>
              )}
            </div>

            {/* Line Total */}
            <div className="checkout-item-price font-bold text-sm text-foreground shrink-0" data-testid={`checkout-item-total-${item.id}`}>
              {formatStorePrice(item.lineTotal, currency)}
            </div>
          </li>
        ))}
      </ul>

      {/* Discount Redemption Section in Checkout */}
      {(onApplyDiscount || onRemoveDiscount || checkout.discountTotal > 0) && (
        <div className="checkout-summary-discount-section pt-1">
          {checkout.discountTotal > 0 ? (
            <AppliedDiscounts
              discount={appliedDiscount}
              discountTotal={checkout.discountTotal}
              currency={currency}
              onRemove={onRemoveDiscount}
              isLoading={isDiscountLoading}
              compact={true}
            />
          ) : (
            onApplyDiscount && (
              <DiscountCodeForm
                onApply={onApplyDiscount}
                isLoading={isDiscountLoading}
                compact={true}
              />
            )
          )}
        </div>
      )}

      {/* Financial Breakdown */}
      <div className="checkout-summary-breakdown space-y-2.5 pt-3 border-t border-border/50 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground font-medium">Subtotal</span>
          <span className="font-semibold text-foreground" data-testid="checkout-subtotal">
            {formatStorePrice(checkout.subtotal, currency)}
          </span>
        </div>

        {checkout.discountTotal > 0 && (
          <div className="flex justify-between items-center text-emerald-500 font-semibold">
            <span className="text-muted">Discount</span>
            <span className="text-success font-medium" data-testid="checkout-discount">
              -{formatStorePrice(checkout.discountTotal, currency)}
            </span>
          </div>
        )}

        <div className="flex justify-between items-center">
          <span className="text-muted-foreground font-medium">Shipping</span>
          <span className="font-semibold text-foreground" data-testid="checkout-shipping">
            {checkout.shippingTotal > 0 ? formatStorePrice(checkout.shippingTotal, currency) : "Free"}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-muted-foreground font-medium">Estimated Tax</span>
          <span className="font-semibold text-foreground" data-testid="checkout-tax">
            {checkout.taxTotal > 0 ? formatStorePrice(checkout.taxTotal, currency) : "Calculated at checkout"}
          </span>
        </div>

        <div className="h-px bg-border/60 my-2" />

        <div className="flex justify-between items-baseline pt-1">
          <span className="font-bold text-base text-foreground">Total</span>
          <span className="font-extrabold text-2xl tracking-tight text-foreground" data-testid="checkout-total">
            {formatStorePrice(checkout.total, currency)}
          </span>
        </div>
      </div>
    </aside>
  );
}
