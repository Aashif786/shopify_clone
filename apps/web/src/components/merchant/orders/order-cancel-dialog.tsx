"use client";

import React, { useState } from "react";
import type { OrderDTO } from "@calcart/orders";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Textarea,
} from "@calcart/ui";
import { ApiClientError, apiClient } from "../../../lib/api-client";
import { validateOrderCancellationInput } from "../../../lib/merchant-order-helpers";

export interface OrderCancelDialogProps {
  storeId: string;
  order: OrderDTO | null;
  isOpen: boolean;
  userRole?: string;
  onClose: () => void;
  onSuccess: (updatedOrder: OrderDTO) => void;
}

export function OrderCancelDialog({
  storeId,
  order,
  isOpen,
  userRole,
  onClose,
  onSuccess,
}: OrderCancelDialogProps) {
  const [reason, setReason] = useState<string>("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen || !order) return null;

  const isStaff = userRole === "staff";

  const handleClose = () => {
    if (isSubmitting) return;
    setReason("");
    setReasonError(null);
    setSubmitError(null);
    onClose();
  };

  const handleReasonChange = (value: string) => {
    setReason(value);
    if (reasonError) {
      setReasonError(validateOrderCancellationInput(value));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !order) return;

    if (isStaff) {
      setSubmitError("Operation requires at least admin or owner role in this store.");
      return;
    }

    const validationMsg = validateOrderCancellationInput(reason);
    if (validationMsg) {
      setReasonError(validationMsg);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setReasonError(null);

    try {
      const updatedOrder = await apiClient.post<OrderDTO>(
        `/api/v1/stores/${encodeURIComponent(storeId)}/orders/${encodeURIComponent(order.id)}/cancel`,
        { reason: reason.trim() },
      );

      handleClose();
      onSuccess(updatedOrder);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 403) {
          setSubmitError(
            "Access Denied: Cancelling an order requires at least admin or owner permissions.",
          );
        } else if (err.status === 400 && err.message.includes("IMMUTABLE")) {
          setSubmitError(
            "This order is in a terminal state and cannot be cancelled again.",
          );
        } else if (err.status === 400 && err.message.includes("CANCELLATION_ERROR")) {
          setSubmitError(
            "Order cannot be cancelled in its current state (cancellation is only permitted for PENDING, CONFIRMED, or PROCESSING).",
          );
        } else {
          setSubmitError(err.message || "Failed to cancel order.");
        }
      } else {
        setSubmitError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while cancelling the order.",
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
      title={`Cancel Order #${order.orderNumber}`}
      size="md"
      footer={
        <div className="flex gap-2.5 justify-end w-full pt-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            type="button"
          >
            Keep Order
          </Button>
          <Button
            variant="danger"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting || isStaff}
            type="button"
          >
            Confirm Cancellation
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Consequence Warning Notice */}
        <Alert variant="warning" title="Irreversible Order Action">
          <p className="mb-2 text-xs">
            Cancelling order <strong>#{order.orderNumber}</strong> will immediately:
          </p>
          <ul className="m-0 pl-4 space-y-1 text-xs list-disc">
            <li>Release all reserved product inventory back to available stock.</li>
            <li>Mark the order and fulfillment status permanently as <strong>CANCELLED</strong>.</li>
            <li>Coordinate with payment refund services if transactions were captured.</li>
          </ul>
        </Alert>

        {/* Role restriction banner */}
        {isStaff && (
          <Alert variant="danger" title="Permission Required">
            You are signed in with a Staff role. Order cancellations require Store Owner or Administrator privileges.
          </Alert>
        )}

        {/* Error Banner */}
        {submitError && (
          <Alert variant="danger" title="Cancellation Failed">
            {submitError}
          </Alert>
        )}

        {/* Reason Field */}
        <FormField
          label="Cancellation Reason"
          htmlFor="order-cancel-reason"
          required
          error={reasonError}
          helperText="State the rationale for cancelling (e.g. Customer requested cancellation, Fraud check failed, Item out of stock)."
        >
          <Textarea
            id="order-cancel-reason"
            name="reason"
            rows={3}
            value={reason}
            onChange={(e) => handleReasonChange(e.target.value)}
            disabled={isSubmitting || isStaff}
            placeholder="e.g. Customer requested cancellation via support ticket #1024"
            error={Boolean(reasonError)}
          />
        </FormField>
      </form>
    </Dialog>
  );
}
