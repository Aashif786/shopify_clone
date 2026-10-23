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
  lowStockThreshold: string;
  maxOrderQuantity: string;
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
    lowStockThreshold: String(product.lowStockThreshold ?? 5),
    maxOrderQuantity:
      product.maxOrderQuantity !== null && product.maxOrderQuantity !== undefined
        ? String(product.maxOrderQuantity)
        : "",
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
        lowStockThreshold?: number;
        maxOrderQuantity?: number | null;
      } = {
        title: formData.title.trim(),
        slug: formData.slug.trim(),
        description: formData.description.trim() ? formData.description.trim() : null,
      };

      if (formData.lowStockThreshold.trim()) {
        const threshold = Number(formData.lowStockThreshold);
        if (!isNaN(threshold) && threshold >= 0) {
          productPayload.lowStockThreshold = Math.floor(threshold);
        }
      }

      if (formData.maxOrderQuantity.trim()) {
        const maxQty = Number(formData.maxOrderQuantity);
        if (!isNaN(maxQty) && maxQty > 0) {
          productPayload.maxOrderQuantity = Math.floor(maxQty);
        }
      } else {
        productPayload.maxOrderQuantity = null;
      }

      await apiClient.patch(
        `/api/v1/stores/${storeId}/products/${product.id}`,
        productPayload,
        { storeId }
      );

      // 2. Update default variant if present
      if (defaultVariant) {
        const variantPayload: {
          price?: number;
          compareAtPrice?: number | null;
          sku?: string | null;
          lowStockThreshold?: number | null;
          maxOrderQuantity?: number | null;
        } = {};

        if (formData.price.trim()) {
          const parsed = parseFloat(formData.price);
          if (!isNaN(parsed) && parsed >= 0) {
            variantPayload.price = Math.round(parsed * 100);
          }
        }

        if (formData.compareAtPrice.trim()) {
          const parsedComp = parseFloat(formData.compareAtPrice);
          if (!isNaN(parsedComp) && parsedComp >= 0) {
            variantPayload.compareAtPrice = Math.round(parsedComp * 100);
          }
        } else {
          variantPayload.compareAtPrice = null;
        }

        if (formData.sku.trim()) {
          variantPayload.sku = formData.sku.trim();
        } else {
          variantPayload.sku = null;
        }

        if (formData.lowStockThreshold.trim()) {
          const threshold = Number(formData.lowStockThreshold);
          if (!isNaN(threshold) && threshold >= 0) {
            variantPayload.lowStockThreshold = Math.floor(threshold);
          }
        }

        if (formData.maxOrderQuantity.trim()) {
          const maxQty = Number(formData.maxOrderQuantity);
          if (!isNaN(maxQty) && maxQty > 0) {
            variantPayload.maxOrderQuantity = Math.floor(maxQty);
          }
        } else {
          variantPayload.maxOrderQuantity = null;
        }

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
    <form onSubmit={handleSubmit} noValidate className="product-edit-form space-y-6">
      {generalError && (
        <div className="mb-4">
          <Alert variant="danger" title="Update Error">
            {generalError}
          </Alert>
        </div>
      )}

      <div className="space-y-6">
        {/* Core Product Information Card */}
        <Card>
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-base font-semibold">Edit Product Information</CardTitle>
            <CardDescription className="text-xs">Update title, handle, and description</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
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
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-base font-semibold">Pricing & Inventory</CardTitle>
              <CardDescription className="text-xs">
                Currency: <strong>{defaultVariant.currency}</strong> (currency code is immutable)
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

                <FormField
                  htmlFor="edit-product-low-stock-threshold"
                  label="Low-Stock Threshold"
                  helperText="Stock level at which low-stock warning triggers (default: 5)"
                  error={fieldErrors.lowStockThreshold}
                >
                  <Input
                    id="edit-product-low-stock-threshold"
                    type="number"
                    min="0"
                    value={formData.lowStockThreshold}
                    onChange={(e) => handleChange("lowStockThreshold", e.target.value)}
                    placeholder="5"
                    error={Boolean(fieldErrors.lowStockThreshold)}
                    disabled={isSubmitting}
                  />
                </FormField>

                <FormField
                  htmlFor="edit-product-max-order-quantity"
                  label="Maximum Order Quantity"
                  helperText="Maximum allowed units per customer order (leave blank for unlimited)"
                  error={fieldErrors.maxOrderQuantity}
                >
                  <Input
                    id="edit-product-max-order-quantity"
                    type="number"
                    min="1"
                    value={formData.maxOrderQuantity}
                    onChange={(e) => handleChange("maxOrderQuantity", e.target.value)}
                    placeholder="Unlimited"
                    error={Boolean(fieldErrors.maxOrderQuantity)}
                    disabled={isSubmitting}
                  />
                </FormField>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Controls */}
        <div className="flex gap-3 justify-end pt-2">
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
