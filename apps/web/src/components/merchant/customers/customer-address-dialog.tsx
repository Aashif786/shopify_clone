"use client";

import React, { useEffect, useState } from "react";
import type { CustomerAddressDTO } from "@calcart/customers";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Input,
} from "@calcart/ui";
import { ApiClientError, apiClient } from "../../../lib/api-client";
import {
  INITIAL_ADDRESS_FORM_DATA,
  validateCustomerAddressFormData,
  type CustomerAddressFormData,
} from "../../../lib/merchant-customer-helpers";

export interface CustomerAddressDialogProps {
  storeId: string;
  customerId: string;
  addressToEdit: CustomerAddressDTO | null;
  isOpen: boolean;
  userRole?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function CustomerAddressDialog({
  storeId,
  customerId,
  addressToEdit,
  isOpen,
  userRole,
  onClose,
  onSuccess,
}: CustomerAddressDialogProps) {
  const [formData, setFormData] = useState<CustomerAddressFormData>(() => {
    if (addressToEdit) {
      return {
        firstName: addressToEdit.firstName || "",
        lastName: addressToEdit.lastName || "",
        company: addressToEdit.company || "",
        addressLine1: addressToEdit.addressLine1 || "",
        addressLine2: addressToEdit.addressLine2 || "",
        city: addressToEdit.city || "",
        state: addressToEdit.state || "",
        postalCode: addressToEdit.postalCode || "",
        country: addressToEdit.country || "US",
        phone: addressToEdit.phone || "",
        label: addressToEdit.label || "",
        isDefault: addressToEdit.isDefault || false,
      };
    }
    return INITIAL_ADDRESS_FORM_DATA;
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const isEditing = Boolean(addressToEdit);
  const isStaff = userRole === "staff";

  useEffect(() => {
    if (addressToEdit) {
      setFormData({
        firstName: addressToEdit.firstName || "",
        lastName: addressToEdit.lastName || "",
        company: addressToEdit.company || "",
        addressLine1: addressToEdit.addressLine1 || "",
        addressLine2: addressToEdit.addressLine2 || "",
        city: addressToEdit.city || "",
        state: addressToEdit.state || "",
        postalCode: addressToEdit.postalCode || "",
        country: addressToEdit.country || "US",
        phone: addressToEdit.phone || "",
        label: addressToEdit.label || "",
        isDefault: addressToEdit.isDefault || false,
      });
    } else {
      setFormData(INITIAL_ADDRESS_FORM_DATA);
    }
    setFieldErrors({});
    setSubmitError(null);
  }, [addressToEdit, isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleInputChange = (
    field: keyof CustomerAddressFormData,
    value: string | boolean,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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

    if (isStaff) {
      setSubmitError("Managing addresses requires Store Owner or Administrator privileges.");
      return;
    }

    const errors = validateCustomerAddressFormData(formData);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setFieldErrors({});

    try {
      const payload = {
        addressLine1: formData.addressLine1.trim(),
        addressLine2: formData.addressLine2.trim() || null,
        city: formData.city.trim(),
        state: formData.state.trim() || null,
        postalCode: formData.postalCode.trim(),
        country: formData.country.trim().toUpperCase(),
        firstName: formData.firstName.trim() || null,
        lastName: formData.lastName.trim() || null,
        company: formData.company.trim() || null,
        phone: formData.phone.trim() || null,
        label: formData.label.trim() || null,
        isDefault: formData.isDefault,
      };

      if (isEditing && addressToEdit) {
        await apiClient.patch(
          `/api/v1/stores/${encodeURIComponent(storeId)}/customers/${encodeURIComponent(customerId)}/addresses/${encodeURIComponent(addressToEdit.id)}`,
          payload,
        );
      } else {
        await apiClient.post(
          `/api/v1/stores/${encodeURIComponent(storeId)}/customers/${encodeURIComponent(customerId)}/addresses`,
          payload,
        );
      }

      handleClose();
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 403) {
          setSubmitError(
            "Access Denied: Address management requires at least admin or owner permissions.",
          );
        } else {
          setSubmitError(err.message || "Failed to save address.");
        }
      } else {
        setSubmitError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while saving address.",
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
      title={isEditing ? "Edit Customer Address" : "Add Customer Address"}
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
            disabled={isSubmitting || isStaff}
            type="button"
          >
            {isEditing ? "Save Address" : "Create Address"}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {isStaff && (
            <Alert variant="danger" title="Permission Required">
              You are signed in with a Staff role. Managing addresses requires Store Owner or Administrator privileges.
            </Alert>
          )}

          {submitError && (
            <Alert variant="danger" title="Address Operation Failed">
              {submitError}
            </Alert>
          )}

          {/* Label / Company */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <FormField label="Address Label (e.g. Home, Office)" htmlFor="addr-label" error={fieldErrors.label}>
              <Input
                id="addr-label"
                value={formData.label}
                onChange={(e) => handleInputChange("label", e.target.value)}
                disabled={isSubmitting || isStaff}
                placeholder="Home"
              />
            </FormField>

            <FormField label="Company (Optional)" htmlFor="addr-company" error={fieldErrors.company}>
              <Input
                id="addr-company"
                value={formData.company}
                onChange={(e) => handleInputChange("company", e.target.value)}
                disabled={isSubmitting || isStaff}
                placeholder="Acme Corp"
              />
            </FormField>
          </div>

          {/* Names */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <FormField label="Recipient First Name" htmlFor="addr-first-name" error={fieldErrors.firstName}>
              <Input
                id="addr-first-name"
                value={formData.firstName}
                onChange={(e) => handleInputChange("firstName", e.target.value)}
                disabled={isSubmitting || isStaff}
              />
            </FormField>

            <FormField label="Recipient Last Name" htmlFor="addr-last-name" error={fieldErrors.lastName}>
              <Input
                id="addr-last-name"
                value={formData.lastName}
                onChange={(e) => handleInputChange("lastName", e.target.value)}
                disabled={isSubmitting || isStaff}
              />
            </FormField>
          </div>

          {/* Address Line 1 */}
          <FormField label="Address Line 1" htmlFor="addr-line1" required error={fieldErrors.addressLine1}>
            <Input
              id="addr-line1"
              value={formData.addressLine1}
              onChange={(e) => handleInputChange("addressLine1", e.target.value)}
              disabled={isSubmitting || isStaff}
              placeholder="123 Market St"
              error={Boolean(fieldErrors.addressLine1)}
            />
          </FormField>

          {/* Address Line 2 */}
          <FormField label="Address Line 2 (Apt, Suite, etc.)" htmlFor="addr-line2" error={fieldErrors.addressLine2}>
            <Input
              id="addr-line2"
              value={formData.addressLine2}
              onChange={(e) => handleInputChange("addressLine2", e.target.value)}
              disabled={isSubmitting || isStaff}
              placeholder="Suite 400"
            />
          </FormField>

          {/* City, State, Postal Code */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "var(--space-3)" }}>
            <FormField label="City" htmlFor="addr-city" required error={fieldErrors.city}>
              <Input
                id="addr-city"
                value={formData.city}
                onChange={(e) => handleInputChange("city", e.target.value)}
                disabled={isSubmitting || isStaff}
                placeholder="San Francisco"
                error={Boolean(fieldErrors.city)}
              />
            </FormField>

            <FormField label="State" htmlFor="addr-state" error={fieldErrors.state}>
              <Input
                id="addr-state"
                value={formData.state}
                onChange={(e) => handleInputChange("state", e.target.value)}
                disabled={isSubmitting || isStaff}
                placeholder="CA"
              />
            </FormField>

            <FormField label="Postal Code" htmlFor="addr-zip" required error={fieldErrors.postalCode}>
              <Input
                id="addr-zip"
                value={formData.postalCode}
                onChange={(e) => handleInputChange("postalCode", e.target.value)}
                disabled={isSubmitting || isStaff}
                placeholder="94105"
                error={Boolean(fieldErrors.postalCode)}
              />
            </FormField>
          </div>

          {/* Country & Phone */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <FormField label="Country (2-letter code)" htmlFor="addr-country" required error={fieldErrors.country}>
              <Input
                id="addr-country"
                value={formData.country}
                onChange={(e) => handleInputChange("country", e.target.value)}
                disabled={isSubmitting || isStaff}
                placeholder="US"
                error={Boolean(fieldErrors.country)}
              />
            </FormField>

            <FormField label="Contact Phone" htmlFor="addr-phone" error={fieldErrors.phone}>
              <Input
                id="addr-phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                disabled={isSubmitting || isStaff}
                placeholder="+1 555-0199"
              />
            </FormField>
          </div>

          {/* Set as default checkbox */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
            <input
              type="checkbox"
              id="addr-default"
              checked={formData.isDefault}
              onChange={(e) => handleInputChange("isDefault", e.target.checked)}
              disabled={isSubmitting || isStaff}
            />
            <label htmlFor="addr-default" style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-primary)", cursor: "pointer" }}>
              Set as default shipping address
            </label>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
