"use client";

import React, { useState, type FormEvent } from "react";
import { isValidEmail } from "../../../lib/storefront-checkout-helpers";
import { Spinner } from "@shopify-clone/ui";

export interface CustomerInformationFormProps {
  initialEmail?: string | null;
  onSubmit: (email: string) => Promise<void> | void;
  isLoading?: boolean;
  storeSlug: string;
}

export function CustomerInformationForm({
  initialEmail = "",
  onSubmit,
  isLoading = false,
  storeSlug,
}: CustomerInformationFormProps) {
  const [email, setEmail] = useState<string>(initialEmail || "");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();

    if (!trimmed) {
      setError("Email address is required");
      return;
    }

    if (!isValidEmail(trimmed)) {
      setError("Please enter a valid email address");
      return;
    }

    setError(null);
    await onSubmit(trimmed);
  };

  const cartHref = `/stores/${encodeURIComponent(storeSlug)}/cart`;

  return (
    <form
      className="checkout-form customer-info-form"
      onSubmit={handleSubmit}
      noValidate
      data-testid="customer-info-form"
    >
      <div className="checkout-form-header">
        <h2 className="checkout-form-title">Contact Information</h2>
        <p className="checkout-form-subtitle text-muted text-sm">
          We will send order confirmation and updates to this address.
        </p>
      </div>

      <div className="form-group" style={{ marginBottom: "var(--space-4)" }}>
        <label htmlFor="customer-email" className="form-label font-medium">
          Email address <span className="text-danger" aria-hidden="true">*</span>
        </label>
        <input
          id="customer-email"
          name="email"
          type="email"
          autoComplete="email"
          className={`input ${error ? "input--error" : ""}`}
          placeholder="your.email@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          disabled={isLoading}
          aria-required="true"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "email-error" : undefined}
          data-testid="customer-email-input"
        />
        {error && (
          <p id="email-error" className="form-error text-danger text-xs" role="alert" data-testid="email-error">
            {error}
          </p>
        )}
      </div>

      <div className="checkout-actions-row">
        <a href={cartHref} className="btn btn-outline btn-sm checkout-back-link">
          ← Return to Cart
        </a>
        <button
          type="submit"
          className="btn btn-primary btn-md checkout-submit-btn"
          disabled={isLoading}
          data-testid="continue-to-shipping-btn"
        >
          {isLoading ? (
            <>
              <Spinner size="sm" />
              <span style={{ marginLeft: "var(--space-2)" }}>Saving...</span>
            </>
          ) : (
            "Continue to Shipping"
          )}
        </button>
      </div>
    </form>
  );
}
