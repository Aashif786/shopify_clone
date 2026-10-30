"use client";

import React, { useState, useEffect } from "react";
import type { StoreDetailDTO } from "@calcart/stores";
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
} from "@calcart/ui";
import {
  Store,
  Globe,
  Mail,
  CheckCircle2,
  ExternalLink,
  Save,
  RotateCcw,
} from "lucide-react";
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
    <Card className="store-settings-card border-border/70 bg-card shadow-sm">
      <CardHeader className="border-b border-border/50 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              General Store Settings
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Configure the public profile, primary currency, regional defaults, and
              merchant contact details for this store.
            </CardDescription>
          </div>
          {isDirty && !isReadOnly && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Unsaved changes
            </span>
          )}
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit} noValidate>
        <CardContent className="space-y-6 pt-6">
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
            <div className="flex items-center justify-between p-3 px-4 bg-muted/60 border border-border/80 rounded-lg text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="font-medium text-foreground">You have unsaved changes.</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDiscard}
                  disabled={isSaving}
                  className="h-7 text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Discard
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={isSaving}
                  disabled={isSaving}
                  className="h-7 text-xs"
                >
                  <Save className="h-3 w-3 mr-1" />
                  Save Changes
                </Button>
              </div>
            </div>
          )}

          {/* Section 1: Store Identity */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-border/40">
              <Store className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Store Identity
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  className="h-9 text-sm"
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
                  className="h-9 text-sm font-mono bg-muted/60 cursor-not-allowed text-muted-foreground"
                />
              </FormField>
            </div>

            {/* Storefront preview link */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
              <span>Storefront route:</span>
              <a
                href={`/storefront/${store.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
              >
                <code>/storefront/{store.slug}</code>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Section 2: Regional & Currency Configuration */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 pb-1 border-b border-border/40">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Regional & Currency
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  className="h-9 text-sm"
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
                  className="h-9 text-sm"
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
                  className="h-9 text-sm"
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

          {/* Section 3: Contact & Description */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 pb-1 border-b border-border/40">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Contact & About
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  className="h-9 text-sm"
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
                  className="h-9 text-sm"
                />
              </FormField>
            </div>

            {/* Description */}
            <div className="pt-1">
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
                  className="text-sm resize-y"
                />
              </FormField>
            </div>
          </div>
        </CardContent>

        <CardFooter className="border-t border-border/50 bg-muted/20 py-4 px-6 flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            {isDirty ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span className="font-medium text-amber-600 dark:text-amber-400">Unsaved changes pending</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>All settings saved</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {isDirty && !isReadOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDiscard}
                disabled={isSaving}
                className="h-8 text-xs"
              >
                Discard Changes
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={isSaving}
              disabled={isSaving || isReadOnly || !isDirty}
              className="h-8 text-xs font-medium"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Save Settings
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
