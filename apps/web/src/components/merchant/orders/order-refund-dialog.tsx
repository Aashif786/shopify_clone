"use client";

import React, { useState } from "react";
import type { OrderDTO } from "@shopify-clone/orders";
import type { OrderRefundSummaryDTO } from "@shopify-clone/payments";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Textarea,
} from "@shopify-clone/ui";
import { ApiClientError, apiClient } from "../../../lib/api-client";
import { formatOrderPrice } from "../../../lib/merchant-order-helpers";

export interface OrderRefundDialogProps {
  storeId: string;
  order: OrderDTO | null;
  refundSummary?: OrderRefundSummaryDTO | null;
  isOpen: boolean;
  userRole?: string;
  onClose: () => void;
  onSuccess: (updatedOrder: OrderDTO, message: string) => void;
}

export function OrderRefundDialog({
  storeId,
  order,
  refundSummary,
  isOpen,
  userRole,
  onClose,
  onSuccess,
}: OrderRefundDialogProps) {
  const [reason, setReason] = useState<string>("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen || !order) return null;

  const isStaff = userRole === "staff";
  const currency = order.currency || "USD";

  // Authoritative calculations from summary or order
  const orderTotal = refundSummary?.capturedAmount ?? order.grandTotal ?? order.total ?? 0;
  const previouslyRefunded = refundSummary?.refundedAmount ?? 0;
  const remainingRefundable = refundSummary
    ? refundSummary.remainingRefundable
    : Math.max(0, orderTotal - previouslyRefunded);

  const handleClose = () => {
    if (isSubmitting) return;
    setReason("");
    setReasonError(null);
    setSubmitError(null);
    onClose();
  };

  const validateReason = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) {
      return "Refund reason is required and must not be empty.";
    }
    if (trimmed.length < 3) {
      return "Refund reason must be at least 3 characters.";
    }
    if (trimmed.length > 500) {
      return "Refund reason cannot exceed 500 characters.";
    }
    return null;
  };

  const handleReasonChange = (value: string) => {
    setReason(value);
    if (reasonError) {
      setReasonError(validateReason(value));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !order) return;

    if (isStaff) {
      setSubmitError("Access Denied: Refund operations require at least admin or owner permissions in this store.");
      return;
    }

    if (order.status === "CANCELLED") {
      setSubmitError("Cannot initiate a merchant refund on an already cancelled order.");
      return;
    }

    if (remainingRefundable <= 0) {
      setSubmitError("This order has no remaining refundable balance.");
      return;
    }

    const validationMsg = validateReason(reason);
    if (validationMsg) {
      setReasonError(validationMsg);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setReasonError(null);

    try {
      // POST to order refund endpoint with full remaining refundable amount
      const res = await apiClient.post<{
        status?: string;
        error?: string;
      }>(
        `/api/v1/stores/${encodeURIComponent(storeId)}/orders/${encodeURIComponent(order.id)}/refund`,
        {
          reason: reason.trim(),
          amount: remainingRefundable,
        },
      );

      if (res?.status === "FAILED") {
        setSubmitError(res.error || "The refund was rejected by the payment gateway.");
        return;
      }

      if (res?.status === "REQUIRES_RECONCILIATION") {
        const updatedOrder = await apiClient.get<OrderDTO>(
          `/api/v1/stores/${encodeURIComponent(storeId)}/orders/${encodeURIComponent(order.id)}`,
        );
        handleClose();
        onSuccess(
          updatedOrder,
          `Refund of ${formatOrderPrice(remainingRefundable, currency)} was submitted and requires reconciliation with the payment gateway.`,
        );
        return;
      }

      // Fetch fresh order details post-mutation
      const updatedOrder = await apiClient.get<OrderDTO>(
        `/api/v1/stores/${encodeURIComponent(storeId)}/orders/${encodeURIComponent(order.id)}`,
      );

      handleClose();
      onSuccess(
        updatedOrder,
        `Full refund of ${formatOrderPrice(remainingRefundable, currency)} was successfully processed for Order #${order.orderNumber}.`,
      );
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 403) {
          setSubmitError(
            "Access Denied: Initiating a refund requires at least admin or owner permissions in this store.",
          );
        } else if (err.status === 400 && err.message.includes("not eligible")) {
          setSubmitError(
            "This payment is not eligible for refunds. It may not be captured or already fully refunded.",
          );
        } else if (err.status === 400 && err.message.includes("exceeds remaining")) {
          setSubmitError(
            "Requested refund exceeds the remaining captured balance.",
          );
        } else {
          setSubmitError(err.message || "Failed to process refund. Please try again.");
        }
      } else {
        setSubmitError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while processing the refund.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title={`Refund Order #${order.orderNumber}`}
      size="md"
      footer={
        <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end", width: "100%" }}>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            type="button"
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting || isStaff || remainingRefundable <= 0}
            type="button"
          >
            Confirm Full Refund ({formatOrderPrice(remainingRefundable, currency)})
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {/* Authoritative Financial Details Box */}
          <div
            style={{
              backgroundColor: "var(--color-bg-secondary, #f8fafc)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-4)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
              fontSize: "var(--font-size-sm)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--color-text-secondary)" }}>Captured Order Total:</span>
              <strong style={{ fontFamily: "var(--font-mono, monospace)" }}>
                {formatOrderPrice(orderTotal, currency)}
              </strong>
            </div>

            {previouslyRefunded > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--color-text-secondary)" }}>
                <span>Previously Refunded:</span>
                <span style={{ fontFamily: "var(--font-mono, monospace)" }}>
                  -{formatOrderPrice(previouslyRefunded, currency)}
                </span>
              </div>
            )}

            <div
              style={{
                borderTop: "1px solid var(--color-border)",
                paddingTop: "var(--space-2)",
                display: "flex",
                justifyContent: "space-between",
                fontSize: "var(--font-size-base)",
              }}
            >
              <strong>Refundable Balance:</strong>
              <strong style={{ color: "var(--color-danger, #dc2626)", fontFamily: "var(--font-mono, monospace)" }}>
                {formatOrderPrice(remainingRefundable, currency)}
              </strong>
            </div>
          </div>

          {/* Refund Confirmation Notice */}
          <Alert variant="warning" title="Payment Reversal Warning">
            <p style={{ margin: "0 0 var(--space-2) 0", fontSize: "var(--font-size-sm)" }}>
              Issuing a full refund will immediately:
            </p>
            <ul style={{ margin: 0, paddingLeft: "var(--space-4)", fontSize: "var(--font-size-sm)" }}>
              <li>
                Reverse <strong>{formatOrderPrice(remainingRefundable, currency)}</strong> to the customer&apos;s original payment method.
              </li>
              <li>
                Update the payment status permanently to <strong>REFUNDED</strong>.
              </li>
              <li>
                Exclude this order from the customer&apos;s authoritative lifetime spend total.
              </li>
            </ul>
          </Alert>

          {/* Staff Warning if staff role */}
          {isStaff && (
            <Alert variant="danger" title="Permission Required">
              Staff members cannot issue refunds. Only Store Owners or Admins have refund privileges.
            </Alert>
          )}

          {/* Reason Input */}
          <FormField
            label="Refund Reason"
            htmlFor="order-refund-reason"
            required
            error={reasonError || undefined}
            helperText="Provide an audited justification for this refund (e.g., Customer return, defective product, merchant goodwill)"
          >
            <Textarea
              id="order-refund-reason"
              name="reason"
              value={reason}
              onChange={(e) => handleReasonChange(e.target.value)}
              placeholder="e.g., Customer requested return due to incorrect item sizing"
              rows={3}
              disabled={isSubmitting || isStaff}
              error={Boolean(reasonError)}
              aria-label="Refund reason"
            />
          </FormField>

          {/* Error Message */}
          {submitError && (
            <Alert variant="danger" title="Refund Failed">
              {submitError}
            </Alert>
          )}
        </div>
      </form>
    </Dialog>
  );
}
