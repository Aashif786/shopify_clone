"use client";

import React, { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Input,
  Select,
} from "@calcart/ui";
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
  onInvitationSent?: () => void;
}

export function AddMemberDialog({
  storeId,
  isOpen,
  onClose,
  onSuccess,
  onInvitationSent,
}: AddMemberDialogProps) {
  const [mode, setMode] = useState<"invite" | "direct">("direct");

  // Direct mode
  const [formData, setFormData] = useState<AddMemberFormData>(INITIAL_ADD_MEMBER_DATA);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Invite mode
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "staff">("staff");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setFormData(INITIAL_ADD_MEMBER_DATA);
    setFieldErrors({});
    setInviteEmail("");
    setInviteRole("staff");
    setGeneratedLink(null);
    setCopied(false);
    setApiError(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleDirectSubmit = async (e: React.FormEvent) => {
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

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !inviteEmail.trim()) return;

    setApiError(null);
    setIsSubmitting(true);

    try {
      const res = await apiClient.post<{ invitationUrl?: string }>(
        `/api/v1/stores/${storeId}/invitations`,
        {
          email: inviteEmail.trim(),
          role: inviteRole,
        }
      );

      if (res.invitationUrl) {
        const fullUrl = `${window.location.origin}${res.invitationUrl}`;
        setGeneratedLink(fullUrl);
      } else {
        setGeneratedLink("EMAIL_SENT");
      }

      if (onInvitationSent) {
        onInvitationSent();
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setApiError(err.message || "Failed to send staff invitation.");
      } else {
        setApiError("An unexpected error occurred while creating invitation.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const selectedRoleInfo = STORE_ROLES_INFO.find(
    (r) => r.value === (mode === "invite" ? inviteRole : formData.role)
  );

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Store Team Member"
      description="Add authorized administrators or staff to collaborate on this merchant store."
      size="md"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)" }}>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            {generatedLink ? "Done" : "Cancel"}
          </Button>
          {!generatedLink && (
            <Button
              type="button"
              variant="primary"
              onClick={mode === "invite" ? handleInviteSubmit : handleDirectSubmit}
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              {mode === "invite" ? "Create Invitation Link" : "Add Member"}
            </Button>
          )}
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {/* Mode Selector */}
        {!generatedLink && (
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--color-border)",
              marginBottom: "var(--space-2)",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMode("invite");
                setApiError(null);
              }}
              style={{
                flex: 1,
                padding: "var(--space-2) var(--space-3)",
                background: "none",
                border: "none",
                borderBottom: mode === "invite" ? "2px solid var(--color-primary)" : "none",
                fontWeight: mode === "invite" ? 600 : 400,
                color: mode === "invite" ? "var(--color-primary)" : "var(--color-text-secondary)",
                cursor: "pointer",
                fontSize: "var(--font-size-sm)",
              }}
            >
              Invite by Email
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("direct");
                setApiError(null);
              }}
              style={{
                flex: 1,
                padding: "var(--space-2) var(--space-3)",
                background: "none",
                border: "none",
                borderBottom: mode === "direct" ? "2px solid var(--color-primary)" : "none",
                fontWeight: mode === "direct" ? 600 : 400,
                color: mode === "direct" ? "var(--color-primary)" : "var(--color-text-secondary)",
                cursor: "pointer",
                fontSize: "var(--font-size-sm)",
              }}
            >
              Direct User ID
            </button>
          </div>
        )}

        {apiError && (
          <Alert variant="danger" title="Error">
            {apiError}
          </Alert>
        )}

        {/* INVITE BY EMAIL MODE */}
        {mode === "invite" ? (
          generatedLink ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <Alert variant="success" title="Invitation Dispatched">
                Invitation issued for <strong>{inviteEmail}</strong>. An email has been sent with instructions to join this store.
              </Alert>

              {generatedLink !== "EMAIL_SENT" && (
                <div
                  style={{
                    display: "flex",
                    gap: "var(--space-2)",
                    alignItems: "center",
                    backgroundColor: "var(--color-bg)",
                    padding: "var(--space-2)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <input
                    type="text"
                    readOnly
                    value={generatedLink}
                    style={{
                      flex: 1,
                      background: "none",
                      border: "none",
                      fontSize: "var(--font-size-xs)",
                      color: "var(--color-text-primary)",
                      outline: "none",
                    }}
                  />
                  <Button size="sm" variant={copied ? "primary" : "outline"} onClick={handleCopyLink}>
                    {copied ? "Copied!" : "Copy Link"}
                  </Button>
                </div>
              )}

              <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", margin: 0 }}>
                This invitation link expires in 7 days and can only be accepted once.
              </p>
            </div>
          ) : (
            <form onSubmit={handleInviteSubmit} noValidate>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <FormField
                  label="Staff Email Address"
                  htmlFor="invite-email"
                  required
                  helperText="Recipient will receive access to this store via an acceptance link."
                >
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    autoFocus
                    required
                  />
                </FormField>

                <FormField
                  label="Store Role"
                  htmlFor="invite-role"
                  required
                  helperText="Assign staff access or store administrator privileges."
                >
                  <Select
                    id="invite-role"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "admin" | "staff")}
                  >
                    <option value="staff">Staff — Day-to-day operations (orders, products, inventory)</option>
                    <option value="admin">Admin — Full management including team and settings</option>
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
              </div>
            </form>
          )
        ) : (
          /* DIRECT ASSIGNMENT MODE */
          <form onSubmit={handleDirectSubmit} noValidate>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
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
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, userId: e.target.value }))
                  }
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
                    setFormData((prev) => ({
                      ...prev,
                      role: e.target.value as "owner" | "admin" | "staff",
                    }))
                  }
                  disabled={isSubmitting}
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
        )}
      </div>
    </Dialog>
  );
}
