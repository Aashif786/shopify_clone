"use client";

import React, { useState, useEffect, useMemo } from "react";
import { generateVariantCombinations } from "@shopify-clone/products/combinations";
import type {
  ProductDetailDTO,
  ProductStatus,
  ProductTypeDTO,
  CategoryDTO,
  ProductTagDTO,
} from "@shopify-clone/products";
import {
  Button,
  Input,
  Textarea,
  Select,
  type SelectOption,
  FormField,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Alert,
} from "@shopify-clone/ui";
import {
  Plus,
  Trash2,
  Star,
  ArrowUp,
  ArrowDown,
  Tag as TagIcon,
  FolderTree,
  Layers,
  ImagePlus,
  X,
  CheckSquare,
  Square,
  SlidersHorizontal,
  Eye,
  EyeOff,
} from "lucide-react";
import { apiClient, ApiClientError } from "../../../lib/api-client";

export interface FormOption {
  name: string;
  values: string[];
}

export interface FormVariantRow {
  id: string;
  enabled: boolean;
  title: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  sku: string;
  price: string;
  compareAtPrice: string;
  inventoryQuantity: string;
  mediaIndex: number | null;
}

export interface ProductFormData {
  title: string;
  description: string;
  slug: string;
  status: ProductStatus;
  price: string;
  compareAtPrice: string;
  sku: string;
  currency: string;
  lowStockThreshold: string;
  maxOrderQuantity: string;
  typeId: string;
  categoryId: string;
}

export interface ProductFormProps {
  storeId: string;
  onSuccess?: (product: ProductDetailDTO) => void;
  onCancel?: () => void;
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
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
    typeId: "",
    categoryId: "",
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Classification state
  const [types, setTypes] = useState<ProductTypeDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [storeTags, setStoreTags] = useState<ProductTagDTO[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>("");

  // Inline creation states
  const [isCreatingType, setIsCreatingType] = useState<boolean>(false);
  const [newTypeName, setNewTypeName] = useState<string>("");
  const [isCreatingCategory, setIsCreatingCategory] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>("");

  // Media state
  const [mediaItems, setMediaItems] = useState<Array<{ url: string; altText: string }>>([]);
  const [newMediaUrl, setNewMediaUrl] = useState<string>("");
  const [newMediaAlt, setNewMediaAlt] = useState<string>("");

  // Options & Variants state
  const [hasOptions, setHasOptions] = useState<boolean>(false);
  const [options, setOptions] = useState<FormOption[]>([
    { name: "Size", values: ["S", "M", "L"] },
  ]);
  const [optionValueInputs, setOptionValueInputs] = useState<Record<number, string>>({});
  const [variantRows, setVariantRows] = useState<FormVariantRow[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [bulkPrice, setBulkPrice] = useState<string>("");
  const [bulkCompareAt, setBulkCompareAt] = useState<string>("");
  const [bulkInventory, setBulkInventory] = useState<string>("");

  useEffect(() => {
    let isMounted = true;
    async function loadMetadata() {
      try {
        const [typesRes, catsRes, tagsRes] = await Promise.allSettled([
          apiClient.get<{ items: ProductTypeDTO[] }>(
            `/api/v1/stores/${storeId}/product-types`,
            { storeId }
          ),
          apiClient.get<{ items: CategoryDTO[] }>(
            `/api/v1/stores/${storeId}/categories`,
            { storeId }
          ),
          apiClient.get<{ items: ProductTagDTO[] }>(
            `/api/v1/stores/${storeId}/tags`,
            { storeId }
          ),
        ]);

        if (isMounted) {
          if (typesRes.status === "fulfilled" && typesRes.value?.items) {
            setTypes(dedupeById(typesRes.value.items));
          }
          if (catsRes.status === "fulfilled" && catsRes.value?.items) {
            setCategories(dedupeById(catsRes.value.items));
          }
          if (tagsRes.status === "fulfilled" && tagsRes.value?.items) {
            setStoreTags(dedupeById(tagsRes.value.items));
          }
        }
      } catch {
        // Fallback silently if offline or initial load
      }
    }

    loadMetadata();
    return () => {
      isMounted = false;
    };
  }, [storeId]);

  const typeOptions: SelectOption[] = useMemo(() => {
    const list: SelectOption[] = [
      { label: "None (Unclassified)", value: "" },
    ];
    const seen = new Set<string>([""]);
    for (const t of types) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        list.push({ label: t.name, value: t.id });
      }
    }
    return list;
  }, [types]);

