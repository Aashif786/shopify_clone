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
    <aside className="checkout-summary-card card" data-testid="checkout-summary">
      <h2 className="checkout-summary-title font-bold text-lg" style={{ marginBottom: "var(--space-4)" }}>
        Order Summary
      </h2>

      {/* Items List */}
      <ul className="checkout-summary-items-list" role="list" style={{ listStyle: "none", padding: 0, margin: "0 0 var(--space-4) 0" }}>
        {checkout.items.map((item) => (
          <li
            key={item.id}
            className="checkout-summary-item"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              paddingBottom: "var(--space-3)",
              marginBottom: "var(--space-3)",
              borderBottom: "1px solid var(--color-border)",
            }}
            data-testid={`checkout-item-${item.id}`}
          >
            {/* Thumbnail */}
            <div
              className="checkout-item-thumbnail-wrap"
              style={{
                position: "relative",
                width: "56px",
                height: "56px",
                flexShrink: 0,
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-surface-hover)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.imageAlt || item.productNameSnapshot}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span style={{ fontSize: "1.25rem" }} aria-hidden="true">
                  📦
                </span>
              )}
              {/* Quantity badge */}
              <span
                className="checkout-item-qty-badge"
                style={{
                  position: "absolute",
                  top: "-4px",
                  right: "-4px",
                  backgroundColor: "var(--color-text)",
                  color: "var(--color-surface)",
                  borderRadius: "var(--radius-full)",
                  fontSize: "var(--font-size-xs)",
                  fontWeight: "var(--font-weight-bold)",
                  padding: "1px 6px",
                }}
                data-testid={`checkout-item-qty-${item.id}`}
              >
                {item.quantity}
              </span>
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="checkout-item-title font-semibold text-sm"
                style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {item.productNameSnapshot}
              </div>
              {item.variantNameSnapshot &&
                item.variantNameSnapshot !== "Default Title" &&
                item.variantNameSnapshot !== "Default" && (
                  <div className="checkout-item-variant text-muted text-xs">
                    {item.variantNameSnapshot}
                  </div>
                )}
              {item.skuSnapshot && (
                <div className="checkout-item-sku text-muted text-xs">SKU: {item.skuSnapshot}</div>
              )}
            </div>

            {/* Line Total */}
            <div className="checkout-item-price font-semibold text-sm" data-testid={`checkout-item-total-${item.id}`}>
              {formatStorePrice(item.lineTotal, currency)}
            </div>
          </li>
        ))}
      </ul>

      {/* Discount Redemption Section in Checkout */}
      {(onApplyDiscount || onRemoveDiscount || checkout.discountTotal > 0) && (
        <div className="checkout-summary-discount-section" style={{ margin: "var(--space-3) 0" }}>
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
      <div className="checkout-summary-breakdown" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-sm)" }}>
          <span className="text-muted">Subtotal</span>
          <span className="font-medium" data-testid="checkout-subtotal">
            {formatStorePrice(checkout.subtotal, currency)}
          </span>
        </div>

        {checkout.discountTotal > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-sm)" }}>
            <span className="text-muted">Discount</span>
            <span className="text-success font-medium" data-testid="checkout-discount">
              -{formatStorePrice(checkout.discountTotal, currency)}
            </span>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-sm)" }}>
          <span className="text-muted">Shipping</span>
          <span className="font-medium" data-testid="checkout-shipping">
            {checkout.shippingTotal > 0 ? formatStorePrice(checkout.shippingTotal, currency) : "Free"}
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-sm)" }}>
          <span className="text-muted">Estimated Tax</span>
          <span className="font-medium" data-testid="checkout-tax">
            {checkout.taxTotal > 0 ? formatStorePrice(checkout.taxTotal, currency) : "Calculated at checkout"}
          </span>
        </div>

        <div style={{ height: "1px", backgroundColor: "var(--color-border)", margin: "var(--space-2) 0" }} />

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-base)" }}>
          <span className="font-bold">Total</span>
          <span className="font-bold text-lg" data-testid="checkout-total">
            {formatStorePrice(checkout.total, currency)}
          </span>
        </div>
      </div>
    </aside>
  );
}
