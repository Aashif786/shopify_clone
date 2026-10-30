"use client";

import React, { useState } from "react";
import {
  Button,
  Input,
  Textarea,
  Select,
  FormField,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Alert,
} from "@calcart/ui";
import { apiClient, ApiClientError } from "../../../lib/api-client";
import {
  discountToFormData,
  formDataToPayload,
  normalizeDiscountCode,
  validateDiscountFormData,
  type DiscountFormData,
  type MerchantDiscountDTO,
} from "../../../lib/merchant-discount-helpers";

export interface DiscountFormProps {
  storeId: string;
  initialDiscount?: MerchantDiscountDTO;
  onSuccess?: (discount: MerchantDiscountDTO) => void;
  onCancel?: () => void;
}

export function DiscountForm({
  storeId,
  initialDiscount,
  onSuccess,
  onCancel,
}: DiscountFormProps) {
  const isEditing = Boolean(initialDiscount);

  const [formData, setFormData] = useState<DiscountFormData>(() => {
    if (initialDiscount) {
      return discountToFormData(initialDiscount);
    }
    return {
      code: "",
      name: "",
      description: "",
      type: "PERCENTAGE",
      value: "",
      currency: "USD",
      status: "ACTIVE",
      minimumSubtotal: "",
      maxDiscountAmount: "",
      usageLimit: "",
      appliesToFirstTimeCustomer: false,
      eligibleProductIds: [],
      eligibleCollectionIds: [],
      eligibleCategoryIds: [],
      eligibleProductTypeIds: [],
      eligibleTagIds: [],
      startsAt: "",
      endsAt: "",
    };
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleChange = (field: keyof DiscountFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: field === "code" ? normalizeDiscountCode(value) : value,
    }));

    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (generalError) {
      setGeneralError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // 1. Client-side validation
    const errors = validateDiscountFormData(formData);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setGeneralError("Please resolve the highlighted errors before submitting.");
      return;
    }

    setFieldErrors({});
    setGeneralError(null);
    setIsSubmitting(true);

    try {
      const payload = formDataToPayload(formData);

      let savedDiscount: MerchantDiscountDTO;
      if (isEditing && initialDiscount) {
        // Edit mode: PATCH endpoint
        savedDiscount = await apiClient.patch<MerchantDiscountDTO>(
          `/api/v1/stores/${storeId}/discounts/${initialDiscount.id}`,
          {
            name: payload.name,
            description: payload.description,
            status: payload.status,
            minimumSubtotal: payload.minimumSubtotal,
            maxDiscountAmount: payload.maxDiscountAmount,
            usageLimit: payload.usageLimit,
            startsAt: payload.startsAt,
            endsAt: payload.endsAt,
          },
          { storeId }
        );
      } else {
        // Create mode: POST endpoint
        savedDiscount = await apiClient.post<MerchantDiscountDTO>(
          `/api/v1/stores/${storeId}/discounts`,
          payload,
          { storeId }
        );
      }

      if (onSuccess) {
        onSuccess(savedDiscount);
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.fields) {
          setFieldErrors(err.fields);
        }
        setGeneralError(err.message || "Failed to save discount.");
      } else if (err instanceof Error) {
        setGeneralError(err.message);
      } else {
        setGeneralError("An unexpected error occurred while saving discount.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate data-testid="discount-form">
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? "Edit Discount" : "Create Discount"}</CardTitle>
          <CardDescription>
            {isEditing
              ? "Update discount promotion rules and availability."
              : "Configure promotional rules, eligible spend, and usage limits."}
          </CardDescription>
        </CardHeader>

        <CardContent style={{ display: "flex", flexDirection: "column", gap: "var(--space-4, 16px)" }}>
          {generalError && (
            <Alert variant="danger" title="Validation Error">
              {generalError}
            </Alert>
          )}

          {/* Code and Name */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "var(--space-4, 16px)",
            }}
          >
            <FormField
              label="Discount Code"
              required
              error={fieldErrors.code}
              helperText="Customers enter this code at checkout (letters, numbers, hyphens)."
            >
              <Input
                name="code"
                value={formData.code}
                onChange={(e) => handleChange("code", e.target.value)}
                placeholder="e.g. SUMMER25"
                disabled={isEditing || isSubmitting}
                data-testid="discount-code-input"
                style={{ textTransform: "uppercase", fontFamily: "var(--font-mono, monospace)" }}
              />
            </FormField>

            <FormField label="Discount Name" required error={fieldErrors.name} helperText="Internal marketing name.">
              <Input
                name="name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="e.g. Summer VIP 25% Off"
                disabled={isSubmitting}
                data-testid="discount-name-input"
              />
            </FormField>
          </div>

          {/* Description */}
          <FormField label="Description (Optional)" error={fieldErrors.description}>
            <Textarea
              name="description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Internal campaign details or promotional notes..."
              disabled={isSubmitting}
              data-testid="discount-description-input"
              rows={2}
            />
          </FormField>

          {/* Type and Value */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "var(--space-4, 16px)",
            }}
          >
            <FormField label="Discount Type" required error={fieldErrors.type}>
              <Select
                name="type"
                value={formData.type}
                onChange={(e) => handleChange("type", e.target.value)}
                disabled={isEditing || isSubmitting}
                data-testid="discount-type-select"
                options={[
                  { value: "PERCENTAGE", label: "Percentage (%)" },
                  { value: "FIXED_AMOUNT", label: "Fixed Amount ($)" },
                ]}
              />
            </FormField>

            <FormField
              label={formData.type === "PERCENTAGE" ? "Percentage Value (%)" : "Discount Amount ($)"}
              required
              error={fieldErrors.value}
              helperText={formData.type === "PERCENTAGE" ? "Integer from 1 to 100" : "Amount in dollars (e.g. 20.00)"}
            >
              <Input
                name="value"
                type="number"
                step={formData.type === "PERCENTAGE" ? "1" : "0.01"}
                value={formData.value}
                onChange={(e) => handleChange("value", e.target.value)}
                placeholder={formData.type === "PERCENTAGE" ? "25" : "20.00"}
                disabled={isEditing || isSubmitting}
                data-testid="discount-value-input"
              />
            </FormField>

            {formData.type === "FIXED_AMOUNT" && (
              <FormField label="Currency" required error={fieldErrors.currency}>
                <Input
                  name="currency"
                  value={formData.currency}
                  onChange={(e) => handleChange("currency", e.target.value)}
                  placeholder="USD"
                  disabled={isEditing || isSubmitting}
                  data-testid="discount-currency-input"
                  maxLength={3}
                  style={{ textTransform: "uppercase" }}
                />
              </FormField>
            )}
          </div>

          {/* Spend Limits and Caps */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "var(--space-4, 16px)",
            }}
          >
            <FormField
              label="Minimum Order Subtotal ($)"
              error={fieldErrors.minimumSubtotal}
              helperText="Minimum spend required (leave blank for none)."
            >
              <Input
                name="minimumSubtotal"
                type="number"
                step="0.01"
                value={formData.minimumSubtotal}
                onChange={(e) => handleChange("minimumSubtotal", e.target.value)}
                placeholder="e.g. 50.00"
                disabled={isSubmitting}
                data-testid="discount-min-spend-input"
              />
            </FormField>

            {formData.type === "PERCENTAGE" && (
              <FormField
                label="Maximum Discount Cap ($)"
                error={fieldErrors.maxDiscountAmount}
                helperText="Max deduction cap for percentage discounts."
              >
                <Input
                  name="maxDiscountAmount"
                  type="number"
                  step="0.01"
                  value={formData.maxDiscountAmount}
                  onChange={(e) => handleChange("maxDiscountAmount", e.target.value)}
                  placeholder="e.g. 25.00"
                  disabled={isSubmitting}
                  data-testid="discount-max-cap-input"
                />
              </FormField>
            )}

            <FormField
              label="Usage Limit"
              error={fieldErrors.usageLimit}
              helperText="Max total redemptions permitted."
            >
              <Input
                name="usageLimit"
                type="number"
                step="1"
                value={formData.usageLimit}
                onChange={(e) => handleChange("usageLimit", e.target.value)}
                placeholder="e.g. 100"
                disabled={isSubmitting}
                data-testid="discount-usage-limit-input"
              />
            </FormField>
          </div>

          {/* Dates & Status */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "var(--space-4, 16px)",
            }}
          >
            <FormField label="Start Date" error={fieldErrors.startsAt}>
              <Input
                name="startsAt"
                type="date"
                value={formData.startsAt}
                onChange={(e) => handleChange("startsAt", e.target.value)}
                disabled={isSubmitting}
                data-testid="discount-starts-at-input"
              />
            </FormField>

            <FormField label="End Date" error={fieldErrors.endsAt}>
              <Input
                name="endsAt"
                type="date"
                value={formData.endsAt}
                onChange={(e) => handleChange("endsAt", e.target.value)}
                disabled={isSubmitting}
                data-testid="discount-ends-at-input"
              />
            </FormField>

            <FormField label="Status" error={fieldErrors.status}>
              <Select
                name="status"
                value={formData.status}
                onChange={(e) => handleChange("status", e.target.value)}
                disabled={isSubmitting}
                data-testid="discount-status-select"
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "DRAFT", label: "Draft" },
                  { value: "DISABLED", label: "Disabled" },
                ]}
              />
            </FormField>
          </div>
          {/* Eligibility Rules */}
          <div className="p-4 rounded-xl border border-border/70 bg-muted/20 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <span>Customer & Product Eligibility</span>
            </h3>

            {/* First-time customer only toggle */}
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.appliesToFirstTimeCustomer}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    appliesToFirstTimeCustomer: e.target.checked,
                  }))
                }
                className="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4"
                disabled={isSubmitting}
                data-testid="first-time-customer-checkbox"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-foreground block">
                  First-Time Customers Only
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  Limit discount redemption to customers with no previous completed orders in this store.
                </span>
              </div>
            </label>
          </div>
        </CardContent>

        <CardFooter
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "var(--space-3, 12px)",
          }}
        >
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            data-testid="save-discount-btn"
          >
            {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Create Discount"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
