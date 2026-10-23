"use client";

import React, { useState, type FormEvent } from "react";
import { normalizeDiscountCode } from "../../../lib/storefront-discount-helpers";
import { Spinner } from "@shopify-clone/ui";

export interface DiscountCodeFormProps {
  onApply: (code: string) => Promise<void> | void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  error?: string | null;
  onClearError?: () => void;
  compact?: boolean;
}

export function DiscountCodeForm({
  onApply,
  isLoading = false,
  disabled = false,
  placeholder = "Discount code",
  error = null,
  onClearError,
  compact = false,
}: DiscountCodeFormProps) {
  const [code, setCode] = useState<string>("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const displayedError = error || localError;
  const isBusy = isLoading || isSubmitting;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const normalized = normalizeDiscountCode(code);

    if (!normalized) {
      setLocalError("Please enter a discount code");
      return;
    }

    setLocalError(null);
    onClearError?.();
    setIsSubmitting(true);

    try {
      await onApply(normalized);
      setCode("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to apply discount code";
      setLocalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value);
    if (localError) setLocalError(null);
    if (error) onClearError?.();
  };

  return (
    <form
      className={`discount-code-form ${compact ? "discount-code-form--compact" : ""} space-y-1.5`}
      onSubmit={handleSubmit}
      noValidate
      data-testid="discount-code-form"
    >
      <div className="flex gap-2 items-center">
        <div className="flex-1 relative">
          <label htmlFor="discount-code-input" className="sr-only">
            Discount code
          </label>
          <input
            id="discount-code-input"
            name="discountCode"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className={`input ${
              displayedError ? "input--error border-destructive" : "border-border/80"
            } w-full uppercase px-3.5 py-2 rounded-xl bg-background text-xs font-semibold tracking-wider text-foreground placeholder:normal-case placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all`}
            placeholder={placeholder}
            value={code}
            onChange={handleChange}
            disabled={isBusy || disabled}
            aria-label="Discount code"
            aria-required="true"
            aria-invalid={Boolean(displayedError)}
            aria-describedby={displayedError ? "discount-code-error" : undefined}
            data-testid="discount-code-input"
          />
        </div>

        <button
          type="submit"
          className="btn btn-outline btn-md discount-apply-btn rounded-xl px-4 py-2 text-xs font-bold hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all shrink-0"
          disabled={isBusy || disabled}
          aria-busy={isBusy}
          data-testid="apply-discount-btn"
        >
          {isBusy ? (
            <span className="flex items-center gap-1.5">
              <Spinner size="sm" />
              <span>Applying...</span>
            </span>
          ) : (
            "Apply"
          )}
        </button>
      </div>

      {displayedError && (
        <div
          id="discount-code-error"
          className="form-error text-danger text-destructive text-xs font-medium pl-1"
          role="alert"
          data-testid="discount-error"
        >
          {displayedError}
        </div>
      )}
    </form>
  );
}
