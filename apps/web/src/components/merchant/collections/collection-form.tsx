"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Save } from "lucide-react";
import type { CollectionDTO, CollectionStatus } from "@calcart/products";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  Select,
  Textarea,
  type SelectOption,
} from "@calcart/ui";
import { apiClient, ApiClientError } from "@/lib/api-client";

export interface CollectionFormProps {
  storeId: string;
  storeSlug: string;
  initialCollection?: CollectionDTO;
  onSuccess?: (collection: CollectionDTO) => void;
}

export function CollectionForm({
  storeId,
  storeSlug,
  initialCollection,
  onSuccess,
}: CollectionFormProps) {
  const router = useRouter();
  const isEdit = Boolean(initialCollection);

  const [title, setTitle] = useState(initialCollection?.title || "");
  const [slug, setSlug] = useState(initialCollection?.slug || "");
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(isEdit);
  const [description, setDescription] = useState(initialCollection?.description || "");
  const [status, setStatus] = useState<CollectionStatus>(initialCollection?.status || "ACTIVE");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Auto-generate slug from title in create mode
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!isSlugManuallyEdited && !isEdit) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setSlug(generated);
    }
  };

  const handleSlugChange = (val: string) => {
    setIsSlugManuallyEdited(true);
    setSlug(
      val
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "")
        .replace(/-+/g, "-")
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const trimmedTitle = title.trim();
    const trimmedSlug = slug.trim();

    if (!trimmedTitle) {
      setError("Collection title is required");
      return;
    }

    if (!trimmedSlug) {
      setError("Collection URL handle is required");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit && initialCollection) {
        const updated = await apiClient.patch<CollectionDTO>(
          `/api/v1/stores/${storeId}/collections/${initialCollection.id}`,
          {
            title: trimmedTitle,
            slug: trimmedSlug,
            description: description.trim() || null,
            status,
          },
          { storeId }
        );
        setSuccessMessage("Collection updated successfully");
        if (onSuccess) {
          onSuccess(updated);
        }
      } else {
        const created = await apiClient.post<CollectionDTO>(
          `/api/v1/stores/${storeId}/collections`,
          {
            title: trimmedTitle,
            slug: trimmedSlug,
            description: description.trim() || null,
            status,
          },
          { storeId }
        );
        setSuccessMessage("Collection created successfully");
        if (onSuccess) {
          onSuccess(created);
        } else {
          router.push(`/merchant/collections/${created.id}`);
        }
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.code === "DUPLICATE_COLLECTION_SLUG" || err.message?.includes("slug")) {
          setError(`A collection with the URL handle "${trimmedSlug}" already exists in this store.`);
        } else {
          setError(err.message || "Failed to save collection");
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred while saving the collection");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusOptions: SelectOption[] = [
    { value: "ACTIVE", label: "Active (Visible on Storefront)" },
    { value: "ARCHIVED", label: "Archived (Hidden from Storefront)" },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="danger" title="Save Error">
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert variant="success" title="Success">
          {successMessage}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Primary Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold">General Information</CardTitle>
              <CardDescription className="text-xs">
                Title and description for this collection as displayed to customers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField label="Collection Title" required>
                <Input
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g. Summer Essentials, New Arrivals, Sale"
                  required
                />
              </FormField>

              <FormField
                label="Description"
                helperText="Optional context or editorial text shown on the collection page."
              >
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell customers about this collection..."
                  rows={4}
                />
              </FormField>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold">Search Engine & URL Handle</CardTitle>
              <CardDescription className="text-xs">
                The URL slug used to access this collection on your storefront.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <FormField
                label="URL Handle (Slug)"
                required
                helperText="Must be unique across your store. Only lowercase alphanumeric characters and hyphens."
              >
                <Input
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="summer-essentials"
                  required
                />
              </FormField>

              {/* URL Preview */}
              <div className="p-3 bg-muted/40 border border-border/80 rounded-lg flex items-center justify-between text-xs font-mono text-muted-foreground">
                <span className="truncate">
                  /stores/{storeSlug}/collections/{slug || "[handle]"}
                </span>
                {isEdit && status === "ACTIVE" && initialCollection?.slug && (
                  <Link
                    href={`/stores/${storeSlug}/collections/${initialCollection.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline shrink-0 ml-2 inline-flex items-center gap-1 font-sans text-xs"
                  >
                    <span>View Live</span>
                    <ArrowUpRight size={12} />
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Status & Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold">Publishing Status</CardTitle>
              <CardDescription className="text-xs">
                Control whether this collection is discoverable on your public storefront.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField label="Status">
                <Select
                  options={statusOptions}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CollectionStatus)}
                />
              </FormField>

              <div className="text-[11px] text-muted-foreground p-2.5 rounded-lg bg-muted/30 border border-border/60">
                {status === "ACTIVE" ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    Active collections appear in storefront navigation and allow customers to browse assigned products.
                  </span>
                ) : (
                  <span>
                    Archived collections return 404 on the storefront and are hidden from discovery catalogs.
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link href="/merchant/collections">
              <Button variant="outline" size="md">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={isSubmitting}
            >
              <Save size={14} className="mr-1.5" />
              {isEdit ? "Update Collection" : "Create Collection"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
