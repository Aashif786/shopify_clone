"use client";

import React from "react";
import type { StorefrontShippingDTO } from "../../../lib/storefront-checkout-helpers";
import { formatStorePrice } from "../products/product-card";
import { Truck, ArrowRight, TriangleAlert } from "lucide-react";

export interface DeliveryMethodSelectorProps {
  shippingTotal: number;
  currency?: string;
  onSubmit: () => void;
  onBack: () => void;
  isLoading?: boolean;
  /**
   * Set when the store prices shipping by rule. The options then come from the
   * server's frozen quote; without it the original single option is shown, so a
   * store that does not use the engine sees no change.
   */
  shippingEnabled?: boolean;
  shipping?: StorefrontShippingDTO | null;
  onSelectRate?: (rateId: string) => void | Promise<void>;
}

function formatDelivery(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  if (min !== null && max !== null) {
    return min === max
      ? `${min} business ${min === 1 ? "day" : "days"}`
      : `${min}–${max} business days`;
  }
  return `${(min ?? max) as number} business days`;
}

export function DeliveryMethodSelector({
  shippingTotal,
  currency = "USD",
  onSubmit,
  onBack,
  isLoading = false,
  shippingEnabled = false,
  shipping = null,
  onSelectRate,
}: DeliveryMethodSelectorProps) {
  const isFree = shippingTotal === 0;
  const hasOptions = shippingEnabled && shipping !== null && shipping.options.length > 0;
  // With the engine on, there is nothing to continue with until a real option
  // is selected; the server refuses payment otherwise, so the UI says so first.
  const cannotContinue = shippingEnabled && !(shipping && shipping.isServiceable);

  return (
    <div className="checkout-form delivery-method-section rounded-none border border-[color:var(--at-hairline)] bg-transparent p-6 sm:p-8 space-y-6" data-testid="delivery-method-section">
      <div className="checkout-form-header space-y-1">
        <h2 className="checkout-form-title text-xl font-extrabold tracking-tight text-foreground">
          Delivery Method
        </h2>
        <p className="checkout-form-subtitle text-muted text-sm text-muted-foreground">
          Select your preferred shipping option for fulfillment.
        </p>
      </div>

      {shippingEnabled ? (
        hasOptions ? (
          <div className="delivery-options-group space-y-3" role="radiogroup" aria-label="Available delivery methods" data-testid="delivery-options">
            {shipping!.options.map((option) => {
              const selected = option.rateId === shipping!.selectedRateId;
              const eta = formatDelivery(option.estimatedDaysMin, option.estimatedDaysMax);
              return (
                <label
                  key={option.rateId}
                  htmlFor={`delivery-${option.rateId}`}
                  className={`delivery-option-card flex items-center justify-between gap-4 p-5 rounded-none border-2 cursor-pointer transition-colors active:scale-[0.99] ${
                    selected ? "border-primary bg-primary/5" : "border-[color:var(--at-hairline)] hover:border-primary/40"
                  }`}
                  data-testid={`delivery-option-${option.rateId}`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <input
                      id={`delivery-${option.rateId}`}
                      name="deliveryMethod"
                      type="radio"
                      checked={selected}
                      disabled={isLoading}
                      onChange={() => {
                        if (!selected) void onSelectRate?.(option.rateId);
                      }}
                      className="radio text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                    />
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <Truck size={16} className="text-primary shrink-0" aria-hidden="true" />
                        <span className="font-bold text-sm text-foreground truncate">{option.name}</span>
                      </div>
                      {eta && <span className="text-xs text-muted-foreground block">{eta}</span>}
                    </div>
                  </div>
                  <div className="font-bold text-sm text-foreground shrink-0">
                    {option.isFree ? (
                      <span className="text-emerald-500 font-extrabold">FREE</span>
                    ) : (
                      formatStorePrice(option.price, currency)
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        ) : (
          <div
            role="alert"
            className="flex items-start gap-3 p-5 rounded-none border border-destructive/30 bg-destructive/5 text-sm"
            data-testid="delivery-unserviceable"
          >
            <TriangleAlert size={18} className="text-destructive shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">We can&apos;t ship this order to that address</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                This store has no delivery option for your address and order. Go back and try a
                different address, or contact the store.
              </p>
            </div>
          </div>
        )
      ) : (
        <div className="delivery-options-group" role="radiogroup" aria-label="Available delivery methods">
        <label
          className="delivery-option-card delivery-option-card--selected flex items-center justify-between p-5 rounded-none border-2 border-primary bg-primary/5 cursor-pointer transition-all"
          htmlFor="delivery-standard"
          data-testid="delivery-method-standard"
        >
          <div className="flex items-center gap-4">
            <div className="delivery-option-radio">
              <input
                id="delivery-standard"
                name="deliveryMethod"
                type="radio"
                defaultChecked
                disabled={isLoading}
                className="radio text-primary focus:ring-primary w-4 h-4 cursor-pointer"
              />
            </div>
            <div className="delivery-option-details space-y-0.5">
              <div className="flex items-center gap-2">
                <Truck size={16} className="text-primary" />
                <span className="delivery-option-name font-bold text-sm text-foreground">Standard Store Delivery</span>
              </div>
              <span className="delivery-option-desc text-muted text-xs text-muted-foreground block">
                Fulfilled directly by the store via standard courier (3–5 business days).
              </span>
            </div>
          </div>

          <div className="delivery-option-price font-bold text-sm text-foreground">
            {isFree ? (
              <span className="text-emerald-500 font-extrabold">FREE</span>
            ) : (
              formatStorePrice(shippingTotal, currency)
            )}
          </div>
        </label>
      </div>
      )}

      <div className="checkout-actions-row flex items-center justify-between pt-4 border-t border-[color:var(--at-hairline)]">
        <button
          type="button"
          className="btn btn-outline btn-sm checkout-back-btn rounded-none px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
          onClick={onBack}
          disabled={isLoading}
          data-testid="back-to-shipping-btn"
        >
          <span>← Return to Shipping</span>
        </button>
        <button
          type="button"
          className="checkout-submit-btn ds-btn ds-btn-primary"
          onClick={onSubmit}
          disabled={isLoading || cannotContinue}
          data-testid="continue-to-payment-btn"
        >
          <span>Continue to Payment</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
