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
import {
  SlidersHorizontal,
  Eye,
  EyeOff,
  CheckSquare,
  Square,
} from "lucide-react";
import { apiClient, ApiClientError } from "../../../lib/api-client";

export interface VariantEditState {
  id: string;
  title: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  inventoryQuantity: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  imageId: string | null;
}

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

  const [variantEdits, setVariantEdits] = useState<VariantEditState[]>(() =>
    product.variants.map((v) => ({
      id: v.id,
      title: v.title,
      sku: v.sku || "",
      price: (v.price / 100).toFixed(2),
      compareAtPrice:
        v.compareAtPrice !== null ? (v.compareAtPrice / 100).toFixed(2) : "",
      inventoryQuantity: String(v.inventoryQuantity ?? 0),
      status: v.status,
      imageId: v.imageId ?? null,
    }))
  );
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());
  const [bulkPrice, setBulkPrice] = useState<string>("");
  const [bulkInventory, setBulkInventory] = useState<string>("");

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

  const handleVariantChange = (
    id: string,
    field: keyof VariantEditState,
    value: unknown
  ) => {
    setVariantEdits((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [field]: value } : v))
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedVariantIds.size === variantEdits.length) {
      setSelectedVariantIds(new Set());
    } else {
      setSelectedVariantIds(new Set(variantEdits.map((v) => v.id)));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedVariantIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApplyBulkPrice = () => {
    if (!bulkPrice.trim()) return;
    const targets =
      selectedVariantIds.size > 0
        ? selectedVariantIds
        : new Set(variantEdits.map((v) => v.id));
    setVariantEdits((prev) =>
      prev.map((v) => (targets.has(v.id) ? { ...v, price: bulkPrice } : v))
    );
  };

  const handleApplyBulkInventory = () => {
    if (!bulkInventory.trim()) return;
    const targets =
      selectedVariantIds.size > 0
        ? selectedVariantIds
        : new Set(variantEdits.map((v) => v.id));
    setVariantEdits((prev) =>
      prev.map((v) =>
        targets.has(v.id) ? { ...v, inventoryQuantity: bulkInventory } : v
      )
    );
  };

  const handleBulkStatus = (status: "ACTIVE" | "INACTIVE") => {
    const targets =
      selectedVariantIds.size > 0
        ? selectedVariantIds
        : new Set(variantEdits.map((v) => v.id));
    setVariantEdits((prev) =>
      prev.map((v) => (targets.has(v.id) ? { ...v, status } : v))
    );
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

      // 2. Batch update all variants
      const batchUpdates = variantEdits.map((v) => {
        const p = parseFloat(v.price);
        const comp = v.compareAtPrice.trim() ? parseFloat(v.compareAtPrice) : null;
        const qty = parseInt(v.inventoryQuantity, 10);

        return {
          id: v.id,
          price: isNaN(p) || p < 0 ? undefined : Math.round(p * 100),
          compareAtPrice:
            comp !== null && !isNaN(comp) && comp >= 0
              ? Math.round(comp * 100)
              : null,
          sku: v.sku.trim() ? v.sku.trim().toUpperCase() : null,
          status: v.status,
          imageId: v.imageId,
          inventoryQuantity: isNaN(qty) || qty < 0 ? 0 : qty,
        };
      });

      if (batchUpdates.length > 0) {
        await apiClient.patch(
          `/api/v1/stores/${storeId}/products/${product.id}/variants/batch`,
          { variants: batchUpdates },
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

        {/* Variants Management Card */}
        <Card className="rounded-xl border border-border/60 bg-card shadow-xs">
          <CardHeader className="p-5 pb-4 border-b border-border/60">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-primary" />
                  <span>Product Variants ({variantEdits.length})</span>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Edit individual variant pricing, SKU, stock quantity, image, and active availability
                </CardDescription>
              </div>

              {/* Bulk Actions */}
              {variantEdits.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleToggleSelectAll}
                    className="h-7 text-[11px] px-2.5 gap-1"
                  >
                    {selectedVariantIds.size === variantEdits.length ? (
                      <>
                        <CheckSquare className="w-3 h-3 text-primary" />
                        Deselect All
                      </>
                    ) : (
                      <>
                        <Square className="w-3 h-3" />
                        Select All
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleBulkStatus("ACTIVE")}
                    className="h-7 text-[11px] px-2"
                  >
                    Set Active
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleBulkStatus("INACTIVE")}
                    className="h-7 text-[11px] px-2 text-muted-foreground hover:text-destructive"
                  >
                    Set Inactive
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>

          {product.options && product.options.length > 0 && (
            <div className="px-5 py-3 bg-muted/30 border-b border-border/60 flex flex-wrap gap-2.5 items-center">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Configured Options:
              </span>
              {product.options.map((opt) => (
                <div
                  key={opt.id}
                  className="inline-flex items-center gap-1.5 text-xs bg-card px-2.5 py-1 rounded-md border border-border/60"
                >
                  <span className="font-semibold text-foreground">{opt.name}:</span>
                  <span className="text-muted-foreground">{opt.values.join(", ")}</span>
                </div>
              ))}
            </div>
          )}

          <CardContent className="p-5 space-y-4">
            {variantEdits.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/60 text-xs">
                <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                  {selectedVariantIds.size > 0
                    ? `Bulk Edit (${selectedVariantIds.size} selected):`
                    : "Bulk Edit (All):"}
                </span>
                <div className="flex items-center gap-1.5">
                  <Input
                    placeholder="Price ($)"
                    value={bulkPrice}
                    onChange={(e) => setBulkPrice(e.target.value)}
                    className="h-7 w-20 text-xs font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleApplyBulkPrice}
                    className="h-7 text-[11px] px-2"
                  >
                    Apply Price
                  </Button>
                </div>
                <div className="flex items-center gap-1.5">
                  <Input
                    placeholder="Stock"
                    value={bulkInventory}
                    onChange={(e) => setBulkInventory(e.target.value)}
                    className="h-7 w-20 text-xs font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleApplyBulkInventory}
                    className="h-7 text-[11px] px-2"
                  >
                    Apply Stock
                  </Button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-border/70">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-muted/50 border-b border-border/70 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    {variantEdits.length > 1 && (
                      <th className="py-2.5 px-3 w-8 text-center">
                        <input
                          type="checkbox"
                          checked={
                            variantEdits.length > 0 &&
                            selectedVariantIds.size === variantEdits.length
                          }
                          onChange={handleToggleSelectAll}
                          className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5"
                        />
                      </th>
                    )}
                    <th className="py-2.5 px-3 w-10 text-center">Active</th>
                    <th className="py-2.5 px-3">Variant Title</th>
                    <th className="py-2.5 px-3 w-36">Image</th>
                    <th className="py-2.5 px-3 w-28">Price ($)</th>
                    <th className="py-2.5 px-3 w-28">Compare-at ($)</th>
                    <th className="py-2.5 px-3 w-36">SKU</th>
                    <th className="py-2.5 px-3 w-24">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 bg-card">
                  {variantEdits.map((v) => {
                    const isSelected = selectedVariantIds.has(v.id);
                    const isActive = v.status === "ACTIVE";
                    return (
                      <tr
                        key={v.id}
                        className={`transition-colors ${
                          !isActive
                            ? "opacity-60 bg-muted/20"
                            : isSelected
                            ? "bg-primary/5"
                            : "hover:bg-muted/30"
                        }`}
                      >
                        {variantEdits.length > 1 && (
                          <td className="py-2 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectRow(v.id)}
                              className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5"
                            />
                          </td>
                        )}
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              handleVariantChange(
                                v.id,
                                "status",
                                isActive ? "INACTIVE" : "ACTIVE"
                              )
                            }
                            className={`p-1 rounded transition-colors ${
                              isActive
                                ? "text-primary hover:bg-primary/10"
                                : "text-muted-foreground hover:bg-muted"
                            }`}
                            title={isActive ? "Variant is active" : "Variant is inactive"}
                          >
                            {isActive ? (
                              <Eye className="w-3.5 h-3.5" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                        <td className="py-2 px-3 font-semibold text-foreground">
                          {v.title}
                        </td>
                        <td className="py-2 px-3">
                          {product.media && product.media.length > 0 ? (
                            <select
                              value={v.imageId || ""}
                              onChange={(e) =>
                                handleVariantChange(
                                  v.id,
                                  "imageId",
                                  e.target.value === "" ? null : e.target.value
                                )
                              }
                              className="h-7 w-full rounded border border-border/70 bg-card px-1.5 text-[11px] text-foreground focus:ring-1 focus:ring-primary"
                            >
                              <option value="">Default Media</option>
                              {product.media.map((m) => (
                                <option key={m.id} value={m.id}>
                                  Media #{m.position + 1} {m.altText ? `(${m.altText})` : ""}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">
                              No media
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={v.price}
                            onChange={(e) =>
                              handleVariantChange(v.id, "price", e.target.value)
                            }
                            className="h-7 text-xs font-mono"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={v.compareAtPrice}
                            onChange={(e) =>
                              handleVariantChange(
                                v.id,
                                "compareAtPrice",
                                e.target.value
                              )
                            }
                            placeholder="—"
                            className="h-7 text-xs font-mono"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            value={v.sku}
                            onChange={(e) =>
                              handleVariantChange(
                                v.id,
                                "sku",
                                e.target.value.toUpperCase()
                              )
                            }
                            placeholder="SKU"
                            className="h-7 text-xs font-mono uppercase"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            type="number"
                            min="0"
                            value={v.inventoryQuantity}
                            onChange={(e) =>
                              handleVariantChange(
                                v.id,
                                "inventoryQuantity",
                                e.target.value
                              )
                            }
                            className="h-7 text-xs font-mono"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

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
