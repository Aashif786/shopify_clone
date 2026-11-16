"use client";

import React, { useState } from "react";
import type { AppliedDiscountDTO } from "../../../lib/storefront-discount-helpers";
import { formatStorePrice } from "../products/product-card";
import { Spinner } from "@calcart/ui";
import { Tag, X } from "lucide-react";

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
      className={`applied-discount-badge ${compact ? "applied-discount-badge--compact" : ""} flex items-center justify-between p-3 rounded-[var(--ds-radius-card,0)] bg-tone-success/10 border border-dashed border-tone-success/30 text-tone-success my-2`}
      data-testid="applied-discount-badge"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-6 h-6 rounded-[var(--ds-radius-card,0)] bg-tone-success/20 text-tone-success flex items-center justify-center shrink-0" aria-hidden="true">
          <Tag size={12} />
        </span>
        <div className="truncate">
          <span
            className="font-bold text-xs uppercase tracking-wider text-tone-success "
            data-testid="applied-discount-code"
          >
            {code}
          </span>
          {label !== code && (
            <span className="text-xs text-muted-foreground ml-1.5 truncate">
              ({label})
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <span
          className="font-bold text-xs text-tone-success "
          data-testid="applied-discount-amount"
        >
          -{formatStorePrice(amount, currency)}
        </span>

        {onRemove && (
          <button
            type="button"
            className="w-6 h-6 rounded-[var(--ds-radius-btn,0)] flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            onClick={handleRemove}
            disabled={isBusy || disabled}
            aria-label={`Remove discount code ${code}`}
            data-testid="remove-discount-btn"
          >
            {isBusy ? (
              <Spinner size="sm" />
            ) : (
              <>
                <X size={12} />
                <span className="sr-only">✕</span>
              </>
            )}
          </button>
        )}
      </div>

      {removeError && (
        <span className="sr-only" role="alert">
          {removeError}
        </span>
      )}
    </div>
  );
}
