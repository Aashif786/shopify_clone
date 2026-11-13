"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Layers } from "lucide-react";
import type { CollectionDTO } from "@calcart/products";
import { Alert, Badge, Button } from "@calcart/ui";
import { MerchantShell } from "@/components/merchant/MerchantShell";
import { CollectionForm } from "@/components/merchant/collections/collection-form";
import { CollectionProductManager } from "@/components/merchant/collections/collection-product-manager";
import { useStore } from "@/context/store-context";
import { apiClient } from "@/lib/api-client";

interface EditCollectionPageProps {
  params: Promise<{ collectionId: string }>;
}

export default function EditCollectionPage({ params }: EditCollectionPageProps) {
  const { collectionId } = use(params);
  const { activeStore } = useStore();

  const [collection, setCollection] = useState<CollectionDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCollection = useCallback(async () => {
    if (!activeStore) return;

    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<CollectionDTO>(
        `/api/v1/stores/${activeStore.id}/collections/${collectionId}`,
        { storeId: activeStore.id },
      );
      setCollection(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load collection details",
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeStore, collectionId]);

  useEffect(() => {
    fetchCollection();
  }, [fetchCollection]);

  if (!activeStore) {
    return (
      <MerchantShell>
        <div className="p-8 text-center text-xs text-muted-foreground">
          Please select or activate a store to manage collections.
        </div>
      </MerchantShell>
    );
  }

  if (isLoading) {
    return (
      <MerchantShell>
        <div className="p-16 text-center space-y-3">
          <div className="w-8 h-8 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-muted-foreground">Loading collection...</p>
        </div>
      </MerchantShell>
    );
  }

  if (error || !collection) {
    return (
      <MerchantShell>
        <div className="max-w-3xl mx-auto py-12 px-4 space-y-4">
          <Alert variant="danger" title="Collection Not Found">
            {error || "The requested collection could not be found."}
          </Alert>
          <Link href="/merchant/collections">
            <Button variant="outline" size="sm">
              <ArrowLeft size={12} className="mr-1.5" />
              Back to Collections
            </Button>
          </Link>
        </div>
      </MerchantShell>
    );
  }

  return (
    <MerchantShell>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Navigation Breadcrumb & Header */}
        <div className="space-y-2 pb-4 border-b border-border">
          <Link
            href="/merchant/collections"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft size={12} />
            <span>Back to Collections</span>
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Layers size={20} className="text-primary" />
                <span>{collection.title}</span>
              </h1>
              {collection.status === "ACTIVE" ? (
                <Badge variant="success" size="sm">
                  Active
                </Badge>
              ) : (
                <Badge variant="neutral" size="sm">
                  Archived
                </Badge>
              )}
            </div>

            {collection.status === "ACTIVE" && (
              <Link
                href={`/stores/${activeStore.slug}/collections/${collection.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium"
              >
                <span>View on Storefront</span>
                <ArrowUpRight size={13} />
              </Link>
            )}
          </div>
        </div>

        {/* Collection Edit Form */}
        <CollectionForm
          storeId={activeStore.id}
          storeSlug={activeStore.slug}
          initialCollection={collection}
          onSuccess={(updated: CollectionDTO) => setCollection(updated)}
        />

        {/* Collection Products Management */}
        <CollectionProductManager
          storeId={activeStore.id}
          collectionId={collection.id}
          currency={activeStore.currency}
          onProductCountChange={(newCount: number) => {
            setCollection((prev) => (prev ? { ...prev, productCount: newCount } : null));
          }}
        />
      </div>
    </MerchantShell>
  );
}
