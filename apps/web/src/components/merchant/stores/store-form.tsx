"use client";

import React, { useState } from "react";
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
import {
  Store,
  Globe,
  Mail,
  Sparkles,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { useStore } from "../../../context/store-context";
import { apiClient, ApiClientError } from "../../../lib/api-client";
import {
  COMMON_CURRENCIES,
  COMMON_LOCALES,
  COMMON_TIMEZONES,
  formDataToStorePayload,
  INITIAL_STORE_FORM_DATA,
  normalizeSlugInput,
  validateStoreFormData,
  type StoreFormData,
} from "../../../lib/merchant-store-helpers";

export interface StoreFormProps {
  onSuccess?: (store: StoreDetailDTO) => void;
  onCancel?: () => void;
}

export function StoreForm({ onSuccess, onCancel }: StoreFormProps) {
  const { refreshStores } = useStore();

  const [formData, setFormData] = useState<StoreFormData>(INITIAL_STORE_FORM_DATA);
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdStore, setCreatedStore] = useState<StoreDetailDTO | null>(null);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setFormData((prev) => {
      const nextSlug = isSlugManuallyEdited
        ? prev.slug
        : normalizeSlugInput(newName);
      return {
        ...prev,
        name: newName,
        slug: nextSlug,
      };
    });

    if (fieldErrors.name) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.name;
        return next;
      });
    }

    if (!isSlugManuallyEdited && fieldErrors.slug) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.slug;
        return next;
      });
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSlugManuallyEdited(true);
    const newSlug = e.target.value.toLowerCase().trim();
    setFormData((prev) => ({
      ...prev,
      slug: newSlug,
    }));

    if (fieldErrors.slug) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.slug;
        return next;
      });
    }
  };

  const handleInputChange = (
    field: keyof StoreFormData,
    value: string
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

    const clientErrors = validateStoreFormData(formData);
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setApiError("Please resolve the validation errors indicated below.");
      return;
    }

    setIsSubmitting(true);
    setApiError(null);
    setFieldErrors({});

    try {
      const payload = formDataToStorePayload(formData);
      const newStore = await apiClient.post<StoreDetailDTO>(
        "/api/v1/stores",
        payload
      );

      await refreshStores(newStore.id);

      setCreatedStore(newStore);
      if (onSuccess) {
        onSuccess(newStore);
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.isConflict) {
          setFieldErrors((prev) => ({
            ...prev,
            slug:
              err.message ||
              "This store slug is already registered. Please choose another slug.",
          }));
          setApiError(
            "A store with this slug already exists. Please customize the slug."
          );
        } else if (err.fields) {
          setFieldErrors(err.fields);
          setApiError(err.message || "Request validation failed.");
        } else if (err.isForbidden) {
          setApiError(
            "Permission denied: You do not have permission to create stores under this organization."
          );
        } else {
          setApiError(err.message || "Failed to create merchant store.");
        }
      } else {
        setApiError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while creating your store."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData(INITIAL_STORE_FORM_DATA);
    setIsSlugManuallyEdited(false);
    setFieldErrors({});
    setApiError(null);
    setCreatedStore(null);
  };

  if (createdStore) {
    return (
      <Card className="rounded-xl border border-border/60 bg-card shadow-xs">
        <CardHeader className="border-b border-border/60 p-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
                Store Created Successfully
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Your store <strong>{createdStore.name}</strong> is ready and set as your active store.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <Alert
            variant={createdStore.status === "ACTIVE" ? "success" : "warning"}
            title={createdStore.status === "ACTIVE" ? "Store Activated" : "Store Created (Draft)"}
          >
            Store ID: <code>{createdStore.id}</code> &bull; Currency: <strong>{createdStore.currency}</strong> &bull; Status: <strong>{createdStore.status}</strong>
            {createdStore.status !== "ACTIVE" && (
              <div className="mt-2 text-xs">
                Note: While in draft mode, the customer storefront is unavailable to shoppers until activated in Store Settings.
              </div>
            )}
          </Alert>

          <div className="p-4 bg-muted/40 rounded-lg border border-border/60 flex flex-col gap-1.5">
            <div className="text-xs text-muted-foreground">
              Customer Storefront Route:
            </div>
            <div>
              <code className="text-sm font-semibold text-primary font-mono">
                /stores/{encodeURIComponent(createdStore.slug)}/products
              </code>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t border-border/50 bg-muted/20 py-4 px-6 flex items-center gap-3 flex-wrap">
          <a href="/merchant" className="btn btn-primary btn-md inline-flex items-center gap-1.5 text-xs">
            Go to Dashboard
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
          <a
            href={`/stores/${encodeURIComponent(createdStore.slug)}/products`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-md inline-flex items-center gap-1.5 text-xs"
          >
            View Storefront
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <Button variant="ghost" size="md" onClick={handleReset} className="text-xs">
            Create Another Store
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const slugPreview = formData.slug.trim() || normalizeSlugInput(formData.name) || "my-store";

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Card className="rounded-xl border border-border/60 bg-card shadow-xs">
        <CardHeader className="border-b border-border/60 p-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Store className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
                Store Details
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Configure your store identity, regional defaults, and customer storefront URL.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-5">
          {/* Global API Error Alert */}
          {apiError && (
            <Alert
              variant="danger"
              title="Creation Error"
              onDismiss={() => setApiError(null)}
            >
              {apiError}
            </Alert>
          )}

          {/* Section: Basic Identity */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                htmlFor="store-name"
                label="Store Name"
                required
                error={fieldErrors.name}
                helperText="The merchant-facing and customer-facing title of your store (1-100 characters)."
              >
                <Input
                  id="store-name"
                  name="name"
                  placeholder="e.g. Apex Outfitters"
                  value={formData.name}
                  onChange={handleNameChange}
                  error={Boolean(fieldErrors.name)}
                  disabled={isSubmitting}
                  maxLength={100}
                  required
                  className="h-9 text-sm"
                />
              </FormField>

              <FormField
                htmlFor="store-slug"
                label="Storefront Slug"
                error={fieldErrors.slug}
                helperText="URL identifier for customer storefront access (3-63 characters)."
              >
                <Input
                  id="store-slug"
                  name="slug"
                  placeholder="e.g. apex-outfitters"
                  value={formData.slug}
                  onChange={handleSlugChange}
                  error={Boolean(fieldErrors.slug)}
                  disabled={isSubmitting}
                  maxLength={63}
                  className="h-9 text-sm font-mono"
                />
                <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5 font-mono">
                  <span>Customer Storefront URL:</span>{" "}
                  <code className="text-primary font-medium">
                    /stores/{slugPreview}/products
                  </code>
                </div>
              </FormField>
            </div>
          </div>

          {/* Section: Regional & Currency Configuration */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 pb-1 border-b border-border/40">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Regional & Operating Currency
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                htmlFor="store-currency"
                label="Currency"
                error={fieldErrors.currency}
                helperText="Primary operating currency."
              >
                <Select
                  id="store-currency"
                  name="currency"
                  value={formData.currency}
                  onChange={(e) => handleInputChange("currency", e.target.value)}
                  error={Boolean(fieldErrors.currency)}
                  disabled={isSubmitting}
                  options={COMMON_CURRENCIES}
                  className="h-9 text-sm"
                />
              </FormField>

              <FormField
                htmlFor="store-locale"
                label="Primary Locale"
                error={fieldErrors.locale}
                helperText="Language and regional formatting."
              >
                <Select
                  id="store-locale"
                  name="locale"
                  value={formData.locale}
                  onChange={(e) => handleInputChange("locale", e.target.value)}
                  error={Boolean(fieldErrors.locale)}
                  disabled={isSubmitting}
                  options={COMMON_LOCALES}
                  className="h-9 text-sm"
                />
              </FormField>

              <FormField
                htmlFor="store-timezone"
                label="Timezone"
                error={fieldErrors.timezone}
                helperText="Used for scheduling & reports."
              >
                <Select
                  id="store-timezone"
                  name="timezone"
                  value={formData.timezone}
                  onChange={(e) => handleInputChange("timezone", e.target.value)}
                  error={Boolean(fieldErrors.timezone)}
                  disabled={isSubmitting}
                  options={COMMON_TIMEZONES}
                  className="h-9 text-sm"
                />
              </FormField>
            </div>
          </div>

          {/* Optional Settings Section */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 pb-1 border-b border-border/40">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Contact & Storefront Info (Optional)
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                htmlFor="store-contact-email"
                label="Contact Email"
                error={fieldErrors.contactEmail}
                helperText="Support email address for customer inquiries."
              >
                <Input
                  id="store-contact-email"
                  name="contactEmail"
                  type="email"
                  placeholder="support@example.com"
                  value={formData.contactEmail}
                  onChange={(e) =>
                    handleInputChange("contactEmail", e.target.value)
                  }
                  error={Boolean(fieldErrors.contactEmail)}
                  disabled={isSubmitting}
                  className="h-9 text-sm"
                />
              </FormField>

              <FormField
                htmlFor="store-contact-phone"
                label="Contact Phone"
                error={fieldErrors.contactPhone}
                helperText="Support phone number (up to 30 characters)."
              >
                <Input
                  id="store-contact-phone"
                  name="contactPhone"
                  placeholder="+1 (555) 000-0000"
                  value={formData.contactPhone}
                  onChange={(e) =>
                    handleInputChange("contactPhone", e.target.value)
                  }
                  error={Boolean(fieldErrors.contactPhone)}
                  disabled={isSubmitting}
                  maxLength={30}
                  className="h-9 text-sm"
                />
              </FormField>
            </div>

            <FormField
              htmlFor="store-description"
              label="Store Description"
              error={fieldErrors.description}
              helperText="Brief summary of your store catalog and product offerings."
            >
              <Textarea
                id="store-description"
                name="description"
                placeholder="e.g. Premium outdoor apparel, technical gear, and mountain equipment."
                value={formData.description}
                onChange={(e) =>
                  handleInputChange("description", e.target.value)
                }
                error={Boolean(fieldErrors.description)}
                disabled={isSubmitting}
                rows={3}
                className="text-sm resize-y"
              />
            </FormField>

            <FormField
              htmlFor="store-status"
              label="Store Status"
              helperText="Active stores have immediate storefront availability. Draft stores remain hidden from public shoppers until activated in Settings."
            >
              <Select
                id="store-status"
                name="status"
                value={formData.status || "ACTIVE"}
                onChange={(e) =>
                  handleInputChange("status", e.target.value)
                }
                options={[
                  { value: "ACTIVE", label: "Active (Storefront live & publicly accessible)" },
                  { value: "DRAFT", label: "Draft (Storefront hidden until activated)" },
                ]}
                disabled={isSubmitting}
                className="h-9 text-sm"
              />
            </FormField>
          </div>
        </CardContent>

        <CardFooter className="border-t border-border/60 bg-muted/20 py-3.5 px-5 flex items-center justify-end gap-3">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              size="md"
              disabled={isSubmitting}
              onClick={onCancel}
              className="h-9 text-xs"
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={isSubmitting}
            disabled={isSubmitting}
            className="h-9 text-xs font-medium"
          >
            {isSubmitting ? "Creating store..." : "Create Store"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
