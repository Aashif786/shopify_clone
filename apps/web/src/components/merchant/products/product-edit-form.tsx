"use client";

import React, { useState } from "react";
import type { ProductDetailDTO } from "@shopify-clone/products";
import {
  Button,
  Input,
  Textarea,
  FormField,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Alert,
} from "@shopify-clone/ui";
import { apiClient, ApiClientError } from "../../../lib/api-client";

export interface ProductEditFormData {
  title: string;
  slug: string;
  description: string;
  price: string;
  compareAtPrice: string;
  sku: string;
}

export interface ProductEditFormProps {
  product: ProductDetailDTO;
  storeId: string;
  onSuccess: (updatedProduct: ProductDetailDTO) => void;
  onCancel: () => void;
}

export function ProductEditForm({
  product,
  storeId,
  onSuccess,
  onCancel,
}: ProductEditFormProps) {
  const defaultVariant = product.variants[0];

  const [formData, setFormData] = useState<ProductEditFormData>({
    title: product.title,
    slug: product.slug,
    description: product.description || "",
    price: defaultVariant ? (defaultVariant.price / 100).toFixed(2) : "",
    compareAtPrice:
      defaultVariant && defaultVariant.compareAtPrice !== null
        ? (defaultVariant.compareAtPrice / 100).toFixed(2)
        : "",
    sku: defaultVariant?.sku || "",
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleChange = (
    field: keyof ProductEditFormData,
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
    if (generalError) {
      setGeneralError(null);
    }
  };

  const validateClientSide = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.title.trim()) {
      errors.title = "Product title is required";
    } else if (formData.title.trim().length > 255) {
      errors.title = "Product title cannot exceed 255 characters";
    }

    if (!formData.slug.trim()) {
      errors.slug = "Product handle (slug) is required";
    }

    if (formData.price.trim()) {
      const priceNum = Number(formData.price);
      if (isNaN(priceNum) || priceNum < 0) {
        errors.price = "Price must be a valid non-negative number";
      }
    }

    if (formData.compareAtPrice.trim()) {
      const compareNum = Number(formData.compareAtPrice);
      if (isNaN(compareNum) || compareNum < 0) {
        errors.compareAtPrice = "Compare-at price must be a valid non-negative number";
      }
    }

    if (formData.sku.trim() && formData.sku.trim().length > 100) {
      errors.sku = "SKU cannot exceed 100 characters";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setGeneralError(null);

    if (!validateClientSide()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Update product base fields
      const productPayload: {
        title: string;
        slug: string;
        description: string | null;
      } = {
        title: formData.title.trim(),
        slug: formData.slug.trim(),
        description: formData.description.trim() ? formData.description.trim() : null,
      };

      await apiClient.patch<ProductDetailDTO>(
        `/api/v1/stores/${storeId}/products/${product.id}`,
        productPayload,
        { storeId }
      );

      // 2. Update default variant pricing/sku if applicable
      if (defaultVariant) {
        const variantPayload: {
          price?: number;
          compareAtPrice?: number | null;
          sku?: string | null;
        } = {};

        if (formData.price.trim()) {
          variantPayload.price = Math.round(Number(formData.price) * 100);
        }

        if (formData.compareAtPrice.trim()) {
          variantPayload.compareAtPrice = Math.round(Number(formData.compareAtPrice) * 100);
        } else {
          variantPayload.compareAtPrice = null;
        }

        variantPayload.sku = formData.sku.trim() || null;

        await apiClient.patch(
          `/api/v1/stores/${storeId}/products/${product.id}/variants/${defaultVariant.id}`,
          variantPayload,
          { storeId }
        );
      }

      // 3. Fetch refreshed canonical product
      const refreshed = await apiClient.get<ProductDetailDTO>(
        `/api/v1/stores/${storeId}/products/${product.id}`,
        { storeId }
      );

      onSuccess(refreshed);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.fields && Object.keys(err.fields).length > 0) {
          setFieldErrors(err.fields);
        }
        setGeneralError(err.message || "Failed to update product");
      } else {
        setGeneralError(
          err instanceof Error ? err.message : "An unexpected error occurred"
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="product-edit-form">
      {generalError && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <Alert variant="danger" title="Update Error">
            {generalError}
          </Alert>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        {/* Core Product Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Edit Product Information</CardTitle>
            <CardDescription>Update title, handle, and description</CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              htmlFor="edit-product-title"
              label="Title"
              required={true}
              error={fieldErrors.title}
            >
              <Input
                id="edit-product-title"
                value={formData.title}
                onChange={(e) => handleChange("title", e.target.value)}
                error={Boolean(fieldErrors.title)}
                disabled={isSubmitting}
                required
              />
            </FormField>

            <FormField
              htmlFor="edit-product-slug"
              label="URL Handle (Slug)"
              required={true}
              helperText="Unique identifier for the product URL"
              error={fieldErrors.slug}
            >
              <Input
                id="edit-product-slug"
                value={formData.slug}
                onChange={(e) => handleChange("slug", e.target.value)}
                error={Boolean(fieldErrors.slug)}
                disabled={isSubmitting}
                required
              />
            </FormField>

            <FormField
              htmlFor="edit-product-description"
              label="Description"
              error={fieldErrors.description}
            >
              <Textarea
                id="edit-product-description"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                rows={5}
                error={Boolean(fieldErrors.description)}
                disabled={isSubmitting}
              />
            </FormField>
          </CardContent>
        </Card>

        {/* Pricing & SKU Card */}
        {defaultVariant && (
          <Card>
            <CardHeader>
              <CardTitle>Pricing & Inventory</CardTitle>
              <CardDescription>
                Currency: <strong>{defaultVariant.currency}</strong> (currency code is immutable)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "var(--space-4)",
                }}
              >
                <FormField
                  htmlFor="edit-product-price"
                  label={`Price (${defaultVariant.currency})`}
                  error={fieldErrors.price}
                >
                  <Input
                    id="edit-product-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => handleChange("price", e.target.value)}
                    error={Boolean(fieldErrors.price)}
                    disabled={isSubmitting}
                  />
                </FormField>

                <FormField
                  htmlFor="edit-product-compare-at-price"
                  label={`Compare-at Price (${defaultVariant.currency})`}
                  helperText="Leave empty to clear discount"
                  error={fieldErrors.compareAtPrice}
                >
                  <Input
                    id="edit-product-compare-at-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.compareAtPrice}
                    onChange={(e) => handleChange("compareAtPrice", e.target.value)}
                    error={Boolean(fieldErrors.compareAtPrice)}
                    disabled={isSubmitting}
                  />
                </FormField>

                <FormField
                  htmlFor="edit-product-sku"
                  label="SKU"
                  error={fieldErrors.sku}
                >
                  <Input
                    id="edit-product-sku"
                    value={formData.sku}
                    onChange={(e) => handleChange("sku", e.target.value)}
                    error={Boolean(fieldErrors.sku)}
                    disabled={isSubmitting}
                  />
                </FormField>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Controls */}
        <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
          <Button
            variant="outline"
            size="md"
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            disabled={isSubmitting}
            loading={isSubmitting}
          >
            {isSubmitting ? "Saving Changes..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}
