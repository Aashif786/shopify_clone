"use client";

import React, { useState } from "react";
import type { OrderDTO } from "@shopify-clone/orders";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Input,
  Textarea,
} from "@shopify-clone/ui";
import { ApiClientError, apiClient } from "../../../lib/api-client";
import { getOrderRecipientName } from "../../../lib/merchant-order-helpers";

export interface OrderFulfillDialogProps {
  storeId: string;
  order: OrderDTO | null;
  isOpen: boolean;
  userRole?: string;
  onClose: () => void;
  onSuccess: (updatedOrder: OrderDTO) => void;
}

export function OrderFulfillDialog({
  storeId,
  order,
  isOpen,
  onClose,
  onSuccess,
}: OrderFulfillDialogProps) {
  const [carrier, setCarrier] = useState<string>("");
  const [trackingNumber, setTrackingNumber] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen || !order) return null;

  const handleClose = () => {
    if (isSubmitting) return;
    setCarrier("");
    setTrackingNumber("");
    setNotes("");
    setSubmitError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !order) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const updatedOrder = await apiClient.post<OrderDTO>(
        `/api/v1/stores/${encodeURIComponent(storeId)}/orders/${encodeURIComponent(order.id)}/fulfill`,
        {
          fulfillmentStatus: "FULFILLED",
          trackingCompany: carrier.trim() || undefined,
          trackingNumber: trackingNumber.trim() || undefined,
          reason: notes.trim() || undefined,
        },
      );

      handleClose();
      onSuccess(updatedOrder);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 403) {
          setSubmitError(
            "Access Denied: Fulfilling an order requires at least staff permissions.",
          );
        } else if (err.status === 400 && err.message.includes("cancelled")) {
          setSubmitError("Cannot fulfill an order that has been cancelled.");
        } else {
          setSubmitError(err.message || "Failed to update order fulfillment.");
        }
      } else {
        setSubmitError(
          err instanceof Error
            ? err.message
            : "An unexpected network error occurred.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const recipientName = getOrderRecipientName(order);
  const itemCount = order.items?.reduce((acc, i) => acc + i.quantity, 0) ?? 0;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title={`Fulfill Order #${order.orderNumber}`}
      description="Mark purchased items as fulfilled and record shipment tracking details"
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
            variant="primary"
            onClick={handleSubmit}
            loading={isSubmitting}
            type="submit"
          >
            Confirm Fulfillment
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {submitError && (
          <Alert variant="danger" title="Fulfillment Failed">
            {submitError}
          </Alert>
        )}

        {/* Order Summary Box */}
        <div
          style={{
            backgroundColor: "var(--color-bg-secondary, var(--color-bg-surface-sunken))",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-3)",
            fontSize: "var(--font-size-sm)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-1)",
          }}
        >
          <div style={{ fontWeight: "var(--font-weight-semibold)", color: "var(--color-text-primary)" }}>
            Recipient: {recipientName}
          </div>
          <div style={{ color: "var(--color-text-secondary)" }}>
            Items to ship: {itemCount} {itemCount === 1 ? "unit" : "units"} ({order.items?.length ?? 0} line items)
          </div>
          <div style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
            Status will transition to Shipped and record in the order audit log.
          </div>
        </div>

        {/* Carrier / Shipping Partner */}
        <FormField
          label="Shipping Carrier / Partner"
          helperText="e.g. FedEx, BlueDart, Delhivery, DHL, UPS"
          htmlFor="carrier-input"
        >
          <Input
            id="carrier-input"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            placeholder="e.g. BlueDart"
            disabled={isSubmitting}
          />
        </FormField>

        {/* Tracking Number */}
        <FormField
          label="Tracking Number / Waybill ID"
          helperText="Shipment tracking code provided to the customer"
          htmlFor="tracking-input"
        >
          <Input
            id="tracking-input"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="e.g. TRK-9821479102"
            disabled={isSubmitting}
          />
        </FormField>

        {/* Notes */}
        <FormField
          label="Fulfillment Notes (Optional)"
          helperText="Internal notes or dispatch details"
          htmlFor="notes-input"
        >
          <Textarea
            id="notes-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Dispatched from primary warehouse via express air cargo"
            rows={2}
            disabled={isSubmitting}
          />
        </FormField>
      </form>
    </Dialog>
  );
}
