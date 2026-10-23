"use client";

import React, { useState } from "react";
import type { AppliedDiscountDTO } from "../../../lib/storefront-discount-helpers";
import { formatStorePrice } from "../products/product-card";
import { Spinner } from "@shopify-clone/ui";

export interface AppliedDiscountsProps {
  discount?: AppliedDiscountDTO | null;
  discountTotal?: number;
  currency?: string;
  onRemove?: () => Promise<void> | void;
  isLoading?: boolean;
  disabled?: boolean;
  compact?: boolean;
}

export function AppliedDiscounts({
  discount,
  discountTotal = 0,
  currency = "USD",
  onRemove,
  isLoading = false,
  disabled = false,
  compact = false,
}: AppliedDiscountsProps) {
  const [isRemoving, setIsRemoving] = useState<boolean>(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const amount = discount?.amount ?? discountTotal;
  const isBusy = isLoading || isRemoving;

  if (amount <= 0 && !discount) {
    return null;
  }

  const code = discount?.code ?? "DISCOUNT";
  const label = discount?.name || code;

  const handleRemove = async () => {
    if (!onRemove || isBusy || disabled) return;
    setIsRemoving(true);
    setRemoveError(null);

    try {
      await onRemove();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove discount";
      setRemoveError(msg);
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div
      className={`applied-discount-badge ${compact ? "applied-discount-badge--compact" : ""} flex items-center justify-between p-3 rounded-2xl bg-emerald-500/10 border border-dashed border-emerald-500/30 text-emerald-500 my-2 shadow-sm`}
      data-testid="applied-discount-badge"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="checkout-glyph checkout-glyph--small w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-black" aria-hidden="true">
          OFF
        </span>
        <div className="truncate">
          <span
            className="font-bold text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400"
            data-testid="applied-discount-code"
          >
            {code}
          </span>
          {label !== code && (
            <span className="text-muted text-xs text-muted-foreground ml-1.5 truncate">
              ({label})
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <span
          className="font-bold text-xs text-emerald-600 dark:text-emerald-400"
          data-testid="applied-discount-amount"
        >
          -{formatStorePrice(amount, currency)}
        </span>

        {onRemove && (
          <button
            type="button"
            className="btn btn-ghost btn-xs text-muted applied-discount-remove-btn w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            onClick={handleRemove}
            disabled={isBusy || disabled}
            aria-label={`Remove discount code ${code}`}
            data-testid="remove-discount-btn"
          >
            {isBusy ? <Spinner size="sm" /> : "✕"}
          </button>
        )}
      </div>

      {removeError && (
        <div
          className="form-error text-danger text-destructive text-xs w-full mt-1 font-medium"
          role="alert"
        >
          {removeError}
        </div>
      )}
    </div>
  );
}
