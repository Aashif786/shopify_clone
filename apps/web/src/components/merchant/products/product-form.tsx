"use client";

import React, { useState } from "react";
import type { ProductDetailDTO, ProductStatus } from "@shopify-clone/products";
import {
  Button,
  Input,
  Textarea,
  Select,
  FormField,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Alert,
} from "@shopify-clone/ui";
import { apiClient, ApiClientError } from "../../../lib/api-client";

export interface ProductFormData {
  title: string;
  description: string;
  slug: string;
  status: ProductStatus;
  price: string; // Form string, converted to cents for API
  compareAtPrice: string; // Form string, converted to cents for API
  sku: string;
  currency: string;
  lowStockThreshold: string;
  maxOrderQuantity: string;
}

export interface ProductFormProps {
  storeId: string;
  onSuccess?: (product: ProductDetailDTO) => void;
  onCancel?: () => void;
}

export function ProductForm({
  storeId,
  onSuccess,
  onCancel,
}: ProductFormProps) {
  const [formData, setFormData] = useState<ProductFormData>({
    title: "",
    description: "",
    slug: "",
    status: "DRAFT",
    price: "",
    compareAtPrice: "",
    sku: "",
    currency: "USD",
    lowStockThreshold: "5",
    maxOrderQuantity: "",
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleChange = (
    field: keyof ProductFormData,
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field-level error on change
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

    if (formData.currency.trim()) {
      if (!/^[A-Za-z]{3}$/.test(formData.currency.trim())) {
        errors.currency = "Currency must be a 3-letter currency code (e.g. USD)";
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setGeneralError(null);

    // Client-side validation check
    if (!validateClientSide()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Build request payload conforming to CreateProductInput & createProductValidator
      const payload: {
        title: string;
        description?: string | null;
        slug?: string;
        status?: ProductStatus;
        price?: number;
        compareAtPrice?: number | null;
        sku?: string | null;
        currency?: string;
        lowStockThreshold?: number;
        maxOrderQuantity?: number | null;
      } = {
        title: formData.title.trim(),
        description: formData.description.trim() ? formData.description.trim() : null,
        status: formData.status,
        currency: formData.currency.trim().toUpperCase() || "USD",
      };

      if (formData.slug.trim()) {
        payload.slug = formData.slug.trim();
      }

      if (formData.sku.trim()) {
        payload.sku = formData.sku.trim();
      }

      if (formData.price.trim()) {
        const priceNum = Number(formData.price);
        payload.price = Math.round(priceNum * 100);
      }

      if (formData.compareAtPrice.trim()) {
        const compareNum = Number(formData.compareAtPrice);
        payload.compareAtPrice = Math.round(compareNum * 100);
      }

      if (formData.lowStockThreshold.trim()) {
        const thresholdNum = Number(formData.lowStockThreshold);
        if (!isNaN(thresholdNum) && thresholdNum >= 0) {
          payload.lowStockThreshold = Math.floor(thresholdNum);
        }
      }

      if (formData.maxOrderQuantity.trim()) {
        const maxQtyNum = Number(formData.maxOrderQuantity);
        if (!isNaN(maxQtyNum) && maxQtyNum > 0) {
          payload.maxOrderQuantity = Math.floor(maxQtyNum);
        }
      }

      const created = await apiClient.post<ProductDetailDTO>(
        `/api/v1/stores/${storeId}/products`,
        payload,
        { storeId }
      );

      if (onSuccess) {
        onSuccess(created);
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.fields && Object.keys(err.fields).length > 0) {
          setFieldErrors(err.fields);
        }
        setGeneralError(err.message || "Failed to create product");
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
    <form onSubmit={handleSubmit} noValidate className="product-form">
      {generalError && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <Alert variant="danger" title="Product Creation Error">
            {generalError}
          </Alert>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        {/* Basic Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Title, handle, and description for the product</CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              htmlFor="product-title-input"
              label="Title"
              required={true}
              error={fieldErrors.title}
            >
              <Input
                id="product-title-input"
                value={formData.title}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="e.g. Classic Cotton T-Shirt"
                error={Boolean(fieldErrors.title)}
                disabled={isSubmitting}
                required
              />
            </FormField>

            <FormField
              htmlFor="product-slug-input"
              label="URL Handle (Slug)"
              helperText="Unique URL identifier. Generated automatically from title if left blank."
              error={fieldErrors.slug}
            >
              <Input
                id="product-slug-input"
                value={formData.slug}
                onChange={(e) => handleChange("slug", e.target.value)}
                placeholder="e.g. classic-cotton-t-shirt"
                error={Boolean(fieldErrors.slug)}
                disabled={isSubmitting}
              />
            </FormField>

            <FormField
              htmlFor="product-description-input"
              label="Description"
              error={fieldErrors.description}
            >
              <Textarea
                id="product-description-input"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                rows={4}
                placeholder="Add a detailed description for this product..."
                error={Boolean(fieldErrors.description)}
                disabled={isSubmitting}
              />
            </FormField>

            <FormField
              htmlFor="product-status-select"
              label="Status"
              error={fieldErrors.status}
            >
              <Select
                id="product-status-select"
                value={formData.status}
                onChange={(e) =>
                  handleChange("status", e.target.value as ProductStatus)
                }
                options={[
                  { label: "Draft - hidden from customers", value: "DRAFT" },
                  { label: "Active - available for purchase", value: "ACTIVE" },
                  { label: "Archived - hidden from catalog", value: "ARCHIVED" },
                ]}
                error={Boolean(fieldErrors.status)}
                disabled={isSubmitting}
              />
            </FormField>
          </CardContent>
        </Card>

        {/* Pricing Card */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
            <CardDescription>Set the product selling price and compare-at discount</CardDescription>
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
                htmlFor="product-price-input"
                label="Price"
                helperText="Standard unit price (e.g. 19.99)"
                error={fieldErrors.price}
              >
                <Input
                  id="product-price-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => handleChange("price", e.target.value)}
                  placeholder="0.00"
                  error={Boolean(fieldErrors.price)}
                  disabled={isSubmitting}
                />
              </FormField>

              <FormField
                htmlFor="product-compare-at-price-input"
                label="Compare-at Price"
                helperText="Original price before discount"
                error={fieldErrors.compareAtPrice}
              >
                <Input
                  id="product-compare-at-price-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.compareAtPrice}
                  onChange={(e) => handleChange("compareAtPrice", e.target.value)}
                  placeholder="0.00"
                  error={Boolean(fieldErrors.compareAtPrice)}
                  disabled={isSubmitting}
                />
              </FormField>

              <FormField
                htmlFor="product-currency-input"
                label="Currency"
                error={fieldErrors.currency}
              >
                <Input
                  id="product-currency-input"
                  value={formData.currency}
                  onChange={(e) => handleChange("currency", e.target.value)}
                  placeholder="USD"
                  error={Boolean(fieldErrors.currency)}
                  disabled={isSubmitting}
                  maxLength={3}
                />
              </FormField>
            </div>
          </CardContent>
        </Card>

        {/* Inventory / Stock Rules Card */}
        <Card>
          <CardHeader>
            <CardTitle>Inventory & Order Limits</CardTitle>
            <CardDescription>Stock tracking thresholds and purchase limits</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "var(--space-4)" }}>
              <FormField
                htmlFor="product-sku-input"
                label="SKU (Stock Keeping Unit)"
                helperText="Unique merchant code for this product"
                error={fieldErrors.sku}
              >
                <Input
                  id="product-sku-input"
                  value={formData.sku}
                  onChange={(e) => handleChange("sku", e.target.value)}
                  placeholder="e.g. PROD-001"
                  error={Boolean(fieldErrors.sku)}
                  disabled={isSubmitting}
                />
              </FormField>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-4)" }}>
                <FormField
                  htmlFor="product-low-stock-threshold-input"
                  label="Low-Stock Threshold"
                  helperText="Stock level at which storefront displays 'Only X left' (default: 5)"
                  error={fieldErrors.lowStockThreshold}
                >
                  <Input
                    id="product-low-stock-threshold-input"
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
                  htmlFor="product-max-order-quantity-input"
                  label="Maximum Order Quantity"
                  helperText="Maximum units allowed per order (leave empty for unlimited)"
                  error={fieldErrors.maxOrderQuantity}
                >
                  <Input
                    id="product-max-order-quantity-input"
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
            </div>
          </CardContent>
          <CardFooter>
            <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end", width: "100%" }}>
              {onCancel && (
                <Button
                  variant="outline"
                  size="md"
                  type="button"
                  onClick={onCancel}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              )}
              <Button
                variant="primary"
                size="md"
                type="submit"
                disabled={isSubmitting}
                loading={isSubmitting}
              >
                {isSubmitting ? "Creating Product..." : "Save Product"}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </form>
  );
}
