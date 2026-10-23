"use client";

import React from "react";
import { formatStorePrice } from "../products/product-card";
import { Truck, ArrowRight } from "lucide-react";

export interface DeliveryMethodSelectorProps {
  shippingTotal: number;
  currency?: string;
  onSubmit: () => void;
  onBack: () => void;
  isLoading?: boolean;
}

export function DeliveryMethodSelector({
  shippingTotal,
  currency = "USD",
  onSubmit,
  onBack,
  isLoading = false,
}: DeliveryMethodSelectorProps) {
  const isFree = shippingTotal === 0;

  return (
    <div className="checkout-form delivery-method-section rounded-3xl border border-border/70 bg-card p-6 sm:p-8 shadow-sm space-y-6" data-testid="delivery-method-section">
      <div className="checkout-form-header space-y-1">
        <h2 className="checkout-form-title text-xl font-extrabold tracking-tight text-foreground">
          Delivery Method
        </h2>
        <p className="checkout-form-subtitle text-muted text-sm text-muted-foreground">
          Select your preferred shipping option for fulfillment.
        </p>
      </div>

      <div className="delivery-options-group" role="radiogroup" aria-label="Available delivery methods">
        <label
          className="delivery-option-card delivery-option-card--selected flex items-center justify-between p-5 rounded-2xl border-2 border-primary bg-primary/5 cursor-pointer shadow-sm transition-all"
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

      <div className="checkout-actions-row flex items-center justify-between pt-4 border-t border-border/50">
        <button
          type="button"
          className="btn btn-outline btn-sm checkout-back-btn rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
          onClick={onBack}
          disabled={isLoading}
          data-testid="back-to-shipping-btn"
        >
          <span>← Return to Shipping</span>
        </button>
        <button
          type="button"
          className="btn btn-primary btn-md checkout-submit-btn rounded-xl px-6 py-2.5 text-xs font-bold shadow-md hover:shadow-primary/20 transition-all inline-flex items-center gap-2"
          onClick={onSubmit}
          disabled={isLoading}
          data-testid="continue-to-payment-btn"
        >
          <span>Continue to Payment</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
