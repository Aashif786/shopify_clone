"use client";

import React, { useState } from "react";
import type { CustomerDTO } from "@shopify-clone/customers";
import { Alert, Button, Dialog } from "@shopify-clone/ui";
import { ApiClientError, apiClient } from "../../../lib/api-client";
import { formatCustomerName } from "../../../lib/merchant-customer-helpers";

export interface CustomerStatusDialogProps {
  storeId: string;
  customer: CustomerDTO | null;
  isOpen: boolean;
  action: "enable" | "disable";
  userRole?: string;
  onClose: () => void;
  onSuccess: (updatedCustomer: CustomerDTO) => void;
}

export function CustomerStatusDialog({
  storeId,
  customer,
  isOpen,
  action,
  userRole,
  onClose,
  onSuccess,
}: CustomerStatusDialogProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen || !customer) return null;

  const isStaff = userRole === "staff";
  const isEnabling = action === "enable";
  const customerName = formatCustomerName(customer);

  const handleClose = () => {
    if (isSubmitting) return;
    setSubmitError(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (isSubmitting || !customer) return;

    if (isStaff) {
      setSubmitError("Operation requires Store Owner or Administrator privileges.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const endpoint = `/api/v1/stores/${encodeURIComponent(storeId)}/customers/${encodeURIComponent(customer.id)}/${action}`;
      const updatedCustomer = await apiClient.post<CustomerDTO>(endpoint, {});

      handleClose();
      onSuccess(updatedCustomer);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 403) {
          setSubmitError(
            "Access Denied: Changing customer status requires at least admin or owner permissions.",
          );
        } else {
          setSubmitError(err.message || `Failed to ${action} customer.`);
        }
      } else {
        setSubmitError(
          err instanceof Error
            ? err.message
            : `An unexpected error occurred while attempting to ${action} customer.`,
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
      title={`${isEnabling ? "Enable" : "Disable"} Customer Account`}
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
            variant={isEnabling ? "primary" : "danger"}
            onClick={handleConfirm}
            loading={isSubmitting}
            disabled={isSubmitting || isStaff}
            type="button"
          >
            {isEnabling ? "Enable Customer" : "Disable Customer"}
          </Button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {isStaff && (
          <Alert variant="danger" title="Permission Required">
            You are signed in with a Staff role. Modifying customer account status requires Store Owner or Administrator privileges.
          </Alert>
        )}

        {submitError && (
          <Alert variant="danger" title="Action Failed">
            {submitError}
          </Alert>
        )}

        {isEnabling ? (
          <Alert variant="info" title="Reactivate Customer Account">
            <p style={{ margin: 0, fontSize: "var(--font-size-sm)" }}>
              Enabling <strong>{customerName}</strong> ({customer.email}) will restore their status to <strong>ACTIVE</strong>, allowing them to be associated with new store checkouts and addresses.
            </p>
          </Alert>
        ) : (
          <Alert variant="warning" title="Deactivate Customer Account">
            <p style={{ margin: "0 0 var(--space-2) 0", fontSize: "var(--font-size-sm)" }}>
              Are you sure you want to disable <strong>{customerName}</strong> ({customer.email})?
            </p>
            <p style={{ margin: 0, fontSize: "var(--font-size-sm)" }}>
              The account status will be set to <strong>DISABLED</strong>. Existing orders and addresses remain preserved in the store database for merchant records.
            </p>
          </Alert>
        )}
      </div>
    </Dialog>
  );
}
