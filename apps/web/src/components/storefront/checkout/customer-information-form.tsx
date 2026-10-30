"use client";

import React, { useState, type FormEvent } from "react";
import { isValidEmail } from "../../../lib/storefront-checkout-helpers";
import { Spinner } from "@calcart/ui";
import { ArrowRight } from "lucide-react";

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
      className="checkout-form customer-info-form rounded-3xl border border-border/70 bg-card p-6 sm:p-8 shadow-sm space-y-6"
      onSubmit={handleSubmit}
      noValidate
      data-testid="customer-info-form"
    >
      <div className="checkout-form-header space-y-1">
        <h2 className="checkout-form-title text-xl font-extrabold tracking-tight text-foreground">
          Contact Information
        </h2>
        <p className="checkout-form-subtitle text-muted text-sm text-muted-foreground">
          We will send order confirmation and updates to this address.
        </p>
      </div>

      <div className="form-group space-y-2">
        <label htmlFor="customer-email" className="form-label font-semibold text-xs uppercase tracking-wider text-muted-foreground">
          Email address <span className="text-danger text-destructive" aria-hidden="true">*</span>
        </label>
        <div className="relative">
          <input
            id="customer-email"
            name="email"
            type="email"
            autoComplete="email"
            className={`input ${error ? "input--error border-destructive ring-destructive/20" : "border-border/80"} w-full px-4 py-3 rounded-2xl bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all`}
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
        </div>
        {error && (
          <p id="email-error" className="form-error text-danger text-destructive text-xs font-medium" role="alert" data-testid="email-error">
            {error}
          </p>
        )}
      </div>

      <div className="checkout-actions-row flex items-center justify-between pt-4 border-t border-border/50">
        <a
          href={cartHref}
          className="btn btn-outline btn-sm checkout-back-link rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
        >
          <span>← Return to Cart</span>
        </a>
        <button
          type="submit"
          className="btn btn-primary btn-md checkout-submit-btn rounded-xl px-6 py-2.5 text-xs font-bold shadow-md hover:shadow-primary/20 transition-all inline-flex items-center gap-2"
          disabled={isLoading}
          data-testid="continue-to-shipping-btn"
        >
          {isLoading ? (
            <>
              <Spinner size="sm" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <span>Continue to Shipping</span>
              <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
