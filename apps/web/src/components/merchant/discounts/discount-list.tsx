"use client";

import React from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
  EmptyState,
  Alert,
  Spinner,
} from "@shopify-clone/ui";
import {
  formatDiscountSpend,
  formatDiscountUsage,
  formatDiscountValidity,
  formatDiscountValue,
  type MerchantDiscountDTO,
} from "../../../lib/merchant-discount-helpers";
import { DiscountStatusBadge } from "./discount-status-badge";
import { DiscountActions } from "./discount-actions";

export interface DiscountListProps {
  discounts: MerchantDiscountDTO[];
  storeId: string;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onCreateDiscount?: () => void;
  onDiscountUpdated?: (updated: MerchantDiscountDTO) => void;
}

export function DiscountList({
  discounts,
  storeId,
  isLoading = false,
  error = null,
  onRetry,
  onCreateDiscount,
  onDiscountUpdated,
}: DiscountListProps) {
  // Error state
  if (error) {
    return (
      <div className="discount-list-error" role="region" aria-label="Discount list error">
        <Alert
          variant="danger"
          title="Failed to load discounts"
          action={
            onRetry ? (
              <Button variant="outline" size="sm" onClick={onRetry} data-testid="retry-discounts-btn">
                Retry
              </Button>
            ) : undefined
          }
        >
          {error.message || "An unexpected error occurred while fetching discounts."}
        </Alert>
      </div>
    );
  }

  // Initial loading state
  if (isLoading && discounts.length === 0) {
    return (
      <div
        className="discount-list-loading"
        role="status"
        aria-label="Loading discounts"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--space-12, 48px) var(--space-4, 16px)",
          gap: "var(--space-3, 12px)",
        }}
      >
        <Spinner size="lg" label="Loading discounts..." />
        <span style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm, 14px)" }}>
          Loading discounts...
        </span>
      </div>
    );
  }

  // Empty state
  if (!isLoading && discounts.length === 0) {
    return (
      <div data-testid="discounts-empty-state">
        <EmptyState
          title="No discounts found"
          description="Create promotional coupons to offer percentage or fixed discounts to your customers."
          action={
            onCreateDiscount ? (
              <Button variant="primary" onClick={onCreateDiscount} data-testid="empty-create-discount-btn">
                Create Discount
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="discount-table-wrapper" style={{ overflowX: "auto" }}>
      <Table aria-label="Discounts Table" data-testid="discount-table">
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Discount</TableHead>
            <TableHead>Minimum Spend</TableHead>
            <TableHead>Redemptions</TableHead>
            <TableHead>Validity</TableHead>
            <TableHead>Status</TableHead>
            <TableHead style={{ textAlign: "right" }}>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {discounts.map((discount) => (
            <TableRow key={discount.id} data-testid={`discount-row-${discount.id}`}>
              <TableCell>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span
                    className="font-mono font-bold"
                    style={{
                      fontFamily: "var(--font-mono, monospace)",
                      fontWeight: 600,
                      color: "var(--color-text-primary)",
                    }}
                    data-testid={`discount-code-${discount.id}`}
                  >
                    {discount.code}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--text-xs, 12px)",
                      color: "var(--color-text-secondary)",
                      textTransform: "capitalize",
                    }}
                  >
                    {discount.type.toLowerCase().replace("_", " ")}
                  </span>
                </div>
              </TableCell>

              <TableCell>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontWeight: 500 }}>{discount.name}</span>
                  {discount.description && (
                    <span
                      style={{
                        fontSize: "var(--text-xs, 12px)",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      {discount.description}
                    </span>
                  )}
                </div>
              </TableCell>

              <TableCell>
                <span style={{ fontWeight: 500 }} data-testid={`discount-value-${discount.id}`}>
                  {formatDiscountValue(discount.type, discount.value, discount.currency)}
                </span>
                {discount.maxDiscountAmount && discount.type === "PERCENTAGE" && (
                  <div
                    style={{
                      fontSize: "var(--text-xs, 12px)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    (Cap: ${(discount.maxDiscountAmount / 100).toFixed(2)})
                  </div>
                )}
              </TableCell>

              <TableCell>
                <span style={{ color: "var(--color-text-secondary)" }}>
                  {formatDiscountSpend(discount.minimumSubtotal, discount.currency)}
                </span>
              </TableCell>

              <TableCell>
                <span
                  style={{
                    fontSize: "var(--text-sm, 14px)",
                    color: "var(--color-text-secondary)",
                  }}
                  data-testid={`discount-usage-${discount.id}`}
                >
                  {formatDiscountUsage(discount.usageCount, discount.usageLimit)}
                </span>
              </TableCell>

              <TableCell>
                <span
                  style={{
                    fontSize: "var(--text-sm, 14px)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {formatDiscountValidity(discount.startsAt, discount.endsAt)}
                </span>
              </TableCell>

              <TableCell>
                <DiscountStatusBadge status={discount.status} />
              </TableCell>

              <TableCell style={{ textAlign: "right" }}>
                <DiscountActions
                  discount={discount}
                  storeId={storeId}
                  onUpdated={onDiscountUpdated}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
