"use client";

import React from "react";
import { formatStorePrice } from "../products/product-card";

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
    <div className="checkout-form delivery-method-section" data-testid="delivery-method-section">
      <div className="checkout-form-header">
        <h2 className="checkout-form-title">Delivery Method</h2>
        <p className="checkout-form-subtitle text-muted text-sm">
          Select your preferred shipping option for fulfillment.
        </p>
      </div>

      <div className="delivery-options-group" role="radiogroup" aria-label="Available delivery methods">
        <label
          className="delivery-option-card delivery-option-card--selected"
          htmlFor="delivery-standard"
          data-testid="delivery-method-standard"
        >
          <div className="delivery-option-radio">
            <input
              id="delivery-standard"
              name="deliveryMethod"
              type="radio"
              defaultChecked
              disabled={isLoading}
              className="radio"
            />
          </div>
          <div className="delivery-option-details">
            <span className="delivery-option-name font-semibold">Standard Store Delivery</span>
            <span className="delivery-option-desc text-muted text-xs">
              Fulfilled directly by the store via standard courier (3–5 business days).
            </span>
          </div>
          <div className="delivery-option-price font-semibold">
            {isFree ? "FREE" : formatStorePrice(shippingTotal, currency)}
          </div>
        </label>
      </div>

      <div className="checkout-actions-row">
        <button
          type="button"
          className="btn btn-outline btn-sm checkout-back-btn"
          onClick={onBack}
          disabled={isLoading}
          data-testid="back-to-shipping-btn"
        >
          ← Return to Shipping
        </button>
        <button
          type="button"
          className="btn btn-primary btn-md checkout-submit-btn"
          onClick={onSubmit}
          disabled={isLoading}
          data-testid="continue-to-payment-btn"
        >
          Continue to Payment
        </button>
      </div>
    </div>
  );
}
