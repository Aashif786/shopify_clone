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

    // Prevent duplicate submissions
    if (isSubmitting) return;

    // Validate client-side inputs first
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

      // Refresh stores context and select the newly created store
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
      <Card>
        <CardHeader>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "24px" }} aria-hidden="true">
              🎉
            </span>
            <div>
              <CardTitle>Store Created Successfully</CardTitle>
              <CardDescription>
                Your store <strong>{createdStore.name}</strong> is ready and set as your active store.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Alert variant="success" title="Store Activated">
            Store ID: <code>{createdStore.id}</code> &bull; Currency: <strong>{createdStore.currency}</strong> &bull; Status: <strong>{createdStore.status}</strong>
          </Alert>

          <div
            style={{
              marginTop: "var(--space-4)",
              padding: "var(--space-4)",
              backgroundColor: "var(--color-bg)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
            }}
          >
            <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)" }}>
              Customer Storefront Route:
            </div>
            <div>
              <code style={{ fontSize: "var(--font-size-md)", color: "var(--color-primary)" }}>
                /stores/{encodeURIComponent(createdStore.slug)}/products
              </code>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", width: "100%" }}>
            <a href="/merchant" className="btn btn-primary btn-md">
              Go to Dashboard
            </a>
            <a
              href={`/stores/${encodeURIComponent(createdStore.slug)}/products`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-md"
            >
              View Storefront ↗
            </a>
            <Button variant="ghost" size="md" onClick={handleReset}>
              Create Another Store
            </Button>
          </div>
        </CardFooter>
      </Card>
    );
  }

  const slugPreview = formData.slug.trim() || normalizeSlugInput(formData.name) || "my-store";

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Store Details</CardTitle>
          <CardDescription>
            Configure your store identity, regional defaults, and customer storefront URL.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
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

            {/* Store Name */}
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
              />
            </FormField>

            {/* Store Slug */}
            <FormField
              htmlFor="store-slug"
              label="Storefront Slug"
              error={fieldErrors.slug}
              helperText="URL identifier for customer storefront access (3-63 characters, lowercase letters, numbers, and hyphens)."
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
              />
              <div
                style={{
                  marginTop: "var(--space-2)",
                  fontSize: "var(--font-size-xs)",
                  color: "var(--color-text-muted)",
                }}
              >
                Customer Storefront URL:{" "}
                <code style={{ color: "var(--color-primary)", fontWeight: 500 }}>
                  /stores/{slugPreview}/products
                </code>
              </div>
            </FormField>

            {/* Currency & Locale Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "var(--space-4)",
              }}
            >
              {/* Currency */}
              <FormField
                htmlFor="store-currency"
                label="Currency"
                error={fieldErrors.currency}
                helperText="Primary operating currency for catalog pricing and checkout transactions."
              >
                <Select
                  id="store-currency"
                  name="currency"
                  value={formData.currency}
                  onChange={(e) => handleInputChange("currency", e.target.value)}
                  error={Boolean(fieldErrors.currency)}
                  disabled={isSubmitting}
                  options={COMMON_CURRENCIES}
                />
              </FormField>

              {/* Locale */}
              <FormField
                htmlFor="store-locale"
                label="Primary Locale"
                error={fieldErrors.locale}
                helperText="Language and regional formatting for dates, prices, and storefront text."
              >
                <Select
                  id="store-locale"
                  name="locale"
                  value={formData.locale}
                  onChange={(e) => handleInputChange("locale", e.target.value)}
                  error={Boolean(fieldErrors.locale)}
                  disabled={isSubmitting}
                  options={COMMON_LOCALES}
                />
              </FormField>
            </div>

            {/* Timezone */}
            <FormField
              htmlFor="store-timezone"
              label="Timezone"
              error={fieldErrors.timezone}
              helperText="Used for scheduling discount promotions and order reporting."
            >
              <Select
                id="store-timezone"
                name="timezone"
                value={formData.timezone}
                onChange={(e) => handleInputChange("timezone", e.target.value)}
                error={Boolean(fieldErrors.timezone)}
                disabled={isSubmitting}
                options={COMMON_TIMEZONES}
              />
            </FormField>

            {/* Optional Settings Section */}
            <div
              style={{
                borderTop: "1px solid var(--color-border)",
                paddingTop: "var(--space-5)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-4)",
              }}
            >
              <div>
                <h4
                  style={{
                    margin: 0,
                    fontSize: "var(--font-size-md)",
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                  }}
                >
                  Contact & Storefront Info (Optional)
                </h4>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: "var(--font-size-xs)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  Optional merchant contact details displayed to customers or on order receipts.
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "var(--space-4)",
                }}
              >
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
                />
              </FormField>
            </div>
          </div>
        </CardContent>

        <CardFooter>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "var(--space-3)",
              width: "100%",
            }}
          >
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                size="md"
                disabled={isSubmitting}
                onClick={onCancel}
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
            >
              {isSubmitting ? "Creating store..." : "Create Store"}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </form>
  );
}
