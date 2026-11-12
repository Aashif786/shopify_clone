"use client";

import React from "react";
import type {
  StorefrontCheckoutDTO,
  StorefrontShippingDTO,
  StorefrontTaxBreakdownDTO,
} from "../../../lib/storefront-checkout-helpers";
import type { AppliedDiscountDTO } from "../../../lib/storefront-discount-helpers";
import { formatStorePrice } from "../products/product-card";
import { DiscountCodeForm } from "../discounts/discount-code-form";
import { AppliedDiscounts } from "../discounts/applied-discounts";
import { GiftCardForm } from "./gift-card-form";
import { StoreCreditSelector } from "./store-credit-selector";

/**
 * The checkout as the storefront API returns it. The GST fields are optional:
 * they are absent for older payloads and for stores that charge no tax, in
 * which case the summary renders exactly as it always has.
 */
export type CheckoutSummaryCheckout = StorefrontCheckoutDTO & {
  taxEnabled?: boolean;
  tax?: StorefrontTaxBreakdownDTO | null;
  shippingEnabled?: boolean;
  shipping?: StorefrontShippingDTO | null;
};

function formatRate(rateBps: number): string {
  const percent = rateBps / 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2).replace(/0+$/, "")}%`;
}

export interface CheckoutSummaryProps {
  checkout: CheckoutSummaryCheckout;
  storeSlug?: string;
  appliedDiscount?: AppliedDiscountDTO | null;
  onApplyDiscount?: (code: string) => Promise<void> | void;
  onRemoveDiscount?: () => Promise<void> | void;
  isDiscountLoading?: boolean;
  onApplyGiftCard?: (code: string) => Promise<void> | void;
  onRemoveGiftCard?: (giftCardId: string) => Promise<void> | void;
  isGiftCardLoading?: boolean;
  onApplyStoreCredit?: (amount?: number) => Promise<void> | void;
  onRemoveStoreCredit?: () => Promise<void> | void;
  isStoreCreditLoading?: boolean;
}

export function CheckoutSummary({
  checkout,
  storeSlug,
  appliedDiscount,
  onApplyDiscount,
  onRemoveDiscount,
  isDiscountLoading = false,
  onApplyGiftCard,
  onRemoveGiftCard,
  isGiftCardLoading = false,
  onApplyStoreCredit,
  onRemoveStoreCredit,
  isStoreCreditLoading = false,
}: CheckoutSummaryProps) {
  const currency = checkout.currency || "USD";
  const tax = checkout.tax ?? null;
  const taxLineByItem = new Map(tax?.lines.map((line) => [line.lineId, line]) ?? []);

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
              {taxLineByItem.get(item.variantId) && (
                <div
                  className="text-[11px] font-mono text-muted-foreground"
                  data-testid={`checkout-item-gst-${item.id}`}
                >
                  GST {formatRate(taxLineByItem.get(item.variantId)!.rateBps)}
                  {taxLineByItem.get(item.variantId)!.hsnCode
                    ? ` · HSN ${taxLineByItem.get(item.variantId)!.hsnCode}`
                    : ""}
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

          {onApplyGiftCard && (
            <GiftCardForm
              onApply={onApplyGiftCard}
              isLoading={isGiftCardLoading}
              compact={true}
            />
          )}

          {storeSlug && checkout.id && (
            <StoreCreditSelector
              storeSlug={storeSlug}
              checkoutId={checkout.id}
              currency={currency}
              payableAmount={checkout.total}
              appliedStoreCredit={checkout.appliedStoreCredit ?? null}
              onApplyStoreCredit={onApplyStoreCredit}
              onRemoveStoreCredit={onRemoveStoreCredit}
              isLoading={isStoreCreditLoading}
              guestToken={checkout.guestToken ?? undefined}
            />
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

        <div className="space-y-0.5">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground font-medium">Shipping</span>
            <span className="font-semibold text-foreground" data-testid="checkout-shipping">
              {checkout.shippingEnabled && !checkout.shipping
                ? "Added once you enter a shipping address"
                : checkout.shippingEnabled && checkout.shipping && !checkout.shipping.isServiceable
                  ? "Not available"
                  : checkout.shippingTotal > 0
                    ? formatStorePrice(checkout.shippingTotal, currency)
                    : "Free"}
            </span>
          </div>
          {checkout.shipping?.selectedRateName && (
            <p className="text-[11px] text-muted-foreground" data-testid="checkout-shipping-method">
              {checkout.shipping.selectedRateName}
            </p>
          )}
        </div>

        {tax ? (
          <div className="space-y-1.5" data-testid="checkout-gst-breakdown">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">
                GST {tax.pricesIncludeTax && <span className="text-[11px] font-normal text-muted-foreground">(included)</span>}
              </span>
              <span className="font-semibold text-foreground" data-testid="checkout-tax">
                {tax.supplyType === "EXPORT"
                  ? "Not applicable"
                  : tax.pricesIncludeTax
                    ? `Included (${formatStorePrice(checkout.taxTotal, currency)})`
                    : formatStorePrice(checkout.taxTotal, currency)}
              </span>
            </div>
            {tax.supplyType === "INTRA_STATE" && (
              <>
                <div className="flex justify-between items-center pl-3 text-xs text-muted-foreground">
                  <span>CGST</span>
                  <span className="font-mono" data-testid="checkout-cgst">
                    {formatStorePrice(tax.cgstTotal, currency)}
                  </span>
                </div>
                <div className="flex justify-between items-center pl-3 text-xs text-muted-foreground">
                  <span>SGST</span>
                  <span className="font-mono" data-testid="checkout-sgst">
                    {formatStorePrice(tax.sgstTotal, currency)}
                  </span>
                </div>
              </>
            )}
            {tax.supplyType === "INTER_STATE" && (
              <div className="flex justify-between items-center pl-3 text-xs text-muted-foreground">
                <span>IGST</span>
                <span className="font-mono" data-testid="checkout-igst">
                  {formatStorePrice(tax.igstTotal, currency)}
                </span>
              </div>
            )}
            <p className="pl-3 text-[11px] text-muted-foreground">
              {tax.placeOfSupplyName
                ? `Place of supply: ${tax.placeOfSupplyName}`
                : "Delivery outside India: no Indian GST charged"}
            </p>
          </div>
        ) : checkout.taxEnabled ? (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground font-medium">GST</span>
            <span className="text-xs text-muted-foreground" data-testid="checkout-tax">
              Added once you enter a shipping address
            </span>
          </div>
        ) : (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground font-medium">Estimated Tax</span>
            <span className="font-semibold text-foreground" data-testid="checkout-tax">
              {checkout.taxTotal > 0 ? formatStorePrice(checkout.taxTotal, currency) : "Calculated at checkout"}
            </span>
          </div>
        )}

        {checkout.giftCardTotal && checkout.giftCardTotal > 0 ? (
          <div className="space-y-1.5" data-testid="checkout-gift-cards-section">
            <div className="flex justify-between items-center text-emerald-500 font-semibold">
              <span className="text-muted">Gift Card</span>
              <span className="text-success font-medium" data-testid="checkout-gift-card-total">
                -{formatStorePrice(checkout.giftCardTotal, currency)}
              </span>
            </div>
            {checkout.appliedGiftCards?.map((card) => (
              <div
                key={card.id}
                className="flex justify-between items-center pl-3 text-xs text-muted-foreground"
                data-testid={`checkout-applied-giftcard-${card.id}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] font-semibold">{card.maskedCode}</span>
                  {onRemoveGiftCard && (
                    <button
                      type="button"
                      onClick={() => onRemoveGiftCard(card.giftCardId)}
                      disabled={isGiftCardLoading}
                      className="text-[10px] text-destructive hover:underline ml-1 cursor-pointer"
                      title="Remove gift card"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <span className="font-mono">
                  -{formatStorePrice(card.appliedAmount, currency)}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {checkout.storeCreditTotal && checkout.storeCreditTotal > 0 ? (
          <div className="space-y-1.5" data-testid="checkout-store-credit-section">
            <div className="flex justify-between items-center text-emerald-500 font-semibold">
              <span className="text-muted">Store Credit</span>
              <span className="text-success font-medium" data-testid="checkout-store-credit-total">
                -{formatStorePrice(checkout.storeCreditTotal, currency)}
              </span>
            </div>
            {checkout.appliedStoreCredit ? (
              <div
                className="flex justify-between items-center pl-3 text-xs text-muted-foreground"
                data-testid="checkout-applied-store-credit-row"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium">Account Balance</span>
                  {onRemoveStoreCredit && (
                    <button
                      type="button"
                      onClick={() => onRemoveStoreCredit()}
                      disabled={isStoreCreditLoading}
                      className="text-[10px] text-destructive hover:underline ml-1 cursor-pointer"
                      title="Remove store credit"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <span className="font-mono">
                  -{formatStorePrice(checkout.appliedStoreCredit.appliedAmount, currency)}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

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
