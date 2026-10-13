"use client";

import React, { useState } from "react";
import type { CustomerDTO } from "@shopify-clone/customers";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormField,
  Input,
} from "@shopify-clone/ui";
import { ApiClientError, apiClient } from "../../../lib/api-client";
import {
  validateCustomerFormData,
  type CustomerFormData,
} from "../../../lib/merchant-customer-helpers";

export interface CustomerProfileFormProps {
  storeId: string;
  customer: CustomerDTO;
  userRole?: string;
  onSuccess: (updatedCustomer: CustomerDTO) => void;
}

export function CustomerProfileForm({
  storeId,
  customer,
  userRole,
  onSuccess,
}: CustomerProfileFormProps) {
  const [formData, setFormData] = useState<CustomerFormData>({
    email: customer.email,
    firstName: customer.firstName || "",
    lastName: customer.lastName || "",
    phone: customer.phone || "",
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const isStaff = userRole === "staff";

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
      setSubmitError("Editing customer profile requires Store Owner or Administrator privileges.");
      return;
    }

    const errors = validateCustomerFormData(formData);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);
    setFieldErrors({});

    try {
      const payload = {
        email: formData.email.trim(),
        firstName: formData.firstName.trim() || null,
        lastName: formData.lastName.trim() || null,
        phone: formData.phone.trim() || null,
      };

      const updated = await apiClient.patch<CustomerDTO>(
        `/api/v1/stores/${encodeURIComponent(storeId)}/customers/${encodeURIComponent(customer.id)}`,
        payload,
      );

      setSuccessMessage("Customer profile updated successfully.");
      onSuccess(updated);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 409 || err.code === "CUSTOMER_ALREADY_EXISTS") {
          setSubmitError(
            "Another customer in this store already uses this email address.",
          );
        } else if (err.status === 403) {
          setSubmitError(
            "Access Denied: Updating customer profile requires at least admin or owner permissions.",
          );
        } else {
          setSubmitError(err.message || "Failed to update customer profile.");
        }
      } else {
        setSubmitError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while updating profile.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {successMessage && (
              <Alert variant="success" title="Changes Saved">
                {successMessage}
              </Alert>
            )}

            {isStaff && (
              <Alert variant="info" title="Read Only Access">
                You are viewing this profile with Staff permissions. Editing customer details requires Admin or Owner role.
              </Alert>
            )}

            {submitError && (
              <Alert variant="danger" title="Save Failed">
                {submitError}
              </Alert>
            )}

            {/* Email Field */}
            <FormField
              label="Email Address"
              htmlFor="edit-cust-email"
              required
              error={fieldErrors.email}
              helperText="The customer's primary email address."
            >
              <Input
                id="edit-cust-email"
                name="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                disabled={isSubmitting || isStaff}
                error={Boolean(fieldErrors.email)}
              />
            </FormField>

            {/* Name Fields */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-3)",
              }}
            >
              <FormField
                label="First Name"
                htmlFor="edit-cust-first-name"
                error={fieldErrors.firstName}
              >
                <Input
                  id="edit-cust-first-name"
                  name="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  disabled={isSubmitting || isStaff}
                  error={Boolean(fieldErrors.firstName)}
                />
              </FormField>

              <FormField
                label="Last Name"
                htmlFor="edit-cust-last-name"
                error={fieldErrors.lastName}
              >
                <Input
                  id="edit-cust-last-name"
                  name="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  disabled={isSubmitting || isStaff}
                  error={Boolean(fieldErrors.lastName)}
                />
              </FormField>
            </div>

            {/* Phone Field */}
            <FormField
              label="Phone Number"
              htmlFor="edit-cust-phone"
              error={fieldErrors.phone}
            >
              <Input
                id="edit-cust-phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                disabled={isSubmitting || isStaff}
                placeholder="e.g. +1 555-0199"
                error={Boolean(fieldErrors.phone)}
              />
            </FormField>

            {!isStaff && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-2)" }}>
                <Button
                  type="submit"
                  variant="primary"
                  loading={isSubmitting}
                  disabled={isSubmitting}
                >
                  Save Profile Changes
                </Button>
              </div>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
