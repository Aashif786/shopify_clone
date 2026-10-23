"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@shopify-clone/ui";
import { apiClient, ApiClientError } from "../../../lib/api-client";
import type { MerchantDiscountDTO } from "../../../lib/merchant-discount-helpers";

export interface DiscountActionsProps {
  discount: MerchantDiscountDTO;
  storeId: string;
  onUpdated?: (updated: MerchantDiscountDTO) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
}

export function DiscountActions({
  discount,
  storeId,
  onUpdated,
  onError,
  disabled = false,
}: DiscountActionsProps) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [confirmingAction, setConfirmingAction] = useState<"deactivate" | null>(null);

  const handleActivate = async () => {
    if (isLoading || disabled) return;
    setIsLoading(true);

    try {
      const res = await apiClient.post<MerchantDiscountDTO>(
        `/api/v1/stores/${storeId}/discounts/${discount.id}/activate`,
        {},
        { storeId }
      );
      if (onUpdated) {
        onUpdated(res);
      }
    } catch (err: unknown) {
      if (onError) {
        onError(
          err instanceof Error
            ? err
            : new ApiClientError({
                code: "MUTATION_FAILED",
                message: "Failed to activate discount",
                status: 500,
              })
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (isLoading || disabled) return;
    setIsLoading(true);
    setConfirmingAction(null);

    try {
      const res = await apiClient.post<MerchantDiscountDTO>(
        `/api/v1/stores/${storeId}/discounts/${discount.id}/deactivate`,
        {},
        { storeId }
      );
      if (onUpdated) {
        onUpdated(res);
      }
    } catch (err: unknown) {
      if (onError) {
        onError(
          err instanceof Error
            ? err
            : new ApiClientError({
                code: "MUTATION_FAILED",
                message: "Failed to deactivate discount",
                status: 500,
              })
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="discount-actions-group"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2, 8px)",
      }}
    >
      <Link
        href={`/merchant/discounts/${discount.id}`}
        className={`btn btn--outline btn--sm${isLoading || disabled ? " btn--disabled" : ""}`}
        aria-disabled={isLoading || disabled ? true : undefined}
        tabIndex={isLoading || disabled ? -1 : undefined}
        onClick={(e) => {
          if (isLoading || disabled) {
            e.preventDefault();
          }
        }}
        data-testid={`edit-discount-${discount.id}`}
      >
        Edit
      </Link>

      {discount.status === "ACTIVE" && (
        <>
          {confirmingAction === "deactivate" ? (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-1, 4px)",
              }}
            >
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeactivate}
                disabled={isLoading || disabled}
                data-testid={`confirm-deactivate-${discount.id}`}
              >
                Confirm
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingAction(null)}
                disabled={isLoading || disabled}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmingAction("deactivate")}
              disabled={isLoading || disabled}
              data-testid={`deactivate-discount-${discount.id}`}
            >
              Deactivate
            </Button>
          )}
        </>
      )}

      {(discount.status === "DISABLED" || discount.status === "DRAFT") && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleActivate}
          disabled={isLoading || disabled}
          data-testid={`activate-discount-${discount.id}`}
        >
          Activate
        </Button>
      )}
    </div>
  );
}
