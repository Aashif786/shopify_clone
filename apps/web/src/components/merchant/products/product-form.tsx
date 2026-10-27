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
  Badge,
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
  Dialog,
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
import { useStore } from "../../../context/store-context";

export interface FormOption {
  name: string;
  values: string[];
}

export interface FormVariantRow {
  id: string;
  enabled: boolean;
  title: string;
  displayTitle?: string;
  publishedAsProduct?: boolean;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  sku: string;
  price: string;
  compareAtPrice: string;
  inventoryQuantity: string;
  mediaIndex: number | null;
  mediaIndexes?: number[];
  mediaIds?: string[];
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
  initialProduct?: ProductDetailDTO;
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
  initialProduct,
  onSuccess,
  onCancel,
}: ProductFormProps) {
  const isEdit = Boolean(initialProduct);

  let activeStore: { currency?: string } | null = null;
  try {
    const storeCtx = useStore();
    activeStore = storeCtx.activeStore;
  } catch {
    // Fallback if rendered outside StoreProvider
  }

  const storeCurrency = activeStore?.currency || "USD";
  const defaultVariant = initialProduct?.variants?.[0];

  const [formData, setFormData] = useState<ProductFormData>(() => {
    if (initialProduct) {
      return {
        title: initialProduct.title,
        description: initialProduct.description || "",
        slug: initialProduct.slug,
        status: initialProduct.status,
        price: defaultVariant ? (defaultVariant.price / 100).toFixed(2) : "",
        compareAtPrice:
          defaultVariant && defaultVariant.compareAtPrice !== null
            ? (defaultVariant.compareAtPrice / 100).toFixed(2)
            : "",
        sku: defaultVariant?.sku || "",
        currency: defaultVariant?.currency || storeCurrency,
        lowStockThreshold: String(initialProduct.lowStockThreshold ?? 5),
        maxOrderQuantity:
          initialProduct.maxOrderQuantity !== null && initialProduct.maxOrderQuantity !== undefined
            ? String(initialProduct.maxOrderQuantity)
            : "",
        typeId: initialProduct.typeId || "",
        categoryId: initialProduct.categoryId || "",
      };
    }
    return {
      title: "",
      description: "",
      slug: "",
      status: "DRAFT",
      price: "",
      compareAtPrice: "",
      sku: "",
      currency: storeCurrency,
      lowStockThreshold: "5",
      maxOrderQuantity: "",
      typeId: "",
      categoryId: "",
    };
  });

  useEffect(() => {
    if (activeStore?.currency && !initialProduct) {
      setFormData((prev) => ({
        ...prev,
        currency: prev.currency === "USD" || !prev.currency ? (activeStore?.currency ?? "USD") : prev.currency,
      }));
    }
  }, [activeStore?.currency, initialProduct]);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Classification state
  const [types, setTypes] = useState<ProductTypeDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [storeTags, setStoreTags] = useState<ProductTagDTO[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>(
    () => initialProduct?.tags || []
  );
  const [tagInput, setTagInput] = useState<string>("");

  // Inline creation states
  const [isCreatingType, setIsCreatingType] = useState<boolean>(false);
  const [newTypeName, setNewTypeName] = useState<string>("");
  const [isCreatingCategory, setIsCreatingCategory] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>("");

  // Media state
  const [mediaItems, setMediaItems] = useState<Array<{ id?: string; url: string; altText: string }>>(() => {
    if (initialProduct?.media && initialProduct.media.length > 0) {
      return initialProduct.media.map((m) => ({
        id: m.id,
        url: m.url,
        altText: m.altText || "",
      }));
    }
    return [];
  });
  const [newMediaUrl, setNewMediaUrl] = useState<string>("");
  const [newMediaAlt, setNewMediaAlt] = useState<string>("");

  // Options & Variants state
  const initialHasOptions = Boolean(
    initialProduct?.options && initialProduct.options.length > 0
  );
  const [hasOptions, setHasOptions] = useState<boolean>(initialHasOptions);
  const [options, setOptions] = useState<FormOption[]>(() => {
    if (initialProduct?.options && initialProduct.options.length > 0) {
      return initialProduct.options.map((opt) => ({
        name: opt.name,
        values: [...opt.values],
      }));
    }
    return [{ name: "Size", values: ["S", "M", "L"] }];
  });
  const [optionValueInputs, setOptionValueInputs] = useState<Record<number, string>>({});
  const [variantRows, setVariantRows] = useState<FormVariantRow[]>(() => {
    if (initialProduct?.variants && initialHasOptions) {
      const mediaList = initialProduct.media || [];
      return initialProduct.variants.map((v) => {
        let mIndex: number | null = null;
        if (v.imageId) {
          const foundIdx = mediaList.findIndex((m) => m.id === v.imageId);
          if (foundIdx >= 0) mIndex = foundIdx;
        }

        const mediaIndexes: number[] = [];
        if (v.mediaIds && v.mediaIds.length > 0) {
          for (const mid of v.mediaIds) {
            const idx = mediaList.findIndex((m) => m.id === mid);
            if (idx >= 0 && !mediaIndexes.includes(idx)) {
              mediaIndexes.push(idx);
            }
          }
        } else if (mIndex !== null) {
          mediaIndexes.push(mIndex);
        }

        return {
          id: v.id,
          enabled: v.status !== "INACTIVE" && v.status !== "ARCHIVED",
          title: v.title,
          displayTitle: v.displayTitle || "",
          publishedAsProduct: Boolean(v.publishedAsProduct),
          option1: v.option1 ?? null,
          option2: v.option2 ?? null,
          option3: v.option3 ?? null,
          sku: v.sku || "",
          price: (v.price / 100).toFixed(2),
          compareAtPrice:
            v.compareAtPrice !== null ? (v.compareAtPrice / 100).toFixed(2) : "",
          inventoryQuantity: String(v.inventoryQuantity ?? 0),
          mediaIndex: mediaIndexes.length > 0 && mediaIndexes[0] !== undefined ? mediaIndexes[0] : (mIndex ?? null),
          mediaIndexes,
          mediaIds: v.mediaIds || (v.imageId ? [v.imageId] : []),
        };
      });
    }
    return [];
  });
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [bulkPrice, setBulkPrice] = useState<string>("");
  const [bulkCompareAt, setBulkCompareAt] = useState<string>("");
  const [bulkInventory, setBulkInventory] = useState<string>("");
  const [assigningMediaVariantId, setAssigningMediaVariantId] = useState<string | null>(null);
  const assigningVariant = variantRows.find((r) => r.id === assigningMediaVariantId);

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
    setVariantRows((prev) =>
      prev.map((row) => {
        let newMediaIndex = row.mediaIndex;
        if (newMediaIndex === index) {
          newMediaIndex = null;
        } else if (newMediaIndex !== null && newMediaIndex > index) {
          newMediaIndex -= 1;
        }

        const newMediaIndexes = (row.mediaIndexes || [])
          .filter((i) => i !== index)
          .map((i) => (i > index ? i - 1 : i));

        return {
          ...row,
          mediaIndex: newMediaIndexes.length > 0 && newMediaIndexes[0] !== undefined ? newMediaIndexes[0] : (newMediaIndex ?? null),
          mediaIndexes: newMediaIndexes,
        };
      })
    );
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
      const prevByOptions = new Map<string, FormVariantRow>();
      for (const r of prevRows) {
        prevMap.set(r.title, r);
        const optKey = [r.option1, r.option2, r.option3]
          .filter(Boolean)
          .join(" / ")
          .toLowerCase();
        if (optKey) prevByOptions.set(optKey, r);
      }

      const baseSlug =
        formData.slug.trim() ||
        formData.title
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-");

      return combos.map((combo) => {
        const comboOptKey = [combo.option1, combo.option2, combo.option3]
          .filter(Boolean)
          .join(" / ")
          .toLowerCase();
        const existing =
          prevMap.get(combo.title) ||
          (comboOptKey ? prevByOptions.get(comboOptKey) : undefined);
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
          id: `temp-var-${combo.title}`,
          enabled: true,
          title: combo.title,
          displayTitle: "",
          publishedAsProduct: false,
          option1: combo.option1,
          option2: combo.option2,
          option3: combo.option3,
          sku: autoSku,
          price: formData.price || "0.00",
          compareAtPrice: formData.compareAtPrice || "",
          inventoryQuantity: "10",
          mediaIndex: null,
          mediaIndexes: [],
          mediaIds: [],
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

  const handleBulkPublishAsProduct = (publish: boolean) => {
    const targets = selectedRowIds.size > 0 ? selectedRowIds : new Set(variantRows.map((r) => r.id));
    setVariantRows((prev) =>
      prev.map((r) => (targets.has(r.id) ? { ...r, publishedAsProduct: publish } : r))
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
          id?: string;
          title: string;
          displayTitle?: string | null;
          publishedAsProduct?: boolean;
          sku: string | null;
          price: number;
          compareAtPrice: number | null;
          option1: string | null;
          option2: string | null;
          option3: string | null;
          mediaIndex: number | null;
          mediaIndexes?: number[];
          mediaIds?: string[];
          inventoryQuantity: number;
          status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";
          position: number;
        }>;
        media?: Array<{ id?: string; url: string; altText?: string | null; position: number }>;
      } = {
        title: formData.title.trim(),
        description: formData.description.trim()
          ? formData.description.trim()
          : null,
        status: formData.status,
      };

      if (formData.slug.trim()) {
        payload.slug = formData.slug.trim();
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
        } else {
          payload.maxOrderQuantity = null;
        }
      } else if (isEdit) {
        payload.maxOrderQuantity = null;
      }

      payload.typeId = formData.typeId.trim() ? formData.typeId.trim() : null;
      payload.categoryId = formData.categoryId.trim() ? formData.categoryId.trim() : null;
      payload.tags = selectedTags;

      payload.media = mediaItems.map((m, idx) => ({
        id: m.id,
        url: m.url,
        altText: m.altText || null,
        position: idx,
      }));

      if (hasOptions) {
        const activeOptions = options
          .filter((opt) => opt.name.trim().length > 0 && opt.values.length > 0)
          .map((opt, idx) => ({
            name: opt.name.trim(),
            position: idx,
            values: opt.values.map((v) => v.trim()).filter(Boolean),
          }));

        payload.options = activeOptions;
        payload.variants = variantRows.map((r, idx) => {
          const priceNum = Number(r.price);
          const compNum = r.compareAtPrice.trim() ? Number(r.compareAtPrice) : null;
          const qty = parseInt(r.inventoryQuantity || "0", 10);
          const mediaIndexes =
            r.mediaIndexes && r.mediaIndexes.length > 0
              ? r.mediaIndexes
              : r.mediaIndex !== null
              ? [r.mediaIndex]
              : [];
          return {
            id: r.id && !r.id.startsWith("temp-var-") ? r.id : undefined,
            title: r.title,
            displayTitle: r.displayTitle?.trim() ? r.displayTitle.trim() : null,
            publishedAsProduct: Boolean(r.publishedAsProduct),
            sku: r.sku.trim() ? r.sku.trim().toUpperCase() : null,
            price: isNaN(priceNum) || priceNum < 0 ? 0 : Math.round(priceNum * 100),
            compareAtPrice: compNum !== null && !isNaN(compNum) && compNum >= 0 ? Math.round(compNum * 100) : null,
            option1: r.option1,
            option2: r.option2,
            option3: r.option3,
            mediaIndex: mediaIndexes.length > 0 && mediaIndexes[0] !== undefined ? mediaIndexes[0] : null,
            mediaIndexes,
            mediaIds: r.mediaIds,
            inventoryQuantity: isNaN(qty) || qty < 0 ? 0 : qty,
            status: r.enabled ? "ACTIVE" : "INACTIVE",
            position: idx,
          };
        });

        // Use first active variant's pricing & sku for catalog display
        const firstActive = payload.variants?.find((v) => v.status === "ACTIVE") || payload.variants?.[0];
        if (firstActive) {
          payload.price = firstActive.price;
          payload.compareAtPrice = firstActive.compareAtPrice;
          payload.sku = firstActive.sku;
        }
      } else {
        payload.options = [];
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

        if (isEdit) {
          const defaultVar = initialProduct?.variants?.[0];
          payload.variants = [
            {
              id: defaultVar?.id,
              title: "Default Title",
              sku: payload.sku || null,
              price: payload.price ?? (defaultVar ? defaultVar.price : 0),
              compareAtPrice: payload.compareAtPrice ?? (defaultVar ? defaultVar.compareAtPrice : null),
              option1: null,
              option2: null,
              option3: null,
              mediaIndex: mediaItems.length > 0 ? 0 : null,
              inventoryQuantity: defaultVar?.inventoryQuantity ?? 0,
              status: "ACTIVE",
              position: 0,
            },
          ];
        }
      }

      let result: ProductDetailDTO;
      if (isEdit && initialProduct) {
        result = await apiClient.patch<ProductDetailDTO>(
          `/api/v1/stores/${storeId}/products/${initialProduct.id}`,
          payload,
          { storeId }
        );
      } else {
        result = await apiClient.post<ProductDetailDTO>(
          `/api/v1/stores/${storeId}/products`,
          payload,
          { storeId }
        );
      }

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.fields && Object.keys(err.fields).length > 0) {
          setFieldErrors(err.fields);
        }
        setGeneralError(err.message || (isEdit ? "Failed to update product" : "Failed to create product"));
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
      {isEdit && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border/60 gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground m-0">
              Edit Product: {initialProduct?.title}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 m-0">
              Modify options, variants, media, pricing, and catalog details
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            {onCancel && (
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={isSubmitting}
              loading={isSubmitting}
            >
              {isSubmitting ? "Saving Changes..." : "Save Changes"}
            </Button>
          </div>
        </div>
      )}

      {generalError && (
        <Alert
          variant="danger"
          title={isEdit ? "Product Update Error" : "Product Creation Error"}
        >
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

                <div className="flex flex-col gap-1 sm:col-span-1">
                  <span className="text-xs font-semibold text-foreground">
                    Store Currency
                  </span>
                  <div
                    id="product-currency-display"
                    className="h-9 px-3 py-2 rounded-lg border border-border/60 bg-muted/40 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between"
                  >
                    <span>{storeCurrency}</span>
                    <Badge variant="neutral" className="text-[10px] font-semibold uppercase">
                      Store Default
                    </Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Store default operating currency
                  </span>
                </div>
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
                        <span className="text-border/60">|</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleBulkPublishAsProduct(true)}
                          className="h-7 text-[11px] px-2 text-primary hover:bg-primary/10"
                        >
                          Publish as Product
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleBulkPublishAsProduct(false)}
                          className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                        >
                          Unpublish as Product
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
                      <table className="w-full min-w-[960px] text-left text-xs border-collapse">
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
                            <th className="py-2.5 px-3 w-20 text-center" title="Publish variant as an individual listing in storefront search and catalog">
                              Publish
                            </th>
                            <th className="py-2.5 px-3 w-40">Variant</th>
                            <th className="py-2.5 px-3 min-w-[160px]">Display Title</th>
                            <th className="py-2.5 px-3 w-36">Images</th>
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
                                <td className="py-2 px-3 text-center">
                                  <label className="inline-flex items-center justify-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(row.publishedAsProduct)}
                                      onChange={(e) =>
                                        handleVariantRowChange(
                                          row.id,
                                          "publishedAsProduct",
                                          e.target.checked
                                        )
                                      }
                                      disabled={!row.enabled}
                                      className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5"
                                      title="Publish variant as standalone product in catalog & search"
                                    />
                                  </label>
                                </td>
                                <td className="py-2 px-3 font-semibold text-foreground whitespace-nowrap">
                                  <span>{row.title}</span>
                                  {row.publishedAsProduct && (
                                    <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                                      Standalone
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3">
                                  <Input
                                    value={row.displayTitle || ""}
                                    onChange={(e) =>
                                      handleVariantRowChange(row.id, "displayTitle", e.target.value)
                                    }
                                    placeholder={
                                      formData.title.trim()
                                        ? `${formData.title.trim()} - ${row.title}`
                                        : row.title
                                    }
                                    className="h-7 text-xs"
                                    disabled={!row.enabled}
                                    title="Custom variant title for storefront. Falls back to product title if empty."
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  {mediaItems.length > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => setAssigningMediaVariantId(row.id)}
                                      className="flex items-center gap-1.5 p-1 rounded-md border border-border/70 hover:border-primary/50 hover:bg-muted/40 transition-colors text-left w-full group"
                                      title="Click to assign or reorder images for this variant"
                                    >
                                      {row.mediaIndexes && row.mediaIndexes.length > 0 ? (
                                        <div className="flex items-center gap-1">
                                          {row.mediaIndexes.slice(0, 2).map((idx, i) => {
                                            const m = mediaItems[idx];
                                            if (!m) return null;
                                            return (
                                              <div
                                                key={idx}
                                                className={`relative w-6 h-6 rounded overflow-hidden border ${
                                                  i === 0 ? "border-primary ring-1 ring-primary/40" : "border-border/80"
                                                }`}
                                              >
                                                <img src={m.url} alt={m.altText || ""} className="w-full h-full object-cover" />
                                              </div>
                                            );
                                          })}
                                          {row.mediaIndexes.length > 2 && (
                                            <span className="text-[10px] text-muted-foreground font-semibold">
                                              +{row.mediaIndexes.length - 2}
                                            </span>
                                          )}
                                        </div>
                                      ) : row.mediaIndex !== null && mediaItems[row.mediaIndex]?.url ? (
                                        <div className="relative w-6 h-6 rounded overflow-hidden border border-primary ring-1 ring-primary/40">
                                          <img
                                            src={mediaItems[row.mediaIndex]?.url}
                                            alt=""
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                      ) : (
                                        <span className="text-[11px] text-muted-foreground italic flex items-center gap-1">
                                          <ImagePlus className="w-3 h-3" />
                                          Assign
                                        </span>
                                      )}
                                      <span className="ml-auto text-[10px] text-muted-foreground font-medium group-hover:text-primary">
                                        {(row.mediaIndexes?.length || (row.mediaIndex !== null ? 1 : 0))} img
                                      </span>
                                    </button>
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

                  {/* Variant Media Assignment Modal */}
                  <Dialog
                    isOpen={Boolean(assigningMediaVariantId)}
                    onClose={() => setAssigningMediaVariantId(null)}
                    title={`Assign Images: ${assigningVariant?.title || ""}`}
                    description="Select images to assign to this variant. The first assigned image serves as the primary storefront image."
                    size="md"
                    footer={
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (assigningMediaVariantId) {
                              handleVariantRowChange(assigningMediaVariantId, "mediaIndexes", []);
                              handleVariantRowChange(assigningMediaVariantId, "mediaIndex", null);
                            }
                          }}
                        >
                          Clear All
                        </Button>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => setAssigningMediaVariantId(null)}
                        >
                          Done
                        </Button>
                      </div>
                    }
                  >
                    <div className="space-y-4 py-2">
                      {mediaItems.length === 0 ? (
                        <div className="text-center py-8 text-xs text-muted-foreground">
                          No product images uploaded yet. Upload images in the Media section above first.
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[360px] overflow-y-auto p-1">
                          {mediaItems.map((media, idx) => {
                            const currentIndexes =
                              assigningVariant?.mediaIndexes ||
                              (assigningVariant?.mediaIndex !== null && assigningVariant?.mediaIndex !== undefined
                                ? [assigningVariant.mediaIndex]
                                : []);
                            const isSelected = currentIndexes.includes(idx);
                            const orderIndex = currentIndexes.indexOf(idx);
                            const isPrimary = orderIndex === 0;

                            return (
                              <div
                                key={idx}
                                onClick={() => {
                                  if (!assigningMediaVariantId) return;
                                  let updated: number[];
                                  if (isSelected) {
                                    updated = currentIndexes.filter((i) => i !== idx);
                                  } else {
                                    updated = [...currentIndexes, idx];
                                  }
                                  handleVariantRowChange(assigningMediaVariantId, "mediaIndexes", updated);
                                  handleVariantRowChange(
                                    assigningMediaVariantId,
                                    "mediaIndex",
                                    updated.length > 0 ? updated[0] : null
                                  );
                                }}
                                className={`group relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                                  isSelected
                                    ? isPrimary
                                      ? "border-primary ring-2 ring-primary/30"
                                      : "border-primary/80 ring-1 ring-primary/20"
                                    : "border-border/60 hover:border-border hover:shadow-xs"
                                }`}
                              >
                                <img
                                  src={media.url}
                                  alt={media.altText || `Media ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                {isSelected && (
                                  <div className="absolute top-1 left-1 flex items-center gap-1">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                        isPrimary
                                          ? "bg-primary text-primary-foreground shadow-xs"
                                          : "bg-background/90 text-foreground border border-border"
                                      }`}
                                    >
                                      {isPrimary ? "Primary" : `#${orderIndex + 1}`}
                                    </span>
                                  </div>
                                )}
                                {isSelected && !isPrimary && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!assigningMediaVariantId) return;
                                      const reordered = [idx, ...currentIndexes.filter((i) => i !== idx)];
                                      handleVariantRowChange(assigningMediaVariantId, "mediaIndexes", reordered);
                                      handleVariantRowChange(assigningMediaVariantId, "mediaIndex", idx);
                                    }}
                                    className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-background/90 text-[9px] font-medium text-foreground hover:bg-background border border-border/80 shadow-xs"
                                    title="Set as primary image"
                                  >
                                    Make Primary
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </Dialog>
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
                {isEdit ? "Save Changes" : "Save Product"}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                {isEdit
                  ? "Update product and variant changes in catalog"
                  : "Commit product changes to catalog"}
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
                {isSubmitting
                  ? isEdit
                    ? "Saving Changes..."
                    : "Creating Product..."
                  : isEdit
                  ? "Save Changes"
                  : "Save Product"}
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
