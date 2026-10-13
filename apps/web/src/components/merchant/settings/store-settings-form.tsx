"use client";

import React, { useState, useEffect } from "react";
import type { StoreDetailDTO } from "@shopify-clone/stores";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  Select,
  Textarea,
} from "@shopify-clone/ui";
import { ApiClientError, apiClient } from "../../../lib/api-client";
import {
  COMMON_CURRENCIES,
  COMMON_LOCALES,
  COMMON_TIMEZONES,
  hasUnsavedSettingsChanges,
  settingsFormDataToUpdatePayload,
  storeDetailToSettingsFormData,
  validateStoreSettings,
  type StoreSettingsFormData,
} from "../../../lib/merchant-store-helpers";

export interface StoreSettingsFormProps {
  store: StoreDetailDTO;
  userRole?: "owner" | "admin" | "staff";
  onSaveSuccess?: (updated: StoreDetailDTO) => void;
}

export function StoreSettingsForm({
  store,
  userRole = "owner",
  onSaveSuccess,
}: StoreSettingsFormProps) {
  const initialData = storeDetailToSettingsFormData(store);
  const [formData, setFormData] = useState<StoreSettingsFormData>(initialData);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sync if initial store changes
  useEffect(() => {
    const updated = storeDetailToSettingsFormData(store);
    setFormData(updated);
    setFieldErrors({});
    setApiError(null);
  }, [store.id, store.updatedAt]);

  const isDraft = store.status === "DRAFT";
  const isArchived = store.status === "ARCHIVED";
  const isReadOnly = userRole === "staff" || isArchived;
  const isDirty = hasUnsavedSettingsChanges(formData, initialData);

  const handleInputChange = (field: keyof StoreSettingsFormData, value: string) => {
    if (isReadOnly) return;
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSuccessMessage(null);

    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleDiscard = () => {
    setFormData(storeDetailToSettingsFormData(store));
    setFieldErrors({});
    setApiError(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || isReadOnly) return;

    setApiError(null);
    setSuccessMessage(null);

    // Client-side validation
    const errors = validateStoreSettings(formData, store.status, initialData);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    const payload = settingsFormDataToUpdatePayload(formData, initialData);
    // If no changes exist, nothing to update
    if (Object.keys(payload).length === 0) {
      setSuccessMessage("No changes detected.");
      return;
    }

    setIsSaving(true);
    try {
      const updatedStore = await apiClient.patch<StoreDetailDTO>(
        `/api/v1/stores/${store.id}`,
        payload,
      );

      setSuccessMessage("Store settings successfully updated.");
      setFieldErrors({});
      onSaveSuccess?.(updatedStore);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.fields) {
          setFieldErrors(err.fields);
        }
        setApiError(err.message || "Failed to update store settings.");
      } else {
        setApiError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while saving.",
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="store-settings-card">
      <CardHeader>
        <CardTitle>General Store Settings</CardTitle>
        <CardDescription>
          Configure the public profile, primary currency, regional defaults, and
          merchant contact details for this store.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit} noValidate>
        <CardContent>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
            {/* Staff Role Notice */}
            {userRole === "staff" && (
              <Alert variant="info" title="Read-Only Access">
                You have Staff membership for this store. Updating store configuration
                requires Admin or Owner permissions.
              </Alert>
            )}

            {/* Archived Store Notice */}
            {isArchived && (
              <Alert variant="warning" title="Store Archived">
                This store is archived. Settings are preserved for historical records
                and can no longer be edited.
              </Alert>
            )}

            {/* Success Message */}
            {successMessage && (
              <Alert variant="success" title="Settings Saved">
                {successMessage}
              </Alert>
            )}

            {/* API Error Message */}
            {apiError && (
              <Alert variant="danger" title="Save Failed">
                {apiError}
              </Alert>
            )}

            {/* Unsaved Changes Banner */}
            {isDirty && !isReadOnly && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "var(--space-3) var(--space-4)",
                  backgroundColor: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span style={{ color: "var(--color-warning, #d97706)" }}>●</span>
                  <span style={{ fontWeight: 500 }}>You have unsaved changes.</span>
                </div>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDiscard}
                    disabled={isSaving}
                  >
                    Discard
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={isSaving}
                    disabled={isSaving}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            )}

            {/* Section 1: Store Identity */}
            <div>
              <h3
                style={{
                  fontSize: "var(--font-size-sm)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--color-text-muted)",
                  margin: "0 0 var(--space-4) 0",
                }}
              >
                Store Identity
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "var(--space-4)",
                }}
              >
                {/* Store Name */}
                <FormField
                  label="Store Name"
                  htmlFor="settings-name"
                  required
                  error={fieldErrors.name}
                  helperText="The public merchant brand name displayed to customers."
                >
                  <Input
                    id="settings-name"
                    name="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    disabled={isReadOnly || isSaving}
                    error={Boolean(fieldErrors.name)}
                    maxLength={100}
                    placeholder="e.g. Acme Outfitters"
                  />
                </FormField>

                {/* Store Slug (Read-only) */}
                <FormField
                  label="Storefront Slug & Handle"
                  htmlFor="settings-slug"
                  helperText="The unique store identifier in URLs. Once created, the slug cannot be modified."
                >
                  <Input
                    id="settings-slug"
                    name="slug"
                    value={store.slug}
                    readOnly
                    disabled
                    style={{
                      fontFamily: "var(--font-mono)",
                      backgroundColor: "var(--color-bg)",
                      cursor: "not-allowed",
                    }}
                  />
                </FormField>
              </div>

              {/* Storefront preview link */}
              <div
                style={{
                  marginTop: "var(--space-2)",
                  fontSize: "var(--font-size-xs)",
                  color: "var(--color-text-muted)",
                }}
              >
                Storefront route:{" "}
                <code style={{ fontSize: "inherit" }}>
                  /storefront/{store.slug}
                </code>
              </div>
            </div>

            <div
              style={{
                height: "1px",
                backgroundColor: "var(--color-border)",
                margin: "var(--space-2) 0",
              }}
            />

            {/* Section 2: Regional & Currency Configuration */}
            <div>
              <h3
                style={{
                  fontSize: "var(--font-size-sm)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--color-text-muted)",
                  margin: "0 0 var(--space-4) 0",
                }}
              >
                Regional & Currency
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "var(--space-4)",
                }}
              >
                {/* Store Currency */}
                <FormField
                  label="Primary Store Currency"
                  htmlFor="settings-currency"
                  required
                  error={fieldErrors.currency}
                  helperText={
                    isDraft
                      ? "Base operational currency. Locks permanently once store is activated."
                      : "Base currency is permanently locked because this store has been activated."
                  }
                >
                  <Select
                    id="settings-currency"
                    name="currency"
                    value={formData.currency}
                    onChange={(e) => handleInputChange("currency", e.target.value)}
                    disabled={!isDraft || isReadOnly || isSaving}
                    error={Boolean(fieldErrors.currency)}
                  >
                    {COMMON_CURRENCIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </FormField>

                {/* Locale */}
                <FormField
                  label="Default Locale"
                  htmlFor="settings-locale"
                  error={fieldErrors.locale}
                  helperText="Controls formatting of prices, dates, and localized storefront text."
                >
                  <Select
                    id="settings-locale"
                    name="locale"
                    value={formData.locale}
                    onChange={(e) => handleInputChange("locale", e.target.value)}
                    disabled={isReadOnly || isSaving}
                    error={Boolean(fieldErrors.locale)}
                  >
                    {COMMON_LOCALES.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </Select>
                </FormField>

                {/* Timezone */}
                <FormField
                  label="Store Timezone"
                  htmlFor="settings-timezone"
                  error={fieldErrors.timezone}
                  helperText="Used for order timestamps, discount schedules, and merchant reports."
                >
                  <Select
                    id="settings-timezone"
                    name="timezone"
                    value={formData.timezone}
                    onChange={(e) => handleInputChange("timezone", e.target.value)}
                    disabled={isReadOnly || isSaving}
                    error={Boolean(fieldErrors.timezone)}
                  >
                    {COMMON_TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
            </div>

            <div
              style={{
                height: "1px",
                backgroundColor: "var(--color-border)",
                margin: "var(--space-2) 0",
              }}
            />

            {/* Section 3: Contact & Description */}
            <div>
              <h3
                style={{
                  fontSize: "var(--font-size-sm)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--color-text-muted)",
                  margin: "0 0 var(--space-4) 0",
                }}
              >
                Contact & About
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "var(--space-4)",
                }}
              >
                {/* Contact Email */}
                <FormField
                  label="Support / Contact Email"
                  htmlFor="settings-contact-email"
                  error={fieldErrors.contactEmail}
                  helperText="Primary email used for customer order notifications and receipts."
                >
                  <Input
                    id="settings-contact-email"
                    name="contactEmail"
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) =>
                      handleInputChange("contactEmail", e.target.value)
                    }
                    disabled={isReadOnly || isSaving}
                    error={Boolean(fieldErrors.contactEmail)}
                    placeholder="support@example.com"
                  />
                </FormField>

                {/* Contact Phone */}
                <FormField
                  label="Contact Phone"
                  htmlFor="settings-contact-phone"
                  error={fieldErrors.contactPhone}
                  helperText="Optional phone contact for merchant order dispatch."
                >
                  <Input
                    id="settings-contact-phone"
                    name="contactPhone"
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) =>
                      handleInputChange("contactPhone", e.target.value)
                    }
                    disabled={isReadOnly || isSaving}
                    error={Boolean(fieldErrors.contactPhone)}
                    maxLength={30}
                    placeholder="+1 555-0199"
                  />
                </FormField>
              </div>

              {/* Description */}
              <div style={{ marginTop: "var(--space-4)" }}>
                <FormField
                  label="Store Description"
                  htmlFor="settings-description"
                  error={fieldErrors.description}
                  helperText="Brief summary of your store, merchandise category, or policies."
                >
                  <Textarea
                    id="settings-description"
                    name="description"
                    value={formData.description}
                    onChange={(e) =>
                      handleInputChange("description", e.target.value)
                    }
                    disabled={isReadOnly || isSaving}
                    error={Boolean(fieldErrors.description)}
                    rows={3}
                    placeholder="Describe your store and product specialty..."
                  />
                </FormField>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              flexWrap: "wrap",
              gap: "var(--space-3)",
            }}
          >
            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
              {isDirty ? (
                <span>Unsaved changes pending</span>
              ) : (
                <span>All settings saved</span>
              )}
            </div>

            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              {isDirty && !isReadOnly && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDiscard}
                  disabled={isSaving}
                >
                  Discard Changes
                </Button>
              )}
              <Button
                type="submit"
                variant="primary"
                loading={isSaving}
                disabled={isSaving || isReadOnly || !isDirty}
              >
                Save Settings
              </Button>
            </div>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
