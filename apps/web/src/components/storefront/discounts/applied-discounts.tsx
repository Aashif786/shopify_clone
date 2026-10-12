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
      className={`applied-discount-badge ${compact ? "applied-discount-badge--compact" : ""}`}
      data-testid="applied-discount-badge"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "var(--space-2) var(--space-3)",
        backgroundColor: "var(--color-surface-hover)",
        border: "1px dashed var(--color-success)",
        borderRadius: "var(--radius-md)",
        margin: "var(--space-2) 0",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <span style={{ fontSize: "1rem" }} aria-hidden="true">
          🏷️
        </span>
        <div>
          <span
            className="font-bold text-sm text-success"
            data-testid="applied-discount-code"
            style={{ textTransform: "uppercase" }}
          >
            {code}
          </span>
          {label !== code && (
            <span className="text-muted text-xs" style={{ marginLeft: "var(--space-2)" }}>
              ({label})
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <span
          className="font-semibold text-sm text-success"
          data-testid="applied-discount-amount"
        >
          -{formatStorePrice(amount, currency)}
        </span>

        {onRemove && (
          <button
            type="button"
            className="btn btn-ghost btn-xs text-muted applied-discount-remove-btn"
            onClick={handleRemove}
            disabled={isBusy || disabled}
            aria-label={`Remove discount code ${code}`}
            data-testid="remove-discount-btn"
            style={{ padding: "2px 6px", minWidth: "auto", fontSize: "0.75rem" }}
          >
            {isBusy ? <Spinner size="sm" /> : "✕"}
          </button>
        )}
      </div>

      {removeError && (
        <div
          className="form-error text-danger text-xs"
          role="alert"
          style={{ width: "100%", marginTop: "var(--space-1)" }}
        >
          {removeError}
        </div>
      )}
    </div>
  );
}
