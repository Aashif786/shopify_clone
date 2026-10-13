"use client";

import React, { useState } from "react";
import type { CustomerDTO } from "@shopify-clone/customers";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Input,
} from "@shopify-clone/ui";
import { ApiClientError, apiClient } from "../../../lib/api-client";
import {
  INITIAL_CUSTOMER_FORM_DATA,
  validateCustomerFormData,
  type CustomerFormData,
} from "../../../lib/merchant-customer-helpers";

export interface CustomerCreateDialogProps {
  storeId: string;
  isOpen: boolean;
  userRole?: string;
  onClose: () => void;
  onSuccess: (newCustomer: CustomerDTO) => void;
}

export function CustomerCreateDialog({
  storeId,
  isOpen,
  userRole,
  onClose,
  onSuccess,
}: CustomerCreateDialogProps) {
  const [formData, setFormData] = useState<CustomerFormData>(
    INITIAL_CUSTOMER_FORM_DATA,
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const isStaff = userRole === "staff";

  const handleClose = () => {
    if (isSubmitting) return;
    setFormData(INITIAL_CUSTOMER_FORM_DATA);
    setFieldErrors({});
    setSubmitError(null);
    onClose();
  };

  const handleInputChange = (field: keyof CustomerFormData, value: string) => {
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
      setSubmitError("Creating customers requires Store Owner or Administrator privileges.");
      return;
    }

    const errors = validateCustomerFormData(formData);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setFieldErrors({});

    try {
      const payload = {
        email: formData.email.trim(),
        firstName: formData.firstName.trim() || null,
        lastName: formData.lastName.trim() || null,
        phone: formData.phone.trim() || null,
      };

      const newCustomer = await apiClient.post<CustomerDTO>(
        `/api/v1/stores/${encodeURIComponent(storeId)}/customers`,
        payload,
      );

      handleClose();
      onSuccess(newCustomer);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 409 || err.code === "CUSTOMER_ALREADY_EXISTS") {
          setSubmitError(
            "A customer with this email address already exists in this store.",
          );
        } else if (err.status === 403) {
          setSubmitError(
            "Access Denied: Creating customers requires at least admin or owner role.",
          );
        } else {
          setSubmitError(err.message || "Failed to create customer.");
        }
      } else {
        setSubmitError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while creating customer.",
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
      title="Add New Customer"
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
            Create Customer
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {isStaff && (
            <Alert variant="danger" title="Permission Required">
              You are signed in with a Staff role. Adding customers requires Store Owner or Administrator privileges.
            </Alert>
          )}

          {submitError && (
            <Alert variant="danger" title="Customer Creation Failed">
              {submitError}
            </Alert>
          )}

          {/* Email */}
          <FormField
            label="Email Address"
            htmlFor="cust-email"
            required
            error={fieldErrors.email}
            helperText="The customer's email address (unique within this store)."
          >
            <Input
              id="cust-email"
              name="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              disabled={isSubmitting || isStaff}
              placeholder="e.g. alex@example.com"
              error={Boolean(fieldErrors.email)}
            />
          </FormField>

          {/* First Name & Last Name */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--space-3)",
            }}
          >
            <FormField
              label="First Name"
              htmlFor="cust-first-name"
              error={fieldErrors.firstName}
            >
              <Input
                id="cust-first-name"
                name="firstName"
                value={formData.firstName}
                onChange={(e) => handleInputChange("firstName", e.target.value)}
                disabled={isSubmitting || isStaff}
                placeholder="e.g. Alex"
                error={Boolean(fieldErrors.firstName)}
              />
            </FormField>

            <FormField
              label="Last Name"
              htmlFor="cust-last-name"
              error={fieldErrors.lastName}
            >
              <Input
                id="cust-last-name"
                name="lastName"
                value={formData.lastName}
                onChange={(e) => handleInputChange("lastName", e.target.value)}
                disabled={isSubmitting || isStaff}
                placeholder="e.g. Mercer"
                error={Boolean(fieldErrors.lastName)}
              />
            </FormField>
          </div>

          {/* Phone */}
          <FormField
            label="Phone Number"
            htmlFor="cust-phone"
            error={fieldErrors.phone}
            helperText="Optional customer contact phone number."
          >
            <Input
              id="cust-phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => handleInputChange("phone", e.target.value)}
              disabled={isSubmitting || isStaff}
              placeholder="e.g. +1 555-0199"
              error={Boolean(fieldErrors.phone)}
            />
          </FormField>
        </div>
      </form>
    </Dialog>
  );
}
