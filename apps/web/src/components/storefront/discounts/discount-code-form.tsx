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
      className={`discount-code-form ${compact ? "discount-code-form--compact" : ""}`}
      onSubmit={handleSubmit}
      noValidate
      data-testid="discount-code-form"
      style={{ margin: "var(--space-3) 0" }}
    >
      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="discount-code-input" className="sr-only">
            Discount Code
          </label>
          <input
            id="discount-code-input"
            name="discountCode"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className={`input ${displayedError ? "input--error" : ""}`}
            placeholder={placeholder}
            value={code}
            onChange={handleChange}
            disabled={isBusy || disabled}
            aria-label="Discount Code"
            aria-required="true"
            aria-invalid={Boolean(displayedError)}
            aria-describedby={displayedError ? "discount-code-error" : undefined}
            data-testid="discount-code-input"
            style={{ width: "100%", textTransform: "uppercase" }}
          />
        </div>

        <button
          type="submit"
          className="btn btn-outline btn-md discount-apply-btn"
          disabled={isBusy || disabled || !code.trim()}
          aria-busy={isBusy}
          data-testid="apply-discount-btn"
          style={{ whiteSpace: "nowrap" }}
        >
          {isBusy ? (
            <span style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
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
          className="form-error text-danger text-xs"
          role="alert"
          data-testid="discount-error"
          style={{ marginTop: "var(--space-1)" }}
        >
          {displayedError}
        </div>
      )}
    </form>
  );
}
