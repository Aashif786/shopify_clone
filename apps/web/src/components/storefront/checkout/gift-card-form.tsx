"use client";

import React, { useState, type FormEvent } from "react";
import { Spinner } from "@calcart/ui";

export interface GiftCardFormProps {
  onApply: (code: string) => Promise<void> | void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  error?: string | null;
  onClearError?: () => void;
  compact?: boolean;
}

export function GiftCardForm({
  onApply,
  isLoading = false,
  disabled = false,
  placeholder = "Gift card code",
  error = null,
  onClearError,
  compact = false,
}: GiftCardFormProps) {
  const [code, setCode] = useState<string>("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const displayedError = error || localError;
  const isBusy = isLoading || isSubmitting;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();

    if (!trimmed) {
      setLocalError("Please enter a gift card code");
      return;
    }

    setLocalError(null);
    onClearError?.();
    setIsSubmitting(true);

    try {
      await onApply(trimmed);
      setCode("");
      setIsOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to apply gift card";
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

  if (!isOpen) {
    return (
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="text-xs font-semibold text-primary/80 hover:text-primary transition-colors flex items-center gap-1.5 cursor-pointer"
          data-testid="toggle-giftcard-form"
        >
          <span className="text-sm leading-none">+</span> Have a gift card?
        </button>
      </div>
    );
  }

  return (
    <form
      className={`gift-card-form ${compact ? "gift-card-form--compact" : ""} space-y-1.5 pt-1`}
      onSubmit={handleSubmit}
      noValidate
      data-testid="gift-card-form"
    >
      <div className="flex gap-2 items-center">
        <div className="flex-1 relative">
          <label htmlFor="gift-card-input" className="sr-only">
            Gift card code
          </label>
          <input
            id="gift-card-input"
            name="giftCardCode"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className={`input ${
              displayedError ? "input--error border-destructive" : "border-[color:var(--at-hairline)]"
            } w-full uppercase px-3.5 py-2 rounded-none bg-background text-xs font-semibold tracking-wider text-foreground placeholder:normal-case placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all`}
            placeholder={placeholder}
            value={code}
            onChange={handleChange}
            disabled={isBusy || disabled}
            aria-label="Gift card code"
            aria-required="true"
            aria-invalid={Boolean(displayedError)}
            aria-describedby={displayedError ? "gift-card-error" : undefined}
            data-testid="gift-card-input"
          />
        </div>

        <button
          type="submit"
          className="btn btn-outline btn-md gift-card-apply-btn rounded-none px-4 py-2 text-xs font-bold hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all shrink-0 cursor-pointer"
          disabled={isBusy || disabled}
          data-testid="gift-card-apply-button"
        >
          {isBusy ? <Spinner size="sm" aria-label="Applying" /> : "Apply"}
        </button>

        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setLocalError(null);
            setCode("");
          }}
          className="text-xs text-muted-foreground hover:text-foreground px-1 py-2 cursor-pointer"
          title="Cancel"
        >
          ✕
        </button>
      </div>

      {displayedError && (
        <p
          id="gift-card-error"
          className="text-xs text-destructive font-medium pl-1 animate-in fade-in slide-in-from-top-1"
          role="alert"
          data-testid="gift-card-error"
        >
          {displayedError}
        </p>
      )}
    </form>
  );
}
