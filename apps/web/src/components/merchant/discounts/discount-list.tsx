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
        className="discount-list-loading flex flex-col items-center justify-center py-20 gap-3"
        role="status"
        aria-label="Loading discounts"
      >
        <Spinner size="lg" label="Loading discounts..." />
        <span className="text-xs text-muted-foreground font-medium">
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
    <div className="discount-table-wrapper rounded-lg border border-border bg-card overflow-x-auto">
      <Table aria-label="Discounts Table" data-testid="discount-table">
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b border-border bg-muted/30">
            <TableHead className="font-semibold text-xs text-muted-foreground py-3 px-4">Code</TableHead>
            <TableHead className="font-semibold text-xs text-muted-foreground py-3 px-4">Name</TableHead>
            <TableHead className="font-semibold text-xs text-muted-foreground py-3 px-4">Discount</TableHead>
            <TableHead className="font-semibold text-xs text-muted-foreground py-3 px-4">Minimum Spend</TableHead>
            <TableHead className="font-semibold text-xs text-muted-foreground py-3 px-4">Redemptions</TableHead>
            <TableHead className="font-semibold text-xs text-muted-foreground py-3 px-4">Validity</TableHead>
            <TableHead className="font-semibold text-xs text-muted-foreground py-3 px-4">Status</TableHead>
            <TableHead className="font-semibold text-xs text-muted-foreground py-3 px-4 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-border">
          {discounts.map((discount) => (
            <TableRow key={discount.id} data-testid={`discount-row-${discount.id}`} className="hover:bg-muted/40 transition-colors">
              <TableCell className="py-3 px-4">
                <div className="flex flex-col">
                  <span
                    className="font-mono font-semibold text-sm text-foreground"
                    data-testid={`discount-code-${discount.id}`}
                  >
                    {discount.code}
                  </span>
                  <span className="text-[11px] text-muted-foreground capitalize">
                    {discount.type.toLowerCase().replace("_", " ")}
                  </span>
                </div>
              </TableCell>

              <TableCell className="py-3 px-4">
                <div className="flex flex-col">
                  <span className="font-medium text-sm text-foreground">{discount.name}</span>
                  {discount.description && (
                    <span className="text-xs text-muted-foreground">
                      {discount.description}
                    </span>
                  )}
                </div>
              </TableCell>

              <TableCell className="py-3 px-4">
                <span className="font-semibold text-sm text-foreground" data-testid={`discount-value-${discount.id}`}>
                  {formatDiscountValue(discount.type, discount.value, discount.currency)}
                </span>
                {discount.maxDiscountAmount && discount.type === "PERCENTAGE" && (
                  <div className="text-[11px] text-muted-foreground">
                    (Cap: ${(discount.maxDiscountAmount / 100).toFixed(2)})
                  </div>
                )}
              </TableCell>

              <TableCell className="py-3 px-4">
                <span className="text-xs text-muted-foreground">
                  {formatDiscountSpend(discount.minimumSubtotal, discount.currency)}
                </span>
              </TableCell>

              <TableCell className="py-3 px-4">
                <span
                  className="text-xs font-mono text-muted-foreground"
                  data-testid={`discount-usage-${discount.id}`}
                >
                  {formatDiscountUsage(discount.usageCount, discount.usageLimit)}
                </span>
              </TableCell>

              <TableCell className="py-3 px-4">
                <span className="text-xs text-muted-foreground">
                  {formatDiscountValidity(discount.startsAt, discount.endsAt)}
                </span>
              </TableCell>

              <TableCell className="py-3 px-4">
                <DiscountStatusBadge status={discount.status} />
              </TableCell>

              <TableCell className="py-3 px-4 text-right">
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
