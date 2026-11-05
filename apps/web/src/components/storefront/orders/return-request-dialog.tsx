"use client";

import React, { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Input,
  Textarea,
} from "@calcart/ui";
import { Undo2 } from "lucide-react";
import { ApiClientError, apiClient } from "../../../lib/api-client";

export interface ReturnEligibleItem {
  orderItemId: string;
  productNameSnapshot: string;
  variantNameSnapshot: string | null;
  skuSnapshot: string | null;
  purchasedQuantity: number;
  returnableQuantity: number;
  unitRefundAmount: number;
}

export interface ReturnRequestDialogProps {
  storeSlug: string;
  orderId: string;
  orderNumber: string;
  currency: string;
  guestToken?: string | null;
  eligibleItems: ReturnEligibleItem[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const RETURN_REASONS = [
  "Item arrived damaged",
  "Wrong item received",
  "Item does not match description",
  "Size or fit issue",
  "No longer needed",
  "Other",
] as const;

export function ReturnRequestDialog({
  storeSlug,
  orderId,
  orderNumber,
  currency,
  guestToken,
  eligibleItems,
  isOpen,
  onClose,
  onSuccess,
}: ReturnRequestDialogProps) {
  const returnable = useMemo(
    () => eligibleItems.filter((item) => item.returnableQuantity > 0),
    [eligibleItems],
  );

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<string>(RETURN_REASONS[0]);
  const [otherReason, setOtherReason] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const formatPrice = (minorUnits: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
    }).format(minorUnits / 100);

  const selectedItems = useMemo(
    () =>
      returnable
        .map((item) => ({
          item,
          quantity: quantities[item.orderItemId] ?? 0,
        }))
        .filter((entry) => entry.quantity > 0),
    [returnable, quantities],
  );

  // Mirrors the server-side calculation so the customer sees the same figure
  // the backend will compute; the server remains authoritative.
  const estimatedRefund = selectedItems.reduce(
    (sum, entry) => sum + entry.item.unitRefundAmount * entry.quantity,
    0,
  );

  const effectiveReason =
    reason === "Other" ? otherReason.trim() : reason.trim();

  const canSubmit =
    selectedItems.length > 0 &&
    effectiveReason.length > 0 &&
    !isSubmitting;

  const handleClose = () => {
    if (isSubmitting) return;
    setQuantities({});
    setReason(RETURN_REASONS[0]);
    setOtherReason("");
    setNote("");
    setSubmitError(null);
    onClose();
  };

  const setQuantity = (item: ReturnEligibleItem, raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    const next = Number.isNaN(parsed) ? 0 : parsed;
    const clamped = Math.max(0, Math.min(next, item.returnableQuantity));
    setQuantities((prev) => ({ ...prev, [item.orderItemId]: clamped }));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const headers: Record<string, string> = {};
      if (guestToken) {
        headers["x-guest-token"] = guestToken;
      }

      await apiClient.post(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/orders/${encodeURIComponent(orderId)}/returns`,
        {
          reason: effectiveReason,
          customerNote: note.trim() || undefined,
          items: selectedItems.map((entry) => ({
            orderItemId: entry.item.orderItemId,
            quantity: entry.quantity,
          })),
        },
        { headers, params: guestToken ? { guestToken } : undefined },
      );

      handleClose();
      onSuccess();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not submit your return request. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title={`Request a return for order #${orderNumber}`}
      description="Choose the items you'd like to send back and tell us why. We'll review your request and email you with the outcome."
      size="lg"
      footer={
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
          <div className="text-xs font-mono text-muted-foreground">
            {selectedItems.length > 0 ? (
              <span data-testid="return-estimated-refund">
                Estimated refund:{" "}
                <span className="font-semibold text-foreground">
                  {formatPrice(estimatedRefund)}
                </span>
              </span>
            ) : (
              <span>Select at least one item</span>
            )}
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!canSubmit}
              loading={isSubmitting}
              data-testid="submit-return-request"
            >
              Submit request
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {submitError && (
          <Alert variant="danger" title="Unable to submit request">
            {submitError}
          </Alert>
        )}

        {returnable.length === 0 ? (
          <Alert variant="info" title="Nothing left to return">
            Every item on this order has already been included in a return
            request.
          </Alert>
        ) : (
          <>
            {/* Item selection */}
            <div className="space-y-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-muted-foreground block">
                Items to return
              </span>
              <ul className="space-y-2" data-testid="return-item-list">
                {returnable.map((item) => {
                  const quantity = quantities[item.orderItemId] ?? 0;
                  return (
                    <li
                      key={item.orderItemId}
                      className="flex items-center justify-between gap-4 p-3 rounded-2xl border border-border/60 bg-muted/10"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <span className="text-sm font-semibold text-foreground block truncate">
                          {item.productNameSnapshot}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground block truncate">
                          {item.variantNameSnapshot
                            ? `${item.variantNameSnapshot} · `
                            : ""}
                          {formatPrice(item.unitRefundAmount)} each ·{" "}
                          {item.returnableQuantity} of {item.purchasedQuantity}{" "}
                          returnable
                        </span>
                      </div>
                      <label className="shrink-0 flex items-center gap-2">
                        <span className="sr-only">
                          Quantity to return for {item.productNameSnapshot}
                        </span>
                        <Input
                          type="number"
                          min={0}
                          max={item.returnableQuantity}
                          step={1}
                          value={String(quantity)}
                          onChange={(e) => setQuantity(item, e.target.value)}
                          disabled={isSubmitting}
                          className="w-20 text-center"
                          aria-label={`Quantity to return for ${item.productNameSnapshot}`}
                        />
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Reason */}
            <FormField
              label="Reason for return"
              htmlFor="return-reason-select"
              helperText="This helps the store process your request faster"
            >
              <select
                id="return-reason-select"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isSubmitting}
                className="input w-full rounded-xl"
              >
                {RETURN_REASONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </FormField>

            {reason === "Other" && (
              <FormField
                label="Tell us more"
                htmlFor="return-other-reason"
                helperText="Required when choosing Other"
              >
                <Input
                  id="return-other-reason"
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  placeholder="Describe the issue"
                  maxLength={500}
                  disabled={isSubmitting}
                />
              </FormField>
            )}

            <FormField
              label="Additional notes (Optional)"
              htmlFor="return-note"
              helperText="Anything else the store should know"
            >
              <Textarea
                id="return-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="e.g. the box was crushed on arrival"
                disabled={isSubmitting}
              />
            </FormField>

            <p className="flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed">
              <Undo2 size={13} className="mt-0.5 shrink-0" />
              <span>
                Submitting a request doesn&apos;t charge or refund anything yet.
                The store reviews it first, and your refund is issued once the
                returned items are received.
              </span>
            </p>
          </>
        )}
      </div>
    </Dialog>
  );
}
