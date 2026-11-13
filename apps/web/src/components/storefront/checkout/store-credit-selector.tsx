"use client";

import React, { useEffect, useState, useCallback } from "react";
import { formatStorePrice } from "../products/product-card";
import { Spinner } from "@calcart/ui";
import { Coins, Sparkles, Check, X } from "lucide-react";
import type { AppliedStoreCreditDTO } from "@calcart/giftcards";

export interface StoreCreditSelectorProps {
  storeSlug: string;
  checkoutId: string;
  currency: string;
  payableAmount: number;
  appliedStoreCredit?: AppliedStoreCreditDTO | null;
  onApplyStoreCredit?: (amount?: number) => Promise<void> | void;
  onRemoveStoreCredit?: () => Promise<void> | void;
  isLoading?: boolean;
  guestToken?: string | null;
}

interface StoreCreditInfo {
  isLoggedIn: boolean;
  availableBalance: number;
  currency: string;
  appliedAmount: number;
}

export function StoreCreditSelector({
  storeSlug,
  checkoutId,
  currency,
  payableAmount,
  appliedStoreCredit,
  onApplyStoreCredit,
  onRemoveStoreCredit,
  isLoading = false,
  guestToken,
}: StoreCreditSelectorProps) {
  const [creditInfo, setCreditInfo] = useState<StoreCreditInfo | null>(null);
  const [isFetchingInfo, setIsFetchingInfo] = useState<boolean>(true);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const fetchCreditInfo = useCallback(async () => {
    try {
      setIsFetchingInfo(true);
      const headers: Record<string, string> = {};
      if (guestToken) {
        headers["x-guest-token"] = guestToken;
      }
      const res = await fetch(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/checkout/${encodeURIComponent(checkoutId)}/store-credit`,
        { headers },
      );
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setCreditInfo(json.data);
        }
      }
    } catch {
      // Non-fatal if store credit check fails
    } finally {
      setIsFetchingInfo(false);
    }
  }, [storeSlug, checkoutId, guestToken]);

  useEffect(() => {
    fetchCreditInfo();
  }, [fetchCreditInfo]);

  // Keep local info synchronized with parent's applied store credit
  useEffect(() => {
    if (creditInfo && appliedStoreCredit) {
      setCreditInfo((prev) =>
        prev
          ? {
              ...prev,
              appliedAmount: appliedStoreCredit.appliedAmount,
            }
          : prev,
      );
    }
  }, [appliedStoreCredit]);

  if (isFetchingInfo) {
    return null;
  }

  // If customer is not logged in or has 0 balance and none applied, don't show selector
  if (!creditInfo || (!creditInfo.isLoggedIn && !appliedStoreCredit)) {
    return null;
  }

  if (creditInfo.availableBalance <= 0 && (!appliedStoreCredit || appliedStoreCredit.appliedAmount <= 0)) {
    return null;
  }

  const isApplied = Boolean(appliedStoreCredit && appliedStoreCredit.appliedAmount > 0);
  const isBusy = isLoading;

  const handleApplyMax = async () => {
    if (!onApplyStoreCredit) return;
    setLocalError(null);
    try {
      await onApplyStoreCredit();
      setIsCustomMode(false);
      setCustomAmount("");
      await fetchCreditInfo();
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : "Failed to apply store credit");
    }
  };

  const handleApplyCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onApplyStoreCredit) return;
    const parsedMinor = Math.round(parseFloat(customAmount) * 100);
    if (isNaN(parsedMinor) || parsedMinor <= 0) {
      setLocalError("Please enter a valid amount");
      return;
    }
    setLocalError(null);
    try {
      await onApplyStoreCredit(parsedMinor);
      setIsCustomMode(false);
      setCustomAmount("");
      await fetchCreditInfo();
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : "Failed to apply store credit");
    }
  };

  const handleRemove = async () => {
    if (!onRemoveStoreCredit) return;
    setLocalError(null);
    try {
      await onRemoveStoreCredit();
      await fetchCreditInfo();
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : "Failed to remove store credit");
    }
  };

  return (
    <div
      className="store-credit-selector-container pt-2"
      data-testid="store-credit-selector"
    >
      <div className="p-3.5 rounded-none border border-emerald-500/20 bg-emerald-500/5 transition-all">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-none bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Coins size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-foreground tracking-tight">
                  Store Credit
                </span>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Sparkles size={10} />
                  Available: {formatStorePrice(creditInfo.availableBalance, currency)}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {isApplied
                  ? `Applied to checkout: ${formatStorePrice(appliedStoreCredit!.appliedAmount, currency)}`
                  : "Apply towards your order total"}
              </p>
            </div>
          </div>

          <div>
            {isApplied ? (
              <button
                type="button"
                onClick={handleRemove}
                disabled={isBusy}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-none text-xs font-semibold text-destructive bg-destructive/10 hover:bg-destructive/15 transition-colors cursor-pointer"
                data-testid="remove-store-credit-btn"
                title="Remove applied store credit"
              >
                {isBusy ? <Spinner size="sm" /> : <X size={12} />}
                <span>Remove</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleApplyMax}
                  disabled={isBusy || payableAmount <= 0}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-none text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="apply-store-credit-btn"
                >
                  {isBusy ? <Spinner size="sm" /> : <Check size={12} />}
                  <span>Apply All</span>
                </button>
                {!isCustomMode && (
                  <button
                    type="button"
                    onClick={() => setIsCustomMode(true)}
                    disabled={isBusy || payableAmount <= 0}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors cursor-pointer"
                  >
                    Custom
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {isCustomMode && !isApplied && (
          <form
            onSubmit={handleApplyCustom}
            className="mt-3 pt-3 border-t border-emerald-500/15 flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={(creditInfo.availableBalance / 100).toFixed(2)}
                placeholder="Amount to apply"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-none border border-[color:var(--at-hairline)] bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={isBusy || !customAmount}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-none transition-colors cursor-pointer disabled:opacity-50"
            >
              {isBusy ? <Spinner size="sm" /> : "Apply"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCustomMode(false);
                setCustomAmount("");
              }}
              className="p-1.5 text-xs text-muted-foreground hover:text-foreground rounded-none cursor-pointer"
              title="Cancel"
            >
              <X size={14} />
            </button>
          </form>
        )}

        {localError && (
          <p className="mt-2 text-[11px] font-medium text-destructive">
            {localError}
          </p>
        )}
      </div>
    </div>
  );
}