  const categoryOptions: SelectOption[] = useMemo(() => {
    const list: SelectOption[] = [
      { label: "None (Uncategorized)", value: "" },
    ];
    const seen = new Set<string>([""]);
    for (const c of categories) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        list.push({ label: c.name, value: c.id });
      }
    }
    return list;
  }, [categories]);

  const handleChange = (
    field: keyof ProductFormData,
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

  const handleCreateType = async () => {
    const trimmed = newTypeName.trim();
    if (!trimmed) return;
    try {
      const created = await apiClient.post<ProductTypeDTO>(
        `/api/v1/stores/${storeId}/product-types`,
        { name: trimmed },
        { storeId }
      );
      setTypes((prev) =>
        prev.some((t) => t.id === created.id) ? prev : [...prev, created]
      );
      setFormData((prev) => ({ ...prev, typeId: created.id }));
      setNewTypeName("");
      setIsCreatingType(false);
    } catch (err: unknown) {
      setGeneralError(
        err instanceof Error ? err.message : "Failed to create product type"
      );
    }
  };

  const handleCreateCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    try {
      const created = await apiClient.post<CategoryDTO>(
        `/api/v1/stores/${storeId}/categories`,
        { name: trimmed },
        { storeId }
      );
      setCategories((prev) =>
        prev.some((c) => c.id === created.id) ? prev : [...prev, created]
      );
      setFormData((prev) => ({ ...prev, categoryId: created.id }));
      setNewCategoryName("");
      setIsCreatingCategory(false);
    } catch (err: unknown) {
      setGeneralError(
        err instanceof Error ? err.message : "Failed to create category"
      );
    }
  };

  const handleAddTag = (rawTag: string) => {
    const trimmed = rawTag.trim();
    if (!trimmed) return;
    const normalized = trimmed.toLowerCase();
    if (!selectedTags.some((t) => t.toLowerCase() === normalized)) {
      setSelectedTags((prev) => [...prev, trimmed]);
    }
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleAddMedia = () => {
    const trimmedUrl = newMediaUrl.trim();
    if (!trimmedUrl) return;
    setMediaItems((prev) => [
      ...prev,
      { url: trimmedUrl, altText: newMediaAlt.trim() },
    ]);
    setNewMediaUrl("");
    setNewMediaAlt("");
  };

  const handleRemoveMedia = (index: number) => {
    setMediaItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSetPrimaryMedia = (index: number) => {
    if (index === 0) return;
    setMediaItems((prev) => {
      const item = prev[index];
      if (!item) return prev;
      const rest = prev.filter((_, i) => i !== index);
      return [item, ...rest];
    });
  };

  const handleMoveMedia = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= mediaItems.length) return;
    setMediaItems((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      if (moved) copy.splice(toIndex, 0, moved);
      return copy;
    });
  };

  // Synchronize variant combinations when options or slug change
  useEffect(() => {
    if (!hasOptions) {
      setVariantRows([]);
      setSelectedRowIds(new Set());
      return;
    }

    const combos = generateVariantCombinations(
      options.map((o) => ({ name: o.name, values: o.values }))
    );

    setVariantRows((prevRows) => {
      const prevMap = new Map<string, FormVariantRow>();
      for (const r of prevRows) {
        prevMap.set(r.title, r);
      }

      const baseSlug =
        formData.slug.trim() ||
        formData.title
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-");

      return combos.map((combo) => {
        const existing = prevMap.get(combo.title);
        if (existing) {
          return {
            ...existing,
            option1: combo.option1,
            option2: combo.option2,
            option3: combo.option3,
          };
        }

        const autoSuffix = combo.title
          .replace(/[^a-zA-Z0-9]+/g, "-")
          .toUpperCase();
        const autoSku = baseSlug
          ? `${baseSlug.toUpperCase()}-${autoSuffix}`
          : "";

        return {
          id: `var-${combo.title}`,
          enabled: true,
          title: combo.title,
          option1: combo.option1,
          option2: combo.option2,
          option3: combo.option3,
          sku: autoSku,
          price: formData.price || "0.00",
          compareAtPrice: formData.compareAtPrice || "",
          inventoryQuantity: "10",
          mediaIndex: null,
        };
      });
    });
  }, [hasOptions, options, formData.slug, formData.title]);

  const handleAddOption = () => {
    if (options.length >= 3) return;
    const presets = ["Size", "Color", "Material", "Style"];
    const unused = presets.find((p) => !options.some((o) => o.name.toLowerCase() === p.toLowerCase())) || "Option";
    setOptions((prev) => [...prev, { name: unused, values: [] }]);
  };

  const handleRemoveOption = (index: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOptionNameChange = (index: number, name: string) => {
    setOptions((prev) => {
      const copy = [...prev];
      if (copy[index]) copy[index] = { ...copy[index], name };
      return copy;
    });
  };

  const handleAddOptionValue = (index: number, rawVal: string) => {
    const trimmed = rawVal.trim();
    if (!trimmed) return;
    setOptions((prev) => {
      const copy = [...prev];
      const opt = copy[index];
      if (opt && !opt.values.includes(trimmed)) {
        copy[index] = { ...opt, values: [...opt.values, trimmed] };
      }
      return copy;
    });
    setOptionValueInputs((prev) => ({ ...prev, [index]: "" }));
  };

  const handleRemoveOptionValue = (optionIndex: number, valIndex: number) => {
    setOptions((prev) => {
      const copy = [...prev];
      const opt = copy[optionIndex];
      if (opt) {
        copy[optionIndex] = {
          ...opt,
          values: opt.values.filter((_, i) => i !== valIndex),
        };
      }
      return copy;
    });
  };

  const handleVariantRowChange = (
    id: string,
    field: keyof FormVariantRow,
    value: unknown
  ) => {
    setVariantRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedRowIds.size === variantRows.length) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(variantRows.map((r) => r.id)));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApplyBulkPrice = () => {
    if (!bulkPrice.trim()) return;
    const targets = selectedRowIds.size > 0 ? selectedRowIds : new Set(variantRows.map((r) => r.id));
    setVariantRows((prev) =>
      prev.map((r) => (targets.has(r.id) ? { ...r, price: bulkPrice } : r))
    );
  };

  const handleApplyBulkCompareAt = () => {
    const targets = selectedRowIds.size > 0 ? selectedRowIds : new Set(variantRows.map((r) => r.id));
    setVariantRows((prev) =>
      prev.map((r) => (targets.has(r.id) ? { ...r, compareAtPrice: bulkCompareAt } : r))
    );
  };

  const handleApplyBulkInventory = () => {
    if (!bulkInventory.trim()) return;
    const targets = selectedRowIds.size > 0 ? selectedRowIds : new Set(variantRows.map((r) => r.id));
    setVariantRows((prev) =>
      prev.map((r) => (targets.has(r.id) ? { ...r, inventoryQuantity: bulkInventory } : r))
    );
  };

  const handleBulkEnable = (enable: boolean) => {
    const targets = selectedRowIds.size > 0 ? selectedRowIds : new Set(variantRows.map((r) => r.id));
    setVariantRows((prev) =>
      prev.map((r) => (targets.has(r.id) ? { ...r, enabled: enable } : r))
    );
  };

  const validateClientSide = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.title.trim()) {
      errors.title = "Product title is required";
    } else if (formData.title.trim().length > 255) {
      errors.title = "Product title cannot exceed 255 characters";
    }

    if (!hasOptions) {
      if (formData.price.trim()) {
        const priceNum = Number(formData.price);
        if (isNaN(priceNum) || priceNum < 0) {
          errors.price = "Price must be a valid non-negative number";
        }
      }

      if (formData.compareAtPrice.trim()) {
        const compareNum = Number(formData.compareAtPrice);
        if (isNaN(compareNum) || compareNum < 0) {
          errors.compareAtPrice =
            "Compare-at price must be a valid non-negative number";
        }
      }

      if (formData.sku.trim() && formData.sku.trim().length > 100) {
        errors.sku = "SKU cannot exceed 100 characters";
      }
    } else {
      const activeOptions = options.filter(
        (o) => o.name.trim().length > 0 && o.values.length > 0
      );
      if (activeOptions.length === 0) {
        setGeneralError(
          "Please define at least one option with values (e.g. Size: S, M, L)"
        );
        return false;
      }
      const enabledVariants = variantRows.filter((r) => r.enabled);
      if (enabledVariants.length === 0) {
        setGeneralError("Please enable at least one variant combination");
        return false;
      }
      for (const row of enabledVariants) {
        const p = Number(row.price);
        if (isNaN(p) || p < 0) {
          setGeneralError(`Invalid price for variant combination "${row.title}"`);
          return false;
        }
      }
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

    if (!validateClientSide()) {
      return;
    }

    setIsSubmitting(true);

    try {
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
        typeId?: string | null;
        categoryId?: string | null;
        tags?: string[];
        options?: Array<{ name: string; position: number; values: string[] }>;
        variants?: Array<{
          title: string;
          sku: string | null;
          price: number;
          compareAtPrice: number | null;
          option1: string | null;
          option2: string | null;
          option3: string | null;
          mediaIndex: number | null;
          inventoryQuantity: number;
          position: number;
        }>;
        media?: Array<{ url: string; altText?: string | null; position?: number }>;
      } = {
        title: formData.title.trim(),
        description: formData.description.trim()
          ? formData.description.trim()
          : null,
        status: formData.status,
        currency: formData.currency.trim().toUpperCase() || "USD",
      };

      if (formData.slug.trim()) {
        payload.slug = formData.slug.trim();
      }

      if (hasOptions) {
        const activeOptions = options
          .filter((opt) => opt.name.trim().length > 0 && opt.values.length > 0)
          .map((opt, idx) => ({
            name: opt.name.trim(),
            position: idx,
            values: opt.values.map((v) => v.trim()).filter(Boolean),
          }));

        const enabledVariants = variantRows.filter((r) => r.enabled);
        payload.options = activeOptions;
        payload.variants = enabledVariants.map((r, idx) => {
          const priceNum = Number(r.price);
          const compNum = r.compareAtPrice.trim() ? Number(r.compareAtPrice) : null;
          const qty = parseInt(r.inventoryQuantity || "0", 10);
          return {
            title: r.title,
            sku: r.sku.trim() ? r.sku.trim().toUpperCase() : null,
            price: isNaN(priceNum) || priceNum < 0 ? 0 : Math.round(priceNum * 100),
            compareAtPrice: compNum !== null && !isNaN(compNum) && compNum >= 0 ? Math.round(compNum * 100) : null,
            option1: r.option1,
            option2: r.option2,
            option3: r.option3,
            mediaIndex: r.mediaIndex,
            inventoryQuantity: isNaN(qty) || qty < 0 ? 0 : qty,
            position: idx,
          };
        });

        // Use first variant's pricing & sku for catalog display
        if (payload.variants.length > 0 && payload.variants[0]) {
          payload.price = payload.variants[0].price;
          payload.compareAtPrice = payload.variants[0].compareAtPrice;
          payload.sku = payload.variants[0].sku;
        }
      } else {
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

      if (formData.typeId.trim()) {
        payload.typeId = formData.typeId.trim();
      }

      if (formData.categoryId.trim()) {
        payload.categoryId = formData.categoryId.trim();
      }

      if (selectedTags.length > 0) {
        payload.tags = selectedTags;
      }

      if (mediaItems.length > 0) {
        payload.media = mediaItems.map((m, idx) => ({
          url: m.url,
          altText: m.altText || null,
          position: idx,
        }));
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
    <form onSubmit={handleSubmit} noValidate className="product-form space-y-6">
      {generalError && (
        <Alert variant="danger" title="Product Creation Error">
          {generalError}
        </Alert>
      )}

      {/* 2-Column Responsive Layout: Main 8 Cols, Sidebar 4 Cols */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main 8-Column Content */}
        <div className="lg:col-span-8 space-y-6">
          {/* Basic Details Card */}
          <Card className="rounded-xl border border-border/60 bg-card shadow-xs">
            <CardHeader className="p-5 pb-4 border-b border-border/60">
              <CardTitle className="text-base font-semibold text-foreground">
                Basic Information
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Title, handle, and description for the product
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-7">
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
                      className="h-9 text-sm"
                    />
                  </FormField>
                </div>

                <div className="md:col-span-5">
                  <FormField
                    htmlFor="product-slug-input"
                    label="URL Handle (Slug)"
                    helperText="Generated from title if left blank."
                    error={fieldErrors.slug}
                  >
                    <Input
                      id="product-slug-input"
                      value={formData.slug}
                      onChange={(e) => handleChange("slug", e.target.value)}
                      placeholder="e.g. classic-cotton-t-shirt"
                      error={Boolean(fieldErrors.slug)}
                      disabled={isSubmitting}
                      className="h-9 font-mono text-xs"
                    />
                  </FormField>
                </div>
              </div>

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
                  className="text-sm"
                />
              </FormField>
            </CardContent>
          </Card>

          {/* Media / Images Card */}
          <Card className="rounded-xl border border-border/60 bg-card shadow-xs">
            <CardHeader className="p-5 pb-4 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-foreground">
                    Media & Images
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Product photos, primary image selection, and display order
                  </CardDescription>
                </div>
                <span className="text-xs font-mono text-muted-foreground">
                  {mediaItems.length} {mediaItems.length === 1 ? "image" : "images"}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {/* Add Media Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end p-3.5 bg-muted/20 border border-border/60 rounded-lg">
                <div className="sm:col-span-7">
                  <FormField htmlFor="new-media-url-input" label="Image URL">
                    <Input
                      id="new-media-url-input"
                      value={newMediaUrl}
                      onChange={(e) => setNewMediaUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/photo-..."
                      className="h-9 text-xs font-mono"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddMedia();
                        }
                      }}
                    />
                  </FormField>
                </div>
                <div className="sm:col-span-3">
                  <FormField htmlFor="new-media-alt-input" label="Alt Text">
                    <Input
                      id="new-media-alt-input"
                      value={newMediaAlt}
                      onChange={(e) => setNewMediaAlt(e.target.value)}
                      placeholder="e.g. Front view"
                      className="h-9 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddMedia();
                        }
                      }}
                    />
                  </FormField>
                </div>
                <div className="sm:col-span-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full h-9 justify-center gap-1.5 text-xs font-medium"
                    onClick={handleAddMedia}
                    disabled={!newMediaUrl.trim()}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </Button>
                </div>
              </div>

              {/* Media Preview Grid */}
              {mediaItems.length === 0 ? (
                <div className="p-8 border border-dashed border-border/80 rounded-xl text-center flex flex-col items-center justify-center text-muted-foreground">
                  <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center mb-2">
                    <ImagePlus className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-xs font-medium text-foreground">No media added yet</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Paste an image URL above to display product imagery
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {mediaItems.map((item, index) => {
                    const isPrimary = index === 0;
                    return (
                      <div
                        key={index}
                        className={`group relative rounded-lg border overflow-hidden bg-muted/20 transition-all ${
                          isPrimary
                            ? "border-primary ring-1 ring-primary/40 shadow-xs"
                            : "border-border/60 hover:border-border"
                        }`}
                      >
                        <div className="aspect-square w-full bg-muted/30 overflow-hidden relative">
                          <img
                            src={item.url}
                            alt={item.altText || `Product image ${index + 1}`}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&auto=format&fit=crop&q=60";
                            }}
                          />
                          {isPrimary && (
                            <span className="absolute top-1.5 left-1.5 bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded shadow-xs flex items-center gap-1">
                              <Star className="w-2.5 h-2.5 fill-current" />
                              Primary
                            </span>
                          )}
                        </div>

                        <div className="p-2 bg-card border-t border-border/40 space-y-1.5">
                          <p
                            className="text-[11px] truncate text-muted-foreground"
                            title={item.altText || item.url}
                          >
                            {item.altText || "No alt text"}
                          </p>

                          <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/30">
                            <div className="flex items-center gap-0.5">
                              {index > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleMoveMedia(index, index - 1)}
                                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted text-xs"
                                  title="Move Up"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                              )}
                              {index < mediaItems.length - 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleMoveMedia(index, index + 1)}
                                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted text-xs"
                                  title="Move Down"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              )}
                              {!isPrimary && (
                                <button
                                  type="button"
                                  onClick={() => handleSetPrimaryMedia(index)}
                                  className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-muted text-xs"
                                  title="Set as primary"
                                >
                                  <Star className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveMedia(index)}
                              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs"
                              title="Remove"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pricing Card */}
          <Card className="rounded-xl border border-border/60 bg-card shadow-xs">
            <CardHeader className="p-5 pb-4 border-b border-border/60">
              <CardTitle className="text-base font-semibold text-foreground">
                Pricing
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Set the product selling price and compare-at discount
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                    className="h-9 font-mono text-sm"
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
                    className="h-9 font-mono text-sm"
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
                    className="h-9 font-mono text-sm uppercase"
                  />
                </FormField>
              </div>
            </CardContent>
          </Card>

          {/* Inventory / Stock Rules Card */}
          <Card className="rounded-xl border border-border/60 bg-card shadow-xs">
            <CardHeader className="p-5 pb-4 border-b border-border/60">
              <CardTitle className="text-base font-semibold text-foreground">
                Inventory & Order Limits
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Stock tracking thresholds and purchase limits
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  htmlFor="product-sku-input"
                  label="SKU (Stock Keeping Unit)"
                  helperText="Unique merchant code"
                  error={fieldErrors.sku}
                >
                  <Input
                    id="product-sku-input"
                    value={formData.sku}
                    onChange={(e) => handleChange("sku", e.target.value)}
                    placeholder="e.g. PROD-001"
                    error={Boolean(fieldErrors.sku)}
                    disabled={isSubmitting}
                    className="h-9 font-mono text-sm uppercase"
                  />
                </FormField>

                <FormField
                  htmlFor="product-low-stock-threshold-input"
                  label="Low-Stock Threshold"
                  helperText="Alert threshold (default: 5)"
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
                    className="h-9 font-mono text-sm"
                  />
                </FormField>

                <FormField
                  htmlFor="product-max-order-quantity-input"
                  label="Max Order Quantity"
                  helperText="Per order limit (empty = unlimited)"
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
                    className="h-9 font-mono text-sm"
                  />
                </FormField>
              </div>
            </CardContent>
          </Card>

          {/* Options & Variants Card */}
          <Card className="rounded-xl border border-border/60 bg-card shadow-xs">
            <CardHeader className="p-5 pb-4 border-b border-border/60">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-primary" />
                    <span>Product Options & Variants</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Configure multiple options (e.g. Size, Color) to generate purchasable variant combinations
                  </CardDescription>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-foreground bg-muted/50 px-3 py-1.5 rounded-lg border border-border/60 hover:bg-muted/80 transition-colors">
                  <input
                    type="checkbox"
                    checked={hasOptions}
                    onChange={(e) => setHasOptions(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                  />
                  <span>Has multiple options</span>
                </label>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-6">
              {!hasOptions ? (
                <div className="py-6 text-center text-muted-foreground space-y-2">
                  <p className="text-xs">
                    This product sells as a single standard item using the base pricing and SKU configured above.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setHasOptions(true)}
                    className="text-xs gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Enable Options & Variants
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Options Builder */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Configured Options ({options.length}/3)
                      </span>
                      {options.length < 3 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddOption}
                          className="h-7 text-xs gap-1.5"
                        >
                          <Plus className="w-3 h-3" />
                          Add Option
                        </Button>
                      )}
                    </div>

                    <div className="space-y-3">
                      {options.map((opt, optIdx) => (
                        <div
                          key={optIdx}
                          className="p-3.5 rounded-xl border border-border/70 bg-muted/20 space-y-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                                {optIdx + 1}
                              </span>
                              <span>Option {optIdx + 1}</span>
                            </span>
                            {options.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveOption(optIdx)}
                                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 p-1"
                                title="Remove Option"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                            {/* Option Name & Preset Suggestions */}
                            <div className="sm:col-span-4 space-y-1.5">
                              <label className="text-[11px] font-medium text-muted-foreground block">
                                Option Name
                              </label>
                              <Input
                                value={opt.name}
                                onChange={(e) => handleOptionNameChange(optIdx, e.target.value)}
                                placeholder="e.g. Size, Color, Material"
                                className="h-8 text-xs font-medium"
                              />
                              <div className="flex flex-wrap gap-1 pt-1">
                                {["Size", "Color", "Material", "Style"].map((preset) => (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() => handleOptionNameChange(optIdx, preset)}
                                    className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                      opt.name.toLowerCase() === preset.toLowerCase()
                                        ? "bg-primary/15 border-primary/40 text-primary font-semibold"
                                        : "bg-muted/60 border-border/60 text-muted-foreground hover:text-foreground"
                                    }`}
                                  >
                                    {preset}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Option Values Tags */}
                            <div className="sm:col-span-8 space-y-1.5">
                              <label className="text-[11px] font-medium text-muted-foreground block">
                                Option Values
                              </label>
                              <div className="flex flex-wrap gap-1.5 min-h-[32px] p-1.5 rounded-lg border border-border/70 bg-card">
                                {opt.values.map((val, valIdx) => (
                                  <span
                                    key={valIdx}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-foreground text-xs font-medium border border-border/60 group"
                                  >
                                    {val}
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveOptionValue(optIdx, valIdx)}
                                      className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                                      aria-label={`Remove value ${val}`}
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))}
                                <input
                                  type="text"
                                  value={optionValueInputs[optIdx] || ""}
                                  onChange={(e) =>
                                    setOptionValueInputs((prev) => ({
                                      ...prev,
                                      [optIdx]: e.target.value,
                                    }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === ",") {
                                      e.preventDefault();
                                      handleAddOptionValue(optIdx, optionValueInputs[optIdx] || "");
                                    }
                                  }}
                                  placeholder={
                                    opt.values.length === 0
                                      ? "Type value and press Enter (e.g. S, M, L)..."
                                      : "Add another value..."
                                  }
                                  className="flex-1 min-w-[120px] bg-transparent text-xs text-foreground outline-hidden px-1 h-6 placeholder:text-muted-foreground/60"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Variant Combination Matrix Table */}
                  <div className="space-y-3 pt-2 border-t border-border/60">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Variant Matrix ({variantRows.filter((r) => r.enabled).length} of {variantRows.length} active)
                        </h4>
                        <p className="text-[11px] text-muted-foreground">
                          Set custom price, compare-at, SKU, inventory, and variant image for each combination
                        </p>
                      </div>

                      {/* Bulk Action Controls */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleToggleSelectAll}
                          className="h-7 text-[11px] px-2.5 gap-1"
                        >
                          {selectedRowIds.size === variantRows.length ? (
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
                          onClick={() => handleBulkEnable(true)}
                          className="h-7 text-[11px] px-2"
                        >
                          Enable
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleBulkEnable(false)}
                          className="h-7 text-[11px] px-2 text-muted-foreground hover:text-destructive"
                        >
                          Disable
                        </Button>
                      </div>
                    </div>

                    {/* Bulk Editing Toolstrip */}
                    <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/60 text-xs">
                      <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                        {selectedRowIds.size > 0
                          ? `Bulk Edit (${selectedRowIds.size} selected):`
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
                          Apply
                        </Button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Input
                          placeholder="Comp ($)"
                          value={bulkCompareAt}
                          onChange={(e) => setBulkCompareAt(e.target.value)}
                          className="h-7 w-20 text-xs font-mono"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleApplyBulkCompareAt}
                          className="h-7 text-[11px] px-2"
                        >
                          Apply Comp
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

                    {/* High-Density Matrix Table */}
                    <div className="w-full overflow-x-auto rounded-xl border border-border/70">
                      <table className="w-full min-w-[720px] text-left text-xs border-collapse">
                        <thead className="bg-muted/50 border-b border-border/70 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          <tr>
                            <th className="py-2.5 px-3 w-8 text-center">
                              <input
                                type="checkbox"
                                checked={
                                  variantRows.length > 0 &&
                                  selectedRowIds.size === variantRows.length
                                }
                                onChange={handleToggleSelectAll}
                                className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5"
                              />
                            </th>
                            <th className="py-2.5 px-3 w-10 text-center">Active</th>
                            <th className="py-2.5 px-3">Variant Combination</th>
                            <th className="py-2.5 px-3 w-32">Image</th>
                            <th className="py-2.5 px-3 w-28">Price ($)</th>
                            <th className="py-2.5 px-3 w-28">Compare-at ($)</th>
                            <th className="py-2.5 px-3 w-36">SKU</th>
                            <th className="py-2.5 px-3 w-24">Stock</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60 bg-card">
                          {variantRows.map((row) => {
                            const isSelected = selectedRowIds.has(row.id);
                            return (
                              <tr
                                key={row.id}
                                className={`transition-colors ${
                                  !row.enabled
                                    ? "opacity-50 bg-muted/20"
                                    : isSelected
                                    ? "bg-primary/5"
                                    : "hover:bg-muted/30"
                                }`}
                              >
                                <td className="py-2 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleSelectRow(row.id)}
                                    className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5"
                                  />
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleVariantRowChange(row.id, "enabled", !row.enabled)
                                    }
                                    className={`p-1 rounded transition-colors ${
                                      row.enabled
                                        ? "text-primary hover:bg-primary/10"
                                        : "text-muted-foreground hover:bg-muted"
                                    }`}
                                    title={row.enabled ? "Variant is active" : "Variant is excluded"}
                                  >
                                    {row.enabled ? (
                                      <Eye className="w-3.5 h-3.5" />
                                    ) : (
                                      <EyeOff className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </td>
                                <td className="py-2 px-3 font-semibold text-foreground">
                                  <span>{row.title}</span>
                                </td>
                                <td className="py-2 px-3">
                                  {mediaItems.length > 0 ? (
                                    <select
                                      value={row.mediaIndex !== null ? String(row.mediaIndex) : ""}
                                      onChange={(e) =>
                                        handleVariantRowChange(
                                          row.id,
                                          "mediaIndex",
                                          e.target.value === "" ? null : Number(e.target.value)
                                        )
                                      }
                                      className="h-7 w-full rounded border border-border/70 bg-card px-1.5 text-[11px] text-foreground focus:ring-1 focus:ring-primary"
                                    >
                                      <option value="">Default Media</option>
                                      {mediaItems.map((m, idx) => (
                                        <option key={idx} value={String(idx)}>
                                          Media #{idx + 1} {m.altText ? `(${m.altText})` : ""}
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
                                    value={row.price}
                                    onChange={(e) =>
                                      handleVariantRowChange(row.id, "price", e.target.value)
                                    }
                                    className="h-7 text-xs font-mono"
                                    disabled={!row.enabled}
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={row.compareAtPrice}
                                    onChange={(e) =>
                                      handleVariantRowChange(
                                        row.id,
                                        "compareAtPrice",
                                        e.target.value
                                      )
                                    }
                                    placeholder="—"
                                    className="h-7 text-xs font-mono"
                                    disabled={!row.enabled}
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <Input
                                    value={row.sku}
                                    onChange={(e) =>
                                      handleVariantRowChange(
                                        row.id,
                                        "sku",
                                        e.target.value.toUpperCase()
                                      )
                                    }
                                    placeholder="SKU"
                                    className="h-7 text-xs font-mono uppercase"
                                    disabled={!row.enabled}
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={row.inventoryQuantity}
                                    onChange={(e) =>
                                      handleVariantRowChange(
                                        row.id,
                                        "inventoryQuantity",
                                        e.target.value
                                      )
                                    }
                                    className="h-7 text-xs font-mono"
                                    disabled={!row.enabled}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar 4-Column Content */}
        <div className="lg:col-span-4 space-y-6">
          {/* Status & Visibility Card */}
          <Card className="rounded-xl border border-border/60 bg-card shadow-xs">
            <CardHeader className="p-5 pb-4 border-b border-border/60">
              <CardTitle className="text-base font-semibold text-foreground">
                Publishing & Status
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Control storefront visibility
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
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

              <div className="p-3 bg-muted/40 rounded-lg border border-border/50 text-xs text-muted-foreground space-y-1">
                <span className="font-semibold text-foreground block">
                  Visibility Rule:
                </span>
                <p className="m-0 leading-relaxed">
                  Active items are published immediately to the storefront catalog.
                  Draft items remain merchant-only.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Classification & Organization Card */}
          <Card className="rounded-xl border border-border/60 bg-card shadow-xs">
            <CardHeader className="p-5 pb-4 border-b border-border/60">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-primary" />
                Product Classification
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Type, category hierarchy, and searchable tags
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              {/* Product Type with Inline Creation */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="product-type-select"
                    className="text-xs font-semibold text-foreground"
                  >
                    Product Type
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCreatingType(!isCreatingType)}
                    className="text-[11px] font-medium text-primary hover:underline flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" />
                    {isCreatingType ? "Cancel" : "New Type"}
                  </button>
                </div>

                {isCreatingType ? (
                  <div className="flex items-center gap-1.5 pt-1">
                    <Input
                      value={newTypeName}
                      onChange={(e) => setNewTypeName(e.target.value)}
                      placeholder="e.g. T-Shirts, Shoes"
                      className="h-8 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleCreateType();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      className="h-8 text-xs px-2.5"
                      onClick={handleCreateType}
                      disabled={!newTypeName.trim()}
                    >
                      Save
                    </Button>
                  </div>
                ) : (
                  <Select
                    id="product-type-select"
                    value={formData.typeId}
                    onChange={(e) => handleChange("typeId", e.target.value)}
                    options={typeOptions}
                    disabled={isSubmitting}
                  />
                )}
              </div>

              {/* Category with Inline Creation */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="product-category-select"
                    className="text-xs font-semibold text-foreground flex items-center gap-1"
                  >
                    <FolderTree className="w-3 h-3 text-muted-foreground" />
                    Category
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCreatingCategory(!isCreatingCategory)}
                    className="text-[11px] font-medium text-primary hover:underline flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" />
                    {isCreatingCategory ? "Cancel" : "New Category"}
                  </button>
                </div>

                {isCreatingCategory ? (
                  <div className="flex items-center gap-1.5 pt-1">
                    <Input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="e.g. Apparel, Footwear"
                      className="h-8 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleCreateCategory();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      className="h-8 text-xs px-2.5"
                      onClick={handleCreateCategory}
                      disabled={!newCategoryName.trim()}
                    >
                      Save
                    </Button>
                  </div>
                ) : (
                  <Select
                    id="product-category-select"
                    value={formData.categoryId}
                    onChange={(e) => handleChange("categoryId", e.target.value)}
                    options={categoryOptions}
                    disabled={isSubmitting}
                  />
                )}
              </div>

              {/* Tags Management */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <TagIcon className="w-3 h-3 text-muted-foreground" />
                  Product Tags
                </label>

                {/* Selected Tag Pills */}
                {selectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {selectedTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-destructive text-muted-foreground transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Tag Input */}
                <div className="flex items-center gap-1.5">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        handleAddTag(tagInput);
                      }
                    }}
                    placeholder="Type tag and press enter..."
                    className="h-8 text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs px-2.5"
                    onClick={() => handleAddTag(tagInput)}
                    disabled={!tagInput.trim()}
                  >
                    Add
                  </Button>
                </div>

                {/* Suggested Store Tags */}
                {storeTags.filter(
                  (st) =>
                    !selectedTags.some(
                      (t) => t.toLowerCase() === st.name.toLowerCase()
                    )
                ).length > 0 && (
                  <div className="pt-1">
                    <span className="text-[10px] text-muted-foreground block mb-1">
                      Existing Store Tags:
                    </span>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      {storeTags
                        .filter(
                          (st) =>
                            !selectedTags.some(
                              (t) => t.toLowerCase() === st.name.toLowerCase()
                            )
                        )
                        .slice(0, 10)
                        .map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => handleAddTag(st.name)}
                            className="px-1.5 py-0.5 rounded text-[11px] bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            + {st.name}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Action / Save Card */}
          <Card className="rounded-xl border border-border/60 bg-card shadow-xs lg:sticky lg:top-6">
            <CardHeader className="p-5 pb-4 border-b border-border/60">
              <CardTitle className="text-base font-semibold text-foreground">
                Save Product
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Commit product changes to catalog
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <Button
                variant="primary"
                size="md"
                type="submit"
                disabled={isSubmitting}
                loading={isSubmitting}
                className="w-full justify-center"
              >
                {isSubmitting ? "Creating Product..." : "Save Product"}
              </Button>
              {onCancel && (
                <Button
                  variant="outline"
                  size="md"
                  type="button"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="w-full justify-center"
                >
                  Cancel
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
