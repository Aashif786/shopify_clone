"use client";

import React, { useState, useEffect } from "react";
import type { InventoryItemDTO, InventoryAdjustmentDTO } from "@shopify-clone/inventory";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Input,
  Select,
} from "@shopify-clone/ui";
import { ApiClientError, apiClient } from "../../../lib/api-client";
import {
  ADJUSTMENT_REASONS_CONFIG,
  calculateSignedDelta,
  INITIAL_ADJUSTMENT_DATA,
  validateStockAdjustmentInput,
  type InventoryVariantItem,
  type StockAdjustmentFormData,
} from "../../../lib/merchant-inventory-helpers";

export interface StockAdjustmentDialogProps {
  storeId: string;
  variantItem: InventoryVariantItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: InventoryVariantItem) => void;
}

export function StockAdjustmentDialog({
  storeId,
  variantItem,
  isOpen,
  onClose,
  onSuccess,
}: StockAdjustmentDialogProps) {
  const [formData, setFormData] = useState<StockAdjustmentFormData>(INITIAL_ADJUSTMENT_DATA);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData(INITIAL_ADJUSTMENT_DATA);
      setFieldErrors({});
      setApiError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, variantItem?.variantId]);

  if (!variantItem) return null;

  const currentAvailable = variantItem.availableQuantity;
  const qtyNumber = parseInt(formData.quantity, 10) || 0;
  const delta = calculateSignedDelta(formData.direction, qtyNumber);
  const resultingAvailable = currentAvailable + delta;

  const handleInputChange = (field: keyof StockAdjustmentFormData, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      // When reason changes, auto-set direction if clear
      if (field === "reason") {
        const found = ADJUSTMENT_REASONS_CONFIG.find((r) => r.value === value);
        if (found) {
          next.direction = found.defaultDirection;
        }
      }
      return next;
    });

    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setApiError(null);
    const errors = validateStockAdjustmentInput(formData, currentAvailable);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const response = await apiClient.post<{
        item: InventoryItemDTO;
        adjustment: InventoryAdjustmentDTO;
      }>(`/api/v1/stores/${storeId}/inventory/${variantItem.variantId}/adjust`, {
        quantityDelta: delta,
        reason: formData.reason,
        referenceType: formData.referenceType.trim() || null,
        referenceId: formData.referenceId.trim() || null,
      });

      const updatedItemDto = response.item;
      const updatedVariant: InventoryVariantItem = {
        ...variantItem,
        availableQuantity: updatedItemDto.availableQuantity,
        reservedQuantity: updatedItemDto.reservedQuantity,
        totalQuantity: updatedItemDto.totalQuantity,
        isInitialized: true,
        inventoryItemId: updatedItemDto.id,
      };

      onSuccess(updatedVariant);
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.fields) {
          setFieldErrors(err.fields);
        }
        setApiError(err.message || "Failed to adjust inventory stock.");
      } else {
        setApiError(
          err instanceof Error ? err.message : "An unexpected error occurred during stock adjustment.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedReasonInfo = ADJUSTMENT_REASONS_CONFIG.find((r) => r.value === formData.reason);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      title="Adjust Inventory Stock"
      description={`Record an authoritative stock adjustment for "${variantItem.productTitle} — ${variantItem.variantTitle}".`}
      size="md"
      footer={
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting || resultingAvailable < 0}
          >
            Confirm Adjustment
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="space-y-4">
          {apiError && (
            <Alert variant="danger" title="Adjustment Failed">
              {apiError}
            </Alert>
          )}

          {/* Current Stock Context Box */}
          <div className="grid grid-cols-3 gap-2 p-3 bg-muted/40 rounded-lg border border-border/50 text-center">
            <div>
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">
                Available
              </div>
              <div className="text-base font-bold text-foreground">
                {variantItem.availableQuantity}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">
                Reserved
              </div>
              <div className="text-base font-bold text-amber-600 dark:text-amber-400">
                {variantItem.reservedQuantity}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">
                Total On-Hand
              </div>
              <div className="text-base font-bold text-foreground">
                {variantItem.totalQuantity}
              </div>
            </div>
          </div>

          {/* Adjustment Direction */}
          <FormField label="Adjustment Type" required>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={formData.direction === "add" ? "primary" : "outline"}
                size="sm"
                onClick={() => setFormData((p) => ({ ...p, direction: "add" }))}
                className="flex-1"
              >
                + Add Stock (Restock / Return)
              </Button>
              <Button
                type="button"
                variant={formData.direction === "remove" ? "primary" : "outline"}
                size="sm"
                onClick={() => setFormData((p) => ({ ...p, direction: "remove" }))}
                className="flex-1"
              >
                − Remove Stock (Damage / Loss)
              </Button>
            </div>
          </FormField>

          {/* Quantity Input */}
          <FormField
            label="Adjustment Quantity"
            htmlFor="adj-quantity"
            required
            error={fieldErrors.quantity}
            helperText={
              resultingAvailable >= 0
                ? `Resulting available stock will be ${resultingAvailable} units (${delta >= 0 ? `+${delta}` : delta} change).`
                : "Cannot reduce available stock below 0 units."
            }
          >
            <Input
              id="adj-quantity"
              name="quantity"
              type="number"
              min={1}
              step={1}
              value={formData.quantity}
              onChange={(e) => handleInputChange("quantity", e.target.value)}
              disabled={isSubmitting}
              error={Boolean(fieldErrors.quantity) || resultingAvailable < 0}
            />
          </FormField>

          {/* Reason Select */}
          <FormField
            label="Adjustment Reason"
            htmlFor="adj-reason"
            required
            error={fieldErrors.reason}
            helperText={selectedReasonInfo?.description}
          >
            <Select
              id="adj-reason"
              name="reason"
              value={formData.reason}
              onChange={(e) => handleInputChange("reason", e.target.value)}
              disabled={isSubmitting}
              error={Boolean(fieldErrors.reason)}
            >
              {ADJUSTMENT_REASONS_CONFIG.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </FormField>

          {/* Reference Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              label="Reference Type (Optional)"
              htmlFor="adj-ref-type"
              error={fieldErrors.referenceType}
            >
              <Input
                id="adj-ref-type"
                name="referenceType"
                value={formData.referenceType}
                onChange={(e) => handleInputChange("referenceType", e.target.value)}
                disabled={isSubmitting}
                placeholder="e.g. purchase_order"
              />
            </FormField>

            <FormField
              label="Reference ID (Optional)"
              htmlFor="adj-ref-id"
              error={fieldErrors.referenceId}
            >
              <Input
                id="adj-ref-id"
                name="referenceId"
                value={formData.referenceId}
                onChange={(e) => handleInputChange("referenceId", e.target.value)}
                disabled={isSubmitting}
                placeholder="e.g. PO-8902"
              />
            </FormField>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
