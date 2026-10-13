"use client";

import React, { useState } from "react";
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
  INITIAL_ADD_MEMBER_DATA,
  STORE_ROLES_INFO,
  validateAddMemberFormData,
  type AddMemberFormData,
  type StoreMemberItem,
} from "../../../lib/merchant-store-helpers";

export interface AddMemberDialogProps {
  storeId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newMember: StoreMemberItem) => void;
}

export function AddMemberDialog({
  storeId,
  isOpen,
  onClose,
  onSuccess,
}: AddMemberDialogProps) {
  const [formData, setFormData] = useState<AddMemberFormData>(INITIAL_ADD_MEMBER_DATA);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setFormData(INITIAL_ADD_MEMBER_DATA);
    setFieldErrors({});
    setApiError(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleInputChange = (field: keyof AddMemberFormData, value: string) => {
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

    setApiError(null);
    const errors = validateAddMemberFormData(formData);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const created = await apiClient.post<StoreMemberItem>(
        `/api/v1/stores/${storeId}/members`,
        {
          userId: formData.userId.trim(),
          role: formData.role,
        },
      );

      resetForm();
      onSuccess(created);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.fields) {
          setFieldErrors(err.fields);
        }
        setApiError(err.message || "Failed to add store member.");
      } else {
        setApiError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while adding the team member.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedRoleInfo = STORE_ROLES_INFO.find((r) => r.value === formData.role);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Store Team Member"
      description="Grant store membership and assign an operational role to an existing user account."
      size="md"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)" }}>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            Add Member
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {apiError && (
            <Alert variant="danger" title="Error Adding Member">
              {apiError}
            </Alert>
          )}

          <FormField
            label="User Identifier (User ID)"
            htmlFor="member-user-id"
            required
            error={fieldErrors.userId}
            helperText="The unique ID of the existing merchant account in PostgreSQL."
          >
            <Input
              id="member-user-id"
              name="userId"
              value={formData.userId}
              onChange={(e) => handleInputChange("userId", e.target.value)}
              disabled={isSubmitting}
              error={Boolean(fieldErrors.userId)}
              placeholder="e.g. 01923456-7890-7abc-def0-123456789abc"
              autoFocus
            />
          </FormField>

          <FormField
            label="Store Role"
            htmlFor="member-role"
            required
            error={fieldErrors.role}
            helperText="Assign permissions and operational access for this store."
          >
            <Select
              id="member-role"
              name="role"
              value={formData.role}
              onChange={(e) =>
                handleInputChange(
                  "role",
                  e.target.value as "owner" | "admin" | "staff",
                )
              }
              disabled={isSubmitting}
              error={Boolean(fieldErrors.role)}
            >
              {STORE_ROLES_INFO.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label} — {r.description}
                </option>
              ))}
            </Select>
          </FormField>

          {selectedRoleInfo && (
            <div
              style={{
                padding: "var(--space-3)",
                backgroundColor: "var(--color-bg)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                fontSize: "var(--font-size-xs)",
                color: "var(--color-text-secondary)",
              }}
            >
              <strong style={{ color: "var(--color-text-primary)" }}>
                {selectedRoleInfo.label} Permissions:
              </strong>{" "}
              {selectedRoleInfo.description}
            </div>
          )}

          <div
            style={{
              fontSize: "11px",
              color: "var(--color-text-muted)",
              lineHeight: 1.4,
              backgroundColor: "var(--color-bg)",
              padding: "var(--space-2) var(--space-3)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            ℹ Direct assignment: The specified user will immediately receive access to this store.
            No invitation email workflow is required.
          </div>
        </div>
      </form>
    </Dialog>
  );
}
